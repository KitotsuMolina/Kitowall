# Kitowall UI

Aplicación de escritorio de `Kitowall` construida con `Electron + Svelte`.

Versión actual: `1.0.7`.

---

# Español

## Qué es

`kitowall-ui` es la interfaz gráfica de `Kitowall`.

Su función es centralizar en una sola app:
- gestión del stack de wallpapers
- bootstrap del host
- validación de dependencias
- administración de `Kitsune`
- edición visual de grupos y capas
- gestión de live wallpapers

## Stack técnico

- `Electron`
- `Svelte`
- `Vite`
- integración con el CLI `kitowall`
- integración con scripts de bootstrap del host

## Requisitos

Antes de usar la UI en desarrollo, conviene tener:
- `../dist/cli.js` disponible o poder compilar el CLI raíz
- dependencias del sistema instaladas según `../DEPENDENCIES.md`

## Desarrollo

```bash
cd ui
npm install
npm run electron:dev
```

## Build

### Build de frontend
```bash
cd ui
npm run build
```

### Build AppImage
```bash
cd ui
npm run electron:build
```

### Build unpacked
```bash
cd ui
npm run dist:unpacked
```

## Distribución

La distribución principal de la UI es la `AppImage`.

### Importante
No ejecutes la `AppImage` con `sudo`.

Correcto:
```bash
./Kitowall-*.AppImage --no-sandbox
```

Incorrecto:
```bash
sudo ./Kitowall-*.AppImage --no-sandbox
```

## Flujo de instalación actual

La UI empaqueta estos recursos extra:
- `bootstrap-host.sh`
- `bootstrap-system.sh`
- `kitowall-cli`

### Modelo de bootstrap

La instalación del host se divide en dos partes:

1. **Fase privilegiada**
- ejecuta `bootstrap-system.sh`
- se lanza con `pkexec`
- instala paquetes del sistema

2. **Fase de usuario**
- ejecuta `bootstrap-host.sh`
- instala y configura componentes en `~/.local/...`
- no corre como root

Esto evita tener que ejecutar toda la app como administrador.

## Qué puede hacer la UI

Módulos principales:
- Control Center
- General Settings
- History
- Wallpapers
- Packs
- Logs
- Live Wallpapers
- `Kitsune`
  - control del runtime
  - configuración global
  - edición visual de grupos y capas

## Estructura relevante

- `electron/`
  - proceso principal y backend de integración
- `src/`
  - frontend Svelte
- `src/assets/`
  - recursos visuales e iconos
- `dist/`
  - salida del build frontend y/o empaquetado

## Empaquetado

La configuración de empaquetado vive en:
- `ui/package.json`

Recursos incluidos en la AppImage:
- `dist/**/*`
- `electron/**/*`
- `src/assets/logo.png`
- `../scripts/bootstrap-host.sh`
- `../scripts/bootstrap-system.sh`
- `../dist` como `kitowall-cli`

## Documentación relacionada

- `../README.md`
- `../DEPENDENCIES.md`
- `../STATUS.md`
- `../CONFIG_EXAMPLES.md`

## Legal

- licencia del proyecto: `../LICENSE.md`
- notice: `../NOTICE.md`
- trademarks: `../TRADEMARKS.md`
- licencia del logo: `src/assets/logo-LICENSE.md`

---

# English

## What It Is

`kitowall-ui` is the desktop interface for `Kitowall`.

Its job is to centralize in a single app:
- wallpaper stack management
- host bootstrap
- dependency validation
- `Kitsune` administration
- visual editing of groups and layers
- live wallpaper management

## Technical Stack

- `Electron`
- `Svelte`
- `Vite`
- integration with the `kitowall` CLI
- integration with host bootstrap scripts

## Requirements

Before using the UI in development, it is recommended to have:
- `../dist/cli.js` available or the ability to build the root CLI
- system dependencies installed as described in `../DEPENDENCIES.md`

## Development

```bash
cd ui
npm install
npm run electron:dev
```

## Build

### Frontend build
```bash
cd ui
npm run build
```

### AppImage build
```bash
cd ui
npm run electron:build
```

### Unpacked build
```bash
cd ui
npm run dist:unpacked
```

## Distribution

The main UI distribution format is `AppImage`.

### Important
Do not run the `AppImage` with `sudo`.

Correct:
```bash
./Kitowall-*.AppImage --no-sandbox
```

Incorrect:
```bash
sudo ./Kitowall-*.AppImage --no-sandbox
```

## Current Installation Flow

The UI packages these extra resources:
- `bootstrap-host.sh`
- `bootstrap-system.sh`
- `kitowall-cli`

### Bootstrap model

Host installation is split into two parts:

1. **Privileged phase**
- runs `bootstrap-system.sh`
- launched through `pkexec`
- installs system packages

2. **User phase**
- runs `bootstrap-host.sh`
- installs and configures components in `~/.local/...`
- does not run as root

This avoids running the whole app with elevated privileges.

## What the UI Can Do

Main modules:
- Control Center
- General Settings
- History
- Wallpapers
- Packs
- Logs
- Live Wallpapers
- `Kitsune`
  - runtime control
  - global configuration
  - visual group/layer editing

## Relevant Structure

- `electron/`
  - main process and integration backend
- `src/`
  - Svelte frontend
- `src/assets/`
  - visual assets and icons
- `dist/`
  - frontend build output and/or packaged artifacts

## Packaging

Packaging configuration lives in:
- `ui/package.json`

Resources included in the AppImage:
- `dist/**/*`
- `electron/**/*`
- `src/assets/logo.png`
- `../scripts/bootstrap-host.sh`
- `../scripts/bootstrap-system.sh`
- `../dist` as `kitowall-cli`

## Related Documentation

- `../README.md`
- `../DEPENDENCIES.md`
- `../STATUS.md`
- `../CONFIG_EXAMPLES.md`

## Legal

- project license: `../LICENSE.md`
- notice: `../NOTICE.md`
- trademarks: `../TRADEMARKS.md`
- logo license: `src/assets/logo-LICENSE.md`

## Privileged flow validation

Before you trigger “Install Dependencies”, open `/tmp/kitowall-kitsune-ui.log` and look for the line `runPrivilegedSystemBootstrap: … display=… wayland=… dbus=set|missing`. That entry confirms the helper was invoked with the session’s display/dbus environment; if `dbus` reports `missing`, restart your graphical session so the polkit agent starts before retrying the installation.
