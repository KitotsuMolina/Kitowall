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
  angle?: number;
  pos?: string;
}

export interface LocalPackConfig {
  type: 'local';
  paths: string[];
}

export interface WallhavenPackConfig {
  type: 'wallhaven';
  apiKey?: string;
  apiKeyEnv?: string;
  keyword?: string;
  subthemes?: string[];
  categories?: string;
  purity?: string;
  allowSfw?: boolean;
  allowSketchy?: boolean;
  allowNsfw?: boolean;
  categoryGeneral?: boolean;
  categoryAnime?: boolean;
  categoryPeople?: boolean;
  ratios?: string[];
  colors?: string;
  atleast?: string;
  sorting?: string;
  aiArt?: boolean;
  ttlSec?: number;
}

export interface RedditPackConfig {
  type: 'reddit';
  subreddits?: string | string[];
  subthemes?: string[];
  allowSfw?: boolean;
  minWidth?: number;
  minHeight?: number;
  ratioW?: number;
  ratioH?: number;
  sort?: string;
  time?: string;
  ttlSec?: number;
}

export interface UnsplashPackConfig {
  type: 'unsplash';
  apiKey?: string;
  apiKeyEnv?: string;
  query?: string;
  subthemes?: string[];
  topics?: string;
  collections?: string;
  username?: string;
  orientation?: string;
  contentFilter?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageFit?: string;
  imageQuality?: number;
  ttlSec?: number;
}

export interface GenericJsonPackConfig {
  type: 'generic_json';
  endpoint?: string;
  imagePath?: string;
  imagePrefix?: string;
  candidateLimit?: number;
  postPath?: string;
  postPrefix?: string;
  authorNamePath?: string;
  authorUrlPath?: string;
  authorUrlPrefix?: string;
  domain?: string;
  ttlSec?: number;
}

export interface StaticUrlPackConfig {
  type: 'static_url';
  url?: string;
  urls?: string[];
  authorName?: string;
  authorUrl?: string;
  domain?: string;
  postUrl?: string;
  differentImages?: boolean;
  count?: number;
  ttlSec?: number;
}

export interface PackConfigBase {
  type: PackType;
}

export type PackConfig =
  | LocalPackConfig
  | WallhavenPackConfig
  | RedditPackConfig
  | UnsplashPackConfig
  | GenericJsonPackConfig
  | StaticUrlPackConfig
  | PackConfigBase;

export function isLocalPack(pack: PackConfig): pack is LocalPackConfig {
  return pack.type === 'local';
}

export function isGenericJsonPack(pack: PackConfig): pack is GenericJsonPackConfig {
  return pack.type === 'generic_json';
}

export function isRedditPack(pack: PackConfig): pack is RedditPackConfig {
  return pack.type === 'reddit';
}

export function isWallhavenPack(pack: PackConfig): pack is WallhavenPackConfig {
  return pack.type === 'wallhaven';
}

export function isUnsplashPack(pack: PackConfig): pack is UnsplashPackConfig {
  return pack.type === 'unsplash';
}

export function isStaticUrlPack(pack: PackConfig): pack is StaticUrlPackConfig {
  return pack.type === 'static_url';
}

export function normalizePackName(input: string): string {
  const trimmed = input.trim().toLowerCase();
  const replaced = trimmed.replace(/[\s_]+/g, '-');
  const cleaned = replaced.replace(/[^a-z0-9-]/g, '');
  return cleaned.replace(/-+/g, '-');
}

export function resolveApiKey(apiKey?: string, apiKeyEnv?: string): string | undefined {
  if (apiKey && apiKey.trim().length > 0) return apiKey.trim();
  if (apiKeyEnv && process.env[apiKeyEnv]) return String(process.env[apiKeyEnv]).trim();
  return undefined;
}

function normalizeStringArray(input: string | string[] | undefined): string[] | undefined {
  if (input === undefined) return undefined;
  if (Array.isArray(input)) return input.map(s => String(s).trim()).filter(Boolean);
  return String(input)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
}

export interface Config {
  mode: 'manual' | 'rotate';
  rotation_interval_seconds: number;
  transition: TransitionConfig;
  selection: SelectionConfig;
  cache: {
    dir: string;
    downloadDir: string;
    maxMB: number;
    defaultTtlSec: number;
  };
  pool?: {
    enabled: boolean;
    sources: Array<{name: string; weight?: number; maxCandidates?: number}>;
    dedupe?: 'path' | 'hash' | 'url';
  };
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
    cache: {
      dir: '~/.cache/hyprwall',
      downloadDir: '~/Pictures/Wallpapers',
      maxMB: 2048,
      defaultTtlSec: 604800
    },
    pool: {
      enabled: false,
      sources: [],
      dedupe: 'path'
    },
    packs: {}
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

  if (!config.packs) config.packs = {};

  if (!config.selection) config.selection = fallback.selection;
  if (!config.cache) config.cache = fallback.cache;
  if (!config.pool) config.pool = fallback.pool;

  // Normaliza nombres de packs y valida packs mínimos
  if (config.packs) {
    const normalizedPacks: Record<string, PackConfig> = {};
    for (const [rawName, pack] of Object.entries(config.packs)) {
      const name = normalizePackName(rawName);
      if (!name)
        continue;

      if (!pack || typeof pack.type !== 'string')
        continue;

      // Validación estricta por tipo
      switch (pack.type) {
      case 'local': {
        const local = pack as LocalPackConfig;
        if (!Array.isArray(local.paths) || local.paths.length === 0)
          continue;
        break;
      }
      case 'static_url': {
        const p = pack as StaticUrlPackConfig;
        const hasUrl = typeof p.url === 'string' && p.url.trim().length > 0;
        const hasUrls = Array.isArray(p.urls) && p.urls.length > 0;
        if (!hasUrl && !hasUrls)
          continue;
        if (hasUrls) {
          p.urls = (p.urls ?? []).map(u => String(u).trim()).filter(Boolean);
          if (p.urls.length === 0) continue;
        }
        if (p.count !== undefined) {
          const n = Number(p.count);
          if (!Number.isFinite(n) || n <= 0) {
            p.count = 1;
          } else {
            p.count = Math.floor(n);
          }
        }
        if (p.ttlSec !== undefined) {
          const t = Number(p.ttlSec);
          if (!Number.isFinite(t) || t <= 0) {
            p.ttlSec = undefined;
          } else {
            p.ttlSec = Math.floor(t);
          }
        }
        break;
      }
      case 'generic_json': {
        const p = pack as GenericJsonPackConfig;
        if (!p.endpoint || !p.imagePath)
          continue;
        if (p.candidateLimit !== undefined) {
          const n = Number(p.candidateLimit);
          if (!Number.isFinite(n) || n <= 0) {
            p.candidateLimit = 50;
          } else {
            p.candidateLimit = Math.floor(n);
          }
        }
        if (p.ttlSec !== undefined) {
          const t = Number(p.ttlSec);
          if (!Number.isFinite(t) || t <= 0) {
            p.ttlSec = undefined;
          } else {
            p.ttlSec = Math.floor(t);
          }
        }
        break;
      }
      case 'wallhaven': {
        const p = pack as WallhavenPackConfig;
        // Map boolean flags to categories/purity if provided
        if (!p.categories && (p.categoryGeneral !== undefined || p.categoryAnime !== undefined || p.categoryPeople !== undefined)) {
          const general = p.categoryGeneral ? 1 : 0;
          const anime = p.categoryAnime ? 1 : 0;
          const people = p.categoryPeople ? 1 : 0;
          p.categories = `${general}${anime}${people}`;
        }
        if (!p.purity && (p.allowSfw !== undefined || p.allowSketchy !== undefined || p.allowNsfw !== undefined)) {
          const sfw = p.allowSfw ? 1 : 0;
          const sketchy = p.allowSketchy ? 1 : 0;
          const nsfw = p.allowNsfw ? 1 : 0;
          p.purity = `${sfw}${sketchy}${nsfw}`;
        }
        if (p.ratios)
          p.ratios = normalizeStringArray(p.ratios);
        if (p.subthemes)
          p.subthemes = normalizeStringArray(p.subthemes);
        if (p.ttlSec !== undefined) {
          const t = Number(p.ttlSec);
          if (!Number.isFinite(t) || t <= 0) {
            p.ttlSec = undefined;
          } else {
            p.ttlSec = Math.floor(t);
          }
        }
        break;
      }
      case 'unsplash': {
        const p = pack as UnsplashPackConfig;
        if (p.subthemes)
          p.subthemes = normalizeStringArray(p.subthemes);
        if (p.ttlSec !== undefined) {
          const t = Number(p.ttlSec);
          if (!Number.isFinite(t) || t <= 0) {
            p.ttlSec = undefined;
          } else {
            p.ttlSec = Math.floor(t);
          }
        }
        break;
      }
      case 'reddit': {
        const p = pack as RedditPackConfig;
        if (!p.subreddits || (Array.isArray(p.subreddits) && p.subreddits.length === 0))
          continue;
        p.subreddits = normalizeStringArray(p.subreddits) ?? '';
        if (p.subthemes)
          p.subthemes = normalizeStringArray(p.subthemes);
        if (p.ttlSec !== undefined) {
          const t = Number(p.ttlSec);
          if (!Number.isFinite(t) || t <= 0) {
            p.ttlSec = undefined;
          } else {
            p.ttlSec = Math.floor(t);
          }
        }
        break;
      }
      default:
        break;
      }

      normalizedPacks[name] = pack;
    }
    config.packs = normalizedPacks;
  }
  if (!config.packs || Object.keys(config.packs).length === 0) {
    config.packs = fallback.packs;
  }

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

  // Normaliza cache
  if (!config.cache || typeof config.cache !== 'object') {
    config.cache = fallback.cache;
  } else {
    if (!config.cache.dir || typeof config.cache.dir !== 'string') {
      config.cache.dir = fallback.cache.dir;
    }
    if (!config.cache.downloadDir || typeof config.cache.downloadDir !== 'string') {
      config.cache.downloadDir = fallback.cache.downloadDir;
    }
    if (typeof config.cache.maxMB !== 'number' || config.cache.maxMB <= 0) {
      config.cache.maxMB = fallback.cache.maxMB;
    }
    if (typeof config.cache.defaultTtlSec !== 'number' || config.cache.defaultTtlSec <= 0) {
      config.cache.defaultTtlSec = fallback.cache.defaultTtlSec;
    }
  }

  // Normaliza pool
  if (!config.pool || typeof config.pool !== 'object') {
    config.pool = fallback.pool;
  } else {
    if (typeof config.pool.enabled !== 'boolean') {
      config.pool.enabled = false;
    }
    if (config.pool.dedupe !== 'path' && config.pool.dedupe !== 'hash' && config.pool.dedupe !== 'url') {
      config.pool.dedupe = 'path';
    }
    if (!Array.isArray(config.pool.sources)) {
      config.pool.sources = [];
    } else {
      const normalizedSources: Array<{name: string; weight?: number; maxCandidates?: number}> = [];
      for (const src of config.pool.sources) {
        if (!src || typeof src.name !== 'string') continue;
        const name = normalizePackName(src.name);
        if (!name) continue;
        let weight = src.weight ?? 1;
        if (!Number.isFinite(weight) || weight <= 0) weight = 1;
        let maxCandidates: number | undefined = src.maxCandidates;
        if (maxCandidates !== undefined) {
          const n = Number(maxCandidates);
          if (!Number.isFinite(n) || n <= 0) {
            maxCandidates = undefined;
          } else {
            maxCandidates = Math.floor(n);
          }
        }
        normalizedSources.push({name, weight: Math.floor(weight), maxCandidates});
      }
      config.pool.sources = normalizedSources;
    }
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
