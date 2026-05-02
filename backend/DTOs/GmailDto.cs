namespace BOS.Backend.DTOs;

public record EmailSummaryDto(
    string   MessageId,
    string   ThreadId,
    string   Subject,
    string   Snippet,
    string   FromAddress,
    string   FromName,
    string   ToAddresses,
    DateTime ReceivedAt,
    bool     IsRead,
    int?     ClientId,
    string?  ClientName,
    int?     ContactId,
    string?  ContactName,
    string?  RfcMessageId
);

public record AttachmentMetaDto(
    string AttachmentId,
    string Filename,
    string MimeType,
    long   Size);

public record EmailDetailDto(
    string   MessageId,
    string   ThreadId,
    string   Subject,
    string   FromAddress,
    string   FromName,
    string   ToAddresses,
    string?  CcAddresses,
    DateTime ReceivedAt,
    bool     IsRead,
    string?  BodyText,
    string?  BodyHtml,
    int?     ClientId,
    string?  ClientName,
    int?     ContactId,
    string?  ContactName,
    List<AttachmentMetaDto> Attachments,
    string?  RfcMessageId
);

public record EmailListResponse(
    IReadOnlyList<EmailSummaryDto> Emails,
    string?                        NextPageToken,
    int                            TotalEstimate
);

public record GmailStatusDto(
    bool      IsConnected,
    DateTime? TokenExpiry
);

// ── Compose / Send ────────────────────────────────────────────────────────────

// One inline attachment carried with a compose request. The frontend uploads files
// as multipart parts; this DTO is what the controller hands the service after parsing.
public record OutboundAttachment(
    string FileName,
    string MimeType,
    byte[] Content
);

// Used for brand-new compose. To/Cc/Bcc are comma-separated address strings just like
// the existing read DTOs so the frontend doesn't have to special-case them.
public record SendMessageRequest(
    string To,
    string? Cc,
    string? Bcc,
    string Subject,
    string BodyHtml,
    string? BodyText,
    List<OutboundAttachment> Attachments
);

// Reply / reply-all / forward use the same shape but the service additionally pulls
// threading headers from the source message identified by SourceMessageId.
public record ReplyRequest(
    string SourceMessageId,
    bool   ReplyAll,
    string To,
    string? Cc,
    string? Bcc,
    string Subject,
    string BodyHtml,
    string? BodyText,
    List<OutboundAttachment> Attachments
);

public record ForwardRequest(
    string SourceMessageId,
    string To,
    string? Cc,
    string? Bcc,
    string Subject,
    string BodyHtml,
    string? BodyText,
    List<OutboundAttachment> Attachments,
    bool IncludeOriginalAttachments
);

// Service returns this after a successful send so the frontend can navigate to the
// new message in the user's mailbox without re-fetching the whole list.
public record SendResultDto(
    string MessageId,
    string ThreadId
);

// ── Labels ────────────────────────────────────────────────────────────────────

public record GmailLabelDto(
    string Id,
    string Name,
    string Type,        // "system" or "user"
    int?   UnreadCount,
    int?   TotalCount
);

public record ModifyLabelsRequest(
    List<string> AddLabelIds,
    List<string> RemoveLabelIds
);

// ── Drafts ────────────────────────────────────────────────────────────────────

public record DraftSummaryDto(
    string DraftId,
    string MessageId,
    string ThreadId,
    string Subject,
    string To,
    string? Snippet,
    DateTime UpdatedAt
);

public record DraftDetailDto(
    string DraftId,
    string MessageId,
    string ThreadId,
    string Subject,
    string To,
    string? Cc,
    string? Bcc,
    string? BodyHtml,
    string? BodyText,
    List<AttachmentMetaDto> Attachments,
    string? InReplyToMessageId,   // populated if this draft was started as a reply
    DateTime UpdatedAt
);

public record DraftListResponse(
    IReadOnlyList<DraftSummaryDto> Drafts
);

public record SaveDraftRequest(
    string? DraftId,                // null = create new, otherwise update
    string? SourceMessageId,        // for reply/forward drafts (sets In-Reply-To/References)
    bool    ReplyAll,
    string  To,
    string? Cc,
    string? Bcc,
    string  Subject,
    string  BodyHtml,
    string? BodyText,
    List<OutboundAttachment> Attachments
);

public record DraftSavedDto(
    string DraftId,
    string MessageId,
    string ThreadId
);
