namespace BOS.Backend.Models;

public class ProposalPricing
{
    public int     Id         { get; set; }
    public int     ProposalId { get; set; }
    public Proposal? Proposal { get; set; }

    public string  Label        { get; set; } = string.Empty;
    public decimal PricePerSqFt { get; set; }
    public decimal TotalAmount  { get; set; }
    public string  Notes        { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
