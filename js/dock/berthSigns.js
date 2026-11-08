// [berth-signs] BANKSY "make the berth sign say the player name" / "put captain name on the b1 sign not floating in air": an occupied
// berth's own numbered post board (fixed jetty station, 1.9 m up) gets a face on each side reading the
// berth number + the moored captain (you, or a peer via their synced dk + n). Empty berth = the plain baked board (number only).
// One canvas texture per occupied berth, redrawn only when its captain changes (checked ~2x a second, never per frame).
import * as THREE from 'three';
const clean = (n) => String(n ?? '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).toUpperCase() || 'PIRATE';
export function createBerthSigns({ scene, berths, low }) {
  const signs = new Map(), geo = new THREE.PlaneGeometry(1.62, 0.86); let acc = 0;
  const fit = (g, t, fs, w, min) => { for (; fs > min; fs -= 2) { g.font = `bold ${fs}px system-ui,sans-serif`; if (g.measureText(t).width <= w) break; } };
  function draw(sg, id, name) {
    const c = sg.c, g = c.getContext('2d'), W = c.width, H = c.height, w = W * 0.88;
    g.fillStyle = '#3d2a1c'; g.fillRect(0, 0, W, H); g.strokeStyle = '#d9a441'; g.lineWidth = W / 64; g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff1d2'; fit(g, id, H * 0.42, w, H * 0.2); g.fillText(id, W / 2, H * 0.3, w);
    g.fillStyle = '#ffd36b'; fit(g, name, H * 0.3, w, H * 0.12); g.fillText(name, W / 2, H * 0.7, w); sg.tex.needsUpdate = true; sg.name = name;
  }
  // Sign-only reference points retain the pre-v418 station; physical bollards and ships can move independently.
  function post(b) { const [p, q] = b.signBollards || b.bollards || [], ax = b.ashore.x - b.x, az = b.ashore.z - b.z, n = Math.hypot(ax, az) || 1;
    if (!p || !q || !/^B\d+$/.test(b.id)) return null;
    // [v243] the baked board (plazaTown) faces ACROSS the jetty (side * PI/2), i.e. perpendicular to the bollard line; the v238 faces
    // faced along the line (berth -> ashore), so they sat edge-on inside the board and the name never showed
    const dx = p[0] - q[0], dz = p[1] - q[1], dl = Math.hypot(dx, dz) || 1; let nx = -dz / dl, nz = dx / dl; if (nx * ax + nz * az < 0) { nx = -nx; nz = -nz; }
    return { x: p[0] + dx / 16, z: p[1] + dz / 16, y: (b.ashore.y ?? 0) + 1.9, nx, nz }; }
  function make(b) {
    const P = post(b); if (!P) return null;
    const c = document.createElement('canvas'); c.width = low ? 256 : 512; c.height = c.width / 2;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const mat = new THREE.MeshBasicMaterial({ map: tex, fog: false, toneMapped: false });
    const m = new THREE.Group(); m.name = 'berth_sign_' + b.id; m.position.set(P.x, P.y, P.z); m.rotation.y = Math.atan2(P.nx, P.nz);
    for (const s of [1, -1]) { const f = new THREE.Mesh(geo, mat); f.position.z = s * 0.11; if (s < 0) f.rotation.y = Math.PI; m.add(f); } // a face just proud of each side of the board
    scene.add(m); return { m, mat, c, tex, name: '' };
  }
  function drop(id) { const sg = signs.get(id); if (!sg) return; sg.m.removeFromParent(); sg.mat.dispose(); sg.tex.dispose(); signs.delete(id); }
  // who(b) -> captain name or '' (empty berth)
  function tick(dt, who) { acc += dt; if (acc < 0.5) return; acc = 0;
    for (const b of berths) { const n = who(b); if (!n) { drop(b.id); continue; } const name = clean(n); let sg = signs.get(b.id); if (!sg) { sg = make(b); if (!sg) continue; signs.set(b.id, sg); } if (sg.name !== name) draw(sg, b.id, name); } }
  function clear() { for (const id of [...signs.keys()]) drop(id); }
  return { tick, clear, clean };
}
