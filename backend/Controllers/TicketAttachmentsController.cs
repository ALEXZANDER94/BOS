using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/tickets")]
public class TicketAttachmentsController : ControllerBase
{
    private readonly ITicketAttachmentService _attachments;
    public TicketAttachmentsController(ITicketAttachmentService attachments)
        => _attachments = attachments;

    private string CurrentEmail => User.FindFirstValue(ClaimTypes.Email)!;

    // ── Upload ────────────────────────────────────────────────────────────────

    [HttpPost("{ticketId:int}/attachments")]
    [RequestSizeLimit(22_000_000)] // slightly above 20 MB for envelope overhead
    public async Task<IActionResult> Upload(int ticketId, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file provided.");

        try
        {
            var dto = await _attachments.UploadAsync(ticketId, file, CurrentEmail);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound("Ticket not found.");
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // ── Download ──────────────────────────────────────────────────────────────

    [HttpGet("attachments/{attachmentId:int}")]
    public async Task<IActionResult> Download(int attachmentId)
    {
        var result = await _attachments.DownloadAsync(attachmentId);
        if (result is null) return NotFound();

        var (stream, contentType, fileName) = result.Value;

        // Prevent search-engine indexing and caching of sensitive files
        Response.Headers.Append("X-Robots-Tag", "noindex, nofollow, noarchive");
        Response.Headers.Append("Cache-Control",  "no-store");

        // Inline for images/PDFs, attachment (force download) for everything else
        var isInline = contentType.StartsWith("image/") || contentType == "application/pdf";
        var disposition = isInline ? "inline" : "attachment";

        return File(stream, contentType, fileName,
            enableRangeProcessing: false);
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [HttpDelete("attachments/{attachmentId:int}")]
    public async Task<IActionResult> Delete(int attachmentId)
    {
        var ok = await _attachments.DeleteAsync(attachmentId, CurrentEmail);
        if (!ok) return NotFound();
        return NoContent();
    }
}
