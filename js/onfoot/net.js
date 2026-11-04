// [Emerly] PUMPFUN PIRATES: other pirates on foot in YOUR harbor room. No new service and no extra messages: the on-foot pose
// rides inside the state each client already sends to its room at the transport tick (js/transport.js batches + suppresses
// idle states), as two small fields:
//   dk: berth id your ship is moored at ('' = at sea)      ft: [x, z, yaw*100, speed*10] while you walk ('' = aboard)
// Free-plan cap: a harbor room copy holds ~4 pirates, so at most 3 remote pirates are ever drawn (each ~5-10 draw calls).
import * as THREE from 'three';
import { loadPirate } from './pirate.js';
import { jumpArc } from './walker.js';
import { newBody, placeBody, stepBody, jumpBody, poseBody, waterFX, bodyFX } from './physics.js'; // [Raul] remote pirates fall + swim too
import { applyGear, cleanWire, gearFromWire, knownGearSkin, EYE_SWATCHES } from '../pirateGear.js';
import { createPetFollower } from './pets.js'; // [Raul items redo 2] their ground pet follows them here too (from 'gr', no new message)
import { isNetId } from '../safe.js'; // [security H5] // [Timothy] their shop gear ('gr')

const FT_MS = 330; // on-foot pose send interval (ms)
function nameTag(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.font = '40px "Just Another Hand", cursive'; const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = 'rgba(22,22,22,0.78)'; g.beginPath(); g.roundRect?.(128 - w / 2, 8, w, 48, 22); g.fill?.();
  g.fillStyle = '#ffcd77'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true, fog: false })); s.scale.set(2.4, 0.6, 1); s.renderOrder = 8; return s;
}
export function createFootNet({ scene, low, world, docking, maxPeers = 3 }) {
  const peers = new Map();
  let ftLast = '', ftAt = 0;
  function netState(me, fast = false) { // fields merged into YOUR outgoing room state; the walk pose refreshes at most ~3 Hz (FT_MS), so the
    // transport (which only sends changed fields) adds ~3 small messages / s while you walk and nothing while you stand still
    const now = performance.now();
    if (!me.active) ftLast = ''; else if (!ftLast || now - ftAt >= (fast ? 90 : FT_MS)) { ftAt = now; const q = fast ? 10 : 2; ftLast = [Math.round(me.w.x * q) / q, Math.round(me.w.z * q) / q, Math.round(me.w.yaw * 20) * 5, Math.round(me.w.speed * 2) * 5]; }
    // [v106] fj: your jump counter (changes once per jump; the transport only sends changed fields, older clients ignore it)
    return { dk: docking.berth && docking.mode === 'docked' ? docking.berth.id : '', ds: docking.fresh?.() ? 1 : 0, ft: ftLast,   // [v152] ds = 1 for a few s after the join spawn moored you (older clients ignore it)
      ...(me.active && me.w.jumps ? { fj: me.w.jumps } : {}) };
  }
  function onPeerState(m) { // a peer's state (any transport); m.i = id, m.n = name
    if (!m || !isNetId(m.i)) return null;
    const moved = docking.onPeer(m.i, typeof m.dk === 'string' ? m.dk : '', m.ds === 1 ? 1 : 0);
    let p = peers.get(m.i);
    const ft = Array.isArray(m.ft) && m.ft.length === 4 && m.ft.every(Number.isFinite) ? m.ft : null;
    if (ft) {
      if (!p) { if (peers.size >= maxPeers) return moved; const look = { skin: [...m.i].reduce((a, c) => a + c.charCodeAt(0), 0) % 5, hair: m.i.charCodeAt(m.i.length - 1) % 5 };
        const pirate = loadPirate({ look, low, bodyFromGear: true }); /* [v112] their BODY pick rides in 'gr' */ scene.add(pirate.object); p = { id: m.i, pirate, gw: null, tag: null, x: ft[0], z: ft[1], yaw: ft[2] / 100, tx: ft[0], tz: ft[1], tyaw: ft[2] / 100, speed: 0, heard: 0, name: '' }; peers.set(m.i, p); }
      if (Number.isFinite(m.fj) && m.fj !== p.fj) { if (p.fj !== undefined) p.jt = performance.now(); p.fj = m.fj; } // [v106] they jumped: play the arc here
      const gw = cleanWire(m.gr), sk = knownGearSkin(m.sk) ? m.sk : 'classic', ec = Number.isInteger(m.ec) && m.ec > 0 && m.ec <= EYE_SWATCHES.length ? m.ec : 0, gk = gw + '|' + sk + '|' + ec; if (gk !== p.gw) { p.gw = gk; const g = gearFromWire(gw); p.petId = g.parrot; applyGear(p.pirate, { ...g, eyeColor: ec }, { skin: sk }); } // [v115] + eye colour ('ec') // validated; missing = shirtless; clothes = their ship skin ('sk')
      p.tx = ft[0]; p.tz = ft[1]; p.tyaw = ft[2] / 100; p.tspeed = ft[3] / 10; p.heard = performance.now();
      const name = String(m.n ?? p.name ?? '').replace(/[<>&"'`\\]/g, '').slice(0, 20) || 'PIRATE';
      if (name !== p.name) { p.name = name; if (p.tag) { p.tag.material.map.dispose(); p.tag.removeFromParent(); } p.tag = nameTag(name); p.pirate.object.add(p.tag); p.tag.position.y = 2.75; }
    } else if (p && ('ft' in m)) drop(m.i); // they went back aboard
    else if (p) p.heard = performance.now();
    return moved;
  }
  function drop(id) { const p = peers.get(id); if (!p) return; p.pet?.dispose(); p.pirate.dispose(); if (p.tag) p.tag.material.map.dispose(); peers.delete(id); }
  const fx = waterFX(scene, low);
  function tick(dt) {
    const now = performance.now();
    for (const [id, p] of peers) {
      if (now - p.heard > 6000) { drop(id); docking.dropPeer(id); continue; }
      const k = Math.min(1, dt * 8); p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k; let d = p.tyaw - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * k;
      p.speed += ((p.tspeed || 0) - p.speed) * k;
      if (!p.body) { p.body = newBody(); placeBody(p.body, world, p.x, p.z, world.layer ? 1e4 : null); } /* [roundabout-bridge] first seen on a high bridge's deck strip = up on the deck (the wire has no height; one under it drops down as they walk off the strip) */ stepBody(p.body, world, p.x, p.z, dt, p.speed); bodyFX(fx, p.body, p.x, p.z, p.speed, dt); fx?.update();
      if (p.jt && p.jt !== p.jtH) { p.jtH = p.jt; if (p.body.swim) jumpBody(p.body, 0); }   // [Raul swim-anim] they jumped in deep water: the surface kick here too
      const jh = p.jt && !p.body.swim && !p.body.hop ? jumpArc((now - p.jt) / 1000) : 0; if (p.jt && now - p.jt > 900) p.jt = 0;
      const st = poseBody(p.pirate.object, p.body, p.x, p.z, p.yaw, p.speed, now / 1000, jh); p.pirate.update(dt, p.speed, st);
      if (p.petId && p.petId !== 'none') (p.pet ||= createPetFollower({ scene, world, low })).update(dt, p, { pirateObj: p.pirate.object, petId: p.petId }); else if (p.pet) { p.pet.dispose(); p.pet = null; }
    }
  }
  function clear() { for (const id of [...peers.keys()]) drop(id); }
  return { peers, netState, onPeerState, tick, clear, drop };
}
