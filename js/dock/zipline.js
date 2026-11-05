// [Emerly zipline-v2] BANKSY 6:10–6:13 PM Nov 5: cliff-edge chibi stands, lowered Skull gantry, timber stations,
// two-hand overhead grip, crew train behind you, ~1.8x speed, Jump/E mid-ride drop (crew drops too). CLIENT ONLY; &zipline=0 = none.
import * as THREE from 'three';
import { toon } from '../toon.js';
import { rig, arm, eul, BONES } from '../onfoot/swimPose.js';

export const ZIP_ON = !(typeof location !== 'undefined' && /[?&]zipline=0(&|$)/.test(location.search));
// chibi pirate ~1.75 m; arms-up reach ~2.15 m. Compact gantry: cable only ~2.85 m above deck planks.
export const ZIP = {
  treeClear: 9, sag: 0.018, vMin: 13, vMax: 44, g: 9.8, drag: 0.008, lift: 0.7, lower: 0.7,
  hang: 2.55, bob: 0.06, gantry: 2.85, crewGap: 0.3, crewDist: 4.2, grace: 0.25, cool: 0.6, dropVy: 1.2,
};

function rimToward(H, from, toward, { maxR = 90, step = 2, look = 8, minDrop = 5, minH = 35 } = {}) {
  const dx = toward[0] - from[0], dz = toward[1] - from[1], n = Math.hypot(dx, dz) || 1;
  let best = null, score = -1e9;
  for (let d = 4; d <= maxR; d += step) {
    const x = from[0] + dx / n * d, z = from[1] + dz / n * d, h = H(x, z);
    if (h < minH) continue;
    const h2 = H(x + dx / n * look, z + dz / n * look), drop = h - h2;
    if (drop < minDrop) continue;
    const flat = Math.abs(H(x + 1.2, z) - H(x - 1.2, z)) + Math.abs(H(x, z + 1.2) - H(x, z - 1.2));
    const sc = drop * 2.4 + h * 0.04 - flat * 1.8 - d * 0.02;
    if (sc > score) { score = sc; best = [x, z]; }
  }
  return best;
}

export function zipLine(FM) {
  const H = (x, z) => FM.H(x, z);
  const cx = -206, cz = FM.LAKE.z - FM.LAKE.r - 28;
  let hill = [cx, cz], ha = -1e9;
  for (let x = cx - 55; x <= cx + 55; x += 3) for (let z = cz - 55; z <= cz + 55; z += 3) {
    const h = H(x, z); if (h > ha) { ha = h; hill = [x, z]; }
  }
  const S = FM.SKULL, skullPad = [S.x, S.z];
  // cliff/ridge edges facing each other across the valley
  let A = rimToward(H, hill, skullPad, { maxR: 70, minDrop: 6, minH: 50 }) || hill;
  let B = rimToward(H, skullPad, A, { maxR: 55, minDrop: 5, minH: 70, look: 7 }) || (() => {
    const dx = A[0] - S.x, dz = A[1] - S.z, n = Math.hypot(dx, dz) || 1;
    let best = [S.x + dx / n * 22, S.z + dz / n * 22], bs = 1e9;
    for (let k = 14; k <= 36; k += 2) {
      const x = S.x + dx / n * k, z = S.z + dz / n * k;
      const sl = Math.abs(H(x + 1, z) - H(x - 1, z)) + Math.abs(H(x, z + 1) - H(x, z - 1));
      if (sl < bs) { bs = sl; best = [x, z]; }
    }
    return best;
  })();
  // nudge one more step toward the drop so the deck sits right on the lip
  { const dx = B[0] - A[0], dz = B[1] - A[1], n = Math.hypot(dx, dz) || 1;
    const tip = (P, s) => { const x = P[0] + dx / n * s, z = P[1] + dz / n * s; return H(x, z) > H(...P) - 2.5 ? [x, z] : P; };
    A = tip(A, 2); B = tip(B, -2);
  }
  const gA = H(...A), gB = H(...B), L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  // compact chibi gantries — Skull side kept low (boarding overhead only)
  let hA = ZIP.gantry, hB = Math.min(ZIP.gantry, 2.7);
  const sag = L * ZIP.sag;
  const cy = (t, a = hA, b = hB) => (gA + a) * (1 - t) + (gB + b) * t - sag * 4 * t * (1 - t);
  // raise ONLY the Waterfall end a little if needed; never turn Skull into a skyscraper (trees cleared under the cable instead)
  for (let it = 0; it < 5; it++) {
    let need = 0, at = 0.5;
    for (let i = 1; i < 160; i++) {
      const t = i / 160, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t;
      const d = H(x, z) + ZIP.treeClear - cy(t); if (d > need) { need = d; at = t; }
    }
    if (need <= 0) break;
    hA = Math.min(4.2, hA + need * (1 - at) * 1.1 + 0.15);
    hB = Math.min(3.2, hB + need * at * 0.35);
  }
  let minClr = 1e9; for (let i = 1; i < 220; i++) {
    const t = i / 220, x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t;
    minClr = Math.min(minClr, cy(t) - H(x, z));
  }
  const both = !(gB < gA - 3), from = gA >= gB ? 'A' : 'B';
  return { A, B, gA, gB, hA, hB, L, sag, both, from, minClr, y: (t) => cy(t) };
}

// ---- overhead two-hand grip (PirateGLB.addPost after mixer) ----
function figOf(pirate) {
  if (!pirate) return null;
  if (pirate.addPost) return pirate;
  const root = pirate.object || pirate;
  if (root.userData?.zipV4) return root.userData.zipV4;
  let v4 = null;
  root.traverse?.((o) => { if (!v4 && o.userData?.v4) v4 = o.userData.v4; });
  if (root.userData) root.userData.zipV4 = v4;
  return v4;
}
function zipPost() {
  const zp = this._zip, r = this._swRig || rig(this); if (!zp || !r || zp.w <= 0) return;
  const { B, R, dir } = r, S = zp.S;
  eul(S, R, 'root', 0, 0, 0); eul(S, R, 'spine', -0.08, 0, 0); eul(S, R, 'head', -0.12, 0, 0);
  // both arms straight up to the T-bar (hook hand reaches the same); slight inward so hands meet the bar
  for (const s of ['L', 'R']) arm(S, R, dir, s, 0.12, 1.55, 0.08, 0.28);
  const w = zp.w * zp.w * (3 - 2 * zp.w); for (const n of BONES) B[n].quaternion.slerp(S[n], w);
}
export function zipGrip(pirate, on, dt) {
  const fig = figOf(pirate); if (!fig) return;
  const zp = fig._zip || (fig._zip = { w: 0, S: Object.fromEntries(BONES.map((n) => [n, new THREE.Quaternion()])) });
  zp.w = Math.min(1, Math.max(0, zp.w + (on ? 1 : -1) * dt / (on ? 0.14 : 0.18)));
  if (fig.addPost) fig.addPost('zip', zipPost, 2); else if (!fig.post) fig.post = zipPost;
}

function clearTreesUnder(world, Z, toH) {
  const spots = world?.foot?.spots; if (!spots) return 0;
  const [ax, az] = toH(...Z.A), [bx, bz] = toH(...Z.B);
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const half = 7.5; let n = 0;
  for (const k of ['trees', 'palms']) {
    const src = spots[k]; if (!src?.length) continue;
    const keep = [];
    for (const t of src) {
      const px = t[0] - ax, pz = t[2] - az, along = px * ux + pz * uz, lat = Math.abs(px * uz - pz * ux);
      if (along > -6 && along < L + 6 && lat < half) { n++; continue; }
      keep.push(t);
    }
    spots[k] = keep;
  }
  return n;
}

export function createZipline({ scene, world, layout, walker, pirate = null, crew = null, toast = () => {}, low = false }) {
  if (!ZIP_ON) return null;
  const FM = layout.FM, Z = zipLine(FM), toH = layout.footToHarbor;
  const [ax, az] = toH(...Z.A), [bx, bz] = toH(...Z.B);
  const P = (t, out = new THREE.Vector3()) => out.set(ax + (bx - ax) * t, Z.y(t), az + (bz - az) * t);
  clearTreesUnder(world, Z, toH);

  const g = new THREE.Group(); g.name = 'zipline';
  const wood = toon(0x8a5a32, null, { key: 'zip-wood' }), dark = toon(0x4a3220, null, { key: 'zip-dark' });
  const plank = toon(0x9a6a3e, null, { key: 'zip-plank' }), rope = toon(0x2b2622, null, { key: 'zip-rope' });
  const steel = toon(0xb8bec6, null, { key: 'zip-steel' }), brass = toon(0xc9a227, null, { key: 'zip-brass' });
  const iron = toon(0x3a3a40, null, { key: 'zip-iron' }), glow = toon(0xffc14a, null, { key: 'zip-glow' });
  const yawAB = Math.atan2(bx - ax, bz - az);

  function makeTrolley() {
    const h = new THREE.Group();
    const pul = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12).rotateZ(Math.PI / 2), brass); h.add(pul);
    const hous = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.22), iron); hous.position.y = -0.06; h.add(hous);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), steel); rod.position.y = -0.38; h.add(rod);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.78, 8).rotateZ(Math.PI / 2), steel); bar.position.y = -0.62; h.add(bar);
    for (const sx of [-0.32, 0.32]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), brass); tip.position.set(sx, -0.62, 0); h.add(tip); }
    return h;
  }

  function station(x, z, gy, h, yaw) {
    const t = new THREE.Group(); t.position.set(x, gy, z); t.rotation.y = yaw;
    // planked deck
    for (let i = -2; i <= 2; i++) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 3.6), plank); pl.position.set(i * 0.78, 0.18, 0); t.add(pl);
    }
    const trim = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.16, 0.22), dark); trim.position.set(0, 0.28, 1.85); t.add(trim);
    const trimB = trim.clone(); trimB.position.z = -1.85; t.add(trimB);
    // under-deck pilings into the slope (long enough that nothing floats)
    for (const [px, pz] of [[-1.5, -1.2], [1.5, -1.2], [-1.5, 1.1], [1.5, 1.1], [0, -1.5], [0, 1.3]]) {
      const wx = x + Math.sin(yaw) * pz + Math.cos(yaw) * px, wz = z + Math.cos(yaw) * pz - Math.sin(yaw) * px;
      const gHere = world.ground ? world.ground(wx, wz) : gy;
      const len = Math.max(1.2, gy + 0.2 - (gHere - 0.8));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, len, 6), dark);
      post.position.set(px, 0.2 - len / 2, pz); t.add(post);
      // angled strut
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, Math.min(len * 0.7, 2.4), 0.1), wood);
      strut.position.set(px * 0.7, 0.05 - Math.min(len * 0.35, 1.0), pz * 0.5);
      strut.rotation.x = pz > 0 ? 0.45 : -0.45; t.add(strut);
    }
    // entry steps / ramp at the back
    for (let s = 0; s < 3; s++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.55), wood);
      st.position.set(0, 0.08 + s * 0.12, -2.15 - s * 0.45); t.add(st);
    }
    // side rails (open front launch + back entry)
    for (const sx of [-1.95, 1.95]) {
      for (const zz of [-1.2, 0.2, 1.2]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 5), dark); post.position.set(sx, 0.7, zz); t.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.6), wood); rail.position.set(sx, 1.05, 0); t.add(rail);
    }
    // A-frame / cross-braced gantry (compact chibi height)
    for (const sx of [-1.55, 1.55]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.35, 0.22), dark);
      leg.position.set(sx, (h + 0.35) / 2 + 0.15, 0); t.add(leg);
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.12, Math.min(h * 0.55, 1.5), 0.12), wood);
      knee.position.set(sx * 0.55, 0.9, 0.35); knee.rotation.z = sx > 0 ? 0.55 : -0.55; t.add(knee);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.28, 0.28), dark); beam.position.y = h + 0.35; t.add(beam);
    const xbrace = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), wood); xbrace.position.set(0, h * 0.55, 0); xbrace.rotation.z = 0.4; t.add(xbrace);
    const xbrace2 = xbrace.clone(); xbrace2.rotation.z = -0.4; t.add(xbrace2);
    // pulley / clamp on the beam
    const pul = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12).rotateZ(Math.PI / 2), brass);
    pul.position.set(0, h + 0.2, 0.15); t.add(pul);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.25), iron); clamp.position.set(0, h + 0.38, 0); t.add(clamp);
    // bollard + coiled rope behind
    const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.55, 8), iron); bol.position.set(-1.3, 0.55, -1.5); t.add(bol);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 12), rope); coil.rotation.x = Math.PI / 2; coil.position.set(-1.3, 0.35, -1.5); t.add(coil);
    // lantern + small pennant
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), dark); pole.position.set(1.6, 1.0, -1.4); t.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), glow); lamp.position.set(1.6, 1.65, -1.4); t.add(lamp);
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32), toon(0xfa0d0d, null, { key: 'zip-flag', side: THREE.DoubleSide }));
    pen.position.set(1.9, 1.85, -1.4); t.add(pen);
    g.add(t); return t;
  }

  station(ax, az, Z.gA, Z.hA, yawAB); station(bx, bz, Z.gB, Z.hB, yawAB + Math.PI);
  // walk decks flush with planks so the player walks onto the station
  if (layout.decks) {
    layout.decks.push(
      { id: 'zip_A', x: ax, z: az, yaw: yawAB, hw: 2.1, hl: 2.4, y: Z.gA + 0.24 },
      { id: 'zip_B', x: bx, z: bz, yaw: yawAB + Math.PI, hw: 2.1, hl: 2.4, y: Z.gB + 0.24 },
    );
  }

  const pts = []; for (let i = 0; i <= 72; i++) pts.push(P(i / 72).clone());
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), low ? 72 : 180, 0.055, low ? 4 : 6, false), rope);
  cable.name = 'zip-cable'; g.add(cable);

  const handle = makeTrolley(); handle.rotation.y = yawAB; handle.position.copy(P(0)); g.add(handle);
  const crewHandles = [];
  scene.add(g);

  const spots = [];
  const okA = Z.both || Z.from === 'A', okB = Z.both || Z.from === 'B';
  if (okA) spots.push({ id: 'zip_A', kind: 'zipline', end: 'A', x: ax, z: az, r: 4.2, label: 'RIDE ZIPLINE · TO SKULL PEAK' });
  if (okB) spots.push({ id: 'zip_B', kind: 'zipline', end: 'B', x: bx, z: bz, r: 4.2, label: 'RIDE ZIPLINE · TO WATERFALL HILL' });

  let R = null, coolUntil = 0; const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();

  function landAt(dir) {
    const [lx, lz] = dir > 0 ? [bx, bz] : [ax, az], yaw = dir > 0 ? yawAB : yawAB + Math.PI;
    const fx = lx + Math.sin(yaw) * 3.4, fz = lz + Math.cos(yaw) * 3.4;
    return { x: fx, z: fz, y: world.stand ? world.stand(fx, fz) : world.ground(fx, fz), yaw };
  }

  function spawnCrew(dir, t0) {
    const list = crew?.list || [];
    for (const h of crewHandles) { h.removeFromParent(); }
    crewHandles.length = 0;
    list.forEach((c, i) => {
      if (!c.p?.object?.visible) return;
      const h = makeTrolley(); h.rotation.y = yawAB; h.visible = false; g.add(h); crewHandles.push(h);
      c.zip = { dir, t: t0, v: 0, ph: 'wait', k: 0, delay: ZIP.crewGap + i * (ZIP.crewGap + 0.05), handle: h, x0: c.x, y0: c.y, z0: c.z };
    });
  }

  function dropCrew(vx, vz) {
    for (const c of crew?.list || []) {
      if (!c.zip) continue;
      const h = c.zip.handle; if (h) { h.visible = false; h.removeFromParent(); }
      zipGrip(c.p, false, 1);
      const B = c.body, floor = world.stand ? world.stand(c.x, c.z) : world.ground(c.x, c.z);
      c.y = Math.max(c.y, floor + 0.05); B.y = c.y; B.air = true; B.airT = 0; B.vy = ZIP.dropVy * 0.6; B.swim = false;
      c.zipVx = vx * 0.85; c.zipVz = vz * 0.85; c.zip = null;
    }
    crewHandles.length = 0;
  }

  function finishCrew(dir) {
    const Lnd = landAt(dir);
    (crew?.list || []).forEach((c, i) => {
      if (!c.zip) return;
      const h = c.zip.handle; if (h) { h.visible = false; h.removeFromParent(); }
      zipGrip(c.p, false, 1);
      const ang = Lnd.yaw + (i - 1) * 0.35, d = 1.4 + i * 0.7;
      c.x = Lnd.x + Math.sin(ang) * d; c.z = Lnd.z + Math.cos(ang) * d;
      c.y = world.stand ? world.stand(c.x, c.z) : world.ground(c.x, c.z); c.yaw = Lnd.yaw;
      if (c.body) { c.body.y = c.y; c.body.air = false; c.body.vy = 0; }
      c.zip = null;
    });
    crewHandles.length = 0;
  }

  function start(q) {
    if (R || !walker.w.active) return false;
    if (performance.now() / 1000 < coolUntil) return false;
    const dir = q.end === 'A' ? 1 : -1, t0 = dir > 0 ? 0 : 1, W = walker.w;
    R = { dir, t: t0, v: ZIP.vMin * 1.15, ph: 'lift', k: 0, x0: W.x, y0: W.y, z0: W.z, bob: 0, t0: performance.now() / 1000 };
    W.ride = ride; W.jumpQ = false; spawnCrew(dir, t0); toast('HOLD ON!', 1000); return true;
  }

  function drop() {
    if (!R) return false;
    const W = walker.w, yaw = R.dir > 0 ? yawAB : yawAB + Math.PI, v = Math.max(4, R.v * 0.9);
    const vx = Math.sin(yaw) * v, vz = Math.cos(yaw) * v;
    dropCrew(vx, vz);
    zipGrip(pirate, false, 1);
    const B = W.body, floor = world.stand ? world.stand(W.x, W.z) : world.ground(W.x, W.z);
    W.y = Math.max(W.y, floor + 0.08); B.y = W.y; B.air = true; B.airT = 0; B.vy = ZIP.dropVy; B.swim = false; B.hop = false; B.climb = 0;
    W.zipVx = vx; W.zipVz = vz; W.ride = null; W.speed = v; W.jumpQ = false;
    handle.position.copy(P(R.dir > 0 ? 0 : 1)); coolUntil = performance.now() / 1000 + ZIP.cool;
    R = null; toast('LET GO!', 900); return 'drop';
  }

  function rideCrew(dt) {
    for (const c of crew?.list || []) {
      const z = c.zip; if (!z) continue;
      if (z.ph === 'wait') {
        z.delay -= dt; if (z.delay > 0) continue;
        z.ph = 'lift'; z.k = 0; if (z.handle) z.handle.visible = true;
      }
      const yaw = z.dir > 0 ? yawAB : yawAB + Math.PI;
      if (z.ph === 'lift') {
        z.k = Math.min(1, z.k + dt / ZIP.lift); const p = P(z.t, v3), e = z.k * z.k * (3 - 2 * z.k);
        c.x = z.x0 + (p.x - z.x0) * e; c.z = z.z0 + (p.z - z.z0) * e;
        c.y = z.y0 + (p.y - ZIP.hang - z.y0) * e; if (z.k >= 1) { z.ph = 'slide'; z.v = ZIP.vMin; }
      } else if (z.ph === 'slide') {
        // match player speed curve, stay staggered by remaining delay distance
        const lead = R ? R.t : (z.dir > 0 ? 1 : 0);
        const want = lead - z.dir * (ZIP.crewDist / Z.L) * ((crewHandles.indexOf(z.handle) + 1) || 1);
        const a = P(z.t, v3), b = P(Math.min(1, Math.max(0, z.t + z.dir * 0.002)), v4);
        const run = Math.max(1e-3, Math.hypot(b.x - a.x, b.z - a.z)), slope = (a.y - b.y) / run;
        z.v = Math.min(ZIP.vMax, Math.max(ZIP.vMin, z.v + (ZIP.g * slope * 0.9 - ZIP.drag * z.v * z.v) * dt));
        const left = (z.dir > 0 ? 1 - z.t : z.t) * Z.L; if (left < 35) z.v = Math.max(4, Math.min(z.v, 4 + left * 0.7));
        // catch toward staggered slot
        const gap = (want - z.t) * z.dir; if (gap < -0.002) z.v *= 0.92; else if (gap > 0.01) z.v = Math.min(ZIP.vMax, z.v + 8 * dt);
        z.t += z.dir * z.v * dt / Z.L;
        if ((z.dir > 0 && z.t >= 1) || (z.dir < 0 && z.t <= 0)) { z.t = z.dir > 0 ? 1 : 0; z.ph = 'lower'; z.k = 0; z.to = landAt(z.dir); }
        const p = P(z.t, v3); c.x = p.x; c.z = p.z; c.y = p.y - ZIP.hang;
      } else {
        z.k = Math.min(1, z.k + dt / ZIP.lower); const p = P(z.t, v3), e = z.k * z.k * (3 - 2 * z.k), T = z.to;
        c.x = p.x + (T.x - p.x) * e; c.z = p.z + (T.z - p.z) * e; c.y = (p.y - ZIP.hang) + (T.y - (p.y - ZIP.hang)) * e;
        if (z.k >= 1) {
          c.x = T.x; c.z = T.z; c.y = T.y; if (c.body) { c.body.y = c.y; c.body.air = false; c.body.vy = 0; }
          zipGrip(c.p, false, 1); if (z.handle) { z.handle.visible = false; z.handle.removeFromParent(); }
          c.zip = null; continue;
        }
      }
      c.yaw = yaw; c.speed = 0; if (c.body) { c.body.y = c.y; c.body.air = false; c.body.vy = 0; c.body.swim = false; }
      zipGrip(c.p, z.ph === 'slide' || (z.ph === 'lift' && z.k > 0.4), dt);
      if (z.handle) { z.handle.visible = true; z.handle.position.set(c.x, c.y + ZIP.hang, c.z); z.handle.rotation.y = yawAB; }
    }
  }

  function ride(dt) {
    const W = walker.w; dt = Math.min(dt, 0.05);
    const yaw = R.dir > 0 ? yawAB : yawAB + Math.PI;
    const age = performance.now() / 1000 - R.t0;
    if (age >= ZIP.grace && R.ph !== 'lower') {
      if (W.jumpQ || W.zipDrop) { W.jumpQ = false; W.zipDrop = false; return drop(); }
    } else { W.jumpQ = false; W.zipDrop = false; }

    if (R.ph === 'lift') {
      R.k = Math.min(1, R.k + dt / ZIP.lift); const p = P(R.t, v3), e = R.k * R.k * (3 - 2 * R.k);
      W.x = R.x0 + (p.x - R.x0) * e; W.z = R.z0 + (p.z - R.z0) * e;
      W.y = R.y0 + (p.y - ZIP.hang - R.y0) * e; if (R.k >= 1) R.ph = 'slide';
    } else if (R.ph === 'slide') {
      const a = P(R.t, v3), b = P(Math.min(1, Math.max(0, R.t + R.dir * 0.002)), v4);
      const run = Math.max(1e-3, Math.hypot(b.x - a.x, b.z - a.z)), slope = (a.y - b.y) / run;
      R.v = Math.min(ZIP.vMax, Math.max(ZIP.vMin, R.v + (ZIP.g * slope * 0.95 - ZIP.drag * R.v * R.v) * dt));
      // quick launch ramp, then brake into the last 40 m
      if (age < 1.1) R.v = Math.max(R.v, ZIP.vMin + (ZIP.vMax - ZIP.vMin) * Math.min(1, age / 0.85) * 0.55);
      const left = (R.dir > 0 ? 1 - R.t : R.t) * Z.L; if (left < 40) R.v = Math.max(4.5, Math.min(R.v, 4.5 + left * 0.75));
      R.t += R.dir * R.v * dt / Z.L; R.bob += dt * (4 + R.v * 0.12);
      if ((R.dir > 0 && R.t >= 1) || (R.dir < 0 && R.t <= 0)) { R.t = R.dir > 0 ? 1 : 0; R.ph = 'lower'; R.k = 0; R.to = landAt(R.dir); }
      const p = P(R.t, v3); W.x = p.x; W.z = p.z;
      W.y = p.y - ZIP.hang + Math.sin(R.bob) * ZIP.bob * Math.min(1, R.v / 16);
    } else {
      R.k = Math.min(1, R.k + dt / ZIP.lower); const p = P(R.t, v3), e = R.k * R.k * (3 - 2 * R.k), T = R.to;
      W.x = p.x + (T.x - p.x) * e; W.z = p.z + (T.z - p.z) * e;
      W.y = (p.y - ZIP.hang) + (T.y - (p.y - ZIP.hang)) * e;
      if (R.k >= 1) {
        W.x = T.x; W.z = T.z; W.y = T.y; W.ride = null; zipGrip(pirate, false, 1);
        finishCrew(R.dir); const done = R; R = null;
        handle.position.copy(P(done.dir > 0 ? 0 : 1));
        toast(done.dir > 0 ? 'SKULL PEAK' : 'WATERFALL HILL', 1400); return 'done';
      }
    }
    W.yaw = yaw; W.speed = 0;
    { let c = yaw - W.camYaw; c = Math.atan2(Math.sin(c), Math.cos(c)); if (!W.drags.size) W.camYaw += c * Math.min(1, dt * 1.35); }
    handle.position.set(W.x, W.y + ZIP.hang, W.z);
    zipGrip(pirate, R.ph === 'slide' || (R.ph === 'lift' && R.k > 0.35) || (R.ph === 'lower' && R.k < 0.45), dt);
    rideCrew(dt);
    return 'ride';
  }

  return {
    spots, start, drop, line: Z, ends: { A: [ax, az], B: [bx, bz] }, P, group: g, ZIP,
    get riding() { return !!R; },
    get state() { return R ? { ph: R.ph, t: R.t, v: R.v, age: performance.now() / 1000 - R.t0 } : null; },
  };
}
