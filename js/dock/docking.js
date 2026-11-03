// [Emerly] PUMPFUN PIRATES docking: sail slowly into a berth -> DOCK eases the ship in and moors it (parked + invulnerable
// inside SAFE HARBOR); SET SAIL eases it forward out of the slip and hands the helm back. Berths come from the layout
// (nearest free one wins). Other pirates in the harbor room claim berths through their synced state (dk = berth id);
// two pirates picking the same berth at once: the lower id keeps it, the other is moved to the next free berth.
const sm = (k) => k * k * (3 - 2 * k), wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const DOCK = { range: 30, slow: 6.6, inMin: 2.2, inMax: 4.2, outLen: 34, outT: 3.4 };

export function createDocking({ berths, myId }) {
  const byId = new Map(berths.map(b => [b.id, b]));
  const peers = new Map(); // peerId -> { berth, t }
  const st = { mode: 'sea', berth: null, t: 0, dur: 0, from: null, ctl: null };
  const takenBy = (id) => { for (const [pid, p] of peers) if (p.berth === id && performance.now() - p.t < 6000) return pid; return null; };
  const isFree = (b) => !takenBy(b.id) && (st.berth !== b);
  function nearest(x, z, maxD = DOCK.range, free = true) {
    let best = null, bd = maxD; for (const b of berths) { if (free && !isFree(b)) continue; const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } } return best; }
  // what the DOCK prompt should say for this ship: { berth } | { reason: 'fast' | 'full' } | null (no berth near)
  function query(s) {
    if (st.mode !== 'sea') return null;
    const any = nearest(s.x, s.z, DOCK.range, false); if (!any) return null;
    const b = nearest(s.x, s.z, DOCK.range + 12, true);
    if (!b) return { reason: berths.every(q => !isFree(q)) ? 'full' : 'taken' };
    if (Math.abs(s.speed) > DOCK.slow) return { reason: 'fast', berth: b };
    return { berth: b };
  }
  function begin(s, b) {
    const d = Math.hypot(b.x - s.x, b.z - s.z);
    Object.assign(st, { mode: 'in', berth: b, t: 0, dur: Math.min(DOCK.inMax, Math.max(DOCK.inMin, d / 6)), from: { x: s.x, z: s.z, yaw: s.yaw, speed: s.speed } });
    // bezier control: carry on along the current heading a little, so the ship swings in rather than sliding sideways
    const k = Math.min(12, d * 0.45); st.ctl = { x: s.x + Math.sin(s.yaw) * k, z: s.z + Math.cos(s.yaw) * k };
  }
  // SET SAIL: ease forward out of the slip and swing toward open water (berth.out), ending under way on the curve's heading
  function setSail(s) { if (st.mode !== 'docked') return false; const b = st.berth, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), o = b.out || { x: fx, z: fz }, L = b.outLen || DOCK.outLen; // [v117] quay berths: a short swing
    Object.assign(st, { mode: 'out', t: 0, dur: DOCK.outT, from: { x: b.x, z: b.z, yaw: b.yaw }, ctl: { x: b.x + fx * L * 0.5, z: b.z + fz * L * 0.5 }, to: { x: b.x + fx * L * 0.85 + o.x * L * 0.75, z: b.z + fz * L * 0.85 + o.z * L * 0.75 } }); return true; }
  function pose(s, x, z, yaw, speed) { s.x = x; s.z = z; s.yaw = yaw; s.speed = speed; s.turn = 0; }
  // call every frame AFTER the normal ship move: overrides the pose while docking / docked / leaving
  function tick(s, dt) {
    if (st.mode === 'sea') return false;
    const b = st.berth; if (!b && st.mode !== 'out') { st.mode = 'sea'; return false; } st.t += dt; const k = Math.min(1, st.t / st.dur), e = sm(k);   // [v131] never throw on a lost berth
    if (st.mode === 'in') {
      const u = 1 - e, x = u * u * st.from.x + 2 * u * e * st.ctl.x + e * e * b.x, z = u * u * st.from.z + 2 * u * e * st.ctl.z + e * e * b.z;
      pose(s, x, z, st.from.yaw + wrap(b.yaw - st.from.yaw) * e, (1 - e) * Math.max(1.5, Math.abs(st.from.speed)));
      if (k >= 1) { st.mode = 'docked'; st.t = 0; return 'docked'; }
    } else if (st.mode === 'docked') pose(s, b.x, b.z, b.yaw, 0);
    else if (st.mode === 'out') {
      const u = k * k * 0.5 + 0.5 * e, v = 1 - u, f = st.from, c = st.ctl, q = st.to; // starts gently, leaves at ~4 m/s
      const x = v * v * f.x + 2 * v * u * c.x + u * u * q.x, z = v * v * f.z + 2 * v * u * c.z + u * u * q.z;
      const tx = 2 * v * (c.x - f.x) + 2 * u * (q.x - c.x), tz = 2 * v * (c.z - f.z) + 2 * u * (q.z - c.z); // bezier tangent = heading
      pose(s, x, z, Math.atan2(tx, tz), 1 + 3.5 * k);
      if (k >= 1) { st.mode = 'sea'; st.berth = null; return 'free'; }
    }
    s.anchor = true; s.sail = 0;
    return true;
  }
  function release() { st.mode = 'sea'; st.berth = null; }
  // a peer's state: dk = berth id ('' = none)
  const peerBerth = (dk) => byId.has(dk) ? dk : (/^P[1-9][LR]$/.test(dk || '') && byId.has(dk.slice(0, 2)) ? dk.slice(0, 2) : dk); // [v117] old builds' P1L / P1R = pier 1's one berth
  function onPeer(id, dk) {
    dk = peerBerth(dk);
    if (dk && byId.has(dk)) peers.set(id, { berth: dk, t: performance.now() }); else peers.delete(id);
    // [v131] BANKSY "my ship drifted away": a docked ship used to give up its berth to any lower-id peer reporting it (even with you ashore),
    // sailing itself to another berth / releasing to sea. A moored ship now keeps its berth; only a ship still coming in moves over. Peers only report dk once moored.
    if (st.berth && dk === st.berth.id && st.mode === 'in') { // they win: move over
      const alt = nearest(st.berth.x, st.berth.z, 400, true);
      if (alt) { const old = st.berth; st.berth = null; return { moved: alt, from: old }; }
      return { moved: null };
    }
    return null;
  }
  const dropPeer = (id) => peers.delete(id);
  return { st, berths, query, begin, setSail, tick, release, onPeer, dropPeer, takenBy, isFree, nearest, get berth() { return st.berth; }, get mode() { return st.mode; } };
}
