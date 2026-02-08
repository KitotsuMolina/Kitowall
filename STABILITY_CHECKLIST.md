# Stability Checklist (Phase 1)
Version scope: `1.0.6`.

## Goal
Lock core behavior and prevent regressions while we move to polish and release.

## Frozen Contracts
- `~/.config/kitowall/config.json`
  - `schemaVersion` is mandatory and currently `1`.
- `~/.local/state/kitowall/state.json`
  - `schemaVersion` is mandatory and currently `1`.

## Automated Regression (minimum)
Run:

```bash
npm run test:e2e
```

What is covered:
- CLI smoke flow (`tests/smoke.e2e.sh`).
- Key regression assertions (`tests/regression.e2e.sh`):
  - schema version persistence in config/state
  - `pack remove` detaches pool references
  - JSON error contract for known failures
  - history/log clear behavior

## UI <-> CLI Edge Cases to Verify Manually
- `Control Center`:
  - `Next`, `Hydrate Pack`, `Clean Wallpapers` report clear success/error feedback.
  - Pack selection does not reset unexpectedly after actions.
- `General Settings`:
  - Save applies mode/interval/transition and survives app restart.
- `History` and `Logs`:
  - Clear actions require confirmation and update UI immediately.
- `Packs`:
  - Save/edit/remove updates configured list without tab switch.

## Exit Criteria for Phase 1
- `npm run test:e2e` passes locally.
- No blocker bug in core flows (`next`, `hydrate`, `clean`, `settings`, `packs CRUD`).
- Config/state schema frozen at `v1` and enforced.
