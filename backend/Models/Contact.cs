namespace BOS.Backend.Models;

public class Contact
{
    public int     Id        { get; set; }
    public int     ClientId  { get; set; }
    public Client? Client    { get; set; }

    public string Name      { get; set; } = string.Empty;
    public string Email     { get; set; } = string.Empty;
    public string Phone     { get; set; } = string.Empty;
    public string Title     { get; set; } = string.Empty;
    public bool   IsPrimary { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<ProjectContact> ProjectContacts { get; set; } = [];
}
