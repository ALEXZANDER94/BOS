using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IContactService
{
    Task<List<ContactDto>>                   GetAllAsync(int clientId);
    Task<ContactDto>                         CreateAsync(int clientId, CreateContactRequest request);
    Task<(ContactDto? Dto, string? Error)>   UpdateAsync(int clientId, int id, UpdateContactRequest request);
    Task<bool>                               DeleteAsync(int clientId, int id);
}

public class ContactService : IContactService
{
    private readonly AppDbContext _db;

    public ContactService(AppDbContext db) => _db = db;

    public async Task<List<ContactDto>> GetAllAsync(int clientId)
    {
        var contacts = await _db.Contacts
            .Where(c => c.ClientId == clientId)
            .OrderByDescending(c => c.IsPrimary)
            .ThenBy(c => c.Name)
            .ToListAsync();

        return contacts.Select(ToDto).ToList();
    }

    public async Task<ContactDto> CreateAsync(int clientId, CreateContactRequest req)
    {
        // If the new contact is primary, clear existing primary flags
        if (req.IsPrimary)
            await ClearPrimaryAsync(clientId);

        var contact = new Contact
        {
            ClientId  = clientId,
            Name      = req.Name.Trim(),
            Email     = req.Email.Trim(),
            Phone     = req.Phone.Trim(),
            Title     = req.Title.Trim(),
            IsPrimary = req.IsPrimary,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.Contacts.Add(contact);
        await _db.SaveChangesAsync();
        return ToDto(contact);
    }

    public async Task<(ContactDto? Dto, string? Error)> UpdateAsync(int clientId, int id, UpdateContactRequest req)
    {
        var contact = await _db.Contacts
            .FirstOrDefaultAsync(c => c.ClientId == clientId && c.Id == id);

        if (contact is null) return (null, null);

        // If setting this contact as primary, clear others first
        if (req.IsPrimary && !contact.IsPrimary)
            await ClearPrimaryAsync(clientId);

        contact.Name      = req.Name.Trim();
        contact.Email     = req.Email.Trim();
        contact.Phone     = req.Phone.Trim();
        contact.Title     = req.Title.Trim();
        contact.IsPrimary = req.IsPrimary;
        contact.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return (ToDto(contact), null);
    }

    public async Task<bool> DeleteAsync(int clientId, int id)
    {
        var contact = await _db.Contacts
            .FirstOrDefaultAsync(c => c.ClientId == clientId && c.Id == id);

        if (contact is null) return false;

        _db.Contacts.Remove(contact);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private async Task ClearPrimaryAsync(int clientId)
    {
        var primaries = await _db.Contacts
            .Where(c => c.ClientId == clientId && c.IsPrimary)
            .ToListAsync();

        foreach (var c in primaries)
        {
            c.IsPrimary = false;
            c.UpdatedAt = DateTime.UtcNow;
        }
        // SaveChanges will be called by the caller after appending the new contact
    }

    private static ContactDto ToDto(Contact c) => new(
        c.Id, c.ClientId, c.Name, c.Email, c.Phone, c.Title, c.IsPrimary, c.CreatedAt, c.UpdatedAt
    );
}
