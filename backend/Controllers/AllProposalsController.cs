using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/proposal")]
public class AllProposalsController : ControllerBase
{
    private readonly IProposalService _proposals;

    public AllProposalsController(IProposalService proposals) => _proposals = proposals;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search,
        [FromQuery] string? status,
        [FromQuery] string? type,
        [FromQuery] int?    clientId,
        [FromQuery] bool    includeConverted = false)
        => Ok(await _proposals.GetAllProposalsAsync(search, status, type, clientId, includeConverted));
}
