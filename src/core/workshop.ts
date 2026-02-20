import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {sha256Hex} from '../utils/hash';
import {ensureDir, writeJson} from '../utils/fs';
import {fetchWithRetry} from '../utils/net';
import {appendSystemLog} from './logs';
import {run} from '../utils/exec';

const WE_APP_ID = 431960;
const SEARCH_TTL_MS = 10 * 60 * 1000;
const DEFAULT_PAGE_SIZE = 24;

export type WorkshopSort = 'top' | 'newest' | 'trend' | 'subscribed' | 'updated';
export type WorkshopJobStatus = 'queued' | 'downloading' | 'moving' | 'done' | 'error';

export interface WorkshopPaths {
  root: string;
  steamcmd: string;
  downloads: string;
  previews: string;
  metadata: string;
  cache: string;
  jobs: string;
  runtime: string;
}

export interface WorkshopMeta {
  id: string;
  title: string;
  preview_url_remote?: string;
  preview_motion_remote?: string;
  preview_thumb_local?: string;
  author_name?: string;
  tags: string[];
  score?: number;
  time_updated?: number;
  wallpaper_type?: 'video' | 'scene' | 'web' | 'application' | 'unknown';
  audio_reactive?: boolean;
  entry?: string;
}

export interface WorkshopDetails extends WorkshopMeta {
  additional_previews: string[];
  description_short?: string;
  file_size?: number;
  item_url?: string;
}

export interface WorkshopSearchInput {
  text?: string;
  tags?: string[];
  sort?: WorkshopSort;
  page?: number;
  pageSize?: number;
  days?: number;
  fixtures?: boolean;
}

export interface WorkshopDownloadInput {
  publishedfileid: string;
  targetDir?: string;
  steamUser?: string;
  steamPasswordEnv?: string;
  steamGuardCode?: string;
  useCoexistence?: boolean;
}

export interface WorkshopJob {
  id: string;
  status: WorkshopJobStatus;
  publishedfileid: string;
  targetDir: string;
  outputDir?: string;
  createdAt: number;
  updatedAt: number;
  error?: string;
  logs: string[];
  steamUser?: string;
  steamPasswordEnv?: string;
  steamGuardCode?: string;
  useCoexistence?: boolean;
}

export interface WorkshopActiveInstance {
  id?: string;
  pid?: number;
  backend?: string;
  type?: string;
}

export interface WorkshopActiveState {
  mode: 'livewallpaper';
  started_at: number;
  snapshot_id?: string;
  instances: Record<string, WorkshopActiveInstance>;
}

interface WeConfig {
  steamWebApiKey?: string;
  coexistServices?: string[];
  steamRoots?: string[];
}

interface SteamPublishedItem {
  publishedfileid?: string;
  title?: string;
  preview_url?: string;
  previewurl?: string;
  creator?: string;
  time_updated?: number;
  score?: number;
  file_size?: number;
  tags?: Array<{tag?: string} | string>;
  vote_data?: {
    score?: number;
  };
  short_description?: string;
  file_description?: string;
  additional_previews?: Array<{preview_url?: string; url?: string} | string>;
  previews?: Array<{
    preview_type?: string;
    filename?: string;
    url?: string;
    preview_url?: string;
  }>;
}

type WallpaperType = 'video' | 'scene' | 'web' | 'application' | 'unknown';

function now(): number {
  return Date.now();
}

function clean(input?: string | null): string | undefined {
  if (input == null) return undefined;
  const v = input.trim();
  return v.length > 0 ? v : undefined;
}

function getWePaths(): WorkshopPaths {
  const root = path.join(os.homedir(), '.local', 'share', 'kitsune', 'we');
  return {
    root,
    steamcmd: path.join(root, 'steamcmd'),
    downloads: path.join(root, 'downloads'),
    previews: path.join(root, 'previews'),
    metadata: path.join(root, 'metadata'),
    cache: path.join(root, 'cache'),
    jobs: path.join(root, 'jobs'),
    runtime: path.join(root, 'runtime')
  };
}

function ensureWePaths(paths: WorkshopPaths): void {
  ensureDir(paths.root);
  ensureDir(paths.steamcmd);
  ensureDir(paths.downloads);
  ensureDir(paths.previews);
  ensureDir(paths.metadata);
  ensureDir(paths.cache);
  ensureDir(paths.jobs);
  ensureDir(paths.runtime);
  ensureDir(path.join(paths.cache, 'search'));
  ensureDir(path.join(paths.steamcmd, 'logs'));
  ensureDir(path.join(paths.root, 'coexistence', 'snapshots'));
}

function getWeConfigPath(): string {
  return path.join(os.homedir(), '.config', 'kitowall', 'we.json');
}

function readWeConfig(): WeConfig {
  const p = getWeConfigPath();
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as WeConfig;
  } catch {
    return {};
  }
}

function normalizePath(input: string): string {
  const raw = clean(input) ?? '';
  if (!raw) return '';
  if (raw === '~') return os.homedir();
  if (raw.startsWith('~/')) return path.join(os.homedir(), raw.slice(2));
  return raw;
}

export function setWorkshopApiKey(apiKey: string): {ok: true} {
  const key = clean(apiKey);
  if (!key) throw new Error('steam_web_api_key is required');
  const p = getWeConfigPath();
  const current = readWeConfig();
  current.steamWebApiKey = key;
  writeJson(p, current);
  return {ok: true};
}

export function workshopGetSteamRoots(): {steam_roots: string[]} {
  const cfg = readWeConfig();
  const steamRoots = Array.isArray(cfg.steamRoots)
    ? cfg.steamRoots.map(v => normalizePath(String(v))).filter(Boolean)
    : [];
  return {steam_roots: Array.from(new Set(steamRoots))};
}

export function workshopSetSteamRoots(roots: string[]): {ok: true; steam_roots: string[]} {
  const cfg = readWeConfig();
  const normalized = roots.map(v => normalizePath(String(v))).filter(Boolean);
  cfg.steamRoots = Array.from(new Set(normalized));
  writeJson(getWeConfigPath(), cfg);
  return {ok: true, steam_roots: cfg.steamRoots};
}

function getSteamWebApiKey(): string | undefined {
  const envKey = clean(process.env.STEAM_WEB_API_KEY) ?? clean(process.env.KITOWALL_STEAM_WEB_API_KEY);
  if (envKey) return envKey;
  const cfg = readWeConfig();
  return clean(cfg.steamWebApiKey);
}

function getCoexistServices(): string[] {
  const cfg = readWeConfig();
  const defaults = [
    'swww-daemon.service',
    'swww-daemon@kitowall.service',
    'hyprwall-watch.service',
    'hyprwall-next.timer',
    'kitowall-next.timer'
  ];
  const configured = Array.isArray(cfg.coexistServices) ? cfg.coexistServices.map(v => String(v).trim()).filter(Boolean) : [];
  return configured.length > 0 ? configured : defaults;
}

function getSearchCacheFile(query: Record<string, unknown>, paths: WorkshopPaths): string {
  const key = sha256Hex(JSON.stringify(query));
  return path.join(paths.cache, 'search', `${key}.json`);
}

function parseTags(raw: SteamPublishedItem['tags']): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const tag of raw) {
    if (typeof tag === 'string') {
      const t = clean(tag);
      if (t) out.push(t);
      continue;
    }
    const t = clean(tag?.tag);
    if (t) out.push(t);
  }
  return out;
}

function getPreviewUrl(item: SteamPublishedItem): string | undefined {
  return clean(item.preview_url) ?? clean(item.previewurl);
}

function isMotionUrl(url?: string): boolean {
  const v = clean(url);
  if (!v) return false;
  const lower = v.toLowerCase();
  return (
    lower.includes('.mp4') ||
    lower.includes('.webm') ||
    lower.includes('.mov') ||
    lower.includes('.mkv') ||
    lower.includes('.gif')
  );
}

function pickMotionPreview(item: SteamPublishedItem): string | undefined {
  if (Array.isArray(item.additional_previews)) {
    for (const p of item.additional_previews) {
      const candidate = typeof p === 'string' ? clean(p) : (clean(p.preview_url) ?? clean(p.url));
      if (isMotionUrl(candidate)) return candidate;
    }
  }
  if (Array.isArray(item.previews)) {
    for (const p of item.previews) {
      const candidate = clean(p.url) ?? clean(p.preview_url) ?? clean(p.filename);
      if (isMotionUrl(candidate)) return candidate;
      if (clean(p.preview_type)?.toLowerCase() === 'video' && candidate) return candidate;
    }
  }
  return undefined;
}

function normalizeMeta(item: SteamPublishedItem, paths: WorkshopPaths): WorkshopMeta {
  const id = clean(item.publishedfileid) ?? '';
  const thumbDir = path.join(paths.previews, id);
  const thumbJpg = path.join(thumbDir, 'thumb.jpg');
  const thumbPng = path.join(thumbDir, 'thumb.png');
  const thumbWebp = path.join(thumbDir, 'thumb.webp');
  let previewThumbLocal: string | undefined;
  if (fs.existsSync(thumbJpg)) previewThumbLocal = thumbJpg;
  else if (fs.existsSync(thumbPng)) previewThumbLocal = thumbPng;
  else if (fs.existsSync(thumbWebp)) previewThumbLocal = thumbWebp;

  const score = typeof item.score === 'number'
    ? item.score
    : (typeof item.vote_data?.score === 'number' ? item.vote_data.score : undefined);

  return {
    id,
    title: clean(item.title) ?? `Workshop ${id}`,
    preview_url_remote: getPreviewUrl(item),
    preview_motion_remote: pickMotionPreview(item),
    preview_thumb_local: previewThumbLocal,
    author_name: clean(item.creator),
    tags: parseTags(item.tags),
    score,
    time_updated: typeof item.time_updated === 'number' ? item.time_updated : undefined
  };
}

function resolveSortToQueryType(sort: WorkshopSort, hasText: boolean): number {
  if (hasText) return 12;
  if (sort === 'top') return 0;
  if (sort === 'newest') return 1;
  if (sort === 'trend') return 3;
  if (sort === 'subscribed') return 9;
  if (sort === 'updated') return 21;
  return 0;
}

function getFixturesDir(): string {
  const fromEnv = clean(process.env.KITOWALL_WE_FIXTURES_DIR);
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), 'fixtures', 'we');
}

function readFixtureJson(name: string): unknown {
  const file = path.join(getFixturesDir(), name);
  if (!fs.existsSync(file)) throw new Error(`Fixture not found: ${file}`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

async function callSteamService(
  method: 'QueryFiles' | 'GetDetails',
  payload: Record<string, unknown>,
  fixtures: boolean
): Promise<unknown> {
  if (fixtures || process.env.KITOWALL_WE_USE_FIXTURES === '1') {
    return method === 'QueryFiles'
      ? readFixtureJson('query-files.json')
      : readFixtureJson('get-details.json');
  }

  const key = getSteamWebApiKey();
  if (!key) {
    throw new Error('Missing Steam Web API key. Set STEAM_WEB_API_KEY or run: kitowall we config set-api-key <key>');
  }

  const endpoint = `https://api.steampowered.com/IPublishedFileService/${method}/v1/?key=${encodeURIComponent(key)}`;
  const body = new URLSearchParams({
    input_json: JSON.stringify(payload)
  });

  appendSystemLog({
    level: 'info',
    source: 'workshop',
    action: `steam-api:${method.toLowerCase()}`,
    url: endpoint
  });

  const response = await fetchWithRetry(endpoint, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: body.toString()
  }, {timeoutMs: 20000, retries: 2, backoffMs: 350});

  const json = await response.json();
  return json as unknown;
}

function extractItemsFromQuery(response: unknown): SteamPublishedItem[] {
  const root = response as {
    response?: {
      publishedfiledetails?: SteamPublishedItem[];
      publishedfile_details?: SteamPublishedItem[];
    };
  };
  const fromA = root.response?.publishedfiledetails;
  if (Array.isArray(fromA)) return fromA;
  const fromB = root.response?.publishedfile_details;
  if (Array.isArray(fromB)) return fromB;
  return [];
}

function extractSingleFromDetails(response: unknown): SteamPublishedItem | null {
  const items = extractItemsFromQuery(response);
  if (items.length > 0) return items[0];
  const root = response as {response?: {publishedfiledetails?: SteamPublishedItem[]}};
  const details = root.response?.publishedfiledetails;
  if (Array.isArray(details) && details.length > 0) return details[0];
  return null;
}

function toShortDescription(item: SteamPublishedItem): string | undefined {
  return clean(item.short_description) ?? clean(item.file_description);
}

function maybeAdditionalPreviews(item: SteamPublishedItem): string[] {
  if (!Array.isArray(item.additional_previews)) return [];
  const out: string[] = [];
  for (const p of item.additional_previews) {
    if (typeof p === 'string') {
      const v = clean(p);
      if (v) out.push(v);
      continue;
    }
    const v = clean(p.preview_url) ?? clean(p.url);
    if (v) out.push(v);
  }
  return out;
}

function extFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png' || ext === '.webp') return ext;
    return '.jpg';
  } catch {
    return '.jpg';
  }
}

async function cachePreviewImage(id: string, imageUrl?: string, customName?: string): Promise<string | undefined> {
  if (!imageUrl) return undefined;
  const paths = getWePaths();
  ensureWePaths(paths);
  const targetDir = path.join(paths.previews, id);
  ensureDir(targetDir);
  const ext = extFromUrl(imageUrl);
  const fileName = customName ?? `thumb${ext}`;
  const target = path.join(targetDir, fileName);
  if (fs.existsSync(target)) return target;

  try {
    const response = await fetchWithRetry(imageUrl, undefined, {timeoutMs: 15000, retries: 1});
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(target, bytes);
    return target;
  } catch {
    return undefined;
  }
}

function writeMetaFile(meta: WorkshopMeta | WorkshopDetails): void {
  const paths = getWePaths();
  ensureWePaths(paths);
  const p = path.join(paths.metadata, `${meta.id}.json`);
  writeJson(p, {
    ...meta,
    cached_at: now()
  });
}

function normalizeWallpaperType(raw?: string | null): WallpaperType {
  const t = clean(raw)?.toLowerCase();
  if (!t) return 'unknown';
  if (t === 'video') return 'video';
  if (t === 'scene') return 'scene';
  if (t === 'web') return 'web';
  if (t === 'application') return 'application';
  return 'unknown';
}

function detectAudioReactiveFromText(text: string): boolean {
  return /(audio|spectrum|visualizer|now[\s_-]?playing|media[\s_-]?integration|fft|bass|reactive)/i.test(text);
}

function readProjectInfo(dir: string): {type: WallpaperType; audioReactive: boolean; entry?: string} {
  const projectPath = path.join(dir, 'project.json');
  if (!fs.existsSync(projectPath)) {
    return {type: 'unknown', audioReactive: false, entry: undefined};
  }
  try {
    const raw = fs.readFileSync(projectPath, 'utf8');
    const json = JSON.parse(raw) as {type?: string; title?: string; file?: string};
    const type = normalizeWallpaperType(json.type);
    const title = clean(json.title) ?? '';
    const fileEntry = clean(json.file);
    const entry = fileEntry ? path.join(dir, fileEntry) : undefined;
    const audioReactive = detectAudioReactiveFromText(`${title}\n${raw}`);
    return {type, audioReactive, entry};
  } catch {
    return {type: 'unknown', audioReactive: false, entry: undefined};
  }
}

function inferVideoEntry(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  const files = fs.readdirSync(dir, {withFileTypes: true});
  const preferred = ['.mp4', '.webm', '.gif', '.mkv', '.avi', '.mov'];
  for (const ext of preferred) {
    const match = files.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(ext));
    if (match) return path.join(dir, match.name);
  }
  return undefined;
}

function detectTypeFromEntry(entry?: string): WallpaperType {
  const e = clean(entry)?.toLowerCase();
  if (!e) return 'unknown';
  if (e.endsWith('.mp4') || e.endsWith('.webm') || e.endsWith('.gif') || e.endsWith('.mkv') || e.endsWith('.avi') || e.endsWith('.mov')) {
    return 'video';
  }
  if (e.endsWith('index.html') || e.endsWith('.html')) return 'web';
  if (e.endsWith('scene.json') || e.endsWith('gifscene.json')) return 'scene';
  return 'unknown';
}

function readLibraryFoldersVdf(vdfPath: string): string[] {
  if (!fs.existsSync(vdfPath)) return [];
  const raw = fs.readFileSync(vdfPath, 'utf8');
  const out: string[] = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    const m = line.match(/"path"\s+"([^"]+)"/);
    if (!m || !m[1]) continue;
    const candidate = m[1].replace(/\\\\/g, '\\');
    out.push(candidate);
  }
  return out;
}

function getDefaultSteamRoots(): string[] {
  const home = os.homedir();
  const roots = [
    path.join(home, '.steam', 'steam'),
    path.join(home, '.local', 'share', 'Steam'),
    path.join(home, '.var', 'app', 'com.valvesoftware.Steam', '.local', 'share', 'Steam')
  ];
  return Array.from(new Set(roots));
}

function getManualSteamRoots(): string[] {
  const cfg = readWeConfig();
  if (!Array.isArray(cfg.steamRoots)) return [];
  return cfg.steamRoots.map(v => normalizePath(String(v))).filter(Boolean);
}

function detectSteamappsDirs(): string[] {
  const steamappsSet = new Set<string>();
  const candidateRoots = [...getDefaultSteamRoots(), ...getManualSteamRoots()];

  for (const root of candidateRoots) {
    const p = normalizePath(root);
    if (!p || !fs.existsSync(p)) continue;
    if (path.basename(p) === 'steamapps' && fs.existsSync(p)) {
      steamappsSet.add(p);
    }
    const directSteamapps = path.join(p, 'steamapps');
    if (fs.existsSync(directSteamapps)) {
      steamappsSet.add(directSteamapps);
    }
    const marker = `${path.sep}steamapps${path.sep}workshop${path.sep}content${path.sep}${WE_APP_ID}`;
    const idx = p.indexOf(marker);
    if (idx >= 0) {
      const steamapps = p.slice(0, idx + `${path.sep}steamapps`.length);
      if (fs.existsSync(steamapps)) steamappsSet.add(steamapps);
    }
    const markerNoSteamapps = `${path.sep}workshop${path.sep}content${path.sep}${WE_APP_ID}`;
    const idx2 = p.indexOf(markerNoSteamapps);
    if (idx2 >= 0) {
      const steamappsMaybe = p.slice(0, idx2);
      if (path.basename(steamappsMaybe) === 'steamapps' && fs.existsSync(steamappsMaybe)) {
        steamappsSet.add(steamappsMaybe);
      }
    }
  }

  const baseSteamapps = Array.from(steamappsSet);
  for (const steamapps of baseSteamapps) {
    const vdf = path.join(steamapps, 'libraryfolders.vdf');
    for (const lib of readLibraryFoldersVdf(vdf)) {
      const candidate = path.join(lib, 'steamapps');
      if (fs.existsSync(candidate)) steamappsSet.add(candidate);
    }
  }
  return Array.from(steamappsSet);
}

function toWorkshopAppContentDir(inputPath: string): string {
  const p = normalizePath(inputPath);
  if (!p) return '';
  const direct = p;
  const asSteamRoot = path.join(p, 'steamapps', 'workshop', 'content', String(WE_APP_ID));
  const asSteamappsRoot = path.join(p, 'workshop', 'content', String(WE_APP_ID));
  const asContentRoot = path.join(p, String(WE_APP_ID));
  if (fs.existsSync(direct) && direct.endsWith(`${path.sep}${WE_APP_ID}`)) return direct;
  if (fs.existsSync(direct) && direct.includes(`${path.sep}workshop${path.sep}content${path.sep}${WE_APP_ID}`)) return direct;
  if (fs.existsSync(asSteamRoot)) return asSteamRoot;
  if (fs.existsSync(asSteamappsRoot)) return asSteamappsRoot;
  if (fs.existsSync(asContentRoot)) return asContentRoot;
  return '';
}

function detectSteamWorkshopContentDirs(): string[] {
  const discovered = new Set<string>();
  for (const root of getManualSteamRoots()) {
    const fromManual = toWorkshopAppContentDir(root);
    if (fromManual && fs.existsSync(fromManual)) discovered.add(fromManual);
  }
  for (const steamapps of detectSteamappsDirs()) {
    const candidate = path.join(steamapps, 'workshop', 'content', String(WE_APP_ID));
    if (fs.existsSync(candidate)) {
      discovered.add(candidate);
    }
  }
  return Array.from(discovered);
}

export function workshopWallpaperEngineStatus(): {
  ok: true;
  installed: boolean;
  manifests: string[];
  steamapps: string[];
} {
  const manifests: string[] = [];
  const steamapps = detectSteamappsDirs();
  for (const dir of steamapps) {
    const manifest = path.join(dir, `appmanifest_${WE_APP_ID}.acf`);
    if (fs.existsSync(manifest)) manifests.push(manifest);
  }
  return {
    ok: true,
    installed: manifests.length > 0,
    manifests,
    steamapps
  };
}

function findPreviewCandidate(dir: string): string | undefined {
  if (!fs.existsSync(dir)) return undefined;
  const entries = fs.readdirSync(dir, {withFileTypes: true});
  const preferred = ['preview.gif', 'preview.webm', 'preview.mp4', 'preview.jpg', 'preview.png', 'preview.webp'];
  for (const name of preferred) {
    const full = path.join(dir, name);
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    if (lower.startsWith('preview.') || lower.startsWith('thumbnail.')) {
      return path.join(dir, entry.name);
    }
  }
  return undefined;
}

export function workshopScanSteamDownloads(): {sources: string[]; count: number; ids: string[]} {
  const sources = detectSteamWorkshopContentDirs();
  const idsSet = new Set<string>();
  for (const source of sources) {
    if (!fs.existsSync(source)) continue;
    const entries = fs.readdirSync(source, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = clean(entry.name);
      if (!id) continue;
      idsSet.add(id);
    }
  }
  const ids = Array.from(idsSet).sort();
  return {sources, count: ids.length, ids};
}

export function workshopSyncSteamDownloads(): {
  ok: true;
  sources: string[];
  imported: number;
  skipped: number;
  total: number;
} {
  const app = workshopWallpaperEngineStatus();
  if (!app.installed) {
    throw new Error('Wallpaper Engine (AppID 431960) is not installed in Steam. Install it first to sync downloads.');
  }
  const paths = getWePaths();
  ensureWePaths(paths);
  const sources = detectSteamWorkshopContentDirs();
  let imported = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const source of sources) {
    if (!fs.existsSync(source)) continue;
    const entries = fs.readdirSync(source, {withFileTypes: true});
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const id = clean(entry.name);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const sourceDir = path.join(source, id);
      const targetDir = path.join(paths.downloads, id);
      if (fs.existsSync(targetDir)) {
        skipped += 1;
      } else {
        fs.cpSync(sourceDir, targetDir, {recursive: true});
        imported += 1;
      }

      const metadataFile = path.join(paths.metadata, `${id}.json`);
      const info = readProjectInfo(sourceDir);
      if (!fs.existsSync(metadataFile)) {
        const previewCandidate = findPreviewCandidate(sourceDir);
        let thumbLocal: string | undefined;
        if (previewCandidate && fs.existsSync(previewCandidate)) {
          const ext = path.extname(previewCandidate) || '.jpg';
          const previewDir = path.join(paths.previews, id);
          ensureDir(previewDir);
          thumbLocal = path.join(previewDir, `thumb${ext}`);
          if (!fs.existsSync(thumbLocal)) {
            fs.copyFileSync(previewCandidate, thumbLocal);
          }
        }
        writeMetaFile({
          id,
          title: `Wallpaper ${id}`,
          tags: [],
          preview_thumb_local: thumbLocal,
          author_name: 'Steam Workshop',
          time_updated: Math.floor(Date.now() / 1000),
          wallpaper_type: info.type,
          audio_reactive: info.audioReactive,
          entry: info.entry
        });
      } else {
        try {
          const current = JSON.parse(fs.readFileSync(metadataFile, 'utf8')) as WorkshopMeta;
          if (!current.wallpaper_type || current.wallpaper_type === 'unknown' || current.audio_reactive === undefined || !current.entry) {
            writeMetaFile({
              ...current,
              wallpaper_type: current.wallpaper_type ?? info.type,
              audio_reactive: current.audio_reactive ?? info.audioReactive,
              entry: current.entry ?? info.entry
            });
          }
        } catch {
          // ignore malformed metadata
        }
      }
    }
  }

  return {
    ok: true,
    sources,
    imported,
    skipped,
    total: imported + skipped
  };
}

export async function workshopSearch(input: WorkshopSearchInput): Promise<{
  items: WorkshopMeta[];
  page: number;
  page_size: number;
  total?: number;
  cached: boolean;
}> {
  const paths = getWePaths();
  ensureWePaths(paths);
  const text = clean(input.text) ?? '';
  const page = Number.isFinite(input.page) && (input.page ?? 1) > 0 ? Math.floor(input.page ?? 1) : 1;
  const pageSize = Number.isFinite(input.pageSize) && (input.pageSize ?? DEFAULT_PAGE_SIZE) > 0
    ? Math.floor(input.pageSize ?? DEFAULT_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
  const sort = input.sort ?? 'top';
  const tags = (input.tags ?? []).map(v => String(v).trim()).filter(Boolean);
  const days = Number.isFinite(input.days) && (input.days ?? 7) > 0 ? Math.floor(input.days ?? 7) : 7;
  const hasText = text.length > 0;
  const queryType = resolveSortToQueryType(sort, hasText);
  const queryPayload: Record<string, unknown> = {
    query_type: queryType,
    page,
    numperpage: pageSize,
    appid: WE_APP_ID,
    creator_appid: WE_APP_ID,
    filetype: 0,
    search_text: text,
    return_tags: true,
    return_vote_data: true,
    return_previews: true,
    return_short_description: true,
    requiredtags: tags.length > 0 ? tags : undefined,
    match_all_tags: false
  };

  if (queryType === 3) {
    queryPayload.days = days;
    queryPayload.include_recent_votes_only = true;
  }

  const cacheFile = getSearchCacheFile(queryPayload, paths);
  if (fs.existsSync(cacheFile)) {
    try {
      const cachedRaw = JSON.parse(fs.readFileSync(cacheFile, 'utf8')) as {
        ts: number;
        payload: {items: WorkshopMeta[]; page: number; page_size: number; total?: number};
      };
      if (now() - cachedRaw.ts <= SEARCH_TTL_MS) {
        return {...cachedRaw.payload, cached: true};
      }
    } catch {
      // ignore malformed cache and refresh.
    }
  }

  const json = await callSteamService('QueryFiles', queryPayload, Boolean(input.fixtures));
  const itemsRaw = extractItemsFromQuery(json);
  const items = itemsRaw
    .map(item => normalizeMeta(item, paths))
    .filter(item => item.id.length > 0);

  for (const item of items) {
    writeMetaFile(item);
  }

  await Promise.allSettled(items.slice(0, 16).map(item => cachePreviewImage(item.id, item.preview_url_remote)));

  const root = json as {response?: {total?: number; total_matching?: number}};
  const total = typeof root.response?.total === 'number'
    ? root.response.total
    : (typeof root.response?.total_matching === 'number' ? root.response.total_matching : undefined);

  const payload = {items, page, page_size: pageSize, total};
  writeJson(cacheFile, {ts: now(), payload});
  return {...payload, cached: false};
}

export async function workshopDetails(publishedfileid: string, fixtures = false): Promise<WorkshopDetails> {
  const paths = getWePaths();
  ensureWePaths(paths);
  const id = clean(publishedfileid);
  if (!id) throw new Error('publishedfileid is required');

  const payload = {
    publishedfileids: [id],
    includetags: true,
    includeadditionalpreviews: true
  };
  const json = await callSteamService('GetDetails', payload, fixtures);
  const raw = extractSingleFromDetails(json);
  if (!raw) throw new Error(`Workshop item not found: ${id}`);

  const meta = normalizeMeta(raw, paths);
  const additional = maybeAdditionalPreviews(raw);
  const details: WorkshopDetails = {
    ...meta,
    additional_previews: additional,
    description_short: toShortDescription(raw),
    file_size: typeof raw.file_size === 'number' ? raw.file_size : undefined,
    item_url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`
  };

  writeMetaFile(details);
  await cachePreviewImage(id, details.preview_url_remote);
  await Promise.allSettled(
    additional.slice(0, 8).map((url, idx) => cachePreviewImage(id, url, `preview-${idx + 1}${extFromUrl(url)}`))
  );
  return details;
}

function jobFile(jobId: string, paths: WorkshopPaths): string {
  return path.join(paths.jobs, `${jobId}.json`);
}

function readJob(jobId: string): WorkshopJob | null {
  const paths = getWePaths();
  ensureWePaths(paths);
  const p = jobFile(jobId, paths);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8')) as WorkshopJob;
}

function writeJob(job: WorkshopJob): void {
  const paths = getWePaths();
  ensureWePaths(paths);
  writeJson(jobFile(job.id, paths), job);
}

function appendJobLog(job: WorkshopJob, line: string): void {
  const clipped = line.length > 2000 ? `${line.slice(0, 2000)}...` : line;
  job.logs.push(clipped);
  if (job.logs.length > 120) {
    job.logs = job.logs.slice(job.logs.length - 120);
  }
}

function setJobStatus(job: WorkshopJob, status: WorkshopJobStatus, message?: string): void {
  job.status = status;
  job.updatedAt = now();
  if (message) appendJobLog(job, message);
  writeJob(job);
}

function resolveTargetDir(targetDir?: string): string {
  const paths = getWePaths();
  if (!targetDir) return paths.downloads;
  if (targetDir === '~') return os.homedir();
  if (targetDir.startsWith('~/')) return path.join(os.homedir(), targetDir.slice(2));
  return targetDir;
}

function getChildCliPath(): string {
  const current = process.argv[1];
  return path.resolve(current);
}

export function workshopQueueDownload(input: WorkshopDownloadInput): {job_id: string; status: WorkshopJobStatus} {
  const id = clean(input.publishedfileid);
  if (!id) throw new Error('publishedfileid is required');
  const paths = getWePaths();
  ensureWePaths(paths);
  const targetDir = resolveTargetDir(input.targetDir);

  const jobId = sha256Hex(`${id}:${Date.now()}:${Math.random()}`).slice(0, 16);
  const job: WorkshopJob = {
    id: jobId,
    status: 'queued',
    publishedfileid: id,
    targetDir,
    createdAt: now(),
    updatedAt: now(),
    logs: [],
    steamUser: clean(input.steamUser),
    steamPasswordEnv: clean(input.steamPasswordEnv) ?? 'STEAM_PASSWORD',
    steamGuardCode: clean(input.steamGuardCode),
    useCoexistence: input.useCoexistence ?? false
  };
  writeJob(job);

  const child = spawn(process.execPath, [getChildCliPath(), 'we', 'run-job', jobId], {
    detached: true,
    stdio: 'ignore',
    env: process.env
  });
  child.unref();

  return {job_id: jobId, status: 'queued'};
}

function safeMkdir(p: string): void {
  if (!fs.existsSync(p)) ensureDir(p);
}

function redacted(input: string, secret?: string): string {
  if (!secret) return input;
  if (!secret.length) return input;
  return input.split(secret).join('***');
}

async function runSteamCmdDownload(job: WorkshopJob): Promise<void> {
  const paths = getWePaths();
  ensureWePaths(paths);
  safeMkdir(paths.steamcmd);
  safeMkdir(path.join(paths.steamcmd, 'logs'));

  const logFile = path.join(paths.steamcmd, 'logs', `${job.id}.log`);
  const steamPassword = job.steamPasswordEnv ? clean(process.env[job.steamPasswordEnv]) : undefined;

  const loginCmd = job.steamUser
    ? `login ${job.steamUser} ${steamPassword ?? ''}${job.steamGuardCode ? ` ${job.steamGuardCode}` : ''}`
    : 'login anonymous';
  const commands = [
    `force_install_dir ${paths.steamcmd}`,
    loginCmd,
    `workshop_download_item ${WE_APP_ID} ${job.publishedfileid}`,
    'quit'
  ];

  await new Promise<void>((resolve, reject) => {
    const child = spawn('steamcmd', [], {
      cwd: paths.steamcmd,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const onData = (chunk: Buffer): void => {
      const raw = String(chunk);
      const cleanLine = redacted(raw, steamPassword);
      fs.appendFileSync(logFile, cleanLine, 'utf8');
      appendJobLog(job, cleanLine.trim());
      writeJob(job);
    };

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code && code !== 0) {
        reject(new Error(`steamcmd exited with code ${code}`));
        return;
      }
      resolve();
    });

    child.stdin.write(`${commands.join('\n')}\n`);
    child.stdin.end();
  });
}

function resolveDownloadedSource(publishedfileid: string): string {
  const paths = getWePaths();
  return path.join(paths.steamcmd, 'steamapps', 'workshop', 'content', String(WE_APP_ID), publishedfileid);
}

async function copyDownloadedContent(job: WorkshopJob): Promise<string> {
  const source = resolveDownloadedSource(job.publishedfileid);
  if (!fs.existsSync(source)) {
    throw new Error(`Downloaded workshop folder not found: ${source}`);
  }
  const baseTarget = resolveTargetDir(job.targetDir);
  ensureDir(baseTarget);
  const target = path.join(baseTarget, job.publishedfileid);
  if (fs.existsSync(target)) {
    fs.rmSync(target, {recursive: true, force: true});
  }
  fs.cpSync(source, target, {recursive: true});
  return target;
}

function snapshotFile(paths: WorkshopPaths): string {
  return path.join(paths.runtime, 'coexistence.snapshot.json');
}

function snapshotDir(paths: WorkshopPaths): string {
  return path.join(paths.root, 'coexistence', 'snapshots');
}

function activeLockFile(paths: WorkshopPaths): string {
  return path.join(paths.runtime, 'active.lock');
}

function activeStateFile(paths: WorkshopPaths): string {
  return path.join(paths.runtime, 'active.json');
}

function readActiveState(): WorkshopActiveState | null {
  const paths = getWePaths();
  ensureWePaths(paths);
  const p = activeStateFile(paths);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8')) as WorkshopActiveState;
  } catch {
    return null;
  }
}

function writeActiveState(state: WorkshopActiveState): void {
  const paths = getWePaths();
  ensureWePaths(paths);
  writeJson(activeStateFile(paths), state);
  fs.writeFileSync(activeLockFile(paths), `${state.mode}:${state.started_at}\n`, 'utf8');
}

function clearActiveState(): void {
  const paths = getWePaths();
  ensureWePaths(paths);
  try {
    fs.unlinkSync(activeStateFile(paths));
  } catch {
    // ignore
  }
  try {
    fs.unlinkSync(activeLockFile(paths));
  } catch {
    // ignore
  }
}

function killPid(pid?: number): boolean {
  if (!pid || !Number.isFinite(pid) || pid <= 1) return false;
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

export function workshopActiveStatus(): {
  ok: true;
  active: boolean;
  lock_path: string;
  state_path: string;
  state?: WorkshopActiveState;
} {
  const paths = getWePaths();
  ensureWePaths(paths);
  const state = readActiveState();
  const lock = fs.existsSync(activeLockFile(paths));
  return {
    ok: true,
    active: lock && !!state,
    lock_path: activeLockFile(paths),
    state_path: activeStateFile(paths),
    state: state ?? undefined
  };
}

export function workshopSetActive(state: WorkshopActiveState): {ok: true; active: true; state: WorkshopActiveState} {
  writeActiveState(state);
  return {ok: true, active: true, state};
}

async function isUnitActive(unit: string): Promise<boolean> {
  try {
    const out = await run('systemctl', ['--user', 'show', unit, '--property', 'ActiveState', '--value']);
    return out.stdout.trim() === 'active';
  } catch {
    return false;
  }
}

export async function workshopCoexistenceEnter(): Promise<{ok: true; stopped: string[]; snapshot: string[]; snapshot_id: string}> {
  const paths = getWePaths();
  ensureWePaths(paths);
  const units = getCoexistServices();
  const active: string[] = [];
  for (const unit of units) {
    if (await isUnitActive(unit)) active.push(unit);
  }
  for (const unit of active) {
    try {
      await run('systemctl', ['--user', 'stop', unit]);
    } catch {
      // best effort
    }
  }
  const snapshotId = String(now());
  const snap = {id: snapshotId, ts: now(), active};
  writeJson(path.join(snapshotDir(paths), `${snapshotId}.json`), snap);
  writeJson(snapshotFile(paths), {id: snapshotId, ts: snap.ts});
  return {ok: true, stopped: active, snapshot: active, snapshot_id: snapshotId};
}

export async function workshopCoexistenceExit(): Promise<{ok: true; restored: string[]}> {
  const paths = getWePaths();
  ensureWePaths(paths);
  const snapPath = snapshotFile(paths);
  if (!fs.existsSync(snapPath)) return {ok: true, restored: []};
  const raw = JSON.parse(fs.readFileSync(snapPath, 'utf8')) as {active?: string[]; id?: string};
  let active = Array.isArray(raw.active) ? raw.active.map(v => String(v)) : [];
  if ((!active || active.length === 0) && raw.id) {
    const historical = path.join(snapshotDir(paths), `${raw.id}.json`);
    if (fs.existsSync(historical)) {
      try {
        const snap = JSON.parse(fs.readFileSync(historical, 'utf8')) as {active?: string[]};
        active = Array.isArray(snap.active) ? snap.active.map(v => String(v)) : [];
      } catch {
        active = [];
      }
    }
  }
  const restored: string[] = [];
  for (const unit of active) {
    try {
      await run('systemctl', ['--user', 'start', unit]);
      restored.push(unit);
    } catch {
      // best effort
    }
  }
  try {
    fs.unlinkSync(snapPath);
  } catch {
    // ignore
  }
  return {ok: true, restored};
}

export async function workshopCoexistenceStatus(): Promise<{ok: true; snapshot: string[]; current: Record<string, boolean>}> {
  const paths = getWePaths();
  ensureWePaths(paths);
  const snapPath = snapshotFile(paths);
  const snapshot = fs.existsSync(snapPath)
    ? ((JSON.parse(fs.readFileSync(snapPath, 'utf8')) as {active?: string[]}).active ?? [])
    : [];
  const units = getCoexistServices();
  const current: Record<string, boolean> = {};
  for (const unit of units) {
    current[unit] = await isUnitActive(unit);
  }
  return {ok: true, snapshot, current};
}

export async function workshopStop(options?: {monitor?: string; all?: boolean}): Promise<{
  ok: true;
  stopped_instances: string[];
  restored_units: string[];
  had_active: boolean;
}> {
  let state = readActiveState();
  const hadActive = !!state;
  const stopped: string[] = [];
  let shouldRestore = false;

  if (state?.instances) {
    if (options?.monitor) {
      const inst = state.instances[options.monitor];
      if (killPid(inst?.pid)) stopped.push(options.monitor);
      delete state.instances[options.monitor];
      if (Object.keys(state.instances).length > 0 && !options?.all) {
        writeActiveState(state);
      } else {
        clearActiveState();
        shouldRestore = true;
      }
    } else {
      for (const [monitor, inst] of Object.entries(state.instances)) {
        if (killPid(inst?.pid)) stopped.push(monitor);
      }
      clearActiveState();
      shouldRestore = true;
    }
  } else if (options?.all) {
    clearActiveState();
    shouldRestore = true;
  }

  const coexist = shouldRestore ? await workshopCoexistenceExit() : {ok: true, restored: [] as string[]};
  return {
    ok: true,
    stopped_instances: stopped,
    restored_units: coexist.restored,
    had_active: hadActive
  };
}

export async function workshopRunJob(jobId: string): Promise<WorkshopJob> {
  const job = readJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  setJobStatus(job, 'downloading', 'Starting steamcmd download');
  appendSystemLog({
    level: 'info',
    source: 'workshop',
    action: 'download:start',
    message: `job=${job.id} id=${job.publishedfileid}`
  });

  let coexistEntered = false;
  try {
    if (job.useCoexistence) {
      const coexist = await workshopCoexistenceEnter();
      coexistEntered = true;
      appendJobLog(job, `Coexistence enter: ${coexist.stopped.join(', ') || 'none'}`);
      writeJob(job);
    }

    await runSteamCmdDownload(job);
    setJobStatus(job, 'moving', 'Moving downloaded content to target directory');
    const outputDir = await copyDownloadedContent(job);
    job.outputDir = outputDir;
    await workshopDetails(job.publishedfileid, false).catch(() => undefined);
    setJobStatus(job, 'done', `Download ready at ${outputDir}`);
    appendSystemLog({
      level: 'info',
      source: 'workshop',
      action: 'download:done',
      message: `job=${job.id} id=${job.publishedfileid}`,
      meta: {outputDir}
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.error = message;
    setJobStatus(job, 'error', message);
    appendSystemLog({
      level: 'error',
      source: 'workshop',
      action: 'download:error',
      message: `job=${job.id} id=${job.publishedfileid} err=${message}`
    });
  } finally {
    if (coexistEntered) {
      await workshopCoexistenceExit().catch(() => undefined);
    }
  }
  return job;
}

export function workshopGetJob(jobId: string): WorkshopJob {
  const job = readJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);
  return job;
}

export function workshopListJobs(limit = 40): {jobs: WorkshopJob[]} {
  const paths = getWePaths();
  ensureWePaths(paths);
  const files = fs.readdirSync(paths.jobs)
    .filter(name => name.endsWith('.json'))
    .map(name => path.join(paths.jobs, name));
  const jobs: WorkshopJob[] = [];
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as WorkshopJob;
      jobs.push(data);
    } catch {
      // ignore corrupted file
    }
  }
  jobs.sort((a, b) => b.updatedAt - a.updatedAt);
  return {jobs: jobs.slice(0, Math.max(1, Math.floor(limit)))};
}

export function workshopLibrary(): {
  root: string;
  items: Array<{id: string; path: string; metadata?: string; meta?: WorkshopDetails | WorkshopMeta}>;
} {
  const paths = getWePaths();
  ensureWePaths(paths);
  const items: Array<{id: string; path: string; metadata?: string; meta?: WorkshopDetails | WorkshopMeta}> = [];
  if (!fs.existsSync(paths.downloads)) return {root: paths.downloads, items};
  const dirs = fs.readdirSync(paths.downloads, {withFileTypes: true});
  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    const p = path.join(paths.downloads, id);
    const metadataFile = path.join(paths.metadata, `${id}.json`);
    let meta: WorkshopDetails | WorkshopMeta | undefined;
    if (fs.existsSync(metadataFile)) {
      try {
        meta = JSON.parse(fs.readFileSync(metadataFile, 'utf8')) as WorkshopDetails | WorkshopMeta;
      } catch {
        meta = undefined;
      }
    }
    const info = readProjectInfo(p);
    if (meta) {
      meta.wallpaper_type = meta.wallpaper_type ?? info.type;
      if (meta.audio_reactive === undefined) {
        meta.audio_reactive = info.audioReactive;
      }
      if (!meta.entry) {
        meta.entry = info.entry;
      }
    }
    items.push({
      id,
      path: p,
      metadata: fs.existsSync(metadataFile) ? metadataFile : undefined,
      meta
    });
  }
  items.sort((a, b) => a.id.localeCompare(b.id));
  return {root: paths.downloads, items};
}

function spawnMpvpaper(monitor: string, entry: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const child = spawn('mpvpaper', ['-o', 'no-audio --loop-file=inf', monitor, entry], {
      detached: true,
      stdio: 'ignore',
      env: process.env
    });

    let settled = false;
    const done = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      fn();
    };

    child.once('error', (err) => done(() => reject(err)));
    setTimeout(() => {
      done(() => {
        child.unref();
        resolve(child.pid ?? 0);
      });
    }, 180);
  });
}

export async function workshopApply(input: {id: string; monitor: string; backend?: string}): Promise<{
  ok: true;
  applied: true;
  monitor: string;
  id: string;
  backend: string;
  pid: number;
  state: WorkshopActiveState;
}> {
  const id = clean(input.id);
  const monitor = clean(input.monitor);
  const requestedBackend = clean(input.backend) ?? 'auto';
  if (!id) throw new Error('id is required');
  if (!monitor) throw new Error('monitor is required');

  const paths = getWePaths();
  ensureWePaths(paths);
  const dir = path.join(paths.downloads, id);
  if (!fs.existsSync(dir)) {
    throw new Error(`Wallpaper not found in downloads: ${id}`);
  }
  const project = readProjectInfo(dir);
  const inferredEntry = project.entry && fs.existsSync(project.entry) ? project.entry : inferVideoEntry(dir);
  const type = project.type !== 'unknown'
    ? project.type
    : detectTypeFromEntry(inferredEntry ?? path.join(dir, 'scene.json'));

  if (type !== 'video') {
    throw new Error(`Unsupported wallpaper type for apply: ${type}. Supported: video (mpvpaper).`);
  }

  let state = readActiveState();
  if (!state) {
    const coexist = await workshopCoexistenceEnter();
    state = {
      mode: 'livewallpaper',
      started_at: now(),
      snapshot_id: coexist.snapshot_id,
      instances: {}
    };
  }

  const current = state.instances[monitor];
  if (current?.pid) {
    killPid(current.pid);
  }

  let backend: string;
  let pid = 0;
  if (!(requestedBackend === 'auto' || requestedBackend === 'mpvpaper')) {
    throw new Error(`Invalid backend for video wallpaper: ${requestedBackend}`);
  }
  if (!inferredEntry || !fs.existsSync(inferredEntry)) {
    throw new Error(`Video entry not found for wallpaper: ${id}`);
  }
  backend = 'mpvpaper';
  pid = await spawnMpvpaper(monitor, inferredEntry).catch((err) => {
    throw new Error(`Failed to launch mpvpaper: ${err instanceof Error ? err.message : String(err)}`);
  });

  if (!pid) {
    throw new Error(`${backend} started without pid`);
  }

  state.instances[monitor] = {
    id,
    pid,
    backend,
    type
  };
  writeActiveState(state);
  return {ok: true, applied: true, monitor, id, backend, pid, state};
}

export async function workshopApplyMap(input: {map: string; backend?: string}): Promise<{
  ok: true;
  applied: Array<{monitor: string; id: string; backend: string; pid: number}>;
  state?: WorkshopActiveState;
}> {
  const raw = clean(input.map);
  if (!raw) throw new Error('map is required');
  const entries = raw.split(',').map(v => v.trim()).filter(Boolean);
  if (entries.length === 0) throw new Error('map has no entries');
  const applied: Array<{monitor: string; id: string; backend: string; pid: number}> = [];
  for (const pair of entries) {
    const idx = pair.indexOf(':');
    if (idx <= 0 || idx === pair.length - 1) {
      throw new Error(`Invalid map entry: ${pair}. Expected <monitor>:<id>`);
    }
    const monitor = pair.slice(0, idx).trim();
    const id = pair.slice(idx + 1).trim();
    if (!monitor || !id) {
      throw new Error(`Invalid map entry: ${pair}. Expected <monitor>:<id>`);
    }
    const out = await workshopApply({id, monitor, backend: input.backend});
    applied.push({monitor: out.monitor, id: out.id, backend: out.backend, pid: out.pid});
  }
  const state = readActiveState() ?? undefined;
  return {ok: true, applied, state};
}
