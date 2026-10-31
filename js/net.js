// PUMPFUN PIRATES · tiny Supabase Realtime (Phoenix) client for PvP: BROADCAST ONLY, no presence, no database.
// Uses the public anon/publishable key, the same one the leaderboard uses. No extra library download for phones.
// Free plan budget: every message SENT or DELIVERED counts toward the project's events/sec cap (see PVP_NET in config.js; js/transport.js batches one message per tick).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export class Room {
  constructor(name) {
    this.topic = `realtime:${name}`; this.handlers = new Map(); this.ref = 0; this.joinRef = null;
    this.ws = null; this.open = false; this.closed = false; this.hb = 0; this.backoff = 500; this.sent = 0; this.recv = 0; this.byEv = {}; this.t0 = performance.now();
    this.onStatus = () => {};
  }
  on(ev, fn) { this.handlers.set(ev, fn); return this; }
  connect() {
    if (!SUPABASE_URL) return Promise.reject(new Error('offline build'));
    return new Promise((resolve, reject) => {
      const url = `${SUPABASE_URL.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(SUPABASE_ANON_KEY)}&vsn=1.0.0`;
      const ws = new WebSocket(url); this.ws = ws; let settled = false;
      const fail = (e) => { if (!settled) { settled = true; reject(e); } };
      const to = setTimeout(() => fail(new Error('realtime join timeout')), 8000);
      ws.onopen = () => {
        this.joinRef = String(++this.ref);
        this._raw({ topic: this.topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, private: false } }, ref: this.joinRef, join_ref: this.joinRef });
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
        clearInterval(this.hb); clearTimeout(to); const was = this.open; this.open = false; fail(new Error('realtime closed'));
        if (this.closed) return;
        this.onStatus('reconnecting');
        if (was || settled) setTimeout(() => { if (!this.closed) this.connect().catch(() => {}); }, this.backoff = Math.min(8000, this.backoff * 2));
      };
    });
  }
  _raw(o) { if (this.ws && this.ws.readyState === 1) { this.ws.send(JSON.stringify(o)); return true; } return false; }
  send(event, payload) {
    if (!this.open) return false;
    this.sent++; this.byEv['s:' + event] = (this.byEv['s:' + event] || 0) + 1;
    return this._raw({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event, payload }, ref: String(++this.ref), join_ref: this.joinRef });
  }
  close() {
    this.closed = true; this.open = false; clearInterval(this.hb);
    try { this._raw({ topic: this.topic, event: 'phx_leave', payload: {}, ref: String(++this.ref), join_ref: this.joinRef }); } catch {}
    try { this.ws?.close(); } catch {}
  }
}
