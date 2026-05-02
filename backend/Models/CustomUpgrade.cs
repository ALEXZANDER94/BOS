namespace BOS.Backend.Models;

// Catalog of upgrade types that can be toggled on Proposals/Projects.
// Per-client by default; IsGlobal=true makes the upgrade available to every client
// (in which case ClientId is null).
public class CustomUpgrade
{
    public int     Id          { get; set; }
    public int?    ClientId    { get; set; }   // null when IsGlobal
    public Client? Client      { get; set; }
    public bool    IsGlobal    { get; set; }
    public string  Name        { get; set; } = string.Empty;
    public string  Description { get; set; } = string.Empty;
    public DateTime CreatedAt  { get; set; } = DateTime.UtcNow;
}
