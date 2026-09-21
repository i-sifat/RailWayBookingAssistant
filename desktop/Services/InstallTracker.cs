using System.Text.Json;
using RailwayQuickBook.Desktop.Helpers;
using RailwayQuickBook.Desktop.Models;

namespace RailwayQuickBook.Desktop.Services;

/// <summary>
/// Tracks install dir + touched files so uninstall can be complete.
/// Only writes inside %LocalAppData%/RailwayQuickBook (+ the app's own
/// install folder, which the installer owns). Reversible by design.
/// </summary>
public static class InstallTracker
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    /// <summary>Record first run; update last-seen timestamp afterwards.</summary>
    public static InstallRecord EnsureTracked()
    {
        Directory.CreateDirectory(Paths.AppDataDir);
        if (File.Exists(Paths.InstallRecordFile))
        {
            try
            {
                var existing = JsonSerializer.Deserialize<InstallRecord>(
                    File.ReadAllText(Paths.InstallRecordFile));
                if (existing is not null)
                {
                    existing.LastSeenAtUtc = DateTime.UtcNow.ToString("o");
                    existing.ManagedFiles = ManagedFileList(existing);
                    File.WriteAllText(Paths.InstallRecordFile, JsonSerializer.Serialize(existing, Json));
                    return existing;
                }
            }
            catch
            {
                // Recreate below.
            }
        }

        var record = new InstallRecord
        {
            InstallDir = AppContext.BaseDirectory,
            DataDir = Paths.AppDataDir,
            InstalledAtUtc = DateTime.UtcNow.ToString("o"),
            LastSeenAtUtc = DateTime.UtcNow.ToString("o"),
        };
        record.ManagedFiles = ManagedFileList(record);
        File.WriteAllText(Paths.InstallRecordFile, JsonSerializer.Serialize(record, Json));
        return record;
    }

    private static List<string> ManagedFileList(InstallRecord record)
    {
        // Everything we own: the data dir contents + the install dir listing.
        var files = new List<string> { Paths.SettingsFile, Paths.InstallRecordFile };
        try
        {
            if (Directory.Exists(record.DataDir))
                files.AddRange(Directory.GetFiles(record.DataDir, "*", SearchOption.AllDirectories));
        }
        catch
        {
            // Best effort.
        }
        return files.Distinct().ToList();
    }

    /// <summary>
    /// Remove all locally-owned data (settings + install record).
    /// The running .exe itself cannot delete itself; the UI tells the user
    /// to delete the install folder afterwards (or the uninstaller does).
    /// </summary>
    public static void RemoveLocalData()
    {
        try
        {
            if (Directory.Exists(Paths.AppDataDir))
                Directory.Delete(Paths.AppDataDir, recursive: true);
        }
        catch
        {
            // Surface via UI message instead of throwing.
            throw new IOException($"Could not remove {Paths.AppDataDir}. Close the app and delete it manually.");
        }
    }
}
