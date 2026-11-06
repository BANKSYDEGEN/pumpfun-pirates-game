// [Emerly zipline-castle / v309] BANKSY 7:57–8:?? PM Nov 5:
//   "make zipline from this corner of castle to the waterfall zipline" (in-game NE turret [-395,-57])
//   "Move the 2 waterfall hill zip lines to top of hill"
//   "Give them room that can get off and on, also make it so they can change direction while on zip line if want to return"
// CLIENT ONLY; &zipline=0 = none. Builds TWO lines: waterfall↔skull + castle↔waterfall.
import * as THREE from 'three';
import { toon } from '../toon.js';
import { rig, arm, eul, BONES } from '../onfoot/swimPose.js';
import { OPT_ON, freezeStatic, mergeStaticGroup } from '../opt.js';

export const ZIP_ON = !(typeof location !== 'undefined' && /[?&]zipline=0(&|$)/.test(location.search));
export const ZIP = {
  treeClear: 9, sag: 0.014, vMin: 13, vMax: 44, vUp: 20.5, g: 9.8, drag: 0.008, lift: 0.7, lower: 0.7,
  hang: 2.55, bob: 0.06, gantry: 2.85, crewGap: 0.3, crewDist: 4.2, grace: 0.25, cool: 0.6, dropVy: 1.2,
  revCool: 0.40,
};

// Castle NE turret (island map: -z = N, +x = E) — BANKSY screenshot corner, no spyglass.
export const CASTLE_ZIP = { x: -395, z: -57, y: 42, r: 3.6, gantryR: 4.35, gantryH: 3.1, embrasure: 0.55 };

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

function makeCy(gA, gB, hA, hB, sag) {
  return (t) => (gA + hA) * (1 - t) + (gB + hB) * t - sag * 4 * t * (1 - t);
}

function minClearance(H, A, B, cy, n = 250) {
  let minClr = 1e9;
  for (let i = 1; i < n; i++) {
    const t = i / n; if (t < 0.03 || t > 0.97) continue;
    const x = A[0] + (B[0] - A[0]) * t, z = A[1] + (B[1] - A[1]) * t;
    minClr = Math.min(minClr, cy(t) - H(x, z));
  }
  return minClr;
}

/** Summit peak of Waterfall Hill (same seed as v2). */
export function waterfallPeak(FM) {
  const H = (x, z) => FM.H(x, z);
  const cx = -206, cz = FM.LAKE.z - FM.LAKE.r - 28;
  let hill = [cx, cz], ha = -1e9;
  for (let x = cx - 55; x <= cx + 55; x += 3) for (let z = cz - 55; z <= cz + 55; z += 3) {
    const h = H(x, z); if (h > ha) { ha = h; hill = [x, z]; }
  }
  return { hill, ha };
}

/**
 * Two lines on the Waterfall Hill summit crown + Skull brow + Castle NE turret balcony.
 * Tuned so both stands sit on top (h≈76–78) with room to board, and cables clear terrain.
 */
export function zipLines(FM) {
  const H = (x, z) => FM.H(x, z);
  const { hill, ha } = waterfallPeak(FM);
  const S = FM.SKULL;
  // Tuned summit stands (island xz): castle-bound on W/S crown, skull-bound near peak. ~15 m apart.
  // Elevations + gantry heights verified for foot clearance (see tools probe / commit notes).
  let wfCastle = [-188, -232];
  let wfSkull = [-188, -247];
  // Snap a meter if peak drifts
  {
    const dC = Math.hypot(wfCastle[0] - hill[0], wfCastle[1] - hill[1]);
    const dS = Math.hypot(wfSkull[0] - hill[0], wfSkull[1] - hill[1]);
    if (dC > 28 || H(...wfCastle) < ha - 10) wfCastle = [hill[0], hill[1] + 16];
    if (dS > 20 || H(...wfSkull) < ha - 6) wfSkull = [hill[0], hill[1] + 1];
  }
  let skull = rimToward(H, [S.x, S.z], wfSkull, { maxR: 55, minDrop: 5, minH: 70, look: 7 }) || (() => {
    const dx = wfSkull[0] - S.x, dz = wfSkull[1] - S.z, n = Math.hypot(dx, dz) || 1;
    return [S.x + dx / n * 22, S.z + dz / n * 22];
  })();

  // ---- waterfall ↔ skull ----
  let hWfS = 2.85, hSk = 3.2, sagSk = 0.014;
  {
    const L = Math.hypot(skull[0] - wfSkull[0], skull[1] - wfSkull[1]);
    let sag = L * sagSk, cy = makeCy(H(...wfSkull), H(...skull), hWfS, hSk, sag);
    for (let it = 0; it < 6 && minClearance(H, wfSkull, skull, cy) < 2.8; it++) {
      hWfS = Math.min(3.5, hWfS + 0.15); hSk = Math.min(3.5, hSk + 0.1);
      sag = L * sagSk; cy = makeCy(H(...wfSkull), H(...skull), hWfS, hSk, sag);
    }
  }
  const gWfS = H(...wfSkull), gSk = H(...skull);
  const Lsk = Math.hypot(skull[0] - wfSkull[0], skull[1] - wfSkull[1]);
  const sagSkM = Lsk * sagSk;
  const cySk = makeCy(gWfS, gSk, hWfS, hSk, sagSkM);
  const skullLine = {
    id: 'waterfall_skull',
    A: wfSkull, B: skull, gA: gWfS, gB: gSk, hA: hWfS, hB: hSk, L: Lsk, sag: sagSkM,
    y: cySk, minClr: minClearance(H, wfSkull, skull, cySk),
    labelA: 'SKULL PEAK', labelB: 'WATERFALL HILL',
    spotA: 'RIDE ZIPLINE · TO SKULL PEAK', spotB: 'RIDE ZIPLINE · TO WATERFALL HILL',
    landA: 'behind', landB: 'behind', // standard rear dismount
  };

  // ---- castle NE turret ↔ waterfall summit ----
  const CT = CASTLE_ZIP;
  const zipA = Math.atan2(wfCastle[1] - CT.z, wfCastle[0] - CT.x);
  const cLaunch = [CT.x + Math.cos(zipA) * CT.gantryR, CT.z + Math.sin(zipA) * CT.gantryR];
  let hCast = CT.gantryH, hWfC = 5.5, sagCw = 0.012; // taller WF gantry clears west shoulder of the hill
  {
    const L = Math.hypot(wfCastle[0] - cLaunch[0], wfCastle[1] - cLaunch[1]);
    let sag = L * sagCw, cy = makeCy(CT.y, H(...wfCastle), hCast, hWfC, sag);
    for (let it = 0; it < 8 && minClearance(H, cLaunch, wfCastle, cy) < 3.0; it++) {
      hWfC = Math.min(6.5, hWfC + 0.25);
      sag = L * sagCw; cy = makeCy(CT.y, H(...wfCastle), hCast, hWfC, sag);
    }
  }
  const gWfC = H(...wfCastle);
  const Lcw = Math.hypot(wfCastle[0] - cLaunch[0], wfCastle[1] - cLaunch[1]);
  const sagCwM = Lcw * sagCw;
  const cyCw = makeCy(CT.y, gWfC, hCast, hWfC, sagCwM);
  const castleLine = {
    id: 'castle_waterfall',
    A: cLaunch, B: wfCastle, gA: CT.y, gB: gWfC, hA: hCast, hB: hWfC, L: Lcw, sag: sagCwM,
    y: cyCw, minClr: minClearance(H, cLaunch, wfCastle, cyCw),
    labelA: 'WATERFALL HILL', labelB: 'HILLTOP FORT',
    spotA: 'RIDE ZIPLINE · TO WATERFALL HILL', spotB: 'RIDE ZIPLINE · TO HILLTOP FORT',
    landA: 'turret', landB: 'behind',
    zipA, turret: CT, wfCastle,
  };

  return { skullLine, castleLine, hill, ha, zipA };
}

/** @deprecated single-line helper kept for probes — returns skull line shaped like old zipLine(). */
export function zipLine(FM) {
  const { skullLine: Z } = zipLines(FM);
  return { ...Z, both: true, from: Z.gA >= Z.gB ? 'A' : 'B' };
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
  for (const s of ['L', 'R']) arm(S, R, dir, s, 0.12, 1.55, 0.08, 0.28);
  const w = zp.w * zp.w * (3 - 2 * zp.w); for (const n of BONES) B[n].quaternion.slerp(S[n], w);
}
export function zipGrip(pirate, on, dt) {
  const fig = figOf(pirate); if (!fig) return;
  const zp = fig._zip || (fig._zip = { w: 0, S: Object.fromEntries(BONES.map((n) => [n, new THREE.Quaternion()])) });
  zp.w = Math.min(1, Math.max(0, zp.w + (on ? 1 : -1) * dt / (on ? 0.14 : 0.18)));
  if (fig.addPost) fig.addPost('zip', zipPost, 2); else if (!fig.post) fig.post = zipPost;
}

function clearTreesUnder(world, A, B, toH, half = 7.5) {
  const spots = world?.foot?.spots; if (!spots) return 0;
  const [ax, az] = toH(...A), [bx, bz] = toH(...B);
  const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  let n = 0;
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

function clearTreesRadius(world, cx, cz, toH, r = 18) {
  const spots = world?.foot?.spots; if (!spots) return 0;
  const [hx, hz] = toH(cx, cz);
  let n = 0;
  for (const k of ['trees', 'palms']) {
    const src = spots[k]; if (!src?.length) continue;
    const keep = [];
    for (const t of src) {
      if (Math.hypot(t[0] - hx, t[2] - hz) < r) { n++; continue; }
      keep.push(t);
    }
    spots[k] = keep;
  }
  return n;
}

export function createZipline({ scene, world, layout, walker, pirate = null, crew = null, toast = () => {}, low = false }) {
  if (!ZIP_ON) return null;
  const FM = layout.FM, pack = zipLines(FM), toH = layout.footToHarbor;
  const linesSpec = [pack.skullLine, pack.castleLine];

  const g = new THREE.Group(); g.name = 'zipline';
  const wood = toon(0x8a5a32, null, { key: 'zip-wood' }), dark = toon(0x4a3220, null, { key: 'zip-dark' });
  const plank = toon(0x9a6a3e, null, { key: 'zip-plank' }), rope = toon(0x2b2622, null, { key: 'zip-rope' });
  const steel = toon(0xb8bec6, null, { key: 'zip-steel' }), brass = toon(0xc9a227, null, { key: 'zip-brass' });
  const iron = toon(0x3a3a40, null, { key: 'zip-iron' }), glow = toon(0xffc14a, null, { key: 'zip-glow' });

  function makeTrolley() {
    const h = new THREE.Group();
    const pul = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.1, 12).rotateZ(Math.PI / 2), brass); h.add(pul);
    const hous = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.22), iron); hous.position.y = -0.06; h.add(hous);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), steel); rod.position.y = -0.38; h.add(rod);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.78, 8).rotateZ(Math.PI / 2), steel); bar.position.y = -0.62; h.add(bar);
    for (const sx of [-0.32, 0.32]) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), brass); tip.position.set(sx, -0.62, 0); h.add(tip); }
    return h;
  }

  function station(x, z, gy, h, yaw, { wide = false } = {}) {
    const t = new THREE.Group(); t.position.set(x, gy, z); t.rotation.y = yaw;
    const span = wide ? 3 : 2;
    for (let i = -span; i <= span; i++) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, wide ? 4.4 : 3.6), plank); pl.position.set(i * 0.78, 0.18, 0); t.add(pl);
    }
    const tw = wide ? 5.2 : 4.4, tl = wide ? 2.25 : 1.85;
    const trim = new THREE.Mesh(new THREE.BoxGeometry(tw, 0.16, 0.22), dark); trim.position.set(0, 0.28, tl); t.add(trim);
    const trimB = trim.clone(); trimB.position.z = -tl; t.add(trimB);
    for (const [px, pz] of [[-1.5, -1.2], [1.5, -1.2], [-1.5, 1.1], [1.5, 1.1], [0, -1.5], [0, 1.3], ...(wide ? [[-2.2, 0], [2.2, 0]] : [])]) {
      const wx = x + Math.sin(yaw) * pz + Math.cos(yaw) * px, wz = z + Math.cos(yaw) * pz - Math.sin(yaw) * px;
      const gHere = world.ground ? world.ground(wx, wz) : gy;
      const len = Math.max(1.2, gy + 0.2 - (gHere - 0.8));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, len, 6), dark);
      post.position.set(px, 0.2 - len / 2, pz); t.add(post);
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, Math.min(len * 0.7, 2.4), 0.1), wood);
      strut.position.set(px * 0.7, 0.05 - Math.min(len * 0.35, 1.0), pz * 0.5);
      strut.rotation.x = pz > 0 ? 0.45 : -0.45; t.add(strut);
    }
    for (let s = 0; s < 4; s++) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(wide ? 2.8 : 2.2, 0.14, 0.55), wood);
      st.position.set(0, 0.08 + s * 0.12, -2.15 - s * 0.48); t.add(st);
    }
    const railX = wide ? 2.4 : 1.95;
    for (const sx of [-railX, railX]) {
      for (const zz of [-1.4, 0.2, 1.4]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 5), dark); post.position.set(sx, 0.7, zz); t.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, wide ? 3.2 : 2.6), wood); rail.position.set(sx, 1.05, 0); t.add(rail);
    }
    for (const sx of [-1.55, 1.55]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, h + 0.35, 0.22), dark);
      leg.position.set(sx, (h + 0.35) / 2 + 0.15, 0); t.add(leg);
      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.12, Math.min(h * 0.55, 1.5), 0.12), wood);
      knee.position.set(sx * 0.55, 0.9, 0.35); knee.rotation.z = sx > 0 ? 0.55 : -0.55; t.add(knee);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.28, 0.28), dark); beam.position.y = h + 0.35; t.add(beam);
    const xbrace = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 0.1), wood); xbrace.position.set(0, h * 0.55, 0); xbrace.rotation.z = 0.4; t.add(xbrace);
    const xbrace2 = xbrace.clone(); xbrace2.rotation.z = -0.4; t.add(xbrace2);
    const pul = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12).rotateZ(Math.PI / 2), brass);
    pul.position.set(0, h + 0.2, 0.15); t.add(pul);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.25), iron); clamp.position.set(0, h + 0.38, 0); t.add(clamp);
    const bol = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.55, 8), iron); bol.position.set(-1.3, 0.55, -1.5); t.add(bol);
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 12), rope); coil.rotation.x = Math.PI / 2; coil.position.set(-1.3, 0.35, -1.5); t.add(coil);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), dark); pole.position.set(1.6, 1.0, -1.4); t.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), glow); lamp.position.set(1.6, 1.65, -1.4); t.add(lamp);
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.32), toon(0xfa0d0d, null, { key: 'zip-flag', side: THREE.DoubleSide }));
    pen.position.set(1.9, 1.85, -1.4); t.add(pen);
    g.add(t); return t;
  }

  /** Cantilevered timber balcony off the NE turret — flush y=42, gantry outside the red cone roof. */
  function turretStation(CT, zipA, hGantry) {
    const t = new THREE.Group();
    t.position.set(CT.x, CT.y, CT.z); t.rotation.y = zipA; // local +Z = outward along cable
    // planks from r≈1.6 (inside rim) out to r≈4.9
    for (let i = 0; i < 5; i++) {
      const z0 = 1.7 + i * 0.72;
      const pl = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 0.7), plank);
      pl.position.set(0, 0.06, z0); t.add(pl);
    }
    // side guardrails + box colliders via decks below
    for (const sx of [-1.45, 1.45]) {
      for (let i = 0; i < 4; i++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.95, 5), dark);
        post.position.set(sx, 0.55, 2.0 + i * 0.7); t.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.8), wood);
      rail.position.set(sx, 0.95, 3.2); t.add(rail);
    }
    // knee braces into the stone cylinder
    for (const sx of [-1.1, 1.1]) {
      const brace = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.4, 0.16), dark);
      brace.position.set(sx, -1.1, 2.6); brace.rotation.x = 0.55; t.add(brace);
      const kick = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 1.6), wood);
      kick.position.set(sx * 0.3, -1.6, 2.0); t.add(kick);
    }
    // A-frame gantry at gantryR (local z = gantryR)
    const gz = CT.gantryR;
    for (const sx of [-1.45, 1.45]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, hGantry + 0.35, 0.22), dark);
      leg.position.set(sx, (hGantry + 0.35) / 2 + 0.1, gz); t.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.28, 0.28), dark); beam.position.set(0, hGantry + 0.3, gz); t.add(beam);
    const pul = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12).rotateZ(Math.PI / 2), brass);
    pul.position.set(0, hGantry + 0.15, gz + 0.12); t.add(pul);
    const clamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.25), iron); clamp.position.set(0, hGantry + 0.35, gz); t.add(clamp);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), glow); lamp.position.set(1.5, 1.4, gz - 0.8); t.add(lamp);
    g.add(t); return t;
  }

  /** Flat summit boardwalk between the two waterfall stands. */
  function summitPad(ax, az, bx, bz, gy) {
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const yaw = Math.atan2(bx - ax, bz - az);
    const t = new THREE.Group(); t.position.set(mx, gy, mz); t.rotation.y = yaw;
    const len = Math.hypot(bx - ax, bz - az);
    for (let i = -2; i <= 2; i++) {
      const pl = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, Math.max(len - 2, 8)), plank);
      pl.position.set(i * 0.9, 0.08, 0); t.add(pl);
    }
    for (const [px, pz] of [[-1.8, -len * 0.35], [1.8, -len * 0.35], [-1.8, len * 0.35], [1.8, len * 0.35], [0, 0]]) {
      const wx = mx + Math.sin(yaw) * pz + Math.cos(yaw) * px, wz = mz + Math.cos(yaw) * pz - Math.sin(yaw) * px;
      const gHere = world.ground ? world.ground(wx, wz) : gy;
      const lenP = Math.max(0.8, gy + 0.15 - (gHere - 0.6));
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, lenP, 6), dark);
      post.position.set(px, 0.1 - lenP / 2, pz); t.add(post);
    }
    g.add(t);
    if (layout.decks) layout.decks.push({ id: 'zip_summit_pad', x: mx, z: mz, yaw, hw: 2.4, hl: Math.max(len / 2, 5), y: gy + 0.14 });
    return t;
  }

  const built = [];
  const spots = [];
  const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();

  for (const Z of linesSpec) {
    const [ax, az] = toH(...Z.A), [bx, bz] = toH(...Z.B);
    const yawAB = Math.atan2(bx - ax, bz - az);
    const P = (t, out = new THREE.Vector3()) => out.set(ax + (bx - ax) * t, Z.y(t), az + (bz - az) * t);
    clearTreesUnder(world, Z.A, Z.B, toH);

    if (Z.id === 'castle_waterfall') {
      const CT = Z.turret;
      const [tx, tz] = toH(CT.x, CT.z);
      // zipA is atan2(dz,dx) in foot xz; harbor yaw for +Z-forward stations uses atan2(dx,dz) via yawAB already
      turretStation({ x: tx, z: tz, y: CT.y, gantryR: CT.gantryR }, yawAB, Z.hA);
      station(bx, bz, Z.gB, Z.hB, yawAB + Math.PI, { wide: true });
      if (layout.decks) {
        const ox = Math.cos(Z.zipA), oz = Math.sin(Z.zipA);
        const [cx, cz] = toH(CT.x + ox * 3.2, CT.z + oz * 3.2);
        layout.decks.push(
          { id: 'zip_castle_balc', x: cx, z: cz, yaw: yawAB, hw: 1.55, hl: 1.85, y: CT.y + 0.06 },
          { id: 'zip_castle_wf', x: bx, z: bz, yaw: yawAB + Math.PI, hw: 2.6, hl: 2.8, y: Z.gB + 0.24 },
        );
      }
    } else {
      station(ax, az, Z.gA, Z.hA, yawAB, { wide: true });
      station(bx, bz, Z.gB, Z.hB, yawAB + Math.PI);
      if (layout.decks) {
        layout.decks.push(
          { id: 'zip_' + Z.id + '_A', x: ax, z: az, yaw: yawAB, hw: 2.6, hl: 2.8, y: Z.gA + 0.24 },
          { id: 'zip_' + Z.id + '_B', x: bx, z: bz, yaw: yawAB + Math.PI, hw: 2.1, hl: 2.4, y: Z.gB + 0.24 },
        );
      }
    }

    const pts = []; for (let i = 0; i <= 72; i++) pts.push(P(i / 72).clone());
    const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), low ? 72 : 180, 0.055, low ? 4 : 6, false), rope);
    cable.name = 'zip-cable-' + Z.id; g.add(cable);

    const handle = makeTrolley(); handle.rotation.y = yawAB; handle.position.copy(P(0)); handle.userData.live = true; handle.matrixAutoUpdate = true; g.add(handle);
    const crewHandles = [];

    function landAt(dir) {
      if (Z.landA === 'turret' && dir < 0) {
        // land inside round stone turret (harbor frame) with room to walk to N/E wall-walks
        const CT = Z.turret, ang = Z.zipA + Math.PI + (Math.random() - 0.5) * 0.4;
        const rr = 0.6 + Math.random() * 0.7;
        const [fx, fz] = toH(CT.x + Math.cos(ang) * rr, CT.z + Math.sin(ang) * rr);
        return { x: fx, z: fz, y: CT.y, yaw: yawAB + Math.PI };
      }
      const [lx, lz] = dir > 0 ? [bx, bz] : [ax, az], yaw = dir > 0 ? yawAB : yawAB + Math.PI;
      const back = Z.id === 'castle_waterfall' && dir > 0 ? 4.2 : 3.6;
      const fx = lx + Math.sin(yaw) * back, fz = lz + Math.cos(yaw) * back;
      return { x: fx, z: fz, y: world.stand ? world.stand(fx, fz) : world.ground(fx, fz), yaw };
    }

    const line = { id: Z.id, Z, ax, az, bx, bz, yawAB, P, handle, crewHandles, landAt, labelA: Z.labelA, labelB: Z.labelB };
    built.push(line);

    // boarding spots — smaller radius on summit so the two WF prompts never overlap
    const rSpot = Z.id === 'waterfall_skull' || Z.id === 'castle_waterfall' ? 3.7 : 4.2;
    if (Z.id === 'castle_waterfall') {
      // castle: trigger on balcony (launch), not deep in turret — harbor frame
      const CT = Z.turret, ox = Math.cos(Z.zipA), oz = Math.sin(Z.zipA);
      const [sx, sz] = toH(CT.x + ox * 4.1, CT.z + oz * 4.1);
      spots.push({ id: 'zip_castle', kind: 'zipline', lineId: Z.id, end: 'A', x: sx, z: sz, r: 3.2, label: Z.spotA });
      spots.push({ id: 'zip_castle_wf', kind: 'zipline', lineId: Z.id, end: 'B', x: bx, z: bz, r: rSpot, label: Z.spotB });
    } else {
      spots.push({ id: 'zip_skull_wf', kind: 'zipline', lineId: Z.id, end: 'A', x: ax, z: az, r: rSpot, label: Z.spotA });
      spots.push({ id: 'zip_skull', kind: 'zipline', lineId: Z.id, end: 'B', x: bx, z: bz, r: 4.0, label: Z.spotB });
    }
  }

  // summit boardwalk between the two waterfall stands + clear trees on crown
  {
    const [sx, sz] = toH(...pack.skullLine.A), [cx, cz] = toH(...pack.castleLine.B);
    const gy = Math.min(pack.skullLine.gA, pack.castleLine.gB) + 0.05;
    summitPad(sx, sz, cx, cz, gy);
    clearTreesRadius(world, (pack.skullLine.A[0] + pack.castleLine.B[0]) / 2, (pack.skullLine.A[1] + pack.castleLine.B[1]) / 2, toH, 18);
  }

  scene.add(g);
  if (OPT_ON) {
    for (const ch of g.children) {
      if (ch.isGroup && !ch.userData?.live) { mergeStaticGroup(ch); freezeStatic(ch); }
    }
    freezeStatic(g);
    for (const L of built) { L.handle.matrixAutoUpdate = true; L.handle.userData.live = true; }
  }

  let R = null, coolUntil = 0, revUntil = 0;
  let revEdge = { s: true, q: true, joy: true }; // require release before next reverse

  function findLine(id) { return built.find((L) => L.id === id) || built[0]; }

  function spawnCrew(line, dir, t0) {
    const list = crew?.list || [];
    for (const h of line.crewHandles) { h.removeFromParent(); }
    line.crewHandles.length = 0;
    list.forEach((c, i) => {
      if (!c.p?.object?.visible) return;
      const h = makeTrolley(); h.rotation.y = line.yawAB; h.visible = false; h.matrixAutoUpdate = true; g.add(h); line.crewHandles.push(h);
      c.zip = { lineId: line.id, dir, t: t0, v: 0, ph: 'wait', k: 0, delay: ZIP.crewGap + i * (ZIP.crewGap + 0.05), handle: h, x0: c.x, y0: c.y, z0: c.z };
    });
  }

  function dropCrew(line, vx, vz) {
    for (const c of crew?.list || []) {
      if (!c.zip || c.zip.lineId !== line.id) continue;
      const h = c.zip.handle; if (h) { h.visible = false; h.removeFromParent(); }
      zipGrip(c.p, false, 1);
      const B = c.body, floor = world.stand ? world.stand(c.x, c.z) : world.ground(c.x, c.z);
      c.y = Math.max(c.y, floor + 0.05); B.y = c.y; B.air = true; B.airT = 0; B.vy = ZIP.dropVy * 0.6; B.swim = false;
      c.zipVx = vx * 0.85; c.zipVz = vz * 0.85; c.zip = null;
    }
    line.crewHandles.length = 0;
  }

  function finishCrew(line, dir) {
    const Lnd = line.landAt(dir);
    (crew?.list || []).forEach((c, i) => {
      if (!c.zip || c.zip.lineId !== line.id) return;
      const h = c.zip.handle; if (h) { h.visible = false; h.removeFromParent(); }
      zipGrip(c.p, false, 1);
      const ang = Lnd.yaw + (i - 1) * 0.35, d = 1.4 + i * 0.7;
      c.x = Lnd.x + Math.sin(ang) * d; c.z = Lnd.z + Math.cos(ang) * d;
      c.y = world.stand ? world.stand(c.x, c.z) : world.ground(c.x, c.z); c.yaw = Lnd.yaw;
      if (c.body) { c.body.y = c.y; c.body.air = false; c.body.vy = 0; }
      c.zip = null;
    });
    line.crewHandles.length = 0;
  }

  function start(q) {
    if (R || !walker.w.active) return false;
    if (performance.now() / 1000 < coolUntil) return false;
    const line = findLine(q.lineId);
    const dir = q.end === 'A' ? 1 : -1, t0 = dir > 0 ? 0 : 1, W = walker.w;
    R = { line, dir, t: t0, v: ZIP.vMin * 1.15, ph: 'lift', k: 0, x0: W.x, y0: W.y, z0: W.z, bob: 0, t0: performance.now() / 1000 };
    revEdge = { s: !(W.keys.KeyS || W.keys.ArrowDown), q: !W.keys.KeyQ, joy: true };
    W.ride = ride; W.jumpQ = false; spawnCrew(line, dir, t0); toast('HOLD ON!', 1000); return true;
  }

  function drop() {
    if (!R) return false;
    const line = R.line, W = walker.w, yaw = R.dir > 0 ? line.yawAB : line.yawAB + Math.PI, v = Math.max(4, R.v * 0.9);
    const vx = Math.sin(yaw) * v, vz = Math.cos(yaw) * v;
    dropCrew(line, vx, vz);
    zipGrip(pirate, false, 1);
    const B = W.body, floor = world.stand ? world.stand(W.x, W.z) : world.ground(W.x, W.z);
    W.y = Math.max(W.y, floor + 0.08); B.y = W.y; B.air = true; B.airT = 0; B.vy = ZIP.dropVy; B.swim = false; B.hop = false; B.climb = 0;
    W.zipVx = vx; W.zipVz = vz; W.ride = null; W.speed = v; W.jumpQ = false;
    line.handle.position.copy(line.P(R.dir > 0 ? 0 : 1)); coolUntil = performance.now() / 1000 + ZIP.cool;
    R = null; toast('LET GO!', 900); return 'drop';
  }

  function reverse() {
    if (!R) return false;
    if (R.ph !== 'slide' && !(R.ph === 'lift' && R.k > 0.55)) return false;
    const now = performance.now() / 1000;
    if (now < revUntil) return false;
    R.dir = -R.dir; R.v = ZIP.vMin * 1.1; R.ph = 'slide'; R.k = 1;
    revUntil = now + ZIP.revCool;
    const W = walker.w;
    W.yaw = R.dir > 0 ? R.line.yawAB : R.line.yawAB + Math.PI;
    // re-index crew train behind player in new direction
    for (const c of crew?.list || []) {
      const z = c.zip; if (!z || z.lineId !== R.line.id) continue;
      if (z.ph === 'wait') { z.dir = R.dir; continue; }
      if (z.ph === 'lower') continue;
      z.dir = R.dir;
      if (z.ph === 'lift') { z.ph = 'slide'; z.k = 1; z.v = ZIP.vMin; }
    }
    toast('TURNING BACK!', 900);
    return true;
  }

  function rideCrew(dt) {
    const line = R.line, Z = line.Z, yawAB = line.yawAB, P = line.P;
    for (const c of crew?.list || []) {
      const z = c.zip; if (!z || z.lineId !== line.id) continue;
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
        const lead = R ? R.t : (z.dir > 0 ? 1 : 0);
        const want = lead - z.dir * (ZIP.crewDist / Z.L) * ((line.crewHandles.indexOf(z.handle) + 1) || 1);
        const a = P(z.t, v3), b = P(Math.min(1, Math.max(0, z.t + z.dir * 0.002)), v4);
        const run = Math.max(1e-3, Math.hypot(b.x - a.x, b.z - a.z)), slope = (a.y - b.y) / run;
        if (slope <= 0) z.v += (ZIP.vUp - z.v) * Math.min(1, dt * 1.6);
        else z.v = Math.min(ZIP.vMax, Math.max(ZIP.vMin, z.v + (ZIP.g * slope * 0.9 - ZIP.drag * z.v * z.v) * dt));
        z.v = Math.min(ZIP.vMax, Math.max(ZIP.vMin * 0.85, z.v));
        const left = (z.dir > 0 ? 1 - z.t : z.t) * Z.L; if (left < 35) z.v = Math.max(4, Math.min(z.v, 4 + left * 0.7));
        const gap = (want - z.t) * z.dir; if (gap < -0.002) z.v *= 0.92; else if (gap > 0.01) z.v = Math.min(ZIP.vMax, z.v + 8 * dt);
        z.t += z.dir * z.v * dt / Z.L;
        if ((z.dir > 0 && z.t >= 1) || (z.dir < 0 && z.t <= 0)) { z.t = z.dir > 0 ? 1 : 0; z.ph = 'lower'; z.k = 0; z.to = line.landAt(z.dir); }
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
    const line = R.line, Z = line.Z, P = line.P, yawAB = line.yawAB, W = walker.w;
    dt = Math.min(dt, 0.05);
    const yaw = R.dir > 0 ? yawAB : yawAB + Math.PI;
    const age = performance.now() / 1000 - R.t0;
    if (age >= ZIP.grace && R.ph !== 'lower') {
      if (W.jumpQ || W.zipDrop) { W.jumpQ = false; W.zipDrop = false; return drop(); }
      // edge-triggered reverse: KeyQ / KeyS / ArrowDown / pull stick back
      const wantS = !!(W.keys.KeyS || W.keys.ArrowDown);
      const wantQ = !!W.keys.KeyQ || !!W.zipRev;
      const joyBack = W.joy?.on && W.joy.y > 0.65;
      if (wantS) { if (revEdge.s) { revEdge.s = false; reverse(); } } else revEdge.s = true;
      if (wantQ) { if (revEdge.q) { revEdge.q = false; W.zipRev = false; reverse(); } } else revEdge.q = true;
      if (joyBack) { if (revEdge.joy) { revEdge.joy = false; reverse(); } } else revEdge.joy = true;
    } else { W.jumpQ = false; W.zipDrop = false; W.zipRev = false; }

    if (R.ph === 'lift') {
      R.k = Math.min(1, R.k + dt / ZIP.lift); const p = P(R.t, v3), e = R.k * R.k * (3 - 2 * R.k);
      W.x = R.x0 + (p.x - R.x0) * e; W.z = R.z0 + (p.z - R.z0) * e;
      W.y = R.y0 + (p.y - ZIP.hang - R.y0) * e; if (R.k >= 1) R.ph = 'slide';
    } else if (R.ph === 'slide') {
      const a = P(R.t, v3), b = P(Math.min(1, Math.max(0, R.t + R.dir * 0.002)), v4);
      const run = Math.max(1e-3, Math.hypot(b.x - a.x, b.z - a.z)), slope = (a.y - b.y) / run;
      // downhill accelerates; uphill / flat uses motorized pulley target
      if (slope <= 0) R.v += (ZIP.vUp - R.v) * Math.min(1, dt * 1.8);
      else R.v = Math.min(ZIP.vMax, Math.max(ZIP.vMin, R.v + (ZIP.g * slope * 0.95 - ZIP.drag * R.v * R.v) * dt));
      R.v = Math.min(ZIP.vMax, Math.max(ZIP.vMin * 0.85, R.v));
      if (age < 1.1) R.v = Math.max(R.v, ZIP.vMin + (ZIP.vMax - ZIP.vMin) * Math.min(1, age / 0.85) * 0.55);
      const left = (R.dir > 0 ? 1 - R.t : R.t) * Z.L; if (left < 40) R.v = Math.max(4.5, Math.min(R.v, 4.5 + left * 0.75));
      R.t += R.dir * R.v * dt / Z.L; R.bob += dt * (4 + R.v * 0.12);
      if ((R.dir > 0 && R.t >= 1) || (R.dir < 0 && R.t <= 0)) { R.t = R.dir > 0 ? 1 : 0; R.ph = 'lower'; R.k = 0; R.to = line.landAt(R.dir); }
      const p = P(R.t, v3); W.x = p.x; W.z = p.z;
      W.y = p.y - ZIP.hang + Math.sin(R.bob) * ZIP.bob * Math.min(1, R.v / 16);
    } else {
      R.k = Math.min(1, R.k + dt / ZIP.lower); const p = P(R.t, v3), e = R.k * R.k * (3 - 2 * R.k), T = R.to;
      W.x = p.x + (T.x - p.x) * e; W.z = p.z + (T.z - p.z) * e;
      W.y = (p.y - ZIP.hang) + (T.y - (p.y - ZIP.hang)) * e;
      if (R.k >= 1) {
        W.x = T.x; W.z = T.z; W.y = T.y; W.ride = null; zipGrip(pirate, false, 1);
        finishCrew(line, R.dir); const done = R; R = null;
        line.handle.position.copy(P(done.dir > 0 ? 0 : 1));
        toast(done.dir > 0 ? line.labelA : line.labelB, 1400); return 'done';
      }
    }
    W.yaw = yaw; W.speed = 0;
    { let c = yaw - W.camYaw; c = Math.atan2(Math.sin(c), Math.cos(c)); if (!W.drags.size) W.camYaw += c * Math.min(1, dt * 1.35); }
    line.handle.position.set(W.x, W.y + ZIP.hang, W.z);
    zipGrip(pirate, R.ph === 'slide' || (R.ph === 'lift' && R.k > 0.35) || (R.ph === 'lower' && R.k < 0.45), dt);
    rideCrew(dt);
    return 'ride';
  }

  return {
    spots, start, drop, reverse,
    lines: built, pack,
    line: pack.skullLine, // back-compat for probes
    ends: { A: built[0] && [built[0].ax, built[0].az], B: built[0] && [built[0].bx, built[0].bz] },
    group: g, ZIP,
    get riding() { return !!R; },
    get state() { return R ? { ph: R.ph, t: R.t, v: R.v, age: performance.now() / 1000 - R.t0, lineId: R.line.id, dir: R.dir } : null; },
  };
}
