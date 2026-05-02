namespace BOS.Backend.DTOs;

// QuickBooks customer minimal info — used for auto-match-by-name and the
// manual customer-picker dialog on the Client edit modal.
public record QbCustomerDto(string Id, string DisplayName);

// QuickBooks sub-customer (Project / Job) under a parent customer. Returned by
// the per-project picker. ParentCustomerId is included so the caller can verify
// the sub-customer truly belongs to the expected parent.
public record QbSubCustomerDto(
    string Id,
    string DisplayName,
    string ParentCustomerId,
    string ParentDisplayName);

// One sales line item on an Estimate or Invoice.
public record QbLineDto(
    int?    LineNum,
    string  Description,
    decimal Qty,
    decimal Rate,
    decimal Amount,
    string? ItemId,
    string? ItemName);

// One Custom Field on an Estimate/Invoice. We expose Name+Value so the
// controller can match against the configured QbProjectCustomFieldKey to
// detect Approach A linkages.
public record QbCustomFieldDto(string Name, string? Value);

// Unified DTO for a QB Estimate or Invoice. DocType discriminates.
//
// Estimate-only fields:
//   Status: "Pending" | "Accepted" | "Closed" | "Rejected" (from QB TxnStatus)
//   LinkedInvoiceId: set when this estimate has been converted to an invoice
//   Balance: always 0
//
// Invoice-only fields:
//   Status: derived — "Paid" (Balance=0) | "Overdue" (DueDate<today) | "Unpaid"
//   LinkedFromEstimateId: set when this invoice was created from an estimate
//   Balance: outstanding amount due
//
// LinkSource is set by the controller to "custom-field" or "explicit" depending
// on whether the document was matched via Approach A or B; empty string when
// returned directly by the service.
public record QbDocumentDto(
    string  Id,
    string  DocType,           // "Estimate" | "Invoice"
    string? DocNumber,
    string  TxnDate,
    string? DueDate,
    decimal TotalAmt,
    decimal Balance,
    string  Status,
    string  CustomerId,
    string  CustomerName,
    string? CustomerParentName,  // populated when CustomerRef points at a sub-customer (QB Project)
    string? PrivateNote,
    string? CustomerMemo,
    List<QbLineDto>        Lines,
    List<QbCustomFieldDto> CustomFields,
    string? LinkedInvoiceId,
    string? LinkedFromEstimateId,
    string  LinkSource = "",
    // Set by the client-level qb-documents endpoint to indicate which BOS Project
    // (if any) this document is associated with, across all priority paths
    // (sub-customer link, custom-field, explicit link). Always null on the
    // per-project endpoints since those are pre-scoped.
    int?    BosProjectId   = null,
    string? BosProjectName = null);

// Edits applied during the Convert flow — null fields fall back to the source
// estimate's values. When Lines is non-null it fully replaces the estimate's
// line array (caller is responsible for preserving ItemId on each line).
public record ConvertEstimateEdits(
    string?          TxnDate,        // ISO yyyy-MM-dd
    string?          DueDate,        // ISO yyyy-MM-dd
    string?          CustomerMemo,
    List<QbLineDto>? Lines);

// ── Controller request / response DTOs ───────────────────────────────────────

public record LinkQbDocumentRequest(string QbId);

public record ProjectQbDocumentsResponse(
    List<QbDocumentDto> Linked,
    List<QbDocumentDto> Available);

// Returned by GET /api/client/{id}/qb-documents — full estimates/invoices
// across the client's parent QB Customer + all its sub-customers (QB Projects),
// each annotated with the BOS Project (if any) the document is associated with.
public record ClientQbDocumentsResponse(
    List<QbDocumentDto> Estimates,
    List<QbDocumentDto> Invoices);
