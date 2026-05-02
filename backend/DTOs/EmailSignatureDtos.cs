namespace BOS.Backend.DTOs;

public record EmailSignatureDto(
    int      Id,
    string   OwnerUserEmail,
    string?  AliasEmail,
    string   Name,
    string   BodyHtml,
    bool     IsDefault,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreateEmailSignatureRequest(
    string? AliasEmail,
    string  Name,
    string  BodyHtml,
    bool    IsDefault);

public record UpdateEmailSignatureRequest(
    string? AliasEmail,
    string  Name,
    string  BodyHtml,
    bool    IsDefault);
