using Avalonia;

namespace RailwayQuickBook.Desktop;

internal static class Program
{
    // Avalonia entry point. No telemetry, no backend calls.
    public static void Main(string[] args)
    {
        BuildAvaloniaApp().StartWithClassicDesktopLifetime(args);
    }

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .WithInterFont()
            .LogToTrace();
}
