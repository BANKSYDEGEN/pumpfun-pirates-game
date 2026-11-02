// [Emerly v106] CREW WEARS THE CAPTAIN'S CLOTHES (BANKSY: "Make sure all the pirates on my ship wear same clothes I choose").
// syncCrewGear(ship, gear, colors): every crew pirate on that ship (deck crew, a gunner per gun, the lookout) gets the captain's
// HAT (+ hat colour) and OUTFIT, keeping their own body / skin / hair. Hooks, pegs, parrots and eyewear stay on the captain
// (no ship full of parrots). Baked once per gear + colours (js/crewV4.js crewGearV4), merged into the ship's crew mesh: still
// ONE draw call per ship. Your ship: your equipped gear (re-baked on every change, 'pfp-gear'). Other players' ships: their gear
// from the gear netcode (p.captain.gear). AI ships: never called, default outfits.
import { crewGearV4, crewGearOf } from './crewV4.js';
import { setCrewGear, crewGearTag } from './crew.js';

const pending = new WeakMap(), failed = new Map(); // [v109b] tag -> when it failed: retried after 15 s (a one-off load hiccup must not undress the crew for good)
export const crewGearKey = (gear, colors) => { const g = crewGearOf(gear); return g ? JSON.stringify([g, colors || null]) : ''; };
export function syncCrewGear(ship, gear, colors = null) {
  const body = ship?.userData?.body || ship; if (!body) return;
  const cur = crewGearTag(body); if (cur === null) return; // no crew mesh (yet)
  const tag = crewGearKey(gear, colors); if (cur === tag || performance.now() - (failed.get(tag) ?? -1e9) < 15000 || pending.get(body) === tag) return;
  if (!tag) { pending.delete(body); setCrewGear(body, null); return; }
  pending.set(body, tag);
  crewGearV4(gear, colors).then((ch) => {
    if (pending.get(body) !== tag) return; pending.delete(body);
    if (!ch) { failed.set(tag, performance.now()); return; }
    setCrewGear(body, ch, tag);
  });
}
