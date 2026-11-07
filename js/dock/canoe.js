// [Emerly sail-around] BANKSY 8:04 PM Nov 5: sail the whole island + 5 outer islets, drop anchor offshore, board a canoe
// with small crew + pet, dig on side islands, recall ship at the harbor dock, swim much faster. CLIENT ONLY.
// &sailall=0 = old west-harbor ring + no canoe / offshore anchor / ship-recall (dig spots stay on if shipped).
import { seatCanoeRider, CANOE_CREW_BENCHES } from '../onfoot/canoeSeat.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from '../toon.js';
import { getLocalGear } from '../pirateGear.js';
import { hullDist } from '../hullReach.js'; // [board-anywhere] BOARD SHIP anywhere round the hull (canoe, swimming, shore)

export const SAIL_ALL = !(typeof location !== 'undefined' && /[?&]sailall=0(?:&|$)/.test(location.search || ''));

// Harbor-frame sailing disc: foot centre (-80, -40) → harbor via HC=(-890,-150); R covers main island + 5 ISLETS with sea beyond.
// [board-anywhere] BANKSY t1722u: board your ship from anywhere round its hull (js/hullReach.js box), not just near its centre
export const BOARD_HULL = { canoe: 6.5, foot: 5.5 };
export const shipRefOf = (s, st) => (st && (st.mode === 'canoe' || st.mode === 'beached') && Number.isFinite(st.ax) ? { x: st.ax, z: st.az, yaw: st.ayaw, mesh: s?.mesh } : s);
export const SAIL = { cx: 810, cz: 110, r: 1250, nearShore: 180, canoeR: 20, beachR: 8, boardR: 7.5, canoeSpd: [13, 16.5], canoeRev: 6 };

export function inSailSea(x, z) { return Math.hypot(x - SAIL.cx, z - SAIL.cz) <= SAIL.r; }
// Harbor-frame spawn ring around the main island (outside SAFE HARBOR / west arena), deep water only when filtered by caller.
export function islandSpawnRing(n = 18, r = 720) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i + 0.35) / n * Math.PI * 2;
    out.push([SAIL.cx + Math.cos(a) * r, SAIL.cz + Math.sin(a) * r]);
  }
  return out;
}
export function clampSail(x, z) {
  const dx = x - SAIL.cx, dz = z - SAIL.cz, d = Math.hypot(dx, dz);
  if (d <= SAIL.r || d < 1e-4) return [x, z];
  return [SAIL.cx + dx / d * SAIL.r, SAIL.cz + dz / d * SAIL.r];
}

export function makeCanoeMesh() {
  // Hollowed wooden jolly-boat / pirate canoe: +Z = bow, -Z = stern. Truly open interior (no closed top).
  const g = new THREE.Group(); g.name = 'canoe';
  const wood = toon(0x8b542c, null, { key: 'canoe-wood', side: THREE.DoubleSide });
  const dark = toon(0x4e3019, null, { key: 'canoe-dark' });
  const gunw = toon(0x4a2e18, null, { key: 'canoe-gunwale' });
  const brass = toon(0xc89b54, null, { key: 'canoe-brass' });
  const glass = toon(0xffcf66, null, { key: 'canoe-lantern' });

  // Cross-section helpers (z from -2.75 stern → +2.85 bow)
  const Z0 = -2.75, Z1 = 2.85, LEN = Z1 - Z0;
  const halfW = (z) => {
    const t = (z - Z0) / LEN; // 0 stern .. 1 bow
    // pointed stern + bow, fullest amidships (~1.55 m beam)
    const mid = Math.sin(Math.PI * Math.min(1, Math.max(0, (t - 0.04) / 0.92)));
    const taper = Math.pow(Math.max(0, mid), 0.72);
    return 0.10 + 0.68 * taper;
  };
  const sheerY = (z) => {
    const t = (z - Z0) / LEN;
    const q = (t - 0.5) * 2; // -1..+1
    return 0.52 + 0.43 * q * q; // ~0.52 amidships → ~0.95 at tips
  };
  const keelY = (z) => {
    const t = (z - Z0) / LEN;
    const q = (t - 0.5) * 2;
    return -0.02 - 0.06 * (1 - q * q); // slight rocker
  };

  // Loft a U-shaped open canoe skin (outer or inner). openTop = leave gunwales unconnected.
  function loftHull({ inset = 0, yLift = 0, flip = false } = {}) {
    const N = 12, M = 10; // 13 stations, 11 pts per half-U (port gunwale → keel → starboard gunwale)
    const pos = [], idx = [];
    const stations = [];
    for (let i = 0; i <= N; i++) {
      const z = Z0 + (i / N) * LEN;
      const w = Math.max(0.04, halfW(z) - inset);
      const ys = sheerY(z) + yLift, yk = keelY(z) + inset * 0.55 + yLift;
      const ring = [];
      for (let j = 0; j <= M; j++) {
        const u = j / M; // 0 port gunwale → 0.5 keel → 1 starboard gunwale
        const ang = u * Math.PI; // 0..π
        const x = -w * Math.cos(ang);
        // flatten the floor a bit (pow > 1 pulls mid points down toward keel)
        const y = ys - (ys - yk) * Math.pow(Math.sin(ang), 1.35);
        ring.push([x, y, z]);
      }
      stations.push(ring);
      for (const p of ring) pos.push(p[0], p[1], p[2]);
    }
    const P = M + 1;
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = i * P + j, b = a + 1, c = a + P, d = c + 1;
      if (flip) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
    // close pointed tips with tiny fans so ends don't show a hole
    for (const [si, flipTip] of [[0, true], [N, false]]) {
      const base = pos.length / 3;
      const ring = stations[si];
      const tipZ = ring[0][2] + (si === 0 ? -0.04 : 0.04);
      const tipY = (sheerY(ring[0][2]) + keelY(ring[0][2])) * 0.5 + yLift + 0.08;
      pos.push(0, tipY, tipZ);
      for (let j = 0; j < M; j++) {
        const a = base, b = si * P + j, c = si * P + j + 1;
        if (flipTip ^ flip) idx.push(a, c, b); else idx.push(a, b, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }

  // Cap rail / gunwale: thin strip along both port & starboard sheer lines
  function gunwaleGeo() {
    const N = 24, pos = [], idx = [];
    const halfT = 0.045, halfH = 0.035;
    for (let side = -1; side <= 1; side += 2) {
      const base = pos.length / 3;
      for (let i = 0; i <= N; i++) {
        const z = Z0 + (i / N) * LEN;
        const x = side * halfW(z);
        const y = sheerY(z);
        // outward normal-ish offset for a chunky rail
        const xo = side * 0.03;
        pos.push(x - xo, y - halfH, z, x + xo + side * halfT, y - halfH, z,
                 x + xo + side * halfT, y + halfH, z, x - xo, y + halfH, z);
      }
      for (let i = 0; i < N; i++) {
        const a = base + i * 4;
        idx.push(a, a + 4, a + 1, a + 1, a + 4, a + 5);
        idx.push(a + 1, a + 5, a + 2, a + 2, a + 5, a + 6);
        idx.push(a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
        idx.push(a + 3, a + 7, a, a, a + 7, a + 4);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }

  const woodGeos = [], darkGeos = [], gunwGeos = [], brassGeos = [];

  woodGeos.push(loftHull({ inset: 0 }));
  woodGeos.push(loftHull({ inset: 0.07, yLift: 0.02, flip: true })); // inner hollow skin

  // Floor duckboards
  {
    const pos = [], idx = [];
    const Nz = 10, Nx = 4;
    for (let i = 0; i <= Nz; i++) {
      const z = -2.2 + (i / Nz) * 4.4;
      const w = Math.max(0.12, halfW(z) - 0.18);
      for (let j = 0; j <= Nx; j++) {
        const x = -w + (j / Nx) * 2 * w;
        pos.push(x, 0.16, z);
      }
    }
    const P = Nx + 1;
    for (let i = 0; i < Nz; i++) for (let j = 0; j < Nx; j++) {
      const a = i * P + j, b = a + 1, c = a + P, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    woodGeos.push(geo);
  }

  // Keel spine under the canoe
  {
    const k = new THREE.BoxGeometry(0.1, 0.1, 5.0);
    k.translate(0, -0.08, 0.05);
    darkGeos.push(k);
  }

  // 5 curved interior ribs (approx as thick U slabs via boxes on each side + floor bar)
  for (const z of [-1.9, -0.95, 0, 0.95, 1.9]) {
    const w = halfW(z) - 0.12;
    const h = sheerY(z) - 0.18;
    const bar = new THREE.BoxGeometry(w * 2 * 0.92, 0.05, 0.07); bar.translate(0, 0.20, z); darkGeos.push(bar);
    for (const side of [-1, 1]) {
      const rib = new THREE.BoxGeometry(0.06, h, 0.07);
      rib.translate(side * (w - 0.02), 0.20 + h * 0.5, z);
      darkGeos.push(rib);
    }
  }

  // 4 sturdy thwart benches
  for (const z of [-1.65, -0.55, 0.55, 1.55]) {
    const w = Math.max(0.5, halfW(z) * 1.55 - 0.2);
    const b = new THREE.BoxGeometry(w, 0.09, 0.32); b.translate(0, 0.38, z); darkGeos.push(b);
    // support posts
    for (const side of [-1, 1]) {
      const post = new THREE.BoxGeometry(0.06, 0.24, 0.06); post.translate(side * (w * 0.38), 0.26, z); darkGeos.push(post);
    }
  }

  // Upturned carved bow stem + stern post
  {
    const bow = new THREE.CylinderGeometry(0.05, 0.08, 1.15, 6); bow.translate(0, 0.55, 2.55);
    // tip curl
    const curl = new THREE.SphereGeometry(0.11, 6, 5); curl.translate(0, 1.15, 2.55);
    woodGeos.push(bow, curl);
    const stern = new THREE.CylinderGeometry(0.045, 0.07, 0.95, 6); stern.translate(0, 0.48, -2.45);
    const scurl = new THREE.SphereGeometry(0.09, 6, 5); scurl.translate(0, 0.98, -2.45);
    woodGeos.push(stern, scurl);
  }

  gunwGeos.push(gunwaleGeo());

  // Coiled rope near the prow
  {
    for (let i = 0; i < 3; i++) {
      const tor = new THREE.TorusGeometry(0.14 - i * 0.03, 0.035, 5, 10);
      tor.rotateX(Math.PI / 2); tor.translate(0.05, 0.22 + i * 0.04, 2.25);
      brassGeos.push(tor);
    }
  }
  // Warm brass bow lantern
  {
    const post = new THREE.CylinderGeometry(0.025, 0.03, 0.35, 5); post.translate(-0.18, 0.55, 2.35); darkGeos.push(post);
    const cage = new THREE.BoxGeometry(0.12, 0.14, 0.12); cage.translate(-0.18, 0.78, 2.35); brassGeos.push(cage);
    const bulb = new THREE.SphereGeometry(0.055, 6, 5); bulb.translate(-0.18, 0.78, 2.35);
    // keep glass separate so it can glow with its own material
    const glassMesh = new THREE.Mesh(bulb, glass); glassMesh.castShadow = false; g.add(glassMesh);
  }

  // Merge static wood / dark / gunwale / brass into few draw calls
  const merge = (geos) => {
    if (!geos.length) return null;
    const cleaned = geos.map((geo) => {
      const q = geo.index ? geo : geo;
      // ensure only position (+ optional normal) so mergeGeometries is happy
      for (const k of Object.keys(q.attributes)) if (k !== 'position' && k !== 'normal') q.deleteAttribute(k);
      if (!q.attributes.normal) q.computeVertexNormals();
      return q;
    });
    try {
      const m = mergeGeometries(cleaned, false);
      cleaned.forEach((c) => c.dispose());
      if (m) m.computeVertexNormals();
      return m;
    } catch {
      return cleaned[0];
    }
  };
  const addMerged = (geos, mat, cast = true) => {
    const geo = merge(geos); if (!geo) return;
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = cast; mesh.receiveShadow = true; g.add(mesh);
  };
  addMerged(woodGeos, wood);
  addMerged(darkGeos, dark);
  addMerged(gunwGeos, gunw);
  addMerged(brassGeos, brass, false);

  // Real wooden paddles (animated separately — left & right)
  function makePaddle(side) {
    const pg = new THREE.Group(); pg.name = side < 0 ? 'padL' : 'padR';
    // pivot sits at the gunwale oarlock amidships; shaft hangs down/out into the water
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 1.55, 6), dark);
    shaft.position.set(0, -0.55, 0); pg.add(shaft);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.045), dark);
    grip.position.set(0, 0.22, 0); pg.add(grip);
    // flat teardrop blade
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.22), wood);
    blade.position.set(0, -1.28, 0); blade.scale.set(1, 1, 1.15); pg.add(blade);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), wood);
    tip.position.set(0, -1.48, 0); tip.scale.set(0.55, 1.1, 1.4); pg.add(tip);
    // rest pose: angled out over the gunwale into the water
    pg.position.set(side * 0.78, 0.50, 0.15);
    pg.rotation.z = side * 0.55;
    pg.rotation.x = side < 0 ? 0.15 : -0.15;
    return pg;
  }
  g.add(makePaddle(-1), makePaddle(1));
  return g;
}

// [v314] BANKSY 9:2x PM Nov 5: "board ship / go to island doesn't work, you still control big ship" + "and go under the waves":
// the canoe owns its own keys (W/A/S/D, arrows, Shift) + a drag / wheel / pinch camera, the anchored ship is locked while you
// are off it (canoe / beached), GO TO ISLAND + BOARD SHIP coexist, landings search for dry sand, and the canoe
// rides ON the swell (5-point wave sample, pitch + roll, its own water cap in the ocean shader via hullCap()).
const CANOE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyQ', 'KeyC', 'KeyF']);
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const CANOE_DIM = { len: 5.6, halfBeam: 0.78, ride: 0.28, capLift: 0.42, bow: 2.5, side: 0.75 };

export function createCanoe({ scene, layout, walker, pirate, crewF, petF, getPlayer, toast = () => {}, sfx = null, waveY = null, low = false, canvas = null, world = null, touch = false }) {
  if (!SAIL_ALL) return null;
  const FM = layout.FM, toFoot = layout.harborToFoot, H = (x, z) => FM.H(...toFoot(x, z));
  const mesh = makeCanoeMesh(); mesh.visible = false; mesh.rotation.order = 'YXZ'; scene.add(mesh);
  const st = {
    mode: 'sea', // sea | canoe | beached  ([v314] no separate 'anchored' state: the on-screen ⚓ button sets s.anchor)
    ax: 0, az: 0, ayaw: 0, // anchored ship pose (saved on GO TO ISLAND · CANOE)
    cx: 0, cz: 0, cyaw: 0, cspd: 0, // canoe
    bx: 0, bz: 0, // beached canoe
    crewN: 2,
    y: 0, pitch: 0, roll: 0, snap: true, // floating pose (smoothed)
  };
  const keys = {};
  const cam = { yaw: 0, pitch: 0.30, dist: 10.5, drags: new Map(), look: 0 };
  const CAM_D = [5.5, 22], CAM_P = [-0.05, 1.05];
  let bobT = 0;
  const clearKeys = () => { for (const k in keys) keys[k] = false; };
  const wy = (x, z) => { const v = waveY?.(x, z); return Number.isFinite(v) ? v : 0; };
  // [v320] riders copy the canoe's YXZ quaternion; stand them back upright (no pitch / roll) whenever they leave the canoe
  // (BANKSY t1688u: "I and pet walk sideways after canoe" = a stale rotation.z from an XYZ decomposition of the canoe pose)
  function uprightRiders(pirateObjOverride = null) {
    const up = (o) => { if (!o?.rotation) return; delete o.userData.canoeSeat; o.rotation.order = 'YXZ'; o.rotation.x = 0; o.rotation.z = 0; };
    up(pirateObjOverride || pirate?.object);
    for (const c of (crewF?.list || [])) up(c?.p?.object);
    up(petF?.mesh || petF?.object);
  }

  // ---- canoe input: its own keys + camera look (the walker is inactive while paddling) ----
  function onKey(e, down) {
    const c = e?.code; if (!c) return false;
    if (!down) { const had = !!keys[c]; keys[c] = false; return had && st.mode === 'canoe'; }
    if (st.mode !== 'canoe' || !CANOE_KEYS.has(c)) return false;
    keys[c] = true; return true;
  }
  if (typeof addEventListener === 'function') addEventListener('blur', () => { clearKeys(); cam.drags.clear(); });
  if (canvas?.addEventListener) {
    canvas.addEventListener('pointerdown', (e) => { if (st.mode !== 'canoe') return; cam.drags.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    canvas.addEventListener('wheel', (e) => { if (st.mode !== 'canoe') return; cam.dist = Math.min(CAM_D[1], Math.max(CAM_D[0], cam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: true });
  }
  if (typeof addEventListener === 'function') {
    addEventListener('pointermove', (e) => { if (st.mode !== 'canoe') return; const d = cam.drags.get(e.pointerId); if (!d) return;
      if (cam.drags.size === 2) { const [a, b] = [...cam.drags.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); d.x = e.clientX; d.y = e.clientY; const d1 = Math.hypot(a.x - b.x, a.y - b.y);
        cam.dist = Math.min(CAM_D[1], Math.max(CAM_D[0], cam.dist * (d0 / Math.max(1, d1)))); return; }
      const k = touch ? 0.0075 : 0.0055; cam.yaw -= (e.clientX - d.x) * k; cam.pitch = Math.min(CAM_P[1], Math.max(CAM_P[0], cam.pitch + (e.clientY - d.y) * k * 0.8));
      d.x = e.clientX; d.y = e.clientY; cam.look = performance.now(); });
    const up = (e) => cam.drags.delete(e.pointerId); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function padLook(rx, ry, dt, k = [2.8, 1.7]) { if (st.mode !== 'canoe') return; cam.yaw -= rx * k[0] * dt; cam.pitch = Math.min(CAM_P[1], Math.max(CAM_P[0], cam.pitch + ry * k[1] * dt)); cam.look = performance.now(); }
  function camBehind() { cam.yaw = st.cyaw; cam.look = 0; }
  function resetCam() { cam.yaw = st.cyaw; cam.pitch = 0.30; cam.dist = 10.5; cam.look = 0; cam.drags.clear(); }

  const nearLand = (x, z, r = SAIL.nearShore) => {
    for (let a = 0; a < 8; a++) {
      const ang = a / 8 * Math.PI * 2, d = H(x + Math.cos(ang) * r * 0.55, z + Math.sin(ang) * r * 0.55);
      if (d > -0.5) return true;
    }
    return H(x, z) > -1.2;
  };
  // [v314] the beach shelf jumps -2.0 -> +0.8 across one 4 m grid cell, so "shallow" was a < 1 m strip: probe 9 m around instead
  function canLandAshore(x, z) {
    if (H(x, z) >= -1.7) return true;
    for (const r of [3, 6, 9]) for (let a = 0; a < 12; a++) { const ang = a / 12 * Math.PI * 2; if (H(x + Math.sin(ang) * r, z + Math.cos(ang) * r) > -0.2) return true; }
    return false;
  }
  const walkable = (x, z) => H(x, z) > 0.65 && !(world?.blocked?.(x, z));
  // dry walkable ground near (x, z): straight ahead first, then 8 directions (nearest-to-heading preferred), out to maxR
  function findDry(x, z, yaw, maxR = 18) {
    const seen = new Set(), list = [];
    for (let k = 0; k < 8; k++) { const a = yaw + k * Math.PI / 4; list.push(a); }
    list.sort((a, b) => Math.abs(wrapA(a - yaw)) - Math.abs(wrapA(b - yaw)));
    let best = null, bs = 1e9;
    for (const a of list) { const key = Math.round(wrapA(a) * 100); if (seen.has(key)) continue; seen.add(key);
      for (let r = 1; r <= maxR; r += 1) { const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
        if (walkable(px, pz)) { const score = r + Math.abs(wrapA(a - yaw)) * 2.5; if (score < bs) { bs = score; best = { x: px, z: pz, yaw: a, r }; } break; } }
      if (best && Math.abs(wrapA(a - yaw)) < 1e-3) break; // straight ahead is dry: take it
    }
    return best;
  }
  // nearest shoreline heading within R (for the canoe launch), null = none
  function shoreHeading(x, z, R = 220) {
    let best = null, bd = 1e9;
    for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2;
      for (let r = 8; r <= R; r += 6) { if (H(x + Math.sin(a) * r, z + Math.cos(a) * r) > -0.2) { if (r < bd) { bd = r; best = a; } break; } } }
    return best === null ? null : { yaw: best, d: bd };
  }

  // [v314] BANKSY t1675u: no DROP ANCHOR popup (it blocked pulling up to the main dock). The ship anchors only via the existing
  // on-screen ⚓ button / Space (main.js toggleAnchor); GO TO ISLAND · CANOE shows only while anchored offshore, away from the dock.
  const nearMainDock = (s, docking) => !!s && ((s.x > 135 && s.x < 240 && Math.abs(s.z) < 95) // the main harbor dock berth corridor
    || (docking?.berths || []).some(b => Math.hypot(s.x - b.x, s.z - b.z) < 90)); // + every berth (B1..B10 run z -103..131)
  function placeFloat(dt, snap) {
    const fx = Math.sin(st.cyaw), fz = Math.cos(st.cyaw), px = Math.cos(st.cyaw), pz = -Math.sin(st.cyaw), L = CANOE_DIM.bow, B = CANOE_DIM.side;
    const hC = wy(st.cx, st.cz), hF = wy(st.cx + fx * L, st.cz + fz * L), hA = wy(st.cx - fx * L, st.cz - fz * L);
    const hP = wy(st.cx + px * B, st.cz + pz * B), hS = wy(st.cx - px * B, st.cz - pz * B);
    const ty = Math.max(hC, (hF + hA) * 0.5, (hP + hS) * 0.5) + CANOE_DIM.ride;
    const tp = -Math.atan2(hF - hA, 2 * L) * 0.85, tr = Math.atan2(hP - hS, 2 * B) * 0.70;
    const k = snap ? 1 : 1 - Math.exp(-dt * 10);
    st.y += (ty - st.y) * k; st.pitch += (tp - st.pitch) * k; st.roll += (tr - st.roll) * k;
    if (st.y < ty - 0.05) st.y = ty - 0.05; // never lag under a rising crest
    mesh.position.set(st.cx, st.y + Math.sin(bobT * 2.2) * 0.02, st.cz);
    mesh.rotation.set(st.pitch + Math.sin(bobT * 1.7) * 0.012, st.cyaw, st.roll + Math.sin(bobT * 1.3) * 0.015);
  }
  function boardCanoeFromShip(s, controls) {
    if (st.mode !== 'sea' || !s?.alive || !s.anchor) return false;
    st.ax = s.x; st.az = s.z; st.ayaw = s.yaw; s.anchor = true; s.sail = 0; s.speed = 0; s._offshore = true;
    const yaw = s.yaw, rx = Math.cos(yaw), rz = -Math.sin(yaw); // ship local +X
    const off = Math.max(6.5, (s.mesh?.userData?.beam || 8) * 0.5 + 4.5); // clear of the hull (big ships are 10+ m wide)
    // launch off whichever side is closer to land (and clear of rocks)
    const sideScore = (sd) => { const x = s.x + rx * off * sd, z = s.z + rz * off * sd; if (H(x, z) > -1.0) return 1e9;
      for (let r = 10; r <= 220; r += 10) if (H(s.x + rx * r * sd, s.z + rz * r * sd) > -0.2) return r; return 500; };
    const side = sideScore(1) <= sideScore(-1) ? 1 : -1;
    st.cx = s.x + rx * off * side; st.cz = s.z + rz * off * side;
    const sh = shoreHeading(st.cx, st.cz, 220);
    st.cyaw = sh ? sh.yaw : yaw; st.cspd = 0; st.mode = 'canoe'; s._canoeAway = true; s.sail = 0; s.speed = 0; s.turn = 0;
    clearKeys(); resetCam(); st.snap = true; bobT = 0;
    mesh.visible = true; placeFloat(0, true); st.snap = false;
    if (controls) controls.enabled = false;
    document.documentElement.classList.add('pfp-canoe');
    // from sea: crew/pet are not ashore yet — enter them so they seat in the canoe right away
    try {
      crewF?.enter?.();
      const seat = { x: st.cx, z: st.cz, yaw: st.cyaw };
      petF?.enter?.(seat);
      // pet mesh only loads after update() sees a ground-pet id from gear
      petF?.update?.(0, seat, { pirateObj: pirate?.object, petId: getLocalGear()?.parrot || 'none' });
    } catch {}
    toast('CANOE LAUNCHED · WASD to paddle to the island'); sfx?.coin?.(); return true;
  }
  function boardShipFromCanoe(s, goAboardShip, controls) {
    if (st.mode !== 'canoe' || !s) return false;
    mesh.visible = false; st.mode = 'sea'; clearKeys();
    document.documentElement.classList.remove('pfp-canoe'); // ship HUD back (html.pfp-canoe hides #controls / #hint)
    if (controls) controls.enabled = true;
    try { crewF?.exit?.(); petF?.exit?.(); } catch {}
    uprightRiders();
    if (pirate?.object) pirate.object.visible = false;
    s.x = st.ax; s.z = st.az; s.yaw = st.ayaw; s.speed = 0; s.sail = 0; s.turn = 0; s.anchor = true; s._offshore = false; s._canoeAway = false;
    goAboardShip?.(); toast('BACK ABOARD · ⚓ or W to sail'); return true;
  }
  function landAshore(goAshoreAt, ship) {
    if (st.mode !== 'canoe') return false;
    const spot = findDry(st.cx, st.cz, st.cyaw, 18) || findDry(st.cx, st.cz, st.cyaw, 30);
    if (!spot) { toast('NO BEACH HERE · paddle closer to the sand'); return false; }
    // walk the landing point back toward the canoe while still dry (short hop to the beached canoe)
    let x = spot.x, z = spot.z; const ux = Math.sin(spot.yaw), uz = Math.cos(spot.yaw);
    for (let i = 0; i < 20; i++) { const nx = x - ux * 0.5, nz = z - uz * 0.5; if (!walkable(nx, nz)) break; x = nx; z = nz; }
    // beach the canoe right at the waterline (H ≈ -0.15..+0.25) on the line between the canoe and the landing point
    let bx = st.cx, bz = st.cz;
    for (let r = 0; r <= spot.r + 0.01; r += 0.25) { const qx = st.cx + ux * r, qz = st.cz + uz * r; if (H(qx, qz) >= -0.15) { bx = qx; bz = qz; break; } bx = qx; bz = qz; }
    if (H(bx, bz) > 0.25) { bx -= ux * 0.75; bz -= uz * 0.75; }
    st.bx = bx; st.bz = bz; st.cyaw = spot.yaw + Math.PI; // beached bow faces out to sea, ready to relaunch
    st.mode = 'beached'; st.cspd = 0; clearKeys(); cam.drags.clear();
    placeBeached();
    document.documentElement.classList.remove('pfp-canoe');
    uprightRiders();
    if (ship) ship._canoeAway = true; goAshoreAt?.(x, z, spot.yaw); uprightRiders(); sfx?.coin?.(); return true;
  }
  function placeBeached() {
    const g = H(st.bx, st.bz), w = wy(st.bx, st.bz);
    mesh.visible = true;
    mesh.position.set(st.bx, Math.max(g + 0.08, Math.min(w + CANOE_DIM.ride, g + 0.6), 0.05), st.bz);
    mesh.rotation.set(0.06, st.cyaw, 0.04);
  }
  function boardCanoeFromShore() {
    if (st.mode !== 'beached') return false;
    st.mode = 'canoe'; st.cx = st.bx; st.cz = st.bz;
    // nudge seaward along the bow (beached facing out to sea) until there is water to paddle
    let ok = false;
    for (let i = 0; i < 16; i++) { const nx = st.cx + Math.sin(st.cyaw) * 1.0, nz = st.cz + Math.cos(st.cyaw) * 1.0; st.cx = nx; st.cz = nz; if (H(nx, nz) < -0.6) { ok = true; break; } }
    if (!ok) { const sh = shoreHeading(st.cx, st.cz, 40); if (sh) { st.cyaw = sh.yaw + Math.PI; for (let i = 0; i < 12 && H(st.cx, st.cz) > -0.6; i++) { st.cx += Math.sin(st.cyaw); st.cz += Math.cos(st.cyaw); } } }
    st.cspd = 0; clearKeys(); resetCam(); placeFloat(0, true);
    document.documentElement.classList.add('pfp-canoe');
    mesh.visible = true;
    try { crewF?.enter?.(); petF?.enter?.({ x: st.cx, z: st.cz, yaw: st.cyaw }); } catch {}
    toast('CANOE READY · paddle back to your ship'); return true;
  }
  function recallShip(s, docking, controls) {
    if (!s?.alive || !docking) return false;
    // clear canoe / offshore
    mesh.visible = false; st.mode = 'sea'; s._offshore = false; s._canoeAway = false; s.anchor = false; clearKeys(); uprightRiders();
    document.documentElement.classList.remove('pfp-canoe');
    if (controls) controls.enabled = true;
    // if we were canoeing (not on foot), stow crew/pet back off the canoe
    if (!document.documentElement.classList.contains('pfp-onfoot')) {
      try { crewF?.exit?.(); petF?.exit?.(); } catch {}
      if (pirate?.object) pirate.object.visible = false;
    }
    let b = docking.spawnPick?.();
    if (!b && docking.berths) b = docking.berths.find(q => !docking.takenBy?.(q.id));
    if (b) { docking.moor(s, b); toast(`SHIP RETURNED TO BERTH ${b.id}`); sfx?.coin?.(); return true; }
    // fallback: park just off the harbor mouth
    s.x = 40; s.z = 0; s.yaw = Math.PI / 2; s.speed = 0; s.sail = 0;
    toast('SHIP RETURNED OFF THE HARBOR'); sfx?.coin?.(); return true;
  }
  function clearAll(s, controls) {
    mesh.visible = false; st.mode = 'sea'; clearKeys(); uprightRiders();
    if (s) { s._offshore = false; s._canoeAway = false; }
    document.documentElement.classList.remove('pfp-canoe');
    if (controls) controls.enabled = true;
    if (!document.documentElement.classList.contains('pfp-onfoot')) {
      try { crewF?.exit?.(); petF?.exit?.(); } catch {}
      if (pirate?.object) pirate.object.visible = false;
    }
  }

  function canoeSteer(dt, input) {
    if (st.mode !== 'canoe') return;
    const { f = 0, s = 0, run = false } = input || {};
    st.cyaw = wrapA(st.cyaw - s * 1.8 * dt); // D / stick right = turn right (yaw decreases, same as the ship's helm)
    const want = f > 0.05 ? (run ? SAIL.canoeSpd[1] : SAIL.canoeSpd[0]) * f : f < -0.05 ? SAIL.canoeRev * f : 0;
    st.cspd += (want - st.cspd) * Math.min(1, dt * 3);
    let nx = st.cx + Math.sin(st.cyaw) * st.cspd * dt, nz = st.cz + Math.cos(st.cyaw) * st.cspd * dt;
    // don't drive up onto dry land
    if (H(nx, nz) > -0.05) { st.cspd *= 0.2; nx = st.cx; nz = st.cz; }
    [nx, nz] = clampSail(nx, nz);
    st.cx = nx; st.cz = nz;
  }

  function lockShip(s) {
    s.x = st.ax; s.z = st.az; s.yaw = st.ayaw; s.speed = 0; s.sail = 0; s.turn = 0; s.anchor = true; s._offshore = true;
  }
  function tick(dt, { s, joy, camera, controls, pirateObj } = {}) {
    bobT += dt;
    if ((st.mode === 'canoe' || st.mode === 'beached') && s) lockShip(s); // locked only while you are off the ship
    if (st.mode === 'canoe') {
      const K = keys;
      let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
      let side = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
      let run = !!(K.ShiftLeft || K.ShiftRight);
      if (joy?.on && Math.hypot(joy.x, joy.y) > 0.12) { f = -joy.y; side = joy.x; run = Math.hypot(joy.x, joy.y) > 0.88; }
      canoeSteer(dt, { f, s: side, run });
      mesh.visible = true;
      placeFloat(dt, st.snap); st.snap = false;
      // paddle stroke: fore-aft swing + outward dip while moving; rest cleanly when idle
      const pL = mesh.getObjectByName('padL'), pR = mesh.getObjectByName('padR');
      const moving = Math.abs(st.cspd) > 0.35;
      const cadence = 2.2 + Math.abs(st.cspd) * 0.45;
      const swing = moving ? Math.sin(bobT * cadence) * 0.72 : Math.sin(bobT * 0.7) * 0.06;
      const dip = moving ? 0.18 + Math.abs(Math.sin(bobT * cadence)) * 0.22 : 0.08;
      if (pL) { pL.rotation.x = swing; pL.rotation.z = -0.55 - dip; }
      if (pR) { pR.rotation.x = -swing; pR.rotation.z = 0.55 + dip; }
      // seat pirate + crew + pet INSIDE the hollow canoe with its full transform (yaw + pitch + roll + position)
      // benches at local z = -1.65, -0.55, +0.55, +1.55; floor y ≈ 0.16
      mesh.updateMatrixWorld(true);
      const v = new THREE.Vector3();
      const placeAt = (obj, zLocal, yLocal = 0.18) => {
        if (!obj) return;
        obj.visible = true; obj.rotation.order = 'YXZ'; // [v320] decompose the canoe pose in YXZ (an XYZ copy at |yaw| > 90° read as x ≈ ±π, z ≈ ±π + roll)
        v.set(0, yLocal, zLocal).applyMatrix4(mesh.matrixWorld);
        obj.position.copy(v); obj.quaternion.copy(mesh.quaternion);
      };
      if (pirateObj) seatCanoeRider(pirate, mesh, 0.55, dt); // captain on forward-mid bench
      const crew = crewF?.list || [];
      const crewZ = CANOE_CREW_BENCHES;
      for (let i = 0; i < crew.length; i++) {
        const c = crew[i];
        if (i >= Math.min(st.crewN, crewZ.length)) { c.p.object.visible = false; continue; }
        seatCanoeRider(c.p, mesh, crewZ[i], dt);
      }
      if (!petF?.mesh) {
        try { petF?.update?.(0, { x: st.cx, z: st.cz, yaw: st.cyaw }, { pirateObj: pirate?.object, petId: getLocalGear()?.parrot || 'none' }); } catch {}
      }
      { const po = petF?.mesh || petF?.object; if (po) placeAt(po, 1.60, 0.40); } // pet perched on the bow bench
      // camera: drag / wheel / pinch look, drifting back behind the canoe while paddling
      if (moving && !cam.drags.size && performance.now() - cam.look > 1200) cam.yaw += wrapA(st.cyaw - cam.yaw) * Math.min(1, dt * 1.4);
      if (camera && controls) {
        const cp = Math.cos(cam.pitch), by = st.y;
        let dist = cam.dist;
        // never put the camera inside the anchored ship's hull: pull in, then lift over the deck if still inside
        const inShip = (x, z) => { if (!s?.mesh) return false; const ud = s.mesh.userData || {}, hl = (ud.len || 30) * 0.5 + 2, hb = (ud.beam || 8) * 0.5 + 2, dx = x - s.x, dz = z - s.z;
          const f = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), l = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw); return Math.abs(f) < hl && Math.abs(l) < hb; };
        while (dist > 4 && inShip(st.cx - Math.sin(cam.yaw) * dist * cp, st.cz - Math.cos(cam.yaw) * dist * cp)) dist -= 0.5;
        let px = st.cx - Math.sin(cam.yaw) * dist * cp, pz = st.cz - Math.cos(cam.yaw) * dist * cp, py = by + 1.6 + Math.sin(cam.pitch) * dist + 1.0;
        if (inShip(px, pz)) py = Math.max(py, (s.y || 0) + 14);
        py = Math.max(py, wy(px, pz) + 2.0);
        camera.position.set(px, py, pz);
        camera.lookAt(st.cx, by + 1.15, st.cz);
        return true; // camera owned
      }
    } else if (st.mode === 'beached') {
      placeBeached();
    } else {
      mesh.visible = false;
    }
    return st.mode === 'canoe';
  }
  // the canoe's water cap for the ocean shader (main.js uHulls / uHullY): same layout as main.js hullCap()
  // { x, z, yaw, len, capY (cap height at the hull centre, the shader subtracts 0.3), slopeZ (dY per m forward), slopeX (dY per m to +X), halfBeam, speed }
  function hullCap() {
    if (!mesh.visible || (st.mode !== 'canoe' && st.mode !== 'beached')) return null;
    const x = mesh.position.x, z = mesh.position.z, pitch = mesh.rotation.x, roll = mesh.rotation.z;
    return { x, z, yaw: mesh.rotation.y, len: CANOE_DIM.len, capY: mesh.position.y + CANOE_DIM.capLift, slopeZ: Math.tan(-pitch), slopeX: Math.tan(roll), halfBeam: CANOE_DIM.halfBeam, speed: st.mode === 'canoe' ? st.cspd : 0 };
  }

  function prompts({ s, onFoot, W, docking }) {
    if (!SAIL_ALL) return onFoot && W && st.mode === 'sea' && s?.alive && !(s.sinking > 0) && docking?.mode === 'sea' && hullDist(s, W.x, W.z) <= BOARD_HULL.foot ? { a: { label: 'BOARD SHIP', key: 'E', primary: true, tag: 'boardShipSwim' }, b: null } : null; // [board-anywhere] &sailall=0 too
    // canoe mode: GO TO ISLAND and BOARD SHIP can both show
    if (st.mode === 'canoe') {
      const dShip = s ? Math.hypot(st.cx - st.ax, st.cz - st.az) : 1e9;
      const nearShore = canLandAshore(st.cx, st.cz, st.cyaw), nearShip = dShip < SAIL.canoeR || (!!s && hullDist(shipRefOf(s, st), st.cx, st.cz) <= BOARD_HULL.canoe);
      if (nearShore && nearShip) return { a: { label: 'GO TO ISLAND', key: 'E', primary: true, tag: 'land' }, b: { label: 'BOARD SHIP', key: 'Q', tag: 'boardShip' } };
      if (nearShore) return { a: { label: 'GO TO ISLAND', key: 'E', primary: true, tag: 'land' }, b: null };
      if (nearShip) return { a: { label: 'BOARD SHIP', key: 'E', primary: true, tag: 'boardShip' }, b: null };
      return { a: { label: 'PADDLE TO SHORE (WASD)', disabled: true }, b: null };
    }
    // on foot near beached canoe
    if (st.mode === 'beached' && onFoot && W && Math.hypot(W.x - st.bx, W.z - st.bz) < SAIL.boardR)
      return { a: { label: 'BOARD CANOE', key: 'E', primary: true, tag: 'boardCanoeShore' }, b: null };
    // [board-anywhere] on foot (shore, rocks, a pier) or swimming within BOARD_HULL.foot of your un-moored ship's hull, canoe out or not
    if (onFoot && W && s?.alive && !(s.sinking > 0) && (!docking || docking.mode === 'sea') && hullDist(shipRefOf(s, st), W.x, W.z) <= BOARD_HULL.foot)
      return { a: { label: 'BOARD SHIP', key: 'E', primary: true, tag: 'boardShipSwim' }, b: null };
    // swimming to canoe / ship
    if (onFoot && W?.swim) {
      if (st.mode === 'beached' && Math.hypot(W.x - st.bx, W.z - st.bz) < SAIL.boardR)
        return { a: { label: 'BOARD CANOE', key: 'E', primary: true, tag: 'boardCanoeShore' }, b: null };
      if (st.mode === 'beached' && s && Math.hypot(W.x - st.ax, W.z - st.az) < SAIL.canoeR)
        return { a: { label: 'BOARD SHIP', key: 'E', primary: true, tag: 'boardShipSwim' }, b: null };
    }
    // aboard ship at sea: nothing pops up while sailing; anchored (on-screen ⚓) offshore, away from the main dock = the canoe
    if (!onFoot && st.mode === 'sea' && s?.alive && (!docking || docking.mode === 'sea')) {
      if (s.anchor && !nearMainDock(s, docking) && !(s.sinking > 0) && Math.abs(s.speed || 0) < 3.5)
        return { a: { label: 'GO TO ISLAND · CANOE', key: 'E', primary: true, tag: 'launchCanoe' }, b: null };
      return null;
    }
    // harbor recall: on foot, ship not at a berth
    if (onFoot && W && docking && s?.alive && docking.mode === 'sea' && st.mode !== 'canoe') {
      const berths = docking.berths || [];
      let near = null;
      for (const b of berths) {
        if (Math.hypot(W.x - b.ashore.x, W.z - b.ashore.z) < 6) { near = b; break; }
      }
      // also boardwalk waterfront: near any berth within 14 m of quay line
      if (!near) for (const b of berths) {
        if (Math.hypot(W.x - b.x, W.z - b.z) < 14) { near = b; break; }
      }
      if (near && !(docking.berth && docking.mode === 'docked'))
        return { a: { label: 'RETURN SHIP TO DOCK', key: 'E', primary: true, tag: 'recall' }, b: null };
    }
    return null;
  }

  function act(tag, ctx) {
    const { s, controls, goAshoreAt, goAboard, docking, walkerExit, walkerEnter, walker } = ctx || {};
    if (tag === 'launchCanoe') return boardCanoeFromShip(s, controls);
    if (tag === 'boardShip') return boardShipFromCanoe(s, () => { goAboard?.(true); }, controls);
    if (tag === 'boardShipSwim') {
      const away = (st.mode === 'canoe' || st.mode === 'beached') && Number.isFinite(st.ax); // [board-anywhere] only an anchored-away ship snaps back to its anchor
      clearAll(s, controls); if (away) { s.x = st.ax; s.z = st.az; s.yaw = st.ayaw; } s.speed = 0; s.sail = 0; s.anchor = true; s._offshore = false; s._canoeAway = false; st.mode = 'sea';
      uprightRiders(); goAboard?.(true); return true;
    }
    if (tag === 'land') return landAshore((x, z, yaw) => { goAshoreAt?.(x, z, yaw); }, s); // goAshoreAt enters crew + pet itself
    if (tag === 'boardCanoeShore') {
      walkerExit?.(); return boardCanoeFromShore();
    }
    if (tag === 'recall') return recallShip(s, docking, controls);
    return false;
  }

  return {
    get mode() { return st.mode; },
    get state() { return st; },
    get keys() { return keys; },
    get cam() { return cam; },
    mesh, nearMainDock, tick, prompts, act, clearAll, recallShip, onKey, clearKeys, padLook, camBehind, hullCap,
    canLandAshore, findDry, nearLand, inSailSea, clampSail,
  };
}
