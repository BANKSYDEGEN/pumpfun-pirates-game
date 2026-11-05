// [v6-store-clothes] BANKSY 1:36 PM: crew shoes + pants, beard / face paint / cape in the CREW SHOP (own loadout, player prices 1:1)
import test from 'node:test'; import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs';
import { CREW_ITEMS, GEAR_ITEMS, VENDORS } from '../js/shopCatalog.js';
import { CREW_SLOTS, CREW_DEFAULT, crewGear, crewToWire, crewFromWire } from '../js/crewLoadout.js';
const save = readFileSync(new URL('../js/pvpSave.js', import.meta.url), 'utf8');
const slotOf = (src, k) => JSON.parse('[' + src.match(new RegExp(`\\b${k}: \\[([^\\]]*)\\]`))[1].replace(/'/g, '"') + ']');
const GEAR_SLOTS = new Proxy({}, { get: (_, k) => slotOf(save, k) });
const lib = readFileSync(new URL('../supabase/functions/pvp/lib.ts', import.meta.url), 'utf8');
const NEW = { crewbeard: 'beard', crewface: 'face', crewcape: 'cape', crewboots: 'boots', crewpants: 'pants' };
test('crew slots mirror the player slots (client, save, server) and the crew shop sells them', () => {
  for (const [c, b] of Object.entries(NEW)) {
    assert.deepEqual(CREW_SLOTS[c], GEAR_SLOTS[b], c); assert.deepEqual(GEAR_SLOTS[c], GEAR_SLOTS[b], c); assert.deepEqual(slotOf(lib, c), GEAR_SLOTS[b], c); assert.equal(CREW_DEFAULT[c], 'none');
    assert.ok(VENDORS.crew.slots.includes(c), c);
    for (const id of GEAR_SLOTS[b]) { const it = CREW_ITEMS.find((i) => i.slot === c && i.id === id), p = GEAR_ITEMS.find((i) => i.slot === b && i.id === id);
      assert.ok(it && p, `${c}:${id}`); assert.equal(it.price, id === 'none' ? 0 : p.price);
      if (id !== 'none') assert.match(lib, new RegExp(`"gear:${c}:${id}": \\{ price: ${p.price} \\}`)); }
  }
  assert.match(lib, /crewbeard: \["none", "beard_moustache"/);
});
test('crew gear + wire round trip; old 2-digit wire still reads', () => {
  const l = { ...CREW_DEFAULT, crewhat: 'tricorn', crewbeard: 'beard_forked', crewface: 'facepaint_retardio', crewcape: 'cape_royal', crewboots: 'sandals', crewpants: 'canvas_pants' };
  assert.deepEqual(crewFromWire(crewToWire(l)), l);
  const g = crewGear(l); assert.equal(g.beard, 'beard_forked'); assert.equal(g.cape, 'cape_royal'); assert.equal(g.pants, 'canvas_pants');
  assert.equal(crewFromWire('11').crewhat, 'tricorn'); assert.equal(crewToWire(CREW_DEFAULT), '');
});
test('cape colour: crew wire digit round trips; old wire = default colour', () => {
  const l = { ...CREW_DEFAULT, crewcape: 'cape_royal', crewcapeColor: 4 }; const r = crewFromWire(crewToWire(l));
  assert.equal(r.crewcapeColor, 4); assert.equal(crewGear(r).capeColor, 4); assert.equal(crewFromWire('11').crewcapeColor, undefined);
  assert.match(lib, /'crewcapeColor', 'crewpantsColor', 'crewbootsColor'\]\) \{ const cc/); assert.match(save, /'crewcapeColor', 'crewpantsColor', 'crewbootsColor'\]\) \{ const cc/);
});
test('pants + shoes colours: crew wire round trip', () => {
  const l = { ...CREW_DEFAULT, crewpants: 'canvas_pants', crewboots: 'sandals', crewpantsColor: 3, crewbootsColor: 6 }; const r = crewFromWire(crewToWire(l));
  assert.equal(r.crewpantsColor, 3); assert.equal(r.crewbootsColor, 6); assert.equal(crewGear(r).pantsColor, 3); assert.equal(crewGear(r).bootsColor, 6);
});
