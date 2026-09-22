# CI / release workflow staging

The two YAML files in this folder belong in `.github/workflows/`. They are parked
here because the API token used to open the PRs that added them lacks GitHub's
`workflow` scope, which is required to create or modify anything under
`.github/workflows/`.

## Still outstanding

`.github/workflows/` currently contains only the **old** `release.yml`. The
staged files are not active yet:

```bash
git mv ci/release.yml .github/workflows/release.yml
git mv ci/ci.yml     .github/workflows/ci.yml
git rm ci/README.md
git commit -m "ci: move workflows into .github/workflows"
git push
```

That push lands `ci.yml` on `main` and builds all three release RIDs, so you get
a signal on `main` **before** cutting a tag.

## Bug 1 - release v0.0.1 never built (fixed)

Both runs on tag `v0.0.1` (commit `4fe4792`) died in `dotnet publish`:

```
desktop/Program.cs(16): error CS1061:
  'AppBuilder' does not contain a definition for 'WithInterFont'
```

`WithInterFont` ships in the `Avalonia.Fonts.Inter` package, which was never
referenced. Commit `2247664` removed the call; tag `v0.0.1-b1` then built green.

## Bug 2 - the shipped exe did nothing when double-clicked (fixed)

Release `v0.0.1-b1` built successfully and published a 74 MB
`RailwayQuickBook.exe` that silently failed to start. Two causes:

**Native libraries were never shipped.** With `PublishSingleFile=true` the .NET
SDK excludes every NuGet asset of type `native` from the bundle unless
`IncludeNativeLibrariesForSelfExtract` is `true`, and leaves those files beside
the exe instead - see `_BundleExcludedFiles` in `Microsoft.NET.Publish.targets`:

```xml
<_BundleExcludedFiles Include="@(_FilesToBundle)"
  Condition="'%(_FilesToBundle.AssetType)' == 'native' and
             '$(IncludeNativeLibrariesForSelfExtract)' != 'true'" />
```

Avalonia contributes `libSkiaSharp`, `libHarfBuzzSharp` and `av_libglesv2` that
way. The workflow uploaded only `RailwayQuickBook.exe`, so on the user's machine
`UsePlatformDetect()` threw trying to load Skia. Because `OutputType` is
`WinExe` there is no console and no dialog, so the process just vanished.

The same applied to Linux: `build-deb.sh` copies only the single binary into the
`.deb`, so any sibling `.so` would have been missing there too.

Fixed with `<IncludeNativeLibrariesForSelfExtract>true</...>` in the csproj.
**Not** `IncludeAllContentForSelfExtract` - that one repoints
`AppContext.BaseDirectory` at the temp extraction directory and would break
`Paths.ProjectRoot` and the extension-folder detection.

**x64 and arm64 collided.** Both Windows matrix legs emitted a file named
`RailwayQuickBook.exe`. `action-gh-release` flattens `artifacts/**/*` to
basenames, so the release ended up with a single `RailwayQuickBook.exe` of
indeterminate architecture. Assets are now `RailwayQuickBook-win-x64.exe` and
`RailwayQuickBook-win-arm64.exe`.

Both workflows now fail the build if anything other than the exe/pdb is left in
the publish directory, so this cannot ship again.

## Diagnosing a silent startup failure

`Program.Main` writes any unhandled startup exception to:

```
%LOCALAPPDATA%\RailwayQuickBook\startup-error.log
```

Check there first. Windows Event Viewer -> Windows Logs -> Application also
records a .NET Runtime error with a stack trace.

## Releasing

1. Bump `<Version>` in `desktop/RailwayQuickBook.Desktop.csproj`.
2. Commit, and let `ci` go green on `main`.
3. Tag and push, e.g. `git tag v0.0.2 && git push origin v0.0.2`.
4. Download the asset for your architecture and confirm the window opens.

### Careful with `+build` metadata in tags

A tag like `0.0.1+b1` is fine for the `.deb` filename (`dpkg-deb` accepts `+` in
a Debian version), but **do not** feed it straight into MSBuild as
`-p:Version=0.0.1+b1` - `<Version>` only accepts a numeric `major.minor.patch`
core. Strip the metadata first:

```bash
CORE="${TAG#v}"; CORE="${CORE%%+*}"; CORE="${CORE%%-*}"   # 0.0.1+b1 -> 0.0.1
```
