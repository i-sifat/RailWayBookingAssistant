using Avalonia;
using Avalonia.Controls;

namespace RailwayQuickBook.Desktop;

public sealed partial class DetailsDialog : Window
{
    private string _dataDir = string.Empty;
    private string _installDir = string.Empty;

    public DetailsDialog()
    {
        InitializeComponent();
        this.FindControl<Button>("CloseBtn")!.Click += (_, _) => Close();
        var copyDataBtn = this.FindControl<Button>("CopyDataDirBtn")!;
        copyDataBtn.Click += async (_, _) => await CopyPathAsync(copyDataBtn, _dataDir);
        var copyInstallBtn = this.FindControl<Button>("CopyInstallDirBtn")!;
        copyInstallBtn.Click += async (_, _) => await CopyPathAsync(copyInstallBtn, _installDir);
    }

    public DetailsDialog(string dataDir, string installDir)
        : this()
    {
        _dataDir = dataDir;
        _installDir = installDir;
        this.FindControl<TextBlock>("DataDirText")!.Text = dataDir;
        this.FindControl<TextBlock>("InstallDirText")!.Text = installDir;
    }

    private async Task CopyPathAsync(Button copyBtn, string path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        try
        {
            var clipboard = TopLevel.GetTopLevel(this)?.Clipboard;
            if (clipboard is null) return;
            await clipboard.SetTextAsync(path);
            var original = copyBtn.Content;
            copyBtn.Content = "Copied";
            await Task.Delay(1500);
            if (Equals(copyBtn.Content, "Copied")) copyBtn.Content = original;
        }
        catch
        {
            // Clipboard unavailable; nothing to show in this dialog.
        }
    }
}
