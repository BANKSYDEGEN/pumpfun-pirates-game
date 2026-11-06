// [Timothy] PUMPFUN PIRATES FISHING BRIDGE + WATERFALL + the long HIGH ROPE BRIDGE, Blender visuals (BANKSY 5:07 PM: "Now can you redo fishing
// bridge and waterfall area make it nicer in blender" / "Do the bridge too in blender"). tools/falls_blender/falls_blender.py ->
// assets/island/falls.glb (desktop LOD0 + LOD1 far twins) / falls_low.glb (phones, LOD1), from assets/island/falls_layout.json
// (tools/falls_blender/node/export_layout.mjs). Three sections, each swapped only while its layout matches this build:
//   d3    the fishing bridge (foot.js BRIDGE, trail A over the river gorge at x 16): replaces the town-kit group 'foot_townkit_bridge'
//         (planks, ropes, A-frame towers, bollards) with a plank deck on hemp foot ropes, rope rails on posts, dressed stone abutments
//         (sill flush with the deck end + the approach steps, newels with lanterns where the tower legs' colliders are, wing walls,
//         anchor blocks where the bollards were). The old tower-top flames are parked (no tower to hold them).
//   hb    the high rope bridge (areas/hillRound.js HB): replaces its timber deck kit ('hb_deck_kit') inside the same sway group;
//         the stone piers / newels stay the Blender plaza's (rb_plaza.glb). Plank deck, sawn stringers, bearers, posts, rope rails +
//         net, knee braces at the piers, a threshold sill at the plaza, a landing sill + flared wing walls at the plateau.
//   area  the waterfall: replaces the old pool boulders ('foot_nature_falls') with sculpted boulders on the same spots, plus cliff
//         ledges + buttresses round the falls, a mossy basin rim, shore pebbles, reeds, planting and trail lanterns.
// VISUALS ONLY: every walk height (bridgeAt / highBridgeAt / area decks), collider and gameplay value stays in foot.js / hillRound.js.
// The water (river, lagoon, falls sheet, foam) is not touched. Each section keeps the old look if its bridge / ground moved since the
// bake (build mode: re-checked on every terrain edit). &falls=0 = all of it off, &rbbridge=0 = the high bridge's old deck only.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { softRamp } from './look.js';
import { libMaterial } from './libTex.js';
import { H, BRIDGE, TERRAIN } from './foot.js';

const QS = typeof location !== 'undefined' ? location.search : '';
export const FALLS_ON = !/[?&]falls=0(&|$)/.test(QS);
export const HBB_ON = FALLS_ON && !/[?&]rbbridge=0(&|$)/.test(QS);
export const FALLS_STATS = { on: FALLS_ON, hb: HBB_ON, loaded: false, swapped: {}, skipped: {}, tris: {}, bytes: 0 };
const near = (a, b, e = 0.02) => Math.abs(a - b) <= e;
export function groundOk(list, h = H, tol = 0.06) { let worst = 0; for (const [x, z, y] of list || []) worst = Math.max(worst, Math.abs(h(x, z) - y)); return [worst <= tol, +worst.toFixed(3)]; }
export function d3Match(L, B = BRIDGE) { return !!(L && B && B.L && ['ax', 'az', 'bx', 'bz', 'deckY', 'sag'].every(k => near(L[k], B[k])) && L.half === B.half); }
export function hbMatch(L, B) { return !!(L && B && B.L && ['ax', 'az', 'bx', 'bz', 'ya', 'yb', 'sag'].every(k => near(L[k], B[k])) && L.half === B.half && L.piers.length === B.piers.length && L.piers.every((p, i) => near(p, B.piers[i], 1e-4))); }

// quantized attributes -> plain Float32 (applyMatrix4 on a normalized int16 position would clamp the world coords back to -1..1)
function floatGeo(src) { const g = new THREE.BufferGeometry(); if (src.index) g.setIndex(src.index.clone());
  for (const [k, a] of Object.entries(src.attributes)) { const f = new Float32Array(a.count * a.itemSize); for (let i = 0; i < a.count; i++) for (let j = 0; j < a.itemSize; j++) f[i * a.itemSize + j] = a.getComponent(i, j); g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize)); }
  return g; }
// the loaded section must cover its layout in WORLD space (a dropped node transform = a 2 m model: keep the old look instead)
export function boundsOk(id, box, lay) { if (!box) return [false, 'no box'];
  const sx = box.max.x - box.min.x, sz = box.max.z - box.min.z;
  if (id === 'd3') { const D = lay.d3; return [box.min.z <= Math.min(D.az, D.bz) - 0.5 && box.max.z >= Math.max(D.az, D.bz) + 0.5 && sx > 3 && sx < 12 && box.min.y < D.deckY - 1 && box.max.y > D.deckY + 1, [sx, sz].map(v => +v.toFixed(1))]; }
  if (id === 'hb') { const D = lay.hb, L = Math.abs(D.bx - D.ax); return [sx > L * 0.95 && sx < L + 20 && box.min.x < Math.min(D.ax, D.bx) + 1 && box.max.x > Math.max(D.ax, D.bx) - 1, [sx, sz].map(v => +v.toFixed(1))]; }
  const A = lay.area; return [sx > 80 && sz > 80 && Math.abs((box.min.x + box.max.x) / 2 - A.lake.x) < 60 && Math.abs((box.min.z + box.max.z) / 2 - A.lake.z) < 60, [sx, sz].map(v => +v.toFixed(1))]; }
let P = null;
function load(low) {
  if (P) return P;
  const solid = libMaterial(new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: softRamp() }), low); solid.name = 'falls_solid';
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); glow.name = 'falls_glow';
  const url = `assets/island/falls${low ? '_low' : ''}.glb`;
  P = Promise.all([fetch('assets/island/falls_layout.json').then(r => r.json()), new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url)]).then(([lay, gl]) => {
    gl.scene.updateMatrixWorld(true); const S = {}; let extra = {};
    gl.scene.traverse(o => { if (o.userData && o.userData.falls) try { extra = JSON.parse(o.userData.falls); } catch (e) { /* none */ } });
    gl.scene.traverse(o => { if (!o.isMesh) return; const nm = (o.parent && /^falls_/.test(o.parent.name) ? o.parent.name : o.name), m = /^falls_(d3|hb|area)_LOD([01])/.exec(nm); if (!m) return;
      const g = floatGeo(o.geometry); g.applyMatrix4(o.matrixWorld); g.computeBoundingSphere(); g.computeBoundingBox();   // world-space geometry (foot.js culls groups by geometry.boundingSphere);
      // the GLB is meshopt + KHR_mesh_quantization: positions are int16 in -1..1 and the real scale is the node's transform, so it is baked in here (o.matrixWorld) on float copies
      const mesh = new THREE.Mesh(g, /glow/.test(o.material.name) ? glow : solid); mesh.name = `falls_${m[1]}_lod${m[2]}_${mesh.material === glow ? 'glow' : 'solid'}`;
      mesh.castShadow = !low && mesh.material === solid; mesh.receiveShadow = !low && mesh.material === solid;
      const s = S[m[1]] = S[m[1]] || { 0: [], 1: [] }; s[m[2]].push(mesh); FALLS_STATS.tris[m[1] + '_' + m[2]] = (FALLS_STATS.tris[m[1] + '_' + m[2]] || 0) + (g.index ? g.index.count : g.attributes.position.count) / 3; });
    // desktop: LOD0 near, the LOD1 twin beyond ~170 m (foot.js update: userData.far); phones: LOD1 only
    const out = {}; for (const [k, s] of Object.entries(S)) { const main = s[0].length ? s[0] : s[1]; if (s[0].length) for (const m of main) { const f = s[1].find(q => q.material === m.material); if (f) { f.visible = false; f.castShadow = false; m.userData.far = f; } } out[k] = main; }
    FALLS_STATS.bounds = {}; for (const k of Object.keys(out)) { const bb = new THREE.Box3(); for (const m of out[k]) bb.union(m.geometry.boundingBox); const [ok, why] = boundsOk(k, bb, lay); FALLS_STATS.bounds[k] = why;
      if (!ok) { console.warn('[falls] ' + k + ' model is not at its layout size / place, the old look stays', why); FALLS_STATS.skipped[k] = 'bounds ' + why; delete out[k]; } }
    FALLS_STATS.loaded = true; return { lay, S: out, extra }; })
    .catch(e => { console.warn('[falls] Blender fishing bridge / waterfall failed, the old look stays', e); FALLS_STATS.error = String(e).slice(0, 120); return null; });
  return P;
}
// one swappable section: old meshes out / new in (and back if a terrain edit moves the ground it was baked on)
function section(id, { parent, groups, old, mine, check }) {
  const st = { on: false };
  const set = (on) => { if (on === st.on) return; st.on = on;
    for (const o of old) { if (on) { o.parent?.remove(o); if (o.userData.far) o.userData.far.parent?.remove(o.userData.far); } else { parent.add(o); if (o.userData.far) parent.add(o.userData.far); } }
    for (const m of mine) { if (on) { parent.add(m); if (m.userData.far) parent.add(m.userData.far); } else { parent.remove(m); if (m.userData.far) parent.remove(m.userData.far); } }
    if (groups) { for (const o of old) { const i = groups.indexOf(o); if (on && i >= 0) groups.splice(i, 1); if (!on && i < 0) groups.push(o); }
      for (const m of mine) { const i = groups.indexOf(m); if (on && i < 0) groups.push(m); if (!on && i >= 0) groups.splice(i, 1); } }
    FALLS_STATS.swapped[id] = on; };
  const run = () => { const [ok, why] = check(); if (!ok) FALLS_STATS.skipped[id] = why; else delete FALLS_STATS.skipped[id]; set(ok); };
  run(); return run;
}
const WATCH = []; let watching = false;
function watchTerrain() { if (watching || typeof setInterval === 'undefined') return; watching = true; let rev = TERRAIN.rev;
  setInterval(() => { if (TERRAIN.rev === rev) return; rev = TERRAIN.rev; for (const f of WATCH) f(); }, 1500); }   // build mode / the saved edits landing
// foot.js createFoot (end): the fishing bridge + the waterfall
export function fallsFoot({ root, groups, low, flames }) {
  if (!FALLS_ON || typeof window === 'undefined') return;
  load(low).then(K => { if (!K) return; const { lay, S, extra } = K;
    const kitBridge = root.children.filter(o => o.name === 'foot_townkit_bridge');
    if (S.d3 && kitBridge.length) {   // no town kit (&kit=0 / failed): the bridge is part of foot_pois, nothing to swap
      const parked = []; const lamps = (lay.d3.ends || []).map(e => e.lamp);
      const park = (on) => { const a = flames?.geometry?.attributes?.aP; if (!a) return;   // the old tower-top lamp flames (no tower now): parked under the ground / back
        if (!parked.length) for (let i = 0; i < a.count; i++) for (const [x, y, z] of lamps) if (Math.abs(a.getX(i) - x) < 0.05 && Math.abs(a.getY(i) - (y + 0.1)) < 0.05 && Math.abs(a.getZ(i) - z) < 0.05) parked.push([i, a.getY(i)]);
        for (const [i, y] of parked) a.setY(i, on ? -500 : y); a.needsUpdate = true; FALLS_STATS.flamesParked = on ? parked.length : 0; };
      const run = section('d3', { parent: root, groups, old: kitBridge, mine: S.d3, check: () => { if (!d3Match(lay.d3)) return [false, 'bridge moved']; const [ok, w] = groundOk(lay.hchk.d3); return [ok, ok ? '' : 'ground moved ' + w]; } });
      const wrap = () => { run(); park(!!FALLS_STATS.swapped.d3); }; park(!!FALLS_STATS.swapped.d3); WATCH.push(wrap); }
    if (S.area) { const oldRocks = root.children.filter(o => o.name === 'foot_nature_falls');
      WATCH.push(section('area', { parent: root, groups, old: oldRocks, mine: S.area, check: () => { const [ok, w] = groundOk(lay.hchk.area); return [ok, ok ? '' : 'ground moved ' + w]; } })); }
    FALLS_STATS.lamps = extra.d3?.lamps?.length || 0; watchTerrain(); });
}
// areas/index.js -> libTex.js libAreaBuilt('hill_round'): the high rope bridge's deck
export function hbBuilt(built, ctx) {
  if (!HBB_ON || !built || !built.near || typeof window === 'undefined') return;
  let deck = null; built.near.traverse(o => { if (o.name === 'hb_deck_kit') deck = o; }); if (!deck) return; const sway = deck.parent;
  Promise.all([load(ctx.low), import('./areas/hillRound.js')]).then(([K, HR]) => { if (!K || !K.S.hb) return; const { lay, S } = K;
    WATCH.push(section('hb', { parent: sway, groups: null, old: [deck], mine: S.hb.map(m => { const c = m.clone(); if (m.userData.far) c.userData.far = null; return c; }), check: () => {
      if (!hbMatch(lay.hb, HR._hb)) return [false, 'bridge moved']; const [ok, w] = groundOk(lay.hchk.hb, ctx.H || H); return [ok, ok ? '' : 'ground moved ' + w]; } }));
    watchTerrain(); });
}
