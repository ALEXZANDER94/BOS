using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/canned-responses")]
[Authorize]
public class CannedResponsesController : ControllerBase
{
    private readonly AppDbContext                     _db;
    private readonly ICannedResponseAttachmentService _attachments;

    public CannedResponsesController(AppDbContext db, ICannedResponseAttachmentService attachments)
    {
        _db          = db;
        _attachments = attachments;
    }

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // ── Categories ───────────────────────────────────────────────────────────

    [HttpGet("categories")]
    public async Task<IActionResult> ListCategories()
    {
        var cats = await _db.CannedResponseCategories
            .OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new CannedResponseCategoryDto(
                c.Id, c.Name, c.SortOrder, c.Responses.Count))
            .ToListAsync();
        return Ok(cats);
    }

    [HttpPost("categories")]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCannedResponseCategoryRequest req)
    {
        var cat = new CannedResponseCategory
        {
            Name               = req.Name.Trim(),
            SortOrder          = req.SortOrder,
            CreatedByUserEmail = CurrentUserEmail,
            CreatedAt          = DateTime.UtcNow,
        };
        _db.CannedResponseCategories.Add(cat);
        await _db.SaveChangesAsync();
        return Ok(new CannedResponseCategoryDto(cat.Id, cat.Name, cat.SortOrder, 0));
    }

    [HttpPut("categories/{id:int}")]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateCannedResponseCategoryRequest req)
    {
        var cat = await _db.CannedResponseCategories.FindAsync(id);
        if (cat == null) return NotFound();
        cat.Name      = req.Name.Trim();
        cat.SortOrder = req.SortOrder;
        await _db.SaveChangesAsync();
        var count = await _db.CannedResponses.CountAsync(r => r.CategoryId == id);
        return Ok(new CannedResponseCategoryDto(cat.Id, cat.Name, cat.SortOrder, count));
    }

    [HttpDelete("categories/{id:int}")]
    public async Task<IActionResult> DeleteCategory(int id)
    {
        var cat = await _db.CannedResponseCategories.FindAsync(id);
        if (cat == null) return NotFound();
        _db.CannedResponseCategories.Remove(cat);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Responses ────────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> ListResponses()
    {
        // All responses are org-shared — every signed-in user sees every response.
        var responses = await _db.CannedResponses
            .Include(r => r.Category)
            .Include(r => r.Attachments)
            .OrderBy(r => r.Category.SortOrder).ThenBy(r => r.Category.Name).ThenBy(r => r.Name)
            .ToListAsync();

        return Ok(responses.Select(ToDto));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetResponse(int id)
    {
        var r = await _db.CannedResponses
            .Include(r => r.Category)
            .Include(r => r.Attachments)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (r == null) return NotFound();
        return Ok(ToDto(r));
    }

    [HttpPost]
    public async Task<IActionResult> CreateResponse([FromBody] CreateCannedResponseRequest req)
    {
        if (!await _db.CannedResponseCategories.AnyAsync(c => c.Id == req.CategoryId))
            return BadRequest(new { error = "Category not found." });

        var now = DateTime.UtcNow;
        var r = new CannedResponse
        {
            CategoryId         = req.CategoryId,
            Name               = req.Name.Trim(),
            Subject            = req.Subject?.Trim(),
            BodyHtml           = req.BodyHtml,
            DefaultTo          = NormalizeRecipients(req.DefaultTo),
            DefaultCc          = NormalizeRecipients(req.DefaultCc),
            DefaultBcc         = NormalizeRecipients(req.DefaultBcc),
            CreatedByUserEmail = CurrentUserEmail,
            CreatedAt          = now,
            UpdatedAt          = now,
        };
        _db.CannedResponses.Add(r);
        await _db.SaveChangesAsync();

        // Reload with navigation props for DTO mapping
        await _db.Entry(r).Reference(x => x.Category).LoadAsync();
        return Ok(ToDto(r));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateResponse(int id, [FromBody] UpdateCannedResponseRequest req)
    {
        var r = await _db.CannedResponses
            .Include(r => r.Category)
            .Include(r => r.Attachments)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (r == null) return NotFound();

        // Any signed-in user may edit any shared response (org-shared model).
        r.CategoryId = req.CategoryId;
        r.Name       = req.Name.Trim();
        r.Subject    = req.Subject?.Trim();
        r.BodyHtml   = req.BodyHtml;
        r.DefaultTo  = NormalizeRecipients(req.DefaultTo);
        r.DefaultCc  = NormalizeRecipients(req.DefaultCc);
        r.DefaultBcc = NormalizeRecipients(req.DefaultBcc);
        r.UpdatedAt  = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Refresh category in case CategoryId changed
        if (r.Category.Id != r.CategoryId)
            await _db.Entry(r).Reference(x => x.Category).LoadAsync();

        return Ok(ToDto(r));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteResponse(int id)
    {
        var r = await _db.CannedResponses
            .Include(r => r.Attachments)
            .FirstOrDefaultAsync(r => r.Id == id);
        if (r == null) return NotFound();

        // Delete attachment files from disk before EF cascade-deletes the rows.
        foreach (var att in r.Attachments)
            await _attachments.DeleteAsync(att.Id);

        _db.CannedResponses.Remove(r);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Attachments ──────────────────────────────────────────────────────────

    [HttpPost("{id:int}/attachments")]
    [RequestSizeLimit(27_000_000)] // slightly above 25 MB for envelope overhead
    public async Task<IActionResult> UploadAttachment(int id, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest("No file provided.");

        try
        {
            var dto = await _attachments.UploadAsync(id, file, CurrentUserEmail);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound("Canned response not found.");
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpGet("attachments/{attachmentId:int}")]
    public async Task<IActionResult> DownloadAttachment(int attachmentId)
    {
        var result = await _attachments.DownloadAsync(attachmentId);
        if (result is null) return NotFound();

        var (stream, contentType, fileName) = result.Value;

        Response.Headers.Append("X-Robots-Tag", "noindex, nofollow, noarchive");
        Response.Headers.Append("Cache-Control",  "no-store");

        return File(stream, contentType, fileName, enableRangeProcessing: false);
    }

    [HttpDelete("attachments/{attachmentId:int}")]
    public async Task<IActionResult> DeleteAttachment(int attachmentId)
    {
        var ok = await _attachments.DeleteAsync(attachmentId);
        if (!ok) return NotFound();
        return NoContent();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string? NormalizeRecipients(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return null;
        return raw.Trim();
    }

    private static CannedResponseDto ToDto(CannedResponse r) => new(
        r.Id,
        r.CategoryId,
        r.Category?.Name ?? "",
        r.Name,
        r.Subject,
        r.BodyHtml,
        r.DefaultTo,
        r.DefaultCc,
        r.DefaultBcc,
        r.CreatedByUserEmail,
        r.CreatedAt,
        r.UpdatedAt,
        r.Attachments
            .OrderBy(a => a.UploadedAt)
            .Select(CannedResponseAttachmentService.ToDto)
            .ToList());
}
