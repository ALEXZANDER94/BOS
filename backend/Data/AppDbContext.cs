using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
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
    public DbSet<ClientAddon>            ClientAddons            => Set<ClientAddon>();
    public DbSet<ProjectAddonAssignment> ProjectAddonAssignments => Set<ProjectAddonAssignment>();

    // Project hierarchy
    public DbSet<Building>         Buildings         => Set<Building>();
    public DbSet<Lot>              Lots              => Set<Lot>();
    public DbSet<Address>          Addresses         => Set<Address>();
    public DbSet<PurchaseOrder>    PurchaseOrders    => Set<PurchaseOrder>();
    public DbSet<Fixture>          Fixtures          => Set<Fixture>();
    public DbSet<FixtureLocation>  FixtureLocations  => Set<FixtureLocation>();

    // Ticket system
    public DbSet<TicketCategory>   TicketCategories  => Set<TicketCategory>();
    public DbSet<TicketStatus>     TicketStatuses    => Set<TicketStatus>();
    public DbSet<Ticket>           Tickets           => Set<Ticket>();
    public DbSet<TicketComment>    TicketComments    => Set<TicketComment>();
    public DbSet<TicketHistory>    TicketHistory     => Set<TicketHistory>();
    public DbSet<TicketWatcher>    TicketWatchers    => Set<TicketWatcher>();
    public DbSet<TicketAttachment> TicketAttachments => Set<TicketAttachment>();

    // QuickBooks integration
    public DbSet<QuickBooksToken>        QuickBooksTokens        => Set<QuickBooksToken>();
    public DbSet<PurchaseOrderStatus>    PurchaseOrderStatuses   => Set<PurchaseOrderStatus>();
    public DbSet<ProjectQbEstimateLink>  ProjectQbEstimateLinks  => Set<ProjectQbEstimateLink>();
    public DbSet<ProjectQbInvoiceLink>   ProjectQbInvoiceLinks   => Set<ProjectQbInvoiceLink>();

    // Proposals + Libraries
    public DbSet<Library>               Libraries               => Set<Library>();
    public DbSet<LibraryUpgrade>        LibraryUpgrades         => Set<LibraryUpgrade>();
    public DbSet<CustomUpgrade>         CustomUpgrades          => Set<CustomUpgrade>();
    public DbSet<Proposal>              Proposals               => Set<Proposal>();
    public DbSet<ProposalBuilding>      ProposalBuildings       => Set<ProposalBuilding>();
    public DbSet<ProposalPlan>          ProposalPlans           => Set<ProposalPlan>();
    public DbSet<ProposalCustomUpgrade> ProposalCustomUpgrades  => Set<ProposalCustomUpgrade>();
    public DbSet<ProjectCustomUpgrade>  ProjectCustomUpgrades   => Set<ProjectCustomUpgrade>();
    public DbSet<ProposalPricing>       ProposalPricings        => Set<ProposalPricing>();
    public DbSet<Plan>                  Plans                   => Set<Plan>();

    // Gmail integration
    public DbSet<UserGoogleToken>     UserGoogleTokens     => Set<UserGoogleToken>();
    public DbSet<EmailCategory>       EmailCategories      => Set<EmailCategory>();
    public DbSet<EmailCategoryStatus> EmailCategoryStatuses => Set<EmailCategoryStatus>();
    public DbSet<EmailAssignment>     EmailAssignments     => Set<EmailAssignment>();
    public DbSet<EmailNote>           EmailNotes           => Set<EmailNote>();
    public DbSet<UserPreference>           UserPreferences           => Set<UserPreference>();
    public DbSet<Notification>             Notifications             => Set<Notification>();
    public DbSet<CannedResponseCategory>   CannedResponseCategories   => Set<CannedResponseCategory>();
    public DbSet<CannedResponse>           CannedResponses            => Set<CannedResponse>();
    public DbSet<CannedResponseAttachment> CannedResponseAttachments  => Set<CannedResponseAttachment>();
    public DbSet<EmailSignature>           EmailSignatures            => Set<EmailSignature>();

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

            // Tab visibility — default true so existing clients show every tab.
            entity.Property(e => e.ShowContacts).HasDefaultValue(true);
            entity.Property(e => e.ShowProjects).HasDefaultValue(true);
            entity.Property(e => e.ShowProposals).HasDefaultValue(true);
            entity.Property(e => e.ShowLibraries).HasDefaultValue(true);
            entity.Property(e => e.ShowActivity).HasDefaultValue(true);
            entity.Property(e => e.ShowOptions).HasDefaultValue(true);
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

        // ── Notification ─────────────────────────────────────────────────────────
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.RecipientEmail).HasColumnName("recipient_email").IsRequired();
            entity.Property(e => e.Type).HasColumnName("type").IsRequired().HasDefaultValue("mention");
            entity.Property(e => e.Title).HasColumnName("title").IsRequired();
            entity.Property(e => e.Body).HasColumnName("body").IsRequired();
            entity.Property(e => e.IsRead).HasColumnName("is_read").HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.RelatedMessageId).HasColumnName("related_message_id");
            entity.Property(e => e.RelatedNoteId).HasColumnName("related_note_id");
            // Index for efficient unread-count and notification-list queries per user
            entity.HasIndex(e => new { e.RecipientEmail, e.IsRead, e.CreatedAt });
        });

        // ── UserPreference ───────────────────────────────────────────────────────
        modelBuilder.Entity<UserPreference>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.UserEmail).HasColumnName("user_email").IsRequired();
            entity.Property(e => e.Key).HasColumnName("key").IsRequired();
            entity.Property(e => e.Value).HasColumnName("value").IsRequired();
            // Each user can have at most one value per preference key
            entity.HasIndex(e => new { e.UserEmail, e.Key }).IsUnique();
        });

        // ── EmailNote ────────────────────────────────────────────────────────────
        modelBuilder.Entity<EmailNote>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.MessageId).HasColumnName("message_id").IsRequired();
            entity.Property(e => e.UserEmail).HasColumnName("user_email").IsRequired();
            entity.Property(e => e.NoteText).HasColumnName("note_text").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(e => e.MessageId);
        });

        // ── Building ─────────────────────────────────────────────────────────────
        modelBuilder.Entity<Building>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasIndex(e => e.ProjectId);

            entity.HasOne(e => e.Project)
                  .WithMany()
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Lot ───────────────────────────────────────────────────────────────────
        modelBuilder.Entity<Lot>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BuildingId).HasColumnName("building_id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.HasIndex(e => e.BuildingId);

            entity.HasOne(e => e.Building)
                  .WithMany(b => b.Lots)
                  .HasForeignKey(e => e.BuildingId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Address ───────────────────────────────────────────────────────────────
        modelBuilder.Entity<Address>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.LotId).HasColumnName("lot_id");
            entity.Property(e => e.Address1).HasColumnName("address_1");
            entity.Property(e => e.Address2).HasColumnName("address_2");
            entity.Property(e => e.City).HasColumnName("city");
            entity.Property(e => e.State).HasColumnName("state");
            entity.Property(e => e.Zip).HasColumnName("zip");
            entity.Property(e => e.Country).HasColumnName("country");
            // 1:1 — each lot has at most one address
            entity.HasIndex(e => e.LotId).IsUnique();

            entity.HasOne(e => e.Lot)
                  .WithOne(l => l.Address)
                  .HasForeignKey<Address>(e => e.LotId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── PurchaseOrder ─────────────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseOrder>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.LotId).HasColumnName("lot_id");
            entity.Property(e => e.OrderNumber).HasColumnName("order_number").IsRequired();
            entity.Property(e => e.InvoiceNumber).HasColumnName("invoice_number").IsRequired(false);
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("decimal(18,2)");
            entity.Property(e => e.QbStatus).HasColumnName("qb_status").HasDefaultValue("Not Found");
            entity.Property(e => e.InternalStatusId).HasColumnName("internal_status_id").IsRequired(false);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(e => e.ProjectId);
            entity.HasIndex(e => new { e.ProjectId, e.OrderNumber }).IsUnique();

            entity.HasOne(e => e.Project)
                  .WithMany()
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Lot)
                  .WithMany(l => l.PurchaseOrders)
                  .HasForeignKey(e => e.LotId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.InternalStatus)
                  .WithMany(s => s.PurchaseOrders)
                  .HasForeignKey(e => e.InternalStatusId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // ── PurchaseOrderStatus ───────────────────────────────────────────────────
        modelBuilder.Entity<PurchaseOrderStatus>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Color).HasColumnName("color").HasDefaultValue("#6b7280");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // ── FixtureLocation ───────────────────────────────────────────────────────
        modelBuilder.Entity<FixtureLocation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // ── Fixture ───────────────────────────────────────────────────────────────
        modelBuilder.Entity<Fixture>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BuildingId).HasColumnName("building_id");
            entity.Property(e => e.LocationId).HasColumnName("location_id").IsRequired(false);
            entity.Property(e => e.Code).HasColumnName("code").IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Quantity).HasColumnName("quantity").HasDefaultValue(1);
            entity.Property(e => e.Note).HasColumnName("note");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(e => e.BuildingId);

            entity.HasOne(e => e.Building)
                  .WithMany(b => b.Fixtures)
                  .HasForeignKey(e => e.BuildingId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Location)
                  .WithMany(l => l.Fixtures)
                  .HasForeignKey(e => e.LocationId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });

        // ── QuickBooksToken ───────────────────────────────────────────────────────
        modelBuilder.Entity<QuickBooksToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AccessToken).HasColumnName("access_token").IsRequired();
            entity.Property(e => e.RefreshToken).HasColumnName("refresh_token").IsRequired();
            entity.Property(e => e.RealmId).HasColumnName("realm_id").IsRequired();
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // ── Client (extension: QuickBooks customer mapping) ───────────────────────
        modelBuilder.Entity<Client>(entity =>
        {
            entity.Property(e => e.QbCustomerId).HasColumnName("qb_customer_id").IsRequired(false);
            entity.Property(e => e.QbCustomerName).HasColumnName("qb_customer_name").IsRequired(false);
        });

        // ── ProjectQbEstimateLink ─────────────────────────────────────────────────
        modelBuilder.Entity<ProjectQbEstimateLink>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.QbEstimateId).HasColumnName("qb_estimate_id").IsRequired();
            entity.Property(e => e.LinkedAt).HasColumnName("linked_at");

            // A given QB estimate can only be linked to one project at a time.
            entity.HasIndex(e => e.QbEstimateId).IsUnique();
            entity.HasIndex(e => e.ProjectId);

            entity.HasOne(e => e.Project)
                  .WithMany()
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ProjectQbInvoiceLink ──────────────────────────────────────────────────
        modelBuilder.Entity<ProjectQbInvoiceLink>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.QbInvoiceId).HasColumnName("qb_invoice_id").IsRequired();
            entity.Property(e => e.FromEstimateId).HasColumnName("from_estimate_id").IsRequired(false);
            entity.Property(e => e.LinkedAt).HasColumnName("linked_at");

            entity.HasIndex(e => e.QbInvoiceId).IsUnique();
            entity.HasIndex(e => e.ProjectId);

            entity.HasOne(e => e.Project)
                  .WithMany()
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ClientAddon ───────────────────────────────────────────────────────────
        modelBuilder.Entity<ClientAddon>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ClientId).HasColumnName("client_id");
            entity.Property(e => e.Code).HasColumnName("code").IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Notes).HasColumnName("notes");
            // Code must be unique per client
            entity.HasIndex(e => new { e.ClientId, e.Code }).IsUnique();

            entity.HasOne(e => e.Client)
                  .WithMany()
                  .HasForeignKey(e => e.ClientId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ProjectAddonAssignment ────────────────────────────────────────────────
        modelBuilder.Entity<ProjectAddonAssignment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.AddonId).HasColumnName("addon_id");
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.Price).HasColumnName("price").HasColumnType("decimal(18,2)");
            // One assignment per addon per project
            entity.HasIndex(e => new { e.AddonId, e.ProjectId }).IsUnique();

            entity.HasOne(e => e.Addon)
                  .WithMany(a => a.Assignments)
                  .HasForeignKey(e => e.AddonId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Project)
                  .WithMany()
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);
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

        // ── TicketCategory ────────────────────────────────────────────────────────
        modelBuilder.Entity<TicketCategory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Color).HasColumnName("color").HasDefaultValue("#6b7280");
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // ── TicketStatus ──────────────────────────────────────────────────────────
        modelBuilder.Entity<TicketStatus>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Color).HasColumnName("color").HasDefaultValue("#6b7280");
            entity.Property(e => e.IsDefault).HasColumnName("is_default").HasDefaultValue(false);
            entity.Property(e => e.IsClosed).HasColumnName("is_closed").HasDefaultValue(false);
            entity.Property(e => e.DisplayOrder).HasColumnName("display_order").HasDefaultValue(0);
            entity.HasIndex(e => e.Name).IsUnique();
        });

        // ── Ticket ────────────────────────────────────────────────────────────────
        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.Title).HasColumnName("title").IsRequired();
            entity.Property(e => e.Description).HasColumnName("description");
            entity.Property(e => e.Priority).HasColumnName("priority").HasDefaultValue("Medium");
            entity.Property(e => e.CategoryId).HasColumnName("category_id").IsRequired(false);
            entity.Property(e => e.StatusId).HasColumnName("status_id");
            entity.Property(e => e.CreatedByEmail).HasColumnName("created_by_email").IsRequired();
            entity.Property(e => e.AssignedToEmail).HasColumnName("assigned_to_email").IsRequired(false);
            entity.Property(e => e.ProjectId).HasColumnName("project_id").IsRequired(false);
            entity.Property(e => e.LinkedEmailMessageId).HasColumnName("linked_email_message_id").IsRequired(false);
            entity.Property(e => e.DueDate).HasColumnName("due_date").IsRequired(false);
            entity.Property(e => e.OverdueNotifiedAt).HasColumnName("overdue_notified_at").IsRequired(false);
            entity.Property(e => e.ClosedAt).HasColumnName("closed_at").IsRequired(false);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(e => e.StatusId);
            entity.HasIndex(e => e.AssignedToEmail);
            entity.HasIndex(e => e.CreatedByEmail);

            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Tickets)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);

            entity.HasOne(e => e.Status)
                  .WithMany(s => s.Tickets)
                  .HasForeignKey(e => e.StatusId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Project)
                  .WithMany()
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });

        // ── TicketComment ─────────────────────────────────────────────────────────
        modelBuilder.Entity<TicketComment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TicketId).HasColumnName("ticket_id");
            entity.Property(e => e.AuthorEmail).HasColumnName("author_email").IsRequired();
            entity.Property(e => e.Body).HasColumnName("body").IsRequired();
            entity.Property(e => e.IsPrivate).HasColumnName("is_private").HasDefaultValue(false);
            entity.Property(e => e.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired(false);
            entity.HasIndex(e => e.TicketId);

            entity.HasOne(e => e.Ticket)
                  .WithMany(t => t.Comments)
                  .HasForeignKey(e => e.TicketId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── TicketHistory ─────────────────────────────────────────────────────────
        modelBuilder.Entity<TicketHistory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TicketId).HasColumnName("ticket_id");
            entity.Property(e => e.ChangedByEmail).HasColumnName("changed_by_email").IsRequired();
            entity.Property(e => e.FieldChanged).HasColumnName("field_changed").IsRequired();
            entity.Property(e => e.OldValue).HasColumnName("old_value").IsRequired(false);
            entity.Property(e => e.NewValue).HasColumnName("new_value").IsRequired(false);
            entity.Property(e => e.ChangedAt).HasColumnName("changed_at");
            entity.HasIndex(e => e.TicketId);

            entity.HasOne(e => e.Ticket)
                  .WithMany(t => t.History)
                  .HasForeignKey(e => e.TicketId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── TicketWatcher ─────────────────────────────────────────────────────────
        modelBuilder.Entity<TicketWatcher>(entity =>
        {
            entity.HasKey(e => new { e.TicketId, e.UserEmail });
            entity.Property(e => e.TicketId).HasColumnName("ticket_id");
            entity.Property(e => e.UserEmail).HasColumnName("user_email").IsRequired();

            entity.HasOne(e => e.Ticket)
                  .WithMany(t => t.Watchers)
                  .HasForeignKey(e => e.TicketId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── TicketAttachment ──────────────────────────────────────────────────────
        modelBuilder.Entity<TicketAttachment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.TicketId).HasColumnName("ticket_id");
            entity.Property(e => e.FileName).HasColumnName("file_name").IsRequired();
            entity.Property(e => e.StoredFileName).HasColumnName("stored_file_name").IsRequired();
            entity.Property(e => e.ContentType).HasColumnName("content_type").IsRequired();
            entity.Property(e => e.FileSize).HasColumnName("file_size");
            entity.Property(e => e.UploadedByEmail).HasColumnName("uploaded_by_email").IsRequired();
            entity.Property(e => e.UploadedAt).HasColumnName("uploaded_at");
            entity.HasIndex(e => e.TicketId);

            entity.HasOne(e => e.Ticket)
                  .WithMany(t => t.Attachments)
                  .HasForeignKey(e => e.TicketId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Notification (update: add related_ticket_id) ──────────────────────────
        modelBuilder.Entity<Notification>(entity =>
        {
            entity.Property(e => e.RelatedTicketId).HasColumnName("related_ticket_id").IsRequired(false);
        });

        // ── Project (extension: proposal-conversion fields) ──────────────────────
        modelBuilder.Entity<Project>(entity =>
        {
            entity.Property(e => e.SourceProposalId).HasColumnName("source_proposal_id").IsRequired(false);
            entity.Property(e => e.SourceLibraryId).HasColumnName("source_library_id").IsRequired(false);
            entity.Property(e => e.Address).HasColumnName("address").HasDefaultValue("");
            entity.Property(e => e.City).HasColumnName("city").HasDefaultValue("");
            entity.Property(e => e.ProductStandards).HasColumnName("product_standards").HasDefaultValue("");
            entity.Property(e => e.Version).HasColumnName("version").HasDefaultValue("");
            entity.Property(e => e.BuyerUpgrades).HasColumnName("buyer_upgrades").HasDefaultValue("");
            entity.Property(e => e.RevisionsAfterLaunch).HasColumnName("revisions_after_launch").HasDefaultValue("");
            entity.Property(e => e.QbProjectId).HasColumnName("qb_project_id").IsRequired(false);
            entity.Property(e => e.QbProjectName).HasColumnName("qb_project_name").IsRequired(false);

            // Optional FK to Library — SetNull on delete so deleting a Library
            // does not cascade-destroy converted projects.
            entity.HasOne(e => e.SourceLibrary)
                  .WithMany()
                  .HasForeignKey(e => e.SourceLibraryId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);

            // Optional FK back to Proposal. Proposal.ConvertedProjectId is just an
            // int? (no navigation), so this side owns the relationship.
            entity.HasOne(e => e.SourceProposal)
                  .WithMany()
                  .HasForeignKey(e => e.SourceProposalId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });

        // ── Lot (extension: PlanId) ───────────────────────────────────────────────
        modelBuilder.Entity<Lot>(entity =>
        {
            entity.Property(e => e.PlanId).HasColumnName("plan_id").IsRequired(false);

            entity.HasOne(e => e.Plan)
                  .WithMany(p => p.Lots)
                  .HasForeignKey(e => e.PlanId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });

        // ── Plan (project-side) ───────────────────────────────────────────────────
        modelBuilder.Entity<Plan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BuildingId).HasColumnName("building_id");
            entity.Property(e => e.PlanName).HasColumnName("plan_name").IsRequired();
            entity.Property(e => e.SquareFootage).HasColumnName("square_footage");
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("decimal(18,2)");
            entity.HasIndex(e => e.BuildingId);

            entity.HasOne(e => e.Building)
                  .WithMany(b => b.Plans)
                  .HasForeignKey(e => e.BuildingId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Library ───────────────────────────────────────────────────────────────
        modelBuilder.Entity<Library>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ClientId).HasColumnName("client_id");
            entity.Property(e => e.Title).HasColumnName("title").IsRequired();
            entity.Property(e => e.Description).HasColumnName("description").HasDefaultValue("");
            entity.Property(e => e.StoredFileName).HasColumnName("stored_file_name").IsRequired();
            entity.Property(e => e.OriginalFileName).HasColumnName("original_file_name").IsRequired();
            entity.Property(e => e.ContentLength).HasColumnName("content_length");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.HasIndex(e => e.ClientId);

            entity.HasOne(e => e.Client)
                  .WithMany()
                  .HasForeignKey(e => e.ClientId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── CustomUpgrade ─────────────────────────────────────────────────────────
        modelBuilder.Entity<CustomUpgrade>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ClientId).HasColumnName("client_id").IsRequired(false);
            entity.Property(e => e.IsGlobal).HasColumnName("is_global").HasDefaultValue(false);
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Description).HasColumnName("description").HasDefaultValue("");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.HasIndex(e => e.ClientId);
            entity.HasIndex(e => e.IsGlobal);

            entity.HasOne(e => e.Client)
                  .WithMany()
                  .HasForeignKey(e => e.ClientId)
                  .OnDelete(DeleteBehavior.Cascade)
                  .IsRequired(false);
        });

        // ── LibraryUpgrade (join) ─────────────────────────────────────────────────
        modelBuilder.Entity<LibraryUpgrade>(entity =>
        {
            entity.HasKey(e => new { e.LibraryId, e.CustomUpgradeId });
            entity.Property(e => e.LibraryId).HasColumnName("library_id");
            entity.Property(e => e.CustomUpgradeId).HasColumnName("custom_upgrade_id");

            entity.HasOne(e => e.Library)
                  .WithMany(l => l.LibraryUpgrades)
                  .HasForeignKey(e => e.LibraryId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.CustomUpgrade)
                  .WithMany()
                  .HasForeignKey(e => e.CustomUpgradeId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Proposal ──────────────────────────────────────────────────────────────
        modelBuilder.Entity<Proposal>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ClientId).HasColumnName("client_id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.Property(e => e.Type).HasColumnName("type").IsRequired().HasDefaultValue("SingleFamily");
            entity.Property(e => e.Status).HasColumnName("status").HasDefaultValue("Draft");
            entity.Property(e => e.ConvertedProjectId).HasColumnName("converted_project_id").IsRequired(false);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");

            // Single-family fields
            entity.Property(e => e.LibraryId).HasColumnName("library_id").IsRequired(false);
            entity.Property(e => e.Address).HasColumnName("address").HasDefaultValue("");
            entity.Property(e => e.City).HasColumnName("city").HasDefaultValue("");
            entity.Property(e => e.ProductStandards).HasColumnName("product_standards").HasDefaultValue("");
            entity.Property(e => e.Version).HasColumnName("version").HasDefaultValue("");
            entity.Property(e => e.BuyerUpgrades).HasColumnName("buyer_upgrades").HasDefaultValue("");
            entity.Property(e => e.RevisionsAfterLaunch).HasColumnName("revisions_after_launch").HasDefaultValue("");

            entity.HasIndex(e => e.ClientId);
            entity.HasIndex(e => e.Status);

            entity.HasOne(e => e.Client)
                  .WithMany()
                  .HasForeignKey(e => e.ClientId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.Library)
                  .WithMany()
                  .HasForeignKey(e => e.LibraryId)
                  .OnDelete(DeleteBehavior.SetNull)
                  .IsRequired(false);
        });

        // ── ProposalBuilding ──────────────────────────────────────────────────────
        modelBuilder.Entity<ProposalBuilding>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProposalId).HasColumnName("proposal_id");
            entity.Property(e => e.Name).HasColumnName("name").IsRequired();
            entity.HasIndex(e => e.ProposalId);

            entity.HasOne(e => e.Proposal)
                  .WithMany(p => p.Buildings)
                  .HasForeignKey(e => e.ProposalId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ProposalPlan ──────────────────────────────────────────────────────────
        modelBuilder.Entity<ProposalPlan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.ProposalBuildingId).HasColumnName("proposal_building_id");
            entity.Property(e => e.PlanName).HasColumnName("plan_name").IsRequired();
            entity.Property(e => e.SquareFootage).HasColumnName("square_footage");
            entity.Property(e => e.Amount).HasColumnName("amount").HasColumnType("decimal(18,2)");
            entity.HasIndex(e => e.ProposalBuildingId);

            entity.HasOne(e => e.ProposalBuilding)
                  .WithMany(b => b.Plans)
                  .HasForeignKey(e => e.ProposalBuildingId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ProposalCustomUpgrade (join) ──────────────────────────────────────────
        modelBuilder.Entity<ProposalCustomUpgrade>(entity =>
        {
            entity.HasKey(e => new { e.ProposalId, e.CustomUpgradeId });
            entity.Property(e => e.ProposalId).HasColumnName("proposal_id");
            entity.Property(e => e.CustomUpgradeId).HasColumnName("custom_upgrade_id");
            entity.Property(e => e.IsEnabled).HasColumnName("is_enabled").HasDefaultValue(false);

            entity.HasOne(e => e.Proposal)
                  .WithMany(p => p.CustomUpgrades)
                  .HasForeignKey(e => e.ProposalId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.CustomUpgrade)
                  .WithMany()
                  .HasForeignKey(e => e.CustomUpgradeId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ProjectCustomUpgrade (join) ───────────────────────────────────────────
        modelBuilder.Entity<ProjectCustomUpgrade>(entity =>
        {
            entity.HasKey(e => new { e.ProjectId, e.CustomUpgradeId });
            entity.Property(e => e.ProjectId).HasColumnName("project_id");
            entity.Property(e => e.CustomUpgradeId).HasColumnName("custom_upgrade_id");
            entity.Property(e => e.IsEnabled).HasColumnName("is_enabled").HasDefaultValue(false);

            entity.HasOne(e => e.Project)
                  .WithMany(p => p.CustomUpgrades)
                  .HasForeignKey(e => e.ProjectId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.CustomUpgrade)
                  .WithMany()
                  .HasForeignKey(e => e.CustomUpgradeId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Canned responses ─────────────────────────────────────────────────────
        modelBuilder.Entity<CannedResponseCategory>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.CreatedByUserEmail).IsRequired();
        });

        modelBuilder.Entity<CannedResponse>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.BodyHtml).IsRequired();
            entity.Property(e => e.CreatedByUserEmail).IsRequired();
            entity.HasOne(e => e.Category)
                  .WithMany(c => c.Responses)
                  .HasForeignKey(e => e.CategoryId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<CannedResponseAttachment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.FileName).IsRequired();
            entity.Property(e => e.StoredFileName).IsRequired();
            entity.Property(e => e.ContentType).IsRequired();
            entity.Property(e => e.UploadedByEmail).IsRequired();
            entity.HasIndex(e => e.CannedResponseId);

            entity.HasOne(e => e.CannedResponse)
                  .WithMany(r => r.Attachments)
                  .HasForeignKey(e => e.CannedResponseId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Email signatures ─────────────────────────────────────────────────────
        modelBuilder.Entity<EmailSignature>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.BodyHtml).IsRequired();
            entity.Property(e => e.OwnerUserEmail).IsRequired();
            entity.HasIndex(e => new { e.OwnerUserEmail, e.AliasEmail });
        });

        // SQLite stores datetimes as text and EF Core reads them back with Kind=Unspecified.
        // When System.Text.Json serializes those values it omits the "Z" suffix, so the
        // browser interprets the ISO string as local time instead of UTC — producing wildly
        // wrong relative timestamps ("just now" for hours-old records). Stamping Kind=Utc on
        // read ensures the JSON always carries the "Z" and JS parses it correctly.
        var utcConverter = new ValueConverter<DateTime, DateTime>(
            v => v,
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                    property.SetValueConverter(utcConverter);
            }
        }
    }
}
