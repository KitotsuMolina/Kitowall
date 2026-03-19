# Kitowall Dependencies
Version scope: `1.0.7`.

Este documento lista todas las dependencias necesarias para correr y desarrollar `kitowall` (CLI + UI Electron/Svelte) en Arch Linux.

## 1) Dependencias de runtime (CLI)
Requeridas para usar `kitowall` en Hyprland:

- `hyprland` (o al menos `hyprctl` disponible)
- `swww`
- `systemd` (usuario) para timer/services
- `bash` (scripts)

Instalacion (Arch):
```bash
sudo pacman -S --needed hyprland swww systemd bash
```

Verificacion:
```bash
hyprctl --version
swww --version
systemctl --user --version
```

## 2) Dependencias de desarrollo (CLI Node/TypeScript)
Requeridas para compilar y ejecutar el proyecto `kitowall`:

- Node.js `>= 20` (recomendado 24.x)
- `npm` (incluido con Node)
- TypeScript (se instala via `npm install` en el proyecto)

Instalacion (Arch):
```bash
sudo pacman -S --needed nodejs npm
```

Verificacion:
```bash
node -v
npm -v
```

## 3) Dependencias de runtime/build (UI Electron + Svelte)
Requeridas para `kitowall/ui`:

- Node.js `>= 20`
- `npm`
- Electron se instala via `npm install`

Instalacion (Arch):
```bash
sudo pacman -S --needed nodejs npm
```

Verificacion:
```bash
node -v
npm -v
```

## 4) Gestor de paquetes frontend (opcional)
La UI puede correr con `npm` o `pnpm`.

- Opcion A: usar `npm` (sin instalar extra)
- Opcion B: usar `pnpm`

Instalar `pnpm` (opcional):
```bash
npm i -g pnpm
```

## 5) Variables de entorno requeridas/opcionales
Para fuentes remotas:

- `WALLHAVEN_KEY` (recomendado para packs wallhaven)
- `UNSPLASH_KEY` (recomendado para packs unsplash)

Tambien se puede configurar por pack con `--api-key` o `--api-key-env`.

Para UI Electron (si el bin no esta en PATH):

- `KITOWALL_CMD`

Ejemplo:
```bash
export KITOWALL_CMD="node /home/kitotsu/Programacion/Personal/Wallpaper/Kitowall/dist/cli.js"
```

## 6) Instalacion rapida completa (Arch)
### CLI
```bash
sudo pacman -S --needed nodejs npm hyprland swww systemd bash
cd /home/kitotsu/Programacion/Personal/Wallpaper/Kitowall
npm install
npm run build
```

### UI
```bash
sudo pacman -S --needed nodejs npm
cd /home/kitotsu/Programacion/Personal/Wallpaper/Kitowall/ui
npm install
export KITOWALL_CMD="node /home/kitotsu/Programacion/Personal/Wallpaper/Kitowall/dist/cli.js"
npm run electron:dev
```

## 7) Comandos de diagnostico utiles
Desde `kitowall`:
```bash
node dist/cli.js doctor
node dist/cli.js health --json
node dist/cli.js check --json
```

## 8) Errores comunes
### Error: `cargo metadata ... No such file or directory`
Causa: Rust no instalado.
Solucion:
```bash
sudo pacman -S --needed rustup
rustup default stable
```

### Error: `fish: Unknown command: pnpm`
Causa: `pnpm` no instalado.
Solucion: usar `npm` o instalar `pnpm`.
