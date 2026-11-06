// [Raul weapon-sync] BANKSY via Emerly (pfp-v332 follow-up): other pirates see YOUR Legendary sword / musket ornamentation and the 3D musket
// attachments (scope / bayonet / stock / powder horn) in hand AND holstered, and your own holstered copies show them too.
// ONE compact int rides in your room state as 'wl' (js/onfoot/net.js netState; js/transport.js treats it as STATIC = re-sent only when it
// changes / every 3 s, ~8 bytes). Bits:
//   0-1  sword rarity   (0 common · 1 rare · 2 epic · 3 legendary = RANKS index)
//   2-3  musket rarity  (same codes)
//   4-7  fitted musket attachments: 1 scope · 2 bayonet · 4 stock · 8 horn   (musketUpgrades.js ACC_BIT)
//   8    GILDED musket skin (every upgrade tier bought)
// 0 = common / no attachments = what an older client (no 'wl'), a bot or anything malformed decodes to. Ids stay in 'ba' / 'gr' as before.
// Pure (no three.js): unit-tested in tests/weaponSync.test.mjs. &wsync=0 = kill switch (nothing sent, peers' 'wl' ignored, plain holsters).
import { RANKS, gunAccBits, muskGilded } from '../musketUpgrades.js';

export const WL_MAX = 511;
export const wsyncOn = (s = typeof location !== 'undefined' ? location.search : '') => !/[?&]wsync=0(&|$)/.test(s || '');
const rk = (r) => { const i = RANKS.indexOf(r); return i > 0 ? i : 0; };
const bit = (b) => (b ? 1 : 0);

/** {sword, musket: rarity names, acc: {scope, bayonet, stock, horn} truthy flags | accBits, gilded} -> 0..511 */
export function encodeWeaponLook({ sword = 'common', musket = 'common', acc = null, accBits = null, gilded = false } = {}) {
  const a = Number.isInteger(accBits) ? accBits & 15 : acc ? bit(acc.scope) | bit(acc.bayonet) << 1 | bit(acc.stock) << 2 | bit(acc.horn) << 3 : 0;
  return rk(sword) | rk(musket) << 2 | a << 4 | bit(gilded) << 8;
}

// decoded looks are cached + frozen: the per-frame dress compares ints and never allocates
const CACHE = new Map();
/** wire value (anything) -> frozen look; junk / missing -> the common look (v 0) */
export function decodeWeaponLook(v) {
  const n = Number.isInteger(v) && v >= 0 && v <= WL_MAX ? v : 0; let o = CACHE.get(n); if (o) return o;
  const sr = n & 3, mr = (n >> 2) & 3, accBits = (n >> 4) & 15;
  o = Object.freeze({ v: n, sr, mr, sword: RANKS[sr], musket: RANKS[mr], accBits, gilded: !!(n & 256),
    acc: Object.freeze({ ...(accBits & 1 ? { scope: 1 } : {}), ...(accBits & 2 ? { bayonet: 1 } : {}), ...(accBits & 4 ? { stock: 1 } : {}), ...(accBits & 8 ? { horn: 1 } : {}) }),
    sw: sr, mu: n >> 2 });   // sw / mu = the rebuild keys of the sword / musket dress (musket = rarity + attachments + gilded)
  CACHE.set(n, o); return o;
}
export const COMMON_LOOK = decodeWeaponLook(0);

/** YOUR look as the wire int (allocation-free: inventory rarity + the equipped musket's fitted attachments + the GILDED skin) */
export function localWireLook() {
  const W = typeof window !== 'undefined' ? window.PFP_WEAPON_RARITY : null;
  return rk(W?.sword) | rk(W?.musket) << 2 | gunAccBits() << 4 | (muskGilded() ? 256 : 0);
}
export const localWeaponLook = () => decodeWeaponLook(localWireLook());

/** where a pirate's look lives: obj.userData.wlook on its root (js/onfoot/net.js per peer, battle.js dress for you); carryWeapons.js reads it */
export function setObjLook(obj, look) { if (obj?.userData) obj.userData.wlook = look || COMMON_LOOK; return obj; }
export function objLook(o) { for (let n = 0; o && n < 12; n++, o = o.parent) if (o.userData?.wlook) return o.userData.wlook; return null; }
