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
[Route("api/email-notes")]
[Authorize]
public class EmailNotesController : ControllerBase
{
    private readonly AppDbContext          _db;
    private readonly INotificationService  _notifications;

    public EmailNotesController(AppDbContext db, INotificationService notifications)
    {
        _db            = db;
        _notifications = notifications;
    }

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    private string CurrentUserName =>
        User.FindFirstValue(ClaimTypes.Name) ?? CurrentUserEmail;

    // GET /api/email-notes/{messageId}
    // Returns all notes for a given email, ordered by CreatedAt ascending.
    [HttpGet("{messageId}")]
    public async Task<IActionResult> GetNotes(string messageId)
    {
        var notes = await _db.EmailNotes
            .Where(n => n.MessageId == messageId)
            .OrderBy(n => n.CreatedAt)
            .Select(n => ToDto(n))
            .ToListAsync();

        return Ok(notes);
    }

    // GET /api/email-notes/counts?messageIds=a,b,c
    // Returns a map of messageId → note count for the given message IDs.
    [HttpGet("counts")]
    public async Task<IActionResult> GetCounts([FromQuery] string messageIds)
    {
        var ids = messageIds.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
        if (ids.Count == 0) return Ok(new Dictionary<string, int>());

        var counts = await _db.EmailNotes
            .Where(n => ids.Contains(n.MessageId))
            .GroupBy(n => n.MessageId)
            .Select(g => new { MessageId = g.Key, Count = g.Count() })
            .ToListAsync();

        var result = counts.ToDictionary(x => x.MessageId, x => x.Count);
        return Ok(result);
    }

    // POST /api/email-notes/{messageId}
    // Creates a new note for the given email.
    [HttpPost("{messageId}")]
    public async Task<IActionResult> CreateNote(
        string messageId, [FromBody] CreateEmailNoteRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NoteText))
            return BadRequest(new { error = "NoteText cannot be empty." });

        var userEmail = CurrentUserEmail;
        if (string.IsNullOrEmpty(userEmail)) return Unauthorized();

        var now = DateTime.UtcNow;
        var note = new EmailNote
        {
            MessageId = messageId,
            UserEmail = userEmail,
            NoteText  = req.NoteText.Trim(),
            CreatedAt = now,
            UpdatedAt = now,
        };

        _db.EmailNotes.Add(note);
        await _db.SaveChangesAsync();

        // Dispatch mention notifications for any @emails in the new note
        await _notifications.DispatchMentionNotificationsAsync(note, null, CurrentUserName);

        return Ok(ToDto(note));
    }

    // PUT /api/email-notes/{noteId}
    // Updates note text. 403 if the current user is not the author.
    [HttpPut("{noteId:int}")]
    public async Task<IActionResult> UpdateNote(
        int noteId, [FromBody] UpdateEmailNoteRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NoteText))
            return BadRequest(new { error = "NoteText cannot be empty." });

        var note = await _db.EmailNotes.FindAsync(noteId);
        if (note == null) return NotFound();

        if (note.UserEmail != CurrentUserEmail)
            return Forbid();

        var oldNoteText = note.NoteText;
        note.NoteText   = req.NoteText.Trim();
        note.UpdatedAt  = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Only notify for mentions that are new compared to the previous text
        await _notifications.DispatchMentionNotificationsAsync(note, oldNoteText, CurrentUserName);

        return Ok(ToDto(note));
    }

    // DELETE /api/email-notes/{noteId}
    // Deletes a note. 403 if the current user is not the author.
    [HttpDelete("{noteId:int}")]
    public async Task<IActionResult> DeleteNote(int noteId)
    {
        var note = await _db.EmailNotes.FindAsync(noteId);
        if (note == null) return NotFound();

        if (note.UserEmail != CurrentUserEmail)
            return Forbid();

        _db.EmailNotes.Remove(note);
        await _db.SaveChangesAsync();

        return NoContent();
    }

    // ── Mapping helper ─────────────────────────────────────────────────────────

    private static EmailNoteDto ToDto(EmailNote n) => new(
        n.Id, n.MessageId, n.UserEmail, n.NoteText, n.CreatedAt, n.UpdatedAt);
}
