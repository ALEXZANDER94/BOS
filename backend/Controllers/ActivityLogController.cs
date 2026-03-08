using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/client/{clientId:int}/activity")]
public class ActivityLogController : ControllerBase
{
    private readonly IActivityLogService _activityLogs;

    public ActivityLogController(IActivityLogService activityLogs) => _activityLogs = activityLogs;

    // GET /api/client/1/activity
    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] int clientId)
        => Ok(await _activityLogs.GetAllAsync(clientId));

    // POST /api/client/1/activity
    [HttpPost]
    public async Task<IActionResult> Create(
        [FromRoute] int clientId,
        [FromBody] CreateActivityLogRequest request)
    {
        var log = await _activityLogs.CreateAsync(clientId, request);
        return Ok(log);
    }

    // PUT /api/client/1/activity/12
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(
        [FromRoute] int clientId,
        int id,
        [FromBody] UpdateActivityLogRequest request)
    {
        var (log, error) = await _activityLogs.UpdateAsync(clientId, id, request);
        if (log is null && error is null) return NotFound();
        if (error is not null) return Conflict(new { message = error });
        return Ok(log);
    }

    // DELETE /api/client/1/activity/12
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete([FromRoute] int clientId, int id)
    {
        var deleted = await _activityLogs.DeleteAsync(clientId, id);
        return deleted ? NoContent() : NotFound();
    }
}
