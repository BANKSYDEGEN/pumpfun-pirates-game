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
import { retryAfterOf } from './netGate.js'; // [cache-queue] Retry-After on 429 / 5xx
import { isNetId, safeMerge } from './safe.js'; // [security] peer ids are whitelisted, peer JSON is merged without __proto__ keys
import { SUPABASE_URL, SUPABASE_ANON_KEY, PVP_NET, PVP_RELAY_URL, HARBOR_NET } from './config.js';

const STATIC = ['n', 'lv', 'sk', 'K', 'D', 'm', 'k', 'd', 'g', 'pc', 'hj', 'gr', 'ec', 'cr', 'cc', 'wl']; // [Raul weapon-sync] wl = weapon rarity + musket attachments (js/onfoot/weaponLook.js) // [Raul gear colours] cc = the crew's hat colour (js/crewLoadout.js crewColorToWire) // [Timothy] cr = the crew's own loadout (js/crewLoadout.js crewToWire) // [v98] pc = squads party tag; [v99] hj = when you joined this harbor copy (host order) // [Timothy] gr = equipped shop gear (js/pirateGear.js gearToWire)
const DYN_EPS = { x: 0.25, z: 0.25, y: 0.015, v: 0.15, t: 0.05 };

export class Batcher { // exported for tests
  constructor(myId, cfg, rawSend) {
    this.myId = myId; this.cfg = cfg; this.rawSend = rawSend; this.handlers = new Map(); this.q = []; this.provider = null;
    this.last = 0; this.lastDyn = null; this.lastStatic = ''; this.lastStaticT = 0; this.full = new Map(); this.heardAt = new Map();
    this.sent = 0; this.recv = 0; this.bytes = 0; this.byEv = {}; this.t0 = performance.now(); this.forceStatic = true; this.specs = 0; // [v339] spectator count (synced from lob.specs)
    this.timer = setInterval(() => this.tick(), 50);
  }
  on(ev, fn) { this.handlers.set(ev, fn); return this; }
  setState(fn) { this.provider = fn; }
  heard() { const now = performance.now(); let n = 0; for (const [id, t] of this.heardAt) { if (now - t < 6000) n++; else { this.heardAt.delete(id); this.full.delete(id); } } return n; }
  hz() { if (!(this.heard() > 0)) return this.cfg.soloHz; // [Emerly] boost: an optional () => Hz (harbor rooms: the battle areas' fight rate, 0 = off)
    // [v339] t1800u Solo Arena auto-scale: N·r·(N+S) <= scaleBudget (76.8); 2-4p stay at 4 Hz, 8p drops to 1.2 Hz. Cannon volleys still flush via { now: true }.
    if (this.cfg.scaleBudget) {
      const n = Math.max(2, this.heard() + 1), m = n + Math.max(0, this.specs | 0);
      return Math.max(this.cfg.minHz || 1, Math.min(this.cfg.hz, +(this.cfg.scaleBudget / (n * m)).toFixed(3)));
    }
    let b = 0; if (this.boost) try { b = Math.min(this.cfg.fight?.max || 10, Math.max(0, +this.boost() || 0)); } catch { b = 0; }
    return Math.max(this.cfg.hz, b); }
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
    if (!m || !isNetId(m.i) || m.i === this.myId) return; // [security H5] only base36 ids (6-20): an id is never markup
    this.recv++; this.heardAt.set(m.i, performance.now());
    if (m.s && typeof m.s === 'object' && !Array.isArray(m.s)) {
      const f = safeMerge(this.full.get(m.i) || Object.create(null), m.s); f.i = m.i; this.full.set(m.i, f); // [security] null prototype, no __proto__ keys
      if ('n' in f) this.dispatch('s', { ...f }, m.i); // wait for the first full state (≤ 3 s) before showing a ship
    }
    if (Array.isArray(m.e)) for (const ev of m.e.slice(0, 40)) if (Array.isArray(ev) && typeof ev[0] === 'string' && (ev[1] == null || (typeof ev[1] === 'object' && !Array.isArray(ev[1])))) this.dispatch(ev[0], ev[1] || {}, m.i);
  }
  // fn(payload, from): `from` = the (whitelisted) id of the batch the event arrived in, so handlers can check a payload's own id against it
  dispatch(ev, p, from) { this.byEv['r:' + ev] = (this.byEv['r:' + ev] || 0) + 1; const fn = this.handlers.get(ev); if (fn) { try { fn(p, from); } catch (e) { console.warn('[pvp] handler', ev, e); } } }
  stats() { const secs = (performance.now() - this.t0) / 1000; return { secs, sent: this.sent, recv: this.recv, sentPerSec: this.sent / secs, recvPerSec: this.recv / secs, byEv: { ...this.byEv }, hz: this.hz() }; }
  resetStats() { this.sent = this.recv = 0; this.byEv = {}; this.t0 = performance.now(); }
  stop() { clearInterval(this.timer); }
}

// ---------------- Supabase Realtime (free-plan fallback) ----------------
function supabaseNet({ prefix, myId, ticket }) {
  const cfg = PVP_NET.supabase;
  async function lobby(op, o = {}) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pvp_lobby`, { method: 'POST', keepalive: !!o.keepalive,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ p_seat: o.seat, p_prefix: o.prefix || pfx, p_op: op, p_name: o.name || null, p_cap: o.cap ?? null, p_offer: o.offer ?? null }) });
      if (!r.ok) return { state: 'error', status: r.status, retryAfter: retryAfterOf(r) }; // [cache-queue] callers back off (js/netGate.js)
      return await r.json();
    } catch { return { state: 'error' }; }
  }
  const openRoom = (idx) => openBatched(`${prefix}-${idx}`, myId, cfg, ticket);
  return { kind: 'supabase', cfg, lobby, openRoom };
}
async function openBatched(name, myId, cfg, ticket) { // one Realtime channel + the one-message-per-tick batcher
  const room = new Room(name, { ticket }); // [security M1] ticket(name) -> { jwt } (private channel), else the public join
  const link = new Batcher(myId, cfg, (msg) => room.send('b', msg));
  room.on('b', (m) => link.receive(m));
  link.open = false; link.onStatus = () => {};
  room.onStatus = (s) => { link.open = room.open; link.onStatus(s); };
  link.close = () => { link.stop(); room.close(); link.open = false; };
  try { await room.connect(); } catch (e) { link.stop(); room.close(); throw e; }
  link.open = true; link.room = room;
  Object.defineProperty(link, 'open', { get: () => room.open, set() {} });
  return link;
}

// ---------------- [v99] SHARED HARBOR copies (Supabase Realtime only; the relay build keeps private harbors) ----------------
//   createHarborNet({ prefix, myId }) -> null | { cfg, call(op, { seat, name, cap, keepalive }), openRoom(copy) }
//   call ops (pvp_harbor RPC, migration 021): beat (get / keep a copy seat) | spec (watch the busiest copy) | peek | leave
//   A copy of n pirates + s spectators costs n·1.5·(n+s) msgs/s (1 Hz state + volleys); the RPC keeps the harbor total
//   inside the free plan without ever touching the Solo / Squads arena budget.
export const HARBOR_PREFIX_RE = /^pfp-harbor(-[a-z0-9]{1,16})?$/; // = migration 021 / 041 p_prefix check (lower-case codes only)
export function createHarborNet({ prefix, myId, ticket }) {
  if (PVP_RELAY_URL || !SUPABASE_URL || !HARBOR_NET.on) return null;
  const cfg = HARBOR_NET; const base = prefix; let pfx = prefix; // [backpack-pvp server picker] pfx = 'pfp-harbor' (public) | 'pfp-harbor-<code>' (OWN server)
  async function call(op, o = {}) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/pvp_harbor`, { method: 'POST', keepalive: !!o.keepalive,
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ p_seat: o.seat, p_prefix: o.prefix || pfx, p_op: op, p_name: o.name || null, p_cap: o.cap ?? null, p_want_copy: o.wantCopy ?? null }) });
      if (!r.ok) return { state: 'error', status: r.status, retryAfter: retryAfterOf(r) }; // [cache-queue] callers back off (js/netGate.js)
      return await r.json();
    } catch { return { state: 'error' }; }
  }
  const setPrefix = (p) => { pfx = HARBOR_PREFIX_RE.test(String(p || '')) ? String(p) : base; return pfx; };
  return { kind: 'harbor', cfg, get prefix() { return pfx; }, base, setPrefix, call, openRoom: (copy) => openBatched(`${pfx}-${copy}`, myId, cfg, ticket) };
}

// ---------------- relay server (server/relay.js): one socket, lobby + room, server batches one frame per tick ----------------
function relayNet({ prefix, myId, ticket }) {
  const cfg = PVP_NET.relay;
  let ws = null, ready = null, ref = 0, link = null; const wait = new Map(); let pushSeat = null;
  function conn() {
    if (ready) return ready;
    ready = (async () => (ticket ? (await ticket(`${prefix}-1`, { relay: true }).catch(() => null))?.relay : null))().then((tk) => new Promise((res, rej) => {
      // [security M1] a hosted relay with RELAY_TICKET_SECRET only accepts sockets that carry a ticket from the pvp function
      ws = new WebSocket(`${PVP_RELAY_URL}?prefix=${encodeURIComponent(prefix)}&id=${encodeURIComponent(myId)}${tk ? `&ticket=${encodeURIComponent(tk)}` : ''}`);
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
    }));
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
