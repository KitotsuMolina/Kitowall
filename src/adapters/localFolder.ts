// Local folder adapter for image selection.
import {listImagesRecursive, shuffle} from '../utils/fs';

export interface LocalFolderOptions {
  paths: string[];
}

export class LocalFolderAdapter {
  private readonly paths: string[];

  constructor(options: LocalFolderOptions) {
    this.paths = options.paths;
  }

  /** Devuelve el pool completo (barajado) para que el selector haga su trabajo */
  getAllImages(): string[] {
    const all = listImagesRecursive(this.paths);
    if (all.length === 0) return [];
    return shuffle(all);
  }

  /** Compatibilidad: devuelve count imágenes (puede repetir si el pool es pequeño) */
  getImages(count: number): string[] {
    const shuffled = this.getAllImages();
    if (shuffled.length === 0) return [];

    if (shuffled.length >= count) return shuffled.slice(0, count);

    const results = [...shuffled];
    while (results.length < count) results.push(shuffled[results.length % shuffled.length]);
    return results;
  }
}