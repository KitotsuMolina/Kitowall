// History persistence for applied wallpapers.
import os from 'os';
import path from 'path';
import fs from 'fs';
import {readJson, writeJson} from '../utils/fs';

export interface HistoryEntry {
  timestamp: number;
  pack: string;
  output: string;
  path: string;
}

export interface HistoryState {
  entries: HistoryEntry[];
}

export function getHistoryPath(): string {
  return path.join(os.homedir(), '.local', 'state', 'kitowall', 'history.json');
}

export function loadHistory(): HistoryState {
  return readJson<HistoryState>(getHistoryPath(), {entries: []});
}

export function appendHistory(entries: HistoryEntry[]): void {
  const history = loadHistory();
  history.entries.push(...entries);
  writeJson(getHistoryPath(), history);
}

export function clearHistory(): {ok: true; removed: number} {
  const current = loadHistory();
  const removed = current.entries.length;
  const target = getHistoryPath();
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
  return {ok: true, removed};
}
