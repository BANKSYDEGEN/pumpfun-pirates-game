# HANDOFF: path-fix2 (fountain roundabout + high rope bridge), Emerly -> Timothy (BANKSY 12:07 PM)

**Status: WIP. It has never been run in a browser. Don't push it to main as is.**

- **Branch:** `emerly/path-fix2`, pushed to origin as a branch only.
- **Based on:** origin/main 163c963 (v199 perf3).
- **Worktree:** `/workspace/pfp-pathfix2`. Commit = the WIP commit on this branch.
- **sw:** not bumped. At push time, set it one above main (v199 -> pfp-v200 unless main moved).
- **Server:** no changes, so no pvp deploy is needed.

## BANKSY's brief (10:47 AM to 11:22 AM)
- "Coming out of the hill street will be a water fountain area roundabout that goes right to the castle, left down the hill or straight across rope bridge to waterfalls plateau."
- No dip from the hill road to the waterfall.
- "So players below can walk under and get to beach still" (headroom of at least 3 m, and no low colliders).
- He pre-approved pushing once the shots look good and he says OK: "Yes show me what come up with, push it, then have Timothy make it nice".
- Reference image: `/workspace/terrain-shots/banksy_path2.png`. Its camera is about foot (-284,-64), looking west at the fort.

## The site (foot coords; probed in a browser on 90e1491 with live terrain rev 71)
- **Gate junction / hill street top:** (-434,-84), y about 20. The gateJunction.js pad is at (-434.2,-84.0), rx 4.7, rz 10.4.
  - The town is west.
  - Fort (castle) POI: (-408,-44).
  - Fort stair foot: (-434,-59).
- **Trail A has two branches at the gate:**
  - South: the Pirates' Climb lead-in. It is flat at y 19.8 to 19.95 out to A[10], about (-428,-100), then steps down to (-421,-111) at y 11 and (-413,-124) at y 6.
  - East (the dip): (-427,-82) y 19 -> (-414,-80) y 10 -> valley y 5 at x -397..-317, z about -77..-66. It then climbs a 17 m cliff between (-297,-64) at y 7 and (-281,-61) at y 24. That cliff is the dead-end in BANKSY's shot, with the smeared cobble face.
- **Valley:** x -420..-300, y 4 to 8. It runs north-south and opens onto the beach at z > -10 (y about 3).
- **Waterfalls / lagoon plateau:** east of x about -295, y 24 to 27. Lagoon dock POI: (-205,-63). LAKE is at (-205,-130) with r 58. The waterfall cliff is FALLS_CLIFF (-212,-236).
- **BANKSY's own attempt:** build mode, revs 52 to 69, 10:43 to 10:46 AM, all deleted by rev 70/71. He placed 17 'bridge' pieces (PROP_CAT t 12) from (-291,-54) at y 6.2, through the dip near (-278,-34) at y 5.3, up to (-155,37) at y 13.6. The live terrain cells and paint are exactly our earlier castle-path fix (37 cells, 52 paint cells). His build-mode edits did not cause the problem.

## What's in the WIP (code only; no live data written)
- **`js/island/areas/hillRound.js`** (new area module, registered in `areas/index.js`):
  - **Roundabout:** centre (-425,-93), paved ring r 7.6 at y 19.9 (`RB2`).
    - Flat terrace from the terrain pad [-433.5,-416.5, -101.5,-84.5, y 19.9].
    - Stone retaining walls on the terrace edges where the ground drops (they run down to the ground), with a parapet except at the exits.
    - Kerb ring with gaps at the exits, 4 iron lamps at the terrace corners, 2 benches.
    - Fountain: octagonal basin, colliders addCirc r 2.5. Water and jets are animated in tick() (static meshes, no sound).
  - **Exits:**
    - West: the gate / hill street (-434,-84).
    - North / "right": to the castle, over the gate pad to the fort stair (-434,-59).
    - South / "left": down the hill on the existing Pirates' Climb steps (-428,-101) -> (-413,-124).
    - East / "straight": the bridge.
  - **High rope bridge:** from A (-416.7,-93) at y 19.9 to B, which is searched at register time back from (-282,-72) to the cliff top. The deck there is y about 25.
    - Length about 137 m, in 3 spans on 2 stone piers at t = 1/3 (about (-372,-86)) and t = 2/3 (about (-327,-79)). Pier colliders are r 1.9 in the valley.
    - Even grade with 0.5 m sag per span, so no dip.
    - Headroom over the valley is 12 m or more (deck 20 to 25 over ground y 4 to 8). The piers sit 9 to 12 m off the valley trail.
    - D3 look: planks, rope rails, hangers, anchor posts with lanterns, a small visual sway (tick only), and a paved landing at the B end.
- **`js/island/foot.js`:**
  - `HIGH_BRIDGES`, `setLayer(y)`, and `highBridgeAt(x,z)`.
  - A high bridge is the floor only when the querying body's feet are within 2 m of the deck. When the layer is null (no body set), the ground below is the floor.
  - Hooked into groundAt, blocked (rails) and whyBlocked.
  - `addHighBridge` is passed to the areas' register(h). The return object gets `setLayer`.
  - **D3 (`BRIDGE` / `bridgeAt`) is unchanged.**
- **`js/dock/world.js`:** `layer: (y) => foot.setLayer(y)`.
- **`js/onfoot/physics.js`:** stepBody sets the layer to b.y on every sub-step and clears it at the end. placeBody takes an optional ly.
- **`js/onfoot/walker.js`:** step() and camPos() set the layer to w.y.
- **`js/onfoot/followers.js`:** move() sets the layer to c.y. Join and teleport placement uses W.y, so the crew lands on the bridge when you are on it.

## What's left (nothing below was verified)
1. Run it in a browser. Only `node --check` and the node tests (170/0) have passed. Check for runtime errors, that the area builds, that the pad y 19.9 really matches the gate lead-in, and that the B end search lands on the cliff top.
2. Shots and walk tests on desktop and phone. Harness: `/workspace/pfix2/shots.py`, `/workspace/pfix2/walk.py` (`PB=http://127.0.0.1:8998/index.html`; serve the worktree there). The walks cover the bridge both ways, under the bridge to the beach, left down the hill, right to the castle, and the hill street. Crew positions are logged at the end of each walk.
3. Make it nice (Timothy): libTex materials (castle / plaza stone), Blender pieces, fountain splash sound, a real retaining-wall look instead of the stretched cobble face, kerbs that match gateJunction, foliage clear-outs.
4. Known gaps and risks:
   - The overlap with the gateJunction pad flagstones may z-fight (my paving sits 2 cm higher).
   - Remote pirates first placed mid-bridge are placed on the ground below (net.js placeBody has no layer).
   - The 17 m cliff dead-end at (-297..-281, -64..-61) is still there. The bridge bypasses it; it may want stairs or a rock wall.
   - No kill switch yet. Suggestion: `?hillround=0`, which drops hillRound from AREA_MODS.
   - Trail A's east branch start (-427,-82) is just north of the terrace; check the edge.

## Don't
- Don't change D3 (foot.js ROPE_BRIDGE / BRIDGE / bridgeAt, areas/ropeBridge.js).
- Don't write live `pvp_terrain` without a backup first. Snapshot at handoff: `/workspace/backups/pathfix2_terrain_snapshot_20261104_1208/pvp_terrain_rev71.json`. Earlier: `/workspace/backups/terrain_prefix_20261104_093138`.
- Don't touch BANKSY's build-mode data (pieces, cells, paint, log).
- Keep `CREW_EXTRA_SLOTS` empty.
- Commit as BANKSYDEGEN. Never force-push. One headless browser at a time; kill only your own PID.

## Shots
- Reference: `/workspace/terrain-shots/banksy_path2.png`.
- Before (v197 code, live terrain), desktop and phone, views banksy / dip / round / overhead / under: `/workspace/terrain-shots/pfix2/before_{desk,phone}_*.png`. `before_desk_banksy.png` matches BANKSY's angle.
- No after shots yet.
