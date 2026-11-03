// PUMPFUN PIRATES · PvP kill-tier skins (cosmetic only: never a stat change).
// Tiers (kills needed) live in config.js PVP_SKIN_TIERS. The looks live in assets/ships/pvp/*.js (Raul, Timothy):
//   palette / sail / flag / parts           -> same painted-toon recipe as js/skins.js
//   materialFx(material) + partsOverride()  -> PvP-only material + shape changes (Raul's API, partsOverride.js);
//                                              gated by opts.pvp in the compiler, so solo ships never change
//   tick(mesh, { speed, alive, dt, t })     -> per-frame effects for local AND remote ships (see SHIP_TICKS)
import { registerSkin, getSkin, SKINS } from './skins.js';
import { PRESTIGE_GRANT_LV } from './prestige.js'; // [prestige] skins given free at a prestige level
import './skinLooks.js'; // golden / ghost / blood / midnight looks (shared with Waves)
import { PVP_SKIN_TIERS, PVP_UNLOCK_SKINS, UNLOCK_STAT } from './config.js';
import { ownerAllSkins } from './pvpSave.js'; // [v85] owner-only: BANKSYDEGEN's two devices have every skin
// SALTY PIRATES mobile-app skins (palette entries from BANKSYDEGEN/pumpfun-pirates-ios/-android, staged by Raul)
import { MOBILE_SKINS } from '../assets/ships/pvp/mobileSkins.js';
import { DIAMOND, diamondTick } from '../assets/ships/pvp/diamond.js';        // [Raul] 5000 kills
import { GOLDEN_PVP, goldenTick } from '../assets/ships/pvp/golden.js';       // [Raul] 1000 (v87)
import { GHOST_PVP, ghostTick } from '../assets/ships/pvp/ghost.js';          // [Raul] 1500 (v87)
import { KRAKEN_PVP, krakenTick } from '../assets/ships/pvp/kraken.js';       // [Raul] 600
import { FLAMING, flamingTick } from '../assets/ships/pvp/flaming.js';        // [Timothy] 2500
import { FLAMING_REDESIGN, flamingRedesignTick } from '../assets/ships/pvp/flamingRedesign.js'; // [Raul] Flaming redesign (BANKSY OK)
Object.assign(FLAMING, FLAMING_REDESIGN);
import { applyTierLooks, tierTick } from '../assets/ships/pvp/tierLooks.js';  // [Timothy] crimson, sea green, black pearl, coral, storm, admiral
import { UNLOCK_SKINS } from '../assets/ships/pvp/unlockSkins.js'; // [Timothy] COMMODORE (100 harbor boss kills)

getSkin('golden').partsOverride = GOLDEN_PVP.partsOverride;
getSkin('ghost').partsOverride = GHOST_PVP.partsOverride;
MOBILE_SKINS.find(s => s.id === 'kraken').partsOverride = KRAKEN_PVP.partsOverride;
for (const s of [...MOBILE_SKINS, FLAMING, DIAMOND, ...UNLOCK_SKINS]) registerSkin(s);
applyTierLooks([...SKINS, ...MOBILE_SKINS]);

// Per-ship tick contract: tick(mesh, { speed (world units/s), alive, dt, t }) runs every frame for every PvP ship
// (yours and other players'); each is a no-op unless mesh.userData.skinId matches its skin. A new skin file adds its tick here.
export const SHIP_TICKS = [diamondTick, goldenTick, ghostTick, krakenTick, flamingRedesignTick, tierTick];
export function shipTick(mesh, o) { for (const f of SHIP_TICKS) { try { f(mesh, o); } catch (e) { SHIP_TICKS.splice(SHIP_TICKS.indexOf(f), 1); console.warn('[pvp skins] tick failed', e); } } }

export const TIERS = PVP_SKIN_TIERS;
export const tierOf = (id) => TIERS.find(t => t.id === id) || null;
export const unlockedSkins = () => TIERS.filter(t => canUse(t.id)).map(t => t.id);
// [v98] stats (profile.stats) unlock the harbor skins: COMMODORE = stats.bossKills >= 100. Kill tiers still read `kills`.
// [v102] THE ISLAND SHOP: every skin is BOUGHT with gold (goals only make COMMODORE / FLAMING / DIAMOND buyable). Owned = the
// server's list (pvp_owned via js/pvpSave.js), set here by pvp.js; the owner (BANKSYDEGEN) has every skin.
let OWNED = new Set(['classic']);
export const setOwnedSkins = (list) => { OWNED = new Set(['classic', ...(Array.isArray(list) ? list : [])]); };
// [prestige] the GOLDEN GALLEON (P1) / DIAMOND SHIP (P2) are GIVEN on reaching that prestige: owned from then on (the server adds them to pvp_owned too)
const prestigeLv = () => Math.max(window.PFP_PRESTIGE?.level?.() | 0, window.PFP_PVP_SAVE?.prestigeLevel?.() | 0);
export const prestigeGranted = (id) => { const lv = PRESTIGE_GRANT_LV[id]; return !!lv && prestigeLv() >= lv; };
export const canUse = (id) => ownerAllSkins() || id === 'classic' || OWNED.has(id) || prestigeGranted(id);
// [Timothy] harbor-kill unlock skins: data only here (locked: true + unlock { type, count }); renderable by id, but canUse() /
// unlockedSkins() stay kill-tier only until the harbor counters are wired (Emerly)
export const UNLOCKS = PVP_UNLOCK_SKINS;
export const unlockOf = (id) => UNLOCKS.find(u => u.id === id) || null;
export const pvpSkin = (id) => getSkin(tierOf(id) || unlockOf(id) ? id : 'classic');
export const knownSkin = (id) => !!(tierOf(id) || unlockOf(id)); // remote ships: any kill-tier OR unlock skin id renders as itself
export const skinName = (id) => (tierOf(id) || unlockOf(id))?.name || 'CLASSIC';
// [v98] progress toward an unlock skin: { have, need, stat } (null for kill-tier skins)
export function unlockProgress(id, stats) { const u = unlockOf(id), k = u && UNLOCK_STAT[u.unlock?.type]; if (!k) return null; return { have: Math.max(0, Math.floor(stats?.[k] || 0)), need: u.unlock.count, stat: k }; }
// [v98] for the later shared PvE harbor: COMMODORE captains can sail with the AI / boss side
export const isBossSkin = (id) => id === 'commodore';
export const nextTier = () => null; // [v102] no kill-tier unlocks any more (the island shop sells them)
