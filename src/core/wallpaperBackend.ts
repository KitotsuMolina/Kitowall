import {Config} from './config';
import {run} from '../utils/exec';
import {applyAwww} from '../managers/awww';
import {applySwww} from '../managers/swww';
import {OutputImageMap} from '../managers/types';

export type WallpaperBackendName = 'awww' | 'swww';

export type WallpaperBackendInfo = {
  name: WallpaperBackendName;
  bin: string;
  daemonBin: string;
  daemonUnitBase: string;
  packageName: string;
  queryArgs: string[];
};

export function wallpaperBackendInfo(name: WallpaperBackendName): WallpaperBackendInfo {
  if (name === 'awww') {
    return {
      name,
      bin: 'awww',
      daemonBin: 'awww-daemon',
      daemonUnitBase: 'awww-daemon',
      packageName: 'awww',
      queryArgs: ['query', '--json']
    };
  }
  return {
    name,
    bin: 'swww',
    daemonBin: 'swww-daemon',
    daemonUnitBase: 'swww-daemon',
    packageName: 'swww',
    queryArgs: ['query']
  };
}

export async function hostCmdExists(cmd: string): Promise<boolean> {
  try {
    await run('which', [cmd], {timeoutMs: 1500});
    return true;
  } catch {
    return false;
  }
}

export async function resolveWallpaperBackend(
  config?: Pick<Config, 'wallpaper_backend'>
): Promise<WallpaperBackendName> {
  const preferred = config?.wallpaper_backend ?? 'auto';
  if (preferred === 'awww' || preferred === 'swww') return preferred;
  if (await hostCmdExists('awww')) return 'awww';
  if (await hostCmdExists('swww')) return 'swww';
  return 'awww';
}

export async function applyWallpaperBackend(
  config: Pick<Config, 'transition' | 'wallpaper_backend'>,
  images: OutputImageMap[],
  namespace = 'kitowall'
): Promise<WallpaperBackendName> {
  const backend = await resolveWallpaperBackend(config);
  if (backend === 'awww') {
    await applyAwww(images, config.transition, namespace);
  } else {
    await applySwww(images, config.transition, namespace);
  }
  return backend;
}
