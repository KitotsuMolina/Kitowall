<img src="https://github.com/KitotsuMolina/Kitowall/blob/main/assets/kitowall.png?raw=true" alt="Kitowall" width="420" />

# Kitowall

`Kitowall` es un gestor de wallpapers para `Hyprland/Wayland` con dos capas principales:
- `kitowall`: CLI y automatización para wallpapers estáticos, rotación, packs, historial, logs y fuentes remotas.
- `kitowall-ui`: interfaz gráfica de escritorio para gestionar `Kitowall`, `Kitsune`, live wallpapers y utilidades de instalación.

Versión actual del paquete CLI: `6.11.0`.

---

# Español

## Qué es Kitowall

`Kitowall` organiza wallpapers por packs y fuentes remotas, aplica fondos por monitor usando `swww` y ofrece una UI que también integra:
- gestión de `Kitsune`
- live wallpapers
- bootstrap del host
- validación de dependencias
- utilidades de sistema para el stack de wallpapers

## Funcionalidades principales

### CLI / Core
- Rotación de wallpapers.
- Wallpapers distintos por monitor.
- Packs temáticos (`sao`, `edgerunners`, etc.).
- Fuentes remotas y locales:
  - `local`
  - `wallhaven`
  - `unsplash`
  - `reddit`
  - `generic_json`
  - `static_url`
- Historial, favoritos, cache y logs.
- Integración con `systemd --user`.

### UI
- Panel gráfico para gestionar `Kitowall` y `Kitsune`.
- Instalador de dependencias del host.
- Gestión de live wallpapers.
- Módulo visual de `Kitsune` con grupos, capas, colores dinámicos y efectos.

## Requisitos

Entorno objetivo:
- Linux
- `Wayland`
- `Hyprland`
- `swww`

Dependencias del stack principal, según la función usada:
- `nodejs`, `npm`
- `rust`, `cargo` o `rustup`
- `pkg-config` / `pkgconf`
- `gtk4`
- `gtk4-layer-shell`
- `jq`
- `curl`
- `git`
- `cava`
- `hyprland`
- `swww`

## Rutas por defecto

- Configuración: `~/.config/kitowall/config.json`
- Estado: `~/.local/state/kitowall/state.json`
- Historial: `~/.local/state/kitowall/history.json`
- Logs: `~/.local/state/kitowall/logs.jsonl`
- Wallpapers: `~/Pictures/Wallpapers/<pack>`

## Instalación recomendada: AppImage

La distribución recomendada de la UI es la `AppImage`.

### Importante
No ejecutes la AppImage con `sudo`.

Correcto:
```bash
chmod +x ./Kitowall-*.AppImage
./Kitowall-*.AppImage --no-sandbox
```

Incorrecto:
```bash
sudo ./Kitowall-*.AppImage --no-sandbox
```

Razón:
- Electron no debe ejecutarse como root en tu sesión gráfica.
- Si corres la AppImage con `sudo`, puedes perder `DISPLAY`, `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR` y la app fallará al iniciar.

### Flujo recomendado
1. Descarga la última `AppImage` desde GitHub Releases.
2. Dale permisos de ejecución.
3. Ábrela como usuario normal.
4. Usa el instalador de dependencias desde la UI.

## Instalación de dependencias del host

`Kitowall` soporta instalación asistida del host.

### Cómo funciona ahora
La app separa dos fases:

1. **Fase privilegiada**
- instala paquetes del sistema
- se ejecuta con `pkexec`
- muestra prompt gráfico de autenticación
- no requiere abrir consola manualmente

2. **Fase de usuario**
- instala y configura binarios en `~/.local/...`
- inicializa wrappers y configuración
- no corre como root

### Recomendación
Usa el botón:
- `Install Dependencies`

Ese flujo es preferible a pedirle al usuario que abra la terminal con `sudo`.

### Requisitos para este flujo gráfico
El host debe tener:
- `pkexec`
- un agente `polkit` activo en la sesión

Sin eso, la instalación de paquetes del sistema seguirá necesitando intervención manual.

## Bootstrap manual

Si quieres hacer el bootstrap desde terminal, usa:

```bash
./scripts/bootstrap-host.sh
```

Eso ejecuta:
- instalación/configuración de `kitowall`
- instalación/configuración de `kitsune`
- instalación/configuración de `kitsune-rendercore`
- validación del host

### Nota
El script puede necesitar privilegios para instalar paquetes del sistema. La forma recomendada para usuarios finales sigue siendo la UI con `pkexec`.

## Inicialización

Después del bootstrap, inicializa el stack:

```bash
kitowall init --namespace kitowall --apply --force
```

## Instalación de Kitsune

Si trabajas con `Kitsune`, el flujo soportado es:

```bash
kitsune install --install-packages
```

O bien:

```bash
cd Kitsune
./scripts/install.sh --install-packages
```

En la UI, si el usuario dispara instalación con paquetes, `Kitowall` ya puede elevar solo la parte necesaria de sistema sin ejecutar Electron como root.

## Desarrollo rápido

### CLI
```bash
npm install
npm run build

node dist/cli.js outputs
node dist/cli.js status
node dist/cli.js check --json
```

### UI
```bash
cd ui
npm install
npm run electron:dev
```

### Builds
```bash
npm run build
npm run package:cli
npm run package:ui
npm run package:all
```

## Comandos útiles

### Core
```bash
kitowall outputs
kitowall status
kitowall next
kitowall check --json
kitowall mode rotate
kitowall rotate-now
```

### Packs y fuentes
```bash
kitowall list-packs
kitowall pack show <name>
kitowall refresh-pack <name>
kitowall hydrate-pack <name> --count 10
```

### Historial y logs
```bash
kitowall history --limit 100
kitowall history clear
kitowall logs --limit 200
kitowall logs clear
```

### Servicios
```bash
kitowall install-systemd --every 5m
kitowall systemd-status
```

## Live Wallpapers

`Kitowall` incluye soporte para live wallpapers y Wallpaper Engine dentro de la UI y del CLI.

Documentación y componentes relacionados:
- `ui/README.md`
- `src/core/live.ts`
- comandos `kitowall live ...`
- comandos `kitowall we ...`

## Recomendaciones de instalación

### Para usuarios finales
- usa la `AppImage`
- no la ejecutes con `sudo`
- instala dependencias desde la UI
- deja que `pkexec` pida autenticación cuando haga falta

### Para desarrollo
- usa el repo directamente
- CLI desde raíz
- UI desde `ui/`

### Para Arch/Hyprland
Si `bootstrap-host.sh` falla por librerías de compresión/archivo, repara el sistema y reintenta:

```bash
sudo pacman -Syu
sudo pacman -S --overwrite '*' zstd libarchive
```

## Estructura relevante

- `src/cli.ts`: CLI principal
- `scripts/bootstrap-host.sh`: bootstrap de usuario / orquestación
- `scripts/bootstrap-system.sh`: helper root para paquetes del sistema
- `ui/`: aplicación Electron + Svelte
- `dist/`: salida del CLI
- `CONFIG_EXAMPLES.md`: ejemplos de configuración
- `DEPENDENCIES.md`: dependencias
- `STATUS.md`: estado del proyecto

## Documentación relacionada

- `CONFIG_EXAMPLES.md`
- `DEPENDENCIES.md`
- `STATUS.md`
- `ui/README.md`
- `RELEASE_CHECKLIST.md`
- `RELEASE_NOTES_1.0.0.md`

## Legal

- `LICENSE.md`
- `NOTICE.md`
- `TRADEMARKS.md`
- licencia del logo en `ui/src/assets/logo-LICENSE.md`

---

# English

## What Kitowall Is

`Kitowall` is a wallpaper management stack for `Hyprland/Wayland` with two main layers:
- `kitowall`: CLI and automation for static wallpapers, rotation, packs, history, logs, and remote sources.
- `kitowall-ui`: desktop UI used to manage `Kitowall`, `Kitsune`, live wallpapers, and host bootstrap tasks.

## Main Features

### CLI / Core
- Wallpaper rotation.
- Per-monitor wallpapers.
- Pack-based organization.
- Local and remote sources:
  - `local`
  - `wallhaven`
  - `unsplash`
  - `reddit`
  - `generic_json`
  - `static_url`
- History, favorites, cache and logs.
- `systemd --user` integration.

### UI
- Desktop control panel for `Kitowall` and `Kitsune`.
- Host dependency installer.
- Live wallpaper management.
- Visual `Kitsune` editor with groups, layers, dynamic colors and effects.

## Requirements

Target environment:
- Linux
- `Wayland`
- `Hyprland`
- `swww`

Common dependencies depending on enabled features:
- `nodejs`, `npm`
- `rust`, `cargo` or `rustup`
- `pkg-config` / `pkgconf`
- `gtk4`
- `gtk4-layer-shell`
- `jq`
- `curl`
- `git`
- `cava`
- `hyprland`
- `swww`

## Default Paths

- Config: `~/.config/kitowall/config.json`
- Runtime state: `~/.local/state/kitowall/state.json`
- History: `~/.local/state/kitowall/history.json`
- Logs: `~/.local/state/kitowall/logs.jsonl`
- Wallpapers: `~/Pictures/Wallpapers/<pack>`

## Recommended Installation: AppImage

The recommended desktop distribution for the UI is the `AppImage`.

### Important
Do not run the AppImage with `sudo`.

Correct:
```bash
chmod +x ./Kitowall-*.AppImage
./Kitowall-*.AppImage --no-sandbox
```

Incorrect:
```bash
sudo ./Kitowall-*.AppImage --no-sandbox
```

Reason:
- Electron should not run as root inside your graphical session.
- Running the AppImage with `sudo` may break `DISPLAY`, `WAYLAND_DISPLAY`, `XDG_RUNTIME_DIR`, and the app may fail to start.

### Recommended Flow
1. Download the latest `AppImage` from GitHub Releases.
2. Make it executable.
3. Launch it as a normal user.
4. Use the dependency installer from the UI.

## Host Dependency Installation

`Kitowall` supports assisted host setup.

### How It Works Now
The app separates installation into two phases:

1. **Privileged phase**
- installs system packages
- runs through `pkexec`
- shows a graphical authentication prompt
- does not require opening a terminal manually

2. **User phase**
- installs and configures user-space binaries in `~/.local/...`
- initializes wrappers and config files
- does not run as root

### Recommendation
Use the UI button:
- `Install Dependencies`

This is the intended end-user path instead of asking users to open a terminal and run `sudo` themselves.

### Requirements for the graphical flow
The host should provide:
- `pkexec`
- an active `polkit` agent in the session

Without those, system package installation still requires manual intervention.

## Manual Bootstrap

If you want to bootstrap from terminal, use:

```bash
./scripts/bootstrap-host.sh
```

That handles:
- `kitowall` installation/config
- `kitsune` installation/config
- `kitsune-rendercore` installation/config
- host validation

### Note
The script may need privileges for system package installation. For end users, the recommended path remains the UI flow using `pkexec`.

## Initialization

After bootstrap, initialize the stack:

```bash
kitowall init --namespace kitowall --apply --force
```

## Kitsune Installation

If you work with `Kitsune`, the supported installation flow is:

```bash
kitsune install --install-packages
```

Or directly:

```bash
cd Kitsune
./scripts/install.sh --install-packages
```

Inside the UI, when installation with packages is requested, `Kitowall` can elevate only the system-dependency phase instead of running Electron as root.

## Quick Development

### CLI
```bash
npm install
npm run build

node dist/cli.js outputs
node dist/cli.js status
node dist/cli.js check --json
```

### UI
```bash
cd ui
npm install
npm run electron:dev
```

### Builds
```bash
npm run build
npm run package:cli
npm run package:ui
npm run package:all
```

## Useful Commands

### Core
```bash
kitowall outputs
kitowall status
kitowall next
kitowall check --json
kitowall mode rotate
kitowall rotate-now
```

### Packs and Sources
```bash
kitowall list-packs
kitowall pack show <name>
kitowall refresh-pack <name>
kitowall hydrate-pack <name> --count 10
```

### History and Logs
```bash
kitowall history --limit 100
kitowall history clear
kitowall logs --limit 200
kitowall logs clear
```

### Services
```bash
kitowall install-systemd --every 5m
kitowall systemd-status
```

## Live Wallpapers

`Kitowall` also includes live wallpaper and Wallpaper Engine support through both UI and CLI.

Related docs and code:
- `ui/README.md`
- `src/core/live.ts`
- `kitowall live ...`
- `kitowall we ...`

## Installation Recommendations

### For end users
- use the `AppImage`
- do not run it with `sudo`
- install dependencies from the UI
- let `pkexec` request authentication when required

### For development
- use the repository directly
- CLI from project root
- UI from `ui/`

### For Arch/Hyprland
If `bootstrap-host.sh` fails because of compression/archive libraries, repair the host and retry:

```bash
sudo pacman -Syu
sudo pacman -S --overwrite '*' zstd libarchive
```

## Relevant Structure

- `src/cli.ts`: main CLI
- `scripts/bootstrap-host.sh`: user/bootstrap orchestration
- `scripts/bootstrap-system.sh`: root helper for system packages
- `ui/`: Electron + Svelte desktop app
- `dist/`: CLI output
- `CONFIG_EXAMPLES.md`: config examples
- `DEPENDENCIES.md`: dependency reference
- `STATUS.md`: current project status

## Related Documentation

- `CONFIG_EXAMPLES.md`
- `DEPENDENCIES.md`
- `STATUS.md`
- `ui/README.md`
- `RELEASE_CHECKLIST.md`
- `RELEASE_NOTES_1.0.0.md`

## Legal

- `LICENSE.md`
- `NOTICE.md`
- `TRADEMARKS.md`
- logo license at `ui/src/assets/logo-LICENSE.md`
