// [Emerly sail-around] BANKSY 8:04 PM Nov 5: sail the whole island + 5 outer islets, drop anchor offshore, board a canoe
// with small crew + pet, dig on side islands, recall ship at the harbor dock, swim much faster. CLIENT ONLY.
// &sailall=0 = old west-harbor ring + no canoe / offshore anchor / ship-recall (dig spots stay on if shipped).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon } from '../toon.js';
import { getLocalGear } from '../pirateGear.js';

export const SAIL_ALL = !(typeof location !== 'undefined' && /[?&]sailall=0(?:&|$)/.test(location.search || ''));

// Harbor-frame sailing disc: foot centre (-80, -40) → harbor via HC=(-890,-150); R covers main island + 5 ISLETS with sea beyond.
export const SAIL = { cx: 810, cz: 110, r: 1250, nearShore: 180, canoeR: 16, beachR: 8, boardR: 5.5, canoeSpd: [13, 16.5], canoeRev: 6 };

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

export function createCanoe({ scene, layout, walker, pirate, crewF, petF, getPlayer, toast = () => {}, sfx = null, waveY = null, low = false }) {
  if (!SAIL_ALL) return null;
  const FM = layout.FM, toFoot = layout.harborToFoot, H = (x, z) => FM.H(...toFoot(x, z));
  const mesh = makeCanoeMesh(); mesh.visible = false; scene.add(mesh);
  const st = {
    mode: 'none', // none | anchored | canoe | beached
    ax: 0, az: 0, ayaw: 0, // anchored ship pose
    cx: 0, cz: 0, cyaw: 0, cspd: 0, // canoe
    bx: 0, bz: 0, // beached canoe
    crewN: 2,
  };
  let bobT = 0;

  const nearLand = (x, z, r = SAIL.nearShore) => {
    for (let a = 0; a < 8; a++) {
      const ang = a / 8 * Math.PI * 2, d = H(x + Math.cos(ang) * r * 0.55, z + Math.sin(ang) * r * 0.55);
      if (d > -0.5) return true;
    }
    return H(x, z) > -1.2;
  };
  const shallow = (x, z) => H(x, z) >= -0.6;
  const dry = (x, z) => H(x, z) > 0.15;

  function dropAnchor(s) {
    if (!s?.alive || st.mode === 'canoe') return false;
    st.mode = 'anchored'; st.ax = s.x; st.az = s.z; st.ayaw = s.yaw;
    s.anchor = true; s.sail = 0; s.speed = 0; s._offshore = true; s._canoeAway = false;
    toast('ANCHOR DROPPED'); sfx?.coin?.(); return true;
  }
  function weighAnchor(s) {
    if (st.mode !== 'anchored') return false;
    st.mode = 'none'; s.anchor = false; s._offshore = false; if (s.sail < 1) s.sail = 1;
    toast('WEIGH ANCHOR · SET SAIL'); return true;
  }
  function boardCanoeFromShip(s, controls) {
    if (st.mode !== 'anchored' || !s) return false;
    const yaw = s.yaw, side = 1;
    st.cx = s.x + Math.cos(yaw) * 6 * side; st.cz = s.z - Math.sin(yaw) * 6 * side;
    st.cyaw = yaw; st.cspd = 0; st.mode = 'canoe'; s._canoeAway = true;
    mesh.visible = true; mesh.position.set(st.cx, (waveY?.(st.cx, st.cz) ?? 0) + 0.15, st.cz); mesh.rotation.y = st.cyaw;
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
    toast('CANOE LAUNCHED · paddle to shore'); sfx?.coin?.(); return true;
  }
  function boardShipFromCanoe(s, goAboardShip, controls) {
    if (st.mode !== 'canoe' || !s) return false;
    mesh.visible = false; st.mode = 'anchored';
    document.documentElement.classList.remove('pfp-canoe');
    if (controls) controls.enabled = true;
    try { crewF?.exit?.(); petF?.exit?.(); } catch {}
    if (pirate?.object) pirate.object.visible = false;
    s.x = st.ax; s.z = st.az; s.yaw = st.ayaw; s.speed = 0; s.anchor = true; s._offshore = true;
    goAboardShip?.(); toast('BACK ABOARD'); return true;
  }
  function landAshore(goAshoreAt, ship) {
    if (st.mode !== 'canoe') return false;
    // push onto dry sand
    let x = st.cx, z = st.cz, yaw = st.cyaw;
    for (let i = 0; i < 12; i++) {
      const nx = x + Math.sin(yaw) * 1.2, nz = z + Math.cos(yaw) * 1.2;
      if (H(nx, nz) > 0.6) { x = nx; z = nz; break; }
      if (H(nx, nz) > H(x, z)) { x = nx; z = nz; }
    }
    st.bx = st.cx; st.bz = st.cz; st.mode = 'beached';
    mesh.position.set(st.bx, Math.max(0.05, H(st.bx, st.bz) * 0.15), st.bz);
    document.documentElement.classList.remove('pfp-canoe');
    if (ship) ship._canoeAway = true; goAshoreAt?.(x, z, yaw); toast('ASHORE'); sfx?.coin?.(); return true;
  }
  function boardCanoeFromShore() {
    if (st.mode !== 'beached') return false;
    st.mode = 'canoe'; st.cx = st.bx; st.cz = st.bz;
    // nudge seaward
    for (let i = 0; i < 8; i++) {
      const nx = st.cx - Math.sin(st.cyaw) * 1.4, nz = st.cz - Math.cos(st.cyaw) * 1.4;
      if (H(nx, nz) < -0.2) { st.cx = nx; st.cz = nz; break; }
      st.cx = nx; st.cz = nz;
    }
    st.cyaw += Math.PI; st.cspd = 0;
    document.documentElement.classList.add('pfp-canoe');
    mesh.visible = true;
    try { crewF?.enter?.(); petF?.enter?.({ x: st.cx, z: st.cz, yaw: st.cyaw }); } catch {}
    toast('CANOE READY'); return true;
  }
  function recallShip(s, docking, controls) {
    if (!s?.alive || !docking) return false;
    // clear canoe / offshore
    mesh.visible = false; st.mode = 'none'; s._offshore = false; s._canoeAway = false; s.anchor = false;
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
    mesh.visible = false; st.mode = 'none';
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
    const turn = s * 1.8 * dt;
    st.cyaw += turn;
    const want = f > 0.05 ? (run ? SAIL.canoeSpd[1] : SAIL.canoeSpd[0]) * f : f < -0.05 ? SAIL.canoeRev * f : 0;
    st.cspd += (want - st.cspd) * Math.min(1, dt * 3);
    let nx = st.cx + Math.sin(st.cyaw) * st.cspd * dt, nz = st.cz + Math.cos(st.cyaw) * st.cspd * dt;
    // don't drive up onto dry land
    if (H(nx, nz) > -0.05) { st.cspd *= 0.2; nx = st.cx; nz = st.cz; }
    st.cx = nx; st.cz = nz;
  }

  function tick(dt, { s, onFoot, W, keys, joy, camera, controls, pirateObj }) {
    bobT += dt;
    if (st.mode === 'anchored' && s) {
      s.x = st.ax; s.z = st.az; s.yaw = st.ayaw; s.speed = 0; s.sail = 0; s.anchor = true; s._offshore = true;
    }
    if (st.mode === 'canoe') {
      const K = keys || {};
      let f = (K.KeyW || K.ArrowUp ? 1 : 0) - (K.KeyS || K.ArrowDown ? 1 : 0);
      let side = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0);
      let run = !!(K.ShiftLeft || K.ShiftRight);
      if (joy?.on && Math.hypot(joy.x, joy.y) > 0.12) { f = -joy.y; side = joy.x; run = Math.hypot(joy.x, joy.y) > 0.88; }
      canoeSteer(dt, { f, s: side, run });
      const wy = waveY?.(st.cx, st.cz) ?? 0;
      mesh.visible = true;
      mesh.position.set(st.cx, wy + 0.18 + Math.sin(bobT * 2.2) * 0.04, st.cz);
      mesh.rotation.y = st.cyaw;
      mesh.rotation.x = Math.sin(bobT * 1.7) * 0.03;
      mesh.rotation.z = Math.sin(bobT * 1.3) * 0.04;
      // paddle stroke: fore-aft swing + outward dip while moving; rest cleanly when idle
      const pL = mesh.getObjectByName('padL'), pR = mesh.getObjectByName('padR');
      const moving = Math.abs(st.cspd) > 0.35;
      const cadence = 2.2 + Math.abs(st.cspd) * 0.45;
      const swing = moving ? Math.sin(bobT * cadence) * 0.72 : Math.sin(bobT * 0.7) * 0.06;
      const dip = moving ? 0.18 + Math.abs(Math.sin(bobT * cadence)) * 0.22 : 0.08;
      if (pL) { pL.rotation.x = swing; pL.rotation.z = -0.55 - dip; }
      if (pR) { pR.rotation.x = -swing; pR.rotation.z = 0.55 + dip; }
      // seat pirate + crew + pet INSIDE the hollow canoe (feet on floorboards / benches)
      // benches at local z = -1.65, -0.55, +0.55, +1.55; floor y ≈ 0.16 → seatY ≈ mesh.y + 0.14
      const seatY = mesh.position.y + 0.18;
      const placeAt = (obj, zLocal, yOff = 0) => {
        if (!obj) return;
        obj.visible = true;
        obj.position.set(st.cx + Math.sin(st.cyaw) * zLocal, seatY + yOff, st.cz + Math.cos(st.cyaw) * zLocal);
        obj.rotation.y = st.cyaw;
      };
      if (pirateObj) placeAt(pirateObj, 0.55); // captain on forward-mid bench
      const crew = crewF?.list || [];
      const crewZ = [-0.55, -1.60];
      for (let i = 0; i < crew.length; i++) {
        const c = crew[i];
        if (i >= st.crewN) { c.p.object.visible = false; continue; }
        placeAt(c.p.object, crewZ[i] ?? (-0.55 - i * 1.05));
      }
      if (!petF?.mesh) {
        try { petF?.update?.(0, { x: st.cx, z: st.cz, yaw: st.cyaw }, { pirateObj: pirate?.object, petId: getLocalGear()?.parrot || 'none' }); } catch {}
      }
      { const po = petF?.mesh || petF?.object; if (po) placeAt(po, 1.60, 0.22); } // pet perched on the bow bench
      // camera follow — slightly pulled back / higher so the hollow canoe + crew read clearly
      if (camera && controls) {
        const dist = 10.5, pitch = 0.32;
        const cp = Math.cos(pitch);
        camera.position.set(st.cx - Math.sin(st.cyaw) * dist * cp, mesh.position.y + 3.6 + Math.sin(pitch) * dist, st.cz - Math.cos(st.cyaw) * dist * cp);
        camera.lookAt(st.cx, mesh.position.y + 1.15, st.cz);
        return true; // camera owned
      }
    } else if (st.mode === 'beached') {
      mesh.visible = true;
      mesh.position.set(st.bx, Math.max(0.02, H(st.bx, st.bz) * 0.1), st.bz);
      mesh.rotation.y = st.cyaw; mesh.rotation.x = 0.08; mesh.rotation.z = 0.05;
    } else {
      mesh.visible = false;
    }
    return st.mode === 'canoe';
  }

  function prompts({ s, onFoot, W, docking }) {
    if (!SAIL_ALL) return null;
    // canoe mode
    if (st.mode === 'canoe') {
      const dShip = s ? Math.hypot(st.cx - st.ax, st.cz - st.az) : 1e9;
      if (dShip < SAIL.canoeR) return { a: { label: 'BOARD SHIP', key: 'E', primary: true, tag: 'boardShip' }, b: null };
      if (shallow(st.cx, st.cz) || dry(st.cx, st.cz)) return { a: { label: 'LAND ON SHORE', key: 'E', primary: true, tag: 'land' }, b: null };
      return { a: { label: 'PADDLING…', disabled: true }, b: null };
    }
    // on foot near beached canoe
    if (st.mode === 'beached' && onFoot && W && Math.hypot(W.x - st.bx, W.z - st.bz) < SAIL.boardR)
      return { a: { label: 'BOARD CANOE', key: 'E', primary: true, tag: 'boardCanoeShore' }, b: null };
    // swimming to canoe / ship
    if (onFoot && W?.swim) {
      if (st.mode === 'beached' && Math.hypot(W.x - st.bx, W.z - st.bz) < SAIL.boardR)
        return { a: { label: 'BOARD CANOE', key: 'E', primary: true, tag: 'boardCanoeShore' }, b: null };
      if ((st.mode === 'anchored' || st.mode === 'beached') && s && Math.hypot(W.x - st.ax, W.z - st.az) < SAIL.canoeR)
        return { a: { label: 'BOARD SHIP', key: 'E', primary: true, tag: 'boardShipSwim' }, b: null };
    }
    // aboard ship at sea
    if (!onFoot && s?.alive && (!docking || docking.mode === 'sea')) {
      if (st.mode === 'anchored' || s._offshore) {
        return {
          a: { label: 'BOARD CANOE · GO ASHORE', key: 'E', primary: true, tag: 'launchCanoe' },
          b: { label: 'WEIGH ANCHOR · SET SAIL', key: 'W', tag: 'weigh' },
        };
      }
      if (nearLand(s.x, s.z) || s.anchor)
        return { a: { label: 'DROP ANCHOR', key: 'E', primary: true, tag: 'drop' }, b: null };
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
    if (tag === 'drop') return dropAnchor(s);
    if (tag === 'weigh') return weighAnchor(s);
    if (tag === 'launchCanoe') return boardCanoeFromShip(s, controls);
    if (tag === 'boardShip') return boardShipFromCanoe(s, () => { goAboard?.(true); }, controls);
    if (tag === 'boardShipSwim') {
      clearAll(s, controls); s.x = st.ax; s.z = st.az; s.yaw = st.ayaw; s.anchor = true; s._offshore = true; st.mode = 'anchored';
      goAboard?.(true); return true;
    }
    if (tag === 'land') return landAshore((x, z, yaw) => {
      goAshoreAt?.(x, z, yaw);
      crewF?.enter?.(); petF?.enter?.(walker?.w || { x, z });
    }, s);
    if (tag === 'boardCanoeShore') {
      walkerExit?.(); return boardCanoeFromShore();
    }
    if (tag === 'recall') return recallShip(s, docking, controls);
    return false;
  }

  return {
    get mode() { return st.mode; },
    get state() { return st; },
    mesh, dropAnchor, weighAnchor, tick, prompts, act, clearAll, recallShip,
    nearLand, inSailSea, clampSail,
  };
}
