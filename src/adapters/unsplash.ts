// Unsplash remote adapter.
import path from 'path';
import fs from 'fs';
import {CacheManager} from '../core/cache';
import {WallpaperCandidate} from '../core/candidates';
import {RemotePackAdapter, RemotePackStatus} from '../core/remotePack';
import {ensureDir} from '../utils/fs';
import {sha256Hex} from '../utils/hash';
import {UnsplashPackConfig, resolveApiKey} from '../core/config';
import {appendSystemLog} from '../core/logs';
import {fetchWithRetry} from '../utils/net';

interface UnsplashResponse {
  urls: { raw: string };
  links: { html: string };
  user: { name: string; links: { html: string } };
}

interface IndexFile {
  updatedAt: number;
  candidates: WallpaperCandidate[];
}

export class UnsplashAdapter implements RemotePackAdapter {
  name: string;
  private readonly packName: string;
  private readonly config: UnsplashPackConfig;
  private readonly cache: CacheManager;
  private readonly indexPath: string;
  private lastError?: string;

  constructor(packName: string, config: UnsplashPackConfig, cache: CacheManager) {
    this.name = `unsplash:${packName}`;
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
        const url = this.buildRandomUrl(key, q);
        appendSystemLog({
          level: 'info',
          source: 'unsplash',
          pack: this.packName,
          action: 'refresh-request',
          url,
          meta: {query: q}
        });
        const res = await fetchWithRetry(url, {
          headers: { 'User-Agent': 'Kitowall/0.1' }
        });
        appendSystemLog({
          level: res.ok ? 'info' : 'warn',
          source: 'unsplash',
          pack: this.packName,
          action: 'refresh-response',
          url,
          status: res.status
        });
        const payload = (await res.json()) as UnsplashResponse | UnsplashResponse[];
        const json = Array.isArray(payload) ? payload : [payload];

        for (const item of json) {
          if (!item?.urls?.raw) continue;
          const imageUrl = this.buildImageUrl(item.urls.raw);
          if (seen.has(imageUrl)) continue;
          seen.add(imageUrl);
          const id = sha256Hex(`${this.packName}:${imageUrl}`);
          candidates.push({
            id,
            source: 'unsplash',
            url: imageUrl,
            previewUrl: imageUrl,
            pageUrl: item.links?.html,
            author: item.user?.name,
            authorUrl: item.user?.links?.html,
            ttlSec: this.config.ttlSec
          });
        }
      }

      const index: IndexFile = {updatedAt: Date.now(), candidates};
      fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
      appendSystemLog({
        level: 'info',
        source: 'unsplash',
        pack: this.packName,
        action: 'refresh-complete',
        message: `candidates=${candidates.length}`
      });
      return {count: candidates.length};
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      appendSystemLog({
        level: 'error',
        source: 'unsplash',
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
    return parsed.candidates ?? [];
  }

  async hydrate(candidate: WallpaperCandidate): Promise<{localPath: string}> {
    const localPath = this.localPathFor(candidate);
    if (!fs.existsSync(localPath)) {
      ensureDir(path.dirname(localPath));
      appendSystemLog({
        level: 'info',
        source: 'unsplash',
        pack: this.packName,
        action: 'hydrate-request',
        url: candidate.url
      });
      const res = await fetchWithRetry(candidate.url);
      appendSystemLog({
        level: res.ok ? 'info' : 'warn',
        source: 'unsplash',
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

  private buildImageUrl(rawUrl: string): string {
    const width = this.config.imageWidth;
    const height = this.config.imageHeight;
    const fit = this.config.imageFit;
    const quality = this.config.imageQuality;

    if (!width && !height && !fit && !quality) return rawUrl;

    const url = new URL(rawUrl);
    if (width) url.searchParams.set('w', String(width));
    if (height) url.searchParams.set('h', String(height));
    if (fit) url.searchParams.set('fit', fit);
    if (quality) url.searchParams.set('q', String(quality));
    return url.toString();
  }

  private buildRandomUrl(apiKey: string, query?: string): string {
    const params = new URLSearchParams();
    params.set('count', '1');
    params.set('client_id', apiKey);

    if (query) params.set('query', query);
    if (this.config.collections) params.set('collections', this.config.collections);
    if (this.config.topics) params.set('topics', this.config.topics);
    if (this.config.username) params.set('username', this.config.username);
    if (this.config.orientation) params.set('orientation', this.config.orientation);
    if (this.config.contentFilter) params.set('content_filter', this.config.contentFilter);

    return `https://api.unsplash.com/photos/random?${params.toString()}`;
  }

  private buildQueries(): string[] {
    const base = this.config.query?.trim() ?? '';
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

}
