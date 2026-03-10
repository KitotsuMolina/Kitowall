#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install github-cli package." >&2
  exit 1
fi

usage() {
  cat <<'USAGE'
Usage: ./scripts/release-github.sh [OPTIONS]

Version selection:
  --patch             Bump patch version (x.y.Z -> x.y.Z+1)
  --minor             Bump minor version (x.Y.z -> x.Y+1.0)
  --major             Bump major version (X.y.z -> X+1.0.0)
  --set <VERSION>     Set explicit version (e.g. 3.6.0)

Behavior:
  --sync-ui           Also sync UI versions (ui/package.json + ui/src-tauri/Cargo.toml)
  --with-ui           Legacy alias of --with-appimage
  --with-appimage     Build Tauri AppImage and upload it as release asset
  --publish-npm       Publish CLI package to npm registry
  --no-commit         Do not create/push version bump commit
  -h, --help          Show this help
USAGE
}

current_version() {
  node -p "require('./package.json').version"
}

is_semver() {
  [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

bump_semver() {
  local v="$1" mode="$2"
  IFS='.' read -r major minor patch <<<"$v"
  case "$mode" in
    patch) patch=$((patch + 1)) ;;
    minor) minor=$((minor + 1)); patch=0 ;;
    major) major=$((major + 1)); minor=0; patch=0 ;;
    *) echo "invalid bump mode: $mode" >&2; exit 1 ;;
  esac
  printf "%d.%d.%d\n" "$major" "$minor" "$patch"
}

set_root_version() {
  local version="$1"
  npm version --no-git-tag-version "$version" >/dev/null
}

set_ui_version() {
  ./scripts/sync-ui-version.sh
  (cd ui/src-tauri && cargo generate-lockfile)
}

bump_mode=""
set_version=""
sync_ui=false
with_ui=false
with_appimage=false
publish_npm=false
do_commit=true
while (($#)); do
  case "$1" in
    --patch) bump_mode="patch" ;;
    --minor) bump_mode="minor" ;;
    --major) bump_mode="major" ;;
    --set)
      shift
      set_version="${1:-}"
      ;;
    --sync-ui) sync_ui=true ;;
    --with-ui) with_ui=true ;;
    --with-appimage) with_appimage=true ;;
    --publish-npm) publish_npm=true ;;
    --no-commit) do_commit=false ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
  shift
done

if [[ "$with_ui" == true ]]; then
  with_appimage=true
fi

if [[ -n "$bump_mode" && -n "$set_version" ]]; then
  echo "Use either --set or --patch/--minor/--major, not both." >&2
  exit 1
fi

CURRENT_VERSION="$(current_version)"
if [[ -z "$CURRENT_VERSION" ]]; then
  echo "Could not determine version from package.json" >&2
  exit 2
fi

if ! is_semver "$CURRENT_VERSION"; then
  echo "Current package.json version is not simple semver (x.y.z): $CURRENT_VERSION" >&2
  exit 2
fi

VERSION="$CURRENT_VERSION"
if [[ -n "$set_version" ]]; then
  if ! is_semver "$set_version"; then
    echo "Invalid --set version (expected x.y.z): $set_version" >&2
    exit 1
  fi
  VERSION="$set_version"
elif [[ -n "$bump_mode" ]]; then
  VERSION="$(bump_semver "$CURRENT_VERSION" "$bump_mode")"
fi

if [[ "$VERSION" != "$CURRENT_VERSION" ]]; then
  echo "[release] version bump: $CURRENT_VERSION -> $VERSION"
  set_root_version "$VERSION"
  if [[ "$sync_ui" == true ]]; then
    set_ui_version "$VERSION"
  fi

  if [[ "$do_commit" == true ]]; then
    git add package.json package-lock.json
    if [[ "$sync_ui" == true ]]; then
      git add ui/package.json ui/package-lock.json ui/src-tauri/Cargo.toml ui/src-tauri/Cargo.lock
    fi
    git commit -m "chore(release): ${VERSION}" || true
    git push origin main
  fi
fi

TAG="$VERSION"

./scripts/sync-ui-version.sh

echo "[release] building CLI package"
npm ci
npm run build

ASSET_DIR="$ROOT_DIR/dist"
mkdir -p "$ASSET_DIR"
# Avoid recursive package bloat: old release artifacts inside dist/ must not be included in npm pack.
find "$ASSET_DIR" -maxdepth 1 -type f \( -name '*.tgz' -o -name 'kitowall-ui-linux-*' \) -delete
TARBALL="$(npm pack | tail -n1)"
mv -f "$TARBALL" "$ASSET_DIR/$TARBALL"

if [[ "$publish_npm" == true ]]; then
  echo "[release] publishing CLI to npm"
  npm publish --access public
fi

APPIMAGE_ASSET=""
if [[ "$with_appimage" == true ]]; then
  echo "[release] building UI AppImage"
  if [[ -f "ui/pnpm-lock.yaml" ]]; then
    if command -v pnpm >/dev/null 2>&1; then
      pnpm -C ui install --frozen-lockfile
    else
      corepack pnpm -C ui install --frozen-lockfile
    fi
  elif [[ -f "ui/package-lock.json" ]]; then
    npm --prefix ui ci
  else
    npm --prefix ui install --no-audit --progress=false
  fi
  find ui/src-tauri/target -type f \( -iname '*.AppImage' -o -iname '*.appimage' \) -delete
  if [[ -f "ui/pnpm-lock.yaml" ]]; then
    if command -v pnpm >/dev/null 2>&1; then
      pnpm -C ui run tauri:build -- --bundles appimage
    else
      corepack pnpm -C ui run tauri:build -- --bundles appimage
    fi
  elif [[ -f "ui/package-lock.json" ]]; then
    npm --prefix ui run tauri:build -- --bundles appimage
  else
    npm --prefix ui run tauri:build -- --bundles appimage
  fi
  APPIMAGE_PATH="$(
    find ui/src-tauri/target -type f \( -iname '*.AppImage' -o -iname '*.appimage' \) -printf '%T@ %p\n' \
      | sort -nr \
      | head -n1 \
      | cut -d' ' -f2-
  )"
  if [[ -z "${APPIMAGE_PATH:-}" || ! -f "$APPIMAGE_PATH" ]]; then
    echo "Expected AppImage not found in ui/src-tauri/target/" >&2
    exit 2
  fi
  APPIMAGE_ASSET="$ASSET_DIR/Kitowall-${VERSION}-x86_64.AppImage"
  cp -f "$APPIMAGE_PATH" "$APPIMAGE_ASSET"
fi

if ! git rev-parse "$TAG" >/dev/null 2>&1; then
  git tag "$TAG"
fi
git push origin "$TAG"

echo "[release] creating/updating GitHub release $TAG"
if [[ -n "$APPIMAGE_ASSET" ]]; then
  gh release create "$TAG" \
    "$ASSET_DIR/$TARBALL#$TARBALL" \
    "$APPIMAGE_ASSET#$(basename "$APPIMAGE_ASSET")" \
    --generate-notes \
    --latest \
    || gh release upload "$TAG" \
      "$ASSET_DIR/$TARBALL#$TARBALL" \
      "$APPIMAGE_ASSET#$(basename "$APPIMAGE_ASSET")" \
      --clobber
else
  gh release create "$TAG" \
    "$ASSET_DIR/$TARBALL#$TARBALL" \
    --generate-notes \
    --latest \
    || gh release upload "$TAG" \
      "$ASSET_DIR/$TARBALL#$TARBALL" \
      --clobber
fi

echo "[ok] release published: $TAG"
