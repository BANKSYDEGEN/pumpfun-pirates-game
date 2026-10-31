// [Raul] ship skins — PUMPFUN PIRATES · Storm Hunt
// Cosmetic paint jobs bought with IN-GAME GOLD only (no real money, no wallet / token / NFT code).
// A skin changes colours only, never stats, and is applied on top of whatever ship the upgrades compile
// (every hull tier, both quality paths). Each skin is a plain data definition so it could be mapped to
// other cosmetic sources someday; nothing like that is built here.
// Persistence: unlike per-run upgrades, skins are permanent unlocks. Owned + equipped skins are stored in
// localStorage ('pfp_skins_v1') and survive game over / reloads. Gold itself stays per-run.
// Art rules: only the official skull logo appears on sails / flags; brand gold #ffcd77, red #fa0d0d, dark #161616.
import * as THREE from 'three';
import { SCHEMES } from './ships.js';

export const SKINS = [
  { id: 'classic', name: 'CLASSIC', price: 0, blurb: 'The original black-sailed PUMPFUN PIRATES rig.',
    swatch: { hull: '#6a4026', band: '#161616', stripe: '#ffcd77', sail: '#1c1c1c', trim: '#ffcd77' } },
  { id: 'parchment', name: 'SAND GOLD PARCHMENT', price: 150, blurb: 'Sun-bleached parchment sails, sand-gold trim.',
    palette: { seed: 61, wood: 0x8a5a32, band: 0xc9a25a, stripe: 0x161616, band2: 0x7a4a22, tar: 0x2a1d12, trim: 0xffcd77, sail: 0xe8d3a2, patch: [0xd8bf86, 0xf2e2bb], hem: 0x8a6a34, lantern: 0xffc46a, window: 0xffd58a },
    sail: { bg: '#e2cb95', badge: '#161616', lines: 'rgba(120,80,30,0.12)' }, flag: { bg: '#d9bf84', badge: '#161616', border: '#8a6a34' },
    parts: { oak: 0x6a4424, plank: 0x7a5230, iron: 0x3a3229, gold: 0xffcd77 },
    swatch: { hull: '#8a5a32', band: '#c9a25a', stripe: '#161616', sail: '#e2cb95', trim: '#ffcd77' } },
  { id: 'blood', name: 'BLOOD SAILS', price: 250, blurb: 'Red sails that say no quarter given.',
    palette: { seed: 71, wood: 0x4e2a1c, band: 0x161616, stripe: 0xfa0d0d, band2: 0x6b0a0a, tar: 0x1a0f0c, trim: 0xffcd77, sail: 0x8e0b0b, patch: [0x5e0606, 0xb21414], hem: 0x2a0606, lantern: 0xff6a3a, window: 0xff9a6a },
    sail: { bg: '#9a0c0c', lines: 'rgba(0,0,0,0.16)' }, flag: { bg: '#b10e0e', border: '#161616' },
    parts: { oak: 0x3e2016, plank: 0x4a2418, gold: 0xffcd77, glow: 0xff5a2a },
    swatch: { hull: '#4e2a1c', band: '#161616', stripe: '#fa0d0d', sail: '#9a0c0c', trim: '#ffcd77' } },
  { id: 'midnight', name: 'MIDNIGHT BLACK', price: 400, blurb: 'Blackened timber, silver fittings, cold blue lamps.',
    palette: { seed: 81, wood: 0x2a1c14, band: 0x0b0b0b, stripe: 0xb8c2cc, band2: 0x1a1d22, tar: 0x0b0806, trim: 0xc8d0d8, sail: 0x0d0d12, patch: [0x1a1a22, 0x050507], hem: 0x8a96a4, lantern: 0x8fd4ff, window: 0x9fdcff },
    sail: { bg: '#0b0b10', lines: 'rgba(255,255,255,0.05)' }, flag: { bg: '#060608', border: '#b8c2cc' },
    parts: { oak: 0x1f1510, plank: 0x24180f, deck: 0x4a3a2c, iron: 0x15171b, gold: 0xc8d0d8, glow: 0x8fd4ff },
    swatch: { hull: '#2a1c14', band: '#0b0b0b', stripe: '#b8c2cc', sail: '#0b0b10', trim: '#c8d0d8' } },
  { id: 'navy', name: 'ROYAL NAVY', price: 600, blurb: 'Navy blue and gold, stolen fair and square.',
    palette: { seed: 91, wood: 0x5a3a24, band: 0x1b2f6b, stripe: 0xffcd77, band2: 0x101c44, tar: 0x14181f, trim: 0xffcd77, sail: 0xefe6cf, patch: [0xdcd2b8, 0xf7f0de], hem: 0x1b2f6b, lantern: 0xffd58a, window: 0xffe2a8 },
    sail: { bg: '#1b2f6b', lines: 'rgba(255,205,119,0.10)', border: '#ffcd77' }, flag: { bg: '#14245a', border: '#ffcd77' },
    parts: { oak: 0x3a2618, plank: 0x1b2f6b, iron: 0x1a2440, gold: 0xffcd77 },
    swatch: { hull: '#5a3a24', band: '#1b2f6b', stripe: '#ffcd77', sail: '#1b2f6b', trim: '#ffcd77' } },
  { id: 'degen', name: 'DEGEN GREEN CANDLE', price: 800, blurb: 'Only goes up. Green candles stitched into every sail.',
    palette: { seed: 101, wood: 0x3a2a1c, band: 0x0f2a18, stripe: 0x4ee37a, band2: 0x14361f, tar: 0x0b120d, trim: 0x4ee37a, sail: 0x0f1a12, patch: [0x16301e, 0x0a120c], hem: 0x4ee37a, lantern: 0x7dffa8, window: 0x9cffb5, stripes: 0x1f6b37 },
    sail: { bg: '#0d1610', candles: '#4ee37a', lines: 'rgba(78,227,122,0.06)' }, flag: { bg: '#0d1610', border: '#4ee37a', candles: '#4ee37a' },
    parts: { oak: 0x2a1e14, plank: 0x14361f, iron: 0x16201a, gold: 0x4ee37a, glow: 0x5cff8f },
    swatch: { hull: '#3a2a1c', band: '#0f2a18', stripe: '#4ee37a', sail: '#0d1610', trim: '#4ee37a' } },
  { id: 'ghost', name: 'GHOST SHIP', price: 1100, blurb: 'Cursed timbers and see-through sails glowing green.',
    palette: { seed: 111, wood: 0x5d7a6a, band: 0x1d3a2e, stripe: 0x9fffc8, band2: 0x2a5040, tar: 0x16241e, trim: 0x9fffc8, sail: 0xa8f0c8, patch: [0x8ad8b0, 0xc8ffe0], hem: 0x4ee37a, lantern: 0x5cff8f, window: 0x7dffa8 },
    sail: { bg: '#5fb98a', lines: 'rgba(255,255,255,0.10)' }, flag: { bg: '#3f8a66', border: '#9fffc8' },
    parts: { oak: 0x4a6a5a, plank: 0x557a66, deck: 0x7a9a88, iron: 0x2a4a3c, gold: 0x9fffc8, glow: 0x5cff8f },
    fx: 'ghost',
    swatch: { hull: '#5d7a6a', band: '#1d3a2e', stripe: '#9fffc8', sail: '#5fb98a', trim: '#9fffc8', ghost: true } },
  { id: 'golden', name: 'GOLDEN GALLEON', price: 1600, blurb: 'Solid gold everything. The richest ship on the Solana seas.',
    palette: { seed: 121, wood: 0xb8862e, band: 0xffcd77, stripe: 0xfa0d0d, band2: 0xd9a441, tar: 0x5a3a12, trim: 0xffe2a8, sail: 0xf3dc9a, patch: [0xe8c97a, 0xfff0c8], hem: 0xfa0d0d, lantern: 0xffe2a8, window: 0xfff0c8 },
    sail: { bg: '#d9a441', badge: '#161616', lines: 'rgba(255,255,255,0.10)', border: '#fa0d0d' }, flag: { bg: '#c8902e', badge: '#161616', border: '#fa0d0d' },
    parts: { oak: 0xa8782a, plank: 0xc8902e, deck: 0xd9b066, iron: 0xb8862e, gold: 0xffe2a8, glow: 0xffe2a8 },
    fx: 'golden',
    swatch: { hull: '#b8862e', band: '#ffcd77', stripe: '#fa0d0d', sail: '#d9a441', trim: '#ffe2a8' } },
];
// [pvp skins] extra skins that are NOT sold in the solo shop (PvP kill-tier unlocks, js/pvpSkins.js) register here,
// so the ship compiler can paint them. SKINS (the solo shop list) is unchanged.
export const EXTRA_SKINS = [];
export function registerSkin(def) { if (!EXTRA_SKINS.some(s => s.id === def.id) && !SKINS.some(s => s.id === def.id)) EXTRA_SKINS.push(def); return def; }
export const getSkin = (id) => SKINS.find(s => s.id === id) || EXTRA_SKINS.find(s => s.id === id) || SKINS[0];

// ---------- persistence ----------
const KEY = 'pfp_skins_v1';
function load() { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return { owned: Array.isArray(v.owned) ? v.owned : [], equipped: v.equipped || 'classic' }; } catch { return { owned: [], equipped: 'classic' }; } }
let state = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: unlocks last this session */ } for (const f of _listeners) { try { f(skinState()); } catch { /* listener */ } } }
// [wallet save] a connected wallet mirrors skins to the server (js/pirateAccount.js)
const _listeners = [];
export const onSkinsChange = (fn) => { _listeners.push(fn); };
export const skinState = () => ({ owned: [...state.owned], equipped: state.equipped });
export function replaceSkins(s) { // server copy wins for a connected wallet; does not fire onSkinsChange
  state = { owned: Array.isArray(s?.owned) ? s.owned.filter(id => SKINS.some(k => k.id === id)) : [], equipped: s?.equipped || 'classic' };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
export const ownsSkin = (id) => id === 'classic' || state.owned.includes(id);
export const equippedSkin = () => getSkin(ownsSkin(state.equipped) ? state.equipped : 'classic');
export function unlockSkin(id) { if (!ownsSkin(id)) { state.owned.push(id); save(); } }
export function equipSkin(id) { if (ownsSkin(id)) { state.equipped = id; save(); } }

// ---------- textures (real skull logo only) ----------
let skullImg = null;
const skullReady = new Promise((res) => { const i = new Image(); i.onload = () => { skullImg = i; res(i); }; i.onerror = () => res(null); i.src = 'assets/skull_transparent.png'; });
await skullReady;
function skullCloth(o, w, h, pad) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  g.fillStyle = o.bg; g.fillRect(0, 0, w, h);
  if (o.lines) { g.fillStyle = o.lines; for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2); }
  if (o.candles) { // a little green-candle chart stitched behind the skull (up only)
    g.globalAlpha = 0.35; let y = h * 0.78;
    for (let i = 0; i < 9; i++) { const x = w * (0.08 + i * 0.105), up = h * (0.05 + ((i * 37) % 5) * 0.012); g.fillStyle = o.candles; g.fillRect(x + 7, y - up - 14, 2, up + 28); g.fillRect(x, y - up, 16, up); y -= h * 0.055; }
    g.globalAlpha = 1;
  }
  if (o.border) { g.strokeStyle = o.border; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12); }
  const s = Math.min(w, h) * (1 - pad * 2);
  if (o.badge) { g.fillStyle = o.badge; g.beginPath(); g.ellipse(w / 2, h / 2, s * 0.6, s * 0.58, 0, 0, Math.PI * 2); g.fill(); }
  if (skullImg) { const ar = skullImg.width / skullImg.height, sw = ar >= 1 ? s : s * ar, sh = ar >= 1 ? s / ar : s; g.drawImage(skullImg, (w - sw) / 2, (h - sh) / 2, sw, sh); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const _built = new Map();
// buildShip() options for a skin (null for CLASSIC = the game's own textures)
export function skinBuildOpts(skin) {
  if (!skin.palette) return null;
  if (_built.has(skin.id)) return _built.get(skin.id);
  const scheme = 'skin_' + skin.id;
  SCHEMES[scheme] = { ...skin.palette };
  const o = { scheme, mainSailMap: skullCloth(skin.sail, 512, 400, 0.14), flagMap: skullCloth(skin.flag, 512, 340, 0.1) };
  _built.set(skin.id, o); return o;
}

// ---------- material effects (ghost glow / golden gleam), applied to the finished ship ----------
const _fx = new Map();
export function skinMaterialFx(skin) {
  if (!skin.fx && !skin.matFx) return null;
  if (!_fx.has(skin.id)) _fx.set(skin.id, new Map());
  const cache = _fx.get(skin.id);
  return (m) => {
    if (!m || m.colorWrite === false) return m; // never touch the depth-only water lid
    if (cache.has(m)) return cache.get(m);
    const n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey;
    if (skin.matFx) { skin.matFx(n, m, THREE); cache.set(m, n); return n; } // [pvp skins] data-defined material look (js/pvpSkins.js)
    if (skin.fx === 'ghost') {
      if (m.side === THREE.BackSide && m.isMeshBasicMaterial) n.color.set(0x1aff7a); // toon outlines glow green
      else if (m.isMeshToonMaterial) {
        n.emissive = new THREE.Color(0x1f9a5a); n.emissiveIntensity = 0.55;
        if (m.customProgramCacheKey?.() === 'sail') { n.transparent = true; n.opacity = 0.62; n.depthWrite = false; }
      } else if (m.isMeshBasicMaterial) n.color.set(0x5cff8f).multiplyScalar(2.2);
    } else if (skin.fx === 'golden' && m.isMeshToonMaterial) { n.emissive = new THREE.Color(0x5a3a08); n.emissiveIntensity = 0.45; }
    cache.set(m, n); return n;
  };
}

// ---------- shop swatch (little painted preview: hull bands + sail with the real skull) ----------
export function skinSwatch(skin, w = 132, h = 66) {
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; c.style.width = `${w}px`; c.style.height = `${h}px`;
  const g = c.getContext('2d'); g.scale(2, 2); const S = skin.swatch;
  g.fillStyle = '#0e1a20'; g.fillRect(0, 0, w, h);
  // sail
  g.fillStyle = S.sail; g.fillRect(w * 0.3, 4, w * 0.4, h * 0.56);
  if (skin.sail?.badge) { g.fillStyle = skin.sail.badge; g.beginPath(); g.arc(w / 2, 4 + h * 0.28, h * 0.17, 0, 7); g.fill(); }
  if (skullImg) { const s = h * 0.34; g.drawImage(skullImg, w / 2 - s / 2, 4 + h * 0.28 - s / 2, s, s * skullImg.height / skullImg.width); }
  g.fillStyle = S.trim; g.fillRect(w * 0.3, 2, w * 0.4, 3);
  // hull
  g.beginPath(); g.moveTo(w * 0.06, h * 0.62); g.lineTo(w * 0.94, h * 0.62); g.lineTo(w * 0.8, h * 0.95); g.lineTo(w * 0.2, h * 0.95); g.closePath();
  g.fillStyle = S.hull; g.fill();
  g.save(); g.clip(); g.fillStyle = S.band; g.fillRect(0, h * 0.62, w, h * 0.1); g.fillStyle = S.stripe; g.fillRect(0, h * 0.72, w, h * 0.035); g.restore();
  g.strokeStyle = '#161616'; g.lineWidth = 2; g.stroke();
  g.fillStyle = S.trim; g.fillRect(w * 0.06, h * 0.6, w * 0.88, 2.5);
  if (S.ghost) { g.fillStyle = 'rgba(92,255,143,0.18)'; g.fillRect(0, 0, w, h); }
  return c;
}
