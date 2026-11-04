// [fish2] PUMPFUN PIRATES fishing, round 2 (BANKSY 3:43 PM: "improve the fishing" + "show the fish they catch"). Grandpa Gill's dock (lagoon.js).
//   cast: the pirate turns to the water and swings the rod, the bobber flies out on a real line (sagging), splash + ripples
//   wait: fish shadows cruise under the dock; one comes to the float and NIBBLES (little twitches + plips: pressing now spooks it)
//   bite: the float is yanked under, a splash, a "!" sound, a pulsing ring: press within ~1.6 s to HOOK it
//   fight: a timing bar (tap the prompt / E / the touch button / a pad's A, all the same press) when the marker is in the green zone;
//          a miss strains the line, 3 misses = it snaps. Rarer fish: smaller + faster zone, more pulls (server flag fish_reel, see below)
//   land: THE ACTUAL FISH is reeled up out of the water on the line (a low-poly 3D model per species, sized by its length), the pirate
//         holds it up for the camera, and a catch card shows its picture (assets/items/fish_*.webp), name, rarity, length + weight
// The SERVER rolls every fish that reaches the bag: with fish_reel OFF (default) the landing calls inv_fish (the same action as before) and
// shows the fish it returns; with fish_reel ON the bite gets a signed ticket (species rolled at the bite, only the rarity told) and the
// landing redeems it (inv_fish_land). Off switches: &fish2=0 (the old cast / wait / REEL IN prompt) and the fish_reel flag (server).
import * as THREE from 'three';
import { Kit, M, box, cyl, ball, W, C, hash } from './common.js';
import { FISH as CAT, RARITY_COLOR } from '../../inventory/catalog.js';

export const FISH2 = (() => { try { return new URLSearchParams(location.search).get('fish2') !== '0'; } catch { return false; } })();
import { TIERS, STRIKES, FIGHT_S, BITE_S, fishKg, fmtKg, showLen } from './fishTune.js'; // the numbers (node-tested)
export { TIERS, fishKg, showLen };

// ---------- the 3D fish (nose +x, 1 unit long, centred; built once per species, ~150-600 tris each) ----------
const hsl = (h, s, l) => new THREE.Color().setHSL(h, s, l).getHex();
function eyes(k, x, y, z, r = 0.05) { for (const s of [-1, 1]) { W(k, ball(r, 6, 4), 0xffffff, M(x, y, s * z), false); W(k, ball(r * 0.6, 5, 3), 0x111111, M(x + r * 0.35, y, s * (z + r * 0.45)), false); } }
function tail(k, x, h, c, len = 0.3, spread = 1) { W(k, cyl(0, h, len, 4), c, M(x - len / 2, 0, 0, 0, 0, -Math.PI / 2, [1 * spread, 1, 0.12])); }
function fin(k, x, y, h, len, c, lean = 0) { W(k, cyl(0, len / 2, h, 4), c, M(x, y + h / 2, 0, 0, 0, lean, [1, 1, 0.12]), false); }
function bodyFish(k, { h, w, col, fins, tailH, tailLen = 0.3 }) { W(k, ball(0.5, 12, 8), col, M(0.08, 0, 0, 0, 0, 0, [0.84, h, w])); tail(k, -0.32, tailH, fins, tailLen); }
function serpent(k, n, col, r0, amp, headC) { // a chain of balls along an S curve (eel / leviathan)
  for (let i = 0; i < n; i++) { const u = i / (n - 1), x = 0.5 - u, z = Math.sin(u * Math.PI * 2) * amp, r = r0 * (1 - u * 0.65) * (i === 0 ? 1.05 : 1);
    W(k, ball(r, 8, 6), col, M(x, Math.sin(u * 5) * 0.02, z, 0, 0, 0, [1.25, 1, 0.9]), i === 0); } return headC; }
export const LOOK = {
  minnow: (k) => { bodyFish(k, { h: 0.3, w: 0.18, col: (p) => p.y > 0.06 ? 0x6f8496 : p.y < -0.08 ? 0xf2f6f8 : 0xc9d6df, fins: 0xa9bccb, tailH: 0.13 });
    fin(k, 0.0, 0.1, 0.1, 0.16, 0x8fa3b3, -0.3); eyes(k, 0.36, 0.03, 0.06, 0.04); },
  perch: (k) => { bodyFish(k, { h: 0.46, w: 0.24, col: (p) => p.y < -0.12 ? 0xf3e8b0 : Math.sin(p.x * 28) > 0.35 ? 0x354419 : 0xc2b23a, fins: 0xff7a2a, tailH: 0.17 });
    for (let i = 0; i < 4; i++) fin(k, 0.12 - i * 0.09, 0.16, 0.16 - i * 0.02, 0.1, i % 2 ? 0x2e3a14 : 0x6b7a22, -0.25); fin(k, -0.05, -0.2, -0.08, 0.1, 0xff7a2a); eyes(k, 0.37, 0.05, 0.08, 0.05); },
  snapper: (k) => { bodyFish(k, { h: 0.56, w: 0.24, col: (p) => hsl(((0.55 - p.x) * 1.2 + 1) % 1, 0.85, p.y < -0.15 ? 0.75 : 0.56), fins: 0xff5aa0, tailH: 0.22 });
    fin(k, 0.05, 0.2, 0.17, 0.32, 0xff8a3a, -0.2); fin(k, -0.02, -0.24, -0.1, 0.16, 0x9a5aff); eyes(k, 0.36, 0.07, 0.09, 0.055); },
  eel: (k) => { serpent(k, 9, (p) => (Math.sin(p.x * 61) * Math.sin(p.z * 57 + p.y * 40) > 0.35 ? 0x2a1d0c : 0xb4943e), 0.075, 0.07);
    W(k, cyl(0, 0.05, 0.16, 4), 0x8a6e2a, M(-0.56, 0, 0, 0, 0, -Math.PI / 2, [1, 1, 0.15]), false); eyes(k, 0.55, 0.03, 0.05, 0.028); },
  pike: (k) => { W(k, ball(0.5, 12, 8), (p) => p.y < -0.06 ? 0xe4ebc4 : (Math.sin(p.x * 40) * Math.sin(p.y * 70) > 0.4 ? 0xc8d87a : 0x55733a), M(0.0, 0, 0, 0, 0, 0, [0.82, 0.2, 0.17]));
    W(k, cyl(0.0, 0.07, 0.2, 5), 0x4a6632, M(0.48, -0.005, 0, 0, 0, -Math.PI / 2, [1, 1, 0.75]));
    for (let i = 0; i < 4; i++) W(k, cyl(0, 0.008, 0.03, 3), 0xffffff, M(0.42 + i * 0.03, -0.03, 0.035), false);
    tail(k, -0.36, 0.12, 0x6d7d30, 0.22); fin(k, -0.22, 0.07, 0.09, 0.12, 0x6d7d30, -0.3); eyes(k, 0.36, 0.035, 0.06, 0.035); },
  carp: (k) => { bodyFish(k, { h: 0.62, w: 0.3, col: (p) => Math.sin(p.x * 46 + Math.sin(p.y * 46) * 1.5) > 0.6 ? 0xffe27a : p.y < -0.18 ? 0xffe9a8 : 0xffbf2a, fins: 0xff9a18, tailH: 0.24 });
    fin(k, 0.0, 0.24, 0.16, 0.36, 0xffa424, -0.15); fin(k, -0.04, -0.26, -0.11, 0.18, 0xff9a18);
    for (const s of [-1, 1]) W(k, cyl(0.007, 0.004, 0.16, 3), 0xb8781a, M(0.47, -0.06, s * 0.05, 0, 0.9, s * 0.4), false); eyes(k, 0.37, 0.06, 0.11, 0.05); },
  koi: (k) => { bodyFish(k, { h: 0.42, w: 0.24, col: (p) => (Math.sin(p.x * 13 + 1) + Math.cos(p.z * 21 + p.y * 9) > 1.0 ? 0x2a3550 : Math.sin(p.x * 9 - 2) > 0.7 ? 0x7fb2ff : 0xf4f6ff), fins: 0xd8e8ff, tailH: 0.34, tailLen: 0.42 });
    fin(k, 0.02, 0.17, 0.2, 0.34, 0xd8e8ff, -0.3); for (const s of [-1, 1]) W(k, cyl(0, 0.12, 0.26, 4), 0xe4efff, M(0.12, -0.12, s * 0.13, 0, s * 0.5, -2.2, [1, 1, 0.12]), false); eyes(k, 0.37, 0.04, 0.09, 0.045); },
  leviathan: (k) => { serpent(k, 11, (p) => p.y > 0.04 ? 0x1f5a6a : 0x5b8a7a, 0.12, 0.09);
    for (let i = 1; i < 10; i++) { const u = i / 10; W(k, cyl(0, 0.05 * (1 - u * 0.5), 0.14 * (1 - u * 0.5), 4), i % 2 ? 0x7a3ad0 : 0x4a1f8a, M(0.5 - u, 0.1 * (1 - u * 0.65), Math.sin(u * Math.PI * 2) * 0.09, 0, 0, -0.3), false); }
    W(k, box(0.16, 0.05, 0.14), 0x173f4a, M(0.6, -0.06, 0, 0, 0, -0.25)); for (let i = 0; i < 3; i++) W(k, cyl(0, 0.012, 0.05, 3), 0xffffff, M(0.56 + i * 0.03, -0.035, 0.045), false);
    for (const s of [-1, 1]) W(k, cyl(0, 0.03, 0.14, 4), 0x9a5aff, M(0.48, 0.1, s * 0.07, 0, 0, 0.9), false);
    W(k, cyl(0, 0.13, 0.26, 4), 0x4a1f8a, M(-0.62, 0, 0.0, 0, 0, -Math.PI / 2, [1, 1, 0.15]), false);
    for (const s of [-1, 1]) { W(k, ball(0.035, 6, 4), 0xffe066, M(0.56, 0.05, s * 0.085), false); W(k, ball(0.018, 5, 3), 0x111111, M(0.575, 0.05, s * 0.1), false); } },
};

// ---------- the module: lagoon.js owns the dock + Gill and hands this its group, the bobber spot and the lake height ----------
export function createFishing2({ MATS, OUT, near, lakeY, dockY, dock, journal }) {
  const st = { mode: 'idle', t: 0, t0: 0, tb: 0, nib: [], api: null, me: null, fish: null, catchR: null, tier: 'common', ticket: null, ticketAt: 0 };
  const tgt = new THREE.Vector3(), tip = new THREE.Vector3(), V = new THREE.Vector3();
  // rod (in the pirate's hand while fishing), line, bobber, ripples, splash drops, fish shadows
  const rod = new THREE.Group(); { const k = new Kit(); W(k, cyl(0.018, 0.035, 2.3, 5), C.WOOD_D, M(0, 1.15, 0), false); W(k, cyl(0.04, 0.04, 0.38, 5), 0x2b2f36, M(0, 0.2, 0), false);
    W(k, cyl(0.07, 0.07, 0.07, 8), C.GOLD, M(0.06, 0.45, 0, 0, 0, Math.PI / 2), false); rod.add(k.build(MATS, OUT)); }
  const rodPivot = new THREE.Group(); rodPivot.add(rod); rod.position.set(-0.3, 0.95, 0.2); rod.rotation.x = 0.85; rodPivot.visible = false; near.add(rodPivot);
  const ROD_TIP = new THREE.Vector3(0, 2.3, 0);
  const NL = 18, lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NL * 3), 3));
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x1b1b1b, transparent: true, opacity: 0.85 })); line.frustumCulled = false; line.visible = false; near.add(line);
  const bob = new THREE.Group(); { const kb = new Kit(); W(kb, ball(0.17, 10, 6), C.RED, M(0, 0.1, 0), false); W(kb, ball(0.16, 10, 6), C.WHITE, M(0, -0.04, 0), false); W(kb, cyl(0.02, 0.02, 0.32, 3), C.IRON, M(0, 0.33, 0), false); bob.add(kb.build(MATS, OUT)); }
  bob.visible = false; near.add(bob);
  const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const rings = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.32, 0.42, 24), ringMat()); r.rotation.x = -Math.PI / 2; r.userData.t = -9; near.add(r); return r; });
  const dropGeo = new THREE.SphereGeometry(0.06, 5, 3), dropMat = new THREE.MeshBasicMaterial({ color: 0xe8f6ff }), drops = [];
  for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(dropGeo, dropMat); d.visible = false; d.userData = { v: new THREE.Vector3(), life: 0 }; near.add(d); drops.push(d); }
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x0b1a22, transparent: true, opacity: 0.32, depthWrite: false });
  const shadows = [0, 1, 2, 3, 4].map((i) => { const s = new THREE.Mesh(new THREE.CircleGeometry(0.5, 10), shadowMat); s.rotation.x = -Math.PI / 2; s.scale.set(0.5 + hash(i, 1) * 0.6, 1.1 + hash(i, 2), 1);
    s.userData = { a: hash(i, 3) * 6.28, r: 3 + hash(i, 4) * 6, w: (0.15 + hash(i, 5) * 0.2) * (i % 2 ? 1 : -1) }; s.position.y = lakeY + 0.03; near.add(s); return s; });
  const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 7, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  glow.visible = false; near.add(glow);
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  halo.visible = false; near.add(halo);
  const models = {}; const model = (id) => { if (!models[id]) { const k = new Kit(); (LOOK[id] || LOOK.minnow)(k); const g = k.build(MATS, OUT), p = new THREE.Group(); p.add(g); p.visible = false; near.add(p); models[id] = p; } return models[id]; };
  // ---------- small helpers ----------
  const sfx = (k, a) => st.api?.sfx?.(k, a);
  const ripple = (x, z, big = 1) => { const r = rings.reduce((a, b) => (a.userData.t < b.userData.t ? a : b)); r.userData.t = st.t; r.userData.big = big; r.position.set(x, lakeY + 0.05, z); };
  const splash = (x, z, n = 8, up = 3) => { let k = 0; for (const d of drops) { if (d.userData.life > 0 || k >= n) continue; k++; const a = Math.random() * 6.28, s = 0.6 + Math.random() * 1.4;
    d.userData.v.set(Math.cos(a) * s, up * (0.6 + Math.random() * 0.6), Math.sin(a) * s); d.userData.life = 0.9; d.position.set(x, lakeY + 0.1, z); d.visible = true; } ripple(x, z, 1.4); };
  function setLine(a, b, sag) { const P = lineGeo.attributes.position; for (let i = 0; i < NL; i++) { const u = i / (NL - 1); V.lerpVectors(a, b, u); V.y -= Math.sin(u * Math.PI) * sag; P.setXYZ(i, V.x, V.y, V.z); } P.needsUpdate = true; }
  function placeRod() { const me = st.me; if (!me) return; rodPivot.position.set(me.x, me.y, me.z); rodPivot.rotation.y = me.yaw; rodPivot.updateMatrixWorld(true);
    tip.copy(ROD_TIP); rod.localToWorld(tip); near.worldToLocal(tip); }
  const ui = makeUI();
  // ---------- per frame ----------
  function tick(t, dt) { st.t = t; const me = st.me;
    for (const s of shadows) { const u = s.userData; if (st.mode === 'nibble' || st.mode === 'bite') { if (s === st.nibFish) { s.position.x += (bob.position.x - s.position.x) * Math.min(1, dt * 1.5); s.position.z += (bob.position.z + 0.45 - s.position.z) * Math.min(1, dt * 1.5); continue; } }
      u.a += u.w * dt; s.position.x = dock.x + Math.cos(u.a) * u.r; s.position.z = dock.z1 - 8 + Math.sin(u.a) * u.r * 0.7; s.rotation.z = -u.a - (u.w > 0 ? 0 : Math.PI); }
    for (const r of rings) { const a = t - r.userData.t; if (a > 1.4 || a < 0) { r.material.opacity = 0; continue; } r.scale.setScalar(1 + a * 2.6 * (r.userData.big || 1)); r.material.opacity = 0.75 * (1 - a / 1.4); }
    for (const d of drops) { const u = d.userData; if (u.life <= 0) continue; u.life -= dt; u.v.y -= 9.8 * dt; d.position.addScaledVector(u.v, dt); if (u.life <= 0 || d.position.y < lakeY) { u.life = 0; d.visible = false; } }
    if (st.mode === 'idle') { rodPivot.visible = line.visible = bob.visible = false; return; }
    if (me) placeRod(); rodPivot.visible = !!me && st.mode !== 'show'; line.visible = rodPivot.visible && st.mode !== 'cast0';
    const u = t - st.t0;
    if (st.mode === 'cast') { const k = Math.min(1, u / 0.75); bob.visible = true; bob.position.set(tip.x + (tgt.x - tip.x) * k, tip.y + (tgt.y - tip.y) * k + Math.sin(k * Math.PI) * 2.2, tip.z + (tgt.z - tip.z) * k);
      setLine(tip, bob.position, 0.2 * k); if (k >= 1) { st.mode = 'wait'; splash(tgt.x, tgt.z, 6, 2); sfx('plop'); } return; }
    if (st.mode === 'wait' || st.mode === 'nibble') { bob.position.set(tgt.x, lakeY + 0.05 + 0.04 * Math.sin(t * 2.4), tgt.z);
      if (st.mode === 'wait' && t >= st.tn) { st.mode = 'nibble'; st.nibFish = shadows.reduce((a, b) => a.position.distanceTo(bob.position) < b.position.distanceTo(bob.position) ? a : b); st.nib = [0.9, 1.9, 2.6].slice(0, 1 + (Math.random() * 3 | 0)).map(x => t + x); }
      if (st.mode === 'nibble') { for (const n of st.nib) { const a = t - n; if (a > 0 && a < 0.22) { bob.position.y -= 0.09 * Math.sin(a / 0.22 * Math.PI); if (!st.plip?.includes(n)) { (st.plip = st.plip || []).push(n); sfx('nibble'); ripple(tgt.x, tgt.z, 0.6); } } }
        if (t >= st.tb) { st.mode = 'bite'; st.t0 = t; splash(tgt.x, tgt.z, 9, 2.6); sfx('bite'); st.api?.rumble?.(0.6, 0.5, 220); ui.flash('!'); } }
      setLine(tip, bob.position, 0.6); return; }
    if (st.mode === 'bite') { bob.position.set(tgt.x, lakeY - 0.22 - 0.08 * Math.sin(t * 30), tgt.z); if (((t * 2.2) % 1) < dt * 2.2) ripple(tgt.x, tgt.z, 1);
      setLine(tip, bob.position, 0.05); if (u > BITE_S) { st.mode = 'wait'; st.tn = t + 1 + Math.random() * 2; st.tb = st.tn + 2 + Math.random() * 2; st.plip = []; st.missed = (st.missed || 0) + 1; ui.toast('IT GOT AWAY<br><small>wait for the float to go under, then hook it fast</small>'); } return; }
    if (st.mode === 'hook' || st.mode === 'fight') { const f = st.fight; // the fish runs about under the float, pulled in pull by pull
      const pull = f ? f.got / f.need : 0, d = 1 - pull * 0.75, wob = Math.sin(t * 7.3) * 0.9 + Math.sin(t * 3.1) * 0.6;
      V.set(dock.x + (tgt.x - dock.x) * d + wob * 0.6 * d, lakeY - 0.1, dock.z1 + (tgt.z - dock.z1) * d); bob.position.lerp(V, Math.min(1, dt * 6));
      if (((t * 3) % 1) < dt * 3) { ripple(bob.position.x, bob.position.z, 0.8); if (Math.random() < 0.4) splash(bob.position.x, bob.position.z, 3, 1.6); }
      setLine(tip, bob.position, 0.01); if (st.mode === 'fight') fightTick(t, dt); return; }
    if (st.mode === 'land') { bob.position.y = lakeY - 0.1 + Math.sin(t * 20) * 0.05; setLine(tip, bob.position, 0); if (((t * 4) % 1) < dt * 4) splash(bob.position.x, bob.position.z, 3, 2);
      if (st.catchR) startShow(t); else if (u > 6) failLand('the line went slack'); return; }
    if (st.mode === 'show') showTick(t, dt);
  }
  // ---------- the press (E / touch prompt / pad): one entry for everything ----------
  function press(t) {
    if (st.mode === 'idle') return cast(t);
    if (st.mode === 'cast' || st.mode === 'hook' || st.mode === 'land') return null;
    if (st.mode === 'wait' || st.mode === 'nibble') { if (t - st.t0 < 0.9) return null; const early = st.mode === 'nibble'; reset(); sfx('reelEmpty'); return (early ? 'TOO EARLY · YOU SPOOKED IT' : 'REELED IN · NOTHING YET') + '<br><small>wait for the float to go right under</small>'; }
    if (st.mode === 'bite') return hook(t);
    if (st.mode === 'fight') return pull(t);
    if (st.mode === 'show') { if (t - st.t0 > 1.4) { ui.card(null); reset(); return cast(t); } return null; }
    return null;
  }
  function cast(t) { const me = st.me; if (!me) return null;
    const a = (Math.random() - 0.5) * 1.1, r = 6.5 + Math.random() * 3.5; tgt.set(dock.x + Math.sin(a) * r, lakeY + 0.05, dock.z1 - Math.cos(a) * r);
    st.api?.face?.(Math.atan2(tgt.x - me.x, tgt.z - me.z)); st.api?.emote?.(102); sfx('cast');
    st.mode = 'cast'; st.t0 = t; st.tn = t + 1.6 + Math.random() * 2.4; st.tb = st.tn + 1.4 + Math.random() * 2.2; st.plip = []; st.missed = 0; st.catchR = null; st.ticket = null; st.tier = 'common'; ui.card(null);
    return null; }
  function hook(t) { st.mode = 'hook'; st.t0 = t; sfx('hook'); st.api?.emote?.(103); ui.flash('HOOKED!');
    const go = (tier) => { if (st.mode !== 'hook') return; st.tier = TIERS[tier] ? tier : 'common'; const T = TIERS[st.tier];
      st.fight = { got: 0, need: T.pulls, miss: 0, p: 0, dir: 1, zc: 0.5, t0: st.t, ...T }; st.mode = 'fight'; ui.fight(st.fight, st.tier); };
    if (reelOn !== false) call('inv_fish_bite', {}).then((r) => { if (r?.ok && r.ticket) { reelOn = true; st.ticket = r.ticket; st.ticketAt = performance.now(); go(r.rarity); } else { if (r?.error !== 'slow down') reelOn = false; go('common'); } });
    else setTimeout(() => go('common'), 350);
    return null; }
  function fightTick(t, dt) { const f = st.fight; f.p += f.dir * f.hz * 2 * dt; if (f.p > 1) { f.p = 2 - f.p; f.dir = -1; } if (f.p < 0) { f.p = -f.p; f.dir = 1; }
    if (f.drift) f.zc = Math.min(1 - f.zone / 2, Math.max(f.zone / 2, f.zc + Math.sin(t * 2.3) * dt * 0.35));
    ui.fight(f, st.tier); if (t - f.t0 > FIGHT_S) { lose('IT SHOOK THE HOOK'); } }
  function pull(t) { const f = st.fight; if (Math.abs(f.p - f.zc) <= f.zone / 2) { f.got++; sfx('reel', f.got / f.need); st.api?.rumble?.(0.25, 0.1, 60); ripple(bob.position.x, bob.position.z, 1.2);
      if (f.got >= f.need) { land(t); return null; } f.zc = f.zone / 2 + Math.random() * (1 - f.zone); ui.fight(f, st.tier, 'good'); return null; }
    f.miss++; sfx('strain', f.miss / STRIKES); st.api?.rumble?.(0.1, 0.45, 160); ui.fight(f, st.tier, 'bad'); if (f.miss >= STRIKES) lose('SNAP! THE LINE BROKE'); return null; }
  function lose(why) { sfx('snap'); st.api?.rumble?.(0.8, 0.8, 300); ui.fight(null); st.api?.emote?.(-1); splash(bob.position.x, bob.position.z, 8, 2.6); reset(); ui.toast(`${why}<br><small>${st.tier === 'common' ? 'tap when the marker is in the green' : 'something big got away… tap in the green'}</small>`); }
  function land(t) { st.mode = 'land'; st.t0 = t; ui.fight(null); sfx('landing'); st.api?.emote?.(-1);
    const wait = st.ticket ? Math.max(0, 1300 - (performance.now() - st.ticketAt)) : 0;
    setTimeout(() => (st.ticket ? call('inv_fish_land', { ticket: st.ticket }) : call('inv_fish', {})).then((r) => { if (st.mode !== 'land') return;
      if (r?.ok && /^fish:/.test(r.item) && LOOK[r.item.slice(5)]) st.catchR = { id: r.item.slice(5), cm: r.cm | 0, bag: true };
      else st.catchR = { ...journal.localRoll(), bag: false, why: r?.error }; }), wait); }
  function failLand(why) { reset(); ui.toast(`IT GOT AWAY<br><small>${why}</small>`); }
  function reset() { st.mode = 'idle'; st.fight = null; st.ticket = null; ui.fight(null); bob.visible = false; for (const m of Object.values(models)) m.visible = false; glow.visible = halo.visible = false; }
  // ---------- the catch: out of the water on the line -> held up -> the card ----------
  function startShow(t) { const c = st.catchR, info = CAT[c.id] || { rarity: 'common', name: c.id }, len = showLen(c.cm || 20);
    c.rarity = info.rarity; c.name = info.name; c.kg = fishKg(c.id, c.cm || 20); const j = journal.add(c); c.isNew = j.isNew; c.rec = j.rec; c.n = j.n; c.of = j.of; c.pearl = j.pearl;
    const m = model(c.id); m.visible = true; m.scale.setScalar(len); m.position.copy(bob.position); st.fish = m; st.mode = 'show'; st.t0 = t; st.from = bob.position.clone(); bob.visible = false;
    splash(bob.position.x, bob.position.z, 14, 4); sfx('catch', ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(c.rarity));
    const col = new THREE.Color(RARITY_COLOR[c.rarity] || '#ffffff'); glow.material.color.copy(col); halo.material.color.copy(col);
    glow.visible = c.rarity === 'rare' || c.rarity === 'epic' || c.rarity === 'legendary'; glow.position.set(st.from.x, lakeY + 3.4, st.from.z); halo.visible = c.rarity !== 'common'; }
  function showTick(t, dt) { const c = st.catchR, m = st.fish, u = t - st.t0, me = st.me; if (!m) return reset();
    glow.material.opacity = glow.visible ? 0.35 * Math.max(0, 1 - u / 2.2) : 0;
    if (u < 0.9) { const k = u / 0.9, e = k * k * (3 - 2 * k); placeRod(); rodPivot.visible = line.visible = true; m.position.set(st.from.x + (tip.x - st.from.x) * e, st.from.y + (tip.y - 0.5 - st.from.y) * e + Math.sin(k * Math.PI) * 1.4, st.from.z + (tip.z - st.from.z) * e);
      m.rotation.set(0, Math.atan2(tip.x - st.from.x, tip.z - st.from.z) - Math.PI / 2, Math.PI / 2 * e + Math.sin(t * 22) * 0.35); V.copy(m.position); V.y += 0.25; setLine(tip, V, 0); halo.visible = false; return; }
    if (u < 0.92 + dt) { st.api?.face?.(st.api?.camYaw?.() + Math.PI); st.api?.emote?.(101); ui.card(c); }
    rodPivot.visible = line.visible = false; if (!me) return;
    const fy = me.yaw, k = Math.min(1, (u - 0.9) / 0.35), e = k * k * (3 - 2 * k), hx = me.x + Math.sin(fy) * 0.3, hz = me.z + Math.cos(fy) * 0.3, hy = me.y + 2.15 + Math.sin(Math.min(1, u - 0.9) * 3) * 0.04;
    m.position.set(m.position.x + (hx - m.position.x) * e, m.position.y + (hy - m.position.y) * e, m.position.z + (hz - m.position.z) * e);
    m.rotation.set(0, fy, Math.sin(t * (u < 1.8 ? 14 : 5)) * (u < 1.8 ? 0.22 : 0.06));
    if (halo.visible) { halo.position.set(hx - Math.sin(fy) * 0.12, hy, hz - Math.cos(fy) * 0.12); halo.rotation.set(0, fy, 0); halo.scale.setScalar(Math.max(0.7, showLen(c.cm || 20)) * (1 + Math.sin(t * 4) * 0.06)); halo.material.opacity = 0.55 + Math.sin(t * 6) * 0.15; }
    if (u > 3.6) { reset(); } }
  // ---------- server calls (js/inventory/ui.js 'pfp-fish' bridge -> pvp.inv.call); offline / no bridge = null ----------
  let reelOn = null;
  function call(action, body) { return new Promise((res) => { let done = false; const fin = (r) => { if (!done) { done = true; res(r); } };
    try { window.dispatchEvent(new CustomEvent('pfp-fish', { detail: { action, body, done: fin } })); } catch { fin(null); } setTimeout(() => fin(null), 5000); }); }
  // ---------- the HUD: the reel bar + the catch card (DOM, built on first use) ----------
  function makeUI() { let bar = null, card = null, fl = null; const doc = typeof document !== 'undefined' ? document : null;
    const css = () => { if (!doc || doc.getElementById('fs2-css')) return; const s = doc.createElement('style'); s.id = 'fs2-css'; s.textContent = `
#fs2-bar{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);width:min(74vw,340px);z-index:60;pointer-events:none;font:700 13px/1.2 'Trebuchet MS',system-ui,sans-serif;color:#fff;text-align:center;text-shadow:0 2px 0 #0008}
#fs2-bar .tr{position:relative;height:22px;border-radius:12px;background:#0b1e2be6;border:3px solid #f3e3b5;box-shadow:0 4px 0 #0006;overflow:hidden;margin-top:6px}
#fs2-bar .z{position:absolute;top:0;bottom:0;background:linear-gradient(#7dff8a,#2fbf4a);border-left:2px solid #eaffea;border-right:2px solid #eaffea}
#fs2-bar .m{position:absolute;top:-3px;bottom:-3px;width:6px;margin-left:-3px;background:#fff;border-radius:3px;box-shadow:0 0 6px #fff}
#fs2-bar.bad .tr{border-color:#ff5a4e;animation:fs2shake .25s} #fs2-bar.good .tr{border-color:#7dff8a}
#fs2-bar .pp{display:flex;gap:4px;justify-content:center;margin-top:6px;font-size:15px} #fs2-bar .pp i{font-style:normal;opacity:.35} #fs2-bar .pp i.on{opacity:1}
@keyframes fs2shake{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
#fs2-card{position:fixed;left:50%;top:12%;transform:translate(-50%,-30px) scale(.9);opacity:0;transition:all .35s cubic-bezier(.2,1.4,.4,1);z-index:61;pointer-events:none;
 width:min(82vw,300px);padding:12px 14px 14px;border-radius:16px;background:linear-gradient(#20394b,#10202d);border:4px solid var(--rc,#ccc);box-shadow:0 0 0 3px #0007,0 0 28px var(--rc,#000);text-align:center;color:#fff;font:700 14px/1.25 'Trebuchet MS',system-ui,sans-serif}
#fs2-card.on{opacity:1;transform:translate(-50%,0) scale(1)} #fs2-card img{width:min(42vw,150px);height:min(42vw,150px);object-fit:contain;filter:drop-shadow(0 6px 6px #0008);margin:-4px 0 0}
#fs2-card .rr{display:inline-block;padding:2px 10px;border-radius:9px;background:var(--rc);color:#111;font-size:12px;letter-spacing:1px} #fs2-card .nm{font-size:20px;margin:4px 0 2px;letter-spacing:.5px}
#fs2-card .ms{font-size:16px;color:#ffe9a8} #fs2-card .tg{color:#7dff8a;font-size:13px;margin-top:3px} #fs2-card small{display:block;opacity:.8;font-size:12px;margin-top:5px}
#fs2-fl{position:fixed;left:50%;top:38%;transform:translate(-50%,-50%) scale(.6);opacity:0;z-index:61;pointer-events:none;font:900 54px/1 'Trebuchet MS',system-ui,sans-serif;color:#ffe066;text-shadow:0 4px 0 #6a3a00,0 0 18px #000a;transition:all .18s}
#fs2-fl.on{opacity:1;transform:translate(-50%,-50%) scale(1)}
@media (max-width:700px){#fs2-bar{bottom:190px}#fs2-card{top:8%}}`; doc.head.appendChild(s); };
    return {
      fight(f, tier, hit) { if (!doc) return; css(); if (!f) { if (bar) bar.style.display = 'none'; return; }
        if (!bar) { bar = doc.createElement('div'); bar.id = 'fs2-bar'; bar.innerHTML = '<div class="h"></div><div class="tr"><div class="z"></div><div class="m"></div></div><div class="pp"></div>'; doc.body.appendChild(bar); }
        bar.style.display = 'block'; const big = tier === 'epic' || tier === 'legendary';
        if (bar._tier !== tier) { bar._tier = tier; bar.querySelector('.h').innerHTML = `${big ? 'SOMETHING HUGE! ' : tier === 'rare' ? 'A STRONG ONE! ' : ''}${st.api?.key?.() === 'TAP' || !st.api?.key ? 'TAP' : 'PRESS ' + st.api.key()} IN THE GREEN TO REEL`; }
        const z = bar.querySelector('.z'); z.style.left = ((f.zc - f.zone / 2) * 100) + '%'; z.style.width = (f.zone * 100) + '%'; bar.querySelector('.m').style.left = (f.p * 100) + '%';
        const key = f.got + '/' + f.miss + '/' + f.need + tier; if (bar._k !== key) { bar._k = key; bar.querySelector('.pp').innerHTML = Array.from({ length: f.need }, (_, i) => `<i class="${i < f.got ? 'on' : ''}">🐟</i>`).join('') + ' ' + Array.from({ length: STRIKES }, (_, i) => `<i class="${i < f.miss ? 'on' : ''}">✖</i>`).join(''); }
        if (hit) { bar.classList.remove('good', 'bad'); void bar.offsetWidth; bar.classList.add(hit); } },
      card(c) { if (!doc) return; css(); if (!card) { card = doc.createElement('div'); card.id = 'fs2-card'; doc.body.appendChild(card); }
        if (!c) { card.classList.remove('on'); return; } clearTimeout(card._t);
        const rc = RARITY_COLOR[c.rarity] || '#ccc', price = CAT[c.id]?.fish | 0; card.style.setProperty('--rc', rc);
        card.innerHTML = `<div class="rr">${c.rarity.toUpperCase()}</div><img alt="" src="${new URL('../../../assets/items/fish_' + c.id + '.webp', import.meta.url).href}"><div class="nm">${c.name.toUpperCase()}</div>
          <div class="ms">${c.cm} cm · ${fmtKg(c.kg)}</div>${c.isNew ? '<div class="tg">NEW IN YOUR FISH JOURNAL!</div>' : c.rec ? '<div class="tg">A NEW RECORD!</div>' : ''}
          <small>${c.bag ? `in your bag · the Fish Stand pays ${price} gold` : 'not saved to your bag · check your connection'} · journal ${c.n}/${c.of}${c.pearl ? '<br>…and a RIVER PEARL!' : ''}</small>`;
        card.classList.add('on'); card._t = setTimeout(() => card.classList.remove('on'), 4600); },
      flash(txt) { if (!doc) return; css(); if (!fl) { fl = doc.createElement('div'); fl.id = 'fs2-fl'; doc.body.appendChild(fl); } fl.textContent = txt; fl.classList.add('on'); clearTimeout(fl._t); fl._t = setTimeout(() => fl.classList.remove('on'), 650); },
      toast(m) { st.api?.toast?.(m, 2600); } };
  }
  return {
    tick, press, st,
    label() { return { idle: 'CAST YOUR LINE', cast: 'CASTING…', wait: 'WAIT FOR THE BITE…', nibble: 'STEADY… SOMETHING\'S NIBBLING', bite: 'HOOK IT!', hook: 'HOOKED!', fight: 'REEL! TAP IN THE GREEN', land: 'LANDING IT…', show: 'CAST AGAIN' }[st.mode] || 'CAST YOUR LINE'; },
    player(me, api) { st.me = me; st.api = api; },
    leave() { if (st.mode !== 'idle' && st.mode !== 'show') { reset(); } },
  };
}
