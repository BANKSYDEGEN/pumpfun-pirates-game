// [Timothy rb-blender] JSON facts for tests/rbBlend.test.mjs (no browser): the street axis, the plaza / fountain / bridge head, the anchors,
// the baked layout vs this build, walk steps on the exits, the hill-street buildings vs the plaza.   QS='?coast=1[&rbblend=0]'
import { readFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url).href;
const F = await import(root + 'js/island/foot.js'), HR = await import(root + 'js/island/areas/hillRound.js');
const R = new Proxy({}, { get: () => [0, 0, 1, 1] }); for (const fn of ['buildStreet', 'buildInland', 'buildCoast']) F[fn](R, true, []);
const THREE = await import('three'); const mat = new THREE.MeshBasicMaterial(); globalThis.fetch = undefined;
HR.default.build({ MATS: new Proxy({}, { get: () => mat }), OUT: mat, low: false, H: F.H });
const ref = JSON.parse(readFileSync(new URL('../../../assets/island/rb_plaza_layout.json', import.meta.url), 'utf8'));
const ga = (x, z) => F.areaDeckAt(x, z) ?? F.H(x, z);
const step = (pts) => { let y0 = null, m = 0, hits = 0; for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.3);
  for (let j = 0; j <= n; j++) { const x = ax + (bx - ax) * j / n, z = az + (bz - az) * j / n, y = ga(x, z); if (y0 !== null) m = Math.max(m, Math.abs(y - y0)); y0 = y; if (F.hitCollider(x, z, 0.45)) hits++; } } return { maxStep: +m.toFixed(3), hits }; };
const B = JSON.parse(readFileSync(new URL('../../../assets/island/building_numbers.json', import.meta.url), 'utf8')).buildings;
const [PX0, PX1, PZ0, PZ1] = HR.RB2.plaza;
const shops = B.filter(b => b.kind === 'building' && b.area !== 'dock plaza').map(b => ({ n: b.n, id: b.id, x0: b.x - b.d / 2, x1: b.x + b.d / 2, z0: b.z - b.w / 2, z1: b.z + b.w / 2 }));
const overlap = shops.filter(s => s.x1 > PX0 - 0.5 && s.x0 < PX1 + 0.5 && s.z1 > PZ0 - 0.5 && s.z0 < PZ1 + 0.5).map(s => s.n);
const deckIn = shops.filter(s => { for (let x = s.x0 + 0.05; x < s.x1; x += 0.25) for (let z = s.z0 + 0.05; z < s.z1; z += 0.25) { const y = F.areaDeckAt(x, z); if (y !== null && F.AREA_DECKS.some(d => !d.off && /^rb_/.test(d.id) && !d.path && Math.abs((x - d.x) * d.c - (z - d.z) * d.s) <= d.hw && Math.abs((x - d.x) * d.s + (z - d.z) * d.c) <= d.hl)) return true; } return false; }).map(s => s.n);   // [stairs2] the plaza's walk decks never reach into a shop (the town-side ramp ran 1 m into #32 + #44)
const AX = F.townToWorld(F.STREET.x, F.STREET.z1)[1];
console.log(JSON.stringify({ axisZ: AX, RB2: HR.RB2, FOUNTAIN: HR.FOUNTAIN, anchors: HR.FOUNTAIN_ANCHORS, hb: { ax: HR._hb.ax, az: HR._hb.az, L: HR._hb.L },
  layoutMatch: HR.layoutMatch(ref.pieces, HR.RB_LAYOUT), hilltopKit: HR.HILLTOP_KIT, pieces: HR.RB_LAYOUT.length, overlap, deckIn, n20: shops.find(s => s.n === 20),
  walks: { street: step([[-450, AX], [-431, AX]]), stairs: step([[(HR.CLIMB.rimW + HR.CLIMB.rimE) / 2, PZ0 + 2], ...Array.from({ length: 72 }, (_, i) => HR.CLIMB.side(-HR.CLIMB.back + 0.8 + (HR.CLIMB.L + HR.CLIMB.back + 1.2) * i / 71, 0))]), castle: step([[-433.5, PZ1 - 4], [-434, -72], [-434, -60]]),
    under: step([[-360, -112], [-360, -84], [-360, -40]]) } }));
