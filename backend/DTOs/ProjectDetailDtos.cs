namespace BOS.Backend.DTOs;

// ── Address ──────────────────────────────────────────────────────────────────

public record AddressDto(
    int    Id,
    string Address1,
    string Address2,
    string City,
    string State,
    string Zip,
    string Country);

public record UpsertAddressRequest(
    string Address1,
    string Address2,
    string City,
    string State,
    string Zip,
    string Country);

// ── Lot ───────────────────────────────────────────────────────────────────────

public record LotDto(
    int         Id,
    int         BuildingId,
    string      Name,
    string      Description,
    AddressDto? Address);

public record CreateLotRequest(string Name, string Description);
public record UpdateLotRequest(string Name, string Description);

// ── Building ──────────────────────────────────────────────────────────────────

public record BuildingDto(
    int          Id,
    int          ProjectId,
    string       Name,
    string       Description,
    List<LotDto> Lots);

public record CreateBuildingRequest(string Name, string Description);
public record UpdateBuildingRequest(string Name, string Description);

// ── PurchaseOrder ─────────────────────────────────────────────────────────────

public record PurchaseOrderStatusDto(
    int    Id,
    string Name,
    string Color);

public record CreatePoStatusRequest(string Name, string Color);
public record UpdatePoStatusRequest(string Name, string Color);
public record PatchPoInternalStatusRequest(int? StatusId);

public record PurchaseOrderDto(
    int      Id,
    int      ProjectId,
    int      LotId,
    string   LotName,
    string   BuildingName,
    string   OrderNumber,
    string?  InvoiceNumber,
    decimal  Amount,
    string   QbStatus,
    int?     InternalStatusId,
    string?  InternalStatusName,
    string?  InternalStatusColor,
    DateTime CreatedAt,
    DateTime UpdatedAt);

public record CreatePurchaseOrderRequest(int LotId, string OrderNumber, decimal Amount);
public record UpdatePurchaseOrderRequest(string OrderNumber, decimal Amount);

// ── Project detail summary ────────────────────────────────────────────────────

public record ProjectDetailDto(
    int      Id,
    int      ClientId,
    string   ClientName,
    string   Name,
    string   Description,
    string   Status,
    string?  StartDate,
    string?  EndDate,
    string   CreatedAt,
    string   UpdatedAt,
    int      BuildingCount,
    int      LotCount,
    int      PurchaseOrderCount,
    decimal  TotalPoAmount,
    List<AssignedContactDto> AssignedContacts);

public record AssignedContactDto(
    int    Id,
    string Name,
    string Email,
    string Phone,
    string Title);

// ── QuickBooks ────────────────────────────────────────────────────────────────

public record QuickBooksStatusDto(bool Connected, string? RealmId);

// ── PO CSV Import ─────────────────────────────────────────────────────────────

public record PoCsvRowError(int RowNumber, string OrderNumber, string Reason);

public record PoCsvConflict(
    int     RowNumber,
    string  OrderNumber,
    string  ExistingLot,
    string  ProposedLot,
    decimal ExistingAmount,
    decimal ProposedAmount);

public record PoCsvImportResultDto(
    int ImportedCount,
    int UpdatedCount,
    int SkippedCount,
    int ErrorCount,
    int BuildingsCreated,
    int LotsCreated,
    List<PoCsvRowError>  Errors,
    List<PoCsvConflict>  Conflicts);

// ── Building/Lot CSV Import ───────────────────────────────────────────────────

public record BuildingLotCsvRowError(int RowNumber, string BuildingName, string LotName, string Reason);

public record BuildingLotCsvImportResultDto(
    int BuildingsCreated,
    int BuildingsExisting,
    int LotsCreated,
    int LotsExisting,
    int AddressesSet,
    int ErrorCount,
    List<BuildingLotCsvRowError> Errors);

// ── Project CSV Import ────────────────────────────────────────────────────────

public record ProjectCsvRowError(int RowNumber, string ProjectName, string Reason);

public record ProjectCsvImportResultDto(
    int ImportedCount,
    int SkippedCount,
    int ErrorCount,
    List<ProjectCsvRowError> Errors);
