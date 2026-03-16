using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Web;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using BOS.Backend.Data;
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
