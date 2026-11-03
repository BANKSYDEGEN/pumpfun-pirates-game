// [Emerly] PUMPFUN PIRATES: builds the walkable harbor world for a layout (js/dock/layout.js) inside the GAME scene:
// the main island with Raul's coast town (js/island/foot.js coast mode, placed by the layout's frame) plus berth markers. Exposes the walk API in harbor coordinates (ground / blocked / interact).
import * as THREE from 'three';
import { toon } from '../toon.js';
import { makeAtlas } from '../island/art.js';
import { islandSurface, grassMaterial } from '../island/look.js';
import { Kit, M, outlineMaterial } from '../island/kit.js';
import { loadTownKit, loadNatureKit } from '../island/townkit.js';

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
  const skull = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = 'assets/skull_transparent.png'; });
  await document.fonts?.load('40px "Just Another Hand"').catch(() => {});
  const atlas = makeAtlas(skull);
  const MATS = { toon: islandSurface(toon(0xffffff, null, { vertexColors: true }), { low: LOW }), sway: islandSurface(toon(0xffffff, null, { vertexColors: true }), { low: LOW, uTime, sway: true }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), atlas: toon(0xffffff, atlas.tex, { side: THREE.DoubleSide }) };
  for (const m of [MATS.toon, MATS.sway]) nanSafe(m);
  const OUT = { plain: outlineMaterial(0.09), sway: outlineMaterial(0.09, uTime) };
  const KIT = await loadTownKit(LOW, renderer).catch(e => { console.warn('[onfoot] town kit failed', e); return null; });
  // [release] Raul's island art M2: the Blender nature kit (palms, jungle trees, ferns, rocks, cliffs, Skull Peak); ?nature=0 = procedural
  const NAT = KIT && new URLSearchParams(location.search).get('nature') !== '0' ? await loadNatureKit(LOW, renderer).catch(e => { console.warn('[onfoot] nature kit failed', e); return null; }) : null;
  await FM.PV?.plazaShopsReady?.(LOW); // [Timothy] Blender storefront models (plaza v2) before the plaza is built; resolves null on failure
  const foot = FM.createFoot({ scene: footGroup, isle: null, MATS, OUT, low: LOW, atlas, uTime, uWaves: ocean.uniforms.uWaves, renderer, kit: KIT, nat: NAT, decorHulls: false }); // live berths: no toy hulls parked in them
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
  // ---- walk API (harbor coords) ----
  const decks = layout.decks.map(d => ({ ...d, c: Math.cos(d.yaw), s: Math.sin(d.yaw) }));
  function deckAt(x, z) { let y = null; for (const d of decks) { const dx = x - d.x, dz = z - d.z, along = dx * d.s + dz * d.c, across = dx * d.c - dz * d.s;
    if (Math.abs(along) <= d.hl && Math.abs(across) <= d.hw - 0.35) y = Math.max(y ?? -1e9, d.y); } return y; }
  const toF = layout.harborToFoot;
  function ground(x, z) { const d = deckAt(x, z), [fx, fz] = toF(x, z), g = foot.groundAt(fx, fz); return d !== null ? Math.max(d, g) : g; }
  // [Raul] still-water surface (null = dry) and where you stand: swimming = feet FOOT_SWIM.float under it, else the ground / deck
  function water(x, z) { if (deckAt(x, z) !== null || !foot.waterAt) return null; const [fx, fz] = toF(x, z); return foot.waterAt(fx, fz); }
  function stand(x, z) { const g = ground(x, z), s = water(x, z); return s !== null && s - g > FM.FOOT_SWIM.depth ? s - FM.FOOT_SWIM.float : g; }
  function blocked(x, z, px, pz) {
    const d = deckAt(x, z);
    if (d !== null) { if (px === undefined) return false; const from = stand(px, pz); return d - from > 2.4; } // up a step / stairs ([Raul] from the water: where you float)
    const [fx, fz] = toF(x, z);
    if (px !== undefined && deckAt(px, pz) !== null) return foot.blocked(fx, fz) || foot.H(fx, fz) - deckAt(px, pz) > 2.4; // stepping off a deck
    if (px === undefined) return foot.blocked(fx, fz);
    const [pfx, pfz] = toF(px, pz); return foot.blocked(fx, fz, pfx, pfz);
  }
  const _cf = new THREE.Vector3();
  function update(cam, t, storm = 0) { const [fx, fz] = toF(cam.x, cam.z); _cf.set(fx, cam.y, fz); foot.update(_cf, t, { storm, camW: cam }); }
  // foot.js interact points (Squad Hall, digs, treasure cave) in harbor coords
  const footInteract = FM.INTERACT.map(q => { const [x, z] = layout.footToHarbor(q.x, q.z); return { ...q, x, z, src: q, kind: q.id.startsWith('dig') ? 'dig' : q.id, label: q.label.replace(/^E · /, '') }; });
  const stats = { ms: Math.round(performance.now() - t0), footBuildMs: FM.BUILD_MS, foot: foot.stats };
  return { root, foot, footGroup, atlas, ground, water, stand, blocked, deckAt, update, footInteract, activate: (q, t) => foot.activate(q.src, t), rearm: (q) => { foot.rearm?.(q.src.id); q.used = false; }, stats, quay };
}

// ship colliders -> props.js harbor zone sets (clustered, so each ship only scans the circles near it)
export function colliderSets(circles, cell = 60) {
  const m = new Map();
  for (const c of circles) { const k = Math.floor(c.x / cell) + ':' + Math.floor(c.z / cell); if (!m.has(k)) m.set(k, []); m.get(k).push(c); }
  return [...m.values()].map(list => { const x = list.reduce((a, c) => a + c.x, 0) / list.length, z = list.reduce((a, c) => a + c.z, 0) / list.length;
    return { circles: list, bound: { x, z, r: Math.max(...list.map(c => Math.hypot(c.x - x, c.z - z) + c.r)) } }; });
}
