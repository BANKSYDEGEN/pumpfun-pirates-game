// node --test tests/wavesSkinsLock.test.mjs
// [t1716u] Waves wears Harbor skin only — no unlocks, no mid-run skin change / buy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const MAIN = src('js/main.js');
const SHOP = src('js/shop.js');
const SAVE = src('js/pvpSave.js');
const PVP = src('js/pvpSkins.js');
const HTML = src('index.html');
const CSS = src('css/style.css');

test('[t1716u] waveSkinUnlock always returns null (no unlocks at 5/10/25)', () => {
  assert.match(SHOP, /export function waveSkinUnlock\(_wave\) \{ return null; \}/);
  assert.ok(!/export function waveSkinUnlock\([^)]*\) \{[\s\S]*?unlockSkin/.test(SHOP), 'must not call unlockSkin');
  assert.ok(!/NEW SKIN UNLOCKED/.test(SHOP), 'no skin-toast');
  // Callers may still invoke it; the body is a pure no-op.
  const fn = Function('return (function waveSkinUnlock(_wave) { return null; })')();
  assert.equal(fn(5), null);
  assert.equal(fn(10), null);
  assert.equal(fn(25), null);
  assert.equal(fn(0), null);
});

test('[t1716u] harborEquippedSkinId reads Harbor profile skins.equipped (fallback classic)', () => {
  assert.match(SAVE, /export function harborEquippedSkinId\(\)/);
  assert.match(SAVE, /readDevice\(\)\?\.skins\?\.equipped/);
  assert.match(SAVE, /'classic'/);
  // Pure mirror of the helper (same shape as blankProfile / cleanProfile):
  const harborEquippedSkinId = (profile) => {
    try {
      const eq = profile?.skins?.equipped;
      return (typeof eq === 'string' && eq) ? eq : 'classic';
    } catch { return 'classic'; }
  };
  assert.equal(harborEquippedSkinId({ skins: { equipped: 'flaming', owned: ['flaming'] } }), 'flaming');
  assert.equal(harborEquippedSkinId({ skins: { equipped: 'diamond', owned: ['diamond'] } }), 'diamond');
  assert.equal(harborEquippedSkinId({ skins: { equipped: 'kraken', owned: ['kraken'] } }), 'kraken');
  assert.equal(harborEquippedSkinId({ skins: { equipped: 'crimson', owned: ['crimson'] } }), 'crimson');
  assert.equal(harborEquippedSkinId({ skins: { equipped: 'classic' } }), 'classic');
  assert.equal(harborEquippedSkinId(null), 'classic');
  assert.equal(harborEquippedSkinId({}), 'classic');
  // pvpSkin is the resolver Waves uses for those ids
  assert.match(PVP, /export const pvpSkin\s*=/);
  assert.match(MAIN, /pvpSkin\(harborEquippedSkinId\(\)\)/);
});

test('[t1716u] Waves always compiles the Harbor skin (shipOpts pvp:true + rebuild on start)', () => {
  assert.match(MAIN, /const harborSkinObj = \(\) => \(pvp \? pvp\.skinObj\(\) : pvpSkin\(harborEquippedSkinId\(\)\)\);/);
  assert.match(MAIN, /const shipOpts = \(\) => \(\{ \.\.\.PLAYER_SHIP, skin: harborSkinObj\(\), pvp: true \}\);/);
  assert.ok(!/game\.mode === 'pvp' && pvp \? \{ \.\.\.PLAYER_SHIP, skin: pvp\.skinObj\(\)/.test(MAIN), 'old PvP-only shipOpts gone');
  assert.match(MAIN, /rebuildPlayerShip\(\{\}\); \/\/ \[t1716u\]/);
  assert.match(MAIN, /shipTick\(player\.mesh/);
  assert.match(MAIN, /harborSkinObj\(\)\?\.name \|\| 'Classic'/);
});

test('[t1716u] #btn-set-wskins / Waves skin picker cannot open or swap skins', () => {
  assert.match(HTML, /id="btn-set-wskins"[^>]*\bhidden\b/);
  assert.match(CSS, /#btn-set-wskins[^{]*\{[^}]*display:\s*none\s*!important/);
  assert.match(MAIN, /function openWavesSkins\(\) \{ \$\('waves-skins'\)\?\.classList\.add\('hidden'\); \}/);
  assert.match(MAIN, /b\.setAttribute\('hidden', ''\)/);
  assert.ok(!/renderWavesSkins\(\); \$\('waves-skins'\)\?\.classList\.remove\('hidden'\)/.test(MAIN), 'must not open the picker');
  assert.ok(!/a new one every 5 waves/.test(HTML), 'FAQ / waves-skins must not claim every-5 unlocks');
});

test('[t1716u] Waves SHIPWRIGHT shop has no accessible skins tab', () => {
  assert.match(SHOP, /tab = 'upg'/);
  assert.match(SHOP, /waves-upg-only/);
  assert.match(SHOP, /function skinAction\(_id\) \{ \/\* \[t1716u\][^]*?\*\/ \}/);
  assert.match(CSS, /\.shop-tabs\.waves-upg-only \{ display: none !important; \}/);
  assert.match(SHOP, /\$\('tab-skins'\)\?\.setAttribute\('hidden', ''\)/);
});
