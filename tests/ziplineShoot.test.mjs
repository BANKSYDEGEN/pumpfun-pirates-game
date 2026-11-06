// [zipline-shoot] BANKSY t491u: aim + shoot while riding the zipline
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('zipline.js: one-hand grip leaves the free weapon arm alone', () => {
  const z = src('js/dock/zipline.js');
  assert.match(z, /zp\.free/);
  assert.match(z, /free === s\) continue/);
  assert.match(z, /upperarm\.' \+ free/);
  assert.match(z, /export function zipGrip\(pirate, on, dt, opts\)/);
  assert.match(z, /opts && 'free' in opts/);
  assert.match(z, /zipline-shoot/);
});

test('zipline.js: free-look + aim while sliding (no forced cable yaw when aiming)', () => {
  const z = src('js/dock/zipline.js');
  assert.match(z, /const aiming = W\.faceYaw != null \|\| W\.zipAim/);
  assert.match(z, /if \(aiming && W\.faceYaw != null\) W\.yaw = W\.faceYaw/);
  assert.match(z, /lookRecent/);
  assert.match(z, /!aiming && !lookRecent/);
});

test('walker.js: ride path honors faceYaw + TPS camHook (ADS on cable)', () => {
  const w = src('js/onfoot/walker.js');
  // both the mid-ride branch and the landing ('done') branch
  const hooks = [...w.matchAll(/if \(w\.camHook\) \{ w\.camHook\(dt\); return; \} \/\/ \[zipline-shoot\]/g)];
  assert.equal(hooks.length, 2, 'ride + done must both call camHook');
  assert.match(w, /if \(w\.faceYaw != null\) w\.yaw = w\.faceYaw; \/\/ \[zipline-shoot\] face the crosshair while sliding/);
  assert.match(w, /keep aim facing through dismount/);
});

test('battle.js: GUN on zipline sets one-hand free + zipAim; TPS stays on', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /import \{ zipGrip \} from '\.\.\/dock\/zipline\.js'/);
  assert.match(b, /W\.zipAim = onZip && me\.zone === Z_RANGE/);
  assert.match(b, /zipGrip\(pirate, true, 0, \{ free: me\.zone === Z_RANGE \? 'R' : null \}\)/);
  assert.match(b, /tps\?\.tick\(dt, me\.zone === Z_RANGE\)/);
  assert.match(b, /zipState = \(R\) => R\?\.v4\?\._zip/);
  assert.match(b, /const zp = R\?\.v4\?\._zip \|\| null, zipOne = !!\(zp && zp\.w > 0\.2 && zp\.free === 'R'\)/);
  assert.match(b, /if \(!zipOne\)/);
  assert.match(b, /else if \(gr && zipOne\)/);
});

test('battle.js: elevated peers (fy) are aimable / hittable at cable height', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /peerFeetY = \(p\) => \(p\.fy != null \? p\.fy/);
  assert.match(b, /const py = peerFeetY\(p\); if \(a > 0 && vOk\(a, py - 0\.2, py \+ 2\.1\)\)/);
  assert.match(b, /peerFeetY\(p\) \+ 1\.2/);
});

test('battle.js: peers on a cable with musket get the same one-hand grip', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /if \(p\.fy != null\) \{ zipGrip\(p\.pirate, true, 0, \{ free: s\.zone === Z_RANGE \? 'R' : null \}\); \}/);
});

test('battle.js: leave() clears zipAim + free hand', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /walker\.w\.zipAim = false/);
  assert.match(b, /const zp = zipState\(mineR\); if \(zp\) zp\.free = null/);
});

test('stance + attack gates still work on foot/zipline (no ride early-return in attack)', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /function attack\(\) \{[\s\S]*?if \(!me\.zone \|\| me\.down > 0 \|\| me\.cool > 0 \|\| !walker\.active\) return false;/);
  assert.doesNotMatch(b, /function attack\(\) \{[\s\S]*?w\.ride[\s\S]*?return false/);
  assert.match(b, /if \(e\.code === 'Tab'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); cycleStance\(\); return; \}/);
});

test('both ziplines (waterfall↔skull + castle↔waterfall) share createZipline / zipGrip', () => {
  const z = src('js/dock/zipline.js');
  assert.match(z, /skullLine/);
  assert.match(z, /castleLine/);
  assert.match(z, /linesSpec = \[pack\.skullLine, pack\.castleLine\]/);
  assert.match(z, /export function createZipline/);
  // no second client zipline ride system
  const dock = src('js/dock/index.js');
  assert.match(dock, /createZipline/);
  assert.equal((dock.match(/createZipline/g) || []).length, 2); // import + call
});

test('safe-zone holster rules unchanged (auto-unarmed in sanctuary, practice shots OK with STANCES)', () => {
  const b = src('js/onfoot/battle.js');
  assert.match(b, /if \(isleSafe\._isleSafe && !me\.arena && me\.stance !== 0\) setStance\(0, true\)/);
  assert.match(b, /practice swings \/ shots only · 0 PvP damage/);
});
