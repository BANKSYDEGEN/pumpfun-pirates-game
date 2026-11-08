// Token logos for the HQ board canvases (BANKSY t2275u "Work on board ui").
// Image URLs come only from the feeds we already read (DexScreener info.imageUrl, GeckoTerminal image_url) and only from
// hosts allowed by the page CSP img-src. Loaded with crossOrigin='anonymous' so the WebGL texture never gets tainted: a host
// without CORS simply fails and the board draws a coloured initial instead. Our own tokens use same-origin art.
import { WATCH_TOKENS } from './market.js';
const HOSTS = /^https:\/\/(cdn\.dexscreener\.com|dd\.dexscreener\.com|assets\.geckoterminal\.com|coin-images\.coingecko\.com)\/[^\s"'<>]+$/;
export const safeImageURL = u => typeof u === 'string' && u.length <= 400 && HOSTS.test(u) && !/missing(_|\.)/.test(u) ? u : null;
const LOCAL = Object.fromEntries(WATCH_TOKENS.map(t => [t.ca, 'assets/tokens/' + t.sym.toLowerCase() + '.png']));
export const SKULL_URL = 'assets/skull_transparent.png';
const MAX = 80, SIZE = 96, cache = new Map();
let rev = 0, shown = 0, shownAt = 0, ok = 0, failed = 0;
function load(url, cors) {
  let e = cache.get(url); if (e) { cache.delete(url); cache.set(url, e); return e; }   // LRU touch
  if (cache.size >= MAX) cache.delete(cache.keys().next().value);
  e = { bmp: null, failed: false }; cache.set(url, e);
  if (typeof Image === 'undefined' || typeof document === 'undefined') { e.failed = true; return e; }
  const img = new Image(); if (cors) img.crossOrigin = 'anonymous'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
  img.onload = () => { try {   // centre-crop to one small square; getImageData proves the pixels are readable (never tainted)
      const c = document.createElement('canvas'); c.width = c.height = SIZE; const x = c.getContext('2d'), s = Math.min(img.naturalWidth, img.naturalHeight) || 1;
      x.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, SIZE, SIZE); x.getImageData(0, 0, 1, 1);
      e.bmp = c; ok++; rev++; } catch { e.failed = true; failed++; } };
  img.onerror = () => { e.failed = true; failed++; };
  img.src = url; return e;
}
// -> a drawable 96x96 canvas, or null (not loaded yet / failed / not allowed)
// DexScreener's CDN and GeckoTerminal's asset host send no CORS header (checked 2026-11-08), so a WebGL-safe load always fails there:
// only try hosts that do (CoinGecko coin images) and fall back to the coloured initial otherwise, instead of a console error per logo.
// The token-hall modal shows those images as plain <img> tags, which need no CORS.
const CORS_OK = /^https:\/\/coin-images\.coingecko\.com\//;
export function tokenLogo(mint, url) { const local = LOCAL[mint]; const u = local || safeImageURL(url); if (!u || (!local && !CORS_OK.test(u))) return null; return load(u, !local).bmp; }
export function skullLogo() { return load(SKULL_URL, false).bmp; }
// Board redraw key: bumps at most every 2 s however many logos land, so phones never re-upload textures in a burst.
export function logoRev(now = Date.now()) { if (rev !== shown && now - shownAt > 2000) { shown = rev; shownAt = now; } return shown; }
export const logoStats = () => ({ cached: cache.size, ok, failed });
