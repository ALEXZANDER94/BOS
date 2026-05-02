namespace BOS.Backend.Models;

// Toggle state for a CustomUpgrade on a specific Proposal.
public class ProposalCustomUpgrade
{
    public int             ProposalId      { get; set; }
    public Proposal?       Proposal        { get; set; }

    public int             CustomUpgradeId { get; set; }
    public CustomUpgrade?  CustomUpgrade   { get; set; }

    public bool            IsEnabled       { get; set; }
}
