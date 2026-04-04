using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectAddonAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop old addon tables unconditionally — no real data exists yet and the
            // schema has changed (project_id → client_id FK swap). Recreating clean
            // avoids SQLite FK constraint failures when copying rows between schemas.
            migrationBuilder.Sql("DROP TABLE IF EXISTS \"ClientAddonPlans\";");
            migrationBuilder.Sql("DROP TABLE IF EXISTS \"ClientAddons\";");

            migrationBuilder.CreateTable(
                name: "ClientAddons",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    client_id = table.Column<int>(type: "INTEGER", nullable: false),
                    code = table.Column<string>(type: "TEXT", nullable: false),
                    description = table.Column<string>(type: "TEXT", nullable: false),
                    notes = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientAddons", x => x.id);
                    table.ForeignKey(
                        name: "FK_ClientAddons_Clients_client_id",
                        column: x => x.client_id,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectAddonAssignments",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    addon_id = table.Column<int>(type: "INTEGER", nullable: false),
                    project_id = table.Column<int>(type: "INTEGER", nullable: false),
                    price = table.Column<decimal>(type: "decimal(18,2)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectAddonAssignments", x => x.id);
                    table.ForeignKey(
                        name: "FK_ProjectAddonAssignments_ClientAddons_addon_id",
                        column: x => x.addon_id,
                        principalTable: "ClientAddons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectAddonAssignments_Projects_project_id",
                        column: x => x.project_id,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClientAddons_client_id_code",
                table: "ClientAddons",
                columns: new[] { "client_id", "code" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAddonAssignments_addon_id_project_id",
                table: "ProjectAddonAssignments",
                columns: new[] { "addon_id", "project_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProjectAddonAssignments_project_id",
                table: "ProjectAddonAssignments",
                column: "project_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ProjectAddonAssignments");
            migrationBuilder.DropTable(name: "ClientAddons");
        }
    }
}
