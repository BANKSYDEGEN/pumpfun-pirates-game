// Stylized toon ships built in code: rounded plank hulls with painted strakes, railings,
// chunky cannons, cabins with glowing windows, crow's nest, lanterns, rippling sails, waving flags.
import * as THREE from 'three';
import { addCrew, dressCrew, addLookout, crewLodOf, setWalkLanes } from './crew.js'; // [Raul] deck crew
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, glowMat, outlineFor, woodTexture, clothTexture, metalTexture, goldTexture } from './toon.js';
import { kitOn, geo as kitGeo, dressMaterial, aoTwin } from './shipKit.js'; // [Timothy] Blender ship art kit (visual only)

// shared wind clock for the sail vertex ripple (main loop sets value)
export const wind = { uTime: { value: 0 } };

// ---------- flag textures ----------
export function makeSkullTexture(skullImg, { w = 512, h = 340, bg = '#0b0b0b', pad = 0.12, border = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.06; g.fillStyle = '#fff';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
  // the REAL childlike skull logo (image file), never redrawn
  const s = Math.min(w, h) * (1 - pad * 2);
  const ar = skullImg.width / skullImg.height;
  const sw = ar >= 1 ? s : s * ar, sh = ar >= 1 ? s / ar : s;
  g.drawImage(skullImg, (w - sw) / 2, (h - sh) / 2, sw, sh);
  // frayed fly edge
  g.fillStyle = bg; for (let y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(w, y); g.lineTo(w - 10 - (y % 36 ? 6 : 0), y + 9); g.lineTo(w, y + 18); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Parody "rug pill" flag: a cracked green/white capsule. Deliberately NOT the real pump.fun logo.
export function makePillTexture() {
  const w = 512, h = 340;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2a22'; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.07; g.fillStyle = '#fff';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  g.save();
  g.translate(w / 2, h / 2); g.rotate(-Math.PI / 5.5);
  const L = 330, R = 62;
  const capsule = (x0, x1) => { g.beginPath(); g.moveTo(x0, -R); g.lineTo(x1, -R); g.arc(x1, 0, R, -Math.PI / 2, Math.PI / 2); g.lineTo(x0, R); g.arc(x0, 0, R, Math.PI / 2, -Math.PI / 2); g.closePath(); };
  g.save(); g.beginPath(); g.rect(-400, -200, 400 - 8, 400); g.clip();
  capsule(-L / 2 + R, L / 2 - R); g.fillStyle = '#f2f2f2'; g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(-L / 2 + R, -R + 14, L - 2 * R, 12); g.restore();
  g.save(); g.translate(14, 6); g.rotate(0.12); g.beginPath(); g.rect(8, -200, 400, 400); g.clip();
  capsule(-L / 2 + R, L / 2 - R); g.fillStyle = '#4ee37a'; g.fill();
  g.fillStyle = 'rgba(200,255,215,0.7)'; g.fillRect(-L / 2 + R, -R + 14, L - 2 * R, 12); g.restore();
  g.lineWidth = 8; g.strokeStyle = '#0d0d0d';
  g.save(); g.beginPath(); g.rect(-400, -200, 400 - 8, 400); g.clip(); capsule(-L / 2 + R, L / 2 - R); g.stroke(); g.restore();
  g.save(); g.translate(14, 6); g.rotate(0.12); g.beginPath(); g.rect(8, -200, 400, 400); g.clip(); capsule(-L / 2 + R, L / 2 - R); g.stroke(); g.restore();
  g.beginPath(); g.moveTo(-4, -R - 4); [[6, -30], [-6, -8], [8, 14], [-4, 36], [6, R + 4]].forEach(([x, y]) => g.lineTo(x, y));
  g.lineWidth = 6; g.stroke();
  g.restore();
  g.fillStyle = '#1d2a22'; for (let y = 0; y < h; y += 18) { g.beginPath(); g.moveTo(w, y); g.lineTo(w - 14, y + 9); g.lineTo(w, y + 18); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- color schemes ----------
export const SCHEMES = {
  player: { seed: 11, wood: 0x6a4026, body: 0x33231a, band: 0x161616, stripe: 0xffcd77, band2: 0xc4161c, tar: 0x231812, trim: 0xffcd77, sail: 0x1c1c1c, patch: [0x5e0e0e, 0x2a2a2a], hem: 0xb8964f, lantern: 0xffb04a, window: 0xffc46a },
  slime: { seed: 21, wood: 0x76502f, band: 0x2f9e4f, stripe: 0xf2f2f2, band2: 0x1f6b37, tar: 0x2a2018, trim: 0xd9c38a, sail: 0xe6e0cc, patch: [0xb9e8c4, 0xcfc7ae], hem: 0x5d7a4a, lantern: 0x9cffb5, window: 0x9cffb5 },
  grape: { seed: 31, wood: 0x6e4a33, band: 0x5b3591, stripe: 0x4ee37a, band2: 0x3b2266, tar: 0x221a22, trim: 0xc9b07a, sail: 0xd9e6cf, patch: [0xb79ad8, 0xbfd2b1], hem: 0x4b3a66, lantern: 0xc9a2ff, window: 0xc9a2ff },
  reef: { seed: 41, wood: 0x7a5636, band: 0x1d8686, stripe: 0xffe2a8, band2: 0x125a5a, tar: 0x1b2022, trim: 0xe0c27a, sail: 0xefe9da, patch: [0x9fd8cf, 0xd8cdb2], hem: 0x2d5a5a, lantern: 0x8ff7ff, window: 0x9cffb5, stripes: 0x4ee37a },
  boss: { seed: 51, wood: 0x4a3226, band: 0x15201a, stripe: 0x4ee37a, band2: 0x5b0f2a, tar: 0x140f0d, trim: 0x4ee37a, sail: 0x1f2b24, patch: [0x0f3a22, 0x3a1a26], hem: 0x4ee37a, lantern: 0x5cff8f, window: 0x7dffa8, stripes: 0x2d6b43 },
};
export const ENEMY_SCHEMES = ['slime', 'grape', 'reef'];
// [enemy variety] extra enemy builds: rammer (black hull, blood-red sails, iron bands) and runner (cream-gold sails, gold trim)
SCHEMES.rammer = { seed: 61, wood: 0x3b2a22, band: 0x121212, stripe: 0xfa0d0d, band2: 0x7a0a0a, tar: 0x120c0a, trim: 0x9aa6b8, sail: 0x9e1414, patch: [0x5e0e0e, 0x2a1414], hem: 0x161616, lantern: 0xff5a3a, window: 0xff7a4a };
SCHEMES.runner = { seed: 71, wood: 0x8a6038, band: 0xffcd77, stripe: 0x161616, band2: 0xb8862f, tar: 0x2a1c10, trim: 0xffcd77, sail: 0xf3dc9e, patch: [0xffcd77, 0xe8cf95], hem: 0xb8862f, lantern: 0xffe08a, window: 0xffe08a, stripes: 0xffcd77 };

const _kits = new Map();
function kit(name, mainSailMap, art = false) {
  art = art && kitOn(); // [Timothy] art: the Blender kit look (player ships); false = the original procedural look
  const k = name + (mainSailMap ? '+main' : '') + (art ? '+art' : '');
  if (_kits.has(k)) return _kits.get(k);
  const S = SCHEMES[name];
  const body = S.body ?? (art && S.artBody != null ? S.artBody : art ? new THREE.Color(S.wood).lerp(new THREE.Color(0x17110d), 0.6).getHex() : S.wood); // [Timothy v2] every skin on the new hull: dark body, its own bright bands / trim on top // [Timothy v2] the Blender-kit player hull: dark tarred body (classic) under a bright painted gun-port band
  const hullTex = art ? woodTexture({ base: body, rows: 20, seed: S.seed, w: 512, h: 512, bands: [
    { from: 0, to: 0.05, color: S.band, flat: true }, { from: 0.05, to: 0.25, color: S.band2, stripe: S.stripe, flat: true }, { from: 0.25, to: 0.3, color: S.band, flat: true },
    { from: 0.3, to: 0.35, color: S.stripe, flat: true }, { from: 0.8, to: 0.85, color: S.band, stripe: S.stripe, flat: true }, { from: 0.85, to: 1.01, color: S.tar },
  ] }) : woodTexture({ base: S.wood, rows: 10, seed: S.seed, bands: [
    { from: 0, to: 0.2, color: S.band, stripe: S.stripe, flat: true }, { from: 0.2, to: 0.3, color: S.band2, flat: true }, { from: 0.82, to: 1.01, color: S.tar },
  ] });
  const cabinTex = woodTexture({ base: S.wood, rows: 6, seed: S.seed + 1, bands: [{ from: 0, to: 0.17, color: S.band, flat: true }] });
  const deckTex = woodTexture({ base: art ? 0xc08a50 : 0x9a6b43, rows: 6, seed: 7, w: 512, h: 256 }); // [Timothy v2] warmer, lighter deck: reads against the dark hull from the chase camera
  const sailTex = clothTexture({ base: S.sail, seed: S.seed + 2, patchColors: S.patch, border: S.hem, stripes: S.stripes ? { color: S.stripes, n: 6 } : null });
  const ironTex = metalTexture({ base: name === 'boss' ? 0x1e2a24 : 0x2b2f36, highlight: name === 'boss' ? 0x6fe39a : 0x9aa6b8 });
  const goldTex = goldTexture({ base: art ? (S.artTrim ?? 0xffcd77) : S.trim }); // [Timothy v2] new hull: gold trim on every skin (its own colour stays in the wales / bands)
  const kitObj = {
    S,
    hull: toon(0xffffff, hullTex, { side: THREE.DoubleSide }),
    cabin: toon(0xffffff, cabinTex),
    deck: toon(0xffffff, deckTex),
    mast: toon(0xffffff, woodTexture({ base: 0x7a5232, rows: 4, seed: 61, w: 256, h: 128, nails: false })),
    iron: Object.assign(toon(0xffffff, ironTex), { name: 'ship-iron' }), // [Raul] named: tools/ship_tests/crew_walk.py finds the guns by it
    gold: toon(0xffffff, goldTex),
    dark: toon(0x1a1410),
    rope: new THREE.LineBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.85 }),
    sail: sailMaterial(sailTex, THREE.FrontSide, art ? 1 : 0),
    sailBack: sailMaterial(mirror(sailTex), THREE.BackSide, art ? 1 : 0),
    main: mainSailMap ? sailMaterial(mainSailMap, THREE.FrontSide, art ? 1 : 0) : null,
    mainBack: mainSailMap ? sailMaterial(mirror(mainSailMap), THREE.BackSide, art ? 1 : 0) : null,
    lantern: glowMat(S.lantern, 2.6),
    window: glowMat(S.window, 1.9),
  };
  if (art) { // [Timothy v2] upper works (castles, bulwarks): gold cap moulding, red frieze, dark planking, gold mid moulding (v = metres below the rail / 3.2)
    kitObj.upper = toon(0xffffff, woodTexture({ base: body, rows: 16, seed: S.seed + 5, w: 512, h: 512, bands: [
      { from: 0, to: 0.0625, color: S.stripe, flat: true }, { from: 0.0625, to: 0.1875, color: S.band2, stripe: S.stripe, flat: true },
      { from: 0.5, to: 0.5625, color: S.stripe, flat: true }, { from: 0.875, to: 0.9375, color: S.band, flat: true }] }), { side: THREE.DoubleSide });
    kitObj.lid = toon(S.band2); // gun-port lids, painted inside
    kitObj.winArt = glowMat(S.artWindow ?? S.window, S.artGlowK ?? 1.2); kitObj.lanArt = glowMat(S.artLantern ?? S.lantern, 1.6 * (S.artGlowK ? S.artGlowK / 1.2 : 1)); // softer glow: the bloom no longer washes the dark transom out
  }
  if (art) { // [Timothy] baked plank / cloth detail multiplied into the scheme's own paint + baked normal maps; kit meshes get AO twins
    const K = kitObj;
    dressMaterial(K.hull, 'hull', { strength: 1.1 }); dressMaterial(K.deck, 'deck', { strength: 0.9 }); dressMaterial(K.cabin, 'deck', { strength: 0.8 });
    for (const m of [K.sail, K.sailBack, K.main, K.mainBack]) if (m) dressMaterial(m, 'sail', { strength: 0.8 });
    dressMaterial(K.upper, 'hull', { strength: 0.9 });
    K.ironK = aoTwin(K.iron, 'iron'); K.woodK = aoTwin(K.cabin, 'wood'); K.goldK = aoTwin(K.gold, 'gold'); K.darkK = aoTwin(K.dark, 'dark');
    K.ropeK = aoTwin(toon(0x8a6a44), 'rope');
    K.ratline = ratlineMat();
    K.art = true;
  }
  if (art) for (const m of Object.values(kitObj)) if (m?.isMaterial && m.customProgramCacheKey?.() !== 'sail') m.userData.art = true; // [Timothy v2] skins tone their glow down on the big flat castle walls
  _kits.set(k, kitObj);
  return kitObj;
}
// [Timothy] shrouds + ratlines: one alpha-tested quad per mast side (3 shrouds converging on the masthead, tarred ratlines across)
let _ratMat = null;
function ratlineMat() {
  if (_ratMat) return _ratMat;
  const c = document.createElement('canvas'); c.width = 128; c.height = 512; const g = c.getContext('2d');
  g.clearRect(0, 0, 128, 512); g.fillStyle = '#fff';
  for (const u of [0.03, 0.5, 0.97]) g.fillRect(u * 128 - 2.5, 0, 5, 512);
  for (let i = 1; i < 26; i++) { const y = i * 512 / 26; g.fillRect(0, y - 1, 128, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _ratMat = toon(0x4a3826, t, { side: THREE.DoubleSide, alphaTest: 0.45, transparent: false });
  _ratMat.name = 'kit-ratlines';
  return _ratMat;
}
export function mirror(t) { const m = t.clone(); m.wrapS = THREE.RepeatWrapping; m.repeat.x = -1; m.offset.x = 1; m.needsUpdate = true; return m; }
// [Timothy v2] edge > 0: a contrasting bolt-rope border + reef band painted in the shader (light rope on dark cloth, dark rope on
// light cloth), so it follows every skin / Squads tint for free. Same program for all sails (edge is a uniform, key stays 'sail').
export function sailMaterial(map, side = THREE.FrontSide, edge = 0) {
  const m = toon(0xffffff, map, { side });
  const uEdge = { value: edge }; m.userData.uEdge = uEdge;
  m.onBeforeCompile = (s) => {
    s.uniforms.uWindT = wind.uTime; s.uniforms.uEdge = uEdge;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uEdge;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        #ifdef USE_MAP
        if (uEdge > 0.0) { vec2 q = vMapUv; float e = min(min(q.x, 1.0 - q.x), min(q.y, 1.0 - q.y));
          float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          vec3 rope = lum < 0.42 ? vec3(0.86, 0.70, 0.42) : vec3(0.16, 0.10, 0.06);
          float b = 1.0 - smoothstep(0.022, 0.034, e);                                  // bolt rope
          float r = (1.0 - smoothstep(0.004, 0.009, abs(q.y - 0.8))) * step(0.04, e);     // reef band near the head
          diffuseColor.rgb = mix(diffuseColor.rgb, rope, clamp(b + r * 0.8, 0.0, 1.0) * uEdge); }
        #endif`);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { float cx = 1.0 - pow(uv.x * 2.0 - 1.0, 2.0); float hang = 1.0 - uv.y * 0.75;
          float ph = uWindT * 2.3 + modelMatrix[3].x * 0.05 + modelMatrix[3].z * 0.05;
          transformed.z += cx * hang * (sin(uv.y * 4.0 + ph + uv.x * 2.5) * 0.16 + sin(ph * 1.7 + uv.x * 7.0) * 0.05); }`);
  };
  m.customProgramCacheKey = () => 'sail';
  return m;
}

// ---------- geometry ----------
// Ship forward = local +Z, up = +Y, port (left) = +X, starboard (right) = -X. t=0 stern, t=1 bow.
function hullShape(len, beam, depth) {
  const halfW = (t) => t < 0.4 ? beam / 2 * (0.8 + 0.2 * Math.sin((t / 0.4) * Math.PI / 2)) : Math.max(0.06, beam / 2 * Math.pow(Math.max(0, Math.cos(((t - 0.4) / 0.6) * Math.PI / 2)), 0.68));
  const top = (t) => depth * (0.5 + 0.5 * Math.pow((t - 0.47) * 2, 2)) + (t < 0.2 ? depth * 0.42 * (1 - t / 0.2) : 0) + (t > 0.85 ? depth * 0.25 * (t - 0.85) / 0.15 : 0);
  const keel = (t) => -depth * 0.58 * (1 - 0.72 * Math.pow(Math.max(0, (t - 0.68) / 0.32), 1.6)) * (t < 0.05 ? 0.85 : 1);
  return { halfW, top, keel };
}
// [v97] LONG HULLS: the waist (design t 0.25..0.72, where the guns sit) is stretched by f; bow + stern keep their exact shape.
// Everything is still placed by design t (0 stern .. 1 bow): zMap turns t into the stretched z.
export const STRETCH_T0 = 0.25, STRETCH_T1 = 0.72;
export function zMap(len0, f = 1) {
  const A = STRETCH_T0, B = STRETCH_T1, E = (B - A) * len0 * (f - 1), L = len0 + E;
  return { L, z: (t) => (t < A ? t * len0 : t < B ? A * len0 + (t - A) * len0 * f : t * len0 + E) - L / 2,
    t: (z) => { const u = z + L / 2; return u < A * len0 ? u / len0 : u < A * len0 + (B - A) * len0 * f ? A + (u - A * len0) / (len0 * f) : (u - E) / len0; } }; // [Raul] z -> design t
}
// [Raul] PUMPFUN PIRATES crew walk lanes: straight fore-and-aft paths on the main deck that clear every wall, mast, gun, gunner
// and deck prop by r (the walkers' shader paces o.z +- span / 2 at a fixed x). obs = [[x0, x1, z0, z1], ...] in body space,
// half(z) = the free half-width inside the bulwark. Longest lanes first; lanes that overlap in z keep >= 0.8 m apart in x.
export function walkLanes({ z0, z1, half, obs, n = 3, r = 0.34, minLen = 1.6 }) {
  const dz = 0.1, xs = [], cand = [];
  for (let x = -3.5; x <= 3.5001; x += 0.25) xs.push(+x.toFixed(2));
  const free = (x, z) => Math.abs(x) + r <= half(z) && !obs.some(o => x > o[0] - r && x < o[1] + r && z > o[2] - r && z < o[3] + r);
  for (const x of xs) { let a = null, last = null;
    for (let z = z0; z <= z1 + 1e-6; z += dz) { const f = free(x, z);
      if (f) { if (a === null) a = z; last = z; }
      if ((!f || z + dz > z1 + 1e-6) && a !== null) { if (last - a >= minLen) cand.push({ x, a, b: last }); a = null; } } }
  cand.sort((p, q) => (q.b - q.a) - (p.b - p.a) || Math.abs(p.x) - Math.abs(q.x));
  const out = [];
  for (const c of cand) { if (out.length >= n) break; if (out.some(o => Math.abs(o.x - c.x) < 0.8 && c.a < o.b + r && o.a < c.b + r)) continue; out.push(c); }
  if (out.length < n && minLen > 0.05) out.push(...walkLanes({ z0, z1, half, obs: [...obs, ...out.map(o => [o.x - 0.5, o.x + 0.5, o.a - 0.3, o.b + 0.3])], n: n - out.length, r, minLen: 0 }).map(o => ({ ...o, b: o.a }))); // no room left: stand still on a free spot
  return out;
}
// [Raul] BANKSY: no crew inside a cannon, barrel, wall or deck part on any hull. Places every gunner by HIS gun (behind the breech
// on the gun's line, else beside the breech fore / aft), clear of every gun footprint (carriage + barrel), mast, deck part (extra =
// js/upgradeVisuals.js upgrade parts: magazine, mortar, 4th mast, racks, lockers) and the other gunners; then fresh walker lanes and
// idle deck spots round all of it. Patches the crew mesh in place (same geometry, same draw call) + the crew anchors.
export function placeCrew(ship, extra = []) {
  const u = ship.userData, W = u.walkInfo, S = u.gunSlots || []; if (!W) return null;
  const CR = 0.3, hit = (x, z, B, r = CR) => B.some(o => x > o[0] - r && x < o[1] + r && z > o[2] - r && z < o[3] + r);
  const G = S.map(g => { const a = g.inner, b = g.x + g.sx * 1.2; return [Math.min(a, b), Math.max(a, b), g.z - g.r, g.z + g.r]; });
  const stat = [...W.base, ...extra], bad = [];
  const cand = S.map(g => { const C = [], nb = S.filter(o => o.sx === g.sx && Math.abs(o.i - g.i) === 1).map(o => (o.z + g.z) / 2);
    for (const d of [0.38, 0.6, 0.85, 1.1]) C.push([g.inner - g.sx * d, g.z]);                                   // behind the breech
    for (const dz of [1, -1]) for (const d of [-0.25, 0.1, 0.4]) C.push([g.inner - g.sx * d, g.z + dz * (g.r + 0.34)]); // beside it
    for (const z of nb) for (const d of [-0.2, 0.15, 0.5, 0.85]) C.push([g.inner - g.sx * d, z]);                // between it and the next
    return C.filter(([x, z]) => !hit(x, z, G) && !hit(x, z, stat) && Math.abs(x) + CR <= W.half(z) + 0.05 && z >= W.z0 - 0.1 && z <= W.z1 + 0.1); });
  // pick one spot per gun (in preference order), gunners >= 0.62 apart: small backtracking search, tightest guns first
  const ord = S.map((_, k) => k).sort((a, b) => cand[a].length - cand[b].length), pick = new Array(S.length).fill(null); let steps = 0;
  const far = (x, z, upto) => { for (let q = 0; q < upto; q++) { const p = pick[ord[q]]; if (p && Math.hypot(p[0] - x, p[1] - z) < 0.62) return false; } return true; };
  const dfs = (q) => { if (q === ord.length) return true; if (++steps > 40000) return false;
    for (const c of cand[ord[q]]) if (far(c[0], c[1], q)) { pick[ord[q]] = c; if (dfs(q + 1)) return true; }
    pick[ord[q]] = null; return cand[ord[q]].length === 0 && dfs(q + 1); };
  if (!dfs(0)) for (let q = 0; q < ord.length; q++) { pick[ord[q]] = cand[ord[q]].find(c => far(c[0], c[1], q)) || null; } // greedy fallback
  S.forEach((g, k) => { const c = pick[k]; if (!c) bad.push(g.i * g.sx); const [x, z] = c || [g.inner - g.sx * 0.38, g.z]; g.gx = x; g.gz = z; });
  const A = u.anchors || [];
  for (const g of S) { const a = A.find(a => a.role === 'gunner' && a.index === g.i && (a.side === 'port') === (g.sx > 0)); if (a) { a.pos.x = g.gx; a.pos.z = g.gz; if (a.node) a.node.position.copy(a.pos); } }
  const lod = u.body.children.find(o => o.isLOD && o.children[0]?.userData?.crewMesh);
  if (lod?.userData.seats) { const seats = lod.userData.seats, geo = lod.children[0].geometry, O = geo.attributes.aOrigin, I = geo.attributes.aInfo;
    const key = (sx, i) => `${sx > 0 ? 1 : -1}:${i}`, M = new Map(S.map(g => [key(g.sx, g.i), g]));
    for (const c of seats) if (c.info[0] === 0) { const g = M.get(key(c.info[1], c.info[3])); if (g) c.o = [g.gx, c.o[1], g.gz]; }
    for (let v = 0; v < I.count; v++) if (I.getX(v) === 0) { const g = M.get(key(I.getY(v), Math.round(I.getW(v)))); if (g) { O.setX(v, g.gx); O.setZ(v, g.gz); } }
    O.needsUpdate = true; }
  const obs = [...stat, ...G, ...S.map(g => [g.gx - 0.32, g.gx + 0.32, g.gz - 0.32, g.gz + 0.32])];
  const lanes = walkLanes({ ...W, obs }); setWalkLanes(u.body, lanes);
  A.filter(a => a.role === 'deck' && a.index < 4).forEach(a => { const l = lanes[a.index]; if (l) { a.pos.set(l.x, W.deckY((l.a + l.b) / 2), (l.a + l.b) / 2); if (a.node) a.node.position.copy(a.pos); } });
  A.filter(a => a.role === 'deck' && a.index >= 4).forEach(a => { if (!hit(a.pos.x, a.pos.z, extra)) return; const sx = Math.sign(a.pos.x) || 1; // castle idle spots off the deck parts (bow chasers)
    for (const dz of [0, -0.4, 0.4, -0.8]) for (const dx of [0, 0.4, -0.4, 0.8, -0.8]) { const x = a.pos.x + sx * dx, z = a.pos.z + dz;
      if (!hit(x, z, extra) && Math.abs(x) + CR <= W.half(z) + 0.2) { a.pos.x = x; a.pos.z = z; if (a.node) a.node.position.copy(a.pos); return; } } bad.push('deck' + a.index); });
  u.walkLanes = lanes; u.deckObs = obs; u.crewBad = bad;
  return lanes;
}
export const relaneCrew = placeCrew; // (old name)
// sample stations: denser in the stretched waist so long hulls stay smooth
const stations = (N, f) => { if (f <= 1.001) return [...Array(N + 1)].map((_, i) => i / N);
  const extra = Math.round((f - 1) * 10), out = []; const n = N + extra;
  for (let i = 0; i <= n; i++) out.push(i / n); return out; };
function hullGeometry(len, beam, depth, zf = (t) => (t - 0.5) * len, f = 1, art = false) {
  const { halfW, top, keel } = hullShape(len, beam, depth);
  const TS = stations(22, f), N = TS.length - 1, M = 16;
  const pos = [], uv = [], idx = [], sections = [];
  for (let i = 0; i <= N; i++) {
    const t = TS[i], z = zf(t), w = halfW(t), yd = top(t), yk = keel(t);
    const ring = [];
    for (let j = 0; j <= M; j++) {
      const phi = (j / M) * Math.PI, c = Math.cos(phi), u = Math.sin(phi);
      const x = w * Math.sign(c) * Math.pow(Math.abs(c), 0.42) * (1 - 0.08 * Math.pow(1 - u, 3));
      const y = yd - (yd - yk) * Math.pow(u, 1.1);
      ring.push([x, y, z]);
    }
    // arc length from each gunwale down to the keel -> V (painted strakes follow the hull)
    const half = M / 2, arc = [0]; for (let j = 1; j <= half; j++) arc.push(arc[j - 1] + Math.hypot(ring[j][0] - ring[j - 1][0], ring[j][1] - ring[j - 1][1]));
    for (let j = 0; j <= M; j++) {
      const jj = j <= half ? j : M - j;
      pos.push(...ring[j]); uv.push(z / 5, arc[jj] / arc[half]);
    }
    sections.push(ring);
  }
  const P = M + 1;
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * P + j, b = a + 1, c = a + P, d = c + 1; idx.push(a, c, b, b, c, d); }
  // stern transom (separate verts so it gets its own flat normal)
  const base = pos.length / 3, s0 = sections[0];
  const cy = s0.reduce((a, p) => a + p[1], 0) / s0.length;
  pos.push(0, cy, s0[0][2]); uv.push(0.5, 0.5);
  const yTop = s0[0][1], yBot = Math.min(...s0.map(p => p[1])); // [Timothy v2] ART: the transom is painted in the dark body planking (v 0.36..0.76), not the wrapped bands
  s0.forEach(p => { pos.push(...p); uv.push(p[0] / beam + 0.5, art ? 0.36 + 0.4 * (yTop - p[1]) / Math.max(0.1, yTop - yBot) : p[1] / depth); });
  for (let j = 0; j < M; j++) idx.push(base, base + 1 + j + 1, base + 1 + j);
  idx.push(base, base + 1, base + 1 + M); // close the fan across the top (gunwale to gunwale): without it a V-shaped gap in the transom showed water through the stern
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return { geo, sections, shape: { halfW, top, keel } };
}
// [Raul] solid bulwark: a closed panel between the gunwale cap and the top rail (both sides of it render)
function bulwarkGeometry(low, high, sx) {
  const pos = [], idx = [];
  for (let i = 0; i < low.length; i++) { const a = low[i], b = high[i]; pos.push(a.x * 0.985, a.y - 0.04, a.z, b.x + sx * 0.02, b.y - 0.02, b.z); }
  for (let i = 0; i < low.length - 1; i++) { const a = i * 2; if (sx > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(low.flatMap((a) => [a.z / 5, 0.06, a.z / 5, 0.01]), 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function deckGeometry(len, shape, drop, inset = 0.9, wk = null, zf = (t) => (t - 0.5) * len, f = 1) {
  const TS = stations(22, f), N = TS.length - 1, pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) {
    const t = TS[i], z = zf(t), w = shape.halfW(t) * (wk ?? (inset >= 1 ? 1.0 : inset * 0.93)), y = shape.top(t) - drop;
    pos.push(w, y, z, -w, y, z); uv.push(z / 4, w / 1.4, z / 4, -w / 1.4);
  }
  for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}
// billowed sail hanging from y=0 (yard) down to -h, curved foot
function sailGeometry(w, h, billow, seg = [10, 8]) {
  const g = new THREE.PlaneGeometry(w, h, seg[0], seg[1]);
  g.translate(0, -h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = -p.getY(i) / h; // y: 0 top .. 1 foot
    p.setZ(i, billow * (1 - x * x) * (0.35 + 0.65 * Math.sin(Math.min(1, y * 1.15) * Math.PI * 0.9)));
    p.setY(i, p.getY(i) + (1 - x * x) * h * 0.06 * y); // the foot bellies upward a bit
    p.setX(i, p.getX(i) * (1 - 0.08 * y));            // slightly narrower at the foot
  }
  g.computeVertexNormals();
  return g;
}
// [Timothy v2] bellied triangular head sail (luff a-b on the stay, foot b-c), cloth pushed to port by `belly` metres at the centre
export function triSail(a, b, c, belly, n = 8) {
  const pos = [], uv = [], idx = [], P = (i, j) => i * (i + 1) / 2 + j;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= i; j++) {
    const u = i / n, v = i ? j / i : 0; // u: head -> foot edge, v: along the foot edge (b..c)
    const p = new THREE.Vector3().copy(a).lerp(new THREE.Vector3().copy(b).lerp(c, v), u);
    const w = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, Math.max(0, v))) * 4 * u * (1 - u) + Math.sin(Math.PI * u) * 0.25 * (1 - Math.abs(v - 0.5) * 2);
    p.x += belly * w; pos.push(p.x, p.y, p.z); uv.push(0.5 + (v - 0.5) * u, 1 - u);
  }
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { idx.push(P(i, j), P(i + 1, j), P(i + 1, j + 1)); if (j < i) idx.push(P(i, j), P(i + 1, j + 1), P(i, j + 1)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
// [Timothy] white vertex colours for a primitive that joins a kit (vertex-coloured AO) material
const vc = (g) => { g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3)); return g; };
const WATER_MASK = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
const cyl = (r1, r2, h, s = 10, open = false) => new THREE.CylinderGeometry(r1, r2, h, s, 1, open);
function lathe(pts, segs = 12) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs); }
// [v97] long gun: cascabel knob, base ring, two reinforcing bands, tapered chase, swelled muzzle ring + bore. Tip stays at y 1.22.
// [v97] ship geometry detail tier (set once at boot from the graphics quality): LOW / phones get lighter cannons + carriages
let LITE = false; export function setShipDetail(lite) { LITE = !!lite; }
export const CANNON = [[0.001, -0.31], [0.07, -0.31], [0.095, -0.25], [0.055, -0.2], [0.09, -0.17], [0.24, -0.15], [0.29, -0.08], [0.305, 0.03], [0.27, 0.07],
  [0.27, 0.13], [0.295, 0.16], [0.295, 0.24], [0.255, 0.27], [0.24, 0.5], [0.268, 0.52], [0.268, 0.59], [0.235, 0.61], [0.212, 0.92], [0.242, 0.96],
  [0.242, 1.01], [0.215, 1.04], [0.25, 1.1], [0.305, 1.15], [0.305, 1.22], [0.165, 1.22], [0.15, 1.14], [0.001, 1.13]];
// [v97] gun stations along a side (design t): the same slots in ships.js, upgradeVisuals.js and the crew
export const gunT = (n) => [...Array(n)].map((_, i) => 0.3 + (i / Math.max(1, n - 1)) * 0.34);
// [v97] how much the waist must stretch so n guns a side get >= `gap` m between them (min = a modest stretch for player ships)
export const stretchFor = (n, len, gap = 1.55, min = 1) => Math.max(min, n > 1 ? gap * (n - 1) / (0.34 * len) : 1);
// [v97] the crew outfit each enemy colour scheme wears (reads as "not you")
const SCHEME_OUTFIT = { slime: 'degen', grape: 'kraken', reef: 'navy', boss: 'midnight', rammer: 'storm', runner: 'coral' };

// collects static parts per material, then merges them into one mesh per material (few draw calls)
class Parts {
  constructor() { this.by = new Map(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); }
  add(mat, geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
    const g = geo.index ? geo : geo; // all builders here are indexed
    const m = this._m.compose(new THREE.Vector3(...p), this._q.setFromEuler(this._e.set(...r)), new THREE.Vector3(...(Array.isArray(s) ? s : [s, s, s])));
    const c = g.clone().applyMatrix4(m);
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) c.deleteAttribute(k); // [Timothy] colour = kit AO (kit materials only)
    if (!c.index) { const n = c.attributes.position.count, ix = new (n > 65535 ? Uint32Array : Uint16Array)(n); for (let i = 0; i < n; i++) ix[i] = i; c.setIndex(new THREE.BufferAttribute(ix, 1)); }
    if (!c.attributes.uv) c.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(c.attributes.position.count * 2), 2));
    if (!this.by.has(mat)) this.by.set(mat, []);
    this.by.get(mat).push(c);
  }
  // [Timothy v2] flatten (phone Low): plain toon / glow materials are merged into a few vertex-coloured meshes (outlined toon,
  // plain toon, glow), textures baked to their mean colour (the grain is sub-pixel on a phone). `keep` (base hull, mast: skins
  // look those up), sails, double-sided, transparent and emissive materials stay as they are. Adds the merged outlined
  // material to `outlined`. Same colours, far fewer draw calls.
  flatten(outlined = new Set(), keep = new Set()) {
    const ok = (m) => !keep.has(m) && !m.transparent && m.side === THREE.FrontSide && !m.customProgramCacheKey?.().startsWith?.('sail') &&
      (m.isMeshToonMaterial ? !(m.emissive && m.emissive.getHex()) : m.isMeshBasicMaterial && !m.map);
    const G = { ol: [], toon: [], basic: [] }; let gm = null;
    for (const [mat, list] of [...this.by]) {
      if (!ok(mat)) continue;
      const c = mat.color.clone();
      if (mat.map?.image) try {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1; const x = cv.getContext('2d');
        x.drawImage(mat.map.image, 0, 0, 1, 1); const d = x.getImageData(0, 0, 1, 1).data;
        c.multiply(new THREE.Color().setRGB(d[0] / 255, d[1] / 255, d[2] / 255, THREE.SRGBColorSpace));
      } catch (e) { continue; }
      for (const g of list) {
        const n = g.attributes.position.count, old = mat.vertexColors && g.attributes.color, a = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { const k = old ? [old.getX(i), old.getY(i), old.getZ(i)] : [1, 1, 1]; a[i * 3] = c.r * k[0]; a[i * 3 + 1] = c.g * k[1]; a[i * 3 + 2] = c.b * k[2]; }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      }
      if (mat.isMeshToonMaterial) { (outlined.has(mat) ? G.ol : G.toon).push(...list); gm = gm || mat.gradientMap; } else G.basic.push(...list);
      this.by.delete(mat);
    }
    // every merged list needs the same attributes: drop any stray ones, add missing uv
    const norm = (L) => L.forEach(g => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.normal) g.computeVertexNormals(); });
    if (G.ol.length) { norm(G.ol); const m = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gm }); m.name = 'flat-ol'; this.by.set(m, G.ol); outlined.add(m); }
    if (G.toon.length) { norm(G.toon); const m = new THREE.MeshToonMaterial({ color: 0xffffff, vertexColors: true, gradientMap: gm }); m.name = 'flat'; this.by.set(m, G.toon); }
    if (G.basic.length) { norm(G.basic); const m = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }); m.name = 'flat-glow'; this.by.set(m, G.basic); }
    return this;
  }
  build(parent, outlined = new Set(), thickness = 0.05, shadows = false) {
    for (const [mat, list] of this.by) {
      const geo = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = shadows && !mat.isMeshBasicMaterial; mesh.receiveShadow = shadows && !mat.isMeshBasicMaterial;
      parent.add(mesh);
      if (outlined.has(mat)) parent.add(outlineFor(mesh, thickness));
      list.forEach(g => g.dispose());
    }
  }
}

// ---------- ship builder ----------
export function buildShip(opts) {
  const {
    len = 16, beam = 5.2, depth = 3, scheme = 'player', mainSailMap = null, flagMap, flagScale = 1,
    cannonsPerSide = 3, masts = 2, light = false, shadows = false, boss = false, stretch = 1,
  } = opts;
  const ZM = zMap(len, stretch), fullLen = ZM.L; // [v97] len = the design length (rig, cabin, flag); fullLen = the stretched hull
  const K = kit(scheme, mainSailMap, !!opts.kitArt);
  const ART = !!K.art, kg = (n) => (ART ? kitGeo(n) : null); // [Timothy] kit mesh or null (procedural part)
  const ship = new THREE.Group();
  const body = new THREE.Group(); ship.add(body); // body gets bob/tilt
  const parts = new Parts();
  // [Timothy v2] ART (player ships): the old rails / cabin / stern dressing go to `legacy` (hidden; shown again if a shape-changing
  // skin hides the base hull), the new upper works (castles, sheer rail, transom, lids) go to `dress` (hidden with the base hull)
  const legacy = ART ? new Parts() : parts, dress = ART ? new Parts() : null;

  const { geo: hullGeo, sections, shape } = hullGeometry(len, beam, depth, ZM.z, stretch, ART);
  parts.add(K.hull, hullGeo);
  const deckDrop = 0.5;
  parts.add(K.deck, deckGeometry(len, shape, deckDrop, 0.9, null, ZM.z, stretch));
  const deckAt = (t) => shape.top(t) - deckDrop;
  const zAt = ZM.z;
  // [Raul] solid deck: a hull-coloured sole 0.16 under the planks (below its own toon outline) reaches the hull walls (closes the waterway gap
  // between the deck edge and the side), so the interior is closed at any angle
  parts.add(K.hull, deckGeometry(len, shape, deckDrop + 0.16, 1.0, 0.975, ZM.z, stretch));

  // gunwale cap rail + wale (gold) + railing posts and top rail
  for (const sx of [1, -1]) {
    const cap = [], wale = [], rail = [];
    const NR = 22 + Math.round((stretch - 1) * 10);
    for (let i = 0; i <= NR; i++) {
      const t = 0.02 + i / NR * 0.95, w = shape.halfW(t), y = shape.top(t), z = zAt(t);
      cap.push(new THREE.Vector3(sx * w * 0.97, y + 0.02, z));
      wale.push(new THREE.Vector3(sx * (w * 1.0 + 0.04), y - depth * 0.28, z));
      rail.push(new THREE.Vector3(sx * w * 0.9, y + 0.62, z));
    }
    legacy.add(K.gold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cap), 40, 0.13, 6));
    legacy.add(K.gold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wale), 40, 0.09, 5));
    legacy.add(K.mast, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail.slice(4)), 30, 0.07, 5));
    const post = cyl(0.06, 0.07, 0.62, 5);
    for (let i = 4; i < rail.length; i += 1) { const p = rail[i]; legacy.add(K.mast, post, [p.x, p.y - 0.31, p.z]); }
    legacy.add(K.hull, bulwarkGeometry(cap.slice(4), rail.slice(4), sx)); // [Raul] solid bulwark behind the rail posts: no sea through the balusters
  }
  let figInfo = null;
  // bow knee + figure: a gold-capped stem post
  const bowT = 0.995, bowY = shape.top(bowT);
  // [v87] seated ON the stem head (it used to overhang the bow and read as floating off the front), on a short knee post
  if (ART && kg('figurehead_gold')) { // [Timothy] gilded skull-in-a-tricorn figurehead on the cutwater, under the bowsprit
    const fs = depth / 3.1 * (opts.kitArt?.ram ? 0.85 : 1.05), fp = [0, bowY - (opts.kitArt?.ram ? 0.55 : 0.95) * fs, zAt(1) - 0.32 * fs];
    for (const [n, m] of [['figurehead_gold', K.goldK], ['figurehead_dark', K.darkK], ['figurehead_wood', K.woodK]]) parts.add(m, kg(n), fp, [0, 0, 0], fs);
    figInfo = { p: fp, s: fs, bowY, zb: zAt(1) }; // [Timothy v2] HULL max crowns + winged figurehead (upgradeVisuals)
    parts.add(K.goldK, vc(new THREE.SphereGeometry(0.24, 14, 10)), [0, bowY + 0.3, zAt(1) - 0.24]); // stem-head knob
  } else parts.add(K.gold, new THREE.SphereGeometry(0.32, 10, 8), [0, bowY + 0.32, zAt(1) - 0.24]);
  parts.add(K.mast, cyl(0.12, 0.17, 0.75, 6), [0, bowY - 0.05, zAt(1) - 0.22]);

  // stern castle: chunky rounded cabin, gold roof trim, quarterdeck rail, glowing windows
  const cabT = 0.13, cabZ = zAt(cabT), cabL = len * 0.24, cabW = beam * 0.74, cabH = 1.9 + (boss ? 0.4 : 0);
  const deckY = deckAt(0.5);
  const cabY0 = deckAt(cabT) - 0.05;
  legacy.add(K.cabin, new RoundedBoxGeometry(cabW, cabH, cabL, 3, 0.22), [0, cabY0 + cabH / 2, cabZ]);
  legacy.add(K.gold, new RoundedBoxGeometry(cabW + 0.4, 0.22, cabL + 0.35, 2, 0.08), [0, cabY0 + cabH + 0.08, cabZ]);
  const qRail = [];
  for (let i = 0; i < 4; i++) { const a = i / 4; qRail.push([[cabW / 2, -cabL / 2 + a * cabL], [-cabW / 2, -cabL / 2 + a * cabL]]); }
  const qp = cyl(0.06, 0.06, 0.55, 5);
  for (const sx of [1, -1]) {
    legacy.add(K.mast, cyl(0.06, 0.06, cabL, 5), [sx * cabW / 2, cabY0 + cabH + 0.62, cabZ], [Math.PI / 2, 0, 0]);
    for (let i = 0; i <= 4; i++) legacy.add(K.mast, qp, [sx * cabW / 2, cabY0 + cabH + 0.36, cabZ - cabL / 2 + i * cabL / 4]);
  }
  legacy.add(K.mast, cyl(0.06, 0.06, cabW, 5), [0, cabY0 + cabH + 0.62, cabZ - cabL / 2], [0, 0, Math.PI / 2]);
  // stern windows (back face) + side windows, each with a dark frame
  const winG = new THREE.PlaneGeometry(0.5, 0.62), frameG = new RoundedBoxGeometry(0.7, 0.82, 0.08, 1, 0.04);
  const nW = boss ? 4 : 3;
  for (let i = 0; i < nW; i++) {
    const x = (i - (nW - 1) / 2) * cabW * 0.26, y = cabY0 + cabH * 0.55, z = cabZ - cabL / 2 - 0.04;
    legacy.add(K.gold, frameG, [x, y, z + 0.02]);
    legacy.add(K.window, winG, [x, y, z - 0.03], [0, Math.PI, 0]);
  }
  for (const sx of [1, -1]) for (let i = 0; i < 2; i++) {
    const z = cabZ + (i - 0.5) * cabL * 0.45, y = cabY0 + cabH * 0.55, x = sx * (cabW / 2 + 0.04);
    legacy.add(K.dark, frameG, [x - sx * 0.02, y, z], [0, Math.PI / 2, 0]);
    legacy.add(K.window, winG, [x + sx * 0.03, y, z], [0, sx * Math.PI / 2, 0]);
  }
  if (ART && kg('stern_gold')) { // [Timothy] gilded scroll board across the transom, above the stern windows
    const top = cabY0 + cabH * 0.55 + 0.43, hh = Math.max(0.3, cabY0 + cabH - 0.05 - top), sc = [cabW * 0.9, hh / 0.42, 1];
    legacy.add(K.goldK, kg('stern_gold'), [0, top, cabZ - cabL / 2 - 0.01], [0, 0, 0], sc); legacy.add(K.woodK, kg('stern_wood'), [0, top, cabZ - cabL / 2 - 0.01], [0, 0, 0], sc);
  }
  // lanterns: stern pair, bow, crow's nest; brass cage + glowing core
  const lanterns = [];
  const lantern = (p, s = 1, P = parts) => {
    if (ART && kg('lantern_gold')) P.add(K.goldK, kg('lantern_gold'), p, [0, 0, 0], s); // [Timothy] hex brass cage (kit)
    else { P.add(K.gold, cyl(0.16 * s, 0.24 * s, 0.14 * s, 8), [p[0], p[1] + 0.32 * s, p[2]]);
    P.add(K.gold, cyl(0.2 * s, 0.14 * s, 0.1 * s, 8), [p[0], p[1] - 0.28 * s, p[2]]); }
    P.add(ART && P === dress ? K.lanArt : K.lantern, new THREE.SphereGeometry(0.22 * s, 10, 8), p, [0, 0, 0], [1, 1.25, 1]);
    P.add(K.dark, cyl(0.03, 0.03, 0.5 * s, 4), [p[0], p[1] + 0.6 * s, p[2]]);
    if (P !== legacy || !ART) lanterns.push(new THREE.Vector3(...p));
  };
  for (const sx of [1, -1]) lantern([sx * cabW * 0.46, cabY0 + cabH + 0.95, cabZ - cabL / 2 - 0.15], boss ? 1.4 : 1.15, legacy);
  lantern([0, bowY + 0.95, zAt(0.93)], 0.9, legacy);
  if (light) { const pl = new THREE.PointLight(K.S.lantern, ART ? 6 : 14, 32, 1.6); // [Timothy v2] ART: over the quarterdeck, to port (away from the helm): lights the deck + captain, not the transom face (it keeps its dark paint)
    if (ART) pl.position.set(cabW * 0.3, cabY0 + cabH + 1.6, cabZ - cabL * 0.1); else pl.position.set(0, cabY0 + cabH + 1.4, cabZ - cabL / 2 - 0.6); body.add(pl); }

  // cannons (port +X, starboard -X): lathe barrel on a rounded carriage, painted gun port behind
  const muzzles = { port: [], star: [], bow: [] }, guns = []; // [Raul] bow: forward chase-gun tips (js/upgradeVisuals.js) // guns: deck slots for the crew
  const barrel = lathe(CANNON, LITE ? 8 : 12); // [v97] phones / LOW: lighter cannon geometry (same shape)
  // [v97] sea-service truck carriage: stepped cheeks, bed, axles, four wooden trucks with iron tyres (all merged per material)
  const cheekLo = new RoundedBoxGeometry(0.86, 0.26, 0.1, 1, 0.03), cheekHi = new RoundedBoxGeometry(0.46, 0.2, 0.1, 1, 0.03), bed = new RoundedBoxGeometry(0.8, 0.08, 0.5, 1, 0.02);
  const axle = cyl(0.045, 0.045, 0.78, LITE ? 4 : 6), truck = cyl(0.15, 0.15, 0.08, LITE ? 7 : 10), tyre = LITE ? null : new THREE.TorusGeometry(0.15, 0.025, 4, 12), bore = new THREE.CircleGeometry(0.15, LITE ? 7 : 10);
  const wheel = truck;
  const port = new RoundedBoxGeometry(0.12, 0.72, 0.9, 1, 0.04);
  const cs = boss ? 1.25 : 1;
  let GT = gunT(cannonsPerSide);
  // [Raul] BANKSY: no guns in the stern room. On the v2 hull (ART) the quarterdeck runs to tB, so the whole gun row starts 1 m ahead of
  // its break bulkhead, same spacing as before (0.34 of the stretched waist), and ends clear of the forecastle break. Muzzles, gunners,
  // ports, lids and upgrade guns all follow GT. Procedural / enemy hulls (cabin ends at t 0.25) keep their slots.
  // gun footprint (base gun, or the upgrade's big gun when opts.bigGun = its TRAITS.cannons 'big' scale): gIn = breech inboard of cx
  const bigS = (opts.bigGun || 0) * depth / 3.1;
  const gIn = Math.max(0.1 + 0.43 * cs, 0.35 + 0.31 * 1.25 * cs, bigS ? 0.3 - 1.525 * cs + 1.281 * bigS + 0.326 * bigS : 0); // breech, inboard of cx
  const gR = Math.max(0.4 * cs, 0.305 * 1.1 * cs, 0.305 * bigS); // half-width of gun + barrel along z
  // [Raul] the row runs from just ahead of the quarterdeck ladders to where the hull is still wide enough for a gunner behind each
  // breech (port + starboard gunners clear of each other and of the centreline), so no big gun's breech meets its twin at the bow.
  if (ART) { const zB0 = zAt(cabT + cabL / len), runB = (cabY0 + cabH + 0.15 - deckAt(cabT + cabL / len)) * 0.55 + 0.1, n = cannonsPerSide;
    const zs = zB0 + runB + 0.42, zOld = zB0 + 1.0 + 0.34 * len * stretch, room = (z) => shape.halfW(ZM.t(z)) - 0.45 - gIn - 0.38;
    let ze = Math.min(zOld, zAt(0.84) - 0.9); while (ze > zs && room(ze) < 0.72) ze -= 0.05;
    ze = Math.min(zOld, Math.max(ze, zs + (n - 1) * (2 * gR + 0.12))); // never closer than two gun widths
    GT = [...Array(n)].map((_, i) => ZM.t(zs + (n > 1 ? i / (n - 1) : 0) * (ze - zs))); }
  for (let i = 0; i < cannonsPerSide; i++) {
    const t = GT[i];
    const w = shape.halfW(t), y = deckAt(t), z = zAt(t);
    for (const side of ['port', 'star']) {
      const sx = side === 'port' ? 1 : -1;
      const cx = sx * (w - 0.45), c0 = cx - sx * 0.1;
      if (ART && kg('carriage_wood')) { // [Timothy] kit sea-service carriage (same footprint), starboard = the port one turned 180°
        const r = [0, sx > 0 ? 0 : Math.PI, 0];
        for (const [n, m] of [['carriage_wood', K.woodK], ['carriage_iron', K.ironK], ['carriage_rope', K.ropeK]]) if (kg(n)) parts.add(m, kg(n), [c0, y, z], r, cs);
      } else {
      parts.add(K.cabin, bed, [c0, y + 0.18, z], [0, 0, 0], cs);
      for (const dz of [-0.24, 0.24]) { parts.add(K.cabin, cheekLo, [c0, y + 0.3, z + dz * cs], [0, 0, 0], cs); parts.add(K.cabin, cheekHi, [c0 - sx * 0.2 * cs, y + 0.52 * cs, z + dz * cs], [0, 0, 0], cs); }
      for (const dx of [-0.27, 0.27]) {
        parts.add(K.iron, axle, [c0 + dx * cs, y + 0.15, z], [Math.PI / 2, 0, 0], cs);
        for (const dz of [-0.36, 0.36]) { parts.add(K.cabin, truck, [c0 + dx * cs, y + 0.15, z + dz * cs], [Math.PI / 2, 0, 0], cs); if (tyre) parts.add(K.iron, tyre, [c0 + dx * cs, y + 0.15, z + dz * cs], [0, 0, 0], cs); }
      }
      }
      // barrel axis = local +Y, rotate so it points outward along ±X, poking over the gunwale
      parts.add(ART && kg('barrel') ? K.ironK : K.iron, (ART && kg('barrel')) || barrel, [cx - sx * 0.35, y + 0.55, z], [0, 0, -sx * Math.PI / 2], [cs * 1.1, cs * 1.25, cs * 1.1]); // [Timothy] kit barrel: same profile, tip at the same y 1.22
      parts.add(K.dark, bore, [cx - sx * 0.35 + sx * (1.2 * cs * 1.25), y + 0.55, z], [0, sx * Math.PI / 2, 0], cs * 1.1);
      parts.add(K.dark, port, [sx * (w * 1.0 + 0.02), shape.top(t) - 0.5, z]);
      parts.add(K.gold, new RoundedBoxGeometry(0.08, 0.86, 1.04, 1, 0.03), [sx * (w * 1.0 + 0.0), shape.top(t) - 0.5, z]);
      const m = new THREE.Object3D(); m.position.set(cx - sx * 0.35 + sx * (1.22 * cs * 1.25 + 0.04), y + 0.55, z); body.add(m); // [v95] AT the barrel tip (was 0.3 m past it)
      muzzles[side].push(m);
      guns.push({ x: cx, y, z, sx, i });
    }
  }
  // [Timothy v2] NEW PLAYER HULL SILHOUETTE (ART only, visual only: every position the game reads still comes from `shape` / zAt above).
  // Raised quarterdeck + forecastle on real castle walls, a sweeping sheer rail, tumblehome topsides, open gun ports in the bulwark,
  // a lit stern gallery transom with gold mouldings and big stern lanterns, red gun-port lids, a raised helm dais.
  let art = null;
  if (ART) {
    const top = shape.top, D = dress, tB = cabT + cabL / len, tF = 0.84, Q = cabY0 + cabH + 0.15;
    const ss = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
    const lerp = (a, b, u) => a + (b - a) * u;
    const hullX = (t, d) => { const yd = top(t), yk = shape.keel(t), w = shape.halfW(t); const u = Math.min(1, Math.pow(Math.max(0, d) / Math.max(0.01, yd - yk), 1 / 1.1));
      return w * Math.pow(Math.sqrt(Math.max(0, 1 - u * u)), 0.42) * (1 - 0.08 * Math.pow(1 - u, 3)); };
    const waist = (t) => top(t) + 0.66, Fc = (t) => top(t) + 0.62;
    const railY = (t) => { let y = waist(t); if (t < tB + 0.04) y = Math.max(y, lerp(Q + 0.95, waist(t), ss(tB - 0.005, tB + 0.035, t)));
      return Math.max(y, lerp(waist(t), Fc(t) + 0.9, ss(tF - 0.035, tF + 0.005, t))); };
    const wallX = (t, y) => Math.max(0.08, hullX(t, 0.0) - 0.06 * Math.max(0, y - top(t))); // topsides lean in (tumblehome)
    const NS = (LITE ? 44 : 72) + Math.round((stretch - 1) * (LITE ? 8 : 14));
    const ts = new Set(); for (let i = 0; i <= NS; i++) ts.add(0.003 + i / NS * 0.99);
    const dzdt = len * stretch, gw = 0.5 / dzdt, gaps = GT.map(t => [t - gw, t + gw]);
    for (const [a, b] of gaps) { ts.add(a); ts.add(b); }
    for (const t of [tB - 0.005, tB + 0.035, tF - 0.035, tF + 0.005]) ts.add(t);
    const T = [...ts].sort((a, b) => a - b), inGap = (t) => gaps.some(([a, b]) => t > a && t < b);
    // castle walls + waist bulwark (open gun ports), both sides, double-sided upper-works paint
    for (const sx of [1, -1]) {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i < T.length - 1; i++) {
        const ta = T[i], tb = T[i + 1]; if (inGap((ta + tb) / 2)) continue;
        const n = pos.length / 3;
        for (const t of [ta, tb]) { const y0 = top(t) - 0.03, y1 = railY(t), z = zAt(t);
          pos.push(sx * (hullX(t, 0.03) + 0.005), y0, z, sx * wallX(t, y1), y1, z); uv.push(z / 5, (y1 - y0) / 3.2, z / 5, 0); }
        if (sx > 0) idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); else idx.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals(); D.add(K.upper, g);
      // gold sheer rail on the wall top, gold gunwale + main wale mouldings
      const cap = [], gun = [], wale = [];
      for (let i = 0; i <= NS; i++) { const t = 0.004 + i / NS * 0.99, z = zAt(t), y = railY(t);
        cap.push(new THREE.Vector3(sx * wallX(t, y), y + 0.03, z));
        if (t > 0.015 && t < 0.975) { gun.push(new THREE.Vector3(sx * (hullX(t, 0.03) + 0.05), top(t) - 0.03, z)); wale.push(new THREE.Vector3(sx * (hullX(t, 0.98) + 0.06), top(t) - 0.98, z)); } }
      D.add(K.gold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cap), NS * 2, LITE ? 0.12 : 0.14, LITE ? 5 : 6));
      D.add(K.gold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gun), NS, 0.09, 5));
      D.add(K.gold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(wale), NS, LITE ? 0.11 : 0.13, 5));
    }
    // a flat deck strip between the walls at y(t) over t0..t1
    const floor = (t0, t1, yf, n) => { const pos = [], uv = [], idx = [];
      for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n, y = yf(t), z = zAt(t), w = wallX(t, y) - 0.02; pos.push(w, y, z, -w, y, z); uv.push(z / 4, w / 1.4, z / 4, -w / 1.4); }
      for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } // [Raul] faces UP (it faced down: the quarterdeck / forecastle roofs were see-through from above)
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    D.add(K.deck, floor(0.004, tB, () => Q, 10));
    D.add(K.deck, floor(tF, 0.99, Fc, 10));
    // vertical bulkhead across the ship at t from y0 to y1 (break of the quarterdeck / forecastle, upper transom)
    const bulk = (t, y0, y1, dz = 0) => { const pos = [], uv = [], idx = [], z = zAt(t) + dz, n = 6;
      for (let j = 0; j <= n; j++) { const y = y0 + (y1 - y0) * j / n, w = Math.max(0.08, Math.min(wallX(t, y), y < top(t) ? hullX(t, top(t) - y) : 99)); pos.push(w, y, z, -w, y, z); uv.push(w / 5, (Q + 0.95 - y) / 3.2, -w / 5, (Q + 0.95 - y) / 3.2); }
      for (let j = 0; j < n; j++) { const a = j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
    const z0 = zAt(0.004), zB = zAt(tB), zF = zAt(tF);
    D.add(K.upper, bulk(tB, deckAt(tB) - 0.05, Q, 0.0));
    D.add(K.upper, bulk(tF, deckAt(tF) - 0.05, Fc(tF), 0.0));
    D.add(K.upper, bulk(0.004, Math.min(top(0.004), Q) - 0.05, railY(0.004), -0.01));
    // break rails: gold handrail + balusters across the front of the quarterdeck and the back of the forecastle; companion ladders
    const breakRail = (z, y, w, n, dir) => { D.add(K.gold, cyl(0.07, 0.07, w * 2, 6), [0, y + 0.88, z], [0, 0, Math.PI / 2]);
      const bal = cyl(0.045, 0.06, 0.86, 5); for (let i = 0; i <= n; i++) { const x = -w + i * 2 * w / n; if (Math.abs(x) > 0.55 && Math.abs(x) < 1.25) continue; D.add(K.mast, bal, [x, y + 0.43, z + dir * 0.04]); } };
    breakRail(zB, Q, wallX(tB, Q) - 0.05, LITE ? 6 : 10, -1); breakRail(zF, Fc(tF), wallX(tF, Fc(tF)) - 0.05, LITE ? 4 : 8, 1);
    for (const [zz, y0, y1, dir] of [[zB, deckAt(tB), Q, 1], [zF, deckAt(tF), Fc(tF), -1]]) for (const sx of [1, -1]) { // ladders (0.55..1.25 off centre: the gap in the rail)
      const run = (y1 - y0) * 0.55, ang = Math.atan2(run, y1 - y0), L = Math.hypot(run, y1 - y0), x = sx * 0.9;
      for (const dx of [-0.3, 0.3]) D.add(K.mast, new THREE.BoxGeometry(0.08, L, 0.1), [x + dx, (y0 + y1) / 2, zz + dir * run / 2], [dir * ang, 0, 0]);
      for (let k = 1; k < 6; k++) { const f = k / 6; D.add(K.mast, new THREE.BoxGeometry(0.6, 0.06, 0.2), [x, y0 + (y1 - y0) * f, zz + dir * run * (1 - f)]); }
    }
    // break bulkhead: door + lit windows (seen from the deck / above)
    D.add(K.dark, new RoundedBoxGeometry(0.9, 1.5, 0.1, 1, 0.04), [0, deckAt(tB) + 0.75, zB + 0.04]);
    for (const sx of [1, -1]) { D.add(K.gold, new RoundedBoxGeometry(0.72, 0.62, 0.08, 1, 0.03), [sx * 1.75, deckAt(tB) + 1.55, zB + 0.04]); D.add(K.window, new THREE.PlaneGeometry(0.54, 0.44), [sx * 1.75, deckAt(tB) + 1.55, zB + 0.09]); }
    // STERN GALLERY TRANSOM (what the chase camera looks at): two rows of lit windows in gold frames, gold mouldings, corner pilasters
    const tw = (y) => hullX(0.004, Math.max(0, top(0.004) - y)), frame = new RoundedBoxGeometry(1, 1, 0.1, 1, 0.04), pane = new THREE.PlaneGeometry(1, 1);
    for (const [yc, h, n, wf] of [[Q - 0.85, 0.7, 5, 0.46], [Q - 1.95, 0.5, 4, 0.38]]) { // warm panes in dark frames: the transom stays dark, the windows pop
      const W = tw(yc) * 0.8, sp = 2 * W / n;
      for (let i = 0; i < n; i++) { const x = -W + sp * (i + 0.5), ww = Math.min(sp * 0.6, wf);
        D.add(K.dark, frame, [x, yc, z0 - 0.04], [0, 0, 0], [ww + 0.16, h + 0.16, 1]);
        D.add(K.winArt, pane, [x, yc, z0 - 0.1], [0, Math.PI, 0], [ww, h, 1]);
        D.add(K.dark, new THREE.BoxGeometry(0.05, h, 0.04), [x, yc, z0 - 0.12]); } // mullion
    }
    for (const y of [Q - 0.3, Q - 1.45, Q - 2.4]) D.add(K.gold, cyl(0.09, 0.09, tw(y) * 2 * 0.98, 6), [0, y, z0 - 0.06], [0, 0, Math.PI / 2]);
    for (const sx of [1, -1]) { const pts = []; for (let k = 0; k <= 6; k++) { const y = Q - 2.6 + (railY(0.004) - Q + 2.6) * k / 6; pts.push(new THREE.Vector3(sx * (y > top(0.004) ? wallX(0.004, y) : tw(y)) * 0.99, y, z0 - 0.05)); }
      D.add(K.gold, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.13, 6)); }
    if (kg('stern_gold')) { const hh = railY(0.004) - Q - 0.12, sc = [wallX(0.004, Q + 0.5) * 1.7, hh / 0.42, 1.4];
      D.add(K.goldK, kg('stern_gold'), [0, Q + 0.02, z0 - 0.05], [0, 0, 0], sc); D.add(K.woodK, kg('stern_wood'), [0, Q + 0.02, z0 - 0.05], [0, 0, 0], sc); }
    // big stern lanterns on the taffrail corners (no centre lamp: it would hide the captain at the helm from the chase camera)
    for (const sx of [1, -1]) { const x = sx * wallX(0.004, Q + 0.95) * 0.8, y = railY(0.004);
      D.add(K.iron, cyl(0.06, 0.06, 0.9, 5), [x, y + 0.4, z0 - 0.15]); lantern([x, y + 0.95, z0 - 0.2], 1.05, D); }
    lantern([wallX(0.95, Fc(0.95)) * 0.7, Fc(0.95) + 1.3, zAt(0.95)], 1.2, D); // bow lantern on the forecastle head, to PORT: clear of the captain's eye line (helm to starboard)
    // red gun-port lids, hinged open above every port
    const lidG = new RoundedBoxGeometry(0.08, 0.66, 0.84, 1, 0.03);
    for (const t of GT) for (const sx of [1, -1]) { const hy = top(t) - 0.14, hx = sx * (hullX(t, 0.14) + 0.12);
      D.add(K.lid, lidG, [hx + sx * 0.33 * 0.77, hy + 0.33 * 0.64, zAt(t)], [0, 0, -sx * 0.87]); }
    // RAISED HELM: a dais on the quarterdeck (or on the poop deck when the hull upgrade adds one), clear of rails and lamps
    const poopH = opts.kitArt?.poopH || 0;
    // the helm sits to STARBOARD of the centreline so the captain's eye line runs past the masts 
    const hx = -Math.min(1.35, wallX(0.18, Q + 1) - 0.85);
    const helm = poopH ? { x: hx, y: Q - 0.15 + poopH + 0.2, z: cabZ - cabL * 0.21 + 0.45 } : { x: hx, y: Q + 0.26, z: cabZ + cabL / 2 - 1.05 };
    if (!poopH) { D.add(K.mast, new RoundedBoxGeometry(1.5, 0.26, 1.9, 1, 0.06), [hx, Q + 0.13, helm.z - 0.25]);
      D.add(K.gold, new RoundedBoxGeometry(1.6, 0.08, 2.0, 1, 0.03), [hx, Q + 0.19, helm.z - 0.25]);
      D.add(K.mast, new RoundedBoxGeometry(0.5, 0.13, 0.5, 1, 0.03), [hx, Q + 0.065, helm.z + 0.95]); } // step up onto the dais
    D.add(K.cabin, new RoundedBoxGeometry(0.36, 0.7, 0.36, 1, 0.05), [helm.x + 0.55, helm.y + 0.35, helm.z + 0.6]); // binnacle with a lit compass (beside the wheel, under the eye line)
    D.add(K.lantern, new THREE.SphereGeometry(0.12, 8, 6), [helm.x + 0.55, helm.y + 0.78, helm.z + 0.6]);
    art = { Q, tB, tF, Fc, railY, helm };
  }
  // a few barrels + crates on deck for detail
  const keg = lathe([[0.001, 0], [0.3, 0], [0.36, 0.25], [0.36, 0.45], [0.3, 0.7], [0.001, 0.7]], 10);
  [[0.25, 0.55, 0.42], [-0.3, 0.7, 0.4], [0.3, 0.78, 0.35]].forEach(([xf, t, s], i) => {
    const y = deckAt(t), z = zAt(t);
    if (i < 2) parts.add(K.cabin, keg, [xf * beam, y, z], [0, i, 0], s * 2.4);
    else parts.add(K.cabin, new RoundedBoxGeometry(0.8, 0.7, 0.8, 2, 0.08), [xf * beam, y + 0.35, z], [0, 0.4, 0]);
  });

  // masts, gold bands, yards, crow's nest, sails, rigging
  const mastDefs = masts >= 3 ? [[0.57, 1.0], [0.79, 0.78], [0.32, 0.72]] : [[0.55, 1.0], [0.8, 0.78]];
  const sails = [], rig = [];
  let flagPole = null, nestAt = null;
  mastDefs.forEach(([tf, hf], mi) => {
    const mz = zAt(tf), my = deckAt(tf), mh = len * 0.98 * hf;
    // [Raul] BANKSY: a mast over the stern room (the mizzen) is stepped ON the quarterdeck roof, not on the main deck inside the room.
    // Its head, yards and sails stay where they were (rig, sails and upgrade layers all key off my / mh).
    const fy = art && tf < art.tB ? art.Q : my;
    parts.add(K.mast, cyl(0.17, 0.3, my + mh - fy + 0.6, 10), [0, (fy + my + mh) / 2 - 0.3, mz]); // [Raul] stepped 0.6 through the deck
    // [Raul] mast footing: partner block, collar and four chocks, so every mast is seated on the deck
    parts.add(K.mast, new THREE.BoxGeometry(1.05, 0.16, 1.05), [0, fy + 0.08, mz]);
    parts.add(K.mast, cyl(0.38, 0.46, 0.34, 10), [0, fy + 0.17, mz]);
    for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + Math.PI / 4; parts.add(K.mast, new THREE.BoxGeometry(0.16, 0.26, 0.3), [Math.cos(a) * 0.5, fy + 0.21, mz + Math.sin(a) * 0.5], [0, -a, 0]); }
    for (const f of [0.08, 0.4, 0.66]) parts.add(K.gold, new THREE.TorusGeometry(0.29 - f * 0.12 + (ART ? 0.04 : 0), ART ? 0.09 : 0.06, 6, 12), [0, Math.max(my + mh * f, fy + 0.6), mz], [Math.PI / 2, 0, 0]);
    if (ART) { // [Timothy v2] a real TOP at every lower masthead (just over the course yard): platform, gold rim, crosstrees, trestle cheeks
      const ty = my + mh * 0.74 + 0.34, tw = Math.min(2.4, beam * 0.36 * hf + 0.5), td = tw * 0.66, tz = mz - 0.12;
      parts.add(K.cabin, new RoundedBoxGeometry(tw, 0.18, td, 2, 0.06), [0, ty, tz]);
      parts.add(K.gold, new RoundedBoxGeometry(tw + 0.14, 0.1, td + 0.14, 1, 0.04), [0, ty + 0.12, tz]);
      for (const sx of [1, -1]) parts.add(K.mast, new THREE.BoxGeometry(0.14, 0.32, td * 0.9), [sx * 0.3, ty - 0.22, tz]);
      parts.add(K.mast, new THREE.BoxGeometry(tw * 1.1, 0.12, 0.14), [0, ty - 0.12, tz + td * 0.25]);
      parts.add(K.mast, new THREE.BoxGeometry(tw * 1.1, 0.12, 0.14), [0, ty - 0.12, tz - td * 0.3]);
      parts.add(K.gold, new THREE.TorusGeometry(0.22, 0.08, 6, 12), [0, ty + 0.5, mz], [Math.PI / 2, 0, 0]); // mast cap band
      if (mi === 0) lantern([tw * 0.42, ty + 0.55, tz - td * 0.35], 0.85);
    }
    if (ART && kg('channel_wood')) for (const sx of [1, -1]) { // [Timothy] channel + deadeyes on the hull side, shrouds + ratlines up to the top
      const tc = tf - 0.012, wc = shape.halfW(tc), yc = shape.top(tc), zc = zAt(tc), r = [0, sx > 0 ? 0 : Math.PI, 0];
      for (const [n, m] of [['channel_wood', K.woodK], ['channel_iron', K.ironK], ['channel_dark', K.darkK]]) parts.add(m, kg(n), [sx * wc * 0.99, yc, zc], r, [1, 1, 1.1]);
      const yTop = my + mh * 0.72 - 0.25, base = [[sx * (wc + 0.24), yc + 0.1, zc - 0.48], [sx * (wc + 0.24), yc + 0.1, zc + 0.48]], top = [[sx * 0.24, yTop, mz - 0.18], [sx * 0.24, yTop, mz + 0.12]];
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute([...base[0], ...base[1], ...top[1], ...top[0]], 3));
      rg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); rg.setIndex([0, 1, 2, 0, 2, 3]); rg.computeVertexNormals();
      parts.add(K.ratline, rg);
    }
    const tiers = ART ? [[0.74, 1.5, mi === 2 ? 0.27 : 0.35], [0.98, 1.08, 0.24]] : [[0.74, 1.5, 0.4], [0.98, 1.08, 0.24]]; // [Timothy v2] courses set higher: the captain sees under them to the bow
    tiers.forEach(([yf, wf, hfS], k) => {
      const yw = beam * wf * hf * (boss ? 1.08 : 1), sh = mh * hfS, yy = my + mh * yf;
      const yk = ART ? 1.6 : 1; // [Timothy v2] chunkier yards that read from the chase camera, gold yardarms
      const yard = lathe([[0.04 * yk, -yw / 2], [0.12 * yk, -yw * 0.3], [0.14 * yk, 0], [0.12 * yk, yw * 0.3], [0.04 * yk, yw / 2]], 6);
      parts.add(K.mast, yard, [0, yy, mz + 0.22], [0, 0, Math.PI / 2]);
      if (ART) for (const sx of [1, -1]) parts.add(K.gold, cyl(0.1, 0.1, 0.34, 6), [sx * yw * 0.47, yy, mz + 0.22], [0, 0, Math.PI / 2]);
      const sg = ART ? sailGeometry(yw * 0.97, sh * 1.04, 2.7 + sh * 0.22, LITE ? [8, 6] : [14, 10]) : sailGeometry(yw * 0.92, sh, 1.0 + sh * 0.07); // [Timothy v2] fuller, deeper-bellied cloth
      const useMain = k === 0 && K.main;
      const sail = new THREE.Group();
      const front = new THREE.Mesh(sg, useMain ? K.main : K.sail), back = new THREE.Mesh(sg, useMain ? K.mainBack : K.sailBack);
      front.castShadow = back.castShadow = shadows;
      sail.add(front, back);
      sail.position.set(0, yy - 0.12, mz + 0.34);
      body.add(sail); sails.push(sail);
      // rigging: yard tips down to the gunwale
      for (const sx of [1, -1]) rig.push([sx * yw / 2, yy, mz + 0.22], [sx * shape.halfW(tf - 0.04) * 0.95, shape.top(tf - 0.04) + 0.1, mz - 1.2]);
    });
    // stays from the masthead fore and aft
    rig.push([0, my + mh, mz], [0, bowY + 0.6, zAt(1) + len * 0.12]);
    if (mi === 0) {
      const ny = my + mh * 0.84;
      nestAt = { y: ny, z: mz }; // [v97] the enemy lookout stands in this crow's nest
      if (!ART) { parts.add(K.cabin, cyl(0.85, 0.62, 0.55, 12), [0, ny, mz]);
      parts.add(K.gold, new THREE.TorusGeometry(0.86, 0.08, 6, 16), [0, ny + 0.3, mz], [Math.PI / 2, 0, 0]);
      lantern([0.75, ny + 0.75, mz], 0.75); } // [Timothy v2] ART: the top above replaces this drum (it sat inside the topsail)
      flagPole = new THREE.Object3D(); flagPole.position.set(0, my + mh, mz); body.add(flagPole);
    }
  });
  // bowsprit + jib
  const bsL = len * 0.34;
  parts.add(K.mast, ART ? cyl(0.16, 0.3, bsL, 10) : cyl(0.1, 0.2, bsL, 8), [0, bowY + 0.5 + Math.sin(0.35) * bsL * 0.4, zAt(1) + bsL * 0.32], [Math.PI / 2 - 0.35, 0, 0]);
  const jg = new THREE.BufferGeometry();
  // [v87] the jib's head hangs on the FOREMAST's forestay, ahead of the fore course's belly (it used to run from the MAIN
  // masthead straight through the middle of the foremast's square sails)
  const foreM = mastDefs.reduce((a, b) => (b[0] > a[0] ? b : a)), fz = zAt(foreM[0]), fy = deckAt(foreM[0]) + len * 0.98 * foreM[1];
  const stZ = zAt(1) + len * 0.12, stY = bowY + 0.6, ju = Math.min(0.6, (len * 0.14 + 0.2) / Math.max(1, stZ - fz));
  const jTop = new THREE.Vector3(0, fy + (stY - fy) * ju, fz + (stZ - fz) * ju);
  const jTip = new THREE.Vector3(0, bowY + 0.6 + Math.sin(0.35) * bsL * 0.8, zAt(1) + bsL * 0.62), jFoot = new THREE.Vector3(0, bowY + 0.5, zAt(0.9));
  jg.setAttribute('position', new THREE.Float32BufferAttribute([...jTop.toArray(), ...jTip.toArray(), ...jFoot.toArray()], 3));
  jg.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 1, 1, 0, 0, 0], 2));
  jg.computeVertexNormals();
  let jibPts = null;
  const jib = new THREE.Group(); body.add(jib);
  if (ART) { // [Timothy v2] two bellied head sails (jib + flying jib) on a jib-boom, gold bands on the bowsprit
    const g1 = triSail(jTop, jTip, jFoot, 0.55, LITE ? 5 : 8); jib.add(new THREE.Mesh(g1, K.sail), new THREE.Mesh(g1, K.sailBack));
    const dir = new THREE.Vector3(0, Math.sin(0.35), Math.cos(0.35)), c0 = new THREE.Vector3(0, bowY + 0.5 + Math.sin(0.35) * bsL * 0.4, zAt(1) + bsL * 0.32);
    const jbA = c0.clone().addScaledVector(dir, bsL * 0.3), jbB = c0.clone().addScaledVector(dir, bsL * 0.95);
    parts.add(K.mast, cyl(0.09, 0.15, jbA.distanceTo(jbB), 8), jbA.clone().lerp(jbB, 0.5).toArray(), [Math.PI / 2 - 0.35, 0, 0]);
    for (const f of [0.1, 0.35]) parts.add(K.gold, new THREE.TorusGeometry(0.27 - f * 0.25, 0.07, 5, 10), c0.clone().addScaledVector(dir, bsL * (f - 0.18)).toArray(), [-0.35, 0, 0]);
    const j2Top = new THREE.Vector3(0, fy + (stY - fy) * ju * 0.55 + 0.3, fz + (stZ - fz) * ju * 0.55), j2Foot = jTip.clone().lerp(jTop, 0.08);
    const g2 = triSail(j2Top, jbB, j2Foot, 0.5, LITE ? 5 : 8); jib.add(new THREE.Mesh(g2, K.sail), new THREE.Mesh(g2, K.sailBack));
    rig.push(j2Top.toArray(), jbB.toArray(), jbB.toArray(), [0, bowY - 0.6, zAt(1) + 0.2]);
    jibPts = { j2Top: j2Top.toArray(), jbB: jbB.toArray(), dir: dir.toArray(), bsL, fz, fy }; // [Timothy v2] SAILS upgrade hangs an extra jib off these
  } else jib.add(new THREE.Mesh(jg, K.sail), new THREE.Mesh(jg, K.sailBack));
  rig.push(jTop.toArray(), jTip.toArray());

  { const ol = new Set([K.hull, K.cabin, K.mast, K.iron, K.gold, ...(ART ? [K.ironK] : [])]);
    (ART && LITE ? parts.flatten(ol, new Set([K.hull, K.mast])) : parts).build(body, ol, boss ? 0.07 : 0.05, shadows); } // [Timothy v2] phone Low: merged // [Timothy] + kit barrels (kit wood / gold pieces skip the outline: tri budget)

  // [Raul] PUMPFUN PIRATES crew: gunners at every gun + a few walkers in the waist (one draw call, LOD-culled)
  let hullDress = null, hullLegacy = null;
  if (ART) { // [Timothy v2] new upper works (hidden together with the base hull by shape-changing skins) + the old dressing for those skins
    const ol = new Set([K.upper, ...(LITE ? [] : [K.gold])]);
    hullDress = new THREE.Group(); hullDress.name = 'hull-dress'; (LITE ? dress.flatten(ol, new Set([K.upper])) : dress).build(hullDress, ol, 0.05, shadows); body.add(hullDress);
    hullLegacy = new THREE.Group(); hullLegacy.name = 'hull-legacy'; legacy.build(hullLegacy, new Set([K.hull, K.cabin, K.mast, K.gold]), 0.05, shadows); hullLegacy.visible = false; body.add(hullLegacy);
  }
  // [Timothy v2] CREW ANCHORS: named stand points the crew is placed from (today's chibi crew = placeholders; new pirate models drop in
  // per anchor later). { role: 'gunner'|'captain'|'deck'|'lookout', index, side, pos: Vector3 (body space, feet), facing: yaw (0 = +Z bow) }
  const helm = art ? art.helm : { x: 0, y: cabY0 + cabH + 0.15, z: cabZ + cabL / 2 - 0.75 }, capS = boss ? 1.6 : 1.35;
  const anchors = [];
  // [Raul] BANKSY: no pirate inside a cannon. Each gunner stands BEHIND his gun (inboard of the breech: base carriage + cascabel, or the
  // upgrade's big gun when opts.bigGun = its TRAITS.cannons 'big' scale), on the gun's own line, facing outboard. gunSlots = the footprint.
  const gunSlots = guns.map(g => ({ ...g, inner: g.x - g.sx * gIn, r: gR, gx: g.x - g.sx * (gIn + 0.38), gz: g.z }));
  gunSlots.forEach((g) => anchors.push({ role: 'gunner', index: g.i, side: g.sx > 0 ? 'port' : 'star', pos: new THREE.Vector3(g.gx, g.y, g.gz), facing: g.sx * Math.PI / 2, gun: new THREE.Vector3(g.x, g.y, g.z) }));
  anchors.push({ role: 'captain', index: 0, pos: new THREE.Vector3(helm.x, helm.y, helm.z - 0.36 * capS), facing: 0, wheel: new THREE.Vector3(helm.x, helm.y + 0.95 * capS, helm.z) });
  // [Raul] main-deck obstacles (body space boxes [x0, x1, z0, z1]): masts, every gun + its gunner, kegs / crate, castle ladders.
  // The deck walkers' lanes avoid them, the walls and each other; js/upgradeVisuals.js adds its deck parts and re-lanes (relaneCrew).
  const zB = art ? zAt(art.tB) : cabZ + cabL / 2, zF = art ? zAt(art.tF) : zAt(0.85), obs = [], dob = [];
  mastDefs.forEach(([tf]) => { if (!(art && tf < art.tB)) dob.push([-0.72, 0.72, zAt(tf) - 0.72, zAt(tf) + 0.72]); });
  [[0.25, 0.55, 0.36], [-0.3, 0.7, 0.35], [0.3, 0.78, 0.58]].forEach(([xf, t, r]) => dob.push([xf * beam - r, xf * beam + r, zAt(t) - r, zAt(t) + r]));
  if (art) for (const sx of [1, -1]) { const runB = (art.Q - deckAt(art.tB)) * 0.55 + 0.1, runF = (art.Fc(art.tF) - deckAt(art.tF)) * 0.55 + 0.1;
    dob.push([sx * 0.9 - 0.36, sx * 0.9 + 0.36, zB, zB + runB], [sx * 0.9 - 0.36, sx * 0.9 + 0.36, zF - runF, zF]); }
  const walkInfo = { z0: zB + 0.4, z1: zF - 0.4, half: (z) => shape.halfW(ZM.t(z)) * 0.9 - 0.12, base: dob, obs: [...dob, ...gunSlots.map(g => { const a = g.x + g.sx * 1.2, b = g.gx - g.sx * 0.32, h = Math.max(g.r, 0.32); return [Math.min(a, b), Math.max(a, b), g.z - h, g.z + h]; })], n: 3, deckY: (z) => deckAt(ZM.t(z)) };
  const lanes = walkLanes(walkInfo);
  const deckPts = [[0.75, deckAt(0.52), zAt(0.42)], [-0.75, deckAt(0.52), zAt(0.58)], [0.8, deckAt(0.7), zAt(0.7)], [-0.8, deckAt(0.36), zAt(0.36)]];
  lanes.forEach((l, i) => { if (i < 4) deckPts[i] = [l.x, deckAt(ZM.t((l.a + l.b) / 2)), (l.a + l.b) / 2]; }); // [Raul] idle deck spots on clear deck (one sat inside the stern room)
  // [Raul] quarterdeck spots: just behind the break rail, clear of the mizzen and the helm / poop cabin
  if (art) deckPts.push([1.6, art.Q, zB - 0.7], [-1.6, art.Q, zB - 0.7], [1.0, art.Fc(0.852), zAt(0.852)], [-1.0, art.Fc(0.852), zAt(0.852)]); // forecastle spots aft of the bow chasers
  deckPts.forEach((p, i) => anchors.push({ role: 'deck', index: i, pos: new THREE.Vector3(...p), facing: 0 }));
  const deck = { zA: zAt(STRETCH_T0), zB: zAt(STRETCH_T1), lf: len * stretch, l: len, depth, drop: deckDrop }; // walkers follow the deck sheer (crew.js)
  { const cr = addCrew(ship, { anchors, walk: { z0: zAt(0.3), z1: zAt(0.74), y: deckAt(0.52), lanes, deck }, boss }); if (cr) body.add(cr); } // [v95] + captain at the wheel (anchor)

  // Water mask: an invisible depth-only lid over the hull opening at gunwale height. It renders after the
  // ship (so the deck stays visible) but before the ocean (renderOrder 2), so wave crests that rise above
  // the deck can never show inside the hull. Scales with the ship (frigates / galleons / boss).
  const lid = new THREE.Mesh(deckGeometry(len, shape, -0.06, 1.0, null, ZM.z, stretch), WATER_MASK);
  lid.renderOrder = 1; lid.userData.waterMask = true;
  body.add(lid);

  // rigging lines
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rig.flat(), 3));
  body.add(new THREE.LineSegments(rg, K.rope));

  // flag (animated cloth, CPU wave)
  const fw = len * 0.3 * flagScale, fh = fw * 0.66;
  const fGeo = new THREE.PlaneGeometry(fw, fh, 12, 6);
  fGeo.translate(-fw / 2, fh / 2, 0); // attach edge at x=0
  fGeo.rotateY(-Math.PI / 2);        // stream toward -Z (aft)
  const flag = new THREE.Group();
  const fm = flagMats(flagMap);
  flag.add(new THREE.Mesh(fGeo, fm[0]), new THREE.Mesh(fGeo, fm[1]));
  flag.geometry = fGeo;
  flag.position.y = -fh * 0.05 + 0.4; flagPole.add(flag); flagPole.userData.fw = fw; flagPole.userData.fh = fh;
  const pole = new THREE.Mesh(cyl(0.06, 0.06, fh + 1.2, 5), K.mast); pole.position.y = fh / 2 + 0.4; flagPole.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), K.gold); knob.position.y = fh + 1.0; flagPole.add(knob);
  const base = fGeo.attributes.position.array.slice();

  ship.userData = { gunCs: cs, body, muzzles, sails, flag, flagBase: base, len: fullLen, baseLen: len, hitLen: opts.hitLen ?? fullLen, beam, depth, deckY, lanterns }; // [v97] hitLen: the hit box (stretch ≤ +10%, Waves none)
  // [Raul] upgrade visuals: hull/mast/cabin layout so js/upgradeVisuals.js can attach upgrade layers (no visual change here)
  // [v97] enemy ships get the spyglass lookout like yours: a pirate with a telescope patrolling the main crow's nest
  // (merged into the same crew mesh, visual only; player ships add theirs from js/upgradeVisuals.js with SPYGLASS)
  if (opts.lookout && nestAt && crewLodOf(body)) addLookout(ship, body, { at: { x: 0, y: nestAt.y + 0.3, z: nestAt.z }, r: 0.5, size: boss ? 1.0 : 0.9 });
  if (SCHEME_OUTFIT[scheme]) dressCrew(body, opts.outfit || SCHEME_OUTFIT[scheme]); // [v97] enemy crews in enemy colours
  ship.userData.buildOpts = opts; ship.userData.gunGap = Math.min(0.07, 0.5 / Math.max(1, cannonsPerSide));
  if (ship.userData.crew?.uGap) ship.userData.crew.uGap.value = ship.userData.gunGap;
  ship.userData.jibPts = jibPts; ship.userData.figure = figInfo; ship.userData.kitMats = ART ? { lid: K.lid, band2: K.band2, upper: K.upper, gold: K.gold, winArt: K.winArt } : null; ship.userData.anchors = anchors; ship.userData.hullDress = hullDress; ship.userData.hullLegacy = hullLegacy; ship.userData.art = art;
  { const root = new THREE.Group(); root.name = 'crew-anchors'; const n = {}; // empties, one per anchor (named role_side_index), for tools / later GLB crews
    for (const a of anchors) { const o = new THREE.Object3D(); o.name = [a.role, a.side, a.index].filter(v => v !== undefined).join('_'); o.position.copy(a.pos); o.rotation.y = a.facing; o.userData.anchor = a; root.add(o); a.node = o; }
    body.add(root); }
  ship.userData.walkInfo = walkInfo; ship.userData.walkLanes = lanes; ship.userData.deckObs = obs; ship.userData.gunT = GT; ship.userData.gunSlots = gunSlots; ship.userData.room = art ? { z0: zAt(0), z1: zB, y0: deckAt(art.tB) - 0.1, y1: art.Q } : { z0: zAt(0), z1: cabZ + cabL / 2, y0: cabY0, y1: cabY0 + cabH, w: cabW / 2 }; // [Raul] tests + upgrade layers
  placeCrew(ship); // [Raul] gunners by their guns + walker lanes round everything (upgrade builds re-run it with their deck parts)
  ship.userData.layout = { shape, deckDrop, mastDefs, cab: { z: cabZ, l: cabL, w: cabW, h: cabH, y0: cabY0 }, bowY, bsL, flagPole, zAt, stretch };
  return ship;
}

export function animateShip(ship, t, sailLevel = 1) {
  const { flag, flagBase, sails } = ship.userData;
  const p = flag.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = flagBase[i * 3 + 2], y = flagBase[i * 3 + 1];
    const d = -z; // distance from pole
    p.setX(i, Math.sin(d * 1.3 - t * 7 + y * 0.4) * 0.2 * d + Math.sin(d * 3 - t * 11) * 0.05 * d);
    p.setY(i, y - d * d * 0.012 * (1 + Math.sin(t * 3 + d)));
  }
  p.needsUpdate = true;
  // furl sails up to the yard with sail level (0..1)
  const s = 0.16 + 0.84 * sailLevel;
  sails.forEach(sl => { sl.scale.y += (s - sl.scale.y) * 0.08; sl.scale.z += ((0.35 + 0.65 * sailLevel) - sl.scale.z) * 0.08; });
}

const _flagMats = new Map();
export function flagMats(map) {
  if (!_flagMats.has(map)) _flagMats.set(map, [toon(0xffffff, map, { side: THREE.FrontSide }), toon(0xffffff, mirror(map), { side: THREE.BackSide })]);
  return _flagMats.get(map);
}
// free a removed ship's GPU geometry (materials/textures are shared per scheme and kept)
export function disposeShip(ship) { ship.traverse(o => { if (o.geometry && !o.userData.sharedGeo) o.geometry.dispose(); }); }
