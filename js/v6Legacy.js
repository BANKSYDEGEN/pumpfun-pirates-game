// [V6 store] LEGACY GRANT (pure, no imports: tests run it in node). The v5 bodies had pants + boots painted on / auto-worn; V6 is
// barefoot in white underwear. [V6 default look] EVERY pirate (old save or brand new) gets CLASSIC PANTS + CLASSIC BOOTS owned and
// worn (only into an EMPTY slot) once, so a default V6 pirate is dressed like a default V5 one. gear.v6legacy marks it done: 2 = granted
// (cleanProfile keeps the two owned even before the server copy has them); an older 1 (pre-default marker) is upgraded once. Idempotent. The server grants the same two items for rows from before V6
// (supabase/functions/pvp/lib.ts V6_LEGACY + index.ts grantV6Legacy) so the equip survives its ownership check.
export const V6_LEGACY = ['pants:classic_pants', 'boots:boots_classic'];
export function addLegacyOwned(gear, owned) { if (gear?.v6legacy === 2 && !owned.includes('*')) for (const k of V6_LEGACY) if (!owned.includes(k)) owned.push(k); return owned; }
// p: a cleaned profile; blank: no progress yet; empty: { slot: its free default id }. Returns true when it changed p (save it).
export function v6Legacy(p, blank, empty) { if (!p?.gear || p.gear.v6legacy === 2) return false; p.gear.v6legacy = 2;   // [V6 default look] blank saves too
  p.gearOwned = addLegacyOwned(p.gear, p.gearOwned || []);
  for (const k of V6_LEGACY) { const [sl, id] = k.split(':'); if (p.gear[sl] === empty[sl]) p.gear[sl] = id; } return true; }
