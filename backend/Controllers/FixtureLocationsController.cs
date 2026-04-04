using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/fixture-locations")]
[Authorize]
public class FixtureLocationsController : ControllerBase
{
    private readonly IFixtureService _fixtures;

    public FixtureLocationsController(IFixtureService fixtures) => _fixtures = fixtures;

    // GET /api/fixture-locations
    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _fixtures.GetAllLocationsAsync());

    // POST /api/fixture-locations
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFixtureLocationRequest req)
    {
        var dto = await _fixtures.CreateLocationAsync(req);
        return Ok(dto);
    }

    // PUT /api/fixture-locations/3
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateFixtureLocationRequest req)
    {
        var dto = await _fixtures.UpdateLocationAsync(id, req);
        return dto is null ? NotFound() : Ok(dto);
    }

    // DELETE /api/fixture-locations/3
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _fixtures.DeleteLocationAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
