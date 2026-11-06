// PUMPFUN PIRATES · [admin-menu] the owner Admin Menu's live flags (js/adminMenu.js sets them; the game reads them through one-line hooks).
// No imports, no DOM: walker / battle / pvp / main / dock read these. Every flag is false for every player unless js/adminMenu.js turns
// it on: noclip / god / invisible only after the SERVER said owner (admin_status), frozen only after the SERVER said so (admin_my_state).
//   noclip      fly through walls / terrain on foot, no rock collision on the ship   noclipMul  1 | 2.5 | 5 speed
//   god         no damage on foot (battle.js takeHit) or at sea (pvp.js localDamage + main.js damage)
//   invisible   stateMsg sends nothing (one 'bye' went out), AI ignores you; your own pirate / ship look ghostly on your screen only
//   frozen      the SERVER froze you (pvp_admin_controls): no walking, jumping, attacking, interacting, sailing, steering or firing
export const ADM = { noclip: false, noclipMul: 1, god: false, invisible: false, frozen: false, frozenUntil: 0, onPoke: null, frozenPeers: new Set() };
