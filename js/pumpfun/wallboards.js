// Pure (three-free) board definitions + canvas drawing for Post's 5 remaining panel slots (BANKSY t2262u "Ok now work on all the boards").
// Same pattern as dexpanel.js: swap the slot mesh's material only (geometry, lighting, decor stay Post's),
// one canvas each (640x512, 320x256 on phones), built lazily with the hall, redrawn on data change / once a minute, no lights.
import { WATCH_TOKENS } from './market.js';
const DEX_PANEL_ROWS = 5, DEX_PANEL_ROW_Y0 = 136, DEX_PANEL_ROW_H = 58; // same row grid as dexpanel.js (logical 640x512)
const usd = v => v == null ? '—' : '$' + (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1) + 'K' : v >= 1 ? v.toFixed(2) : v.toPrecision(3));
const pct = v => v == null ? '24h —' : (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
const ago = (t, now) => { const m = Math.max(0, Math.floor((now - t) / 60000)); return m < 60 ? m + 'm old' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm old'; };
const up = v => v == null ? '#e9e5d6' : v < 0 ? '#ff817b' : '#54d08a';
// slot -> board. rows(state) returns [{mint, name, mid, right, rightColor, bar}] from real feed rows only.
const CALL_STEP_MS = 2500; // callout feed scrolls one event every 2.5 s (one small canvas upload)
const rotate = (rows, now) => rows.length <= DEX_PANEL_ROWS ? rows : rows.map((_, i) => rows[(i + Math.floor(now / CALL_STEP_MS)) % rows.length]);
// slot -> board. rows(state, now) returns [{mint, name, mid, right, rightColor, bar}] from real feed rows only. east_1 is DEX JUST PAID (dexpanel.js).
export const WALL_BOARDS = Object.freeze([
 { slot: 'west_1', key: 'bonding', title: 'ABOUT TO BOND', sub: '≈ bonding-curve progress · pump.fun curve pools',
   rows: s => (s.bonding || []).map(r => ({ mint: r.mint, name: r.symbol, mid: 'MC ' + usd(r.cap), right: '≈' + r.progress.toFixed(1) + '%', rightColor: '#ffcd77', bar: r.progress / 100 })) },
 { slot: 'east_2', key: 'callouts', title: 'CALLOUT FEED', sub: 'Live DexScreener boost events · PAID PROMOTION', tickMs: CALL_STEP_MS,
   rows: (s, now) => rotate((s.callouts || []).map(r => ({ mint: r.mint, name: r.symbol, mid: 'MC ' + usd(r.cap), right: '+' + (r.boost || r.amount) + ' boost · ' + ago(r.seenAt, now).replace(' old', ''), rightColor: '#ffcd77' })), now) },
 { slot: 'east_3', key: 'migrated', title: 'JUST MIGRATED', sub: 'pump.fun curves completed · PumpSwap · last 24h',
   rows: (s, now) => (s.migrated || []).map(r => ({ mint: r.mint, name: r.symbol, mid: 'MC ' + usd(r.cap), right: ago(r.createdAt, now), rightColor: '#a8bfb0' })) },
 { slot: 'front_w', key: 'volume', title: 'VOLUME LEADERS', sub: 'Highest 24h volume · pump.fun tokens',
   rows: s => (s.volume || []).map(r => ({ mint: r.mint, name: r.symbol, mid: 'VOL ' + usd(r.volume), right: pct(r.change), rightColor: up(r.change) })) },
 { slot: 'front_e', key: 'prices', title: '$AHOY  ·  $SUNK', ours: ['AHOY', 'SUNK'], rows: () => [] },
]);
// $AHOY / $SUNK: market cap, holder count, 24 h hourly price line. Every figure from a feed; "—" when a feed has no value.
function drawOurs(g, board, state, now, text) { const W = 640;
 board.ours.forEach((sym, i) => { const t = WATCH_TOKENS.find(t => t.sym === sym), p = state.prices?.[sym], d = state.details?.[sym], y0 = 80 + i * 200;
  g.fillStyle = '#254038'; g.fillRect(24, y0, W - 48, 186);
  text('$' + sym, 40, y0 + 30, 44, '#54d08a'); text(p ? usd(p.price) : state.status?.prices === 'Loading…' ? 'Loading…' : 'Feed offline', 330, y0 + 30, 30, '#e9e5d6', 'right');
  text(p ? pct(p.change) + ' 24h' + (p.stale ? ' · old' : '') : '', W - 40, y0 + 30, 28, up(p?.change), 'right');
  text('MC ' + usd(p ? p.cap ?? p.fdv : null), 40, y0 + 66, 28, '#ffcd77'); text('HOLDERS ' + (d?.holders != null ? Number(d.holders).toLocaleString('en-US') : '—'), W - 40, y0 + 66, 28, '#ffcd77', 'right');
  text('LIQ ' + usd(p?.liquidity), 40, y0 + 96, 26, '#e9e5d6'); text('VOL 24h ' + usd(p?.volume), W - 40, y0 + 96, 26, '#e9e5d6', 'right');
  const c = (d?.chart || []).filter(x => x[1] > 0), cx0 = 40, cx1 = W - 40, cy0 = y0 + 114, cy1 = y0 + 180;
  g.strokeStyle = 'rgba(168,191,176,0.25)'; g.lineWidth = 1; g.strokeRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
  if (c.length >= 2) { const t0 = c[0][0], t1 = c[c.length - 1][0] || t0 + 1, lo = Math.min(...c.map(x => x[1])), hi = Math.max(...c.map(x => x[1])), span = hi - lo || hi * .01 || 1;
   g.beginPath(); c.forEach(([tt, v], k) => { const x = cx0 + (tt - t0) / Math.max(1, t1 - t0) * (cx1 - cx0), y = cy1 - 4 - (v - lo) / span * (cy1 - cy0 - 8); k ? g.lineTo(x, y) : g.moveTo(x, y); });
   g.strokeStyle = c[c.length - 1][1] >= c[0][1] ? '#54d08a' : '#ff817b'; g.lineWidth = 4; g.stroke(); text('24h · hourly', cx1 - 8, cy1 - 10, 17, '#a8bfb0', 'right'); }
  else text(d ? 'Chart feed offline' : 'Chart loading…', W / 2, (cy0 + cy1) / 2, 26, '#a8bfb0', 'center');
  void t; }); }
export function wallRows(board, state, now = Date.now()) { return board.rows(state, now).slice(0, DEX_PANEL_ROWS); }
export function drawWallPanel(cv, board, state, now = Date.now()) { const g = cv.getContext('2d'), W = 640, H = 512; g.save(); g.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
 g.fillStyle = '#101f1c'; g.fillRect(0, 0, W, H); g.strokeStyle = '#54d08a'; g.lineWidth = 8; g.strokeRect(6, 6, W - 12, H - 12); g.textBaseline = 'middle';
 const text = (s, x, y, n, c = '#e9e5d6', a = 'left') => { g.font = `${n}px "Just Another Hand",Georgia,sans-serif`; g.fillStyle = c; g.textAlign = a; g.fillText(String(s), x, y); };
 text(board.title, W / 2, 44, 56, '#ffcd77', 'center');
 if (board.ours) { drawOurs(g, board, state, now, text); text('Tap a token to open it on pump.fun · MC/price DexScreener · holders & chart GeckoTerminal', W / 2, H - 26, 19, '#a8bfb0', 'center'); g.restore(); return; }
 text(board.sub, W / 2, 98, 25, '#a8bfb0', 'center');
 const status = state.status?.[board.key] || 'Loading…', rows = wallRows(board, state, now);
 const live = rows.length > 0;
 if (!live) { const off = /offline/i.test(status); text(status === 'Loading…' ? 'Loading…' : off ? 'Feed offline' : 'Nothing to show right now', W / 2, 260, 46, '#e9e5d6', 'center');
  text(status === 'Loading…' ? 'Fetching a free snapshot' : off ? 'Retrying while you are nearby' : status.slice(0, 56), W / 2, 312, 24, '#a8bfb0', 'center'); }
 else rows.forEach((r, i) => { const y = DEX_PANEL_ROW_Y0 + i * DEX_PANEL_ROW_H, h = DEX_PANEL_ROW_H - 10, cy = y + h / 2; g.fillStyle = '#254038'; g.fillRect(28, y, W - 56, h);
  if (r.bar != null) { g.fillStyle = 'rgba(84,208,138,0.28)'; g.fillRect(28, y, (W - 56) * Math.max(0, Math.min(1, r.bar)), h); }
  text(`${i + 1}. ${String(r.name || r.mint.slice(0, 6)).slice(0, 12)}`, 44, cy, 36, '#54d08a'); text(r.mid, 430, cy, 27, '#e9e5d6', 'right'); text(r.right, W - 44, cy, 27, r.rightColor || '#ffcd77', 'right'); });
 text(live ? status.slice(0, 60) : '', W / 2, H - 58, 21, '#a8bfb0', 'center'); text('Tap a token to open it on pump.fun · not financial advice', W / 2, H - 30, 22, '#a8bfb0', 'center'); g.restore(); }
// tap: uv -> the row's mint, or null (opens the token hall instead)
export function wallPanelMint(board, state, uv, now = Date.now()) { const y = (1 - uv.y) * 512; if (board.ours) { const i = y >= 80 && y < 280 ? 0 : y >= 280 && y < 480 ? 1 : -1; return i < 0 ? null : WATCH_TOKENS.find(t => t.sym === board.ours[i])?.ca || null; } const i = Math.floor((y - DEX_PANEL_ROW_Y0) / DEX_PANEL_ROW_H); if (i < 0 || i >= DEX_PANEL_ROWS) return null; return wallRows(board, state, now)[i]?.mint || null; }
