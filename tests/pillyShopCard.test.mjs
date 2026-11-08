import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pillyShopCard } from '../js/pillyShopCard.js';
const doc = { createElement: tag => ({ tagName: tag, dataset: {}, children: [], appendChild(x) { this.children.push(x); } }) };
function make(state) { let opened = 0; const card = pillyShopCard({ state, openStore() { opened++; } }, doc); return { card, button: card.children[0], opened: () => opened }; }
test('Pilly is a normal item card with icon, price and a buy action into existing panel', () => {
  const { card, button, opened } = make({ avail: true, owned: false });
  assert.match(card.className, /ishop-card/); assert.equal(card.dataset.id, 'companion:pilly');
  assert.match(card.innerHTML, /💊/); assert.match(card.innerHTML, /5,000/);
  assert.equal(button.textContent, 'BUY PILLY · 5,000 🪙'); assert.equal(button.disabled, false);
  button.onclick(); assert.equal(opened(), 1);
});
test('owned Pilly directs upgrades to the ship hull, never the store', () => {
  const { card, button } = make({ avail: true, owned: true, lv: 4 });
  assert.match(card.innerHTML, /Upgrade Pilly in your ship hull or inventory/); assert.equal(button.textContent, 'OWNED'); assert.equal(button.disabled, true);
});
test('unavailable and loading cannot offer a purchase', () => {
  for (const [avail, label] of [[false, 'RETRY PILLY'], [null, 'LOADING…']]) {
    const { button } = make({ avail }); assert.equal(button.textContent, label); assert.equal(button.disabled, avail == null);
  }
});
test('walk-in counter still uses the shared pets UI and refreshes its Pilly card', () => {
  const text = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  assert.match(text('js/dock/layout.js'), /vendor:'pets'/);
  assert.match(text('js/islandShop.js'), /grid.append\(card, petPillyCard\(\)\)/);
  assert.match(text('js/islandShop.js'), /if \(V.pets\) return renderPetStore\(\)/);
  assert.match(text('js/dock/index.js'), /openStore: \(\) => pillyS.open\(\{ storeOnly: true \}\)/);
  assert.match(text('js/islandShop.js'), /opts.vendor === 'pets'.*PFP_PILLY\?\.refresh/);
  assert.match(text('js/islandShop.js'), /addEventListener\('pfp-pilly-change'/);
  assert.doesNotMatch(text('js/islandShop.js'), /PILLY COMPANION ·/);
  assert.match(text('js/preloadList.js'), /js\/pillyShopCard.js/);
  assert.match(text('sw.js'), /js\/pillyShopCard.js/);
});
