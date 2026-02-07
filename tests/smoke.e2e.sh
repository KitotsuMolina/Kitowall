#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="node ${ROOT_DIR}/dist/cli.js"

echo "==> build"
cd "${ROOT_DIR}"
npm run build >/dev/null

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
export HOME="${TMP_DIR}/home"
mkdir -p "${HOME}/Pictures/Wallpapers/SmokeA"
mkdir -p "${HOME}/Pictures/Wallpapers/SmokeB"
mkdir -p "${HOME}/.config/hyprwall"
mkdir -p "${HOME}/.local/state/hyprwall"

# Seed fake image files for local packs.
touch "${HOME}/Pictures/Wallpapers/SmokeA/a1.jpg"
touch "${HOME}/Pictures/Wallpapers/SmokeA/a2.png"
touch "${HOME}/Pictures/Wallpapers/SmokeB/b1.jpg"

echo "==> pack add/update/show/list"
${CLI} pack add smoke-local --type local --paths "${HOME}/Pictures/Wallpapers/SmokeA" >/dev/null
${CLI} pack update smoke-local --paths "${HOME}/Pictures/Wallpapers/SmokeA,${HOME}/Pictures/Wallpapers/SmokeB" >/dev/null
${CLI} pack show smoke-local >/dev/null
${CLI} pack list >/dev/null

echo "==> hydrate local"
HYDRATE_OUT="$(${CLI} hydrate-pack smoke-local --count 10)"
echo "${HYDRATE_OUT}" | rg -q '"downloaded"'

echo "==> settings get/set"
${CLI} settings set --mode rotate --rotation-interval-sec 600 --transition-type center --transition-fps 60 --transition-duration 0.7 >/dev/null
SETTINGS_OUT="$(${CLI} settings get)"
echo "${SETTINGS_OUT}" | rg -q '"mode": "rotate"'

echo "==> favorites/history/logs"
${CLI} favorite add /tmp/smoke.jpg >/dev/null
${CLI} favorites >/dev/null
${CLI} favorite remove /tmp/smoke.jpg >/dev/null
${CLI} history --limit 5 >/dev/null
${CLI} history clear >/dev/null
${CLI} logs --limit 5 >/dev/null
${CLI} logs clear >/dev/null

echo "==> pool add/remove"
${CLI} pool enable >/dev/null
${CLI} pool add smoke-local --weight 2 --max 20 >/dev/null
${CLI} pool list >/dev/null
${CLI} pool remove smoke-local >/dev/null

echo "==> next graceful failure without compositor"
set +e
${CLI} next --pack smoke-local >/dev/null 2>&1
NEXT_CODE=$?
set -e
if [[ "${NEXT_CODE}" -eq 0 ]]; then
  echo "expected non-zero on environment without outputs" >&2
  exit 1
fi

echo "==> pack remove"
${CLI} pack remove smoke-local >/dev/null

echo "==> smoke e2e passed"
