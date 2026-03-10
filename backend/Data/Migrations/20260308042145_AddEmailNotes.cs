using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailNotes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EmailNotes",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    message_id = table.Column<string>(type: "TEXT", nullable: false),
                    user_email = table.Column<string>(type: "TEXT", nullable: false),
                    note_text = table.Column<string>(type: "TEXT", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EmailNotes", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EmailNotes_message_id",
                table: "EmailNotes",
                column: "message_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EmailNotes");
        }
    }
}
