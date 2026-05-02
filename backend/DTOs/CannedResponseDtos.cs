namespace BOS.Backend.DTOs;

public record CannedResponseCategoryDto(
    int    Id,
    string Name,
    int    SortOrder,
    int    ResponseCount);

public record CannedResponseAttachmentDto(
    int      Id,
    string   FileName,
    string   ContentType,
    long     FileSize,
    string   UploadedByEmail,
    DateTime UploadedAt);

public record CannedResponseDto(
    int      Id,
    int      CategoryId,
    string   CategoryName,
    string   Name,
    string?  Subject,
    string   BodyHtml,
    string?  DefaultTo,
    string?  DefaultCc,
    string?  DefaultBcc,
    string   CreatedByUserEmail,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    IReadOnlyList<CannedResponseAttachmentDto> Attachments);

public record CreateCannedResponseCategoryRequest(string Name, int SortOrder = 0);
public record UpdateCannedResponseCategoryRequest(string Name, int SortOrder = 0);

public record CreateCannedResponseRequest(
    int     CategoryId,
    string  Name,
    string? Subject,
    string  BodyHtml,
    string? DefaultTo,
    string? DefaultCc,
    string? DefaultBcc);

public record UpdateCannedResponseRequest(
    int     CategoryId,
    string  Name,
    string? Subject,
    string  BodyHtml,
    string? DefaultTo,
    string? DefaultCc,
    string? DefaultBcc);
