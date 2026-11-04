// [Timothy stairs2] the curved Pirates' Climb, no browser: walk heights vs the treads you see, wall colliders (continuous, flush), coverage (no
// holes in the walk), terrain never over a tread, the top flush with the plaza, the foot flush with the trail.   node --import ./reg.mjs climb_probe.mjs
const root = new URL('../../../', import.meta.url).href;
const F = await import(root + 'js/island/foot.js'), HR = await import(root + 'js/island/areas/hillRound.js'), RTm = await import(root + 'js/island/areas/route.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
const C = HR.CLIMB, Y = C.y0, out = { L: +C.L.toFixed(2), n: C.n, rise: +C.rise.toFixed(4), going: +C.d.toFixed(3), grade: +(C.rise / C.d).toFixed(3), yE: +C.yE.toFixed(3), hw: C.hw };
const ga = (x, z) => F.areaDeckAt(x, z) ?? F.H(x, z), topAt = (i, o) => C.walkO((i + 0.5) * C.d, o);
// 1) treads: walk at each tread centre (centre line + both edges) = the tread top; ground never above a tread
let dTop = 0, poke = -1e9; for (let i = 0; i < C.n; i++) { const sc = (i + 0.5) * C.d;
  for (const o of [-C.hw + 0.1, 0, C.hw - 0.1]) { const [x, z] = C.side(sc, o); const top = topAt(i, o); dTop = Math.max(dTop, Math.abs(ga(x, z) - top)); poke = Math.max(poke, F.H(x, z) - (top - 0.06)); } }
out.treadTopVsWalk = +dTop.toFixed(3); out.groundOverTread = +poke.toFixed(3);   // want ~0 / < 0
// 2) walks along the curve at offsets (centre, hugging both walls), down + up: biggest height change per 0.3 m, collider hits at player radius 0.45
const walk = (off, s0, s1) => { let y0 = null, m = 0, hits = 0, n = Math.ceil(Math.abs(s1 - s0) / 0.3); for (let j = 0; j <= n; j++) { const s = s0 + (s1 - s0) * j / n, [x, z] = C.side(s, off), y = ga(x, z);
  if (y0 !== null) m = Math.max(m, Math.abs(y - y0)); y0 = y; if (F.hitCollider(x, z, 0.45)) hits++; } return { maxStep: +m.toFixed(3), hits }; };
out.walks = {}; for (const [k, o, s0] of [['centre', 0, -C.back + 0.5], ['hug_outer', 2.0, -C.back + 0.5], ['hug_inner', -2.0, 0]]) { out.walks[k + '_down'] = walk(o, s0, C.L + 2); out.walks[k + '_up'] = walk(o, C.L + 2, s0); }   // (the landing's inner side is the opening onto the plaza)
// 3) the walls: a collider all the way along both sides just past the walk (no slot to slip into), none inside the walk
let gapsWall = [], inWalk = 0; for (let s = -C.back + 0.3; s <= C.L - 0.05; s += 0.1) for (const sg of [-1, 1]) { if (sg < 0 && s < 0) continue; const [x, z] = C.side(s, sg * (C.hw + 0.3)); if (!F.hitCollider(x, z, 0.05)) gapsWall.push([+s.toFixed(1), sg]);
  const [ix, iz] = C.side(s, sg * (C.hw - 0.5)); if (F.hitCollider(ix, iz, 0.05)) inWalk++; }
out.wallGaps = gapsWall.length; out.wallGapAt = gapsWall.slice(0, 6); out.collidersInWalk = inWalk;
// 4) coverage: every point of the walk (landing + flight) has a deck
let holes = []; for (let s = -C.back + 0.1; s <= C.L; s += 0.1) for (let o = -C.hw + 0.05; o <= C.hw - 0.05; o += 0.25) { const [x, z] = C.side(s, o); if (F.areaDeckAt(x, z) === null) holes.push([+s.toFixed(1), +o.toFixed(2)]); }
out.holes = holes.length; out.holeAt = holes.slice(0, 6);
// 5) the opening on the plaza rim: walk height across the rim (plaza -> landing) and the foot -> the trail beyond
const rim = []; for (let x = C.rimW + 0.6; x <= C.rimE - 0.6; x += 0.5) { const a = ga(x, -95.5), b = ga(x, -96.5), c = ga(x, -97.5); rim.push(+Math.max(Math.abs(a - b), Math.abs(b - c)).toFixed(3)); }
out.rimStep = Math.max(...rim); out.openingWidth = +(C.rimE - C.rimW - 0.5).toFixed(2);
const [ex, ez] = C.at(C.L), a = C.yawAt(C.L); out.foot = { at: [+ex.toFixed(2), +ez.toFixed(2)], walk: +ga(ex - Math.sin(a) * 0.1, ez - Math.cos(a) * 0.1).toFixed(3), trail: +F.H(ex + Math.sin(a) * 0.6, ez + Math.cos(a) * 0.6).toFixed(3), yawStair: +a.toFixed(3) };
{ const RT = RTm._route; let best = 1e9, k = 0; RT.pts.forEach((p, i) => { const d = Math.hypot(p[0] - ex, p[1] - ez); if (d < best) { best = d; k = i; } }); const p = RT.pts[k], q = RT.pts[k + 1]; out.foot.yawTrail = +Math.atan2(q[0] - p[0], q[1] - p[1]).toFixed(3); out.foot.offTrail = +best.toFixed(2);
  out.routeLamps = RT.lamps.filter(l => l.k < 3).map(l => ({ k: l.k, x: +l.x.toFixed(1), z: +l.z.toFixed(1), y: +l.y.toFixed(2), deck: F.areaDeckAt(l.x, l.z) })); out.sign = RT.lm.sign && [+RT.lm.sign.x.toFixed(2), +RT.lm.sign.z.toFixed(2)]; }
// 6) the hill-street shops next to the plaza: nothing walkable or built inside their footprints
{ const { readFileSync } = await import('node:fs'); const B = JSON.parse(readFileSync(new URL('../../../assets/island/building_numbers.json', import.meta.url), 'utf8')).buildings;
  out.shopOverlap = B.filter(b => b.area === 'hill street').filter(b => { const x0 = -640 - (b.lz + b.d / 2), x1 = -640 - (b.lz - b.d / 2), z0 = -90 + b.lx - b.w / 2, z1 = -90 + b.lx + b.w / 2; let hit = 0;
    for (let x = x0 + 0.05; x < x1; x += 0.2) for (let z = z0 + 0.05; z < z1; z += 0.2) { const d = F.AREA_DECKS.find(d => !d.off && /^rb_/.test(d.id) && F.areaDeckAt(x, z) !== null && (() => { const dx = x - d.x, dz = z - d.z; return d.path ? false : Math.abs(dx * d.c - dz * d.s) <= d.hw && Math.abs(dx * d.s + dz * d.c) <= d.hl; })()); if (d) hit++; } return hit > 0; }).map(b => b.n); }
console.log(JSON.stringify(out, null, 1));
