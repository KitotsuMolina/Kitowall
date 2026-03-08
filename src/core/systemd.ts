// src/core/systemd.ts
import {mkdirSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join, resolve} from 'node:path';
import {run} from '../utils/exec';

function ensureDir(path: string) {
    mkdirSync(path, {recursive: true});
}

function systemdInterval(every: string): string {
    // Acepta: 30s / 10m / 1h / 1d  -> systemd: 30s / 10min / 1h / 1day
    const m = every.trim().match(/^(\d+)\s*([smhd])$/i);
    if (!m) throw new Error(`Invalid --every value: ${every} (use like 30s, 10m, 1h)`);
    const n = Number(m[1]);
    const u = m[2].toLowerCase();
    if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --every value: ${every}`);

    if (u === 's') return `${n}s`;
    if (u === 'm') return `${n}min`;
    if (u === 'h') return `${n}h`;
    return `${n}day`;
}

/**
 * installSystemd: instala/actualiza SOLO el TIMER.
 * Para compatibilidad, acepta pack/namespace pero no los usa.
 */
export async function installSystemd(opts: {
    every: string;
    pack?: string;
    namespace?: string;
}): Promise<void> {
    const userDir = join(homedir(), '.config', 'systemd', 'user');
    ensureDir(userDir);

    const every = systemdInterval(opts.every);
    const ns = (opts.namespace && opts.namespace.trim()) ? opts.namespace.trim() : 'kitowall';
    const nodePath = process.execPath;
    const cliPath = resolve(process.argv[1] || '');

    const xdgRuntimeDir = (process.env.XDG_RUNTIME_DIR && process.env.XDG_RUNTIME_DIR.trim())
        ? process.env.XDG_RUNTIME_DIR.trim()
        : `/run/user/${process.getuid?.() ?? 1000}`;
    const pathEnv = [
        `${homedir()}/.local/bin`,
        '/usr/local/bin',
        '/usr/bin',
        '/bin'
    ].join(':');
    const waylandBootstrap =
        'WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-$(ls \\"$XDG_RUNTIME_DIR\\"/wayland-* 2>/dev/null | xargs -r -n1 basename | sort | tail -n1)}"; ' +
        'if [ -z "$WAYLAND_DISPLAY" ]; then WAYLAND_DISPLAY=wayland-1; fi; ' +
        'export WAYLAND_DISPLAY;';

    const nextCmd = `${waylandBootstrap} exec ${JSON.stringify(nodePath)} ${JSON.stringify(cliPath)} rotate-now --namespace ${JSON.stringify(ns)} --force`;

    const kitowallNextService = `
        [Unit]
        Description=Kitowall apply next wallpapers

        [Service]
        Type=oneshot
        Environment=PATH=${pathEnv}
        Environment=XDG_RUNTIME_DIR=${xdgRuntimeDir}
        ExecStart=/bin/sh -lc ${JSON.stringify(nextCmd)}
    `.trimStart();

    writeFileSync(join(userDir, 'kitowall-next.service'), kitowallNextService, 'utf8');

    const kitowallTimer = `
        [Unit]
        Description=Run kitowall-next periodically
        
        [Timer]
        OnBootSec=2s
        OnStartupSec=2s
        AccuracySec=1s
        RandomizedDelaySec=0
        OnUnitActiveSec=${every}
        Unit=kitowall-next.service
        Persistent=true
        
        [Install]
        WantedBy=timers.target
    `.trimStart();

    writeFileSync(join(userDir, 'kitowall-next.timer'), kitowallTimer, 'utf8');

    await run('systemctl', ['--user', 'daemon-reload']);
    await run('systemctl', ['--user', 'reset-failed', 'kitowall-next.service']).catch(() => {});
    await run('systemctl', ['--user', 'reset-failed', 'kitowall-next.timer']).catch(() => {});
    await run('systemctl', ['--user', 'enable', '--now', 'kitowall-next.timer']);
}

export async function uninstallSystemd(): Promise<void> {
    await run('systemctl', ['--user', 'disable', '--now', 'kitowall-next.timer']).catch(() => {});
    await run('systemctl', ['--user', 'daemon-reload']).catch(() => {});
}

export async function systemdStatus(): Promise<void> {
    await run('systemctl', ['--user', 'status', 'kitowall-next.timer']);
}
