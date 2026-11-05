// [Emerly] CELESTIAL GALLEON (concept: /workspace/prestige-concepts/P8_celestial_galleon.jpg). A galleon cut from the night sky: the
// hull and sails are a drifting nebula (navy / violet / magenta) full of twinkling stars with gold constellations on the sails, gold
// trim, a silver crescent-moon figurehead, a gold star on the main mast, three little planets orbiting the rig, stardust round the ship
// and a long golden stardust wake.
// HULL ANIMATION (shader, shared clock): domain-warped noise nebula that slowly drifts through the planks, a 3D star field whose stars
// twinkle at their own rates; sails add constellation lines + node stars. Planets orbit (one mesh, rotation on the shared clock).
import { THREE, Parts, partsMat, addParts, glows, dressShip, frame, cached, dimLights, hash, wind } from './kit.js';
import { liftRig, signatureWake } from '../pvpKit.js';

export const CELESTIAL = {
  id: 'celestial', name: 'CELESTIAL GALLEON', price: 0, premium: 'pvp', crewOutfit: 'celestial', // [Emerly prestige outfits] own crew palette (js/crew.js OUTFIT.celestial; was 'admiral')
  blurb: 'Sails woven from the night sky. Nebulae drift through the hull, constellations shine and planets orbit the masts.',
  palette: { seed: 257, wood: 0x2a2a6a, artBody: 0x10123a, band: 0x0a0c2a, stripe: 0xffcd77, band2: 0x2a1a5a, tar: 0x05061a, trim: 0xffcd77, artTrim: 0xffcd77, sail: 0x3a2a8a, patch: [0x2a2a7a, 0x5a3aa0], hem: 0xffcd77, lantern: 0xffe8b0, window: 0xffe0a0, stripes: 0x4a3a9a },
  sail: { bg: '#2e2478', badge: '#0a0a2a', lines: 'rgba(255,220,150,0.10)', border: '#ffcd77' },
  flag: { bg: '#2a2070', badge: '#0a0a2a', border: '#ffcd77' },
  parts: { oak: 0x2a2a6a, plank: 0x34347a, deck: 0x5a4a6a, iron: 0x14163a, gold: 0xffcd77, glow: 0xffe8b0 },
  swatch: { hull: '#151a4a', band: '#0a0c2a', stripe: '#ffcd77', sail: '#3a2a8a', trim: '#ffcd77' },
};
const GLSL = `
vec3 nsNebula(vec3 p, out float n){
  vec3 q = p + vec3(uNT * 0.02, 0.0, uNT * 0.035);
#ifdef NS_LOW
  n = nsF(q);
#else
  n = nsF(q + nsF(q * 1.7 + 3.0) * 0.8);
#endif
  vec3 c = mix(vec3(0.015, 0.02, 0.09), vec3(0.22, 0.08, 0.48), smoothstep(0.3, 0.62, n));
  c = mix(c, vec3(0.85, 0.3, 0.72), smoothstep(0.6, 0.85, n) * 0.85);
  c += vec3(0.15, 0.35, 0.9) * smoothstep(0.55, 0.8, nsN(q * 2.3 + 5.0)) * 0.3; return c; }
float nsStars(vec3 p, float dens){ vec3 c = p * dens, f = fract(c) - 0.5; float h = nsH(floor(c));
  float tw = 0.4 + 0.6 * pow(0.5 + 0.5 * sin(uNT * (1.5 + h * 4.0) + h * 50.0), 2.0);
  return step(0.8, h) * (1.0 - smoothstep(0.0, 0.07 + 0.08 * fract(h * 7.0), length(f))) * tw; }
float nsSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * t); }
void shipFx(inout vec3 base, inout vec3 emit, vec3 P, vec3 W, vec3 N, vec3 Nf, vec3 Rw, float fres, float lum, vec2 uv){
  if (NS_ROLE == 3.0) { emit += base * base * nsEnv(Rw, vec3(1.0, 0.8, 0.45)) * 0.8 + vec3(1.0, 0.8, 0.4) * fres * 0.4; base *= 0.5; return; } // gold
  if (NS_ROLE == 6.0 || NS_ROLE == 4.0) { base *= vec3(0.7, 0.62, 0.7); emit += vec3(0.3, 0.2, 0.6) * fres * 0.3; return; }               // dark wood
  float n; vec3 neb = nsNebula(P * (NS_ROLE == 2.0 ? 0.22 : 0.16), n);
  float st = nsStars(P, NS_ROLE == 2.0 ? 2.6 : 2.0);
  if (NS_ROLE == 2.0) {                      // sails: nebula + constellation
    vec2 a = vec2(0.18, 0.72), b = vec2(0.36, 0.55), c = vec2(0.52, 0.66), d = vec2(0.64, 0.42), e = vec2(0.82, 0.5), f = vec2(0.45, 0.25);
    float l = min(min(nsSeg(uv, a, b), nsSeg(uv, b, c)), min(min(nsSeg(uv, c, d), nsSeg(uv, d, e)), nsSeg(uv, d, f)));
    float node = min(min(min(length(uv - a), length(uv - b)), min(length(uv - c), length(uv - d))), min(length(uv - e), length(uv - f)));
    float line = 1.0 - smoothstep(0.004, 0.011, l), nd = 1.0 - smoothstep(0.0, 0.028, node);
    float tw = 0.6 + 0.4 * sin(uNT * 2.0 + uv.x * 9.0);
    base = mix(base * 0.25, neb, 0.85);
    emit += neb * 0.55 + vec3(1.0, 0.82, 0.45) * (line * 0.9 + nd * 2.2 * tw) + vec3(1.0, 0.95, 0.85) * st * 2.0 + vec3(0.4, 0.3, 0.9) * fres * 0.3; return; }
  vec3 deep = mix(vec3(0.012, 0.016, 0.07), neb, 0.55);                                   // the hull: deep navy night, the nebula fainter than on the sails
  base = mix(base * 0.3, deep * (0.6 + 0.6 * lum), 0.85);
  if (NS_ROLE == 7.0) base = neb * 0.3;
  emit += deep * 0.3 + vec3(1.0, 0.95, 0.85) * st * 2.4 + vec3(0.45, 0.35, 1.0) * fres * 0.5;
}`;
const S = { id: 'celestial', glsl: GLSL };

function star5(r0, r1, depth) { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r1 : r0; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.4, bevelSize: r1 * 0.25, bevelSegments: 1 }); g.translate(0, 0, -depth / 2); return g; }
function geos(ud, q) {
  const low = q === 'low', F = frame(ud), P = new Parts(), PL = new Parts(), POLE = new Parts(), GOLD = 0xffcd77, SILVER = 0xe8eeff;
  const [fx, fy, fz] = F.fig.p;
  // crescent moon figurehead (silver), facing forward-out, with a gold star at its tip
  P.add(new THREE.TorusGeometry(1.55, 0.42, low ? 6 : 10, low ? 14 : 24, Math.PI * 1.25), { p: [0, fy + 1.6, fz + 1.0], r: [0, Math.PI / 2, Math.PI * 0.62], s: [1, 1, 0.75], color: SILVER, fx: 1 });
  P.add(star5(0.55, 0.24, 0.18), { p: [0, fy + 3.1, fz + 1.7], r: [0, Math.PI / 2, 0], color: GOLD, fx: 2 });
  // gold star lanterns on the rails
  const N = low ? 3 : 5;
  for (let i = 0; i < N; i++) { const t = 0.36 + i / (N - 1) * 0.46, z = F.zAt(t), y = F.railY(t) + 0.45, x = F.halfW(t) * 1.04;
    P.mirror(sx => { P.add(new THREE.CylinderGeometry(0.07, 0.09, 0.7, 5), { p: [sx * x, y - 0.35, z], color: GOLD, fx: 1 });
      P.add(new THREE.OctahedronGeometry(0.24, 0), { p: [sx * x, y + 0.15, z], s: [1, 1.4, 1], color: 0xfff0c0, fx: 2 }); }); }
  // stern: gold sun-and-moon disc on the taffrail
  P.add(new THREE.TorusGeometry(0.9, 0.13, 6, low ? 12 : 20), { p: [0, 5.6, F.zAt(0.0) - 0.42], color: GOLD, fx: 1 });
  P.add(new THREE.CircleGeometry(0.82, low ? 10 : 16), { p: [0, 5.6, F.zAt(0.0) - 0.47], r: [0, Math.PI, 0], color: 0x1a1a5a, fx: 3 });
  // planets (orbit the main mast: their own mesh, turned on the shared clock)
  const seg = low ? 8 : 14;
  PL.add(new THREE.IcosahedronGeometry(1.1, low ? 1 : 2), { p: [8.5, 14, 0], color: 0xe0582a, fx: 0 });
  PL.add(new THREE.IcosahedronGeometry(0.75, low ? 1 : 2), { p: [-6.2, 17.5, 5.2], color: 0x3ac86a, fx: 0 });
  PL.add(new THREE.SphereGeometry(0.85, seg, seg - 4), { p: [-2.5, 11.5, -8.2], color: 0xf2c24a, fx: 1 });
  PL.add(new THREE.TorusGeometry(1.45, 0.1, 4, seg * 2), { p: [-2.5, 11.5, -8.2], r: [1.2, 0.3, 0], s: [1, 1, 0.3], color: 0xffe8b0, fx: 2 });
  // big gold star on the flag pole top
  POLE.add(star5(1.1, 0.48, 0.3), { p: [0, 1.2, 0], color: GOLD, fx: 2 });
  // glows: stardust round the hull + sails (twinkle), orbiting stardust, star lantern halos, the pole star corona
  const G = [];
  const ns = low ? 12 : 26; for (let i = 0; i < ns; i++) { const t = 0.03 + hash(i) * 0.94, sx = i % 2 ? 1 : -1;
    G.push([sx * (F.halfW(t) * 1.1 + hash(i + 70) * 1.5), F.top(t) - 2 + hash(i + 50) * 14, F.zAt(t), 0.4 + hash(i + 9) * 0.45, i % 4 ? 0xfff2d0 : 0xb0c0ff, 4, hash(i + 3)]); }
  const nm = low ? 8 : 18; for (let i = 0; i < nm; i++) { const a = i / nm * 6.283, r = 5 + hash(i + 20) * 6; G.push([Math.cos(a) * r, 4 + hash(i + 30) * 16, F.zAt(0.57) + Math.sin(a) * r, 0.35 + hash(i + 7) * 0.35, 0xffd890, 1, hash(i + 11)]); }
  G.push([0, fy + 3.1, fz + 1.7, 2.2, 0xffd890, 3, 0.4], [0, fy + 1.6, fz + 1.0, 3.2, 0xb8c8ff, 3, 0.7]);
  return { parts: P.build(), planets: PL.build(), pole: POLE.build(), glow: G };
}

export function celestialPartsOverride(ship, ctx) {
  const q = ctx.quality, G = cached('celestial', ctx.ud, q, () => geos(ctx.ud, q)), F = frame(ctx.ud), pm = partsMat(S, q);
  dressShip(ship, ctx, S, { outline: 0x0a0a2a, glow: 0xffe0a0, rope: 0xb89a5a });
  addParts(ctx, G.parts, pm, { outline: 0.04 });
  const orbit = new THREE.Group(); orbit.position.set(0, 0, F.zAt(0.57)); ctx.add(orbit);
  const pl = addParts(ctx, G.planets, pm, { parent: orbit, outline: 0 }); const ph = Math.random() * 6.28;
  if (pl) pl.onBeforeRender = () => { pl.rotation.y = wind.uTime.value * 0.22 + ph; };   // cheap: no allocation, shared clock
  const pole = ctx.base.flagPole;
  if (pole) { const knob = pole.children.find(o => o.isMesh && o.geometry?.type === 'SphereGeometry'), top = knob ? knob.position.y : 4.4;
    const holder = new THREE.Group(); holder.position.set(0, top, 0); ctx.add(holder, pole);
    const st = addParts(ctx, G.pole, pm, { parent: holder, outline: 0 }); if (st) st.onBeforeRender = () => { st.rotation.y = wind.uTime.value * 0.6 + ph; };
    glows(ctx, 'celestial-pole' + q, [[0, 1.2, 0, 3.4, 0xffd890, 3, 0.2], [0, 1.2, 0, 1.6, 0xffffff, 4, 0.5]], { parent: holder }); }
  glows(ctx, 'celestial' + q + ctx.len.toFixed(1), G.glow, { center: [0, F.zAt(0.57)] });
  dimLights(ship, 0.45);
  signatureWake(ship, ctx, { c0: 0xfff0b0, c1: 0xffa830, n: 70, size: 420, rise: 1.6 });
  liftRig(ctx, { lift: 0.6, sx: 1.12, sy: 1.26, sz: 1.12 });
}
CELESTIAL.partsOverride = celestialPartsOverride;
export default CELESTIAL;
