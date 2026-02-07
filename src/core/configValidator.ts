// Formal config validator used before returning/saving config.
import {CONFIG_SCHEMA_VERSION} from './config';
import type {
  Config,
  GenericJsonPackConfig,
  LocalPackConfig,
  PackConfig,
  RedditPackConfig,
  StaticUrlPackConfig,
  UnsplashPackConfig,
  WallhavenPackConfig
} from './config';

function nonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function positiveNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function bitmask3(v: unknown): boolean {
  return typeof v === 'string' && /^[01]{3}$/.test(v);
}

function validatePack(name: string, pack: PackConfig, errors: string[]): void {
  if (!nonEmptyString(pack?.type)) {
    errors.push(`pack "${name}": missing type`);
    return;
  }

  switch (pack.type) {
  case 'local': {
    const p = pack as LocalPackConfig;
    if (!Array.isArray(p.paths) || p.paths.length === 0) {
      errors.push(`pack "${name}": local.paths must be a non-empty array`);
    }
    break;
  }
  case 'wallhaven': {
    const p = pack as WallhavenPackConfig;
    if (!nonEmptyString(p.keyword)) {
      errors.push(`pack "${name}": wallhaven.keyword is required`);
    }
    if (p.categories !== undefined && !bitmask3(p.categories)) {
      errors.push(`pack "${name}": wallhaven.categories must be 3-bit mask (e.g. 111)`);
    }
    if (p.purity !== undefined && !bitmask3(p.purity)) {
      errors.push(`pack "${name}": wallhaven.purity must be 3-bit mask (e.g. 100)`);
    }
    if (p.ttlSec !== undefined && !positiveNumber(p.ttlSec)) {
      errors.push(`pack "${name}": wallhaven.ttlSec must be > 0`);
    }
    break;
  }
  case 'unsplash': {
    const p = pack as UnsplashPackConfig;
    if (!nonEmptyString(p.query)) {
      errors.push(`pack "${name}": unsplash.query is required`);
    }
    if (p.ttlSec !== undefined && !positiveNumber(p.ttlSec)) {
      errors.push(`pack "${name}": unsplash.ttlSec must be > 0`);
    }
    break;
  }
  case 'reddit': {
    const p = pack as RedditPackConfig;
    const hasSubs = Array.isArray(p.subreddits)
      ? p.subreddits.length > 0
      : nonEmptyString(p.subreddits);
    if (!hasSubs) {
      errors.push(`pack "${name}": reddit.subreddits is required`);
    }
    if (p.ttlSec !== undefined && !positiveNumber(p.ttlSec)) {
      errors.push(`pack "${name}": reddit.ttlSec must be > 0`);
    }
    break;
  }
  case 'generic_json': {
    const p = pack as GenericJsonPackConfig;
    if (!nonEmptyString(p.endpoint)) {
      errors.push(`pack "${name}": generic_json.endpoint is required`);
    }
    if (!nonEmptyString(p.imagePath)) {
      errors.push(`pack "${name}": generic_json.imagePath is required`);
    }
    if (p.ttlSec !== undefined && !positiveNumber(p.ttlSec)) {
      errors.push(`pack "${name}": generic_json.ttlSec must be > 0`);
    }
    break;
  }
  case 'static_url': {
    const p = pack as StaticUrlPackConfig;
    const hasUrl = nonEmptyString(p.url);
    const hasUrls = Array.isArray(p.urls) && p.urls.length > 0;
    if (!hasUrl && !hasUrls) {
      errors.push(`pack "${name}": static_url requires url or urls`);
    }
    if (p.count !== undefined && !positiveNumber(p.count)) {
      errors.push(`pack "${name}": static_url.count must be > 0`);
    }
    if (p.ttlSec !== undefined && !positiveNumber(p.ttlSec)) {
      errors.push(`pack "${name}": static_url.ttlSec must be > 0`);
    }
    break;
  }
  default:
    errors.push(`pack "${name}": unsupported type "${(pack as {type?: string}).type ?? 'unknown'}"`);
  }
}

export function validateConfig(config: Config): {ok: boolean; errors: string[]} {
  const errors: string[] = [];

  if (
    typeof config.schemaVersion !== 'number' ||
    !Number.isFinite(config.schemaVersion) ||
    config.schemaVersion !== CONFIG_SCHEMA_VERSION
  ) {
    errors.push(`schemaVersion must be ${CONFIG_SCHEMA_VERSION}`);
  }

  if (config.mode !== 'manual' && config.mode !== 'rotate') {
    errors.push('mode must be manual|rotate');
  }
  if (!positiveNumber(config.rotation_interval_seconds)) {
    errors.push('rotation_interval_seconds must be > 0');
  }
  if (!config.transition || !nonEmptyString(config.transition.type)) {
    errors.push('transition.type is required');
  }
  if (!positiveNumber(config.transition?.fps)) {
    errors.push('transition.fps must be > 0');
  }
  if (!(typeof config.transition?.duration === 'number' && config.transition.duration > 0)) {
    errors.push('transition.duration must be > 0');
  }
  if (!config.cache || !nonEmptyString(config.cache.dir) || !nonEmptyString(config.cache.downloadDir)) {
    errors.push('cache.dir and cache.downloadDir are required');
  }
  if (!positiveNumber(config.cache?.maxMB)) {
    errors.push('cache.maxMB must be > 0');
  }
  if (!positiveNumber(config.cache?.defaultTtlSec)) {
    errors.push('cache.defaultTtlSec must be > 0');
  }
  if (!config.selection || config.selection.perOutputCooldown < 0 || config.selection.globalCooldown < 0) {
    errors.push('selection cooldowns must be >= 0');
  }

  for (const [name, pack] of Object.entries(config.packs ?? {})) {
    validatePack(name, pack, errors);
  }

  return {ok: errors.length === 0, errors};
}

export function assertValidConfig(config: Config): void {
  const result = validateConfig(config);
  if (!result.ok) {
    throw new Error(`Invalid config: ${result.errors.join('; ')}`);
  }
}
