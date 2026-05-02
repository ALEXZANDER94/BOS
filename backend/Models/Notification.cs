namespace BOS.Backend.Models;

public class Notification
{
    public int      Id               { get; set; }
    public string   RecipientEmail   { get; set; } = "";
    public string   Type             { get; set; } = "mention";
    public string   Title            { get; set; } = "";
    public string   Body             { get; set; } = "";
    public bool     IsRead           { get; set; }
    public DateTime CreatedAt        { get; set; }
    public string?  RelatedMessageId { get; set; }
    public int?     RelatedNoteId    { get; set; }
    public int?     RelatedTicketId   { get; set; }
    public int?     RelatedProposalId { get; set; }
}
