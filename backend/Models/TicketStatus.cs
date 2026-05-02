namespace BOS.Backend.Models;

public class TicketStatus
{
    public int    Id           { get; set; }
    public string Name         { get; set; } = string.Empty;
    public string Color        { get; set; } = "#6b7280";
    public bool   IsDefault    { get; set; }
    public bool   IsClosed     { get; set; }
    public int    DisplayOrder { get; set; }

    public ICollection<Ticket> Tickets { get; set; } = [];
}
