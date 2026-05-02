namespace BOS.Backend.Models;

public class TicketWatcher
{
    public int    TicketId  { get; set; }
    public Ticket Ticket    { get; set; } = null!;

    public string UserEmail { get; set; } = string.Empty;
}
