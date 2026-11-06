// [backpack-pvp] pure stance + open-island hit rules for js/onfoot/battle.js (no three.js: unit-tested in node).
import { canFightOnFoot, SAFEZONES_ON } from '../island/safeZones.js';
// BANKSY t1710u "make it so they pull weapon or can switch between unarmed, sword or gun": 3 on-foot stances ANYWHERE
// on the island (0 UNARMED default, 1 SWORD, 2 GUN; keys 1 / 2 / 3, X = holster toggle, the #bt-stance bar). ba[0] = the held stance
// (sent whenever you are on foot). Open-island hits: any on-foot pirate whatever they hold, never into / out of a Safe Zone; KO on the
// open island = haul drops + respawn in the Harbor Plaza Safe Zone; Coliseum SWORD PIT / MUSKET RANGE auto-pick sword / gun (pit = swords
// only), KOs there stay just-for-fun (no haul drop, respawn at the gate). &stances=0 = the old pit / range-only weapons.
export const STANCES_ON = typeof location === 'undefined' || !/[?&]stances=0(&|$)/.test(location.search || '');
export const STANCE = Object.freeze({ unarmed: 0, sword: 1, gun: 2 });
export const STANCE_LABEL = Object.freeze(['🤚 UNARMED', '⚔️ SWORD', '🔫 GUN']);
export const stanceForKey = (code) => (code === 'Digit1' || code === 'Numpad1' ? 0 : code === 'Digit2' || code === 'Numpad2' ? 1 : code === 'Digit3' || code === 'Numpad3' ? 2 : null);
/** next stance for a tap on pill s (tapping the drawn weapon again holsters it) / for X (holster toggle) */
export const stanceTap = (cur, s) => (s && s === cur ? 0 : s);
export const holsterToggle = (cur, last) => (cur ? 0 : last === 2 ? 2 : 1);
/** a peer's weapon reach for the hits they send you (m) */
export const peerReach = (held) => (held === 1 ? 6.0 : held === 2 ? 70 : 0);
/** open-island hit rule, FOOT coords: both ends outside every Safe Zone (attacker: + exit grace / cottage); the Coliseum always fights */
export function openHitOk(attacker, victim, { state = {}, now = 0, inHouse = false } = {}) {
  if (!SAFEZONES_ON) return !inHouse;
  return canFightOnFoot(state, attacker[0], attacker[1], now, { inHouse }) && canFightOnFoot({}, victim[0], victim[1], 0);
}

/** BANKSY t1711u "Make players take 5-6 shots to kill": hits to drop a full-HP pirate */
export const hitsToKill = (dmg, hp = 100) => Math.ceil(hp / Math.max(1, dmg));
