namespace RailwayQuickBook.Desktop.Helpers;

/// <summary>Local-only paths. No roaming sync, no server.</summary>
public static class Paths
{
    public static string AppDataDir =>
        Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "RailwayQuickBook");

    public static string SettingsFile => Path.Combine(AppDataDir, "launcher-settings.json");
    public static string InstallRecordFile => Path.Combine(AppDataDir, "install.json");

    /// <summary>
    /// Extension source shipped next to the desktop app (repo layout):
    /// project/{dist,manifest.json} beside project/desktop/.
    /// </summary>
    public static string ProjectRoot
    {
        get
        {
            var dir = AppContext.BaseDirectory;
            // Published single-file: BaseDirectory is the install dir.
            // Dev: .../desktop/bin/Debug/net8.0/ -> walk up to repo root.
            var current = new DirectoryInfo(dir);
            for (var i = 0; i < 6 && current is not null; i++)
            {
                if (File.Exists(Path.Combine(current.FullName, "manifest.json")) ||
                    (Directory.Exists(Path.Combine(current.FullName, "desktop")) &&
                     Directory.Exists(Path.Combine(current.FullName, "src"))))
                {
                    return current.FullName;
                }
                current = current.Parent;
            }
            return AppContext.BaseDirectory;
        }
    }

    public static string ExtensionDir => Path.Combine(ProjectRoot, "dist") is var d && Directory.Exists(d)
        ? d
        : Path.Combine(ProjectRoot, "src");
}
