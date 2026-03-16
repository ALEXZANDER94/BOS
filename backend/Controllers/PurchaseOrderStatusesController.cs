using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/purchase-order-statuses")]
[Authorize]
public class PurchaseOrderStatusesController : ControllerBase
{
    private readonly AppDbContext _db;

    public PurchaseOrderStatusesController(AppDbContext db) => _db = db;

    // GET /api/purchase-order-statuses
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var statuses = await _db.PurchaseOrderStatuses
            .OrderBy(s => s.Name)
            .ToListAsync();

        return Ok(statuses.Select(ToDto));
    }

    // POST /api/purchase-order-statuses
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreatePoStatusRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Name is required." });

        var status = new PurchaseOrderStatus
        {
            Name      = req.Name.Trim(),
            Color     = req.Color,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.PurchaseOrderStatuses.Add(status);
        await _db.SaveChangesAsync();
        return Ok(ToDto(status));
    }

    // PUT /api/purchase-order-statuses/5
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdatePoStatusRequest req)
    {
        var status = await _db.PurchaseOrderStatuses.FindAsync(id);
        if (status is null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.Name))
            return BadRequest(new { message = "Name is required." });

        status.Name      = req.Name.Trim();
        status.Color     = req.Color;
        status.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ToDto(status));
    }

    // DELETE /api/purchase-order-statuses/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var status = await _db.PurchaseOrderStatuses.FindAsync(id);
        if (status is null) return NotFound();

        _db.PurchaseOrderStatuses.Remove(status);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static PurchaseOrderStatusDto ToDto(PurchaseOrderStatus s) =>
        new(s.Id, s.Name, s.Color);
}
