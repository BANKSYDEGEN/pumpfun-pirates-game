// PUMPFUN PIRATES · tiny Supabase Realtime (Phoenix) client for PvP: BROADCAST ONLY, no presence, no database.
// Uses the public anon/publishable key, the same one the leaderboard uses. No extra library download for phones.
// Free plan budget: every message SENT or DELIVERED counts toward the project's events/sec cap (see PVP_NET in config.js; js/transport.js batches one message per tick).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// [security M1] PRIVATE channels: opts.ticket(name) -> { jwt } from the pvp function's `ticket` action (proves the lobby seat, binds the
// network id). With a jwt the channel is joined private (Realtime RLS, migration 029) and the token is refreshed before it expires.
// No jwt (old function, secret not set, offline) or a refused private join = the old public join, so nothing breaks while the
// server side rolls out (SECURITY_FIXES.md: "Allow public access" goes OFF only after every client is new).
const RT_REFRESH_MS = 20 * 60 * 1000;
export class Room {
  constructor(name, opts = {}) {
    this.name = name; this.ticketFn = typeof opts.ticket === 'function' ? opts.ticket : null; this.forcePublic = false; this.isPrivate = false; this.rt = 0;
    this.topic = `realtime:${name}`; this.handlers = new Map(); this.ref = 0; this.joinRef = null;
    this.ws = null; this.open = false; this.closed = false; this.hb = 0; this.backoff = 500; this.sent = 0; this.recv = 0; this.byEv = {}; this.t0 = performance.now();
    this.onStatus = () => {};
  }
  on(ev, fn) { this.handlers.set(ev, fn); return this; }
  async ticket() {
    if (!this.ticketFn || this.forcePublic) return null;
    try { const t = await this.ticketFn(this.name); return t && typeof t.jwt === 'string' && t.jwt.split('.').length === 3 ? t.jwt : null; } catch { return null; }
  }
  async connect() {
    if (!SUPABASE_URL) throw new Error('offline build');
    const jwt = await this.ticket();
    try { return await this._connect(jwt); }
    catch (e) { if (!jwt || this.closed || !/join refused/.test(e?.message || '')) throw e; console.warn('[pvp] private channel refused, using the public one'); this.forcePublic = true; try { this.ws?.close(); } catch {} return this._connect(null); }
  }
  _connect(jwt) {
    return new Promise((resolve, reject) => {
      const url = `${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;
      const ws = new WebSocket(url); this.ws = ws; let settled = false;
      const fail = (e) => { if (!settled) { settled = true; reject(e); } };
      const to = setTimeout(() => fail(new Error('realtime join timeout')), 8000);
      ws.onopen = () => {
        this.joinRef = String(++this.ref);
        this.isPrivate = !!jwt;
        this._raw({ topic: this.topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: !!jwt }, ...(jwt ? { access_token: jwt } : {}) }, ref: this.joinRef, join_ref: this.joinRef });
        clearInterval(this.rt); if (jwt) this.rt = setInterval(() => this.refresh(), RT_REFRESH_MS);
        clearInterval(this.hb); this.hb = setInterval(() => this._raw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++this.ref) }), 25000);
      };
      ws.onmessage = (m) => {
        let d; try { d = JSON.parse(m.data); } catch { return; }
        if (d.event === 'phx_reply' && d.ref === this.joinRef) {
          if (d.payload?.status === 'ok') { this.open = true; this.backoff = 500; clearTimeout(to); this.onStatus('open'); if (!settled) { settled = true; resolve(this); } }
          else fail(new Error(`join refused: ${JSON.stringify(d.payload?.response || {}).slice(0, 80)}`));
          return;
        }
        if (d.event === 'broadcast' && d.topic === this.topic && d.payload) {
          this.recv++; const k = 'r:' + d.payload.event; this.byEv[k] = (this.byEv[k] || 0) + 1;
          const fn = this.handlers.get(d.payload.event); if (fn) { try { fn(d.payload.payload || {}); } catch (e) { console.warn('[pvp] handler', d.payload.event, e); } }
        } else if (d.event === 'system' && d.payload?.status === 'error') { console.warn('[pvp] realtime:', d.payload.message); if (/tenant_events|too_many|limit/i.test(String(d.payload.message))) this.onStatus('limit'); }
        else if (d.event === 'phx_error' || (d.event === 'phx_reply' && d.payload?.status === 'error' && /too_many|limit/i.test(JSON.stringify(d.payload)))) this.onStatus('limit');
      };
      ws.onerror = () => fail(new Error('realtime socket error'));
      ws.onclose = () => {
        clearInterval(this.hb); clearInterval(this.rt); clearTimeout(to); const was = this.open; this.open = false; fail(new Error('realtime closed'));
        if (this.closed) return;
        this.onStatus('reconnecting');
        if (was || settled) setTimeout(() => { if (!this.closed) this.connect().catch(() => {}); }, this.backoff = Math.min(8000, this.backoff * 2));
      };
    });
  }
  async refresh() { // a fresh ticket before the old one expires (also keeps this seat noted for the kill board)
    if (!this.open || !this.isPrivate) return; const jwt = await this.ticket();
    if (jwt) this._raw({ topic: this.topic, event: 'access_token', payload: { access_token: jwt }, ref: String(++this.ref), join_ref: this.joinRef });
  }
  _raw(o) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(o)); return true; } return false; }
  send(event, payload) {
    if (!this.open) return false;
    this.sent++; this.byEv['s:' + event] = (this.byEv['s:' + event] || 0) + 1;
    return this._raw({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event, payload }, ref: String(++this.ref), join_ref: this.joinRef });
  }
  close() {
    this.closed = true; this.open = false; clearInterval(this.hb); clearInterval(this.rt);
    try { this._raw({ topic: this.topic, event: 'phx_leave', payload: {}, ref: String(++this.ref), join_ref: this.joinRef }); } catch {}
    try { this.ws?.close(); } catch {}
  }
}
