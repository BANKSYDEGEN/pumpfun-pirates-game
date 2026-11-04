// [berth-signs] BANKSY "make the berth sign say the player name": a small two-sided board over each occupied berth's
// landing shows the moored captain (you, or a pirate in your harbor copy via their synced dk + n). Empty berth = no board.
// One canvas texture per occupied berth, redrawn only when its captain changes (checked ~2x a second, never per frame).
import * as THREE from 'three';
const clean = (n) => String(n ?? '').replace(/[\u0000-\u001f<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16).toUpperCase() || 'PIRATE';
export function createBerthSigns({ scene, berths, low }) {
  const signs = new Map(), geo = new THREE.PlaneGeometry(3.2, 0.8); let acc = 0;
  function draw(sg, name) {
    const c = sg.c, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#3a2414'; g.fillRect(0, 0, c.width, c.height); g.strokeStyle = '#d9a441'; g.lineWidth = 8; g.strokeRect(4, 4, c.width - 8, c.height - 8);
    let fs = 64; g.font = `bold ${fs}px system-ui,sans-serif`; const w = c.width - 40; while (fs > 26 && g.measureText(name).width > w) { fs -= 4; g.font = `bold ${fs}px system-ui,sans-serif`; }
    g.fillStyle = '#ffe7a8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(name, c.width / 2, c.height / 2 + 3, w); sg.tex.needsUpdate = true; sg.name = name;
  }
  function make(b) {
    const c = document.createElement('canvas'); c.width = low ? 256 : 512; c.height = c.width / 4;
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, fog: false, toneMapped: false }));
    m.position.set(b.ashore.x, (b.ashore.y ?? 0) + 2.6, b.ashore.z); m.rotation.y = b.yaw + Math.PI / 2; m.name = 'berth_sign_' + b.id; scene.add(m);
    return { m, c, tex, name: '' };
  }
  function drop(id) { const sg = signs.get(id); if (!sg) return; sg.m.removeFromParent(); sg.m.material.dispose(); sg.tex.dispose(); signs.delete(id); }
  // who(b) -> captain name or '' (empty berth)
  function tick(dt, who) { acc += dt; if (acc < 0.5) return; acc = 0;
    for (const b of berths) { const n = who(b); if (!n) { drop(b.id); continue; } const name = clean(n); let sg = signs.get(b.id); if (!sg) signs.set(b.id, sg = make(b)); if (sg.name !== name) draw(sg, name); } }
  function clear() { for (const id of [...signs.keys()]) drop(id); }
  return { tick, clear, clean };
}
