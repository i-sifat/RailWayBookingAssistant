namespace RailwayQuickBook.Desktop.Models;

/// <summary>
/// Launcher-only settings stored locally (JSON in app data).
/// Booking details themselves stay inside the browser extension
/// (chrome.storage.local). The desktop app never reads browser storage.
/// </summary>
public sealed class LauncherSettings
{
    public string PreferredBrowserId { get; set; } = "chrome";
    public string RailwayUrl { get; set; } = "https://eticket.railway.gov.bd/";
    public bool ExtensionMarkedInstalled { get; set; }
    /// <summary>"System" follows the OS; "Light"/"Dark" override it.</summary>
    public string ThemeMode { get; set; } = "System";
}
