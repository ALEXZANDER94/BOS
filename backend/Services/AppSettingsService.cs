using Microsoft.EntityFrameworkCore;
using BOS.Backend.Data;
using BOS.Backend.Models;

namespace BOS.Backend.Services;

// ── DTOs ─────────────────────────────────────────────────────────────────────

/// <summary>
/// Represents the resolved Adobe PDF Services credentials and the tier they belong to.
/// </summary>
public record AdobeCredentialsDto(
    string? ClientId,
    string? ClientSecret,
    /// <summary>True when both credentials were loaded from the database (Pro tier).</summary>
    bool IsPro
);

/// <summary>
/// Reports how many Adobe conversions have been tracked this calendar month.
/// </summary>
public record AdobeUsageDto(
    int    MonthlyCount,
    string MonthYear,   // "yyyy-MM"
    string Tier         // "Free" or "Pro"
);

// ── Interface ─────────────────────────────────────────────────────────────────

public interface IAppSettingsService
{
    Task<string?> GetAsync(string key);
    Task SetAsync(string key, string? value);

    Task<AdobeCredentialsDto> GetAdobeCredentialsAsync();
    Task SetAdobeCredentialsAsync(string clientId, string clientSecret);
    Task ClearAdobeCredentialsAsync();

    Task<AdobeUsageDto> GetAdobeUsageAsync(bool isPro);
    Task IncrementAdobeUsageAsync();
}

// ── Implementation ────────────────────────────────────────────────────────────

public class AppSettingsService : IAppSettingsService
{
    private readonly AppDbContext _db;

    // Well-known setting keys
    public const string AdobeClientIdKey     = "Adobe:ClientId";
    public const string AdobeClientSecretKey = "Adobe:ClientSecret";
    public const string AdobeCountKey        = "Adobe:MonthlyCount";
    public const string AdobeCountMonthKey   = "Adobe:CountMonth";

    public AppSettingsService(AppDbContext db) => _db = db;

    // ── Generic key-value helpers ────────────────────────────────────────────

    public async Task<string?> GetAsync(string key)
    {
        var row = await _db.AppSettings.FirstOrDefaultAsync(s => s.Key == key);
        return row?.Value;
    }

    public async Task SetAsync(string key, string? value)
    {
        var row = await _db.AppSettings.FirstOrDefaultAsync(s => s.Key == key);
        if (row is null)
        {
            _db.AppSettings.Add(new AppSettings { Key = key, Value = value });
        }
        else
        {
            row.Value = value;
        }
        await _db.SaveChangesAsync();
    }

    // ── Adobe credential helpers ─────────────────────────────────────────────

    public async Task<AdobeCredentialsDto> GetAdobeCredentialsAsync()
    {
        var clientId     = await GetAsync(AdobeClientIdKey);
        var clientSecret = await GetAsync(AdobeClientSecretKey);

        bool isPro = !string.IsNullOrWhiteSpace(clientId)
                  && !string.IsNullOrWhiteSpace(clientSecret);

        return new AdobeCredentialsDto(clientId, clientSecret, isPro);
    }

    public async Task SetAdobeCredentialsAsync(string clientId, string clientSecret)
    {
        await SetAsync(AdobeClientIdKey,     clientId.Trim());
        await SetAsync(AdobeClientSecretKey, clientSecret.Trim());
    }

    public async Task ClearAdobeCredentialsAsync()
    {
        await SetAsync(AdobeClientIdKey,     null);
        await SetAsync(AdobeClientSecretKey, null);
    }

    // ── Usage counter ────────────────────────────────────────────────────────

    public async Task<AdobeUsageDto> GetAdobeUsageAsync(bool isPro)
    {
        string currentMonth = DateTime.UtcNow.ToString("yyyy-MM");
        string? storedMonth = await GetAsync(AdobeCountMonthKey);

        int count = 0;
        if (storedMonth == currentMonth)
        {
            var countStr = await GetAsync(AdobeCountKey);
            _ = int.TryParse(countStr, out count);
        }

        return new AdobeUsageDto(
            MonthlyCount: count,
            MonthYear:    currentMonth,
            Tier:         isPro ? "Pro" : "Free"
        );
    }

    public async Task IncrementAdobeUsageAsync()
    {
        string currentMonth = DateTime.UtcNow.ToString("yyyy-MM");
        string? storedMonth = await GetAsync(AdobeCountMonthKey);

        int count = 0;
        if (storedMonth == currentMonth)
        {
            var countStr = await GetAsync(AdobeCountKey);
            _ = int.TryParse(countStr, out count);
        }

        // Reset counter if we've rolled into a new month
        if (storedMonth != currentMonth)
            await SetAsync(AdobeCountMonthKey, currentMonth);

        await SetAsync(AdobeCountKey, (count + 1).ToString());
    }
}
