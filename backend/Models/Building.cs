namespace BOS.Backend.Models;

public class Building
{
    public int      Id          { get; set; }
    public int      ProjectId   { get; set; }
    public Project? Project     { get; set; }

    public string Name        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    public ICollection<Lot> Lots { get; set; } = [];
}
