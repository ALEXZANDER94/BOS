namespace BOS.Backend.Models;

public class PurchaseOrder
{
    public int      Id          { get; set; }
    public int      ProjectId   { get; set; }
    public Project? Project     { get; set; }
    public int      LotId       { get; set; }
    public Lot?     Lot         { get; set; }

    public string  OrderNumber   { get; set; } = string.Empty;
    public string? InvoiceNumber { get; set; }           // QB DocNumber, populated on sync
    public decimal Amount        { get; set; }
    public string  Status        { get; set; } = "Open"; // Synced from QuickBooks; Open | Closed

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
