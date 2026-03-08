namespace BOS.Backend.Models;

/// <summary>
/// A user-defined workflow status scoped to a specific EmailCategory.
/// Examples within "Invoice": "On-Hold", "Processing", "Completed".
/// </summary>
public class EmailCategoryStatus
{
    public int    Id                 { get; set; }
    public int    CategoryId         { get; set; }
    public string Name               { get; set; } = string.Empty;
    public string Color              { get; set; } = "#6b7280";
    public int    DisplayOrder       { get; set; } = 0;
    public string CreatedByUserEmail { get; set; } = string.Empty;
    public DateTime CreatedAt        { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt        { get; set; } = DateTime.UtcNow;

    public EmailCategory Category { get; set; } = null!;
}
