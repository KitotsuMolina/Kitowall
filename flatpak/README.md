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

## Flathub-Oriented (build from source)

This avoids copying host binaries (`kitowall-ui`, `node`) into the package and uses vendored dependencies.

Manifest:
- `io.kitotsu.KitoWall.flathub.yml`

Helper scripts:
- `../GENERATE_FLATHUB_SOURCES.sh`
- `../BUILD_FLATPAK_FROMSOURCE.sh`

Run:
```bash
cd /home/kitotsu/Programacion/Personal/Wallpaper/Kitowall
./GENERATE_FLATHUB_SOURCES.sh v1.0.6
./BUILD_FLATPAK_FROMSOURCE.sh
```

Notes:
- This is the right direction for Flathub policy.
- Manifest pins source by release tag/archive and sha256.
- Generated files are in `flatpak/generated-sources/`.

## Run
```bash
flatpak run io.kitotsu.KitoWall
```
