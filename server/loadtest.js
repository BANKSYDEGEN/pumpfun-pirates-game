// Load test for relay.js: N fake clients join one arena (and spectators), send 10 Hz states + occasional volleys.
// usage: node loadtest.js [players=16] [spectators=0] [secs=20] [url=ws://localhost:8080] [arenas=1]
import WebSocket from 'ws';
const [P = 16, S = 0, SECS = 20, URL = 'ws://localhost:8080', ARENAS = 1] = process.argv.slice(2).map((v, i) => (i === 3 ? v : Number(v)));
let recvFrames = 0, recvBytes = 0, lagMax = 0, opened = 0; const lat = [];
function bot(i, spec, ar) {
  const id = ('lt' + ar + 'x' + i + 'abcdef').slice(0, 14), ws = new WebSocket(`${URL}?prefix=pfp-pvp-load&id=${id}`);
  let ref = 0, x = Math.random() * 600 - 300, z = Math.random() * 600 - 300, y = Math.random() * 6;
  ws.on('open', () => { opened++; ws.send(JSON.stringify({ t: 'lobby', ref: ++ref, op: spec ? 'spec' : 'play' })); });
  ws.on('message', (b) => {
    recvBytes += b.length; const d = JSON.parse(b);
    if (d.t === 'seat' && d.ref === 1) { if (['play', 'spec'].includes(d.seat.state)) { ws.send(JSON.stringify({ t: 'enter' })); if (!spec) start(); } }
    if (d.t === 'f') { recvFrames++; for (const m of d.m) if (m.s?.ts) lat.push(Date.now() - m.s.ts); }
  });
  function start() {
    let n = 0;
    setInterval(() => {
      y += (Math.random() - 0.5) * 0.2; x += Math.sin(y) * 1.2; z += Math.cos(y) * 1.2; n++;
      const s = { x: +x.toFixed(1), z: +z.toFixed(1), y: +y.toFixed(2), v: 12, t: 0, h: 200, a: 1, p: 0, l: 1, ts: Date.now() };
      if (n % 30 === 1) Object.assign(s, { n: 'BOT ' + i, lv: [1, 2, 3, 1, 2, 3, 1], sk: 'classic', K: 5, D: 3, m: 200, k: 1, d: 0, g: 50 });
      const e = n % 25 === 0 ? [['shot', { o: id, b: [[x, 2, z, 30, 5, 30, 0], [x, 2, z, 31, 5, 29, 0.1], [x, 2, z, 29, 5, 31, 0.2], [x, 2, z, 30, 6, 30, 0.3]] }]] : undefined;
      ws.send(JSON.stringify({ t: 'b', s, e }));
    }, 100);
  }
}
for (let a = 0; a < ARENAS; a++) { for (let i = 0; i < P; i++) bot(i, false, a); for (let i = 0; i < S; i++) bot(1000 + i, true, a); }
let last = Date.now(); setInterval(() => { const t = Date.now(); lagMax = Math.max(lagMax, t - last - 50); last = t; }, 50);
setTimeout(async () => {
  const h = await fetch(URL.replace('ws', 'http') + '/health').then(r => r.json());
  lat.sort((a, b) => a - b); const c = (P + S) * ARENAS;
  console.log(JSON.stringify({ arenas: ARENAS, players: P, spectators: S, opened, secs: SECS, framesPerClientPerSec: +(recvFrames / c / SECS).toFixed(2),
    kbPerClientPerSec: +(recvBytes / c / SECS / 1024).toFixed(1), totalOutMbps: +(recvBytes * 8 / SECS / 1e6).toFixed(2), p50ms: lat[lat.length >> 1], p99ms: lat[Math.floor(lat.length * 0.99)], loadgenLagMaxMs: lagMax, server: h.arenas.slice(0, 3) }));
  process.exit(0);
}, SECS * 1000);
