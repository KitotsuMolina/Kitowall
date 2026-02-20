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

  type KitsuneStatusReport = {
    ok: boolean;
    installed: boolean;
    error?: string;
    commands: string[];
    sections: string[];
  };

  type KitsuneRunResult = {
    ok: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    args: string[];
  };

  type LiveDepsStatus = {
    ok: boolean;
    required: string[];
    optional: string[];
    deps: Record<string, boolean>;
    missing: string[];
    install?: string;
  };

  type LiveWorkshopItem = {
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
  };

  type LiveWorkshopDetails = LiveWorkshopItem & {
    additional_previews: string[];
    description_short?: string;
    file_size?: number;
    item_url?: string;
  };

  type LiveSearchResponse = {
    items: LiveWorkshopItem[];
    page: number;
    page_size: number;
    total?: number;
    cached?: boolean;
  };

  type LiveDownloadResponse = {
    ok: boolean;
    job_id: string;
    status: 'queued' | 'downloading' | 'moving' | 'done' | 'error';
  };

  type LiveJob = {
    id: string;
    status: 'queued' | 'downloading' | 'moving' | 'done' | 'error';
    publishedfileid: string;
    targetDir: string;
    outputDir?: string;
    error?: string;
    logs: string[];
  };

  type LiveLibraryItem = {
    id: string;
    path: string;
    metadata?: string;
    meta?: LiveWorkshopDetails | LiveWorkshopItem;
  };

  type LiveLibraryResponse = {
    root: string;
    items: LiveLibraryItem[];
  };

  type LiveSteamRootsResponse = {
    ok: boolean;
    steam_roots: string[];
  };

  type LiveSteamScanResponse = {
    ok: boolean;
    sources: string[];
    count: number;
    ids: string[];
  };

  type LiveSteamSyncResponse = {
    ok: boolean;
    sources: string[];
    imported: number;
    skipped: number;
    total: number;
  };

  type LiveAppStatus = {
    ok: boolean;
    installed: boolean;
    manifests: string[];
    steamapps: string[];
  };

  type LiveAuthorityState = {
    mode?: 'livewallpaper';
    started_at?: number;
    snapshot_id?: string;
    instances?: Record<string, {id?: string; pid?: number; backend?: string; type?: string}>;
  };

  type LiveAuthorityResponse = {
    ok: boolean;
    active: boolean;
    lock_path: string;
    state_path: string;
    state?: LiveAuthorityState;
  };

  type LiveApplyResponse = {
    ok: boolean;
    applied?: boolean;
    monitor?: string;
    id?: string;
    backend?: string;
    pid?: number;
  };

  type LiveProvider = 'moewalls' | 'motionbgs';
  type LiveVariant = 'hd' | '4k';
  type LiveQuality = 'auto' | 'hd' | '4k';
  type LiveProfile = 'performance' | 'balanced' | 'quality';

  type LiveVideoPlayConfig = {
    keep_services: boolean;
    mute_audio: boolean;
    profile: LiveProfile;
    display_fps: number | null;
    seamless_loop: boolean;
    loop_crossfade: boolean;
    loop_crossfade_seconds: number;
    optimize: boolean;
    proxy_width: number;
    proxy_fps: number;
    proxy_crf: number;
  };

  type LiveIndexItem = {
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
    video_config?: LiveVideoPlayConfig;
  };

  type LiveBrowseItemV2 = {
    provider: LiveProvider;
    title: string;
    page_url: string;
    slug: string;
    has_hd: boolean;
    has_4k: boolean;
    thumb_remote?: string;
    tags?: string[];
    preview_motion_remote?: string;
    preview_motion_local?: string;
    preview_motion_blob?: string;
  };

  type GroupLayerEntry = {
    index: number;
    enabled: string;
    mode: string;
    style: string;
    profile: string;
    color: string;
    alpha: string;
    runtime?: string;
    rotate?: string;
    profilesPipe?: string;
  };

  type SectionId = 'control' | 'settings' | 'history' | 'library' | 'packs' | 'logs' | 'kitsune' | 'kitsune-live';
  type UiLanguage = 'en' | 'es';
  type KitsuneTabId =
    | 'core'
    | 'profiles'
    | 'group'
    | 'visual'
    | 'render'
    | 'monitors'
    | 'system'
    | 'logs';

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
  let kitsuneBusy = false;
  let kitsuneStatus: KitsuneStatusReport | null = null;
  let kitsuneTab: KitsuneTabId = 'core';
  let kitsuneOutput = '';
  let kitsuneLastCommand = '';
  let kitsuneStartMonitor = '';
  let kitsuneMonitorOptions: string[] = [];
  let kitsuneStartMonitorOpen = false;
  let kitsuneStartMonitorFilter = '';
  let kitsuneVisibleMonitorOptions: string[] = [];
  let kitsuneStartProfile = '';
  let kitsuneProfileOptions: string[] = [];
  let kitsuneStartProfileOpen = false;
  let kitsuneStartProfileFilter = '';
  let kitsuneVisibleProfileOptions: string[] = [];
  let kitsuneStartProfilesSelected: string[] = [];
  let kitsuneStartProfilesOpen = false;
  let kitsuneStartTarget: 'mpvpaper' | 'layer-shell' = 'mpvpaper';
  let kitsuneStartMode: 'bars' | 'ring' = 'bars';
  let kitsuneInstallPackages = false;
  let kitsuneProfilesMode: 'bars' | 'ring' | 'all' = 'all';
  let kitsuneProfileName = '';
  let kitsuneProfileBase = '';
  let kitsuneProfileNew = '';
  let kitsuneProfileKey = '';
  let kitsuneProfileValue = '';
  let kitsuneProfileListMode: 'bars' | 'ring' = 'bars';
  let kitsuneProfileListValue = '';
  let kitsuneRotationSeconds = 10;
  let kitsuneTunePreset = 'balanced';
  let kitsuneTuneMode: 'bars' | 'ring' = 'bars';
  let kitsuneGroupFile = './config/groups/default.group';
  let kitsuneGroupOptions: string[] = [];
  let kitsuneGroupPickerOpen = false;
  let kitsuneGroupPickerFilter = '';
  let kitsuneVisibleGroupOptions: string[] = [];
  let kitsuneGroupCreateCandidate = '';
  let kitsuneGroupLayers: GroupLayerEntry[] = [];
  let kitsuneGroupLayersBusy = false;
  let kitsuneGroupLayerIndex = 1;
  let kitsuneGroupLayerEnabled: '1' | '0' = '1';
  let kitsuneGroupLayerEnabledOpen = false;
  let kitsuneGroupLayerMode: 'bars' | 'ring' = 'bars';
  let kitsuneGroupLayerModeOpen = false;
  let kitsuneGroupLayerStyle: 'bars' | 'bars_fill' | 'waves' | 'waves_fill' | 'dots' = 'bars';
  let kitsuneGroupLayerStyleOpen = false;
  let kitsuneGroupLayerProfile = 'bars_balanced';
  let kitsuneGroupLayerProfileOpen = false;
  let kitsuneGroupLayerProfileFilter = '';
  let kitsuneVisibleGroupLayerProfiles: string[] = [];
  let kitsuneGroupLayerColor = '#ffffff';
  let kitsuneGroupLayerAlpha = 0.35;
  let kitsuneGroupAddLayerOpen = false;
  let kitsuneGroupAddLayerSelected: string[] = [];
  let kitsuneGroupAddLayerOptions: Array<{id: string; label: string; spec: string}> = [];
  let kitsuneVisualMode: 'bars' | 'ring' = 'bars';
  let kitsuneVisualStyle: 'bars' | 'bars_fill' | 'waves' | 'waves_fill' | 'dots' = 'waves_fill';
  let kitsunePostfxEnable = 1;
  let kitsunePostfxBlurPasses = 1;
  let kitsunePostfxBlurMix = 0.18;
  let kitsunePostfxGlowStrength = 1.35;
  let kitsunePostfxGlowMix = 0.24;
  let kitsunePostfxScope: 'final' | 'layer' | 'mixed' = 'mixed';
  let kitsuneParticlesPreset: 'off' | 'low' | 'balanced' | 'high' = 'balanced';
  let kitsuneBackend: 'cpu' | 'gpu' = 'gpu';
  let kitsuneOutputTarget: 'mpvpaper' | 'layer-shell' = 'mpvpaper';
  let kitsuneSpectrumMode: 'single' | 'group' = 'single';
  let kitsuneRuntime: 'standard' | 'test' = 'standard';
  let kitsuneMonitorName = '';
  let kitsuneMonitorNameOpen = false;
  let kitsuneMonitorNameFilter = '';
  let kitsuneVisibleMonitorNameOptions: string[] = [];
  let kitsuneMonitorFallbackEnabled = 1;
  let kitsuneMonitorFallbackSeconds = 2;
  let kitsuneMonitorFallbackPreferFocused = 1;
  let kitsuneDynamicColor = 1;
  let kitsuneColorPollSeconds = 2;
  let kitsuneInstanceMonitor = '';
  let kitsuneInstanceMonitorOpen = false;
  let kitsuneInstanceMonitorFilter = '';
  let kitsuneVisibleInstanceMonitorOptions: string[] = [];
  let kitsuneAutostartMonitor = '';
  let kitsuneAutostartMonitorOpen = false;
  let kitsuneAutostartMonitorFilter = '';
  let kitsuneVisibleAutostartMonitorOptions: string[] = [];
  let kitsuneBenchmarkSeconds = 10;
  let kitsuneLogSource: 'renderer' | 'cava' | 'layer' | 'mpvpaper' | 'colorwatch' | 'monitorwatch' | 'all' = 'all';
  let kitsuneLogLines = 120;
  let kitsuneLogAllInstances = false;
  let kitsuneLogFollow = false;
  let liveBusy = false;
  let liveDepsBusy = false;
  let liveDepsStatus: LiveDepsStatus | null = null;
  let liveDepsManualCommand = '';
  let liveSort: 'top' | 'newest' | 'trend' | 'subscribed' | 'updated' = 'top';
  let liveSearchText = '';
  let liveTags = '';
  let livePage = 1;
  let livePageSize = 24;
  let liveSearchItems: LiveWorkshopItem[] = [];
  let liveSearchTotal: number | null = null;
  let liveSearchCached = false;
  let liveView: 'general' | 'downloaded' = 'general';
  let liveLibraryRoot = '';
  let liveLibraryItems: LiveLibraryItem[] = [];
  let liveFilterType: 'all' | 'video' | 'scene' | 'web' | 'application' | 'unknown' = 'all';
  let liveFilterAudio: 'all' | 'reactive' | 'static' = 'all';
  let liveFilterQuery = '';
  let liveSteamRoots: string[] = [];
  let liveSteamDetectedSources: string[] = [];
  let liveSteamDetectedCount = 0;
  let liveSteamManualRoot = '';
  let liveAppStatus: LiveAppStatus | null = null;
  let liveAuthority: LiveAuthorityResponse | null = null;
  let liveApplyMonitor = '';
  let liveSelected: LiveWorkshopDetails | LiveWorkshopItem | null = null;
  let liveSelectedSource: 'search' | 'library' | null = null;
  let liveSelectedLibraryPath = '';
  let liveSelectedPreviewDataUrl = '';
  let liveSideOpen = false;
  let liveSteamApiKey = '';
  let liveSteamApiKeyVisible = false;
  let liveSteamApiKeySaved = false;
  let liveSteamApiKeySavedAt: number | null = null;
  let liveDownloadTargetDir = '~/.local/share/kitsune/we/downloads';
  let liveCurrentJob: LiveJob | null = null;
  let liveJobPollTimer: ReturnType<typeof setInterval> | null = null;
  const livePreviewDataUrlCache = new Map<string, string>();
  let livePreviewDataUrlById: Record<string, string> = {};
  let liveV2ThumbDataStatus: Record<string, 'pending' | 'ready' | 'failed'> = {};
  let liveV2Tab: 'library' | 'explore' | 'config' = 'explore';
  let liveV2Busy = false;
  let liveV2Items: LiveIndexItem[] = [];
  let liveV2LibraryLoaded = false;
  let liveV2FavoritesOnly = false;
  let liveV2LibrarySideOpen = false;
  let liveV2SelectedLibrary: LiveIndexItem | null = null;
  let liveV2Query = '';
  let liveV2Page = 1;
  let liveV2Provider: 'all' | LiveProvider = 'all';
  let liveV2BrowseItems: LiveBrowseItemV2[] = [];
  let liveV2ExploreLoading = false;
  let liveV2ExploreLoaded = false;
  let liveV2SelectedBrowse: LiveBrowseItemV2 | null = null;
  let liveV2SideOpen = false;
  let liveV2PreviewLoading = false;
  let liveV2PreviewReq = 0;
  let liveV2PreviewRenderKey = 0;
  let liveV2PreviewRecoverCount = 0;
  let liveV2PreviewLastRecoverAt = 0;
  let liveV2PreviewRemountCount = 0;
  let liveV2PreviewLastRemountAt = 0;
  let liveV2PreviewBlobAttempted = false;
  let liveV2PreviewBlobRetryCount = 0;
  let liveV2PreviewHadPlayback = false;
  let liveV2PreviewEngine: 'native' | 'webview' = 'native';
  let liveV2NativePreviewLastSrc = '';
  let liveV2NativePreviewActive = false;
  let liveV2PreviewDebugLines: string[] = [];
  let liveV2SelectedUrl = '';
  let liveV2Quality: LiveQuality = 'auto';
  let liveV2Monitor = '';
  let liveV2Doctor: {ok: boolean; deps: Record<string, boolean>; fix: string[]} | null = null;
  let liveV2RunnerBin = 'kitsune-livewallpaper';
  let liveV2ApplyDefaults = {
    keep_services: false,
    mute_audio: false,
    profile: 'quality',
    display_fps: null as number | null,
    seamless_loop: true,
    loop_crossfade: true,
    loop_crossfade_seconds: 0.35,
    optimize: true,
    proxy_width_hd: 1920,
    proxy_width_4k: 3840,
    proxy_fps: 60,
    proxy_crf_hd: 18,
    proxy_crf_4k: 16
  };
  let liveV2DetailConfig: LiveVideoPlayConfig = {
    keep_services: false,
    mute_audio: false,
    profile: 'quality',
    display_fps: null,
    seamless_loop: true,
    loop_crossfade: true,
    loop_crossfade_seconds: 0.35,
    optimize: true,
    proxy_width: 1920,
    proxy_fps: 60,
    proxy_crf: 18
  };
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
    if (id === 'kitsune') {
      void loadKitsuneStatus();
    }
    if (id === 'kitsune-live') {
      void initLiveV2().then(() => {
        if (liveV2Tab === 'explore') {
          void ensureLiveV2ExploreLoaded();
        }
        if (liveV2Tab === 'library' && !liveV2LibraryLoaded) {
          void loadLiveV2Library();
        }
      });
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

  function isLiveServicesLocked(): boolean {
    return !!liveAuthority?.active;
  }

  function liveServicesLockMessage(): string {
    return tr(
      'LiveWallpapers is active. Rotation/timer/system service actions are disabled in this module.',
      'LiveWallpapers esta activo. Las acciones de rotacion/timer/servicios del sistema estan deshabilitadas en este modulo.'
    );
  }

  function isKitsuneCommandBlockedByLive(args: string[]): boolean {
    if (!isLiveServicesLocked()) return false;
    const cmd = String(args[0] ?? '').trim();
    const sub = String(args[1] ?? '').trim();
    if (!cmd) return false;

    if (cmd === 'help' || cmd === 'status' || cmd === 'layer-status' || cmd === 'logs') return false;
    if (cmd === 'doctor') return args.includes('--fix');
    if (cmd === 'monitors' && sub === 'list') return false;
    if (cmd === 'instances' && (sub === 'list' || sub === 'status')) return false;
    if (cmd === 'profiles' && (sub === 'list' || sub === 'show')) return false;
    if (cmd === 'group' && (sub === 'validate' || sub === 'list-layers')) return false;
    if (cmd === 'autostart' && (sub === 'status' || sub === 'list')) return false;

    return true;
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
      // Prefer file:// fallback for renderers where convertFileSrc can fail intermittently.
      return fileUrl(path) ?? path;
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

  function isMotionPreview(url?: string): boolean {
    if (!url) return false;
    const v = url.toLowerCase();
    return v.includes('.mp4') || v.includes('.webm') || v.includes('.mov') || v.includes('.mkv') || v.includes('.gif');
  }

  function isMp4Path(pathValue?: string): boolean {
    const v = String(pathValue ?? '').trim().toLowerCase();
    return v.endsWith('.mp4');
  }

  function liveV2MotionPreviewSrc(item: LiveBrowseItemV2 | null): string {
    if (!item) return '';
    const blob = String(item.preview_motion_blob ?? '').trim();
    const local = String(item.preview_motion_local ?? '').trim();
    const remote = String(item.preview_motion_remote ?? '').trim();
    if (blob) return blob;
    const localBlobFirstProvider = item.provider === 'motionbgs' || item.provider === 'moewalls';
    const localIsMp4 = isMp4Path(local);
    if (local && localBlobFirstProvider && localIsMp4) {
      const localSrc = imageSrc(local) ?? fileUrl(local) ?? '';
      if (localSrc) return localSrc;
    }
    if (local && localBlobFirstProvider && !liveV2PreviewBlobAttempted) {
      // Keep showing loading/fallback while blob promotion runs, avoid noisy asset:// failure first.
      return '';
    }
    if (local) {
      // Prefer Tauri asset URL first; WebKit can reject direct file:// media sources.
      const localSrc = imageSrc(local) ?? fileUrl(local) ?? '';
      if (localSrc) return localSrc;
    }
    return remote;
  }

  function liveV2NativePreviewSrc(item: LiveBrowseItemV2 | null): string {
    if (!item) return '';
    const local = String(item.preview_motion_local ?? '').trim();
    if (local) return local;
    return String(item.preview_motion_remote ?? '').trim();
  }

  async function stopLiveV2NativePreview(): Promise<void> {
    if (!liveV2NativePreviewActive && !liveV2NativePreviewLastSrc) return;
    liveV2NativePreviewLastSrc = '';
    liveV2NativePreviewActive = false;
    try {
      await invoke('kitowall_native_preview_stop');
    } catch (e) {
      liveV2PreviewDebug(`native preview stop error: ${String(e)}`);
    }
  }

  async function startLiveV2NativePreview(item: LiveBrowseItemV2 | null): Promise<void> {
    if (liveV2PreviewEngine !== 'native') return;
    const src = liveV2NativePreviewSrc(item);
    if (!src) return;
    if (src === liveV2NativePreviewLastSrc) return;
    liveV2NativePreviewLastSrc = src;
    try {
      await invoke('kitowall_native_preview_start', {source: src});
      liveV2NativePreviewActive = true;
      liveV2PreviewDebug(`native preview start src=${src.slice(0, 180)}`);
    } catch (e) {
      liveV2NativePreviewActive = false;
      liveV2PreviewDebug(`native preview start error: ${String(e)}`);
      liveV2PreviewEngine = 'webview';
      liveV2PreviewDebug('native preview unavailable, fallback=webview');
    }
  }

  async function restartLiveV2NativePreview(): Promise<void> {
    await stopLiveV2NativePreview();
    await startLiveV2NativePreview(liveV2SelectedBrowse);
  }

  function revokePreviewBlob(item: LiveBrowseItemV2 | null | undefined): void {
    const u = String(item?.preview_motion_blob ?? '').trim();
    if (!u.startsWith('blob:')) return;
    try {
      URL.revokeObjectURL(u);
    } catch {}
  }

  function mimeForPath(pathValue: string): string {
    const lower = String(pathValue || '').toLowerCase();
    if (lower.endsWith('.webm')) return 'video/webm';
    if (lower.endsWith('.mp4')) return 'video/mp4';
    if (lower.endsWith('.mov')) return 'video/quicktime';
    return '';
  }

  async function promoteLocalPreviewToBlob(force = false, forcedMime?: string): Promise<boolean> {
    const cur = liveV2SelectedBrowse;
    if (!cur) return false;
    const local = String(cur.preview_motion_local ?? '').trim();
    if (!local) return false;
    if (!force && String(cur.preview_motion_blob ?? '').startsWith('blob:')) return true;
    if (!force && liveV2PreviewBlobAttempted) return false;
    if (!force) liveV2PreviewBlobAttempted = true;
    try {
      const src = imageSrc(local) ?? fileUrl(local);
      if (!src) return false;
      const res = await fetch(src);
      if (!res.ok) {
        liveV2PreviewDebug(`blob fetch failed status=${res.status}`);
        return false;
      }
      const arr = await res.arrayBuffer();
      const headerCt = String(res.headers.get('content-type') ?? '').toLowerCase();
      const headerMime = headerCt.startsWith('video/')
        ? headerCt.split(';', 1)[0].trim()
        : '';
      const mime = forcedMime ?? (headerMime || mimeForPath(local));
      const oldBlob = String(cur.preview_motion_blob ?? '');
      const blobUrl = mime
        ? URL.createObjectURL(new Blob([arr], {type: mime}))
        : URL.createObjectURL(new Blob([arr]));
      if (oldBlob.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(oldBlob);
        } catch {}
      }
      if (liveV2SelectedBrowse?.page_url !== cur.page_url) {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
        return false;
      }
      liveV2PreviewDebug(`blob promoted ok mime=${mime || '(none)'} size=${arr.byteLength} ct=${headerCt || '-'}`);
      liveV2SelectedBrowse = {
        ...cur,
        preview_motion_blob: blobUrl
      };
      liveV2PreviewRenderKey += 1;
      return true;
    } catch (e) {
      liveV2PreviewDebug(`blob promote error: ${String(e)}`);
      return false;
    }
  }

  function liveV2PreviewDebug(msg: string): void {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    console.log(`[live-preview] ${line}`);
    liveV2PreviewDebugLines = [...liveV2PreviewDebugLines.slice(-79), line];
  }

  async function clearLiveV2PreviewFor(url?: string): Promise<void> {
    const u = String(url ?? '').trim();
    if (!u) return;
    try {
      await liveV2Run(['preview-clear', u]);
    } catch {}
  }

  async function closeLiveV2SidePanel(): Promise<void> {
    const lastUrl = String(liveV2SelectedBrowse?.page_url ?? '').trim();
    liveV2PreviewDebug(`close panel url=${lastUrl || '-'}`);
    await stopLiveV2NativePreview();
    revokePreviewBlob(liveV2SelectedBrowse);
    liveV2SideOpen = false;
    liveV2PreviewLoading = false;
    liveV2PreviewRecoverCount = 0;
    liveV2PreviewLastRecoverAt = 0;
    liveV2PreviewRemountCount = 0;
    liveV2PreviewLastRemountAt = 0;
    liveV2PreviewBlobAttempted = false;
    liveV2PreviewBlobRetryCount = 0;
    liveV2PreviewHadPlayback = false;
    liveV2SelectedBrowse = null;
    if (lastUrl) {
      await clearLiveV2PreviewFor(lastUrl);
    }
  }

  function deriveMoeWallsPreviewFromThumb(thumbRemote?: string): string {
    const raw = String(thumbRemote ?? '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw);
      if (!/moewalls\.com$/i.test(u.hostname)) return '';
      const m = u.pathname.match(/^\/wp-content\/uploads\/(\d{4})\/\d{2}\/([^/]+)$/i);
      if (!m) return '';
      const year = m[1];
      const file = m[2];
      const baseNoExt = file.replace(/\.[a-z0-9]+$/i, '');
      const base = baseNoExt
        .replace(/-thumb-\d+x\d+$/i, '')
        .replace(/-thumb$/i, '');
      if (!base) return '';
      return `${u.origin}/wp-content/uploads/preview/${year}/${base}-preview.webm`;
    } catch {
      return '';
    }
  }

  function deriveMotionBgsPreviewFromThumb(thumbRemote?: string): string {
    const raw = String(thumbRemote ?? '').trim();
    if (!raw) return '';
    try {
      const u = new URL(raw);
      if (!/motionbgs\.com$/i.test(u.hostname)) return '';
      // Supports both:
      // - /media/<id>/<slug>.3840x2160.jpg
      // - /i/c/960x540/media/<id>/<slug>.3840x2160.jpg
      const m = u.pathname.match(/\/media\/(\d+)\/([^/?#]+?)(?:\.\d+x\d+)?\.(?:jpg|jpeg|png|webp|gif)$/i);
      if (!m) return '';
      const mediaId = m[1];
      const base = m[2];
      if (!mediaId || !base) return '';
      return `${u.origin}/media/${mediaId}/${base}.960x540.mp4`;
    } catch {
      return '';
    }
  }

  function onLiveV2PreviewLoaded(e: Event): void {
    const el = e.currentTarget;
    if (!(el instanceof HTMLVideoElement)) return;
    el.dataset.loadedOk = '1';
    el.muted = true;
    liveV2PreviewHadPlayback = true;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {});
    }
    liveV2PreviewDebug(`loadeddata src=${(el.currentSrc || el.src || '').slice(0, 180)} ready=${el.readyState} t=${Number(el.currentTime || 0).toFixed(2)} d=${Number(el.duration || 0).toFixed(2)} canPlayMp4=${el.canPlayType('video/mp4')} canPlayWebm=${el.canPlayType('video/webm')}`);
    liveV2PreviewRecoverCount = 0;
    liveV2PreviewLastRecoverAt = 0;
  }

  function onLiveV2PreviewState(eventName: string, e: Event): void {
    const el = e.currentTarget;
    if (!(el instanceof HTMLVideoElement)) {
      liveV2PreviewDebug(`${eventName} (non-video target)`);
      return;
    }
    liveV2PreviewDebug(`${eventName} ready=${el.readyState} net=${el.networkState} t=${Number(el.currentTime || 0).toFixed(2)} d=${Number(el.duration || 0).toFixed(2)}`);
    if (eventName === 'playing' || Number(el.currentTime || 0) > 0.05) {
      liveV2PreviewHadPlayback = true;
    }
  }

  function onLiveV2PreviewEnded(e: Event): void {
    onLiveV2PreviewState('ended', e);
  }

  function onLiveV2PreviewError(e: Event): void {
    const el = e.currentTarget;
    if (el instanceof HTMLVideoElement) {
      const mediaErr = el.error;
      liveV2PreviewDebug(`error src=${(el.currentSrc || el.src || '').slice(0, 180)} ready=${el.readyState} net=${el.networkState} t=${Number(el.currentTime || 0).toFixed(2)} d=${Number(el.duration || 0).toFixed(2)} code=${mediaErr?.code ?? 0} msg=${String((mediaErr as {message?: string} | null)?.message ?? '') || '-'} canPlayMp4=${el.canPlayType('video/mp4')} canPlayWebm=${el.canPlayType('video/webm')}`);
    } else {
      liveV2PreviewDebug('error (non-video target)');
    }
    if (liveV2SelectedBrowse?.provider === 'motionbgs' || liveV2SelectedBrowse?.provider === 'moewalls') {
      const local = String(liveV2SelectedBrowse.preview_motion_local ?? '').trim();
      if (local) {
        if (el instanceof HTMLVideoElement && el.error?.code === 3) {
          const activeSrc = (el.currentSrc || el.src || '').trim().toLowerCase();
          if (activeSrc.startsWith('blob:') && liveV2PreviewBlobRetryCount < 1) {
            liveV2PreviewBlobRetryCount += 1;
            liveV2PreviewDebug(`blob decode retry=${liveV2PreviewBlobRetryCount} forceMime=video/mp4`);
            const cur = liveV2SelectedBrowse;
            revokePreviewBlob(cur);
            liveV2SelectedBrowse = {
              ...cur,
              preview_motion_blob: ''
            };
            void (async () => {
              const ok = await promoteLocalPreviewToBlob(true, 'video/mp4');
              if (!ok) liveV2PreviewDebug('blob decode retry failed');
            })();
            return;
          }
        }
        if (el instanceof HTMLVideoElement && el.error?.code === 4) {
          const activeSrc = (el.currentSrc || el.src || '').trim().toLowerCase();
          if (!activeSrc.startsWith('blob:')) {
            void (async () => {
              const ok = await promoteLocalPreviewToBlob();
              if (!ok) {
                liveV2PreviewDebug('blob promote not available after code=4');
                const cur = liveV2SelectedBrowse;
                const remote = String(cur?.preview_motion_remote ?? '').trim();
                if (cur && remote) {
                  liveV2PreviewDebug('switch local->remote after local access/decode failure');
                  revokePreviewBlob(cur);
                  liveV2SelectedBrowse = {
                    ...cur,
                    preview_motion_local: '',
                    preview_motion_blob: ''
                  };
                  liveV2PreviewRenderKey += 1;
                }
              }
            })();
          }
          // Source not supported: avoid retry loops that cause flashing/black screen.
          liveV2PreviewDebug('source not supported by runtime (code=4), stop retries');
          return;
        }
        // Local-first mode: never downgrade to image fallback for live providers.
        // Avoid rapid error-recovery loops (thrashing) and re-mount decoder if needed.
        if (el instanceof HTMLVideoElement) {
          const now = Date.now();
          if (now - liveV2PreviewLastRecoverAt < 1200) return;
          liveV2PreviewLastRecoverAt = now;

          if (liveV2PreviewRecoverCount < 3) {
            liveV2PreviewRecoverCount += 1;
            liveV2PreviewDebug(`recover attempt=${liveV2PreviewRecoverCount} (play)`);
            try {
              if (Number(el.duration || 0) > 0 && Number(el.currentTime || 0) >= Number(el.duration || 0) - 0.2) {
                el.currentTime = 0;
              }
              const p = el.play();
              if (p && typeof p.catch === 'function') p.catch(() => {});
            } catch {}
            return;
          }

          if (liveV2PreviewRemountCount < 2 && now - liveV2PreviewLastRemountAt > 1800) {
            liveV2PreviewRemountCount += 1;
            liveV2PreviewLastRemountAt = now;
            liveV2PreviewRecoverCount = 0;
            liveV2PreviewRenderKey += 1;
            liveV2PreviewDebug(`remount attempt=${liveV2PreviewRemountCount} key=${liveV2PreviewRenderKey}`);
          }
        }
        return;
      }
    }

    if (el instanceof HTMLVideoElement) {
      const alreadyLoaded = el.dataset.loadedOk === '1';
      const hasPlayed = Number(el.currentTime || 0) > 0.1;
      const hasBuffer = (el.readyState || 0) >= 2;
      const activeSrc = (el.currentSrc || el.src || '').trim().toLowerCase();
      const isRemoteSrc = activeSrc.startsWith('http://') || activeSrc.startsWith('https://');
      if (isRemoteSrc && liveV2SelectedBrowse) {
        const local = String(liveV2SelectedBrowse.preview_motion_local ?? '').trim();
        if (local) {
          // Hard remote media error: switch to local cached preview immediately.
          liveV2PreviewDebug('switch remote->local after media error');
          liveV2SelectedBrowse = {
            ...liveV2SelectedBrowse,
            preview_motion_remote: '',
            preview_motion_blob: String(liveV2SelectedBrowse.preview_motion_blob ?? '')
          };
          return;
        }
      }
      // Motion providers can emit late/non-fatal errors; if playback already started,
      // keep current video state and do not force reload/fallback.
      if (alreadyLoaded || hasPlayed || hasBuffer || liveV2PreviewHadPlayback) {
        return;
      }
    }
    if (!liveV2SelectedBrowse) return;
    if (liveV2SelectedBrowse.provider === 'motionbgs' || liveV2SelectedBrowse.provider === 'moewalls') {
      liveV2PreviewDebug('skip thumbnail fallback for live provider after transient error');
      return;
    }
    // Remote previews can disappear on source sites; fallback to the card thumbnail.
    liveV2PreviewDebug('fallback to thumbnail (no stable video source)');
    liveV2SelectedBrowse = {
      ...liveV2SelectedBrowse,
      preview_motion_local: '',
      preview_motion_remote: '',
      preview_motion_blob: ''
    };
  }

  function livePreviewPrimary(item: LiveWorkshopItem | LiveWorkshopDetails | null): string | null {
    if (!item) return null;
    if (item.preview_motion_remote && isMotionPreview(item.preview_motion_remote)) return item.preview_motion_remote;
    if (item.preview_thumb_local) return imageSrc(item.preview_thumb_local);
    if (item.preview_url_remote) return item.preview_url_remote;
    return null;
  }

  function livePreviewFallback(item: LiveWorkshopItem | LiveWorkshopDetails | null): string | null {
    if (!item) return null;
    if (item.preview_thumb_local) return imageSrc(item.preview_thumb_local);
    return item.preview_url_remote ?? null;
  }

  function liveLocalPreviewPath(item: LiveWorkshopItem | LiveWorkshopDetails | null): string {
    return item?.preview_thumb_local ?? '';
  }

  function isLiveSelectionMotion(): boolean {
    const src = livePreviewPrimary(liveSelected);
    return !!src && isMotionPreview(src);
  }

  function onLivePreviewError(e: Event): void {
    const img = e.currentTarget;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.fallbackApplied === '1') return;
    const local = String(img.dataset.localPath ?? '').trim();
    if (!local) return;
    const fallback = fileUrl(local);
    if (!fallback) return;
    img.dataset.fallbackApplied = '1';
    img.src = fallback;
  }

  function liveLibraryPreviewCandidates(entry: LiveLibraryItem): string[] {
    const base = String(entry.path ?? '').trim().replace(/\/+$/, '');
    const out: string[] = [];
    if (base) {
      out.push(`${base}/preview.jpg`);
      out.push(`${base}/preview.jpeg`);
      out.push(`${base}/preview.png`);
      out.push(`${base}/preview.webp`);
      out.push(`${base}/thumbnail.jpg`);
      out.push(`${base}/thumbnail.png`);
      out.push(`${base}/thumbnail.webp`);
    }
    const metaThumb = String(entry.meta?.preview_thumb_local ?? '').trim();
    if (metaThumb) out.push(metaThumb);
    return Array.from(new Set(out));
  }

  function liveSelectedPreviewCandidates(): string[] {
    const id = String(liveSelected?.id ?? '').trim();
    const entry = liveLibraryItems.find(v => v.id === id && (!liveSelectedLibraryPath || v.path === liveSelectedLibraryPath))
      ?? liveLibraryItems.find(v => v.id === id);
    if (entry) return liveLibraryPreviewCandidates(entry);
    const fallback = String(liveSelected?.preview_thumb_local ?? '').trim();
    return fallback ? [fallback] : [];
  }

  function liveCandidateSrc(pathValue: string): string {
    return imageSrc(pathValue) ?? fileUrl(pathValue) ?? pathValue;
  }

  function filteredLiveLibraryItems(): LiveLibraryItem[] {
    const q = liveFilterQuery.trim().toLowerCase();
    return liveLibraryItems.filter((entry) => {
      const meta = entry.meta;
      const type = (meta?.wallpaper_type ?? 'unknown') as 'video' | 'scene' | 'web' | 'application' | 'unknown';
      const reactive = !!meta?.audio_reactive;
      if (liveFilterType !== 'all' && type !== liveFilterType) return false;
      if (liveFilterAudio === 'reactive' && !reactive) return false;
      if (liveFilterAudio === 'static' && reactive) return false;
      if (!q) return true;
      const hay = `${entry.id} ${meta?.title ?? ''} ${entry.path}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function liveMonitorOptions(): string[] {
    return Array.isArray(status?.outputs) ? status.outputs : [];
  }

  function liveV2ThumbPngPath(item: LiveIndexItem): string {
    const raw = String(item.thumb_path ?? '').trim();
    if (!raw) return '';
    if (raw.toLowerCase().endsWith('.png')) return raw;
    if (/\.[a-z0-9]+$/i.test(raw)) return raw.replace(/\.[a-z0-9]+$/i, '.png');
    return `${raw}.png`;
  }

  function liveV2LibraryPreviewCandidates(item: LiveIndexItem): string[] {
    const out: string[] = [];
    const thumb = liveV2ThumbPngPath(item);
    if (thumb) out.push(thumb);
    const filePath = String(item.file_path ?? '').trim();
    const base = filePath.replace(/\/[^/]+$/, '');
    if (base && base !== filePath) {
      out.push(`${base}/preview.png`);
      out.push(`${base}/thumbnail.png`);
    }
    return Array.from(new Set(out));
  }

  function liveV2LibraryPreviewSrc(item: LiveIndexItem): string {
    const candidates = liveV2LibraryPreviewCandidates(item);
    const first = String(candidates[0] ?? '').trim();
    return fileUrl(first) ?? imageSrc(first) ?? first;
  }

  function liveV2LibraryDataUrl(id: string): string {
    return String(livePreviewDataUrlById[id] ?? '').trim();
  }

  async function preloadLiveV2LibraryPreviewData(items: LiveIndexItem[]): Promise<void> {
    const slice = items.slice(0, 80);
    const nextStatus = {...liveV2ThumbDataStatus};
    for (const item of slice) {
      if (String(livePreviewDataUrlById[item.id] ?? '').trim()) {
        nextStatus[item.id] = 'ready';
      } else if (!nextStatus[item.id]) {
        nextStatus[item.id] = 'pending';
      }
    }
    liveV2ThumbDataStatus = nextStatus;
    const queue = slice.filter((item) => !String(livePreviewDataUrlById[item.id] ?? '').trim());
    const concurrency = 6;
    const workers: Promise<void>[] = [];
    const runOne = async (item: LiveIndexItem): Promise<void> => {
      const candidates = liveV2LibraryPreviewCandidates(item);
      for (const c of candidates) {
        const dataUrl = await readLocalDataUrl(c);
        if (!dataUrl) continue;
        livePreviewDataUrlById = {...livePreviewDataUrlById, [item.id]: dataUrl};
        liveV2ThumbDataStatus = {...liveV2ThumbDataStatus, [item.id]: 'ready'};
        return;
      }
      liveV2ThumbDataStatus = {...liveV2ThumbDataStatus, [item.id]: 'failed'};
    };
    for (let i = 0; i < queue.length; i += concurrency) {
      const batch = queue.slice(i, i + concurrency);
      workers.push(Promise.all(batch.map(runOne)).then(() => {}));
    }
    void Promise.all(workers);
  }

  function activeMonitorsForWallpaper(id: string): string[] {
    const map = liveAuthority?.state?.instances ?? {};
    return Object.entries(map)
      .filter(([, inst]) => String(inst?.id ?? '') === id)
      .map(([monitor]) => monitor);
  }

  async function readLocalDataUrl(pathValue: string): Promise<string | null> {
    const p = String(pathValue ?? '').trim();
    if (!p) return null;
    const cached = livePreviewDataUrlCache.get(p);
    if (cached) return cached;
    try {
      const data = await invoke<{ok: boolean; data_url?: string}>('kitowall_file_data_url', {path: p});
      const url = String(data?.data_url ?? '').trim();
      if (!url) return null;
      livePreviewDataUrlCache.set(p, url);
      return url;
    } catch {
      return null;
    }
  }

  async function resolveEntryPreviewDataUrl(entry: LiveLibraryItem): Promise<string | null> {
    const candidates = liveLibraryPreviewCandidates(entry);
    for (const c of candidates) {
      const dataUrl = await readLocalDataUrl(c);
      if (dataUrl) return dataUrl;
    }
    return null;
  }

  async function preloadLiveLibraryPreviewData(entries: LiveLibraryItem[]): Promise<void> {
    const next = {...livePreviewDataUrlById};
    const slice = entries.slice(0, 80);
    for (const entry of slice) {
      const dataUrl = await resolveEntryPreviewDataUrl(entry);
      if (dataUrl) next[entry.id] = dataUrl;
    }
    livePreviewDataUrlById = next;
  }

  function onLiveLibraryPreviewError(e: Event): void {
    const img = e.currentTarget;
    if (!(img instanceof HTMLImageElement)) return;
    if (img.dataset.localFallbackApplied !== '1') {
      const local = String(img.dataset.localPath ?? '').trim();
      const localUrl = fileUrl(local);
      if (localUrl) {
        img.dataset.localFallbackApplied = '1';
        img.src = localUrl;
        return;
      }
    }
    let fallbacks: string[] = [];
    try {
      fallbacks = JSON.parse(img.dataset.fallbacks ?? '[]') as string[];
    } catch {
      fallbacks = [];
    }
    const idx = Number(img.dataset.fallbackIndex ?? '0');
    const next = fallbacks[idx];
    if (!next) return;
    img.dataset.fallbackIndex = String(idx + 1);
    img.src = liveCandidateSrc(next);
  }

  function parseLiveDepsJson(stdout: string): LiveDepsStatus {
    const data = JSON.parse(stdout || '{}') as LiveDepsStatus;
    return {
      ok: !!data.ok,
      required: Array.isArray(data.required) ? data.required : [],
      optional: Array.isArray(data.optional) ? data.optional : [],
      deps: data.deps && typeof data.deps === 'object' ? data.deps : {},
      missing: Array.isArray(data.missing) ? data.missing : [],
      install: data.install
    };
  }

  async function loadLiveDepsStatus(): Promise<void> {
    liveDepsBusy = true;
    try {
      const result = await invoke<KitsuneRunResult>('kitowall_kitsune_run', {
        args: ['livewallpapers', 'status', '--json']
      });
      const raw = (result.stdout ?? '').trim();
      if (!raw) throw new Error('Empty livewallpapers status output');
      liveDepsStatus = parseLiveDepsJson(raw);
    } catch (e) {
      liveDepsStatus = null;
      lastError = String(e);
    } finally {
      liveDepsBusy = false;
    }
  }

  async function installLiveDeps(): Promise<void> {
    liveDepsBusy = true;
    try {
      const result = await invoke<KitsuneRunResult>('kitowall_kitsune_run', {
        args: ['livewallpapers', 'install']
      });
      const stderr = (result.stderr ?? '').trim();
      const stdout = (result.stdout ?? '').trim();
      if (!result.ok) {
        const msg = stderr || stdout || `install failed (exit ${result.exitCode})`;
        const nonInteractive = /eof|tty|non-?interactive|instalacion interactiva/i.test(msg);
        if (nonInteractive) {
          const cmd = await getLiveDepsInstallCommand();
          liveDepsManualCommand = cmd;
          pushToast(
            tr(
              'Interactive install is not available from UI. Use the manual command shown below.',
              'La instalacion interactiva no esta disponible desde la UI. Usa el comando manual de abajo.'
            ),
            'warn'
          );
          return;
        }
        throw new Error(msg);
      }
      liveDepsManualCommand = '';
      pushToast('LiveWallpaper dependencies installation command executed', 'success');
      await loadLiveDepsStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveDepsBusy = false;
    }
  }

  async function printLiveDepsInstallCommand(): Promise<void> {
    liveDepsBusy = true;
    try {
      const cmd = await getLiveDepsInstallCommand();
      liveDepsManualCommand = cmd;
      kitsuneLastCommand = 'kitsune livewallpapers install --print';
      kitsuneOutput = cmd;
      pushToast('Manual install command generated in command output panel', 'info');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveDepsBusy = false;
    }
  }

  async function getLiveDepsInstallCommand(): Promise<string> {
    const result = await invoke<KitsuneRunResult>('kitowall_kitsune_run', {
      args: ['livewallpapers', 'install', '--print']
    });
    const cmd = (result.stdout ?? '').trim();
    if (!cmd) throw new Error('No install command returned');
    return cmd;
  }

  async function copyLiveDepsManualCommand(): Promise<void> {
    const cmd = liveDepsManualCommand.trim();
    if (!cmd) return;
    try {
      await navigator.clipboard.writeText(cmd);
      pushToast(tr('Command copied', 'Comando copiado'), 'success');
    } catch {
      pushToast(tr('Could not copy command', 'No se pudo copiar el comando'), 'error');
    }
  }

  async function saveLiveApiKey(): Promise<void> {
    const key = liveSteamApiKey.trim();
    if (!key) {
      pushToast(tr('Steam Web API Key is required', 'Steam Web API Key es requerida'), 'error');
      return;
    }
    liveBusy = true;
    try {
      await invoke('kitowall_we_set_api_key', {apiKey: key});
      liveSteamApiKeySaved = true;
      liveSteamApiKeySavedAt = Date.now();
      pushToast(tr('Steam Web API Key saved', 'Steam Web API Key guardada'), 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  function onLiveApiKeyInput(): void {
    liveSteamApiKeySaved = false;
  }

  async function loadLiveSteamRoots(): Promise<void> {
    try {
      const data = await invoke<LiveSteamRootsResponse>('kitowall_we_get_steam_roots');
      liveSteamRoots = Array.isArray(data?.steam_roots) ? data.steam_roots : [];
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    }
  }

  async function loadLiveAppStatus(): Promise<void> {
    try {
      const data = await invoke<LiveAppStatus>('kitowall_we_app_status');
      liveAppStatus = data;
    } catch (e) {
      liveAppStatus = null;
      lastError = String(e);
      pushToast(String(e), 'error');
    }
  }

  async function loadLiveAuthorityStatus(): Promise<void> {
    try {
      const data = await invoke<LiveAuthorityResponse>('kitowall_we_active');
      liveAuthority = data;
    } catch (e) {
      liveAuthority = null;
      lastError = String(e);
      pushToast(String(e), 'error');
    }
  }

  async function stopLiveAuthority(): Promise<void> {
    liveBusy = true;
    try {
      await invoke('kitowall_we_stop_all');
      pushToast(tr('LiveWallpapers stopped and services restored', 'LiveWallpapers detenido y servicios restaurados'), 'success');
      await loadLiveAuthorityStatus();
      await loadLiveDepsStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function saveLiveSteamRoots(nextRoots: string[]): Promise<void> {
    const roots = nextRoots.map(v => String(v).trim()).filter(Boolean);
    const csv = roots.join(',');
    await invoke('kitowall_we_set_steam_roots', {rootsCsv: csv});
    liveSteamRoots = roots;
  }

  async function pickLiveSteamRoot(): Promise<void> {
    liveBusy = true;
    try {
      const result = await invoke<{path?: string | null}>('kitowall_pick_folder');
      const selected = String(result?.path ?? '').trim();
      if (!selected) return;
      if (liveSteamRoots.includes(selected)) return;
      await saveLiveSteamRoots([...liveSteamRoots, selected]);
      await scanLiveSteam();
      pushToast(tr('Steam path added', 'Ruta de Steam agregada'), 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function addLiveSteamRootManual(): Promise<void> {
    const p = liveSteamManualRoot.trim();
    if (!p) return;
    if (liveSteamRoots.includes(p)) {
      pushToast(tr('Path already exists', 'La ruta ya existe'), 'info');
      return;
    }
    liveBusy = true;
    try {
      await saveLiveSteamRoots([...liveSteamRoots, p]);
      liveSteamManualRoot = '';
      await scanLiveSteam();
      pushToast(tr('Steam path added', 'Ruta de Steam agregada'), 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function removeLiveSteamRoot(pathToRemove: string): Promise<void> {
    liveBusy = true;
    try {
      await saveLiveSteamRoots(liveSteamRoots.filter(v => v !== pathToRemove));
      await scanLiveSteam();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function scanLiveSteam(): Promise<void> {
    liveBusy = true;
    try {
      const data = await invoke<LiveSteamScanResponse>('kitowall_we_scan_steam');
      liveSteamDetectedSources = Array.isArray(data?.sources) ? data.sources : [];
      liveSteamDetectedCount = Number.isFinite(data?.count) ? Number(data.count) : 0;
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function syncLiveSteam(): Promise<void> {
    if (liveAppStatus && !liveAppStatus.installed) {
      pushToast(
        tr(
          'Wallpaper Engine must be installed to sync wallpapers.',
          'Wallpaper Engine debe estar instalado para sincronizar wallpapers.'
        ),
        'error'
      );
      return;
    }
    liveBusy = true;
    try {
      const out = await invoke<LiveSteamSyncResponse>('kitowall_we_sync_steam');
      pushToast(
        tr(
          `Synced ${out.imported} imported / ${out.skipped} existing`,
          `Sincronizado ${out.imported} importados / ${out.skipped} existentes`
        ),
        'success'
      );
      await scanLiveSteam();
      await loadLiveLibrary();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function applyLiveWallpaper(entry: LiveLibraryItem): Promise<void> {
    const type = (entry.meta?.wallpaper_type ?? 'unknown').toLowerCase();
    if (type !== 'video') {
      pushToast(
        tr(
          `Unsupported type "${type}". Only video wallpapers are supported now.`,
          `Tipo no soportado "${type}". Ahora solo se soportan wallpapers de video.`
        ),
        'error'
      );
      return;
    }
    const monitor = liveApplyMonitor.trim() || liveMonitorOptions()[0] || '';
    if (!monitor) {
      pushToast(tr('Select a monitor first', 'Selecciona un monitor primero'), 'error');
      return;
    }
    liveBusy = true;
    try {
      const out = await invoke<LiveApplyResponse>('kitowall_we_apply', {
        id: entry.id,
        monitor,
        backend: 'auto'
      });
      if (!out?.ok) throw new Error('Apply failed');
      pushToast(tr(`Applied on ${monitor}`, `Aplicado en ${monitor}`), 'success');
      await loadLiveAuthorityStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function stopLiveWallpaperMonitor(monitor: string): Promise<void> {
    const m = monitor.trim();
    if (!m) return;
    liveBusy = true;
    try {
      await invoke('kitowall_we_stop_monitor', {monitor: m});
      pushToast(tr(`Stopped on ${m}`, `Detenido en ${m}`), 'success');
      await loadLiveAuthorityStatus();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function loadLiveSearch(resetPage = false): Promise<void> {
    liveBusy = true;
    if (resetPage) livePage = 1;
    try {
      const data = await invoke<LiveSearchResponse>('kitowall_we_search', {
        text: liveSearchText.trim() || null,
        tags: liveTags.trim() || null,
        sort: liveSort,
        page: Math.max(1, Math.floor(Number(livePage) || 1)),
        pageSize: Math.max(1, Math.floor(Number(livePageSize) || 24))
      });
      liveSearchItems = Array.isArray(data?.items) ? data.items : [];
      liveSearchTotal = typeof data?.total === 'number' ? data.total : null;
      liveSearchCached = !!data?.cached;
      liveView = 'general';
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function loadLiveLibrary(): Promise<void> {
    liveBusy = true;
    try {
      const data = await invoke<LiveLibraryResponse>('kitowall_we_library');
      liveLibraryRoot = String(data?.root ?? '');
      liveLibraryItems = Array.isArray(data?.items) ? data.items : [];
      liveView = 'downloaded';
      if (!liveApplyMonitor && liveMonitorOptions().length > 0) {
        liveApplyMonitor = liveMonitorOptions()[0] ?? '';
      }
      void preloadLiveLibraryPreviewData(liveLibraryItems);
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function openLiveFromSearch(item: LiveWorkshopItem): Promise<void> {
    liveSelected = item;
    liveSelectedSource = 'search';
    liveSideOpen = true;
    try {
      const details = await invoke<LiveWorkshopDetails>('kitowall_we_details', {
        publishedfileid: item.id
      });
      liveSelected = details;
    } catch {
      // Keep search item as fallback.
    }
  }

  async function openLiveFromLibrary(item: LiveLibraryItem): Promise<void> {
    liveSelectedLibraryPath = item.path;
    liveSelectedPreviewDataUrl = '';
    liveSelected = item.meta ?? {
      id: item.id,
      title: item.id,
      tags: []
    };
    const dataUrl = await resolveEntryPreviewDataUrl(item);
    if (dataUrl) {
      liveSelectedPreviewDataUrl = dataUrl;
      livePreviewDataUrlById = {...livePreviewDataUrlById, [item.id]: dataUrl};
    }
    liveSelectedSource = 'library';
    liveSideOpen = true;
    try {
      const details = await invoke<LiveWorkshopDetails>('kitowall_we_details', {
        publishedfileid: item.id
      });
      liveSelected = details;
    } catch {
      // Metadata fallback is already set.
    }
  }

  async function pollLiveJob(jobId: string): Promise<void> {
    try {
      const status = await invoke<LiveJob>('kitowall_we_job', {jobId});
      liveCurrentJob = status;
      if (status.status === 'done' || status.status === 'error') {
        if (liveJobPollTimer) {
          clearInterval(liveJobPollTimer);
          liveJobPollTimer = null;
        }
        if (status.status === 'done') {
          pushToast(`Download completed: ${status.publishedfileid}`, 'success');
          await loadLiveLibrary();
        } else if (status.error) {
          pushToast(status.error, 'error');
        }
      }
    } catch (e) {
      if (liveJobPollTimer) {
        clearInterval(liveJobPollTimer);
        liveJobPollTimer = null;
      }
      lastError = String(e);
    }
  }

  async function downloadLiveItem(item: LiveWorkshopItem | LiveWorkshopDetails | null): Promise<void> {
    if (!item) return;
    liveBusy = true;
    try {
      const out = await invoke<LiveDownloadResponse>('kitowall_we_download', {
        publishedfileid: item.id,
        targetDir: liveDownloadTargetDir.trim() || null,
        coexist: true
      });
      if (!out?.job_id) throw new Error('Download job was not created');
      pushToast(`Download queued: ${item.title}`, 'success');
      await pollLiveJob(out.job_id);
      if (liveJobPollTimer) clearInterval(liveJobPollTimer);
      liveJobPollTimer = setInterval(() => {
        void pollLiveJob(out.job_id);
      }, 2000);
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveBusy = false;
    }
  }

  async function liveV2Run(args: string[]): Promise<unknown> {
    return await invoke('kitowall_live_run', {args});
  }

  async function openExternalUrl(url: string): Promise<void> {
    const u = String(url ?? '').trim();
    if (!/^https?:\/\//i.test(u)) return;
    try {
      await invoke('kitowall_open_url', {url: u});
    } catch (e) {
      pushToast(String(e), 'error');
    }
  }

  function onExternalUrlKeydown(e: KeyboardEvent, url: string): void {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    void openExternalUrl(url);
  }

  async function loadLiveV2Config(): Promise<void> {
    try {
      const out = await liveV2Run(['config', 'show']) as {
        ok: boolean;
        index?: {
          apply_defaults?: typeof liveV2ApplyDefaults;
          runner?: {bin_name?: string};
        };
      };
      const index = out?.index;
      if (index?.apply_defaults) {
        liveV2ApplyDefaults = {...liveV2ApplyDefaults, ...index.apply_defaults};
      }
      if (index?.runner) {
        liveV2RunnerBin = index.runner.bin_name ?? 'kitsune-livewallpaper';
      }
    } catch (e) {
      lastError = String(e);
    }
  }

  async function initLiveV2(): Promise<void> {
    try {
      await liveV2Run(['init']);
      await loadLiveV2Config();
      await loadLiveV2Doctor();
      if (!liveV2LibraryLoaded && !liveV2Busy) {
        void loadLiveV2Library();
      }
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    }
  }

  async function ensureLiveV2ExploreLoaded(): Promise<void> {
    if (liveV2ExploreLoaded) return;
    await browseLiveV2();
  }

  function selectLiveV2Tab(tab: 'library' | 'explore' | 'config'): void {
    liveV2Tab = tab;
    if (tab === 'library') {
      if (!liveV2LibraryLoaded && !liveV2Busy) {
        void loadLiveV2Library();
      } else if (liveV2Items.length > 0) {
        void preloadLiveV2LibraryPreviewData(liveV2Items);
      }
      return;
    }
    if (tab !== 'explore') return;
    if (liveV2ExploreLoaded || liveV2ExploreLoading) return;
    liveV2ExploreLoading = true;
    liveV2BrowseItems = [];
    void (async () => {
      await tick();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          void ensureLiveV2ExploreLoaded();
        });
      });
    })();
    liveV2LibrarySideOpen = false;
    liveV2SelectedLibrary = null;
  }

  async function loadLiveV2Library(): Promise<void> {
    liveV2Busy = true;
    try {
      const out = await liveV2Run(['list', ...(liveV2FavoritesOnly ? ['--favorites'] : [])]) as {
        ok: boolean;
        items?: LiveIndexItem[];
      };
      liveV2Items = (Array.isArray(out?.items) ? out.items : []).map((item) => ({
        ...item,
        thumb_path: liveV2ThumbPngPath(item)
      }));
      liveV2ThumbDataStatus = Object.fromEntries(liveV2Items.map((item) => [item.id, 'pending' as const]));
      // Reset per-id cached thumbnails so Live V2 re-resolves using PNG-only paths.
      const nextThumbs = {...livePreviewDataUrlById};
      for (const item of liveV2Items) delete nextThumbs[item.id];
      livePreviewDataUrlById = nextThumbs;
      void preloadLiveV2LibraryPreviewData(liveV2Items);
      if (liveV2SelectedLibrary) {
        liveV2SelectedLibrary = liveV2Items.find(v => v.id === liveV2SelectedLibrary?.id) ?? null;
        if (!liveV2SelectedLibrary) liveV2LibrarySideOpen = false;
        else syncLiveV2DetailConfig(liveV2SelectedLibrary);
      }
      liveV2LibraryLoaded = true;
      if (!liveV2Monitor && liveMonitorOptions().length > 0) {
        liveV2Monitor = liveMonitorOptions()[0] ?? '';
      }
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  function liveV2DefaultConfigForItem(item: LiveIndexItem): LiveVideoPlayConfig {
    return {
      keep_services: !!liveV2ApplyDefaults.keep_services,
      mute_audio: !!liveV2ApplyDefaults.mute_audio,
      profile: liveV2ApplyDefaults.profile,
      display_fps: liveV2ApplyDefaults.display_fps,
      seamless_loop: !!liveV2ApplyDefaults.seamless_loop,
      loop_crossfade: !!liveV2ApplyDefaults.loop_crossfade,
      loop_crossfade_seconds: Number(liveV2ApplyDefaults.loop_crossfade_seconds) || 0.35,
      optimize: !!liveV2ApplyDefaults.optimize,
      proxy_width: item.variant === '4k'
        ? (Number(liveV2ApplyDefaults.proxy_width_4k) || 3840)
        : (Number(liveV2ApplyDefaults.proxy_width_hd) || 1920),
      proxy_fps: Number(liveV2ApplyDefaults.proxy_fps) || 60,
      proxy_crf: item.variant === '4k'
        ? (Number(liveV2ApplyDefaults.proxy_crf_4k) || 16)
        : (Number(liveV2ApplyDefaults.proxy_crf_hd) || 18)
    };
  }

  function syncLiveV2DetailConfig(item: LiveIndexItem): void {
    const fallback = liveV2DefaultConfigForItem(item);
    const cfg = item.video_config;
    liveV2DetailConfig = {
      keep_services: cfg?.keep_services ?? fallback.keep_services,
      mute_audio: cfg?.mute_audio ?? fallback.mute_audio,
      profile: cfg?.profile ?? fallback.profile,
      display_fps: cfg?.display_fps ?? fallback.display_fps,
      seamless_loop: cfg?.seamless_loop ?? fallback.seamless_loop,
      loop_crossfade: cfg?.loop_crossfade ?? fallback.loop_crossfade,
      loop_crossfade_seconds: Number(cfg?.loop_crossfade_seconds ?? fallback.loop_crossfade_seconds) || 0.35,
      optimize: cfg?.optimize ?? fallback.optimize,
      proxy_width: Number(cfg?.proxy_width ?? fallback.proxy_width) || fallback.proxy_width,
      proxy_fps: Number(cfg?.proxy_fps ?? fallback.proxy_fps) || fallback.proxy_fps,
      proxy_crf: Number(cfg?.proxy_crf ?? fallback.proxy_crf) || fallback.proxy_crf
    };
  }

  function openLiveV2LibraryDetails(item: LiveIndexItem): void {
    liveV2SelectedLibrary = item;
    syncLiveV2DetailConfig(item);
    liveV2LibrarySideOpen = true;
    if (!liveV2LibraryDataUrl(item.id)) {
      liveV2ThumbDataStatus = {...liveV2ThumbDataStatus, [item.id]: 'pending'};
      void preloadLiveV2LibraryPreviewData([item]);
    }
  }

  function closeLiveV2LibraryDetails(): void {
    liveV2LibrarySideOpen = false;
    liveV2SelectedLibrary = null;
  }

  async function saveLiveV2WallpaperConfig(id: string): Promise<void> {
    const displayFpsArg = liveV2DetailConfig.display_fps === null ? 'off' : String(Math.max(1, Math.floor(Number(liveV2DetailConfig.display_fps) || 1)));
    await liveV2Run([
      'config',
      'wallpaper',
      '--id', id,
      '--keep-services', String(!!liveV2DetailConfig.keep_services),
      '--mute-audio', String(!!liveV2DetailConfig.mute_audio),
      '--profile', liveV2DetailConfig.profile,
      '--display-fps', displayFpsArg,
      '--seamless-loop', String(!!liveV2DetailConfig.seamless_loop),
      '--loop-crossfade', String(!!liveV2DetailConfig.loop_crossfade),
      '--loop-crossfade-seconds', String(Math.max(0, Number(liveV2DetailConfig.loop_crossfade_seconds) || 0.35)),
      '--optimize', String(!!liveV2DetailConfig.optimize),
      '--proxy-width', String(Math.max(320, Math.floor(Number(liveV2DetailConfig.proxy_width) || 1920))),
      '--proxy-fps', String(Math.max(1, Math.floor(Number(liveV2DetailConfig.proxy_fps) || 60))),
      '--proxy-crf', String(Math.min(51, Math.max(1, Math.floor(Number(liveV2DetailConfig.proxy_crf) || 18))))
    ]);
  }

  async function saveSelectedLiveV2Config(): Promise<void> {
    if (!liveV2SelectedLibrary) return;
    liveV2Busy = true;
    try {
      await saveLiveV2WallpaperConfig(liveV2SelectedLibrary.id);
      await loadLiveV2Library();
      pushToast(tr('Wallpaper config saved', 'Configuracion del wallpaper guardada'), 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function applySelectedLiveV2Wallpaper(updateConfig = false): Promise<void> {
    if (!liveV2SelectedLibrary) return;
    const monitor = liveV2Monitor.trim();
    if (!monitor) {
      pushToast(tr('Select a monitor first', 'Selecciona un monitor primero'), 'error');
      return;
    }
    liveV2Busy = true;
    try {
      await saveLiveV2WallpaperConfig(liveV2SelectedLibrary.id);
      await liveV2Run(['apply', liveV2SelectedLibrary.id, '--monitor', monitor, '--quality', liveV2Quality]);
      await loadLiveV2Library();
      pushToast(
        updateConfig
          ? tr(`Config updated on ${monitor}`, `Configuracion actualizada en ${monitor}`)
          : tr(`Applied on ${monitor}`, `Aplicado en ${monitor}`),
        'success'
      );
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function browseLiveV2(): Promise<void> {
    liveV2ExploreLoading = true;
    try {
      const out = await liveV2Run([
        'browse',
        '--page', String(Math.max(1, Math.floor(Number(liveV2Page) || 1))),
        '--quality', 'all',
        '--provider', liveV2Provider
      ]) as {ok: boolean; items?: LiveBrowseItemV2[]};
      liveV2BrowseItems = Array.isArray(out?.items) ? out.items : [];
      liveV2ExploreLoaded = true;
      if (liveV2SelectedBrowse) {
        liveV2SelectedBrowse = liveV2BrowseItems.find(v => v.page_url === liveV2SelectedBrowse?.page_url) ?? liveV2SelectedBrowse;
      }
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2ExploreLoading = false;
    }
  }

  async function searchLiveV2(): Promise<void> {
    const q = liveV2Query.trim();
    if (!q) {
      await browseLiveV2();
      return;
    }
    liveV2ExploreLoading = true;
    try {
      const out = await liveV2Run([
        'search',
        q,
        '--page', String(Math.max(1, Math.floor(Number(liveV2Page) || 1))),
        '--limit', '24',
        '--provider', liveV2Provider
      ]) as {ok: boolean; items?: LiveBrowseItemV2[]};
      liveV2BrowseItems = Array.isArray(out?.items) ? out.items : [];
      liveV2ExploreLoaded = true;
      if (liveV2SelectedBrowse) {
        liveV2SelectedBrowse = liveV2BrowseItems.find(v => v.page_url === liveV2SelectedBrowse?.page_url) ?? null;
      }
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2ExploreLoading = false;
    }
  }

  async function fetchLiveV2(url: string, applyNow = false, qualityOverride?: LiveQuality): Promise<void> {
    const u = url.trim();
    if (!u) {
      pushToast(tr('Select a URL first', 'Selecciona una URL primero'), 'error');
      return;
    }
    liveV2Busy = true;
    try {
      const args = ['fetch', u, '--quality', qualityOverride ?? liveV2Quality];
      if (applyNow) {
        const monitor = liveV2Monitor.trim() || liveMonitorOptions()[0] || '';
        if (!monitor) throw new Error('Monitor is required to apply');
        args.push('--monitor', monitor, '--apply');
      }
      await liveV2Run(args);
      pushToast(tr('Live wallpaper downloaded', 'Live wallpaper descargado'), 'success');
      await loadLiveV2Library();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function openLiveV2Browse(item: LiveBrowseItemV2): Promise<void> {
    liveV2PreviewDebugLines = [];
    liveV2PreviewDebug(`open details provider=${item.provider} url=${item.page_url}`);
    await stopLiveV2NativePreview();
    revokePreviewBlob(liveV2SelectedBrowse);
    const previousUrl = String(liveV2SelectedBrowse?.page_url ?? '').trim();
    if (previousUrl && previousUrl !== item.page_url) {
      liveV2PreviewDebug(`clear previous cached preview url=${previousUrl}`);
      revokePreviewBlob(liveV2SelectedBrowse);
      void clearLiveV2PreviewFor(previousUrl);
    }
    const localFirst = item.provider === 'motionbgs' || item.provider === 'moewalls';
    const reqId = ++liveV2PreviewReq;
    liveV2PreviewRecoverCount = 0;
    liveV2PreviewLastRecoverAt = 0;
    liveV2PreviewRemountCount = 0;
    liveV2PreviewLastRemountAt = 0;
    liveV2PreviewBlobAttempted = false;
    liveV2PreviewBlobRetryCount = 0;
    liveV2PreviewHadPlayback = false;
    liveV2PreviewRenderKey += 1;
    liveV2PreviewLoading = localFirst;
    liveV2SelectedBrowse = {
      ...item,
      // Use local-first for live providers to avoid remote stream interruptions.
      preview_motion_local: '',
      preview_motion_remote: localFirst ? '' : String(item.preview_motion_remote ?? ''),
      preview_motion_blob: ''
    };
    liveV2SelectedUrl = item.page_url;
    liveV2SideOpen = true;
    if (item.provider === 'moewalls' && !item.preview_motion_remote) {
      const guess = deriveMoeWallsPreviewFromThumb(item.thumb_remote);
      if (guess) {
        if (reqId !== liveV2PreviewReq) return;
        liveV2PreviewDebug(`derived moewalls preview from thumb: ${guess}`);
        liveV2SelectedBrowse = {
          ...(liveV2SelectedBrowse ?? item),
          // Keep local-first behavior stable: do not start remote playback before cache is ready.
          preview_motion_remote: localFirst ? '' : guess,
          preview_motion_blob: ''
        };
      }
    } else if (item.provider === 'motionbgs' && !item.preview_motion_remote) {
      const guess = deriveMotionBgsPreviewFromThumb(item.thumb_remote);
      if (guess) {
        if (reqId !== liveV2PreviewReq) return;
        liveV2PreviewDebug(`derived motionbgs preview from thumb: ${guess}`);
        liveV2SelectedBrowse = {
          ...(liveV2SelectedBrowse ?? item),
          preview_motion_remote: '',
          preview_motion_blob: ''
        };
      }
    }
    try {
      const out = await liveV2Run(['resolve', item.page_url]) as {
        ok: boolean;
        post?: {
          title?: string;
          thumb_remote?: string;
          preview_motion_remote?: string;
          tags?: string[];
          variants?: Array<{variant: 'hd' | '4k'}>;
        };
      };
      const post = out?.post;
      if (!post) return;
      if (reqId !== liveV2PreviewReq) return;
      liveV2PreviewDebug(`resolve ok variants=${(post.variants || []).map(v => v.variant).join(',') || '-'} preview=${String(post.preview_motion_remote ?? '') || '-'}`);
      const variants = Array.isArray(post.variants) ? post.variants : [];
      const hasHd = variants.some(v => v.variant === 'hd');
      const has4k = variants.some(v => v.variant === '4k');
      const resolvedThumb = String(post.thumb_remote ?? item.thumb_remote ?? '');
      const resolvedPreview = String(post.preview_motion_remote ?? item.preview_motion_remote ?? '');
      const motionGuess = item.provider === 'motionbgs' && !resolvedPreview
        ? deriveMotionBgsPreviewFromThumb(resolvedThumb)
        : '';
      liveV2SelectedBrowse = {
        ...(liveV2SelectedBrowse ?? item),
        title: String(post.title ?? item.title),
        thumb_remote: resolvedThumb,
        preview_motion_remote: localFirst ? '' : (resolvedPreview || (item.provider === 'moewalls' ? deriveMoeWallsPreviewFromThumb(resolvedThumb) : motionGuess)),
        preview_motion_blob: String(liveV2SelectedBrowse?.preview_motion_blob ?? ''),
        tags: Array.isArray(post.tags) ? post.tags : (item.tags ?? []),
        has_hd: hasHd || item.has_hd,
        has_4k: has4k || item.has_4k
      };
      try {
        liveV2PreviewDebug('request preview cache (live preview)');
        const previewOut = await liveV2Run(['preview', item.page_url]) as {
          ok: boolean;
          motion_available?: boolean;
          local_path?: string;
          remote_url?: string;
        };
        if (previewOut?.motion_available) {
          if (reqId !== liveV2PreviewReq) return;
          liveV2PreviewDebug(`preview cached local=${String(previewOut.local_path ?? '') || '-'} remote=${String(previewOut.remote_url ?? '') || '-'}`);
          liveV2SelectedBrowse = {
            ...(liveV2SelectedBrowse ?? item),
            preview_motion_local: String(previewOut.local_path ?? ''),
            preview_motion_remote: localFirst
              ? ''
              : String(previewOut.remote_url ?? (liveV2SelectedBrowse?.preview_motion_remote ?? '')),
            preview_motion_blob: String(liveV2SelectedBrowse?.preview_motion_blob ?? '')
          };
          if (localFirst) {
            const local = String(previewOut.local_path ?? '').trim();
            if (isMp4Path(local)) {
              liveV2PreviewDebug('use local mp4 directly (skip blob-first)');
            } else {
              liveV2PreviewDebug('promote local preview to blob (blob-first)');
              void promoteLocalPreviewToBlob();
            }
          }
        } else {
          liveV2PreviewDebug('preview cache unavailable (motion_available=false)');
        }
      } catch (e) {
        liveV2PreviewDebug(`preview cache error: ${String(e)}`);
      }
    } catch (e) {
      liveV2PreviewDebug(`open details error: ${String(e)}`);
    }
    finally {
      if (reqId === liveV2PreviewReq) {
        const chosen = liveV2MotionPreviewSrc(liveV2SelectedBrowse);
        liveV2PreviewDebug(`final source=${chosen ? chosen.slice(0, 180) : '-'} local=${String(liveV2SelectedBrowse?.preview_motion_local ?? '') ? 'yes' : 'no'} remote=${String(liveV2SelectedBrowse?.preview_motion_remote ?? '') ? 'yes' : 'no'}`);
        liveV2PreviewLoading = false;
        void startLiveV2NativePreview(liveV2SelectedBrowse);
      }
    }
  }

  async function applyLiveV2(id: string): Promise<void> {
    const monitor = liveV2Monitor.trim() || liveMonitorOptions()[0] || '';
    if (!monitor) {
      pushToast(tr('Select a monitor first', 'Selecciona un monitor primero'), 'error');
      return;
    }
    liveV2Busy = true;
    try {
      await liveV2Run(['apply', id, '--monitor', monitor, '--quality', liveV2Quality]);
      pushToast(tr(`Applied on ${monitor}`, `Aplicado en ${monitor}`), 'success');
      await loadLiveV2Library();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function toggleFavoriteLiveV2(item: LiveIndexItem): Promise<void> {
    liveV2Busy = true;
    try {
      await liveV2Run(['favorite', item.id, item.favorite ? 'off' : 'on']);
      await loadLiveV2Library();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function removeLiveV2(item: LiveIndexItem): Promise<void> {
    liveV2Busy = true;
    try {
      await liveV2Run(['remove', item.id, '--delete-files']);
      await loadLiveV2Library();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function openLiveV2Folder(id?: string): Promise<void> {
    liveV2Busy = true;
    try {
      const out = await liveV2Run(id ? ['open', '--id', id] : ['open']) as {ok: boolean; path?: string};
      const p = String(out?.path ?? '').trim();
      if (!p) throw new Error('No path returned');
      await invoke('kitowall_open_path', {path: p});
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function loadLiveV2Doctor(): Promise<void> {
    try {
      const out = await liveV2Run(['doctor']) as {ok: boolean; deps: Record<string, boolean>; fix: string[]};
      liveV2Doctor = out;
    } catch (e) {
      liveV2Doctor = null;
      lastError = String(e);
    }
  }

  async function saveLiveV2Runner(): Promise<void> {
    liveV2Busy = true;
    try {
      await liveV2Run([
        'config',
        'runner',
        '--bin-name', liveV2RunnerBin.trim()
      ]);
      await loadLiveV2Config();
      await loadLiveV2Doctor();
      pushToast(tr('Runner config saved', 'Configuracion de runner guardada'), 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function installLiveV2Dependencies(): Promise<void> {
    liveV2Busy = true;
    try {
      const out = await liveV2Run(['doctor', '--fix']) as {ok: boolean; deps: Record<string, boolean>; fix: string[]};
      liveV2Doctor = out;
      pushToast(tr('Dependencies install command executed', 'Comando de instalacion de dependencias ejecutado'), 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
  }

  async function saveLiveV2ApplyDefaults(): Promise<void> {
    liveV2Busy = true;
    try {
      await liveV2Run([
        'config',
        'apply-defaults',
        '--keep-services', String(!!liveV2ApplyDefaults.keep_services),
        '--mute-audio', String(!!liveV2ApplyDefaults.mute_audio),
        '--profile', liveV2ApplyDefaults.profile,
        '--display-fps', liveV2ApplyDefaults.display_fps === null ? 'off' : String(Math.max(1, Math.floor(Number(liveV2ApplyDefaults.display_fps) || 1))),
        '--seamless-loop', String(!!liveV2ApplyDefaults.seamless_loop),
        '--loop-crossfade', String(!!liveV2ApplyDefaults.loop_crossfade),
        '--loop-crossfade-seconds', String(liveV2ApplyDefaults.loop_crossfade_seconds),
        '--optimize', String(!!liveV2ApplyDefaults.optimize),
        '--proxy-width-hd', String(Math.max(320, Math.floor(Number(liveV2ApplyDefaults.proxy_width_hd) || 1920))),
        '--proxy-width-4k', String(Math.max(320, Math.floor(Number(liveV2ApplyDefaults.proxy_width_4k) || 3840))),
        '--proxy-fps', String(liveV2ApplyDefaults.proxy_fps),
        '--proxy-crf-hd', String(liveV2ApplyDefaults.proxy_crf_hd),
        '--proxy-crf-4k', String(liveV2ApplyDefaults.proxy_crf_4k)
      ]);
      await loadLiveV2Config();
      pushToast(tr('Apply defaults saved', 'Defaults de apply guardados'), 'success');
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      liveV2Busy = false;
    }
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

  $: {
    const q = kitsuneStartMonitorFilter.trim().toLowerCase();
    kitsuneVisibleMonitorOptions = !q
      ? kitsuneMonitorOptions
      : kitsuneMonitorOptions.filter(o => o.toLowerCase().includes(q));
  }

  $: {
    const q = kitsuneMonitorNameFilter.trim().toLowerCase();
    kitsuneVisibleMonitorNameOptions = !q
      ? kitsuneMonitorOptions
      : kitsuneMonitorOptions.filter(o => o.toLowerCase().includes(q));
  }

  $: {
    const q = kitsuneInstanceMonitorFilter.trim().toLowerCase();
    kitsuneVisibleInstanceMonitorOptions = !q
      ? kitsuneMonitorOptions
      : kitsuneMonitorOptions.filter(o => o.toLowerCase().includes(q));
  }

  $: {
    const q = kitsuneAutostartMonitorFilter.trim().toLowerCase();
    kitsuneVisibleAutostartMonitorOptions = !q
      ? kitsuneMonitorOptions
      : kitsuneMonitorOptions.filter(o => o.toLowerCase().includes(q));
  }

  $: {
    const q = kitsuneGroupLayerProfileFilter.trim().toLowerCase();
    kitsuneVisibleGroupLayerProfiles = !q
      ? kitsuneProfileOptions
      : kitsuneProfileOptions.filter(o => o.toLowerCase().includes(q));
  }

  $: {
    const q = kitsuneGroupPickerFilter.trim().toLowerCase();
    kitsuneVisibleGroupOptions = !q
      ? kitsuneGroupOptions
      : kitsuneGroupOptions.filter(o => o.toLowerCase().includes(q));
  }

  $: {
    const candidate = normalizeGroupFileName(kitsuneGroupPickerFilter);
    kitsuneGroupCreateCandidate = candidate && !kitsuneGroupOptions.includes(candidate) ? candidate : '';
  }

  $: {
    const barsProfile = kitsuneProfileOptions.find(p => p.startsWith('bars')) ?? 'bars_balanced';
    const ringProfile = kitsuneProfileOptions.find(p => p.startsWith('ring')) ?? 'ring_energy';
    kitsuneGroupAddLayerOptions = [
      {id: 'bars-soft', label: `Bars Soft (${barsProfile})`, spec: `1,bars,bars,${barsProfile},#ffffff,0.35`},
      {id: 'bars-fill', label: `Bars Fill (${barsProfile})`, spec: `1,bars,bars_fill,${barsProfile},#74f7ff,0.30`},
      {id: 'waves-fill', label: `Waves Fill (${barsProfile})`, spec: `1,bars,waves_fill,${barsProfile},#ff8fd1,0.28`},
      {id: 'ring-energy', label: `Ring Energy (${ringProfile})`, spec: `1,ring,waves_fill,${ringProfile},#aef4ff,0.36`},
      {id: 'ring-dots', label: `Ring Dots (${ringProfile})`, spec: `1,ring,dots,${ringProfile},#ffc67a,0.26`}
    ];
    kitsuneGroupAddLayerSelected = kitsuneGroupAddLayerSelected.filter(id =>
      kitsuneGroupAddLayerOptions.some(o => o.id === id)
    );
    if (!kitsuneProfileOptions.includes(kitsuneGroupLayerProfile)) {
      kitsuneGroupLayerProfile = kitsuneGroupLayerMode === 'ring' ? ringProfile : barsProfile;
    }
  }

  $: {
    if (kitsuneGroupLayerMode === 'ring' && kitsuneGroupLayerStyle === 'bars') {
      kitsuneGroupLayerStyle = 'waves_fill';
    }
  }

  $: {
    const q = kitsuneStartProfileFilter.trim().toLowerCase();
    kitsuneVisibleProfileOptions = !q
      ? kitsuneProfileOptions
      : kitsuneProfileOptions.filter(o => o.toLowerCase().includes(q));
  }

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

  function parseKitsuneMonitors(stdout: string): string[] {
    const items = new Set<string>();
    for (const lineRaw of stdout.split('\n')) {
      const line = lineRaw.trim();
      if (!line) continue;
      const fromConfig = line.match(/monitor(?: actual en)? config:\s*([^\s]+)/i);
      if (fromConfig?.[1]) {
        items.add(fromConfig[1]);
        continue;
      }
      if (line.startsWith('Monitor ')) {
        const parts = line.split(/\s+/);
        if (parts[1]) items.add(parts[1]);
        continue;
      }
      const token = line.split(/\s+/)[0] ?? '';
      if (!token || token.includes('=')) continue;
      if (token.toLowerCase() === 'hyprctl') continue;
      items.add(token);
    }
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }

  function parseKitsuneProfiles(stdout: string): string[] {
    const items = new Set<string>();
    for (const lineRaw of stdout.split('\n')) {
      const line = lineRaw.trim();
      if (!line) continue;
      if (line.startsWith('[') || line.startsWith('Uso:')) continue;
      if (!/^[a-zA-Z0-9._-]+$/.test(line)) continue;
      items.add(line);
    }
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }

  function parseKitsuneGroupFiles(stdout: string): string[] {
    const items = new Set<string>();
    for (const lineRaw of stdout.split('\n')) {
      const line = lineRaw.trim();
      if (!line || line.startsWith('[')) continue;
      if (!line.endsWith('.group')) continue;
      if (!/^[a-zA-Z0-9._-]+\.group$/.test(line)) continue;
      items.add(line);
    }
    return Array.from(items).sort((a, b) => a.localeCompare(b));
  }

  function parseKitsuneGroupLayers(stdout: string): GroupLayerEntry[] {
    const rows: GroupLayerEntry[] = [];
    for (const lineRaw of stdout.split('\n')) {
      const line = lineRaw.trim();
      if (!line) continue;
      const m = line.match(/^(\d+):\s*layer=(.+)$/);
      if (!m) continue;
      const index = Number(m[1]);
      const parts = m[2].split(',').map(v => v.trim());
      rows.push({
        index,
        enabled: parts[0] ?? '',
        mode: parts[1] ?? '',
        style: parts[2] ?? '',
        profile: parts[3] ?? '',
        color: parts[4] ?? '',
        alpha: parts[5] ?? '',
        runtime: parts[6] ?? '',
        rotate: parts[7] ?? '',
        profilesPipe: parts[8] ?? ''
      });
    }
    return rows;
  }

  function normalizeGroupFileName(value: string): string {
    const clean = value.trim().replace(/\s+/g, '');
    if (!clean) return '';
    if (!/^[a-zA-Z0-9._-]+$/.test(clean)) return '';
    return clean.endsWith('.group') ? clean : `${clean}.group`;
  }

  async function loadKitsuneRuntimeOptions(): Promise<void> {
    try {
      const [monitorsResult, profilesResult] = await Promise.all([
        invoke<KitsuneRunResult>('kitowall_kitsune_run', {args: ['monitors', 'list']}),
        invoke<KitsuneRunResult>('kitowall_kitsune_run', {args: ['profiles', 'list', 'all']})
      ]);

      const monitors = monitorsResult.ok ? parseKitsuneMonitors(monitorsResult.stdout ?? '') : [];
      const profiles = profilesResult.ok ? parseKitsuneProfiles(profilesResult.stdout ?? '') : [];

      kitsuneMonitorOptions = monitors;
      kitsuneProfileOptions = profiles;

      if (kitsuneStartMonitor && !monitors.includes(kitsuneStartMonitor)) kitsuneStartMonitor = '';
      if (kitsuneMonitorName && !monitors.includes(kitsuneMonitorName)) kitsuneMonitorName = '';
      if (kitsuneInstanceMonitor && !monitors.includes(kitsuneInstanceMonitor)) kitsuneInstanceMonitor = '';
      if (kitsuneAutostartMonitor && !monitors.includes(kitsuneAutostartMonitor)) kitsuneAutostartMonitor = '';
      if (kitsuneStartProfile && !profiles.includes(kitsuneStartProfile)) kitsuneStartProfile = '';
      kitsuneStartProfilesSelected = kitsuneStartProfilesSelected.filter(p => profiles.includes(p));
    } catch {
      // Keep existing options if runtime probing fails.
    }
  }

  async function loadKitsuneGroupFiles(): Promise<void> {
    try {
      const result = await invoke<KitsuneRunResult>('kitowall_kitsune_run', {args: ['group', 'files']});
      const groups = result.ok ? parseKitsuneGroupFiles(result.stdout ?? '') : [];
      const current = normalizeGroupFileName(kitsuneGroupFile);
      kitsuneGroupOptions = current && !groups.includes(current) ? [...groups, current] : groups;
    } catch {
      // Keep previous options on failure.
    }
  }

  async function loadKitsuneGroupLayers(): Promise<void> {
    const groupFile = kitsuneGroupFile.trim();
    if (!groupFile) {
      kitsuneGroupLayers = [];
      return;
    }
    kitsuneGroupLayersBusy = true;
    try {
      const result = await invoke<KitsuneRunResult>('kitowall_kitsune_run', {
        args: ['group', 'list-layers', groupFile]
      });
      kitsuneGroupLayers = result.ok ? parseKitsuneGroupLayers(result.stdout ?? '') : [];
    } catch {
      kitsuneGroupLayers = [];
    } finally {
      kitsuneGroupLayersBusy = false;
    }
  }

  async function loadKitsuneGroupData(): Promise<void> {
    await loadKitsuneGroupFiles();
    await loadKitsuneGroupLayers();
  }

  function toggleKitsuneStartProfile(name: string): void {
    if (!name) return;
    if (kitsuneStartProfilesSelected.includes(name)) {
      kitsuneStartProfilesSelected = kitsuneStartProfilesSelected.filter(p => p !== name);
      return;
    }
    kitsuneStartProfilesSelected = [...kitsuneStartProfilesSelected, name];
  }

  function chooseKitsuneStartMonitor(name: string): void {
    kitsuneStartMonitor = name;
    kitsuneStartMonitorOpen = false;
  }

  function chooseKitsuneStartProfile(name: string): void {
    kitsuneStartProfile = name;
    kitsuneStartProfileOpen = false;
  }

  function onKitsuneStartMonitorFilterInput(e: Event): void {
    kitsuneStartMonitorFilter = (e.currentTarget as HTMLInputElement).value;
  }

  function onKitsuneStartProfileFilterInput(e: Event): void {
    kitsuneStartProfileFilter = (e.currentTarget as HTMLInputElement).value;
  }

  function chooseKitsuneMonitorName(name: string): void {
    kitsuneMonitorName = name;
    kitsuneMonitorNameOpen = false;
  }

  function chooseKitsuneInstanceMonitor(name: string): void {
    kitsuneInstanceMonitor = name;
    kitsuneInstanceMonitorOpen = false;
  }

  function chooseKitsuneAutostartMonitor(name: string): void {
    kitsuneAutostartMonitor = name;
    kitsuneAutostartMonitorOpen = false;
  }

  function onKitsuneMonitorNameFilterInput(e: Event): void {
    kitsuneMonitorNameFilter = (e.currentTarget as HTMLInputElement).value;
  }

  function onKitsuneInstanceMonitorFilterInput(e: Event): void {
    kitsuneInstanceMonitorFilter = (e.currentTarget as HTMLInputElement).value;
  }

  function onKitsuneAutostartMonitorFilterInput(e: Event): void {
    kitsuneAutostartMonitorFilter = (e.currentTarget as HTMLInputElement).value;
  }

  function chooseKitsuneGroupLayerEnabled(value: '1' | '0'): void {
    kitsuneGroupLayerEnabled = value;
    kitsuneGroupLayerEnabledOpen = false;
  }

  function chooseKitsuneGroupLayerMode(value: 'bars' | 'ring'): void {
    kitsuneGroupLayerMode = value;
    kitsuneGroupLayerModeOpen = false;
  }

  function chooseKitsuneGroupLayerStyle(value: 'bars' | 'bars_fill' | 'waves' | 'waves_fill' | 'dots'): void {
    kitsuneGroupLayerStyle = value;
    kitsuneGroupLayerStyleOpen = false;
  }

  function chooseKitsuneGroupLayerProfile(value: string): void {
    kitsuneGroupLayerProfile = value;
    kitsuneGroupLayerProfileOpen = false;
  }

  function onKitsuneGroupLayerProfileFilterInput(e: Event): void {
    kitsuneGroupLayerProfileFilter = (e.currentTarget as HTMLInputElement).value;
  }

  function chooseKitsuneGroupFile(name: string): void {
    const clean = normalizeGroupFileName(name);
    if (!clean) return;
    kitsuneGroupFile = clean;
    kitsuneGroupPickerOpen = false;
    void loadKitsuneGroupLayers();
  }

  function onKitsuneGroupPickerFilterInput(e: Event): void {
    kitsuneGroupPickerFilter = (e.currentTarget as HTMLInputElement).value;
  }

  async function createKitsuneGroupFile(): Promise<void> {
    const candidate = kitsuneGroupCreateCandidate;
    if (!candidate) return;
    kitsuneBusy = true;
    lastError = null;
    try {
      const args = ['group', 'create', candidate];
      const result = await invoke<KitsuneRunResult>('kitowall_kitsune_run', {args});
      const stderr = (result.stderr ?? '').trim();
      const stdout = (result.stdout ?? '').trim();
      if (!result.ok) {
        throw new Error(stderr || stdout || `group create failed (exit ${result.exitCode})`);
      }
      kitsuneLastCommand = `kitsune ${args.join(' ')}`;
      kitsuneOutput = [stdout, stderr].filter(Boolean).join('\n');
      kitsuneGroupFile = candidate;
      kitsuneGroupPickerFilter = '';
      kitsuneGroupPickerOpen = false;
      pushToast(`Group created: ${candidate}`, 'success');
      await loadKitsuneGroupData();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      kitsuneBusy = false;
    }
  }

  function toggleKitsuneGroupAddLayer(id: string): void {
    if (!id) return;
    if (kitsuneGroupAddLayerSelected.includes(id)) {
      kitsuneGroupAddLayerSelected = kitsuneGroupAddLayerSelected.filter(v => v !== id);
      return;
    }
    kitsuneGroupAddLayerSelected = [...kitsuneGroupAddLayerSelected, id];
  }

  async function runKitsuneGroupAddSelectedLayers(): Promise<void> {
    const groupPath = kitsuneGroupFile.trim();
    if (!groupPath) return;
    const selected = kitsuneGroupAddLayerOptions.filter(o => kitsuneGroupAddLayerSelected.includes(o.id));
    if (selected.length === 0) return;

    kitsuneBusy = true;
    lastError = null;
    const chunks: string[] = [];
    try {
      for (const option of selected) {
        const args = ['group', 'add-layer', option.spec, groupPath];
        const result = await invoke<KitsuneRunResult>('kitowall_kitsune_run', {args});
        const stdout = (result.stdout ?? '').trim();
        const stderr = (result.stderr ?? '').trim();
        chunks.push([`$ kitsune ${args.join(' ')}`, stdout, stderr].filter(Boolean).join('\n'));
        if (!result.ok) {
          throw new Error(stderr || stdout || `group add-layer failed (exit ${result.exitCode})`);
        }
      }

      kitsuneLastCommand = `kitsune group add-layer x${selected.length}`;
      kitsuneOutput = chunks.join('\n\n');
      pushToast(`Added ${selected.length} layer(s)`, 'success');
      kitsuneGroupAddLayerOpen = false;
      kitsuneGroupAddLayerSelected = [];
      await loadKitsuneGroupData();
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      kitsuneBusy = false;
    }
  }

  function buildKitsuneGroupLayerSpec(): string {
    const alpha = Math.max(0, Math.min(1, Number(kitsuneGroupLayerAlpha) || 0));
    const color = kitsuneGroupLayerColor.trim() || '#ffffff';
    const profile = kitsuneGroupLayerProfile.trim() || 'bars_balanced';
    return [
      kitsuneGroupLayerEnabled,
      kitsuneGroupLayerMode,
      kitsuneGroupLayerStyle,
      profile,
      color,
      alpha.toFixed(2)
    ].join(',');
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
    if (isLiveServicesLocked()) {
      pushToast(liveServicesLockMessage(), 'info');
      return;
    }
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
    if (isLiveServicesLocked()) {
      pushToast(liveServicesLockMessage(), 'info');
      return;
    }
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

  async function runKitsuneCommand(args: string[]): Promise<void> {
    if (isKitsuneCommandBlockedByLive(args)) {
      pushToast(liveServicesLockMessage(), 'info');
      return;
    }
    kitsuneBusy = true;
    lastError = null;
    kitsuneLastCommand = `kitsune ${args.join(' ')}`.trim();
    try {
      const result = await invoke<KitsuneRunResult>('kitowall_kitsune_run', {args});
      const stderr = (result.stderr ?? '').trim();
      const stdout = (result.stdout ?? '').trim();
      kitsuneOutput = [stdout, stderr].filter(Boolean).join('\n');
      if (!result.ok) {
        const msg = stderr || stdout || `kitsune command failed (exit ${result.exitCode})`;
        lastError = msg;
        pushToast(msg, 'error');
        return;
      }
      pushToast(`Executed: ${kitsuneLastCommand}`, 'success');
      if (args[0] === 'help') {
        await loadKitsuneStatus();
      } else if (kitsuneStatus?.installed) {
        if (['install', 'monitor', 'monitors', 'profiles', 'reset', 'start'].includes(args[0])) {
          await loadKitsuneRuntimeOptions();
        }
        if (args[0] === 'group' || args[0] === 'group-file') {
          await loadKitsuneGroupData();
        }
      }
    } catch (e) {
      lastError = String(e);
      pushToast(String(e), 'error');
    } finally {
      kitsuneBusy = false;
    }
  }

  function selectKitsuneTab(id: KitsuneTabId): void {
    kitsuneTab = id;
    if (id === 'group' && kitsuneStatus?.installed) {
      void loadKitsuneGroupData();
    }
  }

  async function loadKitsuneStatus(): Promise<void> {
    kitsuneBusy = true;
    lastError = null;
    try {
      const data = await invoke<KitsuneStatusReport>('kitowall_kitsune_status');
      kitsuneStatus = data;
      if (data.installed) {
        await loadKitsuneRuntimeOptions();
        await loadKitsuneGroupData();
      } else {
        kitsuneMonitorOptions = [];
        kitsuneProfileOptions = [];
        kitsuneStartProfilesSelected = [];
        kitsuneGroupOptions = [];
        kitsuneGroupLayers = [];
      }
    } catch (e) {
      lastError = String(e);
      kitsuneStatus = null;
      pushToast(String(e), 'error');
    } finally {
      kitsuneBusy = false;
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
    if (isLiveServicesLocked()) {
      pushToast(liveServicesLockMessage(), 'info');
      return;
    }
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
    if (isLiveServicesLocked()) {
      pushToast(liveServicesLockMessage(), 'info');
      return;
    }
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
    if (isLiveServicesLocked()) {
      pushToast(liveServicesLockMessage(), 'info');
      return;
    }
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

  $: {
    const nativeSrc = liveV2PreviewEngine === 'native' && liveV2SideOpen
      ? liveV2NativePreviewSrc(liveV2SelectedBrowse)
      : '';
    if (!nativeSrc) {
      void stopLiveV2NativePreview();
    } else if (nativeSrc !== liveV2NativePreviewLastSrc) {
      void startLiveV2NativePreview(liveV2SelectedBrowse);
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
    loadLiveAuthorityStatus();

    statusPollTimer = setInterval(() => {
      void syncStatus();
    }, STATUS_POLL_MS);

    const onFocus = () => {
      void syncStatus();
      void loadLiveAuthorityStatus();
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
        kitsuneStartMonitorOpen = false;
        kitsuneStartProfileOpen = false;
        kitsuneMonitorNameOpen = false;
        kitsuneInstanceMonitorOpen = false;
        kitsuneAutostartMonitorOpen = false;
        kitsuneGroupLayerEnabledOpen = false;
        kitsuneGroupLayerModeOpen = false;
        kitsuneGroupLayerStyleOpen = false;
        kitsuneGroupLayerProfileOpen = false;
        kitsuneGroupPickerOpen = false;
      }
      if (!target.closest('.gs-select')) {
        gsSelectOpen = null;
      }
      if (!target.closest('.multi-select')) {
        wallhavenCategoriesOpen = false;
        wallhavenPurityOpen = false;
        kitsuneStartProfilesOpen = false;
        kitsuneGroupAddLayerOpen = false;
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
    if (liveJobPollTimer) clearInterval(liveJobPollTimer);
    void stopLiveV2NativePreview();
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
    <button class={`menu-item ${activeSection === 'kitsune' ? 'active' : ''}`} on:click={() => selectSection('kitsune')}>
      Kitsune
    </button>
    <button class={`menu-item ${activeSection === 'kitsune-live' ? 'active' : ''}`} on:click={() => selectSection('kitsune-live')}>
      LiveWallpapers
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
    {#if liveAuthority?.active}
      <div class="banner warn">
        {tr(
          'LiveWallpapers active: swww / rotation / spectra are temporarily disabled.',
          'LiveWallpapers activo: swww / rotacion / espectros estan deshabilitados temporalmente.'
        )}
        <div class="row actions-buttons-row">
          <button class="secondary" on:click={stopLiveAuthority} disabled={liveBusy}>{tr('Stop LiveWallpapers', 'Detener LiveWallpapers')}</button>
          {#if liveAuthority?.state?.started_at}
            <span class="badge">since: {formatTimestamp(liveAuthority.state.started_at)}</span>
          {/if}
          {#if liveAuthority?.state?.snapshot_id}
            <span class="badge">snapshot: {liveAuthority.state.snapshot_id}</span>
          {/if}
        </div>
      </div>
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
        {#if isLiveServicesLocked()}
          <div class="banner warn">{liveServicesLockMessage()}</div>
        {/if}
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
                <code>kitowall init --namespace kitowall --apply --force</code>
              </div>
              <button on:click={runRepair} disabled={busy || isLiveServicesLocked()}>{tr('Repair (init --apply)', 'Reparar (init --apply)')}</button>
            </div>
          {/if}
        {:else}
          <div>{tr('Loading...', 'Cargando...')}</div>
        {/if}
      </div>

      <h2>{tr('Actions', 'Acciones')}</h2>
      <div class="card">
        <div class="row">
          <button on:click={() => runNext(false)} disabled={busy || isLiveServicesLocked()}>{tr('Next', 'Siguiente')}</button>
          <button class="secondary" on:click={() => runNext(true)} disabled={busy || isLiveServicesLocked()}>{tr('Rotate Now', 'Rotar Ahora')}</button>
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
            <button class="secondary next-pack-btn" on:click={runNextForSelectedPack} disabled={busy || isLiveServicesLocked()}>
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
                      <img
                        class="monitor-image"
                        src={imageSrc(status.last_set?.[output]) ?? ''}
                        alt={`last wallpaper for ${output}`}
                        on:error={(e) => onGalleryImageError(e, status.last_set?.[output] ?? '')}
                      />
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
        {#if isLiveServicesLocked()}
          <div class="banner warn">{liveServicesLockMessage()}</div>
        {/if}
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
          <button on:click={saveSettings} disabled={busySettings || isLiveServicesLocked()}>{tr('Save Settings', 'Guardar Configuracion')}</button>
          <button class="secondary" on:click={applyTimerInterval} disabled={busySettings || isLiveServicesLocked()}>{tr('Apply Timer', 'Aplicar Timer')}</button>
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
                  <div
                    class="syslog-url url-click"
                    role="button"
                    tabindex="0"
                    title={tr('Open in browser', 'Abrir en navegador')}
                    on:click={() => openExternalUrl(row.url ?? '')}
                    on:keydown={(e) => onExternalUrlKeydown(e, row.url ?? '')}
                  >{row.url}</div>
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
    {:else if activeSection === 'kitsune'}
      <h2>Kitsune</h2>
      <div class="card">
        {#if isLiveServicesLocked()}
          <div class="banner warn">{liveServicesLockMessage()}</div>
        {/if}
        <div class="row actions-buttons-row">
          <button class="secondary" on:click={loadKitsuneStatus} disabled={kitsuneBusy}>
            {tr('Check Installation', 'Validar Instalacion')}
          </button>
          <button class="secondary" on:click={() => runKitsuneCommand(['help'])} disabled={kitsuneBusy}>
            {tr('Reload Commands', 'Recargar Comandos')}
          </button>
        </div>
        {#if kitsuneBusy}
          <p class="muted">{tr('Checking Kitsune installation...', 'Validando instalacion de Kitsune...')}</p>
        {:else if kitsuneStatus}
          <div class="row">
            <span class={`badge status ${kitsuneStatus.installed ? 'ok' : 'bad'}`}>
              {tr('installed', 'instalado')}: {kitsuneStatus.installed ? 'true' : 'false'}
            </span>
            <span class="badge">{tr('commands detected', 'comandos detectados')}: {kitsuneStatus.commands.length}</span>
          </div>
          {#if !kitsuneStatus.installed}
            <p class="muted">{kitsuneStatus.error ?? tr('Kitsune is not available in PATH.', 'Kitsune no esta disponible en PATH.')}</p>
          {:else}
            <p class="muted">{tr('Kitsune is installed. Use top tabs to access each submodule.', 'Kitsune esta instalado. Usa las tabs de arriba para entrar a cada submodulo.')}</p>
            <div class="kitsune-tabs">
              <button class={`kitsune-tab ${kitsuneTab === 'core' ? 'active' : ''}`} on:click={() => selectKitsuneTab('core')}>Core</button>
              <button class={`kitsune-tab ${kitsuneTab === 'profiles' ? 'active' : ''}`} on:click={() => selectKitsuneTab('profiles')}>Profiles Lab</button>
              <button class={`kitsune-tab ${kitsuneTab === 'group' ? 'active' : ''}`} on:click={() => selectKitsuneTab('group')}>Group Composer</button>
              <button class={`kitsune-tab ${kitsuneTab === 'visual' ? 'active' : ''}`} on:click={() => selectKitsuneTab('visual')}>Visual FX</button>
              <button class={`kitsune-tab ${kitsuneTab === 'render' ? 'active' : ''}`} on:click={() => selectKitsuneTab('render')}>Render</button>
              <button class={`kitsune-tab ${kitsuneTab === 'monitors' ? 'active' : ''}`} on:click={() => selectKitsuneTab('monitors')}>Monitors & Color</button>
              <button class={`kitsune-tab ${kitsuneTab === 'system' ? 'active' : ''}`} on:click={() => selectKitsuneTab('system')}>System & Instances</button>
              <button class={`kitsune-tab ${kitsuneTab === 'logs' ? 'active' : ''}`} on:click={() => selectKitsuneTab('logs')}>Logs & Diagnostics</button>
            </div>

            {#if kitsuneTab === 'core'}
              <div class="grid kitsune-grid">
                <div class="card">
                  <h3>Lifecycle</h3>
                  <div class="row">
                    <button on:click={() => runKitsuneCommand(['install', ...(kitsuneInstallPackages ? ['--install-packages'] : [])])} disabled={kitsuneBusy || isLiveServicesLocked()}>Install</button>
                    <label class="inline-check"><input type="checkbox" bind:checked={kitsuneInstallPackages} /> install packages</label>
                  </div>
                  <div class="row">
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneStartMonitorOpen = !kitsuneStartMonitorOpen)}
                        aria-expanded={kitsuneStartMonitorOpen}
                      >
                        <span>{kitsuneStartMonitor || 'monitor (optional)'}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneStartMonitorOpen}
                        <div class="pack-select-menu">
                          <input
                            class="pack-filter"
                            placeholder="filter monitors..."
                            value={kitsuneStartMonitorFilter}
                            on:click|stopPropagation
                            on:input={onKitsuneStartMonitorFilterInput}
                          />
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneStartMonitor('')}>monitor (optional)</button>
                          {#each kitsuneVisibleMonitorOptions as monitorName}
                            <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneStartMonitor(monitorName)}>
                              {monitorName}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneStartProfileOpen = !kitsuneStartProfileOpen)}
                        aria-expanded={kitsuneStartProfileOpen}
                      >
                        <span>{kitsuneStartProfile || '--profile (optional)'}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneStartProfileOpen}
                        <div class="pack-select-menu">
                          <input
                            class="pack-filter"
                            placeholder="filter profiles..."
                            value={kitsuneStartProfileFilter}
                            on:click|stopPropagation
                            on:input={onKitsuneStartProfileFilterInput}
                          />
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneStartProfile('')}>--profile (optional)</button>
                          {#each kitsuneVisibleProfileOptions as profileName}
                            <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneStartProfile(profileName)}>
                              {profileName}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <div class="multi-select">
                      <button type="button" class="multi-select-trigger" on:click|stopPropagation={() => (kitsuneStartProfilesOpen = !kitsuneStartProfilesOpen)}>
                        <div class="multi-select-badges">
                          {#if kitsuneStartProfilesSelected.length === 0}
                            <span class="muted">--profiles (optional)</span>
                          {:else}
                            {#each kitsuneStartProfilesSelected as profileName}
                              <span class="badge">{profileName}</span>
                            {/each}
                          {/if}
                        </div>
                        <span class="badge">{kitsuneStartProfilesSelected.length}</span>
                      </button>
                      {#if kitsuneStartProfilesOpen}
                        <div class="multi-select-menu">
                          {#if kitsuneProfileOptions.length === 0}
                            <div class="muted">No profiles detected</div>
                          {:else}
                            {#each kitsuneProfileOptions as profileName}
                              <button
                                type="button"
                                class="multi-option"
                                on:click|stopPropagation={() => toggleKitsuneStartProfile(profileName)}
                              >
                                <span>{profileName}</span>
                                <span class={`badge status ${kitsuneStartProfilesSelected.includes(profileName) ? 'ok' : 'bad'}`}>
                                  {kitsuneStartProfilesSelected.includes(profileName) ? 'on' : 'off'}
                                </span>
                              </button>
                            {/each}
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <span class="field-label">target</span>
                    <select bind:value={kitsuneStartTarget}><option value="mpvpaper">mpvpaper</option><option value="layer-shell">layer-shell</option></select>
                    <span class="field-label">mode</span>
                    <select bind:value={kitsuneStartMode}><option value="bars">bars</option><option value="ring">ring</option></select>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => {
                      const args = ['start'];
                      if (kitsuneStartMonitor.trim()) args.push(kitsuneStartMonitor.trim());
                      if (kitsuneStartProfile.trim()) { args.push('--profile', kitsuneStartProfile.trim()); }
                      if (kitsuneStartProfilesSelected.length > 0) { args.push('--profiles', kitsuneStartProfilesSelected.join(',')); }
                      args.push('--target', kitsuneStartTarget, '--mode', kitsuneStartMode);
                      void runKitsuneCommand(args);
                    }} disabled={kitsuneBusy || isLiveServicesLocked()}>Start</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['stop', ...(kitsuneStartMonitor.trim() ? [kitsuneStartMonitor.trim()] : [])])} disabled={kitsuneBusy || isLiveServicesLocked()}>Stop</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['restart'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Restart</button>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['status'])} disabled={kitsuneBusy}>Status</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['doctor'])} disabled={kitsuneBusy}>Doctor</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['doctor', '--fix'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Doctor --fix</button>
                  </div>
                </div>
              </div>
            {/if}

            {#if kitsuneTab === 'profiles'}
              <div class="grid kitsune-grid kitsune-profiles-grid">
                <div class="card">
                  <h3>Profiles</h3>
                  <div class="row">
                    <select bind:value={kitsuneProfilesMode}><option value="all">all</option><option value="bars">bars</option><option value="ring">ring</option></select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['profiles', 'list', ...(kitsuneProfilesMode === 'all' ? [] : [kitsuneProfilesMode])])} disabled={kitsuneBusy}>List</button>
                    <select bind:value={kitsuneProfileName}>
                      <option value="">profile name</option>
                      {#each kitsuneProfileOptions as profileName}
                        <option value={profileName}>{profileName}</option>
                      {/each}
                    </select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['profiles', 'show', kitsuneProfileName.trim()])} disabled={kitsuneBusy || !kitsuneProfileName.trim()}>Show</button>
                  </div>
                  <div class="row">
                    <select bind:value={kitsuneProfileBase}>
                      <option value="">clone base</option>
                      {#each kitsuneProfileOptions as profileName}
                        <option value={profileName}>{profileName}</option>
                      {/each}
                    </select>
                    <input bind:value={kitsuneProfileNew} placeholder="clone new" />
                    <button class="secondary" on:click={() => runKitsuneCommand(['profiles', 'clone', kitsuneProfileBase.trim(), kitsuneProfileNew.trim()])} disabled={kitsuneBusy || !kitsuneProfileBase.trim() || !kitsuneProfileNew.trim()}>Clone</button>
                  </div>
                  <div class="row">
                    <input bind:value={kitsuneProfileKey} placeholder="key" />
                    <input bind:value={kitsuneProfileValue} placeholder="value" />
                    <button class="secondary" on:click={() => runKitsuneCommand(['profiles', 'set', kitsuneProfileName.trim(), kitsuneProfileKey.trim(), kitsuneProfileValue.trim()])} disabled={kitsuneBusy || !kitsuneProfileName.trim() || !kitsuneProfileKey.trim() || !kitsuneProfileValue.trim()}>Set</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['test-load', kitsuneProfileName.trim()])} disabled={kitsuneBusy || !kitsuneProfileName.trim()}>Test Load</button>
                  </div>
                </div>
                <div class="card">
                  <h3>Spectrum Lab</h3>
                  <p class="muted">{tr('Use runtime test + test-load to validate profile changes before standard run.', 'Usa runtime test + test-load para validar cambios antes de usar modo standard.')}</p>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['runtime', 'test'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Runtime Test</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['runtime', 'standard'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Runtime Standard</button>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['rotate', 'next', '--apply'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Rotate Next</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['rotate', 'prev', '--apply'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Rotate Prev</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['rotate', 'shuffle'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Rotate Shuffle</button>
                  </div>
                  <div class="row">
                    <input type="number" bind:value={kitsuneRotationSeconds} min="1" />
                    <button class="secondary" on:click={() => runKitsuneCommand(['rotation', String(Math.max(1, Math.floor(Number(kitsuneRotationSeconds) || 1)))])} disabled={kitsuneBusy || isLiveServicesLocked()}>Set Rotation Seconds</button>
                  </div>
                  <div class="row">
                    <input bind:value={kitsuneProfileListValue} placeholder="p1,p2,p3" />
                    <select bind:value={kitsuneProfileListMode}><option value="bars">bars</option><option value="ring">ring</option></select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['profiles', 'set-list', kitsuneProfileListMode, kitsuneProfileListValue.trim()])} disabled={kitsuneBusy || !kitsuneProfileListValue.trim()}>Set Profile List</button>
                  </div>
                  <div class="row">
                    <select bind:value={kitsuneTuneMode}><option value="bars">bars</option><option value="ring">ring</option></select>
                    <input bind:value={kitsuneTunePreset} placeholder="preset" />
                    <button class="secondary" on:click={() => runKitsuneCommand(['tune', kitsuneTunePreset.trim(), kitsuneTuneMode])} disabled={kitsuneBusy || !kitsuneTunePreset.trim()}>Tune</button>
                  </div>
                </div>
              </div>
            {/if}

            {#if kitsuneTab === 'group'}
              <div class="grid kitsune-grid">
                <div class="card">
                  <h3>Group Composer</h3>
                  <div class="row">
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneGroupPickerOpen = !kitsuneGroupPickerOpen)}
                        aria-expanded={kitsuneGroupPickerOpen}
                      >
                        <span>{kitsuneGroupFile || 'select group'}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneGroupPickerOpen}
                        <div class="pack-select-menu">
                          <input
                            class="pack-filter"
                            placeholder="filter or type new group..."
                            value={kitsuneGroupPickerFilter}
                            on:click|stopPropagation
                            on:input={onKitsuneGroupPickerFilterInput}
                          />
                          {#if kitsuneVisibleGroupOptions.length === 0}
                            <div class="muted">No groups detected</div>
                          {:else}
                            {#each kitsuneVisibleGroupOptions as groupName}
                              <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupFile(groupName)}>
                                {groupName}
                              </button>
                            {/each}
                          {/if}
                          {#if kitsuneGroupCreateCandidate}
                            <button type="button" class="pack-option" on:click|stopPropagation={() => void createKitsuneGroupFile()}>
                              + create {kitsuneGroupCreateCandidate}
                            </button>
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <button class="secondary" on:click={() => void createKitsuneGroupFile()} disabled={kitsuneBusy || !kitsuneGroupCreateCandidate}>Create Group</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['spectrum-mode', 'group'])} disabled={kitsuneBusy}>Enable Group Mode</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['group-file', kitsuneGroupFile.trim()])} disabled={kitsuneBusy || !kitsuneGroupFile.trim()}>Set Group File</button>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['group', 'validate', kitsuneGroupFile.trim()])} disabled={kitsuneBusy || !kitsuneGroupFile.trim()}>Validate</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['group', 'list-layers', kitsuneGroupFile.trim()])} disabled={kitsuneBusy || !kitsuneGroupFile.trim()}>List Layers</button>
                  </div>
                  <div class="row">
                    <div class="multi-select">
                      <button type="button" class="multi-select-trigger" on:click|stopPropagation={() => (kitsuneGroupAddLayerOpen = !kitsuneGroupAddLayerOpen)}>
                        <div class="multi-select-badges">
                          {#if kitsuneGroupAddLayerSelected.length === 0}
                            <span class="muted">Select layers to add</span>
                          {:else}
                            {#each kitsuneGroupAddLayerOptions.filter(o => kitsuneGroupAddLayerSelected.includes(o.id)) as selectedOption}
                              <span class="badge">{selectedOption.label}</span>
                            {/each}
                          {/if}
                        </div>
                        <span class="badge">{kitsuneGroupAddLayerSelected.length}</span>
                      </button>
                      {#if kitsuneGroupAddLayerOpen}
                        <div class="multi-select-menu">
                          {#each kitsuneGroupAddLayerOptions as option}
                            <button
                              type="button"
                              class="multi-option"
                              on:click|stopPropagation={() => toggleKitsuneGroupAddLayer(option.id)}
                            >
                              <span>{option.label}</span>
                              <span class={`badge status ${kitsuneGroupAddLayerSelected.includes(option.id) ? 'ok' : 'bad'}`}>
                                {kitsuneGroupAddLayerSelected.includes(option.id) ? 'on' : 'off'}
                              </span>
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <button class="secondary" on:click={() => void runKitsuneGroupAddSelectedLayers()} disabled={kitsuneBusy || kitsuneGroupAddLayerSelected.length === 0 || !kitsuneGroupFile.trim()}>Add Layer</button>
                  </div>
                  <div class="row">
                    <input type="number" bind:value={kitsuneGroupLayerIndex} min="1" />
                    <span class="field-label">enabled</span>
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneGroupLayerEnabledOpen = !kitsuneGroupLayerEnabledOpen)}
                        aria-expanded={kitsuneGroupLayerEnabledOpen}
                      >
                        <span>{kitsuneGroupLayerEnabled}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneGroupLayerEnabledOpen}
                        <div class="pack-select-menu">
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerEnabled('1')}>1</button>
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerEnabled('0')}>0</button>
                        </div>
                      {/if}
                    </div>
                    <span class="field-label">mode</span>
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneGroupLayerModeOpen = !kitsuneGroupLayerModeOpen)}
                        aria-expanded={kitsuneGroupLayerModeOpen}
                      >
                        <span>{kitsuneGroupLayerMode}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneGroupLayerModeOpen}
                        <div class="pack-select-menu">
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerMode('bars')}>bars</button>
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerMode('ring')}>ring</button>
                        </div>
                      {/if}
                    </div>
                    <span class="field-label">style</span>
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneGroupLayerStyleOpen = !kitsuneGroupLayerStyleOpen)}
                        aria-expanded={kitsuneGroupLayerStyleOpen}
                      >
                        <span>{kitsuneGroupLayerStyle}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneGroupLayerStyleOpen}
                        <div class="pack-select-menu">
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerStyle('bars')}>bars</button>
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerStyle('bars_fill')}>bars_fill</button>
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerStyle('waves')}>waves</button>
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerStyle('waves_fill')}>waves_fill</button>
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerStyle('dots')}>dots</button>
                        </div>
                      {/if}
                    </div>
                    <span class="field-label">profile</span>
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneGroupLayerProfileOpen = !kitsuneGroupLayerProfileOpen)}
                        aria-expanded={kitsuneGroupLayerProfileOpen}
                      >
                        <span>{kitsuneGroupLayerProfile}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneGroupLayerProfileOpen}
                        <div class="pack-select-menu">
                          <input
                            class="pack-filter"
                            placeholder="filter profiles..."
                            value={kitsuneGroupLayerProfileFilter}
                            on:click|stopPropagation
                            on:input={onKitsuneGroupLayerProfileFilterInput}
                          />
                          {#if kitsuneVisibleGroupLayerProfiles.length === 0}
                            <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerProfile(kitsuneGroupLayerProfile)}>
                              {kitsuneGroupLayerProfile}
                            </button>
                          {:else}
                            {#each kitsuneVisibleGroupLayerProfiles as profileName}
                              <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneGroupLayerProfile(profileName)}>
                                {profileName}
                              </button>
                            {/each}
                          {/if}
                        </div>
                      {/if}
                    </div>
                    <span class="field-label">color</span>
                    <input bind:value={kitsuneGroupLayerColor} placeholder="#RRGGBB" />
                    <span class="field-label">alpha</span>
                    <input type="number" step="0.01" min="0" max="1" bind:value={kitsuneGroupLayerAlpha} />
                    <button class="secondary" on:click={() => runKitsuneCommand(['group', 'update-layer', String(Math.max(1, Math.floor(Number(kitsuneGroupLayerIndex) || 1))), buildKitsuneGroupLayerSpec(), kitsuneGroupFile.trim()])} disabled={kitsuneBusy || !kitsuneGroupFile.trim()}>Update Layer</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['group', 'remove-layer', String(Math.max(1, Math.floor(Number(kitsuneGroupLayerIndex) || 1))), kitsuneGroupFile.trim()])} disabled={kitsuneBusy || !kitsuneGroupFile.trim()}>Remove Layer</button>
                  </div>
                  <div class="group-layers-section">
                    <h4>Layers in {kitsuneGroupFile || '-'}</h4>
                    {#if kitsuneGroupLayersBusy}
                      <p class="muted">Loading layers...</p>
                    {:else if kitsuneGroupLayers.length === 0}
                      <p class="muted">No layers found in this group file.</p>
                    {:else}
                      <div class="group-layers-list">
                        {#each kitsuneGroupLayers as layer}
                          <div class="group-layer-item">
                            <div class="row">
                              <span class="badge">Layer #{layer.index}</span>
                              <span class="badge">enabled: {layer.enabled || '-'}</span>
                              <span class="badge">mode: {layer.mode || '-'}</span>
                              <span class="badge">style: {layer.style || '-'}</span>
                              <span class="badge">profile: {layer.profile || '-'}</span>
                              <span class="badge">color: {layer.color || '-'}</span>
                              <span class="badge">alpha: {layer.alpha || '-'}</span>
                              {#if layer.runtime}<span class="badge">runtime: {layer.runtime}</span>{/if}
                              {#if layer.rotate}<span class="badge">rotate: {layer.rotate}</span>{/if}
                              {#if layer.profilesPipe}<span class="badge">profiles: {layer.profilesPipe}</span>{/if}
                            </div>
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>
            {/if}

            {#if kitsuneTab === 'visual'}
              <div class="grid kitsune-grid">
                <div class="card">
                  <h3>Visual Controls</h3>
                  <div class="row">
                    <select bind:value={kitsuneVisualMode}><option value="bars">bars</option><option value="ring">ring</option></select>
                    <select bind:value={kitsuneVisualStyle}>
                      <option value="bars">bars</option>
                      <option value="bars_fill">bars_fill</option>
                      <option value="waves">waves</option>
                      <option value="waves_fill">waves_fill</option>
                      <option value="dots">dots</option>
                    </select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['visual', kitsuneVisualMode, kitsuneVisualStyle])} disabled={kitsuneBusy}>Apply Visual</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['style', kitsuneVisualMode, kitsuneVisualStyle])} disabled={kitsuneBusy}>Apply Style</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['mode', kitsuneVisualMode])} disabled={kitsuneBusy}>Apply Mode</button>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['particles-preset', kitsuneParticlesPreset])} disabled={kitsuneBusy}>Particles Preset</button>
                    <select bind:value={kitsuneParticlesPreset}>
                      <option value="off">off</option>
                      <option value="low">low</option>
                      <option value="balanced">balanced</option>
                      <option value="high">high</option>
                    </select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['debug', 'overlay', '1', '--apply'])} disabled={kitsuneBusy}>Overlay On</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['debug', 'overlay', '0', '--apply'])} disabled={kitsuneBusy}>Overlay Off</button>
                  </div>
                </div>
                <div class="card">
                  <h3>PostFX</h3>
                  <div class="row">
                    <span class="field-label">enable</span>
                    <input type="number" bind:value={kitsunePostfxEnable} min="0" max="1" />
                    <span class="field-label">blur passes</span>
                    <input type="number" bind:value={kitsunePostfxBlurPasses} min="0" max="4" />
                    <span class="field-label">blur mix</span>
                    <input type="number" step="0.01" bind:value={kitsunePostfxBlurMix} />
                    <span class="field-label">glow strength</span>
                    <input type="number" step="0.01" bind:value={kitsunePostfxGlowStrength} />
                    <span class="field-label">glow mix</span>
                    <input type="number" step="0.01" bind:value={kitsunePostfxGlowMix} />
                    <span class="field-label">scope</span>
                    <select bind:value={kitsunePostfxScope}><option value="final">final</option><option value="layer">layer</option><option value="mixed">mixed</option></select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['postfx', String(kitsunePostfxEnable), String(kitsunePostfxBlurPasses), String(kitsunePostfxBlurMix), String(kitsunePostfxGlowStrength), String(kitsunePostfxGlowMix), kitsunePostfxScope])} disabled={kitsuneBusy}>Apply PostFX</button>
                  </div>
                </div>
              </div>
            {/if}

            {#if kitsuneTab === 'render'}
              <div class="grid kitsune-grid">
                <div class="card">
                  <h3>Render & Runtime</h3>
                  <div class="row">
                    <select bind:value={kitsuneBackend}><option value="cpu">cpu</option><option value="gpu">gpu</option></select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['backend', kitsuneBackend])} disabled={kitsuneBusy}>Set Backend</button>
                    <select bind:value={kitsuneOutputTarget}><option value="mpvpaper">mpvpaper</option><option value="layer-shell">layer-shell</option></select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['output-target', kitsuneOutputTarget])} disabled={kitsuneBusy}>Set Output Target</button>
                  </div>
                  <div class="row">
                    <select bind:value={kitsuneSpectrumMode}><option value="single">single</option><option value="group">group</option></select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['spectrum-mode', kitsuneSpectrumMode])} disabled={kitsuneBusy}>Set Spectrum Mode</button>
                    <select bind:value={kitsuneRuntime}><option value="standard">standard</option><option value="test">test</option></select>
                    <button class="secondary" on:click={() => runKitsuneCommand(['runtime', kitsuneRuntime])} disabled={kitsuneBusy}>Set Runtime</button>
                  </div>
                </div>
              </div>
            {/if}

            {#if kitsuneTab === 'monitors'}
              <div class="grid kitsune-grid">
                <div class="card">
                  <h3>Monitors</h3>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['monitors', 'list'])} disabled={kitsuneBusy}>List Monitors</button>
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneMonitorNameOpen = !kitsuneMonitorNameOpen)}
                        aria-expanded={kitsuneMonitorNameOpen}
                      >
                        <span>{kitsuneMonitorName || 'monitor name'}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneMonitorNameOpen}
                        <div class="pack-select-menu">
                          <input
                            class="pack-filter"
                            placeholder="filter monitors..."
                            value={kitsuneMonitorNameFilter}
                            on:click|stopPropagation
                            on:input={onKitsuneMonitorNameFilterInput}
                          />
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneMonitorName('')}>monitor name</button>
                          {#each kitsuneVisibleMonitorNameOptions as monitorName}
                            <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneMonitorName(monitorName)}>
                              {monitorName}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <button class="secondary" on:click={() => runKitsuneCommand(['monitor', 'set', kitsuneMonitorName.trim()])} disabled={kitsuneBusy || !kitsuneMonitorName.trim()}>Set Monitor</button>
                  </div>
                  <div class="row">
                    <input type="number" bind:value={kitsuneMonitorFallbackEnabled} min="0" max="1" />
                    <input type="number" bind:value={kitsuneMonitorFallbackSeconds} min="1" />
                    <input type="number" bind:value={kitsuneMonitorFallbackPreferFocused} min="0" max="1" />
                    <button class="secondary" on:click={() => runKitsuneCommand(['monitor-fallback', String(kitsuneMonitorFallbackEnabled), String(Math.max(1, Math.floor(Number(kitsuneMonitorFallbackSeconds) || 1))), String(kitsuneMonitorFallbackPreferFocused)])} disabled={kitsuneBusy}>Apply Fallback</button>
                  </div>
                </div>
                <div class="card">
                  <h3>Dynamic Color</h3>
                  <div class="row">
                    <input type="number" bind:value={kitsuneDynamicColor} min="0" max="1" />
                    <button class="secondary" on:click={() => runKitsuneCommand(['dynamic-color', String(kitsuneDynamicColor)])} disabled={kitsuneBusy}>Set Dynamic Color</button>
                    <input type="number" bind:value={kitsuneColorPollSeconds} min="1" />
                    <button class="secondary" on:click={() => runKitsuneCommand(['color-poll', String(Math.max(1, Math.floor(Number(kitsuneColorPollSeconds) || 1)))])} disabled={kitsuneBusy}>Set Color Poll</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['colorwatch', ...(kitsuneMonitorName.trim() ? [kitsuneMonitorName.trim()] : []), '--once'])} disabled={kitsuneBusy}>Run Colorwatch Once</button>
                  </div>
                </div>
              </div>
            {/if}

            {#if kitsuneTab === 'system'}
              <div class="grid kitsune-grid">
                <div class="card">
                  <h3>Instances</h3>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['instances', 'list'])} disabled={kitsuneBusy}>List Instances</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['status', '--all-instances'])} disabled={kitsuneBusy}>Status All</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['doctor', '--all-instances'])} disabled={kitsuneBusy}>Doctor All</button>
                  </div>
                  <div class="row">
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneInstanceMonitorOpen = !kitsuneInstanceMonitorOpen)}
                        aria-expanded={kitsuneInstanceMonitorOpen}
                      >
                        <span>{kitsuneInstanceMonitor || 'monitor instance'}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneInstanceMonitorOpen}
                        <div class="pack-select-menu">
                          <input
                            class="pack-filter"
                            placeholder="filter monitors..."
                            value={kitsuneInstanceMonitorFilter}
                            on:click|stopPropagation
                            on:input={onKitsuneInstanceMonitorFilterInput}
                          />
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneInstanceMonitor('')}>monitor instance</button>
                          {#each kitsuneVisibleInstanceMonitorOptions as monitorName}
                            <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneInstanceMonitor(monitorName)}>
                              {monitorName}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <button class="secondary" on:click={() => runKitsuneCommand(['instances', 'status', kitsuneInstanceMonitor.trim()])} disabled={kitsuneBusy || !kitsuneInstanceMonitor.trim()}>Instance Status</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['instance-status', kitsuneInstanceMonitor.trim()])} disabled={kitsuneBusy || !kitsuneInstanceMonitor.trim()}>Instance Status (alias)</button>
                  </div>
                </div>
                <div class="card">
                  <h3>System</h3>
                  <div class="row">
                    <div class="pack-select">
                      <button
                        type="button"
                        class="pack-select-trigger"
                        on:click|stopPropagation={() => (kitsuneAutostartMonitorOpen = !kitsuneAutostartMonitorOpen)}
                        aria-expanded={kitsuneAutostartMonitorOpen}
                      >
                        <span>{kitsuneAutostartMonitor || 'monitor (optional)'}</span>
                        <span class="caret">▾</span>
                      </button>
                      {#if kitsuneAutostartMonitorOpen}
                        <div class="pack-select-menu">
                          <input
                            class="pack-filter"
                            placeholder="filter monitors..."
                            value={kitsuneAutostartMonitorFilter}
                            on:click|stopPropagation
                            on:input={onKitsuneAutostartMonitorFilterInput}
                          />
                          <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneAutostartMonitor('')}>monitor (optional)</button>
                          {#each kitsuneVisibleAutostartMonitorOptions as monitorName}
                            <button type="button" class="pack-option" on:click|stopPropagation={() => chooseKitsuneAutostartMonitor(monitorName)}>
                              {monitorName}
                            </button>
                          {/each}
                        </div>
                      {/if}
                    </div>
                    <button class="secondary" on:click={() => runKitsuneCommand(['autostart', 'enable', ...(kitsuneAutostartMonitor.trim() ? ['--monitor', kitsuneAutostartMonitor.trim()] : [])])} disabled={kitsuneBusy || isLiveServicesLocked()}>Autostart Enable</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['autostart', 'disable', ...(kitsuneAutostartMonitor.trim() ? ['--monitor', kitsuneAutostartMonitor.trim()] : [])])} disabled={kitsuneBusy || isLiveServicesLocked()}>Autostart Disable</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['autostart', 'status', ...(kitsuneAutostartMonitor.trim() ? ['--monitor', kitsuneAutostartMonitor.trim()] : [])])} disabled={kitsuneBusy}>Autostart Status</button>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['autostart', 'list'])} disabled={kitsuneBusy}>Autostart List</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['clean', '--force'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Clean --force</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['reset', '--restart'])} disabled={kitsuneBusy || isLiveServicesLocked()}>Reset --restart</button>
                    <input type="number" bind:value={kitsuneBenchmarkSeconds} min="1" />
                    <button class="secondary" on:click={() => runKitsuneCommand(['benchmark', String(Math.max(1, Math.floor(Number(kitsuneBenchmarkSeconds) || 1)))])} disabled={kitsuneBusy || isLiveServicesLocked()}>Benchmark</button>
                  </div>
                </div>
              </div>
            {/if}

            {#if kitsuneTab === 'logs'}
              <div class="grid kitsune-grid">
                <div class="card">
                  <h3>Logs & Diagnostics</h3>
                  <div class="row">
                    <select bind:value={kitsuneLogSource}>
                      <option value="all">all</option>
                      <option value="renderer">renderer</option>
                      <option value="cava">cava</option>
                      <option value="layer">layer</option>
                      <option value="mpvpaper">mpvpaper</option>
                      <option value="colorwatch">colorwatch</option>
                      <option value="monitorwatch">monitorwatch</option>
                    </select>
                    <input type="number" bind:value={kitsuneLogLines} min="1" />
                    <label class="inline-check"><input type="checkbox" bind:checked={kitsuneLogAllInstances} /> all instances</label>
                    <label class="inline-check"><input type="checkbox" bind:checked={kitsuneLogFollow} /> follow</label>
                    <button class="secondary" on:click={() => {
                      const args = ['logs', kitsuneLogSource, '--lines', String(Math.max(1, Math.floor(Number(kitsuneLogLines) || 1)))];
                      if (kitsuneLogAllInstances) args.push('--all-instances');
                      if (kitsuneLogFollow) args.push('-f');
                      void runKitsuneCommand(args);
                    }} disabled={kitsuneBusy}>View Logs</button>
                  </div>
                  <div class="row">
                    <button class="secondary" on:click={() => runKitsuneCommand(['layer-status'])} disabled={kitsuneBusy}>Layer Status</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['status'])} disabled={kitsuneBusy}>Status</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['doctor'])} disabled={kitsuneBusy}>Doctor</button>
                    <button class="secondary" on:click={() => runKitsuneCommand(['doctor', '--fix'])} disabled={kitsuneBusy}>Doctor --fix</button>
                  </div>
                </div>
              </div>
            {/if}

            <div class="card kitsune-console">
              <h3>{tr('Command Output', 'Salida de Comando')}</h3>
              <div class="row">
                <span class="badge">{tr('last command', 'ultimo comando')}: {kitsuneLastCommand || '-'}</span>
              </div>
              <pre class="kitsune-output">{kitsuneOutput || tr('No command output yet.', 'Aun no hay salida de comandos.')}</pre>
            </div>
          {/if}
        {:else}
          <p class="muted">{tr('Press "Check Installation" to validate Kitsune and load options.', 'Presiona "Validar Instalacion" para validar Kitsune y cargar opciones.')}</p>
        {/if}
      </div>
    {:else if activeSection === 'kitsune-live'}
      <section class="live-module">
      <h2>LiveWallpapers</h2>
      <div class="card">
        <h3>{tr('Runtime Status', 'Estado del Runtime')}</h3>
        <div class="row">
          <span class={`badge status ${liveV2Doctor?.ok ? 'ok' : 'bad'}`}>{tr('ready', 'listo')}: {liveV2Doctor?.ok ? 'true' : 'false'}</span>
          <span class="badge">bin: {liveV2RunnerBin || 'kitsune-livewallpaper'}</span>
        </div>
        <div class="row actions-buttons-row">
          <button class="secondary" on:click={loadLiveV2Doctor} disabled={liveV2Busy}>{tr('Check Status', 'Validar Estado')}</button>
          <button class="secondary" on:click={installLiveV2Dependencies} disabled={liveV2Busy}>{tr('Install Dependencies', 'Instalar Dependencias')}</button>
        </div>
        {#if liveV2Doctor}
          <div class="row">
            {#each Object.entries(liveV2Doctor.deps || {}) as [dep, ok]}
              <span class={`badge status ${ok ? 'ok' : 'bad'}`}>{dep}: {ok ? 'ok' : 'missing'}</span>
            {/each}
          </div>
        {/if}
        {#if liveV2Doctor && (liveV2Doctor.fix?.length ?? 0) > 0}
          <div class="banner warn">
            {#each liveV2Doctor.fix as line}
              <div>{line}</div>
            {/each}
          </div>
        {/if}
      </div>
      <div class="card">
        <div class="row actions-buttons-row">
          <button class={`secondary ${liveV2Tab === 'library' ? 'active' : ''}`} on:click={() => selectLiveV2Tab('library')}>{tr('Library', 'Biblioteca')}</button>
          <button class={`secondary ${liveV2Tab === 'explore' ? 'active' : ''}`} on:click={() => selectLiveV2Tab('explore')}>{tr('Explore', 'Explorar')}</button>
          <button class={`secondary ${liveV2Tab === 'config' ? 'active' : ''}`} on:click={() => selectLiveV2Tab('config')}>{tr('Config', 'Configuracion')}</button>
          <button class="secondary" on:click={initLiveV2} disabled={liveV2Busy}>{tr('Refresh', 'Actualizar')}</button>
          <button class="secondary" on:click={() => openLiveV2Folder()} disabled={liveV2Busy}>{tr('Open Root', 'Abrir Raiz')}</button>
        </div>
      </div>

      {#if liveV2Tab === 'library'}
        <div class="card">
          <h3>{tr('LiveWallpapers — Library', 'LiveWallpapers — Biblioteca')}</h3>
          <div class="row actions-input-row">
            <label for="livev2-library-monitor">{tr('Monitor', 'Monitor')}</label>
            <select id="livev2-library-monitor" bind:value={liveV2Monitor}>
              {#if liveMonitorOptions().length === 0}
                <option value="">{tr('no outputs', 'sin salidas')}</option>
              {:else}
                {#each liveMonitorOptions() as mon}
                  <option value={mon}>{mon}</option>
                {/each}
              {/if}
            </select>
            <label for="livev2-library-quality">{tr('Quality', 'Calidad')}</label>
            <select id="livev2-library-quality" bind:value={liveV2Quality}>
              <option value="auto">auto</option>
              <option value="hd">hd</option>
              <option value="4k">4k</option>
            </select>
            <label class="inline-check"><input type="checkbox" bind:checked={liveV2FavoritesOnly} on:change={() => loadLiveV2Library()} /> {tr('favorites only', 'solo favoritos')}</label>
            <button class="secondary" on:click={loadLiveV2Library} disabled={liveV2Busy}>{tr('Refresh Library', 'Actualizar Biblioteca')}</button>
          </div>
          <div class="row">
            <span class="badge">items: {liveV2Items.length}</span>
          </div>
          {#if liveV2Items.length === 0}
            <p class="muted">{tr('No downloaded live wallpapers yet.', 'Aun no hay live wallpapers descargados.')}</p>
          {:else}
            <div class="live-grid live-downloaded-grid">
              {#each liveV2Items as item (item.id)}
                <article class="live-card live-downloaded-card">
                  <div
                    class="live-media-button"
                    role="button"
                    tabindex="0"
                    on:click={() => openLiveV2LibraryDetails(item)}
                    on:keydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openLiveV2LibraryDetails(item);
                      }
                    }}
                  >
                    <div class="monitor-screen-wrap">
                      <div class="monitor-screen">
                        {#if liveV2LibraryDataUrl(item.id)}
                          <img
                            class="monitor-image"
                            src={liveV2LibraryDataUrl(item.id)}
                            alt={item.title}
                            data-local-path={item.thumb_path}
                            data-fallbacks={JSON.stringify(liveV2LibraryPreviewCandidates(item))}
                            data-fallback-index="1"
                            on:error={onLiveLibraryPreviewError}
                          />
                        {:else if liveV2ThumbDataStatus[item.id] !== 'failed'}
                          <div class="live-skeleton-block" style="width:100%;height:100%;"></div>
                        {:else if liveV2LibraryPreviewSrc(item)}
                          <img
                            class="monitor-image"
                            src={liveV2LibraryPreviewSrc(item)}
                            alt={item.title}
                            data-local-path={item.thumb_path}
                            data-fallbacks={JSON.stringify(liveV2LibraryPreviewCandidates(item))}
                            data-fallback-index="1"
                            on:error={onLiveLibraryPreviewError}
                          />
                        {:else}
                          <div class="monitor-placeholder">No preview</div>
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="live-meta">
                    <div class="live-title" title={item.title}>{item.title}</div>
                    <div class="row">
                      <span class="badge">{item.provider}</span>
                      <span class="badge">{item.variant.toUpperCase()}</span>
                      <span class="badge">{item.id}</span>
                    </div>
                    <div class="row"><button class="secondary" on:click={() => openLiveV2LibraryDetails(item)} disabled={liveV2Busy}>{tr('Details', 'Detalles')}</button></div>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>
        {#if liveV2LibrarySideOpen && liveV2SelectedLibrary}
          <aside class="live-sidepanel">
            <div class="row">
              <h3>{liveV2SelectedLibrary.title}</h3>
              <button class="secondary" on:click={closeLiveV2LibraryDetails}>{tr('Close', 'Cerrar')}</button>
            </div>
            <div class="live-monitor-skeleton">
              <div class="live-monitor-screen">
                {#if liveV2LibraryDataUrl(liveV2SelectedLibrary.id)}
                  <img
                    class="live-monitor-media"
                    src={liveV2LibraryDataUrl(liveV2SelectedLibrary.id)}
                    alt={liveV2SelectedLibrary.title}
                    data-local-path={liveV2SelectedLibrary.thumb_path}
                    data-fallbacks={JSON.stringify(liveV2LibraryPreviewCandidates(liveV2SelectedLibrary))}
                    data-fallback-index="1"
                    on:error={onLiveLibraryPreviewError}
                  />
                {:else if liveV2ThumbDataStatus[liveV2SelectedLibrary.id] !== 'failed'}
                  <div class="live-skeleton-block" style="width:100%;height:100%;"></div>
                {:else if liveV2LibraryPreviewSrc(liveV2SelectedLibrary)}
                  <img
                    class="live-monitor-media"
                    src={liveV2LibraryPreviewSrc(liveV2SelectedLibrary)}
                    alt={liveV2SelectedLibrary.title}
                    data-local-path={liveV2SelectedLibrary.thumb_path}
                    data-fallbacks={JSON.stringify(liveV2LibraryPreviewCandidates(liveV2SelectedLibrary))}
                    data-fallback-index="1"
                    on:error={onLiveLibraryPreviewError}
                  />
                {:else}
                  <div class="monitor-placeholder">No preview</div>
                {/if}
              </div>
            </div>
            <div class="live-details">
              <p class="muted">
                {tr(
                  'Thanks to the source websites for sharing these wallpapers. For a better discovery experience, please visit their original pages.',
                  'Gracias a las paginas fuente por compartir estos wallpapers. Para una mejor experiencia de busqueda, visita sus paginas originales.'
                )}
              </p>
              <div class="row">
                <span
                  class="badge live-path-badge url-click"
                  role="button"
                  tabindex="0"
                  title={tr('Open source page', 'Abrir pagina fuente')}
                  on:click={() => openExternalUrl(liveV2SelectedLibrary.page_url)}
                  on:keydown={(e) => onExternalUrlKeydown(e, liveV2SelectedLibrary.page_url)}
                >{tr('Visit source page', 'Visitar pagina fuente')}</span>
              </div>
              <div class="row">
                <span class="badge">{liveV2SelectedLibrary.provider}</span>
                <span class="badge">{liveV2SelectedLibrary.variant.toUpperCase()}</span>
                <span class="badge">{liveV2SelectedLibrary.id}</span>
              </div>
              <div class="row">
                <span class="badge">{liveV2SelectedLibrary.resolution.w}x{liveV2SelectedLibrary.resolution.h}</span>
                <span class="badge">{(liveV2SelectedLibrary.size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                <span class={`badge status ${liveV2SelectedLibrary.favorite ? 'ok' : 'warn'}`}>{liveV2SelectedLibrary.favorite ? tr('favorite', 'favorito') : tr('not favorite', 'no favorito')}</span>
              </div>
              <div class="row">
                <span class="badge">{tr('Added', 'Agregado')}: {formatTimestamp(liveV2SelectedLibrary.added_at ? liveV2SelectedLibrary.added_at * 1000 : null)}</span>
                <span class="badge">{tr('Last apply', 'Ultimo apply')}: {formatTimestamp(liveV2SelectedLibrary.last_applied_at ? liveV2SelectedLibrary.last_applied_at * 1000 : null)}</span>
              </div>
              <div class="live-form-grid">
                <div class="live-field">
                  <label for="livev2-detail-monitor">{tr('Monitor', 'Monitor')}</label>
                  <select id="livev2-detail-monitor" bind:value={liveV2Monitor}>
                    {#if liveMonitorOptions().length === 0}
                      <option value="">{tr('no outputs', 'sin salidas')}</option>
                    {:else}
                      {#each liveMonitorOptions() as mon}
                        <option value={mon}>{mon}</option>
                      {/each}
                    {/if}
                  </select>
                </div>
              </div>
              <div class="row">
                <button on:click={saveSelectedLiveV2Config} disabled={liveV2Busy}>{tr('Save Config', 'Guardar Config')}</button>
                <button on:click={() => applySelectedLiveV2Wallpaper(false)} disabled={liveV2Busy}>{tr('Apply Wallpaper', 'Aplicar Wallpaper')}</button>
                {#if activeMonitorsForWallpaper(liveV2SelectedLibrary.id).length > 0 || liveV2SelectedLibrary.last_applied_at > 0}
                  <button class="secondary" on:click={() => applySelectedLiveV2Wallpaper(true)} disabled={liveV2Busy}>{tr('Update Config', 'Actualizar Config')}</button>
                {/if}
              </div>
              <div class="row">
                <button class="secondary" on:click={() => toggleFavoriteLiveV2(liveV2SelectedLibrary)} disabled={liveV2Busy}>
                  {liveV2SelectedLibrary.favorite ? tr('Unfavorite', 'Quitar Favorito') : tr('Favorite', 'Favorito')}
                </button>
                <button class="secondary danger-outline" on:click={() => removeLiveV2(liveV2SelectedLibrary)} disabled={liveV2Busy}>{tr('Delete', 'Eliminar')}</button>
                <button class="secondary" on:click={() => openLiveV2Folder(liveV2SelectedLibrary.id)} disabled={liveV2Busy}>{tr('Open Folder', 'Abrir Carpeta')}</button>
              </div>
              <div class="live-form-grid">
                <div class="live-field">
                  <label for="livev2-item-profile">profile</label>
                  <select id="livev2-item-profile" bind:value={liveV2DetailConfig.profile}>
                    <option value="performance">performance</option>
                    <option value="balanced">balanced</option>
                    <option value="quality">quality</option>
                  </select>
                </div>
                <div class="live-field">
                  <label for="livev2-item-display-fps">display_fps</label>
                  <input id="livev2-item-display-fps" type="number" min="1" bind:value={liveV2DetailConfig.display_fps} />
                </div>
                <div class="live-field">
                  <label for="livev2-item-crossfade">crossfade_s</label>
                  <input id="livev2-item-crossfade" type="number" min="0" step="0.05" bind:value={liveV2DetailConfig.loop_crossfade_seconds} />
                </div>
                <div class="live-field">
                  <label for="livev2-item-width">proxy_width</label>
                  <input id="livev2-item-width" type="number" min="320" bind:value={liveV2DetailConfig.proxy_width} />
                </div>
                <div class="live-field">
                  <label for="livev2-item-fps">proxy_fps</label>
                  <input id="livev2-item-fps" type="number" min="1" bind:value={liveV2DetailConfig.proxy_fps} />
                </div>
                <div class="live-field">
                  <label for="livev2-item-crf">proxy_crf</label>
                  <input id="livev2-item-crf" type="number" min="1" max="51" bind:value={liveV2DetailConfig.proxy_crf} />
                </div>
              </div>
              <div class="row">
                <label class="inline-check"><input type="checkbox" bind:checked={liveV2DetailConfig.keep_services} /> keep_services</label>
                <label class="inline-check"><input type="checkbox" bind:checked={liveV2DetailConfig.mute_audio} /> mute_audio</label>
                <label class="inline-check"><input type="checkbox" bind:checked={liveV2DetailConfig.seamless_loop} /> seamless_loop</label>
                <label class="inline-check"><input type="checkbox" bind:checked={liveV2DetailConfig.loop_crossfade} /> loop_crossfade</label>
                <label class="inline-check"><input type="checkbox" bind:checked={liveV2DetailConfig.optimize} /> optimize</label>
              </div>
              {#if activeMonitorsForWallpaper(liveV2SelectedLibrary.id).length > 0}
                <div class="row">
                  {#each activeMonitorsForWallpaper(liveV2SelectedLibrary.id) as mon}
                    <button class="secondary" on:click={() => stopLiveWallpaperMonitor(mon)} disabled={liveV2Busy}>{tr(`Stop ${mon}`, `Detener ${mon}`)}</button>
                  {/each}
                </div>
              {/if}
            </div>
          </aside>
        {/if}
      {:else if liveV2Tab === 'config'}
        <div class="card">
          <h3>{tr('Runner', 'Runner')}</h3>
          <div class="row actions-input-row">
            <label for="livev2-runner-bin">bin_name</label>
            <input id="livev2-runner-bin" bind:value={liveV2RunnerBin} />
            <button on:click={saveLiveV2Runner} disabled={liveV2Busy}>{tr('Save Runner', 'Guardar Runner')}</button>
          </div>
        </div>

        <div class="card">
          <h3>{tr('Apply Defaults', 'Defaults de Apply')}</h3>
          <div class="row actions-input-row">
            <label for="livev2-default-profile">profile</label>
            <select id="livev2-default-profile" bind:value={liveV2ApplyDefaults.profile}>
              <option value="performance">performance</option>
              <option value="balanced">balanced</option>
              <option value="quality">quality</option>
            </select>
            <label for="livev2-default-display-fps">display_fps</label>
            <input id="livev2-default-display-fps" type="number" min="1" bind:value={liveV2ApplyDefaults.display_fps} />
            <label for="livev2-default-width-hd">width_hd</label>
            <input id="livev2-default-width-hd" type="number" min="320" bind:value={liveV2ApplyDefaults.proxy_width_hd} />
            <label for="livev2-default-width-4k">width_4k</label>
            <input id="livev2-default-width-4k" type="number" min="320" bind:value={liveV2ApplyDefaults.proxy_width_4k} />
            <label for="livev2-default-fps">proxy_fps</label>
            <input id="livev2-default-fps" type="number" min="1" bind:value={liveV2ApplyDefaults.proxy_fps} />
            <label for="livev2-default-crf-hd">crf_hd</label>
            <input id="livev2-default-crf-hd" type="number" min="1" max="51" bind:value={liveV2ApplyDefaults.proxy_crf_hd} />
            <label for="livev2-default-crf-4k">crf_4k</label>
            <input id="livev2-default-crf-4k" type="number" min="1" max="51" bind:value={liveV2ApplyDefaults.proxy_crf_4k} />
            <label for="livev2-default-crossfade">crossfade_s</label>
            <input id="livev2-default-crossfade" type="number" min="0.05" step="0.05" bind:value={liveV2ApplyDefaults.loop_crossfade_seconds} />
          </div>
          <div class="row">
            <label class="inline-check"><input type="checkbox" bind:checked={liveV2ApplyDefaults.keep_services} /> keep_services</label>
            <label class="inline-check"><input type="checkbox" bind:checked={liveV2ApplyDefaults.mute_audio} /> mute_audio</label>
            <label class="inline-check"><input type="checkbox" bind:checked={liveV2ApplyDefaults.seamless_loop} /> seamless_loop</label>
            <label class="inline-check"><input type="checkbox" bind:checked={liveV2ApplyDefaults.loop_crossfade} /> loop_crossfade</label>
            <label class="inline-check"><input type="checkbox" bind:checked={liveV2ApplyDefaults.optimize} /> optimize</label>
            <button on:click={saveLiveV2ApplyDefaults} disabled={liveV2Busy}>{tr('Save Defaults', 'Guardar Defaults')}</button>
          </div>
        </div>

      {:else}
        <div class="card">
          <h3>{tr('LiveWallpapers — Explore', 'LiveWallpapers — Explorar')}</h3>
          <div class="row actions-input-row">
            <label for="livev2-explore-provider">{tr('Provider', 'Provider')}</label>
            <select id="livev2-explore-provider" bind:value={liveV2Provider}>
              <option value="all">all</option>
              <option value="moewalls">moewalls</option>
              <option value="motionbgs">motionbgs</option>
            </select>
            <label for="livev2-explore-page">page</label>
            <input id="livev2-explore-page" type="number" min="1" bind:value={liveV2Page} />
            <label for="livev2-explore-search">{tr('Search', 'Buscar')}</label>
            <input id="livev2-explore-search" bind:value={liveV2Query} placeholder={tr('query', 'consulta')} />
            <button class="secondary" on:click={browseLiveV2} disabled={liveV2ExploreLoading || liveV2Busy}>{tr('Browse', 'Explorar')}</button>
            <button class="secondary" on:click={searchLiveV2} disabled={liveV2ExploreLoading || liveV2Busy}>{tr('Search', 'Buscar')}</button>
          </div>
          {#if liveV2ExploreLoading}
            <div class="live-grid live-downloaded-grid">
              {#each Array(8) as _, i}
                <article class="live-card live-downloaded-card live-skeleton-card" aria-hidden="true">
                  <div class="monitor-screen-wrap">
                    <div class="monitor-screen live-skeleton-block"></div>
                  </div>
                  <div class="live-meta">
                    <div class="live-skeleton-line w70"></div>
                    <div class="live-skeleton-line w40"></div>
                    <div class="live-skeleton-line w90"></div>
                    <div class="live-skeleton-line w55"></div>
                  </div>
                </article>
              {/each}
            </div>
          {:else if liveV2BrowseItems.length > 0}
            <div class="live-grid live-downloaded-grid">
              {#each liveV2BrowseItems as item}
                <article class="live-card live-downloaded-card">
                  <div
                    class="live-media-button"
                    role="button"
                    tabindex="0"
                    on:click={() => openLiveV2Browse(item)}
                    on:keydown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        void openLiveV2Browse(item);
                      }
                    }}
                  >
                    <div class="monitor-screen-wrap">
                      <div class="monitor-screen">
                        {#if item.thumb_remote}
                          <img class="monitor-image" src={item.thumb_remote} alt={item.title} referrerpolicy="no-referrer" loading="lazy" />
                        {:else}
                          <div class="monitor-placeholder">{tr('No preview', 'Sin preview')}</div>
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="live-meta">
                    <div class="live-title" title={item.title}>{item.title}</div>
                    <div class="row">
                      <span class="badge">{item.provider}</span>
                      <span class={`badge status ${item.has_hd ? 'ok' : 'warn'}`}>HD</span>
                      <span class={`badge status ${item.has_4k ? 'ok' : 'warn'}`}>4K</span>
                    </div>
                    {#if (item.tags?.length ?? 0) > 0}
                      <div class="row">
                        {#each (item.tags ?? []).slice(0, 4) as tag}
                          <span class="badge">{tag}</span>
                        {/each}
                      </div>
                    {/if}
                    <div class="row">
                      <span
                        class="badge live-path-badge url-click"
                        role="button"
                        tabindex="0"
                        title={tr('Open in browser', 'Abrir en navegador')}
                        on:click={() => openExternalUrl(item.page_url)}
                        on:keydown={(e) => onExternalUrlKeydown(e, item.page_url)}
                      >{item.page_url}</span>
                    </div>
                    <div class="row">
                      <button class="secondary" on:click={() => openLiveV2Browse(item)} disabled={liveV2Busy}>{tr('Details', 'Detalles')}</button>
                      <button class="secondary" on:click={() => (liveV2SelectedUrl = item.page_url)} disabled={liveV2Busy}>{tr('Use URL', 'Usar URL')}</button>
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          {:else}
            <p class="muted">{tr('No results yet. Use Browse or Search.', 'Aun no hay resultados. Usa Explorar o Buscar.')}</p>
          {/if}
        </div>
        {#if liveV2SideOpen && liveV2SelectedBrowse}
          <aside class="live-sidepanel">
            <div class="row">
              <h3>{liveV2SelectedBrowse.title}</h3>
              <button class="secondary" on:click={closeLiveV2SidePanel}>{tr('Close', 'Cerrar')}</button>
            </div>
            <div class="live-monitor-skeleton">
              <div class="live-monitor-screen">
                {#if liveV2PreviewEngine === 'native'}
                  <div class="live-preview-fallback">
                    {#if liveV2SelectedBrowse.thumb_remote}
                      <img class="live-monitor-media" src={liveV2SelectedBrowse.thumb_remote} alt={liveV2SelectedBrowse.title} referrerpolicy="no-referrer" />
                    {:else}
                      <div class="monitor-placeholder">{tr('Native preview mode', 'Modo preview nativo')}</div>
                    {/if}
                    <div class="live-preview-loading">
                      <span class="live-preview-spinner" aria-hidden="true"></span>
                      <span>{liveV2NativePreviewActive ? tr('Playing in native player (mpv)', 'Reproduciendo en reproductor nativo (mpv)') : tr('Starting native player (mpv)...', 'Iniciando reproductor nativo (mpv)...')}</span>
                    </div>
                  </div>
                {:else if liveV2SelectedBrowse.preview_motion_local || liveV2SelectedBrowse.preview_motion_remote}
                  {#key `${liveV2SelectedBrowse.page_url}:${liveV2PreviewRenderKey}:${liveV2MotionPreviewSrc(liveV2SelectedBrowse)}`}
                    <video
                      class="live-monitor-media live-preview-video"
                      src={liveV2MotionPreviewSrc(liveV2SelectedBrowse)}
                      autoplay
                      muted
                      controls
                      playsinline
                      preload="auto"
                      poster={liveV2SelectedBrowse.thumb_remote || undefined}
                      disablepictureinpicture
                      on:loadeddata={onLiveV2PreviewLoaded}
                      on:error={onLiveV2PreviewError}
                      on:playing={(e) => onLiveV2PreviewState('playing', e)}
                      on:pause={(e) => onLiveV2PreviewState('pause', e)}
                      on:waiting={(e) => onLiveV2PreviewState('waiting', e)}
                      on:stalled={(e) => onLiveV2PreviewState('stalled', e)}
                      on:ended={onLiveV2PreviewEnded}
                    ></video>
                  {/key}
                {:else if liveV2SelectedBrowse.thumb_remote}
                  <div class="live-preview-fallback">
                    <img class="live-monitor-media" src={liveV2SelectedBrowse.thumb_remote} alt={liveV2SelectedBrowse.title} referrerpolicy="no-referrer" />
                    {#if liveV2PreviewLoading}
                      <div class="live-preview-loading">
                        <span class="live-preview-spinner" aria-hidden="true"></span>
                        <span>{tr('Loading preview...', 'Cargando preview...')}</span>
                      </div>
                    {/if}
                  </div>
                {:else}
                  <div class="monitor-placeholder">
                    {#if liveV2PreviewLoading}
                      {tr('Loading preview...', 'Cargando preview...')}
                    {:else}
                      {tr('No preview', 'Sin preview')}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            <div class="live-details">
              <p class="muted">
                {tr(
                  'Thanks to the source websites for sharing these wallpapers. For a better discovery experience, please visit their original pages.',
                  'Gracias a las paginas fuente por compartir estos wallpapers. Para una mejor experiencia de busqueda, visita sus paginas originales.'
                )}
              </p>
              <div class="row">
                <span
                  class="badge live-path-badge url-click"
                  role="button"
                  tabindex="0"
                  title={tr('Open source page', 'Abrir pagina fuente')}
                  on:click={() => openExternalUrl(liveV2SelectedBrowse.page_url)}
                  on:keydown={(e) => onExternalUrlKeydown(e, liveV2SelectedBrowse.page_url)}
                >{tr('Visit source page', 'Visitar pagina fuente')}</span>
              </div>
              <div class="row">
                <span class="badge">{liveV2SelectedBrowse.provider}</span>
                <span class={`badge status ${liveV2SelectedBrowse.has_hd ? 'ok' : 'warn'}`}>HD</span>
                <span class={`badge status ${liveV2SelectedBrowse.has_4k ? 'ok' : 'warn'}`}>4K</span>
              </div>
              {#if liveV2PreviewEngine === 'native'}
                <div class="row">
                  <button class="secondary" on:click={restartLiveV2NativePreview}>
                    {tr('Restart preview', 'Reiniciar preview')}
                  </button>
                </div>
              {/if}
              <div class="row">
                <span
                  class="badge live-path-badge url-click"
                  role="button"
                  tabindex="0"
                  title={tr('Open in browser', 'Abrir en navegador')}
                  on:click={() => openExternalUrl(liveV2SelectedBrowse.page_url)}
                  on:keydown={(e) => onExternalUrlKeydown(e, liveV2SelectedBrowse.page_url)}
                >{liveV2SelectedBrowse.page_url}</span>
              </div>
              {#if (liveV2SelectedBrowse.tags?.length ?? 0) > 0}
                <div class="row">
                  {#each liveV2SelectedBrowse.tags ?? [] as tag}
                    <span class="badge">{tag}</span>
                  {/each}
                </div>
              {/if}
              <div class="row">
                <button class="secondary" on:click={() => (liveV2SelectedUrl = liveV2SelectedBrowse?.page_url ?? '')} disabled={liveV2Busy}>{tr('Use URL', 'Usar URL')}</button>
                {#if liveV2SelectedBrowse.provider === 'motionbgs'}
                  <button on:click={() => fetchLiveV2(liveV2SelectedBrowse?.page_url ?? '', false, 'hd')} disabled={liveV2Busy || !liveV2SelectedBrowse.has_hd}>{tr('Download HD', 'Descargar HD')}</button>
                  <button on:click={() => fetchLiveV2(liveV2SelectedBrowse?.page_url ?? '', false, '4k')} disabled={liveV2Busy || !liveV2SelectedBrowse.has_4k}>{tr('Download 4K', 'Descargar 4K')}</button>
                {:else}
                  <button on:click={() => fetchLiveV2(liveV2SelectedBrowse?.page_url ?? '', false)} disabled={liveV2Busy}>{tr('Download', 'Descargar')}</button>
                {/if}
              </div>
              {#if liveV2PreviewDebugLines.length > 0}
                <pre class="live-preview-debug">{liveV2PreviewDebugLines.join('\n')}</pre>
              {/if}
            </div>
          </aside>
        {/if}
      {/if}
      {#if false}
      <div class="card">
        <div class="row actions-buttons-row">
          <button class={`secondary ${liveView === 'general' ? 'active' : ''}`} on:click={() => (liveView = 'general')} disabled={liveBusy}>{tr('General', 'General')}</button>
          <button class={`secondary ${liveView === 'downloaded' ? 'active' : ''}`} on:click={() => (liveView = 'downloaded')} disabled={liveBusy}>{tr('Downloaded', 'Descargados')}</button>
        </div>
      </div>

      {#if liveView === 'general'}
        <div class="card">
          <h3>{tr('Config', 'Configuracion')}</h3>
          <div class="row actions-input-row">
            <label for="live-steam-api-key">steam_web_api_key</label>
            {#if liveSteamApiKeyVisible}
              <input
                id="live-steam-api-key"
                type="text"
                bind:value={liveSteamApiKey}
                on:input={onLiveApiKeyInput}
                placeholder={tr('Enter your Steam Web API Key', 'Ingresa tu Steam Web API Key')}
              />
            {:else}
              <input
                id="live-steam-api-key"
                type="password"
                bind:value={liveSteamApiKey}
                on:input={onLiveApiKeyInput}
                placeholder={tr('Enter your Steam Web API Key', 'Ingresa tu Steam Web API Key')}
              />
            {/if}
            <button class="secondary" on:click={() => (liveSteamApiKeyVisible = !liveSteamApiKeyVisible)} disabled={liveBusy}>
              {liveSteamApiKeyVisible ? tr('Hide', 'Ocultar') : tr('Show', 'Mostrar')}
            </button>
            <button on:click={saveLiveApiKey} disabled={liveBusy}>{tr('Save', 'Guardar')}</button>
          </div>
          <div class="row">
            <span class={`badge status ${liveSteamApiKeySaved ? 'ok' : 'warn'}`}>
              {liveSteamApiKeySaved ? tr('key saved', 'key guardada') : tr('key pending', 'key pendiente')}
            </span>
            {#if liveSteamApiKeySavedAt}
              <span class="badge">saved: {formatTimestamp(liveSteamApiKeySavedAt)}</span>
            {/if}
          </div>
        </div>

        <div class="card">
          <div class="row actions-buttons-row">
            <button class="secondary" on:click={loadLiveDepsStatus} disabled={liveDepsBusy}>{tr('Check Dependencies', 'Validar Dependencias')}</button>
            <button class="secondary" on:click={installLiveDeps} disabled={liveDepsBusy}>{tr('Install Dependencies', 'Instalar Dependencias')}</button>
            <button class="secondary" on:click={printLiveDepsInstallCommand} disabled={liveDepsBusy}>{tr('Show Manual Install', 'Ver Instalacion Manual')}</button>
          </div>
          {#if liveDepsManualCommand}
            <div class="banner warn">
              <span>{tr('Run this command in your terminal:', 'Ejecuta este comando en tu terminal:')}</span>
              <code>{liveDepsManualCommand}</code>
              <div class="row">
                <button class="secondary" on:click={copyLiveDepsManualCommand} disabled={liveDepsBusy}>{tr('Copy Command', 'Copiar Comando')}</button>
              </div>
            </div>
          {/if}
          {#if liveDepsStatus}
            <div class="row">
              <span class={`badge status ${liveDepsStatus.ok ? 'ok' : 'bad'}`}>ready: {liveDepsStatus.ok ? 'true' : 'false'}</span>
              <span class="badge">required: {liveDepsStatus.required.length}</span>
              <span class="badge">missing: {liveDepsStatus.missing.length}</span>
            </div>
            {#if !liveDepsStatus.ok}
              <div class="banner error">
                {tr('Missing dependencies for live wallpapers. Install with the button above, or manually:', 'Faltan dependencias para live wallpapers. Instala con el boton de arriba o manualmente:')}
                <code>{liveDepsStatus.install ?? 'sudo pacman -S --needed steamcmd'}</code>
              </div>
            {/if}
            <div class="row">
              {#each Object.entries(liveDepsStatus.deps) as [dep, ok]}
                <span class={`badge status ${ok ? 'ok' : 'bad'}`}>{dep}: {ok ? 'ok' : 'missing'}</span>
              {/each}
            </div>
          {/if}
        </div>

        <div class="card">
          <p class="muted">
            {tr(
              'Kitowall detects local Steam/Wallpaper Engine downloads automatically. If nothing is found, add your Steam path manually and run sync.',
              'Kitowall detecta automaticamente las descargas locales de Steam/Wallpaper Engine. Si no encuentra nada, agrega manualmente la ruta de Steam y sincroniza.'
            )}
          </p>
          <div class="row">
            <span class={`badge status ${liveAppStatus?.installed ? 'ok' : 'bad'}`}>
              wallpaper engine: {liveAppStatus?.installed ? 'installed' : 'missing'}
            </span>
          </div>
          {#if liveAppStatus && !liveAppStatus.installed}
            <div class="banner error">
              {tr(
                'Wallpaper Engine must be installed in Steam to sync wallpapers.',
                'Wallpaper Engine debe estar instalado en Steam para poder sincronizar wallpapers.'
              )}
            </div>
          {/if}
          <div class="row">
            <button class="secondary" on:click={scanLiveSteam} disabled={liveBusy}>{tr('Detect Steam Paths', 'Detectar rutas Steam')}</button>
            <button class="secondary" on:click={syncLiveSteam} disabled={liveBusy || (liveAppStatus ? !liveAppStatus.installed : false)}>{tr('Sync Downloads', 'Sincronizar Descargas')}</button>
            <span class="badge">sources: {liveSteamDetectedSources.length}</span>
            <span class="badge">detected items: {liveSteamDetectedCount}</span>
          </div>
          <div class="row">
            {#each liveSteamDetectedSources as source}
              <span class="badge">{source}</span>
            {/each}
          </div>
          <div class="row actions-input-row">
            <label for="live-steam-root-manual">{tr('Manual Steam Path', 'Ruta Steam Manual')}</label>
            <input
              id="live-steam-root-manual"
              bind:value={liveSteamManualRoot}
              placeholder={tr('/path/to/Steam or .../workshop/content/431960', '/ruta/a/Steam o .../workshop/content/431960')}
            />
            <button class="secondary" on:click={pickLiveSteamRoot} disabled={liveBusy}>{tr('Pick Folder', 'Elegir Carpeta')}</button>
            <button on:click={addLiveSteamRootManual} disabled={liveBusy}>{tr('Add Path', 'Agregar Ruta')}</button>
          </div>
          <div class="row">
            <span class="badge">manual paths: {liveSteamRoots.length}</span>
          </div>
          {#if liveSteamRoots.length > 0}
            <div class="row">
              {#each liveSteamRoots as steamPath}
                <span class="badge">{steamPath}</span>
                <button class="secondary" on:click={() => removeLiveSteamRoot(steamPath)} disabled={liveBusy}>{tr('Remove', 'Quitar')}</button>
              {/each}
            </div>
          {/if}
        </div>
      {:else}
        <div class="card">
          <p class="muted">
            {tr(
              'The system will automatically detect wallpapers already downloaded from Wallpaper Engine. Use Sync Downloads to import them.',
              'El sistema detectara automaticamente los wallpapers que hayas descargado desde Wallpaper Engine. Usa Sincronizar Descargas para importarlos.'
            )}
          </p>
          {#if liveAppStatus && !liveAppStatus.installed}
            <div class="banner error">
              {tr(
                'Wallpaper Engine must be installed in Steam to sync wallpapers.',
                'Wallpaper Engine debe estar instalado en Steam para poder sincronizar wallpapers.'
              )}
            </div>
          {/if}
          <div class="row actions-input-row">
            <label for="live-filter-type">{tr('Type', 'Tipo')}</label>
            <select id="live-filter-type" bind:value={liveFilterType}>
              <option value="all">all</option>
              <option value="video">video</option>
              <option value="scene">scene</option>
              <option value="web">web</option>
              <option value="application">application</option>
              <option value="unknown">unknown</option>
            </select>
            <label for="live-filter-audio">{tr('Audio', 'Audio')}</label>
            <select id="live-filter-audio" bind:value={liveFilterAudio}>
              <option value="all">all</option>
              <option value="reactive">reactive</option>
              <option value="static">static</option>
            </select>
            <label for="live-filter-query">{tr('Search', 'Buscar')}</label>
            <input id="live-filter-query" bind:value={liveFilterQuery} placeholder={tr('id, title or path', 'id, titulo o ruta')} />
          </div>
          <div class="row actions-buttons-row">
            <label for="live-apply-monitor">{tr('Monitor', 'Monitor')}</label>
            <select id="live-apply-monitor" bind:value={liveApplyMonitor}>
              {#if liveMonitorOptions().length === 0}
                <option value="">{tr('no outputs', 'sin salidas')}</option>
              {:else}
                {#each liveMonitorOptions() as monitorName}
                  <option value={monitorName}>{monitorName}</option>
                {/each}
              {/if}
            </select>
            <button class="secondary" on:click={syncLiveSteam} disabled={liveBusy || (liveAppStatus ? !liveAppStatus.installed : false)}>{tr('Sync Downloads', 'Sincronizar Descargas')}</button>
            <button class="secondary" on:click={loadLiveLibrary} disabled={liveBusy}>{tr('Refresh Downloaded', 'Actualizar Descargados')}</button>
          </div>
          <div class="row">
            <span class="badge">root: {liveLibraryRoot || '-'}</span>
            <span class="badge">items: {liveLibraryItems.length}</span>
            <span class="badge">filtered: {filteredLiveLibraryItems().length}</span>
          </div>
          {#if filteredLiveLibraryItems().length === 0}
            <p class="muted">{tr('No downloaded live wallpapers yet.', 'Aun no hay live wallpapers descargados.')}</p>
          {:else}
            <div class="live-grid live-downloaded-grid">
              {#each filteredLiveLibraryItems() as entry (entry.id)}
                <article class="live-card live-downloaded-card">
                  <div class="monitor-screen-wrap">
                    <button class="live-media-button" on:click={() => openLiveFromLibrary(entry)}>
                      <div class="monitor-screen">
                        <img
                          class="monitor-image"
                          src={livePreviewDataUrlById[entry.id] ?? liveCandidateSrc(liveLibraryPreviewCandidates(entry)[0] ?? '')}
                          alt={entry.id}
                          data-fallbacks={JSON.stringify(liveLibraryPreviewCandidates(entry))}
                          data-fallback-index="1"
                          on:error={onLiveLibraryPreviewError}
                        />
                      </div>
                    </button>
                  </div>
                  <div class="live-meta">
                    <div class="live-title" title={entry.meta?.title ?? entry.id}>{entry.meta?.title ?? entry.id}</div>
                    <div class="row">
                      <span class="badge">{entry.id}</span>
                      <span class="badge">type: {entry.meta?.wallpaper_type ?? 'unknown'}</span>
                      <span class={`badge status ${entry.meta?.audio_reactive ? 'ok' : 'warn'}`}>
                        audio: {entry.meta?.audio_reactive ? 'reactive' : 'static'}
                      </span>
                      <span class="badge live-path-badge" title={entry.path}>{entry.path}</span>
                    </div>
                    {#if activeMonitorsForWallpaper(entry.id).length > 0}
                      <div class="row">
                        {#each activeMonitorsForWallpaper(entry.id) as mon}
                          <span class="badge status ok">active on {mon}</span>
                        {/each}
                      </div>
                    {/if}
                    <div class="row">
                      <button on:click={() => applyLiveWallpaper(entry)} disabled={liveBusy || (liveAppStatus ? !liveAppStatus.installed : false) || (entry.meta?.wallpaper_type ?? 'unknown') !== 'video'}>{tr('Apply', 'Aplicar')}</button>
                      {#if activeMonitorsForWallpaper(entry.id).length > 0}
                        {#each activeMonitorsForWallpaper(entry.id) as mon}
                          <button class="secondary" on:click={() => stopLiveWallpaperMonitor(mon)} disabled={liveBusy}>{tr(`Stop ${mon}`, `Detener ${mon}`)}</button>
                        {/each}
                      {/if}
                      <button class="secondary" on:click={() => openLiveFromLibrary(entry)} disabled={liveBusy}>{tr('Open Panel', 'Abrir Panel')}</button>
                    </div>
                  </div>
                </article>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if liveCurrentJob}
        <div class="card">
          <h3>{tr('Download Progress', 'Progreso de Descarga')}</h3>
          <div class="row">
            <span class={`badge status ${liveCurrentJob.status === 'done' ? 'ok' : liveCurrentJob.status === 'error' ? 'bad' : 'warn'}`}>
              {liveCurrentJob.status}
            </span>
            <span class="badge">{liveCurrentJob.publishedfileid}</span>
          </div>
          {#if liveCurrentJob.error}
            <div class="banner error">{liveCurrentJob.error}</div>
          {/if}
        </div>
      {/if}

      {#if liveSideOpen}
        <aside class="live-sidepanel">
          <div class="row">
            <h3>{liveSelected?.title ?? 'LiveWallpaper'}</h3>
            <button class="secondary" on:click={() => (liveSideOpen = false)}>{tr('Close', 'Cerrar')}</button>
          </div>
          <div class="live-monitor-skeleton">
            <div class="live-monitor-screen">
              {#if livePreviewPrimary(liveSelected)}
                <img
                  class="live-monitor-media"
                  src={liveSelectedPreviewDataUrl || liveCandidateSrc(liveSelectedPreviewCandidates()[0] ?? (livePreviewPrimary(liveSelected) ?? ''))}
                  alt={liveSelected?.title ?? 'preview'}
                  data-local-path={liveLocalPreviewPath(liveSelected)}
                  data-fallbacks={JSON.stringify(liveSelectedPreviewCandidates())}
                  data-fallback-index="1"
                  on:error={onLiveLibraryPreviewError}
                />
              {:else if livePreviewFallback(liveSelected)}
                <img
                  class="live-monitor-media"
                  src={liveSelectedPreviewDataUrl || liveCandidateSrc(liveSelectedPreviewCandidates()[0] ?? (livePreviewFallback(liveSelected) ?? ''))}
                  alt={liveSelected?.title ?? 'preview'}
                  data-local-path={liveLocalPreviewPath(liveSelected)}
                  data-fallbacks={JSON.stringify(liveSelectedPreviewCandidates())}
                  data-fallback-index="1"
                  on:error={onLiveLibraryPreviewError}
                />
              {:else}
                <div class="monitor-placeholder">No preview</div>
              {/if}
            </div>
          </div>
          <div class="live-details">
            <div class="row"><span class="badge">id: {liveSelected?.id ?? '-'}</span></div>
            <div class="row"><span class="badge">type: {liveSelected?.wallpaper_type ?? 'unknown'}</span></div>
            <div class="row">
              <span class={`badge status ${liveSelected?.audio_reactive ? 'ok' : 'warn'}`}>
                audio: {liveSelected?.audio_reactive ? 'reactive' : 'static'}
              </span>
            </div>
            <div class="row"><span class="badge">author: {liveSelected?.author_name ?? '-'}</span></div>
            <div class="row"><span class="badge">updated: {liveSelected?.time_updated ? formatTimestamp(liveSelected.time_updated * 1000) : '-'}</span></div>
            {#if liveSelected && 'file_size' in liveSelected && liveSelected.file_size}
              <div class="row"><span class="badge">size: {(liveSelected.file_size / (1024 * 1024)).toFixed(1)} MB</span></div>
            {/if}
            <div class="row">
              {#each liveSelected?.tags ?? [] as tag}
                <span class="badge">{tag}</span>
              {/each}
            </div>
            {#if liveSelected && 'description_short' in liveSelected && liveSelected.description_short}
              <p class="muted">{liveSelected.description_short}</p>
            {/if}
            <div class="row">
              {#if liveSelected?.id}
                <button
                  on:click={() => {
                    const entry = liveLibraryItems.find(v => v.id === liveSelected?.id && (!liveSelectedLibraryPath || v.path === liveSelectedLibraryPath))
                      ?? liveLibraryItems.find(v => v.id === liveSelected?.id);
                    if (entry) void applyLiveWallpaper(entry);
                  }}
                  disabled={liveBusy || (liveAppStatus ? !liveAppStatus.installed : false)}
                >
                  {tr('Apply', 'Aplicar')}
                </button>
                {#each activeMonitorsForWallpaper(liveSelected.id) as mon}
                  <button class="secondary" on:click={() => stopLiveWallpaperMonitor(mon)} disabled={liveBusy}>{tr(`Stop ${mon}`, `Detener ${mon}`)}</button>
                {/each}
              {/if}
              {#if liveSelected && 'item_url' in liveSelected && liveSelected.item_url}
                <a class="secondary live-link" href={liveSelected.item_url} target="_blank" rel="noreferrer">Steam</a>
              {/if}
              <span class="badge">source: {liveSelectedSource ?? '-'}</span>
            </div>
          </div>
        </aside>
      {/if}
      {/if}
      </section>
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
