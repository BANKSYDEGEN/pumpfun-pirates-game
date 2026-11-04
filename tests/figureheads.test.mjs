// [figureheads 2] the carved shop figureheads (GLB per LOD, under the old procedural tris), seated on the measured bow, the red flag redrawn
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
const glb = (f) => { const b = readFileSync(f), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()); };
test('figureheads: hi + lo GLBs, one mesh per id, phone LOD light', () => {
  for (const [lod, cap] of [['hi', 5000], ['lo', 1500]]) {
    const j = glb(`assets/ships/gear/figureheads_${lod}.glb`), names = j.nodes.map((n) => n.name).sort();
    assert.deepEqual(names, ['fig_kraken', 'fig_lion', 'fig_mermaid']);
    for (const m of j.meshes) { const t = m.primitives.reduce((s, p) => s + j.accessors[p.indices].count / 3, 0); assert.ok(t > 500 && t <= cap, `${lod} ${m.name}: ${t}`); }
  }
});
test('figureheads: loaded with the kit, seated on the real bow, precached; ids / prices / boosts unchanged', () => {
  const g = readFileSync('js/shipGear.js', 'utf8'), main = readFileSync('js/main.js', 'utf8'), isl = readFileSync('js/island/main.js', 'utf8'), sw = readFileSync('sw.js', 'utf8');
  assert.match(g, /export function figuresReady\(lo\)/); assert.match(g, /export function seatFigure\(body, m, u\)/); assert.match(g, /function stemProfile\(/);
  assert.match(g, /export const SHIP_FIGURES = \['fig_mermaid', 'fig_kraken', 'fig_lion'\]/); assert.match(g, /function figGeoOld\(id\)/);   // offline fallback kept
  assert.match(main, /figuresReady\(quality === 'low' \|\| isMobile\)/); assert.match(isl, /await figuresReady\(LOW\)/);
  assert.match(sw, /"\.\/assets\/ships\/gear\/figureheads_hi\.glb"/); assert.match(sw, /"\.\/assets\/ships\/gear\/figureheads_lo\.glb"/);
  const b = readFileSync('js/boosts.js', 'utf8'); assert.match(b, /'figure:fig_mermaid': \{ dmg: 0\.02 \}, 'figure:fig_kraken': \{ dmg: 0\.03 \}, 'figure:fig_lion': \{ dmg: 0\.04 \}/); assert.match(b, /'flag:flag_red': \{ reload: 0\.02 \}/);
  const c = readFileSync('js/shopCatalog.js', 'utf8'); assert.match(c, /id: 'flag_red', label: 'BLOOD RED FLAG', price: 2500/); assert.match(c, /id: 'fig_lion', label: 'GOLDEN LION FIGUREHEAD', price: 15000/);
  assert.match(g, /if \(id === 'flag_red'\) \{ c\.width = 512; c\.height = 340; drawRed\(/);
});
