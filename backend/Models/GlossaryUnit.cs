namespace BOS.Backend.Models;

public class GlossaryUnit
{
    public int Id { get; set; }

    /// <summary>
    /// Foreign key to the Supplier this unit belongs to.
    /// Stored as supplier_id in the database (configured in AppDbContext).
    /// </summary>
    public int SupplierId { get; set; }

    /// <summary>
    /// Navigation property — EF Core uses this to load the related Supplier.
    /// </summary>
    public Supplier? Supplier { get; set; }

    /// <summary>
    /// The catalog number for this unit. Used as the business key
    /// when matching against proposed glossary PDFs.
    /// Unique per supplier (composite unique index with SupplierId).
    /// </summary>
    public string CatalogNumber { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;
    public string MFR { get; set; } = string.Empty;

    /// <summary>
    /// The contracted (master) price for this unit.
    /// </summary>
    public decimal ContractedPrice { get; set; }

    /// <summary>
    /// Records how this unit was added to the glossary.
    /// "Manual"     = added via the Add Unit form.
    /// "CSV"        = imported via CSV upload.
    /// "Comparison" = added directly from a price comparison result.
    /// </summary>
    public string AddedVia { get; set; } = "Manual";

    /// <summary>
    /// Optional FK to a GlossaryUnitStatus. Null means no status is assigned.
    /// When the referenced status is deleted, this is set to null (DeleteBehavior.SetNull).
    /// </summary>
    public int? StatusId { get; set; }

    /// <summary>
    /// Navigation property for the assigned status.
    /// </summary>
    public GlossaryUnitStatus? Status { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Optional free-text notes about this unit. Null when not set.
    /// </summary>
    public string? Notes { get; set; }
}
