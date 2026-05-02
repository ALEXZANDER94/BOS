namespace BOS.Backend.Models;

public class CannedResponseAttachment
{
    public int            Id                { get; set; }
    public int            CannedResponseId  { get; set; }
    public CannedResponse CannedResponse    { get; set; } = null!;

    public string FileName        { get; set; } = string.Empty;
    public string StoredFileName  { get; set; } = string.Empty;
    public string ContentType     { get; set; } = string.Empty;
    public long   FileSize        { get; set; }

    public string   UploadedByEmail { get; set; } = string.Empty;
    public DateTime UploadedAt      { get; set; } = DateTime.UtcNow;
}
