import { BOARD_ROWS, WALL_ROW_Y0, WALL_ROW_H, BOOST_STEP_MS, boardRows } from './boardgrid.js';
// Pure (three-free) board definitions + canvas drawing for Post's 5 remaining panel slots (BANKSY t2262u "Ok now work on all the boards").
// Same pattern as dexpanel.js: swap the slot mesh's material only (geometry, lighting, decor stay Post's),
// one canvas each (1280x1024, 640x512 on phones), built lazily with the hall, redrawn on data change / once a minute, no lights.
// Look: shared pirate board kit (boardkit.js, BANKSY t2275u "Work on board ui").
import { WATCH_TOKENS } from './market.js';
import { C, frame, banner, tokenRow, footer, emptyState, txt, rr, logo, pill, tapHint, usd, ago } from './boardkit.js';
const DEX_PANEL_ROWS = BOARD_ROWS, DEX_PANEL_ROW_Y0 = WALL_ROW_Y0, DEX_PANEL_ROW_H = WALL_ROW_H; // same row grid as dexpanel.js (logical 640x512)
// slot -> board. rows(state, now) returns [{mint, imageUrl, symbol, spec}] from real feed rows only. east_1 is DEX JUST PAID (dexpanel.js).
const R = (r, spec) => ({ mint: r.mint, imageUrl: r.imageUrl, symbol: r.symbol, name: r.symbol, spec: { name: r.symbol || r.mint.slice(0, 6), ...spec } });
export const WALL_BOARDS = Object.freeze([
 { slot: 'west_1', key: 'bonding', icon: 'bond', title: 'ABOUT TO BOND', sub: '≈ bonding-curve progress · pump.fun curve pools',
   rows: s => (s.bonding || []).map(r => R(r, { midLabel: 'MC', mid: usd(r.cap), right: { text: '≈' + r.progress.toFixed(1) + '%' }, bar: r.progress / 100 })) },
 { slot: 'east_2', key: 'callouts', icon: 'callout', title: 'DEX BOOSTED', sub: 'Latest DexScreener boosts · pump.fun tokens', tickMs: BOOST_STEP_MS,
   rows: (s, now) => boardRows(s, 'callouts', now).map(r => R(r, { midLabel: 'MC', mid: usd(r.cap), right: { text: '+' + (r.boost || r.amount) + ' boost · ' + ago(r.seenAt, now) } })) },
 { slot: 'east_3', key: 'migrated', icon: 'migrated', title: 'JUST MIGRATED', sub: 'pump.fun curves completed · PumpSwap · last 24h',
   rows: (s, now) => (s.migrated || []).map(r => R(r, { midLabel: 'MC', mid: usd(r.cap), right: { text: ago(r.createdAt, now) + ' ago', color: C.muted } })) },
 { slot: 'front_w', key: 'volume', icon: 'volume', title: 'VOLUME LEADERS', sub: 'Highest 24h volume · pump.fun tokens',
   rows: s => (s.volume || []).map(r => R(r, { midLabel: 'VOL', mid: usd(r.volume), right: { pill: r.change } })) },
 // All six info slots are occupied: reuse the unconnected squad-rank plaque for SUNK, keeping squad join and daily ranks.
 { slot: 'squad_ranks', key: 'prices', icon: 'ours', title: '$SUNK', ours: ['SUNK'], rows: () => [] },
 { slot: 'front_e', key: 'prices', icon: 'ours', title: '$AHOY', ours: ['AHOY'], rows: () => [] },
]);
const price = v => v == null ? '—' : v >= 1 ? '$' + v.toFixed(2) : '$' + v.toPrecision(3);
// 24 h hourly line: gradient fill, last-price dot, hi/lo + time axis labels
function chart(g, c, x0, y0, x1, y1) {
  g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x0, y0, x1 - x0, y1 - y0, 8); g.fill();
  const px1 = x1 - 74, py0 = y0 + 8, py1 = y1 - 18;   // plot area; right gutter for price labels, bottom for time labels
  g.strokeStyle = 'rgba(255,205,119,0.12)'; g.lineWidth = 1; for (let k = 0; k <= 2; k++) { const y = py0 + (py1 - py0) * k / 2; g.beginPath(); g.moveTo(x0 + 8, y); g.lineTo(px1, y); g.stroke(); }
  const t0 = c[0][0], t1 = c[c.length - 1][0], lo = Math.min(...c.map(p => p[1])), hi = Math.max(...c.map(p => p[1])), span = hi - lo || hi * .01 || 1;
  const pts = c.map(([t, v]) => [x0 + 8 + (t - t0) / Math.max(1, t1 - t0) * (px1 - x0 - 8), py1 - (v - lo) / span * (py1 - py0)]);
  const upC = c[c.length - 1][1] >= c[0][1] ? C.up : C.down, fill = g.createLinearGradient(0, py0, 0, py1);
  fill.addColorStop(0, upC === C.up ? 'rgba(63,210,127,0.45)' : 'rgba(255,90,79,0.45)'); fill.addColorStop(1, 'rgba(0,0,0,0)');
  g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineTo(pts[pts.length - 1][0], py1); g.lineTo(pts[0][0], py1); g.closePath(); g.fillStyle = fill; g.fill();
  g.beginPath(); pts.forEach(([x, y], k) => k ? g.lineTo(x, y) : g.moveTo(x, y)); g.strokeStyle = upC; g.lineWidth = 3.5; g.lineJoin = 'round'; g.stroke();
  const [lx, ly] = pts[pts.length - 1]; g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(lx, ly, 9, 0, 7); g.fill(); g.fillStyle = upC; g.beginPath(); g.arc(lx, ly, 5.5, 0, 7); g.fill();
  txt(g, price(hi), x1 - 8, py0 + 2, 19, C.muted, 'right', 66); txt(g, price(lo), x1 - 8, py1, 19, C.muted, 'right', 66);
  txt(g, '24h ago', x0 + 10, y1 - 8, 17, C.dim); txt(g, 'now', px1, y1 - 8, 17, C.dim, 'right'); }
// $AHOY / $SUNK: market cap, holder count, liquidity, volume, 24 h hourly price line. Every figure from a feed; "—" when a feed has no value.
function drawOurs(g, board, state) { const W = 640;
 board.ours.forEach((sym, i) => { const t = WATCH_TOKENS.find(t => t.sym === sym), p = state.prices?.[sym], d = state.details?.[sym], y0 = 84, x0 = 28, x1 = W - 28;
  g.fillStyle = i % 2 ? 'rgba(0,0,0,0.30)' : 'rgba(255,226,170,0.08)'; rr(g, x0, y0, x1 - x0, 386, 12); g.fill(); g.strokeStyle = 'rgba(255,205,119,0.3)'; g.lineWidth = 1.5; g.stroke();
  logo(g, { mint: t.ca, symbol: sym, imageUrl: p?.imageUrl }, x0 + 34, y0 + 32, 23);
  txt(g, '$' + sym, x0 + 66, y0 + 32, 46, C.gold, 'left', 150, true);
  const pw = pill(g, p?.change ?? null, x1 - 12, y0 + 32, 26, p ? (p.change == null ? '24h —' : (p.change >= 0 ? '+' : '') + p.change.toFixed(1) + '% 24h') : '—');
  txt(g, p ? price(p.price) + (p.stale ? ' · old' : '') : state.status?.prices === 'Loading…' ? 'Loading…' : 'Feed offline', x1 - 12 - pw - 14, y0 + 33, 32, C.parch, 'right', 200);
  const stats = [['MC', usd(p?.cap)], ['HOLDERS', d?.holders != null ? Number(d.holders).toLocaleString('en-US') : '—'], ['LIQ', usd(p?.liquidity)], ['VOL 24H', usd(p?.volume)]], cw = (x1 - x0 - 24) / 4;
  stats.forEach(([k, v], j) => { const cx = x0 + 12 + cw * j + cw / 2; txt(g, k, cx, y0 + 68, 18, C.dim, 'center', cw - 8); txt(g, v, cx, y0 + 90, 28, '#ffe9b8', 'center', cw - 8); });
  const c = (d?.chart || []).filter(x => Number.isFinite(x[0]) && Number.isFinite(x[1]) && x[1] > 0), cy0 = y0 + 132, cy1 = y0 + 372;
  if (c.length >= 2) chart(g, c, x0 + 12, cy0, x1 - 12, cy1);
  else { g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x0 + 12, cy0, x1 - x0 - 24, cy1 - cy0, 8); g.fill(); txt(g, d ? 'Chart feed offline' : 'Chart loading…', W / 2, (cy0 + cy1) / 2, 26, C.muted, 'center'); } }); }
export function wallRows(board, state, now = Date.now()) { return board.rows(state, now).slice(0, DEX_PANEL_ROWS); }
export function drawWallPanel(cv, board, state, now = Date.now()) { const g = cv.getContext('2d'), W = 640, H = 512; g.save(); g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
 frame(g, W, H);
 if (board.ours) { banner(g, W, board.title, board.icon, { y: 46, h: 56, size: 50 }); drawOurs(g, board, state); tapHint(g, W, H - 26, 20, 'Tap a token to open it on pump.fun · not financial advice'); g.restore(); return; }
 banner(g, W, board.title, board.icon, { sub: board.sub });
 const status = state.status?.[board.key] || 'Loading…', rows = wallRows(board, state, now);
 if (!rows.length) emptyState(g, W, status);
 rows.forEach((r, i) => tokenRow(g, W, i, DEX_PANEL_ROW_Y0 + i * DEX_PANEL_ROW_H, DEX_PANEL_ROW_H - 2, r, r.spec));
 footer(g, W, H, rows.length ? status : '', state.updated?.[board.key], now); g.restore(); }
// tap: uv -> the row's mint, or null (opens the token hall instead)
export function wallPanelMint(board, state, uv, now = Date.now()) { const y = (1 - uv.y) * 512; if (board.ours) { const i = y >= 80 && y < 480 ? 0 : -1; return i < 0 ? null : WATCH_TOKENS.find(t => t.sym === board.ours[i])?.ca || null; } const i = Math.floor((y - DEX_PANEL_ROW_Y0) / DEX_PANEL_ROW_H); if (i < 0 || i >= DEX_PANEL_ROWS) return null; return wallRows(board, state, now)[i]?.mint || null; }
