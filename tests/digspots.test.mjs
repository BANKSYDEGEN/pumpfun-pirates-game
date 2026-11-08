// node --test tests/   [island-rework] static checks of the shared dig-spot registry (js/island/digSpots.js). The in-game half (terrain,
// props, reachability, client X == server spot) is tools/check_digspots.py.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const R = await import('../js/island/digSpots.js');
const EVER = JSON.parse(readFileSync(new URL('./digspots.ever.json', import.meta.url), 'utf8'));
const S = R.DIG_SPOTS, inR = (x, z, r, p = 0) => x >= r[0] - p && x <= r[1] + p && z >= r[2] - p && z <= r[3] + p;
const dRect = (x, z, r) => Math.hypot(Math.max(r[0] - x, 0, x - r[1]), Math.max(r[2] - z, 0, z - r[3]));

test('ids are unique, valid for pvp_maps.spot, numbered digs match their id', () => {
  assert.equal(new Set(S.map(s => s.id)).size, S.length);
  for (const s of S) { assert.match(s.id, /^[a-z0-9_]{2,16}$/); if (s.id !== 'cave') assert.equal(s.id, 'dig' + s.n); assert.ok(Number.isFinite(s.x) && Number.isFinite(s.z), s.id); }
});
test('append-only: every shipped id stays valid, the roll order is an unchanged prefix', () => {
  const roll = R.rollIds(), valid = R.validIds();
  assert.deepEqual(roll.slice(0, EVER.roll.length), EVER.roll, 'MAP_SPOTS reordered or shrunk');
  for (const id of EVER.valid) assert.ok(valid.includes(id), id + ' dropped from MAP_SPOTS_ALL');
  assert.equal(valid[valid.length - 1], 'cave'); assert.ok(!roll.includes('cave'));
});
test("today's X positions do not move (v148 coords)", () => {
  const MOVED = { dig6: [-626, -258] };   // [post-village v3] BANKSY moved the town-shore X off the plaza extension (registry rule: keep the id, change x / z)
  for (const [id, [x, z]] of Object.entries(EVER.coords_v148)) { const s = R.spotById(id); assert.ok(s, id); assert.deepEqual([s.x, s.z], MOVED[id] || [x, z], id + ' moved'); }
});
test('new island spots are registered but OFF (not rolled, not diggable)', () => {
  for (const s of S) if (!EVER.valid.includes(s.id)) { assert.equal(s.active, false, s.id); assert.equal(s.roll, false, s.id); }
});
test('server lists are generated from the registry and up to date', () => {
  execFileSync(process.execPath, [new URL('../tools/gen_digspots.mjs', import.meta.url).pathname, '--check']);
  const ts = readFileSync(new URL('../supabase/functions/pvp/digSpots.ts', import.meta.url), 'utf8');
  const arr = (n) => JSON.parse(ts.match(new RegExp(`export const ${n}: string\\[\\] = (\\[.*?\\]);`))[1]);
  assert.deepEqual(arr('MAP_SPOTS'), R.rollIds()); assert.deepEqual(arr('MAP_SPOTS_ALL'), R.validIds());
  assert.deepEqual(arr('MAP_SPOTS'), EVER.roll, 'server behaviour for existing spots changed'); assert.deepEqual(arr('MAP_SPOTS_ALL'), EVER.valid);
  assert.match(readFileSync(new URL('../supabase/functions/pvp/lib.ts', import.meta.url), 'utf8'), /export \{ MAP_SPOTS, MAP_SPOTS_ALL \} from "\.\/digSpots\.ts"/);
});
test('no spot inside / within the pad of another owner\'s zone (except the ones that already live there, kept with a clear ring)', () => {
  for (const s of S) for (const e of R.EXCLUDE) {
    if (s.inside === e.id) { assert.ok(s.clear >= 6, s.id + ' needs a clear ring'); continue; }
    const d = e.rect ? dRect(s.x, s.z, e.rect) : Math.hypot(s.x - e.circle[0], s.z - e.circle[1]) - e.circle[2];
    if (s.id === 'cave' && e.id === 'cave_mouth') continue;
    assert.ok(d >= R.EXCLUDE_PAD, `${s.id} is ${d.toFixed(1)} m from ${e.id}`);
  }
});
test('spots are >= 40 m apart', () => {
  for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) assert.ok(Math.hypot(S[i].x - S[j].x, S[i].z - S[j].z) >= 40, S[i].id + ' / ' + S[j].id);
});
test('rework areas: props keep >= 6 m (or the spot\'s ring) from every dig spot and stay inside their area; no area touches an exclusion zone', () => {
  for (const a of R.AREAS) {
    for (const p of a.props || []) { assert.ok(inR(p.rect[0], p.rect[2], a.rect) && inR(p.rect[1], p.rect[3], a.rect), p.id + ' outside ' + a.id);
      for (const s of S) assert.ok(dRect(s.x, s.z, p.rect) >= Math.max(6, s.clear || 0), `${p.id} within ${dRect(s.x, s.z, p.rect).toFixed(1)} m of ${s.id}`); }
    if (a.rect) for (const e of R.EXCLUDE) { if (!e.rect || (e.allow || []).includes(a.id)) continue; const r = a.rect, q = e.rect, gap = Math.hypot(Math.max(q[0] - r[1], 0, r[0] - q[1]), Math.max(q[2] - r[3], 0, r[2] - q[3]));
      assert.ok(gap >= R.EXCLUDE_PAD, `${a.id} is ${gap.toFixed(1)} m from ${e.id}`); }
  }
});
test('jungle trailhead (locked for Timothy): frames agree, inside its area, clear of zones + dig spots', () => {
  const T = R.JUNGLE_TRAILHEAD, a = R.AREAS.find(a => a.id === 'jungle_ruins');
  assert.equal(T.lx, +(T.z + 90).toFixed(1)); assert.equal(T.lz, +(-640 - T.x).toFixed(1)); assert.ok(inR(T.x, T.z, a.rect), 'inside jungle_ruins');
  assert.ok(T.x - a.rect[0] < 12, 'on the plaza-side (west) edge'); assert.ok(Math.abs(Math.hypot(T.heading.dx, T.heading.dz) - 1) < 0.01);
  for (const e of R.EXCLUDE) { const d = e.rect ? dRect(T.x, T.z, e.rect) : Math.hypot(T.x - e.circle[0], T.z - e.circle[1]) - e.circle[2]; assert.ok(d >= R.EXCLUDE_PAD, e.id); }
  for (const s of S) assert.ok(Math.hypot(s.x - T.x, s.z - T.z) >= 40, s.id);
});
