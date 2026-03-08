using Microsoft.EntityFrameworkCore;
using BOS.Backend.Models;

namespace BOS.Backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<GlossaryUnit>          GlossaryUnits          => Set<GlossaryUnit>();
    public DbSet<GlossaryUnitStatus>    GlossaryUnitStatuses   => Set<GlossaryUnitStatus>();
    public DbSet<Supplier>              Suppliers               => Set<Supplier>();
    public DbSet<ComparisonCriteria>    ComparisonCriteria      => Set<ComparisonCriteria>();
    public DbSet<AppSettings>           AppSettings             => Set<AppSettings>();

    // CRM
    public DbSet<Client>         Clients         => Set<Client>();
    public DbSet<Contact>        Contacts        => Set<Contact>();
    public DbSet<Project>        Projects        => Set<Project>();
    public DbSet<ProjectContact> ProjectContacts => Set<ProjectContact>();
    public DbSet<ActivityLog>    ActivityLogs    => Set<ActivityLog>();

    // Gmail integration
    public DbSet<UserGoogleToken>     UserGoogleTokens     => Set<UserGoogleToken>();
    public DbSet<EmailCategory>       EmailCategories      => Set<EmailCategory>();
    public DbSet<EmailCategoryStatus> EmailCategoryStatuses => Set<EmailCategoryStatus>();
    public DbSet<EmailAssignment>     EmailAssignments     => Set<EmailAssignment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // ── Supplier ────────────────────────────────────────────────────────────
        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.HasKey(e => e.Id);
            // Use lowercase 'id' as the SQLite column name (user requirement)
            entity.Property(e => e.Id).HasColumnName("id");

            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Domain).IsRequired();
            entity.Property(e => e.Website).IsRequired();
        });

        // ── ComparisonCriteria ───────────────────────────────────────────────────
        modelBuilder.Entity<ComparisonCriteria>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SupplierId).HasColumnName("supplier_id");
            entity.Property(e => e.MatchColumn).HasColumnName("match_column").IsRequired();
            entity.Property(e => e.Format).IsRequired();
            entity.Property(e => e.ColPrice).HasColumnName("col_price").IsRequired();
            entity.Property(e => e.MatchColX).HasColumnName("match_col_x");
            entity.Property(e => e.PriceColX).HasColumnName("price_col_x");

            // One supplier has at most one criteria row
            entity.HasIndex(e => e.SupplierId).IsUnique();

            entity.HasOne(e => e.Supplier)
                  .WithOne(s => s.Criteria)
                  .HasForeignKey<ComparisonCriteria>(e => e.SupplierId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── AppSettings ─────────────────────────────────────────────────────────
        modelBuilder.Entity<AppSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Key).IsRequired();
            // Unique index on Key ensures no duplicate setting names
            entity.HasIndex(e => e.Key).IsUnique();
        });

        // ── GlossaryUnitStatus ───────────────────────────────────────────────────
        modelBuilder.Entity<GlossaryUnitStatus>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Color).IsRequired().HasDefaultValue("#6b7280");
            // Status names are unique (case-insensitive enforced in service layer)
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // ── Client ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<Client>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Status).HasDefaultValue("Active");
        });

        // ── Contact ─────────────────────────────────────────────────────────────
        modelBuilder.Entity<Contact>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ClientId).HasColumnName("client_id");

            entity.HasOne(e => e.Client)
                  .WithMany(c => c.Contacts)
                  .HasForeignKey(e => e.ClientId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Project ─────────────────────────────────────────────────────────────
        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ClientId).HasColumnName("client_id");
            entity.Property(e => e.Status).HasDefaultValue("Active");

            entity.HasOne(e => e.Client)
                  .WithMany(c => c.Projects)
                  .HasForeignKey(e => e.ClientId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ProjectContact (join: Project ↔ Contact, many-to-many) ──────────────
        modelBuilder.Entity<ProjectContact>(entity =>
        {
            entity.HasKey(e => new { e.ProjectId, e.ContactId });

            entity.HasOne(e => e.Project)
                  .WithMany(p => p.ProjectContacts)
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Contact)
                  .WithMany(c => c.ProjectContacts)
                  .HasForeignKey(e => e.ContactId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ActivityLog ─────────────────────────────────────────────────────────
        modelBuilder.Entity<ActivityLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.ClientId).HasColumnName("client_id");
            entity.Property(e => e.Type).HasDefaultValue("Note");

            entity.HasOne(e => e.Client)
                  .WithMany(c => c.ActivityLogs)
                  .HasForeignKey(e => e.ClientId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── UserGoogleToken ──────────────────────────────────────────────────────
        modelBuilder.Entity<UserGoogleToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.UserEmail).IsRequired();
            entity.HasIndex(e => e.UserEmail).IsUnique();
        });

        // ── EmailCategory ────────────────────────────────────────────────────────
        modelBuilder.Entity<EmailCategory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Color).IsRequired().HasDefaultValue("#6b7280");
            entity.Property(e => e.CreatedByUserEmail).IsRequired();
        });

        // ── EmailCategoryStatus ──────────────────────────────────────────────────
        modelBuilder.Entity<EmailCategoryStatus>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Color).IsRequired().HasDefaultValue("#6b7280");
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
            entity.Property(e => e.CreatedByUserEmail).IsRequired();

            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Statuses)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── EmailAssignment ──────────────────────────────────────────────────────
        modelBuilder.Entity<EmailAssignment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.MessageId).IsRequired();
            // One assignment per email message
            entity.HasIndex(e => e.MessageId).IsUnique();
            entity.Property(e => e.AssignedByUserEmail).IsRequired();

            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Assignments)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Status)
                  .WithMany()
                  .HasForeignKey(e => e.StatusId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });

        // ── GlossaryUnit ────────────────────────────────────────────────────────
        modelBuilder.Entity<GlossaryUnit>(entity =>
        {
            entity.HasKey(e => e.Id);

            // FK column named supplier_id in the database (snake_case per user requirement).
            // The C# property stays SupplierId (PascalCase .NET convention).
            entity.Property(e => e.SupplierId).HasColumnName("supplier_id");

            // AddedVia defaults to "Manual" — existing rows are treated as manually entered.
            entity.Property(e => e.AddedVia).HasDefaultValue("Manual");

            // Composite unique index: the same catalog number can exist in different
            // suppliers' glossaries, but must be unique within a single supplier.
            entity.HasIndex(e => new { e.SupplierId, e.CatalogNumber }).IsUnique();

            // Store price with 4 decimal places for precision
            entity.Property(e => e.ContractedPrice).HasColumnType("decimal(18,4)");

            // Relationship: many GlossaryUnits → one Supplier.
            // ON DELETE CASCADE: deleting a supplier removes all its glossary units.
            entity.HasOne(e => e.Supplier)
                  .WithMany(s => s.GlossaryUnits)
                  .HasForeignKey(e => e.SupplierId)
                  .OnDelete(DeleteBehavior.Cascade);

            // Relationship: optional many GlossaryUnits → one GlossaryUnitStatus.
            // ON DELETE SET NULL: deleting a status unlinks it from units (does not delete units).
            entity.HasOne(e => e.Status)
                  .WithMany()
                  .HasForeignKey(e => e.StatusId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });
    }
}
