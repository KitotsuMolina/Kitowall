// Output detection via hyprctl or swww.
import {run} from '../utils/exec';

export interface OutputInfo {
  name: string;
}

async function outputsFromHyprctl(): Promise<OutputInfo[]> {
  const result = await run('hyprctl', ['monitors', '-j']);
  const parsed = JSON.parse(result.stdout) as Array<{name: string}>;
  return parsed.map(m => ({name: m.name}));
}

async function outputsFromHyprctlInstance(instance: string): Promise<OutputInfo[]> {
  const result = await run('hyprctl', ['--instance', instance, 'monitors', '-j']);
  const parsed = JSON.parse(result.stdout) as Array<{name: string}>;
  return parsed.map(m => ({name: m.name}));
}

async function outputsFromHyprctlAnyInstance(): Promise<OutputInfo[]> {
  const instancesResult = await run('hyprctl', ['instances', '-j']);
  const instances = JSON.parse(instancesResult.stdout) as Array<{instance?: string}>;

  // Try index 0 first, then explicit signatures.
  const candidates: string[] = ['0'];
  for (const item of instances) {
    const sig = (item.instance ?? '').trim();
    if (sig)
      candidates.push(sig);
  }

  for (const candidate of candidates) {
    try {
      const outputs = await outputsFromHyprctlInstance(candidate);
      if (outputs.length > 0)
        return outputs;
    } catch {
      // continue with next candidate
    }
  }

  return [];
}

async function outputsFromSwwwQuery(): Promise<OutputInfo[]> {
  const result = await run('swww', ['query']);
  const lines = result.stdout.split('\n').map(l => l.trim()).filter(Boolean);
  const outputs: OutputInfo[] = [];
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx > 0)
      outputs.push({name: line.slice(0, idx).trim()});
  }
  return outputs;
}

export async function detectOutputs(): Promise<OutputInfo[]> {
  try {
    const outputs = await outputsFromHyprctl();
    if (outputs.length > 0)
      return outputs;
  } catch {
    // ignore and fallback
  }

  try {
    const outputs = await outputsFromHyprctlAnyInstance();
    if (outputs.length > 0)
      return outputs;
  } catch {
    // ignore and fallback
  }

  try {
    const outputs = await outputsFromSwwwQuery();
    if (outputs.length > 0)
      return outputs;
  } catch {
    // ignore
  }

  return [];
}
