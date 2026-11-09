import { liveTag, rowFlash } from './liveui.js';
import { BOARD_ROWS, WALL_ROW_Y0, WALL_ROW_H, BOOST_STEP_MS, boardRows, wallGrid, wallRow } from './boardgrid.js';
// Pure (three-free) board definitions + canvas drawing for Post's 5 remaining panel slots (BANKSY t2262u "Ok now work on all the boards").
// Same pattern as dexpanel.js: swap the slot mesh's material only (geometry, lighting, decor stay Post's),
// one canvas each (1280x1024, 640x512 on phones), built lazily with the hall, redrawn on data change / once a minute, no lights.
// Look: shared pirate board kit (boardkit.js, BANKSY t2275u "Work on board ui").
import { WATCH_TOKENS } from './market.js';
import { C, frame, banner, tokenRow, footer, emptyState, txt, rr, logo, pill, bar, tapHint, usd, ago, pct, btxt, compactBanner, compactRow, compactEmpty, compactFooter } from './boardkit.js';
const DEX_PANEL_ROWS = BOARD_ROWS, DEX_PANEL_ROW_Y0 = WALL_ROW_Y0, DEX_PANEL_ROW_H = WALL_ROW_H; // same row grid as dexpanel.js (logical 640x512)
// slot -> board. rows(state, now) returns [{mint, imageUrl, symbol, spec}] from real feed rows only. east_1 is DEX JUST PAID (dexpanel.js).
// cv = the phone layout's one key value { value, color, bar }
const R = (r, spec, cv) => ({ mint: r.mint, imageUrl: r.imageUrl, symbol: r.symbol, name: r.symbol, spec: { name: r.symbol || r.mint.slice(0, 6), ...spec }, cv: { name: r.symbol || r.mint.slice(0, 6), ...cv } });
export const WALL_BOARDS = Object.freeze([
 { slot: 'west_1', key: 'bonding', icon: 'bond', title: 'ABOUT TO BOND', sub: '≈ bonding-curve progress · pump.fun curve pools',
   rows: s => (s.bonding || []).map(r => R(r, { midLabel: 'MC', mid: usd(r.cap), right: { text: '≈' + r.progress.toFixed(1) + '%' }, bar: r.progress / 100 }, { value: '≈' + r.progress.toFixed(1) + '%', color: C.gold, bar: r.progress / 100 })) },
 { slot: 'east_2', key: 'callouts', icon: 'callout', title: 'DEX BOOSTED', sub: 'Latest DexScreener boosts · pump.fun tokens', tickMs: BOOST_STEP_MS,
   rows: (s, now) => boardRows(s, 'callouts', now).map(r => R(r, { midLabel: 'MC', mid: usd(r.cap), right: { text: '+' + (r.boost || r.amount) + ' boost · ' + ago(r.seenAt, now) } }, { value: r.cap != null ? usd(r.cap) : '+' + (r.boost || r.amount), color: r.cap != null ? '#fff8e6' : C.gold })) },
 { slot: 'east_3', key: 'migrated', icon: 'migrated', title: 'JUST MIGRATED', sub: 'New PumpSwap pools · GeckoTerminal + live PumpPortal',
   rows: (s, now) => (s.migrated || []).map(r => R(r, { midLabel: 'MC', mid: usd(r.cap), right: { text: ago(r.createdAt, now) + ' ago', color: C.muted } }, { value: r.cap != null ? usd(r.cap) : ago(r.createdAt, now) })) },
 { slot: 'squad_ranks', key: 'volume', icon: 'volume', title: 'VOLUME LEADERS', sub: 'Highest 24h volume · pump.fun tokens',
   rows: s => (s.volume || []).map(r => R(r, { midLabel: 'VOL', mid: usd(r.volume), right: { pill: r.change } }, { value: usd(r.volume) })) },
 // Dedicated tokens flank the front door; Volume Leaders uses the existing squad-rank plaque.
 { slot: 'front_e', key: 'prices', icon: 'ours', title: '$SUNK', ours: ['SUNK'], rows: () => [] },
 { slot: 'front_w', key: 'prices', icon: 'ours', title: '$AHOY', ours: ['AHOY'], rows: () => [] },
]);
const price = v => v == null ? '—' : v >= 1 ? '$' + v.toFixed(2) : '$' + v.toPrecision(3);
// 24 h hourly line: gradient fill, last-price dot, hi/lo + time axis labels
function chart(g, c, x0, y0, x1, y1, compact = false) {
  g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x0, y0, x1 - x0, y1 - y0, 8); g.fill();
  const px1 = compact ? x1 - 10 : x1 - 74, py0 = y0 + 8, py1 = compact ? y1 - 8 : y1 - 18;   // plot area; right gutter for price labels, bottom for time labels
  g.strokeStyle = 'rgba(255,205,119,0.12)'; g.lineWidth = 1; for (let k = 0; k <= 2; k++) { const y = py0 + (py1 - py0) * k / 2; g.beginPath(); g.moveTo(x0 + 8, y); g.lineTo(px1, y); g.stroke(); }
  const t0 = c[0][0], t1 = c[c.length - 1][0], lo = Math.min(...c.map(p => p[1])), hi = Math.max(...c.map(p => p[1])), span = hi - lo || hi * .01 || 1;
  const pts = c.map(([t, v]) => [x0 + 8 + (t - t0) / Math.max(1, t1 - t0) * (px1 - x0 - 8), py1 - (v - lo) / span * (py1 - py0)]);
  const upC = c[c.length - 1][1] >= c[0][1] ? C.up : C.down, fill = g.createLinearGradient(0, py0, 0, py1);
  fill.addColorStop(0, upC === C.up ? 'rgba(63,210,127,0.45)' : 'rgba(255,90,79,0.45)'); fill.addColorStop(1, 'rgba(0,0,0,0)');
  g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineTo(pts[pts.length - 1][0], py1); g.lineTo(pts[0][0], py1); g.closePath(); g.fillStyle = fill; g.fill();
  g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = upC; g.lineWidth = 3.5; g.lineJoin = 'round'; g.stroke();
  const [lx, ly] = pts[pts.length - 1]; g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(lx, ly, 9, 0, 7); g.fill(); g.fillStyle = upC; g.beginPath(); g.arc(lx, ly, 5.5, 0, 7); g.fill();
  if (compact) return;
  txt(g, price(hi), x1 - 8, py0 + 2, 19, C.muted, 'right', 66); txt(g, price(lo), x1 - 8, py1, 19, C.muted, 'right', 66);
  txt(g, '24h ago', x0 + 10, y1 - 8, 17, C.dim); txt(g, 'now', px1, y1 - 8, 17, C.dim, 'right'); }
// Live trades strip ($AHOY/$SUNK): real swaps pushed by the Helius webhook (server-parsed); newest first, never synthesized.
const kfmt = v => v == null || !Number.isFinite(v) ? '—' : v >= 1e9 ? (v / 1e9).toFixed(2) + 'B' : v >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : v >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v >= 1 ? v.toFixed(2) : v.toPrecision(2);
const tradeQuote = r => r.sol != null ? (r.sol >= 1 ? r.sol.toFixed(2) : r.sol.toFixed(3)) + ' SOL' : r.quoteAmount != null && r.quote ? kfmt(r.quoteAmount) + ' ' + r.quote : '—';
const tAge = (at, now) => { const s = Math.max(0, Math.floor((now - at) / 1000)); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; };
function tradesStrip(g, state, sym, x0, y0, x1, y1, now, compact = false) {
 const rows = state.trades?.[sym], rh = compact ? 30 : 24, fs = compact ? 22 : 18, n = Math.max(1, Math.floor((y1 - y0 - rh) / rh));
 g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x0, y0, x1 - x0, y1 - y0, 8); g.fill();
 txt(g, 'LIVE TRADES', x0 + 10, y0 + rh / 2 + 1, compact ? 19 : 16, C.dim);
 if (state.tradeStream === 'live' || state.tradeStream === 'idle') { g.fillStyle = state.tradeStream === 'live' ? C.up : C.muted; g.beginPath(); g.arc(x1 - 14, y0 + rh / 2, 5, 0, 7); g.fill(); }
 if (!Array.isArray(rows)) { txt(g, '—', (x0 + x1) / 2, (y0 + rh + y1) / 2, fs + 4, C.muted, 'center'); return; }
 if (!rows.length) { txt(g, 'No trades yet', (x0 + x1) / 2, (y0 + rh + y1) / 2, fs + 4, C.muted, 'center'); return; }
 rows.slice(0, n).forEach((r, i) => { const y = y0 + rh + i * rh, cy = y + rh / 2, buy = r.side === 'buy', col = buy ? C.up : C.down;
  const left = (state.flashes?.trades?.[r.id] || 0) - now; if (left > 0) { g.save(); g.fillStyle = (buy ? 'rgba(63,210,127,' : 'rgba(255,90,79,') + (.28 * Math.min(1, left / 1000)) + ')'; g.fillRect(x0 + 2, y, x1 - x0 - 4, rh - 2); g.restore(); }
  const w = x1 - x0; txt(g, buy ? 'BUY' : 'SELL', x0 + 10, cy, fs, col, 'left', w * .14, true);
  txt(g, tradeQuote(r), x0 + w * (compact ? .40 : .36), cy, fs, '#ffe9b8', 'right', w * .24);
  txt(g, kfmt(r.amount) + ' $' + sym, x0 + w * (compact ? .72 : .64), cy, fs, C.parch, 'right', w * .27);
  if (!compact) txt(g, r.wallet || '—', x0 + w * .83, cy, fs - 2, C.dim, 'right', w * .18);
  txt(g, tAge(r.at, now), x1 - 10, cy, fs, C.muted, 'right', w * .12); }); }
// $AHOY / $SUNK: market cap, holder count, liquidity, volume, 24 h hourly price line. Every figure from a feed; "—" when a feed has no value.
function drawOurs(g, board, state, now = Date.now()) { const W = 640;
 board.ours.forEach((sym, i) => { const t = WATCH_TOKENS.find(t => t.sym === sym), p = state.prices?.[sym], d = state.details?.[sym], y0 = 84, x0 = 28, x1 = W - 28;
  g.fillStyle = i % 2 ? 'rgba(0,0,0,0.30)' : 'rgba(255,226,170,0.08)'; rr(g, x0, y0, x1 - x0, 386, 12); g.fill(); g.strokeStyle = 'rgba(255,205,119,0.3)'; g.lineWidth = 1.5; g.stroke();
  logo(g, { mint: t.ca, symbol: sym, imageUrl: p?.imageUrl }, x0 + 34, y0 + 32, 23);
  txt(g, '$' + sym, x0 + 66, y0 + 32, 46, C.gold, 'left', 150, true);
  const pw = pill(g, p?.change ?? null, x1 - 12, y0 + 32, 26, p ? (p.change == null ? '24h —' : (p.change >= 0 ? '+' : '') + p.change.toFixed(1) + '% 24h') : '—');
  txt(g, p ? price(p.price) + (p.stale ? ' · old' : p.source === 'chain' ? ' · chain' : '') : state.status?.prices === 'Loading…' ? 'Loading…' : 'Feed offline', x1 - 12 - pw - 14, y0 + 33, 32, C.parch, 'right', 200);
  const stats = [['MC', usd(p?.cap)], ['HOLDERS', d?.holders != null ? Number(d.holders).toLocaleString('en-US') : '—'], ['LIQ', usd(p?.liquidity)], ['VOL 24H', usd(p?.volume)]], cw = (x1 - x0 - 24) / 4;
  stats.forEach(([k, v], j) => { const cx = x0 + 12 + cw * j + cw / 2; txt(g, k, cx, y0 + 68, 18, C.dim, 'center', cw - 8); txt(g, v, cx, y0 + 90, 28, '#ffe9b8', 'center', cw - 8); });
  if (sym === 'SUNK' && !d?.bonded) {
   const progress = d?.curveProgress;
   txt(g, 'BONDING CURVE', x0 + 12, y0 + 116, 17, C.dim);
   txt(g, progress == null ? '—' : '≈' + progress.toFixed(1) + '%', x1 - 12, y0 + 116, 22, C.gold, 'right', 94);
   if (progress != null) bar(g, x0 + 155, y0 + 113, x1 - x0 - 270, 7, progress / 100);
  }
  const c = (d?.chart || []).filter(x => Number.isFinite(x[0]) && Number.isFinite(x[1]) && x[1] > 0), cy0 = y0 + 132, cy1 = y0 + 252;
  tradesStrip(g, state, sym, x0 + 12, cy1 + 6, x1 - 12, y0 + 380, now);
  if (c.length >= 2) chart(g, c, x0 + 12, cy0, x1 - 12, cy1);
  else { g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x0 + 12, cy0, x1 - x0 - 24, cy1 - cy0, 8); g.fill(); txt(g, d ? 'Chart feed offline' : 'Chart loading…', W / 2, (cy0 + cy1) / 2, 26, C.muted, 'center'); } }); }
export function wallRows(board, state, now = Date.now()) { return board.rows(state, now).slice(0, DEX_PANEL_ROWS); }
export function drawWallPanel(cv, board, state, now = Date.now(), compact = false) { if (compact) return drawCompact(cv, board, state, now); const g = cv.getContext('2d'), W = 640, H = 512; g.save(); g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
 frame(g, W, H);
 if (board.ours) { banner(g, W, board.title, board.icon, { y: 46, h: 56, size: 50 }); drawOurs(g, board, state, now); liveTag(g,state.updated?.prices,now,320,486,17,'center'); g.restore(); return; }
 banner(g, W, board.title, board.icon, { sub: board.sub });
 const status = state.status?.[board.key] || 'Loading…', rows = wallRows(board, state, now);
 if (!rows.length) emptyState(g, W, status);
 rows.forEach((r, i) => tokenRow(g, W, i, DEX_PANEL_ROW_Y0 + i * DEX_PANEL_ROW_H, DEX_PANEL_ROW_H - 2, r, r.spec));
 rows.forEach((r,i)=>rowFlash(g,state,board.key,r.mint,28,DEX_PANEL_ROW_Y0+i*DEX_PANEL_ROW_H,584,DEX_PANEL_ROW_H-2,now));
 footer(g, W, H, rows.length ? status : '', state.updated?.[board.key], now); g.restore(); }
// tap: uv -> the row's mint, or null (opens the token hall instead)
export function wallPanelMint(board, state, uv, now = Date.now(), compact = false) { const y = (1 - uv.y) * 512; if (board.ours) { const i = y >= 80 && y < 480 ? 0 : -1; return i < 0 ? null : WATCH_TOKENS.find(t => t.sym === board.ours[i])?.ca || null; } const i = wallRow(uv, compact); if (i < 0) return null; return wallRows(board, state, now)[i]?.mint || null; }
// Phone layout: big title, no subtitle, rank · logo · ticker · one value, ten rows filling the panel, "TAP TO READ" opens the 2D board.
export function drawCompact(cv, board, state, now = Date.now()) { const g = cv.getContext('2d'), W = 640, H = 512; g.save(); g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
 frame(g, W, H);
 if (board.ours) { compactBanner(g, W, board.title, board.icon); drawOursCompact(g, board, state, now); liveTag(g,state.updated?.prices,now,32,486,17); btxt(g,'TAP TO READ',W-30,H-25,22,C.gold,'right'); g.restore(); return; }
 compactBanner(g, W, board.title, board.icon);
 const status = state.status?.[board.key] || 'Loading…', rows = wallRows(board, state, now), { y0, h } = wallGrid(true);
 if (!rows.length) compactEmpty(g, W, status);
 rows.forEach((r, i) => compactRow(g, W, i, y0 + i * h, h, r, r.cv || { name: r.spec.name, value: r.spec.mid }));
 rows.forEach((r,i)=>rowFlash(g,state,board.key,r.mint,24,y0+i*h,592,h-2,now)); liveTag(g,state.updated?.[board.key],now,32,486,17); btxt(g,'TAP TO READ',W-30,H-25,22,C.gold,'right'); g.restore(); }
// $AHOY / $SUNK on phones: price + change, then four big stats; chart kept, axis labels dropped. Every figure from a feed; "—" otherwise.
function drawOursCompact(g, board, state, now = Date.now()) { const W = 640, sym = board.ours[0], t = WATCH_TOKENS.find(t => t.sym === sym), p = state.prices?.[sym], d = state.details?.[sym], x0 = 28, x1 = W - 28;
 logo(g, { mint: t.ca, symbol: sym, imageUrl: p?.imageUrl }, x0 + 30, 122, 26);
 btxt(g, p ? price(p.price) : state.status?.prices === 'Loading…' ? 'Loading…' : 'Feed offline', x0 + 66, 122, 40, '#fff8e6', 'left', 330);
 const ch = p?.change ?? null; btxt(g, ch == null ? '24h —' : pct(ch), x1 - 6, 122, 36, ch == null ? C.muted : ch < 0 ? C.down : C.up, 'right', 180);
 const stats = [['MC', usd(p?.cap)], ['HOLDERS', d?.holders != null ? Number(d.holders).toLocaleString('en-US') : '—'], ['LIQ', usd(p?.liquidity)], ['VOL 24H', usd(p?.volume)]], cw = (x1 - x0) / 2;
 stats.forEach(([k, v], j) => { const cx = x0 + cw * (j % 2) + cw / 2, y = 170 + Math.floor(j / 2) * 70; g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, cx - cw / 2 + 4, y, cw - 8, 62, 10); g.fill();
  btxt(g, k, cx, y + 16, 22, C.muted, 'center', cw - 20, false); btxt(g, v, cx, y + 42, 32, '#ffe9b8', 'center', cw - 20); });
 let cy0 = 316;
 if (sym === 'SUNK' && !d?.bonded && d?.curveProgress != null) { btxt(g, 'BONDING ≈' + d.curveProgress.toFixed(1) + '%', x0 + 6, cy0 + 12, 22, C.gold, 'left', 260); bar(g, x0 + 270, cy0 + 6, x1 - x0 - 276, 12, d.curveProgress / 100); cy0 += 32; }
 const c = (d?.chart || []).filter(x => Number.isFinite(x[0]) && Number.isFinite(x[1]) && x[1] > 0), cy1 = cy0 + Math.max(50, 470 - cy0 - 104);
 tradesStrip(g, state, sym, x0, cy1 + 6, x1, 470, now, true);
 if (c.length >= 2) chart(g, c, x0, cy0, x1, cy1, true);
 else { g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x0, cy0, x1 - x0, cy1 - cy0, 8); g.fill(); btxt(g, d ? 'Chart offline' : 'Chart loading…', W / 2, (cy0 + cy1) / 2, 28, C.muted, 'center'); } }
