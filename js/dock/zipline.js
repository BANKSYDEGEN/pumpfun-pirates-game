// [Emerly zipline] BANKSY 5:12 PM Nov 5: "add a zipline from waterfall hill to skull". CLIENT ONLY, &zipline=0 = none of it.
// Start: the top of Waterfall Hill (the highest ground above the falls lip); end: a landing below the Skull Peak cave. The cable sags a
// little and is lifted (towers grow) until it clears the ground + the tallest trees everywhere along it. Downhill only (the high end is the
// start); both ways if the two ends are within 3 m of each other. A ride: E / tap / pad A at a platform -> the handle lifts you to the cable,
// you slide with gravity-ish speed + a slight bob, then it lowers you onto the landing ground (always ground height, never inside terrain).
// No cancel mid-air (safer: nothing can drop you over the valley). Crew regroup behind you on arrival (followers.js > 40 m = regroup).
// Peers: your height rides in the foot net state ('fy', only while riding) so other pirates see you sliding (older clients: on the ground).
import * as THREE from 'three';
import { toon } from '../toon.js';
export const ZIP_ON = !(typeof location !== 'undefined' && /[?&]zipline=0(&|$)/.test(location.search));
export const ZIP = { treeClear: 13, sag: 0.025, vMin: 7, vMax: 24, g: 9.8, drag: 0.012, lift: 1.1, lower: 0.9, hang: 2.05, bob: 0.08 };
export function zipLine(FM) { // pure: the line in FOOT coords (exported for shots / probes)
  const H = (x, z) => FM.H(x, z);
  // Waterfall Hill: the highest ground in a 60 m ring above the falls lip (foot.js: lip = LAKE.z - LAKE.r - 10, x ~ -206)
  const cx = -206, cz = FM.LAKE.z - FM.LAKE.r - 30; let A = [cx, cz], ha = -1e9;
  for (let x = cx - 60; x <= cx + 60; x += 3) for (let z = cz - 60; z <= cz + 60; z += 3) { const h = H(x, z); if (h > ha) { ha = h; A = [x, z]; } }
  // the Skull landing: on the cave pad side, 26 m out from the cave mouth toward the hill, on flat-ish ground
  const S = FM.SKULL, dx = A[0] - S.x, dz = A[1] - S.z, n = Math.hypot(dx, dz); let B = [S.x + dx / n * 26, S.z + dz / n * 26];
  { let best = 1e9; for (let k = 18; k <= 40; k += 2) { const x = S.x + dx / n * k, z = S.z + dz / n * k, sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1)); if (sl < best) { best = sl; B = [x, z]; } } }
  const gA = H(...A), gB = H(...B), L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  let hA = 5.5, hB = 4.5; const sag = L * ZIP.sag;
  const cy = (t, a = hA, b = hB) => (gA + a) * (1 - t) + (gB + b) * t - sag * 4 * t * (1 - t);
  for (let it = 0; it < 6; it++) { let need = 0, at = 0.5; for (let i = 1; i < 120; i++) { const t = i / 120, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t, d = H(x, z) + ZIP.treeClear - cy(t); if (d > need) { need = d; at = t; } }
    if (need <= 0) break; hA += need * (1 - at) * 1.6 + 0.5; hB += need * at * 1.6 + 0.5; }
  let minClr = 1e9; for (let i = 1; i < 200; i++) { const t = i / 200, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t; minClr = Math.min(minClr, cy(t) - H(x, z)); }
  // BANKSY: one-way downhill only if the Skull end is LOWER than the hill; otherwise ride both ways
  const both = !(gB < gA - 3), from = gA >= gB ? 'A' : 'B';
  return { A, B, gA, gB, hA, hB, L, sag, both, from, minClr, y: (t) => cy(t) };
}
export function createZipline({ scene, world, layout, walker, toast = () => {}, low = false }) {
  if (!ZIP_ON) return null;
  const FM = layout.FM, Z = zipLine(FM), toH = layout.footToHarbor;
  const [ax, az] = toH(...Z.A), [bx, bz] = toH(...Z.B);
  const P = (t, out = new THREE.Vector3()) => out.set(ax + (bx - ax) * t, Z.y(t), az + (bz - az) * t);
  // ---- meshes: two towers + platforms, the cable (sagging tube), the handle ----
  const g = new THREE.Group(); g.name = 'zipline';
  const wood = toon(0x7a5230, null, { key: 'zip-wood' }), dark = toon(0x4a3220, null, { key: 'zip-dark' }), rope = toon(0x2b2622, null, { key: 'zip-rope' }), steel = toon(0xb8bec6, null, { key: 'zip-steel' });
  const yawAB = Math.atan2(bx - ax, bz - az);
  function tower(x, z, gy, h, yaw) { const t = new THREE.Group(); t.position.set(x, gy, z); t.rotation.y = yaw;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.3, 4.2), wood); deck.position.y = 0.15; t.add(deck);
    for (const sx of [-1.7, 1.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, h + 1.2, 6), dark); p.position.set(sx, (h + 1.2) / 2 - 0.4, 0); t.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.35, 0.35), dark); beam.position.y = h + 0.5; t.add(beam);
    for (const sx of [-1.7, 1.7]) { const br = new THREE.Mesh(new THREE.BoxGeometry(0.12, Math.min(h, 6), 0.12), wood); br.position.set(sx, Math.min(h, 6) / 2, 0.6); br.rotation.x = -0.35; t.add(br); }
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 0.08), wood); sign.position.set(0, 1.6, -2.0); t.add(sign);
    g.add(t); return t; }
  tower(ax, az, Z.gA, Z.hA, yawAB); tower(bx, bz, Z.gB, Z.hB, yawAB + Math.PI);
  const pts = []; for (let i = 0; i <= 64; i++) pts.push(P(i / 64).add(new THREE.Vector3(0, 0.5, 0)));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), low ? 64 : 160, 0.06, low ? 4 : 6, false), rope); cable.name = 'zip-cable'; g.add(cable);
  const handle = new THREE.Group(); { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 10).rotateZ(Math.PI / 2), steel); handle.add(tr);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6).rotateZ(Math.PI / 2), steel); bar.position.y = -0.55; handle.add(bar);
    for (const sx of [-0.3, 0.3]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 4), steel); s.position.set(sx, -0.28, 0); handle.add(s); } }
  handle.rotation.y = yawAB; handle.position.copy(P(0)).y += 0.5; g.add(handle);
  scene.add(g);
  // ---- interact spots (harbor coords; dock/index.js shows the prompt + calls start) ----
  const spots = [];
  const okA = Z.both || Z.from === 'A', okB = Z.both || Z.from === 'B';
  if (okA) spots.push({ id: 'zip_A', kind: 'zipline', end: 'A', x: ax, z: az, r: 4, label: 'RIDE ZIPLINE · TO SKULL PEAK' });
  if (okB) spots.push({ id: 'zip_B', kind: 'zipline', end: 'B', x: bx, z: bz, r: 4, label: 'RIDE ZIPLINE · TO WATERFALL HILL' });
  // ---- the ride ----
  let R = null; const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  function start(q) { if (R || !walker.w.active) return false; const dir = q.end === 'A' ? 1 : -1, t0 = dir > 0 ? 0 : 1, W = walker.w;
    R = { dir, t: t0, v: ZIP.vMin, ph: 'lift', k: 0, x0: W.x, y0: W.y, z0: W.z, bob: 0 };
    W.ride = ride; toast('HOLD ON!', 1200); return true; }
  function land() { const W = walker.w, [lx, lz] = R.dir > 0 ? [bx, bz] : [ax, az], yaw = R.dir > 0 ? yawAB : yawAB + Math.PI;
    // step off the deck a little forward, onto real ground (world.stand = the walk height there)
    const fx = lx + Math.sin(yaw) * 3.2, fz = lz + Math.cos(yaw) * 3.2; return { x: fx, z: fz, y: world.stand ? world.stand(fx, fz) : world.ground(fx, fz), yaw }; }
  function ride(dt) { const W = walker.w; dt = Math.min(dt, 0.05);
    const yaw = R.dir > 0 ? yawAB : yawAB + Math.PI;
    if (R.ph === 'lift') { R.k = Math.min(1, R.k + dt / ZIP.lift); const p = P(R.t, v3), e = R.k * R.k * (3 - 2 * R.k);
      W.x = R.x0 + (p.x - R.x0) * e; W.z = R.z0 + (p.z - R.z0) * e; W.y = R.y0 + (p.y + 0.5 - ZIP.hang - R.y0) * e; if (R.k >= 1) R.ph = 'slide'; }
    else if (R.ph === 'slide') { const a = P(R.t, v3), b = P(Math.min(1, Math.max(0, R.t + R.dir * 0.002)), v4), run = Math.max(1e-3, Math.hypot(b.x - a.x, b.z - a.z)), slope = (a.y - b.y) / run;
      R.v = Math.min(ZIP.vMax, Math.max(ZIP.vMin, R.v + (ZIP.g * slope * 0.9 - ZIP.drag * R.v * R.v) * dt));
      // ease in the last 30 m (the brake block), whatever the slope
      const left = (R.dir > 0 ? 1 - R.t : R.t) * Z.L; if (left < 30) R.v = Math.max(3, Math.min(R.v, 3 + left * 0.6));
      R.t += R.dir * R.v * dt / Z.L; R.bob += dt * (4 + R.v * 0.15);
      if ((R.dir > 0 && R.t >= 1) || (R.dir < 0 && R.t <= 0)) { R.t = R.dir > 0 ? 1 : 0; R.ph = 'lower'; R.k = 0; R.to = land(); }
      const p = P(R.t, v3); W.x = p.x; W.z = p.z; W.y = p.y + 0.5 - ZIP.hang + Math.sin(R.bob) * ZIP.bob * Math.min(1, R.v / 10); }
    else { R.k = Math.min(1, R.k + dt / ZIP.lower); const p = P(R.t, v3), e = R.k * R.k * (3 - 2 * R.k), T = R.to;
      W.x = p.x + (T.x - p.x) * e; W.z = p.z + (T.z - p.z) * e; W.y = (p.y + 0.5 - ZIP.hang) + (T.y - (p.y + 0.5 - ZIP.hang)) * e;
      if (R.k >= 1) { W.x = T.x; W.z = T.z; W.y = T.y; W.ride = null; const done = R; R = null; handle.position.copy(P(done.dir > 0 ? 0 : 1)).y += 0.5; toast(done.dir > 0 ? 'SKULL PEAK' : 'WATERFALL HILL', 1400); return 'done'; } }
    W.yaw = yaw; W.speed = 0;
    { let c = yaw - W.camYaw; c = Math.atan2(Math.sin(c), Math.cos(c)); if (!W.drags.size) W.camYaw += c * Math.min(1, dt * 1.2); }
    handle.position.set(W.x, W.y + ZIP.hang, W.z); return 'ride'; }
  return { spots, start, line: Z, ends: { A: [ax, az], B: [bx, bz] }, P, group: g, get riding() { return !!R; }, get state() { return R ? { ph: R.ph, t: R.t, v: R.v } : null } };
}
