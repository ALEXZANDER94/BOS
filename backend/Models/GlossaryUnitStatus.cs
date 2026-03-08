namespace BOS.Backend.Models;

/// <summary>
/// A user-defined status label that can be assigned to any GlossaryUnit.
/// Statuses are global — not scoped to a specific supplier.
/// Examples: "Active", "Discontinued", "On Hold", "Pending Review".
/// </summary>
public class GlossaryUnitStatus
{
    public int    Id    { get; set; }
    public string Name  { get; set; } = string.Empty;

    /// <summary>
    /// Display color stored as a CSS hex string, e.g. "#3b82f6".
    /// Used to render colored badges in the glossary table.
    /// </summary>
    public string Color { get; set; } = "#6b7280";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
