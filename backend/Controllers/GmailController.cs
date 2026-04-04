using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/gmail")]
[Authorize]
public class GmailController : ControllerBase
{
    private readonly IGmailService _gmail;
    private readonly AppDbContext  _db;

    public GmailController(IGmailService gmail, AppDbContext db)
    {
        _gmail = gmail;
        _db    = db;
    }

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // GET /api/gmail/status
    // Returns whether the current user has a valid Gmail token stored.
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        var token = await _db.UserGoogleTokens
            .Where(t => t.UserEmail == email)
            .Select(t => new { t.TokenExpiry })
            .FirstOrDefaultAsync();

        return Ok(new GmailStatusDto(
            IsConnected: token != null,
            TokenExpiry: token?.TokenExpiry));
    }

    // GET /api/gmail/aliases
    // Returns the verified forwarding addresses configured on the user's Gmail account.
    [HttpGet("aliases")]
    public async Task<IActionResult> GetAliases()
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var aliases = await _gmail.GetForwardingAddressesAsync(email);
            return Ok(aliases);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // GET /api/gmail/emails?clientId=&alias=&pageToken=&q=
    // Lists emails from Gmail. clientId and alias are mutually exclusive filters;
    // q is an additional search term composed on top of whichever filter is active.
    [HttpGet("emails")]
    public async Task<IActionResult> ListEmails(
        [FromQuery] int?    clientId   = null,
        [FromQuery] string? alias      = null,
        [FromQuery] string? pageToken  = null,
        [FromQuery] string? q          = null,
        [FromQuery] int     maxResults = 25)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new
            {
                error = "Gmail not connected. Please sign out and sign back in to grant Gmail access."
            });

        try
        {
            string? query;

            if (clientId.HasValue)
            {
                query = await BuildClientQueryAsync(clientId.Value, q);
                if (query == null)
                    return NotFound(new { error = "Client not found." });
            }
            else if (!string.IsNullOrWhiteSpace(alias))
            {
                var aliasFilter = $"to:{alias}";
                query = string.IsNullOrWhiteSpace(q) ? aliasFilter : $"{aliasFilter} {q}";
            }
            else
            {
                query = q;
            }

            var result = await _gmail.ListEmailsAsync(email, pageToken, query, maxResults);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // GET /api/gmail/emails/{messageId}
    // Returns the full content of a single email message.
    [HttpGet("emails/{messageId}")]
    public async Task<IActionResult> GetEmail(string messageId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var detail = await _gmail.GetEmailAsync(email, messageId);
            return Ok(detail);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // GET /api/gmail/find-message?rfcMessageId=...
    // Searches the current user's Gmail for a message matching the given RFC 2822 Message-ID header
    // and returns the user's local Gmail message ID. Used so group members can navigate to their own
    // copy of an email when following a mention notification whose relatedMessageId is an RFC ID.
    [HttpGet("find-message")]
    public async Task<IActionResult> FindByRfcMessageId([FromQuery] string rfcMessageId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        if (string.IsNullOrWhiteSpace(rfcMessageId))
            return BadRequest(new { error = "rfcMessageId is required." });

        try
        {
            var localId = await _gmail.FindMessageByRfcIdAsync(email, rfcMessageId);
            if (localId == null)
                return NotFound(new { error = "Message not found in your mailbox." });

            return Ok(new { messageId = localId });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // GET /api/gmail/message/{messageId}/attachment/{attachmentId}?filename=...&mimeType=...
    // Fetches and streams a Gmail attachment. Inline for images/PDFs, download otherwise.
    [HttpGet("message/{messageId}/attachment/{attachmentId}")]
    public async Task<IActionResult> GetAttachment(
        string messageId,
        string attachmentId,
        [FromQuery] string filename = "attachment",
        [FromQuery] string mimeType = "application/octet-stream")
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var data     = await _gmail.GetAttachmentDataAsync(email, messageId, attachmentId);
            var isInline = mimeType.StartsWith("image/") || mimeType == "application/pdf";
            var cd       = isInline
                ? $"inline; filename=\"{filename}\""
                : $"attachment; filename=\"{filename}\"";

            Response.Headers["Content-Disposition"] = cd;
            return File(data, mimeType);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Builds a Gmail search query targeting a specific client's domain and contacts.
    // e.g. "(from:@acme.com OR to:@acme.com OR from:john@acme.com OR to:john@acme.com)"
    private async Task<string?> BuildClientQueryAsync(int clientId, string? extraQuery)
    {
        var client = await _db.Clients
            .Include(c => c.Contacts)
            .FirstOrDefaultAsync(c => c.Id == clientId);

        if (client == null) return null;

        var parts = new List<string>();

        if (!string.IsNullOrWhiteSpace(client.Domain))
        {
            parts.Add($"from:@{client.Domain}");
            parts.Add($"to:@{client.Domain}");
        }

        foreach (var contact in client.Contacts)
        {
            if (!string.IsNullOrWhiteSpace(contact.Email))
            {
                parts.Add($"from:{contact.Email}");
                parts.Add($"to:{contact.Email}");
            }
        }

        // If neither domain nor contacts are configured, fall back to general inbox
        if (parts.Count == 0)
            return string.IsNullOrWhiteSpace(extraQuery)
                ? "in:inbox OR in:sent"
                : extraQuery;

        var clientQuery = $"({string.Join(" OR ", parts)})";

        return string.IsNullOrWhiteSpace(extraQuery)
            ? clientQuery
            : $"{clientQuery} {extraQuery}";
    }
}
