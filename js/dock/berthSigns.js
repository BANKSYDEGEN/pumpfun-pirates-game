// [berth-signs] BANKSY "make the berth sign say the player name" / "fix the signs" (t2329u): ONE sign per berth, B1-B10.
// The sign sits exactly on the carved number plaque baked into assets/island/docks*.glb (the jetty station 2 m shoreward of
// the sign bollard, lz 17) and is a slightly larger box, so the old plain "B1" plaque is fully hidden inside it (it used to stand
// beside a second framed board 2.2 m away: two signs per berth). Each face reads the berth number + the moored captain
// (you, or a peer via their synced dk + n), or OPEN when the berth is free. One canvas per berth, redrawn only on change (~2x a second).
import * as THREE from 'three';
import { berthLabel } from './berthLabels.js';
export const cleanBerthName = (n) => { const text = String(n ?? '');
  if (/(?:0x[a-f0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44}|https?:\/\/|ref(?:erral)?[=:/])/i.test(text)) return 'PIRATE';
  return text.replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).toUpperCase() || 'PIRATE'; };
// Match berth IDs, not object identity: restored/copied local berth records still own their sign.
export function berthOccupantRawName(b, docking, localName, peerNames) {
  if (docking.berth?.id === b.id && docking.mode !== 'sea') return localName || 'PIRATE';
  const peer = docking.takenBy(b.id);
  return peer ? peerNames.get(peer) || 'PIRATE' : '';
}
export function berthOccupantName(b, docking, localName, peerNames) {
  const raw = berthOccupantRawName(b, docking, localName, peerNames);
  return raw ? cleanBerthName(raw) : '';
}
const clean = cleanBerthName;
// the baked plaque (tools/plaza_blender/docks_blender.py plaque()): 0.18 thick, 1.85 wide, frame bars 1.42..2.48 m over the deck.
// The cover is 0.30 x 1.24 x 2.0 centred 1.95 m up (0.04-0.08 m clear on every side), on the plaque's own 0.2 m post.
export const BERTH_SIGN = { w: 2.0, h: 1.24, t: 0.30, y: 1.95, face: 0.152 };
// sign station + facing for a berth (null = not a jetty berth): world x/z, y = board centre, (nx, nz) = across the jetty
export function berthSignPost(b) { const [p, q] = b.signBollards || b.bollards || [], ax = b.ashore.x - b.x, az = b.ashore.z - b.z;
  if (!p || !q || !/^B\d+$/.test(b.id)) return null;
  const dx = p[0] - q[0], dz = p[1] - q[1], dl = Math.hypot(dx, dz) || 1; let nx = -dz / dl, nz = dx / dl; if (nx * ax + nz * az < 0) { nx = -nx; nz = -nz; }
  const k = 2 / dl; return { x: p[0] + dx * k, z: p[1] + dz * k, y: (b.ashore.y ?? 0) + BERTH_SIGN.y, nx, nz }; }   // signBollards[0] = lz 19 -> the plaque's lz 17
export function createBerthSigns({ scene, berths, low }) {
  const posts = new Map(berths.map(b => [b.id, berthSignPost(b)]));
  const S = BERTH_SIGN, signs = new Map(), geo = new THREE.PlaneGeometry(S.w - 0.08, S.h - 0.08), boardGeo = new THREE.BoxGeometry(S.t, S.h, S.w), wood = new THREE.MeshLambertMaterial({ color: 0x3b2414 }); let acc = 0.5; // paint labels on the first harbor tick, then only poll at 2 Hz
  const fit = (g, t, fs, w, min) => { for (; fs > min; fs -= 2) { g.font = `900 ${fs}px Georgia,'Times New Roman',serif`; if (g.measureText(t).width <= w) break; } };
  function draw(sg, id, name) {
    const c = sg.c, g = c.getContext('2d'), W = c.width, H = c.height, w = W * 0.86, lw = Math.max(4, W / 56), open = !name;
    g.fillStyle = '#3d2a1c'; g.fillRect(0, 0, W, H); g.strokeStyle = '#d9a441'; g.lineWidth = lw; g.strokeRect(lw * 1.2, lw * 1.2, W - lw * 2.4, H - lw * 2.4);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const txt = (t, fill, fs, y, min) => { fit(g, t, fs, w, min); g.lineWidth = Math.max(3, fs / 9); g.strokeStyle = '#140b05'; g.strokeText(t, W / 2, y); g.fillStyle = fill; g.fillText(t, W / 2, y); };
    txt(id, '#ffd36b', H * 0.44, H * 0.33, H * 0.2);
    txt(open ? 'OPEN' : name, open ? '#9df0a2' : '#fff1d2', H * 0.27, H * 0.71, H * 0.1);
    sg.tex.needsUpdate = true; sg.name = name;
  }
  function make(b) {
    const P = posts.get(b.id); if (!P) return null;
    const c = document.createElement('canvas'); c.width = low ? 512 : 1024; c.height = Math.round(c.width * (S.h - 0.08) / (S.w - 0.08));   // canvas aspect = face aspect: no stretched text
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = low ? 2 : 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const m = new THREE.Group(); m.name = 'berth_sign_' + b.id; m.position.set(P.x, P.y, P.z); m.rotation.y = Math.atan2(P.nx, P.nz);
    const bd = new THREE.Mesh(boardGeo, wood); bd.rotation.y = Math.PI / 2; m.add(bd);   // the plaque's own baked post carries it
    for (const s of [1, -1]) { const f = new THREE.Mesh(geo, mat); f.position.z = s * S.face; if (s < 0) f.rotation.y = Math.PI; m.add(f); }   // a face just proud of each side
    scene.add(m); return { m, mat, c, tex, name: null, raw: null };
  }
  function drop(id) { const sg = signs.get(id); if (!sg) return; sg.m.removeFromParent(); sg.mat.dispose(); sg.tex.dispose(); signs.delete(id); }
  // who(b) -> captain name or '' (open berth); every jetty berth keeps its one sign
  function tick(dt, who) { acc += dt; if (acc < 0.5) return; acc = 0;
    for (const b of berths) { const raw = who(b) || ''; let sg = signs.get(b.id); if (!sg) { sg = make(b); if (!sg) continue; signs.set(b.id, sg); }
      if (sg.raw === raw) continue; sg.raw = raw; const name = raw ? clean(raw) : ''; if (sg.name !== name) draw(sg, berthLabel(b), name); } }
  function clear() { for (const id of [...signs.keys()]) drop(id); }
  return { tick, clear, clean, post: b => posts.get(b.id) || null };
}
