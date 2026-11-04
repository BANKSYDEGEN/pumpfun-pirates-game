# PEG LEG FIT (v5) — Raul, branch raul/pegleg

## What changed
- **New fit** (`tools/pegfit.py`): a leather knee sleeve is ray-cast around the real pant leg (cloth_base + body) on each body and LOD.
  It runs from 5 cm above the knee joint down to 4 cm below it, then closes in a rounded cup that the shaft goes into. The pants and
  boot stay under it, so there's no gap or ragged cut.
- **Weights**: the sleeve takes half the pant weights and half a smooth knee blend, using only that leg's thigh and shin. It bends with
  the knee and doesn't crease. The cup, strap, buckle, shaft and tip are rigid on `shin.X`, so the peg swings with the leg, and the tip
  sits at y = 0, where the boot sole was.
- **Hide** (`js/pirateItems.js`): new rule `leg5` in raw v5 bind space, using `PEG_CUT = { male: 0.2022, female: 0.2122 }` (knee − 1.2 cm).
  It hides that leg's body and base-outfit pant leg and boot below the cut. The other leg keeps its boot. It replaces the old v4-space
  rule (`leg y < 0.233` through v5Inv), which left the boot cuff and a white cut edge showing above the old cup.
- Rebuilt: `assets/pirates/items/v5/peg_{l,r}_{male,female}_{hi,lo}.glb` (hi 5,336 tris, lo 2,200 tris; the old ones were 6,520 / 1,956).
  The pre-baked card `assets/pirates/thumbs/leg_peg.png` was baked again.
- `tests/pegleg.test.mjs` (25 tests) covers all 24 peg GLBs (standard plus the two special pegs). Each must be skinned to that leg's thigh and shin
  only, have its tip on the floor, sit on its own side, have its sleeve top above the hide line and stay within the tris budget. The test also checks
  that every peg item uses PEG5 and that the shop entry is unchanged.
- Shop entry, price and slot are unchanged. No gameplay stats or hitboxes changed.

## Rebuild the standard peg
    cd /workspace/brand/v5_models/raul_pegleg/tools
    for w in male female; do for l in hi lo; do for s in l r; do /opt/blender/blender -b -P build_peg.py -- $w $l $s <repo>; done; done; done
Fit params are written to `../fit/peg_fit_<side>_<who>_<lod>.json`. To tune, edit TOP / CUT / STRAIGHT / CUP / GAP at the top of pegfit.py.
**If you change CUT, update `PEG_CUT` in js/pirateItems.js to match** (the cut = knee z + CUT; `tests/pegleg.test.mjs` checks it sits under the sleeve).

## The special pegs (peg_gold / peg_kraken)
raul/shop-items-2 landed in main as v178 (351389c) while this was being built, so **this branch already applies the fit to them**:
- js/pirateItems.js: `peg_gold_l/_r` and `peg_kraken_l/_r` use `v5hide: PEG5('L'|'R')`. They had the old v4 rule before.
- All 16 GLBs are re-fitted in place, and their cards (`leg_peg_gold.png`, `leg_peg_kraken.png`) are baked again.
- `refit_special.py` keeps each peg's shaft, ornaments and tip (gold skull with ruby eyes; kraken tentacle with bone knobs) and moves
  them onto the new knee centre, rigid on shin. It drops the old knee cup, rim, velvet cushion and cup gem (any loose part whose centre
  is above the old shaft top from `raul_shop_items_2/tools/peg_fit_*.json`). Then it adds the fitted sleeve in the peg's own colours
  (`pegfit.PAL`): gilded = gold sleeve, darker gold rim, crimson strap and the ruby back on the front; kraken = bone sleeve, purple rim, purple strap.
- Tris: gilded hi 6,800 / lo 2,944; kraken hi 6,360 / lo 3,256 (was 4,512 / 1,968 and 3,688 / 2,112).
- Re-running it is safe: each re-fitted GLB carries a `pegfit` glTF extra with the knee and shaft top it was seated on, so a second
  run re-seats it from that record and never shifts it twice. This has been checked.

Re-run it if those pegs are rebuilt with shop-items-2's build.py, or for any later peg built on the old knee-cup seat:

    cd /workspace/brand/v5_models/raul_pegleg/tools
    for it in peg_gold peg_kraken; do for s in l r; do for w in male female; do for l in hi lo; do
      /opt/blender/blender -b -P refit_special.py -- $it $s $w $l <repo> <repo>; done; done; done; done

Then bake the cards again (tools/peg_cards.html, where `window.BAKE` holds all 3 peg cards) and run `node --test tests/*.test.mjs`.
New peg items need a palette in `pegfit.PAL` (leather, rim, band, buckle, optional gem). Without one they get the plain leather.

## Dev pages (not shipped)
- `tools/peg_viewer.html`: gear_viewer with `&time=` (frozen clip time) and `&swim=tread|swim` (swimPose)
- `tools/peg_cards.html`: the live PEG LEG cards (both sides × both bodies) and the pre-baked PNG; `window.BAKE` = the card to bake
