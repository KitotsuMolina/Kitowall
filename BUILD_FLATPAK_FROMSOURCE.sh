#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$ROOT_DIR/flatpak/io.kitotsu.KitoWall.flathub.yml"
GEN_DIR="$ROOT_DIR/flatpak/generated-sources"

if [[ ! -f "$MANIFEST" ]]; then
  echo "Missing manifest: $MANIFEST"
  exit 1
fi

for f in node-deps-root.json node-deps-ui.json cargo-deps.json ui-package-lock.json; do
  if [[ ! -f "$GEN_DIR/$f" ]]; then
    echo "Missing generated source file: $GEN_DIR/$f"
    echo "Run first: ./GENERATE_FLATHUB_SOURCES.sh v1.0.7"
    exit 1
  fi
done

echo "==> Ensure flathub remote"
if ! flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo; then
  echo "Warning: could not refresh/add flathub remote (continuing offline)"
fi

echo "==> Install runtime/sdk/extensions for source build"
if ! flatpak install -y flathub \
  org.gnome.Platform//48 \
  org.gnome.Sdk//48 \
  org.freedesktop.Sdk.Extension.rust-stable//24.08 \
  org.freedesktop.Sdk.Extension.node20//24.08; then
  echo "Warning: could not install/update runtimes (offline or mirror issue). Checking local availability..."
fi

require_runtime() {
  local app="$1"
  local branch="$2"
  if ! flatpak list --runtime --columns=application,branch | rg -q "^${app}[[:space:]]+${branch}$"; then
    echo "Missing required runtime/extension: ${app}//${branch}"
    echo "Connect to internet and rerun this script."
    exit 1
  fi
}

require_runtime "org.gnome.Platform" "48"
require_runtime "org.gnome.Sdk" "48"
require_runtime "org.freedesktop.Sdk.Extension.rust-stable" "24.08"
require_runtime "org.freedesktop.Sdk.Extension.node20" "24.08"

echo "==> Build from source in sandbox (offline deps vendored)"
cd "$ROOT_DIR"
flatpak-builder flatpak/build-dir-src "$MANIFEST" --user --install --force-clean

echo "==> Done"
echo "Run: flatpak run io.kitotsu.KitoWall"
