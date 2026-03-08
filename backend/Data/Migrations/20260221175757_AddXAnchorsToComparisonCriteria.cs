using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddXAnchorsToComparisonCriteria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Add optional X-anchor columns to ComparisonCriteria.
            // Nullable REAL (double) — null means "use automatic header-derived position".
            migrationBuilder.AddColumn<double>(
                name: "match_col_x",
                table: "ComparisonCriteria",
                type: "REAL",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "price_col_x",
                table: "ComparisonCriteria",
                type: "REAL",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "match_col_x",
                table: "ComparisonCriteria");

            migrationBuilder.DropColumn(
                name: "price_col_x",
                table: "ComparisonCriteria");
        }
    }
}
