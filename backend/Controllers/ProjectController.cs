using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/client/{clientId:int}/project")]
public class ProjectController : ControllerBase
{
    private readonly IProjectService _projects;

    public ProjectController(IProjectService projects) => _projects = projects;

    // GET /api/client/1/project
    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] int clientId)
        => Ok(await _projects.GetAllAsync(clientId));

    // POST /api/client/1/project
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromRoute] int clientId,
        [FromBody] CreateProjectRequest request)
    {
        var project = await _projects.CreateAsync(clientId, request);
        return Ok(project);
    }

    // PUT /api/client/1/project/7
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        [FromRoute] int clientId,
        int id,
        [FromBody] UpdateProjectRequest request)
    {
        var (project, error) = await _projects.UpdateAsync(clientId, id, request);
        if (project is null && error is null) return NotFound();
        if (error is not null) return Conflict(new { message = error });
        return Ok(project);
    }

    // DELETE /api/client/1/project/7
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete([FromRoute] int clientId, int id)
    {
        var deleted = await _projects.DeleteAsync(clientId, id);
        return deleted ? NoContent() : NotFound();
    }

    // POST /api/client/1/project/7/contact/3
    [HttpPost("{projectId:int}/contact/{contactId:int}")]
    public async Task<IActionResult> AssignContact(
        [FromRoute] int clientId, int projectId, int contactId)
    {
        try
        {
            await _projects.AssignContactAsync(clientId, projectId, contactId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    // DELETE /api/client/1/project/7/contact/3
    [HttpDelete("{projectId:int}/contact/{contactId:int}")]
    public async Task<IActionResult> UnassignContact(
        [FromRoute] int clientId, int projectId, int contactId)
    {
        await _projects.UnassignContactAsync(clientId, projectId, contactId);
        return NoContent();
    }
}
