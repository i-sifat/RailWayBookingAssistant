# CI / release workflow staging

The two YAML files in this folder belong in `.github/workflows/`. They are parked
here because the API token used to open the PR that added them lacks GitHub's
`workflow` scope, which is required to create or modify anything under
`.github/workflows/`.

## One step after merging

```bash
git mv ci/release.yml .github/workflows/release.yml
git mv ci/ci.yml     .github/workflows/ci.yml
git rm ci/README.md
git commit -m "ci: move workflows into .github/workflows"
git push
```

That push lands `ci.yml` on `main` and immediately builds all three release RIDs,
so you get a green (or red) signal on `main` **before** cutting a tag.

## Why release v0.0.1 failed

Both runs on tag `v0.0.1` (commit `4fe4792`) died in `dotnet publish`:

```
desktop/Program.cs(16): error CS1061:
  'AppBuilder' does not contain a definition for 'WithInterFont'
```

`WithInterFont` ships in the `Avalonia.Fonts.Inter` package, which was never
referenced in `RailwayQuickBook.Desktop.csproj`. Commit `2247664` removed the
call, but `v0.0.1` still points at `4fe4792`, so Actions never rebuilt it.
A new tag on current `main` is required.

## Releasing

1. Bump `<Version>` in `desktop/RailwayQuickBook.Desktop.csproj`.
2. Commit, and let `ci` go green on `main`.
3. Tag and push, e.g. `git tag v0.0.1 && git push origin v0.0.1`.

### Careful with `+build` metadata in tags

A tag like `0.0.1+b1` is fine for the `.deb` filename (verified: `dpkg-deb`
accepts `+` in a Debian version), but **do not** feed it straight into MSBuild as
`-p:Version=0.0.1+b1` — `<Version>` only accepts a numeric `major.minor.patch`
core. If you ever want to wire the tag into the assembly version, strip the
metadata first and pass the remainder to `-p:InformationalVersion` instead:

```bash
CORE="${TAG#v}"; CORE="${CORE%%+*}"; CORE="${CORE%%-*}"   # 0.0.1+b1 -> 0.0.1
```
