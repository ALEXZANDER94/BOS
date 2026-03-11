namespace BOS.Backend.Models;

// App-level singleton — only one row ever exists (id = 1).
public class QuickBooksToken
{
    public int      Id           { get; set; }
    public string   AccessToken  { get; set; } = string.Empty;
    public string   RefreshToken { get; set; } = string.Empty;
    public string   RealmId      { get; set; } = string.Empty;
    public DateTime ExpiresAt    { get; set; }
    public DateTime CreatedAt    { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt    { get; set; } = DateTime.UtcNow;
}
