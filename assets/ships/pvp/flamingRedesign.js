// [Raul] FLAMING SHIP (2500 kills): full PvP redesign, a drop-in look for Timothy's FLAMING skin.
// Obsidian hull with glowing lava seams + waterline heat glow, a raked ram bow, horned high stern and a spiked gunwale;
// live animated flames licking up off the gunwales, bow and stern (they lean aft with the ship's speed); burning sails;
// rising embers + sparks; a fiery wake. Warm red / orange / gold only, never icy (can't be confused with DIAMOND).
// Uses the parts-override API (./partsOverride.js): hitbox untouched (len/beam/depth restored), stats untouched, solo
// ships never change (PvP builds only). Watertight: closed lofted shell (transom + stem caps), opaque DoubleSide walls,
// base deck + the game's depth-only water lid ride up with the hull (liftRig).
// Draw calls vs. the base ship: -2 (base hull + outline) +2 (lava hull + outline) +2 spikes (+outline) +1 flames +1 embers
// +1 wake = net +5 high; low: no spike outline, 20 flames, 16 embers -> net +4. All materials shared; only the speed
// uniform is per ship. Every ship (local or remote) animates on the shared wind clock and its own speed.
// Integration (Emerly, js/pvpSkins.js), after `import { FLAMING, flamingTick } ...`:
//   import { FLAMING_REDESIGN, flamingRedesignTick } from '../assets/ships/pvp/flamingRedesign.js';
//   Object.assign(FLAMING, FLAMING_REDESIGN);              // materialFx + partsOverride (+ tick)
//   SHIP_TICKS: replace flamingTick with flamingRedesignTick
import { THREE, toon, outlineFor, place, merge, loftHull, injectShine, fxOf, hash, wind, liftRig, signatureWake, sealGeometry } from './pvpKit.js';

export const FLAMING_KILLS = 2500; // tier lives in config.js 'flaming'; mirrored here for the harness skin only

const NOISE = `float fzH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float fzN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fzH(i), fzH(i + vec3(1,0,0)), f.x), mix(fzH(i + vec3(0,1,0)), fzH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fzH(i + vec3(0,0,1)), fzH(i + vec3(1,0,1)), f.x), mix(fzH(i + vec3(0,1,1)), fzH(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
// object-space position for anything that must ride with the ship (seams, sail fire)
const uFzTall = { value: 0 }; // [Timothy v2] 1 on the new hull (taller sail fire); same program either way
function objSpace(m, key, frag, head = '') {
  injectShine(m, frag, {}, key);
  head += '\nuniform float uFzTall;';
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (s, r) => { prev.call(m, s, r);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFzP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFzP = position;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vFzP;\n' + NOISE + head); s.uniforms.uFzTall = uFzTall; };
  return m;
}
// obsidian + lava: dark glassy planks, ridged-noise seams that pulse along the hull, heat glow at the waterline
const LAVA = (k) => `{ float n = fzN(vFzP * 0.7), r = 1.0 - abs(n * 2.0 - 1.0);
  float seam = smoothstep(0.93, 0.99, r) * smoothstep(0.35, 0.65, fzN(vFzP * 1.9 + 5.0));
  float pulse = 0.6 + 0.4 * sin(uKT * 2.2 + vFzP.z * 0.5 + vFzP.y * 1.3);
  vec3 lava = mix(vec3(1.0, 0.16, 0.02), vec3(1.0, 0.72, 0.2), seam * pulse);
  float heat = smoothstep(1.6, -0.6, vFzP.y) * (0.55 + 0.45 * sin(uKT * 3.1 + vFzP.z * 0.8));
  diffuseColor.rgb *= 1.0 - seam * 0.6;
  totalEmissiveRadiance = lava * seam * pulse * ${k} + vec3(1.0, 0.3, 0.04) * heat * ${k} * 0.22
    + vec3(0.9, 0.45, 0.25) * pow(max(dot(Rw, normalize(vec3(0.4, 0.8, 0.45))), 0.0), 30.0) * 0.12 + vec3(1.0, 0.35, 0.05) * fres * 0.35; }`;
// burning sails: fire climbing from the foot in rising noise tongues, charred cloth, glowing burnt-through holes
const SAIL = `#ifdef USE_MAP
{ vec2 u = vMapUv; float n = fzN(vec3(u.x * 5.0, u.y * 4.0 - uKT * 1.4, uKT * 0.35)) * 0.65 + fzN(vec3(u.x * 11.0, u.y * 9.0 - uKT * 2.6, 3.0)) * 0.35;
  float fire = smoothstep(0.42, 0.85, n + (1.0 - u.y) * 0.6 - 0.45 + uFzTall * (0.16 - u.y * 0.1)); // [Timothy v2] uFzTall: fire licks most of the way up the cloth
  float hole = fzN(vec3(u * 6.0, 9.0)); if (hole > 0.8 && u.y < 0.9) discard;
  float rim = smoothstep(0.7 + uFzTall * 0.06, 0.8, hole);
  diffuseColor.rgb = mix(diffuseColor.rgb * 0.18, vec3(0.25, 0.04, 0.01), 0.5) * (1.0 - fire * 0.6);
  vec3 fc = mix(vec3(0.9, 0.12, 0.02), vec3(1.0, 0.62, 0.12), fire); fc = mix(fc, vec3(1.0, 0.92, 0.55), smoothstep(0.8, 1.0, fire) * (1.0 - uFzTall * 0.8));
  fc *= 1.0 - uFzTall * 0.3; // [Timothy v2] orange tongues on charred cloth, not a white sheet
  totalEmissiveRadiance = fc * fire * (0.75 + 0.25 * sin(uKT * 11.0 + u.x * 30.0)) * 0.9 + vec3(1.0, 0.4, 0.05) * rim * (1.1 - uFzTall * 0.35); }
#endif`;
const _fx = new Map();
export function flamingRedesignMaterialFx(m) {
  if (!m?.isMeshToonMaterial || m.userData.fzDone) return m;
  if (_fx.has(m)) return _fx.get(m);
  const sail = m.customProgramCacheKey?.().startsWith('sail');
  const n = m.clone(); n.onBeforeCompile = m.onBeforeCompile; n.customProgramCacheKey = m.customProgramCacheKey;
  if (sail) { n.color.set(0xffffff); n.alphaTest = 0; objSpace(n, 'fz-sail', SAIL); }
  else { n.color.multiplyScalar(0.22).lerp(new THREE.Color(0x1a0d0a), 0.5); if (n.emissive) n.emissive.set(0); objSpace(n, 'fz-char', LAVA('0.9')); }
  n.userData.fzDone = true; _fx.set(m, n); return n;
}

// ---------- reshaped hull: high flared gunwale, raked ram bow, towering horned stern, spiked rail ----------
const _geo = new Map();
function geos(ud, low) {
  const { len, beam, layout } = ud, { shape, deckDrop } = layout, key = [len, beam].map(v => v.toFixed(2)).join('|') + low;
  if (_geo.has(key)) return _geo.get(key);
  const zAt = (t) => (t - 0.5) * len;
  const sheer = (t) => 0.55 + (t < 0.24 ? 3.0 * Math.pow(1 - t / 0.24, 0.8) : 0) + (t > 0.8 ? 1.9 * Math.pow((t - 0.8) / 0.2, 1.4) : 0);
  const top = (t) => shape.top(t) + sheer(t);
  const ring = (t) => { const w = shape.halfW(t) * 1.04, yt = top(t), yk = shape.keel(t) - 0.15, h = yt - yk;
    return [[w * 1.06, yt], [w * 1.12, yt - h * 0.18], [w * 1.0, yt - h * 0.5], [w * 0.62, yt - h * 0.85], [0, yk]]; };
  const hull = merge([loftHull(len, ring, low ? 12 : 20, 0.02, 0.995), sealGeometry(ud, ring)]); // [Raul] closed interior
  const sp = [];
  // ram: a long iron-black blade off the stem, plus two side tusks
  const bt = 0.985, by = shape.top(bt) + 0.6;
  sp.push(place(new THREE.ConeGeometry(0.45, len * 0.24, 6), [0, by, zAt(bt) + len * 0.1], [Math.PI / 2 - 0.12, 0, 0]));
  for (const sx of [1, -1]) sp.push(place(new THREE.ConeGeometry(0.24, len * 0.12, 5), [sx * 0.6, by - 0.8, zAt(0.95) + len * 0.05], [Math.PI / 2 + 0.25, 0, -sx * 0.35]));
  // stern: two curved horns rising off the quarter towers
  for (const sx of [1, -1]) { const w = shape.halfW(0.06), y0 = top(0.06), z0 = zAt(0.06);
    sp.push(place(new THREE.ConeGeometry(0.42, 3.4, 6), [sx * w * 0.9, y0 + 1.5, z0 - 0.3], [-0.45, 0, -sx * 0.4]));
    sp.push(place(new THREE.ConeGeometry(0.22, 1.6, 5), [sx * w * 1.1, y0 + 3.0, z0 - 1.1], [-1.1, 0, -sx * 0.6])); }
  // gunwale spikes, angled out and up
  const nS = low ? 6 : 10;
  for (const sx of [1, -1]) for (let i = 0; i < nS; i++) { const t = 0.16 + i / (nS - 1) * 0.66, q = ring(t)[0];
    sp.push(place(new THREE.ConeGeometry(0.16, 1.1 + hash(i + sx * 9) * 0.5, 5), [sx * (q[0] + 0.05), q[1] + 0.35, zAt(t)], [0, 0, -sx * 0.55])); }
  // flame anchors: along both gunwales, the stern rail, the bow and the waterline quarters
  const nF = low ? 24 : 72, A = [], C = [], S = [];
  const push = (x, y, z, sz, i) => { for (const c of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { A.push(x, y, z); C.push(...c); S.push(hash(i * 3.1), sz, hash(i * 7.7)); } };
  for (let i = 0; i < nF; i++) { const u = i / nF;
    if (u < 0.72) { const sx = i % 2 ? 1 : -1, t = 0.06 + hash(i + 1) * 0.9, q = ring(t)[0]; push(sx * q[0] * 1.02, q[1] - 0.1, zAt(t), 1.3 + hash(i + 2) * 1.6, i); }
    else if (u < 0.88) { const t = 0.03 + hash(i) * 0.06, w = shape.halfW(t); push((hash(i + 4) * 2 - 1) * w, top(t) + 0.2, zAt(t), 2.0 + hash(i + 5) * 1.6, i); }
    else { const t = 0.93 + hash(i) * 0.06; push((hash(i + 6) * 2 - 1) * 0.7, top(t), zAt(t), 1.4 + hash(i + 3), i); } }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(A, 3)); fg.setAttribute('corner', new THREE.Float32BufferAttribute(C, 2)); fg.setAttribute('seed', new THREE.Float32BufferAttribute(S, 3));
  const idx = []; for (let i = 0; i < nF; i++) { const a = i * 4; idx.push(a, a + 1, a + 2, a, a + 2, a + 3); } fg.setIndex(idx); fg.computeBoundingSphere(); fg.boundingSphere.radius += 6;
  const out = { hull, spikes: merge(sp), flames: fg, deckY: shape.top(0.5) - deckDrop }; _geo.set(key, out); return out;
}

// ---------- live flames: noise-shaped billboard tongues, additive, leaning aft with this ship's speed ----------
const _flameMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uSpeed: { value: 0 }, uK: { value: 0.8 } },
  vertexShader: `attribute vec2 corner; attribute vec3 seed; uniform float uT; uniform float uSpeed; varying vec2 vQ; varying float vS;
    void main(){ float up = corner.y * 0.5 + 0.5; float h = seed.y * (0.8 + 0.35 * sin(uT * (3.0 + seed.z * 3.0) + seed.x * 20.0)) * (1.0 + uSpeed * 0.35);
      vec3 p = position; p.y += up * h; p.z -= up * up * h * (0.25 + uSpeed * 0.9); p.x += sin(uT * 2.0 + seed.x * 30.0) * 0.15 * up;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); mv.x += corner.x * h * 0.38 * (1.0 - up * 0.25);
      vQ = vec2(corner.x * 0.5 + 0.5, up); vS = seed.x; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uT; uniform float uK; varying vec2 vQ; varying float vS; ${NOISE}
    void main(){ float n = fzN(vec3(vQ.x * 3.0, vQ.y * 3.0 - uT * 3.2, vS * 13.0)), n2 = fzN(vec3(vQ.x * 7.0, vQ.y * 6.0 - uT * 5.5, vS * 7.0 + 3.0));
      float x = abs(vQ.x - 0.5 + (n - 0.5) * 0.5 * vQ.y) * 2.0, y = vQ.y;
      float w = mix(0.95, 0.15, pow(y, 0.8)) * (0.8 + 0.4 * n);
      float a = pow(clamp(1.0 - x / w, 0.0, 1.0), 1.3) * smoothstep(0.0, 0.08, y);
      a *= smoothstep(0.2, 0.55, n2 * 0.7 + (1.0 - y) * 0.75); // tongues break up into licks near the tip
      if (a < 0.02) discard;
      vec3 c = mix(vec3(1.0, 0.78, 0.3), vec3(1.0, 0.36, 0.03), smoothstep(0.0, 0.35, y + x * 0.4));
      c = mix(c, vec3(0.75, 0.06, 0.01), smoothstep(0.4, 0.9, y));
      a *= 0.85;
      gl_FragColor = vec4(c * a * uK, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
// ---------- embers + sparks rising off the deck, swept aft by speed ----------
const _emberMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uSpeed: { value: 0 }, uBox: { value: new THREE.Vector3() } },
  vertexShader: `attribute vec3 seed; uniform float uT; uniform float uSpeed; uniform vec3 uBox; varying float vA; varying float vL;
    void main(){ float life = fract(uT * (0.18 + seed.z * 0.22) + seed.x);
      vec3 p = vec3((seed.y - 0.5) * uBox.x + sin(uT * 1.7 + seed.x * 40.0) * life * 1.2, uBox.z + life * (7.0 + seed.z * 6.0), (fract(seed.x * 7.3) - 0.5) * uBox.y - life * life * uSpeed * 9.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vA = sin(life * 3.14159) * (0.6 + 0.4 * sin(uT * 13.0 + seed.y * 70.0)); vL = life;
      gl_PointSize = (0.4 + seed.z * 0.7) * (1.0 - life * 0.6) * 420.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; varying float vL; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; if (a < 0.02) discard;
      gl_FragColor = vec4(mix(vec3(1.0, 0.85, 0.4), vec3(1.0, 0.2, 0.02), vL) * a * 1.4, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
// ---------- [Timothy v2] the new hull (ud.art): flames rise off the real rails / castles / waist, layered fire with a smoke crown ----------
// One quad per tongue, premultiplied blending: the hot core -> orange -> red part adds light (alpha ~0), the crown darkens into
// smoke (alpha up). Flicker + licks from noise, leans aft and stretches with speed. Phone Low: 30 tongues, 40 embers (cap).
const FIRE_V = `attribute vec2 corner; attribute vec3 seed; uniform float uT; uniform float uSpeed; varying vec2 vQ; varying float vS;
    void main(){ float up = corner.y * 0.5 + 0.5; float h = seed.y * (0.82 + 0.3 * sin(uT * (3.0 + seed.z * 3.0) + seed.x * 20.0)) * (1.0 + uSpeed * 0.55);
      vec3 p = position; p.y += up * h; p.z -= up * up * h * (0.2 + uSpeed * 1.25); p.x += sin(uT * 2.0 + seed.x * 30.0) * 0.18 * up;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); mv.x += corner.x * h * 0.34 * (1.0 - up * 0.2);
      vQ = vec2(corner.x * 0.5 + 0.5, up); vS = seed.x; gl_Position = projectionMatrix * mv; }`;
const _fireMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime, uSpeed: { value: 0 }, uK: { value: 1.0 } },
  vertexShader: FIRE_V,
  fragmentShader: `uniform float uT; uniform float uK; varying vec2 vQ; varying float vS; ${NOISE}
    void main(){ float n = fzN(vec3(vQ.x * 3.0, vQ.y * 3.0 - uT * 3.4, vS * 13.0)), n2 = fzN(vec3(vQ.x * 7.0, vQ.y * 6.0 - uT * 6.0, vS * 7.0 + 3.0));
      float x = abs(vQ.x - 0.5 + (n - 0.5) * 0.55 * vQ.y) * 2.0, y = vQ.y;
      float w = mix(0.9, 0.3, pow(y, 0.7)) * (0.8 + 0.4 * n);
      float body = pow(clamp(1.0 - x / w, 0.0, 1.0), 1.2) * smoothstep(0.0, 0.06, y);
      float lick = smoothstep(0.18, 0.5, n2 * 0.7 + (1.0 - y) * 0.8);
      float fire = body * lick * (1.0 - smoothstep(0.55, 0.8, y));                  // flame: bottom 3/4
      float smoke = body * smoothstep(0.5, 0.75, y) * (1.0 - smoothstep(0.85, 1.0, y)) * (0.55 + 0.45 * n2); // dark crown
      if (fire + smoke < 0.02) discard;
      float core = (1.0 - smoothstep(0.0, 0.35, x)) * (1.0 - smoothstep(0.05, 0.4, y));
      vec3 c = mix(vec3(1.0, 0.5, 0.08), vec3(0.85, 0.12, 0.02), smoothstep(0.2, 0.6, y));
      c = mix(c, vec3(1.0, 0.95, 0.7), core);
      float flick = 0.85 + 0.15 * sin(uT * 23.0 + vS * 40.0);
      gl_FragColor = vec4(c * fire * uK * flick * 1.25 + vec3(0.05, 0.03, 0.025) * smoke, smoke * 0.55); }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
});
// burning flag: fire eating in from the fly (free edge), charred cloth, glowing edge
const FLAG = `#ifdef USE_MAP
{ vec2 u = vMapUv; float n = fzN(vec3(u.x * 6.0 - uKT * 1.1, u.y * 5.0 - uKT * 1.8, 2.0));
  float burn = smoothstep(0.3, 0.8, u.x * 0.85 + n * 0.5 - 0.05); if (burn > 0.86) discard;
  float edge = smoothstep(0.55, 0.86, burn);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.03, 0.02), burn * 0.8);
  totalEmissiveRadiance = mix(vec3(1.0, 0.3, 0.03), vec3(1.0, 0.8, 0.3), edge) * edge * (0.8 + 0.2 * sin(uKT * 13.0 + u.y * 20.0)) * 1.4; }
#endif`;
const _artGeo = new Map();
function artFlames(ud, low) {
  const { layout, art } = ud, { shape } = layout, zAt = layout.zAt, key = [ud.len, ud.beam, ud.depth].map(v => v.toFixed(2)).join('|') + low;
  if (_artGeo.has(key)) return _artGeo.get(key);
  const wall = (t, y) => Math.max(0.2, shape.halfW(t) - 0.06 * Math.max(0, y - shape.top(t)));
  const A = [], C = [], S = []; let i = 0;
  const push = (x, y, z, sz) => { for (const c of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { A.push(x, y, z); C.push(...c); S.push(hash(i * 3.1), sz, hash(i * 7.7)); } i++; };
  const nR = low ? 18 : 56, nD = low ? 4 : 12, nS = low ? 5 : 14, nB = low ? 3 : 8;
  for (let k = 0; k < nR; k++) { const sx = k % 2 ? 1 : -1, t = 0.04 + (k + hash(k) * 0.8) / nR * 0.9, y = art.railY(t); // rails, waist to castles
    push(sx * (wall(t, y) + 0.12), y - 0.05, zAt(t), 2.2 + hash(k + 2) * 2.4); }
  for (let k = 0; k < nD; k++) { const t = 0.3 + hash(k + 40) * 0.5, sx = k % 2 ? 1 : -1; // waist deck fires, against the bulwarks (clear of the gangway + helm)
    push(sx * (wall(t, shape.top(t)) - 0.7), shape.top(t) - layout.deckDrop + 0.1, zAt(t), 2.6 + hash(k + 41) * 2.2); }
  for (let k = 0; k < nS; k++) { const t = 0.006 + hash(k + 60) * 0.03, w = wall(t, art.Q); // stern: tall sheets off the taffrail
    push((hash(k + 61) * 2 - 1) * w * 0.9, art.railY(t), zAt(t) - 0.15, 3.2 + hash(k + 62) * 2.8); }
  for (let k = 0; k < nB; k++) { const t = 0.9 + hash(k + 80) * 0.08; push((hash(k + 81) * 2 - 1) * wall(t, art.railY(t)) * 0.8, art.railY(t), zAt(t), 2.0 + hash(k + 82) * 1.6); }
  const n = i, fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(A, 3)); fg.setAttribute('corner', new THREE.Float32BufferAttribute(C, 2)); fg.setAttribute('seed', new THREE.Float32BufferAttribute(S, 3));
  const idx = []; for (let q = 0; q < n; q++) { const a = q * 4; idx.push(a, a + 1, a + 2, a, a + 2, a + 3); } fg.setIndex(idx); fg.computeBoundingSphere(); fg.boundingSphere.radius += 8;
  const out = { flames: fg, n, deckY: shape.top(0.5) - layout.deckDrop }; _artGeo.set(key, out); return out;
}
const _emGeo = new Map();
let _lava = null, _spike = null;
export function flamingRedesignPartsOverride(ship, ctx) {
  if (ctx.ud.art) return flamingArt(ship, ctx);
  const low = ctx.quality === 'low', G = geos(ctx.ud, low), F = fxOf(ship);
  ctx.hide(ctx.base.hull); ctx.hide(ctx.base.hullOutline);
  _lava = _lava || objSpace(toon(0x2a1612, null, { side: THREE.DoubleSide }), 'fz-hull', LAVA('1.6'));
  _spike = _spike || objSpace(toon(0x16100e, null), 'fz-spike', LAVA('1.4'));
  _lava.userData.fzDone = _spike.userData.fzDone = true;
  const h = new THREE.Mesh(G.hull, _lava); h.userData.sharedGeo = true; ctx.add(h); if (!low) ctx.add(outlineFor(h, 0.06));
  const s = new THREE.Mesh(G.spikes, _spike); s.userData.sharedGeo = true; ctx.add(s); if (!low) ctx.add(outlineFor(s, 0.04));
  // the wake owns this ship's smoothed speed; flames + embers share that uniform (one speed source per ship)
  const wake = signatureWake(ship, ctx, { c0: 0xffd060, c1: 0xff1a00, n: 56, size: 380, rise: 1.6 });
  const fm = _flameMat.clone(); fm.uniforms.uT = wind.uTime; fm.uniforms.uSpeed = wake.material.uniforms.uSpeed;
  const fl = new THREE.Mesh(G.flames, fm); fl.userData.sharedGeo = true; fl.renderOrder = 5; fl.frustumCulled = false; ctx.add(fl);
  const n = low ? 16 : 44;
  if (!_emGeo.has(n)) { const g = new THREE.BufferGeometry(), sd = new Float32Array(n * 3); for (let i = 0; i < sd.length; i++) sd[i] = hash(i * 2.3 + 11);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 3)); _emGeo.set(n, g); }
  const em = _emberMat.clone(); em.uniforms.uT = wind.uTime; em.uniforms.uSpeed = fm.uniforms.uSpeed; em.uniforms.uBox.value.set(ctx.beam * 0.8, ctx.len * 0.8, G.deckY + 0.5);
  const ep = new THREE.Points(_emGeo.get(n), em); ep.frustumCulled = false; ep.renderOrder = 5; ep.userData.sharedGeo = true; ctx.add(ep);
  // heat glow: lanterns turn into flickering fire light
  const L = []; ship.traverse(o => { if (o.isPointLight) { o.color.set(0xff7a2a); o.userData.fzBase = o.intensity *= 0.6; L.push(o); } });
  if (L.length) fl.onBeforeRender = () => { const t = wind.uTime.value; for (const o of L) o.intensity = o.userData.fzBase * (0.8 + 0.2 * Math.sin(t * 17.0) * Math.sin(t * 7.3)); };
  liftRig(ctx, { lift: 0.55, sx: 1.1, sy: 1.22, sz: 1.1 }); // taller + bigger, between Kraken and Diamond
}
// optional per-frame hook (remote ships: feed the synced speed). No-op on other skins.
export function flamingRedesignTick(mesh, { speed } = {}) {
  if (mesh?.userData?.skinId !== 'flaming' || typeof speed !== 'number') return;
  fxOf(mesh).speed = speed;
}
export const FLAMING_REDESIGN = { materialFx: flamingRedesignMaterialFx, partsOverride: flamingRedesignPartsOverride, tick: flamingRedesignTick };

// [Timothy v2] FLAMING on the new hull: the real hull + upper works turn to obsidian with lava seams (materialFx did the dress,
// the base hull gets the lava shader here), big fire off every rail, the waist and the taffrail, fire up the sails, a burning
// flag and a storm of embers. Same lift / scale as before (muzzles + hitbox unchanged).
let _flagFx = new Map();
function flamingArt(ship, ctx) {
  const low = ctx.quality === 'low', G = artFlames(ctx.ud, low); uFzTall.value = 1;
  _lava = _lava || objSpace(toon(0x2a1612, null, { side: THREE.DoubleSide }), 'fz-hull', LAVA('1.6')); _lava.userData.fzDone = true;
  if (ctx.base.hull) ctx.base.hull.material = _lava;
  const wake = signatureWake(ship, ctx, { c0: 0xffd060, c1: 0xff1a00, n: low ? 40 : 64, size: 380, rise: 1.8 });
  const fm = _fireMat.clone(); fm.uniforms.uT = wind.uTime; fm.uniforms.uSpeed = wake.material.uniforms.uSpeed;
  const fl = new THREE.Mesh(G.flames, fm); fl.userData.sharedGeo = true; fl.renderOrder = 5; fl.frustumCulled = false; fl.userData.fzFlames = true; ctx.add(fl);
  const n = low ? 40 : 150;
  if (!_emGeo.has(n)) { const g = new THREE.BufferGeometry(), sd = new Float32Array(n * 3); for (let i = 0; i < sd.length; i++) sd[i] = hash(i * 2.3 + 11);
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('seed', new THREE.BufferAttribute(sd, 3)); _emGeo.set(n, g); }
  const em = _emberMat.clone(); em.uniforms.uT = wind.uTime; em.uniforms.uSpeed = fm.uniforms.uSpeed; em.uniforms.uBox.value.set(ctx.beam * 0.95, ctx.len * 0.9, G.deckY + 0.5);
  const ep = new THREE.Points(_emGeo.get(n), em); ep.frustumCulled = false; ep.renderOrder = 5; ep.userData.sharedGeo = true; ctx.add(ep);
  const fimg = new Set(); ctx.ud.flag?.traverse?.(o => { if (o.isMesh && o.material?.map?.image) fimg.add(o.material.map.image); });
  const fl0 = []; ship.traverse(o => { if (o.isMesh && fimg.has(o.material?.map?.image)) fl0.push(o); }); // every flag copy (upgrades move / re-fly it)
  for (const o of fl0) if (o.isMesh && o.material?.map) { const m0 = o.material;
    let f = _flagFx.get(m0); if (!f) { f = m0.clone(); f.color.set(0xffffff); f.onBeforeCompile = () => {}; objSpace(f, 'fz-flag', FLAG); f.userData.fzDone = true; _flagFx.set(m0, f); } o.material = f; }
  const L = []; ship.traverse(o => { if (o.isPointLight) { o.color.set(0xff7a2a); o.userData.fzBase = o.intensity *= 0.7; L.push(o); } });
  if (L.length) fl.onBeforeRender = () => { const t = wind.uTime.value; for (const o of L) o.intensity = o.userData.fzBase * (0.75 + 0.25 * Math.sin(t * 17.0) * Math.sin(t * 7.3)); };
  liftRig(ctx, { lift: 0.55, sx: 1.1, sy: 1.22, sz: 1.1 });
}
