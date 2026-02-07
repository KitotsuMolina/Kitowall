# Flatpak Packaging

App ID: `io.kitotsu.KitoWall`

## Files
- `io.kitotsu.KitoWall.yml`: Flatpak manifest
- `io.kitotsu.KitoWall.desktop`: launcher entry
- `io.kitotsu.KitoWall.metainfo.xml`: AppStream metadata
- `prepare.sh`: copies UI binary, CLI `dist`, host `node` binary, and generates 64/128/256 icons

## Build Steps
```bash
npm run build

cd ui
npm run tauri:build
cd ..

./flatpak/prepare.sh

flatpak-builder flatpak/build-dir flatpak/io.kitotsu.KitoWall.yml --user --install --force-clean
```

## Run
```bash
flatpak run io.kitotsu.KitoWall
```
