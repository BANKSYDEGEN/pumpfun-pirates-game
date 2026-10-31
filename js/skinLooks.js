// PUMPFUN PIRATES · upgraded skin LOOKS for WAVES (solo) skins that also exist in Battle Royale.
// Raul's GOLDEN / GHOST parts and Timothy's tier looks for BLOOD (PvP "CRIMSON SAILS") and MIDNIGHT (PvP "BLACK PEARL")
// now dress the same skins in Waves. Looks only: unlocks stay separate (Waves = bought in the solo shop, 'pfp_skins_v1';
// Battle Royale = PvP lifetime kills only, js/pvpSkins.js), hitboxes are locked by runPartsOverride, CLASSIC is untouched.
import { getSkin, SKINS } from './skins.js';
import { GOLDEN_PVP, goldenTick } from '../assets/ships/pvp/golden.js';
import { GHOST_PVP, ghostTick } from '../assets/ships/pvp/ghost.js';
import { applyTierLooks, tierTick } from '../assets/ships/pvp/tierLooks.js';
import { MOBILE_SKINS } from '../assets/ships/pvp/mobileSkins.js';
import { DIAMOND, diamondTick } from '../assets/ships/pvp/diamond.js';
import { KRAKEN_PVP, krakenTick } from '../assets/ships/pvp/kraken.js';
import { FLAMING } from '../assets/ships/pvp/flaming.js';
import { FLAMING_REDESIGN, flamingRedesignTick } from '../assets/ships/pvp/flamingRedesign.js';

// [waves skins] the PvP-only ships join the WAVES unlock list (one more every 5 waves, after GOLDEN GALLEON at wave 35), same upgraded
// looks. Waves ownership stays in 'pfp_skins_v1' (bought / wave unlocks); Battle Royale ownership stays PvP kills only. Copies, so
// the Waves price never touches the PvP defs; pvpSkins.js finds these ids already registered and uses the same looks.
Object.assign(FLAMING, FLAMING_REDESIGN);
const mob = (id) => MOBILE_SKINS.find(s => s.id === id);
const WAVES_NEW = [[mob('seagreen'), 2000], [{ ...mob('kraken'), partsOverride: KRAKEN_PVP.partsOverride }, 2400], [mob('coral'), 2800], [mob('storm'), 3300],
  [{ ...mob('admiral'), blurb: 'White and gold flagship.' }, 3900], [FLAMING, 4600], [DIAMOND, 5500]];
for (const [def, price] of WAVES_NEW) if (def && !SKINS.some(s => s.id === def.id)) { const c = { ...def, price }; delete c.premium; SKINS.push(c); }

getSkin('golden').partsOverride = GOLDEN_PVP.partsOverride;
getSkin('ghost').partsOverride = GHOST_PVP.partsOverride;
applyTierLooks(SKINS);
export const WAVES_LOOKS = SKINS.filter(s => s.id !== 'classic' && (s.partsOverride || s.materialFx)).map(s => s.id);
for (const s of SKINS) if (WAVES_LOOKS.includes(s.id)) s.wavesLooks = true; // upgradeVisuals runs the parts override for these in Waves too

// per-frame hooks for the Waves player ship (no-ops unless mesh.userData.skinId matches)
const WAVES_TICKS = [goldenTick, ghostTick, tierTick, krakenTick, flamingRedesignTick, diamondTick];
export function wavesShipTick(mesh, o) { if (!mesh?.userData?.skinId || mesh.userData.skinId === 'classic') return; for (const f of WAVES_TICKS) { try { f(mesh, o); } catch (e) { WAVES_TICKS.splice(WAVES_TICKS.indexOf(f), 1); console.warn('[skin looks] tick failed', e); } } }
