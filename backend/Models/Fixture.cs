namespace BOS.Backend.Models;

public class Fixture
{
    public int      Id         { get; set; }
    public int      BuildingId { get; set; }
    public Building Building   { get; set; } = null!;

    public int?            LocationId { get; set; }
    public FixtureLocation? Location  { get; set; }

    public string Code        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int    Quantity    { get; set; } = 1;
    public string Note        { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
