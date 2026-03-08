namespace BOS.Backend.DTOs;

/// <summary>
/// One candidate header row detected in the Adobe-converted XLSX.
/// </summary>
public record CandidateHeaderRow(
    int      RowNumber,  // 1-based row number in the sheet
    string[] Headers     // trimmed, non-empty cell values from that row
);

/// <summary>
/// Returned by POST /api/comparison/scan-adobe-headers.
/// Contains the session token for the cached XLSX, all candidate header rows
/// found in the first 30 rows, and best-guess suggestions derived from the
/// supplier's saved criteria.
/// </summary>
public record AdobeHeadersResult(
    string               SessionToken,
    CandidateHeaderRow[] CandidateRows,
    int                  SuggestedRowNumber,
    string?              SuggestedMatchColumn,
    string?              SuggestedPriceColumn,
    string?              SuggestedDescriptionColumn,
    string?              SuggestedQuantityColumn,
    string?              SuggestedTotalColumn,
    string?              SuggestedInvoiceNumberColumn
);

/// <summary>
/// Sent by the frontend to POST /api/comparison/confirm-adobe.
/// Carries the session token, the supplier ID, the user-selected header row number,
/// the chosen column names, and whether to persist the mapping back to the supplier's criteria.
/// </summary>
public record ConfirmAdobeRequest(
    string  SessionToken,
    int     SupplierId,
    int     HeaderRowNumber,
    string  MatchColumn,
    string  ColPrice,
    string? ColDescription,
    string? ColQuantity,
    string? ColTotal,
    string? ColInvoiceNumber,
    bool    SaveToSupplier
);

// ── Spreadsheet (XLSX / CSV) two-step flow ────────────────────────────────────

/// <summary>
/// Returned by POST /api/comparison/scan-spreadsheet-headers.
/// Mirrors AdobeHeadersResult but for directly uploaded spreadsheets (no Adobe conversion).
/// </summary>
public record SpreadsheetHeadersResult(
    string               SessionToken,
    string               FileExtension,          // ".xlsx" or ".csv" — needed by confirm-spreadsheet
    CandidateHeaderRow[] CandidateRows,
    int                  SuggestedRowNumber,
    string?              SuggestedMatchColumn,
    string?              SuggestedPriceColumn,
    string?              SuggestedDescriptionColumn,
    string?              SuggestedQuantityColumn,
    string?              SuggestedTotalColumn,
    string?              SuggestedInvoiceNumberColumn
);

/// <summary>
/// Sent by the frontend to POST /api/comparison/confirm-spreadsheet.
/// Mirrors ConfirmAdobeRequest but for directly uploaded spreadsheets.
/// </summary>
public record ConfirmSpreadsheetRequest(
    string  SessionToken,
    int     SupplierId,
    int     HeaderRowNumber,
    string  MatchColumn,
    string  ColPrice,
    string? ColDescription,
    string? ColQuantity,
    string? ColTotal,
    string? ColInvoiceNumber,
    bool    SaveToSupplier
);
