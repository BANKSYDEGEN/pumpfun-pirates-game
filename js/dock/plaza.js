// PUMPFUN PIRATES · [v103] harbor plaza (BANKSY): the WAVES + ARENA boards are LIVE LEADERBOARDS (top 10, drawn on the boards
// from the existing Waves + Battle Royale boards, refreshed every 60 s while you are in the harbor; read-only), the three token
// billboards ($SUNK / $AHOY / $PUMP: live price strip + a CA / copy / DexScreener panel), and the full-board panel.
// Draw calls: both leaderboard screens share ONE canvas texture + ONE merged mesh (+1 draw call); the billboards are static atlas
// quads in the baked street mesh (their price strip redraws in the shared atlas, 0 extra).
import * as THREE from 'three';
import * as CO from '../island/coast.js';
import { PLAZA_BOARD } from '../island/foot.js';
import { ISLAND_TOKENS } from '../config.js';
import { leaderboard } from '../leaderboard.js';
import { fetchKillsTop } from '../pvpSave.js';
import { copyText } from '../tokenChip.js';
import { isBase58 } from '../safe.js'; // [security] third-party (DexScreener) values are validated before they reach a link

const CW = 768, CH = 564, FONT = (px) => `${px}px "Just Another Hand", cursive`;
const BOARDS = [{ id: 'waves', title: 'STORM HUNT · TOP PIRATES', col: '#fa0d0d', unit: 'score' }, { id: 'arena', title: 'KING OF THE HILL · TOP KILLS', col: '#2a6df4', unit: 'kills' }];
const short = (w) => w && w.length > 10 ? `${w.slice(0, 4)}…${w.slice(-4)}` : (w || '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (+n || 0).toLocaleString('en-US');

async function rowsFor(id, n) {
  if (id === 'waves') return (await leaderboard.getTop(n, 'all')).map(r => ({ name: r.name || short(r.wallet) || 'PIRATE', sub: r.name && r.wallet ? short(r.wallet) : '', v: fmt(r.score) }));
  return (await fetchKillsTop('all')).slice(0, n).map(r => ({ name: r.name || 'PIRATE', sub: r.wallet ? short(r.wallet) : '', v: fmt(r.kills), kd: `K/D ${((+r.kills || 0) / Math.max(1, +r.deaths || 0)).toFixed(2)}` }));
}

export function createPlaza({ world, ctx = {} }) {
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH * 2; const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  // ---- the two screens: one merged geometry in the foot (town-local -> foot world) frame ----
  const B = PLAZA_BOARD, geos = [];
  BOARDS.forEach((b, i) => { const q = CO.PLAZA_POIS.find(p => p.id === b.id); if (!q) return; const [x, z] = CO.t2w(q.lx, q.lz), yaw = CO.t2wYaw(q.yaw); // shared with frame + collider + prompt
    const pg = new THREE.PlaneGeometry(B.w, B.h), uv = pg.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, (1 - i) * 0.5 + uv.getY(k) * 0.5);
    pg.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, CO.QUAY.y + B.y, z).add(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(B.face)), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1)));
    geos.push(pg); });
  let mesh = null;
  if (geos.length) { const pos = [], uvs = [], idx = []; let base = 0;
    for (const pg of geos) { pos.push(...pg.attributes.position.array); uvs.push(...pg.attributes.uv.array); idx.push(...pg.index.array.map(v => v + base)); base += pg.attributes.position.count; pg.dispose(); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geo.setIndex(idx);
    mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); mesh.name = 'plaza_leaderboards'; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    (world.footGroup || world.root).add(mesh); }
  const draw = (i, b, rows, err) => {
    const y0 = i * CH; g.fillStyle = '#161616'; g.fillRect(0, y0, CW, CH); g.strokeStyle = '#ffcd77'; g.lineWidth = 8; g.strokeRect(4, y0 + 4, CW - 8, CH - 8);
    g.fillStyle = b.col; g.fillRect(12, y0 + 12, CW - 24, 66);
    g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = FONT(60); g.fillStyle = '#fff'; g.fillText(b.title, CW / 2, y0 + 47);
    if (err || !rows.length) { g.font = FONT(46); g.fillStyle = '#ffcd77'; g.fillText(err ? 'board offline · back soon' : 'no scores yet · be the first!', CW / 2, y0 + CH / 2); }
    rows.slice(0, 10).forEach((r, k) => { const y = y0 + 112 + k * 44;
      if (k % 2) { g.fillStyle = 'rgba(255,205,119,0.07)'; g.fillRect(14, y - 21, CW - 28, 42); }
      g.textAlign = 'left'; g.font = FONT(42); g.fillStyle = k < 3 ? ['#ffd700', '#e0e0e0', '#cd7f32'][k] : '#ffcd77'; g.fillText(`${k + 1}.`, 28, y);
      g.fillStyle = '#fff'; let nm = r.name; g.font = FONT(42); while (g.measureText(nm).width > 380 && nm.length > 3) nm = nm.slice(0, -2) + '…'; g.fillText(nm, 84, y);
      if (r.sub) { const w = g.measureText(nm).width; g.font = FONT(28); g.fillStyle = 'rgba(255,255,255,0.55)'; if (84 + w + 12 + g.measureText(r.sub).width < 560) g.fillText(r.sub, 84 + w + 12, y + 3); }
      g.textAlign = 'right'; g.font = FONT(44); g.fillStyle = '#ffcd77'; g.fillText(r.v, r.kd ? CW - 150 : CW - 28, y);
      if (r.kd) { g.font = FONT(30); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillText(r.kd, CW - 28, y + 2); } });
    g.textAlign = 'center'; g.font = FONT(30); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText('press E for the full board', CW / 2, y0 + CH - 26);
  };
  let lastBoards = 0, busyB = false;
  async function refreshBoards() { if (busyB) return; busyB = true; lastBoards = performance.now();
    await Promise.all(BOARDS.map(async (b, i) => { let rows = [], err = false; try { rows = await rowsFor(b.id, 10); } catch (e) { err = true; console.warn('[plaza board]', b.id, e.message); } draw(i, b, rows, err); }));
    tex.needsUpdate = true; busyB = false; }
  BOARDS.forEach((b, i) => draw(i, b, [], false)); tex.needsUpdate = true;
  // [v240] the hidden $HQ / $RETARDIO hall posters (coast.js hallTokenHidden, &hallboards=1 = back) are not fetched
  // ---- token prices on the billboards' live strip (shared atlas), DexScreener tokens API, every 2 min ----
  const TOK = ISLAND_TOKENS.filter(t => !CO.hallTokenHidden(t.sym)).map(t => ({ ...t, chart: t.dex, pair: null }));
  const fmtP = (v) => { const n = +v; if (!n) return '—'; return n >= 1 ? '$' + n.toFixed(2) : n >= 0.01 ? '$' + n.toFixed(4) : '$' + n.toPrecision(3); };
  // [v112] BANKSY: "on token boards show mc not price": DexScreener marketCap (fdv when missing), short: MC $123.4K / MC $1.2M
  const fmtMC = (p) => { const n = +(p?.marketCap || p?.fdv || 0); if (!(n > 0)) return 'MC —'; const [d, u] = n >= 1e9 ? [1e9, 'B'] : n >= 1e6 ? [1e6, 'M'] : n >= 1e3 ? [1e3, 'K'] : [1, '']; const v = n / d; return 'MC $' + (u ? (v >= 100 ? v.toFixed(0) : v.toFixed(1)) : v.toFixed(0)) + u; };
  let lastTok = 0;
  async function refreshTokens() { lastTok = performance.now();
    await Promise.all(TOK.map(async (t) => { try {
      const j = await (await fetch('https://api.dexscreener.com/latest/dex/tokens/' + t.ca)).json();
      const p = (j.pairs || []).filter(q => q.chainId === 'solana').sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0]; if (!p) throw new Error('no pair');
      t.pair = p; if (!t.chart) t.chart = p.url; const ch = +(p.priceChange?.h24 ?? 0);
      world.atlas?.drawTokenBoard(t.sym, [fmtMC(p), `${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}% 24h`, ch >= 0 ? '#7cff6b' : '#ff6b6b']);
    } catch { if (!t.pair) world.atlas?.drawTokenBoard(t.sym, ['$' + t.sym, 'press E · CA + chart']); } }));
    if (panel.dataset.sym) showToken(panel.dataset.sym); }
  // ---- the panel (full leaderboard / token CA) ----
  const panel = document.createElement('div'); panel.id = 'plaza-panel'; panel.className = 'plaza-panel hidden'; panel.setAttribute('role', 'dialog'); document.body.appendChild(panel);
  const close = () => { panel.classList.add('hidden'); panel.dataset.sym = ''; panel.dataset.board = ''; };
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !panel.classList.contains('hidden')) { e.stopPropagation(); close(); } }, true);
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  const head = (title, col) => `<div class="pz-head" style="--pz:${col}"><b>${title}</b><button type="button" class="pz-x" aria-label="Close">✕</button></div>`;
  async function openBoard(id) {
    const b = BOARDS.find(x => x.id === id); if (!b) return; panel.dataset.board = id; panel.dataset.sym = '';
    const act = id === 'waves' ? { t: '▶ START STORM HUNT', f: ctx.startWaves } : { t: '⚔ JOIN BATTLE / SPECTATE', f: ctx.openArena };
    panel.innerHTML = `${head(b.title, b.col)}<ol class="pz-list"><li class="empty">Loading…</li></ol><div class="pz-row">${act.f ? `<button type="button" class="pz-go">${act.t}</button>` : ''}</div><small class="pz-foot">${id === 'waves' ? 'best Waves score per pirate · all time' : 'confirmed kills · Harbor + Arena · gun, sword & boat sinks · all time'}</small>`;
    panel.querySelector('.pz-x').onclick = close; const go = panel.querySelector('.pz-go'); if (go) go.onclick = () => { close(); act.f(); };
    panel.classList.remove('hidden');
    let rows = [], err = false; try { rows = await rowsFor(id, 50); } catch { err = true; }
    if (panel.dataset.board !== id) return;
    const F = id === 'arena' ? window.PFP_FRIENDS : null, meN = String(F?.me || '').toLowerCase(); // [v356 friends] "+👥" add a King of the Hill pirate as a friend
    const frB = (n) => { if (!F || !n || n === 'PIRATE' || n.toLowerCase() === meN) return ''; const st = F.relationOf?.(n) || ''; return st === 'friend' ? '<small class="pz-fr-ok" title="Friend">👥</small>' : `<button type="button" class="pz-fr" data-fr="${esc(n)}" title="Add friend" aria-label="Add ${esc(n)} as a friend"${st === 'sent' ? ' disabled' : ''}>${st === 'sent' ? '…' : '+👥'}</button>`; };
    panel.querySelector('.pz-list').innerHTML = rows.length ? rows.map((r, k) => `<li><i>${k + 1}.</i><span>${esc(r.name)}${r.sub ? ` <small>${esc(r.sub)}</small>` : ''}${frB(r.name)}</span><b>${esc(r.v)}</b>${r.kd ? `<small class="pz-kd">${esc(r.kd)}</small>` : ''}</li>`).join('')
      : `<li class="empty">${err ? 'Board offline, try again soon.' : 'No scores yet. Take the top spot!'}</li>`;
    panel.querySelectorAll('.pz-fr').forEach((b) => { b.onclick = async (e) => { e.stopPropagation(); b.disabled = true; b.textContent = '…'; await F?.request?.(b.dataset.fr); }; });
  }
  function showToken(sym) {
    const t = TOK.find(q => q.sym === sym) || TOK[0]; panel.dataset.sym = t.sym; panel.dataset.board = '';
    const p = t.pair, ch = +(p?.priceChange?.h24 ?? 0), chart = t.chart || (p && typeof p.url === 'string' && /^https:\/\/dexscreener\.com\/[A-Za-z0-9/_-]+$/.test(p.url) ? p.url : '') || `https://dexscreener.com/solana/${isBase58(t.ca) ? t.ca : ''}`;
    // [v108] title, logo, CA + copy, DexScreener link only (BANKSY); [v111] + the live price strip, CA first4…last4 on narrow screens (copy = full CA)
    const logo = t.logo ? `<img class="pz-logo" src="${esc(t.logo)}" alt="${esc(t.title)} logo" width="96" height="96">` : `<span class="pz-logo pz-skull" style="--pz:${t.color}"><img src="assets/skull_transparent.png" alt="" width="64" height="64"></span>`;
    panel.innerHTML = `${head(esc(t.title || '$' + t.sym), t.color)}
      <div class="pz-tabs">${TOK.map(q => `<button type="button" data-sym="${q.sym}" class="${q.sym === t.sym ? 'on' : ''}" style="--pz:${q.color}">${esc(q.title || '$' + q.sym)}</button>`).join('')}</div>
      <div class="pz-logo-row">${logo}</div>
      <div class="pz-price">${p ? `${fmtMC(p)} <span style="color:${ch >= 0 ? '#7cff6b' : '#ff6b6b'}">${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}% 24h</span>` : 'market cap loading…'}</div>
      <div class="pz-ca"><code title="${esc(t.ca)}"><span class="pz-ca-full">${esc(t.ca)}</span><span class="pz-ca-short">${esc(t.ca.slice(0, 4) + '…' + t.ca.slice(-4))}</span></code><button type="button" class="pz-copy">COPY CA</button></div>
      <div class="pz-row"><a class="pz-go" href="${esc(chart)}" target="_blank" rel="noopener">OPEN CHART ON DEXSCREENER ▸</a></div>`;
    panel.querySelector('.pz-x').onclick = close;
    panel.querySelector('.pz-copy').onclick = async (e) => { const ok = await copyText(t.ca); e.target.textContent = ok ? 'COPIED ✓' : 'COPY FAILED'; setTimeout(() => { if (e.target.isConnected) e.target.textContent = 'COPY CA'; }, 1800); };
    panel.querySelectorAll('.pz-tabs button').forEach(b => b.onclick = () => showToken(b.dataset.sym));
    panel.classList.remove('hidden');
  }
  // ---- tick: refresh while the harbor world is shown (boards every 60 s, prices every 120 s) ----
  function update(on) { if (!on) { if (!panel.classList.contains('hidden')) close(); return; } const t = performance.now();
    if (!lastBoards || t - lastBoards > 60000) refreshBoards(); if (!lastTok || t - lastTok > 120000) refreshTokens(); }
  return { update, openBoard, openToken: showToken, close, refreshBoards, mesh, get open() { return !panel.classList.contains('hidden'); } };
}
