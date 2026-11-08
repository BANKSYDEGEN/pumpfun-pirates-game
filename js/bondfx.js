// $SUNK BONDED celebration (BANKSY 12:32 PM Nov 8 2026): confetti + sky fireworks + banner over the whole island, for everyone online.
// Fires only from server-confirmed chain data: boardfeed details.SUNK.bondedAt, set when the pump.fun bonding-curve account reads
// complete=true (curveSource 'chain'). Once per player (localStorage); players joining within 30 min of the bond see it once on join.
// ?bondfx=1 previews it on local dev hosts only (no server read/write). Screen-space overlay: one 2D canvas, capped particles, no lights.
import { SHARED_CACHE_URL } from './pumpfun/market.js';
const KEY = 'pfp_sunk_bonded_fx', WINDOW = 30 * 60e3, POLL = 60e3, DUR = 12e3;
export function bondFxDue(state, now, seen) {
  const d = state?.details?.SUNK, at = +d?.bondedAt;
  return !!(d && d.bonded === true && d.curveSource === 'chain' && at > 0 && at <= now + 60e3 && now - at < WINDOW && !seen);
}
export function playBondFx(doc = document, win = window) {
  if (doc.getElementById('pfp-bondfx')) return;
  const mobile = win.matchMedia?.('(pointer:coarse)').matches || win.innerWidth < 820, CAP = mobile ? 160 : 420, dpr = Math.min(win.devicePixelRatio || 1, mobile ? 1.5 : 2);
  const cv = doc.createElement('canvas'); cv.id = 'pfp-bondfx'; Object.assign(cv.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9000 });
  const ban = doc.createElement('div'); ban.textContent = '$SUNK BONDED!';
  Object.assign(ban.style, { position: 'fixed', left: '50%', top: '18%', transform: 'translate(-50%,-50%) scale(.6)', zIndex: 9001, pointerEvents: 'none', font: '900 ' + (mobile ? 40 : 72) + 'px system-ui,sans-serif',
    color: '#ffd166', textShadow: '0 0 18px #ff8c00, 0 4px 0 #6b2d00, 0 0 40px rgba(255,209,102,.8)', letterSpacing: '2px', transition: 'transform .5s cubic-bezier(.2,1.6,.4,1), opacity .8s', opacity: '0', whiteSpace: 'nowrap' });
  doc.body.append(cv, ban); win.requestAnimationFrame(() => { ban.style.opacity = '1'; ban.style.transform = 'translate(-50%,-50%) scale(1)'; });
  const g = cv.getContext('2d'), P = [], cols = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#f78c6b', '#ffffff', '#c77dff'];
  let W = 0, H = 0; const size = () => { W = win.innerWidth; H = win.innerHeight; cv.width = W * dpr; cv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0); }; size(); win.addEventListener('resize', size);
  const add = p => { if (P.length < CAP) P.push(p); };
  const confetti = n => { for (let i = 0; i < n; i++) add({ k: 0, x: Math.random() * W, y: -10 - Math.random() * 60, vx: (Math.random() - .5) * 60, vy: 60 + Math.random() * 90, r: Math.random() * 6.3, vr: (Math.random() - .5) * 8, s: 5 + Math.random() * 5, c: cols[i % cols.length], life: 6 }); };
  const rocket = () => add({ k: 1, x: W * (.12 + Math.random() * .76), y: H, vx: (Math.random() - .5) * 40, vy: -(H * .55 + Math.random() * H * .25), c: cols[(Math.random() * cols.length) | 0], life: .9 + Math.random() * .4 });
  const burst = (x, y, c) => { const n = mobile ? 26 : 48; for (let i = 0; i < n; i++) { const a = i / n * 6.283, v = 90 + Math.random() * 120; add({ k: 2, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, life: 1.3 + Math.random() * .6, max: 1.9 }); } };
  const t0 = performance.now(); let last = t0, nextRocket = 0, nextConf = 0;
  const frame = t => { const dt = Math.min(.05, (t - last) / 1000), el = t - t0; last = t;
    if (el < DUR - 3000) { if (el > nextRocket) { rocket(); nextRocket = el + (mobile ? 520 : 320); } if (el > nextConf) { confetti(mobile ? 10 : 22); nextConf = el + 400; } }
    g.clearRect(0, 0, W, H);
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.life -= dt;
      if (p.k === 1) { p.vy += H * .35 * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.life <= 0 || p.vy > -20) { burst(p.x, p.y, p.c); P.splice(i, 1); continue; } g.fillStyle = p.c; g.fillRect(p.x - 1.5, p.y - 6, 3, 12); continue; }
      if (p.life <= 0 || p.y > H + 20) { P.splice(i, 1); continue; }
      if (p.k === 0) { p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
      else { p.vx *= .985; p.vy = p.vy * .985 + 60 * dt; p.x += p.vx * dt; p.y += p.vy * dt; g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, 2.4, 0, 6.283); g.fill(); g.globalAlpha = 1; } }
    if (el > DUR - 1500) ban.style.opacity = '0';
    if (el < DUR || P.length) win.requestAnimationFrame(frame); else { cv.remove(); ban.remove(); win.removeEventListener('resize', size); } };
  win.requestAnimationFrame(frame);
}
export function startBondFx({ win = globalThis.window, fetcher = globalThis.fetch } = {}) {
  if (!win?.document) return;
  const ls = win.localStorage, seen = () => { try { return ls.getItem(KEY); } catch { return '1'; } }, mark = () => { try { ls.setItem(KEY, String(Date.now())); } catch {} };
  const local = /^(localhost|127\.0\.0\.1)$/.test(win.location.hostname);
  if (local && new URLSearchParams(win.location.search).get('bondfx') === '1') { setTimeout(() => playBondFx(win.document, win), 1500); return; } // preview only, never marks or reads server
  if (seen()) return;
  let timer = 0;
  const check = async () => { if (win.document.hidden) { timer = setTimeout(check, POLL); return; }
    try { const r = await fetcher(SHARED_CACHE_URL, { credentials: 'omit', referrerPolicy: 'no-referrer' }); const j = r.ok ? await r.json() : null, now = Date.now();
      if (j?.ok && j.state) { const d = j.state.details?.SUNK;
        if (bondFxDue(j.state, now, seen())) { mark(); playBondFx(win.document, win); return; }
        if (d?.bonded === true && d.curveSource === 'chain' && +d.bondedAt > 0 && now - d.bondedAt >= WINDOW) { mark(); return; } } // bonded long ago: never celebrate late
    } catch {}
    timer = setTimeout(check, POLL); };
  timer = setTimeout(check, 4000);
}
