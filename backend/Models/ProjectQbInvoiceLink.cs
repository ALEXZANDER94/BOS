namespace BOS.Backend.Models;

// Manual link between a BOS Project and a QuickBooks Invoice (Approach B).
// Also auto-populated when an Estimate is converted to an Invoice via the app —
// in that case FromEstimateId stores the source estimate's QB id.
public class ProjectQbInvoiceLink
{
    public int      Id             { get; set; }
    public int      ProjectId      { get; set; }
    public Project? Project        { get; set; }

    // QuickBooks-side invoice id (Invoice.Id).
    public string   QbInvoiceId    { get; set; } = string.Empty;

    // Set when this invoice was created via the in-app Convert flow.
    public string?  FromEstimateId { get; set; }

    public DateTime LinkedAt       { get; set; } = DateTime.UtcNow;
}
