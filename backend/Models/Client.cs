namespace BOS.Backend.Models;

public class Client
{
    public int    Id          { get; set; }
    public string Name        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status      { get; set; } = "Active";   // "Active" | "Inactive"
    public string Industry    { get; set; } = string.Empty;
    public string Website     { get; set; } = string.Empty;
    public string Domain      { get; set; } = string.Empty;

    // Address
    public string Street { get; set; } = string.Empty;
    public string City   { get; set; } = string.Empty;
    public string State  { get; set; } = string.Empty;
    public string Zip    { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // ── QuickBooks customer mapping ──────────────────────────────────────────
    // Cached after auto-match-by-name on first Estimates/Invoices tab visit.
    // Manual override available from EditClientModal.
    public string? QbCustomerId   { get; set; }
    public string? QbCustomerName { get; set; }

    // ── Tab visibility (per-client) ──────────────────────────────────────────
    // Each flag controls whether the corresponding tab + panel renders on the
    // Client Detail page. All default true for backwards compatibility.
    public bool ShowContacts  { get; set; } = true;
    public bool ShowProjects  { get; set; } = true;
    public bool ShowProposals { get; set; } = true;
    public bool ShowLibraries { get; set; } = true;
    public bool ShowActivity  { get; set; } = true;
    public bool ShowOptions   { get; set; } = true;

    // Navigation
    public ICollection<Contact>     Contacts     { get; set; } = [];
    public ICollection<Project>     Projects     { get; set; } = [];
    public ICollection<ActivityLog> ActivityLogs { get; set; } = [];
}
