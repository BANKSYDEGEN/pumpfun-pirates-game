// Game-over SHARE: draws a 1200x675 PUMPFUN PIRATES score card on a canvas, then shares it
// (navigator.share with a PNG file on phones) or, on desktop, opens an in-game modal: preview, download, copy, post on X.
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

// Native file share only where it is genuinely useful: phones / tablets (coarse pointer) with file sharing.
// Desktop Chrome / Edge / Safari also expose navigator.share, but that opens the OS share sheet (no X, often
// nothing useful) or rejects, and a popup opened after it is blocked, so desktop gets the in-game share modal.
function useNativeShare() {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  return coarse && !!(navigator.canShare && navigator.share);
}
export const xIntentUrl = (stats) => `https://x.com/intent/post?text=${encodeURIComponent(shareText(stats))}&url=${encodeURIComponent(GAME_URL)}`;

export async function shareScore(stats, { onStatus = () => {} } = {}) {
  if (!useNativeShare()) { openShareModal(stats, onStatus); return 'modal'; } // opened synchronously, inside the click
  const p = pending || prepareShare(stats);
  const { blob } = await p;
  const text = shareText(stats), file = new File([blob], 'pumpfun-pirates-score.png', { type: 'image/png' });
  if (navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], text: `${text} ${GAME_URL}` }); onStatus('shared'); return 'shared'; }
    catch (e) { if (e && e.name === 'AbortError') { onStatus('cancelled'); return 'cancelled'; } /* fall through to the share modal */ }
  }
  openShareModal(stats, onStatus); return 'modal';
}

// ---------- desktop share modal (preview + DOWNLOAD PNG / COPY IMAGE / POST ON X) ----------
const CSS = `
#pfp-share{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,12,0.72);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font-family:'Just Another Hand',cursive;letter-spacing:0.04em}
#pfp-share .ps-panel{position:relative;width:min(640px,100%);max-height:calc(100% - 8px);overflow:auto;background:#161616;border:1px solid rgba(255,205,119,0.35);border-radius:22px;padding:18px 20px 20px;box-shadow:0 18px 60px rgba(0,0,0,0.6),0 0 40px rgba(250,13,13,0.12);color:#fff;text-align:center}
#pfp-share h2{margin:0 0 10px;font-size:34px;font-weight:400;color:#ffcd77;line-height:1}
#pfp-share .ps-prev{width:100%;aspect-ratio:16/9;border-radius:12px;border:1px solid rgba(255,205,119,0.25);background:#0d1118 center/contain no-repeat;display:grid;place-items:center;color:rgba(255,255,255,0.5);font-size:22px;overflow:hidden}
#pfp-share .ps-prev img{width:100%;height:100%;object-fit:contain;display:block}
#pfp-share .ps-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:14px}
#pfp-share .ps-row button{font-family:inherit;letter-spacing:0.05em;font-size:22px;padding:8px 18px;border-radius:999px;cursor:pointer;border:1px solid #ffcd77;background:transparent;color:#ffcd77;min-width:150px}
#pfp-share .ps-row button:hover:not(:disabled){background:rgba(255,205,119,0.12)}
#pfp-share .ps-row button:disabled{opacity:0.45;cursor:default}
#pfp-share .ps-row button.ps-x{background:#fa0d0d;border-color:#fa0d0d;color:#fff;box-shadow:0 4px 18px rgba(250,13,13,0.35)}
#pfp-share .ps-row button.ps-x:hover{background:#ff2a2a}
#pfp-share .ps-note{margin-top:10px;font-size:19px;color:rgba(255,255,255,0.65);min-height:1.2em}
#pfp-share .ps-close{position:absolute;top:10px;right:12px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.25);background:rgba(255,255,255,0.06);color:#fff;font:20px/1 system-ui,sans-serif;cursor:pointer;display:grid;place-items:center}
#pfp-share .ps-close:hover{border-color:#fa0d0d;color:#fa0d0d}
`;
let modal = null;
const canCopyImage = () => !!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) && window.isSecureContext !== false;

export function closeShareModal() {
  if (!modal) return;
  removeEventListener('keydown', modal.onKey, true);
  if (modal.url) URL.revokeObjectURL(modal.url);
  modal.el.remove(); modal = null;
}

export function openShareModal(stats, onStatus = () => {}) {
  closeShareModal();
  if (!document.getElementById('pfp-share-css')) { const st = document.createElement('style'); st.id = 'pfp-share-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement('div'); el.id = 'pfp-share'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Share your score card');
  el.innerHTML = `<div class="ps-panel">
    <button class="ps-close" aria-label="Close">✕</button>
    <h2>SHARE YOUR SCORE</h2>
    <div class="ps-prev">Painting your card…</div>
    <div class="ps-row">
      <button class="ps-dl" disabled>⤓ DOWNLOAD PNG</button>
      ${canCopyImage() ? '<button class="ps-copy" disabled>⧉ COPY IMAGE</button>' : ''}
      <button class="ps-x">POST ON X</button>
    </div>
    <div class="ps-note">Download or copy the card, then attach it to your X post.</div>
  </div>`;
  document.body.appendChild(el);
  const q = (c) => el.querySelector(c), note = q('.ps-note');
  const m = modal = { el, blob: null, url: null };
  m.onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeShareModal(); } };
  addEventListener('keydown', m.onKey, true);
  el.addEventListener('click', (e) => { if (e.target === el) closeShareModal(); });
  q('.ps-close').onclick = closeShareModal;
  // POST ON X: window.open straight from the click handler so the popup blocker lets it through
  q('.ps-x').onclick = () => { window.open(xIntentUrl(stats), '_blank', 'noopener'); onStatus('posted'); };
  q('.ps-dl').onclick = () => {
    if (!m.url) return;
    const a = document.createElement('a'); a.href = m.url; a.download = 'pumpfun-pirates-score.png';
    document.body.appendChild(a); a.click(); a.remove();
    note.textContent = 'Downloaded! Attach it to your X post.'; onStatus('downloaded');
  };
  const copyBtn = q('.ps-copy');
  if (copyBtn) copyBtn.onclick = async () => {
    if (!m.blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': m.blob })]);
      copyBtn.textContent = '✓ Copied!'; note.textContent = 'Copied! Paste it straight into your X post.'; onStatus('copied');
      setTimeout(() => { if (modal === m) copyBtn.textContent = '⧉ COPY IMAGE'; }, 2000);
    } catch { copyBtn.remove(); note.textContent = 'This browser blocked copying. Use DOWNLOAD PNG instead.'; }
  };
  (pending || prepareShare(stats)).then(({ blob }) => {
    if (modal !== m || !blob) return;
    m.blob = blob; m.url = URL.createObjectURL(blob);
    const img = new Image(); img.alt = 'PUMPFUN PIRATES score card'; img.src = m.url;
    const prev = q('.ps-prev'); prev.textContent = ''; prev.appendChild(img);
    q('.ps-dl').disabled = false; if (copyBtn) copyBtn.disabled = false;
  }).catch(() => { if (modal === m) q('.ps-prev').textContent = 'Could not paint the card.'; });
  q('.ps-x').focus();
  return el;
}
