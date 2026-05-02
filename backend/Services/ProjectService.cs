using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IProjectService
{
    Task<List<ProjectDto>>                  GetAllAsync(int clientId);
    Task<List<ProjectWithClientDto>>        GetAllProjectsAsync(string? search, string? status, int? clientId);
    Task<ProjectDetailDto?>                 GetByIdAsync(int id);
    Task<ProjectDto>                        CreateAsync(int clientId, CreateProjectRequest request);
    Task<(ProjectDto? Dto, string? Error)>  UpdateAsync(int clientId, int id, UpdateProjectRequest request);
    Task<bool>                              DeleteAsync(int clientId, int id);
    Task                                    AssignContactAsync(int clientId, int projectId, int contactId);
    Task                                    UnassignContactAsync(int clientId, int projectId, int contactId);
    Task<PoCsvImportResultDto>              ImportPurchaseOrdersAsync(int projectId, IFormFile file, IReadOnlySet<string>? orderNumbersToUpdate = null);
    Task<ProjectCsvImportResultDto>         ImportProjectsAsync(IFormFile file);
}

public class ProjectService : IProjectService
{
    private readonly AppDbContext _db;

    public ProjectService(AppDbContext db) => _db = db;

    public async Task<List<ProjectDto>> GetAllAsync(int clientId)
    {
        var projects = await _db.Projects
            .Where(p => p.ClientId == clientId)
            .Include(p => p.ProjectContacts).ThenInclude(pc => pc.Contact)
            .OrderByDescending(p => p.StartDate)
            .ThenBy(p => p.Name)
            .ToListAsync();

        return projects.Select(ToDto).ToList();
    }

    public async Task<ProjectDetailDto?> GetByIdAsync(int id)
    {
        var project = await _db.Projects
            .Include(p => p.Client)
            .Include(p => p.ProjectContacts).ThenInclude(pc => pc.Contact)
            .Include(p => p.SourceLibrary)
            .Include(p => p.CustomUpgrades).ThenInclude(cu => cu.CustomUpgrade)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (project is null) return null;

        var buildingCount = await _db.Buildings.CountAsync(b => b.ProjectId == id);
        var buildingIds   = await _db.Buildings
            .Where(b => b.ProjectId == id)
            .Select(b => b.Id)
            .ToListAsync();
        var lotCount      = await _db.Lots.CountAsync(l => buildingIds.Contains(l.BuildingId));
        var poCount       = await _db.PurchaseOrders.CountAsync(po => po.ProjectId == id);
        var totalAmount   = (decimal)(await _db.PurchaseOrders
            .Where(po => po.ProjectId == id)
            .SumAsync(po => (double?)po.Amount) ?? 0.0);

        return new ProjectDetailDto(
            project.Id,
            project.ClientId,
            project.Client!.Name,
            project.Name,
            project.Description,
            project.Status,
            project.StartDate.HasValue ? project.StartDate.Value.ToString("o") : null,
            project.EndDate.HasValue   ? project.EndDate.Value.ToString("o")   : null,
            project.CreatedAt.ToString("o"),
            project.UpdatedAt.ToString("o"),
            buildingCount,
            lotCount,
            poCount,
            totalAmount,
            project.ProjectContacts.Select(pc => new AssignedContactDto(
                pc.Contact.Id,
                pc.Contact.Name,
                pc.Contact.Email,
                pc.Contact.Phone,
                pc.Contact.Title
            )).ToList(),
            project.SourceProposalId,
            project.SourceLibraryId,
            project.SourceLibrary?.Title,
            project.Address,
            project.City,
            project.ProductStandards,
            project.Version,
            project.BuyerUpgrades,
            project.RevisionsAfterLaunch,
            project.CustomUpgrades.Select(cu => new ProjectUpgradeStateDto(
                cu.CustomUpgradeId,
                cu.CustomUpgrade?.Name ?? "",
                cu.CustomUpgrade?.Description ?? "",
                cu.CustomUpgrade?.IsGlobal ?? false,
                cu.IsEnabled
            )).ToList(),
            project.QbProjectId,
            project.QbProjectName
        );
    }

    public async Task<List<ProjectWithClientDto>> GetAllProjectsAsync(string? search, string? status, int? clientId)
    {
        var query = _db.Projects
            .Include(p => p.Client)
            .AsQueryable();

        if (clientId.HasValue)
            query = query.Where(p => p.ClientId == clientId.Value);

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(p => p.Name.ToLower().Contains(lower));
        }

        var projects = await query
            .OrderByDescending(p => p.StartDate)
            .ThenBy(p => p.Name)
            .ToListAsync();

        return projects.Select(p => new ProjectWithClientDto(
            p.Id,
            p.ClientId,
            p.Client!.Name,
            p.Name,
            p.Description,
            p.Status,
            p.StartDate,
            p.EndDate,
            p.CreatedAt,
            p.UpdatedAt
        )).ToList();
    }

    public async Task<ProjectDto> CreateAsync(int clientId, CreateProjectRequest req)
    {
        var project = new Project
        {
            ClientId    = clientId,
            Name        = req.Name.Trim(),
            Description = req.Description.Trim(),
            Status      = req.Status,
            StartDate   = req.StartDate,
            EndDate     = req.EndDate,
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow,
        };

        _db.Projects.Add(project);
        await _db.SaveChangesAsync();
        return ToDto(project);
    }

    public async Task<(ProjectDto? Dto, string? Error)> UpdateAsync(int clientId, int id, UpdateProjectRequest req)
    {
        var project = await _db.Projects
            .FirstOrDefaultAsync(p => p.ClientId == clientId && p.Id == id);

        if (project is null) return (null, null);

        project.Name        = req.Name.Trim();
        project.Description = req.Description.Trim();
        project.Status      = req.Status;
        project.StartDate   = req.StartDate;
        project.EndDate     = req.EndDate;
        project.UpdatedAt   = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return (ToDto(project), null);
    }

    public async Task<bool> DeleteAsync(int clientId, int id)
    {
        var project = await _db.Projects
            .FirstOrDefaultAsync(p => p.ClientId == clientId && p.Id == id);

        if (project is null) return false;

        _db.Projects.Remove(project);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task AssignContactAsync(int clientId, int projectId, int contactId)
    {
        _ = await _db.Projects.FirstOrDefaultAsync(p => p.Id == projectId && p.ClientId == clientId)
            ?? throw new KeyNotFoundException("Project not found.");

        _ = await _db.Contacts.FirstOrDefaultAsync(c => c.Id == contactId && c.ClientId == clientId)
            ?? throw new KeyNotFoundException("Contact not found for this client.");

        bool already = await _db.ProjectContacts
            .AnyAsync(pc => pc.ProjectId == projectId && pc.ContactId == contactId);

        if (!already)
        {
            _db.ProjectContacts.Add(new ProjectContact { ProjectId = projectId, ContactId = contactId });
            await _db.SaveChangesAsync();
        }
    }

    public async Task UnassignContactAsync(int clientId, int projectId, int contactId)
    {
        var pc = await _db.ProjectContacts
            .FirstOrDefaultAsync(pc => pc.ProjectId == projectId && pc.ContactId == contactId);

        if (pc is not null)
        {
            _db.ProjectContacts.Remove(pc);
            await _db.SaveChangesAsync();
        }
    }

    public async Task<PoCsvImportResultDto> ImportPurchaseOrdersAsync(int projectId, IFormFile file, IReadOnlySet<string>? orderNumbersToUpdate = null)
    {
        var errors           = new List<PoCsvRowError>();
        var conflicts        = new List<PoCsvConflict>();
        int importedCount    = 0;
        int updatedCount     = 0;
        int skippedCount     = 0;
        int buildingsCreated = 0;
        int lotsCreated      = 0;

        // Load existing buildings + lots for this project into memory
        var buildings = await _db.Buildings
            .Where(b => b.ProjectId == projectId)
            .Include(b => b.Lots)
            .ToListAsync();

        // Load existing POs to detect duplicates
        var existingPos = await _db.PurchaseOrders
            .Include(po => po.Lot).ThenInclude(l => l!.Building)
            .Where(po => po.ProjectId == projectId)
            .ToListAsync();

        var existingPoByOrderNumber = existingPos
            .ToDictionary(po => po.OrderNumber.ToLower(), po => po);

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
        var now       = DateTime.UtcNow;

        while (await csv.ReadAsync())
        {
            rowNumber++;

            var orderNumber  = csv.GetField("OrderNumber")?.Trim()  ?? "";
            var buildingName = csv.GetField("BuildingName")?.Trim() ?? "";
            var lotName      = csv.GetField("LotName")?.Trim()      ?? "";
            var amountRaw    = csv.GetField("Amount")?.Trim()        ?? "";
            var statusRaw    = csv.GetField("Status")?.Trim()        ?? "";

            // Skip completely blank rows
            if (string.IsNullOrEmpty(orderNumber) && string.IsNullOrEmpty(buildingName) &&
                string.IsNullOrEmpty(lotName)     && string.IsNullOrEmpty(amountRaw))
                continue;

            // Validate required fields
            if (string.IsNullOrEmpty(orderNumber))
            {
                errors.Add(new PoCsvRowError(rowNumber, "", "Order number is required."));
                continue;
            }
            if (string.IsNullOrEmpty(buildingName))
            {
                errors.Add(new PoCsvRowError(rowNumber, orderNumber, "Building name is required."));
                continue;
            }
            if (string.IsNullOrEmpty(lotName))
            {
                errors.Add(new PoCsvRowError(rowNumber, orderNumber, "Lot name is required."));
                continue;
            }
            if (!decimal.TryParse(amountRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var amount) || amount < 0)
            {
                errors.Add(new PoCsvRowError(rowNumber, orderNumber, "Amount must be a non-negative number."));
                continue;
            }

            var status = string.IsNullOrEmpty(statusRaw) ? "Unpaid" : statusRaw;
            if (status != "Unpaid" && status != "Paid" && status != "Not Found")
            {
                errors.Add(new PoCsvRowError(rowNumber, orderNumber, $"Invalid status '{status}'. Must be Unpaid, Paid, or Not Found."));
                continue;
            }

            // Handle duplicate order number
            if (existingPoByOrderNumber.TryGetValue(orderNumber.ToLower(), out var existingPo))
            {
                if (orderNumbersToUpdate != null && orderNumbersToUpdate.Contains(orderNumber, StringComparer.OrdinalIgnoreCase))
                {
                    // User chose to update this PO — resolve lot and update
                    var building = buildings.FirstOrDefault(b =>
                        string.Equals(b.Name, buildingName, StringComparison.OrdinalIgnoreCase));

                    if (building is null)
                    {
                        building = new Building { ProjectId = projectId, Name = buildingName, Description = "", Lots = new List<Lot>() };
                        _db.Buildings.Add(building);
                        await _db.SaveChangesAsync();
                        buildings.Add(building);
                        buildingsCreated++;
                    }

                    var lot = building.Lots.FirstOrDefault(l =>
                        string.Equals(l.Name, lotName, StringComparison.OrdinalIgnoreCase));

                    if (lot is null)
                    {
                        lot = new Lot { BuildingId = building.Id, Name = lotName, Description = "" };
                        _db.Lots.Add(lot);
                        await _db.SaveChangesAsync();
                        building.Lots.Add(lot);
                        lotsCreated++;
                    }

                    existingPo.LotId     = lot.Id;
                    existingPo.Amount    = amount;
                    existingPo.QbStatus  = status;
                    existingPo.UpdatedAt = now;
                    updatedCount++;
                }
                else if (orderNumbersToUpdate == null)
                {
                    // First pass — surface as a conflict for user to resolve
                    conflicts.Add(new PoCsvConflict(
                        rowNumber,
                        orderNumber,
                        existingPo.Lot?.Name ?? "",
                        lotName,
                        existingPo.Amount,
                        amount));
                }
                else
                {
                    // Second pass — user chose to keep existing
                    skippedCount++;
                }
                continue;
            }

            // Resolve or create building
            var newBuilding = buildings.FirstOrDefault(b =>
                string.Equals(b.Name, buildingName, StringComparison.OrdinalIgnoreCase));

            if (newBuilding is null)
            {
                newBuilding = new Building
                {
                    ProjectId   = projectId,
                    Name        = buildingName,
                    Description = "",
                    Lots        = new List<Lot>(),
                };
                _db.Buildings.Add(newBuilding);
                await _db.SaveChangesAsync();
                buildings.Add(newBuilding);
                buildingsCreated++;
            }

            // Resolve or create lot
            var newLot = newBuilding.Lots.FirstOrDefault(l =>
                string.Equals(l.Name, lotName, StringComparison.OrdinalIgnoreCase));

            if (newLot is null)
            {
                newLot = new Lot
                {
                    BuildingId  = newBuilding.Id,
                    Name        = lotName,
                    Description = "",
                };
                _db.Lots.Add(newLot);
                await _db.SaveChangesAsync();
                newBuilding.Lots.Add(newLot);
                lotsCreated++;
            }

            var newPo = new PurchaseOrder
            {
                ProjectId   = projectId,
                LotId       = newLot.Id,
                OrderNumber = orderNumber,
                Amount      = amount,
                QbStatus    = status,
                CreatedAt   = now,
                UpdatedAt   = now,
            };
            _db.PurchaseOrders.Add(newPo);
            existingPoByOrderNumber[orderNumber.ToLower()] = newPo;
            importedCount++;
        }

        await _db.SaveChangesAsync();

        return new PoCsvImportResultDto(importedCount, updatedCount, skippedCount,
            errors.Count, buildingsCreated, lotsCreated, errors, conflicts);
    }

    public async Task<ProjectCsvImportResultDto> ImportProjectsAsync(IFormFile file)
    {
        var errors        = new List<ProjectCsvRowError>();
        int importedCount = 0;
        int skippedCount  = 0;

        var clients = await _db.Clients.ToListAsync();

        var existingProjects = (await _db.Projects
            .Select(p => new { p.ClientId, Name = p.Name.ToLower() })
            .ToListAsync()).ToHashSet();

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
        var now       = DateTime.UtcNow;

        while (await csv.ReadAsync())
        {
            rowNumber++;

            var projectName = csv.GetField("ProjectName")?.Trim() ?? "";
            var clientName  = csv.GetField("ClientName")?.Trim()  ?? "";
            var description = csv.GetField("Description")?.Trim() ?? "";

            if (string.IsNullOrEmpty(projectName) && string.IsNullOrEmpty(clientName))
                continue;

            if (string.IsNullOrEmpty(projectName))
            {
                errors.Add(new ProjectCsvRowError(rowNumber, "", "Project name is required."));
                continue;
            }

            if (string.IsNullOrEmpty(clientName))
            {
                errors.Add(new ProjectCsvRowError(rowNumber, projectName, "Client name is required."));
                continue;
            }

            var client = clients.FirstOrDefault(c =>
                string.Equals(c.Name, clientName, StringComparison.OrdinalIgnoreCase));

            if (client is null)
            {
                errors.Add(new ProjectCsvRowError(rowNumber, projectName, $"Client '{clientName}' not found."));
                continue;
            }

            var key = new { ClientId = client.Id, Name = projectName.ToLower() };
            if (existingProjects.Any(p => p.ClientId == key.ClientId && p.Name == key.Name))
            {
                skippedCount++;
                errors.Add(new ProjectCsvRowError(rowNumber, projectName, "Project already exists for this client — skipped."));
                continue;
            }

            _db.Projects.Add(new Project
            {
                ClientId    = client.Id,
                Name        = projectName,
                Description = description,
                Status      = "Active",
                CreatedAt   = now,
                UpdatedAt   = now,
            });

            existingProjects.Add(new { ClientId = client.Id, Name = projectName.ToLower() });
            importedCount++;
        }

        await _db.SaveChangesAsync();

        return new ProjectCsvImportResultDto(
            importedCount,
            skippedCount,
            errors.Count(e => !e.Reason.Contains("skipped")),
            errors);
    }

    private static ProjectDto ToDto(Project p) => new(
        p.Id, p.ClientId, p.Name, p.Description, p.Status,
        p.StartDate, p.EndDate, p.CreatedAt, p.UpdatedAt,
        p.ProjectContacts.Select(pc => new ContactDto(
            pc.Contact.Id, pc.Contact.ClientId, pc.Contact.Name,
            pc.Contact.Email, pc.Contact.Phone, pc.Contact.Title,
            pc.Contact.IsPrimary, pc.Contact.CreatedAt, pc.Contact.UpdatedAt
        )).ToList()
    );
}
