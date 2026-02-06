// Favorites persistence for wallpapers.
import os from 'os';
import path from 'path';
import {readJson, writeJson} from '../utils/fs';

export interface FavoritesState {
  favorites: string[];
}

export function getFavoritesPath(): string {
  return path.join(os.homedir(), '.local', 'state', 'hyprwall', 'favorites.json');
}

export function loadFavorites(): FavoritesState {
  return readJson<FavoritesState>(getFavoritesPath(), {favorites: []});
}

export function listFavorites(): string[] {
  return loadFavorites().favorites;
}

export function addFavorite(pathStr: string): void {
  const state = loadFavorites();
  if (!state.favorites.includes(pathStr)) {
    state.favorites.push(pathStr);
    writeJson(getFavoritesPath(), state);
  }
}

export function removeFavorite(pathStr: string): void {
  const state = loadFavorites();
  state.favorites = state.favorites.filter(p => p !== pathStr);
  writeJson(getFavoritesPath(), state);
}
