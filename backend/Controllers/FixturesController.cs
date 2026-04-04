using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

// ── Per-building fixture CRUD ─────────────────────────────────────────────────

[ApiController]
[Route("api/building/{buildingId:int}/fixture")]
[Authorize]
public class FixturesController : ControllerBase
{
    private readonly IFixtureService _fixtures;

    public FixturesController(IFixtureService fixtures) => _fixtures = fixtures;

    // GET /api/building/1/fixture
    [HttpGet]
    public async Task<IActionResult> GetAll(int buildingId)
        => Ok(await _fixtures.GetByBuildingAsync(buildingId));

    // POST /api/building/1/fixture
    [HttpPost]
    public async Task<IActionResult> Create(int buildingId, [FromBody] CreateFixtureRequest req)
    {
        try
        {
            var dto = await _fixtures.CreateAsync(buildingId, req);
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // PUT /api/building/1/fixture/9
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int buildingId, int id, [FromBody] UpdateFixtureRequest req)
    {
        var dto = await _fixtures.UpdateAsync(buildingId, id, req);
        return dto is null ? NotFound() : Ok(dto);
    }

    // DELETE /api/building/1/fixture/9
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int buildingId, int id)
    {
        var deleted = await _fixtures.DeleteAsync(buildingId, id);
        return deleted ? NoContent() : NotFound();
    }
}

// ── Project-level aggregate ───────────────────────────────────────────────────

[ApiController]
[Route("api/project/{projectId:int}/fixture")]
[Authorize]
public class ProjectFixturesController : ControllerBase
{
    private readonly IFixtureService _fixtures;

    public ProjectFixturesController(IFixtureService fixtures) => _fixtures = fixtures;

    // GET /api/project/1/fixture
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
        => Ok(await _fixtures.GetByProjectAsync(projectId));
}
