hyprwall
========

CLI/daemon for Hyprland wallpapers using `swww` with pack-based random rotation. This project is independent from RandomWallpaperGnome3 and targets Wayland.

Goals (MVP)
- Per-output wallpapers via `swww img -o <output> ...`
- Pack-based random rotation (all outputs share the same pack per cycle)
- Simple CLI: `outputs`, `next`, `status`

Project Layout
- `src/cli.ts`: CLI entrypoint and command routing.
- `src/core/config.ts`: Config loading/saving and defaults.
- `src/core/state.ts`: Runtime state (current pack, last set wallpapers).
- `src/core/history.ts`: History append-only log.
- `src/core/outputs.ts`: Detect outputs using `hyprctl` or fallback to `swww query`.
- `src/core/controller.ts`: Orchestrates pack selection, image selection, and applying via `swww`.
- `src/core/scheduler.ts`: Rotation scheduler stub (future).
- `src/managers/swww.ts`: Applies wallpapers per output with transition settings.
- `src/adapters/localFolder.ts`: Local folder pack adapter (implemented).
- `src/adapters/*`: Stubs for future adapters.
- `src/utils/exec.ts`: Shell execution wrapper.
- `src/utils/fs.ts`: Filesystem helpers (config, history, image scan).

Config
Default config is created at:
`~/.config/hyprwall/config.json`

Example:
```json
{
  "mode": "manual",
  "rotation_interval_seconds": 1800,
  "transition": { "type": "center", "fps": 60, "duration": 0.7 },
  "packs": {
    "sao": { "type": "local", "paths": ["~/Pictures/Wallpapers/SAO"] },
    "edgerunners": { "type": "local", "paths": ["~/Pictures/Wallpapers/Edgerunners"] }
  }
}
```

State and History
- State: `~/.local/state/hyprwall/state.json`
- History: `~/.local/state/hyprwall/history.json`

Usage
- `hyprwall outputs`
- `hyprwall next [--pack <name>]`
- `hyprwall status`

Build
- `npm install`
- `npm run build`

Notes
- Only the local folder adapter is implemented right now.
- Remote adapters (Wallhaven/Reddit/Unsplash/Generic JSON/Static URL) are placeholders.


Codex
- ` codex resume 019c2d80-40eb-71f2-a695-99faf15744a8`