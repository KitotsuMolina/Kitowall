// Config loading/saving and defaults.
import os from 'os';
import path from 'path';
import fs from 'fs';
import {readJson, writeJson} from '../utils/fs';

export type PackType =
    | 'local'
    | 'wallhaven'
    | 'reddit'
    | 'unsplash'
    | 'generic_json'
    | 'static_url';

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function getConfigPath(): string {
  return path.join(os.homedir(), '.config', 'hyprwall', 'config.json');
}

function ensureConfigDir(): void {
  const dir = path.dirname(getConfigPath());
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
}

export interface SelectionConfig {
  perOutputCooldown: number; // últimas N por output
  globalCooldown: number; // últimas M global
  avoidSameTickDuplicates: boolean;
}

export interface TransitionConfig {
  type: string;
  fps: number;
  duration: number;
}

export interface LocalPackConfig {
  type: 'local';
  paths: string[];
}

export interface PackConfigBase {
  type: PackType;
}

export type PackConfig = LocalPackConfig | PackConfigBase;

export function isLocalPack(pack: PackConfig): pack is LocalPackConfig {
  return pack.type === 'local';
}

export interface Config {
  mode: 'manual' | 'rotate';
  rotation_interval_seconds: number;
  transition: TransitionConfig;
  selection: SelectionConfig;
  packs: Record<string, PackConfig>;
}

export function defaultConfig(): Config {
  return {
    mode: 'manual',
    rotation_interval_seconds: 1800,
    transition: {type: 'center', fps: 60, duration: 0.7},
    selection: {
      perOutputCooldown: 10,
      globalCooldown: 20,
      avoidSameTickDuplicates: true
    },
    packs: {
      sao: {type: 'local', paths: ['~/Pictures/Wallpapers/SAO']},
      edgerunners: {type: 'local', paths: ['~/Pictures/Wallpapers/Edgerunners']}
    }
  };
}

export function loadConfig(): Config {
  const configPath = getConfigPath();
  const fallback = defaultConfig();
  const configFileExists = fs.existsSync(configPath);
  const config = readJson<Config>(configPath, fallback);

  if (!configFileExists || !config || Object.keys(config).length === 0) {
    ensureConfigDir();
    writeJson(configPath, fallback);
    return fallback;
  }

  // Snapshot antes de migraciones para decidir si guardar o no
  const originalConfig = JSON.parse(JSON.stringify(config)) as Config;

  if (!config.transition) config.transition = fallback.transition;

  if (!config.packs || Object.keys(config.packs).length === 0) {
    config.packs = fallback.packs;
  }

  if (!config.selection) config.selection = fallback.selection;

  // Normaliza valores por si vienen corruptos
  if (
      typeof config.selection.perOutputCooldown !== 'number' ||
      config.selection.perOutputCooldown < 0
  ) {
    config.selection.perOutputCooldown = fallback.selection.perOutputCooldown;
  }

  if (
      typeof config.selection.globalCooldown !== 'number' ||
      config.selection.globalCooldown < 0
  ) {
    config.selection.globalCooldown = fallback.selection.globalCooldown;
  }

  if (typeof config.selection.avoidSameTickDuplicates !== 'boolean') {
    config.selection.avoidSameTickDuplicates = fallback.selection.avoidSameTickDuplicates;
  }

  // Persistir solo si hubo cambios por migración
  if (!deepEqual(config, originalConfig)) {
    ensureConfigDir();
    writeJson(configPath, config);
  }

  return config;
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeJson(getConfigPath(), config);
}