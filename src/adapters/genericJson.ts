// Generic JSON remote adapter.
import path from 'path';
import fs from 'fs';
import {GenericJsonPackConfig} from '../core/config';
import {CacheManager} from '../core/cache';
import {WallpaperCandidate} from '../core/candidates';
import {RemotePackAdapter, RemotePackStatus} from '../core/remotePack';
import {ensureDir} from '../utils/fs';
import {sha256Hex} from '../utils/hash';
import {getTarget, replaceRandomInPath} from '../utils/jsonPath';
import {appendSystemLog} from '../core/logs';
import {fetchWithRetry} from '../utils/net';

interface IndexFile {
  updatedAt: number;
  candidates: WallpaperCandidate[];
}

export class GenericJsonAdapter implements RemotePackAdapter {
  name: string;
  private readonly packName: string;
  private readonly config: GenericJsonPackConfig;
  private readonly cache: CacheManager;
  private readonly indexPath: string;
  private lastError?: string;

  constructor(packName: string, config: GenericJsonPackConfig, cache: CacheManager) {
    this.name = `generic_json:${packName}`;
    this.packName = packName;
    this.config = config;
    this.cache = cache;

    const cacheDir = cache.getDir();
    const indexDir = path.join(cacheDir, 'indexes');
    ensureDir(indexDir);
    this.indexPath = path.join(indexDir, `${packName}.json`);
  }

  async refreshIndex(opts?: {force?: boolean}): Promise<{count: number}> {
    const endpoint = this.config.endpoint;
    const imagePath = this.config.imagePath;

    if (!endpoint || !imagePath) {
      this.lastError = 'Missing endpoint or imagePath';
      return {count: 0};
    }

    try {
      appendSystemLog({
        level: 'info',
        source: 'generic_json',
        pack: this.packName,
        action: 'refresh-request',
        url: endpoint
      });
      const res = await fetchWithRetry(endpoint);
      appendSystemLog({
        level: res.ok ? 'info' : 'warn',
        source: 'generic_json',
        pack: this.packName,
        action: 'refresh-response',
        url: endpoint,
        status: res.status
      });
      const json = await res.json();

      const [target, resolvedPath] = getTarget(json, imagePath);

      const candidates: WallpaperCandidate[] = [];
      const max = this.config.candidateLimit ?? 50;

      // If imagePath uses @random and we want multiple candidates,
      // rerun JSONPath to collect distinct items.
      if (imagePath.includes('@random') && max > 1) {
        const seen = new Set<string>();
        for (let i = 0; i < max; i++) {
          const [t, r] = getTarget(json, imagePath);
          if (typeof t !== 'string' && typeof t !== 'number') continue;
          const imageDownloadUrl = (this.config.imagePrefix ?? '') + String(t);
          if (seen.has(imageDownloadUrl)) continue;
          seen.add(imageDownloadUrl);
          candidates.push(this.buildCandidate(imageDownloadUrl, r, json));
        }
      } else if (Array.isArray(target)) {
        for (const item of target) {
          if (typeof item !== 'string' && typeof item !== 'number') continue;
          const imageDownloadUrl = (this.config.imagePrefix ?? '') + String(item);
          candidates.push(this.buildCandidate(imageDownloadUrl, resolvedPath, json));
          if (candidates.length >= max) break;
        }
      } else if (typeof target === 'string' || typeof target === 'number') {
        const imageDownloadUrl = (this.config.imagePrefix ?? '') + String(target);
        candidates.push(this.buildCandidate(imageDownloadUrl, resolvedPath, json));
      }

      const index: IndexFile = {updatedAt: Date.now(), candidates};
      ensureDir(path.dirname(this.indexPath));
      fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
      appendSystemLog({
        level: 'info',
        source: 'generic_json',
        pack: this.packName,
        action: 'refresh-complete',
        message: `candidates=${candidates.length}`
      });
      return {count: candidates.length};
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      appendSystemLog({
        level: 'error',
        source: 'generic_json',
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
        source: 'generic_json',
        pack: this.packName,
        action: 'hydrate-request',
        url: candidate.url
      });
      const res = await fetchWithRetry(candidate.url);
      appendSystemLog({
        level: res.ok ? 'info' : 'warn',
        source: 'generic_json',
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
    const cacheDir = this.cache.getDir();
    const ext = path.extname(candidate.url.split('?')[0]) || '.jpg';
    const base = sha256Hex(candidate.id);
    return path.join(this.cache.getDownloadDir(), this.packName, `${base}${ext}`);
  }

  private buildCandidate(imageUrl: string, resolvedPath: string, json: unknown): WallpaperCandidate {
    const postPath = this.config.postPath ?? '';
    const authorNamePath = this.config.authorNamePath ?? '';
    const authorUrlPath = this.config.authorUrlPath ?? '';

    let postUrl = '';
    if (postPath) {
      const postObj = getTarget(json, replaceRandomInPath(postPath, resolvedPath))[0];
      if (typeof postObj === 'string' || typeof postObj === 'number')
        postUrl = (this.config.postPrefix ?? '') + String(postObj);
    }

    let authorName: string | undefined;
    if (authorNamePath) {
      const authorObj = getTarget(json, replaceRandomInPath(authorNamePath, resolvedPath))[0];
      if (typeof authorObj === 'string' && authorObj !== '')
        authorName = authorObj;
    }

    let authorUrl = '';
    if (authorUrlPath) {
      const authorUrlObj = getTarget(json, replaceRandomInPath(authorUrlPath, resolvedPath))[0];
      if (typeof authorUrlObj === 'string' || typeof authorUrlObj === 'number')
        authorUrl = (this.config.authorUrlPrefix ?? '') + String(authorUrlObj);
    }

    const id = sha256Hex(`${this.packName}:${imageUrl}`);

    return {
      id,
      source: 'generic_json',
      url: imageUrl,
      pageUrl: postUrl || undefined,
      author: authorName,
      authorUrl: authorUrl || undefined,
      previewUrl: undefined,
      ttlSec: this.config.ttlSec,
      tags: undefined,
      rating: undefined,
      score: undefined,
      remoteId: undefined,
      mime: undefined,
      fileExtHint: undefined,
      width: undefined,
      height: undefined
    };
  }
}
