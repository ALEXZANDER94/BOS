namespace BOS.Backend.DTOs;

public record CustomUpgradeDto(
    int      Id,
    int?     ClientId,
    bool     IsGlobal,
    string   Name,
    string   Description,
    DateTime CreatedAt);

public record CreateCustomUpgradeRequest(int? ClientId, bool IsGlobal, string Name, string Description);
public record UpdateCustomUpgradeRequest(int? ClientId, bool IsGlobal, string Name, string Description);

// Reports of where an upgrade is in use, returned in the 409 body when delete is blocked.
public record CustomUpgradeUsageDto(
    int ProposalCount,
    int ProjectCount,
    int LibraryCount,
    List<CustomUpgradeUsageRef> References);

public record CustomUpgradeUsageRef(string Kind, int Id, string Name);
