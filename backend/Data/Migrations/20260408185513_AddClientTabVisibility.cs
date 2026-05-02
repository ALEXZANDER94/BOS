using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddClientTabVisibility : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "ShowActivity",
                table: "Clients",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowContacts",
                table: "Clients",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowLibraries",
                table: "Clients",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowOptions",
                table: "Clients",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowProjects",
                table: "Clients",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "ShowProposals",
                table: "Clients",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ShowActivity",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ShowContacts",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ShowLibraries",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ShowOptions",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ShowProjects",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ShowProposals",
                table: "Clients");
        }
    }
}
