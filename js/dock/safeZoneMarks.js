// [backpack-pvp] Emerald-gold ward lanterns along the OUTER edge of the unified Island Safe Zone (BANKSY t1727u outline),
// each on a soft emerald ground disc. Never inside / on the Coliseum (safeZones.wardPosts skips it). Instanced: 4 draw calls total.
// Posts are authored in FOOT coords and placed in the scene's HARBOR frame (layout.footToHarbor); posts over water are skipped.
// [v371] BANKSY t1971u/t1972u: lanterns RE-SEAT on the ground whenever Build Mode changes it (TERRAIN.rev), and never stand on a
// walkway (trails, town street, battle-area paths, painted PATH): a post that lands on one slides up to 9 m to the nearest clear,
// dry, level spot, or is dropped.
import * as THREE from 'three';
import { SAFEZONES_ON, wardPosts } from '../island/safeZones.js';
import { TERRAIN, onWalkway } from '../island/foot.js';

export function buildSafeZoneMarks(scene, world, layout) {
  if (!SAFEZONES_ON || !scene || !layout) return { clear() {}, root: null, posts: [] };
  const toH = layout.footToHarbor, H = layout.FM?.H;
  const SRC = wardPosts(14), MAX = SRC.length;
  const root = new THREE.Group(); root.name = 'isle_safe_marks';
  const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, MAX)); m.count = 0; m.frustumCulled = false; root.add(m); return m; };
  const post = mk(new THREE.CylinderGeometry(0.08, 0.11, 1.7, 6), new THREE.MeshStandardMaterial({ color: 0x2a1a0c, roughness: 0.9 }));
  const lamp = mk(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x10b981, emissiveIntensity: 1.1, roughness: 0.4 }));
  const cap = mk(new THREE.ConeGeometry(0.25, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.8, roughness: 0.35 }));
  const disc = mk(new THREE.CircleGeometry(0.9, 18), new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), Qd = new THREE.Quaternion(), QF = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2), S1 = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3();
  const gy = (fx, fz) => { const [x, z] = toH(fx, fz); const y = world?.ground?.(x, z); return Number.isFinite(y) ? y : null; };
  const dry = (fx, fz) => !(H && H(fx, fz) < 1.2);
  const ok = (fx, fz) => { if (!dry(fx, fz) || onWalkway(fx, fz)) return false; const y = gy(fx, fz); if (y == null) return false;
    const s = Math.max(Math.abs((gy(fx + 0.9, fz) ?? y) - (gy(fx - 0.9, fz) ?? y)), Math.abs((gy(fx, fz + 0.9) ?? y) - (gy(fx, fz - 0.9) ?? y))) / 1.8; return s < 0.6; }; // no posts on steep banks
  const posts = [];
  function place() {
    posts.length = 0; const used = [];
    for (const [fx0, fz0] of SRC) {
      let best = ok(fx0, fz0) ? [fx0, fz0] : null;
      for (let r = 2; !best && r <= 9; r += 1.5) for (let k = 0; k < 12 && !best; k++) { const a = k / 12 * Math.PI * 2, fx = fx0 + Math.cos(a) * r, fz = fz0 + Math.sin(a) * r; if (ok(fx, fz)) best = [fx, fz]; }
      if (!best || used.some(([ux, uz]) => Math.hypot(ux - best[0], uz - best[1]) < 6)) continue; used.push(best);
      const [x, z] = toH(best[0], best[1]), y = gy(best[0], best[1]);
      const dx = (world.ground(x + 0.6, z) ?? y) - (world.ground(x - 0.6, z) ?? y), dz = (world.ground(x, z + 0.6) ?? y) - (world.ground(x, z - 0.6) ?? y);
      posts.push([x, y, z, -dx / 1.2, -dz / 1.2]);
    }
    const n = posts.length; for (const m of [post, lamp, cap, disc]) m.count = n;
    posts.forEach(([x, y, z, nx, nz], i) => {
      post.setMatrixAt(i, M.compose(P.set(x, y + 0.8, z), Q, S1));   // sunk 5 cm into the ground: no floating foot on a bump
      lamp.setMatrixAt(i, M.compose(P.set(x, y + 1.73, z), Q, S1));
      cap.setMatrixAt(i, M.compose(P.set(x, y + 1.95, z), Q, S1));
      Qd.setFromUnitVectors(UP, N.set(nx, 1, nz).normalize()).multiply(QF);   // the glow disc lies ON the slope, not through it
      disc.setMatrixAt(i, M.compose(P.set(x, y + 0.06, z), Qd, S1));
    });
    for (const m of [post, lamp, cap, disc]) m.instanceMatrix.needsUpdate = true;
  }
  place();
  let rev = TERRAIN.rev, due = 0;
  const iv = setInterval(() => { if (TERRAIN.rev !== rev) { rev = TERRAIN.rev; due = performance.now() + 700; } else if (due && performance.now() > due) { due = 0; try { place(); } catch (e) { console.warn('[safe-marks]', e); } } }, 400);
  const host = world?.root || scene; host.add(root); // hidden with the island when the harbor is off
  return {
    root, posts, place,
    clear() {
      clearInterval(iv);
      try { host.remove(root); } catch {}
      root.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
    },
  };
}
