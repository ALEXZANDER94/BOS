using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/upgrades")]
public class CustomUpgradesController : ControllerBase
{
    private readonly ICustomUpgradeService _upgrades;
    public CustomUpgradesController(ICustomUpgradeService upgrades) => _upgrades = upgrades;

    // Returns the union of (this client's upgrades + all globals).
    // Or just globals when clientId is omitted.
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? clientId)
    {
        if (clientId is null)
            return Ok(await _upgrades.GetGlobalAsync());
        return Ok(await _upgrades.GetForClientAsync(clientId.Value));
    }

    [HttpGet("global")]
    public async Task<IActionResult> GetGlobal()
        => Ok(await _upgrades.GetGlobalAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var dto = await _upgrades.GetByIdAsync(id);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpGet("{id:int}/usage")]
    public async Task<IActionResult> GetUsage(int id)
    {
        var dto = await _upgrades.GetByIdAsync(id);
        if (dto is null) return NotFound();
        return Ok(await _upgrades.GetUsageAsync(id));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCustomUpgradeRequest req)
    {
        try
        {
            var dto = await _upgrades.CreateAsync(req);
            return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCustomUpgradeRequest req)
    {
        var dto = await _upgrades.UpdateAsync(id, req);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var (deleted, usage) = await _upgrades.DeleteAsync(id);
        if (!deleted && usage is null) return NotFound();
        if (!deleted)
            return Conflict(usage);
        return NoContent();
    }
}
