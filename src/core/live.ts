import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {run} from '../utils/exec';
import {fetchWithRetry} from '../utils/net';
import {ensureDir} from '../utils/fs';

export type LiveProvider = 'moewalls' | 'motionbgs';
export type LiveQuality = 'auto' | 'hd' | '4k';
export type LiveVariant = 'hd' | '4k';
export type RunnerMode = 'cargo' | 'bin';

export interface LiveLibraryItem {
  id: string;
  provider: LiveProvider;
  title: string;
  slug: string;
  page_url: string;
  variant: LiveVariant;
  resolution: {w: number; h: number};
  file_path: string;
  thumb_path: string;
  size_bytes: number;
  favorite: boolean;
  added_at: number;
  last_applied_at: number;
}

export interface LiveMonitorConfig {
  auto_apply: boolean;
  preferred_quality: LiveQuality;
  last_applied_id: string | null;
}

export interface LiveApplyDefaults {
  profile: 'performance' | 'balanced' | 'quality';
  seamless_loop: boolean;
  loop_crossfade: boolean;
  loop_crossfade_seconds: number;
  optimize: boolean;
  proxy_fps: number;
  proxy_crf_hd: number;
  proxy_crf_4k: number;
}

export interface LiveRunnerConfig {
  mode: RunnerMode;
  cargo_project_dir: string;
  bin_name: string;
}

export interface LiveIndex {
  version: 1;
  items: LiveLibraryItem[];
  per_monitor: Record<string, LiveMonitorConfig>;
  apply_defaults: LiveApplyDefaults;
  runner: LiveRunnerConfig;
}

export interface LiveResolvedVariant {
  variant: LiveVariant;
  download_url: string;
}

export interface LiveResolvedPost {
  provider: LiveProvider;
  title: string;
  slug: string;
  page_url: string;
  variants: LiveResolvedVariant[];
  tags: string[];
  thumb_remote?: string;
  preview_motion_remote?: string;
}

export interface LiveBrowseItem {
  provider: LiveProvider;
  title: string;
  page_url: string;
  slug: string;
  has_hd: boolean;
  has_4k: boolean;
  thumb_remote?: string;
  tags?: string[];
  preview_motion_remote?: string;
}

const LIVE_LOCK_STALE_MS = 10 * 60 * 1000;
const LIVE_DOWNLOAD_MIN_BYTES = 3 * 1024 * 1024;
const LIVE_PREVIEW_MIN_BYTES = 64 * 1024;
const LIVE_BROWSER_UA =
  process.env.KITOWALL_LIVE_UA ||
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const LIVE_BROWSER_UA_FALLBACK =
  process.env.KITOWALL_LIVE_UA_FALLBACK ||
  'insomnia/12.3.1';

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

function clean(input: string | null | undefined): string {
  return String(input ?? '').trim();
}

function sanitizeSlug(input: string): string {
  return clean(input)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseBoolish(input: string | null | undefined, fallback: boolean): boolean {
  const v = clean(input).toLowerCase();
  if (!v) return fallback;
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
  return fallback;
}

function htmlDecode(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function projectSiblingPath(name: string): string {
  return path.resolve(process.cwd(), '..', name);
}

export function getLiveRoot(): string {
  return path.join(os.homedir(), 'Videos', 'LiveWallpapers');
}

function getLiveInternalRoot(): string {
  return path.join(getLiveRoot(), '.kitowall');
}

function getLiveThumbsRoot(): string {
  return path.join(getLiveInternalRoot(), 'thumbs');
}

function getLiveTmpRoot(): string {
  return path.join(getLiveInternalRoot(), 'tmp');
}

function getLivePreviewCacheRoot(): string {
  return path.join(getLiveTmpRoot(), 'previews');
}

function getLiveIndexPath(): string {
  return path.join(getLiveInternalRoot(), 'index.json');
}

function getLiveProviderRoot(provider: LiveProvider): string {
  return path.join(getLiveRoot(), provider);
}

function getLiveLockPath(): string {
  return path.join(getLiveInternalRoot(), 'index.lock');
}

function defaultRunnerConfig(): LiveRunnerConfig {
  return {
    mode: 'cargo',
    cargo_project_dir: process.env.KITOWALL_LIVE_RUNNER_PROJECT?.trim() || projectSiblingPath('kitsune-wallpaperengine'),
    bin_name: process.env.KITOWALL_LIVE_RUNNER_BIN?.trim() || 'kitsune-livewallpaper'
  };
}

function defaultIndex(): LiveIndex {
  return {
    version: 1,
    items: [],
    per_monitor: {},
    apply_defaults: {
      profile: 'quality',
      seamless_loop: true,
      loop_crossfade: true,
      loop_crossfade_seconds: 0.35,
      optimize: true,
      proxy_fps: 60,
      proxy_crf_hd: 18,
      proxy_crf_4k: 16
    },
    runner: defaultRunnerConfig()
  };
}

function ensureIndexShape(index: Partial<LiveIndex>): LiveIndex {
  const base = defaultIndex();
  const items = Array.isArray(index.items) ? index.items : [];
  return {
    version: 1,
    items: items.filter(v => v && typeof v === 'object') as LiveLibraryItem[],
    per_monitor: (index.per_monitor && typeof index.per_monitor === 'object') ? index.per_monitor : {},
    apply_defaults: {
      ...base.apply_defaults,
      ...(index.apply_defaults ?? {})
    },
    runner: {
      ...base.runner,
      ...(index.runner ?? {})
    }
  };
}

function ensureLiveDirs(): void {
  ensureDir(getLiveRoot());
  ensureDir(getLiveInternalRoot());
  ensureDir(getLiveThumbsRoot());
  ensureDir(getLiveTmpRoot());
  ensureDir(getLivePreviewCacheRoot());
  ensureDir(getLiveProviderRoot('moewalls'));
  ensureDir(getLiveProviderRoot('motionbgs'));
}

function withLiveLock<T>(fn: () => T): T {
  ensureLiveDirs();
  const lock = getLiveLockPath();
  let acquired = false;
  for (let i = 0; i < 200; i++) {
    try {
      fs.mkdirSync(lock);
      acquired = true;
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') throw err;
      try {
        const st = fs.statSync(lock);
        if ((Date.now() - st.mtimeMs) > LIVE_LOCK_STALE_MS) {
          fs.rmSync(lock, {recursive: true, force: true});
        }
      } catch {}
      const until = Date.now() + 20;
      while (Date.now() < until) {}
    }
  }
  if (!acquired) throw new Error('live index is locked by another process');

  try {
    return fn();
  } finally {
    try {
      fs.rmSync(lock, {recursive: true, force: true});
    } catch {}
  }
}

export function liveInit(): {ok: true; root: string; index_path: string} {
  ensureLiveDirs();
  const idxPath = getLiveIndexPath();
  if (!fs.existsSync(idxPath)) {
    writeIndexAtomic(defaultIndex());
  }
  return {ok: true, root: getLiveRoot(), index_path: idxPath};
}

export function readIndex(): LiveIndex {
  ensureLiveDirs();
  const idxPath = getLiveIndexPath();
  if (!fs.existsSync(idxPath)) {
    return defaultIndex();
  }
  try {
    const raw = fs.readFileSync(idxPath, 'utf8');
    return ensureIndexShape(JSON.parse(raw) as Partial<LiveIndex>);
  } catch {
    return defaultIndex();
  }
}

function writeIndexAtomic(index: LiveIndex): void {
  ensureLiveDirs();
  const idxPath = getLiveIndexPath();
  const tmp = path.join(getLiveTmpRoot(), `index.${process.pid}.${Date.now()}.tmp.json`);
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2), 'utf8');
  fs.renameSync(tmp, idxPath);
}

function upsertItem(index: LiveIndex, item: LiveLibraryItem): LiveIndex {
  const next = index.items.filter(v => v.id !== item.id);
  next.push(item);
  next.sort((a, b) => b.added_at - a.added_at);
  return {...index, items: next};
}

function removeItem(index: LiveIndex, id: string): LiveIndex {
  return {...index, items: index.items.filter(v => v.id !== id)};
}

export function liveList(opts?: {favorites?: boolean}): {ok: true; root: string; index_path: string; items: LiveLibraryItem[]; count: number} {
  const index = readIndex();
  const items = opts?.favorites ? index.items.filter(v => !!v.favorite) : index.items;
  return {
    ok: true,
    root: getLiveRoot(),
    index_path: getLiveIndexPath(),
    items,
    count: items.length
  };
}

function providerFromUrl(url: string): LiveProvider {
  const u = clean(url).toLowerCase();
  if (u.includes('moewalls.com')) return 'moewalls';
  if (u.includes('motionbgs.com')) return 'motionbgs';
  throw new Error('Unsupported live provider URL. Only moewalls.com and motionbgs.com are supported.');
}

function toAbs(baseUrl: string, href: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

async function fetchHtml(url: string, referer?: string): Promise<string> {
  const buildHeaders = (ua: string): Record<string, string> => ({
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    ...(referer ? {Referer: referer} : {})
  });

  try {
    const res = await fetchWithRetry(url, {
      headers: buildHeaders(LIVE_BROWSER_UA)
    }, {timeoutMs: 20000, retries: 2, backoffMs: 400});
    return await res.text();
  } catch {
    const res = await fetchWithRetry(url, {
      headers: buildHeaders(LIVE_BROWSER_UA_FALLBACK)
    }, {timeoutMs: 20000, retries: 1, backoffMs: 300});
    return await res.text();
  }
}

async function tryFetchHtml(url: string, referer?: string): Promise<string | null> {
  try {
    return await fetchHtml(url, referer);
  } catch {
    return null;
  }
}

interface WpPostItem {
  link?: string;
  title?: {rendered?: string};
  _embedded?: {
    'wp:featuredmedia'?: Array<{source_url?: string}>;
  };
}

async function fetchWpPosts(
  provider: LiveProvider,
  page: number,
  search?: string
): Promise<Array<{url: string; title: string; thumb?: string}>> {
  const domain = provider === 'moewalls' ? 'https://moewalls.com' : 'https://motionbgs.com';
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, Math.floor(page || 1))));
  params.set('per_page', '24');
  params.set('_embed', '1');
  if (clean(search)) params.set('search', clean(search));
  const apiUrl = `${domain}/wp-json/wp/v2/posts?${params.toString()}`;

  const res = await fetchWithRetry(apiUrl, {
    headers: {
      'User-Agent': LIVE_BROWSER_UA,
      Accept: 'application/json,text/plain,*/*',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  }, {timeoutMs: 20000, retries: 2, backoffMs: 400});
  if (!res.ok) return [];
  const posts = await res.json() as WpPostItem[];
  if (!Array.isArray(posts)) return [];

  const out: Array<{url: string; title: string; thumb?: string}> = [];
  for (const p of posts) {
    const url = clean(p.link);
    if (!url) continue;
    const low = url.toLowerCase();
    if (provider === 'moewalls' && !low.includes('live-wallpaper')) continue;
    if (provider === 'moewalls' && (low.includes('/set-live-wallpapers-for-your-desktop-using-free-software/') || low.includes('/set-live-wallpapers/'))) continue;
    if (provider === 'motionbgs' && (low.includes('/page/') || low.includes('/category/') || low.includes('/tag/'))) continue;
    const title = htmlDecode(clean(p.title?.rendered).replace(/<[^>]+>/g, '')) || slugFromPostUrl(url).replace(/-/g, ' ');
    const thumb = clean(p._embedded?.['wp:featuredmedia']?.[0]?.source_url) || undefined;
    out.push({url, title, thumb});
  }
  return out;
}

function extractTitle(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og && clean(og[1])) return htmlDecode(clean(og[1]));
  const t = html.match(/<title>([^<]+)<\/title>/i);
  if (t && clean(t[1])) return htmlDecode(clean(t[1]).replace(/\s*\|\s*[^|]+$/, ''));
  return 'Live Wallpaper';
}

function extractThumb(html: string, pageUrl: string): string | undefined {
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og && clean(og[1])) return toAbs(pageUrl, clean(og[1]));
  const poster = html.match(/<video[^>]+poster\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const posterVal = clean(poster?.[1] || poster?.[2] || poster?.[3] || '');
  if (posterVal) return toAbs(pageUrl, posterVal);
  const img = html.match(/<img[^>]+(?:src|data-src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const imgVal = clean(img?.[1] || img?.[2] || img?.[3] || '');
  if (imgVal) return toAbs(pageUrl, imgVal);
  return undefined;
}

function extractMotionPreview(html: string, pageUrl: string): string | undefined {
  const htmlUnescapedSlashes = html.replace(/\\\//g, '/');
  const fromScriptAny = htmlUnescapedSlashes.match(/(?:https?:\/\/|\/)[^"'\\s<>]+?\.(?:mp4|webm|mov|mkv)[^"'\\s<>]*/i)?.[0];
  const candidates = [
    html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i)?.[1],
    html.match(/<video[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean),
    html.match(/<video[^>]+data-src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean),
    html.match(/<source[^>]+src\s*=\s*(?:"([^"]+\.(?:mp4|webm|mov|mkv)[^"]*)"|'([^']+\.(?:mp4|webm|mov|mkv)[^']*)'|([^\s>]+\.(?:mp4|webm|mov|mkv)[^\s>]*))/i)?.slice(1, 4).find(Boolean),
    html.match(/<source[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean),
    html.match(/["'](https?:\/\/[^"']+\.(?:mp4|webm|mov|mkv)[^"']*)["']/i)?.[1],
    fromScriptAny
  ];
  for (const raw of candidates) {
    const v = clean(raw);
    if (!v) continue;
    return toAbs(pageUrl, v);
  }
  return undefined;
}

function deriveMotionBgsPreviewFromThumb(thumbUrl: string, pageUrl: string): string | undefined {
  const raw = clean(thumbUrl);
  if (!raw) return undefined;
  try {
    const abs = toAbs(pageUrl, raw);
    const u = new URL(abs);
    if (!/(\.|^)motionbgs\.com$/i.test(u.hostname)) return undefined;
    // Supports both:
    // - /media/<id>/<slug>.3840x2160.jpg
    // - /i/c/960x540/media/<id>/<slug>.3840x2160.jpg
    const m = u.pathname.match(/\/media\/(\d+)\/([^/?#]+?)(?:\.\d+x\d+)?\.(?:jpg|jpeg|png|webp|gif)$/i);
    if (!m) return undefined;
    const mediaId = clean(m[1]);
    const base = clean(m[2]);
    if (!mediaId || !base) return undefined;
    return `${u.origin}/media/${mediaId}/${base}.960x540.mp4`;
  } catch {
    return undefined;
  }
}

function extractTags(html: string): string[] {
  const out: string[] = [];

  const relTag = /<a[^>]+rel=["'][^"']*tag[^"']*["'][^>]*>([^<]+)<\/a>/gi;
  let m: RegExpExecArray | null = null;
  while ((m = relTag.exec(html)) !== null) {
    const t = htmlDecode(clean(m[1]));
    if (t) out.push(t);
  }

  const dataTag = /<(?:a|span)[^>]+(?:class=["'][^"']*(?:tag|badge)[^"']*["'])[^>]*>([^<]+)<\/(?:a|span)>/gi;
  while ((m = dataTag.exec(html)) !== null) {
    const t = htmlDecode(clean(m[1]));
    if (t && t.length <= 40) out.push(t);
  }

  return Array.from(new Set(out)).slice(0, 12);
}

function slugFromPostUrl(postUrl: string): string {
  try {
    const u = new URL(postUrl);
    const bits = u.pathname.split('/').map(v => v.trim()).filter(Boolean);
    const last = bits[bits.length - 1] || 'live-wallpaper';
    return sanitizeSlug(last);
  } catch {
    return sanitizeSlug(postUrl.split('/').pop() || 'live-wallpaper');
  }
}

function extractLinks(html: string, pageUrl: string): string[] {
  const out: string[] = [];
  const rx = /href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
  let m: RegExpExecArray | null = null;
  while ((m = rx.exec(html)) !== null) {
    const href = clean(m[1] || m[2] || m[3] || '');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    out.push(toAbs(pageUrl, href));
  }
  return Array.from(new Set(out));
}

function isMotionBgsPostUrl(link: string): boolean {
  try {
    const u = new URL(link);
    if (!/(\.|^)motionbgs\.com$/i.test(u.hostname)) return false;
    const parts = u.pathname.split('/').map(v => v.trim()).filter(Boolean);
    if (parts.length !== 1) return false;
    const slug = parts[0].toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) return false;
    if (slug.includes(':')) return false;
    if (/^\d+$/.test(slug)) return false;
    if (slug.length < 3) return false;
    const reserved = new Set([
      '4k',
      'mobile',
      'gifs',
      'search',
      'page',
      'guides',
      'wp-admin',
      'wp-login.php',
      'wp-json',
      'feed'
    ]);
    if (reserved.has(slug)) return false;
    return true;
  } catch {
    return false;
  }
}

function extractMotionBgsCards(html: string, pageUrl: string): Array<{url: string; title: string; thumb?: string}> {
  const out: Array<{url: string; title: string; thumb?: string}> = [];
  const seen = new Set<string>();
  const anchorBlockRx = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let a: RegExpExecArray | null = null;

  while ((a = anchorBlockRx.exec(html)) !== null) {
    const attrs = a[1] || '';
    const block = a[2] || '';
    const hrefRaw = clean(
      attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[1] ||
      attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[2] ||
      attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[3] ||
      ''
    );
    const href = toAbs(pageUrl, hrefRaw);
    if (!href || !isMotionBgsPostUrl(href) || seen.has(href)) continue;

    // MotionBGs post cards use either <span class=ttl>... or <a class=gf_ttl>...
    const titleFromSpan = block.match(/<span[^>]+class\s*=\s*(?:"[^"]*\bttl\b[^"]*"|'[^']*\bttl\b[^']*'|[^\s>]*\bttl\b[^\s>]*)[^>]*>([\s\S]*?)<\/span>/i)?.[1];
    const isGifTitleAnchor = /\bclass\s*=\s*(?:"[^"]*\bgf_ttl\b[^"]*"|'[^']*\bgf_ttl\b[^']*'|[^\s>]*\bgf_ttl\b[^\s>]*)/i.test(attrs);
    const titleFromAnchor = isGifTitleAnchor ? block : '';
    const title = htmlDecode(clean((titleFromSpan || titleFromAnchor || '').replace(/<[^>]+>/g, ' ')));
    if (!title) continue;

    const thumb =
      block.match(/<img[^>]+data-src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean) ||
      block.match(/<img[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean) ||
      block.match(/<source[^>]+srcset\s*=\s*(?:"([^"'\s,]+)"|'([^"'\s,]+)'|([^\s>,]+))/i)?.slice(1, 4).find(Boolean) ||
      block.match(/<video[^>]+poster\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean);

    seen.add(href);
    out.push({
      url: href,
      title,
      thumb: thumb ? toAbs(pageUrl, clean(thumb)) : undefined
    });
  }

  return out;
}

function extractMotionBgsPostUrlsLoose(html: string, pageUrl: string): Array<{url: string; title: string; thumb?: string}> {
  const out: Array<{url: string; title: string; thumb?: string}> = [];
  const seen = new Set<string>();
  const reserved = new Set([
    '4k',
    'mobile',
    'gifs',
    'search',
    'page',
    'guides',
    'feed',
    'tag',
    'category',
    'wp-admin',
    'wp-login.php',
    'wp-json',
    'dl'
  ]);

  const anchorRx = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null = null;
  while ((m = anchorRx.exec(html)) !== null) {
    const attrs = m[1] || '';
    const block = m[2] || '';
    const hrefRaw = clean(
      attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[1]
      || attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[2]
      || attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[3]
      || ''
    );
    if (!hrefRaw) continue;

    const href = toAbs(pageUrl, hrefRaw);
    let slug = '';
    try {
      const u = new URL(href);
      if (!/(\.|^)motionbgs\.com$/i.test(u.hostname)) continue;
      const parts = u.pathname.split('/').map(v => v.trim()).filter(Boolean);
      if (parts.length !== 1) continue;
      slug = clean(parts[0]).toLowerCase();
      if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) continue;
      if (reserved.has(slug) || slug.includes(':') || /^\d+$/.test(slug) || slug.length < 3) continue;
    } catch {
      continue;
    }
    if (seen.has(href)) continue;
    seen.add(href);

    const title =
      htmlDecode(clean(block.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')))
      || slug.replace(/-/g, ' ');
    if (!title) continue;
    out.push({url: href, title});
  }
  return out;
}

function detectVariantsFromLinks(links: string[]): LiveResolvedVariant[] {
  let hd: string | null = null;
  let k4: string | null = null;
  for (const link of links) {
    const low = link.toLowerCase();
    if (!k4 && (low.includes('/dl/4k/') || low.includes('/4k/') || low.includes('=4k'))) {
      k4 = link;
      continue;
    }
    if (!hd && (low.includes('/dl/hd/') || low.includes('/hd/') || low.includes('=hd'))) {
      hd = link;
      continue;
    }
    if (low.endsWith('.mp4')) {
      if (!k4 && (low.includes('2160') || low.includes('3840') || low.includes('4k'))) {
        k4 = link;
        continue;
      }
      if (!hd && (low.includes('1080') || low.includes('1920') || low.includes('hd'))) {
        hd = link;
      }
    }
  }

  const out: LiveResolvedVariant[] = [];
  if (hd) out.push({variant: 'hd', download_url: hd});
  if (k4) out.push({variant: '4k', download_url: k4});
  return out;
}

function detectMotionBgsDlVariantsFromHtml(html: string, pageUrl: string): LiveResolvedVariant[] {
  const out: LiveResolvedVariant[] = [];
  const hd = html.match(/href\s*=\s*(?:"([^"]*\/dl\/hd\/\d+[^"]*)"|'([^']*\/dl\/hd\/\d+[^']*)'|([^\s>]*\/dl\/hd\/\d+[^\s>]*))/i);
  const k4 = html.match(/href\s*=\s*(?:"([^"]*\/dl\/4k\/\d+[^"]*)"|'([^']*\/dl\/4k\/\d+[^']*)'|([^\s>]*\/dl\/4k\/\d+[^\s>]*))/i);
  const hdRaw = clean(hd?.[1] || hd?.[2] || hd?.[3] || '');
  const k4Raw = clean(k4?.[1] || k4?.[2] || k4?.[3] || '');
  if (hdRaw) out.push({variant: 'hd', download_url: toAbs(pageUrl, hdRaw)});
  if (k4Raw) out.push({variant: '4k', download_url: toAbs(pageUrl, k4Raw)});
  return out;
}

function detectMotionBgsDirectVariantsFromHtml(html: string, pageUrl: string): LiveResolvedVariant[] {
  const candidates: string[] = [];
  const push = (v?: string) => {
    const c = clean(v);
    if (c) candidates.push(toAbs(pageUrl, c));
  };

  push(html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]);
  push(html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i)?.[1]);
  push(html.match(/<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i)?.[1]);
  push(html.match(/<video[^>]+poster\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean));
  push(html.match(/<source[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean));

  let mediaId = '';
  let base = '';
  let origin = '';
  for (const c of candidates) {
    try {
      const u = new URL(c);
      const m = u.pathname.match(/\/media\/(\d+)\/([^/?#]+?)(?:\.\d+x\d+)?\.(?:jpg|jpeg|png|webp|gif|mp4|webm)$/i);
      if (!m) continue;
      mediaId = clean(m[1]);
      base = clean(m[2]);
      origin = u.origin;
      if (mediaId && base && origin) break;
    } catch {}
  }
  if (!mediaId || !base || !origin) return [];

  return [
    {variant: 'hd', download_url: `${origin}/media/${mediaId}/${base}.1920x1080.mp4`},
    {variant: '4k', download_url: `${origin}/media/${mediaId}/${base}.3840x2160.mp4`}
  ];
}

function extractMoeDownloadToken(html: string): string | undefined {
  const token =
    html.match(/<a[^>]+id\s*=\s*(?:"moe-download"|'moe-download'|moe-download)[^>]+data-url\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean) ||
    html.match(/data-url\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean);
  const raw = clean(token);
  if (!raw) return undefined;
  return htmlDecode(raw);
}

function inferMoeVariant(html: string): LiveVariant {
  const low = html.toLowerCase();
  if (
    low.includes('/resolution/3840x2160/') ||
    low.includes('/resolution/7680x2160/') ||
    low.includes('3840x2160') ||
    low.includes('7680x2160') ||
    /\b4k\b/i.test(html) ||
    /\b2160p\b/i.test(html)
  ) return '4k';
  return 'hd';
}

export function liveParsePostFromHtml(provider: LiveProvider, pageUrl: string, html: string): LiveResolvedPost {
  const title = extractTitle(html);
  const slug = slugFromPostUrl(pageUrl);
  const links = extractLinks(html, pageUrl);
  const variants = detectVariantsFromLinks(links);
  if (provider === 'motionbgs') {
    // Prefer direct media URLs when present; /dl/* can be unstable under anti-bot flows.
    const direct = detectMotionBgsDirectVariantsFromHtml(html, pageUrl);
    const fromDl = detectMotionBgsDlVariantsFromHtml(html, pageUrl);
    const pick = (variant: LiveVariant): LiveResolvedVariant | undefined =>
      direct.find(v => v.variant === variant)
      || variants.find(v => v.variant === variant)
      || fromDl.find(v => v.variant === variant);
    const hd = pick('hd');
    const k4 = pick('4k');
    variants.length = 0;
    if (hd) variants.push(hd);
    if (k4) variants.push(k4);
  }
  if (provider === 'moewalls' && variants.length === 0) {
    const token = extractMoeDownloadToken(html);
    if (token) {
      const v = inferMoeVariant(html);
      variants.push({
        variant: v,
        download_url: `https://go.moewalls.com/download.php?video=${token}`
      });
    }
  }
  const tags = extractTags(html);
  const thumb_remote = extractThumb(html, pageUrl);
  const preview_motion_remote = extractMotionPreview(html, pageUrl)
    || (provider === 'motionbgs' ? deriveMotionBgsPreviewFromThumb(thumb_remote || '', pageUrl) : undefined);
  return {
    provider,
    title,
    slug,
    page_url: pageUrl,
    variants,
    tags,
    thumb_remote,
    preview_motion_remote
  };
}

function extractPostUrls(provider: LiveProvider, html: string, pageUrl: string): Array<{url: string; title: string; thumb?: string}> {
  if (provider === 'motionbgs') {
    const cards = extractMotionBgsCards(html, pageUrl);
    if (cards.length > 0) return cards;
  }

  const linkThumbMap = new Map<string, string>();
  const anchorBlockRx = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let a: RegExpExecArray | null = null;
  while ((a = anchorBlockRx.exec(html)) !== null) {
    const attrs = a[1] || '';
    const hrefRaw = clean(
      attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[1] ||
      attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[2] ||
      attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[3] ||
      ''
    );
    const href = toAbs(pageUrl, hrefRaw);
    const block = a[2] || '';
    if (!href) continue;
    const imgSrc =
      block.match(/<img[^>]+data-src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean) ||
      block.match(/<img[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean) ||
      block.match(/<img[^>]+srcset\s*=\s*(?:"([^"'\s,]+)"|'([^"'\s,]+)'|([^\s>,]+))/i)?.slice(1, 4).find(Boolean) ||
      block.match(/<video[^>]+poster\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean);
    if (imgSrc && clean(imgSrc)) {
      linkThumbMap.set(href, toAbs(pageUrl, clean(imgSrc)));
    }
  }

  const links = extractLinks(html, pageUrl);
  const out: Array<{url: string; title: string; thumb?: string}> = [];
  const base = provider === 'moewalls' ? 'moewalls.com' : 'motionbgs.com';
  const seen = new Set<string>();

  for (const link of links) {
    const low = link.toLowerCase();
    if (!low.includes(base)) continue;
    if (low.includes('/dl/')) continue;
    if (low.includes('/tag/') || low.includes('/category/') || low.includes('/page/')) continue;
    if (provider === 'moewalls' && low.includes('/set-live-wallpapers-for-your-desktop-using-free-software/')) continue;
    if (provider === 'moewalls' && low.includes('/set-live-wallpapers/')) continue;
    if (provider === 'moewalls' && !low.includes('live-wallpaper')) continue;
    if (provider === 'motionbgs' && (low.includes('/wp-content/') || low.endsWith('.jpg') || low.endsWith('.png') || low.endsWith('.webp'))) continue;
    if (provider === 'motionbgs') {
      if (!isMotionBgsPostUrl(link)) continue;
    }
    const slug = slugFromPostUrl(link);
    if (!slug || slug.length < 3) continue;
    if (seen.has(link)) continue;
    seen.add(link);
    out.push({
      url: link,
      title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      thumb: linkThumbMap.get(link)
    });
  }

  // MotionBGs robust parser for homepage/infinite-feed cards:
  // <div class=tmb><a ... href=/slug>...<span class=ttl>Title</span>...
  if (provider === 'motionbgs' && out.length === 0) {
    const cardRx = /<a\b([^>]*)>[\s\S]*?<span[^>]+class\s*=\s*(?:"[^"]*ttl[^"]*"|'[^']*ttl[^']*'|[^\s>]*ttl[^\s>]*)[^>]*>([^<]+)<\/span>[\s\S]*?<\/a>/gi;
    let m: RegExpExecArray | null = null;
    while ((m = cardRx.exec(html)) !== null) {
      const attrs = m[1] || '';
      const hrefRaw = clean(
        attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[1] ||
        attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[2] ||
        attrs.match(/href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.[3] ||
        ''
      );
      const href = toAbs(pageUrl, hrefRaw);
      if (!isMotionBgsPostUrl(href)) continue;
      if (seen.has(href)) continue;
      seen.add(href);

      const blockStart = Math.max(0, m.index - 300);
      const blockEnd = Math.min(html.length, cardRx.lastIndex + 800);
      const block = html.slice(blockStart, blockEnd);
      const thumb =
        block.match(/<img[^>]+src\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)?.slice(1, 4).find(Boolean) ||
        block.match(/<source[^>]+srcset\s*=\s*(?:"([^"'\s,]+)"|'([^"'\s,]+)'|([^\s>,]+))/i)?.slice(1, 4).find(Boolean);
      out.push({
        url: href,
        title: htmlDecode(clean(m[2])) || slugFromPostUrl(href).replace(/-/g, ' '),
        thumb: thumb ? toAbs(pageUrl, clean(thumb)) : undefined
      });
    }
  }
  if (provider === 'motionbgs' && out.length === 0) {
    return extractMotionBgsPostUrlsLoose(html, pageUrl);
  }
  return out;
}

export function liveParseBrowseFromHtml(
  provider: LiveProvider,
  html: string,
  pageUrl: string
): Array<{url: string; title: string; thumb?: string}> {
  return extractPostUrls(provider, html, pageUrl);
}

function resolutionForVariant(variant: LiveVariant): {w: number; h: number} {
  return variant === '4k' ? {w: 3840, h: 2160} : {w: 1920, h: 1080};
}

function itemId(provider: LiveProvider, slug: string, variant: LiveVariant): string {
  return `${provider}:${slug}:${variant}`;
}

async function resolvePost(provider: LiveProvider, pageUrl: string): Promise<LiveResolvedPost> {
  const html = await fetchHtml(pageUrl, pageUrl);
  const parsed = liveParsePostFromHtml(provider, pageUrl, html);
  const variants = parsed.variants;
  if (variants.length === 0) {
    throw new Error(`No HD/4K download variants found in ${pageUrl}`);
  }
  return parsed;
}

function chooseQualityForMonitor(preferred: LiveQuality, monitor?: {width: number; height: number}): LiveVariant {
  if (preferred === '4k') return '4k';
  if (preferred === 'hd') return 'hd';
  const width = monitor?.width ?? 0;
  const height = monitor?.height ?? 0;
  if (width >= 3200 || height >= 2000) return '4k';
  return 'hd';
}

async function getMonitorMap(): Promise<Record<string, {width: number; height: number}>> {
  try {
    const out = await run('hyprctl', ['monitors', '-j'], {timeoutMs: 5000});
    const parsed = JSON.parse(out.stdout) as Array<{name?: string; width?: number; height?: number}>;
    const map: Record<string, {width: number; height: number}> = {};
    for (const m of parsed) {
      const name = clean(m.name);
      if (!name) continue;
      const w = Number(m.width) || 0;
      const h = Number(m.height) || 0;
      map[name] = {width: w, height: h};
    }
    return map;
  } catch {
    return {};
  }
}

function variantFallback(requested: LiveVariant, available: LiveVariant[]): LiveVariant {
  if (available.includes(requested)) return requested;
  if (requested === '4k' && available.includes('hd')) return 'hd';
  if (requested === 'hd' && available.includes('4k')) return '4k';
  return available[0] || 'hd';
}

async function downloadToFile(downloadUrl: string, pageUrl: string, dstFile: string): Promise<number> {
  ensureDir(path.dirname(dstFile));
  const tmpFile = path.join(getLiveTmpRoot(), `${path.basename(dstFile)}.${Date.now()}.part`);
  const res = await fetchWithRetry(downloadUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': LIVE_BROWSER_UA,
      Accept: '*/*',
      Referer: pageUrl
    }
  }, {timeoutMs: 30000, retries: 2, backoffMs: 600});

  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  const ct = clean(res.headers.get('content-type')).toLowerCase();
  const finalUrl = clean(res.url).toLowerCase();
  const looksVideoType = ct.startsWith('video/') || ct.includes('application/octet-stream');
  const looksVideoUrl = finalUrl.includes('.mp4') || finalUrl.includes('.webm') || finalUrl.includes('.mov') || finalUrl.includes('.mkv');
  const looksHtml = ct.startsWith('text/html') || ct.includes('application/xhtml+xml');
  if (looksHtml || (!looksVideoType && !looksVideoUrl)) {
    throw new Error(`Unexpected content-type for video download: ${ct || 'unknown'}`);
  }

  const body = res.body;
  if (!body) throw new Error('Download response has empty body');
  await pipeline(Readable.fromWeb(body as never), fs.createWriteStream(tmpFile));

  const st = fs.statSync(tmpFile);
  if (st.size < LIVE_DOWNLOAD_MIN_BYTES) {
    fs.rmSync(tmpFile, {force: true});
    throw new Error(`Downloaded file is too small (${st.size} bytes)`);
  }

  fs.renameSync(tmpFile, dstFile);
  return st.size;
}

async function downloadPreviewToFile(downloadUrl: string, pageUrl: string, dstFile: string): Promise<number> {
  ensureDir(path.dirname(dstFile));
  const tmpFile = path.join(getLiveTmpRoot(), `${path.basename(dstFile)}.${Date.now()}.part`);
  const res = await fetchWithRetry(downloadUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': LIVE_BROWSER_UA,
      Accept: '*/*',
      Referer: pageUrl
    }
  }, {timeoutMs: 30000, retries: 2, backoffMs: 600});

  if (!res.ok) {
    throw new Error(`Preview download failed: HTTP ${res.status}`);
  }

  const ct = clean(res.headers.get('content-type')).toLowerCase();
  const finalUrl = clean(res.url).toLowerCase();
  const looksVideoType = ct.startsWith('video/') || ct.includes('application/octet-stream');
  const looksVideoUrl = finalUrl.includes('.mp4') || finalUrl.includes('.webm') || finalUrl.includes('.mov') || finalUrl.includes('.mkv');
  const looksHtml = ct.startsWith('text/html') || ct.includes('application/xhtml+xml');
  if (looksHtml || (!looksVideoType && !looksVideoUrl)) {
    throw new Error(`Unexpected content-type for preview download: ${ct || 'unknown'}`);
  }

  const body = res.body;
  if (!body) throw new Error('Preview response has empty body');
  await pipeline(Readable.fromWeb(body as never), fs.createWriteStream(tmpFile));

  const st = fs.statSync(tmpFile);
  if (st.size < LIVE_PREVIEW_MIN_BYTES) {
    fs.rmSync(tmpFile, {force: true});
    throw new Error(`Preview file too small (${st.size} bytes)`);
  }

  fs.renameSync(tmpFile, dstFile);
  return st.size;
}

async function generateThumb(filePath: string, itemIdValue: string): Promise<string> {
  const png = path.join(getLiveThumbsRoot(), `${itemIdValue.replace(/[:]/g, '_')}.png`);
  const jpg = path.join(getLiveThumbsRoot(), `${itemIdValue.replace(/[:]/g, '_')}.jpg`);
  let seekSec = 5;
  try {
    const probe = await run('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ], {timeoutMs: 8000});
    const parsed = Number(String(probe.stdout ?? '').trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      // Pick a frame away from fade-in/black intro and clamp to safe range.
      seekSec = Math.max(1.5, Math.min(10, parsed * 0.35));
    }
  } catch {}
  try {
    await run('ffmpeg', [
      '-y',
      '-i', filePath,
      '-ss', seekSec.toFixed(3),
      '-frames:v', '1',
      '-update', '1',
      '-vf', 'scale=480:-1',
      png
    ], {timeoutMs: 20000});
    if (fs.existsSync(png)) return png;
  } catch {}
  await run('ffmpeg', [
    '-y',
    '-i', filePath,
    '-ss', seekSec.toFixed(3),
    '-frames:v', '1',
    '-update', '1',
    '-vf', 'scale=480:-1',
    jpg
  ], {timeoutMs: 20000});
  return jpg;
}

function parseId(id: string): {provider: LiveProvider; slug: string; variant: LiveVariant} {
  const bits = clean(id).split(':');
  if (bits.length !== 3) throw new Error(`Invalid live id: ${id}`);
  const provider = bits[0] as LiveProvider;
  if (provider !== 'moewalls' && provider !== 'motionbgs') throw new Error(`Invalid provider in id: ${id}`);
  const slug = sanitizeSlug(bits[1]);
  const variant = bits[2] as LiveVariant;
  if (variant !== 'hd' && variant !== '4k') throw new Error(`Invalid variant in id: ${id}`);
  return {provider, slug, variant};
}

async function buildApplyCommand(
  index: LiveIndex,
  item: LiveLibraryItem,
  monitor: string
): Promise<{cmd: string; args: string[]; cwd?: string}> {
  const defs = index.apply_defaults;
  const proxyWidth = item.variant === '4k' ? 3840 : 1920;
  const proxyCrf = item.variant === '4k' ? defs.proxy_crf_4k : defs.proxy_crf_hd;
  const bool = (v: boolean) => (v ? 'true' : 'false');
  const args = [
    'video-play',
    item.file_path,
    '--monitor', monitor,
    '--profile', defs.profile,
    '--seamless-loop', bool(defs.seamless_loop),
    '--loop-crossfade', bool(defs.loop_crossfade),
    '--loop-crossfade-seconds', String(defs.loop_crossfade_seconds),
    '--optimize', bool(defs.optimize),
    '--proxy-width', String(proxyWidth),
    '--proxy-fps', String(defs.proxy_fps),
    '--proxy-crf', String(proxyCrf)
  ];

  if (index.runner.mode === 'bin') {
    return {cmd: index.runner.bin_name, args};
  }

  return {
    cmd: 'cargo',
    args: ['run', '--', ...args],
    cwd: index.runner.cargo_project_dir
  };
}

export async function liveResolve(pageUrl: string): Promise<{ok: true; post: LiveResolvedPost}> {
  const provider = providerFromUrl(pageUrl);
  const post = await resolvePost(provider, pageUrl);
  return {ok: true, post};
}

function previewExtensionFromUrl(urlValue: string): string {
  const lower = clean(urlValue).toLowerCase();
  if (lower.includes('.webm')) return '.webm';
  if (lower.includes('.mov')) return '.mov';
  if (lower.includes('.mkv')) return '.mkv';
  return '.mp4';
}

function previewWebmPath(provider: LiveProvider, slug: string): string {
  return path.join(getLivePreviewCacheRoot(), `${provider}_${slug}.webm`);
}

function previewMp4CompatPath(provider: LiveProvider, slug: string): string {
  return path.join(getLivePreviewCacheRoot(), `${provider}_${slug}.compat-v3.mp4`);
}

async function ensurePreviewPlaybackCompat(
  provider: LiveProvider,
  slug: string,
  sourcePath: string
): Promise<string> {
  const ext = path.extname(sourcePath).toLowerCase();
  if (provider === 'moewalls' && ext === '.webm') {
    const mp4Path = previewMp4CompatPath(provider, slug);
    if (fs.existsSync(mp4Path)) {
      try {
        const st = fs.statSync(mp4Path);
        if (st.size >= LIVE_PREVIEW_MIN_BYTES) return mp4Path;
      } catch {}
    }
    // Transcode to H.264 (no remux) for stable playback in WebKitGTK.
    try {
      await run('ffmpeg', [
        '-y',
        '-fflags', '+genpts',
        '-i', sourcePath,
        '-map', '0:v:0',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '19',
        '-tune', 'fastdecode',
        '-profile:v', 'high',
        '-level:v', '4.1',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-g', '15',
        '-keyint_min', '15',
        '-bf', '0',
        '-refs', '1',
        '-sc_threshold', '0',
        '-force_key_frames', 'expr:gte(t,n_forced*0.5)',
        '-vsync', 'cfr',
        '-pix_fmt', 'yuv420p',
        '-colorspace', 'bt709',
        '-color_primaries', 'bt709',
        '-color_trc', 'bt709',
        '-movflags', '+faststart',
        mp4Path
      ], {timeoutMs: 45000});
      const st = fs.statSync(mp4Path);
      if (st.size >= LIVE_PREVIEW_MIN_BYTES) return mp4Path;
    } catch {}
    return sourcePath;
  }

  if (provider !== 'motionbgs' || ext === '.webm') return sourcePath;

  const webmPath = previewWebmPath(provider, slug);
  if (fs.existsSync(webmPath)) {
    try {
      const st = fs.statSync(webmPath);
      if (st.size >= LIVE_PREVIEW_MIN_BYTES) return webmPath;
    } catch {}
  }

  const encodes: string[][] = [
    ['-c:v', 'libvpx-vp9', '-crf', '38', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '8'],
    ['-c:v', 'libvpx', '-crf', '24', '-b:v', '1M', '-deadline', 'realtime', '-cpu-used', '8']
  ];

  for (const args of encodes) {
    try {
      await run('ffmpeg', [
        '-y',
        '-i', sourcePath,
        '-an',
        ...args,
        webmPath
      ], {timeoutMs: 45000});
      const st = fs.statSync(webmPath);
      if (st.size >= LIVE_PREVIEW_MIN_BYTES) return webmPath;
    } catch {}
  }

  return sourcePath;
}

export async function livePreview(pageUrl: string): Promise<{
  ok: true;
  provider: LiveProvider;
  page_url: string;
  slug: string;
  motion_available: boolean;
  remote_url?: string;
  local_path?: string;
  size_bytes?: number;
}> {
  const provider = providerFromUrl(pageUrl);
  const post = await resolvePost(provider, pageUrl);
  const remote = clean(post.preview_motion_remote)
    || (provider === 'motionbgs' ? clean(deriveMotionBgsPreviewFromThumb(post.thumb_remote || '', post.page_url) || '') : '');
  if (!remote) {
    return {
      ok: true,
      provider,
      page_url: post.page_url,
      slug: post.slug,
      motion_available: false
    };
  }

  const ext = previewExtensionFromUrl(remote);
  const localPath = path.join(getLivePreviewCacheRoot(), `${provider}_${post.slug}${ext}`);
  if (fs.existsSync(localPath)) {
    const st = fs.statSync(localPath);
    if (st.size >= LIVE_PREVIEW_MIN_BYTES) {
      const playablePath = await ensurePreviewPlaybackCompat(provider, post.slug, localPath);
      const playableSize = fs.existsSync(playablePath) ? fs.statSync(playablePath).size : st.size;
      return {
        ok: true,
        provider,
        page_url: post.page_url,
        slug: post.slug,
        motion_available: true,
        remote_url: remote,
        local_path: playablePath,
        size_bytes: playableSize
      };
    }
  }

  const size = await downloadPreviewToFile(remote, post.page_url, localPath);
  const playablePath = await ensurePreviewPlaybackCompat(provider, post.slug, localPath);
  const playableSize = fs.existsSync(playablePath) ? fs.statSync(playablePath).size : size;
  return {
    ok: true,
    provider,
    page_url: post.page_url,
    slug: post.slug,
    motion_available: true,
    remote_url: remote,
    local_path: playablePath,
    size_bytes: playableSize
  };
}

export async function livePreviewClear(pageUrl: string): Promise<{
  ok: true;
  provider: LiveProvider;
  page_url: string;
  slug: string;
  removed: string[];
}> {
  const url = clean(pageUrl);
  if (!url) throw new Error('url is required');
  const provider = providerFromUrl(url);
  const slug = slugFromPostUrl(url);
  const prefix = `${provider}_${slug}`;
  const removed: string[] = [];
  try {
    const dir = getLivePreviewCacheRoot();
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.startsWith(prefix)) continue;
      const full = path.join(dir, file);
      try {
        fs.rmSync(full, {force: true});
        removed.push(full);
      } catch {}
    }
  } catch {}
  return {
    ok: true,
    provider,
    page_url: url,
    slug,
    removed
  };
}

async function providerBrowsePage(provider: LiveProvider, page: number, quality: '4k' | 'all'): Promise<LiveBrowseItem[]> {
  const p = Math.max(1, Math.floor(page || 1));
  const listUrls = provider === 'moewalls'
    ? [p === 1 ? 'https://moewalls.com/' : `https://moewalls.com/page/${p}/`]
    : [
      p === 1 ? 'https://motionbgs.com/' : `https://motionbgs.com/${p}/`,
      p === 1 ? 'https://motionbgs.com/' : `https://motionbgs.com/hx2/latest/${p}/`,
      p === 1 ? 'https://motionbgs.com/' : `https://motionbgs.com/hx/latest/${p}/`
    ];

  let candidates: Array<{url: string; title: string; thumb?: string}> = [];
  if (provider === 'motionbgs') {
    try {
      candidates = await fetchWpPosts(provider, p);
    } catch {
      candidates = [];
    }
  }
  for (const listUrl of listUrls) {
    if (candidates.length > 0) break;
    const html = await tryFetchHtml(listUrl, listUrl);
    if (!html) continue;
    candidates = extractPostUrls(provider, html, listUrl).slice(0, 36);
    if (candidates.length > 0) break;
  }
  if (provider === 'motionbgs' && candidates.length === 0) {
    try {
      candidates = await fetchWpPosts(provider, p);
    } catch {
      candidates = [];
    }
  }
  if (provider === 'motionbgs' && candidates.length === 0) {
    const homeHtml = await tryFetchHtml('https://motionbgs.com/', 'https://motionbgs.com/');
    if (homeHtml) {
      candidates = extractPostUrls(provider, homeHtml, 'https://motionbgs.com/').slice(0, 36);
    }
  }
  const out: LiveBrowseItem[] = [];
  const titleLooks4k = (v: string): boolean => /(?:^|\s|\()4k(?:\s|\)|$)/i.test(v);
  for (const c of candidates) {
    // Keep browse fast: do not resolve every post here.
    // Full resolve (variants/tags/preview video) happens when user opens details or fetches.
    const has4k = titleLooks4k(c.title);
    const hasHd = true;
    if (quality === '4k' && !has4k) continue;
    out.push({
      provider,
      title: c.title,
      page_url: c.url,
      slug: slugFromPostUrl(c.url),
      has_hd: hasHd,
      has_4k: has4k,
      thumb_remote: c.thumb,
      tags: [],
      preview_motion_remote: undefined
    });
  }
  return out;
}

export async function liveBrowse(opts?: {
  page?: number;
  quality?: '4k' | 'all';
  provider?: 'all' | LiveProvider;
}): Promise<{ok: true; page: number; quality: '4k' | 'all'; items: LiveBrowseItem[]; count: number}> {
  const page = Math.max(1, Math.floor(opts?.page || 1));
  const quality = opts?.quality === '4k' ? '4k' : 'all';
  const provider = opts?.provider || 'all';
  const providers: LiveProvider[] = provider === 'all' ? ['moewalls', 'motionbgs'] : [provider];
  const items: LiveBrowseItem[] = [];
  for (const p of providers) {
    const part = await providerBrowsePage(p, page, quality);
    items.push(...part);
  }
  return {ok: true, page, quality, items, count: items.length};
}

export async function liveSearch(query: string, opts?: {
  page?: number;
  limit?: number;
  provider?: 'all' | LiveProvider;
}): Promise<{ok: true; query: string; page: number; items: LiveBrowseItem[]; count: number}> {
  const q = clean(query);
  if (!q) throw new Error('query is required');
  const page = Math.max(1, Math.floor(opts?.page || 1));
  const limit = Math.max(1, Math.min(50, Math.floor(opts?.limit || 20)));
  const provider = opts?.provider || 'all';
  const providers: LiveProvider[] = provider === 'all' ? ['moewalls', 'motionbgs'] : [provider];
  const tagSlug = q
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const items: LiveBrowseItem[] = [];
  const qLower = q.toLowerCase();
  for (const p of providers) {
    const searchUrl = p === 'moewalls'
      ? (page <= 1
        ? `https://moewalls.com/?s=${encodeURIComponent(q)}`
        : `https://moewalls.com/page/${page}/?s=${encodeURIComponent(q)}`)
      : `https://motionbgs.com/?s=${encodeURIComponent(q)}`;
    let candidates: Array<{url: string; title: string; thumb?: string}> = [];
    let usedTagRoute = false;
    if (p === 'motionbgs' && tagSlug) {
      // MotionBGs search works best on tag routes (e.g. /tag:sword-art-online/).
      const tagUrl = `https://motionbgs.com/tag:${encodeURIComponent(tagSlug)}/`;
      const tagHtml = await tryFetchHtml(tagUrl, tagUrl);
      if (tagHtml) {
        candidates = extractPostUrls(p, tagHtml, tagUrl).slice(0, limit);
        usedTagRoute = candidates.length > 0;
      }
    }
    if (p === 'motionbgs' && candidates.length === 0) {
      try {
        candidates = await fetchWpPosts(p, page, q);
      } catch {
        candidates = [];
      }
    }
    if (candidates.length === 0) {
      const html = await tryFetchHtml(searchUrl, searchUrl);
      candidates = html ? extractPostUrls(p, html, searchUrl).slice(0, limit) : [];
    }
    if (p === 'motionbgs' && candidates.length === 0) {
      try {
        const home = await tryFetchHtml('https://motionbgs.com/', 'https://motionbgs.com/');
        if (home) {
          candidates = extractPostUrls(p, home, 'https://motionbgs.com/')
            .filter(c => `${c.title} ${c.url}`.toLowerCase().includes(qLower))
            .slice(0, limit);
        }
      } catch {
        candidates = [];
      }
    }
    for (const c of candidates) {
      const words = `${c.title} ${c.url}`.toLowerCase();
      if (!usedTagRoute && !words.includes(qLower)) continue;
      // Keep search fast; full resolve is deferred to details/fetch.
      const has4k = /(?:^|\s|\()4k(?:\s|\)|$)/i.test(c.title);
      items.push({
        provider: p,
        title: c.title,
        page_url: c.url,
        slug: slugFromPostUrl(c.url),
        has_hd: true,
        has_4k: has4k,
        thumb_remote: c.thumb,
        tags: [],
        preview_motion_remote: undefined
      });
    }
  }
  const finalItems = provider === 'all' ? items : items.slice(0, limit);
  return {ok: true, query: q, page, items: finalItems, count: finalItems.length};
}

export async function liveFetch(opts: {
  url: string;
  quality?: LiveQuality;
  monitor?: string;
  apply?: boolean;
}): Promise<{ok: true; item: LiveLibraryItem; reused: boolean; applied: boolean}> {
  const pageUrl = clean(opts.url);
  if (!pageUrl) throw new Error('url is required');
  const provider = providerFromUrl(pageUrl);
  const quality = opts.quality || 'auto';
  const monitor = clean(opts.monitor);
  const post = await resolvePost(provider, pageUrl);
  const available = post.variants.map(v => v.variant);
  const monitorMap = await getMonitorMap();
  const wanted = chooseQualityForMonitor(quality, monitor ? monitorMap[monitor] : undefined);
  const selectedVariant = variantFallback(wanted, available);
  const selected = post.variants.find(v => v.variant === selectedVariant);
  if (!selected) throw new Error(`Could not resolve variant ${selectedVariant} for ${pageUrl}`);

  const slug = sanitizeSlug(post.slug);
  const dstDir = path.join(getLiveProviderRoot(provider), slug);
  ensureDir(dstDir);
  const filePath = path.join(dstDir, `${slug}__${selected.variant}.mp4`);
  let reused = false;
  let sizeBytes = 0;
  if (fs.existsSync(filePath)) {
    const st = fs.statSync(filePath);
    if (st.size >= LIVE_DOWNLOAD_MIN_BYTES) {
      reused = true;
      sizeBytes = st.size;
    }
  }
  if (!reused) {
    sizeBytes = await downloadToFile(selected.download_url, post.page_url, filePath);
  }

  const id = itemId(provider, slug, selected.variant);
  const thumbPath = await generateThumb(filePath, id);
  const item: LiveLibraryItem = {
    id,
    provider,
    title: post.title,
    slug,
    page_url: post.page_url,
    variant: selected.variant,
    resolution: resolutionForVariant(selected.variant),
    file_path: filePath,
    thumb_path: thumbPath,
    size_bytes: sizeBytes,
    favorite: false,
    added_at: nowUnix(),
    last_applied_at: 0
  };

  withLiveLock(() => {
    const current = readIndex();
    const prev = current.items.find(v => v.id === item.id);
    const next: LiveLibraryItem = prev ? {...item, favorite: prev.favorite, added_at: prev.added_at || item.added_at, last_applied_at: prev.last_applied_at || 0} : item;
    const updated = upsertItem(current, next);
    writeIndexAtomic(updated);
    return true;
  });

  let applied = false;
  if (opts.apply && monitor) {
    await liveApply({id: item.id, monitor, quality});
    applied = true;
  }

  return {ok: true, item, reused, applied};
}

export async function liveApply(opts: {
  id: string;
  monitor: string;
  quality?: LiveQuality;
}): Promise<{ok: true; id: string; monitor: string; runner: RunnerMode; command: string; args: string[]}> {
  const idRaw = clean(opts.id);
  const monitor = clean(opts.monitor);
  if (!idRaw) throw new Error('id is required');
  if (!monitor) throw new Error('monitor is required');
  const quality = opts.quality || 'auto';

  const parsed = parseId(idRaw);
  const index = readIndex();
  const siblings = index.items.filter(v => v.provider === parsed.provider && v.slug === parsed.slug);
  if (siblings.length === 0) throw new Error(`Live item not found: ${idRaw}`);

  const monitorMap = await getMonitorMap();
  const preferred = chooseQualityForMonitor(quality, monitorMap[monitor]);
  const available = siblings.map(v => v.variant);
  const variant = variantFallback(preferred, available);
  const item = siblings.find(v => v.variant === variant) || siblings[0];
  if (!item || !fs.existsSync(item.file_path)) {
    throw new Error(`Live file not found for ${idRaw}. Re-download it with live fetch.`);
  }

  try {
    await run('dd', [`if=${item.file_path}`, 'of=/dev/null', 'bs=4M', 'count=8'], {timeoutMs: 5000});
  } catch {}

  const runner = await buildApplyCommand(index, item, monitor);
  await run(runner.cmd, runner.args, {cwd: runner.cwd, timeoutMs: 120000});

  withLiveLock(() => {
    const current = readIndex();
    const updatedItems = current.items.map(v => (v.id === item.id ? {...v, last_applied_at: nowUnix()} : v));
    const perMonitor = {...current.per_monitor};
    const currentMon = perMonitor[monitor] || {
      auto_apply: false,
      preferred_quality: 'auto' as LiveQuality,
      last_applied_id: null
    };
    perMonitor[monitor] = {
      ...currentMon,
      last_applied_id: item.id
    };
    writeIndexAtomic({...current, items: updatedItems, per_monitor: perMonitor});
    return true;
  });

  return {
    ok: true,
    id: item.id,
    monitor,
    runner: index.runner.mode,
    command: runner.cmd,
    args: runner.args
  };
}

export function liveFavorite(id: string, on: boolean): {ok: true; id: string; favorite: boolean} {
  const itemIdValue = clean(id);
  if (!itemIdValue) throw new Error('id is required');
  return withLiveLock(() => {
    const current = readIndex();
    const exists = current.items.some(v => v.id === itemIdValue);
    if (!exists) throw new Error(`Live item not found: ${itemIdValue}`);
    const items = current.items.map(v => (v.id === itemIdValue ? {...v, favorite: on} : v));
    writeIndexAtomic({...current, items});
    return {ok: true, id: itemIdValue, favorite: on};
  });
}

export function liveRemove(id: string, opts?: {deleteFiles?: boolean}): {ok: true; id: string; removed: boolean; deleted_files: string[]} {
  const itemIdValue = clean(id);
  if (!itemIdValue) throw new Error('id is required');
  return withLiveLock(() => {
    const current = readIndex();
    const item = current.items.find(v => v.id === itemIdValue);
    if (!item) return {ok: true, id: itemIdValue, removed: false, deleted_files: []};
    const deletedFiles: string[] = [];
    if (opts?.deleteFiles) {
      for (const p of [item.file_path, item.thumb_path]) {
        try {
          if (p && fs.existsSync(p)) {
            fs.rmSync(p, {force: true});
            deletedFiles.push(p);
          }
        } catch {}
      }
    }
    const updated = removeItem(current, itemIdValue);
    writeIndexAtomic(updated);
    return {ok: true, id: itemIdValue, removed: true, deleted_files: deletedFiles};
  });
}

export async function liveThumbRegen(opts?: {id?: string; all?: boolean}): Promise<{ok: true; regenerated: number; missing: string[]}> {
  const index = readIndex();
  const target = opts?.all
    ? index.items
    : (opts?.id ? index.items.filter(v => v.id === clean(opts.id)) : []);
  if (!opts?.all && !opts?.id) throw new Error('provide --id or --all');
  let regenerated = 0;
  const missing: string[] = [];
  for (const item of target) {
    if (!fs.existsSync(item.file_path)) {
      missing.push(item.id);
      continue;
    }
    const thumb = await generateThumb(item.file_path, item.id);
    withLiveLock(() => {
      const current = readIndex();
      const items = current.items.map(v => (v.id === item.id ? {...v, thumb_path: thumb} : v));
      writeIndexAtomic({...current, items});
      return true;
    });
    regenerated++;
  }
  return {ok: true, regenerated, missing};
}

export function liveAutoApplySet(monitor: string, quality: LiveQuality): {ok: true; monitor: string; cfg: LiveMonitorConfig} {
  const m = clean(monitor);
  if (!m) throw new Error('monitor is required');
  const q: LiveQuality = (quality === 'hd' || quality === '4k' || quality === 'auto') ? quality : 'auto';
  return withLiveLock(() => {
    const current = readIndex();
    const prev = current.per_monitor[m] || {
      auto_apply: false,
      preferred_quality: 'auto' as LiveQuality,
      last_applied_id: null
    };
    const cfg: LiveMonitorConfig = {...prev, auto_apply: true, preferred_quality: q};
    writeIndexAtomic({...current, per_monitor: {...current.per_monitor, [m]: cfg}});
    return {ok: true, monitor: m, cfg};
  });
}

export function liveAutoApplyUnset(monitor: string): {ok: true; monitor: string; cfg: LiveMonitorConfig} {
  const m = clean(monitor);
  if (!m) throw new Error('monitor is required');
  return withLiveLock(() => {
    const current = readIndex();
    const prev = current.per_monitor[m] || {
      auto_apply: false,
      preferred_quality: 'auto' as LiveQuality,
      last_applied_id: null
    };
    const cfg: LiveMonitorConfig = {...prev, auto_apply: false};
    writeIndexAtomic({...current, per_monitor: {...current.per_monitor, [m]: cfg}});
    return {ok: true, monitor: m, cfg};
  });
}

export async function liveDoctor(): Promise<{
  ok: boolean;
  root: string;
  deps: Record<string, boolean>;
  runner: LiveRunnerConfig;
  fix: string[];
}> {
  const index = readIndex();
  const deps: Record<string, boolean> = {};
  const fix: string[] = [];

  try {
    await run('ffmpeg', ['-version'], {timeoutMs: 4000});
    deps.ffmpeg = true;
  } catch {
    deps.ffmpeg = false;
    fix.push('Install ffmpeg: sudo pacman -S --needed ffmpeg');
  }

  try {
    await run('hyprctl', ['-j', 'monitors'], {timeoutMs: 4000});
    deps.hyprctl = true;
  } catch {
    deps.hyprctl = false;
  }

  if (index.runner.mode === 'cargo') {
    try {
      await run('cargo', ['--version'], {timeoutMs: 4000});
      deps.cargo = true;
    } catch {
      deps.cargo = false;
      fix.push('Install cargo/rustup to use runner.mode=cargo');
    }
    deps.runner_target = fs.existsSync(index.runner.cargo_project_dir);
    if (!deps.runner_target) {
      fix.push(`Set runner.cargo_project_dir to the kitsune-livewallpaper project (current: ${index.runner.cargo_project_dir})`);
    }
  } else {
    try {
      await run('which', [index.runner.bin_name], {timeoutMs: 4000});
      deps.runner_bin = true;
    } catch {
      deps.runner_bin = false;
      fix.push(`Install ${index.runner.bin_name} or switch runner.mode to cargo`);
    }
  }

  return {
    ok: Object.values(deps).every(Boolean) || (deps.hyprctl === false && Object.keys(deps).filter(k => k !== 'hyprctl').every(k => deps[k])),
    root: getLiveRoot(),
    deps,
    runner: index.runner,
    fix
  };
}

export function liveSetRunner(opts: Partial<LiveRunnerConfig>): {ok: true; runner: LiveRunnerConfig} {
  return withLiveLock(() => {
    const current = readIndex();
    const mode = opts.mode === 'bin' ? 'bin' : (opts.mode === 'cargo' ? 'cargo' : current.runner.mode);
    const runner: LiveRunnerConfig = {
      mode,
      cargo_project_dir: clean(opts.cargo_project_dir) || current.runner.cargo_project_dir,
      bin_name: clean(opts.bin_name) || current.runner.bin_name
    };
    writeIndexAtomic({...current, runner});
    return {ok: true, runner};
  });
}

export function liveGetConfig(): {ok: true; root: string; index_path: string; index: LiveIndex} {
  const index = readIndex();
  return {ok: true, root: getLiveRoot(), index_path: getLiveIndexPath(), index};
}

export function liveSetApplyDefaults(opts: Partial<LiveApplyDefaults>): {ok: true; apply_defaults: LiveApplyDefaults} {
  return withLiveLock(() => {
    const current = readIndex();
    const next: LiveApplyDefaults = {...current.apply_defaults};
    if (opts.profile !== undefined) next.profile = opts.profile;
    if (opts.seamless_loop !== undefined) next.seamless_loop = opts.seamless_loop;
    if (opts.loop_crossfade !== undefined) next.loop_crossfade = opts.loop_crossfade;
    if (opts.loop_crossfade_seconds !== undefined) next.loop_crossfade_seconds = opts.loop_crossfade_seconds;
    if (opts.optimize !== undefined) next.optimize = opts.optimize;
    if (opts.proxy_fps !== undefined) next.proxy_fps = opts.proxy_fps;
    if (opts.proxy_crf_hd !== undefined) next.proxy_crf_hd = opts.proxy_crf_hd;
    if (opts.proxy_crf_4k !== undefined) next.proxy_crf_4k = opts.proxy_crf_4k;
    writeIndexAtomic({...current, apply_defaults: next});
    return {ok: true, apply_defaults: next};
  });
}

export function liveOpenFolderPath(id?: string): {ok: true; path: string} {
  if (!id) return {ok: true, path: getLiveRoot()};
  const item = readIndex().items.find(v => v.id === clean(id));
  if (!item) throw new Error(`Live item not found: ${id}`);
  return {ok: true, path: path.dirname(item.file_path)};
}

export function liveViewData(): {ok: true; index: LiveIndex; root: string} {
  return {ok: true, index: readIndex(), root: getLiveRoot()};
}
