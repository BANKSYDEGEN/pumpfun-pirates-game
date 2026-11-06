// [v335] PUMPFUN PIRATES: Build Mode unlocked (Plaza / Hill Street / GLB units), owner-only multi-color 🚩 REWORK flags + radius,
// server strip / preserve of '!rw_*', inventory weapon gifting (migration 049) and the removed 3D street signs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const TE = src('js/island/terrainEdit.js');

test('build mode: nothing is LOCKED any more', () => {
  assert.doesNotMatch(TE, /const LOCK\s*=/);
  assert.doesNotMatch(TE, /🔒/);
  assert.match(TE, /it\.locked = false/);
  assert.doesNotMatch(TE, /it\.locked\s*\?/);
  assert.doesNotMatch(TE, /!it \|\| it\.locked/);
});

test('build mode: Plaza, Hill Street and GLB units are selectable object units', () => {
  const m = TE.match(/const UNIT = (\/.*\/);/); assert.ok(m, 'UNIT regex');
  const UNIT = eval(m[1]);
  for (const n of ['plaza_shop_clothes', 'plaza_dock_J3', 'plaza_dock_bw07', 'hill_L3', 'hill_R0', 'battery_blender', 'lighthouse_lighthouse', 'treasure_trader', 'rb_fountain_scale', 'fort_signs_war', 'plaza_v2_signs'])
    assert.ok(UNIT.test(n), n);
  for (const n of ['hill_street', 'hill_signs_merged', 'hill_lod_L3', 'hill_street_merged_solid', 'chunk_3_4', 'foot_grass', 'island_outline', 'placed', 'foot_shallows'])
    assert.ok(!UNIT.test(n), n);
  assert.match(TE, /const id = '@' \+ path\(o\)/);
  assert.match(TE, /isObj: true, locked: false/);
  assert.match(TE, /o\.userData\.editId = id/);
  assert.match(TE, /function applyObj\(it\)/);
  assert.match(TE, /if \(!!prev\?\.h !== !!ov\?\.h\) pieceBlockers\(it\.box, !!ov\?\.h\); \}\n/); // colliders off on delete, back on restore
  assert.match(TE, /it\.isObj \? applyObj\(it\) : applyGeo\(it\)/);
  assert.match(TE, /if \(PIECES\.has\(id\)\) applyObj\(it\)/); // saved moves / deletes apply when the unit loads
  // nearest-first pick, walking up to the unit; the ground in front stops it
  assert.match(TE, /function findPiece\(cx, cy\)/);
  assert.match(TE, /while \(x && x !== footRoot && !x\.userData\.editId\) x = x\.parent/);
  assert.match(TE, /\/\^chunk_\/\.test\(o\.name\)/);
});

test('hill street: each building owns its sign (+ phone merge) vertex ranges; quantized signs are dequantized', () => {
  const H = src('js/island/hillStreet.js');
  assert.match(H, /root\.userData\.editRanges = ranges/);
  assert.match(H, /track\(signs, 'hill_signs_merged'\)/);
  assert.match(H, /track\(list, 'hill_street_merged_' \+ k\)/);
  assert.match(H, /function floatify\(geo\)/);
  assert.match(H, /floatify\(geo\); geo\.applyMatrix4\(mm\.multiplyMatrices\(g\.matrix, L\.sign\.matrix\)\)/);
  assert.match(TE, /userData\.editRanges/);
  assert.match(TE, /unitRanges/);
});

test('rework flags: 8 colors, radius 0..160, presets, note, owner-only UI', () => {
  const hexes = { red: '#ff2e3b', blue: '#2f8bff', green: '#23d96b', gold: '#ffc933', purple: '#b84dff', orange: '#ff7b1c', cyan: '#1ee6eb', white: '#f4f7ff' };
  for (const [k, h] of Object.entries(hexes)) assert.match(TE, new RegExp(`\\['${k}', '${h}'`), k);
  assert.match(TE, /RW_MAX = 160/);
  assert.match(TE, /\[0, 'PIN'\], \[5, '5'\], \[15, '15'\], \[40, '40'\], \[80, '80 TOWN'\], \[140, '140 FULL'\]/);
  assert.match(TE, /class="rw-note" type="text" maxlength="140"/);
  assert.match(TE, /e\.stopPropagation\(\)/);
  assert.match(TE, /closest\?\.\('input, textarea, select'\)/);
  assert.match(TE, /id: 'rework', label: 'REWORK', ico: '🚩'/);
  for (const c of ['rwnew', 'rwdel', 'rwclear', 'rwshow']) assert.match(TE, new RegExp(c));
  assert.match(TE, /DEL FLAG/); assert.match(TE, /CLEAR ALL/); assert.match(TE, /IN-GAME ON/);
  assert.match(TE, /te-rw-tags/);
  assert.match(TE, /rwShow: true/);
  // the rework module comes after `if (!owner) return` -> nobody else builds flags / tags
  assert.ok(TE.indexOf('if (!owner) return { owner: false }') < TE.indexOf("const rwRoot = new THREE.Group()"));
  assert.match(TE, /let rwHook = null/);
  // 3D: terrain-hugging 96-seg loop, always on top, no colliders
  assert.match(TE, /const S = 96/);
  assert.match(TE, /depthTest: false/);
  assert.match(TE, /renderOrder = 997/);
  assert.match(TE, /toneMapped: false/);
  const rw = TE.slice(TE.indexOf('// ===== [v335] 🚩 REWORK FLAGS'), TE.indexOf('let last = performance.now()'));
  assert.doesNotMatch(rw, /propBlock|pieceBlockers|addBox|addCirc/);
  assert.match(rw, /CO\.w2t\(t\.x, t\.z\)/);
  assert.match(rw, /color: ui\.rwColor/);
  assert.match(TE, /if \(id\.startsWith\(RW\)\) \{ ov && ov\.rework \? PIECES\.set\(id, ov\) : PIECES\.delete\(id\)/);
});

test('server: non-owners never see flags; terrain_put keeps flag strings + @ overrides', async () => {
  const { cleanRework, stripRework, isReworkId, RW_COLORS } = await import('../supabase/functions/pvp/rework.ts');
  const pieces = { '!rw_abcd1234': { rework: 1, num: 1, x: 1, y: 2, z: 3, r: 80, color: 'blue', note: 'town' }, '@foot/plaza_v2_shops/plaza_shop_crew': { h: 1 }, '+abcd12': { t: 1, x: 0, y: 0, z: 0, ry: 0 }, 'foot/x#p1': { dx: 1 } };
  const pub = stripRework(pieces);
  assert.deepEqual(Object.keys(pub).sort(), ['+abcd12', '@foot/plaza_v2_shops/plaza_shop_crew', 'foot/x#p1']);
  assert.ok(isReworkId('!rw_x') && !isReworkId('@foot/a'));
  assert.deepEqual([...RW_COLORS], ['red', 'blue', 'green', 'gold', 'purple', 'orange', 'cyan', 'white']);
  for (const c of RW_COLORS) assert.equal(cleanRework('!rw_abcd1234', { rework: 1, color: c }).color, c); // every color persists
  const r = cleanRework('!rw_abcd1234', { rework: 1, num: 3, x: -605, y: 17, z: -69.5, lx: 20.5, lz: -35, r: 999, note: 'x'.repeat(300), part: 'PLAZA SHOP UPGRADES', partId: '@foot/plaza_v2_shops/plaza_shop_upgrades', at: 1, color: 'magenta' });
  assert.equal(r.r, 160); assert.equal(r.note.length, 140); assert.equal(r.color, 'red'); assert.equal(r.part, 'PLAZA SHOP UPGRADES'); assert.equal(r.partId, '@foot/plaza_v2_shops/plaza_shop_upgrades'); assert.equal(r.lx, 20.5);
  assert.equal(cleanRework('!rw_bad id', { rework: 1 }), null);
  assert.equal(cleanRework('!rw_abcd1234', { h: 1 }), null);
  const I = src('supabase/functions/pvp/index.ts');
  assert.match(I, /const pieces = who\?\.owner \? \(data\?\.pieces \?\? \{\}\) : stripRework\(/);
  assert.match(I, /if \(isReworkId\(id\)\) \{ const rw = cleanRework\(id, v\)/);
  assert.ok(I.indexOf('if (isReworkId(id))') < I.indexOf('if (id[0] === "+") { const t'));
  assert.match(I, /pieces\[id\] = v\.h \? \{ h: 1 \} : \{ dx:/); // '@' object overrides use the generic move / hide record
});

test('tools/read_rework_flags.mjs prints color, number, radius and town coords', async () => {
  const { reworkFlags, formatFlag } = await import('../tools/read_rework_flags.mjs');
  const fl = reworkFlags({ '!rw_b': { rework: 1, num: 2, r: 60, lx: 10, lz: -4, x: 1, z: 2, y: 3, color: 'blue', part: 'PLAZA', note: 'redo' }, '!rw_a': { rework: 1, num: 1, r: 0, color: 'gold' }, '@x': { h: 1 } });
  assert.equal(fl.length, 2); assert.equal(fl[0].num, 1);
  assert.match(formatFlag(fl[1]), /^\[BLUE #2\] r=60m at town\(10\.0, -4\.0\)/);
  assert.match(formatFlag(fl[0]), /^\[GOLD #1\] r=0m \(PIN\)/);
});

test('inventory: weapons give like a fish (049 + inv_gift gid + UI)', () => {
  const S = src('supabase/migrations/049_gift_weapons.sql');
  assert.match(S, /create or replace function public\.pvp_inv_gift\(p_from text, p_to text, p_item text, p_qty integer, p_gid uuid default null\)/);
  assert.match(S, /create or replace function public\.pvp_inv_take_gift/);
  assert.match(S, /'one weapon at a time'/);
  assert.match(S, /update pvp_gun_inst set player_id = b, place = 'bag'/); // the musket instance (+ its attachments) travels
  assert.match(S, /delete from pvp_inv_equip where player_id = a and item = p_item/);
  assert.match(S, /'carry_buy', 'gift_in'/); // gold-bought stays not-for-market at the receiver
  assert.match(S, /revoke all on function public\.pvp_inv_gift\(text, text, text, integer, uuid\) from public, anon, authenticated/);
  const T = src('supabase/functions/pvp/inventory.ts');
  assert.match(T, /p_gid: gid/);
  assert.match(T, /one weapon at a time/);
  const U = src('js/inventory/ui.js');
  assert.match(U, /function giveTo\(s, k, gInst = null\)/);
  assert.match(U, /gid: gInst\.gid/);
  assert.match(U, /<button data-a="give"\$\{!data\.flags\.gift \? ' disabled' : ''\}>GIVE TO A PIRATE ▾<\/button>`; \}/);
  assert.match(U, /const wq = selE === 'sword' \|\| selE === 'musket'/); // equipped weapons can be given too
  assert.match(U, /bought with gold · can give to pirates/);
  assert.match(U, /'one weapon at a time': 'GIVE ONE WEAPON AT A TIME'/);
  assert.doesNotMatch(src('supabase/functions/pvp/admin.ts'), /admin_give_weapon/); // BANKSY: inventory gifting, not an admin tool
});

test('t1785u: the added 3D street signs are gone, the 2D map streets stay', async () => {
  const G = await import('../js/islandGeography.js');
  assert.equal(G.STREET_SIGN_SPOTS.length, 0);
  assert.ok(G.ISLAND_STREETS.length > 0);
  assert.doesNotMatch(src('js/dock/index.js'), /createStreetSigns/);
  assert.doesNotMatch(src('js/dock/streetSigns.js'), /THREE|Mesh/);
});

test('Captain\'s Quarters untouched in v335 (Post owns it) + sw VERSION', () => {
  assert.ok(+(src('sw.js').match(/VERSION = 'pfp-v(\d+)'/) || [])[1] >= 335);
  assert.doesNotMatch(src('js/dock/shipHull.js'), /v335/);
});
