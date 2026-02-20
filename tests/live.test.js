const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const live = require('../dist/core/live.js');

function fixture(name) {
  return fs.readFileSync(path.join(__dirname, 'fixtures', 'live', name), 'utf8');
}

test('parse motionbgs post variants from HTML', () => {
  const html = fixture('motionbgs-post.html');
  const out = live.liveParsePostFromHtml(
    'motionbgs',
    'https://motionbgs.com/killua-electric-gaze',
    html
  );

  assert.equal(out.provider, 'motionbgs');
  assert.equal(out.slug, 'killua-electric-gaze');
  assert.equal(out.title, 'Killua Electric Gaze');
  assert.deepEqual(
    out.variants.map(v => v.variant).sort(),
    ['4k', 'hd']
  );
  assert.ok(out.variants.some(v => v.download_url.includes('/dl/4k/')));
  assert.ok(out.variants.some(v => v.download_url.includes('/dl/hd/')));
});

test('parse motionbgs motion preview from escaped script JSON', () => {
  const html = fixture('motionbgs-post-preview-escaped.html');
  const out = live.liveParsePostFromHtml(
    'motionbgs',
    'https://motionbgs.com/killua-electric-gaze',
    html
  );

  assert.equal(out.provider, 'motionbgs');
  assert.ok((out.preview_motion_remote || '').endsWith('/media/9107/killua-electric-gaze-preview.webm'));
  assert.deepEqual(out.variants.map(v => v.variant).sort(), ['4k', 'hd']);
});

test('parse moewalls post motion preview webm from video source', () => {
  const html = fixture('moewalls-post-preview-webm.html');
  const out = live.liveParsePostFromHtml(
    'moewalls',
    'https://moewalls.com/anime/bride-furina-genshin-impact-live-wallpaper/',
    html
  );

  assert.equal(out.provider, 'moewalls');
  assert.equal(out.slug, 'bride-furina-genshin-impact-live-wallpaper');
  assert.ok((out.preview_motion_remote || '').endsWith('/wp-content/uploads/preview/2026/bride-furina-genshin-impact-preview.webm'));
  assert.ok(out.tags.includes('Furina'));
  assert.ok(out.tags.includes('Genshin Impact'));
  assert.deepEqual(out.variants.map(v => v.variant).sort(), ['4k', 'hd']);
});

test('parse moewalls browse links from HTML', () => {
  const html = fixture('moewalls-browse.html');
  const out = live.liveParseBrowseFromHtml('moewalls', html, 'https://moewalls.com/');

  assert.equal(out.length, 2);
  assert.equal(out[0].url, 'https://moewalls.com/anime/winking-aemeath-wuthering-waves-live-wallpaper/');
  assert.equal(out[1].url, 'https://moewalls.com/anime/another-title-live-wallpaper/');
});

test('parse motionbgs browse links from unquoted HTML attrs', () => {
  const html = fixture('motionbgs-browse-unquoted.html');
  const out = live.liveParseBrowseFromHtml('motionbgs', html, 'https://motionbgs.com/');

  assert.equal(out.length, 2);
  assert.equal(out[0].url, 'https://motionbgs.com/killua-electric-gaze');
  assert.equal(out[0].title, 'Killua Electric Gaze');
  assert.ok((out[0].thumb || '').includes('killua-electric-gaze'));
  assert.equal(out[1].url, 'https://motionbgs.com/cosmic-drive');
});

test('parse motionbgs browse links from noisy html without categories/tags', () => {
  const html = fixture('motionbgs-browse-noisy.html');
  const out = live.liveParseBrowseFromHtml('motionbgs', html, 'https://motionbgs.com/');

  assert.equal(out.length, 2);
  assert.equal(out[0].url, 'https://motionbgs.com/killua-electric-gaze');
  assert.equal(out[0].title, 'Killua Electric Gaze');
  assert.equal(out[1].url, 'https://motionbgs.com/cozy-fireplace');
  assert.equal(out[1].title, 'Cozy Fireplace Gif Wallpaper');
  assert.ok(out.every(v => !v.url.includes('/tag:')));
  assert.ok(out.every(v => !v.url.includes('/gifs/')));
});

test('apply-defaults partial update keeps unspecified fields', () => {
  const originalHome = process.env.HOME;
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kitowall-live-test-'));

  process.env.HOME = tempHome;
  try {
    live.liveInit();
    const before = live.liveGetConfig().index.apply_defaults;
    assert.equal(before.proxy_crf_hd, 18);
    assert.equal(before.profile, 'quality');

    live.liveSetApplyDefaults({proxy_fps: 75});
    const after = live.liveGetConfig().index.apply_defaults;

    assert.equal(after.proxy_fps, 75);
    assert.equal(after.proxy_crf_hd, 18);
    assert.equal(after.proxy_crf_4k, 16);
    assert.equal(after.profile, 'quality');
    assert.equal(after.seamless_loop, true);
    assert.equal(after.loop_crossfade, true);
  } finally {
    process.env.HOME = originalHome;
  }
});
