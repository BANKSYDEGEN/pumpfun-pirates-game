// PUMPFUN PIRATES · PvP KILLS leaderboard UI (ALL TIME / MONTHLY / DAILY, ranked by confirmed real-player kills, with K/D).
// Periods use America/Indianapolis calendar days / months (server side, migration 006). Read-only; never touches the
// solo Top Pirates board. Home screen: a WAVES / BATTLE ROYALE switch, remembered on this device.
import { fetchKillsTop, kd } from './pvpSave.js';
import { PVP_ENABLED } from './config.js';

export const KILL_PERIODS = [
  { id: 'all', label: 'ALL TIME', desc: 'all time' },
  { id: 'month', label: 'MONTHLY', desc: 'this month' },
  { id: 'day', label: 'DAILY', desc: 'today' },
];
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
    const b = document.createElement('button'); b.type = 'button'; b.textContent = p.label; b.dataset.period = p.id; b.title = `PvP kills ${p.desc}`; b.setAttribute('role', 'tab');
    b.onclick = () => { period = p.id; set(PK_KEY, p.id); syncPeriodTabs(); refreshKillsBoards(); };
    tabs.appendChild(b);
  }
  syncPeriodTabs();
}
export function refreshKillsBoards() { for (const w of boards) if (w.offsetParent !== null || w.closest('.lb-br:not(.hidden)')) renderKills(w); }
export async function renderKills(wrap) {
  const ol = wrap.querySelector('.pk-board'), mode = wrap.querySelector('.pk-mode'), token = {}; tokens.set(wrap, token);
  const pd = KILL_PERIODS.find(p => p.id === period);
  if (!ol.children.length) ol.innerHTML = '<li class="empty">Loading…</li>';
  let rows = [], ok = true;
  try { rows = await fetchKillsTop(period); } catch (e) { ok = false; console.warn('[pvp board]', e); }
  if (tokens.get(wrap) !== token) return;
  if (mode) mode.textContent = ok ? `(${pd.desc}${period === 'all' ? '' : ' · Indianapolis time'})` : '(offline)';
  ol.innerHTML = ''; ol.scrollTop = 0;
  if (!rows.length) { ol.innerHTML = `<li class="empty">${ok ? `No PvP kills ${period === 'all' ? 'yet' : pd.desc}. Sail into the arena and take the top spot!` : 'Board offline, try again soon.'}</li>`; return; }
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    const rk = document.createElement('i'); rk.textContent = `${i + 1}.`;
    const nm = document.createElement('span'); nm.textContent = r.name || 'PIRATE';
    const tag = document.createElement('small'); tag.className = 'pk-id'; tag.textContent = ` ${r.player || ''}`; nm.appendChild(tag);
    const b = document.createElement('b'); b.textContent = r.kills;
    const k = document.createElement('small'); k.className = 'pk-kd'; k.textContent = ` K/D ${kd(+r.kills || 0, +r.deaths || 0)}`; k.title = `${r.kills} kills · ${r.deaths} deaths (confirmed PvP kills only)`;
    li.append(rk, nm, b, k); ol.appendChild(li);
  });
}

// home screen: WAVES (solo Top Pirates, unchanged) / BATTLE ROYALE (PvP kills) switch
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
window.PFP_PVP_BOARD = { renderKills, refreshKillsBoards, initHomeBoard, get period() { return period; } };
