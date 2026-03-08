using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using BOS.Backend.DTOs;

namespace BOS.Backend.Services;

public interface IReportService
{
    byte[] GenerateComparisonReport(List<ComparisonResultDto> results, bool includeNewItems = false);
}

public class ReportService : IReportService
{
    private static readonly System.Globalization.CultureInfo UsCulture =
        new("en-US");

    private static string Fmt(decimal v)    => v.ToString("C", UsCulture);
    private static string FmtPct(decimal v) =>
        $"{(v >= 0 ? "+" : "")}{v:F2}%";

    public byte[] GenerateComparisonReport(List<ComparisonResultDto> results, bool includeNewItems = false)
    {
        // ── Filter: overpriced items always included; new items optional ───────
        var filtered = results
            .Where(r => (r.IsOverpriced && !r.IsNewItem) || (includeNewItems && r.IsNewItem))
            .ToList();

        var summary = new
        {
            Total      = filtered.Count,
            Overpriced = filtered.Count(r => r.IsOverpriced && !r.IsNewItem),
            NewItems   = filtered.Count(r => r.IsNewItem),
            NetImpact  = filtered.Sum(r => r.DollarDifference),
        };

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.Letter.Landscape());
                page.Margin(1.5f, Unit.Centimetre);
                page.DefaultTextStyle(t => t.FontSize(9).FontFamily(Fonts.Arial));

                // ── Header ────────────────────────────────────────────────
                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem()
                            .Text("BOS — Price Comparison Report")
                            .FontSize(15).Bold();

                        row.ConstantItem(180).AlignRight()
                            .Text(DateTime.Now.ToString("MMMM d, yyyy"))
                            .FontSize(9).FontColor(Colors.Grey.Medium);
                    });

                    col.Item().PaddingTop(4)
                        .BorderBottom(1).BorderColor(Colors.Grey.Lighten2);
                });

                // ── Content ───────────────────────────────────────────────
                page.Content().Column(col =>
                {
                    // Summary boxes
                    col.Item().PaddingTop(10).Row(row =>
                    {
                        void SummaryBox(string label, string value, string? color = null)
                        {
                            row.RelativeItem()
                                .Border(1).BorderColor(Colors.Grey.Lighten2)
                                .Padding(8)
                                .Column(c =>
                                {
                                    c.Item().Text(label).FontSize(8).FontColor(Colors.Grey.Medium);
                                    c.Item().Text(value).FontSize(14).Bold()
                                        .FontColor(color ?? Colors.Black);
                                });
                        }

                        SummaryBox("Items in Report", summary.Total.ToString());
                        SummaryBox("Overpriced Items",  summary.Overpriced.ToString(), Colors.Red.Medium);
                        SummaryBox("New / Unknown Items", summary.NewItems.ToString(), Colors.Orange.Medium);
                        SummaryBox(
                            "Net Dollar Impact",
                            Fmt(summary.NetImpact),
                            summary.NetImpact > 0 ? Colors.Red.Medium : Colors.Green.Medium
                        );
                    });

                    // Data table
                    col.Item().PaddingTop(14).Table(table =>
                    {
                        // Column widths — 11 columns on landscape Letter (792pt - 2×42.5pt margins ≈ 707pt usable).
                        // Constant columns sum to ~567pt; Description (RelativeColumn) gets ~140pt.
                        table.ColumnsDefinition(cols =>
                        {
                            cols.ConstantColumn(58);  // Invoice #
                            cols.ConstantColumn(68);  // Catalog #
                            cols.RelativeColumn(3);   // Description  (~140pt)
                            cols.ConstantColumn(26);  // Qty
                            cols.ConstantColumn(64);  // Master Price/Unit
                            cols.ConstantColumn(64);  // Invoice Price/Unit
                            cols.ConstantColumn(64);  // Exp. Total
                            cols.ConstantColumn(64);  // Invoice Total
                            cols.ConstantColumn(56);  // Diff ($)
                            cols.ConstantColumn(48);  // Diff (%)
                            cols.ConstantColumn(55);  // Status
                        });

                        // Header row
                        table.Header(header =>
                        {
                            void H(string text) =>
                                header.Cell()
                                    .Background(Colors.Grey.Lighten3)
                                    .Padding(5)
                                    .Text(text).Bold().FontSize(8);

                            H("Invoice #"); H("Catalog #"); H("Description");
                            H("Qty"); H("Master Price/Unit"); H("Invoice Price/Unit");
                            H("Exp. Total"); H("Invoice Total");
                            H("Diff ($)"); H("Diff (%)"); H("Status");
                        });

                        // Data rows
                        foreach (var r in filtered)
                        {
                            string bg = r.IsNewItem
                                ? Colors.Yellow.Lighten4
                                : r.IsOverpriced
                                    ? Colors.Red.Lighten4
                                    : Colors.White;

                            decimal expectedTotal = r.MasterPrice * r.ProposedQuantity;

                            // Null-safe: QuestPDF throws if Text() receives null.
                            void Cell(string? text, bool right = false, string? color = null) =>
                                table.Cell()
                                    .Background(bg)
                                    .BorderBottom(1).BorderColor(Colors.Grey.Lighten3)
                                    .Padding(4)
                                    .AlignLeft()
                                    .Text(text ?? string.Empty)
                                    .FontColor(color ?? Colors.Black);

                            Cell(r.InvoiceNumber);
                            Cell(r.CatalogNumber);
                            Cell(r.Description);
                            Cell(r.ProposedQuantity != 1m ? r.ProposedQuantity.ToString("G") : "1");
                            Cell(r.MasterPrice > 0 ? Fmt(r.MasterPrice) : "—");
                            Cell(r.ProposedPrice > 0 ? Fmt(r.ProposedPrice) : "—");
                            Cell(r.MasterPrice > 0 ? Fmt(expectedTotal) : "—");
                            Cell(r.ProposedTotal > 0 ? Fmt(r.ProposedTotal) : "—");
                            Cell(
                                r.DollarDifference != 0 ? Fmt(r.DollarDifference) : "—",
                                right: true,
                                color: r.DollarDifference > 0 ? Colors.Red.Medium : Colors.Black
                            );
                            Cell(
                                r.MasterPrice > 0 ? FmtPct(r.PercentDifference) : "—",
                                right: true,
                                color: r.PercentDifference > 0 ? Colors.Red.Medium : Colors.Black
                            );
                            Cell(
                                r.IsNewItem    ? "New Item"  :
                                r.IsOverpriced ? "Overpriced" : "OK"
                            );
                        }
                    });
                });

                // ── Footer ────────────────────────────────────────────────
                page.Footer().AlignCenter().Text(t =>
                {
                    t.Span("Generated by BOS  ·  Page ");
                    t.CurrentPageNumber();
                    t.Span(" of ");
                    t.TotalPages();
                });
            });
        });

        return document.GeneratePdf();
    }
}
