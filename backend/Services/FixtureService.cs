using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IFixtureService
{
    Task<List<FixtureLocationDto>> GetAllLocationsAsync();
    Task<FixtureLocationDto>       CreateLocationAsync(CreateFixtureLocationRequest req);
    Task<FixtureLocationDto?>      UpdateLocationAsync(int id, UpdateFixtureLocationRequest req);
    Task<bool>                     DeleteLocationAsync(int id);

    Task<List<FixtureDto>> GetByBuildingAsync(int buildingId);
    Task<List<FixtureDto>> GetByProjectAsync(int projectId);
    Task<FixtureDto>       CreateAsync(int buildingId, CreateFixtureRequest req);
    Task<FixtureDto?>      UpdateAsync(int buildingId, int id, UpdateFixtureRequest req);
    Task<bool>             DeleteAsync(int buildingId, int id);
}

public class FixtureService : IFixtureService
{
    private readonly AppDbContext _db;

    public FixtureService(AppDbContext db) => _db = db;

    // ── Locations ─────────────────────────────────────────────────────────────

    public async Task<List<FixtureLocationDto>> GetAllLocationsAsync()
        => await _db.FixtureLocations
            .OrderBy(l => l.Name)
            .Select(l => new FixtureLocationDto(l.Id, l.Name))
            .ToListAsync();

    public async Task<FixtureLocationDto> CreateLocationAsync(CreateFixtureLocationRequest req)
    {
        var loc = new FixtureLocation { Name = req.Name.Trim() };
        _db.FixtureLocations.Add(loc);
        await _db.SaveChangesAsync();
        return new FixtureLocationDto(loc.Id, loc.Name);
    }

    public async Task<FixtureLocationDto?> UpdateLocationAsync(int id, UpdateFixtureLocationRequest req)
    {
        var loc = await _db.FixtureLocations.FindAsync(id);
        if (loc is null) return null;
        loc.Name = req.Name.Trim();
        await _db.SaveChangesAsync();
        return new FixtureLocationDto(loc.Id, loc.Name);
    }

    public async Task<bool> DeleteLocationAsync(int id)
    {
        var loc = await _db.FixtureLocations.FindAsync(id);
        if (loc is null) return false;
        _db.FixtureLocations.Remove(loc);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    public async Task<List<FixtureDto>> GetByBuildingAsync(int buildingId)
    {
        var building = await _db.Buildings.FindAsync(buildingId);
        if (building is null) return [];

        return await _db.Fixtures
            .Where(f => f.BuildingId == buildingId)
            .Include(f => f.Location)
            .OrderBy(f => f.Code)
            .Select(f => ToDto(f, building.Name))
            .ToListAsync();
    }

    public async Task<List<FixtureDto>> GetByProjectAsync(int projectId)
    {
        var buildingIds = await _db.Buildings
            .Where(b => b.ProjectId == projectId)
            .Select(b => new { b.Id, b.Name })
            .ToListAsync();

        var nameMap = buildingIds.ToDictionary(b => b.Id, b => b.Name);
        var ids     = buildingIds.Select(b => b.Id).ToList();

        return await _db.Fixtures
            .Where(f => ids.Contains(f.BuildingId))
            .Include(f => f.Location)
            .OrderBy(f => f.BuildingId)
            .ThenBy(f => f.Code)
            .Select(f => ToDto(f, nameMap[f.BuildingId]))
            .ToListAsync();
    }

    public async Task<FixtureDto> CreateAsync(int buildingId, CreateFixtureRequest req)
    {
        var building = await _db.Buildings.FindAsync(buildingId)
            ?? throw new KeyNotFoundException("Building not found.");

        var fixture = new Fixture
        {
            BuildingId  = buildingId,
            LocationId  = req.LocationId,
            Code        = req.Code.Trim(),
            Description = req.Description.Trim(),
            Quantity    = req.Quantity,
            Note        = req.Note?.Trim() ?? string.Empty,
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow,
        };

        _db.Fixtures.Add(fixture);
        await _db.SaveChangesAsync();

        await _db.Entry(fixture).Reference(f => f.Location).LoadAsync();
        return ToDto(fixture, building.Name);
    }

    public async Task<FixtureDto?> UpdateAsync(int buildingId, int id, UpdateFixtureRequest req)
    {
        var fixture = await _db.Fixtures
            .Include(f => f.Location)
            .FirstOrDefaultAsync(f => f.Id == id && f.BuildingId == buildingId);

        if (fixture is null) return null;

        fixture.LocationId  = req.LocationId;
        fixture.Code        = req.Code.Trim();
        fixture.Description = req.Description.Trim();
        fixture.Quantity    = req.Quantity;
        fixture.Note        = req.Note?.Trim() ?? string.Empty;
        fixture.UpdatedAt   = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        await _db.Entry(fixture).Reference(f => f.Location).LoadAsync();

        var buildingName = (await _db.Buildings.FindAsync(buildingId))!.Name;
        return ToDto(fixture, buildingName);
    }

    public async Task<bool> DeleteAsync(int buildingId, int id)
    {
        var fixture = await _db.Fixtures
            .FirstOrDefaultAsync(f => f.Id == id && f.BuildingId == buildingId);

        if (fixture is null) return false;

        _db.Fixtures.Remove(fixture);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static FixtureDto ToDto(Fixture f, string buildingName) => new(
        f.Id,
        f.BuildingId,
        buildingName,
        f.LocationId,
        f.Location?.Name,
        f.Code,
        f.Description,
        f.Quantity,
        f.Note,
        f.CreatedAt.ToString("o"),
        f.UpdatedAt.ToString("o"));
}
