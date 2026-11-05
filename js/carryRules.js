// [Raul carry] pure rules for the carried sword + back musket (no three.js: unit-tested in tests/carry.test.mjs)
// the hand WITHOUT the hook: a hook on the right (the default side) -> the LEFT hand, otherwise (no hook / hook on the left) the right hand
export const carryHand = (g) => (g?.hook && g.hook !== 'none' && g.hookSide !== 'L' ? 'L' : 'R');
// a carried id: one of ids, else 'none'; free = the shop's free default (not carried from the profile unless carryFree)
export const carryPick = (v, ids, free = null, carryFree = false) => (typeof v === 'string' && ids.includes(v) && (carryFree || v !== free) ? v : 'none');
// two wire digits (base 36): 1 + index (0 = none), and back
export const carryDigits = (g, swordIds, musketIds) => [swordIds.indexOf(g?.carrySword) + 1, musketIds.indexOf(g?.carryMusket) + 1];
export const carryFromDigits = (a, b, swordIds, musketIds) => ({ carrySword: a > 0 && a <= swordIds.length ? swordIds[a - 1] : 'none', carryMusket: b > 0 && b <= musketIds.length ? musketIds[b - 1] : 'none' });
// battle / swim visibility: on foot, not swimming (sword), not holding the arena's own copy
export const SWORD_AWAY = ['swim', 'tread', 'climb', 'hop'];
export const carryShows = ({ onFoot, state, armedSword, armedMusket }) => ({ sword: !!onFoot && !armedSword && !SWORD_AWAY.includes(state), musket: !!onFoot && !armedMusket });
// [Emerly musket-holster] BANKSY 11:00 AM Nov 5: "Make it so when using musket the sword gets holstered". While the musket is in your hands
// (armedMusket) the carried sword sits sheathed at the hip OPPOSITE its hand (cross-draw: right-hand sword -> left hip; a right-hook pirate's
// left-hand sword -> right hip) and goes back to that hand after. &holster=0 = the old look (sword stays in the hand).
export const holsterOn = (search = '') => !/[?&]holster=0(&|$)/.test(search || '');
export const holsterSide = (hand) => (hand === 'L' ? 'R' : 'L');
export const swordHolstered = ({ on = true, armedMusket } = {}) => !!on && !!armedMusket;
// [Emerly pitsword] BANKSY 12:05 PM Nov 5: "Also in sword pit why can't I use my rare sword". Inventory rare-equip
// (USE AS PRIMARY) owns the carried pick via setCarriedWeapons; the Sword Pit / Musket Range must draw THAT look (and peers see
// its ba index), not only the WEAPON STORE gear.sword / gear.musket. &pitsword=0 = old store-only behaviour.
export const pitSwordOn = (search = '') => !/[?&]pitsword=0(&|$)/.test(search || '');
export const pitWeaponId = (ids, def, carryId, storeId, on = true) => {
  if (on && typeof carryId === 'string' && carryId !== 'none' && ids.includes(carryId)) return carryId;
  if (typeof storeId === 'string' && ids.includes(storeId)) return storeId;
  return def;
};
// [crew-weapons] BANKSY 4:42 PM Nov 5: "Just make them all have what you have" (crew mirror the captain's sword + musket)
export const crewWeapOn = (search = typeof location !== 'undefined' ? location.search : '') => !/[?&]crewweap=0(&|$)/.test(search || '');
export function crewWeaponsOf(captain, on = crewWeapOn()) {
  const s = captain?.carrySword, m = captain?.carryMusket, has = (v) => typeof v === 'string' && v && v !== 'none';
  if (!on || !captain || (!has(s) && !has(m))) return {};
  const hand = carryHand(captain);
  return { carryCrew: 1, carrySword: has(s) ? s : 'none', carryMusket: has(m) ? m : 'none', carryHand: hand };
}
