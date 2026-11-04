// [Timothy] PUMPFUN PIRATES roundabout site probe (no browser): heights / trail distance / colliders / decks on a grid -> ../site_<tag>.json (not committed)
//   cd tools/roundabout_blender/node && node --import ./reg.mjs site_probe.mjs [tag] [x0 x1 z0 z1 step]
import { writeFileSync } from 'node:fs';
const [tag = 'cur', ...rest] = process.argv.slice(2); const [x0, x1, z0, z1, s] = rest.length ? rest.map(Number) : [-470, -270, -140, -40, 1];
const F = await import(new URL('../../../', import.meta.url).href + 'js/island/foot.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); const Fl = [];
for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, Fl);
const o = { x0, x1, z0, z1, s, H: [], R: [], C: [], D: [] };
for (let z = z0; z <= z1 + 1e-6; z += s) { const h = [], r = [], c = [], d = []; for (let x = x0; x <= x1 + 1e-6; x += s) {
  h.push(+Math.max(F.H(x, z), F.Htri(x, z)).toFixed(2)); r.push(+F.trailDist(x, z).toFixed(1)); c.push(F.hitCollider(x, z, 0.05) ? 1 : 0); const dy = F.areaDeckAt(x, z); d.push(dy == null ? null : +dy.toFixed(2)); }
  o.H.push(h); o.R.push(r); o.C.push(c); o.D.push(d); }
o.trailA = F.TRAILS.A.map(p => [+p[0].toFixed(1), +p[1].toFixed(1), +F.H(p[0], p[1]).toFixed(2)]).filter(p => p[0] > x0 && p[0] < x1 && p[1] > z0 && p[1] < z1);
o.trailB = F.TRAILS.B.map(p => [+p[0].toFixed(1), +p[1].toFixed(1), +F.H(p[0], p[1]).toFixed(2)]).filter(p => p[0] > x0 && p[0] < x1 && p[1] > z0 && p[1] < z1);
o.decks = F.AREA_DECKS.filter(d => d.x > x0 - 20 && d.x < x1 + 20 && d.z > z0 - 20 && d.z < z1 + 20).map(d => ({ id: d.id, x: d.x, z: d.z, hw: d.hw, hl: d.hl, yaw: d.yaw, y: d.y }));
o.pois = F.FOOT_POIS.filter(q => q.x > x0 && q.x < x1 && q.z > z0 && q.z < z1).map(q => [q.id, Math.round(q.x), Math.round(q.z)]);
writeFileSync(`/workspace/rbqa/site_${tag}.json`, JSON.stringify(o)); console.log('ok', tag, o.H.length, 'x', o.H[0].length, 'trailA', o.trailA.length, 'decks', o.decks.map(d => d.id).join(','));
