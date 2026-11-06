import { readFileSync } from 'node:fs';
const ROOT = new URL('../../../', import.meta.url);
globalThis.ProgressEvent ??= class extends Event { constructor(t, o = {}) { super(t); Object.assign(this, o); } };
const THREE = await import('three');
THREE.DefaultLoadingManager.setURLModifier(u => /^https?:|^data:|^blob:/.test(u) ? u : 'http://local/' + u);
const nf = globalThis.fetch; globalThis.fetch = async (r) => { const u = typeof r === 'string' ? r : r.url; if (u.startsWith('http://local/')) return new Response(readFileSync(new URL(u.slice(13), ROOT))); return nf(r); };
const F = await import('../../../js/island/foot.js'), CO = await import('../../../js/island/coast.js'), BT = await import('../../../js/island/battery.js'), PS = await import('../../../js/island/plazaShops.js');
const out = {};
// 1. GLBs
for (const low of [false, true]) { let K = null, err = null; try { K = await PS.loadBattery(low); } catch (e) { err = String(e); }
  const st = K ? PS.buildBatteryStatic(new THREE.Vector3(), 0) : null; let glow = 0; st?.traverse(o => { if (/battery_glow/.test(o.name)) glow++; });
  out[low ? 'low' : 'high'] = { ok: !!K, err, lods: K?.lods.length || 0, glows: (K?.glows || []).filter(Boolean).length, carriage: !!K?.carriage, barrel: !!K?.barrel, flag: K?.flag || null, levels: st?.levels.length || 0, glowMeshes: glow,
    tris: K ? K.lods.map(g => (g.index ? g.index.count : g.attributes.position.count) / 3) : [] }; }
// 2. colliders (procedural pass = the same colliders the Blender art keeps)
await import('../../../js/island/plazaShops.js').then(m => { /* reset kit so buildArt keeps the procedural branch too */ });
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
const hit = (lx, lz) => F.hitCollider(...CO.t2w(lx, lz), .45), ga = (lx, lz) => { const [x, z] = CO.t2w(lx, lz); return F.areaDeckAt(x, z) ?? F.H(x, z); };
const poly = (pts) => { const o = []; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.25)); for (let k = 0; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; };
const B = BT.BATTERY, pol = (a, r) => [B.lx + Math.sin(a) * r, B.lz + Math.cos(a) * r], up = [[111, 0], [174, 0], [180, 8], [176, 22]];
const arc = (a0, a1, r) => { const o = []; for (let i = 0; i <= 12; i++) o.push(pol(a0 + (a1 - a0) * i / 12, r)); return o; }, aL = Math.atan2(176 - B.lx, 22 - B.lz);
const walks = {};
for (const g of BT.GUNS) walks['gun' + g.i] = poly([...up, ...arc(aL, g.a, 7), [g.slx, g.slz]]);
walks.mast = poly([...up, ...arc(aL, aL - 0.4, 7), pol(aL - 0.4, BT.MAST.r + 0.5)]);
for (const off of [-3.5, -1.75, 0, 1.75, 3.5]) walks['ramp' + off] = poly([[111, off], [185, off]]);
out.walks = {}; for (const [k, pts] of Object.entries(walks)) { const hits = pts.filter(p => hit(...p)).map(p => p.map(v => +v.toFixed(2))); let maxStep = 0, prev = null;
  for (const p of pts) { const y = ga(...p); if (prev !== null) maxStep = Math.max(maxStep, Math.abs(y - prev)); prev = y; } out.walks[k] = { n: pts.length, hits: hits.slice(0, 5), nHits: hits.length, maxStep: +maxStep.toFixed(3) }; }
out.solid = { mast: hit(B.lx, B.lz), mag: hit(...BT.MAG_COLLIDERS[0].box), gateN: hit(BT.GATE.lx, BT.GATE.hw + BT.GATE.pd / 2), gateS: hit(BT.GATE.lx, -(BT.GATE.hw + BT.GATE.pd / 2)), deckY: +ga(B.lx + 5, B.lz).toFixed(3), rampTopY: +ga(173, 0).toFixed(3) };
// 3. flag + guns
const g = BT.buildPfpFlag(false), front = g.getObjectByName('battery_pfp_flag_front'), back = g.getObjectByName('battery_pfp_flag_back');
const p0 = Float32Array.from(front.geometry.attributes.position.array); g.userData.wave(1.7); const p1 = front.geometry.attributes.position.array; let moved = 0; for (let i = 0; i < p0.length; i++) moved = Math.max(moved, Math.abs(p0[i] - p1[i]));
const root = new THREE.Group(); const guns = BT.createGuns(root, { toon: new THREE.MeshLambertMaterial({ vertexColors: true }) }, { plain: new THREE.MeshBasicMaterial() }, false);
const wp = new THREE.Vector3(); root.getObjectByName('battery_pfp_flag_cloth').getWorldPosition(wp);
out.flag = { src: BT.PFP_FLAG_SRC, frontSide: front.material.side, backSide: back.material.side, sameGeo: front.geometry === back.geometry, moved: +moved.toFixed(3), plaques: g.children.filter(c => c.name === 'battery_gate_plaque').length,
  mounted: !!root.getObjectByName('battery_pfp_flag'), clothY: +wp.y.toFixed(2), clothXZ: CO.w2t(wp.x, wp.z).map(v => +v.toFixed(2)), guns: guns.guns.length, gunMeshes: guns.meshes.length };
console.log(JSON.stringify(out));
