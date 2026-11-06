// [Emerly storage-houses] BANKSY: buyable cottages as item storage — step inside → private instanced room,
// main-server spot stays reserved (ih:1). Kill switch: &houses=0.
// Doors auto-bind to Post's cottage village (js/island/areas/cottages.js) when present; otherwise the same
// 4 doorsteps (Build Mode markers + future Post doors) so post/cottages merges cleanly.
import * as THREE from 'three';
import { itemInfo, RARITY_COLOR } from '../inventory/catalog.js';
import { invApi } from '../pvpSave.js';

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
  if (info.kind === 'valuable') return `${IMG_DIR}val_${p[1]}.webp`;
  if (info.kind === 'weapon') return `${IMG_DIR}wpn_${info.slot}_${info.base}.webp`;
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
#hs-badge{position:fixed;left:50%;top:calc(var(--safe-t,0px) + 92px);transform:translateX(-50%);z-index:9;pointer-events:none;font:20px 'Just Another Hand',cursive;letter-spacing:.04em;color:#ffcd77;background:rgba(22,14,8,.82);border:2px solid #ffcd77;border-radius:999px;padding:2px 14px 0;white-space:nowrap;display:none;box-shadow:0 2px 10px #000}
#hs-panel{position:fixed;inset:0;z-index:64;display:none;align-items:center;justify-content:center;background:rgba(10,7,4,.72);font-family:'Just Another Hand',cursive;color:#f4e2bb;touch-action:manipulation}
#hs-panel.on{display:flex}
#hs-panel .hs-box{width:min(860px,96vw);max-height:min(92vh,720px);display:flex;flex-direction:column;background:linear-gradient(#2a1a0c,#1a1008);border:3px solid #ffcd77;border-radius:16px;box-shadow:0 12px 40px #000}
#hs-panel .hs-head{display:flex;align-items:center;gap:10px;padding:10px 14px 4px;font-size:30px;color:#ffcd77}
#hs-panel .hs-head small{flex:1;font-size:18px;color:#cdb68c}
#hs-panel .hs-x{width:44px;height:44px;border-radius:50%;border:2px solid #ffcd77;background:#1a0f07;color:#ffcd77;font-size:22px;cursor:pointer}
#hs-panel .hs-cols{flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:6px 12px 12px}
#hs-panel .hs-col{display:flex;flex-direction:column;min-height:0;border:2px solid #6b4a24;border-radius:12px;background:#1a1008}
#hs-panel .hs-col h4{margin:0;padding:6px 10px 2px;font-size:22px;color:#ffcd77;letter-spacing:.04em;border-bottom:2px solid rgba(255,205,119,.25)}
#hs-panel .hs-grid{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px;padding:8px}
#hs-panel .hs-slot{position:relative;aspect-ratio:1;border-radius:10px;border:3px solid #6b4a24;background:radial-gradient(#4a3018,#24160a);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;padding:2px}
#hs-panel .hs-slot.eq{opacity:.55}#hs-panel .hs-slot.eq::after{content:'EQUIPPED';position:absolute;left:2px;right:2px;bottom:2px;font:bold 9px system-ui,sans-serif;color:#ffcd77;text-align:center;background:rgba(0,0,0,.55);border-radius:4px}
#hs-panel .hs-slot i{font-style:normal;font-size:28px;line-height:1;display:flex;align-items:center;justify-content:center;width:62%;aspect-ratio:1}
#hs-panel .hs-slot img{width:100%;height:100%;object-fit:contain}
#hs-panel .hs-slot span{font-size:12px;line-height:1.05;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}
#hs-panel .hs-slot b{position:absolute;right:4px;bottom:2px;font:bold 12px system-ui,sans-serif}
#hs-panel .hs-foot{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:4px 14px 12px;border-top:2px solid rgba(255,205,119,.25)}
#hs-panel .hs-foot button{font:20px 'Just Another Hand',cursive;padding:6px 12px 4px;border-radius:10px;border:2px solid #ffcd77;background:#5a3410;color:#fff;cursor:pointer}
#hs-panel .hs-foot button.ghost{background:#1a0f07;color:#ffcd77}
#hs-panel .hs-empty{grid-column:1/-1;text-align:center;padding:28px 8px;opacity:.75;font-size:22px}
@media (max-width:620px){#hs-panel .hs-cols{grid-template-columns:1fr}}
`;

function ico(key, info) {
  const u = itemImg(key, info);
  return u ? `<i><img src="${u}" alt="" loading="lazy" decoding="async" onerror="this.replaceWith(document.createTextNode('${info.icon || '❔'}'))"></i>` : `<i>${info.icon || '❔'}</i>`;
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

/** Warm shaded pirate cabin interior (Lambert + 1 hemi + 1 dir light; glow panes stay Basic). */
export function buildInteriorRoom({ tier = 'cozy', low = false } = {}) {
  const g = new THREE.Group(); g.name = 'house_interior';
  const W = tier === 'manor' ? 14 : tier === 'captain' ? 12 : 10;
  const D = tier === 'manor' ? 12 : tier === 'captain' ? 10.5 : 9;
  const H = 4.2;
  const wood = matL(0x9a6234, 'hs-wood'), woodD = matL(0x5a3418, 'hs-woodd'), woodL = matL(0xc48a4e, 'hs-woodl');
  const plaster = matL(0xf3e6c8, 'hs-plaster'), stone = matL(0x8a837a, 'hs-stone'), stoneD = matL(0x6a635a, 'hs-stoned');
  const gold = matL(0xc89b54, 'hs-gold'), iron = matL(0x2b2f36, 'hs-iron');
  const rug = matL(0x8b1e1e, 'hs-rug'), rugGold = matL(0xc9a24b, 'hs-ruggold');
  const sheet = matL(0xd9c4a0, 'hs-sheet'), blanket = matL(0x3a5a7a, 'hs-blanket'), pillow = matL(0xe8dcc0, 'hs-pillow');
  const chart = matL(0xc9a66b, 'hs-chart'), glow = matGlow(0xffcf66, 'hs-glow'), ember = matGlow(0xff6a2a, 'hs-ember');
  const add = (geo, m, x, y, z, ry = 0, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.order = 'YXZ'; mesh.rotation.y = ry; mesh.rotation.x = rx;
    mesh.castShadow = mesh.receiveShadow = false; g.add(mesh); return mesh;
  };
  // Warm room lights (only live while interior is in the scene / inHouse)
  const hemi = new THREE.HemisphereLight(0xffe6ba, 0x5c3a1e, 1.15); hemi.name = 'hs_hemi'; g.add(hemi);
  const dir = new THREE.DirectionalLight(0xffd28a, 0.85); dir.position.set(2.5, 5.5, 3.5); dir.name = 'hs_dir'; g.add(dir);

  // Oak plank floor (alternating tones) + smaller centered rug
  add(new THREE.BoxGeometry(W, 0.28, D), wood, 0, 0, 0);
  for (let i = 0; i < 9; i++) {
    const z = -D / 2 + 0.35 + i * ((D - 0.7) / 8);
    add(new THREE.BoxGeometry(W - 0.35, 0.04, 0.55), i % 2 ? woodL : wood, 0, 0.15, z);
  }
  add(new THREE.BoxGeometry(4.4, 0.05, 3.2), rugGold, 0, 0.175, 0.15);
  add(new THREE.BoxGeometry(4.2, 0.055, 3.0), rug, 0, 0.185, 0.15);

  // Ceiling + rafters
  add(new THREE.BoxGeometry(W + 0.4, 0.22, D + 0.4), woodD, 0, H, 0);
  for (let i = -3; i <= 3; i++) add(new THREE.BoxGeometry(0.2, 0.28, D - 0.5), woodD, i * (W / 7), H - 0.22, 0);

  // Plaster walls + timber studs + wainscoting
  for (const [x, z, w, d] of [[0, -D / 2, W + 0.3, 0.28], [0, D / 2, W + 0.3, 0.28], [-W / 2, 0, 0.28, D], [W / 2, 0, 0.28, D]]) {
    add(new THREE.BoxGeometry(w, H, d), plaster, x, H / 2, z);
  }
  // Wainscoting band
  for (const [x, z, w, d] of [[0, -D / 2 + 0.08, W - 0.2, 0.1], [0, D / 2 - 0.08, W - 0.2, 0.1], [-W / 2 + 0.08, 0, 0.1, D - 0.2], [W / 2 - 0.08, 0, 0.1, D - 0.2]]) {
    add(new THREE.BoxGeometry(w, 1.1, d), woodD, x, 0.55, z);
  }
  // Vertical studs on long walls
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    add(new THREE.BoxGeometry(0.12, H - 0.3, 0.1), woodD, i * (W / 7), H / 2, -D / 2 + 0.16);
    add(new THREE.BoxGeometry(0.12, H - 0.3, 0.1), woodD, i * (W / 7), H / 2, D / 2 - 0.16);
  }

  // Framed glowing windows
  const winSpecs = [[-W * 0.28, -D / 2 + 0.18], [W * 0.28, -D / 2 + 0.18], [-W / 2 + 0.18, 0], [W / 2 - 0.18, 0]];
  for (const [x, z] of winSpecs) {
    const side = Math.abs(x) > Math.abs(z);
    add(new THREE.BoxGeometry(side ? 0.14 : 1.35, 1.65, side ? 1.35 : 0.14), woodD, x, 2.15, z);
    add(new THREE.BoxGeometry(side ? 0.08 : 1.05, 1.35, side ? 1.05 : 0.08), glow, x + (side ? Math.sign(x) * 0.04 : 0), 2.15, z + (side ? 0 : Math.sign(z) * 0.04));
    add(new THREE.BoxGeometry(side ? 0.05 : 0.06, 1.35, side ? 0.06 : 0.05), woodD, x + (side ? Math.sign(x) * 0.07 : 0), 2.15, z + (side ? 0 : Math.sign(z) * 0.07));
    add(new THREE.BoxGeometry(side ? 0.05 : 1.05, 0.06, side ? 1.05 : 0.05), woodD, x + (side ? Math.sign(x) * 0.07 : 0), 2.15, z + (side ? 0 : Math.sign(z) * 0.07));
    add(new THREE.BoxGeometry(side ? 0.2 : 1.45, 0.12, side ? 1.45 : 0.2), stoneD, x, 1.25, z);
  }

  // Stone hearth + mantle
  add(new THREE.BoxGeometry(2.8, 2.8, 1.0), stone, 0, 1.4, -D / 2 + 0.55);
  add(new THREE.BoxGeometry(3.1, 0.22, 1.15), woodD, 0, 2.85, -D / 2 + 0.6); // mantle
  add(new THREE.BoxGeometry(1.5, 1.15, 0.55), iron, 0, 0.95, -D / 2 + 0.9);
  add(new THREE.BoxGeometry(1.2, 0.35, 0.4), ember, 0, 0.55, -D / 2 + 1.05);
  add(new THREE.SphereGeometry(0.24, 8, 6), glow, 0, 1.05, -D / 2 + 1.1);

  // Captain's bunk + pillow + folded blanket
  add(new THREE.BoxGeometry(2.5, 0.4, 1.35), woodD, -W / 2 + 1.7, 0.45, D / 2 - 1.5);
  add(new THREE.BoxGeometry(2.3, 0.16, 1.2), sheet, -W / 2 + 1.7, 0.72, D / 2 - 1.5);
  add(new THREE.BoxGeometry(0.7, 0.22, 0.55), pillow, -W / 2 + 0.95, 0.92, D / 2 - 1.5);
  add(new THREE.BoxGeometry(1.1, 0.14, 1.15), blanket, -W / 2 + 2.3, 0.86, D / 2 - 1.5);

  // Table + sea chart + rum bottle + mug
  add(new THREE.BoxGeometry(1.9, 0.12, 1.15), wood, W / 2 - 2.1, 0.88, 0.35);
  for (const s of [-1, 1]) for (const t of [-1, 1])
    add(new THREE.BoxGeometry(0.12, 0.88, 0.12), woodD, W / 2 - 2.1 + s * 0.75, 0.44, 0.35 + t * 0.42);
  add(new THREE.BoxGeometry(1.25, 0.02, 0.85), chart, W / 2 - 2.1, 0.96, 0.35);
  add(new THREE.CylinderGeometry(0.1, 0.12, 0.38, 8), matL(0x3a1a10, 'hs-bottle'), W / 2 - 1.45, 1.12, 0.0);
  add(new THREE.CylinderGeometry(0.12, 0.1, 0.22, 8), matL(0x6b4527, 'hs-mug'), W / 2 - 1.55, 1.05, 0.55);

  // Weapon rack
  add(new THREE.BoxGeometry(0.2, 2.2, 1.7), woodD, -W / 2 + 0.35, 1.4, -0.15);
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.08, 1.45, 0.08), iron, -W / 2 + 0.55, 1.5, -0.7 + i * 0.5, 0.28);

  // Corner barrel + crate
  add(new THREE.CylinderGeometry(0.42, 0.46, 0.95, 10), wood, W / 2 - 0.7, 0.55, -D / 2 + 1.2);
  add(new THREE.BoxGeometry(0.7, 0.55, 0.7), woodD, W / 2 - 0.7, 0.35, -D / 2 + 2.1);

  // Brass-banded oak chest with beveled lid
  const chest = new THREE.Group(); chest.name = 'house_chest';
  const cBase = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.72, 0.95), wood); cBase.position.y = 0.36; chest.add(cBase);
  for (const sx of [-0.52, 0, 0.52]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.74, 0.98), gold); b.position.set(sx, 0.37, 0); chest.add(b);
  }
  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.22, 0.96), woodD); lid.position.set(0, 0.86, 0); chest.add(lid);
  const bevel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.12, 0.86), wood); bevel.position.set(0, 1.0, 0); chest.add(bevel);
  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.12), gold); lock.position.set(0, 0.58, 0.5); chest.add(lock);
  chest.position.set(0.15, 0.14, D / 2 - 2.25); g.add(chest);

  // Exit door (+Z)
  const door = new THREE.Group(); door.name = 'house_exit';
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.7, 0.22), stoneD); frame.position.y = 1.35; door.add(frame);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.35, 0.12), woodD); panel.position.set(0, 1.25, 0.1); door.add(panel);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), gold); knob.position.set(0.42, 1.2, 0.22); door.add(knob);
  door.position.set(0, 0.14, D / 2 - 0.08); g.add(door);
  add(new THREE.SphereGeometry(0.15, 8, 6), glow, 1.25, 2.55, D / 2 - 0.35);

  const colliders = [
    { x: 0, z: -D / 2, w: W + 1, d: 0.5 }, { x: 0, z: D / 2, w: W + 1, d: 0.5 },
    { x: -W / 2, z: 0, w: 0.5, d: D }, { x: W / 2, z: 0, w: 0.5, d: D },
    { x: 0, z: -D / 2 + 0.7, w: 2.9, d: 1.1 },
    { x: -W / 2 + 1.7, z: D / 2 - 1.5, w: 2.6, d: 1.5 },
    { x: W / 2 - 2.1, z: 0.35, w: 2.1, d: 1.4 },
    { x: 0.15, z: D / 2 - 2.25, w: 1.6, d: 1.15 },
    { x: W / 2 - 0.7, z: -D / 2 + 1.6, w: 1.3, d: 2.0 },
  ];
  const spots = {
    chest: { x: 0.15, z: D / 2 - 2.25 - 1.45, r: 2.2, kind: 'house_chest', label: 'OPEN STORAGE' },
    exit: { x: 0, z: D / 2 - 1.65, r: 2.0, kind: 'house_exit', label: 'EXIT TO ISLAND' },
  };
  g.userData = { W, D, H, tier, colliders, spots, chest, door };
  return g;
}

export function createHouses({
  scene, world, layout, walker, pirate, crewF, petF, fnet, camera = null,
  toast = () => {}, sfx = null, fadeTo = (fn) => fn(),
  getGold = () => 0, spendGold = () => false, saveGold = () => {},
  inventory = null, pvp = () => null, low = false, game = null,
  ocean = null, islands = null,
}) {
  if (!HOUSES_ON) {
    return { on: false, inHouse: false, prompts: () => null, tick() {}, netState: () => ({}), onPeerState() {}, clear() {}, act() {}, doors: [], storageOpen: false };
  }
  if (!document.getElementById('hs-css')) {
    const s = document.createElement('style'); s.id = 'hs-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  const badge = document.createElement('div'); badge.id = 'hs-badge'; badge.textContent = '🏠 INSIDE COTTAGE · SERVER SPOT RESERVED';
  document.body.appendChild(badge);

  const panel = document.createElement('div'); panel.id = 'hs-panel';
  panel.innerHTML = `<div class="hs-box" role="dialog" aria-label="Cottage Storage">
    <div class="hs-head"><span>🏠 COTTAGE STORAGE</span><small data-sub></small><button type="button" class="hs-x" aria-label="Close">✕</button></div>
    <div class="hs-cols">
      <div class="hs-col"><h4>YOUR BACKPACK</h4><div class="hs-grid" data-bag></div></div>
      <div class="hs-col"><h4>HOUSE CHEST <span data-cap></span></h4><div class="hs-grid" data-chest></div></div>
    </div>
    <div class="hs-foot">
      <button type="button" data-a="upgrade">UPGRADE CHEST +${UPGRADE_SLOTS} SLOTS · ${UPGRADE_PRICE.toLocaleString()}g</button>
      <button type="button" class="ghost" data-a="close">CLOSE</button>
    </div>
  </div>`;
  document.body.appendChild(panel);
  panel.querySelector('.hs-x').onclick = () => closeStorage();
  panel.querySelector('[data-a="close"]').onclick = () => closeStorage();
  panel.querySelector('[data-a="upgrade"]').onclick = () => upgradeChest();
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) panel.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  let cottages = resolveCottages(null);
  let postReady = false;
  let doors = []; // harbor-frame interact points
  let owned = {}; // id -> { tier, slots, items: [{slot,item,qty}] }
  let inHouse = false, activeId = null, doorHold = null, storageOpen = false, busy = false;
  let interior = null, roomOrigin = null; // harbor-frame origin of interior pocket
  let fallbackExteriors = null; // low-poly cottages when Post's area_cottages is absent
  const plaques = new THREE.Group(); plaques.name = 'house_plaques'; scene.add(plaques);
  const hiddenPeers = new Set();

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
    interior = buildInteriorRoom({ tier, low });
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
    const yaw = w.camYaw || w.yaw;
    const dist = Math.min(4.8, Math.max(4.2, w.dist || 4.5));
    let cx = w.x - Math.sin(yaw) * dist;
    let cz = w.z - Math.cos(yaw) * dist;
    const camHalfW = interior.userData.W / 2 - 0.25, camHalfD = interior.userData.D / 2 - 0.25;
    cx = roomOrigin.x + Math.max(-camHalfW, Math.min(camHalfW, cx - roomOrigin.x));
    cz = roomOrigin.z + Math.max(-camHalfD, Math.min(camHalfD, cz - roomOrigin.z));
    camera.position.set(cx, w.y + 2.55, cz);
    camera.lookAt(w.x, w.y + 1.35, w.z);
    camera.updateMatrixWorld?.(true);
  }

  function enterHouse(d) {
    if (!isOwned(d.id) || inHouse) return;
    fadeTo(() => {
      doorHold = { x: d.x, z: d.z, yaw: d.yaw, id: d.id, fx: d.fx, fz: d.fz, fyaw: d.fyaw };
      const { ox, oy, oz } = placeInterior(d);
      const w = walker.w;
      w.x = ox + 0.4; w.z = oz + 0.15; w.y = oy + 0.2; w.yaw = Math.PI; w.camYaw = Math.PI; w.pitch = 0.06;
      w.vy = 0; w.speed = 0; w.dist = 4.5;
      // Soft floor override while indoors
      w._hsY = oy + 0.14;
      // Own the walker camera boom so outdoor camPos / world.ground pull-in never collapses the 4.5 m shot
      w._hsCamPrev = w.camHook;
      w.camHook = () => { if (w._hsY != null) w.y = w._hsY; applyIndoorCam(); };
      pirate.object.visible = true;
      try { pirate.object.position.set(w.x, w.y, w.z); pirate.object.rotation.y = w.yaw; } catch {}
      crewF?.enter?.(); petF?.enter?.(w);
      // Hide outdoor foot peers while inside
      for (const [id, p] of fnet.peers) { if (p.pirate?.object) { p.pirate.object.visible = false; hiddenPeers.add(id); } }
      // Hide outdoor island / ocean / sky so the enclosed room reads cleanly (spot still reserved on the wire)
      try { if (world?.root) { world.root.userData._hsVis = world.root.visible; world.root.visible = false; } } catch {}
      try { if (ocean?.mesh) { ocean.mesh.userData._hsVis = ocean.mesh.visible; ocean.mesh.visible = false; } } catch {}
      try { if (islands?.group) { islands.group.userData._hsVis = islands.group.visible; islands.group.visible = false; } } catch {}
      try { plaques.visible = false; } catch {}
      try { if (fallbackExteriors) fallbackExteriors.visible = false; } catch {}
      try {
        if (scene.fog) { scene.userData._hsFogDens = scene.fog.density; scene.fog.density = 0; }
        scene.userData._hsBg = scene.background; scene.background = new THREE.Color(0x1a1008);
      } catch {}
      inHouse = true; activeId = d.id; badge.style.display = 'block';
      document.documentElement.classList.add('pfp-inhouse');
      toast('WELCOME HOME<br><small>server spot reserved</small>', 2200);
    });
  }

  function exitHouse() {
    if (!inHouse || !doorHold) return;
    const hold = doorHold;
    fadeTo(() => {
      closeStorage();
      if (interior) { scene.remove(interior); interior = null; }
      const w = walker.w;
      w.x = hold.x; w.z = hold.z; w.y = world.ground?.(hold.x, hold.z) || 2; w.yaw = hold.yaw; w.camYaw = hold.yaw; w.pitch = 0.12;
      w._hsY = null; w.vy = 0; w.speed = 0;
      w.camHook = w._hsCamPrev || null; w._hsCamPrev = null;
      for (const id of hiddenPeers) { const p = fnet.peers.get(id); if (p?.pirate?.object) p.pirate.object.visible = true; }
      hiddenPeers.clear();
      try { if (world?.root) world.root.visible = world.root.userData._hsVis !== false; } catch {}
      try { if (ocean?.mesh) ocean.mesh.visible = ocean.mesh.userData._hsVis !== false; } catch {}
      try { if (islands?.group) islands.group.visible = islands.group.userData._hsVis !== false; } catch {}
      try { plaques.visible = true; } catch {}
      try { if (fallbackExteriors) fallbackExteriors.visible = true; } catch {}
      try { if (scene.fog && '_hsFogDens' in scene.userData) scene.fog.density = scene.userData._hsFogDens; if ('_hsBg' in scene.userData) scene.background = scene.userData._hsBg; } catch {}
      inHouse = false; activeId = null; doorHold = null; roomOrigin = null; badge.style.display = 'none';
      document.documentElement.classList.remove('pfp-inhouse');
      toast('BACK ON THE ISLAND', 1600);
    });
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
      { item: 'val:gold_bar', qty: 2, equipped: false },
      { item: 'fish:snapper', qty: 3, equipped: false },
      { item: 'wpn:sword:cutlass:rare', qty: 1, equipped: true },
      { item: 'val:ruby', qty: 1, equipped: false },
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
  function closeStorage() { storageOpen = false; panel.classList.remove('on'); }

  async function renderStorage() {
    const bag = await bagItems();
    const ch = chestOf(activeId);
    const used = (ch.items || []).length;
    panel.querySelector('[data-sub]').textContent = `${(cottages.find((c) => c.id === activeId) || {}).name || 'COTTAGE'} · tap to move`;
    panel.querySelector('[data-cap]').textContent = `(${used} / ${ch.slots})`;
    const bagEl = panel.querySelector('[data-bag]'), chestEl = panel.querySelector('[data-chest]');
    bagEl.innerHTML = bag.length ? bag.map((s) => {
      const info = itemInfo(s.item); if (!info) return '';
      return `<div class="hs-slot${s.equipped ? ' eq' : ''}" data-side="bag" data-item="${s.item}" data-qty="${s.qty}" style="border-color:${RARITY_COLOR[info.rarity] || '#6b4a24'}">${ico(s.item, info)}<span>${shortName(info)}</span><b>${s.qty > 1 ? '×' + s.qty : ''}</b></div>`;
    }).join('') : '<div class="hs-empty">backpack empty</div>';
    chestEl.innerHTML = (ch.items || []).length ? ch.items.map((s) => {
      const info = itemInfo(s.item); if (!info) return '';
      return `<div class="hs-slot" data-side="chest" data-slot="${s.slot}" data-item="${s.item}" data-qty="${s.qty}" style="border-color:${RARITY_COLOR[info.rarity] || '#6b4a24'}">${ico(s.item, info)}<span>${shortName(info)}</span><b>${s.qty > 1 ? '×' + s.qty : ''}</b></div>`;
    }).join('') : '<div class="hs-empty">chest empty · tap a backpack item</div>';
    for (const el of panel.querySelectorAll('.hs-slot')) {
      el.onclick = () => onSlot(el);
    }
  }

  async function onSlot(el) {
    if (busy || !activeId) return;
    const side = el.dataset.side, item = el.dataset.item, qty = Math.max(1, el.dataset.qty | 0);
    if (side === 'bag') {
      if (el.classList.contains('eq')) { toast('UNEQUIP THAT FIRST<br><small>open INVENTORY to unequip</small>', 2200); return; }
      await storeItem(item, qty === 1 ? 1 : 1);
    } else {
      await takeItem(el.dataset.slot | 0, 1);
    }
  }

  async function storeItem(item, qty) {
    busy = true;
    try {
      let ok = false;
      try {
        const r = await invApi('house_store', { cottage: activeId, item, qty });
        if (r?.ok) {
          ok = true;
          owned[activeId] = { ...owned[activeId], slots: r.house?.slots || owned[activeId].slots, items: r.house?.items || [] };
          persistChest(activeId);
          try { await (typeof inventory === 'function' ? inventory() : inventory)?.refresh?.(); } catch {}
        } else if (r && r.error === 'equipped') { toast('UNEQUIP THAT FIRST', 1800); return; }
        else if (r && r.error === 'chest full') { toast('CHEST FULL', 1600); return; }
        else if (r && r.ok === false && r.error !== 'offline' && r.error !== 'closed') { toast(String(r.error || 'no').toUpperCase(), 1800); return; }
      } catch {}
      if (!ok) {
        // Offline local move
        const ch = chestOf(activeId);
        if ((ch.items || []).length >= ch.slots && !(ch.items || []).some((x) => x.item === item && !item.startsWith('wpn:'))) {
          toast('CHEST FULL', 1600); return;
        }
        const items = [...(ch.items || [])];
        const stack = !item.startsWith('wpn:') ? items.find((x) => x.item === item) : null;
        if (stack) stack.qty += qty;
        else {
          let slot = 0; const used = new Set(items.map((x) => x.slot));
          while (used.has(slot)) slot++;
          if (slot >= ch.slots) { toast('CHEST FULL', 1600); return; }
          items.push({ slot, item, qty });
        }
        // trim demo bag
        const st = lsLoad();
        const bag = Array.isArray(st.demoBag) ? st.demoBag : null;
        if (bag) {
          const row = bag.find((x) => x.item === item);
          if (row) { row.qty -= qty; if (row.qty <= 0) st.demoBag = bag.filter((x) => x.item !== item); lsSave(st); }
        }
        owned[activeId] = { ...owned[activeId], items }; persistChest(activeId);
      }
      sfx?.coin?.(); toast('STORED', 900); await renderStorage();
    } finally { busy = false; }
  }

  async function takeItem(slot, qty) {
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
        } else if (r && r.ok === false && r.error !== 'offline' && r.error !== 'closed') { toast(String(r.error || 'no').toUpperCase(), 1800); return; }
      } catch {}
      if (!ok) {
        const items = [...(owned[activeId].items || [])];
        const row = items.find((x) => x.slot === slot); if (!row) return;
        const take = Math.min(qty, row.qty); row.qty -= take;
        const st = lsLoad();
        st.demoBag = st.demoBag || [];
        const bag = st.demoBag.find((x) => x.item === row.item);
        if (bag) bag.qty += take; else st.demoBag.push({ item: row.item, qty: take, equipped: false });
        lsSave(st);
        owned[activeId].items = items.filter((x) => x.qty > 0); persistChest(activeId);
      }
      sfx?.coin?.(); toast('WITHDRAWN', 900); await renderStorage();
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
      let best = null, bd = 1e9;
      for (const s of Object.values(spots)) {
        const dist = Math.hypot(s.x - lx, s.z - lz);
        if (dist < s.r && dist < bd) { bd = dist; best = s; }
      }
      if (best?.kind === 'house_chest') return { label: 'OPEN STORAGE', key: 'E', primary: true, tag: 'chest' };
      if (best?.kind === 'house_exit') return { label: 'EXIT TO ISLAND', key: 'E', primary: true, tag: 'exit' };
      return { label: 'EXIT TO ISLAND', key: 'E', primary: false, tag: 'exit' };
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
    // Pin Y to interior floor; soft AABB against room walls
    if (w._hsY != null) w.y = w._hsY;
    const lx = w.x - roomOrigin.x, lz = w.z - roomOrigin.z;
    const halfW = interior.userData.W / 2 - 0.55, halfD = interior.userData.D / 2 - 0.55;
    w.x = roomOrigin.x + Math.max(-halfW, Math.min(halfW, lx));
    w.z = roomOrigin.z + Math.max(-halfD, Math.min(halfD, lz));
    // Keep pirate mesh glued to the indoor walker (walker.place may skip while camHook owns the cam)
    try { pirate.object.position.set(w.x, w.y, w.z); pirate.object.rotation.y = w.yaw; pirate.object.visible = true; } catch {}
    applyIndoorCam();
    // Keep outdoor peers hidden
    for (const [id, p] of fnet.peers) {
      if (p.pirate?.object?.visible) { p.pirate.object.visible = false; hiddenPeers.add(id); }
    }
    // Ember flicker
    try {
      const em = interior.children.find((c) => c.material?.userData?.key === 'hs-ember');
      if (em?.scale) em.scale.setScalar(0.9 + 0.15 * Math.sin((game?.t || performance.now() / 1000) * 6));
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
      inHouse = false; activeId = null; doorHold = null; roomOrigin = null;
      badge.style.display = 'none'; document.documentElement.classList.remove('pfp-inhouse');
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
  };
}
