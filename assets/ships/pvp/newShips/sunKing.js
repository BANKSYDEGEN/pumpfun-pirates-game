// [Emerly] SUN KING (concept: /workspace/prestige-concepts/P9_sun_king.jpg). The grandest royal galleon: ivory-white hull banded in
// molten gold, ivory sails each carrying a blazing gold sun, a radiant sun-face figurehead on the bow with turning rays and a corona,
// great golden wings on the bow and the stern quarters, a gold sun on the main mast, rising sun-flare sparks and a blinding gold wake.
// HULL ANIMATION (shader, shared clock): the gold flows like molten metal (scrolling noise, hot white veins) under a sun-flare pulse
// that sweeps bow -> stern every few seconds and lights the whole hull; the sail suns' rays turn and throb. The figurehead + mast suns
// turn on the shared clock.
import { THREE, Parts, partsMat, addParts, glows, dressShip, frame, cached, dimLights, hash, wind } from './kit.js';
import { liftRig, signatureWake } from '../pvpKit.js';

export const SUNKING = {
  id: 'sunking', name: 'SUN KING', price: 0, premium: 'pvp', crewOutfit: 'sunking', // [Emerly prestige outfits] own crew palette (js/crew.js OUTFIT.sunking; was 'golden')
  blurb: 'The royal flagship of the sun. Molten gold, blazing sails and a radiant sun crown that outshines every ship afloat.',
  palette: { seed: 277, wood: 0xf2e8d0, artBody: 0xe8dcc0, band: 0xffc23a, stripe: 0xffe08a, band2: 0xd89a20, tar: 0x5a3a10, trim: 0xffcd5a, artTrim: 0xffc23a, sail: 0xfaf2de, patch: [0xf2e8cc, 0xfff8ea], hem: 0xe8b84a, lantern: 0xffe080, window: 0xffd060, stripes: 0xf0e0b8, artWindow: 0xffc850 },
  sail: { bg: '#f8efd8', badge: '#e0a020', lines: 'rgba(200,150,40,0.10)', border: '#e8b84a' },
  flag: { bg: '#ffcf4a', badge: '#a86a08', border: '#fff2c0' },
  parts: { oak: 0xe8dcc0, plank: 0xf2e8d0, deck: 0xd8b880, iron: 0x8a6a2a, gold: 0xffc23a, glow: 0xffe080 },
  swatch: { hull: '#efe4c8', band: '#ffc23a', stripe: '#ffe08a', sail: '#f8efd8', trim: '#ffc23a' },
};
const GLSL = `
vec3 nsMolten(vec3 P, out float pulse){
  float n = nsF(P * 0.7 + vec3(0.0, -uNT * 0.35, uNT * 0.55));
  float vein = 1.0 - smoothstep(0.0, 0.06, abs(nsN(P * 1.3 + vec3(uNT * 0.4, 0.0, -uNT * 0.3)) - 0.5));
  float w = fract(uNT * 0.28 - P.z * 0.035); pulse = smoothstep(0.0, 0.05, w) * (1.0 - smoothstep(0.05, 0.22, w));
  return mix(vec3(0.95, 0.5, 0.06), vec3(1.0, 0.86, 0.42), n) + vec3(1.0, 0.95, 0.8) * vein * 0.6; }
void shipFx(inout vec3 base, inout vec3 emit, vec3 P, vec3 W, vec3 N, vec3 Nf, vec3 Rw, float fres, float lum, vec2 uv){
  float pulse; vec3 molten = nsMolten(P, pulse);
  vec3 sunL = vec3(1.0, 0.82, 0.45);
  if (NS_ROLE == 3.0 || NS_ROLE == 7.0) {                                              // molten gold trim, bands, lids
    base = molten * 0.45; emit += molten * (0.55 + 1.2 * pulse) + molten * nsEnv(Rw, molten) * 0.5 + sunL * fres * 0.6; return; }
  if (NS_ROLE == 6.0) { base = mix(base, vec3(0.95, 0.9, 0.78), 0.5); emit += sunL * pulse * 0.25; return; }   // pale gilded masts
  if (NS_ROLE == 4.0) { base = mix(base, vec3(0.98, 0.93, 0.8), 0.45); emit += sunL * pulse * 0.2; return; }
  if (NS_ROLE == 2.0) {                                                                // ivory sails with a blazing sun
    vec2 d = (uv - vec2(0.5, 0.52)) * vec2(1.0, 1.15); float r = length(d), an = atan(d.y, d.x) + uNT * 0.25;
    float throb = 0.85 + 0.15 * sin(uNT * 2.5);
    float rays = smoothstep(0.55, 1.0, cos(an * 12.0)) * (1.0 - smoothstep(0.2, 0.42 * throb, r)) * step(0.17, r)
               + smoothstep(0.75, 1.0, cos(an * 12.0 + 3.14159)) * (1.0 - smoothstep(0.2, 0.3, r)) * step(0.17, r) * 0.8;
    float ring = (1.0 - smoothstep(0.008, 0.02, abs(r - 0.17)));
    float disc = 1.0 - smoothstep(0.15, 0.165, r);
    float ivory = step(0.55, lum) * step(abs(base.r - base.b), 0.45);                // the cloth, not the skull badge
    base = mix(base * vec3(1.0, 0.97, 0.9), molten, clamp(rays + ring, 0.0, 1.0));
    base = mix(base, molten, disc * ivory * 0.9);
    emit += molten * (rays * 1.1 + ring * 1.4 + disc * ivory * 0.8) * throb + sunL * 0.08 + sunL * pulse * 0.15; return; }
  float goldness = smoothstep(0.12, 0.3, base.r - base.b);                             // the hull texture's gold bands -> molten gold
  if (NS_ROLE == 0.0) goldness = max(goldness, max(smoothstep(0.03, 0.0, abs(P.y - 0.62) - 0.12), smoothstep(0.03, 0.0, abs(P.y - 1.38) - 0.07))); // gold wales
  if (NS_ROLE == 1.0) goldness = max(goldness, smoothstep(0.03, 0.0, abs(fract(P.y * 0.5) - 0.5) - 0.04) * 0.85); // gilded castle mouldings
  vec3 ivory = mix(base, vec3(0.97, 0.94, 0.86), 0.55) * (0.8 + 0.3 * lum);             // ivory hull + castles
  base = mix(ivory, molten * 0.5, goldness); emit += molten * goldness * (0.45 + 1.1 * pulse);
  emit += sunL * (pulse * 0.45 + fres * 0.35) + vec3(1.0, 0.95, 0.85) * pow(max(dot(Rw, normalize(vec3(0.45, 0.75, 0.48))), 0.0), 26.0) * 0.5;
}`;
const S = { id: 'sunking', glsl: GLSL };

// a sun: disc + face + a ring of alternating long / short rays (in the x = 0 plane, visible from both sides)
function sun(P, r, rays, low, color = 0xffc23a) {
  P.add(new THREE.CylinderGeometry(r, r, r * 0.35, low ? 12 : 20), { r: [0, 0, Math.PI / 2], color, fx: 2 });
  for (const sx of [1, -1]) { // face on both sides: brow, eyes, nose, smile
    P.add(new THREE.SphereGeometry(r * 0.55, low ? 8 : 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), { p: [sx * r * 0.15, 0, 0], r: [0, 0, -sx * Math.PI / 2], s: [1, 0.35, 1], color: 0xffe08a, fx: 1 });
    for (const ez of [-0.32, 0.32]) P.add(new THREE.SphereGeometry(r * 0.1, 6, 4), { p: [sx * r * 0.34, r * 0.18, ez * r], color: 0x8a4a08, fx: 0 });
    P.add(new THREE.TorusGeometry(r * 0.3, r * 0.05, 4, 10, Math.PI), { p: [sx * r * 0.33, -r * 0.12, 0], r: [Math.PI, sx * Math.PI / 2, 0], color: 0x8a4a08, fx: 0 }); }
  for (let i = 0; i < rays; i++) { const a = i / rays * Math.PI * 2, L = i % 2 ? r * 0.9 : r * 1.6, w = i % 2 ? r * 0.2 : r * 0.28;
    P.add(new THREE.ConeGeometry(w, L, 4), { p: [0, Math.sin(a) * (r + L / 2 - 0.05), Math.cos(a) * (r + L / 2 - 0.05)], r: [Math.PI / 2 - a, 0, 0], s: [0.35, 1, 1], color: i % 2 ? 0xffe08a : color, fx: 2 }); }
}
// a golden wing: a fan of feathers swept back (sx = side, k = size)
function wing(P, at, sx, k, low, back = 1) {
  const n = low ? 4 : 7;
  for (let i = 0; i < n; i++) { const f = i / (n - 1), L = k * (2.6 - f * 1.3), up = 0.15 + f * 0.75;
    P.add(new THREE.ConeGeometry(0.32 * k, L, 4), { p: [at[0] + sx * 0.25, at[1] + Math.sin(up) * L * 0.45, at[2] - back * Math.cos(up) * L * 0.45], r: [-back * (Math.PI / 2 - up), 0, 0], s: [0.25, 1, 1], color: f < 0.5 ? 0xffc23a : 0xffe08a, fx: 1 }); }
  P.add(new THREE.SphereGeometry(0.4 * k, 8, 6), { p: [at[0] + sx * 0.25, at[1], at[2]], s: [0.5, 1, 1.3], color: 0xffcd5a, fx: 1 });
}
function geos(ud, q) {
  const low = q === 'low', F = frame(ud), P = new Parts(), SUN = new Parts(), POLE = new Parts();
  const [fx, fy, fz] = F.fig.p;
  // golden wings along the bow and on both stern quarters
  P.mirror(sx => { wing(P, [sx * F.halfW(0.84) * 1.04, F.railY(0.84) - 1.1, F.zAt(0.84)], sx, 2.0, low, 1);
    wing(P, [sx * F.halfW(0.12) * 1.05, F.railY(0.12) - 1.6, F.zAt(0.12)], sx, 1.6, low, 1); });
  // gold royal rail urns + a gilded stern sun crest
  const N = low ? 3 : 5;
  for (let i = 0; i < N; i++) { const t = 0.36 + i / (N - 1) * 0.46, z = F.zAt(t), y = F.railY(t) + 0.2, x = F.halfW(t) * 1.04;
    P.mirror(sx => { P.add(new THREE.CylinderGeometry(0.16, 0.1, 0.5, 6), { p: [sx * x, y, z], color: 0xffc23a, fx: 1 }); P.add(new THREE.ConeGeometry(0.12, 0.5, 5), { p: [sx * x, y + 0.45, z], color: 0xffe08a, fx: 2 }); }); }
  // sun-face figurehead (turns: its own mesh) + the mast sun
  sun(SUN, 1.05, low ? 12 : 16, low);
  sun(POLE, 0.8, low ? 10 : 14, low);
  // glows: the figurehead corona + flare stars, rising sun sparks round the hull, warm halos on the urns
  const G = [];
  G.push([0, fy + 1.9, fz + 1.6, 4.6, 0xc87a18, 3, 0.1], [0, fy + 1.9, fz + 1.6, 2.6, 0x8a6a30, 3, 0.5], [0, fy + 1.9, fz + 1.6, 3.4, 0xfff0c0, 4, 0.3]);
  const ns = low ? 10 : 24; for (let i = 0; i < ns; i++) { const t = hash(i + 5), sx = i % 2 ? 1 : -1;
    G.push([sx * (F.halfW(t) + 0.3 + hash(i) * 1.5), F.top(t) - 1 + hash(i + 50) * 3, F.zAt(t), 0.4 + hash(i + 9) * 0.4, i % 3 ? 0xffc040 : 0xfff2c0, 2, hash(i + 3)]); }
  const nf = low ? 6 : 14; for (let i = 0; i < nf; i++) { const t = 0.1 + hash(i + 80) * 0.8; G.push([(hash(i + 90) - 0.5) * 7, 6 + hash(i + 60) * 14, F.zAt(t), 0.6 + hash(i + 19) * 0.5, 0xfff0c0, 4, hash(i + 33)]); }
  return { parts: P.build(), sun: SUN.build(), pole: POLE.build(), glow: G, sunAt: [0, fy + 1.9, fz + 1.6] };
}

export function sunKingPartsOverride(ship, ctx) {
  const q = ctx.quality, G = cached('sunking', ctx.ud, q, () => geos(ctx.ud, q)), pm = partsMat(S, q);
  dressShip(ship, ctx, S, { outline: 0x5a3a08, glow: 0xffd060, rope: 0xc89a4a });
  addParts(ctx, G.parts, pm, { outline: 0.04 });
  const fig = addParts(ctx, G.sun, pm, { outline: 0 }); const ph = Math.random() * 6.28;
  if (fig) { fig.position.set(...G.sunAt); fig.onBeforeRender = () => { fig.rotation.x = wind.uTime.value * 0.35 + ph; }; }  // the rays turn (shared clock, no allocation)
  const pole = ctx.base.flagPole;
  if (pole) { const knob = pole.children.find(o => o.isMesh && o.geometry?.type === 'SphereGeometry'), top = knob ? knob.position.y : 4.4;
    const holder = new THREE.Group(); holder.position.set(0, top + 1.6, 0); ctx.add(holder, pole);
    const ps = addParts(ctx, G.pole, pm, { parent: holder, outline: 0 }); if (ps) ps.onBeforeRender = () => { ps.rotation.y = wind.uTime.value * 0.5 + ph; ps.rotation.x = wind.uTime.value * 0.3; };
    glows(ctx, 'sunking-pole' + q, [[0, 0, 0, 4.0, 0xc87a18, 3, 0.6], [0, 0, 0, 2.4, 0xfff0c0, 4, 0.2]], { parent: holder }); }
  glows(ctx, 'sunking' + q + ctx.len.toFixed(1), G.glow);
  dimLights(ship, 0.35);
  signatureWake(ship, ctx, { c0: 0xffffff, c1: 0xffa010, n: 76, size: 460, rise: 1.0 });
  liftRig(ctx, { lift: 0.6, sx: 1.12, sy: 1.26, sz: 1.12 });
}
SUNKING.partsOverride = sunKingPartsOverride;
export default SUNKING;
