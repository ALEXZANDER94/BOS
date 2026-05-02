using System.Text.RegularExpressions;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Hubs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface INotificationService
{
    Task DispatchMentionNotificationsAsync(
        EmailNote note,
        string?   oldNoteText,
        string    authorName);

    /// <summary>
    /// Sends a single notification to one recipient and pushes it in real-time via SignalR.
    /// </summary>
    Task SendAsync(
        string  recipientEmail,
        string  type,
        string  title,
        string  body,
        int?    relatedTicketId   = null,
        string? relatedMessageId  = null,
        int?    relatedProposalId = null);

    /// <summary>
    /// Extracts @mentions from a ticket comment body, adds those users as watchers,
    /// and dispatches mention notifications for newly-added mentions.
    /// </summary>
    Task DispatchTicketCommentMentionsAsync(
        int     ticketId,
        int     commentId,
        string  newBody,
        string? oldBody,
        string  authorEmail,
        string  ticketTitle);
}

public class NotificationService : INotificationService
{
    // Matches @email@domain.tld — a full email address prefixed with @
    private static readonly Regex MentionRegex =
        new(@"@([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})", RegexOptions.Compiled);

    private readonly AppDbContext                  _db;
    private readonly IHubContext<NotificationHub>  _hub;

    public NotificationService(AppDbContext db, IHubContext<NotificationHub> hub)
    {
        _db  = db;
        _hub = hub;
    }

    public async Task DispatchMentionNotificationsAsync(
        EmailNote note,
        string?   oldNoteText,
        string    authorName)
    {
        var newMentions = ExtractMentions(note.NoteText);
        var oldMentions = oldNoteText != null
            ? ExtractMentions(oldNoteText)
            : (IReadOnlySet<string>)new HashSet<string>();

        // Only dispatch for mentions that are new in this version of the note
        var addedMentions = newMentions
            .Except(oldMentions, StringComparer.OrdinalIgnoreCase)
            .Where(m => !string.Equals(m, note.UserEmail, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (addedMentions.Count == 0) return;

        var authorDisplay = string.IsNullOrWhiteSpace(authorName) ? note.UserEmail : authorName;
        var now           = DateTime.UtcNow;

        foreach (var recipientEmail in addedMentions)
        {
            var notification = new Notification
            {
                RecipientEmail   = recipientEmail,
                Type             = "mention",
                Title            = "You were mentioned in a note",
                Body             = $"{authorDisplay} mentioned you in a note",
                IsRead           = false,
                CreatedAt        = now,
                RelatedMessageId = note.MessageId,
                RelatedNoteId    = note.Id,
            };

            _db.Notifications.Add(notification);
            await _db.SaveChangesAsync();

            var dto = ToDto(notification);

            // Push real-time notification to the recipient if they are connected
            await _hub.Clients
                .User(recipientEmail)
                .SendAsync("notification", dto);
        }
    }

    public async Task SendAsync(
        string  recipientEmail,
        string  type,
        string  title,
        string  body,
        int?    relatedTicketId   = null,
        string? relatedMessageId  = null,
        int?    relatedProposalId = null)
    {
        var notification = new Notification
        {
            RecipientEmail    = recipientEmail,
            Type              = type,
            Title             = title,
            Body              = body,
            IsRead            = false,
            CreatedAt         = DateTime.UtcNow,
            RelatedTicketId   = relatedTicketId,
            RelatedMessageId  = relatedMessageId,
            RelatedProposalId = relatedProposalId,
        };

        _db.Notifications.Add(notification);
        await _db.SaveChangesAsync();

        await _hub.Clients
            .User(recipientEmail)
            .SendAsync("notification", ToDto(notification));
    }

    public async Task DispatchTicketCommentMentionsAsync(
        int     ticketId,
        int     commentId,
        string  newBody,
        string? oldBody,
        string  authorEmail,
        string  ticketTitle)
    {
        var newMentions = ExtractMentions(newBody);
        var oldMentions = oldBody != null ? ExtractMentions(oldBody) : (IReadOnlySet<string>)new HashSet<string>();

        var addedMentions = newMentions
            .Except(oldMentions, StringComparer.OrdinalIgnoreCase)
            .Where(m => !string.Equals(m, authorEmail, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (addedMentions.Count == 0) return;

        // Add mentioned users as watchers if not already watching
        var existingWatchers = await _db.TicketWatchers
            .Where(w => w.TicketId == ticketId)
            .Select(w => w.UserEmail.ToLower())
            .ToListAsync();

        foreach (var email in addedMentions)
        {
            if (!existingWatchers.Contains(email.ToLower()))
            {
                _db.TicketWatchers.Add(new Models.TicketWatcher { TicketId = ticketId, UserEmail = email });
            }

            await SendAsync(
                email,
                "ticket_mention",
                $"You were mentioned in a ticket comment",
                $"{authorEmail} mentioned you in a comment on \"{ticketTitle}\"",
                relatedTicketId: ticketId);
        }

        await _db.SaveChangesAsync();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static IReadOnlySet<string> ExtractMentions(string text)
    {
        var matches = MentionRegex.Matches(text);
        return matches
            .Select(m => m.Groups[1].Value.ToLowerInvariant())
            .ToHashSet();
    }

    private static NotificationDto ToDto(Notification n) => new(
        n.Id, n.Type, n.Title, n.Body,
        n.IsRead, n.CreatedAt,
        n.RelatedMessageId, n.RelatedNoteId, n.RelatedTicketId,
        n.RelatedProposalId);
}
