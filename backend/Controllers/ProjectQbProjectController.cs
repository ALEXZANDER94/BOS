using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

// Endpoints for managing the per-project link to a QuickBooks Project
// (sub-customer). When a BOS Project has a QbProjectId set, the Estimates
// and Invoices tabs scope their QB queries to that sub-customer instead of
// the parent client's QB Customer.
[ApiController]
[Route("api/project/{projectId:int}/qb-project")]
[Authorize]
public class ProjectQbProjectController : ControllerBase
{
    private readonly AppDbContext       _db;
    private readonly IQuickBooksService _qb;

    public ProjectQbProjectController(AppDbContext db, IQuickBooksService qb)
    {
        _db = db;
        _qb = qb;
    }

    // GET /api/project/1/qb-project/options
    // Returns the QB sub-customers under the project's client's QB Customer.
    [HttpGet("options")]
    public async Task<IActionResult> ListOptions(int projectId)
    {
        var project = await _db.Projects
            .Include(p => p.Client)
            .FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null) return NotFound(new { message = "Project not found." });

        var parentId = project.Client?.QbCustomerId;
        if (string.IsNullOrEmpty(parentId))
        {
            return Conflict(new
            {
                reason  = "no-parent-customer",
                message = "The project's client is not linked to a QuickBooks customer yet. " +
                          "Link the customer first from the client edit modal.",
            });
        }

        var subs = await _qb.ListSubCustomersAsync(parentId);
        return Ok(subs);
    }

    public record SetQbProjectRequest(string? QbProjectId, string? QbProjectName);

    // PATCH /api/project/1/qb-project
    // Sets or clears the QbProjectId/Name. Pass nulls for both to clear.
    [HttpPatch]
    public async Task<IActionResult> Set(int projectId, [FromBody] SetQbProjectRequest req)
    {
        var project = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null) return NotFound(new { message = "Project not found." });

        project.QbProjectId   = string.IsNullOrWhiteSpace(req.QbProjectId)   ? null : req.QbProjectId.Trim();
        project.QbProjectName = string.IsNullOrWhiteSpace(req.QbProjectName) ? null : req.QbProjectName.Trim();
        project.UpdatedAt     = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            qbProjectId   = project.QbProjectId,
            qbProjectName = project.QbProjectName,
        });
    }
}
