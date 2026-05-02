namespace BOS.Backend.Models;

// Project-side Plan. Lives under a Building. Lots are later assigned to a Plan
// via Lot.PlanId. Distinct from ProposalPlan — when a multi-family Proposal
// converts, each ProposalPlan becomes one of these.
public class Plan
{
    public int       Id         { get; set; }
    public int       BuildingId { get; set; }
    public Building? Building   { get; set; }

    public string  PlanName       { get; set; } = string.Empty;
    public int     SquareFootage  { get; set; }
    public decimal Amount         { get; set; }   // price

    public ICollection<Lot> Lots { get; set; } = [];
}
