// Orchestrates pack selection and wallpaper application.
import {
  Config,
  PackConfig,
  isLocalPack,
  isGenericJsonPack,
  isRedditPack,
  isWallhavenPack,
  isUnsplashPack,
  isStaticUrlPack,
  normalizePackName
} from './config';
import {State, saveState, cleanupDisconnectedOutputs, commitSelection} from './state';
import {appendHistory} from './history';
import {detectOutputs} from './outputs';
import {LocalFolderAdapter} from '../adapters/localFolder';
import {applySwww, OutputImageMap} from '../managers/swww';
import {pickImagesForOutputs} from '../adapters/selector';
import {CacheManager} from './cache';
import fs from 'fs';
import path from 'path';
import {expandTilde, listImagesRecursive} from '../utils/fs';
import {GenericJsonAdapter} from '../adapters/genericJson';
import {RedditAdapter} from '../adapters/reddit';
import {WallhavenAdapter} from '../adapters/wallhaven';
import {UnsplashAdapter} from '../adapters/unsplash';
import {StaticUrlAdapter} from '../adapters/staticUrl';

export class Controller {
  private config: Config;
  private state: State;

  constructor(config: Config, state: State) {
    this.config = config;
    this.state = state;
  }

  async getOutputs(): Promise<string[]> {
    const outputs = await detectOutputs();
    return outputs.map(o => o.name);
  }

  choosePack(requested?: string): string {
    const packNames = Object.keys(this.config.packs);
    if (packNames.length === 0) throw new Error('No packs configured');

    if (requested) {
      const normalized = normalizePackName(requested);
      if (!this.config.packs[normalized]) throw new Error(`Pack not found: ${requested}`);
      return normalized;
    }

    const idx = Math.floor(Math.random() * packNames.length);
    return packNames[idx];
  }

  private pickRandomLocalFolderPack(): {name: string; images: string[]} | null {
    const root = expandTilde(this.config.cache.downloadDir);
    if (!fs.existsSync(root)) return null;
    const entries = fs.readdirSync(root, {withFileTypes: true})
      .filter(e => e.isDirectory())
      .map(e => ({name: e.name, fullPath: path.join(root, e.name)}));

    const candidates: Array<{name: string; images: string[]}> = [];
    for (const entry of entries) {
      const images = listImagesRecursive([entry.fullPath]);
      if (images.length > 0) candidates.push({name: entry.name, images});
    }

    if (candidates.length === 0) return null;
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }

  private pickLocalFolderPackByName(requested: string): {name: string; images: string[]} | null {
    const root = expandTilde(this.config.cache.downloadDir);
    if (!fs.existsSync(root)) return null;
    const target = normalizePackName(requested);
    const entries = fs.readdirSync(root, {withFileTypes: true})
      .filter(e => e.isDirectory())
      .map(e => ({name: e.name, fullPath: path.join(root, e.name)}));

    for (const entry of entries) {
      if (normalizePackName(entry.name) !== target) continue;
      const images = listImagesRecursive([entry.fullPath]);
      if (images.length > 0) return {name: entry.name, images};
      return {name: entry.name, images: []};
    }
    return null;
  }

  // Fase 2/3: devolvemos pool + hydrator si es remoto
  private async getPoolForPack(
      packName: string,
      pack: PackConfig
  ): Promise<{pool: string[]; hydrate?: (path: string) => Promise<void>; dedupeKey?: (path: string) => string}> {
    if (isLocalPack(pack)) {
      const adapter = new LocalFolderAdapter({paths: pack.paths});
      return {pool: adapter.getAllImages(), dedupeKey: (p) => p};
    }

    if (isGenericJsonPack(pack)) {
      const cache = new CacheManager(this.config.cache);
      const adapter = new GenericJsonAdapter(packName, pack, cache);
      const candidates = await adapter.listCandidates();
      if (candidates.length === 0) await adapter.refreshIndex();
      const refreshed = await adapter.listCandidates();

      const pool = refreshed.map(c => adapter.localPathFor(c));
      const map = new Map(pool.map((p, i) => [p, refreshed[i]]));
      const hydrate = async (path: string): Promise<void> => {
        const candidate = map.get(path);
        if (candidate) await adapter.hydrate(candidate);
      };
      const dedupeKey = (path: string): string => map.get(path)?.url ?? path;
      return {pool, hydrate, dedupeKey};
    }

    if (isRedditPack(pack)) {
      const cache = new CacheManager(this.config.cache);
      const adapter = new RedditAdapter(packName, pack, cache);
      const candidates = await adapter.listCandidates();
      if (candidates.length === 0) await adapter.refreshIndex();
      const refreshed = await adapter.listCandidates();

      const pool = refreshed.map(c => adapter.localPathFor(c));
      const map = new Map(pool.map((p, i) => [p, refreshed[i]]));
      const hydrate = async (path: string): Promise<void> => {
        const candidate = map.get(path);
        if (candidate) await adapter.hydrate(candidate);
      };
      const dedupeKey = (path: string): string => map.get(path)?.url ?? path;
      return {pool, hydrate, dedupeKey};
    }

    if (isWallhavenPack(pack)) {
      const cache = new CacheManager(this.config.cache);
      const adapter = new WallhavenAdapter(packName, pack, cache);
      const candidates = await adapter.listCandidates();
      if (candidates.length === 0) await adapter.refreshIndex();
      const refreshed = await adapter.listCandidates();

      const pool = refreshed.map(c => adapter.localPathFor(c));
      const map = new Map(pool.map((p, i) => [p, refreshed[i]]));
      const hydrate = async (path: string): Promise<void> => {
        const candidate = map.get(path);
        if (candidate) await adapter.hydrate(candidate);
      };
      const dedupeKey = (path: string): string => map.get(path)?.url ?? path;
      return {pool, hydrate, dedupeKey};
    }

    if (isUnsplashPack(pack)) {
      const cache = new CacheManager(this.config.cache);
      const adapter = new UnsplashAdapter(packName, pack, cache);
      const candidates = await adapter.listCandidates();
      if (candidates.length === 0) await adapter.refreshIndex();
      const refreshed = await adapter.listCandidates();

      const pool = refreshed.map(c => adapter.localPathFor(c));
      const map = new Map(pool.map((p, i) => [p, refreshed[i]]));
      const hydrate = async (path: string): Promise<void> => {
        const candidate = map.get(path);
        if (candidate) await adapter.hydrate(candidate);
      };
      const dedupeKey = (path: string): string => map.get(path)?.url ?? path;
      return {pool, hydrate, dedupeKey};
    }

    if (isStaticUrlPack(pack)) {
      const cache = new CacheManager(this.config.cache);
      const adapter = new StaticUrlAdapter(packName, pack, cache);
      const candidates = await adapter.listCandidates();
      if (candidates.length === 0) await adapter.refreshIndex();
      const refreshed = await adapter.listCandidates();

      const pool = refreshed.map(c => adapter.localPathFor(c));
      const map = new Map(pool.map((p, i) => [p, refreshed[i]]));
      const hydrate = async (path: string): Promise<void> => {
        const candidate = map.get(path);
        if (candidate) await adapter.hydrate(candidate);
      };
      const dedupeKey = (path: string): string => map.get(path)?.url ?? path;
      return {pool, hydrate, dedupeKey};
    }

    throw new Error(`Pack type not implemented: ${pack.type}`);
  }

  private async getPoolForPool(): Promise<{pool: string[]; hydrate?: (path: string) => Promise<void>; stats: Record<string, number>}> {
    if (!this.config.pool?.enabled || !this.config.pool.sources.length) {
      throw new Error('Pool is not enabled or has no sources');
    }

    const combined: string[] = [];
    const hydrateMap = new Map<string, (path: string) => Promise<void>>();
    const seenHash = new Set<string>();
    const stats: Record<string, number> = {};
    const dedupeMode = this.config.pool?.dedupe ?? 'path';

    for (const src of this.config.pool.sources) {
      if (src.name === 'pool') continue;
      const pack = this.config.packs[src.name];
      if (!pack) continue;

      const {pool, hydrate, dedupeKey} = await this.getPoolForPack(src.name, pack);
      const weight = Math.max(1, Math.floor(src.weight ?? 1));
      const limit = src.maxCandidates ?? pool.length;

      let sourceFailed = false;
      if (pool.length === 0) sourceFailed = true;
      let count = 0;
      for (const p of pool) {
        if (count >= limit) break;
        const keyBase = dedupeMode === 'url' ? (dedupeKey ? dedupeKey(p) : p) : p;
        const key = dedupeMode === 'hash' ? this.hashPath(keyBase) : keyBase;
        if (!seenHash.has(key)) {
          for (let i = 0; i < weight; i++) {
            combined.push(p);
          }
          seenHash.add(key);
        }
        if (hydrate && !hydrateMap.has(p)) {
          hydrateMap.set(p, hydrate);
        }
        sourceFailed = false;
        count++;
      }
      stats[src.name] = sourceFailed ? 0 : pool.length;
    }

    const hydrate = hydrateMap.size
      ? async (path: string): Promise<void> => {
        const fn = hydrateMap.get(path);
        if (fn) await fn(path);
      }
      : undefined;

    return {pool: combined, hydrate, stats};
  }

  async poolStats(refresh: boolean = false): Promise<Record<string, number>> {
    if (!this.config.pool?.enabled || !this.config.pool.sources.length) {
      return {};
    }
    if (!refresh) {
      const {stats} = await this.getPoolForPool();
      return stats;
    }

    const stats: Record<string, number> = {};
    for (const src of this.config.pool.sources) {
      const pack = this.config.packs[src.name];
      if (!pack) {
        stats[src.name] = 0;
        continue;
      }
      if (isLocalPack(pack)) {
        const adapter = new LocalFolderAdapter({paths: pack.paths});
        stats[src.name] = adapter.getAllImages().length;
        continue;
      }
      const cache = new CacheManager(this.config.cache);
      let refreshed = false;
      if (isGenericJsonPack(pack)) {
        const adapter = new GenericJsonAdapter(src.name, pack, cache);
        await adapter.refreshIndex();
        const candidates = await adapter.listCandidates();
        stats[src.name] = candidates.length;
        refreshed = true;
      } else if (isRedditPack(pack)) {
        const adapter = new RedditAdapter(src.name, pack, cache);
        await adapter.refreshIndex();
        const candidates = await adapter.listCandidates();
        stats[src.name] = candidates.length;
        refreshed = true;
      } else if (isWallhavenPack(pack)) {
        const adapter = new WallhavenAdapter(src.name, pack, cache);
        await adapter.refreshIndex();
        const candidates = await adapter.listCandidates();
        stats[src.name] = candidates.length;
        refreshed = true;
      } else if (isUnsplashPack(pack)) {
        const adapter = new UnsplashAdapter(src.name, pack, cache);
        await adapter.refreshIndex();
        const candidates = await adapter.listCandidates();
        stats[src.name] = candidates.length;
        refreshed = true;
      } else if (isStaticUrlPack(pack)) {
        const adapter = new StaticUrlAdapter(src.name, pack, cache);
        await adapter.refreshIndex();
        const candidates = await adapter.listCandidates();
        stats[src.name] = candidates.length;
        refreshed = true;
      }
      if (!refreshed) stats[src.name] = 0;
    }
    return stats;
  }

  private hashPath(pathStr: string): string {
    // Hash file content if present, otherwise fallback to string hash.
    try {
      const fs = require('fs') as typeof import('fs');
      if (fs.existsSync(pathStr)) {
        const data = fs.readFileSync(pathStr);
        const crypto = require('crypto') as typeof import('crypto');
        return crypto.createHash('sha256').update(data).digest('hex');
      }
    } catch {
      // ignore and fallback
    }
    let hash = 0;
    for (let i = 0; i < pathStr.length; i++) {
      hash = ((hash << 5) - hash) + pathStr.charCodeAt(i);
      hash |= 0;
    }
    return String(hash);
  }

  async applyNext(
      requestedPack?: string,
      namespace: string = 'kitowall'
  ): Promise<{pack: string; outputs: string[]; images: OutputImageMap[]}> {
    const outputs = await this.getOutputs();
    if (outputs.length === 0) throw new Error('No outputs detected');

    cleanupDisconnectedOutputs(this.state, outputs);

    let packName: string;
    let poolResult: {pool: string[]; hydrate?: (path: string) => Promise<void>};

    if (requestedPack) {
      const folderPack = this.pickLocalFolderPackByName(requestedPack);
      if (folderPack) {
        packName = folderPack.name;
        poolResult = {pool: folderPack.images};
      } else {
        packName = this.choosePack(requestedPack);
        const pack = this.config.packs[packName];
        poolResult = packName === 'pool'
          ? await this.getPoolForPool()
          : await this.getPoolForPack(packName, pack);
      }
    } else {
      const auto = this.pickRandomLocalFolderPack();
      if (auto) {
        packName = auto.name;
        poolResult = {pool: auto.images};
      } else {
        packName = this.choosePack(requestedPack);
        const pack = this.config.packs[packName];
        poolResult = packName === 'pool'
          ? await this.getPoolForPool()
          : await this.getPoolForPack(packName, pack);
      }
    }
    const {pool, hydrate} = poolResult;
    if (pool.length === 0) throw new Error(`No images found for pack: ${packName}`);

    // Selección inteligente por output (N outputs)
    const picks = pickImagesForOutputs(outputs, pool, this.config, this.state);
    if (picks.length === 0) {
      throw new Error(`No images could be selected for outputs (pack: ${packName})`);
    }

    const outputImages: OutputImageMap[] = picks.map(p => ({
      output: p.output,
      path: p.path
    }));

    if (hydrate) {
      for (const item of outputImages) {
        await hydrate(item.path);
      }
    }

    await applySwww(outputImages, this.config.transition, namespace);

    const now = Date.now();

    // Commit State B (recents + last_set + anti-growth)
    for (const item of outputImages) {
      commitSelection(this.state, item.output, item.path, now);
    }

    // Estado actual
    this.state.current_pack = packName;
    // last_outputs ya lo setea cleanupDisconnectedOutputs()
    // last_set y last_updated ya se actualizaron en commitSelection()

    saveState(this.state);

    appendHistory(
        outputImages.map(item => ({
          timestamp: now,
          pack: packName,
          output: item.output,
          path: item.path
        }))
    );

    return {pack: packName, outputs, images: outputImages};
  }
}
