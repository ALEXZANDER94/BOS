namespace BOS.Backend.Models;

public class Client
{
    public int    Id          { get; set; }
    public string Name        { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Status      { get; set; } = "Active";   // "Active" | "Inactive"
    public string Industry    { get; set; } = string.Empty;
    public string Website     { get; set; } = string.Empty;
    public string Domain      { get; set; } = string.Empty;

    // Address
    public string Street { get; set; } = string.Empty;
    public string City   { get; set; } = string.Empty;
    public string State  { get; set; } = string.Empty;
    public string Zip    { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Contact>     Contacts     { get; set; } = [];
    public ICollection<Project>     Projects     { get; set; } = [];
    public ICollection<ActivityLog> ActivityLogs { get; set; } = [];
}
