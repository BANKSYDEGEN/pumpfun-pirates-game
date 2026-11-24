// [gear-corner] BANKSY t2755u: settings gear is back in the top-right corner
// (right of the minimap), with a gutter sized to the button so it does not clip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = src('css/style.css');
const marker = '/* [gear-corner] BANKSY t2755u';
const block = css.slice(css.indexOf(marker));

test('gear-corner block is present and is the last #hud-icons / #hud-tr-right override', () => {
  assert.ok(block.length > 400, 't2755u CSS block missing');
  assert.ok(css.lastIndexOf(marker) > css.lastIndexOf('/* [mobile-hud] BANKSY t2748u'), 'corner block must follow the v598 left-of-minimap rules');
  assert.ok(css.lastIndexOf(marker) > css.lastIndexOf('/* [mobile-hud] BANKSY t2749u'), 'corner block must follow v599 glyph-centering');
  const lastIcons = [...css.matchAll(/#hud-icons \{[^}]*position:\s*([^;]+);/gs)].at(-1);
  assert.ok(lastIcons, 'no #hud-icons position rule');
  assert.match(lastIcons[1], /fixed\s*!important/);
  const lastRight = [...css.matchAll(/#hud-icons \{[^}]*right:\s*([^;]+);/gs)].at(-1);
  assert.ok(lastRight, 'no #hud-icons right rule');
  assert.match(lastRight[1], /6px \+ var\(--safe-r/);
  const lastTrRight = [...css.matchAll(/#hud-tr \{[^}]*right: calc\(([^)]+)\)/g)].at(-1);
  assert.ok(lastTrRight, 'no #hud-tr right rule');
  // last (narrow-phone) gutter is 6 + 30 + 6 + safe-r; earlier rules in the same
  // block use 50px (desktop) and 44px (phone). None of them may be the flush 8px.
  assert.doesNotMatch(lastTrRight[1], /^8px \+ var\(--safe-r/);
  assert.match(lastTrRight[1], /var\(--safe-r/);
});

test('settings is position:fixed in the top-right corner, not in the #hud-tr grid', () => {
  assert.match(block, /#hud-icons \{[^}]*position: fixed !important/s);
  assert.match(block, /#hud-icons \{[^}]*left: auto !important/s);
  assert.match(block, /#hud-icons \{[^}]*right: calc\(6px \+ var\(--safe-r, 0px\)\) !important/s);
  assert.match(block, /#hud-icons \{[^}]*transform: none !important/s);
  assert.match(block, /#hud-tr \{[^}]*display: flex !important/s);
  assert.match(block, /#hud-tr \{[^}]*flex-direction: column/s);
  assert.match(block, /#hud-icons > #btn-pause \{ width: 36px; height: 36px/);
});

test('v599 glyph centering is kept (padding 0, letter-spacing 0, flex centred)', () => {
  const g = css.slice(css.indexOf('/* [mobile-hud] BANKSY t2749u'));
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*display: flex !important/s);
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*align-items: center/s);
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*justify-content: center/s);
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*padding: 0 !important/s);
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*letter-spacing: 0 !important/s);
});

test('portrait 400 and landscape 860 models put the gear in the corner with no overlaps', () => {
  const overlap = (a, b, pad = 0.5) => !(a.x + a.w <= b.x + pad || b.x + b.w <= a.x + pad || a.y + a.h <= b.y + pad || b.y + b.h <= a.y + pad);
  const box = (x, y, w, h) => ({ x, y, w, h });

  // portrait 400: 32px gear at right 6px, 6px gap, radar 104, #hud-tr right = 44px
  const p = {
    gear: box(400 - 6 - 32, 6, 32, 32),
    radar: box(400 - 44 - 104, 6, 104, 104),
    pill: box(400 - 44 - 117, 6 + 104 + 5, 117, 26),
    card: box(8, 8, 152, 44),
    bar: box((400 - 300) / 2, 220, 300, 27),
    rotate: box((400 - 280) / 2, 252, 280, 32),
  };
  assert.equal(p.gear.x + p.gear.w, 394, 'gear 6px from the right edge');
  assert.equal(p.radar.x + p.radar.w, 356, 'radar ends at the 44px gutter');
  assert.equal(p.gear.x - (p.radar.x + p.radar.w), 6, '6px gap between radar and gear');
  assert.ok(p.gear.x > p.radar.x + p.radar.w, 'gear is to the right of the radar, in the corner');
  for (const [a, b] of [['bar','pill'],['bar','radar'],['bar','card'],['bar','gear'],['gear','radar'],['card','radar'],['card','gear'],['card','pill'],['rotate','hb-hub-btn'],['rotate','radar'],['rotate','captain'],['rotate','gear'],['rotate','bar']].filter(([a]) => a !== 'rotate' || true)) {
    const A = a === 'hb-hub-btn' ? 'pill' : a === 'captain' ? 'card' : a === 'gear' ? 'gear' : a;
    const B = b === 'hb-hub-btn' ? 'pill' : b === 'captain' ? 'card' : b === 'gear' ? 'gear' : b;
    if (!(A in p) || !(B in p)) continue;
    assert.equal(overlap(p[A], p[B]), false, `portrait ${a} overlaps ${b}`);
  }

  // landscape 860x400: 32px gear (coarse / short height), radar 92, bar 360 at y=52
  const barW = Math.min(360, 860 - 320);
  const l = {
    gear: box(860 - 6 - 32, 6, 32, 32),
    radar: box(860 - 44 - 92, 6, 92, 92),
    pill: box(860 - 44 - 124, 6 + 92 + 5, 124, 30),
    card: box(14, 12, 162, 44),
    bar: box((860 - barW) / 2, 52, barW, 34),
  };
  assert.equal(l.gear.x + l.gear.w, 854, 'landscape gear 6px from the right');
  assert.ok(l.gear.x > l.radar.x + l.radar.w, 'landscape gear is to the right of the radar');
  for (const [a, b] of [['bar','pill'],['bar','radar'],['bar','card'],['bar','gear'],['gear','radar'],['card','radar'],['card','gear'],['card','pill']]) {
    assert.equal(overlap(l[a], l[b]), false, `landscape ${a} overlaps ${b}`);
  }
});

test('on phones the SEAS CROWDED chip is centred below the HUD row and above the rotate hint', () => {
  assert.match(css, /#seas-crowded-chip \{[^}]*top: calc\(64px \+ var\(--safe-t\)/s); // desktop unchanged
  const chipBlock = css.slice(css.indexOf('/* [gear-corner] BANKSY t2755u: on phones the SEAS CROWDED'));
  assert.ok(chipBlock.length > 200, 'phone SEAS CROWDED CSS block missing');
  assert.match(chipBlock, /#seas-crowded-chip \{[^}]*top: calc\(148px \+ var\(--safe-t, 0px\)\)/s);
  assert.match(chipBlock, /#seas-crowded-chip \{ top: calc\(174px \+ var\(--safe-t, 0px\)\)/);
  assert.match(chipBlock, /#dk-safe, #dk-islesafe,[^}]*top: calc\(142px \+ var\(--safe-t, 0px\)\) !important/s);
  assert.match(chipBlock, /#seas-crowded-chip \{[^}]*left: 50%/s);
  assert.match(chipBlock, /#seas-crowded-chip \{[^}]*transform: translateX\(-50%\)/s);
  const lastChipTop = [...css.matchAll(/#seas-crowded-chip \{[^}]*top: ([^;]+);/gs)].at(-1);
  assert.ok(lastChipTop); assert.match(lastChipTop[1], /174px \+ var\(--safe-t/);
  const lastRotate = [...css.matchAll(/#rotate\.show \{[^}]*top: ([^;]+);/gs)].at(-1);
  assert.ok(lastRotate); assert.match(lastRotate[1], /252px/);
});

test('portrait 400 and landscape 860 models keep the chip clear of inventory, card, NO FIRING, PLAY, rotate and the boss bar', () => {
  const overlap = (a, b, pad = 0.5) => !(a.x + a.w <= b.x + pad || b.x + b.w <= a.x + pad || a.y + a.h <= b.y + pad || b.y + b.h <= a.y + pad);
  const box = (x, y, w, h) => ({ x, y, w, h });

  const chipW = Math.min(320, 400 - 24);
  const p = {
    card: box(8, 8, 152, 44),
    inv: box(8, 55, 130, 24),
    gear: box(400 - 6 - 32, 6, 32, 32),
    radar: box(400 - 44 - 104, 6, 104, 104),
    pill: box(400 - 44 - 117, 6 + 104 + 5, 117, 26),
    fire: box((400 - 160) / 2, 142, 160, 24),
    chip: box((400 - chipW) / 2, 174, chipW, 36),
    bar: box((400 - 300) / 2, 220, 300, 27),
    rotate: box((400 - 280) / 2, 252, 280, 32),
  };
  assert.ok(p.fire.y >= p.pill.y + p.pill.h, 'NO FIRING is below the PLAY · HARBOR row');
  assert.ok(p.fire.y + p.fire.h <= p.chip.y, 'NO FIRING is above SEAS CROWDED');
  assert.ok(p.chip.y >= p.pill.y + p.pill.h, 'chip is below the PLAY · HARBOR row');
  assert.ok(p.chip.y >= p.fire.y + p.fire.h, 'chip is below NO FIRING');
  assert.ok(p.chip.y >= p.inv.y + p.inv.h, 'chip is below INVENTORY');
  assert.ok(p.chip.y + p.chip.h <= p.rotate.y, 'chip is above the rotate hint');
  assert.ok(p.chip.y + p.chip.h <= p.bar.y, 'chip is above the Commodore bar');
  for (const [a, b] of [
    ['fire','pill'],['fire','card'],['fire','inv'],['fire','radar'],['fire','gear'],['fire','rotate'],['fire','bar'],
    ['chip','card'],['chip','inv'],['chip','fire'],['chip','pill'],['chip','radar'],
    ['chip','gear'],['chip','rotate'],['chip','bar'],
    ['bar','pill'],['bar','radar'],['bar','card'],['bar','gear'],['bar','rotate'],
    ['rotate','pill'],['rotate','radar'],['rotate','card'],['rotate','gear'],
    ['gear','radar'],['card','radar'],['card','gear'],['card','pill'],
  ]) {
    assert.equal(overlap(p[a], p[b]), false, `portrait ${a} overlaps ${b}`);
  }

  const lChipW = Math.min(360, 860 - 24);
  const l = {
    card: box(14, 12, 162, 44),
    inv: box(14, 59, 130, 24),
    gear: box(860 - 6 - 32, 6, 32, 32),
    radar: box(860 - 44 - 92, 6, 92, 92),
    pill: box(860 - 44 - 124, 6 + 92 + 5, 124, 30),
    chip: box((860 - lChipW) / 2, 148, lChipW, 36),
    bar: box((860 - 360) / 2, 52, 360, 34),
  };
  assert.ok(l.chip.y >= l.pill.y + l.pill.h, 'landscape chip is below PLAY · HARBOR');
  assert.ok(l.chip.y >= l.inv.y + l.inv.h, 'landscape chip is below INVENTORY');
  for (const [a, b] of [
    ['chip','card'],['chip','inv'],['chip','pill'],['chip','radar'],['chip','gear'],['chip','bar'],
    ['bar','pill'],['bar','radar'],['bar','card'],['bar','gear'],
    ['gear','radar'],['card','radar'],['card','gear'],['card','pill'],
  ]) {
    assert.equal(overlap(l[a], l[b]), false, `landscape ${a} overlaps ${b}`);
  }
});
