using System.Security.Claims;
using System.Text.Encodings.Web;
using Google.Apis.Auth;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BOS.Backend.Auth;

public class GoogleIdTokenAuthenticationOptions : AuthenticationSchemeOptions
{
    public const string SchemeName = "GoogleIdToken";

    /// <summary>
    /// OAuth client IDs that may have issued the ID token. The BOS web client
    /// (Google:ClientId) and the Apps Script Add-on's client (Google:AddonClientId)
    /// each emit tokens with their own client ID as audience.
    /// </summary>
    public IReadOnlyList<string> Audiences { get; set; } = Array.Empty<string>();

    /// <summary>Optional Workspace hosted-domain restriction. Pulled from Google:AllowedDomain.</summary>
    public string? AllowedDomain { get; set; }
}

/// <summary>
/// Validates Google-issued ID tokens sent by the Apps Script Gmail Add-on as
/// Authorization: Bearer &lt;token&gt;. On success, populates a ClaimsPrincipal with
/// the user's email/name so [Authorize] controllers see the same identity they
/// would from a BOS cookie session.
/// </summary>
public class GoogleIdTokenAuthenticationHandler
    : AuthenticationHandler<GoogleIdTokenAuthenticationOptions>
{
    public GoogleIdTokenAuthenticationHandler(
        IOptionsMonitor<GoogleIdTokenAuthenticationOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var auth = Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(auth) || !auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.NoResult();

        var token = auth["Bearer ".Length..].Trim();
        if (string.IsNullOrEmpty(token))
            return AuthenticateResult.NoResult();

        if (Options.Audiences.Count == 0)
            return AuthenticateResult.Fail("No audiences configured for Google ID token validation.");

        GoogleJsonWebSignature.Payload payload;
        try
        {
            var settings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience      = Options.Audiences,
                HostedDomain  = string.IsNullOrEmpty(Options.AllowedDomain) ? null : Options.AllowedDomain,
            };
            payload = await GoogleJsonWebSignature.ValidateAsync(token, settings);
        }
        catch (InvalidJwtException ex)
        {
            return AuthenticateResult.Fail(ex);
        }

        if (string.IsNullOrEmpty(payload.Email) || payload.EmailVerified != true)
            return AuthenticateResult.Fail("Email claim missing or unverified.");

        var claims = new List<Claim>
        {
            new(ClaimTypes.Email, payload.Email),
            new(ClaimTypes.Name,  payload.Name ?? payload.Email),
        };

        var identity  = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket    = new AuthenticationTicket(principal, Scheme.Name);

        return AuthenticateResult.Success(ticket);
    }
}
