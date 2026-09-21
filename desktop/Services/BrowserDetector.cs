using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using RailwayQuickBook.Desktop.Models;

namespace RailwayQuickBook.Desktop.Services;

/// <summary>
/// Read-only browser detection. Never modifies browsers, registry, or profiles.
/// Windows: well-known install paths + PATH lookup. Linux: PATH lookup.
/// </summary>
public static class BrowserDetector
{
    public static IReadOnlyList<BrowserInfo> Detect()
    {
        var found = new List<BrowserInfo>();

        if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
        {
            var programFiles = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            var programFilesX86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            void TryAdd(string id, string name, string? path, string extensionsPage)
            {
                var resolved = ResolveWindows(path);
                if (resolved is not null)
                    found.Add(new BrowserInfo(id, name, resolved, extensionsPage));
            }

            TryAdd("chrome", "Chrome", Path.Combine(programFiles, @"Google\Chrome\Application\chrome.exe"), "chrome://extensions");
            TryAdd("chrome", "Chrome", Path.Combine(programFilesX86, @"Google\Chrome\Application\chrome.exe"), "chrome://extensions");
            TryAdd("chrome", "Chrome", Path.Combine(localAppData, @"Google\Chrome\Application\chrome.exe"), "chrome://extensions");
            TryAdd("edge", "Microsoft Edge", Path.Combine(programFiles, @"Microsoft\Edge\Application\msedge.exe"), "edge://extensions");
            TryAdd("edge", "Microsoft Edge", Path.Combine(programFilesX86, @"Microsoft\Edge\Application\msedge.exe"), "edge://extensions");
            TryAdd("brave", "Brave", Path.Combine(programFiles, @"BraveSoftware\Brave-Browser\Application\brave.exe"), "brave://extensions");
            TryAdd("brave", "Brave", Path.Combine(programFilesX86, @"BraveSoftware\Brave-Browser\Application\brave.exe"), "brave://extensions");
            TryAdd("opera", "Opera", Path.Combine(programFiles, @"Opera\opera.exe"), "opera://extensions");
            TryAdd("opera", "Opera", Path.Combine(localAppData, @"Programs\Opera\opera.exe"), "opera://extensions");
            TryAdd("chromium", "Chromium", Path.Combine(programFiles, @"Chromium\Application\chrome.exe"), "chrome://extensions");
            TryAdd("firefox", "Firefox", Path.Combine(programFiles, @"Mozilla Firefox\firefox.exe"), "about:addons");
            TryAdd("firefox", "Firefox", Path.Combine(programFilesX86, @"Mozilla Firefox\firefox.exe"), "about:addons");

            // PATH fallback (e.g. portable or user installs on PATH).
            foreach (var (id, name, exe, page) in new (string, string, string, string)[]
            {
                ("chrome", "Chrome", "chrome.exe", "chrome://extensions"),
                ("edge", "Microsoft Edge", "msedge.exe", "edge://extensions"),
                ("brave", "Brave", "brave.exe", "brave://extensions"),
                ("firefox", "Firefox", "firefox.exe", "about:addons"),
            })
            {
                if (!found.Any(b => b.Id == id))
                {
                    var onPath = Which(exe);
                    if (onPath is not null)
                        found.Add(new BrowserInfo(id, name, onPath, page));
                }
            }
        }
        else
        {
            // Linux (also used for the .deb release).
            foreach (var (id, name, bins, page) in new (string, string, string[], string)[]
            {
                ("chrome", "Chrome", new[] { "google-chrome", "google-chrome-stable" }, "chrome://extensions"),
                ("chromium", "Chromium", new[] { "chromium", "chromium-browser" }, "chrome://extensions"),
                ("edge", "Microsoft Edge", new[] { "microsoft-edge", "microsoft-edge-stable" }, "edge://extensions"),
                ("brave", "Brave", new[] { "brave-browser", "brave" }, "brave://extensions"),
                ("opera", "Opera", new[] { "opera" }, "opera://extensions"),
                ("firefox", "Firefox", new[] { "firefox" }, "about:addons"),
            })
            {
                foreach (var bin in bins)
                {
                    var onPath = Which(bin);
                    if (onPath is not null)
                    {
                        found.Add(new BrowserInfo(id, name, onPath, page));
                        break;
                    }
                }
            }
        }

        return found
            .GroupBy(b => b.Id)
            .Select(g => g.First())
            .ToList();
    }

    private static string? ResolveWindows(string? path)
    {
        if (path is not null && File.Exists(path))
            return path;
        return null;
    }

    /// <summary>Transparent PATH lookup via `where` (Windows) or `which` (Unix).</summary>
    private static string? Which(string exe)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = RuntimeInformation.IsOSPlatform(OSPlatform.Windows) ? "where" : "which",
                Arguments = exe,
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            };
            using var p = Process.Start(psi);
            if (p is null) return null;
            var output = p.StandardOutput.ReadToEnd();
            p.WaitForExit(3000);
            var first = output.Split('\n', StringSplitOptions.RemoveEmptyEntries).FirstOrDefault()?.Trim();
            return first is not null && File.Exists(first) ? first : null;
        }
        catch
        {
            return null;
        }
    }
}
