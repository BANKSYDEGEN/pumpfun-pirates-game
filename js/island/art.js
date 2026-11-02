// [Raul] PUMPFUN PIRATES island art: a bright, toy-like lobby island (future dockable island / social lobby).
// Everything static is merged by Kit into a few meshes: terrain + props (vertex colours, toon), palm fronds (sway),
// glow (windows, lanterns, runes), atlas (signs, posters, flags) and ONE outline shell.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng } from '../toon.js';
import { Kit, M } from './kit.js';

// ---------- layout (world units, 1:1 with the game: a ship is 17-20.4 long, a pirate 1.8 tall) ----------
// Island-local frame: +z faces the HARBOR centre. The v2 toy island, round, scaled up (grass radius ~65, waterline ~73,
// about 2.4x the walkable area of v2) with SIX T-head piers radiating every 60 deg (at +-30, +-90, +-150 so no pier points
// straight at the harbor centre). Zones: docks ring path, plaza + market (harbor side), tavern on its knoll (back centre),
// a winding path up the hill to the lookout tower (left flank), a little jungle (right flank), beach + dig sites (back).
// Tall things (tavern, hill + tower, jungle palms) sit at the back / flanks; the harbor side stays low.
export const ISLAND_R = 65;                                 // mean grass-edge radius
export const PIER = { w: 5, y: 2.8, head0: 85.5, head1: 89.5, headHalf: 36, berthD: 94, lat: [-24, 0, 24] };
export const PIER_ANGLES = [30, 90, 150, -150, -90, -30].map(d => d * Math.PI / 180); // P1..P6, clockwise from front-right
export const SPOTS = {
  plaza: { x: 0, z: 24, r: 16 },               // open on-foot lobby square: 16 pirates with room to run
  flag: { x: -13, z: 14 },
  tavern: { x: 0, z: -24, yaw: 0 },            // on its knoll, terrace looks over the plaza to the harbor
  chest: { x: 24, z: -12 },
  board: { x: 27, z: 30, yaw: -Math.PI / 2 },  // market: shop stall + bounty board, facing the plaza
  stalls: [{ x: -24, z: 34, yaw: Math.PI / 2 + 0.3, c: 0x2a6df4 }, { x: -27, z: 20, yaw: Math.PI / 2 - 0.2, c: 0x22c55e }, { x: 22, z: 12, yaw: -Math.PI / 2 - 0.5, c: 0x9b4dff }],
  hill: { x: -40, z: -14, h: 10, s: 520 },    // the lookout hill
  tower: { x: -41, z: -15 },
  jungle: { x: 44, z: -6, r: 17 },
  digs: [{ x: -22, z: -46 }, { x: 18, z: -50 }, { x: 40, z: -34 }, { x: -48, z: 30 }],
  berthLen: 22,
};
// Where the island sits in the BATTLE ROYALE harbor (js/pvp.js world frame, metres, 1:1). Harbor rules it respects:
// player harbor spawn (0, 0); death respawns on rings r = 40 / 85 / 130; AI / boss spawns on r = 176 (6, at 30 + 60k deg)
// and r = 344 (16, every 22.5 deg); AI turn back past r = 370; edge r = 420; props.js rock islands beyond r = 250.
// Centre at 60 deg / r 240 (between the mid spawns at 30 / 90 deg): every berth is >= 20 from every respawn / spawn point,
// berths span world r ~149..334, the waterline ~r 167..313.
export const HARBOR_ISLAND = (() => { const a = Math.PI / 3, r = 240, x = +(Math.cos(a) * r).toFixed(2), z = +(Math.sin(a) * r).toFixed(2); return { x, z, yaw: Math.atan2(-x, -z), angleDeg: 60, r }; })();
// pier frame helpers: u = outward along the stem, v = along the head
export const pierUV = (th) => ({ u: [Math.sin(th), Math.cos(th)], v: [Math.cos(th), -Math.sin(th)] });
export function edgeR(a) { return ISLAND_R + 2.5 * Math.sin(3 * a + 1) + 1.5 * Math.sin(5 * a + 2) + 0.8 * Math.sin(9 * a); } // a = atan2(z, x)
const pierRoot = (th) => edgeR(Math.atan2(Math.cos(th), Math.sin(th))) - 1.5;
// winding paths (polylines): docks ring + plaza spokes + switchbacks up the hill
const ringPath = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; const r = edgeR(a) - 9 + 2.2 * Math.sin(a * 7); ringPath.push([Math.cos(a) * r, Math.sin(a) * r]); }
const P0 = [SPOTS.plaza.x, SPOTS.plaza.z];
const PATHS = [ringPath,
  [P0, [14, 40], [28, 47]], [P0, [-14, 40], [-28, 47]],                                  // plaza -> the two harbor-side piers
  [P0, [6, 8], [-5, -4], [0, -13]],                                                       // plaza -> tavern steps (wiggle)
  [[-13, 14], [-30, 8], [-22, -2], [-36, -1], [-30, -14], [-40, -8]],                     // switchbacks up to the tower
  [[12, 18], [24, 4], [20, -6], [24, -12]], [[24, -12], [36, -16], [48, -10], [58, -2]], // to the chest, through the jungle
  [[0, -32], [-12, -40], [-22, -46]], [[0, -32], [10, -44], [18, -50]], [[18, -50], [32, -44], [40, -34]],
  [[-30, 8], [-42, 20], [-48, 30]], [[-52, -10], [-58, 0]], [[20, 30], [30, 20], [56, 2]],
];

// ---------- terrain ----------
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function segDist(px, pz, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - a[0] - dx * t, pz - a[1] - dz * t);
}
function pathDist(x, z) { let d = 1e9; for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) d = Math.min(d, segDist(x, z, p[i], p[i + 1])); return d; }
const gauss = (x, z, c, s) => Math.exp(-((x - c.x) ** 2 + (z - c.z) ** 2) / s);
export function groundY(x, z) {
  const r = Math.hypot(x, z), e = edgeR(Math.atan2(z, x)), H = SPOTS.hill, J = SPOTS.jungle;
  let top = 4.2 + 0.7 * Math.sin(x * 0.07 + 1) * Math.cos(z * 0.06)
    + 2.8 * gauss(x, z, { x: SPOTS.tavern.x, z: SPOTS.tavern.z - 3 }, 420)               // tavern knoll
    + H.h * gauss(x, z, H, H.s) + 1.6 * gauss(x, z, { x: -24, z: -30 }, 200)               // the lookout hill + a shoulder
    + 1.4 * gauss(x, z, J, 160) + 0.9 * Math.sin(x * 0.3) * Math.sin(z * 0.27) * gauss(x, z, J, 300); // lumpy jungle
  top -= 0.6 * gauss(x, z, SPOTS.plaza, 260) * (top - 4.2 > 0 ? 1 : 0); // flatten the plaza a touch
  for (const g of SPOTS.digs) top -= 0.35 * gauss(x, z, g, 30);
  // heights clear the game's full storm swell (+-2.2): grass plateau -> ledge 2.4 -> beach through the surf -> shelf
  let h = top * (1 - sm(e - 6, e + 1, r)) + 2.4 * sm(e - 6, e + 1, r);
  h -= 2.9 * sm(e + 1, e + 13, r);
  h -= 5.5 * sm(e + 10, e + 26, r);
  return h;
}
const C = (h) => new THREE.Color(h);
const GRASS = C(0x5fd44a), GRASS2 = C(0x8ae95a), JUNGLE = C(0x2e9e3a), SAND = C(0xffe3a1), WET = C(0xe9c47c), PATH = C(0xf2d39a), PLAZA = C(0xf4e2bb), DEEP = C(0x3fb7c9);
function groundColor(x, z, h) {
  const r = Math.hypot(x, z), e = edgeR(Math.atan2(z, x)), c = new THREE.Color();
  const beachBack = sm(-30, -48, z) * 6; // the back of the island is a wide sandy beach (dig sites)
  const grass = 1 - sm(e - 5.5 - beachBack, e - 4.5 - beachBack, r); // crisp toy edge between grass and sand
  c.copy(SAND).lerp(WET, sm(0.6, -0.3, h)).lerp(DEEP, sm(-0.8, -3.5, h));
  const g = GRASS.clone().lerp(GRASS2, 0.5 + 0.5 * Math.sin(x * 0.21) * Math.sin(z * 0.17));
  g.lerp(JUNGLE, 1 - sm(SPOTS.jungle.r - 3, SPOTS.jungle.r + 3, Math.hypot(x - SPOTS.jungle.x, z - SPOTS.jungle.z)));
  g.lerp(C(0x77c94a), sm(4, 12, h) * 0.6); // the hill top a little sun-bleached
  c.lerp(g, grass);
  const pd = pathDist(x, z); c.lerp(PATH, (1 - sm(1.8, 2.6, pd)) * grass);
  c.lerp(PLAZA, 1 - sm(SPOTS.plaza.r - 0.5, SPOTS.plaza.r + 0.3, Math.hypot(x - SPOTS.plaza.x, z - SPOTS.plaza.z)));
  for (const s of SPOTS.digs) c.lerp(SAND, 1 - sm(6.2, 7.0, Math.hypot(x - s.x, z - s.z)));
  return c;
}
// radial terrain disc (round island), colours per vertex, flat-shaded toon
function radialGeo(rings, segs, R) {
  const pos = [], col = [], idx = [];
  pos.push(0, groundY(0, 0), 0); const c0 = groundColor(0, 0, groundY(0, 0)); col.push(c0.r, c0.g, c0.b);
  for (let i = 1; i <= rings; i++) { const r = R * Math.pow(i / rings, 1.05); for (let j = 0; j < segs; j++) { const a = (j / segs) * Math.PI * 2, x = Math.cos(a) * r, z = Math.sin(a) * r, y = groundY(x, z), c = groundColor(x, z, y); pos.push(x, y, z); col.push(c.r, c.g, c.b); } }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + ((j + 1) % segs), 1 + j);
  for (let i = 1; i < rings; i++) for (let j = 0; j < segs; j++) { const a = 1 + (i - 1) * segs + j, b = 1 + (i - 1) * segs + (j + 1) % segs, c = a + segs, d = b + segs; idx.push(a, b, d, a, d, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const ng = g.toNonIndexed(); g.dispose(); const cc = new Float32Array(idx.length * 3);
  idx.forEach((v, i) => { cc[i * 3] = col[v * 3]; cc[i * 3 + 1] = col[v * 3 + 1]; cc[i * 3 + 2] = col[v * 3 + 2]; });
  return { g: ng, colors: cc };
}
export const TERRAIN_R = 104;
function terrain(kit, low) {
  const { g, colors } = radialGeo(low ? 52 : 84, low ? 110 : 180, TERRAIN_R);
  kit.add(g, 0xffffff, { outline: false }); const L = kit.b.get('toon'); L[L.length - 1].setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ---------- shoreline foam ring (own mesh: transparent, animated) ----------
export function shoreFoam(uTime, low, uWaves) {
  const segs = low ? 160 : 300, pos = [], uv = [], idx = [];
  for (let j = 0; j <= segs; j++) {
    const a = (j / segs) * Math.PI * 2; let lo = 20, hi = 110;
    for (let it = 0; it < 30; it++) { const m = (lo + hi) / 2; if (groundY(Math.cos(a) * m, Math.sin(a) * m) > 0) lo = m; else hi = m; }
    for (const [dr, v] of [[-3.5, 0], [4.0, 1]]) { const r = lo + dr; pos.push(Math.cos(a) * r, 0, Math.sin(a) * r); uv.push(j / segs * 40, v); }
  }
  for (let j = 0; j < segs; j++) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uTime, uWaves },
    vertexShader: `varying vec2 vUv; uniform float uTime; uniform vec4 uWaves[4];
      void main(){ vUv = uv; vec3 p = position; vec4 wp = modelMatrix * vec4(p, 1.0); float h = 0.0;
        for (int i = 0; i < 4; i++) { float k = uWaves[i].w; h += uWaves[i].z * sin(k * dot(uWaves[i].xy, wp.xz) - sqrt(9.8 * k) * uTime); }
        wp.y = h + 0.1 + sin(uTime * 1.3 + uv.x * 0.9) * 0.08; gl_Position = projectionMatrix * viewMatrix * wp; }`,
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
  kit.at(M(s.x, y0, s.z, s.yaw, 0, 0, TAVERN_S), () => { // full scale next to a 1.8 m pirate: door ~2.6, terrace rail ~1.5
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
    // TERRACE: raised plank deck out front (16 x 8.5) with a low rail, open toward the harbor; stairs at the front centre
    const DY = 1.65; // deck top (tavern-local)
    for (let i = 0; i < 9; i++) kit.add(RB(16, 0.4, 0.92, 0.1), i % 2 ? WOOD_L : 0xc98a4c, { m: M(0, DY - 0.2, 5.4 + i * 0.95), outline: i === 8 ? 1 : false });
    for (const x of [-7.6, 0, 7.6]) for (const z of [6, 13]) kit.add(cyl(0.3, 0.32, 5, 7), WOOD_D, { m: M(x, DY - 2.7, z), outline: false });
    const railPost = (x, z) => kit.add(cyl(0.13, 0.13, 1.25, 6), WOOD_D, { m: M(x, DY + 0.6, z), outline: false });
    for (const x of [-7.8, 7.8]) { for (let z = 5.6; z <= 13.2; z += 1.9) railPost(x, z); kit.add(RB(0.25, 0.22, 7.9, 0.06), WOOD_L, { m: M(x, DY + 1.25, 9.4) }); }
    for (const sx of [-1, 1]) { for (let x = 2.2; x <= 7.8; x += 1.4) railPost(sx * x, 13.3); kit.add(RB(5.8, 0.22, 0.25, 0.06), WOOD_L, { m: M(sx * 4.95, DY + 1.25, 13.3) }); }
    for (let i = 0; i < 3; i++) kit.add(RB(3.6, 0.3, 0.9, 0.08), WOOD_L, { m: M(0, DY - 0.55 - i * 0.55, 14.0 + i * 0.8), outline: false }); // stairs down to the plaza path
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
    barrel(kit, M(-6.6, DY, 6.0), low); barrel(kit, M(-5.2, DY, 5.8, 0.4), low); barrel(kit, M(-5.9, DY + 1.5, 5.9, 0.2, 0, 0, 0.9), low);
    // two round tables with mugs + stools, set at the rail so the drinkers look out at the harbor fights
    for (const tx of [-4.2, 4.2]) {
      kit.add(cyl(1.3, 1.3, 0.25, 12), WOOD_L, { m: M(tx, DY + 1.05, 11.3) }); kit.add(cyl(0.22, 0.35, 1.0, 8), WOOD_D, { m: M(tx, DY + 0.5, 11.3), outline: false });
      for (const [dx, dz] of [[-0.45, -0.2], [0.5, 0.25]]) { kit.add(cyl(0.26, 0.23, 0.5, 8), GOLD, { m: M(tx + dx, DY + 1.42, 11.3 + dz), outline: false }); kit.add(cyl(0.28, 0.28, 0.14, 8), 0xffffff, { m: M(tx + dx, DY + 1.72, 11.3 + dz), outline: false }); }
      for (const dx of [-1.9, 1.9]) kit.add(cyl(0.5, 0.5, 0.75, 8), WOOD, { m: M(tx + dx, DY + 0.38, 10.6) });
    }
    lantern(kit, M(-7.8, DY, 13.3, 0, 0, 0, 0.8), low); lantern(kit, M(7.8, DY, 13.3, 0, 0, 0, 0.8), low);
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

// ---------- the docks: six T-head piers radiating round the island ----------
// BERTHS (island-local): three per T-head on its seaward face, 24 apart (two maxed ships, collision r 8.6, never overlap:
// 24 > 17.2), centre 4.5 off the face (beam 7.3 / 2 + fenders). 6 x 3 = 18 berths >= the 16-player arena max.
// A ship lies along the head (yaw = pier angle + 90 deg). Every island collider stays >= 9 clear of every berth.
export function BERTHS() {
  const out = [];
  PIER_ANGLES.forEach((th, k) => { const { u, v } = pierUV(th), D = PIER.berthD;
    PIER.lat.forEach((t, j) => out.push({ id: 'P' + (k + 1) + 'LCR'[j], pier: k + 1, kind: 't-head', x: +(u[0] * D + v[0] * t).toFixed(2), z: +(u[1] * D + v[1] * t).toFixed(2), yaw: +(th + Math.PI / 2).toFixed(4),
      len: SPOTS.berthLen, fits: [17, 20.4], maxBeam: 7.3, shipR: 8.6 })); });
  return out;
}
// pier decks are NOT solid circles (a ship's 8.6 circle is wider than its 4.5 berth offset): export them as capsule
// segments for a future berth-snap / capsule collider (ship half-beam vs segment radius).
export function harborWalls() {
  const out = [];
  PIER_ANGLES.forEach((th, k) => { const { u, v } = pierUV(th), r0 = pierRoot(th), hz = (PIER.head0 + PIER.head1) / 2, H = PIER.headHalf, f = (a, b) => +(a).toFixed(2);
    out.push({ kind: 'stem', pier: k + 1, x0: f(u[0] * r0), z0: f(u[1] * r0), x1: f(u[0] * PIER.head0), z1: f(u[1] * PIER.head0), r: PIER.w / 2 });
    out.push({ kind: 'head', pier: k + 1, x0: f(u[0] * hz - v[0] * H), z0: f(u[1] * hz - v[1] * H), x1: f(u[0] * hz + v[0] * H), z1: f(u[1] * hz + v[1] * H), r: (PIER.head1 - PIER.head0) / 2 }); });
  return out;
}
// deck rectangles in the pier frame (x along v, z along u), for walking + overlay
export function pierDecks() {
  return PIER_ANGLES.map((th, k) => ({ th, pier: k + 1, rects: [[-PIER.w / 2, pierRoot(th), PIER.w / 2, PIER.head0], [-PIER.headHalf, PIER.head0, PIER.headHalf, PIER.head1]] }));
}
// deck height under (x, z) if it is on a pier, else null
export function deckAt(x, z) {
  for (const d of pierDecks()) { const { u, v } = pierUV(d.th), a = x * v[0] + z * v[1], b = x * u[0] + z * u[1];
    for (const [x0, z0, x1, z1] of d.rects) if (a >= x0 && a <= x1 && b >= z0 && b <= z1) return PIER.y + 0.2; }
  return null;
}
function tPier(kit, th, k, low) {
  const r0 = pierRoot(th), h0 = PIER.head0, h1 = PIER.head1, hz = (h0 + h1) / 2, H = PIER.headHalf, W = PIER.w, Y = PIER.y, STEP = low ? 9 : 6;
  kit.at(M(0, 0, 0, th), () => { // pier frame: +z outward along the stem, +x along the head (= v)
    // stem: planks + stringers + pilings + low rope rail
    const n = Math.round((h0 - r0) / 2.1);
    for (let i = 0; i < n; i++) kit.add(RB(W + ((i * 7) % 3) * 0.1, 0.32, 2.0, 0.08), i % 3 ? WOOD_L : 0xc98a4c, { m: M(0, Y, r0 + (i + 0.5) * (h0 - r0) / n), outline: false });
    kit.add(RB(W + 0.6, 0.4, h0 - r0, 0.1), WOOD_D, { m: M(0, Y - 0.36, (r0 + h0) / 2), outline: 1 });
    for (let z = r0 + 6; z < h0; z += STEP) for (const sx of [-1, 1]) kit.add(cyl(0.4, 0.44, 11, low ? 6 : 8), WOOD, { m: M(sx * (W / 2 + 0.1), Y - 5, z), outline: false });
    for (const sx of [-1, 1]) { kit.add(RB(0.16, 0.16, h0 - r0 - 2, 0.05), 0xe7c08d, { m: M(sx * (W / 2 - 0.1), Y + 0.95, (r0 + h0) / 2), outline: false });
      for (let z = r0 + 2; z < h0; z += 5) kit.add(cyl(0.1, 0.1, 1.0, 5), WOOD_D, { m: M(sx * (W / 2 - 0.1), Y + 0.5, z), outline: false }); }
    // T-head: planks across, a heavier beam, pilings along both faces
    const m = Math.round(2 * H / 2.1);
    for (let i = 0; i < m; i++) kit.add(RB(2.0, 0.32, h1 - h0, 0.08), i % 3 ? WOOD_L : 0xc98a4c, { m: M(-H + (i + 0.5) * 2 * H / m, Y, hz), outline: false });
    kit.add(RB(2 * H + 0.6, 0.45, h1 - h0 + 0.6, 0.12), WOOD_D, { m: M(0, Y - 0.38, hz), outline: 1 });
    for (let x = -H + 1; x <= H; x += STEP) for (const z of [h0 + 0.2, h1 - 0.2]) kit.add(cyl(0.42, 0.46, 11, low ? 6 : 8), WOOD, { m: M(x, Y - 5, z), outline: false });
    // per berth: two bollards, fenders on the face, a little numbered post
    for (const t of PIER.lat) {
      for (const e of [-8.5, 8.5]) { kit.add(cyl(0.34, 0.42, 0.85, 7), IRON, { m: M(t + e, Y + 0.6, h1 - 0.7), outline: e < 0 ? 1 : false }); kit.add(cyl(0.48, 0.48, 0.18, 7), IRON, { m: M(t + e, Y + 1.05, h1 - 0.7), outline: false }); }
      if (!low) for (const e of [-6, 0, 6]) kit.add(new THREE.TorusGeometry(0.42, 0.2, 5, 8), 0x26282c, { m: M(t + e, Y - 1.0, h1 + 0.35), outline: false });
    }
    // head-end lanterns (knee-to-head high only) + a few crates / barrels; a buoy pair marks the approach
    for (const sx of [-1, 1]) lantern(kit, M(sx * (H - 1), Y + 0.15, hz, 0, 0, 0, 0.8), low);
    crate(kit, M(-2.2, Y + 0.85, h0 + 1.6, 0.3 + k)); barrel(kit, M(2.4, Y + 0.15, h0 + 1.5), low);
    if (!low || k % 2 === 0) for (const [x, col] of [[-H - 9, 0x22c55e], [H + 9, RED]]) kit.at(M(x, 0, h1 + 10), () => {
      kit.add(cyl(0.9, 1.2, 1.6, 10), col, { m: M(0, 0.2, 0) }); kit.add(new THREE.ConeGeometry(0.7, 1.4, 10), col, { m: M(0, 1.7, 0) });
      kit.add(RB(1.9, 0.3, 1.9, 0.1), 0xffffff, { m: M(0, -0.45, 0), outline: false });
    });
  });
}
// a second market stall (smaller, coloured awning)
function stall(kit, s, low) {
  const y = groundY(s.x, s.z) - 0.2;
  kit.at(M(s.x, y, s.z, s.yaw), () => {
    kit.add(RB(5, 2.0, 2.2, 0.25), WOOD, { m: M(0, 1.0, 0) }); kit.add(RB(5.3, 0.3, 2.5, 0.1), WOOD_L, { m: M(0, 2.1, 0) });
    for (const x of [-2.4, 2.4]) for (const z of [-1, 1]) kit.add(cyl(0.16, 0.18, 4.8, 7), WOOD_D, { m: M(x, 2.4, z) });
    for (let i = 0; i < 5; i++) kit.add(RB(1.04, 0.16, 3.2, 0.06), i % 2 ? 0xffffff : s.c, { m: M(-2.08 + i * 1.04, 5.0, 0.4, 0, -0.28), outline: i === 2 ? 1 : false });
    for (let i = 0; i < (low ? 3 : 6); i++) kit.add(sph(0.36, 8, 6), [0xff8a1f, 0xffe066, 0xfa0d0d][i % 3], { m: M(-1.8 + i * 0.7, 2.55, 0.2), outline: false });
    crate(kit, M(3.4, 0.7, 0.8, 0.4)); barrel(kit, M(-3.4, 0, 0.9), low);
  });
}

function digSpot(kit, A, s, k, low) {
  const y = groundY(s.x, s.z);
  kit.at(M(s.x, y, s.z, 0.3 + k * 1.1), () => {
    for (const a of [Math.PI / 4, -Math.PI / 4]) kit.add(RB(6.2, 0.22, 1.25, 0.1), RED, { m: M(0, 0.05, 0, a), outline: 0.6 });
    for (const [x, z, r] of [[3.6, 2.4, 1.3], [-3.4, 3.0, 1.0], [2.8, -3.4, 0.9]]) kit.add(sph(r, low ? 10 : 14, 8), 0xf7d48b, { m: M(x, 0, z, 0, 0, 0, [1, 0.45, 1]) });
    kit.add(new THREE.CircleGeometry(1.1, 14), 0x6b4a26, { m: M(-2.1, 0.06, -2.4, 0, -Math.PI / 2), outline: false });
    if (k % 2 === 0) kit.at(M(3.0, 0, 1.7, -0.6, 0.0, 0.32), () => { // shovel stuck in the sand
      kit.add(cyl(0.13, 0.13, 3.8, 7), WOOD, { m: M(0, 2.1, 0) }); kit.add(RB(1.0, 0.3, 0.3, 0.1), WOOD_D, { m: M(0, 4.05, 0) }); kit.add(RB(1.1, 1.5, 0.14, 0.12), 0xc6cdd6, { m: M(0, 0.2, 0) });
    });
    else { kit.add(RB(1.4, 1.0, 1.0, 0.15), WOOD, { m: M(3.2, 0.2, 1.4, 0.5, 0.2) }); kit.add(RB(1.5, 0.25, 1.1, 0.08), GOLD, { m: M(3.2, 0.75, 1.4, 0.5, 0.2), outline: false }); } // a half-dug chest corner
    kit.add(cyl(0.12, 0.14, 2.6, 6), WOOD_D, { m: M(-4.6, 1.3, -1.5) });
    kit.add(RB(3.0, 1.3, 0.25, 0.1), WOOD_L, { m: M(-4.6, 2.4, -1.5, 0.25) });
    quad(kit, 2.8, 1.15, A.dig, M(-4.6, 2.4, -1.5, 0.25, 0, 0).multiply(M(0, 0, 0.14)));
  });
}

// ---------- decor ships: chibi toy galleons merged into the island mesh (0 extra draw calls) for the moored fleet ----------
const HULLS = [[0x8a4b25, 0xfa0d0d], [0x2a2f3a, 0xffcd77], [0x1d3557, 0xffcd77], [0x6b2d5c, 0xffffff], [0x3a5a2a, 0xffcd77], [0xb07a30, 0x161616]];
export function decorShip(kit, A, x, z, yaw, v, low) {
  const [hc, trim] = HULLS[v % HULLS.length];
  kit.at(M(x, 0, z, yaw), () => {
    const g = new THREE.BoxGeometry(6.6, 3.6, 19, 4, 2, low ? 8 : 12), P = g.attributes.position;
    for (let i = 0; i < P.count; i++) { let px = P.getX(i), py = P.getY(i), pz = P.getZ(i); const u = pz / 9.5, bow = u > 0 ? Math.pow(u, 2.2) * 0.8 : Math.pow(-u, 3) * 0.35;
      px *= (1 - bow) * (py < 0 ? 0.72 + 0.28 * (py + 1.8) / 1.8 : 1); py += u * u * 0.9 + (u > 0 ? u * 0.3 : 0); P.setXYZ(i, px, py + 0.7, pz); }
    g.computeVertexNormals();
    kit.add(g, (p) => p.y > 2.1 ? trim : hc);
    kit.add(RB(5.4, 0.3, 15.5, 0.1), WOOD_L, { m: M(0, 2.45, -0.4), outline: false });       // deck (closed: no water inside)
    kit.add(RB(5.6, 2.2, 4.2, 0.3), hc, { m: M(0, 3.4, -6.6) }); kit.add(RB(5.8, 0.3, 4.4, 0.1), trim, { m: M(0, 4.55, -6.6), outline: false }); // stern castle
    for (const [mz, h, sw, sh] of [[2.6, 12, 7.2, 5.2], [-2.8, 10.5, 6.2, 4.4]]) {
      kit.add(cyl(0.2, 0.26, h, 6), WOOD_D, { m: M(0, 2.5 + h / 2, mz), outline: false });
      kit.add(cyl(0.12, 0.12, sw + 0.8, 5), WOOD_D, { m: M(0, 2.5 + h - 1.2, mz, 0, 0, Math.PI / 2), outline: false });
      quad(kit, sw, sh, A.flag, M(0, 2.5 + h - 1.4 - sh / 2, mz + 0.25)); quad(kit, sw, sh, A.flagBack, M(0, 2.5 + h - 1.4 - sh / 2, mz + 0.2, Math.PI));
    }
    kit.add(cyl(0.1, 0.1, 6, 5), WOOD_D, { m: M(0, 3.6, 10.6, 0, 1.15), outline: false }); // bowsprit
  });
}
// players-to-scale markers: chibi pirate stand-ins (1.8 tall, big head) in one merged mesh
export function scaleMarkers(n = 16) {
  const kit = new Kit(), cols = [0xfa0d0d, 0x2a6df4, 0x22c55e, 0xffcd77, 0x9b4dff, 0xff8a1f, 0x161616, 0xffffff];
  const P = SPOTS.plaza;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (i % 2) * 0.2, r = 5 + (i % 3) * 4.5, x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, y = groundY(x, z), c = cols[i % cols.length];
    kit.at(M(x, y, z, -a), () => {
      kit.add(cyl(0.32, 0.38, 0.9, 8), c, { m: M(0, 0.45, 0) });
      kit.add(sph(0.42, 10, 8), 0xf2c9a0, { m: M(0, 1.3, 0) });
      kit.add(cyl(0.5, 0.5, 0.12, 10), 0x161616, { m: M(0, 1.62, 0) }); kit.add(cyl(0.22, 0.32, 0.3, 8), 0x161616, { m: M(0, 1.8, 0), outline: false });
    });
  }
  return kit;
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
  for (let i = 0; i < (low ? 28 : 44); i++) { const a = (i / (low ? 28 : 44)) * Math.PI * 2; kit.add(RB(1.4, 0.4, 0.9, 0.15), i % 2 ? STONE : 0xc3ccd8, { m: M(p.x + Math.cos(a) * p.r, groundY(p.x + Math.cos(a) * p.r, p.z + Math.sin(a) * p.r) + 0.05, p.z + Math.sin(a) * p.r, -a), outline: false }); }
  const f = SPOTS.flag, fy = groundY(f.x, f.z);
  kit.add(cyl(1.4, 1.8, 1.0, 10), STONE_D, { m: M(f.x, fy + 0.4, f.z) });
  kit.add(cyl(0.22, 0.26, 13, 8), WOOD_D, { m: M(f.x, fy + 7, f.z) });
  kit.add(sph(0.45, 10, 8), GOLD, { m: M(f.x, fy + 13.6, f.z), outline: false });
  quad(kit, 6, 4, A.flag, M(f.x - 3, fy + 11, f.z, Math.PI)); quad(kit, 6, 4, A.flagBack, M(f.x - 3, fy + 11, f.z));
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

// ---------- lookout tower (left flank): tapered timber legs, platform with a rail, spyglass on a tripod aimed at the harbor ----------
export const TOWER_H = 19;
export const TAVERN_S = 1.2;
function tower(kit, low) {
  const t = SPOTS.tower, y0 = groundY(t.x, t.z) - 0.4, H = TOWER_H, B = 3.0, T = 1.9;
  kit.at(M(t.x, y0, t.z, 0.25), () => {
    kit.add(RB(7.2, 1.2, 7.2, 0.4), STONE, { m: M(0, 0.4, 0) });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const a = new THREE.Vector3(sx * B, 0.8, sz * B), b = new THREE.Vector3(sx * T, H, sz * T), d = b.clone().sub(a), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      kit.add(cyl(0.3, 0.4, d.length(), low ? 6 : 8), WOOD_D, { m: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)) });
    }
    for (const y of [5.5, 11, 16]) { const w = B - (B - T) * (y / H); for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) kit.add(RB(2 * w + 0.6, 0.3, 0.3, 0.08), WOOD, { m: M(0, y, 0, r).multiply(M(0, 0, w)), outline: false }); }
    for (const [sx, y0b, y1b] of [[-1, 1.5, 9], [1, 9, 16.5]]) { // X braces on the harbor face
      const a = new THREE.Vector3(-B * 0.8, y0b, B * 0.85 - 0.2 * (y0b / H)), b = new THREE.Vector3(B * 0.7, y1b, (B - (B - T) * (y1b / H))), d = b.clone().sub(a);
      if (sx > 0) { a.x *= -1; b.x *= -1; d.x *= -1; }
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      kit.add(RB(0.25, d.length(), 0.25, 0.06), WOOD, { m: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), outline: false });
    }
    // ladder up the back
    for (const x of [-0.6, 0.6]) kit.add(cyl(0.09, 0.09, H, 5), WOOD_L, { m: M(x, H / 2 + 0.6, -T - 0.9, 0, -0.06), outline: false });
    for (let y = 1.6; y < H; y += 1.3) kit.add(cyl(0.07, 0.07, 1.2, 4), WOOD_L, { m: M(0, y, -T - 0.9 + (y - H / 2) * 0.06, 0, 0, Math.PI / 2), outline: false });
    // platform + rail + roof
    kit.add(RB(6.4, 0.5, 6.4, 0.18), WOOD_L, { m: M(0, H + 0.2, 0) });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(cyl(0.16, 0.16, 4.8, 6), WOOD_D, { m: M(sx * 2.95, H + 2.6, sz * 2.95), outline: false });
    for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) kit.add(RB(6.1, 0.22, 0.22, 0.06), WOOD_L, { m: M(0, H + 1.45, 0, r).multiply(M(0, 0, 2.95)), outline: false });
    kit.add(new THREE.ConeGeometry(5.0, 2.6, 4), ROOF, { m: M(0, H + 6.2, 0, Math.PI / 4) });
    kit.add(cyl(0.08, 0.08, 3, 5), WOOD_D, { m: M(0, H + 8.6, 0), outline: false });
    // spyglass on a brass tripod at the harbor-side rail
    kit.at(M(0, H + 0.45, 2.0), () => {
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; kit.add(cyl(0.05, 0.05, 1.5, 4), WOOD_D, { m: M(Math.cos(a) * 0.35, 0.7, Math.sin(a) * 0.35, 0, Math.sin(a) * 0.25, -Math.cos(a) * 0.25), outline: false }); }
      kit.at(M(0, 1.5, 0, 0.0, -0.12), () => { kit.add(cyl(0.12, 0.16, 1.6, 10), GOLD, { m: M(0, 0, 0.2, 0, Math.PI / 2) }); kit.add(cyl(0.2, 0.2, 0.3, 10), 0x7a5a2a, { m: M(0, 0, 1.0, 0, Math.PI / 2), outline: false }); kit.add(cyl(0.09, 0.09, 0.4, 8), GOLD, { m: M(0, 0, -0.75, 0, Math.PI / 2), outline: false }); });
    });
  });
  // flag on the roof spire
  return { x: t.x, z: t.z, top: y0 + H };
}
// beach spectator seating: driftwood logs facing the harbor + a little firepit (all knee-high)
// quay-side spectator seating: driftwood logs on the promenade facing the harbor + two firepits on the grass behind (all knee-high)
// spectator / hangout seating: driftwood logs round the plaza rim + firepits on the back beach (all knee-high)
function seating(kit, low) {
  const P = SPOTS.plaza;
  for (const a of [0.35, 0.9, 2.25, 2.8]) { const x = P.x + Math.cos(a) * (P.r + 3), z = P.z + Math.sin(a) * (P.r + 3), y = groundY(x, z), ry = -a + Math.PI / 2;
    kit.add(cyl(0.65, 0.7, 6.5, low ? 8 : 10), 0xa36a3c, { m: M(x, y + 0.45, z, ry, 0, Math.PI / 2) });
    for (const e of [-3.25, 3.25]) kit.add(cyl(0.6, 0.6, 0.08, low ? 8 : 10), 0xe7c08d, { m: M(x + Math.cos(ry) * e, y + 0.45, z - Math.sin(ry) * e, ry, 0, Math.PI / 2), outline: false }); }
  for (const [fx, fz] of [[-4, -50], [30, -44]]) {
    const y = groundY(fx, fz);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; kit.add(sph(0.55, 8, 6), STONE, { m: M(fx + Math.cos(a) * 1.7, y + 0.15, fz + Math.sin(a) * 1.7, 0, 0, 0, [1, 0.7, 1]), outline: false }); }
    kit.add(new THREE.ConeGeometry(0.9, 1.6, 7), 0xff8a1f, { bucket: 'glow', m: M(fx, y + 0.8, fz), outline: false });
    kit.add(new THREE.ConeGeometry(0.5, 1.1, 6), 0xffe066, { bucket: 'glow', m: M(fx + 0.1, y + 0.7, fz + 0.2), outline: false });
  }
  // wooden step logs on the steep bits of the hill path
  for (const [x, z, ry] of [[-26, 3, 0.2], [-29, -6, 1.2], [-33, -3, 0.1], [-35, -11, 1.3]]) kit.add(cyl(0.3, 0.3, 3.6, 6), WOOD_D, { m: M(x, groundY(x, z) + 0.15, z, ry, 0, Math.PI / 2), outline: false });
}

// ---------- gameplay data for the harbor integration (island-local) ----------
// solid circles like props.js rock islands ({x, z, r, h}): r 12 discs on a 16 grid over the land; piers are not solid
// (see harborWalls). Every circle stays >= 9 clear of every berth centre.
export function islandColliders() {
  const out = [], B = BERTHS();
  for (let z = -80; z <= 80; z += 16) for (let x = -80; x <= 80; x += 16) {
    if (groundY(x, z) < 0.4) continue;
    if (B.some(b => Math.hypot(b.x - x, b.z - z) - 12 < 9)) continue;
    out.push({ x, z, r: 12, h: 10 });
  }
  out.push({ x: SPOTS.tower.x, z: SPOTS.tower.z, r: 4, h: TOWER_H + 20 });
  return out;
}
// on foot: land above the surf (h >= 0.8) or a pier deck
export const canWalk = (x, z) => groundY(x, z) >= 0.8 || deckAt(x, z) !== null;
export const footY = (x, z) => { const d = deckAt(x, z); return d !== null ? Math.max(d, groundY(x, z)) : groundY(x, z); };
// walkable outline segments + areas (land and decks)
export function walkable(step = 3) {
  const R = TERRAIN_R, seg = []; let land = 0, deck = 0;
  for (let z = -R; z < R; z += step) for (let x = -R; x < R; x += step) {
    const a = canWalk(x, z), b = canWalk(x + step, z), c = canWalk(x, z + step);
    if (a) { if (groundY(x, z) >= 0.8) land++; else deck++; }
    if (a !== b) seg.push([x + step, z, x + step, z + step]); if (a !== c) seg.push([x, z + step, x + step, z + step]);
  }
  const deckArea = pierDecks().reduce((s, d) => s + d.rects.reduce((q, [x0, z0, x1, z1]) => q + (x1 - x0) * (z1 - z0), 0), 0);
  return { seg, landArea: land * step * step, deckArea: Math.round(deckArea) };
}

// ---------- far LOD: one merged silhouette mesh (no outlines, no textures) ----------
export function buildFarIsland() {
  const kit = new Kit();
  { const { g, colors } = radialGeo(14, 40, 92); kit.add(g, 0xffffff, { outline: false }); const L = kit.b.get('toon'); L[L.length - 1].setAttribute('color', new THREE.BufferAttribute(colors, 3)); }
  const box = (w, h, d, c, m) => kit.add(new THREE.BoxGeometry(w, h, d), c, { m, outline: false });
  const t = SPOTS.tavern, ty = groundY(t.x, t.z);
  box(15, 12, 12, CREAM, M(t.x, ty + 5.4, t.z)); kit.add(new THREE.CylinderGeometry(0.6, 1, 6.2, 4, 1), ROOF, { m: M(t.x, ty + 16.3, t.z, Math.PI / 4, 0, 0, [13.7, 1.2, 10.8]), outline: false });
  box(19, 0.6, 10, WOOD_L, M(t.x, ty + 1.6, t.z + 11.3));
  const w = SPOTS.tower, wy = groundY(w.x, w.z); kit.add(new THREE.CylinderGeometry(1.6, 2.6, TOWER_H, 4), WOOD_D, { m: M(w.x, wy + TOWER_H / 2, w.z, Math.PI / 4), outline: false }); kit.add(new THREE.ConeGeometry(5, 3, 4), ROOF, { m: M(w.x, wy + TOWER_H + 5, w.z, Math.PI / 4), outline: false }); box(6.4, 4.5, 6.4, WOOD_L, M(w.x, wy + TOWER_H + 2, w.z));
  for (const d of pierDecks()) for (const [x0, z0, x1, z1] of d.rects) box(x1 - x0, 0.7, z1 - z0, WOOD_L, M(0, 0, 0, d.th).multiply(M((x0 + x1) / 2, PIER.y, (z0 + z1) / 2)));
  const b = SPOTS.board; box(16, 5, 3, RED, M(b.x, groundY(b.x, b.z) + 2.5, b.z, b.yaw));
  for (const [x, z, h] of PALMS.filter((_, i) => i % 2 === 0)) { const y = groundY(x, z); kit.add(new THREE.CylinderGeometry(0.4, 0.6, h, 4), 0xa96a38, { m: M(x, y + h / 2, z), outline: false }); kit.add(new THREE.ConeGeometry(4.5, 2.2, 6), LEAF, { m: M(x, y + h, z), outline: false }); }
  const p = SPOTS.flag; kit.add(new THREE.CylinderGeometry(0.3, 0.3, 13, 4), WOOD_D, { m: M(p.x, groundY(p.x, p.z) + 6.5, p.z), outline: false }); box(6, 4, 0.2, 0x121212, M(p.x - 3, groundY(p.x, p.z) + 11, p.z));
  return kit;
}

// ---------- palms + foliage placement ----------
const nearAny = (x, z, list, d) => list.some(q => Math.hypot(q.x - x, q.z - z) < d);
const KEEP_OUT = () => [SPOTS.tavern, SPOTS.chest, SPOTS.tower, SPOTS.board, SPOTS.flag, ...SPOTS.stalls, ...SPOTS.digs, { x: 0, z: -12 }];
const nearPier = (x, z, d) => PIER_ANGLES.some(th => { const { u, v } = pierUV(th); return Math.abs(x * v[0] + z * v[1]) < d && x * u[0] + z * u[1] > 30; });
// palms on the back / flanks + the jungle (nothing tall on the harbor side: local angle from +z > 55 deg)
const PALMS = (() => {
  const r = rng(7), out = [];
  for (let deg = 58; deg <= 302; deg += 11) { const a = deg * Math.PI / 180, rr = edgeR(Math.atan2(Math.cos(a), Math.sin(a))) - 7 - r() * 6, x = Math.sin(a) * rr, z = Math.cos(a) * rr;
    if (nearPier(x, z, 9) || nearAny(x, z, KEEP_OUT(), 9)) continue; out.push([+x.toFixed(1), +z.toFixed(1), 10 + r() * 3, 0.9 + r() * 0.3, Math.atan2(x, z) + (r() - 0.5) * 0.6]); }
  const J = SPOTS.jungle; for (let i = 0; i < 9; i++) { const a = i * 2.4, rr = 4 + (i % 4) * 3.4, x = J.x + Math.cos(a) * rr, z = J.z + Math.sin(a) * rr; if (Math.hypot(x - 36, z - -16) < 5) continue; out.push([+x.toFixed(1), +z.toFixed(1), 11 + r() * 4, 0.7 + r() * 0.5, r() * 6.28]); }
  for (const [x, z] of [[-52, -22], [-30, -26], [-54, -4]]) out.push([x, z, 9 + r() * 2, 1.0, Math.atan2(x, z)]); // hill flanks
  return out;
})();
// instanced ground foliage (grass tufts + ferns): ONE InstancedMesh (1 draw call), near LOD only
export function buildPlants(low, mat) {
  const parts = [];
  for (let i = 0; i < 5; i++) { const g = new THREE.ConeGeometry(0.16, 1.1 + (i % 2) * 0.4, 3); g.translate(0, 0.5, 0); g.rotateZ((i - 2) * 0.28); g.rotateY(i * 1.3); parts.push(g.toNonIndexed()); }
  const pos = [], col = []; const c1 = C(0x2fbf4a), c2 = C(0x9cf06a);
  for (const g of parts) { const P = g.attributes.position; for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); const c = c1.clone().lerp(c2, Math.min(1, P.getY(i) / 1.4)); col.push(c.r, c.g, c.b); } g.dispose(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const N = low ? 450 : 1500, r = rng(99), mats = [], mm = new THREE.Matrix4(), J = SPOTS.jungle;
  for (let tries = 0; mats.length < N && tries < N * 12; tries++) {
    const jungle = tries % 3 === 0, a = r() * Math.PI * 2, rr = jungle ? Math.sqrt(r()) * J.r * 1.15 : Math.sqrt(r()) * 62;
    const x = jungle ? J.x + Math.cos(a) * rr : Math.cos(a) * rr, z = jungle ? J.z + Math.sin(a) * rr : Math.sin(a) * rr, y = groundY(x, z);
    if (y < 2.7 || Math.hypot(x, z) > edgeR(Math.atan2(z, x)) - 6 || pathDist(x, z) < 3 || Math.hypot(x - SPOTS.plaza.x, z - SPOTS.plaza.z) < SPOTS.plaza.r + 2 || nearAny(x, z, KEEP_OUT(), 8)) continue;
    const sc = (jungle ? 1.3 + r() * 1.3 : 0.6 + r() * 0.7);
    mats.push(mm.clone().compose(new THREE.Vector3(x, y - 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6.28, 0)), new THREE.Vector3(sc, sc * (0.8 + r() * 0.5), sc)));
  }
  const im = new THREE.InstancedMesh(geo, mat, mats.length); mats.forEach((m, i) => im.setMatrixAt(i, m)); im.instanceMatrix.needsUpdate = true; im.name = 'island_plants';
  im.computeBoundingSphere(); return im;
}

// ---------- build the whole island ----------
// decor: [[x, z, yaw, variant]...] moored toy galleons merged in (0 extra draw calls)
export function buildIsland({ low, atlas, decor = [] }) {
  const kit = new Kit(), A = atlas.R; RBS = low ? 1 : 2;
  terrain(kit, low);
  plaza(kit, A, low); tavern(kit, A, low); PIER_ANGLES.forEach((th, k) => tPier(kit, th, k, low));
  SPOTS.digs.forEach((d, k) => digSpot(kit, A, d, k, low)); shopAndBoard(kit, A, low); SPOTS.stalls.forEach(st => stall(kit, st, low)); chestPedestal(kit, low);
  { const c = SPOTS.chest, y = groundY(c.x - 6.5, c.z + 4.5); kit.add(cyl(0.14, 0.16, 3.2, 6), WOOD_D, { m: M(c.x - 6.8, y + 1.6, c.z + 4.8) }); kit.add(RB(4.0, 1.1, 0.25, 0.1), WOOD_L, { m: M(c.x - 6.8, y + 2.9, c.z + 4.8, -0.5) }); quad(kit, 3.8, 0.95, A.daily, M(c.x - 6.8, y + 2.9, c.z + 4.8, -0.5).multiply(M(0, 0, 0.14))); }
  tower(kit, low); seating(kit, low);
  PALMS.filter((_, i) => !low || i % 3 !== 2).forEach(([x, z, h, l, yaw], i) => palm(kit, x, z, h, l, yaw, 31 + i, low));
  const rr = rng(5), rocks = [];
  for (let deg = 40; deg <= 320; deg += 17) { const a = deg * Math.PI / 180, e = edgeR(Math.atan2(Math.cos(a), Math.sin(a))) + 3 + rr() * 6, x = Math.sin(a) * e, z = Math.cos(a) * e; if (!nearPier(x, z, 12)) rocks.push([x, z, (Math.abs(deg - 180) < 100 ? 1.6 : 1.0) + rr() * 1.6]); }
  rocks.push([-46, -20, 2.2], [-34, -24, 1.4], [52, -14, 1.6], [38, 4, 1.2]);
  rocks.forEach(([x, z, sc], i) => rock(kit, x, z, sc, 71 + i, low));
  const J = SPOTS.jungle, bushes = [[-14, 6, 1.3], [16, 6, 1.2], [-36, 24, 1.3], [-50, 10, 1.4], [-8, -42, 1.2], [26, -30, 1.3], [-56, -26, 1.4], [8, 52, 0.9], [-8, 52, 0.9]];
  for (let i = 0; i < (low ? 8 : 16); i++) { const a = i * 2.1, rr2 = 3 + (i % 5) * 3, x = J.x + Math.cos(a) * rr2, z = J.z + Math.sin(a) * rr2; if (Math.hypot(x - 36, z + 16) > 4) bushes.push([x, z, 1.2 + (i % 3) * 0.5]); }
  bushes.forEach(([x, z, sc], i) => bush(kit, x, z, sc, 91 + i));
  for (const [x, z, yaw, v] of decor) decorShip(kit, A, x, z, yaw, v, low);
  return kit;
}
