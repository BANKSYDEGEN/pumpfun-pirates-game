# Post V6 clothes follow-up (local only)

Base: `dd6fff6` / live pfp-v276; worktree `/workspace/pfp-v6-clothes`, branch `post/v6-clothes`.
No push, merge, deployment, service-worker bump, catalog/economy/save edits.

## Item-only changes
- `assets/pirates/items/v5/{classic_pants,canvas_pants,sailor_trousers,leather_breeches}_{male,female}_{hi,lo}.glb` (16): level leg openings, remove tiny waistband-edge spikes (movement capped at 6mm). Classic/canvas male legs reach inside classic/sea cuffs. Sailor high/low legs now finish at the same height instead of mismatched jagged hems.
- Breeches: lower openings lengthened to Y=0.1862 male, 0.1962 female (glTF Y-up). Sea cuff tops are 0.1982 / 0.2082: **12mm overlap**, closing Timothy's reported skin strip. Same targets both LODs and legs. Upper belt/sash silhouette retained.
- `assets/pirates/items/v5/cloth_{shirt,tshirt,coat,suit}_{male,female}_{hi,lo}.glb` (16): bounded unsharp albedo pass at existing resolution; no 2x upscale, normal maps unchanged, alpha tint masks byte-exact. Compressed download total for these items: 3.57 -> 4.03 MiB; GPU texture dimensions unchanged. Improvement is deliberately subtle, not a garment redesign.
- Rig, animation, weights, UVs, vertex tint/color keys, hem-mask attributes, mesh topology/triangle counts preserved. No new degenerate triangles. Pants images unchanged.

## Inventory / untouched
- Catalog pants IDs: `classic_pants`, `canvas_pants`, `sailor_trousers`, `leather_breeches`; free `pants:none` = default bare white V6 underwear. No classic colour-variant IDs or underwear colour-variant IDs/assets exist in v276. Did NOT invent IDs, pricing, or modify body underwear.
- Outfit IDs `shirt`, `tshirt`, `coat`, `suit` resolve to `cloth_*` item assets. `tank`, `singlet` unchanged.
- `cape_tattered`, `cape_captain`, `cape_royal` use vertex paint with **no embedded texture maps**. Left them alone rather than rasterizing them or altering tint keys.
- All `pirate_*_v6_*.glb`, shoe/boot GLBs, sw.js and runtime JS untouched.

## Review / validation
- `python3 tools/v6/test_clothes.py` — checks 32 changed GLBs vs dd6fff6: rigs/weights/UVs/tints/topology, image dimensions, exact alpha masks, unchanged normal maps, finite unit normals, no zero-area triangles, cuff overlap, unchanged catalog/SW.
- `tools/v6/polish_pants.py` operates on original v276 pants **once**; do not repeatedly apply to already-tailored assets.
- `tools/v6/clothes_review.py` creates CPU Blender item renders with game-equivalent unlit atlas x vertex color. Optional `REVIEW_BOOT_ROOT` reads Timothy's boots; `REVIEW_WALK=1` reads body animation and remaps item armatures. It never writes body/shoe files.
- Review root: `/workspace/brand/v6_characters/shots/post-clothes/` (`before/`, `after/`, `outfit-before/`, `outfit-after/`, `sea-boots-fit/`, `sea-boots-walk/`).
- These are **offline Blender renders, not in-game desktop/mobile screenshots**. No browser automation tool was available to this executor; no headless Chrome was launched. Runtime cover-mask/equip/mobile review remains with Raul/Emerly before shipping.

## Coordination
- Timothy: breeches now overlap the cuff at both genders/LODs; reviewed read-only against `/workspace/timothy-v6-shoes/assets/pirates/items/v5/boots_sea_*.glb`.
- Raul/Emerly: body underwear, crotch/chest/skin/eyes remain yours. Existing tattered belt/sash paint/silhouette mostly retained; this is a hem/edge pass, not a full analytical pant rebuild. Please review actual equipped body/cover masks and phone before shipping. No approval to ship asserted here.

## Pass 2: remaining upper-cloth albedos
- Applied `sharpen_cloth.py --keep-size` once to `cloth_{tank,singlet,base}_{male,female}_{hi,lo}.glb` (12 assets). All three families have embedded albedos.
- Same bounded unsharp pass as pass 1. Dimensions retained (hi 1024/2048, lo 512); normal maps, exact alpha tint masks, geometry/rig/UVs/materials unchanged. Total asset download: 1.96 -> 2.35 MiB; no GPU texture-size growth.
- Extended regression inventory to all 44 changed GLBs; `python3 tools/v6/test_clothes.py` passes. Pants were NOT processed again. Bodies, shoes, catalog and service worker untouched.
- Review: `/workspace/brand/v6_characters/shots/post-clothes/pass2/cloth_{tank,singlet,base}_atlas_sheet.jpg`, `validation.txt`, `texture_metrics.txt`. Sheets show underlying albedo RGB, not alpha transparency (alpha is a game tint mask).
- These are before/after atlas sheets, NOT equipped-body or in-game shots. Blender executable unavailable; no browser launched. Raul/Emerly still need equipped-body and phone review. No push or shipping approval asserted.
