// Pluggable leaderboard. Scores are keyed by Solana wallet (best score per wallet).
// LocalAdapter: always available, this device only.
// SupabaseAdapter: activates automatically when config.js has URL + anon key.
// Periods: 'day' | 'week' | 'month' | 'year' are ROLLING windows (last 24h / 7d / 30d / 365d); 'all' = all-time.
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEADERBOARD_TABLE, LEADERBOARD_VIEW, LEADERBOARD_DAILY_VIEW } from './config.js';
// DAILY challenge board: one board per UTC day (seed 'YYYY-MM-DD'), best run per wallet. Needs migration 002_daily.sql
// online; until it's run, daily runs are kept on this device and the board says 'daily board coming soon'.

const LS_KEY = 'pfp_leaderboard_v1';     // best per wallet (legacy, still maintained)
const LS_RUNS = 'pfp_runs_v1';           // every saved run with a timestamp (for period boards)
const MAX_RUNS = 2000;                  // enough history for 100+ wallets per period board
export const LB_SIZE = 100;             // rows a board holds (5 visible, the rest scroll)
const PAGE = 1000;                      // Supabase rows per request (PostgREST default max)
const MAX_PAGES = 5;
const clean = (s) => (s || '').replace(/[<>&"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);

const DAY = 86400000;
export const PERIODS = [
  { id: 'day', label: 'DAY', ms: DAY, desc: 'last 24 hours' },
  { id: 'week', label: 'WEEK', ms: 7 * DAY, desc: 'last 7 days' },
  { id: 'month', label: 'MONTH', ms: 30 * DAY, desc: 'last 30 days' },
  { id: 'year', label: 'YEAR', ms: 365 * DAY, desc: 'last 365 days' },
  { id: 'all', label: 'ALL-TIME', ms: 0, desc: 'all time' },
];
export const DAILY_TAB = { id: 'daily', label: 'DAILY', desc: "today's daily challenge" };
const LS_DAILY = 'pfp_daily_v1';        // { seed: { wallet: best entry } }, last few days only
export const periodSince = (id) => { const p = PERIODS.find(x => x.id === id); return p && p.ms ? Date.now() - p.ms : 0; };

// keep the best run per wallet, highest first; ties go to the earlier run
function bestPerWallet(rows, n) {
  const best = new Map();
  for (const r of rows) {
    const b = best.get(r.wallet);
    if (!b || r.score > b.score || (r.score === b.score && (r._t || 0) < (b._t || 0))) best.set(r.wallet, r);
  }
  return [...best.values()].sort((a, b) => b.score - a.score || (a._t || 0) - (b._t || 0)).slice(0, n);
}

export class LocalAdapter {
  constructor() { this.mode = 'this device'; }
  _all() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
  _runs() {
    let runs;
    try { runs = JSON.parse(localStorage.getItem(LS_RUNS)); } catch { runs = null; }
    if (!Array.isArray(runs)) {
      // migrate: seed the run history from the legacy best-per-wallet store
      runs = Object.values(this._all()).map(e => ({ ...e, ts: e.ts || 0 }));
      try { localStorage.setItem(LS_RUNS, JSON.stringify(runs)); } catch {}
    }
    return runs;
  }
  async getTop(n = LB_SIZE, period = 'all') {
    const since = periodSince(period);
    if (!since) return bestPerWallet(Object.values(this._all()).map(r => ({ ...r, _t: r.ts || 0 })), n); // all-time keeps every wallet's best
    const rows = this._runs().filter(r => !since || (r.ts || 0) >= since).map(r => ({ ...r, _t: r.ts || 0 }));
    return bestPerWallet(rows, n);
  }
  async submit(entry) {
    const all = this._all();
    const prev = all[entry.wallet];
    if (!prev || entry.score > prev.score) all[entry.wallet] = { ...entry };
    else if (entry.name) prev.name = entry.name; // allow name update without losing best
    localStorage.setItem(LS_KEY, JSON.stringify(all));
    const runs = this._runs(); runs.push({ ...entry, ts: entry.ts || Date.now() });
    // trim: always keep every wallet's best run, then the newest of the rest (all-time bests also live in LS_KEY)
    if (runs.length > MAX_RUNS) {
      runs.sort((a, b) => b.ts - a.ts);
      const best = new Map(); for (const r of runs) { const b = best.get(r.wallet); if (!b || r.score > b.score) best.set(r.wallet, r); }
      const keep = new Set(best.values()); let room = MAX_RUNS - keep.size;
      for (const r of runs) { if (room <= 0) break; if (!keep.has(r)) { keep.add(r); room--; } }
      runs.splice(0, runs.length, ...runs.filter(r => keep.has(r)));
    }
    try { localStorage.setItem(LS_RUNS, JSON.stringify(runs)); } catch {}
    return { ok: true, best: all[entry.wallet].score };
  }
  _daily() { try { return JSON.parse(localStorage.getItem(LS_DAILY)) || {}; } catch { return {}; } }
  async getDaily(seed, n = LB_SIZE) {
    const day = this._daily()[seed] || {};
    return bestPerWallet(Object.values(day).map(r => ({ ...r, _t: r.ts || 0 })), n);
  }
  async submitDaily(entry) { // daily runs never touch the normal boards
    const all = this._daily(), day = all[entry.seed] || (all[entry.seed] = {});
    const prev = day[entry.wallet];
    if (!prev || entry.score > prev.score) day[entry.wallet] = { ...entry };
    else if (entry.name) prev.name = entry.name;
    for (const k of Object.keys(all).sort().slice(0, -7)) delete all[k]; // keep a week
    try { localStorage.setItem(LS_DAILY, JSON.stringify(all)); } catch {}
    return { ok: true, best: day[entry.wallet].score };
  }
}

// PostgREST error -> Error with status + code. Missing column / view (migration not run yet):
// 42703 undefined column, 42P01 undefined table, PGRST204 column not in schema cache, PGRST205 table not in schema cache.
async function httpErr(r, what) { let code = ''; try { code = (await r.json()).code || ''; } catch {} const e = new Error(`${what} ${r.status} ${code}`); e.status = r.status; e.code = code; return e; }
const isSchemaMissing = (e) => ['42703', '42P01', 'PGRST204', 'PGRST205'].includes(e.code) || e.status === 404;

export class SupabaseAdapter {
  constructor(url, key) {
    this.url = url.replace(/\/$/, '');
    this.key = key;
    this.mode = 'online';
  }
  _h(extra = {}) {
    // New-style publishable keys (sb_publishable_...) are not JWTs: send them only as `apikey`.
    // Legacy anon keys (JWT) also go in the Authorization header.
    const h = { apikey: this.key, 'Content-Type': 'application/json', ...extra };
    if (!this.key.startsWith('sb_')) h.Authorization = `Bearer ${this.key}`;
    return h;
  }
  async getTop(n = LB_SIZE, period = 'all') {
    const since = periodSince(period);
    if (!since) {
      const r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_VIEW}?select=wallet,name,score,wave,sunk&order=score.desc&limit=${n}`, { headers: this._h() });
      if (!r.ok) throw new Error(`leaderboard read ${r.status}`);
      return r.json();
    }
    // period boards: recent runs, highest first, deduped to the best per wallet here
    const iso = new Date(since).toISOString();
    // rows come highest score first, so page until we have n unique wallets or run out
    // normal runs only (mode is null). Before migration 002 there is no mode column (400): drop the filter and remember.
    const q = () => `select=wallet,name,score,wave,sunk,created_at&created_at=gte.${encodeURIComponent(iso)}${this.noModeCol ? '' : '&mode=is.null'}&order=score.desc,created_at.asc&limit=${PAGE}`;
    const rows = [], wallets = new Set();
    for (let page = 0; page < MAX_PAGES; page++) {
      let r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_TABLE}?${q()}&offset=${page * PAGE}`, { headers: this._h() });
      if (r.status === 400 && !this.noModeCol) { this.noModeCol = true; r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_TABLE}?${q()}&offset=${page * PAGE}`, { headers: this._h() }); }
      if (!r.ok) throw new Error(`leaderboard read ${r.status}`);
      const got = await r.json();
      for (const x of got) { rows.push({ ...x, _t: Date.parse(x.created_at) || 0 }); wallets.add(x.wallet); }
      if (got.length < PAGE || wallets.size >= n) break;
    }
    return bestPerWallet(rows, n);
  }
  async submit(entry) {
    const r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_TABLE}`, {
      method: 'POST', headers: this._h({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ wallet: entry.wallet, name: entry.name || null, score: entry.score, wave: entry.wave, sunk: entry.sunk, duration_s: entry.duration_s, ...(entry.mode === 'daily' ? { mode: 'daily', seed: entry.seed } : {}) }), // normal runs send no mode/seed, so they work before and after 002
    });
    if (!r.ok) throw await httpErr(r, 'leaderboard write');
    return { ok: true };
  }
  async getDaily(seed, n = LB_SIZE) {
    const r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_DAILY_VIEW}?select=wallet,name,score,wave,sunk&seed=eq.${encodeURIComponent(seed)}&order=score.desc,created_at.asc&limit=${n}`, { headers: this._h() });
    if (!r.ok) throw await httpErr(r, 'daily board read');
    return r.json();
  }
}

class Leaderboard {
  constructor() {
    this.local = new LocalAdapter();
    this.remote = (SUPABASE_URL && SUPABASE_ANON_KEY) ? new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  }
  get mode() { return this.remote ? 'online' : 'this device only'; }
  async getTop(n = LB_SIZE, period = 'all') {
    if (this.remote && !this.remoteDown) {
      try { const r = await this.remote.getTop(n, period); this.lastWhere = 'online'; return r; }
      catch (e) { console.info('[leaderboard] online board unavailable, using this device:', e.message); }
    }
    this.lastWhere = 'local';
    return this.local.getTop(n, period);
  }
  // DAILY board. 400/404 = the 002 migration isn't in yet (no view / no column): local board + 'coming soon'.
  async getDaily(seed, n = LB_SIZE) {
    if (this.remote && !this.remoteDown && !this.dailySoon) {
      try { const r = await this.remote.getDaily(seed, n); this.lastWhere = 'online'; return r; }
      catch (e) { if (isSchemaMissing(e)) this.dailySoon = true; console.info('[leaderboard] daily board not online, using this device:', e.message); }
    }
    this.lastWhere = 'local';
    return this.local.getDaily(seed, n);
  }
  get dailyOnline() { return !!this.remote && !this.dailySoon; }
  async submit(entry) {
    const e = { ...entry, name: clean(entry.name), score: Math.max(0, Math.floor(entry.score)), ts: Date.now() };
    if (e.mode === 'daily') {
      await this.local.submitDaily(e);
      if (this.remote && !this.dailySoon) {
        try { await this.remote.submit(e); return { ok: true, where: 'online' }; }
        catch (err) { if (isSchemaMissing(err)) this.dailySoon = true; console.info('[leaderboard] daily save not online, saved on this device:', err.message); return { ok: true, where: 'local', error: err.message }; }
      }
      return { ok: true, where: 'local' };
    }
    await this.local.submit(e); // always keep a local copy
    if (this.remote) {
      try { await this.remote.submit(e); return { ok: true, where: 'online' }; }
      catch (err) { console.info('[leaderboard] online save failed, saved on this device:', err.message); return { ok: true, where: 'local', error: err.message }; }
    }
    return { ok: true, where: 'local' };
  }
}

export const leaderboard = new Leaderboard();
