using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUnitMetricsAddGlossaryUnitStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UnitMetrics");

            migrationBuilder.DropColumn(
                name: "UnitMetric",
                table: "GlossaryUnits");

            migrationBuilder.DropColumn(
                name: "col_unit_metric",
                table: "ComparisonCriteria");

            migrationBuilder.AddColumn<int>(
                name: "StatusId",
                table: "GlossaryUnits",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "GlossaryUnitStatuses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Color = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "#6b7280"),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GlossaryUnitStatuses", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GlossaryUnits_StatusId",
                table: "GlossaryUnits",
                column: "StatusId");

            migrationBuilder.CreateIndex(
                name: "IX_GlossaryUnitStatuses_Name",
                table: "GlossaryUnitStatuses",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_GlossaryUnits_GlossaryUnitStatuses_StatusId",
                table: "GlossaryUnits",
                column: "StatusId",
                principalTable: "GlossaryUnitStatuses",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GlossaryUnits_GlossaryUnitStatuses_StatusId",
                table: "GlossaryUnits");

            migrationBuilder.DropTable(
                name: "GlossaryUnitStatuses");

            migrationBuilder.DropIndex(
                name: "IX_GlossaryUnits_StatusId",
                table: "GlossaryUnits");

            migrationBuilder.DropColumn(
                name: "StatusId",
                table: "GlossaryUnits");

            migrationBuilder.AddColumn<string>(
                name: "UnitMetric",
                table: "GlossaryUnits",
                type: "TEXT",
                nullable: false,
                defaultValue: "E");

            migrationBuilder.AddColumn<string>(
                name: "col_unit_metric",
                table: "ComparisonCriteria",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "UnitMetrics",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    description = table.Column<string>(type: "TEXT", nullable: false, defaultValue: ""),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    symbol = table.Column<string>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UnitMetrics", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "UnitMetrics",
                columns: new[] { "Id", "CreatedAt", "description", "name", "symbol", "UpdatedAt" },
                values: new object[,]
                {
                    { 1, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "Single unit", "Each", "E", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) },
                    { 2, new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "A case of multiple units", "Case", "C", new DateTime(2026, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc) }
                });

            migrationBuilder.CreateIndex(
                name: "IX_UnitMetrics_Symbol",
                table: "UnitMetrics",
                column: "symbol",
                unique: true);
        }
    }
}
