<script lang="ts">
  import {convertFileSrc, invoke} from '@tauri-apps/api/core';
import {onDestroy, onMount, tick} from 'svelte';
  import logo from './assets/logo.png';

  type HealthReport = {
    ok: boolean;
    code?: string;
    namespace: string;
    deps: Record<string, boolean>;
    units: Record<string, any>;
    swww: { namespaceQueryOk: boolean; error?: string };
    hints: string[];
  };

  type StatusReport = {
    mode: string;
    pack: string | null;
    outputs: string[];
    last_set: Record<string, string>;
    last_updated: number | null;
  };

  type PackItem = {
    name: string;
    type: string;
    count: number;
  };

  type ListPacksResponse = {
    packs: PackItem[];
  };

  type FolderPacksResponse = {
    folders: string[];
  };

  type SelectPackItem = {
    name: string;
    type: string;
    count?: number;
    hydratable: boolean;
  };

  type ToastItem = {
    id: number;
    text: string;
    kind: 'info' | 'success' | 'error';
  };

  type ActionLogItem = {
    ts: number;
    message: string;
    kind: 'info' | 'success' | 'error';
  };

  type SettingsReport = {
    mode: 'manual' | 'rotate';
    rotation_interval_seconds: number;
    transition: {
      type: string;
      fps: number;
      duration: number;
      angle?: number;
      pos?: string;
    };
  };

  type HistoryEntry = {
    timestamp: number;
    pack: string;
    output: string;
    path: string;
    favorite?: boolean;
  };

  type HistoryReport = {
    entries: HistoryEntry[];
  };

  type TimerStatusReport = {
    ok: boolean;
    timer?: Record<string, string>;
    service?: Record<string, string>;
  };

  type PacksRawResponse = {
    packs?: Record<string, Record<string, unknown>>;
  };

  type WallpaperItem = {
    path: string;
    pack: string;
    fileName: string;
    modifiedMs: number;
  };

  type WallpapersListResponse = {
    ok: boolean;
    root?: string;
    items: WallpaperItem[];
  };

  type UiSystemLogEntry = {
    ts: number;
    level: 'info' | 'warn' | 'error';
    source?: string;
    pack?: string;
    action: string;
    message?: string;
    url?: string;
    status?: number;
    meta?: Record<string, unknown>;
  };

  type SystemLogsResponse = {
    entries: UiSystemLogEntry[];
  };

  type SectionId = 'control' | 'settings' | 'history' | 'library' | 'packs' | 'logs';
  type UiLanguage = 'en' | 'es';

  let namespace = 'kitowall';
  let health: HealthReport | null = null;
  let status: StatusReport | null = null;
  let lastError: string | null = null;
  let toasts: ToastItem[] = [];
  let actionLogs: ActionLogItem[] = [];
  let busy = false;
  let busySettings = false;
  let busyKeys = false;
  let busyHistory = false;
  let busyPacks = false;
  let statusPollTimer: ReturnType<typeof setInterval> | null = null;
  const STATUS_POLL_MS = 3000;
  let packs: SelectPackItem[] = [];
  let selectedPack = 'all';
  let selectedPackInfo: SelectPackItem | null = null;
  let packDropdownOpen = false;
  let packFilter = '';
  let visiblePacks: SelectPackItem[] = [];
  let hydrateCount = 10;
  let showCleanConfirm = false;
  let showHistoryClearConfirm = false;
  let showLogsClearConfirm = false;
  let mobileMenuOpen = false;
  let activeSection: SectionId = 'control';
  const SELECTED_PACK_KEY = 'kitowall:selected-pack';
  const UI_LANG_KEY = 'kitowall:ui-language';
  let uiLanguage: UiLanguage = 'en';
  let toastSeq = 1;
  let settingsMode: 'manual' | 'rotate' = 'manual';
  let settingsInterval = 1800;
  let settingsTransitionType = 'center';
  let settingsTransitionFps = 60;
  let settingsTransitionDuration = 0.7;
  let settingsTransitionAngle = '';
  let settingsTransitionPos = '';
  let timerIntervalValue = 600;
  let timerIntervalUnit: 's' | 'm' | 'h' = 's';
  let wallhavenApiKey = '';
  let unsplashApiKey = '';
  let showWallhavenApiKey = false;
  let showUnsplashApiKey = false;
  let timerStatus: TimerStatusReport | null = null;
  let historyLimit = 120;
  let historyPage = 1;
  let rawHistoryEntries: HistoryEntry[] = [];
  let historyEntries: HistoryEntry[] = [];
  let historyHasMore = false;
  let historyOutputFilter = 'all';
  let historyOutputOptions: string[] = [];
  let favorites: string[] = [];
  let galleryBusy = false;
  let galleryItems: WallpaperItem[] = [];
  let galleryRoot = '';
  let galleryPackFilter = 'all';
  let gallerySearch = '';
  let galleryOnlyFavorites = false;
  let gallerySort: 'newest' | 'oldest' | 'name' = 'newest';
  let galleryVisible = 60;
  let galleryFiltered: WallpaperItem[] = [];
  let galleryHasMore = false;
  const fileSrcCache = new Map<string, string>();
  let systemLogsBusy = false;
  let systemLogs: UiSystemLogEntry[] = [];
  let logsLimit = 200;
  let logsSource = 'all';
  let logsPack = '';
  let logsLevel = 'all';
  let logsQuery = '';
  let packTab: 'wallhaven' | 'unsplash' | 'reddit' | 'generic_json' | 'static_url' | 'local' = 'wallhaven';
  let rawPacksByName: Record<string, Record<string, unknown>> = {};
  let wallhavenPackName = '';
  let wallhavenKeyword = '';
  let wallhavenSubthemes = '';
  let wallhavenPackApiKey = '';
  let wallhavenRatioMode: 'ultrawide' | '16:9' | '16:10' | '4:3' | '5:4' | 'x:x' = '16:9';
  let wallhavenColors = '';
  let wallhavenAtleast = '';
  let wallhavenCustomWidth = '';
  let wallhavenCustomHeight = '';
  let wallhavenSorting = 'random';
  let wallhavenAllowSfw = true;
  let wallhavenAllowSketchy = false;
  let wallhavenAllowNsfw = false;
  let wallhavenCategoryGeneral = true;
  let wallhavenCategoryAnime = true;
  let wallhavenCategoryPeople = true;
  let wallhavenTtlSec = 0;
  let showResolutionModal = false;
  let showColorModal = false;
  let wallhavenCategoriesOpen = false;
  let wallhavenPurityOpen = false;
  let wallhavenCategoriesSelectedLabels: string[] = [];
  let wallhavenPuritySelectedLabels: string[] = [];
  let wallhavenCategoriesCodeValue = '111';
  let wallhavenPurityCodeValue = '100';
  let unsplashPackName = '';
  let unsplashQuery = '';
  let unsplashSubthemes = '';
  let unsplashPackApiKey = '';
  let unsplashOrientation = 'landscape';
  let unsplashContentFilter = 'high';
  let unsplashTopics = '';
  let unsplashCollections = '';
  let unsplashUsername = '';
  let unsplashImageWidth = 1920;
  let unsplashImageHeight = 1080;
  let unsplashImageFit = 'crop';
  let unsplashImageQuality = 85;
  let unsplashTtlSec = 0;
  let redditPackName = '';
  let redditSubreddits = 'wallpapers, animewallpaper';
  let redditSubthemes = '';
  let redditAllowSfw = true;
  let redditMinWidth = 1920;
  let redditMinHeight = 1080;
  let redditRatioW = 16;
  let redditRatioH = 9;
  let redditTtlSec = 0;
  let genericJsonPackName = '';
  let genericJsonEndpoint = '';
  let genericJsonImagePath = '$.hdurl';
  let genericJsonImagePrefix = '';
  let genericJsonPostPath = '';
  let genericJsonPostPrefix = '';
  let genericJsonAuthorNamePath = '';
  let genericJsonAuthorUrlPath = '';
  let genericJsonAuthorUrlPrefix = '';
  let genericJsonDomain = '';
  let genericJsonTtlSec = 0;
  let staticUrlPackName = '';
  let staticUrlSingle = '';
  let staticUrlList = '';
  let staticUrlAuthorName = '';
  let staticUrlAuthorUrl = '';
  let staticUrlDomain = '';
  let staticUrlPostUrl = '';
  let staticUrlDifferentImages = true;
  let staticUrlCount = 2;
  let staticUrlTtlSec = 0;
  let localPackName = '';
  let localPathItems: string[] = ['~/Pictures/Wallpapers/SAO'];
  const wallhavenResByRatio: Record<string, string[]> = {
    ultrawide: ['2560x1080', '3440x1440', '3840x1600'],
    '16:9': ['1280x720', '1600x900', '1920x1080', '2560x1440', '3840x2160'],
    '16:10': ['1280x800', '1600x1000', '1920x1200', '2560x1600', '3840x2400'],
    '4:3': ['1280x960', '1600x1200', '1920x1440', '2560x1920', '3840x2880'],
    '5:4': ['1280x1024', '1600x1280', '1920x1536', '2560x2048', '3840x3072']
  };
  const transitionTypes = [
    'simple',
    'fade',
    'left',
    'right',
    'top',
    'bottom',
    'wipe',
    'wave',
    'grow',
    'center',
    'outer',
    'any',
    'random'
  ];
  const modeOptions = [
    {value: 'manual', label: 'manual'},
    {value: 'rotate', label: 'rotate'}
  ] as const;
  const timerUnitOptions = [
    {value: 's', label: 'seconds (s)'},
    {value: 'm', label: 'minutes (m)'},
    {value: 'h', label: 'hours (h)'}
  ] as const;
  const wallhavenCategoryOptions = [
    {key: 'general', label: 'General'},
    {key: 'anime', label: 'Anime'},
    {key: 'people', label: 'People'}
  ] as const;
  const wallhavenPurityOptions = [
    {key: 'sfw', label: 'SFW'},
    {key: 'sketchy', label: 'Sketchy'},
    {key: 'nsfw', label: 'NSFW'}
  ] as const;
  const wallhavenColorOptions = [
    '660000', '990000', 'cc0000', 'cc3333', 'ea4c88', '993399',
    '663399', '333399', '0066cc', '0099cc', '66cccc', '77cc33',
    '669900', '336600', '666600', '999900', 'cccc33', 'ffff00',
    'ffcc33', 'ff9900', 'ff6600', 'cc6633', '996633', '663300',
    '000000', '999999', 'cccccc', 'ffffff', '424153', ''
  ] as const;
  let gsSelectOpen:
    | 'language'
    | 'mode'
    | 'transition'
    | 'timer'
    | 'wallhavenSorting'
    | 'unsplashOrientation'
    | 'unsplashContentFilter'
    | 'unsplashImageFit'
    | null = null;
  const wallhavenSortingOptions = [
    'random',
    'date_added',
    'views',
    'favorites',
    'toplist',
    'relevance'
  ] as const;
  const unsplashOrientationOptions = ['landscape', 'portrait', 'squarish'] as const;
  const unsplashContentFilterOptions = ['low', 'high'] as const;
  const unsplashImageFitOptions = ['crop', 'clamp', 'facearea'] as const;

  function pushToast(text: string, kind: 'info' | 'success' | 'error' = 'info'): void {
    const id = toastSeq++;
    toasts = [...toasts, {id, text, kind}];
    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
    }, 3200);
  }

  function pushLog(message: string, kind: 'info' | 'success' | 'error' = 'info'): void {
    actionLogs = [{ts: Date.now(), message, kind}, ...actionLogs].slice(0, 40);
  }

  function selectSection(id: SectionId): void {
    activeSection = id;
    mobileMenuOpen = false;
    if (id === 'settings') {
      void loadSettings();
      void loadTimerStatus();
      void loadSourceKeys();
    }
    if (id === 'history') {
      void loadHistorySection();
    }
    if (id === 'library') {
      void loadWallpaperLibrary();
    }
    if (id === 'logs') {
      void loadSystemLogs();
    }
    if (id === 'packs') {
      void loadPacksRaw();
    }
  }

  function isTruthy(value: unknown): boolean {
    return value === true;
  }

  function boolText(value: unknown): string {
    return isTruthy(value) ? 'true' : 'false';
  }

  function tr(en: string, es: string): string {
    return uiLanguage === 'es' ? es : en;
  }

  function setUiLanguage(value: string): void {
    uiLanguage = value === 'es' ? 'es' : 'en';
    try {
      localStorage.setItem(UI_LANG_KEY, uiLanguage);
    } catch {}
  }

  function onUiLanguageChange(e: Event): void {
    const el = e.currentTarget as HTMLSelectElement;
    setUiLanguage(el.value);
  }

  function formatTimestamp(ts: number | null): string {
    if (!ts) return tr('unknown', 'desconocido');
    const locale = uiLanguage === 'es' ? 'es-ES' : 'en-US';
    return new Date(ts).toLocaleString(locale);
  }

  function systemdFieldText(value: unknown): string {
    if (typeof value !== 'string') return tr('No scheduled run', 'Sin ejecucion programada');
    const clean = value.trim();
    if (!clean || clean.toLowerCase() === 'n/a') return tr('No scheduled run', 'Sin ejecucion programada');
    return clean;
  }

  function imageSrc(path?: string): string | null {
    if (!path) return null;
    const cached = fileSrcCache.get(path);
    if (cached) return cached;
    try {
      const src = convertFileSrc(path);
      fileSrcCache.set(path, src);
      return src;
    } catch {
      // Do not cache failed conversion fallback; allow future retries.
      return path;
    }
  }

  function fileUrl(path?: string): string | null {
    if (!path) return null;
    if (path.startsWith('file://')) return path;
    if (!path.startsWith('/')) return null;
    return `file://${encodeURI(path)}`;
  }

  function onGalleryImageError(e: Event, path: string): void {
    const img = e.currentTarget;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallbackApplied === '1') return;
    const fallback = fileUrl(path);
    if (!fallback) return;
    img.dataset.fallbackApplied = '1';
    img.src = fallback;
  }

  function normalizeName(input: string): string {
    return input.trim().toLowerCase().replace(/[\s_]+/g, '-');
  }

  function selectedPackMeta(): SelectPackItem | null {
    if (selectedPack === 'all') return null;
    if (selectedPackInfo && normalizeName(selectedPackInfo.name) === normalizeName(selectedPack)) {
      return selectedPackInfo;
    }
    const key = normalizeName(selectedPack);
    return packs.find(p => normalizeName(p.name) === key) ?? selectedPackInfo;
  }

  function packCapability(meta: SelectPackItem | null): {label: string; cls: string} {
    if (!meta) return {label: 'folder-only', cls: 'warn'};
    if (meta.type === 'folder') return {label: 'folder-only', cls: 'warn'};
    if (meta.type === 'local') return {label: 'local-source', cls: 'ok'};
    return {label: 'hydratable', cls: 'ok'};
  }

  function groupedHistoryEntries(entries: HistoryEntry[]): Array<{output: string; items: HistoryEntry[]}> {
    const byOutput = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      const key = e.output || 'unknown';
      const prev = byOutput.get(key) ?? [];
      prev.push(e);
      byOutput.set(key, prev);
    }
    return Array.from(byOutput.entries())
      .map(([output, items]) => ({
        output,
        items: items.sort((a, b) => b.timestamp - a.timestamp)
      }))
      .sort((a, b) => a.output.localeCompare(b.output));
  }

  function getHistoryOutputCount(entries: HistoryEntry[]): number {
    if (status?.outputs && status.outputs.length > 0) return status.outputs.length;
    const unique = new Set(entries.map(e => e.output || 'unknown'));
    return Math.max(1, unique.size);
  }

  function applyHistoryWindow(): void {
    const sourceEntries = historyOutputFilter === 'all'
      ? rawHistoryEntries
      : rawHistoryEntries.filter(e => (e.output || 'unknown') === historyOutputFilter);

    const perPageTotal = Math.max(1, Math.floor(Number(historyLimit) || 120));
    const outputCount = historyOutputFilter === 'all' ? getHistoryOutputCount(sourceEntries) : 1;
    const perOutputStep = Math.max(1, Math.floor(perPageTotal / outputCount));
    const perOutputMax = perOutputStep * Math.max(1, historyPage);

    const grouped = groupedHistoryEntries(sourceEntries);
    historyHasMore = grouped.some(g => g.items.length > perOutputMax);

    const visible: HistoryEntry[] = [];
    for (const group of grouped) {
      visible.push(...group.items.slice(0, perOutputMax));
    }
    historyEntries = visible;
  }

  function isFavorite(path: string): boolean {
    return favorites.includes(path);
  }

  function galleryPackOptions(): string[] {
    const set = new Set<string>();
    for (const item of galleryItems) {
      if (item.pack && item.pack.trim().length > 0) set.add(item.pack);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }

  function buildGalleryFiltered(itemsInput: WallpaperItem[]): WallpaperItem[] {
    let items = [...itemsInput];
    if (galleryPackFilter !== 'all') {
      items = items.filter(i => i.pack === galleryPackFilter);
    }
    const q = gallerySearch.trim().toLowerCase();
    if (q.length > 0) {
      items = items.filter(i => i.fileName.toLowerCase().includes(q) || i.path.toLowerCase().includes(q));
    }
    if (galleryOnlyFavorites) {
      items = items.filter(i => isFavorite(i.path));
    }
    if (gallerySort === 'newest') {
      items.sort((a, b) => (b.modifiedMs || 0) - (a.modifiedMs || 0));
    } else if (gallerySort === 'oldest') {
      items.sort((a, b) => (a.modifiedMs || 0) - (b.modifiedMs || 0));
    } else {
      items.sort((a, b) => a.fileName.localeCompare(b.fileName));
    }
    return items;
  }

  $: {
    // Keep dependencies explicit so Svelte updates on every filter/state change.
    const _deps = [galleryItems, galleryPackFilter, gallerySearch, galleryOnlyFavorites, gallerySort, galleryVisible, favorites];
    void _deps;
    const all = buildGalleryFiltered(galleryItems);
    galleryFiltered = all.slice(0, Math.max(0, Number(galleryVisible) || 0));
    galleryHasMore = all.length > galleryFiltered.length;
  }

  $: {
    const q = packFilter.trim().toLowerCase();
    visiblePacks = !q
      ? packs
      : packs.filter(p => p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q));
  }

  $: {
    const opts = galleryPackOptions();
    if (galleryPackFilter !== 'all' && !opts.includes(galleryPackFilter)) {
      galleryPackFilter = 'all';
    }
  }

  $: {
    const set = new Set<string>();
    for (const o of (status?.outputs ?? [])) set.add(o);
    for (const e of rawHistoryEntries) set.add(e.output || 'unknown');
    historyOutputOptions = Array.from(set).sort((a, b) => a.localeCompare(b));
    if (historyOutputFilter !== 'all' && !historyOutputOptions.includes(historyOutputFilter)) {
      historyOutputFilter = 'all';
    }
  }

  $: wallhavenCategoriesSelectedLabels = wallhavenCategoryOptions
    .filter(o => (o.key === 'general' && wallhavenCategoryGeneral) || (o.key === 'anime' && wallhavenCategoryAnime) || (o.key === 'people' && wallhavenCategoryPeople))
    .map(o => o.label);

  $: wallhavenPuritySelectedLabels = wallhavenPurityOptions
    .filter(o => (o.key === 'sfw' && wallhavenAllowSfw) || (o.key === 'sketchy' && wallhavenAllowSketchy) || (o.key === 'nsfw' && wallhavenAllowNsfw))
    .map(o => o.label);

  $: wallhavenCategoriesCodeValue = `${wallhavenCategoryGeneral ? '1' : '0'}${wallhavenCategoryAnime ? '1' : '0'}${wallhavenCategoryPeople ? '1' : '0'}`;
  $: wallhavenPurityCodeValue = `${wallhavenAllowSfw ? '1' : '0'}${wallhavenAllowSketchy ? '1' : '0'}${wallhavenAllowNsfw ? '1' : '0'}`;

  function choosePack(name: string, type: string | null = null): void {
    selectedPack = name;
    selectedPackInfo = type
      ? {
        name,
        type,
        hydratable: type !== 'folder' && type !== 'local'
      }
      : null;
    try {
      localStorage.setItem(SELECTED_PACK_KEY, name);
    } catch {}
    packDropdownOpen = false;
  }

  function ensureCommandOk(result: unknown): void {
    if (result && typeof result === 'object' && 'ok' in (result as Record<string, unknown>)) {
      const r = result as Record<string, unknown>;
      if (r.ok === false) {
        const msg = typeof r.error === 'string' ? r.error : 'Command failed';
        const hint = typeof r.hint === 'string' ? ` Hint: ${r.hint}` : '';
        throw new Error(`${msg}${hint}`);
      }
    }
  }

  function onPackFilterInput(e: Event): void {
    const input = e.currentTarget as HTMLInputElement;
    packFilter = input.value;
  }

  function toggleGsSelect(
    id:
      | 'mode'
      | 'transition'
      | 'timer'
      | 'wallhavenSorting'
      | 'unsplashOrientation'
      | 'unsplashContentFilter'
      | 'unsplashImageFit'
  ): void {
    gsSelectOpen = gsSelectOpen === id ? null : id;
  }

  function selectMode(value: 'manual' | 'rotate'): void {
    settingsMode = value;
    gsSelectOpen = null;
  }

  function selectLanguage(value: UiLanguage): void {
    setUiLanguage(value);
    gsSelectOpen = null;
  }

  function selectTransitionType(value: string): void {
    settingsTransitionType = value;
    gsSelectOpen = null;
  }

  function selectTimerUnit(value: 's' | 'm' | 'h'): void {
    timerIntervalUnit = value;
    gsSelectOpen = null;
  }

  function selectWallhavenSorting(value: string): void {
    wallhavenSorting = value;
    gsSelectOpen = null;
  }

  function wallhavenColorStyle(hex: string): string {
    if (!hex) {
      return 'background: linear-gradient(18deg, #ffffff 42%, #ff0000 45%, #ff0000 55%, #ffffff 58%);';
    }
    return `background: #${hex};`;
  }

  function wallhavenCategoriesLabels(): string[] {
    return wallhavenCategoryOptions
      .filter(o => (o.key === 'general' && wallhavenCategoryGeneral) || (o.key === 'anime' && wallhavenCategoryAnime) || (o.key === 'people' && wallhavenCategoryPeople))
      .map(o => o.label);
  }

  function wallhavenPurityLabels(): string[] {
    return wallhavenPurityOptions
      .filter(o => (o.key === 'sfw' && wallhavenAllowSfw) || (o.key === 'sketchy' && wallhavenAllowSketchy) || (o.key === 'nsfw' && wallhavenAllowNsfw))
      .map(o => o.label);
  }

  function applyWallhavenCategoriesCode(code: string): void {
    const c = (code || '').trim();
    if (/^[01]{3}$/.test(c)) {
      wallhavenCategoryGeneral = c[0] === '1';
      wallhavenCategoryAnime = c[1] === '1';
      wallhavenCategoryPeople = c[2] === '1';
    }
  }

  function applyWallhavenPurityCode(code: string): void {
    const c = (code || '').trim();
    if (/^[01]{3}$/.test(c)) {
      wallhavenAllowSfw = c[0] === '1';
      wallhavenAllowSketchy = c[1] === '1';
      wallhavenAllowNsfw = c[2] === '1';
    }
  }

  function toggleWallhavenCategory(key: 'general' | 'anime' | 'people'): void {
    if (key === 'general') wallhavenCategoryGeneral = !wallhavenCategoryGeneral;
    if (key === 'anime') wallhavenCategoryAnime = !wallhavenCategoryAnime;
    if (key === 'people') wallhavenCategoryPeople = !wallhavenCategoryPeople;
  }

  function toggleWallhavenPurity(key: 'sfw' | 'sketchy' | 'nsfw'): void {
    if (key === 'sfw') wallhavenAllowSfw = !wallhavenAllowSfw;
    if (key === 'sketchy') wallhavenAllowSketchy = !wallhavenAllowSketchy;
    if (key === 'nsfw') wallhavenAllowNsfw = !wallhavenAllowNsfw;
  }

  async function runHealth() {
    busy = true;
    lastError = null;
    try {
      health = await invoke<HealthReport>('kitowall_check', {namespace});
    } catch (e) {
      lastError = String(e);
    } finally {
      busy = false;
    }
  }

  async function runStatus() {
    busy = true;
    lastError = null;
    try {
      status = await invoke<StatusReport>('kitowall_status');
    } catch (e) {
      lastError = String(e);
    } finally {
      busy = false;
    }
  }

  async function syncStatus(): Promise<void> {
    try {
      const latest = await invoke<StatusReport>('kitowall_status');
      status = latest;
    } catch (e) {
      lastError = String(e);
    }
  }

  async function runListPacks(): Promise<void> {
    try {
      const [cfg, folders] = await Promise.all([
        invoke<ListPacksResponse>('kitowall_list_packs'),
        invoke<FolderPacksResponse>('kitowall_list_pack_folders')
      ]);
      const map = new Map<string, SelectPackItem>();
      for (const p of (cfg?.packs ?? [])) {
        map.set(normalizeName(p.name), {
          name: p.name,
          type: p.type,
          count: p.count,
          hydratable: p.type !== 'local'
        });
      }
      for (const folder of (folders?.folders ?? [])) {
        const key = normalizeName(folder);
        if (!map.has(key)) {
          map.set(key, {
            name: folder,
            type: 'folder',
            hydratable: false
          });
        }
      }
      packs = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      if (selectedPack !== 'all') {
        const selectedKey = normalizeName(selectedPack);
        const matched = packs.find(p => normalizeName(p.name) === selectedKey);
        if (matched) {
          // Keep user intent even if canonical name casing/source label differs.
          selectedPack = matched.name;
          selectedPackInfo = matched;
          try {
            localStorage.setItem(SELECTED_PACK_KEY, selectedPack);
          } catch {}
        }
      }
    } catch (e) {
      lastError = String(e);
    }
  }

  function packsByType(type: string): Array<{name: string; pack: Record<string, unknown>}> {
    const wanted = String(type || '').trim().toLowerCase();
    return Object.entries(rawPacksByName)
      .filter(([, pack]) => {
        const current = String(pack?.type ?? '').trim().toLowerCase();
        if (wanted === 'unsplash') {
          // Backward-compatibility for older typo in persisted configs.
          return current === 'unsplash' || current === 'unplash';
        }
        return current === wanted;
      })
      .map(([name, pack]) => ({name, pack}))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function loadPacksRaw(): Promise<void> {
    try {
      const data = await invoke<PacksRawResponse>('kitowall_pack_list_raw');
      rawPacksByName = JSON.parse(JSON.stringify(data?.packs ?? {}));
    } catch (e) {
      lastError = String(e);
    }
  }

  async function refreshPacksUiState(): Promise<void> {
    await loadPacksRaw();
    await runListPacks();
    // Force a fresh object identity so lists repaint immediately in current tab.
    await tick();
    rawPacksByName = {...rawPacksByName};
  }

  async function saveWallhavenPack(): Promise<void> {
    busyPacks = true;
    lastError = null;
    try {
      if (!wallhavenPackName.trim()) throw new Error('Wallhaven pack name is required');
      if (!wallhavenKeyword.trim()) throw new Error('Wallhaven keyword is required');
      let atleastValue: string | null = wallhavenAtleast || null;
      let ratiosValue: string | null = null;
      if (wallhavenRatioMode === 'x:x') {
        const w = Math.floor(Number(wallhavenCustomWidth));
        const h = Math.floor(Number(wallhavenCustomHeight));
        if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(h) || h <= 0) {
          throw new Error('Custom width/height must be valid numbers > 0');
        }
        atleastValue = `${w}x${h}`;
        ratiosValue = null;
      } else {
        if (wallhavenRatioMode === 'ultrawide') ratiosValue = '21x9';
        if (wallhavenRatioMode === '16:9') ratiosValue = '16x9';
        if (wallhavenRatioMode === '16:10') ratiosValue = '16x10';
        if (wallhavenRatioMode === '4:3') ratiosValue = '4x3';
        if (wallhavenRatioMode === '5:4') ratiosValue = '5x4';
      }
      const result = await invoke<Record<string, unknown>>('kitowall_pack_upsert_wallhaven', {
        name: wallhavenPackName.trim(),
        keyword: wallhavenKeyword.trim(),
        subthemes: wallhavenSubthemes.trim() || null,
        apiKey: wallhavenPackApiKey.trim() || null,
        categories: wallhavenCategoriesCodeValue,
        purity: wallhavenPurityCodeValue,
        ratios: ratiosValue,
        colors: wallhavenColors.trim() || null,
        atleast: atleastValue,
        sorting: wallhavenSorting || null,
        allowSfw: wallhavenAllowSfw,
        allowSketchy: wallhavenAllowSketchy,
        allowNsfw: wallhavenAllowNsfw,
        categoryGeneral: wallhavenCategoryGeneral,
        categoryAnime: wallhavenCategoryAnime,
        categoryPeople: wallhavenCategoryPeople,
        ttlSec: wallhavenTtlSec > 0 ? Math.floor(wallhavenTtlSec) : null
      });
      ensureCommandOk(result);
      pushToast(`Wallhaven pack saved: ${wallhavenPackName}`, 'success');
      pushLog(`pack upsert wallhaven: ${wallhavenPackName}`, 'success');
      await refreshPacksUiState();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`pack upsert failed: ${String(e)}`, 'error');
    } finally {
      busyPacks = false;
    }
  }

  async function saveUnsplashPack(): Promise<void> {
    busyPacks = true;
    lastError = null;
    try {
      if (!unsplashPackName.trim()) throw new Error('Unsplash pack name is required');
      if (!unsplashQuery.trim()) throw new Error('Unsplash query is required');
      const result = await invoke<Record<string, unknown>>('kitowall_pack_upsert_unsplash', {
        name: unsplashPackName.trim(),
        query: unsplashQuery.trim(),
        subthemes: unsplashSubthemes.trim() || null,
        apiKey: unsplashPackApiKey.trim() || null,
        orientation: unsplashOrientation || null,
        contentFilter: unsplashContentFilter || null,
        topics: unsplashTopics.trim() || null,
        collections: unsplashCollections.trim() || null,
        username: unsplashUsername.trim() || null,
        imageWidth: unsplashImageWidth > 0 ? Math.floor(unsplashImageWidth) : null,
        imageHeight: unsplashImageHeight > 0 ? Math.floor(unsplashImageHeight) : null,
        imageFit: unsplashImageFit || null,
        imageQuality: unsplashImageQuality > 0 ? Math.floor(unsplashImageQuality) : null,
        ttlSec: unsplashTtlSec > 0 ? Math.floor(unsplashTtlSec) : null
      });
      ensureCommandOk(result);
      pushToast(`Unsplash pack saved: ${unsplashPackName}`, 'success');
      pushLog(`pack upsert unsplash: ${unsplashPackName}`, 'success');
      await refreshPacksUiState();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`pack upsert unsplash failed: ${String(e)}`, 'error');
    } finally {
      busyPacks = false;
    }
  }

  async function saveRedditPack(): Promise<void> {
    busyPacks = true;
    lastError = null;
    try {
      if (!redditPackName.trim()) throw new Error('Reddit pack name is required');
      if (!redditSubreddits.trim()) throw new Error('Reddit subreddits is required');
      const result = await invoke<Record<string, unknown>>('kitowall_pack_upsert_reddit', {
        name: redditPackName.trim(),
        subreddits: redditSubreddits.trim(),
        subthemes: redditSubthemes.trim() || null,
        allowSfw: !!redditAllowSfw,
        minWidth: redditMinWidth > 0 ? Math.floor(redditMinWidth) : null,
        minHeight: redditMinHeight > 0 ? Math.floor(redditMinHeight) : null,
        ratioW: redditRatioW > 0 ? Math.floor(redditRatioW) : null,
        ratioH: redditRatioH > 0 ? Math.floor(redditRatioH) : null,
        ttlSec: redditTtlSec > 0 ? Math.floor(redditTtlSec) : null
      });
      ensureCommandOk(result);
      pushToast(`Reddit pack saved: ${redditPackName}`, 'success');
      pushLog(`pack upsert reddit: ${redditPackName}`, 'success');
      await refreshPacksUiState();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`pack upsert reddit failed: ${String(e)}`, 'error');
    } finally {
      busyPacks = false;
    }
  }

  async function saveGenericJsonPack(): Promise<void> {
    busyPacks = true;
    lastError = null;
    try {
      if (!genericJsonPackName.trim()) throw new Error('Generic JSON pack name is required');
      if (!genericJsonEndpoint.trim()) throw new Error('Generic JSON endpoint is required');
      if (!genericJsonImagePath.trim()) throw new Error('Generic JSON imagePath is required');
      const result = await invoke<Record<string, unknown>>('kitowall_pack_upsert_generic_json', {
        name: genericJsonPackName.trim(),
        endpoint: genericJsonEndpoint.trim(),
        imagePath: genericJsonImagePath.trim(),
        imagePrefix: genericJsonImagePrefix.trim() || null,
        postPath: genericJsonPostPath.trim() || null,
        postPrefix: genericJsonPostPrefix.trim() || null,
        authorNamePath: genericJsonAuthorNamePath.trim() || null,
        authorUrlPath: genericJsonAuthorUrlPath.trim() || null,
        authorUrlPrefix: genericJsonAuthorUrlPrefix.trim() || null,
        domain: genericJsonDomain.trim() || null,
        ttlSec: genericJsonTtlSec > 0 ? Math.floor(genericJsonTtlSec) : null
      });
      ensureCommandOk(result);
      pushToast(`Generic JSON pack saved: ${genericJsonPackName}`, 'success');
      pushLog(`pack upsert generic_json: ${genericJsonPackName}`, 'success');
      await refreshPacksUiState();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`pack upsert generic_json failed: ${String(e)}`, 'error');
    } finally {
      busyPacks = false;
    }
  }

  async function saveStaticUrlPack(): Promise<void> {
    busyPacks = true;
    lastError = null;
    try {
      if (!staticUrlPackName.trim()) throw new Error('Static URL pack name is required');
      if (!staticUrlSingle.trim() && !staticUrlList.trim()) {
        throw new Error('Provide at least one URL');
      }
      const normalizedList = staticUrlList
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean)
        .join(',');
      const result = await invoke<Record<string, unknown>>('kitowall_pack_upsert_static_url', {
        name: staticUrlPackName.trim(),
        url: staticUrlSingle.trim() || null,
        urls: normalizedList || null,
        authorName: staticUrlAuthorName.trim() || null,
        authorUrl: staticUrlAuthorUrl.trim() || null,
        domain: staticUrlDomain.trim() || null,
        postUrl: staticUrlPostUrl.trim() || null,
        differentImages: !!staticUrlDifferentImages,
        count: staticUrlCount > 0 ? Math.floor(staticUrlCount) : null,
        ttlSec: staticUrlTtlSec > 0 ? Math.floor(staticUrlTtlSec) : null
      });
      ensureCommandOk(result);
      pushToast(`Static URL pack saved: ${staticUrlPackName}`, 'success');
      pushLog(`pack upsert static_url: ${staticUrlPackName}`, 'success');
      await refreshPacksUiState();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`pack upsert static_url failed: ${String(e)}`, 'error');
    } finally {
      busyPacks = false;
    }
  }

  async function saveLocalPack(): Promise<void> {
    busyPacks = true;
    lastError = null;
    try {
      if (!localPackName.trim()) throw new Error('Local pack name is required');
      if (localPathItems.length === 0) throw new Error('Add at least one folder path');
      const normalizedPaths = localPathItems.join(',');
      const result = await invoke<Record<string, unknown>>('kitowall_pack_upsert_local', {
        name: localPackName.trim(),
        paths: normalizedPaths
      });
      ensureCommandOk(result);
      pushToast(`Local pack saved: ${localPackName}`, 'success');
      pushLog(`pack upsert local: ${localPackName}`, 'success');
      await refreshPacksUiState();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`pack upsert local failed: ${String(e)}`, 'error');
    } finally {
      busyPacks = false;
    }
  }

  function editWallhavenPack(name: string, pack: Record<string, unknown>): void {
    wallhavenPackName = name;
    wallhavenKeyword = String(pack.keyword ?? '');
    const sub = Array.isArray(pack.subthemes) ? pack.subthemes.join(', ') : String(pack.subthemes ?? '');
    wallhavenSubthemes = sub;
    wallhavenPackApiKey = String(pack.apiKey ?? '');
    applyWallhavenCategoriesCode(String(pack.categories ?? ''));
    applyWallhavenPurityCode(String(pack.purity ?? ''));
    const ratioRaw = Array.isArray(pack.ratios) ? String(pack.ratios[0] ?? '') : String(pack.ratios ?? '');
    if (ratioRaw === '21x9') wallhavenRatioMode = 'ultrawide';
    else if (ratioRaw === '16x9') wallhavenRatioMode = '16:9';
    else if (ratioRaw === '16x10') wallhavenRatioMode = '16:10';
    else if (ratioRaw === '4x3') wallhavenRatioMode = '4:3';
    else if (ratioRaw === '5x4') wallhavenRatioMode = '5:4';
    else wallhavenRatioMode = 'x:x';
    wallhavenColors = String(pack.colors ?? '');
    wallhavenAtleast = String(pack.atleast ?? '');
    if (wallhavenAtleast.includes('x')) {
      const [w, h] = wallhavenAtleast.split('x');
      wallhavenCustomWidth = w ?? '';
      wallhavenCustomHeight = h ?? '';
    } else {
      wallhavenCustomWidth = '';
      wallhavenCustomHeight = '';
    }
    wallhavenSorting = String(pack.sorting ?? 'random');
    // Fallback to explicit boolean fields if bit-codes were not present.
    if (!/^[01]{3}$/.test(String(pack.purity ?? ''))) {
      wallhavenAllowSfw = pack.allowSfw !== undefined ? !!pack.allowSfw : true;
      wallhavenAllowSketchy = !!pack.allowSketchy;
      wallhavenAllowNsfw = !!pack.allowNsfw;
    }
    if (!/^[01]{3}$/.test(String(pack.categories ?? ''))) {
      wallhavenCategoryGeneral = pack.categoryGeneral !== undefined ? !!pack.categoryGeneral : true;
      wallhavenCategoryAnime = pack.categoryAnime !== undefined ? !!pack.categoryAnime : true;
      wallhavenCategoryPeople = pack.categoryPeople !== undefined ? !!pack.categoryPeople : true;
    }
    wallhavenTtlSec = typeof pack.ttlSec === 'number' ? Number(pack.ttlSec) : 0;
  }

  function editUnsplashPack(name: string, pack: Record<string, unknown>): void {
    unsplashPackName = name;
    unsplashQuery = String(pack.query ?? '');
    const sub = Array.isArray(pack.subthemes) ? pack.subthemes.join(', ') : String(pack.subthemes ?? '');
    unsplashSubthemes = sub;
    unsplashPackApiKey = String(pack.apiKey ?? '');
    unsplashOrientation = String(pack.orientation ?? 'landscape');
    unsplashContentFilter = String(pack.contentFilter ?? 'high');
    unsplashTopics = String(pack.topics ?? '');
    unsplashCollections = String(pack.collections ?? '');
    unsplashUsername = String(pack.username ?? '');
    unsplashImageWidth = typeof pack.imageWidth === 'number' ? Number(pack.imageWidth) : 1920;
    unsplashImageHeight = typeof pack.imageHeight === 'number' ? Number(pack.imageHeight) : 1080;
    unsplashImageFit = String(pack.imageFit ?? 'crop');
    unsplashImageQuality = typeof pack.imageQuality === 'number' ? Number(pack.imageQuality) : 85;
    unsplashTtlSec = typeof pack.ttlSec === 'number' ? Number(pack.ttlSec) : 0;
  }

  function editRedditPack(name: string, pack: Record<string, unknown>): void {
    redditPackName = name;
    if (Array.isArray(pack.subreddits)) {
      redditSubreddits = pack.subreddits.map(v => String(v)).join(', ');
    } else {
      redditSubreddits = String(pack.subreddits ?? '');
    }
    const sub = Array.isArray(pack.subthemes) ? pack.subthemes.join(', ') : String(pack.subthemes ?? '');
    redditSubthemes = sub;
    redditAllowSfw = pack.allowSfw !== undefined ? !!pack.allowSfw : true;
    redditMinWidth = typeof pack.minWidth === 'number' ? Number(pack.minWidth) : 1920;
    redditMinHeight = typeof pack.minHeight === 'number' ? Number(pack.minHeight) : 1080;
    redditRatioW = typeof pack.ratioW === 'number' ? Number(pack.ratioW) : 16;
    redditRatioH = typeof pack.ratioH === 'number' ? Number(pack.ratioH) : 9;
    redditTtlSec = typeof pack.ttlSec === 'number' ? Number(pack.ttlSec) : 0;
  }

  function editGenericJsonPack(name: string, pack: Record<string, unknown>): void {
    genericJsonPackName = name;
    genericJsonEndpoint = String(pack.endpoint ?? '');
    genericJsonImagePath = String(pack.imagePath ?? '$.hdurl');
    genericJsonImagePrefix = String(pack.imagePrefix ?? '');
    genericJsonPostPath = String(pack.postPath ?? '');
    genericJsonPostPrefix = String(pack.postPrefix ?? '');
    genericJsonAuthorNamePath = String(pack.authorNamePath ?? '');
    genericJsonAuthorUrlPath = String(pack.authorUrlPath ?? '');
    genericJsonAuthorUrlPrefix = String(pack.authorUrlPrefix ?? '');
    genericJsonDomain = String(pack.domain ?? '');
    genericJsonTtlSec = typeof pack.ttlSec === 'number' ? Number(pack.ttlSec) : 0;
  }

  function editStaticUrlPack(name: string, pack: Record<string, unknown>): void {
    staticUrlPackName = name;
    staticUrlSingle = String(pack.url ?? '');
    if (Array.isArray(pack.urls)) {
      staticUrlList = pack.urls.map(v => String(v)).join(', ');
    } else {
      staticUrlList = '';
    }
    staticUrlAuthorName = String(pack.authorName ?? '');
    staticUrlAuthorUrl = String(pack.authorUrl ?? '');
    staticUrlDomain = String(pack.domain ?? '');
    staticUrlPostUrl = String(pack.postUrl ?? '');
    staticUrlDifferentImages = pack.differentImages !== undefined ? !!pack.differentImages : true;
    staticUrlCount = typeof pack.count === 'number' ? Number(pack.count) : 2;
    staticUrlTtlSec = typeof pack.ttlSec === 'number' ? Number(pack.ttlSec) : 0;
  }

  function editLocalPack(name: string, pack: Record<string, unknown>): void {
    localPackName = name;
    if (Array.isArray(pack.paths)) {
      localPathItems = pack.paths.map(v => String(v).trim()).filter(Boolean);
    } else {
      const single = String(pack.paths ?? '').trim();
      localPathItems = single ? [single] : [];
    }
  }

  function folderNameFromPath(p: string): string {
    const cleaned = p.replace(/\/+$/, '');
    const parts = cleaned.split('/');
    return parts[parts.length - 1] || cleaned;
  }

  async function addLocalFolderPath(): Promise<void> {
    busyPacks = true;
    lastError = null;
    try {
      const result = await invoke<{path?: string | null}>('kitowall_pick_folder');
      const selected = String(result?.path ?? '').trim();
      if (!selected) return;
      if (localPathItems.includes(selected)) {
        pushToast('Folder already added', 'info');
        return;
      }
      localPathItems = [...localPathItems, selected];
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      busyPacks = false;
    }
  }

  function removeLocalFolderPath(index: number): void {
    localPathItems = localPathItems.filter((_, i) => i !== index);
  }

  function selectWallhavenRatio(mode: 'ultrawide' | '16:9' | '16:10' | '4:3' | '5:4' | 'x:x'): void {
    wallhavenRatioMode = mode;
    wallhavenAtleast = '';
    if (mode === 'x:x') {
      showResolutionModal = false;
      return;
    }
    showResolutionModal = true;
  }

  async function removePack(name: string): Promise<void> {
    busyPacks = true;
    lastError = null;
    try {
      const result = await invoke<Record<string, unknown>>('kitowall_pack_remove', {name});
      ensureCommandOk(result);
      pushToast(`Pack removed: ${name}`, 'success');
      pushLog(`pack removed: ${name}`, 'success');
      await refreshPacksUiState();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`pack remove failed: ${String(e)}`, 'error');
    } finally {
      busyPacks = false;
    }
  }

  async function loadSettings(): Promise<void> {
    try {
      const data = await invoke<SettingsReport>('kitowall_settings_get');
      settingsMode = data.mode;
      settingsInterval = data.rotation_interval_seconds;
      settingsTransitionType = data.transition?.type ?? 'center';
      settingsTransitionFps = data.transition?.fps ?? 60;
      settingsTransitionDuration = data.transition?.duration ?? 0.7;
      settingsTransitionAngle = data.transition?.angle !== undefined ? String(data.transition.angle) : '';
      settingsTransitionPos = data.transition?.pos ?? '';
      timerIntervalValue = data.rotation_interval_seconds;
      timerIntervalUnit = 's';
    } catch (e) {
      lastError = String(e);
    }
  }

  async function loadSourceKeys(): Promise<void> {
    try {
      const keys = await invoke<{
        wallhaven?: {value?: string | null; apiKeyEnv?: string | null};
        unsplash?: {value?: string | null; apiKeyEnv?: string | null};
      }>('kitowall_source_keys_get');
      wallhavenApiKey = keys?.wallhaven?.value ?? '';
      unsplashApiKey = keys?.unsplash?.value ?? '';
    } catch (e) {
      lastError = String(e);
    }
  }

  async function saveSettings(): Promise<void> {
    busySettings = true;
    lastError = null;
    try {
      const interval = Math.floor(Number(settingsInterval));
      const fps = Math.floor(Number(settingsTransitionFps));
      const duration = Number(settingsTransitionDuration);
      const angle = settingsTransitionAngle.trim().length > 0 ? Number(settingsTransitionAngle) : null;
      const pos = settingsTransitionPos.trim().length > 0 ? settingsTransitionPos.trim() : null;
      if (!Number.isFinite(interval) || interval <= 0) throw new Error('rotation interval must be > 0');
      if (!Number.isFinite(fps) || fps <= 0) throw new Error('transition fps must be > 0');
      if (!Number.isFinite(duration) || duration <= 0) throw new Error('transition duration must be > 0');
      if (angle !== null && !Number.isFinite(angle)) throw new Error('transition angle must be a number');

      const result = await invoke<Record<string, unknown>>('kitowall_settings_set', {
        mode: settingsMode,
        rotationIntervalSec: interval,
        transitionType: settingsTransitionType,
        transitionFps: fps,
        transitionDuration: duration,
        transitionAngle: angle,
        transitionPos: pos
      });
      ensureCommandOk(result);
      pushToast('General settings saved', 'success');
      pushLog('settings updated', 'success');
      await runStatus();
      await runHealth();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`settings save failed: ${String(e)}`, 'error');
    } finally {
      busySettings = false;
    }
  }

  async function applyTimerInterval(): Promise<void> {
    busySettings = true;
    lastError = null;
    try {
      const amount = Math.floor(Number(timerIntervalValue));
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('timer interval value must be > 0');
      if (!['s', 'm', 'h'].includes(timerIntervalUnit)) throw new Error('timer unit must be s, m, or h');
      const every = `${amount}${timerIntervalUnit}`;
      const result = await invoke<Record<string, unknown>>('kitowall_install_timer', {
        every
      });
      ensureCommandOk(result);
      pushToast(`System timer updated (${every})`, 'success');
      pushLog(`install-systemd --every ${every}`, 'success');
      await runHealth();
      await loadTimerStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`timer update failed: ${String(e)}`, 'error');
    } finally {
      busySettings = false;
    }
  }

  async function saveSourceKeys(): Promise<void> {
    busyKeys = true;
    lastError = null;
    try {
      const wall = wallhavenApiKey.trim();
      const uns = unsplashApiKey.trim();
      if (!wall && !uns) throw new Error('Provide at least one API key');
      const result = await invoke<Record<string, unknown>>('kitowall_source_keys_set', {
        wallhavenKey: wall || null,
        unsplashKey: uns || null
      });
      ensureCommandOk(result);
      pushToast('Source API keys saved to config packs', 'success');
      pushLog('source keys updated', 'success');
      await runListPacks();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`source key update failed: ${String(e)}`, 'error');
    } finally {
      busyKeys = false;
    }
  }

  async function loadTimerStatus(): Promise<void> {
    try {
      timerStatus = await invoke<TimerStatusReport>('kitowall_timer_status');
    } catch (e) {
      lastError = String(e);
    }
  }

  async function loadHistorySection(): Promise<void> {
    busyHistory = true;
    const limit = Math.max(1, Math.floor(Number(historyLimit) || 120));
    try {
      const outputsCount = status?.outputs?.length && status.outputs.length > 0 ? status.outputs.length : 1;
      const fetchLimit = Math.max(500, limit * Math.max(1, historyPage) * outputsCount * 6);
      const [history, favs] = await Promise.all([
        invoke<HistoryReport>('kitowall_history_list', {limit: fetchLimit}),
        invoke<string[]>('kitowall_favorites_list')
      ]);
      favorites = Array.isArray(favs) ? favs : [];
      rawHistoryEntries = (history?.entries ?? []).map(e => ({
        ...e,
        favorite: favorites.includes(e.path)
      }));
      applyHistoryWindow();
    } catch (e) {
      lastError = String(e);
    } finally {
      busyHistory = false;
    }
  }

  async function loadWallpaperLibrary(): Promise<void> {
    galleryBusy = true;
    lastError = null;
    try {
      const [data, favs] = await Promise.all([
        invoke<WallpapersListResponse>('kitowall_wallpapers_list'),
        invoke<string[]>('kitowall_favorites_list')
      ]);
      galleryItems = Array.isArray(data?.items) ? data.items : [];
      galleryRoot = String(data?.root ?? '');
      fileSrcCache.clear();
      favorites = Array.isArray(favs) ? favs : [];
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      galleryBusy = false;
    }
  }

  async function loadSystemLogs(): Promise<void> {
    systemLogsBusy = true;
    lastError = null;
    try {
      const data = await invoke<SystemLogsResponse>('kitowall_logs', {
        limit: Math.max(1, Math.floor(Number(logsLimit) || 200)),
        source: logsSource === 'all' ? null : logsSource,
        pack: logsPack.trim() || null,
        level: logsLevel === 'all' ? null : logsLevel,
        q: logsQuery.trim() || null
      });
      systemLogs = Array.isArray(data?.entries) ? data.entries : [];
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      systemLogsBusy = false;
    }
  }

  async function clearHistorySection(): Promise<void> {
    busyHistory = true;
    lastError = null;
    try {
      await invoke('kitowall_history_clear');
      rawHistoryEntries = [];
      historyEntries = [];
      historyHasMore = false;
      historyPage = 1;
      pushToast('History cleared', 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      busyHistory = false;
    }
  }

  async function clearSystemLogsSection(): Promise<void> {
    systemLogsBusy = true;
    lastError = null;
    try {
      await invoke('kitowall_logs_clear');
      systemLogs = [];
      pushToast('Logs cleared', 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      systemLogsBusy = false;
    }
  }

  function openHistoryClearConfirm(): void {
    showHistoryClearConfirm = true;
  }

  function closeHistoryClearConfirm(): void {
    showHistoryClearConfirm = false;
  }

  async function confirmHistoryClear(): Promise<void> {
    showHistoryClearConfirm = false;
    await clearHistorySection();
  }

  function openLogsClearConfirm(): void {
    showLogsClearConfirm = true;
  }

  function closeLogsClearConfirm(): void {
    showLogsClearConfirm = false;
  }

  async function confirmLogsClear(): Promise<void> {
    showLogsClearConfirm = false;
    await clearSystemLogsSection();
  }

  async function refreshHistorySection(): Promise<void> {
    historyPage = 1;
    await loadHistorySection();
  }

  async function loadMoreHistory(): Promise<void> {
    historyPage += 1;
    await loadHistorySection();
  }

  function onHistoryFilterChange(e: Event): void {
    historyOutputFilter = (e.currentTarget as HTMLSelectElement).value;
    historyPage = 1;
    applyHistoryWindow();
  }

  async function toggleFavorite(entry: HistoryEntry): Promise<void> {
    const path = entry.path;
    if (!path || path.trim().length === 0) return;
    busyHistory = true;
    lastError = null;
    try {
      if (isFavorite(path)) {
        await invoke('kitowall_favorite_remove', {path});
        favorites = favorites.filter(p => p !== path);
        pushToast('Removed from favorites', 'success');
      } else {
        await invoke('kitowall_favorite_add', {path});
        favorites = [...favorites, path];
        pushToast('Added to favorites', 'success');
      }
      historyEntries = historyEntries.map(h => (
        h.path === path ? {...h, favorite: favorites.includes(path)} : h
      ));
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      busyHistory = false;
    }
  }

  async function toggleFavoritePath(path: string): Promise<void> {
    if (!path || path.trim().length === 0) return;
    busy = true;
    lastError = null;
    try {
      if (isFavorite(path)) {
        await invoke('kitowall_favorite_remove', {path});
        favorites = favorites.filter(p => p !== path);
        pushToast('Removed from favorites', 'success');
      } else {
        await invoke('kitowall_favorite_add', {path});
        favorites = [...favorites, path];
        pushToast('Added to favorites', 'success');
      }
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      busy = false;
    }
  }

  function loadMoreGallery(): void {
    galleryVisible += 60;
  }

  async function runNext(force = false) {
    busy = true;
    lastError = null;
    try {
      const result = await invoke<unknown>('kitowall_next', {namespace, force});
      ensureCommandOk(result);
      pushToast('Wallpaper changed', 'success');
      pushLog(`next${force ? ' (force)' : ''}`, 'success');
      await runStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`next failed: ${String(e)}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function runNextForSelectedPack() {
    if (selectedPack === 'all') return;
    busy = true;
    lastError = null;
    try {
      const result = await invoke<unknown>('kitowall_next', {
        namespace,
        force: true,
        pack: selectedPack
      });
      ensureCommandOk(result);
      pushToast(`Wallpaper changed (${selectedPack})`, 'success');
      pushLog(`next pack: ${selectedPack}`, 'success');
      await runStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`next pack failed (${selectedPack}): ${String(e)}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function runRepair() {
    busy = true;
    lastError = null;
    try {
      await invoke('kitowall_init_apply', {namespace});
      pushToast('Repair completed', 'success');
      pushLog('repair: init --apply', 'success');
      await runHealth();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`repair failed: ${String(e)}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function runHydratePack() {
    const count = Math.floor(hydrateCount);
    if (!Number.isFinite(count) || count <= 0) {
      lastError = 'Hydrate count must be greater than 0';
      return;
    }

    busy = true;
    lastError = null;
    try {
      if (selectedPack === 'all') {
        const hydratable = packs.filter(p => p.hydratable);
        if (hydratable.length === 0) {
          throw new Error('No hydratable packs available');
        }
        for (let i = 0; i < hydratable.length; i++) {
          const pack = hydratable[i];
          pushToast(`Hydrating ${i + 1}/${hydratable.length}: ${pack.name}`, 'info');
          await invoke<Record<string, unknown>>('kitowall_hydrate_pack', {
            name: pack.name,
            count
          });
        }
        pushToast(`Hydrated all remote packs (${hydratable.length})`, 'success');
        pushLog(`hydrate all remote packs count=${count}`, 'success');
      } else {
        const selected = packs.find(p => p.name === selectedPack);
        if (!selected) throw new Error(`Pack not found in UI list: ${selectedPack}`);
        if (!selected.hydratable) {
          throw new Error(`Pack "${selectedPack}" is folder-only (no source configured to hydrate)`);
        }
        const result = await invoke<Record<string, unknown>>('kitowall_hydrate_pack', {
          name: selectedPack,
          count
        });
        pushToast(`Hydrated pack: ${selectedPack}`, 'success');
        pushLog(`hydrate ${selectedPack}: ${JSON.stringify(result)}`, 'success');
      }
      await runStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`hydrate failed: ${String(e)}`, 'error');
    } finally {
      busy = false;
    }
  }

  function openCleanConfirm(): void {
    showCleanConfirm = true;
  }

  function closeCleanConfirm(): void {
    showCleanConfirm = false;
  }

  async function runCleanWallpapers() {
    showCleanConfirm = false;
    busy = true;
    lastError = null;
    try {
      if (selectedPack === 'all') {
        const result = await invoke<Record<string, unknown>>('kitowall_cache_prune');
        pushToast('Cleaned all packs', 'success');
        pushLog(`cache-prune-hard all: ${JSON.stringify(result)}`, 'success');
      } else {
        const result = await invoke<Record<string, unknown>>('kitowall_cache_prune_pack', {
          name: selectedPack
        });
        pushToast(`Cleaned pack: ${selectedPack}`, 'success');
        pushLog(`cache-prune-pack-hard ${selectedPack}: ${JSON.stringify(result)}`, 'success');
      }
      await runStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`cache-prune failed: ${String(e)}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function runOpenPackFolder() {
    if (selectedPack === 'all') return;
    busy = true;
    lastError = null;
    try {
      const result = await invoke<Record<string, unknown>>('kitowall_open_pack_folder', {
        name: selectedPack
      });
      pushToast(`Opened folder: ${selectedPack}`, 'success');
      pushLog(`open folder ${selectedPack}: ${JSON.stringify(result)}`, 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
      pushLog(`open folder failed (${selectedPack}): ${String(e)}`, 'error');
    } finally {
      busy = false;
    }
  }

  onMount(() => {
    try {
      const saved = localStorage.getItem(SELECTED_PACK_KEY);
      if (saved && saved.trim().length > 0) {
        selectedPack = saved;
        selectedPackInfo = null;
      }
    } catch {}
    try {
      const savedLang = localStorage.getItem(UI_LANG_KEY);
      if (savedLang === 'es' || savedLang === 'en') {
        uiLanguage = savedLang;
      }
    } catch {}

    runHealth();
    runStatus();
    runListPacks();
    loadPacksRaw();
    loadSettings();
    loadSourceKeys();
    loadTimerStatus();
    loadWallpaperLibrary();
    loadSystemLogs();

    statusPollTimer = setInterval(() => {
      void syncStatus();
    }, STATUS_POLL_MS);

    const onFocus = () => {
      void syncStatus();
    };
    const onVisibility = () => {
      if (!document.hidden) void syncStatus();
      if (!document.hidden) void runListPacks();
    };
    const onWindowClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('.pack-select')) {
        packDropdownOpen = false;
      }
      if (!target.closest('.gs-select')) {
        gsSelectOpen = null;
      }
      if (!target.closest('.multi-select')) {
        wallhavenCategoriesOpen = false;
        wallhavenPurityOpen = false;
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('click', onWindowClick);

    return () => {
      if (statusPollTimer) clearInterval(statusPollTimer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('click', onWindowClick);
    };
  });

  onDestroy(() => {
    if (statusPollTimer) clearInterval(statusPollTimer);
  });
</script>

<div class="app-shell">
  <button class="menu-toggle" on:click={() => (mobileMenuOpen = !mobileMenuOpen)} aria-label={tr('Toggle menu', 'Mostrar menu')}>
    {tr('Menu', 'Menu')}
  </button>

  <aside class={`side-menu ${mobileMenuOpen ? 'open' : ''}`}>
    <div class="side-title">Kitowall</div>
    <div class="menu-items">
    <button class={`menu-item ${activeSection === 'control' ? 'active' : ''}`} on:click={() => selectSection('control')}>
      {tr('Control Center', 'Centro de Control')}
    </button>
    <button class={`menu-item ${activeSection === 'settings' ? 'active' : ''}`} on:click={() => selectSection('settings')}>
      {tr('General Settings', 'Configuracion General')}
    </button>
    <button class={`menu-item ${activeSection === 'history' ? 'active' : ''}`} on:click={() => selectSection('history')}>
      {tr('History', 'Historial')}
    </button>
    <button class={`menu-item ${activeSection === 'library' ? 'active' : ''}`} on:click={() => selectSection('library')}>
      {tr('Wallpapers', 'Wallpapers')}
    </button>
    <button class={`menu-item ${activeSection === 'packs' ? 'active' : ''}`} on:click={() => selectSection('packs')}>
      {tr('Packs', 'Packs')}
    </button>
    <button class={`menu-item ${activeSection === 'logs' ? 'active' : ''}`} on:click={() => selectSection('logs')}>
      {tr('Logs', 'Logs')}
    </button>
    </div>
    <div class="sidebar-footer">
      <img class="sidebar-logo" src={logo} alt="Kitotsu logo" />
      <div class="sidebar-author">Kitotsu</div>
      <div class="sidebar-disclaimer">Original code by Kitotsu</div>
      <div class="sidebar-disclaimer muted-note">{tr('Attribution required by project license.', 'Atribucion obligatoria por la licencia del proyecto.')}</div>
    </div>
  </aside>

  <main>
    <h1>Kitowall UI</h1>
    <p>{tr('Minimal dashboard wired to the CLI contract.', 'Panel minimal conectado al contrato del CLI.')}</p>

    {#if lastError}
      <div class="banner error">{lastError}</div>
    {/if}
    {#if toasts.length > 0}
      <div class="toast-stack">
        {#each toasts as t (t.id)}
          <div class={`toast ${t.kind}`}>{t.text}</div>
        {/each}
      </div>
    {/if}

    {#if activeSection === 'control'}
      <div class="card">
        <div class="row actions-input-row">
          <label for="namespace-input">{tr('Namespace', 'Namespace')}</label>
          <input id="namespace-input" bind:value={namespace} placeholder="kitowall" />
          <button class="secondary" on:click={runHealth} disabled={busy}>{tr('Refresh Health', 'Actualizar Health')}</button>
        </div>
      </div>

      <h2>{tr('Health', 'Health')}</h2>
      <div class="card">
        {#if health}
          <div class="row">
            <span class={`badge status ${health.ok ? 'ok' : 'bad'}`}>ok: {health.ok ? 'true' : 'false'}</span>
            {#if health.code}
              <span class="badge">{health.code}</span>
            {/if}
          </div>

          <h3>{tr('Dependencies', 'Dependencias')}</h3>
          <div class="row">
            {#each Object.entries(health.deps) as [name, value]}
              <span class={`badge status ${isTruthy(value) ? 'ok' : 'bad'}`}>
                {name}: {boolText(value)}
              </span>
            {/each}
          </div>

          <h3>{tr('Units', 'Unidades')}</h3>
          <div class="units">
            {#each Object.entries(health.units) as [key, unit]}
              <details class="unit-card">
                <summary>
                  <span class="unit-title">{key}</span>
                  <span class={`badge status ${isTruthy(unit.active) ? 'ok' : 'bad'}`}>
                    active: {boolText(unit.active)}
                  </span>
                </summary>
                <div class="unit-body">
                  <div class="unit-name">
                    service: <code>{unit.name}</code>
                  </div>
                  <div class="row">
                    {#each Object.entries(unit) as [propName, propValue]}
                      {#if typeof propValue === 'boolean'}
                        <span class={`badge status ${isTruthy(propValue) ? 'ok' : 'bad'}`}>
                          {propName}: {boolText(propValue)}
                        </span>
                      {/if}
                    {/each}
                  </div>
                  <pre>{JSON.stringify(unit, null, 2)}</pre>
                </div>
              </details>
            {/each}
          </div>

          {#if !health.ok}
            <div class="banner">
              <div>{tr('Issues detected.', 'Se detectaron problemas.')}</div>
              {#if health.hints?.length}
                <ul>
                  {#each health.hints as h}
                    <li>{h}</li>
                  {/each}
                </ul>
              {/if}
              <div class="row">
                <span class="badge status warn">
                  {tr('Flatpak note', 'Nota Flatpak')}
                </span>
                <span class="help-wrap">
                  <button type="button" class="help-icon" aria-label={tr('Repair in Flatpak help', 'Ayuda reparar en Flatpak')}>?</button>
                  <span class="help-tooltip">{tr('If this app is running as Flatpak, use host shell for repair so systemd units are generated with host paths (not /app/bin/node).', 'Si esta app corre como Flatpak, usa la terminal del host para reparar y generar units de systemd con rutas del host (no /app/bin/node).')}</span>
                </span>
                <code>node dist/cli.js init --namespace kitowall --apply --force</code>
              </div>
              <button on:click={runRepair} disabled={busy}>{tr('Repair (init --apply)', 'Reparar (init --apply)')}</button>
            </div>
          {/if}
        {:else}
          <div>{tr('Loading...', 'Cargando...')}</div>
        {/if}
      </div>

      <h2>{tr('Actions', 'Acciones')}</h2>
      <div class="card">
        <div class="row">
          <button on:click={() => runNext(false)} disabled={busy}>{tr('Next', 'Siguiente')}</button>
          <button class="secondary" on:click={() => runNext(true)} disabled={busy}>{tr('Rotate Now', 'Rotar Ahora')}</button>
          <button class="secondary" on:click={runStatus} disabled={busy}>{tr('Refresh Status', 'Actualizar Estado')}</button>
        </div>
        <h3>{tr('Download', 'Descarga')}</h3>
        <div class="row actions-input-row">
          <span class="field-label">{tr('Pack', 'Pack')}</span>
          <div class="pack-select">
            <button
              type="button"
              class="pack-select-trigger"
              on:click|stopPropagation={() => (packDropdownOpen = !packDropdownOpen)}
              aria-expanded={packDropdownOpen}
            >
              <span>{selectedPack}</span>
              <span class="caret">▾</span>
            </button>
            {#if packDropdownOpen}
              <div class="pack-select-menu">
                <input
                  class="pack-filter"
                  placeholder="filter packs..."
                  value={packFilter}
                  on:click|stopPropagation
                  on:input={onPackFilterInput}
                />
                <button type="button" class="pack-option" on:click|stopPropagation={() => choosePack('all', null)}>{tr('all', 'todos')}</button>
                {#each visiblePacks as p}
                  <button type="button" class="pack-option" on:click|stopPropagation={() => choosePack(p.name, p.type)}>
                    {p.name} ({p.type})
                  </button>
                {/each}
              </div>
            {/if}
          </div>
          <label for="hydrate-count">{tr('Count', 'Cantidad')}</label>
          <input
            id="hydrate-count"
            type="number"
            min="1"
            bind:value={hydrateCount}
          />
        </div>
        <div class="row actions-buttons-row">
          {#if selectedPack !== 'all'}
            <button class="secondary next-pack-btn" on:click={runNextForSelectedPack} disabled={busy}>
              {tr('Next', 'Siguiente')} ({selectedPack})
            </button>
            <button class="secondary" on:click={runOpenPackFolder} disabled={busy}>{tr('Open Folder', 'Abrir Carpeta')}</button>
          {/if}
          <button class="secondary" on:click={runHydratePack} disabled={busy}>{tr('Hydrate Pack', 'Hidratar Pack')}</button>
          <button class="secondary danger-outline" on:click={openCleanConfirm} disabled={busy}>{tr('Clean Wallpapers', 'Limpiar Wallpapers')}</button>
        </div>
      </div>

      <h2>{tr('State', 'Estado')}</h2>
      <div class="card">
        {#if status}
          <div class="row">
            <span class="badge">mode: {status.mode}</span>
            <span class="badge">pack: {status.pack ?? 'none'}</span>
          </div>
          <p class="muted">{tr('last updated', 'ultima actualizacion')}: {formatTimestamp(status.last_updated)}</p>

          <div class="last-state-grid">
            {#each status.outputs as output}
              <div class="monitor-card">
                <div class="monitor-header">
                  <span class="badge">{output}</span>
                </div>
                <div class="monitor-screen-wrap">
                  <div class="monitor-screen">
                    {#if imageSrc(status.last_set?.[output])}
                      <img class="monitor-image" src={imageSrc(status.last_set?.[output]) ?? ''} alt={`last wallpaper for ${output}`} />
                    {:else}
                      <div class="monitor-placeholder">{tr('No previous image', 'Sin imagen previa')}</div>
                    {/if}
                  </div>
                  {#if status.last_set?.[output]}
                    <button
                      class={`star-btn monitor-fav-btn ${isFavorite(status.last_set?.[output]) ? 'on' : ''}`}
                      on:click={() => toggleFavoritePath(status.last_set?.[output])}
                      disabled={busy}
                      aria-label={isFavorite(status.last_set?.[output]) ? 'Remove favorite' : 'Add favorite'}
                      title={isFavorite(status.last_set?.[output]) ? 'Remove favorite' : 'Add favorite'}
                    >
                      {isFavorite(status.last_set?.[output]) ? '★' : '☆'}
                    </button>
                  {/if}
                </div>
                <div class="monitor-caption">{status.last_set?.[output] ?? tr('No path available', 'Sin ruta disponible')}</div>
              </div>
            {/each}
          </div>
        {:else}
          <div>{tr('Loading...', 'Cargando...')}</div>
        {/if}
      </div>

      <h2>{tr('Action Logs', 'Logs de Accion')}</h2>
      <div class="card">
        {#if actionLogs.length === 0}
          <p class="muted">{tr('No actions yet.', 'Aun no hay acciones.')}</p>
        {:else}
          <div class="log-list">
            {#each actionLogs as log, i (i)}
              <div class="log-item">
                <span class={`badge status ${log.kind === 'error' ? 'bad' : log.kind === 'success' ? 'ok' : 'warn'}`}>{log.kind}</span>
                <span class="log-time">{new Date(log.ts).toLocaleTimeString()}</span>
                <span class="log-msg">{log.message}</span>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeSection === 'settings'}
      <h2>{tr('General Settings', 'Configuracion General')}</h2>
      <div class="card">
        <div class="row actions-input-row language-row">
          <span class="field-label">{tr('Language', 'Idioma')}</span>
          <div class="gs-select language-select">
            <button
              type="button"
              id="ui-language"
              class="gs-select-trigger"
              aria-expanded={gsSelectOpen === 'language'}
              on:click|stopPropagation={() => toggleGsSelect('language')}
            >
              <span>{uiLanguage === 'en' ? 'English' : 'Espanol'}</span>
              <span class="caret">▾</span>
            </button>
            {#if gsSelectOpen === 'language'}
              <div class="gs-select-menu">
                <button type="button" class="gs-option" on:click|stopPropagation={() => selectLanguage('en')}>
                  English
                </button>
                <button type="button" class="gs-option" on:click|stopPropagation={() => selectLanguage('es')}>
                  Espanol
                </button>
              </div>
            {/if}
          </div>
          <span class="badge">{tr('current', 'actual')}: {uiLanguage === 'en' ? 'English' : 'Espanol'}</span>
        </div>
        <div class="settings-grid">
          <div class="settings-field">
            <label for="settings-mode">{tr('Mode', 'Modo')}</label>
            <div class="gs-select">
              <button
                type="button"
                id="settings-mode"
                class="gs-select-trigger"
                aria-expanded={gsSelectOpen === 'mode'}
                on:click|stopPropagation={() => toggleGsSelect('mode')}
              >
                <span>{settingsMode}</span>
                <span class="caret">▾</span>
              </button>
              {#if gsSelectOpen === 'mode'}
                <div class="gs-select-menu">
                  {#each modeOptions as o}
                    <button type="button" class="gs-option" on:click|stopPropagation={() => selectMode(o.value)}>
                      {o.label}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
          <div class="settings-field">
            <div class="label-help">
              <label for="settings-interval">{tr('Rotation Interval (sec)', 'Intervalo de Rotacion (seg)')}</label>
              <span class="help-wrap">
                <button type="button" class="help-icon" aria-label={tr('Rotation interval help', 'Ayuda intervalo de rotacion')}>?</button>
                <span class="help-tooltip">{tr('How many seconds between automatic wallpaper changes when mode is rotate.', 'Cada cuantos segundos el motor escoge el siguiente wallpaper cuando el modo es rotate.')}</span>
              </span>
            </div>
            <input id="settings-interval" type="number" min="1" bind:value={settingsInterval} />
          </div>
          <div class="settings-field">
            <label for="settings-transition-type">{tr('Transition Type', 'Tipo de Transicion')}</label>
            <div class="gs-select">
              <button
                type="button"
                id="settings-transition-type"
                class="gs-select-trigger"
                aria-expanded={gsSelectOpen === 'transition'}
                on:click|stopPropagation={() => toggleGsSelect('transition')}
              >
                <span>{settingsTransitionType}</span>
                <span class="caret">▾</span>
              </button>
              {#if gsSelectOpen === 'transition'}
                <div class="gs-select-menu">
                  {#each transitionTypes as t}
                    <button type="button" class="gs-option" on:click|stopPropagation={() => selectTransitionType(t)}>
                      {t}
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </div>
          <div class="settings-field">
            <label for="settings-transition-fps">{tr('Transition FPS', 'FPS de Transicion')}</label>
            <input id="settings-transition-fps" type="number" min="1" bind:value={settingsTransitionFps} />
          </div>
          <div class="settings-field">
            <div class="label-help">
              <label for="settings-transition-duration">{tr('Transition Duration', 'Duracion de Transicion')}</label>
              <span class="help-wrap">
                <button type="button" class="help-icon" aria-label={tr('Transition duration help', 'Ayuda duracion de transicion')}>?</button>
                <span class="help-tooltip">{tr('Animation duration in seconds when applying a wallpaper.', 'Duracion de la animacion en segundos al aplicar una imagen.')}</span>
              </span>
            </div>
            <input id="settings-transition-duration" type="number" min="0.1" step="0.1" bind:value={settingsTransitionDuration} />
          </div>
          <div class="settings-field">
            <div class="label-help">
              <label for="timer-interval-sec">{tr('System Timer Interval', 'Intervalo del Timer de Sistema')}</label>
              <span class="help-wrap">
                <button type="button" class="help-icon" aria-label={tr('System timer interval help', 'Ayuda del intervalo del timer')}>?</button>
                <span class="help-tooltip">{tr('How often systemd timer runs. You can use seconds (s), minutes (m), or hours (h), for example 30s, 10m, 1h.', 'Frecuencia del timer de systemd. Puedes usar segundos (s), minutos (m) o horas (h): por ejemplo 30s, 10m, 1h.')}</span>
              </span>
            </div>
            <div class="timer-interval-row">
              <input id="timer-interval-sec" type="number" min="1" bind:value={timerIntervalValue} />
              <div class="gs-select">
                <button
                  type="button"
                  class="gs-select-trigger"
                  aria-expanded={gsSelectOpen === 'timer'}
                  on:click|stopPropagation={() => toggleGsSelect('timer')}
                >
                  <span>{timerUnitOptions.find(o => o.value === timerIntervalUnit)?.label ?? timerIntervalUnit}</span>
                  <span class="caret">▾</span>
                </button>
                {#if gsSelectOpen === 'timer'}
                  <div class="gs-select-menu">
                    {#each timerUnitOptions as o}
                      <button type="button" class="gs-option" on:click|stopPropagation={() => selectTimerUnit(o.value)}>
                        {o.label}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          </div>
          <div class="settings-field">
            <label for="settings-transition-angle">{tr('Transition Angle (optional)', 'Angulo de Transicion (opcional)')}</label>
            <input id="settings-transition-angle" placeholder="e.g. 45" bind:value={settingsTransitionAngle} />
          </div>
          <div class="settings-field">
            <label for="settings-transition-pos">{tr('Transition Pos (optional)', 'Posicion de Transicion (opcional)')}</label>
            <input id="settings-transition-pos" placeholder="e.g. 0.5,0.5" bind:value={settingsTransitionPos} />
          </div>
        </div>
        <div class="row actions-buttons-row settings-actions-row">
          <button class="secondary" on:click={loadSettings} disabled={busySettings}>{tr('Reload', 'Recargar')}</button>
          <button on:click={saveSettings} disabled={busySettings}>{tr('Save Settings', 'Guardar Configuracion')}</button>
          <button class="secondary" on:click={applyTimerInterval} disabled={busySettings}>{tr('Apply Timer', 'Aplicar Timer')}</button>
          <button class="secondary" on:click={loadTimerStatus} disabled={busySettings}>{tr('Refresh Timer Status', 'Actualizar Estado del Timer')}</button>
        </div>
        {#if timerStatus}
          <div class="timer-info-header">
            <div class="label-help">
              <span class="field-label">{tr('Systemd Runtime Status', 'Estado Runtime de Systemd')}</span>
              <span class="help-wrap">
                <button type="button" class="help-icon" aria-label={tr('Systemd runtime status help', 'Ayuda estado runtime de systemd')}>?</button>
                <span class="help-tooltip">{tr('Timer card shows scheduling status (when next run happens). Service card shows execution status of the worker unit.', 'La tarjeta Timer muestra el estado de programacion (cuando ocurre la siguiente ejecucion). La tarjeta Service muestra el estado de ejecucion de la unidad trabajadora.')}</span>
              </span>
            </div>
          </div>
          <div class="timer-status-grid">
            <div class="timer-status-card">
              <div class="row">
                <span class={`badge status ${(timerStatus.timer?.ActiveState ?? '') === 'active' ? 'ok' : 'bad'}`}>timer: {timerStatus.timer?.ActiveState ?? 'unknown'}</span>
                <span class="badge">{timerStatus.timer?.SubState ?? 'n/a'}</span>
                <span class="badge">{timerStatus.timer?.UnitFileState ?? 'n/a'}</span>
              </div>
              <div class="timer-kv-list">
                <div class="timer-kv-row">
                  <span class="timer-kv-key timer-kv-key-with-help">
                    {tr('next', 'siguiente')}
                    <span class="help-wrap">
                      <button type="button" class="help-icon" aria-label={tr('Next schedule fallback help', 'Ayuda fallback de siguiente ejecucion')}>?</button>
                      <span class="help-tooltip">{tr('If no next run is scheduled yet, we show a fallback label. This is not an error by itself and usually means timer is inactive or has no pending trigger yet.', 'Si aun no hay siguiente ejecucion programada, mostramos una etiqueta fallback. No es un error por si solo y normalmente significa que el timer esta inactivo o aun no tiene un disparo pendiente.')}</span>
                    </span>
                  </span>
                  <span class="timer-kv-value">{systemdFieldText(timerStatus.timer?.NextElapseUSecRealtime)}</span>
                </div>
                <div class="timer-kv-row">
                  <span class="timer-kv-key">{tr('last trigger', 'ultimo disparo')}</span>
                  <span class="timer-kv-value">{timerStatus.timer?.LastTriggerUSec ?? 'n/a'}</span>
                </div>
              </div>
            </div>
            <div class="timer-status-card">
              <div class="row">
                <span class={`badge status ${(timerStatus.service?.ActiveState ?? '') === 'active' ? 'ok' : 'bad'}`}>service: {timerStatus.service?.ActiveState ?? 'unknown'}</span>
                <span class="badge">{timerStatus.service?.SubState ?? 'n/a'}</span>
                <span class="badge">{timerStatus.service?.UnitFileState ?? 'n/a'}</span>
              </div>
              <div class="timer-kv-list">
                <div class="timer-kv-row">
                  <span class="timer-kv-key">{tr('unit', 'unidad')}</span>
                  <span class="timer-kv-value">{timerStatus.service?.Id ?? 'kitowall-next.service'}</span>
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <h2>{tr('Source API Keys', 'API Keys de Sources')}</h2>
      <div class="card">
        <div class="settings-grid">
          <div class="settings-field">
            <div class="label-help">
              <label for="wallhaven-key">Wallhaven API Key</label>
              <span class="help-wrap">
                <button type="button" class="help-icon" aria-label={tr('Wallhaven API key help', 'Ayuda de key de Wallhaven')}>?</button>
                <span class="help-tooltip">{tr('Stored in wallhaven packs in config and used for downloads.', 'Se guarda en los packs wallhaven del config y se usa en descargas.')}</span>
              </span>
            </div>
            <div class="key-input-row">
              {#if showWallhavenApiKey}
                <input id="wallhaven-key" type="text" bind:value={wallhavenApiKey} placeholder="Enter Wallhaven key" />
              {:else}
                <input id="wallhaven-key" type="password" bind:value={wallhavenApiKey} placeholder="Enter Wallhaven key" />
              {/if}
              <button type="button" class="secondary" on:click={() => (showWallhavenApiKey = !showWallhavenApiKey)}>
                {showWallhavenApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div class="settings-field">
            <div class="label-help">
              <label for="unsplash-key">Unsplash API Key</label>
              <span class="help-wrap">
                <button type="button" class="help-icon" aria-label={tr('Unsplash API key help', 'Ayuda de key de Unsplash')}>?</button>
                <span class="help-tooltip">{tr('Stored in unsplash packs in config and used for downloads.', 'Se guarda en los packs unsplash del config y se usa en descargas.')}</span>
              </span>
            </div>
            <div class="key-input-row">
              {#if showUnsplashApiKey}
                <input id="unsplash-key" type="text" bind:value={unsplashApiKey} placeholder="Enter Unsplash key" />
              {:else}
                <input id="unsplash-key" type="password" bind:value={unsplashApiKey} placeholder="Enter Unsplash key" />
              {/if}
              <button type="button" class="secondary" on:click={() => (showUnsplashApiKey = !showUnsplashApiKey)}>
                {showUnsplashApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
        </div>
        <div class="row actions-buttons-row settings-actions-row">
          <button class="secondary" on:click={loadSourceKeys} disabled={busyKeys}>{tr('Reload Keys', 'Recargar Keys')}</button>
          <button on:click={saveSourceKeys} disabled={busyKeys}>{tr('Save API Keys', 'Guardar API Keys')}</button>
        </div>
      </div>
    {:else if activeSection === 'packs'}
      <h2>{tr('Packs', 'Packs')}</h2>
      <div class="card">
        <div class="packs-tabs">
          <button class={`secondary ${packTab === 'wallhaven' ? 'tab-active' : ''}`} on:click={() => (packTab = 'wallhaven')}>Wallhaven</button>
          <button class={`secondary ${packTab === 'unsplash' ? 'tab-active' : ''}`} on:click={() => (packTab = 'unsplash')}>Unsplash</button>
          <button class={`secondary ${packTab === 'reddit' ? 'tab-active' : ''}`} on:click={() => (packTab = 'reddit')}>Reddit</button>
          <button class={`secondary ${packTab === 'generic_json' ? 'tab-active' : ''}`} on:click={() => (packTab = 'generic_json')}>Generic JSON</button>
          <button class={`secondary ${packTab === 'static_url' ? 'tab-active' : ''}`} on:click={() => (packTab = 'static_url')}>Static URL</button>
          <button class={`secondary ${packTab === 'local' ? 'tab-active' : ''}`} on:click={() => (packTab = 'local')}>Local</button>
        </div>
      </div>

      {#if packTab === 'wallhaven'}
        <h2>Wallhaven</h2>
        <div class="card">
          <div class="settings-grid wallhaven-grid">
            <div class="settings-field">
              <label for="wallhaven-pack-name">Pack Name</label>
              <input id="wallhaven-pack-name" bind:value={wallhavenPackName} placeholder="e.g. wallhaven-sao" />
            </div>
            <div class="settings-field">
              <label for="wallhaven-pack-keyword">Keyword</label>
              <input id="wallhaven-pack-keyword" bind:value={wallhavenKeyword} placeholder="e.g. sao" />
            </div>
            <div class="settings-field">
              <label for="wallhaven-pack-subthemes">Subthemes (comma separated)</label>
              <input id="wallhaven-pack-subthemes" bind:value={wallhavenSubthemes} placeholder="minimalist, dark" />
            </div>
            <div class="settings-field">
              <label for="wallhaven-pack-apikey">API Key (optional)</label>
              <input id="wallhaven-pack-apikey" type="password" bind:value={wallhavenPackApiKey} placeholder="set key while creating/updating" />
            </div>
            <hr class="section-divider" />
            <div class="settings-field ratio-resolution-field">
              <div class="ratio-resolution-row">
                <div>
                  <span class="field-label">Ratio</span>
                  <div class="ratio-buttons">
                    <button type="button" class={`secondary ${wallhavenRatioMode === 'ultrawide' ? 'tab-active' : ''}`} on:click={() => selectWallhavenRatio('ultrawide')}>Ultrawide</button>
                    <button type="button" class={`secondary ${wallhavenRatioMode === '16:9' ? 'tab-active' : ''}`} on:click={() => selectWallhavenRatio('16:9')}>16:9</button>
                    <button type="button" class={`secondary ${wallhavenRatioMode === '16:10' ? 'tab-active' : ''}`} on:click={() => selectWallhavenRatio('16:10')}>16:10</button>
                    <button type="button" class={`secondary ${wallhavenRatioMode === '4:3' ? 'tab-active' : ''}`} on:click={() => selectWallhavenRatio('4:3')}>4:3</button>
                    <button type="button" class={`secondary ${wallhavenRatioMode === '5:4' ? 'tab-active' : ''}`} on:click={() => selectWallhavenRatio('5:4')}>5:4</button>
                    <button type="button" class={`secondary ${wallhavenRatioMode === 'x:x' ? 'tab-active' : ''}`} on:click={() => selectWallhavenRatio('x:x')}>x:x</button>
                  </div>
                </div>
                <div>
                  <div class="label-help">
                    <label for="wallhaven-atleast">{tr('Minimum Resolution', 'Resolucion Minima')}</label>
                    <span class="help-wrap">
                      <button type="button" class="help-icon" aria-label={tr('Wallhaven resolution help', 'Ayuda de resolucion de Wallhaven')}>?</button>
                      <span class="help-tooltip">
                        {#if wallhavenRatioMode === 'x:x'}
                          {tr('x:x mode: set width and height manually.', 'Modo x:x: define ancho y alto manualmente.')}
                        {:else}
                          {tr('Allowed presets are shown for the selected ratio.', 'Se muestran presets permitidos para el ratio seleccionado.')}
                        {/if}
                      </span>
                    </span>
                  </div>
                  {#if wallhavenRatioMode === 'x:x'}
                    <div class="resolution-custom-row">
                      <input type="number" min="1" bind:value={wallhavenCustomWidth} placeholder="Width" />
                      <input type="number" min="1" bind:value={wallhavenCustomHeight} placeholder="Height" />
                    </div>
                  {:else}
                    <div class="resolution-row">
                      <input id="wallhaven-atleast" value={wallhavenAtleast || 'none'} readonly />
                      <button type="button" class="secondary" on:click={() => (showResolutionModal = true)}>Pick</button>
                      <button type="button" class="secondary" on:click={() => (wallhavenAtleast = '')}>Clear</button>
                    </div>
                  {/if}
                </div>
              </div>
            </div>
            <hr class="section-divider" />
            <div class="settings-field">
              <span class="field-label">Categories</span>
              <div class="multi-select">
                <button type="button" class="multi-select-trigger" on:click|stopPropagation={() => (wallhavenCategoriesOpen = !wallhavenCategoriesOpen)}>
                  <div class="multi-select-badges">
                    {#if wallhavenCategoriesSelectedLabels.length === 0}
                      <span class="muted">Select categories</span>
                    {:else}
                      {#each wallhavenCategoriesSelectedLabels as label}
                        <span class="badge">{label}</span>
                      {/each}
                    {/if}
                  </div>
                  <span class="badge">{wallhavenCategoriesCodeValue}</span>
                </button>
                {#if wallhavenCategoriesOpen}
                  <div class="multi-select-menu">
                    {#each wallhavenCategoryOptions as o}
                      <button
                        type="button"
                        class="multi-option"
                        on:click|stopPropagation={() => {
                          if (o.key === 'general') wallhavenCategoryGeneral = !wallhavenCategoryGeneral;
                          if (o.key === 'anime') wallhavenCategoryAnime = !wallhavenCategoryAnime;
                          if (o.key === 'people') wallhavenCategoryPeople = !wallhavenCategoryPeople;
                        }}
                      >
                        <span>{o.label}</span>
                        <span class={`badge status ${((o.key === 'general' && wallhavenCategoryGeneral) || (o.key === 'anime' && wallhavenCategoryAnime) || (o.key === 'people' && wallhavenCategoryPeople)) ? 'ok' : 'bad'}`}>
                          {((o.key === 'general' && wallhavenCategoryGeneral) || (o.key === 'anime' && wallhavenCategoryAnime) || (o.key === 'people' && wallhavenCategoryPeople)) ? 'on' : 'off'}
                        </span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <div class="settings-field">
              <span class="field-label">Purity</span>
              <div class="multi-select">
                <button type="button" class="multi-select-trigger" on:click|stopPropagation={() => (wallhavenPurityOpen = !wallhavenPurityOpen)}>
                  <div class="multi-select-badges">
                    {#if wallhavenPuritySelectedLabels.length === 0}
                      <span class="muted">Select purity</span>
                    {:else}
                      {#each wallhavenPuritySelectedLabels as label}
                        <span class="badge">{label}</span>
                      {/each}
                    {/if}
                  </div>
                  <span class="badge">{wallhavenPurityCodeValue}</span>
                </button>
                {#if wallhavenPurityOpen}
                  <div class="multi-select-menu">
                    {#each wallhavenPurityOptions as o}
                      <button
                        type="button"
                        class="multi-option"
                        on:click|stopPropagation={() => {
                          if (o.key === 'sfw') wallhavenAllowSfw = !wallhavenAllowSfw;
                          if (o.key === 'sketchy') wallhavenAllowSketchy = !wallhavenAllowSketchy;
                          if (o.key === 'nsfw') wallhavenAllowNsfw = !wallhavenAllowNsfw;
                        }}
                      >
                        <span>{o.label}</span>
                        <span class={`badge status ${((o.key === 'sfw' && wallhavenAllowSfw) || (o.key === 'sketchy' && wallhavenAllowSketchy) || (o.key === 'nsfw' && wallhavenAllowNsfw)) ? 'ok' : 'bad'}`}>
                          {((o.key === 'sfw' && wallhavenAllowSfw) || (o.key === 'sketchy' && wallhavenAllowSketchy) || (o.key === 'nsfw' && wallhavenAllowNsfw)) ? 'on' : 'off'}
                        </span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <div class="settings-field">
              <label for="wallhaven-sorting">Sorting</label>
              <div class="gs-select">
                <button
                  type="button"
                  class="gs-select-trigger"
                  on:click|stopPropagation={() => toggleGsSelect('wallhavenSorting')}
                  aria-expanded={gsSelectOpen === 'wallhavenSorting'}
                >
                  <span>{wallhavenSorting}</span>
                  <span class="caret">▾</span>
                </button>
                {#if gsSelectOpen === 'wallhavenSorting'}
                  <div class="gs-select-menu">
                    {#each wallhavenSortingOptions as option}
                      <button type="button" class="gs-option" on:click|stopPropagation={() => selectWallhavenSorting(option)}>
                        {option}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <div class="settings-field">
              <span class="field-label">Color filter</span>
              <div class="color-select-row">
                <button type="button" class="secondary" on:click={() => (showColorModal = true)}>Select Color</button>
                <span class="color-chip-selected" style={wallhavenColorStyle(wallhavenColors)} title={wallhavenColors || 'none'}></span>
                <button type="button" class="secondary" on:click={() => (wallhavenColors = '')}>Clear</button>
              </div>
            </div>
            <hr class="section-divider" />
            <div class="settings-field">
              <label for="wallhaven-ttl">TTL seconds (optional)</label>
              <input id="wallhaven-ttl" type="number" min="0" bind:value={wallhavenTtlSec} placeholder="0 = default cache ttl" />
            </div>
          </div>
          <div class="row actions-buttons-row settings-actions-row">
            <button class="secondary" on:click={loadPacksRaw} disabled={busyPacks}>Reload</button>
            <button on:click={saveWallhavenPack} disabled={busyPacks}>Save Wallhaven Pack</button>
          </div>
        </div>

        <div class="card packs-configured-card">
          <h3>Configured Wallhaven Packs</h3>
          {#if packsByType('wallhaven').length === 0}
            <p class="muted">No wallhaven packs yet.</p>
          {:else}
            <div class="pack-list">
              {#each packsByType('wallhaven') as row (row.name)}
                <div class="pack-row">
                  <div class="pack-main">
                    <span class="badge">{row.name}</span>
                    <span class="badge">{String(row.pack.keyword ?? '')}</span>
                    <span class="badge">{Array.isArray(row.pack.subthemes) ? row.pack.subthemes.length : 0} subthemes</span>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => editWallhavenPack(row.name, row.pack)} disabled={busyPacks}>Edit</button>
                    <button class="secondary danger-outline" on:click={() => removePack(row.name)} disabled={busyPacks}>Delete</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if packTab === 'unsplash'}
        <h2>Unsplash</h2>
        <div class="card">
          <div class="settings-grid wallhaven-grid">
            <div class="settings-field">
              <label for="unsplash-pack-name">Pack Name</label>
              <input id="unsplash-pack-name" bind:value={unsplashPackName} placeholder="e.g. unsplash-japan" />
            </div>
            <div class="settings-field">
              <label for="unsplash-pack-query">Query</label>
              <input id="unsplash-pack-query" bind:value={unsplashQuery} placeholder="e.g. japan" />
            </div>
            <div class="settings-field">
              <label for="unsplash-pack-subthemes">Subthemes (comma separated)</label>
              <input id="unsplash-pack-subthemes" bind:value={unsplashSubthemes} placeholder="night, cyberpunk" />
            </div>
            <div class="settings-field">
              <label for="unsplash-pack-apikey">API Key (optional)</label>
              <input id="unsplash-pack-apikey" type="password" bind:value={unsplashPackApiKey} placeholder="set key while creating/updating" />
            </div>
            <hr class="section-divider" />
            <div class="settings-field">
              <label for="unsplash-orientation">Orientation</label>
              <div class="gs-select">
                <button type="button" class="gs-select-trigger" on:click|stopPropagation={() => toggleGsSelect('unsplashOrientation')} aria-expanded={gsSelectOpen === 'unsplashOrientation'}>
                  <span>{unsplashOrientation}</span>
                  <span class="caret">▾</span>
                </button>
                {#if gsSelectOpen === 'unsplashOrientation'}
                  <div class="gs-select-menu">
                    {#each unsplashOrientationOptions as option}
                      <button type="button" class="gs-option" on:click|stopPropagation={() => { unsplashOrientation = option; gsSelectOpen = null; }}>
                        {option}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <div class="settings-field">
              <label for="unsplash-content-filter">Content Filter</label>
              <div class="gs-select">
                <button type="button" class="gs-select-trigger" on:click|stopPropagation={() => toggleGsSelect('unsplashContentFilter')} aria-expanded={gsSelectOpen === 'unsplashContentFilter'}>
                  <span>{unsplashContentFilter}</span>
                  <span class="caret">▾</span>
                </button>
                {#if gsSelectOpen === 'unsplashContentFilter'}
                  <div class="gs-select-menu">
                    {#each unsplashContentFilterOptions as option}
                      <button type="button" class="gs-option" on:click|stopPropagation={() => { unsplashContentFilter = option; gsSelectOpen = null; }}>
                        {option}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <div class="settings-field">
              <label for="unsplash-topics">Topics (comma separated)</label>
              <input id="unsplash-topics" bind:value={unsplashTopics} placeholder="architecture, nature" />
            </div>
            <div class="settings-field">
              <label for="unsplash-collections">Collections (comma separated IDs)</label>
              <input id="unsplash-collections" bind:value={unsplashCollections} placeholder="123, 456" />
            </div>
            <div class="settings-field">
              <label for="unsplash-username">Username (optional)</label>
              <input id="unsplash-username" bind:value={unsplashUsername} placeholder="photographer_username" />
            </div>
            <div class="settings-field">
              <label for="unsplash-image-width">Image Width</label>
              <input id="unsplash-image-width" type="number" min="1" bind:value={unsplashImageWidth} />
            </div>
            <div class="settings-field">
              <label for="unsplash-image-height">Image Height</label>
              <input id="unsplash-image-height" type="number" min="1" bind:value={unsplashImageHeight} />
            </div>
            <div class="settings-field">
              <label for="unsplash-image-fit">Image Fit</label>
              <div class="gs-select">
                <button type="button" class="gs-select-trigger" on:click|stopPropagation={() => toggleGsSelect('unsplashImageFit')} aria-expanded={gsSelectOpen === 'unsplashImageFit'}>
                  <span>{unsplashImageFit}</span>
                  <span class="caret">▾</span>
                </button>
                {#if gsSelectOpen === 'unsplashImageFit'}
                  <div class="gs-select-menu">
                    {#each unsplashImageFitOptions as option}
                      <button type="button" class="gs-option" on:click|stopPropagation={() => { unsplashImageFit = option; gsSelectOpen = null; }}>
                        {option}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <div class="settings-field">
              <label for="unsplash-image-quality">Image Quality</label>
              <input id="unsplash-image-quality" type="number" min="1" max="100" bind:value={unsplashImageQuality} />
            </div>
            <div class="settings-field">
              <label for="unsplash-ttl">TTL seconds (optional)</label>
              <input id="unsplash-ttl" type="number" min="0" bind:value={unsplashTtlSec} placeholder="0 = default cache ttl" />
            </div>
          </div>
          <div class="row actions-buttons-row settings-actions-row">
            <button class="secondary" on:click={loadPacksRaw} disabled={busyPacks}>Reload</button>
            <button on:click={saveUnsplashPack} disabled={busyPacks}>Save Unsplash Pack</button>
          </div>
        </div>

        <div class="card packs-configured-card">
          <h3>Configured Unsplash Packs</h3>
          {#if packsByType('unsplash').length === 0}
            <p class="muted">No unsplash packs yet.</p>
          {:else}
            <div class="pack-list">
              {#each packsByType('unsplash') as row (row.name)}
                <div class="pack-row">
                  <div class="pack-main">
                    <span class="badge">{row.name}</span>
                    <span class="badge">{String(row.pack.query ?? '')}</span>
                    <span class="badge">{Array.isArray(row.pack.subthemes) ? row.pack.subthemes.length : 0} subthemes</span>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => editUnsplashPack(row.name, row.pack)} disabled={busyPacks}>Edit</button>
                    <button class="secondary danger-outline" on:click={() => removePack(row.name)} disabled={busyPacks}>Delete</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if packTab === 'reddit'}
        <h2>Reddit</h2>
        <div class="card">
          <div class="settings-grid wallhaven-grid">
            <div class="settings-field">
              <label for="reddit-pack-name">Pack Name</label>
              <input id="reddit-pack-name" bind:value={redditPackName} placeholder="e.g. reddit-anime" />
            </div>
            <div class="settings-field">
              <label for="reddit-subreddits">Subreddits (comma separated)</label>
              <input id="reddit-subreddits" bind:value={redditSubreddits} placeholder="wallpapers, animewallpaper" />
            </div>
            <div class="settings-field">
              <label for="reddit-subthemes">Subthemes (comma separated)</label>
              <input id="reddit-subthemes" bind:value={redditSubthemes} placeholder="night, minimal, cyberpunk" />
            </div>
            <div class="settings-field">
              <label for="reddit-allow-sfw">Allow SFW only</label>
              <div class="row">
                <input id="reddit-allow-sfw" type="checkbox" bind:checked={redditAllowSfw} />
                <span class="muted">If enabled, NSFW posts are skipped.</span>
              </div>
            </div>
            <hr class="section-divider" />
            <div class="settings-field">
              <label for="reddit-min-width">Min Width</label>
              <input id="reddit-min-width" type="number" min="0" bind:value={redditMinWidth} />
            </div>
            <div class="settings-field">
              <label for="reddit-min-height">Min Height</label>
              <input id="reddit-min-height" type="number" min="0" bind:value={redditMinHeight} />
            </div>
            <div class="settings-field">
              <label for="reddit-ratio-w">Ratio W</label>
              <input id="reddit-ratio-w" type="number" min="0" bind:value={redditRatioW} />
            </div>
            <div class="settings-field">
              <label for="reddit-ratio-h">Ratio H</label>
              <input id="reddit-ratio-h" type="number" min="0" bind:value={redditRatioH} />
            </div>
            <div class="settings-field">
              <label for="reddit-ttl">TTL seconds (optional)</label>
              <input id="reddit-ttl" type="number" min="0" bind:value={redditTtlSec} placeholder="0 = default cache ttl" />
            </div>
          </div>
          <div class="row actions-buttons-row settings-actions-row">
            <button class="secondary" on:click={loadPacksRaw} disabled={busyPacks}>Reload</button>
            <button on:click={saveRedditPack} disabled={busyPacks}>Save Reddit Pack</button>
          </div>
        </div>

        <div class="card packs-configured-card">
          <h3>Configured Reddit Packs</h3>
          {#if packsByType('reddit').length === 0}
            <p class="muted">No reddit packs yet.</p>
          {:else}
            <div class="pack-list">
              {#each packsByType('reddit') as row (row.name)}
                <div class="pack-row">
                  <div class="pack-main">
                    <span class="badge">{row.name}</span>
                    <span class="badge">
                      {Array.isArray(row.pack.subreddits)
                        ? row.pack.subreddits.join(', ')
                        : String(row.pack.subreddits ?? '')}
                    </span>
                    <span class="badge">{Array.isArray(row.pack.subthemes) ? row.pack.subthemes.length : 0} subthemes</span>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => editRedditPack(row.name, row.pack)} disabled={busyPacks}>Edit</button>
                    <button class="secondary danger-outline" on:click={() => removePack(row.name)} disabled={busyPacks}>Delete</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if packTab === 'generic_json'}
        <h2>Generic JSON</h2>
        <div class="card">
          <div class="settings-grid wallhaven-grid">
            <div class="settings-field">
              <label for="gj-pack-name">Pack Name</label>
              <input id="gj-pack-name" bind:value={genericJsonPackName} placeholder="e.g. nasa" />
            </div>
            <div class="settings-field">
              <label for="gj-endpoint">Endpoint URL</label>
              <input id="gj-endpoint" bind:value={genericJsonEndpoint} placeholder="https://api.example.com/feed" />
            </div>
            <div class="settings-field">
              <label for="gj-image-path">Image JSONPath</label>
              <input id="gj-image-path" bind:value={genericJsonImagePath} placeholder="$.items[0].image" />
            </div>
            <div class="settings-field">
              <label for="gj-image-prefix">Image Prefix (optional)</label>
              <input id="gj-image-prefix" bind:value={genericJsonImagePrefix} placeholder="https://cdn.example.com" />
            </div>
            <hr class="section-divider" />
            <div class="settings-field">
              <label for="gj-post-path">Post JSONPath (optional)</label>
              <input id="gj-post-path" bind:value={genericJsonPostPath} placeholder="$.items[0].url" />
            </div>
            <div class="settings-field">
              <label for="gj-post-prefix">Post Prefix (optional)</label>
              <input id="gj-post-prefix" bind:value={genericJsonPostPrefix} placeholder="https://example.com" />
            </div>
            <div class="settings-field">
              <label for="gj-author-name-path">Author Name JSONPath (optional)</label>
              <input id="gj-author-name-path" bind:value={genericJsonAuthorNamePath} placeholder="$.items[0].author.name" />
            </div>
            <div class="settings-field">
              <label for="gj-author-url-path">Author URL JSONPath (optional)</label>
              <input id="gj-author-url-path" bind:value={genericJsonAuthorUrlPath} placeholder="$.items[0].author.url" />
            </div>
            <div class="settings-field">
              <label for="gj-author-url-prefix">Author URL Prefix (optional)</label>
              <input id="gj-author-url-prefix" bind:value={genericJsonAuthorUrlPrefix} placeholder="https://example.com/users/" />
            </div>
            <div class="settings-field">
              <label for="gj-domain">Domain (optional)</label>
              <input id="gj-domain" bind:value={genericJsonDomain} placeholder="example.com" />
            </div>
            <div class="settings-field">
              <label for="gj-ttl">TTL seconds (optional)</label>
              <input id="gj-ttl" type="number" min="0" bind:value={genericJsonTtlSec} placeholder="0 = default cache ttl" />
            </div>
          </div>
          <div class="row actions-buttons-row settings-actions-row">
            <button class="secondary" on:click={loadPacksRaw} disabled={busyPacks}>Reload</button>
            <button on:click={saveGenericJsonPack} disabled={busyPacks}>Save Generic JSON Pack</button>
          </div>
        </div>

        <div class="card packs-configured-card">
          <h3>Configured Generic JSON Packs</h3>
          {#if packsByType('generic_json').length === 0}
            <p class="muted">No generic_json packs yet.</p>
          {:else}
            <div class="pack-list">
              {#each packsByType('generic_json') as row (row.name)}
                <div class="pack-row">
                  <div class="pack-main">
                    <span class="badge">{row.name}</span>
                    <span class="badge">{String(row.pack.endpoint ?? '')}</span>
                    <span class="badge">{String(row.pack.imagePath ?? '')}</span>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => editGenericJsonPack(row.name, row.pack)} disabled={busyPacks}>Edit</button>
                    <button class="secondary danger-outline" on:click={() => removePack(row.name)} disabled={busyPacks}>Delete</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if packTab === 'local'}
        <h2>Local</h2>
        <div class="card">
          <div class="settings-grid wallhaven-grid">
            <div class="settings-field">
              <label for="local-pack-name">Pack Name</label>
              <input id="local-pack-name" bind:value={localPackName} placeholder="e.g. sao-local" />
            </div>
            <div class="settings-field settings-field-span-2">
              <label for="local-path-list">Folders</label>
              <div id="local-path-list" class="local-paths-list">
                {#if localPathItems.length === 0}
                  <p class="muted">No folders selected yet.</p>
                {:else}
                  {#each localPathItems as item, i (`${item}-${i}`)}
                    <div class="local-path-row">
                      <span class="local-folder-icon" aria-hidden="true"></span>
                      <div class="local-path-text">
                        <div class="local-path-name">{folderNameFromPath(item)}</div>
                        <div class="local-path-full">{item}</div>
                      </div>
                      <button
                        class="secondary local-remove-btn"
                        on:click={() => removeLocalFolderPath(i)}
                        disabled={busyPacks}
                        title="Remove folder"
                        aria-label="Remove folder"
                      >
                        -
                      </button>
                    </div>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
          <div class="row actions-buttons-row settings-actions-row">
            <button class="secondary" on:click={loadPacksRaw} disabled={busyPacks}>Reload</button>
            <button class="secondary" on:click={addLocalFolderPath} disabled={busyPacks}>+</button>
            <button on:click={saveLocalPack} disabled={busyPacks}>Save Local Pack</button>
          </div>
        </div>

        <div class="card packs-configured-card">
          <h3>Configured Local Packs</h3>
          {#if packsByType('local').length === 0}
            <p class="muted">No local packs yet.</p>
          {:else}
            <div class="pack-list">
              {#each packsByType('local') as row (row.name)}
                <div class="pack-row">
                  <div class="pack-main">
                    <span class="badge">{row.name}</span>
                    <span class="badge">{Array.isArray(row.pack.paths) ? row.pack.paths.length : 0} paths</span>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => editLocalPack(row.name, row.pack)} disabled={busyPacks}>Edit</button>
                    <button class="secondary danger-outline" on:click={() => removePack(row.name)} disabled={busyPacks}>Delete</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else if packTab === 'static_url'}
        <h2>Static URL</h2>
        <div class="card">
          <div class="settings-grid wallhaven-grid">
            <div class="settings-field">
              <label for="su-pack-name">Pack Name</label>
              <input id="su-pack-name" bind:value={staticUrlPackName} placeholder="e.g. static-demo" />
            </div>
            <div class="settings-field">
              <label for="su-single-url">Single URL (optional)</label>
              <input id="su-single-url" bind:value={staticUrlSingle} placeholder="https://example.com/image.jpg" />
            </div>
            <div class="settings-field settings-field-span-2">
              <label for="su-url-list">Multiple URLs (comma/newline separated)</label>
              <textarea id="su-url-list" rows="3" bind:value={staticUrlList} placeholder="https://a.jpg, https://b.jpg"></textarea>
            </div>
            <hr class="section-divider" />
            <div class="settings-field">
              <label for="su-different-images">Different Images</label>
              <div class="row">
                <input id="su-different-images" type="checkbox" bind:checked={staticUrlDifferentImages} />
                <span class="muted">If enabled, rotates through url list entries.</span>
              </div>
            </div>
            <div class="settings-field">
              <label for="su-count">Count</label>
              <input id="su-count" type="number" min="1" bind:value={staticUrlCount} />
            </div>
            <div class="settings-field">
              <label for="su-ttl">TTL seconds (optional)</label>
              <input id="su-ttl" type="number" min="0" bind:value={staticUrlTtlSec} placeholder="0 = default cache ttl" />
            </div>
            <div class="settings-field">
              <label for="su-author-name">Author Name (optional)</label>
              <input id="su-author-name" bind:value={staticUrlAuthorName} placeholder="author" />
            </div>
            <div class="settings-field">
              <label for="su-author-url">Author URL (optional)</label>
              <input id="su-author-url" bind:value={staticUrlAuthorUrl} placeholder="https://author.site" />
            </div>
            <div class="settings-field">
              <label for="su-domain">Domain (optional)</label>
              <input id="su-domain" bind:value={staticUrlDomain} placeholder="example.com" />
            </div>
            <div class="settings-field">
              <label for="su-post-url">Post URL (optional)</label>
              <input id="su-post-url" bind:value={staticUrlPostUrl} placeholder="https://source-post" />
            </div>
          </div>
          <div class="row actions-buttons-row settings-actions-row">
            <button class="secondary" on:click={loadPacksRaw} disabled={busyPacks}>Reload</button>
            <button on:click={saveStaticUrlPack} disabled={busyPacks}>Save Static URL Pack</button>
          </div>
        </div>

        <div class="card packs-configured-card">
          <h3>Configured Static URL Packs</h3>
          {#if packsByType('static_url').length === 0}
            <p class="muted">No static_url packs yet.</p>
          {:else}
            <div class="pack-list">
              {#each packsByType('static_url') as row (row.name)}
                <div class="pack-row">
                  <div class="pack-main">
                    <span class="badge">{row.name}</span>
                    <span class="badge">
                      {Array.isArray(row.pack.urls) ? `${row.pack.urls.length} urls` : (row.pack.url ? 'single url' : 'no url')}
                    </span>
                    <span class="badge">{row.pack.differentImages ? 'different' : 'single-repeat'}</span>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => editStaticUrlPack(row.name, row.pack)} disabled={busyPacks}>Edit</button>
                    <button class="secondary danger-outline" on:click={() => removePack(row.name)} disabled={busyPacks}>Delete</button>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <div class="card">
          <p class="muted">This source tab will be implemented next. Starting point is ready.</p>
        </div>
      {/if}
    {:else if activeSection === 'logs'}
      <h2>{tr('Logs', 'Logs')}</h2>
      <div class="card">
        <div class="row actions-input-row">
          <label for="logs-limit">{tr('Limit', 'Limite')}</label>
          <input id="logs-limit" type="number" min="1" bind:value={logsLimit} />
          <label for="logs-source">{tr('Source', 'Source')}</label>
          <select id="logs-source" bind:value={logsSource}>
            <option value="all">all</option>
            <option value="wallhaven">wallhaven</option>
            <option value="unsplash">unsplash</option>
            <option value="reddit">reddit</option>
            <option value="generic_json">generic_json</option>
            <option value="static_url">static_url</option>
          </select>
          <label for="logs-level">{tr('Level', 'Nivel')}</label>
          <select id="logs-level" bind:value={logsLevel}>
            <option value="all">all</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
          <label for="logs-pack">{tr('Pack', 'Pack')}</label>
          <input id="logs-pack" bind:value={logsPack} placeholder={tr('optional pack name', 'nombre de pack opcional')} />
          <label for="logs-q">{tr('Search', 'Buscar')}</label>
          <input id="logs-q" bind:value={logsQuery} placeholder={tr('url, action, message...', 'url, accion, mensaje...')} />
          <button class="secondary" on:click={loadSystemLogs} disabled={systemLogsBusy}>{tr('Refresh Logs', 'Actualizar Logs')}</button>
          <button class="secondary danger-outline" on:click={openLogsClearConfirm} disabled={systemLogsBusy}>{tr('Clear Logs', 'Limpiar Logs')}</button>
        </div>
        {#if systemLogs.length === 0}
          <p class="muted">{tr('No logs yet.', 'Aun no hay logs.')}</p>
        {:else}
          <div class="syslog-list">
            {#each systemLogs as row, i (`${row.ts}-${row.action}-${i}`)}
              <div class="syslog-item">
                <div class="row">
                  <span class={`badge status ${row.level === 'error' ? 'bad' : row.level === 'warn' ? 'warn' : 'ok'}`}>{row.level}</span>
                  <span class="badge">{formatTimestamp(row.ts)}</span>
                  <span class="badge">{row.source ?? 'n/a'}</span>
                  <span class="badge">{row.pack ?? 'n/a'}</span>
                  <span class="badge">{row.action}</span>
                  {#if row.status !== undefined}
                    <span class="badge">HTTP {row.status}</span>
                  {/if}
                </div>
                {#if row.url}
                  <div class="syslog-url">{row.url}</div>
                {/if}
                {#if row.message}
                  <div class="muted">{row.message}</div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {:else if activeSection === 'history'}
      <h2>{tr('History', 'Historial')}</h2>
      <div class="card">
        <div class="row actions-input-row">
          <label for="history-limit">{tr('Limit', 'Limite')}</label>
          <input id="history-limit" type="number" min="1" bind:value={historyLimit} />
          <label for="history-output">{tr('Output', 'Salida')}</label>
          <select id="history-output" value={historyOutputFilter} on:change={onHistoryFilterChange}>
            <option value="all">all</option>
            {#each historyOutputOptions as o}
              <option value={o}>{o}</option>
            {/each}
          </select>
          <button class="secondary" on:click={refreshHistorySection} disabled={busyHistory}>{tr('Refresh History', 'Actualizar Historial')}</button>
          <button class="secondary danger-outline" on:click={openHistoryClearConfirm} disabled={busyHistory}>{tr('Clear History', 'Limpiar Historial')}</button>
        </div>
        {#if historyEntries.length === 0}
          <p class="muted">{tr('No history entries yet.', 'Aun no hay entradas de historial.')}</p>
        {:else}
          <div class="history-groups">
            {#each groupedHistoryEntries(historyEntries) as group}
              <div class="history-group">
                <div class="history-group-header">
                  <span class="badge">{group.output}</span>
                  <span class="badge">{group.items.length} items</span>
                </div>
                <div class="history-list">
                  {#each group.items as item, idx (`${item.path}-${item.timestamp}-${idx}`)}
                    <div class="history-item">
                      <div class="history-thumb-wrap">
                        {#if imageSrc(item.path)}
                          <img class="history-thumb" src={imageSrc(item.path) ?? ''} alt={`history wallpaper ${item.output}`} />
                        {:else}
                          <div class="monitor-placeholder">No preview</div>
                        {/if}
                      </div>
                      <div class="history-meta">
                        <div class="row">
                          <span class="badge">{item.pack}</span>
                          <span class="badge">{formatTimestamp(item.timestamp)}</span>
                        </div>
                        <div class="history-path">{item.path}</div>
                      </div>
                      <button
                        class={`star-btn ${isFavorite(item.path) ? 'on' : ''}`}
                        on:click={() => toggleFavorite(item)}
                        disabled={busyHistory}
                        aria-label={isFavorite(item.path) ? 'Remove favorite' : 'Add favorite'}
                        title={isFavorite(item.path) ? 'Remove favorite' : 'Add favorite'}
                      >
                        {isFavorite(item.path) ? '★' : '☆'}
                      </button>
                    </div>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {/if}
        {#if historyHasMore}
          <div class="row actions-buttons-row">
            <button class="secondary" on:click={loadMoreHistory} disabled={busyHistory}>{tr('Load More', 'Cargar Mas')}</button>
          </div>
        {/if}
      </div>
    {:else if activeSection === 'library'}
      <h2>{tr('Wallpapers', 'Wallpapers')}</h2>
      <div class="card">
        <div class="row actions-buttons-row">
          <span class="badge">total: {galleryItems.length}</span>
          <span class="badge">showing: {galleryFiltered.length}</span>
          {#if galleryRoot}
            <span class="badge">root: {galleryRoot}</span>
          {/if}
        </div>
        <div class="row actions-input-row">
          <label for="gallery-pack">{tr('Pack', 'Pack')}</label>
          <select id="gallery-pack" bind:value={galleryPackFilter}>
            <option value="all">all</option>
            {#each galleryPackOptions() as p}
              <option value={p}>{p}</option>
            {/each}
          </select>
          <label for="gallery-sort">{tr('Sort', 'Orden')}</label>
          <select id="gallery-sort" bind:value={gallerySort}>
            <option value="newest">newest</option>
            <option value="oldest">oldest</option>
            <option value="name">name</option>
          </select>
          <label for="gallery-search">{tr('Search', 'Buscar')}</label>
          <input id="gallery-search" bind:value={gallerySearch} placeholder={tr('file name or path', 'nombre o ruta del archivo')} />
          <label class="inline-check"><input type="checkbox" bind:checked={galleryOnlyFavorites} /> {tr('favorites only', 'solo favoritos')}</label>
          <button class="secondary" on:click={loadWallpaperLibrary} disabled={galleryBusy}>{tr('Refresh Library', 'Actualizar Libreria')}</button>
        </div>
        {#if galleryFiltered.length === 0}
          <p class="muted">{tr('No wallpapers matched the selected filters.', 'No hay wallpapers con los filtros seleccionados.')}</p>
        {:else}
          <div class="wallpaper-gallery-grid">
            {#each galleryFiltered as item, i (`${item.path}-${i}`)}
              <div class="gallery-item-card">
                <div class="gallery-image-wrap">
                  {#if imageSrc(item.path)}
                    <img
                      class="gallery-image"
                      src={imageSrc(item.path) ?? ''}
                      alt={item.fileName}
                      on:error={(e) => onGalleryImageError(e, item.path)}
                    />
                  {:else}
                    <div class="monitor-placeholder">No preview</div>
                  {/if}
                  <button
                    class={`star-btn gallery-fav-btn ${isFavorite(item.path) ? 'on' : ''}`}
                    on:click={() => toggleFavoritePath(item.path)}
                    disabled={galleryBusy}
                    aria-label={isFavorite(item.path) ? 'Remove favorite' : 'Add favorite'}
                    title={isFavorite(item.path) ? 'Remove favorite' : 'Add favorite'}
                  >
                    {isFavorite(item.path) ? '★' : '☆'}
                  </button>
                </div>
                <div class="gallery-meta">
                  <div class="row">
                    <span class="badge">{item.pack}</span>
                    <span class="badge">{formatTimestamp(item.modifiedMs)}</span>
                  </div>
                  <div class="history-path">{item.path}</div>
                </div>
              </div>
            {/each}
          </div>
          {#if galleryHasMore}
            <div class="row actions-buttons-row">
              <button class="secondary" on:click={loadMoreGallery}>{tr('Load More', 'Cargar Mas')}</button>
            </div>
          {/if}
        {/if}
      </div>
    {/if}

    {#if showResolutionModal}
      <div
        class="modal-backdrop"
        role="button"
        tabindex="0"
        on:click|self={() => (showResolutionModal = false)}
        on:keydown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') showResolutionModal = false;
        }}
      >
        <div class="modal-card resolution-modal" role="dialog" aria-modal="true" aria-label="Wallhaven resolution picker">
          <h3>{tr('Pick a resolution', 'Selecciona una resolucion')} ({wallhavenRatioMode})</h3>
          <div class="resolution-grid">
            {#each wallhavenResByRatio[wallhavenRatioMode] ?? [] as r}
              <button type="button" class="secondary resolution-option" on:click={() => { wallhavenAtleast = r; showResolutionModal = false; }}>
                {r}
              </button>
            {/each}
          </div>
          <div class="row actions-buttons-row">
            <button class="secondary" on:click={() => (showResolutionModal = false)}>{tr('Close', 'Cerrar')}</button>
          </div>
        </div>
      </div>
    {/if}

    {#if showColorModal}
      <div
        class="modal-backdrop"
        role="button"
        tabindex="0"
        on:click|self={() => (showColorModal = false)}
        on:keydown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') showColorModal = false;
        }}
      >
        <div class="modal-card resolution-modal" role="dialog" aria-modal="true" aria-label="Wallhaven color picker">
          <h3>{tr('Pick a color', 'Selecciona un color')}</h3>
          <div class="color-grid-modal">
            {#each wallhavenColorOptions as color}
              <button
                type="button"
                class={`color-option ${wallhavenColors === color ? 'active' : ''}`}
                style={wallhavenColorStyle(color)}
                title={color || 'none'}
                on:click={() => { wallhavenColors = color; showColorModal = false; }}
              ></button>
            {/each}
          </div>
          <div class="row actions-buttons-row">
            <button class="secondary" on:click={() => (showColorModal = false)}>{tr('Close', 'Cerrar')}</button>
          </div>
        </div>
      </div>
    {/if}

    {#if showCleanConfirm}
      <div
        class="modal-backdrop"
        role="button"
        tabindex="0"
        on:click|self={closeCleanConfirm}
        on:keydown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeCleanConfirm();
        }}
      >
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="Clean wallpapers confirmation"
        >
          <h3>{tr('Clean Wallpapers Cache', 'Limpiar Cache de Wallpapers')}</h3>
          <p class="muted">
            {#if selectedPack === 'all'}
              {tr('This will hard-clean downloaded wallpapers for ALL packs. Favorites are preserved.', 'Esto hara una limpieza total de wallpapers descargados para TODOS los packs. Los favoritos se conservan.')}
            {:else}
              {tr('This will hard-clean downloaded wallpapers only for pack:', 'Esto hara una limpieza total de wallpapers descargados solo para el pack:')} <strong>{selectedPack}</strong>. {tr('Favorites are preserved.', 'Los favoritos se conservan.')}
            {/if}
          </p>
          <div class="row">
            <button class="secondary" on:click={closeCleanConfirm} disabled={busy}>{tr('Cancel', 'Cancelar')}</button>
            <button class="danger" on:click={runCleanWallpapers} disabled={busy}>
              {#if selectedPack === 'all'}{tr('Confirm Clean All', 'Confirmar Limpieza Total')}{:else}{tr('Confirm Clean Pack', 'Confirmar Limpieza de Pack')}{/if}
            </button>
          </div>
        </div>
      </div>
    {/if}

    {#if showHistoryClearConfirm}
      <div
        class="modal-backdrop"
        role="button"
        tabindex="0"
        on:click|self={closeHistoryClearConfirm}
        on:keydown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeHistoryClearConfirm();
        }}
      >
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="Clear history confirmation"
        >
          <h3>{tr('Clear History', 'Limpiar Historial')}</h3>
          <p class="muted">
            {tr('This will remove all entries from wallpaper history.', 'Esto eliminara todas las entradas del historial de wallpapers.')}
          </p>
          <div class="row">
            <button class="secondary" on:click={closeHistoryClearConfirm} disabled={busyHistory}>{tr('Cancel', 'Cancelar')}</button>
            <button class="danger" on:click={confirmHistoryClear} disabled={busyHistory}>{tr('Confirm Clear', 'Confirmar Limpieza')}</button>
          </div>
        </div>
      </div>
    {/if}

    {#if showLogsClearConfirm}
      <div
        class="modal-backdrop"
        role="button"
        tabindex="0"
        on:click|self={closeLogsClearConfirm}
        on:keydown={(e) => {
          if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') closeLogsClearConfirm();
        }}
      >
        <div
          class="modal-card"
          role="dialog"
          aria-modal="true"
          aria-label="Clear logs confirmation"
        >
          <h3>{tr('Clear Logs', 'Limpiar Logs')}</h3>
          <p class="muted">
            {tr('This will remove all system logs. This action cannot be undone.', 'Esto eliminara todos los logs del sistema. Esta accion no se puede deshacer.')}
          </p>
          <div class="row">
            <button class="secondary" on:click={closeLogsClearConfirm} disabled={systemLogsBusy}>{tr('Cancel', 'Cancelar')}</button>
            <button class="danger" on:click={confirmLogsClear} disabled={systemLogsBusy}>{tr('Confirm Clear', 'Confirmar Limpieza')}</button>
          </div>
        </div>
      </div>
    {/if}
  </main>
</div>
