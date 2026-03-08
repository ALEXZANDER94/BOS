namespace BOS.Backend.Models;

public class Project
{
    public int     Id          { get; set; }
    public int     ClientId    { get; set; }
    public Client? Client      { get; set; }

    public string    Name        { get; set; } = string.Empty;
    public string    Description { get; set; } = string.Empty;
    public string    Status      { get; set; } = "Active"; // Active | Completed | On Hold | Cancelled
    public DateTime? StartDate   { get; set; }
    public DateTime? EndDate     { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ProjectContact> ProjectContacts { get; set; } = [];
}
