using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectQbEstimateInvoiceLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "qb_customer_id",
                table: "Clients",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "qb_customer_name",
                table: "Clients",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProjectQbEstimateLinks",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    project_id = table.Column<int>(type: "INTEGER", nullable: false),
                    qb_estimate_id = table.Column<string>(type: "TEXT", nullable: false),
                    linked_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectQbEstimateLinks", x => x.id);
                    table.ForeignKey(
                        name: "FK_ProjectQbEstimateLinks_Projects_project_id",
                        column: x => x.project_id,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectQbInvoiceLinks",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    project_id = table.Column<int>(type: "INTEGER", nullable: false),
                    qb_invoice_id = table.Column<string>(type: "TEXT", nullable: false),
                    from_estimate_id = table.Column<string>(type: "TEXT", nullable: true),
                    linked_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectQbInvoiceLinks", x => x.id);
                    table.ForeignKey(
                        name: "FK_ProjectQbInvoiceLinks_Projects_project_id",
                        column: x => x.project_id,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProjectQbEstimateLinks_project_id",
                table: "ProjectQbEstimateLinks",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectQbEstimateLinks_qb_estimate_id",
                table: "ProjectQbEstimateLinks",
                column: "qb_estimate_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectQbInvoiceLinks_project_id",
                table: "ProjectQbInvoiceLinks",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectQbInvoiceLinks_qb_invoice_id",
                table: "ProjectQbInvoiceLinks",
                column: "qb_invoice_id",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProjectQbEstimateLinks");

            migrationBuilder.DropTable(
                name: "ProjectQbInvoiceLinks");

            migrationBuilder.DropColumn(
                name: "qb_customer_id",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "qb_customer_name",
                table: "Clients");
        }
    }
}
