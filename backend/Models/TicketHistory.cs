namespace BOS.Backend.Models;

public class TicketHistory
{
    public int    Id             { get; set; }
    public int    TicketId       { get; set; }
    public Ticket Ticket         { get; set; } = null!;

    public string  ChangedByEmail { get; set; } = string.Empty;
    public string  FieldChanged   { get; set; } = string.Empty;
    public string? OldValue       { get; set; }
    public string? NewValue       { get; set; }

    public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
}
