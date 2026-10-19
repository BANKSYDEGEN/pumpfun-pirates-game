// Game-over SHARE: draws a 1200x675 PUMPFUN PIRATES score card on a canvas, then shares it
// (navigator.share with a PNG file on iOS / Android) or falls back to downloading the PNG + an X post intent.
// Nothing here touches a wallet or the leaderboard; the wallet is only printed shortened.
import { shortWallet } from './wallet.js';

export const GAME_URL = 'https://banksydegen.github.io/pumpfun-pirates-game/';
const RED = '#fa0d0d', GOLD = '#ffcd77', DARK = '#161616', FONT = '"Just Another Hand", cursive';

const imgCache = {};
function loadImg(src) {
  return imgCache[src] || (imgCache[src] = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
}
export function shareText(s) {
  return `Sunk ${s.sunk} rug ship${s.sunk === 1 ? '' : 's'} and hit wave ${s.wave} in PUMPFUN PIRATES 🏴‍☠️ $AHOY @PUMPFUNPIRATES`;
}
// seeded rain so a given card always looks the same
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// s = { score, wave, sunk, gold, name, wallet, captain, skin }
export async function drawCard(s) {
  try { await Promise.all([document.fonts.load(`64px ${FONT}`), document.fonts.load(`140px ${FONT}`)]); await document.fonts.ready; } catch { /* draws with fallback font */ }
  const [skull, word, cap] = await Promise.all([loadImg('assets/skull_transparent.png'), loadImg('assets/pumpfun_pirates_wordmark.png'), s.captain ? loadImg(`assets/captains/${s.captain}.jpg`) : null]);
  const W = 1200, H = 675, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // stormy sea backdrop
  let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1d2633'); gr.addColorStop(0.55, '#121820'); gr.addColorStop(1, '#0a0d12');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  gr = g.createRadialGradient(W * 0.3, H * 0.45, 40, W * 0.3, H * 0.45, 520); gr.addColorStop(0, 'rgba(250,13,13,0.22)'); gr.addColorStop(1, 'rgba(250,13,13,0)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#0f2a33'; g.beginPath(); g.moveTo(0, H * 0.8);
  for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.8 + Math.sin(x / 55) * 9 + Math.sin(x / 23) * 4);
  g.lineTo(W, H); g.lineTo(0, H); g.fill();
  const r = rng((s.score | 0) + 7); g.strokeStyle = 'rgba(200,215,230,0.13)'; g.lineWidth = 2;
  for (let i = 0; i < 140; i++) { const x = r() * W, y = r() * H, l = 18 + r() * 26; g.beginPath(); g.moveTo(x, y); g.lineTo(x - l * 0.25, y + l); g.stroke(); }
  // frame
  g.strokeStyle = GOLD; g.lineWidth = 4; g.globalAlpha = 0.55; g.strokeRect(18, 18, W - 36, H - 36); g.globalAlpha = 1;
  // left: skull + wordmark + $AHOY
  if (skull) { g.save(); g.shadowColor = 'rgba(250,13,13,0.6)'; g.shadowBlur = 40; g.drawImage(skull, 120, 52, 200, 200 * skull.height / skull.width); g.restore(); }
  if (word) g.drawImage(word, 52, 262, 340, 340 * word.height / word.width);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = `76px ${FONT}`; g.fillStyle = GOLD; g.fillText('$AHOY', 222, 515);
  g.font = `30px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillText('STORM HUNT', 222, 552);
  // right: stats panel
  const px = 440, py = 58, pw = 712, ph = 520;
  g.fillStyle = 'rgba(22,22,22,0.78)'; roundRect(g, px, py, pw, ph, 28); g.fill();
  g.strokeStyle = 'rgba(255,205,119,0.35)'; g.lineWidth = 2; roundRect(g, px, py, pw, ph, 28); g.stroke();
  g.textAlign = 'left'; g.font = `44px ${FONT}`; g.fillStyle = RED; g.fillText("DAVY JONES' LOCKER", px + 40, py + 66);
  g.font = `34px ${FONT}`; g.fillStyle = GOLD; g.fillText('SCORE', px + 40, py + 122);
  g.font = `150px ${FONT}`; g.fillStyle = '#fff'; g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowOffsetY = 5; g.fillText(fmt(s.score), px + 36, py + 250); g.restore();
  const cols = [['WAVE', s.wave], ['SHIPS SUNK', s.sunk], ['GOLD', s.gold]];
  cols.forEach(([k, v], i) => { const x = px + 40 + i * 220; g.font = `30px ${FONT}`; g.fillStyle = GOLD; g.fillText(k, x, py + 312); g.font = `72px ${FONT}`; g.fillStyle = i === 2 ? GOLD : '#fff'; g.fillText(fmt(v), x, py + 378); });
  // captain row
  const cy = py + 410;
  g.fillStyle = 'rgba(255,205,119,0.18)'; g.fillRect(px + 40, cy, pw - 80, 2);
  let tx = px + 40;
  if (cap) { g.save(); roundRect(g, px + 40, cy + 18, 76, 76, 14); g.clip(); g.drawImage(cap, px + 40, cy + 18, 76, 76); g.restore(); g.strokeStyle = GOLD; g.lineWidth = 3; roundRect(g, px + 40, cy + 18, 76, 76, 14); g.stroke(); tx += 96; }
  g.font = `40px ${FONT}`; g.fillStyle = GOLD;
  const who = (s.name ? s.name.toUpperCase() : `CAPT. #${s.captain || '?'}`);
  g.fillText(clip(g, who, 330), tx, cy + 56);
  g.font = `28px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.7)';
  g.fillText([s.wallet ? shortWallet(s.wallet) : '', s.skin ? `${s.skin}` : ''].filter(Boolean).join('  ·  '), tx, cy + 90);
  g.textAlign = 'right'; g.font = `30px ${FONT}`; g.fillStyle = 'rgba(255,255,255,0.85)';
  g.fillText('banksydegen.github.io/pumpfun-pirates-game', px + pw - 36, cy + 90);
  g.fillStyle = RED; g.font = `34px ${FONT}`; g.fillText('PLAY FREE ▸', px + pw - 36, cy + 52);
  return c;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function fmt(n) { return (n || 0).toLocaleString('en-US'); }
function clip(g, t, max) { if (g.measureText(t).width <= max) return t; while (t.length > 1 && g.measureText(t + '…').width > max) t = t.slice(0, -1); return t + '…'; }
export const cardBlob = (c) => new Promise((res) => c.toBlob(res, 'image/png'));

// Pre-render on game over so the tap that shares still has its user gesture (iOS needs that for the share sheet).
let pending = null;
export function prepareShare(stats) { pending = drawCard(stats).then(async (c) => ({ c, blob: await cardBlob(c), stats })); return pending; }

export async function shareScore(stats, { onStatus = () => {} } = {}) {
  const p = pending || prepareShare(stats);
  const { blob } = await p;
  const text = shareText(stats), file = new File([blob], 'pumpfun-pirates-score.png', { type: 'image/png' });
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${text} ${GAME_URL}` }); onStatus('shared'); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') { onStatus('cancelled'); return 'cancelled'; } /* fall through to download */ }
  }
  // fallback: download the card + open an X post (the PNG can be attached by hand)
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'pumpfun-pirates-score.png'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(GAME_URL)}`, '_blank', 'noopener');
  onStatus('downloaded'); return 'downloaded';
}
