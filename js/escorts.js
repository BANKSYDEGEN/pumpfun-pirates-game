// PUMPFUN PIRATES · hired escorts (late-game gold sink)
// HIRE ESCORT in the shop: 1500g each, up to 5 afloat at once. An escort stays for the rest of the run until it sinks
// (buy a replacement any time); a new run clears them. Each one is a smaller copy of the plain player hull in your
// equipped skin, with a green health bar (never a name). AI: holds a formation slot around you, peels off to the nearest
// rug ship (spread so they don't all pick the same one), circles it at broadside range, and falls back to you when low.
// Enemies pick the nearest of you / your escorts (you stay the main target), so escorts soak some fire.
// Uses Math.random only (never the DAILY seeded streams), one shared mesh template per skin (geometry + materials shared).
import * as THREE from 'three';
import { compilePreview } from './upgradeVisuals.js';
import { equippedSkin } from './skins.js';
import { BALL_DMG } from './upgrades.js';

export const ESCORT = {
  cost: 1500, max: 5, scale: 0.74,
  hp: 260, hpPerWave: 0.07,        // max HP = hp × (1 + hpPerWave × wave)
  armor: 0.3, guns: 3,             // guns per broadside
  dmgPerWave: 0.05,                // ball damage = BALL_DMG × (1 + dmgPerWave × wave)
  reload: 2.4, accuracy: 0.72, range: 75,
  speed: 11, catchUp: 17,          // cruise / catch-up top speed (m/s)
  engageDist: 120, leash: 170,     // pick fights within this of the escort, never further than leash from you
  retreatAt: 0.3, rejoinAt: 0.55,  // fall back below 30% hull, fight again above 55%
  repair: { wait: 20, every: 4, pct: 0.05 }, // same patch-up rule as your hull
  waveHeal: 0.5,                   // each new wave patches +50% of max hull (not a full refill), so hulls wear down over a long run
  killScore: 0.5,                  // escort sinks score half; their loot drops as normal (sail over it)
  aggro: 1.35,                     // enemies weigh an escort's distance ×1.35 vs yours, so you stay the main target
};
// formation slots in your frame: [lateral (port +), forward]
const SLOTS = [[-17, 2], [17, 2], [-32, -8], [32, -8], [0, 26]]; // beside and just ahead of you, never between you and the camera
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angWrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);

// clone a built ship, sharing geometry + materials, with userData object refs remapped to the clone's own nodes
function cloneShip(src) {
  const a = [], saved = [];
  src.traverse(o => { a.push(o); saved.push(o.userData); o.userData = {}; });
  const c = src.clone(true);
  a.forEach((o, i) => { o.userData = saved[i]; });
  const b = []; c.traverse(o => b.push(o));
  const map = new Map(a.map((o, i) => [o, b[i]]));
  const remap = (v, depth = 0) => {
    if (v && v.isObject3D) return map.get(v) || v;
    if (Array.isArray(v)) return v.map(x => remap(x, depth));
    if (depth < 2 && v && typeof v === 'object' && v.constructor === Object) { const o = {}; for (const k in v) o[k] = remap(v[k], depth + 1); return o; }
    return v;
  };
  a.forEach((o, i) => { b[i].userData = remap(o.userData); if (b[i].geometry) b[i].userData.sharedGeo = true; });
  const f = src.userData.flag; if (f) c.userData.flag.geometry = f.geometry; // animated flag cloth: shared buffer
  return c;
}

export function createEscorts(k) {
  // k = { scene, fx, sfx, game, getPlayer, enemies, moveShip, floatShip, fire, popup, buildOpts, onChange }
  const list = [], tpl = new Map();
  const template = (skin) => {
    if (!tpl.has(skin.id)) { const s = compilePreview({}, { ...k.buildOpts, skin, light: false }); if (k.buildOpts.quality === 'low') s.traverse(o => { if (o.userData.outline) o.visible = false; }); // phones: no ink outlines on escorts (~40% fewer triangles, half the draw calls)
      s.updateMatrixWorld(true); tpl.set(skin.id, s); }
    return tpl.get(skin.id);
  };
  function makeMesh() {
    const m = cloneShip(template(equippedSkin())), ud = m.userData, S = ESCORT.scale;
    m.scale.multiplyScalar(S); ud.len *= S; ud.beam *= S; ud.depth *= S;
    return m;
  }
  const alive = () => list.filter(e => e.alive);
  const count = () => alive().length;
  function freeSlot() { const used = new Set(alive().map(e => e.slot)); for (let i = 0; i < SLOTS.length; i++) if (!used.has(i)) return i; return 0; }
  function slotPos(i) {
    const p = k.getPlayer(), [lx, fz] = SLOTS[i], c = Math.cos(p.yaw), n = Math.sin(p.yaw);
    return [p.x + lx * c + fz * n, p.z - lx * n + fz * c];
  }
  function stats(e) {
    const w = k.game.wave || 1, hp = Math.round(ESCORT.hp * (1 + ESCORT.hpPerWave * w)), f = e.maxHp ? e.hp / e.maxHp : 1;
    e.maxHp = hp; e.hp = Math.round(hp * f); e.dmgK = 1 + ESCORT.dmgPerWave * w;
  }
  function hire() {
    if (count() >= ESCORT.max || k.game.gold < ESCORT.cost) return null;
    k.game.gold -= ESCORT.cost; k.game.goldSpent = (k.game.goldSpent || 0) + ESCORT.cost;
    const p = k.getPlayer(), slot = freeSlot(), [x, z] = slotPos(slot), mesh = makeMesh();
    k.scene.add(mesh);
    const bar = document.createElement('div'); bar.className = 'ehp ally';
    bar.innerHTML = '<div class="bar"><div class="fill"></div></div>';
    document.getElementById('bars').appendChild(bar);
    const e = { ally: true, mesh, x, z, yaw: p.yaw, speed: Math.max(4, p.speed), turn: 0, hp: 1, maxHp: 0, state: 'follow', slot, cd: rnd(0.5, 1.5),
      roll: 0, pitch: 0, y: 0, sinking: 0, alive: true, bar, fill: bar.querySelector('.fill'), cannons: ESCORT.guns, armor: ESCORT.armor,
      reload: ESCORT.reload, range: ESCORT.range, accuracy: ESCORT.accuracy, skinId: equippedSkin().id, smokeT: 0, calm: 0, repT: 0, tgt: null, tgtT: 0 };
    stats(e); e.hp = e.maxHp;
    list.push(e);
    k.fx.ring(new THREE.Vector3(x, 0.3, z), 2, 12, 1.4);
    k.onChange?.();
    return e;
  }
  // new wave: +50% hull (ESCORT.waveHeal), stats follow the wave, skin follows the equipped one
  function onWave() {
    const sk = equippedSkin();
    for (const e of alive()) {
      stats(e); e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * ESCORT.waveHeal)); e.state = 'follow';
      if (e.skinId !== sk.id) swapMesh(e, sk);
    }
  }
  function swapMesh(e, sk) {
    const old = e.mesh, m = makeMesh();
    m.position.copy(old.position); m.rotation.copy(old.rotation);
    k.scene.remove(old); k.scene.add(m); e.mesh = m; e.skinId = sk.id;
  }
  // player team: leader = you, foes = rug ships (shared AI: escortStep below)
  const P = ESCORT;
  function updateOne(e, dt) {
    if (!e.alive) { k.floatShip(e, dt); return; }
    const p = k.getPlayer();
    // patch-up: 20 s unhit -> +5% every 4 s
    e.calm += dt;
    if (e.calm >= ESCORT.repair.wait && e.hp < e.maxHp) { e.repT += dt; if (e.repT >= ESCORT.repair.every) { e.repT -= ESCORT.repair.every; e.hp = Math.min(e.maxHp, e.hp + Math.round(e.maxHp * ESCORT.repair.pct)); } } else e.repT = 0;
    escortStep(e, dt, { k, leader: p, player: p, active: p.alive, foes: k.enemies, mates: list, avoid: [p, ...list, ...k.enemies], slot: SLOTS[e.slot], P });
    const frac = e.hp / e.maxHp;
    if (frac < 0.6) { e.smokeT -= dt; if (e.smokeT <= 0) { e.smokeT = 0.15; k.fx.smoke(new THREE.Vector3(e.x + rnd(-1.5, 1.5), e.y + 2.5, e.z + rnd(-2, 2)), frac < 0.35); } }
  }
  function update(dt) {
    for (const e of list) updateOne(e, dt);
    for (let i = list.length - 1; i >= 0; i--) if (!list[i].alive && list[i].sinking > 7) { k.scene.remove(list[i].mesh); list[i].bar.remove(); list.splice(i, 1); }
  }
  function animate(t, animateShip) { for (const e of list) animateShip(e.mesh, t + 0.7 + e.slot * 0.4, e.alive ? 0.8 : 0.3); }
  function onSunk(e) { k.popup(new THREE.Vector3(e.x, 9, e.z), 'ESCORT SUNK!', 'dmg'); k.onChange?.(); }
  function clear() { for (const e of list) { k.scene.remove(e.mesh); e.bar.remove(); } list.length = 0; k.onChange?.(); }
  const ballDmg = (e) => Math.round(rnd(BALL_DMG[0], BALL_DMG[1]) * e.dmgK);
  return { list, hire, count, max: ESCORT.max, cost: ESCORT.cost, onWave, update, animate, onSunk, clear, ballDmg, alive };
}

// ---------- shared escort AI (your hired escorts and the DEV WALLET's escorts) ----------
// o = { k: { moveShip, floatShip, fire, game }, leader (ship or null if it sank), player, active (fights allowed),
//       foes (ships to fight), mates (same-team escorts, so they spread over targets), avoid (hulls to keep clear of),
//       slot: [lateral (port +), forward] formation offset in the leader's frame, P: { speed, catchUp, engageDist, leash,
//       retreatAt, rejoinAt, range } }
function pickTarget(e, o) {
  const L = o.leader, P = o.P;
  let best = null, bd = 1e9;
  for (const en of o.foes) {
    if (!en.alive || en.escaped) continue;
    const d = Math.hypot(en.x - e.x, en.z - e.z);
    if (L && (d > P.engageDist || Math.hypot(en.x - L.x, en.z - L.z) > P.leash)) continue;
    let crowd = 0; for (const m of o.mates) if (m !== e && m.alive && m.tgt === en) crowd++;
    const score = d + crowd * 35 + (en.type === 'runner' ? 25 : 0);
    if (score < bd) { bd = score; best = en; }
  }
  return best;
}
export function escortStep(e, dt, o) {
  const { k, P } = o, L = o.leader && o.leader.alive ? o.leader : null;
  const frac = e.hp / e.maxHp;
  if (e.state !== 'retreat' && frac < P.retreatAt) { e.state = 'retreat'; e.tgt = null; }
  else if (e.state === 'retreat' && frac >= P.rejoinAt) e.state = 'follow';
  e.tgtT = (e.tgtT || 0) - dt;
  if (e.state !== 'retreat' && o.active) {
    if (e.tgt && (!e.tgt.alive || e.tgt.escaped || (L && Math.hypot(e.tgt.x - L.x, e.tgt.z - L.z) > P.leash + 20))) e.tgt = null;
    if (e.tgtT <= 0) { e.tgtT = 1.2; e.tgt = pickTarget(e, o) || (e.tgt && e.tgt.alive ? e.tgt : null); }
    e.state = e.tgt ? 'engage' : 'follow';
  } else if (!o.active) { e.tgt = null; e.state = 'follow'; }
  let desired = e.yaw, spd = P.speed;
  if (e.state === 'engage') {
    const t = e.tgt, dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz), toT = Math.atan2(dx, dz);
    const ideal = 32 + ((e.slotN ?? e.slot ?? 0) % 3) * 4;
    const tangent = toT + (Math.sin(e.yaw - toT) > 0 ? 1 : -1) * Math.PI / 2;
    const corr = clamp((d - ideal) / 28, -1, 1) * 0.9;
    desired = d > 85 ? toT : tangent - Math.sign(Math.sin(tangent - toT)) * corr;
    spd = d > 85 ? P.catchUp * 0.8 : P.speed * 0.85;
  } else if (L) {
    // follow (or retreat): sail to the formation slot beside the leader, match its speed once there
    const [lx, fz] = o.slot, c = Math.cos(L.yaw), n = Math.sin(L.yaw), sx = L.x + lx * c + fz * n, sz = L.z - lx * n + fz * c;
    const dx = sx - e.x, dz = sz - e.z, d = Math.hypot(dx, dz);
    if (d > 6) { desired = Math.atan2(dx, dz); spd = clamp(L.speed + d * 0.25, 3, P.catchUp); }
    else { desired = L.yaw; spd = L.speed; }
    if (e.state === 'retreat') spd = Math.max(spd, P.speed);
  } else if (o.player) {
    // leader gone: retreat away from the player, otherwise close in on them
    const dx = o.player.x - e.x, dz = o.player.z - e.z; desired = Math.atan2(dx, dz) + (e.state === 'retreat' ? Math.PI : 0);
  }
  // spread out: keep clear of the leader, the player, team-mates and other hulls
  for (const s of o.avoid) {
    if (s === e || !s.alive) continue;
    const ox = e.x - s.x, oz = e.z - s.z, od = Math.hypot(ox, oz), R = 13 + (s === o.leader || s === o.player ? 4 : 0);
    if (od < R && od > 0.01) { const push = (R - od) * 0.9 * dt; e.x += ox / od * push; e.z += oz / od * push; if (od < R + 6) desired = angWrap(desired + angWrap(Math.atan2(ox, oz) - desired) * 0.5); }
  }
  k.moveShip(e, dt, spd, clamp(angWrap(desired - e.yaw) * 2, -1, 1));
  k.floatShip(e, dt);
  // broadsides: the target if it sits on a side, else any foe that does
  e.cd -= dt;
  if (e.cd <= 0 && o.active && k.game.state === 'playing') {
    const c = Math.cos(e.yaw), n = Math.sin(e.yaw);
    const cand = e.tgt ? [e.tgt, ...o.foes] : o.foes;
    for (const t of cand) {
      if (!t.alive || t.escaped) continue;
      const dx = t.x - e.x, dz = t.z - e.z, d = Math.hypot(dx, dz); if (d > P.range) continue;
      const lx = dx * c - dz * n, lz = dx * n + dz * c;
      if (Math.abs(Math.atan2(lz, Math.abs(lx))) < 0.5) { k.fire(e, lx > 0 ? 'port' : 'star', t, e.accuracy); e.cd = e.reload * rnd(0.9, 1.15); break; }
    }
  }
}
