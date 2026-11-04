// [Timothy] roundabout probe (no browser): registers, decks, walk heights along the routes (deck / high bridge with a layer), colliders
const F = await import(new URL('../../../', import.meta.url).href + 'js/island/foot.js');
const A = await import(new URL('../../../', import.meta.url).href + 'js/island/areas/index.js');
const HR = await import(new URL('../../../', import.meta.url).href + 'js/island/areas/hillRound.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
const HB = HR._hb; console.log('HB', { ax: HB.ax, az: HB.az, bx: +HB.bx.toFixed(2), bz: +HB.bz.toFixed(2), L: +HB.L.toFixed(1), yb: +HB.yb.toFixed(2) }, 'stats', JSON.stringify(HR.RB_STATS));
const ga = (x, z) => { const d = F.areaDeckAt(x, z); return d ?? F.H(x, z); };
const walk = (name, pts, ly = null) => { let y0 = null, maxStep = 0, hit = []; const tr = [];
  for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3);
    for (let j = 0; j <= n; j++) { const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n; let y = ga(x, z); if (ly !== null) { const hb = F.highBridgeAt(x, z, ly(y0 ?? y)); if (hb) y = hb.y; }
      if (y0 !== null) maxStep = Math.max(maxStep, Math.abs(y - y0)); if (F.hitCollider(x, z, 0.45)) hit.push([+x.toFixed(1), +z.toFixed(1)]); y0 = y; if (j % 10 === 0) tr.push([+x.toFixed(1), +z.toFixed(1), +y.toFixed(2)]); } }
  console.log(name.padEnd(14), 'maxStep', maxStep.toFixed(2), 'colliderHits', hit.length, hit.slice(0, 4).map(String).join(' '), '\n   ', tr.map(p => p.join(',')).join(' | ')); };
const AX = HR.RB2.az, B = !/rbblend=0/.test(process.env.QS || '');   // [rb-blender] the symmetric layout: the street axis z AX
if (B) {
walk('street->fount', [[-450, AX], [-438, AX], [-431, AX]]);
walk('round->bridge', [[-431, AX], [-428, AX + 6.5], [-420, AX + 6.5], [-416, AX], [-405, AX]], (y) => y);
{ const C = HR.CLIMB, c = (o) => [[(C.rimW + C.rimE) / 2, HR.RB2.plaza[2] + 2], ...Array.from({ length: 72 }, (_, i) => C.side(-C.back + 0.8 + (C.L + C.back + 1.2) * i / 71, o))];   // [stairs2] the curved Climb: centre + hugging both walls
  walk('stairs down', c(0)); walk('stairs hug out', c(1.95)); walk('stairs hug in', c(-1.95).slice(16)); walk('stairs up', c(0).reverse()); }
walk('to castle', [[-433.5, AX + 4], [-434, -72], [-434, -60]]);
walk('bridge mid', Array.from({ length: 11 }, (_, i) => [HB.ax + (HB.bx - HB.ax) * i / 10, HB.az + (HB.bz - HB.az) * i / 10]), (y) => y);
walk('under', [[-360, -112], [-360, -84], [-360, -40]]);
} else {
walk('gate->fountain', [[-446, -86], [-438, -87], [-431, -90]]);
walk('stairs down', [[-430, -95], [-428, -99.5], [-416, -119.3], [-413, -124]]);
walk('to castle', [[-433, -86], [-433.5, -76], [-434, -70], [-434, -60]]);
walk('to bridge', [[-425, -100], [-416, -92.5], [-411, -92.2], [-400, -90.4]], (y) => y);
walk('bridge mid', Array.from({ length: 11 }, (_, i) => [HB.ax + (HB.bx - HB.ax) * i / 10, HB.az + (HB.bz - HB.az) * i / 10]), (y) => y);
walk('under', [[-360, -112], [-360, -84], [-360, -40]]);
walk('gate->bridge', [[-446, -84], [-438, -84], [-418, -84], [-413, -88], [-405, -87]], (y) => y);
}
console.log('anchors', JSON.stringify(HR.FOUNTAIN_ANCHORS));
