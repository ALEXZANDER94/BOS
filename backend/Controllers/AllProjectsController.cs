using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;
using BOS.Backend.DTOs;

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

    // POST /api/project/import
    [HttpPost("import")]
    [Authorize]
    public async Task<IActionResult> Import(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        if (!Path.GetExtension(file.FileName).Equals(".csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only CSV files are accepted." });

        var result = await _projects.ImportProjectsAsync(file);
        return Ok(result);
    }

    // GET /api/project/7
    [HttpGet("{id:int}")]
    [Authorize]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var detail = await _projects.GetByIdAsync(id);
            return detail is null ? NotFound() : Ok(detail);
        }
        catch (Exception ex)
        {
            var logger = HttpContext.RequestServices
                .GetRequiredService<ILogger<AllProjectsController>>();
            logger.LogError(ex, "Failed to load project detail for ProjectId={ProjectId}", id);
            return StatusCode(500, new { message = "Failed to load project details." });
        }
    }
}
