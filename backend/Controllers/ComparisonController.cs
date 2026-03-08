using Microsoft.AspNetCore.Mvc;
using BOS.Backend.DTOs;
using BOS.Backend.Models;
using BOS.Backend.Services;

namespace BOS.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ComparisonController : ControllerBase
{
    private readonly ISpreadsheetParserService  _spreadsheetParser;
    private readonly IAdobePdfService           _adobe;
    private readonly IComparisonService         _comparison;
    private readonly IReportService             _report;
    private readonly IComparisonCriteriaService _criteriaService;

    public ComparisonController(
        ISpreadsheetParserService  spreadsheetParser,
        IAdobePdfService           adobe,
        IComparisonService         comparison,
        IReportService             report,
        IComparisonCriteriaService criteriaService)
    {
        _spreadsheetParser = spreadsheetParser;
        _adobe             = adobe;
        _comparison        = comparison;
        _report            = report;
        _criteriaService   = criteriaService;
    }

    // ── REMOVED 2026-02-22: POST /api/comparison/debug-adobe-xlsx ────────────
    // Debug endpoint replaced by the proper scan-adobe-headers / confirm-adobe flow.

    // ── REMOVED 2026-02-21: POST /api/comparison/headers ──────────────────────
    // Direct PDF parsing via PdfPig is no longer used. Adobe PDF Services is now
    // the only PDF upload path so the pre-flight header check is unnecessary.

    // ── REMOVED 2026-02-21: POST /api/comparison/upload ───────────────────────
    // Direct PDF → PdfPig parse path. Replaced by /upload-adobe as the primary
    // PDF upload endpoint.

    /// <summary>
    /// POST /api/comparison/upload-spreadsheet?supplierId={id}
    /// Accepts an Excel (.xlsx) or CSV (.csv) file and compares its units against
    /// the supplier's master glossary. Uses the supplier's saved criteria to identify
    /// which columns carry the match key and price.
    ///
    /// This endpoint does not require Adobe PDF Services — spreadsheet files are
    /// parsed directly by SpreadsheetParserService.
    /// </summary>
    [HttpPost("upload-spreadsheet")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<IActionResult> UploadSpreadsheet(IFormFile file, [FromQuery] int supplierId)
    {
        if (supplierId <= 0)
            return BadRequest(new { message = "A valid supplierId is required." });

        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".csv")
            return BadRequest(new { message = "File must be an Excel (.xlsx) or CSV (.csv) file." });

        // Load the supplier's saved criteria (column names must be provided)
        var criteriaDto = await _criteriaService.GetBySupplierIdAsync(supplierId);
        if (criteriaDto is null)
        {
            return BadRequest(new
            {
                message = "No comparison criteria configured for this supplier. " +
                          "Visit the Suppliers page to set it up."
            });
        }

        var criteria = new ComparisonCriteria
        {
            Id               = criteriaDto.Id,
            SupplierId       = criteriaDto.SupplierId,
            MatchColumn      = criteriaDto.MatchColumn,
            Format           = criteriaDto.Format,
            ColPrice         = criteriaDto.ColPrice,
            ColDescription   = criteriaDto.ColDescription,
            ColQuantity      = criteriaDto.ColQuantity,
            ColTotal         = criteriaDto.ColTotal,
            ColInvoiceNumber = criteriaDto.ColInvoiceNumber,
            // X anchors are irrelevant for spreadsheet parsing (positional layout is handled by header name)
        };

        using var stream = file.OpenReadStream();
        var parsedUnits = _spreadsheetParser.Parse(stream, ext, criteria);

        if (parsedUnits.Count == 0)
            return BadRequest(new
            {
                message = "No units could be extracted from the spreadsheet. " +
                          "Check that the column header names in the criteria match the file exactly."
            });

        var results = await _comparison.CompareAsync(supplierId, parsedUnits);
        return Ok(results);
    }

    // ── REMOVED 2026-02-22: POST /api/comparison/upload-adobe ────────────────
    // Single-step Adobe flow replaced by the two-step scan-adobe-headers /
    // confirm-adobe flow which always shows the user a column-mapping dialog.

    /// <summary>
    /// POST /api/comparison/scan-adobe-headers?supplierId={id}
    /// Step 1 of the two-step PDF upload flow.
    /// Converts the uploaded PDF via Adobe PDF Services, caches the resulting XLSX
    /// to a temp file identified by a GUID session token, scans rows 1–30 for
    /// candidate header rows, and returns suggestions derived from the supplier's
    /// saved criteria.  The session token must be passed to /confirm-adobe within
    /// 10 minutes or the temp file is abandoned.
    /// </summary>
    [HttpPost("scan-adobe-headers")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<IActionResult> ScanAdobeHeaders(IFormFile file, [FromQuery] int supplierId)
    {
        if (supplierId <= 0)
            return BadRequest(new { message = "A valid supplierId is required." });

        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".pdf")
            return BadRequest(new { message = "File must be a PDF." });

        // ── Convert PDF → XLSX via Adobe ─────────────────────────────────────
        MemoryStream xlsxStream;
        try
        {
            using var pdfStream = file.OpenReadStream();
            xlsxStream = await _adobe.ConvertPdfToXlsxAsync(pdfStream);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(502, new
            {
                message = "Adobe PDF conversion failed: " + ex.Message +
                          " — check your internet connection and Adobe credentials."
            });
        }

        // ── Cache XLSX to temp file ───────────────────────────────────────────
        var sessionToken = Guid.NewGuid().ToString("N");
        var tempPath     = Path.Combine(Path.GetTempPath(), $"{sessionToken}.xlsx");
        xlsxStream.Seek(0, SeekOrigin.Begin);
        await System.IO.File.WriteAllBytesAsync(tempPath, xlsxStream.ToArray());

        // ── Scan candidate header rows ────────────────────────────────────────
        xlsxStream.Seek(0, SeekOrigin.Begin);
        var rawCandidates = _spreadsheetParser.ScanCandidateHeaderRows(xlsxStream, scanDepth: 30, minCells: 2);

        if (rawCandidates.Count == 0)
        {
            System.IO.File.Delete(tempPath);
            return BadRequest(new { message = "No recognisable header rows found in the converted XLSX. The PDF may not contain a tabular data grid." });
        }

        var candidateRows = rawCandidates
            .Select(c => new CandidateHeaderRow(c.RowNumber, c.Headers))
            .ToArray();

        // ── Derive suggestions from saved criteria ────────────────────────────
        var criteriaDto = await _criteriaService.GetBySupplierIdAsync(supplierId);

        int     suggestedRowNumber            = candidateRows[0].RowNumber;
        string? suggestedMatchColumn          = null;
        string? suggestedPriceColumn          = null;
        string? suggestedDescriptionColumn    = null;
        string? suggestedQuantityColumn       = null;
        string? suggestedTotalColumn          = null;
        string? suggestedInvoiceNumberColumn  = null;

        if (criteriaDto is not null)
        {
            // Pick the candidate row whose headers best match saved criteria column names
            int bestScore = -1;
            foreach (var candidate in candidateRows)
            {
                int score = 0;
                foreach (var h in candidate.Headers)
                {
                    if (!string.IsNullOrEmpty(criteriaDto.MatchColumn) &&
                        h.Contains(criteriaDto.MatchColumn, StringComparison.OrdinalIgnoreCase))
                        score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColPrice) &&
                        h.Contains(criteriaDto.ColPrice, StringComparison.OrdinalIgnoreCase))
                        score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColDescription) &&
                        h.Contains(criteriaDto.ColDescription, StringComparison.OrdinalIgnoreCase))
                        score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColQuantity) &&
                        h.Contains(criteriaDto.ColQuantity, StringComparison.OrdinalIgnoreCase))
                        score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColTotal) &&
                        h.Contains(criteriaDto.ColTotal, StringComparison.OrdinalIgnoreCase))
                        score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColInvoiceNumber) &&
                        h.Contains(criteriaDto.ColInvoiceNumber, StringComparison.OrdinalIgnoreCase))
                        score++;
                }
                if (score > bestScore)
                {
                    bestScore          = score;
                    suggestedRowNumber = candidate.RowNumber;
                }
            }

            // Within the best candidate row, find individual column suggestions
            var bestCandidate = candidateRows.First(c => c.RowNumber == suggestedRowNumber);

            string? FindHeader(string? savedName) =>
                string.IsNullOrEmpty(savedName) ? null :
                bestCandidate.Headers.FirstOrDefault(h =>
                    h.Contains(savedName, StringComparison.OrdinalIgnoreCase));

            suggestedMatchColumn         = FindHeader(criteriaDto.MatchColumn);
            suggestedPriceColumn         = FindHeader(criteriaDto.ColPrice);
            suggestedDescriptionColumn   = FindHeader(criteriaDto.ColDescription);
            suggestedQuantityColumn      = FindHeader(criteriaDto.ColQuantity);
            suggestedTotalColumn         = FindHeader(criteriaDto.ColTotal);
            suggestedInvoiceNumberColumn = FindHeader(criteriaDto.ColInvoiceNumber);
        }

        var result = new AdobeHeadersResult(
            SessionToken:                sessionToken,
            CandidateRows:               candidateRows,
            SuggestedRowNumber:          suggestedRowNumber,
            SuggestedMatchColumn:        suggestedMatchColumn,
            SuggestedPriceColumn:        suggestedPriceColumn,
            SuggestedDescriptionColumn:  suggestedDescriptionColumn,
            SuggestedQuantityColumn:     suggestedQuantityColumn,
            SuggestedTotalColumn:        suggestedTotalColumn,
            SuggestedInvoiceNumberColumn: suggestedInvoiceNumberColumn
        );

        return Ok(result);
    }

    /// <summary>
    /// POST /api/comparison/confirm-adobe
    /// Step 2 of the two-step PDF upload flow.
    /// Loads the cached XLSX from temp storage using the session token, builds a
    /// ComparisonCriteria from the user-selected column mapping, parses the XLSX
    /// starting at the specified header row, and runs the comparison.
    /// If SaveToSupplier is true the column mapping is persisted back to the
    /// supplier's criteria for future uploads.
    /// Deletes the temp file regardless of outcome.
    /// </summary>
    [HttpPost("confirm-adobe")]
    public async Task<IActionResult> ConfirmAdobe([FromBody] ConfirmAdobeRequest request)
    {
        if (request is null)
            return BadRequest(new { message = "Request body is required." });

        if (request.SupplierId <= 0)
            return BadRequest(new { message = "A valid supplierId is required." });

        // ── Sanitise session token (must be a 32-char hex GUID — no path traversal) ──
        var token = request.SessionToken ?? string.Empty;
        if (token.Length != 32 || !token.All(char.IsAsciiLetterOrDigit))
            return BadRequest(new { message = "Invalid session token." });

        // ── Load cached XLSX ──────────────────────────────────────────────────
        var tempPath = Path.Combine(Path.GetTempPath(), $"{token}.xlsx");
        if (!System.IO.File.Exists(tempPath))
            return BadRequest(new { message = "Session expired or invalid. Please re-upload the PDF." });

        byte[] xlsxBytes;
        try
        {
            xlsxBytes = await System.IO.File.ReadAllBytesAsync(tempPath);
        }
        finally
        {
            try { System.IO.File.Delete(tempPath); } catch { /* best-effort */ }
        }

        // ── Build criteria from user selection ────────────────────────────────
        var existingCriteria = await _criteriaService.GetBySupplierIdAsync(request.SupplierId);

        var criteria = new ComparisonCriteria
        {
            Id               = existingCriteria?.Id ?? 0,
            SupplierId       = request.SupplierId,
            MatchColumn      = request.MatchColumn,
            Format           = existingCriteria?.Format ?? string.Empty,
            ColPrice         = request.ColPrice,
            ColDescription   = string.IsNullOrWhiteSpace(request.ColDescription)   ? null : request.ColDescription,
            ColQuantity      = string.IsNullOrWhiteSpace(request.ColQuantity)      ? null : request.ColQuantity,
            ColTotal         = string.IsNullOrWhiteSpace(request.ColTotal)         ? null : request.ColTotal,
            ColInvoiceNumber = string.IsNullOrWhiteSpace(request.ColInvoiceNumber) ? null : request.ColInvoiceNumber,
        };

        // ── Optionally persist the column mapping back to the supplier ────────
        if (request.SaveToSupplier)
        {
            var upsertReq = new UpsertComparisonCriteriaRequest(
                MatchColumn:      request.MatchColumn,
                Format:           existingCriteria?.Format ?? string.Empty,
                ColPrice:         request.ColPrice,
                MatchColX:        existingCriteria?.MatchColX,
                PriceColX:        existingCriteria?.PriceColX,
                ColDescription:   string.IsNullOrWhiteSpace(request.ColDescription)   ? null : request.ColDescription,
                ColQuantity:      string.IsNullOrWhiteSpace(request.ColQuantity)      ? null : request.ColQuantity,
                ColTotal:         string.IsNullOrWhiteSpace(request.ColTotal)         ? null : request.ColTotal,
                ColInvoiceNumber: string.IsNullOrWhiteSpace(request.ColInvoiceNumber) ? null : request.ColInvoiceNumber
            );
            await _criteriaService.UpsertAsync(request.SupplierId, upsertReq);
        }

        // ── Parse the XLSX using the user-selected header row ─────────────────
        using var xlsxStream = new MemoryStream(xlsxBytes);
        var parsedUnits = _spreadsheetParser.Parse(xlsxStream, ".xlsx", criteria, request.HeaderRowNumber);

        if (parsedUnits.Count == 0)
            return BadRequest(new
            {
                message = $"No units could be extracted from the converted XLSX using row {request.HeaderRowNumber} as the header. " +
                          "Try selecting a different header row or check that the column names match."
            });

        var results = await _comparison.CompareAsync(request.SupplierId, parsedUnits);
        return Ok(results);
    }

    /// <summary>
    /// POST /api/comparison/scan-spreadsheet-headers?supplierId={id}
    /// Step 1 of the two-step spreadsheet upload flow (mirrors scan-adobe-headers for PDFs).
    /// Accepts an XLSX or CSV file, caches it to a temp file, scans candidate header rows,
    /// and returns suggestions derived from the supplier's saved criteria.
    /// The session token must be passed to /confirm-spreadsheet within 10 minutes.
    /// </summary>
    [HttpPost("scan-spreadsheet-headers")]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<IActionResult> ScanSpreadsheetHeaders(IFormFile file, [FromQuery] int supplierId)
    {
        if (supplierId <= 0)
            return BadRequest(new { message = "A valid supplierId is required." });

        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".csv")
            return BadRequest(new { message = "File must be an Excel (.xlsx) or CSV (.csv) file." });

        // ── Cache file to temp ────────────────────────────────────────────────
        var sessionToken = Guid.NewGuid().ToString("N");
        var tempPath     = Path.Combine(Path.GetTempPath(), $"{sessionToken}{ext}");

        using (var fs = System.IO.File.Create(tempPath))
            await file.CopyToAsync(fs);

        // ── Scan candidate header rows ────────────────────────────────────────
        List<(int RowNumber, string[] Headers)> rawCandidates;
        if (ext == ".xlsx")
        {
            using var ms = new MemoryStream();
            await System.IO.File.OpenRead(tempPath).CopyToAsync(ms);
            ms.Seek(0, SeekOrigin.Begin);
            rawCandidates = _spreadsheetParser.ScanCandidateHeaderRows(ms, scanDepth: 30, minCells: 2);
        }
        else
        {
            // For CSV, read the header row directly (CsvHelper parses it)
            rawCandidates = ScanCsvHeaderRow(tempPath);
        }

        if (rawCandidates.Count == 0)
        {
            System.IO.File.Delete(tempPath);
            return BadRequest(new { message = "No recognisable header row found in the file." });
        }

        var candidateRows = rawCandidates
            .Select(c => new CandidateHeaderRow(c.RowNumber, c.Headers))
            .ToArray();

        // ── Derive suggestions from saved criteria ────────────────────────────
        var criteriaDto = await _criteriaService.GetBySupplierIdAsync(supplierId);

        int     suggestedRowNumber            = candidateRows[0].RowNumber;
        string? suggestedMatchColumn          = null;
        string? suggestedPriceColumn          = null;
        string? suggestedDescriptionColumn    = null;
        string? suggestedQuantityColumn       = null;
        string? suggestedTotalColumn          = null;
        string? suggestedInvoiceNumberColumn  = null;

        if (criteriaDto is not null)
        {
            int bestScore = -1;
            foreach (var candidate in candidateRows)
            {
                int score = 0;
                foreach (var h in candidate.Headers)
                {
                    if (!string.IsNullOrEmpty(criteriaDto.MatchColumn) &&
                        h.Contains(criteriaDto.MatchColumn, StringComparison.OrdinalIgnoreCase)) score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColPrice) &&
                        h.Contains(criteriaDto.ColPrice, StringComparison.OrdinalIgnoreCase)) score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColDescription) &&
                        h.Contains(criteriaDto.ColDescription, StringComparison.OrdinalIgnoreCase)) score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColQuantity) &&
                        h.Contains(criteriaDto.ColQuantity, StringComparison.OrdinalIgnoreCase)) score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColTotal) &&
                        h.Contains(criteriaDto.ColTotal, StringComparison.OrdinalIgnoreCase)) score++;
                    if (!string.IsNullOrEmpty(criteriaDto.ColInvoiceNumber) &&
                        h.Contains(criteriaDto.ColInvoiceNumber, StringComparison.OrdinalIgnoreCase)) score++;
                }
                if (score > bestScore) { bestScore = score; suggestedRowNumber = candidate.RowNumber; }
            }

            var bestCandidate = candidateRows.First(c => c.RowNumber == suggestedRowNumber);
            string? FindHeader(string? savedName) =>
                string.IsNullOrEmpty(savedName) ? null :
                bestCandidate.Headers.FirstOrDefault(h =>
                    h.Contains(savedName, StringComparison.OrdinalIgnoreCase));

            suggestedMatchColumn         = FindHeader(criteriaDto.MatchColumn);
            suggestedPriceColumn         = FindHeader(criteriaDto.ColPrice);
            suggestedQuantityColumn      = FindHeader(criteriaDto.ColQuantity);
            suggestedTotalColumn         = FindHeader(criteriaDto.ColTotal);
            suggestedInvoiceNumberColumn = FindHeader(criteriaDto.ColInvoiceNumber);

            // For description, use saved criteria first; fall back to auto-detecting a
            // header containing "description" when ColDescription is not configured.
            suggestedDescriptionColumn = FindHeader(criteriaDto.ColDescription)
                ?? bestCandidate.Headers.FirstOrDefault(h =>
                    h.Contains("description", StringComparison.OrdinalIgnoreCase));
        }
        else
        {
            // No criteria configured — auto-detect description from headers
            var firstCandidate = candidateRows[0];
            suggestedDescriptionColumn = firstCandidate.Headers.FirstOrDefault(h =>
                h.Contains("description", StringComparison.OrdinalIgnoreCase));
        }

        var result = new SpreadsheetHeadersResult(
            SessionToken:                sessionToken,
            FileExtension:               ext,
            CandidateRows:               candidateRows,
            SuggestedRowNumber:          suggestedRowNumber,
            SuggestedMatchColumn:        suggestedMatchColumn,
            SuggestedPriceColumn:        suggestedPriceColumn,
            SuggestedDescriptionColumn:  suggestedDescriptionColumn,
            SuggestedQuantityColumn:     suggestedQuantityColumn,
            SuggestedTotalColumn:        suggestedTotalColumn,
            SuggestedInvoiceNumberColumn: suggestedInvoiceNumberColumn
        );

        return Ok(result);
    }

    /// <summary>
    /// POST /api/comparison/confirm-spreadsheet
    /// Step 2 of the two-step spreadsheet upload flow.
    /// Loads the cached XLSX/CSV, builds criteria from the user-selected column mapping,
    /// parses the file, runs the comparison, and optionally saves the mapping.
    /// </summary>
    [HttpPost("confirm-spreadsheet")]
    public async Task<IActionResult> ConfirmSpreadsheet([FromBody] ConfirmSpreadsheetRequest request)
    {
        if (request is null)
            return BadRequest(new { message = "Request body is required." });

        if (request.SupplierId <= 0)
            return BadRequest(new { message = "A valid supplierId is required." });

        var token = request.SessionToken ?? string.Empty;
        if (token.Length != 32 || !token.All(char.IsAsciiLetterOrDigit))
            return BadRequest(new { message = "Invalid session token." });

        // ── Locate cached file (extension may be .xlsx or .csv) ──────────────
        var tempPathXlsx = Path.Combine(Path.GetTempPath(), $"{token}.xlsx");
        var tempPathCsv  = Path.Combine(Path.GetTempPath(), $"{token}.csv");
        string tempPath;
        string ext;

        if (System.IO.File.Exists(tempPathXlsx))      { tempPath = tempPathXlsx; ext = ".xlsx"; }
        else if (System.IO.File.Exists(tempPathCsv))  { tempPath = tempPathCsv;  ext = ".csv";  }
        else return BadRequest(new { message = "Session expired or invalid. Please re-upload the file." });

        byte[] fileBytes;
        try   { fileBytes = await System.IO.File.ReadAllBytesAsync(tempPath); }
        finally { try { System.IO.File.Delete(tempPath); } catch { /* best-effort */ } }

        // ── Build criteria from user selection ────────────────────────────────
        var existingCriteria = await _criteriaService.GetBySupplierIdAsync(request.SupplierId);

        var criteria = new ComparisonCriteria
        {
            Id               = existingCriteria?.Id ?? 0,
            SupplierId       = request.SupplierId,
            MatchColumn      = request.MatchColumn,
            Format           = existingCriteria?.Format ?? string.Empty,
            ColPrice         = request.ColPrice,
            ColDescription   = string.IsNullOrWhiteSpace(request.ColDescription)   ? null : request.ColDescription,
            ColQuantity      = string.IsNullOrWhiteSpace(request.ColQuantity)      ? null : request.ColQuantity,
            ColTotal         = string.IsNullOrWhiteSpace(request.ColTotal)         ? null : request.ColTotal,
            ColInvoiceNumber = string.IsNullOrWhiteSpace(request.ColInvoiceNumber) ? null : request.ColInvoiceNumber,
        };

        if (request.SaveToSupplier)
        {
            var upsertReq = new UpsertComparisonCriteriaRequest(
                MatchColumn:      request.MatchColumn,
                Format:           existingCriteria?.Format ?? string.Empty,
                ColPrice:         request.ColPrice,
                MatchColX:        existingCriteria?.MatchColX,
                PriceColX:        existingCriteria?.PriceColX,
                ColDescription:   string.IsNullOrWhiteSpace(request.ColDescription)   ? null : request.ColDescription,
                ColQuantity:      string.IsNullOrWhiteSpace(request.ColQuantity)      ? null : request.ColQuantity,
                ColTotal:         string.IsNullOrWhiteSpace(request.ColTotal)         ? null : request.ColTotal,
                ColInvoiceNumber: string.IsNullOrWhiteSpace(request.ColInvoiceNumber) ? null : request.ColInvoiceNumber
            );
            await _criteriaService.UpsertAsync(request.SupplierId, upsertReq);
        }

        using var stream = new MemoryStream(fileBytes);
        var parsedUnits = _spreadsheetParser.Parse(stream, ext, criteria, request.HeaderRowNumber);

        if (parsedUnits.Count == 0)
            return BadRequest(new
            {
                message = $"No units could be extracted from the file using row {request.HeaderRowNumber} as the header. " +
                          "Try selecting a different header row or check that the column names match."
            });

        var results = await _comparison.CompareAsync(request.SupplierId, parsedUnits);
        return Ok(results);
    }

    /// <summary>
    /// Reads the first row of a CSV file as the header row.
    /// Returns it as a single-element list matching the ScanCandidateHeaderRows signature.
    /// </summary>
    private static List<(int RowNumber, string[] Headers)> ScanCsvHeaderRow(string csvPath)
    {
        try
        {
            using var reader = new System.IO.StreamReader(csvPath);
            var firstLine = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(firstLine)) return [];

            var headers = firstLine.Split(',')
                .Select(h => h.Trim().Trim('"'))
                .Where(h => !string.IsNullOrEmpty(h))
                .ToArray();

            return headers.Length >= 2
                ? [(1, headers)]
                : [];
        }
        catch { return []; }
    }

    /// <summary>
    /// POST /api/comparison/report?includeNewItems={bool}
    /// Accepts a list of comparison results and streams back a generated PDF report.
    /// By default only overpriced items are included. Pass includeNewItems=true to
    /// also include new/unknown items in the report.
    /// </summary>
    [HttpPost("report")]
    public IActionResult GenerateReport(
        [FromBody]  List<ComparisonResultDto> results,
        [FromQuery] bool includeNewItems = false)
    {
        if (results is null || results.Count == 0)
            return BadRequest(new { message = "No results provided." });

        byte[] pdfBytes;
        try
        {
            pdfBytes = _report.GenerateComparisonReport(results, includeNewItems);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Report generation failed: {ex.Message}" });
        }

        var filename = $"PriceComparison_{DateTime.Now:yyyyMMdd_HHmm}.pdf";
        return File(pdfBytes, "application/pdf", filename);
    }
}
