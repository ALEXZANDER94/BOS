using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/project")]
public class AllProjectsController : ControllerBase
{
    private readonly IProjectService _projects;

    public AllProjectsController(IProjectService projects) => _projects = projects;

    // GET /api/project?search=...&status=...&clientId=...
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] int?    clientId)
        => Ok(await _projects.GetAllProjectsAsync(search, status, clientId));

    // GET /api/project/7
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var detail = await _projects.GetByIdAsync(id);
        return detail is null ? NotFound() : Ok(detail);
    }
}
