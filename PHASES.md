# Kitowall Phases (Current Snapshot)
Release target: `v1.0.5`.

## Phase 0 — CLI Base
Status: `done`
- outputs/next/status
- swww per-output apply
- state/history persistence

## Phase 1 — Pack Model + Validation
Status: `done`
- normalized pack names
- strict config load validation
- pack CRUD commands

## Phase 2 — Cache + Favorites
Status: `done`
- TTL per pack + default TTL
- cache pruning (soft/hard)
- favorites protected from prune

## Phase 3 — Remote Adapter Interface
Status: `done`
- refreshIndex/listCandidates/hydrate/status
- integrated in controller/hydrate flow

## Phase 4 — Remote Sources
Status: `done`
- Wallhaven
- Unsplash
- Reddit
- Generic JSON
- Static URL

## Phase 5 — Pool + Priority
Status: `done`
- weighted pool sources
- dedupe mode (`path|url|hash`)
- maxCandidates per source

## Phase 6 — System Integration
Status: `done`
- init/watch/systemd timer
- doctor/health/check

## Phase 7 — UI (Desktop)
Status: `done (base)`
Done:
- Control Center
- General Settings
- History
- Wallpapers
- Logs
- Packs tabs for all current sources

Next:
- UI polish and component unification
- stronger end-to-end test coverage
- optional import/export UX for pack configurations
- release packaging checklist
