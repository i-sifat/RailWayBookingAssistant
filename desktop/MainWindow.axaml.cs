using System.Collections.Generic;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Interactivity;
using RailwayQuickBook.Desktop.Helpers;
using RailwayQuickBook.Desktop.Models;
using RailwayQuickBook.Desktop.Services;

namespace RailwayQuickBook.Desktop;

public sealed partial class MainWindow : Window
{
    private readonly LauncherSettings _settings;
    private IReadOnlyList<BrowserInfo> _browsers = new List<BrowserInfo>();

    public MainWindow()
    {
        InitializeComponent();
        _settings = LocalStore.Load();
        InstallTracker.EnsureTracked();
        WireEvents();
        RefreshAll();
    }

    private void WireEvents()
    {
        this.FindControl<Button>("RefreshBrowsersBtn")!.Click += (_, _) => RefreshAll();
        this.FindControl<Button>("OpenSiteBtn")!.Click += (_, _) => OpenSite();
        this.FindControl<Button>("OpenExtensionsPageBtn")!.Click += (_, _) => OpenExtensionsPage();
        this.FindControl<Button>("OpenBookingConfigBtn")!.Click += (_, _) => OpenExtensionsPage();
        this.FindControl<Button>("OpenChromeExtensionsBtn")!.Click += (_, _) => OpenChromeExtensions();
        this.FindControl<Button>("OpenExtensionFolderBtn")!.Click += (_, _) => OpenExtensionFolder();
        this.FindControl<Button>("CopyExtensionPathBtn")!.Click += async (_, _) => await CopyExtensionPathAsync();
        this.FindControl<Button>("UninstallDataBtn")!.Click += (_, _) => RemoveData();
        this.FindControl<Button>("ExitBtn")!.Click += (_, _) => Close();
        this.FindControl<ComboBox>("BrowserBox")!.SelectionChanged += (_, _) => SaveBrowserChoice();
        this.FindControl<CheckBox>("ExtensionInstalledCheck")!.IsCheckedChanged += (_, _) => SaveExtensionFlag();
    }

    private void RefreshAll()
    {
        _browsers = BrowserDetector.Detect();
        var box = this.FindControl<ComboBox>("BrowserBox")!;
        box.ItemsSource = _browsers.Select(b => b.DisplayName).ToList();

        var index = _browsers.ToList().FindIndex(b => b.Id == _settings.PreferredBrowserId);
        box.SelectedIndex = index >= 0 ? index : (_browsers.Count > 0 ? 0 : -1);

        var extDetected = ExtensionHelper.ExtensionSourceDetected();
        this.FindControl<TextBlock>("ExtensionStatus")!.Text =
            extDetected ? "✓ Detected (source folder present)" : "Not detected";
        this.FindControl<TextBlock>("ExtensionDir")!.Text =
            $"Extension dir: {ExtensionHelper.ExtensionDirForDisplay()}";
        this.FindControl<CheckBox>("ExtensionInstalledCheck")!.IsChecked = _settings.ExtensionMarkedInstalled;

        this.FindControl<TextBlock>("DataDirText")!.Text = $"Data: {Paths.AppDataDir}";
        this.FindControl<TextBlock>("InstallDirText")!.Text = $"Install: {AppContext.BaseDirectory}";

        RefreshInstallSection();

        SetStatus(_browsers.Count == 0
            ? "No supported browser found. Install Chrome, Edge, Brave, Opera, Chromium, or Firefox."
            : "Ready");
    }

    private BrowserInfo? SelectedBrowser()
    {
        var box = this.FindControl<ComboBox>("BrowserBox")!;
        if (box.SelectedIndex < 0 || box.SelectedIndex >= _browsers.Count) return null;
        return _browsers[box.SelectedIndex];
    }

    private void OpenSite()
    {
        var browser = SelectedBrowser();
        if (browser is null)
        {
            SetStatus("Choose a detected browser first.");
            return;
        }
        try
        {
            BrowserLauncher.OpenUrl(browser, _settings.RailwayUrl);
            SetStatus($"Opened railway site in {browser.DisplayName}. Log in manually, then use the extension.");
        }
        catch (Exception ex)
        {
            SetStatus($"Could not launch {browser.DisplayName}: {ex.Message}");
        }
    }

    private void OpenExtensionsPage()
    {
        var browser = SelectedBrowser();
        if (browser is null)
        {
            SetStatus("Choose a detected browser first.");
            return;
        }
        try
        {
            BrowserLauncher.OpenExtensionsPage(browser);
            SetStatus($"{ExtensionHelper.ManualInstallSteps}");
        }
        catch (Exception ex)
        {
            SetStatus($"Could not open extensions page: {ex.Message}");
        }
    }

    private void SaveBrowserChoice()
    {
        var browser = SelectedBrowser();
        if (browser is null) return;
        _settings.PreferredBrowserId = browser.Id;
        LocalStore.Save(_settings);
    }

    private void SaveExtensionFlag()
    {
        var check = this.FindControl<CheckBox>("ExtensionInstalledCheck")!;
        _settings.ExtensionMarkedInstalled = check.IsChecked == true;
        LocalStore.Save(_settings);
        RefreshInstallSection();
    }

    private void RefreshInstallSection()
    {
        var folderFound = ExtensionInstallService.TryGetExtensionRoot(out var dir, out _);
        this.FindControl<TextBlock>("InstallFolderStatus")!.Text =
            folderFound ? $"✓ Extension folder found\n{dir}" : ExtensionInstallService.ExtensionNotFoundMessage;
        this.FindControl<TextBlock>("InstallStatus")!.Text =
            ExtensionInstallService.InstallStatusText(folderFound, _settings.ExtensionMarkedInstalled);
        this.FindControl<Button>("OpenExtensionFolderBtn")!.IsEnabled = folderFound;
        this.FindControl<Button>("CopyExtensionPathBtn")!.IsEnabled = folderFound;
        this.FindControl<TextBlock>("CopyConfirm")!.IsVisible = false;

        // Equivalent "open extensions page" buttons for detected Chromium
        // browsers (Chrome has its own primary button above).
        var panel = this.FindControl<StackPanel>("ChromiumButtons")!;
        panel.Children.Clear();
        foreach (var browser in ExtensionInstallService.ChromiumBrowsers(_browsers)
                     .Where(b => !string.Equals(b.Id, "chrome", StringComparison.OrdinalIgnoreCase)))
        {
            var captured = browser;
            var btn = new Button { Content = $"Open {captured.DisplayName} Extensions" };
            btn.Click += (_, _) => OpenBrowserExtensionsPage(captured);
            panel.Children.Add(btn);
        }
    }

    private void OpenChromeExtensions()
    {
        var chrome = ExtensionInstallService.FindChrome(_browsers);
        if (chrome is null)
        {
            SetStatus(ExtensionInstallService.ChromeNotInstalledMessage);
            return;
        }
        OpenBrowserExtensionsPage(chrome);
    }

    private void OpenBrowserExtensionsPage(BrowserInfo browser)
    {
        try
        {
            BrowserLauncher.OpenExtensionsPage(browser);
            SetStatus(ExtensionHelper.ManualInstallSteps);
        }
        catch (Exception ex)
        {
            SetStatus($"Could not open {browser.DisplayName} extensions: {ex.Message}");
        }
    }

    private void OpenExtensionFolder()
    {
        if (!ExtensionInstallService.TryGetExtensionRoot(out var dir, out _))
        {
            SetStatus(ExtensionInstallService.ExtensionNotFoundMessage);
            return;
        }
        try
        {
            ExtensionInstallService.OpenExtensionFolder(dir);
            SetStatus("Opened extension folder. In Chrome: Developer mode → Load unpacked → select this folder.");
        }
        catch (Exception ex)
        {
            SetStatus($"Could not open extension folder: {ex.Message}");
        }
    }

    private async Task CopyExtensionPathAsync()
    {
        if (!ExtensionInstallService.TryGetExtensionRoot(out var dir, out _))
        {
            SetStatus(ExtensionInstallService.ExtensionNotFoundMessage);
            return;
        }
        try
        {
            var clipboard = TopLevel.GetTopLevel(this)?.Clipboard;
            if (clipboard is null)
            {
                SetStatus("Clipboard is unavailable.");
                return;
            }
            await clipboard.SetTextAsync(dir);
            this.FindControl<TextBlock>("CopyConfirm")!.IsVisible = true;
        }
        catch (Exception ex)
        {
            SetStatus($"Could not copy path: {ex.Message}");
        }
    }

    private void RemoveData()
    {
        try
        {
            InstallTracker.RemoveLocalData();
            SetStatus("Local data removed. Delete the install folder to finish uninstall, then close the app.");
        }
        catch (Exception ex)
        {
            SetStatus(ex.Message);
        }
    }

    private void SetStatus(string message)
    {
        this.FindControl<TextBlock>("StatusText")!.Text = message;
    }
}
