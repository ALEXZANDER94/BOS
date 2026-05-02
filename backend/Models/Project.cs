namespace BOS.Backend.Models;

public class Project
{
    public int     Id          { get; set; }
    public int     ClientId    { get; set; }
    public Client? Client      { get; set; }

    public string    Name        { get; set; } = string.Empty;
    public string    Description { get; set; } = string.Empty;
    public string    Status      { get; set; } = "Active"; // Active | Completed | On Hold | Cancelled
    public DateTime? StartDate   { get; set; }
    public DateTime? EndDate     { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // ── QuickBooks Project (sub-customer) link ──────────────────────────────
    // When set, the Estimates tab queries QB for this sub-customer's invoices/
    // estimates instead of the parent client's. Cached after auto-match-by-name
    // on first visit; manually overridable from the Estimates tab.
    public string? QbProjectId   { get; set; }
    public string? QbProjectName { get; set; }

    // ── Proposal-conversion traceability + single-family carry-over ─────────
    public int?     SourceProposalId     { get; set; }
    public Proposal? SourceProposal      { get; set; }
    public int?     SourceLibraryId      { get; set; }
    public Library? SourceLibrary        { get; set; }

    // Single-family fields populated during conversion. Empty/null for projects
    // not derived from a single-family proposal.
    public string Address              { get; set; } = string.Empty;
    public string City                 { get; set; } = string.Empty;
    public string ProductStandards     { get; set; } = string.Empty;
    public string Version              { get; set; } = string.Empty;
    public string BuyerUpgrades        { get; set; } = string.Empty;
    public string RevisionsAfterLaunch { get; set; } = string.Empty;

    public ICollection<ProjectContact>      ProjectContacts { get; set; } = [];
    public ICollection<ProjectCustomUpgrade> CustomUpgrades { get; set; } = [];
}
