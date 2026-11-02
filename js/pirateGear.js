// [Timothy] PUMPFUN PIRATES island-shop GEAR on Raul's v4 pirates (hats, clothes, eyewear, parrots, hooks; ids = js/shopCatalog.js).
//
//   import { applyGear, setLocalGear, getLocalGear } from './pirateGear.js';
//   applyGear(target, { hat, outfit, eyes, parrot, hook, hatColor }, { skin });   // target: a pirateFigure() group, a loadPirate()
//                                                    // result or a PirateGLB; skin = ship skin id the clothes take their colours from
//   setLocalGear(gear);   // after shop_equip / a hat colour pick: saves to pfp_captain_v1 + re-dresses YOUR on-foot pirate and YOUR
//                         // captain at the wheel (window "pfp-gear-local" event). setLocalSkin(id): your ship skin changed (main.js).
//   openGearColorPicker() (js/gearColorPicker.js): the hat colour swatches.   window.PFP_GEAR = the same API for the console.
//
// How it draws (one extra draw call per dressed pirate, none when undressed):
//  - every equipped piece is merged into ONE SkinnedMesh bound to the pirate's own skeleton + bind matrix, so it moves with every clip.
//  - clothes (tank / tshirt / coat) are grown from the body's own skinned torso + arm skin (offset along the normal, same bone
//    weights), so they fit male + female and the High + Low LODs exactly. No equipped clothing = shirtless (Raul's base).
//  - hats, eyewear, the parrot and the hook are small Blender meshes (tools/blender/build_gear.py -> assets/pirates/gear_{hi,lo}.glb,
//    meshopt), each skinned rigidly to its bone. The hook folds the right hand away (a per-pirate copy of the body geometry).
//  - the baked ship crew (js/crewV4.js) is NOT dressed: it stays ONE draw call per ship in the default outfit.
// Visual only: no stats, hitboxes, gold or server code. Unknown / unowned ids just draw nothing (the shop validates ownership).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TINTS } from './pirateGLB.js';
import { equip as raulEquip, unequip as raulUnequip, equipped as raulEquipped } from './pirateItems.js'; // [Raul] his item models (not edited)

export const GEAR_DEFAULTS = Object.freeze({ hat: 'none', outfit: 'shirtless', eyes: 'plain', parrot: 'none', hook: 'none', leg: 'none' });
// catalog ids that actually show on the pirate (everything else in a slot draws nothing). APPEND-ONLY: the wire code is the index.
export const GEAR_RENDERS = Object.freeze({
  hat: ['bandana', 'tricorn', 'bicorne', 'crown'], outfit: ['tank', 'tshirt', 'coat', 'shirt', 'suit'], eyes: ['eyepatch', 'sunglasses', 'laser'],
  parrot: ['parrot_green', 'parrot_red', 'parrot_gold', 'parrot_blue', 'parrot_cockatoo', 'parrot_black', 'parrot_diamond'], hook: ['hook_iron', 'hook_gold'],
  leg: ['peg'],   // one PEG LEG item; the side is gear.legSide
});
export const gearRenders = (slot, id) => !!GEAR_RENDERS[slot]?.includes(id);
const GEAR_URL = { hi: 'assets/pirates/gear_hi.glb', lo: 'assets/pirates/gear_lo.glb' };

// HAT COLOUR (BANKSY: "they can pick their ... hat color"): free, one of these swatches; 0 = the hat's own default
// (tricorn band NFT red, bicorne trim gold, bandana red). It colours the bandana cloth, the tricorn band and the bicorne trim.
// APPEND-ONLY (the index goes over the network).
export const HAT_SWATCHES = Object.freeze([
  ['RED', '#c8302c'], ['GOLD', '#e9b949'], ['NAVY', '#1b2f6b'], ['BLUE', '#2a6df4'], ['GREEN', '#2fbf5a'], ['TEAL', '#2ec4a0'],
  ['PURPLE', '#7a3fb0'], ['PINK', '#ff5fa2'], ['ORANGE', '#ff7a1a'], ['WHITE', '#f4f1e8'], ['BLACK', '#1c1c20'], ['BROWN', '#8a5a32'],
]);
const HAT_DEFAULT = { bandana: '#c8302c', tricorn: '#18181b', bicorne: '#e9b949', crown: '#8e1b2a' };   // tricorn = Raul's black felt, crown = his velvet
export const hatColorHex = (hat, i) => (i > 0 && HAT_SWATCHES[i - 1] ? HAT_SWATCHES[i - 1][1] : HAT_DEFAULT[hat] || '#c8302c');

// SKIN + HAIR COLOUR (BANKSY: "skin color and hair color choice"): free picks from these curated lists, 0 = Raul's baked default.
// APPEND-ONLY (the index goes over the network). Natural tones first.
export const SKIN_SWATCHES = Object.freeze([
  ['PORCELAIN', '#f5d6b8'], ['FAIR', '#f2c9a0'], ['LIGHT', '#e8b48a'], ['WARM', '#d99b6c'], ['OLIVE', '#c68a5e'], ['TAN', '#b07848'],
  ['BROWN', '#9a6440'], ['DARK', '#6e4528'], ['DEEP', '#4e2f1c'], ['GHOST', '#cfe6e0'], ['ZOMBIE', '#8fb07a'], ['DEEP SEA', '#7fa8c9'],
]);
export const HAIR_SWATCHES = Object.freeze([
  ['BLACK', '#161616'], ['DARK BROWN', '#2b1b12'], ['BROWN', '#4a2c17'], ['CHESTNUT', '#7a4a22'], ['GINGER', '#b5401f'], ['BLOND', '#d9b25a'],
  ['PLATINUM', '#ece0bc'], ['GREY', '#8a8a8a'], ['WHITE', '#f2f0ea'], ['BLUE', '#2a6df4'], ['PINK', '#e05aa8'], ['GREEN', '#2f9e4f'], ['PURPLE', '#7b3fbf'],
]);
// CLOTHES COLOUR (BANKSY: "can change clothes colors"): free; 0 = MATCH SHIP SKIN (the default, as before), 1..12 = these. APPEND-ONLY.
export const CLOTH_SWATCHES = Object.freeze([
  ['RED', '#c8302c'], ['CRIMSON', '#8e1b2a'], ['NAVY', '#1b2f6b'], ['BLUE', '#2a6df4'], ['GREEN', '#2f9e4f'], ['TEAL', '#2ec4a0'],
  ['PURPLE', '#7a3fb0'], ['PINK', '#ff5fa2'], ['ORANGE', '#ff7a1a'], ['GOLD', '#e9b949'], ['WHITE', '#f4f1e8'], ['BLACK', '#1c1c20'],
]);
// the free, per-player look that rides with the gear (not sold, not in the server profile): hat colour, hook / peg side, skin, hair
export const LOOK_KEYS = ['hatColor', 'hookSide', 'legSide', 'skinColor', 'hairColor', 'outfitColor', 'body']; // [v112] body: 0 = male (default, every old save), 1 = female
// the clothes colours for this gear: the ship skin's (colors.skin) unless the player picked a clothes colour (trim stays the skin's)
export const clothColors = (gear, colors) => (gear?.outfitColor > 0 && CLOTH_SWATCHES[gear.outfitColor - 1] ? { ...(colors || {}), cloth: CLOTH_SWATCHES[gear.outfitColor - 1][1] } : colors);
const pickLook = (g) => Object.fromEntries(LOOK_KEYS.map((k) => [k, g[k]]));

// CLOTHES follow YOUR SHIP SKIN (BANKSY: "Make sure the color changes between ship skin you have"): the same identity colours
// the deck crew wears per skin (mirrors js/crew.js OUTFIT: [coat, dark, light] + accent). DEFAULT ('classic') = the NFT look.
const SKIN_CLOTH = {
  parchment: ['#c9a25a', '#e8d3a2', '#ffcd77'], blood: ['#9e0c0c', '#d21a1a', '#fa0d0d'], midnight: ['#1a1d22', '#8a96a4', '#b8c2cc'],
  navy: ['#1b2f6b', '#efe6cf', '#ffcd77'], degen: ['#1f6b37', '#4ee37a', '#4ee37a'], ghost: ['#bfe3d2', '#eef8f2', '#7dffa8'],
  golden: ['#ffc94a', '#ffe6a8', '#fff1b8'], seagreen: ['#2ec4a0', '#9ff0d8', '#5cf2c4'], kraken: ['#5a2a8a', '#3fb59a', '#3fb59a'],
  storm: ['#5a6470', '#e8eef5', '#8fd4ff'], coral: ['#ff7a5c', '#ffc2a8', '#ffd2a0'], admiral: ['#14234f', '#ffffff', '#ffcd77'],
  flaming: ['#ff5a14', '#ffb03a', '#ffd23a'], diamond: ['#bfe8ff', '#eefaff', '#ffffff'], commodore: ['#14234f', '#efe6cf', '#ffcd77'],
};
export const knownGearSkin = (id) => id === 'classic' || !!SKIN_CLOTH[id];
// colors: { skin } (ship skin id) and / or explicit { cloth, trim } overrides
export function outfitColors(outfit, colors = {}) {
  // tank = all cloth, t-shirt = cream with cloth stripes, coat = cloth + trim edging over a cream shirt with navy (DEFAULT) / cloth stripes
  const k = SKIN_CLOTH[colors?.skin], d = { tank: '#f1ede2', tshirt: '#222c4e', coat: '#c8302c', shirt: '#f4efe3', suit: '#b3201f' }[outfit] || '#f1ede2';
  const cloth = colors?.cloth || (k ? (outfit === 'shirt' ? k[1] : k[0]) : d), trim = colors?.trim || (k ? k[2] : outfit === 'suit' ? '#1d2a52' : '#e9b949');   // shirt = the skin's light colour
  return { cloth, trim, stripe: outfit === 'coat' && !k && !colors?.cloth ? '#222c4e' : cloth };
}

// accessory meshes in the GLB: [mesh name(s), bone, palette (tint key 1..4 -> colour; null = baked colours), extra]
// parrots: one model, fixed colours per catalog item (1 body, 2 wing, 3 tail / crest, 4 cheeks; beak / feet baked)
const PARROTS = {
  parrot_green: { 1: '#3fd16a', 2: '#2a6df4', 3: '#1f8f45' },
  parrot_red: { 1: '#e8231d', 2: '#2a6df4', 3: '#ffcd3a' },
  parrot_gold: { 1: '#ffc21f', 2: '#e8961a', 3: '#fff0a0', 4: '#ffe27a' },
  parrot_blue: { 1: '#1e74e8', 2: '#0f3fa0', 3: '#ffd23a', 4: '#ffd23a' },                       // blue + yellow macaw
  parrot_cockatoo: { 1: '#f6f4ee', 2: '#e6e2d6', 3: '#ffd23a', crest: true },                   // white, tall yellow crest
  parrot_black: { 1: '#1a1a1e', 2: '#26262c', 3: '#101012', 4: '#e8231d' },                     // black, red cheeks
  parrot_diamond: { 1: '#bfe8ff', 2: '#eefaff', 3: '#8fd0f2', 4: '#ffffff', facets: true },     // crystal facets + glints
};
const PIECES = {
  'hat:bandana': [['hat_bandana'], 'head', (g) => ({ 1: hatColorHex('bandana', g.hatColor) })],
  'hat:bicorne': [['hat_bicorne'], 'head', (g) => ({ 1: hatColorHex('bicorne', g.hatColor) })],
  'eyes:eyepatch': [['eyes_eyepatch'], 'head', null], 'eyes:sunglasses': [['eyes_sunglasses'], 'head', null], 'eyes:laser': [['eyes_laser'], 'head', null],
};
for (const [id, pal] of Object.entries(PARROTS)) PIECES['parrot:' + id] = [pal.crest ? ['parrot_parrot', 'parrot_crest'] : ['parrot_parrot'], 'spine', () => pal, pal];
// ONE gear system: these catalog ids draw with RAUL's models (js/pirateItems.js equip / unequip, his hide rules: hair under the hat,
// the hand under the hook, the boot under the peg, skin under the shirt / coat). Each = +1 draw call. Picked where his model looks
// better in game (tricorn, hooks) or is his alone (crown, pegs, pirate shirt, captain's coat). Everything else is merged into
// Timothy's single gear mesh. [Raul slot, item id, colours(gear, colors)]
const RAUL = {
  'hat:tricorn':   ['head', 'hat_tricorn', (g) => ({ hat: hatColorHex('tricorn', g.hatColor) })],
  'hat:crown':     ['head', 'crown', (g, c, p) => ({ accent: hairHexOf(p, g) })],   // [v109b] BANKSY: the crown's velvet = the wearer's hair colour (gold rim + gems untouched)
  // hooks + peg: the side the player picked (gear.hookSide / legSide 'L' | 'R') = Raul's left or right model on that arm / leg
  'hook:hook_iron': [(g) => 'hand' + g.hookSide, (g) => 'hook_' + g.hookSide.toLowerCase(), null], 'hook:hook_gold': [(g) => 'hand' + g.hookSide, (g) => 'hook_' + g.hookSide.toLowerCase(), null, { gold: true }],
  'leg:peg':       [(g) => 'leg' + g.legSide, (g) => 'peg_' + g.legSide.toLowerCase(), null],
  'outfit:shirt':  ['outfit', 'shirt', (g, c) => ({ shirt: outfitColors('shirt', c).cloth })],
  'outfit:suit':   ['outfit', 'suit', (g, c) => { const o = outfitColors('suit', c); return { coat: o.cloth, accent: o.trim }; }],
};
const RAUL_SLOTS = ['head', 'handL', 'handR', 'legL', 'legR', 'outfit'];
const rv = (v, g) => (typeof v === 'function' ? v(g) : v);
// clothes: which body skin they cover (bind pose, three space: y up, +z front; belt top y 0.49, wrist |x| 0.555)
const OUTFITS = {
  tank:   { arms: 0, off: 0.010, hole: true },
  tshirt: { arms: 0.33, off: 0.011, stripes: true },
  coat:   { arms: 0.545, off: 0.016, trim: true, tails: true },
};

const clampIx = (v, n) => { const i = Math.floor(+v); return Number.isFinite(i) && i >= 0 && i <= n ? i : 0; };
export function normalizeGear(g) {
  const s = (g && typeof g === 'object') ? g : {}, o = { ...GEAR_DEFAULTS, hatColor: 0, hookSide: 'R', legSide: 'R', skinColor: 0, hairColor: 0, outfitColor: 0, body: 0 };
  for (const k of Object.keys(GEAR_DEFAULTS)) if (typeof s[k] === 'string' && s[k]) o[k] = s[k];
  if (s.eyes == null && typeof s.face === 'string' && s.face !== 'plain') o.eyes = s.face;     // creator 'face' = shop 'eyes'
  if (s.eyepatch === true) o.eyes = 'eyepatch';
  if (o.parrot === 'parrot') o.parrot = 'parrot_green'; if (o.hook === 'hook') o.hook = 'hook_iron';
  if (o.leg === 'peg_l' || o.leg === 'peg_r') { if (s.legSide == null) o.legSide = o.leg === 'peg_l' ? 'L' : 'R'; o.leg = 'peg'; }
  o.hatColor = clampIx(s.hatColor, HAT_SWATCHES.length);
  if (s.hookSide === 'L' || s.hookSide === 'R') o.hookSide = s.hookSide; if (s.legSide === 'L' || s.legSide === 'R') o.legSide = s.legSide;   // old saves: R
  o.skinColor = clampIx(s.skinColor, SKIN_SWATCHES.length); o.hairColor = clampIx(s.hairColor, HAIR_SWATCHES.length); o.outfitColor = clampIx(s.outfitColor, CLOTH_SWATCHES.length);
  o.body = s.body === 1 || s.body === '1' || s.body === 'f' || s.body === true ? 1 : 0;
  return o;
}
const gearKey = (g) => Object.keys(GEAR_DEFAULTS).map((k) => g[k]).join('|') + '|' + LOOK_KEYS.map((k) => g[k] ?? '').join('|');
export const isDefaultGear = (g) => Object.keys(GEAR_DEFAULTS).every((k) => !gearRenders(k, g?.[k])) && !(g?.skinColor > 0) && !(g?.hairColor > 0) && !(g?.body > 0);

// ---------- network: the equipped gear as ONE short string ('gr' in the PvP / harbor state, js/transport.js STATIC) ----------
// Base-36 digits: one per slot in WIRE_SLOTS order = 1 + the index in GEAR_RENDERS[slot] (0 = default), then the hat colour
// (0 = default, 1..12 = HAT_SWATCHES), then the sides (bit 1 = hook on the LEFT, bit 2 = peg on the LEFT; 0 = both right),
// then the skin colour (0..12 = SKIN_SWATCHES), the hair colour (0..13 = HAIR_SWATCHES) and the clothes colour (0 = ship skin, 1..12 = CLOTH_SWATCHES). Trailing zeros dropped: shirtless
// = '', tricorn only = '2', tricorn + coat + eye patch + red macaw + gold hook = '23122', + peg on the left, hook left, tan skin,
// ginger hair = '2312210365'. GEAR_RENDERS and the swatch lists are APPEND-ONLY. Receivers decode against them: anything
// else (unknown digit, wrong type, too long) is the default for that field, so free-form data never reaches applyGear. A
// missing field = shirtless/default. The clothes colour comes from the ship skin ('sk', already sent).
export const WIRE_SLOTS = ['hat', 'outfit', 'eyes', 'parrot', 'hook', 'leg'];
const WIRE_LEN = WIRE_SLOTS.length + 5;
export function gearToWire(gear) {
  const g = normalizeGear(gear), sides = (g.hookSide === 'L' ? 1 : 0) + (g.legSide === 'L' ? 2 : 0) + (g.body ? 4 : 0); // [v112] bit 4 = female body (same digit: no longer string, old clients just see a male)
  return (WIRE_SLOTS.map((k) => (GEAR_RENDERS[k].indexOf(g[k]) + 1).toString(36)).join('') + [g.hatColor, sides, g.skinColor, g.hairColor, g.outfitColor].map((n) => n.toString(36)).join('')).replace(/0+$/, '');
}
export function gearFromWire(w) {
  const g = normalizeGear(null);
  if (typeof w !== 'string' || w.length > WIRE_LEN || !/^[0-9a-z]*$/.test(w)) return g;
  const d = (i) => (i < w.length ? parseInt(w[i], 36) : 0), n = WIRE_SLOTS.length;
  WIRE_SLOTS.forEach((k, i) => { const v = d(i); if (v > 0 && v <= GEAR_RENDERS[k].length) g[k] = GEAR_RENDERS[k][v - 1]; });
  g.hatColor = clampIx(d(n), HAT_SWATCHES.length); const sd = d(n + 1) <= 7 ? d(n + 1) : 0; g.hookSide = sd & 1 ? 'L' : 'R'; g.legSide = sd & 2 ? 'L' : 'R'; g.body = sd & 4 ? 1 : 0;
  g.skinColor = clampIx(d(n + 2), SKIN_SWATCHES.length); g.hairColor = clampIx(d(n + 3), HAIR_SWATCHES.length); g.outfitColor = clampIx(d(n + 4), CLOTH_SWATCHES.length);
  return g;
}
// clean wire string (re-encoded from the decoded gear) or '' : what the receivers store / compare
export const cleanWire = (w) => gearToWire(gearFromWire(w));

// ---------- local save: the creator's pfp_captain_v1 (hat / outfit / face / parrot / hook + hatColor). gearV marks a shop-written
// save, so an old creator save (its defaults were tricorn + eyepatch + coat) never dresses a new pirate for free: shirtless. ----------
const KEY = 'pfp_captain_v1';
function readSave() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
let _mem = null, _skin = 'classic';
export function getLocalGear() {
  const c = _mem || (_mem = readSave());
  if (!c || !c.gearV) return normalizeGear(c ? pickLook(c) : null);   // the look (skin / hair / sides) is kept even before any gear
  return normalizeGear({ hat: c.hat, outfit: c.outfit, eyes: c.eyes ?? c.face, parrot: c.parrot, hook: c.hook, leg: c.leg, ...pickLook(c) });
}
export const getLocalColors = () => ({ skin: _skin });
const LOCAL = new Set();   // your own pirates (on-foot + captain at the wheel), re-dressed by setLocalGear / setLocalSkin
export function markLocal(target) { const r = rootOf(target); if (r) LOCAL.add(r); return target; }
function redressLocal() {
  const g = getLocalGear(), c = getLocalColors();
  for (const r of LOCAL) { let o = r; while (o.parent) o = o.parent; if (!o.isScene) { LOCAL.delete(r); continue; } applyGear(r, g, c); }   // gone = dropped
  return g;
}
// after shop_equip / a hat colour pick: { hat, outfit, eyes, parrot, hook, hatColor } (missing keys keep what you wear)
export function setLocalGear(gear) {
  const g = normalizeGear({ ...getLocalGear(), ...(gear || {}) }), c = { ...(readSave() || { v: 1 }) };
  c.v = 1; c.gearV = 1; c.hat = g.hat; c.outfit = g.outfit; c.eyes = g.eyes; c.face = g.eyes === 'plain' ? 'plain' : g.eyes; c.parrot = g.parrot; c.hook = g.hook; c.leg = g.leg; Object.assign(c, pickLook(g));
  _mem = c; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* memory only */ }
  redressLocal();
  try { window.dispatchEvent(new CustomEvent('pfp-gear-local', { detail: g })); window.dispatchEvent(new CustomEvent('pfp-gear', { detail: g })); } catch {}   // 'pfp-gear' = v106 crew / followers re-bake
  return g;
}
// [v103] the island shop's equipped gear lives in your BR profile (js/pvp.js gearChanged -> 'pfp-gear' { gear }, server-validated):
// it wins over this device's save for the five slots; hatColor (free, not sold) stays on this device.
function fromProfile(gear) {
  if (!gear || typeof gear !== 'object') return;
  const cur = getLocalGear(), g = normalizeGear({ ...gear, ...pickLook(cur) });   // the free look stays on this device
  if (gearKey(g) === gearKey(cur) && (_mem?.gearV)) return;
  setLocalGear(g);
}
if (typeof window !== 'undefined') {
  addEventListener('pfp-gear', (e) => { try { fromProfile(e.detail?.gear); } catch (err) { console.warn('[gear]', err); } });
  // the v102 hook (js/pirates.js / js/dock/index.js call it for YOUR pirates): your gear + hat colour + ship skin colours
  window.applyPirateGear = (obj, gear) => { applyGear(obj, { ...normalizeGear(gear), ...pickLook(getLocalGear()) }, getLocalColors()); markLocal(obj); return true; };
}
// your ship skin changed (main.js calls this; cheap no-op when unchanged): your clothes take its colours at once
export function setLocalSkin(id) { const k = knownGearSkin(id) ? id : 'classic'; if (k === _skin) return; _skin = k; redressLocal(); }

// ---------- loading ----------
let _loader = null; const _libs = {};
function loadLib(lod) {
  if (_libs[lod]) return _libs[lod];
  _loader ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return (_libs[lod] = _loader.loadAsync(new URL(GEAR_URL[lod], document.baseURI).href).then((gltf) => {
    const out = {}; gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
      const P = g.attributes.position, N = g.attributes.normal, C = g.attributes.color, n = P.count;
      const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3), key = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        pos.set([P.getX(i), P.getY(i), P.getZ(i)], i * 3); nrm.set([N.getX(i), N.getY(i), N.getZ(i)], i * 3);
        col.set(C ? [C.getX(i), C.getY(i), C.getZ(i)] : [1, 1, 1], i * 3);
        const r = C ? C.getX(i) : 0, g = C ? C.getY(i) : 0, b = C ? C.getZ(i) : 0;   // marker colours: magenta 1, cyan 2, yellow 3, blue 4
        key[i] = r > 0.9 && g < 0.1 && b > 0.9 ? 1 : r < 0.1 && g > 0.9 && b > 0.9 ? 2 : r > 0.9 && g > 0.9 && b < 0.1 ? 3 : r < 0.1 && g < 0.1 && b > 0.9 ? 4 : 0;
      }
      let nm = o.name, a = o; while (!/^(hat|eyes|parrot|hook)_/.test(nm) && a.parent) { a = a.parent; nm = a.name; }   // gltfpack: the named node is the parent
      out[nm.replace(/\.\d+$/, '')] = { pos, nrm, col, key, n };
    });
    return out;
  }).catch((e) => { delete _libs[lod]; throw e; })); // [v112] a failed load (network hiccup) is retried next time, not cached forever
}

// ---------- shared bits ----------
const bn = (s) => (s || '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const _tex = {};
function stripeTex(hex) {   // 2 x 2: u < .5 = sailor stripes (white / the shirt colour) along uv.y, u > .5 = plain white (vertex colour only)
  if (_tex[hex]) return _tex[hex];
  const h = new THREE.Color(hex).getHex(), r = (h >> 16) & 255, g = (h >> 8) & 255, b = h & 255;   // sRGB bytes
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, r, g, b, 255, 255, 255, 255, 255]), 2, 2);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return (_tex[hex] = t);
}
let _grad = null;
function gradient() {
  if (_grad) return _grad;
  _grad = new THREE.DataTexture(new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]), 4, 1);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter; _grad.needsUpdate = true; return _grad;
}
const _mats = {};
function gearMat(low, stripe = '#222c4e') {   // High: toon like Raul's body; Low: unlit (light baked into the vertex colours like Raul's Low atlas). One per stripe colour (<= 1 per skin)
  return (_mats[(low ? 'lo' : 'hi') + stripe] ||= low
    ? new THREE.MeshBasicMaterial({ name: 'pirate_gear_lo', vertexColors: true, map: stripeTex(stripe) })
    : new THREE.MeshToonMaterial({ name: 'pirate_gear', vertexColors: true, map: stripeTex(stripe), gradientMap: gradient() }));
}
const LDIR = new THREE.Vector3(0.35, 0.8, 0.5).normalize();
const shade = (nx, ny, nz) => 0.58 + 0.42 * Math.max(0, nx * LDIR.x + ny * LDIR.y + nz * LDIR.z) + 0.08 * Math.max(0, ny);

// find the PirateGLB inside whatever the caller has
function rootOf(t) { return t?.isObject3D ? t : t?.object?.isObject3D ? t.object : t?.root?.isObject3D ? t.root : null; }
function pirateOf(t) {
  if (!t) return null;
  if (t.mixer && t.scene) return t;                               // PirateGLB
  const r = rootOf(t); if (!r) return null;
  if (r.userData.v4) return r.userData.v4;                        // pirateFigure group
  let p = null; r.traverse((o) => { if (!p && o.userData?.v4) p = o.userData.v4; }); return p;   // loadPirate() root / captain figure
}
function bodyOf(p) {
  let body = null; p.scene.traverse((o) => { if (!body && o.isSkinnedMesh && o.geometry.attributes._tint) body = o; }); return body;
}

// ---------- clothes shell from the body's skin (cached per body geometry + outfit + colours) ----------
const _shells = new Map(), _attrIds = new WeakMap(); let _attrN = 0;
const attrId = (a) => { let i = _attrIds.get(a); if (!i) _attrIds.set(a, (i = ++_attrN)); return i; };
function shellOf(body, id, colors, low) {
  const spec = OUTFITS[id]; if (!spec) return null;
  const ck = attrId(body.geometry.attributes.position) + '|' + id + '|' + JSON.stringify(colors || {}); if (_shells.has(ck)) return _shells.get(ck);   // per shared body (pirates own their geometry wrapper now)
  const g = body.geometry, P = g.attributes.position, N = g.attributes.normal, T = g.attributes._tint, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
  const bones = body.skeleton.bones.map((b) => bn(b.name)), iS = TINTS.indexOf('skin'), iSh = TINTS.indexOf('shirt');
  const oc = outfitColors(id, colors), cloth = new THREE.Color(oc.cloth), trim = spec.trim ? new THREE.Color(oc.trim) : null, white = new THREE.Color('#f4f1e8');
  const bone = (i) => { let b = 0, w = -1; for (let k = 0; k < 4; k++) { const x = W.getComponent(i, k); if (x > w) { w = x; b = J.getComponent(i, k); } } return bones[b] || ''; };
  const n = P.count, keep = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const t = Math.round(T.getX(i)); if (t !== iS && t !== iSh) continue;
    const b = bone(i), x = Math.abs(P.getX(i)), y = P.getY(i), z = P.getZ(i);
    if (b === 'spine') {
      if (y < 0.44) continue;   // a little under the belt top (0.49) so Low's coarse waist has no skin gap; the belt + pants hide it
      if (spec.hole && ((x > 0.13 && y > 0.80) || (z > 0 && x < 0.085 && y > 0.86))) continue;   // tank: arm holes + scoop neck
      keep[i] = 1;
    } else if ((b === 'upperarml' || b === 'upperarmr') && spec.arms && x < spec.arms) keep[i] = 1;
    else if ((b === 'forearml' || b === 'forearmr') && spec.arms > 0.4 && x < spec.arms) keep[i] = 1;
  }
  const bi = g.userData.baseIndex || g.index, idx = bi ? bi.array : null, tri = idx ? idx.length / 3 : n / 3, remap = new Int32Array(n).fill(-1), list = [], out = [];
  for (let f = 0; f < tri; f++) {
    const a = idx ? idx[f * 3] : f * 3, b = idx ? idx[f * 3 + 1] : f * 3 + 1, c = idx ? idx[f * 3 + 2] : f * 3 + 2;
    if (keep[a] + keep[b] + keep[c] < (low ? 2 : 3)) continue;   // Low's torso is coarse: 2 of 3 corners is enough there (no torn edges)
    for (const v of [a, b, c]) { if (remap[v] < 0) { remap[v] = list.length; list.push(v); } out.push(remap[v]); }
  }
  const m = list.length, pos = new Float32Array(m * 3), nrm = new Float32Array(m * 3), col = new Float32Array(m * 3), uv = new Float32Array(m * 2),
    si = new Uint16Array(m * 4), sw = new Float32Array(m * 4), c = new THREE.Color();
  list.forEach((v, i) => {
    const nx = N.getX(v), ny = N.getY(v), nz = N.getZ(v), x = P.getX(v), y = P.getY(v), z = P.getZ(v), ax = Math.abs(x);
    pos.set([x + nx * spec.off, y + ny * spec.off, z + nz * spec.off], i * 3); nrm.set([nx, ny, nz], i * 3);
    for (let k = 0; k < 4; k++) { si[i * 4 + k] = J.getComponent(v, k); sw[i * 4 + k] = W.getComponent(v, k); }
    let striped = !!spec.stripes; c.copy(striped ? white : cloth);
    if (spec.trim) {   // red coat: open front over a striped shirt, gold edging + cuffs (NFT redcoat)
      if (z > 0.02 && ax < 0.062 && y > 0.5) { c.copy(white); striped = true; }
      else if (z > 0.02 && ax < 0.085 && y > 0.5) c.copy(trim);
      else if (ax > spec.arms - 0.05) c.copy(trim);
    }
    if (low) c.multiplyScalar(shade(nx, ny, nz));
    col.set([c.r, c.g, c.b], i * 3); uv.set([striped ? 0.25 : 0.75, y * 15], i * 2);
  });
  const parts = { pos, nrm, col, uv, si, sw, index: out, stripe: oc.stripe };
  if (spec.tails) Object.assign(parts, { tails: tailsOf(bones, cloth, trim, low) });
  _shells.set(ck, parts); return parts;
}
// coat tails: an open-front skirt from the belt to mid thigh, on the spine bone (back + sides only)
function tailsOf(bones, cloth, trim, low) {
  const bi = Math.max(0, bones.indexOf('spine')), NT = 18, NY = 4, pos = [], nrm = [], col = [], idx = [], c = new THREE.Color();
  for (let i = 0; i <= NT; i++) {
    const a = -0.22 * Math.PI + (1.44 * Math.PI) * i / NT;   // the front (+z, a = -pi/2) stays open ~100 deg
    for (let j = 0; j <= NY; j++) {
      const t = j / NY, y = 0.47 - 0.21 * t, r = 0.212 + 0.045 * t, x = Math.cos(a) * r, z = -Math.sin(a) * r * 0.92;
      pos.push(x, y, z); nrm.push(Math.cos(a), 0.15, -Math.sin(a));
      c.copy(j === NY ? trim : cloth); if (low) c.multiplyScalar(shade(Math.cos(a), 0.15, -Math.sin(a))); col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NY; j++) {
    const a = i * (NY + 1) + j, b = a + NY + 1; idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const n = pos.length / 3;
  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), col: new Float32Array(col), uv: new Float32Array(n * 2).fill(0.75),
    si: new Uint16Array(n * 4).map((_, k) => (k % 4 ? 0 : bi)), sw: new Float32Array(n * 4).map((_, k) => (k % 4 ? 0 : 1)), index: idx, double: true };
}

// (the hook's hand: Raul's hide rules in js/pirateItems.js hide it now)

// ---------- the merged gear mesh ----------
function buildGearGeometry(p, body, gear, lib, colors) {
  const low = p.lod === 'lo', boneIx = (nm) => Math.max(0, body.skeleton.bones.findIndex((b) => bn(b.name) === bn(nm)));
  const chunks = [];
  if (gear.outfit !== 'shirtless') { const s = shellOf(body, gear.outfit, colors, low); if (s) { chunks.push(s); if (s.tails) chunks.push(s.tails); } }
  // accessories: GLB (scene space) -> body space
  p.scene.updateMatrixWorld(true);
  const toBody = new THREE.Matrix4().copy(body.matrixWorld).invert().multiply(p.scene.matrixWorld), nm3 = new THREE.Matrix3().getNormalMatrix(toBody), v = new THREE.Vector3(), c = new THREE.Color();
  for (const slot of ['hat', 'eyes', 'parrot', 'hook']) {
    const pc = PIECES[`${slot}:${gear[slot]}`]; if (!pc) continue;
    for (const mesh of pc[0]) {
    const src = lib?.[mesh]; if (!src) continue;
    const pal = pc[2] ? pc[2](gear) : null, fx = pc[3] || {}, bi = boneIx(pc[1]), n = src.n;
    const pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      v.fromArray(src.pos, i * 3).applyMatrix4(toBody).toArray(pos, i * 3); v.fromArray(src.nrm, i * 3).applyMatrix3(nm3).normalize().toArray(nrm, i * 3);
      const k = src.key[i]; if (k && pal?.[k]) c.set(pal[k]); else if (k === 4) c.set(pal?.[1] || '#c8302c'); else if (k) c.set('#c8302c'); else c.fromArray(src.col, i * 3);
      if (fx.facets && k) {   // DIAMOND: every triangle its own crystal facet, a few flash white (glints)
        const f = Math.floor(i / 3), hsh = Math.abs(Math.sin(f * 12.9898 + 78.233) * 43758.5453) % 1;
        if (hsh > 0.9) c.setRGB(1, 1, 1); else c.multiplyScalar(0.72 + 0.5 * hsh);
      }
      if (low) c.multiplyScalar(shade(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]));
      c.toArray(col, i * 3);
    }
    chunks.push({ pos, nrm, col, uv: new Float32Array(n * 2).fill(0.75), si: new Uint16Array(n * 4).map((_, k) => (k % 4 ? 0 : bi)),
      sw: new Float32Array(n * 4).map((_, k) => (k % 4 ? 0 : 1)), index: null });
    }
  }
  if (!chunks.length) return null;
  const stripe = chunks.find((ch) => ch.stripe)?.stripe;
  let nv = 0, ni = 0; for (const ch of chunks) { const n = ch.pos.length / 3; nv += n; ni += ch.index ? ch.index.length * (ch.double ? 2 : 1) : n; }
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), C = new Float32Array(nv * 3), U = new Float32Array(nv * 2), SI = new Uint16Array(nv * 4), SW = new Float32Array(nv * 4), I = new Uint32Array(ni);
  let ov = 0, oi = 0;
  for (const ch of chunks) {
    const n = ch.pos.length / 3; P.set(ch.pos, ov * 3); N.set(ch.nrm, ov * 3); C.set(ch.col, ov * 3); U.set(ch.uv, ov * 2); SI.set(ch.si, ov * 4); SW.set(ch.sw, ov * 4);
    if (ch.index) { for (const x of ch.index) I[oi++] = x + ov; if (ch.double) for (let k = 0; k < ch.index.length; k += 3) { I[oi++] = ch.index[k] + ov; I[oi++] = ch.index[k + 2] + ov; I[oi++] = ch.index[k + 1] + ov; } }
    else for (let k = 0; k < n; k++) I[oi++] = ov + k;
    ov += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(SW, 4));
  g.setIndex(new THREE.BufferAttribute(I, 1)); g.userData.stripe = stripe; return g;
}

// Raul's items for this gear: equip what changed, unequip what is gone (his equip is async; a newer dress wins)
function goldHook(obj) {   // the gold hook = Raul's hook with its steel turned gold (his GLB has fixed colours, so recolour a copy)
  obj.traverse((o) => { if (!o.isMesh || o.userData.gold) return; const c = o.geometry.attributes.color; if (!c) return;
    const g = o.geometry.clone(), cc = c.clone(), gold = new THREE.Color('#e3a21c');
    for (let i = 0; i < cc.count; i++) { const r = cc.getX(i), gg = cc.getY(i), b = cc.getZ(i), mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      if (mx > 0.25 && mx - mn < 0.12) { const l = Math.min(1.15, (r + gg + b) / 3 / 0.6); cc.setXYZ(i, gold.r * l, gold.g * l, gold.b * l); } }
    g.setAttribute('color', cc); o.geometry = g; o.userData.gold = true; });
}
function syncRaul(p, gear, colors, ticket) {
  p.raulKeys ||= {}; const want = {}, jobs = [];
  for (const slot of Object.keys(GEAR_DEFAULTS)) { const r = RAUL[`${slot}:${gear[slot]}`]; if (r) want[rv(r[0], gear)] = r; }
  for (const rs of RAUL_SLOTS) {
    const r = want[rs], id = r && rv(r[1], gear), cols = r && r[2] ? r[2](gear, colors, p) : null, k = r ? id + JSON.stringify(cols) + (r[3]?.gold ? 'g' : '') : '';
    if ((p.raulKeys[rs] || '') === k) continue; p.raulKeys[rs] = k;
    if (!r) { try { raulUnequip(p, rs); } catch (e) { console.warn('[gear]', e); } continue; }
    jobs.push(raulEquip(p, id, { colors: cols || undefined }).then((obj) => { if (obj && r[3]?.gold) goldHook(obj); })
      .catch((e) => { console.warn('[gear] item failed', id, e); p.raulKeys[rs] = ''; }));
  }
  return Promise.all(jobs);
}
// [v109b] the wearer's hair colour (hex): the picked swatch, else their own hair as painted on the body (crew / remote looks vary)
const _hc = new THREE.Color();
export function hairHexOf(p, g) {
  const hr = g?.hairColor > 0 ? HAIR_SWATCHES[g.hairColor - 1]?.[1] : null; if (hr) return hr;
  for (const m of p?.tinted || []) if (m.userData?.tint === 'hair' && m.color) return '#' + m.color.getHexString();
  for (const o of p?.atlasMeshes || []) { const G = o.geometry, T = G?.attributes?._tint, C = G?.attributes?.color; if (!T || !C) continue;
    for (let i = 0; i < T.count; i++) if (Math.round(T.getX(i)) === iHair) { _hc.setRGB(C.getX(i), C.getY(i), C.getZ(i), THREE.LinearSRGBColorSpace); return '#' + _hc.getHexString(); } }
  return HAIR_SWATCHES[0]?.[1] || '#2a1a10';
}
export const raulItemOf = (slot, id, gear) => { const r = RAUL[`${slot}:${id}`]; return r ? rv(r[1], normalizeGear(gear)) : null; };

// ---------- skin + hair colour: per pirate, WITHOUT PirateGLB.setColors (it writes the shared geometry; Emerly fixes it in her
// own commit). Each body mesh gets its OWN COLOR_0 (the other attributes stay shared, same flags as js/pirateItems.js
// ownGeometry, so Raul's hide rules keep working), rewritten from the baked colours for the 'skin' / 'hair' tint keys only.
// Tinted materials (separate parts) are per pirate already (PirateGLB toonizes per instance). Hook point: setBodyLook(p, look). ----------
const iSkin = TINTS.indexOf('skin'), iHair = TINTS.indexOf('hair');
const _lookBase = new WeakMap(); // mesh -> { geo, base COLOR_0 } for skinColor / hairColor resets
export function setBodyLook(p, { skinColor = 0, hairColor = 0 } = {}) {
  const sk = skinColor > 0 ? SKIN_SWATCHES[skinColor - 1]?.[1] : null, hr = hairColor > 0 ? HAIR_SWATCHES[hairColor - 1]?.[1] : null;
  const key = (sk || '') + '|' + (hr || ''); if ((p.gearLook || '|') === key) return; p.gearLook = key;
  const col = new THREE.Color(), want = { skin: sk, hair: hr };
  for (const m of p.tinted || []) { const t = m.userData.tint; if (t !== 'skin' && t !== 'hair') continue;
    if (!m.userData.gearBase) m.userData.gearBase = m.color.clone(); m.color.copy(want[t] ? col.set(want[t]) : m.userData.gearBase); }
  for (const o of p.atlasMeshes || []) {
    const src = o.geometry, T = src.attributes._tint; if (!T || !src.attributes.color) continue;
    if (_lookBase.get(o)?.geo !== o.geometry) { // first look on this mesh (or a clone that shares geometry): own geometry + own COLOR_0
      {   // as pirateItems.ownGeometry: own geometry (shared attributes, baseIndex for the hide rules), so clones never share the look
        const g = new THREE.BufferGeometry(); for (const k in src.attributes) g.setAttribute(k, src.attributes[k]);
        g.setIndex(src.index); for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
        g.boundingSphere = src.boundingSphere; g.boundingBox = src.boundingBox; g.userData.baseIndex = src.userData.baseIndex || src.index; o.geometry = g; o.userData.ownGeo = true;
      }
      const g = o.geometry, base = g.attributes.color.clone(); g.setAttribute('color', base.clone()); o.userData.gearOwnColor = o.userData.ownColor = true;
      _lookBase.set(o, { geo: g, base }); // a WeakMap, not userData: Object3D.copy JSON-copies userData, and main's ownColorAttr shares geometry.userData
    }
    const g = o.geometry, c = g.attributes.color, b = _lookBase.get(o).base, t = g.attributes._tint;
    for (let i = 0; i < t.count; i++) { const k = Math.round(t.getX(i)), w = k === iSkin ? sk : k === iHair ? hr : undefined;
      if (w === undefined) continue; if (w) { col.set(w); c.setXYZ(i, col.r, col.g, col.b); } else c.setXYZ(i, b.getX(i), b.getY(i), b.getZ(i)); }
    c.needsUpdate = true;
  }
}
function dress(p, gear, colors) {
  const body = bodyOf(p); if (!body) return Promise.resolve(null);
  const key = gearKey(gear) + '|' + JSON.stringify(colors || {});
  if (p.gearKey === key) return Promise.resolve(p.gearMesh || null);
  try { setBodyLook(p, gear); } catch (e) { console.warn('[gear] look', e); }
  p.gearKey = key; const ticket = (p.gearTicket = (p.gearTicket || 0) + 1);
  const needLib = ['hat', 'eyes', 'parrot', 'hook'].some((s) => PIECES[`${s}:${gear[s]}`]);
  if (!needLib && !OUTFITS[gear.outfit]) {   // nothing of Timothy's: just Raul's items (or bare)
    if (p.gearMesh) { p.gearMesh.removeFromParent(); p.gearMesh.geometry.dispose(); p.gearMesh = null; }
    return syncRaul(p, gear, colors, ticket).then(() => null);
  }
  return (needLib ? loadLib(p.lod === 'lo' ? 'lo' : 'hi') : Promise.resolve(null)).then((lib) => {
    if (ticket !== p.gearTicket) return null;
    if (p.gearMesh) { p.gearMesh.removeFromParent(); p.gearMesh.geometry.dispose(); p.gearMesh = null; }
    const rj = syncRaul(p, gear, colors, ticket);
    const geo = buildGearGeometry(p, body, gear, lib, colors); if (!geo) return rj.then(() => null);
    const m = new THREE.SkinnedMesh(geo, gearMat(p.lod === 'lo', geo.userData.stripe)); m.name = 'pirate-gear'; m.userData.isGear = true;
    m.frustumCulled = false; m.castShadow = p.lod !== 'lo';
    body.parent.add(m); m.bind(body.skeleton, body.bindMatrix); p.gearMesh = m; return rj.then(() => m);
  }).catch((e) => { console.warn('[gear] failed, pirate stays as is', e); p.gearKey = null; return null; });
}

// public: dress a pirate. Works before the GLB arrives (applied on ready). gear: { hat, outfit, eyes, parrot, hook, hatColor }.
// colors: { skin } = the ship skin id the clothes follow (classic / unknown = the NFT colours), or explicit { cloth, trim } overrides.
export function applyGear(target, gear, colors = null) {
  const g = normalizeGear(gear), r = rootOf(target), p = pirateOf(target);
  if (r) { r.userData.gear = g; r.userData.gearColors = colors; }
  // [v112] a PLAYER figure (pirateFigure bodyFromGear) wearing the other body: re-build it as male / female, dressed on ready (gear + colours kept)
  let fig = null; if (r) r.traverse((o) => { if (!fig && o.userData?.setBody && o.userData.bodyFromGear) fig = o; });
  if (fig) { fig.userData.gear = g; fig.userData.gearColors = colors; const sw = fig.userData.setBody(g.body === 1); if (sw) return sw.then(() => fig.userData.v4?.gearMesh || null); }
  if (p) return dress(p, g, clothColors(g, colors));
  return Promise.resolve(null);   // pirateFigure() applies r.userData.gear when its GLB is ready
}
// pirateFigure hook: called once the v4 GLB is in
export function gearOnReady(root, p) { const g = root.userData.gear; return g ? dress(p, g, clothColors(g, root.userData.gearColors)) : null; }

window.PFP_GEAR = { applyGear, setBodyLook, SKIN_SWATCHES, HAIR_SWATCHES, CLOTH_SWATCHES, setLocalGear, setLocalSkin, getLocalGear, getLocalColors, outfitColors, HAT_SWATCHES, PARROTS, gearRenders, normalizeGear, gearToWire, gearFromWire, GEAR_RENDERS, GEAR_DEFAULTS };
