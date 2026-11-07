// [lagoon-rework] BANKSY: "keep same shape, make hill look better and make waterfall cooler, make path nicer, make fishing nicer."
// Gill's Lagoon dressing, all COSMETIC (no colliders, decks, walk heights or interact points move: lagoon.js register() is untouched):
//   1. hill: a layered rock-strata skin over the steep crater walls + Waterfall Hill (follows the exact terrain triangles, eased out to a
//      mossy rim where the slope softens, skipped on trails / stairs / decks), ledge slabs along the contours, ferns + shrubs + vines
//   2. waterfall: a fast white veil + two side cascades over the existing curtain, plunge splash rings, droplet spray, rolling mist,
//      a faint rainbow, light shafts (High only) and wet glossy boulders round the pool
//   3. path: a timber gateway with a hanging GILL'S LAGOON sign over the dock root, flower borders + lanterns along the cobbles
//   4. fishing: lanterns on the dock rails, an end-of-dock tackle station (rods, bait bucket, tackle box, stool, net, life ring),
//      water ripples round the posts, notched lily pads with lotus flowers
// low (phones / Low graphics) = coarser skin, fewer plants + particles, no light shafts.
import * as THREE from 'three';
import { Kit, M, box, cyl, ball, hash, jitter, W, C, instanced, sm } from './common.js';
import { waterfallGeometry } from '../riverWater.js';

export const LAGOON_ART = typeof location === 'undefined' || !/[?&]lagoonart=0(&|$)/.test(location.search); // &lagoonart=0 = the old lagoon
export const ART_STATS = {};
const FALLS = { x: -206, z: -183.2 };                       // = riverWater LAKE_FALLS (the plunge point)
const NOTCH = [-214.5, -197.5, -200, -177];                 // the curtain + grotto notch: no skin / no plants here
const CHUTES = [[-220.5, -215.5, -207, -180], [-196.6, -192.2, -207, -180]]; // the two side cascades carve their own channels
const vn2 = (x, z) => { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
const fbm2 = (x, z) => vn2(x, z) * 0.55 + vn2(x * 2.03 + 7.1, z * 2.03 - 3.3) * 0.3 + vn2(x * 4.1 - 2.2, z * 4.1 + 9.4) * 0.15;
const rectD = (x, z, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[1]), Math.max(r[2] - z, 0, z - r[3]));
const NOISE_GLSL = `float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hsh(i), hsh(i + vec2(1,0)), f.x), mix(hsh(i + vec2(0,1)), hsh(i + vec2(1,1)), f.x), f.y); }`;
const _col = new THREE.Color(), _c2 = new THREE.Color();
const STRATA = [0xb08e6a, 0x8a7a68, 0xc9a97e, 0x7a6f64, 0xa5876a, 0xd6bb8e, 0x8f7b66, 0xbf9c74].map(h => new THREE.Color(h));
const MOSS = new THREE.Color(0x5e9a3c), MOSS_D = new THREE.Color(0x3f7a30), WET = new THREE.Color(0x4a4d50);

// ---------------------------------------------------------------- 1. HILL: strata skin ----------------------------------------------------------------
// The ground is a 4 m triangle grid (foot.js Htri). The skin samples those exact triangles every `step` m and pushes each vertex out along a
// SMOOTHED normal by a strata profile (caprock lips every ~2.4 m, noise bulges), weighted by a smoothed steepness, so it is crack-free and
// eases to +0.1 m (a mossy rim) where the slope flattens. Where w = 0 the cell is not emitted at all.
export function strataSkin({ F, H, LAKE, low, GROTTO }) {
  const Ht = F.Htri || H, step = low ? 1.8 : 0.75, X0 = -300, X1 = -110, Z0 = -292, Z1 = -62;
  const nx = Math.ceil((X1 - X0) / step) + 1, nz = Math.ceil((Z1 - Z0) / step) + 1;
  // coarse 4 m pre-pass: which 8 m blocks have any steep ground at all (skip the flat lake floor + plateau quickly)
  const slopeAt = (x, z, e = 2.5) => Math.hypot(H(x + e, z) - H(x - e, z), H(x, z + e) - H(x, z - e)) / (2 * e);
  const gp = new Set(); for (let z = Z0; z <= Z1; z += 4) for (let x = X0; x <= X1; x += 4) if (slopeAt(x, z) > 0.55) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) gp.add(Math.floor((x + dx * 4 - X0) / 8) + ',' + Math.floor((z + dz * 4 - Z0) / 8));
  const W_ = new Float32Array(nx * nz).fill(-1), P = new Float32Array(nx * nz * 3), Cc = new Float32Array(nx * nz * 3), id = new Int32Array(nx * nz).fill(-1);
  const deckNear = (x, z) => { if (!F.areaDeckAt) return false; for (const [dx, dz] of [[0, 0], [2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2]]) if (F.areaDeckAt(x + dx, z + dz) != null) return true; return false; };
  const vert = (i, j) => { const q = j * nx + i; if (W_[q] !== -1) return W_[q]; const x = X0 + i * step, z = Z0 + j * step;
    if (!gp.has(Math.floor((x - X0) / 8) + ',' + Math.floor((z - Z0) / 8))) return (W_[q] = 0);
    const y = Ht(x, z), gx = (H(x + 2, z) - H(x - 2, z)) / 4, gz = (H(x, z + 2) - H(x, z - 2)) / 4, s = Math.hypot(gx, gz);
    let w = sm(0.62, 1.15, s);
    if (w > 0) { const td = F.trailDist ? F.trailDist(x, z) : 99; w *= sm(4.2, 5.8, td); }
    if (w > 0 && (F.onWalkway?.(x, z, 0.8) || deckNear(x, z))) w = 0;
    if (w > 0) w *= sm(0.5, 2.5, rectD(x, z, NOTCH)) * sm(1, 4, rectD(x, z, [GROTTO.x0, GROTTO.x1, GROTTO.z0, GROTTO.z1])) * (0.3 + 0.7 * sm(0.2, 2.2, Math.min(rectD(x, z, CHUTES[0]), rectD(x, z, CHUTES[1]))));
    if (y < LAKE.y - 2.5) w = 0;
    W_[q] = w; if (w <= 0) return 0;
    const nl = Math.hypot(gx, 1, gz), Nx = -gx / nl, Ny = 1 / nl, Nz = -gz / nl;
    const n1 = fbm2(x * 0.08, z * 0.08), band = 2.5, hh = y + (n1 - 0.5) * 3.2 + Math.sin(x * 0.05 + z * 0.03) * 1.2, f = hh / band - Math.floor(hh / band), bi = Math.floor(hh / band);
    const lip = Math.pow(f, 2.2) * (0.6 + 0.6 * hash(bi, 3)), bulge = (fbm2(x * 0.23, z * 0.23) - 0.45) * 0.9;
    const off = 0.1 + w * (0.2 + lip * 1.25 + Math.max(-0.15, bulge));
    P[q * 3] = x + Nx * off; P[q * 3 + 1] = y + Ny * off; P[q * 3 + 2] = z + Nz * off;
    // colour: banded sandstone / slate, dark crevice under each lip, moss on ledges (up-facing) + along the softening rim, wet near the falls
    _col.copy(STRATA[((bi % STRATA.length) + STRATA.length) % STRATA.length]).lerp(STRATA[(((bi + 3) % STRATA.length) + STRATA.length) % STRATA.length], fbm2(x * 0.3, z * 0.3) * 0.35);
    _col.multiplyScalar(0.86 + 0.24 * fbm2(x * 0.6 + 4, z * 0.6));
    if (f < 0.14) _col.multiplyScalar(0.5 + f * 3.5); else if (f > 0.9) _col.multiplyScalar(1.12);
    const mossK = Math.max(sm(0.55, 0.85, Ny) * sm(0.35, 0.65, fbm2(x * 0.17 + 9, z * 0.17)), 1 - sm(0.05, 0.55, w));
    _c2.copy(MOSS).lerp(MOSS_D, fbm2(x * 0.4, z * 0.4)); _col.lerp(_c2, Math.min(1, mossK));
    const wet = 1 - sm(10, 22, Math.hypot(x - FALLS.x, z - FALLS.z + 6)); if (wet > 0) _col.lerp(WET, wet * 0.55);
    Cc[q * 3] = _col.r; Cc[q * 3 + 1] = _col.g; Cc[q * 3 + 2] = _col.b; return w; };
  const pos = [], col = [], idx = []; let nV = 0;
  const vid = (i, j) => { const q = j * nx + i; if (id[q] < 0) { id[q] = nV++; pos.push(P[q * 3], P[q * 3 + 1], P[q * 3 + 2]); col.push(Cc[q * 3], Cc[q * 3 + 1], Cc[q * 3 + 2]); } return id[q]; };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1); if (a <= 0 || b <= 0 || c <= 0 || d <= 0) continue;
    const A = vid(i, j), B = vid(i + 1, j), Cv = vid(i, j + 1), D = vid(i + 1, j + 1); idx.push(A, Cv, B, B, Cv, D); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
  ART_STATS.skinTris = idx.length / 3; return { g, W: W_, P, nx, nz, step, X0, Z0 };
}
// the skin goes through the island toon material (aMat 3 = rock detail layer in look.js) as one mesh, shared by the near + far sets
function skinMesh(g, MATS) { g.setAttribute('aMat', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(3), 1));
  const m = new THREE.Mesh(g, MATS.toon); m.name = 'lagoon_strata'; m.receiveShadow = true; return m; }

// ledge slabs + hanging vines + hill plants (instanced), placed off the skin's own samples so nothing floats
function hillDressing({ S, F, H, LAKE, low, MATS, OUT }) {
  const slabs = [], vines = [], ferns = [], bushes = [], flowers = [], rocks = [];
  const pick = (seed, keep) => { for (let k = 0; k < keep.n; k++) { const i = Math.floor(hash(k, seed) * (S.nx - 2)) + 1, j = Math.floor(hash(seed, k * 1.37 + 0.5) * (S.nz - 2)) + 1; keep.fn(i, j, k); } };
  const _q = new THREE.Quaternion(), _e = new THREE.Euler(), mk = (x, y, z, yaw, tilt, s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(tilt[0], yaw, tilt[1], 'YXZ')).clone(), new THREE.Vector3(...s));
  const clearOf = (x, z, pad) => !(F.onWalkway?.(x, z, pad)) && (F.trailDist ? F.trailDist(x, z) > 3.4 + pad : true) && rectD(x, z, NOTCH) > 3 && (!F.areaDeckAt || F.areaDeckAt(x, z) == null);
  // strata ledge slabs: long flat stones lying along the contour on steep skin
  pick(41, { n: low ? 700 : 2600, fn: (i, j) => { if (slabs.length >= (low ? 70 : 240)) return; const q = j * S.nx + i; if (!(S.W[q] > 0.75)) return;
    const x = S.P[q * 3], y = S.P[q * 3 + 1], z = S.P[q * 3 + 2], gx = H(x + 2, z) - H(x - 2, z), gz = H(x, z + 2) - H(x, z - 2); if (!clearOf(x, z, 1.5) || y < LAKE.y + 0.5) return;
    const yaw = Math.atan2(gx, gz) + Math.PI / 2, s = 0.7 + hash(i, j) * 0.9; slabs.push(mk(x, y - 0.12, z, yaw, [(hash(j, i) - 0.5) * 0.12, (hash(i + 3, j) - 0.5) * 0.12], [2.6 * s, 0.55 + hash(i, 7) * 0.3, 1.1 * s])); } });
  // vines: hang off the steep walls (more round the falls, where it is wet)
  pick(57, { n: low ? 500 : 2200, fn: (i, j) => { if (vines.length >= (low ? 30 : 120)) return; const q = j * S.nx + i; if (!(S.W[q] > 0.6)) return;
    const x = S.P[q * 3], y = S.P[q * 3 + 1], z = S.P[q * 3 + 2]; if (y < LAKE.y + 4 || !clearOf(x, z, 1)) return; const nearF = Math.hypot(x - FALLS.x, z - FALLS.z) < 45; if (!nearF && hash(i, j) > 0.35) return;
    const gx = H(x + 2, z) - H(x - 2, z), gz = H(x, z + 2) - H(x, z - 2), gl = Math.hypot(gx, gz) || 1, s = 0.8 + hash(j, i) * 1.2;
    vines.push(mk(x - gx / gl * 0.25, y, z - gz / gl * 0.25, Math.atan2(gx, gz), [0, 0], [1, s, 1])); } });
  // plants on the gentler hill flanks: ferns, round shrubs, flower clumps, small mossy rocks (sunk 0.15 m)
  const want = low ? { f: 70, b: 60, fl: 50, r: 20 } : { f: 260, b: 200, fl: 180, r: 70 };
  for (let k = 0; k < (low ? 1400 : 5200); k++) {
    const x = -296 + hash(k, 91) * 182, z = -288 + hash(k, 92) * 222, y = H(x, z), d = Math.hypot(x - LAKE.x, z - LAKE.z); if (d < LAKE.r + 1 || y < LAKE.y + 1.2) continue;
    const s = Math.hypot(H(x + 1.5, z) - H(x - 1.5, z), H(x, z + 1.5) - H(x, z - 1.5)) / 3; if (s > 1.05 || s < 0.12) continue; if (!clearOf(x, z, 1.2)) continue;
    const r = hash(k, 93), sc = 0.7 + hash(k, 94) * 0.8, yaw = hash(k, 95) * 6.28;
    if (r < 0.34 && ferns.length < want.f) ferns.push(mk(x, y - 0.1, z, yaw, [0, 0], [sc, sc, sc]));
    else if (r < 0.62 && bushes.length < want.b) bushes.push(mk(x, y - 0.2, z, yaw, [0, 0], [sc, sc * 0.85, sc]));
    else if (r < 0.9 && flowers.length < want.fl) flowers.push(mk(x, y - 0.05, z, yaw, [0, 0], [sc, sc, sc]));
    else if (rocks.length < want.r) rocks.push(mk(x, y - 0.35 * sc, z, yaw, [(hash(k, 96) - 0.5) * 0.3, 0], [sc * 1.3, sc * 0.8, sc]));
  }
  const grp = new THREE.Group(); grp.name = 'lagoon_hill_dressing';
  grp.add(instanced(MATS, OUT, (q) => { W(q, jitter(new THREE.BoxGeometry(1, 1, 1, 3, 1, 2), 0.12, 3), (p) => p.y > 0.3 ? 0x6f9a44 : 0xa38d72, M(0, 0, 0), false); }, slabs, 'lagoon_slabs'));
  grp.add(instanced(MATS, OUT, (q) => { for (let j = 0; j < 3; j++) W(q, box(0.12, 3.2 - j * 0.7, 0.05), j % 2 ? C.VINE : 0x3f9a3a, M((j - 1) * 0.35, -(3.2 - j * 0.7) / 2, 0.02 * j), false);
    for (let j = 0; j < 5; j++) W(q, ball(0.22, 5, 3), 0x4caa44, M((hash(j, 1) - 0.5) * 0.8, -0.4 - j * 0.55, 0.05, 0, 0, 0, [1, 0.6, 0.5]), false); }, vines, 'lagoon_vines'));
  grp.add(instanced(MATS, OUT, (q) => { for (let j = 0; j < 7; j++) { const a = j / 7 * Math.PI * 2; W(q, cyl(0.0, 0.16, 1.1, 3), j % 2 ? 0x3f9a3a : 0x5cb84a, M(Math.cos(a) * 0.35, 0.4, Math.sin(a) * 0.35, -a, 0, 0.9, [1, 1, 0.25]), false); } }, ferns, 'lagoon_ferns'));
  grp.add(instanced(MATS, OUT, (q) => { W(q, ball(0.7, 7, 5), 0x3f8f3a, M(0, 0.5, 0)); W(q, ball(0.5, 6, 4), 0x56a845, M(0.45, 0.45, 0.2)); W(q, ball(0.45, 6, 4), 0x2f7a34, M(-0.4, 0.4, -0.2)); }, bushes, 'lagoon_bushes'));
  grp.add(instanced(MATS, OUT, (q) => { for (let j = 0; j < 5; j++) { const a = j * 1.3, r = 0.2 + j * 0.06; W(q, cyl(0.015, 0.02, 0.5, 3), 0x4a8a34, M(Math.cos(a) * r, 0.25, Math.sin(a) * r), false);
    W(q, ball(0.09, 5, 3), [0xffe066, 0xffffff, 0xff8ad8, 0xb98cff, 0xff6b4a][j], M(Math.cos(a) * r, 0.52, Math.sin(a) * r), false); } }, flowers, 'lagoon_flowers'));
  grp.add(instanced(MATS, OUT, (q) => { W(q, jitter(new THREE.IcosahedronGeometry(0.8, 1), 0.18, 5), (p) => p.y > 0.35 ? 0x6a9a3e : 0x9c9284, M(0, 0, 0)); }, rocks, 'lagoon_rocks'));
  ART_STATS.slabs = slabs.length; ART_STATS.vines = vines.length; ART_STATS.plants = ferns.length + bushes.length + flowers.length; ART_STATS.rocks = rocks.length;
  return grp;
}

// ---------------------------------------------------------------- 2. WATERFALL ----------------------------------------------------------------
function veilMaterial(uTime, { speed = 1, white = 1, alpha = 1 } = {}) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uK: { value: new THREE.Vector3(speed, white, alpha) } }]),
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz);
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 uK; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      #include <common>
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      void main(){
        float t = uTime * uK.x, v = vUv.y, fall = 1.0 - v;                     // v: 1 = crest, 0 = plunge
        float sp = 1.6 + fall * 3.4;                                             // water accelerates as it drops
        float y = v * (3.0 + fall * 2.0);
        float rib = vn(vec2(vUv.x * 38.0 + sin(v * 7.0 + vUv.x * 3.0) * 0.8, y * 1.2 + t * sp));
        float ribbons = smoothstep(0.52, 0.86, rib);
        float clump = smoothstep(0.42, 0.85, vn(vec2(vUv.x * 11.0, y * 2.4 + t * sp * 1.2)));
        float lace = vn(vec2(vUv.x * 70.0, y * 9.0 + t * sp * 1.6));
        float wht = clamp(ribbons * 0.85 + clump * lace * 0.7 + smoothstep(0.86, 1.0, v) * 0.6 + smoothstep(0.22, 0.0, v) * 0.75, 0.0, 1.0) * uK.y;
        vec3 deep = vec3(0.16, 0.42, 0.47), foam = vec3(0.96, 0.99, 1.0);
        vec3 col = mix(deep, foam, wht);
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        col += vec3(0.25, 0.3, 0.32) * fres * 0.5;
        float sideN = vn(vec2(v * 5.0 - t * 1.3, 4.1)) * 0.16;
        float edge = smoothstep(0.0 + sideN, 0.14 + sideN, vUv.x) * smoothstep(1.0 - sideN, 0.86 - sideN, vUv.x);
        float a = (0.12 + 0.78 * wht + 0.1 * lace) * edge * uK.z;
        a *= smoothstep(0.0, 0.035, v);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
}
// a ribbon that hugs the cliff face between x0..x1 from the lip (first ground above yTop - 1) down to the pool, sampled off H
function faceRibbon(H, x0, x1, zFrom, zTo, yBot, nx, ny, push = 0.35, yCap = 1e9) {
  const pos = [], uv = [], idx = [];
  let yTop = -1e9; for (let i = 0; i <= nx; i++) { const x = x0 + (x1 - x0) * i / nx; for (let z = zFrom; z >= zTo; z -= 0.5) yTop = Math.max(yTop, Math.min(H(x, z), H(x, zFrom - 30))); }
  yTop = Math.min(yTop, H((x0 + x1) / 2, zTo), yCap);
  for (let j = 0; j <= ny; j++) { const v = j / ny, y = yTop - 0.4 + (yBot - yTop + 0.4) * v;
    for (let i = 0; i <= nx; i++) { const u = i / nx, x = x0 + (x1 - x0) * u; let z = zFrom; for (let zz = zTo; zz <= zFrom; zz += 0.25) { if (H(x, zz) < y) { z = zz; break; } }
      const bow = Math.sin(u * Math.PI) * 0.3; pos.push(x, y, z + push + bow + v * v * 1.2); uv.push(u, 1 - v); } }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return { g, yTop };
}
function pointsMat(uTime, vs, fs, additive = false) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { uTime: { value: 0 }, uPx: { value: 1 } }, vertexShader: vs, fragmentShader: fs });
}
export function waterfallFX({ H, LAKE, low, uTime }) {
  const grp = new THREE.Group(); grp.name = 'lagoon_falls_fx'; const mats = [];
  // (a) the front veil: the curtain shape pushed out 0.6-1.4 m and 8 % wider, fast white ribbons + crest foam
  const vg = waterfallGeometry({ H, LAKE, low }), P = vg.attributes.position, U = vg.attributes.uv, cx = -206;
  for (let i = 0; i < P.count; i++) { const v = 1 - U.getY(i); P.setX(i, cx + (P.getX(i) - cx) * 1.08); P.setZ(i, P.getZ(i) + 0.6 + v * 0.8); }
  vg.computeVertexNormals(); const veilM = veilMaterial(uTime, { speed: 1.15, white: 1, alpha: 0.95 }); mats.push(veilM);
  const veil = new THREE.Mesh(vg, veilM); veil.name = 'lagoon_falls_veil'; veil.renderOrder = 5; veil.frustumCulled = false; grp.add(veil);
  // (b) two thinner side cascades spilling over the notch shoulders
  let crest = -1e9; for (let i = 0; i < P.count; i++) crest = Math.max(crest, P.getY(i));
  for (const [x0, x1, sd] of [[-219.5, -216.5, 1], [-195.6, -193.2, 2]]) { const r = faceRibbon(H, x0, x1, -184, -206, LAKE.y - 0.4, low ? 4 : 8, low ? 16 : 32, 1.0, crest - 6);
    if (!(r.yTop > LAKE.y + 6)) continue; const m = veilMaterial(uTime, { speed: 0.95 + sd * 0.07, white: 0.9, alpha: 0.85 }); mats.push(m);
    const s = new THREE.Mesh(r.g, m); s.name = 'lagoon_falls_side' + sd; s.renderOrder = 5; s.frustumCulled = false; grp.add(s); }
  // (c) plunge pool: expanding splash rings + churning foam patches on the water (one disc)
  const ringM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: `varying vec2 vP;
      #include <fog_pars_vertex>
      void main(){ vP = position.xy; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; varying vec2 vP;
      #include <common>
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      void main(){ vec2 p = vP; p.y *= 1.25; float d = length(p), a = 0.0;
        for (int i = 0; i < 5; i++) { float ph = fract(uTime * 0.32 + float(i) * 0.2), r = 3.0 + ph * 13.0; float w = 0.25 + ph * 0.5;
          float wob = (vn(vec2(atan(p.y, p.x) * 3.0, float(i) * 7.0 + floor(uTime * 0.32 + float(i) * 0.2) * 3.0)) - 0.5) * 1.6;
          a += smoothstep(w, 0.0, abs(d - r - wob)) * (1.0 - ph) * 0.55; }
        float churn = smoothstep(0.45, 0.85, vn(p * 0.9 + vec2(uTime * 0.7, -uTime * 1.1))) * (1.0 - smoothstep(2.0, 8.5, d));
        float boil = (1.0 - smoothstep(0.0, 5.5, d)) * (0.55 + 0.45 * vn(p * 2.3 - uTime * 2.0));
        a = clamp(a + churn * 0.7 + boil * 0.75, 0.0, 0.92) * (1.0 - smoothstep(12.0, 16.0, d));
        gl_FragColor = vec4(vec3(0.94, 0.98, 1.0), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` }); mats.push(ringM);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(16, low ? 24 : 48), ringM); disc.rotation.x = -Math.PI / 2; disc.position.set(FALLS.x, LAKE.y + 0.09, FALLS.z + 2.5); disc.renderOrder = 6; disc.name = 'lagoon_falls_rings'; grp.add(disc);
  // (d) droplet spray: ballistic arcs out of the plunge (points)
  const NS = low ? 70 : 280, sp = new Float32Array(NS * 3), sd = new Float32Array(NS * 4);
  for (let i = 0; i < NS; i++) { const a = Math.PI * (0.05 + 0.9 * hash(i, 1)) , r = 1 + hash(i, 2) * 6; sp[i * 3] = FALLS.x + Math.cos(a) * r * (hash(i, 7) < 0.5 ? -1 : 1); sp[i * 3 + 1] = LAKE.y + 0.2; sp[i * 3 + 2] = FALLS.z + Math.sin(a) * r * 0.6;
    sd[i * 4] = hash(i, 3); sd[i * 4 + 1] = (hash(i, 4) - 0.5) * 3.0; sd[i * 4 + 2] = 2.5 + hash(i, 5) * 2.0; sd[i * 4 + 3] = 1.2 + hash(i, 6) * 2.2; }
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sgeo.setAttribute('aS', new THREE.BufferAttribute(sd, 4));
  const sprayM = pointsMat(uTime, `attribute vec4 aS; uniform float uTime; uniform float uPx; varying float vA;
      void main(){ float t = fract(uTime * 0.55 + aS.x) * 1.4; vec3 p = position; p.x += aS.y * t; p.z += (1.2 + aS.y * 0.3) * t; p.y += aS.w * 3.2 * t - 4.9 * t * t;
        vA = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.9, 1.4, t)) * step(${(LAKE.y + 0.05).toFixed(2)}, p.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = aS.z * uPx * (30.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
    `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(0.95, 0.98, 1.0, smoothstep(0.5, 0.15, d) * vA * 0.85); }`); mats.push(sprayM);
  const spray = new THREE.Points(sgeo, sprayM); spray.frustumCulled = false; spray.renderOrder = 7; spray.name = 'lagoon_falls_spray'; grp.add(spray);
  // (e) rolling mist: big soft puffs rising off the pool and drifting out over the lagoon
  const NM = low ? 26 : 110, mp = new Float32Array(NM * 3), md = new Float32Array(NM * 2);
  for (let i = 0; i < NM; i++) { mp[i * 3] = FALLS.x + (hash(i, 11) - 0.5) * 16; mp[i * 3 + 1] = LAKE.y; mp[i * 3 + 2] = FALLS.z + hash(i, 12) * 4; md[i * 2] = hash(i, 13); md[i * 2 + 1] = hash(i, 14); }
  const mgeo = new THREE.BufferGeometry(); mgeo.setAttribute('position', new THREE.BufferAttribute(mp, 3)); mgeo.setAttribute('aS', new THREE.BufferAttribute(md, 2));
  const mistM = pointsMat(uTime, `attribute vec2 aS; uniform float uTime; uniform float uPx; varying float vA; varying float vR;
      void main(){ float t = fract(uTime * 0.07 + aS.x); vec3 p = position; p.y += 0.3 + t * (7.0 + aS.y * 9.0); p.z += t * (6.0 + aS.y * 10.0); p.x += sin(t * 6.0 + aS.y * 9.0) * 1.6;
        vA = sin(t * 3.14159) * (0.16 + aS.y * 0.12); vR = aS.y;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (90.0 + 160.0 * t + 60.0 * aS.y) * uPx * (12.0 / max(1.0, -mv.z)); gl_Position = projectionMatrix * mv; }`,
    `${NOISE_GLSL} varying float vA; varying float vR; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float n = vn(c * 5.0 + vR * 17.0);
      gl_FragColor = vec4(vec3(0.9, 0.94, 0.96), smoothstep(0.5, 0.05, d) * (0.6 + 0.4 * n) * vA); }`); mats.push(mistM);
  const mist = new THREE.Points(mgeo, mistM); mist.frustumCulled = false; mist.renderOrder = 8; mist.name = 'lagoon_falls_mist'; grp.add(mist);
  // (f) a faint rainbow in the spray, facing out over the lagoon (toward the dock)
  const rbM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vP; vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
      void main(){ float r = length(vP), u = (r - 9.0) / 2.4; if (u < 0.0 || u > 1.0) discard; float ang = atan(vP.y, vP.x);
        float a = sin(u * 3.14159) * smoothstep(0.0, 0.5, ang) * smoothstep(3.14159, 2.64, ang) * smoothstep(-0.5, 3.5, vP.y) * (0.75 + 0.25 * sin(uTime * 0.6));
        gl_FragColor = vec4(hue(0.8 - u * 0.8) * a * 0.24, 1.0); }` }); mats.push(rbM);
  const rb = new THREE.Mesh(new THREE.RingGeometry(9, 11.4, low ? 32 : 64, 1, 0, Math.PI), rbM); rb.position.set(FALLS.x + 1, LAKE.y - 1.5, FALLS.z + 7); rb.rotation.y = 0.12; rb.renderOrder = 9; rb.name = 'lagoon_rainbow'; grp.add(rb);
  // (g) light shafts slanting down onto the pool (High only)
  if (!low) { const shM = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float a = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y) * smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
        a *= 0.55 + 0.45 * sin(uTime * 0.4 + vUv.x * 6.0); gl_FragColor = vec4(vec3(1.0, 0.95, 0.78) * a * 0.045, 1.0); }` }); mats.push(shM);
    for (let i = 0; i < 3; i++) for (const yaw of [0, Math.PI / 2]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(4 + i * 1.5, 30), shM);
      s.position.set(FALLS.x - 6 + i * 6, LAKE.y + 13, FALLS.z + 9 + i * 2); s.rotation.set(0, yaw + 0.3, 0.32); s.rotateX(-0.28); s.renderOrder = 9; s.name = 'lagoon_shaft'; grp.add(s); } }
  // (h) wet glossy boulders round the plunge pool (clear of the stepping stones corridor)
  return { grp, mats };
}
export function wetRocks({ STONES, LAKE, low }) {
  const k = []; const pal = [0x5d646b, 0x6b7177, 0x51585f];
  const geo = [], N = low ? 9 : 18;
  for (let i = 0; i < N * 3 && geo.length < N; i++) {
    const side = i % 2 ? 1 : -1, a = Math.PI * (0.5 + side * (0.12 + hash(i, 31) * 0.38)), r = 6 + hash(i, 32) * 9;
    const x = FALLS.x + Math.cos(a) * r * 1.15, z = FALLS.z - 2 + Math.abs(Math.sin(a)) * r * 0.55, s = 0.8 + hash(i, 33) * 1.4;
    if (Math.abs(x - FALLS.x) < 4.2 || STONES.some(st => Math.hypot(x - st.x, z - st.z) < st.r + s + 0.6)) continue;
    const g = jitter(new THREE.IcosahedronGeometry(s, 1), 0.2, i); g.scale(1.2, 0.7, 1); g.translate(x, LAKE.y + s * 0.18, z);
    const n = g.attributes.position.count, cA = new Float32Array(n * 3); g.computeVertexNormals(); const Nn = g.attributes.normal;
    for (let v = 0; v < n; v++) { _col.set(pal[i % 3]); if (Nn.getY(v) > 0.6 && hash(v, i) > 0.25) _col.set(0x5f9a40); cA.set([_col.r, _col.g, _col.b], v * 3); }
    g.setAttribute('color', new THREE.BufferAttribute(cA, 3)); geo.push(g.index ? g.toNonIndexed() : g);
  }
  if (!geo.length) return null;
  const merged = new THREE.BufferGeometry(); let tot = 0; for (const g of geo) tot += g.attributes.position.count;
  const pp = new Float32Array(tot * 3), cc = new Float32Array(tot * 3); let o = 0; for (const g of geo) { pp.set(g.attributes.position.array, o * 3); cc.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  merged.setAttribute('position', new THREE.BufferAttribute(pp, 3)); merged.setAttribute('color', new THREE.BufferAttribute(cc, 3)); merged.computeVertexNormals();
  const m = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.16, metalness: 0.08, flatShading: true }));
  m.name = 'lagoon_wet_rocks'; ART_STATS.wetRocks = geo.length; return m;
}

// ---------------------------------------------------------------- 3 + 4. PATH + FISHING ----------------------------------------------------------------
function signTexture() {
  try { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d'); if (!g) return null;
    g.fillStyle = '#7a4a26'; g.fillRect(0, 0, 512, 128); for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,220,170,0.08)'; g.fillRect(0, i * 22, 512, 11); }
    g.strokeStyle = '#3b2414'; g.lineWidth = 10; g.strokeRect(5, 5, 502, 118);
    g.fillStyle = '#ffe2a0'; g.font = 'bold 62px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowOffsetY = 3; g.fillText("GILL'S LAGOON", 256, 68);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; } catch { return null; }
}
export function dockDressing({ k, DOCK, DOCK_Y, LAKE, H }) {
  const zc = (DOCK.z0 + DOCK.z1) / 2, X = DOCK.x, hw = DOCK.hw, lanterns = [];
  // gateway over the dock root: two posts on the rail line, a crossbeam, knee braces, hanging lanterns (the sign board is a textured mesh)
  const gz = DOCK.z0 - 0.35, gy = DOCK_Y;
  for (const s of [-1, 1]) { W(k, box(0.26, 3.9, 0.26), C.WOOD_D, M(X + s * (hw + 0.2), gy + 1.95 - 0.3, gz)); W(k, box(0.42, 0.3, 0.42), C.STONE_D, M(X + s * (hw + 0.2), gy + 0.05, gz));
    W(k, box(0.12, 0.9, 0.12), C.WOOD_D, M(X + s * (hw - 0.25), gy + 3.05, gz, 0, 0, s * 0.75), false);
    W(k, cyl(0.02, 0.02, 0.4, 3), C.IRON, M(X + s * (hw + 0.85), gy + 3.25, gz), false); lanterns.push([X + s * (hw + 0.85), gy + 2.85, gz]); }
  W(k, box(hw * 2 + 2.2, 0.26, 0.3), C.WOOD_D, M(X, gy + 3.5, gz)); W(k, box(hw * 2 + 1.6, 0.12, 0.36), C.WOOD, M(X, gy + 3.7, gz), false);
  for (const s of [-1, 1]) W(k, cyl(0.015, 0.015, 0.5, 3), C.IRON, M(X + s * 1.0, gy + 3.15, gz), false);
  // rail-post lanterns (every other post, alternating sides) + mooring rope swags along the rails
  let n = 0; for (let z = DOCK.z0 - 2; z >= DOCK.z1 + 3; z -= 4) { const s = n % 2 ? 1 : -1; n++; if (n % 2 === 0 && z > DOCK.z1 + 6) continue;
    const x = X + s * (hw + 0.05); W(k, box(0.08, 0.08, 0.5), C.IRON, M(x + s * 0.2, DOCK_Y + 1.05, z, 0, 0, 0, [1, 1, 1]), false); W(k, box(0.08, 0.5, 0.08), C.WOOD_D, M(x, DOCK_Y + 1.1, z), false);
    lanterns.push([x + s * 0.4, DOCK_Y + 0.82, z]); }
  // end-of-dock tackle station (west side + the end rail; the east end stays clear for the swim ladder at z1 + 0.6)
  const ez = DOCK.z1 + 1.0, wx = X - hw + 0.35;
  W(k, cyl(0.24, 0.2, 0.42, 9), 0x8a8f96, M(wx, DOCK_Y + 0.21, ez + 1.4)); W(k, cyl(0.25, 0.25, 0.04, 9), 0x5a5f66, M(wx, DOCK_Y + 0.42, ez + 1.4), false);       // bait bucket
  W(k, cyl(0.2, 0.2, 0.05, 9), 0x6b4a2a, M(wx, DOCK_Y + 0.4, ez + 1.4), false); for (let i = 0; i < 4; i++) W(k, cyl(0.02, 0.02, 0.22, 3), 0xd27a7a, M(wx + (hash(i, 1) - 0.5) * 0.2, DOCK_Y + 0.45, ez + 1.4 + (hash(i, 2) - 0.5) * 0.2, i, 1.2), false);
  W(k, box(0.6, 0.3, 0.36), 0x2f6b4a, M(wx + 0.05, DOCK_Y + 0.15, ez + 2.4)); W(k, box(0.62, 0.06, 0.38), 0x24543a, M(wx + 0.05, DOCK_Y + 0.33, ez + 2.4), false); W(k, box(0.3, 0.04, 0.04), C.IRON, M(wx + 0.05, DOCK_Y + 0.42, ez + 2.4), false); // tackle box
  W(k, cyl(0.2, 0.2, 0.06, 8), C.WOOD_L, M(wx + 0.1, DOCK_Y + 0.5, ez + 3.6)); for (let i = 0; i < 3; i++) W(k, cyl(0.03, 0.03, 0.5, 4), C.WOOD_D, M(wx + 0.1 + Math.cos(i * 2.1) * 0.13, DOCK_Y + 0.24, ez + 3.6 + Math.sin(i * 2.1) * 0.13), false); // stool
  for (let i = 0; i < 3; i++) W(k, cyl(0.018, 0.03, 2.8, 4), i === 1 ? 0x3a2a1a : C.WOOD_L, M(X - 0.6 + i * 0.6, DOCK_Y + 1.25, DOCK.z1 - 0.1, 0, -0.5, (i - 1) * 0.15), false);   // rods in holders off the end rail
  for (let i = 0; i < 3; i++) W(k, cyl(0.05, 0.05, 0.3, 6), C.IRON, M(X - 0.6 + i * 0.6, DOCK_Y + 0.25, DOCK.z1 + 0.25), false);
  W(k, new THREE.TorusGeometry(0.34, 0.09, 6, 14), (p) => (Math.atan2(p.y, p.x) * 2 / Math.PI + 4) % 1 < 0.5 ? 0xd8322f : 0xf4efe6, M(X - hw - 0.12, DOCK_Y + 0.55, ez + 6.5, Math.PI / 2), false); // life ring
  W(k, cyl(0.3, 0.3, 0.16, 10), 0xc9a26a, M(wx, DOCK_Y + 0.08, ez + 5.0), false); W(k, new THREE.TorusGeometry(0.22, 0.06, 5, 12), 0xb08a52, M(wx, DOCK_Y + 0.18, ez + 5.0, 0, Math.PI / 2), false); // rope coil
  W(k, cyl(0.26, 0.2, 0.42, 9), 0xb98a4a, M(wx + 0.05, DOCK_Y + 0.21, ez + 7.4)); W(k, cyl(0.0, 0.12, 0.3, 3), 0x6f9a3a, M(wx + 0.05, DOCK_Y + 0.5, ez + 7.4, 0, 0, 0.5, [1, 1, 0.2]), false); // fish basket + a tail
  // a drying net draped over the west rail
  W(k, box(0.04, 0.7, 2.6), 0x8fa38a, M(X - hw - 0.12, DOCK_Y + 0.5, zc - 6), false); for (let i = 0; i < 5; i++) W(k, ball(0.07, 5, 3), 0xff9a2a, M(X - hw - 0.14, DOCK_Y + 0.82, zc - 7.2 + i * 0.6), false);
  // buoys bobbing off the dock (static), and pilings caps
  for (const [dx, dz, c] of [[-4.5, -6, 0xd8322f], [4.8, -12, 0xffc93c], [-5.2, -20, 0xf4efe6]]) W(k, ball(0.3, 8, 5), c, M(X + dx, LAKE.y + 0.12, zc + dz));
  return lanterns;
}
export function pathDressing({ k, H, low, pts, F, DOCK }) {
  // flower borders + low shrubs just outside the kerbs of the lagoon approach (both sides), easing off at the dock root
  const out = { flowers: [], shrubs: [] }; const _q = new THREE.Quaternion();
  const L = []; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], d = Math.hypot(bx - ax, bz - az); for (let s = 0; s < d; s += low ? 2.4 : 1.3) L.push([ax + (bx - ax) * s / d, az + (bz - az) * s / d, (bx - ax) / d, (bz - az) / d]); }
  L.forEach(([x, z, tx, tz], i) => { for (const side of [-1, 1]) { const off = 4.3 + hash(i, side + 5) * 1.2, px = x - tz * off * side, pz = z + tx * off * side, y = H(px, pz);
    if (Math.hypot(px - DOCK.x, pz - DOCK.z0) < 6 || !isFinite(y) || y < 20.6) continue; if (F?.areaDeckAt && F.areaDeckAt(px, pz) != null) continue;
    const r = hash(i, side + 9), s = 0.75 + hash(i, side + 11) * 0.5; const m = new THREE.Matrix4().compose(new THREE.Vector3(px, y - 0.05, pz), _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * 6.28).clone(), new THREE.Vector3(s, s, s));
    (r < 0.72 ? out.flowers : out.shrubs).push(m); } });
  return out;
}
// water ripples round the dock posts + slow rings drifting through the pads (one quad over the dock)
export function rippleSheet({ DOCK, LAKE, low }) {
  const zc = (DOCK.z0 + DOCK.z1) / 2, L = Math.abs(DOCK.z1 - DOCK.z0) + 18, posts = [];
  for (let z = DOCK.z0 - 2; z >= DOCK.z1; z -= 4) for (const s of [-1, 1]) posts.push(new THREE.Vector2(DOCK.x + s * (DOCK.hw + 0.05), z));
  while (posts.length < 20) posts.push(new THREE.Vector2(1e4, 1e4));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: true, uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 }, uP: { value: posts.slice(0, 20) } }]),
    vertexShader: `varying vec2 vW;
      #include <fog_pars_vertex>
      void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec2 uP[20]; varying vec2 vW;
      #include <common>
      #include <fog_pars_fragment>
      void main(){ float a = 0.0;
        for (int i = 0; i < 20; i++) { float d = distance(vW, uP[i]); if (d > 3.2) continue; float w = fract(d * 0.9 - uTime * 0.55);
          a += smoothstep(0.12, 0.0, abs(w - 0.5) - 0.02) * smoothstep(3.2, 0.4, d) * 0.35; }
        for (int i = 0; i < 3; i++) { float fi = float(i); float ph = fract(uTime * 0.13 + fi * 0.37); vec2 c = vec2(${DOCK.x.toFixed(1)} + sin(fi * 2.7 + floor(uTime * 0.13 + fi * 0.37) * 1.9) * 7.0, ${zc.toFixed(1)} + cos(fi * 1.9 + floor(uTime * 0.13 + fi * 0.37) * 2.3) * 18.0);
          float d = distance(vW, c), r = ph * 3.5; a += smoothstep(0.18, 0.0, abs(d - r)) * (1.0 - ph) * 0.5; }
        gl_FragColor = vec4(vec3(0.92, 0.97, 1.0), clamp(a, 0.0, 0.6));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }` });
  const g = new THREE.PlaneGeometry(22, L); const mesh = new THREE.Mesh(g, m); mesh.rotation.x = -Math.PI / 2; mesh.position.set(DOCK.x, LAKE.y + 0.07, zc - 4); mesh.renderOrder = 4; mesh.name = 'lagoon_ripples';
  return { mesh, mat: m };
}
// lantern glow halos (one Points cloud, flickering)
export function lanternGlow(list, low) {
  const p = new Float32Array(list.length * 3), s = new Float32Array(list.length); list.forEach((q, i) => { p.set(q, i * 3); s[i] = hash(i, 71); });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const m = pointsMat(null, `attribute float aS; uniform float uTime; uniform float uPx; varying float vF; void main(){ vF = 0.8 + 0.2 * sin(uTime * (7.0 + aS * 5.0) + aS * 30.0) * sin(uTime * 3.1 + aS * 9.0);
      vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = ${low ? '90.0' : '130.0'} * uPx / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
    `varying float vF; void main(){ float d = length(gl_PointCoord - 0.5); float core = smoothstep(0.12, 0.0, d), halo = smoothstep(0.5, 0.0, d);
      gl_FragColor = vec4(vec3(1.0, 0.78, 0.38) * (halo * 0.45 + core) * vF, 1.0); }`, true);
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = 9; pts.name = 'lagoon_lantern_glow'; return { pts, mat: m };
}
export { signTexture };

// ---------------------------------------------------------------- the one hook lagoon.js calls ----------------------------------------------------------------
// ctx: { MATS, OUT, low, H, near, far, LAKE, DOCK, DOCK_Y, GROTTO, STONES, PATH, avoid, lanterns } -> { tick(t) }
export function buildLagoonArt(ctx) {
  const { MATS, OUT, low, H, near, far, LAKE, DOCK, DOCK_Y, GROTTO, STONES, PATH, lanterns = [] } = ctx; const mats = [], t0 = performance.now(); let dead = false, F = null, skin = null, rev = -1;
  const px = () => { try { return Math.min(2, window.devicePixelRatio || 1); } catch { return 1; } };
  // waterfall layers (near) + the veil also in the far set so the falls read from across the island
  const fx = waterfallFX({ H, LAKE, low }); near.add(fx.grp); mats.push(...fx.mats);
  const vf = fx.grp.getObjectByName('lagoon_falls_veil'); if (vf && far) { const v2 = new THREE.Mesh(vf.geometry, vf.material); v2.renderOrder = 5; v2.frustumCulled = false; v2.name = 'lagoon_falls_veil_far'; far.add(v2); }
  const rocks = wetRocks({ STONES, LAKE, low }); if (rocks) near.add(rocks);
  // fishing: ripples, lantern glow, the gateway sign, notched lily pads + lotus flowers
  const rp = rippleSheet({ DOCK, LAKE, low }); near.add(rp.mesh); mats.push(rp.mat);
  if (lanterns.length) { const lg = lanternGlow(lanterns, low); near.add(lg.pts); mats.push(lg.mat); }
  const tex = signTexture(); { const gz = DOCK.z0 - 0.35, mat = tex ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshLambertMaterial({ color: 0x7a4a26 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x6b4527 }); const sg = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.72, 0.1), [wood, wood, wood, wood, mat, mat]); sg.position.set(DOCK.x, DOCK_Y + 2.72, gz); sg.name = 'lagoon_gate_sign';
    near.add(sg); }
  { const pads = [], lotus = []; const _q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), castX = DOCK.x, castZ = DOCK.z1 - 7;
    const clusters = [[-232, -88], [-178, -92], [-248, -120], [-160, -130], [-226, -160], [-185, -165], [-196, -78], [-216, -104], [-170, -108], [-240, -140]];
    clusters.forEach(([cx, cz], ci) => { const n = low ? 5 : 11; for (let i = 0; i < n; i++) { const a = hash(ci, i) * 6.28, r = Math.sqrt(hash(i, ci + 3)) * 5.5, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) > LAKE.r - 4 || Math.hypot(x - castX, z - castZ) < 7 || (Math.abs(x - DOCK.x) < 3.5 && z > DOCK.z1 - 2 && z < DOCK.z0) || STONES.some(s => Math.hypot(x - s.x, z - s.z) < 2.4) || Math.hypot(x - FALLS.x, z - FALLS.z) < 16) continue;
      const s = 0.6 + hash(i, ci + 7) * 0.9; pads.push(new THREE.Matrix4().compose(new THREE.Vector3(x, LAKE.y + 0.06 + (i % 3) * 0.004, z), _q.setFromAxisAngle(up, hash(ci + 2, i) * 6.28).clone(), new THREE.Vector3(s, 1, s)));
      if (hash(i, ci + 11) < 0.28) lotus.push(new THREE.Matrix4().compose(new THREE.Vector3(x + 0.1 * s, LAKE.y + 0.1, z), _q.setFromAxisAngle(up, a).clone(), new THREE.Vector3(s * 0.9, s * 0.9, s * 0.9))); } });
    const padGeo = () => { const g = new THREE.CircleGeometry(0.62, 12, 0.35, Math.PI * 2 - 0.55); g.rotateX(-Math.PI / 2); return g; };
    near.add(instanced(MATS, OUT, (q) => { W(q, padGeo(), (p) => Math.hypot(p.x, p.z) < 0.18 ? 0x6fbf4a : 0x3f9a3a, M(0, 0, 0), false); W(q, cyl(0.62, 0.6, 0.03, 12), 0x2f7a30, M(0, -0.02, 0), false); }, pads, 'lagoon_pads2'));
    near.add(instanced(MATS, OUT, (q) => { for (let j = 0; j < 7; j++) { const a = j / 7 * 6.28; W(q, cyl(0, 0.09, 0.28, 3), j % 2 ? 0xffd0ea : 0xffffff, M(Math.cos(a) * 0.1, 0.11, Math.sin(a) * 0.1, -a, 0, 0.6, [1, 1, 0.35]), false); }
      W(q, ball(0.06, 6, 4), 0xffd23a, M(0, 0.12, 0), false); }, lotus, 'lagoon_lotus'));
    ART_STATS.pads = pads.length; ART_STATS.lotus = lotus.length; }
  // path borders (flowers + shrubs, instanced)
  const buildPath = () => { const d = pathDressing({ k: null, H, low, pts: PATH, F, DOCK });
    near.add(instanced(MATS, OUT, (q) => { for (let j = 0; j < 6; j++) { const a = j * 1.05, r = 0.15 + (j % 3) * 0.12; W(q, cyl(0.015, 0.02, 0.45, 3), 0x4a8a34, M(Math.cos(a) * r, 0.22, Math.sin(a) * r), false);
      W(q, ball(0.1, 5, 3), [0xffe066, 0xff8ad8, 0xffffff, 0xff6b4a, 0xb98cff, 0xffe066][j], M(Math.cos(a) * r, 0.47, Math.sin(a) * r), false); } W(q, ball(0.32, 6, 4), 0x4f9a3c, M(0, 0.08, 0, 0, 0, 0, [1.4, 0.5, 1.4]), false); }, d.flowers, 'lagoon_path_flowers'));
    near.add(instanced(MATS, OUT, (q) => { W(q, ball(0.34, 7, 5), 0x3f8f3a, M(0, 0.22, 0)); W(q, ball(0.26, 6, 4), 0x5cae48, M(0.26, 0.2, 0.12)); W(q, ball(0.22, 6, 4), 0x2f7a34, M(-0.22, 0.16, -0.12)); for (let j = 0; j < 3; j++) W(q, ball(0.06, 4, 3), 0xff6b8a, M(Math.cos(j * 2.1) * 0.28, 0.42, Math.sin(j * 2.1) * 0.28), false); }, d.shrubs, 'lagoon_path_shrubs'));
    ART_STATS.pathFlowers = d.flowers.length + d.shrubs.length; };
  // the hill skin + dressing need foot.js (trails / decks / exact triangles): already loaded in the game, so this resolves next tick
  const buildHill = () => { if (dead || !F) return; const ts = performance.now();
    if (skin) { for (const g of [near, far]) for (const o of [...g.children]) if (o.userData.lagoonHill) { g.remove(o); o.traverse(c => { if (c.isMesh && c.name !== 'lagoon_strata_far') c.geometry?.dispose(); }); } }
    const S = strataSkin({ F, H: F.H || H, LAKE, low, GROTTO }); const m = skinMesh(S.g, MATS); m.userData.lagoonHill = true; near.add(m);
    if (far) { const m2 = new THREE.Mesh(S.g, MATS.toon); m2.name = 'lagoon_strata_far'; m2.userData.lagoonHill = true; far.add(m2); }
    const dr = hillDressing({ S, F, H: F.H || H, LAKE, low, MATS, OUT }); dr.userData.lagoonHill = true; near.add(dr); skin = S; rev = F.TERRAIN ? F.TERRAIN.rev : 0;
    ART_STATS.hillMs = Math.round(performance.now() - ts); };
  try { import('../foot.js').then(m => { F = m; buildPath(); buildHill(); }).catch(e => { console.warn('[lagoon-art] hill', e); try { buildPath(); } catch { } }); } catch (e) { console.warn('[lagoon-art]', e); }
  ART_STATS.buildMs = Math.round(performance.now() - t0);
  let tEdit = 0;
  return { stats: ART_STATS, dispose() { dead = true; },
    tick(t) { const p = px(); for (const m of mats) { m.uniforms.uTime.value = t; if (m.uniforms.uPx) m.uniforms.uPx.value = p; }
      if (F?.TERRAIN && skin && F.TERRAIN.rev !== rev) { if (!tEdit) tEdit = t + 2.5; else if (t > tEdit) { tEdit = 0; rev = F.TERRAIN.rev; buildHill(); } } } };
}
