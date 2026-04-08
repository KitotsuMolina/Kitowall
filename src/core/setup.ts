import {promises as fs} from 'node:fs';
import {homedir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {run} from '../utils/exec';
import {initKitowall} from './init';
import {installSystemd} from './systemd';

export type VersionUpdateInfo = {
  local_version: string | null;
  latest_version: string | null;
  update_available: boolean;
};

export type SetupItem = {
  id: string;
  label: string;
  installed: boolean;
  state: 'ok' | 'missing' | 'error';
  path?: string;
  detail?: string;
  error?: string;
  update?: VersionUpdateInfo;
};

export type SetupStatus = {
  ok: boolean;
  dependencies: SetupItem[];
  services: SetupItem[];
  counts: {
    dependencies_missing: number;
    services_missing: number;
    updates_available: number;
  };
};

export type SetupActionResult = {
  ok: boolean;
  code: number;
  logs: string;
};

type DependencyDef = {
  id: string;
  bin: string;
  label: string;
  installer: string;
  system?: boolean;
};

type ServiceDef = {
  id: string;
  label: string;
  installer: string;
};

const ROOT_DIR = resolve(__dirname, '..', '..');
const RELEASE_CACHE = new Map<string, {at: number; value: string | null}>();

export const HOST_DEPENDENCY_DEFS: DependencyDef[] = [
  {id: 'kitowall', bin: 'kitowall', label: 'Kitowall CLI', installer: 'kitowall-only'},
  {id: 'kitsune', bin: 'kitsune', label: 'Kitsune', installer: 'kitsune-only'},
  {id: 'kitsune-rendercore', bin: 'kitsune-rendercore', label: 'Kitsune RenderCore', installer: 'kitsune-only'},
  {id: 'awww', bin: 'awww', label: 'awww', installer: 'awww', system: true},
  {id: 'awww-daemon', bin: 'awww-daemon', label: 'awww-daemon', installer: 'awww-daemon', system: true},
  {id: 'hyprctl', bin: 'hyprctl', label: 'hyprctl', installer: 'hyprctl', system: true},
  {id: 'cava', bin: 'cava', label: 'cava', installer: 'cava', system: true}
];

export const HOST_SERVICE_DEFS: ServiceDef[] = [
  {id: 'kitowall-config', label: 'Kitowall config', installer: 'kitowall-config'},
  {id: 'kitowall-next.timer', label: 'kitowall-next.timer', installer: 'kitowall-next.timer'},
  {id: 'kitsune-rendercore.service', label: 'kitsune-rendercore.service', installer: 'kitsune-rendercore.service'}
];

function homeDir(): string {
  return process.env.HOME || homedir();
}

function normalizeSetupDependencyId(id: string): string {
  if (id === 'swww') return 'awww';
  if (id === 'swww-daemon') return 'awww-daemon';
  return id;
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function normalizeReleaseVersion(input: string | null | undefined): string {
  return String(input ?? '').trim().replace(/^v/, '');
}

function uniqueEntries(values: string[]): string[] {
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function hostPathEntries(): string[] {
  const home = homeDir();
  return uniqueEntries([
    join(home, '.local', 'bin'),
    join(home, '.npm-global', 'bin'),
    join(home, '.cargo', 'bin'),
    ...(process.env.PATH ? process.env.PATH.split(':') : []),
    '/usr/local/bin',
    '/usr/bin',
    '/bin'
  ]);
}

async function resolveBinFromPathEntries(bin: string): Promise<string> {
  for (const dir of hostPathEntries()) {
    const candidate = join(dir, bin);
    if (await fileExists(candidate)) return candidate;
  }
  return '';
}

async function collectNpmPrefixBinDirs(): Promise<string[]> {
  const dirs: string[] = [];
  const home = homeDir();
  for (const args of [
    ['config', 'get', 'prefix'],
    ['prefix', '-g']
  ]) {
    try {
      const out = await run('npm', args, {
        env: {
          ...process.env,
          HOME: home,
          PATH: hostPathEntries().join(':')
        },
        timeoutMs: 1500
      });
      const prefix = out.stdout.trim();
      if (!prefix || prefix === 'undefined' || prefix === 'null') continue;
      const candidate = join(prefix, 'bin');
      if (await fileExists(candidate)) {
        dirs.push(candidate);
        continue;
      }
      if (await fileExists(prefix)) dirs.push(prefix);
    } catch {
      // ignore
    }
  }
  return uniqueEntries(dirs);
}

export async function resolveHostBinPath(bin: string): Promise<string> {
  const home = homeDir();
  const fallback = {
    kitowall: [
      join(home, '.local', 'bin', 'kitowall'),
      join(home, '.npm-global', 'bin', 'kitowall'),
      join(home, 'node_modules', '.bin', 'kitowall')
    ],
    kitsune: [
      join(home, '.cargo', 'bin', 'kitsune'),
      join(home, '.local', 'bin', 'kitsune'),
      join(home, '.local', 'share', 'kitsune', 'bin', 'kitsune')
    ],
    'kitsune-rendercore': [
      join(home, '.cargo', 'bin', 'kitsune-rendercore'),
      join(home, '.local', 'bin', 'kitsune-rendercore')
    ]
  }[bin] ?? [join(home, '.local', 'bin', bin)];

  for (const candidate of fallback) {
    if (await fileExists(candidate)) return candidate;
  }

  const byPath = await resolveBinFromPathEntries(bin);
  if (byPath) return byPath;

  if (bin === 'kitowall') {
    for (const dir of await collectNpmPrefixBinDirs()) {
      const candidate = join(dir, bin);
      if (await fileExists(candidate)) return candidate;
    }
  }

  return '';
}

function bootstrapHostPath(): string {
  return join(ROOT_DIR, 'scripts', 'bootstrap-host.sh');
}

function bootstrapSystemPath(): string {
  return join(ROOT_DIR, 'scripts', 'bootstrap-system.sh');
}

async function assertBootstrapScriptExists(targetPath: string, label: string): Promise<void> {
  if (await fileExists(targetPath)) return;
  throw new Error(
    `${label} not found at ${targetPath}. Reinstala el CLI con: npm i -g --prefix ~/.local kitowall@latest`
  );
}

async function bootstrapVersionsPath(): Promise<string> {
  return join(homeDir(), '.local', 'share', 'kitowall', 'bootstrap-versions.json');
}

async function readBootstrapVersion(component: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(await bootstrapVersionsPath(), 'utf8');
    const data = JSON.parse(raw) as Record<string, {version?: string}>;
    const version = String(data?.[component]?.version ?? '').trim();
    return version || null;
  } catch {
    return null;
  }
}

async function readCliVersion(binPath: string): Promise<string | null> {
  try {
    const realPath = await fs.realpath(binPath);
    const pkgPath = join(dirname(realPath), '..', 'package.json');
    const raw = await fs.readFile(pkgPath, 'utf8');
    const parsed = JSON.parse(raw) as {version?: string};
    const value = normalizeReleaseVersion(parsed.version ?? '');
    if (value) return value;
  } catch {
    // fallback to executing the bin
  }

  try {
    const out = await run(binPath, ['--version'], {
      env: {
        ...process.env,
        HOME: homeDir(),
        PATH: hostPathEntries().join(':')
      },
      timeoutMs: 1500
    });
    const value = normalizeReleaseVersion(out.stdout.trim());
    return value || null;
  } catch {
    return null;
  }
}

async function githubLatestReleaseTag(repo: string): Promise<string | null> {
  const cached = RELEASE_CACHE.get(repo);
  if (cached && Date.now() - cached.at < 300000) return cached.value;

  try {
    const out = await run(
      'curl',
      ['-fsSL', '--connect-timeout', '1', '--max-time', '2', '-H', 'User-Agent: kitowall-cli', `https://api.github.com/repos/${repo}/releases/latest`],
      {
        env: {
          ...process.env,
          HOME: homeDir(),
          PATH: hostPathEntries().join(':')
        },
        timeoutMs: 2500
      }
    );
    const data = JSON.parse(out.stdout) as {tag_name?: string};
    const value = normalizeReleaseVersion(data?.tag_name ?? '') || null;
    RELEASE_CACHE.set(repo, {at: Date.now(), value});
    return value;
  } catch {
    RELEASE_CACHE.set(repo, {at: Date.now(), value: null});
    return null;
  }
}

async function componentUpdateInfo(id: string, binPath = ''): Promise<VersionUpdateInfo> {
  const repo = {
    kitowall: 'KitotsuMolina/Kitowall',
    kitsune: 'KitotsuMolina/Kitsune',
    'kitsune-rendercore': 'KitotsuMolina/Kitsune-RenderCore'
  }[id];

  let localVersion: string | null = null;
  if (id === 'kitowall' && binPath) {
    localVersion = await readCliVersion(binPath);
  } else {
    localVersion = await readBootstrapVersion(id);
  }

  const latestVersion = repo ? await githubLatestReleaseTag(repo) : null;
  return {
    local_version: localVersion,
    latest_version: latestVersion,
    update_available: !!(localVersion && latestVersion && localVersion !== latestVersion)
  };
}

async function maybeSystemctlShow(unit: string, props: string[]): Promise<Record<string, string> | null> {
  try {
    const args = ['--user', 'show', unit, '--no-pager'];
    for (const prop of props) args.push('-p', prop);
    const out = await run('systemctl', args, {
      env: {
        ...process.env,
        HOME: homeDir(),
        PATH: hostPathEntries().join(':')
      },
      timeoutMs: 1500
    });
    const result: Record<string, string> = {};
    for (const line of out.stdout.split('\n')) {
      const idx = line.indexOf('=');
      if (idx > -1) result[line.slice(0, idx)] = line.slice(idx + 1);
    }
    return result;
  } catch {
    return null;
  }
}

export async function checkSetupDependency(id: string): Promise<SetupItem> {
  const def = HOST_DEPENDENCY_DEFS.find(item => item.id === normalizeSetupDependencyId(id));
  if (!def) throw new Error(`Unknown dependency id: ${id}`);

  let binPath = '';
  let error = '';
  try {
    binPath = await resolveHostBinPath(def.bin);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  let update: VersionUpdateInfo = {local_version: null, latest_version: null, update_available: false};
  try {
    if (def.id === 'kitowall' || def.id === 'kitsune' || def.id === 'kitsune-rendercore') {
      update = await componentUpdateInfo(def.id, binPath);
    }
  } catch (err) {
    if (!error) error = err instanceof Error ? err.message : String(err);
  }

  return {
    id: def.id,
    label: def.label,
    installed: !!binPath,
    state: binPath ? 'ok' : error ? 'error' : 'missing',
    path: binPath,
    detail: binPath ? `path=${binPath}` : 'binary not found',
    error,
    update
  };
}

export async function checkSetupService(id: string, namespace = 'kitowall'): Promise<SetupItem> {
  const def = HOST_SERVICE_DEFS.find(item => item.id === id);
  if (!def) throw new Error(`Unknown service id: ${id}`);

  const home = homeDir();
  const configPath = join(home, '.config', 'kitowall', 'config.json');
  const timerUnitPath = join(home, '.config', 'systemd', 'user', 'kitowall-next.timer');
  const rendercoreUnitPath = join(home, '.config', 'systemd', 'user', 'kitsune-rendercore.service');

  if (id === 'kitowall-config') {
    const installed = await fileExists(configPath);
    return {
      id,
      label: def.label,
      installed,
      state: installed ? 'ok' : 'missing',
      path: configPath,
      detail: installed ? `namespace=${namespace}` : 'config.json missing',
      error: ''
    };
  }

  if (id === 'kitowall-next.timer') {
    const installed = await fileExists(timerUnitPath);
    const status = installed ? await maybeSystemctlShow('kitowall-next.timer', ['ActiveState', 'UnitFileState']) : null;
    return {
      id,
      label: def.label,
      installed,
      state: installed ? 'ok' : 'missing',
      path: timerUnitPath,
      detail: installed
        ? (status
            ? `file=${timerUnitPath} active=${String(status.ActiveState ?? 'n/a')} unit=${String(status.UnitFileState ?? 'n/a')}`
            : `file=${timerUnitPath} status=unavailable`)
        : 'timer unit file missing',
      error: ''
    };
  }

  if (id === 'kitsune-rendercore.service') {
    const installed = await fileExists(rendercoreUnitPath);
    const status = installed ? await maybeSystemctlShow('kitsune-rendercore.service', ['ActiveState', 'UnitFileState']) : null;
    return {
      id,
      label: def.label,
      installed,
      state: installed ? 'ok' : 'missing',
      path: rendercoreUnitPath,
      detail: installed
        ? (status
            ? `file=${rendercoreUnitPath} active=${String(status.ActiveState ?? 'n/a')} unit=${String(status.UnitFileState ?? 'n/a')}`
            : `file=${rendercoreUnitPath} status=unavailable`)
        : 'service unit file missing',
      error: ''
    };
  }

  throw new Error(`Unknown service id: ${id}`);
}

export async function listSetupStatus(namespace = 'kitowall'): Promise<SetupStatus> {
  const [dependencies, services] = await Promise.all([
    Promise.all(HOST_DEPENDENCY_DEFS.map(item => checkSetupDependency(item.id))),
    Promise.all(HOST_SERVICE_DEFS.map(item => checkSetupService(item.id, namespace)))
  ]);

  return {
    ok: dependencies.every(item => item.installed) && services.every(item => item.installed),
    dependencies,
    services,
    counts: {
      dependencies_missing: dependencies.filter(item => !item.installed).length,
      services_missing: services.filter(item => !item.installed).length,
      updates_available: dependencies.filter(item => item.update?.update_available === true).length
    }
  };
}

export async function listSetupVersions(): Promise<{ok: true; items: Record<string, VersionUpdateInfo>}> {
  const items: Record<string, VersionUpdateInfo> = {};
  for (const id of ['kitowall', 'kitsune', 'kitsune-rendercore']) {
    const dep = await checkSetupDependency(id);
    items[id] = dep.update ?? {local_version: null, latest_version: null, update_available: false};
  }
  return {ok: true, items};
}

async function runBootstrapHostMode(mode: string): Promise<SetupActionResult> {
  const scriptPath = bootstrapHostPath();
  await assertBootstrapScriptExists(scriptPath, 'bootstrap-host.sh');
  const out = await run('bash', [scriptPath], {
    env: {
      ...process.env,
      HOME: homeDir(),
      PATH: hostPathEntries().join(':'),
      KITOWALL_SKIP_SYSTEM_DEPS: '1',
      KITOWALL_BOOTSTRAP_MODE: mode
    }
  });
  return {ok: true, code: out.code, logs: `${out.stdout}${out.stderr}`};
}

async function runBootstrapSystemItems(ids: string[]): Promise<SetupActionResult> {
  const scriptPath = bootstrapSystemPath();
  await assertBootstrapScriptExists(scriptPath, 'bootstrap-system.sh');
  const out = await run('pkexec', ['bash', scriptPath, ...ids], {
    env: {
      ...process.env,
      HOME: homeDir(),
      PATH: hostPathEntries().join(':')
    }
  });
  return {ok: true, code: out.code, logs: `${out.stdout}${out.stderr}`};
}

export async function installSetupItem(id: string, namespace = 'kitowall'): Promise<SetupActionResult> {
  const normalizedId = normalizeSetupDependencyId(id);
  const dep = HOST_DEPENDENCY_DEFS.find(item => item.id === normalizedId);
  if (dep?.system) return await runBootstrapSystemItems([normalizedId]);
  if (normalizedId === 'kitowall') return await runBootstrapHostMode('kitowall-only');
  if (normalizedId === 'kitsune' || normalizedId === 'kitsune-rendercore' || normalizedId === 'kitsune-rendercore.service') {
    return await runBootstrapHostMode('kitsune-only');
  }
  if (normalizedId === 'kitowall-config') {
    await initKitowall({namespace, apply: true, force: true});
    return {ok: true, code: 0, logs: JSON.stringify({ok: true, init: true, namespace}, null, 2)};
  }
  if (normalizedId === 'kitowall-next.timer') {
    await installSystemd({every: '600s'});
    return {ok: true, code: 0, logs: JSON.stringify({ok: true, installed: true, every: '600s'}, null, 2)};
  }
  throw new Error(`Unsupported setup item: ${id}`);
}

async function rmIfExists(targetPath: string, logs: string[]): Promise<void> {
  if (!(await fileExists(targetPath))) return;
  await fs.rm(targetPath, {recursive: true, force: true});
  logs.push(`[removed] ${targetPath}`);
}

async function runSystemctlUserBestEffort(args: string[], logs: string[]): Promise<void> {
  try {
    await run('systemctl', ['--user', ...args], {
      env: {
        ...process.env,
        HOME: homeDir(),
        PATH: hostPathEntries().join(':')
      },
      timeoutMs: 4000
    });
    logs.push(`[systemctl] ${args.join(' ')}`);
  } catch (err) {
    logs.push(`[systemctl-warn] ${args.join(' ')} :: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export async function purgeSetup(namespace = 'kitowall'): Promise<SetupActionResult> {
  const home = homeDir();
  const logs: string[] = [];
  const removeTargets = [
    join(home, '.config', 'kitowall'),
    join(home, '.local', 'share', 'kitowall'),
    join(home, '.local', 'state', 'kitowall'),
    join(home, '.config', 'kitsune'),
    join(home, '.local', 'share', 'kitsune'),
    join(home, '.local', 'state', 'kitsune'),
    join(home, '.config', 'kitsune-rendercore'),
    join(home, '.local', 'lib', 'node_modules', 'kitowall'),
    join(home, '.npm-global', 'lib', 'node_modules', 'kitowall')
  ];
  const removeFiles = [
    join(home, '.local', 'bin', 'kitowall'),
    join(home, '.local', 'bin', 'kitsune'),
    join(home, '.local', 'bin', 'kitsune-overlay'),
    join(home, '.local', 'bin', 'kitsune-color-resolve'),
    join(home, '.local', 'bin', 'kitsune-rendercore'),
    join(home, '.cargo', 'bin', 'kitsune'),
    join(home, '.cargo', 'bin', 'kitsune-overlay'),
    join(home, '.cargo', 'bin', 'kitsune-color-resolve'),
    join(home, '.cargo', 'bin', 'kitsune-rendercore'),
    join(home, '.config', 'systemd', 'user', 'kitowall-next.service'),
    join(home, '.config', 'systemd', 'user', 'kitowall-next.timer'),
    join(home, '.config', 'systemd', 'user', 'kitowall-watch.service'),
    join(home, '.config', 'systemd', 'user', 'kitowall-login-apply.service'),
    join(home, '.config', 'systemd', 'user', 'kitsune-rendercore.service'),
    join(home, '.config', 'systemd', 'user', 'awww-daemon@.service'),
    join(home, '.config', 'systemd', 'user', 'swww-daemon@.service')
  ];

  logs.push(`[purge] namespace=${namespace}`);
  await runSystemctlUserBestEffort(['disable', '--now', `awww-daemon@${namespace}.service`], logs);
  await runSystemctlUserBestEffort(['disable', '--now', `swww-daemon@${namespace}.service`], logs);
  await runSystemctlUserBestEffort(['disable', '--now', 'kitowall-next.timer'], logs);
  await runSystemctlUserBestEffort(['stop', 'kitowall-next.service'], logs);
  await runSystemctlUserBestEffort(['disable', '--now', 'kitowall-watch.service'], logs);
  await runSystemctlUserBestEffort(['disable', '--now', 'kitowall-login-apply.service'], logs);
  await runSystemctlUserBestEffort(['disable', '--now', 'kitsune-rendercore.service'], logs);
  await runSystemctlUserBestEffort(['daemon-reload'], logs);
  await runSystemctlUserBestEffort(['reset-failed', `awww-daemon@${namespace}.service`, `swww-daemon@${namespace}.service`, 'kitowall-next.service', 'kitowall-next.timer', 'kitowall-watch.service', 'kitowall-login-apply.service', 'kitsune-rendercore.service'], logs);

  for (const targetPath of removeFiles) {
    await rmIfExists(targetPath, logs);
  }
  for (const targetPath of removeTargets) {
    await rmIfExists(targetPath, logs);
  }

  logs.push('[ok] purge complete');
  return {ok: true, code: 0, logs: `${logs.join('\n')}\n`};
}
