// [Timothy] PUMPFUN PIRATES · CREW OUTFIT SPLIT (BANKSY via Emerly: "crew must NO LONGER copy the player's outfit").
// Your crew (deck crew, gunners, lookout, the crew that follows you ashore) wear THEIR OWN loadout, bought at the CREW SHOP.
// Stored additively in the save's gear object as two extra slots: gear.crewhat / gear.crewoutfit (js/pvpSave.js GEAR_SLOTS,
// server supabase/functions/pvp/lib.ts GEAR_SLOTS). Ownership = pvp_owned 'gear:crewhat:<id>' / 'gear:crewoutfit:<id>' (fits the
// existing item check: no migration). A save without them = the free CREW UNIFORM (bandana + tank in your ship skin's colours).
// Player gear and crew gear never mix: buying 'hat:tricorn' does not dress the crew, 'crewhat:tricorn' does not dress you.
// Other players: 'cr' (js/transport.js STATIC) = 2 base-36 digits (1 + index in CREW_SLOTS, 0 = uniform). Old builds don't send it:
// their crew show the uniform. CREW_SLOTS is APPEND-ONLY (the index goes over the network).
export const CREW_SLOTS = { crewhat: ['bandana', 'tricorn', 'bicorne', 'crown', 'crown_imperial', 'helmet_hq'], crewoutfit: ['tank', 'tshirt', 'coat', 'shirt', 'suit'],
  crewbeard: ['none', 'beard_moustache', 'beard_forked', 'beard_black'], crewface: ['none', 'facepaint_retardio'], crewcape: ['none', 'cape_tattered', 'cape_captain', 'cape_royal'], crewboots: ['none', 'boots_buckle', 'boots_cavalier', 'boots_gold', 'boots_classic', 'sandals', 'shoes_buckle', 'boots_sea'], crewpants: ['none', 'classic_pants', 'canvas_pants', 'sailor_trousers', 'leather_breeches'] };   // [v6-store-clothes] appended: the crew's own beard / face paint / cape / shoes / pants (ids[0] = none)
export const CREW_BASE = { crewhat: 'hat', crewoutfit: 'outfit', crewbeard: 'beard', crewface: 'face', crewcape: 'cape', crewboots: 'boots', crewpants: 'pants' };          // the player gear slot each crew slot draws with
export const CREW_DEFAULT = { crewhat: 'bandana', crewoutfit: 'tank', crewbeard: 'none', crewface: 'none', crewcape: 'none', crewboots: 'none', crewpants: 'none' };      // the free crew uniform (ids[0] of each slot)
export const CREW_LOOK = { skinColor: 3, hairColor: 2, body: 0 };            // the crew member shown in the Crew Shop previews
let cur = { ...CREW_DEFAULT };
// [Raul gear colours] crewhatColor: the crew's OWN free hat colour (0 = the hat's own, 1..12 = js/pirateGear.js HAT_SWATCHES), same pick as
// your hat colour (bandana / tricorn / bicorne / HQ helmet). Saved additively in gear.crewhatColor; other players get it as 'cc'.
export const HAT_COLOR_MAX = 12;
const cleanHc = (v) => { const h = Math.floor(+v); return Number.isFinite(h) && h >= 0 && h <= HAT_COLOR_MAX ? h : 0; };
export const CAPE_COLOR_MAX = 7;   // [v6-store-clothes] the crew's free cape colour (js/pirateGear.js CAPE_SWATCHES)
const cleanCape = (v) => { const h = Math.floor(+v); return Number.isFinite(h) && h >= 0 && h <= CAPE_COLOR_MAX ? h : 0; };
export const cleanCrew = (g) => { const o = {}; for (const [s, ids] of Object.entries(CREW_SLOTS)) o[s] = ids.includes(g?.[s]) ? g[s] : ids[0]; o.crewhatColor = cleanHc(g?.crewhatColor); o.crewcapeColor = cleanCape(g?.crewcapeColor); o.crewpantsColor = cleanCape(g?.crewpantsColor); o.crewbootsColor = cleanCape(g?.crewbootsColor); return o; };
export const getCrewLoadout = () => ({ ...cur });
// what js/crewV4.js crewGearOf / js/pirateGear.js applyGear take (crew clothes follow the ship skin's colours, hat = its own colour)
export const crewGear = (l = cur) => { const c = cleanCrew(l); return { hat: c.crewhat, outfit: c.crewoutfit, hatColor: c.crewhatColor, outfitColor: 0, beard: c.crewbeard, face: c.crewface, cape: c.crewcape, capeColor: c.crewcapeColor, pantsColor: c.crewpantsColor, bootsColor: c.crewbootsColor, boots: c.crewboots, pants: c.crewpants }; };   // [v6-store-clothes] + the crew's own extras (beard tints with the crew's hair)   // [Raul gear colours] + the crew's hat colour
export function setCrewLoadout(g) {
  const n = cleanCrew(g); if (Object.keys(CREW_SLOTS).every((k) => n[k] === cur[k]) && n.crewhatColor === (cur.crewhatColor | 0) && ['crewcapeColor', 'crewpantsColor', 'crewbootsColor'].every((k) => n[k] === (cur[k] | 0))) return cur;
  cur = n; try { dispatchEvent(new CustomEvent('pfp-crew', { detail: { ...n } })); } catch {} return cur;
}
export const crewToWire = (l = cur) => { const c = cleanCrew(l); return [...Object.keys(CREW_SLOTS).map((s) => CREW_SLOTS[s].indexOf(c[s])), c.crewcapeColor, c.crewpantsColor, c.crewbootsColor].map((n) => n.toString(36)).join('').replace(/0+$/, ''); };   // [v6-store-clothes] + the crew cape colour digit
export const crewColorToWire = (l = cur) => { const h = cleanCrew(l).crewhatColor; return h ? h.toString(36) : ''; };   // [Raul gear colours] 'cc'
export const crewColorFromWire = (w) => (typeof w === 'string' && /^[0-9a-c]$/.test(w) ? parseInt(w, 36) : 0);
export function crewFromWire(w) {
  const o = { ...CREW_DEFAULT }; if (typeof w !== 'string' || w.length > Object.keys(CREW_SLOTS).length + 3 || !/^[0-9a-z]*$/.test(w)) return o;
  Object.keys(CREW_SLOTS).forEach((s, i) => { const v = i < w.length ? parseInt(w[i], 36) : 0; if (v > 0 && v < CREW_SLOTS[s].length) o[s] = CREW_SLOTS[s][v]; });
  ['crewcapeColor', 'crewpantsColor', 'crewbootsColor'].forEach((k, j) => { const i = Object.keys(CREW_SLOTS).length + j, v = i < w.length ? parseInt(w[i], 36) : 0; if (v > 0 && v <= CAPE_COLOR_MAX) o[k] = v; });   // [v6-store-clothes] cape / pants / shoes colour digits
  return o;
}
try { if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) window.PFP_CREW = { getCrewLoadout, setCrewLoadout, crewGear, crewToWire, crewFromWire, crewColorToWire, crewColorFromWire, CREW_SLOTS, CREW_DEFAULT }; } catch {}
