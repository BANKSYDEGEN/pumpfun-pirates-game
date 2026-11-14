// [scale-scorefeed] BANKSY t2506u: leftover shared-read cache for Storm Hunt + KOTH boards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test('scorefeed is a cacheable GET (ETag, gzip, max-age 30) with isolate memo; JWT off', () => {
  const fn = src('supabase/functions/scorefeed/index.ts');
  assert.match(fn, /export const CLIENT_MAX_AGE = 30/);
  assert.match(fn, /SHARED_MS = 15_000/);
  assert.match(fn, /status: 304/);
  assert.match(fn, /Content-Encoding": "gzip"/);
  assert.match(fn, /pvp_kills_top/);
  assert.match(fn, /leaderboard_best/);
  assert.match(fn, /leaderboard_daily/);
  assert.match(fn, /req\.method !== "GET"/);
  assert.match(src('supabase/config.toml'), /\[functions\.scorefeed\]\s*\nverify_jwt = false/);
});

test('clients read scorefeed first and fail open to PostgREST / pvp top; submit busts the memo', () => {
  const cfg = src('js/config.js');
  assert.match(cfg, /export const SCOREFEED_URL = SUPABASE_URL \? `\$\{SUPABASE_URL\}\/functions\/v1\/scorefeed`/);
  const save = src('js/pvpSave.js');
  assert.match(save, /export async function fetchScorefeed/);
  assert.match(save, /r\.status === 404 \|\| r\.status === 400/);
  assert.match(save, /f\?\.koth\?\.\[period\]/);
  assert.match(save, /api\('top', \{ period \}\)/);
  assert.match(save, /clearKillsTopCache = \(\) => \{ topCache\.clear\(\); scorefeedMemo = null; \}/);
  const lb = src('js/leaderboard.js');
  assert.match(lb, /fetchScorefeed, clearScorefeedCache/);
  assert.match(lb, /f\?\.waves\?\.\[period\]/);
  assert.match(lb, /f\?\.daily\?\.seed === seed/);
  assert.match(lb, /\/rest\/v1\/\$\{LEADERBOARD_VIEW\}/);
  assert.ok((lb.match(/clearScorefeedCache\(\)/g) || []).length >= 3);
  assert.match(src('sw.js'), /const VERSION = 'pfp-v\d+'/);
});
