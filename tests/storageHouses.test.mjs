// node --test tests/storageHouses.test.mjs
// [storage-houses] door placement, buy/storage invariants, inHouse ih reservation, &houses=0 kill switch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../js/dock/houses.js', import.meta.url), 'utf8');
const DOCK = readFileSync(new URL('../js/dock/index.js', import.meta.url), 'utf8');
const PVP = readFileSync(new URL('../supabase/functions/pvp/index.ts', import.meta.url), 'utf8');
const HTS = readFileSync(new URL('../supabase/functions/pvp/houses.ts', import.meta.url), 'utf8');
const SQL = readFileSync(new URL('../supabase/migrations/043_houses.sql', import.meta.url), 'utf8');
const SW = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const NET = readFileSync(new URL('../js/onfoot/net.js', import.meta.url), 'utf8');

const FALLBACK = [
  { id: 'balcony', x: -375.34, z: -157.54, ry: -0.4867, frontZ: 5.40 },
  { id: 'dormer',  x: -359.48, z: -138.46, ry: -1.3910, frontZ: 5.20 },
  { id: 'gabled',  x: -369.88, z: -115.50, ry: -2.6347, frontZ: 6.30 },
  { id: 'garden',  x: -388.99, z: -111.15, ry: -3.0321, frontZ: 4.85 },
];
const doorstepOf = (c, pad = 1.35) => {
  const d = (c.frontZ || 4.5) + pad;
  return { x: c.x + Math.sin(c.ry) * d, z: c.z + Math.cos(c.ry) * d, yaw: c.ry + Math.PI };
};

test('&houses=0 kill switch + default on', () => {
  assert.match(SRC, /houses=0/);
  assert.match(SRC, /HOUSES_ON/);
  assert.ok(SRC.includes('[?&]houses=0'));
});

test('4 cottage doors match Post coords and sit on walkable doorsteps', () => {
  for (const c of FALLBACK) {
    assert.match(SRC, new RegExp(`id: '${c.id}'`));
    assert.match(SRC, new RegExp(String(c.x).replace('.', '\\.')));
    const s = doorstepOf(c);
    const d = Math.hypot(s.x - c.x, s.z - c.z);
    assert.ok(d > c.frontZ, c.id + ' past door');
    assert.ok(d < c.frontZ + 3, c.id + ' near stoop');
  }
  // doors are spaced (no overlap of interact radii ~2.6)
  for (let i = 0; i < FALLBACK.length; i++) for (let j = i + 1; j < FALLBACK.length; j++) {
    const a = doorstepOf(FALLBACK[i]), b = doorstepOf(FALLBACK[j]);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 5.2, FALLBACK[i].id + '/' + FALLBACK[j].id);
  }
  // avoid Hill Street shop lots (rough: Main Street x~6 town-local — cottages sit west on Trail A)
  for (const c of FALLBACK) assert.ok(c.x < -340 && c.z > -180 && c.z < -100, c.id + ' in cottage neighborhood');
});

test('buy + storage deposit/withdraw invariants (stacks, unique weapons, capacity, equipped block)', () => {
  assert.match(SRC, /HOUSE_PRICE = 2500/);
  assert.match(SRC, /TIER_SLOTS = \{ cozy: 24, captain: 40, manor: 60 \}/);
  assert.match(SRC, /UPGRADE_SLOTS = 16/);
  assert.match(SQL, /equipped/);
  assert.match(SQL, /chest full/);
  assert.match(SQL, /pvp_inv_take/);
  assert.match(SQL, /pvp_inv_add/);
  assert.match(HTS, /house_store/);
  assert.match(HTS, /house_take/);

  // Local capacity / stack model mirrors the SQL + offline path
  const slots = 24;
  const chest = [];
  const store = (item, qty) => {
    if (!item.startsWith('wpn:')) {
      const s = chest.find((x) => x.item === item);
      if (s) { s.qty += qty; return 'stack'; }
    }
    if (chest.length >= slots) return 'full';
    let slot = 0; const used = new Set(chest.map((x) => x.slot)); while (used.has(slot)) slot++;
    chest.push({ slot, item, qty }); return 'ok';
  };
  const take = (slot, qty) => {
    const r = chest.find((x) => x.slot === slot); if (!r) return null;
    const q = Math.min(qty, r.qty); r.qty -= q; if (r.qty <= 0) chest.splice(chest.indexOf(r), 1); return { item: r.item, qty: q };
  };
  assert.equal(store('val:gold_bar', 2), 'ok');
  assert.equal(store('val:gold_bar', 1), 'stack');
  assert.equal(chest.length, 1); assert.equal(chest[0].qty, 3);
  assert.equal(store('wpn:sword:cutlass:rare', 1), 'ok');
  assert.equal(store('wpn:musket:blunder:common', 1), 'ok');
  // fill remaining with unique weapons
  for (let i = chest.length; i < slots; i++) assert.equal(store('wpn:sword:cutlass:common', 1), 'ok');
  assert.equal(chest.length, slots);
  assert.equal(store('val:ruby', 1), 'full');
  const got = take(0, 1); assert.equal(got.item, 'val:gold_bar'); assert.equal(got.qty, 1);
  assert.equal(chest.find((x) => x.item === 'val:gold_bar').qty, 2);
  // UI blocks equipped; SQL blocks equipped
  assert.match(SRC, /UNEQUIP THAT FIRST/);
  assert.match(SQL, /from pvp_inv_equip/);
});

test('inHouse keeps main-server spot reserved via ih:1 (no lobby drop)', () => {
  assert.match(SRC, /ih:\s*1/);
  assert.match(SRC, /SERVER SPOT RESERVED/);
  assert.match(SRC, /ft:\s*\[/);
  assert.match(SRC, /pirate\.object\.visible = false/);
  assert.match(DOCK, /houses\?\.netState/);
  assert.match(DOCK, /houses\?\.onPeerState/);
  // footNet still sends dk/ft as today; houses only ADDS ih (never replaces Room join)
  assert.match(NET, /return \{ dk:/);
  assert.doesNotMatch(SRC, /room\?\.leave|lobbyCall\('leave'|disconnect/);
});

test('server migration + edge + dock wiring + sw version', () => {
  for (const k of ['pvp_houses', 'pvp_house_storage', 'pvp_house_buy', 'pvp_house_store', 'pvp_house_take', 'pvp_house_upgrade']) assert.match(SQL, new RegExp(k));
  assert.match(HTS, /HOUSE_ACTIONS/);
  assert.match(HTS, /house_state/);
  assert.match(PVP, /from "\.\/houses\.ts"/);
  assert.match(PVP, /HOUSE_ACTIONS/);
  assert.match(DOCK, /from '\.\/houses\.js'/);
  assert.match(DOCK, /createHouses/);
  assert.match(DOCK, /houses\.prompts/);
  assert.match(SW, /const VERSION = 'pfp-v\d{3,}';/); // tip after hill-weapons fold; houses shipped as v314
});

test('prompts + interior room contract', () => {
  for (const s of ['BUY COTTAGE', 'ENTER COTTAGE', 'OPEN STORAGE', 'EXIT TO ISLAND', 'COTTAGE PURCHASED', 'buildInteriorRoom', 'house_chest', 'house_exit', 'colliders', 'pfp_house_v1']) {
    assert.match(SRC, new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('fallback exteriors + shaded interior polish', () => {
  assert.match(SRC, /buildFallbackCottage/);
  assert.match(SRC, /buildFallbackExteriors/);
  assert.match(SRC, /house_fallback_exteriors/);
  assert.match(SRC, /disposeFallbackExteriors|disposeGroup/);
  assert.match(SRC, /MeshLambertMaterial/);
  assert.match(SRC, /HemisphereLight\(0xffe6ba/);
  assert.match(SRC, /DirectionalLight\(0xffd28a/);
  assert.match(SRC, /wainscot|Wainscot/);
  assert.match(SRC, /4\.2, 0\.055, 3\.0/); // crimson rug size
  assert.match(SRC, /hs-ember/);
  assert.match(SRC, /dist = 4\.5/);
  // MeshBasicMaterial reserved for glow panes / embers / lanterns
  assert.match(SRC, /matGlow/);
  assert.ok(SRC.indexOf('MeshLambertMaterial') < SRC.indexOf('buildInteriorRoom') || SRC.includes('matL('));
});
