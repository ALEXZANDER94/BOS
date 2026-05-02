namespace BOS.Backend.DTOs;

public record LibraryDto(
    int      Id,
    int      ClientId,
    string   Title,
    string   Description,
    string   OriginalFileName,
    long     ContentLength,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    List<CustomUpgradeDto> BakedInUpgrades);

public record LibraryListItemDto(
    int      Id,
    int      ClientId,
    string   Title,
    string   Description,
    string   OriginalFileName,
    long     ContentLength,
    DateTime CreatedAt,
    DateTime UpdatedAt);

// Used for create + update text fields. PDF is sent as a separate IFormFile on multipart requests.
public record UpsertLibraryFieldsRequest(string Title, string Description);
