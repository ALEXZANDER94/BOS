using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/clients/{clientId:int}/proposals")]
public class ProposalsController : ControllerBase
{
    private readonly IProposalService _proposals;
    public ProposalsController(IProposalService proposals) => _proposals = proposals;

    private string CurrentEmail => User.FindFirstValue(ClaimTypes.Email)!;

    [HttpGet]
    public async Task<IActionResult> GetAll(int clientId, [FromQuery] bool includeConverted = false)
        => Ok(await _proposals.GetForClientAsync(clientId, includeConverted));

    [HttpGet("{proposalId:int}")]
    public async Task<IActionResult> GetById(int clientId, int proposalId)
    {
        var dto = await _proposals.GetByIdAsync(clientId, proposalId);
        if (dto is null) return NotFound();
        return Ok(dto);
    }

    [HttpPost]
    public async Task<IActionResult> Create(int clientId, [FromBody] CreateProposalRequest req)
    {
        try
        {
            var dto = await _proposals.CreateAsync(clientId, req, CurrentEmail);
            return CreatedAtAction(nameof(GetById), new { clientId, proposalId = dto.Id }, dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{proposalId:int}")]
    public async Task<IActionResult> Update(int clientId, int proposalId, [FromBody] UpdateProposalRequest req)
    {
        try
        {
            var dto = await _proposals.UpdateAsync(clientId, proposalId, req);
            if (dto is null) return NotFound();
            return Ok(dto);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{proposalId:int}")]
    public async Task<IActionResult> Delete(int clientId, int proposalId)
    {
        var ok = await _proposals.DeleteAsync(clientId, proposalId);
        if (!ok) return NotFound();
        return NoContent();
    }

    [HttpPost("{proposalId:int}/convert")]
    public async Task<IActionResult> Convert(int clientId, int proposalId)
    {
        var (projectId, error) = await _proposals.ConvertToProjectAsync(clientId, proposalId);
        if (projectId is null)
        {
            if (error == "Proposal not found.")
                return NotFound(error);
            return Conflict(error);
        }
        return Ok(new ConvertProposalResultDto(projectId.Value));
    }

    // ── PDF attachment ──────────────────────────────────────────────────────

    [HttpPost("{proposalId:int}/pdf")]
    [RequestSizeLimit(28_000_000)]
    public async Task<IActionResult> UploadPdf(int clientId, int proposalId, IFormFile pdf)
    {
        if (pdf == null || pdf.Length == 0)
            return BadRequest("No file uploaded.");

        if (pdf.ContentType != "application/pdf")
            return BadRequest("Only PDF files are accepted.");

        if (pdf.Length > 25 * 1024 * 1024)
            return BadRequest("File exceeds the 25 MB limit.");

        await using var stream = pdf.OpenReadStream();
        var (_, error) = await _proposals.UploadPdfAsync(clientId, proposalId, pdf.FileName, stream, pdf.Length);
        if (error is not null)
            return BadRequest(error);

        return Ok(new { message = "PDF uploaded." });
    }

    [HttpGet("{proposalId:int}/pdf")]
    public async Task<IActionResult> DownloadPdf(int clientId, int proposalId)
    {
        var (stream, fileName, error) = await _proposals.GetPdfAsync(clientId, proposalId);
        if (stream is null)
            return NotFound(error);

        Response.Headers["X-Robots-Tag"] = "noindex, nofollow, noarchive";
        Response.Headers["Cache-Control"] = "private, no-store";
        return File(stream, "application/pdf", fileName);
    }

    [HttpDelete("{proposalId:int}/pdf")]
    public async Task<IActionResult> DeletePdf(int clientId, int proposalId)
    {
        var (ok, error) = await _proposals.DeletePdfAsync(clientId, proposalId);
        if (!ok) return NotFound(error);
        return NoContent();
    }

    // ── Pricing history ─────────────────────────────────────────────────────

    [HttpGet("{proposalId:int}/pricing")]
    public async Task<IActionResult> GetPricings(int clientId, int proposalId)
        => Ok(await _proposals.GetPricingsAsync(clientId, proposalId));

    [HttpPost("{proposalId:int}/pricing")]
    public async Task<IActionResult> CreatePricing(int clientId, int proposalId, [FromBody] CreateProposalPricingRequest req)
    {
        var (dto, error) = await _proposals.CreatePricingAsync(clientId, proposalId, req);
        if (dto is null) return NotFound(error);
        return Created($"api/clients/{clientId}/proposals/{proposalId}/pricing/{dto.Id}", dto);
    }

    [HttpPut("{proposalId:int}/pricing/{pricingId:int}")]
    public async Task<IActionResult> UpdatePricing(int clientId, int proposalId, int pricingId, [FromBody] UpdateProposalPricingRequest req)
    {
        var (dto, error) = await _proposals.UpdatePricingAsync(clientId, proposalId, pricingId, req);
        if (dto is null) return NotFound(error);
        return Ok(dto);
    }

    [HttpDelete("{proposalId:int}/pricing/{pricingId:int}")]
    public async Task<IActionResult> DeletePricing(int clientId, int proposalId, int pricingId)
    {
        var ok = await _proposals.DeletePricingAsync(clientId, proposalId, pricingId);
        if (!ok) return NotFound();
        return NoContent();
    }
}
