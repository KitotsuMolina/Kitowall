// Shell execution wrapper.
import {spawn} from 'child_process';

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export function run(cmd: string, args: string[] = [], options: ExecOptions = {}): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const isFlatpak = Boolean(process.env.FLATPAK_ID);
    const hostCommands = new Set([
      'swww',
      'swww-daemon',
      'hyprctl',
      'systemctl',
      'which',
      'xdg-open',
      'steamcmd',
      'ffmpeg',
      'ffprobe',
      'cargo',
      'kitsune-livewallpaper',
      'dd'
    ]);
    const useHost = isFlatpak && hostCommands.has(cmd);
    const finalCmd = useHost ? 'flatpak-spawn' : cmd;
    const finalArgs = useHost ? ['--host', cmd, ...args] : args;

    const child = spawn(finalCmd, finalArgs, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill('SIGKILL');
          reject(new Error(`Command timed out: ${finalCmd}`));
        }, options.timeoutMs)
      : null;

    child.stdout.on('data', (d: Buffer) => (stdout += String(d)));
    child.stderr.on('data', (d: Buffer) => (stderr += String(d)));

    child.on('error', (err: Error) => {
      if (timeout) clearTimeout(timeout);
      reject(err);
    });

    child.on('close', (code: number | null) => {
      if (timeout) clearTimeout(timeout);
      const result: ExecResult = {stdout, stderr, code: code ?? 0};
      if (code && code !== 0) {
        const err = new Error(
          `Command failed: ${finalCmd} ${finalArgs.join(' ')}\n` +
          `exit=${code}\nstdout=${stdout.trim()}\nstderr=${stderr.trim()}`
        );
        (err as Error & {result?: ExecResult}).result = result;
        reject(err);
        return;
      }
      resolve(result);
    });
  });
}
