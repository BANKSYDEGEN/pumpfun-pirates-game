# V7 female tops, batch 3 (BANKSY t442u) - root cause + refit commands

Shipped subset (t445u): cloth_tank only. t-shirt (skin at bust), shirt (collar), coat (lapel flecks), suit (bust slits) stay local.

Why 083dcfe (b2) looked torn / showed skin:
1. Seam tearing (fit bug): co-located UV/colour seam copies were smoothed, pushed and reweighted one by one; copies drifted up to 4.7 cm
   apart (coat: 829 seam points > 3 mm) and took different weights -> open cracks (skin + background) that widened in the walk.
   Fixed: fit.py welds every per-vertex result over its co-located group (crack.py: 0 for all 10 files).
2. Stacked shells crossing (fit bug): lapel / waistcoat / lining shells 3-8 mm apart got different displacements (own weights + topological
   smoothing) and different weights (KEEPW blend by distance) -> "camo" patches on her chest. Fixed: SPATIAL Gaussian smoothing of the fit
   displacement + pushes + weights over all cloth within 3 cm; KEEPW own-weight blend only below y .56 (tails).
3. Bust poke-through between cloth vertices: BUST=0.004 extra clearance in the chest band only (y .66-.86, |x| < .2).
4. Preview mismatch (render bug): b2 previews drew the coat / t-shirt texture alpha as transparency and kept the whole body. Runtime
   (js/pirateItems.js clothMat) is opaque, alpha = cream/tint mix, back faces = cloth colour * .85; applyHide/coverMask removes body
   triangles under the cloth (CLOTH r .024, in .016 via _HEM). rend3.py + mask.py reproduce both.

Fit (from /workspace/v7f-gear-work, Blender 4.2):
  env BUST=0.004 SPATIAL=0.03 SPIT=6 NSMOOTH=12 KEEPW=0.04 KEEPY=0.56 [SKIRT=1 coat/suit] blender -b --python tools/v7f_gear/fit.py -- cloth dec/<id>_female_<lod>.glb out.glb <lod> <.005 coat/suit | .004 others>
Pack: MESHOPT=1 node pack2.mjs out.glb dst.glb <existing asset>
Preview: rr.sh <tag> <item>  (textured runtime material + magenta-body diagnostic, runtime cover mask, unchanged walk_pirate clip; NOT a game capture)
Checks: crack.py (seams), sd.py (bind penetration), selfx.py (shell crossings), posed.py (walk penetration / edge stretch)
