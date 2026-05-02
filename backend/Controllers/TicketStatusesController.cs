using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/ticket-statuses")]
public class TicketStatusesController : ControllerBase
{
    private readonly ITicketService _tickets;
    public TicketStatusesController(ITicketService tickets) => _tickets = tickets;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _tickets.GetStatusesAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTicketStatusRequest req)
    {
        var dto = await _tickets.CreateStatusAsync(req);
        return CreatedAtAction(nameof(GetAll), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTicketStatusRequest req)
    {
        var dto = await _tickets.UpdateStatusAsync(id, req);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _tickets.DeleteStatusAsync(id);
        if (!ok) return NotFound();
        return NoContent();
    }
}
