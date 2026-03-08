namespace BOS.Backend.Models;

/// <summary>
/// A user-defined top-level classification for emails.
/// Examples: "Invoice", "Scheduling", "Proposal".
/// Each category may contain child EmailCategoryStatuses.
/// </summary>
public class EmailCategory
{
    public int    Id                  { get; set; }
    public string Name                { get; set; } = string.Empty;
    public string Color               { get; set; } = "#6b7280";
    public string CreatedByUserEmail  { get; set; } = string.Empty;
    public DateTime CreatedAt         { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt         { get; set; } = DateTime.UtcNow;

    public ICollection<EmailCategoryStatus> Statuses    { get; set; } = [];
    public ICollection<EmailAssignment>     Assignments { get; set; } = [];
}
