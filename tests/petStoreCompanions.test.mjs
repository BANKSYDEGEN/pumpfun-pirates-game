import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PILLY_ENABLED } from '../js/features.js';
import { GEAR_ITEMS, VENDORS } from '../js/shopCatalog.js';
import { itemInfo } from '../js/inventory/catalog.js';
const text = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
test('Parrot display rename retains the purchase and inventory keys', () => {
  const parrot = GEAR_ITEMS.find(i => i.id === 'parrot_green');
  assert.equal(parrot.label, 'PARROT');
  assert.equal(parrot.slot, 'parrot');
  assert.equal(parrot.price, 2000);
  assert.equal(itemInfo('par:00000000-0000-4000-8000-000000000001').name, 'Parrot');
  assert.doesNotMatch(VENDORS.pets.sub, /base parrots/i);
  assert.doesNotMatch(text('js/parrotsPanel.js'), /base parrot/i);
});
test('Pilly emergency pause preserves the animated companion asset without enabling it', () => {
  assert.equal(PILLY_ENABLED, false);
  const b = readFileSync(new URL('../assets/pirates/items/v7/pet_pilly.glb', import.meta.url));
  const gl = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
  for (const clip of ['Idle', 'Walk', 'Run', 'Wave']) assert.ok(gl.animations.some(a => a.name === clip), clip);
  assert.match(text('js/onfoot/pilly.js'), /export const PILLY_PRICE = 5000/);
  assert.match(text('js/onfoot/pilly.js'), /Math\.min\(10,/);
  assert.match(text('js/onfoot/pilly.js'), /new THREE\.CanvasTexture\(cv\)/);
  assert.doesNotMatch(text('js/islandShop.js'), /BUY PILLY|pillyShopCard/);
  assert.match(text('supabase/functions/pvp/pets.ts'), /db\.rpc\("pvp_pilly_op"/);
  assert.match(text('supabase/functions/pvp/pets.ts'), /"pilly_buy"/);
});

test('Pilly is positioned before distance-culling so load and teleport cannot hide it forever', () => {
  const source = text('js/onfoot/pilly.js');
  assert.ok(source.indexOf('root.position.set(c.x,') < source.indexOf('camera.position.distanceToSquared(root.position)'));
});

test('Pilly purchase panel stacks above the pet store overlay', () => {
  const z = +text('js/onfoot/pilly.js').match(/#pilly-panel\{[^}]*z-index:(\d+)/)[1];
  const shop = +text('css/islandShop.css').match(/z-index:\s*(\d+)/)[1];
  assert.ok(z > shop);
});
