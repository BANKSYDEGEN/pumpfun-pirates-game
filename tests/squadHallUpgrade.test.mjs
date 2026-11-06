// [Timothy v312] BANKSY pt381u "Upgrade the squad hall ... Make it wider, enhance inside and outside": the Blender guildhall on R0.
// node --test --import ./tools/roundabout_blender/node/reg.mjs tests/squadHallUpgrade.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
const run = (env) => JSON.parse(execFileSync('node', ['--import', './reg.mjs', 'squad_check.mjs'], { cwd: new URL('../tools/roundabout_blender/node/', import.meta.url), env: { ...process.env, QS: '?coast=1', ...env }, encoding: 'utf8' }).trim().split('\n').pop());
const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const D = run({}), LO = run({ LOW: '1' }), RENT = run({ QS: '?coast=1&colirent=1' });
test('wider footprint on the building line, alley to R1, clear of the coliseum, no overlap with any shop', () => {
  const h = D.json; assert.ok(h.w >= 23.5, `w ${h.w}`); assert.ok(h.d >= 14 && h.d <= 15); assert.equal(h.rect.lx0, 14); assert.equal(h.storeys, 3);
  assert.ok(h.rect.lx1 <= 34 - 5, 'rear 5 m short of the coliseum shell'); assert.deepEqual(D.overlaps, []);
  const J = JSON.parse(src('assets/island/hill_shops.json')), r1 = [...J.RENTABLE_SHOPS, ...J.MAIN_ST_SHOPS].find(s => s.lot === 'R1' || (s.lots && s.lots.includes('R1'))); assert.ok(r1.interior.lz1 + 0.5 < h.rect.lz0, 'alley to R1');
});
test('both GLBs load as the squad kind with LOD0 + LOD1 and colliders; buildHill places the hall (desktop LOD, phone 2-draw merge)', () => {
  assert.equal(D.kind, 'squad'); assert.equal(D.lods, 2); assert.ok(D.colliders >= 15);
  assert.equal(LO.kind, 'squad'); assert.equal(LO.lods, 1);
  assert.equal(D.built.hall, true); assert.equal(D.built.door, true); assert.equal(LO.built.merged, 2);
  assert.ok(statSync(new URL('../assets/island/hill_big_shop_low.glb', import.meta.url)).size < 260e3);
});
test('walk from the street (lx 8) through the arch to the E · SQUAD HALL point and round the war table: no collider, smooth floor on the street grade', () => {
  for (const R of [D, LO]) { assert.deepEqual(R.approach.hits, []); assert.deepEqual(R.ring.hits, []); assert.ok(R.ring.maxStep < 0.05); assert.ok(R.approach.maxErr < 0.03 && R.ring.maxErr < 0.03); }
  assert.ok(D.lane >= 2.8, `lane ${D.lane}`); assert.ok(D.wallSolid.every(Boolean), 'walls still solid');
});
test('&colirent=1: the hall is never cloned onto a coliseum store; the store over the hall is skipped', () => {
  assert.equal(RENT.kind, 'squad'); assert.deepEqual(RENT.approach.hits, []);
  assert.match(src('js/island/hillStreet.js'), /L\.kind === 'squad'\) return false/); assert.match(src('js/island/coliseum.js'), /o\.squadOverlap/);
});
test('wiring: foot.js map + interact from SQUAD_HALL, primitive furniture gone; generator builds the hall', () => {
  const f = src('js/island/foot.js'); assert.match(f, /PV\.squadHall/); assert.match(f, /SQH\.interact/); assert.doesNotMatch(f, /PURP = 0x6a4fb3/);
  const b = src('tools/hill_blender/hill_street_blender.py'); for (const k of ['def squad_hall', 'war table', 'armory', 'roster', 'cupola', 'SQUAD HALL']) assert.ok(b.toLowerCase().includes(k.toLowerCase()), k);
  assert.match(src('sw.js'), /pfp-v3(1[7-9]|[2-9]\d)/);
});
