// [join-queue] BANKSY t2505u "Add the join queue too": extend the v577 SEAS ARE CROWDED
// card (js/netGate.js) — same UI, same 6 s → 60 s jittered backoff — with a server cap
// (pvp_scale_config.world_cap, one value to raise later), a place in line, and an owner
// bypass. Players who press ENTER GAME wait on the title screen when the world is full
// and get in automatically when a slot opens. Polls are lock-free on the server, paused
// when the tab is hidden, and cancelled on MAIN MENU. Stale queue rows expire in 135 s.
import { netGate, onGate } from './netGate.js';
import { tabHidden } from './pollScale.js';
import { burstMs, JOIN_BURST_MS } from './joinBurst.js';
import { joinGate as joinGateApi } from './pvpSave.js';

export const JOIN_STALE_S = 135; // must match supabase/migrations/20261114220000_join_queue.sql
export const WORLD_CAP_DEFAULT = 120; // docs only; the live cap is the server config row

let waiting = false, held = false, timer = 0, onAdmit = null, watch = false, inflight = false;

export const isJoinWaiting = () => waiting;

export async function requestJoin({ spectate = false, enter } = {}) {
  onAdmit = typeof enter === 'function' ? enter : null;
  watch = !!spectate;
  const r = await ask('poll');
  if (r?.state === 'enter') { if (!r.fallback) held = true; clearWait(); return 'enter'; }
  if (r?.state === 'wait') held = true;
  showWait(r);
  armTimer();
  return 'wait';
}

export function cancelJoin() {
  const was = held;
  held = false;
  clearWait();
  if (was) ask('leave').catch(() => {});
}

function clearWait() {
  waiting = false;
  clearTimeout(timer); timer = 0;
  netGate.ok('join');
}

function armTimer() {
  waiting = true;
  clearTimeout(timer);
  const w = Math.max(0, netGate.wait('join'));
  const j = burstMs(Math.min(JOIN_BURST_MS, Math.max(500, w * 0.25)));
  timer = setTimeout(tick, (w || 0) + j);
}

async function tick() {
  if (!waiting) return;
  if (tabHidden()) { armTimer(); return; }
  if (inflight) { armTimer(); return; }
  const r = await ask('poll');
  if (!waiting) return;
  if (r?.state === 'enter') {
    if (!r.fallback) held = true;
    const enter = onAdmit;
    const spec = watch;
    clearWait();
    if (enter) enter(spec);
    return;
  }
  if (r?.state === 'wait') held = true;
  showWait(r);
  armTimer();
}

function showWait(r) {
  const full = r?.state === 'wait';
  netGate.fail('join', {
    full,
    status: full ? 200 : (r?.status || 0),
    pos: r?.pos | 0,
    cap: r?.cap | 0,
    in_world: r?.in_world | 0,
    ahead: r?.ahead | 0,
    queue: r?.queue | 0,
    solo: false, // still on the title screen: no private-harbor option
  });
}

async function ask(op) {
  inflight = true;
  try {
    const r = await joinGateApi(op);
    if (r && r.state === 'enter') return r;
    if (r && r.state === 'wait') return r;
    if (r && r.state === 'leave') return r;
    return r || { state: 'error', status: 0 };
  } catch (e) {
    // Old edge function (unknown action) must not brick ENTER GAME.
    if (e && (e.status === 404 || (e.status === 400 && /unknown action/i.test(e.body?.error || e.message || '')))) {
      return { state: 'enter', fallback: true };
    }
    return { state: 'error', status: e?.status || 0 };
  } finally { inflight = false; }
}

onGate((what) => { if (what === 'now' && waiting) { netGate.retryNow('join'); tick(); } });
const doc = globalThis.document;
doc?.addEventListener('visibilitychange', () => {
  if (!waiting || tabHidden()) return;
  netGate.retryNow('join');
  tick();
});
