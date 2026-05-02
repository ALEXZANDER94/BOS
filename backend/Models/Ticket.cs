namespace BOS.Backend.Models;

public class Ticket
{
    public int    Id               { get; set; }
    public string Title            { get; set; } = string.Empty;
    public string Description      { get; set; } = string.Empty;

    /// <summary>Low | Medium | High | Critical</summary>
    public string Priority         { get; set; } = "Medium";

    public int?           CategoryId { get; set; }
    public TicketCategory? Category  { get; set; }

    public int          StatusId { get; set; }
    public TicketStatus Status   { get; set; } = null!;

    public string  CreatedByEmail    { get; set; } = string.Empty;
    public string? AssignedToEmail   { get; set; }

    public int?     ProjectId { get; set; }
    public Project? Project   { get; set; }

    /// <summary>Gmail message ID of the linked email (optional).</summary>
    public string? LinkedEmailMessageId { get; set; }

    public DateTime? DueDate             { get; set; }
    public DateTime? OverdueNotifiedAt   { get; set; }
    public DateTime? ClosedAt            { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<TicketComment>    Comments    { get; set; } = [];
    public ICollection<TicketHistory>    History     { get; set; } = [];
    public ICollection<TicketWatcher>    Watchers    { get; set; } = [];
    public ICollection<TicketAttachment> Attachments { get; set; } = [];
}
