using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/quickbooks")]
[Authorize]
public class QuickBooksController : ControllerBase
{
    private readonly IQuickBooksService _qb;

    public QuickBooksController(IQuickBooksService qb) => _qb = qb;

    // GET /api/quickbooks/status
    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var connected = await _qb.IsConnectedAsync();
        return Ok(new QuickBooksStatusDto(connected, null));
    }

    // GET /api/quickbooks/connect  — redirects browser to Intuit OAuth consent page
    [HttpGet("connect")]
    public IActionResult Connect()
    {
        // Use a random state value to guard against CSRF
        var state = Guid.NewGuid().ToString("N");
        var url   = _qb.GetAuthorizationUrl(state);
        return Redirect(url);
    }

    // GET /api/quickbooks/callback  — Intuit redirects here after user authorises
    [AllowAnonymous]  // Cookie may not be set during the redirect back from Intuit
    [HttpGet("callback")]
    public async Task<IActionResult> Callback(
        [FromQuery] string code,
        [FromQuery] string realmId,
        [FromQuery] string? error)
    {
        if (!string.IsNullOrEmpty(error))
            return Redirect("/settings?qb=error");

        if (string.IsNullOrEmpty(code) || string.IsNullOrEmpty(realmId))
            return BadRequest(new { message = "Missing code or realmId." });

        await _qb.ExchangeCodeAsync(code, realmId);
        return Redirect("/settings?qb=connected");
    }

    // DELETE /api/quickbooks/disconnect
    [HttpDelete("disconnect")]
    public async Task<IActionResult> Disconnect()
    {
        await _qb.DisconnectAsync();
        return NoContent();
    }
}
