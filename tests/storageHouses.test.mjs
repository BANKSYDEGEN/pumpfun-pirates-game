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
  assert.doesNotMatch(SRC, /hs-badge|SERVER SPOT RESERVED|INSIDE COTTAGE/); // silent ih:1, no indoor HUD badge
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
  assert.match(SRC, /dist = 4\.[48]|w\.dist = 4\.[48]/);
  // MeshBasicMaterial reserved for glow panes / embers / lanterns
  assert.match(SRC, /matGlow/);
  assert.ok(SRC.indexOf('MeshLambertMaterial') < SRC.indexOf('buildInteriorRoom') || SRC.includes('matL('));
});

test('indoor pocket world.ground/water/blocked + dual exit/chest prompts + no HUD badge', () => {
  assert.match(SRC, /inPocket/);
  assert.match(SRC, /world\.ground =/);
  assert.match(SRC, /world\.water =/);
  assert.match(SRC, /world\.blocked =/);
  assert.match(SRC, /roomOrigin\.y \+ 0\.14/);
  assert.match(SRC, /inPocket\(x, z\) \? null/);
  assert.match(SRC, /hitFurn/);
  assert.match(SRC, /LEAVE COTTAGE/);
  assert.doesNotMatch(SRC, /hs-badge/);
  assert.match(SRC, /OPEN STORAGE[\s\S]*EXIT TO ISLAND/);
  assert.match(SRC, /tag: 'chest'/);
  assert.match(SRC, /tag: 'exit'/);
  assert.match(SRC, /ih:\s*1/); // silent reservation still on the wire
  assert.match(SRC, /spots\.chest/);
  assert.match(SRC, /spots\.exit/);
  assert.match(SRC, /userData = \{ W, D, H, tier, colliders, spots/);
  // Crew/pets parked on enter, restored on exit
  assert.match(SRC, /crewF\?\.exit/);
  assert.match(SRC, /petF\?\.exit/);
  assert.match(SRC, /crewF\?\.enter/);
});

test('[v320] side chest + walk-to-door proximity prompts, spawn inside the door, step out facing the lane', () => {
  // chest geometry untouched (west wall, Post owns buildInteriorRoom art)
  assert.match(SRC, /chest\.position\.set\(-W \/ 2 \+ 1\.15, 0\.14, -0\.55\)/);
  assert.match(SRC, /chest: \{ x: -W \/ 2 \+ 2\.15, z: -0\.55, r: 2\.2/);
  assert.match(SRC, /exit: \{ x: 0, z: D \/ 2 - 1\.35, r: 2\.4/);
  assert.match(SRC, /dChest < \(spots\.chest\.r \|\| 2\.2\) && dChest <= dExit/);
  assert.match(SRC, /dExit < \(spots\.exit\.r \|\| 2\.4\)/);
  assert.doesNotMatch(SRC, /key: 'Q', primary: false, tag: 'exit'/);
  assert.match(SRC, /interior\.userData\.D \/ 2 - 1\.55/);
  assert.match(SRC, /const outYaw = hold\.yaw \+ Math\.PI; w\.yaw = outYaw; w\.camYaw = outYaw;/);
  assert.match(SRC, /world\.blocked\?\.\(w\.x, w\.z\)/);
  assert.ok((SRC.match(/pirate\.object\.rotation\.set\(0, w\.yaw, 0\)/g) || []).length >= 2, 'enterHouse + tick zero pitch / roll');
  // behaviour: replay the prompt logic on the real room layout
  const W = 8, D = 7;   // any cabin size: chest / exit spots are relative to the walls
  const spots = { chest: { x: -W / 2 + 2.15, z: -0.55, r: 2.2 }, exit: { x: 0, z: D / 2 - 1.35, r: 2.4 } };
  const tagAt = (lx, lz) => { const dC = Math.hypot(spots.chest.x - lx, spots.chest.z - lz), dE = Math.hypot(spots.exit.x - lx, spots.exit.z - lz);
    if (dC < spots.chest.r && dC <= dE) return 'chest'; if (dE < spots.exit.r) return 'exit'; return null; };
  assert.equal(tagAt(spots.chest.x + 0.3, spots.chest.z), 'chest');
  assert.equal(tagAt(0, D / 2 - 0.6), 'exit');
  assert.equal(tagAt(0, D / 2 - 1.55), 'exit', 'spawn point is right at the door: one step back out');
  assert.equal(tagAt(W / 2 - 1.0, -D / 2 + 1.0), null, 'far corner: no sticky banner');
});

test('enhanced pirate cabin interior: vaulted roof, textures, west-wall chest, cottageId', () => {
  assert.match(SRC, /cottageId/);
  assert.match(SRC, /buildInteriorRoom\(\{ tier, cottageId: d\.id, low \}\)/);
  assert.match(SRC, /PEAK|pitched|vaulted|truss|chandelier/i);
  assert.match(SRC, /CanvasTexture/);
  assert.match(SRC, /hs-flame/);
  assert.match(SRC, /skull_transparent|texJollyRoger|COTTAGE_ACCENT/);
  // West-wall chest, clear of +Z door path (v319/v320 contract)
  assert.match(SRC, /chest\.position\.set\(-W \/ 2 \+ 1\.15, 0\.14, -0\.55\)/);
  assert.match(SRC, /chest\.rotation\.y = Math\.PI \/ 2/);
  assert.match(SRC, /x: -W \/ 2 \+ 2\.15, z: -0\.55/);
  assert.doesNotMatch(SRC, /hs-badge|SERVER SPOT RESERVED|INSIDE COTTAGE/);
});

