// [v314] node probe for tests/canoeAndAiSpawns.test.mjs: node --import tools/roundabout_blender/node/reg.mjs tools/sail/canoe_check.mjs
// prints ONE JSON line (last line) with the canoe / prompt / AI-spawn facts the test asserts.
globalThis.addEventListener ??= () => {}; globalThis.removeEventListener ??= () => {}; globalThis.dispatchEvent ??= () => true;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} }); globalThis.requestAnimationFrame ??= () => 0;
globalThis.Image ??= class { set src(v) { setTimeout(() => this.onerror?.(), 0); } };
globalThis.sessionStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
const cls = new Set(); document.documentElement = { classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle() {} } };
const THREE = await import('three');
const FM = await import('../../js/island/foot.js'), CO = await import('../../js/island/coast.js');
const C = await import('../../js/dock/canoe.js'), PV = await import('../../js/pvp.js');
const { coastLayout } = await import('../../js/dock/layout.js'), { createDocking } = await import('../../js/dock/docking.js');
const H = (x, z) => FM.H(...CO.fromHarbor(x, z));
const out = {};
// ---- AI spawns ----
const SI = PV.SPAWNS_ISLAND, deep = PV.islandSpawnsDeep(H);
out.spawns = { n: SI.length, deepN: deep.length, minDock: Math.min(...SI.map(([x, z]) => Math.hypot(x - 160, z))), min0: Math.min(...SI.map(([x, z]) => Math.hypot(x, z))),
  maxHdeep: Math.max(...deep.map(([x, z]) => H(x, z))),
  sectors: [...new Set(deep.map(([x, z]) => Math.round(((Math.atan2(z - C.SAIL.cz, x - C.SAIL.cx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 2)) % 4))].sort() };
// patrol sim: 6 bots, no target, 240 s — never inside 480 m of the dock (after leaving spawn), stay in deep-ish water
{ const L = { FM, harborToFoot: CO.fromHarbor }; let minDock = 1e9, shallowHits = 0; const bots = deep.slice(0, 8).map(([x, z], i) => ({ x, z, yaw: PV.patrolHeading(x, z, i % 2 ? 1 : -1, 640 + (i % 4) * 95), patrolDir: i % 2 ? 1 : -1, patrolR: 640 + (i % 4) * 95, islandPatrol: true, tgt: { alive: false } }));
  for (let t = 0; t < 240; t += 0.1) for (const e of bots) { const want = PV.islandSteer(e, e.yaw, L); let d = Math.atan2(Math.sin(want - e.yaw), Math.cos(want - e.yaw)); e.yaw += Math.max(-0.08, Math.min(0.08, d)); e.x += Math.sin(e.yaw) * 1.2; e.z += Math.cos(e.yaw) * 1.2;
    minDock = Math.min(minDock, Math.hypot(e.x - 160, e.z)); if (H(e.x, e.z) > -2) shallowHits++; }
  out.patrol = { minDock, shallowHits, travelled: bots.map(e => Math.hypot(e.x - C.SAIL.cx, e.z - C.SAIL.cz)) }; }
// ---- Commodore: 40 random spawns (last spawn chained, a few ships about) ----
{ const ships = [{ x: 200, z: 0 }, { x: deep[0][0], z: deep[0][1] }]; let last = null; const picks = [];
  for (let i = 0; i < 40; i++) { const p = PV.pickBossSpawn(H, ships, last); picks.push(p); last = p; }
  const q = picks.map(([x, z]) => (x >= C.SAIL.cx ? 1 : 0) + (z >= C.SAIL.cz ? 2 : 0));
  out.boss = { n: picks.length, minDock: Math.min(...picks.map(([x, z]) => Math.hypot(x - 160, z))), maxH: Math.max(...picks.map(([x, z]) => H(x, z))),
    quads: [...new Set(q)].sort(), distinct: new Set(picks.map(p => p.join(','))).size,
    minJump: Math.min(...picks.slice(1).map((p, i) => Math.hypot(p[0] - picks[i][0], p[1] - picks[i][1]))),
    minShip: Math.min(...picks.map(([x, z]) => Math.min(...ships.map(s => Math.hypot(s.x - x, s.z - z))))) }; }
// ---- canoe ----
let T = 0; const AMP = 2.2, wave = (x, z) => AMP * Math.sin(x * 0.05 + T * 1.3) * Math.cos(z * 0.04 - T * 0.9);
const scene = new THREE.Scene(), pirate = { object: new THREE.Object3D() };
const canoe = C.createCanoe({ scene, layout: { FM, harborToFoot: CO.fromHarbor }, walker: { w: {} }, pirate, crewF: null, petF: null, getPlayer: () => ship, waveY: wave });
// offshore ship: a deep island spawn point
const [sx, sz] = deep[0]; const ship = { x: sx, z: sz, yaw: 0.4, alive: true, anchor: false, sail: 2, speed: 0, turn: 0 };
const docking = { mode: 'sea' };
const pr = (o = {}) => canoe.prompts({ s: ship, onFoot: false, W: {}, docking, ...o });
out.prompts = {};
out.prompts.unanchored = pr(); ship.speed = 6; out.prompts.unanchoredFast = pr(); ship.speed = 0;
ship.anchor = true; ship.sail = 0; out.prompts.anchoredFast = (ship.speed = 5, pr()); ship.speed = 0;
out.prompts.anchored = pr()?.a?.label || null;
{ const keep = [ship.x, ship.z]; ship.x = 185; ship.z = 0; out.prompts.mainDockAnchored = pr(); ship.x = keep[0]; ship.z = keep[1]; }
// real dock: berths + docking.query at the main dock (the approach wins: index.js asks docking.query before canoe.prompts)
{ const layout = await coastLayout(); const dk = createDocking({ berths: layout.berths, myId: () => 'me' }); const b = layout.berths[0]; out.dockHasBerths = Array.isArray(dk.berths);
  const s2 = { x: b.x + 12, z: b.z, yaw: b.yaw, speed: 0, anchor: true, alive: true };
  out.dock = { berth: [b.x, b.z], query: dk.query(s2), canoeAtBerth: canoe.prompts({ s: s2, onFoot: false, W: {}, docking: dk }), allBerthsInCorridor: layout.berths.every(q => q.x > 135 && q.x < 240 && Math.abs(q.z) < 95), berths: layout.berths.map(q => [Math.round(q.x), Math.round(q.z)]) }; }
// launch
out.launch = canoe.act('launchCanoe', { s: ship });
const st = canoe.state; out.mode1 = canoe.mode;
const a0 = [ship.x, ship.z, ship.yaw], c0 = [st.cx, st.cz];
const key = (code, down) => canoe.onKey({ code }, down);
out.keyW = key('KeyW', true); out.keyM = key('KeyM', true);
let wavePass = true, minGap = 1e9, capOk = true;
for (let i = 0; i < 180; i++) { T += 1 / 60; ship.sail = 2; ship.x += 0.3; /* main.js would try to move it */ canoe.tick(1 / 60, { s: ship });
  const m = canoe.mesh.position, w = wave(m.x, m.z); minGap = Math.min(minGap, m.y - w); if (!(m.y > w)) wavePass = false;
  const hc = canoe.hullCap(); if (!hc || !(hc.capY - 0.3 > w) || !(hc.capY - 0.3 < m.y + 0.16 + 0.05) || !(hc.halfBeam > 0.5) || !(hc.len > 5)) capOk = false; }
key('KeyW', false);
out.paddle = { moved: Math.hypot(st.cx - c0[0], st.cz - c0[1]), shipLocked: ship.x === a0[0] && ship.z === a0[1] && ship.yaw === a0[2] && ship.sail === 0 && ship.anchor === true && ship.speed === 0, wavePass, minGap, capOk, hullCap: canoe.hullCap(), amp: AMP };
// turn: D = right (yaw decreases)
{ const y0 = st.cyaw; key('KeyD', true); for (let i = 0; i < 30; i++) canoe.tick(1 / 60, { s: ship }); key('KeyD', false); out.turnD = st.cyaw - y0; }
// high-wave check: a 2.2 m crest under the canoe
{ T = 0; const big = (x, z) => 2.2; const c2 = C.createCanoe({ scene, layout: { FM, harborToFoot: CO.fromHarbor }, walker: { w: {} }, pirate, getPlayer: () => ship, waveY: big });
  const s3 = { ...ship, x: ship.x, z: ship.z, anchor: true, speed: 0 }; c2.act('launchCanoe', { s: s3 }); c2.tick(1 / 60, { s: s3 }); out.highWave = { y: c2.mesh.position.y, wave: 2.2, cap: c2.hullCap() }; }
// paddle to shore: walk the canoe toward the island centre until GO TO ISLAND shows
{ let found = null; const dx = C.SAIL.cx - st.cx, dz = C.SAIL.cz - st.cz, d = Math.hypot(dx, dz);
  for (let r = 0; r < d; r += 2) { const x = st.cx + dx / d * r, z = st.cz + dz / d * r; if (H(x, z) > -0.05) break; if (canoe.canLandAshore(x, z)) { found = [x, z]; break; } }
  out.shoreFound = !!found;
  if (found) { st.cx = found[0]; st.cz = found[1]; st.cyaw = Math.atan2(dx, dz); out.shorePrompt = pr(); let landed = null;
    out.landOk = canoe.act('land', { s: ship, goAshoreAt: (x, z, yaw) => { landed = { x, z, yaw, H: H(x, z) }; } }); out.landed = landed; out.mode2 = canoe.mode;
    out.beach = { bx: st.bx, bz: st.bz, H: H(st.bx, st.bz), dWalk: landed ? Math.hypot(landed.x - st.bx, landed.z - st.bz) : null };
    canoe.tick(1 / 60, { s: ship }); out.lockedBeached = ship.x === a0[0] && ship.z === a0[1];
    out.boardCanoePrompt = landed ? canoe.prompts({ s: ship, onFoot: true, W: { x: landed.x, z: landed.z }, docking })?.a?.label : null;
    out.relaunch = canoe.act('boardCanoeShore', {}); out.relaunchH = H(st.cx, st.cz); out.mode3 = canoe.mode;
    // both prompts: ship anchored next to this shore
    const keepA = [st.ax, st.az]; st.ax = st.cx + 6; st.az = st.cz; st.cx = found[0]; st.cz = found[1]; out.bothPrompt = pr(); st.ax = keepA[0]; st.az = keepA[1]; } }
// back to the ship
st.cx = st.ax + 8; st.cz = st.az; out.shipPrompt = pr();
let aboard = false; out.boardShip = canoe.act('boardShip', { s: ship, goAboard: () => { aboard = true; } }); out.aboard = aboard; out.mode4 = canoe.mode;
out.afterBoard = { anchor: ship.anchor, prompt: pr()?.a?.label || null };
ship.anchor = false; ship.sail = 1; out.afterAnchorUp = pr();
out.canoeCls = cls.has('pfp-canoe');
console.log(JSON.stringify(out));
process.exit(0);
