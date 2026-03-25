#!/usr/bin/env bash
set -euo pipefail

# Root-only helper for installing host system packages.
# Intended to be invoked via pkexec from Kitowall.

need_cmd() {
  command -v "$1" >/dev/null 2>&1
}

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "[bootstrap-system] this helper must run as root" >&2
    exit 1
  fi
}

wait_pacman_lock() {
  local lock_file="/var/lib/pacman/db.lck"
  local tries=0
  local max_tries=40

  while [[ -e "$lock_file" ]]; do
    if pgrep -x pacman >/dev/null 2>&1 || \
       pgrep -x yay >/dev/null 2>&1 || \
       pgrep -x paru >/dev/null 2>&1 || \
       pgrep -x makepkg >/dev/null 2>&1; then
      tries=$((tries + 1))
      if ((tries > max_tries)); then
        echo "[bootstrap-system] pacman lock busy for too long: $lock_file" >&2
        return 1
      fi
      echo "[bootstrap-system] waiting for pacman lock (${tries}/${max_tries})..."
      sleep 3
      continue
    fi

    echo "[bootstrap-system] removing stale pacman lock: $lock_file"
    rm -f "$lock_file"
    break
  done
}

install_arch_deps() {
  local repo_pkgs=(
    nodejs npm
    hyprland
    swww
    cava
    pkgconf
    gtk4
    gtk4-layer-shell
    jq
    git
    base-devel
  )

  if need_cmd rustup; then
    repo_pkgs+=(rustup)
  elif need_cmd rustc && need_cmd cargo; then
    :
  else
    repo_pkgs+=(rustup)
  fi

  echo "[bootstrap-system] installing Arch packages: ${repo_pkgs[*]}"
  wait_pacman_lock
  pacman -S --needed --noconfirm "${repo_pkgs[@]}"
}

install_ubuntu_deps() {
  local pkgs=(
    nodejs npm
    rustc cargo
    pkg-config
    libgtk-4-dev
    jq curl git
    cava
  )
  echo "[bootstrap-system] installing Debian/Ubuntu packages: ${pkgs[*]}"
  apt-get update
  apt-get install -y "${pkgs[@]}"
}

main() {
  require_root

  if need_cmd pacman; then
    install_arch_deps
    echo "[ok] system dependencies installed"
    exit 0
  fi

  if need_cmd apt-get; then
    install_ubuntu_deps
    echo "[ok] system dependencies installed"
    exit 0
  fi

  echo "[bootstrap-system] unsupported distro package manager. Install manually: nodejs npm rust cargo pkg-config gtk4 gtk4-layer-shell swww hyprland cava" >&2
  exit 1
}

main "$@"
