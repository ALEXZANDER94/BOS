namespace BOS.Backend.DTOs;

/// <summary>
/// A single row in the price comparison result, sent to the frontend and
/// used as input for the PDF report generator.
/// </summary>
public record ComparisonResultDto(
    string  CatalogNumber,
    string  Description,
    string  MFR,                  // Manufacturer — extracted from match-key cell via Format template
    decimal MasterPrice,          // Per-unit contracted price from master glossary
    decimal ProposedPrice,        // Per-unit price from invoice (rounded to 2 dp, for display)
    decimal DollarDifference,     // ProposedTotal − (MasterPrice × ProposedQuantity)
    decimal PercentDifference,    // DollarDifference / (MasterPrice × ProposedQuantity) × 100
    bool    IsOverpriced,         // ProposedTotal > (MasterPrice × ProposedQuantity)
    bool    IsNewItem,            // CatalogNumber not found in master glossary
    bool    IsNeedsReview,        // Could not be auto-parsed from the criteria cell
    string  RawCriteriaCell,      // Original combined cell text (populated when IsNeedsReview)
    decimal ProposedQuantity = 1m,  // Number of units on the invoice line
    decimal ProposedTotal    = 0m,  // Actual invoice line total (from ColTotal column)
    string  InvoiceNumber    = ""   // Invoice number (from ColInvoiceNumber column)
);

/// <summary>
/// An individual unit extracted from a proposed price PDF.
/// Intermediate type used only within the backend pipeline.
/// </summary>
public record ParsedPdfUnit(
    string  CatalogNumber,
    string  Description,
    string  MFR,
    decimal ProposedPrice,            // Raw listed per-unit price from invoice
    bool    NeedsReview = false,      // True when CriteriaParser could not parse the cell
    string  RawCriteriaCell = "",     // Original combined cell text (populated when NeedsReview)
    decimal ProposedQuantity = 1m,    // Number of units on the invoice line; defaults to 1
    decimal ProposedTotal    = 0m,    // Invoice line total (from ColTotal column); 0 if not mapped
    string  InvoiceNumber    = ""     // Invoice number (from ColInvoiceNumber column)
);
