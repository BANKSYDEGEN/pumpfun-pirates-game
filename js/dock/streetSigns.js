// [map-streets] weathered timber intersection signposts (BANKSY t1717u).
// Planted on terrain at roadside junctions from js/islandGeography.js STREET_SIGN_SPOTS.
import * as THREE from 'three';
import { STREET_SIGN_SPOTS } from '../islandGeography.js';

const WOOD = 0x6b4527, WOOD_D = 0x3d2a1c, BAND = 0xd9a441, FACE = 0xf4e2bb;

function bladeTex(dir, name, low) {
  const W = low ? 256 : 384, H = low ? 64 : 96;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#4a3018'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#d9a441'; g.lineWidth = 3; g.strokeRect(2, 2, W - 4, H - 4);
  g.fillStyle = '#fff1d2'; g.font = `bold ${Math.round(H * 0.28)}px system-ui,sans-serif`;
  g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(String(dir || '').slice(0, 2), 12, H * 0.5);
  g.fillStyle = '#ffd36b'; g.font = `bold ${Math.round(H * 0.36)}px system-ui,sans-serif`;
  g.textAlign = 'center';
  const t = String(name || '').toUpperCase().slice(0, 18);
  g.fillText(t, W * 0.58, H * 0.52, W * 0.7);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

export function createStreetSigns({ scene, world, layout, low = false }) {
  if (typeof location !== 'undefined' && /[?&]streetsigns=0(?:&|$)/.test(location.search || '')) return { clear() {}, tick() {} };
  const root = new THREE.Group(); root.name = 'street_signs';
  const FM = layout?.FM || world?.foot;
  const H = (fx, fz) => {
    try { if (typeof FM?.H === 'function') return FM.H(fx, fz); } catch {}
    try { if (typeof world?.foot?.H === 'function') return world.foot.H(fx, fz); } catch {}
    return 2.6;
  };
  const matWood = new THREE.MeshLambertMaterial({ color: WOOD });
  const matDark = new THREE.MeshLambertMaterial({ color: WOOD_D });
  const posts = [];

  for (const spot of STREET_SIGN_SPOTS) {
    // Offset slightly off the road centerline using yaw so the post sits at the kerb, not mid-road.
    const kerb = 2.6;
    const fx = spot.x + Math.cos(spot.yaw) * kerb, fz = spot.z - Math.sin(spot.yaw) * kerb;
    const hy = H(fx, fz);
    if (!Number.isFinite(hy) || hy < -1 || hy > 80) continue;
    const g = new THREE.Group(); g.position.set(fx, hy, fz); g.rotation.y = spot.yaw;
    // post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.1, 6), matDark);
    post.position.y = 1.55; post.castShadow = !low; g.add(post);
    // cap
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.36), matWood);
    cap.position.y = 3.15; g.add(cap);
    // blades
    (spot.blades || []).forEach((blade, i) => {
      const [dir, name] = blade;
      const tex = bladeTex(dir, name, low);
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, fog: false });
      const w = 1.55, h = 0.38, d = 0.06;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      const ang = (i - (spot.blades.length - 1) / 2) * 0.55;
      m.position.set(Math.sin(ang) * 0.15, 2.35 - i * 0.42, Math.cos(ang) * 0.05);
      m.rotation.y = ang;
      // arrow tip (wood)
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 3), matWood);
      tip.rotation.z = -Math.PI / 2; tip.position.set(w / 2 + 0.12, 0, 0); m.add(tip);
      g.add(m);
      posts.push({ mat, tex });
    });
    // tiny gold band
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 4, 8), new THREE.MeshBasicMaterial({ color: BAND }));
    band.rotation.x = Math.PI / 2; band.position.y = 2.05; g.add(band);
    root.add(g);
  }
  // Foot-frame props belong on the foot root (already placed by layout into the harbor scene).
  const host = world?.foot?.root || world?.footGroup || scene;
  host.add(root);

  function clear() {
    root.removeFromParent();
    for (const p of posts) { p.mat.dispose?.(); p.tex.dispose?.(); }
    posts.length = 0;
  }
  return { root, clear, tick() {} };
}
