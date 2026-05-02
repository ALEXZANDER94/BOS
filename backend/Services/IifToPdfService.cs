using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace BOS.Backend.Services;

public class IifParseResult
{
    public bool IsValid { get; set; }
    public List<string> Warnings { get; set; } = [];
    public List<IifSectionDto> Sections { get; set; } = [];
}

public class IifSectionDto
{
    public string Name { get; set; } = "";
    public List<string> Headers { get; set; } = [];
    public List<List<string>> Rows { get; set; } = [];
}

public interface IIifToPdfService
{
    Task<IifParseResult> ParseAsync(Stream iifStream, bool trimEmptyColumns = false);
    Task<byte[]> ConvertAsync(Stream iifStream, string fileName, bool trimEmptyColumns = false);
}

public class IifToPdfService : IIifToPdfService
{
    public Task<IifParseResult> ParseAsync(Stream iifStream, bool trimEmptyColumns = false)
    {
        using var reader = new StreamReader(iifStream);
        var content = reader.ReadToEnd();
        var result = new IifParseResult();

        if (string.IsNullOrWhiteSpace(content))
        {
            result.IsValid = false;
            result.Warnings.Add("File is empty — no content to parse.");
            return Task.FromResult(result);
        }

        var sections = ParseIif(content);

        if (trimEmptyColumns)
            TrimTrailingEmptyColumns(sections);

        if (sections.Count == 0)
        {
            result.IsValid = false;
            result.Warnings.Add("No IIF sections found. The file may not be a valid IIF format (expected lines starting with '!' as section headers).");
            return Task.FromResult(result);
        }

        foreach (var section in sections)
        {
            if (section.Name.Equals("ENDTRNS", StringComparison.OrdinalIgnoreCase))
                continue;

            if (section.Headers.Count == 0 && section.Rows.Count == 0)
                result.Warnings.Add($"Section \"{section.Name}\" has no headers or data rows.");

            var expectedCols = section.Headers.Count;
            if (expectedCols > 0)
            {
                foreach (var row in section.Rows)
                {
                    var nonEmptyCols = row.Count(c => c.Length > 0);
                    if (nonEmptyCols > 0 && row.Count > expectedCols + 1)
                    {
                        result.Warnings.Add($"Section \"{section.Name}\" has a row with more columns ({row.Count}) than headers ({expectedCols}). Data may be misaligned.");
                        break;
                    }
                }
            }

            result.Sections.Add(new IifSectionDto
            {
                Name = section.Name,
                Headers = section.Headers,
                Rows = section.Rows,
            });
        }

        result.IsValid = true;
        return Task.FromResult(result);
    }

    public Task<byte[]> ConvertAsync(Stream iifStream, string fileName, bool trimEmptyColumns = false)
    {
        using var reader = new StreamReader(iifStream);
        var content = reader.ReadToEnd();
        var sections = ParseIif(content);

        if (trimEmptyColumns)
            TrimTrailingEmptyColumns(sections);

        var pdf = GeneratePdf(sections, fileName);
        return Task.FromResult(pdf);
    }

    private static char DetectDelimiter(string content)
    {
        var firstLine = content.Split('\n')[0];
        var tabCount = firstLine.Count(c => c == '\t');
        var commaCount = firstLine.Count(c => c == ',');
        return tabCount >= commaCount ? '\t' : ',';
    }

    private static List<IifSection> ParseIif(string content)
    {
        var delimiter = DetectDelimiter(content);
        var sections = new List<IifSection>();
        var headerDefs = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        var sectionMap = new Dictionary<string, IifSection>(StringComparer.OrdinalIgnoreCase);
        var isTraditional = false;

        var lines = content.Split('\n')
            .Select(l => l.TrimEnd('\r'))
            .Where(l => !string.IsNullOrWhiteSpace(l))
            .ToList();

        if (lines.Count > 0 && lines[0].TrimStart().StartsWith('!'))
            isTraditional = true;

        if (isTraditional)
        {
            IifSection? current = null;
            foreach (var line in lines)
            {
                var parts = line.Split(delimiter);
                var tag = parts[0].Trim();

                if (tag.Equals("!ENDTRNS", StringComparison.OrdinalIgnoreCase))
                    continue;

                if (tag.StartsWith('!'))
                {
                    current = new IifSection
                    {
                        Name = tag[1..],
                        Headers = parts.Skip(1).Select(h => h.Trim()).Where(h => h.Length > 0).ToList(),
                    };
                    sections.Add(current);
                }
                else if (current != null && !tag.Equals("ENDTRNS", StringComparison.OrdinalIgnoreCase))
                {
                    current.Rows.Add(parts.Select(p => p.Trim()).ToList());
                }
            }
        }
        else
        {
            // Comma-delimited variant: first occurrence of each tag with named columns
            // is the header definition; subsequent occurrences are data rows.
            foreach (var line in lines)
            {
                var parts = line.Split(delimiter).Select(p => p.Trim()).ToList();
                var tag = parts[0].ToUpperInvariant();

                if (tag is "ENDTRNS" or "!ENDTRNS")
                    continue;

                if (!headerDefs.ContainsKey(tag))
                {
                    // First occurrence — check if remaining columns look like headers
                    // (contain letters and aren't dates/amounts)
                    var rest = parts.Skip(1).Where(p => p.Length > 0).ToList();
                    var looksLikeHeader = rest.Count > 0 && rest.All(p =>
                        p.All(c => char.IsLetter(c) || c == '_' || c == ' ' || char.IsDigit(c))
                        && p.Any(char.IsLetter));

                    if (looksLikeHeader)
                    {
                        headerDefs[tag] = rest;
                        var section = new IifSection
                        {
                            Name = tag,
                            Headers = rest,
                        };
                        sections.Add(section);
                        sectionMap[tag] = section;
                        continue;
                    }
                }

                // Data row
                if (!sectionMap.ContainsKey(tag))
                {
                    var section = new IifSection { Name = tag };
                    sections.Add(section);
                    sectionMap[tag] = section;
                }
                // Skip the first column (the tag itself) for data rows
                sectionMap[tag].Rows.Add(parts.Skip(1).ToList());
            }
        }

        return sections;
    }

    private static byte[] GeneratePdf(List<IifSection> sections, string fileName)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter);
                page.Margin(40);
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header().Column(col =>
                {
                    col.Item().Text(fileName).FontSize(14).Bold();
                    col.Item().Text($"Converted from IIF — {DateTime.UtcNow:MMM d, yyyy}")
                        .FontSize(8).FontColor(Colors.Grey.Medium);
                    col.Item().PaddingBottom(8).LineHorizontal(0.5f).LineColor(Colors.Grey.Lighten2);
                });

                page.Content().Column(col =>
                {
                    foreach (var section in sections)
                    {
                        col.Item().PaddingTop(12).Text(section.Name).FontSize(11).Bold()
                            .FontColor(Colors.Blue.Darken2);

                        if (section.Headers.Count == 0 && section.Rows.Count == 0)
                            continue;

                        col.Item().PaddingTop(4).Table(table =>
                        {
                            var colCount = Math.Max(section.Headers.Count, section.Rows.FirstOrDefault()?.Count ?? 1);

                            table.ColumnsDefinition(columns =>
                            {
                                for (var i = 0; i < colCount; i++)
                                    columns.RelativeColumn();
                            });

                            if (section.Headers.Count > 0)
                            {
                                foreach (var header in section.Headers)
                                {
                                    table.Cell()
                                        .Background(Colors.Grey.Lighten3)
                                        .Padding(3)
                                        .Text(header).FontSize(8).Bold();
                                }
                            }

                            for (var r = 0; r < section.Rows.Count; r++)
                            {
                                var row = section.Rows[r];
                                var bg = r % 2 == 1 ? Colors.Grey.Lighten5 : Colors.White;

                                for (var c = 0; c < colCount; c++)
                                {
                                    var value = c < row.Count ? row[c] : "";
                                    table.Cell()
                                        .Background(bg)
                                        .Padding(3)
                                        .Text(value).FontSize(8);
                                }
                            }
                        });
                    }

                    if (sections.Count == 0)
                    {
                        col.Item().PaddingTop(20).Text("No data found in IIF file.")
                            .FontSize(10).Italic().FontColor(Colors.Grey.Medium);
                    }
                });

                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        });

        return document.GeneratePdf();
    }

    private static void TrimTrailingEmptyColumns(List<IifSection> sections)
    {
        foreach (var section in sections)
        {
            if (section.Headers.Count == 0) continue;

            var totalCols = section.Headers.Count;
            var lastUsed = -1;

            // Find the last column index that has any non-empty value across all rows
            for (var c = totalCols - 1; c >= 0; c--)
            {
                if (!string.IsNullOrWhiteSpace(section.Headers[c]))
                {
                    lastUsed = c;
                    break;
                }

                var hasData = section.Rows.Any(row => c < row.Count && !string.IsNullOrWhiteSpace(row[c]));
                if (hasData)
                {
                    lastUsed = c;
                    break;
                }
            }

            var keepCount = lastUsed + 1;
            if (keepCount >= totalCols) continue;
            if (keepCount == 0) keepCount = 1;

            section.Headers = section.Headers.Take(keepCount).ToList();
            for (var r = 0; r < section.Rows.Count; r++)
            {
                section.Rows[r] = section.Rows[r].Take(keepCount).ToList();
            }
        }
    }

    private class IifSection
    {
        public string Name { get; set; } = "";
        public List<string> Headers { get; set; } = [];
        public List<List<string>> Rows { get; set; } = [];
    }
}
