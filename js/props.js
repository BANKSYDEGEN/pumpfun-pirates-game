// Stylized props: treasure chests with light beams, and storm-shrouded rock islands on the horizon.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toon, glowMat, outlineFor, woodTexture, goldTexture, rockTexture, rng } from './toon.js';

// ---------- treasure chest (template, cloned per drop: geometry + materials are shared) ----------
let _chest = null;
function chestTemplate() {
  if (_chest) return _chest;
  const g = new THREE.Group();
  const wood = toon(0xffffff, woodTexture({ base: 0x8a5530, rows: 4, seed: 77, w: 256, h: 128 }));
  const gold = toon(0xffffff, goldTexture({ base: 0xffcd77 }));
  const iron = toon(0x2a2420);
  const box = new THREE.Mesh(new RoundedBoxGeometry(1.7, 1.0, 1.15, 2, 0.12), wood); box.position.y = 0.5; g.add(box);
  const lidGeo = new THREE.CylinderGeometry(0.58, 0.58, 1.7, 12, 1, false, 0, Math.PI); lidGeo.rotateZ(Math.PI / 2);
  const lid = new THREE.Mesh(lidGeo, wood); lid.position.set(0, 1.0, -0.12); lid.rotation.x = -0.55; g.add(lid);
  for (const x of [-0.6, 0.6]) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.16, 1.04, 1.2, 1, 0.04), gold); b.position.set(x, 0.5, 0); g.add(b);
  }
  const lock = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.36, 0.1, 1, 0.04), gold); lock.position.set(0, 0.8, 0.6); g.add(lock);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.04), iron); key.position.set(0, 0.78, 0.66); g.add(key);
  // heaped coins + glowing gems
  const coinGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.06, 10);
  const r = rng(5);
  const coinGlow = glowMat(0xffcd77, 1.35);
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Mesh(coinGeo, i % 3 ? gold : coinGlow);
    c.position.set((r() - 0.5) * 1.3, 1.02 + r() * 0.25, (r() - 0.5) * 0.8); c.rotation.set(r() * 1.2, r() * 3, r() * 1.2); g.add(c);
  }
  const gemCols = [0xfa0d0d, 0x4ee37a, 0x5ab8ff];
  for (let i = 0; i < 3; i++) {
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), glowMat(gemCols[i], 2.2));
    gem.position.set((i - 1) * 0.42, 1.28, (r() - 0.5) * 0.4); g.add(gem);
  }
  g.add(outlineFor(box, 0.05), outlineFor(lid, 0.05));
  // vertical light beam so loot is easy to spot
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * (0.55 + 0.25 * sin(vUv.y * 30.0 - uTime * 6.0)); a *= 0.6 + 0.4 * sin(vUv.x * 6.2831 * 3.0 + uTime * 2.0); gl_FragColor = vec4(vec3(1.5, 1.05, 0.45) * a, a); }',
  });
  const beamGeo = new THREE.CylinderGeometry(0.75, 1.2, 26, 16, 1, true); beamGeo.translate(0, 13, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.renderOrder = 2; g.add(beam);
  g.userData.beamMat = beamMat;
  _chest = g;
  return g;
}
export function makeChest() { const c = chestTemplate().clone(); c.userData.shared = true; return c; }
export function chestTime(t) { if (_chest) _chest.userData.beamMat.uniforms.uTime.value = t; }

// ---------- horizon islands ----------
// A ring of craggy sea stacks that follows the camera (pure backdrop, no collisions), one with a lighthouse.
// [solid rocks] Islands / sea stacks / the lighthouse are SOLID and fixed in the world (they used to ride along with the
// camera as a backdrop). Layout is a deterministic grid (same on every PvP client): each CELL may hold one island design,
// jittered and rotated by a hash of the cell. Only the 3x3 cells around the camera are drawn (shared-geometry clones from a
// small pool). Every rock has a waterline circle used for ship push-out (slide + speed damping, no damage), AI avoidance,
// cannonball stops and spawn checks. Cheap: a cell lookup + a handful of circle tests per ship per frame.
export const ISLAND_CELL = 560;
const DESIGNS = 8, CLEAR_R = 190; // no rocks this close to the world origin (solo start, PvP arena centre)
const hash2 = (i, j, k = 0) => { const h = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return h - Math.floor(h); };
export function createIslands(quality) {
  const group = new THREE.Group();
  const rockMat = toon(0xffffff, rockTexture({ base: 0x56606a }));
  const mossMat = toon(0x3b5a44, null);
  function rock(size, seed) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position, rr = rng(seed);
    const cache = new Map();
    for (let i = 0; i < p.count; i++) {
      const k = `${p.getX(i).toFixed(2)},${p.getY(i).toFixed(2)},${p.getZ(i).toFixed(2)}`;
      if (!cache.has(k)) cache.set(k, 0.75 + rr() * 0.5);
      const s = cache.get(k);
      p.setXYZ(i, p.getX(i) * s, p.getY(i) * s, p.getZ(i) * s);
    }
    g.scale(size[0], size[1], size[2]); g.computeVertexNormals();
    return g;
  }
  // waterline circle of a rock mesh (island-local): widest vertex ring within ±3 m of the sea surface
  function footprint(mesh, baseY) {
    const p = mesh.geometry.attributes.position; let r = 0, top = 0, any = 0, rAll = 0;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) + mesh.position.y + baseY, d = Math.hypot(p.getX(i), p.getZ(i));
      top = Math.max(top, y); rAll = Math.max(rAll, d);
      if (Math.abs(y) < 3) { r = Math.max(r, d); any++; }
    }
    return { x: mesh.position.x, z: mesh.position.z, r: (any ? r : rAll * 0.6) * 0.96, h: top };
  }
  const designs = [];
  for (let i = 0; i < DESIGNS; i++) {
    const r = rng(99 + i * 17);
    const isl = new THREE.Group(), circles = [];
    const H = 25 + r() * 45, Wd = 18 + r() * 22;
    const main = new THREE.Mesh(rock([Wd, H, Wd * 0.8], 100 + i), rockMat); main.position.y = H * 0.25; isl.add(main);
    const cap = new THREE.Mesh(rock([Wd * 0.75, H * 0.18, Wd * 0.6], 200 + i), mossMat); cap.position.y = H * 1.0; isl.add(cap);
    circles.push(footprint(main, -2));
    for (let k = 0; k < 3; k++) {
      const s = 0.25 + r() * 0.3, m = new THREE.Mesh(rock([Wd * s, H * s * 0.9, Wd * s], 300 + i * 3 + k), rockMat);
      m.position.set((r() - 0.5) * Wd * 2.2, H * s * 0.2, (r() - 0.5) * Wd * 1.6); isl.add(m);
      const c = footprint(m, -2); if (c.r > 1.5 && c.h > 0) circles.push(c);
    }
    let beamIdx = -1;
    if (i === 1 || i === 5) {
      // lighthouse with a sweeping glow
      const lh = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 16, 10), toon(0xe9e2d0)); tower.position.y = 8; lh.add(tower);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.75, 3, 10), toon(0xfa0d0d)); stripe.position.y = 9; lh.add(stripe);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), glowMat(0xffd27a, 3.5, { fog: false })); lamp.position.y = 18; lh.add(lamp);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3, 10), toon(0x161616)); roof.position.y = 21; lh.add(roof);
      const beamGeo = new THREE.ConeGeometry(9, 140, 16, 1, true); beamGeo.translate(0, -70, 0); beamGeo.rotateZ(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.42, 0.2), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      beam.position.y = 18; beam.name = 'beam'; lh.add(beam);
      lh.position.y = H * 1.05; lh.scale.setScalar(1.3); isl.add(lh);
      circles[0].h = Math.max(circles[0].h, H * 1.05 + 28); // the tower stops cannonballs too
      beamIdx = 1;
    }
    isl.traverse(o => { if (o.isMesh) o.userData.sharedGeo = true; });
    designs.push({ isl, circles, lighthouse: beamIdx >= 0 });
  }
  // ---- world layout (pure function of the cell: identical for every client) ----
  const cellInfo = new Map();
  function cell(ci, cj) {
    const key = `${ci},${cj}`; let c = cellInfo.get(key); if (c !== undefined) return c;
    c = null;
    if (hash2(ci, cj, 1) < 0.62) {
      const x = (ci + 0.5 + (hash2(ci, cj, 2) - 0.5) * 0.5) * ISLAND_CELL, z = (cj + 0.5 + (hash2(ci, cj, 3) - 0.5) * 0.5) * ISLAND_CELL;
      if (Math.hypot(x, z) > CLEAR_R + 60) {
        const d = Math.floor(hash2(ci, cj, 4) * DESIGNS) % DESIGNS, rot = hash2(ci, cj, 5) * Math.PI * 2, cs = Math.cos(rot), sn = Math.sin(rot);
        // world circles (Object3D.rotation.y maps local (x,z) -> (x cos + z sin, -x sin + z cos))
        const circles = designs[d].circles.map(k => ({ x: x + k.x * cs + k.z * sn, z: z - k.x * sn + k.z * cs, r: k.r, h: k.h - 0 }));
        c = { key, d, x, z, rot, circles };
      }
    }
    if (cellInfo.size > 4000) cellInfo.clear(); // bounded cache (pure function, cheap to recompute)
    cellInfo.set(key, c); return c;
  }
  const near = [];
  function circlesNear(x, z) { // circles in the cell under (x,z) and its neighbours (a cell's island stays inside its 3x3)
    near.length = 0; const ci = Math.floor(x / ISLAND_CELL), cj = Math.floor(z / ISLAND_CELL);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = cell(ci + a, cj + b); if (c) for (const k of c.circles) near.push(k); }
    return near;
  }
  // ---- rendering: 3x3 cells around the camera, clones of the designs from a pool ----
  const pool = designs.map(() => []), live = new Map();
  let lastCell = '';
  function refresh(cx, cz) {
    const ci = Math.floor(cx / ISLAND_CELL), cj = Math.floor(cz / ISLAND_CELL), k = `${ci},${cj}`; if (k === lastCell) return; lastCell = k;
    const want = new Set();
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = cell(ci + a, cj + b); if (c) want.add(c.key); }
    for (const [key, o] of live) if (!want.has(key)) { group.remove(o.obj); pool[o.d].push(o.obj); live.delete(key); }
    for (const key of want) if (!live.has(key)) {
      const c = cellInfo.get(key), obj = pool[c.d].pop() || designs[c.d].isl.clone();
      obj.position.set(c.x, -2, c.z); obj.rotation.y = c.rot; group.add(obj);
      live.set(key, { obj, d: c.d, beam: designs[c.d].lighthouse ? obj.getObjectByName('beam') : null });
    }
  }
  const shipR = (s) => { const u = s.mesh?.userData; return u ? Math.max(u.beam || 4, (u.len || 14) * 0.42) : 6; };
  return {
    group,
    update(t, cam) { refresh(cam.x, cam.z); for (const o of live.values()) if (o.beam) o.beam.rotation.y = t * 0.8; },
    circlesNear,
    // push a ship out of any rock it overlaps: slide along the rock, bleed speed by how head-on the hit is. No damage.
    collide(s, dt) {
      const R = shipR(s); let hit = false;
      for (const c of circlesNear(s.x, s.z)) {
        const dx = s.x - c.x, dz = s.z - c.z, d = Math.hypot(dx, dz), min = c.r + R;
        if (d >= min) continue;
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        s.x = c.x + nx * min; s.z = c.z + nz * min; hit = true;
        const into = -(Math.sin(s.yaw) * nx + Math.cos(s.yaw) * nz); // 1 = straight at the rock
        if (into > 0) s.speed *= Math.max(0.2, 1 - into * Math.min(1, dt * 6));
      }
      if (hit) s.rockT = 0.4; else if (s.rockT) s.rockT = Math.max(0, s.rockT - dt);
      return hit;
    },
    // AI look-ahead: a turn input that swings the bow away from a rock in its path (null = path is clear)
    avoid(s) {
      const R = shipR(s) + 6, hx = Math.sin(s.yaw), hz = Math.cos(s.yaw), look = R + 16 + Math.max(0, s.speed) * 2.2;
      let best = null, bt = Infinity;
      for (const c of circlesNear(s.x, s.z)) {
        const dx = c.x - s.x, dz = c.z - s.z, along = dx * hx + dz * hz; if (along < -c.r || along > look + c.r) continue;
        const side = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw); // >0: rock on the starboard (+turn) side
        if (Math.abs(side) > c.r + R) continue;
        if (along < bt) { bt = along; best = side; }
      }
      return best === null ? null : (best > 0 ? -1 : 1);
    },
    // a free spot near (x, z) for a ship of radius r (spawns, respawns)
    freeSpot(x, z, r = 12) {
      for (let tries = 0; tries < 12; tries++) {
        let ok = true;
        for (const c of circlesNear(x, z)) { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), min = c.r + r + 4; if (d < min) { ok = false; const k = (min - d) + 2; x += (d > 1e-4 ? dx / d : 1) * k; z += (d > 1e-4 ? dz / d : 0) * k; } }
        if (ok) break;
      }
      return [x, z];
    },
    isFree(x, z, r = 12) { for (const c of circlesNear(x, z)) if (Math.hypot(x - c.x, z - c.z) < c.r + r + 4) return false; return true; },
    hitBall(p) { if (p.y > 80) return false; for (const c of circlesNear(p.x, p.z)) if (p.y < c.h && Math.hypot(p.x - c.x, p.z - c.z) < c.r * (p.y > 0 ? Math.max(0.35, 1 - p.y / Math.max(1, c.h)) : 1)) return true; return false; },
  };
}

