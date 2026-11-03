// [Raul gear colours] BANKSY (via Emerly, 5:19 PM): "add other COLORS to the HQ HELMET and the LUCHA MASK" with the SAME pick as
// the other hats (gear.hatColor = js/pirateGear.js HAT_SWATCHES, 0 = the item's own colours). Both are TEXTURED models (Raul's
// painted maps), so the vertex-colour retint the cloth uses can't reach them: this repaints a COPY of the map per colour (cached),
// pixel by pixel, from the painted colour families:
//   helmet: the olive shell -> the colour (its grain kept as light / dark); the dark HQ stencil stays darker, or turns light on a
//           dark colour (BLACK / NAVY) so it always reads. Strap, brass buckle, skull + crossbones and the pale specks: fixed.
//   mask:   the gold hood -> the colour (shaded the same); the red flames / eye rims / back stripe -> red, or GOLD when the colour
//           is close to red (RED / BROWN), or ink when both would melt in (ORANGE); the white trim + skull -> white, or near-black on a pale colour (WHITE).
// Pure (no three.js / DOM): js/pirateItems.js feeds it a canvas's ImageData, tests/gearColors.test.mjs feeds it arrays.
export const RECOLOR_KINDS = ['helmet', 'lucha'];
const hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export function hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l]; const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l];
}
function rgbOf(h, s, l) {
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const RED = [200, 48, 44], GOLD = [233, 185, 73], WHITE = [244, 240, 228], INK = [28, 28, 32];
// the mask's accents for a hood colour: kept unless they would melt into it (readable in every colour)
export function luchaAccents(hex) {
  const t = hexRgb(hex), [h, s, l] = hsl(...t);
  const accent = [RED, GOLD, INK].find((c) => dist(t, c) > 120) || INK;   // red, else gold (RED / BROWN hoods), else ink (ORANGE)
  const trim = l > 0.75 && s < 0.5 ? INK : WHITE;               // a pale hood (WHITE): dark trim
  return { accent, trim };
}
// the helmet's stencil on this colour: darker on a mid / light colour, light on a dark one
export const helmetStencilLight = (hex) => lum(hexRgb(hex)) < 0.22;
// repaint RGBA pixels in place. data: Uint8ClampedArray / Uint8Array (r, g, b, a, ...); kind: 'helmet' | 'lucha'; hex: '#rrggbb'
// w: the map's width in pixels (the helmet's bottom strip = its lining: shaded, never a stencil)
export function recolorPixels(data, kind, hex, w = 0) {
  const t = hexRgb(hex), [th, ts, tl] = hsl(...t);
  const shade = (l, ref) => { const k = l / ref; return rgbOf(th, ts, Math.max(0, Math.min(0.97, tl * (tl > 0.8 ? 0.85 + 0.15 * k : k)))); };
  if (kind === 'helmet') {
    const light = helmetStencilLight(hex), pale = lum(t) > 0.68, rows = w ? data.length / 4 / w : 0, lining = rows ? Math.floor(rows * 0.89) * w * 4 : Infinity;
    const ink = rgbOf(th, Math.min(ts, 0.5), Math.min(tl * 0.4, 0.3));
    for (let i = 0; i < data.length; i += 4) {
      const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]); let o;
      if (h >= 50 && h <= 170 && s > 0.12 && l < 0.62) {   // the olive family
        const k = l / 0.3;
        if (k < 0.6 && i < lining) o = light ? rgbOf(th, ts * 0.6, Math.min(0.85, tl + 0.34 + (0.6 - k) * 0.2)) : ink;   // the HQ stencil
        else o = shade(l, 0.3);
      } else if (pale && i < lining && s < 0.55 && l > 0.6) o = ink;   // the pale skull + specks on a pale shell (WHITE / GOLD): ink
      else continue;
      data[i] = o[0]; data[i + 1] = o[1]; data[i + 2] = o[2];
    }
  } else if (kind === 'lucha') {
    const { accent, trim } = luchaAccents(hex);
    for (let i = 0; i < data.length; i += 4) {
      const [h, s, l] = hsl(data[i], data[i + 1], data[i + 2]); let o = null;
      if (h >= 18 && h <= 62 && s > 0.4 && l < 0.74 && l > 0.2) o = shade(l, 0.5);                                   // gold hood
      else if ((h >= 330 || h <= 14) && s > 0.4 && l > 0.15 && l < 0.7) { const k = l / 0.42; o = accent.map((c) => Math.max(0, Math.min(255, Math.round(c * k)))); }   // red flames / rims
      else if (l >= 0.74 && s < 0.9 && trim === INK) { const k = Math.min(1, (1 - l) * 3 + 0.6); o = trim.map((c) => Math.round(c * k)); }   // white trim on a pale hood
      if (o) { data[i] = o[0]; data[i + 1] = o[1]; data[i + 2] = o[2]; }
    }
  }
  return data;
}
