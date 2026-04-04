using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/projects/{projectId:int}/addon-options")]
[Authorize]
public class ProjectAddonAssignmentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProjectAddonAssignmentsController(AppDbContext db) => _db = db;

    // GET /api/projects/{projectId}/addon-options
    // Returns all client options with assignment status for this project
    [HttpGet]
    public async Task<IActionResult> GetOptions(int projectId)
    {
        var project = await _db.Projects.FindAsync(projectId);
        if (project is null) return NotFound();

        var addons = await _db.ClientAddons
            .Where(a => a.ClientId == project.ClientId)
            .Include(a => a.Assignments)
            .OrderBy(a => a.Code)
            .ToListAsync();

        var result = addons.Select(a =>
        {
            var assignment = a.Assignments.FirstOrDefault(x => x.ProjectId == projectId);
            return new ProjectAddonOptionDto(
                a.Id,
                a.Code,
                a.Description,
                a.Notes,
                assignment is not null,
                assignment?.Price);
        });

        return Ok(result);
    }

    // PUT /api/projects/{projectId}/addon-options/{addonId}
    [HttpPut("{addonId:int}")]
    public async Task<IActionResult> Upsert(int projectId, int addonId, [FromBody] UpsertAssignmentRequest req)
    {
        var project = await _db.Projects.FindAsync(projectId);
        if (project is null) return NotFound();

        bool addonExists = await _db.ClientAddons
            .AnyAsync(a => a.Id == addonId && a.ClientId == project.ClientId);
        if (!addonExists) return NotFound();

        var existing = await _db.ProjectAddonAssignments
            .FirstOrDefaultAsync(x => x.AddonId == addonId && x.ProjectId == projectId);

        if (existing is null)
        {
            existing = new ProjectAddonAssignment
            {
                AddonId   = addonId,
                ProjectId = projectId,
                Price     = req.Price,
            };
            _db.ProjectAddonAssignments.Add(existing);
        }
        else
        {
            existing.Price = req.Price;
        }

        await _db.SaveChangesAsync();
        return Ok(new { addonId, projectId, price = existing.Price });
    }

    // DELETE /api/projects/{projectId}/addon-options/{addonId}
    [HttpDelete("{addonId:int}")]
    public async Task<IActionResult> Remove(int projectId, int addonId)
    {
        var assignment = await _db.ProjectAddonAssignments
            .FirstOrDefaultAsync(x => x.AddonId == addonId && x.ProjectId == projectId);

        if (assignment is null) return NotFound();

        _db.ProjectAddonAssignments.Remove(assignment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/projects/{projectId}/addon-options/bulk
    [HttpPost("bulk")]
    public async Task<IActionResult> BulkAssign(int projectId, [FromBody] BulkAssignRequest req)
    {
        var project = await _db.Projects.FindAsync(projectId);
        if (project is null) return NotFound();

        var addonIds = req.Items.Select(i => i.AddonId).ToList();

        // Verify all addons belong to this client
        var validAddonIds = await _db.ClientAddons
            .Where(a => a.ClientId == project.ClientId && addonIds.Contains(a.Id))
            .Select(a => a.Id)
            .ToListAsync();

        var existingAssignments = await _db.ProjectAddonAssignments
            .Where(x => x.ProjectId == projectId && addonIds.Contains(x.AddonId))
            .ToListAsync();

        foreach (var item in req.Items)
        {
            if (!validAddonIds.Contains(item.AddonId)) continue;

            var existing = existingAssignments.FirstOrDefault(x => x.AddonId == item.AddonId);
            if (existing is null)
            {
                _db.ProjectAddonAssignments.Add(new ProjectAddonAssignment
                {
                    AddonId   = item.AddonId,
                    ProjectId = projectId,
                    Price     = item.Price,
                });
            }
            else
            {
                existing.Price = item.Price;
            }
        }

        await _db.SaveChangesAsync();
        return Ok();
    }
}
