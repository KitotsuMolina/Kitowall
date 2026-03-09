#!/usr/bin/env bash
set -euo pipefail

# Host bootstrap for AppImage/non-Flatpak installations.
# Installs system dependencies plus kitowall/kitsune/kitsune-rendercore binaries.

KITSUNE_REPO="${KITSUNE_REPO:-https://github.com/KitotsuMolina/Kitsune.git}"
KITSUNE_RENDERCORE_REPO="${KITSUNE_RENDERCORE_REPO:-https://github.com/KitotsuMolina/Kitsune-RenderCore.git}"
KITSUNE_TAG="${KITSUNE_TAG:-}"
KITSUNE_RENDERCORE_TAG="${KITSUNE_RENDERCORE_TAG:-}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_sudo() {
  if need_cmd sudo; then
    sudo "$@"
  else
    "$@"
  fi
}

ensure_user_bin_dirs() {
  local home_dir
  home_dir="${HOME:?HOME is required}"
  mkdir -p "$home_dir/.local/bin" "$home_dir/.cargo/bin"
}

install_arch_deps() {
  local repo_pkgs=(
    nodejs npm
    rust cargo
    hyprland
    swww
    cava
    jq
    git
    base-devel
  )
  echo "[bootstrap] installing Arch repo packages: ${repo_pkgs[*]}"
  run_sudo pacman -S --needed --noconfirm "${repo_pkgs[@]}"

  if need_cmd mpvpaper; then
    echo "[bootstrap] mpvpaper already installed"
    return
  fi

  # mpvpaper is typically distributed via AUR on Arch.
  if need_cmd yay; then
    echo "[bootstrap] installing AUR package: mpvpaper (yay)"
    yay -S --needed --noconfirm mpvpaper
    return
  fi
  if need_cmd paru; then
    echo "[bootstrap] installing AUR package: mpvpaper (paru)"
    paru -S --needed --noconfirm mpvpaper
    return
  fi

  echo "[bootstrap] mpvpaper is missing and no AUR helper was found (yay/paru)." >&2
  echo "[bootstrap] install an AUR helper, or install mpvpaper manually, then retry." >&2
  exit 1
}

install_ubuntu_deps() {
  local pkgs=(
    nodejs npm
    rustc cargo
    jq curl git
    mpv
    cava
  )
  echo "[bootstrap] installing Debian/Ubuntu packages: ${pkgs[*]}"
  run_sudo apt-get update
  run_sudo apt-get install -y "${pkgs[@]}"
}

install_system_deps() {
  if need_cmd pacman; then
    install_arch_deps
    return
  fi
  if need_cmd apt-get; then
    install_ubuntu_deps
    return
  fi
  echo "[bootstrap] unsupported distro package manager. Install manually: nodejs npm rust cargo swww hyprland mpvpaper cava" >&2
  exit 1
}

install_kitowall_cli() {
  if ! need_cmd npm; then
    echo "[bootstrap] npm is not available after dependency install" >&2
    exit 1
  fi
  local home_dir
  home_dir="${HOME:?HOME is required}"
  echo "[bootstrap] installing/updating kitowall CLI in user prefix ($home_dir/.local)"
  npm i -g --prefix "$home_dir/.local" kitowall
}

cargo_install_git_bin() {
  local repo="$1"
  local bin="$2"
  local extra_args="$3"
  local tag="${4:-}"

  local args=(install --git "$repo" --locked --force "$bin")
  if [[ -n "$tag" ]]; then
    args+=(--tag "$tag")
  fi
  if [[ -n "$extra_args" ]]; then
    # shellcheck disable=SC2206
    local split_extra=($extra_args)
    args+=("${split_extra[@]}")
  fi

  echo "[bootstrap] cargo ${args[*]}"
  cargo "${args[@]}"
}

install_kitsune_bins() {
  if ! need_cmd cargo; then
    echo "[bootstrap] cargo is not available after dependency install" >&2
    exit 1
  fi

  cargo_install_git_bin "$KITSUNE_REPO" kitsune "" "$KITSUNE_TAG"
  cargo_install_git_bin "$KITSUNE_RENDERCORE_REPO" kitsune-rendercore "--features wayland-layer" "$KITSUNE_RENDERCORE_TAG"
}

verify_bins() {
  local bins=(kitowall kitsune kitsune-rendercore swww swww-daemon mpvpaper cava)
  local missing=()
  for b in "${bins[@]}"; do
    if ! need_cmd "$b"; then
      missing+=("$b")
    fi
  done

  if ((${#missing[@]} > 0)); then
    echo "[bootstrap] missing binaries after bootstrap: ${missing[*]}" >&2
    exit 2
  fi
}

main() {
  ensure_user_bin_dirs
  install_system_deps
  install_kitowall_cli
  install_kitsune_bins
  verify_bins
  echo "[ok] host bootstrap complete"
  echo "[paths] HOME=$HOME"
  echo "[paths] kitowall=$(command -v kitowall || echo '<missing>')"
  echo "[paths] kitsune=$(command -v kitsune || echo '<missing>')"
  echo "[paths] kitsune-rendercore=$(command -v kitsune-rendercore || echo '<missing>')"
  echo "[next] run: kitowall init --namespace kitowall --apply --force"
}

main "$@"
