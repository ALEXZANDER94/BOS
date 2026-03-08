using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

/// <summary>
/// REST controller for supplier-scoped glossary CRUD operations.
///
/// Route: /api/supplier/{supplierId}/glossary
/// The supplierId comes from the route and is passed to every service method
/// so all queries are automatically filtered to that supplier's data.
/// </summary>
[ApiController]
[Route("api/supplier/{supplierId:int}/glossary")]
public class GlossaryController : ControllerBase
{
    private readonly IGlossaryService _glossary;

    public GlossaryController(IGlossaryService glossary) => _glossary = glossary;

    // GET /api/supplier/1/glossary
    // GET /api/supplier/1/glossary?search=acme
    [HttpGet]
    public async Task<IActionResult> GetAll([FromRoute] int supplierId, [FromQuery] string? search)
        => Ok(await _glossary.GetAllAsync(supplierId, search));

    // GET /api/supplier/1/glossary/5
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById([FromRoute] int supplierId, int id)
    {
        var unit = await _glossary.GetByIdAsync(supplierId, id);
        return unit is null ? NotFound() : Ok(unit);
    }

    // POST /api/supplier/1/glossary
    // Body: { catalogNumber, description, mfr, contractedPrice }
    [HttpPost]
    public async Task<IActionResult> Create([FromRoute] int supplierId, [FromBody] CreateGlossaryUnitRequest request)
    {
        var (unit, error) = await _glossary.CreateAsync(supplierId, request);

        if (error is not null)
            return Conflict(new { message = error });

        return CreatedAtAction(nameof(GetById), new { supplierId, id = unit!.Id }, unit);
    }

    // PUT /api/supplier/1/glossary/5
    // Body: { catalogNumber, description, mfr, contractedPrice }
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update([FromRoute] int supplierId, int id, [FromBody] UpdateGlossaryUnitRequest request)
    {
        var (unit, error) = await _glossary.UpdateAsync(supplierId, id, request);

        if (unit is null && error is null) return NotFound();
        if (error is not null) return Conflict(new { message = error });

        return Ok(unit);
    }

    // DELETE /api/supplier/1/glossary/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete([FromRoute] int supplierId, int id)
    {
        var deleted = await _glossary.DeleteAsync(supplierId, id);
        return deleted ? NoContent() : NotFound();
    }

    // POST /api/supplier/1/glossary/import
    // Body: multipart/form-data with a single "file" field containing the CSV.
    // Returns 200 OK with a CsvImportResultDto even on partial success.
    [HttpPost("import")]
    public async Task<IActionResult> Import([FromRoute] int supplierId, IFormFile? file, [FromQuery] bool overwrite = false)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file was provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".csv")
            return BadRequest(new { message = "Only .csv files are accepted." });

        const long maxBytes = 5 * 1024 * 1024; // 5 MB
        if (file.Length > maxBytes)
            return BadRequest(new { message = "File exceeds the 5 MB size limit." });

        using var stream = file.OpenReadStream();
        var result = await _glossary.ImportFromCsvAsync(supplierId, stream, overwrite);
        return Ok(result);
    }
}
