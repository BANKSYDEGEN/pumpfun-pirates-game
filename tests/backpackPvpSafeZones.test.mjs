// node --test tests/backpackPvpSafeZones.test.mjs
// [backpack-pvp] BANKSY t1693u: 16-slot backpack cap + BANKSY unlimited + PvP loot haul split + Island Safe Zones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

import {
  BACKPACK_CAP, countBackpackSlots, canAcceptItem, splitLootForCap, isUnlimitedBag,
  maxBackpackSlots, slotMeterText, needsNewSlot, BAGCAP_ON,
} from '../js/inventory/backpackCap.js';
import {
  SAFE_PARTS, EXTRA_ZONES, zoneAt, inIslandSafeZone, canFightOnFoot, tickIsleSafe, graceLeft,
  SAFE_GRACE_S, cottageDoorstep, mapSafeZoneRings, SAFEZONES_ON, isInsideColiseum, COLI, TRAIL_A_LINK,
  CORRIDOR_ID, CORRIDOR_NAME, zoneAtH, isInsideColiseumH, footToHarbor, wardPosts, coliseumExclusion, safeShapes,
  SAFE_POLY, SAFE_CTRL, pointInPoly,
} from '../js/island/safeZones.js';
import { t2w } from '../js/island/coast.js';
import {
  cleanServerCode, ownPrefix, codeOfPrefix, newServerCode, cleanCopy, serverLabel, publicRows, planSwitch,
} from '../js/serverPicker.js';
import { HARBOR_PREFIX_RE } from '../js/transport.js';
import { DIG_SPOTS } from '../js/island/digSpots.js';
import { splitHaulForDrop } from '../js/inventory/backpackCap.js';
// server loot.ts is Deno; contract-checked via source read below

const COTTAGES = [
  { id: 'balcony', x: -375.34, z: -157.54, ry: -0.4867, frontZ: 5.40 },
  { id: 'dormer',  x: -359.48, z: -138.46, ry: -1.3910, frontZ: 5.20 },
  { id: 'gabled',  x: -369.88, z: -115.50, ry: -2.6347, frontZ: 6.30 },
  { id: 'garden',  x: -388.99, z: -111.15, ry: -3.0321, frontZ: 4.85 },
];

test('kill switches present (&bagcap=0 / &pvploot=0 / &safezones=0)', () => {
  assert.match(read('js/inventory/backpackCap.js'), /bagcap=0/);
  assert.match(read('js/dock/lootBags.js'), /pvploot=0/);
  assert.match(read('js/island/safeZones.js'), /safezones=0/);
  assert.equal(BACKPACK_CAP, 16);
  assert.equal(SAFE_GRACE_S, 3);
  assert.match(read('supabase/functions/pvp/loot.ts'), /BACKPACK_CAP = 16/);
  assert.match(read('supabase/functions/pvp/loot.ts'), /LOOT_TTL_S = 120/);
});

test('16-slot backpack: stacks share 1 slot; unique weapons 1 each; equipped excluded', () => {
  const eq = { sword: 'wpn:sword:cutlass:rare', musket: 'wpn:musket:navy:common' };
  const items = [
    { item: 'val:gold_bar', qty: 50 },
    { item: 'fish:snapper', qty: 9 },
    { item: 'val:ruby', qty: 1 },
    { item: eq.sword, qty: 1 },
    { item: eq.musket, qty: 1 },
    { item: 'wpn:sword:rapier:epic', qty: 1 },
    { item: 'wpn:musket:blunder:rare', qty: 2 }, // wstack → 2 slots
  ];
  // haul slots: gold_bar, snapper, ruby, rapier, blunder×2 = 6 (equipped sword+musket excluded)
  assert.equal(countBackpackSlots(items, eq), 6);
  // fill to 16 with distinct valuables
  const filled = [
    ...items,
    ...Array.from({ length: 10 }, (_, i) => ({ item: `val:extra_${i}`, qty: 1 })),
  ];
  assert.equal(countBackpackSlots(filled, eq), 16);
  // 17th distinct blocked
  const block = canAcceptItem(filled, 'val:new_gem', 1, eq, { owner: false });
  assert.equal(block.ok, false);
  assert.match(block.why, /Backpack full/);
  // stacking onto existing gold_bar still OK at 16/16
  const stack = canAcceptItem(filled, 'val:gold_bar', 3, eq, { owner: false });
  assert.equal(stack.ok, true);
  assert.equal(stack.stacked, true);
});

test('BANKSY / owner exemption: 25+ distinct items + ∞ meter', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ item: `val:troph_${i}`, qty: 1 }));
  assert.equal(countBackpackSlots(many, {}), 30);
  assert.equal(maxBackpackSlots({ owner: true }), Infinity);
  assert.equal(isUnlimitedBag({ owner: true }), true);
  assert.equal(isUnlimitedBag({ name: 'BANKSY' }), true);
  assert.equal(isUnlimitedBag({ name: 'BANKSYDEGEN' }), true);
  assert.equal(isUnlimitedBag({ name: 'rando' }), false);
  const ok = canAcceptItem(many, 'val:more', 1, {}, { owner: true });
  assert.equal(ok.ok, true);
  const m = slotMeterText(7, { owner: true });
  assert.match(m.text, /∞/);
  assert.equal(m.level, 'owner');
});

test('PvP death haul split: unequipped drops; equipped / maps stay', () => {
  const eq = { sword: 'wpn:sword:cutlass:rare', musket: 'wpn:musket:navy:common' };
  const items = [
    { item: 'val:ruby', qty: 2 },
    { item: 'fish:koi', qty: 1 },
    { item: eq.sword, qty: 1 },
    { item: eq.musket, qty: 1 },
    { item: 'wpn:sword:bone:legendary', qty: 1 },
    { item: 'map:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', qty: 1 },
  ];
  const { drop, keep } = splitHaulForDrop(items, eq);
  assert.deepEqual(drop.map((d) => d.item).sort(), ['fish:koi', 'val:ruby', 'wpn:sword:bone:legendary'].sort());
  assert.ok(keep.some((k) => k.item === eq.sword));
  assert.ok(keep.some((k) => k.item === eq.musket));
  assert.ok(keep.some((k) => k.item.startsWith('map:')));
  // claim respects looter cap
  const looter = Array.from({ length: 15 }, (_, i) => ({ item: `val:l${i}`, qty: 1 }));
  const bag = [{ item: 'val:ruby', qty: 1 }, { item: 'fish:koi', qty: 1 }, { item: 'val:diamond', qty: 1 }];
  const { take, left } = splitLootForCap(bag, looter, {}, { owner: false });
  assert.equal(take.reduce((a, t) => a + 1, 0) + countBackpackSlots(looter, {}), 16);
  assert.ok(left.length >= 1, 'overflow stays in bag');
  // BANKSY claims all
  const all = splitLootForCap(bag, looter, {}, { owner: true });
  assert.equal(all.left.length, 0);
  assert.equal(all.take.length, 3);
});

test('server loot.ts exports countSlots / splitForCap / BACKPACK_CAP / LOOT_TTL_S', () => {
  const loot = read('supabase/functions/pvp/loot.ts');
  assert.match(loot, /export function countSlots/);
  assert.match(loot, /export function splitForCap/);
  assert.match(loot, /export const BACKPACK_CAP = 16/);
  assert.match(loot, /export const LOOT_TTL_S = 120/);
  assert.match(loot, /OWNER_MAIN/);
  // Mirror: client countSlots math already covered above; server copies the same rules
  const eq = { sword: 'wpn:sword:cutlass:rare', musket: 'wpn:musket:navy:common' };
  assert.equal(countBackpackSlots([
    { item: 'val:gold_bar', qty: 9 }, { item: eq.sword, qty: 1 }, { item: 'wpn:sword:rapier:epic', qty: 1 },
  ], eq), 2);
});

test('Island Safe Zones t1727u: unified polygon covers harbor/coli/fort/lagoon; sandbar+bridge outside', () => {
  assert.ok(SAFEZONES_ON);
  assert.ok(SAFE_POLY.length > 64, 'Chaikin-smoothed polygon');
  assert.ok(SAFE_CTRL.length >= 20);
  assert.equal(SAFE_PARTS.length, 1);
  assert.equal(EXTRA_ZONES.length, 0, 'cove + lagoon folded into the one polygon');
  for (const c of COTTAGES) {
    const d = cottageDoorstep(c);
    assert.ok(inIslandSafeZone(d.x, d.z), c.id + ' doorstep safe');
  }
  assert.ok(inIslandSafeZone(-391, -134), 'wishing well');
  assert.ok(inIslandSafeZone(-612, -70), 'harbor plaza');
  assert.ok(inIslandSafeZone(-690, -180), 'harbor dock spawn');
  assert.ok(inIslandSafeZone(-555, -76), 'hill shops / squad');
  assert.ok(inIslandSafeZone(-592, -334), 'swim cove');
  assert.ok(inIslandSafeZone(-504, -29), 'coli center INSIDE sanctuary (t1727u)');
  assert.ok(inIslandSafeZone(-408, -44), 'hilltop fort');
  assert.ok(inIslandSafeZone(-205, -130), 'fishing lagoon');
  assert.ok(inIslandSafeZone(-758, 18), 'lighthouse');
  assert.ok(inIslandSafeZone(-682, 70), 'cliff battery');
  assert.equal(zoneAt(-745, -435), null, 'sandbar light OUTSIDE');
  assert.equal(zoneAt(16, -82), null, 'rope / hangman bridge OUTSIDE');
  const rings = mapSafeZoneRings();
  assert.ok(rings.some((r) => /Safe Zone|Sanctuary|Harbor/i.test(r.name)));
});

test('canFightOnFoot blocks inside Safe Zone + 3s exit grace + inHouse (coli now safe too)', () => {
  const st = {};
  assert.equal(canFightOnFoot(st, -612, -70, 0), false);
  assert.equal(canFightOnFoot(st, -504, -29, 0), false, 'coli inside unified sanctuary = no open-world PvP');
  assert.equal(canFightOnFoot(st, -504, -29, 0, { inHouse: true }), false);
  tickIsleSafe(st, -612, -70, 10);
  assert.equal(st._isleSafe, true);
  const out = DIG_SPOTS.find((d) => d.active && !zoneAt(d.x, d.z)); // contested open island
  assert.ok(out, 'need a dig outside the sanctuary');
  tickIsleSafe(st, out.x, out.z, 11); // leave
  assert.equal(st._isleSafe, false);
  assert.ok(graceLeft(st, 12, SAFE_GRACE_S) > 0);
  assert.equal(canFightOnFoot(st, out.x, out.z, 12), false); // still in grace
  assert.equal(canFightOnFoot(st, out.x, out.z, 15), true); // grace over
});

test('migration 044 + edge loot/houses/inventory wiring contracts', () => {
  const sql = read('supabase/migrations/044_pvp_loot_bags.sql');
  assert.match(sql, /pvp_loot_bags/);
  assert.match(sql, /pvploot/);
  assert.match(sql, /bagcap/);
  assert.match(sql, /safezones/);
  assert.match(sql, /pvp_house_take_capped/);
  assert.match(sql, /expires_at/);
  const loot = read('supabase/functions/pvp/loot.ts');
  assert.match(loot, /pvp_drop_haul/);
  assert.match(loot, /pvp_claim_loot/);
  assert.match(loot, /BACKPACK_CAP/);
  assert.match(loot, /who\.owner/);
  const idx = read('supabase/functions/pvp/index.ts');
  assert.match(idx, /loot\.ts/);
  assert.match(idx, /LOOT_ACTIONS/);
  const hts = read('supabase/functions/pvp/houses.ts');
  assert.match(hts, /Backpack full/);
  assert.match(hts, /BACKPACK_CAP/);
  const sw = read('sw.js');
  assert.match(sw, /backpackCap\.js/);
  assert.match(sw, /safeZones\.js/);
  assert.match(sw, /lootBags\.js/);
  assert.match(sw, /pfp-v3[2-9][0-9]/);
  for (const f of [
    'js/inventory/backpackCap.js', 'js/island/safeZones.js', 'js/dock/lootBags.js',
    'js/dock/safeZoneMarks.js', 'js/inventory/ui.js', 'js/dock/houses.js',
    'js/dock/index.js', 'js/onfoot/battle.js', 'js/islandMap.js',
  ]) assert.ok(existsSync(join(ROOT, f)), f);
});

test('client UI wires slot meter + loot bag prompt + safe HUD', () => {
  const ui = read('js/inventory/ui.js');
  assert.match(ui, /slotMeterText|iv-slots|🎒/);
  const houses = read('js/dock/houses.js');
  assert.match(houses, /data-bagcap|BAG_FULL_MSG|canAcceptItem/);
  const dock = read('js/dock/index.js');
  assert.match(dock, /createLootBags|dk-islesafe|SAFE ZONE/);
  const battle = read('js/onfoot/battle.js');
  assert.match(battle, /canFightOnFoot|dropHaul|SAFE ZONE/);
  const map = read('js/islandMap.js');
  assert.match(map, /drawSafeZoneRings|SAFE_POLY|2ee88a/);
  const bags = read('js/dock/lootBags.js');
  assert.match(bags, /LOOT PLUNDER|buildLootBagMesh|escHtml/);
  assert.match(bags, /PUMPFUN PIRATES|plunder/i);
});

// ---------------- t1695u: ONE continuous Cottages-to-Dock Safe Zone, Coliseum 100 % outside ----------------
test('t1695u corridor: Cottage Village -> Trail A -> Main Street -> Harbor Plaza -> Main Dock with ZERO gaps', () => {
  const path = [[-391, -134], ...[...TRAIL_A_LINK].reverse(), t2w(0, -205), t2w(0, -150), t2w(0, -58), t2w(0, 0), t2w(-120, 30), [-690, -84]];
  for (const c of COTTAGES) path.unshift([cottageDoorstep(c).x, cottageDoorstep(c).z], [-391, -134]);
  let n = 0;
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    for (let s = 0; s <= L; s += 0.5) {
      const x = a[0] + (b[0] - a[0]) * s / L, z = a[1] + (b[1] - a[1]) * s / L, zn = zoneAt(x, z); n++;
      assert.ok(zn, `gap at foot (${x.toFixed(1)}, ${z.toFixed(1)})`);
      assert.equal(zn.id, CORRIDOR_ID, 'one continuous zone id');
      assert.equal(zn.name, CORRIDOR_NAME);
    }
  }
  assert.ok(n > 900, 'sampled every 0.5 m');
  // jetties J1..J5 (town lx -150..58, lz 8..59) + old piers P3 / P4 + Trail A gate
  for (const lx of [-150, -100, -48, 0, 58]) for (const lz of [8, 30, 59]) assert.ok(zoneAt(...t2w(lx, lz)), `jetty ${lx},${lz}`);
  assert.ok(zoneAt(...t2w(-210, 30)) && zoneAt(...t2w(-270, 30)), 'old piers P3 / P4');
  assert.ok(zoneAt(-435, -84), 'Trail A gate');
  // harbor-frame wrapper: the spawn berth in the scene frame
  assert.ok(zoneAtH(...footToHarbor(-690, -84)), 'spawn berth (harbor frame)');
});

test('t1727u Coliseum is INSIDE the unified Safe Zone (no carve-out, no open-world PvP)', () => {
  let n = 0;
  for (let lx = COLI.lx0 - 6; lx <= COLI.lx1 + 6; lx += 1) for (let lz = COLI.lz0 - 6; lz <= COLI.lz1 + 6; lz += 1) {
    const [x, z] = t2w(lx, lz);
    if (!isInsideColiseum(x, z)) continue; n++;
    assert.ok(zoneAt(x, z), `coli town (${lx}, ${lz}) must be safe`);
    assert.equal(canFightOnFoot({}, x, z, 0), false);
  }
  assert.ok(n > 5000, 'whole shell sampled');
  for (const [lx, lz] of [[20, -114.761], [40, -114.761], [61, -101], [61, -150]]) {
    const [x, z] = t2w(lx, lz); assert.ok(isInsideColiseum(x, z)); assert.ok(zoneAt(x, z));
  }
  // staying inside sanctuary: no exit grace fired when walking plaza → coli
  const st = {}; tickIsleSafe(st, -555, -76, 10); assert.equal(st._isleSafe, true);
  const [cx, cz] = t2w(61, -136); tickIsleSafe(st, cx, cz, 10.5);
  assert.equal(st._isleSafe, true); assert.equal(graceLeft(st, 10.6), 0);
  assert.equal(canFightOnFoot(st, cx, cz, 10.6), false);
  assert.equal(isInsideColiseumH(...footToHarbor(cx, cz)), true);
  const ex = coliseumExclusion(); assert.ok(ex.shell.length >= 48 && ex.gallery.length === 4);
  const posts = wardPosts(14); assert.ok(posts.length > 20);
  assert.equal(safeShapes().length, 1, 'single sanctuary polygon');
  assert.ok(pointInPoly(cx, cz, SAFE_POLY));
});

test('t1695u Coliseum constants mirror js/island/coliseum.js FOOT / p / MAIN_GATE', () => {
  const src = read('js/island/coliseum.js');
  assert.match(src, /export const FOOT = \{ lx0: 34, lx1: 88, lz0: -200, lz1: -72/);
  assert.match(src, /p: 2\.7/);
  assert.deepEqual([COLI.lx0, COLI.lx1, COLI.lz0, COLI.lz1, COLI.p], [34, 88, -200, -72, 2.7]);
  // t1727u: NO coli carve-out label on the map
  assert.doesNotMatch(read('js/islandMap.js'), /COLISEUM · PvP ON/);
  assert.match(read('js/islandMap.js'), /SAFE_POLY/);
});

test('t1727u dig spots outside sanctuary stay contested + no safe HUD banner inside a cottage', () => {
  // digs far from the sanctuary stay contested; digs that fall inside the unified polygon are protected (no DIG_CARVE)
  for (const d of DIG_SPOTS.filter((x) => x.active && !zoneAt(x.x, x.z))) {
    for (const [ox, oz] of [[0, 0], [3, 0], [0, -3], [-3, 2]]) assert.equal(zoneAt(d.x + ox, d.z + oz), null, d.id);
  }
  const dock = read('js/dock/index.js');
  assert.match(dock, /houses\?\.inHouse|houses\.inHouse/);
  assert.match(dock, /harborToFoot\(W\.x, W\.z\)/, 'HUD converts the harbor walker to the foot frame');
});

// ---------------- t1694u: server picker ----------------
test('t1694u server picker: codes, prefixes, plans, labels', () => {
  assert.equal(cleanServerCode(' ab-c9 '), 'ABC9');
  assert.equal(cleanServerCode('x'), '');
  assert.equal(cleanServerCode('A'.repeat(13)).length, 12);
  assert.equal(cleanServerCode('test'), '');
  assert.equal(cleanServerCode('<img src=x>'), 'IMGSRCX');
  assert.equal(ownPrefix('Ab12Z'), 'pfp-harbor-ab12z');
  assert.match(ownPrefix('Ab12Z'), HARBOR_PREFIX_RE);
  assert.match('pfp-harbor', HARBOR_PREFIX_RE);
  assert.equal(codeOfPrefix('pfp-harbor-ab12z'), 'AB12Z');
  assert.equal(codeOfPrefix('pfp-harbor'), '');
  const c = newServerCode(); assert.match(c, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(cleanCopy(61), 0); assert.equal(cleanCopy(7), 7); assert.equal(cleanCopy(-1), 0);
  assert.deepEqual([planSwitch('new').wantCopy, planSwitch('auto').wantCopy, planSwitch('pick', 3).wantCopy], [-1, 0, 3]);
  assert.equal(planSwitch('pick', 3).prefix, 'pfp-harbor');
  const own = planSwitch('own', 'zz9q'); assert.equal(own.prefix, 'pfp-harbor-zz9q');
  const cr = planSwitch('create', null, () => 0.5); assert.match(cr.code, /^[A-Z2-9]{5}$/); assert.equal(cr.prefix, ownPrefix(cr.code));
  assert.match(serverLabel({ copy: 2 }), /HARBOR #2/);
  assert.match(serverLabel({ prefix: 'pfp-harbor-ab12z', copy: 1 }), /OWN · AB12Z/);
  const rows = publicRows([[1, 4], [2, 1], [3, 0]], { cap: 4, cur: 2 });
  assert.ok(rows.some((r) => /Harbor #2 · 1\/4 Pirates/.test(r.text)));
});

test('t1694u server picker wiring: button, modal, switch, migration want semantics, sw.js shell', () => {
  const sp = read('js/serverPicker.js');
  for (const s of ['⚓ SWITCH / PRIVATE SERVER', 'CHOOSE SERVER', 'ACTIVE PUBLIC SERVERS', '+ NEW PUBLIC SERVER', 'CREATE OWN SERVER', 'JOIN CODE', 'COPY CODE', 'AUTO PUBLIC']) assert.ok(sp.includes(s), s);
  assert.match(sp, /escHtml/);
  const pvp = read('js/pvp.js');
  assert.match(pvp, /function switchServer/);
  assert.match(pvp, /hbLeave\(true\)/);
  assert.match(pvp, /⚓ Switched to/);
  assert.match(pvp, /serverPicker/);
  assert.match(pvp, /houses\?\.exit|exitHouse|inHouse/);
  const sql = read('supabase/migrations/044_pvp_loot_bags.sql');
  assert.match(sql, /create or replace function public\.pvp_harbor_core\(p_seat text, p_prefix text, p_op text, p_name text default null, p_cap int default null, p_want_copy int default null\)/);
  assert.match(sql, /p_want_copy = -1 then -1/);
  assert.match(sql, /between 1 and max_copies/);
  assert.match(sql, /if n < cap then/);
  const sw = read('sw.js');
  for (const f of ['serverPicker.js', 'kdCounter.js', 'onfoot/crewFight.js']) assert.ok(sw.includes(f), f);
});

// ---------------- t1698u: Option B harbor sea PvP + floating sea loot crates ----------------
test('t1698u Option B: kill switch, unmanned ship shield, harbor sink credits + sea crate drop', () => {
  const pvp = read('js/pvp.js');
  assert.match(pvp, /hbpvp/);
  assert.match(pvp, /m\.um/);
  assert.match(pvp, /function shipProtectedHarbor/);
  assert.match(pvp, /function harborPvpSunk/);
  assert.match(pvp, /sank .*at sea!/);
  assert.match(pvp, /dropLocalHaul\?\.\(\{ sea: true/);
  assert.match(pvp, /harborPvpCanHit/);
  const bags = read('js/dock/lootBags.js');
  assert.match(bags, /export function buildSeaCrateMesh/);
  assert.match(bags, /SEA_FOOT_R = 3\.5, SEA_HULL_R = 15/);
  assert.match(bags, /LOOT SEA CRATE/);
  assert.match(bags, /waveHeight/);
  assert.match(bags, /function dropLocalHaul/);
  const loot = read('supabase/functions/pvp/loot.ts');
  assert.match(loot, /delete\(\)\.eq\("id", bagId\)\.select/, 'atomic claim');
  assert.match(loot, /"sea"/);
});

// ---------------- t1710u: Safe Zone on EVERY map surface + UNARMED / SWORD / GUN stances ----------------
import { STANCE, STANCE_LABEL, STANCE_ICON, stanceForKey, stanceTap, holsterToggle, nextStance, peerReach, openHitOk, hitsToKill, STANCES_ON } from '../js/onfoot/stances.js';
import { weaponStats } from '../js/inventory/catalog.js';

test('t1726u/t1727u Safe Zone vector on full map + on-foot minimap; ZERO on ship radar', () => {
  const map = read('js/islandMap.js');
  assert.match(map, /SAFE_POLY/);
  assert.match(map, /function drawSafeOverlay\(ctx, T/);
  assert.match(map, /rgba\(46, 232, 138, 0\.16\)|rgba\(28, 185, 105, 0\.18\)/);
  assert.match(map, /#2ee88a/);
  const fn = (name) => { const a = map.indexOf(`function ${name}(`); const b = map.indexOf('\n  }\n', a); return map.slice(a, b); };
  assert.match(fn('drawLocal'), /drawSafeZoneRings\(ctx, T, k, 1, \{ labels: false \}\)/, 'rotating corner minimap');
  assert.match(fn('drawLocal'), /🛡️ SAFE' : '⚔️ PVP'/, 'rim pill');
  assert.doesNotMatch(fn('draw'), /drawSafeZoneRings/, 't1726u: NO Safe Zone on ship/island radar draw()');
  assert.match(fn('frame'), /drawSafeZoneRings\(c, T, k, dpr/, 'full-screen map');
  assert.match(fn('frame'), /drawSafeZoneRings\(c, T2, kk, dpr, \{ small: true \}\)/, 'HARBOR TOWN inset');
  assert.match(map, /<i style="background:rgba\(46,232,138,\.45\);border:1\.5px solid #2ee88a"><\/i>safe zone/, '.im-key legend');
  assert.match(map, /'🛡️ SAFE ZONE'/);
  assert.doesNotMatch(map, /COLISEUM · PvP ON/);
  assert.match(read('js/main.js'), /t1726u.*no Safe Zone overlay/, 'at-sea ship radar call removed');
  const dock = read('js/dock/index.js');
  assert.match(dock, /radarZones: \(\) => false/);
});

test('t1710u/t1731u/v339 stances: Q cycles Unarmed→Musket→Sword (Tab = menu); compact #bt-stance above emotes; Safe Zone auto-unarmed', () => {
  assert.ok(STANCES_ON);
  assert.deepEqual(STANCE, { unarmed: 0, sword: 1, gun: 2 });
  assert.deepEqual([...STANCE_LABEL], ['🤚 UNARMED', '⚔️ SWORD', '🔫 GUN']);
  assert.deepEqual([...STANCE_ICON], ['🤚', '⚔️', '🔫']);
  assert.deepEqual(['Digit1', 'Digit2', 'Digit3', 'Numpad2', 'KeyQ'].map(stanceForKey), [0, 1, 2, 1, null]);
  assert.equal(stanceTap(0, 1), 1); assert.equal(stanceTap(1, 1), 0, 'tap the drawn weapon again = holster'); assert.equal(stanceTap(1, 2), 2); assert.equal(stanceTap(2, 0), 0);
  assert.equal(holsterToggle(1, 1), 0); assert.equal(holsterToggle(0, 2), 2); assert.equal(holsterToggle(0, 1), 1); assert.equal(holsterToggle(0, 0), 1);
  assert.equal(nextStance(0), 2, 'Unarmed → Musket');
  assert.equal(nextStance(2), 1, 'Musket → Sword');
  assert.equal(nextStance(1), 0, 'Sword → Unarmed');
  const B = read('js/onfoot/battle.js');
  assert.match(B, /function setStance\(s, auto = false\)/);
  assert.match(B, /id="bt-stance"|'bt-stance'/);
  assert.match(B, /nextStance|cycleStance/);
  assert.match(B, /isKey\('weapon', e\.code\)/); // [v339] Q cycles weapon; Tab is menu-only
  assert.match(B, /safe-locked|SAFE ZONE<small>weapons stay holstered/);
  assert.match(B, /isleSafe\._isleSafe && !me\.arena && me\.stance !== 0/);
  assert.match(B, /bottom:calc\(84px \+ var\(--safe-b/);
  assert.match(B, /setStance\(ar === Z_PIT \? 1 : 2, true\)/, 'pit auto-sword, range auto-gun');
  assert.match(B, /swords only in the pit/);
  assert.match(B, /e\.code === 'KeyX'/);
  assert.match(B, /STANCES_ON \? !me\.onFoot : !me\.zone\) return \{ ba: 0/, 'ba rides whenever on foot');
  assert.match(read('js/onfoot/stances.js'), /stances=0/);
  assert.match(read('css/style.css'), /html\.hud-hide #bt-stance/);
});

test('t1710u open-island cross-stance hits + Safe-Zone sniper protection', () => {
  const plaza = t2w(0, 0), open = DIG_SPOTS.find((d) => d.active && !zoneAt(d.x, d.z)), A = [open.x, open.z], V = [open.x + 20, open.z];
  assert.equal(zoneAt(...V), null);
  // the rule ignores what the victim holds: gun -> sword / unarmed, sword -> gun / unarmed all land on the open island
  for (const held of [0, 1, 2]) assert.equal(openHitOk(A, V, { now: 100 }), true, `victim holding ${STANCE_LABEL[held]}`);
  assert.equal(peerReach(1), 6.0); assert.equal(peerReach(2), 70); assert.equal(peerReach(0), 0, 'unarmed sends no hits');
  assert.equal(openHitOk(A, plaza, { now: 100 }), false, 'cannot snipe INTO a Safe Zone');
  assert.equal(openHitOk(plaza, A, { now: 100 }), false, 'cannot fire OUT of a Safe Zone');
  assert.equal(openHitOk(A, V, { inHouse: true }), false);
  const [cx, cz] = t2w(61, -136); assert.equal(openHitOk([cx, cz], [cx + 2, cz], {}), false, 'coli inside sanctuary = no open-world PvP');
  const B = read('js/onfoot/battle.js');
  assert.match(B, /const canHitPeer = \(r, p, need, id\) => .*!isMate\(id, r\).*STANCES_ON \? \(me\.pvpOk && victimOpen\(p\)\) : r\.ba\[0\] === need/);
  assert.match(B, /if \(!canHitPeer\(r, p, Z_PIT, id\)\) continue;/); assert.match(B, /if \(!canHitPeer\(r, p, Z_RANGE, id\)\) continue;/);
  assert.match(B, /me\.onFoot && d <= peerReach\(ba\[0\]\) && victimOpen\(p\)/, 'incoming hits accepted in any stance of mine');
});

test('t1710u/t1740u open-island KO respawns on your ship (Coliseum KO: at the gate, no haul drop)', () => {
  const B = read('js/onfoot/battle.js');
  assert.match(B, /function harborRespawn\(\)/);
  assert.match(B, /insideSafeZoneH\(q\.x, q\.z\)/);
  // [v328] open-island: try respawnOnShip first (moored Harbor OR offshore anchor); harborRespawn is the fallback
  assert.match(B, /if \(respawnOnShip\?\.\(\)\) return/);
  assert.match(B, /respawning on your ship/);
  assert.match(B, /spawnPoint\(me\.downArena/);
  assert.match(B, /if \(!coli\) try \{/);
  assert.ok(zoneAt(-690, -84), 'the dock / berth ashore spots are inside the Safe Zone');
});

test('t1711u 5-6 shots to kill: common 19 = 6, rare / epic 20 + legendary 21 = 5, bayonet keeps 5+', () => {
  const B = read('js/onfoot/battle.js');
  assert.match(B, /sword: \{ dmg: 19,/); assert.match(B, /musket: \{ dmg: 19, range: 60, wide: 0\.55, reload: 1\.25/);
  const base = { dmg: 19, range: 60, wide: 0.55, reload: 1.25 };
  const dmg = (r) => weaponStats('musket', r, base, true).dmg;
  assert.equal(dmg('common'), 19); assert.equal(hitsToKill(19), 6); assert.equal(100 - 5 * 19, 5, '5 shots leave 5 HP');
  for (const r of ['rare', 'epic', 'legendary']) { const d = dmg(r); assert.ok(d === 20 || d === 21, r); assert.equal(hitsToKill(d), 5, r); const left = 100 - 4 * d; assert.ok(left >= 16 && left <= 20, `${r}: 4 shots leave ${left}`); }
  for (const r of ['common', 'rare', 'epic', 'legendary']) { const s = weaponStats('sword', r, { dmg: 19, reach: 2.5, cool: 0.55 }, true).dmg; assert.ok([5, 6].includes(hitsToKill(s)), `sword ${r}`); }
  assert.match(read('js/musketUpgrades.js'), /bayonet \? \{ dmg: 3, reach: 2\.2 \}/);
  assert.ok([5, 6].includes(hitsToKill(19 + 3)) && hitsToKill(21 + 3) === 5);
});
