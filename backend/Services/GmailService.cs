using System.Text;
using System.Text.Json;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Gmail.v1.Data;
using Google.Apis.Services;
using Google.Apis.Util;
using Microsoft.EntityFrameworkCore;
using MimeKit;
using MimeKit.Text;
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
    Task<byte[]>                  GetAttachmentDataAsync(string userEmail, string messageId, string attachmentId);
    Task<IReadOnlyList<string>>   GetForwardingAddressesAsync(string userEmail);
    Task<IReadOnlyList<EmailSummaryDto>> GetEmailsByIdsAsync(string userEmail, IEnumerable<string> messageIds);
    /// <summary>
    /// Searches the user's Gmail for a message matching the given RFC 2822 Message-ID header value
    /// and returns that user's local Gmail message ID, or null if not found.
    /// </summary>
    Task<string?> FindMessageByRfcIdAsync(string userEmail, string rfcMessageId);

    /// <summary>
    /// Fetches only the RFC 2822 Message-ID header for a specific Gmail message.
    /// Used to resolve legacy per-user Gmail IDs to the stable cross-user RFC ID.
    /// Returns null if the message is not found or has no Message-ID header.
    /// </summary>
    Task<string?> GetRfcMessageIdAsync(string userEmail, string gmailMessageId);

    /// <summary>
    /// Fetches all messages in a Gmail thread in chronological order.
    /// </summary>
    Task<IReadOnlyList<EmailDetailDto>> GetThreadAsync(string userEmail, string threadId);

    // ── Compose / send / reply / forward ─────────────────────────────────────
    Task<SendResultDto> SendMessageAsync(string userEmail, SendMessageRequest req);
    Task<SendResultDto> ReplyAsync(string userEmail, ReplyRequest req, string? fromOverride = null);
    Task<SendResultDto> ForwardAsync(string userEmail, ForwardRequest req, string? fromOverride = null);

    // ── Labels / archive / trash / read state ────────────────────────────────
    Task<IReadOnlyList<GmailLabelDto>> ListLabelsAsync(string userEmail);
    Task ModifyLabelsAsync(string userEmail, string messageId, IList<string> addLabelIds, IList<string> removeLabelIds);
    Task TrashAsync(string userEmail, string messageId);
    Task UntrashAsync(string userEmail, string messageId);
    Task MarkReadAsync(string userEmail, string messageId, bool read);

    // ── Drafts ────────────────────────────────────────────────────────────────
    Task<DraftListResponse>  ListDraftsAsync(string userEmail);
    Task<DraftDetailDto?>    GetDraftAsync(string userEmail, string draftId);
    Task<DraftSavedDto>      SaveDraftAsync(string userEmail, SaveDraftRequest req);
    Task<SendResultDto>      SendDraftAsync(string userEmail, string draftId);
    Task                     DeleteDraftAsync(string userEmail, string draftId);

    // ── Send-as ──────────────────────────────────────────────────────────────
    Task<IReadOnlyList<SendAsAddressDto>> GetSendAsAddressesAsync(string userEmail);
}

public record SendAsAddressDto(string Email, string? DisplayName, bool IsDefault, bool IsPrimary);

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
                clientId, clientName, contactId, contactName,
                meta.RfcMessageId));
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
        var attachments                                      = ExtractAttachments(msg.Payload);

        var rawRfcId     = headers.GetValueOrDefault("Message-ID");
        var rfcMessageId = rawRfcId != null ? rawRfcId.Trim().Trim('<', '>') : null;

        return new EmailDetailDto(
            messageId, msg.ThreadId ?? "",
            subject,
            fromAddress, fromName, to, cc,
            ParseDate(dateStr), isRead,
            bodyText, bodyHtml,
            clientId, clientName, contactId, contactName,
            attachments, rfcMessageId);
    }

    public async Task<byte[]> GetAttachmentDataAsync(string userEmail, string messageId, string attachmentId)
    {
        var accessToken = await GetValidAccessTokenAsync(userEmail);
        var service     = CreateApiClient(accessToken);

        var attachmentBody = await service.Users.Messages.Attachments
            .Get("me", messageId, attachmentId)
            .ExecuteAsync();

        var base64  = attachmentBody.Data.Replace('-', '+').Replace('_', '/');
        var padding = (4 - base64.Length % 4) % 4;
        base64 += new string('=', padding);
        return Convert.FromBase64String(base64);
    }

    public async Task<string?> FindMessageByRfcIdAsync(string userEmail, string rfcMessageId)
    {
        var accessToken = await GetValidAccessTokenAsync(userEmail);
        var service     = CreateApiClient(accessToken);

        var cleanId = rfcMessageId.Trim().Trim('<', '>');
        var listReq = service.Users.Messages.List("me");
        listReq.Q          = $"rfc822msgid:{cleanId}";
        listReq.MaxResults  = 1;

        var resp = await listReq.ExecuteAsync();
        return resp.Messages?.FirstOrDefault()?.Id;
    }

    public async Task<string?> GetRfcMessageIdAsync(string userEmail, string gmailMessageId)
    {
        try
        {
            var accessToken = await GetValidAccessTokenAsync(userEmail);
            var service     = CreateApiClient(accessToken);
            var meta        = await FetchMetadataAsync(service, gmailMessageId);
            return meta?.RfcMessageId;
        }
        catch
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<EmailDetailDto>> GetThreadAsync(string userEmail, string threadId)
    {
        var accessToken = await GetValidAccessTokenAsync(userEmail);
        var service     = CreateApiClient(accessToken);

        var threadReq    = service.Users.Threads.Get("me", threadId);
        threadReq.Format = Google.Apis.Gmail.v1.UsersResource.ThreadsResource.GetRequest.FormatEnum.Full;
        var thread       = await threadReq.ExecuteAsync();

        if (thread.Messages == null || thread.Messages.Count == 0)
            return [];

        var results = new List<EmailDetailDto>();
        foreach (var msg in thread.Messages.OrderBy(m => m.InternalDate ?? 0))
        {
            var headers  = msg.Payload?.Headers?
                .GroupBy(h => h.Name, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase)
                ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            var from     = headers.GetValueOrDefault("From",    "");
            var to       = headers.GetValueOrDefault("To",      "");
            var cc       = headers.GetValueOrDefault("Cc");
            var subject  = headers.GetValueOrDefault("Subject", "(No Subject)");
            var dateStr  = headers.GetValueOrDefault("Date",    "");
            var isRead   = msg.LabelIds == null || !msg.LabelIds.Contains("UNREAD");

            var (bodyText, bodyHtml)                            = msg.Payload != null ? ExtractBody(msg.Payload) : ("", null);
            var (fromAddress, fromName)                         = ParseEmailAddress(from);
            var (clientId, clientName, contactId, contactName) = await MatchToClientAsync(from, to, cc);
            var attachments                                     = msg.Payload != null ? ExtractAttachments(msg.Payload) : [];

            var rawRfcId     = headers.GetValueOrDefault("Message-ID");
            var rfcMessageId = rawRfcId != null ? rawRfcId.Trim().Trim('<', '>') : null;

            results.Add(new EmailDetailDto(
                msg.Id ?? "", thread.Id ?? "",
                subject,
                fromAddress, fromName, to, cc,
                ParseDate(dateStr), isRead,
                bodyText, bodyHtml,
                clientId, clientName, contactId, contactName,
                attachments, rfcMessageId));
        }

        return results;
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
                clientId, clientName, contactId, contactName,
                meta.RfcMessageId));
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
        bool     IsRead,
        string?  RfcMessageId);

    private static async Task<MessageMeta?> FetchMetadataAsync(
        GmailApiClient service, string messageId)
    {
        try
        {
            var req    = service.Users.Messages.Get("me", messageId);
            req.Format = MessagesResource.GetRequest.FormatEnum.Metadata;
            req.MetadataHeaders = new Repeatable<string>(
                ["From", "To", "Cc", "Subject", "Date", "Message-ID"]);

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

            // Strip angle brackets from the RFC 2822 Message-ID header (e.g. <id@host> → id@host)
            var rawRfcId = headers.GetValueOrDefault("Message-ID");
            var rfcMessageId = rawRfcId != null
                ? rawRfcId.Trim().Trim('<', '>')
                : null;

            return new MessageMeta(
                messageId, msg.ThreadId ?? "",
                subject, msg.Snippet ?? "",
                from, to, cc,
                fromAddress, fromName,
                ParseDate(dateStr), isRead,
                rfcMessageId);
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

    private static List<AttachmentMetaDto> ExtractAttachments(Google.Apis.Gmail.v1.Data.MessagePart part)
    {
        var results = new List<AttachmentMetaDto>();
        CollectAttachments(part, results);
        return results;
    }

    private static void CollectAttachments(Google.Apis.Gmail.v1.Data.MessagePart part, List<AttachmentMetaDto> results)
    {
        if (!string.IsNullOrEmpty(part.Body?.AttachmentId) && !string.IsNullOrEmpty(part.Filename))
        {
            results.Add(new AttachmentMetaDto(
                part.Body.AttachmentId,
                part.Filename,
                part.MimeType ?? "application/octet-stream",
                part.Body.Size ?? 0));
        }

        if (part.Parts != null)
            foreach (var sub in part.Parts)
                CollectAttachments(sub, results);
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

    private static string EncodeBase64Url(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── Compose / send / reply / forward ─────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<SendResultDto> SendMessageAsync(string userEmail, SendMessageRequest req)
    {
        var service = await GetServiceAsync(userEmail);

        var mime = BuildMime(
            fromAddress: userEmail,
            to:          req.To,
            cc:          req.Cc,
            bcc:         req.Bcc,
            subject:     req.Subject,
            bodyHtml:    req.BodyHtml,
            bodyText:    req.BodyText,
            attachments: req.Attachments,
            inReplyTo:   null,
            references:  null);

        return await SendMimeAsync(service, mime, threadId: null);
    }

    public async Task<SendResultDto> ReplyAsync(string userEmail, ReplyRequest req, string? fromOverride = null)
    {
        var service = await GetServiceAsync(userEmail);

        // Pull threading headers from the source message so the reply nests in the same Gmail thread.
        var (threadId, sourceRfcId, sourceReferences) = await GetThreadingHeadersAsync(service, req.SourceMessageId);

        var newReferences = string.IsNullOrWhiteSpace(sourceReferences)
            ? sourceRfcId
            : $"{sourceReferences} {sourceRfcId}".Trim();

        var mime = BuildMime(
            fromAddress: fromOverride ?? userEmail,
            to:          req.To,
            cc:          req.Cc,
            bcc:         req.Bcc,
            subject:     req.Subject,
            bodyHtml:    req.BodyHtml,
            bodyText:    req.BodyText,
            attachments: req.Attachments,
            inReplyTo:   sourceRfcId,
            references:  newReferences);

        return await SendMimeAsync(service, mime, threadId);
    }

    public async Task<SendResultDto> ForwardAsync(string userEmail, ForwardRequest req, string? fromOverride = null)
    {
        var service = await GetServiceAsync(userEmail);

        // Forwards do NOT live in the original thread by default — they start a new conversation
        // unless the user explicitly forwards within the thread (Gmail's own behaviour).
        var (_, sourceRfcId, sourceReferences) = await GetThreadingHeadersAsync(service, req.SourceMessageId);

        // Optionally re-attach the original message's attachments to the forward.
        var allAttachments = new List<OutboundAttachment>(req.Attachments);
        if (req.IncludeOriginalAttachments)
        {
            var originals = await FetchAttachmentBytesAsync(service, req.SourceMessageId);
            allAttachments.AddRange(originals);
        }

        var newReferences = string.IsNullOrWhiteSpace(sourceReferences)
            ? sourceRfcId
            : $"{sourceReferences} {sourceRfcId}".Trim();

        var mime = BuildMime(
            fromAddress: fromOverride ?? userEmail,
            to:          req.To,
            cc:          req.Cc,
            bcc:         req.Bcc,
            subject:     req.Subject,
            bodyHtml:    req.BodyHtml,
            bodyText:    req.BodyText,
            attachments: allAttachments,
            inReplyTo:   sourceRfcId,
            references:  newReferences);

        return await SendMimeAsync(service, mime, threadId: null);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── Labels / archive / trash / read state ────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<IReadOnlyList<GmailLabelDto>> ListLabelsAsync(string userEmail)
    {
        var service = await GetServiceAsync(userEmail);
        var resp    = await service.Users.Labels.List("me").ExecuteAsync();

        if (resp.Labels == null) return [];

        return resp.Labels
            .OrderBy(l => l.Type == "system" ? 0 : 1)
            .ThenBy(l => l.Name)
            .Select(l => new GmailLabelDto(
                l.Id,
                l.Name,
                l.Type ?? "user",
                (int?)l.MessagesUnread,
                (int?)l.MessagesTotal))
            .ToList();
    }

    public async Task ModifyLabelsAsync(
        string userEmail, string messageId, IList<string> addLabelIds, IList<string> removeLabelIds)
    {
        var service = await GetServiceAsync(userEmail);
        var req     = new ModifyMessageRequest
        {
            AddLabelIds    = addLabelIds.Count    > 0 ? addLabelIds    : null,
            RemoveLabelIds = removeLabelIds.Count > 0 ? removeLabelIds : null,
        };
        await service.Users.Messages.Modify(req, "me", messageId).ExecuteAsync();
    }

    public async Task TrashAsync(string userEmail, string messageId)
    {
        var service = await GetServiceAsync(userEmail);
        await service.Users.Messages.Trash("me", messageId).ExecuteAsync();
    }

    public async Task UntrashAsync(string userEmail, string messageId)
    {
        var service = await GetServiceAsync(userEmail);
        await service.Users.Messages.Untrash("me", messageId).ExecuteAsync();
    }

    public async Task MarkReadAsync(string userEmail, string messageId, bool read)
    {
        // Gmail represents unread state with the UNREAD label — add it to mark unread, remove to mark read.
        await ModifyLabelsAsync(
            userEmail,
            messageId,
            addLabelIds:    read ? Array.Empty<string>() : new[] { "UNREAD" },
            removeLabelIds: read ? new[] { "UNREAD" }     : Array.Empty<string>());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── Drafts ───────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    public async Task<DraftListResponse> ListDraftsAsync(string userEmail)
    {
        var service = await GetServiceAsync(userEmail);

        var listReq = service.Users.Drafts.List("me");
        listReq.MaxResults = 100;
        var listResp = await listReq.ExecuteAsync();

        if (listResp.Drafts == null || listResp.Drafts.Count == 0)
            return new DraftListResponse([]);

        var summaries = new List<DraftSummaryDto>();
        foreach (var draft in listResp.Drafts)
        {
            try
            {
                // Drafts.Get returns the wrapping draft + nested message. Use Metadata format
                // for cheap headers; we don't need the body for the list view.
                var getReq = service.Users.Drafts.Get("me", draft.Id);
                getReq.Format = Google.Apis.Gmail.v1.UsersResource.DraftsResource.GetRequest.FormatEnum.Metadata;
                var fullDraft = await getReq.ExecuteAsync();

                var msg = fullDraft.Message;
                if (msg == null) continue;

                var headers = msg.Payload?.Headers?
                    .GroupBy(h => h.Name, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase)
                    ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

                summaries.Add(new DraftSummaryDto(
                    DraftId:   draft.Id,
                    MessageId: msg.Id ?? "",
                    ThreadId:  msg.ThreadId ?? "",
                    Subject:   headers.GetValueOrDefault("Subject", "(No Subject)"),
                    To:        headers.GetValueOrDefault("To", ""),
                    Snippet:   msg.Snippet,
                    UpdatedAt: msg.InternalDate.HasValue
                        ? DateTimeOffset.FromUnixTimeMilliseconds(msg.InternalDate.Value).UtcDateTime
                        : DateTime.UtcNow));
            }
            catch
            {
                // Skip drafts we can't load — Gmail occasionally returns ghost IDs after deletes.
            }
        }

        return new DraftListResponse(summaries.OrderByDescending(d => d.UpdatedAt).ToList());
    }

    public async Task<DraftDetailDto?> GetDraftAsync(string userEmail, string draftId)
    {
        var service = await GetServiceAsync(userEmail);

        var getReq = service.Users.Drafts.Get("me", draftId);
        getReq.Format = Google.Apis.Gmail.v1.UsersResource.DraftsResource.GetRequest.FormatEnum.Full;
        var draft = await getReq.ExecuteAsync();

        var msg = draft.Message;
        if (msg?.Payload == null) return null;

        var headers = msg.Payload.Headers
            .GroupBy(h => h.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase);

        var (text, html) = ExtractBody(msg.Payload);
        var attachments  = ExtractAttachments(msg.Payload);

        return new DraftDetailDto(
            DraftId:            draft.Id,
            MessageId:          msg.Id ?? "",
            ThreadId:           msg.ThreadId ?? "",
            Subject:            headers.GetValueOrDefault("Subject", ""),
            To:                 headers.GetValueOrDefault("To", ""),
            Cc:                 headers.GetValueOrDefault("Cc"),
            Bcc:                headers.GetValueOrDefault("Bcc"),
            BodyHtml:           html,
            BodyText:           text,
            Attachments:        attachments,
            InReplyToMessageId: headers.GetValueOrDefault("In-Reply-To"),
            UpdatedAt:          msg.InternalDate.HasValue
                ? DateTimeOffset.FromUnixTimeMilliseconds(msg.InternalDate.Value).UtcDateTime
                : DateTime.UtcNow);
    }

    public async Task<DraftSavedDto> SaveDraftAsync(string userEmail, SaveDraftRequest req)
    {
        var service = await GetServiceAsync(userEmail);

        // If this draft was started as a reply, fetch threading headers so the eventual send
        // lands in the right Gmail thread.
        string? inReplyTo  = null;
        string? references = null;
        string? threadId   = null;
        if (!string.IsNullOrEmpty(req.SourceMessageId))
        {
            var (tid, srcRfc, srcRefs) = await GetThreadingHeadersAsync(service, req.SourceMessageId);
            threadId   = tid;
            inReplyTo  = srcRfc;
            references = string.IsNullOrWhiteSpace(srcRefs) ? srcRfc : $"{srcRefs} {srcRfc}".Trim();
        }

        var mime = BuildMime(
            fromAddress: userEmail,
            to:          req.To,
            cc:          req.Cc,
            bcc:         req.Bcc,
            subject:     req.Subject,
            bodyHtml:    req.BodyHtml,
            bodyText:    req.BodyText,
            attachments: req.Attachments,
            inReplyTo:   inReplyTo,
            references:  references);

        var rawMessage = new Message
        {
            Raw      = MimeToRaw(mime),
            ThreadId = threadId,
        };
        var draftBody  = new Draft { Message = rawMessage };

        Draft saved;
        if (string.IsNullOrEmpty(req.DraftId))
            saved = await service.Users.Drafts.Create(draftBody, "me").ExecuteAsync();
        else
            saved = await service.Users.Drafts.Update(draftBody, "me", req.DraftId).ExecuteAsync();

        return new DraftSavedDto(
            DraftId:   saved.Id,
            MessageId: saved.Message?.Id      ?? "",
            ThreadId:  saved.Message?.ThreadId ?? "");
    }

    public async Task<SendResultDto> SendDraftAsync(string userEmail, string draftId)
    {
        var service = await GetServiceAsync(userEmail);
        var sent    = await service.Users.Drafts.Send(new Draft { Id = draftId }, "me").ExecuteAsync();
        return new SendResultDto(sent.Id ?? "", sent.ThreadId ?? "");
    }

    public async Task DeleteDraftAsync(string userEmail, string draftId)
    {
        var service = await GetServiceAsync(userEmail);
        await service.Users.Drafts.Delete("me", draftId).ExecuteAsync();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── Send / MIME helpers ──────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    private async Task<GmailApiClient> GetServiceAsync(string userEmail)
    {
        var token = await GetValidAccessTokenAsync(userEmail);
        return CreateApiClient(token);
    }

    private static async Task<SendResultDto> SendMimeAsync(GmailApiClient service, MimeMessage mime, string? threadId)
    {
        var msg = new Message
        {
            Raw      = MimeToRaw(mime),
            ThreadId = threadId,
        };
        var sent = await service.Users.Messages.Send(msg, "me").ExecuteAsync();
        return new SendResultDto(sent.Id ?? "", sent.ThreadId ?? "");
    }

    private static string MimeToRaw(MimeMessage mime)
    {
        using var ms = new MemoryStream();
        mime.WriteTo(ms);
        return EncodeBase64Url(ms.ToArray());
    }

    // Pulls In-Reply-To / References / RFC Message-ID and ThreadId from the source message
    // so a reply or forward can thread correctly.
    private static async Task<(string ThreadId, string? RfcMessageId, string? References)>
        GetThreadingHeadersAsync(GmailApiClient service, string sourceMessageId)
    {
        var req = service.Users.Messages.Get("me", sourceMessageId);
        req.Format          = MessagesResource.GetRequest.FormatEnum.Metadata;
        req.MetadataHeaders = new Repeatable<string>(["Message-ID", "References"]);
        var msg = await req.ExecuteAsync();

        var headers = msg.Payload?.Headers?
            .GroupBy(h => h.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First().Value, StringComparer.OrdinalIgnoreCase)
            ?? new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        var rawRfc      = headers.GetValueOrDefault("Message-ID");
        var rfcMessage  = string.IsNullOrWhiteSpace(rawRfc) ? null : EnsureAngleBrackets(rawRfc.Trim());
        var references  = headers.GetValueOrDefault("References");

        return (msg.ThreadId ?? "", rfcMessage, references);
    }

    private static string EnsureAngleBrackets(string id)
    {
        if (id.StartsWith('<') && id.EndsWith('>')) return id;
        return $"<{id.Trim('<', '>')}>";
    }

    // Downloads the attachments of a source message as raw byte buffers so they can be
    // re-attached to a forward.
    private static async Task<List<OutboundAttachment>> FetchAttachmentBytesAsync(
        GmailApiClient service, string sourceMessageId)
    {
        var req    = service.Users.Messages.Get("me", sourceMessageId);
        req.Format = MessagesResource.GetRequest.FormatEnum.Full;
        var msg    = await req.ExecuteAsync();

        var results = new List<OutboundAttachment>();
        if (msg.Payload == null) return results;

        var metas = ExtractAttachments(msg.Payload);
        foreach (var meta in metas)
        {
            try
            {
                var attBody = await service.Users.Messages.Attachments
                    .Get("me", sourceMessageId, meta.AttachmentId)
                    .ExecuteAsync();

                var b64 = attBody.Data.Replace('-', '+').Replace('_', '/');
                var pad = (4 - b64.Length % 4) % 4;
                b64 += new string('=', pad);
                var bytes = Convert.FromBase64String(b64);

                results.Add(new OutboundAttachment(meta.Filename, meta.MimeType, bytes));
            }
            catch
            {
                // Skip individual attachment failures — better a partial forward than none.
            }
        }
        return results;
    }

    // Builds a MimeKit MimeMessage from the request fields. Handles multipart/alternative
    // for HTML+text, multipart/mixed for attachments, and threading headers for replies.
    private static MimeMessage BuildMime(
        string fromAddress,
        string to,
        string? cc,
        string? bcc,
        string subject,
        string bodyHtml,
        string? bodyText,
        List<OutboundAttachment> attachments,
        string? inReplyTo,
        string? references)
    {
        var message = new MimeMessage();
        message.From.Add(MailboxAddress.Parse(fromAddress));

        AddAddresses(message.To,  to);
        AddAddresses(message.Cc,  cc);
        AddAddresses(message.Bcc, bcc);

        message.Subject = subject ?? string.Empty;

        if (!string.IsNullOrEmpty(inReplyTo))
            message.Headers.Add("In-Reply-To", inReplyTo);
        if (!string.IsNullOrEmpty(references))
            message.Headers.Add("References", references);

        // Body: prefer multipart/alternative when both representations are present.
        var html = bodyHtml ?? string.Empty;
        var text = !string.IsNullOrEmpty(bodyText)
            ? bodyText
            : HtmlToPlainText(html);

        var alternative = new MultipartAlternative
        {
            new TextPart(TextFormat.Plain) { Text = text },
            new TextPart(TextFormat.Html)  { Text = html },
        };

        if (attachments == null || attachments.Count == 0)
        {
            message.Body = alternative;
        }
        else
        {
            var mixed = new Multipart("mixed") { alternative };
            foreach (var att in attachments)
            {
                var part = new MimePart(att.MimeType ?? "application/octet-stream")
                {
                    Content                 = new MimeContent(new MemoryStream(att.Content)),
                    ContentDisposition      = new ContentDisposition(ContentDisposition.Attachment),
                    ContentTransferEncoding = ContentEncoding.Base64,
                    FileName                = att.FileName,
                };
                mixed.Add(part);
            }
            message.Body = mixed;
        }

        return message;
    }

    private static void AddAddresses(InternetAddressList list, string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return;
        foreach (var part in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (MailboxAddress.TryParse(part, out var addr))
                list.Add(addr);
        }
    }

    // Quick and dirty HTML → text fallback for the multipart/alternative text part.
    // Good enough for the plain-text view; the HTML body is what recipients see.
    private static string HtmlToPlainText(string html)
    {
        if (string.IsNullOrEmpty(html)) return string.Empty;
        var stripped = System.Text.RegularExpressions.Regex.Replace(html, "<br\\s*/?>", "\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        stripped = System.Text.RegularExpressions.Regex.Replace(stripped, "</p>", "\n\n", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        stripped = System.Text.RegularExpressions.Regex.Replace(stripped, "<[^>]+>", string.Empty);
        stripped = System.Net.WebUtility.HtmlDecode(stripped);
        return stripped.Trim();
    }

    // ── Send-as addresses ────────────────────────────────────────────────────

    public async Task<IReadOnlyList<SendAsAddressDto>> GetSendAsAddressesAsync(string userEmail)
    {
        var service = await GetServiceAsync(userEmail);
        var resp    = await service.Users.Settings.SendAs.List("me").ExecuteAsync();
        if (resp.SendAs == null) return [];

        return resp.SendAs
            .Where(s => s.VerificationStatus == "accepted" || s.IsPrimary == true)
            .Select(s => new SendAsAddressDto(
                s.SendAsEmail,
                s.DisplayName,
                s.IsDefault == true,
                s.IsPrimary == true))
            .OrderByDescending(s => s.IsPrimary)
            .ThenBy(s => s.Email)
            .ToList();
    }
}
