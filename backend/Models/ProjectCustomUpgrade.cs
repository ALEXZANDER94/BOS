namespace BOS.Backend.Models;

// Toggle state for a CustomUpgrade on a specific Project.
// Carried over from ProposalCustomUpgrade on conversion.
public class ProjectCustomUpgrade
{
    public int             ProjectId       { get; set; }
    public Project?        Project         { get; set; }

    public int             CustomUpgradeId { get; set; }
    public CustomUpgrade?  CustomUpgrade   { get; set; }

    public bool            IsEnabled       { get; set; }
}
