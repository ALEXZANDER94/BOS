using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface ICustomUpgradeService
{
    Task<List<CustomUpgradeDto>> GetForClientAsync(int clientId);
    Task<List<CustomUpgradeDto>> GetGlobalAsync();
    Task<CustomUpgradeDto?>      GetByIdAsync(int id);
    Task<CustomUpgradeDto>       CreateAsync(CreateCustomUpgradeRequest req);
    Task<CustomUpgradeDto?>      UpdateAsync(int id, UpdateCustomUpgradeRequest req);
    Task<(bool Deleted, CustomUpgradeUsageDto? Usage)> DeleteAsync(int id);
    Task<CustomUpgradeUsageDto>  GetUsageAsync(int id);
}

public class CustomUpgradeService : ICustomUpgradeService
{
    private readonly AppDbContext _db;
    public CustomUpgradeService(AppDbContext db) => _db = db;

    public async Task<List<CustomUpgradeDto>> GetForClientAsync(int clientId)
    {
        // Union of: this client's upgrades + all globals.
        return await _db.CustomUpgrades
            .Where(u => u.ClientId == clientId || u.IsGlobal)
            .OrderBy(u => u.Name)
            .Select(u => new CustomUpgradeDto(u.Id, u.ClientId, u.IsGlobal, u.Name, u.Description, u.CreatedAt))
            .ToListAsync();
    }

    public async Task<List<CustomUpgradeDto>> GetGlobalAsync()
    {
        return await _db.CustomUpgrades
            .Where(u => u.IsGlobal)
            .OrderBy(u => u.Name)
            .Select(u => new CustomUpgradeDto(u.Id, u.ClientId, u.IsGlobal, u.Name, u.Description, u.CreatedAt))
            .ToListAsync();
    }

    public async Task<CustomUpgradeDto?> GetByIdAsync(int id)
    {
        var u = await _db.CustomUpgrades.FindAsync(id);
        return u is null ? null : ToDto(u);
    }

    public async Task<CustomUpgradeDto> CreateAsync(CreateCustomUpgradeRequest req)
    {
        var name = (req.Name ?? "").Trim();
        if (string.IsNullOrEmpty(name))
            throw new InvalidOperationException("Name is required.");

        // Mutual exclusion: global upgrades have no ClientId; per-client upgrades require one.
        var isGlobal = req.IsGlobal;
        int? clientId = isGlobal ? null : req.ClientId;
        if (!isGlobal && clientId is null)
            throw new InvalidOperationException("ClientId is required for non-global upgrades.");

        var upgrade = new CustomUpgrade
        {
            Name        = name,
            Description = (req.Description ?? "").Trim(),
            IsGlobal    = isGlobal,
            ClientId    = clientId,
            CreatedAt   = DateTime.UtcNow,
        };
        _db.CustomUpgrades.Add(upgrade);
        await _db.SaveChangesAsync();
        return ToDto(upgrade);
    }

    public async Task<CustomUpgradeDto?> UpdateAsync(int id, UpdateCustomUpgradeRequest req)
    {
        var u = await _db.CustomUpgrades.FindAsync(id);
        if (u is null) return null;

        u.Name        = (req.Name ?? "").Trim();
        u.Description = (req.Description ?? "").Trim();
        u.IsGlobal    = req.IsGlobal;
        u.ClientId    = req.IsGlobal ? null : req.ClientId;

        await _db.SaveChangesAsync();
        return ToDto(u);
    }

    public async Task<(bool Deleted, CustomUpgradeUsageDto? Usage)> DeleteAsync(int id)
    {
        var u = await _db.CustomUpgrades.FindAsync(id);
        if (u is null) return (false, null);

        var usage = await GetUsageAsync(id);
        if (usage.ProposalCount + usage.ProjectCount + usage.LibraryCount > 0)
            return (false, usage);

        _db.CustomUpgrades.Remove(u);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task<CustomUpgradeUsageDto> GetUsageAsync(int id)
    {
        var proposalRefs = await _db.ProposalCustomUpgrades
            .Where(x => x.CustomUpgradeId == id)
            .Include(x => x.Proposal)
            .Select(x => new CustomUpgradeUsageRef("Proposal", x.ProposalId, x.Proposal!.Name))
            .ToListAsync();

        var projectRefs = await _db.ProjectCustomUpgrades
            .Where(x => x.CustomUpgradeId == id)
            .Include(x => x.Project)
            .Select(x => new CustomUpgradeUsageRef("Project", x.ProjectId, x.Project!.Name))
            .ToListAsync();

        var libraryRefs = await _db.LibraryUpgrades
            .Where(x => x.CustomUpgradeId == id)
            .Include(x => x.Library)
            .Select(x => new CustomUpgradeUsageRef("Library", x.LibraryId, x.Library!.Title))
            .ToListAsync();

        var refs = new List<CustomUpgradeUsageRef>();
        refs.AddRange(proposalRefs);
        refs.AddRange(projectRefs);
        refs.AddRange(libraryRefs);

        return new CustomUpgradeUsageDto(
            proposalRefs.Count,
            projectRefs.Count,
            libraryRefs.Count,
            refs);
    }

    private static CustomUpgradeDto ToDto(CustomUpgrade u) =>
        new(u.Id, u.ClientId, u.IsGlobal, u.Name, u.Description, u.CreatedAt);
}
