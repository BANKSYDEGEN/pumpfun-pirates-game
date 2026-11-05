// [Emerly] LEVIATHAN (concept: /workspace/prestige-concepts/P6_leviathan.jpg). A sea monster that IS a ship: a scaled, deep-teal hide
// with bioluminescent spots, a horned monster head with fangs and glowing eyes on the bow, tentacles rising out of the sea round the hull
// and over the rails, a swaying tail fin under the stern, teal sails with glowing spots, rising bio-light motes and a glowing wake.
// HULL ANIMATION (shader, shared clock): overlapping scales (object-space cells) with a ripple of light that runs bow -> stern through
// the hide; spot clusters pulse in a travelling wave. Tentacles + tail fin sway in the vertex shader (aSway weight, no JS per frame).
import { THREE, Parts, partsMat, addParts, glows, dressShip, frame, cached, dimLights, hash, tube } from './kit.js';
import { liftRig, signatureWake } from '../pvpKit.js';

export const LEVIATHAN = {
  id: 'leviathan', name: 'LEVIATHAN', price: 0, premium: 'pvp', crewOutfit: 'kraken',
  blurb: 'A living sea monster. Scaled hide, glowing spots, fangs and tentacles that never stop moving.',
  palette: { seed: 233, wood: 0x2a4a44, artBody: 0x0f2a28, band: 0x0a1c1a, stripe: 0x3fe0c0, band2: 0x1a3a36, tar: 0x061210, trim: 0x8ac8b0, artTrim: 0x6aa898, sail: 0x1f8a7c, patch: [0x1a7a6c, 0x26a090], hem: 0x0f4a42, lantern: 0x7affe0, window: 0x6affd8, stripes: 0x2ab8a0, artWindow: 0x5affd8 },
  sail: { bg: '#1f8a7c', badge: '#062420', lines: 'rgba(120,255,220,0.12)', border: '#5affd8' },
  flag: { bg: '#0f3a34', badge: '#03120f', border: '#5affd8' },
  parts: { oak: 0x2a4a44, plank: 0x355a52, deck: 0x6a5a40, iron: 0x14221f, gold: 0x6aa898, glow: 0x7affe0 },
  swatch: { hull: '#123a36', band: '#0a1c1a', stripe: '#3fe0c0', sail: '#1f8a7c', trim: '#6aa898' },
};
const GLSL = `
void nsScales(vec3 P, out float shade, out float spot, out float h){
  float row = floor(P.y * 2.3 + 0.5 * floor(P.x * 0.0)); float v = fract(P.y * 2.3);
  float col = P.z * 1.45 + row * 0.5 + (P.x > 0.0 ? 0.0 : 0.25); vec2 f = vec2(fract(col) - 0.5, v);
  float d = length(vec2(f.x, f.y * 0.85)); shade = smoothstep(0.62, 0.15, d) * 0.8 + 0.2;
  h = nsH2(vec2(floor(col), row)); spot = h > 0.78 ? smoothstep(0.24, 0.08, length(vec2(f.x, f.y - 0.45))) : 0.0; }
void shipFx(inout vec3 base, inout vec3 emit, vec3 P, vec3 W, vec3 N, vec3 Nf, vec3 Rw, float fres, float lum, vec2 uv){
  vec3 bio = vec3(0.25, 1.0, 0.85);
  if (NS_ROLE == 3.0) { emit += base * nsEnv(Rw, vec3(0.3, 0.8, 0.7)) * 0.25 + bio * fres * 0.2; base *= 0.6; return; }  // tarnished bronze trim
  if (NS_ROLE == 6.0 || NS_ROLE == 4.0) { base *= vec3(0.75, 0.85, 0.82); return; }                                    // dark wet wood
  if (NS_ROLE == 2.0) {                                                                                                // teal sails, glowing spots
    vec2 g = uv * vec2(7.0, 6.0); vec2 c = floor(g); float hh = nsH2(c + 3.0); float dd = length(fract(g) - 0.5);
    float pulse = 0.5 + 0.5 * sin(uNT * 2.2 - (c.y * 0.9 + c.x * 0.3) + hh * 6.28);
    float sp = hh > 0.62 ? smoothstep(0.22, 0.06, dd) : 0.0;
    float facet = nsH2(vec2(floor(uv.x * 4.0 + floor(uv.y * 3.0) * 0.5), floor(uv.y * 3.0)));
    base = mix(base, vec3(0.06, 0.42, 0.38), 0.55) * (0.8 + 0.35 * facet);
    emit += bio * sp * (0.35 + 1.4 * pulse) + vec3(0.04, 0.3, 0.26) * (0.25 + fres); return; }
  float shade, spot, h; nsScales(P, shade, spot, h);
  float rip = sin(P.z * 0.8 - uNT * 2.4 + P.y * 1.3 + nsN(P * 0.4) * 2.0);
  float pulse = 0.5 + 0.5 * sin(uNT * 2.6 - P.z * 0.55 + h * 6.28);
  vec3 hide = mix(vec3(0.02, 0.09, 0.09), vec3(0.06, 0.3, 0.27), shade) * (0.75 + 0.5 * lum);
  if (NS_ROLE == 5.0) { hide = mix(vec3(0.03, 0.2, 0.19), vec3(0.1, 0.48, 0.43), shade) * (0.6 + 0.6 * lum); spot = max(spot, h > 0.55 ? smoothstep(0.3, 0.1, length(vec2(fract(P.z * 1.45 + floor(P.y * 2.3) * 0.5) - 0.5, fract(P.y * 2.3) - 0.45))) : 0.0); }
  if (NS_ROLE == 1.0) hide = mix(base * vec3(0.55, 0.75, 0.72), hide, 0.45);                                           // castle: wood under the hide
  if (NS_ROLE == 7.0) hide = vec3(0.02, 0.06, 0.06);
  base = hide;
  emit += vec3(0.05, 0.45, 0.4) * smoothstep(0.7, 1.0, rip) * shade * 0.55                                            // ripple through the hide
        + bio * spot * (0.3 + 1.7 * pulse) + vec3(0.1, 0.55, 0.5) * fres * 0.45
        + vec3(0.6, 1.0, 0.95) * pow(max(dot(Rw, normalize(vec3(0.45, 0.75, 0.48))), 0.0), 40.0) * shade * 0.6;     // wet gloss
}`;
const S = { id: 'leviathan', glsl: GLSL };

function geos(ud, q) {
  const low = q === 'low', F = frame(ud), P = new Parts(), HIDE = 0x1a5a52, BONE = 0xe8dcb0, EYE = 0xb8fff0;
  const [fx, fy, fz] = F.fig.p, hz = fz + 1.6, hy = fy + 0.9;
  const HS = 1.45; // head scale
  // monster head on the bow: skull + brow + upper / lower jaw, fangs, horns, eye sockets, side fins (built round its own origin, then scaled)
  const Pm = P; { const P = new Parts(); const hy0 = hy, hz0 = hz; { const hy = 0, hz = 0;
  P.add(new THREE.IcosahedronGeometry(1.7, low ? 0 : 1), { p: [0, hy + 0.9, hz - 0.6], s: [1.15, 0.95, 1.35], color: HIDE, fx: 3 });
  P.add(new THREE.ConeGeometry(1.25, 2.8, low ? 6 : 8, 1), { p: [0, hy + 0.55, hz + 1.3], r: [Math.PI / 2 - 0.12, 0, 0], s: [1.25, 1, 0.6], color: HIDE, fx: 3 }); // snout / upper jaw
  P.add(new THREE.ConeGeometry(1.0, 2.5, low ? 6 : 8, 1), { p: [0, hy - 0.75, hz + 0.95], r: [Math.PI / 2 + 0.32, 0, 0], s: [1.15, 1, 0.5], color: 0x103a35, fx: 3 }); // lower jaw, open
  P.add(new THREE.SphereGeometry(0.95, 8, 6), { p: [0, hy - 0.05, hz + 1.0], s: [1.0, 0.55, 1.2], color: 0x3a0a10, fx: 0 }); // the maw
  const teeth = low ? 6 : 10;
  for (let i = 0; i < teeth; i++) { const a = (i / (teeth - 1) - 0.5) * 2.2, x = Math.sin(a) * 1.05, z = hz + 0.55 + Math.cos(a) * 1.0;
    P.add(new THREE.ConeGeometry(0.12, 0.6 + (i % 2) * 0.25, 4), { p: [x, hy + 0.1, z], r: [Math.PI, 0, 0], color: BONE, fx: 0 });
    P.add(new THREE.ConeGeometry(0.1, 0.45, 4), { p: [x * 0.85, hy - 0.5, z - 0.15], color: BONE, fx: 0 }); }
  P.mirror(sx => {
    P.add(new THREE.SphereGeometry(0.32, 8, 6), { p: [sx * 0.95, hy + 1.05, hz + 0.55], color: EYE, fx: 2 });                         // eyes
    P.add(new THREE.ConeGeometry(0.42, 1.0, 5), { p: [sx * 0.95, hy + 1.45, hz + 0.45], r: [0.3, 0, sx * 0.9], s: [1, 1, 0.5], color: HIDE, fx: 3 }); // brow ridge
    P.add(new THREE.ConeGeometry(0.32, 2.4, 6), { p: [sx * 0.9, hy + 2.3, hz - 0.9], r: [-0.75, 0, -sx * 0.35], color: BONE, fx: 0 });  // horns
    P.add(new THREE.ConeGeometry(0.24, 1.4, 5), { p: [sx * 0.55, hy + 2.0, hz - 1.6], r: [-0.95, 0, -sx * 0.2], color: BONE, fx: 0 });
    P.add(new THREE.ConeGeometry(0.9, 2.2, 4), { p: [sx * 1.85, hy + 0.2, hz - 1.4], r: [0.2, 0, -sx * 1.9], s: [1, 1, 0.25], color: HIDE, fx: 3, sway: 0.25, ph: sx }); // side fins
  }); }
    const head = P.build(); head.scale(HS, HS, HS); head.translate(0, hy0, hz0); Pm.list.push(head); }
  // dorsal spines along the bow deck
  for (let i = 0; i < (low ? 3 : 5); i++) { const t = 0.9 - i * 0.045; P.add(new THREE.ConeGeometry(0.28, 1.2 - i * 0.12, 4), { p: [0, F.railY(t) + 0.3, F.zAt(t) - 1.5], r: [-0.45, 0, 0], color: BONE, fx: 0 }); }
  // tentacles: rise out of the sea beside the hull, arch over the rail, curl at the tip (sway in the vertex shader)
  const tents = low ? [[0.78, 1], [0.32, -1], [0.55, -1], [0.15, 1]] : [[0.8, 1], [0.58, 1], [0.3, 1], [0.12, 1], [0.7, -1], [0.45, -1], [0.22, -1]];
  tents.forEach(([t, sx], i) => { const z = F.zAt(t), w = F.halfW(t) + 0.9, top = F.top(t) + 2.6 + hash(i) * 1.8, dz = (hash(i + 7) - 0.5) * 2.0;
    const pts = [[sx * w, -1.2, z], [sx * (w + 0.9), 0.9, z + dz * 0.3], [sx * (w + 0.6), top - 0.6, z + dz * 0.6], [sx * (w - 0.6), top + 0.3, z + dz], [sx * (w - 1.4), top - 0.4, z + dz * 1.1], [sx * (w - 1.2), top - 1.2, z + dz * 1.2]];
    const r = 0.5 + hash(i + 3) * 0.15, { geo } = tube(pts, r, 0.06, low ? 10 : 18, low ? 5 : 7);
    P.add(geo, { color: HIDE, fx: 3, sway: 1, ph: i * 1.7 }); });
  // tail fin under the stern (sways)
  const tz = F.zAt(0.0) - 0.4, { geo: tail } = tube([[0, -0.9, tz + 0.8], [0, -0.6, tz - 1.2], [0, 0.2, tz - 2.8]], 0.55, 0.15, low ? 6 : 10, low ? 5 : 7);
  P.add(tail, { color: HIDE, fx: 3, sway: 0.7, ph: 0.5 });
  P.mirror(sx => P.add(new THREE.ConeGeometry(1.2, 2.6, 4), { p: [sx * 0.9, 0.7, tz - 3.3], r: [0.9, 0, sx * 0.5], s: [1, 1, 0.18], color: 0x1f6a60, fx: 3, sway: 0.9, ph: 0.5 }));
  // glows: eye glow, bio-light motes rising from the sea round the hull
  const G = [];
  for (const sx of [1, -1]) G.push([sx * 0.95 * HS, hy + 1.05 * HS, hz + 0.6 * HS, 2.2, 0x7affe0, 3, 0.3 + sx * 0.1], [sx * 0.95 * HS, hy + 1.05 * HS, hz + 0.85 * HS, 0.9, 0xeafff8, 4, 0.6]);
  const nb = low ? 8 : 18;
  for (let i = 0; i < nb; i++) { const t = hash(i + 40), sx = i % 2 ? 1 : -1; G.push([sx * (F.halfW(t) + 0.6 + hash(i) * 2.5), -0.2 + hash(i + 5) * 2, F.zAt(t), 0.35 + hash(i + 8) * 0.3, i % 3 ? 0x5affd8 : 0xa0fff0, 2, hash(i + 13)]); }
  return { parts: P.build(), glow: G };
}

export function leviathanPartsOverride(ship, ctx) {
  const q = ctx.quality, G = cached('leviathan', ctx.ud, q, () => geos(ctx.ud, q));
  dressShip(ship, ctx, S, { outline: 0x02100e, glow: 0x6affd8, rope: 0x2a3a30 });
  addParts(ctx, G.parts, partsMat(S, q, 0.32), { outline: 0.05 });
  glows(ctx, 'leviathan' + q + ctx.len.toFixed(1), G.glow);
  dimLights(ship, 0.5);
  signatureWake(ship, ctx, { c0: 0x9affe8, c1: 0x0a8a70, n: 60, size: 380, rise: 0.5 });
  liftRig(ctx, { lift: 0.6, sx: 1.12, sy: 1.26, sz: 1.12 });
}
LEVIATHAN.partsOverride = leviathanPartsOverride;
export default LEVIATHAN;
