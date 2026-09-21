using System.Collections.Generic;

namespace RailwayQuickBook.Desktop.Models;

/// <summary>
/// Written on first run so a future uninstall can remove exactly what
/// was installed/touched. No registry persistence, no hidden files.
/// </summary>
public sealed class InstallRecord
{
    public string AppName { get; set; } = "RailwayQuickBook";
    public string Version { get; set; } = "1.0.0";
    public string InstallDir { get; set; } = string.Empty;
    public string DataDir { get; set; } = string.Empty;
    public string InstalledAtUtc { get; set; } = string.Empty;
    public string LastSeenAtUtc { get; set; } = string.Empty;
    public List<string> ManagedFiles { get; set; } = new();
}
