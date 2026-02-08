# Kitowall Release Checklist

Version target: `1.0.7`

## 1) Technical Validation
- `npm install`
- `npm run build`
- `npm run test:e2e`
- `node dist/cli.js check --json`
- Confirm system units are healthy in your machine:
  - `node dist/cli.js systemd-status`
  - `systemctl --user status kitowall-next.timer`

## 2) UI Validation
- `cd ui && npm install`
- `npm run tauri:dev`
- Validate critical flows:
  - Control Center: `next`, `hydrate`, `clean`
  - General Settings: mode, transition, intervals
  - History: list and favorite toggle
  - Wallpapers: filter + refresh + favorite
  - Packs: create/edit for all sources
  - Logs: list and clear

## 3) Package Artifacts
- CLI package:
  - `npm run package:cli`
  - Expected output: `kitowall-1.0.7.tgz` in project root
- Desktop package:
  - `npm run package:ui`
  - Expected output: `ui/src-tauri/target/release/bundle/*`

## 4) Documentation for End Users
- README is user-focused and up to date.
- Dependencies and install steps are clear.
- Commands and examples are runnable.
- Known limitations are documented.

## 5) Legal and Branding
- `LICENSE.md` present and correct.
- `NOTICE.md` included.
- `TRADEMARKS.md` included.
- `ui/src/assets/logo-LICENSE.md` included.

## 6) First Release Scope (No Overpromise)
- Do not claim features outside current implementation.
- Keep release notes focused on:
  - stable core features
  - supported sources
  - known constraints

## 7) Suggested Release Notes Template
- Version: `1.0.7`
- Highlights
- Supported environments
- Breaking changes (if any)
- Known issues
- Next steps (short)
