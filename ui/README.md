# Kitowall UI

Desktop app for `Kitowall` built with `Electron + Svelte`.

Version: `1.0.7`.

## Requirements
- Root CLI built: `../dist/cli.js`
- System deps installed (see `../DEPENDENCIES.md`)

## Development
```bash
cd ui
npm install
npm run electron:dev
```

## Build Package
```bash
cd ui
npm run electron:build
```

Output bundle:
- `ui/dist/`
- AppImage: `ui/dist/*.AppImage` depending on builder output

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
