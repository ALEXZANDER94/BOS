namespace BOS.Backend.Models;

public class EmailNote
{
    public int      Id        { get; set; }
    public string   MessageId { get; set; } = "";
    public string   UserEmail { get; set; } = "";
    public string   NoteText  { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}
