namespace BOS.Backend.Models;

// Manual link between a BOS Project and a QuickBooks Estimate (Approach B).
// Approach A (Custom Field on the QB document) does NOT use this table —
// those linkages are derived live from QB on each fetch.
public class ProjectQbEstimateLink
{
    public int      Id           { get; set; }
    public int      ProjectId    { get; set; }
    public Project? Project      { get; set; }

    // QuickBooks-side estimate id (Estimate.Id).
    public string   QbEstimateId { get; set; } = string.Empty;

    public DateTime LinkedAt     { get; set; } = DateTime.UtcNow;
}
