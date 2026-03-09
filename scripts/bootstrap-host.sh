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

wait_pacman_lock() {
  local lock_file="/var/lib/pacman/db.lck"
  local tries=0
  local max_tries=40

  while [[ -e "$lock_file" ]]; do
    # If a package manager is still running, just wait.
    if pgrep -x pacman >/dev/null 2>&1 || \
       pgrep -x yay >/dev/null 2>&1 || \
       pgrep -x paru >/dev/null 2>&1 || \
       pgrep -x makepkg >/dev/null 2>&1; then
      tries=$((tries + 1))
      if ((tries > max_tries)); then
        echo "[bootstrap] pacman lock is busy for too long: $lock_file" >&2
        return 1
      fi
      echo "[bootstrap] waiting for pacman lock (${tries}/${max_tries})..."
      sleep 3
      continue
    fi

    # No package process alive: stale lock, safe to remove.
    echo "[bootstrap] removing stale pacman lock: $lock_file"
    run_sudo rm -f "$lock_file"
    break
  done
}

ensure_user_bin_dirs() {
  local home_dir
  home_dir="${HOME:?HOME is required}"
  mkdir -p "$home_dir/.local/bin" "$home_dir/.cargo/bin"
}

install_arch_deps() {
  local repo_pkgs=(
    nodejs npm
    hyprland
    swww
    cava
    jq
    git
    base-devel
  )
  # Avoid rust/rustup conflicts on Arch.
  if need_cmd rustup; then
    repo_pkgs+=(rustup)
  elif need_cmd rustc && need_cmd cargo; then
    :
  else
    repo_pkgs+=(rustup)
  fi

  echo "[bootstrap] installing Arch repo packages: ${repo_pkgs[*]}"
  wait_pacman_lock
  run_sudo pacman -S --needed --noconfirm "${repo_pkgs[@]}"

  if need_cmd mpvpaper; then
    echo "[bootstrap] mpvpaper already installed"
    return
  fi

  # mpvpaper is typically distributed via AUR on Arch.
  if need_cmd yay; then
    echo "[bootstrap] installing AUR package: mpvpaper (yay)"
    if env -u PYTHONHOME -u PYTHONPATH HOME="${HOME}" \
      yay -S --needed --noconfirm --answerclean None --answerdiff None mpvpaper; then
      return
    fi
    echo "[bootstrap] warning: failed to install mpvpaper via yay (optional dependency)" >&2
    return
  fi
  if need_cmd paru; then
    echo "[bootstrap] installing AUR package: mpvpaper (paru)"
    if env -u PYTHONHOME -u PYTHONPATH HOME="${HOME}" \
      paru -S --needed --noconfirm --skipreview mpvpaper; then
      return
    fi
    echo "[bootstrap] warning: failed to install mpvpaper via paru (optional dependency)" >&2
    return
  fi

  echo "[bootstrap] warning: mpvpaper is missing and no AUR helper was found (yay/paru)." >&2
  echo "[bootstrap] warning: continue without mpvpaper (optional)." >&2
  return
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

install_github_release_bin() {
  local repo="$1"         # owner/name
  local asset_name="$2"   # exact asset name
  local out_bin="$3"      # absolute output path

  if ! need_cmd curl || ! need_cmd jq; then
    echo "[bootstrap] missing curl/jq for GitHub release install" >&2
    return 1
  fi

  local api_url="https://api.github.com/repos/${repo}/releases/latest"
  local asset_url
  asset_url="$(
    curl -fsSL "$api_url" | jq -r --arg n "$asset_name" '.assets[] | select(.name == $n) | .browser_download_url' | head -n1
  )"
  if [[ -z "${asset_url:-}" || "$asset_url" == "null" ]]; then
    echo "[bootstrap] release asset not found: ${repo} -> ${asset_name}" >&2
    return 1
  fi

  echo "[bootstrap] downloading ${repo} asset: ${asset_name}"
  curl -fL --retry 3 --retry-delay 2 "$asset_url" -o "$out_bin"
  chmod 755 "$out_bin"
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
  local home_dir="${HOME:?HOME is required}"
  local bin_dir="$home_dir/.local/bin"
  local release_ok=0

  # Prefer prebuilt binaries from GitHub Releases to avoid local toolchain/submodule issues.
  if install_github_release_bin "KitotsuMolina/Kitsune" "kitsune-linux-x86_64" "$bin_dir/kitsune" && \
     install_github_release_bin "KitotsuMolina/Kitsune" "kitsune-layer-linux-x86_64" "$bin_dir/kitsune-layer" && \
     install_github_release_bin "KitotsuMolina/Kitsune-RenderCore" "kitsune-rendercore-linux-x86_64" "$bin_dir/kitsune-rendercore"; then
    release_ok=1
  fi

  if [[ "$release_ok" -eq 1 ]]; then
    return
  fi

  echo "[bootstrap] warning: release binary install failed, falling back to cargo install" >&2
  if ! need_cmd cargo; then
    echo "[bootstrap] cargo is not available after dependency install" >&2
    exit 1
  fi
  cargo_install_git_bin "$KITSUNE_REPO" kitsune "" "$KITSUNE_TAG"
  cargo_install_git_bin "$KITSUNE_RENDERCORE_REPO" kitsune-rendercore "--features wayland-layer" "$KITSUNE_RENDERCORE_TAG"
}

verify_bins() {
  local required_bins=(kitowall kitsune kitsune-rendercore swww swww-daemon cava)
  local optional_bins=(mpvpaper)
  local missing=()
  for b in "${required_bins[@]}"; do
    if ! need_cmd "$b"; then
      missing+=("$b")
    fi
  done

  if ((${#missing[@]} > 0)); then
    echo "[bootstrap] missing binaries after bootstrap: ${missing[*]}" >&2
    exit 2
  fi

  local optional_missing=()
  for b in "${optional_bins[@]}"; do
    if ! need_cmd "$b"; then
      optional_missing+=("$b")
    fi
  done
  if ((${#optional_missing[@]} > 0)); then
    echo "[bootstrap] optional binaries missing: ${optional_missing[*]}" >&2
  fi
}

main() {
  # Some launchers provide a stale/non-existent CWD; recover to HOME.
  cd "${HOME:?HOME is required}" || true
  # Clean host Python env that can break AUR build tools (meson/python).
  unset PYTHONHOME || true
  unset PYTHONPATH || true

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
