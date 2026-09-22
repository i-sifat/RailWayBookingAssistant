using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using RailwayQuickBook.Desktop.Helpers;

namespace RailwayQuickBook.Desktop.Services;

/// <summary>
/// The browser extension travels INSIDE the exe as embedded resources
/// (logical names "extension/...", see RailwayQuickBook.Desktop.csproj).
/// On first use, a clean copy is extracted to
/// %LocalAppData%/RailwayQuickBook/extension — that copy is what the
/// Open/Copy buttons hand to the user and to Chrome's Load unpacked.
/// Nothing is written next to the exe, and repo files are never touched.
/// Re-extraction happens automatically when the embedded payload changes
/// (fingerprinted), so app updates always refresh the copy.
/// </summary>
public static class ExtensionBundle
{
    private const string Prefix = "extension/";
    private const string StampFile = ".rqb-bundle";

    public static string TargetDir =>
        Path.Combine(Paths.AppDataDir, "extension");

    /// <summary>True when this exe actually carries embedded extension files.</summary>
    public static bool HasEmbeddedFiles
    {
        get
        {
            try
            {
                return ListResourceNames().Count > 0;
            }
            catch
            {
                return false;
            }
        }
    }

    /// <summary>True when a valid extracted copy already exists.</summary>
    public static bool IsExtracted()
    {
        try
        {
            var dir = TargetDir;
            return File.Exists(Path.Combine(dir, "manifest.json")) &&
                   File.Exists(Path.Combine(dir, StampFile));
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Path of the clean copy, extracting (or re-extracting on payload
    /// change) on demand. Throws FileNotFoundException when the exe
    /// carries no bundle; the caller falls back to repo/shipped folders.
    /// </summary>
    public static string EnsureExtracted()
    {
        var names = ListResourceNames();
        if (names.Count == 0)
            throw new FileNotFoundException("This copy of the app carries no embedded browser extension.");

        var dir = Path.GetFullPath(TargetDir);
        var stamp = Fingerprint(names);
        var stampPath = Path.Combine(dir, StampFile);
        var manifestPath = Path.Combine(dir, "manifest.json");

        string? existing = null;
        try
        {
            if (File.Exists(stampPath))
                existing = File.ReadAllText(stampPath).Trim();
        }
        catch
        {
            // Treat as stale; re-extract below.
        }

        if (!string.Equals(existing, stamp, StringComparison.Ordinal) || !File.Exists(manifestPath))
        {
            ExtractAll(dir, names);
            File.WriteAllText(stampPath, stamp);
        }
        return dir;
    }

    private static List<string> ListResourceNames()
    {
        var asm = Assembly.GetExecutingAssembly();
        return asm.GetManifestResourceNames()
            .Where(n => n.StartsWith(Prefix, StringComparison.Ordinal))
            .OrderBy(n => n, StringComparer.Ordinal)
            .ToList();
    }

    private static string Fingerprint(IReadOnlyList<string> names)
    {
        var asm = Assembly.GetExecutingAssembly();
        using var sha = SHA256.Create();
        using var ms = new MemoryStream();
        foreach (var name in names)
        {
            var nameBytes = Encoding.UTF8.GetBytes(name);
            ms.Write(nameBytes, 0, nameBytes.Length);
            using var s = asm.GetManifestResourceStream(name);
            if (s is null) continue;
            s.CopyTo(ms);
        }
        return Convert.ToHexString(sha.ComputeHash(ms.ToArray()));
    }

    private static void ExtractAll(string dir, IReadOnlyList<string> names)
    {
        var asm = Assembly.GetExecutingAssembly();
        var fullDir = Path.GetFullPath(dir);
        if (Directory.Exists(fullDir))
            Directory.Delete(fullDir, recursive: true);
        Directory.CreateDirectory(fullDir);

        foreach (var name in names)
        {
            var relative = name.Substring(Prefix.Length);
            var parts = relative.Split(new[] { '/', '\\' }, StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 0) continue;
            var target = Path.GetFullPath(Path.Combine(new[] { fullDir }.Concat(parts).ToArray()));
            if (!target.StartsWith(fullDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                continue; // never write outside the target dir
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);
            using var src = asm.GetManifestResourceStream(name);
            if (src is null) continue;
            using var dst = File.Create(target);
            src.CopyTo(dst);
        }
    }
}
