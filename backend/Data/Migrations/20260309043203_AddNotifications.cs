using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddNotifications : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    recipient_email = table.Column<string>(type: "TEXT", nullable: false),
                    type = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "mention"),
                    title = table.Column<string>(type: "TEXT", nullable: false),
                    body = table.Column<string>(type: "TEXT", nullable: false),
                    is_read = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    related_message_id = table.Column<string>(type: "TEXT", nullable: true),
                    related_note_id = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Notifications_recipient_email_is_read_created_at",
                table: "Notifications",
                columns: new[] { "recipient_email", "is_read", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Notifications");
        }
    }
}
