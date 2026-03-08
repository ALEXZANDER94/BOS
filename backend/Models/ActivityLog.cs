namespace BOS.Backend.Models;

public class ActivityLog
{
    public int     Id       { get; set; }
    public int     ClientId { get; set; }
    public Client? Client   { get; set; }

    public string   Type       { get; set; } = "Note"; // Call | Email | Meeting | Note
    public string   Note       { get; set; } = string.Empty;
    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
