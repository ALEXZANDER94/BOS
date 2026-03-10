using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/user-preferences")]
[Authorize]
public class UserPreferencesController : ControllerBase
{
    private readonly AppDbContext _db;

    public UserPreferencesController(AppDbContext db)
    {
        _db = db;
    }

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // GET /api/user-preferences/{key}
    // Returns the stored value for the given preference key, or 404 if not set.
    [HttpGet("{key}")]
    public async Task<IActionResult> Get(string key)
    {
        var pref = await _db.UserPreferences
            .FirstOrDefaultAsync(p => p.UserEmail == CurrentUserEmail && p.Key == key);

        if (pref == null) return NotFound();

        return Ok(new UserPreferenceResponse(pref.Value));
    }

    // PUT /api/user-preferences/{key}
    // Upserts the value for the given preference key.
    [HttpPut("{key}")]
    public async Task<IActionResult> Set(string key, [FromBody] SetPreferenceRequest req)
    {
        var userEmail = CurrentUserEmail;

        var pref = await _db.UserPreferences
            .FirstOrDefaultAsync(p => p.UserEmail == userEmail && p.Key == key);

        if (pref != null)
        {
            pref.Value = req.Value;
        }
        else
        {
            _db.UserPreferences.Add(new UserPreference
            {
                UserEmail = userEmail,
                Key       = key,
                Value     = req.Value,
            });
        }

        await _db.SaveChangesAsync();
        return Ok(new UserPreferenceResponse(req.Value));
    }
}
