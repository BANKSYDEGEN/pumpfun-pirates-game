// [backpack-pvp] Emerald-gold ward lanterns along the OUTER edge of the unified Island Safe Zone (BANKSY t1727u outline),
// each on a soft emerald ground disc. Never inside / on the Coliseum (safeZones.wardPosts skips it). Instanced: 4 draw calls total.
// Posts are authored in FOOT coords and placed in the scene's HARBOR frame (layout.footToHarbor); posts over water are skipped.
import * as THREE from 'three';
import { SAFEZONES_ON, wardPosts } from '../island/safeZones.js';

export function buildSafeZoneMarks(scene, world, layout) {
  if (!SAFEZONES_ON || !scene || !layout) return { clear() {}, root: null, posts: [] };
  const toH = layout.footToHarbor, H = layout.FM?.H;
  const posts = [];
  for (const [fx, fz] of wardPosts(14)) {
    if (H && H(fx, fz) < 1.2) continue;                              // [t1727u] dry land only — never harbor water / swim cove / lake
    const [x, z] = toH(fx, fz); const y = world?.ground?.(x, z) ?? 0; if (!Number.isFinite(y)) continue;
    posts.push([x, y, z]);
  }
  const root = new THREE.Group(); root.name = 'isle_safe_marks';
  const n = posts.length;
  const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.count = n; m.frustumCulled = false; root.add(m); return m; };
  const post = mk(new THREE.CylinderGeometry(0.08, 0.11, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.9 }));
  const lamp = mk(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 1.1, roughness: 0.4 }));
  const cap = mk(new THREE.ConeGeometry(0.25, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.35 }));
  const disc = mk(new THREE.CircleGeometry(0.9, 18), new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.28, depthWrite: false }));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), QF = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), S1 = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3();
  posts.forEach(([x, y, z], i) => {
    post.setMatrixAt(i, M.compose(P.set(x, y + 0.85, z), Q, S1));
    lamp.setMatrixAt(i, M.compose(P.set(x, y + 1.78, z), Q, S1));
    cap.setMatrixAt(i, M.compose(P.set(x, y + 2.0, z), Q, S1));
    disc.setMatrixAt(i, M.compose(P.set(x, y + 0.05, z), QF, S1));
  });
  const host = world?.root || scene; host.add(root); // hidden with the island when the harbor is off
  return {
    root, posts,
    clear() {
      try { host.remove(root); } catch {}
      root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    },
  };
}
