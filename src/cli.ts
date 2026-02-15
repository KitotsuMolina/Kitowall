#!/usr/bin/env node
// CLI entrypoint and command routing.
import {
  loadConfig,
  saveConfig,
  isGenericJsonPack,
  isRedditPack,
  isWallhavenPack,
  isUnsplashPack,
  isLocalPack,
  isStaticUrlPack,
  normalizePackName
} from './core/config';
import {loadState, saveState} from './core/state';
import {Controller} from './core/controller';
import {detectOutputs} from './core/outputs';
import {installSystemd, uninstallSystemd, systemdStatus} from './core/systemd';
import {initKitowall} from './core/init';
import {watchMonitors} from './core/watch';
import {getHealth, printDoctor} from './core/doctor';
import {CacheManager} from './core/cache';
import {addFavorite, removeFavorite, listFavorites} from './core/favorites';
import {loadHistory, clearHistory} from './core/history';
import {GenericJsonAdapter} from './adapters/genericJson';
import {RedditAdapter} from './adapters/reddit';
import {WallhavenAdapter} from './adapters/wallhaven';
import {UnsplashAdapter} from './adapters/unsplash';
import {LocalFolderAdapter} from './adapters/localFolder';
import {StaticUrlAdapter} from './adapters/staticUrl';
import {listSystemLogs, clearSystemLogs} from './core/logs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  workshopSearch,
  workshopDetails,
  workshopQueueDownload,
  workshopGetJob,
  workshopListJobs,
  workshopLibrary,
  workshopRunJob,
  workshopCoexistenceEnter,
  workshopCoexistenceExit,
  workshopCoexistenceStatus,
  setWorkshopApiKey
} from './core/workshop';

function getCliVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const raw = readFileSync(pkgPath, 'utf8');
    const parsed = JSON.parse(raw) as {version?: string};
    return parsed.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

function printUsage(): void {
  console.log(`kitowall <command> [options]

Commands:
  outputs                                  List outputs (Wayland monitors)
  next [--pack <name>] [--namespace <ns>]     Apply next wallpapers (respects mode unless --force)
  status                                   Show current state in JSON
  cache-config [--dir <path>] [--download-dir <path>] [--max-mb <n>] [--default-ttl-sec <n>]
                                          Update cache settings in config.json
  cache-prune                             Prune cache (TTL + max size, respects favorites)
  cache-prune-hard                        Hard prune downloaded wallpapers (respects favorites)
  cache-prune-pack <name>                 Prune cache entries for a single pack
  cache-prune-pack-hard <name>            Hard prune downloaded wallpapers for one pack
  pool-status [--refresh]                 Show candidate counts per pool source
  refresh-pack --all [--parallel]         Refresh all remote packs
  hydrate-pack <name> --count <n>         Download N images for a pack (no apply)
  favorites                               List favorite wallpapers
  favorite add <path>                     Add wallpaper path to favorites
  favorite remove <path>                  Remove wallpaper path from favorites
  list-packs [--refresh] [--only-remote]  List all packs with type
  pack-status <name> [--refresh]          Show status for a pack
  refresh-pack <name>                     Refresh remote pack index
  pack add <name> --type <type> [options] Add a pack
  pack update <name> [options]            Update a pack
  pack remove <name>                      Remove a pack
  pack list                               List packs (raw config)
  pack show <name>                        Show pack config
  pack subtheme add <name> <value>        Add subtheme to a pack
  pack subtheme remove <name> <value>     Remove subtheme from a pack
  pack set-key <name> [--api-key <k>] [--api-key-env <ENV>]
                                          Set API key for a pack
  pack-group add <name> --sources <list> [--weights <list>] [--subthemes <list>] [--subreddits <list>] [--paths <list>]
                                         [--wallhaven-key-env <ENV>] [--unsplash-key-env <ENV>] [--update]
                                          Create packs per source and add them to pool
  pool enable|disable                     Enable/disable pool
  pool add <name> [--weight N] [--max N]  Add pack to pool
  pool remove <name>                      Remove pack from pool
  pool list                               List pool sources
  transition --type <t> [--fps N] [--duration N] [--angle N] [--pos x,y]
                                          Update transition settings in config
  settings get                            Show general settings
  settings set [--mode <manual|rotate>] [--rotation-interval-sec <n>]
                                         [--transition-type <t>] [--transition-fps <n>] [--transition-duration <n>]
                                         [--transition-angle <n>] [--transition-pos <x,y>]
                                          Update general settings
  history [--limit <n>]                  Show wallpaper history (newest first)
  history clear                          Clear wallpaper history
  logs [--limit <n>] [--source <name>] [--pack <name>] [--level <info|warn|error>] [--q <text>]
                                         Show system logs (requests/downloads/errors)
  logs clear                             Clear system logs
  we config set-api-key <key>            Save Steam Web API key (~/.config/kitowall/we.json)
  we search [--text <q>] [--tags <a,b>] [--sort <top|newest|trend|subscribed|updated>] [--page <n>] [--page-size <n>] [--days <n>] [--fixtures]
                                         Search Wallpaper Engine workshop items (appid 431960)
  we details <publishedfileid> [--fixtures]
                                         Fetch workshop item details and additional previews
  we download <publishedfileid> [--target-dir <path>] [--steam-user <user>] [--steam-pass-env <ENV>] [--steam-guard <code>] [--coexist]
                                         Queue steamcmd download job (async)
  we job <job_id>                        Show one download job
  we jobs [--limit <n>]                  List recent download jobs
  we library                             List downloaded workshop items
  we coexist enter|exit|status           Temporarily stop/restore wallpaper rotation services
  check [--namespace <ns>] [--json]        Quick system check (no changes)

  init [--namespace <ns>] [--apply] [--force]       Setup kitowall (install daemon + watcher + next.service), validate deps
  watch [--debounce <ms>]                  Watch Hyprland monitor hotplug events and apply wallpapers
  doctor [--namespace <ns>]
  health [--namespace <ns>]

  install-systemd [--every <dur>]          Install + enable systemd user timer (timer only)
  uninstall-systemd                        Disable systemd timer
  systemd-status                           Show systemd timer status
  rotate-now [--pack <name>]               Apply next wallpapers ignoring manual mode (for timers)
  mode <manual|rotate>                     Set mode persistently in state.json
Examples:
  kitowall init --namespace kitowall --apply
  kitowall install-systemd --every 5m
  kitowall next --pack sao
  kitowall outputs
  kitowall mode rotate
  kitowall rotate-now
  kitowall transition --type center --fps 60 --duration 0.7
  kitowall settings get
  kitowall settings set --mode rotate --rotation-interval-sec 600
  kitowall history --limit 100
  kitowall history clear
  kitowall logs --source wallhaven --limit 200
  kitowall logs clear
  kitowall check --json
`);
}

function getOptionValue(args: string[], key: string): string | null {
  const idx = args.indexOf(key);
  if (idx === -1) return null;
  return args[idx + 1] ?? null;
}

function parseList(input?: string | null): string[] | undefined {
  if (!input) return undefined;
  return input.split(',').map(s => s.trim()).filter(Boolean);
}

function parseBool(input?: string | null): boolean | undefined {
  if (input === null || input === undefined) return undefined;
  const v = input.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return undefined;
}

function parseNumberList(input?: string | null): number[] | undefined {
  if (!input) return undefined;
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  const nums = parts.map(p => Number(p)).filter(n => Number.isFinite(n));
  return nums.length ? nums : undefined;
}

function cleanOpt(value: string | null): string | undefined {
  if (value == null) return undefined;
  const v = value.trim();
  return v.length ? v : undefined;
}

let outputJsonOnError = false;

function formatError(err: unknown): {message: string; hint?: string; code?: string} {
  const message = err instanceof Error ? err.message : String(err);
  let hint: string | undefined;
  let code: string | undefined;

  if (message.startsWith('No images found for pack:')) {
    const pack = message.split(':').slice(1).join(':').trim();
    hint = `Try: kitowall hydrate-pack ${pack} --count 10`;
    code = 'NO_IMAGES';
  } else if (message.startsWith('No images could be selected for outputs')) {
    hint = 'Check pack content, selection cooldowns, or hydrate the pack.';
    code = 'NO_SELECTION';
  } else if (message.startsWith('Pool is not enabled')) {
    hint = 'Enable pool: kitowall pool enable';
    code = 'POOL_DISABLED';
  } else if (message.startsWith('Pack not found:')) {
    hint = 'List packs: kitowall pack list';
    code = 'PACK_NOT_FOUND';
  } else if (message.startsWith('No outputs detected')) {
    hint = 'Ensure Hyprland is running and hyprctl works.';
    code = 'NO_OUTPUTS';
  } else if (message.includes('Missing API key')) {
    hint = 'Set API key via pack set-key or apiKeyEnv in config.';
    code = 'API_KEY_MISSING';
  }

  return {message, hint, code};
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  outputJsonOnError = args.includes('--json');
  const cmd = args[0];

  if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
    console.log(getCliVersion());
    return;
  }

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printUsage();
    return;
  }

  if (cmd === 'outputs') {
    const outputs = await detectOutputs();
    console.log(JSON.stringify(outputs.map(o => o.name), null, 2));
    return;
  }

  // init: instala daemon + watcher + next.service y valida dependencias
  if (cmd === 'init') {
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'kitowall';
    const apply = args.includes('--apply');
    const force = args.includes('--force');
    await initKitowall({namespace, apply, force});
    console.log(JSON.stringify({ok: true, init: true, namespace, apply}, null, 2));
    return;
  }

  // watch: modo manual (normalmente lo corre systemd por init)
  if (cmd === 'watch') {
    const debounceRaw = cleanOpt(getOptionValue(args, '--debounce'));
    const debounceMs = debounceRaw ? Number(debounceRaw) : 800;
    if (!Number.isFinite(debounceMs) || debounceMs < 100) {
      throw new Error(`Invalid --debounce value: ${debounceRaw} (min 100)`);
    }

    await watchMonitors({debounceMs});
    return;
  }

  // systemd helpers (timer-only)
  if (cmd === 'install-systemd') {
    const every = cleanOpt(getOptionValue(args, '--every')) ?? '10m';

    await installSystemd({every});

    console.log(`✔ systemd timer installed (every ${every})`);
    console.log(JSON.stringify({ok: true, installed: true, every}, null, 2));
    return;
  }

  if (cmd === 'uninstall-systemd') {
    await uninstallSystemd();
    console.log('✔ systemd timer disabled');
    console.log(JSON.stringify({ok: true, uninstalled: true}, null, 2));
    return;
  }

  if (cmd === 'systemd-status') {
    await systemdStatus();
    return;
  }

  if (cmd === 'doctor') {
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'kitowall';
    await printDoctor(namespace);
    return;
  }

  if (cmd === 'health') {
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'kitowall';
    const report = await getHealth(namespace);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 2; // útil para scripts
    return;
  }

  if (cmd === 'check') {
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'kitowall';
    const report = await getHealth(namespace);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 2;
    return;
  }

  if (cmd === 'we') {
    const action = cleanOpt(args[1] ?? null);
    if (!action) {
      throw new Error('Usage: we <config|search|details|download|job|jobs|library|run-job|coexist> ...');
    }

    if (action === 'config') {
      const sub = cleanOpt(args[2] ?? null);
      if (sub !== 'set-api-key') throw new Error('Usage: we config set-api-key <key>');
      const key = cleanOpt(args[3] ?? null);
      if (!key) throw new Error('Usage: we config set-api-key <key>');
      setWorkshopApiKey(key);
      console.log(JSON.stringify({ok: true, updated: 'steamWebApiKey'}, null, 2));
      return;
    }

    if (action === 'search') {
      const text = cleanOpt(getOptionValue(args, '--text'));
      const tags = parseList(getOptionValue(args, '--tags'));
      const sort = cleanOpt(getOptionValue(args, '--sort')) as
        | 'top'
        | 'newest'
        | 'trend'
        | 'subscribed'
        | 'updated'
        | undefined;
      const pageRaw = cleanOpt(getOptionValue(args, '--page'));
      const pageSizeRaw = cleanOpt(getOptionValue(args, '--page-size'));
      const daysRaw = cleanOpt(getOptionValue(args, '--days'));
      const fixtures = args.includes('--fixtures');
      const out = await workshopSearch({
        text,
        tags,
        sort,
        page: pageRaw ? Number(pageRaw) : undefined,
        pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
        days: daysRaw ? Number(daysRaw) : undefined,
        fixtures
      });
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    if (action === 'details') {
      const id = cleanOpt(args[2] ?? null);
      if (!id) throw new Error('Usage: we details <publishedfileid> [--fixtures]');
      const fixtures = args.includes('--fixtures');
      const out = await workshopDetails(id, fixtures);
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    if (action === 'download') {
      const id = cleanOpt(args[2] ?? null);
      if (!id) throw new Error('Usage: we download <publishedfileid> [--target-dir <path>] [--steam-user <user>] [--steam-pass-env <ENV>] [--steam-guard <code>] [--coexist]');
      const out = workshopQueueDownload({
        publishedfileid: id,
        targetDir: cleanOpt(getOptionValue(args, '--target-dir')),
        steamUser: cleanOpt(getOptionValue(args, '--steam-user')),
        steamPasswordEnv: cleanOpt(getOptionValue(args, '--steam-pass-env')),
        steamGuardCode: cleanOpt(getOptionValue(args, '--steam-guard')),
        useCoexistence: args.includes('--coexist')
      });
      console.log(JSON.stringify({ok: true, ...out}, null, 2));
      return;
    }

    if (action === 'run-job') {
      const jobId = cleanOpt(args[2] ?? null);
      if (!jobId) throw new Error('Usage: we run-job <job_id>');
      const out = await workshopRunJob(jobId);
      console.log(JSON.stringify({ok: true, job: out}, null, 2));
      return;
    }

    if (action === 'job') {
      const jobId = cleanOpt(args[2] ?? null);
      if (!jobId) throw new Error('Usage: we job <job_id>');
      const out = workshopGetJob(jobId);
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    if (action === 'jobs') {
      const limitRaw = cleanOpt(getOptionValue(args, '--limit'));
      const limit = limitRaw ? Number(limitRaw) : 40;
      if (!Number.isFinite(limit) || limit <= 0) throw new Error(`Invalid --limit value: ${limitRaw}`);
      const out = workshopListJobs(Math.floor(limit));
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    if (action === 'library') {
      const out = workshopLibrary();
      console.log(JSON.stringify(out, null, 2));
      return;
    }

    if (action === 'coexist') {
      const sub = cleanOpt(args[2] ?? null);
      if (sub === 'enter') {
        const out = await workshopCoexistenceEnter();
        console.log(JSON.stringify(out, null, 2));
        return;
      }
      if (sub === 'exit') {
        const out = await workshopCoexistenceExit();
        console.log(JSON.stringify(out, null, 2));
        return;
      }
      if (sub === 'status') {
        const out = await workshopCoexistenceStatus();
        console.log(JSON.stringify(out, null, 2));
        return;
      }
      throw new Error('Usage: we coexist <enter|exit|status>');
    }

    throw new Error('Usage: we <config|search|details|download|job|jobs|library|run-job|coexist> ...');
  }

  // Regular commands (need config/state)
  const config = loadConfig();
  const state = loadState();
  const controller = new Controller(config, state);

  if (cmd === 'pack') {
    const action = cleanOpt(args[1] ?? null);
    const rawName = cleanOpt(args[2] ?? null);
    const name = rawName ? normalizePackName(rawName) : undefined;
    if (!action) throw new Error('Usage: pack <add|update|remove|list|show|subtheme|set-key> ...');

    if (action === 'list') {
      console.log(JSON.stringify({packs: config.packs}, null, 2));
      return;
    }

    if (action === 'show') {
      if (!name) throw new Error('Usage: pack show <name>');
      if (!config.packs[name]) throw new Error(`Pack not found: ${name}`);
      console.log(JSON.stringify({name, pack: config.packs[name]}, null, 2));
      return;
    }

    if (action === 'remove') {
      if (!name) throw new Error('Usage: pack remove <name>');
      if (!config.packs[name]) throw new Error(`Pack not found: ${name}`);
      delete config.packs[name];
      if (config.pool) {
        config.pool.sources = config.pool.sources.filter(s => s.name !== name);
      }
      if (state.current_pack === name) {
        state.current_pack = null;
      }
      saveState(state);
      saveConfig(config);
      console.log(JSON.stringify({ok: true, removed: name, detachedFromPool: true}, null, 2));
      return;
    }

    if (action === 'subtheme') {
      const subAction = cleanOpt(args[3] ?? null);
      const value = cleanOpt(args[4] ?? null);
      if (!name || !subAction || !value) {
        throw new Error('Usage: pack subtheme <add|remove> <name> <value>');
      }
      const pack = config.packs[name];
      if (!pack) throw new Error(`Pack not found: ${name}`);
      const key = 'subthemes' as keyof typeof pack;
      // @ts-expect-error dynamic field
      let subthemes: string[] = (pack[key] as string[]) ?? [];
      if (!Array.isArray(subthemes)) subthemes = [];
      if (subAction === 'add') {
        if (!subthemes.includes(value)) subthemes.push(value);
      } else if (subAction === 'remove') {
        subthemes = subthemes.filter(s => s !== value);
      } else {
        throw new Error('Usage: pack subtheme <add|remove> <name> <value>');
      }
      // @ts-expect-error dynamic field
      pack[key] = subthemes;
      config.packs[name] = pack;
      saveConfig(config);
      console.log(JSON.stringify({ok: true, name, subthemes}, null, 2));
      return;
    }

    if (action === 'set-key') {
      if (!name) throw new Error('Usage: pack set-key <name> [--api-key <k>] [--api-key-env <ENV>]');
      const pack = config.packs[name];
      if (!pack) throw new Error(`Pack not found: ${name}`);
      const apiKey = cleanOpt(getOptionValue(args, '--api-key'));
      const apiKeyEnv = cleanOpt(getOptionValue(args, '--api-key-env'));
      if (!apiKey && !apiKeyEnv) throw new Error('Provide --api-key or --api-key-env');
      // @ts-expect-error dynamic field
      if (apiKey) pack.apiKey = apiKey;
      // @ts-expect-error dynamic field
      if (apiKeyEnv) pack.apiKeyEnv = apiKeyEnv;
      config.packs[name] = pack;
      saveConfig(config);
      console.log(JSON.stringify({ok: true, name, apiKey: !!apiKey, apiKeyEnv}, null, 2));
      return;
    }

    if (action === 'add' || action === 'update') {
      if (!name) throw new Error(`Usage: pack ${action} <name> --type <type> [options]`);
      const type = cleanOpt(getOptionValue(args, '--type')) ?? (config.packs[name]?.type as string | undefined);
      if (!type) throw new Error('Missing --type');

      const pack: Record<string, unknown> = {...(config.packs[name] ?? {})};
      pack.type = type;

      const keyword = cleanOpt(getOptionValue(args, '--keyword'));
      const subthemes = parseList(getOptionValue(args, '--subthemes'));
      const paths = parseList(getOptionValue(args, '--paths'));
      const subreddits = parseList(getOptionValue(args, '--subreddits'));
      const apiKey = cleanOpt(getOptionValue(args, '--api-key'));
      const apiKeyEnv = cleanOpt(getOptionValue(args, '--api-key-env'));
      const ratios = parseList(getOptionValue(args, '--ratios'));
      const categories = cleanOpt(getOptionValue(args, '--categories'));
      const purity = cleanOpt(getOptionValue(args, '--purity'));
      const atleast = cleanOpt(getOptionValue(args, '--atleast'));
      const sorting = cleanOpt(getOptionValue(args, '--sorting'));
      const colors = cleanOpt(getOptionValue(args, '--colors'));
      const aiArt = parseBool(getOptionValue(args, '--ai-art'));
      const allowSfw = parseBool(getOptionValue(args, '--allow-sfw'));
      const allowSketchy = parseBool(getOptionValue(args, '--allow-sketchy'));
      const allowNsfw = parseBool(getOptionValue(args, '--allow-nsfw'));
      const categoryGeneral = parseBool(getOptionValue(args, '--category-general'));
      const categoryAnime = parseBool(getOptionValue(args, '--category-anime'));
      const categoryPeople = parseBool(getOptionValue(args, '--category-people'));
      const minWidth = cleanOpt(getOptionValue(args, '--min-width'));
      const minHeight = cleanOpt(getOptionValue(args, '--min-height'));
      const ratioW = cleanOpt(getOptionValue(args, '--ratio-w'));
      const ratioH = cleanOpt(getOptionValue(args, '--ratio-h'));
      const query = cleanOpt(getOptionValue(args, '--query'));
      const topics = cleanOpt(getOptionValue(args, '--topics'));
      const collections = cleanOpt(getOptionValue(args, '--collections'));
      const username = cleanOpt(getOptionValue(args, '--username'));
      const orientation = cleanOpt(getOptionValue(args, '--orientation'));
      const contentFilter = cleanOpt(getOptionValue(args, '--content-filter'));
      const imageWidth = cleanOpt(getOptionValue(args, '--image-width'));
      const imageHeight = cleanOpt(getOptionValue(args, '--image-height'));
      const imageFit = cleanOpt(getOptionValue(args, '--image-fit'));
      const imageQuality = cleanOpt(getOptionValue(args, '--image-quality'));
      const endpoint = cleanOpt(getOptionValue(args, '--endpoint'));
      const imagePath = cleanOpt(getOptionValue(args, '--image-path'));
      const imagePrefix = cleanOpt(getOptionValue(args, '--image-prefix'));
      const postPath = cleanOpt(getOptionValue(args, '--post-path'));
      const postPrefix = cleanOpt(getOptionValue(args, '--post-prefix'));
      const authorNamePath = cleanOpt(getOptionValue(args, '--author-name-path'));
      const authorUrlPath = cleanOpt(getOptionValue(args, '--author-url-path'));
      const authorUrlPrefix = cleanOpt(getOptionValue(args, '--author-url-prefix'));
      const authorName = cleanOpt(getOptionValue(args, '--author-name'));
      const authorUrl = cleanOpt(getOptionValue(args, '--author-url'));
      const domain = cleanOpt(getOptionValue(args, '--domain'));
      const postUrl = cleanOpt(getOptionValue(args, '--post-url'));
      const url = cleanOpt(getOptionValue(args, '--url'));
      const urls = parseList(getOptionValue(args, '--urls'));
      const differentImages = parseBool(getOptionValue(args, '--different-images'));
      const count = cleanOpt(getOptionValue(args, '--count'));
      const ttlSec = cleanOpt(getOptionValue(args, '--ttl-sec'));

      if (keyword) pack.keyword = keyword;
      if (subthemes) pack.subthemes = subthemes;
      if (paths) pack.paths = paths;
      if (subreddits) pack.subreddits = subreddits;
      if (apiKey) pack.apiKey = apiKey;
      if (apiKeyEnv) pack.apiKeyEnv = apiKeyEnv;
      if (ratios) pack.ratios = ratios;
      if (categories) pack.categories = categories;
      if (purity) pack.purity = purity;
      if (atleast) pack.atleast = atleast;
      if (sorting) pack.sorting = sorting;
      if (colors) pack.colors = colors;
      if (aiArt !== undefined) pack.aiArt = aiArt;
      if (allowSfw !== undefined) pack.allowSfw = allowSfw;
      if (allowSketchy !== undefined) pack.allowSketchy = allowSketchy;
      if (allowNsfw !== undefined) pack.allowNsfw = allowNsfw;
      if (categoryGeneral !== undefined) pack.categoryGeneral = categoryGeneral;
      if (categoryAnime !== undefined) pack.categoryAnime = categoryAnime;
      if (categoryPeople !== undefined) pack.categoryPeople = categoryPeople;
      if (minWidth) pack.minWidth = Number(minWidth);
      if (minHeight) pack.minHeight = Number(minHeight);
      if (ratioW) pack.ratioW = Number(ratioW);
      if (ratioH) pack.ratioH = Number(ratioH);
      if (query) pack.query = query;
      if (topics) pack.topics = topics;
      if (collections) pack.collections = collections;
      if (username) pack.username = username;
      if (orientation) pack.orientation = orientation;
      if (contentFilter) pack.contentFilter = contentFilter;
      if (imageWidth) pack.imageWidth = Number(imageWidth);
      if (imageHeight) pack.imageHeight = Number(imageHeight);
      if (imageFit) pack.imageFit = imageFit;
      if (imageQuality) pack.imageQuality = Number(imageQuality);
      if (endpoint) pack.endpoint = endpoint;
      if (imagePath) pack.imagePath = imagePath;
      if (imagePrefix) pack.imagePrefix = imagePrefix;
      if (postPath) pack.postPath = postPath;
      if (postPrefix) pack.postPrefix = postPrefix;
      if (authorNamePath) pack.authorNamePath = authorNamePath;
      if (authorUrlPath) pack.authorUrlPath = authorUrlPath;
      if (authorUrlPrefix) pack.authorUrlPrefix = authorUrlPrefix;
      if (authorName) pack.authorName = authorName;
      if (authorUrl) pack.authorUrl = authorUrl;
      if (domain) pack.domain = domain;
      if (postUrl) pack.postUrl = postUrl;
      if (url) pack.url = url;
      if (urls) pack.urls = urls;
      if (differentImages !== undefined) pack.differentImages = differentImages;
      if (count) pack.count = Number(count);
      if (ttlSec) pack.ttlSec = Number(ttlSec);

      config.packs[name] = pack as never;
      saveConfig(config);
      console.log(JSON.stringify({ok: true, action, name, pack: config.packs[name]}, null, 2));
      return;
    }
  }

  if (cmd === 'pool') {
    const action = cleanOpt(args[1] ?? null);
    if (!action) throw new Error('Usage: pool <enable|disable|add|remove|list> ...');
    if (!config.pool) config.pool = {enabled: false, sources: [], dedupe: 'path'};

    if (action === 'enable') {
      config.pool.enabled = true;
      saveConfig(config);
      console.log(JSON.stringify({ok: true, enabled: true}, null, 2));
      return;
    }
    if (action === 'disable') {
      config.pool.enabled = false;
      saveConfig(config);
      console.log(JSON.stringify({ok: true, enabled: false}, null, 2));
      return;
    }
    if (action === 'list') {
      console.log(JSON.stringify({pool: config.pool}, null, 2));
      return;
    }
    if (action === 'add') {
      const rawName = cleanOpt(args[2] ?? null);
      const name = rawName ? normalizePackName(rawName) : undefined;
      if (!name) throw new Error('Usage: pool add <name> [--weight N] [--max N]');
      const weightRaw = cleanOpt(getOptionValue(args, '--weight'));
      const maxRaw = cleanOpt(getOptionValue(args, '--max'));
      const weight = weightRaw ? Math.max(1, Math.floor(Number(weightRaw))) : 1;
      const maxCandidates = maxRaw ? Math.max(1, Math.floor(Number(maxRaw))) : undefined;
      const existing = config.pool.sources.find(s => s.name === name);
      if (existing) {
        existing.weight = weight;
        existing.maxCandidates = maxCandidates;
      } else {
        config.pool.sources.push({name, weight, maxCandidates});
      }
      saveConfig(config);
      console.log(JSON.stringify({ok: true, added: name, weight, maxCandidates}, null, 2));
      return;
    }
    if (action === 'remove') {
      const rawName = cleanOpt(args[2] ?? null);
      const name = rawName ? normalizePackName(rawName) : undefined;
      if (!name) throw new Error('Usage: pool remove <name>');
      config.pool.sources = config.pool.sources.filter(s => s.name !== name);
      saveConfig(config);
      console.log(JSON.stringify({ok: true, removed: name}, null, 2));
      return;
    }
  }

  if (cmd === 'pack-group') {
    const action = cleanOpt(args[1] ?? null);
    const rawName = cleanOpt(args[2] ?? null);
    const name = rawName ? normalizePackName(rawName) : undefined;
    if (!action || action !== 'add') {
      throw new Error('Usage: pack-group add <name> --sources <list> [--weights <list>] [--subthemes <list>] [--subreddits <list>] [--paths <list>]');
    }
    if (!name) throw new Error('Usage: pack-group add <name> --sources <list> ...');

    const sources = parseList(getOptionValue(args, '--sources'));
    const weights = parseNumberList(getOptionValue(args, '--weights'));
    const subthemes = parseList(getOptionValue(args, '--subthemes'));
    const subreddits = parseList(getOptionValue(args, '--subreddits'));
    const paths = parseList(getOptionValue(args, '--paths'));
    const wallhavenKeyEnv = cleanOpt(getOptionValue(args, '--wallhaven-key-env')) ?? 'WALLHAVEN_KEY';
    const unsplashKeyEnv = cleanOpt(getOptionValue(args, '--unsplash-key-env')) ?? 'UNSPLASH_KEY';
    const update = args.includes('--update');

    if (!sources || sources.length === 0) {
      throw new Error('Missing --sources list');
    }
    if (weights && weights.length !== sources.length) {
      throw new Error('If provided, --weights length must match --sources length');
    }

    if (!config.pool) config.pool = {enabled: false, sources: [], dedupe: 'path'};

    const created: Array<{name: string; type: string}> = [];
    const poolAdded: Array<{name: string; weight: number}> = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i].trim().toLowerCase();
      const packName = normalizePackName(`${source}-${name}`);
      if (config.packs[packName] && !update) {
        throw new Error(`Pack already exists: ${packName} (use --update to overwrite)`);
      }

      let pack: Record<string, unknown> | null = null;
      if (source === 'wallhaven') {
        pack = {type: 'wallhaven', keyword: name, subthemes};
        if (wallhavenKeyEnv) pack.apiKeyEnv = wallhavenKeyEnv;
      } else if (source === 'unsplash') {
        pack = {type: 'unsplash', query: name, subthemes};
        if (unsplashKeyEnv) pack.apiKeyEnv = unsplashKeyEnv;
      } else if (source === 'reddit') {
        pack = {type: 'reddit', subthemes};
        if (subreddits) pack.subreddits = subreddits;
      } else if (source === 'local') {
        if (!paths || paths.length === 0) {
          throw new Error('Local source requires --paths');
        }
        pack = {type: 'local', paths};
      } else {
        throw new Error(`Unsupported source for pack-group: ${source}`);
      }

      config.packs[packName] = pack as never;
      created.push({name: packName, type: pack.type as string});

      const weight = weights ? Math.max(1, Math.floor(weights[i])) : 1;
      const existing = config.pool.sources.find(s => s.name === packName);
      if (existing) {
        existing.weight = weight;
      } else {
        config.pool.sources.push({name: packName, weight});
      }
      poolAdded.push({name: packName, weight});
    }

    saveConfig(config);
    console.log(JSON.stringify({ok: true, created, pool: poolAdded}, null, 2));
    return;
  }

  if (cmd === 'transition') {
    const typeRaw = cleanOpt(getOptionValue(args, '--type'));
    const fpsRaw = cleanOpt(getOptionValue(args, '--fps'));
    const durationRaw = cleanOpt(getOptionValue(args, '--duration'));
    const angleRaw = cleanOpt(getOptionValue(args, '--angle'));
    const pos = cleanOpt(getOptionValue(args, '--pos'));

    if (!typeRaw && !fpsRaw && !durationRaw && !angleRaw && !pos) {
      throw new Error('Usage: transition --type <t> [--fps N] [--duration N] [--angle N] [--pos x,y]');
    }

    const allowed = new Set([
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
    ]);

    if (typeRaw) {
      const type = typeRaw.trim().toLowerCase();
      if (!allowed.has(type)) {
        throw new Error(`Invalid transition type: ${typeRaw}`);
      }
      config.transition.type = type;
    }

    if (fpsRaw) {
      const fps = Number(fpsRaw);
      if (!Number.isFinite(fps) || fps <= 0) throw new Error(`Invalid --fps: ${fpsRaw}`);
      config.transition.fps = fps;
    }
    if (durationRaw) {
      const duration = Number(durationRaw);
      if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid --duration: ${durationRaw}`);
      config.transition.duration = duration;
    }
    if (angleRaw) {
      const angle = Number(angleRaw);
      if (!Number.isFinite(angle)) throw new Error(`Invalid --angle: ${angleRaw}`);
      config.transition.angle = angle;
    }
    if (pos) {
      config.transition.pos = pos;
    }

    saveConfig(config);
    console.log(JSON.stringify({ok: true, transition: config.transition}, null, 2));
    return;
  }

  if (cmd === 'settings') {
    const action = cleanOpt(args[1] ?? null);
    if (!action || (action !== 'get' && action !== 'set')) {
      throw new Error('Usage: settings <get|set> ...');
    }
    if (action === 'get') {
      console.log(JSON.stringify({
        mode: state.mode,
        rotation_interval_seconds: config.rotation_interval_seconds,
        transition: config.transition
      }, null, 2));
      return;
    }

    const mode = cleanOpt(getOptionValue(args, '--mode'));
    const intervalRaw = cleanOpt(getOptionValue(args, '--rotation-interval-sec'));
    const tType = cleanOpt(getOptionValue(args, '--transition-type'));
    const tFpsRaw = cleanOpt(getOptionValue(args, '--transition-fps'));
    const tDurRaw = cleanOpt(getOptionValue(args, '--transition-duration'));
    const tAngleRaw = cleanOpt(getOptionValue(args, '--transition-angle'));
    const tPos = cleanOpt(getOptionValue(args, '--transition-pos'));

    const allowed = new Set([
      'simple', 'fade', 'left', 'right', 'top', 'bottom', 'wipe', 'wave', 'grow', 'center', 'outer', 'any', 'random'
    ]);

    if (mode) {
      if (mode !== 'manual' && mode !== 'rotate') throw new Error(`Invalid --mode: ${mode}`);
      state.mode = mode;
      config.mode = mode;
    }
    if (intervalRaw) {
      const n = Number(intervalRaw);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --rotation-interval-sec: ${intervalRaw}`);
      config.rotation_interval_seconds = Math.floor(n);
    }
    if (tType) {
      const type = tType.toLowerCase();
      if (!allowed.has(type)) throw new Error(`Invalid --transition-type: ${tType}`);
      config.transition.type = type;
    }
    if (tFpsRaw) {
      const n = Number(tFpsRaw);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --transition-fps: ${tFpsRaw}`);
      config.transition.fps = n;
    }
    if (tDurRaw) {
      const n = Number(tDurRaw);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --transition-duration: ${tDurRaw}`);
      config.transition.duration = n;
    }
    if (tAngleRaw) {
      const n = Number(tAngleRaw);
      if (!Number.isFinite(n)) throw new Error(`Invalid --transition-angle: ${tAngleRaw}`);
      config.transition.angle = n;
    }
    if (tPos) config.transition.pos = tPos;

    state.last_updated = Date.now();
    saveState(state);
    saveConfig(config);
    console.log(JSON.stringify({
      ok: true,
      settings: {
        mode: state.mode,
        rotation_interval_seconds: config.rotation_interval_seconds,
        transition: config.transition
      }
    }, null, 2));
    return;
  }

  const getRemoteAdapter = (packName: string) => {
    const pack = config.packs[packName];
    if (!pack) return null;
    const cache = new CacheManager(config.cache);
    if (isGenericJsonPack(pack)) return new GenericJsonAdapter(packName, pack, cache);
    if (isRedditPack(pack)) return new RedditAdapter(packName, pack, cache);
    if (isWallhavenPack(pack)) return new WallhavenAdapter(packName, pack, cache);
    if (isUnsplashPack(pack)) return new UnsplashAdapter(packName, pack, cache);
    if (isStaticUrlPack(pack)) return new StaticUrlAdapter(packName, pack, cache);
    return null;
  };

  if (cmd === 'cache-config') {
    const dir = cleanOpt(getOptionValue(args, '--dir'));
    const downloadDir = cleanOpt(getOptionValue(args, '--download-dir'));
    const maxMbRaw = cleanOpt(getOptionValue(args, '--max-mb'));
    const ttlRaw = cleanOpt(getOptionValue(args, '--default-ttl-sec'));

    if (dir) config.cache.dir = dir;
    if (downloadDir) config.cache.downloadDir = downloadDir;
    if (maxMbRaw) {
      const maxMb = Number(maxMbRaw);
      if (!Number.isFinite(maxMb) || maxMb <= 0) {
        throw new Error(`Invalid --max-mb: ${maxMbRaw}`);
      }
      config.cache.maxMB = maxMb;
    }
    if (ttlRaw) {
      const ttl = Number(ttlRaw);
      if (!Number.isFinite(ttl) || ttl <= 0) {
        throw new Error(`Invalid --default-ttl-sec: ${ttlRaw}`);
      }
      config.cache.defaultTtlSec = ttl;
    }

    saveConfig(config);
    console.log(JSON.stringify({ok: true, cache: config.cache}, null, 2));
    return;
  }

  if (cmd === 'cache-prune') {
    const cache = new CacheManager(config.cache);
    const result = cache.prune();
    console.log(JSON.stringify({ok: true, ...result}, null, 2));
    return;
  }

  if (cmd === 'cache-prune-hard') {
    const cache = new CacheManager(config.cache);
    const result = cache.hardPruneAll();
    console.log(JSON.stringify({ok: true, ...result}, null, 2));
    return;
  }

  if (cmd === 'cache-prune-pack') {
    const name = cleanOpt(args[1] ?? null);
    if (!name) throw new Error('Usage: cache-prune-pack <name>');
    const cache = new CacheManager(config.cache);
    const result = cache.prunePack(name);
    console.log(JSON.stringify({ok: true, pack: name, ...result}, null, 2));
    return;
  }

  if (cmd === 'cache-prune-pack-hard') {
    const name = cleanOpt(args[1] ?? null);
    if (!name) throw new Error('Usage: cache-prune-pack-hard <name>');
    const cache = new CacheManager(config.cache);
    const result = cache.hardPrunePack(name);
    console.log(JSON.stringify({ok: true, pack: name, ...result}, null, 2));
    return;
  }

  if (cmd === 'pool-status') {
    const refresh = args.includes('--refresh') || args.includes('--force');
    const stats = await controller.poolStats(refresh);
    console.log(JSON.stringify({ok: true, stats}, null, 2));
    return;
  }

  if (cmd === 'favorites') {
    console.log(JSON.stringify(listFavorites(), null, 2));
    return;
  }

  if (cmd === 'history') {
    const action = cleanOpt(args[1] ?? null);
    if (action === 'clear') {
      const result = clearHistory();
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const limitRaw = cleanOpt(getOptionValue(args, '--limit'));
    const limit = limitRaw ? Number(limitRaw) : 200;
    if (!Number.isFinite(limit) || limit <= 0) throw new Error(`Invalid --limit: ${limitRaw}`);
    const favorites = new Set(listFavorites());
    const history = loadHistory().entries
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.floor(limit))
      .map(e => ({...e, favorite: favorites.has(e.path)}));
    console.log(JSON.stringify({entries: history}, null, 2));
    return;
  }

  if (cmd === 'logs') {
    const action = cleanOpt(args[1] ?? null);
    if (action === 'clear') {
      const result = clearSystemLogs();
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    const limitRaw = cleanOpt(getOptionValue(args, '--limit'));
    const source = cleanOpt(getOptionValue(args, '--source'));
    const pack = cleanOpt(getOptionValue(args, '--pack'));
    const levelRaw = cleanOpt(getOptionValue(args, '--level'));
    const q = cleanOpt(getOptionValue(args, '--q'));
    const limit = limitRaw ? Number(limitRaw) : 200;
    if (!Number.isFinite(limit) || limit <= 0) throw new Error(`Invalid --limit value: ${limitRaw}`);
    const level = levelRaw && ['info', 'warn', 'error'].includes(levelRaw) ? levelRaw as 'info' | 'warn' | 'error' : undefined;
    const entries = listSystemLogs({limit: Math.floor(limit), source, pack, level, q});
    console.log(JSON.stringify({entries}, null, 2));
    return;
  }

  if (cmd === 'favorite') {
    const action = cleanOpt(args[1] ?? null);
    const target = cleanOpt(args[2] ?? null);
    if (!action || !target) {
      throw new Error('Usage: favorite <add|remove> <path>');
    }
    if (action === 'add') {
      addFavorite(target);
      console.log(JSON.stringify({ok: true, added: target}, null, 2));
      return;
    }
    if (action === 'remove') {
      removeFavorite(target);
      console.log(JSON.stringify({ok: true, removed: target}, null, 2));
      return;
    }
    throw new Error('Usage: favorite <add|remove> <path>');
  }

  if (cmd === 'list-packs') {
    const refresh = args.includes('--refresh');
    const onlyRemote = args.includes('--only-remote');
    const rows = [];
    for (const [name, pack] of Object.entries(config.packs)) {
      if (isLocalPack(pack)) {
        if (!onlyRemote) {
          const adapter = new LocalFolderAdapter({paths: pack.paths});
          rows.push({name, type: pack.type, count: adapter.getAllImages().length});
        }
        continue;
      }
      const adapter = getRemoteAdapter(name);
      if (!adapter) {
        if (!onlyRemote) rows.push({name, type: pack.type, count: 0});
        continue;
      }
      if (refresh) await adapter.refreshIndex({force: true});
      const candidates = await adapter.listCandidates();
      rows.push({name, type: pack.type, count: candidates.length});
    }
    const poolEnabled = !!config.pool?.enabled;
    console.log(JSON.stringify({packs: rows, pool: {enabled: poolEnabled, sources: config.pool?.sources ?? []}}, null, 2));
    return;
  }

  if (cmd === 'pack-status') {
    const rawName = cleanOpt(args[1] ?? null);
    const name = rawName ? normalizePackName(rawName) : undefined;
    if (!name) throw new Error('Usage: pack-status <name>');
    const pack = config.packs[name];
    if (!pack) throw new Error(`Pack not found: ${name}`);
    const refresh = args.includes('--refresh');

    if (isLocalPack(pack)) {
      const adapter = new LocalFolderAdapter({paths: pack.paths});
      const pool = adapter.getAllImages();
      console.log(JSON.stringify({ok: true, name, type: pack.type, count: pool.length}, null, 2));
      return;
    }

    const adapter = getRemoteAdapter(name);
    if (!adapter) throw new Error(`Pack type not supported: ${pack.type}`);
    if (refresh) await adapter.refreshIndex({force: true});
    const candidates = await adapter.listCandidates();
    const status = await adapter.status();
    console.log(JSON.stringify({
      name,
      type: pack.type,
      ttlSec: (pack as {ttlSec?: number}).ttlSec,
      count: candidates.length,
      ...status
    }, null, 2));
    return;
  }

  if (cmd === 'refresh-pack') {
    const rawName = cleanOpt(args[1] ?? null);
    const name = rawName ? normalizePackName(rawName) : undefined;
    const all = args.includes('--all');
    const parallel = args.includes('--parallel');
    if (all) {
      const entries = Object.entries(config.packs);
      const runner = async ([packName, pack]: [string, typeof config.packs[string]]) => {
        if (isLocalPack(pack)) {
          return {name: packName, type: pack.type, refreshed: false, reason: 'local-pack'};
        }
        const adapter = getRemoteAdapter(packName);
        if (!adapter) {
          return {name: packName, type: pack.type, refreshed: false, reason: 'unsupported'};
        }
        const r = await adapter.refreshIndex({force: true});
        return {name: packName, type: pack.type, ...r};
      };
      const results = parallel
        ? await Promise.all(entries.map(runner))
        : await (async () => {
          const out = [];
          for (const entry of entries) out.push(await runner(entry));
          return out;
        })();
      console.log(JSON.stringify({ok: true, all: true, parallel, results}, null, 2));
      return;
    }
    if (!name) throw new Error('Usage: refresh-pack <name>');
    const pack = config.packs[name];
    if (!pack) throw new Error(`Pack not found: ${name}`);
    if (isLocalPack(pack)) {
      console.log(JSON.stringify({ok: true, name, type: pack.type, refreshed: false, reason: 'local-pack'}, null, 2));
      return;
    }
    const adapter = getRemoteAdapter(name);
    if (!adapter) throw new Error(`Pack type not supported: ${pack.type}`);
    const result = await adapter.refreshIndex({force: true});
    console.log(JSON.stringify({ok: true, name, type: pack.type, ...result}, null, 2));
    return;
  }

  if (cmd === 'hydrate-pack') {
    const rawName = cleanOpt(args[1] ?? null);
    const name = rawName ? normalizePackName(rawName) : undefined;
    const countRaw = cleanOpt(getOptionValue(args, '--count'));
    if (!name || !countRaw) throw new Error('Usage: hydrate-pack <name> --count <n>');
    const count = Number(countRaw);
    if (!Number.isFinite(count) || count <= 0) throw new Error('Invalid --count');
    const {hydratePack} = await import('./core/hydrate');
    const result = await hydratePack(config, name, Math.floor(count));
    console.log(JSON.stringify({ok: true, name, ...result}, null, 2));
    return;
  }

  if (cmd === 'mode') {
    const value = cleanOpt(args[1] ?? null);

    if (value !== 'manual' && value !== 'rotate') {
      throw new Error(`Invalid mode: ${value ?? '(missing)'} (use: manual|rotate)`);
    }

    state.mode = value;
    state.last_updated = Date.now();
    saveState(state);

    console.log(JSON.stringify({ok: true, mode: state.mode}, null, 2));
    return;
  }

  if (cmd === 'next' || cmd === 'rotate-now') {
    const pack = cleanOpt(getOptionValue(args, '--pack'));
    const namespace = cleanOpt(getOptionValue(args, '--namespace')) ?? 'kitowall';
    const force = cmd === 'rotate-now' || args.includes('--force');

    if (state.mode === 'manual' && !force) {
      console.log(JSON.stringify(
          {
            ok: true,
            skipped: true,
            reason: 'mode=manual',
            hint: 'Use: kitowall rotate-now  OR  kitowall next --force  OR  kitowall mode rotate',
            namespace
          },
          null,
          2
      ));
      return;
    }

    const result = await controller.applyNext(pack, namespace);
    console.log(JSON.stringify(
        {
          pack: result.pack,
          outputs: result.outputs,
          images: result.images,
          namespace
        },
        null,
        2
    ));
    return;
  }

  if (cmd === 'status') {
    const outputs = await controller.getOutputs();
    console.log(JSON.stringify(
        {
          mode: state.mode,
          pack: state.current_pack,
          outputs,
          last_set: state.last_set,
          last_updated: state.last_updated
        },
        null,
        2
    ));
    return;
  }

  printUsage();
  process.exitCode = 1;
}

main().catch((err) => {
  const formatted = formatError(err);
  if (outputJsonOnError) {
    console.log(JSON.stringify({ok: false, code: formatted.code, error: formatted.message, hint: formatted.hint}, null, 2));
  } else {
    console.error(formatted.message);
    if (formatted.hint) console.error(`Hint: ${formatted.hint}`);
  }
  process.exitCode = formatted.code ? 2 : 1;
});
