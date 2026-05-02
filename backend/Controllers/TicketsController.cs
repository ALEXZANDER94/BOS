using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/tickets")]
public class TicketsController : ControllerBase
{
    private readonly ITicketService _tickets;
    public TicketsController(ITicketService tickets) => _tickets = tickets;

    private string CurrentEmail => User.FindFirstValue(ClaimTypes.Email)!;

    // ── List ──────────────────────────────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> List(
        [FromQuery] string?   search       = null,
        [FromQuery] string?   priority     = null,
        [FromQuery] int?      categoryId   = null,
        [FromQuery] int?      statusId     = null,
        [FromQuery] bool?     showClosed   = null,
        [FromQuery] string?   assignedTo   = null,
        [FromQuery] int?      projectId    = null,
        [FromQuery] DateTime? createdAfter = null,
        [FromQuery] DateTime? createdBefore = null,
        [FromQuery] bool      myTickets    = false,
        [FromQuery] int       page         = 1,
        [FromQuery] int       pageSize     = 25)
    {
        var filter = new TicketListFilter(
            search, priority, categoryId, statusId,
            showClosed, assignedTo, projectId,
            createdAfter, createdBefore, myTickets, CurrentEmail);

        var (items, total) = await _tickets.ListAsync(filter, page, pageSize);
        return Ok(new { items, total, page, pageSize });
    }

    // ── List by linked email ──────────────────────────────────────────────────

    [HttpGet("by-email")]
    public async Task<IActionResult> ListByEmail([FromQuery] string messageId)
    {
        var items = await _tickets.ListByLinkedEmailAsync(messageId);
        return Ok(items);
    }

    // ── Get by ID ─────────────────────────────────────────────────────────────

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var dto = await _tickets.GetByIdAsync(id, CurrentEmail);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTicketRequest req)
    {
        try
        {
            var dto = await _tickets.CreateAsync(req, CurrentEmail);
            return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // ── Update ────────────────────────────────────────────────────────────────

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateTicketRequest req)
    {
        try
        {
            var dto = await _tickets.UpdateAsync(id, req, CurrentEmail);
            if (dto is null) return NotFound();
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // ── Delete ────────────────────────────────────────────────────────────────

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _tickets.DeleteAsync(id, CurrentEmail);
        if (!ok) return Forbid();
        return NoContent();
    }

    // ── Comments ──────────────────────────────────────────────────────────────

    [HttpPost("{ticketId:int}/comments")]
    public async Task<IActionResult> AddComment(
        int ticketId, [FromBody] CreateTicketCommentRequest req)
    {
        try
        {
            var dto = await _tickets.AddCommentAsync(ticketId, req, CurrentEmail);
            return Ok(dto);
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPut("{ticketId:int}/comments/{commentId:int}")]
    public async Task<IActionResult> UpdateComment(
        int ticketId, int commentId, [FromBody] UpdateTicketCommentRequest req)
    {
        var dto = await _tickets.UpdateCommentAsync(ticketId, commentId, req, CurrentEmail);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpDelete("{ticketId:int}/comments/{commentId:int}")]
    public async Task<IActionResult> DeleteComment(int ticketId, int commentId)
    {
        var ok = await _tickets.DeleteCommentAsync(ticketId, commentId, CurrentEmail);
        if (!ok) return NotFound();
        return NoContent();
    }

    // ── History ───────────────────────────────────────────────────────────────

    [HttpGet("{ticketId:int}/history")]
    public async Task<IActionResult> GetHistory(int ticketId)
        => Ok(await _tickets.GetHistoryAsync(ticketId));

    // ── Watchers ──────────────────────────────────────────────────────────────

    [HttpPost("{ticketId:int}/watch")]
    public async Task<IActionResult> Watch(int ticketId)
    {
        var ok = await _tickets.WatchAsync(ticketId, CurrentEmail);
        if (!ok) return NotFound();
        return Ok();
    }

    [HttpDelete("{ticketId:int}/watch")]
    public async Task<IActionResult> Unwatch(int ticketId)
    {
        var ok = await _tickets.UnwatchAsync(ticketId, CurrentEmail);
        if (!ok) return NotFound();
        return NoContent();
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
        => Ok(await _tickets.GetStatsAsync(CurrentEmail));
}
