import { hqParts, petShellParts, gableVertices } from '../pumpfun/model.js';
import { HQ, HQ_WALLS, HQ_OUTWORKS, HQ_TRENCH, TOKEN_BOARD_SPOTS, PET_SHOP, PET_LOT, PET_STORE, PET_WALLS, PET_PROPS, petFloor } from '../pumpfun/site.js';
import { SHIP_STORE, buildShipStore } from './shipStore.js';
import { OUTFIT_STORE, outfitWalls, outfitRooms } from './outfitStore.js';   // [outfit-store] Clothes + Accessories = one building
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
import { TOKENX_ON, HALL_BOARDS_ON, hallTokenHidden } from './coast.js';   // [v240] kill switches: &tokenx=1 kiosk, &hallboards=1 hall posters + TRENDING row
import { SHOPS_KIT, SHOP_PLACES, SHIP_STORE_PLACES, DOCKS_KIT, DOCK_PLACES } from './plazaShops.js';   // [Timothy] Blender storefront models (loaded before createFoot)
const PHONE_TEX = (() => { try { return matchMedia('(pointer: coarse)').matches || /[?&]quality=low/.test(location.search); } catch { return false; } })(); // [mobile-perf-2] phones: smaller runtime canvases
export { hillLot, hillClear, bigShop, rentLot, squadHall, hallGround, hallFront, squadOverlap } from './hillStreet.js';   // [Timothy] foot.js buildStreet: the Blender hill street lots (js/island/hillStreet.js)
export { buildPlazaShops, plazaShopsReady } from './plazaShops.js';
export { casinoSite, casinoGround, casinoClear, casinoOverlap } from './casino.js';   // [Timothy] THE GOLDEN DOUBLOON CASINO (#47): foot.js terrain + buildStreet + grass hooks

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
// ---- berths: ships lie bow-out, side by side, at least 23 m centre to centre (yards 22.56 m); each jetty carries one ship
// on each side. Park 1.5 m farther off the jetty and 10 m farther out to sea: even the largest
// hull has 3.3 m side clearance and its stern gallery clears the boardwalk by 13 m.
// Neighbouring ships between jetties retain 23 m centre spacing (yards 22.56 m).
// ---- the WATERFRONT BOARDWALK (BANKSY "make dock the board walk all the way down"): one continuous timber deck over the water
// just outside the seawall (lz 0..8), from the old west boardwalk (lx -176, deck 2.95) to the mole (lx 100). It slopes 0.27 %
// down to street level by lx -55 and runs flat at street level from there; the land behind the sloped part is raised to the
// same heights (plazaGround), so the street meets the boardwalk along its whole length, every jetty roots into it at the same
// height, and walk height = visual height (layout.js gets it as short flat decks, < 1.5 cm off the slope).
export const BOARDWALK = { lx0: -176, lxS: -55, lx1: 100, lz0: 0, lz1: 8, yW: Y_DECK, yE: STREET_Y + 0.02 };
export const bwY = (lx) => { const B = BOARDWALK; return lx <= B.lx0 ? B.yW : lx >= B.lxS ? B.yE : B.yW + (B.yE - B.yW) * (lx - B.lx0) / (B.lxS - B.lx0); };
export const JETTY = { w: 12, lz0: BOARDWALK.lz1, lz1: 59, shipOff: 14.5, shipLz: 45 };
// Signage stays on the original jetty stations, independently of ship parking.
export const BERTH_SIGN_LZ = 35 - 18;
const JETTY_LX = [-150, -98, -46, 6, 58];                      // lx 6 = on the Main Street axis (arrival looks straight up it)
export const JETTIES = JETTY_LX.map((lx, i) => ({ id: 'J' + (i + 1), lx, y: +bwY(lx).toFixed(3), lz0: JETTY.lz0 }));   // timber, rooted flush in the boardwalk
export const BERTHS = JETTIES.flatMap((j, i) => [-1, 1].map((s, k) => ({ id: 'B' + (i * 2 + k + 1), jetty: j.id, lx: j.lx + s * JETTY.shipOff, lz: JETTY.shipLz, ly: 0,
  ashore: { lx: j.lx + s * (JETTY.w / 2 - 1.4), lz: JETTY.shipLz, y: j.y }, side: s })));
export const APPROACH = { lz0: JETTY.shipLz + SHIP.fwd + 0.3, lx0: Math.min(...BERTHS.map(b => b.lx)) - SHIP.yardW / 2, lx1: Math.max(...BERTHS.map(b => b.lx)) + SHIP.yardW / 2 };
export const keepOldPier = (lx) => lx < APPROACH.lx0 - 30;      // the v103 T-head piers outside the berth fan stay (art only)
export const clearOfJetties = (lx, pad = 0) => JETTIES.every(j => Math.abs(lx - j.lx) > JETTY.w / 2 + pad);
export const clearOfBerths = (lx, lz, pad = 0) => !(lz > 0 && lx > APPROACH.lx0 - pad && lx < APPROACH.lx1 + pad);

// ---- land side ----
export const FACADE_LZ = -30, ROW_D = 12, STALL_LZ = -17;
// storefronts: Blender GLBs already have open arches + dressed interiors (tools/plaza_blender/plaza_shops_blender.py).
// [v250] BANKSY 8:33 PM 'Move sword shop and other shop buttons inside the stores': walk-in like FISH MARKET / MARKETPLACE —
// hollow wall colliders (door gap), prompt on the shop floor (promptLz), not the street. vendor = js/shopCatalog.js VENDORS id.
// [v254] BANKSY 9:33 PM 'Move the crew shop, upgrade shop, pet shop, clothing store back outside cuz can't go inside those':
// Clothes / Pets / Upgrade / Crew go back outside (street prompt + solid footprint). [shipshop-fix] Ship too: walk-in was blocked by the GLB counter / awning-post colliders at the door (same as the four).
export const SHOPS_OUTSIDE = new Set(['shop_pets']);   // [outfit-store] Clothes is walk-in again (one building with Accessories) // [shipshop-fix] BANKSY 9:44 PM 'Ship shop doesn't work': Ship kept walk-in in v254, same blocked door as the other four
// [clothes-aaa] BANKSY t231u-t232u "3a upgrade clothing store" / "make them walk in stores and make them deeper" + [outfit-store] 5:52 PM
// "Combine clothing and accessories stores, make it 2 different areas of store tho": Clothes + Accessories are ONE 20 m x 18 m walk-in
// (js/island/outfitStore.js OUTFIT_STORE, lx -54 .. -34, lz -30 .. -48), floor = the street (no step), no street counters. Each area's
// prompt stands in front of its own counter at the back (lz -43.4); the props' colliders ride in the GLB extras.
export const CLOTHES_ROOM = Object.freeze({ depth: OUTFIT_STORE.depth, promptLz: OUTFIT_STORE.promptLz, ceil: OUTFIT_STORE.ceil, room: Object.freeze(outfitRooms()[0]) });
// [v250] walk-in wall colliders (town-local [lx, lz, w, d]): back wall, two side walls, the two front piers either side of the door;
// [clothes-aaa] s.depth = a deeper room (the front stays on FACADE_LZ)
export function walkInWalls(s) {
  const w = s.w, d = s.depth || ROW_D, hw = w / 2, hd = d / 2, t = 0.5, DOOR = Math.min(w * 0.66, w - 2.6), pier = hw - DOOR / 2, px = DOOR / 2 + pier / 2, cz = FACADE_LZ - hd, out = [];
  out.push([s.lx, cz - hd + t / 2, w + 0.6, t + 0.6]); for (const sx of [-1, 1]) { out.push([s.lx + sx * (hw - t / 2), cz, t + 0.6, d + 0.6]); out.push([s.lx + sx * px, cz + hd - t / 2, pier + 0.3, t + 0.6]); }
  return out;
}
export const CAM_ROOMS = [];   // [clothes-aaa] indoor camera boxes (foot-world frame, filled by buildPlazaV2): js/dock/world.js camClamp
export const ACCESSORIES_ROOM = Object.freeze({ counter: Object.freeze({ x: 0, z: -1.6, w: 5.4, d: 1.1 }), promptLz: FACADE_LZ - 5.5 });
// Swap the complete fitted storefronts, not only their prompts: baked cages, keeper, signs,
// colliders and accessory racks follow the same ID/anchor used by layout and both maps.
export const STOREFRONTS = [
  { id: 'shop_clothes', name: 'CLOTHES SHOP', vendor: 'clothes', lx: -49, w: 10, fl: 3, v: 0, awn: 0xd8322f, label: 'CLOTHES SHOP · TOPS, PANTS, SHOES' },
  // Pets relocated to hill L4 (pumpfun/site.js); no old shell, keeper or collider here.
  { id: 'shop_ships', name: 'SHIP SHOP', vendor: 'ships', lx: 32, w: 10, mapHidden: true, fl: 3, v: 2, awn: 0x2a6df4, label: 'SHIP SHOP · SHIP SKINS' },
  { id: 'shop_upgrades', name: 'UPGRADE SHOP', vendor: 'ships', open: 'upgrades', mapHidden: true, lx: 20.5, w: 11, fl: 2, v: 3, awn: 0xffc93c, label: 'UPGRADE SHOP · SHIP UPGRADES' },
  { id: 'shop_crew', name: 'ACCESSORIES STORE', vendor: 'accessories', lx: -38.5, w: 9, fl: 2, v: 1, awn: 0x6a4fb3, label: 'ACCESSORIES STORE · HATS, JEWELRY & MORE' },   // Stable landmark ID; crew are already aboard, dressing is in the hull.
].map(s => ({ ...s, lz: FACADE_LZ + 0.7, ...(SHOPS_OUTSIDE.has(s.id) ? {} : { walkIn: true, promptLz: ACCESSORIES_ROOM.promptLz }), ...(OUTFIT_STORE.areas.some(a => a.id === s.id) ? { depth: OUTFIT_STORE.depth, promptLz: OUTFIT_STORE.promptLz, mapHidden: true, part: OUTFIT_STORE.id } : {}), ...(SHIP_STORE.counters.some(c => c.id === s.id) ? { depth: SHIP_STORE.depth, promptLz: SHIP_STORE.promptLz } : {}) }));   // [v250] mid-floor prompt; [outfit-store] two vendors, one building + one map pin; [v254] outside shops: street prompt lz+3.8 + solid footprint
// token halls: stone warehouses whose ground floor carries the walk-up billboards (the v103 billboard art + live MC strip +
// CA / DexScreener panel, just moved: foot.js PLAZA_TOKENS is remapped through TOKEN_SLOTS, so v144's HQ / RETARDIO follow)
export const HALLS = [{ id: 'hall_e', lx: 47, w: 18, fl: 2, trending: 5, market: true }];   // [v240] hall_e = the player MARKETPLACE (#7)
export const TOKEN_SLOTS = { SUNK: TOKEN_BOARD_SPOTS.SUNK.lx, AHOY: TOKEN_BOARD_SPOTS.AHOY.lx, PUMP: TOKEN_BOARD_SPOTS.PUMP.lx, HQ: 42.5, RETARDIO: 51.5 };
export const tokenSpot = sym => TOKEN_BOARD_SPOTS[sym] || { lx: TOKEN_SLOTS[sym], lz: FACADE_LZ + .6 };
export const TRENDING = { lx0: 39.5, lx1: 54.5, y: 6.6, n: 5 };   // upstairs row on hall_e: room for the coming trending boards
export const HOUSES = [   // [v248] the plaza tavern house (lx 66-74, decor) is inside the wider FISH MARKET now
  // [v247] house_e (#10, lx 77.9) is gone: the FISH MARKET (FISH_MARKET below) fills it + the harbor tower's spot (#11)
  ];
// [v240] lx 50 (#19) removed: it stood in front of the MARKETPLACE door
// [Emerly] BANKSY 7:09 PM Nov 5: "remove these stands" / "yes remove all fruit stands" — Harbor Market Street freestanding
// canvas-awning produce stalls (5 west + 2 east). Default OFF; &plazastalls=1 restores them. Export stays an array so
// tools/plaza_blender/walk_test.js + tools/collide/sweep.js keep working.
export const STALLS = (typeof location !== 'undefined' && /[?&]plazastalls=1(?:&|$)/.test(location.search))
  ? [-50, -42, -34, -26, -18, 26, 34].map((lx, i) => ({ lx, lz: STALL_LZ, c: [0xf2efe6, 0xd8322f, 0xe9dcc0, 0x2a6df4, 0xf2efe6][i % 5] }))
  : [];
export const CARTS = [[-30, -22.5], [40, -22]], TAVERN_TABLES = [];   // [v248] dropped: the FISH MARKET fills the gap they stood in front of   // [v247] back in front of the tavern (the FISH MARKET moved to #10 / #11)   // [v240] the tavern tables made room for the FISH MARKET
// [v247] BANKSY 7:44 PM: the FISH MARKET is a walk-in shop on the row where #10 house_e (lx 74.4-81.4) + #11 the harbor tower (81.5-90.5) stood:
// lx 74.5-89.5 (0.5 m clear of the tavern), front on FACADE_LZ, ROW_D deep. The SELL FISH prompt is on the shop floor (lz -35.5, r 3).
// (v240: an open shed on the old Token Exchange + tavern-table spot, lx 64.25 lz -25.6; that spot has the tavern tables back)
export const FISH_MARKET = { lx: 73.2, lz: FACADE_LZ - ROW_D / 2, w: 32.6, d: ROW_D, promptLz: -35.5 };   // [v248] BANKSY 7:57 PM 'fill the gap': lx 56.9-89.5, from the MARKETPLACE (hall_e ends 56, plinth 56.3) to the v247 far end; absorbs the gap + the plaza tavern house (decor, #9)
export const FISH_HALL = true;   // foot.js: no harbor tower
export const MARKET_DOOR = { lx: 47, lz: FACADE_LZ - 5.5 };   // [v248] the TRADE prompt inside the hall, mid-floor (walk in)   // [v240] the MARKETPLACE prompt at the hall_e entrance
export const PLAZA_PALM_ON = !(typeof location !== 'undefined' && /[?&]plazapalm=0(&|$)/.test(location.search));   // [Emerly] &plazapalm=0 = the old blockout palms
export const PALM_SPOTS = [];   // [Emerly] [x, y, z, yaw, variant] world, filled by buildPlazaV2
export const PALMS = [[-56, -12], [-24, -9], [-3, -9], [15, -9], [44, -9], [76, -8], [92, -14], [-68, -10]];
export const LAMPS = [-54, -42, -30, -18, -4, 16, 28, 40, 52, 60, 93].map(lx => [lx, -20.4]);   // [v248] lx 64 -> 60 (clear of the wider FISH MARKET door at 73.2; on the street line like the others)   // [v247] lx 64 back (the old fish shed spot), lx 80 -> 93 (clear of the FISH MARKET door)   // [v240] lx 64 dropped: it stood in front of the FISH MARKET sign
export const CARGO = [[-34, -3.5], [-28, -4], [-20, -3.5], [-14, -4.5], [20, -3.5], [26, -4], [34, -3.5], [74, -4.5], [82, -3.5]];
export const CRANE = { lx: 40, lz: -2.2 };
export const DOCK = { deckEnd: BOARDWALK.lx0 };   // the v103 boardwalk stops where the v2 one starts (flush, same 2.95)
export const remapTokens = (list) => list.filter(t => TOKEN_SLOTS[t.sym] !== undefined).map(t => ({ ...t, ...tokenSpot(t.sym) }));
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
  storefronts: STOREFRONTS, triggers: Object.fromEntries(STOREFRONTS.filter(s => s.trigger).map(s => [s.trigger, { id: s.id, lx: s.lx, lz: s.promptLz ?? (FACADE_LZ - 5.5) }])), halls: HALLS, tokenSlots: TOKEN_SLOTS, trending: TRENDING, spawn: SPAWN,
};

// v2 ground: the shore behind the sloped boardwalk (lx -176..-55, lz -14..0) is raised to the boardwalk's height, fading into the
// beach over 8 m inland and 10 m west, so street level = boardwalk level along the whole waterfront (east of -55 the quay
// already sits at street level)
// [post-petstore] &petold=1 = the old Blender L4 house (before shots)
export const PET_REWORK = !(typeof location !== 'undefined' && /[?&]petold=1/.test(location.search));
export function plazaGround(lx, lz, h) {
  if(lx>=-47.4&&lx<=-34.4&&lz>=-57.4&&lz<=-48.0) h=Math.min(h,HQ.floor-.05);   // p8: paved yard behind the Outfit Store, level with the trench
  if(lx>=HQ.lx0-3&&lx<=HQ.lx1&&lz>=HQ.lz0-3&&lz<HQ.lz1){const o=Math.max(HQ.lx0-lx,HQ.lz0-lz,0),trench=lz<HQ_TRENCH.westLz+.2||lx>=HQ.lx0;h=Math.min(h,trench?(o<=HQ_TRENCH.w?HQ.floor-.05:h):HQ.floor-.05+(o<2?Math.ceil(o/.5)*.65:o*1.3));}   // whole footprint flat; west/back: paved trench behind a retaining wall (p3)   // [post-hq-castle] whole footprint
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
    const j = JETTIES.find(j => j.id === b.jetty), [ex, ez] = L(j.lx + b.side * JETTY.w / 2, b.lz), [nx, nz] = L(j.lx + b.side * (JETTY.w / 2 + 1), b.lz);
    return { id: b.id, x, z, edge: { x: ex, z: ez }, away: { x: nx-ex, z: nz-ez }, yaw: yawW(b.ly), len: SHIP.hullLen, beam: SHIP.beam, quay: false, ashore: { x: ax, z: az, y: b.ashore.y },
      signBollards: [L(b.ashore.lx, BERTH_SIGN_LZ + 2), L(b.ashore.lx, BERTH_SIGN_LZ + 34)],
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
  const S = STOREFRONTS.map(s => ({ key: s.id, text: s.id === 'shop_ships' ? 'SHIP SKINS' : s.id === 'shop_upgrades' ? 'SHIP UPGRADES' : s.name, col: '#ffcd77', bg: '#5a3219', skull: true }));
  S.push({ key: SHIP_STORE.id, text: 'SHIP STORE', col: '#ffcd77', bg: '#243a54', skull: true });
  S.push({ key: OUTFIT_STORE.id, text: OUTFIT_STORE.name, col: '#ffcd77', bg: '#1c2840', skull: true });   // [outfit-store] procedural fallback board
  S.push({ key: 'market', text: 'MARKETPLACE', col: '#ffcd77', bg: '#5a3219', big: true, skull: true }, { key: 'fishmarket', text: 'FISH MARKET', col: '#ffffff', bg: '#14557d', big: true }); // [v240]
  if (!ON_PORTAL && HALL_BOARDS_ON) { S.push({ key: 'tok_HQ', text: '$HQ', col: '#ffcd77', bg: '#161616', big: true }, { key: 'tok_RETARDIO', text: '$RETARDIO', col: '#ffcd77', bg: '#161616', big: true });
    for (let i = 0; i < TRENDING.n; i++) S.push({ key: 'trend' + i, text: 'TRENDING #' + (i + 1), col: '#7cff6b', bg: '#161616' }); }
  S.push({ key: 'hall', text: 'HARBOR EXCHANGE HALL', col: '#ffcd77', bg: '#5a3219' }, { key: 'tavern', text: 'THE SUNK TAVERN', col: '#ffcd77', bg: '#5a3219', skull: true });
  for (const b of BERTHS) S.push({ key: 'berth_' + b.id, text: 'BERTH ' + b.id.slice(1), col: '#fff1d2', bg: '#3d2a1c' });
  return S;
}

// builder: h = foot.js kit helpers (merged toon kit: every stone piece shares the masonry surface layer, 0 extra materials)
// [Timothy] material library (js/island/libTex.js): masonry walls = stone_ashlar (MASON 11 -> the library via look.js), quoins / lintels /
// string courses = stone_trim, timber = timber, awnings + stall canvas = awning_cloth, rope coils = rope (aMat 20 + library id)
export function buildPlazaV2(h) {
  const { k, W, box, cyl, M, at, barrel, crate, sacks, torchPost, stall, addBox, addCirc, T, F, A, low, C, yaw0, deckY } = h, Y0 = STREET_Y;   // everything stands on the slab top
  const signs = [], MASON = 11, TRIM = 22, TIMBER = 26, ROPE = 31, CLOTH = 32, STONES = [0xc9bfae, 0xb9b2a6, 0xd6c7a8, 0xa99f90], QUOIN = 0x8a837a;
  const sign = (key, w, hh, lx, y, lz, ly = 0) => { const [x, z] = T(lx, lz); signs.push([key, w, hh, M(x, y, z, yaw0 + ly)]); };
  const cz = FACADE_LZ - ROW_D / 2;
  // ---- stone building (front = local +z = the street): plinth, ashlar storeys + string courses, quoins, stone-framed windows
  // with timber shutters, ground-floor shop arch, timber balcony + beams, tile roof, stone gables + chimney ----
  function stoneHouse(lx, w, fl, v, o = {}) {
    const [x, z] = T(lx, cz); if (!o.hollow) addBox(x, z, w + 0.6, ROW_D + 0.6, yaw0);   // [v250] hollow = walk-in (caller adds wall colliders)
    at(lx, cz, 0, () => {
      const d = ROW_D, fh = 3.5, col = STONES[v % 4], sh = C.SHUTTER[(v + 2) % C.SHUTTER.length];
      if (!o.openGround) W(k, box(w + 0.6, 0.7, d + 0.6), QUOIN, TRIM, M(0, 0.15, 0));
      else W(k, box(w, .08, d), QUOIN, TRIM, M(0, .02, 0), false);
      for (let f = 0; f < fl; f++) { const y0 = 0.5 + f * fh;
        if (f === 0 && o.openGround) {
          const t = .5, door = Math.min(w * .66, w - 2.6), pier = (w - door) / 2;
          W(k, box(w, fh, t), col, MASON, M(0, y0 + fh / 2, -d / 2 + t / 2));
          for (const sx of [-1, 1]) {
            W(k, box(t, fh, d), col, MASON, M(sx * (w / 2 - t / 2), y0 + fh / 2, 0));
            W(k, box(pier, fh, t), col, MASON, M(sx * (door / 2 + pier / 2), y0 + fh / 2, d / 2 - t / 2));
          }
        } else W(k, box(w, fh, d), col, MASON, M(0, y0 + fh / 2, 0));
        W(k, box(w + 0.36, 0.3, d + 0.36), QUOIN, TRIM, M(0, y0 + fh, 0), false);                       // string course
        for (const sx of [-1, 1]) for (let q = 0; q < (low ? 1 : 3); q++) W(k, box(0.8, low ? fh : 0.9, 0.8), QUOIN, TRIM, M(sx * (w / 2 - 0.3), y0 + (low ? fh / 2 : 0.55 + q * 1.15), d / 2 - 0.3), false); // quoins
        const nw = Math.max(1, Math.floor(w / 3.2));
        for (let i = 0; i < nw; i++) { const wx = (i - (nw - 1) / 2) * (w / nw);
          if (f === 0 && o.shop) continue;
          W(k, box(1.1, 1.6, 0.12), 0x2b3d4a, 0, M(wx, y0 + 1.9, d / 2 + 0.02), false);                   // window
          W(k, box(1.6, 0.32, 0.3), QUOIN, TRIM, M(wx, y0 + 2.85, d / 2 + 0.1), false);                  // lintel
          W(k, box(1.5, 0.18, 0.4), QUOIN, TRIM, M(wx, y0 + 1.05, d / 2 + 0.15), false);                 // sill
          if (!low || i % 2 === 0) for (const s of [-1, 1]) W(k, box(0.58, 1.6, 0.08), sh, TIMBER, M(wx + s * 0.88, y0 + 1.9, d / 2 + 0.22, s * 0.45), false); }
        if (f > 0 && (f === 1 || !low)) { W(k, box(w - 0.8, 0.22, 1.4), C.WOOD, TIMBER, M(0, y0 + 0.1, d / 2 + 0.7));   // timber balcony
          W(k, box(w - 0.8, 0.12, 0.12), C.WOOD_D, TIMBER, M(0, y0 + 1.15, d / 2 + 1.35), false);
          for (let b = -(w - 0.8) / 2; b <= (w - 0.8) / 2 + 0.01; b += low ? 1.2 : 0.5) W(k, box(0.09, 1.0, 0.09), C.WOOD_L, TIMBER, M(b, y0 + 0.65, d / 2 + 1.35), false);
          for (const sx of [-1, 1]) W(k, box(0.2, 0.9, 0.2), C.WOOD_D, TIMBER, M(sx * (w / 2 - 0.8), y0 - 0.3, d / 2 + 0.55, 0, 0.75), false); }
      }
      if (o.shop) { if (!o.openGround) W(k, box(w * 0.62, 2.9, 0.14), 0x2a1d14, 0, M(0, 1.95, d / 2 + 0.02), false);          // shop opening + arch
        W(k, box(w * 0.62 + 0.8, 0.5, 0.4), QUOIN, TRIM, M(0, 3.6, d / 2 + 0.15), false); for (const sx of [-1, 1]) W(k, box(0.5, 3.1, 0.4), QUOIN, TRIM, M(sx * (w * 0.31 + 0.2), 2.05, d / 2 + 0.15), false); }
      const top = 0.5 + fl * fh; W(k, box(w + 0.2, 0.3, 0.3), C.WOOD_D, TIMBER, M(0, top - 0.2, d / 2 + 0.25), false);   // eave beam
      const pitch = 0.55, half = d / 2 + 0.8, slab = half / Math.cos(pitch), rise = Math.tan(pitch) * half;
      for (const s of [-1, 1]) W(k, box(w + 1.0, 0.32, slab), C.ROOFS[v % 4], 4, M(0, top + rise / 2, s * half / 2, 0, s * pitch));
      W(k, cyl(0.26, 0.26, w + 1.1, 6), C.ROOFS[(v + 1) % 4], 4, M(0, top + rise + 0.05, 0, 0, 0, Math.PI / 2), false);
      const gable = new THREE.BufferGeometry(); gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -d / 2, 0, 0, d / 2, 0, rise - 0.15, 0], 3)); gable.computeVertexNormals();
      for (const sx of [-1, 1]) { const g = gable.clone(); if (sx < 0) g.scale(-1, 1, 1); W(k, g, col, MASON, M(sx * (w / 2 + 0.01), top, 0, sx > 0 ? 0 : Math.PI), false); }
      W(k, box(1.0, 2.6, 1.0), QUOIN, TRIM, M(w * 0.3, top + rise * 0.6 + 1.0, -d * 0.2));
    }, Y0);
  }
  // carved hanging sign on an iron bracket, perpendicular to the facade (reads down the street both ways) + facade board
  const hanging = (key, lx, w) => { at(lx + w / 2 - 1.1, FACADE_LZ, 0, () => { W(k, box(0.12, 0.12, 2.2), C.IRON, 0, M(0, 5.6, 1.1), false); W(k, box(0.08, 0.6, 0.08), C.IRON, 0, M(0, 5.3, 0.3, 0, 0.8), false);
      for (const sz of [0.9, 2.0]) W(k, box(0.04, 0.35, 0.04), C.IRON, 0, M(0, 5.4, sz), false); W(k, box(0.16, 1.45, 2.7), C.WOOD_D, TIMBER, M(0, 4.5, 1.45)); }, Y0);
    sign(key, 2.5, 1.3, lx + w / 2 - 1.1 + 0.09, Y0 + 4.5, FACADE_LZ + 1.45, Math.PI / 2); sign(key, 2.5, 1.3, lx + w / 2 - 1.1 - 0.09, Y0 + 4.5, FACADE_LZ + 1.45, -Math.PI / 2); };

  // [v248] MARKETPLACE walk-in (BANKSY 7:58 PM "add inside to marketplace so walk in to trade"): the hall's ground floor is a hollow shell
  // (back + side walls, front piers either side of the 3.4 m doorway, a flagstone floor at street height, the upper storey's underside as
  // the ceiling) with trading stalls inside: rug-draped counters down both side walls, a long back counter with chests, cloth bolts, pots
  // and gold, hanging rugs + lanterns. The TRADE prompt is on the floor in the middle (MARKET_DOOR), not on the doorstep.
  function marketInside(hl) {
    const w = hl.w, d = ROW_D, hw = w / 2, hd = d / 2, t = 0.5, G = 4.9, DOOR = 3.4, pier = hw - DOOR / 2, px = DOOR / 2 + pier / 2, col = 0xa99f90, RUGS = [0x9b2335, 0x1f6f8b, 0x6a4fb3, 0xc98a1b];
    at(hl.lx, cz, 0, () => {
      W(k, box(w - 0.4, 0.06, d - 0.4), 0xb9b2a6, TRIM, M(0, 0.03, 0));                                                     // flagstone floor
      W(k, box(w + 0.6, 0.7, t + 0.6), QUOIN, TRIM, M(0, 0.15, -hd + t / 2)); for (const sx of [-1, 1]) { W(k, box(t + 0.6, 0.7, d + 0.6), QUOIN, TRIM, M(sx * (hw - t / 2), 0.15, 0)); W(k, box(pier + 0.3, 0.7, t + 0.6), QUOIN, TRIM, M(sx * px, 0.15, hd - t / 2)); }
      W(k, box(w, G - 0.5, t), col, MASON, M(0, 0.5 + (G - 0.5) / 2, -hd + t / 2)); for (const sx of [-1, 1]) { W(k, box(t, G - 0.5, d), col, MASON, M(sx * (hw - t / 2), 0.5 + (G - 0.5) / 2, 0)); W(k, box(pier, G - 0.5, t), col, MASON, M(sx * px, 0.5 + (G - 0.5) / 2, hd - t / 2)); }
      W(k, box(DOOR, G - 4.0, t), col, MASON, M(0, 4.0 + (G - 4.0) / 2, hd - t / 2)); W(k, box(w - 0.6, 0.1, d - 0.6), C.WOOD_D, TIMBER, M(0, G - 0.06, 0), false);   // over the door + the timber ceiling
      // side stalls: rug-draped counters with goods, a hanging rug behind each
      for (const sx of [-1, 1]) for (const zz of [-2.6, 1.4]) { const x = sx * (hw - t - 1.0), r = RUGS[(zz > 0 ? 1 : 0) + (sx > 0 ? 2 : 0)];
        W(k, box(1.3, 0.9, 3.0), C.WOOD, TIMBER, M(x, 0.45, zz)); W(k, box(1.5, 0.1, 3.2), r, CLOTH, M(x, 0.95, zz), false);
        W(k, box(0.06, 2.4, 2.6), r, CLOTH, M(sx * (hw - t - 0.03), 2.6, zz), false);
        W(k, box(0.7, 0.42, 0.45), C.WOOD_D, TIMBER, M(x, 1.21, zz - 0.8)); W(k, box(0.74, 0.07, 0.49), C.GOLD, 0, M(x, 1.38, zz - 0.8), false);
        for (let i = 0; i < 3; i++) W(k, cyl(0.16, 0.2, 0.42, 10), [0xb5653a, 0x8a5a2b, 0xc98a1b][i], 0, M(x, 1.21, zz + 0.2 + i * 0.36), false);
        W(k, new THREE.ConeGeometry(0.26, 0.24, 8), C.GOLD, 0, M(x + sx * -0.3, 1.12, zz + 1.25), false); }
      // the back counter: chests, cloth bolts, bottles, gold
      W(k, box(w - 8, 0.95, 1.3), C.WOOD, TIMBER, M(0, 0.48, -hd + t + 1.1)); W(k, box(w - 7.8, 0.1, 1.5), 0x9b2335, CLOTH, M(0, 1.0, -hd + t + 1.1), false);
      for (let x = -hw + 5, i = 0; x <= hw - 5; x += 2.2, i++) { if (i % 2) { W(k, box(0.7, 0.42, 0.45), C.WOOD_D, TIMBER, M(x, 1.26, -hd + t + 1.0)); W(k, box(0.74, 0.07, 0.49), C.GOLD, 0, M(x, 1.43, -hd + t + 1.0), false); }
        else for (let j = 0; j < 2; j++) W(k, cyl(0.15, 0.15, 1.1, 10), RUGS[(i + j) % 4], CLOTH, M(x, 1.2 + j * 0.28, -hd + t + 1.1, 0, 0, Math.PI / 2), false); }
      for (let x = -hw + 4, i = 0; x <= hw - 4; x += 3.3, i++) W(k, box(2.2, 2.2, 0.05), RUGS[i % 4], CLOTH, M(x, 2.9, -hd + t + 0.03), false);   // rugs on the back wall
      for (const x of [-hw / 2, 0, hw / 2]) { W(k, cyl(0.02, 0.02, 0.8, 3), C.IRON, 0, M(x, G - 0.5, -0.5), false); W(k, box(0.34, 0.46, 0.34), 0xffd27a, 0, M(x, G - 1.1, -0.5), false); }   // hanging lanterns
    }, Y0);
    const B = (lx, lz, a, b) => addBox(...T(hl.lx + lx, cz + lz), a, b, yaw0);
    B(0, -hd + t / 2, w + 0.6, t + 0.6); for (const sx of [-1, 1]) { B(sx * (hw - t / 2), 0, t + 0.6, d + 0.6); B(sx * px, hd - t / 2, pier + 0.3, t + 0.6); for (const zz of [-2.6, 1.4]) B(sx * (hw - t - 1.0), zz, 1.5, 3.2); }
    B(0, -hd + t + 1.1, w - 7.6, 1.6);
  }
  // [v240] THE MARKETPLACE (BANKSY 6:19 PM): the Harbor Exchange Hall (hall_e) is the player market. Stone-framed entrance with open
  // doors + an amber awning, a big MARKETPLACE board upstairs where the TRENDING row was, a hanging bracket sign down the street, and goods
  // walls + tables (rugs, cloth bolts, chests, pots, bottles, gold) where the $HQ / $RETARDIO posters stood. Library materials only.
  function marketHall(hl) {
    const AMBER = 0xa77a12, RUGS = [0x9b2335, 0x1f6f8b, 0x6a4fb3, 0xc98a1b];
    at(hl.lx, FACADE_LZ, 0, () => {
      W(k, box(4.3, 0.55, 0.45), QUOIN, TRIM, M(0, 4.25, 0.18)); for (const sx of [-1, 1]) W(k, box(0.5, 3.75, 0.45), QUOIN, TRIM, M(sx * 1.95, 2.35, 0.18));
      for (const sx of [-1, 1]) W(k, box(0.1, 3.3, 1.6), C.WOOD_D, TIMBER, M(sx * 1.6, 2.15, 0.85, sx * 0.35), false);   // open door leaves
      W(k, box(4.8, 0.24, 1.1), QUOIN, TRIM, M(0, 0.12, 0.55));                                                 // door step
      W(k, box(5.4, 0.1, 2.0), AMBER, CLOTH, M(0, 4.75, 1.0, 0, 0.26)); for (let i = 0; i < 6; i++) W(k, box(0.86, 0.4, 0.06), i % 2 ? 0xf2efe6 : AMBER, CLOTH, M(-2.25 + i * 0.9, 4.32, 1.98), false);
      W(k, box(12.0, 3.1, 0.24), C.WOOD_D, TIMBER, M(0, 6.9, 0.12)); W(k, box(12.4, 0.2, 0.34), C.GOLD, 0, M(0, 8.5, 0.14), false); W(k, box(12.4, 0.2, 0.34), C.GOLD, 0, M(0, 5.3, 0.14), false); // the big board
      for (const sx of [-1, 1]) { const gx = sx * 4.7;                                                          // goods walls (old poster slots)
        W(k, box(3.9, 3.3, 0.16), C.WOOD_D, TIMBER, M(gx, 2.55, 0.1)); for (let r = 0; r < 3; r++) W(k, box(1.1, 2.6, 0.05), RUGS[(r + (sx > 0 ? 1 : 0)) % 4], CLOTH, M(gx - 1.25 + r * 1.25, 2.75, 0.2), false);
        for (let r = 0; r < 3; r++) for (const y of [1.9, 3.3]) W(k, box(1.1, 0.12, 0.05), 0xf2efe6, CLOTH, M(gx - 1.25 + r * 1.25, y, 0.23), false);   // rug bands
        // goods table: cloth-covered counter + chests, pots, cloth bolts, bottles, a gold pile
        W(k, box(3.4, 0.9, 1.3), C.WOOD, TIMBER, M(gx, 0.45, 2.1)); W(k, box(3.6, 0.1, 1.5), sx < 0 ? 0x9b2335 : 0x1f6f8b, CLOTH, M(gx, 0.95, 2.1), false);
        for (const cx of [-1.1, 0.9]) { W(k, box(0.7, 0.42, 0.45), C.WOOD_D, TIMBER, M(gx + cx, 1.21, 1.9)); W(k, box(0.74, 0.07, 0.49), C.GOLD, 0, M(gx + cx, 1.38, 1.9), false); }
        for (let i = 0; i < 3; i++) W(k, cyl(0.16, 0.2, 0.42, 10), [0xb5653a, 0x8a5a2b, 0xc98a1b][i], 0, M(gx - 0.2 + i * 0.32, 1.21, 2.45), false);   // clay pots
        for (let i = 0; i < 2; i++) W(k, cyl(0.15, 0.15, 1.1, 10), RUGS[(i + 2) % 4], CLOTH, M(gx + 0.1, 1.15 + i * 0.28, 1.7, 0, 0, Math.PI / 2), false);   // cloth bolts
        for (let i = 0; i < 4; i++) W(k, cyl(0.06, 0.07, 0.34, 6), 0x2f6b3a, 0, M(gx + 1.35, 1.17, 2.0 + i * 0.16), false);   // bottles
        W(k, new THREE.ConeGeometry(0.3, 0.26, 8), C.GOLD, 0, M(gx + 0.4, 1.13, 2.55), false); }
    }, Y0);
    sign('market', 11.2, 2.8, hl.lx, Y0 + 6.9, FACADE_LZ + 0.25);
    hanging('market', hl.lx, hl.w);
    for (const sx of [-1, 1]) addBox(...T(hl.lx + sx * 4.7, FACADE_LZ + 2.1), 3.7, 1.6, yaw0);
  }
  // [v247] THE FISH MARKET (BANKSY 7:44 PM "replace building 10 and 11 with fish market, keep in line with the other shops"): one walk-in
  // stone shop on the shop row where #10 (house_e) + #11 (the harbor tower) stood. Same frontage (FACADE_LZ), depth (ROW_D) and style as
  // the row (plinth, ashlar, quoins, string course, balcony, tile roof + gables), a wide open door under a blue + white awning, the big
  // FISH MARKET board upstairs + a hanging bracket sign; inside: the fish counter on crushed ice along the back, a brass scale, price
  // slates, a back bench with nets, iced crates by the walls. The SELL FISH prompt is on the shop floor (walk in, then sell).
  function fishHall() {
    const F0 = FISH_MARKET, w = F0.w, d = ROW_D, hw = w / 2, hd = d / 2, G = 4.6, fh = 3.5, top = G + fh, col = STONES[1], DOOR = 4.4, t = 0.5;
    const BLUE = 0x1d7fb8, WHITE = 0xf2efe6, ICE = [0xdff1fa, 0xc6e4f2, 0xf4fbff], BRASS = 0xc9a03a, FISHC = [0xb8c4cc, 0x6f8fa8, 0xe8795a, 0xe8b13a, 0xd8433a, 0x7f9f5a, 0x9aa9b4];
    const pier = (hw - DOOR / 2), px = DOOR / 2 + pier / 2, CL = Math.min(w - 6, 26), CH = CL / 2;
    at(F0.lx, cz, 0, () => {
      W(k, box(w - 0.4, 0.06, d - 0.4), 0xb9b2a6, TRIM, M(0, 0.03, 0));                                                     // flagstone floor (walk height = street)
      W(k, box(w + 0.6, 0.7, t + 0.6), QUOIN, TRIM, M(0, 0.15, -hd + t / 2)); for (const sx of [-1, 1]) W(k, box(t + 0.6, 0.7, d + 0.6), QUOIN, TRIM, M(sx * (hw - t / 2), 0.15, 0));   // plinth under the walls
      for (const sx of [-1, 1]) W(k, box(pier + 0.3, 0.7, t + 0.6), QUOIN, TRIM, M(sx * px, 0.15, hd - t / 2));
      W(k, box(w, G, t), col, MASON, M(0, G / 2, -hd + t / 2)); for (const sx of [-1, 1]) W(k, box(t, G, d), col, MASON, M(sx * (hw - t / 2), G / 2, 0));        // ground-floor shell
      for (const sx of [-1, 1]) W(k, box(pier, G, t), col, MASON, M(sx * px, G / 2, hd - t / 2));
      W(k, box(DOOR, G - 3.6, t), col, MASON, M(0, 3.6 + (G - 3.6) / 2, hd - t / 2));
      W(k, box(DOOR + 0.8, 0.5, 0.4), QUOIN, TRIM, M(0, 3.75, hd + 0.15), false); for (const sx of [-1, 1]) W(k, box(0.5, 3.6, 0.4), QUOIN, TRIM, M(sx * (DOOR / 2 + 0.2), 1.8, hd + 0.15), false);   // door frame
      for (const sx of [-1, 1]) for (let wx0 = DOOR / 2 + 2.4; wx0 < hw - 1.4; wx0 += 4.2) { const wx = sx * wx0; W(k, box(2.4, 1.7, 0.12), 0x2b3d4a, 0, M(wx, 2.2, hd + 0.02), false); W(k, box(2.9, 0.32, 0.3), QUOIN, TRIM, M(wx, 3.2, hd + 0.1), false); W(k, box(2.8, 0.18, 0.4), QUOIN, TRIM, M(wx, 1.3, hd + 0.15), false); }   // shop windows
      W(k, box(w + 0.36, 0.3, d + 0.36), QUOIN, TRIM, M(0, G, 0), false);                                                    // string course
      W(k, box(w, fh, d), col, MASON, M(0, G + fh / 2, 0)); W(k, box(w - 0.6, 0.1, d - 0.6), C.WOOD_D, TIMBER, M(0, G - 0.06, 0), false);   // upper storey (its underside = the shop ceiling, timber)
      for (const sx of [-1, 1]) for (let q = 0; q < (low ? 2 : 6); q++) W(k, box(0.8, low ? 3.8 : 0.9, 0.8), QUOIN, TRIM, M(sx * (hw - 0.3), low ? 1.9 + q * 4 : 0.55 + q * 1.3, hd - 0.3), false);   // quoins
      for (const sx of [-1, 1]) for (let wx0 = 5.4; wx0 < hw - 1.0; wx0 += 3.4) { const wx = sx * wx0; W(k, box(1.1, 1.6, 0.12), 0x2b3d4a, 0, M(wx, G + 1.9, hd + 0.02), false); W(k, box(1.6, 0.32, 0.3), QUOIN, TRIM, M(wx, G + 2.85, hd + 0.1), false);
        for (const s of [-1, 1]) W(k, box(0.58, 1.6, 0.08), C.SHUTTER[1], TIMBER, M(wx + s * 0.88, G + 1.9, hd + 0.22, s * 0.45), false); }
      W(k, box(8.8, 2.5, 0.22), C.WOOD_D, TIMBER, M(0, G + 1.75, hd + 0.12)); W(k, box(9.0, 0.16, 0.3), BLUE, 0, M(0, G + 3.02, hd + 0.14), false); W(k, box(9.0, 0.16, 0.3), BLUE, 0, M(0, G + 0.48, hd + 0.14), false);   // the big board
      W(k, box(w + 0.2, 0.3, 0.3), C.WOOD_D, TIMBER, M(0, top - 0.2, hd + 0.25), false);                                    // eave beam
      const pitch = 0.55, half = hd + 0.8, slab = half / Math.cos(pitch), rise = Math.tan(pitch) * half;
      for (const s of [-1, 1]) W(k, box(w + 1.0, 0.32, slab), C.ROOFS[2], 4, M(0, top + rise / 2, s * half / 2, 0, s * pitch));
      W(k, cyl(0.26, 0.26, w + 1.1, 6), C.ROOFS[3], 4, M(0, top + rise + 0.05, 0, 0, 0, Math.PI / 2), false);
      const gable = new THREE.BufferGeometry(); gable.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -hd, 0, 0, hd, 0, rise - 0.15, 0], 3)); gable.computeVertexNormals();
      for (const sx of [-1, 1]) { const g = gable.clone(); if (sx < 0) g.scale(-1, 1, 1); W(k, g, col, MASON, M(sx * (hw + 0.01), top, 0, sx > 0 ? 0 : Math.PI), false); }
      W(k, box(1.0, 2.6, 1.0), QUOIN, TRIM, M(w * 0.3, top + rise * 0.6 + 1.0, -d * 0.2));                                  // chimney
      // the blue + white awning over the door + the shop windows
      { const aw = Math.min(w * 0.8, w - 2); W(k, box(aw, 0.1, 2.2), BLUE, CLOTH, M(0, 4.05, hd + 1.0, 0, 0.26)); const na = Math.round(aw / 1.2); for (let i = 0; i < na; i++) W(k, box(aw / na - 0.04, 0.42, 0.06), i % 2 ? WHITE : BLUE, CLOTH, M(-aw / 2 + (i + 0.5) * aw / na, 3.62, hd + 2.08), false); }
      // inside: the counter + the ice bed (tilted to the door) + the catch
      const cz2 = -hd + 2.3;
      W(k, box(CL, 1.0, 1.3), C.WOOD, TIMBER, M(0, 0.5, cz2)); W(k, box(CL + 0.3, 0.12, 1.5), C.WOOD_L, TIMBER, M(0, 1.06, cz2), false);
      W(k, box(CL - 0.3, 0.2, 1.25), ICE[1], 0, M(0, 1.24, cz2, 0, 0.18), false);
      const nIce = Math.round((low ? 2 : 4.5) * CL); for (let i = 0; i < nIce; i++) { const tt = (i * 0.6180339) % 1, u = (i * 0.3819660 + 0.17) % 1;
        W(k, new THREE.IcosahedronGeometry(0.09 + (i % 3) * 0.03, 0), ICE[i % 3], 0, M(-CH + 0.3 + tt * (CL - 0.6), 1.36 - (u - 0.5) * 0.22, cz2 - 0.55 + u * 1.1, i), false); }
      const step = low ? 0.75 : 0.52; let n = 0; for (let x = -CH + 0.5; x <= CH - 0.5; x += step) for (const row of [0, 1]) { const c = FISHC[(n++ * 3 + row) % FISHC.length], L = 0.34 + ((n * 7) % 5) * 0.04;
        const zz = cz2 - 0.35 + row * 0.62, yy = 1.43 - (row - 0.5) * 0.12 + 0.02, rot = (row ? 0.25 : -0.2) + ((n % 3) - 1) * 0.12;
        k.at(M(x + row * 0.2, yy, zz, rot, 0.18), () => { W(k, new THREE.SphereGeometry(1, 10, 6), c, 0, M(0, 0, 0, 0, 0, 0, [L, L * 0.3, L * 0.36]), false);
          W(k, new THREE.ConeGeometry(0.15, 0.24, 4), c, 0, M(-L - 0.08, 0, 0, 0, 0, Math.PI / 2, [1, 1, 0.35]), false);
          W(k, new THREE.SphereGeometry(0.035, 5, 4), 0x161616, 0, M(L * 0.7, 0.03, L * 0.3), false); }); }
      for (let x = -CH + 1.5; x <= CH - 1.4; x += 3.8) { W(k, box(0.05, 0.5, 0.05), C.WOOD_D, TIMBER, M(x, 1.55, cz2 + 0.68), false); W(k, box(0.62, 0.4, 0.05), 0x2b2b2b, 0, M(x, 1.9, cz2 + 0.7), false); W(k, box(0.66, 0.05, 0.06), C.WOOD_L, TIMBER, M(x, 2.12, cz2 + 0.7), false); }   // price slates
      { const sx = 1.9, sz = cz2 + 0.2; W(k, cyl(0.025, 0.025, 1.6, 4), C.IRON, 0, M(sx, G - 0.85, sz), false); W(k, box(1.0, 0.07, 0.07), BRASS, 0, M(sx, 2.75, sz), false);   // the hanging scale off the ceiling
        for (const p of [-0.45, 0.45]) { W(k, cyl(0.012, 0.012, 0.42, 3), C.IRON, 0, M(sx + p, 2.53, sz), false); W(k, cyl(0.24, 0.17, 0.07, 12), BRASS, 0, M(sx + p, 2.31, sz), false); }
        W(k, new THREE.SphereGeometry(1, 10, 6), FISHC[3], 0, M(sx - 0.45, 2.41, sz, 0.3, 0, 0, [0.22, 0.07, 0.08]), false); }
      W(k, box(CL, 0.9, 0.8), C.WOOD_D, TIMBER, M(0, 0.45, -hd + t + 0.45)); W(k, box(CL + 0.2, 0.1, 0.9), C.WOOD_L, TIMBER, M(0, 0.95, -hd + t + 0.45), false);   // back bench
      for (let x = -CH + 1.5; x <= CH - 1; x += 3.3) W(k, cyl(0.26, 0.22, 0.42, 10), C.WOOD_L, TIMBER, M(x, 1.21, -hd + t + 0.45), false);
      for (let x = -CH + 3, i = 0; x <= CH - 2; x += 6.5, i++) W(k, box(i % 2 ? 4.0 : 5.0, i % 2 ? 1.2 : 1.4, 0.05), i % 2 ? 0xc9b38a : 0xd9c39a, ROPE, M(x, 2.6, -hd + t + 0.03), false);   // nets on the back wall
      for (const sx of [-1, 1]) for (const zz of [-1.2, 1.6]) { W(k, box(0.9, 0.8, 0.9), C.WOOD, TIMBER, M(sx * (hw - t - 0.6), 0.4, zz)); W(k, box(0.82, 0.08, 0.82), ICE[0], 0, M(sx * (hw - t - 0.6), 0.84, zz), false);   // iced crates by the walls
        for (let f = 0; f < 3; f++) W(k, new THREE.SphereGeometry(1, 8, 5), FISHC[(f + zz > 0) % FISHC.length], 0, M(sx * (hw - t - 0.6) - 0.22 + f * 0.22, 0.92, zz, 1.4 + f * 0.2, 0, 0, [0.3, 0.07, 0.09]), false); }
      for (const sx of [-1, 1]) for (const lzz of [-0.5]) { W(k, box(0.3, 0.42, 0.3), 0xffd27a, 0, M(sx * (hw - t - 0.2), 3.0, lzz), false); W(k, box(0.38, 0.08, 0.38), C.IRON, 0, M(sx * (hw - t - 0.2), 3.25, lzz), false); }   // wall lanterns
    }, Y0);
    sign('fishmarket', 8.3, 2.1, F0.lx, Y0 + G + 1.75, FACADE_LZ + 0.24); hanging('fishmarket', F0.lx, w);
    // colliders: the walls (door gap 4.4 m), the counter, the back bench, the crates
    const box2 = (lx, lz, a, b) => addBox(...T(F0.lx + lx, cz + lz), a, b, yaw0);
    box2(0, -hd + t / 2, w + 0.6, t + 0.6); for (const sx of [-1, 1]) { box2(sx * (hw - t / 2), 0, t + 0.6, d + 0.6); box2(sx * px, hd - t / 2, pier + 0.3, t + 0.6); }
    box2(0, -hd + 2.3, CL + 0.4, 1.6); box2(0, -hd + t + 0.45, CL + 0.3, 1.0); for (const sx of [-1, 1]) for (const zz of [-1.2, 1.6]) box2(sx * (hw - t - 0.6), zz, 1.0, 1.0);
  }
  // [v250] walk-in storefront colliders: walls + door gap (match Blender arch ow), no solid footprint — same pattern as fishHall / marketInside
  function shopWalkInCols(s) {
    for (const [lx, lz, a, b] of walkInWalls(s)) addBox(...T(lx, lz), a, b, yaw0);
  }
  // [outfit-store] Clothes + Accessories: one Blender building (GLB node 'shop_clothes') on both former plots, two arches, a middle wall
  // with an archway; both counters' colliders + the props ride in the GLB extras (building frame, relative to OUTFIT_STORE.lx).
  // Shared materials only: no lights, textures, canvases or extra WebGL contexts.
  // [clothes-aaa] one indoor camera box (town-local room box -> foot-world frame)
  function camRoom(R, ceil, base = Y0) { const mx = (R.lx0 + R.lx1) / 2, mz = (R.lz0 + R.lz1) / 2, [x, z] = T(mx, mz), [ex, ez] = T(mx + 1, mz), [fx, fz] = T(mx, mz + 1);
    CAM_ROOMS.push({ id: R.id, x, z, ux: ex - x, uz: ez - z, vx: fx - x, vz: fz - z, hw: (R.lx1 - R.lx0) / 2, hd: (R.lz1 - R.lz0) / 2, y0: base, ceil: base + ceil }); }
  function outfitStore() {
    const S = OUTFIT_STORE, glb = SHOPS_KIT && SHOPS_KIT.shops.shop_clothes;
    if (glb) {
      { const [x, z] = T(S.lx, cz); SHOP_PLACES.push({ id: 'shop_clothes', m: M(x, Y0, z, yaw0) }); }
      for (const [lx, lz, a, b] of outfitWalls()) addBox(...T(lx, lz), a, b, yaw0);
      for (const c of glb.colliders) { const [x, z] = T(S.lx + c[1], cz + c[2]); if (c[0] === 'c') addCirc(x, z, c[3]); else addBox(x, z, c[3], c[4], yaw0 + (c[5] || 0)); }
      for (const R of outfitRooms()) camRoom(R, S.ceil);
    } else {   // &shopsglb=0 / GLB failed: the plain 12 m house on the same footprint, one wide door (both prompts r 3.4 reach inside)
      stoneHouse(S.lx, S.w, 3, 0, { shop: true, hollow: true, openGround: true });
      shopWalkInCols({ lx: S.lx, w: S.w });
      sign(S.id, S.w * 0.62, 0.85, S.lx, Y0 + 4.35, FACADE_LZ + 0.52);
    }
  }
  SHOP_PLACES.length = 0; CAM_ROOMS.length = 0;
  // Use the EXACT shared W/box/M stone kit and masonry/trim/tile library layers as stoneHouse.
  for(const p of [...hqParts(),...(PET_REWORK?petShellParts():[])]) { if((low&&p.detail)||p.glow)continue; // glow flames: render.js buildHQ (unlit, near only)
    const [x,z]=T(p.x,p.z); let geo;
    if(p.kind==='gable'){geo=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(gableVertices(p),3));geo.computeVertexNormals();}
    else if(p.kind==='cyl'){const n=low?Math.max(8,p.n>>1):p.n;geo=p.half?new THREE.CylinderGeometry(p.r,p.r1,p.h,Math.max(4,n>>1),1,false,-Math.PI/2,Math.PI):cyl(p.r,p.r1,p.h,n);}else geo=box(p.w,p.h,p.d);   // half: exterior half-drum (towers)
    W(k,geo,Number(p.c.replace('#','0x')),p.mat||0,M(x,p.y,z,yaw0+(p.ry||0),p.rx||0,p.rz||0),false); }
  // [post-hq-castle] one floor over the WHOLE footprint (the old rear mass is gone), the back dais (0.4 m: a step), and the
  // Hill Street door threshold, which meets the street flush (street H at lz -48 is ~2.7 = HQ.floor)
  h.addDeck?.({x:T(-18.5,-47.5)[0],z:T(-18.5,-47.5)[1],hw:14.2,hl:17.2,yaw:yaw0,y:HQ.floor});
  { const D=HQ.dais, c=T(-18.5,(D.lz0+D.lz1)/2); h.addDeck?.({x:c[0],z:c[1],hw:13.8,hl:(D.lz1-D.lz0)/2,yaw:yaw0,y:HQ.floor+D.rise}); }
  { const c=T(HQ.hillDoor.lx,HQ.hillDoor.lz); h.addDeck?.({x:c[0],z:c[1],hw:1.2,hl:HQ.hillDoor.w/2,yaw:yaw0,y:HQ.floor}); }
  // Collision exists even before the interactive canvases load.
  for (const [lx,lz,w,d] of HQ_WALLS) addBox(...T(lx,lz),w,d,yaw0);
  for (const [lx,lz,w,d] of HQ_OUTWORKS) addBox(...T(lx,lz),w,d,yaw0);   // p3 trench retaining walls
  addBox(...T(-41.05,-57.2),14.1,1.2,yaw0);   // p9 yard retaining kerb
  camRoom({ id: HQ.id, lx0: HQ.lx0+.8, lx1: HQ.lx1-.8, lz0: HQ.lz0+.8, lz1: HQ.lz1-.5 }, HQ.ceil-.4, HQ.floor);
  if(PET_REWORK){ const S=PET_STORE, I=S.I, c=T((I.lx0+I.lx1)/2,(I.lz0+I.lz1)/2); h.addDeck?.({x:c[0],z:c[1],hw:(I.lx1-I.lx0)/2+.25,hl:(I.lz1-I.lz0)/2,yaw:yaw0,y:S.floor});   // [post-petstore] flat floor + threshold
    for (const [lx,lz,w,d] of PET_WALLS) addBox(...T(lx,lz),w,d,yaw0); for (const [,lx,lz,w,d] of PET_PROPS) addBox(...T(lx,lz),w,d,yaw0);
    camRoom({id:PET_SHOP.id,...I},S.ceil-.4,S.floor); }
  else camRoom({id:PET_SHOP.id,...PET_LOT.interior},4.1,petFloor(PET_LOT.lz));
  SHIP_STORE_PLACES.length = 0;
  // [ship-aaa] the Blender SHIP STORE hall when it loaded, else Emerly's procedural shell; the keepers stand behind the counters either way
  buildShipStore(h, { stoneHouse, shopWalkInCols, sign, glb: SHOPS_KIT && SHOPS_KIT.shops.ship_store, room: camRoom,
    place: (lx, lz) => { const [x, z] = T(lx, lz); SHOP_PLACES.push({ id: SHIP_STORE.id, m: M(x, Y0, z, yaw0) }); } });
  { const [x, z] = T(SHIP_STORE.lx, SHIP_STORE.lz); SHIP_STORE_PLACES.push(M(x, Y0, z, yaw0)); }
  outfitStore();
  for (const s of STOREFRONTS) {
    if (s.id === 'shop_ships' || s.id === 'shop_upgrades') continue; // combined shell above, never attach old baked storefronts
    if (s.part === OUTFIT_STORE.id) continue; // [outfit-store] both areas live in the one building above (outfitStore)
    const glb = SHOPS_KIT && SHOPS_KIT.shops[s.id];
    if (glb) {   // [v250] Blender model already has open arch + interior; hollow walls + prop / awning-post colliders (no solid footprint)
      { const [x, z] = T(s.lx, cz); if (!s.walkIn) addBox(x, z, s.w + 0.6, ROW_D + 0.6, yaw0); SHOP_PLACES.push({ id: s.id, m: M(x, Y0, z, yaw0).scale(new THREE.Vector3(s.modelScaleX || 1, 1, 1)) }); }   // [v254] outside shops: solid footprint again
      if (s.walkIn) shopWalkInCols(s);
      for (const c of glb.colliders) {
        const sx = s.modelScaleX || 1, [x, z] = T(s.lx + c[1] * sx, cz + c[2]);
        if (c[0] === 'c') addCirc(x, z, c[3]); // conservative enclosing circle after width-only fit
        else if (sx !== 1) { const a = c[5] || 0; addBox(x, z, (Math.abs(Math.cos(a)) * c[3] + Math.abs(Math.sin(a)) * c[4]) * sx, Math.abs(Math.sin(a)) * c[3] + Math.abs(Math.cos(a)) * c[4], yaw0); }
        else addBox(x, z, c[3], c[4], yaw0 + (c[5] || 0));
      }
      { const [x, z] = T(s.lx, FACADE_LZ + 1.0); addBox(x, z, s.w * 0.6 + 0.4, 1.4, yaw0); } for (const sx of [-1, 1]) addCirc(...T(s.lx + sx * s.w * 0.33, FACADE_LZ + 2.5), 0.25);
      continue; }
    stoneHouse(s.lx, s.w, s.fl, s.v, { shop: true, hollow: !!s.walkIn });   // [v250] hollow: walls-only colliders (shopWalkInCols); [v254] outside shops solid
    if (s.walkIn) shopWalkInCols(s);
    at(s.lx, FACADE_LZ, 0, () => {                                          // walk-up counter + canvas awning on timber posts
      W(k, box(s.w * 0.6, 1.1, 1.0), C.WOOD, TIMBER, M(0, 0.55, 1.0)); W(k, box(s.w * 0.6 + 0.3, 0.14, 1.25), C.WOOD_L, TIMBER, M(0, 1.16, 1.0), false);
      for (const sx of [-1, 1]) W(k, box(0.22, 3.0, 0.22), C.WOOD_D, TIMBER, M(sx * s.w * 0.33, 1.5, 2.5), false);
      W(k, box(s.w * 0.72, 0.12, 2.8), s.awn, CLOTH, M(0, 3.25, 1.35, 0, 0.24));
      for (let i = 0; i < 6; i++) W(k, box(s.w * 0.72 / 6 - 0.04, 0.45, 0.06), i % 2 ? 0xf2efe6 : s.awn, CLOTH, M(-s.w * 0.36 + (i + 0.5) * s.w * 0.12, 2.8, 2.72), false);
      W(k, box(s.w * 0.64, 1.0, 0.16), C.WOOD_D, TIMBER, M(0, 4.35, 0.42), false);
    }, Y0);
    sign(s.id, s.w * 0.6, 0.85, s.lx, Y0 + 4.35, FACADE_LZ + 0.52); hanging(s.id, s.lx, s.w);
    { const [x, z] = T(s.lx, FACADE_LZ + 1.0); addBox(x, z, s.w * 0.6 + 0.4, 1.4, yaw0); } for (const sx of [-1, 1]) addCirc(...T(s.lx + sx * s.w * 0.33, FACADE_LZ + 2.5), 0.25); // counter + awning posts are solid
  }
  for (const hl of HALLS) {                                                 // stone warehouse: billboards on the ground floor
    const [x, z] = T(hl.lx, cz); if (!hl.market) addBox(x, z, hl.w + 0.6, ROW_D + 0.6, yaw0);   // [v248] the MARKETPLACE is walk-in (marketInside: walls only)
    if (hl.market) marketInside(hl);
    at(hl.lx, cz, 0, () => { if (!hl.market) { W(k, box(hl.w + 0.6, 0.7, ROW_D + 0.6), QUOIN, TRIM, M(0, 0.15, 0)); W(k, box(hl.w, 4.4, ROW_D), 0xa99f90, MASON, M(0, 2.7, 0)); }
      W(k, box(hl.w + 0.4, 0.4, ROW_D + 0.4), QUOIN, TRIM, M(0, 5.0, 0), false); W(k, box(hl.w, 3.6, ROW_D), 0xc9bfae, MASON, M(0, 6.9, 0));
      for (const sx of [-1, 1]) for (let q = 0; q < 6; q++) W(k, box(0.8, 0.9, 0.8), QUOIN, TRIM, M(sx * (hl.w / 2 - 0.3), 1.0 + q * 1.4, ROW_D / 2 - 0.3), false);
      W(k, box(hl.w + 1.2, 0.4, ROW_D + 1.6), C.ROOF, 4, M(0, 8.9, 0)); W(k, box(hl.w * 0.7, 1.4, 0.2), C.WOOD_D, TIMBER, M(0, 9.9, ROW_D / 2 - 0.4), false);
      W(k, box(hl.w + 0.2, 0.3, 0.3), C.WOOD_D, TIMBER, M(0, 8.5, ROW_D / 2 + 0.2), false); }, Y0);
    sign('hall', hl.w * 0.66, 1.2, hl.lx, Y0 + 9.9, FACADE_LZ - 0.28);
    if (hl.market) marketHall(hl);   // [v240] entrance, MARKETPLACE signs, goods walls + tables
    if (hl.trending && !ON_PORTAL && HALL_BOARDS_ON) for (let i = 0; i < TRENDING.n; i++) { const lx = TRENDING.lx0 + i * (TRENDING.lx1 - TRENDING.lx0) / (TRENDING.n - 1);
      at(lx, FACADE_LZ, 0, () => W(k, box(2.9, 2.2, 0.2), C.WOOD_D, TIMBER, M(0, TRENDING.y, 0.12), false), Y0); sign('trend' + i, 2.6, 1.9, lx, Y0 + TRENDING.y, FACADE_LZ + 0.24); }
  }
  if (!ON_PORTAL) for (const [sym, lx] of Object.entries(TOKEN_SLOTS)) if (!A['bb' + sym] && !hallTokenHidden(sym)) {     // slot frames for boards not in this build
    at(lx, tokenSpot(sym).lz, 0, () => { for (const sx of [-1, 1]) W(k, box(0.26, 5.8, 0.26), C.WOOD_D, TIMBER, M(sx * 2.05, 2.9, 0)); W(k, box(4.5, 4.0, 0.24), C.WOOD_D, TIMBER, M(0, 3.75, 0)); }, Y0);
    sign('tok_' + sym, 4.1, 3.6, lx, Y0 + 3.85, tokenSpot(sym).lz + .14); }
  if (TOKENX_ON) { const [x, z] = T(62, -27.4); addBox(x, z, 4.9, 1.2, yaw0); }   // the v103 token exchange counter (was walk-through); [v240] hidden unless &tokenx=1
  for (const hs of HOUSES) { const glb = hs.glb && SHOPS_KIT && SHOPS_KIT.shops[hs.glb];
    if (glb) { const [x, z] = T(hs.lx, cz); addBox(x, z, hs.w + 0.6, ROW_D + 0.6, yaw0); SHOP_PLACES.push({ id: hs.glb, m: M(x, Y0, z, yaw0) }); continue; }
    stoneHouse(hs.lx, hs.w, hs.fl, hs.v); if (hs.tavern) hanging('tavern', hs.lx, hs.w); }
  fishHall();   // [v247] the walk-in FISH MARKET on the shop row (#10 + #11)
  // ---- market street + stalls + tavern tables + carts ----
  for (const [lx, lz] of LAMPS) { const [x, z] = T(lx, lz); torchPost(k, F, x, Y0, z); addCirc(x, z, 0.3); }
  for (const s of STALLS) { const [x, z] = T(s.lx, s.lz); stall(k, x, Y0, z, yaw0 + Math.PI, 0xd8322f); { const [bx, bz] = T(s.lx, s.lz - 0.2); addBox(bx, bz, 4.3, 3.0, yaw0); }   // [collisions] counter + the 4 awning posts (the r 1.8 circle let you walk through the corner posts)
    at(s.lx, s.lz, Math.PI, () => { W(k, box(4.4, 0.1, 3.2), s.c, CLOTH, M(0, 3.0, 0.3, 0, 0.14)); for (const sx of [-2.0, 2.0]) for (const sz of [-1.2, 1.6]) W(k, box(0.14, 3.0, 0.14), C.WOOD_D, TIMBER, M(sx, 1.5, sz), false);
      for (let p = 0; p < 5; p++) k.add(new THREE.IcosahedronGeometry(0.28, 0), [0xff7a1a, 0xffd43b, 0x7cc142, 0xd8322f][(p + s.lx) & 3], { m: M(-1.2 + p * 0.6, 1.2, 0.2), outline: false, mat: 0 }); }, Y0);
    const [bx, bz] = T(s.lx + 2.8, s.lz + 1.0); ((s.lx / 8) % 2 ? barrel : sacks)(k, M(bx, Y0, bz, s.lx)); addCirc(bx, bz, 0.7); }
  for (const [lx, lz] of CARTS) { at(lx, lz, 0.3, () => { W(k, box(2.6, 0.5, 1.5), C.WOOD, TIMBER, M(0, 0.95, 0)); for (const sz of [-0.85, 0.85]) W(k, cyl(0.55, 0.55, 0.14, 10), C.WOOD_D, TIMBER, M(-0.4, 0.55, sz, 0, Math.PI / 2), false);
      W(k, box(1.8, 0.1, 0.1), C.WOOD_D, TIMBER, M(2.1, 0.8, 0.4), false); W(k, box(1.8, 0.1, 0.1), C.WOOD_D, TIMBER, M(2.1, 0.8, -0.4), false); }, Y0);
    const [x, z] = T(lx, lz); barrel(k, M(x, Y0 + 1.2, z, 1)); { const c = Math.cos(0.3), s = Math.sin(0.3), [bx, bz] = T(lx + 0.9 * c, lz - 0.9 * s); addBox(bx, bz, 4.9, 1.8, yaw0 + 0.3); } }   // [collisions] cart body + wheels + the shafts (circle 1.5 missed the shafts)
  for (const [lx, lz] of TAVERN_TABLES) { at(lx, lz, 0, () => { W(k, cyl(0.9, 0.9, 0.12, 10), C.WOOD, TIMBER, M(0, 1.0, 0)); W(k, cyl(0.15, 0.25, 1.0, 6), C.WOOD_D, TIMBER, M(0, 0.5, 0), false);
      for (const a of [0, 2.1, 4.2]) W(k, cyl(0.35, 0.35, 0.55, 8), C.WOOD_L, TIMBER, M(Math.sin(a) * 1.3, 0.28, Math.cos(a) * 1.3), false); }, Y0); const [x, z] = T(lx, lz); addCirc(x, z, 1.0);
    addCirc(x, z, 1.72); }   // [collisions] table + its 3 stools as one round footprint (the stools were walk-through; separate circles left pockets)
  // ---- palms (blockout: chunky trunk + fronds; phase 2 = the nature kit palm) ----
  // [Emerly] BANKSY: the plaza palms = the nature kit palms (palm0-2, the ones under the rope bridge), instanced in foot.js createFoot from PALM_SPOTS; &plazapalm=0 = the blockout palms
  if (PLAZA_PALM_ON) for (const [i, [lx, lz]] of PALMS.entries()) { const [x, z] = T(lx, lz); PALM_SPOTS.push([x, Y0, z, i * 1.3, i % 3]); addCirc(x, z, 0.5); }
  else for (const [i, [lx, lz]] of PALMS.entries()) at(lx, lz, i * 1.3, () => { for (let s = 0; s < 4; s++) W(k, cyl(0.32 - s * 0.04, 0.36 - s * 0.04, 2.0, 7), C.BARK, 5, M(s * 0.18, 1 + s * 1.9, 0, 0, 0, -0.06 * s));
      for (let f = 0; f < 6; f++) W(k, box(0.9, 0.14, 3.6), 0x3fca45, 6, M(0.7 + Math.sin(f * 1.05) * 1.5, 7.6, Math.cos(f * 1.05) * 1.5, f * 1.05, 0.38)); addCirc(...T(lx, lz), 0.5); }, Y0);
  // ---- cargo between the jetty roots (never on a jetty root or berth lane), rope coils, crane ----
  for (const [i, [lx, lz]] of CARGO.entries()) { if (!clearOfJetties(lx, 3)) continue; const [x, z] = T(lx, lz), y = lx < BOARDWALK.lxS ? bwY(lx) - 0.02 : Y0;
    crate(k, M(x, y, z, i * 0.7), 1.3); if (i % 2 === 0) crate(k, M(x, y + 1.3, z, i * 0.7 + 0.4), 1.1); const [x2, z2] = T(lx + 1.8, lz + 0.4); barrel(k, M(x2, y, z2, i));
    at(lx - 1.8, lz + 0.6, 0, () => { W(k, cyl(0.6, 0.6, 0.35, 12), 0xd9c39a, ROPE, M(0, 0.18, 0)); W(k, cyl(0.25, 0.25, 0.37, 8), 0x8a6a3a, ROPE, M(0, 0.19, 0), false); }, y); addCirc(...T(lx - 1.8, lz + 0.6), 0.65); addCirc(x2, z2, 0.7);
    addCirc(x, z, 1.1); }
  at(CRANE.lx, CRANE.lz, 0, () => { W(k, box(1.4, 0.6, 1.4), QUOIN, TRIM, M(0, 0.3, 0)); W(k, cyl(0.28, 0.34, 7, 8), C.WOOD_D, TIMBER, M(0, 3.8, 0)); W(k, box(0.35, 0.35, 7.5), C.WOOD_D, TIMBER, M(0, 6.6, 2.6, 0, -0.5));
    W(k, cyl(0.04, 0.04, 3.0, 4), 0xe7c08d, ROPE, M(0, 5.8, 5.7), false); W(k, box(1.4, 1.0, 1.4), C.WOOD_L, TIMBER, M(0, 4.0, 5.7)); }, Y0); addCirc(...T(CRANE.lx, CRANE.lz), 0.9);
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
  if (!DOCKS_KIT) for (const b of BERTHS) { addCirc(...T(b.ashore.lx, b.lz - 18), 0.3); at(b.ashore.lx, BERTH_SIGN_LZ, 0, () => { W(k, box(0.2, 1.6, 0.2), C.WOOD_D, 2, M(0, 0.8, 0), false); W(k, box(0.14, 0.9, 1.7), C.WOOD_D, 2, M(0, 1.9, 0)); }, b.ashore.y);
    sign('berth_' + b.id, 1.5, 0.8, b.ashore.lx + b.side * 0.08, b.ashore.y + 1.9, BERTH_SIGN_LZ, b.side * Math.PI / 2); }
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
  const L = signList(), CW = 512, RH = 128, cv = document.createElement('canvas'), SK = PHONE_TEX ? 0.625 : 1; cv.width = CW * SK; cv.height = RH * L.length * SK; const g = cv.getContext('2d'), R = {}; g.setTransform(SK, 0, 0, SK, 0, 0); // [mobile-perf-2] phones: 8.4 -> 3.3 MB, same layout
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
