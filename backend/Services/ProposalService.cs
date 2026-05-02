using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IProposalService
{
    Task<List<ProposalWithClientDto>>  GetAllProposalsAsync(string? search, string? status, string? type, int? clientId, bool includeConverted);
    Task<List<ProposalListItemDto>> GetForClientAsync(int clientId, bool includeConverted);
    Task<ProposalDto?>              GetByIdAsync(int clientId, int proposalId);
    Task<ProposalDto>               CreateAsync(int clientId, CreateProposalRequest req, string createdByEmail);
    Task<ProposalDto?>              UpdateAsync(int clientId, int proposalId, UpdateProposalRequest req);
    Task<bool>                      DeleteAsync(int clientId, int proposalId);
    Task<(int? ProjectId, string? Error)> ConvertToProjectAsync(int clientId, int proposalId);

    // PDF attachment
    Task<(string StoredPath, string? Error)> UploadPdfAsync(int clientId, int proposalId, string fileName, Stream stream, long length);
    Task<(Stream? Stream, string? FileName, string? Error)> GetPdfAsync(int clientId, int proposalId);
    Task<(bool Ok, string? Error)> DeletePdfAsync(int clientId, int proposalId);

    // Pricing history
    Task<List<ProposalPricingDto>>          GetPricingsAsync(int clientId, int proposalId);
    Task<(ProposalPricingDto? Dto, string? Error)> CreatePricingAsync(int clientId, int proposalId, CreateProposalPricingRequest req);
    Task<(ProposalPricingDto? Dto, string? Error)> UpdatePricingAsync(int clientId, int proposalId, int pricingId, UpdateProposalPricingRequest req);
    Task<bool>                             DeletePricingAsync(int clientId, int proposalId, int pricingId);
}

public class ProposalService : IProposalService
{
    private readonly AppDbContext _db;
    private readonly string _uploadDir;

    public ProposalService(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _uploadDir = Path.Combine(env.ContentRootPath, "uploads", "proposals");
        Directory.CreateDirectory(_uploadDir);
    }

    // ── All-proposals (cross-client) ────────────────────────────────────────

    public async Task<List<ProposalWithClientDto>> GetAllProposalsAsync(
        string? search, string? status, string? type, int? clientId, bool includeConverted)
    {
        var query = _db.Proposals.Include(p => p.Client).AsQueryable();

        if (!includeConverted)
            query = query.Where(p => p.Status != "Converted");

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p =>
                p.Name.Contains(search) ||
                p.Client!.Name.Contains(search));

        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);

        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(p => p.Type == type);

        if (clientId.HasValue)
            query = query.Where(p => p.ClientId == clientId.Value);

        var proposals = await query
            .OrderByDescending(p => p.UpdatedAt)
            .ThenBy(p => p.Name)
            .ToListAsync();

        return proposals.Select(p => new ProposalWithClientDto(
            p.Id, p.ClientId, p.Client!.Name,
            p.Name, p.Type, p.Status,
            p.ConvertedProjectId, p.Deadline, p.CreatedAt, p.UpdatedAt
        )).ToList();
    }

    // ── Per-client list ─────────────────────────────────────────────────────

    public async Task<List<ProposalListItemDto>> GetForClientAsync(int clientId, bool includeConverted)
    {
        var query = _db.Proposals.Where(p => p.ClientId == clientId);
        if (!includeConverted)
            query = query.Where(p => p.Status != "Converted");

        return await query
            .OrderByDescending(p => p.UpdatedAt)
            .Select(p => new ProposalListItemDto(
                p.Id, p.ClientId, p.Name, p.Type, p.Status,
                p.ConvertedProjectId, p.Deadline, p.CreatedAt, p.UpdatedAt))
            .ToListAsync();
    }

    // ── Detail ──────────────────────────────────────────────────────────────

    public async Task<ProposalDto?> GetByIdAsync(int clientId, int proposalId)
    {
        var p = await _db.Proposals
            .Include(x => x.Library)
            .Include(x => x.Buildings).ThenInclude(b => b.Plans)
            .Include(x => x.CustomUpgrades).ThenInclude(cu => cu.CustomUpgrade)
            .Include(x => x.Pricings)
            .FirstOrDefaultAsync(x => x.Id == proposalId && x.ClientId == clientId);

        return p is null ? null : ToDto(p);
    }

    // ── Create ──────────────────────────────────────────────────────────────

    public async Task<ProposalDto> CreateAsync(int clientId, CreateProposalRequest req, string createdByEmail)
    {
        var clientExists = await _db.Clients.AnyAsync(c => c.Id == clientId);
        if (!clientExists) throw new KeyNotFoundException("Client not found.");

        if (req.Type != "SingleFamily" && req.Type != "MultiFamily")
            throw new InvalidOperationException("Type must be SingleFamily or MultiFamily.");

        var now = DateTime.UtcNow;
        var p = new Proposal
        {
            ClientId             = clientId,
            Name                 = (req.Name ?? "").Trim(),
            Type                 = req.Type,
            Status               = string.IsNullOrWhiteSpace(req.Status) ? "Draft" : req.Status,
            Deadline             = req.Deadline,
            DeadlineReminderDays = req.DeadlineReminderDays ?? 2,
            Notes                = req.Notes ?? "",
            VisibleFields        = req.VisibleFields ?? "",
            CreatedByEmail       = createdByEmail,
            CreatedAt            = now,
            UpdatedAt            = now,
            LibraryId            = req.LibraryId,
            Address              = req.Address ?? "",
            City                 = req.City ?? "",
            ProductStandards     = req.ProductStandards ?? "",
            Version              = req.Version ?? "",
            BuyerUpgrades        = req.BuyerUpgrades ?? "",
            RevisionsAfterLaunch = req.RevisionsAfterLaunch ?? "",
        };

        if (req.Type == "MultiFamily" && req.Buildings is not null)
        {
            foreach (var bIn in req.Buildings)
            {
                var pb = new ProposalBuilding { Name = (bIn.Name ?? "").Trim() };
                foreach (var planIn in bIn.Plans ?? new())
                {
                    pb.Plans.Add(new ProposalPlan
                    {
                        PlanName      = (planIn.PlanName ?? "").Trim(),
                        SquareFootage = planIn.SquareFootage,
                        Amount        = planIn.Amount,
                    });
                }
                p.Buildings.Add(pb);
            }
        }

        _db.Proposals.Add(p);
        await _db.SaveChangesAsync();

        await SyncCustomUpgradesAsync(p, req.CustomUpgrades, applyLibraryDefaults: true);
        await _db.SaveChangesAsync();

        return (await GetByIdAsync(clientId, p.Id))!;
    }

    // ── Update ──────────────────────────────────────────────────────────────

    public async Task<ProposalDto?> UpdateAsync(int clientId, int proposalId, UpdateProposalRequest req)
    {
        var p = await _db.Proposals
            .Include(x => x.Buildings).ThenInclude(b => b.Plans)
            .Include(x => x.CustomUpgrades)
            .FirstOrDefaultAsync(x => x.Id == proposalId && x.ClientId == clientId);

        if (p is null) return null;
        if (p.Status == "Converted")
            throw new InvalidOperationException("Cannot edit a converted proposal.");

        p.Name                 = (req.Name ?? "").Trim();
        p.Status               = req.Status;
        p.Deadline             = req.Deadline;
        p.DeadlineReminderDays = req.DeadlineReminderDays ?? 2;
        p.Notes                = req.Notes ?? "";
        p.VisibleFields        = req.VisibleFields ?? "";
        p.LibraryId            = req.LibraryId;
        p.Address              = req.Address ?? "";
        p.City                 = req.City ?? "";
        p.ProductStandards     = req.ProductStandards ?? "";
        p.Version              = req.Version ?? "";
        p.BuyerUpgrades        = req.BuyerUpgrades ?? "";
        p.RevisionsAfterLaunch = req.RevisionsAfterLaunch ?? "";
        p.UpdatedAt            = DateTime.UtcNow;

        // Reset deadline notification if the deadline changed
        if (p.DeadlineNotifiedAt is not null)
            p.DeadlineNotifiedAt = null;

        // Replace multi-family buildings/plans
        if (p.Type == "MultiFamily")
        {
            foreach (var b in p.Buildings.ToList())
            {
                _db.ProposalPlans.RemoveRange(b.Plans);
                _db.ProposalBuildings.Remove(b);
            }
            await _db.SaveChangesAsync();

            if (req.Buildings is not null)
            {
                foreach (var bIn in req.Buildings)
                {
                    var pb = new ProposalBuilding
                    {
                        ProposalId = p.Id,
                        Name       = (bIn.Name ?? "").Trim(),
                    };
                    foreach (var planIn in bIn.Plans ?? new())
                    {
                        pb.Plans.Add(new ProposalPlan
                        {
                            PlanName      = (planIn.PlanName ?? "").Trim(),
                            SquareFootage = planIn.SquareFootage,
                            Amount        = planIn.Amount,
                        });
                    }
                    _db.ProposalBuildings.Add(pb);
                }
                await _db.SaveChangesAsync();
            }
        }

        await SyncCustomUpgradesAsync(p, req.CustomUpgrades, applyLibraryDefaults: false);
        await _db.SaveChangesAsync();

        return await GetByIdAsync(clientId, p.Id);
    }

    // ── Delete ──────────────────────────────────────────────────────────────

    public async Task<bool> DeleteAsync(int clientId, int proposalId)
    {
        var p = await _db.Proposals.FirstOrDefaultAsync(x => x.Id == proposalId && x.ClientId == clientId);
        if (p is null) return false;

        // Clean up PDF file if attached
        if (!string.IsNullOrEmpty(p.PdfStoredFileName))
        {
            var path = Path.Combine(_uploadDir, p.PdfStoredFileName);
            if (File.Exists(path)) File.Delete(path);
        }

        _db.Proposals.Remove(p);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Convert ─────────────────────────────────────────────────────────────

    public async Task<(int? ProjectId, string? Error)> ConvertToProjectAsync(int clientId, int proposalId)
    {
        var p = await _db.Proposals
            .Include(x => x.Library)
            .Include(x => x.Buildings).ThenInclude(b => b.Plans)
            .Include(x => x.CustomUpgrades)
            .FirstOrDefaultAsync(x => x.Id == proposalId && x.ClientId == clientId);

        if (p is null) return (null, "Proposal not found.");
        if (p.ConvertedProjectId is not null)
            return (null, "Proposal has already been converted.");
        if (p.Status != "Accepted")
            return (null, "Proposal must be in Accepted status to convert.");
        if (p.Type == "SingleFamily" && p.LibraryId is null)
            return (null, "Single-family proposals require a Library before conversion.");

        var now = DateTime.UtcNow;

        var project = new Project
        {
            ClientId             = clientId,
            Name                 = string.IsNullOrWhiteSpace(p.Name) ? "Converted Proposal" : p.Name,
            Description          = "",
            Status               = "Active",
            CreatedAt            = now,
            UpdatedAt            = now,
            SourceProposalId     = p.Id,
            SourceLibraryId      = p.LibraryId,
            Address              = p.Address,
            City                 = p.City,
            ProductStandards     = p.ProductStandards,
            Version              = p.Version,
            BuyerUpgrades        = p.BuyerUpgrades,
            RevisionsAfterLaunch = p.RevisionsAfterLaunch,
        };
        _db.Projects.Add(project);
        await _db.SaveChangesAsync();

        if (p.Type == "MultiFamily")
        {
            foreach (var pb in p.Buildings)
            {
                var building = new Building
                {
                    ProjectId   = project.Id,
                    Name        = pb.Name,
                    Description = "",
                };
                foreach (var pp in pb.Plans)
                {
                    building.Plans.Add(new Plan
                    {
                        PlanName      = pp.PlanName,
                        SquareFootage = pp.SquareFootage,
                        Amount        = pp.Amount,
                    });
                }
                _db.Buildings.Add(building);
            }
            await _db.SaveChangesAsync();
        }

        foreach (var pu in p.CustomUpgrades)
        {
            _db.ProjectCustomUpgrades.Add(new ProjectCustomUpgrade
            {
                ProjectId       = project.Id,
                CustomUpgradeId = pu.CustomUpgradeId,
                IsEnabled       = pu.IsEnabled,
            });
        }

        p.Status             = "Converted";
        p.ConvertedProjectId = project.Id;
        p.UpdatedAt          = now;

        await _db.SaveChangesAsync();
        return (project.Id, null);
    }

    // ── PDF attachment ──────────────────────────────────────────────────────

    private static readonly byte[] PdfMagic = [0x25, 0x50, 0x44, 0x46, 0x2D]; // %PDF-

    public async Task<(string StoredPath, string? Error)> UploadPdfAsync(
        int clientId, int proposalId, string fileName, Stream stream, long length)
    {
        var p = await _db.Proposals.FirstOrDefaultAsync(x => x.Id == proposalId && x.ClientId == clientId);
        if (p is null) return ("", "Proposal not found.");

        // Magic-byte validation
        var header = new byte[5];
        var read = await stream.ReadAsync(header);
        if (read < 5 || !header.AsSpan().SequenceEqual(PdfMagic))
            return ("", "File does not appear to be a valid PDF.");
        stream.Position = 0;

        // Delete old file if exists
        if (!string.IsNullOrEmpty(p.PdfStoredFileName))
        {
            var oldPath = Path.Combine(_uploadDir, p.PdfStoredFileName);
            if (File.Exists(oldPath)) File.Delete(oldPath);
        }

        var storedName = $"{Guid.NewGuid()}.pdf";
        var fullPath = Path.Combine(_uploadDir, storedName);
        await using var fs = File.Create(fullPath);
        await stream.CopyToAsync(fs);

        p.PdfFileName       = SanitizeFileName(fileName);
        p.PdfStoredFileName = storedName;
        p.PdfContentLength  = length;
        p.UpdatedAt         = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return (fullPath, null);
    }

    public async Task<(Stream? Stream, string? FileName, string? Error)> GetPdfAsync(int clientId, int proposalId)
    {
        var p = await _db.Proposals.FirstOrDefaultAsync(x => x.Id == proposalId && x.ClientId == clientId);
        if (p is null) return (null, null, "Proposal not found.");
        if (string.IsNullOrEmpty(p.PdfStoredFileName)) return (null, null, "No PDF attached.");

        var path = Path.Combine(_uploadDir, p.PdfStoredFileName);
        if (!File.Exists(path)) return (null, null, "PDF file missing from disk.");

        return (File.OpenRead(path), p.PdfFileName, null);
    }

    public async Task<(bool Ok, string? Error)> DeletePdfAsync(int clientId, int proposalId)
    {
        var p = await _db.Proposals.FirstOrDefaultAsync(x => x.Id == proposalId && x.ClientId == clientId);
        if (p is null) return (false, "Proposal not found.");
        if (string.IsNullOrEmpty(p.PdfStoredFileName)) return (false, "No PDF attached.");

        var path = Path.Combine(_uploadDir, p.PdfStoredFileName);
        if (File.Exists(path)) File.Delete(path);

        p.PdfFileName       = null;
        p.PdfStoredFileName = null;
        p.PdfContentLength  = 0;
        p.UpdatedAt         = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        return (true, null);
    }

    // ── Pricing history ─────────────────────────────────────────────────────

    public async Task<List<ProposalPricingDto>> GetPricingsAsync(int clientId, int proposalId)
    {
        return await _db.ProposalPricings
            .Where(pp => pp.ProposalId == proposalId && pp.Proposal!.ClientId == clientId)
            .OrderByDescending(pp => pp.CreatedAt)
            .Select(pp => new ProposalPricingDto(
                pp.Id, pp.Label, pp.PricePerSqFt, pp.TotalAmount, pp.Notes, pp.CreatedAt))
            .ToListAsync();
    }

    public async Task<(ProposalPricingDto? Dto, string? Error)> CreatePricingAsync(
        int clientId, int proposalId, CreateProposalPricingRequest req)
    {
        var exists = await _db.Proposals.AnyAsync(p => p.Id == proposalId && p.ClientId == clientId);
        if (!exists) return (null, "Proposal not found.");

        var pricing = new ProposalPricing
        {
            ProposalId   = proposalId,
            Label        = (req.Label ?? "").Trim(),
            PricePerSqFt = req.PricePerSqFt,
            TotalAmount  = req.TotalAmount,
            Notes        = req.Notes ?? "",
            CreatedAt    = DateTime.UtcNow,
        };
        _db.ProposalPricings.Add(pricing);
        await _db.SaveChangesAsync();

        return (new ProposalPricingDto(
            pricing.Id, pricing.Label, pricing.PricePerSqFt,
            pricing.TotalAmount, pricing.Notes, pricing.CreatedAt), null);
    }

    public async Task<(ProposalPricingDto? Dto, string? Error)> UpdatePricingAsync(
        int clientId, int proposalId, int pricingId, UpdateProposalPricingRequest req)
    {
        var pricing = await _db.ProposalPricings
            .Include(pp => pp.Proposal)
            .FirstOrDefaultAsync(pp => pp.Id == pricingId && pp.ProposalId == proposalId && pp.Proposal!.ClientId == clientId);
        if (pricing is null) return (null, "Pricing entry not found.");

        pricing.Label        = (req.Label ?? "").Trim();
        pricing.PricePerSqFt = req.PricePerSqFt;
        pricing.TotalAmount  = req.TotalAmount;
        pricing.Notes        = req.Notes ?? "";
        await _db.SaveChangesAsync();

        return (new ProposalPricingDto(
            pricing.Id, pricing.Label, pricing.PricePerSqFt,
            pricing.TotalAmount, pricing.Notes, pricing.CreatedAt), null);
    }

    public async Task<bool> DeletePricingAsync(int clientId, int proposalId, int pricingId)
    {
        var pricing = await _db.ProposalPricings
            .Include(pp => pp.Proposal)
            .FirstOrDefaultAsync(pp => pp.Id == pricingId && pp.ProposalId == proposalId && pp.Proposal!.ClientId == clientId);
        if (pricing is null) return false;

        _db.ProposalPricings.Remove(pricing);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task SyncCustomUpgradesAsync(
        Proposal p,
        List<ProposalUpgradeInput>? inputs,
        bool applyLibraryDefaults)
    {
        var inputMap = (inputs ?? new()).ToDictionary(i => i.CustomUpgradeId, i => i.IsEnabled);

        if (applyLibraryDefaults && p.LibraryId is not null)
        {
            var bakedIds = await _db.LibraryUpgrades
                .Where(lu => lu.LibraryId == p.LibraryId)
                .Select(lu => lu.CustomUpgradeId)
                .ToListAsync();
            foreach (var id in bakedIds)
                if (!inputMap.ContainsKey(id))
                    inputMap[id] = true;
        }

        var requestedIds = inputMap.Keys.ToList();
        var visibleIds = await _db.CustomUpgrades
            .Where(u => requestedIds.Contains(u.Id) && (u.ClientId == p.ClientId || u.IsGlobal))
            .Select(u => u.Id)
            .ToListAsync();
        var visibleSet = visibleIds.ToHashSet();

        var existing = await _db.ProposalCustomUpgrades
            .Where(x => x.ProposalId == p.Id)
            .ToListAsync();
        _db.ProposalCustomUpgrades.RemoveRange(existing);

        foreach (var (upgradeId, isEnabled) in inputMap)
        {
            if (!visibleSet.Contains(upgradeId)) continue;
            _db.ProposalCustomUpgrades.Add(new ProposalCustomUpgrade
            {
                ProposalId      = p.Id,
                CustomUpgradeId = upgradeId,
                IsEnabled       = isEnabled,
            });
        }
    }

    private static ProposalDto ToDto(Proposal p) => new(
        p.Id,
        p.ClientId,
        p.Name,
        p.Type,
        p.Status,
        p.ConvertedProjectId,
        p.Deadline,
        p.DeadlineReminderDays,
        p.CreatedAt,
        p.UpdatedAt,
        p.Notes,
        p.VisibleFields,
        p.PdfFileName,
        p.PdfContentLength,
        p.LibraryId,
        p.Library?.Title,
        p.Address,
        p.City,
        p.ProductStandards,
        p.Version,
        p.BuyerUpgrades,
        p.RevisionsAfterLaunch,
        p.Buildings
            .OrderBy(b => b.Id)
            .Select(b => new ProposalBuildingDto(
                b.Id,
                b.Name,
                b.Plans.OrderBy(pl => pl.Id).Select(pl => new ProposalPlanDto(
                    pl.Id, pl.PlanName, pl.SquareFootage, pl.Amount
                )).ToList()
            )).ToList(),
        p.CustomUpgrades.Select(cu => new ProposalUpgradeStateDto(
            cu.CustomUpgradeId,
            cu.CustomUpgrade?.Name ?? "",
            cu.CustomUpgrade?.Description ?? "",
            cu.CustomUpgrade?.IsGlobal ?? false,
            cu.IsEnabled
        )).ToList(),
        p.Pricings
            .OrderByDescending(pp => pp.CreatedAt)
            .Select(pp => new ProposalPricingDto(
                pp.Id, pp.Label, pp.PricePerSqFt, pp.TotalAmount, pp.Notes, pp.CreatedAt
            )).ToList()
    );

    private static string SanitizeFileName(string raw)
    {
        var name = Path.GetFileName(raw);
        foreach (var c in Path.GetInvalidFileNameChars())
            name = name.Replace(c, '_');
        return name.Length > 200 ? name[..200] : name;
    }
}
