# Hyprwall Status

## Estado actual (hoy)
`hyprwall` está en estado funcional para uso diario en Hyprland + Wayland + `swww`.

### Núcleo CLI
- Rotación y cambio manual de wallpapers por output (`next`, `rotate-now`, `mode`).
- Multi-monitor con wallpapers distintos por output y consistencia por pack en cada ciclo.
- Detección de outputs (`outputs`) y estado (`status`).
- Gestión completa de packs (`pack add/update/remove/show/list`, `pack subtheme`, `pack set-key`).
- Gestión de pool (`pool enable/disable/add/remove/list`, `pool-status`).
- Refresh/hydrate remoto (`refresh-pack`, `hydrate-pack`).
- Historial, favoritos y logs del sistema (`history`, `favorites`, `logs`).
- Cache con TTL, límites y limpieza (`cache-config`, `cache-prune`, `cache-prune-hard`, `cache-prune-pack`, `cache-prune-pack-hard`).
- Integración systemd + watcher + health/doctor/check.

### Sources implementados
- `local`
- `wallhaven`
- `unsplash`
- `reddit`
- `generic_json`
- `static_url`

### UI (Tauri + Svelte)
Módulos implementados:
- `Control Center`
- `General Settings`
- `History`
- `Wallpapers` (librería)
- `Packs`
- `Logs`

En `Packs` están implementadas tabs funcionales para:
- Wallhaven
- Unsplash
- Reddit
- Generic JSON
- Static URL
- Local

Además, `Local` ahora usa selector nativo de carpeta (`+`), lista visual de carpetas seleccionadas (icono + nombre + ruta), y eliminación por fila (`-`).

## Flujo de datos actual
- Config: `~/.config/hyprwall/config.json`
- Estado runtime: `~/.local/state/hyprwall/state.json`
- Historial: `~/.local/state/hyprwall/history.json`
- Logs: `~/.local/state/hyprwall/logs.jsonl`
- Descargas: `~/Pictures/Wallpapers/<pack>` (por defecto)

## Contrato JSON para UI
- `--json` en comandos compatibles devuelve salida machine-readable.
- `check --json` está integrado para diagnóstico rápido en UI.
- Errores de operación se reflejan también en logs de sistema.

## Comandos principales
```bash
hyprwall outputs
hyprwall status
hyprwall next --pack <name>
hyprwall hydrate-pack <name> --count 10
hyprwall refresh-pack <name>
hyprwall list-packs --refresh
hyprwall settings get
hyprwall settings set --mode rotate --rotation-interval-sec 600
hyprwall install-systemd --every 10m
hyprwall check --json
```

## Riesgos o pendientes técnicos
- Robustecer más manejo de rate-limit por source (especialmente Reddit/Unsplash en escenarios intensivos).
- Agregar tests automatizados (unit + integración CLI/UI) más allá del flujo manual.
- Afinar UX visual (microinteracciones, consistencia de componentes entre módulos).

## Resultado
El proyecto ya cubre el objetivo principal: gestión de wallpapers estáticos con packs temáticos, multi-monitor, animaciones `swww`, sources remotos/locales y UI operativa.
