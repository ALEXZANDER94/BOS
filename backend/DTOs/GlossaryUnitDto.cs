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
/// A single item in a bulk-price-update request: identifies the glossary entry by catalog
/// number and supplies the new contracted price from the comparison invoice.
/// </summary>
public record GlossaryPriceUpdateItem(
    string  CatalogNumber,
    decimal NewPrice
);

/// <summary>
/// Payload for POST /glossary/bulk-update-prices.
/// </summary>
public record BulkUpdateGlossaryPricesRequest(
    List<GlossaryPriceUpdateItem> Items
);

/// <summary>
/// Result returned after a bulk price update.
/// UpdatedCount = rows whose price changed; SkippedCount = catalog numbers not found.
/// </summary>
public record BulkUpdateGlossaryPricesResult(
    int UpdatedCount,
    int SkippedCount
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
