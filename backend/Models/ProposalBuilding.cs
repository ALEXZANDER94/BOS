namespace BOS.Backend.Models;

// Multi-family proposal building. Flat — distinct from the project-side Building
// model used in Buildings & Lots. On conversion this 1:1 maps to a project Building.
public class ProposalBuilding
{
    public int       Id         { get; set; }
    public int       ProposalId { get; set; }
    public Proposal? Proposal   { get; set; }

    public string Name { get; set; } = string.Empty;

    public ICollection<ProposalPlan> Plans { get; set; } = [];
}
