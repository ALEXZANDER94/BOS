using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/libraries")]
public class LibrariesController : ControllerBase
{
    private readonly ILibraryService _libraries;
    public LibrariesController(ILibraryService libraries) => _libraries = libraries;

    // Libraries are scoped per-client. clientId is required on the list endpoint.
    [HttpGet]
    public async Task<IActionResult> GetForClient([FromQuery] int clientId)
    {
        if (clientId <= 0) return BadRequest("clientId is required.");
        return Ok(await _libraries.GetForClientAsync(clientId));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var dto = await _libraries.GetByIdAsync(id);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    // Multipart upload: clientId, title, description, pdf
    [HttpPost]
    [RequestSizeLimit(28_000_000)] // 25 MB + envelope
    public async Task<IActionResult> Create(
        [FromForm] int clientId,
        [FromForm] string title,
        [FromForm] string? description,
        IFormFile? pdf = null)
    {
        if (clientId <= 0)
            return BadRequest("clientId is required.");
        if (string.IsNullOrWhiteSpace(title))
            return BadRequest("Title is required.");

        try
        {
            var dto = await _libraries.CreateAsync(clientId, title, description ?? "", pdf);
            return CreatedAtAction(nameof(GetById), new { id = dto.Id }, dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    // PUT as multipart: PDF is optional on update.
    [HttpPut("{id:int}")]
    [RequestSizeLimit(28_000_000)]
    public async Task<IActionResult> Update(
        int id,
        [FromForm] string title,
        [FromForm] string? description,
        IFormFile? pdf)
    {
        if (string.IsNullOrWhiteSpace(title))
            return BadRequest("Title is required.");

        try
        {
            var dto = await _libraries.UpdateAsync(id, title, description ?? "", pdf);
            if (dto is null) return NotFound();
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var ok = await _libraries.DeleteAsync(id);
        if (!ok) return NotFound();
        return NoContent();
    }

    // Authenticated PDF stream — never cached, never indexed.
    [HttpGet("{id:int}/pdf")]
    public async Task<IActionResult> GetPdf(int id)
    {
        var result = await _libraries.GetPdfAsync(id);
        if (result is null) return NotFound();

        var (stream, fileName) = result.Value;

        Response.Headers.Append("X-Robots-Tag", "noindex, nofollow, noarchive");
        Response.Headers.Append("Cache-Control", "private, no-store");

        return File(stream, "application/pdf", fileName, enableRangeProcessing: false);
    }

    [HttpPost("{id:int}/upgrades/{upgradeId:int}")]
    public async Task<IActionResult> AddUpgrade(int id, int upgradeId)
    {
        try
        {
            var dto = await _libraries.AddUpgradeAsync(id, upgradeId);
            if (dto is null) return NotFound();
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    [HttpDelete("{id:int}/upgrades/{upgradeId:int}")]
    public async Task<IActionResult> RemoveUpgrade(int id, int upgradeId)
    {
        var dto = await _libraries.RemoveUpgradeAsync(id, upgradeId);
        if (dto is null) return NotFound();
        return Ok(dto);
    }
}
