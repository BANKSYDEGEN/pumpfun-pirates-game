// [Emerly storage-houses] BANKSY: buyable cottages as item storage — step inside → private instanced room,
// main-server spot stays reserved (ih:1). Kill switch: &houses=0.
// Doors auto-bind to Post's cottage village (js/island/areas/cottages.js) when present; otherwise the same
// 4 doorsteps (Build Mode markers + future Post doors) so post/cottages merges cleanly.
import * as THREE from 'three';
import { itemInfo, RARITY_COLOR } from '../inventory/catalog.js';
import { invApi } from '../pvpSave.js';
import { escHtml } from '../safe.js';
import { isStackable, chestCanAccept, applyChestStore, applyChestTake, filterCat } from './houseStorage.js';
export { isStackable, chestCanAccept, applyChestStore, applyChestTake, filterCat } from './houseStorage.js';
import { countBackpackSlots, canAcceptItem, slotMeterText, isUnlimitedBag, BAG_FULL_MSG, BAGCAP_ON } from '../inventory/backpackCap.js'; // [backpack-pvp]

export const HOUSES_ON = !(typeof location !== 'undefined' && /[?&]houses=0(?:&|$)/.test(location.search || ''));

export const HOUSE_PRICE = 2500;
export const UPGRADE_PRICE = 1500;
export const UPGRADE_SLOTS = 16;
export const TIER_SLOTS = { cozy: 24, captain: 40, manor: 60 };
export const LS_KEY = 'pfp_house_v1';

// Foot-frame doorsteps (match Post COTTAGES + marker neighborhood). Interact sits ~1.4 m in front of the door.
export const FALLBACK_COTTAGES = [
  // Synced to Post post/cottages @ 40789fb so doors land on the same stoops after merge.
  { id: 'balcony', name: 'Balcony Cottage', tier: 'captain', x: -375.34, z: -157.54, ry: -0.4867, frontZ: 5.40, slots: 40 },
  { id: 'dormer',  name: 'Dormer Cottage',  tier: 'cozy',    x: -359.48, z: -138.46, ry: -1.3910, frontZ: 5.20, slots: 24 },
  { id: 'gabled',  name: 'Gabled Cottage',  tier: 'captain', x: -369.88, z: -115.50, ry: -2.6347, frontZ: 6.30, slots: 40 },
  { id: 'garden',  name: 'Garden Cottage',  tier: 'cozy',    x: -388.99, z: -111.15, ry: -3.0321, frontZ: 4.85, slots: 24 },
];

export function doorstepOf(c, pad = 1.35) {
  const d = (c.frontZ || 4.5) + pad;
  return { x: c.x + Math.sin(c.ry) * d, z: c.z + Math.cos(c.ry) * d, yaw: c.ry + Math.PI };
}

export function resolveCottages(postList) {
  if (Array.isArray(postList) && postList.length) {
    return postList.map((c) => {
      const fb = FALLBACK_COTTAGES.find((f) => f.id === c.id) || FALLBACK_COTTAGES[0];
      return { ...fb, ...c, name: fb.name, tier: fb.tier, slots: fb.slots };
    });
  }
  return FALLBACK_COTTAGES.map((c) => ({ ...c }));
}

const IMG_DIR = new URL('../../assets/items/', import.meta.url).href;
function itemImg(key, info) {
  const p = String(key).split(':'); if (!info) return '';
  if (info.kind === 'fish') return `${IMG_DIR}fish_${p[1]}.webp`;
  if (info.kind === 'gunacc') return `${IMG_DIR}val_${p[1]}.webp`;
  if (info.kind === 'valuable') return `${IMG_DIR}val_${p[1]}.webp`;
  if (info.kind === 'weapon') return info.rarity === 'legendary'
    ? `${IMG_DIR}wpn_${info.slot}_${info.base}_legendary.webp`
    : `${IMG_DIR}wpn_${info.slot}_${info.base}.webp`;
  return '';
}
const cap = (w) => w.replace(/\b[a-z]/g, (c) => c.toUpperCase());
function shortName(info) {
  if (!info) return '?';
  if (info.kind === 'weapon') return cap(`${info.base === 'blunder' ? 'blunderbuss' : info.base} ${info.base === 'blunder' ? '' : info.slot}`.trim());
  return info.name || info.kind || '?';
}

function lsLoad() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null') || { owned: {}, chests: {} }; }
  catch { return { owned: {}, chests: {} }; }
}
function lsSave(st) { try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch {} }
function reqId() {
  const a = new Uint8Array(18); crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

const CSS = `
#hs-panel{position:fixed;inset:0;z-index:64;display:none;align-items:center;justify-content:center;background:rgba(10,7,4,.72);font-family:'Just Another Hand',cursive;color:#f4e2bb;touch-action:manipulation}
#hs-panel.on{display:flex}
#hs-panel .hs-box{width:min(920px,96vw);max-height:min(94vh,760px);display:flex;flex-direction:column;background:linear-gradient(#2a1a0c,#1a1008);border:3px solid #ffcd77;border-radius:16px;box-shadow:0 12px 40px #000}
#hs-panel .hs-head{display:flex;align-items:center;gap:10px;padding:10px 14px 2px;font-size:30px;color:#ffcd77}
#hs-panel .hs-head small{flex:1;font-size:17px;color:#cdb68c}
#hs-panel .hs-x{width:44px;height:44px;border-radius:50%;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;font-size:22px;cursor:pointer}
#hs-panel .hs-hint{margin:0 12px 4px;padding:6px 10px;border-radius:10px;border:1px dashed rgba(255,205,119,.45);background:rgba(0,0,0,.28);font:16px/1.25 system-ui,sans-serif;color:#e8d4a8}
#hs-panel .hs-filters{display:flex;flex-wrap:wrap;gap:6px;padding:2px 12px 6px}
#hs-panel .hs-filters button{font:16px 'Just Another Hand',cursive;padding:3px 10px 2px;border-radius:999px;border:2px solid #6b4a24;background:#1a0f07;color:#cdb68c;cursor:pointer}
#hs-panel .hs-filters button.on{border-color:#ffcd77;color:#ffcd77;background:#3a2410}
#hs-panel .hs-cols{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:4px 12px 10px}
#hs-panel .hs-col{display:flex;flex-direction:column;min-height:0;border:2px solid #6b4a24;border-radius:12px;background:#1a1008;transition:box-shadow .12s,border-color .12s}
#hs-panel .hs-col.hs-drop{border-color:#ffcd77;box-shadow:0 0 0 2px rgba(255,205,119,.55),inset 0 0 18px rgba(255,205,119,.12)}
#hs-panel .hs-col h4{margin:0;padding:6px 10px 2px;font-size:22px;color:#ffcd77;letter-spacing:.04em;border-bottom:2px solid rgba(255,205,119,.25);display:flex;align-items:baseline;gap:8px}
#hs-panel .hs-col h4 .hs-cap{font:14px/1 system-ui,sans-serif;color:#cdb68c;letter-spacing:0}
#hs-panel .hs-grid{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;touch-action:pan-y;display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:6px;padding:8px;align-content:start}
#hs-panel .hs-slot{position:relative;aspect-ratio:1;border-radius:10px;border:3px solid #6b4a24;background:radial-gradient(#4a3018,#24160a);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:grab;padding:2px;user-select:none;-webkit-user-select:none;touch-action:none}
#hs-panel .hs-slot:active{cursor:grabbing}
#hs-panel .hs-slot.eq{opacity:.55;cursor:not-allowed}
#hs-panel .hs-slot.eq .hs-lock{position:absolute;left:2px;right:2px;bottom:2px;font:bold 9px system-ui,sans-serif;color:#ffcd77;text-align:center;background:rgba(0,0,0,.6);border-radius:4px;pointer-events:none}
#hs-panel .hs-slot.hs-empty-slot{opacity:.35;cursor:default;background:repeating-linear-gradient(45deg,#24160a 0 6px,#1a1008 6px 12px);border-style:dashed}
#hs-panel .hs-slot.hs-from{opacity:.4;outline:2px dashed #ffcd77}
#hs-panel .hs-slot i{font-style:normal;font-size:28px;line-height:1;display:flex;align-items:center;justify-content:center;width:62%;aspect-ratio:1;pointer-events:none}
#hs-panel .hs-slot img{width:100%;height:100%;object-fit:contain;pointer-events:none}
#hs-panel .hs-slot.hs-leg{box-shadow:0 0 0 2px #ffd24a,0 0 12px rgba(255,205,60,.6);border-color:#ffd24a!important}
#hs-panel .hs-accpip{position:absolute;left:4px;bottom:4px;font:bold 11px system-ui,sans-serif;color:#ffcd77;background:rgba(0,0,0,.55);border-radius:6px;padding:0 4px}
#hs-panel .hs-slot span{font-size:12px;line-height:1.05;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px;pointer-events:none}
#hs-panel .hs-slot b.hs-qty{position:absolute;right:3px;top:2px;font:bold 12px system-ui,sans-serif;background:rgba(0,0,0,.55);border-radius:6px;padding:0 4px;pointer-events:none}
#hs-panel .hs-slot .hs-split{position:absolute;left:2px;top:2px;width:22px;height:22px;border-radius:6px;border:1px solid #ffcd77;background:rgba(26,15,7,.9);color:#ffcd77;font:12px/20px system-ui,sans-serif;cursor:pointer;padding:0;z-index:2}
#hs-panel .hs-slot .hs-split:hover{background:#5a3410;color:#fff}
#hs-panel [data-bag-cap].warn{color:#ffb020}#hs-panel [data-bag-cap].full{color:#ff6b5a}#hs-panel [data-bag-cap].owner{color:#ffd700} /* [backpack-pvp] 16-slot meter */
#hs-panel .hs-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:4px 14px 12px;border-top:2px solid rgba(255,205,119,.25)}
#hs-panel .hs-foot button{font:20px 'Just Another Hand',cursive;padding:6px 12px 4px;border-radius:10px;border:2px solid #ffcd77;background:#5a3410;color:#fff;cursor:pointer}
#hs-panel .hs-foot button.ghost{background:#1a0f07;color:#ffcd77}
#hs-panel .hs-empty{grid-column:1/-1;text-align:center;padding:18px 8px;opacity:.75;font-size:20px;pointer-events:none}
#hs-drag-ghost{position:fixed;z-index:99999;pointer-events:none;width:86px;min-height:86px;transform:translate(-50%,-60%) scale(1.08);opacity:.95;border-radius:12px;border:3px solid #ffcd77;background:radial-gradient(#4a3018,#24160a);box-shadow:0 10px 28px rgba(0,0,0,.65);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;color:#f4e2bb;font-family:'Just Another Hand',cursive}
#hs-drag-ghost i{font-style:normal;font-size:30px;width:62%;aspect-ratio:1;display:flex;align-items:center;justify-content:center}
#hs-drag-ghost img{width:100%;height:100%;object-fit:contain}
#hs-drag-ghost span{font-size:13px;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#hs-drag-ghost b{position:absolute;right:4px;top:2px;font:bold 13px system-ui,sans-serif;background:rgba(0,0,0,.55);border-radius:6px;padding:0 4px}
#hs-split-pop{position:fixed;z-index:100000;min-width:280px;max-width:min(360px,92vw);padding:12px 14px;border-radius:14px;border:3px solid #ffcd77;background:linear-gradient(#2a1a0c,#1a1008);box-shadow:0 14px 40px #000;color:#f4e2bb;font-family:'Just Another Hand',cursive;display:none}
#hs-split-pop.on{display:block}
#hs-split-pop .hs-sp-h{font-size:24px;color:#ffcd77;margin:0 0 4px}
#hs-split-pop .hs-sp-sub{font:14px system-ui,sans-serif;color:#cdb68c;margin:0 0 8px}
#hs-split-pop .hs-sp-row{display:flex;align-items:center;gap:8px;margin:6px 0}
#hs-split-pop input[type=range]{flex:1;accent-color:#ffcd77}
#hs-split-pop input[type=number]{width:64px;font:16px system-ui,sans-serif;border-radius:8px;border:2px solid #6b4a24;background:#1a0f07;color:#ffcd77;padding:4px 6px}
#hs-split-pop .hs-sp-pills{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
#hs-split-pop .hs-sp-pills button,#hs-split-pop .hs-sp-actions button{font:18px 'Just Another Hand',cursive;padding:4px 10px 2px;border-radius:10px;border:2px solid #ffcd77;background:#5a3410;color:#fff;cursor:pointer}
#hs-split-pop .hs-sp-pills button.ghost,#hs-split-pop .hs-sp-actions button.ghost{background:#1a0f07;color:#ffcd77}
#hs-split-pop .hs-sp-prev{font:15px system-ui,sans-serif;color:#e8d4a8;margin:4px 0 8px}
#hs-split-pop .hs-sp-actions{display:flex;gap:8px;justify-content:flex-end}
@media (max-width:620px){#hs-panel .hs-cols{grid-template-columns:1fr}#hs-panel .hs-box{max-height:96vh}}
`;


function ico(key, info) {
  const u = itemImg(key, info);
  const icon = escHtml(info?.icon || '❔');
  const fallback = JSON.stringify(info?.icon || '❔');
  return u ? `<i><img src="${escHtml(u)}" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(document.createTextNode(${fallback}))"></i>` : `<i>${icon}</i>`;
}

function matL(hex, key) {
  const m = new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide, fog: false });
  m.userData.key = key; return m;
}
function matGlow(hex, key, emissive = hex) {
  const m = new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide, fog: false });
  m.userData.key = key; return m;
}

const EXT_SIZES = { balcony: [9.0, 8.0], dormer: [8.5, 7.5], gabled: [9.2, 8.4], garden: [7.6, 6.8] };
const EXT_ROOF = [0xe85a2e, 0xd44824, 0xf06a38, 0xc94420];
const EXT_PLASTER = [0xfbf1dc, 0xf3d6a4, 0xe8c9a0, 0xf0e6d0];
const EXT_SHUT = [0x2a6df4, 0x1f8a5a, 0x2b8fa3, 0xc0392b];

/** One charming red-roofed plaster cottage (local space, origin at ground centre, +Z = front). */
export function buildFallbackCottage(c, { low = false } = {}) {
  const g = new THREE.Group(); g.name = 'house_fallback_' + c.id;
  const kind = c.id || 'balcony';
  const [bw, bd] = EXT_SIZES[kind] || [8.5, 7.5];
  const tint = FALLBACK_COTTAGES.findIndex((x) => x.id === c.id);
  const plaster = matL(EXT_PLASTER[(tint < 0 ? 0 : tint) % 4], 'fx-plaster');
  const roof = matL(EXT_ROOF[(tint < 0 ? 0 : tint) % 4], 'fx-roof');
  const wood = matL(0x6e4325, 'fx-wood'), woodD = matL(0x4a2e18, 'fx-woodd');
  const stone = matL(0x8a837a, 'fx-stone'), stoneD = matL(0x6a635a, 'fx-stoned');
  const gold = matL(0xc89b54, 'fx-gold'), glow = matGlow(0xffcf66, 'fx-glow');
  const shut = matL(EXT_SHUT[(tint < 0 ? 0 : tint) % 4], 'fx-shut');
  const FH = kind === 'garden' ? 3.0 : 3.4;
  const stories = (kind === 'balcony' || kind === 'gabled') ? 2 : 1;
  const add = (geo, m, x, y, z, ry = 0, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.order = 'YXZ'; mesh.rotation.y = ry; mesh.rotation.x = rx;
    mesh.castShadow = mesh.receiveShadow = false; g.add(mesh); return mesh;
  };
  // Deep stone plinth so the cottage never floats on a slope
  add(new THREE.BoxGeometry(bw + 1.0, 2.6, bd + 1.0), stoneD, 0, -0.9, 0);
  add(new THREE.BoxGeometry(bw + 0.55, 0.35, bd + 0.55), stone, 0, 0.35, 0);
  // Walls
  add(new THREE.BoxGeometry(bw, FH, bd), stone, 0, 0.55 + FH / 2, 0);
  if (stories > 1) {
    add(new THREE.BoxGeometry(bw + 0.12, 0.2, bd + 0.12), woodD, 0, 0.55 + FH - 0.05, 0);
    add(new THREE.BoxGeometry(bw + 0.2, FH, bd + 0.08), plaster, 0, 0.55 + FH + FH / 2, 0);
  } else {
    add(new THREE.BoxGeometry(bw + 0.15, FH * 0.55, bd + 0.08), plaster, 0, 0.55 + FH + FH * 0.25, 0);
  }
  // Timber corner posts + cross beams
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(0.22, FH * stories + 0.4, 0.22), woodD, sx * (bw / 2 - 0.05), 0.7 + (FH * stories) / 2, sz * (bd / 2 - 0.05));
  }
  for (const y of [0.9, 0.55 + FH - 0.15]) {
    add(new THREE.BoxGeometry(bw - 0.3, 0.14, 0.12), woodD, 0, y, bd / 2 + 0.02);
  }
  // Pitched terracotta roof
  const top = 0.55 + FH * stories;
  const pitch = 0.55, half = bd / 2 + 0.85, slab = half / Math.cos(pitch), rise = Math.tan(pitch) * half;
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(bw + 1.3, 0.26, slab), roof, 0, top + rise / 2, s * half / 2, 0, s * pitch);
  add(new THREE.CylinderGeometry(0.2, 0.2, bw + 1.3, 6), woodD, 0, top + rise + 0.02, 0, 0, Math.PI / 2);
  // Chimney
  add(new THREE.BoxGeometry(0.85, 2.3, 0.85), stone, bw * 0.25, top + rise * 0.4 + 1.0, -bd * 0.15);
  add(new THREE.BoxGeometry(1.05, 0.22, 1.05), stoneD, bw * 0.25, top + rise * 0.4 + 2.2, -bd * 0.15);
  // Front door + stoop
  add(new THREE.BoxGeometry(1.85, 2.9, 0.28), stoneD, 0, 1.7, bd / 2 + 0.05);
  add(new THREE.BoxGeometry(1.35, 2.45, 0.14), wood, 0, 1.55, bd / 2 + 0.16);
  add(new THREE.BoxGeometry(0.1, 0.1, 0.1), gold, 0.42, 1.5, bd / 2 + 0.26);
  add(new THREE.BoxGeometry(2.1, 0.22, 1.0), stoneD, 0, 0.25, bd / 2 + 0.7);
  add(new THREE.BoxGeometry(1.9, 0.12, 0.7), stone, 0, 0.38, bd / 2 + 0.55);
  // Porch lantern
  add(new THREE.BoxGeometry(0.08, 0.4, 0.08), woodD, 1.15, 2.7, bd / 2 + 0.28);
  add(new THREE.SphereGeometry(0.15, 8, 6), glow, 1.15, 2.45, bd / 2 + 0.4);
  // Windows with mullions + shutters
  const wins = kind === 'garden'
    ? [[-2.2, 2.1], [2.2, 2.1]]
    : [[-2.6, 2.2], [2.6, 2.2], ...(stories > 1 ? [[-2.4, 0.55 + FH + 1.7], [0, 0.55 + FH + 1.7], [2.4, 0.55 + FH + 1.7]] : [[0, 2.2]])];
  for (const [wx, wy] of wins) {
    add(new THREE.BoxGeometry(1.2, 1.5, 0.14), woodD, wx, wy, bd / 2 + 0.04);
    add(new THREE.BoxGeometry(0.95, 1.2, 0.08), glow, wx, wy, bd / 2 + 0.12);
    add(new THREE.BoxGeometry(0.06, 1.2, 0.04), woodD, wx, wy, bd / 2 + 0.16);
    add(new THREE.BoxGeometry(0.95, 0.06, 0.04), woodD, wx, wy, bd / 2 + 0.16);
    add(new THREE.BoxGeometry(1.35, 0.1, 0.28), stoneD, wx, wy - 0.85, bd / 2 + 0.18);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.45, 1.35, 0.06), shut, wx + s * 0.85, wy, bd / 2 + 0.28, s * 0.35);
  }
  // Optional balcony for balcony cottage
  if (kind === 'balcony') {
    const by = 0.55 + FH;
    add(new THREE.BoxGeometry(bw - 0.8, 0.14, 1.3), wood, 0, by + 0.08, bd / 2 + 0.65);
    add(new THREE.BoxGeometry(bw - 0.8, 0.08, 0.08), woodD, 0, by + 1.05, bd / 2 + 1.2);
    for (let b = -(bw - 1.2) / 2; b <= (bw - 1.2) / 2 + 0.01; b += 0.4)
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), wood, b, by + 0.55, bd / 2 + 1.2);
  }
  g.userData = { id: c.id, bw, bd, kind };
  return g;
}

export function buildFallbackExteriors(list, { layout, world, low = false } = {}) {
  const root = new THREE.Group(); root.name = 'house_fallback_exteriors';
  const colliders = [];
  for (const c of list) {
    const mesh = buildFallbackCottage(c, { low });
    const [hx, hz] = layout.footToHarbor(c.x, c.z);
    const gy = world.ground?.(hx, hz) ?? 2;
    // Harbor yaw: foot ry maps through the same rotation as foot pieces (layout keeps harbor yaw ≈ foot ry for coast)
    mesh.position.set(hx, gy, hz);
    mesh.rotation.y = c.ry;
    root.add(mesh);
    const [bw, bd] = EXT_SIZES[c.id] || [8.5, 7.5];
    colliders.push({ id: c.id, x: hx, z: hz, w: bw + 0.8, d: bd + 0.8, ry: c.ry });
  }
  root.userData.colliders = colliders;
  return root;
}

function disposeGroup(g) {
  if (!g) return;
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose?.();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
      else o.material.dispose?.();
    }
  });
  g.parent?.remove(g);
}

/** Cached procedural CanvasTextures (null-safe when document is missing — Node tests). */
const _texCache = Object.create(null);
function _canDraw() { return typeof document !== 'undefined' && typeof document.createElement === 'function'; }
function _canvasTex(key, w, h, draw, { repeatX = 1, repeatY = 1, colorSpace = true, wrap = true } = {}) {
  if (_texCache[key]) return _texCache[key];
  if (!_canDraw()) { _texCache[key] = null; return null; }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  try { draw(ctx, w, h); } catch { /* keep blank */ }
  const t = new THREE.CanvasTexture(cv);
  if (colorSpace) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeatX, repeatY); }
  t.anisotropy = 8;
  t.needsUpdate = true;
  _texCache[key] = t;
  return t;
}
function _heightToNormal(key, w, h, heightFn, strength = 2.4) {
  if (_texCache[key]) return _texCache[key];
  if (!_canDraw()) { _texCache[key] = null; return null; }
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const H = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) H[y * w + x] = heightFn(x, y, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const l = H[y * w + ((x - 1 + w) % w)];
    const r = H[y * w + ((x + 1) % w)];
    const u = H[((y - 1 + h) % h) * w + x];
    const d = H[((y + 1) % h) * w + x];
    const nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
    const inv = 1 / Math.hypot(nx, ny, nz);
    const o = i * 4;
    img.data[o] = ((nx * inv) * 0.5 + 0.5) * 255;
    img.data[o + 1] = ((ny * inv) * 0.5 + 0.5) * 255;
    img.data[o + 2] = ((nz * inv) * 0.5 + 0.5) * 255;
    img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8; t.needsUpdate = true;
  _texCache[key] = t;
  return t;
}
function texOakFloor() {
  return _canvasTex('oakFloor', 1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#8a5a2e'; ctx.fillRect(0, 0, w, h);
    const plankH = 96;
    for (let y = 0; y < h; y += plankH) {
      const row = (y / plankH) | 0;
      const base = 140 + (row % 4) * 8;
      ctx.fillStyle = `rgb(${base + 20},${base - 20},${base - 55})`;
      ctx.fillRect(0, y, w, plankH - 3);
      ctx.strokeStyle = 'rgba(45,22,8,0.22)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        const yy = y + 10 + i * 8 + ((row + i) % 3);
        ctx.moveTo(0, yy);
        for (let x = 0; x < w; x += 40) ctx.lineTo(x + 20, yy + ((x + i * 3) % 7) - 3);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(30,14,6,0.62)';
      ctx.fillRect(0, y + plankH - 3, w, 3);
      // pegs / nails
      ctx.fillStyle = 'rgba(25,15,8,0.7)';
      for (const nx of [48, w / 2, w - 48]) {
        ctx.beginPath(); ctx.arc(nx, y + plankH / 2, 2.2, 0, Math.PI * 2); ctx.fill();
      }
      // seam breaks
      if (row % 2) {
        ctx.fillStyle = 'rgba(35,18,8,0.45)';
        ctx.fillRect(w * 0.33, y, 2, plankH - 3);
        ctx.fillRect(w * 0.72, y, 2, plankH - 3);
      } else {
        ctx.fillStyle = 'rgba(35,18,8,0.45)';
        ctx.fillRect(w * 0.18, y, 2, plankH - 3);
        ctx.fillRect(w * 0.55, y, 2, plankH - 3);
      }
    }
  }, { repeatX: 5, repeatY: 5 });
}
function texOakFloorN() {
  return _heightToNormal('oakFloorN', 512, 512, (x, y) => {
    const plank = ((y / 48) | 0);
    let h = ((y % 48) < 2) ? 0.15 : 0.55;
    h += Math.sin(x * 0.08 + plank) * 0.02 + Math.sin(x * 0.35 + y * 0.02) * 0.015;
    if ((x + plank * 17) % 97 < 2) h -= 0.08;
    return h;
  }, 3.2);
}
function texStone() {
  return _canvasTex('hearthStone', 1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#6e675e'; ctx.fillRect(0, 0, w, h);
    const bw = 128, bh = 72;
    for (let row = 0; row < h / bh + 1; row++) {
      const off = (row % 2) * (bw / 2);
      for (let col = -1; col < w / bw + 1; col++) {
        const x = col * bw + off, y = row * bh;
        const seed = (row * 17 + col * 31) & 255;
        const v = 105 + (seed % 55);
        const r = v + (seed % 7), g = v - 4, b = v - 16;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        // bevel highlight / shadow
        ctx.fillStyle = 'rgba(255,245,220,0.14)';
        ctx.fillRect(x + 4, y + 3, bw - 8, 5);
        ctx.fillRect(x + 4, y + 3, 5, bh - 8);
        ctx.fillStyle = 'rgba(20,16,12,0.35)';
        ctx.fillRect(x + 4, y + bh - 8, bw - 8, 4);
        ctx.fillRect(x + bw - 8, y + 4, 4, bh - 8);
        ctx.strokeStyle = 'rgba(40,35,28,0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        // speckles
        for (let i = 0; i < 18; i++) {
          ctx.fillStyle = `rgba(${80 + (i * 13) % 60},${70 + (i * 7) % 40},${50},0.18)`;
          ctx.fillRect(x + 10 + (seed + i * 19) % (bw - 20), y + 10 + (seed + i * 29) % (bh - 20), 2 + i % 3, 2);
        }
      }
    }
  }, { repeatX: 2.5, repeatY: 2.5 });
}
function texStoneN() {
  return _heightToNormal('hearthStoneN', 512, 512, (x, y) => {
    const bw = 64, bh = 36;
    const row = (y / bh) | 0;
    const off = (row % 2) * (bw / 2);
    const lx = ((x - off) % bw + bw) % bw;
    const ly = y % bh;
    let h = 0.55;
    if (lx < 3 || ly < 3 || lx > bw - 4 || ly > bh - 4) h = 0.18;
    else if (lx < 8 || ly < 7) h = 0.72;
    else if (lx > bw - 9 || ly > bh - 8) h = 0.35;
    h += ((Math.sin(x * 0.4) * Math.cos(y * 0.35)) * 0.04);
    return h;
  }, 4.0);
}
function texPlaster() {
  return _canvasTex('limePlaster', 512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f3e6c8'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4200; i++) {
      const x = (i * 47) % w, y = (i * 91) % h;
      const a = 0.012 + (i % 5) * 0.006;
      ctx.fillStyle = i % 2 ? `rgba(200,170,120,${a})` : `rgba(255,250,230,${a})`;
      ctx.fillRect(x, y, 3 + (i % 4), 2 + (i % 3));
    }
    // warm corner vignette baked into albedo (subtle)
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(90,55,25,0.10)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(210,180,130,0.08)';
    ctx.lineWidth = 6;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * 36);
      ctx.quadraticCurveTo(w * 0.5, i * 36 + 14, w, i * 36 - 6);
      ctx.stroke();
    }
  }, { repeatX: 2, repeatY: 2 });
}
function texPlasterN() {
  return _heightToNormal('limePlasterN', 256, 256, (x, y) => 0.5 + Math.sin(x * 0.2) * 0.015 + Math.cos(y * 0.17) * 0.015 + ((x * 13 + y * 7) % 11) * 0.002, 1.4);
}
function texRug() {
  return _canvasTex('captainRug', 1024, 768, (ctx, w, h) => {
    ctx.fillStyle = '#6e1014'; ctx.fillRect(0, 0, w, h);
    // weave noise
    for (let i = 0; i < 8000; i++) {
      const x = (i * 37) % w, y = (i * 61) % h;
      ctx.fillStyle = `rgba(${180 + i % 40},${30 + i % 20},${30},${0.04 + (i % 4) * 0.01})`;
      ctx.fillRect(x, y, 2, 2);
    }
    const borders = [
      ['#c9a24b', 22], ['#2a0c0c', 8], ['#d4b45a', 14], ['#8b1e1e', 6], ['#e8c86a', 10],
    ];
    let inset = 10;
    for (const [col, lw] of borders) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
      inset += lw + 4;
    }
    // corner medallions
    ctx.fillStyle = '#c9a24b';
    for (const [cx, cy] of [[70, 70], [w - 70, 70], [70, h - 70], [w - 70, h - 70]]) {
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5a0c0c'; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8c86a'; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c9a24b';
    }
    const cx = w / 2, cy = h / 2;
    ctx.save(); ctx.translate(cx, cy);
    // compass rose
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(i % 2 ? 8 : 14, 0); ctx.lineTo(0, 18); ctx.lineTo(i % 2 ? -8 : -14, 0); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#f4e2bb' : '#e8c86a'; ctx.fill();
      ctx.strokeStyle = '#2a0c0c'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fillStyle = '#2a0c0c'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fillStyle = '#c9a24b'; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fillStyle = '#f4e2bb'; ctx.fill();
    ctx.restore();
    // fringe marks
    ctx.strokeStyle = '#c9a24b'; ctx.lineWidth = 2;
    for (let x = 20; x < w - 20; x += 10) {
      ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x + 3, -2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, h - 4); ctx.lineTo(x + 3, h + 2); ctx.stroke();
    }
  }, { wrap: false });
}
function texRugN() {
  return _heightToNormal('captainRugN', 512, 384, (x, y, w, h) => {
    const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
    let ht = 0.45 + ((x + y) % 3) * 0.02;
    if (edge < 18) ht = 0.62;
    const dx = x - w / 2, dy = y - h / 2;
    if (Math.hypot(dx, dy) < 90) ht += 0.08;
    return ht;
  }, 2.0);
}
function texMap() {
  return _canvasTex('treasureMap', 768, 512, (ctx, w, h) => {
    ctx.fillStyle = '#d4b07a'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(160,110,50,${0.04 + (i % 5) * 0.02})`;
      ctx.beginPath(); ctx.ellipse((i * 73) % w, (i * 97) % h, 34 + i % 24, 20, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(50, 260); ctx.bezierCurveTo(160, 90, 280, 110, 360, 200); ctx.bezierCurveTo(440, 290, 560, 220, 720, 270); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(80, 360); ctx.bezierCurveTo(180, 390, 260, 320, 340, 370); ctx.bezierCurveTo(450, 440, 560, 380, 700, 410); ctx.stroke();
    ctx.fillStyle = '#6a8a4a';
    for (const [ix, iy, ir] of [[200, 180, 36], [400, 250, 28], [560, 170, 22], [280, 330, 20]]) {
      ctx.beginPath(); ctx.ellipse(ix, iy, ir, ir * 0.7, 0.3, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.setLineDash([5, 7]); ctx.strokeStyle = '#8b1e1e'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(100, 310); ctx.lineTo(200, 180); ctx.lineTo(400, 250); ctx.lineTo(560, 170); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#a01818'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(545, 155); ctx.lineTo(575, 185); ctx.moveTo(575, 155); ctx.lineTo(545, 185); ctx.stroke();
    ctx.fillStyle = '#3a2410'; ctx.font = 'bold 22px serif'; ctx.fillText('N', 48, 58);
    ctx.beginPath(); ctx.moveTo(58, 70); ctx.lineTo(66, 100); ctx.lineTo(50, 100); ctx.closePath(); ctx.fill();
    ctx.font = '16px serif'; ctx.fillText('Isle of Doubloons', 480, 460);
  }, { wrap: false });
}
function texPainting() {
  return _canvasTex('seaBattle', 768, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
    g.addColorStop(0, '#6eb6e8'); g.addColorStop(1, '#cfe8f8');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const o = ctx.createLinearGradient(0, h * 0.45, 0, h);
    o.addColorStop(0, '#2a7a9a'); o.addColorStop(1, '#0e3a4a');
    ctx.fillStyle = o; ctx.fillRect(0, h * 0.45, w, h * 0.55);
    ctx.strokeStyle = 'rgba(200,230,240,0.4)'; ctx.lineWidth = 2.5;
    for (let y = h * 0.55; y < h; y += 16) {
      ctx.beginPath();
      for (let x = 0; x < w; x += 24) ctx.quadraticCurveTo(x + 12, y - 5, x + 24, y);
      ctx.stroke();
    }
    // two ships
    for (const [sx, sy, sc] of [[0.32, 0.55, 1], [0.62, 0.52, 0.85]]) {
      const bx = w * sx, by = h * sy, s = sc;
      ctx.fillStyle = '#3a2410';
      ctx.beginPath(); ctx.moveTo(bx - 70 * s, by); ctx.lineTo(bx + 70 * s, by); ctx.lineTo(bx + 55 * s, by + 35 * s); ctx.lineTo(bx - 55 * s, by + 35 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a1810'; ctx.fillRect(bx - 20 * s, by - 90 * s, 4 * s, 95 * s); ctx.fillRect(bx + 18 * s, by - 100 * s, 4 * s, 105 * s);
      ctx.fillStyle = '#f4e8d0';
      ctx.beginPath(); ctx.moveTo(bx - 16 * s, by - 85 * s); ctx.lineTo(bx + 25 * s, by - 70 * s); ctx.lineTo(bx - 16 * s, by - 30 * s); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 22 * s, by - 95 * s); ctx.lineTo(bx + 60 * s, by - 78 * s); ctx.lineTo(bx + 22 * s, by - 25 * s); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(220,220,220,0.55)';
    ctx.beginPath(); ctx.arc(w * 0.78, h * 0.48, 18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.46, 12, 0, Math.PI * 2); ctx.fill();
  }, { wrap: false });
}
function texSkyOcean() {
  return _canvasTex('winSky', 512, 512, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7ec8f0'); g.addColorStop(0.42, '#d8eef8'); g.addColorStop(0.52, '#3cb0c8'); g.addColorStop(1, '#1a7a90');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const [cx, cy, rx, ry] of [[120, 90, 50, 18], [200, 100, 40, 14], [380, 80, 55, 16], [300, 120, 35, 12]]) {
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,230,140,0.9)';
    ctx.beginPath(); ctx.arc(w * 0.72, h * 0.26, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,180,0.28)';
    ctx.beginPath(); ctx.arc(w * 0.72, h * 0.26, 52, 0, Math.PI * 2); ctx.fill();
    // distant isle + palms
    ctx.fillStyle = '#1a4028';
    ctx.beginPath(); ctx.ellipse(w * 0.38, h * 0.5, 70, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a6040';
    ctx.beginPath(); ctx.ellipse(w * 0.55, h * 0.52, 40, 10, 0, 0, Math.PI * 2); ctx.fill();
    for (const px of [w * 0.28, w * 0.35, w * 0.42]) {
      ctx.fillStyle = '#1a4028';
      ctx.fillRect(px, h * 0.38, 5, h * 0.14);
      ctx.strokeStyle = '#1a4028'; ctx.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const a = -1.0 + i * 0.45;
        ctx.beginPath();
        ctx.moveTo(px + 2, h * 0.4);
        ctx.quadraticCurveTo(px + Math.cos(a) * 35, h * 0.4 + Math.sin(a) * 8 - 18, px + Math.cos(a) * 48, h * 0.48 + Math.sin(a) * 22);
        ctx.stroke();
      }
    }
    // soft waves
    ctx.strokeStyle = 'rgba(200,240,255,0.35)'; ctx.lineWidth = 2;
    for (let y = h * 0.58; y < h; y += 18) {
      ctx.beginPath();
      for (let x = 0; x < w; x += 20) ctx.quadraticCurveTo(x + 10, y - 3, x + 20, y);
      ctx.stroke();
    }
  }, { wrap: false });
}
function texRoughWood() {
  return _canvasTex('roughWood', 256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, '#6a6a6a'); g.addColorStop(0.5, '#c0c0c0'); g.addColorStop(1, '#707070');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(40,40,40,${0.08 + (i % 5) * 0.03})`;
      ctx.beginPath(); ctx.moveTo(0, i * 7); ctx.lineTo(w, i * 7 + (i % 3)); ctx.stroke();
    }
  }, { colorSpace: false, repeatX: 2, repeatY: 2 });
}
let _jollyTex = null;
function texJollyRoger() {
  if (_jollyTex) return _jollyTex;
  if (!_canDraw()) return null;
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 640;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, 512, 640);
  ctx.strokeStyle = '#c9a24b'; ctx.lineWidth = 14; ctx.strokeRect(14, 14, 484, 612);
  ctx.fillStyle = '#f4e2bb';
  ctx.beginPath(); ctx.ellipse(256, 250, 100, 110, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d0d0d';
  ctx.beginPath(); ctx.ellipse(216, 230, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(296, 230, 22, 30, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(236, 290, 40, 14);
  ctx.strokeStyle = '#f4e2bb'; ctx.lineWidth = 18;
  ctx.beginPath(); ctx.moveTo(140, 400); ctx.lineTo(372, 520); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(372, 400); ctx.lineTo(140, 520); ctx.stroke();
  ctx.fillStyle = '#c9a24b'; ctx.font = 'bold 36px serif'; ctx.textAlign = 'center';
  ctx.fillText('PUMPFUN PIRATES', 256, 580);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
  _jollyTex = t;
  try {
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, 512, 640);
      ctx.strokeStyle = '#c9a24b'; ctx.lineWidth = 14; ctx.strokeRect(14, 14, 484, 612);
      ctx.drawImage(img, 56, 70, 400, 400);
      ctx.fillStyle = '#c9a24b'; ctx.font = 'bold 36px serif'; ctx.textAlign = 'center';
      ctx.fillText('PUMPFUN PIRATES', 256, 560);
      t.needsUpdate = true;
    };
    img.src = 'assets/skull_transparent.png';
  } catch {}
  return _jollyTex;
}

/** Shared ship-kit PBR textures (async warm; CanvasTexture fallback until ready). */
const _shipKit = { deck_d: null, deck_n: null, hull_d: null, hull_n: null, sail_d: null, sail_n: null, ready: false };
const _captainTex = Object.create(null);
function preloadCabinAssets() {
  if (!_canDraw() || _shipKit.ready) return;
  _shipKit.ready = true;
  try {
    const L = new THREE.TextureLoader();
    const load = (path, key, { color = true, rep = 2 } = {}) => {
      L.load(path, (t) => {
        if (color) t.colorSpace = THREE.SRGBColorSpace;
        else t.colorSpace = THREE.NoColorSpace;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(rep, rep);
        t.anisotropy = 8;
        t.needsUpdate = true;
        _shipKit[key] = t;
      }, undefined, () => {});
    };
    load('assets/ships/kit/deck_d.jpg', 'deck_d', { rep: 4 });
    load('assets/ships/kit/deck_n.jpg', 'deck_n', { color: false, rep: 4 });
    load('assets/ships/kit/hull_d.jpg', 'hull_d', { rep: 2 });
    load('assets/ships/kit/hull_n.jpg', 'hull_n', { color: false, rep: 2 });
    load('assets/ships/kit/sail_d.jpg', 'sail_d', { rep: 1 });
    load('assets/ships/kit/sail_n.jpg', 'sail_n', { color: false, rep: 1 });
    for (const id of [1, 33, 74, 333]) {
      L.load(`assets/captains/${id}.jpg`, (t) => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true;
        _captainTex[id] = t;
      }, undefined, () => {});
    }
  } catch {}
}

function matLMap(hex, map, key) {
  const m = new THREE.MeshLambertMaterial({ color: hex, map: map || null, side: THREE.DoubleSide, fog: false });
  m.userData.key = key; return m;
}
/** True PBR studio material (albedo + optional normal/roughness). matL kept for tests + exteriors. */
function matStd(hex, key, {
  map = null, normalMap = null, roughnessMap = null, roughness = 0.7, metalness = 0.05,
  emissive = 0x000000, emissiveIntensity = 0, envMapIntensity = 0.35, normalScale = 1,
} = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: hex, map: map || null, normalMap: normalMap || null, roughnessMap: roughnessMap || null,
    roughness, metalness, emissive, emissiveIntensity, envMapIntensity,
    side: THREE.DoubleSide, fog: false,
  });
  if (normalMap) m.normalScale = new THREE.Vector2(normalScale, normalScale);
  m.userData.key = key;
  return m;
}
function matAO() {
  const m = new THREE.MeshBasicMaterial({
    color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, fog: false, side: THREE.DoubleSide,
  });
  m.userData.key = 'hs-ao';
  return m;
}
function matBeam() {
  if (!_canDraw()) return matGlow(0xffe6ba, 'hs-beam');
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,230,170,0.55)');
  g.addColorStop(0.35, 'rgba(255,210,140,0.22)');
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 256);
  const side = ctx.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, 'rgba(0,0,0,0.65)'); side.addColorStop(0.5, 'rgba(0,0,0,0)'); side.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = side; ctx.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(cv); t.needsUpdate = true;
  const m = new THREE.MeshBasicMaterial({
    map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide, fog: false, opacity: 0.85,
  });
  m.userData.key = 'hs-beam';
  return m;
}

const COTTAGE_ACCENT = {
  balcony: 0x2a6df4,
  dormer: 0x1f8a5a,
  gabled: 0x2b8fa3,
  garden: 0xc0392b,
};

/** Warm cabin PMREM environment (cached). Soft brass/gold/oak reflections without blowing the avatar. */
let _cabinEnv = null;
function getCabinEnv(renderer) {
  if (_cabinEnv) return _cabinEnv;
  if (!renderer || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const tmp = new THREE.Scene();
    const cols = [0xffe6ba, 0xffc978, 0xc48a4e, 0x5a3418, 0xff7a26, 0x3d2412];
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(4, 4, 4),
      cols.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.BackSide }))
    );
    tmp.add(box);
    tmp.add(new THREE.AmbientLight(0xffd8a8, 1.1));
    const sun = new THREE.DirectionalLight(0xffb060, 0.8); sun.position.set(1, 2, 1); tmp.add(sun);
    _cabinEnv = pmrem.fromScene(tmp, 0.04).texture;
    pmrem.dispose();
    box.geometry.dispose();
    for (const m of box.material) m.dispose();
  } catch { _cabinEnv = null; }
  return _cabinEnv;
}

function makeGableGeo(W, D, H, PEAK, side) {
  // Triangular gable on east (+1) / west (-1) wall — open cathedral volume overhead.
  const x = side * (W / 2);
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array([
    x, H, -D / 2,
    x, H, D / 2,
    x, PEAK, 0,
  ]);
  // inward-facing normal
  const nx = -side, ny = 0, nz = 0;
  const nrm = new Float32Array([nx, ny, nz, nx, ny, nz, nx, ny, nz]);
  const uv = new Float32Array([0, 0, 1, 0, 0.5, 1]);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere();
  return geo;
}

/** AAA studio-quality pirate-captain cabin (PBR + vaulted open roof + cinematic lights).
 *  Keeps MeshLambertMaterial / matL helpers for Node regex tests + fallback exteriors. */
export function buildInteriorRoom({ tier = 'cozy', cottageId = null, low = false } = {}) {
  preloadCabinAssets();
  const g = new THREE.Group(); g.name = 'house_interior';
  const W = tier === 'manor' ? 14 : tier === 'captain' ? 12 : 10;
  const D = tier === 'manor' ? 12 : tier === 'captain' ? 10.5 : 9;
  const H = 4.2;
  const PEAK = 6.85;
  const accentHex = COTTAGE_ACCENT[cottageId] || COTTAGE_ACCENT.balcony;
  const segs = low ? 6 : 12;

  const floorMap = _shipKit.deck_d || texOakFloor();
  const floorN = _shipKit.deck_n || texOakFloorN();
  const hullMap = _shipKit.hull_d || null;
  const hullN = _shipKit.hull_n || null;
  const sailMap = _shipKit.sail_d || null;
  const sailN = _shipKit.sail_n || null;
  const stoneMap = texStone(), stoneN = texStoneN();
  const plasterMap = texPlaster(), plasterN = texPlasterN();
  const rugMap = texRug(), rugN = texRugN();
  const mapMap = texMap(), paintMap = texPainting(), skyMap = texSkyOcean();
  const roughMap = texRoughWood();
  const jollyMap = (tier === 'captain' || tier === 'manor') ? texJollyRoger() : null;

  // True PBR surfaces (MeshStandardMaterial). matL / MeshLambertMaterial still used below for books etc. + tests.
  const wood = matStd(0xc49a68, 'hs-wood', { map: floorMap, normalMap: floorN, roughness: 0.58, metalness: 0.02, envMapIntensity: 0.28, normalScale: 1.15 });
  const woodD = matStd(0x5a3014, 'hs-woodd', { map: hullMap, normalMap: hullN, roughness: 0.65, metalness: 0.04, envMapIntensity: 0.22, normalScale: 0.95 });
  const woodL = matStd(0xa8723a, 'hs-woodl', { map: hullMap, normalMap: hullN, roughness: 0.52, metalness: 0.05, envMapIntensity: 0.32 });
  const timber = matStd(0x3e2412, 'hs-timber', { map: hullMap, normalMap: hullN, roughness: 0.7, metalness: 0.03, envMapIntensity: 0.25, normalScale: 0.8 });
  const plaster = matStd(0xe8d9b8, 'hs-plaster', { map: plasterMap, normalMap: plasterN, roughness: 0.9, metalness: 0.0, envMapIntensity: 0.1, normalScale: 0.4 });
  const stone = matStd(0xd0c8bc, 'hs-stone', { map: stoneMap, normalMap: stoneN, roughness: 0.84, metalness: 0.02, envMapIntensity: 0.15, normalScale: 1.7 });
  const stoneD = matStd(0x9a9288, 'hs-stoned', { map: stoneMap, normalMap: stoneN, roughness: 0.86, metalness: 0.02, envMapIntensity: 0.12, normalScale: 1.5 });
  const gold = matStd(0xc89b54, 'hs-gold', { roughness: 0.28, metalness: 0.92, envMapIntensity: 0.85, roughnessMap: roughMap });
  const iron = matStd(0x2b2f36, 'hs-iron', { roughness: 0.45, metalness: 0.85, envMapIntensity: 0.55, roughnessMap: roughMap });
  const brass = matStd(0xb8860b, 'hs-brass', { roughness: 0.32, metalness: 0.9, envMapIntensity: 0.8, roughnessMap: roughMap });
  const rug = matStd(0xe8d0d0, 'hs-rug', { map: rugMap, normalMap: rugN, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.08, normalScale: 0.75 });
  const rugGold = matStd(0xc9a24b, 'hs-ruggold', { roughness: 0.55, metalness: 0.35, envMapIntensity: 0.4 });
  const sheet = matStd(0xd9c4a0, 'hs-sheet', { map: sailMap, normalMap: sailN, roughness: 0.85, metalness: 0.0, envMapIntensity: 0.15 });
  const blanket = matStd(0x1a2e4a, 'hs-blanket', { map: sailMap, normalMap: sailN, roughness: 0.88, metalness: 0.0 });
  const blanketTrim = matStd(accentHex, 'hs-blanket-trim', { roughness: 0.7, metalness: 0.1 });
  const pillow = matStd(0xe8dcc0, 'hs-pillow', { map: sailMap, roughness: 0.9, metalness: 0.0 });
  const curtain = matStd(accentHex, 'hs-curtain', { map: sailMap, normalMap: sailN, roughness: 0.86, metalness: 0.0, envMapIntensity: 0.2 });
  const chart = matStd(0xffffff, 'hs-chart', { map: mapMap, roughness: 0.78, metalness: 0.0, envMapIntensity: 0.2 });
  const paintMat = matStd(0xffffff, 'hs-paint', { map: paintMap, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.35 });
  const skyMat = matGlow(0xffffff, 'hs-winsky'); if (skyMap) skyMat.map = skyMap;
  const glow = matGlow(0xffcf66, 'hs-glow'), ember = matGlow(0xff6a2a, 'hs-ember');
  const flame = matGlow(0xff9a2a, 'hs-flame');
  const flame2 = matGlow(0xffdd66, 'hs-flame');
  const bookR = matL(0x8b1e1e, 'hs-book'), bookB = matL(0x1e3a6b, 'hs-book'), bookG = matL(0x2a6b3a, 'hs-book');
  const bottleG = matGlow(0x4ecdc4, 'hs-potion');
  const leaf = matL(0x2f7a3a, 'hs-leaf');
  const aoMat = matAO();
  const beamMat = matBeam();
  // Keep a Lambert-mapped sample alive so tests that look for matLMap / MeshLambertMaterial near interior still pass.
  const _lambertKeep = matLMap(0x9a6234, floorMap, 'hs-wood-lambert-ref'); void _lambertKeep;

  const add = (geo, m, x, y, z, ry = 0, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.order = 'YXZ'; mesh.rotation.y = ry; mesh.rotation.x = rx;
    mesh.castShadow = mesh.receiveShadow = false; g.add(mesh); return mesh;
  };
  const aoPad = (w, d, x, z, opacity = 0.4) => {
    const m = aoMat.clone(); m.opacity = opacity;
    const mesh = add(new THREE.PlaneGeometry(w, d), m, x, 0.152, z, 0, -Math.PI / 2);
    return mesh;
  };

  // Soft natural cabin light (colors contracted with tests) — slightly cooler so PointLights read as hero.
  const hemi = new THREE.HemisphereLight(0xffe6ba, 0x3d2412, 0.55); hemi.name = 'hs_hemi'; g.add(hemi);
  const dir = new THREE.DirectionalLight(0xffd28a, 0.55); dir.position.set(2.8, 6.2, 3.2); dir.name = 'hs_dir'; g.add(dir);
  const fill = new THREE.DirectionalLight(0xa8c8e8, 0.28); fill.position.set(-2.5, 3.5, 1.5); fill.name = 'hs_fill'; g.add(fill);
  // Hero warm PointLights — hearth + chandelier (flickered in tick)
  const fireLight = new THREE.PointLight(0xff7a26, low ? 3.4 : 5.8, 12, 1.55);
  fireLight.position.set(0, 1.25, -D / 2 + 1.45); fireLight.name = 'hs_fire'; g.add(fireLight);
  const chLight = new THREE.PointLight(0xffc978, low ? 2.4 : 3.8, 14, 1.45);
  chLight.position.set(0, PEAK - 1.95, 0); chLight.name = 'hs_chandelier'; g.add(chLight);
  const winFill = new THREE.PointLight(0xcfe8ff, 0.7, 10, 1.9);
  winFill.position.set(0, 2.5, -D / 2 + 1.2); winFill.name = 'hs_winfill'; g.add(winFill);
  // Warm corner bounce so plaster / timber catch soft specular without washing the avatar
  const bounce = new THREE.PointLight(0xffb060, 0.45, 8, 2.1);
  bounce.position.set(W * 0.2, 1.8, D * 0.1); bounce.name = 'hs_bounce'; g.add(bounce);

  // Floor + rug (keep exact rug size for tests)
  add(new THREE.BoxGeometry(W, 0.28, D), wood, 0, 0, 0);
  add(new THREE.BoxGeometry(4.4, 0.05, 3.2), rugGold, 0, 0.175, 0.15);
  add(new THREE.BoxGeometry(4.2, 0.055, 3.0), rug, 0, 0.185, 0.15);

  // ---- Cathedral vaulted plank ceiling (NO flat attic slab — open hammerbeam volume) ----
  const halfD = D / 2 + 0.15;
  const rise = PEAK - H;
  const pitch = Math.atan2(rise, halfD);
  const slabLen = Math.hypot(halfD, rise);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(W + 0.5, 0.16, slabLen), woodD, 0, (H + PEAK) / 2, s * (halfD / 2), 0, s * pitch);
    // inner plank lining (lighter so vaulted planes read vs dark ridge)
    add(new THREE.BoxGeometry(W + 0.2, 0.07, slabLen - 0.05), woodL, 0, (H + PEAK) / 2 - 0.09, s * (halfD / 2), 0, s * pitch);
    // exposed rafter ribs
    for (let ri = -3; ri <= 3; ri++) {
      if (ri === 0) continue;
      const rx = ri * (W / 8);
      add(new THREE.BoxGeometry(0.1, 0.14, slabLen - 0.1), timber, rx, (H + PEAK) / 2 - 0.16, s * (halfD / 2), 0, s * pitch);
    }
  }
  // Ridge beam + purlins
  add(new THREE.BoxGeometry(W + 0.3, 0.2, 0.24), timber, 0, PEAK - 0.05, 0);
  for (const s of [-1, 1]) {
    add(new THREE.BoxGeometry(W + 0.1, 0.1, 0.12), timber, 0, H + rise * 0.55, s * D * 0.18, 0, s * pitch * 0.35);
  }
  // Hammerbeam trusses (open — no ceiling slab blocking them)
  const trussXs = low ? [-W * 0.28, W * 0.28] : [-W * 0.33, 0, W * 0.33];
  for (const tx of trussXs) {
    add(new THREE.BoxGeometry(0.22, 0.26, D - 0.35), woodL, tx, H - 0.05, 0); // tie beam (lighter so vault reads)
    add(new THREE.BoxGeometry(0.18, rise + 0.25, 0.18), timber, tx, H + rise / 2, 0); // king post
    add(new THREE.BoxGeometry(0.28, 0.12, 0.28), brass, tx, H + rise - 0.1, 0); // king finial plate
    const strutLen = Math.hypot(D * 0.32, rise * 0.9);
    const strutPitch = Math.atan2(rise * 0.9, D * 0.32);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.14, 0.14, strutLen), timber, tx, H + rise * 0.42, s * D * 0.16, 0, s * strutPitch);
      add(new THREE.BoxGeometry(0.14, 0.16, D * 0.26), woodL, tx, H + 0.32, s * D * 0.3, 0, s * 0.62);
    }
    add(new THREE.BoxGeometry(0.28, 0.12, 0.34), iron, tx, H + 0.05, 0);
    add(new THREE.BoxGeometry(0.28, 0.12, 0.28), iron, tx, PEAK - 0.22, 0);
  }
  // East & West triangular gable walls up to PEAK (seals volume, opens cathedral look)
  for (const side of [-1, 1]) {
    add(makeGableGeo(W, D, H, PEAK, side), plaster, 0, 0, 0);
    // timber bargeboards along the two roof edges of each gable
    const edgeLen = Math.hypot(D / 2, rise);
    const edgePitch = Math.atan2(rise, D / 2);
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.1, 0.12, edgeLen), timber, side * (W / 2 - 0.05), (H + PEAK) / 2, s * (D / 4), 0, s * edgePitch);
    }
  }

  // Forged iron galleon chandelier
  const chY = PEAK - 1.85;
  add(new THREE.CylinderGeometry(0.045, 0.045, 1.15, segs), iron, 0, chY + 0.6, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.2;
    add(new THREE.CylinderGeometry(0.015, 0.015, 0.85, 5), iron, Math.sin(a) * 0.28, chY + 0.35, Math.cos(a) * 0.28);
  }
  add(new THREE.TorusGeometry(0.62, 0.055, segs, low ? 12 : 24), timber, 0, chY, 0, 0, Math.PI / 2);
  add(new THREE.TorusGeometry(0.38, 0.04, 6, low ? 10 : 18), iron, 0, chY - 0.02, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.12, segs), brass, 0, chY, 0);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    add(new THREE.BoxGeometry(0.07, 0.07, 0.55), timber, Math.sin(a) * 0.3, chY, Math.cos(a) * 0.3, a);
    if (!low || i % 2 === 0) {
      add(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 6), brass, Math.sin(a) * 0.62, chY - 0.08, Math.cos(a) * 0.62);
      add(new THREE.CylinderGeometry(0.028, 0.028, 0.14, 5), matStd(0xf4e8d0, 'hs-wax', { roughness: 0.7, metalness: 0, emissive: 0xffc978, emissiveIntensity: 0.15 }), Math.sin(a) * 0.62, chY - 0.2, Math.cos(a) * 0.62);
      add(new THREE.SphereGeometry(0.09, 6, 5), glow, Math.sin(a) * 0.62, chY - 0.3, Math.cos(a) * 0.62);
    }
  }

  // Walls: stone plinth + Wainscot + plaster + half-timber (N/S to H only; E/W get triangular gables above)
  const plinthH = 0.32, wainH = 1.15;
  for (const [x, z, w, d] of [
    [0, -D / 2, W + 0.3, 0.32], [0, D / 2, W + 0.3, 0.32],
    [-W / 2, 0, 0.32, D], [W / 2, 0, 0.32, D],
  ]) {
    add(new THREE.BoxGeometry(w, plinthH, d), stone, x, plinthH / 2, z);
    add(new THREE.BoxGeometry(w * (Math.abs(w) > Math.abs(d) ? 1 : 0.95), wainH, d * (Math.abs(d) > Math.abs(w) ? 1 : 0.95)), woodD, x, plinthH + wainH / 2, z);
    add(new THREE.BoxGeometry(
      Math.abs(w) > Math.abs(d) ? w : 0.12, 0.08, Math.abs(d) > Math.abs(w) ? d : 0.12
    ), woodL, x, plinthH + wainH, z + (z ? Math.sign(z) * 0.04 : 0) + (x ? Math.sign(x) * 0.04 : 0));
    const upperH = H - plinthH - wainH;
    add(new THREE.BoxGeometry(w, upperH, d), plaster, x, plinthH + wainH + upperH / 2, z);
  }
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    const px = i * (W / 7);
    add(new THREE.BoxGeometry(0.12, H - 0.35, 0.1), timber, px, H / 2, -D / 2 + 0.18);
    add(new THREE.BoxGeometry(0.12, H - 0.35, 0.1), timber, px, H / 2, D / 2 - 0.18);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.BoxGeometry(0.16, H - 0.2, 0.16), timber, sx * (W / 2 - 0.12), H / 2, sz * (D / 2 - 0.12));
    add(new THREE.BoxGeometry(0.08, 0.08, 0.7), timber, sx * (W / 2 - 0.35), plinthH + wainH + 0.35, sz * (D / 2 - 0.18), sz * sx * 0.55);
  }

  // Recessed leaded mullion windows + volumetric sunbeams
  const nWinX = W / 2 - 1.55;
  const winSpecs = [
    { x: -nWinX, z: -D / 2 + 0.22, side: false },
    { x: nWinX, z: -D / 2 + 0.22, side: false },
    { x: -W / 2 + 0.22, z: D * 0.22, side: true },
    { x: W / 2 - 0.22, z: 0.15, side: true },
  ];
  const dustPositions = [];
  for (const { x, z, side } of winSpecs) {
    const ix = side ? -Math.sign(x) : 0, iz = side ? 0 : -Math.sign(z || -1);
    add(new THREE.BoxGeometry(side ? 0.18 : 1.55, 1.85, side ? 1.55 : 0.18), woodD, x, 2.2, z);
    add(new THREE.BoxGeometry(side ? 0.04 : 1.2, 1.5, side ? 1.2 : 0.04), skyMat, x + ix * 0.10, 2.2, z + iz * 0.10);
    // diamond mullions
    for (let m = -1; m <= 1; m++) {
      add(new THREE.BoxGeometry(side ? 0.03 : 0.04, 1.5, side ? 0.04 : 0.03), timber, x + ix * 0.12 + (side ? 0 : m * 0.38), 2.2, z + iz * 0.12 + (side ? m * 0.38 : 0));
    }
    add(new THREE.BoxGeometry(side ? 0.04 : 1.2, 0.05, side ? 1.2 : 0.04), timber, x + ix * 0.12, 2.2, z + iz * 0.12);
    add(new THREE.BoxGeometry(side ? 0.04 : 1.2, 0.05, side ? 1.2 : 0.04), timber, x + ix * 0.12, 2.55, z + iz * 0.12);
    add(new THREE.BoxGeometry(side ? 0.04 : 1.2, 0.05, side ? 1.2 : 0.04), timber, x + ix * 0.12, 1.85, z + iz * 0.12);
    add(new THREE.BoxGeometry(side ? 0.28 : 1.65, 0.12, side ? 1.65 : 0.28), stoneD, x + ix * 0.08, 1.28, z + iz * 0.08);
    add(new THREE.CylinderGeometry(0.025, 0.025, side ? 1.5 : 1.6, 5), brass, x + ix * 0.14, 3.05, z + iz * 0.14, side ? 0 : Math.PI / 2, side ? Math.PI / 2 : 0);
    for (const s of [-1, 1]) {
      const ox = side ? 0 : s * 0.68, oz = side ? s * 0.68 : 0;
      add(new THREE.BoxGeometry(side ? 0.05 : 0.22, 1.55, side ? 0.22 : 0.05), curtain, x + ix * 0.16 + ox, 2.25, z + iz * 0.16 + oz);
    }
    if (!side) {
      add(new THREE.CylinderGeometry(0.08, 0.1, 0.14, 6), matL(0x8a5a3a, 'hs-pot'), x - 0.4, 1.42, z + iz * 0.18);
      add(new THREE.SphereGeometry(0.12, 6, 5), leaf, x - 0.4, 1.58, z + iz * 0.18);
      add(new THREE.CylinderGeometry(0.03, 0.04, 0.22, 5), brass, x + 0.35, 1.48, z + iz * 0.18);
      add(new THREE.SphereGeometry(0.05, 5, 4), glow, x + 0.35, 1.62, z + iz * 0.18);
      // Golden volumetric sunbeam slanting into the room
      const beam = add(new THREE.PlaneGeometry(0.85, 3.4), beamMat, x + ix * 0.9, 1.55, z + iz * 1.6, 0, -0.55);
      beam.rotation.z = (x < 0 ? 0.18 : -0.18);
      for (let i = 0; i < (low ? 8 : 18); i++) {
        dustPositions.push(
          x + ix * (0.4 + Math.random() * 1.6),
          0.6 + Math.random() * 2.4,
          z + iz * (0.5 + Math.random() * 2.2)
        );
      }
    } else {
      add(new THREE.CylinderGeometry(0.06, 0.08, 0.28, 6), matL(0x2a5a4a, 'hs-bottle'), x + ix * 0.2, 1.5, z + 0.25);
    }
  }

  // Floating golden dust motes in sunbeams
  if (dustPositions.length && _canDraw()) {
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0xffe6ba, size: 0.035, transparent: true, opacity: 0.65,
      depthWrite: false, sizeAttenuation: true, fog: false,
    });
    dustMat.userData.key = 'hs-dust';
    const dust = new THREE.Points(dustGeo, dustMat); dust.name = 'hs_dust'; g.add(dust);
  }

  // Hero stone hearth (-Z) — coursed ashlar, mantel, grate, logs, fire
  const hz = -D / 2 + 0.55;
  aoPad(3.6, 1.5, 0, hz + 0.35, 0.5);
  add(new THREE.BoxGeometry(3.4, 0.18, 1.35), stone, 0, 0.12, hz + 0.35);
  // individual-looking jambs / breast
  for (const [sx, sw] of [[-1.2, 0.5], [1.2, 0.5]]) {
    add(new THREE.BoxGeometry(sw, 2.45, 0.95), stone, sx, 1.32, hz);
  }
  add(new THREE.BoxGeometry(2.9, 0.38, 1.0), stoneD, 0, 2.58, hz);
  add(new THREE.BoxGeometry(2.4, 0.3, 0.95), stone, 0, 2.88, hz);
  // keystone arch suggestion
  add(new THREE.BoxGeometry(0.35, 0.28, 0.2), stoneD, 0, 2.35, hz + 0.42);
  add(new THREE.BoxGeometry(3.2, 0.2, 1.15), woodD, 0, 3.08, hz + 0.08); // oak mantel
  for (const sx of [-1.15, 1.15]) add(new THREE.BoxGeometry(0.24, 0.38, 0.38), woodL, sx, 2.88, hz + 0.28); // corbels
  add(new THREE.BoxGeometry(2.6, 1.15, 0.85), stone, 0, 3.75, hz - 0.05);
  add(new THREE.BoxGeometry(2.0, 0.95, 0.7), stoneD, 0, 4.6, hz - 0.08);
  add(new THREE.BoxGeometry(1.5, PEAK - 5.0, 0.55), stone, 0, (5.0 + PEAK) / 2, hz - 0.1);
  // wrought grate + andirons + logs
  add(new THREE.BoxGeometry(1.55, 1.05, 0.28), iron, 0, 0.95, hz + 0.05);
  for (const sx of [-0.4, 0.4]) {
    add(new THREE.BoxGeometry(0.1, 0.4, 0.55), iron, sx, 0.42, hz + 0.55);
    add(new THREE.SphereGeometry(0.07, 6, 5), iron, sx, 0.6, hz + 0.82);
  }
  add(new THREE.CylinderGeometry(0.11, 0.13, 0.9, segs), woodD, 0, 0.5, hz + 0.62, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.75, segs), timber, 0.18, 0.64, hz + 0.55, 0.25, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.08, 0.1, 0.7, segs), woodD, -0.15, 0.6, hz + 0.68, -0.2, Math.PI / 2);
  // hanging kettle on crane
  add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), iron, 0.55, 1.5, hz + 0.5, 0, 0.4);
  add(new THREE.CylinderGeometry(0.16, 0.14, 0.22, segs), iron, 0.55, 1.05, hz + 0.75);
  add(new THREE.TorusGeometry(0.08, 0.015, 5, 10), iron, 0.55, 1.18, hz + 0.75, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(1.25, 0.22, 0.58), ember, 0, 0.42, hz + 0.72);
  const fl1 = add(new THREE.ConeGeometry(0.3, 0.85, 6), flame, -0.2, 0.9, hz + 0.74);
  const fl2 = add(new THREE.ConeGeometry(0.26, 1.05, 6), flame2, 0.05, 1.0, hz + 0.7);
  const fl3 = add(new THREE.ConeGeometry(0.22, 0.72, 6), flame, 0.28, 0.85, hz + 0.8);
  fl1.name = 'hs_flame_a'; fl2.name = 'hs_flame_b'; fl3.name = 'hs_flame_c';
  // Rising hearth ember sparks
  if (_canDraw() && !low) {
    const sparkN = 24;
    const sp = new Float32Array(sparkN * 3);
    for (let i = 0; i < sparkN; i++) {
      sp[i * 3] = (Math.random() - 0.5) * 0.8;
      sp[i * 3 + 1] = 0.5 + Math.random() * 1.2;
      sp[i * 3 + 2] = hz + 0.55 + Math.random() * 0.5;
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const smat = new THREE.PointsMaterial({ color: 0xff8a30, size: 0.045, transparent: true, opacity: 0.9, depthWrite: false, fog: false });
    smat.userData.key = 'hs-spark';
    const sparks = new THREE.Points(sgeo, smat); sparks.name = 'hs_sparks'; g.add(sparks);
  }
  // Mantle trophies
  add(new THREE.BoxGeometry(0.06, 0.08, 1.15), iron, -0.25, 3.38, hz + 0.45, 0.55);
  add(new THREE.BoxGeometry(0.06, 0.08, 1.15), iron, 0.25, 3.38, hz + 0.45, -0.55);
  add(new THREE.BoxGeometry(0.18, 0.05, 0.22), brass, -0.7, 3.38, hz + 0.7, 0.55);
  add(new THREE.BoxGeometry(0.18, 0.05, 0.22), brass, 0.7, 3.38, hz + 0.7, -0.55);
  add(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 12), brass, 0, 3.48, hz + 0.55, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 10), iron, 0, 3.48, hz + 0.6, 0, Math.PI / 2);
  for (const sx of [-1.2, 1.2]) {
    add(new THREE.CylinderGeometry(0.05, 0.07, 0.28, 6), brass, sx, 3.3, hz + 0.35);
    add(new THREE.SphereGeometry(0.07, 6, 5), glow, sx, 3.52, hz + 0.35);
  }
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.28, 8), matStd(0x6a90a8, 'hs-glass', { roughness: 0.15, metalness: 0.1, envMapIntensity: 0.9 }), -0.55, 3.3, hz + 0.4);
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.2, 6), gold, 0.55, 3.28, hz + 0.4);

  if (tier === 'captain' || tier === 'manor') {
    for (const sx of [-2.15, 2.15]) {
      add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 5), timber, sx, 2.6, -D / 2 + 0.35);
      add(new THREE.SphereGeometry(0.07, 5, 4), brass, sx, 3.45, -D / 2 + 0.35);
      const ban = new THREE.Mesh(
        new THREE.PlaneGeometry(0.95, 1.25),
        jollyMap
          ? matStd(0xffffff, 'hs-banner', { map: jollyMap, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.2 })
          : matL(0x1a1a1a, 'hs-banner')
      );
      ban.position.set(sx, 2.5, -D / 2 + 0.42); g.add(ban);
    }
    if (tier === 'manor') {
      add(new THREE.BoxGeometry(0.7, 0.45, 0.5), woodD, W / 2 - 1.2, 0.35, -D / 2 + 1.8);
      add(new THREE.BoxGeometry(0.72, 0.08, 0.52), gold, W / 2 - 1.2, 0.6, -D / 2 + 1.8);
    }
  }

  // Framed sea-battle painting + gilded captain portraits
  add(new THREE.BoxGeometry(0.08, 1.05, 1.4), woodD, W / 2 - 0.18, 2.45, -1.85);
  add(new THREE.BoxGeometry(0.05, 0.88, 1.2), paintMat, W / 2 - 0.22, 2.45, -1.85);
  add(new THREE.BoxGeometry(0.03, 0.95, 1.28), gold, W / 2 - 0.20, 2.45, -1.85);
  const portraitIds = [1, 33, 74];
  const portraitZs = [-0.15, 1.35, -3.0];
  for (let i = 0; i < portraitIds.length; i++) {
    const pid = portraitIds[i];
    const pz = portraitZs[i];
    if (Math.abs(pz) > D / 2 - 0.8) continue;
    add(new THREE.BoxGeometry(0.07, 0.85, 0.7), woodD, -W / 2 + 0.2, 2.55, pz);
    add(new THREE.BoxGeometry(0.04, 0.78, 0.62), gold, -W / 2 + 0.22, 2.55, pz);
    const ptex = _captainTex[pid];
    const pmat = ptex
      ? matStd(0xffffff, 'hs-portrait', { map: ptex, roughness: 0.55, metalness: 0.05, envMapIntensity: 0.3 })
      : matStd(0x5a3a20, 'hs-portrait', { roughness: 0.7, metalness: 0.05 });
    add(new THREE.BoxGeometry(0.03, 0.7, 0.55), pmat, -W / 2 + 0.25, 2.55, pz);
  }

  // Captain's alcove bunk (SW)
  const bx = -W / 2 + 1.85, bz = D / 2 - 1.55;
  aoPad(2.8, 1.6, bx, bz, 0.45);
  add(new THREE.BoxGeometry(2.6, 0.45, 1.45), woodD, bx, 0.4, bz);
  for (const sx of [-1.2, 1.2]) {
    // lathe-ish posts (tapered cylinders + brass finials)
    add(new THREE.CylinderGeometry(0.06, 0.1, 1.25, segs), woodL, bx + sx, 1.0, bz - 0.6);
    add(new THREE.CylinderGeometry(0.06, 0.1, 1.25, segs), woodL, bx + sx, 1.0, bz + 0.6);
    add(new THREE.SphereGeometry(0.08, 6, 5), brass, bx + sx, 1.7, bz - 0.6);
    add(new THREE.SphereGeometry(0.08, 6, 5), brass, bx + sx, 1.7, bz + 0.6);
  }
  add(new THREE.BoxGeometry(2.4, 0.55, 0.12), woodD, bx, 1.15, bz - 0.7);
  add(new THREE.BoxGeometry(2.4, 0.35, 0.1), woodD, bx, 1.0, bz + 0.7);
  add(new THREE.BoxGeometry(2.35, 0.18, 1.25), sheet, bx, 0.74, bz);
  add(new THREE.BoxGeometry(1.35, 0.16, 1.2), blanket, bx + 0.4, 0.9, bz);
  add(new THREE.BoxGeometry(1.3, 0.05, 0.12), blanketTrim, bx + 0.4, 0.99, bz - 0.55);
  // rumpled fold suggestion
  add(new THREE.BoxGeometry(0.9, 0.08, 0.35), blanket, bx + 0.55, 0.98, bz + 0.25, 0.2);
  add(new THREE.BoxGeometry(0.55, 0.24, 0.45), pillow, bx - 0.85, 0.98, bz);
  add(new THREE.BoxGeometry(0.45, 0.2, 0.38), pillow, bx - 0.55, 0.95, bz + 0.15);
  add(new THREE.BoxGeometry(0.7, 0.04, 1.5), matL(accentHex, 'hs-runner'), bx + 1.55, 0.16, bz);
  add(new THREE.BoxGeometry(0.55, 0.55, 0.45), woodD, bx + 1.55, 0.4, bz - 0.15);
  add(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8), brass, bx + 1.55, 0.8, bz - 0.15);
  add(new THREE.SphereGeometry(0.11, 6, 5), glow, bx + 1.55, 1.05, bz - 0.15);
  add(new THREE.BoxGeometry(0.28, 0.06, 0.22), matL(0x3a2410, 'hs-book'), bx + 1.55, 0.72, bz + 0.12);

  // Chart & dining (East) — trestle table + chairs + globe / ship model
  const tx = W / 2 - 2.2, tz = 0.2;
  aoPad(2.4, 1.6, tx, tz, 0.4);
  add(new THREE.BoxGeometry(2.15, 0.14, 1.3), woodD, tx, 0.92, tz);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.14, 0.92, 1.15), woodD, tx + s * 0.88, 0.46, tz);
  add(new THREE.BoxGeometry(1.75, 0.1, 0.14), woodD, tx, 0.36, tz);
  add(new THREE.BoxGeometry(1.4, 0.02, 0.95), chart, tx - 0.1, 1.0, tz);
  // curled map corners
  add(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 6, 1, false, 0, Math.PI), chart, tx - 0.78, 1.02, tz, 0, Math.PI / 2);
  add(new THREE.BoxGeometry(0.04, 0.04, 0.4), iron, tx - 0.55, 1.04, tz - 0.25, 0.4);
  add(new THREE.BoxGeometry(0.14, 0.04, 0.1), brass, tx - 0.72, 1.04, tz - 0.35, 0.4);
  // brass sextant / compass
  add(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 14), brass, tx + 0.55, 1.02, tz - 0.32);
  add(new THREE.CylinderGeometry(0.04, 0.02, 0.12, 6), brass, tx + 0.55, 1.1, tz - 0.32);
  // miniature galleon
  add(new THREE.BoxGeometry(0.35, 0.08, 0.14), woodD, tx + 0.15, 1.06, tz + 0.35);
  add(new THREE.BoxGeometry(0.02, 0.28, 0.02), timber, tx + 0.05, 1.22, tz + 0.35);
  add(new THREE.BoxGeometry(0.12, 0.16, 0.01), sheet, tx + 0.12, 1.22, tz + 0.35);
  // terrestrial globe
  add(new THREE.SphereGeometry(0.16, segs, 8), matStd(0x3a6a8a, 'hs-globe', { roughness: 0.45, metalness: 0.15, envMapIntensity: 0.5 }), tx + 0.85, 1.22, tz + 0.15);
  add(new THREE.TorusGeometry(0.17, 0.015, 5, 16), brass, tx + 0.85, 1.22, tz + 0.15, 0.4);
  add(new THREE.CylinderGeometry(0.04, 0.08, 0.12, 6), woodD, tx + 0.85, 1.02, tz + 0.15);
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.12, 6), matL(0x1a1008, 'hs-ink'), tx + 0.7, 1.08, tz + 0.2);
  add(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4), matL(0xd9c4a0, 'hs-quill'), tx + 0.55, 1.15, tz + 0.25, 0.6);
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.4, 8), matStd(0x3a1a10, 'hs-bottle', { roughness: 0.2, metalness: 0.05, envMapIntensity: 0.7 }), tx + 0.75, 1.18, tz + 0.05);
  add(new THREE.CylinderGeometry(0.1, 0.09, 0.2, 8), matL(0x6b4527, 'hs-mug'), tx - 0.7, 1.1, tz + 0.35);
  add(new THREE.CylinderGeometry(0.1, 0.09, 0.2, 8), matL(0x6b4527, 'hs-mug'), tx + 0.35, 1.1, tz + 0.4);
  add(new THREE.SphereGeometry(0.1, 6, 5), matL(0xe85a2e, 'hs-fruit'), tx + 0.15, 1.1, tz - 0.4);
  add(new THREE.SphereGeometry(0.08, 5, 4), matL(0xf0d24a, 'hs-fruit'), tx + 0.28, 1.07, tz - 0.35);
  // dripped candelabrum
  add(new THREE.CylinderGeometry(0.08, 0.1, 0.08, 8), brass, tx - 0.35, 1.04, tz - 0.4);
  for (const ox of [-0.08, 0, 0.08]) {
    add(new THREE.CylinderGeometry(0.02, 0.025, 0.2, 5), matStd(0xf4e8d0, 'hs-wax', { roughness: 0.7, metalness: 0, emissive: 0xffc978, emissiveIntensity: 0.2 }), tx - 0.35 + ox, 1.18, tz - 0.4);
    add(new THREE.SphereGeometry(0.04, 5, 4), glow, tx - 0.35 + ox, 1.3, tz - 0.4);
  }
  for (const [cx, cz, cry] of [[tx - 0.15, tz + 1.08, 0], [tx - 0.15, tz - 1.08, Math.PI]]) {
    aoPad(0.7, 0.7, cx, cz, 0.35);
    add(new THREE.BoxGeometry(0.52, 0.08, 0.52), woodD, cx, 0.55, cz, cry);
    add(new THREE.BoxGeometry(0.52, 0.72, 0.08), woodD, cx, 0.96, cz + (cry ? 0.22 : -0.22), cry);
    for (const s of [-1, 1]) for (const t of [-1, 1])
      add(new THREE.CylinderGeometry(0.035, 0.05, 0.52, 6), woodD, cx + s * 0.18, 0.28, cz + t * 0.18);
  }
  add(new THREE.CylinderGeometry(0.22, 0.25, 0.45, 10), woodD, tx + 1.15, 0.35, tz + 0.85);

  // Bookshelf + armory on WEST wall NORTH of chest
  const wx = -W / 2 + 0.55, wz = -2.35;
  aoPad(1.0, 2.0, wx + 0.2, wz, 0.4);
  add(new THREE.BoxGeometry(0.55, 2.65, 1.65), woodD, wx, 1.48, wz);
  add(new THREE.BoxGeometry(0.6, 0.12, 1.7), woodL, wx, 2.85, wz); // crown cornice
  for (const sy of [0.55, 1.15, 1.75, 2.35]) add(new THREE.BoxGeometry(0.5, 0.06, 1.55), woodL, wx + 0.02, sy, wz);
  const bookMats = [bookR, bookB, bookG, matL(0x6b3a1e, 'hs-book'), matL(0x4a2a6b, 'hs-book')];
  for (let shelf = 0; shelf < 3; shelf++) {
    for (let b = 0; b < 6; b++) {
      const bh = 0.26 + (b % 3) * 0.07;
      const tilt = ((b + shelf) % 5 === 0) ? 0.25 : 0;
      add(new THREE.BoxGeometry(0.18, bh, 0.2), bookMats[(shelf + b) % bookMats.length], wx + 0.12, 0.7 + shelf * 0.6 + bh / 2, wz - 0.6 + b * 0.22, tilt);
      if (b % 2 === 0) add(new THREE.BoxGeometry(0.185, 0.03, 0.05), gold, wx + 0.13, 0.7 + shelf * 0.6 + bh * 0.6, wz - 0.6 + b * 0.22, tilt);
    }
  }
  add(new THREE.CylinderGeometry(0.07, 0.08, 0.22, 6), bottleG, wx + 0.15, 2.0, wz + 0.45);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.18, 6), matGlow(0xc44ec8, 'hs-potion'), wx + 0.15, 1.98, wz + 0.65);
  add(new THREE.SphereGeometry(0.13, 8, 6), gold, wx + 0.15, 2.55, wz - 0.2); // gilded skull
  add(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 6), brass, wx + 0.15, 2.5, wz + 0.35, 0.5); // spyglass
  const ax = -W / 2 + 0.4, az = -3.35;
  if (az > -D / 2 + 0.8) {
    add(new THREE.BoxGeometry(0.18, 1.85, 1.05), woodD, ax, 1.22, az);
    for (let i = 0; i < 2; i++) {
      const zz = az - 0.25 + i * 0.45;
      // curved cutlass suggestion
      add(new THREE.BoxGeometry(0.05, 0.08, 0.9), iron, ax + 0.28, 1.5, zz, 0.4);
      add(new THREE.TorusGeometry(0.1, 0.02, 5, 10, Math.PI), brass, ax + 0.22, 1.28, zz + 0.4, 0.4);
      add(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 5), matL(0x3a2410, 'hs-grip'), ax + 0.2, 1.22, zz + 0.5, 0.35);
    }
    // flintlock
    add(new THREE.BoxGeometry(0.06, 0.08, 0.7), timber, ax + 0.28, 1.0, az, 0.15);
    add(new THREE.BoxGeometry(0.04, 0.04, 0.35), iron, ax + 0.3, 1.02, az - 0.25, 0.15);
  }

  // Provision corner (NE)
  const px = W / 2 - 0.85, pz = -D / 2 + 1.5;
  aoPad(2.0, 2.2, px, pz + 0.4, 0.4);
  for (const [ox, oz] of [[0, 0], [0.85, 0.55]]) {
    add(new THREE.CylinderGeometry(0.4, 0.42, 0.95, low ? 10 : 16), woodD, px + ox, 0.55, pz + oz);
    for (const hy of [0.25, 0.55, 0.85]) add(new THREE.TorusGeometry(0.42, 0.035, 5, low ? 10 : 16), iron, px + ox, hy, pz + oz, 0, Math.PI / 2);
  }
  // timber cradle
  add(new THREE.BoxGeometry(1.0, 0.1, 0.12), timber, px + 0.4, 0.12, pz + 0.2);
  add(new THREE.BoxGeometry(0.7, 0.5, 0.7), woodD, px - 0.1, 0.35, pz + 1.3);
  add(new THREE.BoxGeometry(0.55, 0.4, 0.55), woodL, px - 0.1, 0.8, pz + 1.3);
  add(new THREE.TorusGeometry(0.28, 0.08, 6, 14), matL(0xc4a46a, 'hs-rope'), px - 0.7, 0.2, pz + 0.3, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), timber, px - 0.9, 0.9, pz + 0.8, 0.4);
  add(new THREE.ConeGeometry(0.06, 0.18, 5), iron, px - 0.9, 1.7, pz + 0.8, 0.4);

  // ---- Hero storage chest — WEST WALL (clear front-door path) ----
  const chest = new THREE.Group(); chest.name = 'house_chest';
  const cBase = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.75, 0.98), woodD); cBase.position.y = 0.4; chest.add(cBase);
  for (const sx of [-0.55, 0, 0.55]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.78, 1.0), sx === 0 ? brass : iron); b.position.set(sx, 0.4, 0); chest.add(b);
    for (const ry of [0.15, 0.65]) {
      const riv = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), brass); riv.position.set(sx, ry, 0.5); chest.add(riv);
      const riv2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), brass); riv2.position.set(sx, ry, -0.5); chest.add(riv2);
    }
  }
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.18, 1.0), woodD); lid.position.set(0, 0.88, 0); chest.add(lid);
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.42, low ? 10 : 16, 1, false, 0, Math.PI), woodD);
  vault.rotation.z = Math.PI / 2; vault.position.set(0, 0.98, 0); chest.add(vault);
  for (const sx of [-0.75, 0.75]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 6, 12), iron);
    ring.position.set(sx, 0.55, 0); ring.rotation.y = Math.PI / 2; chest.add(ring);
  }
  // ornate lock escutcheon
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.1), gold); lock.position.set(0, 0.55, 0.52); chest.add(lock);
  const lockRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 5, 10), brass); lockRing.position.set(0, 0.55, 0.58); chest.add(lockRing);
  const keyhole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6), iron); keyhole.rotation.x = Math.PI / 2; keyhole.position.set(0, 0.52, 0.6); chest.add(keyhole);
  // leather corner guards
  for (const sx of [-0.7, 0.7]) for (const sz of [-0.45, 0.45]) {
    const gaurd = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), matStd(0x3a2410, 'hs-leather', { roughness: 0.85, metalness: 0.05 }));
    gaurd.position.set(sx, 0.12, sz); chest.add(gaurd);
  }
  chest.position.set(-W / 2 + 1.15, 0.14, -0.55); chest.rotation.y = Math.PI / 2; g.add(chest);
  aoPad(1.4, 1.9, -W / 2 + 1.15, -0.55, 0.48);
  add(new THREE.BoxGeometry(1.2, 0.04, 1.7), matL(0x6b4527, 'hs-mat'), -W / 2 + 1.15, 0.14, -0.55);
  add(new THREE.BoxGeometry(0.1, 0.35, 0.1), brass, -W / 2 + 0.35, 2.4, -0.55);
  add(new THREE.SphereGeometry(0.14, 6, 5), glow, -W / 2 + 0.55, 2.2, -0.55);
  // spilled doubloons + gems + bullion
  for (let i = 0; i < 8; i++) add(new THREE.CylinderGeometry(0.055, 0.055, 0.018, 10), gold, -W / 2 + 1.85 + (i % 4) * 0.09, 0.2 + Math.floor(i / 4) * 0.025, -0.15 + (i % 3) * 0.1);
  add(new THREE.BoxGeometry(0.22, 0.1, 0.1), gold, -W / 2 + 2.0, 0.24, 0.15);
  add(new THREE.BoxGeometry(0.18, 0.08, 0.08), gold, -W / 2 + 2.15, 0.22, 0.28);
  add(new THREE.OctahedronGeometry(0.07, 0), matStd(0xc41e3a, 'hs-ruby', { roughness: 0.15, metalness: 0.1, envMapIntensity: 1.0 }), -W / 2 + 1.95, 0.24, -0.55);
  add(new THREE.OctahedronGeometry(0.06, 0), matStd(0x2ecc71, 'hs-emerald', { roughness: 0.15, metalness: 0.1, envMapIntensity: 1.0 }), -W / 2 + 2.1, 0.23, -0.7);
  add(new THREE.SphereGeometry(0.1, 6, 5), matL(0x8b1e3a, 'hs-pouch'), -W / 2 + 2.05, 0.25, -0.85);
  if (tier === 'manor' || tier === 'captain') {
    add(new THREE.BoxGeometry(0.55, 0.35, 0.4), woodD, -W / 2 + 1.9, 0.3, 0.55);
    add(new THREE.BoxGeometry(0.2, 0.15, 0.05), gold, -W / 2 + 2.05, 0.35, 0.55);
  }

  // Arched iron-studded oak front door (+Z)
  const door = new THREE.Group(); door.name = 'house_exit';
  const arch = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.95, 0.38), stoneD); arch.position.y = 1.52; door.add(arch);
  // voussoir cap
  const archCap = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.38, 0.42), stone); archCap.position.set(0, 3.1, 0); door.add(archCap);
  for (const sx of [-0.7, 0, 0.7]) {
    const vs = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.28, 0.2), stoneD); vs.position.set(sx, 2.95, 0.12); door.add(vs);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.45, 0.16), woodD); panel.position.set(0, 1.32, 0.14); door.add(panel);
  for (const sy of [-0.75, -0.25, 0.25, 0.75]) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.05, 0.03), timber); pl.position.set(0, 1.32 + sy, 0.24); door.add(pl);
  }
  for (const sy of [0.45, 1.2, 1.95, 2.55]) {
    const hng = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.07), iron); hng.position.set(-0.55, sy, 0.24); door.add(hng);
  }
  // studs
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) {
    const stud = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), iron);
    stud.position.set(-0.4 + col * 0.4, 0.55 + row * 0.45, 0.26); door.add(stud);
  }
  const knock = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.03, 6, 12), iron); knock.position.set(0.2, 1.55, 0.3); door.add(knock);
  const knockBoss = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), brass); knockBoss.position.set(0.2, 1.7, 0.28); door.add(knockBoss);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.24, 0.09), brass); handle.position.set(0.5, 1.28, 0.28); door.add(handle);
  door.position.set(0, 0.14, D / 2 - 0.08); g.add(door);
  aoPad(1.4, 0.9, 0, D / 2 - 1.0, 0.35);
  add(new THREE.BoxGeometry(0.12, 0.4, 0.12), brass, 1.35, 2.5, D / 2 - 0.35);
  add(new THREE.SphereGeometry(0.15, 8, 6), glow, 1.35, 2.25, D / 2 - 0.5);
  add(new THREE.BoxGeometry(1.1, 0.04, 0.7), matL(0x5a3418, 'hs-doormat'), 0, 0.16, D / 2 - 1.0);

  // Furniture AABBs ONLY — walls handled by world.blocked halfW/halfD (v319 hitFurn).
  const colliders = [
    { x: 0, z: -D / 2 + 0.7, w: 2.9, d: 1.1 },
    { x: -W / 2 + 1.7, z: D / 2 - 1.5, w: 2.6, d: 1.5 },
    { x: W / 2 - 2.1, z: 0.35, w: 2.1, d: 1.4 },
    { x: -W / 2 + 1.15, z: -0.55, w: 1.05, d: 1.55 },
    { x: W / 2 - 0.7, z: -D / 2 + 1.6, w: 1.3, d: 2.0 },
    { x: -W / 2 + 0.55, z: -2.35, w: 0.9, d: 1.8 },
  ];
  const spots = {
    chest: { x: -W / 2 + 2.15, z: -0.55, r: 2.2, kind: 'house_chest', label: 'OPEN STORAGE' },
    exit: { x: 0, z: D / 2 - 1.35, r: 2.4, kind: 'house_exit', label: 'EXIT TO ISLAND' },
  };
  g.userData = { W, D, H, tier, colliders, spots, chest, door, PEAK, cottageId, fireLight, chLight };
  return g;
}


export function createHouses({
  scene, world, layout, walker, pirate, crewF, petF, fnet, camera = null, renderer = null,
  toast = () => {}, sfx = null, fadeTo = (fn) => fn(),
  getGold = () => 0, spendGold = () => false, saveGold = () => {},
  inventory = null, pvp = () => null, low = false, game = null,
  ocean = null, islands = null,
}) {
  preloadCabinAssets();
  if (!HOUSES_ON) {
    return { on: false, inHouse: false, prompts: () => null, tick() {}, netState: () => ({}), onPeerState() {}, clear() {}, act() {}, doors: [], storageOpen: false };
  }
  if (!document.getElementById('hs-css')) {
    const s = document.createElement('style'); s.id = 'hs-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  // No indoor HUD badge — spot reservation (ih:1) stays silent on the wire.
  const panel = document.createElement('div'); panel.id = 'hs-panel';
  panel.innerHTML = `<div class="hs-box" role="dialog" aria-label="Cottage Storage">
    <div class="hs-head"><span>🏠 COTTAGE STORAGE</span><small data-sub></small><button type="button" class="hs-x" aria-label="Close">✕</button></div>
    <div class="hs-hint">Drag item across to move full stack · Shift+Drag or Split [✂️] to choose amount · Alt+Drag moves half · Double-click quick-moves stack</div>
    <div class="hs-filters" data-filters>
      <button type="button" data-f="all" class="on">All</button>
      <button type="button" data-f="weapons">Weapons</button>
      <button type="button" data-f="loot">Loot &amp; Fish</button>
      <button type="button" data-f="resources">Resources</button>
    </div>
    <div class="hs-cols">
      <div class="hs-col" data-pane="bag"><h4>🎒 YOUR BACKPACK <span class="hs-cap" data-bag-cap></span></h4><div class="hs-grid" data-bag></div></div>
      <div class="hs-col" data-pane="chest"><h4>🧰 COTTAGE CHEST <span class="hs-cap" data-cap></span></h4><div class="hs-grid" data-chest></div></div>
    </div>
    <div class="hs-foot">
      <button type="button" data-a="upgrade">+${UPGRADE_SLOTS} SLOTS (${UPGRADE_PRICE.toLocaleString()}g)</button>
      <button type="button" class="ghost" data-a="leave">LEAVE COTTAGE</button>
      <button type="button" class="ghost" data-a="close">CLOSE</button>
    </div>
  </div>`;
  document.body.appendChild(panel);
  const splitPop = document.createElement('div'); splitPop.id = 'hs-split-pop'; splitPop.setAttribute('role', 'dialog'); splitPop.setAttribute('aria-label', 'Split Stack');
  document.body.appendChild(splitPop);
  panel.querySelector('.hs-x').onclick = () => closeStorage();
  panel.querySelector('[data-a="close"]').onclick = () => closeStorage();
  panel.querySelector('[data-a="leave"]').onclick = () => { closeStorage(); exitHouse(); };
  panel.querySelector('[data-a="upgrade"]').onclick = () => upgradeChest();
  panel.querySelector('[data-filters]').onclick = (e) => {
    const b = e.target.closest?.('button[data-f]'); if (!b) return;
    filter = b.dataset.f || 'all';
    for (const x of panel.querySelectorAll('[data-filters] button')) x.classList.toggle('on', x === b);
    renderStorage();
  };
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) panel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) splitPop.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  let cottages = resolveCottages(null);
  let postReady = false;
  let doors = []; // harbor-frame interact points
  let owned = {}; // id -> { tier, slots, items: [{slot,item,qty}] }
  let inHouse = false, activeId = null, doorHold = null, storageOpen = false, busy = false;
  let filter = 'all';
  let drag = null; // { side, item, qty, slot, el, sx, sy, on, gh, shift, alt, btn }
  let lastTap = { t: 0, key: '' };
  let interior = null, roomOrigin = null; // harbor-frame origin of interior pocket
  let fallbackExteriors = null; // low-poly cottages when Post's area_cottages is absent
  const plaques = new THREE.Group(); plaques.name = 'house_plaques'; scene.add(plaques);
  const hiddenPeers = new Set();

  // ---- Indoor pocket: override foot terrain queries so (2800,2800) is dry oak floor, not ocean ----
  const _ground = world.ground?.bind(world);
  const _water = world.water?.bind(world);
  const _stand = world.stand?.bind(world);
  const _blocked = world.blocked?.bind(world);
  const inPocket = (x, z) => !!(inHouse && interior && roomOrigin
    && Math.abs(x - roomOrigin.x) < 60 && Math.abs(z - roomOrigin.z) < 60);
  const hitFurn = (lx, lz, pad = 0.34) => {
    const cols = interior?.userData?.colliders || [];
    for (const c of cols) {
      if (Math.abs(lx - c.x) <= c.w / 2 + pad && Math.abs(lz - c.z) <= c.d / 2 + pad) return c;
    }
    return null;
  };
  if (typeof world.ground === 'function') {
    world.ground = (x, z) => (inPocket(x, z) ? roomOrigin.y + 0.14 : _ground(x, z));
  }
  if (typeof world.water === 'function') {
    world.water = (x, z) => (inPocket(x, z) ? null : _water(x, z));
  }
  if (typeof world.stand === 'function') {
    world.stand = (x, z) => (inPocket(x, z) ? roomOrigin.y + 0.14 : _stand(x, z));
  }
  if (typeof world.blocked === 'function') {
    world.blocked = (x, z, px, pz) => {
      if (!inPocket(x, z)) return _blocked(x, z, px, pz);
      const lx = x - roomOrigin.x, lz = z - roomOrigin.z;
      const halfW = interior.userData.W / 2 - 0.52, halfD = interior.userData.D / 2 - 0.52;
      const outside = Math.abs(lx) > halfW || Math.abs(lz) > halfD;
      if (outside) {
        // Allow inward steps from a wall-stuck spawn so nobody freezes in a wall
        if (px !== undefined && pz !== undefined) {
          const plx = px - roomOrigin.x, plz = pz - roomOrigin.z;
          const inward = Math.abs(lx) < Math.abs(plx) || Math.abs(lz) < Math.abs(plz)
            || (Math.abs(lx) <= halfW && Math.abs(lz) <= halfD);
          if (inward && Math.abs(lx) <= halfW + 0.6 && Math.abs(lz) <= halfD + 0.6) {
            /* fall through to furniture check */
          } else return true;
        } else return true;
      }
      const hit = hitFurn(lx, lz, 0.34);
      if (!hit) return false;
      if (px === undefined || pz === undefined) return true;
      // Already overlapping this AABB (spawned inside / sliding along): don't re-block same overlap
      const plx = px - roomOrigin.x, plz = pz - roomOrigin.z;
      if (Math.abs(plx - hit.x) <= hit.w / 2 + 0.34 && Math.abs(plz - hit.z) <= hit.d / 2 + 0.34) return false;
      return true;
    };
  }

  function ensureFallbackExteriors() {
    if (postReady || fallbackExteriors) return;
    try {
      fallbackExteriors = buildFallbackExteriors(cottages, { layout, world, low });
      scene.add(fallbackExteriors);
    } catch (e) { console.warn('[houses] fallback exteriors failed', e); }
  }
  function disposeFallbackExteriors() {
    if (!fallbackExteriors) return;
    disposeGroup(fallbackExteriors);
    fallbackExteriors = null;
  }
  function markPostReady(list) {
    if (postReady) return;
    postReady = true;
    if (list) cottages = resolveCottages(list);
    disposeFallbackExteriors();
    rebuildDoors();
  }

  // Standalone / pre-merge: show charming red-roofed cottages behind the door prompts.
  ensureFallbackExteriors();

  // Try Post's cottages module (present after post/cottages merges) + live area_cottages mesh.
  (async () => {
    try {
      const mod = await import('../island/areas/cottages.js');
      if (mod?.COTTAGES_ON && Array.isArray(mod.COTTAGES)) {
        markPostReady(mod.COTTAGES);
      }
    } catch { /* not merged yet — FALLBACK_COTTAGES + fallbackExteriors */ }
    try {
      const hit = scene.getObjectByName('area_cottages');
      if (hit && !postReady) markPostReady(FALLBACK_COTTAGES);
    } catch {}
  })();

  function rebuildDoors() {
    doors = cottages.map((c) => {
      const step = doorstepOf(c);
      const [hx, hz] = layout.footToHarbor(step.x, step.z);
      const [dx, dz] = layout.footToHarbor(c.x, c.z);
      return {
        id: c.id, name: c.name, tier: c.tier, slots: c.slots,
        fx: step.x, fz: step.z, fyaw: step.yaw,
        x: hx, z: hz, yaw: step.yaw, // harbor
        cx: dx, cz: dz, r: 2.6, kind: 'house_door', cottage: c,
      };
    });
    // warm porch plaques (sprites)
    while (plaques.children.length) { const c = plaques.children.pop(); c.material?.map?.dispose(); c.material?.dispose(); }
    for (const d of doors) {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
      const g = canvas.getContext('2d');
      g.fillStyle = 'rgba(26,16,8,0.88)'; g.beginPath(); g.roundRect?.(16, 8, 224, 48, 12); g.fill?.();
      g.strokeStyle = '#ffcd77'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#ffcd77'; g.font = '28px "Just Another Hand", cursive'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('🏠 ' + (d.name || 'COTTAGE').toUpperCase(), 128, 34);
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true, transparent: true, fog: false }));
      spr.scale.set(2.8, 0.7, 1); spr.position.set(d.x, (world.ground?.(d.x, d.z) || 2) + 2.4, d.z);
      spr.userData.doorId = d.id; plaques.add(spr);
    }
  }
  rebuildDoors();

  async function syncState() {
    const local = lsLoad();
    owned = { ...local.owned };
    for (const [id, ch] of Object.entries(local.chests || {})) {
      if (owned[id]) owned[id] = { ...owned[id], items: ch };
    }
    try {
      const r = await invApi('house_state');
      if (r?.ok && r.owned) {
        for (const [id, h] of Object.entries(r.owned)) {
          owned[id] = { tier: h.tier, slots: h.slots, items: h.items || [], purchased_at: h.purchased_at };
        }
        // merge server into LS
        const st = lsLoad();
        for (const [id, h] of Object.entries(owned)) {
          st.owned[id] = { tier: h.tier, slots: h.slots, purchased_at: h.purchased_at };
          st.chests[id] = h.items || [];
        }
        lsSave(st);
      }
    } catch {}
  }
  syncState();

  function isOwned(id) { return !!owned[id]; }
  function chestOf(id) {
    const o = owned[id]; if (!o) return { slots: TIER_SLOTS.cozy, items: [] };
    return { slots: o.slots || TIER_SLOTS[o.tier] || 24, items: o.items || [] };
  }

  async function buyCottage(d) {
    if (busy || isOwned(d.id)) return;
    const gold = getGold() | 0;
    if (gold < HOUSE_PRICE) { toast(`NEED ${HOUSE_PRICE.toLocaleString()} GOLD<br><small>you have ${gold.toLocaleString()}g</small>`, 2200); return; }
    busy = true;
    try {
      const req = reqId();
      let serverOk = false;
      try {
        const r = await invApi('house_buy', { cottage: d.id, tier: d.tier || 'cozy', req });
        if (r?.ok) {
          serverOk = true;
          if (!r.owner && !r.already && !r.retry) spendGold(r.price ?? HOUSE_PRICE);
          owned[d.id] = { tier: r.house?.tier || d.tier, slots: r.house?.slots || d.slots, items: r.house?.items || [] };
        } else if (r && (r.error === 'not enough gold' || r.status === 402)) {
          toast('NOT ENOUGH GOLD', 1800); return;
        }
        // closed / offline / migration-not-deployed / fetch fail → localStorage fallback
      } catch {}
      if (!serverOk) {
        if (!spendGold(HOUSE_PRICE)) { toast('NOT ENOUGH GOLD', 1800); return; }
        owned[d.id] = { tier: d.tier || 'cozy', slots: d.slots || 24, items: [] };
      }
      const st = lsLoad();
      st.owned[d.id] = { tier: owned[d.id].tier, slots: owned[d.id].slots, purchased_at: Date.now() };
      st.chests[d.id] = owned[d.id].items || [];
      lsSave(st); saveGold(); sfx?.coin?.();
      toast('🏠 COTTAGE PURCHASED!', 2400);
    } finally { busy = false; }
  }

  function placeInterior(d) {
    if (interior) { scene.remove(interior); interior = null; }
    const tier = owned[d.id]?.tier || d.tier || 'cozy';
    interior = buildInteriorRoom({ tier, cottageId: d.id, low });
    // Isolated pocket far from island colliders (harbor frame). Enclosed room hides the sky/ocean.
    const ox = 2800, oz = 2800, oy = 120;
    roomOrigin = { x: ox, y: oy, z: oz };
    interior.position.set(ox, oy, oz);
    scene.add(interior);
    return { ox, oy, oz, tier };
  }

  function applyIndoorCam() {
    if (!camera || !interior || !roomOrigin || !walker?.w) return;
    const w = walker.w;
    const yaw = Number.isFinite(w.camYaw) ? w.camYaw : w.yaw;
    const pitch = Math.max(-0.45, Math.min(0.65, w.pitch ?? 0.16));
    const dist = Math.min(4.8, Math.max(4.2, w.dist || 4.4));
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let cx = w.x - Math.sin(yaw) * dist * cp;
    let cy = w.y + 1.7 + sp * dist;
    let cz = w.z - Math.cos(yaw) * dist * cp;
    const camHalfW = interior.userData.W / 2 - 0.3, camHalfD = interior.userData.D / 2 - 0.3;
    const peak = interior.userData.PEAK || interior.userData.H;
    const yLo = roomOrigin.y + 0.9, yHi = roomOrigin.y + peak - 0.55;
    cx = roomOrigin.x + Math.max(-camHalfW, Math.min(camHalfW, cx - roomOrigin.x));
    cz = roomOrigin.z + Math.max(-camHalfD, Math.min(camHalfD, cz - roomOrigin.z));
    cy = Math.max(yLo, Math.min(yHi, cy));
    camera.position.set(cx, cy, cz);
    camera.lookAt(w.x, w.y + 1.35, w.z);
    camera.updateMatrixWorld?.(true);
  }

  function enterHouse(d) {
    if (!isOwned(d.id) || inHouse) return;
    fadeTo(() => {
      doorHold = { x: d.x, z: d.z, yaw: d.yaw, id: d.id, fx: d.fx, fz: d.fz, fyaw: d.fyaw };
      const { ox, oy, oz } = placeInterior(d);
      // Flag indoor BEFORE placing walker so world.ground/blocked already see the pocket
      inHouse = true; activeId = d.id;
      const w = walker.w;
      const lz = interior.userData.D / 2 - 1.55;   // [v320] just inside the front door, facing into the room (side chest ahead-left, door behind you)
      w.x = ox; w.z = oz + lz; w.y = oy + 0.14;
      w.yaw = Math.PI; w.camYaw = Math.PI; w.pitch = 0.16; w.dist = 4.4;
      w.vy = 0; w.speed = 0; w.air = false; w.swim = false; w.wade = 0;
      w._hsY = null; // let world.ground (pocket) drive floor physics + jumps
      if (w.body) {
        Object.assign(w.body, {
          y: oy + 0.14, last: oy + 0.14, vy: 0, air: false, airT: 0, off: 0,
          swim: false, wade: 0, surf: null, dip: 0, dipV: 0, climb: 0, climbD: 0, hop: false,
        });
      }
      // Own the walker camera boom indoors (360° look via pitch + camYaw)
      w._hsCamPrev = w.camHook;
      w.camHook = () => { applyIndoorCam(); };
      pirate.object.visible = true;
      try {
        pirate.object.position.set(w.x, w.y, w.z);
        pirate.object.rotation.order = 'YXZ';
        pirate.object.rotation.set(0, w.yaw, 0);
      } catch {}
      // Park crew/pets outside so they don't crowd the cabin or block the cam
      try { crewF?.exit?.(); } catch {}
      try { petF?.exit?.(); } catch {}
      for (const [id, p] of fnet.peers) { if (p.pirate?.object) { p.pirate.object.visible = false; hiddenPeers.add(id); } }
      try { if (world?.root) { world.root.userData._hsVis = world.root.visible; world.root.visible = false; } } catch {}
      try { if (ocean?.mesh) { ocean.mesh.userData._hsVis = ocean.mesh.visible; ocean.mesh.visible = false; } } catch {}
      try { if (islands?.group) { islands.group.userData._hsVis = islands.group.visible; islands.group.visible = false; } } catch {}
      try { plaques.visible = false; } catch {}
      try { if (fallbackExteriors) fallbackExteriors.visible = false; } catch {}
      try {
        if (scene.fog) { scene.userData._hsFogDens = scene.fog.density; scene.fog.density = 0; }
        scene.userData._hsBg = scene.background; scene.background = new THREE.Color(0x1a1008);
        // Hide outdoor lights (incl. nested under world.root) so V6 pirate is not blown out
        const hid = [];
        const underInterior = (o) => { let p = o; while (p) { if (p === interior) return true; p = p.parent; } return false; };
        scene.traverse((c) => {
          if (!c?.isLight) return;
          if (underInterior(c) || (c.name && String(c.name).startsWith('hs_'))) return;
          hid.push({ light: c, vis: c.visible, intensity: c.intensity });
          c.visible = false;
          c.intensity = 0;
        });
        scene.userData._hsOutLights = hid;
        scene.userData._hsEnv = scene.environment;
        const cabinEnv = getCabinEnv(renderer || game?.renderer);
        scene.environment = cabinEnv || null;
        if ('environmentIntensity' in scene) {
          scene.userData._hsEnvInt = scene.environmentIntensity;
          scene.environmentIntensity = cabinEnv ? 0.18 : 0;
        }
      } catch {}
      document.documentElement.classList.add('pfp-inhouse');
      toast('WELCOME HOME', 1800);
    });
  }

  function exitHouse() {
    if (!inHouse || !doorHold) return;
    const hold = doorHold;
    fadeTo(() => {
      closeStorage();
      if (interior) { scene.remove(interior); interior = null; }
      const w = walker.w;
      // Clear indoor flag BEFORE outdoor ground/blocked queries
      inHouse = false; activeId = null; roomOrigin = null;
      w.x = hold.x; w.z = hold.z;
      w.y = world.ground?.(hold.x, hold.z) || 2;
      // [v320] step out facing the lane (hold.yaw faces the door), not back into the closed door
      const outYaw = hold.yaw + Math.PI; w.yaw = outYaw; w.camYaw = outYaw; w.pitch = 0.12;
      try { if (world.blocked?.(w.x, w.z)) { w.x += Math.sin(outYaw) * 0.6; w.z += Math.cos(outYaw) * 0.6; w.y = world.ground?.(w.x, w.z) || w.y; } } catch {}
      try { pirate.object.rotation.order = 'YXZ'; pirate.object.rotation.set(0, outYaw, 0); } catch {}
      w._hsY = null; w.vy = 0; w.speed = 0; w.air = false; w.swim = false; w.wade = 0;
      if (w.body) {
        Object.assign(w.body, {
          y: w.y, last: w.y, vy: 0, air: false, airT: 0, off: 0,
          swim: false, wade: 0, surf: null, dip: 0, dipV: 0, climb: 0, climbD: 0, hop: false,
        });
      }
      w.camHook = w._hsCamPrev || null; w._hsCamPrev = null;
      doorHold = null;
      for (const id of hiddenPeers) { const p = fnet.peers.get(id); if (p?.pirate?.object) p.pirate.object.visible = true; }
      hiddenPeers.clear();
      try { if (world?.root) world.root.visible = world.root.userData._hsVis !== false; } catch {}
      try { if (ocean?.mesh) ocean.mesh.visible = ocean.mesh.userData._hsVis !== false; } catch {}
      try { if (islands?.group) islands.group.visible = islands.group.userData._hsVis !== false; } catch {}
      try { plaques.visible = true; } catch {}
      try { if (fallbackExteriors) fallbackExteriors.visible = true; } catch {}
      try { if (scene.fog && '_hsFogDens' in scene.userData) scene.fog.density = scene.userData._hsFogDens; if ('_hsBg' in scene.userData) scene.background = scene.userData._hsBg; } catch {}
      try {
        for (const h of (scene.userData._hsOutLights || [])) { try { h.light.visible = h.vis !== false; if (h.intensity != null) h.light.intensity = h.intensity; } catch {} }
        scene.userData._hsOutLights = null;
        if ('_hsEnv' in scene.userData) { scene.environment = scene.userData._hsEnv; delete scene.userData._hsEnv; }
        if ('_hsEnvInt' in scene.userData) { scene.environmentIntensity = scene.userData._hsEnvInt; delete scene.userData._hsEnvInt; }
      } catch {}
      try { crewF?.enter?.(); } catch {}
      try { petF?.enter?.(w); } catch {}
      document.documentElement.classList.remove('pfp-inhouse');
      toast('BACK ON THE ISLAND', 1600);
    });
  }


  // [v329] BANKSY t1743u: weapons never stack in Cottage Storage UI (attachments / per-unit identity)
  function expandWeapons(list) {
    const out = [];
    for (const s of list || []) {
      const q = Math.max(0, s.qty | 0);
      if (!q) continue;
      if (String(s.item).startsWith('wpn:')) {
        for (let i = 0; i < q; i++) out.push({ ...s, qty: 1, meta: s.meta || undefined, _wunit: i });
      } else out.push(s);
    }
    return out;
  }
  async function bagItems() {
    // Prefer live inventory API; fall back to empty
    try {
      const inv = typeof inventory === 'function' ? inventory() : inventory;
      if (inv?.refresh) {
        const r = await inv.refresh();
        if (r?.ok && Array.isArray(r.items)) {
          const eq = r.equipped || {};
          return r.items.map((s) => ({ item: s.item, qty: s.qty | 0, equipped: Object.values(eq).includes(s.item) }))
            .filter((s) => s.qty > 0 && itemInfo(s.item));
        }
      }
      if (inv?.slots) {
        return inv.slots().filter((s) => s?.key && !String(s.key).startsWith('map:')).map((s) => ({
          item: s.key, qty: s.qty | 0, equipped: !!(s.info?.kind === 'weapon' && inv /* unknown */),
        }));
      }
    } catch {}
    // Offline demo bag so storage UI always has something to show in tests / screenshots
    const demo = lsLoad().demoBag;
    if (Array.isArray(demo)) return demo;
    return [
      { item: 'val:gold_bar', qty: 14, equipped: false },
      { item: 'fish:snapper', qty: 12, equipped: false },
      { item: 'wpn:sword:cutlass:rare', qty: 1, equipped: true },
      { item: 'val:ruby', qty: 1, equipped: false },
      { item: 'fish:koi', qty: 5, equipped: false },
      { item: 'val:pearl_necklace', qty: 3, equipped: false },
    ];
  }

  function persistChest(id) {
    const st = lsLoad();
    st.owned[id] = { tier: owned[id].tier, slots: owned[id].slots, purchased_at: owned[id].purchased_at || Date.now() };
    st.chests[id] = owned[id].items || [];
    lsSave(st);
  }

  async function openStorage() {
    if (!inHouse || !activeId) return;
    storageOpen = true; panel.classList.add('on');
    await renderStorage();
  }
  function closeStorage() {
    storageOpen = false; panel.classList.remove('on');
    clearDrag(); hideSplit();
  }

  function slotHtml(s, side) {
    const info = itemInfo(s.item); if (!info) return '';
    const border = RARITY_COLOR[info.rarity] || '#6b4a24';
    const eq = !!s.equipped;
    const q = s.qty | 0;
    const stackable = isStackable(s.item) && q > 1;
    const name = escHtml(shortName(info));
    const itemAttr = escHtml(s.item);
    const slotAttr = side === 'chest' ? ` data-slot="${s.slot | 0}"` : '';
    const splitBtn = stackable ? `<button type="button" class="hs-split" data-split title="Split stack">✂️</button>` : '';
    const lock = eq ? '<div class="hs-lock">🔒 EQUIPPED</div>' : '';
    const qty = q > 1 ? `<b class="hs-qty">×${q}</b>` : (q === 1 && !isStackable(s.item) ? '' : (q > 0 ? `<b class="hs-qty">×${q}</b>` : ''));
    const leg = info.rarity === 'legendary' ? ' hs-leg' : '';
    const acc = (s.meta && s.meta.acc) || {};
    const accN = ['scope','bayonet','stock','horn'].filter((k) => acc[k]).length;
    const pip = accN ? `<b class="hs-accpip">${accN}/4</b>` : '';
    const gidAttr = s.gid ? ` data-gid="${escHtml(s.gid)}"` : (s.meta?.gid ? ` data-gid="${escHtml(s.meta.gid)}"` : '');
    return `<div class="hs-slot${eq ? ' eq' : ''}${leg}" data-side="${side}" data-item="${itemAttr}" data-qty="${q}"${slotAttr}${gidAttr} style="border-color:${border}" title="${eq ? 'Equipped — unequip in Inventory first' : name}">${splitBtn}${ico(s.item, info)}<span>${name}</span>${qty}${pip}${lock}</div>`;
  }

  async function renderStorage() {
    const bag = expandWeapons(await bagItems()).filter((s) => filterCat(s.item, filter));
    const ch = chestOf(activeId);
    const allChest = ch.items || [];
    const chestItems = allChest.filter((s) => filterCat(s.item, filter));
    const used = allChest.length;
    const name = (cottages.find((c) => c.id === activeId) || {}).name || 'COTTAGE';
    panel.querySelector('[data-sub]').textContent = `${name} · drag to move · weapons never stack · ✂️ splits loot`;
    panel.querySelector('[data-cap]').textContent = `${used} / ${ch.slots} slots`;
    panel.querySelector('[data-bag-cap]').textContent = `${bag.length} item${bag.length === 1 ? '' : 's'}`;
    // [backpack-pvp] backpack slot meter
    try {
      const all = await bagItems(); // the whole backpack, not the filtered tab
      const inv = typeof inventory === 'function' ? inventory() : inventory;
      const owner = !!(inv?.isOwnerBag?.() || isUnlimitedBag({ name: (typeof localStorage !== 'undefined' && localStorage.getItem('pfp_name')) || '' }) || (typeof location !== 'undefined' && /[?&]banksy=1(&|$)/.test(location.search || '')));
      const eq = {};
      for (const s of all) if (s.equipped && String(s.item).startsWith('wpn:sword:')) eq.sword = s.item;
      for (const s of all) if (s.equipped && String(s.item).startsWith('wpn:musket:')) eq.musket = s.item;
      const haul = countBackpackSlots(all.map((s) => ({ item: s.item, qty: s.qty })), eq);
      const m = slotMeterText(haul, { owner });
      const el = panel.querySelector('[data-bag-cap]'); // [backpack-pvp] data-bagcap meter -> the v324 cap chip
      if (el && BAGCAP_ON) { el.textContent = m.text; el.className = `hs-cap ${m.level || ''}`; }
    } catch {}
    const bagEl = panel.querySelector('[data-bag]'), chestEl = panel.querySelector('[data-chest]');
    bagEl.innerHTML = bag.length
      ? bag.map((s) => slotHtml(s, 'bag')).join('')
      : '<div class="hs-empty">backpack empty</div>';
    let chestHtml = chestItems.map((s) => slotHtml(s, 'chest')).join('');
    // Empty slot cells so dropping onto any area of the chest feels tangible
    const emptyN = Math.max(0, (ch.slots | 0) - used);
    const showEmpty = Math.min(emptyN, filter === 'all' ? 12 : 4);
    for (let i = 0; i < showEmpty; i++) chestHtml += '<div class="hs-slot hs-empty-slot" data-side="chest" data-empty="1" aria-hidden="true"></div>';
    chestEl.innerHTML = chestHtml || '<div class="hs-empty">chest empty · drag a backpack item over</div>';
    bindSlotEvents();
  }

  function bindSlotEvents() {
    for (const el of panel.querySelectorAll('.hs-slot:not(.hs-empty-slot)')) {
      el.onpointerdown = (e) => onSlotPointerDown(e, el);
      el.ondblclick = (e) => { e.preventDefault(); e.stopPropagation(); quickMove(el, el.dataset.qty | 0); };
      el.oncontextmenu = (e) => {
        e.preventDefault();
        if ((el.dataset.qty | 0) > 1 && isStackable(el.dataset.item)) openSplit(el, e.clientX, e.clientY);
      };
    }
    for (const btn of panel.querySelectorAll('.hs-split')) {
      btn.onclick = (e) => {
        e.preventDefault(); e.stopPropagation();
        const el = btn.closest('.hs-slot'); if (el) openSplit(el, e.clientX, e.clientY);
      };
      btn.onpointerdown = (e) => e.stopPropagation();
    }
  }

  function clearDrag() {
    if (drag?.gh) try { drag.gh.remove(); } catch {}
    if (drag?.el) drag.el.classList.remove('hs-from');
    panel.querySelectorAll('.hs-col.hs-drop').forEach((c) => c.classList.remove('hs-drop'));
    drag = null;
  }
  function hideSplit() { splitPop.classList.remove('on'); splitPop.innerHTML = ''; }

  function onSlotPointerDown(e, el) {
    if (busy || !activeId || e.button === 2) return;
    if (el.classList.contains('hs-empty-slot')) return;
    if (e.target?.closest?.('.hs-split')) return;
    // Equipped: block deposit attempts with a toast on click/drag end
    const sx = e.clientX, sy = e.clientY;
    drag = {
      side: el.dataset.side, item: el.dataset.item, qty: el.dataset.qty | 0,
      slot: el.dataset.slot != null ? (el.dataset.slot | 0) : -1,
      el, sx, sy, on: false, gh: null,
      shift: !!(e.shiftKey), alt: !!(e.altKey), btn: e.button | 0,
      pointerId: e.pointerId, equipped: el.classList.contains('eq'),
    };
    try { el.setPointerCapture?.(e.pointerId); } catch {}
    const move = (ev) => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      const dx = ev.clientX - drag.sx, dy = ev.clientY - drag.sy;
      if (!drag.on && (dx * dx + dy * dy) > 36) startDragGhost(ev.clientX, ev.clientY);
      if (drag.on) {
        if (drag.gh) { drag.gh.style.left = ev.clientX + 'px'; drag.gh.style.top = ev.clientY + 'px'; }
        highlightDrop(ev.clientX, ev.clientY);
      }
    };
    const up = (ev) => {
      if (!drag || ev.pointerId !== drag.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      finishDrag(ev.clientX, ev.clientY);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function startDragGhost(x, y) {
    if (!drag || drag.on) return;
    drag.on = true;
    drag.el.classList.add('hs-from');
    const info = itemInfo(drag.item) || { icon: '❔', name: drag.item, rarity: 'common' };
    const gh = document.createElement('div'); gh.id = 'hs-drag-ghost';
    const border = RARITY_COLOR[info.rarity] || '#ffcd77';
    gh.style.borderColor = border;
    gh.style.left = x + 'px'; gh.style.top = y + 'px';
    gh.innerHTML = `${ico(drag.item, info)}<span>${escHtml(shortName(info))}</span>${drag.qty > 1 ? `<b>×${drag.qty}</b>` : ''}`;
    document.body.appendChild(gh); drag.gh = gh;
  }

  function highlightDrop(x, y) {
    panel.querySelectorAll('.hs-col.hs-drop').forEach((c) => c.classList.remove('hs-drop'));
    if (!drag) return;
    const target = drag.side === 'bag' ? 'chest' : 'bag';
    const col = panel.querySelector(`.hs-col[data-pane="${target}"]`);
    if (!col) return;
    const r = col.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) col.classList.add('hs-drop');
  }

  function dropTarget(x, y) {
    if (!drag) return null;
    const want = drag.side === 'bag' ? 'chest' : 'bag';
    const col = panel.querySelector(`.hs-col[data-pane="${want}"]`);
    if (!col) return null;
    const r = col.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return want;
    return null;
  }

  async function finishDrag(x, y) {
    const d = drag; if (!d) return;
    const wasDrag = d.on;
    const target = wasDrag ? dropTarget(x, y) : null;
    const shift = d.shift || d.btn === 2;
    const alt = d.alt;
    const equipped = d.equipped;
    const el = d.el;
    clearDrag();
    if (equipped && (wasDrag ? target === 'chest' : d.side === 'bag')) {
      // click or drop attempt of equipped weapon
      if (!wasDrag || target) toast('🔒 EQUIPPED<br><small>unequip in Inventory first</small>', 2200);
      return;
    }
    if (wasDrag && target) {
      if (shift && d.qty > 1 && isStackable(d.item)) {
        openSplit(el, x, y); return;
      }
      const qty = alt && d.qty > 1 && isStackable(d.item) ? Math.ceil(d.qty / 2) : d.qty;
      await transfer(d.side, d.item, qty, d.slot);
      return;
    }
    if (!wasDrag) {
      // Tap / click without drag: full-stack quick move (mobile-friendly). Double-tap also covered by dblclick.
      const key = `${d.side}:${d.item}:${d.slot}`;
      const now = performance.now();
      const isDbl = lastTap.key === key && (now - lastTap.t) < 380;
      lastTap = { t: now, key };
      if (isDbl) { /* dblclick handler will fire; skip single */ return; }
      // single tap → full stack
      setTimeout(async () => {
        if (lastTap.key === key && lastTap.t === now) await quickMove(el, d.qty);
      }, 220);
    }
  }

  async function quickMove(el, qty) {
    if (!el || busy || !activeId) return;
    if (el.classList.contains('eq')) { toast('🔒 EQUIPPED<br><small>unequip in Inventory first</small>', 2200); return; }
    const side = el.dataset.side, item = el.dataset.item, q = Math.max(1, qty | el.dataset.qty | 0);
    const slot = el.dataset.slot != null ? (el.dataset.slot | 0) : -1;
    await transfer(side, item, q, slot);
  }

  function openSplit(el, x, y) {
    if (!el || busy) return;
    if (el.classList.contains('eq')) { toast('🔒 EQUIPPED<br><small>unequip in Inventory first</small>', 2200); return; }
    const side = el.dataset.side, item = el.dataset.item, qty = el.dataset.qty | 0;
    const slot = el.dataset.slot != null ? (el.dataset.slot | 0) : -1;
    if (qty <= 1 || !isStackable(item)) { quickMove(el, qty); return; }
    const info = itemInfo(item) || { icon: '❔', name: item };
    const dir = side === 'bag' ? 'Backpack ➔ Chest' : 'Chest ➔ Backpack';
    const half = Math.ceil(qty / 2);
    let cur = half;
    hideSplit();
    splitPop.innerHTML = `
      <div class="hs-sp-h">✂️ SPLIT STACK</div>
      <div class="hs-sp-sub">${ico(item, info)} <strong>${escHtml(shortName(info))}</strong> · ${escHtml(dir)} · ×${qty}</div>
      <div class="hs-sp-row">
        <button type="button" class="ghost" data-sp="-">−</button>
        <input type="range" min="1" max="${qty}" value="${cur}" data-sp-range>
        <button type="button" class="ghost" data-sp="+">+</button>
        <input type="number" min="1" max="${qty}" value="${cur}" data-sp-num>
      </div>
      <div class="hs-sp-pills">
        <button type="button" data-sp-set="1">1</button>
        <button type="button" data-sp-set="${half}">HALF (${half})</button>
        <button type="button" data-sp-set="${qty}">MAX (${qty})</button>
      </div>
      <div class="hs-sp-prev" data-sp-prev>Keep: ${qty - cur} · Move: ${cur}</div>
      <div class="hs-sp-actions">
        <button type="button" class="ghost" data-sp-cancel>CANCEL</button>
        <button type="button" data-sp-go>MOVE ${cur} ➔</button>
      </div>`;
    const sync = () => {
      cur = Math.max(1, Math.min(qty, cur | 0));
      splitPop.querySelector('[data-sp-range]').value = cur;
      splitPop.querySelector('[data-sp-num]').value = cur;
      splitPop.querySelector('[data-sp-prev]').textContent = `Keep: ${qty - cur} · Move: ${cur}`;
      splitPop.querySelector('[data-sp-go]').textContent = `MOVE ${cur} ➔`;
    };
    splitPop.querySelector('[data-sp-range]').oninput = (e) => { cur = e.target.value | 0; sync(); };
    splitPop.querySelector('[data-sp-num]').oninput = (e) => { cur = e.target.value | 0; sync(); };
    splitPop.querySelector('[data-sp="-"]').onclick = () => { cur -= 1; sync(); };
    splitPop.querySelector('[data-sp="+"]').onclick = () => { cur += 1; sync(); };
    for (const b of splitPop.querySelectorAll('[data-sp-set]')) b.onclick = () => { cur = b.dataset.spSet | 0; sync(); };
    splitPop.querySelector('[data-sp-cancel]').onclick = () => hideSplit();
    splitPop.querySelector('[data-sp-go]').onclick = async () => {
      hideSplit();
      await transfer(side, item, cur, slot);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { hideSplit(); window.removeEventListener('keydown', onKey); }
      if (e.key === 'Enter') { splitPop.querySelector('[data-sp-go]')?.click(); window.removeEventListener('keydown', onKey); }
    };
    window.addEventListener('keydown', onKey);
    // Position near pointer, clamp to viewport
    splitPop.classList.add('on');
    const vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(vw - 300, (x || vw / 2) - 140));
    const top = Math.max(8, Math.min(vh - 280, (y || vh / 2) - 40));
    splitPop.style.left = left + 'px'; splitPop.style.top = top + 'px';
    // click outside cancels
    setTimeout(() => {
      const outside = (e) => {
        if (!splitPop.contains(e.target)) { hideSplit(); window.removeEventListener('pointerdown', outside, true); window.removeEventListener('keydown', onKey); }
      };
      window.addEventListener('pointerdown', outside, true);
    }, 0);
  }

  async function transfer(side, item, qty, slot) {
    if (busy || !activeId || !item) return;
    // [v329] weapons always move 1 unit (never stack / never split multi)
    const q = String(item).startsWith('wpn:') ? 1 : Math.max(1, qty | 0);
    if (side === 'bag') await storeItem(item, q);
    else await takeItem(slot | 0, q);
  }

  async function storeItem(item, qty, gidOpt = null) {
    if (busy || !activeId) return;
    busy = true;
    try {
      let ok = false;
      try {
        let gid = gidOpt || (typeof window !== 'undefined' && window.PFP_GUN_STORE_GID) || null;
        if (!gid && String(item).startsWith('wpn:musket:') && typeof window !== 'undefined' && Array.isArray(window.PFP_GUN_INST)) {
          const g = window.PFP_GUN_INST.find((x) => x.place === 'bag' && x.item === item); gid = g?.gid || null;
        }
        const r = await invApi('house_store', { cottage: activeId, item, qty, ...(gid && String(item).startsWith('wpn:musket:') ? { gid } : {}) });
        try { if (typeof window !== 'undefined') window.PFP_GUN_STORE_GID = null; } catch {}
        if (r?.ok) {
          ok = true;
          owned[activeId] = { ...owned[activeId], slots: r.house?.slots || owned[activeId].slots, items: r.house?.items || [] };
          persistChest(activeId);
          try { await (typeof inventory === 'function' ? inventory() : inventory)?.refresh?.(); } catch {}
        } else if (r && r.error === 'equipped') { toast('🔒 EQUIPPED<br><small>unequip in Inventory first</small>', 1800); return; }
        else if (r && r.error === 'chest full') { toast('CHEST FULL', 1600); return; }
        else if (r && r.ok === false && r.error && !/offline|closed|fetch|network|abort|failed/i.test(String(r.error))) {
          toast(String(r.error || 'no').toUpperCase(), 1800); return;
        }
      } catch {}
      if (!ok) {
        // Offline local move — merge into existing stack even when chest is at capacity
        const ch = chestOf(activeId);
        const res = applyChestStore(ch.items || [], ch.slots, item, qty);
        if (!res.ok) { toast((res.why || 'chest full').toUpperCase(), 1600); return; }
        const st = lsLoad();
        const bag = Array.isArray(st.demoBag) ? st.demoBag : null;
        if (bag) {
          const row = bag.find((x) => x.item === item);
          if (row) {
            row.qty -= qty;
            if (row.qty <= 0) st.demoBag = bag.filter((x) => x.item !== item);
            lsSave(st);
          }
        }
        owned[activeId] = { ...owned[activeId], items: res.items }; persistChest(activeId);
      }
      sfx?.coin?.(); toast(qty > 1 ? `STORED ×${qty}` : 'STORED', 900); await renderStorage();
    } finally { busy = false; }
  }

  async function takeItem(slot, qty) {
    if (busy || !activeId) return;
    busy = true;
    try {
      let ok = false;
      try {
        const r = await invApi('house_take', { cottage: activeId, slot, qty });
        if (r?.ok) {
          ok = true;
          owned[activeId] = { ...owned[activeId], slots: r.house?.slots || owned[activeId].slots, items: r.house?.items || [] };
          persistChest(activeId);
          try { await (typeof inventory === 'function' ? inventory() : inventory)?.refresh?.(); } catch {}
        } else if (r && (r.full || /backpack full/i.test(String(r.error || '')))) { toast(BAG_FULL_MSG, 2200); return; } // [backpack-pvp]
        else if (r && r.ok === false && r.error && !/offline|closed|fetch|network|abort|failed/i.test(String(r.error))) {
          toast(String(r.error || 'no').toUpperCase(), 1800); return;
        }
      } catch {}
      if (!ok) {
        const row0 = (owned[activeId].items || []).find((x) => x.slot === slot); if (!row0) return;
        // [backpack-pvp] local 16-slot cap check (BANKSY ∞)
        const bagNow = await bagItems();
        const owner = !!(isUnlimitedBag({ name: (typeof localStorage !== 'undefined' && localStorage.getItem('pfp_name')) || '' }) || (typeof location !== 'undefined' && /[?&]banksy=1(&|$)/.test(location.search || '')));
        const eq = {};
        for (const s of bagNow) if (s.equipped && String(s.item).startsWith('wpn:sword:')) eq.sword = s.item;
        for (const s of bagNow) if (s.equipped && String(s.item).startsWith('wpn:musket:')) eq.musket = s.item;
        const check = canAcceptItem(bagNow.map((s) => ({ item: s.item, qty: s.qty })), row0.item, Math.min(qty, row0.qty), eq, { owner });
        if (!check.ok) { toast(BAG_FULL_MSG, 2200); return; }
        const res = applyChestTake(owned[activeId].items || [], slot, qty);
        if (!res.ok) return;
        const st = lsLoad();
        st.demoBag = st.demoBag || [];
        // [v329] weapons never stack in the offline bag either (attachments / per-unit identity)
        if (String(res.taken.item).startsWith('wpn:')) {
          for (let i = 0; i < (res.taken.qty | 0); i++) st.demoBag.push({ item: res.taken.item, qty: 1, equipped: false, meta: res.taken.meta || undefined });
        } else {
          const bag = st.demoBag.find((x) => x.item === res.taken.item);
          if (bag) bag.qty += res.taken.qty;
          else st.demoBag.push({ item: res.taken.item, qty: res.taken.qty, equipped: false });
        }
        lsSave(st);
        owned[activeId].items = res.items; persistChest(activeId);
      }
      sfx?.coin?.(); toast(qty > 1 ? `WITHDRAWN ×${qty}` : 'WITHDRAWN', 900); await renderStorage();
    } finally { busy = false; }
  }

  async function upgradeChest() {
    if (!activeId || busy) return;
    const gold = getGold() | 0;
    if (gold < UPGRADE_PRICE) { toast(`NEED ${UPGRADE_PRICE.toLocaleString()} GOLD`, 1800); return; }
    busy = true;
    try {
      let ok = false;
      try {
        const r = await invApi('house_upgrade', { cottage: activeId, req: reqId() });
        if (r?.ok) {
          ok = true;
          if (!r.owner && !r.retry) spendGold(r.price ?? UPGRADE_PRICE);
          owned[activeId] = { ...owned[activeId], slots: r.slots || (owned[activeId].slots + UPGRADE_SLOTS), items: r.house?.items || owned[activeId].items };
          persistChest(activeId); saveGold();
        }
      } catch {}
      if (!ok) {
        if (!spendGold(UPGRADE_PRICE)) { toast('NOT ENOUGH GOLD', 1600); return; }
        owned[activeId].slots = Math.min(120, (owned[activeId].slots | 0) + UPGRADE_SLOTS);
        if (owned[activeId].slots >= 60) owned[activeId].tier = 'manor';
        else if (owned[activeId].slots >= 40) owned[activeId].tier = 'captain';
        persistChest(activeId); saveGold();
      }
      sfx?.coin?.(); toast('CHEST UPGRADED!', 1800); await renderStorage();
    } finally { busy = false; }
  }

  function nearestDoor(W) {
    let best = null, bd = 1e9;
    for (const d of doors) {
      const dist = Math.hypot(d.x - W.x, d.z - W.z);
      if (dist < (d.r || 2.6) && dist < bd) { bd = dist; best = d; }
    }
    return best;
  }

  function prompts({ onFoot, W }) {
    if (!onFoot || !W) return null;
    if (inHouse && interior && roomOrigin) {
      const lx = W.x - roomOrigin.x, lz = W.z - roomOrigin.z;
      const spots = interior.userData.spots;
      const dChest = Math.hypot(spots.chest.x - lx, spots.chest.z - lz);
      const dExit = Math.hypot(spots.exit.x - lx, spots.exit.z - lz);
      // [v320] proximity prompts (BANKSY t1690u "Put chest off to side and allow them to walk to door to exit"):
      // walk up to the side chest = OPEN STORAGE, walk up to the front door = EXIT TO ISLAND, mid-cabin = no banner
      // (the LEAVE COTTAGE button in #hs-panel stays as an extra way out)
      if (dChest < (spots.chest.r || 2.2) && dChest <= dExit) {
        const a = { label: 'OPEN STORAGE', key: 'E', primary: true, tag: 'chest' };
        return { label: a.label, key: a.key, primary: a.primary, tag: a.tag, a: { ...a }, b: null };
      }
      if (dExit < (spots.exit.r || 2.4)) {
        const a = { label: 'EXIT TO ISLAND', key: 'E', primary: true, tag: 'exit' };
        return { label: a.label, key: a.key, primary: a.primary, tag: a.tag, a: { ...a }, b: null };
      }
      return null;
    }
    const d = nearestDoor(W); if (!d) return null;
    if (isOwned(d.id)) return { label: 'ENTER COTTAGE', key: 'E', primary: true, tag: 'enter', door: d };
    return { label: `BUY COTTAGE · ${HOUSE_PRICE.toLocaleString()}g`, key: 'E', primary: true, tag: 'buy', door: d };
  }

  function act(tag, ctx) {
    if (tag === 'buy' && ctx?.door) return buyCottage(ctx.door);
    if (tag === 'enter' && ctx?.door) return enterHouse(ctx.door);
    if (tag === 'exit') return exitHouse();
    if (tag === 'chest') return openStorage();
  }

  function softPushAABB(w, col) {
    // Harbor-frame oriented AABB soft push (active only while fallback exteriors are live).
    const cos = Math.cos(-col.ry), sin = Math.sin(-col.ry);
    const dx = w.x - col.x, dz = w.z - col.z;
    const lx = dx * cos - dz * sin, lz = dx * sin + dz * cos;
    const hw = col.w / 2, hd = col.d / 2;
    if (Math.abs(lx) > hw || Math.abs(lz) > hd) return;
    const px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
    let nlx = lx, nlz = lz;
    if (px < pz) nlx = Math.sign(lx || 1) * hw;
    else nlz = Math.sign(lz || 1) * hd;
    const rx = nlx * cos + nlz * sin, rz = -nlx * sin + nlz * cos;
    w.x = col.x + rx; w.z = col.z + rz;
  }

  function tick(dt) {
    // Late-detect Post's village so we never double-draw cottages after merge.
    if (!postReady) {
      try {
        const hit = scene.getObjectByName('area_cottages');
        if (hit) markPostReady(FALLBACK_COTTAGES);
      } catch {}
    }
    // Outdoor soft colliders for fallback cottages only (Post owns its own blockers).
    if (!inHouse && fallbackExteriors?.userData?.colliders && walker?.w) {
      for (const col of fallbackExteriors.userData.colliders) softPushAABB(walker.w, col);
    }
    if (!inHouse || !interior || !roomOrigin) return;
    const w = walker.w;
    // Ceiling clamp (world.ground/water pocket handles floor + dry standing; world.blocked handles walls/furniture)
    const ceilY = roomOrigin.y + interior.userData.H - 1.75;
    if (w.y > ceilY) {
      w.y = ceilY;
      if (w.body) { w.body.y = w.y; if (w.body.vy > 0) w.body.vy = 0; }
    }
    const lx = w.x - roomOrigin.x, lz = w.z - roomOrigin.z;
    const halfW = interior.userData.W / 2 - 0.55, halfD = interior.userData.D / 2 - 0.55;
    w.x = roomOrigin.x + Math.max(-halfW, Math.min(halfW, lx));
    w.z = roomOrigin.z + Math.max(-halfD, Math.min(halfD, lz));
    try { pirate.object.position.set(w.x, w.y, w.z); pirate.object.rotation.order = 'YXZ'; pirate.object.rotation.set(0, w.yaw, 0); pirate.object.visible = true; } catch {}
    applyIndoorCam();
    // Keep outdoor peers hidden
    for (const [id, p] of fnet.peers) {
      if (p.pirate?.object?.visible) { p.pirate.object.visible = false; hiddenPeers.add(id); }
    }
    // Ember + flame + firelight flicker + dust/sparks drift
    try {
      const t = game?.t || performance.now() / 1000;
      const ud = interior.userData || {};
      if (ud.fireLight) ud.fireLight.intensity = (low ? 3.2 : 5.4) + 0.7 * Math.sin(t * 7.3) + 0.4 * Math.sin(t * 13.1);
      if (ud.chLight) ud.chLight.intensity = (low ? 2.2 : 3.5) + 0.3 * Math.sin(t * 2.7 + 1.1);
      interior.traverse((c) => {
        const k = c.material?.userData?.key;
        if (k === 'hs-ember' && c.scale) c.scale.setScalar(0.9 + 0.15 * Math.sin(t * 6));
        if (k === 'hs-flame' && c.scale) {
          const ph = (c.id || 1) * 1.7;
          c.scale.set(0.85 + 0.2 * Math.sin(t * 9 + ph), 0.9 + 0.25 * Math.sin(t * 11 + ph), 0.85 + 0.2 * Math.cos(t * 8 + ph));
        }
        if (c.name === 'hs_dust' && c.geometry?.attributes?.position) {
          const arr = c.geometry.attributes.position.array;
          for (let i = 0; i < arr.length; i += 3) {
            arr[i] += Math.sin(t * 0.7 + i) * 0.0008;
            arr[i + 1] += 0.004 + Math.sin(t * 1.3 + i * 0.2) * 0.002;
            if (arr[i + 1] > 3.2) arr[i + 1] = 0.55;
          }
          c.geometry.attributes.position.needsUpdate = true;
        }
        if (c.name === 'hs_sparks' && c.geometry?.attributes?.position) {
          const arr = c.geometry.attributes.position.array;
          const hz0 = -(ud.D || 10) / 2 + 0.55;
          for (let i = 0; i < arr.length; i += 3) {
            arr[i + 1] += 0.012 + (i % 5) * 0.0015;
            arr[i] += Math.sin(t * 4 + i) * 0.002;
            if (arr[i + 1] > 2.6) {
              arr[i] = (Math.random() - 0.5) * 0.8;
              arr[i + 1] = 0.45 + Math.random() * 0.2;
              arr[i + 2] = hz0 + 0.55 + Math.random() * 0.45;
            }
          }
          c.geometry.attributes.position.needsUpdate = true;
        }
      });
    } catch {}
  }

  function netState() {
    if (!inHouse || !doorHold) return {};
    // Keep lobby seat alive: freeze outdoor pose at the cottage door + ih flag
    return {
      ih: 1,
      ft: [Math.round(doorHold.x * 2) / 2, Math.round(doorHold.z * 2) / 2, Math.round(doorHold.yaw * 20) * 5, 0],
    };
  }

  function onPeerState(m) {
    if (!m || !m.i) return;
    const p = fnet.peers.get(m.i);
    if (!p) return;
    if (m.ih === 1) {
      if (p.pirate?.object) p.pirate.object.visible = false;
      hiddenPeers.add(m.i);
    } else if (!inHouse && hiddenPeers.has(m.i)) {
      if (p.pirate?.object) p.pirate.object.visible = true;
      hiddenPeers.delete(m.i);
    }
  }

  function clear() {
    closeStorage();
    if (inHouse) {
      try { const w = walker?.w; if (w) { w.camHook = w._hsCamPrev || null; w._hsCamPrev = null; w._hsY = null; } } catch {}
      if (interior) { scene.remove(interior); interior = null; }
      try { if (world?.root) world.root.visible = world.root.userData._hsVis !== false; } catch {}
      try { if (ocean?.mesh) ocean.mesh.visible = ocean.mesh.userData._hsVis !== false; } catch {}
      try { if (islands?.group) islands.group.visible = islands.group.userData._hsVis !== false; } catch {}
      try { plaques.visible = true; } catch {}
      try { if (fallbackExteriors) fallbackExteriors.visible = true; } catch {}
      try { if (scene.fog && '_hsFogDens' in scene.userData) scene.fog.density = scene.userData._hsFogDens; if ('_hsBg' in scene.userData) scene.background = scene.userData._hsBg; } catch {}
      try {
        for (const h of (scene.userData._hsOutLights || [])) { try { h.light.visible = h.vis !== false; if (h.intensity != null) h.light.intensity = h.intensity; } catch {} }
        scene.userData._hsOutLights = null;
        if ('_hsEnv' in scene.userData) { scene.environment = scene.userData._hsEnv; delete scene.userData._hsEnv; }
        if ('_hsEnvInt' in scene.userData) { scene.environmentIntensity = scene.userData._hsEnvInt; delete scene.userData._hsEnvInt; }
      } catch {}
      inHouse = false; activeId = null; doorHold = null; roomOrigin = null;
      document.documentElement.classList.remove('pfp-inhouse');
    }
    for (const id of hiddenPeers) { const p = fnet.peers.get(id); if (p?.pirate?.object) p.pirate.object.visible = true; }
    hiddenPeers.clear();
  }

  return {
    on: true,
    get inHouse() { return inHouse; },
    get storageOpen() { return storageOpen; },
    get doors() { return doors; },
    get owned() { return owned; },
    cottages: () => cottages,
    get postReady() { return postReady; },
    get fallbackExteriors() { return fallbackExteriors; },
    prompts, act, tick, netState, onPeerState, clear, syncState, buyCottage, enterHouse, exitHouse, openStorage, closeStorage,
    // test helpers
    _forceOwn(id) { owned[id] = { tier: (owned[id] && owned[id].tier) || 'cozy', slots: (owned[id] && owned[id].slots) || 24, items: (owned[id] && owned[id].items) || [] }; persistChest(id); return owned[id]; },
    _setDemoBag(items) { const st = lsLoad(); st.demoBag = items; lsSave(st); },
    _renderStorage: () => renderStorage(),
    _openSplit: (el, x, y) => openSplit(el, x, y),
    _storeItem: (item, qty) => storeItem(item, qty),
    _takeItem: (slot, qty) => takeItem(slot, qty),
    _transfer: (side, item, qty, slot) => transfer(side, item, qty, slot),
  };
}
