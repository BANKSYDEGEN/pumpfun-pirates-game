// [backpack-pvp] pure stance + open-island hit rules for js/onfoot/battle.js (no three.js: unit-tested in node).
import { canFightOnFoot, SAFEZONES_ON } from '../island/safeZones.js';
// BANKSY t1710u / t1731u: 3 on-foot stances ANYWHERE on the island
//   0 UNARMED (default) · 1 SWORD · 2 GUN
//   Tab / the compact #bt-stance switch above 💬 cycles Unarmed → Musket → Sword → Unarmed
//   keys 1 / 2 / 3 still jump straight to a stance; X = holster toggle
//   Safe Zone auto-holsters to Unarmed (arena pads exempt)
export const STANCES_ON = typeof location === 'undefined' || !/[?&]stances=0(&|$)/.test(location.search || '');
export const STANCE = Object.freeze({ unarmed: 0, sword: 1, gun: 2 });
export const STANCE_LABEL = Object.freeze(['🤚 UNARMED', '⚔️ SWORD', '🔫 GUN']);
export const STANCE_ICON = Object.freeze(['🤚', '⚔️', '🔫']);
/** Digit1=Unarmed, Digit2=Sword, Digit3=Musket */
export const stanceForKey = (code) => (code === 'Digit1' || code === 'Numpad1' ? 0 : code === 'Digit2' || code === 'Numpad2' ? 1 : code === 'Digit3' || code === 'Numpad3' ? 2 : null);
/** next stance for a tap on pill s (tapping the drawn weapon again holsters it) / for X (holster toggle) */
export const stanceTap = (cur, s) => (s && s === cur ? 0 : s);
export const holsterToggle = (cur, last) => (cur ? 0 : last === 2 ? 2 : 1);
/** [t1731u] Tab / switch-button cycle: Unarmed(0) → Musket(2) → Sword(1) → Unarmed(0) */
export const nextStance = (cur) => (cur === 0 ? 2 : cur === 2 ? 1 : 0);
/** a peer's weapon reach for the hits they send you (m) */
export const peerReach = (held) => (held === 1 ? 6.0 : held === 2 ? 70 : 0);
/** open-island hit rule, FOOT coords: both ends outside every Safe Zone (attacker: + exit grace / cottage); sanctuary = no open-world PvP */
export function openHitOk(attacker, victim, { state = {}, now = 0, inHouse = false } = {}) {
  if (!SAFEZONES_ON) return !inHouse;
  return canFightOnFoot(state, attacker[0], attacker[1], now, { inHouse }) && canFightOnFoot({}, victim[0], victim[1], 0);
}

/** BANKSY t1711u "Make players take 5-6 shots to kill": hits to drop a full-HP pirate */
export const hitsToKill = (dmg, hp = 100) => Math.ceil(hp / Math.max(1, dmg));
// [t1724u] BANKSY "For PvP use same health bar, do the same if don't get hit for 20 seconds regain health": on-foot PvP heals like
// your ship (js/main.js PLAYER_REPAIR): 20 s without a hit -> +5% max HP right away, then +5% every 4 s, up to full. Any hit resets it.
export const FOOT_REGEN = Object.freeze({ wait: 20, every: 4, pct: 0.05 });
export function footRegenStep(st, dt, t, maxHp = 100, R = FOOT_REGEN) {
  const on = !(st.down > 0) && st.hp > 0 && st.hp < maxHp && t - (st.lastHitT ?? -1e9) >= R.wait;
  if (!on) { st.repT = 0; st.repairing = false; return st; }
  if (!st.repairing) { st.repairing = true; st.repT = R.every; } else st.repT = (st.repT || 0) + dt;
  while (st.repT >= R.every && st.hp < maxHp) { st.repT -= R.every; st.hp = Math.min(maxHp, st.hp + Math.round(maxHp * R.pct)); }
  return st;
}
