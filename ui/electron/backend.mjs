import {app, dialog, shell} from 'electron';
import {promises as fs} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {spawn} from 'node:child_process';

const RELEASE_CACHE = new Map();
const NATIVE_PREVIEW = {child: null};
const UI_LOG_PATH = '/tmp/kitowall-kitsune-ui.log';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const PACKAGED_CLI_DIR = path.join(process.resourcesPath, 'kitowall-cli');
const PACKAGED_BOOTSTRAP = path.join(process.resourcesPath, 'bootstrap-host.sh');
const PACKAGED_BOOTSTRAP_SYSTEM = path.join(process.resourcesPath, 'bootstrap-system.sh');
const DEV_BOOTSTRAP = path.join(ROOT_DIR, 'scripts', 'bootstrap-host.sh');
const DEV_BOOTSTRAP_SYSTEM = path.join(ROOT_DIR, 'scripts', 'bootstrap-system.sh');

function appendKitsuneUiLog(message) {
  const ts = Math.floor(Date.now() / 1000);
  fs.appendFile(UI_LOG_PATH, `[${ts}] ${message}\n`).catch(() => {});
}

function normalizeReleaseVersion(input) {
  return String(input ?? '').trim().replace(/^v/, '');
}

async function runProcess(base, args = [], options = {}) {
  const {
    env = process.env,
    cwd,
    allowNonZero = false
  } = options;

  return await new Promise((resolve, reject) => {
    const child = spawn(base, args, {env, cwd, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0 && !allowNonZero) {
        const err = new Error(stderr.trim() || stdout.trim() || `${base} exited with code ${code}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({code: code ?? 0, stdout, stderr});
    });
  });
}

async function runLoggedProcess(base, args = [], options = {}) {
  const {
    env = process.env,
    cwd,
    allowNonZero = false
  } = options;

  return await new Promise((resolve, reject) => {
    const child = spawn(base, args, {env, cwd, stdio: ['ignore', 'pipe', 'pipe']});
    let stdout = '';
    let stderr = '';

    const appendChunk = chunk => {
      const text = chunk.toString();
      fs.appendFile(UI_LOG_PATH, text).catch(() => {});
      return text;
    };

    child.stdout.on('data', chunk => {
      stdout += appendChunk(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += appendChunk(chunk);
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0 && !allowNonZero) {
        const err = new Error(stderr.trim() || stdout.trim() || `${base} exited with code ${code}`);
        err.code = code;
        err.stdout = stdout;
        err.stderr = stderr;
        reject(err);
        return;
      }
      resolve({code: code ?? 0, stdout, stderr});
    });
  });
}

async function hostHomeDir() {
  return process.env.HOME || os.homedir();
}

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBootstrapPath() {
  if (await fileExists(DEV_BOOTSTRAP)) return DEV_BOOTSTRAP;
  return PACKAGED_BOOTSTRAP;
}

async function resolveBootstrapSystemPath() {
  if (await fileExists(DEV_BOOTSTRAP_SYSTEM)) return DEV_BOOTSTRAP_SYSTEM;
  return PACKAGED_BOOTSTRAP_SYSTEM;
}

function normalizeGroupFileNameValue(value) {
  const clean = String(value ?? '').trim();
  if (!clean) return '';
  return clean.endsWith('.group') ? clean : `${clean}.group`;
}

async function resolveKitsuneGroupsDir() {
  const home = await hostHomeDir();
  return path.join(home, '.config', 'kitsune', 'groups');
}

async function resolveKitsuneGroupsDirs() {
  const home = await hostHomeDir();
  const canonical = path.join(home, '.config', 'kitsune', 'groups');
  return [
    canonical,
    path.join(home, '.local', 'share', 'kitsune', 'config', 'groups'),
    path.join(home, 'config', 'groups'),
    path.join(ROOT_DIR, 'Kitsune', 'config', 'groups')
  ];
}

async function resolveKitsuneGroupFilePath(groupFile) {
  const normalized = normalizeGroupFileNameValue(groupFile);
  if (!normalized) throw new Error('groupFile is required');
  if (path.isAbsolute(normalized)) return normalized;
  const cleaned = normalized.replace(/^[.][/]/, '');
  const candidateDirs = await resolveKitsuneGroupsDirs();
  if (cleaned.startsWith('config/groups/')) {
    const stripped = cleaned.slice('config/groups/'.length);
    for (const dir of candidateDirs) {
      const candidate = path.join(dir, stripped);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {}
    }
    return path.join(candidateDirs[0], stripped);
  }
  for (const dir of candidateDirs) {
    const candidate = path.join(dir, normalized);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return path.join(candidateDirs[0], normalized);
}

async function shellPathEntries() {
  try {
    const home = await hostHomeDir();
    const out = await runProcess(
      'bash',
      ['-lc', 'printf %s "$PATH"'],
      {
        env: {
          ...process.env,
          HOME: home
        },
        allowNonZero: true
      }
    );
    return out.stdout.split(':').map(x => x.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

async function collectNvmBinDirs(home) {
  const versionsRoot = path.join(home, '.nvm', 'versions', 'node');
  try {
    const entries = await fs.readdir(versionsRoot, {withFileTypes: true});
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(versionsRoot, entry.name, 'bin'))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

async function collectNpmPrefixBinDirs() {
  const dirs = [];
  for (const cmd of ['npm config get prefix 2>/dev/null || true', 'npm prefix -g 2>/dev/null || true']) {
    try {
      const home = await hostHomeDir();
      const out = await runProcess(
        'bash',
        ['-lc', cmd],
        {
          env: {
            ...process.env,
            HOME: home,
            PATH: [
              path.join(home, '.local', 'bin'),
              path.join(home, '.cargo', 'bin'),
              process.env.PATH || '',
              '/usr/local/bin',
              '/usr/bin',
              '/bin'
            ].filter(Boolean).join(':')
          },
          allowNonZero: true
        }
      );
      const prefix = out.stdout.trim();
      if (!prefix || prefix === 'undefined' || prefix === 'null') continue;
      const candidate = path.join(prefix, 'bin');
      try {
        const st = await fs.stat(candidate);
        if (st.isDirectory()) {
          dirs.push(candidate);
          continue;
        }
      } catch {}
      try {
        const st = await fs.stat(prefix);
        if (st.isDirectory()) dirs.push(prefix);
      } catch {}
    } catch {}
  }
  return dirs;
}

async function hostUserPath() {
  const home = await hostHomeDir();
  const entries = [
    path.join(home, '.local', 'bin'),
    path.join(home, '.npm-global', 'bin'),
    path.join(home, '.cargo', 'bin'),
    ...(process.env.PATH ? process.env.PATH.split(':') : []),
    '/usr/local/bin',
    '/usr/bin',
    '/bin'
  ];
  return [...new Set(entries.map(x => String(x).trim()).filter(Boolean))].join(':');
}

async function shellOutput(cmdline) {
  const env = {...process.env, PATH: await hostUserPath(), HOME: await hostHomeDir()};
  return await runProcess('bash', ['-lc', cmdline], {env, allowNonZero: true});
}

async function resolveHostBinPath(bin) {
  const out = await shellOutput(`command -v ${bin} || true`);
  const byPath = out.stdout.trim();
  if (byPath) return byPath;

  const home = await hostHomeDir();
  const fallback = {
    kitowall: [
      path.join(home, '.local', 'bin', 'kitowall'),
      path.join(home, '.npm-global', 'bin', 'kitowall'),
      path.join(home, 'node_modules', '.bin', 'kitowall')
    ],
    kitsune: [
      path.join(home, '.cargo', 'bin', 'kitsune'),
      path.join(home, '.local', 'bin', 'kitsune'),
      path.join(home, '.local', 'share', 'kitsune', 'bin', 'kitsune')
    ],
    'kitsune-rendercore': [
      path.join(home, '.cargo', 'bin', 'kitsune-rendercore'),
      path.join(home, '.local', 'bin', 'kitsune-rendercore')
    ]
  }[bin] ?? [path.join(home, '.local', 'bin', bin)];

  for (const candidate of fallback) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }

  if (bin === 'kitowall') {
    for (const dir of await collectNpmPrefixBinDirs()) {
      const candidate = path.join(dir, bin);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {}
    }
  }

  return '';
}

async function hostAwareEnv(extra = {}) {
  return {
    ...process.env,
    ...extra,
    PATH: await hostUserPath(),
    HOME: await hostHomeDir()
  };
}

async function polkitAwareEnv(extra = {}) {
  const home = await hostHomeDir();
  const passthroughKeys = [
    'DISPLAY',
    'WAYLAND_DISPLAY',
    'XDG_RUNTIME_DIR',
    'XAUTHORITY',
    'DBUS_SESSION_BUS_ADDRESS',
    'DESKTOP_SESSION',
    'XDG_SESSION_TYPE',
    'XDG_CURRENT_DESKTOP',
    'USER',
    'LOGNAME',
    'SHELL',
    'LANG',
    'LC_ALL',
    'LC_MESSAGES',
    'TERM'
  ];
  const env = {
    PATH: await hostUserPath(),
    HOME: home
  };
  for (const key of passthroughKeys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim()) env[key] = value;
  }
  return {
    ...env,
    ...extra
  };
}

async function runJsonCommand(base, args = [], extraEnv = {}, cwd) {
  const out = await runProcess(base, args, {env: await hostAwareEnv(extraEnv), cwd});
  try {
    return JSON.parse(out.stdout);
  } catch {
    throw new Error(out.stderr.trim() || out.stdout.trim() || 'invalid json');
  }
}

async function runJsonCommandAllowNonZero(base, args = [], extraEnv = {}, cwd) {
  const out = await runProcess(base, args, {env: await hostAwareEnv(extraEnv), cwd, allowNonZero: true});
  try {
    return JSON.parse(out.stdout);
  } catch {
    const message = out.stderr.trim() || out.stdout.trim() || `${base} exited with code ${out.code}`;
    const err = new Error(message);
    err.code = out.code;
    err.stdout = out.stdout;
    err.stderr = out.stderr;
    throw err;
  }
}

async function runRawCommand(base, args = [], extraEnv = {}, cwd) {
  const out = await runProcess(base, args, {env: await hostAwareEnv(extraEnv), cwd});
  return out.stdout;
}

async function runPrivilegedSystemBootstrap() {
  const helper = await resolveBootstrapSystemPath();
  const env = await polkitAwareEnv();
  appendKitsuneUiLog(
    `runPrivilegedSystemBootstrap: helper=${helper} display=${env.DISPLAY || ''} wayland=${env.WAYLAND_DISPLAY || ''} runtime=${env.XDG_RUNTIME_DIR || ''} dbus=${env.DBUS_SESSION_BUS_ADDRESS ? 'set' : 'missing'}`
  );
  const out = await runLoggedProcess('pkexec', ['bash', helper], {
    env,
    allowNonZero: true
  });
  return {
    ok: out.code === 0,
    code: out.code,
    logs: `${out.stdout}${out.stderr}`
  };
}

async function readKitsunePalette(palettePath = '/tmp/kitsune-accent.palette') {
  try {
    const raw = await fs.readFile(palettePath, 'utf8');
    const out = {
      accent_light: '',
      accent_mid: '',
      accent_dark: '',
      candidates: [],
      candidate_r: [],
      candidate_g: [],
      candidate_b: [],
      path: palettePath,
      ok: true
    };
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (key === 'accent_light' || key === 'accent_mid' || key === 'accent_dark') {
        out[key] = value;
        continue;
      }
      if (/^candidate_\d+$/i.test(key)) {
        out.candidates.push(value);
        continue;
      }
      if (/^candidate_r_\d+$/i.test(key)) {
        out.candidate_r.push(value);
        continue;
      }
      if (/^candidate_g_\d+$/i.test(key)) {
        out.candidate_g.push(value);
        continue;
      }
      if (/^candidate_b_\d+$/i.test(key)) {
        out.candidate_b.push(value);
      }
    }
    return out;
  } catch {
    return {ok: false, accent_light: '', accent_mid: '', accent_dark: '', candidates: [], candidate_r: [], candidate_g: [], candidate_b: [], path: palettePath};
  }
}

function sanitizeKitsuneInstanceId(raw) {
  return String(raw ?? '').replace(/[^A-Za-z0-9_.-]/g, '_');
}

function kitsunePalettePathForMonitor(monitor) {
  const mon = String(monitor ?? '').trim();
  if (!mon) return '/tmp/kitsune-accent.palette';
  return `/tmp/kitsune-accent-${sanitizeKitsuneInstanceId(mon)}.palette`;
}

async function resolveKitowallCmd() {
  if (process.env.KITOWALL_CMD) {
    const [base, ...args] = process.env.KITOWALL_CMD.split(/\s+/).filter(Boolean);
    return {base, prefixArgs: args, cwd: ROOT_DIR};
  }

  const localCli = path.join(ROOT_DIR, 'dist', 'cli.js');
  if (await fileExists(localCli)) {
    return {base: 'node', prefixArgs: [localCli], cwd: ROOT_DIR};
  }

  const hostCli = await resolveHostBinPath('kitowall');
  if (hostCli) return {base: hostCli, prefixArgs: [], cwd: await hostHomeDir()};

  const packagedCli = path.join(PACKAGED_CLI_DIR, 'cli.js');
  if (await fileExists(packagedCli)) {
    return {base: 'node', prefixArgs: [packagedCli], cwd: await hostHomeDir()};
  }

  return {base: 'kitowall', prefixArgs: [], cwd: await hostHomeDir()};
}

async function runKitowall(args = []) {
  const {base, prefixArgs, cwd} = await resolveKitowallCmd();
  return await runJsonCommand(base, [...prefixArgs, ...args], {}, cwd);
}

async function runKitowallRaw(args = []) {
  const {base, prefixArgs, cwd} = await resolveKitowallCmd();
  return await runRawCommand(base, [...prefixArgs, ...args], {}, cwd);
}

async function resolveKitsuneCmd() {
  if (process.env.KITSUNE_CMD) {
    const [base, ...args] = process.env.KITSUNE_CMD.split(/\s+/).filter(Boolean);
    return {base, prefixArgs: args, cwd: await hostHomeDir()};
  }

  const home = await hostHomeDir();
  const userScript = path.join(home, '.local', 'share', 'kitsune', 'scripts', 'kitsune.sh');
  if (await fileExists(userScript)) {
    return {base: userScript, prefixArgs: [], cwd: home};
  }

  const directBins = [
    path.join(home, '.local', 'bin', 'kitsune'),
    path.join(home, '.cargo', 'bin', 'kitsune'),
    path.join(home, '.local', 'share', 'kitsune', 'bin', 'kitsune')
  ];
  for (const candidate of directBins) {
    if (await fileExists(candidate)) {
      return {base: candidate, prefixArgs: [], cwd: home};
    }
  }

  const localScript = path.join(ROOT_DIR, 'Kitsune', 'scripts', 'kitsune.sh');
  if (await fileExists(localScript)) {
    return {base: localScript, prefixArgs: [], cwd: ROOT_DIR};
  }

  const hostBin = await resolveHostBinPath('kitsune');
  if (hostBin) return {base: hostBin, prefixArgs: [], cwd: home};

  return {base: 'kitsune', prefixArgs: [], cwd: home};
}

async function bootstrapVersionsPath() {
  return path.join(await hostHomeDir(), '.local', 'share', 'kitowall', 'bootstrap-versions.json');
}

async function kitsuneGroupSchemesPath() {
  return path.join(await hostHomeDir(), '.local', 'share', 'kitowall', 'kitsune-group-schemes.json');
}

async function readKitsuneGroupSchemesStore() {
  const target = await kitsuneGroupSchemesPath();
  try {
    const raw = await fs.readFile(target, 'utf8');
    const data = JSON.parse(raw);
    return typeof data === 'object' && data ? data : {};
  } catch {
    return {};
  }
}

async function writeKitsuneGroupSchemesStore(data) {
  const target = await kitsuneGroupSchemesPath();
  await fs.mkdir(path.dirname(target), {recursive: true});
  await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return target;
}

async function readBootstrapVersion(component) {
  try {
    const raw = await fs.readFile(await bootstrapVersionsPath(), 'utf8');
    const data = JSON.parse(raw);
    const version = String(data?.[component]?.version ?? '').trim();
    return version || null;
  } catch {
    return null;
  }
}

async function githubLatestReleaseTag(repo) {
  const cached = RELEASE_CACHE.get(repo);
  if (cached && Date.now() - cached.at < 300000) return cached.value;

  try {
    const out = await runProcess(
      'curl',
      ['-fsSL', '--connect-timeout', '1', '--max-time', '2', '-H', 'User-Agent: Kitowall-UI', `https://api.github.com/repos/${repo}/releases/latest`],
      {env: await hostAwareEnv()}
    );
    const data = JSON.parse(out.stdout);
    const tag = normalizeReleaseVersion(data?.tag_name ?? '');
    const value = tag || null;
    RELEASE_CACHE.set(repo, {at: Date.now(), value});
    return value;
  } catch {
    RELEASE_CACHE.set(repo, {at: Date.now(), value: null});
    return null;
  }
}

async function componentUpdateInfo(id) {
  const repo = {
    kitsune: 'KitotsuMolina/Kitsune',
    'kitsune-rendercore': 'KitotsuMolina/Kitsune-RenderCore'
  }[id];
  const localVersion = await readBootstrapVersion(id);
  const latestVersion = repo ? await githubLatestReleaseTag(repo) : null;
  return {
    local_version: localVersion,
    latest_version: latestVersion,
    update_available: !!(localVersion && latestVersion && localVersion !== latestVersion)
  };
}

async function resolveDownloadRoot() {
  const home = await hostHomeDir();
  const defaultRoot = path.join(home, 'Pictures', 'Wallpapers');
  const configPath = path.join(home, '.config', 'kitowall', 'config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const json = JSON.parse(raw);
    const dir = json?.cache?.downloadDir ?? '~/Pictures/Wallpapers';
    if (dir === '~') return home;
    if (dir.startsWith('~/')) return path.join(home, dir.slice(2));
    return dir;
  } catch {
    return defaultRoot;
  }
}

async function expandTildePath(input) {
  const home = await hostHomeDir();
  if (input === '~') return home;
  if (input.startsWith('~/')) return path.join(home, input.slice(2));
  return input;
}

async function resolveLocalPackRoots() {
  const home = await hostHomeDir();
  const configPath = path.join(home, '.config', 'kitowall', 'config.json');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const json = JSON.parse(raw);
    const packs = json?.packs ?? {};
    const roots = [];
    for (const [packName, pack] of Object.entries(packs)) {
      if (pack?.type !== 'local') continue;
      const pathsValue = pack?.paths;
      const values = Array.isArray(pathsValue) ? pathsValue : typeof pathsValue === 'string' ? [pathsValue] : [];
      for (const value of values) {
        roots.push([await expandTildePath(value), packName]);
      }
    }
    return roots;
  } catch {
    return [];
  }
}

function isImageExt(filePath) {
  return ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.avif'].includes(path.extname(filePath).toLowerCase());
}

async function listWallpaperItems() {
  const root = await resolveDownloadRoot();
  const localRoots = await resolveLocalPackRoots();
  const items = [];
  const rootsToScan = [];

  try {
    const st = await fs.stat(root);
    if (st.isDirectory()) rootsToScan.push([await fs.realpath(root), null]);
  } catch {}

  for (const [packRoot, packName] of localRoots) {
    try {
      const st = await fs.stat(packRoot);
      if (st.isDirectory()) rootsToScan.push([await fs.realpath(packRoot), packName]);
    } catch {}
  }

  const stack = rootsToScan.map((entry, index) => [entry[0], index]);
  const seen = new Set();

  while (stack.length > 0) {
    const [dir, rootIdx] = stack.pop();
    let entries;
    try {
      entries = await fs.readdir(dir, {withFileTypes: true});
    } catch {
      continue;
    }
    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        stack.push([entryPath, rootIdx]);
        continue;
      }
      if (!isImageExt(entryPath)) continue;
      let abs;
      try {
        abs = await fs.realpath(entryPath);
      } catch {
        continue;
      }
      if (seen.has(abs)) continue;
      seen.add(abs);

      const [baseRoot, localPackName] = rootsToScan[rootIdx];
      const rel = path.relative(baseRoot, abs);
      const parts = rel.split(path.sep).filter(Boolean);
      const pack = localPackName ?? parts[0] ?? 'root';
      const meta = await fs.stat(abs).catch(() => null);
      items.push({
        path: abs,
        pack,
        fileName: path.basename(abs),
        modifiedMs: meta ? meta.mtimeMs : 0
      });
    }
  }

  items.sort((a, b) => b.modifiedMs - a.modifiedMs);
  return {ok: true, root, items};
}

async function systemctlShow(unit, props) {
  const args = ['--user', 'show', unit, '--no-pager'];
  for (const prop of props) args.push('-p', prop);
  const out = await runProcess('systemctl', args, {env: await hostAwareEnv()});
  const data = {};
  for (const line of out.stdout.split('\n')) {
    const idx = line.indexOf('=');
    if (idx > -1) data[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return data;
}

async function maybeSystemctlShow(unit, props) {
  try {
    return await systemctlShow(unit, props);
  } catch {
    return null;
  }
}

async function shouldRunKitowallInit() {
  const home = await hostHomeDir();
  const configPath = path.join(home, '.config', 'kitowall', 'config.json');
  return !(await fileExists(configPath));
}

async function shouldInstallKitowallTimer() {
  const timer = await maybeSystemctlShow('kitowall-next.timer', ['LoadState', 'UnitFileState']);
  if (!timer) return true;
  const loadState = String(timer.LoadState ?? '').trim().toLowerCase();
  const unitFileState = String(timer.UnitFileState ?? '').trim().toLowerCase();
  if (!loadState || loadState === 'not-found') return true;
  if (!unitFileState || unitFileState === 'disabled' || unitFileState === 'masked') return true;
  return false;
}

async function ensureUiAutostartEntry() {
  if (process.platform !== 'linux') return;
  const home = await hostHomeDir();
  const autostartDir = path.join(home, '.config', 'autostart');
  await fs.mkdir(autostartDir, {recursive: true});
  const desktop = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Kitowall UI',
    'Comment=Start Kitowall tray on login',
    `Exec=env KITOWALL_START_MINIMIZED=1 ${process.execPath}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n');
  await fs.writeFile(path.join(autostartDir, 'kitowall-ui.desktop'), desktop, 'utf8');
}

async function stopNativePreviewProcess() {
  if (NATIVE_PREVIEW.child) {
    NATIVE_PREVIEW.child.kill('SIGTERM');
    NATIVE_PREVIEW.child = null;
  }
}

async function ensurePackExistsAction(name) {
  const raw = await runKitowall(['pack', 'list']);
  const exists = !!raw?.packs?.[name];
  return exists ? 'update' : 'add';
}

function truthyFlag(value) {
  return value === true ? 'true' : 'false';
}

function cleanString(value) {
  const s = String(value ?? '').trim();
  return s || null;
}

function fileToDataUrl(filePath, bytes) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.avif': 'image/avif'
  }[ext] ?? 'application/octet-stream';
  return {ok: true, mime, data_url: `data:${mime};base64,${bytes.toString('base64')}`};
}

function convertFileSrc(filePath) {
  return pathToFileURL(path.resolve(filePath)).href;
}

export async function createBackend(win) {
  await ensureUiAutostartEntry().catch(() => {});

  return {
    convertFileSrc,
    async invoke(command, args = {}) {
      switch (command) {
        case 'kitowall_preflight_status': {
          const checks = [
            ['kitowall', 'kitowall', false],
            ['kitsune', 'kitsune', false],
            ['kitsune-rendercore', 'kitsune-rendercore', false],
            ['swww', 'swww', false],
            ['swww-daemon', 'swww-daemon', false],
            ['hyprctl', 'hyprctl', false],
            ['cava', 'cava', false]
          ];
          const deps = [];
          for (const [id, bin, optional] of checks) {
            const binPath = await resolveHostBinPath(bin);
            deps.push({
              id,
              bin,
              optional,
              installed: !!binPath,
              path: binPath,
              update: await componentUpdateInfo(id)
            });
          }
          return {ok: true, deps};
        }
        case 'kitowall_ui_log_read': {
          const offset = Math.max(0, Number(args.offset ?? 0) || 0);
          try {
            const text = await fs.readFile(UI_LOG_PATH, 'utf8');
            return {
              ok: true,
              text: text.slice(offset),
              nextOffset: text.length
            };
          } catch {
            return {ok: true, text: '', nextOffset: offset};
          }
        }
        case 'kitowall_preflight_install': {
          const namespace = args.namespace || 'kitowall';
          const bootstrapPath = await resolveBootstrapPath();
          const home = await hostHomeDir();
          await fs.writeFile(UI_LOG_PATH, '', 'utf8').catch(() => {});
          const privileged = await runPrivilegedSystemBootstrap();
          const privilegedLogs = String(privileged.logs ?? '').trim();
          if (!privileged.ok) {
            return {
              ok: false,
              step: 'bootstrap-system',
              code: privileged.code,
              namespace,
              logs: privilegedLogs,
              deps: await this.invoke('kitowall_preflight_status'),
              paths: {
                home,
                local_bin: path.join(home, '.local', 'bin'),
                cargo_bin: path.join(home, '.cargo', 'bin'),
                kitowall_config: path.join(home, '.config', 'kitowall'),
                rendercore_env: path.join(home, '.config', 'kitsune-rendercore', 'env')
              }
            };
          }
          const out = await runLoggedProcess('bash', [bootstrapPath], {
            env: await hostAwareEnv({HOME: home, KITOWALL_SKIP_SYSTEM_DEPS: '1'}),
            allowNonZero: true
          });
          const logs = `${privilegedLogs ? `${privilegedLogs}\n` : ''}${out.stdout}${out.stderr}`;
          const deps = await this.invoke('kitowall_preflight_status');
          if (out.code !== 0) {
            return {
              ok: false,
              step: 'bootstrap-host',
              code: out.code,
              namespace,
              logs,
              deps,
              paths: {
                home,
                local_bin: path.join(home, '.local', 'bin'),
                cargo_bin: path.join(home, '.cargo', 'bin'),
                kitowall_config: path.join(home, '.config', 'kitowall'),
                rendercore_env: path.join(home, '.config', 'kitsune-rendercore', 'env')
              }
            };
          }
          const postLogs = [];
          if (await shouldRunKitowallInit()) {
            postLogs.push('[info] running automatic kitowall init --apply because config.json is missing');
            await runKitowall(['init', '--namespace', namespace, '--apply', '--force', '--json']).catch(error => {
              postLogs.push(`[warn] automatic init skipped after failure: ${error?.message ?? error}`);
            });
          } else {
            postLogs.push('[info] automatic init skipped; host config already exists');
          }
          if (await shouldInstallKitowallTimer()) {
            postLogs.push('[info] running automatic install-systemd because kitowall-next.timer is missing or not installed');
            await runKitowallRaw(['install-systemd', '--every', '600s']).catch(error => {
              postLogs.push(`[warn] automatic install-systemd skipped after failure: ${error?.message ?? error}`);
            });
          } else {
            postLogs.push('[info] automatic install-systemd skipped; user timer already exists');
          }

          return {
            ok: true,
            step: 'bootstrap-host',
            namespace,
            logs: `${logs}${logs ? '\n' : ''}${postLogs.join('\n')}\n`,
            deps: await this.invoke('kitowall_preflight_status'),
            paths: {
              home,
              local_bin: path.join(home, '.local', 'bin'),
              cargo_bin: path.join(home, '.cargo', 'bin'),
              kitowall_config: path.join(home, '.config', 'kitowall'),
              rendercore_env: path.join(home, '.config', 'kitsune-rendercore', 'env')
            }
          };
        }
        case 'kitowall_preflight_update_kitsune': {
          const namespace = args.namespace || 'kitowall';
          const bootstrapPath = await resolveBootstrapPath();
          const out = await runProcess('bash', [bootstrapPath], {
            env: await hostAwareEnv({KITOWALL_BOOTSTRAP_MODE: 'kitsune-only'}),
            allowNonZero: true
          });
          return {
            ok: out.code === 0,
            step: 'bootstrap-kitsune',
            code: out.code,
            namespace,
            logs: `${out.stdout}${out.stderr}`,
            deps: await this.invoke('kitowall_preflight_status'),
            kitsune: await this.invoke('kitowall_kitsune_status')
          };
        }
        case 'kitowall_native_preview_stop':
          await stopNativePreviewProcess();
          return {ok: true};
        case 'kitowall_native_preview_start': {
          const source = cleanString(args.source);
          if (!source) throw new Error('source is required');
          await stopNativePreviewProcess();
          const child = spawn('mpv', [
            '--force-window=yes',
            '--keep-open=yes',
            '--loop-file=inf',
            '--mute=yes',
            '--really-quiet',
            '--no-config',
            '--profile=sw-fast',
            '--hwdec=auto-safe',
            '--title=KitoWall Preview',
            source
          ], {env: await hostAwareEnv(), detached: false, stdio: 'ignore'});
          NATIVE_PREVIEW.child = child;
          return {ok: true, pid: child.pid, source};
        }
        case 'kitowall_check':
          {
            const {base, prefixArgs, cwd} = await resolveKitowallCmd();
            return await runJsonCommandAllowNonZero(base, [...prefixArgs, 'check', '--namespace', args.namespace || 'kitowall', '--json'], {}, cwd);
          }
        case 'kitowall_status':
          return await runKitowall(['status']);
        case 'kitowall_next': {
          const full = ['next', '--namespace', args.namespace || 'kitowall', '--json'];
          if (args.force) full.push('--force');
          if (cleanString(args.pack)) full.push('--pack', cleanString(args.pack));
          return await runKitowall(full);
        }
        case 'kitowall_init_apply':
          return await runKitowall(['init', '--namespace', args.namespace || 'kitowall', '--apply', '--force', '--json']);
        case 'kitowall_hydrate_pack':
          return await runKitowall(['hydrate-pack', String(args.name), '--count', String(args.count)]);
        case 'kitowall_cache_prune':
          return await runKitowall(['cache-prune-hard']);
        case 'kitowall_cache_prune_pack':
          return await runKitowall(['cache-prune-pack-hard', String(args.name)]);
        case 'kitowall_list_packs':
          return await runKitowall(['list-packs']);
        case 'kitowall_list_pack_folders': {
          const dir = await resolveDownloadRoot();
          let folders = [];
          try {
            folders = (await fs.readdir(dir, {withFileTypes: true}))
              .filter(entry => entry.isDirectory())
              .map(entry => entry.name)
              .sort();
          } catch {}
          return {folders};
        }
        case 'kitowall_wallpapers_list':
          return await listWallpaperItems();
        case 'kitowall_open_pack_folder': {
          const root = await resolveDownloadRoot();
          const target = path.join(root, String(args.name));
          await shell.openPath(target);
          return {ok: true, path: target};
        }
        case 'kitowall_settings_get':
          return await runKitowall(['settings', 'get']);
        case 'kitowall_settings_set': {
          const full = ['settings', 'set'];
          if (cleanString(args.mode)) full.push('--mode', cleanString(args.mode));
          if (args.rotationIntervalSec != null) full.push('--rotation-interval-sec', String(args.rotationIntervalSec));
          if (cleanString(args.transitionType)) full.push('--transition-type', cleanString(args.transitionType));
          if (args.transitionFps != null) full.push('--transition-fps', String(args.transitionFps));
          if (args.transitionDuration != null) full.push('--transition-duration', String(args.transitionDuration));
          if (args.transitionAngle != null) full.push('--transition-angle', String(args.transitionAngle));
          if (cleanString(args.transitionPos)) full.push('--transition-pos', cleanString(args.transitionPos));
          return await runKitowall(full);
        }
        case 'kitowall_history_list': {
          const full = ['history'];
          if (args.limit != null) full.push('--limit', String(args.limit));
          return await runKitowall(full);
        }
        case 'kitowall_history_clear':
          return await runKitowall(['history', 'clear']);
        case 'kitowall_favorites_list':
          return await runKitowall(['favorites']);
        case 'kitowall_favorite_add':
          return await runKitowall(['favorite', 'add', String(args.path)]);
        case 'kitowall_favorite_remove':
          return await runKitowall(['favorite', 'remove', String(args.path)]);
        case 'kitowall_logs': {
          const full = ['logs'];
          if (args.limit != null) full.push('--limit', String(args.limit));
          if (cleanString(args.source)) full.push('--source', cleanString(args.source));
          if (cleanString(args.pack)) full.push('--pack', cleanString(args.pack));
          if (cleanString(args.level)) full.push('--level', cleanString(args.level));
          if (cleanString(args.q)) full.push('--q', cleanString(args.q));
          return await runKitowall(full);
        }
        case 'kitowall_logs_clear':
          return await runKitowall(['logs', 'clear']);
        case 'kitowall_install_timer': {
          const every = cleanString(args.every);
          if (!every) throw new Error('every is required');
          const output = await runKitowallRaw(['install-systemd', '--every', every]);
          return {ok: true, every, output};
        }
        case 'kitowall_source_keys_get': {
          const packs = await runKitowall(['pack', 'list']);
          const result = {
            ok: true,
            wallhaven: {value: null, apiKeyEnv: null, pack: null},
            unsplash: {value: null, apiKeyEnv: null, pack: null}
          };
          for (const [name, pack] of Object.entries(packs?.packs ?? {})) {
            if (pack.type === 'wallhaven' && !result.wallhaven.pack) {
              result.wallhaven = {value: pack.apiKey ?? null, apiKeyEnv: pack.apiKeyEnv ?? null, pack: name};
            }
            if (pack.type === 'unsplash' && !result.unsplash.pack) {
              result.unsplash = {value: pack.apiKey ?? null, apiKeyEnv: pack.apiKeyEnv ?? null, pack: name};
            }
          }
          return result;
        }
        case 'kitowall_source_keys_set': {
          const packs = await runKitowall(['pack', 'list']);
          const updated = {wallhaven: [], unsplash: []};
          for (const [name, pack] of Object.entries(packs?.packs ?? {})) {
            if (pack.type === 'wallhaven') {
              if (args.useEnv) {
                await runKitowall(['pack', 'set-key', name, '--api-key-env', cleanString(args.wallhavenEnv) || 'WALLHAVEN_KEY']);
              } else if (cleanString(args.wallhavenKey)) {
                await runKitowall(['pack', 'set-key', name, '--api-key', cleanString(args.wallhavenKey)]);
              }
              updated.wallhaven.push(name);
            }
            if (pack.type === 'unsplash') {
              if (args.useEnv) {
                await runKitowall(['pack', 'set-key', name, '--api-key-env', cleanString(args.unsplashEnv) || 'UNSPLASH_KEY']);
              } else if (cleanString(args.unsplashKey)) {
                await runKitowall(['pack', 'set-key', name, '--api-key', cleanString(args.unsplashKey)]);
              }
              updated.unsplash.push(name);
            }
          }
          return {ok: true, updated};
        }
        case 'kitowall_timer_status':
          return {
            ok: true,
            timer: await systemctlShow('kitowall-next.timer', ['Id', 'UnitFileState', 'ActiveState', 'SubState', 'NextElapseUSecRealtime']),
            service: await systemctlShow('kitowall-next.service', ['Id', 'UnitFileState', 'ActiveState', 'SubState'])
          };
        case 'kitowall_pack_list_raw':
          return await runKitowall(['pack', 'list']);
        case 'kitowall_pack_remove':
          return await runKitowall(['pack', 'remove', String(args.name)]);
        case 'kitowall_pack_upsert_wallhaven': {
          const name = cleanString(args.name);
          const keyword = cleanString(args.keyword);
          if (!name || !keyword) throw new Error('name and keyword are required');
          const full = ['pack', await ensurePackExistsAction(name), name, '--type', 'wallhaven', '--keyword', keyword];
          for (const [key, flag] of Object.entries({
            subthemes: '--subthemes',
            categories: '--categories',
            purity: '--purity',
            ratios: '--ratios',
            colors: '--colors',
            atleast: '--atleast',
            sorting: '--sorting'
          })) {
            if (cleanString(args[key])) full.push(flag, cleanString(args[key]));
          }
          for (const [key, flag] of Object.entries({
            allowSfw: '--allow-sfw',
            allowSketchy: '--allow-sketchy',
            allowNsfw: '--allow-nsfw',
            categoryGeneral: '--category-general',
            categoryAnime: '--category-anime',
            categoryPeople: '--category-people'
          })) {
            if (args[key] != null) full.push(flag, truthyFlag(args[key]));
          }
          if (args.ttlSec != null) full.push('--ttl-sec', String(args.ttlSec));
          await runKitowall(full);
          if (cleanString(args.apiKey)) await runKitowall(['pack', 'set-key', name, '--api-key', cleanString(args.apiKey)]);
          return {ok: true, name, action: full[1], type: 'wallhaven'};
        }
        case 'kitowall_pack_upsert_unsplash': {
          const name = cleanString(args.name);
          const query = cleanString(args.query);
          if (!name || !query) throw new Error('name and query are required');
          const full = ['pack', await ensurePackExistsAction(name), name, '--type', 'unsplash', '--query', query];
          for (const [key, flag] of Object.entries({
            subthemes: '--subthemes',
            orientation: '--orientation',
            contentFilter: '--content-filter',
            topics: '--topics',
            collections: '--collections',
            username: '--username',
            imageFit: '--image-fit'
          })) {
            if (cleanString(args[key])) full.push(flag, cleanString(args[key]));
          }
          for (const [key, flag] of Object.entries({
            imageWidth: '--image-width',
            imageHeight: '--image-height',
            imageQuality: '--image-quality',
            ttlSec: '--ttl-sec'
          })) {
            if (args[key] != null) full.push(flag, String(args[key]));
          }
          await runKitowall(full);
          if (cleanString(args.apiKey)) await runKitowall(['pack', 'set-key', name, '--api-key', cleanString(args.apiKey)]);
          return {ok: true, name, action: full[1], type: 'unsplash'};
        }
        case 'kitowall_pack_upsert_reddit': {
          const name = cleanString(args.name);
          const subreddits = cleanString(args.subreddits);
          if (!name || !subreddits) throw new Error('name and subreddits are required');
          const full = ['pack', await ensurePackExistsAction(name), name, '--type', 'reddit', '--subreddits', subreddits];
          if (cleanString(args.subthemes)) full.push('--subthemes', cleanString(args.subthemes));
          for (const [key, flag] of Object.entries({
            allowSfw: '--allow-sfw',
            minWidth: '--min-width',
            minHeight: '--min-height',
            ratioW: '--ratio-w',
            ratioH: '--ratio-h',
            ttlSec: '--ttl-sec'
          })) {
            if (args[key] != null) full.push(flag, String(typeof args[key] === 'boolean' ? truthyFlag(args[key]) : args[key]));
          }
          await runKitowall(full);
          return {ok: true, name, action: full[1], type: 'reddit'};
        }
        case 'kitowall_pack_upsert_generic_json': {
          const name = cleanString(args.name);
          const endpoint = cleanString(args.endpoint);
          const imagePath = cleanString(args.imagePath);
          if (!name || !endpoint || !imagePath) throw new Error('name, endpoint and imagePath are required');
          const full = ['pack', await ensurePackExistsAction(name), name, '--type', 'generic_json', '--endpoint', endpoint, '--image-path', imagePath];
          for (const [key, flag] of Object.entries({
            imagePrefix: '--image-prefix',
            postPath: '--post-path',
            postPrefix: '--post-prefix',
            authorNamePath: '--author-name-path',
            authorUrlPath: '--author-url-path',
            authorUrlPrefix: '--author-url-prefix',
            domain: '--domain'
          })) {
            if (cleanString(args[key])) full.push(flag, cleanString(args[key]));
          }
          if (args.ttlSec != null) full.push('--ttl-sec', String(args.ttlSec));
          await runKitowall(full);
          return {ok: true, name, action: full[1], type: 'generic_json'};
        }
        case 'kitowall_pack_upsert_static_url': {
          const name = cleanString(args.name);
          if (!name) throw new Error('name is required');
          const full = ['pack', await ensurePackExistsAction(name), name, '--type', 'static_url'];
          if (cleanString(args.url)) full.push('--url', cleanString(args.url));
          if (cleanString(args.urls)) full.push('--urls', cleanString(args.urls));
          if (!cleanString(args.url) && !cleanString(args.urls)) throw new Error('url or urls is required');
          for (const [key, flag] of Object.entries({
            authorName: '--author-name',
            authorUrl: '--author-url',
            domain: '--domain',
            postUrl: '--post-url'
          })) {
            if (cleanString(args[key])) full.push(flag, cleanString(args[key]));
          }
          if (args.differentImages != null) full.push('--different-images', truthyFlag(args.differentImages));
          if (args.count != null) full.push('--count', String(args.count));
          if (args.ttlSec != null) full.push('--ttl-sec', String(args.ttlSec));
          await runKitowall(full);
          return {ok: true, name, action: full[1], type: 'static_url'};
        }
        case 'kitowall_pack_upsert_local': {
          const name = cleanString(args.name);
          const pathsCsv = cleanString(args.paths);
          if (!name || !pathsCsv) throw new Error('name and paths are required');
          const full = ['pack', await ensurePackExistsAction(name), name, '--type', 'local', '--paths', pathsCsv];
          await runKitowall(full);
          return {ok: true, name, action: full[1], type: 'local'};
        }
        case 'kitowall_pick_folder': {
          const result = await dialog.showOpenDialog(win, {properties: ['openDirectory']});
          return {path: result.canceled ? null : result.filePaths[0] ?? null};
        }
        case 'kitowall_kitsune_status': {
          appendKitsuneUiLog('kitowall_kitsune_status: begin');
          const {base, prefixArgs, cwd} = await resolveKitsuneCmd();
          try {
            const out = await runProcess(base, [...prefixArgs, 'help'], {env: await hostAwareEnv(), cwd});
            const commands = [];
            const sections = [];
            const commandSeen = new Set();
            const sectionSeen = new Set();
            for (const line of out.stdout.split('\n')) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (!line.startsWith('  ') && trimmed.endsWith(':')) {
                const section = trimmed.slice(0, -1);
                if (!sectionSeen.has(section)) {
                  sectionSeen.add(section);
                  sections.push(section);
                }
                continue;
              }
              if (line.startsWith('  ')) {
                const token = trimmed.split(/\s+/)[0];
                if (token && token !== 'kitsune' && !commandSeen.has(token)) {
                  commandSeen.add(token);
                  commands.push(token);
                }
              }
            }
            commands.sort();
            sections.sort();
            return {ok: true, installed: true, commands, sections};
          } catch (error) {
            appendKitsuneUiLog(`kitowall_kitsune_status: failed message=${error.message}`);
            return {ok: true, installed: false, error: error.message || 'kitsune help failed', commands: [], sections: []};
          }
        }
        case 'kitowall_kitsune_versions':
          return {kitsune: await componentUpdateInfo('kitsune'), rendercore: await componentUpdateInfo('kitsune-rendercore')};
        case 'kitowall_kitsune_palette': {
          const palettePath = cleanString(args.path) || kitsunePalettePathForMonitor(cleanString(args.monitor));
          return await readKitsunePalette(palettePath);
        }
        case 'kitowall_kitsune_resolve_layer_colors': {
          const groupFile = cleanString(args.groupFile);
          const layerOrder = Number(args.layerOrder ?? 0);
          const spec = cleanString(args.spec);
          if (!groupFile) throw new Error('groupFile is required');
          if (!Number.isInteger(layerOrder) || layerOrder <= 0) {
            throw new Error('layerOrder must be a positive integer');
          }
          const cmdArgs = ['color', 'resolve-layer', String(layerOrder), groupFile];
          if (spec) {
            cmdArgs.push('--spec', spec);
          }
          appendKitsuneUiLog(`kitowall_kitsune_resolve_layer_colors: begin groupFile=${groupFile} layerOrder=${layerOrder} spec=${JSON.stringify(spec)}`);
          let out;
          try {
            const localScript = path.join(ROOT_DIR, 'Kitsune', 'scripts', 'kitsune.sh');
            if (!(await fileExists(localScript))) throw new Error('local kitsune.sh not found');
            out = await runProcess(localScript, cmdArgs, {
              env: await hostAwareEnv(),
              cwd: path.join(ROOT_DIR, 'Kitsune')
            });
            appendKitsuneUiLog(`kitowall_kitsune_resolve_layer_colors: local ok stdout=${JSON.stringify(out.stdout.trim())}`);
          } catch (error) {
            appendKitsuneUiLog(`kitowall_kitsune_resolve_layer_colors: local failed message=${error?.message ?? error}`);
            const {base, prefixArgs, cwd} = await resolveKitsuneCmd();
            out = await runProcess(base, [...prefixArgs, ...cmdArgs], {
              env: await hostAwareEnv(),
              cwd
            });
            appendKitsuneUiLog(`kitowall_kitsune_resolve_layer_colors: fallback ok base=${base} stdout=${JSON.stringify(out.stdout.trim())}`);
          }
          return JSON.parse(out.stdout.trim());
        }
        case 'kitowall_kitsune_group_schemes_list': {
          const groupFile = cleanString(args.groupFile);
          const store = await readKitsuneGroupSchemesStore();
          const items = Array.isArray(store[groupFile]) ? store[groupFile] : [];
          return {ok: true, groupFile, items, path: await kitsuneGroupSchemesPath()};
        }
        case 'kitowall_kitsune_group_schemes_save': {
          const groupFile = cleanString(args.groupFile);
          const name = cleanString(args.name);
          const layers = Array.isArray(args.layers) ? args.layers : [];
          if (!groupFile || !name || layers.length === 0) {
            throw new Error('groupFile, name and layers are required');
          }
          const normalized = layers
            .map(item => ({
              index: Number(item?.index ?? 0),
              rawSpec: String(item?.rawSpec ?? '').trim()
            }))
            .filter(item => Number.isFinite(item.index) && item.index > 0 && item.rawSpec);
          if (normalized.length === 0) {
            throw new Error('no valid layers to save');
          }
          const store = await readKitsuneGroupSchemesStore();
          const existing = Array.isArray(store[groupFile]) ? store[groupFile] : [];
          const next = existing.filter(item => String(item?.name ?? '') !== name);
          next.push({
            name,
            savedAt: Date.now(),
            layers: normalized
          });
          store[groupFile] = next.sort((a, b) => String(a.name).localeCompare(String(b.name)));
          const savedPath = await writeKitsuneGroupSchemesStore(store);
          return {ok: true, groupFile, name, path: savedPath, count: normalized.length};
        }
        case 'kitowall_kitsune_group_reorder': {
          const groupFile = cleanString(args.groupFile);
          const fromIndex = Number(args.fromIndex ?? 0);
          const toIndex = Number(args.toIndex ?? 0);
          if (!groupFile) throw new Error('groupFile is required');
          if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex <= 0 || toIndex <= 0) {
            throw new Error('fromIndex and toIndex must be positive integers');
          }
          const targetPath = await resolveKitsuneGroupFilePath(groupFile);
          const raw = await fs.readFile(targetPath, 'utf8');
          const lines = raw.split('\n');
          const layerIndexes = [];
          for (let i = 0; i < lines.length; i += 1) {
            if (/^\s*layer=/.test(lines[i])) layerIndexes.push(i);
          }
          if (fromIndex > layerIndexes.length || toIndex > layerIndexes.length) {
            throw new Error(`layer index out of range for ${groupFile}`);
          }
          if (fromIndex === toIndex) {
            return {ok: true, groupFile, path: targetPath, count: layerIndexes.length};
          }
          const orderedLayers = layerIndexes.map(idx => lines[idx]);
          const [moved] = orderedLayers.splice(fromIndex - 1, 1);
          orderedLayers.splice(toIndex - 1, 0, moved);
          layerIndexes.forEach((lineIndex, i) => {
            lines[lineIndex] = orderedLayers[i];
          });
          await fs.writeFile(targetPath, lines.join('\n'));
          return {ok: true, groupFile, path: targetPath, count: orderedLayers.length};
        }
        case 'kitowall_kitsune_group_files_list': {
          const groupsDirs = await resolveKitsuneGroupsDirs();
          const itemSet = new Set();
          for (const groupsDir of groupsDirs) {
            let entries = [];
            try {
              entries = await fs.readdir(groupsDir, {withFileTypes: true});
            } catch {
              continue;
            }
            for (const entry of entries) {
              if (entry.isFile() && entry.name.endsWith('.group')) {
                itemSet.add(entry.name);
              }
            }
          }
          const items = [...itemSet].sort((a, b) => a.localeCompare(b));
          return {ok: true, path: groupsDirs[0], items, paths: groupsDirs};
        }
        case 'kitowall_kitsune_group_layers_read': {
          const groupFile = cleanString(args.groupFile);
          if (!groupFile) throw new Error('groupFile is required');
          const targetPath = await resolveKitsuneGroupFilePath(groupFile);
          const raw = await fs.readFile(targetPath, 'utf8');
          const lines = raw.split('\n');
          const items = [];
          let idx = 0;
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            if (!trimmed.startsWith('layer=')) continue;
            idx += 1;
            items.push(`${idx}: ${trimmed}`);
          }
          return {ok: true, groupFile, path: targetPath, stdout: items.join('\n')};
        }
        case 'kitowall_kitsune_group_import': {
          const targetDir = await resolveKitsuneGroupsDir();
          await fs.mkdir(targetDir, {recursive: true});
          const result = await dialog.showOpenDialog(win, {
            properties: ['openFile'],
            filters: [{name: 'Kitsune Groups', extensions: ['group']}]
          });
          if (result.canceled || !result.filePaths?.[0]) {
            return {ok: false, canceled: true};
          }
          const sourcePath = result.filePaths[0];
          const fileName = normalizeGroupFileNameValue(path.basename(sourcePath));
          if (!fileName) throw new Error('invalid group file');
          const targetPath = path.join(targetDir, fileName);
          await fs.copyFile(sourcePath, targetPath);
          return {ok: true, canceled: false, groupFile: fileName, path: targetPath, sourcePath};
        }
        case 'kitowall_kitsune_group_export': {
          const groupFile = cleanString(args.groupFile);
          if (!groupFile) throw new Error('groupFile is required');
          const sourcePath = await resolveKitsuneGroupFilePath(groupFile);
          const defaultName = normalizeGroupFileNameValue(path.basename(sourcePath));
          const result = await dialog.showSaveDialog(win, {
            defaultPath: defaultName,
            filters: [{name: 'Kitsune Groups', extensions: ['group']}]
          });
          if (result.canceled || !result.filePath) {
            return {ok: false, canceled: true};
          }
          let targetPath = result.filePath;
          if (!targetPath.endsWith('.group')) {
            targetPath = `${targetPath}.group`;
          }
          await fs.copyFile(sourcePath, targetPath);
          return {ok: true, canceled: false, groupFile: defaultName, path: targetPath, sourcePath};
        }
        case 'kitowall_kitsune_group_duplicate': {
          const groupFile = cleanString(args.groupFile);
          const targetName = normalizeGroupFileNameValue(args.targetName);
          if (!groupFile || !targetName) throw new Error('groupFile and targetName are required');
          const sourcePath = await resolveKitsuneGroupFilePath(groupFile);
          const targetDir = await resolveKitsuneGroupsDir();
          await fs.mkdir(targetDir, {recursive: true});
          const targetPath = path.join(targetDir, targetName);
          await fs.copyFile(sourcePath, targetPath);
          return {ok: true, groupFile: targetName, path: targetPath, sourcePath};
        }
        case 'kitowall_kitsune_group_rename': {
          const groupFile = cleanString(args.groupFile);
          const targetName = normalizeGroupFileNameValue(args.targetName);
          if (!groupFile || !targetName) throw new Error('groupFile and targetName are required');
          const sourcePath = await resolveKitsuneGroupFilePath(groupFile);
          const targetDir = await resolveKitsuneGroupsDir();
          await fs.mkdir(targetDir, {recursive: true});
          const targetPath = path.join(targetDir, targetName);
          await fs.copyFile(sourcePath, targetPath);
          await fs.unlink(sourcePath);
          return {ok: true, groupFile: targetName, path: targetPath, sourcePath};
        }
        case 'kitowall_kitsune_group_delete': {
          const groupFile = cleanString(args.groupFile);
          if (!groupFile) throw new Error('groupFile is required');
          const sourcePath = await resolveKitsuneGroupFilePath(groupFile);
          await fs.unlink(sourcePath);
          return {ok: true, groupFile, path: sourcePath};
        }
        case 'kitowall_kitsune_run': {
          const cmdArgs = Array.isArray(args.args) ? args.args.map(String) : [];
          if (cmdArgs.length === 0) throw new Error('kitsune args are required');
          appendKitsuneUiLog(`kitowall_kitsune_run: begin args=${JSON.stringify(cmdArgs)}`);
          if (cmdArgs[0] === 'install' && cmdArgs.includes('--install-packages')) {
            appendKitsuneUiLog('kitowall_kitsune_run: invoking privileged bootstrap-system before install --install-packages');
            const privileged = await runPrivilegedSystemBootstrap();
            if (!privileged.ok) {
              return {
                ok: false,
                exitCode: privileged.code,
                stdout: '',
                stderr: privileged.logs || 'privileged bootstrap failed',
                args: cmdArgs
              };
            }
            const filteredArgs = cmdArgs.filter(arg => arg !== '--install-packages');
            const {base, prefixArgs, cwd} = await resolveKitsuneCmd();
            const out = await runProcess(base, [...prefixArgs, ...filteredArgs], {
              env: await hostAwareEnv(),
              cwd,
              allowNonZero: true
            });
            return {
              ok: out.code === 0,
              exitCode: out.code,
              stdout: `${privileged.logs}${out.stdout}`,
              stderr: out.stderr,
              args: filteredArgs
            };
          }
          const {base, prefixArgs, cwd} = await resolveKitsuneCmd();
          const out = await runProcess(base, [...prefixArgs, ...cmdArgs], {
            env: await hostAwareEnv(),
            cwd,
            allowNonZero: true
          });
          return {ok: out.code === 0, exitCode: out.code, stdout: out.stdout, stderr: out.stderr, args: cmdArgs};
        }
        case 'kitowall_live_run': {
          const cmdArgs = Array.isArray(args.args) ? args.args.map(String) : [];
          if (cmdArgs.length === 0) throw new Error('live args are required');
          return await runKitowall(['live', ...cmdArgs]);
        }
        case 'kitowall_open_path': {
          const target = String(args.path);
          await shell.openPath(target);
          return {ok: true, path: target};
        }
        case 'kitowall_open_url': {
          const url = cleanString(args.url);
          if (!/^https?:\/\//i.test(url || '')) throw new Error(`Unsupported url: ${url}`);
          await shell.openExternal(url);
          return {ok: true, url};
        }
        case 'kitowall_we_search': {
          const full = ['we', 'search'];
          for (const [key, flag] of Object.entries({text: '--text', tags: '--tags', sort: '--sort'})) {
            if (cleanString(args[key])) full.push(flag, cleanString(args[key]));
          }
          if (args.page != null) full.push('--page', String(args.page));
          if (args.pageSize != null) full.push('--page-size', String(args.pageSize));
          if (args.days != null) full.push('--days', String(args.days));
          if (args.fixtures) full.push('--fixtures');
          return await runKitowall(full);
        }
        case 'kitowall_we_details': {
          const id = cleanString(args.publishedfileid);
          if (!id) throw new Error('publishedfileid is required');
          const full = ['we', 'details', id];
          if (args.fixtures) full.push('--fixtures');
          return await runKitowall(full);
        }
        case 'kitowall_we_download': {
          const id = cleanString(args.publishedfileid);
          if (!id) throw new Error('publishedfileid is required');
          const full = ['we', 'download', id];
          for (const [key, flag] of Object.entries({
            targetDir: '--target-dir',
            steamUser: '--steam-user',
            steamPasswordEnv: '--steam-pass-env',
            steamGuard: '--steam-guard'
          })) {
            if (cleanString(args[key])) full.push(flag, cleanString(args[key]));
          }
          if (args.coexist) full.push('--coexist');
          return await runKitowall(full);
        }
        case 'kitowall_we_job':
          return await runKitowall(['we', 'job', String(args.jobId ?? args.job_id)]);
        case 'kitowall_we_jobs': {
          const full = ['we', 'jobs'];
          if (args.limit != null) full.push('--limit', String(args.limit));
          return await runKitowall(full);
        }
        case 'kitowall_we_library':
          return await runKitowall(['we', 'library']);
        case 'kitowall_we_coexist_enter':
          return await runKitowall(['we', 'coexist', 'enter']);
        case 'kitowall_we_coexist_exit':
          return await runKitowall(['we', 'coexist', 'exit']);
        case 'kitowall_we_coexist_status':
          return await runKitowall(['we', 'coexist', 'status']);
        case 'kitowall_we_set_api_key': {
          const key = cleanString(args.apiKey ?? args.api_key);
          if (!key) throw new Error('api_key is required');
          return await runKitowall(['we', 'config', 'set-api-key', key]);
        }
        case 'kitowall_we_get_steam_roots':
          return await runKitowall(['we', 'config', 'get-steam-roots']);
        case 'kitowall_we_set_steam_roots':
          return await runKitowall(['we', 'config', 'set-steam-roots', String(args.rootsCsv ?? args.roots_csv ?? '')]);
        case 'kitowall_we_scan_steam':
          return await runKitowall(['we', 'scan-steam']);
        case 'kitowall_we_sync_steam':
          return await runKitowall(['we', 'sync-steam']);
        case 'kitowall_we_app_status':
          return await runKitowall(['we', 'app-status']);
        case 'kitowall_we_active':
          return await runKitowall(['we', 'active']);
        case 'kitowall_we_stop_all':
          return await runKitowall(['we', 'stop', '--all']);
        case 'kitowall_we_apply':
          return await runKitowall(['we', 'apply', String(args.id), '--monitor', String(args.monitor), '--backend', cleanString(args.backend) || 'auto']);
        case 'kitowall_we_apply_map':
          return await runKitowall(['we', 'apply', '--map', String(args.map), '--backend', cleanString(args.backend) || 'auto']);
        case 'kitowall_we_stop_monitor':
          return await runKitowall(['we', 'stop', '--monitor', String(args.monitor)]);
        case 'kitowall_file_data_url': {
          const filePath = cleanString(args.path);
          if (!filePath) throw new Error('path is required');
          const stat = await fs.stat(filePath);
          if (stat.size > 8 * 1024 * 1024) throw new Error('file too large for preview data url (>8MB)');
          const bytes = await fs.readFile(filePath);
          return fileToDataUrl(filePath, bytes);
        }
        default:
          throw new Error(`Unsupported command: ${command}`);
      }
    }
  };
}

export async function runTrayAction(type) {
  if (type === 'rotate-now') {
    await runKitowallRaw(['rotate-now', '--force']);
    return;
  }
  if (type === 'live-start') {
    await runKitowallRaw(['live', 'service-autostart', 'start']);
    return;
  }
  if (type === 'live-restart') {
    await runKitowallRaw(['live', 'service-autostart', 'restart']);
    return;
  }
  if (type === 'live-stop') {
    await runKitowallRaw(['live', 'service-autostart', 'stop']);
  }
}
