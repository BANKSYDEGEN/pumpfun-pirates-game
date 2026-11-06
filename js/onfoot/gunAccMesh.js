// [Emerly gunacc / v332] BANKSY t1747u: rich multi-part pirate-craft attachments on the held musket
// (frame: butt = origin, barrel +Z, muzzle = musketMuzzle(id)). Shared geos/materials → tiny draw cost.
import * as THREE from 'three';
import { toon } from '../toon.js';
import { musketMuzzle } from './swords.js';

let M = null, built = null;
const init = () => {
  if (M) return;
  M = {
    brass: toon(0xc9a24a, null, { key: 'gunacc-brass' }),
    brassHot: toon(0xe8c76a, null, { key: 'gunacc-brass2', emissive: 0x3a2a00, emissiveIntensity: 0.18 }),
    steel: toon(0xcfd6de, null, { key: 'gunacc-steel' }),
    steelEdge: toon(0xe8eef4, null, { key: 'gunacc-steel2' }),
    iron: toon(0x3a3a40, null, { key: 'gunacc-iron' }),
    leather: toon(0x4a2e18, null, { key: 'gunacc-leather' }),
    leatherDk: toon(0x2a1a10, null, { key: 'gunacc-leather2' }),
    ivory: toon(0xe8dcc0, null, { key: 'gunacc-ivory' }),
    ivory2: toon(0xd4c4a0, null, { key: 'gunacc-ivory2' }),
    mahogany: toon(0x6b3a1e, null, { key: 'gunacc-mahog' }),
    glass: toon(0x3ecfb0, null, { key: 'gunacc-glass', emissive: 0x0a4a3a, emissiveIntensity: 0.55 }),
    glassR: toon(0x7ad0ff, null, { key: 'gunacc-glass2', emissive: 0x0a3050, emissiveIntensity: 0.45 }),
  };
  built = { scope: null, bayonet: null, stock: null, horn: null };
};

function grp() { const g = new THREE.Group(); g.userData.gunacc = true; return g; }
function add(g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.userData.gunacc = true; g.add(o); return o;
}

function makeScope() {
  const g = grp();
  // two iron clamp rings + risers straddling the barrel
  for (const z of [-0.12, 0.12]) {
    add(g, new THREE.TorusGeometry(0.032, 0.007, 6, 12), M.iron, 0, 0, z, Math.PI / 2, 0, 0);
    add(g, new THREE.BoxGeometry(0.018, 0.028, 0.014), M.iron, 0, 0.028, z);
  }
  // stepped 3-stage brass spyglass tube
  add(g, new THREE.CylinderGeometry(0.018, 0.022, 0.14, 10).rotateX(Math.PI / 2), M.brass, 0, 0.048, -0.02);
  add(g, new THREE.CylinderGeometry(0.022, 0.028, 0.12, 10).rotateX(Math.PI / 2), M.brassHot, 0, 0.048, 0.1);
  add(g, new THREE.CylinderGeometry(0.028, 0.034, 0.06, 10).rotateX(Math.PI / 2), M.brass, 0, 0.048, 0.19); // objective bell
  add(g, new THREE.TorusGeometry(0.036, 0.006, 5, 12), M.brassHot, 0, 0.048, 0.22, Math.PI / 2, 0, 0);
  // knurled eyepiece cuff + glass lenses
  add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10).rotateX(Math.PI / 2), M.brassHot, 0, 0.048, -0.1);
  add(g, new THREE.CircleGeometry(0.015, 10), M.glassR, 0, 0.048, -0.116);
  add(g, new THREE.CircleGeometry(0.026, 10), M.glass, 0, 0.048, 0.222);
  return g;
}

function makeBayonet() {
  const g = grp();
  // heavy iron muzzle socket collar
  add(g, new THREE.CylinderGeometry(0.038, 0.04, 0.08, 10).rotateX(Math.PI / 2), M.iron, 0, 0, 0);
  add(g, new THREE.TorusGeometry(0.042, 0.006, 5, 12), M.steel, 0, 0, 0.04, Math.PI / 2, 0, 0);
  // S-quillon crossguard
  add(g, new THREE.BoxGeometry(0.12, 0.014, 0.018), M.steel, 0, -0.01, 0.05);
  add(g, new THREE.SphereGeometry(0.012, 6, 4), M.steel, 0.06, -0.01, 0.05);
  add(g, new THREE.SphereGeometry(0.012, 6, 4), M.steel, -0.06, -0.01, 0.05);
  // offset shank below bore + tapered triangular blade
  add(g, new THREE.BoxGeometry(0.016, 0.02, 0.1), M.steel, 0, -0.028, 0.12);
  const blade = new THREE.ConeGeometry(0.018, 0.42, 3); blade.rotateX(Math.PI / 2);
  add(g, blade, M.steelEdge, 0, -0.032, 0.34);
  // bright edge bevel strip
  add(g, new THREE.BoxGeometry(0.004, 0.01, 0.36), M.steelEdge, 0.01, -0.032, 0.32);
  return g;
}

function makeStock() {
  const g = grp();
  // stitched oiled-leather cheek wrap around buttstock
  add(g, new THREE.BoxGeometry(0.075, 0.14, 0.1), M.leather, 0, 0.01, 0.04);
  add(g, new THREE.BoxGeometry(0.08, 0.04, 0.11), M.leatherDk, 0, 0.07, 0.04); // comb pad
  // lace ridges
  for (let i = 0; i < 4; i++) add(g, new THREE.BoxGeometry(0.082, 0.008, 0.01), M.leatherDk, 0, -0.04 + i * 0.04, 0.09);
  // brass tacks / rivets
  for (const [x, y] of [[0.03, 0.05], [-0.03, 0.05], [0.03, -0.02], [-0.03, -0.02], [0, 0.08]]) {
    add(g, new THREE.SphereGeometry(0.007, 5, 4), M.brass, x, y, 0.09);
  }
  // curved burnished brass buttplate + sling swivel
  add(g, new THREE.BoxGeometry(0.08, 0.15, 0.018), M.brassHot, 0, 0, -0.02, -0.15);
  add(g, new THREE.TorusGeometry(0.018, 0.004, 5, 10), M.brass, 0, -0.06, -0.01, Math.PI / 2, 0, 0);
  return g;
}

function makeHorn() {
  const g = grp();
  // multi-segment curved ivory horn (approximated with tapered cylinders angled)
  add(g, new THREE.CylinderGeometry(0.018, 0.028, 0.1, 8), M.ivory, 0.02, 0, -0.05, 0.4, 0, 0.5);
  add(g, new THREE.CylinderGeometry(0.028, 0.034, 0.09, 8), M.ivory2, 0.05, -0.02, 0.02, 0.55, 0, 0.35);
  add(g, new THREE.CylinderGeometry(0.034, 0.022, 0.08, 8), M.ivory, 0.07, -0.04, 0.08, 0.7, 0, 0.2);
  // mahogany end-cap finial + engraved brass band + pouring nozzle
  add(g, new THREE.SphereGeometry(0.022, 8, 6), M.mahogany, 0.01, 0.01, -0.1);
  add(g, new THREE.TorusGeometry(0.03, 0.005, 5, 10), M.brass, 0.05, -0.02, 0.02, 0.5, 0, 0.35);
  add(g, new THREE.CylinderGeometry(0.008, 0.014, 0.04, 6), M.brassHot, 0.08, -0.055, 0.12, 0.8, 0, 0.15);
  // leather sling straps
  add(g, new THREE.BoxGeometry(0.012, 0.008, 0.16), M.leatherDk, 0.01, 0.03, 0.02, 0.2, 0, 0.3);
  add(g, new THREE.BoxGeometry(0.012, 0.008, 0.14), M.leather, 0.03, -0.05, 0.04, -0.15, 0, 0.25);
  return g;
}

function cloneAcc(kind) {
  init();
  if (!built[kind]) {
    built[kind] = kind === 'scope' ? makeScope() : kind === 'bayonet' ? makeBayonet()
      : kind === 'stock' ? makeStock() : makeHorn();
  }
  return built[kind].clone(true);
}

/** Attach fitted accessories onto musket mesh `m`. Returns `m`. */
export function accMeshes(m, acc, id) {
  init();
  const mz = musketMuzzle(id), L = Math.max(0.6, mz.z || 1.38), y = mz.y || 0.06;
  if (acc?.scope) { const o = cloneAcc('scope'); o.position.set(0, y + 0.01, L * 0.55); m.add(o); }
  if (acc?.bayonet) { const o = cloneAcc('bayonet'); o.position.set(0, y - 0.01, L + 0.02); m.add(o); }
  if (acc?.stock) { const o = cloneAcc('stock'); o.position.set(0, -0.01, 0.02); m.add(o); }
  if (acc?.horn) { const o = cloneAcc('horn'); o.position.set(0.02, y - 0.06, L * 0.28); m.add(o); }
  return m;
}

/** Standalone attachment group for gearThumbs / shop cards (no musket parent). */
export function accThumbMesh(slot) {
  init();
  return cloneAcc(slot === 'scope' || slot === 'bayonet' || slot === 'stock' || slot === 'horn' ? slot : 'scope');
}

/** [weapon-sync] remove fitted accessories from musket mesh `m` (clones share geometry + materials: nothing to dispose). */
export function stripAccMeshes(m) {
  if (!m) return m;
  for (let i = m.children.length - 1; i >= 0; i--) if (m.children[i].userData?.gunacc) m.remove(m.children[i]);
  return m;
}
