using System.Text.Json;
using RailwayQuickBook.Desktop.Helpers;
using RailwayQuickBook.Desktop.Models;

namespace RailwayQuickBook.Desktop.Services;

/// <summary>Local JSON storage for launcher settings. No server, no sync.</summary>
public static class LocalStore
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static LauncherSettings Load()
    {
        try
        {
            if (File.Exists(Paths.SettingsFile))
            {
                var raw = File.ReadAllText(Paths.SettingsFile);
                var parsed = JsonSerializer.Deserialize<LauncherSettings>(raw);
                if (parsed is not null) return parsed;
            }
        }
        catch
        {
            // Corrupt file -> fall back to defaults (never crash on startup).
        }
        return new LauncherSettings();
    }

    public static void Save(LauncherSettings settings)
    {
        Directory.CreateDirectory(Helpers.Paths.AppDataDir);
        File.WriteAllText(Paths.SettingsFile, JsonSerializer.Serialize(settings, Json));
    }
}
