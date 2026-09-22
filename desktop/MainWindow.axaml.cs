using System.Collections.Generic;
using System.Linq;
using Avalonia;
using Avalonia.Controls;
using Avalonia.Controls.Primitives;
using Avalonia.Interactivity;
using Avalonia.Media;
using Avalonia.Styling;
using RailwayQuickBook.Desktop.Helpers;
using RailwayQuickBook.Desktop.Models;
using RailwayQuickBook.Desktop.Services;

namespace RailwayQuickBook.Desktop;

public sealed partial class MainWindow : Window
{
    private readonly LauncherSettings _settings;
    private IReadOnlyList<BrowserInfo> _browsers = new List<BrowserInfo>();
    private bool _updatingChips;

    public MainWindow()
    {
        InitializeComponent();
        _settings = LocalStore.Load();
        InstallTracker.EnsureTracked();
        ApplyTheme();
        WireEvents();
        RefreshAll();
    }

    protected override void OnOpened(EventArgs e)
    {
        base.OnOpened(e);
        try
        {
            // Fit small screens: shrink the dialog to the primary work area
            // (minus a margin) instead of overflowing off-screen.
            // Work area is device pixels; divide by the screen scaling factor.
            // (Uses Primary only: per-window screen lookup needs a newer
            // Avalonia than the pinned 11.0.10.)
            var screen = Screens.Primary;
            var area = screen?.WorkingArea;
            var scaling = screen?.Scaling ?? 1.0;
            if (area is null || scaling <= 0) return;
            var availW = area.Value.Width / scaling - 48;
            var availH = area.Value.Height / scaling - 64;
            if (availW < Width) Width = Math.Max(MinWidth, availW);
            if (availH < Height) Height = Math.Max(MinHeight, availH);
        }
        catch
        {
            // Keep the designed size; never fail startup over sizing.
        }
    }

    private void WireEvents()
    {
        this.FindControl<Button>("ThemeToggleBtn")!.Click += (_, _) => ToggleTheme();
        this.FindControl<Button>("RefreshBrowsersBtn")!.Click += (_, _) => RefreshAll();
        this.FindControl<Button>("OpenSiteBtn")!.Click += (_, _) => OpenSite();
        this.FindControl<Button>("OpenExtensionsPageBtn")!.Click += (_, _) => OpenExtensionsPage();
        this.FindControl<Button>("OpenExtensionFolderBtn")!.Click += (_, _) => OpenExtensionFolder();
        this.FindControl<Button>("CopyExtensionPathBtn")!.Click += async (_, _) => await CopyExtensionPathAsync();
        this.FindControl<Button>("UninstallDataBtn")!.Click += (_, _) => RemoveData();
        this.FindControl<Button>("ExitBtn")!.Click += (_, _) => Close();
        this.FindControl<ToggleSwitch>("ExtensionLoadedSwitch")!.IsCheckedChanged += (_, _) => SaveExtensionFlag();
    }

    // ----- Theme (top-right toggle, persisted, same XAML on Windows + Linux) -----

    private void ApplyTheme()
    {
        var app = Application.Current;
        if (app is null) return;
        app.RequestedThemeVariant = _settings.ThemeMode switch
        {
            "Light" => ThemeVariant.Light,
            "Dark" => ThemeVariant.Dark,
            _ => ThemeVariant.Default, // "System": follow the OS
        };
        SyncThemeLabel();
    }

    private void SyncThemeLabel()
    {
        var btn = this.FindControl<Button>("ThemeToggleBtn");
        if (btn is null) return;
        var mode = _settings.ThemeMode switch
        {
            "Light" => "Light",
            "Dark" => "Dark",
            _ => "Auto",
        };
        btn.Content = $"◐ {mode}";
    }

    private void ToggleTheme()
    {
        // First click from "System" lands on Dark; afterwards it alternates.
        _settings.ThemeMode = _settings.ThemeMode == "Dark" ? "Light" : "Dark";
        LocalStore.Save(_settings);
        ApplyTheme();
    }

    // ----- Refresh -----

    private void RefreshAll()
    {
        _browsers = BrowserDetector.Detect();
        RebuildChips();

        var selected = SelectedBrowser();
        var browserPill = this.FindControl<Border>("PillBrowser")!;
        var browserPillText = this.FindControl<TextBlock>("PillBrowserText")!;
        var browserSub = this.FindControl<TextBlock>("BrowserSubText")!;
        if (selected is null)
        {
            SetPill(browserPill, browserPillText, "Missing", "bad");
            browserSub.Text = "No supported browser found";
        }
        else
        {
            SetPill(browserPill, browserPillText, "Ready", "ok");
            browserSub.Text = BrowserLabel(selected) + " · default";
        }

        this.FindControl<TextBlock>("ExtensionDirText")!.Text =
            $"Extension dir: {ExtensionHelper.ExtensionDirForDisplay()}";
        this.FindControl<ToggleSwitch>("ExtensionLoadedSwitch")!.IsChecked =
            _settings.ExtensionMarkedInstalled;

        this.FindControl<TextBlock>("DataDirText")!.Text = $"Data: {Paths.AppDataDir}";
        this.FindControl<TextBlock>("InstallDirText")!.Text = $"Install: {AppContext.BaseDirectory}";

        RefreshInstallSection();

        this.FindControl<Button>("OpenSiteBtn")!.IsEnabled = selected is not null;
        var stepOneBtn = this.FindControl<Button>("OpenExtensionsPageBtn")!;
        stepOneBtn.Content = selected is null
            ? "Open Extension Page"
            : $"Open {selected.DisplayName} Extensions";
        SetStatus(_browsers.Count == 0
            ? "No supported browser found. Install Chrome, Edge, Brave, Opera, Chromium, or Firefox."
            : "Ready");
    }

    private static string BrowserLabel(BrowserInfo info) =>
        info.DisplayVersion is null ? info.DisplayName : $"{info.DisplayName} {info.DisplayVersion}";

    private void RebuildChips()
    {
        var panel = this.FindControl<WrapPanel>("BrowserChips")!;
        panel.Children.Clear();
        if (_browsers.Count == 0)
        {
            panel.Children.Add(new TextBlock
            {
                Text = "No supported browser detected.",
                Opacity = 0.75,
                TextWrapping = TextWrapping.Wrap,
            });
            return;
        }

        foreach (var browser in _browsers)
        {
            var captured = browser;
            var chip = new ToggleButton
            {
                Classes = { "chip" },
                Content = BrowserLabel(captured),
                Tag = captured,
            };
            chip.IsCheckedChanged += (_, _) => OnChipToggled(chip);
            panel.Children.Add(chip);
        }

        ToggleButton? pick = null;
        foreach (var child in panel.Children)
        {
            if (child is ToggleButton t && t.Tag is BrowserInfo info &&
                info.Id == _settings.PreferredBrowserId)
            {
                pick = t;
                break;
            }
        }
        pick ??= panel.Children.OfType<ToggleButton>().FirstOrDefault();
        if (pick is not null)
        {
            _updatingChips = true;
            pick.IsChecked = true;
            _updatingChips = false;
            SaveBrowserChoice();
        }
    }

    private void OnChipToggled(ToggleButton chip)
    {
        if (_updatingChips) return;
        var panel = this.FindControl<WrapPanel>("BrowserChips")!;
        if (chip.IsChecked == true)
        {
            _updatingChips = true;
            foreach (var child in panel.Children)
                if (child is ToggleButton t && !ReferenceEquals(t, chip))
                    t.IsChecked = false;
            _updatingChips = false;
            SaveBrowserChoice();
        }
        else if (!panel.Children.OfType<ToggleButton>().Any(t => t.IsChecked == true))
        {
            // Keep one browser selected at all times.
            _updatingChips = true;
            chip.IsChecked = true;
            _updatingChips = false;
        }
    }

    private BrowserInfo? SelectedBrowser()
    {
        var panel = this.FindControl<WrapPanel>("BrowserChips");
        if (panel is null) return null;
        foreach (var child in panel.Children)
            if (child is ToggleButton t && t.IsChecked == true && t.Tag is BrowserInfo info)
                return info;
        return null;
    }

    private static void SetPill(Border pill, TextBlock label, string text, string level)
    {
        label.Text = text;
        foreach (var cls in new[] { "ok", "warn", "bad" })
            pill.Classes.Remove(cls);
        pill.Classes.Add(level);
    }

    // ----- Actions (unchanged behavior, new layout) -----

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
        OpenBrowserExtensionsPage(browser);
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
        var toggle = this.FindControl<ToggleSwitch>("ExtensionLoadedSwitch")!;
        _settings.ExtensionMarkedInstalled = toggle.IsChecked == true;
        LocalStore.Save(_settings);
        RefreshInstallSection();
    }

    private void RefreshInstallSection()
    {
        var folderFound = ExtensionInstallService.TryGetExtensionRoot(out var dir, out _);
        this.FindControl<TextBlock>("ExtensionDirText")!.Text =
            folderFound ? $"Extension dir: {dir}" : ExtensionInstallService.ExtensionNotFoundMessage;
        this.FindControl<TextBlock>("InstallStatusText")!.Text =
            ExtensionInstallService.InstallStatusText(folderFound, _settings.ExtensionMarkedInstalled);
        this.FindControl<Button>("OpenExtensionFolderBtn")!.IsEnabled = folderFound;
        this.FindControl<Button>("CopyExtensionPathBtn")!.IsEnabled = folderFound;
        this.FindControl<TextBlock>("CopyConfirm")!.IsVisible = false;

        // Collapse the manual steps once the user confirms the extension is loaded.
        var ready = folderFound && _settings.ExtensionMarkedInstalled;
        this.FindControl<StackPanel>("ExtSteps")!.IsVisible = !ready;
        this.FindControl<TextBlock>("ExtReadyLine")!.IsVisible = ready;

        var extPill = this.FindControl<Border>("PillExt")!;
        var extPillText = this.FindControl<TextBlock>("PillExtText")!;
        var extSub = this.FindControl<TextBlock>("ExtSubText")!;
        if (!folderFound)
        {
            SetPill(extPill, extPillText, "Missing", "bad");
            extSub.Text = "Extension files not found";
        }
        else if (_settings.ExtensionMarkedInstalled)
        {
            SetPill(extPill, extPillText, "Ready", "ok");
            extSub.Text = "Loaded in the browser";
        }
        else
        {
            SetPill(extPill, extPillText, "Action needed", "warn");
            extSub.Text = "Needs to be loaded";
        }
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
