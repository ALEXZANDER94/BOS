namespace BOS.Backend.Models;

public class CannedResponse
{
    public int      Id                 { get; set; }
    public int      CategoryId         { get; set; }
    public string   Name               { get; set; } = "";
    public string?  Subject            { get; set; }
    public string   BodyHtml           { get; set; } = "";

    public string?  DefaultTo          { get; set; }
    public string?  DefaultCc          { get; set; }
    public string?  DefaultBcc         { get; set; }

    public string   CreatedByUserEmail { get; set; } = "";
    public DateTime CreatedAt          { get; set; }
    public DateTime UpdatedAt          { get; set; }

    public CannedResponseCategory Category { get; set; } = null!;

    public ICollection<CannedResponseAttachment> Attachments { get; set; } = [];
}
