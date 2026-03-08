namespace BOS.Backend.Models;

/// <summary>
/// Records that a specific Gmail message has been assigned to an EmailCategory,
/// optionally with a sub-status. One assignment per email (unique on MessageId).
/// Changing the category = updating this row; removing = deleting it.
/// </summary>
public class EmailAssignment
{
    public int    Id                   { get; set; }
    public string MessageId            { get; set; } = string.Empty;
    public int    CategoryId           { get; set; }
    public int?   StatusId             { get; set; }
    public string AssignedByUserEmail  { get; set; } = string.Empty;
    public DateTime AssignedAt         { get; set; } = DateTime.UtcNow;

    public EmailCategory        Category { get; set; } = null!;
    public EmailCategoryStatus? Status   { get; set; }
}
