namespace BOS.Backend.Models;

public class TicketCategory
{
    public int    Id    { get; set; }
    public string Name  { get; set; } = string.Empty;
    public string Color { get; set; } = "#6b7280";

    public ICollection<Ticket> Tickets { get; set; } = [];
}
