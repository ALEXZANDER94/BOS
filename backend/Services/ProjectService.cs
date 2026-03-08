using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IProjectService
{
    Task<List<ProjectDto>>                  GetAllAsync(int clientId);
    Task<List<ProjectWithClientDto>>        GetAllProjectsAsync(string? search, string? status, int? clientId);
    Task<ProjectDto>                        CreateAsync(int clientId, CreateProjectRequest request);
    Task<(ProjectDto? Dto, string? Error)>  UpdateAsync(int clientId, int id, UpdateProjectRequest request);
    Task<bool>                              DeleteAsync(int clientId, int id);
    Task                                    AssignContactAsync(int clientId, int projectId, int contactId);
    Task                                    UnassignContactAsync(int clientId, int projectId, int contactId);
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
