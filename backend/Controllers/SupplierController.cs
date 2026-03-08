using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

/// <summary>
/// REST controller for supplier CRUD operations.
/// Route: /api/supplier
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class SupplierController : ControllerBase
{
    private readonly ISupplierService _suppliers;

    public SupplierController(ISupplierService suppliers) => _suppliers = suppliers;

    // GET /api/supplier
    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _suppliers.GetAllAsync());

    // GET /api/supplier/5
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var supplier = await _suppliers.GetByIdAsync(id);
        return supplier is null ? NotFound() : Ok(supplier);
    }

    // POST /api/supplier
    // Body: { name, domain, website }
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSupplierRequest request)
    {
        var (supplier, error) = await _suppliers.CreateAsync(request);

        if (error is not null)
            return Conflict(new { message = error });

        return CreatedAtAction(nameof(GetById), new { id = supplier!.Id }, supplier);
    }

    // PUT /api/supplier/5
    // Body: { name, domain, website }
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSupplierRequest request)
    {
        var (supplier, error) = await _suppliers.UpdateAsync(id, request);

        if (supplier is null && error is null) return NotFound();
        if (error is not null) return Conflict(new { message = error });

        return Ok(supplier);
    }

    // DELETE /api/supplier/5
    // EF Core cascade will also delete all GlossaryUnits for this supplier.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _suppliers.DeleteAsync(id);
        return deleted ? NoContent() : NotFound();
    }
}
