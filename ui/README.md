# hyprwall-ui

UI de escritorio para `hyprwall` (Tauri + Svelte).

## Requisitos
- Tener construido el CLI principal (`hyprwall/dist/cli.js`).
- Dependencias de Tauri/Rust instaladas (ver `../DEPENDENCIES.md`).

## Desarrollo
```bash
cd ui
npm install
npm run tauri dev
```

## Build
```bash
cd ui
npm run build
cd src-tauri && cargo check
```

## Módulos UI implementados
- Control Center
- General Settings
- History
- Wallpapers
- Packs
- Logs

## Packs UI implementados
- Wallhaven
- Unsplash
- Reddit
- Generic JSON
- Static URL
- Local (con selector nativo de carpetas)

## Integración
La UI invoca el CLI y comandos auxiliares vía Tauri commands en:
- `ui/src-tauri/src/main.rs`
