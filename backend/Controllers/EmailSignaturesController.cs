using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/email-signatures")]
[Authorize]
public class EmailSignaturesController : ControllerBase
{
    private readonly AppDbContext _db;
    public EmailSignaturesController(AppDbContext db) => _db = db;

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    [HttpGet]
    public async Task<IActionResult> ListSignatures()
    {
        var email = CurrentUserEmail;
        var sigs = await _db.EmailSignatures
            .Where(s => s.OwnerUserEmail == email)
            .OrderByDescending(s => s.IsDefault).ThenBy(s => s.AliasEmail ?? "").ThenBy(s => s.Name)
            .Select(s => new EmailSignatureDto(
                s.Id, s.OwnerUserEmail, s.AliasEmail,
                s.Name, s.BodyHtml, s.IsDefault,
                s.CreatedAt, s.UpdatedAt))
            .ToListAsync();
        return Ok(sigs);
    }

    [HttpGet("for-alias")]
    public async Task<IActionResult> GetForAlias([FromQuery] string? alias)
    {
        var email = CurrentUserEmail;
        var sig = await _db.EmailSignatures
            .Where(s => s.OwnerUserEmail == email && s.AliasEmail == alias && s.IsDefault)
            .FirstOrDefaultAsync();

        if (sig == null)
            sig = await _db.EmailSignatures
                .Where(s => s.OwnerUserEmail == email && s.AliasEmail == null && s.IsDefault)
                .FirstOrDefaultAsync();

        if (sig == null) return Ok((EmailSignatureDto?)null);

        return Ok(new EmailSignatureDto(
            sig.Id, sig.OwnerUserEmail, sig.AliasEmail,
            sig.Name, sig.BodyHtml, sig.IsDefault,
            sig.CreatedAt, sig.UpdatedAt));
    }

    [HttpPost]
    public async Task<IActionResult> CreateSignature([FromBody] CreateEmailSignatureRequest req)
    {
        var email = CurrentUserEmail;
        var now   = DateTime.UtcNow;

        if (req.IsDefault)
        {
            var existing = await _db.EmailSignatures
                .Where(s => s.OwnerUserEmail == email && s.AliasEmail == req.AliasEmail && s.IsDefault)
                .ToListAsync();
            foreach (var s in existing) s.IsDefault = false;
        }

        var sig = new EmailSignature
        {
            OwnerUserEmail = email,
            AliasEmail     = req.AliasEmail?.Trim(),
            Name           = req.Name.Trim(),
            BodyHtml       = req.BodyHtml,
            IsDefault      = req.IsDefault,
            CreatedAt      = now,
            UpdatedAt      = now,
        };
        _db.EmailSignatures.Add(sig);
        await _db.SaveChangesAsync();

        return Ok(new EmailSignatureDto(
            sig.Id, sig.OwnerUserEmail, sig.AliasEmail,
            sig.Name, sig.BodyHtml, sig.IsDefault,
            sig.CreatedAt, sig.UpdatedAt));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateSignature(int id, [FromBody] UpdateEmailSignatureRequest req)
    {
        var email = CurrentUserEmail;
        var sig = await _db.EmailSignatures.FirstOrDefaultAsync(s => s.Id == id && s.OwnerUserEmail == email);
        if (sig == null) return NotFound();

        if (req.IsDefault)
        {
            var existing = await _db.EmailSignatures
                .Where(s => s.OwnerUserEmail == email && s.AliasEmail == req.AliasEmail && s.IsDefault && s.Id != id)
                .ToListAsync();
            foreach (var s in existing) s.IsDefault = false;
        }

        sig.AliasEmail = req.AliasEmail?.Trim();
        sig.Name       = req.Name.Trim();
        sig.BodyHtml   = req.BodyHtml;
        sig.IsDefault  = req.IsDefault;
        sig.UpdatedAt  = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return Ok(new EmailSignatureDto(
            sig.Id, sig.OwnerUserEmail, sig.AliasEmail,
            sig.Name, sig.BodyHtml, sig.IsDefault,
            sig.CreatedAt, sig.UpdatedAt));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteSignature(int id)
    {
        var email = CurrentUserEmail;
        var sig = await _db.EmailSignatures.FirstOrDefaultAsync(s => s.Id == id && s.OwnerUserEmail == email);
        if (sig == null) return NotFound();
        _db.EmailSignatures.Remove(sig);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
