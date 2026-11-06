// [v122] TREASURE MAPS in the harbor (server: supabase/migrations/026 + pvp maps_state / map_dig). Maps drop server-side from boss kills
// (common) and confirmed BR kills (rare; legendary = the cave). The matching dig site (or the cave) asks the server, which checks the
// spot + rate limits and credits the gold (pvp.js adds the same gold to your save in the same tick; logged-in devices send mirror: true).
// [v145] BANKSY: "make it more of a moment when they get a treasure map, also when they open it a treasure map needs to pop up with
// island map on it with the treasure hunt" (js/dock/treasureMap.js draws both):
//   - a NEW map = a big reveal (scroll unrolls with the chart + X, rays, sparkles, fanfare). It is QUEUED until it is calm: it only
//     plays in the harbor, in 'playing', with no menu / map open, and never mid-fight (index.js calm(): on foot, moored, inside SAFE
//     HARBOR, or 6 s with no hits taken / shots fired and no AI ship close). A boss sinking asks the server again 6 s later, so the
//     reveal lands right after the fight instead of on the next 90 s poll. Several drops in a row = one reveal ("3 NEW MAPS").
//   - MAPS = the full-screen parchment chart of the real island + harbor: dotted trail from you to the red X, chips to pick a map.
//   - the X is the REAL dig spot: v122's radar circle was centred 6-20 m off it on purpose (a fuzzy area seeded by the map id), and
//     the X painted on the sand sat 4.3 m off the mound (js/island/foot.js); both now sit on the spot the DIG prompt + server use.
import { createTreasureMap } from './treasureMap.js';
import { validIds } from '../island/digSpots.js'; // [island-rework] the shared dig-spot registry (server lists are generated from it)
import { createChestReveal, chestItemInfo } from './chestReveal.js'; // [v152] chest items (server-picked)
import { itemInfo } from '../inventory/catalog.js'; // [inventory]
import { padActive, padGlyph } from '../gamepad.js'; // [Emerly gamepad] the dig hint names the pad button
const TIER = { common: ['COMMON MAP', '#e8cf95'], rare: ['RARE MAP', '#7fd0ff'], legendary: ['LEGENDARY MAP', '#ffcd3c'] };
const RANK = { common: 0, rare: 1, legendary: 2 };
const WHY = {
  'too soon': 'THE INK IS STILL WET<br><small>a new map can be dug 30 s after it drops</small>',
  'slow down': 'CATCH YOUR BREATH<br><small>20 s between digs</small>',
  'daily dig limit': '25 DIGS TODAY<br><small>the sand is yours again tomorrow</small>',
  'wrong spot': 'NOTHING HERE<br><small>this map points somewhere else · tap INVENTORY</small>',
  'already dug': 'ALREADY DUG UP', 'not your map': 'THAT MAP IS GONE',
};
const SRC = { boss: 'from the Commodore', kill: 'from a battle kill', streak: 'from a 3-kill streak' };
const spotName = (s) => s === 'cave' ? 'TREASURE CAVE' : 'DIG SITE ' + String(s).replace(/\D/g, '');
const CSS = `
/* [v135] BANKSY "Fix the location of maps": the MAPS button sits IN the top-right HUD column, under the radar + harbor line (holder 2x badge), so it can never overlap them */
#tm-btn{position:static;white-space:nowrap;align-self:flex-start;margin-top:4px;pointer-events:auto;z-index:8;display:none;font:22px 'Just Another Hand',cursive;letter-spacing:.04em;padding:5px 12px 2px;border-radius:12px;border:2px solid #ffcd77;background:rgba(22,22,22,.86);color:#ffcd77;cursor:pointer}
#tm-btn b{color:#fff;margin-left:4px}
#tm-btn.new{animation:tmBtn 1s ease-in-out 4}
@keyframes tmBtn{50%{background:#7a4a10;box-shadow:0 0 14px #ffcd3c}}
/* [v340] BANKSY t1807u: INVENTORY sits directly under GOLD (#hud-gold) in the top-left HUD column */
#hud-tl #tm-btn{position:static;align-self:flex-start;margin:4px 0 0;flex:none}
@media (max-height:520px),(max-width:600px){#hud-tl #tm-btn{font-size:18px;padding:3px 10px 1px;border-radius:10px;border-width:1.5px}}
`;
export function createTreasure({ world, layout, toast, pvp, isOn, calm = () => true, getPos = () => null, sfx = null, low = false, inventory = () => null }) { // [inventory] inventory() = the INVENTORY grid (js/inventory/ui.js)
  const spots = new Map(world.footInteract.filter(q => q.kind === 'dig' || q.id === 'cave').map(q => [q.id, q]));
  // [island-rework] every id the server accepts must have its X here (tools/check_digspots.py checks the positions too)
  { const miss = validIds().filter(id => !spots.has(id)); if (miss.length) console.warn('[treasure] dig spots missing on this island:', miss.join(', ')); }
  let warnedNew = false;
  let maps = [], recent = [], sel = null, busy = false, lastAt = 0, wasOn = false, loading = false, pending = null;
  const toF = layout.harborToFoot;
  const tmap = createTreasureMap({ FM: layout.FM, toF, decks: layout.decks || [], spots: world.foot?.spots, low, sfx, layout });
  const chest = createChestReveal({ sfx, low, onWear: (key) => pvp()?.maps?.wear?.(key), canWear: (key) => !!pvp()?.maps?.canWear?.(key) }); // [v152] what the chest held
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const btn = document.createElement('button'); btn.id = 'tm-btn'; btn.type = 'button'; { const hg = document.getElementById('hud-gold'); if (hg?.parentNode) hg.after(btn); else (document.getElementById('hud-tr') || document.body).appendChild(btn); } // [v340] t1807u: under GOLD
  for (const ev of ['pointerdown', 'touchstart', 'mousedown']) btn.addEventListener(ev, (x) => x.stopPropagation(), { passive: true });
  btn.addEventListener('click', (e) => { e.stopPropagation(); const iv = inventory(); if (iv) { tmap.isOpen && close(); iv.isOpen ? iv.close() : iv.open('bag'); return; } tmap.isOpen ? close() : open(); }); // [inventory] BANKSY 11:02: the MAPS button is INVENTORY
  // the dig target = the spot itself (harbor coords, for the radar): r = the DIG prompt radius
  function target() { if (!sel) return null; const q = spots.get(sel.spot); if (!q) return null; return { x: q.x, z: q.z, r: q.r || 3 }; }
  const footOf = (q) => { const [x, z] = toF(q.x, q.z); return { x, z }; };
  function mapState() { // what the chart draws (foot frame)
    const p = getPos(), q = sel && spots.get(sel.spot), me = p ? { ...footOf(p), yaw: p.yaw, foot: !!p.foot } : null, t = q ? { ...footOf(q), id: sel.id } : null;
    const others = maps.filter(m => m !== sel && m.spot !== sel?.spot).map(m => spots.get(m.spot)).filter(Boolean).map(footOf);
    const d = p && q ? Math.round(Math.hypot(p.x - q.x, p.z - q.z)) : null;
    return { me, target: t, others, label: q ? `${spotName(sel.spot)}${d !== null ? ' · ' + d + ' m' : ''}` : null };
  }
  function renderUi() {
    const iv = inventory(); btn.innerHTML = iv ? `🎒 INVENTORY<b>${Math.max(iv.count, maps.length)}</b>` : `🗺 MAPS<b>${maps.length}</b>`;
    const chips = maps.length > 1 || !maps.length ? maps.map(m => { const [tn, tc] = TIER[m.tier] || TIER.common;
      return `<button type="button" class="tm-chip${sel && sel.id === m.id ? ' sel' : ''}" data-id="${m.id}"><span style="color:${tc}">✕ ${tn}</span><small>${spotName(m.spot)} · ${SRC[m.source] || 'found'}</small></button>`; }).join('') : '';
    const p = getPos(), rec = recent.length ? ` · last finds ${recent.slice(0, 3).map(r => `<b>+${(r.gold | 0).toLocaleString()}</b>${r.loot && r.loot.item && !r.loot.dup ? ` + ${chestItemInfo(r.loot.item, r.loot.crew).label}${r.loot.crew ? ' (crew)' : ''}` : ''}`).join(' ')}` : '';
    const hint = !sel ? 'NO MAPS YET · sink the COMMODORE + win battle kills' : (p && p.foot ? `follow the dotted trail to the red <b>X</b> · ${padActive() ? `press ${padGlyph('A')} ·` : 'ontouchstart' in window ? 'tap' : 'press E ·'} DIG on the spot` : 'moor at the harbor, go ashore + follow the trail to the red <b>X</b>') + rec;
    const one = maps.length === 1 ? `<span style="color:${(TIER[sel.tier] || TIER.common)[1]}">${(TIER[sel.tier] || TIER.common)[0]}</span> · ${spotName(sel.spot)} · ` : '';
    tmap.setUi(chips, one + hint);
  }
  function pick(id) { sel = maps.find(m => m.id === id) || sel; renderUi(); }
  const open = () => { renderUi(); tmap.open(mapState, pick); }, close = () => tmap.close();
  function queueReveal(fresh) { // fresh: the newly dropped maps (newest last)
    if (!fresh.length) return; const best = fresh.reduce((a, m) => (RANK[m.tier] | 0) > (RANK[a.tier] | 0) ? m : a, fresh[fresh.length - 1]);
    pending = pending ? { n: pending.n + fresh.length, best: (RANK[best.tier] | 0) >= (RANK[pending.best.tier] | 0) ? best : pending.best } : { n: fresh.length, best };
  }
  function playReveal() {
    const { n, best } = pending; pending = null; const m = maps.find(x => x.id === best.id) || maps[maps.length - 1]; if (!m) return; // dug / gone meanwhile
    sel = m; const [tn, tc] = TIER[m.tier] || TIER.common, q = spots.get(m.spot);
    btn.classList.remove('new'); void btn.offsetWidth; btn.classList.add('new'); renderUi();
    tmap.reveal({ title: n > 1 ? `${n} NEW TREASURE MAPS!` : 'TREASURE MAP!', tier: tn, color: tc, sub: `${spotName(m.spot)} · ${SRC[m.source] || 'found'} · tap to open`,
      target: q ? { ...footOf(q), id: m.id } : null, others: maps.filter(x => x !== m && x.spot !== m.spot).map(x => spots.get(x.spot)).filter(Boolean).map(footOf), onView: () => { sel = m; open(); } });
  }
  async function refresh() {
    const pv = pvp(); if (!pv?.maps || loading) return; loading = true;
    try { const r = await pv.maps.state(); if (!r || !r.ok) return;
      const had = new Set(maps.map(m => m.id));
      maps = (r.maps || []).filter(m => spots.has(m.spot)); recent = r.recent || [];
      if (!warnedNew && (r.maps || []).some(m => !spots.has(m.spot))) { warnedNew = true; toast('A MAP POINTS TO A NEW PART OF THE ISLAND<br><small>reload to update the game</small>', 3200); } // [island-rework] old cached client
      if (sel && !maps.some(m => m.id === sel.id)) sel = null; if (!sel && maps.length) sel = maps[0];
      if ((r.new | 0) > 0) { const fresh = maps.filter(m => !had.has(m.id)).slice(-(r.new | 0)); queueReveal(fresh.length ? fresh : maps.slice(-(r.new | 0))); }
      renderUi(); inventory()?.refresh?.().then?.(renderUi); } finally { loading = false; } }
  function tick() { const o = !!isOn(), now = performance.now();
    if (o && (!wasOn || now - lastAt > 90000)) { lastAt = now; refresh(); }
    wasOn = o; btn.style.display = o && (maps.length || inventory()) ? 'block' : 'none'; if (!o) { close(); tmap.dismiss(true); chest.hide(true); }
    if (pending && o && !tmap.isOpen && !tmap.revealing && calm()) playReveal(); }
  const soon = (ms = 6000) => { lastAt = Math.min(lastAt, performance.now() - 90000 + ms); }; // ask the server again in ~ms (after a boss sinks)
  const mapFor = (id) => (sel && sel.spot === id) ? sel : maps.find(m => m.spot === id);
  const label = (q) => mapFor(q.id) ? (q.id === 'cave' ? 'DIG FOR THE LEGENDARY CHEST' : 'DIG · TREASURE MAP') : null;
  async function dig(q, t) { // true = handled (else the caller falls back to its old prompt)
    const pv = pvp(); if (!pv?.maps) { if (q.kind === 'dig') world.activate(q, t); return true; }
    const m = mapFor(q.id);
    if (!m) { if (q.id === 'cave') return false;
      toast(maps.length ? 'NO MAP FOR THIS SITE<br><small>your map points somewhere else · tap INVENTORY</small>' : 'NO TREASURE MAP<br><small>maps drop from Commodore kills + battle kills</small>', 2400); return true; }
    if (busy) return true; busy = true; toast('DIGGING…', 1400);
    try { const r = await pv.maps.dig(m.id, q.id);
      if (r && r.ok) {
        if (q.kind === 'dig') { world.activate(q, t); q.used = true; setTimeout(() => world.rearm(q), 9000); }
        maps = maps.filter(x => x.id !== m.id); recent = [{ tier: r.tier, gold: r.gold }, ...recent]; if (sel && sel.id === m.id) sel = maps[0] || null;
        recent[0].loot = r.loot || null; renderUi();
        if (r.loot && r.loot.item) chest.show(r); // [v152] the chest held an item: its card (for you / your crew / already yours)
        else if (r.items && r.items.length) toast(`TREASURE!<br>${r.items.map(x => { const i = itemInfo(x.item); return i ? `${i.icon} ${i.name}${x.qty > 1 ? ' ×' + x.qty : ''}` : x.item; }).join(' · ')}<br><small>in your INVENTORY · sell at the TREASURE TRADER${r.holder ? ' · x2 HOLDER' : ''}</small>`, 3600); // [inventory] items, no chest gold
        else toast(`TREASURE! +${(r.gold | 0).toLocaleString()} GOLD<br><small>${(TIER[r.tier] || TIER.common)[0]}${r.holder ? ' · x2 HOLDER' : ''}</small>`, 3200);
        if (r.items && r.loot && r.loot.item) setTimeout(() => toast(`+ ${r.items.map(x => itemInfo(x.item)?.name || x.item).join(' · ')}<br><small>in your INVENTORY</small>`, 2600), 3400);
        inventory()?.refresh?.();
      } else { toast(WHY[r?.error] || 'THE DIG FAILED<br><small>check your connection and try again</small>', 2600); if (r?.error === 'already dug' || r?.error === 'not your map') refresh(); }
    } finally { busy = false; }
    return true; }
  btn.innerHTML = inventory() ? '🎒 INVENTORY<b>0</b>' : '🗺 MAPS<b>0</b>';
  const openMap = (id) => { pick(id); open(); }; // [inventory] OPEN MAP on a grid slot
  return { render: () => renderUi(), openMap, btn, spotIds: () => [...spots.keys()], spotAt: (id) => { const q = spots.get(id); return q ? { x: q.x, z: q.z, r: q.r } : null; }, tick, refresh, soon, dig, label, target, get maps() { return maps; }, get sel() { return sel; }, get pending() { return pending; }, get isOpen() { return tmap.isOpen; }, get revealing() { return tmap.revealing; }, open, close, map: tmap , chest };
}
