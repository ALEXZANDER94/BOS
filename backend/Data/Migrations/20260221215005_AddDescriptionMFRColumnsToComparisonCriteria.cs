using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDescriptionMFRColumnsToComparisonCriteria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name:      "ColDescription",
                table:     "ComparisonCriteria",
                type:      "TEXT",
                nullable:  true);

            migrationBuilder.AddColumn<string>(
                name:      "ColMFR",
                table:     "ComparisonCriteria",
                type:      "TEXT",
                nullable:  true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name:  "ColDescription",
                table: "ComparisonCriteria");

            migrationBuilder.DropColumn(
                name:  "ColMFR",
                table: "ComparisonCriteria");
        }
    }
}
