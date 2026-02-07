// src/core/systemd.ts
import {mkdirSync, writeFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
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
    await run('systemctl', ['--user', 'enable', '--now', 'kitowall-next.timer']);
}

export async function uninstallSystemd(): Promise<void> {
    await run('systemctl', ['--user', 'disable', '--now', 'kitowall-next.timer']).catch(() => {});
    await run('systemctl', ['--user', 'daemon-reload']).catch(() => {});
}

export async function systemdStatus(): Promise<void> {
    await run('systemctl', ['--user', 'status', 'kitowall-next.timer']);
}