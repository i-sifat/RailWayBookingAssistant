namespace RailwayQuickBook.Desktop.Models;

/// <summary>A detected browser. Path is launch target; never modified by the app.</summary>
public sealed record BrowserInfo(
    string Id,          // chrome, edge, brave, opera, chromium, firefox
    string DisplayName,
    string ExecutablePath,
    string ExtensionsPageUrl);
