using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

/// <summary>
/// Contract for supplier CRUD operations.
/// </summary>
public interface ISupplierService
{
    Task<List<SupplierDto>>                           GetAllAsync();
    Task<SupplierDto?>                                GetByIdAsync(int id);
    Task<(SupplierDto? Supplier, string? Error)>      CreateAsync(CreateSupplierRequest request);
    Task<(SupplierDto? Supplier, string? Error)>      UpdateAsync(int id, UpdateSupplierRequest request);
    Task<bool>                                        DeleteAsync(int id);
}

public class SupplierService : ISupplierService
{
    private readonly AppDbContext _db;

    public SupplierService(AppDbContext db) => _db = db;

    public async Task<List<SupplierDto>> GetAllAsync()
        => await _db.Suppliers
            .Include(s => s.Criteria)
            .OrderBy(s => s.Name)
            .Select(s => ToDto(s))
            .ToListAsync();

    public async Task<SupplierDto?> GetByIdAsync(int id)
    {
        var supplier = await _db.Suppliers
            .Include(s => s.Criteria)
            .FirstOrDefaultAsync(s => s.Id == id);
        return supplier is null ? null : ToDto(supplier);
    }

    public async Task<(SupplierDto? Supplier, string? Error)> CreateAsync(CreateSupplierRequest req)
    {
        // Prevent duplicate supplier names
        var exists = await _db.Suppliers
            .AnyAsync(s => s.Name.ToLower() == req.Name.Trim().ToLower());

        if (exists)
            return (null, $"A supplier named '{req.Name}' already exists.");

        var supplier = new Supplier
        {
            Name      = req.Name.Trim(),
            Domain    = req.Domain.Trim(),
            Website   = req.Website.Trim(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.Suppliers.Add(supplier);
        await _db.SaveChangesAsync();
        return (ToDto(supplier), null);
    }

    public async Task<(SupplierDto? Supplier, string? Error)> UpdateAsync(int id, UpdateSupplierRequest req)
    {
        var supplier = await _db.Suppliers
            .Include(s => s.Criteria)
            .FirstOrDefaultAsync(s => s.Id == id);
        if (supplier is null) return (null, null); // caller returns 404

        // Check for name conflict on a *different* supplier
        var conflict = await _db.Suppliers
            .AnyAsync(s => s.Name.ToLower() == req.Name.Trim().ToLower() && s.Id != id);

        if (conflict)
            return (null, $"A supplier named '{req.Name}' already exists.");

        supplier.Name      = req.Name.Trim();
        supplier.Domain    = req.Domain.Trim();
        supplier.Website   = req.Website.Trim();
        supplier.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return (ToDto(supplier), null);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var supplier = await _db.Suppliers.FindAsync(id);
        if (supplier is null) return false;

        // EF Core CASCADE delete will remove all GlossaryUnits and the Criteria for this supplier.
        _db.Suppliers.Remove(supplier);
        await _db.SaveChangesAsync();
        return true;
    }

    private static SupplierDto ToDto(Supplier s) =>
        new(s.Id, s.Name, s.Domain, s.Website, s.CreatedAt, s.UpdatedAt,
            s.Criteria is null ? null : new ComparisonCriteriaDto(
                s.Criteria.Id, s.Criteria.SupplierId,
                s.Criteria.MatchColumn, s.Criteria.Format,
                s.Criteria.ColPrice,
                s.Criteria.MatchColX, s.Criteria.PriceColX,
                s.Criteria.ColDescription, s.Criteria.ColMFR, s.Criteria.ColQuantity,
                s.Criteria.ColTotal, s.Criteria.ColInvoiceNumber,
                s.Criteria.CreatedAt, s.Criteria.UpdatedAt));
}
