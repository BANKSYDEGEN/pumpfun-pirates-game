// [Emerly] OPAL EMPEROR (concept: /workspace/prestige-concepts/P4_opal_emperor.jpg). A galleon of living opal: pearl-white hull and
// sails whose facets shift through pastel rainbow fire as the ship moves and the light changes, gold trim, a jewelled gold crown on
// the main mast, an opal prow gem, opal orbs along the rails, prism sparkles and rainbow motes orbiting the rig, a pastel prism wake.
// HULL ANIMATION (shader, shared clock): every facet's hue = facet id + view angle + a slowly drifting noise field + time, so the
// opal fire rolls along the hull; random facets flash white. Sails are crystal panels (uv-cell facets) with the same fire.
import { THREE, Parts, partsMat, addParts, glows, dressShip, frame, cached, dimLights, hash } from './kit.js';
import { liftRig, signatureWake } from '../pvpKit.js';

export const OPAL = {
  id: 'opal', name: 'OPAL EMPEROR', price: 0, premium: 'pvp', crewOutfit: 'opal', // [Emerly prestige outfits] own crew palette (js/crew.js OUTFIT.opal; was 'diamond')
  blurb: 'Living opal. Every facet burns with shifting rainbow fire. A crowned emperor of the sea.',
  palette: { seed: 211, wood: 0xe8e4f4, artBody: 0xd8d2ee, band: 0xf4f0ff, stripe: 0xffd98a, band2: 0xc8bfe8, tar: 0x8a84b0, trim: 0xffe2a0, artTrim: 0xffd27a, sail: 0xf2eeff, patch: [0xe6e0ff, 0xfff4fb], hem: 0xd8cff8, lantern: 0xfff2ff, window: 0xfff0ff, stripes: 0xe0d8ff },
  sail: { bg: '#ece8ff', badge: '#7a6ab8', lines: 'rgba(180,160,255,0.12)', border: '#ffd27a' },
  flag: { bg: '#e8e2ff', badge: '#5a4a98', border: '#ffd27a' },
  parts: { oak: 0xd8d2ee, plank: 0xe8e4f4, deck: 0xf0ecff, iron: 0x6a6490, gold: 0xffd27a, glow: 0xfff2ff },
  swatch: { hull: '#dcd6f2', band: '#c8bfe8', stripe: '#ffd27a', sail: '#ece8ff', trim: '#ffd27a', diamond: true },
};
const GLSL = `
void shipFx(inout vec3 base, inout vec3 emit, vec3 P, vec3 W, vec3 N, vec3 Nf, vec3 Rw, float fres, float lum, vec2 uv){
  vec3 V = normalize(cameraPosition - W); float ndv = abs(dot(N, V));
  float fh = nsH(floor(Nf * 3.5 + 7.0) + floor(P * 0.8));                       // facet id
  if (NS_ROLE == 2.0) fh = nsH(vec3(floor(uv.x * 5.0 + floor(uv.y * 4.0) * 0.5), floor(uv.y * 4.0), fract(uv.x * 5.0) > fract(uv.y * 4.0) ? 1.0 : 0.0)); // crystal sail panels
  float flow = nsF(P * 0.21 + vec3(0.0, uNT * 0.05, uNT * 0.09));
  float h = fh * 0.42 + flow * 1.1 + ndv * 0.7 + uNT * 0.07;
  vec3 fire = nsRainbow(h), pearl = vec3(0.95, 0.93, 1.0);
  float flash = pow(0.5 + 0.5 * sin(uNT * (1.5 + fh * 2.0) + fh * 60.0), 14.0) * step(0.72, fh);
  if (NS_ROLE == 3.0) {                                                           // gold trim, polished
    emit += base * nsEnv(Rw, vec3(1.0, 0.8, 0.45)) * 0.6 + vec3(1.0, 0.85, 0.5) * fres * 0.5; base *= 0.6; return; }
  if (NS_ROLE == 6.0) { base = mix(base, pearl, 0.6) * 0.95; emit += fire * fres * 0.6; return; }  // pearl masts
  if (NS_ROLE == 4.0) { base = mix(base, pearl * 0.8, 0.35); emit += fire * fres * 0.25; return; } // cabins: pale wood
  float d = NS_ROLE == 2.0 ? 0.5 : 0.62;
  base = mix(pearl * (0.72 + 0.38 * lum), mix(pearl, fire, 0.75), d) * (NS_ROLE == 2.0 ? 0.84 : 1.0);
  emit += fire * ((NS_ROLE == 2.0 ? 0.05 : 0.16) + fres * (NS_ROLE == 2.0 ? 0.6 : 0.95)) + vec3(1.0) * flash * 1.6 + mix(vec3(1.0), fire, 0.5) * pow(max(dot(Rw, normalize(vec3(0.45, 0.75, 0.48))), 0.0), 30.0) * 0.8;
  if (NS_ROLE == 2.0) emit += fire * 0.12 * (1.0 - smoothstep(0.0, 0.06, min(fract(uv.x * 5.0 + floor(uv.y * 4.0) * 0.5), fract(uv.y * 4.0)))); // panel seams glint
}`;
const S = { id: 'opal', glsl: GLSL };

function geos(ud, q) {
  const low = q === 'low', F = frame(ud), seg = low ? 6 : 10, P = new Parts(), C = new Parts();
  const GOLD = 0xffcf6a, OPAL_C = 0xf2eeff;
  // prow: gold mount + big opal prism gem in front of the figurehead
  const [fx, fy, fz] = F.fig.p;
  P.add(new THREE.ConeGeometry(0.55, 1.1, 8, 1), { p: [fx, fy + 0.85, fz + 0.6], color: GOLD, fx: 1 });
  P.add(new THREE.OctahedronGeometry(0.95, 0), { p: [fx, fy + 1.9, fz + 0.75], s: [0.8, 1.35, 0.8], color: OPAL_C, fx: 3 });
  // opal orbs on gold posts along both rails
  const N = low ? 4 : 6;
  for (let i = 0; i < N; i++) { const t = 0.36 + i / (N - 1) * 0.46, z = F.zAt(t), y = F.railY(t) + 0.3, x = F.halfW(t) * 1.04;
    P.mirror(sx => { P.add(new THREE.CylinderGeometry(0.09, 0.12, 0.55, 6), { p: [sx * x, y - 0.25, z], color: GOLD, fx: 1 });
      P.add(new THREE.SphereGeometry(0.26, seg, Math.max(4, seg - 3)), { p: [sx * x, y + 0.2, z], color: OPAL_C, fx: 3 }); }); }
  // stern: gold finials with opal orbs on the castle corners + an opal crest on the taffrail
  P.mirror(sx => { P.add(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 8), { p: [sx * 2.3, F.railY(0.04) + 0.45, F.zAt(0.04)], color: GOLD, fx: 1 });
    P.add(new THREE.SphereGeometry(0.4, seg, Math.max(4, seg - 3)), { p: [sx * 2.3, F.railY(0.04) + 1.1, F.zAt(0.04)], color: OPAL_C, fx: 3 }); });
  P.add(new THREE.TorusGeometry(0.85, 0.12, 6, low ? 12 : 20), { p: [0, 5.6, F.zAt(0.0) - 0.42], color: GOLD, fx: 1 });
  P.add(new THREE.CircleGeometry(0.78, low ? 10 : 16), { p: [0, 5.6, F.zAt(0.0) - 0.47], r: [0, Math.PI, 0], color: OPAL_C, fx: 3 });
  // crown (built at the origin; parented to the flag pole knob)
  const R = 1.25, pts = low ? 6 : 8;
  C.add(new THREE.CylinderGeometry(R, R * 0.92, 0.7, pts * 2, 1, true), { p: [0, 0.35, 0], color: GOLD, fx: 1 });
  C.add(new THREE.TorusGeometry(R * 0.96, 0.1, 5, pts * 2), { p: [0, 0.02, 0], r: [Math.PI / 2, 0, 0], color: GOLD, fx: 1 });
  for (let i = 0; i < pts; i++) { const a = i / pts * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
    C.add(new THREE.ConeGeometry(0.26, 1.0, 4), { p: [x, 1.15, z], r: [0, -a, 0], color: GOLD, fx: 1 });
    C.add(new THREE.SphereGeometry(0.17, 6, 4), { p: [x * 1.02, 1.75, z * 1.02], color: 0xfff4d8, fx: 1 });
    C.add(new THREE.OctahedronGeometry(0.2, 0), { p: [Math.cos(a + Math.PI / pts) * R * 1.03, 0.4, Math.sin(a + Math.PI / pts) * R * 1.03], color: i % 2 ? 0xc89aff : 0x8ae6ff, fx: 2 }); }
  for (const a of [0, Math.PI / 2]) C.add(new THREE.TorusGeometry(R * 0.85, 0.09, 4, 10, Math.PI), { p: [0, 0.7, 0], r: [0, a, 0], color: GOLD, fx: 1 }); // arches
  C.add(new THREE.OctahedronGeometry(0.42, 0), { p: [0, 1.75, 0], s: [1, 1.3, 1], color: OPAL_C, fx: 3 });
  C.add(new THREE.SphereGeometry(R * 0.8, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), { p: [0, 0.2, 0], color: 0x9a6ad8, fx: 0 }); // velvet cap
  // glows: prism star sparkles on the hull / sails, rainbow motes orbiting the rig, crown + prow gem glow
  const G = [], pal = [0xffffff, 0xffd0f8, 0xc8f4ff, 0xfff0c0, 0xe0d0ff];
  const ns = low ? 10 : 22;
  for (let i = 0; i < ns; i++) { const t = 0.05 + hash(i) * 0.9, side = i % 2 ? 1 : -1, up = hash(i + 50);
    G.push([side * F.halfW(t) * 1.05, F.top(t) - 2.4 + up * 3.4, F.zAt(t), 0.55 + hash(i + 9) * 0.5, pal[i % 5], 4, hash(i + 3)]); }
  const nm = low ? 6 : 14;
  for (let i = 0; i < nm; i++) { const a = i / nm * 6.283, r = 6 + hash(i + 20) * 5; G.push([Math.cos(a) * r, 6 + hash(i + 30) * 12, F.zAt(0.57) + Math.sin(a) * r, 0.5 + hash(i + 7) * 0.4, pal[(i + 1) % 5], 1, hash(i + 11)]); }
  G.push([fx, fy + 1.9, fz + 0.75, 2.4, 0xf0d8ff, 3, 0.2]);
  return { parts: P.build(), crown: C.build(), glow: G };
}

export function opalPartsOverride(ship, ctx) {
  const q = ctx.quality, G = cached('opal', ctx.ud, q, () => geos(ctx.ud, q));
  dressShip(ship, ctx, S, { outline: 0x3a2a6a, glow: 0xfff0ff, rope: 0xd8c8a0, sail: { transparent: 0.97 } });
  const pm = partsMat(S, q);
  addParts(ctx, G.parts, pm, { outline: 0.04 });
  const pole = ctx.base.flagPole;
  if (pole) { const knob = pole.children.find(o => o.isMesh && o.geometry?.type === 'SphereGeometry'), top = knob ? knob.position.y : 4.4;
    const holder = new THREE.Group(); holder.position.set(0, top - 0.2, 0); holder.scale.setScalar(Math.max(1, ctx.len / 17.5)); ctx.add(holder, pole);
    addParts(ctx, G.crown, pm, { parent: holder, outline: 0.03 });
    glows(ctx, 'opal-crown' + q, [[0, 1.75, 0, 2.2, 0xf4e0ff, 3, 0.5], [0, 2.4, 0, 1.4, 0xffffff, 4, 0.1]], { parent: holder }); }
  glows(ctx, 'opal' + q + ctx.len.toFixed(1), G.glow, { center: [0, frame(ctx.ud).zAt(0.57)] });
  dimLights(ship, 0.4);
  signatureWake(ship, ctx, { c0: 0xffffff, c1: 0xd890ff, n: 60, size: 400, rise: 1.4 });
  liftRig(ctx, { lift: 0.6, sx: 1.12, sy: 1.26, sz: 1.12 });
}
OPAL.partsOverride = opalPartsOverride;
export default OPAL;
