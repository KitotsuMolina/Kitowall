// Remote pack adapter interfaces for external sources.
import {WallpaperCandidate} from './candidates';

export interface RemotePackStatus {
  ok: boolean;
  lastRefresh?: number;
  cacheItems?: number;
  cacheBytes?: number;
  lastError?: string;
}

export interface RemotePackAdapter {
  name: string;
  refreshIndex(opts?: {force?: boolean}): Promise<{count: number}>;
  listCandidates(): Promise<WallpaperCandidate[]>;
  hydrate(candidate: WallpaperCandidate): Promise<{localPath: string}>;
  status(): Promise<RemotePackStatus>;
}

export interface PoolPackAdapter {
  name: string;
  listCandidates(): Promise<WallpaperCandidate[]>;
}
