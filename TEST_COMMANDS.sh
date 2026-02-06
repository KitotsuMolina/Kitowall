#!/usr/bin/env bash
set -euo pipefail

# Simple smoke test runner for hyprwall CLI.
# It runs commands in a logical order and skips remote tests if keys are missing.

ROOT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
CLI="node $ROOT_DIR/dist/cli.js"

# Load .env if present
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT_DIR/.env"
  set +a
fi

log() { printf "\n==> %s\n" "$*"; }

log "Build"
( cd "$ROOT_DIR" && npm run build )

log "Outputs"
$CLI outputs

log "Status (initial)"
$CLI status

log "Pack list (initial)"
$CLI pack list

log "Pool list (initial)"
$CLI pool list || true

log "Add local pack (demo_local)"
$CLI pack add demo_local --type local --paths "${PACK_LOCAL_PATHS:-~/Pictures/Wallpapers/SAO}"

log "Show pack (demo_local)"
$CLI pack show demo_local

log "Pack status (demo_local)"
$CLI pack-status demo_local

log "Pool enable"
$CLI pool enable

log "Pool add demo_local"
$CLI pool add demo_local --weight 1 --max 50

log "Pool list"
$CLI pool list

log "Pool status"
$CLI pool-status

log "Cache config (set default dir)"
$CLI cache-config --download-dir "${CACHE_DOWNLOAD_DIR:-~/Pictures/Wallpapers}"

log "Favorites add/remove (demo path)"
$CLI favorite add "/tmp/hyprwall_demo.jpg" || true
$CLI favorites
$CLI favorite remove "/tmp/hyprwall_demo.jpg" || true

log "List packs (refresh disabled)"
$CLI list-packs

log "Refresh all packs (parallel)"
$CLI refresh-pack --all --parallel || true

log "Wallhaven pack (requires API key)"
if [ -n "${WALLHAVEN_KEY:-}" ]; then
  $CLI pack add wallhaven_sao --type wallhaven \
    --api-key-env WALLHAVEN_KEY \
    --keyword "${PACK_KEYWORD_SAO:-sao}" \
    --subthemes "${PACK_SUBTHEMES_SAO:-minimalista,dark}" \
    --purity "${WALLHAVEN_PURITY:-100}" \
    --categories "${WALLHAVEN_CATEGORIES:-111}" \
    --ratios "${WALLHAVEN_RATIOS:-16x9}" \
    --atleast "${WALLHAVEN_ATLEAST:-1920x1080}" \
    --sorting "${WALLHAVEN_SORTING:-random}" \
    --colors "${WALLHAVEN_COLORS:-}" \
    --ai-art "${WALLHAVEN_AI_ART:-false}"
  $CLI pack-status wallhaven_sao --refresh

  $CLI pack add wallhaven_edgerunners --type wallhaven \
    --api-key-env WALLHAVEN_KEY \
    --keyword "${PACK_KEYWORD_EDGERUNNERS:-edgerunners}" \
    --subthemes "${PACK_SUBTHEMES_EDGERUNNERS:-neon,cyberpunk}" \
    --purity "${WALLHAVEN_PURITY:-100}" \
    --categories "${WALLHAVEN_CATEGORIES:-111}" \
    --ratios "${WALLHAVEN_RATIOS:-16x9}" \
    --atleast "${WALLHAVEN_ATLEAST:-1920x1080}" \
    --sorting "${WALLHAVEN_SORTING:-random}" \
    --colors "${WALLHAVEN_COLORS:-}" \
    --ai-art "${WALLHAVEN_AI_ART:-false}"
  $CLI pack-status wallhaven_edgerunners --refresh
else
  echo "Skipping Wallhaven: WALLHAVEN_KEY not set"
fi

log "Unsplash pack (requires API key)"
if [ -n "${UNSPLASH_KEY:-}" ] && [ "${UNSPLASH_KEY}" != "REPLACE_ME" ]; then
  $CLI pack add unsplash_japon --type unsplash \
    --api-key-env UNSPLASH_KEY \
    --query "${UNSPLASH_QUERY:-japon}" \
    --subthemes "${UNSPLASH_SUBTHEMES:-tokyo,night}" \
    --orientation "${UNSPLASH_ORIENTATION:-landscape}" \
    --content-filter "${UNSPLASH_CONTENT_FILTER:-high}" \
    --image-width "${UNSPLASH_IMAGE_WIDTH:-1920}" \
    --image-height "${UNSPLASH_IMAGE_HEIGHT:-1080}" \
    --image-fit "${UNSPLASH_IMAGE_FIT:-crop}" \
    --image-quality "${UNSPLASH_IMAGE_QUALITY:-80}"
  $CLI pack-status unsplash_japon --refresh
else
  echo "Skipping Unsplash: UNSPLASH_KEY not set"
fi

log "Reddit pack"
$CLI pack add reddit_sao --type reddit \
  --subreddits "${REDDIT_SUBREDDITS:-wallpapers,animewallpaper}" \
  --subthemes "${REDDIT_SUBTHEMES:-minimalist,dark}" \
  --min-width "${REDDIT_MIN_WIDTH:-1920}" \
  --min-height "${REDDIT_MIN_HEIGHT:-1080}" \
  --ratio-w "${REDDIT_RATIO_W:-16}" \
  --ratio-h "${REDDIT_RATIO_H:-9}"
$CLI pack-status reddit_sao --refresh || true

log "Generic JSON pack (example)"
$CLI pack add nasa --type generic_json \
  --endpoint "${GENERIC_JSON_ENDPOINT:-https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY}" \
  --image-path "${GENERIC_JSON_IMAGE_PATH:-$.hdurl}" \
  --ttl-sec "${GENERIC_JSON_TTL_SEC:-86400}"
$CLI pack-status nasa --refresh || true

log "Static URL pack"
$CLI pack add static_demo --type static_url \
  --urls "${STATIC_URLS:-https://example.com/a.jpg,https://example.com/b.jpg}" \
  --different-images "${STATIC_DIFFERENT_IMAGES:-true}" \
  --count "${STATIC_COUNT:-2}" \
  --ttl-sec "${STATIC_TTL_SEC:-86400}"
$CLI pack-status static_demo --refresh || true

log "List packs (refresh enabled)"
$CLI list-packs --refresh || true

log "Pool status (refresh)"
$CLI pool-status --refresh || true

log "Hydrate pack (wallhaven_sao)"
if [ -n "${WALLHAVEN_KEY:-}" ]; then
  $CLI hydrate-pack wallhaven_sao --count 5 || true
  $CLI hydrate-pack wallhaven_edgerunners --count 5 || true
fi

log "Hydrate pack (unsplash_japon)"
if [ -n "${UNSPLASH_KEY:-}" ] && [ "${UNSPLASH_KEY}" != "REPLACE_ME" ]; then
  $CLI hydrate-pack unsplash_japon --count 3 || true
fi

log "Hydrate pack (reddit_sao)"
$CLI hydrate-pack reddit_sao --count 3 || true

log "Hydrate pack (nasa)"
$CLI hydrate-pack nasa --count 1 || true

log "Hydrate pack (static_demo)"
$CLI hydrate-pack static_demo --count 2 || true

log "Cleanup demo packs"
$CLI pack remove demo_local || true
$CLI pack remove reddit_sao || true
$CLI pack remove nasa || true
$CLI pack remove static_demo || true
$CLI pack remove wallhaven_sao || true
$CLI pack remove wallhaven_edgerunners || true
$CLI pack remove unsplash_japon || true

log "Done"
