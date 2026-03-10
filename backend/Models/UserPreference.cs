namespace BOS.Backend.Models;

public class UserPreference
{
    public int    Id        { get; set; }
    public string UserEmail { get; set; } = "";
    public string Key       { get; set; } = "";
    public string Value     { get; set; } = ""; // JSON-encoded value
}
