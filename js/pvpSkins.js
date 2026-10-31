// PUMPFUN PIRATES · PvP kill-tier skins (cosmetic only: never a stat change).
// Tiers (kills needed) live in config.js PVP_SKIN_TIERS. The looks live in assets/ships/pvp/*.js (Raul, Timothy):
//   palette / sail / flag / parts           -> same painted-toon recipe as js/skins.js
//   materialFx(material) + partsOverride()  -> PvP-only material + shape changes (Raul's API, partsOverride.js);
//                                              gated by opts.pvp in the compiler, so solo ships never change
//   tick(mesh, { speed, alive, dt, t })     -> per-frame effects for local AND remote ships (see SHIP_TICKS)
import { registerSkin, getSkin, SKINS } from './skins.js';
import './skinLooks.js'; // golden / ghost / blood / midnight looks (shared with Waves)
import { PVP_SKIN_TIERS } from './config.js';
// SALTY PIRATES mobile-app skins (palette entries from BANKSYDEGEN/pumpfun-pirates-ios/-android, staged by Raul)
import { MOBILE_SKINS } from '../assets/ships/pvp/mobileSkins.js';
import { DIAMOND, diamondTick } from '../assets/ships/pvp/diamond.js';        // [Raul] 5000 kills
import { GOLDEN_PVP, goldenTick } from '../assets/ships/pvp/golden.js';       // [Raul] 150
import { GHOST_PVP, ghostTick } from '../assets/ships/pvp/ghost.js';          // [Raul] 300
import { KRAKEN_PVP, krakenTick } from '../assets/ships/pvp/kraken.js';       // [Raul] 600
import { FLAMING, flamingTick } from '../assets/ships/pvp/flaming.js';        // [Timothy] 2500
import { applyTierLooks, tierTick } from '../assets/ships/pvp/tierLooks.js';  // [Timothy] crimson, sea green, black pearl, coral, storm, admiral

getSkin('golden').partsOverride = GOLDEN_PVP.partsOverride;
getSkin('ghost').partsOverride = GHOST_PVP.partsOverride;
MOBILE_SKINS.find(s => s.id === 'kraken').partsOverride = KRAKEN_PVP.partsOverride;
for (const s of [...MOBILE_SKINS, FLAMING, DIAMOND]) registerSkin(s);
applyTierLooks([...SKINS, ...MOBILE_SKINS]);

// Per-ship tick contract: tick(mesh, { speed (world units/s), alive, dt, t }) runs every frame for every PvP ship
// (yours and other players'); each is a no-op unless mesh.userData.skinId matches its skin. A new skin file adds its tick here.
export const SHIP_TICKS = [diamondTick, goldenTick, ghostTick, krakenTick, flamingTick, tierTick];
export function shipTick(mesh, o) { for (const f of SHIP_TICKS) { try { f(mesh, o); } catch (e) { SHIP_TICKS.splice(SHIP_TICKS.indexOf(f), 1); console.warn('[pvp skins] tick failed', e); } } }

export const TIERS = PVP_SKIN_TIERS;
export const tierOf = (id) => TIERS.find(t => t.id === id) || null;
export const unlockedSkins = (kills) => TIERS.filter(t => kills >= t.kills).map(t => t.id);
export const canUse = (id, kills) => { const t = tierOf(id); return !!t && kills >= t.kills; };
export const pvpSkin = (id) => getSkin(tierOf(id) ? id : 'classic');
export const nextTier = (kills) => TIERS.find(t => t.kills > kills) || null;
