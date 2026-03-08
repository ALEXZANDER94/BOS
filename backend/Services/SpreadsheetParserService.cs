using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using BOS.Backend.DTOs;
using BOS.Backend.Models;
using System.Globalization;

namespace BOS.Backend.Services;

public interface ISpreadsheetParserService
{
    /// <summary>
    /// Parses an Excel (.xlsx) or CSV (.csv) file and returns a list of parsed PDF units.
    /// Column matching uses the same criteria field names as PDF parsing:
    ///   - MatchColumn  → the column containing the combined key (MFR / Catalog # / Description)
    ///   - ColPrice     → the price column
    /// The format template is used first (template parse), then heuristic parse if that fails.
    /// headerRowNumber is 1-based (default 1). CSV ignores this parameter (CsvHelper reads its own header).
    /// </summary>
    List<ParsedPdfUnit> Parse(Stream fileStream, string fileExtension, ComparisonCriteria criteria, int headerRowNumber = 1);

    /// <summary>
    /// Scans the first <paramref name="scanDepth"/> rows of an XLSX stream for candidate header rows.
    /// A row is a candidate when it contains at least <paramref name="minCells"/> non-empty cells.
    /// Returns the list of candidates sorted by row number.
    /// </summary>
    List<(int RowNumber, string[] Headers)> ScanCandidateHeaderRows(MemoryStream xlsxStream, int scanDepth = 30, int minCells = 2);
}

public class SpreadsheetParserService : ISpreadsheetParserService
{
    public List<ParsedPdfUnit> Parse(Stream fileStream, string fileExtension, ComparisonCriteria criteria, int headerRowNumber = 1)
    {
        // ClosedXML requires a seekable stream; copy to MemoryStream to satisfy that requirement.
        var ms = new MemoryStream();
        fileStream.CopyTo(ms);
        ms.Seek(0, SeekOrigin.Begin);

        return fileExtension.ToLowerInvariant() switch
        {
            ".xlsx" => ParseExcel(ms, criteria, headerRowNumber),
            ".csv"  => ParseCsv(ms, criteria),
            _       => [],
        };
    }

    public List<(int RowNumber, string[] Headers)> ScanCandidateHeaderRows(MemoryStream xlsxStream, int scanDepth = 30, int minCells = 2)
    {
        var candidates = new List<(int RowNumber, string[] Headers)>();

        xlsxStream.Seek(0, SeekOrigin.Begin);
        using var workbook = new XLWorkbook(xlsxStream);
        var sheet = workbook.Worksheets.FirstOrDefault();
        if (sheet is null) return candidates;

        int lastRow = Math.Min(sheet.LastRowUsed()?.RowNumber() ?? 0, scanDepth);
        for (int r = 1; r <= lastRow; r++)
        {
            var row = sheet.Row(r);
            if (row.IsEmpty()) continue;

            int lastCol = row.LastCellUsed()?.Address.ColumnNumber ?? 0;
            var cells = new List<string>();
            for (int c = 1; c <= lastCol; c++)
            {
                var text = row.Cell(c).GetString().Trim();
                if (!string.IsNullOrEmpty(text))
                    cells.Add(text);
            }

            if (cells.Count >= minCells)
                candidates.Add((r, cells.ToArray()));
        }

        return candidates;
    }

    // ── Excel ─────────────────────────────────────────────────────────────────

    private static List<ParsedPdfUnit> ParseExcel(MemoryStream ms, ComparisonCriteria criteria, int headerRowNumber)
    {
        var results = new List<ParsedPdfUnit>();

        using var workbook = new XLWorkbook(ms);

        // Use the first worksheet
        var sheet = workbook.Worksheets.FirstOrDefault();
        if (sheet is null) return results;

        // Use the caller-specified header row — build a column-name → column-index map (1-based)
        var headerRow = sheet.Row(headerRowNumber);
        var colIndex  = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        int lastCol = headerRow.LastCellUsed()?.Address.ColumnNumber ?? 0;
        for (int c = 1; c <= lastCol; c++)
        {
            var text = headerRow.Cell(c).GetString().Trim();
            if (!string.IsNullOrEmpty(text) && !colIndex.ContainsKey(text))
                colIndex[text] = c;
        }

        // Resolve criteria column names → column indices
        int idxMatch       = ResolveColIndex(colIndex, criteria.MatchColumn);
        int idxPrice       = ResolveColIndex(colIndex, criteria.ColPrice);
        // Optional dedicated Description column — if the supplier's spreadsheet has a
        // separate Description column, we read it directly in addition to the format parse.
        // MFR is always extracted from the match-key cell via the Format template.
        int idxDescription = string.IsNullOrWhiteSpace(criteria.ColDescription)
                             ? -1 : ResolveColIndex(colIndex, criteria.ColDescription!);
        // Auto-detect description column: if ColDescription is not configured, scan headers
        // for any column containing "description" (case-insensitive fallback).
        if (idxDescription < 0)
        {
            var descEntry = colIndex.FirstOrDefault(kv =>
                kv.Key.Contains("description", StringComparison.OrdinalIgnoreCase));
            if (descEntry.Key is not null)
                idxDescription = descEntry.Value;
        }
        // Optional quantity column
        int idxQuantity = string.IsNullOrWhiteSpace(criteria.ColQuantity)
                          ? -1 : ResolveColIndex(colIndex, criteria.ColQuantity!);
        // Optional total column — invoice line total for total-based comparison
        int idxTotal = string.IsNullOrWhiteSpace(criteria.ColTotal)
                       ? -1 : ResolveColIndex(colIndex, criteria.ColTotal!);
        // Optional invoice number column
        int idxInvoiceNumber = string.IsNullOrWhiteSpace(criteria.ColInvoiceNumber)
                               ? -1 : ResolveColIndex(colIndex, criteria.ColInvoiceNumber!);

        // MatchColumn and Price are required
        if (idxMatch < 0 || idxPrice < 0) return results;

        int lastRow = sheet.LastRowUsed()?.RowNumber() ?? headerRowNumber;

        for (int r = headerRowNumber + 1; r <= lastRow; r++)
        {
            var row = sheet.Row(r);

            // Skip completely empty rows
            if (row.IsEmpty()) continue;

            string rawCriteriaCell = row.Cell(idxMatch).GetString().Trim();
            if (string.IsNullOrWhiteSpace(rawCriteriaCell)) continue;

            string priceRaw = idxPrice > 0 ? row.Cell(idxPrice).GetString().Trim() : string.Empty;
            if (!TryParsePrice(priceRaw, out decimal price)) continue;

            // Read dedicated Description column if mapped (or auto-detected).
            // MFR is always extracted from the match-key cell via the Format template.
            string? directDescription = idxDescription > 0
                ? NullIfEmpty(row.Cell(idxDescription).GetString().Trim())
                : null;

            // Read quantity — how many units the listed price covers (defaults to 1).
            decimal quantity = 1m;
            if (idxQuantity > 0)
            {
                string qtyRaw = row.Cell(idxQuantity).GetString().Trim();
                if (!decimal.TryParse(qtyRaw, System.Globalization.NumberStyles.Any,
                                      System.Globalization.CultureInfo.InvariantCulture, out quantity)
                    || quantity <= 0)
                    quantity = 1m;
            }

            // Read invoice line total (used for total-based comparison against master × qty).
            decimal proposedTotal = 0m;
            if (idxTotal > 0)
            {
                string totalRaw = row.Cell(idxTotal).GetString().Trim();
                if (TryParsePrice(totalRaw, out decimal t))
                    proposedTotal = t;
            }

            // Read invoice number (string, no numeric parsing needed).
            string invoiceNumber = idxInvoiceNumber > 0
                ? row.Cell(idxInvoiceNumber).GetString().Trim()
                : string.Empty;

            var unit = BuildParsedUnit(rawCriteriaCell, price, criteria.Format,
                                       directDescription, quantity, proposedTotal, invoiceNumber);
            results.Add(unit);
        }

        return results;
    }

    // ── CSV ───────────────────────────────────────────────────────────────────

    private static List<ParsedPdfUnit> ParseCsv(MemoryStream ms, ComparisonCriteria criteria)
    {
        var results = new List<ParsedPdfUnit>();

        using var reader = new StreamReader(ms);
        var config = new CsvConfiguration(CultureInfo.InvariantCulture)
        {
            HasHeaderRecord  = true,
            HeaderValidated  = null,   // Don't throw on missing optional columns
            MissingFieldFound = null,  // Don't throw on missing fields in a row
        };

        using var csv = new CsvReader(reader, config);

        // Read the header to discover column names
        csv.Read();
        csv.ReadHeader();

        var headerRecord = csv.HeaderRecord ?? [];
        var colIndex = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < headerRecord.Length; i++)
        {
            var h = headerRecord[i].Trim();
            if (!string.IsNullOrEmpty(h) && !colIndex.ContainsKey(h))
                colIndex[h] = i;
        }

        // Resolve criteria column names → column indices (0-based for CSV)
        int idxMatch       = ResolveColIndex(colIndex, criteria.MatchColumn);
        int idxPrice       = ResolveColIndex(colIndex, criteria.ColPrice);
        int idxDescription = string.IsNullOrWhiteSpace(criteria.ColDescription)
                             ? -1 : ResolveColIndex(colIndex, criteria.ColDescription!);
        // Auto-detect description column: scan headers for any containing "description".
        if (idxDescription < 0)
        {
            var descEntry = colIndex.FirstOrDefault(kv =>
                kv.Key.Contains("description", StringComparison.OrdinalIgnoreCase));
            if (descEntry.Key is not null)
                idxDescription = descEntry.Value;
        }
        int idxQuantity = string.IsNullOrWhiteSpace(criteria.ColQuantity)
                          ? -1 : ResolveColIndex(colIndex, criteria.ColQuantity!);
        int idxTotal = string.IsNullOrWhiteSpace(criteria.ColTotal)
                       ? -1 : ResolveColIndex(colIndex, criteria.ColTotal!);
        int idxInvoiceNumber = string.IsNullOrWhiteSpace(criteria.ColInvoiceNumber)
                               ? -1 : ResolveColIndex(colIndex, criteria.ColInvoiceNumber!);

        if (idxMatch < 0 || idxPrice < 0) return results;

        while (csv.Read())
        {
            string rawCriteriaCell = SafeGetField(csv, idxMatch);
            if (string.IsNullOrWhiteSpace(rawCriteriaCell)) continue;

            string priceRaw = SafeGetField(csv, idxPrice);
            if (!TryParsePrice(priceRaw, out decimal price)) continue;

            string? directDescription = idxDescription >= 0
                ? NullIfEmpty(SafeGetField(csv, idxDescription))
                : null;

            decimal quantity = 1m;
            if (idxQuantity >= 0)
            {
                string qtyRaw = SafeGetField(csv, idxQuantity);
                if (!decimal.TryParse(qtyRaw, System.Globalization.NumberStyles.Any,
                                      System.Globalization.CultureInfo.InvariantCulture, out quantity)
                    || quantity <= 0)
                    quantity = 1m;
            }

            decimal proposedTotal = 0m;
            if (idxTotal >= 0)
            {
                string totalRaw = SafeGetField(csv, idxTotal);
                if (TryParsePrice(totalRaw, out decimal t))
                    proposedTotal = t;
            }

            string invoiceNumber = idxInvoiceNumber >= 0
                ? SafeGetField(csv, idxInvoiceNumber)
                : string.Empty;

            var unit = BuildParsedUnit(rawCriteriaCell, price, criteria.Format,
                                       directDescription, quantity, proposedTotal, invoiceNumber);
            results.Add(unit);
        }

        return results;
    }

    // ── Shared helpers ────────────────────────────────────────────────────────

    /// <summary>
    /// Attempts to match a criteria field name against the spreadsheet's column header dictionary.
    /// Tries exact match first, then partial/contains match as fallback.
    /// Returns the matched index (1-based for Excel, 0-based for CSV as stored), or -1 if not found.
    /// </summary>
    private static int ResolveColIndex(Dictionary<string, int> colIndex, string fieldName)
    {
        var target = fieldName.Trim();
        if (string.IsNullOrEmpty(target)) return -1;

        if (colIndex.TryGetValue(target, out int idx)) return idx;

        foreach (var kv in colIndex)
        {
            if (kv.Key.Contains(target, StringComparison.OrdinalIgnoreCase) ||
                target.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
                return kv.Value;
        }

        return -1;
    }

    private static string SafeGetField(CsvReader csv, int index)
    {
        try { return csv.GetField(index)?.Trim() ?? string.Empty; }
        catch { return string.Empty; }
    }

    /// <summary>
    /// Builds a ParsedPdfUnit from the raw combined-key cell and price.
    /// MFR is always extracted from the match-key cell via the Format template parse;
    /// it is never overridden by a direct column read.
    /// When <paramref name="directDescription"/> is supplied (read from a dedicated
    /// Description column) it takes precedence over the description extracted by CriteriaParser.
    /// Falls back to NeedsReview=true only if CatalogNumber cannot be determined at all.
    /// </summary>
    private static ParsedPdfUnit BuildParsedUnit(
        string  rawCriteriaCell,
        decimal price,
        string  formatTemplate,
        string? directDescription = null,
        decimal quantity          = 1m,
        decimal proposedTotal     = 0m,
        string  invoiceNumber     = "")
    {
        // Try template-based parse, then heuristic fallback
        var parsed = CriteriaParser.Parse(rawCriteriaCell, formatTemplate)
                  ?? CriteriaParser.ParseHeuristic(rawCriteriaCell);

        if (parsed is not null)
        {
            // MFR always comes from the format template parse.
            // Description can be overridden by a dedicated column when configured.
            return new ParsedPdfUnit(
                CatalogNumber:    parsed.CatalogNumber,
                Description:      directDescription ?? parsed.Description,
                MFR:              parsed.MFR,
                ProposedPrice:    price,
                NeedsReview:      false,
                RawCriteriaCell:  string.Empty,
                ProposedQuantity: quantity,
                ProposedTotal:    proposedTotal,
                InvoiceNumber:    invoiceNumber
            );
        }

        // CriteriaParser couldn't extract a catalog number at all.
        // If we have a direct description column we can still emit a useful record;
        // treat the raw match-cell value as the catalog number (best effort).
        if (directDescription is not null)
        {
            return new ParsedPdfUnit(
                CatalogNumber:    rawCriteriaCell,
                Description:      directDescription,
                MFR:              string.Empty,
                ProposedPrice:    price,
                NeedsReview:      false,
                RawCriteriaCell:  string.Empty,
                ProposedQuantity: quantity,
                ProposedTotal:    proposedTotal,
                InvoiceNumber:    invoiceNumber
            );
        }

        // Both parses failed and no direct columns — flag for manual review
        return new ParsedPdfUnit(
            CatalogNumber:    $"UNMATCHED_{rawCriteriaCell.GetHashCode():X8}",
            Description:      rawCriteriaCell,
            MFR:              string.Empty,
            ProposedPrice:    price,
            NeedsReview:      true,
            RawCriteriaCell:  rawCriteriaCell,
            ProposedQuantity: quantity,
            ProposedTotal:    proposedTotal,
            InvoiceNumber:    invoiceNumber
        );
    }

    private static string? NullIfEmpty(string s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;

    private static bool TryParsePrice(string text, out decimal price)
    {
        var cleaned = text.Replace("$", "").Replace(",", "").Trim();
        return decimal.TryParse(cleaned, NumberStyles.Any, CultureInfo.InvariantCulture, out price);
    }
}
