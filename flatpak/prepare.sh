#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FLATPAK_DIR="$ROOT_DIR/flatpak"
BIN_SRC="$ROOT_DIR/ui/src-tauri/target/release/kitowall-ui"
ICON_SRC="$ROOT_DIR/assets/kitowall-icon.png"
CLI_DIST_SRC="$ROOT_DIR/dist"
NODE_SRC="$(command -v node || true)"

if [[ ! -f "$BIN_SRC" ]]; then
  echo "Missing binary: $BIN_SRC"
  echo "Run: cd ui && npm run tauri:build"
  exit 1
fi

if [[ ! -f "$ICON_SRC" ]]; then
  echo "Missing icon: $ICON_SRC"
  exit 1
fi

if [[ ! -d "$CLI_DIST_SRC" ]]; then
  echo "Missing CLI dist: $CLI_DIST_SRC"
  echo "Run: npm run build"
  exit 1
fi

if [[ -z "$NODE_SRC" || ! -x "$NODE_SRC" ]]; then
  echo "Missing node binary in PATH"
  exit 1
fi

cp -f "$BIN_SRC" "$FLATPAK_DIR/kitowall-ui"
cp -f "$NODE_SRC" "$FLATPAK_DIR/node"
rm -rf "$FLATPAK_DIR/dist"
cp -r "$CLI_DIST_SRC" "$FLATPAK_DIR/dist"
tar -cf "$FLATPAK_DIR/kitowall-dist.tar" -C "$FLATPAK_DIR/dist" .

cat > "$FLATPAK_DIR/kitowall" <<'EOF'
#!/usr/bin/env sh
exec /app/bin/node /app/lib/kitowall/dist/cli.js "$@"
EOF
chmod +x "$FLATPAK_DIR/kitowall"

# Flatpak icon validation requires <= 512x512. We generate a canonical 256x256 icon.
ffmpeg -y -i "$ICON_SRC" \
  -vf "scale=64:64:force_original_aspect_ratio=decrease,pad=64:64:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
  -frames:v 1 -update 1 \
  "$FLATPAK_DIR/io.kitotsu.KitoWall-64.png" >/dev/null 2>&1

ffmpeg -y -i "$ICON_SRC" \
  -vf "scale=128:128:force_original_aspect_ratio=decrease,pad=128:128:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
  -frames:v 1 -update 1 \
  "$FLATPAK_DIR/io.kitotsu.KitoWall-128.png" >/dev/null 2>&1

ffmpeg -y -i "$ICON_SRC" \
  -vf "scale=256:256:force_original_aspect_ratio=decrease,pad=256:256:(ow-iw)/2:(oh-ih)/2:color=0x00000000" \
  -frames:v 1 -update 1 \
  "$FLATPAK_DIR/io.kitotsu.KitoWall-256.png" >/dev/null 2>&1

echo "Prepared flatpak sources:"
echo "  - $FLATPAK_DIR/kitowall-ui"
echo "  - $FLATPAK_DIR/node"
echo "  - $FLATPAK_DIR/kitowall"
echo "  - $FLATPAK_DIR/dist"
echo "  - $FLATPAK_DIR/kitowall-dist.tar"
echo "  - $FLATPAK_DIR/io.kitotsu.KitoWall-64.png"
echo "  - $FLATPAK_DIR/io.kitotsu.KitoWall-128.png"
echo "  - $FLATPAK_DIR/io.kitotsu.KitoWall-256.png"
