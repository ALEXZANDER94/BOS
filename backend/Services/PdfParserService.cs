using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using BOS.Backend.DTOs;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

public interface IPdfParserService
{
    /// <summary>
    /// Extracts the header row from a PDF and determines how well the
    /// supplier's saved criteria matches the actual column names.
    /// The stream is NOT consumed — it is copied internally so the caller
    /// can reuse the same stream for a subsequent ParsePricePdf call.
    /// </summary>
    PdfHeadersDto ExtractHeaders(Stream pdfStream, ComparisonCriteria? criteria);

    /// <summary>
    /// Parses a supplier's proposed price PDF using the comparison criteria
    /// (which may be the stored criteria or a user-corrected override).
    /// Each row's combined match-key cell is parsed by CriteriaParser.
    /// Rows that cannot be parsed emit a ParsedPdfUnit with NeedsReview = true.
    /// </summary>
    List<ParsedPdfUnit> ParsePricePdf(Stream pdfStream, ComparisonCriteria criteria);
}

public class PdfParserService : IPdfParserService
{
    // Words whose vertical centres are within this many points of each other
    // are grouped into the same micro-row. 3pt handles minor baseline shifts in
    // machine-generated PDFs while keeping lines cleanly separated.
    private const double RowTolerance = 3.0;

    // Maximum vertical gap (in points) used to merge stacked header-cell lines
    // into one logical header row (e.g. "PRODUCT" stacked above "CODE").
    // Only applied during header detection, not during data-row parsing.
    private const double HeaderMergeGap = 20.0;

    // Minimum number of criteria fields (match column + price column) that must
    // match a row for it to be considered the header row. Threshold = 2 means
    // both required fields must be present; avoids false-positives on metadata boxes.
    private const int HeaderMatchThreshold = 2;

    // ── ExtractHeaders ───────────────────────────────────────────────────────

    public PdfHeadersDto ExtractHeaders(Stream pdfStream, ComparisonCriteria? criteria)
    {
        var pdfHeaders = ReadHeaderWords(pdfStream, criteria);

        // Reset the original stream if it supports seeking, so the caller
        // can pass the same stream to ParsePricePdf without re-reading the file.
        if (pdfStream.CanSeek)
            pdfStream.Seek(0, SeekOrigin.Begin);

        // Build a lookup from header text → column index (case-insensitive)
        var headerIndex = BuildHeaderIndex(pdfHeaders);

        // Resolve each criteria field against the header
        string? matchColFound   = criteria is null ? null : ResolveMatch(headerIndex, criteria.MatchColumn, pdfHeaders);
        string? matchPriceFound = criteria is null ? null : ResolveMatch(headerIndex, criteria.ColPrice,    pdfHeaders);

        // Both required fields must match for allMatched to be true
        bool allMatched = matchColFound   is not null
                       && matchPriceFound is not null;

        ComparisonCriteriaDto? criteriaDto = criteria is null ? null : new ComparisonCriteriaDto(
            criteria.Id, criteria.SupplierId,
            criteria.MatchColumn, criteria.Format,
            criteria.ColPrice,
            criteria.MatchColX, criteria.PriceColX,
            criteria.ColDescription, criteria.ColQuantity,
            criteria.ColTotal, criteria.ColInvoiceNumber,
            criteria.CreatedAt, criteria.UpdatedAt);

        return new PdfHeadersDto(
            PdfHeaders:      pdfHeaders,
            CurrentCriteria: criteriaDto,
            MatchStatus:     new MatchStatusDto(matchColFound, matchPriceFound),
            AllMatched:      allMatched
        );
    }

    // ── ParsePricePdf ────────────────────────────────────────────────────────

    public List<ParsedPdfUnit> ParsePricePdf(Stream pdfStream, ComparisonCriteria criteria)
    {
        var results = new List<ParsedPdfUnit>();

        using var document = PdfDocument.Open(pdfStream);

        // ── Step 1: locate the header row by scanning all pages ──────────────
        // PDFs like CED have a metadata box above the data table, so we cannot
        // assume rows[0] is the header. FindBestHeaderRow scans every row on
        // every page and returns the one that matches the most criteria fields.
        List<Word>? headerRow  = null;
        int         headerPage = 1;   // 1-based page number where header was found

        foreach (var page in document.GetPages())
        {
            var pageWords = page.GetWords().ToList();
            if (pageWords.Count == 0) continue;

            // Use header-band grouping so that multi-line column headers
            // (e.g. "PRODUCT" stacked above "CODE") are merged into one band.
            var pageRows  = GroupWordsIntoHeaderBands(pageWords);
            var candidate = FindBestHeaderRow(pageRows, criteria);

            if (candidate is not null)
            {
                headerRow  = candidate;
                headerPage = page.Number;
                break;
            }
        }

        if (headerRow is null) return results;

        // Build a dictionary: merged header phrase → phrase index (0-based).
        // Phrases are reconstructed by merging spatially adjacent words so that
        // multi-word column names (e.g. "Product Code") are a single key.
        // Also capture the left X-position of each phrase's first word for bucketing.
        var headerPhrases  = MergeHeaderPhrasesWithX(headerRow);
        var headerIndex    = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var phraseXMap     = new Dictionary<int, double>(); // phraseIdx → leftX
        for (int i = 0; i < headerPhrases.Count; i++)
        {
            headerIndex[headerPhrases[i].Text] = i;
            phraseXMap[i] = headerPhrases[i].LeftX;
        }

        // Locate the two required column phrase indices
        int idxMatch = FindColIndex(headerIndex, criteria.MatchColumn);
        int idxPrice = FindColIndex(headerIndex, criteria.ColPrice);

        // MatchColumn and Price are required; return empty if not found
        if (idxMatch < 0 || idxPrice < 0)
            return results;

        var mappedIndices = new List<int> { idxMatch, idxPrice };
        mappedIndices.Sort();

        // Anchor the column X-positions from the phrase left-X map
        var colXPositions = new Dictionary<int, double>();
        foreach (var ci in mappedIndices)
        {
            if (phraseXMap.TryGetValue(ci, out double x))
                colXPositions[ci] = x;
        }

        // ── Apply manual X-anchor overrides ──────────────────────────────────
        // When the header phrase position doesn't match where the data actually
        // lives (e.g. CED invoices where data starts further left than the header),
        // the user can set MatchColX / PriceColX explicitly in the criteria to
        // tell the parser exactly where each column's data begins.
        if (criteria.MatchColX.HasValue && colXPositions.ContainsKey(idxMatch))
            colXPositions[idxMatch] = criteria.MatchColX.Value;
        if (criteria.PriceColX.HasValue && colXPositions.ContainsKey(idxPrice))
            colXPositions[idxPrice] = criteria.PriceColX.Value;

        // Right boundary of the match column: the left anchor of the next
        // tracked column (price or unit). Words that fall entirely to the LEFT
        // of this boundary are "match-column-only" and may be continuation
        // lines of a preceding data row (e.g. CED's catalog number on line 2).
        double matchColRight = mappedIndices
            .Where(ci => ci != idxMatch && colXPositions.ContainsKey(ci))
            .Select(ci => colXPositions[ci])
            .DefaultIfEmpty(double.MaxValue)
            .Min();

        // ── Step 2: parse all pages ───────────────────────────────────────────
        foreach (var page in document.GetPages())
        {
            var words = page.GetWords().ToList();
            if (words.Count == 0) continue;

            // Use simple micro-row grouping for data rows.
            var rows = GroupWordsIntoRows(words);

            // On the page where the header was found, skip every row up to and
            // including the header band (which may span multiple micro-rows).
            int startRow = 0;
            if (page.Number == headerPage)
            {
                double headerBottomY = headerRow.Min(w => w.BoundingBox.Bottom);
                while (startRow < rows.Count &&
                       rows[startRow].Min(w => w.BoundingBox.Bottom) >= headerBottomY - RowTolerance)
                {
                    startRow++;
                }
            }

            // Iterate data rows. When we encounter a micro-row whose words all
            // fall within the match-column X-range, it is the "continuation
            // line" of the preceding row (e.g. HOM120PDF below SQD in CED
            // invoices). Merge it into the accumulated row for the next call to
            // TryParseRow rather than treating it as an independent row.
            var pendingWords = new List<Word>();
            for (int i = startRow; i < rows.Count; i++)
            {
                var row = rows[i];

                // A continuation line has ALL its words to the left of the
                // price column (i.e. within the match-column X range).
                // We don't enforce a left boundary because the data may sit
                // further left than the column header text (as in CED invoices).
                bool isContinuationLine = row.Count > 0
                    && row.All(w => w.BoundingBox.Right <= matchColRight + 5);

                if (isContinuationLine && pendingWords.Count > 0)
                {
                    // Append the continuation words to the pending row and keep
                    // accumulating — don't emit yet.
                    pendingWords.AddRange(row);
                }
                else
                {
                    // Emit the previously accumulated row (if any).
                    if (pendingWords.Count > 0)
                    {
                        var parsed = TryParseRow(pendingWords, idxMatch, idxPrice,
                                                 colXPositions, mappedIndices, criteria.Format);
                        if (parsed is not null)
                            results.Add(parsed);
                    }
                    pendingWords = new List<Word>(row);
                }
            }

            // Emit the last pending row.
            if (pendingWords.Count > 0)
            {
                var parsed = TryParseRow(pendingWords, idxMatch, idxPrice,
                                         colXPositions, mappedIndices, criteria.Format);
                if (parsed is not null)
                    results.Add(parsed);
            }
        }

        return results;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Copies the PDF stream into a fresh MemoryStream, opens the PDF from
    /// that copy, and reads the header words by finding the best-matching row
    /// across all pages (not just page 1, row 0).
    /// The original stream is left intact.
    /// </summary>
    private static List<string> ReadHeaderWords(Stream pdfStream, ComparisonCriteria? criteria)
    {
        try
        {
            var copy = new MemoryStream();
            pdfStream.CopyTo(copy);
            copy.Seek(0, SeekOrigin.Begin);

            using var document = PdfDocument.Open(copy);

            foreach (var page in document.GetPages())
            {
                var words = page.GetWords().ToList();
                if (words.Count == 0) continue;

                var rows = GroupWordsIntoHeaderBands(words);

                List<Word>? headerRow = criteria is not null
                    ? FindBestHeaderRow(rows, criteria)
                    : FindFallbackHeaderRow(rows);

                if (headerRow is not null)
                    return MergeHeaderPhrases(headerRow)
                                    .Where(t => !string.IsNullOrEmpty(t))
                                    .ToList();
            }

            return [];
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// Scans all rows and returns the one that matches the highest number of
    /// criteria field names. Requires at least HeaderMatchThreshold matches
    /// AND the mandatory pair (MatchColumn + ColPrice) to both match.
    /// Returns null if no row meets the threshold.
    /// </summary>
    private static List<Word>? FindBestHeaderRow(List<List<Word>> rows, ComparisonCriteria criteria)
    {
        List<Word>? bestRow   = null;
        int         bestScore = -1;

        foreach (var row in rows)
        {
            if (row.Count == 0) continue;

            // Merge spatially adjacent words into multi-word column header phrases
            // (e.g. "Product" + "Code" → "Product Code") before building the index.
            var phrases     = MergeHeaderPhrases(row);
            var tempIndex   = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < phrases.Count; i++)
                tempIndex[phrases[i]] = i;

            bool hasMatch = FindColIndex(tempIndex, criteria.MatchColumn) >= 0;
            bool hasPrice = FindColIndex(tempIndex, criteria.ColPrice)   >= 0;

            int score = (hasMatch ? 1 : 0)
                      + (hasPrice ? 1 : 0);

            // Must hit threshold AND have the mandatory pair (match + price)
            if (score >= HeaderMatchThreshold
                && hasMatch && hasPrice
                && score > bestScore)
            {
                bestScore = score;
                bestRow   = row;
            }
        }

        return bestRow;
    }

    /// <summary>
    /// Fallback header detection used when no criteria are available.
    /// Returns the first row whose words are predominantly short, all-caps,
    /// and contain no digits — a reasonable heuristic for a column header row.
    /// </summary>
    private static List<Word>? FindFallbackHeaderRow(List<List<Word>> rows)
    {
        foreach (var row in rows)
        {
            if (row.Count < 2) continue;

            int headerLike = row.Count(w =>
            {
                var t = w.Text.Trim();
                return t.Length > 0
                    && t.Length <= 20
                    && t == t.ToUpper()
                    && !t.Any(char.IsDigit);
            });

            if (headerLike >= Math.Max(2, row.Count / 2))
                return row;
        }
        return null;
    }

    /// <summary>
    /// Builds a case-insensitive header-text → index dictionary.
    /// </summary>
    private static Dictionary<string, int> BuildHeaderIndex(List<string> headers)
    {
        var idx = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (int i = 0; i < headers.Count; i++)
            idx[headers[i]] = i;
        return idx;
    }

    /// <summary>
    /// Resolves a mapped column name against the PDF header index.
    /// Returns the matched PDF header word on success, or null if not found.
    /// </summary>
    private static string? ResolveMatch(Dictionary<string, int> headerIndex, string mappedName, List<string> pdfHeaders)
    {
        int idx = FindColIndex(headerIndex, mappedName);
        if (idx < 0 || idx >= pdfHeaders.Count) return null;
        return pdfHeaders[idx];
    }

    /// <summary>
    /// Merges spatially adjacent Word objects in a header row into multi-word
    /// column header phrases (e.g. ["Product", "Code"] → ["Product Code"]).
    ///
    /// Two adjacent words are merged when the horizontal gap between them is
    /// less than 2× the width of the wider of the two words. This threshold is
    /// large enough to join words within the same column header cell, but small
    /// enough to keep separate columns apart.
    /// </summary>
    private static List<string> MergeHeaderPhrases(List<Word> row)
        => MergeHeaderPhrasesWithX(row).Select(p => p.Text).ToList();

    /// <summary>
    /// Same as <see cref="MergeHeaderPhrases"/> but also returns the left X
    /// position of the first word in each phrase, used to anchor column buckets.
    /// </summary>
    private static List<(string Text, double LeftX)> MergeHeaderPhrasesWithX(List<Word> row)
    {
        // row is already sorted left-to-right by GroupWordsIntoRows
        var result = new List<(string Text, double LeftX)>();
        if (row.Count == 0) return result;

        string currentPhrase = row[0].Text.Trim();
        double currentLeft   = row[0].BoundingBox.Left;
        double prevRight     = row[0].BoundingBox.Right;
        double prevWidth     = row[0].BoundingBox.Width;

        for (int i = 1; i < row.Count; i++)
        {
            var word     = row[i];
            double gap   = word.BoundingBox.Left - prevRight;
            double maxW  = Math.Max(prevWidth, word.BoundingBox.Width);

            // Merge if the gap is smaller than 2× the wider word's width
            if (gap < maxW * 2.0)
            {
                currentPhrase += " " + word.Text.Trim();
            }
            else
            {
                result.Add((currentPhrase, currentLeft));
                currentPhrase = word.Text.Trim();
                currentLeft   = word.BoundingBox.Left;
            }

            prevRight = word.BoundingBox.Right;
            prevWidth = word.BoundingBox.Width;
        }

        result.Add((currentPhrase, currentLeft));
        return result;
    }

    /// <summary>
    /// Attempts to look up the column index for a mapped field name.
    /// Tries exact match first, then contains as a fallback.
    /// Returns -1 if not found.
    /// </summary>
    private static int FindColIndex(Dictionary<string, int> headerIndex, string mappedName)
    {
        var target = mappedName.Trim();
        if (string.IsNullOrEmpty(target)) return -1;

        if (headerIndex.TryGetValue(target, out int idx)) return idx;

        foreach (var kv in headerIndex)
        {
            if (kv.Key.Contains(target, StringComparison.OrdinalIgnoreCase) ||
                target.Contains(kv.Key, StringComparison.OrdinalIgnoreCase))
            {
                return kv.Value;
            }
        }

        return -1;
    }

    /// <summary>
    /// Parses a data row using the new criteria-based approach.
    ///
    /// The combined match key column (MatchColumn) contains MFR + Description + CatalogNumber
    /// packed together. This method:
    ///   1. Collects the raw text from the MatchColumn bucket (words that fall under that column's X anchor)
    ///   2. Attempts CriteriaParser.Parse() using the format template
    ///   3. Falls back to CriteriaParser.ParseHeuristic() if template parse fails
    ///   4. If both fail, emits a ParsedPdfUnit with NeedsReview = true and the raw cell text
    ///
    /// Cell text reconstruction: PdfPig extracts individual words. Words within the same
    /// MatchColumn X-bucket are joined with spaces. However, the combined cell may have
    /// multiple logical "lines" within the same PDF row — we detect line breaks by checking
    /// if a word's Y-position differs significantly from the previous word's Y-position.
    /// </summary>
    private static ParsedPdfUnit? TryParseRow(
        List<Word> row,
        int idxMatch, int idxPrice,
        Dictionary<int, double> colXPositions,
        List<int> mappedIndices,
        string formatTemplate)
    {
        if (row.Count == 0) return null;

        var buckets = new Dictionary<int, List<Word>>();
        foreach (var ci in mappedIndices)
            buckets[ci] = [];

        foreach (var word in row)
        {
            int assignedCol = mappedIndices[0];
            double wordLeft = word.BoundingBox.Left;

            foreach (var ci in mappedIndices)
            {
                if (!colXPositions.TryGetValue(ci, out double colX)) continue;
                if (colX <= wordLeft)
                    assignedCol = ci;
            }

            if (buckets.TryGetValue(assignedCol, out var bucket))
                bucket.Add(word);
        }

        // ── Reconstruct raw cell text for the MatchColumn ────────────────────
        // Words in the bucket are already sorted by X (left-to-right per GroupWordsIntoRows).
        // We need to preserve newlines — detect them by significant Y-position changes.
        string rawCriteriaCell = ReconstructCellText(
            buckets.TryGetValue(idxMatch, out var matchWords) ? matchWords : []);

        // ── Get price ────────────────────────────────────────────────────────
        string priceRaw = buckets.TryGetValue(idxPrice, out var priceWords)
            ? string.Join(" ", priceWords.Select(w => w.Text)).Trim()
            : string.Empty;

        if (!TryParsePrice(priceRaw, out decimal price)) return null;

        // ── Parse the combined cell ───────────────────────────────────────────
        if (string.IsNullOrWhiteSpace(rawCriteriaCell)) return null;

        // Try template-based parse first
        var parsed = CriteriaParser.Parse(rawCriteriaCell, formatTemplate);

        // Fall back to heuristic parse
        parsed ??= CriteriaParser.ParseHeuristic(rawCriteriaCell);

        if (parsed is not null)
        {
            return new ParsedPdfUnit(
                CatalogNumber:   parsed.CatalogNumber,
                Description:     parsed.Description,
                MFR:             parsed.MFR,
                ProposedPrice:   price,
                NeedsReview:     false,
                RawCriteriaCell: string.Empty
            );
        }

        // Both parses failed — flag for user review
        // Use empty strings for identifiers; the frontend will show the raw cell
        return new ParsedPdfUnit(
            CatalogNumber:   $"UNMATCHED_{rawCriteriaCell.GetHashCode():X8}",
            Description:     rawCriteriaCell,
            MFR:             string.Empty,
            ProposedPrice:   price,
            NeedsReview:     true,
            RawCriteriaCell: rawCriteriaCell
        );
    }

    /// <summary>
    /// Reconstructs cell text from a list of PdfPig Word objects, preserving
    /// logical line breaks by detecting significant Y-position changes between words.
    /// </summary>
    private static string ReconstructCellText(List<Word> words)
    {
        if (words.Count == 0) return string.Empty;

        // Sort by Y descending (top to bottom), then X ascending (left to right)
        var sorted = words
            .OrderByDescending(w => w.BoundingBox.Bottom)
            .ThenBy(w => w.BoundingBox.Left)
            .ToList();

        var lines = new List<List<string>>();
        List<string>? currentLine = null;
        double currentY = double.MaxValue;

        foreach (var word in sorted)
        {
            double wordY = word.BoundingBox.Bottom;

            if (currentLine is null || Math.Abs(wordY - currentY) > RowTolerance)
            {
                currentLine = [];
                lines.Add(currentLine);
                currentY = wordY;
            }

            currentLine.Add(word.Text);
        }

        return string.Join("\n", lines.Select(l => string.Join(" ", l)));
    }

    /// <summary>
    /// Groups words into micro-rows by Y-position (RowTolerance = 3pt).
    /// Each micro-row is one PDF text line. No further merging is done here —
    /// merging for header detection uses GroupWordsIntoHeaderBands, and
    /// merging for data rows is handled inside ParsePricePdf via
    /// MergeConsecutiveCriteriaLines.
    /// </summary>
    private static List<List<Word>> GroupWordsIntoRows(List<Word> words)
    {
        if (words.Count == 0) return [];

        var sorted = words.OrderByDescending(w => w.BoundingBox.Bottom).ToList();

        var rows = new List<List<Word>>();
        List<Word>? currentRow = null;
        double currentY = double.MaxValue;

        foreach (var word in sorted)
        {
            double wordY = word.BoundingBox.Bottom;
            if (currentRow is null || Math.Abs(wordY - currentY) > RowTolerance)
            {
                currentRow = [];
                rows.Add(currentRow);
                currentY = wordY;
            }
            currentRow.Add(word);
        }

        foreach (var row in rows)
            row.Sort((a, b) => a.BoundingBox.Left.CompareTo(b.BoundingBox.Left));

        return rows;
    }

    /// <summary>
    /// For header detection only: merges consecutive micro-rows whose vertical
    /// gap is ≤ HeaderMergeGap into "bands". This handles column headers like
    /// "PRODUCT" stacked above "CODE" in a single header cell.
    /// </summary>
    private static List<List<Word>> GroupWordsIntoHeaderBands(List<Word> words)
    {
        if (words.Count == 0) return [];

        // Phase 1: micro-rows
        var sorted = words.OrderByDescending(w => w.BoundingBox.Bottom).ToList();
        var microRows = new List<(double TopY, double BottomY, List<Word> Words)>();
        List<Word>? cur = null;
        double curY = double.MaxValue, curTop = double.MaxValue, curBot = double.MinValue;

        foreach (var word in sorted)
        {
            double bot = word.BoundingBox.Bottom;
            if (cur is null || Math.Abs(bot - curY) > RowTolerance)
            {
                cur = [];
                curTop = word.BoundingBox.Top;
                curBot = bot;
                microRows.Add((curTop, curBot, cur));
                curY = bot;
            }
            cur.Add(word);
            if (word.BoundingBox.Top    > curTop) curTop = word.BoundingBox.Top;
            if (word.BoundingBox.Bottom < curBot) curBot = word.BoundingBox.Bottom;
            microRows[^1] = (curTop, curBot, cur);
        }

        // Phase 2: merge micro-rows within HeaderMergeGap into bands
        var bands = new List<List<Word>>();
        if (microRows.Count == 0) return bands;

        var band      = new List<Word>(microRows[0].Words);
        double prevBot = microRows[0].BottomY;

        for (int i = 1; i < microRows.Count; i++)
        {
            var (topY, botY, mw) = microRows[i];
            double gap = prevBot - topY;   // positive = gap between rows
            if (gap <= HeaderMergeGap)
                band.AddRange(mw);
            else
            {
                band.Sort((a, b) => a.BoundingBox.Left.CompareTo(b.BoundingBox.Left));
                bands.Add(band);
                band = new List<Word>(mw);
            }
            prevBot = botY;
        }
        band.Sort((a, b) => a.BoundingBox.Left.CompareTo(b.BoundingBox.Left));
        bands.Add(band);
        return bands;
    }

    private static bool TryParsePrice(string text, out decimal price)
    {
        var cleaned = text
            .Replace("$", "")
            .Replace(",", "")
            .Trim();

        return decimal.TryParse(
            cleaned,
            System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture,
            out price);
    }

}
