// [v349 money-makers] the client side of migration 053: every gold move goes to the server (pvp.inv.call('isl_*') -> island.ts -> the
// pvp_isl_* RPCs) and the reply's gold re-bases this save (pvp.serverGold, the 052 / casino rule: never synced twice).
// Offline, a guest without the harbor server, or a server without 053 ('closed'): PRACTICE MODE — the same loops run on this device
// (localStorage pfp_isl_v1) and pay this save like the casino's practice table. PvP money (bounties, prize fights, ringside bets)
// needs the live server and says so.
import { CONTRACT_BY_ID, CONTRACTS, contractProgress, contractDone, dayKey, crateGold, hordeWaveGold, HORDE, CRATE, diveLoot, crabLoot, mineQty, MINE,
  STILL, PLOT, CRAB, stillOutput, DAY_CAPS } from './config.js';
import { ISLAND_GOODS, islKey, islPrice } from '../../inventory/islandGoods.js';

const LS = 'pfp_isl_v1';
const FALLBACK = /closed|offline|bad action|unknown action|no identity|not found|unauthor|failed to fetch|network/i;
const PVP_ONLY = new Set(['isl_bounty_post', 'isl_bounty_claim', 'isl_duel_post', 'isl_duel_accept', 'isl_duel_settle', 'isl_bet']);
const rid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export { rid };

export function createMMApi({ pvp, game, updateHud, sfx } = {}) {
  let live = null;              // null = not asked yet, true = 053 answered, false = practice mode
  const st = load();
  function load() { let s = null; try { s = JSON.parse(localStorage.getItem(LS) || 'null'); } catch {} s ||= {};
    s.goods ||= {}; s.timers ||= {}; s.nodes ||= {}; s.day ||= dayKey(); s.prog ||= {}; s.claimed ||= {}; s.horde ||= 0; s.crates ||= 0; s.paid ||= {};
    if (s.day !== dayKey()) { s.day = dayKey(); s.prog = {}; s.claimed = {}; s.horde = 0; s.crates = 0; s.paid = {}; s.hordeRuns = 0; } return s; }
  function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch {} }
  const pv = () => { try { return pvp?.() || null; } catch { return null; } };
  const gold = () => game?.gold | 0;
  function rebase(r) { // the server moved gold: take its number (owner = his pot)
    if (!r || r.gold == null || !Number.isFinite(+r.gold)) return; const p = pv();
    if (p?.serverGold) { try { p.serverGold(+r.gold, { rev: r.rev ?? null, owner: !!r.owner }); } catch {} }
    else if (game) game.gold = Math.max(0, Math.floor(+r.gold));
    try { updateHud?.(); } catch {} if ((+r.delta || 0) > 0) sfx?.coin?.();
  }
  function localGold(d) { // practice: this save, like the casino practice table
    if (!game) return 0; game.gold = Math.max(0, Math.min(1e7, (game.gold | 0) + (d | 0))); const p = pv(); try { p?.save?.({ now: true, force: true }); } catch {}
    try { updateHud?.(); } catch {} if (d > 0) sfx?.coin?.(); return game.gold; }
  function takeGoods(r) { if (r?.goods && typeof r.goods === 'object') { const g = {}; for (const [k, v] of Object.entries(r.goods)) { const id = String(k).replace(/^isl:/, ''); if (ISLAND_GOODS[id] && (v | 0) > 0) g[id] = v | 0; } st.goods = g; save(); } }
  function takeTimers(r) { if (Array.isArray(r?.timers)) { const t = {}; for (const x of r.timers) { if (!x?.kind) continue; t[`${x.kind}:${x.slot}`] = { t0: Date.parse(x.started_at) || Date.now(), meta: x.meta || {}, server: true }; } st.timers = t; save(); } }

  async function server(action, body) {
    const p = pv(); if (!p?.inv?.call) return live === true ? { ok: false, error: 'offline' } : { ok: false, error: 'offline', fallback: true };
    if (/^isl_(bounty_post|duel_post|duel_accept|bet|timer_start)$/.test(action)) { try { await p.flushNow?.(); } catch {} } // sea gold reaches the server before a stake
    let r = null; try { r = await p.inv.call(action, body); } catch { r = null; }
    if (!r) return live === true ? { ok: false, error: 'offline' } : { ok: false, error: 'offline', fallback: true };
    if (r.ok) { live = true; rebase(r); takeGoods(r); return r; }
    if (FALLBACK.test(String(r.error || '')) || (r.status | 0) >= 500 || r.status === 404 || /^pvp isl_\w+ \d+$/.test(String(r.error || ''))) { if (live === true) return { ok: false, error: 'offline' }; live = false; return { ...r, fallback: true }; } // no 053 / no server: practice (never after the live server answered this session)
    live = true; if (r.gold != null) rebase({ gold: r.gold, owner: r.owner }); return r;
  }
  async function call(action, body = {}) {
    if (live !== false) { const r = await server(action, { ...body, reqId: body.reqId || rid(action.slice(4, 8)) }); if (!r.fallback) return r; }
    if (PVP_ONLY.has(action)) return { ok: false, error: 'live only', practice: true };
    return { ...local(action, body), practice: true };
  }
  // ---------------- practice mode (this device) ----------------
  const R = () => Math.random();
  const addGood = (id, n) => { st.goods[id] = (st.goods[id] | 0) + (n | 0); if (st.goods[id] <= 0) delete st.goods[id]; };
  function local(action, b) {
    const now = Date.now();
    switch (action) {
      case 'isl_contract': { const c = CONTRACT_BY_ID[b.contract]; if (!c) return { ok: false, error: 'bad contract' }; if (st.claimed[c.id]) return { ok: false, error: 'already claimed today' };
        if (!contractDone(c.id, st.prog)) return { ok: false, error: 'not done yet' }; st.claimed[c.id] = 1; save(); return { ok: true, delta: c.gold, gold: localGold(c.gold) }; }
      case 'isl_horde': { const w = b.wave | 0, key = `h:${b.run}:${w}`; if (st.paid[key]) return { ok: true, retry: true, gold: gold() };
        let pay = hordeWaveGold(w) + (w === 5 ? HORDE.champion : 0); pay = Math.max(0, Math.min(pay, DAY_CAPS.horde - st.horde)); st.paid[key] = 1; st.horde += pay; save();
        return pay ? { ok: true, delta: pay, gold: localGold(pay), wave: w } : { ok: false, error: 'daily cap reached' }; }
      case 'isl_crate': { const key = `c:${b.run}`; if (st.paid[key]) return { ok: true, retry: true, gold: gold() }; if (st.crates >= CRATE.perDay) return { ok: false, error: 'daily cap reached' };
        const pay = crateGold(b.tier); st.paid[key] = 1; st.crates++; save(); return { ok: true, delta: pay, gold: localGold(pay) }; }
      case 'isl_gather': { const k = `${b.src}:${b.spot}`, n = st.nodes[k] || { t0: 0, n: 0 }, regen = (b.src === 'mine' ? MINE.regenS : 600) * 1000, max = b.src === 'mine' ? MINE.charges : 1;
        if (now - n.t0 > regen) { n.t0 = now; n.n = 0; } if (n.n >= max) return { ok: false, error: 'depleted', left_s: Math.ceil((regen - (now - n.t0)) / 1000) };
        n.n++; st.nodes[k] = n; let items;
        if (b.src === 'dive') { const l = diveLoot(b.kind, R()); items = { [l.id]: l.qty }; }
        else { const K = MINE.kinds[b.kind] || MINE.kinds.iron; items = { [K.item]: mineQty(b.kind, R()) }; }
        for (const [id, q] of Object.entries(items)) addGood(id, q); save(); return { ok: true, items, left: max - n.n, goods: { ...st.goods } }; }
      case 'isl_timer_start': { const key = `${b.kind}:${b.slot}`; if (st.timers[key]) return { ok: false, error: 'busy' };
        if (b.kind === 'crab' && Object.keys(st.timers).filter(k => k.startsWith('crab:')).length >= CRAB.maxPots) return { ok: false, error: 'max pots' };
        let delta = 0, meta = {};
        if (b.kind === 'still') { if (b.homegrown) { if ((st.goods.island_cane | 0) < STILL.need.island_cane || (st.goods.island_spices | 0) < STILL.need.island_spices) return { ok: false, error: 'need cane + spices' };
            addGood('island_cane', -STILL.need.island_cane); addGood('island_spices', -STILL.need.island_spices); meta.out = stillOutput(true); }
          else { if (gold() < STILL.mashGold) return { ok: false, error: 'not enough gold' }; delta = -STILL.mashGold; localGold(delta); meta.out = stillOutput(false); } }
        st.timers[key] = { t0: now, meta }; save(); return { ok: true, delta, gold: gold(), started_at: new Date(now).toISOString(), meta, goods: { ...st.goods } }; }
      case 'isl_timer_finish': { const key = `${b.kind}:${b.slot}`, t = st.timers[key]; if (!t) return { ok: false, error: 'nothing there' };
        const need = (b.kind === 'crab' ? CRAB.fillS : b.kind === 'plot' ? PLOT.growS : STILL.brewS) * 1000; if (now - t.t0 < need) return { ok: false, error: 'not ready', left_s: Math.ceil((need - (now - t.t0)) / 1000) };
        let items = {}; if (b.kind === 'crab') items = crabLoot(R(), R()); else if (b.kind === 'plot') items = { ...PLOT.yield }; else items = { [t.meta?.out || stillOutput(false)]: STILL.bottles };
        for (const [id, q] of Object.entries(items)) addGood(id, q); delete st.timers[key]; save(); return { ok: true, items, goods: { ...st.goods } }; }
      case 'isl_sell': { const id = String(b.item || '').replace(/^isl:/, ''), q = b.qty | 0, p = islPrice(islKey(id), b.shop);
        if (!p) return { ok: false, error: 'shop does not buy that' }; if ((st.goods[id] | 0) < q || q < 1) return { ok: false, error: 'not enough' };
        addGood(id, -q); save(); const d = p * q; return { ok: true, delta: d, gold: localGold(d), goods: { ...st.goods } }; }
      case 'isl_state': return { ok: true, goods: { ...st.goods }, practice: true };
      case 'isl_board': return { ok: true, wanted: [], duels: [], claims: [], practice: true };
    }
    return { ok: false, error: 'live only' };
  }
  // contracts progress lives on this device (the server re-checks the claim once a day)
  function onKill(kind) { st.prog = contractProgress(st.prog, kind); save(); return st.prog; }
  return {
    call, local, onKill, save, st, rid,
    get live() { return live; }, set live(v) { live = v; },
    goods: () => ({ ...st.goods }), qty: (id) => st.goods[id] | 0, timers: () => st.timers, contracts: () => CONTRACTS.map(c => ({ ...c, prog: st.prog[c.id] | 0, claimed: !!st.claimed[c.id], done: contractDone(c.id, st.prog) })),
    async refresh() { const r = await call('isl_state', { since: 0 }); if (r?.ok && !r.practice) { takeGoods(r); takeTimers(r); if (Array.isArray(r.contracts)) for (const c of r.contracts) st.claimed[c] = 1; save(); } return r; },
    takeTimers, takeGoods,
  };
}
