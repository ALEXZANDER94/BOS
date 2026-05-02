namespace BOS.Backend.Models;

public class TicketAttachment
{
    public int    Id              { get; set; }
    public int    TicketId        { get; set; }
    public Ticket Ticket          { get; set; } = null!;

    /// <summary>Original filename as provided by the uploader.</summary>
    public string FileName        { get; set; } = string.Empty;

    /// <summary>GUID-based filename used on disk to prevent enumeration.</summary>
    public string StoredFileName  { get; set; } = string.Empty;

    public string ContentType     { get; set; } = string.Empty;
    public long   FileSize        { get; set; }

    public string   UploadedByEmail { get; set; } = string.Empty;
    public DateTime UploadedAt      { get; set; } = DateTime.UtcNow;
}
