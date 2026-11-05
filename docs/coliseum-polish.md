# Coliseum polish — BANKSY Nov 5

Built as a new commit above musket-only `d4b3ee7`. No push, rebase or amendment. No service-worker bump (ship coordinator chooses the next live version).

## Changes

- Main portal fills the whole R4 alley (9.624m), street face lx14 flush with the shop doors. Clear opening 6.824m, depth29. Matching terrain crossfall, paving, deck and masonry return colliders. Old square well/stalls and entrance clutter removed with coli enabled; kill switch restores them.
- **Back stairs lead to the fountain plaza y20.1, NOT the upper castle approach y31.82.** Rounded 40.617m route from town-local (43,-184) to (12,-206). 4.8m clear width, dressed stone treads, matching PATH walk deck. Final16m is an open plaza-level landing. The existing castle first flight starts8m farther up its same axis (-64 instead of -72), making that landing usable; castle access continues normally from the plaza. Terrain cut keeps both flights above the ground; no hidden stair cheeks across the landing.
- Castle-stair flowers, bushes, topiary, planters and lamps removed, including matching planter/lamp colliders. No invisible lamp circle left behind.
- Arena grit/dirt detail layer8, muted pad tones and worn stone flag patches; no floor colliders added.
- **Interior dirt root cause:** the rectangular coliseum terrain feather extended8m past lz-44 and overwrote the fixed plaza shop floor at lz-42. Protect the entire facade row plus a4m grid-cell margin after stamping; blend only outside the shop back walls. Fish, marketplace and adjacent crew interior terrain stays <=2.69 below its original2.73 slab. Coliseum exterior ground at lz-48 and inward remains9.2.
- **Exterior obstruction root cause:** old hill-mound terrace pieces were regenerated against the newly flattened coli ground, leaving obsolete retaining pieces/colliders around the back shoulder. Suppress those pieces in both art and collision within the new ground/corridor. Real coliseum piers, walls, shop backs and stair cheeks remain solid.
- Fountain plaza Blender layout and both desktop/phone GLBs regenerated for the longer lower castle apron. Layout-match test green (no plain-kit fallback).

## QA

`node --test tests/*.mjs`: **517 pass,0 fail,2 existing skips (519 total)**. Includes digspots, castle onward access, plaza baked-layout match and8 polish regressions.

`COLI_REPORT=/workspace/terrain-shots/coliseum/polish/walk_probe.json node --import ./tools/roundabout_blender/node/reg.mjs ./tools/roundabout_blender/node/coli_check.mjs`

- Stair center every0.2m and both +/-1.4m shoulders every0.3m:0 collider hits; profile error <3e-14, max sampled rise0.101m.
- Main entrance center/+/-2m lanes and battery exit through full wall thickness:0 hits.
- Exterior360-degree footprint sweep:720 samples,661 clear,59 intersect **real visible boundaries** (fish-market back wall, main portal returns, back stair cheeks),0 unexplained blocks. This is not a claim that a continuous circular walk can cross those preserved walls. `walk_trace.png` marks them orange, clear samples green, entrance/stair paths blue.
- Fish/marketplace/adjacent crew interior grid:2714 samples under the original floor.
- Solid shell collider still verified. Kill switch restores old well and old range.

## Review evidence

All evidence under `/workspace/terrain-shots/coliseum/polish/`:

- `before/{desktop,phone}_{fish_inside,market_inside}.png`: same cameras before the terrain fix.
- `after/{desktop,phone}_{fish_inside,market_inside,main_gate,main_gate_alley,musket,castle_stair,castle_stair_join,castle_corridor_clear,arena_ground,aerial}.png`.
- `walk_probe.json`, `walk_trace.png`, `tests.log`.

Reproduce renders: `python3 tools/coliseum_polish_shots.py OUTDIR 'plaza=2' desktop` (or `phone`), existing local workspace server18960. Local headless island viewer, desktop high and phone low detail. Network mutations disabled; no score data touched.

Storm Hunt leaderboard/spyglass work is not included. No shop or board positions, score data, character GLBs or unrelated art changed.
