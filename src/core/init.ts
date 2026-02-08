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
    if (process.env.FLATPAK_ID) {
        throw new Error(
            'init/repair cannot be executed from Flatpak UI because it would generate host systemd units with sandbox paths. ' +
            'Run on host shell: kitowall init --namespace kitowall --apply --force (or, in local dev, node dist/cli.js init --namespace kitowall --apply --force)'
        );
    }

    const config = loadConfig(); // crea/migra config si hace falta
    const state = loadState();   // crea/migra state si hace falta

    const ns = (opts.namespace && opts.namespace.trim()) ? opts.namespace.trim() : 'kitowall';
    const force = !!opts.force;

    // Validaciones mínimas
    await run('which', ['swww']).catch(() => { throw new Error('Missing dependency: swww'); });
    await run('which', ['swww-daemon']).catch(() => { throw new Error('Missing dependency: swww-daemon'); });
    await run('which', ['hyprctl']).catch(() => { throw new Error('Missing dependency: hyprctl'); });

    // Apagar servicios que pisan el wallpaper
    await detectAndHandleConflicts(force);

    const userDir = join(homedir(), '.config', 'systemd', 'user');
    ensureDir(userDir);

    const nodePath = process.execPath;
    const cliPath = resolve(process.argv[1]); // dist/cli.js absoluto

    // Entorno Wayland (defaults seguros)
    const waylandDisplay = (process.env.WAYLAND_DISPLAY && process.env.WAYLAND_DISPLAY.trim())
        ? process.env.WAYLAND_DISPLAY.trim()
        : 'wayland-1';

    const xdgRuntimeDir = (process.env.XDG_RUNTIME_DIR && process.env.XDG_RUNTIME_DIR.trim())
        ? process.env.XDG_RUNTIME_DIR.trim()
        : `/run/user/${process.getuid?.() ?? 1000}`;

    const pathEnv = [
        `${homedir()}/.local/bin`,
        '/usr/local/bin',
        '/usr/bin',
        '/bin'
    ].join(':');

    // 1) swww-daemon template
    const swwwDaemonTemplate = `
[Unit]
Description=swww wallpaper daemon (namespace %i)
After=graphical-session.target
PartOf=graphical-session.target

[Service]
Type=simple
Environment=PATH=${pathEnv}
Environment=WAYLAND_DISPLAY=${waylandDisplay}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
ExecStart=swww-daemon --no-cache --namespace %i
Restart=on-failure
RestartSec=1

[Install]
WantedBy=graphical-session.target
`.trimStart();

    writeFileSync(join(userDir, 'swww-daemon@.service'), swwwDaemonTemplate, 'utf8');

    // 2) kitowall-next.service (oneshot)
    // OJO: aunque CLI ignore --namespace en algunos comandos, aquí lo dejamos por compatibilidad.
    const nextExec = `${nodePath} ${esc(cliPath)} ${esc('next')} ${esc('--namespace')} ${esc(ns)}`;

    const kitowallNextService = `
[Unit]
Description=Kitowall apply next wallpapers
After=swww-daemon@${ns}.service
Requires=swww-daemon@${ns}.service

[Service]
Type=oneshot
Environment=PATH=${pathEnv}
Environment=WAYLAND_DISPLAY=${waylandDisplay}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
ExecStart=${nextExec}
`.trimStart();

    writeFileSync(join(userDir, 'kitowall-next.service'), kitowallNextService, 'utf8');

    // 3) kitowall-watch.service (hotplug watcher)
    const watchExec = `${nodePath} ${esc(cliPath)} ${esc('watch')} ${esc('--namespace')} ${esc(ns)}`;

    const kitowallWatchService = `
[Unit]
Description=Kitowall watcher (monitor hotplug)
After=graphical-session.target swww-daemon@${ns}.service
Requires=swww-daemon@${ns}.service
PartOf=graphical-session.target

[Service]
Type=simple
Environment=PATH=${pathEnv}
Environment=WAYLAND_DISPLAY=${waylandDisplay}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
ExecStart=${watchExec}
Restart=on-failure
RestartSec=1

[Install]
WantedBy=graphical-session.target
`.trimStart();

    writeFileSync(join(userDir, 'kitowall-watch.service'), kitowallWatchService, 'utf8');

    // 4) kitowall-login-apply.service (apply once on login to avoid gray background)
    const loginApplyExec = `/bin/sh -lc ${esc(`sleep 2; ${nodePath} ${esc(cliPath)} ${esc('rotate-now')} ${esc('--namespace')} ${esc(ns)} ${esc('--force')}`)}`;

    const kitowallLoginApplyService = `
[Unit]
Description=Kitowall apply wallpapers on session start
After=graphical-session.target swww-daemon@${ns}.service
Requires=swww-daemon@${ns}.service
PartOf=graphical-session.target

[Service]
Type=oneshot
Environment=PATH=${pathEnv}
Environment=WAYLAND_DISPLAY=${waylandDisplay}
Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
ExecStart=${loginApplyExec}

[Install]
WantedBy=graphical-session.target
`.trimStart();

    writeFileSync(join(userDir, 'kitowall-login-apply.service'), kitowallLoginApplyService, 'utf8');

    // Activación
    await run('systemctl', ['--user', 'daemon-reload']);
    await run('systemctl', ['--user', 'enable', '--now', `swww-daemon@${ns}.service`]);
    await run('systemctl', ['--user', 'enable', '--now', 'kitowall-watch.service']);
    await run('systemctl', ['--user', 'enable', '--now', 'kitowall-login-apply.service']);

    // Si quieres: aplicar una vez ahora mismo
    if (opts.apply) {
        const controller = new Controller(config, state);
        await controller.applyNext(undefined);
    }
}
