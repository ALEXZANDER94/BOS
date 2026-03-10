using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;

namespace BOS.Backend.Services;

/// <summary>
/// Background service that runs once every 24 hours and hard-deletes
/// notifications older than 30 days to prevent database growth.
/// </summary>
public class NotificationCleanupService : BackgroundService
{
    private readonly IServiceScopeFactory          _scopeFactory;
    private readonly ILogger<NotificationCleanupService> _logger;

    public NotificationCleanupService(
        IServiceScopeFactory scopeFactory,
        ILogger<NotificationCleanupService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger       = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait a short time on startup before the first run so the DB is ready
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope  = _scopeFactory.CreateScope();
                using var db     = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var cutoff  = DateTime.UtcNow.AddDays(-30);
                var deleted = await db.Notifications
                    .Where(n => n.CreatedAt < cutoff)
                    .ExecuteDeleteAsync(stoppingToken);

                if (deleted > 0)
                    _logger.LogInformation(
                        "Notification cleanup: deleted {Count} notifications older than 30 days.", deleted);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Notification cleanup: unexpected error.");
            }

            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }
}
