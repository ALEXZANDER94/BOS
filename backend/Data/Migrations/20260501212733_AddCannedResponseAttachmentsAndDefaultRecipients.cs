using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCannedResponseAttachmentsAndDefaultRecipients : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsShared",
                table: "CannedResponses");

            migrationBuilder.RenameColumn(
                name: "OwnerUserEmail",
                table: "CannedResponses",
                newName: "CreatedByUserEmail");

            migrationBuilder.AddColumn<string>(
                name: "DefaultBcc",
                table: "CannedResponses",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DefaultCc",
                table: "CannedResponses",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DefaultTo",
                table: "CannedResponses",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CannedResponseAttachments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    CannedResponseId = table.Column<int>(type: "INTEGER", nullable: false),
                    FileName = table.Column<string>(type: "TEXT", nullable: false),
                    StoredFileName = table.Column<string>(type: "TEXT", nullable: false),
                    ContentType = table.Column<string>(type: "TEXT", nullable: false),
                    FileSize = table.Column<long>(type: "INTEGER", nullable: false),
                    UploadedByEmail = table.Column<string>(type: "TEXT", nullable: false),
                    UploadedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CannedResponseAttachments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CannedResponseAttachments_CannedResponses_CannedResponseId",
                        column: x => x.CannedResponseId,
                        principalTable: "CannedResponses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CannedResponseAttachments_CannedResponseId",
                table: "CannedResponseAttachments",
                column: "CannedResponseId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CannedResponseAttachments");

            migrationBuilder.DropColumn(
                name: "DefaultBcc",
                table: "CannedResponses");

            migrationBuilder.DropColumn(
                name: "DefaultCc",
                table: "CannedResponses");

            migrationBuilder.DropColumn(
                name: "DefaultTo",
                table: "CannedResponses");

            migrationBuilder.RenameColumn(
                name: "CreatedByUserEmail",
                table: "CannedResponses",
                newName: "OwnerUserEmail");

            migrationBuilder.AddColumn<bool>(
                name: "IsShared",
                table: "CannedResponses",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }
    }
}
