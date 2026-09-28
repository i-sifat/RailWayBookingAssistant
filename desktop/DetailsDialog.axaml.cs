using Avalonia.Controls;

namespace RailwayQuickBook.Desktop;

public sealed partial class DetailsDialog : Window
{
    public DetailsDialog()
    {
        InitializeComponent();
        this.FindControl<Button>("CloseBtn")!.Click += (_, _) => Close();
    }

    public DetailsDialog(string dataDir, string installDir)
        : this()
    {
        this.FindControl<TextBlock>("DataDirText")!.Text = dataDir;
        this.FindControl<TextBlock>("InstallDirText")!.Text = installDir;
    }
}
