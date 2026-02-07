#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="node ${ROOT_DIR}/dist/cli.js"

cd "${ROOT_DIR}"

echo "==> build"
npm run build >/dev/null

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT
export HOME="${TMP_DIR}/home"
mkdir -p "${HOME}/Pictures/Wallpapers/RegA"
mkdir -p "${HOME}/.config/kitowall"
mkdir -p "${HOME}/.local/state/kitowall"

touch "${HOME}/Pictures/Wallpapers/RegA/a1.jpg"

echo "==> bootstrap config/state"
${CLI} pack add reg-local --type local --paths "${HOME}/Pictures/Wallpapers/RegA" >/dev/null
${CLI} settings set --mode rotate --rotation-interval-sec 300 >/dev/null

echo "==> schemaVersion in config/state"
node -e "const fs=require('fs');const p=process.env.HOME+'/.config/kitowall/config.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.schemaVersion!==1){console.error('bad config schemaVersion',j.schemaVersion);process.exit(1);}"
node -e "const fs=require('fs');const p=process.env.HOME+'/.local/state/kitowall/state.json';const j=JSON.parse(fs.readFileSync(p,'utf8'));if(j.schemaVersion!==1){console.error('bad state schemaVersion',j.schemaVersion);process.exit(1);}"

echo "==> pack remove detaches pool"
${CLI} pool enable >/dev/null
${CLI} pool add reg-local --weight 2 --max 10 >/dev/null
${CLI} pack remove reg-local >/dev/null
POOL_JSON="$(${CLI} pool list)"
if echo "${POOL_JSON}" | rg -q 'reg-local'; then
  echo "pool still references removed pack" >&2
  exit 1
fi

echo "==> json error contract"
set +e
ERR_JSON="$(${CLI} next --pack does-not-exist --json 2>/dev/null)"
ERR_CODE=$?
set -e
if [[ "${ERR_CODE}" -eq 0 ]]; then
  echo "expected next --pack does-not-exist to fail" >&2
  exit 1
fi
node -e "const out=JSON.parse(process.argv[1]); if(out.ok!==false) process.exit(1); if(!out.code) process.exit(1); if(!['PACK_NOT_FOUND','NO_OUTPUTS'].includes(out.code)) process.exit(1);" "${ERR_JSON}"

echo "==> history/log clear paths"
${CLI} history --limit 5 >/dev/null
${CLI} logs --limit 5 >/dev/null
${CLI} history clear >/dev/null
${CLI} logs clear >/dev/null

if [[ -f "${HOME}/.local/state/kitowall/history.json" ]]; then
  echo "history.json should be removed by history clear" >&2
  exit 1
fi
if [[ -f "${HOME}/.local/state/kitowall/logs.jsonl" ]]; then
  echo "logs.jsonl should be removed by logs clear" >&2
  exit 1
fi

echo "==> regression e2e passed"
