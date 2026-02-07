# Kitowall 1.0.0

First stable release for daily usage on Hyprland + Wayland + `swww`.

## Highlights
- Pack-based wallpaper rotation with per-output apply.
- Multi-source support:
  - `local`
  - `wallhaven`
  - `unsplash`
  - `reddit`
  - `generic_json`
  - `static_url`
- CLI + Desktop UI (Tauri/Svelte).
- History, favorites, logs, cache cleanup, and systemd integration.

## Included Artifacts
- CLI npm tarball: `kitowall-1.0.0.tgz`
- UI release binary:
  - `ui/src-tauri/target/release/kitowall-ui`

## Known Constraints
- Some remote sources may return rate-limit or access errors depending on API policy and keys.
- Wayland runtime behavior can vary by distro package versions.

## Attribution and Branding
- Software license and attribution: `LICENSE.md`, `NOTICE.md`
- Trademark and logo rules: `TRADEMARKS.md`, `ui/src/assets/logo-LICENSE.md`
