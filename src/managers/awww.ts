import {spawn} from 'node:child_process';
import {run} from '../utils/exec';
import {TransitionConfig} from '../core/config';
import {OutputImageMap} from './types';

function startAwwwDaemon(namespace?: string) {
  const args = ['--layer', 'background'];
  if (namespace) args.push('--namespace', namespace);
  const child = spawn('awww-daemon', args, {
    stdio: 'ignore',
    detached: true
  });
  child.on('error', () => {});
  child.unref();
}

async function ensureAwwwRunning(namespace?: string): Promise<void> {
  const q = ['query', '--json'];
  if (namespace) q.push('--namespace', namespace);

  try {
    await run('awww', q);
    return;
  } catch {}

  startAwwwDaemon(namespace);

  for (let i = 0; i < 10; i++) {
    try {
      await run('awww', q);
      return;
    } catch {}
    await new Promise(r => setTimeout(r, 150));
  }

  throw new Error('No se pudo iniciar awww-daemon.');
}

export async function applyAwww(
  images: OutputImageMap[],
  transition: TransitionConfig,
  namespace: string = 'kitowall'
): Promise<void> {
  await ensureAwwwRunning(namespace);
  for (const item of images) {
    const args = [
      'img',
      '--namespace', namespace,
      '--outputs', item.output,
      item.path,
      '--transition-type', transition.type,
      '--transition-fps', String(transition.fps),
      '--transition-duration', String(transition.duration)
    ];
    if (transition.angle !== undefined) args.push('--transition-angle', String(transition.angle));
    if (transition.pos) args.push('--transition-pos', transition.pos);
    await run('awww', args);
  }
}
