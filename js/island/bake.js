// [Raul] PUMPFUN PIRATES island lobby: "bake" a moored ship for the lobby. A sailing ship is ~40-46 draw calls
// (trait parts, rigging, outlines...); tied up at the dock nothing but the flag, the crew and the water lid moves,
// so every plain static mesh is merged per material (in ship space) under the ship root. Same look, ~1/3 the calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4();
export function bakeShip(ship) {
  ship.updateMatrixWorld(true); _inv.copy(ship.matrixWorld).invert();
  const flag = ship.userData.flag, groups = new Map();
  ship.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || !o.visible || o === flag || Array.isArray(o.material)) return;
    if (o.userData.waterMask || o.morphTargetInfluences) return;
    let p = o, hidden = false; while (p && p !== ship) { if (!p.visible) hidden = true; p = p.parent; } if (hidden) return;
    const mat = o.material;
    if (mat.isShaderMaterial || mat.isRawShaderMaterial) return; // crew + custom fx keep their own shaders
    if (mat.onBeforeCompile && mat.onBeforeCompile.toString() !== THREE.Material.prototype.onBeforeCompile.toString() && !o.userData.outline && mat.customProgramCacheKey?.() !== 'sail') return; // custom vertex fx stay put (sails are fine: their ripple is uv-driven along z, and square sails face fore-aft)
    const g = o.geometry, sig = Object.keys(g.attributes).sort().join(',') + (g.index ? '|i' : '|n');
    const key = mat.uuid + '|' + sig + '|' + o.renderOrder + '|' + o.castShadow + o.receiveShadow;
    if (!groups.has(key)) groups.set(key, { mat, list: [], ro: o.renderOrder, cs: o.castShadow, rs: o.receiveShadow, outline: !!o.userData.outline });
    _m.multiplyMatrices(_inv, o.matrixWorld);
    const c = g.clone(); for (const k of Object.keys(c.morphAttributes)) delete c.morphAttributes[k]; c.applyMatrix4(_m);
    groups.get(key).list.push(c); (groups.get(key).objs ||= []).push(o);
  });
  let before = 0, after = 0; ship.traverse(o => { if (o.isMesh && o.visible) before++; });
  for (const [, gr] of groups) {
    if (gr.list.length < 2) { gr.list.forEach(x => x.dispose()); gr.skip = true; continue; }
    const g = mergeGeometries(gr.list, false); gr.list.forEach(x => x.dispose()); if (!g) { gr.skip = true; continue; }
    const m = new THREE.Mesh(g, gr.mat); m.renderOrder = gr.ro; m.castShadow = gr.cs; m.receiveShadow = gr.rs; m.userData.outline = gr.outline; m.userData.baked = true;
    ship.add(m); gr.mesh = m;
  }
  for (const [, gr] of groups) if (!gr.skip) for (const o of gr.objs) o.visible = false; // the originals stay in the graph (crew / lid code may look them up)
  ship.traverse(o => { if (o.isMesh && o.visible) after++; });
  ship.userData.baked = { before, after };
  return ship;
}
