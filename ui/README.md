# Kitowall UI

Desktop app for `Kitowall` built with `Tauri + Svelte`.

Version: `1.0.6`.

## Requirements
- Root CLI built: `../dist/cli.js`
- System deps installed (see `../DEPENDENCIES.md`)

## Development
```bash
cd ui
npm install
npm run tauri:dev
```

Wayland fallback if needed:
```bash
WEBKIT_DISABLE_DMABUF_RENDERER=1 npm run tauri:dev
```

## Build Package
```bash
cd ui
npm run tauri:build
```

Output bundle:
- `ui/src-tauri/target/release/bundle/`

## Main Modules
- Control Center
- General Settings
- History
- Wallpapers
- Packs
- Logs

## Branding and Legal
- Project license: `../LICENSE.md`
- Attribution notice: `../NOTICE.md`
- Trademarks: `../TRADEMARKS.md`
- Logo license: `src/assets/logo-LICENSE.md`
