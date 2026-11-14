// [scale-free] BANKSY "Just do everything else free": cut the free-plan quotas that bind first
// (edge invocations, then egress, then Realtime) with no paid upgrade and no visual change.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createPulse, resetPulse, setPulse,
  PULSE_MS, PULSE_OPEN_MS,
  EDGE_RPM_BEFORE, EDGE_RPM_AFTER, EDGE_RPM_BEFORE_HQ, EDGE_RPM_AFTER_HQ,
} from '../js/pulse.js';
import { WALK_XP_S } from '../js/pollScale.js';
import { SHARED_MS } from '../js/pumpfun/market.js';

const src = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

test.afterEach(() => { resetPulse(); });

test('pulse constants: 30 s background, 8 s while a panel is open; walks stay 60 s', () => {
  assert.equal(PULSE_MS, 30000);
  assert.equal(PULSE_OPEN_MS, 8000);
  assert.equal(WALK_XP_S, 60);
  assert.equal(EDGE_RPM_BEFORE, 11);
  assert.equal(EDGE_RPM_AFTER, 2);
  assert.equal(EDGE_RPM_BEFORE_HQ, 13);
  assert.equal(EDGE_RPM_AFTER_HQ, 3);
  assert.ok(EDGE_RPM_AFTER < EDGE_RPM_BEFORE);
  assert.ok(EDGE_RPM_AFTER_HQ < EDGE_RPM_BEFORE_HQ);
});

test('headless local run: edge req/min/player before vs after (visible harbor, near HQ, hidden tab)', async () => {
  // Steady-state rates (60 / interval_s), same method as tests/scalePolling.test.mjs.
  const before = { squadInvites: 60 / 15, frList: 60 / 30, adminBeat: 60 / 30, walkXp: 3, boardfeed: 0 };
  const after = { pulse: 60 / (PULSE_MS / 1000), boardfeed: 0 };
  const beforeHq = { ...before, boardfeed: 60 / 30 };
  const afterHq = { pulse: 60 / (PULSE_MS / 1000), boardfeed: 60 / (SHARED_MS / 1000) };
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(sum(before), EDGE_RPM_BEFORE);
  assert.equal(sum(after), EDGE_RPM_AFTER);
  assert.equal(sum(beforeHq), EDGE_RPM_BEFORE_HQ);
  assert.equal(sum(afterHq), EDGE_RPM_AFTER_HQ);

  let calls = 0, walkPulses = 0;
  const pulse = createPulse({
    call: async (action, body) => { calls++; if (body?.walks?.length) walkPulses++; return { ok: true, fr: { ok: true, friends: [] }, invites: { ok: true, invites: [] }, admin: { ok: true }, walks: {} }; },
    now: () => t,
    hidden: () => hidden,
  });
  pulse.setPart('friends', () => ({ at: { w: 'harbor', copy: 1 } }));
  pulse.setPart('admin', () => ({ net_id: 'net-test' }));
  pulse.setWalks('pet', () => [{ action: 'pet_walk', pet: 'pet_cat' }]);
  pulse.setWalks('parrot', () => [{ action: 'parrot_walk' }]);
  pulse.setWalks('pilly', () => [{ action: 'pilly_walk' }]);

  let t = 0, hidden = false;
  for (t = 0; t <= 60000; t += 1000) await pulse.tick(t);
  assert.equal(calls, 3, '60 s window: pulses at 0, 30, 60');
  assert.equal(walkPulses, 1, 'walks ride the 60 s pulse only, not the 0 / 30 s pulses');

  calls = 0; walkPulses = 0; hidden = true;
  const hiddenPulse = createPulse({ call: async () => { calls++; return { ok: true }; }, now: () => t, hidden: () => hidden });
  for (t = 0; t <= 60000; t += 1000) await hiddenPulse.tick(t);
  assert.equal(calls, 0, 'hidden tab is silent');

  calls = 0;
  const openPulse = createPulse({ call: async () => { calls++; return { ok: true }; }, now: () => t, hidden: () => false });
  openPulse.setOpen('friends', () => true);
  for (t = 0; t <= 60000; t += 1000) await openPulse.tick(t);
  assert.equal(calls, 8, '60 s window while a panel is open: 0 plus every 8 s');
});

test('createPulse coalesces one edge call and includes walks only when due', async () => {
  const seen = [];
  const pulse = createPulse({
    call: async (action, body) => { seen.push({ action, body }); return { ok: true, fr: { ok: true }, invites: { ok: true, invites: [] }, walks: body?.walks?.length ? { pet_walk: { ok: true, lv: 1, xp: 10 } } : {} }; },
    now: () => t,
    hidden: () => false,
  });
  const walks = [];
  pulse.setPart('friends', () => ({ at: { w: 'solo' }, name: 'TEST' }));
  pulse.setWalks('pet', () => [{ action: 'pet_walk', pet: 'pet_cat' }]);
  pulse.onWalk('pet_walk', (r) => walks.push(r));
  let t = 0;
  await pulse.tick(0);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].action, 'pulse');
  assert.equal(seen[0].body.at.w, 'solo');
  assert.ok(!seen[0].body.walks);
  t = 30000; await pulse.tick(t);
  assert.equal(seen.length, 2);
  assert.ok(!seen[1].body.walks);
  t = 60000; await pulse.tick(t);
  assert.equal(seen.length, 3);
  assert.deepEqual(seen[2].body.walks, [{ action: 'pet_walk', pet: 'pet_cat' }]);
  assert.equal(walks.length, 1);
  assert.equal(walks[0].lv, 1);
});

test('wiring: client + edge batch pulse; boardfeed max-age 75 / 60 s poll; assets not from Supabase; Realtime already batched', () => {
  const pul = src('js/pulse.js');
  assert.match(pul, /export const PULSE_MS = 30000;/);
  assert.match(src('js/pvpSave.js'), /'pulse'/);
  assert.match(src('js/pvp.js'), /ensurePulse\(\{ call: \(a, b\) => invApi\(a, b\) \}\)/);
  assert.match(src('js/friends.js'), /getPulse\(\)/);
  assert.match(src('js/dock/squadHall.js'), /getPulse\(\)/);
  assert.match(src('js/adminMenu.js'), /pulse\.tick\(now\)/);
  assert.match(src('js/petsPanel.js'), /setWalks\('pet'/);
  assert.match(src('js/parrotsPanel.js'), /setWalks\('parrot'/);
  assert.match(src('js/onfoot/pilly.js'), /setWalks\('pilly'/);
  assert.match(src('js/dock/index.js'), /getPulse\(\)\?\.tick/);
  assert.match(src('sw.js'), /"\.\/js\/pulse\.js"/);
  assert.match(src('js/preloadList.js'), /js\/pulse\.js/);

  const idx = src('supabase/functions/pvp/index.ts');
  assert.match(idx, /pulseAction/);
  assert.match(idx, /String\(b\.action\) === "pulse"/);
  const edge = src('supabase/functions/pvp/pulse.ts');
  assert.match(edge, /friendAction\(c, "fr_list"/);
  assert.match(edge, /squadAction\(/);
  assert.match(edge, /adminAction\(c, "admin_register_net"/);
  assert.match(edge, /petAction\(/);

  const m = src('js/pumpfun/market.js');
  assert.match(m, /export const SHARED_MS = 60000;/);
  assert.match(m, /If-None-Match/);
  assert.match(m, /cache:'default'/);
  const bf = src('supabase/functions/boardfeed/index.ts');
  assert.match(bf, /export const CLIENT_MAX_AGE=75;/);
  assert.match(bf, /max-age=\$\{CLIENT_MAX_AGE\}/);
  assert.match(bf, /content-encoding.*gzip|gzip.*content-encoding|Content-Encoding.: .gzip/i);
  assert.doesNotMatch(bf, /stale-while-revalidate/);

  // Static art stays on GitHub Pages; no Supabase Storage URLs in the client.
  for (const f of ['js/main.js', 'js/pvp.js', 'js/dock/index.js', 'index.html']) {
    assert.doesNotMatch(src(f), /supabase\.co\/storage/);
  }

  // Realtime already one message / tick with idle keepalive; harbor 1 Hz. No visual-rate change in this round.
  const tr = src('js/transport.js');
  assert.match(tr, /Batcher/);
  const cfg = src('js/config.js');
  assert.match(cfg, /HARBOR_NET/);
});
