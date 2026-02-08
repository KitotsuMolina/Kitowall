# Generated Sources (Flathub)

This folder contains vendored dependency descriptors required for offline/reproducible Flatpak builds:

- `node-deps-root.json`
- `node-deps-ui.json`
- `cargo-deps.json`

Generate/update them with:

```bash
./GENERATE_FLATHUB_SOURCES.sh v1.0.6
```

Then build:

```bash
./BUILD_FLATPAK_FROMSOURCE.sh
```
