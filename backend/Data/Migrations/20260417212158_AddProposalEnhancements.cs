using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CreatedByEmail",
                table: "Proposals",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "Deadline",
                table: "Proposals",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeadlineNotifiedAt",
                table: "Proposals",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "DeadlineReminderDays",
                table: "Proposals",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "Notes",
                table: "Proposals",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "PdfContentLength",
                table: "Proposals",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "PdfFileName",
                table: "Proposals",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PdfStoredFileName",
                table: "Proposals",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VisibleFields",
                table: "Proposals",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "RelatedProposalId",
                table: "Notifications",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProposalPricings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ProposalId = table.Column<int>(type: "INTEGER", nullable: false),
                    Label = table.Column<string>(type: "TEXT", nullable: false),
                    PricePerSqFt = table.Column<decimal>(type: "TEXT", nullable: false),
                    TotalAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                    Notes = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalPricings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProposalPricings_Proposals_ProposalId",
                        column: x => x.ProposalId,
                        principalTable: "Proposals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProposalPricings_ProposalId",
                table: "ProposalPricings",
                column: "ProposalId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProposalPricings");

            migrationBuilder.DropColumn(
                name: "CreatedByEmail",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "Deadline",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "DeadlineNotifiedAt",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "DeadlineReminderDays",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "Notes",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "PdfContentLength",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "PdfFileName",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "PdfStoredFileName",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "VisibleFields",
                table: "Proposals");

            migrationBuilder.DropColumn(
                name: "RelatedProposalId",
                table: "Notifications");
        }
    }
}
