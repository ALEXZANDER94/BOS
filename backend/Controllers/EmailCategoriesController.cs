using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/email-categories")]
[Authorize]
public class EmailCategoriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public EmailCategoriesController(AppDbContext db) => _db = db;

    private string CurrentUserEmail =>
        User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // GET /api/email-categories
    // Returns all categories with their statuses ordered by display order.
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var categories = await _db.EmailCategories
            .Include(c => c.Statuses.OrderBy(s => s.DisplayOrder))
            .OrderBy(c => c.CreatedAt)
            .ToListAsync();

        return Ok(categories.Select(ToDto));
    }

    // POST /api/email-categories
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateEmailCategoryRequest req)
    {
        var category = new EmailCategory
        {
            Name               = req.Name.Trim(),
            Color              = req.Color,
            CreatedByUserEmail = CurrentUserEmail,
        };
        _db.EmailCategories.Add(category);
        await _db.SaveChangesAsync();
        await _db.Entry(category).Collection(c => c.Statuses).LoadAsync();
        return CreatedAtAction(nameof(GetAll), new { id = category.Id }, ToDto(category));
    }

    // PUT /api/email-categories/{id}
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateEmailCategoryRequest req)
    {
        var category = await _db.EmailCategories.FindAsync(id);
        if (category == null) return NotFound();

        category.Name      = req.Name.Trim();
        category.Color     = req.Color;
        category.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _db.Entry(category).Collection(c => c.Statuses).LoadAsync();
        return Ok(ToDto(category));
    }

    // DELETE /api/email-categories/{id}
    // Cascades to EmailCategoryStatuses and EmailAssignments.
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var category = await _db.EmailCategories.FindAsync(id);
        if (category == null) return NotFound();

        _db.EmailCategories.Remove(category);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/email-categories/{id}/statuses
    [HttpPost("{id:int}/statuses")]
    public async Task<IActionResult> AddStatus(
        int id, [FromBody] CreateEmailCategoryStatusRequest req)
    {
        var category = await _db.EmailCategories.FindAsync(id);
        if (category == null) return NotFound();

        var status = new EmailCategoryStatus
        {
            CategoryId         = id,
            Name               = req.Name.Trim(),
            Color              = req.Color,
            DisplayOrder       = req.DisplayOrder,
            CreatedByUserEmail = CurrentUserEmail,
        };
        _db.EmailCategoryStatuses.Add(status);
        await _db.SaveChangesAsync();
        return Ok(ToStatusDto(status));
    }

    // PUT /api/email-categories/{id}/statuses/{statusId}
    [HttpPut("{id:int}/statuses/{statusId:int}")]
    public async Task<IActionResult> UpdateStatus(
        int id, int statusId, [FromBody] UpdateEmailCategoryStatusRequest req)
    {
        var status = await _db.EmailCategoryStatuses
            .FirstOrDefaultAsync(s => s.Id == statusId && s.CategoryId == id);
        if (status == null) return NotFound();

        status.Name         = req.Name.Trim();
        status.Color        = req.Color;
        status.DisplayOrder = req.DisplayOrder;
        status.UpdatedAt    = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ToStatusDto(status));
    }

    // DELETE /api/email-categories/{id}/statuses/{statusId}
    [HttpDelete("{id:int}/statuses/{statusId:int}")]
    public async Task<IActionResult> DeleteStatus(int id, int statusId)
    {
        var status = await _db.EmailCategoryStatuses
            .FirstOrDefaultAsync(s => s.Id == statusId && s.CategoryId == id);
        if (status == null) return NotFound();

        _db.EmailCategoryStatuses.Remove(status);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Mapping helpers ───────────────────────────────────────────────────────

    private static EmailCategoryDto ToDto(EmailCategory c) => new(
        c.Id, c.Name, c.Color, c.CreatedByUserEmail,
        c.Statuses.Select(ToStatusDto).ToList());

    private static EmailCategoryStatusDto ToStatusDto(EmailCategoryStatus s) => new(
        s.Id, s.CategoryId, s.Name, s.Color, s.DisplayOrder);
}
