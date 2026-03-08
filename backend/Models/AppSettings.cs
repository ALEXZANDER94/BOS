namespace BOS.Backend.Models;

/// <summary>
/// A simple key-value settings store for application-wide configuration.
/// Each row holds one named setting. Using key-value rather than typed columns
/// means new settings can be added without requiring a schema migration.
///
/// Well-known key constants are defined in AppSettingsService.
/// </summary>
public class AppSettings
{
    public int     Id    { get; set; }
    public string  Key   { get; set; } = string.Empty;
    public string? Value { get; set; }
}
