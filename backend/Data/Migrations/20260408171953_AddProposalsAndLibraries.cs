using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddProposalsAndLibraries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "address",
                table: "Projects",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "buyer_upgrades",
                table: "Projects",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "city",
                table: "Projects",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "product_standards",
                table: "Projects",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "revisions_after_launch",
                table: "Projects",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "source_library_id",
                table: "Projects",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "source_proposal_id",
                table: "Projects",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "version",
                table: "Projects",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "plan_id",
                table: "Lots",
                type: "INTEGER",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CustomUpgrades",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    client_id = table.Column<int>(type: "INTEGER", nullable: true),
                    is_global = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    description = table.Column<string>(type: "TEXT", nullable: false, defaultValue: ""),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CustomUpgrades", x => x.id);
                    table.ForeignKey(
                        name: "FK_CustomUpgrades_Clients_client_id",
                        column: x => x.client_id,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Libraries",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    title = table.Column<string>(type: "TEXT", nullable: false),
                    description = table.Column<string>(type: "TEXT", nullable: false, defaultValue: ""),
                    stored_file_name = table.Column<string>(type: "TEXT", nullable: false),
                    original_file_name = table.Column<string>(type: "TEXT", nullable: false),
                    content_length = table.Column<long>(type: "INTEGER", nullable: false),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Libraries", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "Plans",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    building_id = table.Column<int>(type: "INTEGER", nullable: false),
                    plan_name = table.Column<string>(type: "TEXT", nullable: false),
                    square_footage = table.Column<int>(type: "INTEGER", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Plans", x => x.id);
                    table.ForeignKey(
                        name: "FK_Plans_Buildings_building_id",
                        column: x => x.building_id,
                        principalTable: "Buildings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProjectCustomUpgrades",
                columns: table => new
                {
                    project_id = table.Column<int>(type: "INTEGER", nullable: false),
                    custom_upgrade_id = table.Column<int>(type: "INTEGER", nullable: false),
                    is_enabled = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProjectCustomUpgrades", x => new { x.project_id, x.custom_upgrade_id });
                    table.ForeignKey(
                        name: "FK_ProjectCustomUpgrades_CustomUpgrades_custom_upgrade_id",
                        column: x => x.custom_upgrade_id,
                        principalTable: "CustomUpgrades",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProjectCustomUpgrades_Projects_project_id",
                        column: x => x.project_id,
                        principalTable: "Projects",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LibraryUpgrades",
                columns: table => new
                {
                    library_id = table.Column<int>(type: "INTEGER", nullable: false),
                    custom_upgrade_id = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LibraryUpgrades", x => new { x.library_id, x.custom_upgrade_id });
                    table.ForeignKey(
                        name: "FK_LibraryUpgrades_CustomUpgrades_custom_upgrade_id",
                        column: x => x.custom_upgrade_id,
                        principalTable: "CustomUpgrades",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_LibraryUpgrades_Libraries_library_id",
                        column: x => x.library_id,
                        principalTable: "Libraries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Proposals",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    client_id = table.Column<int>(type: "INTEGER", nullable: false),
                    name = table.Column<string>(type: "TEXT", nullable: false),
                    type = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "SingleFamily"),
                    status = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "Draft"),
                    converted_project_id = table.Column<int>(type: "INTEGER", nullable: true),
                    created_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    updated_at = table.Column<DateTime>(type: "TEXT", nullable: false),
                    library_id = table.Column<int>(type: "INTEGER", nullable: true),
                    address = table.Column<string>(type: "TEXT", nullable: false, defaultValue: ""),
                    city = table.Column<string>(type: "TEXT", nullable: false, defaultValue: ""),
                    product_standards = table.Column<string>(type: "TEXT", nullable: false, defaultValue: ""),
                    version = table.Column<string>(type: "TEXT", nullable: false, defaultValue: ""),
                    buyer_upgrades = table.Column<string>(type: "TEXT", nullable: false, defaultValue: ""),
                    revisions_after_launch = table.Column<string>(type: "TEXT", nullable: false, defaultValue: "")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Proposals", x => x.id);
                    table.ForeignKey(
                        name: "FK_Proposals_Clients_client_id",
                        column: x => x.client_id,
                        principalTable: "Clients",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Proposals_Libraries_library_id",
                        column: x => x.library_id,
                        principalTable: "Libraries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ProposalBuildings",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    proposal_id = table.Column<int>(type: "INTEGER", nullable: false),
                    name = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalBuildings", x => x.id);
                    table.ForeignKey(
                        name: "FK_ProposalBuildings_Proposals_proposal_id",
                        column: x => x.proposal_id,
                        principalTable: "Proposals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProposalCustomUpgrades",
                columns: table => new
                {
                    proposal_id = table.Column<int>(type: "INTEGER", nullable: false),
                    custom_upgrade_id = table.Column<int>(type: "INTEGER", nullable: false),
                    is_enabled = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalCustomUpgrades", x => new { x.proposal_id, x.custom_upgrade_id });
                    table.ForeignKey(
                        name: "FK_ProposalCustomUpgrades_CustomUpgrades_custom_upgrade_id",
                        column: x => x.custom_upgrade_id,
                        principalTable: "CustomUpgrades",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProposalCustomUpgrades_Proposals_proposal_id",
                        column: x => x.proposal_id,
                        principalTable: "Proposals",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProposalPlans",
                columns: table => new
                {
                    id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    proposal_building_id = table.Column<int>(type: "INTEGER", nullable: false),
                    plan_name = table.Column<string>(type: "TEXT", nullable: false),
                    square_footage = table.Column<int>(type: "INTEGER", nullable: false),
                    amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProposalPlans", x => x.id);
                    table.ForeignKey(
                        name: "FK_ProposalPlans_ProposalBuildings_proposal_building_id",
                        column: x => x.proposal_building_id,
                        principalTable: "ProposalBuildings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Projects_source_library_id",
                table: "Projects",
                column: "source_library_id");

            migrationBuilder.CreateIndex(
                name: "IX_Projects_source_proposal_id",
                table: "Projects",
                column: "source_proposal_id");

            migrationBuilder.CreateIndex(
                name: "IX_Lots_plan_id",
                table: "Lots",
                column: "plan_id");

            migrationBuilder.CreateIndex(
                name: "IX_CustomUpgrades_client_id",
                table: "CustomUpgrades",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_CustomUpgrades_is_global",
                table: "CustomUpgrades",
                column: "is_global");

            migrationBuilder.CreateIndex(
                name: "IX_LibraryUpgrades_custom_upgrade_id",
                table: "LibraryUpgrades",
                column: "custom_upgrade_id");

            migrationBuilder.CreateIndex(
                name: "IX_Plans_building_id",
                table: "Plans",
                column: "building_id");

            migrationBuilder.CreateIndex(
                name: "IX_ProjectCustomUpgrades_custom_upgrade_id",
                table: "ProjectCustomUpgrades",
                column: "custom_upgrade_id");

            migrationBuilder.CreateIndex(
                name: "IX_ProposalBuildings_proposal_id",
                table: "ProposalBuildings",
                column: "proposal_id");

            migrationBuilder.CreateIndex(
                name: "IX_ProposalCustomUpgrades_custom_upgrade_id",
                table: "ProposalCustomUpgrades",
                column: "custom_upgrade_id");

            migrationBuilder.CreateIndex(
                name: "IX_ProposalPlans_proposal_building_id",
                table: "ProposalPlans",
                column: "proposal_building_id");

            migrationBuilder.CreateIndex(
                name: "IX_Proposals_client_id",
                table: "Proposals",
                column: "client_id");

            migrationBuilder.CreateIndex(
                name: "IX_Proposals_library_id",
                table: "Proposals",
                column: "library_id");

            migrationBuilder.CreateIndex(
                name: "IX_Proposals_status",
                table: "Proposals",
                column: "status");

            migrationBuilder.AddForeignKey(
                name: "FK_Lots_Plans_plan_id",
                table: "Lots",
                column: "plan_id",
                principalTable: "Plans",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Libraries_source_library_id",
                table: "Projects",
                column: "source_library_id",
                principalTable: "Libraries",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Projects_Proposals_source_proposal_id",
                table: "Projects",
                column: "source_proposal_id",
                principalTable: "Proposals",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Lots_Plans_plan_id",
                table: "Lots");

            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Libraries_source_library_id",
                table: "Projects");

            migrationBuilder.DropForeignKey(
                name: "FK_Projects_Proposals_source_proposal_id",
                table: "Projects");

            migrationBuilder.DropTable(
                name: "LibraryUpgrades");

            migrationBuilder.DropTable(
                name: "Plans");

            migrationBuilder.DropTable(
                name: "ProjectCustomUpgrades");

            migrationBuilder.DropTable(
                name: "ProposalCustomUpgrades");

            migrationBuilder.DropTable(
                name: "ProposalPlans");

            migrationBuilder.DropTable(
                name: "CustomUpgrades");

            migrationBuilder.DropTable(
                name: "ProposalBuildings");

            migrationBuilder.DropTable(
                name: "Proposals");

            migrationBuilder.DropTable(
                name: "Libraries");

            migrationBuilder.DropIndex(
                name: "IX_Projects_source_library_id",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Projects_source_proposal_id",
                table: "Projects");

            migrationBuilder.DropIndex(
                name: "IX_Lots_plan_id",
                table: "Lots");

            migrationBuilder.DropColumn(
                name: "address",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "buyer_upgrades",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "city",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "product_standards",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "revisions_after_launch",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "source_library_id",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "source_proposal_id",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "version",
                table: "Projects");

            migrationBuilder.DropColumn(
                name: "plan_id",
                table: "Lots");
        }
    }
}
