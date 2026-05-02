using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface ICannedResponseAttachmentService
{
    Task<CannedResponseAttachmentDto> UploadAsync(int cannedResponseId, IFormFile file, string uploaderEmail);
    Task<(Stream Stream, string ContentType, string FileName)?> DownloadAsync(int attachmentId);
    Task<bool> DeleteAsync(int attachmentId);
}

public class CannedResponseAttachmentService : ICannedResponseAttachmentService
{
    // Allowed MIME types — broader than tickets since these become Gmail attachments,
    // but still gated to common business document/image types.
    private static readonly HashSet<string> AllowedMimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.ms-powerpoint",
        "text/plain",
        "text/csv",
        "application/zip",
    };

    // Gmail's per-message attachment limit is 25 MB.
    private const long MaxFileSizeBytes = 25 * 1024 * 1024;

    private readonly AppDbContext _db;
    private readonly string       _storageRoot;

    public CannedResponseAttachmentService(AppDbContext db, IWebHostEnvironment env)
    {
        _db          = db;
        _storageRoot = Path.Combine(env.ContentRootPath, "uploads", "canned-responses");
        Directory.CreateDirectory(_storageRoot);
    }

    public async Task<CannedResponseAttachmentDto> UploadAsync(int cannedResponseId, IFormFile file, string uploaderEmail)
    {
        var responseExists = await _db.CannedResponses.AnyAsync(r => r.Id == cannedResponseId);
        if (!responseExists)
            throw new KeyNotFoundException("Canned response not found.");

        if (file.Length > MaxFileSizeBytes)
            throw new InvalidOperationException("File exceeds the 25 MB limit.");

        if (!AllowedMimeTypes.Contains(file.ContentType))
            throw new InvalidOperationException($"File type '{file.ContentType}' is not allowed.");

        var originalName = Path.GetFileName(file.FileName).Trim();
        var extension    = Path.GetExtension(originalName);
        var storedName   = $"{Guid.NewGuid()}{extension}";
        var destPath     = Path.Combine(_storageRoot, storedName);

        await using (var dest = new FileStream(destPath, FileMode.Create, FileAccess.Write, FileShare.None))
            await file.CopyToAsync(dest);

        var attachment = new CannedResponseAttachment
        {
            CannedResponseId = cannedResponseId,
            FileName         = originalName,
            StoredFileName   = storedName,
            ContentType      = file.ContentType,
            FileSize         = file.Length,
            UploadedByEmail  = uploaderEmail,
            UploadedAt       = DateTime.UtcNow,
        };

        _db.CannedResponseAttachments.Add(attachment);
        await _db.SaveChangesAsync();

        return ToDto(attachment);
    }

    public async Task<(Stream Stream, string ContentType, string FileName)?> DownloadAsync(int attachmentId)
    {
        var attachment = await _db.CannedResponseAttachments.FindAsync(attachmentId);
        if (attachment is null) return null;

        var path = Path.Combine(_storageRoot, attachment.StoredFileName);
        if (!File.Exists(path)) return null;

        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, attachment.ContentType, attachment.FileName);
    }

    public async Task<bool> DeleteAsync(int attachmentId)
    {
        var attachment = await _db.CannedResponseAttachments.FindAsync(attachmentId);
        if (attachment is null) return false;

        var path = Path.Combine(_storageRoot, attachment.StoredFileName);
        if (File.Exists(path))
            File.Delete(path);

        _db.CannedResponseAttachments.Remove(attachment);
        await _db.SaveChangesAsync();
        return true;
    }

    public static CannedResponseAttachmentDto ToDto(CannedResponseAttachment a) => new(
        a.Id, a.FileName, a.ContentType, a.FileSize,
        a.UploadedByEmail, a.UploadedAt);
}
