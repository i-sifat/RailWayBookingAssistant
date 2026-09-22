using System.Diagnostics;
using RailwayQuickBook.Desktop.Models;

namespace RailwayQuickBook.Desktop.Services;

/// <summary>
/// Launches the user's chosen browser with a plain URL.
/// No remote debugging, no automation flags, no profile tampering —
/// the user logs in and uses the extension manually.
/// </summary>
public static class BrowserLauncher
{
    public static void OpenUrl(BrowserInfo browser, string url)
    {
        // --new-window guarantees a visible window with the page. Without it,
        // a running instance may open the URL in a background/minimized window
        // and the user only perceives "the browser opened".
        var psi = new ProcessStartInfo
        {
            FileName = browser.ExecutablePath,
            Arguments = $"--new-window \"{url}\"",
            UseShellExecute = false,
        };
        Process.Start(psi);
    }

    public static void OpenExtensionsPage(BrowserInfo browser)
    {
        OpenUrl(browser, browser.ExtensionsPageUrl);
    }
}
