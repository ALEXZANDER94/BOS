using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Models;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/project/{projectId:int}/estimates")]
[Authorize]
public class ProjectEstimatesController : ControllerBase
{
    private readonly AppDbContext        _db;
    private readonly IQuickBooksService  _qb;
    private readonly IAppSettingsService _settings;
    private readonly ILogger<ProjectEstimatesController> _logger;

    public ProjectEstimatesController(
        AppDbContext db,
        IQuickBooksService qb,
        IAppSettingsService settings,
        ILogger<ProjectEstimatesController> logger)
    {
        _db       = db;
        _qb       = qb;
        _settings = settings;
        _logger   = logger;
    }

    // GET /api/project/1/estimates
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

        var docs = await _qb.GetEstimatesForCustomerAsync(customerId);

        var explicitIds = await _db.ProjectQbEstimateLinks
            .Where(l => l.ProjectId == projectId)
            .Select(l => l.QbEstimateId)
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

    // POST /api/project/1/estimates/link
    [HttpPost("link")]
    public async Task<IActionResult> Link(int projectId, [FromBody] LinkQbDocumentRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.QbId))
            return BadRequest(new { message = "QbId is required." });

        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound(new { message = "Project not found." });

        var doc = await _qb.GetEstimateByIdAsync(req.QbId);
        if (doc is null)
            return NotFound(new { message = $"Estimate {req.QbId} not found in QuickBooks." });

        // Block when already auto-linked via the BOS Project ID custom field.
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
                    message = "This estimate is already auto-linked to the project via the QuickBooks custom field.",
                });
            }
        }

        var existing = await _db.ProjectQbEstimateLinks
            .FirstOrDefaultAsync(l => l.QbEstimateId == req.QbId);
        if (existing is not null)
        {
            if (existing.ProjectId == projectId)
                return Conflict(new { reason = "already-linked", message = "Already linked to this project." });

            return Conflict(new
            {
                reason  = "linked-elsewhere",
                message = $"This estimate is already linked to project id={existing.ProjectId}.",
            });
        }

        _db.ProjectQbEstimateLinks.Add(new ProjectQbEstimateLink
        {
            ProjectId    = projectId,
            QbEstimateId = req.QbId,
            LinkedAt     = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        return Ok(doc with { LinkSource = "explicit" });
    }

    // DELETE /api/project/1/estimates/link/{qbEstimateId}
    [HttpDelete("link/{qbEstimateId}")]
    public async Task<IActionResult> Unlink(int projectId, string qbEstimateId)
    {
        var link = await _db.ProjectQbEstimateLinks
            .FirstOrDefaultAsync(l => l.ProjectId == projectId && l.QbEstimateId == qbEstimateId);
        if (link is null) return NotFound();

        _db.ProjectQbEstimateLinks.Remove(link);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST /api/project/1/estimates/{qbEstimateId}/convert
    [HttpPost("{qbEstimateId}/convert")]
    public async Task<IActionResult> Convert(
        int projectId, string qbEstimateId, [FromBody] ConvertEstimateEdits? edits)
    {
        var projectExists = await _db.Projects.AnyAsync(p => p.Id == projectId);
        if (!projectExists) return NotFound(new { message = "Project not found." });

        var estimate = await _qb.GetEstimateByIdAsync(qbEstimateId);
        if (estimate is null)
            return NotFound(new { message = $"Estimate {qbEstimateId} not found in QuickBooks." });

        // The estimate must already be associated with this project (either explicitly
        // linked or auto-linked via the custom field). Prevents converting random QB
        // estimates by guessing their ids.
        var customFieldName = await _settings.GetAsync(AppSettingsService.QbProjectCustomFieldKey);
        var explicitlyLinked = await _db.ProjectQbEstimateLinks
            .AnyAsync(l => l.ProjectId == projectId && l.QbEstimateId == qbEstimateId);

        var customFieldLinked = false;
        if (!string.IsNullOrEmpty(customFieldName))
        {
            var match = estimate.CustomFields.FirstOrDefault(cf =>
                string.Equals(cf.Name, customFieldName, StringComparison.OrdinalIgnoreCase));
            customFieldLinked = match?.Value == projectId.ToString();
        }

        if (!explicitlyLinked && !customFieldLinked)
        {
            return BadRequest(new
            {
                message = "This estimate is not linked to this project — link it first before converting.",
            });
        }

        QbDocumentDto newInvoice;
        try
        {
            newInvoice = await _qb.ConvertEstimateToInvoiceAsync(qbEstimateId, edits);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex,
                "QuickBooks rejected the convert call. ProjectId={ProjectId} EstimateId={EstimateId}",
                projectId, qbEstimateId);
            return StatusCode(502, new { message = "QuickBooks rejected the invoice creation: " + ex.Message });
        }

        // Record an explicit invoice link for traceability, even when the new invoice
        // is also auto-detectable via the custom field — gives us a stable BOS-side
        // record of which estimate produced this invoice.
        _db.ProjectQbInvoiceLinks.Add(new ProjectQbInvoiceLink
        {
            ProjectId      = projectId,
            QbInvoiceId    = newInvoice.Id,
            FromEstimateId = qbEstimateId,
            LinkedAt       = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var explicitSet = new HashSet<string>(new[] { newInvoice.Id }, StringComparer.OrdinalIgnoreCase);
        var source = QbDocumentLinkResolver.Resolve(newInvoice, projectId.ToString(), customFieldName, explicitSet);
        return Ok(newInvoice with { LinkSource = source });
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    /// Returns the QB customer id to scope this project's document fetch to.
    /// Order:
    ///   1) Project.QbProjectId (an explicit QB sub-customer link) wins.
    ///   2) If unset, try auto-matching the BOS project name against a QB
    ///      sub-customer under the client's parent customer; cache on hit.
    ///   3) Fall back to Client.QbCustomerId (auto-match against QB Customer
    ///      list by name on first call; cached afterwards).
    /// Returns null when no parent-customer match could be made — caller
    /// responds 409 in that case.
    private async Task<string?> ResolveDocumentScopeAsync(Project project, Client client)
    {
        if (!string.IsNullOrEmpty(project.QbProjectId)) return project.QbProjectId;

        // Need the client's QB customer id to attempt sub-customer auto-match.
        var clientQbId = await ResolveCustomerIdAsync(client);
        if (clientQbId is null) return null;

        // Auto-match BOS project name to QB sub-customer name under that parent.
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

        // No sub-customer match — fall back to the client's parent customer.
        return clientQbId;
    }

    /// Returns the QB customer id for this client. If the client has no cached
    /// id, attempts an auto-match by name and persists the result. Returns null
    /// when no match is found.
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

// Shared logic used by both ProjectEstimatesController and ProjectInvoicesController
// for deciding the LinkSource flag on a fetched QB document.
internal static class QbDocumentLinkResolver
{
    /// Returns "custom-field" if Approach A applies, "explicit" if Approach B
    /// applies, or "" when neither applies (the document is "available to link").
    /// Custom-field match takes precedence so the QB-side configuration is the
    /// source of truth when both could apply.
    public static string Resolve(
        QbDocumentDto    doc,
        string           projectIdStr,
        string?          customFieldName,
        HashSet<string>  explicitIds)
    {
        if (!string.IsNullOrEmpty(customFieldName))
        {
            foreach (var cf in doc.CustomFields)
            {
                if (string.Equals(cf.Name, customFieldName, StringComparison.OrdinalIgnoreCase)
                    && cf.Value == projectIdStr)
                    return "custom-field";
            }
        }

        return explicitIds.Contains(doc.Id) ? "explicit" : "";
    }
}
