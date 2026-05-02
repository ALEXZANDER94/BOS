using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

// Project-side Plans live under a Building. Lots get assigned to a Plan via
// LotsController (PlanId on create/update). Plans are typically created during
// proposal conversion, but can also be added/edited manually here.
[Authorize]
[ApiController]
[Route("api/building/{buildingId:int}/plan")]
public class PlansController : ControllerBase
{
    private readonly AppDbContext _db;
    public PlansController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll(int buildingId)
    {
        var plans = await _db.Plans
            .Where(p => p.BuildingId == buildingId)
            .OrderBy(p => p.PlanName)
            .Select(p => new PlanDto(p.Id, p.BuildingId, p.PlanName, p.SquareFootage, p.Amount))
            .ToListAsync();
        return Ok(plans);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int buildingId, [FromBody] CreatePlanRequest req)
    {
        var buildingExists = await _db.Buildings.AnyAsync(b => b.Id == buildingId);
        if (!buildingExists) return NotFound(new { message = "Building not found." });

        if (string.IsNullOrWhiteSpace(req.PlanName))
            return BadRequest(new { message = "Plan name is required." });

        var plan = new Plan
        {
            BuildingId    = buildingId,
            PlanName      = req.PlanName.Trim(),
            SquareFootage = req.SquareFootage,
            Amount        = req.Amount,
        };
        _db.Plans.Add(plan);
        await _db.SaveChangesAsync();
        return Ok(new PlanDto(plan.Id, plan.BuildingId, plan.PlanName, plan.SquareFootage, plan.Amount));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int buildingId, int id, [FromBody] UpdatePlanRequest req)
    {
        var plan = await _db.Plans.FirstOrDefaultAsync(p => p.Id == id && p.BuildingId == buildingId);
        if (plan is null) return NotFound();

        plan.PlanName      = (req.PlanName ?? "").Trim();
        plan.SquareFootage = req.SquareFootage;
        plan.Amount        = req.Amount;
        await _db.SaveChangesAsync();
        return Ok(new PlanDto(plan.Id, plan.BuildingId, plan.PlanName, plan.SquareFootage, plan.Amount));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int buildingId, int id)
    {
        var plan = await _db.Plans.FirstOrDefaultAsync(p => p.Id == id && p.BuildingId == buildingId);
        if (plan is null) return NotFound();

        // Lot.PlanId has SetNull on delete, so existing lot assignments are unlinked.
        _db.Plans.Remove(plan);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
