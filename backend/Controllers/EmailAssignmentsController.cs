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
[Route("api/email-assignments")]
[Authorize]
public class EmailAssignmentsController : ControllerBase
{
    private readonly AppDbContext   _db;
    private readonly IGmailService  _gmail;

    public EmailAssignmentsController(AppDbContext db, IGmailService gmail)
    {
        _db    = db;
        _gmail = gmail;
    }

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // GET /api/email-assignments/batch?messageIds=a,b,c
    // Returns assignments for a set of message IDs (used to decorate the email list).
    [HttpGet("batch")]
    public async Task<IActionResult> GetBatch([FromQuery] string messageIds)
    {
        var ids = messageIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
        if (ids.Count == 0) return Ok(Array.Empty<EmailAssignmentDto>());

        var assignments = await _db.EmailAssignments
            .Include(a => a.Category)
            .Include(a => a.Status)
            .Where(a => ids.Contains(a.MessageId))
            .ToListAsync();

        return Ok(assignments.Select(ToDto));
    }

    // GET /api/email-assignments/by-category/{categoryId}
    // Returns Gmail email summaries for all messages assigned to a given category.
    [HttpGet("by-category/{categoryId:int}")]
    public async Task<IActionResult> GetByCategory(int categoryId)
    {
        var userEmail = CurrentUserEmail;
        if (string.IsNullOrEmpty(userEmail)) return Unauthorized();

        if (!await _gmail.HasValidTokenAsync(userEmail))
            return BadRequest(new { error = "Gmail not connected." });

        var messageIds = await _db.EmailAssignments
            .Where(a => a.CategoryId == categoryId)
            .Select(a => a.MessageId)
            .ToListAsync();

        if (messageIds.Count == 0)
            return Ok(new { emails = Array.Empty<object>(), assignments = Array.Empty<object>() });

        var emails      = await _gmail.GetEmailsByIdsAsync(userEmail, messageIds);
        var assignments = await _db.EmailAssignments
            .Include(a => a.Category)
            .Include(a => a.Status)
            .Where(a => messageIds.Contains(a.MessageId))
            .ToListAsync();

        return Ok(new
        {
            emails      = emails,
            assignments = assignments.Select(ToDto),
        });
    }

    // PUT /api/email-assignments/{messageId}
    // Upserts the category (and optional status) assignment for an email.
    [HttpPut("{messageId}")]
    public async Task<IActionResult> Upsert(
        string messageId, [FromBody] UpsertEmailAssignmentRequest req)
    {
        var userEmail = CurrentUserEmail;

        var existing = await _db.EmailAssignments
            .FirstOrDefaultAsync(a => a.MessageId == messageId);

        if (existing != null)
        {
            existing.CategoryId          = req.CategoryId;
            existing.StatusId            = req.StatusId;
            existing.AssignedByUserEmail = userEmail;
            existing.AssignedAt          = DateTime.UtcNow;
        }
        else
        {
            _db.EmailAssignments.Add(new EmailAssignment
            {
                MessageId           = messageId,
                CategoryId          = req.CategoryId,
                StatusId            = req.StatusId,
                AssignedByUserEmail = userEmail,
            });
        }

        await _db.SaveChangesAsync();

        var saved = await _db.EmailAssignments
            .Include(a => a.Category)
            .Include(a => a.Status)
            .FirstAsync(a => a.MessageId == messageId);

        return Ok(ToDto(saved));
    }

    // PATCH /api/email-assignments/{messageId}/status
    // Updates only the status of an existing assignment.
    [HttpPatch("{messageId}/status")]
    public async Task<IActionResult> PatchStatus(
        string messageId, [FromBody] PatchEmailAssignmentStatusRequest req)
    {
        var assignment = await _db.EmailAssignments
            .Include(a => a.Category)
            .Include(a => a.Status)
            .FirstOrDefaultAsync(a => a.MessageId == messageId);

        if (assignment == null) return NotFound();

        assignment.StatusId            = req.StatusId;
        assignment.AssignedByUserEmail = CurrentUserEmail;
        assignment.AssignedAt          = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Reload navigation properties after save
        await _db.Entry(assignment).Reference(a => a.Status).LoadAsync();
        return Ok(ToDto(assignment));
    }

    // DELETE /api/email-assignments/{messageId}
    // Removes the category assignment from an email (makes it uncategorized).
    [HttpDelete("{messageId}")]
    public async Task<IActionResult> Delete(string messageId)
    {
        var assignment = await _db.EmailAssignments
            .FirstOrDefaultAsync(a => a.MessageId == messageId);

        if (assignment == null) return NotFound();

        _db.EmailAssignments.Remove(assignment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Mapping helper ────────────────────────────────────────────────────────

    private static EmailAssignmentDto ToDto(EmailAssignment a) => new(
        a.Id,
        a.MessageId,
        a.CategoryId,
        a.Category.Name,
        a.Category.Color,
        a.StatusId,
        a.Status?.Name,
        a.Status?.Color,
        a.AssignedByUserEmail,
        a.AssignedAt);
}
