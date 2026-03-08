using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IGlossaryUnitStatusService
{
    Task<List<GlossaryUnitStatusDto>> GetAllAsync();
    Task<(GlossaryUnitStatusDto? Status, string? Error)> CreateAsync(CreateGlossaryUnitStatusRequest request);
    Task<(GlossaryUnitStatusDto? Status, string? Error)> UpdateAsync(int id, UpdateGlossaryUnitStatusRequest request);
    Task<bool> DeleteAsync(int id);
}

public class GlossaryUnitStatusService : IGlossaryUnitStatusService
{
    private readonly AppDbContext _db;

    public GlossaryUnitStatusService(AppDbContext db) => _db = db;

    public async Task<List<GlossaryUnitStatusDto>> GetAllAsync() =>
        await _db.GlossaryUnitStatuses
            .OrderBy(s => s.Name)
            .Select(s => ToDto(s))
            .ToListAsync();

    public async Task<(GlossaryUnitStatusDto? Status, string? Error)> CreateAsync(CreateGlossaryUnitStatusRequest req)
    {
        var name = req.Name.Trim();

        var exists = await _db.GlossaryUnitStatuses
            .AnyAsync(s => s.Name.ToLower() == name.ToLower());

        if (exists)
            return (null, $"A status named '{name}' already exists.");

        var status = new GlossaryUnitStatus
        {
            Name      = name,
            Color     = req.Color.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.GlossaryUnitStatuses.Add(status);
        await _db.SaveChangesAsync();
        return (ToDto(status), null);
    }

    public async Task<(GlossaryUnitStatusDto? Status, string? Error)> UpdateAsync(int id, UpdateGlossaryUnitStatusRequest req)
    {
        var status = await _db.GlossaryUnitStatuses.FindAsync(id);
        if (status is null) return (null, null); // caller returns 404

        var name = req.Name.Trim();

        var conflict = await _db.GlossaryUnitStatuses
            .AnyAsync(s => s.Name.ToLower() == name.ToLower() && s.Id != id);

        if (conflict)
            return (null, $"A status named '{name}' already exists.");

        status.Name      = name;
        status.Color     = req.Color.Trim();
        status.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return (ToDto(status), null);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var status = await _db.GlossaryUnitStatuses.FindAsync(id);
        if (status is null) return false;

        _db.GlossaryUnitStatuses.Remove(status);
        await _db.SaveChangesAsync();
        return true;
    }

    private static GlossaryUnitStatusDto ToDto(GlossaryUnitStatus s) =>
        new(s.Id, s.Name, s.Color, s.CreatedAt, s.UpdatedAt);
}
