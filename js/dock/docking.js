import { berthDisplayNumber } from './berthLabels.js';
import { parkedPose } from './parkPose.js';
// [Emerly] PUMPFUN PIRATES docking: sail slowly near a berth -> DOCK eases the ship in and moors it (parked + invulnerable
// inside SAFE HARBOR); SET SAIL eases it forward out of the slip and hands the helm back. Berths come from the layout
// (nearest stall owns its approach lane). Other pirates in the harbor room claim berths through their synced state (dk = berth id);
// two pirates picking the same berth at once: the lower id keeps it, the other is moved to the next free berth.
const sm = (k) => k * k * (3 - 2 * k), wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const DOCK = { range: 60, slow: 6.6, inMin: 2.2, inMax: 4.2, outLen: 34, outT: 3.4 };

export function createDocking({ berths, myId }) {
  const meId = () => String(typeof myId === 'function' ? myId() : myId); // [v152] a getter (the room id arrives after the harbor is built)
  const byId = new Map(berths.map(b => [b.id, b]));
  const spawnOrder = [...berths].sort((a,b) => berthDisplayNumber(a) - berthDisplayNumber(b));
  const peers = new Map(); // peerId -> { berth, t, fresh }
  const st = { mode: 'sea', berth: null, t: 0, dur: 0, from: null, ctl: null, spawnAt: 0, moveFrom: null };   // [v152] spawnAt = moored by the join spawn (a few s of grace to settle a clash)
  const takenBy = (id) => { for (const [pid, p] of peers) if (p.berth === id && performance.now() - p.t < 6000) return pid; return null; };
  const isFree = (b) => !takenBy(b.id) && (st.berth !== b);
  function nearest(x, z, maxD = DOCK.range, free = true) {
    let best = null, bd = maxD; for (const b of berths) { if (free && !isFree(b)) continue; const d = Math.hypot(b.x - x, b.z - z); if (d < bd) { bd = d; best = b; } } return best; }
  // what the DOCK prompt should say for this ship: { berth } | { reason: 'fast' | 'full' } | null (no berth near)
  function query(s) {
    if (st.mode !== 'sea') return null;
    const any = nearest(s.x, s.z, DOCK.range, false); if (!any) return null;
    // One nearest-stall catchment, not overlapping free-stall circles: never auto-glide
    // across an occupied ship / intervening jetty to a farther free stall.
    const b = any;
    if (!isFree(b)) return { reason: berths.every(q => !isFree(q)) ? 'full' : 'taken' };
    if (Math.abs(s.speed) > DOCK.slow) return { reason: 'fast', berth: b };
    return { berth: b };
  }
  function begin(s, b) {
    const d = Math.hypot(b.x - s.x, b.z - s.z);
    Object.assign(st, { spawnAt: 0, moveFrom: null, mode: 'in', berth: b, t: 0, dur: Math.min(DOCK.inMax, Math.max(DOCK.inMin, d / 6)), from: { x: s.x, z: s.z, yaw: s.yaw, speed: s.speed } });
    // bezier control: carry on along the current heading a little, so the ship swings in rather than sliding sideways
    const k = Math.min(12, d * 0.45); st.ctl = { x: s.x + Math.sin(s.yaw) * k, z: s.z + Math.cos(s.yaw) * k };
  }
  // SET SAIL: ease forward out of the slip and swing toward open water (berth.out), ending under way on the curve's heading
  function setSail(s) { if (st.mode !== 'docked') return false; const b = { ...st.berth, ...parkedPose(s, st.berth) }, fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), o = b.out || { x: fx, z: fz }, L = b.outLen || DOCK.outLen; // [v117] quay berths: a short swing
    Object.assign(st, { spawnAt: 0, moveFrom: null, mode: 'out', t: 0, dur: DOCK.outT, from: { x: b.x, z: b.z, yaw: b.yaw }, ctl: { x: b.x + fx * L * 0.5, z: b.z + fz * L * 0.5 }, to: { x: b.x + fx * L * 0.85 + o.x * L * 0.75, z: b.z + fz * L * 0.85 + o.z * L * 0.75 } }); return true; }
  function pose(s, x, z, yaw, speed) { s.x = x; s.z = z; s.yaw = yaw; s.speed = speed; s.turn = 0; }
  // call every frame AFTER the normal ship move: overrides the pose while docking / docked / leaving
  function tick(s, dt) {
    if (st.mode === 'sea') return false;
    const berth = st.berth, b = berth && { ...berth, ...parkedPose(s, berth) }; if (!b && st.mode !== 'out') { st.mode = 'sea'; return false; } st.t += dt; const k = Math.min(1, st.t / st.dur), e = sm(k);   // [v131] never throw on a lost berth
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
  function release() { st.mode = 'sea'; st.berth = null; st.spawnAt = 0; st.moveFrom = null; }
  // [v152] BANKSY "When they join harbor spawn them at an empty berth unless they are full then spawn them at sea":
  // lowest displayed open berth for auto-arrivals only; never shuffle established/manual ships.
  // Simultaneous claims retain the existing fresh-claim/id tie-break below (not a server-side reservation).
  const SPAWN_GRACE = 6000, fresh = () => st.mode === 'docked' && st.spawnAt > 0 && performance.now() - st.spawnAt < SPAWN_GRACE;
  function spawnPick(skip = null) {
    for (const b of spawnOrder) if (b !== skip && !takenBy(b.id) && st.berth !== b) return b; return null;
  }
  function moor(s, b) { Object.assign(st, { mode: 'docked', berth: b, t: 0, dur: 0, from: null, ctl: null, spawnAt: performance.now(), moveFrom: null }); const p = parkedPose(s, b); pose(s, p.x, p.z, b.yaw, 0); s.anchor = true; s.sail = 0; }
  // [berth-move] BANKSY t2329u "if berth is open can move ship to different one": your moored ship re-moors at another OPEN berth.
  // Berths are claimed through the room's synced state (dk), so the move is a fresh moor: ds = 1 for SPAWN_GRACE, and the v152 clash rule
  // settles two pirates picking the same open berth at once (an already-moored pirate keeps it; two fresh claims = the lower id keeps it).
  // The loser goes back to the berth it left (or the next free one), never out to sea.
  const canMoveTo = (b) => !!b && st.mode === 'docked' && !!st.berth && b !== st.berth && byId.get(b.id) === b && isFree(b);
  function moveTo(s, b) { if (!canMoveTo(b)) return false; const from = st.berth; moor(s, b); st.moveFrom = from; return true; }
  // a peer's state: dk = berth id ('' = none)
  const peerBerth = (dk) => byId.has(dk) ? dk : (/^P[1-9][LR]$/.test(dk || '') && byId.has(dk.slice(0, 2)) ? dk.slice(0, 2) : dk); // [v117] old builds' P1L / P1R = pier 1's one berth
  function onPeer(id, dk, ds = 0) {
    dk = peerBerth(dk);
    if (dk && byId.has(dk)) peers.set(id, { berth: dk, t: performance.now(), fresh: !!ds }); else peers.delete(id);
    // [v152] you were just moored by the join spawn and a pirate reports the same berth: an already-moored pirate (no ds) always keeps it
    // (the v131 rule), two fresh spawns = the lower id keeps it; the other one moves to the next free berth, or back out to sea if all are full
    if (st.berth && dk === st.berth.id && fresh() && (!ds || String(id) < meId())) {
      if (st.moveFrom) { const back = st.moveFrom, lost = st.berth; st.moveFrom = null; return { moveLost: (!takenBy(back.id) ? back : spawnPick(lost)) || null, lost }; }   // [berth-move]
      const alt = spawnPick(st.berth); return { spawnMoved: alt }; }
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
  return { st, berths, query, begin, setSail, tick, release, onPeer, spawnPick, moor, moveTo, canMoveTo, fresh, dropPeer, takenBy, isFree, nearest, get berth() { return st.berth; }, get mode() { return st.mode; } };
}
