// [Emerly gunacc] the GUN ACCESSORIES on a held musket (musket frame: butt = origin, barrel +Z, muzzle = musketMuzzle(id)). Simple shapes,
// shared geometry + materials; js/onfoot/battle.js adds them to YOUR musket in the MUSKET RANGE.
import * as THREE from 'three';
import { toon } from '../toon.js';
import { musketMuzzle } from './swords.js';
let M = null, G = null;
const init = () => { if (M) return;
  M = { brass: toon(0xc9a24a, null, { key: 'gunacc-brass' }), steel: toon(0xcfd6de, null, { key: 'gunacc-steel' }), wood: toon(0x7a4a24, null, { key: 'gunacc-wood' }), horn: toon(0xe8dcc0, null, { key: 'gunacc-horn' }) };
  G = { scope: new THREE.CylinderGeometry(0.022, 0.026, 0.34, 10).rotateX(Math.PI / 2), bayonet: new THREE.ConeGeometry(0.014, 0.34, 4).rotateX(Math.PI / 2), pad: new THREE.BoxGeometry(0.06, 0.13, 0.03), horn: new THREE.ConeGeometry(0.035, 0.16, 8).rotateZ(Math.PI / 2) }; };
export function accMeshes(m, acc, id) { init(); const mz = musketMuzzle(id), L = Math.max(0.6, mz.z || 1.38), y = mz.y || 0.06;
  const add = (g, mt, x, yy, z) => { const o = new THREE.Mesh(g, mt); o.position.set(x, yy, z); o.userData.gunacc = true; m.add(o); };
  if (acc.scope) add(G.scope, M.brass, 0, y + 0.035, L * 0.55);
  if (acc.bayonet) add(G.bayonet, M.steel, 0, y - 0.03, L + 0.15);
  if (acc.stock) add(G.pad, M.wood, 0, 0, -0.012);
  if (acc.horn) add(G.horn, M.horn, 0.06, -0.04, L * 0.3);
  return m; }
