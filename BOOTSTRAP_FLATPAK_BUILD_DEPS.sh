#!/usr/bin/env bash
set -euo pipefail

# Bootstrap host dependencies for:
#   ./GENERATE_FLATHUB_SOURCES.sh <tag>
#   ./BUILD_FLATPAK_FROMSOURCE.sh

WITH_RUST=1
WITH_RUNTIMES=1

usage() {
  cat <<'USAGE'
Usage: ./BOOTSTRAP_FLATPAK_BUILD_DEPS.sh [options]

Options:
  --no-rust       Do not install rust/cargo host toolchain.
  --no-runtimes   Do not install Flatpak runtimes/extensions.
  -h, --help      Show this help.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-rust)
      WITH_RUST=0
      ;;
    --no-runtimes)
      WITH_RUNTIMES=0
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

if ! command -v pacman >/dev/null 2>&1; then
  echo "This script currently supports Arch Linux (pacman) only."
  exit 1
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "Missing command: sudo"
  echo "Install sudo or run package install manually with pacman."
  exit 1
fi

PKGS=(
  git
  curl
  coreutils
  python
  python-pip
  nodejs
  npm
  flatpak
  flatpak-builder
  ripgrep
)

if [[ "$WITH_RUST" -eq 1 ]]; then
  PKGS+=(rust)
fi

echo "==> Installing required Arch packages"
sudo pacman -S --needed "${PKGS[@]}"

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command after install: $1"
    exit 1
  fi
}

need_cmd git
need_cmd curl
need_cmd sha256sum
need_cmd python3
need_cmd pip3
need_cmd node
need_cmd npm
need_cmd flatpak
need_cmd flatpak-builder
need_cmd rg

if [[ "$WITH_RUST" -eq 1 ]]; then
  need_cmd rustc
  need_cmd cargo
fi

if [[ "$WITH_RUNTIMES" -eq 1 ]]; then
  echo "==> Ensuring flathub remote"
  flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

  echo "==> Installing Flatpak runtimes/extensions used by build scripts"
  flatpak install -y flathub \
    org.gnome.Platform//48 \
    org.gnome.Sdk//48 \
    org.freedesktop.Sdk.Extension.rust-stable//24.08 \
    org.freedesktop.Sdk.Extension.node20//24.08
fi

echo "==> Host bootstrap complete"
echo "Next: ./GENERATE_FLATHUB_SOURCES.sh <tag> && ./BUILD_FLATPAK_FROMSOURCE.sh"
