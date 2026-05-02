namespace BOS.Backend.Models;

// Reusable building schematic. Stored as a PDF outside wwwroot for security.
// Scoped per-client.
public class Library
{
    public int    Id               { get; set; }
    public int    ClientId         { get; set; }
    public Client? Client          { get; set; }
    public string Title            { get; set; } = string.Empty;
    public string Description      { get; set; } = string.Empty;
    public string StoredFileName   { get; set; } = string.Empty;  // {guid}.pdf on disk
    public string OriginalFileName { get; set; } = string.Empty;  // for download UX
    public long   ContentLength    { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<LibraryUpgrade> LibraryUpgrades { get; set; } = [];
}
