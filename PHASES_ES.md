# Fases de Hyprwall (Estado Actual)

## Fase 0 — CLI base
Estado: `completada`
- outputs/next/status
- aplicación por monitor con swww
- persistencia de state/history

## Fase 1 — Modelo de packs + validación
Estado: `completada`
- normalización de nombres de pack
- validación estricta de config al cargar
- comandos CRUD de packs

## Fase 2 — Cache + favoritos
Estado: `completada`
- TTL por pack + TTL por defecto
- limpiezas soft/hard de cache
- favoritos protegidos de limpieza

## Fase 3 — Interfaz de adapters remotos
Estado: `completada`
- refreshIndex/listCandidates/hydrate/status
- integración con controller/hydrate

## Fase 4 — Sources remotos
Estado: `completada`
- Wallhaven
- Unsplash
- Reddit
- Generic JSON
- Static URL

## Fase 5 — Pool + prioridad
Estado: `completada`
- pool con pesos
- dedupe (`path|url|hash`)
- maxCandidates por source

## Fase 6 — Integración de sistema
Estado: `completada`
- init/watch/systemd timer
- doctor/health/check

## Fase 7 — UI (escritorio)
Estado: `en progreso`
Completado:
- Control Center
- General Settings
- History
- Wallpapers
- Logs
- módulo Packs con tabs para todos los sources actuales

Siguiente:
- pulido visual y unificación de componentes
- más cobertura de pruebas E2E
- UX opcional para importar/exportar configuraciones de packs
