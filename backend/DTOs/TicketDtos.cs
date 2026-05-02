namespace BOS.Backend.DTOs;

// ── Category ──────────────────────────────────────────────────────────────────

public record TicketCategoryDto(int Id, string Name, string Color);
public record CreateTicketCategoryRequest(string Name, string Color);
public record UpdateTicketCategoryRequest(string Name, string Color);

// ── Status ────────────────────────────────────────────────────────────────────

public record TicketStatusDto(int Id, string Name, string Color, bool IsDefault, bool IsClosed, int DisplayOrder);
public record CreateTicketStatusRequest(string Name, string Color, bool IsDefault, bool IsClosed);
public record UpdateTicketStatusRequest(string Name, string Color, bool IsDefault, bool IsClosed, int DisplayOrder);

// ── Attachment ────────────────────────────────────────────────────────────────

public record TicketAttachmentDto(
    int    Id,
    int    TicketId,
    string FileName,
    string ContentType,
    long   FileSize,
    string UploadedByEmail,
    string UploadedAt);

// ── Comment ───────────────────────────────────────────────────────────────────

public record TicketCommentDto(
    int     Id,
    int     TicketId,
    string  AuthorEmail,
    string  Body,
    bool    IsPrivate,
    bool    IsDeleted,
    string  CreatedAt,
    string? UpdatedAt);

public record CreateTicketCommentRequest(string Body, bool IsPrivate);
public record UpdateTicketCommentRequest(string Body);

// ── History ───────────────────────────────────────────────────────────────────

public record TicketHistoryDto(
    int     Id,
    int     TicketId,
    string  ChangedByEmail,
    string  FieldChanged,
    string? OldValue,
    string? NewValue,
    string  ChangedAt);

// ── Watcher ───────────────────────────────────────────────────────────────────

public record TicketWatcherDto(int TicketId, string UserEmail);

// ── Ticket summary (list view) ────────────────────────────────────────────────

public record TicketSummaryDto(
    int     Id,
    string  TicketNumber,
    string  Title,
    string  Priority,
    int?    CategoryId,
    string? CategoryName,
    string? CategoryColor,
    int     StatusId,
    string  StatusName,
    string  StatusColor,
    bool    StatusIsClosed,
    string  CreatedByEmail,
    string? AssignedToEmail,
    int?    ProjectId,
    string? ProjectName,
    string? LinkedEmailMessageId,
    string? DueDate,
    bool    IsOverdue,
    int     CommentCount,
    int     AttachmentCount,
    string  CreatedAt,
    string  UpdatedAt);

// ── Ticket detail (full) ──────────────────────────────────────────────────────

public record TicketDetailDto(
    int     Id,
    string  TicketNumber,
    string  Title,
    string  Description,
    string  Priority,
    int?    CategoryId,
    string? CategoryName,
    string? CategoryColor,
    int     StatusId,
    string  StatusName,
    string  StatusColor,
    bool    StatusIsClosed,
    string  CreatedByEmail,
    string? AssignedToEmail,
    int?    ProjectId,
    string? ProjectName,
    string? LinkedEmailMessageId,
    string? DueDate,
    bool    IsOverdue,
    string? ClosedAt,
    string  CreatedAt,
    string  UpdatedAt,
    bool    IsWatching,
    List<TicketCommentDto>    Comments,
    List<TicketWatcherDto>    Watchers,
    List<TicketAttachmentDto> Attachments);

// ── Create / Update ───────────────────────────────────────────────────────────

public record CreateTicketRequest(
    string    Title,
    string    Description,
    string    Priority,
    int?      CategoryId,
    int?      StatusId,
    string?   AssignedToEmail,
    int?      ProjectId,
    string?   LinkedEmailMessageId,
    DateTime? DueDate);

public record UpdateTicketRequest(
    string    Title,
    string    Description,
    string    Priority,
    int?      CategoryId,
    int       StatusId,
    string?   AssignedToEmail,
    int?      ProjectId,
    string?   LinkedEmailMessageId,
    DateTime? DueDate);

// ── Stats ─────────────────────────────────────────────────────────────────────

public record TicketStatsDto(
    int OpenCount,
    int OverdueCount,
    int AssignedToMeCount,
    int ClosedThisMonthCount);

// ── Dashboard ─────────────────────────────────────────────────────────────────

public record DashboardDto(
    TicketStatsDto            TicketStats,
    List<TicketSummaryDto>    RecentTickets,
    List<TicketSummaryDto>    MyOpenTickets,
    int                       ActiveProjectCount,
    int                       BuildingCount,
    int                       LotCount,
    int                       TotalPurchaseOrders,
    decimal                   TotalPoAmount);
