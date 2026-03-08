namespace BOS.Backend.DTOs;

/// <summary>
/// The shape of a supplier returned to the frontend.
/// Includes the optional comparison criteria if one has been configured.
/// </summary>
public record SupplierDto(
    int    Id,
    string Name,
    string Domain,
    string Website,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    ComparisonCriteriaDto? Criteria
);

/// <summary>
/// Payload the frontend sends when creating a new supplier.
/// </summary>
public record CreateSupplierRequest(
    string Name,
    string Domain,
    string Website
);

/// <summary>
/// Payload the frontend sends when updating an existing supplier.
/// All fields are required — partial updates not needed.
/// </summary>
public record UpdateSupplierRequest(
    string Name,
    string Domain,
    string Website
);
