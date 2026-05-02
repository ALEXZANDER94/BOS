using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SettingsController : ControllerBase
{
    private readonly IAppSettingsService _settings;
    private readonly IAdobePdfService    _adobe;

    public SettingsController(IAppSettingsService settings, IAdobePdfService adobe)
    {
        _settings = settings;
        _adobe    = adobe;
    }

    /// <summary>
    /// GET /api/settings/adobe
    /// Returns the current Adobe PDF Services tier, whether it is available,
    /// and this month's conversion usage count.
    /// </summary>
    [HttpGet("adobe")]
    public async Task<IActionResult> GetAdobeStatus()
    {
        var creds     = await _settings.GetAdobeCredentialsAsync();
        var usage     = await _settings.GetAdobeUsageAsync(creds.IsPro);
        var available = await _adobe.IsAvailableAsync();

        return Ok(new
        {
            tier         = creds.IsPro ? "Pro" : "Free",
            isPro        = creds.IsPro,
            isAvailable  = available,
            monthlyCount = usage.MonthlyCount,
            monthYear    = usage.MonthYear,
        });
    }

    /// <summary>
    /// POST /api/settings/adobe/credentials
    /// Saves Pro-tier Adobe PDF Services credentials to the database.
    /// Both clientId and clientSecret are required.
    /// </summary>
    [HttpPost("adobe/credentials")]
    public async Task<IActionResult> SetAdobeCredentials([FromBody] SetAdobeCredentialsRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.ClientId))
            return BadRequest(new { message = "clientId is required." });
        if (string.IsNullOrWhiteSpace(req.ClientSecret))
            return BadRequest(new { message = "clientSecret is required." });

        await _settings.SetAdobeCredentialsAsync(req.ClientId.Trim(), req.ClientSecret.Trim());
        return Ok(new { message = "Credentials saved." });
    }

    /// <summary>
    /// DELETE /api/settings/adobe/credentials
    /// Removes the Pro-tier credentials from the database.
    /// The app reverts to free-tier credentials (if configured).
    /// </summary>
    [HttpDelete("adobe/credentials")]
    public async Task<IActionResult> ClearAdobeCredentials()
    {
        await _settings.ClearAdobeCredentialsAsync();
        return Ok(new { message = "Credentials removed." });
    }

    /// <summary>
    /// GET /api/settings/quickbooks
    /// Returns the QuickBooks-related app settings.
    /// </summary>
    [HttpGet("quickbooks")]
    public async Task<IActionResult> GetQuickBooksSettings()
    {
        var fieldName = await _settings.GetAsync(AppSettingsService.QbProjectCustomFieldKey);
        return Ok(new QuickBooksSettingsDto(fieldName));
    }

    /// <summary>
    /// PUT /api/settings/quickbooks
    /// Updates QuickBooks-related app settings. Pass null/empty
    /// projectCustomFieldName to disable Approach A (custom-field auto-linking).
    /// </summary>
    [HttpPut("quickbooks")]
    public async Task<IActionResult> UpdateQuickBooksSettings([FromBody] UpdateQuickBooksSettingsRequest req)
    {
        var trimmed = string.IsNullOrWhiteSpace(req.ProjectCustomFieldName)
            ? null
            : req.ProjectCustomFieldName.Trim();
        await _settings.SetAsync(AppSettingsService.QbProjectCustomFieldKey, trimmed);
        return Ok(new QuickBooksSettingsDto(trimmed));
    }
}

public record QuickBooksSettingsDto(string? ProjectCustomFieldName);
public record UpdateQuickBooksSettingsRequest(string? ProjectCustomFieldName);

/// <summary>Request body for POST /api/settings/adobe/credentials.</summary>
public record SetAdobeCredentialsRequest(string ClientId, string ClientSecret);
