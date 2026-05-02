namespace BOS.Backend.DTOs;

// ── List rows ────────────────────────────────────────────────────────────────

public record ProposalListItemDto(
    int       Id,
    int       ClientId,
    string    Name,
    string    Type,
    string    Status,
    int?      ConvertedProjectId,
    DateTime? Deadline,
    DateTime  CreatedAt,
    DateTime  UpdatedAt);

public record ProposalWithClientDto(
    int       Id,
    int       ClientId,
    string    ClientName,
    string    Name,
    string    Type,
    string    Status,
    int?      ConvertedProjectId,
    DateTime? Deadline,
    DateTime  CreatedAt,
    DateTime  UpdatedAt);

// ── Detail / payload ─────────────────────────────────────────────────────────

public record ProposalDto(
    int       Id,
    int       ClientId,
    string    Name,
    string    Type,
    string    Status,
    int?      ConvertedProjectId,
    DateTime? Deadline,
    int       DeadlineReminderDays,
    DateTime  CreatedAt,
    DateTime  UpdatedAt,
    // Notes & field visibility
    string   Notes,
    string   VisibleFields,
    // PDF attachment
    string?  PdfFileName,
    long     PdfContentLength,
    // Single-family fields (null/empty for multi-family)
    int?     LibraryId,
    string?  LibraryTitle,
    string   Address,
    string   City,
    string   ProductStandards,
    string   Version,
    string   BuyerUpgrades,
    string   RevisionsAfterLaunch,
    // Multi-family fields
    List<ProposalBuildingDto> Buildings,
    // Custom upgrade toggle state
    List<ProposalUpgradeStateDto> CustomUpgrades,
    // Pricing history
    List<ProposalPricingDto> Pricings);

public record ProposalBuildingDto(
    int    Id,
    string Name,
    List<ProposalPlanDto> Plans);

public record ProposalPlanDto(
    int     Id,
    string  PlanName,
    int     SquareFootage,
    decimal Amount);

public record ProposalUpgradeStateDto(
    int    CustomUpgradeId,
    string Name,
    string Description,
    bool   IsGlobal,
    bool   IsEnabled);

public record ProposalPricingDto(
    int      Id,
    string   Label,
    decimal  PricePerSqFt,
    decimal  TotalAmount,
    string   Notes,
    DateTime CreatedAt);

// ── Create / update ──────────────────────────────────────────────────────────

public record CreateProposalRequest(
    string  Name,
    string  Type,             // SingleFamily | MultiFamily
    string  Status,           // optional, defaults to Draft
    DateTime? Deadline,
    int?    DeadlineReminderDays,
    string? Notes,
    string? VisibleFields,
    int?    LibraryId,
    string? Address,
    string? City,
    string? ProductStandards,
    string? Version,
    string? BuyerUpgrades,
    string? RevisionsAfterLaunch,
    List<ProposalBuildingInput>? Buildings,
    List<ProposalUpgradeInput>?  CustomUpgrades);

public record UpdateProposalRequest(
    string  Name,
    string  Status,
    DateTime? Deadline,
    int?    DeadlineReminderDays,
    string? Notes,
    string? VisibleFields,
    int?    LibraryId,
    string? Address,
    string? City,
    string? ProductStandards,
    string? Version,
    string? BuyerUpgrades,
    string? RevisionsAfterLaunch,
    List<ProposalBuildingInput>? Buildings,
    List<ProposalUpgradeInput>?  CustomUpgrades);

public record ProposalBuildingInput(
    int?    Id,             // null for new
    string  Name,
    List<ProposalPlanInput> Plans);

public record ProposalPlanInput(
    int?    Id,             // null for new
    string  PlanName,
    int     SquareFootage,
    decimal Amount);

public record ProposalUpgradeInput(int CustomUpgradeId, bool IsEnabled);

// ── Pricing ─────────────────────────────────────────────────────────────────

public record CreateProposalPricingRequest(
    string  Label,
    decimal PricePerSqFt,
    decimal TotalAmount,
    string? Notes);

public record UpdateProposalPricingRequest(
    string  Label,
    decimal PricePerSqFt,
    decimal TotalAmount,
    string? Notes);

// ── Convert ──────────────────────────────────────────────────────────────────

public record ConvertProposalResultDto(int ProjectId);
