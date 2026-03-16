using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInternalPurchaseOrderStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "status",
                table: "PurchaseOrders");

            migrationBuilder.AddColumn<int>(
                name: "internal_status_id",
                table: "PurchaseOrders",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "qb_status",
                table: "PurchaseOrders",
                type: "TEXT",
                nullable: false,
                defaultValue: "Not Found");

            migrationBuilder.CreateTable(
                name: "PurchaseOrderStatuses",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    color = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "#6b7280"),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PurchaseOrderStatuses", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PurchaseOrders_internal_status_id",
                table: "PurchaseOrders",
                column: "internal_status_id");

            migrationBuilder.AddForeignKey(
                name: "FK_PurchaseOrders_PurchaseOrderStatuses_internal_status_id",
                table: "PurchaseOrders",
                column: "internal_status_id",
                principalTable: "PurchaseOrderStatuses",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_PurchaseOrders_PurchaseOrderStatuses_internal_status_id",
                table: "PurchaseOrders");

            migrationBuilder.DropTable(
                name: "PurchaseOrderStatuses");

            migrationBuilder.DropIndex(
                name: "IX_PurchaseOrders_internal_status_id",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "internal_status_id",
                table: "PurchaseOrders");

            migrationBuilder.DropColumn(
                name: "qb_status",
                table: "PurchaseOrders");

            migrationBuilder.AddColumn<string>(
                name: "status",
                table: "PurchaseOrders",
                type: "TEXT",
                nullable: false,
                defaultValue: "Open");
        }
    }
}
