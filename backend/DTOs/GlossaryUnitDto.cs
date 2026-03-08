namespace BOS.Backend.DTOs;

/// <summary>
/// The shape of a glossary unit returned to the frontend.
/// Using a record gives us value equality and concise syntax — no boilerplate class needed.
/// </summary>
public record GlossaryUnitDto(
    int      Id,
    int      SupplierId,
    string   CatalogNumber,
    string   Description,
    string   MFR,
    decimal  ContractedPrice,
    string   AddedVia,
    int?     StatusId,
    string?  StatusName,
    string?  StatusColor,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    string?  Notes
);

/// <summary>
/// Payload the frontend sends when creating a new unit.
/// Validation is handled in the controller via [ApiController] model binding.
/// </summary>
public record CreateGlossaryUnitRequest(
    string  CatalogNumber,
    string  Description,
    string  MFR,
    decimal ContractedPrice,
    string  AddedVia  = "Manual",
    int?    StatusId  = null
);

/// <summary>
/// Payload the frontend sends when updating an existing unit.
/// All fields are required — partial updates (PATCH) are not needed here.
/// </summary>
public record UpdateGlossaryUnitRequest(
    string  CatalogNumber,
    string  Description,
    string  MFR,
    decimal ContractedPrice,
    int?    StatusId = null,
    string? Notes    = null
);

/// <summary>
/// Describes a single row in the CSV that could not be imported.
/// RowNumber is 1-based (excluding the header) so the user can locate
/// the exact row in their spreadsheet.
/// </summary>
public record CsvRowError(
    int    RowNumber,
    string CatalogNumber,
    string Reason
);

/// <summary>
/// Returned after a CSV import attempt. Always a 200 OK — partial
/// success is valid; the caller checks the counts and error list.
/// </summary>
public record CsvImportResultDto(
    int               ImportedCount,
    int               UpdatedCount,
    int               SkippedCount,
    int               ErrorCount,
    List<CsvRowError> Errors
);
