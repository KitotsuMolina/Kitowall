// src/core/init.ts
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';
import {mkdirSync, writeFileSync} from 'node:fs';
import {run} from '../utils/exec';
import {loadConfig} from './config';
import {loadState} from './state';
import {Controller} from './controller';

function ensureDir(p: string) {
    mkdirSync(p, {recursive: true});
}

function esc(a: string): string {
    // ExecStart=... necesita escapado simple. JSON.stringify funciona bien para espacios/comillas.
    return JSON.stringify(a);
}

async function runHostShell(cmd: string) {
    return run('sh', ['-lc', cmd]);
}

async function hostCmdExists(cmd: string): Promise<boolean> {
    try {
        await runHostShell(`command -v ${cmd} >/dev/null 2>&1`);
        return true;
    } catch {
        return false;
    }
}

async function ensureHostDeps(): Promise<void> {
    const required = ['swww', 'swww-daemon', 'hyprctl'];
    const missing: string[] = [];
    for (const dep of required) {
        if (!(await hostCmdExists(dep))) missing.push(dep);
    }

    if (missing.length === 0) return;

    const pkgSet = new Set<string>();
    if (missing.includes('swww') || missing.includes('swww-daemon')) pkgSet.add('swww');
    if (missing.includes('hyprctl')) pkgSet.add('hyprland');
    const packages = Array.from(pkgSet);

    // Best effort auto-install on Arch host; if it fails, we keep a clear actionable error.
    if (packages.length > 0 && await hostCmdExists('pacman')) {
        const pkgArgs = packages.join(' ');
        await runHostShell(
            `if command -v sudo >/dev/null 2>&1; then ` +
            `(sudo -n pacman -S --needed --noconfirm ${pkgArgs} || sudo pacman -S --needed ${pkgArgs}); ` +
            `else pacman -S --needed ${pkgArgs}; fi`
        ).catch(() => {});
    }

    const stillMissing: string[] = [];
    for (const dep of required) {
        if (!(await hostCmdExists(dep))) stillMissing.push(dep);
    }
    if (stillMissing.length > 0) {
        throw new Error(
            `Missing host dependencies: ${stillMissing.join(', ')}. ` +
            `Install on host (Arch): sudo pacman -S --needed swww hyprland`
        );
    }
}

async function disableIfExists(unit: string) {
    await run('systemctl', ['--user', 'disable', '--now', unit]).catch(() => {});
    await run('systemctl', ['--user', 'reset-failed', unit]).catch(() => {});
}

async function detectAndHandleConflicts(force: boolean) {
    // Conflictos directos con swww (estos sí o sí)
    await disableIfExists('swww.service');
    await disableIfExists('swww-daemon.service');

    // Otros gestores de wallpaper (solo si force)
    if (!force) return;

    const suspects = [
        'hyprpaper.service',
        'swaybg.service',
        'wbg.service',
        'wallpaperd.service',
        'swww-wallpaperd.service'
    ];

    for (const u of suspects) {
        await disableIfExists(u);
    }
}

export async function initKitowall(opts: {
    namespace?: string;
    apply?: boolean;
    force?: boolean;
}): Promise<void> {
    const config = loadConfig(); // crea/migra config si hace falta
    const state = loadState();   // crea/migra state si hace falta

    const ns = (opts.namespace && opts.namespace.trim()) ? opts.namespace.trim() : 'kitowall';
    const force = !!opts.force;

    // Validaciones mínimas
    await ensureHostDeps();

    // Apagar servicios que pisan el wallpaper
    await detectAndHandleConflicts(force);

    const userDir = join(homedir(), '.config', 'systemd', 'user');
    ensureDir(userDir);

    const nodePath = process.execPath;
    const cliPath = resolve(process.argv[1]); // dist/cli.js absoluto
    const cliInvoke = `${JSON.stringify(nodePath)} ${JSON.stringify(cliPath)}`;

    const xdgRuntimeDir = (process.env.XDG_RUNTIME_DIR && process.env.XDG_RUNTIME_DIR.trim())
        ? process.env.XDG_RUNTIME_DIR.trim()
        : `/run/user/${process.getuid?.() ?? 1000}`;

    const pathEnv = [
        `${homedir()}/.local/bin`,
        '/usr/local/bin',
        '/usr/bin',
        '/bin'
    ].join(':');

    // Resolve WAYLAND_DISPLAY at runtime for every service start. This avoids
    // stale values across relogin (e.g. wayland-0 vs wayland-1).
    const waylandBootstrap =
        'WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-$(ls \\"$XDG_RUNTIME_DIR\\"/wayland-* 2>/dev/null | xargs -r -n1 basename | sort | tail -n1)}"; ' +
        'if [ -z "$WAYLAND_DISPLAY" ]; then WAYLAND_DISPLAY=wayland-1; fi; ' +
        'export WAYLAND_DISPLAY;';

    // 1) swww-daemon template
    const swwwDaemonTemplate = `
[Unit]
Description=swww wallpaper daemon (namespace %i)
After=graphical-session.target
Wants=graphical-session.target

[Service]
Type=simple
Environment=PATH=${pathEnv}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
ExecStart=/bin/sh -lc ${esc(`${waylandBootstrap} exec swww-daemon --no-cache --namespace %i`)}
Restart=on-failure
RestartSec=1

[Install]
WantedBy=default.target
`.trimStart();

    writeFileSync(join(userDir, 'swww-daemon@.service'), swwwDaemonTemplate, 'utf8');

    // 2) kitowall-next.service (oneshot)
    // OJO: aunque CLI ignore --namespace en algunos comandos, aquí lo dejamos por compatibilidad.
    const nextExec = `/bin/sh -lc ${esc(`${waylandBootstrap} exec ${cliInvoke} next --namespace ${JSON.stringify(ns)}`)}`;

    const kitowallNextService = `
[Unit]
Description=Kitowall apply next wallpapers
After=swww-daemon@${ns}.service
Requires=swww-daemon@${ns}.service

[Service]
Type=oneshot
Environment=PATH=${pathEnv}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
ExecStart=${nextExec}
`.trimStart();

    writeFileSync(join(userDir, 'kitowall-next.service'), kitowallNextService, 'utf8');

    // 3) kitowall-watch.service (hotplug watcher)
    const watchExec = `/bin/sh -lc ${esc(`${waylandBootstrap} exec ${cliInvoke} watch --namespace ${JSON.stringify(ns)}`)}`;

    const kitowallWatchService = `
[Unit]
Description=Kitowall watcher (monitor hotplug)
After=graphical-session.target swww-daemon@${ns}.service
Requires=swww-daemon@${ns}.service
Wants=graphical-session.target

[Service]
Type=simple
Environment=PATH=${pathEnv}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
ExecStart=${watchExec}
Restart=on-failure
RestartSec=1

[Install]
WantedBy=default.target
`.trimStart();

    writeFileSync(join(userDir, 'kitowall-watch.service'), kitowallWatchService, 'utf8');

    // 4) kitowall-login-apply.service (apply once on login to avoid gray background)
    const loginApplyExec = `/bin/sh -lc ${esc(`sleep 2; ${waylandBootstrap} exec ${cliInvoke} rotate-now --namespace ${JSON.stringify(ns)} --force`)}`;

    const kitowallLoginApplyService = `
[Unit]
Description=Kitowall apply wallpapers on session start
After=graphical-session.target swww-daemon@${ns}.service
Requires=swww-daemon@${ns}.service
Wants=graphical-session.target

[Service]
Type=oneshot
Environment=PATH=${pathEnv}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
ExecStart=${loginApplyExec}

[Install]
WantedBy=default.target
`.trimStart();

    writeFileSync(join(userDir, 'kitowall-login-apply.service'), kitowallLoginApplyService, 'utf8');

    // Activación
    await run('systemctl', ['--user', 'daemon-reload']);
    await run('systemctl', ['--user', 'enable', '--now', `swww-daemon@${ns}.service`]);
    await run('systemctl', ['--user', 'enable', '--now', 'kitowall-watch.service']);
    // login-apply is oneshot and can fail on first run if library is still empty.
    // Enable it for next graphical session, but do not make init fail here.
    await run('systemctl', ['--user', 'enable', 'kitowall-login-apply.service']);
    await run('systemctl', ['--user', 'start', 'kitowall-login-apply.service']).catch(() => {});

    // Si quieres: aplicar una vez ahora mismo
    if (opts.apply) {
        const controller = new Controller(config, state);
        await controller.applyNext(undefined);
    }
}
