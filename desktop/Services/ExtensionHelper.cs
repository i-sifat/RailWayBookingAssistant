using RailwayQuickBook.Desktop.Helpers;

namespace RailwayQuickBook.Desktop.Services;

/// <summary>
/// Read-only helpers about the existing extension. Never modifies it.
/// Detection = "can we see dist/manifest.json next to the project?"
/// Installation is always an explicit manual user action in the browser.
/// </summary>
public static class ExtensionHelper
{
    public static bool ExtensionSourceDetected()
    {
        var root = Paths.ProjectRoot;
        return File.Exists(Path.Combine(root, "manifest.json")) ||
               File.Exists(Path.Combine(Paths.ExtensionDir, "manifest.json")) ||
               File.Exists(Path.Combine(root, "dist", "manifest.json"));
    }

    public static string ExtensionDirForDisplay() => Paths.ExtensionDir;

    public const string ManualInstallSteps =
        "1. Open the browser's extensions page (button below).\n" +
        "2. Enable Developer mode.\n" +
        "3. Click 'Load unpacked' and pick the extension 'dist' folder.\n" +
        "4. Pin 'Railway Booking Assistant', open the railway site, log in manually.";
}
