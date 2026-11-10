// [cache-queue] BANKSY t2486u "Do 4 and 5 rn" (capacity review fix 5): the JOIN GATE.
// When the shared servers answer "full", 429, 5xx or nothing at all, clients wait their turn with exponential backoff + jitter
// (about 6 s -> 12 -> 24 -> 48 -> 60 s, never more than 60 s unless the server's own Retry-After says longer, capped at 120 s)
// instead of retrying every few seconds, and the player sees a "SEAS ARE CROWDED" card with the next try time.
// The game never blocks on it: SAIL SOLO WHILE YOU WAIT folds the card into a small chip and the private harbor keeps playing.
// Nothing here invents data: the card only shows what the server said (full / busy / offline) and our own retry clock.
import { devHook } from './env.js';
export const GATE = { base: 6000, max: 60000, jitter: 0.25, retryAfterMax: 120000, apiStreak: 3 };
export const isOverload = (status) => !status || status === 429 || status >= 500; // 0 / undefined = network error or CORS-less 5xx
// attempt 1 = 6 s ±25 %, doubling, clamped to [base/2, max]; a server Retry-After (seconds) wins when it is longer (<= 120 s)
export function backoffMs(attempt, { retryAfter = 0, rnd = Math.random, cfg = GATE } = {}) {
  const n = Math.max(1, attempt | 0), raw = Math.min(cfg.max, cfg.base * 2 ** (n - 1)), j = raw * cfg.jitter;
  let ms = Math.round(Math.min(cfg.max, Math.max(cfg.base / 2, raw - j + rnd() * 2 * j)));
  const ra = Number(retryAfter); if (Number.isFinite(ra) && ra > 0) ms = Math.max(ms, Math.min(cfg.retryAfterMax, Math.round(ra * 1000)));
  return ms;
}
export const retryAfterOf = (r) => { try { const v = r?.headers?.get?.('retry-after'); const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; } catch { return 0; } };
// What the card says, by reason. 'full' = every shared harbor copy / queue is taken (the server said so); 'busy' = 429 / 5xx;
// 'offline' = no answer at all.
export const GATE_TEXT = {
  full: { title: 'SEAS ARE CROWDED', body: "Every shared harbor is packed right now. You're sailing your own private harbor, and we'll seat you with other pirates as soon as a spot opens." },
  busy: { title: 'SEAS ARE CROWDED', body: "The servers are swamped with pirates. Your game keeps going, and we'll try again for you automatically." },
  offline: { title: 'SEAS ARE CROWDED', body: "We can't reach the servers right now. Your game keeps going, and we'll try again for you automatically." },
};
// sources: 'harbor' (seat beat), 'lobby' (arena queue), 'api' (pvp edge function). Only 'harbor' / 'lobby' and an api failure
// streak of GATE.apiStreak show the card; a single failed call just backs off quietly.
export function createGate({ clock = () => Date.now(), rnd = Math.random, ui = null, cfg = GATE } = {}) {
  const src = new Map(); let shown = null, folded = false;
  const vis = () => { let best = null; for (const [k, s] of src) { if (!s.show) continue; if (!best || s.until > best.until) best = { k, ...s }; } return best; };
  const sync = () => { const v = vis(); if (!ui) { shown = v; return; } if (v) { ui.show({ reason: v.reason, until: v.until, attempt: v.n, source: v.k, folded }); shown = v; } else if (shown) { ui.hide(); shown = null; folded = false; } };
  return {
    // a failed / full answer: returns the wait (ms) before this source may ask again
    fail(k, { status = 0, full = false, retryAfter = 0, quiet = false } = {}) {
      const s = src.get(k) || { n: 0, until: 0 }; s.n++; const ms = backoffMs(s.n, { retryAfter, rnd, cfg });
      s.until = clock() + ms; s.reason = full ? 'full' : status ? 'busy' : 'offline'; s.show = !quiet && (k !== 'api' || s.n >= cfg.apiStreak); src.set(k, s); sync(); return ms;
    },
    ok(k) { if (!src.has(k)) return; src.delete(k); sync(); },
    mute(k) { const s = src.get(k); if (s?.show) { s.show = false; sync(); } }, // stopped asking (left the harbor / hidden tab): hide the card, KEEP the backoff

    wait(k) { const s = src.get(k); return s ? Math.max(0, s.until - clock()) : 0; },
    attempts(k) { return src.get(k)?.n | 0; },
    retryNow(k) { const s = src.get(k); if (s) { s.until = Math.min(s.until, clock()); } }, // the TRY NOW button (the caller rate-limits it)
    fold(v = true) { folded = !!v; sync(); },
    get folded() { return folded; },
    get visible() { return vis(); },
  };
}

// one HTTP call through the gate: a background POLL asked while source k waits fails at once without a request (e.status 503,
// e.gated); anything else still goes out. 429 / 5xx / no answer -> fail(k) (backoff); any other answer -> ok(k).
export async function gateCall(gate, k, poll, doFetch, { keepalive = false } = {}) {
  if (poll && gate.wait(k) > 0) { const e = new Error('seas are crowded · try again soon'); e.status = 503; e.gated = true; throw e; }
  let r; try { r = await doFetch(); } catch (e) { if (!keepalive) gate.fail(k); throw e; }
  if (isOverload(r.status)) gate.fail(k, { status: r.status, retryAfter: retryAfterOf(r) }); else gate.ok(k);
  return r;
}

// ---------------- the card (DOM; brand: Just Another Hand, red #fa0d0d / gold #ffcd77 / dark #161616, real skull) ----------------
function makeUi(doc) {
  let el = null, chip = null, timer = 0, cur = null, tries = new Map(); const listeners = new Set();
  const secs = () => Math.max(0, Math.ceil((cur.until - Date.now()) / 1000));
  const paint = () => {
    if (!cur) return; const s = secs(), t = s ? `next try in ${s}s` : 'trying now…';
    const n = el?.querySelector('.sc-next'); if (n) n.textContent = t;
    const a = el?.querySelector('.sc-try'); if (a) a.textContent = `attempt ${cur.attempt} · we wait a little longer each time so the seas can clear`;
    const c = chip?.querySelector('b'); if (c) c.textContent = s ? `${s}s` : '…';
  };
  const build = () => {
    if (el) return;
    el = doc.createElement('div'); el.id = 'seas-crowded'; el.className = 'hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-labelledby', 'sc-title');
    el.innerHTML = `<div class="sc-card"><img class="sc-skull" src="assets/skull_transparent.png" alt="" draggable="false"><h2 id="sc-title" class="sc-title"></h2><p class="sc-body"></p>
      <div class="sc-wait"><span class="sc-dots"><i></i><i></i><i></i></span><span class="sc-next"></span></div><p class="sc-try"></p>
      <div class="sc-btns"><button type="button" class="sc-solo">SAIL SOLO WHILE YOU WAIT</button><button type="button" class="sc-now">TRY NOW</button></div></div>`;
    chip = doc.createElement('button'); chip.type = 'button'; chip.id = 'seas-crowded-chip'; chip.className = 'hidden'; chip.innerHTML = '⚓ SEAS CROWDED · retry <b></b>';
    el.querySelector('.sc-solo').onclick = () => { for (const f of listeners) f('fold'); };
    el.querySelector('.sc-now').onclick = () => { for (const f of listeners) f('now'); };
    chip.onclick = () => { for (const f of listeners) f('unfold'); };
    (doc.body || doc.documentElement).append(el, chip);
  };
  return {
    show(v) { build(); cur = v; const tx = GATE_TEXT[v.reason] || GATE_TEXT.busy; el.querySelector('.sc-title').textContent = tx.title; el.querySelector('.sc-body').textContent = tx.body;
      el.classList.toggle('hidden', !!v.folded); chip.classList.toggle('hidden', !v.folded); paint(); if (!timer) timer = setInterval(paint, 500); },
    hide() { cur = null; el?.classList.add('hidden'); chip?.classList.add('hidden'); clearInterval(timer); timer = 0; },
    on(f) { listeners.add(f); },
    get el() { return el; },
  };
}
const doc = globalThis.document;
const ui = doc ? makeUi(doc) : null;
export const netGate = createGate({ ui });
// TRY NOW: at most once every 5 s, and only for the sources that are waiting; callers poll netGate.wait() each tick anyway.
let tryNowAt = 0;
ui?.on((what) => {
  if (what === 'fold') netGate.fold(true); else if (what === 'unfold') netGate.fold(false);
  else if (what === 'now' && Date.now() - tryNowAt > 5000) { tryNowAt = Date.now(); for (const k of ['harbor', 'lobby', 'api']) netGate.retryNow(k); }
});
devHook('PFP_NET_GATE', netGate); // dev servers only (QA / screenshots): PFP_NET_GATE.fail('harbor', { full: true })
