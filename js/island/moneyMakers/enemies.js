// [v349 money-makers] on-foot PvE: Skeleton Raiders (Smugglers' Cove camp by Dead Man's Cave), Jungle Stalkers (Temple ruins), Skeleton
// Gladiators + Cursed Captains (the Coliseum Skeleton Horde). Procedural low-poly bodies, simple chase / swing AI, leashed to their camp.
// Your sword / musket reach them through globalThis.PFP_PVE (2 one-line hooks in js/onfoot/battle.js swordHit / shoot); their swings hurt
// you through hurt() (index.js: battle.me.hp, never a haul drop). A kill fires 'pfp-pve-kill' { kind } (contracts, horde).
import * as THREE from 'three';
import { mat, label } from './props.js';

const BONE = 0xe9e1c8, BONED = 0xb9ae90;
const KINDS = {
  raider:    { hp: 45, dmg: 7,  speed: 3.1, reach: 1.7, cool: 1.3, scale: 1.0, bone: BONE, cloth: 0x7b2a1c, eye: 0xff3b2a, name: 'SKELETON RAIDER' },
  stalker:   { hp: 38, dmg: 6,  speed: 4.3, reach: 1.6, cool: 1.0, scale: 1.0, bone: 0x1f2a1c, cloth: 0x2f4a22, eye: 0xffe24a, name: 'JUNGLE STALKER', quad: true },
  gladiator: { hp: 45, dmg: 7,  speed: 3.0, reach: 1.7, cool: 1.25, scale: 1.0, bone: BONE, cloth: 0x8a6a2a, eye: 0x6ad8ff, name: 'SKELETON GLADIATOR' },
  captain:   { hp: 140, dmg: 13, speed: 2.7, reach: 2.1, cool: 1.5, scale: 1.35, bone: 0xd8cfb0, cloth: 0x3a0f2a, eye: 0xff2a6a, name: 'CURSED CAPTAIN' },
};
export const PVE_KINDS = KINDS;
const G = {};
const geo = (k, f) => (G[k] ||= f());
function skeleton(K) {
  const g = new THREE.Group(), B = mat(K.bone), C = mat(K.cloth), E = mat(K.eye, { emissive: K.eye, emissiveIntensity: 1 });
  const part = (geom, m, x, y, z) => { const o = new THREE.Mesh(geom, m); o.position.set(x, y, z); g.add(o); return o; };
  const skull = part(geo('skull', () => new THREE.SphereGeometry(0.2, 8, 6)), B, 0, 1.62, 0); skull.scale.set(1, 1.05, 1.1);
  part(geo('jaw', () => new THREE.BoxGeometry(0.22, 0.08, 0.2)), B, 0, 1.45, 0.04);
  for (const s of [-1, 1]) part(geo('eye', () => new THREE.SphereGeometry(0.045, 6, 4)), E, s * 0.075, 1.65, 0.17);
  part(geo('spine', () => new THREE.CylinderGeometry(0.05, 0.05, 0.62, 5)), B, 0, 1.08, 0);
  for (let i = 0; i < 3; i++) part(geo('rib' + i, () => new THREE.TorusGeometry(0.17 - i * 0.02, 0.025, 4, 10, Math.PI * 1.4)), B, 0, 1.28 - i * 0.12, 0.02).rotation.set(Math.PI / 2, 0, Math.PI * 0.8);
  part(geo('pelvis', () => new THREE.BoxGeometry(0.34, 0.1, 0.18)), B, 0, 0.76, 0);
  const sash = part(geo('sash', () => new THREE.BoxGeometry(0.4, 0.22, 0.22)), C, 0, 0.72, 0); void sash;
  const legs = [], arms = [];
  for (const s of [-1, 1]) { const L = new THREE.Group(); L.position.set(s * 0.11, 0.74, 0); const l = new THREE.Mesh(geo('leg', () => new THREE.CylinderGeometry(0.04, 0.035, 0.74, 5)), B); l.position.y = -0.37; L.add(l); g.add(L); legs.push(L);
    const A = new THREE.Group(); A.position.set(s * 0.24, 1.33, 0); const a = new THREE.Mesh(geo('arm', () => new THREE.CylinderGeometry(0.035, 0.03, 0.6, 5)), B); a.position.y = -0.3; A.add(a); g.add(A); arms.push(A); }
  // weapon in the right hand (cutlass / captain's sabre)
  const blade = new THREE.Mesh(geo('blade', () => new THREE.BoxGeometry(0.05, 0.85, 0.12)), mat(0xb8bcc4, { emissive: 0x111111 })); blade.position.set(0, -0.82, 0.1); arms[1].add(blade);
  if (K === KINDS.captain) { const hat = new THREE.Mesh(geo('hat', () => new THREE.ConeGeometry(0.34, 0.24, 3)), mat(0x161616)); hat.position.y = 1.86; hat.rotation.y = Math.PI / 6; g.add(hat);
    const coat = new THREE.Mesh(geo('coat', () => new THREE.CylinderGeometry(0.22, 0.34, 0.75, 6, 1, true)), mat(K.cloth, { side: THREE.DoubleSide })); coat.position.y = 1.0; g.add(coat); }
  else { const band = new THREE.Mesh(geo('band', () => new THREE.CylinderGeometry(0.21, 0.21, 0.07, 8)), C); band.position.y = 1.72; g.add(band); }
  g.scale.setScalar(K.scale); g.userData = { legs, arms, quad: false }; return g;
}
function stalker(K) {
  const g = new THREE.Group(), B = mat(K.bone), E = mat(K.eye, { emissive: K.eye, emissiveIntensity: 1 }), S = mat(K.cloth);
  const body = new THREE.Mesh(geo('sbody', () => new THREE.BoxGeometry(0.42, 0.38, 1.25)), B); body.position.y = 0.72; g.add(body);
  const stripe = new THREE.Mesh(geo('sstripe', () => new THREE.BoxGeometry(0.44, 0.06, 1.1)), S); stripe.position.y = 0.92; g.add(stripe);
  const head = new THREE.Mesh(geo('shead', () => new THREE.BoxGeometry(0.36, 0.32, 0.42)), B); head.position.set(0, 0.92, 0.78); g.add(head);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(geo('seye', () => new THREE.SphereGeometry(0.045, 6, 4)), E); e.position.set(s * 0.1, 0.98, 0.99); g.add(e);
    const ear = new THREE.Mesh(geo('sear', () => new THREE.ConeGeometry(0.06, 0.14, 4)), B); ear.position.set(s * 0.12, 1.14, 0.7); g.add(ear); }
  const tail = new THREE.Mesh(geo('stail', () => new THREE.CylinderGeometry(0.03, 0.05, 0.9, 5)), B); tail.position.set(0, 0.85, -0.95); tail.rotation.x = -0.9; g.add(tail);
  const legs = []; for (const [x, z] of [[-0.16, 0.45], [0.16, 0.45], [-0.16, -0.45], [0.16, -0.45]]) { const L = new THREE.Group(); L.position.set(x, 0.58, z); const l = new THREE.Mesh(geo('sleg', () => new THREE.CylinderGeometry(0.05, 0.04, 0.58, 5)), B); l.position.y = -0.29; L.add(l); g.add(L); legs.push(L); }
  g.userData = { legs, arms: [], quad: true }; return g;
}

// ctx: { scene/root (THREE.Group to add to), ground(x,z), blocked(x,z), me() -> {x,z,y,alive}, hurt(n, kind), say(msg) }
export function createEnemies(ctx) {
  const root = new THREE.Group(); root.name = 'mm_enemies'; ctx.root.add(root);
  const list = [];
  let uid = 0;
  function spawn(kind, x, z, opt = {}) {
    const K = KINDS[kind]; if (!K) return null;
    const o = K.quad ? stalker(K) : skeleton(K); const y = ctx.ground(x, z); o.position.set(x, y, z); root.add(o);
    const hpBar = label('', { w: 128, h: 22, sx: 1.1 }); hpBar.position.y = (K.quad ? 1.5 : 2.25) * (K.scale || 1) / (o.scale.x || 1); o.add(hpBar);
    const e = { id: ++uid, kind, K, o, x, z, hx: opt.home?.[0] ?? x, hz: opt.home?.[1] ?? z, leash: opt.leash ?? 16, hp: opt.hp ?? K.hp, max: opt.hp ?? K.hp, cool: 0.6 + Math.random(), yaw: Math.random() * 6.28,
      dead: 0, walk: 0, swing: 0, tag: opt.tag || '', aggro: opt.aggro ?? 13, bar: hpBar, hitT: 0 };
    drawBar(e); list.push(e); return e;
  }
  function drawBar(e) { const c = e.bar.material.map.image, g = c.getContext('2d'); g.clearRect(0, 0, 128, 22); if (e.hp >= e.max || e.dead) { e.bar.visible = false; e.bar.material.map.needsUpdate = true; return; }
    e.bar.visible = true; g.fillStyle = '#161616'; g.fillRect(0, 0, 128, 22); g.fillStyle = e.kind === 'captain' ? '#c2185b' : '#d8322f'; g.fillRect(3, 3, 122 * Math.max(0, e.hp) / e.max, 16); e.bar.material.map.needsUpdate = true; }
  function damage(e, n, from) {
    if (!e || e.dead) return false; e.hp -= n; e.hitT = 0.18; drawBar(e);
    if (e.hp <= 0) { e.dead = 1.6; e.hp = 0; e.bar.visible = false; try { dispatchEvent(new CustomEvent('pfp-pve-kill', { detail: { kind: e.kind, tag: e.tag, id: e.id, x: e.x, z: e.z, from } })); } catch {} }
    return true;
  }
  function remove(e) { root.remove(e.o); const i = list.indexOf(e); if (i >= 0) list.splice(i, 1); }
  function clear(tag = null) { for (const e of [...list]) if (tag === null || e.tag === tag) remove(e); }
  const alive = (tag = null) => list.filter(e => !e.dead && (tag === null || e.tag === tag));
  // sword arc from the walker (battle.js swordHit): W position, f forward, S { reach, arc, dmg }
  function sword(W, f, S) {
    let any = false; for (const e of list) { if (e.dead) continue; const dx = e.x - W.x, dz = e.z - W.z, d = Math.hypot(dx, dz); if (d > (S.reach || 2.2) + 0.7 * (e.K.scale || 1)) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (dx * f.x + dz * f.z) / Math.max(0.01, d)))); if (ang > (S.arc || 1.2) + 0.15) continue; damage(e, S.dmg || 25, 'sword'); any = true; }
    return any;
  }
  // a musket ball along f from (x, z), first enemy within `best` metres: damage it, return { a } (its distance) or null
  function shot(x, z, f, best, dmg) {
    let hit = null, ha = best; for (const e of list) { if (e.dead) continue; const dx = e.x - x, dz = e.z - z, a = dx * f.x + dz * f.z; if (a < 0.3 || a > ha) continue;
      if (Math.abs(dx * f.z - dz * f.x) <= 0.55 * (e.K.scale || 1)) { ha = a; hit = e; } }
    if (!hit) return null; damage(hit, dmg || 34, 'musket'); return { a: ha, x: hit.x, z: hit.z, y: ctx.ground(hit.x, hit.z) + 1.2 };
  }
  function tick(dt, t) {
    const me = ctx.me(); let near = false;
    for (const e of [...list]) {
      const o = e.o, K = e.K;
      if (e.dead) { e.dead -= dt; o.rotation.x = Math.min(1.45, o.rotation.x + dt * 3); o.position.y -= dt * 0.25; if (e.dead <= 0) remove(e); continue; }
      e.cool = Math.max(0, e.cool - dt); e.hitT = Math.max(0, e.hitT - dt);
      let tx = e.hx, tz = e.hz, chase = false;
      if (me && me.alive) { const dm = Math.hypot(me.x - e.x, me.z - e.z), dh = Math.hypot(me.x - e.hx, me.z - e.hz);
        if (dm < e.aggro && dh < e.leash + 6) { tx = me.x; tz = me.z; chase = true; near = true; } }
      const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
      let moving = false;
      if (chase && d <= K.reach) { // swing
        e.yaw = Math.atan2(dx, dz); if (e.cool <= 0 && e.hitT <= 0) { e.cool = K.cool; e.swing = 0.45; ctx.hurt?.(K.dmg, e.kind, e); } }
      else if (d > (chase ? K.reach * 0.8 : 0.8)) {
        const sp = (chase ? K.speed : K.speed * 0.45) * dt, nx = e.x + dx / d * sp, nz = e.z + dz / d * sp;
        if (!ctx.blocked?.(nx, nz)) { e.x = nx; e.z = nz; moving = true; } else if (!ctx.blocked?.(nx, e.z)) { e.x = nx; moving = true; } else if (!ctx.blocked?.(e.x, nz)) { e.z = nz; moving = true; }
        e.yaw += Math.atan2(Math.sin(Math.atan2(dx, dz) - e.yaw), Math.cos(Math.atan2(dx, dz) - e.yaw)) * Math.min(1, dt * 8);
      }
      // separate from the others (no stacking)
      for (const q of list) if (q !== e && !q.dead) { const sx = e.x - q.x, sz = e.z - q.z, sd = Math.hypot(sx, sz); if (sd > 0.01 && sd < 0.9) { e.x += sx / sd * (0.9 - sd) * 0.5; e.z += sz / sd * (0.9 - sd) * 0.5; } }
      e.walk += (moving ? dt * (chase ? 9 : 5) : 0); e.swing = Math.max(0, e.swing - dt);
      o.position.set(e.x, ctx.ground(e.x, e.z), e.z); o.rotation.y = e.yaw;
      const U = o.userData, sw = Math.sin(e.walk) * (moving ? 0.6 : 0);
      U.legs.forEach((L, i) => { L.rotation.x = (U.quad ? (i === 0 || i === 3 ? 1 : -1) : (i ? 1 : -1)) * sw; });
      if (U.arms.length) { U.arms[0].rotation.x = -sw * 0.8; U.arms[1].rotation.x = e.swing > 0 ? -2.2 + (0.45 - e.swing) * 6 : sw * 0.8 - 0.3; }
      o.scale.y = (K.scale || 1) * (e.hitT > 0 ? 0.92 : 1);
    }
    return near;
  }
  return { root, list, spawn, damage, remove, clear, alive, sword, shot, tick, KINDS };
}
