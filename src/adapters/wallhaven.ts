// Wallhaven remote adapter.
import path from 'path';
import fs from 'fs';
import {CacheManager} from '../core/cache';
import {WallpaperCandidate} from '../core/candidates';
import {RemotePackAdapter, RemotePackStatus} from '../core/remotePack';
import {ensureDir} from '../utils/fs';
import {sha256Hex} from '../utils/hash';
import {WallhavenPackConfig, resolveApiKey} from '../core/config';
import {appendSystemLog} from '../core/logs';
import {fetchWithRetry} from '../utils/net';

interface WallhavenResponse {
  data: Array<{
    id: string;
    path: string;
    url: string;
    purity?: string;
    resolution?: string;
  }>;
}

interface IndexFile {
  updatedAt: number;
  configHash?: string;
  candidates: WallpaperCandidate[];
}

export class WallhavenAdapter implements RemotePackAdapter {
  name: string;
  private readonly packName: string;
  private readonly config: WallhavenPackConfig;
  private readonly cache: CacheManager;
  private readonly indexPath: string;
  private lastError?: string;

  constructor(packName: string, config: WallhavenPackConfig, cache: CacheManager) {
    this.name = `wallhaven:${packName}`;
    this.packName = packName;
    this.config = config;
    this.cache = cache;

    const indexDir = path.join(cache.getDir(), 'indexes');
    ensureDir(indexDir);
    this.indexPath = path.join(indexDir, `${packName}.json`);
  }

  async refreshIndex(): Promise<{count: number}> {
    const key = resolveApiKey(this.config.apiKey, this.config.apiKeyEnv);
    if (!key) {
      this.lastError = 'Missing API key';
      return {count: 0};
    }

    try {
      const queries = this.buildQueries();
      const candidates: WallpaperCandidate[] = [];
      const seen = new Set<string>();

      for (const q of queries) {
        const url = this.buildSearchUrl(q);
        appendSystemLog({
          level: 'info',
          source: 'wallhaven',
          pack: this.packName,
          action: 'refresh-request',
          url,
          meta: {query: q}
        });
        const res = await fetchWithRetry(url, {
          headers: { 'X-API-Key': key, 'User-Agent': 'hyprwall/0.1' }
        });
        appendSystemLog({
          level: res.ok ? 'info' : 'warn',
          source: 'wallhaven',
          pack: this.packName,
          action: 'refresh-response',
          url,
          status: res.status
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as WallhavenResponse;

        for (const item of json.data ?? []) {
          if (!item.path) continue;
          if (seen.has(item.path)) continue;
          seen.add(item.path);
          const id = sha256Hex(`${this.packName}:${item.path}`);
          candidates.push({
            id,
            source: 'wallhaven',
            url: item.path,
            pageUrl: item.url,
            rating: this.mapPurity(item.purity),
            remoteId: item.id,
            width: this.parseResolution(item.resolution)?.w,
            height: this.parseResolution(item.resolution)?.h,
            ttlSec: this.config.ttlSec
          });
        }
      }

      const index: IndexFile = {updatedAt: Date.now(), candidates};
      index.configHash = this.currentConfigHash();
      fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
      appendSystemLog({
        level: 'info',
        source: 'wallhaven',
        pack: this.packName,
        action: 'refresh-complete',
        message: `candidates=${candidates.length}`
      });
      return {count: candidates.length};
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      appendSystemLog({
        level: 'error',
        source: 'wallhaven',
        pack: this.packName,
        action: 'refresh-error',
        message: this.lastError
      });
      return {count: 0};
    }
  }

  async listCandidates(): Promise<WallpaperCandidate[]> {
    if (!fs.existsSync(this.indexPath)) return [];
    const raw = fs.readFileSync(this.indexPath, 'utf8');
    const parsed = JSON.parse(raw) as IndexFile;
    const cfgHash = this.currentConfigHash();
    if ((parsed.configHash ?? '') !== cfgHash) {
      appendSystemLog({
        level: 'info',
        source: 'wallhaven',
        pack: this.packName,
        action: 'index-invalidated',
        message: 'wallhaven filter config changed; forcing refresh'
      });
      return [];
    }
    return parsed.candidates ?? [];
  }

  async hydrate(candidate: WallpaperCandidate): Promise<{localPath: string}> {
    const localPath = this.localPathFor(candidate);
    if (!fs.existsSync(localPath)) {
      ensureDir(path.dirname(localPath));
      appendSystemLog({
        level: 'info',
        source: 'wallhaven',
        pack: this.packName,
        action: 'hydrate-request',
        url: candidate.url
      });
      const res = await fetchWithRetry(candidate.url);
      appendSystemLog({
        level: res.ok ? 'info' : 'warn',
        source: 'wallhaven',
        pack: this.packName,
        action: 'hydrate-response',
        url: candidate.url,
        status: res.status
      });
      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      this.cache.addEntry({
        key: candidate.id,
        localPath,
        sizeBytes: buffer.length,
        addedAt: Date.now(),
        ttlSec: candidate.ttlSec
      });
    }
    return {localPath};
  }

  async status(): Promise<RemotePackStatus> {
    let lastRefresh: number | undefined;
    let cacheItems: number | undefined;
    let cacheBytes: number | undefined;

    if (fs.existsSync(this.indexPath)) {
      const raw = fs.readFileSync(this.indexPath, 'utf8');
      const parsed = JSON.parse(raw) as IndexFile;
      lastRefresh = parsed.updatedAt;
    }

    const index = this.cache.loadIndex();
    const entries = index.entries.filter(e => e.localPath.includes(this.packName));
    cacheItems = entries.length;
    cacheBytes = entries.reduce((s, e) => s + e.sizeBytes, 0);

    return {
      ok: !this.lastError,
      lastRefresh,
      cacheItems,
      cacheBytes,
      lastError: this.lastError
    };
  }

  localPathFor(candidate: WallpaperCandidate): string {
    const ext = path.extname(candidate.url.split('?')[0]) || '.jpg';
    const base = sha256Hex(candidate.id);
    return path.join(this.cache.getDownloadDir(), this.packName, `${base}${ext}`);
  }

  private buildSearchUrl(query?: string): string {
    const params = new URLSearchParams();

    if (query) params.set('q', query);
    if (this.config.categories) params.set('categories', this.config.categories);
    if (this.config.purity) params.set('purity', this.config.purity);
    if (this.config.sorting) params.set('sorting', this.config.sorting);
    if (this.config.atleast) params.set('atleast', this.config.atleast);
    if (this.config.colors) params.set('colors', this.config.colors);
    if (this.config.ratios && this.config.ratios.length > 0) {
      params.set('ratios', this.config.ratios.join(','));
    }

    if (this.config.aiArt === true) {
      params.set('ai_art_filter', '0');
    } else if (this.config.aiArt === false) {
      params.set('ai_art_filter', '1');
    }

    return `https://wallhaven.cc/api/v1/search?${params.toString()}`;
  }

  private buildQueries(): string[] {
    const base = this.config.keyword?.trim() ?? '';
    const subs = (this.config.subthemes ?? []).map(s => s.trim()).filter(Boolean);
    const queries: string[] = [];
    if (base) queries.push(base);
    for (const sub of subs) {
      if (base) queries.push(`${base} ${sub}`);
      else queries.push(sub);
    }
    if (queries.length === 0) queries.push('');
    return queries;
  }

  private mapPurity(purity?: string): 'safe' | 'sketchy' | 'nsfw' | undefined {
    if (!purity) return undefined;
    // purity string is like "100" (SFW only) or "110" etc.
    if (purity[0] === '1' && purity[1] === '0' && purity[2] === '0') return 'safe';
    if (purity[1] === '1') return 'sketchy';
    if (purity[2] === '1') return 'nsfw';
    return undefined;
  }

  private parseResolution(res?: string): {w: number; h: number} | undefined {
    if (!res) return undefined;
    const parts = res.split('x');
    if (parts.length !== 2) return undefined;
    const w = Number(parts[0]);
    const h = Number(parts[1]);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return undefined;
    return {w, h};
  }

  private currentConfigHash(): string {
    const payload = {
      keyword: this.config.keyword ?? '',
      subthemes: this.config.subthemes ?? [],
      categories: this.config.categories ?? '',
      purity: this.config.purity ?? '',
      ratios: this.config.ratios ?? [],
      colors: this.config.colors ?? '',
      atleast: this.config.atleast ?? '',
      sorting: this.config.sorting ?? '',
      aiArt: this.config.aiArt ?? null
    };
    return sha256Hex(JSON.stringify(payload));
  }
}
