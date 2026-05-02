using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/tools")]
public class ToolsController : ControllerBase
{
    private readonly IIifToPdfService _iifToPdf;

    public ToolsController(IIifToPdfService iifToPdf) => _iifToPdf = iifToPdf;

    [HttpPost("iif-parse")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ParseIif(IFormFile file, [FromQuery] bool trimEmpty = false)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var ext = Path.GetExtension(file.FileName);
        if (!ext.Equals(".iif", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only .iif files are accepted." });

        await using var stream = file.OpenReadStream();
        var result = await _iifToPdf.ParseAsync(stream, trimEmpty);
        return Ok(result);
    }

    [HttpPost("iif-to-pdf")]
    [RequestSizeLimit(10_000_000)]
    public async Task<IActionResult> ConvertIifToPdf(IFormFile file, [FromQuery] bool trimEmpty = false)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var ext = Path.GetExtension(file.FileName);
        if (!ext.Equals(".iif", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only .iif files are accepted." });

        await using var stream = file.OpenReadStream();
        var pdf = await _iifToPdf.ConvertAsync(stream, Path.GetFileNameWithoutExtension(file.FileName), trimEmpty);

        var pdfFileName = Path.GetFileNameWithoutExtension(file.FileName) + ".pdf";
        return File(pdf, "application/pdf", pdfFileName);
    }
}
