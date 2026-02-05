// Orchestrates pack selection and wallpaper application.
import {Config, PackConfig, isLocalPack} from './config';
import {State, saveState, cleanupDisconnectedOutputs, commitSelection} from './state';
import {appendHistory} from './history';
import {detectOutputs} from './outputs';
import {LocalFolderAdapter} from '../adapters/localFolder';
import {applySwww, OutputImageMap} from '../managers/swww';
import {pickImagesForOutputs} from '../adapters/selector';

export class Controller {
  private config: Config;
  private state: State;

  constructor(config: Config, state: State) {
    this.config = config;
    this.state = state;
  }

  async getOutputs(): Promise<string[]> {
    const outputs = await detectOutputs();
    return outputs.map(o => o.name);
  }

  choosePack(requested?: string): string {
    const packNames = Object.keys(this.config.packs);
    if (packNames.length === 0) throw new Error('No packs configured');

    if (requested) {
      if (!this.config.packs[requested]) throw new Error(`Pack not found: ${requested}`);
      return requested;
    }

    const idx = Math.floor(Math.random() * packNames.length);
    return packNames[idx];
  }

  // Fase 2: devolvemos un pool amplio y el selector decide (multi-monitor + cooldowns)
  private getPoolForPack(pack: PackConfig): string[] {
    if (isLocalPack(pack)) {
      const adapter = new LocalFolderAdapter({paths: pack.paths});
      return adapter.getAllImages();
    }

    throw new Error(`Pack type not implemented: ${pack.type}`);
  }

  async applyNext(
      requestedPack?: string,
      namespace: string = 'hyprwall'
  ): Promise<{pack: string; outputs: string[]; images: OutputImageMap[]}> {
    const outputs = await this.getOutputs();
    if (outputs.length === 0) throw new Error('No outputs detected');

    cleanupDisconnectedOutputs(this.state, outputs);

    const packName = this.choosePack(requestedPack);
    const pack = this.config.packs[packName];

    const pool = this.getPoolForPack(pack);
    if (pool.length === 0) throw new Error(`No images found for pack: ${packName}`);

    // Selección inteligente por output (N outputs)
    const picks = pickImagesForOutputs(outputs, pool, this.config, this.state);
    if (picks.length === 0) {
      throw new Error(`No images could be selected for outputs (pack: ${packName})`);
    }

    const outputImages: OutputImageMap[] = picks.map(p => ({
      output: p.output,
      path: p.path
    }));

    await applySwww(outputImages, this.config.transition, namespace);

    const now = Date.now();

    // Commit State B (recents + last_set + anti-growth)
    for (const item of outputImages) {
      commitSelection(this.state, item.output, item.path, now);
    }

    // Estado actual
    this.state.current_pack = packName;
    // last_outputs ya lo setea cleanupDisconnectedOutputs()
    // last_set y last_updated ya se actualizaron en commitSelection()

    saveState(this.state);

    appendHistory(
        outputImages.map(item => ({
          timestamp: now,
          pack: packName,
          output: item.output,
          path: item.path
        }))
    );

    return {pack: packName, outputs, images: outputImages};
  }
}