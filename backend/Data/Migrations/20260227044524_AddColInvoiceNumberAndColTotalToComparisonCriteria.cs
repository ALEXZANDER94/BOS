using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddColInvoiceNumberAndColTotalToComparisonCriteria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ColInvoiceNumber",
                table: "ComparisonCriteria",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ColTotal",
                table: "ComparisonCriteria",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ColInvoiceNumber",
                table: "ComparisonCriteria");

            migrationBuilder.DropColumn(
                name: "ColTotal",
                table: "ComparisonCriteria");
        }
    }
}
