// [minimap-themes] BANKSY 2026-11-04 10:34 AM: "update the treasure map and real map based on new locations".
//   One list of map landmarks for the radar, the full island map and the treasure chart, read from the same data the island
//   builds from, so a moved shop or area moves on the maps too. Foot frame (north = -z). Icons: js/mapIcons.js.
import { MAIN_ST_SHOPS, PIT, RANGE } from './island/battleAreas.js';
import { STOREFRONTS } from './island/plazaTown.js';
import { BATTERY } from './island/battery.js';
import { FORT } from './island/coast.js';
import { JUNGLE_TRAILHEAD as TH } from './island/digSpots.js';
const ROW_LZ = -36; // plaza storefront row (town-local lz -30 .. -42, plazaTown.js)
// [id, icon, label, frame, x, z, far]: frame 'town' = coast.js town-local (lx, lz), 'foot' = foot frame. far = landmark (not a town POI)
const LIST = () => [
  ['sword_shop', 'sword_shop', 'SWORD SHOP', 'town', MAIN_ST_SHOPS[0]?.lx, MAIN_ST_SHOPS[0]?.lz],
  ['musket_shop', 'musket_shop', 'MUSKET SHOP', 'town', MAIN_ST_SHOPS[1]?.lx, MAIN_ST_SHOPS[1]?.lz],
  ...['shop_pets', 'shop_crew'].map(id => { const s = STOREFRONTS.find(q => q.id === id); return s ? [id, id, s.name, 'town', s.lx, ROW_LZ] : null; }),
  ['castle', 'castle', 'HILLTOP FORT', 'town', FORT.lx, FORT.lz, true],
  ['battery', 'fort', 'CLIFF BATTERY', 'town', BATTERY.lx, BATTERY.lz, true],
  ['sword_pit', 'battle', 'SWORD PIT', 'town', PIT.lx, PIT.lz, true],
  ['musket_range', 'battle', 'MUSKET RANGE', 'town', (RANGE.lx0 + RANGE.lx1) / 2, (RANGE.lz0 + RANGE.lz1) / 2, true],
  ['ruin_steps', 'ruins', 'RUIN STEPS', 'foot', 106, -332, true],
  ['jungle_idols', 'idol', 'IDOLS', 'foot', 69, -357, true],
  ['mossbeard', 'camp', "MOSSBEARD'S CAMP", 'foot', TH.x - 4.5, TH.z + 9.5, true],
].filter(Boolean).filter(r => Number.isFinite(r[4]) && Number.isFinite(r[5]));
export function mapLandmarks(FM) {
  return LIST().map(([id, icon, label, fr, x, z, far]) => { const [fx, fz] = fr === 'town' ? FM.townToWorld(x, z) : [x, z]; return { id, icon, label, x: fx, z: fz, far: !!far }; });
}
// docks: one anchor per jetty (berth pairs share a jetty), harbor coords in -> foot
export function mapDocks(layout) {
  const by = new Map(); for (const b of layout.berths || []) { const k = String(b.id).replace(/[LR]$/, ''); const [x, z] = layout.harborToFoot(b.x, b.z); const a = by.get(k) || []; a.push([x, z]); by.set(k, a); }
  return [...by.entries()].map(([k, a]) => ({ id: 'dock_' + k, icon: 'dock', label: 'DOCK ' + k.replace(/^P/, ''), x: a.reduce((s, p) => s + p[0], 0) / a.length, z: a.reduce((s, p) => s + p[1], 0) / a.length, far: false }));
}
