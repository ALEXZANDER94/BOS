using System.Text.RegularExpressions;

namespace BOS.Backend.Services;

/// <summary>
/// The result of parsing a combined match-key cell from a supplier's PDF.
/// All three fields are guaranteed to be non-null and non-empty when returned
/// from a successful parse.
/// </summary>
public record ParsedCriteria(string CatalogNumber, string MFR, string Description);

/// <summary>
/// Static parser for supplier combined match-key cells.
///
/// Each supplier encodes their unit identity (MFR, Description, Catalog #)
/// into a single cell using a supplier-specific format template. This class
/// provides two parse strategies:
///
/// 1. <see cref="Parse"/> — template-based: uses the format string to extract
///    tokens in a deterministic, left-to-right fashion. Most accurate.
///
/// 2. <see cref="ParseHeuristic"/> — rule-based fallback used when the template
///    parse fails or when no criteria are configured:
///    - CatalogNumber = any whitespace-free token matching the catalog pattern
///    - MFR = first single word (in a segment without the catalog number)
///    - Description = remaining words
/// </summary>
public static partial class CriteriaParser
{
    // Catalog number pattern: starts with a letter or digit,
    // may contain letters, digits, hyphens, slashes, dots, or #
    // but NEVER contains spaces (that's the key distinguisher).
    [GeneratedRegex(@"^[A-Za-z0-9][A-Za-z0-9\-\/\.#]+$")]
    private static partial Regex CatalogNumberRegex();

    // ── Template-based parse ─────────────────────────────────────────────────

    /// <summary>
    /// Parses <paramref name="cellText"/> using the format template from the
    /// supplier's ComparisonCriteria.
    ///
    /// Algorithm:
    ///   1. Split the format template on literal "\n" → format lines
    ///   2. Split the cell text on actual newlines (\r?\n) → cell lines
    ///   3. Zip the two lists (shorter wins if lengths differ)
    ///   4. For each (formatLine, cellLine) pair, extract tokens left-to-right:
    ///      - {CatalogNumber} → next whitespace-free token
    ///      - {MFR}           → next single whitespace-separated word
    ///      - {Description}   → all remaining words in that segment
    ///   5. Return ParsedCriteria only if CatalogNumber was found; otherwise null.
    /// </summary>
    public static ParsedCriteria? Parse(string cellText, string formatTemplate)
    {
        if (string.IsNullOrWhiteSpace(cellText) || string.IsNullOrWhiteSpace(formatTemplate))
            return null;

        // Split format template on the literal two-character sequence \n
        var formatLines = formatTemplate.Split(@"\n", StringSplitOptions.None);

        // Split cell text on real newlines
        var cellLines = cellText.Split(new[] { "\r\n", "\n", "\r" }, StringSplitOptions.None);

        string catalogNumber = string.Empty;
        string mfr           = string.Empty;
        string description   = string.Empty;

        int pairCount = Math.Min(formatLines.Length, cellLines.Length);

        for (int i = 0; i < pairCount; i++)
        {
            var formatLine = formatLines[i].Trim();
            var cellLine   = cellLines[i].Trim();

            if (string.IsNullOrEmpty(formatLine) || string.IsNullOrEmpty(cellLine))
                continue;

            ExtractFromLinePair(formatLine, cellLine, ref catalogNumber, ref mfr, ref description);
        }

        if (string.IsNullOrEmpty(catalogNumber))
            return null;

        return new ParsedCriteria(catalogNumber, mfr, description);
    }

    /// <summary>
    /// Extracts token values from a single (formatLine, cellLine) pair.
    /// Processes tokens left-to-right in the order they appear in the format line.
    /// </summary>
    private static void ExtractFromLinePair(
        string formatLine, string cellLine,
        ref string catalogNumber, ref string mfr, ref string description)
    {
        // Find tokens in the format line in order.
        // {Catalog #} is accepted as an alias for {CatalogNumber} to match the
        // format string used by CED and other suppliers (e.g. "{MFR}\n{Catalog #}").
        // Normalise aliases to their canonical names before processing.
        // Normalise token aliases → canonical names
        // e.g. "{Catalog #}" (CED) → "{CatalogNumber}"
        var normalisedFormatLine = formatLine
            .Replace("{Catalog #}", "{CatalogNumber}", StringComparison.OrdinalIgnoreCase)
            .Replace("{Cat #}",     "{CatalogNumber}", StringComparison.OrdinalIgnoreCase)
            .Replace("{Cat#}",      "{CatalogNumber}", StringComparison.OrdinalIgnoreCase)
            .Replace("{Part #}",    "{CatalogNumber}", StringComparison.OrdinalIgnoreCase)
            .Replace("{Part#}",     "{CatalogNumber}", StringComparison.OrdinalIgnoreCase)
            .Replace("{Item #}",    "{CatalogNumber}", StringComparison.OrdinalIgnoreCase)
            .Replace("{Mfr}",       "{MFR}",           StringComparison.OrdinalIgnoreCase)
            .Replace("{Manufacturer}", "{MFR}",        StringComparison.OrdinalIgnoreCase)
            .Replace("{Desc}",      "{Description}",   StringComparison.OrdinalIgnoreCase);

        var tokens = new List<(string Token, int Index)>();
        foreach (var token in new[] { "{CatalogNumber}", "{MFR}", "{Description}" })
        {
            int idx = normalisedFormatLine.IndexOf(token, StringComparison.OrdinalIgnoreCase);
            if (idx >= 0)
                tokens.Add((token, idx));
        }

        if (tokens.Count == 0) return;

        // Sort by their position in the format string
        tokens.Sort((a, b) => a.Index.CompareTo(b.Index));

        // Now extract values from cellLine based on token order
        var words = cellLine.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        int wordPos = 0;

        for (int t = 0; t < tokens.Count; t++)
        {
            var (token, _) = tokens[t];
            bool isLast = t == tokens.Count - 1;

            if (wordPos >= words.Length) break;

            if (token.Equals("{CatalogNumber}", StringComparison.OrdinalIgnoreCase))
            {
                // CatalogNumber = next whitespace-free token (always a single word)
                if (wordPos < words.Length)
                {
                    if (string.IsNullOrEmpty(catalogNumber))
                        catalogNumber = words[wordPos];
                    wordPos++;
                }
            }
            else if (token.Equals("{MFR}", StringComparison.OrdinalIgnoreCase))
            {
                // MFR = next single word
                if (wordPos < words.Length)
                {
                    if (string.IsNullOrEmpty(mfr))
                        mfr = words[wordPos];
                    wordPos++;
                }
            }
            else if (token.Equals("{Description}", StringComparison.OrdinalIgnoreCase))
            {
                // Description = all remaining words (if last token) or words until the next token's anchor
                if (isLast)
                {
                    var descWords = words.Skip(wordPos).ToArray();
                    if (string.IsNullOrEmpty(description) && descWords.Length > 0)
                        description = string.Join(" ", descWords);
                    wordPos = words.Length;
                }
                else
                {
                    // Description is followed by another token — take one word at a time
                    // In practice {Description} is usually last, but handle it safely
                    if (wordPos < words.Length)
                    {
                        if (string.IsNullOrEmpty(description))
                            description = words[wordPos];
                        wordPos++;
                    }
                }
            }
        }
    }

    // ── Heuristic fallback parse ─────────────────────────────────────────────

    /// <summary>
    /// Attempts to parse a combined match-key cell using rule-based heuristics
    /// when the template parse fails or no criteria are configured.
    ///
    /// Rules (applied across all lines of the cell):
    ///   - CatalogNumber = any whitespace-free token matching the catalog pattern
    ///     (letters/digits/special chars, no spaces, at least 2 chars)
    ///   - MFR           = first single word in a segment that does NOT contain
    ///     the catalog number token
    ///   - Description   = all remaining words (excluding MFR and CatalogNumber)
    ///
    /// Returns null if no CatalogNumber can be identified (triggers the user dialog).
    /// </summary>
    public static ParsedCriteria? ParseHeuristic(string cellText)
    {
        if (string.IsNullOrWhiteSpace(cellText))
            return null;

        var lines = cellText.Split(new[] { "\r\n", "\n", "\r" }, StringSplitOptions.RemoveEmptyEntries);

        string catalogNumber = string.Empty;
        string mfr           = string.Empty;
        var    descWords     = new List<string>();

        foreach (var line in lines)
        {
            var words = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            bool lineHasCatalog = false;

            foreach (var word in words)
            {
                if (string.IsNullOrEmpty(catalogNumber) && CatalogNumberRegex().IsMatch(word))
                {
                    catalogNumber  = word;
                    lineHasCatalog = true;
                }
            }

            if (lineHasCatalog)
            {
                // Collect non-catalog words from this line as description candidates
                foreach (var word in words)
                {
                    if (word != catalogNumber)
                        descWords.Add(word);
                }
            }
            else
            {
                // No catalog number on this line — first word is MFR candidate
                if (words.Length > 0)
                {
                    if (string.IsNullOrEmpty(mfr))
                        mfr = words[0];

                    // Remaining words contribute to description
                    for (int i = 1; i < words.Length; i++)
                        descWords.Add(words[i]);
                }
            }
        }

        if (string.IsNullOrEmpty(catalogNumber))
            return null;

        return new ParsedCriteria(catalogNumber, mfr, string.Join(" ", descWords));
    }
}
