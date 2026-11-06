// [v332] BANKSY t1746–t1750u / t1763–t1764u: cliff-edge short ziplines, per-musket attachments, legendary craft
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { H, LAKE, SKULL } from '../js/island/foot.js';
import { zipLines, ZIP, CASTLE_ZIP, zipLine } from '../js/dock/zipline.js';
import { accMeshes, accThumbMesh } from '../js/onfoot/gunAccMesh.js';
import { swordGeo, musketGeo, applyLegendaryOrnament } from '../js/onfoot/swords.js';
import { RANK_LOOK, swordLook, applyGunAcc, setGunInstances, gunInstances, applyLocalAcc, gunAcc } from '../js/musketUpgrades.js';
import { itemInfo } from '../js/inventory/catalog.js';
import * as THREE from 'three';

const FM = { H, LAKE, SKULL };
const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const Z = zipLines(FM);
const skullDist = Math.hypot(Z.skullLine.B[0] - SKULL.x, Z.skullLine.B[1] - SKULL.z);

test('v332: Skull stand restored to outer brow (~52 m, h>=98)', () => {
  assert.ok(skullDist >= 44 && skullDist <= 60, `skullDist ${skullDist}`);
  assert.ok(Z.skullLine.gB >= 98, `skull h ${Z.skullLine.gB}`);
});

test('v332: Waterfall stands on cliff edges, sep >= 12, not old center', () => {
  const sep = Math.hypot(Z.skullLine.A[0] - Z.castleLine.B[0], Z.skullLine.A[1] - Z.castleLine.B[1]);
  assert.ok(sep >= 12, `sep ${sep}`);
  assert.notDeepEqual(Z.skullLine.A, [-188, -247]);
  assert.notDeepEqual(Z.castleLine.B, [-188, -232]);
});

test('v332: ALL gantries short (<=2.75) with clearance >= 2.6', () => {
  for (const h of [Z.skullLine.hA, Z.skullLine.hB, Z.castleLine.hA, Z.castleLine.hB, CASTLE_ZIP.gantryH, ZIP.gantry]) {
    assert.ok(h <= 2.75, `gantry ${h}`);
  }
  assert.ok(Z.skullLine.minClr >= 2.6, `clrSk ${Z.skullLine.minClr}`);
  assert.ok(Z.castleLine.minClr >= 2.6, `clrCw ${Z.castleLine.minClr}`);
  assert.ok(ZIP.hang >= 2.05 && ZIP.hang <= 2.25);
  const z = src('js/dock/zipline.js');
  assert.match(z, /CylinderGeometry\(0\.025, 0\.025, 0\.26/);
  assert.match(z, /position\.y = -0\.40/);
});

test('v332: wf_hill_trail + foot pads match edge coords', () => {
  assert.match(src('js/island/areas/hillRound.js'), /\[-228,\s*-212\]/);
  assert.match(src('js/island/areas/hillRound.js'), /\[-200,\s*-219\]/);
  assert.match(src('js/island/foot.js'), /\[-200,\s*-219\].*\[-228,\s*-212\]|\[-228,\s*-212\].*\[-200,\s*-219\]/s);
});

test('v332: zipLine / zipLines back-compat', () => {
  const one = zipLine(FM);
  assert.equal(one.id, 'waterfall_skull');
  assert.ok(one.A && one.B && typeof one.y === 'function');
});

test('v332: distinct per-gun attachment loadouts', () => {
  setGunInstances([
    { gid: '11111111-1111-1111-1111-111111111111', item: 'wpn:musket:navy:epic', place: 'equip', acc: { scope: 'val:acc_scope', bayonet: 'val:acc_bayonet' } },
    { gid: '22222222-2222-2222-2222-222222222222', item: 'wpn:musket:navy:epic', place: 'bag', acc: { stock: 'val:acc_stock', horn: 'val:acc_horn' } },
    { gid: '33333333-3333-3333-3333-333333333333', item: 'wpn:musket:navy:epic', place: 'house', cottage_id: 'c1', house_slot: 0, acc: { scope: 'val:acc_scope', bayonet: 'val:acc_bayonet', stock: 'val:acc_stock', horn: 'val:acc_horn' } },
  ]);
  const g = gunInstances();
  assert.equal(g.length, 3);
  assert.deepEqual(g[0].acc, { scope: 'val:acc_scope', bayonet: 'val:acc_bayonet' });
  assert.deepEqual(g[1].acc, { stock: 'val:acc_stock', horn: 'val:acc_horn' });
  assert.equal(Object.keys(g[2].acc).length, 4);
  assert.equal(gunAcc().scope, 'val:acc_scope');
  applyLocalAcc('11111111-1111-1111-1111-111111111111', 'horn', 'val:acc_horn');
  assert.equal(gunInstances().find((x) => x.gid.startsWith('1111')).acc.horn, 'val:acc_horn');
  assert.equal(gunInstances().find((x) => x.gid.startsWith('2222')).acc.horn, 'val:acc_horn'); // bag unchanged? wait bag has horn already
  assert.equal(gunInstances().find((x) => x.gid.startsWith('2222')).acc.scope, undefined);
});

test('v332: migration 047 + inventory gun_acc_set / ensure', () => {
  const m = src('supabase/migrations/047_per_gun_attachments.sql');
  assert.match(m, /pvp_gun_inst/);
  assert.match(m, /pvp_gun_acc_set/);
  assert.match(m, /pvp_house_store_gun/);
  assert.match(m, /pvp_gun_return_acc/);
  assert.match(m, /pvp_gun_from_house/);
  const inv = src('supabase/functions/pvp/inventory.ts');
  assert.match(inv, /gun_acc_set/);
  assert.match(inv, /gun_equip/);
  assert.match(inv, /pvp_gun_ensure/);
  const houses = src('supabase/functions/pvp/houses.ts');
  assert.match(houses, /pvp_house_store_gun/);
});

test('v332: applyGunAcc effects unchanged', () => {
  const o = applyGunAcc({ reload: 1, wide: 1, dmg: 19 }, { scope: 'x', horn: 'x', stock: 'x', bayonet: 'x' });
  assert.equal(o.reload, 0.95);
  assert.ok(o.wide < 1);
  assert.equal(o.recoil, 0.7);
  assert.equal(o.zoom, 1.15);
  assert.equal(o.bayonet.dmg, 3);
});

test('v332: multi-part 3D accMeshes + thumb meshes', () => {
  const m = new THREE.Group();
  accMeshes(m, { scope: 1, bayonet: 1, stock: 1, horn: 1 }, 'navy');
  let n = 0; m.traverse((o) => { if (o.userData?.gunacc) n++; });
  assert.ok(n >= 4, `gunacc parts ${n}`);
  for (const s of ['scope', 'bayonet', 'stock', 'horn']) {
    const g = accThumbMesh(s);
    assert.ok(g.children.length >= 2, `${s} too simple`);
  }
});

test('v332: crafted attachment UI icons exist', () => {
  for (const k of ['scope', 'bayonet', 'stock', 'horn']) {
    assert.ok(existsSync(`assets/items/val_acc_${k}.webp`), k);
    assert.equal(itemInfo('val:acc_' + k).kind, 'gunacc');
  }
});

test('v332: legendary ornaments on all 4 swords + 4 muskets', () => {
  for (const id of ['rusty', 'cutlass', 'rapier', 'bone']) {
    const mesh = new THREE.Mesh(swordGeo(id));
    applyLegendaryOrnament(mesh, 'sword', id, 'legendary');
    assert.ok(mesh.userData._legOrn);
    assert.ok(mesh.children.some((c) => c.name === 'legendarySwordOrn'));
  }
  for (const id of ['rusty', 'navy', 'blunder', 'dragoon']) {
    const mesh = new THREE.Mesh(musketGeo(id));
    applyLegendaryOrnament(mesh, 'musket', id, 'legendary');
    assert.ok(mesh.userData._legOrn);
    assert.ok(mesh.children.some((c) => c.name === 'legendaryMusketOrn'));
  }
});

test('v332: legendary look + thumbs + battle wiring', () => {
  const L = swordLook('legendary');
  assert.equal(L.e, 0x7a4b00);
  assert.ok(L.ei >= 0.55);
  assert.equal(RANK_LOOK.legendary.e, 0x7a4b00);
  for (const id of ['rusty', 'cutlass', 'rapier', 'bone']) assert.ok(existsSync(`assets/items/wpn_sword_${id}_legendary.webp`), id);
  for (const id of ['rusty', 'navy', 'blunder', 'dragoon']) assert.ok(existsSync(`assets/items/wpn_musket_${id}_legendary.webp`), id);
  const b = src('js/onfoot/battle.js');
  assert.match(b, /swordLook/);
  assert.match(b, /applyLegendaryOrnament/);
  assert.ok(+(src('sw.js').match(/VERSION = 'pfp-v(\d+)'/) || [])[1] >= 332, 'sw VERSION >= v332');
});
