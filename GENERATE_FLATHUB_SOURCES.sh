#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FLATPAK_DIR="$ROOT_DIR/flatpak"
GEN_DIR="$FLATPAK_DIR/generated-sources"
TOOLS_DIR="/tmp/flatpak-builder-tools-kitowall"
NODEGEN_VENV="/tmp/flatpak-nodegen-venv-kitowall"
TAG="${1:-v1.0.6}"
ARCHIVE_URL="https://github.com/KitotsuMolina/Kitowall/archive/refs/tags/${TAG}.tar.gz"
TMP_UI_DIR=""

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing command: $1"
    exit 1
  fi
}

need_cmd git
need_cmd curl
need_cmd python3
need_cmd pip3
need_cmd sha256sum
need_cmd npm

cleanup() {
  if [[ -n "$TMP_UI_DIR" && -d "$TMP_UI_DIR" ]]; then
    rm -rf "$TMP_UI_DIR"
  fi
}
trap cleanup EXIT

mkdir -p "$GEN_DIR"

echo "==> Get flatpak-builder-tools"
rm -rf "$TOOLS_DIR"
git clone --depth 1 https://github.com/flatpak/flatpak-builder-tools.git "$TOOLS_DIR"

NODE_GEN_OLD="$TOOLS_DIR/node/flatpak-node-generator.py"
NODE_GEN_PKG_DIR="$TOOLS_DIR/node"
NODE_GEN_PYTHON="python3"

setup_node_gen_python() {
  if [[ -f "$NODE_GEN_OLD" ]]; then
    NODE_GEN_PYTHON="python3"
    return 0
  fi

  rm -rf "$NODEGEN_VENV"
  python3 -m venv "$NODEGEN_VENV"
  "$NODEGEN_VENV/bin/pip" install --upgrade pip setuptools wheel >/dev/null
  "$NODEGEN_VENV/bin/pip" install "$NODE_GEN_PKG_DIR" >/dev/null
  "$NODEGEN_VENV/bin/pip" install tomlkit >/dev/null
  NODE_GEN_PYTHON="$NODEGEN_VENV/bin/python"
}

run_node_gen() {
  local mode="$1"
  local lockfile="$2"
  local out="$3"
  if [[ -f "$NODE_GEN_OLD" ]]; then
    "$NODE_GEN_PYTHON" "$NODE_GEN_OLD" "$mode" "$lockfile" -o "$out"
  else
    "$NODE_GEN_PYTHON" -m flatpak_node_generator "$mode" "$lockfile" -o "$out"
  fi
}

pick_lock_and_mode() {
  local dir="$1"
  if [[ -f "$dir/package-lock.json" ]]; then
    echo "npm $dir/package-lock.json"
    return 0
  fi
  if [[ -f "$dir/yarn.lock" ]]; then
    echo "yarn $dir/yarn.lock"
    return 0
  fi
  return 1
}

setup_node_gen_python

echo "==> Generate Node sources (root)"
cd "$ROOT_DIR"
if read -r ROOT_MODE ROOT_LOCK < <(pick_lock_and_mode "$ROOT_DIR"); then
  run_node_gen "$ROOT_MODE" "$ROOT_LOCK" "$GEN_DIR/node-deps-root.json"
else
  echo "Missing supported lockfile in root (package-lock.json or yarn.lock)."
  exit 1
fi

echo "==> Generate Node sources (ui)"
if ! read -r UI_MODE UI_LOCK < <(pick_lock_and_mode "$ROOT_DIR/ui"); then
  echo "No supported lockfile in ui. Generating temporary package-lock.json..."
  TMP_UI_DIR="$(mktemp -d)"
  cp "$ROOT_DIR/ui/package.json" "$TMP_UI_DIR/"
  (
    cd "$TMP_UI_DIR"
    npm install --package-lock-only --no-audit --ignore-scripts --legacy-peer-deps
  )
  UI_MODE="npm"
  UI_LOCK="$TMP_UI_DIR/package-lock.json"
fi

if [[ -n "${UI_MODE:-}" && -n "${UI_LOCK:-}" && -f "${UI_LOCK:-}" ]]; then
  run_node_gen "$UI_MODE" "$UI_LOCK" "$GEN_DIR/node-deps-ui.json"
elif read -r UI_MODE UI_LOCK < <(pick_lock_and_mode "$ROOT_DIR/ui"); then
  run_node_gen "$UI_MODE" "$UI_LOCK" "$GEN_DIR/node-deps-ui.json"
else
  echo "Failed to prepare lockfile for ui. Need package-lock.json or yarn.lock."
  exit 1
fi

# Persist a lockfile for ui so sandbox builds can run npm ci --offline.
cp "$UI_LOCK" "$GEN_DIR/ui-package-lock.json"

echo "==> Generate Cargo sources (ui/src-tauri)"
"$NODE_GEN_PYTHON" "$TOOLS_DIR/cargo/flatpak-cargo-generator.py" \
  -o "$GEN_DIR/cargo-deps.json" \
  "$ROOT_DIR/ui/src-tauri/Cargo.lock"

echo "==> Compute release tarball sha256 for ${TAG}"
TMP_TAR="/tmp/kitowall-${TAG}.tar.gz"
curl -L "$ARCHIVE_URL" -o "$TMP_TAR"
SHA="$(sha256sum "$TMP_TAR" | awk '{print $1}')"
rm -f "$TMP_TAR"

echo "==> Update manifest with tag/url/sha256"
MANIFEST="$FLATPAK_DIR/io.kitotsu.KitoWall.flathub.yml"
sed -i "s|url: https://github.com/KitotsuMolina/Kitowall/archive/refs/tags/.*|url: ${ARCHIVE_URL}|" "$MANIFEST"
sed -i "s|sha256: .*|sha256: ${SHA}|" "$MANIFEST"

echo "==> Generated:"
echo "  - $GEN_DIR/node-deps-root.json"
echo "  - $GEN_DIR/node-deps-ui.json"
echo "  - $GEN_DIR/cargo-deps.json"
echo "  - $GEN_DIR/ui-package-lock.json"
echo "  - Manifest updated for $TAG with sha256=$SHA"
