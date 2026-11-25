// [gear-inv] BANKSY t2757u: settings sits on the INVENTORY row, just to the
// right of the pill; the minimap is flush top-right again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const css = src('css/style.css');
const html = src('index.html');
const js = src('js/dock/treasure.js');
const marker = '/* [gear-inv] BANKSY t2757u';
const block = css.slice(css.indexOf(marker));

test('gear-inv block is present and wins for #hud-icons position and #hud-tr right', () => {
  assert.ok(block.length > 300, 't2757u CSS block missing');
  assert.ok(css.lastIndexOf(marker) > css.lastIndexOf('/* [gear-corner] BANKSY t2755u'));
  const lastPos = [...css.matchAll(/#hud-icons \{[^}]*position:\s*([^;]+);/gs)].at(-1);
  assert.ok(lastPos); assert.match(lastPos[1], /relative\s*!important/);
  const lastTr = [...css.matchAll(/#hud-tr \{[^}]*right: calc\(([^)]+)\)/g)].at(-1);
  assert.ok(lastTr); assert.match(lastTr[1], /^8px \+ var\(--safe-r/);
});

test('HTML puts #hud-icons in #hud-inv-row; JS prepends INVENTORY into that row', () => {
  assert.match(html, /id="hud-inv-row"[\s\S]*id="hud-icons"[\s\S]*id="btn-pause"/);
  assert.match(html, /id="hud-tr"[\s\S]*id="radar"/);
  assert.doesNotMatch(html.slice(html.indexOf('id="hud-tr"'), html.indexOf('id="controls"')), /id="hud-icons"/);
  assert.match(js, /getElementById\('hud-inv-row'\)/);
  assert.match(js, /row\.insertBefore\(btn, row\.firstChild\)/);
});

test('the row is a flex line: INVENTORY then the ⚙, vertically centred, small gap', () => {
  assert.match(block, /#hud-inv-row \{[^}]*display: flex/s);
  assert.match(block, /#hud-inv-row \{[^}]*flex-direction: row/s);
  assert.match(block, /#hud-inv-row \{[^}]*align-items: center/s);
  assert.match(block, /#hud-inv-row \{[^}]*gap: 6px/s);
  assert.match(block, /#hud-inv-row #tm-btn \{[^}]*margin: 0 !important/s);
  assert.match(block, /#hud-inv-row #tm-btn \{[^}]*align-self: center !important/s);
  assert.match(block, /#hud-icons \{[^}]*position: relative !important/s);
});

test('v599 glyph centering is kept', () => {
  const g = css.slice(css.indexOf('/* [mobile-hud] BANKSY t2749u'));
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*display: flex !important/s);
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*align-items: center/s);
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*justify-content: center/s);
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*padding: 0 !important/s);
  assert.match(g, /#hud-icons > #btn-pause \{[^}]*letter-spacing: 0 !important/s);
});

test('portrait 400, landscape 860 and desktop 1280 models place the gear next to INVENTORY with a flush minimap and no overlaps', () => {
  const overlap = (a, b, pad = 0.5) => !(a.x + a.w <= b.x + pad || b.x + b.w <= a.x + pad || a.y + a.h <= b.y + pad || b.y + b.h <= a.y + pad);
  const box = (x, y, w, h) => ({ x, y, w, h });

  // portrait 400: inventory + 6px gap + 32px gear under the card; radar 104 flush right (8px)
  const p = {
    card: box(8, 8, 152, 44),
    inv: box(8, 60, 112, 25),
    gear: box(8 + 112 + 6, 60 + (25 - 32) / 2, 32, 32),
    radar: box(400 - 8 - 104, 6, 104, 104),
    pill: box(400 - 8 - 116, 6 + 104 + 5, 116, 23),
    fire: box((400 - 160) / 2, 142, 160, 24),
    chip: box((400 - 224) / 2, 174, 224, 34),
    bar: box((400 - 300) / 2, 220, 300, 27),
    rotate: box((400 - 234) / 2, 252, 234, 41),
  };
  assert.equal(p.radar.x + p.radar.w, 392, 'radar flush right (8px)');
  assert.equal(p.gear.x, p.inv.x + p.inv.w + 6, 'gear 6px to the right of INVENTORY');
  assert.ok(Math.abs((p.gear.y + p.gear.h / 2) - (p.inv.y + p.inv.h / 2)) < 1, 'gear vertically centred with INVENTORY');
  assert.ok(p.gear.x + p.gear.w < p.radar.x, 'inventory+gear stays left of the flush minimap');
  for (const [a, b] of [
    ['gear','inv'],['gear','card'],['gear','radar'],['gear','pill'],['gear','fire'],['gear','chip'],['gear','bar'],['gear','rotate'],
    ['inv','radar'],['inv','pill'],['inv','fire'],['inv','chip'],
    ['fire','pill'],['chip','fire'],['chip','pill'],['chip','rotate'],['bar','rotate'],
    ['card','radar'],['card','pill'],
  ]) {
    assert.equal(overlap(p[a], p[b]), false, `portrait ${a} overlaps ${b}`);
  }

  // landscape 860: same row on the left; radar 92 flush right
  const l = {
    card: box(14, 12, 152, 44),
    inv: box(14, 64, 112, 25),
    gear: box(14 + 112 + 6, 64 + (25 - 32) / 2, 32, 32),
    radar: box(860 - 8 - 92, 6, 92, 92),
    pill: box(860 - 8 - 116, 6 + 92 + 5, 116, 23),
    fire: box((860 - 114) / 2, 82, 114, 24),
    chip: box((860 - 218) / 2, 148, 218, 34),
  };
  assert.equal(l.radar.x + l.radar.w, 852, 'landscape radar flush right');
  assert.equal(l.gear.x, l.inv.x + l.inv.w + 6, 'landscape gear just right of INVENTORY');
  for (const [a, b] of [
    ['gear','inv'],['gear','card'],['gear','radar'],['gear','pill'],['gear','fire'],['gear','chip'],
    ['inv','radar'],['inv','fire'],['inv','chip'],['chip','pill'],['card','radar'],
  ]) {
    assert.equal(overlap(l[a], l[b]), false, `landscape ${a} overlaps ${b}`);
  }

  // desktop 1280: 36px gear next to inventory; radar 150 flush right (10px)
  const d = {
    card: box(14, 12, 209, 67),
    inv: box(14, 87, 112, 25),
    gear: box(14 + 112 + 6, 87 + (25 - 36) / 2, 36, 36),
    radar: box(1280 - 10 - 150, 10, 150, 150),
    pill: box(1280 - 10 - 146, 10 + 150 + 6, 146, 28),
  };
  assert.equal(d.radar.x + d.radar.w, 1270, 'desktop radar flush right (10px)');
  assert.equal(d.gear.x, d.inv.x + d.inv.w + 6, 'desktop gear just right of INVENTORY');
  assert.ok(d.gear.x + d.gear.w < d.radar.x, 'desktop inventory+gear stays left of the minimap');
  for (const [a, b] of [
    ['gear','inv'],['gear','card'],['gear','radar'],['gear','pill'],
    ['inv','radar'],['inv','pill'],['card','radar'],
  ]) {
    assert.equal(overlap(d[a], d[b]), false, `desktop ${a} overlaps ${b}`);
  }
});
