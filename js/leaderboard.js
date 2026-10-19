// Pluggable leaderboard. Scores are keyed by Solana wallet (best score per wallet).
// LocalAdapter: always available, this device only.
// SupabaseAdapter: activates automatically when config.js has URL + anon key.
import { SUPABASE_URL, SUPABASE_ANON_KEY, LEADERBOARD_TABLE, LEADERBOARD_VIEW } from './config.js';

const LS_KEY = 'pfp_leaderboard_v1';
const clean = (s) => (s || '').replace(/[<>&"`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20);

export class LocalAdapter {
  constructor() { this.mode = 'this device'; }
  _all() { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } }
  async getTop(n = 10) {
    return Object.values(this._all()).sort((a, b) => b.score - a.score).slice(0, n);
  }
  async submit(entry) {
    const all = this._all();
    const prev = all[entry.wallet];
    if (!prev || entry.score > prev.score) all[entry.wallet] = { ...entry };
    else if (entry.name) prev.name = entry.name; // allow name update without losing best
    localStorage.setItem(LS_KEY, JSON.stringify(all));
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
  async getTop(n = 10) {
    const r = await fetch(`${this.url}/rest/v1/${LEADERBOARD_VIEW}?select=wallet,name,score,wave,sunk&order=score.desc&limit=${n}`, { headers: this._h() });
    if (!r.ok) throw new Error(`leaderboard read ${r.status}`);
    return r.json();
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
  async getTop(n = 10) {
    if (this.remote && !this.remoteDown) {
      try { const r = await this.remote.getTop(n); this.lastWhere = 'online'; return r; }
      catch (e) { console.info('[leaderboard] online board unavailable, using this device:', e.message); }
    }
    this.lastWhere = 'local';
    return this.local.getTop(n);
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
