using System.Collections.Generic;
using System.Globalization;
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

/// <summary>
/// Three-step wizard UI (Browser → Load the extension → Open the railway
/// site). Only the current step is expanded; done steps collapse to a
/// summary line; exactly one primary button is visible at a time.
/// All browser/launch/clipboard/storage behavior is reused untouched.
/// </summary>
public sealed partial class MainWindow : Window
{
    private readonly LauncherSettings _settings;
    private IReadOnlyList<BrowserInfo> _browsers = new List<BrowserInfo>();
    private bool _updatingChips;
    private int _forcedStep;
    private bool _folderFound;
    private bool _canProvide;
    private string _folderDir = string.Empty;
    private DateTime _confirmRemoveUntil = DateTime.MinValue;

    public MainWindow()
    {
        InitializeComponent();
        _settings = LocalStore.Load();
        InstallTracker.EnsureTracked();
        ApplyTheme();
        WireEvents();
        RefreshAll();
    }

    private void WireEvents()
    {
        this.FindControl<Button>("ThemeToggleBtn")!.Click += (_, _) => ToggleTheme();
        this.FindControl<Button>("RefreshBrowsersBtn")!.Click += (_, _) => RefreshBrowserList();
        this.FindControl<Button>("OpenBrowserBtn")!.Click += async (_, _) => await OpenBrowserAsync();
        var copyUrlBtn = this.FindControl<Button>("CopyUrlBtn")!;
        copyUrlBtn.Click += async (_, _) => await CopyPageAddressAsync(copyUrlBtn);
        this.FindControl<Button>("OpenExtensionFolderBtn")!.Click += (_, _) => OpenExtensionFolder();
        var copyPathBtn = this.FindControl<Button>("CopyExtensionPathBtn")!;
        copyPathBtn.Click += async (_, _) => await CopyExtensionPathAsync(copyPathBtn);
        this.FindControl<Button>("OpenSiteBtn")!.Click += (_, _) => OpenSite();
        this.FindControl<Button>("DetailsBtn")!.Click += (_, _) =>
            new DetailsDialog(Paths.AppDataDir, AppContext.BaseDirectory).Show();
        this.FindControl<CheckBox>("ExtensionLoadedSwitch")!.IsCheckedChanged += (_, _) => SaveExtensionFlag();
        this.FindControl<Button>("UninstallDataBtn")!.Click += (_, _) => RemoveData();
        this.FindControl<Button>("ExitBtn")!.Click += (_, _) => Close();
        this.FindControl<Button>("LinkChange")!.Click += (_, _) => { _forcedStep = 1; Render(); };
        this.FindControl<Button>("LinkReview")!.Click += (_, _) => { _forcedStep = 2; Render(); };
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

    protected override void OnOpened(EventArgs e)
    {
        base.OnOpened(e);
        try
        {
            // Fit small screens: shrink the dialog to the primary work area
            // (minus a margin) instead of overflowing off-screen.
            // Work area is device pixels; divide by the screen scaling factor.
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

    // ----- Data -----

    private void RefreshAll()
    {
        _browsers = BrowserDetector.Detect();
        RebuildChips();
        _folderFound = ExtensionInstallService.TryGetExtensionRoot(out var dir, out _);
        _folderDir = dir;
        _canProvide = _folderFound || ExtensionBundle.HasEmbeddedFiles;
        Render();
    }

    /// <summary>
    /// Refresh re-detects browsers but never collapses the card: an open
    /// step 1 stays open, including when browsers appear for the first time.
    /// </summary>
    private void RefreshBrowserList()
    {
        var hadBrowsers = _browsers.Count > 0;
        RefreshAll();
        if (!hadBrowsers && _browsers.Count > 0)
        {
            _forcedStep = 1;
            Render();
        }
    }

    private static string BrowserLabel(BrowserInfo info) =>
        info.DisplayVersion is null ? info.DisplayName : $"{info.DisplayName} {info.DisplayVersion}";

    private void RebuildChips()
    {
        var panel = this.FindControl<WrapPanel>("BrowserChips")!;
        panel.Children.Clear();
        foreach (var browser in _browsers)
        {
            var captured = browser;
            var chip = new ToggleButton
            {
                Classes = { "chip" },
                Content = BrowserLabel(captured),
                Tag = captured
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

    private static void SetClass(Control control, string cls, bool on)
    {
        if (on)
        {
            if (!control.Classes.Contains(cls)) control.Classes.Add(cls);
        }
        else
        {
            control.Classes.Remove(cls);
        }
    }

    // ----- Step-state render -----

    private void Render()
    {
        var selected = SelectedBrowser();
        var hasBrowser = selected is not null;
        var loaded = _settings.ExtensionMarkedInstalled;
        var view = _forcedStep != 0 ? _forcedStep : (!hasBrowser ? 1 : (!loaded ? 2 : 3));

        // Progress: bars filled and label follow completion, never the forced view.
        var filled = !hasBrowser ? 0 : (loaded ? 2 : 1);
        SetClass(this.FindControl<Border>("Prog1")!, "done", filled >= 1);
        SetClass(this.FindControl<Border>("Prog2")!, "done", filled >= 2);
        this.FindControl<TextBlock>("ProgLabel")!.Text =
            !hasBrowser ? "Step 1 of 3" : (loaded ? "Ready to go" : "Step 2 of 3");

        var browserName = selected is null ? null : BrowserLabel(selected);

        // Step 1: done when a browser is chosen.
        RenderStepHead(1, hasBrowser, view == 1,
            hasBrowser ? browserName ?? "Browser" : "None detected",
            showLink: hasBrowser && view != 1, linkName: "LinkChange",
            bodyName: "Step1Body", showBody: view == 1);
        this.FindControl<Border>("ErrorBox")!.IsVisible = !hasBrowser;
        this.FindControl<WrapPanel>("BrowserChips")!.IsVisible = hasBrowser;

        // Step 2: done when the loaded flag is ticked.
        RenderStepHead(2, loaded, view == 2,
            !hasBrowser ? "Waiting for a browser"
                : loaded ? $"Loaded in {selected!.DisplayName}"
                : "Needs to be loaded",
            showLink: loaded && view != 2, linkName: "LinkReview",
            bodyName: "Step2Body", showBody: view == 2);
        var openBtn = this.FindControl<Button>("OpenBrowserBtn")!;
        openBtn.Content = selected is null ? "Open Browser" : $"Open {selected.DisplayName}";
        openBtn.IsEnabled = hasBrowser;
        var urlBox = this.FindControl<TextBlock>("ExtUrlBox")!;
        urlBox.Text = selected?.ExtensionsPageUrl ?? string.Empty;
        ToolTip.SetTip(urlBox, selected?.ExtensionsPageUrl);
        this.FindControl<TextBlock>("Step2Note")!.Text = selected is null
            ? "Open the address in your browser."
            : $"Open the address in {selected.DisplayName}.";
        var dirText = this.FindControl<TextBlock>("ExtensionDirText")!;
        if (_folderFound)
        {
            dirText.Text = $"Extension dir: {_folderDir}";
            ToolTip.SetTip(dirText, _folderDir);
        }
        else if (_canProvide)
        {
            dirText.Text = "Extension is bundled inside the app — a clean copy is prepared on first use.";
            ToolTip.SetTip(dirText, null);
        }
        else
        {
            dirText.Text = ExtensionInstallService.ExtensionNotFoundMessage;
            ToolTip.SetTip(dirText, null);
        }
        this.FindControl<Button>("OpenExtensionFolderBtn")!.IsEnabled = _usable();
        this.FindControl<Button>("CopyExtensionPathBtn")!.IsEnabled = _usable();
        this.FindControl<CheckBox>("ExtensionLoadedSwitch")!.IsChecked = loaded;

        // Step 3: active only when setup is complete; no button while locked.
        RenderStepHead(3, false, view == 3,
            loaded ? "One click away" : "Finish setup first",
            showLink: false, linkName: string.Empty,
            bodyName: "Step3Body", showBody: view == 3);
        this.FindControl<Button>("OpenSiteBtn")!.IsEnabled = loaded;

        // Status line.
        var dot = this.FindControl<Border>("StatusDot")!;
        SetClass(dot, "amber", false);
        SetClass(dot, "ready", false);
        SetClass(dot, "bad", false);
        var status = this.FindControl<TextBlock>("StatusText")!;
        if (!hasBrowser)
        {
            SetClass(dot, "bad", true);
            status.Text = "No supported browser detected.";
        }
        else if (loaded)
        {
            SetClass(dot, "ready", true);
            status.Text = selected is null
                ? "Extension loaded."
                : $"Extension loaded in {selected.DisplayName}.";
        }
        else
        {
            SetClass(dot, "amber", true);
            status.Text = "Extension not loaded yet.";
        }
    }

    private bool _usable() => _folderFound || _canProvide;

    private void RenderStepHead(
        int digit, bool done, bool active, string summary,
        bool showLink, string linkName, string bodyName, bool showBody)
    {
        var circle = this.FindControl<Border>($"Cir{digit}")!;
        var num = this.FindControl<TextBlock>($"Num{digit}")!;
        var title = this.FindControl<TextBlock>($"Title{digit}")!;
        var sum = this.FindControl<TextBlock>($"Sum{digit}")!;
        SetClass(circle, "done", done);
        SetClass(circle, "locked", !done && !active);
        num.Text = done ? "✓" : digit.ToString(System.Globalization.CultureInfo.InvariantCulture);
        SetClass(title, "locked", !done && !active);
        sum.Text = summary;
        if (!string.IsNullOrEmpty(linkName))
            this.FindControl<Button>(linkName)!.IsVisible = showLink;
        this.FindControl<StackPanel>(bodyName)!.IsVisible = showBody;
    }

    private void SaveBrowserChoice()
    {
        var browser = SelectedBrowser();
        if (browser is null) return;
        _settings.PreferredBrowserId = browser.Id;
        LocalStore.Save(_settings);
        // Deliberately keeps the open step: picking a chip must not
        // collapse the card out from under the user.
        Render();
    }

    private void SaveExtensionFlag()
    {
        var toggle = this.FindControl<CheckBox>("ExtensionLoadedSwitch")!;
        _settings.ExtensionMarkedInstalled = toggle.IsChecked == true;
        LocalStore.Save(_settings);
        _forcedStep = 0;
        Render();
    }

    // ----- Actions (behavior unchanged; only wiring targets moved) -----

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

    private async Task OpenBrowserAsync()
    {
        var browser = SelectedBrowser();
        if (browser is null)
        {
            SetStatus("Choose a detected browser first.");
            return;
        }
        try
        {
            // A fresh blank window (about:blank is honored everywhere).
            // The extensions address is copied too, because Chromium
            // ignores chrome:// pages passed on the command line.
            BrowserLauncher.OpenNewWindow(browser);
            var copied = await CopyTextAsync(browser.ExtensionsPageUrl);
            SetStatus(copied
                ? $"Opened {browser.DisplayName}, and the extensions address was copied — continue with Step 2."
                : $"Opened {browser.DisplayName}. Copy the address from Step 2.");
        }
        catch (Exception ex)
        {
            SetStatus($"Could not open {browser.DisplayName}: {ex.Message}");
        }
    }

    private async Task CopyPageAddressAsync(Button copyBtn)
    {
        var browser = SelectedBrowser();
        if (browser is null)
        {
            SetStatus("Choose a detected browser first.");
            return;
        }
        if (await CopyTextAsync(browser.ExtensionsPageUrl))
        {
            SetStatus("Extensions address copied — paste it into the browser's address bar and press Enter.");
            FlashCopied(copyBtn);
        }
        else
        {
            SetStatus("Clipboard is unavailable.");
        }
    }

    private async Task<bool> CopyTextAsync(string text)
    {
        try
        {
            var clipboard = TopLevel.GetTopLevel(this)?.Clipboard;
            if (clipboard is null) return false;
            await clipboard.SetTextAsync(text);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static async void FlashCopied(Button btn)
    {
        var original = btn.Content;
        btn.Content = "Copied";
        await Task.Delay(1500);
        if (Equals(btn.Content, "Copied")) btn.Content = original;
    }

    private void OpenExtensionFolder()
    {
        if (!ExtensionInstallService.TryGetOrExtractRoot(out var dir))
        {
            SetStatus(ExtensionInstallService.ExtensionNotFoundMessage);
            return;
        }
        try
        {
            ExtensionInstallService.OpenExtensionFolder(dir);
            SetStatus("Opened the extension folder (clean copy). In the browser: Developer mode → Load unpacked → select this folder.");
        }
        catch (Exception ex)
        {
            SetStatus($"Could not open extension folder: {ex.Message}");
        }
    }

    private async Task CopyExtensionPathAsync(Button copyBtn)
    {
        if (!ExtensionInstallService.TryGetOrExtractRoot(out var dir))
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
            FlashCopied(copyBtn);
        }
        catch (Exception ex)
        {
            SetStatus($"Could not copy path: {ex.Message}");
        }
    }

    private void RemoveData()
    {
        var btn = this.FindControl<Button>("UninstallDataBtn")!;
        if (DateTime.UtcNow > _confirmRemoveUntil)
        {
            _confirmRemoveUntil = DateTime.UtcNow.AddSeconds(8);
            btn.Content = "Click again to confirm";
            SetStatus("Click again to remove all local data.");
            return;
        }
        _confirmRemoveUntil = DateTime.MinValue;
        btn.Content = "Remove local data…";
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
