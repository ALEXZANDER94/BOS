using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;

namespace BOS.Backend.Services;

public interface IWorkspaceService
{
    Task<IReadOnlyList<WorkspaceUserDto>> GetDomainUsersAsync();
    Task<IReadOnlyList<WorkspaceUserDto>> GetGroupMembersAsync(string groupEmail);
    Task<IReadOnlyList<WorkspaceUserDto>> GetKnownTicketUsersAsync();
}

public class WorkspaceService : IWorkspaceService
{
    private readonly IConfiguration      _config;
    private readonly IHttpClientFactory  _http;
    private readonly ILogger<WorkspaceService> _logger;
    private readonly AppDbContext        _db;

    public WorkspaceService(IConfiguration config, IHttpClientFactory http, ILogger<WorkspaceService> logger, AppDbContext db)
    {
        _config = config;
        _http   = http;
        _logger = logger;
        _db     = db;
    }

    // Returns the union of every distinct email that has touched the ticket
    // system (creator, assignee, comment author, watcher). Used as a fallback
    // for the assignee filter when the Google Workspace service account isn't
    // configured — without this, the dropdown is empty until Workspace is set up.
    public async Task<IReadOnlyList<WorkspaceUserDto>> GetKnownTicketUsersAsync()
    {
        var creators  = await _db.Tickets.Select(t => t.CreatedByEmail).Distinct().ToListAsync();
        var assignees = await _db.Tickets
            .Where(t => t.AssignedToEmail != null && t.AssignedToEmail != "")
            .Select(t => t.AssignedToEmail!)
            .Distinct()
            .ToListAsync();
        var commenters = await _db.TicketComments.Select(c => c.AuthorEmail).Distinct().ToListAsync();
        var watchers   = await _db.TicketWatchers.Select(w => w.UserEmail).Distinct().ToListAsync();

        var emails = creators
            .Concat(assignees)
            .Concat(commenters)
            .Concat(watchers)
            .Where(e => !string.IsNullOrWhiteSpace(e))
            .Select(e => e.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(e => e, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return emails.Select(e => new WorkspaceUserDto(e, e)).ToList();
    }

    // ── Public interface ──────────────────────────────────────────────────────

    public async Task<IReadOnlyList<WorkspaceUserDto>> GetDomainUsersAsync()
    {
        var token = await GetAdminTokenAsync();
        if (token == null) return [];

        var domain = _config["Google:AllowedDomain"];
        if (string.IsNullOrWhiteSpace(domain))
        {
            _logger.LogWarning("Workspace: Google:AllowedDomain is not configured.");
            return [];
        }

        var http    = _http.CreateClient();
        var results = new List<WorkspaceUserDto>();
        string? pageToken = null;

        do
        {
            var url = $"https://admin.googleapis.com/admin/directory/v1/users" +
                      $"?domain={Uri.EscapeDataString(domain)}&viewType=domain_public&maxResults=500" +
                      (pageToken != null ? $"&pageToken={Uri.EscapeDataString(pageToken)}" : "");

            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

            var resp = await http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
            {
                _logger.LogWarning("Workspace: users list failed {Status}.", (int)resp.StatusCode);
                break;
            }

            using var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
            if (json.RootElement.TryGetProperty("users", out var usersEl))
            {
                foreach (var u in usersEl.EnumerateArray())
                {
                    var email = u.TryGetProperty("primaryEmail", out var e) ? e.GetString() : null;
                    var name  = u.TryGetProperty("name", out var n) &&
                                n.TryGetProperty("fullName", out var fn)
                                ? fn.GetString() : null;
                    if (!string.IsNullOrWhiteSpace(email))
                        results.Add(new WorkspaceUserDto(email, name ?? email));
                }
            }

            pageToken = json.RootElement.TryGetProperty("nextPageToken", out var npt)
                ? npt.GetString() : null;

        } while (pageToken != null);

        return results;
    }

    public async Task<IReadOnlyList<WorkspaceUserDto>> GetGroupMembersAsync(string groupEmail)
    {
        var token = await GetAdminTokenAsync();
        if (token == null) return [];

        var http = _http.CreateClient();

        // Fetch group membership list
        using var membersReq = new HttpRequestMessage(
            HttpMethod.Get,
            $"https://admin.googleapis.com/admin/directory/v1/groups/{Uri.EscapeDataString(groupEmail)}/members");
        membersReq.Headers.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

        var membersResp = await http.SendAsync(membersReq);
        if (!membersResp.IsSuccessStatusCode)
        {
            _logger.LogWarning("Workspace: group members failed {Status} for {Group}.",
                (int)membersResp.StatusCode, groupEmail);
            return [];
        }

        var memberEmails = new List<string>();
        using (var json = JsonDocument.Parse(await membersResp.Content.ReadAsStringAsync()))
        {
            if (json.RootElement.TryGetProperty("members", out var membersEl))
            {
                memberEmails.AddRange(
                    membersEl.EnumerateArray()
                        .Select(m => m.TryGetProperty("email", out var v) ? v.GetString() : null)
                        .Where(e => !string.IsNullOrWhiteSpace(e))!);
            }
        }

        if (memberEmails.Count == 0) return [];

        // Resolve display names in parallel (best-effort — fall back to email on failure)
        var tasks = memberEmails.Select(email => FetchUserNameAsync(http, token, email));
        var users = await Task.WhenAll(tasks);
        return users.Where(u => u != null).Cast<WorkspaceUserDto>().ToList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task<WorkspaceUserDto?> FetchUserNameAsync(
        HttpClient http, string token, string email)
    {
        try
        {
            using var req = new HttpRequestMessage(
                HttpMethod.Get,
                $"https://admin.googleapis.com/admin/directory/v1/users/{Uri.EscapeDataString(email)}?viewType=domain_public");
            req.Headers.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);

            var resp = await http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
                return new WorkspaceUserDto(email, email);

            using var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
            var name = json.RootElement.TryGetProperty("name", out var n) &&
                       n.TryGetProperty("fullName", out var fn)
                       ? fn.GetString() : null;

            return new WorkspaceUserDto(email, name ?? email);
        }
        catch
        {
            return new WorkspaceUserDto(email, email);
        }
    }

    private async Task<string?> GetAdminTokenAsync()
    {
        var keyPath    = _config["Google:ServiceAccountKeyPath"];
        var adminEmail = _config["Google:ServiceAccountAdminEmail"];

        if (string.IsNullOrWhiteSpace(keyPath) || !File.Exists(keyPath))
        {
            _logger.LogWarning("Workspace: service account key not configured or not found at '{Path}'.", keyPath);
            return null;
        }
        if (string.IsNullOrWhiteSpace(adminEmail))
        {
            _logger.LogWarning("Workspace: Google:ServiceAccountAdminEmail is not configured.");
            return null;
        }

        try
        {
#pragma warning disable CS0618
            var credential = Google.Apis.Auth.OAuth2.GoogleCredential
                .FromFile(keyPath)
                .CreateScoped(
                    "https://www.googleapis.com/auth/admin.directory.user.readonly",
                    "https://www.googleapis.com/auth/admin.directory.group.member.readonly")
                .CreateWithUser(adminEmail);
#pragma warning restore CS0618

            if (credential.UnderlyingCredential is not
                Google.Apis.Auth.OAuth2.ServiceAccountCredential saCred)
                return null;

            return await saCred.GetAccessTokenForRequestAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Workspace: failed to obtain admin token.");
            return null;
        }
    }
}
