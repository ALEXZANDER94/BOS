using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly IAppSettingsService _settings;
    public AdminController(IAppSettingsService settings) => _settings = settings;

    private string CurrentEmail => User.FindFirstValue(ClaimTypes.Email) ?? "";

    public record AdminNoticeDto(string Message);
    public record UpdateAdminNoticeRequest(string Message);

    // Anyone authenticated can read the notice — it's the org-wide announcement
    // shown on the dashboard. Returns an empty string when nothing is set.
    [HttpGet("notice")]
    public async Task<IActionResult> GetNotice()
    {
        var msg = await _settings.GetAsync(AppSettingsService.AdminNoticeKey) ?? "";
        return Ok(new AdminNoticeDto(msg));
    }

    // Only admins (email present in AppSettings AdminEmails) may update the notice.
    [HttpPut("notice")]
    public async Task<IActionResult> UpdateNotice([FromBody] UpdateAdminNoticeRequest req)
    {
        var isAdmin = await _settings.IsAdminAsync(CurrentEmail);
        if (!isAdmin) return Forbid();

        // Empty string is allowed and clears the notice on the dashboard.
        var trimmed = (req.Message ?? "").Trim();
        await _settings.SetAsync(AppSettingsService.AdminNoticeKey, trimmed);
        return Ok(new AdminNoticeDto(trimmed));
    }

    public record NotesRepairResult(
        int    Scanned,
        int    Resolved,
        int    Skipped,
        string Message);

    // Repairs EmailNotes that were saved under a per-user Gmail local message ID rather than
    // the stable RFC 2822 Message-ID. Looks up each candidate's RFC ID via the author's Gmail
    // token and rewrites the MessageId field; collisions with existing RFC-keyed notes are
    // fine — they simply reunify under one key. Safe to run more than once: subsequent runs
    // find nothing to migrate because the candidate filter requires the MessageId not to
    // contain '@' (a mandatory RFC Message-ID character).
    [HttpPost("repair/email-notes")]
    public async Task<IActionResult> RepairEmailNotes(
        [FromServices] AppDbContext  db,
        [FromServices] IGmailService gmail)
    {
        if (!await _settings.IsAdminAsync(CurrentEmail)) return Forbid();

        // RFC 2822 Message-IDs always contain '@'; Gmail local IDs are hex. Candidates are
        // notes whose MessageId lacks '@' — those are the shards we need to migrate.
        var candidates = await db.EmailNotes
            .Where(n => !n.MessageId.Contains("@"))
            .ToListAsync();

        // Cache resolutions so we only hit the Gmail API once per distinct (localId, author).
        var cache    = new Dictionary<(string gmailId, string userEmail), string?>();
        var scanned  = candidates.Count;
        var resolved = 0;
        var skipped  = 0;

        foreach (var note in candidates)
        {
            var key = (note.MessageId, note.UserEmail);
            if (!cache.TryGetValue(key, out var rfcId))
            {
                try
                {
                    rfcId = await gmail.GetRfcMessageIdAsync(note.UserEmail, note.MessageId);
                }
                catch
                {
                    // Missing/expired token, message deleted from Gmail, etc. — the note stays
                    // keyed by its Gmail local ID and is counted as skipped.
                    rfcId = null;
                }
                cache[key] = rfcId;
            }

            if (!string.IsNullOrEmpty(rfcId))
            {
                note.MessageId = rfcId!;
                note.UpdatedAt = DateTime.UtcNow;
                resolved++;
            }
            else
            {
                skipped++;
            }
        }

        if (resolved > 0) await db.SaveChangesAsync();

        var message = resolved > 0
            ? $"Merged {resolved} note(s) under their RFC Message-IDs. {skipped} could not be resolved."
            : scanned == 0
                ? "Nothing to migrate — all notes are already keyed by RFC Message-ID."
                : $"No notes were migrated. {skipped} candidate(s) could not be resolved (Gmail token missing or message no longer in mailbox).";

        return Ok(new NotesRepairResult(scanned, resolved, skipped, message));
    }
}
