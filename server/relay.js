// PUMPFUN PIRATES · PvP relay server (Node + ws). NOT deployed: hosting is the owner's call (see README.md).
// One process = one authoritative lobby per arena prefix (seats, FIFO queue, offers, rotation) + a relay that batches
// ONE frame per tick per client with interest management, so delivered messages grow N·r (not N²·r).
// Same lobby semantics as supabase/migrations/007_pvp_lobby.sql; same batched message format as js/transport.js.
import { WebSocketServer } from 'ws';
import http from 'node:http';

const env = (k, d) => (process.env[k] !== undefined ? Number(process.env[k]) : d);
const PORT = env('PORT', 8080);
const HZ = env('HZ', 10);                 // frames per second sent to each client
const MAX_ARENA = env('MAX_ARENA', 16);   // players per arena room (js/config.js PVP_NET.relay.maxArena must match)
const ROOMS = env('ROOMS', 12);           // arena rooms per prefix in this process; the queue starts when ALL are full
const MAX_SPEC = env('MAX_SPEC', 64);     // spectators per arena
const MAX_QUEUE = env('MAX_QUEUE', 500);
const MAX_CLIENTS = env('MAX_CLIENTS', 3000); // whole process (lobby + harbor + arena + spectators)
const OFFER_S = env('OFFER_S', 15);       // 'Battle ready! Set sail?' window
const INTEREST_R = env('INTEREST_R', 320);// metres: ships closer than this get every tick
const FAR_EVERY = env('FAR_EVERY', 5);    // farther ships: every Nth tick (2 Hz at 10 Hz)
const SHOT_R = env('SHOT_R', 360);        // cannon volleys only go to clients within this range (spectators get all)
const MSG_RATE = env('MSG_RATE', 40), MSG_MAX = env('MSG_MAX', 16384);
const LIVE_PREFIX = 'pfp-pvp-v1';
const STATIC = ['n', 'lv', 'sk', 'K', 'D', 'm', 'k', 'd', 'g'];
const ID_RE = /^[a-z0-9]{6,20}$/i, PREFIX_RE = /^pfp-pvp-[a-z0-9]{1,16}$/i;

const arenas = new Map(); // prefix -> { prefix, seats: Map<id, seat>, rooms: Map<idx, { players: Set<client>, specs: Set<client> }>, cap, offerS }
let clients = 0, tickNo = 0, framesOut = 0, bytesOut = 0, msgsIn = 0;
const now = () => Date.now();

function arenaOf(prefix) {
  let a = arenas.get(prefix);
  if (!a) { a = { prefix, seats: new Map(), rooms: new Map(), cap: MAX_ARENA, offerS: OFFER_S, roomsMax: ROOMS }; arenas.set(prefix, a); }
  return a;
}
function roomOf(a, idx) { let r = a.rooms.get(idx); if (!r) { r = { players: new Set(), specs: new Set() }; a.rooms.set(idx, r); } return r; }
const inRoom = (a, idx) => [...a.seats.values()].filter(s => (s.state === 'play' || s.state === 'offer') && s.room === idx).length;
function freeRoom(a) { // the fullest room that still has space (keeps fights busy), else null
  let best = null, bn = -1;
  for (let i = 1; i <= a.roomsMax; i++) { const n = inRoom(a, i); if (n < a.cap && n > bn) { best = i; bn = n; } }
  return best;
}
// ---------------- lobby ----------------
const seatsIn = (a, ...st) => [...a.seats.values()].filter(s => st.includes(s.state));
const queueOrder = (a) => seatsIn(a, 'queue').sort((x, y) => x.enq - y.enq || (x.id < y.id ? -1 : 1));
function expireOffers(a) {
  const t = now();
  for (const s of seatsIn(a, 'offer')) if (s.offerUntil < t) { s.state = 'queue'; s.misses++; s.skipUntil = t + 20000; s.offerUntil = 0; if (s.misses >= 2) { s.misses = 0; s.enq = t; } push(s); }
}
function promote(a) {
  for (;;) {
    const room = freeRoom(a); if (!room) break;
    const head = queueOrder(a).find(s => s.skipUntil < now()); if (!head) break;
    head.state = 'offer'; head.room = room; head.offerUntil = now() + a.offerS * 1000; push(head);
  }
  for (const s of seatsIn(a, 'queue')) push(s, true); // positions moved
}
function seatInfo(a, s) {
  const q = queueOrder(a), players = seatsIn(a, 'play').length;
  const base = { room: s?.room || 1, queue: q.length, players: s?.room ? inRoom(a, s.room) : players, total: players, spectators: seatsIn(a, 'spec').length, cap: a.cap, rooms: a.roomsMax, hz: HZ };
  if (!s) return { state: 'harbor', ...base };
  const before = [...seatsIn(a, 'offer'), ...q].filter(o => o.enq < s.enq || (o.enq === s.enq && o.id < s.id)).length;
  return { state: s.state, pos: s.state === 'queue' ? before + 1 : null, offer_in: s.state === 'offer' ? Math.max(0, (s.offerUntil - now()) / 1000) : null, misses: s.misses, ...base };
}
function push(s, onlyPos = false) {
  const c = s.client; if (!c || c.readyState !== 1) return;
  const info = seatInfo(c.arena, s); const k = `${info.state}:${info.pos}:${info.queue}`;
  if (onlyPos && c.lastPush === k) return; c.lastPush = k; send(c, { t: 'seat', seat: info });
}
function lobby(c, m) {
  const a = c.arena; expireOffers(a);
  if (a.prefix !== LIVE_PREFIX) { if (m.cap) { a.cap = Math.max(1, Math.min(MAX_ARENA, m.cap | 0)); a.roomsMax = m.cap < MAX_ARENA ? 1 : ROOMS; } if (m.offer) a.offerS = Math.max(3, Math.min(OFFER_S, m.offer | 0)); } // test prefixes: small single-room arena
  let s = a.seats.get(c.id); const t = now();
  switch (m.op) {
    case 'leave': if (s) { a.seats.delete(c.id); leaveRoom(c); } s = null; break;
    case 'accept': if (s?.state === 'offer') { s.state = 'play'; s.misses = 0; s.offerUntil = 0; } break;
    case 'decline': if (s?.state === 'offer') { s.state = 'queue'; s.misses++; s.skipUntil = t + 20000; s.offerUntil = 0; if (s.misses >= 2) { s.misses = 0; s.enq = t; } } break;
    case 'died': if (s?.state === 'play' && seatsIn(a, 'queue').length) { s.state = 'queue'; s.enq = t; s.misses = 0; s.skipUntil = 0; } break;
    case 'spec': if (!s) {
      if (seatsIn(a, 'spec').length >= MAX_SPEC * a.roomsMax) return { state: 'full', why: 'spectators' };
      let room = 1, bn = -1; for (let i = 1; i <= a.roomsMax; i++) { const n = inRoom(a, i); if (n > bn) { bn = n; room = i; } } // the busiest room
      s = { id: c.id, client: c, state: 'spec', room, enq: t, misses: 0, skipUntil: 0, offerUntil: 0 }; a.seats.set(c.id, s);
    } break;
    case 'play': if (!s) {
      const q = seatsIn(a, 'queue').length; if (q >= MAX_QUEUE) return { state: 'full', why: 'queue' };
      const room = q === 0 ? freeRoom(a) : null;
      s = { id: c.id, client: c, state: room ? 'play' : 'queue', room, enq: t, misses: 0, skipUntil: 0, offerUntil: 0 }; a.seats.set(c.id, s);
    } break;
    case 'poll': break;
    default: return { state: 'error' };
  }
  if (s && s.state !== 'play' && c.inRoom === 'player') leaveRoom(c); // rotated / lost seat: out of the arena
  promote(a);
  return seatInfo(a, s);
}
// ---------------- arena relay ----------------
function enterRoom(c) {
  const s = c.arena.seats.get(c.id); if (!s) return send(c, { t: 'full', why: 'no seat' });
  const r = roomOf(c.arena, s.room || 1); c.room = r;
  if (s.state === 'play') { c.inRoom = 'player'; r.players.add(c); }
  else if (s.state === 'spec') { c.inRoom = 'spec'; r.specs.add(c); }
  else return send(c, { t: 'full', why: 'not your turn' });
  c.full = null; c.staticVer = 0; c.ver = 0; c.events = []; c.sv = new Map(); c.seen = new Map();
}
function leaveRoom(c) { c.room?.players.delete(c); c.room?.specs.delete(c); c.room = null; c.inRoom = null; c.full = null; }
function onBatch(c, m) {
  if (!c.inRoom) return;
  if (m.s && typeof m.s === 'object' && c.inRoom === 'player') {
    const f = c.full || (c.full = {}); let stat = false;
    for (const [k, v] of Object.entries(m.s)) { if (STATIC.includes(k) && JSON.stringify(f[k]) !== JSON.stringify(v)) stat = true; f[k] = v; }
    f.i = c.id; if (stat) c.staticVer++; c.ver = (c.ver || 0) + 1;
  }
  if (Array.isArray(m.e)) for (const ev of m.e.slice(0, 40)) if (Array.isArray(ev) && typeof ev[0] === 'string') c.events.push(ev);
}
const DYN = (f) => { const o = {}; for (const k in f) if (!STATIC.includes(k)) o[k] = f[k]; return o; };
function tick() {
  tickNo++;
  for (const a of arenas.values()) { expireOffers(a); promote(a); for (const room of a.rooms.values()) tickRoom(room); }
}
function tickRoom(a) {
  {
    const senders = [...a.players, ...a.specs].filter(o => o.full || o.events.length);
    if (!senders.length) return;
    for (const r of [...a.players, ...a.specs]) {
      const m = [];
      for (const o of senders) {
        if (o === r) continue;
        const item = { i: o.id }; let has = false;
        if (o.full && r.seen.get(o.id) !== o.ver) {
          const near = !r.full || r.inRoom === 'spec' || Math.hypot((o.full.x || 0) - (r.full.x || 0), (o.full.z || 0) - (r.full.z || 0)) < INTEREST_R;
          if (near || tickNo % FAR_EVERY === 0) {
            const sv = r.sv.get(o.id); item.s = sv === o.staticVer ? DYN(o.full) : { ...o.full }; r.sv.set(o.id, o.staticVer); r.seen.set(o.id, o.ver); has = true;
          }
        }
        const ev = o.events.filter(e => e[0] !== 'shot' || r.inRoom === 'spec' || !r.full || !o.full || Math.hypot((o.full.x || 0) - (r.full.x || 0), (o.full.z || 0) - (r.full.z || 0)) < SHOT_R);
        if (ev.length) { item.e = ev; has = true; }
        if (has) m.push(item);
      }
      if (m.length) send(r, { t: 'f', m });
    }
    for (const o of senders) o.events = [];
  }
}
function send(c, o) { if (c.readyState !== 1) return; const s = JSON.stringify(o); framesOut++; bytesOut += s.length; c.send(s); }

// ---------------- server ----------------
const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ ok: true, clients, arenas: [...arenas.values()].map(a => ({ prefix: a.prefix, rooms: [...a.rooms.entries()].filter(([, r]) => r.players.size || r.specs.size).map(([i, r]) => [i, r.players.size, r.specs.size]), queue: seatsIn(a, 'queue').length })), framesOut, bytesOut, msgsIn }));
  } else { res.writeHead(404); res.end(); }
});
const wss = new WebSocketServer({ server, maxPayload: MSG_MAX });
wss.on('connection', (c, req) => {
  const u = new URL(req.url, 'http://x'), id = u.searchParams.get('id') || '', prefix = u.searchParams.get('prefix') || '';
  if (!ID_RE.test(id) || !PREFIX_RE.test(prefix)) { c.close(1008, 'bad id'); return; }
  if (clients >= MAX_CLIENTS) { c.send(JSON.stringify({ t: 'full', why: 'server' })); c.close(1013, 'full'); return; }
  const a = arenaOf(prefix);
  const old = a.seats.get(id); if (old?.client && old.client !== c) { try { old.client.close(4000, 'replaced'); } catch {} }
  clients++; c.id = id; c.arena = a; c.alive = true; c.inRoom = null; c.events = []; c.tokens = MSG_RATE; c.tt = now();
  if (old) old.client = c;
  c.on('pong', () => { c.alive = true; });
  c.on('message', (buf) => {
    const t = now(); c.tokens = Math.min(MSG_RATE, c.tokens + (t - c.tt) / 1000 * MSG_RATE); c.tt = t;
    if (c.tokens < 1) return; c.tokens--; msgsIn++;
    let m; try { m = JSON.parse(buf); } catch { return; }
    if (m.t === 'b') onBatch(c, m);
    else if (m.t === 'lobby') send(c, { t: 'seat', ref: m.ref, seat: lobby(c, m) });
    else if (m.t === 'enter') enterRoom(c);
    else if (m.t === 'exit') leaveRoom(c);
  });
  c.on('close', () => {
    clients--; leaveRoom(c);
    const s = a.seats.get(id); if (s && s.client === c) { a.seats.delete(id); promote(a); } // a dropped socket frees the seat
  });
});
setInterval(tick, 1000 / HZ);
setInterval(() => { for (const c of wss.clients) { if (!c.alive) { c.terminate(); continue; } c.alive = false; c.ping(); } }, 20000);
server.listen(PORT, () => console.log(`[relay] :${PORT} hz=${HZ} maxArena=${MAX_ARENA} maxClients=${MAX_CLIENTS}`));
