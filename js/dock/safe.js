// [Emerly] PUMPFUN PIRATES SAFE HARBOR: a no-fire zone round the waterfront (layout.safe: circle or polygon).
// Inside it nobody fires and every ship is invulnerable; leaving it you still can't fire for layout.graceS seconds (no
// shooting from the doorway). AI ships and bosses never target a ship inside it and steer out of it.
export function createSafeZone(shape, graceS = 3) {
  const poly = shape.kind === 'poly' ? shape.pts : null;
  function inside(x, z, pad = 0) {
    if (!poly) return Math.hypot(x - shape.x, z - shape.z) < shape.r + pad;
    let inn = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, az] = poly[j], [bx, bz] = poly[i];
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inn = !inn; }
    if (inn || !pad) return inn;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [ax, az] = poly[j], [bx, bz] = poly[i], dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < pad) return true; }
    return false;
  }
  const centre = poly ? { x: poly.reduce((a, p) => a + p[0], 0) / poly.length, z: poly.reduce((a, p) => a + p[1], 0) / poly.length } : { x: shape.x, z: shape.z };
  // per-ship bookkeeping: s._safe = inside now, s._safeOut = time (s) it left the zone
  function tick(s, now) { const inn = inside(s.x, s.z); if (s._safe && !inn) s._safeOut = now; s._safe = inn; return inn; }
  const canFire = (s, now) => !inside(s.x, s.z) && !(s._safeOut && now - s._safeOut < graceS);
  const graceLeft = (s, now) => (!s._safe && s._safeOut && now - s._safeOut < graceS) ? graceS - (now - s._safeOut) : 0;
  // AI: if a ship is inside (or about to enter) the zone, turn away from its centre
  // (layout.safe.exit = a point out in open water to head for, e.g. the harbor centre; else straight away from the zone centre)
  const ex = shape.exit || null;
  function steer(e, desired) { if (!inside(e.x, e.z, 45)) return desired; return ex ? Math.atan2(ex.x - e.x, ex.z - e.z) : Math.atan2(e.x - centre.x, e.z - centre.z); }
  return { shape, inside, tick, canFire, graceLeft, steer, centre, graceS };
}
