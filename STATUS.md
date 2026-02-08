# Kitowall Status
Versión: `1.0.6`.

## Estado actual (snapshot)
`kitowall` está en estado **base funcional completa** para uso diario en Hyprland + Wayland + `swww`.

## Lo que ya está cubierto
- CLI de producción para rotación/manual, multi-monitor, packs, pool, cache, favoritos, historial, logs y systemd.
- Sources operativos: `local`, `wallhaven`, `unsplash`, `reddit`, `generic_json`, `static_url`.
- UI de escritorio (Tauri + Svelte) con módulos:
  - `Control Center`
  - `General Settings`
  - `History`
  - `Wallpapers`
  - `Packs`
  - `Logs`
  - i18n base (`en` default + `es`) con selector de idioma en General Settings

## Estado de esta fase (cerrada)
- Vista principal y flujo diario funcionales.
- Gestión de packs por source funcional desde UI.
- General settings funcional (modo, transición, intervalos).
- Historial y favoritos funcionales desde UI.
- Librería de wallpapers funcional con filtros.
- Logs visibles desde UI.
- Contrato de schema congelado en `config/state` (`schemaVersion: 1`).
- Suite mínima de regresión E2E activa (`npm run test:e2e`).
- Pipeline de release inicial agregado:
  - `npm run release:check`
  - `npm run package:cli`
  - `npm run package:ui`
  - `npm run package:all`
- Checklist de release agregado: `RELEASE_CHECKLIST.md`.

## Persistencia y rutas
- Config: `~/.config/kitowall/config.json`
- Estado runtime: `~/.local/state/kitowall/state.json`
- Historial: `~/.local/state/kitowall/history.json`
- Logs: `~/.local/state/kitowall/logs.jsonl`
- Descargas (default): `~/Pictures/Wallpapers/<pack>`

## Pendientes de siguiente fase
- Hardening E2E (tests de regresión UI/CLI).
- Mejoras UX no críticas (microinteracciones y consistencia visual fina).
- Publicación del primer release con artefactos generados.

## Resultado
La base del producto ya está lista. Lo siguiente es estabilización final y empaquetado.

## Empaquetado (realizado)
- CLI empaquetado: `kitowall-1.0.6.tgz`
- UI release compilada: `ui/src-tauri/target/release/kitowall-ui`
