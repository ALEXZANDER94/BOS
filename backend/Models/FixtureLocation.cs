namespace BOS.Backend.Models;

public class FixtureLocation
{
    public int    Id   { get; set; }
    public string Name { get; set; } = string.Empty;

    public ICollection<Fixture> Fixtures { get; set; } = [];
}
