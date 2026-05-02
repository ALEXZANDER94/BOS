using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface ITicketService
{
    // Categories
    Task<List<TicketCategoryDto>>  GetCategoriesAsync();
    Task<TicketCategoryDto>        CreateCategoryAsync(CreateTicketCategoryRequest req);
    Task<TicketCategoryDto?>       UpdateCategoryAsync(int id, UpdateTicketCategoryRequest req);
    Task<bool>                     DeleteCategoryAsync(int id);

    // Statuses
    Task<List<TicketStatusDto>>    GetStatusesAsync();
    Task<TicketStatusDto>          CreateStatusAsync(CreateTicketStatusRequest req);
    Task<TicketStatusDto?>         UpdateStatusAsync(int id, UpdateTicketStatusRequest req);
    Task<bool>                     DeleteStatusAsync(int id);

    // Tickets
    Task<(List<TicketSummaryDto> Items, int TotalCount)> ListAsync(TicketListFilter filter, int page, int pageSize);
    Task<List<TicketSummaryDto>>   ListByLinkedEmailAsync(string messageId);
    Task<TicketDetailDto?>         GetByIdAsync(int id, string currentUserEmail);
    Task<TicketDetailDto>          CreateAsync(CreateTicketRequest req, string createdByEmail);
    Task<TicketDetailDto?>         UpdateAsync(int id, UpdateTicketRequest req, string updatedByEmail);
    Task<bool>                     DeleteAsync(int id, string requestingEmail);

    // Comments
    Task<TicketCommentDto>         AddCommentAsync(int ticketId, CreateTicketCommentRequest req, string authorEmail);
    Task<TicketCommentDto?>        UpdateCommentAsync(int ticketId, int commentId, UpdateTicketCommentRequest req, string requestingEmail);
    Task<bool>                     DeleteCommentAsync(int ticketId, int commentId, string requestingEmail);

    // History
    Task<List<TicketHistoryDto>>   GetHistoryAsync(int ticketId);

    // Watchers
    Task<bool>                     WatchAsync(int ticketId, string userEmail);
    Task<bool>                     UnwatchAsync(int ticketId, string userEmail);

    // Admin + Stats
    Task<bool>                     IsAdminAsync(string email);
    Task<TicketStatsDto>           GetStatsAsync(string userEmail);
    Task<DashboardDto>             GetDashboardAsync(string userEmail);
}

public record TicketListFilter(
    string?   Search,
    string?   Priority,
    int?      CategoryId,
    int?      StatusId,
    bool?     ShowClosed,
    string?   AssignedToEmail,
    int?      ProjectId,
    DateTime? CreatedAfter,
    DateTime? CreatedBefore,
    bool      MyTickets,
    string    CurrentUserEmail);

public class TicketService : ITicketService
{
    private static readonly Regex MentionRegex =
        new(@"@([\w.+-]+@[\w.-]+\.[a-zA-Z]{2,})", RegexOptions.Compiled);

    private readonly AppDbContext          _db;
    private readonly INotificationService  _notifications;
    private readonly IAppSettingsService   _settings;

    public TicketService(AppDbContext db, INotificationService notifications, IAppSettingsService settings)
    {
        _db            = db;
        _notifications = notifications;
        _settings      = settings;
    }

    // ── Admin check ───────────────────────────────────────────────────────────

    public async Task<bool> IsAdminAsync(string email)
    {
        var adminEmails = await _settings.GetAsync(AppSettingsService.AdminEmailsKey) ?? "";
        return adminEmails
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Any(e => string.Equals(e, email, StringComparison.OrdinalIgnoreCase));
    }

    // ── Categories ────────────────────────────────────────────────────────────

    public async Task<List<TicketCategoryDto>> GetCategoriesAsync()
        => await _db.TicketCategories
            .OrderBy(c => c.Name)
            .Select(c => new TicketCategoryDto(c.Id, c.Name, c.Color))
            .ToListAsync();

    public async Task<TicketCategoryDto> CreateCategoryAsync(CreateTicketCategoryRequest req)
    {
        var cat = new TicketCategory { Name = req.Name.Trim(), Color = req.Color };
        _db.TicketCategories.Add(cat);
        await _db.SaveChangesAsync();
        return new TicketCategoryDto(cat.Id, cat.Name, cat.Color);
    }

    public async Task<TicketCategoryDto?> UpdateCategoryAsync(int id, UpdateTicketCategoryRequest req)
    {
        var cat = await _db.TicketCategories.FindAsync(id);
        if (cat is null) return null;
        cat.Name  = req.Name.Trim();
        cat.Color = req.Color;
        await _db.SaveChangesAsync();
        return new TicketCategoryDto(cat.Id, cat.Name, cat.Color);
    }

    public async Task<bool> DeleteCategoryAsync(int id)
    {
        var cat = await _db.TicketCategories.FindAsync(id);
        if (cat is null) return false;
        _db.TicketCategories.Remove(cat);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Statuses ──────────────────────────────────────────────────────────────

    public async Task<List<TicketStatusDto>> GetStatusesAsync()
        => await _db.TicketStatuses
            .OrderBy(s => s.DisplayOrder)
            .ThenBy(s => s.Name)
            .Select(s => new TicketStatusDto(s.Id, s.Name, s.Color, s.IsDefault, s.IsClosed, s.DisplayOrder))
            .ToListAsync();

    public async Task<TicketStatusDto> CreateStatusAsync(CreateTicketStatusRequest req)
    {
        // If this is the first status or marked default, ensure uniqueness
        if (req.IsDefault)
            await ClearDefaultStatusAsync();

        var maxOrder = await _db.TicketStatuses.MaxAsync(s => (int?)s.DisplayOrder) ?? -1;
        var status = new TicketStatus
        {
            Name         = req.Name.Trim(),
            Color        = req.Color,
            IsDefault    = req.IsDefault,
            IsClosed     = req.IsClosed,
            DisplayOrder = maxOrder + 1,
        };
        _db.TicketStatuses.Add(status);
        await _db.SaveChangesAsync();
        return ToStatusDto(status);
    }

    public async Task<TicketStatusDto?> UpdateStatusAsync(int id, UpdateTicketStatusRequest req)
    {
        var status = await _db.TicketStatuses.FindAsync(id);
        if (status is null) return null;

        if (req.IsDefault && !status.IsDefault)
            await ClearDefaultStatusAsync();

        status.Name         = req.Name.Trim();
        status.Color        = req.Color;
        status.IsDefault    = req.IsDefault;
        status.IsClosed     = req.IsClosed;
        status.DisplayOrder = req.DisplayOrder;
        await _db.SaveChangesAsync();
        return ToStatusDto(status);
    }

    public async Task<bool> DeleteStatusAsync(int id)
    {
        var status = await _db.TicketStatuses.FindAsync(id);
        if (status is null) return false;
        var inUse = await _db.Tickets.AnyAsync(t => t.StatusId == id);
        if (inUse) return false; // Can't delete a status in use
        _db.TicketStatuses.Remove(status);
        await _db.SaveChangesAsync();
        return true;
    }

    private async Task ClearDefaultStatusAsync()
    {
        var existing = await _db.TicketStatuses.Where(s => s.IsDefault).ToListAsync();
        foreach (var s in existing) s.IsDefault = false;
        await _db.SaveChangesAsync();
    }

    // ── Tickets — list ────────────────────────────────────────────────────────

    public async Task<(List<TicketSummaryDto> Items, int TotalCount)> ListAsync(
        TicketListFilter filter, int page, int pageSize)
    {
        var query = _db.Tickets
            .Include(t => t.Category)
            .Include(t => t.Status)
            .Include(t => t.Project)
            .AsQueryable();

        // Closed / open filter
        if (filter.ShowClosed == true)
            query = query.Where(t => t.Status.IsClosed);
        else if (filter.ShowClosed == false || filter.ShowClosed == null)
            query = query.Where(t => !t.Status.IsClosed);

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var lower = filter.Search.Trim().ToLower();
            query = query.Where(t =>
                t.Title.ToLower().Contains(lower) ||
                t.Description.ToLower().Contains(lower));
        }

        if (!string.IsNullOrWhiteSpace(filter.Priority))
            query = query.Where(t => t.Priority == filter.Priority);

        if (filter.CategoryId.HasValue)
            query = query.Where(t => t.CategoryId == filter.CategoryId.Value);

        if (filter.StatusId.HasValue)
            query = query.Where(t => t.StatusId == filter.StatusId.Value);

        if (!string.IsNullOrWhiteSpace(filter.AssignedToEmail))
            query = query.Where(t => t.AssignedToEmail == filter.AssignedToEmail);

        if (filter.ProjectId.HasValue)
            query = query.Where(t => t.ProjectId == filter.ProjectId.Value);

        if (filter.CreatedAfter.HasValue)
            query = query.Where(t => t.CreatedAt >= filter.CreatedAfter.Value);

        if (filter.CreatedBefore.HasValue)
            query = query.Where(t => t.CreatedAt <= filter.CreatedBefore.Value);

        if (filter.MyTickets)
            query = query.Where(t =>
                t.CreatedByEmail == filter.CurrentUserEmail ||
                t.AssignedToEmail == filter.CurrentUserEmail);

        var totalCount = await query.CountAsync();

        var tickets = await query
            .OrderByDescending(t => t.UpdatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        // Load comment + attachment counts
        var ids = tickets.Select(t => t.Id).ToList();
        var commentCounts = await _db.TicketComments
            .Where(c => ids.Contains(c.TicketId) && !c.IsDeleted)
            .GroupBy(c => c.TicketId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        var attachCounts = await _db.TicketAttachments
            .Where(a => ids.Contains(a.TicketId))
            .GroupBy(a => a.TicketId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        var now = DateTime.UtcNow.Date;
        var items = tickets.Select(t => ToSummaryDto(t, commentCounts, attachCounts, now)).ToList();
        return (items, totalCount);
    }

    // ── Tickets — list by linked email ────────────────────────────────────────

    public async Task<List<TicketSummaryDto>> ListByLinkedEmailAsync(string messageId)
    {
        if (string.IsNullOrWhiteSpace(messageId)) return new List<TicketSummaryDto>();

        var tickets = await _db.Tickets
            .Include(t => t.Category)
            .Include(t => t.Status)
            .Include(t => t.Project)
            .Where(t => t.LinkedEmailMessageId == messageId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        if (tickets.Count == 0) return new List<TicketSummaryDto>();

        var ids = tickets.Select(t => t.Id).ToList();
        var commentCounts = await _db.TicketComments
            .Where(c => ids.Contains(c.TicketId) && !c.IsDeleted)
            .GroupBy(c => c.TicketId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        var attachCounts = await _db.TicketAttachments
            .Where(a => ids.Contains(a.TicketId))
            .GroupBy(a => a.TicketId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        var now = DateTime.UtcNow.Date;
        return tickets.Select(t => ToSummaryDto(t, commentCounts, attachCounts, now)).ToList();
    }

    // ── Tickets — detail ──────────────────────────────────────────────────────

    public async Task<TicketDetailDto?> GetByIdAsync(int id, string currentUserEmail)
    {
        var ticket = await _db.Tickets
            .Include(t => t.Category)
            .Include(t => t.Status)
            .Include(t => t.Project)
            .Include(t => t.Comments)
            .Include(t => t.Watchers)
            .Include(t => t.Attachments)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket is null) return null;

        bool isAdmin   = await IsAdminAsync(currentUserEmail);
        bool isWatching = ticket.Watchers.Any(w =>
            string.Equals(w.UserEmail, currentUserEmail, StringComparison.OrdinalIgnoreCase));

        return ToDetailDto(ticket, currentUserEmail, isAdmin, isWatching);
    }

    // ── Tickets — create ──────────────────────────────────────────────────────

    public async Task<TicketDetailDto> CreateAsync(CreateTicketRequest req, string createdByEmail)
    {
        // Resolve status: use provided or default
        TicketStatus? status;
        if (req.StatusId.HasValue)
            status = await _db.TicketStatuses.FindAsync(req.StatusId.Value);
        else
            status = await _db.TicketStatuses.FirstOrDefaultAsync(s => s.IsDefault)
                  ?? await _db.TicketStatuses.OrderBy(s => s.DisplayOrder).FirstOrDefaultAsync();

        if (status is null)
            throw new InvalidOperationException("No ticket status is configured. Create at least one status first.");

        var ticket = new Ticket
        {
            Title                = req.Title.Trim(),
            Description          = req.Description?.Trim() ?? string.Empty,
            Priority             = req.Priority,
            CategoryId           = req.CategoryId,
            StatusId             = status.Id,
            CreatedByEmail       = createdByEmail,
            AssignedToEmail      = req.AssignedToEmail?.Trim().ToLowerInvariant(),
            ProjectId            = req.ProjectId,
            LinkedEmailMessageId = req.LinkedEmailMessageId,
            DueDate              = req.DueDate,
            CreatedAt            = DateTime.UtcNow,
            UpdatedAt            = DateTime.UtcNow,
        };

        _db.Tickets.Add(ticket);
        await _db.SaveChangesAsync();

        // Add creator as watcher
        await AddWatcherInternalAsync(ticket.Id, createdByEmail);

        // History entry
        await AddHistoryAsync(ticket.Id, createdByEmail, "Created", null, ticket.Title);

        // Notify assignee
        if (!string.IsNullOrEmpty(ticket.AssignedToEmail) &&
            !string.Equals(ticket.AssignedToEmail, createdByEmail, StringComparison.OrdinalIgnoreCase))
        {
            await AddWatcherInternalAsync(ticket.Id, ticket.AssignedToEmail);
            await _notifications.SendAsync(
                ticket.AssignedToEmail,
                "ticket_assigned",
                $"You were assigned to {FormatNumber(ticket.Id)}",
                $"{createdByEmail} assigned you to \"{ticket.Title}\"",
                relatedTicketId: ticket.Id);
        }

        return (await GetByIdAsync(ticket.Id, createdByEmail))!;
    }

    // ── Tickets — update ──────────────────────────────────────────────────────

    public async Task<TicketDetailDto?> UpdateAsync(int id, UpdateTicketRequest req, string updatedByEmail)
    {
        var ticket = await _db.Tickets
            .Include(t => t.Status)
            .Include(t => t.Watchers)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (ticket is null) return null;

        var oldStatus   = ticket.Status.Name;
        var oldAssignee = ticket.AssignedToEmail;
        var oldPriority = ticket.Priority;
        var oldCategory = ticket.CategoryId;
        var oldDueDate  = ticket.DueDate;
        var oldLink     = ticket.LinkedEmailMessageId;
        var oldProject  = ticket.ProjectId;

        // Apply changes
        ticket.Title                = req.Title.Trim();
        ticket.Description          = req.Description?.Trim() ?? string.Empty;
        ticket.Priority             = req.Priority;
        ticket.CategoryId           = req.CategoryId;
        ticket.AssignedToEmail      = req.AssignedToEmail?.Trim().ToLowerInvariant();
        ticket.ProjectId            = req.ProjectId;
        ticket.LinkedEmailMessageId = req.LinkedEmailMessageId;
        ticket.UpdatedAt            = DateTime.UtcNow;

        // Due date changed — reset overdue notification
        if (req.DueDate != oldDueDate)
        {
            ticket.DueDate           = req.DueDate;
            ticket.OverdueNotifiedAt = null;
        }

        // Status change
        if (req.StatusId != ticket.StatusId)
        {
            var newStatus = await _db.TicketStatuses.FindAsync(req.StatusId)
                ?? throw new InvalidOperationException("Invalid status.");
            ticket.StatusId = newStatus.Id;
            ticket.ClosedAt = newStatus.IsClosed ? DateTime.UtcNow : null;
            await AddHistoryAsync(id, updatedByEmail, "Status", oldStatus, newStatus.Name);
            await NotifyWatchersAsync(ticket, updatedByEmail, "ticket_status",
                $"Status changed to {newStatus.Name} on {FormatNumber(id)}",
                $"Status changed from \"{oldStatus}\" to \"{newStatus.Name}\" on \"{ticket.Title}\"");
        }

        if (req.Priority != oldPriority)
        {
            await AddHistoryAsync(id, updatedByEmail, "Priority", oldPriority, req.Priority);
            await NotifyWatchersAsync(ticket, updatedByEmail, "ticket_priority",
                $"Priority changed on {FormatNumber(id)}",
                $"Priority changed from {oldPriority} to {req.Priority} on \"{ticket.Title}\"");
        }

        if (req.AssignedToEmail != oldAssignee)
        {
            var newAssignee = req.AssignedToEmail;
            await AddHistoryAsync(id, updatedByEmail, "Assignee", oldAssignee, newAssignee);

            if (!string.IsNullOrEmpty(newAssignee) &&
                !string.Equals(newAssignee, updatedByEmail, StringComparison.OrdinalIgnoreCase))
            {
                await AddWatcherInternalAsync(id, newAssignee);
                await _notifications.SendAsync(
                    newAssignee,
                    "ticket_assigned",
                    $"You were assigned to {FormatNumber(id)}",
                    $"{updatedByEmail} assigned you to \"{ticket.Title}\"",
                    relatedTicketId: id);
            }
        }

        if (req.CategoryId != oldCategory)
        {
            var newCatName = req.CategoryId.HasValue
                ? (await _db.TicketCategories.FindAsync(req.CategoryId.Value))?.Name
                : null;
            var oldCatName = oldCategory.HasValue
                ? (await _db.TicketCategories.FindAsync(oldCategory.Value))?.Name
                : null;
            await AddHistoryAsync(id, updatedByEmail, "Category", oldCatName, newCatName);
        }

        if (req.LinkedEmailMessageId != oldLink)
        {
            if (string.IsNullOrEmpty(req.LinkedEmailMessageId))
                await AddHistoryAsync(id, updatedByEmail, "Email", oldLink, null);
            else
                await AddHistoryAsync(id, updatedByEmail, "Email", oldLink, req.LinkedEmailMessageId);
        }

        if (req.ProjectId != oldProject)
        {
            var newProjName = req.ProjectId.HasValue
                ? (await _db.Projects.FindAsync(req.ProjectId.Value))?.Name
                : null;
            var oldProjName = oldProject.HasValue
                ? (await _db.Projects.FindAsync(oldProject.Value))?.Name
                : null;
            await AddHistoryAsync(id, updatedByEmail, "Project", oldProjName, newProjName);
        }

        if (req.DueDate != oldDueDate)
            await AddHistoryAsync(id, updatedByEmail, "DueDate",
                oldDueDate?.ToString("yyyy-MM-dd"),
                req.DueDate?.ToString("yyyy-MM-dd"));

        await _db.SaveChangesAsync();
        return await GetByIdAsync(id, updatedByEmail);
    }

    // ── Tickets — delete ──────────────────────────────────────────────────────

    public async Task<bool> DeleteAsync(int id, string requestingEmail)
    {
        var ticket = await _db.Tickets.FindAsync(id);
        if (ticket is null) return false;

        bool isCreator = string.Equals(ticket.CreatedByEmail, requestingEmail, StringComparison.OrdinalIgnoreCase);
        bool isAdmin   = await IsAdminAsync(requestingEmail);

        if (!isCreator && !isAdmin) return false;

        _db.Tickets.Remove(ticket);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Comments ──────────────────────────────────────────────────────────────

    public async Task<TicketCommentDto> AddCommentAsync(
        int ticketId,
        CreateTicketCommentRequest req,
        string authorEmail)
    {
        var ticket = await _db.Tickets.FindAsync(ticketId)
            ?? throw new KeyNotFoundException("Ticket not found.");

        var comment = new TicketComment
        {
            TicketId    = ticketId,
            AuthorEmail = authorEmail,
            Body        = req.Body.Trim(),
            IsPrivate   = req.IsPrivate,
            CreatedAt   = DateTime.UtcNow,
        };

        _db.TicketComments.Add(comment);
        await AddWatcherInternalAsync(ticketId, authorEmail);
        await _db.SaveChangesAsync();

        // Notify watchers
        var watchers = await _db.TicketWatchers
            .Where(w => w.TicketId == ticketId)
            .Select(w => w.UserEmail)
            .ToListAsync();

        string notifTitle = $"{authorEmail} commented on {FormatNumber(ticketId)}";
        string notifBody  = $"\"{ticket.Title}\" — {TruncateBody(comment.Body)}";

        foreach (var watcher in watchers)
        {
            if (string.Equals(watcher, authorEmail, StringComparison.OrdinalIgnoreCase)) continue;
            if (req.IsPrivate) continue; // private comments don't notify
            await _notifications.SendAsync(
                watcher, "ticket_comment",
                notifTitle, notifBody,
                relatedTicketId: ticketId);
        }

        // Process @mentions
        await _notifications.DispatchTicketCommentMentionsAsync(
            ticketId, comment.Id,
            comment.Body, null,
            authorEmail, ticket.Title);

        return ToCommentDto(comment);
    }

    public async Task<TicketCommentDto?> UpdateCommentAsync(
        int ticketId, int commentId,
        UpdateTicketCommentRequest req,
        string requestingEmail)
    {
        var comment = await _db.TicketComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.TicketId == ticketId && !c.IsDeleted);

        if (comment is null) return null;
        if (!string.Equals(comment.AuthorEmail, requestingEmail, StringComparison.OrdinalIgnoreCase))
            return null;

        var ticket   = await _db.Tickets.FindAsync(ticketId);
        var oldBody  = comment.Body;

        comment.Body      = req.Body.Trim();
        comment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Process new @mentions
        await _notifications.DispatchTicketCommentMentionsAsync(
            ticketId, commentId,
            comment.Body, oldBody,
            requestingEmail, ticket?.Title ?? "");

        return ToCommentDto(comment);
    }

    public async Task<bool> DeleteCommentAsync(int ticketId, int commentId, string requestingEmail)
    {
        var comment = await _db.TicketComments
            .FirstOrDefaultAsync(c => c.Id == commentId && c.TicketId == ticketId && !c.IsDeleted);

        if (comment is null) return false;
        if (!string.Equals(comment.AuthorEmail, requestingEmail, StringComparison.OrdinalIgnoreCase))
            return false;

        comment.IsDeleted = true;
        comment.Body      = "[comment deleted]";
        comment.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    // ── History ───────────────────────────────────────────────────────────────

    public async Task<List<TicketHistoryDto>> GetHistoryAsync(int ticketId)
        => await _db.TicketHistory
            .Where(h => h.TicketId == ticketId)
            .OrderBy(h => h.ChangedAt)
            .Select(h => new TicketHistoryDto(
                h.Id, h.TicketId, h.ChangedByEmail,
                h.FieldChanged, h.OldValue, h.NewValue,
                h.ChangedAt.ToString("o")))
            .ToListAsync();

    // ── Watchers ──────────────────────────────────────────────────────────────

    public async Task<bool> WatchAsync(int ticketId, string userEmail)
    {
        var exists = await _db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!exists) return false;
        await AddWatcherInternalAsync(ticketId, userEmail);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> UnwatchAsync(int ticketId, string userEmail)
    {
        var watcher = await _db.TicketWatchers
            .FirstOrDefaultAsync(w => w.TicketId == ticketId &&
                w.UserEmail.ToLower() == userEmail.ToLower());
        if (watcher is null) return false;
        _db.TicketWatchers.Remove(watcher);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Stats + Dashboard ─────────────────────────────────────────────────────

    public async Task<TicketStatsDto> GetStatsAsync(string userEmail)
    {
        var now         = DateTime.UtcNow;
        var monthStart  = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var closedStatusIds = await _db.TicketStatuses
            .Where(s => s.IsClosed)
            .Select(s => s.Id)
            .ToListAsync();

        var openCount = await _db.Tickets
            .CountAsync(t => !closedStatusIds.Contains(t.StatusId));

        var overdueCount = await _db.Tickets
            .CountAsync(t => !closedStatusIds.Contains(t.StatusId) &&
                             t.DueDate.HasValue && t.DueDate.Value < now);

        var assignedToMeCount = await _db.Tickets
            .CountAsync(t => !closedStatusIds.Contains(t.StatusId) &&
                             t.AssignedToEmail == userEmail);

        var closedThisMonth = await _db.Tickets
            .CountAsync(t => closedStatusIds.Contains(t.StatusId) &&
                             t.ClosedAt.HasValue && t.ClosedAt.Value >= monthStart);

        return new TicketStatsDto(openCount, overdueCount, assignedToMeCount, closedThisMonth);
    }

    public async Task<DashboardDto> GetDashboardAsync(string userEmail)
    {
        var ticketStats = await GetStatsAsync(userEmail);

        var closedStatusIds = await _db.TicketStatuses
            .Where(s => s.IsClosed).Select(s => s.Id).ToListAsync();

        // Recent tickets (last 8 updated, not closed)
        var recentTickets = await _db.Tickets
            .Include(t => t.Category).Include(t => t.Status).Include(t => t.Project)
            .Where(t => !closedStatusIds.Contains(t.StatusId))
            .OrderByDescending(t => t.UpdatedAt)
            .Take(8)
            .ToListAsync();

        // My open tickets (assigned to me, not closed)
        var myTickets = await _db.Tickets
            .Include(t => t.Category).Include(t => t.Status).Include(t => t.Project)
            .Where(t => t.AssignedToEmail == userEmail && !closedStatusIds.Contains(t.StatusId))
            .OrderBy(t => t.DueDate ?? DateTime.MaxValue)
            .ThenByDescending(t => t.Priority == "Critical" ? 3
                                 : t.Priority == "High"     ? 2
                                 : t.Priority == "Medium"   ? 1 : 0)
            .Take(10)
            .ToListAsync();

        var now = DateTime.UtcNow.Date;
        var allIds = recentTickets.Concat(myTickets).Select(t => t.Id).Distinct().ToList();

        var commentCounts = await _db.TicketComments
            .Where(c => allIds.Contains(c.TicketId) && !c.IsDeleted)
            .GroupBy(c => c.TicketId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        var attachCounts = await _db.TicketAttachments
            .Where(a => allIds.Contains(a.TicketId))
            .GroupBy(a => a.TicketId)
            .Select(g => new { g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.Count);

        // Project stats
        var activeProjectCount = await _db.Projects.CountAsync(p => p.Status == "Active");
        var buildingCount      = await _db.Buildings.CountAsync();
        var lotCount           = await _db.Lots.CountAsync();
        var totalPos           = await _db.PurchaseOrders.CountAsync();
        var totalPoAmount      = (decimal)(await _db.PurchaseOrders.SumAsync(po => (double?)po.Amount) ?? 0.0);

        return new DashboardDto(
            ticketStats,
            recentTickets.Select(t => ToSummaryDto(t, commentCounts, attachCounts, now)).ToList(),
            myTickets.Select(t => ToSummaryDto(t, commentCounts, attachCounts, now)).ToList(),
            activeProjectCount,
            buildingCount,
            lotCount,
            totalPos,
            totalPoAmount);
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    private async Task AddWatcherInternalAsync(int ticketId, string email)
    {
        var lower   = email.ToLowerInvariant();
        var already = await _db.TicketWatchers
            .AnyAsync(w => w.TicketId == ticketId && w.UserEmail.ToLower() == lower);
        if (!already)
        {
            _db.TicketWatchers.Add(new TicketWatcher { TicketId = ticketId, UserEmail = lower });
            await _db.SaveChangesAsync();
        }
    }

    private async Task AddHistoryAsync(
        int ticketId, string byEmail, string field, string? oldVal, string? newVal)
    {
        _db.TicketHistory.Add(new TicketHistory
        {
            TicketId       = ticketId,
            ChangedByEmail = byEmail,
            FieldChanged   = field,
            OldValue       = oldVal,
            NewValue       = newVal,
            ChangedAt      = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();
    }

    private async Task NotifyWatchersAsync(
        Ticket ticket, string actorEmail,
        string type, string title, string body)
    {
        var watchers = await _db.TicketWatchers
            .Where(w => w.TicketId == ticket.Id)
            .Select(w => w.UserEmail)
            .ToListAsync();

        foreach (var w in watchers)
        {
            if (string.Equals(w, actorEmail, StringComparison.OrdinalIgnoreCase)) continue;
            await _notifications.SendAsync(w, type, title, body, relatedTicketId: ticket.Id);
        }
    }

    private static string FormatNumber(int id) => $"TKT-{id:D4}";

    private static string TruncateBody(string body, int max = 100)
        => body.Length <= max ? body : body[..max] + "…";

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static TicketStatusDto ToStatusDto(TicketStatus s) =>
        new(s.Id, s.Name, s.Color, s.IsDefault, s.IsClosed, s.DisplayOrder);

    private static TicketSummaryDto ToSummaryDto(
        Ticket t,
        Dictionary<int, int> commentCounts,
        Dictionary<int, int> attachCounts,
        DateTime today)
    {
        bool isOverdue = t.DueDate.HasValue && !t.Status.IsClosed && t.DueDate.Value.Date < today;
        return new TicketSummaryDto(
            t.Id,
            FormatNumber(t.Id),
            t.Title,
            t.Priority,
            t.CategoryId,
            t.Category?.Name,
            t.Category?.Color,
            t.StatusId,
            t.Status.Name,
            t.Status.Color,
            t.Status.IsClosed,
            t.CreatedByEmail,
            t.AssignedToEmail,
            t.ProjectId,
            t.Project?.Name,
            t.LinkedEmailMessageId,
            t.DueDate?.ToString("o"),
            isOverdue,
            commentCounts.GetValueOrDefault(t.Id),
            attachCounts.GetValueOrDefault(t.Id),
            t.CreatedAt.ToString("o"),
            t.UpdatedAt.ToString("o"));
    }

    private static TicketDetailDto ToDetailDto(
        Ticket t, string currentUserEmail, bool isAdmin, bool isWatching)
    {
        var today    = DateTime.UtcNow.Date;
        bool isOverdue = t.DueDate.HasValue && !t.Status.IsClosed && t.DueDate.Value.Date < today;

        return new TicketDetailDto(
            t.Id,
            FormatNumber(t.Id),
            t.Title,
            t.Description,
            t.Priority,
            t.CategoryId,
            t.Category?.Name,
            t.Category?.Color,
            t.StatusId,
            t.Status.Name,
            t.Status.Color,
            t.Status.IsClosed,
            t.CreatedByEmail,
            t.AssignedToEmail,
            t.ProjectId,
            t.Project?.Name,
            t.LinkedEmailMessageId,
            t.DueDate?.ToString("o"),
            isOverdue,
            t.ClosedAt?.ToString("o"),
            t.CreatedAt.ToString("o"),
            t.UpdatedAt.ToString("o"),
            isWatching,
            t.Comments
                .Where(c => !c.IsPrivate || isAdmin ||
                    string.Equals(c.AuthorEmail, currentUserEmail, StringComparison.OrdinalIgnoreCase))
                .OrderBy(c => c.CreatedAt)
                .Select(c => ToCommentDto(c))
                .ToList(),
            t.Watchers
                .Select(w => new TicketWatcherDto(w.TicketId, w.UserEmail))
                .ToList(),
            t.Attachments
                .OrderByDescending(a => a.UploadedAt)
                .Select(a => new TicketAttachmentDto(
                    a.Id, a.TicketId, a.FileName, a.ContentType,
                    a.FileSize, a.UploadedByEmail, a.UploadedAt.ToString("o")))
                .ToList());
    }

    private static TicketCommentDto ToCommentDto(TicketComment c) => new(
        c.Id, c.TicketId, c.AuthorEmail,
        c.IsDeleted ? "[comment deleted]" : c.Body,
        c.IsPrivate, c.IsDeleted,
        c.CreatedAt.ToString("o"),
        c.UpdatedAt?.ToString("o"));
}
