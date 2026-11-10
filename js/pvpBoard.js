// PUMPFUN PIRATES · KING OF THE HILL leaderboard UI (ALL TIME / MONTH / DAY — same order as Storm Hunt).
// Ranked by confirmed player-vs-player kills everywhere: Harbor/sea, open island (guns, swords, shore↔ship), Arena.
// Periods use America/Indianapolis calendar days / months (server side, migration 006). Home: KOTH / Storm Hunt switch.
import { IS_PROD_HOST, devHook } from './env.js'; // [security] ?pvproom only off the live domains; console hooks only on dev servers
import { fetchKillsTop, kd, clearKillsTopCache } from './pvpSave.js';
import { PVP_ENABLED, SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { BOARD_PERIODS } from './kothAttr.js';
import { netGate } from './netGate.js'; // [cache-queue]

export const KILL_PERIODS = BOARD_PERIODS.map(p => ({ ...p }));
const PK_KEY = 'pfp_pk_period', MODE_KEY = 'pfp_lb_mode';
const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
let period = KILL_PERIODS.some(p => p.id === get(PK_KEY)) ? get(PK_KEY) : 'all';
const boards = new Set(), tokens = new WeakMap();

function syncPeriodTabs() {
  document.querySelectorAll('.pk-tabs button').forEach(b => { const on = b.dataset.period === period; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
}
// wrap: an element holding .pk-tabs, .pk-mode and an <ol class="board pk-board">
export function mountKillsBoard(wrap) {
  if (!wrap || boards.has(wrap)) return; boards.add(wrap);
  const tabs = wrap.querySelector('.pk-tabs'); tabs.innerHTML = '';
  for (const p of KILL_PERIODS) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = p.label; b.dataset.period = p.id; b.title = `King of the Hill ${p.desc}`; b.setAttribute('role', 'tab');
    b.onclick = () => { period = p.id; set(PK_KEY, p.id); set('pfp_lb_period', p.id); syncPeriodTabs(); refreshKillsBoards(); };
    tabs.appendChild(b);
  }
  syncPeriodTabs();
}
// [board refresh] visible boards re-read the server every 30 s (home KING OF THE HILL tab, PvP menu); a recorded kill refreshes at once
setInterval(() => { if (document.visibilityState === 'visible' && [...boards].some(w => w.offsetParent !== null)) { clearKillsTopCache(); refreshKillsBoards(); } }, 60000); // [cache-queue] 30 s -> 60 s (the server caches the board ~30 s anyway)
addEventListener('pfp-renamed', () => { clearKillsTopCache(); refreshKillsBoards(); }); // [v74] board shows the new name right away
export function refreshKillsBoards() { for (const w of boards) if (w.offsetParent !== null || w.closest('.lb-br:not(.hidden)')) renderKills(w); }
export async function renderKills(wrap) {
  const ol = wrap.querySelector('.pk-board'), mode = wrap.querySelector('.pk-mode'), token = {}; tokens.set(wrap, token);
  const pd = KILL_PERIODS.find(p => p.id === period);
  if (!ol.children.length) ol.innerHTML = '<li class="empty">Loading…</li>';
  let rows = [], ok = true;
  try { rows = await fetchKillsTop(period); } catch (e) { ok = false; console.warn('[pvp board]', e); }
  if (tokens.get(wrap) !== token) return;
  if (mode) mode.textContent = ok ? `(${pd.desc})` : '(offline)';
  ol.innerHTML = ''; ol.scrollTop = 0;
  if (!rows.length) { ol.innerHTML = `<li class="empty">${ok ? `No King of the Hill kills ${period === 'all' ? 'yet' : pd.desc}. Sink pirates anywhere — Harbor, island, or Arena — and take the top spot!` : 'Board offline, try again soon.'}</li>`; return; }
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    const rk = document.createElement('i'); rk.textContent = `${i + 1}.`;
    const nm = document.createElement('span'); nm.textContent = r.name || 'PIRATE';
    if (r.wallet) { const w = document.createElement('span'); w.className = 'pk-wallet'; w.textContent = ` · ${r.wallet}`; nm.appendChild(w); } // [v75] short saved wallet, Waves style (never the full address)
    else { const tag = document.createElement('small'); tag.className = 'pk-id'; tag.textContent = ` ${r.player || ''}`; nm.appendChild(tag); }
    const kills = +r.kills || 0, deaths = +r.deaths || 0;
    const b = document.createElement('b'); b.textContent = kills;
    const k = document.createElement('small'); k.className = 'pk-kd';
    k.textContent = ` ${deaths}D · K/D ${kd(kills, deaths)}`;
    k.title = `${kills} kills · ${deaths} deaths (Harbor + island + Arena · players only)`;
    li.append(rk, nm, b, k); ol.appendChild(li);
  });
}

// home screen: STORM HUNT (solo Top Pirates) / KING OF THE HILL (all PvP kills) switch — same ALL TIME / MONTH / DAY tabs
let homeApply = null;
export function initHomeBoard() {
  if (homeApply) return homeApply(); // already wired: just refresh
  const home = document.getElementById('home-board'); if (!home) return;
  const sw = home.querySelector('.lb-modes'), waves = home.querySelector('.lb-waves'), br = home.querySelector('.lb-br');
  if (!PVP_ENABLED) { sw?.remove(); br?.remove(); return; }
  mountKillsBoard(br);
  let mode = get(MODE_KEY) === 'br' ? 'br' : 'waves';
  const apply = () => {
    sw.querySelectorAll('button').forEach(b => { const on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    waves.classList.toggle('hidden', mode !== 'waves'); br.classList.toggle('hidden', mode !== 'br');
    if (mode === 'br') renderKills(br);
  };
  sw.querySelectorAll('button').forEach(b => b.onclick = () => { mode = b.dataset.mode; set(MODE_KEY, mode); apply(); });
  homeApply = apply; apply();
}
devHook('PFP_PVP_BOARD', { renderKills, refreshKillsBoards, initHomeBoard, get period() { return period; } });

// [v76] home: live '⚔ n/4 in arena · ⚓ q in queue' under SPECTATE BATTLE ROYALE (read-only lobby poll, holds no seat).
// Every 10 s while the home screen is visible; any error hides the line.
{
  const solo = 'pfp-pvp-' + ((IS_PROD_HOST ? null : new URLSearchParams(location.search).get('pvproom')) || 'v1').replace(/[^a-z0-9]/gi, '').slice(0, 16);
  const prefixNow = () => { let m = 'solo'; try { m = localStorage.getItem('pfp_spec_mode') === 'squads' ? 'squads' : 'solo'; } catch {} return m === 'squads' ? 'pfp-pvp-' + solo.slice(8, 22) + 'sq' : solo; }; // [v98] follows the SOLO / SQUADS spectate switch
  const seat = 'home-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 8);
  let busy = false;
  const tick = async () => {
    const el = document.getElementById('home-live'), title = document.getElementById('title');
    if (!el || !PVP_ENABLED || !SUPABASE_URL || busy || document.hidden || !title || title.classList.contains('hidden')) return;
    if (netGate.wait('home') > 0) return; // [cache-queue] busy servers: the title head-count backs off (6 s -> 60 s) instead of every 10 s
    busy = true;
    try {
      let hbm = false; try { hbm = localStorage.getItem('pfp_spec_mode') === 'harbor'; } catch {}
      if (hbm) { // [v99] HARBOR: pirates sailing the shared harbor copies (read-only peek, holds no seat)
        const hp = 'pfp-harbor' + ((IS_PROD_HOST ? null : new URLSearchParams(location.search).get('pvproom')) ? '-' + solo.slice(8) : '');
        const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pvp_harbor`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ p_seat: seat, p_prefix: hp, p_op: 'peek' }) });
        const j = r.ok ? await r.json() : null; if (!j || j.state === 'error') throw Object.assign(new Error('harbor'), { status: r.ok ? 200 : r.status });
        const shared = (j.copies || []).filter(c => c[1] >= 2).length;
        el.textContent = `⚓ ${j.pirates | 0} in the harbor${shared ? ` · ${shared} shared ${shared === 1 ? 'copy' : 'copies'}` : ''}`; el.classList.remove('hidden'); netGate.ok('home'); return;
      }
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pvp_lobby`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ p_seat: seat, p_prefix: prefixNow(), p_op: 'poll' }) });
      const j = r.ok ? await r.json() : null;
      if (!j || j.state === 'error' || j.players == null) throw Object.assign(new Error('lobby'), { status: r.ok ? 200 : r.status });
      el.textContent = `⚔ ${j.players | 0}/${j.cap || 4} in arena · ⚓ ${j.queue | 0} in queue${j.spectators ? ` · 👁 ${j.spectators}` : ''}`; el.classList.remove('hidden'); netGate.ok('home');
    } catch (e) { el.classList.add('hidden'); netGate.fail('home', { quiet: true, status: e?.status || 0 }); }
    finally { busy = false; }
  };
  window.PFP_HOME_LIVE = () => tick(); // [v98] the spectate switch re-reads the count at once
  setTimeout(tick, 1500); setInterval(tick, 10000); document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}
