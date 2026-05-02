namespace BOS.Backend.DTOs;

public record NotificationDto(
    int      Id,
    string   Type,
    string   Title,
    string   Body,
    bool     IsRead,
    DateTime CreatedAt,
    string?  RelatedMessageId,
    int?     RelatedNoteId,
    int?     RelatedTicketId,
    int?     RelatedProposalId);
