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
