// [island-rework] AREA LOADER: each rework area is its own module (js/island/areas/<area>.js). Split in two so phones stay light:
//   register(h)  EAGER at island build (cheap data): POIs (keep foliage clear), colliders, walkable decks, interact points, terrain edits
//   build(h)     LAZY: the meshes are only built when you come within LOAD_R of the area, shown as the NEAR set (full kit) inside
//                NEAR_R, as the FAR impostor beyond it up to SHOW_R, hidden past SHOW_R and disposed past DROP_R (per-area culling + LOD)
// Gold: nothing here pays gold while js/island/areas/flags.js AREA_GOLD_ON is false (PRICES_FOR_BANKSY.md, all pending).
import lagoon from './lagoon.js';
import jungle from './jungle.js';
import route from './route.js';
import ropeBridge from './ropeBridge.js';
import fort, { FORT_WALKIN } from './fort.js';
import bldNums from './bldNums.js'; // [v212] &bldnum=1: BANKSY's building numbers over the plaza + hill street
import invShops from './invShops.js'; // [inventory] Fish Stand + Antiques + Marketplace triggers (placeholders until Timothy's buildings)
import { libAreaBuilt } from '../libTex.js';   // [Timothy] shared material library: re-tags a built area's kit pieces (the hilltop fort, the Pirates' Climb) + the gate junction dressing
export { FORT_WALKIN };
export const AREA_MODS = [lagoon, jungle, ...route, ropeBridge, fort, invShops, bldNums];
// terrain edits (applied by foot.js to the height grid at load): pads = flat floors [x0, x1, z0, z1, y], paths = trails (painted + kept clear)
export const AREA_TERRAIN = { pads: AREA_MODS.flatMap(a => a.terrain?.pads || []), paths: AREA_MODS.flatMap(a => a.terrain?.paths || []), cuts: AREA_MODS.flatMap(a => a.terrain?.cuts || []) };
const dRect = (x, z, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[1]), Math.max(r[2] - z, 0, z - r[3]));
// AREA_LOG[area] = everything an area registered (colliders, decks, POIs, interact points): the Blender handoff reads it
// (docs/island_rework/handoff/<area>.md + <area>.placements.json) so the rebuild keeps every walk height + collider in place
export const AREA_LOG = {};
export function registerAreas(h) { for (const a of AREA_MODS) { const L = AREA_LOG[a.id] = { boxes: [], circs: [], decks: [], pois: [] }, n0 = h.INTERACT.length;
  a.register({ ...h, addBox: (x, z, w, d, yaw = 0) => { L.boxes.push({ x, z, w, d, yaw }); h.addBox(x, z, w, d, yaw); }, addCirc: (x, z, r) => { L.circs.push({ x, z, r }); h.addCirc(x, z, r); },
    addDeck: (d) => { L.decks.push(d); h.addDeck(d); }, poi: (id, label, x, z, o) => { L.pois.push({ id, label, x, z }); return h.poi(id, label, x, z, o); } });
  for (const q of h.INTERACT.slice(n0)) (AREA_LOG[q.area] = AREA_LOG[q.area] || { boxes: [], circs: [], decks: [], pois: [] }, (AREA_LOG[q.area].interact = AREA_LOG[q.area].interact || []).push(q)); } }
export function createAreas({ root, MATS, OUT, low, uTime, H }) {
  const LOAD_R = low ? 240 : 380, NEAR_R = low ? 120 : 190, SHOW_R = low ? 300 : 560, DROP_R = LOAD_R + 260;
  const S = AREA_MODS.map(a => ({ a, b: null, d: 1e9 })), stats = { built: 0, buildMs: 0, disposed: 0 };
  const ctx = { MATS, OUT, low, uTime, H };
  function build(s) { const t0 = performance.now(); s.b = s.a.build(ctx); libAreaBuilt(s.a.id, s.b, ctx); for (const g of [s.b.near, s.b.far].filter(Boolean)) { g.visible = false; root.add(g); }
    stats.built++; stats.buildMs += Math.round(performance.now() - t0); stats[s.a.id] = Math.round(performance.now() - t0) + ' ms'; }
  function dispose(s) { for (const g of [s.b.near, s.b.far].filter(Boolean)) { root.remove(g); g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); } s.b = null; stats.disposed++; }
  function update(cam, t, all = false) {
    for (const s of S) { s.d = dRect(cam.x, cam.z, s.a.rect);
      if (!s.b && (s.d < LOAD_R || all)) build(s); if (!s.b) continue;
      if (!all && s.d > DROP_R) { dispose(s); continue; }
      const near = !all && s.d < NEAR_R, show = all || s.d < SHOW_R;
      if (s.b.near) s.b.near.visible = show && (near || !s.b.far); if (s.b.far) s.b.far.visible = show && !near;
      if (near && s.b.tick) s.b.tick(t, cam); } }
  const owner = (q) => S.find(s => s.a.id === q.area);
  return { update, stats,
    activate(q, t, api) { const s = owner(q); return s ? s.a.activate(q, t, api, s.b) : null; },
    label(q) { const s = owner(q); return s && s.a.label ? s.a.label(q, s.b) : null; },
    onPlayer(p, t, api) { for (const s of S) if (s.b && s.d < NEAR_R && s.a.onPlayer) s.a.onPlayer(p, t, api, s.b); },
    get loaded() { return S.filter(s => s.b).map(s => s.a.id); } };
}
