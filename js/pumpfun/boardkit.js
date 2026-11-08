// Shared pirate look for every PumpFun HQ canvas board (BANKSY t2275u "Work on board ui"): weathered plank frame with gilt
// trim, red banner header with a gold medallion icon, ink rows with token logos, change pills and gilt progress bars.
// Pure 2D canvas, no three.js; all text is ellipsized to its column so nothing overflows.
import { tokenLogo, skullLogo } from './logos.js';
export const C = Object.freeze({ gold: '#ffcd77', gilt: '#c9973f', red: '#fa0d0d', ink: '#161616', parch: '#f3ead6', muted: '#c9b48c', dim: '#9c8a6a', up: '#3fd27f', down: '#ff5a4f' });
export const FONT = '"Just Another Hand",Georgia,sans-serif';
export const usd = v => v == null || !Number.isFinite(+v) ? '—' : '$' + (Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v >= 1 ? (+v).toFixed(2) : (+v).toPrecision(3));
export const pct = v => v == null || !Number.isFinite(+v) ? '—' : (v >= 0 ? '+' : '') + (+v).toFixed(Math.abs(v) >= 100 ? 0 : 1) + '%';
export const ago = (t, now) => { if (t == null) return '—'; const m = Math.max(0, Math.floor((now - t) / 60000)); return m < 60 ? m + 'm' : m < 1440 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : Math.floor(m / 1440) + 'd'; };
export function fit(g, s, max) { s = String(s ?? ''); if (!max || g.measureText(s).width <= max) return s; while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1); return s + '…'; }
export function txt(g, s, x, y, n, c = C.parch, a = 'left', max = 0, shadow = false) {
  g.font = `${n}px ${FONT}`; g.textAlign = a; g.textBaseline = 'middle'; const t = fit(g, s, max);
  if (shadow) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(t, x + n * .05, y + n * .05); } g.fillStyle = c; g.fillText(t, x, y); return g.measureText(t).width; }
export function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
// deterministic grain so a redraw never shimmers
const rnd = s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
export function frame(g, W, H, { trim = 14 } = {}) {
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#3e2617'); bg.addColorStop(.5, '#2c1a0f'); bg.addColorStop(1, '#22140b'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const r = rnd(7 + W + H); g.lineWidth = 1.5;
  for (let i = 0; i < W / 9; i++) { const y = r() * H, a = .05 + r() * .08; g.strokeStyle = r() < .5 ? `rgba(0,0,0,${a})` : `rgba(255,214,150,${a * .5})`; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * .3, y + (r() - .5) * 10, W * .7, y + (r() - .5) * 10, W, y + (r() - .5) * 6); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = H / 4; y < H - 4; y += H / 4) g.fillRect(0, y - 1, W, 2);   // plank seams
  const v = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(14,9,6,0.55)'; rr(g, trim + 6, trim + 6, W - 2 * trim - 12, H - 2 * trim - 12, 10); g.fill();   // ink field the rows sit on
  g.strokeStyle = '#1a0e07'; g.lineWidth = trim; g.strokeRect(trim / 2, trim / 2, W - trim, H - trim);
  g.strokeStyle = C.gilt; g.lineWidth = 4; g.strokeRect(trim, trim, W - 2 * trim, H - 2 * trim);
  g.strokeStyle = 'rgba(255,205,119,0.45)'; g.lineWidth = 1.5; g.strokeRect(trim + 6, trim + 6, W - 2 * trim - 12, H - 2 * trim - 12);
  for (const [x, y] of [[trim, trim], [W - trim, trim], [trim, H - trim], [W - trim, H - trim]]) rivet(g, x, y, trim * .55); }
export function rivet(g, x, y, r) { const gr = g.createRadialGradient(x - r * .3, y - r * .3, 1, x, y, r); gr.addColorStop(0, '#fff1c8'); gr.addColorStop(.5, C.gold); gr.addColorStop(1, '#7a5420'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
// gold medallion with a dark glyph; 'ours' / 'market' use the real PUMPFUN PIRATES skull when it has loaded
export function icon(g, kind, x, y, r) {
  const gr = g.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r); gr.addColorStop(0, '#fff0c4'); gr.addColorStop(.55, C.gold); gr.addColorStop(1, '#9a6a24');
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#4a2a10'; g.lineWidth = Math.max(1.5, r * .1); g.stroke();
  const k = r / 20, ink = '#2a160b'; g.save(); g.translate(x, y); g.scale(k, k); g.fillStyle = ink; g.strokeStyle = ink; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'paid') { g.font = 'bold 28px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, 1); }
  else if (kind === 'bond') { g.beginPath(); g.moveTo(-9, -12); g.lineTo(9, -12); g.lineTo(0, 0); g.closePath(); g.moveTo(-9, 12); g.lineTo(9, 12); g.lineTo(0, 0); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(-5, 12); g.lineTo(5, 12); g.lineTo(0, 5); g.closePath(); g.fill(); }
  else if (kind === 'callout') { g.beginPath(); g.moveTo(-11, -4); g.lineTo(-3, -4); g.lineTo(9, -11); g.lineTo(9, 11); g.lineTo(-3, 4); g.lineTo(-11, 4); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-6, 4); g.lineTo(-3, 12); g.stroke(); }
  else if (kind === 'migrated') { g.beginPath(); g.arc(0, -10, 3.5, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 12); g.moveTo(-6, -2); g.lineTo(6, -2); g.stroke(); g.beginPath(); g.arc(0, 2, 11, .35, Math.PI - .35); g.stroke(); }
  else if (kind === 'volume') { for (const [bx, bh] of [[-9, 9], [-1, 16], [7, 23]]) g.fillRect(bx - 3, 11 - bh, 6, bh); }
  else { const s = skullLogo(); if (s) g.drawImage(s, -15, -15, 30, 30); else { g.font = 'bold 22px Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☠', 0, 1); } }
  g.restore(); }
// red swallow-tail banner across the top with the board title in gold, icon medallion left of the words
export function banner(g, W, title, kind, { y = 50, h = 62, size = 54, sub = '', subY = 104 } = {}) {
  const x0 = 34, x1 = W - 34, t = 16, top = y - h / 2;
  g.save(); g.fillStyle = 'rgba(0,0,0,0.45)'; g.beginPath(); g.moveTo(x0 + 4, top + 5); g.lineTo(x1 + 4, top + 5); g.lineTo(x1 - t + 4, y + 5); g.lineTo(x1 + 4, top + h + 5); g.lineTo(x0 + 4, top + h + 5); g.lineTo(x0 + t + 4, y + 5); g.closePath(); g.fill();
  const rg = g.createLinearGradient(0, top, 0, top + h); rg.addColorStop(0, '#b3241b'); rg.addColorStop(.5, '#8e1912'); rg.addColorStop(1, '#5e0f0b');
  g.fillStyle = rg; g.beginPath(); g.moveTo(x0, top); g.lineTo(x1, top); g.lineTo(x1 - t, y); g.lineTo(x1, top + h); g.lineTo(x0, top + h); g.lineTo(x0 + t, y); g.closePath(); g.fill();
  g.strokeStyle = C.gilt; g.lineWidth = 3; g.stroke(); g.strokeStyle = 'rgba(255,205,119,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0 + t + 6, top + 6); g.lineTo(x1 - t - 6, top + 6); g.moveTo(x0 + t + 6, top + h - 6); g.lineTo(x1 - t - 6, top + h - 6); g.stroke(); g.restore();
  g.font = `${size}px ${FONT}`; const ir = h * .4, gap = 14, max = x1 - x0 - 2 * t - 2 * ir - gap - 30, tw = Math.min(g.measureText(title).width, max), sx = W / 2 - (2 * ir + gap + tw) / 2;
  icon(g, kind, sx + ir, y, ir); txt(g, title, sx + 2 * ir + gap, y + 2, size, C.gold, 'left', max, true);
  if (sub) txt(g, sub, W / 2, subY, 22, C.muted, 'center', W - 90); }
// one board row: alternate shading, rounded, hairline gilt underline
export function rowBg(g, i, x, y, w, h) { g.fillStyle = i % 2 ? 'rgba(0,0,0,0.30)' : 'rgba(255,226,170,0.09)'; rr(g, x, y, w, h, 9); g.fill(); g.fillStyle = 'rgba(255,205,119,0.16)'; g.fillRect(x + 10, y + h - 1.5, w - 20, 1.5); }
const hue = s => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 360; };
// round token logo, or a coloured coin with the symbol's first letter when no CORS-clean image is available
export function logo(g, row, cx, cy, r) {
  const img = tokenLogo(row?.mint, row?.imageUrl); g.save();
  if (img) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.clip(); g.drawImage(img, cx - r, cy - r, 2 * r, 2 * r); g.restore(); g.save(); }
  else { const hh = hue(row?.mint || row?.symbol), gr = g.createRadialGradient(cx - r * .35, cy - r * .35, r * .1, cx, cy, r); gr.addColorStop(0, `hsl(${hh} 60% 58%)`); gr.addColorStop(1, `hsl(${hh} 55% 30%)`);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); const ch = (String(row?.symbol || row?.name || '?').replace(/^\$/, '').match(/[A-Za-z0-9]/) || ['?'])[0].toUpperCase(); txt(g, ch, cx, cy + r * .08, r * 1.45, '#fff8e6', 'center', 0, true); }
  g.strokeStyle = C.gold; g.lineWidth = Math.max(1.5, r * .12); g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); g.restore(); }
// green / red change pill, right-aligned at xr; returns its width
export function pill(g, v, xr, cy, n = 26, label = pct(v)) {
  g.font = `${n}px ${FONT}`; const w = g.measureText(label).width + n * .8, h = n * 1.05, c = v == null ? 'rgba(201,180,140,0.25)' : v < 0 ? C.down : C.up;
  g.fillStyle = c; rr(g, xr - w, cy - h / 2, w, h, h / 2); g.fill(); txt(g, label, xr - w / 2, cy + 1, n, v == null ? C.muted : v < 0 ? '#fff' : '#0b2a16', 'center'); return w; }
// gilt progress bar (curve progress), value 0..1
export function bar(g, x, y, w, h, v) { v = Math.max(0, Math.min(1, v || 0));
  g.fillStyle = 'rgba(0,0,0,0.55)'; rr(g, x, y, w, h, h / 2); g.fill();
  if (v > 0) { const fw = Math.max(h, w * v), gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, '#9a6a24'); gr.addColorStop(.6, C.gold); gr.addColorStop(1, C.up);
    g.save(); rr(g, x, y, w, h, h / 2); g.clip(); g.fillStyle = gr; rr(g, x, y, fw, h, h / 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(x, y + 1, fw, h * .38); g.restore(); }
  g.strokeStyle = 'rgba(255,205,119,0.55)'; g.lineWidth = 1.5; rr(g, x, y, w, h, h / 2); g.stroke(); }
// subtle "tap to open" line with a small ripple glyph
export function tapHint(g, W, y, n = 22, s = 'Tap a token to open it on pump.fun · not financial advice') {
  g.font = `${n}px ${FONT}`; const tw = Math.min(g.measureText(s).width, W - 120), x = W / 2 - tw / 2 + n * .5;
  g.strokeStyle = C.gold; g.lineWidth = 1.5; for (const r of [n * .18, n * .36]) { g.globalAlpha = r > n * .2 ? .5 : 1; g.beginPath(); g.arc(x - n * .9, y, r, 0, 7); g.stroke(); } g.globalAlpha = 1;
  txt(g, s, x, y, n, C.dim, 'left', W - 120); }
// empty / loading / offline message, centred in the row area
export function emptyState(g, W, status, y = 270) { const off = /offline/i.test(status || ''), load = !status || status === 'Loading…';
  txt(g, load ? 'Loading…' : off ? 'Feed offline' : '—', W / 2, y, 46, C.parch, 'center', W - 80, true);
  txt(g, load ? 'Fetching a free snapshot' : off ? 'Retrying while you are nearby' : status, W / 2, y + 50, 24, C.muted, 'center', W - 90); }
// one token row on a 640-wide wall board: rank, logo, big symbol, labelled value, then a pill / text / progress bar
// spec: { name, midLabel, mid, right: { pill: v } | { text, color }, bar: 0..1 }
export function tokenRow(g, W, i, y, h, row, spec) { const x0 = 28, x1 = W - 28, cy = y + h / 2, r = Math.min(16, h * .4);
  rowBg(g, i, x0, y, x1 - x0, h); txt(g, String(i + 1), x0 + 16, cy + 1, 18, C.dim, 'center');
  logo(g, row, x0 + 48, cy, r); const nx = x0 + 48 + r + 10;
  if (spec.bar != null) { txt(g, spec.name, nx, cy + 1, 24, '#ffe9b8', 'left', 128);
    const bx = nx + 138, bw = x1 - 14 - 92 - bx; txt(g, spec.midLabel + ' ' + spec.mid, bx, cy - 5, 17, C.muted, 'left', bw);
    bar(g, bx, cy + 5, bw, 5, spec.bar); txt(g, spec.right.text, x1 - 14, cy + 1, 22, spec.right.color || C.gold, 'right', 90); return; }
  const rx = x1 - 14; let rw = 0;
  if (spec.right?.pill !== undefined) rw = pill(g, spec.right.pill, rx, cy, 20); else if (spec.right) rw = txt(g, spec.right.text, rx, cy + 1, 21, spec.right.color || C.gold, 'right', 170);
  const mx = Math.min(x0 + 420, rx - rw - 18), vw = txt(g, spec.mid, mx, cy + 1, 23, C.parch, 'right', 120);
  if (spec.midLabel) txt(g, spec.midLabel, mx - vw - 8, cy + 1, 16, C.dim, 'right');
  txt(g, spec.name, nx, cy + 1, 24, '#ffe9b8', 'left', Math.max(60, mx - vw - (spec.midLabel ? 46 : 14) - nx)); }
// status + tap hint along the bottom of a wall board
export const withUpdated = (status, at, now = Date.now()) => status ? status + (at ? ' · updated ' + (now - at < 60000 ? 'just now' : ago(at, now) + ' ago') : '') : '';
export function footer(g, W, H, status, at, now = Date.now()) { const s = withUpdated(status, at, now); if (s) txt(g, s, W / 2, H - 64, 20, C.dim, 'center', W - 90); tapHint(g, W, H - 36); }
// ---- phone layout: rank · logo · ticker · ONE key value, bold high-contrast sans, rows fill the panel ----
export const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif';
export function btxt(g, s, x, y, n, c = '#fff8e6', a = 'left', max = 0, shadow = true) {
  g.font = `800 ${n}px ${SANS}`; g.textAlign = a; g.textBaseline = 'middle'; const t = fit(g, s, max);
  if (shadow) { g.fillStyle = 'rgba(0,0,0,0.75)'; g.fillText(t, x + 2, y + 2); } g.fillStyle = c; g.fillText(t, x, y); return g.measureText(t).width; }
export function compactBanner(g, W, title, kind) { banner(g, W, title, kind, { y: 48, h: 74, size: 70 }); }
// spec: { name, value, color, bar }
export function compactRow(g, W, i, y, h, row, spec) { const x0 = 24, x1 = W - 24, cy = y + h / 2, r = Math.min(16, h * .42);
  rowBg(g, i, x0, y + 1, x1 - x0, h - 2); btxt(g, String(i + 1), x0 + 20, cy + 1, 24, C.gold, 'center', 34);
  logo(g, row, x0 + 58, cy, r); const nx = x0 + 58 + r + 12;
  const vw = btxt(g, spec.value, x1 - 12, cy + 1, 30, spec.color || '#fff8e6', 'right', 230);
  if (spec.bar != null) bar(g, x1 - 12 - vw, cy + h * .36, vw, 4, spec.bar);
  btxt(g, spec.name, nx, cy + 1, 30, '#ffe9b8', 'left', Math.max(80, x1 - 12 - vw - 18 - nx)); }
export function compactEmpty(g, W, status) { const off = /offline/i.test(status || ''), load = !status || status === 'Loading…';
  btxt(g, load ? 'Loading…' : off ? 'Feed offline' : '—', W / 2, 270, 48, C.parch, 'center', W - 80); if (off) btxt(g, 'Retrying nearby', W / 2, 326, 28, C.muted, 'center', W - 80); }
export function compactFooter(g, W, H) { btxt(g, 'TAP TO READ', W / 2, H - 25, 26, C.gold, 'center', W - 80); }
