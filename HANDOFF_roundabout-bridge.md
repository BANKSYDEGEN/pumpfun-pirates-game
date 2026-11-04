# timothy/roundabout-bridge (Timothy, from Emerly's emerly/path-fix2 6b442c7) — sw pfp-v208, NOT pushed

## What it is
- `js/island/areas/hillRound.js`: the hill roundabout outside the town gate. Plaza = one rect area deck at y 20.1 (x -438..-413, z -100..-76),
  geometry only (no terrain pads / cuts / live terrain writes). Big three-tier wishing fountain at (-425.5, -88) (Blender model
  `assets/island/rb_fountain(.glb|_low.glb)` from `tools/roundabout_blender/rb_fountain_blender.py`; kit fallback, `&rbglb=0`).
- Exits: W = the gate arch (town), N = castle approach apron -> Post's fort stair (braziers, lanterns + banners on his parapets),
  S = Pirates' Climb as stone stairs + a landing on the trail's own line (old route_stair_3..9 decks / walls / colliders switched off),
  E = the high rope bridge (126 m, deck half-width 2.3 = ROUTE.hw, trail width) to the waterfalls plateau; plateau flag path onto trail A.
- High bridge = Emerly's layered walk height (foot.js HIGH_BRIDGES / setLayer / highBridgeAt): only walkers at deck height use it; the
  valley trail runs under it to the beach.
- Kill switch: `&roundabout=0` (areas/index.js RB_ON) = the old gate + paths exactly.
- Wishing-fountain anchors: `assets/island/fountain_anchor.json` + `FOUNTAIN_ANCHORS` export (regen: `node --import ./reg.mjs export_anchors.mjs`
  in tools/roundabout_blender/node).
- foot.js / net.js changes for Raul: `tools/roundabout_blender/FOOTJS_NETJS_DIFF_FOR_RAUL.md`.

## Probes (no browser)
`cd tools/roundabout_blender/node && node --import ./reg.mjs rb_probe.mjs` (walk heights / steps / colliders on each route; QS='?roundabout=0' env for before).

## Known gaps
- The old east dip trail now ends at the plaza's east wall (rubble + scrub there).
- The valley trail's dead end under the plateau cliff is dressed as a rockfall (colliders); there is no stair up the cliff — the bridge is the way up.
- Remote peer first seen under the deck is placed on it, then drops; a local pet regroup under the bridge can land below.
- Trail paint is unchanged (the deck covers it); edging fold-in only with the material library on.
