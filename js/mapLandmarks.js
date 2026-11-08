import { HQ } from './pumpfun/site.js';
import { SHIP_STORE } from './island/shipStore.js';
import { OUTFIT_STORE } from './island/outfitStore.js';   // [outfit-store] Clothes + Accessories: one building, one pin
// [minimap-themes] BANKSY 2026-11-04 10:34 AM: "update the treasure map and real map based on new locations".
//   One list of map landmarks for the radar, the full island map and the treasure chart, read from the same data the island
//   builds from, so a moved shop or area moves on the maps too. Foot frame (north = -z). Icons: js/mapIcons.js.
// [minimap-icons] BANKSY 2026-11-05 2:22 PM: "update the minimap icons based on new locations and make sure icons don't duplicate"
//   (pet store + crew shop each had 2 icons: once from layout.interact / STOREFRONTS, once from this list). Default = one icon
//   per place, positions from the same sources as the world objects, docks grouped per jetty (B1/B2 → J1, …). &mmicons=0 =
//   the old list (pets + crew + sword/musket shops duplicated here).
import { MAIN_ST_SHOPS, PIT, RANGE } from './island/battleAreas.js';
import { COLISEUM_ON, FOOT } from './island/coliseum.js';
import { STOREFRONTS } from './island/plazaTown.js';
import { BATTERY } from './island/battery.js';
import { FORT } from './island/coast.js';
import { JUNGLE_TRAILHEAD as TH } from './island/digSpots.js';
import { CASINO_ON, CASINO_HALL } from './island/casinoData.js';   // [Timothy] THE GOLDEN DOUBLOON CASINO (#47, Main Street)
const ROW_LZ = -36; // plaza storefront row (town-local lz -30 .. -42, plazaTown.js) — legacy only
const MMICONS_LEGACY = typeof location !== 'undefined' && /[?&]mmicons=0(?:&|$)/.test(location.search);
// [id, icon, label, frame, x, z, far]: frame 'town' = coast.js town-local (lx, lz), 'foot' = foot frame. far = landmark (not a town POI)
const LIST_LEGACY = () => [
  [SHIP_STORE.id, SHIP_STORE.id, 'SHIP STORE', 'town', SHIP_STORE.lx, SHIP_STORE.lz],
  [OUTFIT_STORE.id, OUTFIT_STORE.id, OUTFIT_STORE.name, 'town', OUTFIT_STORE.lx, OUTFIT_STORE.lz],
  ['sword_shop', 'sword_shop', 'SWORD SHOP', 'town', MAIN_ST_SHOPS.find(s => s.id === 'sword_shop')?.lx, MAIN_ST_SHOPS.find(s => s.id === 'sword_shop')?.lz],
  ['musket_shop', 'musket_shop', 'MUSKET SHOP', 'town', MAIN_ST_SHOPS.find(s => s.id === 'musket_shop')?.lx, MAIN_ST_SHOPS.find(s => s.id === 'musket_shop')?.lz],
  ...['shop_pets'].map(id => { const s = STOREFRONTS.find(q => q.id === id); return s ? [id, id, s.name, 'town', s.lx, ROW_LZ] : null; }),
  ['castle', 'castle', 'CROWN CITADEL', 'town', FORT.lx, FORT.lz, true],
  ['battery', 'fort', 'CANNON HEADLAND', 'town', BATTERY.lx, BATTERY.lz, true],
  ['sword_pit', 'battle', 'SWORD PIT', 'town', PIT.lx, PIT.lz, true],
  ['musket_range', 'battle', 'MUSKET RANGE', 'town', (RANGE.lx0 + RANGE.lx1) / 2, (RANGE.lz0 + RANGE.lz1) / 2, true],
  ...(COLISEUM_ON ? [['coliseum', 'fort', 'BLOODSTONE COLOSSEUM', 'town', (FOOT.lx0 + FOOT.lx1) / 2, (FOOT.lz0 + FOOT.lz1) / 2, true]] : []),
  ['ruin_steps', 'ruins', 'ANCIENT STEPS', 'foot', 106, -332, true],
  ['jungle_idols', 'idol', 'IDOL GROVE', 'foot', 69, -357, true],
  ['mossbeard', 'camp', "MOSSBEARD'S OUTPOST", 'foot', TH.x - 4.5, TH.z + 9.5, true],
].filter(Boolean).filter(r => Number.isFinite(r[4]) && Number.isFinite(r[5]));
// Default: no shop rows that layout.interact / battle already register (pets, crew, sword, musket). Landmarks only.
const LIST = () => [
  [HQ.id, HQ.id, 'PUMPFUN PIRATES', 'town', HQ.prompt.lx, HQ.prompt.lz],
  [SHIP_STORE.id, SHIP_STORE.id, 'SHIP STORE', 'town', SHIP_STORE.lx, SHIP_STORE.lz],
  [OUTFIT_STORE.id, OUTFIT_STORE.id, OUTFIT_STORE.name, 'town', OUTFIT_STORE.lx, OUTFIT_STORE.lz],
  ['castle', 'castle', 'CROWN CITADEL', 'town', FORT.lx, FORT.lz, true],
  ['battery', 'fort', 'CANNON HEADLAND', 'town', BATTERY.lx, BATTERY.lz, true],
  ['sword_pit', 'battle', 'SWORD PIT', 'town', PIT.lx, PIT.lz, true],
  ['musket_range', 'battle', 'MUSKET RANGE', 'town', (RANGE.lx0 + RANGE.lx1) / 2, (RANGE.lz0 + RANGE.lz1) / 2, true],
  ['ruin_steps', 'ruins', 'ANCIENT STEPS', 'foot', 106, -332, true],
  ['jungle_idols', 'idol', 'IDOL GROVE', 'foot', 69, -357, true],
  ['mossbeard', 'camp', "MOSSBEARD'S OUTPOST", 'foot', TH.x - 4.5, TH.z + 9.5, true],
  ...(CASINO_ON ? [['casino', 'casino', 'CASINO', 'town', CASINO_HALL.lx, CASINO_HALL.lz]] : []),   // one icon (its four tables register none)
].filter(r => Number.isFinite(r[4]) && Number.isFinite(r[5]));
export function mapLandmarks(FM) {
  const GEO_IDS = new Set(['castle','battery','sword_pit','musket_range','ruin_steps','jungle_idols','mossbeard','coliseum']);
  return (MMICONS_LEGACY ? LIST_LEGACY() : LIST()).map(([id, icon, label, fr, x, z, far]) => { const [fx, fz] = fr === 'town' ? FM.townToWorld(x, z) : [x, z]; return { id, icon, label, x: fx, z: fz, far: !!far, geo: GEO_IDS.has(id) }; });
}
// docks: one anchor per jetty (berth pairs share a jetty), harbor coords in -> foot
// [minimap-icons] plaza v2 berths are B1..B10 (two per jetty J1..J5). The old /[LR]$/ strip only collapsed P1L/P1R, so each B*
// became its own dock icon (10 overlapping anchors). Pair Bn → J(ceil(n/2)); keep P* / other ids as before.
export function mapDocks(layout) {
  if (MMICONS_LEGACY) {
    const by = new Map(); for (const b of layout.berths || []) { const k = String(b.id).replace(/[LR]$/, ''); const [x, z] = layout.harborToFoot(b.x, b.z); const a = by.get(k) || []; a.push([x, z]); by.set(k, a); }
    return [...by.entries()].map(([k, a]) => ({ id: 'dock_' + k, icon: 'dock', label: 'PIER ' + k.replace(/^P/, ''), x: a.reduce((s, p) => s + p[0], 0) / a.length, z: a.reduce((s, p) => s + p[1], 0) / a.length, far: false }));
  }
  const by = new Map();
  for (const b of layout.berths || []) {
    const id = String(b.id), m = /^B(\d+)$/.exec(id);
    const k = m ? 'J' + Math.ceil(+m[1] / 2) : id.replace(/[LR]$/, '');
    const [x, z] = layout.harborToFoot(b.x, b.z); const a = by.get(k) || []; a.push([x, z]); by.set(k, a);
  }
  return [...by.entries()].map(([k, a]) => ({ id: 'dock_' + k, icon: 'dock', label: 'PIER ' + k.replace(/^P/, '').replace(/^J/, ''), x: a.reduce((s, p) => s + p[0], 0) / a.length, z: a.reduce((s, p) => s + p[1], 0) / a.length, far: false }));
}
export const mmiconsLegacy = () => MMICONS_LEGACY;
