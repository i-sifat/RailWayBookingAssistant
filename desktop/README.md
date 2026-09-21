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

## Linux / .deb

```bash
dotnet publish desktop/RailwayQuickBook.Desktop.csproj -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true -o desktop/publish/linux-x64
bash desktop/packaging/linux/build-deb.sh 1.0.0
```

## Config sharing

Launcher settings live in `%LocalAppData%\RailwayQuickBook\launcher-settings.json`
(browser choice, railway URL). Booking data stays in the extension's
`chrome.storage.local`. The desktop app never reads browser storage.
