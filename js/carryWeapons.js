// [Raul carry] BANKSY 12:02 PM (via Emerly): "if they have a sword item it's carried in their no hook hand & if they have a musket it is on
// their back, make sure didn't overlap with jacket or cape". ON FOOT ONLY (ships draw nothing new: ship perf unchanged), v5 bodies, never crews.
//  - sword: in the hand WITHOUT the hook (no hook = right hand), rides the forearm bone (same grip frame as the SWORD PIT), hidden while you swim.
//  - musket: slung diagonally across the back (muzzle up over the RIGHT shoulder, away from the parrot on the left), rides the spine. Its
//    distance off the back is MEASURED from what you wear (body + coat / outfit + cape + Timothy's gear mesh, bind space) along the sling
//    line, so every jacket and cape gets its own lift automatically (no table to keep in sync); re-measured when your items change.
//  - in the SWORD PIT / MUSKET RANGE the arena dresses its own weapon in your hands: js/onfoot/battle.js calls carryArmed() and the carried
//    copy hides (the musket "moves to the hands" while you aim / fire). No aim code is touched.
//  - what you carry: gear.carrySword / gear.carryMusket (ids from js/onfoot/swords.js SWORD_IDS / MUSKET_IDS), synced to other players as
//    two more digits of 'gr' (js/pirateGear.js gearToWire). Fed by YOUR profile's WEAPON STORE pick, or by an inventory through
//    setCarriedWeapons() (js/pirateGear.js: Post's post/inventory-fish can call it with the ids it shows).
// Cost: one mesh per weapon (shared geometry, the game's hi / lo weapon GLB), + an ink shell on desktop only; no shadows on phone.
import * as THREE from 'three';
import { swordGeo, musketGeo, musketMuzzle, loadWeaponModels, SWORD_IDS, MUSKET_IDS } from './onfoot/swords.js';
import { toon } from './toon.js';
import { carryHand, carryShows } from './carryRules.js';

export const CARRY = {
  sword: { at: 0.15, scale: 0.8, down: 0.95, out: 0.25 },       // grip along the forearm (world m), blade length scale, blade tilt down (rad) from the forearm's normal, and outwards
  musket: { scale: 0.55, tilt: 0.85, y: 0.64, clear: 0.012, half: 0.028, maxTilt: 0.7 },   // world scale, sling angle from vertical (rad), centre height (of the bind height), clearance + half thickness (bind m)
};
export const carryIds = { sword: SWORD_IDS, musket: MUSKET_IDS };
const _mat = { m: null, g: null, s: null };
function mats() {
  if (!_mat.m) {
    _mat.m = toon(0xffffff, null, { vertexColors: true, key: 'carry-weapons' });
    _mat.g = toon(0xffffff, null, { vertexColors: true, emissive: 0x6b4a00, emissiveIntensity: 0.55, key: 'carry-gold' });
    _mat.s = new THREE.MeshBasicMaterial({ color: 0x161616, side: THREE.BackSide });
    _mat.s.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.016;'); };
  }
  return _mat;
}
function weaponMesh(geo, low, gold) { const M = mats(), m = new THREE.Mesh(geo, gold ? M.g : M.m); m.name = 'carry-weapon'; m.castShadow = !low; m.userData.carry = true;
  if (!low) { const o = new THREE.Mesh(geo, M.s); o.userData.outline = true; m.add(o); } return m; }
const boneOf = (body, n) => body.skeleton.bones.find((b) => b.name === n) || null;
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// battle.js hook: the arena has its own weapon in your hands (pit: sword, range: musket) -> hide the carried copy. obj = any object of the pirate.
export function carryArmed(obj, sword, musket) {
  let o = obj; while (o && !o.userData?.carryState) o = o.parent;
  if (!o) { obj?.traverse?.((c) => { if (!o && c.userData?.carryState) o = c; }); }
  const st = o?.userData.carryState; if (st) { st.armedSword = !!sword; st.armedMusket = !!musket; }
}

// called by js/pirateGear.js dress() for every dress of a PirateGLB p (cheap when nothing changed)
export function syncCarry(p, gear, body) {
  if (!p?.v5 || p.forCrew || !body?.skeleton) return;
  const sw = SWORD_IDS.includes(gear?.carrySword) ? gear.carrySword : null, mu = MUSKET_IDS.includes(gear?.carryMusket) ? gear.carryMusket : null;
  const hand = carryHand(gear);   // the hand WITHOUT the hook (no hook: right)
  const key = [sw, mu, hand].join('|'); const st = p.carry || (p.carry = { key: '', sword: null, musket: null, armedSword: false, armedMusket: false, sig: '', t: 0 });
  body.userData.carryState = st; if (p.scene) p.scene.userData.carryState = st;
  if (st.key === key) return; st.key = key; const low = p.lod === 'lo';
  if (sw || mu) loadWeaponModels(low);
  if (st.sword) { st.sword.removeFromParent(); st.sword = null; }
  if (st.musket) { st.musket.removeFromParent(); st.musket = null; }
  if (sw) { const fb = boneOf(body, 'forearm' + hand); if (fb) { const m = weaponMesh(swordGeo(sw), low, sw === 'blade_gold'); m.visible = false; m.userData.side = hand; fb.add(m); st.sword = m; st.swordPlaced = false; } }
  if (mu) { const sb = boneOf(body, 'spine'); if (sb) { const m = weaponMesh(musketGeo(mu), low, false); m.visible = false; m.userData.id = mu; sb.add(m); st.musket = m; st.sig = ''; } }
  st.body = body; p.addPost?.('carry', carryPost, 4);
}

// the sword in the hand: the SWORD PIT's grip frame (forearm -X = towards the hand), the blade turned down + forward
function placeSword(st) {
  const m = st.sword, fb = m.parent; fb.updateWorldMatrix(true, false); fb.getWorldScale(_s); const k = 1 / Math.max(1e-3, _s.x), C = CARRY.sword, L = m.userData.side === 'L';
  const sx = L ? 1 : -1;   // the forearm points at the hand along -X (right) / +X (left: mirrored bone)
  m.scale.setScalar(C.scale * k); m.position.set(sx * C.at * k, 0, 0);
  const blade = new THREE.Vector3(sx * Math.sin(C.down), C.out, Math.cos(C.down)).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), blade); st.swordPlaced = true;
}
// the musket on the back: bind space (y up, +z front) -> spine bone space (L = boneInverse * bindMatrix * D), lifted off whatever you wear
function placeMusket(st) {
  const body = st.body, m = st.musket, sb = m.parent, sk = body.skeleton, bi = sk.boneInverses[sk.bones.indexOf(sb)]; if (!bi) return;
  const g = body.geometry; if (!g.boundingBox) g.computeBoundingBox(); const H = g.boundingBox.max.y - g.boundingBox.min.y, C = CARRY.musket;
  const s = C.scale * H / 1.75, len = musketMuzzle(m.userData.id).z * s;
  const dir = new THREE.Vector3(-Math.sin(C.tilt), Math.cos(C.tilt), 0);   // muzzle up over the right shoulder (-x), butt at the left hip
  const cy = g.boundingBox.min.y + C.y * H, butt = new THREE.Vector3(0, cy, 0).addScaledVector(dir, -len / 2);
  // the back's furthest point (min z) in 12 bins along the sling line, over the body + every item / gear mesh it wears (not pets, not the
  // parrot), then the musket is laid on a straight line just outside all of them (it may tilt: butt on the lower back, muzzle over the hair)
  const NB = 12, zb = new Array(NB).fill(0), meshes = []; body.parent.traverse((o) => { if (o.isSkinnedMesh && !/^pet/.test(o.name) && !o.userData.carry) meshes.push(o); });
  for (const o of meshes) { const P = o.geometry.attributes.position, B = o.geometry.attributes.aBird; if (!P) continue;
    for (let i = 0; i < P.count; i++) { if (B && B.getX(i) > 0.5) continue; const z = P.getZ(i); if (z > -0.02) continue;
      const x = P.getX(i) - butt.x, y = P.getY(i) - butt.y, t = (x * dir.x + y * dir.y) / len; if (t < 0 || t > 1) continue;
      const dx = x - dir.x * t * len, dy = y - dir.y * t * len; if (dx * dx + dy * dy > 0.0025) continue; const k = Math.min(NB - 1, (t * NB) | 0); if (z < zb[k]) zb[k] = z; } }
  const need = zb.map((z) => z - C.clear - C.half), tk = need.map((_, k) => (k + 0.5) / NB);
  let ia = 0, ib = NB - 1; for (let k = 0; k < NB / 2; k++) if (need[k] < need[ia]) ia = k; for (let k = NB / 2; k < NB; k++) if (need[k] < need[ib]) ib = k;
  let slope = (need[ib] - need[ia]) / (tk[ib] - tk[ia]); slope = Math.max(-C.maxTilt * len, Math.min(C.maxTilt * len, slope));
  let z0 = need[ia] - slope * tk[ia]; let v = 0; for (let k = 0; k < NB; k++) v = Math.max(v, z0 + slope * tk[k] - need[k]); z0 -= v;
  const zMin = z0, dir3 = new THREE.Vector3(dir.x * len, dir.y * len, slope).normalize();
  const Xg = new THREE.Vector3(0, 0, -1).addScaledVector(dir3, dir3.z).normalize(), Zg = dir3, Yg = new THREE.Vector3().crossVectors(Zg, Xg);
  const D = new THREE.Matrix4().makeBasis(Xg, Yg, Zg).scale(_v.setScalar(s)); D.setPosition(butt.x, butt.y, z0);
  _m.copy(bi).multiply(body.bindMatrix).multiply(D); _m.decompose(m.position, m.quaternion, m.scale);
  st.zMin = zMin;
}
function carryPost(dt) {
  const st = this.carry; if (!st || !st.body) return;
  const show = carryShows({ onFoot: this.footSpeed !== undefined, state: this.footState, armedSword: st.armedSword, armedMusket: st.armedMusket });   // footSpeed: set by js/onfoot/pirate.js each frame (ships never)
  if (st.sword) { if (!st.swordPlaced) placeSword(st); st.sword.visible = show.sword; }
  if (st.musket) {
    if ((st.t -= dt) <= 0) { st.t = 0.5; let sig = ''; st.body.parent.traverse((o) => { if (o.isSkinnedMesh && !o.userData.carry) sig += o.id + ','; }); if (sig !== st.sig) { st.sig = sig; placeMusket(st); } }
    st.musket.visible = show.musket;
  }
}
