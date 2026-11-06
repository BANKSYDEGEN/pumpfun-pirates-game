# V7 male release

Source: BANKSY-approved tattoo-corrected Meshy male (`male_v7_rigged_fixed.glb`). Female is not changed.

- V7 geometry is welded across UV seams, aligned to V6 feet/joints/height, conformed below the neck to the established garment volume, and weighted to the unchanged 13-bone game skeleton. Existing idle/walk/run/steer/cannon clips and procedural jump/swim/emotes/weapon poses are retained. The original Meshy animation rig is not used at runtime.
- Draco + WebP: high 25,930 triangles / 798,380 bytes / 2K albedo; low ~8,300 triangles / 491,488 bytes / 1K albedo. Stylized Lambert shading uses the albedo, not the source normal/metal/roughness maps.
- Independent per-instance skin/hair/iris pixel masks; default preserves source colors. Tattoo/white cloth/black outlines protected. V6 load fallback remains.
- Player/on-foot, local/remote captain, walking followers, wardrobe/live previews use the shared loader. The legacy static V5 deck-crew bake (`crewV4.js`) is intentionally unchanged: it never used V6. Female GLBs and female thumbnail PNGs are unchanged.
- Four male plaza mannequins now use real low V7 bodies + real fitted gear (3 Clothes Shop, 1 Crew Shop). Old male wooden bodies removed from merged shop assets; their stands and female forms remain. All 123 male/crew/weapon fallback thumbnail PNGs regenerated at their original dimensions.

## Verification

- 66 catalog/left-right gear variants × 19 animation/procedural pose states × 2 LODs = 2,508 checks; no bad joint indices, nonfinite/unweighted vertices, or browser errors.
- Idle, mid-walk and back grids under `/workspace/v7-male-ingame-shots/fit/` including `SHEET_hi_all_items.jpg`, `SHEET_lo_all_items.jpg`, `summary.json`, `report.json`.
- All male garment/accessory GLB bone palettes resolve to V7 in `tests/v7MaleRig.test.mjs` (both LODs). Separate 12 sword/musket previews use the actual battle preview poses.
- V6 HTTP-404 fallback, independent tint instances, tint/default reset tested in `tools/v7/loader_test.py`; output `/workspace/v7-loader-test.json`.
- Actual island scene at PC 1280×800 and phone 390×844: idle/walk/hat+coat/sword/gun, different skin/hair/eye colors, captain at helm, 4 fitted mannequins, live clothes/changing-room and weapon previews, look picker. Zero page errors. Files `/workspace/v7-male-ingame-shots/` and `game_report.json`.
- Screenshots/test clients block ALL external HTTP/WebSocket writes, so no test accounts, fake leaderboard kills or gold were created.
- Full suite: only the pre-existing rbBlend baked-layout mismatch is allowed. Re-run after rebasing the release.

This is not a guarantee about every possible multi-item combination; the catalog items, left/right variants and existing fit/hide rules were exercised individually and in representative full outfits. Native facial expressions are a painted face (no new facial morph/blink animation).
