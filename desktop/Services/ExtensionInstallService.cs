using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Runtime.InteropServices;
using RailwayQuickBook.Desktop.Helpers;
using RailwayQuickBook.Desktop.Models;

namespace RailwayQuickBook.Desktop.Services;

/// <summary>
/// Extension Installation Helper: makes the manual Chrome "Load unpacked"
/// workflow easy to perform without automating it.
///
/// What it does (and only this):
/// - locates the already-built extension root dynamically via manifest.json,
/// - opens chrome://extensions (or the equivalent page) in an installed browser,
/// - opens the extension folder in the OS file manager (read-only),
/// - copies the folder path to the clipboard.
///
/// It never drags folders into Chrome, never simulates input, never touches
/// registry policies, and never modifies the extension files. The user always
/// performs Developer mode -> Load unpacked -> Select folder themselves.
/// </summary>
public static class ExtensionInstallService
{
    public const string ChromeNotInstalledMessage =
        "Google Chrome was not detected. Install Chrome or use one of the detected Chromium browsers below.";

    public const string ExtensionNotFoundMessage =
        "Extension not found. Please make sure the extension files are present.";

    public const string CopiedConfirmation = "✓ Extension folder path copied";

    private static readonly HashSet<string> ChromiumIds = new(
        new[] { "chrome", "edge", "brave", "opera", "chromium" },
        StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Dynamically locate the extension root by probing for manifest.json.
    /// No hard-coded machine paths. Checks the shipped layout candidates:
    /// ExtensionDir (dist/ or src fallback), project root, and root/dist.
    /// </summary>
    public static bool TryGetExtensionRoot(out string directory, out string manifestPath)
    {
        // Shipped layout first: release zips place dist/ next to the exe, e.g.
        // <install>/RailwayQuickBook-win-x64.exe + <install>/dist/manifest.json.
        // Repo/dev layout second (unchanged).
        var appDir = AppContext.BaseDirectory;
        var candidates = new[]
        {
            Path.Combine(appDir, "dist"),
            Path.Combine(appDir, "extension"),
            Paths.ExtensionDir,
            Paths.ProjectRoot,
            Path.Combine(Paths.ProjectRoot, "dist"),
        };

        foreach (var dir in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (string.IsNullOrWhiteSpace(dir)) continue;
            var manifest = Path.Combine(dir, "manifest.json");
            try
            {
                if (Directory.Exists(dir) && File.Exists(manifest))
                {
                    directory = Path.GetFullPath(dir);
                    manifestPath = Path.GetFullPath(manifest);
                    return true;
                }
            }
            catch
            {
                // Ignore IO errors for a single candidate, try the next.
            }
        }

        directory = string.Empty;
        manifestPath = string.Empty;
        return false;
    }

    public static bool IsChromiumBased(BrowserInfo browser) =>
        ChromiumIds.Contains(browser.Id);

    public static BrowserInfo? FindChrome(IReadOnlyList<BrowserInfo> browsers) =>
        browsers.FirstOrDefault(b =>
            string.Equals(b.Id, "chrome", StringComparison.OrdinalIgnoreCase));

    public static IReadOnlyList<BrowserInfo> ChromiumBrowsers(IReadOnlyList<BrowserInfo> browsers) =>
        browsers.Where(IsChromiumBased).ToList();

    /// <summary>
    /// Status line for the install section. True "installed" state cannot be
    /// observed from outside Chrome without bypassing its security, so this
    /// honestly reflects: folder present + the user's own confirmation flag.
    /// </summary>
    public static string InstallStatusText(bool folderFound, bool userMarkedLoaded) =>
        (!folderFound)
            ? ExtensionNotFoundMessage
            : (userMarkedLoaded ? "✓ Extension ready" : "⚠ Extension needs to be loaded");

    public static string FolderStatusText(bool folderFound) =>
        folderFound ? "✓ Extension folder found" : ExtensionNotFoundMessage;

    /// <summary>Open the extension root in Explorer (Windows) or the default file manager (Linux).</summary>
    public static void OpenExtensionFolder(string directory)
    {
        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "explorer.exe",
                Arguments = $"\"{directory}\"",
                UseShellExecute = true,
            });
        }
        else
        {
            // Linux (.deb release): default file manager via xdg-open.
            Process.Start(new ProcessStartInfo
            {
                FileName = "xdg-open",
                Arguments = $"\"{directory}\"",
                UseShellExecute = false,
            });
        }
    }
}
