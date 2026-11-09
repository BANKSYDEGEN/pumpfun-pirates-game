// PUMPFUN PIRATES · [v347] BANKSY t1824u "turn down the auto aim for ships, make them aim a bit more and don't have it look like heat seeking missals".
// Pure broadside ballistics shared by js/main.js fire() (player + AI) and tests/v347ShoreSeaCombat.test.mjs:
//  - the player's assist only LOCKS a ship inside a ±~17° window off the broadside normal (v347 cut ±43° → ±15°; [cannon-assist] nudge to ±17°), so the captain still has to line the side up;
//  - a locked shot only bends its guns <= ~6.9° off the gunports (AI <= ~13°; was up to 66° = the "homing" snap) with a 34 % velocity lead (AI 100 %);
//  - EVERY gun fires along the SAME horizontal line (parallel out of its own port, no pinching onto one point) and only the elevation ranges;
//  - the ball flies its true parabola from frame 0 (no mid-air sideways ease in launchBall / updateBalls any more).
// [cannon-assist] t2423u "a bit better aim assist": player cone/maxDev/lead nudged only — AI unchanged, no heat-seeking, no in-flight guidance.
export const AIM = Object.freeze({ cone: 0.30, lead: 0.34, maxDev: 0.12, aiLead: 1, aiMaxDev: 0.23, H: 42, G: 20 });

// is (dx, dz) from the ship inside the player's lock window on the broadside whose unit normal is dir?
export function inCone(dir, dx, dz, cone = AIM.cone) { const d = Math.hypot(dx, dz); return d > 1e-6 && (dx * dir.x + dz * dir.z) / d > Math.cos(cone); }

// the led aim point on a target (x, z, yaw, speed) from a ship at (sx, sz): lead 0..1 of the target's travel during the flight
export function leadPoint(sx, sz, T, lead, H = AIM.H) {
  const d = Math.hypot(T.x - sx, T.z - sz), t = d / H, sp = (T.speed || 0) * lead;
  return { x: T.x + Math.sin(T.yaw || 0) * sp * t, z: T.z + Math.cos(T.yaw || 0) * sp * t };
}

// unit horizontal firing line: the broadside normal turned toward (ax - sx, az - sz) by at most maxDev rad. Returns { x, z, d, dev }
// (d = distance to the aim point measured ALONG that line, dev = the signed turn actually used).
export function fireLine(dir, sx, sz, ax, az, maxDev) {
  const dx = ax - sx, dz = az - sz, d = Math.hypot(dx, dz);
  const want = Math.atan2(dir.x * dz - dir.z * dx, dir.x * dx + dir.z * dz); // signed angle dir -> target
  const dev = Math.max(-maxDev, Math.min(maxDev, want)), c = Math.cos(dev), s = Math.sin(dev);
  const x = dir.x * c - dir.z * s, z = dir.x * s + dir.z * c;
  return { x, z, d: Math.max(0, dx * x + dz * z), dev };
}

// one gun's launch velocity along the shared line: gun at p (world), ship centre (sx, sz), line L from fireLine, target height ty.
// Range per gun = the line distance minus how far forward along the line that gun already sits, so the parallel spread survives.
export function gunVelocity(p, sx, sz, L, ty = 2, H = AIM.H, G = AIM.G) {
  const d = Math.max(4, L.d - ((p.x - sx) * L.x + (p.z - sz) * L.z)), t = Math.max(0.3, d / H);
  return { x: L.x * d / t, y: (ty - p.y) / t + 0.5 * G * t, z: L.z * d / t, t };
}
