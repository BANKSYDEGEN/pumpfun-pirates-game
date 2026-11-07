// [clothes-aaa] BANKSY t232u "Make sure has good lighting": the walk-in CLOTHES SHOP's painted light (no realtime lights, no textures, no
// new draw calls). The shop's own copy of the plaza toon material + the blank V7 mannequin material + its garment clones get:
//   - a warm interior fill (an emissive share of the surface colour, so the room reads bright even where the roof's sun shadow lands)
//   - soft downward pools (per pixel) over the window plinths, the dais, the racks, the cabinet, the mirror, the table and the counter
//   - a broad glow round each of the three chandeliers
// Only inside the room box (building frame, below the ceiling): the facade, awning and street keep the plaza look. Phones get it too
// (one 16-lamp loop per area, on the shop's surfaces only). &clothesfx=0 = off.
import * as THREE from 'three';

const Q = typeof location !== 'undefined' ? location.search : '';
export const CLOTHES_LOOK_ON = !/[?&]clothesfx=0(&|$)/.test(Q);
const NL = 16;   // lamps per area: the pixel loops over its own area's bank only (x < 0 = Clothing, x > 0 = Accessories)
// [outfit-store] Clothes + Accessories = one building (js/island/outfitStore.js): three building frame (x across, y up, z toward the
// street; front wall inner face z = 5.5, back wall inner face z = -11.5, the middle wall x -0.5 .. 0.5)
// [x, y, z, k]: k > 0 = a downward pool of strength k; k < 0 = a broad glow of radius -k
export const CLOTHES_LAMPS = [
  [-8.05, 4.3, 4.35, 1.25], [-1.95, 4.3, 4.35, 1.25],        // window plinths
  [-5, 4.5, -1.0, 1.5],                                       // the dais
  [-8.3, 4.3, 1.4, 1.0], [-8.3, 4.3, -4.5, 1.0],              // left racks
  [-1.7, 4.3, 1.4, 1.0], [-1.7, 4.3, -6.5, 1.05],             // cabinet, triple mirror (on the middle wall)
  [-5, 4.5, -4.6, 1.15],                                      // centre table
  [-5, 4.5, -9.0, 1.45], [-5, 4.3, -10.9, 0.9],               // the counter + the bolt shelves behind
  [-8.4, 4.3, -10.4, 0.8], [-1.4, 4.3, -9.9, 0.8],            // fitting booth, boot stand
  [-1.0, 4.0, -2.7, 0.7],                                     // the archway
  [-5, 3.85, 2.0, -6.5], [-5, 3.85, -3.4, -6.5], [-5, 3.85, -8.2, -6.5],   // the chandeliers
];
export const ACC_LAMPS = [
  [1.95, 4.3, 4.35, 1.25], [8.05, 4.3, 4.35, 1.25],          // window busts
  [2.7, 4.4, 0.4, 1.1], [7.3, 4.4, 0.4, 1.1], [2.7, 4.4, -4.4, 1.1], [7.3, 4.4, -4.4, 1.1],   // the four vitrines
  [9.2, 4.3, 1.5, 1.0], [9.2, 4.3, -3.2, 1.0], [9.2, 4.3, -6.9, 0.95],   // hat wall, capes, vanity
  [0.8, 4.3, 2.1, 1.0], [0.8, 4.3, -6.7, 0.9],               // eyewear board, grills cabinet (on the middle wall)
  [5, 4.5, -9.0, 1.45], [5, 4.3, -10.9, 0.9],                 // the counter + the hat-box shelves behind
  [5, 3.85, 2.0, -6.5], [5, 3.85, -3.4, -6.5], [5, 3.85, -8.2, -6.5],   // the chandeliers
];
const BANKS = [CLOTHES_LAMPS, ACC_LAMPS].map(L => { const v = L.slice(0, NL).map(l => new THREE.Vector4(...l)); while (v.length < NL) v.push(new THREE.Vector4(0, -50, 0, 1e-4)); return v; });
export const CL_U = {
  uClOn: { value: 0 }, uClW2B: { value: new THREE.Matrix4() }, uClL: { value: [...BANKS[0], ...BANKS[1]] },
  uClRoom: { value: new THREE.Vector4(-9.65, -11.65, 9.65, 5.75) }, uClCeil: { value: 5.3 },
  uClBase: { value: 1.0 }, uClFill: { value: 0.32 }, uClWarm: { value: new THREE.Color(1.0, 0.8, 0.56) },
};
const VDECL = '\nuniform mat4 uClW2B; varying vec3 vClP;';
const VMAIN = `
{ vec4 cw = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  cw = instanceMatrix * cw;
#endif
  cw = modelMatrix * cw; vClP = (uClW2B * cw).xyz; }`;
const FDECL = `
uniform float uClOn; uniform vec4 uClL[${NL * 2}]; uniform vec4 uClRoom; uniform float uClCeil; uniform float uClBase; uniform float uClFill; uniform vec3 uClWarm; varying vec3 vClP;`;
const FMAIN = `
if (uClOn > 0.5) {
  vec3 cp = vClP;
  if (cp.x > uClRoom.x && cp.x < uClRoom.z && cp.z > uClRoom.y && cp.z < uClRoom.w && cp.y < uClCeil) {
    vec3 cn = normalize(cross(dFdx(cp), dFdy(cp)));
    float acc = 0.0;
    int b0 = cp.x < 0.0 ? 0 : ${NL};
    for (int i = 0; i < ${NL}; i++) { vec4 L = uClL[b0 + i]; vec3 d = L.xyz - cp; float r2 = max(dot(d, d), 0.04); float ir = inversesqrt(r2);
      float lam = 0.45 + 0.55 * max(dot(cn, d * ir), 0.0);
      if (L.w > 0.0) acc += L.w * smoothstep(0.42, 0.92, d.y * ir) * lam / (1.0 + 0.16 * r2);
      else { float f = max(1.0 - sqrt(r2) / -L.w, 0.0); acc += 0.42 * f * f * lam; } }
    vec3 lit = uClWarm * acc;
    diffuseColor.rgb *= uClBase + 0.55 * lit;
    totalEmissiveRadiance += diffuseColor.rgb * (uClFill + 0.35 * lit);
  }
}
`;
// patch one material (already patched by libMaterial / the mannequin cut): chained onBeforeCompile + cache key
export function clothesSurface(mat) {
  if (!CLOTHES_LOOK_ON || !mat || mat.userData.clothesLook) return mat;
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey ? mat.customProgramCacheKey.bind(mat) : () => '';
  mat.onBeforeCompile = (s, r) => { if (base) base.call(mat, s, r); Object.assign(s.uniforms, CL_U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>' + VDECL).replace('#include <begin_vertex>', '#include <begin_vertex>' + VMAIN);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + FDECL).replace('#include <emissivemap_fragment>', FMAIN + '#include <emissivemap_fragment>'); };
  mat.customProgramCacheKey = () => key() + '_clothes';
  mat.userData.clothesLook = true; mat.needsUpdate = true;
  return mat;
}
// once the shop is placed: world -> building frame (the shop LOD's world matrix; the plaza never moves)
export function clothesLookSetup(lod) {
  if (!CLOTHES_LOOK_ON || !lod) return;
  const W = CL_U.uClW2B.value, set = () => { W.copy(lod.matrixWorld).invert(); CL_U.uClOn.value = 1; };
  lod.updateWorldMatrix(true, false); set();
  for (const l of lod.levels) l.object.traverse(o => { if (o.isMesh && !o.onBeforeRender.__cl) { const prev = o.onBeforeRender; o.onBeforeRender = function (...a) { set(); return prev.apply(this, a); }; o.onBeforeRender.__cl = 1; } });   // the plaza never moves; one invert a frame
}
