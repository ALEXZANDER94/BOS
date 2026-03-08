namespace BOS.Backend.DTOs;

/// <summary>
/// Describes the result of extracting header columns from a proposed price PDF.
/// Returned by POST /api/comparison/headers so the frontend can confirm or
/// correct the column-to-field mapping before running the full comparison.
/// </summary>
public record PdfHeadersDto(
    /// <summary>
    /// All header words found in the best-matching header row of the PDF.
    /// The user will pick from these to resolve any mismatches.
    /// </summary>
    List<string> PdfHeaders,

    /// <summary>
    /// The supplier's currently saved comparison criteria, or null if not yet configured.
    /// </summary>
    ComparisonCriteriaDto? CurrentCriteria,

    /// <summary>
    /// Per-field match result — the PDF header word that was matched
    /// for each of the three criteria fields, or null if no match was found.
    /// </summary>
    MatchStatusDto MatchStatus,

    /// <summary>
    /// True when both required fields (match column and price) matched.
    /// The frontend can skip the mapping dialog and proceed directly to /upload.
    /// </summary>
    bool AllMatched
);

/// <summary>
/// Indicates which PDF header word was matched for each criteria field.
/// Null means the field could not be resolved from the PDF's header row
/// using the current criteria — the user must pick manually.
/// </summary>
public record MatchStatusDto(
    string? ColMatch,
    string? ColPrice
);

/// <summary>
/// Optional column override payload sent by the frontend after the user
/// manually resolves a column-mapping conflict.
/// When present on POST /api/comparison/upload, these values are used
/// instead of the supplier's saved criteria for this parse, and are then
/// saved back as the new criteria automatically.
/// MatchColX and PriceColX carry any existing X anchors so they are
/// preserved when the auto-save path runs after a column mapping correction.
/// </summary>
public record CriteriaOverridesDto(
    string  MatchColumn,
    string  Format,
    string  ColPrice,
    double? MatchColX = null,
    double? PriceColX = null
);
