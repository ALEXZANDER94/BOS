using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/client/{clientId:int}/addon")]
[Authorize]
public class ClientAddonsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ClientAddonsController(AppDbContext db) => _db = db;

    // GET /api/client/{clientId}/addon
    [HttpGet]
    public async Task<IActionResult> GetAll(int clientId)
    {
        var addons = await _db.ClientAddons
            .Where(a => a.ClientId == clientId)
            .Include(a => a.Assignments)
                .ThenInclude(x => x.Project)
            .OrderBy(a => a.Code)
            .ToListAsync();

        return Ok(addons.Select(ToDto));
    }

    // POST /api/client/{clientId}/addon
    [HttpPost]
    public async Task<IActionResult> Create(int clientId, [FromBody] CreateAddonRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { message = "Code is required." });

        bool duplicate = await _db.ClientAddons
            .AnyAsync(a => a.ClientId == clientId &&
                           a.Code.ToLower() == req.Code.Trim().ToLower());
        if (duplicate)
            return Conflict(new { message = $"An option with code '{req.Code.Trim()}' already exists for this client." });

        var addon = new ClientAddon
        {
            ClientId    = clientId,
            Code        = req.Code.Trim(),
            Description = req.Description.Trim(),
            Notes       = req.Notes.Trim(),
        };

        _db.ClientAddons.Add(addon);
        await _db.SaveChangesAsync();
        return Ok(ToDto(addon));
    }

    // PUT /api/client/{clientId}/addon/{addonId}
    [HttpPut("{addonId:int}")]
    public async Task<IActionResult> Update(int clientId, int addonId, [FromBody] UpdateAddonRequest req)
    {
        var addon = await _db.ClientAddons
            .Include(a => a.Assignments).ThenInclude(x => x.Project)
            .FirstOrDefaultAsync(a => a.Id == addonId && a.ClientId == clientId);

        if (addon is null) return NotFound();

        if (string.IsNullOrWhiteSpace(req.Code))
            return BadRequest(new { message = "Code is required." });

        if (!string.Equals(addon.Code, req.Code.Trim(), StringComparison.OrdinalIgnoreCase))
        {
            bool duplicate = await _db.ClientAddons
                .AnyAsync(a => a.ClientId == clientId &&
                               a.Id != addonId &&
                               a.Code.ToLower() == req.Code.Trim().ToLower());
            if (duplicate)
                return Conflict(new { message = $"An option with code '{req.Code.Trim()}' already exists for this client." });
        }

        addon.Code        = req.Code.Trim();
        addon.Description = req.Description.Trim();
        addon.Notes       = req.Notes.Trim();

        await _db.SaveChangesAsync();
        return Ok(ToDto(addon));
    }

    // DELETE /api/client/{clientId}/addon/{addonId}
    [HttpDelete("{addonId:int}")]
    public async Task<IActionResult> Delete(int clientId, int addonId)
    {
        var addon = await _db.ClientAddons
            .FirstOrDefaultAsync(a => a.Id == addonId && a.ClientId == clientId);

        if (addon is null) return NotFound();

        _db.ClientAddons.Remove(addon);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // PUT /api/client/{clientId}/addon/{addonId}/assignment/{projectId}
    [HttpPut("{addonId:int}/assignment/{projectId:int}")]
    public async Task<IActionResult> UpsertAssignment(
        int clientId, int addonId, int projectId,
        [FromBody] UpsertAssignmentRequest req)
    {
        // Verify addon belongs to client
        bool addonExists = await _db.ClientAddons
            .AnyAsync(a => a.Id == addonId && a.ClientId == clientId);
        if (!addonExists) return NotFound();

        // Verify project belongs to client
        bool projectExists = await _db.Projects
            .AnyAsync(p => p.Id == projectId && p.ClientId == clientId);
        if (!projectExists) return NotFound();

        var existing = await _db.ProjectAddonAssignments
            .FirstOrDefaultAsync(x => x.AddonId == addonId && x.ProjectId == projectId);

        if (existing is null)
        {
            existing = new ProjectAddonAssignment
            {
                AddonId   = addonId,
                ProjectId = projectId,
                Price     = req.Price,
            };
            _db.ProjectAddonAssignments.Add(existing);
        }
        else
        {
            existing.Price = req.Price;
        }

        await _db.SaveChangesAsync();

        var project = await _db.Projects.FindAsync(projectId);
        return Ok(new ProjectAssignmentDto(projectId, project!.Name, existing.Price));
    }

    // DELETE /api/client/{clientId}/addon/{addonId}/assignment/{projectId}
    [HttpDelete("{addonId:int}/assignment/{projectId:int}")]
    public async Task<IActionResult> RemoveAssignment(int clientId, int addonId, int projectId)
    {
        bool addonExists = await _db.ClientAddons
            .AnyAsync(a => a.Id == addonId && a.ClientId == clientId);
        if (!addonExists) return NotFound();

        var assignment = await _db.ProjectAddonAssignments
            .FirstOrDefaultAsync(x => x.AddonId == addonId && x.ProjectId == projectId);

        if (assignment is null) return NotFound();

        _db.ProjectAddonAssignments.Remove(assignment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/client/{clientId}/addon/import
    [HttpPost("import")]
    public async Task<IActionResult> Import(int clientId, IFormFile file, [FromForm] int projectId)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        if (!Path.GetExtension(file.FileName).Equals(".csv", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only CSV files are accepted." });

        bool projectExists = await _db.Projects
            .AnyAsync(p => p.Id == projectId && p.ClientId == clientId);
        if (!projectExists)
            return BadRequest(new { message = "The selected project does not belong to this client." });

        var result = await ImportCsvAsync(clientId, projectId, file);
        return Ok(result);
    }

    // ── CSV import logic ──────────────────────────────────────────────────────

    private async Task<AddonCsvImportResultDto> ImportCsvAsync(int clientId, int projectId, IFormFile file)
    {
        var errors               = new List<AddonCsvRowError>();
        int addonsCreated        = 0;
        int addonsUpdated        = 0;
        int assignmentsCreated   = 0;
        int assignmentsUpdated   = 0;

        var existingAddons = await _db.ClientAddons
            .Where(a => a.ClientId == clientId)
            .Include(a => a.Assignments)
            .ToListAsync();

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord   = true,
            TrimOptions       = TrimOptions.Trim,
            MissingFieldFound = null,
        };

        using var reader = new StreamReader(file.OpenReadStream());
        using var csv    = new CsvReader(reader, config);

        await csv.ReadAsync();
        csv.ReadHeader();

        int rowNumber = 0;

        while (await csv.ReadAsync())
        {
            rowNumber++;

            var code        = csv.GetField("Code")?.Trim()        ?? "";
            var description = csv.GetField("Description")?.Trim() ?? "";
            var notes       = csv.GetField("Notes")?.Trim()       ?? "";
            var priceRaw    = csv.GetField("Price")?.Trim()       ?? "";

            if (string.IsNullOrEmpty(code) && string.IsNullOrEmpty(description))
                continue;

            if (string.IsNullOrEmpty(code))
            {
                errors.Add(new AddonCsvRowError(rowNumber, "", "Code is required."));
                continue;
            }

            decimal? price = null;
            if (!string.IsNullOrEmpty(priceRaw) &&
                !priceRaw.Equals("N/A", StringComparison.OrdinalIgnoreCase))
            {
                if (decimal.TryParse(priceRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
                    price = parsed;
            }

            // Find or create the addon
            var addon = existingAddons.FirstOrDefault(a =>
                string.Equals(a.Code, code, StringComparison.OrdinalIgnoreCase));

            if (addon is null)
            {
                addon = new ClientAddon
                {
                    ClientId    = clientId,
                    Code        = code,
                    Description = description,
                    Notes       = notes,
                };
                _db.ClientAddons.Add(addon);
                await _db.SaveChangesAsync();
                existingAddons.Add(addon);
                addonsCreated++;
            }
            else
            {
                addon.Description = description;
                addon.Notes       = notes;
                addonsUpdated++;
            }

            // Upsert the assignment for the selected project
            var assignment = addon.Assignments.FirstOrDefault(x => x.ProjectId == projectId);
            if (assignment is null)
            {
                assignment = new ProjectAddonAssignment
                {
                    AddonId   = addon.Id,
                    ProjectId = projectId,
                    Price     = price,
                };
                _db.ProjectAddonAssignments.Add(assignment);
                addon.Assignments.Add(assignment);
                assignmentsCreated++;
            }
            else
            {
                assignment.Price = price;
                assignmentsUpdated++;
            }
        }

        await _db.SaveChangesAsync();

        return new AddonCsvImportResultDto(
            addonsCreated,
            addonsUpdated,
            assignmentsCreated,
            assignmentsUpdated,
            errors.Count,
            errors);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static ClientAddonDto ToDto(ClientAddon a) => new(
        a.Id, a.ClientId, a.Code, a.Description, a.Notes,
        a.Assignments
            .OrderBy(x => x.Project?.Name)
            .Select(x => new ProjectAssignmentDto(x.ProjectId, x.Project?.Name ?? "", x.Price))
            .ToList());
}
