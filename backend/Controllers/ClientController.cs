using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/client")]
public class ClientController : ControllerBase
{
    private readonly IClientService _clients;

    public ClientController(IClientService clients) => _clients = clients;

    // GET /api/client?search=acme&status=Active
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status)
        => Ok(await _clients.GetAllAsync(search, status));

    // GET /api/client/5
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var client = await _clients.GetByIdAsync(id);
        return client is null ? NotFound() : Ok(client);
    }

    // POST /api/client
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateClientRequest request)
    {
        var client = await _clients.CreateAsync(request);
        return CreatedAtAction(nameof(GetById), new { id = client.Id }, client);
    }

    // PUT /api/client/5
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateClientRequest request)
    {
        var (client, error) = await _clients.UpdateAsync(id, request);
        if (client is null && error is null) return NotFound();
        if (error is not null) return Conflict(new { message = error });
        return Ok(client);
    }

    // DELETE /api/client/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _clients.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
