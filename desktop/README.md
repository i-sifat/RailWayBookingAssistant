# RailwayQuickBook Desktop (companion launcher)

Companion to the existing `Railway Booking Assistant` browser extension.
The extension is untouched — this app only:

- detects installed browsers (read-only),
- lets you pick one,
- launches the railway site / extensions page on your explicit click,
- stores launcher settings locally,
- tracks its install dir + local data for complete uninstall.

No backend, no telemetry, no silent browser installs, no registry persistence.

## Run (dev)

```powershell
dotnet run --project desktop/RailwayQuickBook.Desktop.csproj
```

Requires .NET 8 SDK.

## Publish Windows .exe (self-contained single-file)

```powershell
dotnet publish desktop/RailwayQuickBook.Desktop.csproj -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o desktop/publish/win-x64
dotnet publish desktop/RailwayQuickBook.Desktop.csproj -c Release -r win-arm64 --self-contained true /p:PublishSingleFile=true -o desktop/publish/win-arm64
```

After installing to a user's PC, first run writes
`%LocalAppData%\RailwayQuickBook\install.json` (install dir, data dir,
timestamps, managed files) for future complete removal.

## Slim download for PCs that already have .NET (framework-dependent)

Releases ship zips with the exe only:

- `RailwayQuickBook-win-x64.zip` (~90MB, self-contained — works by double-click)
- `RailwayQuickBook-win-x64-fx.zip` (~30MB, needs the **.NET 8 Desktop Runtime**
  from Microsoft: https://dotnet.microsoft.com/download/dotnet/8.0)

Unzip anywhere and run the exe inside. The built browser extension travels
*inside* the exe (embedded at publish; CI builds `dist/` first) — the first
click on *Open Extension Folder* / *Copy Extension Folder Path* extracts a
clean copy to `%LocalAppData%\RailwayQuickBook\extension` (re-extracted
automatically when the app updates). Build the fx variant with:

```powershell
dotnet publish desktop/RailwayQuickBook.Desktop.csproj -c Release -r win-x64 --no-self-contained /p:PublishSingleFile=true -o desktop/publish/win-x64-fx
```

Rule of thumb: send most users the self-contained `-win-x64.zip`
(zero prerequisites); offer the `-win-x64-fx.zip` to technical users who
already have the runtime.

## Linux / .deb

```bash
dotnet publish desktop/RailwayQuickBook.Desktop.csproj -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true -o desktop/publish/linux-x64
bash desktop/packaging/linux/build-deb.sh 1.0.0
```

## Config sharing

Launcher settings live in `%LocalAppData%\RailwayQuickBook\launcher-settings.json`
(browser choice, railway URL). Booking data stays in the extension's
`chrome.storage.local`. The desktop app never reads browser storage.
