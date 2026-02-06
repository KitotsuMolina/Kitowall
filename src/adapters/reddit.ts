// Reddit remote adapter.
import path from 'path';
import fs from 'fs';
import {RedditPackConfig} from '../core/config';
import {CacheManager} from '../core/cache';
import {WallpaperCandidate} from '../core/candidates';
import {RemotePackAdapter, RemotePackStatus} from '../core/remotePack';
import {ensureDir} from '../utils/fs';
import {sha256Hex} from '../utils/hash';
import {appendSystemLog} from '../core/logs';

interface RedditResponse {
  data: {
    children: RedditSubmission[];
  };
}

interface RedditSubmission {
  data: {
    post_hint?: string;
    over_18?: boolean;
    subreddit_name_prefixed?: string;
    permalink?: string;
    title?: string;
    ups?: number;
    url?: string;
    preview?: {
      images: {
        source: {
          width: number;
          height: number;
          url: string;
        };
      }[];
    };
  };
}

interface IndexFile {
  updatedAt: number;
  candidates: WallpaperCandidate[];
}

export class RedditAdapter implements RemotePackAdapter {
  name: string;
  private readonly packName: string;
  private readonly config: RedditPackConfig;
  private readonly cache: CacheManager;
  private readonly indexPath: string;
  private lastError?: string;

  constructor(packName: string, config: RedditPackConfig, cache: CacheManager) {
    this.name = `reddit:${packName}`;
    this.packName = packName;
    this.config = config;
    this.cache = cache;

    const indexDir = path.join(cache.getDir(), 'indexes');
    ensureDir(indexDir);
    this.indexPath = path.join(indexDir, `${packName}.json`);
  }

  async refreshIndex(): Promise<{count: number}> {
    try {
      const subs = this.normalizeSubreddits(this.config.subreddits);
      if (subs.length === 0) {
        this.lastError = 'Missing subreddits';
        return {count: 0};
      }

      const queries = this.buildQueries();
      const candidates: WallpaperCandidate[] = [];
      const seen = new Set<string>();

      for (const q of queries) {
        const base = `/r/${subs.join('+')}/search.json?q=${encodeURIComponent(q)}&restrict_sr=1`;
        const urls = [
          `https://www.reddit.com${base}`,
          `https://old.reddit.com${base}`
        ];
        const json = await this.fetchWithFallback(urls);

        for (const child of json.data.children) {
          const data = child.data;
          if (data.post_hint !== 'image') continue;
          if (this.config.allowSfw && data.over_18) continue;

          const image = data.preview?.images?.[0]?.source;
          if (!image) continue;

          if (!this.passesResolution(image.width, image.height)) continue;
          if (!this.passesRatio(image.width, image.height)) continue;

          const imageUrl = this.ampDecode(image.url);
          if (seen.has(imageUrl)) continue;
          seen.add(imageUrl);
          const id = sha256Hex(`${this.packName}:${imageUrl}`);

          candidates.push({
            id,
            source: 'reddit',
            url: imageUrl,
            previewUrl: imageUrl,
            pageUrl: data.permalink ? `https://www.reddit.com${data.permalink}` : undefined,
            author: undefined,
            authorUrl: undefined,
            tags: undefined,
            rating: data.over_18 ? 'nsfw' : 'safe',
            score: data.ups,
            width: image.width,
            height: image.height,
            ttlSec: this.config.ttlSec
          });
        }
      }

      const index: IndexFile = {updatedAt: Date.now(), candidates};
      fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
      appendSystemLog({
        level: 'info',
        source: 'reddit',
        pack: this.packName,
        action: 'refresh-complete',
        message: `candidates=${candidates.length}`
      });
      return {count: candidates.length};
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      appendSystemLog({
        level: 'error',
        source: 'reddit',
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
        source: 'reddit',
        pack: this.packName,
        action: 'hydrate-request',
        url: candidate.url
      });
      const res = await fetch(candidate.url);
      appendSystemLog({
        level: res.ok ? 'info' : 'warn',
        source: 'reddit',
        pack: this.packName,
        action: 'hydrate-response',
        url: candidate.url,
        status: res.status
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

  private normalizeSubreddits(input?: string | string[]): string[] {
    if (!input) return [];
    if (Array.isArray(input)) return input.map(s => s.trim()).filter(Boolean);
    return String(input)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  private buildQueries(): string[] {
    const base = this.packName;
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

  private passesResolution(width: number, height: number): boolean {
    const minW = this.config.minWidth ?? 0;
    const minH = this.config.minHeight ?? 0;
    if (width < minW) return false;
    if (height < minH) return false;
    return true;
  }

  private passesRatio(width: number, height: number): boolean {
    const ratioW = this.config.ratioW ?? 0;
    const ratioH = this.config.ratioH ?? 0;
    if (ratioW <= 0 || ratioH <= 0) return true;
    return width / ratioW * ratioH >= height;
  }

  private ampDecode(input: string): string {
    return input.replace(/&amp;/g, '&');
  }

  private async fetchWithFallback(urls: string[]): Promise<RedditResponse> {
    let lastStatus: number | undefined;
    let lastErr: string | undefined;
    for (const url of urls) {
      try {
        appendSystemLog({
          level: 'info',
          source: 'reddit',
          pack: this.packName,
          action: 'refresh-request',
          url
        });
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'hyprwall/0.1 (wallpaper CLI)',
            'Accept': 'application/json',
            'Accept-Language': 'en-US,en;q=0.8'
          }
        });
        appendSystemLog({
          level: res.ok ? 'info' : 'warn',
          source: 'reddit',
          pack: this.packName,
          action: 'refresh-response',
          url,
          status: res.status
        });
        if (!res.ok) {
          lastStatus = res.status;
          lastErr = `HTTP ${res.status}`;
          // Solo intenta fallback ante 403/429
          if (res.status === 403 || res.status === 429) continue;
          throw new Error(`HTTP ${res.status}`);
        }
        return (await res.json()) as RedditResponse;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
    }
    if (lastStatus) throw new Error(`HTTP ${lastStatus}`);
    throw new Error(lastErr ?? 'Reddit fetch failed');
  }
}
