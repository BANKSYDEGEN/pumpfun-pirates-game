# PUMPFUN PIRATES · WEAPON STORE (swords + muskets), server half (Timothy, branch timothy/battle-areas). FOR EMERLY: already applied in
# the repo (supabase/functions/pvp/lib.ts); NOT deployed. No SQL, no migration, nothing dropped, no player data touched, no index.ts change.

## What changes (lib.ts only, additive)
1. `SHOP_ITEMS` gets 5 swords + 5 muskets (BANKSY's approved prices + goals; the RUSTY CUTLASS / RUSTY FLINTLOCK are free =
   GEAR_SLOTS.sword[0] / GEAR_SLOTS.musket[0], so they are not sold):
   ```ts
   "gear:sword:cutlass": { price: 1500 }, "gear:sword:rapier": { price: 4000 }, "gear:sword:bone": { price: 12000 },
   "gear:sword:sabre_gilded": { price: 25000, goal: [{ stat: "bossKills", need: 25 }] },
   "gear:sword:blade_gold": { price: 75000, goal: [{ stat: "kills", need: 2000 }] },
   "gear:musket:navy": { price: 2000 }, "gear:musket:blunder": { price: 5000 }, "gear:musket:dragoon": { price: 12000 },
   "gear:musket:bone": { price: 25000, goal: [{ stat: "bossKills", need: 25 }] },
   "gear:musket:blunder_gold": { price: 75000, goal: [{ stat: "kills", need: 2000 }] },
   ```
2. `GEAR_SLOTS` gets two slots (first id = free default; APPEND-ONLY, the index rides in the on-foot arena state 'ba'):
   ```ts
   sword: ["rusty", "cutlass", "rapier", "bone", "sabre_gilded", "blade_gold"],
   musket: ["rusty", "navy", "blunder", "dragoon", "bone", "blunder_gold"]
   ```
   Client mirror (keep in step when a price changes): js/shopCatalog.js WEAPON_PRICES (one table), js/pvpSave.js GEAR_SLOTS.

## Why nothing else is needed
- Ownership: the `pvp_owned.item` check `gear:[a-z]{2,10}:[a-z0-9_]{2,24}` fits `gear:musket:blunder_gold`. shop_buy (price, goal, gold,
  already-owned via pvp_shop_buy) works unchanged off SHOP_ITEMS, with the same goal checks as the parrots (bossKills / kills).
- Equipped weapons: `cleanGear()` / `fitEquipped()` iterate GEAR_SLOTS, so `gear.sword` / `gear.musket` are validated (owned or the
  free one) and stored in the existing `gear` jsonb column. Old rows have no such keys -> the rusty ones. Nothing a player owns changes.
- Owner (BANKSYDEGEN): `ownedLists(owner)` lists every GEAR_SLOTS id -> every weapon owned; shop_buy returns owner:true, free.
- Cosmetic only: every sword / musket does the same damage. The arena NEVER calls pvp_claim_kill (or any RPC): pit / range KOs are
  client-only, pay nothing and never count towards goals.
- Weapons do not change the 'gr' gear wire (old clients' strict length checks stay happy); the indexes are in 'ba'.

## Deploy steps (Emerly)
1. Merge timothy/battle-areas (client + lib.ts together).
2. `supabase functions deploy pvp` (the usual pvp deploy). No `db push`, no SQL.
3. Order is safe either way: an old server answers "not for sale" to a weapon buy and strips gear.sword / gear.musket (you get the
   rusty ones); a new server with an old client just never sees a weapon request.
