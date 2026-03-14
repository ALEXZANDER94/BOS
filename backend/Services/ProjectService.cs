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
    Task<PoCsvImportResultDto>              ImportPurchaseOrdersAsync(int projectId, IFormFile file);
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
            )).ToList()
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

    public async Task<PoCsvImportResultDto> ImportPurchaseOrdersAsync(int projectId, IFormFile file)
    {
        var errors           = new List<PoCsvRowError>();
        int importedCount    = 0;
        int skippedCount     = 0;
        int buildingsCreated = 0;
        int lotsCreated      = 0;

        // Load existing buildings + lots for this project into memory
        var buildings = await _db.Buildings
            .Where(b => b.ProjectId == projectId)
            .Include(b => b.Lots)
            .ToListAsync();

        // Load existing PO order numbers to detect duplicates
        var existingOrderNumbers = (await _db.PurchaseOrders
            .Where(po => po.ProjectId == projectId)
            .Select(po => po.OrderNumber.ToLower())
            .ToListAsync()).ToHashSet();

        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord  = true,
            TrimOptions      = TrimOptions.Trim,
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

            var status = string.IsNullOrEmpty(statusRaw) ? "Open" : statusRaw;
            if (status != "Open" && status != "Closed")
            {
                errors.Add(new PoCsvRowError(rowNumber, orderNumber, $"Invalid status '{status}'. Must be Open or Closed."));
                continue;
            }

            // Skip duplicate order number
            if (existingOrderNumbers.Contains(orderNumber.ToLower()))
            {
                skippedCount++;
                errors.Add(new PoCsvRowError(rowNumber, orderNumber, "Order number already exists — skipped."));
                continue;
            }

            // Resolve or create building
            var building = buildings.FirstOrDefault(b =>
                string.Equals(b.Name, buildingName, StringComparison.OrdinalIgnoreCase));

            if (building is null)
            {
                building = new Building
                {
                    ProjectId   = projectId,
                    Name        = buildingName,
                    Description = "",
                    Lots        = new List<Lot>(),
                };
                _db.Buildings.Add(building);
                await _db.SaveChangesAsync();
                buildings.Add(building);
                buildingsCreated++;
            }

            // Resolve or create lot
            var lot = building.Lots.FirstOrDefault(l =>
                string.Equals(l.Name, lotName, StringComparison.OrdinalIgnoreCase));

            if (lot is null)
            {
                lot = new Lot
                {
                    BuildingId  = building.Id,
                    Name        = lotName,
                    Description = "",
                };
                _db.Lots.Add(lot);
                await _db.SaveChangesAsync();
                building.Lots.Add(lot);
                lotsCreated++;
            }

            _db.PurchaseOrders.Add(new PurchaseOrder
            {
                ProjectId   = projectId,
                LotId       = lot.Id,
                OrderNumber = orderNumber,
                Amount      = amount,
                Status      = status,
                CreatedAt   = now,
                UpdatedAt   = now,
            });

            existingOrderNumbers.Add(orderNumber.ToLower());
            importedCount++;
        }

        await _db.SaveChangesAsync();

        return new PoCsvImportResultDto(importedCount, skippedCount, errors.Count(e => !e.Reason.Contains("skipped")), buildingsCreated, lotsCreated, errors);
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
