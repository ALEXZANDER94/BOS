namespace BOS.Backend.Models;

// A plan inside a multi-family proposal building. Carries unit-type metadata
// (square footage + price). On conversion this becomes a project-side Plan
// under the corresponding Building; lots are assigned to plans later.
public class ProposalPlan
{
    public int               Id                 { get; set; }
    public int               ProposalBuildingId { get; set; }
    public ProposalBuilding? ProposalBuilding   { get; set; }

    public string  PlanName       { get; set; } = string.Empty;
    public int     SquareFootage  { get; set; }
    public decimal Amount         { get; set; }   // price
}
