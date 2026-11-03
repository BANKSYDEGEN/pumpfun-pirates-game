// [Timothy] PUMPFUN PIRATES · CREW OUTFIT SPLIT (BANKSY via Emerly: "crew must NO LONGER copy the player's outfit").
// Your crew (deck crew, gunners, lookout, the crew that follows you ashore) wear THEIR OWN loadout, bought at the CREW SHOP.
// Stored additively in the save's gear object as two extra slots: gear.crewhat / gear.crewoutfit (js/pvpSave.js GEAR_SLOTS,
// server supabase/functions/pvp/lib.ts GEAR_SLOTS). Ownership = pvp_owned 'gear:crewhat:<id>' / 'gear:crewoutfit:<id>' (fits the
// existing item check: no migration). A save without them = the free CREW UNIFORM (bandana + tank in your ship skin's colours).
// Player gear and crew gear never mix: buying 'hat:tricorn' does not dress the crew, 'crewhat:tricorn' does not dress you.
// Other players: 'cr' (js/transport.js STATIC) = 2 base-36 digits (1 + index in CREW_SLOTS, 0 = uniform). Old builds don't send it:
// their crew show the uniform. CREW_SLOTS is APPEND-ONLY (the index goes over the network).
export const CREW_SLOTS = { crewhat: ['bandana', 'tricorn', 'bicorne', 'crown', 'crown_imperial', 'helmet_hq'], crewoutfit: ['tank', 'tshirt', 'coat', 'shirt', 'suit'] };
export const CREW_BASE = { crewhat: 'hat', crewoutfit: 'outfit' };          // the player gear slot each crew slot draws with
export const CREW_DEFAULT = { crewhat: 'bandana', crewoutfit: 'tank' };      // the free crew uniform (ids[0] of each slot)
export const CREW_LOOK = { skinColor: 3, hairColor: 2, body: 0 };            // the crew member shown in the Crew Shop previews
let cur = { ...CREW_DEFAULT };
export const cleanCrew = (g) => { const o = {}; for (const [s, ids] of Object.entries(CREW_SLOTS)) o[s] = ids.includes(g?.[s]) ? g[s] : ids[0]; return o; };
export const getCrewLoadout = () => ({ ...cur });
// what js/crewV4.js crewGearOf / js/pirateGear.js applyGear take (crew clothes follow the ship skin's colours, hat = its own colour)
export const crewGear = (l = cur) => { const c = cleanCrew(l); return { hat: c.crewhat, outfit: c.crewoutfit, hatColor: 0, outfitColor: 0 }; };
export function setCrewLoadout(g) {
  const n = cleanCrew(g); if (n.crewhat === cur.crewhat && n.crewoutfit === cur.crewoutfit) return cur;
  cur = n; try { dispatchEvent(new CustomEvent('pfp-crew', { detail: { ...n } })); } catch {} return cur;
}
export const crewToWire = (l = cur) => { const c = cleanCrew(l); return Object.keys(CREW_SLOTS).map((s) => CREW_SLOTS[s].indexOf(c[s]).toString(36)).join('').replace(/0+$/, ''); };
export function crewFromWire(w) {
  const o = { ...CREW_DEFAULT }; if (typeof w !== 'string' || w.length > 2 || !/^[0-9a-z]*$/.test(w)) return o;
  Object.keys(CREW_SLOTS).forEach((s, i) => { const v = i < w.length ? parseInt(w[i], 36) : 0; if (v > 0 && v < CREW_SLOTS[s].length) o[s] = CREW_SLOTS[s][v]; });
  return o;
}
try { if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) window.PFP_CREW = { getCrewLoadout, setCrewLoadout, crewGear, crewToWire, crewFromWire, CREW_SLOTS, CREW_DEFAULT }; } catch {}
