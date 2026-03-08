namespace BOS.Backend.DTOs;

public record EmailCategoryStatusDto(
    int    Id,
    int    CategoryId,
    string Name,
    string Color,
    int    DisplayOrder
);

public record EmailCategoryDto(
    int    Id,
    string Name,
    string Color,
    string CreatedByUserEmail,
    IReadOnlyList<EmailCategoryStatusDto> Statuses
);

public record CreateEmailCategoryRequest(string Name, string Color);
public record UpdateEmailCategoryRequest(string Name, string Color);

public record CreateEmailCategoryStatusRequest(string Name, string Color, int DisplayOrder = 0);
public record UpdateEmailCategoryStatusRequest(string Name, string Color, int DisplayOrder);

public record EmailAssignmentDto(
    int    Id,
    string MessageId,
    int    CategoryId,
    string CategoryName,
    string CategoryColor,
    int?   StatusId,
    string? StatusName,
    string? StatusColor,
    string AssignedByUserEmail,
    DateTime AssignedAt
);

public record UpsertEmailAssignmentRequest(
    int    CategoryId,
    int?   StatusId
);

public record PatchEmailAssignmentStatusRequest(int? StatusId);
