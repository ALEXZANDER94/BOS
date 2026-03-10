namespace BOS.Backend.DTOs;

public record EmailNoteDto(
    int      Id,
    string   MessageId,
    string   UserEmail,
    string   NoteText,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreateEmailNoteRequest(string NoteText);
public record UpdateEmailNoteRequest(string NoteText);
