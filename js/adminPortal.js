// Lazy owner-only fleet intelligence. No telemetry subscription or polling while closed.
// Every data call is owner-gated by pvp/admin.ts; SQL RPCs are service-role only.
import { escHtml as esc } from './safe.js';
import { itemInfo } from './inventory/catalog.js';

export const LIVE_POLL_MS = 5000, STATS_POLL_MS = 60000;
export const fmt = n => n == null ? '—' : Number(n).toLocaleString('en-US');
export function areaOf(p) {
  if (p.mode === 'hull') return 'Hull';
  if (p.mode === 'cottage') return 'House';
  if (p.w === 'arena' || /arena/i.test(p.room || '')) return 'Arena';
  if (p.mode === 'foot' || p.foot) return 'Island';
  if (p.mode === 'sea' || p.mode === 'canoe') return 'Sea';
  return /harbor/i.test(p.room || '') ? 'Harbor' : 'Unknown';
}
export function sessionLabel(p, now = Date.now()) {
  const at = Date.parse(p.session_started_at);
  if (!Number.isFinite(at) || at > now) return '—';
  const m = Math.floor((now - at) / 60000);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
export function filterPlayers(players, query, area) {
  return players.filter(p => (!area || areaOf(p) === area) && `${p.name} ${p.room} ${areaOf(p)}`.toLowerCase().includes(query.toLowerCase()));
}
const CSS = `
#pfp-admin-portal{position:fixed;inset:0;z-index:240;background:radial-gradient(ellipse at 25% 0,#173b42,#0a1218 65%);color:#ecdfbe;font:14px system-ui,sans-serif;display:none;overflow:auto;overscroll-behavior:contain;color-scheme:dark;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
#pfp-admin-portal.on{display:block}#pfp-admin-portal *{box-sizing:border-box}#pfp-admin-portal .ap-wrap{max-width:1600px;margin:auto;padding:20px}
#pfp-admin-portal header{display:flex;align-items:center;gap:12px;flex-wrap:wrap;border-bottom:1px solid #c29b4c66;padding-bottom:16px;margin-bottom:16px}#pfp-admin-portal h1{font-size:clamp(20px,3vw,32px);letter-spacing:.09em;margin:0;color:#ffe1a0}#pfp-admin-portal .ap-brand{flex:1}#pfp-admin-portal .ap-eyebrow{font-size:10px;letter-spacing:.23em;color:#d0ac62;margin-bottom:5px}#pfp-admin-portal button,#pfp-admin-portal input,#pfp-admin-portal select{font:inherit;min-height:42px;padding:9px 12px;border:1px solid #b68e4e77;background:#14232b;color:#f8e8c5;border-radius:8px}#pfp-admin-portal button{cursor:pointer}#pfp-admin-portal :focus-visible{outline:2px solid #65eac6;outline-offset:3px}
#pfp-admin-portal .ap-status{padding:10px 14px;border:1px solid #d9a93c44;border-radius:8px;background:#d9a93c0d;color:#d4c198;margin:12px 0}#pfp-admin-portal .ap-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(320px,1fr);gap:16px}#pfp-admin-portal section{min-width:0;border:1px solid #b9965044;border-radius:12px;background:#0c1c25dd;overflow:hidden}#pfp-admin-portal h2{font-size:13px;letter-spacing:.12em;color:#f7d58d;margin:0;padding:16px;border-bottom:1px solid #ffffff12}#pfp-admin-portal .ap-chart{width:100%;height:420px;display:block;background:#123541}#pfp-admin-portal .ap-note{font-size:12px;color:#a7b9b8;line-height:1.6;margin:0;padding:12px 16px}#pfp-admin-portal .ap-tools{padding:10px;display:flex;gap:6px}#pfp-admin-portal input{width:100%;min-width:0}#pfp-admin-portal select{max-width:120px}#pfp-admin-portal .ap-roster{max-height:420px;overflow:auto;padding:0 12px 12px}#pfp-admin-portal .ap-player{display:grid;grid-template-columns:1fr auto;gap:5px;padding:12px 2px;border-bottom:1px solid #ffffff12}#pfp-admin-portal .ap-player b{color:#9df2d6}#pfp-admin-portal .ap-player small{display:block;color:#a7b9b8;line-height:1.7}#pfp-admin-portal .ap-gold{text-align:right;color:#f7d58d}
#pfp-admin-portal .ap-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:16px 0}#pfp-admin-portal .ap-card{background:#142630;border:1px solid #b9965044;border-radius:10px;padding:16px}#pfp-admin-portal .ap-card b{display:block;font-size:27px;color:#ffe2a1;margin:5px 0}#pfp-admin-portal .ap-card span{font-size:11px;letter-spacing:.06em;color:#b8cdca}#pfp-admin-portal .ap-card small{font-size:11px;color:#a4b4b0}#pfp-admin-portal .ap-tops{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}#pfp-admin-portal .ap-top{display:flex;justify-content:space-between;gap:16px;padding:10px 16px;border-bottom:1px solid #ffffff0d}#pfp-admin-portal .ap-top b{color:#f7d58d;white-space:nowrap}#pfp-admin-portal .ap-unsupported{padding:16px;border:1px dashed #b9965055;border-radius:10px;color:#a7b9b8;line-height:1.7;font-size:12px}
@media(max-width:800px){#pfp-admin-portal .ap-wrap{padding:12px}#pfp-admin-portal .ap-grid{grid-template-columns:1fr}#pfp-admin-portal .ap-chart{height:320px}#pfp-admin-portal .ap-roster{max-height:320px}#pfp-admin-portal .ap-cards{grid-template-columns:repeat(2,minmax(0,1fr))}#pfp-admin-portal .ap-tops{grid-template-columns:1fr}#pfp-admin-portal header{gap:8px}#pfp-admin-portal header button{padding:8px}#pfp-admin-portal .ap-card{padding:12px}#pfp-admin-portal .ap-card b{font-size:23px}}
`;
const card = (label, value, note) => `<div class="ap-card"><span>${esc(label)}</span><b>${fmt(value)}</b><small>${esc(note)}</small></div>`;
export function statsMarkup(s) {
  return [
    ['LAST SEEN TODAY', s?.seen_today, 'Latest server timestamp · Indianapolis'],
    ['LAST SEEN · 7 DAYS', s?.seen_7d, 'Unique linked save identities'],
    ['LAST SEEN · 30 DAYS', s?.seen_30d, 'Activity proxy, not a login history'],
    ['NEW SAVES TODAY', s?.new_today, `${fmt(s?.new_7d)} in 7d · ${fmt(s?.new_30d)} in 30d`],
    ['SAVED GOLD', s?.saved_gold, `Linked saves deduped · ${fmt(s?.pending_gold)} pending`],
    ['PVP KILLS · 30 DAYS', s?.kills_30d, `${fmt(s?.kills_total)} recorded all-time`],
    ['SHOP PURCHASES · 30 DAYS', s?.purchases_30d, `${fmt(s?.shop_gold_30d)} gold spent · excludes casino`],
    ['CASINO STAKES · 30 DAYS', s?.casino_staked_30d, `${fmt(s?.casino_bets_30d)} recorded bets · not net profit`],
  ].map(v => card(...v)).join('');
}
let active = null;
export async function openAdminPortal({ call, chart, self = () => null }) {
  if (active) { active.focus(); return; }
  // Recheck owner on EVERY open. No local URL bypass or cached boolean unlocks data.
  const auth = await call('admin_status').catch(() => null);
  if (!auth?.ok || auth.owner !== true) return;
  if (active) { active.focus(); return; }
  const previousFocus = document.activeElement;
  // Release any held steering / movement keys before the modal takes focus.
  globalThis.dispatchEvent?.(new Event('blur'));
  const root = document.createElement('div'); root.id = 'pfp-admin-portal'; root.className = 'on'; root.tabIndex = -1;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'BANKSY Admin Portal');
  const style = document.createElement('style'); style.textContent = CSS; root.append(style);
  const wrap = document.createElement('div'); wrap.className = 'ap-wrap';
  wrap.innerHTML = `<header><div class="ap-brand"><div class="ap-eyebrow">PUMPFUN PIRATES / OWNER EYES ONLY</div><h1>⚓ FLEET INTELLIGENCE</h1></div><button data-refresh>↻ Refresh</button><button data-close aria-label="Close admin portal">✕ Close</button></header>
    <div class="ap-status" data-status role="status">Connecting to the fleet…</div>
    <div class="ap-grid"><section><h2>LIVE CHART · ISLAND & SEA</h2><canvas class="ap-chart" aria-label="Live player positions on the island and sea map"></canvas><p class="ap-note">Mint dots match roster numbers. All harbor copies share this chart. Arena and indoor positions are listed, not plotted. Reported positions may lag up to 15 seconds; offline sessions expire after 45 seconds.</p></section>
    <section><h2 data-count>LIVE PIRATES</h2><div class="ap-tools"><input data-search aria-label="Search players" placeholder="Find a pirate or room…"><select data-area aria-label="Filter area"><option value="">All areas</option>${['Island','Harbor','Sea','Arena','Hull','House'].map(a=>`<option>${a}</option>`).join('')}</select></div><div class="ap-roster"></div><p class="ap-note">Device & session duration are client-reported when available. Gold is server-saved; level is not tracked.</p></section></div>
    <div class="ap-status" data-stats-status role="status">Loading analytics…</div><div class="ap-cards">${statsMarkup(null)}</div>
    <div class="ap-tops"><section><h2>TOP PURCHASES · 30 DAYS</h2><div data-top="purchases"></div></section><section><h2>MOST HELD ITEMS · CURRENT</h2><div data-top="held"></div></section></div>
    <div class="ap-unsupported">DATA NOTES · Last-seen counts use each linked identity's latest profile / leaderboard timestamp, not a historical session log. New saves are first profile creation, not necessarily new people. Gold excludes unsynced device balances. Casino payouts are not recorded, so wins / losses and house profit are unavailable. Historical peak concurrency, retention and item-use frequency are not tracked. Most held does not mean most used.</div>`;
  root.append(wrap); document.body.append(root); active = root;
  let timer, closed = false, roster = [], liveAt = 0, statsAt = 0, liveOK = false, liveBusy = false, statsBusy = false, stats = null;
  const $ = q => root.querySelector(q), canvas = $('.ap-chart');
  const close = () => { if (closed) return; closed = true; clearInterval(timer); root.remove(); active = null; previousFocus?.focus?.(); };
  $('[data-close]').onclick = close;
  function paintLive() {
    const stale = Date.now() - liveAt > 45000;
    const list = liveAt && !stale ? roster : [];
    const unique = new Set(list.map(p => p.pid || p.net));
    $('[data-count]').textContent = `LIVE PIRATES · ${unique.size} / ${list.length} sessions`;
    const filtered = filterPlayers(list, $('[data-search]').value, $('[data-area]').value);
    $('.ap-roster').innerHTML = filtered.length ? filtered.map(p => `<div class="ap-player"><div><b>${p.label}. ${esc(p.name || 'PIRATE')}</b><small>${esc(areaOf(p))} · ${esc(p.room || 'Room unknown')}<br>${esc(p.device || 'Device unknown')} · session ${esc(sessionLabel(p))}</small></div><div class="ap-gold">${fmt(p.gold)}g<small>${Number.isFinite(p.x) && Number.isFinite(p.z) ? `${Math.round(p.x)}, ${Math.round(p.z)}` : 'Position unknown'}</small></div></div>`).join('') : '<p class="ap-note">No matching live pirates.</p>';
    $('[data-status]').textContent = !liveAt ? 'Live roster unavailable · check your connection.' : stale ? 'Live roster stale · dots hidden until the connection returns.' : `${liveOK ? '● Live' : 'Connection interrupted · last snapshot'} · refreshed ${Math.floor((Date.now()-liveAt)/1000)}s ago · polling every 5s`;
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(canvas.clientWidth*dpr)); canvas.height = Math.max(1, Math.round(canvas.clientHeight*dpr));
    const map = chart?.();
    if (map?.drawAdminChart) map.drawAdminChart(canvas, filtered);
    else { const c = canvas.getContext('2d'); c.fillStyle='#123541'; c.fillRect(0,0,canvas.width,canvas.height); c.fillStyle='#ffe0a0'; c.font=`${16*dpr}px system-ui`; c.fillText('Enter Harbor to load the island chart.',16*dpr,35*dpr); }
  }
  async function loadLive() {
    if (closed || liveBusy || document.hidden) return; liveBusy = true;
    try {
      const r = await call('admin_players', { portal: true }); if (closed) return;
      if (r?.status === 403) { close(); return; }
      liveOK = !!r?.ok;
      if (r?.ok && Array.isArray(r.players)) {
        roster = r.players.slice(0,500); const me = self();
        if (me?.net && !roster.some(p => p.net === me.net)) roster.push(me);
        roster.sort((a,b)=>String(a.name).localeCompare(String(b.name))); roster = roster.map((p,i)=>({...p,label:i+1})); liveAt=Date.now();
      }
    } catch { liveOK = false; } finally { liveBusy = false; if (!closed) paintLive(); }
  }
  async function loadStats() {
    if (closed || statsBusy || document.hidden) return; statsBusy = true;
    try {
      const r = await call('admin_stats'); if (closed) return;
      const pending = r?.pending || r?.status === 400 || r?.status === 503;
      if (r?.status === 403) { close(); return; }
      if (r?.ok) { stats=r; statsAt=Date.now(); }
      $('[data-stats-status]').textContent = r?.ok ? `ANALYTICS · updated ${new Date(statsAt).toLocaleTimeString('en-US',{timeZone:'America/Indiana/Indianapolis'})} Indianapolis · refreshes every minute` : stats ? 'Analytics connection interrupted · showing the previous snapshot.' : pending ? 'Server update pending · live roster and chart still work. Analytics unlock after the owner-only server update.' : 'Analytics unavailable · check your connection and refresh.';
      $('.ap-cards').innerHTML=statsMarkup(stats);
      for (const [key, rows, countKey] of [['purchases',stats?.top_purchases,'purchases'],['held',stats?.top_held,'quantity']]) {
        $(`[data-top="${key}"]`).innerHTML=rows?.length ? rows.map(p=>`<div class="ap-top"><span>${esc(itemInfo(p.item)?.name || p.item)}</span><b>${fmt(p[countKey])}</b></div>`).join('') : `<p class="ap-note">${stats ? 'No recorded items.' : 'Server update pending.'}</p>`;
      }
    } catch { if (!closed) $('[data-stats-status]').textContent='Analytics unavailable · retry when connected.'; } finally { statsBusy = false; }
  }
  $('[data-search]').oninput = paintLive; $('[data-area]').onchange = paintLive;
  $('[data-refresh]').onclick = () => { loadLive(); loadStats(); };
  // Capture before gameplay; keep keyboard focus inside the dialog.
  root.addEventListener('keydown', e => {
    if (e.code === 'Escape') { e.preventDefault(); close(); }
    if (e.code === 'Tab') { const all=[...root.querySelectorAll('button,input,select')]; const i=all.indexOf(document.activeElement); if (e.shiftKey && i<=0) { e.preventDefault(); all.at(-1)?.focus(); } else if (!e.shiftKey && i===all.length-1) { e.preventDefault(); all[0]?.focus(); } }
    e.stopPropagation();
  });
  root.addEventListener('keyup', e=>e.stopPropagation());
  // Attempt clocks keep a pending server update at one stats request per minute.
  let liveAttempt=Date.now(),statsAttempt=Date.now();
  timer = setInterval(() => {
    if (closed || document.hidden) return;
    paintLive(); const now=Date.now();
    if(now-liveAttempt>=LIVE_POLL_MS){liveAttempt=now;loadLive();}
    if(now-statsAttempt>=STATS_POLL_MS){statsAttempt=now;loadStats();}
  },1000);
  root.focus(); liveAttempt=statsAttempt=Date.now(); loadLive(); loadStats();
}
