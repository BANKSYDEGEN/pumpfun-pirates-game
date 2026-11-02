// [Raul] PUMPFUN PIRATES island art: a bright, toy-like lobby island (future dockable island / social lobby).
// Everything static is merged by Kit into a few meshes: terrain + props (vertex colours, toon), palm fronds (sway),
// glow (windows, lanterns, runes), atlas (signs, posters, flags) and ONE outline shell.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from '../toon.js';
import { Kit, M } from './kit.js';

// ---------- layout (world units; a ship is 17 long) ----------
export const SPOTS = {
  plaza: { x: 0, z: 4 },
  tavern: { x: -21, z: -10, yaw: 0.75 },
  chest: { x: 25, z: -12 },
  dig: { x: -6, z: -33 },
  board: { x: 13, z: 40, yaw: -1.25 },
  dock: { x: 0, z0: 44, z1: 98, w: 4.6, y: 1.7 },
  moor: [{ x: -7.4, z: 83, yaw: 0 }, { x: 7.6, z: 80, yaw: Math.PI }],
};
const PATHS = [[[0, 46], [0, 22], [0, 4]], [[0, 4], [-15, -5], [-19, -8]], [[0, 4], [12, -6], [22, -11]], [[0, 4], [-3, -18], [-6, -28]], [[0, 30], [9, 38]]];

// ---------- terrain ----------
function edgeR(a) { return 50 + 5.5 * Math.sin(3 * a + 1) + 3 * Math.sin(5 * a + 2) + 1.5 * Math.sin(9 * a); }
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function segDist(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}
function pathDist(x, z) { let d = 1e9; for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, p[i], p[i + 1])); return d; }
export function groundY(x, z) {
  const r = Math.hypot(x, z), e = edgeR(Math.atan2(z, x));
  const top = 3.4 + 0.7 * Math.sin(x * 0.09 + 1) * Math.cos(z * 0.08) + 1.6 * Math.exp(-((x + 21) ** 2 + (z + 10) ** 2) / 260) // tavern knoll
    - 0.35 * Math.exp(-((x - SPOTS.dig.x) ** 2 + (z - SPOTS.dig.z) ** 2) / 30); // dig patch dips a touch
  let h = top * (1 - sm(e - 5, e + 1, r)) + 1.0 * sm(e - 5, e + 1, r); // grass plateau -> ledge
  h -= 1.15 * sm(e + 1, e + 13, r); // beach slope to the waterline
  h -= 5.5 * sm(e + 12, e + 30, r); // shelf under the water
  return h;
}
const C = (h) => new THREE.Color(h);
const GRASS = C(0x5fd44a), GRASS2 = C(0x8ae95a), SAND = C(0xffe3a1), WET = C(0xe9c47c), PATH = C(0xf2d39a), PLAZA = C(0xf4e2bb), DEEP = C(0x3fb7c9);
function groundColor(x, z, h) {
  const r = Math.hypot(x, z), e = edgeR(Math.atan2(z, x)), c = new THREE.Color();
  const grass = 1 - sm(e - 4.5, e - 3.5, r); // crisp toy edge between grass and sand
  c.copy(SAND).lerp(WET, sm(0.35, -0.2, h)).lerp(DEEP, sm(-0.6, -3.5, h));
  const g = GRASS.clone().lerp(GRASS2, 0.5 + 0.5 * Math.sin(x * 0.21) * Math.sin(z * 0.17));
  c.lerp(g, grass);
  const pd = pathDist(x, z); c.lerp(PATH, (1 - sm(2.2, 3.0, pd)) * grass);
  c.lerp(PLAZA, 1 - sm(8.5, 9.3, Math.hypot(x - SPOTS.plaza.x, z - SPOTS.plaza.z)));
  c.lerp(SAND, 1 - sm(6.2, 7.0, Math.hypot(x - SPOTS.dig.x, z - SPOTS.dig.z)));
  return c;
}
function terrain(kit, low) {
  const rings = low ? 48 : 80, segs = low ? 90 : 150, R = 112;
  const pos = [], col = [], idx = [];
  pos.push(0, groundY(0, 0), 0); const c0 = groundColor(0, 0, groundY(0, 0)); col.push(c0.r, c0.g, c0.b);
  for (let i = 1; i <= rings; i++) {
    const r = R * Math.pow(i / rings, 1.15);
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, y = groundY(x, z), c = groundColor(x, z, y);
      pos.push(x, y, z); col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + (j + 1) % segs, c = a + segs, d = b + segs;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const ng = g.toNonIndexed(); g.dispose();
  const cc = new Float32Array(ng.attributes.position.count * 3), src = idx;
  for (let i = 0; i < src.length; i++) { cc[i * 3] = col[src[i] * 3]; cc[i * 3 + 1] = col[src[i] * 3 + 1]; cc[i * 3 + 2] = col[src[i] * 3 + 2]; }
  const colors = cc; let k = 0;
  kit.add(ng, () => 0xffffff, { outline: false });
  const merged = kit.b.get('toon'); merged[merged.length - 1].setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ---------- shoreline foam ring (own mesh: transparent, animated) ----------
export function shoreFoam(uTime, low) {
  const segs = low ? 120 : 220, pos = [], uv = [], idx = [];
  for (let j = 0; j <= segs; j++) {
    const a = (j / segs) * Math.PI * 2; let lo = 30, hi = 90;
    for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (groundY(Math.cos(a) * m, Math.sin(a) * m) > 0) lo = m; else hi = m; }
    for (const [dr, v] of [[-2.2, 0], [3.4, 1]]) { const r = lo + dr; pos.push(Math.cos(a) * r, 0.12, Math.sin(a) * r); uv.push(j / segs * 40, v); }
  }
  for (let j = 0; j < segs; j++) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime },
    vertexShader: 'varying vec2 vUv; uniform float uTime; void main(){ vUv=uv; vec3 p=position; p.y += sin(uTime*1.3+uv.x*0.9)*0.12; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }',
    fragmentShader: `varying vec2 vUv; uniform float uTime;
      void main(){ float t = uTime*0.55; float lap = fract(vUv.y*1.0 - t + sin(vUv.x*1.7)*0.08);
        float band = smoothstep(0.0,0.08,lap)*smoothstep(0.32,0.18,lap);
        float edge = smoothstep(0.0,0.25,vUv.y)*smoothstep(1.0,0.45,vUv.y);
        float a = max(band*0.85, smoothstep(0.42,0.0,vUv.y)*0.55) * edge;
        if (a < 0.02) discard; gl_FragColor = vec4(vec3(1.0), a); }`,
  });
  const m = new THREE.Mesh(g, mat); m.renderOrder = 3; m.name = 'shore_foam'; return m;
}

// ---------- props ----------
let RBS = 2; const RB = (w, h, d, r = 0.2, s = RBS) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.01, h / 2 - 0.01, d / 2 - 0.01));
const cyl = (rt, rb, h, n = 12) => new THREE.CylinderGeometry(rt, rb, h, n);
const sph = (r, w = 12, hh = 8) => new THREE.SphereGeometry(r, w, hh);
const WOOD = 0xb06a36, WOOD_D = 0x7b4524, WOOD_L = 0xd99a5b, ROOF = 0xf0362c, CREAM = 0xfff1d2, STONE = 0xa9b4c2, STONE_D = 0x7f8a99, IRON = 0x2b2f36, GOLD = 0xffc93c, RED = 0xfa0d0d, LEAF = 0x2fbf4a, LEAF2 = 0x8cf05a;

function barrel(kit, m, low) {
  kit.at(m, () => {
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector2(0.62 + Math.sin(t * Math.PI) * 0.16, t * 1.5)); }
    kit.add(new THREE.LatheGeometry(pts, low ? 10 : 14), WOOD_L);
    for (const y of [0.25, 1.25]) kit.add(new THREE.TorusGeometry(0.72, 0.06, 4, low ? 10 : 14), IRON, { m: M(0, y, 0, 0, Math.PI / 2), outline: false });
    kit.add(cyl(0.6, 0.6, 0.06, low ? 10 : 14), WOOD, { m: M(0, 1.48, 0), outline: false });
  });
}
function crate(kit, m) { kit.at(m, () => { kit.add(RB(1.4, 1.4, 1.4, 0.12), WOOD_L); kit.add(RB(1.46, 0.22, 1.46, 0.06), WOOD_D, { m: M(0, 0.45, 0), outline: false }); kit.add(RB(1.46, 0.22, 1.46, 0.06), WOOD_D, { m: M(0, -0.45, 0), outline: false }); }); }
function lantern(kit, m, low) {
  kit.at(m, () => {
    kit.add(cyl(0.12, 0.14, 3.2, 6), WOOD_D, { m: M(0, 1.6, 0) });
    kit.add(RB(0.55, 0.7, 0.55, 0.08), IRON, { m: M(0, 3.45, 0), outline: false });
    kit.add(sph(0.26, low ? 8 : 10, 6), 0xffd36b, { bucket: 'glow', m: M(0, 3.45, 0), outline: false });
    kit.add(new THREE.ConeGeometry(0.42, 0.35, 4), IRON, { m: M(0, 3.95, 0, Math.PI / 4), outline: false });
  });
}
// atlas quad (sign / poster / flag) facing +z
function quad(kit, w, h, r, m, side = 'front') { const g = new THREE.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, r.u0 + uv.getX(i) * (r.u1 - r.u0), r.v0 + uv.getY(i) * (r.v1 - r.v0)); kit.add(g, 0, { bucket: 'atlas', m, outline: false }); }

function tavern(kit, A, low) {
  const s = SPOTS.tavern, y0 = groundY(s.x, s.z) - 0.3;
  kit.at(M(s.x, y0, s.z, s.yaw), () => {
    kit.add(RB(14, 1.6, 11, 0.5), STONE, { m: M(0, 0.6, 0) }); // stone footing
    kit.add(RB(12.5, 5.2, 9.5, 0.45), WOOD, { m: M(0, 3.9, 0) }); // ground floor (planked wood)
    for (let i = 0; i < 6; i++) kit.add(RB(12.6, 0.12, 9.6, 0.05), WOOD_D, { m: M(0, 1.95 + i * 0.85, 0), outline: false });
    kit.add(RB(13.6, 4.4, 10.6, 0.45), CREAM, { m: M(0, 8.6, 0) }); // overhanging plaster upper floor
    for (const x of [-6.5, -2.2, 2.2, 6.5]) kit.add(RB(0.5, 4.5, 10.8, 0.1), WOOD_D, { m: M(x, 8.6, 0), outline: false });
    kit.add(RB(13.8, 0.5, 10.8, 0.1), WOOD_D, { m: M(0, 6.55, 0), outline: false });
    // big chunky roof (4-sided, stretched), brand red with a ridge cap
    kit.add(new THREE.CylinderGeometry(0.6, 1, 6.2, 4, 1), ROOF, { m: M(0, 13.9, 0, Math.PI / 4, 0, 0, [11.4, 1, 9]) });
    kit.add(RB(2.2, 0.6, 2.2, 0.2), 0xb51f18, { m: M(0, 17.05, 0) });
    kit.add(RB(1.8, 4.5, 1.8, 0.2), STONE_D, { m: M(-3.8, 16, -2.2) }); // chimney
    kit.add(RB(2.2, 0.5, 2.2, 0.15), STONE, { m: M(-3.8, 18.3, -2.2) });
    // flag pole + skull flag
    kit.add(cyl(0.12, 0.12, 6, 6), WOOD_D, { m: M(0, 20.2, 0) });
    kit.add(sph(0.3, 8, 6), GOLD, { m: M(0, 23.3, 0), outline: false });
    quad(kit, 4.2, 2.8, A.flag, M(2.1, 21.6, 0)); quad(kit, 4.2, 2.8, A.flagBack, M(2.1, 21.6, 0, Math.PI));
    // door + porch
    kit.add(RB(3, 4.4, 0.6, 0.6), WOOD_D, { m: M(0, 3.4, 4.8) });
    kit.add(sph(0.2, 8, 6), GOLD, { m: M(0.9, 3.3, 5.15), outline: false });
    kit.add(RB(6, 0.5, 3.2, 0.2), WOOD_L, { m: M(0, 1.4, 6.3) });
    kit.add(RB(5.8, 0.5, 2.6, 0.2), ROOF, { m: M(0, 6.2, 6.0, 0, -0.35) }); // little door awning
    // round glowing windows (ground + upper floor, front + sides)
    // (x, y, z) sits ON the wall face; ry turns the window to face outward; the glass sits 0.1 proud of the wall (no z-fight)
    const win = (x, y, z, ry, r) => { const o = M(x, y, z, ry); kit.add(new THREE.TorusGeometry(r, 0.22, 6, low ? 12 : 16), WOOD_D, { m: o.clone().multiply(M(0, 0, 0.14)), outline: false }); kit.add(new THREE.CircleGeometry(r, low ? 12 : 16), 0xffc65a, { bucket: 'glow', m: o.clone().multiply(M(0, 0, 0.1)), outline: false }); kit.add(RB(0.16, r * 1.9, 0.12, 0.05), WOOD_D, { m: o.clone().multiply(M(0, 0, 0.16)), outline: false }); };
    for (const x of [-4, 4]) win(x, 4.2, 4.75, 0, 1.0);
    for (const x of [-4.4, 0, 4.4]) win(x, 8.8, 5.3, 0, 0.95);
    for (const z of [-2.5, 2.5]) { win(6.25, 4.2, z, Math.PI / 2, 0.9); win(-6.25, 4.2, z, -Math.PI / 2, 0.9); win(6.8, 8.8, z, Math.PI / 2, 0.85); win(-6.8, 8.8, z, -Math.PI / 2, 0.85); }
    // hanging sign
    kit.add(RB(0.3, 0.3, 3.3, 0.08), WOOD_D, { m: M(5.4, 7.0, 6.45) }); kit.add(RB(3.4, 0.28, 0.28, 0.08), WOOD_D, { m: M(5.4, 7.0, 7.8) }); // bracket arm + crossbar
    kit.add(RB(4.6, 1.8, 0.3, 0.15), WOOD_D, { m: M(5.4, 5.6, 7.8) });
    quad(kit, 4.2, 1.5, A.tavern, M(5.4, 5.6, 7.96)); quad(kit, 4.2, 1.5, A.tavern, M(5.4, 5.6, 7.64, Math.PI));
    for (const x of [4, 6.8]) kit.add(cyl(0.05, 0.05, 0.6, 4), IRON, { m: M(x, 6.65, 7.8), outline: false });
    // barrels, table, mugs
    barrel(kit, M(-4.8, 1.3, 6.4), low); barrel(kit, M(-6.3, 1.3, 5.6, 0.4), low); barrel(kit, M(-5.4, 2.8, 6.0, 0.2, 0, 0, 0.9), low);
    kit.add(cyl(1.4, 1.4, 0.3, 12), WOOD_L, { m: M(4.6, 2.6, 10.3) }); kit.add(cyl(0.25, 0.4, 1.4, 8), WOOD_D, { m: M(4.6, 1.8, 10.3) });
    for (const [x, z] of [[4.1, 10.0], [5.1, 10.6]]) { kit.add(cyl(0.28, 0.25, 0.55, 8), GOLD, { m: M(x, 3.0, z), outline: false }); kit.add(cyl(0.3, 0.3, 0.15, 8), 0xffffff, { m: M(x, 3.33, z), outline: false }); }
    for (const [x, z] of [[2.8, 10.6], [6.4, 9.6]]) kit.add(cyl(0.55, 0.55, 1.5, 8), WOOD, { m: M(x, 1.7, z) });
    lantern(kit, M(-3.3, 1.0, 8.2), low); lantern(kit, M(3.3, 1.0, 8.2), low);
  });
}

function palm(kit, x, z, h, lean, yaw, seed, low) {
  const r = rng(seed), y0 = groundY(x, z) - 0.3, n = low ? 6 : 9;
  const curve = (t) => new THREE.Vector3(Math.sin(yaw) * lean * t * t * h * 0.35, t * h, Math.cos(yaw) * lean * t * t * h * 0.35);
  for (let i = 0; i < n; i++) {
    const a = curve(i / n), b = curve((i + 1) / n), d = b.clone().sub(a), L = d.length();
    const g = cyl(0.55 - 0.3 * (i + 1) / n, 0.62 - 0.3 * i / n, L * 1.04, low ? 7 : 9);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    kit.add(g, i % 2 ? 0xc98b4e : 0xa96a38, { m: new THREE.Matrix4().compose(new THREE.Vector3(x + (a.x + b.x) / 2, y0 + (a.y + b.y) / 2, z + (a.z + b.z) / 2), q, new THREE.Vector3(1, 1, 1)), outline: i % 3 === 0 ? 1 : false });
  }
  const top = curve(1).add(new THREE.Vector3(x, y0, z)), fr = low ? 6 : 8;
  for (let k = 0; k < fr; k++) {
    const L = 5.2 + r() * 1.6, g = new THREE.BoxGeometry(L, 0.14, 1, low ? 5 : 8, 1, 1); g.translate(L / 2, 0, 0);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { const u = P.getX(i) / L; P.setZ(i, P.getZ(i) * (1.9 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.95 + 0.05)), 0.7) + 0.1)); P.setY(i, P.getY(i) + 1.4 * u - 3.1 * u * u); }
    g.computeVertexNormals();
    const ay = (k / fr) * Math.PI * 2 + r() * 0.4;
    kit.add(g, (p) => new THREE.Color(LEAF).lerp(new THREE.Color(LEAF2), Math.min(1, p.x / L + (p.z > 0 ? 0.15 : 0))).getHex(),
      { bucket: 'sway', m: M(top.x, top.y, top.z, ay, 0, -0.15 + r() * 0.3), sway: (p) => Math.min(1, Math.max(0, p.x / L)), outline: 0.7 });
  }
  for (let k = 0; k < 3; k++) kit.add(sph(0.42, 8, 6), 0x6b3f1f, { m: M(top.x + Math.cos(k * 2.1) * 0.5, top.y - 0.35, top.z + Math.sin(k * 2.1) * 0.5), outline: false });
}
function rock(kit, x, z, s, seed, low, sink = 0.35) {
  const g = new THREE.IcosahedronGeometry(1, low ? 0 : 1), P = g.attributes.position, r = rng(seed), o = [r() * 9, r() * 9, r() * 9];
  for (let i = 0; i < P.count; i++) { const vx = P.getX(i), vy = P.getY(i), vz = P.getZ(i), k = 1 + 0.18 * Math.sin(vx * 3.1 + o[0]) * Math.sin(vy * 2.7 + o[1]) + 0.12 * Math.sin(vz * 4.3 + o[2]); P.setXYZ(i, vx * k, vy * k * 0.72, vz * k); }
  g.computeVertexNormals();
  const base = new THREE.Color(r() > 0.5 ? STONE : 0x95a3b5);
  kit.add(g, (p) => base.clone().lerp(new THREE.Color(0xe4ecf5), Math.max(0, p.y) * 0.45).getHex(), { m: M(x, groundY(x, z) + s * (0.72 - sink), z, r() * 6, 0, 0, [s * (1 + r() * 0.4), s, s]) });
}
function bush(kit, x, z, s, seed) { const r = rng(seed), y = groundY(x, z); for (let k = 0; k < 3; k++) kit.add(sph(s * (0.7 + r() * 0.4), 10, 7), k ? 0x3fca45 : 0x2fa83c, { m: M(x + (r() - 0.5) * s * 1.6, y + s * 0.4, z + (r() - 0.5) * s * 1.6, 0, 0, 0, [1, 0.8, 1]) }); }

function dock(kit, low) {
  const d = SPOTS.dock, n = Math.round((d.z1 - d.z0) / 1.05);
  for (let i = 0; i < n; i++) { const z = d.z0 + i * 1.05 + 0.5; kit.add(RB(d.w + ((i * 7) % 3) * 0.12, 0.32, 0.92, 0.08), i % 3 ? WOOD_L : 0xc98a4c, { m: M(((i * 5) % 3 - 1) * 0.05, d.y, z, ((i * 3) % 5 - 2) * 0.012), outline: false }); }
  kit.add(RB(d.w + 0.6, 0.35, d.z1 - d.z0, 0.1), WOOD_D, { m: M(0, d.y - 0.35, (d.z0 + d.z1) / 2), outline: false });
  // T-head at the end
  kit.add(RB(14, 0.4, 4.4, 0.12), WOOD_L, { m: M(0, d.y, d.z1 + 1.8) });
  for (let z = d.z0 + 6; z <= d.z1 + 3; z += 5.5) for (const x of [-d.w / 2 - 0.2, d.w / 2 + 0.2]) {
    kit.add(cyl(0.38, 0.42, 8, low ? 7 : 9), WOOD, { m: M(x, d.y - 3, z) });
    kit.add(cyl(0.44, 0.44, 0.14, low ? 7 : 9), 0xe8e0c8, { m: M(x, d.y - 1.3, z), outline: false });
  }
  for (const x of [-6.5, 6.5]) kit.add(cyl(0.4, 0.45, 8, 8), WOOD, { m: M(x, d.y - 3, d.z1 + 3.3) });
  // bollards + mooring lines to the ships
  for (const [i, s] of SPOTS.moor.entries()) for (const dz of [-6, 6]) {
    const bx = Math.sign(s.x) * (d.w / 2 - 0.4), bz = s.z + dz, by = d.y + 0.2;
    kit.add(cyl(0.35, 0.42, 0.9, 8), IRON, { m: M(bx, by + 0.45, bz) }); kit.add(cyl(0.5, 0.5, 0.2, 8), IRON, { m: M(bx, by + 0.95, bz), outline: false });
    const tx = s.x - Math.sign(s.x) * 2.2, tz = s.z + dz * 0.85, ty = 2.4, a = new THREE.Vector3(bx, by + 0.7, bz), b = new THREE.Vector3(tx, ty, tz), mid = a.clone().add(b).multiplyScalar(0.5), dv = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.clone().normalize());
    kit.add(cyl(0.07, 0.07, dv.length(), 5), 0xe8d3a0, { m: new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), outline: false });
  }
  for (const z of [d.z0 + 4, d.z0 + 22, d.z1 + 2]) for (const x of [-d.w / 2 - 0.1, d.w / 2 + 0.1]) if (z !== d.z0 + 22 || x > 0) lantern(kit, M(x, d.y, z), low);
  barrel(kit, M(-1.2, d.y + 0.15, d.z0 + 9), low); crate(kit, M(1.3, d.y + 0.85, d.z0 + 11, 0.3)); crate(kit, M(-1.4, d.y + 0.85, d.z1 + 1.5, 0.6));
  // life ring on the T-head
  kit.add(new THREE.TorusGeometry(0.7, 0.24, 8, 16), 0xffffff, { m: M(4.5, d.y + 1.1, d.z1 + 3.95, 0, 0, 0) }); kit.add(new THREE.TorusGeometry(0.7, 0.25, 8, 4), RED, { m: M(4.5, d.y + 1.1, d.z1 + 3.96, 0, 0, Math.PI / 4), outline: false });
  kit.add(cyl(0.1, 0.1, 1.8, 6), WOOD_D, { m: M(4.5, d.y + 0.9, d.z1 + 3.75), outline: false });
}

function digSpot(kit, A, low) {
  const s = SPOTS.dig, y = groundY(s.x, s.z);
  kit.at(M(s.x, y, s.z, 0.3), () => {
    for (const a of [Math.PI / 4, -Math.PI / 4]) kit.add(RB(6.2, 0.22, 1.25, 0.1), RED, { m: M(0, 0.05, 0, a), outline: 0.6 });
    for (const [x, z, r] of [[3.6, 2.4, 1.3], [-3.4, 3.0, 1.0], [2.8, -3.4, 0.9]]) kit.add(sph(r, low ? 10 : 14, 8), 0xf7d48b, { m: M(x, 0, z, 0, 0, 0, [1, 0.45, 1]) });
    kit.add(new THREE.CircleGeometry(1.1, 14), 0x6b4a26, { m: M(-2.1, 0.06, -2.4, 0, -Math.PI / 2), outline: false });
    // shovel stuck in the sand
    kit.at(M(3.0, 0, 1.7, -0.6, 0.0, 0.32), () => {
      kit.add(cyl(0.13, 0.13, 3.8, 7), WOOD, { m: M(0, 2.1, 0) });
      kit.add(RB(1.0, 0.3, 0.3, 0.1), WOOD_D, { m: M(0, 4.05, 0) });
      kit.add(RB(1.1, 1.5, 0.14, 0.12), 0xc6cdd6, { m: M(0, 0.2, 0) });
    });
    kit.add(cyl(0.12, 0.14, 2.6, 6), WOOD_D, { m: M(-4.6, 1.3, -1.5) });
    kit.add(RB(3.0, 1.3, 0.25, 0.1), WOOD_L, { m: M(-4.6, 2.4, -1.5, 0.25) });
    quad(kit, 2.8, 1.15, A.dig, M(-4.6, 2.4, -1.5, 0.25, 0, 0).multiply(M(0, 0, 0.14)));
  });
}

function shopAndBoard(kit, A, low) {
  const s = SPOTS.board, y = groundY(s.x, s.z) - 0.2;
  kit.at(M(s.x, y, s.z, s.yaw), () => {
    // market stall: counter, posts, striped awning, sign
    kit.add(RB(7, 2.2, 2.4, 0.25), WOOD, { m: M(-3.2, 1.1, 0) });
    kit.add(RB(7.3, 0.35, 2.7, 0.12), WOOD_L, { m: M(-3.2, 2.3, 0) });
    for (const x of [-6.5, 0.1]) for (const z of [-1.1, 1.1]) kit.add(cyl(0.18, 0.2, 5.6, 7), WOOD_D, { m: M(x, 2.8, z) });
    for (let i = 0; i < 7; i++) kit.add(RB(1.02, 0.18, 3.6, 0.06), i % 2 ? 0xffffff : RED, { m: M(-6.3 + i * 1.03, 5.95, 0.45, 0, -0.28), outline: i === 3 ? 1 : false });
    for (let i = 0; i < 7; i++) kit.add(new THREE.CylinderGeometry(0.52, 0.52, 0.2, 10, 1, false, 0, Math.PI), i % 2 ? 0xffffff : RED, { m: M(-6.3 + i * 1.03, 5.55, 2.2, Math.PI / 2, 0, Math.PI / 2), outline: false });
    kit.add(RB(4.4, 1.4, 0.3, 0.15), WOOD_D, { m: M(-3.2, 7.0, -0.6) });
    quad(kit, 4.1, 1.2, A.shop, M(-3.2, 7.0, -0.43));
    // goods: gold pile, cannonballs, potion-ish jugs
    for (let i = 0; i < (low ? 6 : 12); i++) kit.add(cyl(0.32, 0.32, 0.1, 10), GOLD, { m: M(-5.2 + (i % 4) * 0.25, 2.55 + Math.floor(i / 4) * 0.11, 0.3 + (i % 3) * 0.2), outline: false });
    for (const [x, z] of [[-3.2, 0.3], [-2.75, 0.55], [-3.0, 0.75]]) kit.add(sph(0.32, 10, 8), IRON, { m: M(x, 2.75, z), outline: false });
    kit.add(sph(0.38, 10, 8), 0x39d0ff, { m: M(-1.2, 2.85, 0.4, 0, 0, 0, [1, 1.2, 1]) });
    kit.add(sph(0.33, 10, 8), 0x9b4dff, { m: M(-0.6, 2.8, 0.0, 0, 0, 0, [1, 1.2, 1]) });
    crate(kit, M(-7.9, 0.7, 1.2, 0.3)); barrel(kit, M(-8.0, 0, -1.3), low);
    // bounty board: two posts + a plank board with wanted posters, little roof
    kit.at(M(4.6, 0, 0.2, -0.25), () => {
      for (const x of [-3.0, 3.0]) kit.add(cyl(0.22, 0.26, 6.2, 7), WOOD_D, { m: M(x, 3.1, 0) });
      kit.add(RB(6.6, 3.8, 0.35, 0.15), WOOD_L, { m: M(0, 3.6, 0) });
      kit.add(RB(7.4, 0.35, 1.4, 0.12), ROOF, { m: M(0, 6.15, 0.1, 0, 0.12) });
      kit.add(RB(4.0, 0.9, 0.2, 0.1), WOOD_D, { m: M(0, 5.25, 0.2) });
      quad(kit, 3.8, 0.8, A.bounties, M(0, 5.25, 0.31));
      quad(kit, 1.8, 2.3, A.p0, M(-2.05, 3.2, 0.19, 0, 0, 0.05)); quad(kit, 1.8, 2.3, A.p1, M(0, 3.25, 0.19, 0, 0, -0.03)); quad(kit, 1.8, 2.3, A.p2, M(2.05, 3.15, 0.19, 0, 0, 0.04));
      for (const x of [-2.05, 0, 2.05]) kit.add(sph(0.11, 6, 4), RED, { m: M(x, 4.43, 0.24), outline: false });
    });
  });
}

function plaza(kit, A, low) {
  const p = SPOTS.plaza, y = groundY(p.x, p.z);
  for (let i = 0; i < (low ? 14 : 22); i++) { const a = (i / (low ? 14 : 22)) * Math.PI * 2; kit.add(RB(1.4, 0.4, 0.9, 0.15), i % 2 ? STONE : 0xc3ccd8, { m: M(p.x + Math.cos(a) * 8.9, y + 0.05, p.z + Math.sin(a) * 8.9, -a), outline: false }); }
  kit.add(cyl(1.4, 1.8, 1.0, 10), STONE_D, { m: M(p.x, y + 0.4, p.z) });
  kit.add(cyl(0.22, 0.26, 13, 8), WOOD_D, { m: M(p.x, y + 7, p.z) });
  kit.add(sph(0.45, 10, 8), GOLD, { m: M(p.x, y + 13.6, p.z), outline: false });
  quad(kit, 6, 4, A.flag, M(p.x + 3, y + 11, p.z)); quad(kit, 6, 4, A.flagBack, M(p.x + 3, y + 11, p.z, Math.PI));
}

function chestPedestal(kit, low) {
  const c = SPOTS.chest, y = groundY(c.x, c.z);
  kit.add(cyl(4.2, 4.6, 0.8, low ? 12 : 18), STONE, { m: M(c.x, y + 0.2, c.z) });
  kit.add(cyl(3.2, 3.4, 0.6, low ? 12 : 18), 0xc3ccd8, { m: M(c.x, y + 0.85, c.z) });
  kit.add(new THREE.TorusGeometry(3.75, 0.13, 4, low ? 24 : 40), 0x6ff7ff, { bucket: 'glow', m: M(c.x, y + 0.64, c.z, 0, Math.PI / 2), outline: false });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; kit.add(RB(0.7, 2.2 + (i % 2) * 0.8, 0.7, 0.2), STONE_D, { m: M(c.x + Math.cos(a) * 5.4, y + 1.0, c.z + Math.sin(a) * 5.4, a) }); kit.add(sph(0.3, 8, 6), 0x6ff7ff, { bucket: 'glow', m: M(c.x + Math.cos(a) * 5.4, y + 2.4 + (i % 2) * 0.8, c.z + Math.sin(a) * 5.4), outline: false }); }
}
// the daily chest itself is its own tiny merged mesh so it can bob / glow
export function buildChest(low, A) {
  const k = new Kit();
  k.add(RB(2.6, 1.5, 1.8, 0.25), WOOD, { m: M(0, 0.75, 0) });
  const lid = new THREE.CylinderGeometry(0.9, 0.9, 2.6, low ? 10 : 16, 1, false, 0, Math.PI); lid.rotateZ(Math.PI / 2);
  k.add(lid, WOOD_L, { m: M(0, 1.5, 0) });
  for (const x of [-0.95, 0.95]) { k.add(RB(0.3, 1.6, 1.9, 0.08), GOLD, { m: M(x, 0.8, 0), outline: false }); const b = new THREE.CylinderGeometry(0.95, 0.95, 0.3, low ? 10 : 16, 1, false, 0, Math.PI); b.rotateZ(Math.PI / 2); k.add(b, GOLD, { m: M(x, 1.5, 0), outline: false }); }
  k.add(RB(0.6, 0.75, 0.2, 0.08), GOLD, { m: M(0, 1.35, 0.95), outline: false });
  k.add(sph(0.13, 8, 6), IRON, { m: M(0, 1.3, 1.06), outline: false });
  for (let i = 0; i < 7; i++) k.add(sph(0.28, 8, 6), 0xffe066, { bucket: 'glow', m: M(-0.9 + i * 0.3, 1.62 + Math.sin(i) * 0.1, 0.05), outline: false }); // coins peeking
  return k;
}

// ---------- atlas: signs, posters, flags (one canvas texture) ----------
export function makeAtlas(skull) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const R = {}, reg = (k, x, y, w, h) => { R[k] = { u0: x / S, u1: (x + w) / S, v0: 1 - (y + h) / S, v1: 1 - y / S }; };
  const font = (px) => `${px}px "Just Another Hand", cursive`;
  const board = (x, y, w, h, bg) => { g.fillStyle = bg; g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x, y + h * i / 4 + (i % 2) * 3); g.lineTo(x + w, y + h * i / 4); g.stroke(); } g.lineWidth = 10; g.strokeStyle = '#161616'; g.strokeRect(x + 5, y + 5, w - 10, h - 10); };
  const text = (s, x, y, px, col = '#ffcd77') => { g.font = font(px); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = px * 0.12; g.strokeStyle = '#161616'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
  // signs
  board(0, 0, 512, 184, '#5a3219'); text('TAVERN', 256, 98, 140); reg('tavern', 0, 0, 512, 184);
  board(512, 0, 512, 150, '#5a3219'); text('SHOP', 768, 82, 130); reg('shop', 512, 0, 512, 150);
  board(512, 150, 512, 108, '#5a3219'); text('BOUNTIES', 768, 208, 100, '#fa0d0d'); reg('bounties', 512, 150, 512, 108);
  board(0, 184, 512, 200, '#c98a4c'); text('DIG HERE', 256, 290, 128, '#fa0d0d'); reg('dig', 0, 184, 512, 200);
  board(512, 258, 512, 126, '#5a3219'); text('DAILY BOOTY', 768, 324, 104); reg('daily', 512, 258, 512, 126);
  // wanted posters
  const posters = [['DEV WALLET', '5,000 GOLD', '#3a2f8f'], ['RUG PULLER', '1,200 GOLD', '#8f2f2f'], ['JEETER', '800 GOLD', '#2f7a3a']];
  posters.forEach(([n, b, col], i) => {
    const x = i * 256 + 8, y = 392, w = 240, h = 304;
    g.fillStyle = '#f7e6bd'; g.fillRect(x, y, w, h); g.strokeStyle = '#a5824a'; g.lineWidth = 6; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
    text('WANTED', x + w / 2, y + 40, 64, '#161616');
    g.fillStyle = col; g.beginPath(); g.ellipse(x + w / 2, y + 140, 62, 62, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f7f2e6'; g.beginPath(); g.ellipse(x + w / 2 - 22, y + 130, 16, 20, 0, 0, Math.PI * 2); g.ellipse(x + w / 2 + 22, y + 130, 16, 20, 0, 0, Math.PI * 2); g.fill(); // cartoon pill-flag rug ship eyes
    g.fillStyle = '#161616'; g.beginPath(); g.arc(x + w / 2 - 20, y + 134, 7, 0, 7); g.arc(x + w / 2 + 24, y + 134, 7, 0, 7); g.fill();
    g.strokeStyle = '#161616'; g.lineWidth = 5; g.beginPath(); g.arc(x + w / 2, y + 175, 22, 3.6, 5.8); g.stroke();
    text(n, x + w / 2, y + 238, 48, '#fa0d0d'); text(b, x + w / 2, y + 278, 40, '#161616');
    reg('p' + i, x, y, w, h);
  });
  // skull flag (front + mirrored back)
  const flag = (x, mirror) => {
    const y = 704, w = 400, h = 300; g.fillStyle = '#121212'; g.fillRect(x, y, w, h);
    if (skull) { const k = Math.min(w * 0.76 / skull.width, h * 0.76 / skull.height), sw = skull.width * k, sh = skull.height * k; g.save(); if (mirror) { g.translate(x + w, 0); g.scale(-1, 1); g.drawImage(skull, (w - sw) / 2, y + (h - sh) / 2, sw, sh); } else g.drawImage(skull, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh); g.restore(); }
    return [x, y, w, h];
  };
  reg('flag', ...flag(8, false)); reg('flagBack', ...flag(512, true));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return { tex: t, R };
}

// ---------- build the whole island ----------
export function buildIsland({ low, atlas }) {
  const kit = new Kit(), A = atlas.R; RBS = low ? 1 : 2;
  terrain(kit, low);
  plaza(kit, A, low); tavern(kit, A, low); dock(kit, low); digSpot(kit, A, low); shopAndBoard(kit, A, low); chestPedestal(kit, low);
  // daily sign by the chest
  { const c = SPOTS.chest, y = groundY(c.x - 6.5, c.z + 4.5); kit.add(cyl(0.14, 0.16, 3.2, 6), WOOD_D, { m: M(c.x - 6.8, y + 1.6, c.z + 4.8) }); kit.add(RB(4.0, 1.1, 0.25, 0.1), WOOD_L, { m: M(c.x - 6.8, y + 2.9, c.z + 4.8, -0.5) }); quad(kit, 3.8, 0.95, A.daily, M(c.x - 6.8, y + 2.9, c.z + 4.8, -0.5).multiply(M(0, 0, 0.14))); }
  // palms (ring near the ledge + a few on the beach), rocks on the shore and in the water, bushes
  const palms = [[-34, 18, 12, 0.9, 2.4], [-40, 2, 11, 1.1, 1.8], [-30, 34, 13, 1.0, 2.6], [30, 24, 12, 0.9, 0.9], [38, 8, 11, 1.2, 1.3], [12, -40, 12, 1.0, -0.6], [-28, -32, 11, 1.1, -2.4], [-42, -16, 12, 1.0, -1.9], [36, -30, 12, 0.9, -0.9], [18, 52, 10, 1.2, 0.4], [-13, 54, 11, 1.0, -0.3], [44, -10, 10, 1.1, 1.6], [2, -48, 11, 1.0, 0], [-8, 22, 10, 0.6, 2.2]];
  palms.slice(0, low ? 10 : palms.length).forEach(([x, z, h, l, yaw], i) => palm(kit, x, z, h, l, yaw, 31 + i, low));
  const rocks = [[-52, 30, 3.2], [-48, 36, 1.8], [56, 14, 3.6], [52, 22, 2], [24, -58, 3.0], [-34, -50, 2.6], [-60, -12, 2.2], [64, -24, 4.5], [-70, 40, 4.0], [40, -42, 1.8], [-18, 62, 2.2], [22, 64, 2.6], [6, -30, 1.4], [33, 2, 1.3], [-14, -22, 1.2]];
  rocks.forEach(([x, z, s], i) => rock(kit, x, z, s, 71 + i, low));
  [[-26, 12, 1.4], [14, 20, 1.2], [-30, -22, 1.5], [30, -24, 1.3], [-10, -42, 1.2], [20, 8, 1.0], [-12, 30, 1.1]].forEach(([x, z, s], i) => bush(kit, x, z, s, 91 + i));
  return kit;
}
