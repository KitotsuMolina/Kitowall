#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to sync UI version" >&2
  exit 1
fi

VERSION="$(node -p "require('./package.json').version")"
if [[ -z "${VERSION:-}" ]]; then
  echo "Could not read root version from package.json" >&2
  exit 1
fi

node - "$VERSION" <<'NODE'
const fs = require('fs');
const version = process.argv[2];

function updateJson(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const json = JSON.parse(raw);
  json.version = version;
  fs.writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
}

updateJson('ui/package.json');
updateJson('ui/src-tauri/tauri.conf.json');
NODE

node - "$VERSION" <<'NODE'
const fs = require('fs');
const path = 'ui/src-tauri/Cargo.toml';
const version = process.argv[2];
const raw = fs.readFileSync(path, 'utf8');
const next = raw.replace(/^version = ".*"$/m, `version = "${version}"`);
if (next === raw) {
  console.error('Could not update version in ui/src-tauri/Cargo.toml');
  process.exit(1);
}
fs.writeFileSync(path, next, 'utf8');
NODE
