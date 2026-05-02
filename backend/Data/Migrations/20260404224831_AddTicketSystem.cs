using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddTicketSystem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "related_ticket_id",
                table: "Notifications",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TicketCategories",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    color = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "#6b7280")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketCategories", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "TicketStatuses",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    color = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "#6b7280"),
                    is_default = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    is_closed = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    display_order = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketStatuses", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "Tickets",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    title = table.Column<string>(type: "TEXT", nullable: false),
                    description = table.Column<string>(type: "TEXT", nullable: false),
                    priority = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "Medium"),
                    category_id = table.Column<int>(type: "INTEGER", nullable: true),
                    status_id = table.Column<int>(type: "INTEGER", nullable: false),
                    created_by_email = table.Column<string>(type: "TEXT", nullable: false),
                    assigned_to_email = table.Column<string>(type: "TEXT", nullable: true),
                    project_id = table.Column<int>(type: "INTEGER", nullable: true),
                    linked_email_message_id = table.Column<string>(type: "TEXT", nullable: true),
                    due_date = table.Column<DateTime>(type: "TEXT", nullable: true),
                    overdue_notified_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    closed_at = table.Column<DateTime>(type: "TEXT", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tickets", x => x.id);
                    table.ForeignKey(
                        name: "FK_Tickets_Projects_project_id",
                        column: x => x.project_id,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Tickets_TicketCategories_category_id",
                        column: x => x.category_id,
                        principalTable: "TicketCategories",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Tickets_TicketStatuses_status_id",
                        column: x => x.status_id,
                        principalTable: "TicketStatuses",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TicketAttachments",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ticket_id = table.Column<int>(type: "INTEGER", nullable: false),
                    file_name = table.Column<string>(type: "TEXT", nullable: false),
                    stored_file_name = table.Column<string>(type: "TEXT", nullable: false),
                    content_type = table.Column<string>(type: "TEXT", nullable: false),
                    file_size = table.Column<long>(type: "INTEGER", nullable: false),
                    uploaded_by_email = table.Column<string>(type: "TEXT", nullable: false),
                    uploaded_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketAttachments", x => x.id);
                    table.ForeignKey(
                        name: "FK_TicketAttachments_Tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalTable: "Tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TicketComments",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ticket_id = table.Column<int>(type: "INTEGER", nullable: false),
                    author_email = table.Column<string>(type: "TEXT", nullable: false),
                    body = table.Column<string>(type: "TEXT", nullable: false),
                    is_private = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    is_deleted = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketComments", x => x.id);
                    table.ForeignKey(
                        name: "FK_TicketComments_Tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalTable: "Tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TicketHistory",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ticket_id = table.Column<int>(type: "INTEGER", nullable: false),
                    changed_by_email = table.Column<string>(type: "TEXT", nullable: false),
                    field_changed = table.Column<string>(type: "TEXT", nullable: false),
                    old_value = table.Column<string>(type: "TEXT", nullable: true),
                    new_value = table.Column<string>(type: "TEXT", nullable: true),
                    changed_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketHistory", x => x.id);
                    table.ForeignKey(
                        name: "FK_TicketHistory_Tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalTable: "Tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "TicketWatchers",
                columns: table => new
                {
                    ticket_id = table.Column<int>(type: "INTEGER", nullable: false),
                    user_email = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TicketWatchers", x => new { x.ticket_id, x.user_email });
                    table.ForeignKey(
                        name: "FK_TicketWatchers_Tickets_ticket_id",
                        column: x => x.ticket_id,
                        principalTable: "Tickets",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TicketAttachments_ticket_id",
                table: "TicketAttachments",
                column: "ticket_id");

            migrationBuilder.CreateIndex(
                name: "IX_TicketCategories_name",
                table: "TicketCategories",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TicketComments_ticket_id",
                table: "TicketComments",
                column: "ticket_id");

            migrationBuilder.CreateIndex(
                name: "IX_TicketHistory_ticket_id",
                table: "TicketHistory",
                column: "ticket_id");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_assigned_to_email",
                table: "Tickets",
                column: "assigned_to_email");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_category_id",
                table: "Tickets",
                column: "category_id");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_created_by_email",
                table: "Tickets",
                column: "created_by_email");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_project_id",
                table: "Tickets",
                column: "project_id");

            migrationBuilder.CreateIndex(
                name: "IX_Tickets_status_id",
                table: "Tickets",
                column: "status_id");

            migrationBuilder.CreateIndex(
                name: "IX_TicketStatuses_name",
                table: "TicketStatuses",
                column: "name",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TicketAttachments");

            migrationBuilder.DropTable(
                name: "TicketComments");

            migrationBuilder.DropTable(
                name: "TicketHistory");

            migrationBuilder.DropTable(
                name: "TicketWatchers");

            migrationBuilder.DropTable(
                name: "Tickets");

            migrationBuilder.DropTable(
                name: "TicketCategories");

            migrationBuilder.DropTable(
                name: "TicketStatuses");

            migrationBuilder.DropColumn(
                name: "related_ticket_id",
                table: "Notifications");
        }
    }
}
