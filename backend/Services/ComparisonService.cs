using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;

namespace BOS.Backend.Services;

public interface IComparisonService
{
    Task<List<ComparisonResultDto>> CompareAsync(int supplierId, List<ParsedPdfUnit> parsedUnits);
}

public class ComparisonService : IComparisonService
{
    private readonly AppDbContext _db;

    public ComparisonService(AppDbContext db) => _db = db;

    public async Task<List<ComparisonResultDto>> CompareAsync(int supplierId, List<ParsedPdfUnit> parsedUnits)
    {
        // Load only this supplier's master glossary into a Dictionary for O(1) lookup.
        // Keyed by uppercased CatalogNumber to make matching case-insensitive.
        var master = await _db.GlossaryUnits
            .Where(u => u.SupplierId == supplierId)
            .ToDictionaryAsync(u => u.CatalogNumber.ToUpper().Trim());

        var results = new List<ComparisonResultDto>();

        foreach (var parsed in parsedUnits)
        {
            // Compute effective per-unit price from the invoice line total when available.
            // This handles suppliers (e.g. PLATT) that use "C-pricing" — the Unit Price
            // column represents price per 100 units, not per unit.  Total ÷ Qty always
            // gives the true per-unit cost regardless of the supplier's pricing convention.
            // Falls back to the raw unit price column when no total is present.
            decimal roundedProposedPrice = (parsed.ProposedTotal > 0 && parsed.ProposedQuantity > 0)
                ? Math.Round(parsed.ProposedTotal / parsed.ProposedQuantity, 2, MidpointRounding.AwayFromZero)
                : Math.Round(parsed.ProposedPrice, 2, MidpointRounding.AwayFromZero);

            // Units flagged NeedsReview couldn't be auto-parsed from the criteria cell.
            // They still get emitted so the frontend can present them for manual review.
            if (parsed.NeedsReview)
            {
                results.Add(new ComparisonResultDto(
                    CatalogNumber:      parsed.CatalogNumber,
                    Description:        parsed.Description,
                    MFR:                parsed.MFR,
                    MasterPrice:        0m,
                    ProposedPrice:      roundedProposedPrice,
                    DollarDifference:   parsed.ProposedTotal > 0 ? parsed.ProposedTotal : roundedProposedPrice,
                    PercentDifference:  100m,
                    IsOverpriced:       true,
                    IsNewItem:          false,
                    IsNeedsReview:      true,
                    RawCriteriaCell:    parsed.RawCriteriaCell,
                    ProposedQuantity:   parsed.ProposedQuantity,
                    ProposedTotal:      parsed.ProposedTotal,
                    InvoiceNumber:      parsed.InvoiceNumber
                ));
                continue;
            }

            var key = parsed.CatalogNumber.ToUpper().Trim();

            if (master.TryGetValue(key, out var masterUnit))
            {
                // Unit found in master — compare invoice line total against expected total.
                // expectedTotal = masterPricePerUnit × Quantity (total-based comparison, Task C).
                decimal expectedTotal = masterUnit.ContractedPrice * parsed.ProposedQuantity;
                decimal dollarDiff    = parsed.ProposedTotal - expectedTotal;
                decimal pctDiff       = expectedTotal > 0
                    ? Math.Round((dollarDiff / expectedTotal) * 100m, 2)
                    : 0m;
                bool isOverpriced = dollarDiff > 0;

                results.Add(new ComparisonResultDto(
                    CatalogNumber:      parsed.CatalogNumber,
                    Description:        masterUnit.Description, // Master is authoritative
                    MFR:                masterUnit.MFR,         // Master is authoritative
                    MasterPrice:        masterUnit.ContractedPrice,
                    ProposedPrice:      roundedProposedPrice,
                    DollarDifference:   Math.Round(dollarDiff, 2),
                    PercentDifference:  pctDiff,
                    IsOverpriced:       isOverpriced,
                    IsNewItem:          false,
                    IsNeedsReview:      false,
                    RawCriteriaCell:    string.Empty,
                    ProposedQuantity:   parsed.ProposedQuantity,
                    ProposedTotal:      parsed.ProposedTotal,
                    InvoiceNumber:      parsed.InvoiceNumber
                ));
            }
            else
            {
                // Unit not in master — flag as a new/unknown item.
                // Dollar difference = invoice total (no contracted baseline to compute against).
                results.Add(new ComparisonResultDto(
                    CatalogNumber:      parsed.CatalogNumber,
                    Description:        parsed.Description,
                    MFR:                parsed.MFR,
                    MasterPrice:        0m,
                    ProposedPrice:      roundedProposedPrice,
                    DollarDifference:   parsed.ProposedTotal > 0 ? parsed.ProposedTotal : roundedProposedPrice,
                    PercentDifference:  100m,
                    IsOverpriced:       true,
                    IsNewItem:          true,
                    IsNeedsReview:      false,
                    RawCriteriaCell:    string.Empty,
                    ProposedQuantity:   parsed.ProposedQuantity,
                    ProposedTotal:      parsed.ProposedTotal,
                    InvoiceNumber:      parsed.InvoiceNumber
                ));
            }
        }

        // Sort order: NeedsReview rows first, then new items, then most overpriced
        return results
            .OrderByDescending(r => r.IsNeedsReview)
            .ThenByDescending(r => r.IsNewItem)
            .ThenByDescending(r => r.IsOverpriced)
            .ThenByDescending(r => r.DollarDifference)
            .ToList();
    }
}
