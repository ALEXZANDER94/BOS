using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.Google;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Infrastructure;
using BOS.Backend.Data;
using BOS.Backend.Hubs;
using BOS.Backend.Models;
using BOS.Backend.Services;

// QuestPDF requires declaring a license type at startup.
// Community license is free for projects under $1M annual revenue.
QuestPDF.Settings.License = LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddHttpClient();
builder.Services.AddSignalR();
builder.Services.AddSingleton<IUserIdProvider, EmailUserIdProvider>();

// ---------------------------------------------------------------------------
// Authentication: ASP.NET Core cookie auth + Google OAuth2 provider.
// The cookie persists the session after Google completes the OAuth flow.
// Credentials come from appsettings.json or (preferred) environment variables:
//   Google__ClientId, Google__ClientSecret, Google__AllowedDomain
// ---------------------------------------------------------------------------
builder.Services.AddAuthentication(options =>
{
    options.DefaultScheme          = CookieAuthenticationDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = GoogleDefaults.AuthenticationScheme;
})
.AddCookie(options =>
{
    options.Cookie.Name         = "BOS.Auth";
    options.Cookie.HttpOnly     = true;
    options.Cookie.SameSite     = SameSiteMode.Lax;   // Lax required for OAuth redirect flow
    options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
        ? CookieSecurePolicy.SameAsRequest             // HTTP ok in dev
        : CookieSecurePolicy.Always;                   // HTTPS only in production
    options.ExpireTimeSpan      = TimeSpan.FromDays(7);
    options.SlidingExpiration   = true;
    // Return 401 JSON instead of a redirect so the React frontend controls navigation.
    options.Events.OnRedirectToLogin = ctx =>
    {
        ctx.Response.StatusCode = 401;
        return Task.CompletedTask;
    };
})
.AddGoogle(options =>
{
    options.ClientId     = builder.Configuration["Google:ClientId"]!;
    options.ClientSecret = builder.Configuration["Google:ClientSecret"]!;
    // Must exactly match the redirect URI registered in Google Cloud Console.
    options.CallbackPath = "/api/auth/callback";

    // Request Gmail read-only scope in addition to the default profile/email scopes.
    options.Scope.Add("https://www.googleapis.com/auth/gmail.readonly");

    // offline access_type is required for Google to issue a refresh token.
    options.AccessType = "offline";

    // SaveTokens stores access_token, refresh_token, and expires_at in the
    // auth ticket properties so we can read them in OnTicketReceived below.
    options.SaveTokens = true;

    // After a successful OAuth exchange, upsert the user's tokens into the DB
    // so GmailService can retrieve and refresh them on later requests.
    options.Events.OnTicketReceived = async ctx =>
    {
        var email = ctx.Principal?.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(email)) return;

        var accessToken  = ctx.Properties?.GetTokenValue("access_token");
        var refreshToken = ctx.Properties?.GetTokenValue("refresh_token");
        var expiresAt    = ctx.Properties?.GetTokenValue("expires_at");

        if (string.IsNullOrEmpty(accessToken)) return;

        var expiry = DateTimeOffset.TryParse(expiresAt, out var dto)
            ? dto.UtcDateTime
            : DateTime.UtcNow.AddHours(1);

        var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var existing = await db.UserGoogleTokens
            .FirstOrDefaultAsync(t => t.UserEmail == email);

        if (existing != null)
        {
            existing.AccessToken = accessToken;
            // Only overwrite the refresh token if Google sent a new one;
            // subsequent logins without re-consent don't include a refresh token.
            if (!string.IsNullOrEmpty(refreshToken))
                existing.RefreshToken = refreshToken;
            existing.TokenExpiry = expiry;
            existing.UpdatedAt   = DateTime.UtcNow;
        }
        else
        {
            db.UserGoogleTokens.Add(new UserGoogleToken
            {
                UserEmail    = email,
                AccessToken  = accessToken,
                RefreshToken = refreshToken ?? string.Empty,
                TokenExpiry  = expiry,
                UpdatedAt    = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync();
    };
});

// ---------------------------------------------------------------------------
// Database: path is configurable via environment variable or appsettings so
// it works correctly on both a Linux server and a local Windows dev machine.
//
// Priority:
//   1. Environment variable  BOS_DB_PATH        (absolute path to the .db file)
//   2. Appsettings key       "Database:Path"    (in appsettings.json or .Development.json)
//   3. Hard-coded default:   /var/lib/bos/bos.db  (Linux VPS production default)
// ---------------------------------------------------------------------------
var dbPath = Environment.GetEnvironmentVariable("BOS_DB_PATH")
    ?? builder.Configuration["Database:Path"]
    ?? "/var/lib/bos/bos.db";

Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// ---------------------------------------------------------------------------
// Application services — registered here, injected into controllers via DI.
// 'Scoped' means one instance per HTTP request, which is correct for services
// that use DbContext (also scoped by default).
// ---------------------------------------------------------------------------
builder.Services.AddScoped<ISupplierService,            SupplierService>();
builder.Services.AddScoped<IComparisonCriteriaService,  ComparisonCriteriaService>();
builder.Services.AddScoped<IAppSettingsService,         AppSettingsService>();
builder.Services.AddScoped<IGlossaryService,            GlossaryService>();
builder.Services.AddScoped<IGlossaryUnitStatusService,  GlossaryUnitStatusService>();
builder.Services.AddScoped<IPdfParserService,           PdfParserService>();
builder.Services.AddScoped<ISpreadsheetParserService,   SpreadsheetParserService>();
builder.Services.AddScoped<IAdobePdfService,            AdobePdfService>();
builder.Services.AddScoped<IComparisonService,          ComparisonService>();
builder.Services.AddScoped<IReportService,              ReportService>();

// Gmail
builder.Services.AddScoped<IGmailService,               GmailService>();

// Workspace / Notifications
builder.Services.AddScoped<IWorkspaceService,           WorkspaceService>();
builder.Services.AddScoped<INotificationService,        NotificationService>();
builder.Services.AddHostedService<NotificationCleanupService>();

// CRM
builder.Services.AddScoped<IClientService,              ClientService>();
builder.Services.AddScoped<IContactService,             ContactService>();
builder.Services.AddScoped<IProjectService,             ProjectService>();
builder.Services.AddScoped<IActivityLogService,         ActivityLogService>();

var app = builder.Build();

// ---------------------------------------------------------------------------
// Auto-apply EF Core migrations on startup.
// On first launch this creates the database file and all tables.
// On subsequent launches it applies any pending migrations from app updates.
// ---------------------------------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// Forward headers from the Nginx reverse proxy so ASP.NET Core sees the real
// client IP and the correct HTTPS scheme (needed for cookie security policies
// and OAuth2 redirect URI construction).
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

// Serve the built React frontend from wwwroot.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

// ---------------------------------------------------------------------------
// Auth endpoints — Google OAuth2 flow.
// ---------------------------------------------------------------------------

// Step 1: Frontend redirects the browser here.
// ASP.NET Core issues a challenge which sends the browser to Google's consent screen.
app.MapGet("/api/auth/login", () =>
    Results.Challenge(
        new AuthenticationProperties { RedirectUri = "/" },
        [GoogleDefaults.AuthenticationScheme]
    )
);

// Step 2: Google redirects back to /api/auth/callback.
// The Google middleware handles the token exchange and sets the BOS.Auth cookie,
// then redirects to RedirectUri ("/") from Step 1. No code needed here.

// Step 3: Frontend polls this to learn who is logged in.
// Returns 200 + { name, email } if the cookie is valid, 401 if not authenticated,
// or 403 if the account is from a disallowed domain.
app.MapGet("/api/auth/me", (HttpContext ctx) =>
{
    if (ctx.User?.Identity?.IsAuthenticated != true)
        return Results.Unauthorized();

    var name  = ctx.User.FindFirstValue(ClaimTypes.Name) ?? "Unknown";
    var email = ctx.User.FindFirstValue(ClaimTypes.Email) ?? string.Empty;

    // Domain restriction: only allow accounts from the client's Google Workspace domain.
    // Set Google:AllowedDomain in appsettings.json or via the Google__AllowedDomain
    // environment variable. Leave empty or omit to allow any Google account.
    var allowedDomain = builder.Configuration["Google:AllowedDomain"];
    if (!string.IsNullOrEmpty(allowedDomain) && !email.EndsWith($"@{allowedDomain}"))
        return Results.Forbid();

    return Results.Ok(new { name, email });
});

// Step 4: Logout clears the auth cookie and ends the session.
app.MapPost("/api/auth/logout", async (HttpContext ctx) =>
{
    await ctx.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok();
});

// SPA fallback: any route not matched by a controller or the endpoints above
// returns index.html so React Router can handle client-side navigation.
app.MapFallbackToFile("index.html");

await app.RunAsync();
