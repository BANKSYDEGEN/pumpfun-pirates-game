// [island-rework] WALK TEST (BANKSY 5:50/5:51 PM "make it all transition smoothly … do that for full island"). Runs IN the game page
// (tools/walktest/walktest.py imports it after the harbor boots) on the game's own walk rules (foot.js groundAt / blocked / decks).
// For every route (routes.js) it walks in 2 cm steps and logs, with foot x/z + the grid cell:
//   pop    a vertical jump > 3 cm inside one 2 cm step (lips, deck edges, tread pops: the walker would stutter / snap)
//   drop   the ground falls away > 0.6 m inside one step (a ledge on the path: Raul's physics drops you)
//   slide  the walk rule blocks the path line but a parallel line 0.4-1.2 m to the side is open (the walker slides round a prop)
//   stuck  the walk rule blocks the next step and every parallel line up to 1.2 m to either side: the walker catches
//   void   no ground / NaN / below -20 (falling through the world)
//   seam   a walk deck meets the terrain with a visible step > 8 cm between the planks / treads and the ground
//   cam    the follow camera (walker.js camPos: 7 m, pitch 0.28, pulled in front of walls) still has to jump up > 1.2 m within 1 m of walking (the view pops; a smooth rise down a long stair is fine)
// It is a REPORT (BANKSY 5:51 PM): hard blockers are void + stuck-with-no-way-out; everything else is a follow-up list per cell.
import { routes, cellOf } from './routes.js';
export async function run({ set = 'batch', step = 0.02, popMax = 0.03 } = {}) {
  const D = PFP.dock, FM = D.layout.FM, f = D.world.foot, A = await import('../../js/island/areas/index.js');
  const RT = (await import('../../js/island/areas/route.js'))._route, ctx = { FM, AREA_DECKS: FM.AREA_DECKS, AREA_TERRAIN: A.AREA_TERRAIN, ROUTE_PTS: RT.pts };
  const list = routes(set, ctx), out = { set, step, popMax, routes: [], cells: {} }, t0 = performance.now();
  const add = (cell, ev) => { const c = out.cells[cell] = out.cells[cell] || { pop: 0, drop: 0, slide: 0, stuck: 0, void: 0, seam: 0, cam: 0, worst: [] }; c[ev.t]++; c.worst.push(ev); };
  for (const r of list) { const ev = []; let walked = 0, last = null, prevY = null, prevDeck = null, lastCam = -9, prevLift = 0;
    for (let i = 1; i < r.pts.length; i++) { const [ax, az] = r.pts[i - 1], [bx, bz] = r.pts[i], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
      const ux = (bx - ax) / L, uz = (bz - az) / L, n = Math.ceil(L / step);
      for (let k = 0; k <= n; k++) { const x = ax + ux * Math.min(L, k * step), z = az + uz * Math.min(L, k * step); const y = f.groundAt(x, z), dk = FM.areaDeckAt(x, z);
        const cell = cellOf(x, z), P = (t, extra) => { const e = { t, route: r.id, cell, x: +x.toFixed(2), z: +z.toFixed(2), y: +(+y).toFixed(2), ...extra }; ev.push(e); add(cell, e); };
        if (!(y > -20)) { P('void'); prevY = null; continue; }
        if (last) { const dy = y - prevY;
          if (f.blocked(x, z, last[0], last[1])) { const free = [0.4, 0.8, 1.2].some(o => [-1, 1].some(sd => !f.blocked(x - uz * o * sd, z + ux * o * sd, last[0] - uz * o * sd, last[1] + ux * o * sd)));
            if (!r.border) P(free ? 'slide' : 'stuck', { why: f.whyBlocked(x, z, last[0], last[1]) }); }
          else if (dy < -0.6) P('drop', { dy: +dy.toFixed(2) });
          else if (Math.abs(dy) > popMax) P('pop', { dy: +dy.toFixed(3) });
          if ((dk === null) !== (prevDeck === null) && (dk === null ? Math.abs(y - FM.H(x, z)) < 0.05 : Math.abs(prevY - FM.H(last[0], last[1])) < 0.05)) { const g = FM.H(x, z), dd = dk === null ? prevDeck : dk; if (Math.abs(dd - g) > 0.08) P('seam', { gap: +(dd - g).toFixed(2) }); } } // (an area deck handing over to another walk surface, e.g. the rope bridge planks, is not a ground seam)
        // camera = walker.js camPos: 7 m behind along the walk direction, pitch 0.28, pulled in front of any wall / tower / cliff edge
        // (walk ground jumps > 1.2 m between samples), then lifted to ground + 0.8. A lift > 1.5 m left after the pull-in = the view pops.
        if (walked - lastCam >= 1) { lastCam = walked; const D = 7, hy = y + 1.5; let cx = x - ux * D * Math.cos(0.28), cz = z - uz * D * Math.cos(0.28), cy = y + 1.7 + D * Math.sin(0.28), pg = y, cut = 1;
          for (let i = 1; i <= 10; i++) { const t = i / 10, gx = x + (cx - x) * t, gz = z + (cz - z) * t, g = f.groundAt(gx, gz); if (g - pg > 1.2 && g + 0.3 > hy + (cy - hy) * t) { cut = Math.max(0.1, t - 0.1 - 0.3 / D); break; } pg = g; }
          if (cut < 1) { cx = x + (cx - x) * cut; cz = z + (cz - z) * cut; cy = hy + (cy - hy) * cut; }
          const lift = Math.max(0, (f.groundAt(cx, cz) + 0.8) - cy); if (lift - prevLift > 1.2) P('cam', { lift: +lift.toFixed(1), jump: +(lift - prevLift).toFixed(1), pull: +(D * (1 - cut)).toFixed(1) }); prevLift = lift; }
        prevY = y; prevDeck = dk; last = [x, z]; walked += step; } }
    const by = {}; for (const e of ev) by[e.t] = (by[e.t] || 0) + 1;
    // sites: runs of the same event type along the route (gap < 1.5 m) collapsed to one line: where it starts / ends, how many, how bad
    const sites = []; for (const e of ev) { const v = Math.abs(e.dy ?? e.gap ?? e.lift ?? 0), s = sites.find(q => q.t === e.t && Math.hypot(q.x1 - e.x, q.z1 - e.z) < 1.5);
      if (s) { s.x1 = e.x; s.z1 = e.z; s.n++; s.max = Math.max(s.max, v); s.len = +Math.hypot(s.x1 - s.x, s.z1 - s.z).toFixed(1); } else sites.push({ t: e.t, route: r.id, cell: e.cell, x: e.x, z: e.z, y: e.y, x1: e.x, z1: e.z, n: 1, max: v, len: 0, why: e.why }); }
    for (const s of sites) (out.cells[s.cell].sites = out.cells[s.cell].sites || []).push(s);
    out.routes.push({ id: r.id, len: +walked.toFixed(1), events: by, worst: ev.filter(e => e.t !== 'pop' || Math.abs(e.dy) > 0.06).slice(0, 40), pops: ev.filter(e => e.t === 'pop').sort((a, b) => Math.abs(b.dy) - Math.abs(a.dy)).slice(0, 15), sites }); }
  for (const c of Object.values(out.cells)) { c.sites = (c.sites || []).sort((a, b) => b.n * b.max - a.n * a.max); c.worst = c.worst.sort((a, b) => (Math.abs(b.dy || b.gap || 1)) - (Math.abs(a.dy || a.gap || 1))).slice(0, 12); }
  out.ms = Math.round(performance.now() - t0); return out;
}
