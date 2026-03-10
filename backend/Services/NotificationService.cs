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
    /// <summary>
    /// Extracts @mentions from the note text, creates Notification rows for any
    /// newly-added mentions, and pushes real-time SignalR messages to recipients.
    /// Pass <paramref name="oldNoteText"/> as null when the note is brand-new.
    /// </summary>
    Task DispatchMentionNotificationsAsync(
        EmailNote note,
        string?   oldNoteText,
        string    authorName);
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
        n.RelatedMessageId, n.RelatedNoteId);
}
