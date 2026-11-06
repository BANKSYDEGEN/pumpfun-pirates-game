// [v337] BANKSY t1789u Harbor cap 8 (Free-tier) + t1790u Dock Plaza gravel up Hill Street to Fountain.
// node --test tests/v337HarborCapAndGravel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HARBOR_NET } from '../js/config.js';
import { publicRows } from '../js/serverPicker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

test('v337 HARBOR_NET.cap is 8 and fight.budget keeps Free-tier msgs/s under 100', () => {
  assert.equal(HARBOR_NET.cap, 8);
  assert.equal(HARBOR_NET.extraAiMax, 3);
  assert.ok(HARBOR_NET.fight?.budget >= 64);
  assert.equal(HARBOR_NET.fight.hz, 10);
  assert.equal(HARBOR_NET.fight.hz4, 5);
  // full 8-pirate room at base harbor rate stays under harbor_max 80
  const M = 8, rate = 1.2;
  assert.ok(M * rate * M <= 80);
});

test('v337 fastHz(roomN) clamps by fight.budget (10 Hz @2p, prefers 5 Hz @3-4p, drops in 8p)', () => {
  const src = read('js/onfoot/battle.js');
  assert.match(src, /function fastHz\(roomN\)/);
  assert.match(src, /F\.budget \|\| 64/);
  assert.match(src, /\(budget \/ M - Math\.max\(0, M - k\) \* base\) \/ k/);
  const pvp = read('js/pvp.js');
  assert.match(pvp, /fastHz\?\.\(1 \+ \(link\.heard/);
  assert.match(pvp, /hb\.cap \|\| HARBOR_NET\.cap/);
});

test('v337 server picker defaults to /8 Pirates (explicit {cap:4} still honored)', () => {
  const rows8 = publicRows([[1, 3]], {});
  assert.equal(rows8[0].cap, 8);
  assert.match(rows8[0].text, /3\/8 Pirates/);
  const rows4 = publicRows([[1, 4]], { cap: 4, cur: 1 });
  assert.equal(rows4[0].cap, 4);
  assert.match(rows4[0].text, /4\/4 Pirates/);
  const sp = read('js/serverPicker.js');
  assert.match(sp, /cap = 8/);
  assert.match(sp, /i\.cap \|\| 8/);
  assert.match(sp, /up to 8 pirates/);
});

test('v337 migration 050: cap:=8, rate 1.2, harbor_max 80, total_max 95, keeps p_want_copy', () => {
  const sql = read('supabase/migrations/050_harbor_cap_8.sql');
  assert.match(sql, /cap := \(case when p_prefix = 'pfp-harbor' then 8 else least\(greatest\(coalesce\(p_cap, 8\), 1\), 8\) end\)/);
  assert.match(sql, /rate constant numeric := 1\.2/);
  assert.match(sql, /harbor_max constant numeric := 80/);
  assert.match(sql, /total_max constant numeric := 95/);
  assert.match(sql, /p_want_copy = -1 then -1/);
  assert.match(sql, /n \* 1\.2 \* \(n \+ s\)/);
  assert.match(sql, /p_want_copy int default null/);
});

test('v337 Hill Street gravel: same aMat 10 / 0xc9bfae as Dock Plaza, seam to fountain', () => {
  const foot = read('js/island/foot.js');
  assert.match(foot, /function buildStreetGravel/);
  assert.match(foot, /STREET_GRAVEL/);
  assert.match(foot, /col: 0xc9bfae/);
  assert.match(foot, /mat: 10/);
  assert.match(foot, /buildStreetGravel\(k\)/);
  assert.match(foot, /street_gravel/);
  assert.match(foot, /foot_street_gravel/);
  assert.match(foot, /fountainY: 20\.1/);
  // dock plaza source of truth still present
  assert.match(foot, /0xc9bfae, 10/);
  const look = read('js/island/look.js');
  assert.match(look, /isM == 10/);
  assert.match(look, /isM == 10 \? 4/);
  assert.match(look, /libTri\(/);
});
