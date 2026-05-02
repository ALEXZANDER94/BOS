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
    // the list to members of that alias group. Without an alias, the result is
    // the union of (Google Workspace domain users, when the service account is
    // configured) and (every email already known to the ticket system) — that
    // way the dropdown stays populated even when Workspace isn't set up.
    [HttpGet("users")]
    public async Task<IActionResult> GetUsers([FromQuery] string? alias = null)
    {
        if (!string.IsNullOrWhiteSpace(alias))
            return Ok(await _workspace.GetGroupMembersAsync(alias));

        var domainUsers = await _workspace.GetDomainUsersAsync();
        var ticketUsers = await _workspace.GetKnownTicketUsersAsync();

        // Dedup by email (case-insensitive); prefer the entry with a real name
        // over one whose name is just the email.
        var byEmail = new Dictionary<string, DTOs.WorkspaceUserDto>(StringComparer.OrdinalIgnoreCase);
        foreach (var u in domainUsers.Concat(ticketUsers))
        {
            if (!byEmail.TryGetValue(u.Email, out var existing))
            {
                byEmail[u.Email] = u;
            }
            else if (existing.Name == existing.Email && u.Name != u.Email)
            {
                byEmail[u.Email] = u;
            }
        }

        var merged = byEmail.Values
            .OrderBy(u => u.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Ok(merged);
    }
}
