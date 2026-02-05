// Filesystem helpers.
import fs from 'fs';
import path from 'path';
import os from 'os';

const IMAGE_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif'
]);

export function expandTilde(inputPath: string): string {
  if (inputPath.startsWith('~/'))
    return path.join(os.homedir(), inputPath.slice(2));
  if (inputPath === '~')
    return os.homedir();
  return inputPath;
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, {recursive: true});
}

export function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath))
    return fallback;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

export function writeJson(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

export function listImagesRecursive(pathsToScan: string[]): string[] {
  const results: string[] = [];

  const walk = (currentPath: string): void => {
    if (!fs.existsSync(currentPath))
      return;

    const stat = fs.statSync(currentPath);
    if (stat.isFile()) {
      const ext = path.extname(currentPath).toLowerCase();
      if (IMAGE_EXTENSIONS.has(ext))
        results.push(currentPath);
      return;
    }

    if (!stat.isDirectory())
      return;

    const entries = fs.readdirSync(currentPath);
    for (const entry of entries) {
      const full = path.join(currentPath, entry);
      walk(full);
    }
  };

  for (const p of pathsToScan)
    walk(expandTilde(p));

  return results;
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
