// Common candidate shape used by selectors and adapters.
export type WallpaperCandidate = {
  id: string;
  source: string;
  url: string;
  previewUrl?: string;
  remoteId?: string;
  width?: number;
  height?: number;
  mime?: string;
  fileExtHint?: 'jpg' | 'png' | 'webp';
  tags?: string[];
  author?: string;
  authorUrl?: string;
  pageUrl?: string;
  rating?: 'safe' | 'sketchy' | 'nsfw';
  score?: number;
  ttlSec?: number;
};
