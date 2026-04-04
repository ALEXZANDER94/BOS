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
[Route("api/project/{projectId:int}/building")]
[Authorize]
public class BuildingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public BuildingsController(AppDbContext db) => _db = db;

    // GET /api/project/1/building
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var buildings = await _db.Buildings
            .Where(b => b.ProjectId == projectId)
            .Include(b => b.Lots)
                .ThenInclude(l => l.Address)
            .OrderBy(b => b.Name)
            .ToListAsync();

        return Ok(buildings.Select(ToDto));
    }

    // POST /api/project/1/building
    [HttpPost]
    public async Task<IActionResult> Create(int projectId, [FromBody] CreateBuildingRequest req)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound(new { message = "Project not found." });

        var building = new Building
        {
            ProjectId   = projectId,
            Name        = req.Name.Trim(),
            Description = req.Description?.Trim() ?? string.Empty,
        };

        _db.Buildings.Add(building);
        await _db.SaveChangesAsync();
        return Ok(ToDto(building));
    }

    // PUT /api/project/1/building/5
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int projectId, int id, [FromBody] UpdateBuildingRequest req)
    {
        var building = await _db.Buildings
            .Include(b => b.Lots).ThenInclude(l => l.Address)
            .FirstOrDefaultAsync(b => b.Id == id && b.ProjectId == projectId);

        if (building is null) return NotFound();

        building.Name        = req.Name.Trim();
        building.Description = req.Description?.Trim() ?? string.Empty;
        await _db.SaveChangesAsync();

        return Ok(ToDto(building));
    }

    // DELETE /api/project/1/building/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int projectId, int id)
    {
        var building = await _db.Buildings
            .FirstOrDefaultAsync(b => b.Id == id && b.ProjectId == projectId);

        if (building is null) return NotFound();

        _db.Buildings.Remove(building);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/project/1/building/import
    [HttpPost("import")]
    public async Task<IActionResult> ImportFromCsv(int projectId, IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound(new { message = "Project not found." });

        var errors           = new List<BuildingLotCsvRowError>();
        int buildingsCreated = 0;
        int buildingsExisting = 0;
        int lotsCreated      = 0;
        int lotsExisting     = 0;
        int addressesSet     = 0;

        // Load existing buildings + lots for this project into memory
        var buildings = await _db.Buildings
            .Where(b => b.ProjectId == projectId)
            .Include(b => b.Lots).ThenInclude(l => l.Address)
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

            var buildingName  = csv.GetField("BuildingName")?.Trim()  ?? "";
            var lotName       = csv.GetField("LotName")?.Trim()       ?? "";
            var lotDesc       = csv.GetField("LotDescription")?.Trim() ?? "";
            var addrNumber    = csv.GetField("AddressNumber")?.Trim()  ?? "";
            var addrStreet    = csv.GetField("AddressStreet")?.Trim()  ?? "";
            var city          = csv.GetField("City")?.Trim()           ?? "";
            var state         = csv.GetField("State")?.Trim()          ?? "";
            var zip           = csv.GetField("Zip")?.Trim()            ?? "";
            var country       = csv.GetField("Country")?.Trim()        ?? "";

            // Skip completely blank rows
            if (string.IsNullOrEmpty(buildingName) && string.IsNullOrEmpty(lotName))
                continue;

            if (string.IsNullOrEmpty(buildingName))
            {
                errors.Add(new BuildingLotCsvRowError(rowNumber, "", lotName, "Building name is required."));
                continue;
            }
            if (string.IsNullOrEmpty(lotName))
            {
                errors.Add(new BuildingLotCsvRowError(rowNumber, buildingName, "", "Lot name is required."));
                continue;
            }

            // Get or create building
            var building = buildings.FirstOrDefault(b =>
                string.Equals(b.Name, buildingName, StringComparison.OrdinalIgnoreCase));

            if (building is null)
            {
                building = new Building { ProjectId = projectId, Name = buildingName, Description = "" };
                _db.Buildings.Add(building);
                await _db.SaveChangesAsync();
                building.Lots = new List<Lot>();
                buildings.Add(building);
                buildingsCreated++;
            }
            else
            {
                buildingsExisting++;
            }

            // Get or create lot
            var lot = building.Lots.FirstOrDefault(l =>
                string.Equals(l.Name, lotName, StringComparison.OrdinalIgnoreCase));

            if (lot is null)
            {
                lot = new Lot { BuildingId = building.Id, Name = lotName, Description = lotDesc };
                _db.Lots.Add(lot);
                await _db.SaveChangesAsync();
                building.Lots.Add(lot);
                lotsCreated++;
            }
            else
            {
                // Update description if provided and lot already existed
                if (!string.IsNullOrEmpty(lotDesc) && lot.Description != lotDesc)
                {
                    lot.Description = lotDesc;
                    await _db.SaveChangesAsync();
                }
                lotsExisting++;
            }

            // Upsert address if any address field is present
            var address1 = string.Join(" ", new[] { addrNumber, addrStreet }.Where(s => !string.IsNullOrEmpty(s)));
            bool hasAddress = !string.IsNullOrEmpty(address1) || !string.IsNullOrEmpty(city) ||
                              !string.IsNullOrEmpty(state)    || !string.IsNullOrEmpty(zip);

            if (hasAddress)
            {
                // Reload address if not loaded
                if (lot.Address is null)
                {
                    var existingAddr = await _db.Addresses.FirstOrDefaultAsync(a => a.LotId == lot.Id);
                    lot.Address = existingAddr;
                }

                if (lot.Address is null)
                {
                    var addr = new Address
                    {
                        LotId    = lot.Id,
                        Address1 = address1,
                        Address2 = "",
                        City     = city,
                        State    = state,
                        Zip      = zip,
                        Country  = country,
                    };
                    _db.Addresses.Add(addr);
                    lot.Address = addr;
                }
                else
                {
                    lot.Address.Address1 = address1;
                    lot.Address.City     = city;
                    lot.Address.State    = state;
                    lot.Address.Zip      = zip;
                    lot.Address.Country  = country;
                }

                await _db.SaveChangesAsync();
                addressesSet++;
            }
        }

        return Ok(new BuildingLotCsvImportResultDto(
            buildingsCreated,
            buildingsExisting,
            lotsCreated,
            lotsExisting,
            addressesSet,
            errors.Count,
            errors));
    }

    // ── Mapping ───────────────────────────────────────────────────────────────

    private static BuildingDto ToDto(Building b) => new(
        b.Id,
        b.ProjectId,
        b.Name,
        b.Description,
        b.Lots.OrderBy(l => l.Name).Select(LotToDto).ToList());

    private static LotDto LotToDto(Lot l) => new(
        l.Id,
        l.BuildingId,
        l.Name,
        l.Description,
        l.Address is null ? null : new AddressDto(
            l.Address.Id,
            l.Address.Address1,
            l.Address.Address2,
            l.Address.City,
            l.Address.State,
            l.Address.Zip,
            l.Address.Country));
}
