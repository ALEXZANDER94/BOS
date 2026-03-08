// Inspect cell content from the Adobe debug XLSX to understand the match column structure
using ClosedXML.Excel;

var xlsxPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
    "Downloads", "adobe_debug_2026-02-22T00-05-34.xlsx");

Console.WriteLine($"Reading: {xlsxPath}");

using var wb = new XLWorkbook(xlsxPath);
var sheet = wb.Worksheets.First();

// Print rows 12-20, all non-empty cells — show raw value and escape newlines
Console.WriteLine("\nRows 12-20 (all non-empty cells):");
Console.WriteLine(new string('-', 80));
for (int r = 12; r <= 20; r++)
{
    Console.Write($"Row {r}: ");
    var row = sheet.Row(r);
    int lastCol = row.LastCellUsed()?.Address.ColumnNumber ?? 0;
    bool anyPrinted = false;
    for (int c = 1; c <= lastCol; c++)
    {
        var raw = sheet.Cell(r, c).GetString();
        if (!string.IsNullOrEmpty(raw))
        {
            var escaped = raw.Replace("\r\n", "⏎").Replace("\n", "⏎").Replace("\r", "⏎");
            Console.Write($"  col{c}=[{escaped}]");
            anyPrinted = true;
        }
    }
    if (!anyPrinted) Console.Write("  (empty)");
    Console.WriteLine();
}
