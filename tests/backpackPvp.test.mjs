// node --test tests/backpackPvp.test.mjs
// [backpack-pvp] BANKSY t1703u "Make kd count as sunk ships or ground fights" + t1706u "If I shoot a player my crew shoots their crew".
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createKdTally, kdText, KD_SOURCES } from '../js/kdCounter.js';
import { createCrewFight, crewTargets, crewModeFor, modeCode, modeOfCode, CF, CREW_MODE } from '../js/onfoot/crewFight.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// a tiny HUD that renders on every change (mirrors js/pvp.js hud(): KILLS / DEATHS / K/D)
function pirate() {
  const stats = { kills: 0, deaths: 0 }, hud = { text: '', renders: 0 };
  const kd = createKdTally({ stats: () => stats, onChange: (e) => { hud.renders++; hud.text = `K ${e.kills} · D ${e.deaths} · K/D ${kdText(e.kills, e.deaths)}`; } });
  return { stats, hud, kd };
}

test('t1703u ship sink: killer K+1, victim D+1, HUD updates at once; a resent sink is not counted twice', () => {
  assert.deepEqual([...KD_SOURCES], ['ship', 'ground']);
  const a = pirate(), b = pirate();
  // A sinks B (arena or harbor open water): key = victim id + their ship life
  assert.equal(a.kd.kill('ship', 'B:3'), true); assert.equal(b.kd.death('ship', 'me:3'), true);
  assert.deepEqual([a.stats.kills, a.stats.deaths, b.stats.kills, b.stats.deaths], [1, 0, 0, 1]);
  assert.equal(a.hud.text, 'K 1 · D 0 · K/D 1'); assert.equal(b.hud.text, 'K 0 · D 1 · K/D 0.00');
  assert.equal(a.hud.renders, 1);
  // the same 'sunk' message heard again (resend / two code paths) -> no change, no re-render
  assert.equal(a.kd.kill('ship', 'B:3'), false); assert.equal(b.kd.death('ship', 'me:3'), false);
  assert.deepEqual([a.stats.kills, b.stats.deaths, a.hud.renders], [1, 1, 1]);
  // next life = a new event
  assert.equal(a.kd.kill('ship', 'B:4'), true); assert.equal(a.stats.kills, 2); assert.equal(a.stats.shipKills, 2);
});

test('t1703u ground fight (sword pit / musket range): victor K+1, defeated D+1, no double count, shared with ships', () => {
  const a = pirate(), b = pirate();
  a.kd.kill('ship', 'B:1'); b.kd.death('ship', 'me:1');                // earlier at sea
  assert.equal(a.kd.kill('ground', 'B:7'), true); assert.equal(b.kd.death('ground', 'me:7'), true);
  assert.equal(a.kd.kill('ground', 'B:7'), false); assert.equal(b.kd.death('ground', 'me:7'), false); // the KO echo
  assert.deepEqual([a.stats.kills, a.stats.deaths, b.stats.kills, b.stats.deaths], [2, 0, 0, 2]);
  assert.deepEqual([a.stats.groundKills, a.stats.shipKills, b.stats.groundDeaths, b.stats.shipDeaths], [1, 1, 1, 1]);
  assert.deepEqual(a.kd.extra, { k: 1, d: 0 }, 'ground kills ride on top of the BR board in lifeK');
  assert.equal(a.hud.text, 'K 2 · D 0 · K/D 2');
  assert.equal(a.kd.kill('bogus', 'x'), false); assert.equal(a.kd.record('q', 'ship', 'x'), false);
});

test('t1703u wiring: pvp.js unified tally (HUD + pvpSave), battle.js KO hooks, dock passes kd', () => {
  const pvp = read('js/pvp.js');
  assert.match(pvp, /createKdTally\(\{ stats: \(\) => profile\?\.stats, onChange: .*hud\(\).*save\(/);
  assert.match(pvp, /kdT\.kill\('ship'/); assert.match(pvp, /kdT\.death\('ship'/);
  assert.match(pvp, /function groundKd/);
  assert.match(pvp, /lifeK = \(\) => Math\.max\(profile\.stats\.kills, rk\.kills \+ kdT\.extra\.k\)/);
  assert.doesNotMatch(pvp, /profile\.stats\.kills\+\+|profile\.stats\.deaths\+\+/, 'every K/D goes through the deduped tally');
  const battle = read('js/onfoot/battle.js');
  assert.match(battle, /kd\?\.\('k'/); assert.match(battle, /kd\?\.\('d'/);
  assert.match(read('js/dock/index.js'), /groundKd\?\.\(side, key\)/);
});

// ---------------- t1706u crews ----------------
const P = (x, z) => ({ x, z, yaw: 0, speed: 0, p: { object: { visible: true, rotation: { x: 0 }, userData: {} } } });
function world({ mine = 3, theirs = 2, safe = () => false } = {}) {
  const me = { x: 0, z: 0 }, foe = { x: 20, z: 0 };
  const crews = { me: Array.from({ length: mine }, (_, i) => P(-1.5 - i, 1.5)), foe: Array.from({ length: theirs }, (_, i) => P(21.5 + i, 1.5)) };
  const caps = { me, foe };
  let t = 0;
  const cf = createCrewFight({ crewOf: (id) => crews[id] || [], captainOf: (id) => caps[id] || null, inSafe: safe, now: () => t });
  const run = (sec, dt = 0.05) => { for (let s = 0; s < sec; s += dt) { t += dt; cf.tick(dt, t); } };
  return { cf, crews, caps, run, get t() { return t; } };
}

test('t1706u gun mode: I shoot a pirate -> my crew hold a firing line and volley THEIR crew, never the captain', () => {
  assert.equal(crewModeFor('musket'), 'gun'); assert.equal(crewModeFor('sword'), 'sword');
  assert.deepEqual([modeCode('gun'), modeCode('sword'), modeOfCode(CREW_MODE.gun), modeOfCode(2), modeOfCode(0)], [1, 2, 'gun', 'sword', null]);
  const w = world();
  assert.equal(w.cf.engage('me', 'gun', 'foe', 0), true);
  w.run(4);
  const shots = w.cf.log.filter((e) => e.kind === 'shot' && e.by === 'me');
  assert.ok(shots.length >= 6, 'staggered volleys');
  for (const s of shots) { assert.ok(w.crews.foe.includes(s.victim)); assert.notEqual(s.victim, w.caps.foe); }
  assert.deepEqual([...new Set(shots.map((s) => w.crews.foe.indexOf(s.victim)))].sort(), [0, 1], 'enemyCrew[i % len]');
  for (const c of w.crews.me) assert.ok(Math.hypot(c.x, c.z) <= CF.lineMax + 0.5, 'firing line stays by the captain');
  // first shots are staggered, not one simultaneous bang
  const firstT = w.crews.me.map((_, i) => shots.find((s) => s.i === i)?.t);
  assert.ok(new Set(firstT.map((x) => x.toFixed(2))).size === 3);
  assert.deepEqual(w.cf.wire('me'), { cm: 1, ct: 'foe' });
  assert.deepEqual(crewTargets([1, 2, 3], ['a', 'b']), ['a', 'b', 'a']);
  assert.deepEqual(crewTargets([1, 2], []), [null, null]);
});

test('t1706u sword mode: my crew rush with cutlasses and clash blades; mode switches dynamically', () => {
  const w = world();
  w.cf.engage('me', 'gun', 'foe', 0); w.run(1.6);
  const gunN = w.cf.log.length;
  w.cf.engage('me', 'sword', 'foe', w.t); assert.deepEqual(w.cf.wire('me'), { cm: 2, ct: 'foe' }, 'switched at once');
  w.run(6);
  const slashes = w.cf.log.slice(gunN).filter((e) => e.kind === 'slash');
  assert.ok(slashes.length >= 3, 'blades clash');
  assert.equal(w.cf.log.slice(gunN).filter((e) => e.kind === 'shot').length <= w.crews.me.length, true, 'no more volleys once in sword mode (at most the in-flight ones)');
  for (const s of slashes) { assert.ok(w.crews.foe.includes(s.victim)); assert.notEqual(s.victim, w.caps.foe); }
  assert.ok(w.crews.me.some((c) => Math.hypot(c.x - 20, c.z) < 6), 'rushed across');
  // back to guns
  w.cf.engage('me', 'gun', 'foe', w.t); assert.equal(w.cf.wire('me').cm, 1);
  // remote sync: peer 'foe' attacking ME (ct = my id) mirrors on my screen
  w.cf.remote('foe', 2, 'my-net-id', 'my-net-id'); assert.equal(w.cf.fights.get('foe').target, 'me');
  w.cf.remote('foe', 0, '', 'my-net-id'); assert.equal(w.cf.fights.has('foe'), false);
});

test('t1706u enemy with 0 crew -> my crew never shoots the captain; Safe Zones -> zero crew attacks', () => {
  const w = world({ theirs: 0 });
  w.cf.engage('me', 'gun', 'foe', 0); w.run(4);
  assert.equal(w.cf.log.length, 0);
  w.cf.engage('me', 'sword', 'foe', w.t); w.run(4);
  assert.equal(w.cf.log.length, 0);
  const s = world({ safe: (x) => x > 10 });                        // the enemy stands in a Safe Zone
  s.cf.engage('me', 'gun', 'foe', 0); s.run(4);
  assert.equal(s.cf.log.length, 0);
  const s2 = world({ safe: () => true });
  s2.cf.engage('me', 'sword', 'foe', 0); s2.run(4); assert.equal(s2.cf.log.length, 0);
  const battle = read('js/onfoot/battle.js');
  assert.match(battle, /crewFight\?\.engage\('me', 'sword'/); assert.match(battle, /crewFight\?\.engage\('me', 'gun'/);
  assert.match(battle, /cm.*ct/);
  assert.match(read('js/onfoot/crewFight.js'), /crewfight=0/);
});
