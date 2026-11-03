// [Emerly] ITEM SKILL BOOSTS: client table = server table, caps, stacking, mode factors, the stat clamps
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOOSTS, BOOST_STATS, BOOST_MODE, COMBAT_CAP, boostsFor, applyBoosts, scaleBoosts, setBoostSource, setBoostZone, setFairFight, activeBoosts, boostZone, goldFindBonus, weaponHitBonus, ARENA_WEAPON_BOOSTS } from '../js/boosts.js';
import { GEAR_ITEMS, CREW_ITEMS } from '../js/shopCatalog.js';
import { modeStats, maxRun, shipStats, newRun } from '../js/upgrades.js';

const lib = readFileSync(new URL('../supabase/functions/pvp/lib.ts', import.meta.url), 'utf8');
const objLit = (name) => { const m = lib.match(new RegExp(`export const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`)); assert.ok(m, name); return Function(`return (${m[1].replace(/\/\/[^\n]*/g, '')})`)(); };

test('the client BOOSTS table matches the server copy (lib.ts) exactly', () => {
  assert.deepEqual(objLit('BOOSTS'), BOOSTS);
  const caps = Function(`return (${lib.match(/export const BOOST_CAPS[^=]*=\s*(\{[^\n]*\});/)[1]})`)();
  assert.deepEqual(caps, Object.fromEntries(Object.entries(BOOST_STATS).map(([k, S]) => [k, S.cap])));
  assert.match(lib, new RegExp(`BOOST_COMBAT_CAP = ${COMBAT_CAP}`));
});
test('every boosted gear key is a real shop item; free defaults give nothing', () => {
  const keys = new Set([...GEAR_ITEMS, ...CREW_ITEMS].map(i => `${i.slot}:${i.id}`));
  for (const k of Object.keys(BOOSTS)) if (!/^(sword|musket):/.test(k)) assert.ok(keys.has(k), k);
  for (const it of [...GEAR_ITEMS, ...CREW_ITEMS]) if (it.free || !it.price) assert.equal(BOOSTS[`${it.slot}:${it.id}`], undefined, `${it.slot}:${it.id}`);
  for (const id of ['cutlass', 'rapier', 'bone', 'sabre_gilded', 'blade_gold']) assert.ok(BOOSTS[`sword:${id}`]);
  for (const id of ['navy', 'blunder', 'dragoon', 'bone', 'blunder_gold']) assert.ok(BOOSTS[`musket:${id}`]);
});
test('within a slot, a pricier item never boosts less', () => {
  const bySlot = {}; for (const it of [...GEAR_ITEMS, ...CREW_ITEMS]) { const b = BOOSTS[`${it.slot}:${it.id}`]; if (b) (bySlot[it.slot] ||= []).push([it.price, Object.values(b)[0]]); }
  for (const [s, L] of Object.entries(bySlot)) { L.sort((a, b) => a[0] - b[0] || a[1] - b[1]); for (let i = 1; i < L.length; i++) assert.ok(L[i][1] >= L[i - 1][1], s); }
});
test('ownership: unowned gives 0; owner owns all but is still capped', () => {
  const g = { hat: 'crown_imperial', outfit: 'suit', eyes: 'laser', hook: 'hook_gold', leg: 'peg', face: 'facepaint_retardio', crewhat: 'crown_imperial', crewoutfit: 'suit', parrot: 'parrot_diamond', sword: 'blade_gold', musket: 'blunder_gold' };
  assert.equal(boostsFor(g, [], false).combat, 0);
  assert.equal(boostsFor(g, ['hat:crown_imperial'], false).reload, 0.06);
  const all = boostsFor(g, [], true);
  for (const [k, S] of Object.entries(BOOST_STATS)) assert.ok(all[k] <= S.cap + 1e-9, k);
  assert.ok(all.combat <= COMBAT_CAP + 1e-9); assert.ok(all.capped.includes('combat'));
  assert.equal(all.speed <= 0.05, true); // face paint 2% + crew crown 3.5% = 5.5% -> 5%
});
test('mode factors: harbor 100%, BR 50%, Waves 100%, SWORD PIT / MUSKET RANGE 0', () => {
  assert.deepEqual(BOOST_MODE, { harbor: 1, br: 0.5, waves: 1, pit: 0 });
  setBoostSource({ gear: { hat: 'crown_imperial', parrot: 'parrot_gold' }, owned: ['hat:crown_imperial', 'parrot:parrot_gold'], owner: false });
  setBoostZone('harbor'); assert.equal(activeBoosts('pvp').reload, 0.06);
  setBoostZone('br'); assert.equal(activeBoosts('pvp').reload, 0.03); assert.equal(activeBoosts('pvp').goldFind, 0.08); // economy stays full
  setFairFight(true); assert.equal(boostZone(), 'pit'); assert.equal(activeBoosts('pvp').combat, 0); setFairFight(false);
  assert.equal(activeBoosts('waves').reload, 0.06);
  assert.equal(goldFindBonus(100), 8); assert.equal(goldFindBonus(0), 0);
  setBoostZone('harbor');
});
test('applyBoosts: after upgrades, reload clamp 0.8 s, never weaker', () => {
  const max = modeStats(maxRun(), { base: 300, mul: 1, boost: true }), b = scaleBoosts(boostsFor({ hat: 'crown_imperial' }, [], true), 1);
  const s = applyBoosts({ ...max }, b); assert.ok(s.reload >= 0.8 && s.reload <= max.reload);
  const base = shipStats(newRun()), all = boostsFor({ hat: 'crown_imperial', outfit: 'suit', eyes: 'laser', hook: 'hook_gold', leg: 'peg', face: 'facepaint_retardio', crewoutfit: 'suit' }, [], true);
  const t = applyBoosts({ ...base }, all);
  assert.ok(t.maxHp >= base.maxHp && t.range >= base.range && t.gunDmg >= base.gunDmg && t.turn >= base.turn && t.speed >= base.speed && t.reload <= base.reload && t.regenPct >= base.regenPct);
  assert.equal(t.armor, base.armor); assert.equal(t.cannons, base.cannons);
  // every boost is smaller than level I of its upgrade track (the plan's rule)
  assert.ok(t.maxHp - base.maxHp < 80 && base.reload - t.reload < 0.4);
});
test('swords + muskets: their OWN hit rate only (never cannon damage / range), off in the arenas behind one flag', () => {
  for (const [k, b] of Object.entries(BOOSTS)) { if (k.startsWith('sword:')) assert.deepEqual(Object.keys(b), ['swordHit'], k); if (k.startsWith('musket:')) assert.deepEqual(Object.keys(b), ['musketHit'], k); }
  assert.equal(BOOST_STATS.dmg.cap, 0.04); assert.equal(BOOST_STATS.range.cap, 0.05); // back to the plan's caps
  assert.equal(BOOST_STATS.swordHit.combat, false); assert.equal(BOOST_STATS.musketHit.combat, false);
  const b = boostsFor({ sword: 'blade_gold', musket: 'blunder_gold' }, ['sword:blade_gold', 'musket:blunder_gold'], false);
  assert.equal(b.dmg, 0); assert.equal(b.range, 0); assert.equal(b.combat, 0); assert.equal(b.swordHit, 0.04); assert.equal(b.musketHit, 0.05);
  const before = shipStats(newRun()), s = applyBoosts({ ...before }, scaleBoosts(b, 1)); assert.deepEqual(s, before); // the ship is untouched
  setBoostSource({ gear: { sword: 'rapier', musket: 'dragoon' }, owned: ['sword:rapier', 'musket:dragoon'], owner: false });
  assert.equal(ARENA_WEAPON_BOOSTS, false);
  assert.equal(weaponHitBonus('sword', { arena: false }), 0.015); assert.equal(weaponHitBonus('musket', { arena: false }), 0.03);
  assert.equal(weaponHitBonus('sword', { arena: true }), 0); assert.equal(weaponHitBonus('musket', { arena: true }), 0);
  setFairFight(true); assert.equal(weaponHitBonus('sword'), 0); setFairFight(false); assert.equal(weaponHitBonus('cannon'), 0);
  setBoostSource({ gear: { sword: 'rapier' }, owned: [], owner: false }); assert.equal(weaponHitBonus('sword', { arena: false }), 0); // not owned
});
