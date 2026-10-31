// PUMPFUN PIRATES · upgraded skin LOOKS for WAVES (solo) skins that also exist in Battle Royale.
// Raul's GOLDEN / GHOST parts and Timothy's tier looks for BLOOD (PvP "CRIMSON SAILS") and MIDNIGHT (PvP "BLACK PEARL")
// now dress the same skins in Waves. Looks only: unlocks stay separate (Waves = bought in the solo shop, 'pfp_skins_v1';
// Battle Royale = PvP lifetime kills only, js/pvpSkins.js), hitboxes are locked by runPartsOverride, CLASSIC is untouched.
import { getSkin, SKINS } from './skins.js';
import { GOLDEN_PVP, goldenTick } from '../assets/ships/pvp/golden.js';
import { GHOST_PVP, ghostTick } from '../assets/ships/pvp/ghost.js';
import { applyTierLooks, tierTick } from '../assets/ships/pvp/tierLooks.js';

getSkin('golden').partsOverride = GOLDEN_PVP.partsOverride;
getSkin('ghost').partsOverride = GHOST_PVP.partsOverride;
applyTierLooks(SKINS);
export const WAVES_LOOKS = SKINS.filter(s => s.id !== 'classic' && (s.partsOverride || s.materialFx)).map(s => s.id);
for (const s of SKINS) if (WAVES_LOOKS.includes(s.id)) s.wavesLooks = true; // upgradeVisuals runs the parts override for these in Waves too

// per-frame hooks for the Waves player ship (no-ops unless mesh.userData.skinId matches)
const WAVES_TICKS = [goldenTick, ghostTick, tierTick];
export function wavesShipTick(mesh, o) { if (!mesh?.userData?.skinId || mesh.userData.skinId === 'classic') return; for (const f of WAVES_TICKS) { try { f(mesh, o); } catch (e) { WAVES_TICKS.splice(WAVES_TICKS.indexOf(f), 1); console.warn('[skin looks] tick failed', e); } } }
