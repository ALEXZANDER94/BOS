using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/project/{projectId:int}/building")]
[Authorize]
public class BuildingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public BuildingsController(AppDbContext db) => _db = db;

    // GET /api/project/1/building
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var buildings = await _db.Buildings
            .Where(b => b.ProjectId == projectId)
            .Include(b => b.Lots)
                .ThenInclude(l => l.Address)
            .OrderBy(b => b.Name)
            .ToListAsync();

        return Ok(buildings.Select(ToDto));
    }

    // POST /api/project/1/building
    [HttpPost]
    public async Task<IActionResult> Create(int projectId, [FromBody] CreateBuildingRequest req)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound(new { message = "Project not found." });

        var building = new Building
        {
            ProjectId   = projectId,
            Name        = req.Name.Trim(),
            Description = req.Description?.Trim() ?? string.Empty,
        };

        _db.Buildings.Add(building);
        await _db.SaveChangesAsync();
        return Ok(ToDto(building));
    }

    // PUT /api/project/1/building/5
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int projectId, int id, [FromBody] UpdateBuildingRequest req)
    {
        var building = await _db.Buildings
            .Include(b => b.Lots).ThenInclude(l => l.Address)
            .FirstOrDefaultAsync(b => b.Id == id && b.ProjectId == projectId);

        if (building is null) return NotFound();

        building.Name        = req.Name.Trim();
        building.Description = req.Description?.Trim() ?? string.Empty;
        await _db.SaveChangesAsync();

        return Ok(ToDto(building));
    }

    // DELETE /api/project/1/building/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var building = await _db.Buildings
            .FirstOrDefaultAsync(b => b.Id == id && b.ProjectId == projectId);

        if (building is null) return NotFound();

        _db.Buildings.Remove(building);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static BuildingDto ToDto(Building b) => new(
        b.Id,
        b.ProjectId,
        b.Name,
        b.Description,
        b.Lots.OrderBy(l => l.Name).Select(LotToDto).ToList());

    private static LotDto LotToDto(Lot l) => new(
        l.Id,
        l.BuildingId,
        l.Name,
        l.Description,
        l.Address is null ? null : new AddressDto(
            l.Address.Id,
            l.Address.Address1,
            l.Address.Address2,
            l.Address.City,
            l.Address.State,
            l.Address.Zip,
            l.Address.Country));
}
