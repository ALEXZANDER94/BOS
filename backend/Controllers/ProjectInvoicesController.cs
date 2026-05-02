using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/project/{projectId:int}/invoices")]
[Authorize]
public class ProjectInvoicesController : ControllerBase
{
    private readonly AppDbContext        _db;
    private readonly IQuickBooksService  _qb;
    private readonly IAppSettingsService _settings;
    private readonly ILogger<ProjectInvoicesController> _logger;

    public ProjectInvoicesController(
        AppDbContext db,
        IQuickBooksService qb,
        IAppSettingsService settings,
        ILogger<ProjectInvoicesController> logger)
    {
        _db       = db;
        _qb       = qb;
        _settings = settings;
        _logger   = logger;
    }

    // GET /api/project/1/invoices
    [HttpGet]
    public async Task<IActionResult> GetAll(int projectId)
    {
        var project = await _db.Projects
            .Include(p => p.Client)
            .FirstOrDefaultAsync(p => p.Id == projectId);
        if (project is null)        return NotFound(new { message = "Project not found." });
        if (project.Client is null) return NotFound(new { message = "Project's client not found." });

        var customerId = await ResolveDocumentScopeAsync(project, project.Client);
        if (customerId is null)
        {
            return Conflict(new
            {
                reason  = "no-customer-match",
                message = $"No QuickBooks customer matches client '{project.Client.Name}'. " +
                          "Use 'Re-link QuickBooks Customer' on the client edit modal.",
            });
        }

        var docs = await _qb.GetInvoicesForCustomerAsync(customerId);

        var explicitIds = await _db.ProjectQbInvoiceLinks
            .Where(l => l.ProjectId == projectId)
            .Select(l => l.QbInvoiceId)
            .ToListAsync();
        var explicitSet = new HashSet<string>(explicitIds, StringComparer.OrdinalIgnoreCase);

        var customFieldName = await _settings.GetAsync(AppSettingsService.QbProjectCustomFieldKey);
        var projectIdStr    = projectId.ToString();

        var linked    = new List<QbDocumentDto>();
        var available = new List<QbDocumentDto>();
        foreach (var doc in docs)
        {
            var source = QbDocumentLinkResolver.Resolve(doc, projectIdStr, customFieldName, explicitSet);
            var dto    = doc with { LinkSource = source };
            if (source.Length == 0) available.Add(dto);
            else                    linked.Add(dto);
        }

        return Ok(new ProjectQbDocumentsResponse(linked, available));
    }

    // POST /api/project/1/invoices/link
    [HttpPost("link")]
    public async Task<IActionResult> Link(int projectId, [FromBody] LinkQbDocumentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.QbId))
            return BadRequest(new { message = "QbId is required." });

        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound(new { message = "Project not found." });

        var doc = await _qb.GetInvoiceByIdAsync(req.QbId);
        if (doc is null)
            return NotFound(new { message = $"Invoice {req.QbId} not found in QuickBooks." });

        var customFieldName = await _settings.GetAsync(AppSettingsService.QbProjectCustomFieldKey);
        if (!string.IsNullOrEmpty(customFieldName))
        {
            var match = doc.CustomFields.FirstOrDefault(cf =>
                string.Equals(cf.Name, customFieldName, StringComparison.OrdinalIgnoreCase));
            if (match?.Value == projectId.ToString())
            {
                return Conflict(new
                {
                    reason  = "already-custom-field-linked",
                    message = "This invoice is already auto-linked to the project via the QuickBooks custom field.",
                });
            }
        }

        var existing = await _db.ProjectQbInvoiceLinks
            .FirstOrDefaultAsync(l => l.QbInvoiceId == req.QbId);
        if (existing is not null)
        {
            if (existing.ProjectId == projectId)
                return Conflict(new { reason = "already-linked", message = "Already linked to this project." });

            return Conflict(new
            {
                reason  = "linked-elsewhere",
                message = $"This invoice is already linked to project id={existing.ProjectId}.",
            });
        }

        _db.ProjectQbInvoiceLinks.Add(new ProjectQbInvoiceLink
        {
            ProjectId   = projectId,
            QbInvoiceId = req.QbId,
            LinkedAt    = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        return Ok(doc with { LinkSource = "explicit" });
    }

    // DELETE /api/project/1/invoices/link/{qbInvoiceId}
    [HttpDelete("link/{qbInvoiceId}")]
    public async Task<IActionResult> Unlink(int projectId, string qbInvoiceId)
    {
        var link = await _db.ProjectQbInvoiceLinks
            .FirstOrDefaultAsync(l => l.ProjectId == projectId && l.QbInvoiceId == qbInvoiceId);
        if (link is null) return NotFound();

        _db.ProjectQbInvoiceLinks.Remove(link);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /// See ProjectEstimatesController.ResolveDocumentScopeAsync — same logic,
    /// duplicated here to keep both controllers self-contained.
    private async Task<string?> ResolveDocumentScopeAsync(Project project, Client client)
    {
        if (!string.IsNullOrEmpty(project.QbProjectId)) return project.QbProjectId;

        var clientQbId = await ResolveCustomerIdAsync(client);
        if (clientQbId is null) return null;

        var matchedSubId = await _qb.FindSubCustomerIdByNameAsync(clientQbId, project.Name);
        if (matchedSubId is not null)
        {
            project.QbProjectId   = matchedSubId;
            project.QbProjectName = project.Name;
            project.UpdatedAt     = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Auto-matched BOS Project '{ProjectName}' (id={ProjectId}) to QB sub-customer id={QbId}",
                project.Name, project.Id, matchedSubId);
            return matchedSubId;
        }

        return clientQbId;
    }

    private async Task<string?> ResolveCustomerIdAsync(Client client)
    {
        if (!string.IsNullOrEmpty(client.QbCustomerId)) return client.QbCustomerId;

        var matchedId = await _qb.FindCustomerIdByNameAsync(client.Name);
        if (matchedId is null) return null;

        client.QbCustomerId   = matchedId;
        client.QbCustomerName = client.Name;
        client.UpdatedAt      = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Auto-matched BOS Client '{ClientName}' (id={ClientId}) to QB Customer id={CustomerId}",
            client.Name, client.Id, matchedId);
        return matchedId;
    }
}
