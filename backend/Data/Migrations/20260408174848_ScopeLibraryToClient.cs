using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BOS.Backend.Data.Migrations
{
    /// <inheritdoc />
    public partial class ScopeLibraryToClient : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Libraries are now per-client. Any existing rows from earlier testing
            // had no client association, so they are removed before the FK is added.
            // Library upgrades cascade-delete via the join table.
            migrationBuilder.Sql("DELETE FROM Libraries;");

            migrationBuilder.AddColumn<int>(
                name: "client_id",
                table: "Libraries",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_Libraries_client_id",
                table: "Libraries",
                column: "client_id");

            migrationBuilder.AddForeignKey(
                name: "FK_Libraries_Clients_client_id",
                table: "Libraries",
                column: "client_id",
                principalTable: "Clients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Libraries_Clients_client_id",
                table: "Libraries");

            migrationBuilder.DropIndex(
                name: "IX_Libraries_client_id",
                table: "Libraries");

            migrationBuilder.DropColumn(
                name: "client_id",
                table: "Libraries");
        }
    }
}
