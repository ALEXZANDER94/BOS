using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _db;

    public NotificationsController(AppDbContext db)
    {
        _db = db;
    }

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // GET /api/notifications
    // Returns all notifications for the current user, newest first.
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var notifications = await _db.Notifications
            .Where(n => n.RecipientEmail == CurrentUserEmail)
            .OrderByDescending(n => n.CreatedAt)
            .Select(n => ToDto(n))
            .ToListAsync();

        return Ok(notifications);
    }

    // GET /api/notifications/unread-count
    // Returns the number of unread notifications for the current user.
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount()
    {
        var count = await _db.Notifications
            .CountAsync(n => n.RecipientEmail == CurrentUserEmail && !n.IsRead);

        return Ok(new { count });
    }

    // PUT /api/notifications/{id}/read
    // Marks a single notification as read.
    [HttpPut("{id:int}/read")]
    public async Task<IActionResult> MarkRead(int id)
    {
        var notification = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == id && n.RecipientEmail == CurrentUserEmail);

        if (notification == null) return NotFound();

        notification.IsRead = true;
        await _db.SaveChangesAsync();

        return Ok(ToDto(notification));
    }

    // PUT /api/notifications/read-all
    // Marks all notifications for the current user as read.
    [HttpPut("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        await _db.Notifications
            .Where(n => n.RecipientEmail == CurrentUserEmail && !n.IsRead)
            .ExecuteUpdateAsync(s => s.SetProperty(n => n.IsRead, true));

        return NoContent();
    }

    // ── Mapping helper ─────────────────────────────────────────────────────────

    private static NotificationDto ToDto(Notification n) => new(
        n.Id, n.Type, n.Title, n.Body,
        n.IsRead, n.CreatedAt,
        n.RelatedMessageId, n.RelatedNoteId, n.RelatedTicketId,
        n.RelatedProposalId);
}
