using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class ReplaceMapsetsWithComparisonCriteria : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SupplierMapsets");

            migrationBuilder.CreateTable(
                name: "ComparisonCriteria",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    supplier_id = table.Column<int>(type: "INTEGER", nullable: false),
                    match_column = table.Column<string>(type: "TEXT", nullable: false),
                    Format = table.Column<string>(type: "TEXT", nullable: false),
                    col_price = table.Column<string>(type: "TEXT", nullable: false),
                    col_unit_metric = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ComparisonCriteria", x => x.id);
                    table.ForeignKey(
                        name: "FK_ComparisonCriteria_Suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "Suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ComparisonCriteria_supplier_id",
                table: "ComparisonCriteria",
                column: "supplier_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ComparisonCriteria");

            migrationBuilder.CreateTable(
                name: "SupplierMapsets",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    supplier_id = table.Column<int>(type: "INTEGER", nullable: false),
                    ColCatalogNumber = table.Column<string>(type: "TEXT", nullable: false),
                    ColDescription = table.Column<string>(type: "TEXT", nullable: false),
                    ColMfr = table.Column<string>(type: "TEXT", nullable: false),
                    ColPrice = table.Column<string>(type: "TEXT", nullable: false),
                    ColUnitMetric = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SupplierMapsets", x => x.id);
                    table.ForeignKey(
                        name: "FK_SupplierMapsets_Suppliers_supplier_id",
                        column: x => x.supplier_id,
                        principalTable: "Suppliers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SupplierMapsets_supplier_id",
                table: "SupplierMapsets",
                column: "supplier_id",
                unique: true);
        }
    }
}
