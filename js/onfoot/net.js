// [Emerly] PUMPFUN PIRATES: other pirates on foot in YOUR harbor room. No new service and no extra messages: the on-foot pose
// rides inside the state each client already sends to its room at the transport tick (js/transport.js batches + suppresses
// idle states), as two small fields:
//   dk: berth id your ship is moored at ('' = at sea)      ft: [x, z, yaw*100, speed*10] while you walk ('' = aboard)
// Free-plan cap: a harbor room copy holds ~4 pirates, so at most 3 remote pirates are ever drawn (each ~5-10 draw calls).
import * as THREE from 'three';
import { loadPirate } from './pirate.js';
import { jumpArc } from './walker.js';
import { applyGear, cleanWire, gearFromWire, knownGearSkin } from '../pirateGear.js';
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
  function netState(me) { // fields merged into YOUR outgoing room state; the walk pose refreshes at most ~3 Hz (FT_MS), so the
    // transport (which only sends changed fields) adds ~3 small messages / s while you walk and nothing while you stand still
    const now = performance.now();
    if (!me.active) ftLast = ''; else if (!ftLast || now - ftAt >= FT_MS) { ftAt = now; ftLast = [Math.round(me.w.x * 2) / 2, Math.round(me.w.z * 2) / 2, Math.round(me.w.yaw * 20) * 5, Math.round(me.w.speed * 2) * 5]; }
    // [v106] fj: your jump counter (changes once per jump; the transport only sends changed fields, older clients ignore it)
    return { dk: docking.berth && docking.mode === 'docked' ? docking.berth.id : '', ft: ftLast, ...(me.active && me.w.jumps ? { fj: me.w.jumps } : {}) };
  }
  function onPeerState(m) { // a peer's state (any transport); m.i = id, m.n = name
    if (!m || !isNetId(m.i)) return null;
    const moved = docking.onPeer(m.i, typeof m.dk === 'string' ? m.dk : '');
    let p = peers.get(m.i);
    const ft = Array.isArray(m.ft) && m.ft.length === 4 && m.ft.every(Number.isFinite) ? m.ft : null;
    if (ft) {
      if (!p) { if (peers.size >= maxPeers) return moved; const look = { skin: [...m.i].reduce((a, c) => a + c.charCodeAt(0), 0) % 5, hair: m.i.charCodeAt(m.i.length - 1) % 5 };
        const pirate = loadPirate({ look, low, bodyFromGear: true }); /* [v112] their BODY pick rides in 'gr' */ scene.add(pirate.object); p = { id: m.i, pirate, gw: null, tag: null, x: ft[0], z: ft[1], yaw: ft[2] / 100, tx: ft[0], tz: ft[1], tyaw: ft[2] / 100, speed: 0, heard: 0, name: '' }; peers.set(m.i, p); }
      if (Number.isFinite(m.fj) && m.fj !== p.fj) { if (p.fj !== undefined) p.jt = performance.now(); p.fj = m.fj; } // [v106] they jumped: play the arc here
      const gw = cleanWire(m.gr), sk = knownGearSkin(m.sk) ? m.sk : 'classic', gk = gw + '|' + sk; if (gk !== p.gw) { p.gw = gk; applyGear(p.pirate, gearFromWire(gw), { skin: sk }); } // validated; missing = shirtless; clothes = their ship skin ('sk')
      p.tx = ft[0]; p.tz = ft[1]; p.tyaw = ft[2] / 100; p.tspeed = ft[3] / 10; p.heard = performance.now();
      const name = String(m.n ?? p.name ?? '').replace(/[<>&"'`\\]/g, '').slice(0, 20) || 'PIRATE';
      if (name !== p.name) { p.name = name; if (p.tag) { p.tag.material.map.dispose(); p.tag.removeFromParent(); } p.tag = nameTag(name); p.pirate.object.add(p.tag); p.tag.position.y = 2.75; }
    } else if (p && ('ft' in m)) drop(m.i); // they went back aboard
    else if (p) p.heard = performance.now();
    return moved;
  }
  function drop(id) { const p = peers.get(id); if (!p) return; p.pirate.dispose(); if (p.tag) p.tag.material.map.dispose(); peers.delete(id); }
  function tick(dt) {
    const now = performance.now();
    for (const [id, p] of peers) {
      if (now - p.heard > 6000) { drop(id); docking.dropPeer(id); continue; }
      const k = Math.min(1, dt * 8); p.x += (p.tx - p.x) * k; p.z += (p.tz - p.z) * k; let d = p.tyaw - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * k;
      p.speed += ((p.tspeed || 0) - p.speed) * k;
      p.pirate.object.position.set(p.x, world.ground(p.x, p.z) + (p.jt ? jumpArc((now - p.jt) / 1000) : 0), p.z); p.pirate.object.rotation.y = p.yaw; p.pirate.update(dt, p.speed);
    }
  }
  function clear() { for (const id of [...peers.keys()]) drop(id); }
  return { peers, netState, onPeerState, tick, clear, drop };
}
