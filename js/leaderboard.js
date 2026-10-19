// Pluggable leaderboard. Scores are keyed by Solana wallet (best score per wallet).
// LocalAdapter: always available, this device only.
// SupabaseAdapter: activates automatically when config.js has URL + anon key.
// Periods: 'day' | 'week' | 'month' | 'year' are ROLLING windows (last 24h / 7d / 30d / 365d); 'all' = all-time.
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEADERBOARD_TABLE, LEADERBOARD_VIEW } from './config.js';

const LS_KEY = 'pfp_leaderboard_v1';     // best per wallet (legacy, still maintained)
const LS_RUNS = 'pfp_runs_v1';           // every saved run with a timestamp (for period boards)
const MAX_RUNS = 500;
const clean = (s) => (s || '').replace(/[<>&"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);

const DAY = 86400000;
export const PERIODS = [
  { id: 'day', label: 'DAY', ms: DAY, desc: 'last 24 hours' },
  { id: 'week', label: 'WEEK', ms: 7 * DAY, desc: 'last 7 days' },
  { id: 'month', label: 'MONTH', ms: 30 * DAY, desc: 'last 30 days' },
  { id: 'year', label: 'YEAR', ms: 365 * DAY, desc: 'last 365 days' },
  { id: 'all', label: 'ALL-TIME', ms: 0, desc: 'all time' },
];
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
  async getTop(n = 10, period = 'all') {
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
    // trim to the newest runs (all-time bests live in LS_KEY, so nothing is lost there)
    if (runs.length > MAX_RUNS) { runs.sort((a, b) => b.ts - a.ts); runs.length = MAX_RUNS; }
    try { localStorage.setItem(LS_RUNS, JSON.stringify(runs)); } catch {}
    return { ok: true, best: all[entry.wallet].score };
  }
}

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
  async getTop(n = 10, period = 'all') {
    const since = periodSince(period);
    if (!since) {
      const r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_VIEW}?select=wallet,name,score,wave,sunk&order=score.desc&limit=${n}`, { headers: this._h() });
      if (!r.ok) throw new Error(`leaderboard read ${r.status}`);
      return r.json();
    }
    // period boards: recent runs, highest first, deduped to the best per wallet here
    const iso = new Date(since).toISOString();
    const q = `select=wallet,name,score,wave,sunk,created_at&created_at=gte.${encodeURIComponent(iso)}&order=score.desc,created_at.asc&limit=300`;
    const r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_TABLE}?${q}`, { headers: this._h() });
    if (!r.ok) throw new Error(`leaderboard read ${r.status}`);
    const rows = (await r.json()).map(x => ({ ...x, _t: Date.parse(x.created_at) || 0 }));
    return bestPerWallet(rows, n);
  }
  async submit(entry) {
    const r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_TABLE}`, {
      method: 'POST', headers: this._h({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ wallet: entry.wallet, name: entry.name || null, score: entry.score, wave: entry.wave, sunk: entry.sunk, duration_s: entry.duration_s }),
    });
    if (!r.ok) throw new Error(`leaderboard write ${r.status}`);
    return { ok: true };
  }
}

class Leaderboard {
  constructor() {
    this.local = new LocalAdapter();
    this.remote = (SUPABASE_URL && SUPABASE_ANON_KEY) ? new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  }
  get mode() { return this.remote ? 'online' : 'this device only'; }
  async getTop(n = 10, period = 'all') {
    if (this.remote && !this.remoteDown) {
      try { const r = await this.remote.getTop(n, period); this.lastWhere = 'online'; return r; }
      catch (e) { console.info('[leaderboard] online board unavailable, using this device:', e.message); }
    }
    this.lastWhere = 'local';
    return this.local.getTop(n, period);
  }
  async submit(entry) {
    const e = { ...entry, name: clean(entry.name), score: Math.max(0, Math.floor(entry.score)), ts: Date.now() };
    await this.local.submit(e); // always keep a local copy
    if (this.remote) {
      try { await this.remote.submit(e); return { ok: true, where: 'online' }; }
      catch (err) { console.info('[leaderboard] online save failed, saved on this device:', err.message); return { ok: true, where: 'local', error: err.message }; }
    }
    return { ok: true, where: 'local' };
  }
}

export const leaderboard = new Leaderboard();
