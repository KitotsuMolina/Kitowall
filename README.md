<img src="https://github.com/KitotsuMolina/Kitowall/blob/master/assets/kitowall.png?raw=true" alt="Kitowall" width="420" />

# Kitowall

`Kitowall` is a wallpaper manager for Hyprland/Wayland using `swww`.

Current version: `1.0.7`.

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

## Package / Release
- Release checklist: `RELEASE_CHECKLIST.md`
- Release notes: `RELEASE_NOTES_1.0.0.md`
- Dependencies: `DEPENDENCIES.md`
- Flatpak packaging: `flatpak/`

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

## Flatpak (Linux)
```bash
# 1) Build desktop binary
cd ui
npm run tauri:build
cd ..

# 2) Prepare flatpak sources (binary + icon)
./flatpak/prepare.sh

# 3) Build and install flatpak
flatpak-builder flatpak/build-dir flatpak/io.kitotsu.KitoWall.yml --user --install --force-clean
```

## User Docs
- Current status: `STATUS.md`
- Config examples: `CONFIG_EXAMPLES.md`
- UI details: `ui/README.md`

## Known Issues
- Flatpak watch unit failing with `/app/bin/node` in user systemd:
  - `issues/flatpak-watch-service-failed.md`

## Legal
- License: `LICENSE.md`
- Attribution notice: `NOTICE.md`
- Trademarks: `TRADEMARKS.md`
- Logo license: `ui/src/assets/logo-LICENSE.md`
