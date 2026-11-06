// [v330] BANKSY t1746u / t1751u "Optimized load time and graphics and speed first" + t1752u-t1754u Storm Hunt fixes.
// node --test --import ./tests/helpers/threeRegister.mjs tests/perfAndLoadV330.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as THREE from 'three';
import { lists, staticGraph, renderHtmlBlock, renderListModule } from '../tools/perf/gen_preload.mjs';
import { mergeInto } from '../js/staticMerge.js';
import { HARBOR_MODULES } from '../js/preloadList.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const exists = (p) => existsSync(new URL('../' + p.replace(/^\.\//, ''), import.meta.url));
const SW = read('sw.js'), HTML = read('index.html'), MAIN = read('js/main.js'), DOCK = read('js/dock/index.js');
const swList = (name) => { const body = SW.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\n\\];'))[1].split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
  return [...body.matchAll(/"([^"]+)"/g)].map(m => m[1]); };

test('sw.js is pfp-v331 or later', () => { assert.ok(+(SW.match(/const VERSION = 'pfp-v(\d+)'/) || [])[1] >= 331); });
test('sw.js SHELL: every URL exists (cache.addAll never fails the install) + no duplicates + the generated preload list', () => {
  const shell = swList('SHELL'); assert.ok(shell.length > 100);
  const missing = shell.filter(u => u !== './' && !exists(u)); assert.deepEqual(missing, []);
  assert.equal(new Set(shell).size, shell.length, 'duplicate SHELL entries');
  assert.ok(shell.includes('./js/preloadList.js'));
});
test('sw.js ASSETS exist and the background art fill is low priority + skips Save-Data phones', () => {
  assert.deepEqual(swList('ASSETS').filter(u => !exists(u)), []);
  assert.match(SW, /priority: 'low'/); assert.match(SW, /saveData/);
});
test('index.html: the whole boot module graph is modulepreloaded (fresh), after the import map, every href exists', () => {
  const { boot } = lists();
  assert.ok(HTML.includes(renderHtmlBlock(boot.filter(f => f !== 'js/main.js'))), 'stale: node tools/perf/gen_preload.mjs');
  const im = HTML.indexOf('<script type="importmap">'), firstPre = HTML.indexOf('rel="modulepreload"'); assert.ok(im > 0 && firstPre > im, 'modulepreload must follow the import map');
  const hrefs = [...HTML.matchAll(/<link rel="modulepreload" href="\.\/([^"]+)"/g)].map(m => m[1]);
  assert.ok(hrefs.length >= 90, 'boot graph preloaded: ' + hrefs.length);
  assert.deepEqual(hrefs.filter(h => !exists(h)), []);
  assert.ok(hrefs.includes('vendor/three-0.165.0/build/three.module.min.js') && hrefs.includes('js/main.js'));
});
test('js/preloadList.js HARBOR_MODULES is fresh, exists, and excludes boot modules', () => {
  const { boot, harbor } = lists();
  assert.equal(read('js/preloadList.js'), renderListModule(harbor));
  assert.deepEqual(HARBOR_MODULES, harbor); assert.ok(harbor.includes('js/dock/index.js') && harbor.includes('js/pvp.js'));
  const b = new Set(boot); assert.equal(HARBOR_MODULES.filter(m => b.has(m)).length, 0);
  assert.deepEqual(HARBOR_MODULES.filter(m => !exists(m)), []);
});
test('zero broken static imports across the boot + harbor graphs', () => {
  const all = staticGraph(['js/main.js', 'js/pvp.js', 'js/dock/index.js', 'js/island/foot.js']);
  const bad = [];
  for (const f of all) { if (/\.min\.js$/.test(f) || !exists(f)) continue; const src = read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
    for (const m of src.matchAll(/(?:^|[;\n}])\s*(?:import|export)\s+(?:[\w*{}\s,$]+?\s+from\s+)?['"](\.[^'"]+)['"]/g)) {
      const p = new URL(m[1], new URL('../' + f, import.meta.url)); if (!existsSync(p)) bad.push(f + ' -> ' + m[1]); } }
  assert.deepEqual(bad, []);
});
test('main.js warms the harbor graph + tier art from the idle title (kill switches, Save-Data aware, stops when you leave the title)', () => {
  assert.match(MAIN, /import \{ HARBOR_MODULES \} from '\.\/preloadList\.js'/);
  assert.match(MAIN, /for \(const m of HARBOR_MODULES\)/); assert.match(MAIN, /prefetch=0/); assert.match(MAIN, /warmart=0/);
  assert.match(MAIN, /saveData/); assert.match(MAIN, /game\.state !== 'title' \|\| dock \|\| dockLoading/);
});
test('harbor load: island art + your pirate start downloading in parallel (no serial await chain)', () => {
  const W = read('js/dock/world.js');
  assert.match(W, /const kitP = PAR \? loadTownKit/); assert.match(W, /const natP = PAR && NAT_ON \? loadNatureKit/); assert.match(W, /const shopsP = PAR/); assert.match(W, /parworld=0/);
  assert.ok(W.indexOf('const kitP') < W.indexOf('const skull = await skullP'), 'kits start before the first await');
  const TK = read('js/island/townkit.js'); assert.match(TK, /_kitP = loadTownKit0/); assert.match(TK, /_natP = loadNatureKit0/);
  assert.ok(DOCK.indexOf('const pirate0 = loadPirate') < DOCK.indexOf('const layout = await coastLayout()'), 'pirate GLB starts before the island build');
  assert.ok(DOCK.indexOf('loadTownKit(LOW, renderer)') < DOCK.indexOf('const layout = await coastLayout()'));
});
test('graphics: phone anisotropy 2 -> 4 on the town kit + material library, renderer default anisotropy kept', () => {
  assert.match(read('js/island/townkit.js'), /map\.anisotropy = low \? 4 : 8/); assert.match(read('js/island/townkit.js'), /cards\.anisotropy = low \? 4 : 8/);
  assert.match(read('js/island/libTex.js'), /t\.anisotropy = low \? 4 : 8/);
  assert.match(MAIN, /THREE\.Texture\.DEFAULT_ANISOTROPY = Math\.min\(renderer\.capabilities\.getMaxAnisotropy\(\) \|\| 1, isMobile \|\| quality === 'low' \? 4 : 8\)/);
});
test('lights stay culled: cottage interiors (4 PointLights) are only built on entering, island torches share a 6-light pool (High only)', () => {
  const H = read('js/dock/houses.js'); assert.match(H, /interior = buildInteriorRoom\(\{ tier, cottageId: d\.id, low \}\)/);
  assert.equal((H.match(/new THREE\.PointLight/g) || []).length, 4);
  assert.match(read('js/island/foot.js'), /if \(!low\) for \(let i = 0; i < 6; i\+\+\) \{ const l = new THREE\.PointLight/);
});
test('mergeInto ignoreGroups merges single-material Box / Cylinder parts (zipline stations); default keeps grouped geometry separate', () => {
  const mat = new THREE.MeshBasicMaterial(), mk = () => { const h = new THREE.Group(); for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); m.position.x = i; h.add(m); } for (let i = 0; i < 3; i++) h.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 6), mat)); return h; };
  const a = mk(); assert.equal(mergeInto(a, [...a.children]), 0); assert.equal(a.children.length, 8);
  const b = mk(); assert.equal(mergeInto(b, [...b.children], () => '', { ignoreGroups: true }), 7); assert.equal(b.children.length, 1);
  for (const c of b.children) assert.equal(c.geometry.groups.length, 0);
  assert.match(read('js/opt.js'), /mergeInto\(host, list, \(\) => '', \{ ignoreGroups: true \}\)/);
});
test('frame(): reused camera / hull scratch (no per-frame Vector3 or array spread)', () => {
  assert.match(MAIN, /const _camTgt = new THREE\.Vector3\(\), _camD = new THREE\.Vector3\(\), _UP = new THREE\.Vector3\(0, 1, 0\), _hullList = \[\]/);
  assert.doesNotMatch(MAIN, /for \(const s of \[player, \.\.\.list\]\)/); assert.doesNotMatch(MAIN, /const tgt = new THREE\.Vector3\(player\.x/);
});
// ---------- t1752u / t1753u / t1754u Storm Hunt ----------
test('t1752u: #waves-entry is a top-level fixed overlay (never inside #title, which is hidden in-game)', () => {
  const title = HTML.indexOf('<div id="title" class="overlay">'), we = HTML.indexOf('<div id="waves-entry"'); assert.ok(title > 0 && we > title);
  let depth = 0, end = -1; const re = /<div\b|<\/div>/g; re.lastIndex = title; let m;
  while ((m = re.exec(HTML))) { depth += m[0] === '</div>' ? -1 : 1; if (!depth) { end = m.index; break; } }
  assert.ok(we > end, '#waves-entry must come after #title closes');
  const css = read('css/style.css'); assert.match(css, /#waves-entry \{ position: fixed; inset: 0;[^}]*z-index: 45;/);
});
test('t1752u/t1753u: Storm Hunt from inside the game starts straight away, steps aboard, and switches the dock world off', () => {
  assert.match(MAIN, /const inGame = game\.mode === 'pvp' && game\.state !== 'title', nm = getSavedName\(\) \|\| \(pvp && pvp\.name\)/);
  assert.match(MAIN, /if \(dock\?\.onFoot\) dock\.goAboard\?\.\(true\)/);
  assert.match(MAIN, /const leftPvp = game\.mode === 'pvp' && mode !== 'pvp';/); assert.match(MAIN, /if \(leftPvp\) pvp\?\.leave\(\);/);
  assert.match(MAIN, /if \(leftPvp && dock\) \{ try \{ dock\.ship\(0\); \}/);
  assert.match(MAIN, /resetShop\(\);/); assert.match(read('js/pvp.js'), /window\.PFP_OPEN_WAVES\?\.\(\)/);
  assert.match(DOCK, /startWaves: \(\) => \{ goAboard\(true\); ctx\.openWaves\(\); \}/);
});
test('t1753u: Storm Hunt pays a flat 100 gold per wave (server), run gold is never banked, RETURN TO HARBOR waits for the payout', () => {
  const lib = read('supabase/functions/pvp/lib.ts'), idx = read('supabase/functions/pvp/index.ts');
  const src = lib.match(/export const WAVES_GOLD = (\{[^}]+\});\s*\nexport const wavesGold = \(wave: number\) => ([^;]+);/);
  assert.ok(src, 'wavesGold(wave) form'); const WAVES_GOLD = eval('(' + src[1] + ')'); const wavesGold = eval('(wave) => ' + src[2]);
  assert.equal(WAVES_GOLD.perWave, 100); assert.equal(WAVES_GOLD.minRunS, 5);
  assert.equal(wavesGold(0), 0); assert.equal(wavesGold(1), 100); assert.equal(wavesGold(7), 700); assert.equal(wavesGold(7.9), 700); assert.equal(wavesGold(-3), 0); assert.equal(wavesGold(9999), WAVES_GOLD.cap);
  assert.match(idx, /const base = wavesGold\(wave\)/); assert.doesNotMatch(idx, /wavesGold\(score\)/);
  assert.match(MAIN, /wavesClaim\(\{ run: game\.runId, score: game\.score, wave: w, sunk: game\.sunk \}\)/);
  assert.match(MAIN, /await wavesBank\(\); \/\/ the 100 \/ wave payout lands in your save BEFORE the Harbor profile is loaded/);
  assert.match(MAIN, /await startPvp\(false\);/); assert.match(MAIN, /'⚓ RETURN TO HARBOR'/);
  assert.doesNotMatch(MAIN, /profile\.gold \+= game\.gold/);
});
test('t1754u: the old open sea in Storm Hunt + Arena: scene-level island pieces follow the harbor world', () => {
  assert.match(DOCK, /const EXTRA_RE = \/\^\(zipline\|battle_areas\|house_plaques\|house_fallback_exteriors\)\$\//);
  assert.match(DOCK, /harborExtras\(v \|\| viewing\); \/\/ \[v330\] t1754u/); assert.match(DOCK, /harborExtras\(view \|\| on\);/);
  assert.match(DOCK, /setZone\(v \|\| viewing\);/); // islands.setHarbor(null) off the harbor = the classic rocky open sea
  assert.match(read('js/dock/zipline.js'), /g\.name = 'zipline'/); assert.match(read('js/onfoot/battle.js'), /root\.name = 'battle_areas'/);
});
