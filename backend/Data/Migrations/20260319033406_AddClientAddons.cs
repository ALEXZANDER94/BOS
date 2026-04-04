using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddClientAddons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop old tables if they exist from a previous migration with the wrong schema
            migrationBuilder.Sql("DROP TABLE IF EXISTS \"ClientAddonPlans\";");
            migrationBuilder.Sql("DROP TABLE IF EXISTS \"ClientAddons\";");

            migrationBuilder.CreateTable(
                name: "ClientAddons",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    project_id = table.Column<int>(type: "INTEGER", nullable: false),
                    code = table.Column<string>(type: "TEXT", nullable: false),
                    description = table.Column<string>(type: "TEXT", nullable: false),
                    notes = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientAddons", x => x.id);
                    table.ForeignKey(
                        name: "FK_ClientAddons_Projects_project_id",
                        column: x => x.project_id,
                        principalTable: "Projects",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClientAddonPlans",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    addon_id = table.Column<int>(type: "INTEGER", nullable: false),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClientAddonPlans", x => x.id);
                    table.ForeignKey(
                        name: "FK_ClientAddonPlans_ClientAddons_addon_id",
                        column: x => x.addon_id,
                        principalTable: "ClientAddons",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClientAddonPlans_addon_id",
                table: "ClientAddonPlans",
                column: "addon_id");

            migrationBuilder.CreateIndex(
                name: "IX_ClientAddons_project_id_code",
                table: "ClientAddons",
                columns: new[] { "project_id", "code" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClientAddonPlans");

            migrationBuilder.DropTable(
                name: "ClientAddons");
        }
    }
}
