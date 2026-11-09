// [ship-collide] t2435u: ships bounce off each other instead of sailing through.
// Oriented ellipses (halfLen × halfBeam along yaw). Broad-phase circle first.
// Only moves local/controllable hulls — never another player's authoritative remote ship.
// Moored / berthed / nearly-stopped anchored hulls act as heavy/static. No collision damage.

export const COLLIDE = {
  pad: 0.35,           // inflate hull a touch so visual hulls don't interpenetrate
  restitution: 0.28,   // bounce along the contact normal (keep some energy)
  friction: 0.12,      // bleed a little of the tangential relative speed
  sepSlop: 0.04,       // leave a hair of gap after separation (kills jitter)
  maxSep: 2.8,         // cap positional correction per pair per frame (no launches)
  angKick: 0.045,      // yaw nudge scale from off-centre hits
  maxAng: 0.055,       // rad per pair per frame
  speedBleed: 0.55,    // how hard a head-on hit cuts forward speed
  staticMass: 1e9,     // moored / remote / sunk
  canoePad: 0.25,
  shakeMin: 0.22,      // camera bump floor when the local player is hit
  shakePer: 0.018,     // shake scale from closing speed
  thudMin: 1.6,        // min closing speed (m/s) before thud / shake
  iters: 2,            // solver passes (cheap; kills residual overlap)
};

const hypot = Math.hypot;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Half-extents of the collision ellipse (metres). */
export function hullHalf(s) {
  const u = s?.mesh?.userData || s?.hull || {};
  const hl = Math.max(2.5, ((u.hitLen || u.len || s.len || 14) * 0.5) + COLLIDE.pad);
  const hb = Math.max(1.2, ((u.beam || s.beam || 4.5) * 0.5) + COLLIDE.pad * 0.6);
  return { hl, hb };
}

/** Broad-phase radius (circle that covers the ellipse). */
export function hullR(s) {
  const { hl, hb } = hullHalf(s);
  return hypot(hl, hb);
}

/** Mass proxy from footprint (bigger hulls shove smaller ones). */
export function hullMass(s) {
  if (s?._collideStatic || s?.remote || s?.alive === false) return COLLIDE.staticMass;
  const { hl, hb } = hullHalf(s);
  return Math.max(8, hl * hb * 0.55);
}

/** Ellipse radius along a unit direction in local (beam=x, length=z) frame. */
export function ellipseRadius(hl, hb, ux, uz) {
  const d = (ux * ux) / (hb * hb) + (uz * uz) / (hl * hl);
  return d > 1e-12 ? 1 / Math.sqrt(d) : Math.max(hl, hb);
}

/** World forward unit for this ship's yaw convention (sin/cos, matches moveShip). */
export function forward(yaw) {
  return { x: Math.sin(yaw || 0), z: Math.cos(yaw || 0) };
}

/** Local (lx=beam, lz=length) of world delta from ship. */
export function toLocal(s, dx, dz) {
  const sy = Math.sin(s.yaw || 0), cy = Math.cos(s.yaw || 0);
  return { lx: dx * cy - dz * sy, lz: dx * sy + dz * cy };
}

/**
 * Approximate ellipse–ellipse contact along the centre line.
 * Returns null if separated, else { nx, nz, pen, d }.
 */
export function contact(a, b) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = hypot(dx, dz);
  if (d < 1e-5) {
    // Exact overlap of centres — push along a's beam so they unstick.
    const sy = Math.sin(a.yaw || 0), cy = Math.cos(a.yaw || 0);
    const ha = hullHalf(a), hb = hullHalf(b);
    return { nx: cy, nz: -sy, pen: ha.hb + hb.hb, d: 0 };
  }
  // Broad phase
  if (d > hullR(a) + hullR(b)) return null;

  const nx = dx / d, nz = dz / d;
  const la = toLocal(a, nx, nz);           // unit toward B in A's frame
  const lb = toLocal(b, -nx, -nz);         // unit toward A in B's frame
  const ha = hullHalf(a), hb = hullHalf(b);
  const ra = ellipseRadius(ha.hl, ha.hb, la.lx, la.lz);
  const rb = ellipseRadius(hb.hl, hb.hb, lb.lx, lb.lz);
  const need = ra + rb;
  if (d >= need) return null;
  return { nx, nz, pen: need - d, d, ra, rb };
}

function velWorld(s) {
  const f = forward(s.yaw);
  const sp = s.speed || 0;
  return { x: f.x * sp, z: f.z * sp };
}

function applySpeedAlong(s, nx, nz, deltaAlongNormal) {
  // Adjust forward speed by the component of the impulse along the bow.
  const f = forward(s.yaw);
  const along = f.x * nx + f.z * nz; // how much of normal is "forward"
  s.speed = (s.speed || 0) + deltaAlongNormal * along;
}

/**
 * Resolve one pair. Mutates movable ships' x/z/speed/yaw/turn.
 * opts.isStatic(s) -> treat as immovable heavy hull (moored etc.)
 * Returns impulse magnitude (0 if no hit), or null if no contact.
 */
export function resolvePair(a, b, dt, opts = {}) {
  if (!a || !b || a === b) return null;
  if (a.alive === false && b.alive === false) return null;
  const hit = contact(a, b);
  if (!hit) return null;

  const isStatic = opts.isStatic || ((s) => !!(s.remote || s._collideStatic || s.alive === false));
  const staticA = isStatic(a), staticB = isStatic(b);
  // Both immovable (two remotes, two moored): nothing we can do locally.
  if (staticA && staticB) return 0;

  let { nx, nz, pen } = hit;
  // Separation: push movable ships apart; static stays put.
  const sep = Math.min(pen + COLLIDE.sepSlop, COLLIDE.maxSep);
  let wA = staticA ? 0 : 1 / hullMass(a);
  let wB = staticB ? 0 : 1 / hullMass(b);
  const wSum = wA + wB || 1;
  if (wA) { a.x -= nx * sep * (wA / wSum); a.z -= nz * sep * (wA / wSum); }
  if (wB) { b.x += nx * sep * (wB / wSum); b.z += nz * sep * (wB / wSum); }

  // Velocity response along normal (closing only).
  const va = velWorld(a), vb = velWorld(b);
  const relN = (va.x - vb.x) * nx + (va.z - vb.z) * nz; // >0 = A moving into B along n (n = A→B)
  let impulse = 0;
  if (relN > 0.05) {
    const e = COLLIDE.restitution;
    const j = (1 + e) * relN / (wSum || 1);
    impulse = j;
    // Apply as change in world velocity projected back onto forward speed + a bit of turn.
    if (wA) {
      const invM = wA;
      applySpeedAlong(a, nx, nz, -j * invM);
      // Bleed forward speed on head-on (matches rock collide feel).
      const into = Math.max(0, forward(a.yaw).x * nx + forward(a.yaw).z * nz);
      a.speed *= Math.max(0.15, 1 - into * COLLIDE.speedBleed * Math.min(1, (dt || 1 / 60) * 8));
      // Angular nudge: contact side of A.
      const side = toLocal(a, nx, nz).lx; // +beam = starboard of A toward B
      const kick = clamp(-side * COLLIDE.angKick * Math.min(2.5, relN * 0.15), -COLLIDE.maxAng, COLLIDE.maxAng);
      a.yaw = (a.yaw || 0) + kick;
      a.turn = (a.turn || 0) + kick * 4;
    }
    if (wB) {
      const invM = wB;
      applySpeedAlong(b, nx, nz, j * invM);
      const into = Math.max(0, -(forward(b.yaw).x * nx + forward(b.yaw).z * nz));
      b.speed *= Math.max(0.15, 1 - into * COLLIDE.speedBleed * Math.min(1, (dt || 1 / 60) * 8));
      const side = toLocal(b, -nx, -nz).lx;
      const kick = clamp(-side * COLLIDE.angKick * Math.min(2.5, relN * 0.15), -COLLIDE.maxAng, COLLIDE.maxAng);
      b.yaw = (b.yaw || 0) + kick;
      b.turn = (b.turn || 0) + kick * 4;
    }
    // Light tangential friction on forward speeds (slide along hulls).
    if (COLLIDE.friction > 0) {
      const tx = -nz, tz = nx;
      const relT = (va.x - vb.x) * tx + (va.z - vb.z) * tz;
      const jt = clamp(relT * COLLIDE.friction, -impulse * 0.5, impulse * 0.5);
      if (wA) applySpeedAlong(a, tx, tz, -jt * wA);
      if (wB) applySpeedAlong(b, tx, tz, jt * wB);
    }
  } else if (pen > COLLIDE.sepSlop * 2) {
    // Resting contact: gently kill any residual push into each other.
    if (wA) a.speed *= 0.92;
    if (wB) b.speed *= 0.92;
  }

  if (wA && Number.isFinite(a.speed)) a.speed = clamp(a.speed, -5, 22);
  if (wB && Number.isFinite(b.speed)) b.speed = clamp(b.speed, -5, 22);
  a._shipHitT = 0.25;
  b._shipHitT = 0.25;
  return impulse || (pen > 0 ? 0.01 : 0);
}

/**
 * Resolve all pairs in `ships` (alive or sinking debris with alive===false still static).
 * opts: { isStatic, onHit(a,b,impulse,relN), player }
 * Returns number of contacts resolved.
 */
export function resolveAll(ships, dt, opts = {}) {
  if (!ships || ships.length < 2) return 0;
  const list = ships.filter((s) => s && (s.alive !== false || s._collideStatic || s.remote));
  // Prefer only living + remotes (dead already filtered unless flagged).
  const body = list.filter((s) => s.alive !== false || s.remote);
  let hits = 0;
  const n = body.length;
  for (let pass = 0; pass < COLLIDE.iters; pass++) {
    for (let i = 0; i < n; i++) {
      const a = body[i];
      const ra = hullR(a);
      for (let j = i + 1; j < n; j++) {
        const b = body[j];
        // Broad-phase centre distance
        const dx = b.x - a.x, dz = b.z - a.z;
        if (dx * dx + dz * dz > (ra + hullR(b)) * (ra + hullR(b))) continue;
        const imp = resolvePair(a, b, dt, opts);
        if (imp == null) continue;
        hits++;
        if (pass === 0 && opts.onHit) opts.onHit(a, b, imp);
      }
    }
  }
  return hits;
}

/**
 * Canoe (small boat) vs ships: only the canoe moves. Ships are always heavy here.
 * canoe = { x, z, yaw, speed, len?, beam?, halfBeam? }  (mutated)
 */
export function resolveCanoeVsShips(canoe, ships, dt, opts = {}) {
  if (!canoe || !ships?.length) return 0;
  const beam = canoe.beam || ((canoe.halfBeam || 0.78) * 2) + COLLIDE.canoePad;
  const c = {
    x: canoe.x, z: canoe.z, yaw: canoe.yaw || 0, speed: canoe.speed || 0, alive: true,
    mesh: { userData: { hitLen: canoe.len || 5.6, beam } },
  };
  let hits = 0;
  for (const s of ships) {
    if (!s || s.alive === false) continue;
    const imp = resolvePair(c, s, dt, {
      isStatic: (body) => body !== c, // only the canoe is movable in this pass
    });
    if (imp == null) continue;
    hits++;
  }
  canoe.x = c.x; canoe.z = c.z; canoe.yaw = c.yaw; canoe.speed = c.speed;
  return hits;
}

/** Default static predicate used by the game loop. */
export function defaultIsStatic(s, ctx = {}) {
  if (!s) return true;
  if (s.remote || s._collideStatic) return true;
  if (s.alive === false) return true;
  // Berthed at a harbor dock (local player via docking mode, remotes via dk → anchor+_safe).
  if (ctx.docked?.(s)) return true;
  if (s._docked) return true;
  // Nearly stopped + anchored in the safe harbor (moored waterline ships).
  if (s.anchor && s._safe && !(Math.abs(s.speed || 0) > 0.35)) return true;
  return false;
}
