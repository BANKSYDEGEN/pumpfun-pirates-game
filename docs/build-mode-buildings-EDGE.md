# Build Mode Buildings — edge / DB steps needing user OK

**No new table or migration required.** Building transforms reuse `pvp_terrain.pieces` (same store as SELECT / custom props / rework flags). Collider follow is derived client-side from those overrides (no `!cmod_*` writes).

## Edge function change (in this branch, NOT deployed)

`supabase/functions/pvp/index.ts` `terrain_put` sanitizer now also keeps:

- `rx`, `rz` (pitch / roll radians, clamped ±7)
- `sy` (Y scale, 0.25..4)
- wider `dx`/`dz` (±200) and `dy` (±80)

Without deploying this edge revision, the live server still strips `rx`/`rz`/`sy` and clamps travel to ±50/±20/±50. **XYZ + yaw + sx/sz + hide already persist on the current live edge.**

To apply: deploy the pvp edge function from this branch when ready. No SQL migration.

## Admin gate

Same as today: `terrain_get` sets `owner`; only then is Build Mode / BUILDINGS panel mounted. Non-owners still receive piece overrides at load and apply them once (no per-frame cost).
