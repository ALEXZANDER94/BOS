namespace BOS.Backend.Models;

public class TicketComment
{
    public int    Id          { get; set; }
    public int    TicketId    { get; set; }
    public Ticket Ticket      { get; set; } = null!;

    public string AuthorEmail { get; set; } = string.Empty;
    public string Body        { get; set; } = string.Empty;

    /// <summary>When true, only the author and admins can see this comment.</summary>
    public bool IsPrivate { get; set; }

    /// <summary>Soft-deleted comments show a placeholder instead of their content.</summary>
    public bool IsDeleted { get; set; }

    public DateTime  CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
