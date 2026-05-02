namespace BOS.Backend.Models;

public class CannedResponseCategory
{
    public int      Id                { get; set; }
    public string   Name              { get; set; } = "";
    public int      SortOrder         { get; set; }
    public string   CreatedByUserEmail { get; set; } = "";
    public DateTime CreatedAt         { get; set; }

    public ICollection<CannedResponse> Responses { get; set; } = [];
}
