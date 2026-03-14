using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/project/{projectId:int}/purchase-order")]
[Authorize]
public class PurchaseOrdersController : ControllerBase
{
    private readonly AppDbContext        _db;
    private readonly IQuickBooksService  _qb;
    private readonly IProjectService     _projects;

    public PurchaseOrdersController(AppDbContext db, IQuickBooksService qb, IProjectService projects)
    {
        _db       = db;
        _qb       = qb;
        _projects = projects;
    }

    // GET /api/project/1/purchase-order
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var pos = await _db.PurchaseOrders
            .Where(po => po.ProjectId == projectId)
            .Include(po => po.Lot)
                .ThenInclude(l => l!.Building)
            .OrderBy(po => po.CreatedAt)
            .ToListAsync();

        return Ok(pos.Select(ToDto));
    }

    // POST /api/project/1/purchase-order
    [HttpPost]
    public async Task<IActionResult> Create(int projectId, [FromBody] CreatePurchaseOrderRequest req)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound(new { message = "Project not found." });

        var lot = await _db.Lots
            .Include(l => l.Building)
            .FirstOrDefaultAsync(l => l.Id == req.LotId && l.Building!.ProjectId == projectId);

        if (lot is null)
            return BadRequest(new { message = "Lot not found or does not belong to this project." });

        var now = DateTime.UtcNow;
        var po  = new PurchaseOrder
        {
            ProjectId   = projectId,
            LotId       = req.LotId,
            OrderNumber = req.OrderNumber.Trim(),
            Amount      = req.Amount,
            Status      = "Open",
            CreatedAt   = now,
            UpdatedAt   = now,
        };

        _db.PurchaseOrders.Add(po);
        await _db.SaveChangesAsync();

        // Re-fetch with navigation props for the DTO
        await _db.Entry(po).Reference(p => p.Lot).LoadAsync();
        await _db.Entry(po.Lot!).Reference(l => l.Building).LoadAsync();

        return Ok(ToDto(po));
    }

    // PUT /api/project/1/purchase-order/9
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int projectId, int id, [FromBody] UpdatePurchaseOrderRequest req)
    {
        var po = await _db.PurchaseOrders
            .Include(po => po.Lot).ThenInclude(l => l!.Building)
            .FirstOrDefaultAsync(po => po.Id == id && po.ProjectId == projectId);

        if (po is null) return NotFound();

        po.OrderNumber = req.OrderNumber.Trim();
        po.Amount      = req.Amount;
        po.UpdatedAt   = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ToDto(po));
    }

    // DELETE /api/project/1/purchase-order/9
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var po = await _db.PurchaseOrders
            .FirstOrDefaultAsync(po => po.Id == id && po.ProjectId == projectId);

        if (po is null) return NotFound();

        _db.PurchaseOrders.Remove(po);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/project/1/purchase-order/9/sync
    [HttpPost("{id:int}/sync")]
    public async Task<IActionResult> SyncOne(int projectId, int id)
    {
        var po = await _db.PurchaseOrders
            .Include(po => po.Lot).ThenInclude(l => l!.Building)
            .FirstOrDefaultAsync(po => po.Id == id && po.ProjectId == projectId);

        if (po is null) return NotFound();

        var result       = await _qb.GetPoStatusAsync(po.OrderNumber);
        po.Status        = result.Status;
        po.InvoiceNumber = result.InvoiceNumber;
        po.UpdatedAt     = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(ToDto(po));
    }

    // POST /api/project/1/purchase-order/sync-all
    [HttpPost("sync-all")]
    public async Task<IActionResult> SyncAll(int projectId)
    {
        var pos = await _db.PurchaseOrders
            .Where(po => po.ProjectId == projectId)
            .Include(po => po.Lot).ThenInclude(l => l!.Building)
            .ToListAsync();

        var orderNumbers = pos.Select(po => po.OrderNumber);
        var results      = await _qb.GetBatchPoStatusAsync(orderNumbers);
        var now          = DateTime.UtcNow;

        foreach (var po in pos)
        {
            if (results.TryGetValue(po.OrderNumber, out var r))
            {
                po.Status        = r.Status;
                po.InvoiceNumber = r.InvoiceNumber;
                po.UpdatedAt     = now;
            }
        }

        await _db.SaveChangesAsync();
        return Ok(pos.Select(ToDto));
    }

    // POST /api/project/1/purchase-order/import
    [HttpPost("import")]
    public async Task<IActionResult> Import(int projectId, IFormFile? file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        if (!file.FileName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "File must be a CSV." });

        if (file.Length > 5 * 1024 * 1024)
            return BadRequest(new { message = "File exceeds the 5 MB limit." });

        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound(new { message = "Project not found." });

        var result = await _projects.ImportPurchaseOrdersAsync(projectId, file);
        return Ok(result);
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static PurchaseOrderDto ToDto(PurchaseOrder po) => new(
        po.Id,
        po.ProjectId,
        po.LotId,
        po.Lot?.Name           ?? "",
        po.Lot?.Building?.Name ?? "",
        po.OrderNumber,
        po.InvoiceNumber,
        po.Amount,
        po.Status,
        po.CreatedAt,
        po.UpdatedAt);
}
