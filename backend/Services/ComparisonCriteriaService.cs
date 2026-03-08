using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IComparisonCriteriaService
{
    Task<ComparisonCriteriaDto?> GetBySupplierIdAsync(int supplierId);
    Task<ComparisonCriteriaDto> UpsertAsync(int supplierId, UpsertComparisonCriteriaRequest request);
}

public class ComparisonCriteriaService : IComparisonCriteriaService
{
    private readonly AppDbContext _db;

    public ComparisonCriteriaService(AppDbContext db) => _db = db;

    public async Task<ComparisonCriteriaDto?> GetBySupplierIdAsync(int supplierId)
    {
        var criteria = await _db.ComparisonCriteria
            .FirstOrDefaultAsync(c => c.SupplierId == supplierId);

        return criteria is null ? null : ToDto(criteria);
    }

    public async Task<ComparisonCriteriaDto> UpsertAsync(int supplierId, UpsertComparisonCriteriaRequest req)
    {
        var existing = await _db.ComparisonCriteria
            .FirstOrDefaultAsync(c => c.SupplierId == supplierId);

        if (existing is null)
        {
            existing = new ComparisonCriteria
            {
                SupplierId      = supplierId,
                MatchColumn     = req.MatchColumn.Trim(),
                Format          = req.Format.Trim(),
                ColPrice        = req.ColPrice.Trim(),
                MatchColX       = req.MatchColX,
                PriceColX       = req.PriceColX,
                ColDescription  = string.IsNullOrWhiteSpace(req.ColDescription)  ? null : req.ColDescription.Trim(),
                ColQuantity     = string.IsNullOrWhiteSpace(req.ColQuantity)     ? null : req.ColQuantity.Trim(),
                ColTotal        = string.IsNullOrWhiteSpace(req.ColTotal)        ? null : req.ColTotal.Trim(),
                ColInvoiceNumber = string.IsNullOrWhiteSpace(req.ColInvoiceNumber) ? null : req.ColInvoiceNumber.Trim(),
                CreatedAt       = DateTime.UtcNow,
                UpdatedAt       = DateTime.UtcNow,
            };
            _db.ComparisonCriteria.Add(existing);
        }
        else
        {
            existing.MatchColumn     = req.MatchColumn.Trim();
            existing.Format          = req.Format.Trim();
            existing.ColPrice        = req.ColPrice.Trim();
            existing.MatchColX       = req.MatchColX;
            existing.PriceColX       = req.PriceColX;
            existing.ColDescription  = string.IsNullOrWhiteSpace(req.ColDescription)  ? null : req.ColDescription.Trim();
            existing.ColQuantity     = string.IsNullOrWhiteSpace(req.ColQuantity)     ? null : req.ColQuantity.Trim();
            existing.ColTotal        = string.IsNullOrWhiteSpace(req.ColTotal)        ? null : req.ColTotal.Trim();
            existing.ColInvoiceNumber = string.IsNullOrWhiteSpace(req.ColInvoiceNumber) ? null : req.ColInvoiceNumber.Trim();
            existing.UpdatedAt       = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return ToDto(existing);
    }

    private static ComparisonCriteriaDto ToDto(ComparisonCriteria c) =>
        new(c.Id, c.SupplierId, c.MatchColumn, c.Format,
            c.ColPrice, c.MatchColX, c.PriceColX,
            c.ColDescription, c.ColQuantity, c.ColTotal, c.ColInvoiceNumber,
            c.CreatedAt, c.UpdatedAt);
}
