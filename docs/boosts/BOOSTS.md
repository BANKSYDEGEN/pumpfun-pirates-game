# ITEM SKILL BOOSTS (emerly/boosts)

BANKSY approved this on Nov 3 ("start building that"). It follows Timothy's plan in `timothy-boosts/PLAN.md`, and pay-to-win is OK.
A piece of gear you OWN and WEAR adds a % to one ship stat. The boost is applied after the upgrade tiers, and after `pvpBoost` in Battle Royale.
The existing clamps still run last: reload >= 0.8 s and armor <= 50% (armor is never boosted).

- Client: `js/boosts.js` (the table, caps, mode factors and the profile section). It hooks into `js/shop.js shipStats`, `js/pvp.js`
  (owned list, zone, gold find, remote sanity caps) and `js/islandShop.js` (card chips, detail pane, BOOSTS n / 30 bar).
- Server: `supabase/functions/pvp/lib.ts` has `BOOSTS`, `BOOST_CAPS` and `boostsFor`. `index.ts` adds `boosts` to the load, save, shop_state
  and dev_sync responses, applies gold find to the waves_claim payout, and widens the save / dev_sync gold pace by the gold find share.
- Tests: `node --test tests/*.test.mjs` (the client table must equal the server table) and `deno test --no-check supabase/functions/pvp/security_test.ts`.
  Screenshots come from `tools/boosts_shots.py desktop|phone`.

## Where boosts count
| Mode | Combat boosts | Gold find |
|---|---|---|
| Harbor (PvE, safe zone) | 100% | yes |
| Battle Royale | 50% | yes |
| Waves (solo vs AI) | 100% | yes (server-side on the payout) |
| SWORD PIT / MUSKET RANGE | **0** (fair fights) | the arenas pay nothing |

`setFairFight(true / false)` (exported from `js/boosts.js`) is the hook that emerly/battle-areas calls when you enter or leave a pit or range.

## Caps
These caps apply per stat. Reload 6%, hull HP 5%, range 5%, damage 4%, turn 4%, speed 5%, repair 8%, gold find 10%, dig luck 15%, sword hit 4%, musket hit 5%.
Swords and muskets boost their OWN hit rate on foot, in the battle modes that use them, and never the ship (BANKSY, 5:29 PM). They are outside the 30-point ship total.
`weaponHitBonus('sword' | 'musket', { arena })` is the hook for emerly/battle-areas. `ARENA_WEAPON_BOOSTS = false` in `js/boosts.js` is the one flag that keeps them off in the SWORD PIT / MUSKET RANGE until BANKSY decides.
Dig luck is not live yet because it needs `pvp_map_dig(p_luck)`.
**Combat total cap: 30 points.** If the total goes over 30, every combat stat is scaled down proportionally. The owner gets every item free, but the caps still apply.

## Deploy
The server part is ADDITIVE ONLY: no migration, no table change and no data rewrite. Old clients ignore the new `boosts` field.
- `supabase functions deploy pvp`: deploys `lib.ts` (BOOSTS, BOOST_CAPS, boostsFor, plus the optional `goldFind` argument on saveProblem,
  which defaults to 0 so nothing changes) and `index.ts` (the `boosts` field in responses, gold find on waves_claim, and the gold find pace allowance).
- No `supabase db push`.
