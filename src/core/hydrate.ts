// Hydrate (download) N images for a given pack without applying wallpapers.
import {Config, PackConfig, isLocalPack, isGenericJsonPack, isRedditPack, isWallhavenPack, isUnsplashPack, isStaticUrlPack} from './config';
import {CacheManager} from './cache';
import {GenericJsonAdapter} from '../adapters/genericJson';
import {RedditAdapter} from '../adapters/reddit';
import {WallhavenAdapter} from '../adapters/wallhaven';
import {UnsplashAdapter} from '../adapters/unsplash';
import {StaticUrlAdapter} from '../adapters/staticUrl';
import {LocalFolderAdapter} from '../adapters/localFolder';

export async function hydratePack(config: Config, name: string, count: number): Promise<{downloaded: number}> {
  const pack: PackConfig | undefined = config.packs[name];
  if (!pack) throw new Error(`Pack not found: ${name}`);
  if (isLocalPack(pack)) {
    const adapter = new LocalFolderAdapter({paths: pack.paths});
    const pool = adapter.getAllImages();
    return {downloaded: Math.min(count, pool.length)};
  }

  const cache = new CacheManager(config.cache);
  let pool: string[] = [];
  let hydrate: ((path: string) => Promise<void>) | undefined;

  if (isGenericJsonPack(pack)) {
    const adapter = new GenericJsonAdapter(name, pack, cache);
    await adapter.refreshIndex();
    const candidates = await adapter.listCandidates();
    if (candidates.length === 0) {
      const st = await adapter.status();
      throw new Error(st.lastError ? `No candidates for pack ${name}: ${st.lastError}` : `No candidates for pack ${name}`);
    }
    pool = candidates.map(c => adapter.localPathFor(c));
    const map = new Map(pool.map((p, i) => [p, candidates[i]]));
    hydrate = async (path: string) => { const c = map.get(path); if (c) await adapter.hydrate(c); };
  } else if (isRedditPack(pack)) {
    const adapter = new RedditAdapter(name, pack, cache);
    await adapter.refreshIndex();
    const candidates = await adapter.listCandidates();
    if (candidates.length === 0) {
      const st = await adapter.status();
      throw new Error(st.lastError ? `No candidates for pack ${name}: ${st.lastError}` : `No candidates for pack ${name}`);
    }
    pool = candidates.map(c => adapter.localPathFor(c));
    const map = new Map(pool.map((p, i) => [p, candidates[i]]));
    hydrate = async (path: string) => { const c = map.get(path); if (c) await adapter.hydrate(c); };
  } else if (isWallhavenPack(pack)) {
    const adapter = new WallhavenAdapter(name, pack, cache);
    await adapter.refreshIndex();
    const candidates = await adapter.listCandidates();
    if (candidates.length === 0) {
      const st = await adapter.status();
      throw new Error(st.lastError ? `No candidates for pack ${name}: ${st.lastError}` : `No candidates for pack ${name}`);
    }
    pool = candidates.map(c => adapter.localPathFor(c));
    const map = new Map(pool.map((p, i) => [p, candidates[i]]));
    hydrate = async (path: string) => { const c = map.get(path); if (c) await adapter.hydrate(c); };
  } else if (isUnsplashPack(pack)) {
    const adapter = new UnsplashAdapter(name, pack, cache);
    const unique = new Map<string, Awaited<ReturnType<typeof adapter.listCandidates>>[number]>();
    const maxRounds = Math.max(2, Math.min(8, Math.ceil(count / 3)));
    for (let i = 0; i < maxRounds; i++) {
      await adapter.refreshIndex();
      const batch = await adapter.listCandidates();
      for (const c of batch) {
        unique.set(c.url, c);
      }
      if (unique.size >= count) break;
    }
    const candidates = Array.from(unique.values());
    if (candidates.length === 0) {
      const st = await adapter.status();
      throw new Error(st.lastError ? `No candidates for pack ${name}: ${st.lastError}` : `No candidates for pack ${name}`);
    }
    pool = candidates.map(c => adapter.localPathFor(c));
    const map = new Map(pool.map((p, i) => [p, candidates[i]]));
    hydrate = async (path: string) => { const c = map.get(path); if (c) await adapter.hydrate(c); };
  } else if (isStaticUrlPack(pack)) {
    const adapter = new StaticUrlAdapter(name, pack, cache);
    await adapter.refreshIndex();
    const candidates = await adapter.listCandidates();
    if (candidates.length === 0) {
      const st = await adapter.status();
      throw new Error(st.lastError ? `No candidates for pack ${name}: ${st.lastError}` : `No candidates for pack ${name}`);
    }
    pool = candidates.map(c => adapter.localPathFor(c));
    const map = new Map(pool.map((p, i) => [p, candidates[i]]));
    hydrate = async (path: string) => { const c = map.get(path); if (c) await adapter.hydrate(c); };
  } else {
    throw new Error(`Pack type not supported for hydrate: ${pack.type}`);
  }

  if (!hydrate) return {downloaded: 0};

  const limit = Math.min(count, pool.length);
  let downloaded = 0;
  let failed = 0;
  let firstError: string | null = null;
  for (let i = 0; i < limit; i++) {
    try {
      await hydrate(pool[i]);
      downloaded++;
    } catch (err) {
      failed++;
      if (!firstError) firstError = err instanceof Error ? err.message : String(err);
    }
  }

  if (downloaded === 0 && firstError) {
    throw new Error(`Hydrate failed for pack ${name}: ${firstError}`);
  }

  return {downloaded, ...(failed > 0 ? {failed} : {})};
}
