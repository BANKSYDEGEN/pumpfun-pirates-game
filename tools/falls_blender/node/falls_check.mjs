// [Timothy falls-blender] node check for tests/fallsBlender.test.mjs: the baked layout vs this build, piece clearances, the GLB nodes.
//   cd tools/falls_blender/node && QS='?coast=1' node --import ../../roundabout_blender/node/reg.mjs falls_check.mjs
import { readFileSync, statSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).href;
const F = await import(root + 'js/island/foot.js');
const HR = await import(root + 'js/island/areas/hillRound.js');
const FB = await import(root + 'js/island/fallsBlender.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
const lay = JSON.parse(readFileSync(new URL('../../../assets/island/falls_layout.json', import.meta.url), 'utf8'));
const TP = [...F.TRAILS.A, ...F.TRAILS.B], tDist = (x, z) => { let d = 1e9; for (const [a, b] of TP) d = Math.min(d, (a - x) ** 2 + (b - z) ** 2); return Math.sqrt(d); };
const out = { on: FB.FALLS_ON, hbOn: FB.HBB_ON, d3: FB.d3Match(lay.d3, F.BRIDGE), hb: FB.hbMatch(lay.hb, HR._hb), ground: {}, clear: {}, glb: {} };
for (const k of ['d3', 'hb', 'area']) out.ground[k] = FB.groundOk(lay.hchk[k], F.H);
// nothing big on a trail: rim stones / boulders / plants >= 4 m from a trail centre line, lanterns past the kerbs (2.8 m), nothing on the dock
const P = lay.area.pieces, onDock = (p) => !p.aaa && Math.abs(p.x + 205) < 2.2 && p.z < -60 && p.z > -98;
out.clear.trail = P.filter(p => ['rim', 'plant', 'boulder', 'reeds'].includes(p.k) && tDist(p.x, p.z) < 4).map(p => [p.k, p.x, p.z]);
out.clear.lantern = P.filter(p => p.k === 'lantern').map(p => +tDist(p.x, p.z).toFixed(2));
// [waterfall-aaa] abutment / pavilion / skiff sit on the dock on purpose (aaa:1); legacy clutter still fails
out.clear.dock = P.filter(onDock).map(p => [p.k, p.x, p.z]);
// the bridges' walk is untouched: sample highBridgeAt on the layer + the D3 deck curve the visuals were baked on
const hb = HR._hb, prof = []; for (let i = 0; i <= 10; i++) { const t = i / 10, x = hb.ax + (hb.bx - hb.ax) * t, z = hb.az + (hb.bz - hb.az) * t, q = F.highBridgeAt(x, z, 999); prof.push(q ? +q.y.toFixed(3) : null); }
out.hbProfile = prof; out.hbN = F.HIGH_BRIDGES.filter(b => Math.abs(b.ax - hb.ax) < 1 && Math.abs(b.az - hb.az) < 1).length || (prof.some(Boolean) ? 1 : 0); out.hbAll = F.HIGH_BRIDGES.length; out.bridge = { ...F.BRIDGE };
for (const f of ['falls.glb', 'falls_low.glb']) { const u = new URL('../../../assets/island/' + f, import.meta.url), b = readFileSync(u), n = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + n).toString());
  out.glb[f] = { bytes: statSync(u).size, nodes: j.nodes.map(q => q.name).filter(Boolean) }; }
console.log(JSON.stringify(out));
