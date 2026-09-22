using Avalonia;

namespace RailwayQuickBook.Desktop;

internal static class Program
{
    // Avalonia entry point. No telemetry, no backend calls.
    public static void Main(string[] args)
    {
        // OutputType is WinExe, so an unhandled startup exception produces no
        // console output and no dialog - the process just disappears and a
        // double-click looks like nothing happened. Record it so the next
        // failure is diagnosable instead of invisible.
        try
        {
            BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
        }
        catch (Exception ex)
        {
            TryWriteStartupLog(ex);
            throw;
        }
    }

    private static void TryWriteStartupLog(Exception ex)
    {
        try
        {
            var dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "RailwayQuickBook");
            Directory.CreateDirectory(dir);
            File.WriteAllText(
                Path.Combine(dir, "startup-error.log"),
                $"{DateTime.Now:o}{Environment.NewLine}{ex}{Environment.NewLine}");
        }
        catch
        {
            // Logging must never mask the original failure.
        }
    }

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .LogToTrace();
}
