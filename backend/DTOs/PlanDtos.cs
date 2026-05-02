namespace BOS.Backend.DTOs;

// Project-side Plan, exposed under a Building.
public record PlanDto(int Id, int BuildingId, string PlanName, int SquareFootage, decimal Amount);

public record CreatePlanRequest(string PlanName, int SquareFootage, decimal Amount);
public record UpdatePlanRequest(string PlanName, int SquareFootage, decimal Amount);
