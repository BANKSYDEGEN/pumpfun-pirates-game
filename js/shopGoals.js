// [Timothy] PUMPFUN PIRATES · SHOP GOALS: where this pirate stands on each goal-locked shop item (COMMODORE 100 harbor boss kills,
// FLAMING "FIRE" K/D >= 10 with 50+ kills, DIAMOND 5,000 BR kills, Solo + Squads). Display only: the SERVER decides every
// purchase (supabase/functions/pvp/lib.ts goalMet in shop_buy); nothing here is sent anywhere or trusted by anyone.
//
// Stats, best source first:
//   1) server  the `pvp` function's shop_state / dev_sync answer (`stats`, + `goals` / `modes` from goals.ts): EXACTLY what
//              shop_buy checks, so a card that says MET is one the server will sell. Arrives as the 'pfp-shop-sync' event
//              (js/pvpSave.js takeShop) or from PFP_PVP_SAVE.shopState() when that exists.
//   2) device  this save's profile.stats (live PFP_PVP.profile, else the saved device copy) merged with the confirmed board
//              (fetchMe: kills / deaths) the same way the server merges them (max). Shown when the server hasn't answered
//              (offline, first launch); it may run a little ahead of the server copy, which catches up at the normal pace.
//   3) none    no stats at all (brand-new pirate, storage blocked): every goal reads 0 and says "no stats yet".
// Battle Royale only (Waves has its own skins + stats and is untouched). Off on the crypto-free portal builds with the shop.
import { devHook } from './env.js'; // [security L] console/test hook: local dev servers only
import { SKIN_ITEMS, GEAR_ITEMS, liveGoal, goalProgress, fmtGoalRow, fmtGold, gearKey } from './shopCatalog.js';
import { readModeKills } from './modeKills.js';
import { ON_PORTAL } from './config.js';

const KEYS = ['kills', 'deaths', 'botKills', 'harborKills', 'bossKills', 'prestige']; // [prestige] GOLDEN (1) / DIAMOND (2) goals; the server's stats carry it
const src = { server: null, board: null, boardAt: 0 };
const subs = new Set();
const emit = () => { for (const f of subs) try { f(goalStats()); } catch {} };
export const onGoalStats = (f) => { subs.add(f); return () => subs.delete(f); };
const num = (x) => Math.max(0, Math.floor(Number(x) || 0));
const cleanStats = (st) => st && typeof st === 'object' ? Object.fromEntries(KEYS.map(k => [k, num(st[k])])) : null;

// server answers (Emerly's takeShop event; goals / modes ride along once the client forwards them)
try { addEventListener('pfp-shop-sync', (e) => { const d = e.detail || {}; const st = cleanStats(d.stats); if (!st) return;
  src.server = { stats: st, goals: d.goals || null, modes: d.modes || null, owner: !!d.owner, at: Date.now() }; emit(); }); } catch {}
export function takeServerStats(j) { const st = cleanStats(j?.stats); if (!st) return; src.server = { stats: st, goals: j.goals || null, modes: j.modes || null, owner: !!j.owner, at: Date.now() }; emit(); }

function deviceStats() {
  const lp = window.PFP_PVP?.profile; if (lp?.stats) return cleanStats({ ...lp.stats, prestige: lp.prestige }); // [prestige] kept next to the stats
  try { const all = JSON.parse(localStorage.getItem('pfp_pvp_save_v1') || 'null'), d = all?.profiles?.device; return d?.stats ? cleanStats({ ...d.stats, prestige: d.prestige }) : null; } catch { return null; }
}
// { stats | null, src: 'server' | 'device' | 'none', modes: { solo, squads, src } | null, owner }
export function goalStats() {
  if (src.server) return { stats: src.server.stats, src: 'server', modes: modesOf(src.server.modes, 'server'), owner: src.server.owner, goals: src.server.goals };
  const dev = deviceStats(), bd = src.board;
  if (!dev && !bd) return { stats: null, src: 'none', modes: modesOf(null), owner: false };
  const st = { ...(dev || Object.fromEntries(KEYS.map(k => [k, 0]))) };
  if (bd) { st.kills = Math.max(st.kills, bd.kills); st.deaths = Math.max(st.deaths, bd.deaths); } // = the server's shopView merge
  return { stats: st, src: 'device', modes: modesOf(null), owner: false };
}
function modesOf(server, s) {
  if (server && Number.isFinite(+server.solo)) return { solo: num(server.solo), squads: num(server.squads), src: 'server' };
  const m = readModeKills(); return m.since ? { solo: m.solo, squads: m.squads, src: 'device', since: m.since } : null;
}
// refresh from the network (best effort, never throws): the server's shop view when the client has it, else the board read
export async function refreshGoalStats({ timeout = 4000 } = {}) {
  const S = window.PFP_PVP_SAVE, race = (p) => Promise.race([p, new Promise(r => setTimeout(() => r(null), timeout))]);
  try { if (S?.shopState) { const r = await race(S.shopState(window.PFP_PVP?.profile)); if (r?.stats) takeServerStats(r); } } catch {}
  try { if (!src.server && S?.fetchMe && Date.now() - src.boardAt > 30000) { const r = await race(S.fetchMe()); if (r && Number.isFinite(+r.kills)) { src.board = { kills: num(r.kills), deaths: num(r.deaths) }; src.boardAt = Date.now(); } } } catch {}
  emit(); return goalStats();
}
export const _resetGoalStats = () => { src.server = null; src.board = null; src.boardAt = 0; emit(); }; // tests / sign-out

// ---------- rendering (shared by the shop cards, the shop detail pane and the profile) ----------
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (f) => `${Math.round(Math.max(0, Math.min(1, f)) * 100)}%`;
const modeLine = (m) => m ? `Solo ${(+m.solo | 0).toLocaleString('en-US')} · Squads ${(+m.squads | 0).toLocaleString('en-US')}${m.src === 'device' ? ' <i>(this device)</i>' : ''}` : '';
// the per-row lines on a locked card: text + a thin bar each
export function goalCardHtml(g, modes) {
  if (!g) return '';
  return `<span class="ishop-goals${g.nostats ? ' nostats' : ''}">${g.rows.map(r => `<span class="ishop-gr${r.done ? ' done' : ''}"><span class="ishop-gt">${r.done ? '✓ ' : ''}${esc(fmtGoalRow(r))}</span><span class="ishop-mini"><i style="width:${pct(r.frac)}"></i></span></span>`).join('')}${g.nostats ? '<span class="ishop-gt ishop-none">no stats yet</span>' : ''}</span>`;
}
// the bigger rows in the detail pane / profile
export function goalRowsHtml(g, modes) {
  if (!g) return '';
  return g.rows.map(r => `<div class="ishop-goal ${r.done ? 'done' : ''}"><span>${r.done ? '✓' : '🔒'} ${esc(fmtGoalRow(r))}${r.modes && modes ? `<small class="ishop-modes">${modeLine(modes)}</small>` : ''}</span><span class="ishop-bar"><i style="width:${pct(r.frac)}"></i></span></div>`).join('')
    + (g.nostats ? '<div class="ishop-gl ishop-none">No Battle Royale stats yet. Play a round (online) and your progress shows here.</div>' : '');
}
// every live goal item (skins first, then gear) with this pirate's progress
export function goalItems(stats = goalStats().stats) {
  const out = [];
  for (const it of SKIN_ITEMS) { const goal = liveGoal(it); if (goal) out.push({ kind: 'skin', key: it.id, name: it.name, price: it.price, goal, g: goalProgress(goal, stats) }); }
  for (const it of GEAR_ITEMS) { const goal = liveGoal(it); if (goal) out.push({ kind: 'gear', key: gearKey(it), name: it.label, price: it.price, goal, g: goalProgress(goal, stats) }); }
  return out;
}
// profile block: "SHOP GOALS" with each goal-locked item, its progress, and BUY-ready once met. owned = Set of 'skin:id' / 'gear:slot:id'.
export function profileGoalsHtml({ owned = null } = {}) {
  const gs = goalStats(), items = goalItems(gs.stats);
  if (!items.length) return '';
  const rows = items.map(x => { const own = owned?.has?.(`${x.kind}:${x.key}`);
    const tail = own ? '<b class="pg-own">OWNED</b>' : x.g.done ? `<b class="pg-buy">BUY · ${fmtGold(x.price)} at the SHOP</b>` : `<span class="pg-lock">🔒 ${Math.round(x.g.frac * 100)}%</span>`;
    return `<div class="pg-item${x.g.done ? ' met' : ''}"><div class="pg-head"><span class="pg-name">${esc(x.name)}${x.g.tag ? ` <small>${esc(x.g.tag)}</small>` : ''}</span>${tail}</div>${goalRowsHtml(x.g, gs.modes)}</div>`; }).join('');
  return `<div class="pfp-goals" data-src="${gs.src}"><div class="pg-title">SHOP GOALS <small>${gs.src === 'server' ? 'as the server counts them' : gs.src === 'device' ? 'from this device · syncs when online' : ''}</small></div>${rows}</div>`;
}
// mount into any element (e.g. the PROFILE panel); keeps itself fresh. Returns an unmount function.
export function mountProfileGoals(el, opts = {}) {
  if (!el || ON_PORTAL) return () => {}; // no shop (and no shop goals) on the crypto-free portal builds
  ensureCss();
  const draw = () => { el.innerHTML = profileGoalsHtml(opts); };
  draw(); const off = onGoalStats(draw); refreshGoalStats().catch(() => {}); return off;
}
function ensureCss() { if (!document.querySelector('link[href$="islandShop.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../css/islandShop.css', import.meta.url).href; document.head.appendChild(l); } }
// PROFILE hook: main v102 has no profile page yet. When one lands (timothy/ui-overhaul js/uiProfile.js: #profile .pf-card + the
// 'pfp-profile' event), a SHOP GOALS section appears in it in Battle Royale. Never on the crypto-free portal builds.
let pfOff = null;
try { if (!ON_PORTAL) addEventListener('pfp-profile', (e) => {
  const card = document.querySelector('#profile .pf-card'); if (!card) return;
  if (!e.detail?.open) { pfOff?.(); pfOff = null; return; }
  let sec = document.getElementById('pf-goals');
  if (!sec) { sec = document.createElement('section'); sec.id = 'pf-goals'; sec.className = 'pf-sec pf-br'; (document.getElementById('pf-acct') || card.lastElementChild)?.before(sec); }
  pfOff?.(); pfOff = mountProfileGoals(sec);
}); } catch {}
devHook('PFP_SHOP_GOALS', { goalStats, refreshGoalStats, takeServerStats, goalItems, profileGoalsHtml, mountProfileGoals, _resetGoalStats });
