// [Raul gear colours] the HQ helmet + luchador mask take the free hat colour; trim / stencil stay readable in every swatch; crew colour plumbing
import test from 'node:test'; import assert from 'node:assert/strict';
import { recolorPixels, luchaAccents, helmetStencilLight, hsl } from '../js/gearRecolor.js';
import { cleanCrew, crewGear, crewColorToWire, crewColorFromWire, crewToWire } from '../js/crewLoadout.js';
const SW = [['RED', '#c8302c'], ['GOLD', '#e9b949'], ['NAVY', '#1b2f6b'], ['BLUE', '#2a6df4'], ['GREEN', '#2fbf5a'], ['TEAL', '#2ec4a0'], ['PURPLE', '#7a3fb0'], ['PINK', '#ff5fa2'], ['ORANGE', '#ff7a1a'], ['WHITE', '#f4f1e8'], ['BLACK', '#1c1c20'], ['BROWN', '#8a5a32']];
const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const px = (...cols) => new Uint8Array(cols.flatMap((c) => [...c, 255]));
test('helmet: the olive shell takes the colour, strap / buckle / skull fixed', () => {
  for (const [, hex] of SW) {
    const d = recolorPixels(px([84, 98, 50], [92, 52, 30], [214, 168, 60]), 'helmet', hex);
    const [h] = hsl(...rgb(hex)), [h2] = hsl(d[0], d[1], d[2]); if (hsl(...rgb(hex))[1] > 0.2) assert.ok(Math.min(Math.abs(h - h2), 360 - Math.abs(h - h2)) < 12, hex);
    assert.deepEqual([...d.slice(4, 7)], [92, 52, 30]); assert.deepEqual([...d.slice(8, 11)], [214, 168, 60]);
  }
});
test('helmet: the HQ stencil reads on every colour', () => {
  for (const [n, hex] of SW) { const d = recolorPixels(px([84, 98, 50], [36, 52, 26]), 'helmet', hex); assert.ok(cr([d[0], d[1], d[2]], [d[4], d[5], d[6]]) > 1.6, n); }
  assert.equal(helmetStencilLight('#1c1c20'), true); assert.equal(helmetStencilLight('#f4f1e8'), false);
});
test('mask: flames + trim stay readable on every hood colour', () => {
  for (const [n, hex] of SW) {
    const { accent, trim } = luchaAccents(hex), t = rgb(hex);
    assert.ok(Math.hypot(...accent.map((c, i) => c - t[i])) > 90, n + ' accent'); assert.ok(cr(trim, t) > 1.25, n + ' trim');
  }
});
test('crew hat colour: cleaned, worn, sent as cc (old cr unchanged)', () => {
  assert.equal(cleanCrew({ crewhat: 'helmet_hq', crewhatColor: 99 }).crewhatColor, 0);
  assert.equal(crewGear({ crewhat: 'helmet_hq', crewhatColor: 3 }).hatColor, 3);
  assert.equal(crewColorToWire({ crewhatColor: 12 }), 'c'); assert.equal(crewColorFromWire('c'), 12); assert.equal(crewColorFromWire('zz'), 0); assert.equal(crewColorFromWire(undefined), 0);
  assert.equal(crewToWire({ crewhat: 'helmet_hq', crewhatColor: 5 }), '5');
});
