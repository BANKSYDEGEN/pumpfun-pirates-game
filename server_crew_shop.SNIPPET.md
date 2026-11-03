# PUMPFUN PIRATES · CREW SHOP server half (Timothy, branch timothy/crew-pets). FOR EMERLY: already applied in the repo
# (supabase/functions/pvp/lib.ts); NOT deployed. No SQL, no migration, nothing dropped, no index.ts change needed.

## What changes (lib.ts only, additive)
1. `SHOP_ITEMS` gets 8 crew items (price = the player version, 1:1):
   ```ts
   "gear:crewhat:tricorn": { price: 400 }, "gear:crewhat:bicorne": { price: 1200 }, "gear:crewhat:crown": { price: 15000 }, "gear:crewhat:crown_imperial": { price: 25000 },
   "gear:crewoutfit:tshirt": { price: 300 }, "gear:crewoutfit:coat": { price: 1000 }, "gear:crewoutfit:shirt": { price: 300 }, "gear:crewoutfit:suit": { price: 3000 },
   ```
   (If main has HQ HELMET `gear:hat:helmet_hq` 800 by then and you want it for crew too: add `"gear:crewhat:helmet_hq": { price: 800 }`
   AND append `helmet_hq` to the END of GEAR_SLOTS.crewhat, js/pvpSave.js GEAR_SLOTS.crewhat, js/crewLoadout.js CREW_SLOTS.crewhat and
   js/shopCatalog.js CREW_FROM.crewhat. Append only: the index is on the wire.)
2. `GEAR_SLOTS` gets two slots (first id = free crew uniform):
   ```ts
   crewhat: ["bandana", "tricorn", "bicorne", "crown", "crown_imperial"], crewoutfit: ["tank", "tshirt", "coat", "shirt", "suit"]
   ```

## Why nothing else is needed
- Ownership: `pvp_owned.item` check is `gear:[a-z]{2,10}:[a-z0-9_]{2,24}` -> `gear:crewhat:tricorn` / `gear:crewoutfit:suit` fit. shop_buy
  (price / goal / gold / already-owned via pvp_shop_buy) works unchanged off SHOP_ITEMS.
- Equipped crew loadout: `cleanGear()` / `fitEquipped()` iterate GEAR_SLOTS, so `gear.crewhat` / `gear.crewoutfit` are validated
  (owned or the uniform) and stored in the existing `gear` jsonb column (pvp_profiles.gear / pvp_dev_profiles.gear) by toRow / devCols.
  Old rows have no crew keys -> cleanGear fills the uniform. Nothing a player owns changes.
- Owner (BANKSYDEGEN, OWNER_MAIN): `ownedLists(owner)` lists every GEAR_SLOTS id -> every crew item owned; shop_buy returns owner:true free.
- Player vs crew never mix: different keys (`gear:hat:tricorn` vs `gear:crewhat:tricorn`), different slots.

## Deploy steps (Emerly)
1. Merge timothy/crew-pets (client + lib.ts together).
2. `supabase functions deploy pvp` (the usual pvp deploy). No `db push`, no SQL.
3. Order is safe either way: an old server answers "not for sale" to a crew buy and strips crew keys (crew show the uniform);
   an old client never sends crew keys (server fills the uniform).
4. Check: as a test device `shop_buy { item: "gear:crewhat:tricorn" }` -> ok, price 400; `shop_state` owned.gear contains
   `crewhat:tricorn`; the player's `hat` is unchanged.
5. Note for the DAILY DEAL snippet (timothy-ui/server_daily_deal.SNIPPET.ts): DEAL_POOL takes every priced SHOP_ITEMS key, so crew items
   join the pool (the client js/shopUx.js list must then include CREW_ITEMS too, or filter `gear:crew` out on both sides).
