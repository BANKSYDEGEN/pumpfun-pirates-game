// [Timothy] PvP UNLOCK skins (not kill tiers): PUMPFUN PIRATES Battle Royale. Cosmetic only, never a stat change.
//   bondingcurve  BONDING CURVE  unlock: 100 harbor AI kills    the plain default ship (the game's own player textures and
//                                                               standard black skull sails) flying the green pump.fun-style pill
//                                                               flag from js/ships.js makePillTexture() instead of the skull flag
//   commodore     COMMODORE      unlock: 100 harbor boss kills  THE COMMODORE's own look (Waves boss / v97 harbor boss): the boss
//                                                               build options straight from js/ships.js (SCHEMES.boss kit,
//                                                               boss: true rig, rug-pill flag from makePillTexture, flagScale 1.45,
//                                                               cloth sails with no skull main sail) on YOUR hull: the upgrade
//                                                               compiler keeps the player's hull length / v97 stretch / guns
// Unlock data lives in js/config.js PVP_UNLOCK_SKINS ({ id, name, locked: true, unlock: { type, count } }); the counters and
// progress bars are Emerly's. Nothing here unlocks anything.
//
// How COMMODORE reuses the boss: skin.shipOpts() returns buildShip() options that js/skins.js skinBuildOpts() hands to the
// upgrade compiler instead of a palette (same spread slot as palette skins, so len / beam / depth / stretch / hitLen /
// cannonsPerSide stay the player's). scheme 'boss' = the SAME cached boss kit (hull / cabin / iron / trim / sail
// materials) the real boss uses. Upgrade add-ons (bigger guns, armour, rigging) get boss-matching colours via `parts`, and
// the crew wear the boss crew's outfit via `crewOutfit` (js/ships.js SCHEME_OUTFIT.boss).
// Hitbox: nothing here touches len / beam / depth / traitBoxes (no materialFx / partsOverride at all).
import { SCHEMES, makePillTexture } from '../../../js/ships.js';

export const UNLOCK_IDS = ['bondingcurve', 'commodore'];

let _bossFlag = null; // the ONE green pump.fun-style pill flag texture (js/ships.js makePillTexture: green + white capsule), shared
export const BONDING_CURVE = {
  id: 'bondingcurve', name: 'BONDING CURVE', price: 0, premium: 'pvp', blurb: 'The plain PUMPFUN PIRATES ship under the green pump.fun pill flag.',
  locked: true, unlock: { type: 'harborAiKills', count: 100 },
  // plain default ship (scheme 'player', standard skull sails from the player build opts); only the flag changes
  shipOpts: () => ({ flagMap: _bossFlag || (_bossFlag = makePillTexture()) }),
  swatch: { hull: '#6a4026', band: '#161616', stripe: '#ffcd77', sail: '#1c1c1c', trim: '#ffcd77' }, // = CLASSIC
};

const B = SCHEMES.boss, hex = (c) => '#' + c.toString(16).padStart(6, '0');
export const COMMODORE = {
  id: 'commodore', name: 'COMMODORE', price: 0, premium: 'pvp', blurb: 'Sail THE COMMODORE\'s own ship.',
  locked: true, unlock: { type: 'harborBossKills', count: 100 },
  // buildShip() options of THE COMMODORE (js/main.js spawnEnemy, big = true), minus its size / guns (yours are kept)
  shipOpts: () => ({ scheme: 'boss', boss: true, mainSailMap: null, flagMap: _bossFlag || (_bossFlag = makePillTexture()), flagScale: 1.45 }),
  crewOutfit: 'midnight', // SCHEME_OUTFIT.boss
  parts: { oak: B.wood, plank: B.wood, iron: 0x1e2a24, gold: B.trim, glow: B.lantern }, // upgrade add-ons in the boss's colours
  swatch: { hull: hex(B.wood), band: hex(B.band), stripe: hex(B.stripe), sail: hex(B.sail), trim: hex(B.trim) },
};
export const UNLOCK_SKINS = [BONDING_CURVE, COMMODORE];
export default UNLOCK_SKINS;
