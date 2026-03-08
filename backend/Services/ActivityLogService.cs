using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IActivityLogService
{
    Task<List<ActivityLogDto>>                  GetAllAsync(int clientId);
    Task<ActivityLogDto>                        CreateAsync(int clientId, CreateActivityLogRequest request);
    Task<(ActivityLogDto? Dto, string? Error)>  UpdateAsync(int clientId, int id, UpdateActivityLogRequest request);
    Task<bool>                                  DeleteAsync(int clientId, int id);
}

public class ActivityLogService : IActivityLogService
{
    private readonly AppDbContext _db;

    public ActivityLogService(AppDbContext db) => _db = db;

    public async Task<List<ActivityLogDto>> GetAllAsync(int clientId)
    {
        var logs = await _db.ActivityLogs
            .Where(a => a.ClientId == clientId)
            .OrderByDescending(a => a.OccurredAt)
            .ToListAsync();

        return logs.Select(ToDto).ToList();
    }

    public async Task<ActivityLogDto> CreateAsync(int clientId, CreateActivityLogRequest req)
    {
        var log = new ActivityLog
        {
            ClientId   = clientId,
            Type       = req.Type,
            Note       = req.Note.Trim(),
            OccurredAt = req.OccurredAt,
            CreatedAt  = DateTime.UtcNow,
            UpdatedAt  = DateTime.UtcNow,
        };

        _db.ActivityLogs.Add(log);
        await _db.SaveChangesAsync();
        return ToDto(log);
    }

    public async Task<(ActivityLogDto? Dto, string? Error)> UpdateAsync(int clientId, int id, UpdateActivityLogRequest req)
    {
        var log = await _db.ActivityLogs
            .FirstOrDefaultAsync(a => a.ClientId == clientId && a.Id == id);

        if (log is null) return (null, null);

        log.Type       = req.Type;
        log.Note       = req.Note.Trim();
        log.OccurredAt = req.OccurredAt;
        log.UpdatedAt  = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return (ToDto(log), null);
    }

    public async Task<bool> DeleteAsync(int clientId, int id)
    {
        var log = await _db.ActivityLogs
            .FirstOrDefaultAsync(a => a.ClientId == clientId && a.Id == id);

        if (log is null) return false;

        _db.ActivityLogs.Remove(log);
        await _db.SaveChangesAsync();
        return true;
    }

    private static ActivityLogDto ToDto(ActivityLog a) => new(
        a.Id, a.ClientId, a.Type, a.Note, a.OccurredAt, a.CreatedAt, a.UpdatedAt
    );
}
