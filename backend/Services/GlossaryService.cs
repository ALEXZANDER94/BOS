using CsvHelper;
using CsvHelper.Configuration;
using System.Globalization;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

/// <summary>
/// Contract for glossary operations. All methods are scoped to a specific supplier.
/// Coding to an interface lets us swap implementations (e.g. for unit tests)
/// without changing the controller.
/// </summary>
public interface IGlossaryService
{
    Task<List<GlossaryUnitDto>> GetAllAsync(int supplierId, string? search);
    Task<GlossaryUnitDto?> GetByIdAsync(int supplierId, int id);
    Task<(GlossaryUnitDto? Unit, string? Error)> CreateAsync(int supplierId, CreateGlossaryUnitRequest request);
    Task<(GlossaryUnitDto? Unit, string? Error)> UpdateAsync(int supplierId, int id, UpdateGlossaryUnitRequest request);
    Task<bool> DeleteAsync(int supplierId, int id);
    Task<CsvImportResultDto> ImportFromCsvAsync(int supplierId, Stream csvStream, bool overwrite = false);
}

public class GlossaryService : IGlossaryService
{
    private readonly AppDbContext _db;

    // AppDbContext is injected via ASP.NET Core DI — we never 'new' it directly.
    public GlossaryService(AppDbContext db) => _db = db;

    public async Task<List<GlossaryUnitDto>> GetAllAsync(int supplierId, string? search)
    {
        var query = _db.GlossaryUnits
            .Include(u => u.Status)
            .Where(u => u.SupplierId == supplierId)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(u =>
                u.CatalogNumber.ToLower().Contains(s) ||
                u.Description.ToLower().Contains(s) ||
                u.MFR.ToLower().Contains(s));
        }

        return await query
            .OrderBy(u => u.CatalogNumber)
            .Select(u => ToDto(u))
            .ToListAsync();
    }

    public async Task<GlossaryUnitDto?> GetByIdAsync(int supplierId, int id)
    {
        var unit = await _db.GlossaryUnits
            .Include(u => u.Status)
            .FirstOrDefaultAsync(u => u.Id == id && u.SupplierId == supplierId);
        return unit is null ? null : ToDto(unit);
    }

    public async Task<(GlossaryUnitDto? Unit, string? Error)> CreateAsync(int supplierId, CreateGlossaryUnitRequest req)
    {
        // Check for duplicate catalog number within this supplier's glossary
        var exists = await _db.GlossaryUnits
            .AnyAsync(u => u.SupplierId == supplierId &&
                           u.CatalogNumber.ToLower() == req.CatalogNumber.Trim().ToLower());

        if (exists)
            return (null, $"A unit with catalog number '{req.CatalogNumber}' already exists for this supplier.");

        var unit = new GlossaryUnit
        {
            SupplierId      = supplierId,
            CatalogNumber   = req.CatalogNumber.Trim(),
            Description     = req.Description.Trim(),
            MFR             = req.MFR.Trim(),
            ContractedPrice = req.ContractedPrice,
            AddedVia        = req.AddedVia,
            StatusId        = req.StatusId,
            CreatedAt       = DateTime.UtcNow,
            UpdatedAt       = DateTime.UtcNow,
        };

        _db.GlossaryUnits.Add(unit);
        await _db.SaveChangesAsync();

        // Reload with Status navigation property populated
        await _db.Entry(unit).Reference(u => u.Status).LoadAsync();
        return (ToDto(unit), null);
    }

    public async Task<(GlossaryUnitDto? Unit, string? Error)> UpdateAsync(int supplierId, int id, UpdateGlossaryUnitRequest req)
    {
        var unit = await _db.GlossaryUnits
            .Include(u => u.Status)
            .FirstOrDefaultAsync(u => u.Id == id && u.SupplierId == supplierId);
        if (unit is null) return (null, null); // caller returns 404

        // Check for duplicate catalog number on a *different* unit within the same supplier
        var conflict = await _db.GlossaryUnits
            .AnyAsync(u => u.SupplierId == supplierId &&
                           u.CatalogNumber.ToLower() == req.CatalogNumber.Trim().ToLower() &&
                           u.Id != id);

        if (conflict)
            return (null, $"A unit with catalog number '{req.CatalogNumber}' already exists for this supplier.");

        unit.CatalogNumber   = req.CatalogNumber.Trim();
        unit.Description     = req.Description.Trim();
        unit.MFR             = req.MFR.Trim();
        unit.ContractedPrice = req.ContractedPrice;
        unit.StatusId        = req.StatusId;
        unit.Notes           = string.IsNullOrWhiteSpace(req.Notes) ? null : req.Notes.Trim();
        unit.UpdatedAt       = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // Reload Status navigation property in case StatusId changed
        await _db.Entry(unit).Reference(u => u.Status).LoadAsync();
        return (ToDto(unit), null);
    }

    public async Task<bool> DeleteAsync(int supplierId, int id)
    {
        var unit = await _db.GlossaryUnits
            .FirstOrDefaultAsync(u => u.Id == id && u.SupplierId == supplierId);
        if (unit is null) return false;

        _db.GlossaryUnits.Remove(unit);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<CsvImportResultDto> ImportFromCsvAsync(int supplierId, Stream csvStream, bool overwrite = false)
    {
        var errors        = new List<CsvRowError>();
        var toInsert      = new List<GlossaryUnit>();
        int importedCount = 0;
        int updatedCount  = 0;
        int skippedCount  = 0;

        // Load all existing units for this supplier keyed by lower-case catalog number.
        // When overwrite=true we need the full entity to update it; otherwise just the keys.
        var existingUnits = await _db.GlossaryUnits
            .Where(u => u.SupplierId == supplierId)
            .ToDictionaryAsync(u => u.CatalogNumber.ToLower(), u => u);

        // Separate HashSet of keys we've already seen within this batch, to prevent
        // two identical rows in the same CSV from both trying to write.
        var seenInBatch = new HashSet<string>(existingUnits.Keys);

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord  = true,
            // Don't throw if the header row is missing an expected column —
            // we validate field presence manually so we can give cleaner errors.
            HeaderValidated  = null,
            MissingFieldFound = null,
        };

        using var reader = new StreamReader(csvStream);
        using var csv    = new CsvReader(reader, config);

        // Move past the header row
        await csv.ReadAsync();
        csv.ReadHeader();

        int rowNumber = 0;

        while (await csv.ReadAsync())
        {
            rowNumber++;

            // Read each field — CsvHelper returns empty string for missing columns
            var catalogNumber = (csv.GetField("CatalogNumber") ?? string.Empty).Trim();
            var description   = (csv.GetField("Description")   ?? string.Empty).Trim();
            var mfr           = (csv.GetField("MFR")           ?? string.Empty).Trim();
            var priceRaw      = (csv.GetField("ContractedPrice") ?? string.Empty).Trim();

            // --- Skip blank rows (trailing empty rows from Excel/Sheets exports) ---
            if (string.IsNullOrEmpty(catalogNumber) &&
                string.IsNullOrEmpty(description)   &&
                string.IsNullOrEmpty(mfr)           &&
                string.IsNullOrEmpty(priceRaw))
            {
                continue;
            }

            // --- Validation ---
            if (string.IsNullOrEmpty(catalogNumber))
            {
                errors.Add(new CsvRowError(rowNumber, catalogNumber, "Catalog number is required."));
                continue;
            }
            if (string.IsNullOrEmpty(description))
            {
                errors.Add(new CsvRowError(rowNumber, catalogNumber, "Description is required."));
                continue;
            }
            if (string.IsNullOrEmpty(mfr))
            {
                errors.Add(new CsvRowError(rowNumber, catalogNumber, "MFR is required."));
                continue;
            }
            if (!decimal.TryParse(priceRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var price) || price <= 0)
            {
                errors.Add(new CsvRowError(rowNumber, catalogNumber, $"Contracted price '{priceRaw}' must be a positive number."));
                continue;
            }

            // --- Duplicate / overwrite logic ---
            var key = catalogNumber.ToLower();

            if (existingUnits.TryGetValue(key, out var existingUnit))
            {
                if (overwrite)
                {
                    // Update the existing entity in place — EF Core tracks the change
                    existingUnit.Description    = description;
                    existingUnit.MFR            = mfr;
                    existingUnit.ContractedPrice = price;
                    existingUnit.UpdatedAt       = DateTime.UtcNow;
                    updatedCount++;
                }
                else
                {
                    errors.Add(new CsvRowError(rowNumber, catalogNumber, "Catalog number already exists — skipped."));
                    skippedCount++;
                }
                continue;
            }

            // Guard against duplicate catalog numbers within the same CSV batch
            if (seenInBatch.Contains(key))
            {
                errors.Add(new CsvRowError(rowNumber, catalogNumber, "Duplicate catalog number within this file — skipped."));
                skippedCount++;
                continue;
            }

            seenInBatch.Add(key);

            toInsert.Add(new GlossaryUnit
            {
                SupplierId      = supplierId,
                CatalogNumber   = catalogNumber,
                Description     = description,
                MFR             = mfr,
                ContractedPrice = price,
                AddedVia        = "CSV",
                CreatedAt       = DateTime.UtcNow,
                UpdatedAt       = DateTime.UtcNow,
            });
        }

        // Single SaveChangesAsync handles both new inserts and tracked updates
        if (toInsert.Count > 0)
            _db.GlossaryUnits.AddRange(toInsert);

        if (toInsert.Count > 0 || updatedCount > 0)
            await _db.SaveChangesAsync();

        importedCount = toInsert.Count;

        return new CsvImportResultDto(
            ImportedCount: importedCount,
            UpdatedCount:  updatedCount,
            SkippedCount:  skippedCount,
            ErrorCount:    errors.Count(e => !e.Reason.Contains("skipped")),
            Errors:        errors
        );
    }

    // Static helper to map the EF entity to the DTO we send to the frontend.
    // Keeping this private keeps the mapping logic in one place.
    private static GlossaryUnitDto ToDto(GlossaryUnit u) =>
        new(u.Id, u.SupplierId, u.CatalogNumber, u.Description, u.MFR,
            u.ContractedPrice, u.AddedVia,
            u.StatusId, u.Status?.Name, u.Status?.Color,
            u.CreatedAt, u.UpdatedAt,
            u.Notes);
}
