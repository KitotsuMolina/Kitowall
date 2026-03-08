#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$ROOT_DIR/flatpak/io.kitotsu.KitoWall.integrated.local.yml"
GEN_DIR="$ROOT_DIR/flatpak/generated-sources"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1"
    exit 1
  fi
}

need_cmd flatpak
need_cmd flatpak-builder
need_cmd rg

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing manifest: $MANIFEST"
  exit 1
fi

for f in node-deps-root.json node-deps-ui.json cargo-deps.json ui-package-lock.json; do
  if [[ ! -f "$GEN_DIR/$f" ]]; then
    echo "Missing generated source file: $GEN_DIR/$f"
    echo "Run first: ./GENERATE_FLATHUB_SOURCES.sh <tag>"
    exit 1
  fi
done

echo "==> Ensure flathub remote"
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo || true

echo "==> Install runtime/sdk/extensions"
flatpak install -y flathub \
  org.gnome.Platform//48 \
  org.gnome.Sdk//48 \
  org.freedesktop.Sdk.Extension.rust-stable//24.08 \
  org.freedesktop.Sdk.Extension.node20//24.08

echo "==> Build integrated Flatpak (Kitowall + RenderCore)"
cd "$ROOT_DIR"
flatpak-builder flatpak/build-dir-integrated "$MANIFEST" --user --install --force-clean

echo "==> Done"
echo "Run: flatpak run io.kitotsu.KitoWall"
