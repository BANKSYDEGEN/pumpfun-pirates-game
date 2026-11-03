// [Timothy] PUMPFUN PIRATES island plaza v2 = the HERO AREA (PHASE 1 BLOCKOUT). BANKSY: "Port Royal-style harbor town", main
// look ref brand/requests/plaza_ref/port_royal_hero_banksy.jpg ("Like that"). Behind ?plaza=2: without the flag nothing here
// runs and the v103 plaza + the 7 old berths are untouched. (&pvships=1 adds the ship-footprint boxes for layout review.)
//
// MODULE CONTRACT (so later island areas can attach to it):
//   PLAZA          one config object: frame, bounds, connectors, berths, jetties, storefronts, billboard slots, props
//   plazaGround()  the only terrain edit (dock corner apron), called from js/island/foot.js coastH
//   buildPlazaV2() geometry, into foot.js's merged toon kit (same palette / outlines / surface layers as the island)
//   buildPlazaSigns() + buildBerthPreview()  the only extra meshes (1 draw call each)
//   harborParts()  berths / walkable decks / ship colliders / spawn for js/dock/layout.js (the game's docking + on-foot)
// Everything is in the TOWN-LOCAL frame of js/island/coast.js: lx along the waterfront (west -> east), +lz out to sea,
// quay edge lz = 0, quay top CO.QUAY.y (2.6), boardwalk deck top 2.95. Nothing outside PLAZA.bounds is touched except the
// connectors' seams (listed below), so a redesigned neighbour only has to meet a connector at its x / z / height.
//
// LAYOUT (sea at the bottom of the top-down shot), the ref's street-along-the-harbor:
//   lz -30 .. -42  LAND SIDE: 2-3 storey STONE buildings shoulder to shoulder (masonry, quoins, string courses; timber only
//                  for balconies, shutters, beams, sign brackets, awnings). West: CLOTHES SHOP · PET STORE · TOKEN HALL
//                  ($SUNK $AHOY $PUMP) · SHIP SHOP | MAIN STREET mouth (lx -1..13) | east: UPGRADE SHOP · CREW SHOP ·
//                  TOKEN HALL 2 ($HQ $RETARDIO + TRENDING row upstairs) · TOKEN EXCHANGE (unchanged) · house · tower
//   lz -30 .. -20  MARKET STREET along the harbor: walk-up counters, carved hanging signs on iron brackets, lamps, tavern tables
//   lz -20 .. -14  canvas-awning produce stalls + carts, facing the shops (open at Main Street, so the axis reads to the sea)
//   lz -14 ..   0  quay promenade: STORM HUNT + ARENA boards (unchanged, face the berths), palms, cargo between jetty roots
//   lz   0 ..  56  5 JETTIES x 2 = 10 BERTHS (full-size ships side by side, bows to sea), approach lane lz 66+
import * as THREE from 'three';
import { ON_PORTAL } from '../config.js';
import { SHOPS_KIT, SHOP_PLACES, DOCKS_KIT, DOCK_PLACES } from './plazaShops.js';   // [Timothy] Blender storefront models (loaded before createFoot)
export { buildPlazaShops, plazaShopsReady } from './plazaShops.js';

const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
// PLAZA_V2_DEFAULT = the build's default (flip to true to ship v2 as THE plaza); ?plaza=2 forces it on, ?plaza=1 forces the v103 plaza
export const PLAZA_V2_DEFAULT = true;   // [v146] BANKSY "Push new plaza": the harbor town is THE plaza; ?plaza=1 or ?plaza=0 = the old v103 plaza
export const PLAZA_V2 = (() => { const v = Q ? Q.get('plaza') : null; return v === '2' ? true : v === '1' || v === '0' ? false : PLAZA_V2_DEFAULT; })();
const SHOW_SHIPS = !!Q && Q.get('pvships') === '1';
const Y_QUAY = 2.6, Y_DECK = 2.95;
// the visible street = the top of foot.js's cobbled plaza slab (quay + 0.13); v2 walks ON it (a deck rect over the slab, the terrain
// under it lifted to 4 cm below), so feet stand on the cobbles, not 13 cm into them as on the v103 plaza
export const STREET_Y = Y_QUAY + 0.13, SLAB = { lx0: -54, lx1: 99, lz0: -54, lz1: 0 };

// ---- the full-size ship (measured in the game: upgradeVisuals.compileShip, every upgrade at VIII, pvp, Box3 of the mesh;
// tools/measure_ship.py -> screens/ship_footprint.txt): hull 44.12 x 10.37 m; with yards, bowsprit and stern gallery the
// footprint is 22.56 m wide, from 23.96 m aft to 33.69 m forward of the ship's origin (57.65 m overall).
export const SHIP = { hullLen: 44.12, beam: 10.37, yardW: 22.56, aft: 23.96, fwd: 33.69 };
// ---- berths: ships lie bow-out, side by side, 26 m centre to centre (yards 22.56 + 3.4 m clear); each jetty carries one ship
// on each side (hull 1.8 m off the jetty face, yards 3.4 m apart over the deck). Ship origin at lz 35: stern gallery at lz 11
// (3 m clear of the boardwalk edge), bowsprit at lz 68.7, the approach lane from lz 69 out is open water.
// ---- the WATERFRONT BOARDWALK (BANKSY "make dock the board walk all the way down"): one continuous timber deck over the water
// just outside the seawall (lz 0..8), from the old west boardwalk (lx -176, deck 2.95) to the mole (lx 100). It slopes 0.27 %
// down to street level by lx -55 and runs flat at street level from there; the land behind the sloped part is raised to the
// same heights (plazaGround), so the street meets the boardwalk along its whole length, every jetty roots into it at the same
// height, and walk height = visual height (layout.js gets it as short flat decks, < 1.5 cm off the slope).
export const BOARDWALK = { lx0: -176, lxS: -55, lx1: 100, lz0: 0, lz1: 8, yW: Y_DECK, yE: STREET_Y + 0.02 };
export const bwY = (lx) => { const B = BOARDWALK; return lx <= B.lx0 ? B.yW : lx >= B.lxS ? B.yE : B.yW + (B.yE - B.yW) * (lx - B.lx0) / (B.lxS - B.lx0); };
export const JETTY = { w: 12, lz0: BOARDWALK.lz1, lz1: 59, shipOff: 13, shipLz: 35 };
const JETTY_LX = [-150, -98, -46, 6, 58];                      // lx 6 = on the Main Street axis (arrival looks straight up it)
export const JETTIES = JETTY_LX.map((lx, i) => ({ id: 'J' + (i + 1), lx, y: +bwY(lx).toFixed(3), lz0: JETTY.lz0 }));   // timber, rooted flush in the boardwalk
export const BERTHS = JETTIES.flatMap((j, i) => [-1, 1].map((s, k) => ({ id: 'B' + (i * 2 + k + 1), jetty: j.id, lx: j.lx + s * JETTY.shipOff, lz: JETTY.shipLz, ly: 0,
  ashore: { lx: j.lx + s * (JETTY.w / 2 - 1.4), lz: JETTY.shipLz, y: j.y }, side: s })));
export const APPROACH = { lz0: 69, lx0: Math.min(...BERTHS.map(b => b.lx)) - SHIP.yardW / 2, lx1: Math.max(...BERTHS.map(b => b.lx)) + SHIP.yardW / 2 };
export const keepOldPier = (lx) => lx < APPROACH.lx0 - 30;      // the v103 T-head piers outside the berth fan stay (art only)
export const clearOfJetties = (lx, pad = 0) => JETTIES.every(j => Math.abs(lx - j.lx) > JETTY.w / 2 + pad);
export const clearOfBerths = (lx, lz, pad = 0) => !(lz > 0 && lx > APPROACH.lx0 - pad && lx < APPROACH.lx1 + pad);

// ---- land side ----
export const FACADE_LZ = -30, ROW_D = 12, STALL_LZ = -17;
// storefronts: counter at the facade, interact 3.8 m in front (js/dock/layout.js adds lz + 3.8). vendor = the existing
// js/shopCatalog.js VENDORS id the counter opens today (phase 2 gives each its own vendor); crew has none yet.
export const STOREFRONTS = [
  { id: 'shop_clothes', name: 'CLOTHES SHOP', vendor: 'clothes', lx: -49, w: 10, fl: 3, v: 0, awn: 0xd8322f, label: 'CLOTHES SHOP · HATS, COATS, EYEWEAR' },
  { id: 'shop_pets', name: 'PET STORE', vendor: 'pets', lx: -38.5, w: 9, fl: 2, v: 1, awn: 0x1f8a5a, label: 'PET STORE · PARROTS' },
  { id: 'shop_ships', name: 'SHIP SHOP', vendor: 'ships', lx: -10, w: 12, fl: 3, v: 2, awn: 0x2a6df4, label: 'SHIP SHOP · SHIP SKINS' },
  { id: 'shop_upgrades', name: 'UPGRADE SHOP', vendor: 'ships', open: 'upgrades', lx: 20.5, w: 11, fl: 2, v: 3, awn: 0xffc93c, label: 'UPGRADE SHOP · SHIP UPGRADES' },
  { id: 'shop_crew', name: 'CREW SHOP', vendor: 'crew', lx: 32, w: 10, fl: 3, v: 1, awn: 0x6a4fb3, label: 'CREW SHOP · CREW OUTFITS' },
].map(s => ({ ...s, lz: FACADE_LZ + 0.7 }));
// token halls: stone warehouses whose ground floor carries the walk-up billboards (the v103 billboard art + live MC strip +
// CA / DexScreener panel, just moved: foot.js PLAZA_TOKENS is remapped through TOKEN_SLOTS, so v144's HQ / RETARDIO follow)
export const HALLS = [{ id: 'hall_w', lx: -25, w: 16, fl: 2 }, { id: 'hall_e', lx: 47, w: 18, fl: 2, trending: 5 }];
export const TOKEN_SLOTS = { SUNK: -30.5, AHOY: -25, PUMP: -19.5, HQ: 42.5, RETARDIO: 51.5 };
export const TRENDING = { lx0: 39.5, lx1: 54.5, y: 6.6, n: 5 };   // upstairs row on hall_e: room for the coming trending boards
export const HOUSES = [{ lx: 70, w: 8, fl: 3, v: 2, tavern: true },
  // [Timothy] the gap between the tavern (66-74) and the harbor tower (81.5-90.5): a plain stone house (Blender 'house_e', no shop, no
  // trigger; the WEAPON STORE moved up the hill to Emerly's shops). Footprint box = the storefront rule (w + 0.6 x ROW_D + 0.6).
  { lx: 77.9, w: 7, fl: 3, v: 2, glb: 'house_e' }];
export const STALLS = [-50, -42, -34, -26, -18, 26, 34, 50].map((lx, i) => ({ lx, lz: STALL_LZ, c: [0xf2efe6, 0xd8322f, 0xe9dcc0, 0x2a6df4, 0xf2efe6][i % 5] }));
export const CARTS = [[-30, -22.5], [40, -22]], TAVERN_TABLES = [[64, -24.5], [70, -24.5], [76, -24.5]];
export const PALMS = [[-56, -12], [-24, -9], [-3, -9], [15, -9], [44, -9], [76, -8], [92, -14], [-68, -10]];
export const LAMPS = [-54, -42, -30, -18, -4, 16, 28, 40, 52, 64, 80].map(lx => [lx, -20.4]);
export const CARGO = [[-34, -3.5], [-28, -4], [-20, -3.5], [-14, -4.5], [20, -3.5], [26, -4], [34, -3.5], [74, -4.5], [82, -3.5]];
export const CRANE = { lx: 40, lz: -2.2 };
export const DOCK = { deckEnd: BOARDWALK.lx0 };   // the v103 boardwalk stops where the v2 one starts (flush, same 2.95)
export const remapTokens = (list) => list.filter(t => TOKEN_SLOTS[t.sym] !== undefined).map(t => ({ ...t, lx: TOKEN_SLOTS[t.sym], lz: FACADE_LZ + 0.6 }));
export const SPAWN = { lx: 6, lz: 50, ly: Math.PI };            // GO ASHORE fallback: the end of the Main Street jetty, facing town

export const PLAZA = {
  id: 'plaza-v2', frame: 'town-local (js/island/coast.js t2w / w2t)',
  bounds: { lx0: -176, lx1: 100, lz0: -56, lz1: 66 },             // land part lx -55..100 = the coast.js PLAZA flat
  connectors: [                                                    // where neighbouring areas attach (x, z, deck / ground height)
    { id: 'main_street', lx: 6, lz: -56, y: Y_QUAY, dir: 'inland', w: 14, note: 'js/island/foot.js STREET (lots from lz -68)' },
    { id: 'boardwalk_west', lx: -176, lz: 2, y: Y_DECK, dir: 'west', w: 8, note: 'coast.js BOARDWALK + the v103 piers P3/P4' },
    { id: 'shore_west', lx: -176, lz: -7, y: Y_DECK, dir: 'west', w: 14, note: 'raised shore strip behind the boardwalk (plazaGround)' },
    { id: 'mole_east', lx: 104, lz: 0, y: 2.4, dir: 'east', w: 8, note: 'coast.js MOLE (lighthouse, spyglass)' },
    { id: 'headland_east', lx: 100, lz: -30, y: Y_QUAY, dir: 'east', w: 40, note: 'tower + cliff battery' },
  ],
  ship: SHIP, boardwalk: BOARDWALK, jetty: JETTY, jetties: JETTIES, berths: BERTHS, approach: APPROACH,
  storefronts: STOREFRONTS, triggers: Object.fromEntries(STOREFRONTS.filter(s => s.trigger).map(s => [s.trigger, { id: s.id, lx: s.lx, lz: s.lz + 3.8 }])), halls: HALLS, tokenSlots: TOKEN_SLOTS, trending: TRENDING, spawn: SPAWN,
};

// v2 ground: the shore behind the sloped boardwalk (lx -176..-55, lz -14..0) is raised to the boardwalk's height, fading into the
// beach over 8 m inland and 10 m west, so street level = boardwalk level along the whole waterfront (east of -55 the quay
// already sits at street level)
export function plazaGround(lx, lz, h) {
  const B = BOARDWALK, sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  if (lz <= 0.5 && lx > SLAB.lx0 - 4 && lx < SLAB.lx1 + 4 && lz > SLAB.lz0 - 4) {             // under the cobbled slab: 4 cm below its top
    const w = sm(SLAB.lx0 - 4, SLAB.lx0, lx) * (1 - sm(SLAB.lx1, SLAB.lx1 + 4, lx)) * sm(SLAB.lz0 - 4, SLAB.lz0, lz); h = h * (1 - w) + Math.max(h, STREET_Y - 0.04) * w; }
  if (lx < B.lx0 - 10 || lx > B.lxS + 1 || lz < -22 || lz > 0.5) return h;
  const w = sm(B.lx0 - 10, B.lx0, lx) * sm(-22, -14, lz); return h * (1 - w) + Math.max(h, bwY(lx) - 0.01) * w;
}
export const BW_SEGS = (() => { const out = [], B = BOARDWALK, n = 12, step = (B.lxS - B.lx0) / n;   // walkable flat pieces
  for (let i = 0; i < n; i++) { const a = B.lx0 + i * step; out.push([a, a + step, bwY(a + step / 2)]); } out.push([B.lxS, B.lx1, B.yE]); return out; })();

// game side (js/dock/layout.js, ?plaza=2): L(lx, lz) -> harbor [x, z]; yawW(ly) -> harbor yaw
export function harborParts(L, yawW) {
  const sea = (() => { const [a, b] = L(0, 0), [c, d] = L(0, 1); return { x: c - a, z: d - b }; })();
  const berths = BERTHS.map(b => { const [x, z] = L(b.lx, b.lz), [ax, az] = L(b.ashore.lx, b.ashore.lz);
    return { id: b.id, x, z, yaw: yawW(b.ly), len: SHIP.hullLen, beam: SHIP.beam, quay: false, ashore: { x: ax, z: az, y: b.ashore.y },
      bollards: [L(b.ashore.lx, b.lz - 16), L(b.ashore.lx, b.lz + 16)], out: sea }; });
  const decks = BW_SEGS.map(([a, b, y], i) => { const [x, z] = L((a + b) / 2, (BOARDWALK.lz0 + BOARDWALK.lz1) / 2); return { id: 'bw2_' + i, x, z, yaw: yawW(Math.PI / 2), hl: (b - a) / 2 + 0.05, hw: (BOARDWALK.lz1 - BOARDWALK.lz0) / 2 + 0.5, y }; }); // along = lx (world.js shrinks only the across edges by 0.35)
  decks.push(...JETTIES.map(j => { const lz0 = j.lz0 - 1, [x, z] = L(j.lx, (lz0 + JETTY.lz1) / 2); return { id: 'jetty_' + j.id, x, z, yaw: yawW(0), hw: JETTY.w / 2, hl: (JETTY.lz1 - lz0) / 2, y: j.y }; })); // root overlaps the boardwalk by 1 m
  const circles = []; for (const j of JETTIES) for (let lz = 4; lz <= JETTY.lz1; lz += 4) { const [x, z] = L(j.lx, lz); circles.push({ x, z, r: JETTY.w / 2 + 0.2, h: j.y + 2, pier: true }); }
  { const [x, z] = L((SLAB.lx0 + SLAB.lx1) / 2, (SLAB.lz0 + SLAB.lz1) / 2); decks.push({ id: 'plaza_slab', x, z, yaw: yawW(0), hw: (SLAB.lx1 - SLAB.lx0) / 2 + 0.35, hl: (SLAB.lz1 - SLAB.lz0) / 2, y: STREET_Y }); }
  const [sx, sz] = L(SPAWN.lx, SPAWN.lz);
  return { berths, decks, circles, spawn: { x: sx, z: sz, yaw: yawW(SPAWN.ly) } };
}

// sign labels: one canvas (brand font, carved boards, skull on the hanging ones) + one merged plane mesh
export function signList() {
  const S = STOREFRONTS.map(s => ({ key: s.id, text: s.name, col: '#ffcd77', bg: '#5a3219', skull: true }));
  if (!ON_PORTAL) { S.push({ key: 'tok_HQ', text: '$HQ', col: '#ffcd77', bg: '#161616', big: true }, { key: 'tok_RETARDIO', text: '$RETARDIO', col: '#ffcd77', bg: '#161616', big: true });
    for (let i = 0; i < TRENDING.n; i++) S.push({ key: 'trend' + i, text: 'TRENDING #' + (i + 1), col: '#7cff6b', bg: '#161616' }); }
  S.push({ key: 'hall', text: 'HARBOR EXCHANGE HALL', col: '#ffcd77', bg: '#5a3219' }, { key: 'tavern', text: 'THE SUNK TAVERN', col: '#ffcd77', bg: '#5a3219', skull: true });
  for (const b of BERTHS) S.push({ key: 'berth_' + b.id, text: 'BERTH ' + b.id.slice(1), col: '#fff1d2', bg: '#3d2a1c' });
  return S;
}

// builder: h = foot.js kit helpers (merged toon kit: every stone piece shares the masonry surface layer, 0 extra materials)
export function buildPlazaV2(h) {
  const { k, W, box, cyl, M, at, barrel, crate, sacks, torchPost, stall, addBox, addCirc, T, F, A, low, C, yaw0, deckY } = h, Y0 = STREET_Y;   // everything stands on the slab top
  const signs = [], MASON = 11, STONES = [0xc9bfae, 0xb9b2a6, 0xd6c7a8, 0xa99f90], QUOIN = 0x8a837a;
  const sign = (key, w, hh, lx, y, lz, ly = 0) => { const [x, z] = T(lx, lz); signs.push([key, w, hh, M(x, y, z, yaw0 + ly)]); };
  const cz = FACADE_LZ - ROW_D / 2;
  // ---- stone building (front = local +z = the street): plinth, ashlar storeys + string courses, quoins, stone-framed windows
  // with timber shutters, ground-floor shop arch, timber balcony + beams, tile roof, stone gables + chimney ----
  function stoneHouse(lx, w, fl, v, o = {}) {
    const [x, z] = T(lx, cz); addBox(x, z, w + 0.6, ROW_D + 0.6, yaw0);
    at(lx, cz, 0, () => {
      const d = ROW_D, fh = 3.5, col = STONES[v % 4], sh = C.SHUTTER[(v + 2) % C.SHUTTER.length];
      W(k, box(w + 0.6, 0.7, d + 0.6), QUOIN, MASON, M(0, 0.15, 0));
      for (let f = 0; f < fl; f++) { const y0 = 0.5 + f * fh;
        W(k, box(w, fh, d), col, MASON, M(0, y0 + fh / 2, 0));
        W(k, box(w + 0.36, 0.3, d + 0.36), QUOIN, MASON, M(0, y0 + fh, 0), false);                       // string course
        for (const sx of [-1, 1]) for (let q = 0; q < (low ? 1 : 3); q++) W(k, box(0.8, low ? fh : 0.9, 0.8), QUOIN, MASON, M(sx * (w / 2 - 0.3), y0 + (low ? fh / 2 : 0.55 + q * 1.15), d / 2 - 0.3), false); // quoins
        const nw = Math.max(1, Math.floor(w / 3.2));
        for (let i = 0; i < nw; i++) { const wx = (i - (nw - 1) / 2) * (w / nw);
          if (f === 0 && o.shop) continue;
          W(k, box(1.1, 1.6, 0.12), 0x2b3d4a, 0, M(wx, y0 + 1.9, d / 2 + 0.02), false);                   // window
          W(k, box(1.6, 0.32, 0.3), QUOIN, MASON, M(wx, y0 + 2.85, d / 2 + 0.1), false);                  // lintel
          W(k, box(1.5, 0.18, 0.4), QUOIN, MASON, M(wx, y0 + 1.05, d / 2 + 0.15), false);                 // sill
          if (!low || i % 2 === 0) for (const s of [-1, 1]) W(k, box(0.58, 1.6, 0.08), sh, 2, M(wx + s * 0.88, y0 + 1.9, d / 2 + 0.22, s * 0.45), false); }
        if (f > 0 && (f === 1 || !low)) { W(k, box(w - 0.8, 0.22, 1.4), C.WOOD, 2, M(0, y0 + 0.1, d / 2 + 0.7));   // timber balcony
          W(k, box(w - 0.8, 0.12, 0.12), C.WOOD_D, 2, M(0, y0 + 1.15, d / 2 + 1.35), false);
          for (let b = -(w - 0.8) / 2; b <= (w - 0.8) / 2 + 0.01; b += low ? 1.2 : 0.5) W(k, box(0.09, 1.0, 0.09), C.WOOD_L, 2, M(b, y0 + 0.65, d / 2 + 1.35), false);
          for (const sx of [-1, 1]) W(k, box(0.2, 0.9, 0.2), C.WOOD_D, 2, M(sx * (w / 2 - 0.8), y0 - 0.3, d / 2 + 0.55, 0, 0.75), false); }
      }
      if (o.shop) { W(k, box(w * 0.62, 2.9, 0.14), 0x2a1d14, 0, M(0, 1.95, d / 2 + 0.02), false);          // shop opening + arch
        W(k, box(w * 0.62 + 0.8, 0.5, 0.4), QUOIN, MASON, M(0, 3.6, d / 2 + 0.15), false); for (const sx of [-1, 1]) W(k, box(0.5, 3.1, 0.4), QUOIN, MASON, M(sx * (w * 0.31 + 0.2), 2.05, d / 2 + 0.15), false); }
      const top = 0.5 + fl * fh; W(k, box(w + 0.2, 0.3, 0.3), C.WOOD_D, 2, M(0, top - 0.2, d / 2 + 0.25), false);   // eave beam
      const pitch = 0.55, half = d / 2 + 0.8, slab = half / Math.cos(pitch), rise = Math.tan(pitch) * half;
      for (const s of [-1, 1]) W(k, box(w + 1.0, 0.32, slab), C.ROOFS[v % 4], 4, M(0, top + rise / 2, s * half / 2, 0, s * pitch));
      W(k, cyl(0.26, 0.26, w + 1.1, 6), C.ROOFS[(v + 1) % 4], 4, M(0, top + rise + 0.05, 0, 0, 0, Math.PI / 2), false);
      const gable = new THREE.BufferGeometry(); gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -d / 2, 0, 0, d / 2, 0, rise - 0.15, 0], 3)); gable.computeVertexNormals();
      for (const sx of [-1, 1]) { const g = gable.clone(); if (sx < 0) g.scale(-1, 1, 1); W(k, g, col, MASON, M(sx * (w / 2 + 0.01), top, 0, sx > 0 ? 0 : Math.PI), false); }
      W(k, box(1.0, 2.6, 1.0), QUOIN, MASON, M(w * 0.3, top + rise * 0.6 + 1.0, -d * 0.2));
    }, Y0);
  }
  // carved hanging sign on an iron bracket, perpendicular to the facade (reads down the street both ways) + facade board
  const hanging = (key, lx, w) => { at(lx + w / 2 - 1.1, FACADE_LZ, 0, () => { W(k, box(0.12, 0.12, 2.2), C.IRON, 0, M(0, 5.6, 1.1), false); W(k, box(0.08, 0.6, 0.08), C.IRON, 0, M(0, 5.3, 0.3, 0, 0.8), false);
      for (const sz of [0.9, 2.0]) W(k, box(0.04, 0.35, 0.04), C.IRON, 0, M(0, 5.4, sz), false); W(k, box(0.16, 1.45, 2.7), C.WOOD_D, 2, M(0, 4.5, 1.45)); }, Y0);
    sign(key, 2.5, 1.3, lx + w / 2 - 1.1 + 0.09, Y0 + 4.5, FACADE_LZ + 1.45, Math.PI / 2); sign(key, 2.5, 1.3, lx + w / 2 - 1.1 - 0.09, Y0 + 4.5, FACADE_LZ + 1.45, -Math.PI / 2); };
  SHOP_PLACES.length = 0;
  for (const s of STOREFRONTS) {
    const glb = SHOPS_KIT && SHOPS_KIT.shops[s.id];
    if (glb) {   // [Timothy] Blender model: same footprint + counter + awning-post colliders as the blockout, plus its prop colliders
      { const [x, z] = T(s.lx, cz); addBox(x, z, s.w + 0.6, ROW_D + 0.6, yaw0); SHOP_PLACES.push({ id: s.id, m: M(x, Y0, z, yaw0) }); }
      for (const c of glb.colliders) { const [x, z] = T(s.lx + c[1], cz + c[2]); if (c[0] === 'c') addCirc(x, z, c[3]); else addBox(x, z, c[3], c[4], yaw0 + (c[5] || 0)); }
      { const [x, z] = T(s.lx, FACADE_LZ + 1.0); addBox(x, z, s.w * 0.6 + 0.4, 1.4, yaw0); } for (const sx of [-1, 1]) addCirc(...T(s.lx + sx * s.w * 0.33, FACADE_LZ + 2.5), 0.25);
      continue; }
    stoneHouse(s.lx, s.w, s.fl, s.v, { shop: true });
    at(s.lx, FACADE_LZ, 0, () => {                                          // walk-up counter + canvas awning on timber posts
      W(k, box(s.w * 0.6, 1.1, 1.0), C.WOOD, 2, M(0, 0.55, 1.0)); W(k, box(s.w * 0.6 + 0.3, 0.14, 1.25), C.WOOD_L, 2, M(0, 1.16, 1.0), false);
      for (const sx of [-1, 1]) W(k, box(0.22, 3.0, 0.22), C.WOOD_D, 2, M(sx * s.w * 0.33, 1.5, 2.5), false);
      W(k, box(s.w * 0.72, 0.12, 2.8), s.awn, 4, M(0, 3.25, 1.35, 0, 0.24));
      for (let i = 0; i < 6; i++) W(k, box(s.w * 0.72 / 6 - 0.04, 0.45, 0.06), i % 2 ? 0xf2efe6 : s.awn, 12, M(-s.w * 0.36 + (i + 0.5) * s.w * 0.12, 2.8, 2.72), false);
      W(k, box(s.w * 0.64, 1.0, 0.16), C.WOOD_D, 2, M(0, 4.35, 0.42), false);
    }, Y0);
    sign(s.id, s.w * 0.6, 0.85, s.lx, Y0 + 4.35, FACADE_LZ + 0.52); hanging(s.id, s.lx, s.w);
    { const [x, z] = T(s.lx, FACADE_LZ + 1.0); addBox(x, z, s.w * 0.6 + 0.4, 1.4, yaw0); } for (const sx of [-1, 1]) addCirc(...T(s.lx + sx * s.w * 0.33, FACADE_LZ + 2.5), 0.25); // counter + awning posts are solid
  }
  for (const hl of HALLS) {                                                 // stone warehouse: billboards on the ground floor
    const [x, z] = T(hl.lx, cz); addBox(x, z, hl.w + 0.6, ROW_D + 0.6, yaw0);
    at(hl.lx, cz, 0, () => { W(k, box(hl.w + 0.6, 0.7, ROW_D + 0.6), QUOIN, MASON, M(0, 0.15, 0)); W(k, box(hl.w, 4.4, ROW_D), 0xa99f90, MASON, M(0, 2.7, 0));
      W(k, box(hl.w + 0.4, 0.4, ROW_D + 0.4), QUOIN, MASON, M(0, 5.0, 0), false); W(k, box(hl.w, 3.6, ROW_D), 0xc9bfae, MASON, M(0, 6.9, 0));
      for (const sx of [-1, 1]) for (let q = 0; q < 6; q++) W(k, box(0.8, 0.9, 0.8), QUOIN, MASON, M(sx * (hl.w / 2 - 0.3), 1.0 + q * 1.4, ROW_D / 2 - 0.3), false);
      W(k, box(hl.w + 1.2, 0.4, ROW_D + 1.6), C.ROOF, 4, M(0, 8.9, 0)); W(k, box(hl.w * 0.7, 1.4, 0.2), C.WOOD_D, 2, M(0, 9.9, ROW_D / 2 - 0.4), false);
      W(k, box(hl.w + 0.2, 0.3, 0.3), C.WOOD_D, 2, M(0, 8.5, ROW_D / 2 + 0.2), false); }, Y0);
    sign('hall', hl.w * 0.66, 1.2, hl.lx, Y0 + 9.9, FACADE_LZ - 0.28);
    if (hl.trending && !ON_PORTAL) for (let i = 0; i < TRENDING.n; i++) { const lx = TRENDING.lx0 + i * (TRENDING.lx1 - TRENDING.lx0) / (TRENDING.n - 1);
      at(lx, FACADE_LZ, 0, () => W(k, box(2.9, 2.2, 0.2), C.WOOD_D, 2, M(0, TRENDING.y, 0.12), false), Y0); sign('trend' + i, 2.6, 1.9, lx, Y0 + TRENDING.y, FACADE_LZ + 0.24); }
  }
  if (!ON_PORTAL) for (const [sym, lx] of Object.entries(TOKEN_SLOTS)) if (!A['bb' + sym]) {     // slot frames for boards not in this build
    at(lx, FACADE_LZ + 0.6, 0, () => { for (const sx of [-1, 1]) W(k, box(0.26, 5.8, 0.26), C.WOOD_D, 2, M(sx * 2.05, 2.9, 0)); W(k, box(4.5, 4.0, 0.24), C.WOOD_D, 2, M(0, 3.75, 0)); }, Y0);
    sign('tok_' + sym, 4.1, 3.6, lx, Y0 + 3.85, FACADE_LZ + 0.74); }
  { const [x, z] = T(62, -27.4); addBox(x, z, 4.9, 1.2, yaw0); }   // the v103 token exchange counter (was walk-through)
  for (const hs of HOUSES) { const glb = hs.glb && SHOPS_KIT && SHOPS_KIT.shops[hs.glb];
    if (glb) { const [x, z] = T(hs.lx, cz); addBox(x, z, hs.w + 0.6, ROW_D + 0.6, yaw0); SHOP_PLACES.push({ id: hs.glb, m: M(x, Y0, z, yaw0) }); continue; }
    stoneHouse(hs.lx, hs.w, hs.fl, hs.v); if (hs.tavern) hanging('tavern', hs.lx, hs.w); }
  // ---- market street + stalls + tavern tables + carts ----
  for (const [lx, lz] of LAMPS) { const [x, z] = T(lx, lz); torchPost(k, F, x, Y0, z); addCirc(x, z, 0.3); }
  for (const s of STALLS) { const [x, z] = T(s.lx, s.lz); stall(k, x, Y0, z, yaw0 + Math.PI, 0xd8322f); { const [bx, bz] = T(s.lx, s.lz - 0.2); addBox(bx, bz, 4.3, 3.0, yaw0); }   // [collisions] counter + the 4 awning posts (the r 1.8 circle let you walk through the corner posts)
    at(s.lx, s.lz, Math.PI, () => { W(k, box(4.4, 0.1, 3.2), s.c, 12, M(0, 3.0, 0.3, 0, 0.14)); for (const sx of [-2.0, 2.0]) for (const sz of [-1.2, 1.6]) W(k, box(0.14, 3.0, 0.14), C.WOOD_D, 2, M(sx, 1.5, sz), false);
      for (let p = 0; p < 5; p++) k.add(new THREE.IcosahedronGeometry(0.28, 0), [0xff7a1a, 0xffd43b, 0x7cc142, 0xd8322f][(p + s.lx) & 3], { m: M(-1.2 + p * 0.6, 1.2, 0.2), outline: false, mat: 0 }); }, Y0);
    const [bx, bz] = T(s.lx + 2.8, s.lz + 1.0); ((s.lx / 8) % 2 ? barrel : sacks)(k, M(bx, Y0, bz, s.lx)); addCirc(bx, bz, 0.7); }
  for (const [lx, lz] of CARTS) { at(lx, lz, 0.3, () => { W(k, box(2.6, 0.5, 1.5), C.WOOD, 2, M(0, 0.95, 0)); for (const sz of [-0.85, 0.85]) W(k, cyl(0.55, 0.55, 0.14, 10), C.WOOD_D, 2, M(-0.4, 0.55, sz, 0, Math.PI / 2), false);
      W(k, box(1.8, 0.1, 0.1), C.WOOD_D, 2, M(2.1, 0.8, 0.4), false); W(k, box(1.8, 0.1, 0.1), C.WOOD_D, 2, M(2.1, 0.8, -0.4), false); }, Y0);
    const [x, z] = T(lx, lz); barrel(k, M(x, Y0 + 1.2, z, 1)); { const c = Math.cos(0.3), s = Math.sin(0.3), [bx, bz] = T(lx + 0.9 * c, lz - 0.9 * s); addBox(bx, bz, 4.9, 1.8, yaw0 + 0.3); } }   // [collisions] cart body + wheels + the shafts (circle 1.5 missed the shafts)
  for (const [lx, lz] of TAVERN_TABLES) { at(lx, lz, 0, () => { W(k, cyl(0.9, 0.9, 0.12, 10), C.WOOD, 2, M(0, 1.0, 0)); W(k, cyl(0.15, 0.25, 1.0, 6), C.WOOD_D, 2, M(0, 0.5, 0), false);
      for (const a of [0, 2.1, 4.2]) W(k, cyl(0.35, 0.35, 0.55, 8), C.WOOD_L, 2, M(Math.sin(a) * 1.3, 0.28, Math.cos(a) * 1.3), false); }, Y0); const [x, z] = T(lx, lz); addCirc(x, z, 1.0);
    addCirc(x, z, 1.72); }   // [collisions] table + its 3 stools as one round footprint (the stools were walk-through; separate circles left pockets)
  // ---- palms (blockout: chunky trunk + fronds; phase 2 = the nature kit palm) ----
  for (const [i, [lx, lz]] of PALMS.entries()) at(lx, lz, i * 1.3, () => { for (let s = 0; s < 4; s++) W(k, cyl(0.32 - s * 0.04, 0.36 - s * 0.04, 2.0, 7), C.BARK, 5, M(s * 0.18, 1 + s * 1.9, 0, 0, 0, -0.06 * s));
      for (let f = 0; f < 6; f++) W(k, box(0.9, 0.14, 3.6), 0x3fca45, 6, M(0.7 + Math.sin(f * 1.05) * 1.5, 7.6, Math.cos(f * 1.05) * 1.5, f * 1.05, 0.38)); addCirc(...T(lx, lz), 0.5); }, Y0);
  // ---- cargo between the jetty roots (never on a jetty root or berth lane), rope coils, crane ----
  for (const [i, [lx, lz]] of CARGO.entries()) { if (!clearOfJetties(lx, 3)) continue; const [x, z] = T(lx, lz), y = lx < BOARDWALK.lxS ? bwY(lx) - 0.02 : Y0;
    crate(k, M(x, y, z, i * 0.7), 1.3); if (i % 2 === 0) crate(k, M(x, y + 1.3, z, i * 0.7 + 0.4), 1.1); const [x2, z2] = T(lx + 1.8, lz + 0.4); barrel(k, M(x2, y, z2, i));
    at(lx - 1.8, lz + 0.6, 0, () => { W(k, cyl(0.6, 0.6, 0.35, 12), 0xd9c39a, 12, M(0, 0.18, 0)); W(k, cyl(0.25, 0.25, 0.37, 8), 0x8a6a3a, 12, M(0, 0.19, 0), false); }, y); addCirc(...T(lx - 1.8, lz + 0.6), 0.65); addCirc(x2, z2, 0.7);
    addCirc(x, z, 1.1); }
  at(CRANE.lx, CRANE.lz, 0, () => { W(k, box(1.4, 0.6, 1.4), QUOIN, MASON, M(0, 0.3, 0)); W(k, cyl(0.28, 0.34, 7, 8), C.WOOD_D, 2, M(0, 3.8, 0)); W(k, box(0.35, 0.35, 7.5), C.WOOD_D, 2, M(0, 6.6, 2.6, 0, -0.5));
    W(k, cyl(0.04, 0.04, 3.0, 4), 0xe7c08d, 12, M(0, 5.8, 5.7), false); W(k, box(1.4, 1.0, 1.4), C.WOOD_L, 2, M(0, 4.0, 5.7)); }, Y0); addCirc(...T(CRANE.lx, CRANE.lz), 0.9);
  // ---- the waterfront boardwalk: flat east part at street level, gently sloped west part; stilts, a low sea rail between the jetty
  // roots (open at every jetty), bollards on the edge; the 5 jetties root into its outer edge at the same height ----
  // [Timothy] Blender docks (plazaShops.js DOCKS_KIT): boardwalk, jetty decks, pilings, bollards, mooring posts, rope, ladders and the
  // B1-B10 plaques come from assets/island/docks*.glb (same decks / heights / bollard spots, colliders from the GLB); the torch posts stay
  DOCK_PLACES.length = 0;
  if (DOCKS_KIT) DOCKS_KIT.chunks.forEach((c, i) => { const [x, z] = T(c.lx, c.lz); DOCK_PLACES.push({ i, m: M(x, 0, z, yaw0) }); for (const q of c.colliders) { if (q[0] === 'b') addBox(...T(q[1], q[2]), q[3], q[4], yaw0); else addCirc(...T(q[1], q[2]), q[3]); } });   // [collisions] 'b' = town-axis box (rails, plaques)
  if (!DOCKS_KIT) { const B = BOARDWALK, D = B.lz1 - B.lz0, zc = (B.lz0 + B.lz1) / 2;
    const plank = (a, b, ya, yb) => { const L = b - a, ang = Math.atan2(ya - yb, L), len = Math.hypot(L, ya - yb);
      at((a + b) / 2, zc, 0, () => { W(k, box(len, 0.3, D), C.WOOD_L, 2, M(0, -0.15, 0, 0, 0, -ang));
        for (let x = -L / 2 + 2; x < L / 2; x += 5) W(k, cyl(0.25, 0.3, 7, 6), C.WOOD_D, 2, M(x, -3.65 - x * Math.tan(ang), D / 2 - 0.3), false); }, (ya + yb) / 2); };
    // split into ~6 m bays: one long box stretches the wood atlas into sand-like streaks; bays keep the grain at pier scale
    for (const [a, b] of [[B.lx0, B.lxS], [B.lxS, B.lx1]]) { const n = Math.ceil((b - a) / 6), st = (b - a) / n;
      for (let i = 0; i < n; i++) { const xa = a + i * st, xb = xa + st; plank(xa, xb, bwY(xa), bwY(xb)); } }
    const roots = JETTIES.map(j => [j.lx - JETTY.w / 2, j.lx + JETTY.w / 2]).sort((p, q) => p[0] - q[0]), spans = []; let x0 = B.lx0;
    for (const [a, b] of roots) { spans.push([x0, a]); x0 = b; } spans.push([x0, B.lx1]);
    for (const [a, b] of spans) { if (b - a < 1) continue; const L = b - a, ya = bwY(a), yb = bwY(b), ang = Math.atan2(ya - yb, L);
      at((a + b) / 2, B.lz1 - 0.2, 0, () => { W(k, box(Math.hypot(L, ya - yb), 0.14, 0.14), C.WOOD_D, 2, M(0, 0.95, 0, 0, 0, -ang), false);
        for (let x = -L / 2 + 0.3; x <= L / 2; x += 2.5) W(k, cyl(0.07, 0.08, 1.0, 5), C.WOOD_D, 2, M(x, 0.45 + x * Math.tan(-ang), 0), false); }, (ya + yb) / 2);
      for (let x = a + 6; x < b - 3; x += 12) { const [bx, bz] = T(x, B.lz1 - 0.9); W(k, cyl(0.28, 0.34, 0.8, 8), C.IRON, 0, M(bx, bwY(x) + 0.4, bz), false); addCirc(bx, bz, 0.4); } } }
  for (const j of JETTIES) { const L = JETTY.lz1 - j.lz0;
    if (!DOCKS_KIT) at(j.lx, (j.lz0 + JETTY.lz1) / 2, 0, () => {
      { const n = Math.ceil(L / 6), st = L / n; for (let i = 0; i < n; i++) for (const sx of [-1, 1]) W(k, box(JETTY.w / 2, 0.3, st), C.WOOD_L, 2, M(sx * JETTY.w / 4, j.y - 0.15, -L / 2 + (i + 0.5) * st)); } // 6 x 6 m bays (grain at pier scale) for (let zz = -L / 2 + 2; zz < L / 2; zz += 6) for (const sx of [-JETTY.w / 2 + 0.4, 0, JETTY.w / 2 - 0.4]) W(k, cyl(0.28, 0.32, 8, 6), C.WOOD_D, 2, M(sx, j.y - 4.3, zz), false);
      for (const sx of [-1, 1]) for (const zz of [-16, 0, 16]) W(k, cyl(0.28, 0.34, 0.8, 8), C.IRON, 0, M(sx * (JETTY.w / 2 - 0.5), j.y + 0.4, JETTY.shipLz - (j.lz0 + JETTY.lz1) / 2 + zz), false); // bollards
    }, 0);
    if (!DOCKS_KIT) for (const sx of [-1, 1]) for (const zz of [-16, 0, 16]) addCirc(...T(j.lx + sx * (JETTY.w / 2 - 0.5), JETTY.shipLz + zz), 0.4);
    for (const sx of [-1, 1]) { const [x, z] = T(j.lx + sx * (JETTY.w / 2 - 0.6), JETTY.lz1 - 1); torchPost(k, F, x, j.y, z); addCirc(x, z, 0.3); const [x0, z0] = T(j.lx + sx * (JETTY.w / 2 + 0.6), BOARDWALK.lz1 - 0.6); torchPost(k, F, x0, bwY(j.lx), z0); addCirc(x0, z0, 0.3); } }
  if (!DOCKS_KIT) for (const b of BERTHS) { addCirc(...T(b.ashore.lx, b.lz - 18), 0.3); at(b.ashore.lx, b.lz - 18, 0, () => { W(k, box(0.2, 1.6, 0.2), C.WOOD_D, 2, M(0, 0.8, 0), false); W(k, box(0.14, 0.9, 1.7), C.WOOD_D, 2, M(0, 1.9, 0)); }, b.ashore.y);
    sign('berth_' + b.id, 1.5, 0.8, b.ashore.lx + b.side * 0.08, b.ashore.y + 1.9, b.lz - 18, b.side * Math.PI / 2); }
  return signs;
}

// review-only ship footprints (?plaza=2&pvships=1): hull box + the full yard / bowsprit footprint outline per berth
export function buildBerthPreview() {
  if (!SHOW_SHIPS) return null; const g = new THREE.Group(); g.name = 'plaza_v2_berth_preview';
  import('./coast.js').then(CO => { const hullM = new THREE.MeshLambertMaterial({ color: 0x7b3b20 }), lineM = new THREE.LineBasicMaterial({ color: 0xffe14a }), laneM = new THREE.LineBasicMaterial({ color: 0x4af0ff });
    const hullG = new THREE.BoxGeometry(SHIP.beam, 6, SHIP.hullLen), inst = new THREE.InstancedMesh(hullG, hullM, BERTHS.length), m = new THREE.Matrix4(), yaw = CO.t2wYaw(0);
    const rect = (lx0, lx1, lz0, lz1, y) => [[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1], [lx0, lz0]].map(([a, b]) => { const [x, z] = CO.t2w(a, b); return new THREE.Vector3(x, y, z); });
    BERTHS.forEach((b, i) => { const [x, z] = CO.t2w(b.lx, b.lz); m.compose(new THREE.Vector3(x, 0.5, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rect(b.lx - SHIP.yardW / 2, b.lx + SHIP.yardW / 2, b.lz - SHIP.aft, b.lz + SHIP.fwd, 0.6)), lineM)); });
    g.add(inst); g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rect(APPROACH.lx0, APPROACH.lx1, APPROACH.lz0, APPROACH.lz0 + 60, 0.6)), laneM)); });
  return g;
}

// the sign mesh
export function buildPlazaSigns(signs) {
  const L = signList(), CW = 512, RH = 128, cv = document.createElement('canvas'); cv.width = CW; cv.height = RH * L.length; const g = cv.getContext('2d'), R = {};
  const skull = new Image(); skull.src = 'assets/skull_transparent.png';
  const paint = () => L.forEach((s, i) => { const y = i * RH; g.fillStyle = s.bg; g.fillRect(0, y, CW, RH); g.strokeStyle = s.col; g.lineWidth = 8; g.strokeRect(6, y + 6, CW - 12, RH - 12);
    const sk = s.skull && skull.complete && skull.naturalWidth, x0 = sk ? 60 : 0; if (sk) g.drawImage(skull, 18, y + 18, 92, 92);
    let px = s.big ? 96 : 84; g.font = `${px}px "Just Another Hand", cursive`; while (px > 30 && g.measureText(s.text).width > CW - 40 - x0 * 1.6) { px -= 4; g.font = `${px}px "Just Another Hand", cursive`; }
    g.fillStyle = s.col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.text, CW / 2 + x0 * 0.8, y + RH / 2 + 4); R[s.key] = [1 - (i + 1) / L.length, 1 - i / L.length]; });
  paint();
  const geos = []; for (const [key, w, hh, m] of signs) { const r = R[key]; if (!r) continue; const pg = new THREE.PlaneGeometry(w, hh), uv = pg.attributes.uv;
    for (let q = 0; q < uv.count; q++) uv.setY(q, r[0] + uv.getY(q) * (r[1] - r[0])); pg.applyMatrix4(m); geos.push(pg); }
  if (!geos.length) return null;
  const pos = [], uvs = [], idx = []; let base = 0; for (const pg of geos) { pos.push(...pg.attributes.position.array); uvs.push(...pg.attributes.uv.array); idx.push(...Array.from(pg.index.array, v => v + base)); base += pg.attributes.position.count; pg.dispose(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); mesh.name = 'plaza_v2_signs';
  const repaint = () => { paint(); tex.needsUpdate = true; }; skull.onload = repaint; document.fonts?.load?.('84px "Just Another Hand"').then(repaint).catch(() => {});
  return mesh;
}
