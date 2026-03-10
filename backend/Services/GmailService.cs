using System.Text.Json;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Services;
using Google.Apis.Util;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;

// Alias to avoid conflict with this class named GmailService
using GmailApiClient = Google.Apis.Gmail.v1.GmailService;
using MessagesResource = Google.Apis.Gmail.v1.UsersResource.MessagesResource;

namespace BOS.Backend.Services;

public interface IGmailService
{
    Task<bool>                    HasValidTokenAsync(string userEmail);
    Task<EmailListResponse>       ListEmailsAsync(string userEmail, string? pageToken = null, string? query = null, int maxResults = 25);
    Task<EmailDetailDto>          GetEmailAsync(string userEmail, string messageId);
    Task<IReadOnlyList<string>>   GetForwardingAddressesAsync(string userEmail);
    Task<IReadOnlyList<EmailSummaryDto>> GetEmailsByIdsAsync(string userEmail, IEnumerable<string> messageIds);
}

public class GmailService : IGmailService
{
    private readonly AppDbContext        _db;
    private readonly IConfiguration     _config;
    private readonly IHttpClientFactory  _httpClientFactory;
    private readonly ILogger<GmailService> _logger;

    public GmailService(AppDbContext db, IConfiguration config, IHttpClientFactory httpClientFactory, ILogger<GmailService> logger)
    {
        _db                = db;
        _config            = config;
        _httpClientFactory = httpClientFactory;
        _logger            = logger;
    }

    // ── Public interface ──────────────────────────────────────────────────────

    public async Task<bool> HasValidTokenAsync(string userEmail)
    {
        return await _db.UserGoogleTokens
            .AnyAsync(t => t.UserEmail == userEmail);
    }

    public async Task<EmailListResponse> ListEmailsAsync(
        string userEmail, string? pageToken = null, string? query = null, int maxResults = 25)
    {
        var accessToken = await GetValidAccessTokenAsync(userEmail);
        var service     = CreateApiClient(accessToken);

        var listReq        = service.Users.Messages.List("me");
        listReq.Q          = string.IsNullOrEmpty(query)
            ? "in:inbox OR in:sent"
            : $"({query}) -in:draft";
        listReq.MaxResults = Math.Clamp(maxResults, 1, 100);
        listReq.PageToken  = pageToken;

        var listResp = await listReq.ExecuteAsync();

        if (listResp.Messages == null || listResp.Messages.Count == 0)
            return new EmailListResponse([], null, 0);

        // Fetch metadata for all messages in parallel
        var metaTasks = listResp.Messages.Select(m => FetchMetadataAsync(service, m.Id));
        var metas     = await Task.WhenAll(metaTasks);

        var summaries = new List<EmailSummaryDto>();
        foreach (var meta in metas)
        {
            if (meta == null) continue;
            var (clientId, clientName, contactId, contactName) =
                await MatchToClientAsync(meta.From, meta.To, meta.Cc);

            summaries.Add(new EmailSummaryDto(
                meta.MessageId, meta.ThreadId,
                meta.Subject,   meta.Snippet,
                meta.FromAddress, meta.FromName, meta.To,
                meta.ReceivedAt, meta.IsRead,
                clientId, clientName, contactId, contactName));
        }

        return new EmailListResponse(
            summaries,
            listResp.NextPageToken,
            (int)(listResp.ResultSizeEstimate ?? 0));
    }

    public async Task<EmailDetailDto> GetEmailAsync(string userEmail, string messageId)
    {
        var accessToken = await GetValidAccessTokenAsync(userEmail);
        var service     = CreateApiClient(accessToken);

        var req    = service.Users.Messages.Get("me", messageId);
        req.Format = MessagesResource.GetRequest.FormatEnum.Full;
        var msg    = await req.ExecuteAsync();

        var headers  = msg.Payload.Headers
            .GroupBy(h => h.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase);
        var from     = headers.GetValueOrDefault("From",    "");
        var to       = headers.GetValueOrDefault("To",      "");
        var cc       = headers.GetValueOrDefault("Cc");
        var subject  = headers.GetValueOrDefault("Subject", "(No Subject)");
        var dateStr  = headers.GetValueOrDefault("Date",    "");
        var isRead   = msg.LabelIds == null || !msg.LabelIds.Contains("UNREAD");

        var (bodyText, bodyHtml)                             = ExtractBody(msg.Payload);
        var (fromAddress, fromName)                          = ParseEmailAddress(from);
        var (clientId, clientName, contactId, contactName)  = await MatchToClientAsync(from, to, cc);

        return new EmailDetailDto(
            messageId, msg.ThreadId ?? "",
            subject,
            fromAddress, fromName, to, cc,
            ParseDate(dateStr), isRead,
            bodyText, bodyHtml,
            clientId, clientName, contactId, contactName);
    }

    public async Task<IReadOnlyList<string>> GetForwardingAddressesAsync(string userEmail)
    {
        var keyPath    = _config["Google:ServiceAccountKeyPath"];
        var adminEmail = _config["Google:ServiceAccountAdminEmail"];

        if (string.IsNullOrWhiteSpace(keyPath) || !File.Exists(keyPath))
        {
            _logger.LogWarning("Aliases: service account key not configured or file not found at '{Path}'.", keyPath);
            return [];
        }
        if (string.IsNullOrWhiteSpace(adminEmail))
        {
            _logger.LogWarning("Aliases: Google:ServiceAccountAdminEmail is not configured.");
            return [];
        }

        try
        {
#pragma warning disable CS0618 // FromFile is deprecated in favour of CredentialFactory, but safe here
            // because keyPath is sourced exclusively from server configuration, never from user input.
            // The Directory API requires admin-level access, so we impersonate the configured
            // admin account rather than the logged-in user.
            var credential = GoogleCredential
                .FromFile(keyPath)
                .CreateScoped(
                    "https://www.googleapis.com/auth/admin.directory.group.readonly",
                    "https://www.googleapis.com/auth/admin.directory.user.alias.readonly")
                .CreateWithUser(adminEmail);
#pragma warning restore CS0618

            // UnderlyingCredential is a ServiceAccountCredential when loaded from a key file
            if (credential.UnderlyingCredential is not ServiceAccountCredential saCred)
            {
                _logger.LogWarning("Aliases: credential is not a ServiceAccountCredential.");
                return [];
            }

            var accessToken = await saCred.GetAccessTokenForRequestAsync();
            var http        = _httpClientFactory.CreateClient();
            var results     = new List<string>();

            // Fetch group addresses the user belongs to
            using var groupReq = new HttpRequestMessage(
                HttpMethod.Get,
                $"https://admin.googleapis.com/admin/directory/v1/groups?userKey={Uri.EscapeDataString(userEmail)}");
            groupReq.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var groupResp = await http.SendAsync(groupReq);
            if (groupResp.IsSuccessStatusCode)
            {
                using var json = JsonDocument.Parse(await groupResp.Content.ReadAsStringAsync());
                if (json.RootElement.TryGetProperty("groups", out var groupsEl))
                    results.AddRange(groupsEl.EnumerateArray()
                        .Select(g => g.TryGetProperty("email", out var v) ? v.GetString() : null)
                        .Where(e => !string.IsNullOrWhiteSpace(e))!);
                _logger.LogInformation("Aliases: groups call succeeded, found {Count} groups for {User}.", results.Count, userEmail);
            }
            else
            {
                var body = await groupResp.Content.ReadAsStringAsync();
                _logger.LogWarning("Aliases: groups call failed {Status} for {User}. Response: {Body}", (int)groupResp.StatusCode, userEmail, body);
            }

            // Fetch user-level aliases
            using var aliasReq = new HttpRequestMessage(
                HttpMethod.Get,
                $"https://admin.googleapis.com/admin/directory/v1/users/{Uri.EscapeDataString(userEmail)}/aliases");
            aliasReq.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var aliasResp   = await http.SendAsync(aliasReq);
            var beforeCount = results.Count;
            if (aliasResp.IsSuccessStatusCode)
            {
                using var json = JsonDocument.Parse(await aliasResp.Content.ReadAsStringAsync());
                if (json.RootElement.TryGetProperty("aliases", out var aliasesEl))
                    results.AddRange(aliasesEl.EnumerateArray()
                        .Select(a => a.TryGetProperty("alias", out var v) ? v.GetString() : null)
                        .Where(a => !string.IsNullOrWhiteSpace(a))!);
                _logger.LogInformation("Aliases: alias call succeeded, found {Count} aliases for {User}.", results.Count - beforeCount, userEmail);
            }
            else
            {
                var body = await aliasResp.Content.ReadAsStringAsync();
                _logger.LogWarning("Aliases: alias call failed {Status} for {User}. Response: {Body}", (int)aliasResp.StatusCode, userEmail, body);
            }

            return results.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Aliases: unexpected error for {User}.", userEmail);
            return [];
        }
    }

    public async Task<IReadOnlyList<EmailSummaryDto>> GetEmailsByIdsAsync(
        string userEmail, IEnumerable<string> messageIds)
    {
        var ids         = messageIds.ToList();
        if (ids.Count == 0) return [];

        var accessToken = await GetValidAccessTokenAsync(userEmail);
        var service     = CreateApiClient(accessToken);

        var metaTasks = ids.Select(id => FetchMetadataAsync(service, id));
        var metas     = await Task.WhenAll(metaTasks);

        var summaries = new List<EmailSummaryDto>();
        foreach (var meta in metas)
        {
            if (meta == null) continue;
            var (clientId, clientName, contactId, contactName) =
                await MatchToClientAsync(meta.From, meta.To, meta.Cc);

            summaries.Add(new EmailSummaryDto(
                meta.MessageId, meta.ThreadId,
                meta.Subject,   meta.Snippet,
                meta.FromAddress, meta.FromName, meta.To,
                meta.ReceivedAt, meta.IsRead,
                clientId, clientName, contactId, contactName));
        }

        return summaries;
    }

    // ── Token management ──────────────────────────────────────────────────────

    private async Task<string> GetValidAccessTokenAsync(string userEmail)
    {
        var token = await _db.UserGoogleTokens
            .FirstOrDefaultAsync(t => t.UserEmail == userEmail)
            ?? throw new InvalidOperationException(
                $"No Google token found for user: {userEmail}. " +
                "Please sign out and sign in again to grant Gmail access.");

        // Refresh if token expires within the next 5 minutes
        if (token.TokenExpiry <= DateTime.UtcNow.AddMinutes(5))
        {
            var clientId     = _config["Google:ClientId"]!;
            var clientSecret = _config["Google:ClientSecret"]!;

            var http = _httpClientFactory.CreateClient();
            var resp = await http.PostAsync(
                "https://oauth2.googleapis.com/token",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["grant_type"]    = "refresh_token",
                    ["refresh_token"] = token.RefreshToken,
                    ["client_id"]     = clientId,
                    ["client_secret"] = clientSecret,
                }));

            resp.EnsureSuccessStatusCode();

            using var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
            token.AccessToken = json.RootElement.GetProperty("access_token").GetString()!;
            token.TokenExpiry = DateTime.UtcNow.AddSeconds(
                json.RootElement.GetProperty("expires_in").GetInt32());
            token.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
        }

        return token.AccessToken;
    }

    // ── Gmail API client factory ──────────────────────────────────────────────

    private static GmailApiClient CreateApiClient(string accessToken)
    {
        var credential = GoogleCredential.FromAccessToken(accessToken);
        return new GmailApiClient(new BaseClientService.Initializer
        {
            HttpClientInitializer = credential,
            ApplicationName       = "BOS",
        });
    }

    // ── Metadata fetch (used for list view) ──────────────────────────────────

    private sealed record MessageMeta(
        string   MessageId,
        string   ThreadId,
        string   Subject,
        string   Snippet,
        string   From,
        string   To,
        string?  Cc,
        string   FromAddress,
        string   FromName,
        DateTime ReceivedAt,
        bool     IsRead);

    private static async Task<MessageMeta?> FetchMetadataAsync(
        GmailApiClient service, string messageId)
    {
        try
        {
            var req    = service.Users.Messages.Get("me", messageId);
            req.Format = MessagesResource.GetRequest.FormatEnum.Metadata;
            req.MetadataHeaders = new Repeatable<string>(
                ["From", "To", "Cc", "Subject", "Date"]);

            var msg = await req.ExecuteAsync();

            var headers  = msg.Payload.Headers
                .GroupBy(h => h.Name, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase);
            var from     = headers.GetValueOrDefault("From",    "");
            var to       = headers.GetValueOrDefault("To",      "");
            var cc       = headers.GetValueOrDefault("Cc");
            var subject  = headers.GetValueOrDefault("Subject", "(No Subject)");
            var dateStr  = headers.GetValueOrDefault("Date",    "");
            var isRead   = msg.LabelIds == null || !msg.LabelIds.Contains("UNREAD");

            var (fromAddress, fromName) = ParseEmailAddress(from);

            return new MessageMeta(
                messageId, msg.ThreadId ?? "",
                subject, msg.Snippet ?? "",
                from, to, cc,
                fromAddress, fromName,
                ParseDate(dateStr), isRead);
        }
        catch
        {
            return null;
        }
    }

    // ── Client / contact matching ─────────────────────────────────────────────

    private async Task<(int? clientId, string? clientName, int? contactId, string? contactName)>
        MatchToClientAsync(string from, string to, string? cc)
    {
        var addresses = new List<string>();
        foreach (var field in new[] { from, to, cc })
        {
            if (string.IsNullOrWhiteSpace(field)) continue;
            addresses.AddRange(
                field.Split(',')
                     .Select(a => ParseEmailAddress(a.Trim()).address)
                     .Where(a => !string.IsNullOrEmpty(a)));
        }

        var lowerAddresses = addresses
            .Select(a => a.ToLowerInvariant())
            .Distinct()
            .ToList();

        // 1. Exact contact email match
        var contact = await _db.Contacts
            .Where(c => lowerAddresses.Contains(c.Email.ToLower()))
            .Select(c => new { c.Id, c.Name, c.ClientId })
            .FirstOrDefaultAsync();

        if (contact != null)
        {
            var client = await _db.Clients
                .Where(c => c.Id == contact.ClientId)
                .Select(c => new { c.Id, c.Name })
                .FirstOrDefaultAsync();
            return (client?.Id, client?.Name, contact.Id, contact.Name);
        }

        // 2. Domain fallback: match sender/recipient domain against Client.Domain
        var domains = addresses
            .Where(a => a.Contains('@'))
            .Select(a => a.Split('@')[1].ToLowerInvariant())
            .Distinct()
            .ToList();

        var matchedClient = await _db.Clients
            .Where(c => !string.IsNullOrEmpty(c.Domain) &&
                        domains.Contains(c.Domain.ToLower()))
            .Select(c => new { c.Id, c.Name })
            .FirstOrDefaultAsync();

        return (matchedClient?.Id, matchedClient?.Name, null, null);
    }

    // ── Parsing helpers ──────────────────────────────────────────────────────

    private static (string address, string name) ParseEmailAddress(string raw)
    {
        raw = raw.Trim();
        var ltIdx = raw.IndexOf('<');
        if (ltIdx >= 0 && raw.EndsWith('>'))
        {
            var name    = raw[..ltIdx].Trim().Trim('"');
            var address = raw[(ltIdx + 1)..^1].Trim();
            return (address, name);
        }
        return (raw, "");
    }

    private static DateTime ParseDate(string dateStr)
    {
        if (DateTimeOffset.TryParse(dateStr, out var dto))
            return dto.UtcDateTime;
        return DateTime.UtcNow;
    }

    private static (string? text, string? html) ExtractBody(Google.Apis.Gmail.v1.Data.MessagePart part)
    {
        string? text = null;
        string? html = null;

        if (part.MimeType == "text/plain" && part.Body?.Data != null)
            text = DecodeBase64Url(part.Body.Data);
        else if (part.MimeType == "text/html" && part.Body?.Data != null)
            html = DecodeBase64Url(part.Body.Data);

        if (part.Parts != null)
        {
            foreach (var sub in part.Parts)
            {
                var (subText, subHtml) = ExtractBody(sub);
                text ??= subText;
                html ??= subHtml;
            }
        }

        return (text, html);
    }

    private static string DecodeBase64Url(string base64Url)
    {
        var base64  = base64Url.Replace('-', '+').Replace('_', '/');
        var padding = (4 - base64.Length % 4) % 4;
        base64 += new string('=', padding);
        return System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(base64));
    }
}
