import { test } from 'node:test'; import assert from 'node:assert/strict';
import * as R from '../js/island/roomGen.js';
const CAT = ['house', 'wall', 'crate', 'barrel', 'twall', 'twin', 'tdoor', 'swall', 'tfloor', 'troof', 'tpath', 'table', 'bench', 'bed', 'chest', 'counter', 'shelf', 'rack', 'lantern', 'rug', 'cannon', 'gold']
  .map((id) => ({ id, shell: /^(twall|twin|tdoor|swall)$/.test(id) ? 'wall' : id === 'tfloor' ? 'floor' : id === 'troof' ? 'roof' : undefined }));
const T = R.catIndex(CAT), shellOf = (r) => CAT[r.t].shell;
test('line drag lays 2 m wall segments on the grid, turned to the drag axis', () => {
  const L = R.lineOf(CAT, 'twall', { x: 0.3, z: 0 }, { x: 7.9, z: 1 }, 0); assert.equal(L.length, 4); assert.deepEqual(L.map((p) => p.x), [1, 3, 5, 7]); assert.ok(L.every((p) => p.z === 0 && p.ry === 0));
  const V = R.lineOf(CAT, 'tpath', { x: 0, z: 0 }, { x: 0, z: -6 }, 0); assert.equal(V.length, 3); assert.ok(V.every((p) => p.x === 1));
});
test('area drag tiles the rectangle', () => { assert.equal(R.areaOf(CAT, 'tfloor', { x: 0, z: 0 }, { x: 6, z: 4 }, 0).length, 6); });
test('tavern preset: closed shell with one doorway, floor + roof, furniture inside', () => {
  const { rect, pieces } = R.room(CAT, 'tavern', { x: 0, z: 0 }, { x: 10, z: 8 }, 1);
  const walls = pieces.filter((p) => shellOf(p) === 'wall'); assert.equal(walls.length, 2 * (5 + 4)); assert.equal(walls.filter((p) => p.t === T.tdoor).length, 1);
  assert.equal(pieces.filter((p) => p.t === T.tfloor).length, 20); assert.equal(pieces.filter((p) => p.t === T.troof).length, 20);
  const fur = pieces.filter((p) => !shellOf(p)); assert.ok(fur.length >= 6); for (const f of fur) assert.ok(f.x > rect.x0 && f.x < rect.x1 && f.z > rect.z0 && f.z < rect.z1);
});
test('describe a room: words pick preset, size, walls and extras', () => {
  const d = R.describe('small rum cellar with barrels and a lantern'); assert.equal(d.preset, 'store'); assert.equal(d.w, 6); assert.ok(d.extra.some((e) => e[0] === 'barrel')); assert.ok(d.extra.some((e) => e[0] === 'lantern'));
  assert.equal(R.describe('big stone vault 12x10 with gold').wall, 'swall'); const r = R.describedRoom(CAT, 'cozy captain cabin, no roof', { x: 0, z: 0 }, 0); assert.equal(r.preset, 'cabin'); assert.equal(r.pieces.filter((p) => p.t === T.troof).length, 0);
});
test('grow: drag the east wall out 2 tiles and back in', () => {
  const { pieces } = R.room(CAT, 'shop', { x: 0, z: 0 }, { x: 6, z: 6 }, 0); const P = pieces.map((p, i) => ['+p' + i, p]);
  const east = P.find(([, p]) => shellOf(p) === 'wall' && p.x === 6)[1]; const at = R.roomAt(CAT, P, east); assert.deepEqual(at, { rect: { x0: 0, x1: 6, z0: 0, z1: 6 }, side: 'x1' });
  const g = R.growRoom(CAT, P, at.rect, at.side, 2); assert.equal(g.rect.x1, 10); assert.ok(g.move.every(([, m]) => shellOf(m) !== 'wall' || m.x === 10));
  assert.equal(g.add.filter((p) => p.t === T.tfloor).length, 6); assert.equal(g.add.filter((p) => shellOf(p) === 'wall').length, 4);
  const s = R.growRoom(CAT, P, at.rect, at.side, -1); assert.equal(s.rect.x1, 4); assert.equal(s.del.filter((id) => shellOf(P.find((q) => q[0] === id)[1]) === 'floor').length, 3);
  assert.equal(R.growRoom(CAT, P, at.rect, at.side, -2), null);
});
test('server copy of roomGen matches the client module', async () => { const fs = await import('node:fs'); const a = fs.readFileSync(new URL('../js/island/roomGen.js', import.meta.url), 'utf8'), b = fs.readFileSync(new URL('../supabase/functions/pvp/roomGen.ts', import.meta.url), 'utf8'); assert.ok(b.endsWith(a)); });
