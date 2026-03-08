using Adobe.PDFServicesSDK;
using Adobe.PDFServicesSDK.auth;
using Adobe.PDFServicesSDK.io;
using Adobe.PDFServicesSDK.pdfjobs.jobs;
using Adobe.PDFServicesSDK.pdfjobs.parameters.exportpdf;
using Adobe.PDFServicesSDK.pdfjobs.results;
using log4net;
using log4net.Config;
using System.Reflection;

namespace BOS.Backend.Services;

public interface IAdobePdfService
{
    /// <summary>
    /// Converts a PDF stream to an XLSX MemoryStream using Adobe PDF Services API.
    /// Uses Pro credentials (from database) if configured, otherwise free-tier
    /// credentials from application configuration.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown when no credentials are available (neither Pro nor free-tier configured).
    /// </exception>
    Task<MemoryStream> ConvertPdfToXlsxAsync(Stream pdfStream);

    /// <summary>
    /// Returns true if Adobe conversion is available — i.e., at least one credential
    /// source (Pro database credentials or free-tier config values) is configured.
    /// </summary>
    Task<bool> IsAvailableAsync();
}

public class AdobePdfService : IAdobePdfService
{
    private readonly IAppSettingsService _settings;

    private static bool _log4netInitialized;
    private static readonly object _log4netLock = new();

    public AdobePdfService(IAppSettingsService settings)
    {
        _settings = settings;
        EnsureLog4NetConfigured();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    public async Task<MemoryStream> ConvertPdfToXlsxAsync(Stream pdfStream)
    {
        var (clientId, clientSecret) = await ResolveCredentialsAsync();

        // Copy the PDF to a MemoryStream so it is seekable (the SDK may need to seek)
        var pdfMs = new MemoryStream();
        await pdfStream.CopyToAsync(pdfMs);
        pdfMs.Seek(0, SeekOrigin.Begin);

        // Create Adobe credentials and PDF Services instance
        ICredentials credentials = new ServicePrincipalCredentials(clientId, clientSecret);
        PDFServices pdfServices  = new PDFServices(credentials);

        // Upload the source PDF to Adobe's transient storage
        IAsset sourceAsset = pdfServices.Upload(pdfMs, PDFServicesMediaType.PDF.GetMIMETypeValue());

        // Configure ExportPDF → XLSX
        ExportPDFParams exportParams = ExportPDFParams
            .ExportPDFParamsBuilder(ExportPDFTargetFormat.XLSX)
            .Build();

        // Submit the export job and poll for completion
        ExportPDFJob exportJob = new ExportPDFJob(sourceAsset, exportParams);
        string location = pdfServices.Submit(exportJob);

        PDFServicesResponse<ExportPDFResult> response =
            pdfServices.GetJobResult<ExportPDFResult>(location, typeof(ExportPDFResult));

        // Stream the XLSX result into a MemoryStream and return it
        StreamAsset resultStream = pdfServices.GetContent(response.Result.Asset);

        var resultMs = new MemoryStream();
        await resultStream.Stream.CopyToAsync(resultMs);
        resultMs.Seek(0, SeekOrigin.Begin);

        // Track usage — fire-and-forget; don't let a counter failure bubble up
        _ = Task.Run(async () =>
        {
            try { await _settings.IncrementAdobeUsageAsync(); }
            catch { /* intentionally swallowed */ }
        });

        return resultMs;
    }

    public async Task<bool> IsAvailableAsync()
    {
        try
        {
            await ResolveCredentialsAsync();
            return true;
        }
        catch (InvalidOperationException)
        {
            return false;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// <summary>
    /// Resolves credentials from the database (user-configured via Settings).
    /// Throws if no credentials have been configured.
    /// </summary>
    private async Task<(string clientId, string clientSecret)> ResolveCredentialsAsync()
    {
        var proCreds = await _settings.GetAdobeCredentialsAsync();
        if (proCreds.IsPro)
            return (proCreds.ClientId!, proCreds.ClientSecret!);

        throw new InvalidOperationException(
            "No Adobe PDF Services credentials are configured. " +
            "Visit Settings → Adobe PDF Services to connect your account.");
    }

    /// <summary>
    /// Initialises log4net from log4net.config on first call.
    /// The Adobe SDK requires log4net to be configured or it emits console warnings.
    /// </summary>
    private static void EnsureLog4NetConfigured()
    {
        if (_log4netInitialized) return;
        lock (_log4netLock)
        {
            if (_log4netInitialized) return;
            try
            {
                var logRepository = LogManager.GetRepository(Assembly.GetEntryAssembly()!);
                var configFile    = new FileInfo(
                    Path.Combine(AppContext.BaseDirectory, "log4net.config"));

                if (configFile.Exists)
                    XmlConfigurator.Configure(logRepository, configFile);
                else
                    BasicConfigurator.Configure(logRepository);
            }
            catch
            {
                // Don't crash the app if log4net setup fails
            }
            _log4netInitialized = true;
        }
    }
}
