namespace BOS.Backend.DTOs;

public record FixtureLocationDto(int Id, string Name);

public record FixtureDto(
    int     Id,
    int     BuildingId,
    string  BuildingName,
    int?    LocationId,
    string? LocationName,
    string  Code,
    string  Description,
    int     Quantity,
    string  Note,
    string  CreatedAt,
    string  UpdatedAt);

public record CreateFixtureRequest(
    int?   LocationId,
    string Code,
    string Description,
    int    Quantity,
    string Note);

public record UpdateFixtureRequest(
    int?   LocationId,
    string Code,
    string Description,
    int    Quantity,
    string Note);

public record CreateFixtureLocationRequest(string Name);
public record UpdateFixtureLocationRequest(string Name);
