# Hyprwall Config Examples

This file documents strict validation expectations and API key priority for pack types.

## API Key Priority
For providers that require a key (`wallhaven`, `unsplash`):
1. `apiKey` (explicit value in config)
2. `apiKeyEnv` (environment variable lookup)

If neither is provided or resolves to an empty value, the pack is considered invalid and is ignored.

## Download Location (Pack Folders)
Remote downloads are stored under `cache.downloadDir/<pack>`.\nBy default:\n`~/Pictures/Wallpapers/<pack>`

## Example: Pool of Sources (weights)
```json
{
  "pool": {
    "enabled": true,
    "sources": [
      { "name": "sao", "weight": 2 },
      { "name": "wallhaven_sao", "weight": 1 },
      { "name": "reddit_wallpapers", "weight": 1 }
    ]
  }
}
```

---

## Example: Local Packs
```json
{
  "packs": {
    "sao": { "type": "local", "paths": ["~/Pictures/Wallpapers/SAO"] },
    "edgerunners": { "type": "local", "paths": ["~/Pictures/Wallpapers/Edgerunners"] }
  }
}
```

## Example: Wallhaven (API Key Required)
```json
{
  "packs": {
    "wallhaven_sao": {
      "type": "wallhaven",
      "apiKeyEnv": "WALLHAVEN_KEY",
      "keyword": "sao",
      "categories": "111",
      "purity": "100",
      "ratios": ["16x9"],
      "atleast": "1920x1080",
      "sorting": "random",
      "aiArt": false
    }
  }
}
```

## Example: Unsplash (API Key Required)
```json
{
  "packs": {
    "unsplash_cyberpunk": {
      "type": "unsplash",
      "apiKeyEnv": "UNSPLASH_KEY",
      "query": "cyberpunk",
      "orientation": "landscape",
      "contentFilter": "high",
      "imageWidth": 1920,
      "imageHeight": 1080,
      "imageFit": "crop",
      "imageQuality": 80
    }
  }
}
```

## Example: Reddit
```json
{
  "packs": {
    "reddit_wallpapers": {
      "type": "reddit",
      "subreddits": ["wallpapers", "animewallpaper"],
      "allowSfw": true,
      "minWidth": 1920,
      "minHeight": 1080,
      "ratioW": 16,
      "ratioH": 9
    }
  }
}
```

## Example: Generic JSON
```json
{
  "packs": {
    "nasa_apod": {
      "type": "generic_json",
      "endpoint": "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY",
      "imagePath": "$.hdurl",
      "postPath": "$.url",
      "authorNamePath": "$.copyright",
      "domain": "https://api.nasa.gov"
    }
  }
}
```

## Example: Static URL
```json
{
  "packs": {
    "static_banner": {
      "type": "static_url",
      "url": "https://example.com/wallpaper.jpg",
      "authorName": "Studio X",
      "domain": "https://example.com"
    }
  }
}
```

## Example: Transition Settings
```json
{
  "transition": {
    "type": "wipe",
    "fps": 60,
    "duration": 0.7,
    "angle": 45,
    "pos": "0.5,0.5"
  }
}
```

---

## Validation Summary (Strict)
- `local`: requires non-empty `paths` array.
- `static_url`: requires `url`.
- `generic_json`: requires `endpoint` + `imagePath`.
- `wallhaven`: requires API key (via `apiKey` or `apiKeyEnv`).
- `unsplash`: requires API key (via `apiKey` or `apiKeyEnv`).
- `reddit`: requires `subreddits` (string or array).

Invalid packs are ignored and will not be used for selection.

## Example: Generic JSON with candidateLimit
```json
{
  "packs": {
    "earth_view": {
      "type": "generic_json",
      "endpoint": "https://example.com/api/images",
      "imagePath": "$.images[@random].url",
      "imagePrefix": "",
      "candidateLimit": 40
    }
  }
}
```

## Example: Reddit
```json
{
  "packs": {
    "reddit_wallpapers": {
      "type": "reddit",
      "subreddits": ["wallpapers", "animewallpaper"],
      "allowSfw": true,
      "minWidth": 1920,
      "minHeight": 1080,
      "ratioW": 16,
      "ratioH": 9
    }
  }
}
```

## Example: Wallhaven (Pulido)
```json
{
  "packs": {
    "wallhaven_sao": {
      "type": "wallhaven",
      "apiKeyEnv": "WALLHAVEN_KEY",
      "keyword": "sao",
      "categories": "111",
      "purity": "100",
      "ratios": ["16x9"],
      "atleast": "1920x1080",
      "sorting": "random",
      "colors": "",
      "aiArt": false
    }
  }
}
```

## Example: Unsplash
```json
{
  "packs": {
    "unsplash_cyberpunk": {
      "type": "unsplash",
      "apiKeyEnv": "UNSPLASH_KEY",
      "query": "cyberpunk",
      "orientation": "landscape",
      "contentFilter": "high",
      "imageWidth": 1920,
      "imageHeight": 1080,
      "imageFit": "crop",
      "imageQuality": 80
    }
  }
}
```

## Pool Dedupe Mode
```json
{
  "pool": {
    "enabled": true,
    "dedupe": "hash",
    "sources": [
      { "name": "sao", "weight": 2 },
      { "name": "wallhaven_sao", "weight": 1 }
    ]
  }
}
```

## Example: Static URL
```json
{
  "packs": {
    "static_banner": {
      "type": "static_url",
      "url": "https://example.com/wallpaper.jpg",
      "authorName": "Studio X",
      "authorUrl": "https://example.com",
      "domain": "https://example.com",
      "postUrl": "https://example.com/wallpaper"
    }
  }
}
```

## Static URL (differentImages)
```json
{
  "packs": {
    "static_banner": {
      "type": "static_url",
      "url": "https://example.com/wallpaper.jpg",
      "differentImages": true,
      "count": 5
    }
  }
}
```

## Static URL (lista de URLs + ttlSec)
```json
{
  "packs": {
    "static_multi": {
      "type": "static_url",
      "urls": [
        "https://example.com/a.jpg",
        "https://example.com/b.jpg"
      ],
      "differentImages": true,
      "count": 2,
      "ttlSec": 86400
    }
  }
}
```

## TTL per pack (remotos)
```json
{
  "packs": {
    "wallhaven_sao": {
      "type": "wallhaven",
      "apiKeyEnv": "WALLHAVEN_KEY",
      "keyword": "sao",
      "ttlSec": 2592000
    },
    "reddit_wallpapers": {
      "type": "reddit",
      "subreddits": ["wallpapers"],
      "ttlSec": 86400
    },
    "unsplash_cyberpunk": {
      "type": "unsplash",
      "apiKeyEnv": "UNSPLASH_KEY",
      "query": "cyberpunk",
      "ttlSec": 604800
    },
    "nasa": {
      "type": "generic_json",
      "endpoint": "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY",
      "imagePath": "$.hdurl",
      "ttlSec": 86400
    }
  }
}
```

## Pool with maxCandidates per source
```json
{
  "pool": {
    "enabled": true,
    "dedupe": "url",
    "sources": [
      { "name": "sao", "weight": 2, "maxCandidates": 200 },
      { "name": "wallhaven_sao", "weight": 1, "maxCandidates": 100 },
      { "name": "reddit_wallpapers", "weight": 1, "maxCandidates": 80 }
    ]
  }
}
```

## Pool Status (CLI)
```bash
hyprwall pool-status
```

## Pool Status (refresh)
```bash
hyprwall pool-status --refresh
```

## CLI Refresh Examples
```bash
hyprwall list-packs --refresh
hyprwall pack-status wallhaven_sao --refresh
```

## Refresh All Packs
```bash
hyprwall refresh-pack --all
```

## CLI Extras
```bash
hyprwall list-packs --only-remote
hyprwall refresh-pack --all --parallel
```

## Wallhaven con subtemas (subthemes)
```json
{
  "packs": {
    "sao": {
      "type": "wallhaven",
      "apiKeyEnv": "WALLHAVEN_KEY",
      "keyword": "sao",
      "subthemes": ["minimalista", "dark", "neon"],
      "purity": "100",
      "sorting": "random"
    }
  }
}
```
```
Nota: todas las imágenes se guardan en ~/Pictures/Wallpapers/sao/
```

## Unsplash con subtemas
```json
{
  "packs": {
    "sao": {
      "type": "unsplash",
      "apiKeyEnv": "UNSPLASH_KEY",
      "query": "sao",
      "subthemes": ["minimalista", "dark"]
    }
  }
}
```

## Reddit con subtemas
```json
{
  "packs": {
    "sao": {
      "type": "reddit",
      "subreddits": ["wallpapers", "animewallpaper"],
      "subthemes": ["minimalist", "dark"]
    }
  }
}
```

## Wallhaven con flags estilo RandomWallpaperGnome3
```json
{
  "packs": {
    "wallhaven_sao": {
      "type": "wallhaven",
      "apiKeyEnv": "WALLHAVEN_KEY",
      "keyword": "sao",
      "allowSfw": true,
      "allowSketchy": false,
      "allowNsfw": false,
      "categoryGeneral": true,
      "categoryAnime": true,
      "categoryPeople": false,
      "ratios": ["16x9"],
      "atleast": "1920x1080"
    }
  }
}
```

## Pack/Pool CLI Examples
```bash
hyprwall pack add sao --type wallhaven --api-key-env WALLHAVEN_KEY --keyword "sao" --subthemes "minimalista,dark" --ratios "16x9" --purity 100
hyprwall pack update sao --sorting random
hyprwall pack subtheme add sao "neon"
hyprwall pack set-key sao --api-key-env WALLHAVEN_KEY
hyprwall pack list
hyprwall pack show sao
hyprwall pool enable
hyprwall pool add sao --weight 2 --max 200
hyprwall pool list
```
