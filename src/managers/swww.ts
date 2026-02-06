// swww backend for per-output wallpaper application.
import {run} from '../utils/exec';
import {TransitionConfig} from '../core/config';
import {spawn} from 'node:child_process';

export interface OutputImageMap {
  output: string;
  path: string;
}
function startSwwwDaemon(namespace?: string) {
  const args = [];
  if (namespace) args.push('--namespace', namespace);

  const child = spawn('swww-daemon', args, {
    stdio: 'ignore',
    detached: true
  });

  child.unref();
}

async function ensureSwwwRunning(namespace?: string): Promise<void> {
  const q = namespace ? ['query', '--namespace', namespace] : ['query'];

  try {
    await run('swww', q);
    return;
  } catch {}

  startSwwwDaemon(namespace);

  // reintenta unas veces
  for (let i = 0; i < 10; i++) {
    try {
      await run('swww', q);
      return;
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }

  throw new Error('No se pudo iniciar swww-daemon.');
}

export async function applySwww(
    images: OutputImageMap[],
    transition: { type: string; fps: number; duration: number; angle?: number; pos?: string },
    namespace: string = 'hyprwall'
) : Promise<void> {
  await ensureSwwwRunning();
  for (const item of images) {
    const args = [
      'img',
      '--namespace', namespace,
      '-o',
      item.output,
      item.path,
      '--transition-type',
      transition.type,
      '--transition-fps',
      String(transition.fps),
      '--transition-duration',
      String(transition.duration)
    ];
    if (transition.angle !== undefined) {
      args.push('--transition-angle', String(transition.angle));
    }
    if (transition.pos) {
      args.push('--transition-pos', transition.pos);
    }

    await run('swww', args);
  }
}
