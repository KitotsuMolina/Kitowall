// Persistent system logs for requests/downloads and diagnostics.
import fs from 'fs';
import path from 'path';
import os from 'os';
import {ensureDir} from '../utils/fs';

export type LogLevel = 'info' | 'warn' | 'error';

export interface SystemLogEntry {
  ts: number;
  level: LogLevel;
  source?: string;
  pack?: string;
  action: string;
  message?: string;
  url?: string;
  status?: number;
  meta?: Record<string, unknown>;
}

const LOG_DIR = path.join(os.homedir(), '.local', 'state', 'hyprwall');
const LOG_FILE = path.join(LOG_DIR, 'logs.jsonl');
const MAX_LINES = 5000;

export function getLogsPath(): string {
  return LOG_FILE;
}

export function redactUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return rawUrl;
  try {
    const u = new URL(rawUrl);
    const sensitive = new Set([
      'api_key',
      'apikey',
      'key',
      'token',
      'access_token',
      'client_id',
      'client_secret',
      'authorization'
    ]);
    for (const key of Array.from(u.searchParams.keys())) {
      if (sensitive.has(key.toLowerCase())) {
        u.searchParams.set(key, '***');
      }
    }
    return u.toString();
  } catch {
    return rawUrl;
  }
}

export function appendSystemLog(entry: Omit<SystemLogEntry, 'ts'> & {ts?: number}): void {
  try {
    ensureDir(LOG_DIR);
    const row: SystemLogEntry = {
      ts: entry.ts ?? Date.now(),
      level: entry.level,
      source: entry.source,
      pack: entry.pack,
      action: entry.action,
      message: entry.message,
      url: redactUrl(entry.url),
      status: entry.status,
      meta: entry.meta
    };
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(row)}\n`, 'utf8');
    trimLogsIfNeeded();
  } catch {
    // Logging must never break core features.
  }
}

export function listSystemLogs(opts?: {
  limit?: number;
  source?: string;
  pack?: string;
  level?: LogLevel;
  q?: string;
}): SystemLogEntry[] {
  if (!fs.existsSync(LOG_FILE)) return [];
  const raw = fs.readFileSync(LOG_FILE, 'utf8');
  const rows = raw.split('\n').filter(Boolean);
  const parsed: SystemLogEntry[] = [];
  for (const line of rows) {
    try {
      const item = JSON.parse(line) as SystemLogEntry;
      parsed.push(item);
    } catch {
      // ignore invalid lines
    }
  }
  let out = parsed.sort((a, b) => b.ts - a.ts);
  if (opts?.source) out = out.filter(e => (e.source ?? '') === opts.source);
  if (opts?.pack) out = out.filter(e => (e.pack ?? '') === opts.pack);
  if (opts?.level) out = out.filter(e => e.level === opts.level);
  if (opts?.q) {
    const q = opts.q.toLowerCase();
    out = out.filter(e => {
      const blob = [
        e.source ?? '',
        e.pack ?? '',
        e.action ?? '',
        e.message ?? '',
        e.url ?? '',
        JSON.stringify(e.meta ?? {})
      ].join(' ').toLowerCase();
      return blob.includes(q);
    });
  }
  const limit = Math.max(1, Math.floor(opts?.limit ?? 200));
  return out.slice(0, limit);
}

export function clearSystemLogs(): {ok: true; removed: number} {
  try {
    if (!fs.existsSync(LOG_FILE)) return {ok: true, removed: 0};
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const removed = raw.split('\n').filter(Boolean).length;
    fs.unlinkSync(LOG_FILE);
    return {ok: true, removed};
  } catch {
    return {ok: true, removed: 0};
  }
}

function trimLogsIfNeeded(): void {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const rows = raw.split('\n').filter(Boolean);
    if (rows.length <= MAX_LINES) return;
    const keep = rows.slice(rows.length - MAX_LINES);
    fs.writeFileSync(LOG_FILE, `${keep.join('\n')}\n`, 'utf8');
  } catch {
    // best effort
  }
}
