// Cache manager with TTL, size pruning, and favorites protection.
import path from 'path';
import fs from 'fs';
import {ensureDir, expandTilde, readJson, writeJson} from '../utils/fs';
import {listFavorites} from './favorites';

export interface CacheEntry {
  key: string;
  localPath: string;
  sizeBytes: number;
  addedAt: number;
  ttlSec: number;
}

export interface CacheIndex {
  entries: CacheEntry[];
}

export interface CacheConfig {
  dir: string;
  downloadDir: string;
  maxMB: number;
  defaultTtlSec: number;
}

export class CacheManager {
  private readonly dir: string;
  private readonly downloadDir: string;
  private readonly indexPath: string;
  private readonly maxBytes: number;
  private readonly defaultTtlSec: number;

  constructor(config: CacheConfig) {
    this.dir = expandTilde(config.dir);
    this.downloadDir = expandTilde(config.downloadDir);
    this.indexPath = path.join(this.dir, 'index.json');
    this.maxBytes = config.maxMB * 1024 * 1024;
    this.defaultTtlSec = config.defaultTtlSec;
    ensureDir(this.dir);
    ensureDir(this.downloadDir);
  }

  getDir(): string {
    return this.dir;
  }

  getDownloadDir(): string {
    return this.downloadDir;
  }

  loadIndex(): CacheIndex {
    return readJson<CacheIndex>(this.indexPath, {entries: []});
  }

  saveIndex(index: CacheIndex): void {
    writeJson(this.indexPath, index);
  }

  addEntry(entry: Omit<CacheEntry, 'ttlSec'> & {ttlSec?: number}): void {
    const index = this.loadIndex();
    const ttlSec = entry.ttlSec ?? this.defaultTtlSec;
    const existing = index.entries.find(e => e.key === entry.key);
    if (existing) {
      existing.localPath = entry.localPath;
      existing.sizeBytes = entry.sizeBytes;
      existing.addedAt = entry.addedAt;
      existing.ttlSec = ttlSec;
    } else {
      index.entries.push({...entry, ttlSec});
    }
    this.saveIndex(index);
  }

  prune(): {removed: number; remaining: number} {
    const favorites = new Set(listFavorites());
    const index = this.loadIndex();
    const now = Date.now();

    // Remove expired entries (unless favorite)
    const kept: CacheEntry[] = [];
    let removed = 0;

    for (const entry of index.entries) {
      const expired = now - entry.addedAt > entry.ttlSec * 1000;
      const isFavorite = favorites.has(entry.localPath);
      if (expired && !isFavorite) {
        if (fs.existsSync(entry.localPath)) {
          try { fs.unlinkSync(entry.localPath); } catch { /* ignore */ }
        }
        removed++;
      } else {
        kept.push(entry);
      }
    }

    // Enforce size limit (LRU by addedAt) while respecting favorites
    const totalSize = (entries: CacheEntry[]) => entries.reduce((sum, e) => sum + e.sizeBytes, 0);
    let current = kept.sort((a, b) => a.addedAt - b.addedAt);
    while (current.length > 0 && totalSize(current) > this.maxBytes) {
      const candidate = current[0];
      const isFavorite = favorites.has(candidate.localPath);
      if (isFavorite) {
        // Skip favorite, move to end and continue
        current = current.slice(1).concat(candidate);
        // If all are favorites and still too large, break to avoid infinite loop
        const allFavorites = current.every(e => favorites.has(e.localPath));
        if (allFavorites) break;
        continue;
      }
      if (fs.existsSync(candidate.localPath)) {
        try { fs.unlinkSync(candidate.localPath); } catch { /* ignore */ }
      }
      current = current.slice(1);
      removed++;
    }

    this.saveIndex({entries: current});
    return {removed, remaining: current.length};
  }

  prunePack(packName: string): {removed: number; remaining: number} {
    const favorites = new Set(listFavorites());
    const index = this.loadIndex();
    const now = Date.now();

    const kept: CacheEntry[] = [];
    let removed = 0;

    for (const entry of index.entries) {
      const isPack = entry.localPath.includes(path.sep + packName + path.sep);
      if (!isPack) {
        kept.push(entry);
        continue;
      }
      const expired = now - entry.addedAt > entry.ttlSec * 1000;
      const isFavorite = favorites.has(entry.localPath);
      if (expired && !isFavorite) {
        if (fs.existsSync(entry.localPath)) {
          try { fs.unlinkSync(entry.localPath); } catch { /* ignore */ }
        }
        removed++;
      } else {
        kept.push(entry);
      }
    }

    this.saveIndex({entries: kept});
    return {removed, remaining: kept.length};
  }

  hardPruneAll(): {removedFiles: number; keptFavorites: number; remainingIndex: number} {
    const favorites = new Set(listFavorites());
    const index = this.loadIndex();

    let removedFiles = 0;
    let keptFavorites = 0;
    const allImages = this.listImagesRecursiveSafe(this.downloadDir);
    for (const file of allImages) {
      if (favorites.has(file)) {
        keptFavorites++;
        continue;
      }
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          removedFiles++;
        } catch {
          // ignore per-file errors
        }
      }
    }

    const remainingEntries = index.entries.filter(e => {
      if (!e.localPath.startsWith(this.downloadDir)) return true;
      return fs.existsSync(e.localPath);
    });
    this.saveIndex({entries: remainingEntries});
    this.removeEmptyDirs(this.downloadDir);
    return {removedFiles, keptFavorites, remainingIndex: remainingEntries.length};
  }

  hardPrunePack(packName: string): {removedFiles: number; keptFavorites: number; remainingIndex: number} {
    const favorites = new Set(listFavorites());
    const index = this.loadIndex();
    const dir = this.resolvePackDir(packName);
    if (!dir) {
      return {removedFiles: 0, keptFavorites: 0, remainingIndex: index.entries.length};
    }

    let removedFiles = 0;
    let keptFavorites = 0;
    const images = this.listImagesRecursiveSafe(dir);
    for (const file of images) {
      if (favorites.has(file)) {
        keptFavorites++;
        continue;
      }
      if (fs.existsSync(file)) {
        try {
          fs.unlinkSync(file);
          removedFiles++;
        } catch {
          // ignore per-file errors
        }
      }
    }

    const remainingEntries = index.entries.filter(e => {
      if (!e.localPath.startsWith(dir)) return true;
      return fs.existsSync(e.localPath);
    });
    this.saveIndex({entries: remainingEntries});
    this.removeEmptyDirs(dir);
    return {removedFiles, keptFavorites, remainingIndex: remainingEntries.length};
  }

  private listImagesRecursiveSafe(root: string): string[] {
    if (!fs.existsSync(root)) return [];
    const IMAGE_EXTENSIONS = new Set([
      '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'
    ]);
    const out: string[] = [];

    const walk = (currentPath: string): void => {
      if (!fs.existsSync(currentPath)) return;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(currentPath);
      } catch {
        return;
      }
      if (stat.isFile()) {
        const ext = path.extname(currentPath).toLowerCase();
        if (IMAGE_EXTENSIONS.has(ext)) out.push(currentPath);
        return;
      }
      if (!stat.isDirectory()) return;
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(currentPath);
      } catch {
        return;
      }
      for (const entry of entries) {
        walk(path.join(currentPath, entry));
      }
    };

    walk(root);
    return out;
  }

  private normalizeName(input: string): string {
    return input.trim().toLowerCase().replace(/[\s_]+/g, '-');
  }

  private resolvePackDir(packName: string): string | null {
    const direct = path.join(this.downloadDir, packName);
    if (fs.existsSync(direct) && fs.statSync(direct).isDirectory()) return direct;
    if (!fs.existsSync(this.downloadDir)) return null;
    const target = this.normalizeName(packName);
    const entries = fs.readdirSync(this.downloadDir, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (this.normalizeName(entry.name) === target) {
        return path.join(this.downloadDir, entry.name);
      }
    }
    return null;
  }

  private removeEmptyDirs(root: string): void {
    if (!fs.existsSync(root)) return;
    const walk = (dir: string): boolean => {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
      const children = fs.readdirSync(dir);
      let isEmpty = true;
      for (const child of children) {
        const full = path.join(dir, child);
        if (fs.statSync(full).isDirectory()) {
          const childEmpty = walk(full);
          if (childEmpty) {
            try { fs.rmdirSync(full); } catch {}
          } else {
            isEmpty = false;
          }
        } else {
          isEmpty = false;
        }
      }
      return isEmpty;
    };
    walk(root);
  }
}
