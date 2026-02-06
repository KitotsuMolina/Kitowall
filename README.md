# hyprwall

CLI/daemon para Hyprland (Wayland) con `swww`, packs temáticos y multi-monitor.

## Qué hace hoy
- Cambia wallpapers por output (`swww img -o <output>`).
- Mantiene coherencia temática por ciclo (pack actual).
- Soporta packs locales y remotos.
- Permite hydrate/refresh, historial, favoritos, logs y cache TTL.
- Incluye UI de escritorio (Tauri + Svelte) en `ui/`.

## Sources soportados
- `local`
- `wallhaven`
- `unsplash`
- `reddit`
- `generic_json`
- `static_url`

## Rutas importantes
- Config: `~/.config/hyprwall/config.json`
- State: `~/.local/state/hyprwall/state.json`
- History: `~/.local/state/hyprwall/history.json`
- Logs: `~/.local/state/hyprwall/logs.jsonl`
- Descargas: `~/Pictures/Wallpapers/<pack>`

## CLI rápido
```bash
npm run build

node dist/cli.js outputs
node dist/cli.js status
node dist/cli.js next
node dist/cli.js next --pack sao
node dist/cli.js hydrate-pack sao --count 10
node dist/cli.js list-packs --refresh
node dist/cli.js check --json
```

## UI
```bash
cd ui
npm install
npm run tauri dev
```

## Documentación
- Estado actual: `STATUS.md`
- Ejemplos de config: `CONFIG_EXAMPLES.md`
- Dependencias de sistema: `DEPENDENCIES.md`
- Fases: `PHASES.md`, `PHASES_ES.md`
