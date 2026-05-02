using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/dashboard")]
public class DashboardController : ControllerBase
{
    private readonly ITicketService _tickets;
    public DashboardController(ITicketService tickets) => _tickets = tickets;

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var email = User.FindFirstValue(ClaimTypes.Email)!;
        return Ok(await _tickets.GetDashboardAsync(email));
    }
}
