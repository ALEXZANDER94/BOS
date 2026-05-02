using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;

namespace BOS.Backend.Services;

public class ProposalDeadlineNotificationService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<ProposalDeadlineNotificationService> _logger;

    public ProposalDeadlineNotificationService(
        IServiceScopeFactory scopeFactory,
        ILogger<ProposalDeadlineNotificationService> logger)
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
                await ProcessDeadlinesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing proposal deadline notifications.");
            }

            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    private async Task ProcessDeadlinesAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db            = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var notifications = scope.ServiceProvider.GetRequiredService<INotificationService>();

        var now = DateTime.UtcNow;

        var proposals = await db.Proposals
            .Include(p => p.Client)
            .Where(p =>
                p.Deadline.HasValue &&
                p.DeadlineNotifiedAt == null &&
                p.Status != "Converted" &&
                p.Status != "Rejected" &&
                !string.IsNullOrEmpty(p.CreatedByEmail))
            .ToListAsync(ct);

        var notified = 0;

        foreach (var p in proposals)
        {
            var reminderThreshold = p.Deadline!.Value.AddDays(-p.DeadlineReminderDays);

            if (now < reminderThreshold) continue;

            var isOverdue = now >= p.Deadline.Value;
            var title = isOverdue
                ? $"Proposal \"{p.Name}\" is past its deadline"
                : $"Proposal \"{p.Name}\" deadline approaching";
            var body = isOverdue
                ? $"The deadline was {p.Deadline.Value:MMM d, yyyy}. Client: {p.Client?.Name ?? "Unknown"}"
                : $"Due {p.Deadline.Value:MMM d, yyyy} ({p.DeadlineReminderDays} day reminder). Client: {p.Client?.Name ?? "Unknown"}";

            await notifications.SendAsync(
                p.CreatedByEmail,
                "proposal_deadline",
                title,
                body,
                relatedProposalId: p.Id);

            p.DeadlineNotifiedAt = now;
            notified++;
        }

        if (notified > 0)
        {
            await db.SaveChangesAsync(ct);
            _logger.LogInformation("Sent deadline notifications for {Count} proposals.", notified);
        }
    }
}
