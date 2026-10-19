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
export function createIslands(quality) {
  const group = new THREE.Group();
  const r = rng(99);
  const rockMat = toon(0xffffff, rockTexture({ base: 0x56606a }));
  const mossMat = toon(0x3b5a44, null);
  const n = quality === 'low' ? 5 : 8;
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
  let lighthouse = null;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.4, d = 300 + r() * 70;
    const isl = new THREE.Group();
    const H = 25 + r() * 45, Wd = 18 + r() * 22;
    const main = new THREE.Mesh(rock([Wd, H, Wd * 0.8], 100 + i), rockMat); main.position.y = H * 0.25; isl.add(main);
    const cap = new THREE.Mesh(rock([Wd * 0.75, H * 0.18, Wd * 0.6], 200 + i), mossMat); cap.position.y = H * 1.0; isl.add(cap);
    for (let k = 0; k < 3; k++) {
      const s = 0.25 + r() * 0.3, m = new THREE.Mesh(rock([Wd * s, H * s * 0.9, Wd * s], 300 + i * 3 + k), rockMat);
      m.position.set((r() - 0.5) * Wd * 2.2, H * s * 0.2, (r() - 0.5) * Wd * 1.6); isl.add(m);
    }
    if (i === 1) {
      // lighthouse with a sweeping glow
      const lh = new THREE.Group();
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 16, 10), toon(0xe9e2d0)); tower.position.y = 8; lh.add(tower);
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.75, 3, 10), toon(0xfa0d0d)); stripe.position.y = 9; lh.add(stripe);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 12, 8), glowMat(0xffd27a, 3.5, { fog: false })); lamp.position.y = 18; lh.add(lamp);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3, 10), toon(0x161616)); roof.position.y = 21; lh.add(roof);
      const beamGeo = new THREE.ConeGeometry(9, 140, 16, 1, true); beamGeo.translate(0, -70, 0); beamGeo.rotateZ(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.42, 0.2), transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
      beam.position.y = 18; lh.add(beam);
      lh.position.y = H * 1.05; lh.scale.setScalar(1.3); isl.add(lh);
      lighthouse = beam;
    }
    isl.position.set(Math.cos(a) * d, -2, Math.sin(a) * d);
    isl.rotation.y = r() * 6.28;
    group.add(isl);
  }
  return { group, update(t, cam) { group.position.set(cam.x, 0, cam.z); if (lighthouse) lighthouse.rotation.y = t * 0.8; } };
}
