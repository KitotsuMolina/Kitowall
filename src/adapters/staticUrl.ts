// Static URL remote adapter.
import path from 'path';
import fs from 'fs';
import {CacheManager} from '../core/cache';
import {WallpaperCandidate} from '../core/candidates';
import {RemotePackAdapter, RemotePackStatus} from '../core/remotePack';
import {ensureDir} from '../utils/fs';
import {sha256Hex} from '../utils/hash';
import {StaticUrlPackConfig} from '../core/config';
import {appendSystemLog} from '../core/logs';
import {fetchWithRetry} from '../utils/net';

interface IndexFile {
  updatedAt: number;
  candidates: WallpaperCandidate[];
}

export class StaticUrlAdapter implements RemotePackAdapter {
  name: string;
  private readonly packName: string;
  private readonly config: StaticUrlPackConfig;
  private readonly cache: CacheManager;
  private readonly indexPath: string;
  private lastError?: string;

  constructor(packName: string, config: StaticUrlPackConfig, cache: CacheManager) {
    this.name = `static_url:${packName}`;
    this.packName = packName;
    this.config = config;
    this.cache = cache;

    const indexDir = path.join(cache.getDir(), 'indexes');
    ensureDir(indexDir);
    this.indexPath = path.join(indexDir, `${packName}.json`);
  }

  async refreshIndex(): Promise<{count: number}> {
    const url = this.config.url?.trim();
    const urls = (this.config.urls ?? []).map(u => String(u).trim()).filter(Boolean);
    if (!url && urls.length === 0) {
      this.lastError = 'Missing url';
      return {count: 0};
    }

    const list = urls.length > 0 ? urls : [url as string];
    const count = this.config.differentImages ? (this.config.count ?? list.length) : 1;
    const candidates: WallpaperCandidate[] = [];

    let idx = 0;
    for (let i = 0; i < count; i++) {
      const chosen = list[idx % list.length];
      idx++;
      const id = sha256Hex(`${this.packName}:${chosen}:${i}`);
      candidates.push({
        id,
        source: 'static_url',
        url: chosen,
        pageUrl: this.config.postUrl ?? this.config.domain ?? undefined,
        author: this.config.authorName ?? undefined,
        authorUrl: this.config.authorUrl ?? undefined,
        ttlSec: this.config.ttlSec
      });
    }

    const index: IndexFile = {updatedAt: Date.now(), candidates};
    fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
    appendSystemLog({
      level: 'info',
      source: 'static_url',
      pack: this.packName,
      action: 'refresh-complete',
      message: `candidates=${candidates.length}`
    });
    return {count: candidates.length};
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
        source: 'static_url',
        pack: this.packName,
        action: 'hydrate-request',
        url: candidate.url
      });
      const res = await fetchWithRetry(candidate.url);
      appendSystemLog({
        level: res.ok ? 'info' : 'warn',
        source: 'static_url',
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
}
