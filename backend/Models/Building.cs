namespace BOS.Backend.Models;

public class Building
{
    public int      Id          { get; set; }
    public int      ProjectId   { get; set; }
    public Project? Project     { get; set; }

    public string Name        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int    SortOrder   { get; set; }

    public ICollection<Lot>     Lots     { get; set; } = [];
    public ICollection<Fixture> Fixtures { get; set; } = [];
    public ICollection<Plan>    Plans    { get; set; } = [];
}
