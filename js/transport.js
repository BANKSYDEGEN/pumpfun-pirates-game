// PUMPFUN PIRATES · PvP transport layer. pvp.js only talks to this interface, so the wire can be swapped:
//   createNet({ prefix, myId }) -> net
//     net.kind ('supabase' | 'relay'), net.cfg (PVP_NET[kind]: hz, maxArena, ...)
//     net.lobby(op, { name, cap, offer }) -> Promise<seat>   op: play | spec | poll | accept | decline | died | leave
//        seat = { state: 'harbor'|'queue'|'offer'|'play'|'spec'|'full'|'error', pos, queue, players, cap, offer_in, ... }
//     net.openRoom(idx) -> Promise<Link>
//   Link: on(ev, fn), send(ev, payload, { now }), setState(fn), open, close(), onStatus, stats(), heard (peers seen < 6 s)
// Everything a client says in one tick (its ship state + any events) goes out as ONE message, so an arena of N players
// at r Hz costs N·r·(N+S) Realtime msgs/s on Supabase (see PVP_NET in config.js), and N·r frames/s on the relay server.
// Static fields (name, levels, skin, K/D…) are only re-sent when they change or every 3 s (delta); an unchanged, quiet
// ship is suppressed down to a keepalive. Receivers merge deltas back into a full state before pvp.js sees it.
import { Room } from './net.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, PVP_NET, PVP_RELAY_URL } from './config.js';

const STATIC = ['n', 'lv', 'sk', 'K', 'D', 'm', 'k', 'd', 'g'];
const DYN_EPS = { x: 0.25, z: 0.25, y: 0.015, v: 0.15, t: 0.05 };

class Batcher {
  constructor(myId, cfg, rawSend) {
    this.myId = myId; this.cfg = cfg; this.rawSend = rawSend; this.handlers = new Map(); this.q = []; this.provider = null;
    this.last = 0; this.lastDyn = null; this.lastStatic = ''; this.lastStaticT = 0; this.full = new Map(); this.heardAt = new Map();
    this.sent = 0; this.recv = 0; this.bytes = 0; this.byEv = {}; this.t0 = performance.now(); this.forceStatic = true;
    this.timer = setInterval(() => this.tick(), 50);
  }
  on(ev, fn) { this.handlers.set(ev, fn); return this; }
  setState(fn) { this.provider = fn; }
  heard() { const now = performance.now(); let n = 0; for (const [id, t] of this.heardAt) { if (now - t < 6000) n++; else { this.heardAt.delete(id); this.full.delete(id); } } return n; }
  hz() { return this.heard() > 0 ? this.cfg.hz : this.cfg.soloHz; }
  send(ev, payload, o = {}) { this.q.push([ev, payload]); if (o.now) this.flush(true); return true; }
  tick() { if (performance.now() - this.last >= 1000 / this.hz() - 8) this.flush(false); }
  flush(force) {
    const now = performance.now(), st = this.provider ? this.provider() : null;
    let s;
    if (st) {
      const stat = {}; for (const k of STATIC) if (k in st) stat[k] = st[k];
      const sig = JSON.stringify(stat), dyn = { ...st }; for (const k of STATIC) delete dyn[k];
      const moved = !this.lastDyn || Object.keys(dyn).some(k => DYN_EPS[k] ? Math.abs((dyn[k] ?? 0) - (this.lastDyn[k] ?? 0)) > DYN_EPS[k] : JSON.stringify(dyn[k]) !== JSON.stringify(this.lastDyn[k]));
      const staticDue = this.forceStatic || sig !== this.lastStatic || now - this.lastStaticT > 3000;
      if (!force && !this.q.length && !moved && !staticDue && now - this.last < this.cfg.keepalive * 1000) return; // idle suppression
      s = staticDue ? st : dyn; s.i = this.myId;
      if (staticDue) { this.lastStatic = sig; this.lastStaticT = now; this.forceStatic = false; }
      this.lastDyn = dyn;
    } else if (!this.q.length) return;
    const msg = { i: this.myId }; if (s) msg.s = s; if (this.q.length) msg.e = this.q.splice(0, 40);
    this.last = now;
    if (this.rawSend(msg)) { this.sent++; for (const [ev] of msg.e || []) this.byEv['s:' + ev] = (this.byEv['s:' + ev] || 0) + 1; if (s) this.byEv['s:s'] = (this.byEv['s:s'] || 0) + 1; }
  }
  receive(m) { // one batched message from another client
    if (!m || typeof m.i !== 'string' || m.i === this.myId || m.i.length > 20) return;
    this.recv++; this.heardAt.set(m.i, performance.now());
    if (m.s && typeof m.s === 'object') {
      const f = Object.assign(this.full.get(m.i) || {}, m.s); f.i = m.i; this.full.set(m.i, f);
      if ('n' in f) this.dispatch('s', { ...f }); // wait for the first full state (≤ 3 s) before showing a ship
    }
    if (Array.isArray(m.e)) for (const ev of m.e.slice(0, 40)) if (Array.isArray(ev) && typeof ev[0] === 'string') this.dispatch(ev[0], ev[1] || {});
  }
  dispatch(ev, p) { this.byEv['r:' + ev] = (this.byEv['r:' + ev] || 0) + 1; const fn = this.handlers.get(ev); if (fn) { try { fn(p); } catch (e) { console.warn('[pvp] handler', ev, e); } } }
  stats() { const secs = (performance.now() - this.t0) / 1000; return { secs, sent: this.sent, recv: this.recv, sentPerSec: this.sent / secs, recvPerSec: this.recv / secs, byEv: { ...this.byEv }, hz: this.hz() }; }
  resetStats() { this.sent = this.recv = 0; this.byEv = {}; this.t0 = performance.now(); }
  stop() { clearInterval(this.timer); }
}

// ---------------- Supabase Realtime (free-plan fallback) ----------------
function supabaseNet({ prefix, myId }) {
  const cfg = PVP_NET.supabase;
  async function lobby(op, o = {}) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pvp_lobby`, { method: 'POST', keepalive: !!o.keepalive,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ p_seat: o.seat, p_prefix: prefix, p_op: op, p_name: o.name || null, p_cap: o.cap ?? null, p_offer: o.offer ?? null }) });
      if (!r.ok) return { state: 'error', status: r.status };
      return await r.json();
    } catch { return { state: 'error' }; }
  }
  async function openRoom(idx) {
    const room = new Room(`${prefix}-${idx}`);
    const link = new Batcher(myId, cfg, (msg) => room.send('b', msg));
    room.on('b', (m) => link.receive(m));
    link.open = false; link.onStatus = () => {};
    room.onStatus = (s) => { link.open = room.open; link.onStatus(s); };
    link.close = () => { link.stop(); room.close(); link.open = false; };
    await room.connect(); link.open = true; link.room = room;
    Object.defineProperty(link, 'open', { get: () => room.open, set() {} });
    return link;
  }
  return { kind: 'supabase', cfg, lobby, openRoom };
}

// ---------------- relay server (server/relay.js): one socket, lobby + room, server batches one frame per tick ----------------
function relayNet({ prefix, myId }) {
  const cfg = PVP_NET.relay;
  let ws = null, ready = null, ref = 0, link = null; const wait = new Map(); let pushSeat = null;
  function conn() {
    if (ready) return ready;
    ready = new Promise((res, rej) => {
      ws = new WebSocket(`${PVP_RELAY_URL}?prefix=${encodeURIComponent(prefix)}&id=${encodeURIComponent(myId)}`);
      const to = setTimeout(() => rej(new Error('relay timeout')), 8000);
      ws.onopen = () => { clearTimeout(to); res(ws); };
      ws.onerror = () => rej(new Error('relay error'));
      ws.onclose = () => { ready = null; for (const f of wait.values()) f({ state: 'error' }); wait.clear(); if (link) { link._open = false; link.onStatus('reconnecting'); } };
      ws.onmessage = (ev) => {
        let d; try { d = JSON.parse(ev.data); } catch { return; }
        if (d.t === 'seat') { const f = wait.get(d.ref); if (f) { wait.delete(d.ref); f(d.seat); } else pushSeat?.(d.seat); }
        else if (d.t === 'f' && link) for (const m of d.m || []) link.receive(m);
        else if (d.t === 'full') { if (link) link.onStatus('limit'); }
      };
    });
    ready.catch(() => { ready = null; });
    return ready;
  }
  async function lobby(op, o = {}) {
    try { await conn(); } catch { return { state: 'error' }; }
    const r = ++ref; return new Promise((res) => { wait.set(r, res); ws.send(JSON.stringify({ t: 'lobby', ref: r, op, name: o.name, cap: o.cap, offer: o.offer })); setTimeout(() => { if (wait.delete(r)) res({ state: 'error' }); }, 6000); });
  }
  async function openRoom() {
    await conn();
    link = new Batcher(myId, cfg, (msg) => { if (ws?.readyState === 1) { ws.send(JSON.stringify({ t: 'b', s: msg.s, e: msg.e })); return true; } return false; });
    link._open = true; link.onStatus = () => {};
    Object.defineProperty(link, 'open', { get: () => link._open && ws?.readyState === 1, set() {} });
    ws.send(JSON.stringify({ t: 'enter' }));
    link.close = () => { link.stop(); try { ws?.readyState === 1 && ws.send(JSON.stringify({ t: 'exit' })); } catch {} link._open = false; link = null; };
    return link;
  }
  return { kind: 'relay', cfg, lobby, openRoom, set onSeat(f) { pushSeat = f; } };
}

export function createNet(o) { return PVP_RELAY_URL ? relayNet(o) : supabaseNet(o); }
