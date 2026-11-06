// [Timothy v312] Squad Hall probe (tests/squadHallUpgrade.test.mjs): load the hill GLBs in node (fetch -> local files), build Main Street, walk the hall.
import { readFileSync } from 'node:fs';
const ROOT = new URL('../../../', import.meta.url);
globalThis.ProgressEvent = class { constructor(t, o = {}) { Object.assign(this, { type: t }, o); } };
globalThis.Request = class { constructor(u, o = {}) { this.url = String(u); this.headers = new Headers(o.headers || {}); this.credentials = o.credentials; this.signal = o.signal; } };
globalThis.fetch = async (u) => new Response(readFileSync(new URL((u.url || String(u)).replace(/^.*?assets\//, 'assets/'), ROOT)));
const HS = await import('../../../js/island/hillStreet.js'), low = process.env.LOW === '1';
const kit = await HS.loadHill(low);
const F = await import('../../../js/island/foot.js'), CO = await import('../../../js/island/coast.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, low, []);
const SQ = HS.squadHall(), out = { kit: !!kit, kind: kit && kit.lots.R0 && kit.lots.R0.kind, lods: kit && kit.lots.R0 ? kit.lots.R0.lods.length : 0, colliders: kit && kit.lots.R0 ? kit.lots.R0.colliders.length : 0, hall: SQ };
const gy = (lz) => 3.0 + Math.max(0, -lz - 50) * 0.11, ga = (x, z) => F.areaDeckAt(x, z) ?? F.H(x, z);
const walk = (pts) => { const hits = []; let prev, maxStep = 0, maxErr = 0;
  for (const [lx, lz, inside] of pts) { const [x, z] = CO.t2w(lx, lz), y = ga(x, z); if (F.hitCollider(x, z, 0.45)) hits.push([+lx.toFixed(2), +lz.toFixed(2)]);
    if (prev !== undefined) maxStep = Math.max(maxStep, Math.abs(y - prev)); prev = y; if (inside) maxErr = Math.max(maxErr, Math.abs(y - gy(lz))); }
  return { n: pts.length, hits: hits.slice(0, 10), nHits: hits.length, maxStep, maxErr }; };
if (SQ) {
  const pts = []; for (let lx = 8; lx <= SQ.interact.lx; lx += 0.1) pts.push([lx, SQ.door.lz, lx > SQ.rect.lx0 + 0.7]);
  out.approach = walk(pts);
  const tx = SQ.lx + 0.2, tz = SQ.lz, ring = []; for (let a = 0; a < Math.PI * 2; a += 0.02) ring.push([tx + 3.9 * Math.cos(a), tz + 3.9 * Math.sin(a), true]);
  out.ring = walk(ring); out.table = { lx: tx, lz: tz };
  // the war-table lane: a 0.45 m walker clears the table + chairs at 2.78 m by >= 2.8 m of free floor out to the nearest other collider
  let lane = Infinity; for (let a = 0; a < Math.PI * 2; a += 0.05) { for (let r = 2.78 + 0.46; r < 9; r += 0.05) { const [x, z] = CO.t2w(tx + r * Math.cos(a), tz + r * Math.sin(a)); if (F.hitCollider(x, z, 0.0)) { lane = Math.min(lane, r - 2.78); break; } } }
  out.lane = lane;
  out.wallSolid = [[SQ.rect.lx0 + 0.3, SQ.lz - 6], [SQ.rect.lx0 + 0.3, SQ.lz + 6], [SQ.rect.lx1 - 0.3, SQ.lz], [SQ.lx, SQ.rect.lz0 + 0.3], [SQ.lx, SQ.rect.lz1 - 0.3]].map(([lx, lz]) => F.hitCollider(...CO.t2w(lx, lz), 0.45));
}
const root = HS.buildHill(); out.built = root ? { tris: root.userData.tris, merged: root.children.filter(c => /merged_(solid|glow)/.test(c.name)).length, hall: !!root.getObjectByName('hill_R0'), door: !!root.getObjectByName('door_squad_hall') } : null;
const H = await import('../../../js/island/hillShops.js'), J = JSON.parse(readFileSync(new URL('assets/island/hill_shops.json', ROOT), 'utf8'));
const rects = [...H.RENTABLE_SHOPS, ...H.MAIN_ST_SHOPS].map(s => ({ id: s.id, lx0: s.interior.lx0 - 0.5, lx1: s.interior.lx1 + 0.5, lz0: s.interior.lz0 - 0.5, lz1: s.interior.lz1 + 0.5 }));   // the walls round each shop room
const S = H.SQUAD_HALL.rect; out.overlaps = rects.filter(r => r.lx0 < S.lx1 && r.lx1 > S.lx0 && r.lz0 < S.lz1 && r.lz1 > S.lz0).map(r => r.id); out.json = J.SQUAD_HALL || null;
console.log(JSON.stringify(out));
