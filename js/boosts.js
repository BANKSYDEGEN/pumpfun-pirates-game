// PUMPFUN PIRATES · [Emerly] ITEM SKILL BOOSTS (BANKSY, Nov 3: "start building that"; plan: Timothy's timothy-boosts/PLAN.md).
// Gear you OWN and WEAR gives a small % on one ship stat. Pay-to-win is OK (any gold buys them), so the caps carry the balance:
//   one stat per slot, a cap per stat, and a 30-point total cap on the combat stats. Applied AFTER the upgrade tiers (and the
//   Battle Royale pvpBoost), the existing clamps run last (reload >= 0.8 s, armor untouched).
// Where they count (BOOST_MODE): harbor 100% · Battle Royale 50% · Waves 100% · the SWORD PIT / MUSKET RANGE 0% (fair fights).
// The SERVER mirror is supabase/functions/pvp/lib.ts BOOSTS (same numbers; tests/boosts_test.mjs checks both tables match).
// The server applies gold find to the gold it pays itself (Waves payouts); ownership = the server's owned list (pvp_owned).
// Swords + muskets (emerly/battle-areas, WEAPON_PRICES) are keyed 'sword:<id>' / 'musket:<id>' here already: they start
// counting once those gear slots land, nothing here depends on that branch.
import { devHook } from './env.js';
import { ON_PORTAL } from './config.js';

// stat -> label, icon, cap (fraction), combat (counts toward the 30-point total), live (shown + applied; dig luck needs a migration)
export const BOOST_STATS = {
  reload:   { label: 'RELOAD',    icon: '⏱️', cap: 0.06, combat: true,  live: true, track: 'GUN CREW' },
  hp:       { label: 'HULL HP',   icon: '🪵', cap: 0.05, combat: true,  live: true, track: 'HULL PLANKS' },
  range:    { label: 'RANGE',     icon: '🔭', cap: 0.05, combat: true,  live: true, track: 'SPYGLASS' },
  dmg:      { label: 'DAMAGE',    icon: '💣', cap: 0.04, combat: true,  live: true, track: 'CANNONS' },
  turn:     { label: 'TURN',      icon: '☸️', cap: 0.04, combat: true,  live: true, track: 'RUDDER' },
  speed:    { label: 'SPEED',     icon: '⛵', cap: 0.05, combat: true,  live: true, track: 'SAILS' },
  regen:    { label: 'REPAIR',    icon: '🔧', cap: 0.08, combat: true,  live: true, track: 'HULL PLANKS' },
  goldFind: { label: 'GOLD FIND', icon: '🪙', cap: 0.10, combat: false, live: true },
  // [Raul items redo 2] BANKSY 11:29 AM "make pets be good boost on sells" (PROPOSED): more gold when the game SELLS for you = a chest item
  // you already own is paid out in gold (chest.ts CHEST_DUP_SHARE); the server applies it in map_dig (lib.ts sellGold)
  sell:     { label: 'SELL BONUS', icon: '💰', cap: 0.40, combat: false, live: true, hint: 'more gold for spare chest items' },
  digLuck:  { label: 'DIG LUCK',  icon: '⛏️', cap: 0.15, combat: false, live: false }, // needs pvp_map_dig p_luck (migration): not applied, not shown yet
  // [BANKSY 5:29 PM] swords + muskets boost their OWN hit rate, on foot, in the battle modes that use them (never the ship's cannons)
  swordHit:  { label: 'SWORD HIT',  icon: '⚔️', cap: 0.04, combat: false, foot: true, live: true },
  musketHit: { label: 'MUSKET HIT', icon: '🎯', cap: 0.05, combat: false, foot: true, live: true },
};
export const COMBAT_CAP = 0.30;
// ONE FLAG (open question for BANKSY): do weapon hit-rate boosts count inside the SWORD PIT / MUSKET RANGE? false = off (fair fights)
export const ARENA_WEAPON_BOOSTS = false;
export const BOOST_MODE = { harbor: 1, br: 0.5, waves: 1, pit: 0 };
// key = 'slot:id' (the pvp_owned 'gear:' key without the prefix). Free defaults (none / shirtless / plain / crew uniform) give nothing.
export const BOOSTS = {
  // hat = captain's command: reload
  'hat:bandana': { reload: 0.01 }, 'hat:tricorn': { reload: 0.02 }, 'hat:helmet_hq': { reload: 0.03 }, 'hat:bicorne': { reload: 0.04 },
  'hat:crown': { reload: 0.05 }, 'hat:crown_imperial': { reload: 0.06 },
  // outfit = toughness: hull HP
  'outfit:tank': { hp: 0.01 }, 'outfit:tshirt': { hp: 0.02 }, 'outfit:shirt': { hp: 0.02 }, 'outfit:coat': { hp: 0.03 }, 'outfit:suit': { hp: 0.05 },
  // eyes = aim: cannon range
  'eyes:eyepatch': { range: 0.02 }, 'eyes:sunglasses': { range: 0.03 }, 'eyes:laser': { range: 0.05 },
  // hook = hits harder: cannon damage
  'hook:hook_iron': { dmg: 0.02 }, 'hook:hook_gold': { dmg: 0.04 },
  // peg leg = pivot: turn rate
  'leg:peg': { turn: 0.04 },
  // face paint = morale: ship speed
  'face:facepaint_retardio': { speed: 0.02 },
  // crew hats = the crew work the sails: ship speed (shares the 5% speed cap with face paint)
  'crewhat:tricorn': { speed: 0.01 }, 'crewhat:helmet_hq': { speed: 0.015 }, 'crewhat:bicorne': { speed: 0.02 }, 'crewhat:crown': { speed: 0.03 }, 'crewhat:crown_imperial': { speed: 0.035 },
  // crew clothes = hull repair
  'crewoutfit:tshirt': { regen: 0.03 }, 'crewoutfit:shirt': { regen: 0.03 }, 'crewoutfit:coat': { regen: 0.05 }, 'crewoutfit:suit': { regen: 0.08 },
  // pets (parrots) = economy: gold find, + dig luck from RARE up (dig luck not live yet)
  'parrot:parrot_green': { goldFind: 0.02 }, 'parrot:parrot_red': { goldFind: 0.03 }, 'parrot:parrot_blue': { goldFind: 0.04 },
  'parrot:parrot_cockatoo': { goldFind: 0.05, digLuck: 0.05 }, 'parrot:parrot_black': { goldFind: 0.06, digLuck: 0.08 },
  'parrot:parrot_gold': { goldFind: 0.08, digLuck: 0.12 }, 'parrot:parrot_diamond': { goldFind: 0.10, digLuck: 0.15 },
  // [shop-boosts] BANKSY 10:00 AM "give skill boosts to the new items": Raul's shop items 2 + special pegs, scaled by price within each slot.
  // beard = repair · earrings = range · gold teeth + pets = gold find · boots = speed · cape = hull HP · ship flag = reload · figurehead = damage · special pegs = turn + speed
  'beard:beard_moustache': { regen: 0.01 }, 'beard:beard_forked': { regen: 0.02 }, 'beard:beard_black': { regen: 0.03 },
  'ears:earring_hoop': { range: 0.01 }, 'ears:earring_double': { range: 0.015 }, 'ears:earring_skull': { range: 0.02 },
  'teeth:tooth_gold': { goldFind: 0.01 }, 'teeth:grill_gold': { goldFind: 0.02 }, 'teeth:grill_diamond': { goldFind: 0.03 },
  'boots:boots_buckle': { speed: 0.01 }, 'boots:boots_cavalier': { speed: 0.015 }, 'boots:boots_gold': { speed: 0.02 },
  // [V6 store] Clothing Store shoes = speed, pants = hull HP (existing stats), scaled by price, all under the cheapest existing boots / cape
  'boots:sandals': { speed: 0.003 }, 'boots:boots_classic': { speed: 0.004 }, 'boots:shoes_buckle': { speed: 0.006 }, 'boots:boots_sea': { speed: 0.008 },
  'pants:classic_pants': { hp: 0.004 }, 'pants:canvas_pants': { hp: 0.006 }, 'pants:sailor_trousers': { hp: 0.008 }, 'pants:leather_breeches': { hp: 0.01 },
  'cape:cape_tattered': { hp: 0.01 }, 'cape:cape_captain': { hp: 0.02 }, 'cape:cape_royal': { hp: 0.04 },
  // [Raul items redo 2] BANKSY 11:29 AM "make pets be good boost on sells" (PROPOSED): every ground pet = its own SELL BONUS, up the price
  // ladder (white gorilla biggest); the three pets already sold keep the gold find they shipped with (owners lose nothing). Parrots unchanged.
  'parrot:pet_cat': { sell: 0.10, goldFind: 0.025 }, 'parrot:pet_monkey': { sell: 0.15, goldFind: 0.03 }, 'parrot:pet_chimp': { sell: 0.20 },
  'parrot:pet_cat_black': { sell: 0.25, goldFind: 0.035 }, 'parrot:pet_gorilla': { sell: 0.30 }, 'parrot:pet_tiger': { sell: 0.35 }, 'parrot:pet_gorilla_white': { sell: 0.40 },
  'flag:flag_cutlass': { reload: 0.01 }, 'flag:flag_red': { reload: 0.02 }, 'flag:flag_gold': { reload: 0.03 },
  'figure:fig_mermaid': { dmg: 0.02 }, 'figure:fig_kraken': { dmg: 0.03 }, 'figure:fig_lion': { dmg: 0.04 },
  'leg:peg_gold': { turn: 0.04, speed: 0.01 }, 'leg:peg_kraken': { turn: 0.04, speed: 0.015 }, 'leg:peg_ghost': { turn: 0.04, speed: 0.02 },
  // [BANKSY 5:29 PM "swords and muskets have own hit rate when used in other battle modes"] sword -> SWORD HIT, musket -> MUSKET HIT
  // (on foot only, never ship stats). Ids = js/shopCatalog.js WEAPON_PRICES on emerly/battle-areas (rusty = free, no boost).
  'sword:cutlass': { swordHit: 0.01 }, 'sword:rapier': { swordHit: 0.015 }, 'sword:bone': { swordHit: 0.02 }, 'sword:sabre_gilded': { swordHit: 0.03 }, 'sword:blade_gold': { swordHit: 0.04 },
  'musket:navy': { musketHit: 0.01 }, 'musket:blunder': { musketHit: 0.02 }, 'musket:dragoon': { musketHit: 0.03 }, 'musket:bone': { musketHit: 0.04 }, 'musket:blunder_gold': { musketHit: 0.05 },
};
const r4 = (v) => Math.round(v * 10000) / 10000;
export const boostOf = (slot, id) => BOOSTS[`${slot}:${id}`] || null;
// equipped gear ∩ owned (owner = owns everything, still CAPPED) -> { reload, hp, ..., goldFind, digLuck, combat, raw, capped }
export function boostsFor(gear, owned, owner = false) {
  const has = owned instanceof Set ? owned : new Set(Array.isArray(owned) ? owned : []);
  const raw = {}; for (const k of Object.keys(BOOST_STATS)) raw[k] = 0;
  for (const [slot, id] of Object.entries(gear || {})) {
    if (typeof id !== 'string') continue; const b = boostOf(slot, id); if (!b) continue;
    if (!owner && !has.has(`${slot}:${id}`)) continue; // not yours: no boost (the server strips it too: fitEquipped)
    for (const [k, v] of Object.entries(b)) raw[k] += v;
  }
  const out = {}, capped = [];
  for (const [k, S] of Object.entries(BOOST_STATS)) { out[k] = Math.min(raw[k], S.cap); if (raw[k] > S.cap + 1e-9) capped.push(k); }
  let combat = 0; for (const [k, S] of Object.entries(BOOST_STATS)) if (S.combat) combat += out[k];
  if (combat > COMBAT_CAP + 1e-9) { const f = COMBAT_CAP / combat; for (const [k, S] of Object.entries(BOOST_STATS)) if (S.combat) out[k] *= f; combat = COMBAT_CAP; capped.push('combat'); }
  for (const k of Object.keys(out)) out[k] = r4(out[k]);
  return { ...out, combat: r4(combat), raw, capped };
}
// scale the combat stats by the mode factor (economy stays full where it pays)
export function scaleBoosts(b, f) { const o = { ...b }; for (const [k, S] of Object.entries(BOOST_STATS)) if (S.combat) o[k] = r4((b[k] || 0) * f); o.combat = r4((b.combat || 0) * f); o.factor = f; return o; }
// on the stats object from upgrades.js shipStats / modeStats (mutates + returns it). Clamps: reload >= 0.8 s (never slower than unboosted).
export function applyBoosts(s, b) {
  if (!b) return s; const r3 = (v) => Math.round(v * 1000) / 1000;
  if (b.reload) s.reload = Math.min(s.reload, Math.max(0.8, r3(s.reload / (1 + b.reload))));
  if (b.hp) s.maxHp = Math.round(s.maxHp * (1 + b.hp));
  if (b.range) s.range = Math.round(s.range * (1 + b.range));
  if (b.dmg) s.gunDmg = r3((s.gunDmg ?? 1) * (1 + b.dmg));
  if (b.turn) s.turn = r3(s.turn * (1 + b.turn));
  if (b.speed) s.speed = r3(s.speed * (1 + b.speed));
  if (b.regen && s.regenPct != null) s.regenPct = r3(s.regenPct * (1 + b.regen));
  return s;
}
// the biggest boost any ship can have (remote sanity caps in js/pvp.js: a boosted peer must never look like a cheater)
export const MAX_BOOST = Object.fromEntries(Object.entries(BOOST_STATS).map(([k, S]) => [k, S.cap]));

// ---------- display ----------
const pct = (v) => { const p = Math.round(v * 1000) / 10; return `${p % 1 ? p.toFixed(1) : p}%`; };
export const fmtPct = pct;
export function boostChips(b, opts = {}) { // [{ k, icon, label, text }] for one item's boost (or a total)
  if (!b) return [];
  return Object.entries(BOOST_STATS).filter(([k, S]) => S.live && (b[k] || 0) > 0).map(([k, S]) => ({ k, icon: S.icon, label: S.label, text: `+${pct(b[k])} ${S.label}` }));
}
export const boostChipHtml = (b, esc = String) => boostChips(b).map(c => `<i class="bst bst-${c.k}" title="${esc(c.text)}">${c.icon} ${esc(c.text)}</i>`).join('');

// game-unit preview for the shop detail pane ('2.20 s → 2.07 s'): js/shop.js registers how to build YOUR ship's stats right now
let statsFn = null; export const setStatsSource = (fn) => { statsFn = typeof fn === 'function' ? fn : null; };
const UNIT = { reload: (s) => `${s.reload.toFixed(2)} s`, hp: (s) => `${s.maxHp} HP`, range: (s) => `${s.range} m`, dmg: (s) => `${Math.round((s.cannons || 4) * 17 * (s.gunDmg ?? 1))} dmg`,
  turn: (s) => `${Math.round(s.turn * 100)}%`, speed: (s) => `${Math.round(s.speed * 100)}%`, regen: (s) => `${(s.regenPct * 100).toFixed(1)}% / 4 s` };
export function statPreview(k, after, now = null) {
  if (!statsFn || !UNIT[k]) return null;
  try { const f = activeBoosts('pvp').factor ?? 1, cur = now ?? (currentBoosts()[k] || 0);
    const a = statsFn({ [k]: cur * f }), b = statsFn({ [k]: after * f }); const from = UNIT[k](a), to = UNIT[k](b);
    return from === to ? null : { from, to }; } catch { return null; }
}
// ---------- live state (js/pvp.js feeds it from the server-validated profile + the server's owned list) ----------
const src = { gear: null, owned: [], owner: false, server: null }; let zone = 'harbor', fair = false;
const emit = () => { try { dispatchEvent(new CustomEvent('pfp-boosts', { detail: { boosts: currentBoosts(), zone: boostZone() } })); } catch {} };
export function setBoostSource(p = {}) {
  if (p.gear && typeof p.gear === 'object') src.gear = { ...p.gear };
  if (Array.isArray(p.owned)) src.owned = p.owned.slice();
  if (typeof p.owner === 'boolean') src.owner = p.owner;
  if ('server' in p) src.server = p.server || null;
  emit();
}
// 'harbor' | 'br' (js/pvp.js where) · setFairFight(true) = the SWORD PIT / MUSKET RANGE (emerly/battle-areas calls it on enter / leave)
export function setBoostZone(z) { if (!(z in BOOST_MODE) || z === zone) return; zone = z; emit(); }
export function setFairFight(on) { on = !!on; if (on === fair) return; fair = on; emit(); }
export const boostZone = () => fair ? 'pit' : zone;
export const currentBoosts = () => boostsFor(src.gear, src.owned, src.owner); // full (100%) boosts of what you wear
// gameMode = game.mode ('pvp' = harbor / BR, else Waves). What the ship actually gets right now.
export function activeBoosts(gameMode) { const z = gameMode === 'pvp' ? boostZone() : 'waves'; return scaleBoosts(currentBoosts(), BOOST_MODE[z] ?? 0); }
// gold find on gold the CLIENT banks (BR / harbor piles, victory gold); the server pays its own (Waves) itself
// on-foot weapon hit rate: kind 'sword' | 'musket'; arena = the SWORD PIT / MUSKET RANGE (off unless ARENA_WEAPON_BOOSTS).
// emerly/battle-areas multiplies its hit chance (or hit window) by (1 + weaponHitBonus(kind, { arena })). Ship modes never read it.
export function weaponHitBonus(kind, { arena = fair } = {}) {
  if (arena && !ARENA_WEAPON_BOOSTS) return 0;
  const k = kind === 'sword' ? 'swordHit' : kind === 'musket' ? 'musketHit' : null; return k ? (currentBoosts()[k] || 0) : 0;
}
export const goldFindBonus = (earned) => earned > 0 ? Math.round(earned * (currentBoosts().goldFind || 0)) : 0;
// ---------- PROFILE: a SKILL BOOSTS section (total n / 30, a bar per stat with its cap, what counts where) ----------
const escH = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function profileBoostsHtml(gameMode = window.PFP?.game?.mode) {
  const b = currentBoosts(), z = gameMode === 'pvp' ? boostZone() : 'waves', f = BOOST_MODE[z] ?? 0;
  const zl = { harbor: 'HARBOR 100%', br: 'BATTLE ROYALE 50%', waves: 'WAVES 100%', pit: 'SWORD PIT / MUSKET RANGE: OFF' }[z];
  const rows = Object.entries(BOOST_STATS).filter(([, S]) => S.live).map(([k, S]) => { const v = b[k] || 0, cap = b.capped.includes(k);
    return `<span>${S.icon} ${S.label}</span><span class="pfb-bar${S.combat ? '' : ' gold'}" title="cap ${fmtPct(S.cap)}"><i style="width:${Math.min(100, v / S.cap * 100)}%"></i></span><b class="pfb-v${cap ? ' capped' : ''}">+${fmtPct(v)}<small> / ${fmtPct(S.cap)}</small></b>`; }).join('');
  return `<h4>SKILL BOOSTS <span>${Math.round(b.combat * 100)} / ${Math.round(COMBAT_CAP * 100)}</span> <em>from the gear you wear</em></h4>
    <div class="pfb-rows">${rows}</div>
    <p class="pf-note">Now: <b>${zl}</b>${f > 0 && f < 1 ? ` (combat boosts ×${f})` : ''} · Battle Royale 50% · SWORD PIT + MUSKET RANGE off · gold find counts wherever gold pays · sword / musket hit rate: on foot in battle modes${ARENA_WEAPON_BOOSTS ? '' : ' (off in the arenas for now)'}.</p>`;
}
let pfOn = false;
try { if (!ON_PORTAL) addEventListener('pfp-profile', (e) => {
  const card = document.querySelector('#profile .pf-card'); if (!card) return; pfOn = !!e.detail?.open; if (!pfOn) return;
  if (!document.querySelector('link[href$="islandShop.css"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('../css/islandShop.css', import.meta.url).href; document.head.appendChild(l); }
  let sec = document.getElementById('pf-boosts');
  if (!sec) { sec = document.createElement('section'); sec.id = 'pf-boosts'; sec.className = 'pf-sec'; (document.getElementById('pf-goals') || document.getElementById('pf-acct') || card.lastElementChild)?.before(sec); }
  sec.innerHTML = profileBoostsHtml();
}); if (!ON_PORTAL) addEventListener('pfp-boosts', () => { const sec = pfOn && document.getElementById('pf-boosts'); if (sec) sec.innerHTML = profileBoostsHtml(); }); } catch {}
devHook('PFP_BOOSTS', { profileBoostsHtml, BOOSTS, BOOST_STATS, BOOST_MODE, COMBAT_CAP, boostsFor, applyBoosts, scaleBoosts, currentBoosts, activeBoosts, setBoostSource, setBoostZone, setFairFight, boostZone, goldFindBonus, weaponHitBonus, ARENA_WEAPON_BOOSTS, src });
