using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/ticket-categories")]
public class TicketCategoriesController : ControllerBase
{
    private readonly ITicketService _tickets;
    public TicketCategoriesController(ITicketService tickets) => _tickets = tickets;

    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _tickets.GetCategoriesAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTicketCategoryRequest req)
    {
        var dto = await _tickets.CreateCategoryAsync(req);
        return CreatedAtAction(nameof(GetAll), new { id = dto.Id }, dto);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTicketCategoryRequest req)
    {
        var dto = await _tickets.UpdateCategoryAsync(id, req);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _tickets.DeleteCategoryAsync(id);
        if (!ok) return NotFound();
        return NoContent();
    }
}
