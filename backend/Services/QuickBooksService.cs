using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Web;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IQuickBooksService
{
    Task<bool>   IsConnectedAsync();
    string       GetAuthorizationUrl(string state);
    Task         ExchangeCodeAsync(string code, string realmId);
    Task<string> GetPoStatusAsync(string orderNumber);   // "Open" | "Closed" | "Unknown"
    Task         DisconnectAsync();
}

public class QuickBooksService : IQuickBooksService
{
    private const string TokenEndpoint = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
    private const string AuthBase      = "https://appcenter.intuit.com/connect/oauth2";
    private const string ApiBase       = "https://quickbooks.api.intuit.com/v3/company";
    private const string Scope         = "com.intuit.quickbooks.accounting";

    private readonly AppDbContext   _db;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;

    public QuickBooksService(AppDbContext db, IHttpClientFactory httpFactory, IConfiguration config)
    {
        _db          = db;
        _httpFactory = httpFactory;
        _config      = config;
    }

    // ── Connection state ──────────────────────────────────────────────────────

    public async Task<bool> IsConnectedAsync()
        => await _db.QuickBooksTokens.AnyAsync();

    // ── OAuth authorization URL ───────────────────────────────────────────────

    public string GetAuthorizationUrl(string state)
    {
        var clientId     = _config["QuickBooks:ClientId"] ?? "";
        var redirectUri  = _config["QuickBooks:RedirectUri"] ?? "";

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
        var tokens = await CallTokenEndpointAsync(new Dictionary<string, string>
        {
            ["grant_type"]   = "authorization_code",
            ["code"]         = code,
            ["redirect_uri"] = _config["QuickBooks:RedirectUri"] ?? "",
        });

        await UpsertTokenAsync(tokens, realmId);
    }

    // ── PO status sync ────────────────────────────────────────────────────────

    public async Task<string> GetPoStatusAsync(string orderNumber)
    {
        var token = await GetValidTokenAsync();
        if (token is null) return "Unknown";

        var client = _httpFactory.CreateClient();
        var query  = Uri.EscapeDataString($"SELECT * FROM PurchaseOrder WHERE DocNumber = '{orderNumber}'");
        var url    = $"{ApiBase}/{token.RealmId}/query?query={query}&minorversion=65";

        var req = new HttpRequestMessage(HttpMethod.Get, url);
        req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        var resp = await client.SendAsync(req);
        if (!resp.IsSuccessStatusCode) return "Unknown";

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);

        // QB response: QueryResponse.PurchaseOrder[0].POStatus
        if (!doc.RootElement.TryGetProperty("QueryResponse", out var qr)) return "Unknown";
        if (!qr.TryGetProperty("PurchaseOrder", out var poArr))           return "Unknown";
        if (poArr.GetArrayLength() == 0)                                   return "Unknown";

        var po = poArr[0];
        if (po.TryGetProperty("POStatus", out var statusProp))
        {
            var raw = statusProp.GetString() ?? "";
            return raw.Equals("Closed", StringComparison.OrdinalIgnoreCase) ? "Closed" : "Open";
        }

        return "Unknown";
    }

    // ── Disconnect ────────────────────────────────────────────────────────────

    public async Task DisconnectAsync()
    {
        var token = await _db.QuickBooksTokens.FirstOrDefaultAsync();
        if (token is not null)
        {
            _db.QuickBooksTokens.Remove(token);
            await _db.SaveChangesAsync();
        }
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    /// Returns a token that is guaranteed to be valid (refreshed if near expiry).
    /// Returns null if no token row exists.
    private async Task<QuickBooksToken?> GetValidTokenAsync()
    {
        var token = await _db.QuickBooksTokens.FirstOrDefaultAsync();
        if (token is null) return null;

        // Refresh proactively if token expires within the next 5 minutes
        if (token.ExpiresAt <= DateTime.UtcNow.AddMinutes(5))
        {
            var refreshed = await CallTokenEndpointAsync(new Dictionary<string, string>
            {
                ["grant_type"]    = "refresh_token",
                ["refresh_token"] = token.RefreshToken,
            });

            token.AccessToken  = refreshed.AccessToken;
            token.RefreshToken = refreshed.RefreshToken ?? token.RefreshToken;
            token.ExpiresAt    = refreshed.ExpiresAt;
            token.UpdatedAt    = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return token;
    }

    private record TokenResponse(string AccessToken, string? RefreshToken, DateTime ExpiresAt);

    private async Task<TokenResponse> CallTokenEndpointAsync(Dictionary<string, string> form)
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

        var resp = await client.SendAsync(req);
        resp.EnsureSuccessStatusCode();

        var json = await resp.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        var accessToken  = root.GetProperty("access_token").GetString()!;
        var refreshToken = root.TryGetProperty("refresh_token", out var rt)
            ? rt.GetString() : null;
        var expiresIn    = root.TryGetProperty("expires_in", out var ei)
            ? ei.GetInt32() : 3600;
        var expiresAt    = DateTime.UtcNow.AddSeconds(expiresIn);

        return new TokenResponse(accessToken, refreshToken, expiresAt);
    }

    private async Task UpsertTokenAsync(TokenResponse tokens, string realmId)
    {
        var existing = await _db.QuickBooksTokens.FirstOrDefaultAsync();
        var now      = DateTime.UtcNow;

        if (existing is not null)
        {
            existing.AccessToken  = tokens.AccessToken;
            existing.RefreshToken = tokens.RefreshToken ?? existing.RefreshToken;
            existing.RealmId      = realmId;
            existing.ExpiresAt    = tokens.ExpiresAt;
            existing.UpdatedAt    = now;
        }
        else
        {
            _db.QuickBooksTokens.Add(new QuickBooksToken
            {
                AccessToken  = tokens.AccessToken,
                RefreshToken = tokens.RefreshToken ?? string.Empty,
                RealmId      = realmId,
                ExpiresAt    = tokens.ExpiresAt,
                CreatedAt    = now,
                UpdatedAt    = now,
            });
        }

        await _db.SaveChangesAsync();
    }
}
