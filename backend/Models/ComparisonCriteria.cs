namespace BOS.Backend.Models;

/// <summary>
/// Stores the per-supplier criteria used to parse proposed price PDFs.
/// Each supplier encodes their unit identity (MFR, Description, Catalog #)
/// into a single combined column. ComparisonCriteria captures:
///   1. Which column contains the combined match key
///   2. A format template describing how to parse that column
///   3. Which column contains the price
///
/// One-to-one optional relationship with Supplier.
/// </summary>
public class ComparisonCriteria
{
    public int Id { get; set; }

    /// <summary>
    /// FK to the owning supplier. Stored as supplier_id in the database.
    /// </summary>
    public int SupplierId { get; set; }

    /// <summary>
    /// Navigation property back to the owning supplier.
    /// </summary>
    public Supplier? Supplier { get; set; }

    /// <summary>
    /// The exact column header text in the supplier's PDF that contains the
    /// combined match key cell (MFR + Description + CatalogNumber packed together).
    /// e.g. "EOP #/Description" (PLATT), "Product Code" (CED)
    /// </summary>
    public string MatchColumn { get; set; } = string.Empty;

    /// <summary>
    /// A format template describing how the combined match key is structured.
    /// Tokens: {MFR} (single word), {Description} (words), {CatalogNumber} (no spaces).
    /// Use \n as a literal separator between lines of the combined cell.
    /// e.g. "{MFR} {Description}\n{CatalogNumber}" (PLATT)
    ///      "{MFR}\n{CatalogNumber}" (CED)
    /// </summary>
    public string Format { get; set; } = string.Empty;

    /// <summary>
    /// The exact column header text for the unit price.
    /// e.g. "Price", "Unit Price", "NET PRICE"
    /// </summary>
    public string ColPrice { get; set; } = string.Empty;

    /// <summary>
    /// Optional column header for the product description. When set, the description
    /// is read directly from this column instead of (or to supplement) what CriteriaParser
    /// extracts from MatchColumn. Useful for suppliers like CED whose PDFs keep Description
    /// in a separate column while MFR+CatalogNumber are packed into the match-key cell.
    /// e.g. "Description", "DESCRIPTION", "Product Description"
    /// MFR is always extracted from MatchColumn via the Format template — there is no
    /// separate ColMFR because MFR is by definition part of the match key encoding.
    /// </summary>
    public string? ColDescription { get; set; }

    /// <summary>
    /// Optional column header for the quantity (number of units the listed price covers).
    /// Used together with ColTotal: expectedTotal = MasterPrice × Quantity, compared against ColTotal.
    /// e.g. "QTY", "Quantity", "Ship Qty"
    /// Leave null when no quantity column exists in the uploaded glossary.
    /// </summary>
    public string? ColQuantity { get; set; }

    /// <summary>
    /// Optional column header for the invoice line total.
    /// When set, price comparison uses: expectedTotal = masterPricePerUnit × Quantity,
    /// and compares against this column's value (dollarDiff = invoiceTotal − expectedTotal).
    /// e.g. "Total", "Line Total", "Ext Price"
    /// Leave null to fall back to per-unit price comparison.
    /// </summary>
    public string? ColTotal { get; set; }

    /// <summary>
    /// Optional column header for the invoice number.
    /// When set, the invoice number is extracted from each row and included in comparison
    /// results and the generated PDF report.
    /// e.g. "Invoice #", "Invoice Number", "INV #"
    /// </summary>
    public string? ColInvoiceNumber { get; set; }

    /// <summary>
    /// Optional manual override for the left X-coordinate (in PDF points) of the
    /// match column. When set, this value replaces the X anchor derived from the
    /// header phrase position, ensuring correct column bucketing even when the
    /// header text and data are horizontally misaligned (common in CED invoices).
    /// Leave null to use automatic header-derived positioning.
    /// </summary>
    public double? MatchColX { get; set; }

    /// <summary>
    /// Optional manual override for the left X-coordinate (in PDF points) of the
    /// price column. When set, this value replaces the X anchor derived from the
    /// header phrase position.
    /// Leave null to use automatic header-derived positioning.
    /// </summary>
    public double? PriceColX { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
