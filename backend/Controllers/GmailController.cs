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

    // GET /api/gmail/thread/{threadId}
    // Returns all messages in a Gmail thread in chronological order.
    [HttpGet("thread/{threadId}")]
    public async Task<IActionResult> GetThread(string threadId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();

        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var messages = await _gmail.GetThreadAsync(email, threadId);
            return Ok(messages);
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

    // ─────────────────────────────────────────────────────────────────────────
    // ── Compose / send / reply / forward ─────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    // All write endpoints accept multipart/form-data so the frontend can attach files in
    // a single round-trip. Text fields are sent as form parts; attachments arrive as IFormFile[].

    [HttpPost("messages/send")]
    [RequestSizeLimit(50_000_000)] // ~50 MB cap; Gmail's own limit is 25 MB after base64 expansion
    public async Task<IActionResult> SendMessage(
        [FromForm] string to,
        [FromForm] string? cc,
        [FromForm] string? bcc,
        [FromForm] string subject,
        [FromForm] string bodyHtml,
        [FromForm] string? bodyText,
        [FromForm] string? from,
        [FromForm] IFormFileCollection? attachments)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var req = new SendMessageRequest(
                To:          to,
                Cc:          cc,
                Bcc:         bcc,
                Subject:     subject ?? "",
                BodyHtml:    bodyHtml ?? "",
                BodyText:    bodyText,
                Attachments: await ReadAttachmentsAsync(attachments));
            var result = await _gmail.SendMessageAsync(from ?? email, req);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("messages/{messageId}/reply")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> ReplyMessage(
        string messageId,
        [FromForm] bool replyAll,
        [FromForm] string to,
        [FromForm] string? cc,
        [FromForm] string? bcc,
        [FromForm] string subject,
        [FromForm] string bodyHtml,
        [FromForm] string? bodyText,
        [FromForm] string? from,
        [FromForm] IFormFileCollection? attachments)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var req = new ReplyRequest(
                SourceMessageId: messageId,
                ReplyAll:        replyAll,
                To:              to,
                Cc:              cc,
                Bcc:             bcc,
                Subject:         subject ?? "",
                BodyHtml:        bodyHtml ?? "",
                BodyText:        bodyText,
                Attachments:     await ReadAttachmentsAsync(attachments));
            var result = await _gmail.ReplyAsync(email, req, from);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("messages/{messageId}/forward")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> ForwardMessage(
        string messageId,
        [FromForm] string to,
        [FromForm] string? cc,
        [FromForm] string? bcc,
        [FromForm] string subject,
        [FromForm] string bodyHtml,
        [FromForm] string? bodyText,
        [FromForm] string? from,
        [FromForm] bool includeOriginalAttachments,
        [FromForm] IFormFileCollection? attachments)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var req = new ForwardRequest(
                SourceMessageId:            messageId,
                To:                         to,
                Cc:                         cc,
                Bcc:                        bcc,
                Subject:                    subject ?? "",
                BodyHtml:                   bodyHtml ?? "",
                BodyText:                   bodyText,
                Attachments:                await ReadAttachmentsAsync(attachments),
                IncludeOriginalAttachments: includeOriginalAttachments);
            var result = await _gmail.ForwardAsync(email, req, from);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── Labels / archive / trash / read state ────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    [HttpGet("labels")]
    public async Task<IActionResult> ListLabels()
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var labels = await _gmail.ListLabelsAsync(email);
            return Ok(labels);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPatch("messages/{messageId}/labels")]
    public async Task<IActionResult> ModifyLabels(string messageId, [FromBody] ModifyLabelsRequest req)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            await _gmail.ModifyLabelsAsync(email, messageId, req.AddLabelIds ?? [], req.RemoveLabelIds ?? []);
            return NoContent();
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("messages/{messageId}/trash")]
    public async Task<IActionResult> TrashMessage(string messageId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try { await _gmail.TrashAsync(email, messageId); return NoContent(); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPost("messages/{messageId}/untrash")]
    public async Task<IActionResult> UntrashMessage(string messageId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try { await _gmail.UntrashAsync(email, messageId); return NoContent(); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPost("messages/{messageId}/read")]
    public async Task<IActionResult> MarkRead(string messageId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try { await _gmail.MarkReadAsync(email, messageId, read: true); return NoContent(); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPost("messages/{messageId}/unread")]
    public async Task<IActionResult> MarkUnread(string messageId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try { await _gmail.MarkReadAsync(email, messageId, read: false); return NoContent(); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ── Drafts ───────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────────

    [HttpGet("drafts")]
    public async Task<IActionResult> ListDrafts()
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try { return Ok(await _gmail.ListDraftsAsync(email)); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpGet("drafts/{draftId}")]
    public async Task<IActionResult> GetDraft(string draftId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var dto = await _gmail.GetDraftAsync(email, draftId);
            if (dto == null) return NotFound();
            return Ok(dto);
        }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpPost("drafts")]
    [RequestSizeLimit(50_000_000)]
    public async Task<IActionResult> SaveDraft(
        [FromForm] string? draftId,
        [FromForm] string? sourceMessageId,
        [FromForm] bool replyAll,
        [FromForm] string to,
        [FromForm] string? cc,
        [FromForm] string? bcc,
        [FromForm] string subject,
        [FromForm] string bodyHtml,
        [FromForm] string? bodyText,
        [FromForm] IFormFileCollection? attachments)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var req = new SaveDraftRequest(
                DraftId:         string.IsNullOrEmpty(draftId) ? null : draftId,
                SourceMessageId: string.IsNullOrEmpty(sourceMessageId) ? null : sourceMessageId,
                ReplyAll:        replyAll,
                To:              to ?? "",
                Cc:              cc,
                Bcc:             bcc,
                Subject:         subject ?? "",
                BodyHtml:        bodyHtml ?? "",
                BodyText:        bodyText,
                Attachments:     await ReadAttachmentsAsync(attachments));
            var result = await _gmail.SaveDraftAsync(email, req);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("drafts/{draftId}/send")]
    public async Task<IActionResult> SendDraft(string draftId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try { return Ok(await _gmail.SendDraftAsync(email, draftId)); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    [HttpDelete("drafts/{draftId}")]
    public async Task<IActionResult> DeleteDraft(string draftId)
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try { await _gmail.DeleteDraftAsync(email, draftId); return NoContent(); }
        catch (Exception ex) { return StatusCode(500, new { error = ex.Message }); }
    }

    // GET /api/gmail/send-as
    // Returns the verified send-as addresses for the current user (used for "reply as" picker).
    [HttpGet("send-as")]
    public async Task<IActionResult> GetSendAsAddresses()
    {
        var email = CurrentUserEmail;
        if (string.IsNullOrEmpty(email)) return Unauthorized();
        if (!await _gmail.HasValidTokenAsync(email))
            return BadRequest(new { error = "Gmail not connected." });

        try
        {
            var addresses = await _gmail.GetSendAsAddressesAsync(email);
            return Ok(addresses);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    // Reads multipart attachment files into in-memory OutboundAttachment buffers.
    // Each file is bounded by RequestSizeLimit on the calling action.
    private static async Task<List<OutboundAttachment>> ReadAttachmentsAsync(IFormFileCollection? files)
    {
        var results = new List<OutboundAttachment>();
        if (files == null || files.Count == 0) return results;

        foreach (var f in files)
        {
            if (f.Length == 0) continue;
            using var ms = new MemoryStream();
            await f.CopyToAsync(ms);
            results.Add(new OutboundAttachment(
                FileName: Path.GetFileName(f.FileName),
                MimeType: string.IsNullOrEmpty(f.ContentType) ? "application/octet-stream" : f.ContentType,
                Content:  ms.ToArray()));
        }
        return results;
    }


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
