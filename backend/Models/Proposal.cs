namespace BOS.Backend.Models;

// A pre-project record that can be converted into a Project.
// Both single-family and multi-family proposals share this table; the Type
// discriminator decides which optional field set is in use.
public class Proposal
{
    public int     Id       { get; set; }
    public int     ClientId { get; set; }
    public Client? Client   { get; set; }

    public string Name   { get; set; } = string.Empty;
    public string Type   { get; set; } = "SingleFamily";  // SingleFamily | MultiFamily
    public string Status { get; set; } = "Draft";         // Draft | Sent | Accepted | Converted | Rejected

    // Set on conversion; the Proposal record is kept for history.
    public int? ConvertedProjectId { get; set; }

    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime  UpdatedAt { get; set; } = DateTime.UtcNow;

    // ── Deadline & notifications ────────────────────────────────────────────
    public DateTime? Deadline             { get; set; }
    public int       DeadlineReminderDays { get; set; } = 2;
    public DateTime? DeadlineNotifiedAt   { get; set; }
    public string    CreatedByEmail       { get; set; } = string.Empty;

    // ── Notes & field visibility ────────────────────────────────────────────
    public string Notes         { get; set; } = string.Empty;
    public string VisibleFields { get; set; } = string.Empty;  // comma-separated, e.g. "productStandards,buyerUpgrades,notes"

    // ── Optional PDF attachment ─────────────────────────────────────────────
    public string? PdfFileName       { get; set; }
    public string? PdfStoredFileName { get; set; }
    public long    PdfContentLength  { get; set; }

    // ── Single-family fields (nullable when MultiFamily) ────────────────────
    public int?     LibraryId            { get; set; }
    public Library? Library              { get; set; }
    public string   Address              { get; set; } = string.Empty;
    public string   City                 { get; set; } = string.Empty;
    public string   ProductStandards     { get; set; } = string.Empty;
    public string   Version              { get; set; } = string.Empty;
    public string   BuyerUpgrades        { get; set; } = string.Empty;
    public string   RevisionsAfterLaunch { get; set; } = string.Empty;

    // ── Multi-family fields ─────────────────────────────────────────────────
    public ICollection<ProposalBuilding> Buildings { get; set; } = [];

    // ── Custom upgrade toggle state (both types) ────────────────────────────
    public ICollection<ProposalCustomUpgrade> CustomUpgrades { get; set; } = [];

    // ── Pricing history (both types) ────────────────────────────────────────
    public ICollection<ProposalPricing> Pricings { get; set; } = [];
}
