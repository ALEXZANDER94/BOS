using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSupplierAndScopeGlossary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Step 1: Create Suppliers table first (FK target must exist before referencing column)
            migrationBuilder.CreateTable(
                name: "Suppliers",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Domain = table.Column<string>(type: "TEXT", nullable: false),
                    Website = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Suppliers", x => x.id);
                });

            // Step 2: Seed a "Migration Supplier" row with id=1 so existing GlossaryUnit
            // rows have a valid FK target when the supplier_id column is added below.
            // This supplier can be renamed or deleted after migrating real data.
            migrationBuilder.Sql(
                "INSERT INTO Suppliers (id, Name, Domain, Website, CreatedAt, UpdatedAt) " +
                "VALUES (1, 'Migration Supplier', '', '', datetime('now'), datetime('now'))");

            // Step 3: Drop the old single-column unique index before adding the new composite one
            migrationBuilder.DropIndex(
                name: "IX_GlossaryUnits_CatalogNumber",
                table: "GlossaryUnits");

            // Step 4: Add supplier_id column with DEFAULT 1 so all existing rows point to
            // the seeded Migration Supplier. SQLite allows NOT NULL + DEFAULT on existing tables.
            migrationBuilder.AddColumn<int>(
                name: "supplier_id",
                table: "GlossaryUnits",
                type: "INTEGER",
                nullable: false,
                defaultValue: 1);

            // Step 5: Create composite unique index (SupplierId + CatalogNumber)
            migrationBuilder.CreateIndex(
                name: "IX_GlossaryUnits_supplier_id_CatalogNumber",
                table: "GlossaryUnits",
                columns: new[] { "supplier_id", "CatalogNumber" },
                unique: true);

            // Step 6: Add the FK constraint pointing supplier_id → Suppliers.id with CASCADE
            migrationBuilder.AddForeignKey(
                name: "FK_GlossaryUnits_Suppliers_supplier_id",
                table: "GlossaryUnits",
                column: "supplier_id",
                principalTable: "Suppliers",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GlossaryUnits_Suppliers_supplier_id",
                table: "GlossaryUnits");

            migrationBuilder.DropTable(
                name: "Suppliers");

            migrationBuilder.DropIndex(
                name: "IX_GlossaryUnits_supplier_id_CatalogNumber",
                table: "GlossaryUnits");

            migrationBuilder.DropColumn(
                name: "supplier_id",
                table: "GlossaryUnits");

            migrationBuilder.CreateIndex(
                name: "IX_GlossaryUnits_CatalogNumber",
                table: "GlossaryUnits",
                column: "CatalogNumber",
                unique: true);
        }
    }
}
