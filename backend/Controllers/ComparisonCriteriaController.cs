using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

/// <summary>
/// Manages comparison criteria for a specific supplier.
/// Route: /api/supplier/{supplierId}/criteria
/// </summary>
[ApiController]
[Route("api/supplier/{supplierId:int}/criteria")]
public class ComparisonCriteriaController : ControllerBase
{
    private readonly IComparisonCriteriaService _service;

    public ComparisonCriteriaController(IComparisonCriteriaService service)
        => _service = service;

    /// <summary>
    /// GET /api/supplier/{supplierId}/criteria
    /// Returns the comparison criteria for this supplier, or 404 if not yet configured.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(int supplierId)
    {
        var dto = await _service.GetBySupplierIdAsync(supplierId);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    /// <summary>
    /// PUT /api/supplier/{supplierId}/criteria
    /// Creates or updates (upserts) the comparison criteria for this supplier.
    /// Returns 200 with the saved criteria DTO.
    /// </summary>
    [HttpPut]
    public async Task<IActionResult> Upsert(int supplierId, [FromBody] UpsertComparisonCriteriaRequest request)
    {
        var dto = await _service.UpsertAsync(supplierId, request);
        return Ok(dto);
    }
}
