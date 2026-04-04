namespace BOS.Backend.DTOs;

/// <summary>
/// The shape of a ComparisonCriteria record returned to the frontend.
/// </summary>
public record ComparisonCriteriaDto(
    int      Id,
    int      SupplierId,
    string   MatchColumn,
    string   Format,
    string   ColPrice,
    double?  MatchColX,
    double?  PriceColX,
    string?  ColDescription,
    string?  ColMFR,
    string?  ColQuantity,
    string?  ColTotal,
    string?  ColInvoiceNumber,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

/// <summary>
/// Payload for creating or updating comparison criteria (upsert).
/// </summary>
public record UpsertComparisonCriteriaRequest(
    string  MatchColumn,
    string  Format,
    string  ColPrice,
    double? MatchColX         = null,
    double? PriceColX         = null,
    string? ColDescription    = null,
    string? ColMFR            = null,
    string? ColQuantity       = null,
    string? ColTotal          = null,
    string? ColInvoiceNumber  = null
);
