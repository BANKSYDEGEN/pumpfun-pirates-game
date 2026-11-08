// [Emerly] PUMPFUN PIRATES: builds the walkable harbor world for a layout (js/dock/layout.js) inside the GAME scene:
// the main island with Raul's coast town (js/island/foot.js coast mode, placed by the layout's frame) plus berth markers. Exposes the walk API in harbor coordinates (ground / blocked / interact).
import * as THREE from 'three';
import { waveHeight } from '../ocean.js'; // [v348] t1833u: swimmers ride the live swell
import { toon } from '../toon.js';
import { makeAtlas } from '../island/art.js';
import { islandSurface, grassMaterial } from '../island/look.js';
import { Kit, M, outlineMaterial } from '../island/kit.js';
import { loadTownKit, loadNatureKit } from '../island/townkit.js';
import { freezeStatic } from '../opt.js'; // [Emerly perf-v304]
import { upgradeRiver, mouthSink, mouthSea } from '../island/riverWater.js';
import { CAM_ROOMS } from '../island/plazaTown.js'; // [clothes-aaa] indoor camera boxes (walk-in shops) // [clean-water] AAA river/lagoon/falls (&riverfx=0 = old)

const GOLD = 0xffc93c;


// foot.js terrain chunks carry two-sided skirts whose bottom vertices end up with zero normals (computeVertexNormals cancels them):
// normalize(0) = NaN in the lighting, and High's bloom smears one NaN pixel over the whole frame (black screen in the game).
// Guard it in our copy of the surface material (no foot.js edit): a zero normal reads as straight up.
function nanSafe(m) {
  const base = m.onBeforeCompile, key = m.customProgramCacheKey;
  m.onBeforeCompile = (s, r) => { base.call(m, s, r);
    const fix = 'vec3 nfix = dot(normal, normal) < 1e-12 ? vec3(0.0, 1.0, 0.0) : normal;\n';
    s.vertexShader = s.vertexShader.replace('#include <beginnormal_vertex>', fix + 'vec3 objectNormal = nfix;\n#ifdef USE_TANGENT\nvec3 objectTangent = vec3( tangent.xyz );\n#endif')
      .replace('vON = normal;', 'vON = nfix;'); };
  m.customProgramCacheKey = () => key.call(m) + '_dk';
}
export async function buildWorld({ layout, scene, quality, ocean, renderer, uTime }) {
  const LOW = quality === 'low', FM = layout.FM;
  const t0 = performance.now();
  // ---- the main island, placed by the layout frame (foot world -> harbor world) ----
  const root = new THREE.Group(); root.name = 'onfoot_world'; scene.add(root);
  const foot0 = layout.footToHarbor(0, 0), footX = layout.footToHarbor(1, 0);
  const yaw = Math.atan2(-(footX[1] - foot0[1]), footX[0] - foot0[0]); // rotation.y that maps local +x onto the frame's +x
  const footGroup = new THREE.Group(); footGroup.position.set(foot0[0], 0, foot0[1]); footGroup.rotation.y = yaw; root.add(footGroup); footGroup.updateMatrixWorld(true);
  // [v330 perf] BANKSY "optimized load time": the skull image, brand font, town kit, nature kit and the plaza storefronts (+ docks, battery,
  // material library) used to download one after another (5 serial awaits). They don't depend on each other, so they all start NOW and are
  // awaited in the same order as before (same results, same failure fallbacks: only the downloads overlap). &parworld=0 = the old serial chain.
  const PAR = !(typeof location !== 'undefined' && /[?&]parworld=0(&|$)/.test(location.search));
  const NAT_ON = new URLSearchParams(location.search).get('nature') !== '0';
  const skullP = new Promise(res => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/skull_transparent.png'; });
  const fontP = Promise.resolve(document.fonts?.load('40px "Just Another Hand"')).catch(() => {});
  const kitP = PAR ? loadTownKit(LOW, renderer).catch(e => { console.warn('[onfoot] town kit failed', e); return null; }) : null;
  const natP = PAR && NAT_ON ? loadNatureKit(LOW, renderer).catch(e => { console.warn('[onfoot] nature kit failed', e); return null; }) : null;
  const shopsP = PAR ? Promise.resolve(FM.PV?.plazaShopsReady?.(LOW, renderer)).catch(() => null) : null;
  const skull = await skullP;
  await fontP;
  const atlas = makeAtlas(skull);
  const MATS = { toon: islandSurface(toon(0xffffff, null, { vertexColors: true }), { low: LOW }), sway: islandSurface(toon(0xffffff, null, { vertexColors: true }), { low: LOW, uTime, sway: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), atlas: toon(0xffffff, atlas.tex, { side: THREE.DoubleSide }) };
  for (const m of [MATS.toon, MATS.sway]) nanSafe(m);
  const OUT = { plain: outlineMaterial(0.09), sway: outlineMaterial(0.09, uTime) };
  const KIT = PAR ? await kitP : await loadTownKit(LOW, renderer).catch(e => { console.warn('[onfoot] town kit failed', e); return null; });
  // [release] Raul's island art M2: the Blender nature kit (palms, jungle trees, ferns, rocks, cliffs, Skull Peak); ?nature=0 = procedural
  const NAT = KIT && NAT_ON ? await (PAR ? natP : loadNatureKit(LOW, renderer).catch(e => { console.warn('[onfoot] nature kit failed', e); return null; })) : null;
  await (PAR ? shopsP : FM.PV?.plazaShopsReady?.(LOW, renderer)); // [Timothy] (+ the material library) Blender storefront models (plaza v2) before the plaza is built; resolves null on failure
  const foot = FM.createFoot({ scene: footGroup, isle: null, MATS, OUT, low: LOW, atlas, uTime, uWaves: ocean.uniforms.uWaves, renderer, kit: KIT, nat: NAT, decorHulls: false }); // live berths: no toy hulls parked in them
  upgradeRiver(foot.root, { FM, low: LOW, uTime, ocean: ocean.uniforms }); // [clean-water] depth-coloured river + lagoon + waterfall plunge (&riverfx=0 = old)
  if (layout.shopInteract) for (const q of layout.shopInteract()) if (!layout.interact.some(o => o.id === q.id)) layout.interact.push(q);
  // same NaN guard for foot.js's own foliage materials (trees / ferns carry a few zero normals): fix those geometries once
  foot.root.traverse(o => { const n = o.isMesh && o.material !== MATS.toon && o.material !== MATS.sway && o.geometry?.attributes?.normal; if (!n) return; let fixed = 0;
    for (let i = 0; i < n.count; i++) if (!(Math.abs(n.getX(i)) + Math.abs(n.getY(i)) + Math.abs(n.getZ(i)) > 1e-6)) { n.setXYZ(i, 0, 1, 0); fixed++; } if (fixed) n.needsUpdate = true; });
  // ---- berth markers: a gold plate where you step ashore + white slot ends on the water (the piers themselves are Raul's coast art) ----
  const k = new Kit();
  for (const b of layout.berths) { const fx = Math.sin(b.yaw), fz = Math.cos(b.yaw);
    k.add(new THREE.BoxGeometry(1.0, 0.05, 1.0), GOLD, { m: M(b.ashore.x, (b.ashore.y ?? layout.deckY) + 0.03, b.ashore.z, b.yaw), mat: 0, outline: false });
    for (const [bx, bz] of b.bollards || []) { const y = b.ashore.y ?? layout.deckY; // [v117] iron mooring bollards (bow + stern line)
      k.add(new THREE.CylinderGeometry(0.26, 0.32, 0.62, 8), 0x2b2b30, { m: M(bx, y + 0.31, bz, 0), mat: 0 });
      k.add(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 8), 0x3a3a40, { m: M(bx, y + 0.66, bz, 0), mat: 0 }); }
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(0.14, 0.05, 2.2), 0xffffff, { m: M(b.x + fx * s * b.len / 2, 0.35, b.z + fz * s * b.len / 2, b.yaw + Math.PI / 2), mat: 0, outline: false }); }
  const quay = k.build(MATS, OUT); quay.name = 'onfoot_berths'; root.add(quay);
  // [Emerly perf-v304] freeze the foot island root (named 'foot' by createFoot) + static berth markers; never the whole scene
  if (foot?.root) freezeStatic(foot.root);
  freezeStatic(quay);
  // ---- walk API (harbor coords) ----
  const decks = layout.decks.map(d => ({ ...d, c: Math.cos(d.yaw), s: Math.sin(d.yaw) }));
  const SEA_SWELL = !(typeof location !== 'undefined' && /[?&]seaswell=0(&|$)/.test(location.search));
  const DECK_COLL = !(typeof location !== 'undefined' && /[?&]deckcoll=0/.test(location.search));
  function deckAt(x, z) { let y = null; for (const d of decks) { const dx = x - d.x, dz = z - d.z, along = dx * d.s + dz * d.c, across = dx * d.c - dz * d.s;
    if (Math.abs(along) <= d.hl && Math.abs(across) <= d.hw - 0.35) y = Math.max(y ?? -1e9, d.y); } return y; }
  const toF = layout.harborToFoot;
  function ground(x, z) { const d = deckAt(x, z), [fx, fz] = toF(x, z), g = foot.groundAt(fx, fz); return d !== null ? Math.max(d, g) : g; }
  // [Raul] still-water surface (null = dry) and where you stand: swimming = feet FOOT_SWIM.float under it, else the ground / deck
  // [v348] t1833u BANKSY "make sure ... don't go under water or fly with Water update, same with swimming": with foot_shallows gone the ONE
  // ocean (js/ocean.js, same waveHeight on CPU + GPU) is the sea you see, so a sea swimmer floats on the LIVE swell at (x, z, t) instead of a
  // flat y = 0.05 (under the crests / over the troughs). The sunk river mouth = the higher of its ribbon and the swell (no step swimming out);
  // the cove, the lagoon and the inland river keep their exact still / river heights. &seaswell=0 = the old flat sea.
  function water(x, z) { if (deckAt(x, z) !== null || !foot.waterAt) return null; const [fx, fz] = toF(x, z), s = foot.waterAt(fx, fz);
    if (s === null || !SEA_SWELL) return s; const W = FM.WATER_KIND, k = W?.k;
    if (k === 'sea') return FM.FOOT_SWIM.seaY + waveHeight(x, z, uTime?.value || 0);
    if (k === 'river' && mouthSea(W.h) > 0) return Math.max(mouthSink(s, W.h), FM.FOOT_SWIM.seaY + waveHeight(x, z, uTime?.value || 0));
    return s; }
  function stand(x, z) { const g = ground(x, z), s = water(x, z); return s !== null && s - g > FM.FOOT_SWIM.depth ? s - FM.FOOT_SWIM.float : g; }
  function blocked(x, z, px, pz) {
    if (FM.ADMIN_COL?.nocs.length && FM.nocAt(...toF(x, z))) return false; // [v346] owner PASS ZONE: the harbor decks' step rule too
    const d = deckAt(x, z);
    if (d !== null && DECK_COLL && FM.hitCollider?.(...toF(x, z))) return true; // [Timothy collisions] props ON a deck block too (bollards, coils, posts, rails, crates, stalls on the boardwalk / jetties / plaza deck zones were walk-through); ?deckcoll=0 = old
    if (d !== null) { if (px === undefined) return false; const from = stand(px, pz); return d - from > 2.4; } // up a step / stairs ([Raul] from the water: where you float)
    const [fx, fz] = toF(x, z);
    if (px !== undefined && deckAt(px, pz) !== null) return foot.blocked(fx, fz) || foot.H(fx, fz) - deckAt(px, pz) > 2.4; // stepping off a deck
    if (px === undefined) return foot.blocked(fx, fz);
    const [pfx, pfz] = toF(px, pz); return foot.blocked(fx, fz, pfx, pfz);
  }
  // [clothes-aaa] BANKSY t232u "make them walk in stores": while your head is inside a walk-in shop room (plazaTown CAM_ROOMS: the
  // clothes shop), the orbit camera stays inside it: pulled in along the boom to 0.3 m inside the walls and under the ceiling, the way
  // the hull / houses interiors clamp theirs. Called by js/onfoot/walker.js camPos (harbor coords; the foot frame is rigid, so the
  // boom fraction is the same in both).
  function camClamp(out, hx, hy, hz) {
    if (!CAM_ROOMS.length) return out;
    const [fx, fz] = toF(hx, hz);
    for (const R of CAM_ROOMS) {
      const dx = fx - R.x, dz = fz - R.z, rr = R.hw + R.hd; if (dx > rr || dx < -rr || dz > rr || dz < -rr) continue;   // [v5] AABB reject (runs per frame)
      const a = dx * R.ux + dz * R.uz, b = dx * R.vx + dz * R.vz;
      if (Math.abs(a) > R.hw || Math.abs(b) > R.hd || hy < R.y0 - 0.5 || hy > R.ceil + 0.5) continue;
      const [cx, cz] = toF(out.x, out.z), ca = (cx - R.x) * R.ux + (cz - R.z) * R.uz, cb = (cx - R.x) * R.vx + (cz - R.z) * R.vz;
      const m = 0.3, A = R.hw - m, B = R.hd - m; let t = 1;
      if (Math.abs(ca) > A && Math.abs(ca - a) > 1e-6) t = Math.min(t, (Math.sign(ca) * A - a) / (ca - a));
      if (Math.abs(cb) > B && Math.abs(cb - b) > 1e-6) t = Math.min(t, (Math.sign(cb) * B - b) / (cb - b));
      t = Math.max(0, Math.min(1, t));
      if (t < 1) out.set(hx + (out.x - hx) * t, hy + (out.y - hy) * t, hz + (out.z - hz) * t);
      if (out.y > R.ceil - 0.35) out.y = R.ceil - 0.35;
      return out; }
    return out; }
  const _cf = new THREE.Vector3();
  function update(cam, t, storm = 0) { const [fx, fz] = toF(cam.x, cam.z); _cf.set(fx, cam.y, fz); foot.update(_cf, t, { storm, camW: cam }); }
  // foot.js interact points (Squad Hall, digs, treasure cave) in harbor coords
  const footInteract = FM.INTERACT.map(q => { const [x, z] = layout.footToHarbor(q.x, q.z); return { ...q, x, z, src: q, kind: q.id.startsWith('dig') ? 'dig' : q.id, label: q.label.replace(/^E · /, '') }; });
  const stats = { ms: Math.round(performance.now() - t0), footBuildMs: FM.BUILD_MS, foot: foot.stats };
  return { root, foot, footGroup, atlas, ground, water, stand, blocked, deckAt, camClamp, layer: (y) => foot.setLayer?.(y), /* [path-fix2] the body height for high bridges (foot.js setLayer) */ update, footInteract, activate: (q, t) => foot.activate(q.src, t), rearm: (q) => { foot.rearm?.(q.src.id); q.used = false; }, stats, quay };
}

// ship colliders -> props.js harbor zone sets (clustered, so each ship only scans the circles near it)
export function colliderSets(circles, cell = 60) {
  const m = new Map();
  for (const c of circles) { const k = Math.floor(c.x / cell) + ':' + Math.floor(c.z / cell); if (!m.has(k)) m.set(k, []); m.get(k).push(c); }
  return [...m.values()].map(list => { const x = list.reduce((a, c) => a + c.x, 0) / list.length, z = list.reduce((a, c) => a + c.z, 0) / list.length;
    return { circles: list, bound: { x, z, r: Math.max(...list.map(c => Math.hypot(c.x - x, c.z - z) + c.r)) } }; });
}
