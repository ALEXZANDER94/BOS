using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface ITicketAttachmentService
{
    Task<TicketAttachmentDto> UploadAsync(int ticketId, IFormFile file, string uploaderEmail);
    Task<(Stream Stream, string ContentType, string FileName)?> DownloadAsync(int attachmentId);
    Task<bool> DeleteAsync(int attachmentId, string requestingEmail);
}

public class TicketAttachmentService : ITicketAttachmentService
{
    // Allowed MIME types — images, PDFs, Office docs, text
    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
        "text/csv",
    };

    private const long MaxFileSizeBytes = 20 * 1024 * 1024; // 20 MB

    private readonly AppDbContext _db;
    private readonly string       _storageRoot;

    public TicketAttachmentService(AppDbContext db, IWebHostEnvironment env)
    {
        _db          = db;
        // Store outside wwwroot so files are never served statically
        _storageRoot = Path.Combine(env.ContentRootPath, "uploads", "tickets");
        Directory.CreateDirectory(_storageRoot);
    }

    public async Task<TicketAttachmentDto> UploadAsync(int ticketId, IFormFile file, string uploaderEmail)
    {
        // Validate ticket exists
        var ticketExists = await _db.Tickets.AnyAsync(t => t.Id == ticketId);
        if (!ticketExists)
            throw new KeyNotFoundException("Ticket not found.");

        // Validate file size
        if (file.Length > MaxFileSizeBytes)
            throw new InvalidOperationException($"File exceeds the 20 MB limit.");

        // Validate MIME type
        if (!AllowedMimeTypes.Contains(file.ContentType))
            throw new InvalidOperationException($"File type '{file.ContentType}' is not allowed.");

        // Sanitise the original filename — strip path components, keep extension
        var originalName  = Path.GetFileName(file.FileName).Trim();
        var extension     = Path.GetExtension(originalName);
        var storedName    = $"{Guid.NewGuid()}{extension}";
        var destPath      = Path.Combine(_storageRoot, storedName);

        await using (var dest = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
            await file.CopyToAsync(dest);

        var attachment = new TicketAttachment
        {
            TicketId        = ticketId,
            FileName        = originalName,
            StoredFileName  = storedName,
            ContentType     = file.ContentType,
            FileSize        = file.Length,
            UploadedByEmail = uploaderEmail,
            UploadedAt      = DateTime.UtcNow,
        };

        _db.TicketAttachments.Add(attachment);
        await _db.SaveChangesAsync();

        return ToDto(attachment);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)?> DownloadAsync(int attachmentId)
    {
        var attachment = await _db.TicketAttachments.FindAsync(attachmentId);
        if (attachment is null) return null;

        var path = Path.Combine(_storageRoot, attachment.StoredFileName);
        if (!File.Exists(path)) return null;

        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, attachment.ContentType, attachment.FileName);
    }

    public async Task<bool> DeleteAsync(int attachmentId, string requestingEmail)
    {
        var attachment = await _db.TicketAttachments.FindAsync(attachmentId);
        if (attachment is null) return false;

        // Only the uploader may delete
        if (!string.Equals(attachment.UploadedByEmail, requestingEmail, StringComparison.OrdinalIgnoreCase))
            return false;

        var path = Path.Combine(_storageRoot, attachment.StoredFileName);
        if (File.Exists(path))
            File.Delete(path);

        _db.TicketAttachments.Remove(attachment);
        await _db.SaveChangesAsync();
        return true;
    }

    private static TicketAttachmentDto ToDto(TicketAttachment a) => new(
        a.Id, a.TicketId, a.FileName, a.ContentType,
        a.FileSize, a.UploadedByEmail, a.UploadedAt.ToString("o"));
}
