namespace BOS.Backend.Models;

public class Supplier
{
    public int Id { get; set; }

    public string Name    { get; set; } = string.Empty;
    public string Domain  { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation property — EF Core uses this to load related units.
    // ICollection (not List) because EF manages the collection internally.
    public ICollection<GlossaryUnit> GlossaryUnits { get; set; } = [];

    // Navigation property — optional one-to-one relationship with ComparisonCriteria.
    // Null when no criteria has been configured for this supplier yet.
    public ComparisonCriteria? Criteria { get; set; }
}
