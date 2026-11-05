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
