using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/workspace")]
[Authorize]
public class WorkspaceController : ControllerBase
{
    private readonly IWorkspaceService _workspace;

    public WorkspaceController(IWorkspaceService workspace)
    {
        _workspace = workspace;
    }

    // GET /api/workspace/users
    // GET /api/workspace/users?alias=group@domain.com
    // Returns taggable workspace users. When an alias is provided, restricts
    // the list to members of that alias group.
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] string? alias = null)
    {
        var users = string.IsNullOrWhiteSpace(alias)
            ? await _workspace.GetDomainUsersAsync()
            : await _workspace.GetGroupMembersAsync(alias);

        return Ok(users);
    }
}
