<img src="https://github.com/KitotsuMolina/Kitowall/blob/main/assets/kitowall.png?raw=true" alt="Kitowall" width="420" />

# Kitowall

`Kitowall` is a wallpaper manager for Hyprland/Wayland using `swww`.

Current version: `3.5.15`.

## What You Can Do
- Rotate wallpapers with transitions.
- Use different wallpapers per monitor.
- Organize by thematic packs (`sao`, `edgerunners`, etc.).
- Download from sources: `local`, `wallhaven`, `unsplash`, `reddit`, `generic_json`, `static_url`.
- Manage everything from CLI and desktop UI.

## Default Paths
- Config: `~/.config/kitowall/config.json`
- Runtime state: `~/.local/state/kitowall/state.json`
- History: `~/.local/state/kitowall/history.json`
- Logs: `~/.local/state/kitowall/logs.jsonl`
- Wallpapers: `~/Pictures/Wallpapers/<pack>`

## Quick Start (CLI)
```bash
npm install
npm run build

node dist/cli.js outputs
node dist/cli.js status
node dist/cli.js next
node dist/cli.js check --json
```

## Quick Start (UI)
```bash
cd ui
npm install
npm run tauri:dev
```

If your system needs it on Wayland:
```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri:dev
```

## AppImage (Recommended)
AppImage is now the primary desktop distribution for `kitowall-ui`.

1) Download the latest `Kitowall-<version>-x86_64.AppImage` from GitHub Releases.
2) Make it executable:
```bash
chmod +x ./Kitowall-*.AppImage
```
3) First-time host bootstrap (installs CLI/runtime dependencies on host):
```bash
./scripts/bootstrap-host.sh
```
If `bootstrap-host.sh` fails on Arch with errors like `zstd: undefined symbol: POOL_free` or `bsdtar: Write error`, repair core compression/archive libs and retry:
```bash
sudo pacman -Syu
sudo pacman -S --overwrite '*' zstd libarchive
```
Reason: this fixes host library mismatches (partial/out-of-sync updates) that break AUR package builds and package compression.

4) Initialize services:
```bash
kitowall init --namespace kitowall --apply --force
```

## Package / Release
- Release checklist: `RELEASE_CHECKLIST.md`
- Release notes: `RELEASE_NOTES_1.0.0.md`
- Dependencies: `DEPENDENCIES.md`
- AppImage CI: `.github/workflows/build-appimage.yml`

Main commands:
```bash
# Validate CLI before release
npm run release:check

# Build distributable CLI tarball
npm run package:cli

# Build desktop app package (Tauri)
npm run package:ui

# Full pipeline
npm run package:all
```

## User Docs
- Current status: `STATUS.md`
- Config examples: `CONFIG_EXAMPLES.md`
- UI details: `ui/README.md`

## Legal
- License: `LICENSE.md`
- Attribution notice: `NOTICE.md`
- Trademarks: `TRADEMARKS.md`
- Logo license: `ui/src/assets/logo-LICENSE.md`
