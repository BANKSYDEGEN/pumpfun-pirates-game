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
import { carryHand, carryShows, holsterOn, holsterSide, swordHolstered } from './carryRules.js';
import { TINTS } from './pirateGLB.js';

export const CARRY = {
  holster: { x: 0.18, y: 0.47, z: -0.03, tilt: 0.5, out: 0.14 },   // [musket-holster] hip point (of the bind width / height), blade back + out from straight down
  sword: { at: 0.15, scale: 0.8, down: 0.95, out: 0.25 },       // grip along the forearm (world m), blade length scale, blade tilt down (rad) from the forearm's normal, and outwards
  musket: { scale: 0.55, tilt: 0.85, y: 0.64, clear: 0.012, half: 0.028, maxTilt: 0.7 },   // world scale, sling angle from vertical (rad), centre height (of the bind height), clearance + half thickness (bind m)
};
const HOLSTER_ON = holsterOn(typeof location !== 'undefined' ? location.search : '');   // &holster=0 = kill switch
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
  if (!p?.v5 || (p.forCrew && gear?.carryCrew !== 1) || !body?.skeleton) return;   // [crew-weapons] the deck bake pirate carries only crew weapons
  const sw = SWORD_IDS.includes(gear?.carrySword) ? gear.carrySword : null, mu = MUSKET_IDS.includes(gear?.carryMusket) ? gear.carryMusket : null;
  const hand = gear?.carryCrew === 1 && (gear.carryHand === 'L' || gear.carryHand === 'R') ? gear.carryHand : carryHand(gear);   // the hand WITHOUT the hook (no hook: right); crew: the CAPTAIN's
  const crew = gear?.carryCrew === 1, key = [sw, mu, hand, crew].join('|'); const st = p.carry || (p.carry = { key: '', sword: null, musket: null, armedSword: false, armedMusket: false, sig: '', t: 0 });
  body.userData.carryState = st; if (p.scene) p.scene.userData.carryState = st;
  if (st.key === key) return; st.key = key; const low = p.lod === 'lo';
  if (sw || mu) loadWeaponModels(low);
  if (st.sword) { st.sword.removeFromParent(); st.sword = null; }
  if (st.musket) { st.musket.removeFromParent(); st.musket = null; }
  if (sw) { const fb = boneOf(body, 'forearm' + hand); if (fb) { const m = weaponMesh(swordGeo(sw), low, sw === 'blade_gold'); m.visible = false; m.userData.side = hand; fb.add(m); st.sword = m; st.swordPlaced = false; st.hand = fb; st.hip = boneOf(body, 'root'); st.holstered = false; st.holsterT = null; st.handT = null; } }
  if (mu) { const sb = boneOf(body, 'spine'); if (sb) { const m = weaponMesh(musketGeo(mu), low, false); m.visible = false; m.userData.id = mu; sb.add(m); st.musket = m; st.sig = ''; } }
  st.body = body; st.crew = crew; p.addPost?.('carry', carryPost, 4);
}
// [crew-weapons] the deck crew bake (js/crewV4.js): put the carried copies where they ride (sword on the hip, musket slung) right now
export function placeCarryNow(p) { const st = p?.carry; if (!st?.body) return [];
  if (st.sword) { if (!st.swordPlaced) placeSword(st); setSwordSpot(st, true); st.sword.visible = true; }
  if (st.musket) { placeMusket(st); st.musket.visible = true; }
  return [st.sword, st.musket].filter(Boolean); }

// the sword in the hand: the SWORD PIT's grip frame (forearm -X = towards the hand), the blade turned down + forward
function placeSword(st) {
  const m = st.sword, fb = m.parent; fb.updateWorldMatrix(true, false); fb.getWorldScale(_s); const k = 1 / Math.max(1e-3, _s.x), C = CARRY.sword, L = m.userData.side === 'L';
  const sx = L ? 1 : -1;   // the forearm points at the hand along -X (right) / +X (left: mirrored bone)
  m.scale.setScalar(C.scale * k); m.position.set(sx * C.at * k, 0, 0);
  const blade = new THREE.Vector3(sx * Math.sin(C.down), C.out, Math.cos(C.down)).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), blade); st.swordPlaced = true;
}
// [musket-holster] the sword sheathed at the hip opposite its hand: bind space -> root bone space (like placeMusket), hilt up at the belt,
// blade down + back + a little out so the held musket (right side, chest high) and the legs never cut it. Computed once per dress.
function holsterXform(st) {
  const body = st.body, sk = body.skeleton, hb = st.hip, bi = hb && sk.boneInverses[sk.bones.indexOf(hb)]; if (!bi) return null;
  const g = body.geometry; if (!g.boundingBox) g.computeBoundingBox(); const bb = g.boundingBox, H = bb.max.y - bb.min.y, C = CARRY.holster;
  const sx = holsterSide(st.sword.userData.side) === 'L' ? 1 : -1;   // bind space: +x = the pirate's left
  const blade = new THREE.Vector3(sx * Math.sin(C.out), -Math.cos(C.tilt), -Math.sin(C.tilt)).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), blade), s = CARRY.sword.scale * H / 1.75;
  const D = new THREE.Matrix4().compose(new THREE.Vector3(sx * C.x * H / 1.75, bb.min.y + C.y * H, C.z * H / 1.75), q, _v.setScalar(s));
  const M = new THREE.Matrix4().copy(bi).multiply(body.bindMatrix).multiply(D), t = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
  M.decompose(t.p, t.q, t.s); return t;
}
function setSwordSpot(st, hol) {   // only when it changes (no per-frame work / allocation)
  const m = st.sword; st.holstered = hol;
  if (hol) { if (!st.holsterT) st.holsterT = holsterXform(st); const t = st.holsterT; if (!t) { st.holstered = false; return; }
    if (!st.handT) st.handT = { p: m.position.clone(), q: m.quaternion.clone(), s: m.scale.clone() };
    st.hip.add(m); m.position.copy(t.p); m.quaternion.copy(t.q); m.scale.copy(t.s); }
  else if (st.handT) { st.hand.add(m); m.position.copy(st.handT.p); m.quaternion.copy(st.handT.q); m.scale.copy(st.handT.s); }
}
// the musket on the back: bind space (y up, +z front) -> spine bone space (L = boneInverse * bindMatrix * D), lifted off whatever you wear
const HAIR = TINTS.indexOf('hair'), HAIR_SQUASH = 0.45, HAIR_R2 = 0.03 * 0.03;
// [Raul items redo] BANKSY via Emerly: the musket stood a hand off big / long hair (hers: ~20 cm off the back at the butt). Now (1) only hair right
// under the gun counts (3 cm either side of it, was the 5 cm window that caught the middle of a big head of hair), (2) the line is the best fit
// over all tilts (least total gap, never inside anything) instead of a line through two bins, (3) a big head of hair can lower the sling a
// little and lay it flatter (up to 4 heights x 2 angles, the muzzle still over the shoulder) when that hugs the back better
const SLING_DY = [0, -0.05, -0.1, -0.15], SLING_DT = [0, 0.22];
function placeMusket(st) {
  const body = st.body, m = st.musket, sb = m.parent, sk = body.skeleton, bi = sk.boneInverses[sk.bones.indexOf(sb)]; if (!bi) return;
  const g = body.geometry; if (!g.boundingBox) g.computeBoundingBox(); const H = g.boundingBox.max.y - g.boundingBox.min.y, C = CARRY.musket;
  const s = C.scale * H / 1.75, len = musketMuzzle(m.userData.id).z * s, NB = 12, meshes = []; body.parent.traverse((o) => { if (o.isSkinnedMesh && !/^pet/.test(o.name) && !o.userData.carry) meshes.push(o); });
  // [capes 2] long / big hair below the shoulders only counts at HAIR_SQUASH of its depth (the gun presses into the hanging hair instead of
  // floating a hand off it); hair above the shoulders (the head) counts in full, so the muzzle never cuts into a head of hair
  const ua = sk.bones.findIndex((b) => /upperarm/i.test(b.name)), ySh = ua >= 0 ? _m.copy(sk.boneInverses[ua]).invert().elements[13] : Infinity;
  const tk = Array.from({ length: NB }, (_, k) => (k + 0.5) / NB);
  // the back's furthest point (min z) in NB bins along a sling line, over the body + every item / gear mesh it wears (not pets, not the parrot)
  const measure = (dir, butt) => { const zb = new Array(NB).fill(0);
    for (const o of meshes) { const P = o.geometry.attributes.position, B = o.geometry.attributes.aBird, T = o === body ? o.geometry.attributes._tint : null; if (!P) continue;
      for (let i = 0; i < P.count; i++) { if (B && B.getX(i) > 0.5) continue; let z = P.getZ(i); const hr = !!T && Math.round(T.getX(i)) === HAIR; if (hr && P.getY(i) < ySh) z *= HAIR_SQUASH; if (z > -0.02) continue;
        const x = P.getX(i) - butt.x, y = P.getY(i) - butt.y, t = (x * dir.x + y * dir.y) / len; if (t < 0 || t > 1) continue;
        const dx = x - dir.x * t * len, dy = y - dir.y * t * len; if (dx * dx + dy * dy > (hr ? HAIR_R2 : 0.0025)) continue; const k = Math.min(NB - 1, (t * NB) | 0); if (z < zb[k]) zb[k] = z; } }
    const need = zb.map((z) => z - C.clear - C.half); need.hit = zb.map((z) => z < 0); return need; };
  // the straight line just outside every bin with the least total gap (slopes within maxTilt)
  const fit = (need) => { let best = null; for (let q = 0; q <= 24; q++) { const sl = (q / 12 - 1) * C.maxTilt * len; let z0 = Infinity; for (let k = 0; k < NB; k++) z0 = Math.min(z0, need[k] - sl * tk[k]);
    let gap = 0, n = 0; for (let k = 0; k < NB; k++) if (need.hit[k]) { gap += need[k] - (z0 + sl * tk[k]); n++; } gap /= Math.max(1, n); if (!best || gap < best.gap - 1e-9) best = { z0, slope: sl, gap }; } return best; };   // the gap only where something is under the gun (not the air past the shoulder)
  let pick = null;
  sling: for (const dt of SLING_DT) for (const dy of SLING_DY) {
    const tl = C.tilt + dt, dir = new THREE.Vector3(-Math.sin(tl), Math.cos(tl), 0), cy = g.boundingBox.min.y + (C.y + dy) * H, butt = new THREE.Vector3(0, cy, 0).addScaledVector(dir, -len / 2);
    if ((dt || dy) && cy + dir.y * len / 2 < ySh + 0.06 * H) continue;   // the muzzle stays well over the shoulder
    const f = fit(measure(dir, butt)), cost = f.gap + 0.006 * (dy ? 1 : 0) + 0.006 * (dt ? 1 : 0);   // the base sling wins unless the other clearly hugs better
    if (!pick || cost < pick.cost) pick = { ...f, cost, dir, butt, dy, dt };
    if (!pick.gap || (!dt && !dy && f.gap < 0.03)) break sling; }   // already snug (every bare / short-hair pirate): keep the base sling
  const { dir, butt, slope, z0 } = pick;
  const zMin = z0, dir3 = new THREE.Vector3(dir.x * len, dir.y * len, slope).normalize();
  const Xg = new THREE.Vector3(0, 0, -1).addScaledVector(dir3, dir3.z).normalize(), Zg = dir3, Yg = new THREE.Vector3().crossVectors(Zg, Xg);
  const D = new THREE.Matrix4().makeBasis(Xg, Yg, Zg).scale(_v.setScalar(s)); D.setPosition(butt.x, butt.y, z0);
  _m.copy(bi).multiply(body.bindMatrix).multiply(D); _m.decompose(m.position, m.quaternion, m.scale);
  st.zMin = zMin; st.sling = [+pick.gap.toFixed(3), pick.dy, pick.dt, +slope.toFixed(3)];
}
function carryPost(dt) {
  const st = this.carry; if (!st || !st.body) return;
  const show = carryShows({ onFoot: this.footSpeed !== undefined, state: this.footState, armedSword: st.armedSword, armedMusket: st.armedMusket });   // footSpeed: set by js/onfoot/pirate.js each frame (ships never)
  if (st.sword) { if (!st.swordPlaced) placeSword(st); const hol = st.crew || swordHolstered({ on: HOLSTER_ON, armedMusket: st.armedMusket }); /* [crew-weapons] crew: always on the hip */ if (hol !== st.holstered) setSwordSpot(st, hol); st.sword.visible = show.sword; }
  if (st.musket) {
    if ((st.t -= dt) <= 0) { st.t = 0.5; let sig = ''; st.body.parent.traverse((o) => { if (o.isSkinnedMesh && !o.userData.carry) sig += o.id + ','; }); if (sig !== st.sig) { st.sig = sig; placeMusket(st); } }
    st.musket.visible = show.musket;
  }
}
