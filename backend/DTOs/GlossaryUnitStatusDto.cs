namespace BOS.Backend.DTOs;

public record GlossaryUnitStatusDto(
    int      Id,
    string   Name,
    string   Color,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateGlossaryUnitStatusRequest(
    string Name,
    string Color
);

public record UpdateGlossaryUnitStatusRequest(
    string Name,
    string Color
);
