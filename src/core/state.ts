// Runtime state persistence.
import os from 'os';
import path from 'path';
import fs from 'fs';
import {readJson, writeJson} from '../utils/fs';

export interface State {
  mode: 'manual' | 'rotate';
  current_pack: string | null;

  last_outputs: string[];
  last_set: Record<string, string>;
  last_updated: number;

  // Fase 2B: memoria para evitar repeticiones
  recent_by_output: Record<string, string[]>;
  recent_global: string[];
}

export function setMode(state: State, mode: 'manual' | 'rotate'): void {
  state.mode = mode;
  state.last_updated = Date.now();
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const RECENT_LIMIT = 10;

// Cola LRU simple: dedupe + push + cap
function pushRecent(queue: string[], value: string, limit = RECENT_LIMIT): string[] {
  const next = (queue ?? []).filter(v => v !== value);
  next.push(value);
  return next.slice(Math.max(0, next.length - limit));
}

// Anti-growth hard: recorta TODO a RECENT_LIMIT siempre
function trimRecentState(state: State, limit = RECENT_LIMIT): void {
  // Global
  if (!Array.isArray(state.recent_global)) state.recent_global = [];
  state.recent_global = state.recent_global.slice(-limit);

  // Por output
  if (typeof state.recent_by_output !== 'object' || state.recent_by_output === null) {
    state.recent_by_output = {};
  }

  for (const out of Object.keys(state.recent_by_output)) {
    const q = state.recent_by_output[out];
    if (!Array.isArray(q)) {
      state.recent_by_output[out] = [];
    } else {
      state.recent_by_output[out] = q.slice(-limit);
    }
  }
}

/**
 * Borra state de outputs que ya no existen (hotplug cleanup).
 * Llamar en cada tick con la lista de outputs actuales.
 */
export function cleanupDisconnectedOutputs(state: State, currentOutputs: string[]): void {
  const alive = new Set(currentOutputs);

  // last_set
  if (!state.last_set) state.last_set = {};
  for (const out of Object.keys(state.last_set)) {
    if (!alive.has(out)) delete state.last_set[out];
  }

  // recent_by_output
  if (!state.recent_by_output) state.recent_by_output = {};
  for (const out of Object.keys(state.recent_by_output)) {
    if (!alive.has(out)) delete state.recent_by_output[out];
  }

  state.last_outputs = [...currentOutputs];

  // seguridad extra
  trimRecentState(state);
}

/**
 * Registra lo que se aplicó para un output y actualiza colas recientes.
 * Llamar DESPUÉS de aplicar con swww.
 */
export function commitSelection(state: State, output: string, pathStr: string, now = Date.now()): void {
  if (!state.last_set) state.last_set = {};
  if (!state.recent_by_output) state.recent_by_output = {};
  if (!state.recent_global) state.recent_global = [];

  state.last_set[output] = pathStr;

  state.recent_by_output[output] = pushRecent(state.recent_by_output[output] ?? [], pathStr);
  state.recent_global = pushRecent(state.recent_global ?? [], pathStr);

  state.last_updated = now;

  // anti-growth hard
  trimRecentState(state);
}

export function getStatePath(): string {
  return path.join(os.homedir(), '.local', 'state', 'hyprwall', 'state.json');
}

function ensureStateDir(): void {
  const dir = path.dirname(getStatePath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
}

export function defaultState(): State {
  return {
    mode: 'manual',
    current_pack: null,
    last_outputs: [],
    last_set: {},
    last_updated: 0,
    recent_by_output: {},
    recent_global: []
  };
}

export function loadState(): State {
  const statePath = getStatePath();
  const fallback = defaultState();
  const stateFileExists = fs.existsSync(statePath);

  const state = readJson<State>(statePath, fallback);

  if (!stateFileExists || !state || Object.keys(state).length === 0) {
    ensureStateDir();
    writeJson(statePath, fallback);
    return fallback;
  }

  // Snapshot antes de migraciones para decidir si guardar o no
  const originalState = JSON.parse(JSON.stringify(state)) as State;

  // Migraciones / defaults
  if (state.mode !== 'manual' && state.mode !== 'rotate') state.mode = 'manual';
  if (typeof state.current_pack === 'undefined') state.current_pack = null;

  if (!state.last_outputs) state.last_outputs = [];
  if (!state.last_set) state.last_set = {};
  if (typeof state.last_updated !== 'number') state.last_updated = 0;

  if (!state.recent_by_output) state.recent_by_output = {};
  if (!state.recent_global) state.recent_global = [];

  // Normalización básica (por si vienen corruptos)
  if (!Array.isArray(state.recent_global)) state.recent_global = [];
  if (typeof state.recent_by_output !== 'object' || state.recent_by_output === null) {
    state.recent_by_output = {};
  }

  // Anti-growth hard (Fase 2B): recorta colas a 10 siempre
  trimRecentState(state);

  // Persistir solo si hubo cambios por migración
  if (!deepEqual(state, originalState)) {
    ensureStateDir();
    writeJson(statePath, state);
  }

  return state;
}

export function saveState(state: State): void {
  ensureStateDir();

  const statePath = getStatePath();
  const existing = fs.existsSync(statePath) ? readJson<State>(statePath, defaultState()) : null;

  if (existing && deepEqual(existing, state)) return;

  writeJson(statePath, state);
}