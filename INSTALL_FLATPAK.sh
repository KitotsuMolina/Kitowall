#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLATPAK_MANIFEST="$ROOT_DIR/flatpak/io.kitotsu.KitoWall.yml"

if [[ ! -f "$FLATPAK_MANIFEST" ]]; then
  echo "Missing manifest: $FLATPAK_MANIFEST"
  exit 1
fi

if command -v pnpm >/dev/null 2>&1; then
  PKG="pnpm"
  RUN="$PKG run"
else
  PKG="npm"
  RUN="$PKG run"
  echo "[warn] pnpm not found, using npm instead."
fi

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1"
    exit 1
  fi
}

need_cmd flatpak
need_cmd flatpak-builder
need_cmd node

echo "==> Configure Flathub remote"
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

echo "==> Install Flatpak runtimes (GNOME 48)"
flatpak install -y flathub org.gnome.Platform//48 org.gnome.Sdk//48

echo "==> Build CLI"
cd "$ROOT_DIR"
$RUN build

echo "==> Build UI (Tauri release)"
cd "$ROOT_DIR/ui"
$RUN tauri:build

echo "==> Prepare Flatpak assets"
cd "$ROOT_DIR"
./flatpak/prepare.sh

echo "==> Build and install Flatpak"
flatpak-builder flatpak/build-dir flatpak/io.kitotsu.KitoWall.yml --user --install --force-clean

echo "==> Done"
echo "Run: flatpak run io.kitotsu.KitoWall"
