# PUMPFUN PIRATES · island-shop gear on the v4 pirate (Timothy)

Branch `timothy/shop-gear` (off origin/main 2d5b6ec, v102). Visual only: no stats, hitboxes, gold, Waves or server code.

## API (`js/pirateGear.js`, also `window.PFP_GEAR`)
| Call | What it does |
|---|---|
| `applyGear(target, gear, colors?)` | Dresses ONE pirate. `target` = a `pirateFigure()` group, a `loadPirate()` result, a `PirateGLB`, or your captain figure (`ship.userData.captainMesh`). `gear` = `{ hat, outfit, eyes, parrot, hook }` with `js/shopCatalog.js` ids (also accepts the creator's `face` and `eyepatch: true`). Works before the GLB has loaded (applied on ready). Returns a Promise of the gear mesh (or `null`). |
| `setLocalGear(gear)` | After `shop_equip`: saves the slots into `localStorage.pfp_captain_v1` (+ `gearV: 1`) and re-dresses YOUR on-foot pirate and YOUR captain at the wheel at once. Fires `window` `pfp-gear` `{detail: gear}`. |
| `getLocalGear()` | What is equipped on this device (from `pfp_captain_v1`). A creator save without `gearV` counts as the shirtless default, so nobody gets the old creator defaults (tricorn + eyepatch + coat) for free. |
| `gearRenders(slot, id)` / `GEAR_RENDERS` | Whether a catalog id actually shows on the pirate (sell only these). |

The shop validates ownership; this module draws whatever it is given, and unknown ids draw nothing.

## Catalog ids
| Slot | Renders | Does not render |
|---|---|---|
| hat | `bandana`, `tricorn`, `bicorne` | `none` (free default, bare head) |
| outfit | `tank`, `tshirt`, `coat` | `shirtless` (free default = Raul's bare base; the female base keeps her wrap top) |
| eyes | `eyepatch`, `sunglasses`, `laser` | `plain` (free default) |
| parrot | `parrot_green`, `parrot_red`, `parrot_gold` | `none` |
| hook | `hook_iron`, `hook_gold` | `none` |
| map | none (`map_dig1..3` are one-use treasure maps, not wearables) | all |

## How it draws
- One extra SkinnedMesh per dressed pirate (one draw call, any number of items), bound to the pirate's own skeleton, so it follows every clip (idle, walk, run, steer, cannon).
- Clothes are grown at runtime from the body's own torso and arm skin (same bone weights, pushed out along the normal), so they fit male and female and both LODs. The red coat has an open front over a striped shirt, gold edging and cuffs, and short tails.
- Hats, eyewear, parrots and the hook are Blender meshes (`tools/blender/build_gear.py`, rebuild with `tools/blender/build_gear.sh`): `assets/pirates/gear_hi.glb` (151 KB) and `gear_lo.glb` (71 KB, phones), meshopt. Parrot and hook colours are swapped at runtime from one model. The hook folds the right hand away.
- The baked ship crew (`js/crewV4.js`) stays one draw call per ship in the default outfit.

## Wired in
- Your on-foot pirate (`js/dock/index.js`) and your captain at the wheel (`main.js` local captain, `local: true`) wear `getLocalGear()`.
- Remote captains: `pvp.js` already calls `attachCaptain(mesh, p.captain)`; a `p.captain.gear` object is drawn. The netcode does not send `captain` yet, and on-foot peers (`js/onfoot/net.js`) send no gear, so other players still see the default.

## Dev viewer
`tools/gear_viewer.html?lod=hi|lo&clip=idle|walk|steer&sex=m|f&view=q|front|back|side` (serve the repo root).
