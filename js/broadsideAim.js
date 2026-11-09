// PUMPFUN PIRATES · broadside ballistics (js/main.js fire + tests).
// [v347] turned down auto-aim / killed heat-seeking look. [cannon-assist] nudged player cone.
// [cannon-snake / t2434u]: restore PLAYER heat-seeking lock+lead (pre-v347 ~±43° + full lead),
// but FIX THE LOOK — leave the barrel roughly along the broadside (clamped launch steer), then a
// smooth limited-rate horizontal curve onto the predicted aim point. True path = drawn path.
// Gravity stays on. No extreme bow/stern snaps. AI assist stays on the v347 fireLine path.
// Post-turn: ship velocity inherited by balls is FORWARD-ONLY (no yaw-rate / tangential sideways).

export const AIM = Object.freeze({
  // Player heat-seek (pre-v347 lock width restored; launch soft; in-flight curve)
  cone: 0.75,       // ~43° lock window (was 0.30 / ~17° at v567)
  lead: 1.0,        // full target-velocity lead (was 0.34)
  maxDev: 0.40,     // launch steer budget ~23° off the gunports (leave roughly abeam; was 0.12)
  homeRate: 1.15,   // rad/s max horizontal redirect while homing (~66°/s — gradual, not a snap)
  homeT: 1.35,      // seconds of in-flight guidance after launch
  minAlong: 0.55,   // reject aim more than ~acos(0.55)≈57° off broadside (pre-v347 used 0.4≈66°)
  // AI unchanged since v347 / v567
  aiLead: 1,
  aiMaxDev: 0.23,
  H: 42,
  G: 20,
});

export function inCone(dir, dx, dz, cone = AIM.cone) {
  const d = Math.hypot(dx, dz);
  return d > 1e-6 && (dx * dir.x + dz * dir.z) / d > Math.cos(cone);
}

export function leadPoint(sx, sz, T, lead, H = AIM.H) {
  const d = Math.hypot(T.x - sx, T.z - sz), t = d / H, sp = (T.speed || 0) * lead;
  return { x: T.x + Math.sin(T.yaw || 0) * sp * t, z: T.z + Math.cos(T.yaw || 0) * sp * t };
}

// unit horizontal firing line: broadside normal turned toward aim by at most maxDev.
export function fireLine(dir, sx, sz, ax, az, maxDev) {
  const dx = ax - sx, dz = az - sz;
  const want = Math.atan2(dir.x * dz - dir.z * dx, dir.x * dx + dir.z * dz);
  const dev = Math.max(-maxDev, Math.min(maxDev, want)), c = Math.cos(dev), s = Math.sin(dev);
  const x = dir.x * c - dir.z * s, z = dir.x * s + dir.z * c;
  return { x, z, d: Math.max(0, dx * x + dz * z), dev };
}

export function gunVelocity(p, sx, sz, L, ty = 2, H = AIM.H, G = AIM.G) {
  const d = Math.max(4, L.d - ((p.x - sx) * L.x + (p.z - sz) * L.z)), t = Math.max(0.3, d / H);
  return { x: L.x * d / t, y: (ty - p.y) / t + 0.5 * G * t, z: L.z * d / t, t };
}

// Forward-only ship way (NO yaw-rate / tangential sideways). Used so snaking doesn't spray balls aft.
export function forwardVel(yaw, speed) {
  const sp = speed || 0;
  return { x: Math.sin(yaw || 0) * sp, z: Math.cos(yaw || 0) * sp };
}

// Aim HEIGHT for player heat-seek: hull side OR deck (arc-and-drop onto deck is fine).
// Never masts / sails / spyglass. Prefer hullY; shore footY+0.6; else waterline + deck/depth band.
export function hullAimY(T) {
  if (!T) return 1.6;
  if (Number.isFinite(T.hullY)) return T.hullY;
  if (Number.isFinite(T.footY)) return T.footY + 0.6;
  const y0 = Number.isFinite(T.y) ? T.y : 0;
  const ud = T.mesh?.userData || {};
  const deck = Number.isFinite(T.deckY) ? T.deckY : ud.deckY;
  const depth = Number.isFinite(T.depth) ? T.depth : (ud.depth || 3);
  // Prefer near-deck so arcing shots can land on the planks; still well below sail/spyglass height.
  if (Number.isFinite(deck)) return y0 + Math.max(1.0, Math.min(deck * 0.85, depth * 0.7 + 0.4));
  return y0 + Math.max(1.0, depth * 0.45);
}

// Cannonball hit band on a ship: waterline/keel up through the deck + short bulwark.
// Caps BELOW sail / mast / crow's-nest / spyglass so balls pass through rigging and detonate on hull or deck.
export function hullHitY0(s) {
  return (Number.isFinite(s?.y) ? s.y : 0) - 1.5;
}
export function hullHitY1(s) {
  const y0 = Number.isFinite(s?.y) ? s.y : 0;
  const ud = s?.mesh?.userData || {};
  const deck = Number.isFinite(s?.deckY) ? s.deckY : ud.deckY;
  const depth = Number.isFinite(s?.depth) ? s.depth : (ud.depth || 3);
  // deck + ~1.2 m bulwark / rail; never use hitLen/len (that reached into the sails)
  const top = Number.isFinite(deck) ? deck + 1.2 : depth * 0.75 + 1.4;
  return y0 + Math.max(2.2, Math.min(top, 6.5));
}
export function inHullBand(s, py) {
  return py > hullHitY0(s) && py < hullHitY1(s);
}

// Player heat-seek launch: desired velocity toward (ax,az,ty) from gun p, clamped so the
// horizontal leave-angle stays within maxDev of the broadside normal. Returns null if the
// unconstrained aim is too far off the beam (minAlong). vel0 (forward-only) is added after.
export function playerAimVelocity(p, dir, ax, az, ty = 2, maxDev = AIM.maxDev, minAlong = AIM.minAlong, H = AIM.H, G = AIM.G) {
  const tx = ax - p.x, tz = az - p.z;
  const d = Math.hypot(tx, tz);
  if (d < 1e-3) return null;
  const t = Math.max(0.3, d / H);
  let hx = tx / d, hz = tz / d;
  const along = hx * dir.x + hz * dir.z;
  if (along < minAlong) return null;
  // clamp leave direction to ±maxDev of broadside
  const want = Math.atan2(dir.x * hz - dir.z * hx, dir.x * hx + dir.z * hz);
  const dev = Math.max(-maxDev, Math.min(maxDev, want));
  const c = Math.cos(dev), s = Math.sin(dev);
  hx = dir.x * c - dir.z * s;
  hz = dir.x * s + dir.z * c;
  const range = Math.max(4, d);
  return {
    x: hx * range / t,
    y: (ty - p.y) / t + 0.5 * G * t,
    z: hz * range / t,
    t,
    ax, az, ty,
    launchDev: dev,
  };
}

// Limited-rate horizontal steer toward (tx,tz). Preserves horizontal speed; gravity is caller's job.
export function steerHoriz(vx, vz, px, pz, tx, tz, rate, dt) {
  const speed = Math.hypot(vx, vz);
  if (speed < 1e-6) return { x: vx, z: vz };
  const wx = tx - px, wz = tz - pz;
  if (Math.hypot(wx, wz) < 1e-6) return { x: vx, z: vz };
  const cur = Math.atan2(vx, vz), want = Math.atan2(wx, wz);
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const step = Math.max(-rate * dt, Math.min(rate * dt, d));
  const a = cur + step;
  return { x: Math.sin(a) * speed, z: Math.cos(a) * speed };
}

// Pure hit-rate harness: simulate one gun's ball against a box target. `mode`:
//   'v567' — parallel fireLine + no home (live before this change)
//   'heat' — playerAimVelocity + in-flight steerHoriz
export function simulateHit({
  mode = 'heat',
  yaw = 0, side = 'port', speed = 8, turn = 0, turnRate = 0.62, preTurn = 0,
  sx = 0, sz = 0, gunY = 2.4, gunAlong = 0, gunOut = 2.2,
  target, rangeHint = 55, dt = 1 / 60, maxT = 5,
  cone, lead, maxDev, homeRate, homeT, aiMaxDev,
} = {}) {
  const k = side === 'port' ? 1 : -1;
  // optional brief turn then fire (snaking): advance yaw by turn*turnRate for preTurn seconds
  let y = yaw, x = sx, z = sz;
  const pre = preTurn || 0;
  if (pre > 0 && turn) {
    let t = 0;
    while (t < pre) {
      y += turn * turnRate * dt;
      x += Math.sin(y) * speed * dt;
      z += Math.cos(y) * speed * dt;
      t += dt;
    }
  }
  const dir = { x: Math.cos(y) * k, z: -Math.sin(y) * k };
  const fw = { x: Math.sin(y), z: Math.cos(y) };
  const gx = x + fw.x * gunAlong + dir.x * gunOut;
  const gz = z + fw.z * gunAlong + dir.z * gunOut;
  const gp = { x: gx, y: gunY, z: gz };
  const T = target || { x: x + dir.x * rangeHint, z: z + dir.z * rangeHint, yaw: y + Math.PI, speed: 6 };
  const dx = T.x - x, dz = T.z - z;
  const useCone = cone ?? AIM.cone, useLead = lead ?? AIM.lead, useDev = maxDev ?? AIM.maxDev;
  if (!inCone(dir, dx, dz, useCone)) return { hit: false, reason: 'no-lock', flight: 0 };
  const lp = leadPoint(x, z, T, useLead);
  const vel0 = forwardVel(y, speed); // forward-only — no yaw-rate sideways
  let vx, vy, vz, home = null, aimX = lp.x, aimZ = lp.z, aimY = hullAimY(T);
  if (mode === 'v567') {
    const tf = Math.hypot(lp.x - x, lp.z - z) / AIM.H;
    const L = fireLine(dir, x, z, lp.x - vel0.x * tf, lp.z - vel0.z * tf, useDev);
    if (L.d < 4) return { hit: false, reason: 'line-short', flight: 0 };
    const g = gunVelocity(gp, x, z, L, aimY);
    vx = g.x + vel0.x; vy = g.y; vz = g.z + vel0.z;
  } else {
    const g = playerAimVelocity(gp, dir, lp.x, lp.z, aimY, useDev);
    if (!g) return { hit: false, reason: 'rejected-along', flight: 0 };
    vx = g.x + vel0.x; vy = g.y; vz = g.z + vel0.z;
    home = { x: g.ax, z: g.az, until: homeT ?? AIM.homeT, rate: homeRate ?? AIM.homeRate };
  }
  // target box (ship-ish)
  const hw = (T.beam || 5.2) / 2 + 0.7, hl = (T.len || 16) / 2 + 0.6;
  let px = gx, py = gunY, pz = gz, t = 0, ft = 0;
  const samples = [];
  while (t < maxT) {
    if (home && ft < home.until) {
      const s = steerHoriz(vx, vz, px, pz, home.x, home.z, home.rate, dt);
      vx = s.x; vz = s.z;
    }
    vy -= AIM.G * dt;
    px += vx * dt; py += vy * dt; pz += vz * dt;
    ft += dt; t += dt;
    if (samples.length < 80 && (samples.length === 0 || t - samples[samples.length - 1].t > 0.05)) {
      samples.push({ t, x: px, y: py, z: pz });
    }
    // move target
    T.x += Math.sin(T.yaw || 0) * (T.speed || 0) * dt;
    T.z += Math.cos(T.yaw || 0) * (T.speed || 0) * dt;
    // local hit test (yaw 0 box aligned — rotate into target frame)
    const c = Math.cos(T.yaw || 0), n = Math.sin(T.yaw || 0);
    const lx = (px - T.x) * c - (pz - T.z) * n;
    const lz = (px - T.x) * n + (pz - T.z) * c;
    // Hull/deck band only — balls above hullHitY1 (sails / spyglass) pass through
    const ship = { y: T.y || 0, deckY: T.deckY, depth: T.depth || 3 };
    if (Math.abs(lx) < hw && Math.abs(lz) < hl && inHullBand(ship, py)) {
      return { hit: true, flight: t, samples, reason: 'hit', impactY: py, aimY, y1: hullHitY1(ship) };
    }
    if (py < 0) return { hit: false, flight: t, samples, reason: 'splash' };
  }
  return { hit: false, flight: t, samples, reason: 'timeout' };
}
