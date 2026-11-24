// [mobile-hud] BANKSY t2748u: Commodore bar must not cover the harbor pill / radar / player
// card on phones; settings sits left of the flush top-right minimap (safe-area aware).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = src('css/style.css');
const html = src('index.html');
const block = css.slice(css.indexOf('/* [mobile-hud] BANKSY t2748u'));

test('mobile-hud Commodore-bar block is still present (t2755u later returns the gear to the corner)', () => {
  assert.ok(block.length > 400, 't2748u CSS block missing');
  // v598 still contains the original left-of-minimap + flush-right rules;
  // t2755u (/* [gear-corner] */) is the last word for #hud-icons / #hud-tr right.
  assert.match(block, /#hud-tr \{[^}]*right: calc\(10px \+ var\(--safe-r, 0px\)\) !important/s);
  assert.ok(css.includes('/* [gear-corner] BANKSY t2755u'), 't2755u corner block missing');
  assert.ok(css.lastIndexOf('/* [gear-corner] BANKSY t2755u') > css.lastIndexOf('/* [mobile-hud] BANKSY t2748u'));
});

test('v598 still lays the radar and harbor pill out in #hud-tr (DOM order unchanged)', () => {
  assert.match(html, /id="hud-tr"[\s\S]*id="hud-icons"[\s\S]*id="btn-pause"[\s\S]*id="radar"/);
  assert.match(block, /#hud-tr #radar \{[^}]*grid-column: 2/s);
  assert.match(block, /#hud-tr #hb-hub-btn \{/);
});

test('Commodore bar is centred with a max width; portrait stacks below the HUD row', () => {
  assert.match(css, /#pvp-boss-bar \{/);
  assert.match(block, /#pvp-boss-bar \{[^}]*left: 50%;[^}]*transform: translateX\(-50%\)/s);
  assert.match(block, /#pvp-boss-bar \{[^}]*width: min\(300px, calc\(100vw - 24px - var\(--safe-l, 0px\) - var\(--safe-r, 0px\)\)\)/s);
  assert.match(block, /top: calc\(var\(--safe-t, env\(safe-area-inset-top, 0px\)\) \+ 160px\)/);
  // the old full-bleed phone rule is no longer the last word
  const lastBossWidth = [...css.matchAll(/#pvp-boss-bar \{[^}]*width: ([^;]+);/gs)].at(-1);
  assert.ok(lastBossWidth, 'boss width rule');
  assert.doesNotMatch(lastBossWidth[1], /100vw - 132px/);
});

test('portrait 390 and landscape 844 models leave a gap between the bar, pill, radar, card and gear', () => {
  const overlap = (a, b, pad = 0.5) => !(a.x + a.w <= b.x + pad || b.x + b.w <= a.x + pad || a.y + a.h <= b.y + pad || b.y + b.h <= a.y + pad);
  const box = (x, y, w, h) => ({ x, y, w, h });

  // portrait 390: radar 104 flush right (8px), settings 32 + 6px gap, pill under radar, bar at y=160 w=300 centred
  const p = {
    vw: 390,
    radar: box(390 - 8 - 104, 6, 104, 104),
    gear: box(390 - 8 - 104 - 6 - 32, 6, 32, 32),
    pill: box(390 - 8 - 117, 6 + 104 + 5, 117, 26),
    card: box(8, 8, 152, 44),
    bar: box((390 - 300) / 2, 220, 300, 27),
  };
  assert.ok(p.radar.x + p.radar.w === 382, 'radar flush right');
  assert.ok(p.gear.x + p.gear.w + 6 === p.radar.x, 'gear just left of radar');
  for (const [a, b] of [['bar','pill'],['bar','radar'],['bar','card'],['bar','gear'],['gear','radar'],['card','radar'],['card','gear'],['card','pill']]) {
    assert.equal(overlap(p[a], p[b]), false, `portrait ${a} overlaps ${b}`);
  }

  // landscape 844x390: radar 92 flush right, bar 360 centred at y=52 (middle gap), captain ~162 wide
  const barW = Math.min(360, 844 - 320);
  const l = {
    radar: box(844 - 8 - 92, 6, 92, 92),
    gear: box(844 - 8 - 92 - 6 - 32, 6, 32, 32),
    pill: box(844 - 8 - 124, 6 + 92 + 5, 124, 30),
    card: box(14, 12, 162, 44),
    bar: box((844 - barW) / 2, 52, barW, 34),
  };
  assert.ok(l.radar.x + l.radar.w === 836, 'landscape radar flush right');
  for (const [a, b] of [['bar','pill'],['bar','radar'],['bar','card'],['bar','gear'],['gear','radar'],['card','radar'],['card','gear'],['card','pill']]) {
    assert.equal(overlap(l[a], l[b]), false, `landscape ${a} overlaps ${b}`);
  }
});
