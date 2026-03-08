namespace BOS.Backend.Models;

public class UserGoogleToken
{
    public int      Id           { get; set; }
    public string   UserEmail    { get; set; } = string.Empty;
    public string   AccessToken  { get; set; } = string.Empty;
    public string   RefreshToken { get; set; } = string.Empty;
    public DateTime TokenExpiry  { get; set; }
    public DateTime UpdatedAt    { get; set; } = DateTime.UtcNow;
}
