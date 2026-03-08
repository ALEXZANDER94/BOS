namespace BOS.Backend.Models;

/// <summary>
/// Join entity linking a Project to a Contact from the same Client.
/// </summary>
public class ProjectContact
{
    public int ProjectId { get; set; }
    public int ContactId { get; set; }

    public Project Project { get; set; } = null!;
    public Contact Contact { get; set; } = null!;
}
