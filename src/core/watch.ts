// src/core/watch.ts
import net from 'node:net';
import {readdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {loadConfig} from './config';
import {loadState} from './state';
import {Controller} from './controller';

function sleep(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
}

function getSocket2Path(): string {
    const xdg = process.env.XDG_RUNTIME_DIR || `/run/user/${process.getuid?.() ?? 1000}`;
    const sig = process.env.HYPRLAND_INSTANCE_SIGNATURE;

    if (sig) {
        const p = join(xdg, 'hypr', sig, '.socket2.sock');
        if (existsSync(p)) return p;
    }

    // Fallback: buscar cualquier socket2 (por si el env no está)
    const base = join(xdg, 'hypr');
    if (!existsSync(base)) throw new Error('Hyprland runtime dir not found');

    const dirs = readdirSync(base, {withFileTypes: true})
        .filter(d => d.isDirectory())
        .map(d => join(base, d.name, '.socket2.sock'))
        .filter(p => existsSync(p));

    if (dirs.length === 0) throw new Error('Hyprland socket2 not found');
    return dirs[0];
}

function isMonitorEvent(line: string): boolean {
    const s = line.toLowerCase();
    // Hyprland events: monitoradded/monitorremoved, etc.
    return s.includes('monitoradded') || s.includes('monitorremoved') || s.includes('monitor') && s.includes('added') || s.includes('removed');
}

export async function watchMonitors(opts: { namespace?: string; debounceMs?: number }): Promise<void> {
    const config = loadConfig();
    const state = loadState();
    const controller = new Controller(config, state);

    const sockPath = getSocket2Path();
    const debounceMs = Math.max(100, opts.debounceMs ?? 800);

    let buf = '';
    let timer: NodeJS.Timeout | null = null;

    async function trigger() {
        // pequeño delay para que Hyprland termine de registrar el monitor
        await sleep(200);
        await controller.applyNext(undefined);
    }

    const client = net.createConnection(sockPath);

    client.on('data', (data) => {
        buf += data.toString('utf8');
        let idx: number;

        while ((idx = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, idx).trim();
            buf = buf.slice(idx + 1);

            if (!line) continue;
            if (!isMonitorEvent(line)) continue;

            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                trigger().catch(() => {});
            }, debounceMs);
        }
    });

    client.on('error', (err) => {
        throw err;
    });

    // Mantener vivo
    await new Promise<void>(() => {});
}