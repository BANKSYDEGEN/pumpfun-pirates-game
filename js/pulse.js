// [scale-free] One pvp edge `pulse` per player instead of separate fr_list + squad_invites +
// admin_register_net (+ walk XP when due). Gameplay and panel UI stay the same; only the wire changes.
import { tabHidden, WALK_XP_S } from './pollScale.js';

export const PULSE_MS = 30000;
export const PULSE_OPEN_MS = 8000; // friends panel or Squad Hall is open (same 8 s cadence as before)
// Steady visible-harbor edge rates (60 / interval). Walks ride along every 60 s, so they add no extra invocation.
export const EDGE_RPM_BEFORE = 11; // squad 4 + fr 2 + admin 2 + walks 3
export const EDGE_RPM_AFTER = 2;   // pulse 2 (walks included)
export const EDGE_RPM_BEFORE_HQ = 13; // + boardfeed 2
export const EDGE_RPM_AFTER_HQ = 3;   // + boardfeed 1 (60 s poll; often 0 while max-age is fresh)

const WALK_MS = WALK_XP_S * 1000;
const WALK_ACTIONS = new Set(['pet_walk', 'parrot_walk', 'pilly_walk']);

let bus = null;

export function getPulse() { return bus; }
export function setPulse(p) { bus = p; return p; }
export function resetPulse() { bus?.stop?.(); bus = null; }

export function ensurePulse(opts = {}) {
  if (bus) return bus;
  bus = createPulse(opts);
  return bus;
}

export function createPulse({ call, now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), hidden = tabHidden } = {}) {
  let last = null, lastAt = null, inflight = null, forced = false, timer = 0, walkAt = null;
  const parts = new Map(), opens = new Map(), walks = new Map(), listeners = new Set(), walkListeners = new Map();

  function isOpen() { for (const fn of opens.values()) { try { if (fn()) return true; } catch {} } return false; }
  function body() {
    const b = {};
    for (const fn of parts.values()) {
      try { const extra = fn(); if (extra && typeof extra === 'object') Object.assign(b, extra); } catch {}
    }
    return b;
  }
  function dueWalks(t) {
    if (walkAt == null) { walkAt = t; return []; } // first pulse starts the 60 s clock; same as walkT = 0
    if (t - walkAt < WALK_MS) return [];
    const out = [];
    for (const fn of walks.values()) {
      try { const rows = fn(); if (Array.isArray(rows)) for (const r of rows) if (r && WALK_ACTIONS.has(r.action)) out.push(r); } catch {}
    }
    return out.slice(0, 3);
  }
  function emit(r) {
    last = r;
    for (const fn of listeners) try { fn(r); } catch {}
    const wr = r?.walks && typeof r.walks === 'object' ? r.walks : null;
    if (wr) for (const [action, fns] of walkListeners) if (wr[action]) for (const fn of fns) try { fn(wr[action]); } catch {}
  }
  async function go(t) {
    const payload = body(), due = dueWalks(t);
    if (due.length) payload.walks = due;
    const r = await call('pulse', payload);
    if (due.length) walkAt = t;
    if (r && r.ok) emit(r);
    return r;
  }
  async function tick(t = now()) {
    if (hidden()) return last;
    if (inflight) return inflight;
    const gap = isOpen() ? PULSE_OPEN_MS : PULSE_MS;
    if (!forced && lastAt != null && t - lastAt < gap) return last;
    forced = false;
    lastAt = t;
    inflight = go(t).finally(() => { inflight = null; });
    return inflight;
  }
  function kick() { forced = true; return tick(now()); }
  function stop() { if (timer) { clearInterval(timer); timer = 0; } }

  return {
    get last() { return last; },
    get lastAt() { return lastAt; },
    tick, kick, stop,
    start(ms = 1000) { if (!timer) timer = setInterval(() => { tick(); }, ms); return this; },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onWalk(action, fn) {
      let set = walkListeners.get(action); if (!set) walkListeners.set(action, set = new Set());
      set.add(fn); return () => set.delete(fn);
    },
    setPart(key, fn) { if (fn) parts.set(key, fn); else parts.delete(key); },
    setOpen(key, fn) { if (fn) opens.set(key, fn); else opens.delete(key); },
    setWalks(key, fn) { if (fn) walks.set(key, fn); else walks.delete(key); },
    isOpen,
  };
}
