using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;

namespace BOS.Backend.Services;

/// <summary>
/// Background service that runs hourly and sends overdue notifications to watchers
/// of tickets whose due date has passed and that have not yet been notified.
/// </summary>
public class OverdueTicketNotificationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OverdueTicketNotificationService> _logger;

    public OverdueTicketNotificationService(
        IServiceScopeFactory scopeFactory,
        ILogger<OverdueTicketNotificationService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessOverdueTicketsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing overdue ticket notifications.");
            }

            // Wait one hour between runs
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task ProcessOverdueTicketsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db            = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now = DateTime.UtcNow;

        // Closed status IDs to exclude
        var closedIds = await db.TicketStatuses
            .Where(s => s.IsClosed)
            .Select(s => s.Id)
            .ToListAsync(ct);

        // Tickets that are overdue and haven't been notified yet
        var overdueTickets = await db.Tickets
            .Where(t =>
                t.DueDate.HasValue &&
                t.DueDate.Value < now &&
                !closedIds.Contains(t.StatusId) &&
                t.OverdueNotifiedAt == null)
            .ToListAsync(ct);

        foreach (var ticket in overdueTickets)
        {
            var watchers = await db.TicketWatchers
                .Where(w => w.TicketId == ticket.Id)
                .Select(w => w.UserEmail)
                .ToListAsync(ct);

            string title = $"Ticket {FormatNumber(ticket.Id)} is overdue";
            string body  = $"\"{ticket.Title}\" was due on {ticket.DueDate!.Value:MMM d, yyyy}";

            foreach (var watcher in watchers)
            {
                await notifications.SendAsync(
                    watcher,
                    "ticket_overdue",
                    title,
                    body,
                    relatedTicketId: ticket.Id);
            }

            ticket.OverdueNotifiedAt = now;
            _logger.LogInformation("Sent overdue notifications for ticket {Id} to {Count} watchers.",
                ticket.Id, watchers.Count);
        }

        if (overdueTickets.Count > 0)
            await db.SaveChangesAsync(ct);
    }

    private static string FormatNumber(int id) => $"TKT-{id:D4}";
}
