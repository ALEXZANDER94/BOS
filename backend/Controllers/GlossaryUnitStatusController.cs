using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/glossary-unit-statuses")]
public class GlossaryUnitStatusController : ControllerBase
{
    private readonly IGlossaryUnitStatusService _service;

    public GlossaryUnitStatusController(IGlossaryUnitStatusService service) =>
        _service = service;

    // GET /api/glossary-unit-statuses
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await _service.GetAllAsync());

    // POST /api/glossary-unit-statuses
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateGlossaryUnitStatusRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required." });

        var (status, error) = await _service.CreateAsync(request);

        if (error is not null)
            return Conflict(new { message = error });

        return Ok(status);
    }

    // PUT /api/glossary-unit-statuses/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateGlossaryUnitStatusRequest request)
    {
        if (request is null || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required." });

        var (status, error) = await _service.UpdateAsync(id, request);

        if (status is null && error is null) return NotFound();
        if (error is not null) return Conflict(new { message = error });

        return Ok(status);
    }

    // DELETE /api/glossary-unit-statuses/{id}
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
