# PUMPFUN PIRATES player ship v2: new hull + rig (stage 1 checkpoint)

Visual only. The layout (`shape`, `zAt`, gun stations, `deckAt`, muzzles, hitbox) is the same code as main. The new
"dress" is built on top of it, so all **1,288 muzzles across 70 configs and every hitbox field match main exactly**
(`muzzle_hitbox_verification.json`). In the real game every ball leaves its own barrel
(`ingame_fire_check.json`: maxLaunchOffset 0 m on desktop and phone, at lvl 0 and max cannons).

## Best images (gameplay camera first)
1. `harbor_desktop_c0_side_before_after_zoom.jpg`: galleon silhouette, castles, gold sheer rail
2. `harbor_desktop_c8_side_before_after_zoom.jpg`: max cannons, long hull, raised quarterdeck
3. `harbor_phone_c8_before_after_zoom.jpg`: phone chase cam, dark stern with two lit gallery rows
4. `captain_helm_desktop_zoom.png` / `captain_helm_phone_zoom.png`: captain-creator pirate at the raised helm
5. `crew_anchors_chibi_silhouettes.jpg`, `captain_eye_view_*.png`, `turnaround_8angle_before_after.jpg`, `player_turntable_v2.mp4`

## What changed (ART path: player ships via `opts.kitArt`; COMMODORE is untouched)
- **Hull:** sheer rail `railY(t)` rises to a raised quarterdeck (break at t=0.25) and a forecastle (from t=0.84). The topsides have tumblehome.
- **Paint:** dark tarred body, bright wale stripes, a buff gun-port band with red lids, gilded cap rail / wale / mouldings, and a warm deck.
- **Stern castle:** two rows of lit gallery windows, gold mouldings, pilasters and a crest, with corner stern lanterns.
- **Bow:** bowsprit + jib-boom carrying two jibs. The bow lantern is on the port side.
- **Masts:** fighting tops with gold rims and crosstrees, thicker yards with gold yardarms, and fuller billowed sails (still tintable). The courses are shortened so the captain can see under them.
- **Helm:** a raised helm dais on the quarterdeck, on the poop deck when the hull upgrade adds one. It sits to STARBOARD of the centreline so the eye line passes the masts.
- **Legacy dressing:** the old rails / cabin / stern go into `ud.hullLegacy`. It stays hidden, and comes back only when a shape-changing skin hides the base hull. The new dress (`ud.hullDress`) hides with the hull (see `partsOverride.js`).
- **Phone Low:** the dress is flattened (`Parts.flatten`): plain toon/glow materials are merged into one vertex-coloured mesh each, with textures baked to their mean colour.

## Crew anchor API (`ship.userData.anchors`)
Each entry has these fields:

    { role: 'gunner'|'captain'|'deck'|'lookout', index, side?: 'port'|'star', pos: Vector3 (body space), facing: yaw (0 = bow, +Z) , gun?, wheel?, radius?, platformR? }

- **gunner:** one behind every gun, per side, so it scales with cannon count (8 at lvl 0, 24 at max). It faces the gun at ±π/2.
- **captain:** one anchor at the wheel, facing the bow.
- **deck:** 4 waist points plus 4 castle points.
- **lookout:** one, in the top above the sails, added by `upgradeVisuals` at every level. `radius` / `platformR` give the nest size.
- Empties named `role_side_index` sit in the `crew-anchors` group (the lookout is added later and is not an empty).
- `addCrew` places today's placeholder crew from these anchors.
- Clearance was checked with Raul's chibi GLBs (1.37 u x 1.35 = 1.85 m) on every anchor (`tools/ship_tests/anchors.py`).

## Captain slot (`js/captainSlot.js`)

    registerCaptainBuilder(buildCaptainMesh)        // once, by whoever owns the captain creator
    setLocalCaptain(getCaptain())                    // local player; main.js already calls attachCaptain(mesh, localCaptain())
    attachCaptain(ship, pfp_captain_v1, {height})    // per ship; pvp.js calls it for remote ships when p.captain is present
    detachCaptain(ship), captainAnchor(ship), CAPTAIN_H = 1.85

`attachCaptain` behaves as follows:
- It accepts `{v,hat,hair,face,outfit,colors}`. Future `parrot` / `hook` fields are passed through to the builder.
- It scales the ~2.1-unit figure to the chibi height and stands it on the captain anchor.
- It hides the placeholder captain body through the crew-shader uniform `uCapOff`. The wheel stays.

Until the captain creator is merged (it is read-only on timothy/captain-creator), no builder is registered and this is a no-op. `tools/ship_tests/captain.py` registers it from that branch to prove it works in game.

## Captain sight line
`tools/ship_tests/sight.py` casts rays from the captain's eye (feet + 1.48 m) to the starboard bow, the near stem and the sea ahead.
- Result: CLEAR for lvl 0, max cannons, hull 3, hull 6 + all max, and sails 6, on both high and low.
- The exact centreline stem is behind the foremast on long hulls, because the masts are on the centreline.

## Cost (ship_cost.json, viewer, whole ship)
| config | main calls / ship tris | v2 calls / ship tris |
|---|---|---|
| high lvl 0 | 36 / 51.6k | 61 / 82.1k |
| high max cannons | 41 / 146.1k | 65 / 202.8k |
| low lvl 0 | 36 / 41.1k | 50 / 49.1k (frame 38.0k vs 41.2k) |
| low max cannons | 41 / 104.0k | 54 / 110.0k (frame 97.4k vs 104.0k) |

Hidden legacy meshes add to the ship-tris count but are not drawn.

## Stage 2: shape-changing skins on the v2 hull (docs/ships/v2/stage2)
- **Skins sheets:** `skins_high.jpg`, `skins_low.jpg` (all skins, COMMODORE unchanged, Squads blue/red, golden + team blue).
- **Golden:** the new hull's carvings and stern gilded, lids in glossy red lacquer.
- **Ghost:** torn translucent sails and mist on the v2 hull, ghostly crew.
- **Diamond:** crystal shell and glints on the v2 hull, crystal masts and a diamond on the flag pole.
- **Kraken:** the tentacles are rebuilt from the hull shape for every length.
  - The head sits off the port bow, clear of the stem, figurehead and ram.
  - `kraken_check.json` is from `tools/ship_tests/kraken_check.py` (three-mesh-bvh, 48 animation phases at max amplitude, 19 level configs on high and low). Result: **ALL OK**, with 0 surface hits on the hull or sails, 0 footprint, crew or sail-gap violations.
  - `kraken_phases.jpg` shows stills at four phases (high lvl 0, high max cannons, low).
- **Flaming:** the black lava hull is kept.
  - Fire tongues rise off the rails, the deck along the bulwarks, the stern and the bow, and trail with speed.
  - Taller fire runs up the sails, the flag burns, and there are embers (150 on high, 40 on low).
  - The fire shader runs core → orange → dark smoke crown, with premultiplied additive glow.
  - Files: `flaming_still.mp4`, `flaming_sail.mp4` (sailing), `flaming_low.mp4`, plus jpg stills.
- **Tier skins:** dark bodies, gold trim, and the identity colour in the wales and sails. The sails have a bolt-rope edge in a contrasting colour.
- **Muzzle/hitbox harness:** 676 configs (every skin × lvl 0 / max cannons / all max / each upgrade type at 2-4-6-8). 7,480 muzzles, **0 differ** from main (`muzzle_harness_all.json`).
- **Phone budget:** see `phone_budget.json`, from `tools/ship_tests/cost2.py`. Scene draw calls at low lvl 0, main → v2:

| Skin | Main | v2 |
|---|---|---|
| Classic | 36 | 40 |
| Crimson | 37 | 41 |
| Storm | 38 | 42 |
| Kraken | 39 | 43 |
| Golden | 41 | 41 |
| Ghost | 38 | 42 |
| Flaming | 39 | 43 |
| Diamond | 44 | 46 |

  On low, the static upper deck, trim and rails are merged per ship into vertex-coloured meshes. Sails, still 8 separate front/back pairs because they animate individually, are the main remaining cost.
- **Known caveats:**
  - Storm Rider still reads silver-white, because of its lightning/fresnel glow over the dark body.
  - Flaming's hull reads bronze under its own fire light.

## Stage 3: visible upgrades level by level (docs/ships/v2/stage3)
Every visual is keyed to an upgrade stat that already exists in `js/upgrades.js` (cannons, hull, armor, sails, range, rudder, reload). No stat, muzzle or hitbox changes.

**What each upgrade shows**
- **CANNONS:** the hull lengthens (sloop → brig → frigate → galleon via the existing gun-row stretch), with bigger guns, swivels, chasers, stern guns, a lower deck and a mortar.
- **HULL:** wider and deeper hull classes, belt, forecastle, the taller poop / stern castle, quarter galleries, fenders and gold trim.
  - New: at max HULL, the figurehead gets a gold crown with spikes, a gem and swept gold fan wings.
- **ARMOR:** on the v2 hull the plates are now bright steel so they show against the dark hulls.
  - Studs (rivets) and bands get bigger and thicker with level, then the ram, then gold edging at max.
  - The legacy cabin plates are skipped, because the v2 hull hides that cabin.
- **SAILS:** bigger sails with broader yards, then topgallants and royals, the skull spanker on the mizzen, and a 4th mast.
  - New: an extra (outer) flying jib on its own jib-boom from SAILS 1+ (with a topmast).
  - New: studding sails past the course yards from SAILS 3 (royal), and past the topsail yards too from SAILS 4.
- **RANGE:** the lookout is up at every level.
  - RANGE 1 (SPYGLASS I) now has a wider gilded nest and a brass spyglass with a glint: `range_lvl0_vs_lvl1_lookout.jpg`.
  - Higher levels: crow's nest, scopes, the watchtower, lamps, then gold.
- **RUDDER:** bigger rudder, stern lanterns, wheel, gallery, then gold.
- **RELOAD:** shot racks, then (new on v2) glowing orange frames round every real gun port from RELOAD 2, plus gold rings round the barrels at max.
- **Any upgrade at MAX:** a gold-edged crimson swallowtail streamer flies above the flag.

**Sheets**
- `upgrade_progression_classic_high.jpg` and `_low.jpg`: rows are the upgrade types, columns levels 0, 2, 4, 6, 8. The 8 column repeats level 6 for types whose max is 6. Each row uses one fixed camera so growth reads.
- Also `upgrade_progression_golden_high.jpg` and `upgrade_progression_flaming_low.jpg`.
- `every_skin_lvl0_maxcannons_allmax_high.jpg` and `_low.jpg`: every skin at lvl 0, max cannons and all max.
- Close-ups: `armor_reload_broadside_close_high.jpg`, `rudder_hull_stern_close_high.jpg`, `max_hull_figurehead.jpg`, `max_sails_streamer_jibs_high.jpg`, `max_sails_hull_low.jpg`.
- Gameplay before/after at all max (desktop and phone, chase cam and orbited): `gameplay_*_max_*before_after.jpg`.
- Turntable: `turntable_lvl0_then_allmax.mp4`.

**Verification**
- **Muzzle/hitbox harness:** 676 configs, 7,480 muzzles, **0 differ** from main (`muzzle_harness_all.json`).
- **In-game fire at all max:** 24/24 balls launched from their barrels, max launch offset 0 m, on desktop and phone (`ingame_fire_check.json`).
- **Kraken clip check:** ALL OK at every level, including all max with the new sails (`kraken_check.json`).
- **Captain sight line:** CLEAR in all 10 configs (`captain_sight_line.json`).
- **Phone budget** (`phone_budget.json`). Scene draw calls on LOW:
  - lvl 0: 40 (main 36).
  - max cannons: 45 (main 41).
  - every upgrade max: **62** (main 63).
  - On LOW, the upgrade topsails, royals, extra jib and studding sails merge into one front/back sail pair. HIGH max is 109 calls (main 64).
