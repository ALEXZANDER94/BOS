namespace BOS.Backend.DTOs;

// ── Response types ─────────────────────────────────────────────────────────────

public record ProjectAssignmentDto(int ProjectId, string ProjectName, decimal? Price);

public record ClientAddonDto(
    int                        Id,
    int                        ClientId,
    string                     Code,
    string                     Description,
    string                     Notes,
    List<ProjectAssignmentDto> Assignments);

// Used by the project-side panel: one record per client option, with assignment status
public record ProjectAddonOptionDto(
    int      AddonId,
    string   Code,
    string   Description,
    string   Notes,
    bool     IsAssigned,
    decimal? Price);

// ── Request types ─────────────────────────────────────────────────────────────

public record CreateAddonRequest(string Code, string Description, string Notes);
public record UpdateAddonRequest(string Code, string Description, string Notes);

public record UpsertAssignmentRequest(decimal? Price);

public record BulkAssignItem(int AddonId, decimal? Price);
public record BulkAssignRequest(List<BulkAssignItem> Items);

// ── Import ────────────────────────────────────────────────────────────────────

public record AddonCsvRowError(int RowNumber, string Code, string Reason);

public record AddonCsvImportResultDto(
    int                    AddonsImported,
    int                    AddonsUpdated,
    int                    AssignmentsCreated,
    int                    AssignmentsUpdated,
    int                    ErrorCount,
    List<AddonCsvRowError> Errors);
