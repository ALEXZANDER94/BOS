using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Web;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public record QbPoResult(string Status, string? InvoiceNumber);

public interface IQuickBooksService
{
    Task<bool>         IsConnectedAsync();
    string             GetAuthorizationUrl(string state);
    Task               ExchangeCodeAsync(string code, string realmId);
    Task<QbPoResult>   GetPoStatusAsync(string orderNumber);
    Task<Dictionary<string, QbPoResult>> GetBatchPoStatusAsync(IEnumerable<string> orderNumbers);
    Task               DisconnectAsync();

    // ── Estimates / Invoices integration ─────────────────────────────────────
    Task<List<QbCustomerDto>>    ListCustomersAsync();
    Task<string?>                FindCustomerIdByNameAsync(string name);
    Task<List<QbSubCustomerDto>> ListSubCustomersAsync(string parentCustomerId);
    Task<string?>                FindSubCustomerIdByNameAsync(string parentCustomerId, string name);
    Task<List<QbDocumentDto>>    GetEstimatesForCustomerAsync(string customerId);
    Task<List<QbDocumentDto>>    GetInvoicesForCustomerAsync(string customerId);
    Task<List<QbDocumentDto>>    GetEstimatesForCustomersAsync(IEnumerable<string> customerIds);
    Task<List<QbDocumentDto>>    GetInvoicesForCustomersAsync(IEnumerable<string> customerIds);
    Task<QbDocumentDto?>         GetEstimateByIdAsync(string id);
    Task<QbDocumentDto?>         GetInvoiceByIdAsync(string id);
    Task<QbDocumentDto>          ConvertEstimateToInvoiceAsync(string estimateId, ConvertEstimateEdits? edits);
}

public class QuickBooksService : IQuickBooksService
{
    private const string TokenEndpoint = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
    private const string AuthBase      = "https://appcenter.intuit.com/connect/oauth2";
    private const string ApiBase       = "https://quickbooks.api.intuit.com/v3/company";
    private const string Scope         = "com.intuit.quickbooks.accounting";

    // AES-GCM constants
    private const int NonceSize = 12;   // bytes  (96-bit nonce recommended for GCM)
    private const int TagSize   = 16;   // bytes  (128-bit authentication tag)

    private readonly AppDbContext        _db;
    private readonly IHttpClientFactory  _httpFactory;
    private readonly IConfiguration      _config;
    private readonly ILogger<QuickBooksService> _logger;

    // Lazily resolved encryption key — throws clearly if not configured
    private byte[]? _keyCache;
    private byte[] EncryptionKey
    {
        get
        {
            if (_keyCache is not null) return _keyCache;

            var raw = _config["QuickBooks:EncryptionKey"];
            if (string.IsNullOrWhiteSpace(raw))
            {
                _logger.LogCritical(
                    "QuickBooks:EncryptionKey is not configured. " +
                    "Generate a key with: openssl rand -base64 32  " +
                    "and set it via the QuickBooks__EncryptionKey environment variable.");
                throw new InvalidOperationException(
                    "QuickBooks:EncryptionKey is not configured. See application logs for details.");
            }

            var key = Convert.FromBase64String(raw);
            if (key.Length != 32)
            {
                _logger.LogCritical(
                    "QuickBooks:EncryptionKey must be exactly 32 bytes (256 bits) when base64-decoded. " +
                    "Current key decodes to {Length} bytes.", key.Length);
                throw new InvalidOperationException(
                    "QuickBooks:EncryptionKey is not a valid 256-bit key. See application logs for details.");
            }

            _keyCache = key;
            return _keyCache;
        }
    }

    public QuickBooksService(
        AppDbContext db,
        IHttpClientFactory httpFactory,
        IConfiguration config,
        ILogger<QuickBooksService> logger)
    {
        _db          = db;
        _httpFactory = httpFactory;
        _config      = config;
        _logger      = logger;
    }

    // ── Connection state ──────────────────────────────────────────────────────

    public async Task<bool> IsConnectedAsync()
        => await _db.QuickBooksTokens.AnyAsync();

    // ── OAuth authorization URL ───────────────────────────────────────────────

    public string GetAuthorizationUrl(string state)
    {
        var clientId    = _config["QuickBooks:ClientId"] ?? "";
        var redirectUri = _config["QuickBooks:RedirectUri"] ?? "";

        _logger.LogDebug(
            "Generating QuickBooks authorization URL. ClientId={ClientId} RedirectUri={RedirectUri}",
            clientId, redirectUri);

        var qs = HttpUtility.ParseQueryString(string.Empty);
        qs["client_id"]     = clientId;
        qs["response_type"] = "code";
        qs["scope"]         = Scope;
        qs["redirect_uri"]  = redirectUri;
        qs["state"]         = state;

        return $"{AuthBase}?{qs}";
    }

    // ── Code exchange ─────────────────────────────────────────────────────────

    public async Task ExchangeCodeAsync(string code, string realmId)
    {
        _logger.LogInformation(
            "QuickBooks token exchange initiated. RealmId={RealmId}", realmId);

        var tokens = await CallTokenEndpointAsync(new Dictionary<string, string>
        {
            ["grant_type"]   = "authorization_code",
            ["code"]         = code,
            ["redirect_uri"] = _config["QuickBooks:RedirectUri"] ?? "",
        }, isRefresh: false);

        await UpsertTokenAsync(tokens, realmId);

        _logger.LogInformation(
            "QuickBooks token exchange succeeded. RealmId={RealmId} ExpiresAt={ExpiresAt:u}",
            realmId, tokens.ExpiresAt);
    }

    // ── PO status sync ────────────────────────────────────────────────────────

    public async Task<QbPoResult> GetPoStatusAsync(string orderNumber)
    {
        var invoices = await FetchAllInvoicesAsync();
        if (invoices is null) return new QbPoResult("Not Found", null);

        return ResolveOrderNumber(orderNumber, invoices);
    }

    public async Task<Dictionary<string, QbPoResult>> GetBatchPoStatusAsync(IEnumerable<string> orderNumbers)
    {
        var invoices = await FetchAllInvoicesAsync();
        var result   = new Dictionary<string, QbPoResult>(StringComparer.OrdinalIgnoreCase);

        foreach (var orderNumber in orderNumbers)
        {
            result[orderNumber] = invoices is null
                ? new QbPoResult("Not Found", null)
                : ResolveOrderNumber(orderNumber, invoices);
        }

        return result;
    }

    /// Fetches all QB invoices via paginated queries. Returns null if not connected or on error.
    private async Task<List<JsonElement>?> FetchAllInvoicesAsync()
    {
        var token = await GetValidTokenAsync();
        if (token is null)
        {
            _logger.LogWarning("FetchAllInvoices called but no QuickBooks token is stored.");
            return null;
        }

        var realmId     = DecryptField(token.RealmId, nameof(token.RealmId));
        var accessToken = DecryptField(token.AccessToken, nameof(token.AccessToken));
        var client      = _httpFactory.CreateClient();
        var all         = new List<JsonElement>();
        var pageSize    = 1000;
        var startPos    = 1;

        while (true)
        {
            var query = Uri.EscapeDataString(
                $"SELECT * FROM Invoice STARTPOSITION {startPos} MAXRESULTS {pageSize}");
            var url = $"{ApiBase}/{realmId}/query?query={query}&minorversion=65";

            var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            HttpResponseMessage resp;
            try
            {
                resp = await client.SendAsync(req);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "QuickBooks invoice fetch failed (network error). StartPosition={StartPos}", startPos);
                return null;
            }

            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                _logger.LogError(
                    "QuickBooks invoice fetch returned non-success status. " +
                    "StatusCode={StatusCode} Response={Response}", (int)resp.StatusCode, body);
                return null;
            }

            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("QueryResponse", out var qr))
            {
                _logger.LogError("QuickBooks invoice query response missing 'QueryResponse' property.");
                return null;
            }

            if (!qr.TryGetProperty("Invoice", out var invoiceArr) || invoiceArr.GetArrayLength() == 0)
                break; // no more pages

            foreach (var inv in invoiceArr.EnumerateArray())
                all.Add(inv.Clone());

            _logger.LogDebug("Fetched {Count} invoices from QuickBooks (page starting at {StartPos}).",
                invoiceArr.GetArrayLength(), startPos);

            if (invoiceArr.GetArrayLength() < pageSize)
                break; // last page

            startPos += pageSize;
        }

        _logger.LogDebug("QuickBooks invoice fetch complete. Total={Total}", all.Count);
        return all;
    }

    /// Searches a pre-fetched invoice list for an order number in any line item description.
    private QbPoResult ResolveOrderNumber(string orderNumber, List<JsonElement> invoices)
    {
        JsonElement? match = null;

        foreach (var inv in invoices)
        {
            if (!inv.TryGetProperty("Line", out var lines)) continue;

            foreach (var line in lines.EnumerateArray())
            {
                if (!line.TryGetProperty("Description", out var descProp)) continue;
                var desc = descProp.GetString() ?? "";
                if (desc.Contains(orderNumber, StringComparison.OrdinalIgnoreCase))
                {
                    match = inv;
                    break;
                }
            }

            if (match.HasValue) break;
        }

        if (!match.HasValue)
        {
            _logger.LogWarning(
                "No QB invoice found whose line description contains OrderNumber={OrderNumber}.",
                orderNumber);
            return new QbPoResult("Not Found", null);
        }

        var invoiceNumber = match.Value.TryGetProperty("DocNumber", out var docProp)
            ? docProp.GetString()
            : null;

        var balance = match.Value.TryGetProperty("Balance", out var balProp)
            ? balProp.GetDecimal()
            : 1m; // assume open if field missing

        var status = balance == 0m ? "Paid" : "Unpaid";

        _logger.LogInformation(
            "QB invoice matched. OrderNumber={OrderNumber} InvoiceNumber={InvoiceNumber} Status={Status}",
            orderNumber, invoiceNumber, status);

        return new QbPoResult(status, invoiceNumber);
    }

    // ── Estimates / Invoices ──────────────────────────────────────────────────

    public async Task<List<QbCustomerDto>> ListCustomersAsync()
    {
        var elements = await RunQueryAsync("Customer", whereClause: null);
        if (elements is null) return new List<QbCustomerDto>();

        var result = new List<QbCustomerDto>(elements.Count);
        foreach (var c in elements)
        {
            var id   = c.TryGetProperty("Id",          out var i) ? i.GetString() ?? "" : "";
            var name = c.TryGetProperty("DisplayName", out var n) ? n.GetString() ?? "" : "";
            if (id.Length == 0) continue;
            result.Add(new QbCustomerDto(id, name));
        }
        return result;
    }

    public async Task<string?> FindCustomerIdByNameAsync(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return null;

        var customers = await ListCustomersAsync();
        // Case-insensitive exact match first
        var exact = customers.FirstOrDefault(c =>
            string.Equals(c.DisplayName, name, StringComparison.OrdinalIgnoreCase));
        if (exact is not null) return exact.Id;

        // Fallback: trimmed case-insensitive match (handles trailing whitespace)
        var trimmed = customers.FirstOrDefault(c =>
            string.Equals(c.DisplayName.Trim(), name.Trim(), StringComparison.OrdinalIgnoreCase));
        return trimmed?.Id;
    }

    public async Task<List<QbSubCustomerDto>> ListSubCustomersAsync(string parentCustomerId)
    {
        if (string.IsNullOrWhiteSpace(parentCustomerId))
            return new List<QbSubCustomerDto>();

        // QB returns Job=true sub-customers as customers with ParentRef set to
        // the parent's id. We do not filter on Job here because some QB Online
        // companies use ParentRef without flagging Job; the safer query is just
        // by ParentRef.
        var elements = await RunQueryAsync(
            "Customer",
            whereClause: $"ParentRef = '{EscapeSql(parentCustomerId)}'");
        if (elements is null) return new List<QbSubCustomerDto>();

        // Look up the parent's display name once for the response.
        string parentName = "";
        var parentEl = await FetchSingleAsync("customer", parentCustomerId, "Customer");
        if (parentEl is not null
            && parentEl.Value.TryGetProperty("DisplayName", out var pdn))
        {
            parentName = pdn.GetString() ?? "";
        }

        var result = new List<QbSubCustomerDto>(elements.Count);
        foreach (var c in elements)
        {
            var id   = c.TryGetProperty("Id",          out var i) ? i.GetString() ?? "" : "";
            var name = c.TryGetProperty("DisplayName", out var n) ? n.GetString() ?? "" : "";
            if (id.Length == 0) continue;
            result.Add(new QbSubCustomerDto(id, name, parentCustomerId, parentName));
        }
        return result;
    }

    public async Task<string?> FindSubCustomerIdByNameAsync(string parentCustomerId, string name)
    {
        if (string.IsNullOrWhiteSpace(parentCustomerId) || string.IsNullOrWhiteSpace(name))
            return null;

        var subs = await ListSubCustomersAsync(parentCustomerId);

        // Case-insensitive exact match first.
        var exact = subs.FirstOrDefault(c =>
            string.Equals(c.DisplayName, name, StringComparison.OrdinalIgnoreCase));
        if (exact is not null) return exact.Id;

        // Some QB shops name their sub-customers as "Parent:Sub" — try matching
        // the segment after the last ':' in case the BOS project name is just
        // the leaf part.
        var leaf = subs.FirstOrDefault(c =>
        {
            var idx = c.DisplayName.LastIndexOf(':');
            var leafName = idx >= 0 ? c.DisplayName[(idx + 1)..].Trim() : c.DisplayName;
            return string.Equals(leafName, name.Trim(), StringComparison.OrdinalIgnoreCase);
        });
        return leaf?.Id;
    }

    public Task<List<QbDocumentDto>> GetEstimatesForCustomerAsync(string customerId)
        => GetDocumentsForCustomerAsync(customerId, "Estimate");

    public Task<List<QbDocumentDto>> GetInvoicesForCustomerAsync(string customerId)
        => GetDocumentsForCustomerAsync(customerId, "Invoice");

    public Task<List<QbDocumentDto>> GetEstimatesForCustomersAsync(IEnumerable<string> customerIds)
        => GetDocumentsForCustomersAsync(customerIds, "Estimate");

    public Task<List<QbDocumentDto>> GetInvoicesForCustomersAsync(IEnumerable<string> customerIds)
        => GetDocumentsForCustomersAsync(customerIds, "Invoice");

    public async Task<QbDocumentDto?> GetEstimateByIdAsync(string id)
    {
        var raw = await FetchSingleAsync("estimate", id, "Estimate");
        if (raw is null) return null;
        var parentName = await GetCustomerParentNameForDocAsync(raw.Value);
        return ParseDocument(raw.Value, "Estimate", parentName);
    }

    public async Task<QbDocumentDto?> GetInvoiceByIdAsync(string id)
    {
        var raw = await FetchSingleAsync("invoice", id, "Invoice");
        if (raw is null) return null;
        var parentName = await GetCustomerParentNameForDocAsync(raw.Value);
        return ParseDocument(raw.Value, "Invoice", parentName);
    }

    public async Task<QbDocumentDto> ConvertEstimateToInvoiceAsync(
        string estimateId, ConvertEstimateEdits? edits)
    {
        var auth = await GetAuthedClientAsync();
        if (auth is null)
            throw new InvalidOperationException("QuickBooks is not connected.");
        var (client, accessToken, realmId) = auth.Value;

        var rawEstimate = await FetchSingleAsync("estimate", estimateId, "Estimate");
        if (rawEstimate is null)
            throw new InvalidOperationException($"Estimate {estimateId} was not found in QuickBooks.");

        var parsed = ParseDocument(rawEstimate.Value, "Estimate");
        if (parsed.LinkedInvoiceId is not null)
            throw new InvalidOperationException(
                $"Estimate {estimateId} is already linked to invoice {parsed.LinkedInvoiceId} in QuickBooks.");

        var lines = edits?.Lines ?? parsed.Lines;
        if (lines.Count == 0)
            throw new InvalidOperationException("Cannot convert: the estimate has no line items.");
        foreach (var line in lines)
        {
            if (string.IsNullOrEmpty(line.ItemId))
                throw new InvalidOperationException(
                    $"Cannot convert: line '{line.Description}' is missing an ItemRef. " +
                    "All lines must reference a QuickBooks item.");
        }

        var payload = BuildInvoiceFromEstimate(rawEstimate.Value, parsed, lines, edits);

        var url = $"{ApiBase}/{realmId}/invoice?minorversion=65";
        var req = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json"),
        };
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        HttpResponseMessage resp;
        try
        {
            resp = await client.SendAsync(req);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "QuickBooks invoice creation failed (network error). EstimateId={EstimateId}",
                estimateId);
            throw;
        }

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            _logger.LogError(
                "QuickBooks invoice creation rejected. EstimateId={EstimateId} StatusCode={Code} Body={Body}",
                estimateId, (int)resp.StatusCode, body);
            throw new HttpRequestException($"QuickBooks rejected the invoice creation: {body}");
        }

        var respJson = await resp.Content.ReadAsStringAsync();
        using var respDoc = JsonDocument.Parse(respJson);
        if (!respDoc.RootElement.TryGetProperty("Invoice", out var invoiceEl))
        {
            _logger.LogError(
                "QuickBooks invoice creation response missing 'Invoice' property. Body={Body}",
                respJson);
            throw new InvalidOperationException(
                "QuickBooks invoice creation response was missing the Invoice element.");
        }

        var newInvoice = ParseDocument(invoiceEl, "Invoice");
        _logger.LogInformation(
            "Converted QB estimate to invoice. EstimateId={EstimateId} InvoiceId={InvoiceId} DocNumber={DocNumber}",
            estimateId, newInvoice.Id, newInvoice.DocNumber);
        return newInvoice;
    }

    // ── Estimate/Invoice helpers ──────────────────────────────────────────────

    private async Task<List<QbDocumentDto>> GetDocumentsForCustomerAsync(string customerId, string entityName)
    {
        if (string.IsNullOrWhiteSpace(customerId)) return new List<QbDocumentDto>();

        // CustomerRef value must be a numeric id; quote per QB SQL syntax.
        var elements = await RunQueryAsync(entityName, whereClause: $"CustomerRef = '{EscapeSql(customerId)}'");
        if (elements is null) return new List<QbDocumentDto>();

        // Every doc in this batch is assigned to the same customer, so look up
        // the parent name (if any) once and apply it to every parsed dto.
        var parentName = await GetCustomerParentNameAsync(customerId);

        var result = new List<QbDocumentDto>(elements.Count);
        foreach (var el in elements)
            result.Add(ParseDocument(el, entityName, parentName));
        return result;
    }

    /// Batch fetch — pulls documents whose CustomerRef matches any of the given
    /// customer IDs in a single QB query. Used by the client-level Estimates &
    /// Invoices tab, which scopes to the parent customer plus every sub-customer
    /// underneath it.
    private async Task<List<QbDocumentDto>> GetDocumentsForCustomersAsync(
        IEnumerable<string> customerIds, string entityName)
    {
        var ids = customerIds
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (ids.Count == 0) return new List<QbDocumentDto>();

        var quoted = string.Join(", ", ids.Select(id => $"'{EscapeSql(id)}'"));
        var elements = await RunQueryAsync(entityName, whereClause: $"CustomerRef IN ({quoted})");
        if (elements is null) return new List<QbDocumentDto>();

        // Pre-resolve each customer's parent display name once. For the typical
        // shape (one parent + N sub-customers), this is N+1 HTTP calls and is
        // amortized across every document parsed.
        var parentNameByCustomerId = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var id in ids)
            parentNameByCustomerId[id] = await GetCustomerParentNameAsync(id);

        var result = new List<QbDocumentDto>(elements.Count);
        foreach (var el in elements)
        {
            var customerRefValue = el.TryGetProperty("CustomerRef", out var cr)
                                && cr.TryGetProperty("value", out var cv)
                                ? cv.GetString() ?? ""
                                : "";
            parentNameByCustomerId.TryGetValue(customerRefValue, out var parentName);
            result.Add(ParseDocument(el, entityName, parentName));
        }
        return result;
    }

    /// Fetches the customer record for the given id and returns its parent's
    /// DisplayName if it has a ParentRef, otherwise null. Logs and returns null
    /// on any failure — parent name is purely informational.
    private async Task<string?> GetCustomerParentNameAsync(string customerId)
    {
        var customer = await FetchSingleAsync("customer", customerId, "Customer");
        if (customer is null) return null;

        if (!customer.Value.TryGetProperty("ParentRef", out var pr)) return null;
        var parentId = pr.TryGetProperty("value", out var pv) ? pv.GetString() : null;
        if (string.IsNullOrEmpty(parentId)) return null;

        var parent = await FetchSingleAsync("customer", parentId, "Customer");
        if (parent is null) return null;
        return parent.Value.TryGetProperty("DisplayName", out var dn) ? dn.GetString() : null;
    }

    /// Convenience: pulls CustomerRef.value off the document and looks up the
    /// parent's display name in one call.
    private async Task<string?> GetCustomerParentNameForDocAsync(JsonElement doc)
    {
        if (!doc.TryGetProperty("CustomerRef", out var cr)) return null;
        var customerId = cr.TryGetProperty("value", out var cv) ? cv.GetString() : null;
        return string.IsNullOrEmpty(customerId) ? null : await GetCustomerParentNameAsync(customerId);
    }

    /// Returns null if not connected, on error, or if the document is not found.
    private async Task<JsonElement?> FetchSingleAsync(string endpointSegment, string id, string entityName)
    {
        var auth = await GetAuthedClientAsync();
        if (auth is null) return null;
        var (client, accessToken, realmId) = auth.Value;

        var url = $"{ApiBase}/{realmId}/{endpointSegment}/{Uri.EscapeDataString(id)}?minorversion=65";

        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        HttpResponseMessage resp;
        try
        {
            resp = await client.SendAsync(req);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "QuickBooks {Entity} fetch failed (network error). Id={Id}", entityName, id);
            return null;
        }

        if (resp.StatusCode == System.Net.HttpStatusCode.NotFound) return null;
        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            _logger.LogError(
                "QuickBooks {Entity} fetch returned non-success. Id={Id} StatusCode={Code} Body={Body}",
                entityName, id, (int)resp.StatusCode, body);
            return null;
        }

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.TryGetProperty(entityName, out var el) ? el.Clone() : null;
    }

    /// Paginated SELECT against the QB Query endpoint. Returns null if not
    /// connected or on error (logged); otherwise the full list of result
    /// elements (may be empty).
    private async Task<List<JsonElement>?> RunQueryAsync(string entityName, string? whereClause)
    {
        var auth = await GetAuthedClientAsync();
        if (auth is null)
        {
            _logger.LogWarning("RunQuery({Entity}) called but no QuickBooks token is stored.", entityName);
            return null;
        }
        var (client, accessToken, realmId) = auth.Value;

        var all      = new List<JsonElement>();
        var pageSize = 1000;
        var startPos = 1;

        while (true)
        {
            var sql = string.IsNullOrEmpty(whereClause)
                ? $"SELECT * FROM {entityName} STARTPOSITION {startPos} MAXRESULTS {pageSize}"
                : $"SELECT * FROM {entityName} WHERE {whereClause} STARTPOSITION {startPos} MAXRESULTS {pageSize}";

            var url = $"{ApiBase}/{realmId}/query?query={Uri.EscapeDataString(sql)}&minorversion=65";

            var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            HttpResponseMessage resp;
            try
            {
                resp = await client.SendAsync(req);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "QuickBooks {Entity} query failed (network error). StartPosition={StartPos}",
                    entityName, startPos);
                return null;
            }

            if (!resp.IsSuccessStatusCode)
            {
                var body = await resp.Content.ReadAsStringAsync();
                _logger.LogError(
                    "QuickBooks {Entity} query returned non-success. StatusCode={Code} Body={Body}",
                    entityName, (int)resp.StatusCode, body);
                return null;
            }

            var json = await resp.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            if (!doc.RootElement.TryGetProperty("QueryResponse", out var qr))
            {
                _logger.LogError("QuickBooks {Entity} query response missing 'QueryResponse'.", entityName);
                return null;
            }

            if (!qr.TryGetProperty(entityName, out var arr) || arr.GetArrayLength() == 0)
                break;

            foreach (var item in arr.EnumerateArray())
                all.Add(item.Clone());

            if (arr.GetArrayLength() < pageSize) break;
            startPos += pageSize;
        }

        return all;
    }

    /// QB SQL uses single quotes for string literals — escape any embedded
    /// single quote by doubling. (Customer ids are numeric in practice but be safe.)
    private static string EscapeSql(string value) => value.Replace("'", "''");

    /// Returns (HttpClient, decryptedAccessToken, decryptedRealmId), or null
    /// when QuickBooks is not connected. Logs on token decryption failure.
    private async Task<(HttpClient client, string accessToken, string realmId)?> GetAuthedClientAsync()
    {
        var token = await GetValidTokenAsync();
        if (token is null) return null;

        string realmId, accessToken;
        try
        {
            realmId     = DecryptField(token.RealmId,     nameof(token.RealmId));
            accessToken = DecryptField(token.AccessToken, nameof(token.AccessToken));
        }
        catch
        {
            // DecryptField already logged the cause.
            return null;
        }

        return (_httpFactory.CreateClient(), accessToken, realmId);
    }

    /// Parses a single QB Estimate or Invoice JSON element into a QbDocumentDto.
    /// LinkSource is left empty — controllers populate it after consulting the
    /// custom-field configuration and explicit link tables. customerParentName
    /// is supplied by the caller (looked up from QB Customer.ParentRef) and is
    /// non-null only when the document's CustomerRef points at a sub-customer.
    private static QbDocumentDto ParseDocument(
        JsonElement doc, string docType, string? customerParentName = null)
    {
        var id        = doc.TryGetProperty("Id",        out var i)  ? i.GetString()  ?? "" : "";
        var docNumber = doc.TryGetProperty("DocNumber", out var dn) ? dn.GetString()        : null;
        var txnDate   = doc.TryGetProperty("TxnDate",   out var td) ? td.GetString() ?? "" : "";
        var dueDate   = doc.TryGetProperty("DueDate",   out var dd) ? dd.GetString()        : null;
        var totalAmt  = doc.TryGetProperty("TotalAmt",  out var ta) ? ta.GetDecimal()       : 0m;
        var balance   = doc.TryGetProperty("Balance",   out var b)  ? b.GetDecimal()        : 0m;

        var customerId   = "";
        var customerName = "";
        if (doc.TryGetProperty("CustomerRef", out var cr))
        {
            customerId   = cr.TryGetProperty("value", out var cv) ? cv.GetString() ?? "" : "";
            customerName = cr.TryGetProperty("name",  out var cn) ? cn.GetString() ?? "" : "";
        }

        var privateNote = doc.TryGetProperty("PrivateNote", out var pn) ? pn.GetString() : null;

        string? customerMemo = null;
        if (doc.TryGetProperty("CustomerMemo", out var cm) && cm.TryGetProperty("value", out var cmv))
            customerMemo = cmv.GetString();

        // Lines — only emit SalesItemLineDetail (skip subtotals, descriptions, group lines)
        var lines = new List<QbLineDto>();
        if (doc.TryGetProperty("Line", out var lineArr))
        {
            foreach (var line in lineArr.EnumerateArray())
            {
                var detailType = line.TryGetProperty("DetailType", out var dt) ? dt.GetString() : null;
                if (detailType != "SalesItemLineDetail") continue;

                int? lineNum = line.TryGetProperty("LineNum", out var ln) && ln.ValueKind == JsonValueKind.Number
                    ? ln.GetInt32()
                    : (int?)null;
                var desc   = line.TryGetProperty("Description", out var de) ? de.GetString() ?? "" : "";
                var amount = line.TryGetProperty("Amount",      out var am) ? am.GetDecimal()      : 0m;

                decimal qty      = 0m;
                decimal rate     = 0m;
                string? itemId   = null;
                string? itemName = null;
                if (line.TryGetProperty("SalesItemLineDetail", out var sid))
                {
                    qty  = sid.TryGetProperty("Qty",       out var q)  ? q.GetDecimal()  : 0m;
                    rate = sid.TryGetProperty("UnitPrice", out var up) ? up.GetDecimal() : 0m;
                    if (sid.TryGetProperty("ItemRef", out var ir))
                    {
                        itemId   = ir.TryGetProperty("value", out var iv)  ? iv.GetString()  : null;
                        itemName = ir.TryGetProperty("name",  out var inn) ? inn.GetString() : null;
                    }
                }

                lines.Add(new QbLineDto(lineNum, desc, qty, rate, amount, itemId, itemName));
            }
        }

        // Custom fields
        var customFields = new List<QbCustomFieldDto>();
        if (doc.TryGetProperty("CustomField", out var cfArr))
        {
            foreach (var cf in cfArr.EnumerateArray())
            {
                var name  = cf.TryGetProperty("Name",        out var n)  ? n.GetString() ?? "" : "";
                var value = cf.TryGetProperty("StringValue", out var sv) ? sv.GetString()       : null;
                customFields.Add(new QbCustomFieldDto(name, value));
            }
        }

        // Linked transactions (estimate ↔ invoice)
        string? linkedInvoiceId      = null;
        string? linkedFromEstimateId = null;
        if (doc.TryGetProperty("LinkedTxn", out var ltArr))
        {
            foreach (var lt in ltArr.EnumerateArray())
            {
                var ttype = lt.TryGetProperty("TxnType", out var tt) ? tt.GetString() : null;
                var tid   = lt.TryGetProperty("TxnId",   out var ti) ? ti.GetString() : null;
                if (docType == "Estimate" && ttype == "Invoice"  && tid is not null) linkedInvoiceId      = tid;
                if (docType == "Invoice"  && ttype == "Estimate" && tid is not null) linkedFromEstimateId = tid;
            }
        }

        // Status
        string status;
        if (docType == "Estimate")
        {
            status = doc.TryGetProperty("TxnStatus", out var ts) ? ts.GetString() ?? "Pending" : "Pending";
        }
        else
        {
            if (balance == 0m)
            {
                status = "Paid";
            }
            else if (!string.IsNullOrEmpty(dueDate)
                  && DateTime.TryParse(dueDate, out var ddt)
                  && ddt.Date < DateTime.UtcNow.Date)
            {
                status = "Overdue";
            }
            else
            {
                status = "Unpaid";
            }
        }

        return new QbDocumentDto(
            Id:                   id,
            DocType:              docType,
            DocNumber:            docNumber,
            TxnDate:              txnDate,
            DueDate:              dueDate,
            TotalAmt:             totalAmt,
            Balance:              balance,
            Status:               status,
            CustomerId:           customerId,
            CustomerName:         customerName,
            CustomerParentName:   customerParentName,
            PrivateNote:          privateNote,
            CustomerMemo:         customerMemo,
            Lines:                lines,
            CustomFields:         customFields,
            LinkedInvoiceId:      linkedInvoiceId,
            LinkedFromEstimateId: linkedFromEstimateId);
    }

    /// Builds the JSON payload to POST to /v3/company/{realmId}/invoice.
    /// Carries CustomField forward from the source estimate so Approach A
    /// (BOS Project ID custom-field linkage) keeps working on the new invoice.
    private static JsonObject BuildInvoiceFromEstimate(
        JsonElement          rawEstimate,
        QbDocumentDto        parsed,
        List<QbLineDto>      lines,
        ConvertEstimateEdits? edits)
    {
        var payload = new JsonObject
        {
            ["CustomerRef"] = new JsonObject
            {
                ["value"] = parsed.CustomerId,
                ["name"]  = parsed.CustomerName,
            },
            ["TxnDate"]   = edits?.TxnDate ?? DateTime.UtcNow.ToString("yyyy-MM-dd"),
            ["DueDate"]   = edits?.DueDate ?? DateTime.UtcNow.AddDays(30).ToString("yyyy-MM-dd"),
            ["LinkedTxn"] = new JsonArray(new JsonObject
            {
                ["TxnId"]   = parsed.Id,
                ["TxnType"] = "Estimate",
            }),
        };

        var lineArr = new JsonArray();
        var idx = 1;
        foreach (var line in lines)
        {
            lineArr.Add(new JsonObject
            {
                ["LineNum"]     = line.LineNum ?? idx,
                ["Description"] = line.Description,
                ["Amount"]      = line.Amount,
                ["DetailType"]  = "SalesItemLineDetail",
                ["SalesItemLineDetail"] = new JsonObject
                {
                    ["ItemRef"] = new JsonObject
                    {
                        ["value"] = line.ItemId,
                        ["name"]  = line.ItemName ?? "",
                    },
                    ["Qty"]       = line.Qty,
                    ["UnitPrice"] = line.Rate,
                },
            });
            idx++;
        }
        payload["Line"] = lineArr;

        var customerMemo = edits?.CustomerMemo ?? parsed.CustomerMemo;
        if (!string.IsNullOrEmpty(customerMemo))
            payload["CustomerMemo"] = new JsonObject { ["value"] = customerMemo };

        // Verbatim copies — only when present on the estimate. CustomField is
        // load-bearing for Approach A continuity; the address/term/class refs
        // are best-effort to preserve sales-form behavior the user already
        // configured at the customer level.
        CopyJsonProperty(rawEstimate, payload, "BillEmail");
        CopyJsonProperty(rawEstimate, payload, "BillAddr");
        CopyJsonProperty(rawEstimate, payload, "ShipAddr");
        CopyJsonProperty(rawEstimate, payload, "CurrencyRef");
        CopyJsonProperty(rawEstimate, payload, "ExchangeRate");
        CopyJsonProperty(rawEstimate, payload, "SalesTermRef");
        CopyJsonProperty(rawEstimate, payload, "ClassRef");
        CopyJsonProperty(rawEstimate, payload, "DepartmentRef");
        CopyJsonProperty(rawEstimate, payload, "CustomField");

        return payload;
    }

    private static void CopyJsonProperty(JsonElement source, JsonObject dest, string propertyName)
    {
        if (source.TryGetProperty(propertyName, out var value) && value.ValueKind != JsonValueKind.Null)
            dest[propertyName] = JsonNode.Parse(value.GetRawText());
    }

    // ── Disconnect ────────────────────────────────────────────────────────────

    public async Task DisconnectAsync()
    {
        var token = await _db.QuickBooksTokens.FirstOrDefaultAsync();
        if (token is not null)
        {
            _db.QuickBooksTokens.Remove(token);
            await _db.SaveChangesAsync();
            _logger.LogInformation("QuickBooks disconnected. Token row removed.");
        }
        else
        {
            _logger.LogInformation("QuickBooks disconnect called but no token row existed.");
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Returns a token with decrypted fields, refreshing it first if near expiry.
    /// Returns null if no token row exists.
    private async Task<QuickBooksToken?> GetValidTokenAsync()
    {
        var token = await _db.QuickBooksTokens.FirstOrDefaultAsync();
        if (token is null) return null;

        if (token.ExpiresAt <= DateTime.UtcNow.AddMinutes(5))
        {
            _logger.LogInformation(
                "QuickBooks access token is expiring at {ExpiresAt:u}. Refreshing.",
                token.ExpiresAt);

            string decryptedRefresh;
            try
            {
                decryptedRefresh = DecryptField(token.RefreshToken, nameof(token.RefreshToken));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to decrypt refresh token before token refresh. " +
                    "If you recently enabled encryption, disconnect and reconnect QuickBooks.");
                return null;
            }

            TokenResponse refreshed;
            try
            {
                refreshed = await CallTokenEndpointAsync(new Dictionary<string, string>
                {
                    ["grant_type"]    = "refresh_token",
                    ["refresh_token"] = decryptedRefresh,
                }, isRefresh: true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "QuickBooks token refresh failed. The refresh token may be expired. " +
                    "Disconnect and reconnect QuickBooks from Settings.");
                return null;
            }

            token.AccessToken  = EncryptField(refreshed.AccessToken);
            token.RefreshToken = refreshed.RefreshToken is not null
                ? EncryptField(refreshed.RefreshToken)
                : token.RefreshToken;
            token.ExpiresAt    = refreshed.ExpiresAt;
            token.UpdatedAt    = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "QuickBooks token refreshed successfully. NewExpiresAt={ExpiresAt:u}",
                refreshed.ExpiresAt);
        }

        return token;
    }

    private record TokenResponse(string AccessToken, string? RefreshToken, DateTime ExpiresAt);

    private async Task<TokenResponse> CallTokenEndpointAsync(
        Dictionary<string, string> form, bool isRefresh)
    {
        var clientId     = _config["QuickBooks:ClientId"]     ?? "";
        var clientSecret = _config["QuickBooks:ClientSecret"] ?? "";
        var credentials  = Convert.ToBase64String(
            Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));

        var client  = _httpFactory.CreateClient();
        var content = new FormUrlEncodedContent(form);

        var req = new HttpRequestMessage(HttpMethod.Post, TokenEndpoint) { Content = content };
        req.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        HttpResponseMessage resp;
        try
        {
            resp = await client.SendAsync(req);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "QuickBooks token endpoint request failed (network error). IsRefresh={IsRefresh}",
                isRefresh);
            throw;
        }

        if (!resp.IsSuccessStatusCode)
        {
            var body = await resp.Content.ReadAsStringAsync();
            _logger.LogError(
                "QuickBooks token endpoint returned non-success status. " +
                "IsRefresh={IsRefresh} StatusCode={StatusCode} Response={Response}",
                isRefresh, (int)resp.StatusCode, body);
            resp.EnsureSuccessStatusCode(); // rethrow as HttpRequestException
        }

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var accessToken  = root.GetProperty("access_token").GetString()!;
        var refreshToken = root.TryGetProperty("refresh_token", out var rt) ? rt.GetString() : null;
        var expiresIn    = root.TryGetProperty("expires_in", out var ei) ? ei.GetInt32() : 3600;
        var expiresAt    = DateTime.UtcNow.AddSeconds(expiresIn);

        return new TokenResponse(accessToken, refreshToken, expiresAt);
    }

    private async Task UpsertTokenAsync(TokenResponse tokens, string realmId)
    {
        var encryptedAccess  = EncryptField(tokens.AccessToken);
        var encryptedRefresh = tokens.RefreshToken is not null
            ? EncryptField(tokens.RefreshToken)
            : null;
        var encryptedRealm   = EncryptField(realmId);

        var existing = await _db.QuickBooksTokens.FirstOrDefaultAsync();
        var now      = DateTime.UtcNow;

        if (existing is not null)
        {
            existing.AccessToken  = encryptedAccess;
            existing.RefreshToken = encryptedRefresh ?? existing.RefreshToken;
            existing.RealmId      = encryptedRealm;
            existing.ExpiresAt    = tokens.ExpiresAt;
            existing.UpdatedAt    = now;
        }
        else
        {
            _db.QuickBooksTokens.Add(new QuickBooksToken
            {
                AccessToken  = encryptedAccess,
                RefreshToken = encryptedRefresh ?? string.Empty,
                RealmId      = encryptedRealm,
                ExpiresAt    = tokens.ExpiresAt,
                CreatedAt    = now,
                UpdatedAt    = now,
            });
        }

        await _db.SaveChangesAsync();
    }

    // ── Encryption helpers ────────────────────────────────────────────────────

    /// Encrypts a plaintext string using AES-256-GCM.
    /// Stored format (base64): [ 12-byte nonce | 16-byte tag | ciphertext ]
    private string EncryptField(string plaintext)
    {
        var key       = EncryptionKey;
        var nonce     = RandomNumberGenerator.GetBytes(NonceSize);
        var tag       = new byte[TagSize];
        var input     = Encoding.UTF8.GetBytes(plaintext);
        var ciphertext = new byte[input.Length];

        using var aes = new AesGcm(key, TagSize);
        aes.Encrypt(nonce, input, ciphertext, tag);

        // Concatenate nonce + tag + ciphertext into one base64 blob
        var blob = new byte[NonceSize + TagSize + ciphertext.Length];
        Buffer.BlockCopy(nonce,      0, blob, 0,                      NonceSize);
        Buffer.BlockCopy(tag,        0, blob, NonceSize,              TagSize);
        Buffer.BlockCopy(ciphertext, 0, blob, NonceSize + TagSize,    ciphertext.Length);

        return Convert.ToBase64String(blob);
    }

    /// Decrypts a base64 blob produced by EncryptField.
    /// Throws if the blob is malformed or the auth tag does not verify.
    private string DecryptField(string base64Blob, string fieldName)
    {
        try
        {
            var blob       = Convert.FromBase64String(base64Blob);
            var nonce      = blob[..NonceSize];
            var tag        = blob[NonceSize..(NonceSize + TagSize)];
            var ciphertext = blob[(NonceSize + TagSize)..];
            var plaintext  = new byte[ciphertext.Length];

            using var aes = new AesGcm(EncryptionKey, TagSize);
            aes.Decrypt(nonce, ciphertext, tag, plaintext);

            return Encoding.UTF8.GetString(plaintext);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to decrypt QuickBooks token field '{FieldName}'. " +
                "The encryption key may have changed, or the stored value is not encrypted. " +
                "Disconnect and reconnect QuickBooks from Settings to re-encrypt with the current key.",
                fieldName);
            throw;
        }
    }
}
