namespace BOS.Backend.DTOs;

// ── Read DTOs ─────────────────────────────────────────────────────────────────

public record ClientDto(
    int      Id,
    string   Name,
    string   Description,
    string   Status,
    string   Industry,
    string   Website,
    string   Domain,
    string   Street,
    string   City,
    string   State,
    string   Zip,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    ContactDto?  PrimaryContact,
    int          ContactCount,
    int          ProjectCount,
    int          ActivityCount,
    // Tab visibility
    bool         ShowContacts,
    bool         ShowProjects,
    bool         ShowProposals,
    bool         ShowLibraries,
    bool         ShowActivity,
    bool         ShowOptions,
    // QuickBooks customer link (cached after auto-match-by-name; manually overridable)
    string?      QbCustomerId,
    string?      QbCustomerName
);

// PATCH /api/client/{id}/qb-customer — pass null id+name to clear the link.
public record SetClientQbCustomerRequest(string? QbCustomerId, string? QbCustomerName);

public record ContactDto(
    int      Id,
    int      ClientId,
    string   Name,
    string   Email,
    string   Phone,
    string   Title,
    bool     IsPrimary,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record ProjectDto(
    int       Id,
    int       ClientId,
    string    Name,
    string    Description,
    string    Status,
    DateTime? StartDate,
    DateTime? EndDate,
    DateTime  CreatedAt,
    DateTime  UpdatedAt,
    List<ContactDto> AssignedContacts
);

public record ProjectWithClientDto(
    int       Id,
    int       ClientId,
    string    ClientName,
    string    Name,
    string    Description,
    string    Status,
    DateTime? StartDate,
    DateTime? EndDate,
    DateTime  CreatedAt,
    DateTime  UpdatedAt
);

public record ActivityLogDto(
    int      Id,
    int      ClientId,
    string   Type,
    string   Note,
    DateTime OccurredAt,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

// ── Request DTOs ──────────────────────────────────────────────────────────────

public record CreateClientRequest(
    string Name,
    string Description,
    string Status,
    string Industry,
    string Website,
    string Domain,
    string Street,
    string City,
    string State,
    string Zip
);

public record UpdateClientRequest(
    string Name,
    string Description,
    string Status,
    string Industry,
    string Website,
    string Domain,
    string Street,
    string City,
    string State,
    string Zip,
    bool   ShowContacts,
    bool   ShowProjects,
    bool   ShowProposals,
    bool   ShowLibraries,
    bool   ShowActivity,
    bool   ShowOptions
);

public record CreateContactRequest(
    string Name,
    string Email,
    string Phone,
    string Title,
    bool   IsPrimary
);

public record UpdateContactRequest(
    string Name,
    string Email,
    string Phone,
    string Title,
    bool   IsPrimary
);

public record CreateProjectRequest(
    string    Name,
    string    Description,
    string    Status,
    DateTime? StartDate,
    DateTime? EndDate
);

public record UpdateProjectRequest(
    string    Name,
    string    Description,
    string    Status,
    DateTime? StartDate,
    DateTime? EndDate
);

public record CreateActivityLogRequest(
    string   Type,
    string   Note,
    DateTime OccurredAt
);

public record UpdateActivityLogRequest(
    string   Type,
    string   Note,
    DateTime OccurredAt
);
