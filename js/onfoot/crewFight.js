// [backpack-pvp] BANKSY t1706u "If I shoot a player my crew shoots their crew" (+ the sword version):
//   you SHOOT a pirate (musket hit)  -> crew mode 'gun':   your shore crew hold a firing line near you, face THEIR crew and fire staggered
//                                       musket volleys (muzzle flash + smoke puff + tracer + hit spark, rival crew skirmish HP)
//   you SWING at a pirate (sword hit) -> crew mode 'sword': your crew draw cutlasses, rush THEIR crew and clash blades
//   switching weapons switches the crew mode live. Targets are ONLY enemyCrew[i % enemyCrew.length]: never the enemy captain, and an
//   enemy with 0 crew means your crew holds fire. Never inside an Island Safe Zone (attacker captain, crew member or target).
//   COSMETIC like the arena itself: crew skirmish HP is local to each screen (no gold, no K/D, no saves). Synced by two small fields in
//   the battle state you already send: cm (1 gun | 2 sword) + ct (target pirate id), so the other pirates see your crew attack too.
// No three.js import: THREE is injected (dock/index.js) so the logic + event log is unit-testable in node.
export const CREW_FIGHT_ON = !(typeof location !== 'undefined' && /[?&]crewfight=0(&|$)/.test(location.search || ''));
export const CREW_MODE = Object.freeze({ gun: 1, sword: 2 });
export const CF = Object.freeze({ holdS: 8, gunEvery: 1.5, gunStagger: 0.35, gunDmg: 25, swordEvery: 0.8, swordDmg: 20, reach: 1.25, rush: 5.2,
  range: 45, lineMax: 6.5, hp: 100, koS: 2.5 });

/** battle attack kind -> crew mode: 1 swing = sword, 2 fire = gun. */
export const crewModeFor = (kind) => (kind === 2 || kind === 'gun' || kind === 'shoot' || kind === 'musket' ? 'gun' : kind === 1 || kind === 'sword' || kind === 'melee' || kind === 'cutlass' ? 'sword' : null);
export const modeCode = (m) => CREW_MODE[m] || 0;
export const modeOfCode = (c) => (c === 1 ? 'gun' : c === 2 ? 'sword' : null);
/** attacker i -> defenders[i % n]; [] when the enemy has no crew (never the captain). */
export function crewTargets(attackers = [], defenders = []) {
  const D = (defenders || []).filter(Boolean); if (!D.length) return (attackers || []).map(() => null);
  return (attackers || []).map((_, i) => D[i % D.length]);
}

/**
 * @param o.crewOf(id)   -> crew list ('me' = yours) of { x, z, yaw, speed, p: { object } }
 * @param o.captainOf(id)-> { x, z } | null
 * @param o.inSafe(x, z) -> bool (HARBOR frame)
 * @param o.ground(x, z) -> y   o.THREE / o.scene optional (fx)   o.now() seconds
 */
export function createCrewFight({ crewOf, captainOf, inSafe = () => false, ground = () => 0, THREE = null, scene = null, sfx = null, now = () => performance.now() / 1000, isSquadMate = () => false } = {}) {
  const fights = new Map();                 // attackerId -> { mode, target, until, t0 }
  const hp = new WeakMap(), ko = new WeakMap(), cool = new WeakMap();
  const log = [];                           // { t, kind: 'shot' | 'slash', by, i, target, victim }
  const fx = [];
  function engage(attacker, mode, target, t = now()) {
    if (!CREW_FIGHT_ON || !attacker || !target || attacker === target || !modeCode(mode)) return false;
    // [v328] Harbor squad: crew never fight squadmates (or their captain)
    if ((attacker === 'me' && isSquadMate(target)) || (target === 'me' && isSquadMate(attacker))) { stop(attacker); return false; }
    const f = fights.get(attacker);
    if (f && f.mode === mode && f.target === target) { f.until = t + CF.holdS; return true; }
    fights.set(attacker, { mode, target, until: t + CF.holdS, t0: t });   // a new mode / target: switch at once
    for (const c of crewOf(attacker) || []) cool.set(c, (crewOf(attacker).indexOf(c)) * CF.gunStagger);
    return true;
  }
  function stop(attacker) { const f = fights.get(attacker); if (!f) return; fights.delete(attacker); for (const c of crewOf(attacker) || []) { c.fight = null; showWeapon(c, null); } }
  const safeAt = (p) => !!p && inSafe(p.x, p.z);
  // ---- fx (only with THREE) ----
  function weaponOf(c, mode) {
    if (!THREE || !c?.p?.object) return null; const o = c.p.object, u = o.userData; if (!u._cfW) {
      const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a1c, roughness: 0.8 }), steel = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 0.85, roughness: 0.3 }), brass = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.35 });
      const gun = new THREE.Group(); const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.55), wood); stock.position.z = 0.05; gun.add(stock);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.85, 6), steel); bar.rotation.x = Math.PI / 2; bar.position.set(0, 0.04, 0.6); gun.add(bar);
      gun.position.set(0.22, 1.32, 0.32); gun.name = 'crew_musket';
      const sword = new THREE.Group(); const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.85, 0.012), steel); blade.position.y = 0.5; sword.add(blade);
      const guard = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.015, 4, 8, Math.PI), brass); guard.position.y = 0.08; sword.add(guard);
      sword.position.set(0.32, 1.05, 0.28); sword.rotation.x = 0.9; sword.name = 'crew_cutlass';
      gun.visible = sword.visible = false; o.add(gun, sword); u._cfW = { gun, sword };
    }
    return u._cfW;
  }
  function showWeapon(c, mode) { const w = c?.p?.object?.userData?._cfW || (mode ? weaponOf(c, mode) : null); if (!w) return; w.gun.visible = mode === 'gun'; w.sword.visible = mode === 'sword'; }
  function puff(pos, color, size, life, rise = 0) {
    if (!THREE || !scene) return; const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.copy(pos); m.scale.setScalar(size); scene.add(m); fx.push({ m, life, t: 0, size, rise });
  }
  function tracer(a, b) {
    if (!THREE || !scene) return; const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.95 })); scene.add(l); fx.push({ m: l, life: 0.25, t: 0, line: true });
  }
  function hitCrew(victim, dmg) {
    const h = (hp.get(victim) ?? CF.hp) - dmg;
    if (h <= 0) { hp.set(victim, CF.hp); ko.set(victim, CF.koS); } else hp.set(victim, h);
  }
  const V = (x, y, z) => (THREE ? new THREE.Vector3(x, y, z) : { x, y, z });
  function tick(dt, t = now()) {
    for (const [a, f] of [...fights]) {
      // [v328] if a Harbor squad forms mid-fight, stop immediately
      if ((a === 'me' && isSquadMate(f.target)) || (f.target === 'me' && isSquadMate(a))) { stop(a); continue; }
      const mine = crewOf(a) || [], theirs = crewOf(f.target) || [], cap = captainOf(a), foe = captainOf(f.target);
      if (t > f.until || !mine.length || !cap || !foe || safeAt(cap) || safeAt(foe)) { stop(a); continue; }
      const tg = crewTargets(mine, theirs.filter((d) => !(ko.get(d) > 0)));
      mine.forEach((c, i) => {
        const d = tg[i];
        if (!d || safeAt(c) || safeAt(d) || ko.get(c) > 0) { c.fight = null; showWeapon(c, null); return; } // 0 enemy crew: hold fire (never the captain)
        c.fight = f.mode; showWeapon(c, f.mode);
        const dx = d.x - c.x, dz = d.z - c.z, dist = Math.hypot(dx, dz) || 1e-3; c.yaw = Math.atan2(dx, dz);
        let cd = (cool.get(c) ?? 0) - dt;
        if (f.mode === 'gun') {
          // firing line: stay within lineMax of your captain (step out a little for a clear shot), never sprint into melee
          const cx = c.x - cap.x, cz = c.z - cap.z, cdst = Math.hypot(cx, cz); c.speed = 0;
          if (cdst > CF.lineMax) { const k = Math.min(1, (cdst - CF.lineMax) / cdst); c.x -= cx * k * Math.min(1, dt * 3); c.z -= cz * k * Math.min(1, dt * 3); c.speed = 2; }
          if (cd <= 0 && dist <= CF.range) { cd = CF.gunEvery;
            const yaw = c.yaw, mz = V(c.x + Math.sin(yaw) * 1.05 + Math.cos(yaw) * 0.22, ground(c.x, c.z) + 1.36, c.z + Math.cos(yaw) * 1.05 - Math.sin(yaw) * 0.22), end = V(d.x, ground(d.x, d.z) + 1.1, d.z);
            tracer(mz, end); puff(mz, 0xffd27a, 0.16, 0.12); puff(mz, 0xe8e2d4, 0.28, 1.0, 0.6); puff(end, 0xfff1b0, 0.14, 0.2);
            sfx?.cannon?.(0.06); hitCrew(d, CF.gunDmg); log.push({ t, kind: 'shot', by: a, i, target: f.target, victim: d }); }
        } else {
          if (dist > CF.reach) { const s = Math.min(dist - CF.reach, CF.rush * dt); c.x += dx / dist * s; c.z += dz / dist * s; c.speed = CF.rush; }
          else { c.speed = 0; if (cd <= 0) { cd = CF.swordEvery; const w = c.p?.object?.userData?._cfW; if (w) w.sword.userData.sw = 1; puff(V((c.x + d.x) / 2, ground(d.x, d.z) + 1.2, (c.z + d.z) / 2), 0xfff1b0, 0.12, 0.18);
            sfx?.hit?.(0.25); hitCrew(d, CF.swordDmg); log.push({ t, kind: 'slash', by: a, i, target: f.target, victim: d }); } }
        }
        cool.set(c, cd);
        const w = c.p?.object?.userData?._cfW; if (w?.sword?.userData?.sw) { w.sword.userData.sw = Math.max(0, w.sword.userData.sw - dt * 4); w.sword.rotation.x = 0.9 - Math.sin(w.sword.userData.sw * Math.PI) * 1.8; }
      });
    }
    // knocked-down rival crew: lie down, then get back up
    for (const id of [...fights.keys(), ...[...fights.values()].map((f) => f.target)]) for (const c of crewOf(id) || []) {
      const k = ko.get(c); if (!(k > 0)) continue; const nk = k - dt; ko.set(c, nk);
      if (c.p?.object?.rotation) c.p.object.rotation.x = nk > 0 ? -1.35 * Math.min(1, (CF.koS - nk) * 4) : 0;
    }
    for (let i = fx.length - 1; i >= 0; i--) { const e = fx[i]; e.t += dt; const u = e.t / e.life;
      if (u >= 1) { scene?.remove(e.m); e.m.geometry?.dispose?.(); e.m.material?.dispose?.(); fx.splice(i, 1); continue; }
      e.m.material.opacity = 0.9 * (1 - u); if (!e.line) { e.m.scale.setScalar(e.size * (1 + u * 1.6)); e.m.position.y += (e.rise || 0) * dt; } }
    if (log.length > 200) log.splice(0, log.length - 200);
  }
  /** what my battle state sends: { cm, ct } (0 / '' = no crew fight) */
  function wire(me = 'me') { const f = fights.get(me); return f ? { cm: modeCode(f.mode), ct: f.target } : { cm: 0, ct: '' }; }
  /** a peer's cm / ct (their crew vs ct's crew; ct === myId = MY crew). */
  function remote(id, cm, ct, myId) {
    // [v328] Harbor squad: never let a squadmate's crew engage mine (or vice versa)
    const peerId = id, targetId = (ct === myId) ? 'me' : ct;
    if (isSquadMate(peerId) || (targetId && targetId !== 'me' && isSquadMate(targetId)) || (targetId === 'me' && isSquadMate(peerId))) { stop(peerId); return false; }
    const mode = modeOfCode(cm | 0); if (!mode || typeof ct !== 'string' || !ct) { if (fights.has(id)) stop(id); return; }
    engage(id, mode, targetId);
  }
  function clear() { for (const a of [...fights.keys()]) stop(a); for (const e of fx) scene?.remove(e.m); fx.length = 0; }
  return { engage, stop, tick, wire, remote, clear, log, fights, hpOf: (c) => hp.get(c) ?? CF.hp, koOf: (c) => ko.get(c) || 0, get active() { return fights.size > 0; } };
}
