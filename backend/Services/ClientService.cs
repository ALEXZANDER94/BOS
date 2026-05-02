using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IClientService
{
    Task<List<ClientDto>> GetAllAsync(string? search, string? status);
    Task<ClientDto?>      GetByIdAsync(int id);
    Task<ClientDto>       CreateAsync(CreateClientRequest request);
    Task<(ClientDto? Dto, string? Error)> UpdateAsync(int id, UpdateClientRequest request);
    Task<bool>            DeleteAsync(int id);
}

public class ClientService : IClientService
{
    private readonly AppDbContext _db;

    public ClientService(AppDbContext db) => _db = db;

    public async Task<List<ClientDto>> GetAllAsync(string? search, string? status)
    {
        var query = _db.Clients
            .Include(c => c.Contacts)
            .Include(c => c.Projects)
            .Include(c => c.ActivityLogs)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(c => c.Status == status);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var lower = search.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(lower) ||
                c.Industry.ToLower().Contains(lower));
        }

        var clients = await query.OrderBy(c => c.Name).ToListAsync();
        return clients.Select(ToDto).ToList();
    }

    public async Task<ClientDto?> GetByIdAsync(int id)
    {
        var client = await _db.Clients
            .Include(c => c.Contacts)
            .Include(c => c.Projects)
            .Include(c => c.ActivityLogs)
            .FirstOrDefaultAsync(c => c.Id == id);

        return client is null ? null : ToDto(client);
    }

    public async Task<ClientDto> CreateAsync(CreateClientRequest req)
    {
        var client = new Client
        {
            Name        = req.Name.Trim(),
            Description = req.Description.Trim(),
            Status      = req.Status,
            Industry    = req.Industry.Trim(),
            Website     = req.Website.Trim(),
            Domain      = req.Domain.Trim(),
            Street      = req.Street.Trim(),
            City        = req.City.Trim(),
            State       = req.State.Trim(),
            Zip         = req.Zip.Trim(),
            CreatedAt   = DateTime.UtcNow,
            UpdatedAt   = DateTime.UtcNow,
        };

        _db.Clients.Add(client);
        await _db.SaveChangesAsync();
        return ToDto(client);
    }

    public async Task<(ClientDto? Dto, string? Error)> UpdateAsync(int id, UpdateClientRequest req)
    {
        var client = await _db.Clients
            .Include(c => c.Contacts)
            .Include(c => c.Projects)
            .Include(c => c.ActivityLogs)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (client is null) return (null, null);

        client.Name        = req.Name.Trim();
        client.Description = req.Description.Trim();
        client.Status      = req.Status;
        client.Industry    = req.Industry.Trim();
        client.Website     = req.Website.Trim();
        client.Domain      = req.Domain.Trim();
        client.Street      = req.Street.Trim();
        client.City        = req.City.Trim();
        client.State       = req.State.Trim();
        client.Zip         = req.Zip.Trim();
        client.ShowContacts  = req.ShowContacts;
        client.ShowProjects  = req.ShowProjects;
        client.ShowProposals = req.ShowProposals;
        client.ShowLibraries = req.ShowLibraries;
        client.ShowActivity  = req.ShowActivity;
        client.ShowOptions   = req.ShowOptions;
        client.UpdatedAt   = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return (ToDto(client), null);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var client = await _db.Clients.FindAsync(id);
        if (client is null) return false;

        _db.Clients.Remove(client);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── DTO mapping ───────────────────────────────────────────────────────────

    private static ClientDto ToDto(Client c)
    {
        var primaryContact = c.Contacts.FirstOrDefault(x => x.IsPrimary)
                          ?? c.Contacts.OrderBy(x => x.CreatedAt).FirstOrDefault();

        return new ClientDto(
            Id:             c.Id,
            Name:           c.Name,
            Description:    c.Description,
            Status:         c.Status,
            Industry:       c.Industry,
            Website:        c.Website,
            Domain:         c.Domain,
            Street:         c.Street,
            City:           c.City,
            State:          c.State,
            Zip:            c.Zip,
            CreatedAt:      c.CreatedAt,
            UpdatedAt:      c.UpdatedAt,
            PrimaryContact: primaryContact is null ? null : ContactToDto(primaryContact),
            ContactCount:   c.Contacts.Count,
            ProjectCount:   c.Projects.Count,
            ActivityCount:  c.ActivityLogs.Count,
            ShowContacts:   c.ShowContacts,
            ShowProjects:   c.ShowProjects,
            ShowProposals:  c.ShowProposals,
            ShowLibraries:  c.ShowLibraries,
            ShowActivity:   c.ShowActivity,
            ShowOptions:    c.ShowOptions,
            QbCustomerId:   c.QbCustomerId,
            QbCustomerName: c.QbCustomerName
        );
    }

    internal static ContactDto ContactToDto(Contact c) => new(
        c.Id, c.ClientId, c.Name, c.Email, c.Phone, c.Title, c.IsPrimary, c.CreatedAt, c.UpdatedAt
    );
}
