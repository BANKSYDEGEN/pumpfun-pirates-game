// [v108] ONE shared lighthouse kit for the three harbor lighthouses (island mole, offshore rock, sandbar), procedural.
// Tapered tower (red / white bands or weathered stone) on a coursed plinth, door + step, windows climbing the tower, iron
// trim rings, gallery deck on corbels with an iron rail, glass lantern room with mullions, red dome, vent ball + weathervane,
// keeper's lean-to and dock clutter (crates, barrel, rope, a lamp), optional faceted rock base (wet-dark at the waterline) or a
// stone apron with beach grass. Inside: a rotating lens (emissive) that carries a soft fading beam + a lantern flare.
// Draw calls per lighthouse: body 1 (everything solid, vertex coloured, merged) + lens 1 + glass 1 (High only) + beam 1 +
// flare 1. No real light, no shadows; High may add ONE warm point light (opts.light). Candidate for Raul's Blender pipeline later.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from './toon.js';

const C = { white: 0xefe8d8, red: 0xc23a2e, stone: 0x9c958a, stoneD: 0x7d776e, stoneL: 0xb3ab9e, iron: 0x2a2b30, wood: 0x6e4a2c, woodD: 0x4f331e,
  roof: 0x8e2f24, glassF: 0x1d2733, gold: 0xd9a53a, sand: 0xd8c08a, grass: 0x5f8f3e, grassD: 0x48722f, rope: 0xc9a36b, rock: 0x6d6f73, rockD: 0x3c3f44 };
const rngOf = (s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const M = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
let _body = null, _glassMat = null, _lensMat = null, _beamMat = null, _haloMat = null, _beamGeo = null;
const bodyMat = () => (_body = _body || toon(0xffffff, null, { vertexColors: true }));

class Parts { constructor() { this.list = []; }
  add(geo, color, m, opt = {}) { let g = geo.index ? geo.toNonIndexed() : geo.clone(); geo.dispose?.(); g.applyMatrix4(m); g.deleteAttribute('uv'); if (opt.flat || !g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, col = new Float32Array(n * 3), c = new THREE.Color(color), P = g.attributes.position;
    for (let i = 0; i < n; i++) { let k = 1; if (opt.wet !== undefined) { const y = P.getY(i); k = y < opt.wet + 0.4 ? 0.55 : y < opt.wet + 1.6 ? 0.55 + 0.45 * (y - opt.wet - 0.4) / 1.2 : 1; }
      if (opt.jit) k *= 1 - opt.jit + opt.jit * 2 * ((Math.sin(i * 12.9898 + n) * 43758.5453) % 1 + 1) % 1;
      col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); this.list.push(g); }
  build() { const g = mergeGeometries(this.list, false); this.list.forEach(x => x.dispose()); g.computeBoundingSphere(); return g; } }

const cyl = (r0, r1, h, s, open = false) => new THREE.CylinderGeometry(r1, r0, h, s, 1, open); // (bottom r0, top r1)
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function jagged(r, h, seed, det) { const g = new THREE.IcosahedronGeometry(1, det), P = g.attributes.position, rr = rngOf(seed), cache = new Map();
  for (let i = 0; i < P.count; i++) { const key = `${P.getX(i).toFixed(3)},${P.getY(i).toFixed(3)},${P.getZ(i).toFixed(3)}`; if (!cache.has(key)) cache.set(key, 0.82 + rr() * 0.36); const s = cache.get(key);
    P.setXYZ(i, P.getX(i) * s * r, Math.min(P.getY(i) * s, 0.55) * h, P.getZ(i) * s * r); } return g; } // flat-topped (a ledge the plinth sits on)

// site: { height (tower m), style: 'bands'|'stone', base: 'rock'|'apron'|'none', baseR, wet (local y of the sea), hut, clutter, low, seed, light }
export function buildLighthouse(o = {}) {
  const low = !!o.low, Ht = o.height || 18, R0 = 0.16 * Ht + 0.2, R1 = R0 * 0.66, seg = low ? 12 : 20, rr = rngOf(o.seed || 7), P = new Parts();
  const stone = o.style === 'stone', A = o.yaw || 0; // A: the door / hut side
  // ---- base ----
  if (o.base === 'rock') { const rb = o.baseR || R0 + 6, hb = o.baseH || 7;
    P.add(jagged(rb, hb, (o.seed || 7) * 3 + 1, low ? 1 : 2), C.rock, M(0, -0.55 * hb + 0.05, 0, rr() * 6), { flat: true, wet: o.wet ?? -hb * 0.4, jit: 0.08 });
    for (let i = 0; i < (low ? 3 : 6); i++) { const a = rr() * 6.28, d = rb * (0.75 + rr() * 0.3), s = 1.2 + rr() * 2.2;
      P.add(jagged(s, s * 1.3, i + 40, 1), C.rock, M(Math.cos(a) * d, (o.wet ?? -3) + s * 0.2, Math.sin(a) * d, rr() * 6), { flat: true, wet: o.wet ?? -3, jit: 0.1 }); }
    for (let i = 0; i < (low ? 4 : 10); i++) { const a = rr() * 6.28, d = R0 + 1.6 + rr() * (rb - R0 - 2.6); // grass tufts on the ledge (inside the edge: no overhang)
      P.add(new THREE.ConeGeometry(0.5 + rr() * 0.5, 0.8 + rr() * 0.6, 5), i % 2 ? C.grass : C.grassD, M(Math.cos(a) * d, 0.3, Math.sin(a) * d, rr() * 6), { flat: true }); } }
  if (o.base === 'apron') { const ra = o.baseR || R0 + 4;
    P.add(cyl(ra + 0.4, ra, 0.9, 10), C.stoneD, M(0, 0.45, 0), { flat: true, jit: 0.06 }); P.add(cyl(ra - 0.2, ra - 0.4, 0.35, 10), C.stone, M(0, 1.05, 0), { flat: true, jit: 0.06 });
    for (let i = 0; i < (low ? 5 : 10); i++) { const a = i / (low ? 5 : 10) * 6.28 + rr() * 0.4, s = 0.6 + rr() * 0.9; P.add(jagged(s, s, i + 70, 1), C.rock, M(Math.cos(a) * (ra + 0.6), 0.1, Math.sin(a) * (ra + 0.6), rr() * 6), { flat: true, wet: 0.2, jit: 0.1 }); }
    for (let i = 0; i < (low ? 6 : 16); i++) { const a = rr() * 6.28, d = ra + 1.4 + rr() * 3; P.add(new THREE.ConeGeometry(0.25 + rr() * 0.25, 0.9 + rr() * 0.8, 4), i % 3 ? C.grass : C.grassD, M(Math.cos(a) * d, 0.35, Math.sin(a) * d, rr() * 6, 1, 1, 1, (rr() - 0.5) * 0.4), { flat: true }); } }
  const y0 = o.base === 'apron' ? 1.2 : 0;
  // ---- plinth (two stone courses) ----
  P.add(cyl(R0 + 1.3, R0 + 1.1, 1.0, 8), C.stoneD, M(0, y0 + 0.5, 0, Math.PI / 8), { flat: true, jit: 0.05 });
  P.add(cyl(R0 + 0.8, R0 + 0.6, 0.7, 8), C.stone, M(0, y0 + 1.35, 0, Math.PI / 8), { flat: true, jit: 0.05 });
  // ---- tower: bands (or stone courses) + iron trim rings ----
  const yb = y0 + 1.7, NB = stone ? Math.round(Ht / 1.6) : 6, rAt = (y) => R0 + (R1 - R0) * (y / Ht);
  for (let b = 0; b < NB; b++) { const a = b / NB * Ht, h = Ht / NB, col = stone ? (b % 3 === 1 ? C.stoneD : rr() > 0.5 ? C.stone : C.stoneL) : (b % 2 ? C.red : C.white);
    P.add(cyl(rAt(a), rAt(a + h), h, seg, true), col, M(0, yb + a + h / 2, 0), stone ? { jit: 0.05 } : {}); }
  P.add(new THREE.CircleGeometry(R0, seg).rotateX(-Math.PI / 2), C.stoneD, M(0, yb + 0.01, 0));
  const rings = stone ? [0.33, 0.66] : [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]; if (low) rings.length = Math.min(rings.length, 2);
  for (const f of rings) { const y = f * Ht; P.add(cyl(rAt(y) + 0.1, rAt(y) + 0.1, 0.18, seg, true), C.iron, M(0, yb + y, 0)); }
  // door + step + frame (the A side), windows climbing round the tower with sills
  const dir = (a, r, y) => [Math.cos(a) * r, y, -Math.sin(a) * r];
  { const [x, , z] = dir(A, R0 - 0.05, 0); P.add(box(0.35, 2.4, 1.5), C.stoneL, M(x, yb + 1.15, z, A)); P.add(box(0.3, 2.0, 1.05), C.woodD, M(x + Math.cos(A) * 0.08, yb + 1.0, z - Math.sin(A) * 0.08, A));
    P.add(box(1.0, 0.3, 1.8), C.stone, M(Math.cos(A) * (R0 + 1.4), y0 + 0.15, -Math.sin(A) * (R0 + 1.4), A), { flat: true }); }
  for (const [f, da] of (low ? [[0.42, 1.4], [0.75, 2.8]] : [[0.3, 1.2], [0.55, 2.6], [0.8, 4.0]])) { const y = f * Ht, a = A + da, [x, , z] = dir(a, rAt(y) - 0.02, 0);
    P.add(box(0.25, 1.1, 0.7), C.glassF, M(x, yb + y, z, a)); P.add(box(0.4, 0.14, 0.9), C.stoneL, M(x + Math.cos(a) * 0.08, yb + y - 0.62, z - Math.sin(a) * 0.08, a)); }
  // ---- gallery: corbels, deck, rail ----
  const yg = yb + Ht, Rg = R1 + 1.05;
  const NC = low ? 8 : 16; for (let i = 0; i < NC; i++) { const a = i / NC * 6.283; P.add(box(0.9, 0.7, 0.35), C.stoneL, M(Math.cos(a) * (R1 + 0.35), yg - 0.4, -Math.sin(a) * (R1 + 0.35), a, 1, 1, 1, 0, -0.35)); }
  P.add(cyl(Rg, Rg, 0.32, seg), C.iron, M(0, yg, 0));
  const NP = low ? 10 : 20; for (let i = 0; i < NP; i++) { const a = i / NP * 6.283; P.add(box(0.08, 1.05, 0.08), C.iron, M(Math.cos(a) * (Rg - 0.1), yg + 0.68, -Math.sin(a) * (Rg - 0.1))); }
  P.add(new THREE.TorusGeometry(Rg - 0.1, 0.06, 4, seg * 2).rotateX(Math.PI / 2), C.iron, M(0, yg + 1.2, 0));
  if (!low) P.add(new THREE.TorusGeometry(Rg - 0.1, 0.035, 4, seg * 2).rotateX(Math.PI / 2), C.iron, M(0, yg + 0.7, 0));
  // ---- lantern room: iron base wall, mullions, top ring; dome, vent ball, weathervane ----
  const RL = R1 * 0.82, yl = yg + 0.16, hw = 0.7, hg = 2.3;
  P.add(cyl(RL, RL, hw, seg), C.red, M(0, yl + hw / 2, 0));
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * 6.283; P.add(box(0.12, hg, 0.12), C.iron, M(Math.cos(a) * RL, yl + hw + hg / 2, -Math.sin(a) * RL)); }
  P.add(cyl(RL + 0.12, RL + 0.12, 0.22, seg), C.iron, M(0, yl + hw + hg + 0.1, 0));
  const yd = yl + hw + hg + 0.2; P.add(new THREE.SphereGeometry(RL + 0.15, seg, low ? 4 : 8, 0, 6.283, 0, Math.PI / 2), C.roof, M(0, yd, 0, 0, 1, 0.8, 1));
  P.add(cyl(0.22, 0.22, 0.5, 8), C.iron, M(0, yd + (RL + 0.15) * 0.8 + 0.2, 0)); P.add(new THREE.SphereGeometry(0.34, 10, 8), C.gold, M(0, yd + (RL + 0.15) * 0.8 + 0.6, 0));
  const yv = yd + (RL + 0.15) * 0.8 + 0.9; P.add(cyl(0.04, 0.04, 1.6, 4), C.iron, M(0, yv + 0.8, 0));
  if (!low) { P.add(box(1.4, 0.06, 0.06), C.iron, M(0, yv + 0.8, 0)); P.add(box(0.06, 0.06, 1.4), C.iron, M(0, yv + 0.8, 0)); }
  P.add(box(1.3, 0.28, 0.04), C.iron, M(0, yv + 1.35, 0, 0.6)); P.add(new THREE.ConeGeometry(0.18, 0.4, 4).rotateZ(-Math.PI / 2), C.iron, M(Math.cos(0.6) * 0.75, yv + 1.35, -Math.sin(0.6) * 0.75, 0.6));
  // ---- keeper's lean-to + clutter ----
  if (o.hut) { const ha = A + 0.9, d = R0 + 3.4, [hx, , hz] = dir(ha, d, 0), w = 3.4, dd = 2.8, hh = 2.4;
    P.add(box(dd, hh, w), C.stoneL, M(hx, y0 + hh / 2, hz, ha), { jit: 0.04 }); P.add(box(dd + 0.5, 0.25, w + 0.5), C.roof, M(hx, y0 + hh + 0.35, hz, ha, 1, 1, 1, 0, 0.32));
    P.add(box(0.25, 1.6, 0.9), C.woodD, M(hx + Math.cos(ha) * dd / 2, y0 + 0.8, hz - Math.sin(ha) * dd / 2, ha)); P.add(box(0.5, 1.2, 0.5), C.stoneD, M(hx - Math.cos(ha) * 0.6, y0 + hh + 0.9, hz + Math.sin(ha) * 0.6 + 1, ha)); }
  if (o.clutter !== false) { const ca = A - 0.7, [cx, , cz] = dir(ca, R0 + 2.0, 0);
    P.add(box(0.9, 0.9, 0.9), C.wood, M(cx, y0 + 0.45, cz, ca + 0.3), { flat: true }); P.add(box(0.7, 0.7, 0.7), C.woodD, M(cx + 0.2, y0 + 1.25, cz + 0.1, ca + 0.9), { flat: true });
    if (!low) { P.add(cyl(0.4, 0.4, 1.0, 10), C.wood, M(cx + Math.cos(ca + 1.5) * 1.3, y0 + 0.5, cz - Math.sin(ca + 1.5) * 1.3));
      P.add(new THREE.TorusGeometry(0.45, 0.13, 5, 12).rotateX(Math.PI / 2), C.rope, M(cx - Math.cos(ca + 1.2) * 1.2, y0 + 0.14, cz + Math.sin(ca + 1.2) * 1.2));
      P.add(new THREE.TorusGeometry(0.38, 0.12, 5, 12).rotateX(Math.PI / 2), C.rope, M(cx - Math.cos(ca + 1.2) * 1.2, y0 + 0.34, cz + Math.sin(ca + 1.2) * 1.2)); }
    const [lx, , lz] = dir(A + 0.35, R0 + 0.9, 0); P.add(cyl(0.05, 0.05, 2.2, 4), C.iron, M(lx, y0 + 1.1, lz)); P.add(box(0.35, 0.45, 0.35), C.gold, M(lx, y0 + 2.35, lz)); }
  const g = new THREE.Group(); g.name = 'lighthouse';
  const body = new THREE.Mesh(P.build(), bodyMat()); body.name = 'lh_body'; body.castShadow = body.receiveShadow = !low; g.add(body);
  const lensY = yl + hw + hg * 0.5;
  if (!low) { _glassMat = _glassMat || new THREE.MeshBasicMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.18, depthWrite: false, fog: false });
    const glass = new THREE.Mesh(cyl(RL - 0.03, RL - 0.03, hg, seg, true), _glassMat); glass.position.y = yl + hw + hg / 2; glass.renderOrder = 3; g.add(glass); }
  const light = lighthouseLight({ lensR: RL * 0.55, lensH: hg * 0.7, light: o.light, low }); light.position.y = lensY; g.add(light);
  g.userData.lensY = lensY; g.userData.top = yv + 1.6; g.userData.R = Math.max(R0 + 1.3, o.base === 'rock' ? (o.baseR || R0 + 6) : o.base === 'apron' ? (o.baseR || R0 + 4) + 1 : 0);
  return g;
}
// ---- the light: rotating lens (emissive drum) + soft beam (two additive cones fading along their length + at the edges) + flare
const BEAM_L = 150, BEAM_R = 12, SPIN = 0.55; // rad/s: a sweep every ~11 s per side
function beamGeo() { if (_beamGeo) return _beamGeo;
  const one = (s) => { const g = new THREE.ConeGeometry(BEAM_R, BEAM_L, 24, 8, true); g.translate(0, -BEAM_L / 2, 0); g.rotateZ(s * Math.PI / 2); return g.toNonIndexed(); };
  _beamGeo = mergeGeometries([one(1), one(-1)], false); _beamGeo.deleteAttribute('uv'); _beamGeo.computeBoundingSphere(); return _beamGeo; }
function beamMat() { return (_beamMat = _beamMat || new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color(1.0, 0.86, 0.58) }, uOp: { value: 0.2 } },
  vertexShader: `varying float vT; varying vec3 vN; varying vec3 vV;
    void main() { vT = abs(position.x) / ${BEAM_L.toFixed(1)}; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform vec3 uCol; uniform float uOp; varying float vT; varying vec3 vN; varying vec3 vV;
    void main() { float edge = abs(dot(normalize(vN), normalize(vV)));   // 1 through the middle of the cone, 0 at its silhouette: soft edges
      float a = uOp * pow(edge, 1.8) * pow(1.0 - clamp(vT, 0.0, 1.0), 2.4) * smoothstep(0.0, 0.06, vT);
      gl_FragColor = vec4(uCol * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false })); }
function haloMat() { if (_haloMat) return _haloMat;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), r = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,240,205,1)'); r.addColorStop(0.22, 'rgba(255,214,150,0.5)'); r.addColorStop(1, 'rgba(255,190,110,0)'); x.fillStyle = r; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (_haloMat = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.6 })); }
export function lighthouseLight(o = {}) {
  const g = new THREE.Group(); g.name = 'lh_light'; const rot = new THREE.Group(); rot.name = 'lh_rot'; g.add(rot);
  _lensMat = _lensMat || new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.84, 0.5).multiplyScalar(1.35), fog: false, toneMapped: false });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(o.lensR || 0.9, o.lensR || 0.9, o.lensH || 1.6, 8), _lensMat); lens.name = 'lh_lens'; rot.add(lens);
  const beam = new THREE.Mesh(beamGeo(), beamMat()); beam.name = 'lh_beam'; beam.renderOrder = 4; beam.frustumCulled = false; rot.add(beam);
  const halo = new THREE.Sprite(haloMat()); halo.name = 'lh_halo'; const hs = 4.5 * (o.lensR || 0.9) / 0.9 + 3; halo.scale.setScalar(hs); halo.userData.hs = hs; halo.renderOrder = 5; g.add(halo);
  if (o.light && !o.low) { const L = new THREE.PointLight(0xffc670, 14, 60, 1.6); g.add(L); }
  return g;
}
// per frame; works on clones (finds parts by name, no closures). cam = camera world position.
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function tickLighthouse(root, t, cam, storm = 0) {
  const g = root && (root.name === 'lh_light' ? root : root.getObjectByName('lh_light')); if (!g) return;
  const rot = g.children[0], halo = g.getObjectByName('lh_halo'), a = t * SPIN + (root.userData.phase || 0); rot.rotation.y = a;
  g.getWorldPosition(_v); g.getWorldQuaternion(_q); _e.setFromQuaternion(_q, 'YXZ');
  const bear = Math.atan2(-(cam.z - _v.z), cam.x - _v.x), face = Math.pow(Math.abs(Math.cos(a + _e.y - bear)), 30);
  if (halo) halo.scale.setScalar(halo.userData.hs * (1 + 1.3 * face));
  _beamMat && (_beamMat.uniforms.uOp.value = 0.24 + 0.1 * storm);
}
