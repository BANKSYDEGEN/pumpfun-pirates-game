// [Emerly] POSEIDON'S THRONE (concept: /workspace/prestige-concepts/P10_poseidons_throne.jpg). The sea god's own ship: a hull of living
// water (deep blue to aqua, with caustic light webs and foam lines that flow along it), sea-glass sails, gold trim, a giant golden trident
// riding the bowsprit with a glowing sea-gem and crackling lightning, coral and pearls on the rails, a golden throne on the stern castle,
// a swirling ring of sea foam round the hull, spray and bubbles, and a white-water wake.
// HULL ANIMATION (shader, shared clock): two drifting noise fields make moving caustic webs, foam crests run bow -> stern, the sails
// are glassy water with the same caustics; the trident arcs flicker + jitter in their own vertex shader; the foam ring spirals.
import { THREE, Parts, partsMat, addParts, glows, dressShip, frame, cached, dimLights, hash, wind } from './kit.js';
import { liftRig, signatureWake } from '../pvpKit.js';

export const POSEIDON = {
  id: 'poseidon', name: "POSEIDON'S THRONE", price: 0, premium: 'pvp', crewOutfit: 'poseidon', // [Emerly prestige outfits] own crew palette (js/crew.js OUTFIT.poseidon; was 'seagreen')
  blurb: "The sea god's throne. A hull of living water, a lightning trident and the ocean itself swirling round it.",
  palette: { seed: 301, wood: 0x1a5a9a, artBody: 0x0f3a6a, band: 0x0a2a4a, stripe: 0xffcd5a, band2: 0x1a6aa8, tar: 0x06182a, trim: 0xffcd5a, artTrim: 0xffc23a, sail: 0x5ad0f0, patch: [0x4ac0e8, 0x7ae0ff], hem: 0xbff4ff, lantern: 0xbff8ff, window: 0x9ff0ff, stripes: 0x8ae8ff, artWindow: 0x9ff0ff },
  sail: { bg: '#5ad0f0', badge: '#0a3a5a', lines: 'rgba(220,255,255,0.12)', border: '#ffd27a' },
  flag: { bg: '#1a6aa8', badge: '#062a4a', border: '#ffd27a' },
  parts: { oak: 0x1a5a9a, plank: 0x2a6aa8, deck: 0x6a7a80, iron: 0x10304a, gold: 0xffc23a, glow: 0xbff8ff },
  swatch: { hull: '#124a80', band: '#0a2a4a', stripe: '#ffcd5a', sail: '#5ad0f0', trim: '#ffc23a' },
};
const GLSL = `
float nsCaustic(vec3 p){ float a = nsN(p + vec3(uNT * 0.35, 0.0, -uNT * 0.25)), b = nsN(p * 1.13 + vec3(3.1, -uNT * 0.3, uNT * 0.2));
  float c = pow(1.0 - clamp(abs(a - b) * 3.0, 0.0, 1.0), 7.0);
#ifndef NS_LOW
  float a2 = nsN(p * 2.1 + vec3(-uNT * 0.5, 1.7, uNT * 0.3)), b2 = nsN(p * 2.3 + vec3(7.3, uNT * 0.4, -uNT * 0.35));
  c = max(c, pow(1.0 - clamp(abs(a2 - b2) * 3.0, 0.0, 1.0), 9.0) * 0.6);
#endif
  return c; }
void shipFx(inout vec3 base, inout vec3 emit, vec3 P, vec3 W, vec3 N, vec3 Nf, vec3 Rw, float fres, float lum, vec2 uv){
  vec3 aqua = vec3(0.35, 0.95, 1.0);
  if (NS_ROLE == 3.0) { emit += base * base * nsEnv(Rw, vec3(1.0, 0.82, 0.45)) * 0.85 + vec3(1.0, 0.85, 0.5) * fres * 0.4 + aqua * nsCaustic(P * 0.9) * 0.25; base *= 0.5; return; }
  if (NS_ROLE == 6.0 || NS_ROLE == 4.0) { emit += aqua * nsCaustic(P * 0.6) * 0.15; return; }
  float ca = nsCaustic(vec3(P.z * 0.45, P.y * 0.7, P.x * 0.3) * (NS_ROLE == 2.0 ? 1.6 : 1.0));
  float flow = nsF(P * 0.25 + vec3(0.0, 0.0, -uNT * 0.3));
  if (NS_ROLE == 2.0) {                                                                          // sea-glass sails
    float facet = nsH2(vec2(floor(uv.x * 5.0 + floor(uv.y * 4.0) * 0.5), floor(uv.y * 4.0)));
    base = mix(base, mix(vec3(0.12, 0.55, 0.78), vec3(0.45, 0.9, 1.0), facet * 0.6 + flow * 0.4), 0.7);
    emit += aqua * (ca * 0.9 + 0.12) + vec3(0.7, 1.0, 1.0) * fres * 0.4; return; }
  float crest = smoothstep(0.88, 1.0, sin(P.z * 0.75 + uNT * 1.9 + sin(P.y * 2.0 + uNT) * 1.4 + flow * 3.0));
  vec3 water = mix(vec3(0.02, 0.12, 0.3), vec3(0.05, 0.42, 0.7), clamp(lum * 0.7 + flow * 0.6 - 0.15, 0.0, 1.0));
  if (NS_ROLE == 1.0) water = mix(base * vec3(0.4, 0.6, 0.9), water, 0.6);
  if (NS_ROLE == 7.0) water = vec3(0.02, 0.1, 0.25);
  base = water;
  emit += aqua * ca * 0.75 + vec3(0.9, 1.0, 1.0) * crest * 0.45 + vec3(0.2, 0.7, 1.0) * fres * 0.6
        + vec3(1.0) * pow(max(dot(Rw, normalize(vec3(0.45, 0.75, 0.48))), 0.0), 60.0) * 0.9;
}`;
const S = { id: 'poseidon', glsl: GLSL };

// lightning arcs: ribbons between trident points, re-shaped ~12x a second in the vertex shader (no JS)
const _arcMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime },
  vertexShader: `attribute vec3 aB; attribute vec2 aArc; attribute float aSide; uniform float uT; varying float vA; varying float vS;
    float h1(float n){ return fract(sin(n) * 43758.5453); }
    void main(){ float t = aArc.x, id = aArc.y, k = floor(uT * 12.0 + id * 3.7);
      vec3 a = position, b = aB, p = mix(a, b, t), d = normalize(b - a), u = normalize(cross(d, vec3(0.3, 1.0, 0.2))), v = cross(d, u);
      float env = sin(t * 3.14159), j1 = h1(id * 7.1 + k * 1.3 + floor(t * 6.0) * 2.1) - 0.5, j2 = h1(id * 3.3 + k * 2.7 + floor(t * 6.0) * 5.3) - 0.5;
      p += (u * j1 + v * j2) * env * 1.1 * length(b - a) * 0.35;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); vec3 sd = normalize(cross((modelViewMatrix * vec4(d, 0.0)).xyz, vec3(0.0, 0.0, 1.0)));
      mv.xyz += sd * aSide * 0.07 * (1.0 + env);
      vA = step(0.35, h1(id * 9.7 + floor(uT * 9.0))) * (0.6 + 0.4 * env); vS = aSide; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; varying float vS; void main(){ float a = vA * (1.0 - abs(vS) * 0.6); if (a < 0.02) discard; gl_FragColor = vec4(vec3(0.6, 0.95, 1.0) * 2.4 * a, a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});
function arcs(pairs, seg) {
  const pos = [], b = [], arc = [], side = [], idx = []; let n = 0;
  pairs.forEach(([A, B], id) => { for (let i = 0; i <= seg; i++) for (const s of [-1, 1]) { pos.push(...A); b.push(...B); arc.push(i / seg, id); side.push(s); }
    for (let i = 0; i < seg; i++) { const o = n + i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } n += (seg + 1) * 2; });
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('aB', new THREE.Float32BufferAttribute(b, 3));
  g.setAttribute('aArc', new THREE.Float32BufferAttribute(arc, 2)); g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); g.setIndex(idx);
  g.computeBoundingSphere(); g.boundingSphere.radius += 4; return g;
}
// swirling foam ring at the waterline (additive, on the ship, not the bobbing body)
const _ringMat = new THREE.ShaderMaterial({
  uniforms: { uT: wind.uTime },
  vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uT; varying vec2 vP; void main(){ float r = length(vP), a = atan(vP.y, vP.x);
      float sp = 0.5 + 0.5 * sin(a * 5.0 - r * 2.2 + uT * 2.6), sp2 = 0.5 + 0.5 * sin(a * 9.0 + r * 3.0 - uT * 3.4);
      float band = smoothstep(0.0, 0.15, r - 1.0) * (1.0 - smoothstep(0.55, 1.0, r - 1.0));
      float f = band * (pow(sp, 6.0) * 0.8 + pow(sp2, 10.0) * 0.5); if (f < 0.02) discard;
      gl_FragColor = vec4(vec3(0.75, 0.98, 1.0) * f, f); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
function geos(ud, q) {
  const low = q === 'low', F = frame(ud), P = new Parts(), GOLD = 0xffc23a, CORAL = [0xff5aa0, 0xc04ad8, 0xff8a6a];
  const [fx, fy, fz] = F.fig.p;
  // the trident: rises from the bow at ~33 degrees, gem collar, crossbar, three barbed prongs (side prongs flare out)
  const V3 = (v) => new THREE.Vector3(...v), dir = V3([0, 0.55, 0.83]).normalize(), up = V3([0, 0.83, -0.55]).normalize();
  const base = V3([0, fy + 0.2, fz - 1.4]), L = 8.6, H = base.clone().addScaledVector(dir, L);
  const at = (d, u = 0) => H.clone().addScaledVector(dir, d).addScaledVector(up, u).toArray();
  P.rod(base.toArray(), H.toArray(), 0.3, 0.22, { color: GOLD, fx: 1, radial: low ? 6 : 8 });
  P.rod(at(-0.9), at(-0.1), 0.42, 0.55, { color: GOLD, fx: 1, radial: 8 });                       // collar
  P.add(new THREE.OctahedronGeometry(0.6, 0), { p: at(-1.5), color: 0x9ff8ff, fx: 2 });            // sea gem
  P.rod(at(0, -1.75), at(0, 1.75), 0.24, 0.24, { color: GOLD, fx: 1 });                         // crossbar
  const tips = [];
  for (const k of [-1, 0, 1]) {
    const root = at(0, k * 1.6), mid = at(1.6, k * 1.75), tip = at(k ? 3.0 : 3.6, k * (k ? 1.55 : 0));
    if (k) { P.rod(root, mid, 0.2, 0.18, { color: GOLD, fx: 1 }); P.rod(mid, tip, 0.18, 0.15, { color: GOLD, fx: 1 }); }
    else P.rod(at(0), tip, 0.22, 0.18, { color: GOLD, fx: 1 });
    const pt = at(k ? 4.3 : 5.0, k * (k ? 1.4 : 0)); P.rod(tip, pt, 0.42, 0, { color: GOLD, fx: 1, radial: 4 });     // spear point
    P.rod(at(k ? 3.3 : 3.9, k * (k ? 1.55 : 0) + (k || 1) * 0.55), at(k ? 2.7 : 3.3, k * (k ? 1.55 : 0) + (k || 1) * 0.15), 0.16, 0, { color: GOLD, fx: 1, radial: 4 }); // barb
    tips.push(pt, root); }
  // coral clusters on the bow + stern rails, pearls along the rails
  const reef = (t, sx, n, k) => { const z = F.zAt(t), y = F.railY(t) - 0.2, x = sx * F.halfW(t) * 0.95;
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.28, h = (0.8 + hash(i + t * 9) * 0.9) * k;
      P.add(new THREE.ConeGeometry(0.16 * k, h, 5), { p: [x + Math.cos(a) * 0.35 * k, y + h / 2, z + Math.sin(a) * 0.35 * k], r: [Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5], color: CORAL[i % 3], fx: i % 3 === 1 ? 2 : 0 }); } };
  P.mirror(sx => { reef(0.84, sx, low ? 4 : 7, 1.1); reef(0.2, sx, low ? 3 : 6, 1.0); if (!low) reef(0.52, sx, 4, 0.8); });
  const NP = low ? 4 : 7;
  for (let i = 0; i < NP; i++) { const t = 0.28 + i / (NP - 1) * 0.46; P.mirror(sx => P.add(new THREE.SphereGeometry(0.24, low ? 6 : 10, low ? 4 : 7), { p: [sx * F.halfW(t) * 1.04, F.railY(t) + 0.22, F.zAt(t)], color: 0xf4f8ff, fx: 1 })); }
  // golden throne on the stern castle
  const tz = F.zAt(0.1), ty = F.railY(0.1) - 0.75;
  P.add(new THREE.BoxGeometry(1.5, 0.35, 1.2), { p: [0, ty + 0.5, tz], color: GOLD, fx: 1 });
  P.add(new THREE.BoxGeometry(1.5, 0.5, 1.0), { p: [0, ty + 0.15, tz], color: 0x1a6aa8, fx: 3 });
  P.add(new THREE.BoxGeometry(1.5, 2.4, 0.25), { p: [0, ty + 1.7, tz - 0.55], color: GOLD, fx: 1 });
  P.mirror(sx => { P.add(new THREE.BoxGeometry(0.22, 0.55, 1.2), { p: [sx * 0.75, ty + 0.95, tz], color: GOLD, fx: 1 }); P.add(new THREE.ConeGeometry(0.15, 0.7, 4), { p: [sx * 0.55, ty + 3.2, tz - 0.55], color: GOLD, fx: 1 }); });
  P.add(new THREE.ConeGeometry(0.2, 1.0, 4), { p: [0, ty + 3.4, tz - 0.55], color: GOLD, fx: 1 });
  P.add(new THREE.OctahedronGeometry(0.28, 0), { p: [0, ty + 2.3, tz - 0.4], color: 0x9ff8ff, fx: 2 });
  // glows: trident gem + prong sparks, spray round the bow, bubbles orbiting the hull
  const G = [], gem = at(-1.5);
  G.push([...gem, 4.5, 0x6af0ff, 3, 0.2], [...gem, 2.2, 0xffffff, 4, 0.6]);
  for (let i = 0; i < 6; i += 2) G.push([...tips[i], 1.2, 0xbffcff, 4, 0.1 + i * 0.2]);
  const ns = low ? 8 : 18; for (let i = 0; i < ns; i++) { const t = 0.75 + hash(i) * 0.25, sx = i % 2 ? 1 : -1; G.push([sx * (F.halfW(t) + 0.4 + hash(i + 2) * 1.2), 0.2 + hash(i + 3), F.zAt(t) + 1, 0.45 + hash(i + 4) * 0.4, 0xe0ffff, 2, hash(i + 5)]); }
  const nb = low ? 6 : 14; for (let i = 0; i < nb; i++) { const a = i / nb * 6.283; G.push([Math.cos(a) * (F.beam * 0.75 + 1), 0.4 + hash(i + 30) * 2.5, Math.sin(a) * F.len * 0.62, 0.3 + hash(i + 31) * 0.3, 0x9ff0ff, 1, hash(i + 32)]); }
  // arcs: prong tips <-> gem, prong <-> prong
  const pairs = [[tips[0], gem], [tips[2], gem], [tips[4], gem], [tips[0], tips[2]], [tips[2], tips[4]]]; if (!low) pairs.push([tips[1], tips[5]], [gem, base.clone().addScaledVector(dir, L * 0.55).toArray()]);
  return { parts: P.build(), glow: G, arcs: arcs(pairs, low ? 6 : 10) };
}

export function poseidonPartsOverride(ship, ctx) {
  const q = ctx.quality, G = cached('poseidon', ctx.ud, q, () => geos(ctx.ud, q));
  dressShip(ship, ctx, S, { outline: 0x041a30, glow: 0xbff8ff, rope: 0xc8b070, sail: { transparent: 0.9 } });
  addParts(ctx, G.parts, partsMat(S, q), { outline: 0.04 });
  const a = new THREE.Mesh(G.arcs, _arcMat); a.renderOrder = 4; a.userData.sharedGeo = true; a.userData.nsPart = true; a.frustumCulled = false; ctx.add(a);
  const ring = cached('poseidon-ring', ctx.ud, q, () => { const g = new THREE.RingGeometry(1.0, 2.0, q === 'low' ? 32 : 64, 1); g.rotateX(-Math.PI / 2); return g; });
  const rm = new THREE.Mesh(ring, _ringMat); rm.scale.set(ctx.beam * 0.56, 1, ctx.len * 0.37); rm.position.y = 0.22; rm.renderOrder = 3; rm.userData.sharedGeo = true; rm.userData.nsPart = true;
  ctx.add(rm, ship); // level with the water, like the wake
  glows(ctx, 'poseidon' + q + ctx.len.toFixed(1), G.glow);
  dimLights(ship, 0.45);
  signatureWake(ship, ctx, { c0: 0xffffff, c1: 0x30c8ff, n: 80, size: 440, rise: 1.3 });
  liftRig(ctx, { lift: 0.6, sx: 1.12, sy: 1.26, sz: 1.12 });
}
POSEIDON.partsOverride = poseidonPartsOverride;
export default POSEIDON;
