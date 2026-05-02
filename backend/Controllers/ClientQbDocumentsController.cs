using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

// Aggregates every QuickBooks Estimate and Invoice for a BOS Client across
// the parent QB Customer plus all its sub-customers (QB Projects), and
// annotates each one with the BOS Project (if any) it's associated with.
//
// Read-only — link / unlink / convert remain on the per-project endpoints.
[ApiController]
[Route("api/client/{clientId:int}/qb-documents")]
[Authorize]
public class ClientQbDocumentsController : ControllerBase
{
    private readonly AppDbContext        _db;
    private readonly IQuickBooksService  _qb;
    private readonly IAppSettingsService _settings;
    private readonly ILogger<ClientQbDocumentsController> _logger;

    public ClientQbDocumentsController(
        AppDbContext db,
        IQuickBooksService qb,
        IAppSettingsService settings,
        ILogger<ClientQbDocumentsController> logger)
    {
        _db       = db;
        _qb       = qb;
        _settings = settings;
        _logger   = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(int clientId)
    {
        var client = await _db.Clients.FirstOrDefaultAsync(c => c.Id == clientId);
        if (client is null) return NotFound(new { message = "Client not found." });

        // Resolve QB customer (auto-match-by-name on first hit, mirroring the
        // project endpoints).
        var parentId = client.QbCustomerId;
        if (string.IsNullOrEmpty(parentId))
        {
            var matchedId = await _qb.FindCustomerIdByNameAsync(client.Name);
            if (matchedId is null)
            {
                return Conflict(new
                {
                    reason  = "no-customer-match",
                    message = $"No QuickBooks customer matches client '{client.Name}'. " +
                              "Use 'Re-link QuickBooks Customer' on the client edit modal.",
                });
            }
            client.QbCustomerId   = matchedId;
            client.QbCustomerName = client.Name;
            client.UpdatedAt      = DateTime.UtcNow;
            await _db.SaveChangesAsync();
            parentId = matchedId;

            _logger.LogInformation(
                "Auto-matched BOS Client '{ClientName}' (id={ClientId}) to QB Customer id={CustomerId}",
                client.Name, client.Id, matchedId);
        }

        // Build the full customer-id scope: parent + every sub-customer.
        var subs = await _qb.ListSubCustomersAsync(parentId);
        var scopeIds = new List<string> { parentId };
        scopeIds.AddRange(subs.Select(s => s.Id));

        // Fetch estimates + invoices in parallel — both go through the QB
        // query API and are independent.
        var estimatesTask = _qb.GetEstimatesForCustomersAsync(scopeIds);
        var invoicesTask  = _qb.GetInvoicesForCustomersAsync(scopeIds);
        await Task.WhenAll(estimatesTask, invoicesTask);
        var estimates = await estimatesTask;
        var invoices  = await invoicesTask;

        // Pull BOS-side data needed to compute the BosProjectId/Name annotation:
        //   1) Project rows for this client (so we know which Project owns which QbProjectId)
        //   2) Explicit estimate/invoice link rows for those projects
        //   3) The configured custom-field name (Approach A)
        var projects = await _db.Projects
            .Where(p => p.ClientId == clientId)
            .Select(p => new ProjectRef(p.Id, p.Name, p.QbProjectId))
            .ToListAsync();

        var projectByQbId = projects
            .Where(p => !string.IsNullOrEmpty(p.QbProjectId))
            .ToDictionary(p => p.QbProjectId!, p => p, StringComparer.OrdinalIgnoreCase);

        var projectByIdString = projects
            .ToDictionary(p => p.Id.ToString(), p => p);

        var projectIds = projects.Select(p => p.Id).ToList();

        var estimateLinks = await _db.ProjectQbEstimateLinks
            .Where(l => projectIds.Contains(l.ProjectId))
            .Select(l => new { l.QbEstimateId, l.ProjectId })
            .ToListAsync();
        var estimateLinkMap = estimateLinks
            .ToDictionary(l => l.QbEstimateId, l => l.ProjectId, StringComparer.OrdinalIgnoreCase);

        var invoiceLinks = await _db.ProjectQbInvoiceLinks
            .Where(l => projectIds.Contains(l.ProjectId))
            .Select(l => new { l.QbInvoiceId, l.ProjectId })
            .ToListAsync();
        var invoiceLinkMap = invoiceLinks
            .ToDictionary(l => l.QbInvoiceId, l => l.ProjectId, StringComparer.OrdinalIgnoreCase);

        var customFieldName = await _settings.GetAsync(AppSettingsService.QbProjectCustomFieldKey);

        // Apply the annotation. Priority: QB-project (sub-customer) link >
        // custom-field > explicit link. The first match wins.
        var annotatedEstimates = estimates
            .Select(d => Annotate(d, estimateLinkMap, projectByQbId, projectByIdString, projects, customFieldName))
            .ToList();
        var annotatedInvoices = invoices
            .Select(d => Annotate(d, invoiceLinkMap, projectByQbId, projectByIdString, projects, customFieldName))
            .ToList();

        return Ok(new ClientQbDocumentsResponse(annotatedEstimates, annotatedInvoices));
    }

    private record ProjectRef(int Id, string Name, string? QbProjectId);

    private static QbDocumentDto Annotate(
        QbDocumentDto                       doc,
        IDictionary<string, int>            linkMap,
        IDictionary<string, ProjectRef>     projectByQbId,
        IDictionary<string, ProjectRef>     projectByIdString,
        List<ProjectRef>                    projects,
        string?                             customFieldName)
    {
        // Priority 1 — doc's CustomerRef equals some Project.QbProjectId.
        if (projectByQbId.TryGetValue(doc.CustomerId, out var p1))
            return doc with { BosProjectId = p1.Id, BosProjectName = p1.Name };

        // Priority 2 — custom field (Approach A) carries a numeric BOS project id.
        if (!string.IsNullOrEmpty(customFieldName))
        {
            var match = doc.CustomFields.FirstOrDefault(cf =>
                string.Equals(cf.Name, customFieldName, StringComparison.OrdinalIgnoreCase));
            if (match?.Value != null
                && projectByIdString.TryGetValue(match.Value, out var p2))
                return doc with { BosProjectId = p2.Id, BosProjectName = p2.Name };
        }

        // Priority 3 — explicit link row in ProjectQbEstimateLinks/InvoiceLinks.
        if (linkMap.TryGetValue(doc.Id, out var explicitProjectId))
        {
            var p3 = projects.FirstOrDefault(p => p.Id == explicitProjectId);
            if (p3 is not null)
                return doc with { BosProjectId = p3.Id, BosProjectName = p3.Name };
        }

        return doc;
    }
}
