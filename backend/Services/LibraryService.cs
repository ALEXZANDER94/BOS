using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface ILibraryService
{
    Task<List<LibraryListItemDto>> GetForClientAsync(int clientId);
    Task<LibraryDto?>              GetByIdAsync(int id);
    Task<LibraryDto>               CreateAsync(int clientId, string title, string description, IFormFile? pdf);
    Task<LibraryDto?>              UpdateAsync(int id, string title, string description, IFormFile? pdf);
    Task<bool>                     DeleteAsync(int id);
    Task<(Stream Stream, string FileName)?> GetPdfAsync(int id);
    Task<LibraryDto?>              AddUpgradeAsync(int libraryId, int customUpgradeId);
    Task<LibraryDto?>              RemoveUpgradeAsync(int libraryId, int customUpgradeId);
}

public class LibraryService : ILibraryService
{
    private const long MaxPdfSize = 25 * 1024 * 1024; // 25 MB
    private static readonly byte[] PdfMagic = { 0x25, 0x50, 0x44, 0x46, 0x2D }; // "%PDF-"

    private readonly AppDbContext _db;
    private readonly string       _storageRoot;

    public LibraryService(AppDbContext db, IWebHostEnvironment env)
    {
        _db          = db;
        // Outside wwwroot — never served by UseStaticFiles().
        _storageRoot = Path.Combine(env.ContentRootPath, "uploads", "libraries");
        Directory.CreateDirectory(_storageRoot);
    }

    public async Task<List<LibraryListItemDto>> GetForClientAsync(int clientId)
    {
        return await _db.Libraries
            .Where(l => l.ClientId == clientId)
            .OrderByDescending(l => l.UpdatedAt)
            .Select(l => new LibraryListItemDto(
                l.Id, l.ClientId, l.Title, l.Description, l.OriginalFileName,
                l.ContentLength, l.CreatedAt, l.UpdatedAt))
            .ToListAsync();
    }

    public async Task<LibraryDto?> GetByIdAsync(int id)
    {
        var lib = await _db.Libraries
            .Include(l => l.LibraryUpgrades).ThenInclude(lu => lu.CustomUpgrade)
            .FirstOrDefaultAsync(l => l.Id == id);

        return lib is null ? null : ToDto(lib);
    }

    public async Task<LibraryDto> CreateAsync(int clientId, string title, string description, IFormFile? pdf)
    {
        var clientExists = await _db.Clients.AnyAsync(c => c.Id == clientId);
        if (!clientExists) throw new KeyNotFoundException("Client not found.");

        var storedName       = string.Empty;
        var originalFileName = string.Empty;
        long contentLength   = 0;

        if (pdf is not null && pdf.Length > 0)
        {
            await ValidatePdfAsync(pdf);

            storedName     = $"{Guid.NewGuid()}.pdf";
            var destPath   = Path.Combine(_storageRoot, storedName);
            await using (var dest = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
                await pdf.CopyToAsync(dest);

            originalFileName = SanitizeFileName(pdf.FileName);
            contentLength    = pdf.Length;
        }

        var lib = new Library
        {
            ClientId         = clientId,
            Title            = title.Trim(),
            Description      = (description ?? "").Trim(),
            StoredFileName   = storedName,
            OriginalFileName = originalFileName,
            ContentLength    = contentLength,
            CreatedAt        = DateTime.UtcNow,
            UpdatedAt        = DateTime.UtcNow,
        };
        _db.Libraries.Add(lib);
        await _db.SaveChangesAsync();

        return (await GetByIdAsync(lib.Id))!;
    }

    public async Task<LibraryDto?> UpdateAsync(int id, string title, string description, IFormFile? pdf)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib is null) return null;

        lib.Title       = title.Trim();
        lib.Description = (description ?? "").Trim();

        if (pdf is not null)
        {
            await ValidatePdfAsync(pdf);

            // Replace the file: write new file then delete the old one.
            var newStored = $"{Guid.NewGuid()}.pdf";
            var newPath   = Path.Combine(_storageRoot, newStored);
            await using (var dest = new FileStream(newPath, FileMode.Create, FileAccess.Write, FileShare.None))
                await pdf.CopyToAsync(dest);

            if (!string.IsNullOrEmpty(lib.StoredFileName))
            {
                var oldPath = Path.Combine(_storageRoot, lib.StoredFileName);
                if (File.Exists(oldPath)) File.Delete(oldPath);
            }

            lib.StoredFileName   = newStored;
            lib.OriginalFileName = SanitizeFileName(pdf.FileName);
            lib.ContentLength    = pdf.Length;
        }

        lib.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return await GetByIdAsync(lib.Id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib is null) return false;

        if (!string.IsNullOrEmpty(lib.StoredFileName))
        {
            var path = Path.Combine(_storageRoot, lib.StoredFileName);
            if (File.Exists(path)) File.Delete(path);
        }

        _db.Libraries.Remove(lib);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<(Stream Stream, string FileName)?> GetPdfAsync(int id)
    {
        var lib = await _db.Libraries.FindAsync(id);
        if (lib is null) return null;
        if (string.IsNullOrEmpty(lib.StoredFileName)) return null;

        var path = Path.Combine(_storageRoot, lib.StoredFileName);
        if (!File.Exists(path)) return null;

        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, lib.OriginalFileName);
    }

    public async Task<LibraryDto?> AddUpgradeAsync(int libraryId, int customUpgradeId)
    {
        var lib = await _db.Libraries.FindAsync(libraryId);
        if (lib is null) return null;

        var upgrade = await _db.CustomUpgrades.FindAsync(customUpgradeId);
        if (upgrade is null) throw new KeyNotFoundException("CustomUpgrade not found.");

        var exists = await _db.LibraryUpgrades
            .AnyAsync(lu => lu.LibraryId == libraryId && lu.CustomUpgradeId == customUpgradeId);

        if (!exists)
        {
            _db.LibraryUpgrades.Add(new LibraryUpgrade
            {
                LibraryId       = libraryId,
                CustomUpgradeId = customUpgradeId,
            });
            lib.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return await GetByIdAsync(libraryId);
    }

    public async Task<LibraryDto?> RemoveUpgradeAsync(int libraryId, int customUpgradeId)
    {
        var lib = await _db.Libraries.FindAsync(libraryId);
        if (lib is null) return null;

        var row = await _db.LibraryUpgrades
            .FirstOrDefaultAsync(lu => lu.LibraryId == libraryId && lu.CustomUpgradeId == customUpgradeId);

        if (row is not null)
        {
            _db.LibraryUpgrades.Remove(row);
            lib.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();
        }

        return await GetByIdAsync(libraryId);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static async Task ValidatePdfAsync(IFormFile pdf)
    {
        if (pdf.Length == 0)
            throw new InvalidOperationException("PDF file is empty.");
        if (pdf.Length > MaxPdfSize)
            throw new InvalidOperationException("PDF exceeds the 25 MB limit.");
        if (!string.Equals(pdf.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("File must be application/pdf.");

        // Magic-byte check — defends against a spoofed mime type.
        var header = new byte[5];
        await using var stream = pdf.OpenReadStream();
        var read = await stream.ReadAsync(header.AsMemory(0, 5));
        if (read < 5 || !header.AsSpan(0, 5).SequenceEqual(PdfMagic))
            throw new InvalidOperationException("File is not a valid PDF.");
    }

    private static string SanitizeFileName(string name)
    {
        var raw = Path.GetFileName(name).Trim();
        if (string.IsNullOrEmpty(raw)) return "library.pdf";
        // Strip control chars and quotes; cap length.
        var clean = new string(raw.Where(c => !char.IsControl(c) && c != '"').ToArray());
        return clean.Length > 200 ? clean[..200] : clean;
    }

    private static LibraryDto ToDto(Library l) => new(
        l.Id,
        l.ClientId,
        l.Title,
        l.Description,
        l.OriginalFileName,
        l.ContentLength,
        l.CreatedAt,
        l.UpdatedAt,
        l.LibraryUpgrades.Select(lu => new CustomUpgradeDto(
            lu.CustomUpgrade!.Id,
            lu.CustomUpgrade.ClientId,
            lu.CustomUpgrade.IsGlobal,
            lu.CustomUpgrade.Name,
            lu.CustomUpgrade.Description,
            lu.CustomUpgrade.CreatedAt
        )).ToList());
}
