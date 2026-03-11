using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/building/{buildingId:int}/lot")]
[Authorize]
public class LotsController : ControllerBase
{
    private readonly AppDbContext _db;

    public LotsController(AppDbContext db) => _db = db;

    // GET /api/building/3/lot
    [HttpGet]
    public async Task<IActionResult> GetAll(int buildingId)
    {
        var lots = await _db.Lots
            .Where(l => l.BuildingId == buildingId)
            .Include(l => l.Address)
            .OrderBy(l => l.Name)
            .ToListAsync();

        return Ok(lots.Select(ToDto));
    }

    // POST /api/building/3/lot
    [HttpPost]
    public async Task<IActionResult> Create(int buildingId, [FromBody] CreateLotRequest req)
    {
        var buildingExists = await _db.Buildings.AnyAsync(b => b.Id == buildingId);
        if (!buildingExists) return NotFound(new { message = "Building not found." });

        var lot = new Lot
        {
            BuildingId  = buildingId,
            Name        = req.Name.Trim(),
            Description = req.Description?.Trim() ?? string.Empty,
        };

        _db.Lots.Add(lot);
        await _db.SaveChangesAsync();
        return Ok(ToDto(lot));
    }

    // PUT /api/building/3/lot/7
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int buildingId, int id, [FromBody] UpdateLotRequest req)
    {
        var lot = await _db.Lots
            .Include(l => l.Address)
            .FirstOrDefaultAsync(l => l.Id == id && l.BuildingId == buildingId);

        if (lot is null) return NotFound();

        lot.Name        = req.Name.Trim();
        lot.Description = req.Description?.Trim() ?? string.Empty;
        await _db.SaveChangesAsync();
        return Ok(ToDto(lot));
    }

    // DELETE /api/building/3/lot/7
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int buildingId, int id)
    {
        var lot = await _db.Lots
            .FirstOrDefaultAsync(l => l.Id == id && l.BuildingId == buildingId);

        if (lot is null) return NotFound();

        var hasPOs = await _db.PurchaseOrders.AnyAsync(po => po.LotId == id);
        if (hasPOs)
            return Conflict(new { message = "Remove all purchase orders from this lot before deleting it." });

        _db.Lots.Remove(lot);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // PUT /api/building/3/lot/7/address  — upsert address
    [HttpPut("{id:int}/address")]
    public async Task<IActionResult> UpsertAddress(int buildingId, int id, [FromBody] UpsertAddressRequest req)
    {
        var lot = await _db.Lots
            .Include(l => l.Address)
            .FirstOrDefaultAsync(l => l.Id == id && l.BuildingId == buildingId);

        if (lot is null) return NotFound();

        if (lot.Address is not null)
        {
            lot.Address.Address1 = req.Address1?.Trim() ?? string.Empty;
            lot.Address.Address2 = req.Address2?.Trim() ?? string.Empty;
            lot.Address.City     = req.City?.Trim()     ?? string.Empty;
            lot.Address.State    = req.State?.Trim()    ?? string.Empty;
            lot.Address.Zip      = req.Zip?.Trim()      ?? string.Empty;
            lot.Address.Country  = req.Country?.Trim()  ?? string.Empty;
        }
        else
        {
            _db.Addresses.Add(new Address
            {
                LotId    = id,
                Address1 = req.Address1?.Trim() ?? string.Empty,
                Address2 = req.Address2?.Trim() ?? string.Empty,
                City     = req.City?.Trim()     ?? string.Empty,
                State    = req.State?.Trim()    ?? string.Empty,
                Zip      = req.Zip?.Trim()      ?? string.Empty,
                Country  = req.Country?.Trim()  ?? string.Empty,
            });
        }

        await _db.SaveChangesAsync();

        // Re-fetch to return complete lot with address
        await _db.Entry(lot).ReloadAsync();
        await _db.Entry(lot).Reference(l => l.Address).LoadAsync();
        return Ok(ToDto(lot));
    }

    // DELETE /api/building/3/lot/7/address
    [HttpDelete("{id:int}/address")]
    public async Task<IActionResult> DeleteAddress(int buildingId, int id)
    {
        var address = await _db.Addresses.FirstOrDefaultAsync(a => a.LotId == id);
        if (address is null) return NotFound();

        _db.Addresses.Remove(address);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static LotDto ToDto(Lot l) => new(
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
