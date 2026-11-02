# PUMPFUN PIRATES · island-shop gear on the v4 pirate (Timothy)

Branch `timothy/shop-gear`, on origin/main 8419c31 (v107; v105 shipped the first cut of this gear, v107 Emerly's per-instance `PirateGLB.setColors`, kept as is). ONE gear system: Raul's pirate items (`raul/pirate-items` de13179, models / icons / pirateItems.js only, NOT his c5dd8c4 setColors change: `js/pirateItems.js`, `assets/pirates/items/`) are imported verbatim and driven from `applyGear`; nothing else equips gear. Visual only: no stats, hitboxes, gold or Waves changes, and no Supabase edge-function or SQL changes. Also edits `js/crewV4.js` crewGearV4 (v106) so the crew bake includes Raul's skinned items (tricorn, crown, shirt, coat) next to Timothy's gear mesh, still one draw call per ship. `js/pirateGLB.js` carries only Raul's `export gradient` + item-mixer tick (his pirateItems.js imports them) (see "Server" below).

## API (`js/pirateGear.js`, also `window.PFP_GEAR`)
| Call | What it does |
|---|---|
| `applyGear(target, gear, colors?)` | Dresses ONE pirate. `target` = a `pirateFigure()` group, a `loadPirate()` result, a `PirateGLB` or a captain figure. `gear` = `{ hat, outfit, eyes, parrot, hook, leg, hatColor, hookSide, legSide, skinColor, hairColor, outfitColor }` (shop ids). `colors` = `{ skin }`, the ship skin id the clothes take their colours from (or explicit `{ cloth, trim }`). |
| `setLocalGear(gear)` | Merges into YOUR gear, saves `localStorage.pfp_captain_v1` and re-dresses your on-foot pirate and your captain at once. Fires `pfp-gear-local`. Used by the hat colour picker. |
| `setLocalSkin(id)` | Your ship skin changed. main.js calls it every frame with `player.mesh.userData.skinId`, and it does nothing unless the skin changed. |
| `window.applyPirateGear(obj, gear)` | The v102 hook, now implemented. v103's `pvp.js gearChanged` sends `pfp-gear {gear}` (the server-checked profile gear), which also syncs the local save. The profile wins for the gear slots; `hatColor` is a server profile field since v105 (the shop's hat-colour row); the free look (`hookSide`, `legSide`, `skinColor`, `hairColor`) stays on this device; `hatColor` stays on this device. |
| `gearRenders(slot, id)` / `GEAR_RENDERS` | Whether a catalog id shows on the pirate. The lists only ever get new ids added at the end (append-only), because the wire code is the index. |
| `HAT_SWATCHES`, `SKIN_SWATCHES`, `HAIR_SWATCHES`, `CLOTH_SWATCHES`, `outfitColors(outfit, {skin})`, `clothColors(gear, colors)`, `PARROTS` | Colour tables (swatch lists are append-only). |
| `setBodyLook(p, {skinColor, hairColor})` | Skin + hair colour on ONE PirateGLB, without `PirateGLB.setColors`: each body mesh gets its own COLOR_0 (other attributes shared, same `ownGeo` / `baseIndex` flags as Raul's hide rules), rewritten from the baked colours for the `skin` / `hair` keys only. `applyGear` calls it. This is the hook point once Emerly's fixed setColors lands. |

## One gear system: which model draws each id
`applyGear` merges Timothy's pieces into ONE skinned mesh (+1 draw call) and, for the ids below, calls Raul's `pirateItems.equip/unequip` (+1 draw call each, his hide rules hide the hair under hats, the hand under a hook and the shin under a peg). Raul's files are not edited; `PirateGLB.setColors` is not called by gear (his items retint their own cloned geometry).

| id | slot | model | price |
|---|---|---|---|
| bandana | hat | Timothy | 150 |
| tricorn | hat | **Raul** `hat_tricorn` (better: fitted, gold trim, hides hair, lighter LOD); body takes `hatColor` | 400 |
| bicorne | hat | Timothy | 1,200 |
| crown | hat | **Raul** `crown`; velvet takes `hatColor` | 15,000 |
| tank / tshirt / coat | outfit | Timothy (ship-skin colours) | 250 / 500 / 1,000 |
| shirt | outfit | **Raul** `shirt` (white pirate blouse, not a duplicate of the striped tee); body takes the skin's 2nd colour | 300 |
| suit | outfit | **Raul** `suit` ("CAPTAIN'S COAT"); coat + accent take the skin colours | 3,000 |
| eyepatch / sunglasses / laser | eyes | Timothy | catalog |
| parrot_* (7) | parrot | Timothy (Raul's parrot is one fixed red, no palette: kept mine for the 7 colours, crest, diamond facets) | 2,000 … 100,000 |
| hook_iron | hook | **Raul** `hook_l` / `hook_r` by `hookSide` (better: chunky cuff) | 500 |
| hook_gold | hook | **Raul** `hook_l` / `hook_r` by `hookSide`, recoloured gold (cloned colours) | 2,500 |
| peg | leg (new slot) | **Raul** `peg_l` / `peg_r` by `legSide`. ON SALE (no `soon`) | 1,000 |

## Free look (not sold, saved in `pfp_captain_v1`, sent in `gr`)
- `hookSide`, `legSide`: `'L'` | `'R'` (default / old saves `'R'`). Picks Raul's left or right model. Toggle: ◀ LEFT / RIGHT ▶ in the shop's hook and peg-leg detail. Old saves with `leg: 'peg_l'` / `'peg_r'` become `peg` + that side.
- `skinColor` (0 = default, 1..12 `SKIN_SWATCHES`: porcelain, fair, light, warm, olive, tan, brown, dark, deep, ghost, zombie, deep sea) and `hairColor` (0 = default, 1..13 `HAIR_SWATCHES`: black … purple; also colours the beard). Picker: the 👤 SKIN & HAIR chip in the shop's gear tab (`openGearColorPicker({ kind: 'look' })`). There is no separate captain-creator screen on main, so the shop is the creator for now.

## Colours
- Clothes follow the ship skin: tank = cloth, t-shirt = cream with cloth stripes, coat = cloth + accent trim over a cream shirt (navy stripes on DEFAULT). They use the same per-skin colours as the deck crew (`js/crew.js` OUTFIT: coat[0] + accent; COMMODORE = navy / gold). DEFAULT (`classic`) = the NFT look.
- Hats take a free, player-picked `hatColor`: 0 = the hat's own colour (tricorn band NFT red, bicorne trim gold, bandana red), 1..12 = `HAT_SWATCHES`. It colours the bandana, the tricorn band and the bicorne trim. Pick it with `js/gearColorPicker.js openGearColorPicker()`; the HAT COLOUR button in the shop's hat detail opens it.
- Parrots have fixed colours, one catalog item each (no picker): green, red macaw, blue macaw (blue + yellow), cockatoo (white, with a separate tall yellow crest mesh), black (red cheeks), gold, and diamond (crystal facets + white glints, per-triangle shading). Hooks and eyewear keep their own colours.

## Catalog ids (all render)
hat `bandana tricorn bicorne crown` · outfit `tank tshirt coat shirt suit` · eyes `eyepatch sunglasses laser` · parrot `parrot_green parrot_red parrot_gold parrot_blue parrot_cockatoo parrot_black parrot_diamond` · hook `hook_iron hook_gold` · leg `peg`. Free defaults (`none`, `shirtless`, `plain`) draw nothing. Maps are not worn; their shop card is a rendered scroll.

## Network (`gr`, a static field in the existing PvP / harbor state)
Base-36 digits: one per slot (hat, outfit, eyes, parrot, hook, leg) = 1 + its index in `GEAR_RENDERS`, then hat colour, sides (bit 1 hook LEFT, bit 2 peg LEFT), skin colour, hair colour, clothes colour (0 = match the ship skin). Trailing zeros are dropped: shirtless = `''`, tricorn + coat + eyepatch + red macaw + gold hook = `'23122'`, + peg, both on the left, tan skin, ginger hair = `'2312210365'`, coat + purple clothes = `'03000000007'`, max = 11 chars. It is sent on join and on change, plus the transport's 3 s static refresh. Receivers decode only against `GEAR_RENDERS` and the swatch lists, so a missing field means shirtless / defaults and junk falls back to the defaults (tested: too long, bad digits, sides > 3, out-of-range colours). Clothes colours come from `sk` (already sent) unless `outfitColor` is set. Old clients ignore `gr`.

## Shop card art (`js/gearThumbs.js`)
`gearThumb(slot, id, {skin, hatColor, w, h})` returns a Promise of a PNG data URL. It renders Raul's v4 pirate wearing the item in one offscreen renderer (the same `applyGear` and `gear_hi`/`gear_lo.glb`), framed on the item. Results are cached per item, + skin for clothes, + hatColor for hats. Renders are queued one per frame, with the dress step and the draw step in separate frames. The renderer is released after 15 s idle.
- `gearThumbEl()` returns an `<img>` that shows the pre-baked PNG (`assets/pirates/thumbs/<slot>_<id>.png`, not precached) while the live render loads; Raul's 256 px icon (`assets/pirates/items/icons/`) is the next fallback for his items. The painted SVG shows only if both fail.
- `gearLive(canvas, slot, id)` is the slowly turning preview in the shop's detail pane (20-30 fps; paused while hidden).
- Re-bake the PNGs with `tools/gear_thumbs.html` + `tools/gear_bake.py`.

## Server (NOT changed: needed before the new items can be sold)
`supabase/functions/pvp/lib.ts` (v105 already sells bandana / tricorn / bicorne, tank / tshirt / coat, eyewear, green / red / gold parrots, both hooks, and keeps `hatColor`):
- `GEAR_SLOTS` must match the client copy in `js/pvpSave.js`: add `"crown"` to hat, `"shirt", "suit"` to outfit (the 4 new parrots are already there), and a NEW slot `leg: ["none", "peg"]` (cleanGear / fitEquipped default it to `none`). Until then the server strips these ids from a saved profile (the owner's too), so they show only on this device and in 'gr'.
- `SHOP_ITEMS`: `"gear:hat:crown": { price: 15000 }`, `"gear:outfit:shirt": { price: 300 }`, `"gear:outfit:suit": { price: 3000 }`, `"gear:leg:peg": { price: 1000 }`, and un-comment the 4 parrot lines when they go on sale. Ready-to-paste text (replaces `lib.ts` from the `// [v105] pirate gear` comment through the end of `GEAR_SLOTS`): `server_gear_lib_ts.SNIPPET.ts` next to the worktree. The PEG LEG is on sale in the client now (BANKSY), so until `gear:leg:peg` is in `SHOP_ITEMS` a real BUY is refused by the server (the mock shop and the owner work).
- The owner sees every item as owned and can equip it (the shop skips `soon` for the owner).
- Then drop `soon: true` from crown / shirt / suit / the 4 parrots in `js/shopCatalog.js`.
- hookSide / legSide / skinColor / hairColor need nothing on the server (free, device + 'gr').
- No migration is needed (profile gear is JSON; `leg` is just one more key cleanGear keeps).
- `server/relay.js` STATIC now includes `'gr'` (the relay build's static fields): the relay server must be redeployed for relay rooms to carry gear. Supabase Realtime rooms need nothing.
- Clothes colours: tank / t-shirt / coat / pirate shirt / captain's coat follow the equipped SHIP SKIN (change skin = change clothes colours). 
- FREE CLOTHES COLOUR (`outfitColor`, BANKSY): 0 = match the ship skin (the default, every old save), 1..12 = `CLOTH_SWATCHES` (RED CRIMSON NAVY BLUE GREEN TEAL PURPLE PINK ORANGE GOLD WHITE BLACK, append-only). It replaces the clothes' main colour (`colors.cloth`); trim / accent still come from the ship skin. Picked in the shop: any outfit except shirtless shows a 🎨 CLOTHES COLOUR button next to the hat-colour row; the picker has SHIP (= match) first and a ↺ RESET TO SHIP COLOURS button. Saved in `setLocalGear` / `getLocalGear` (additive), sent in `gr`, validated on decode, and the crew re-bake (`crewGearOf`) includes it. Shop thumbnails stay ship-skin coloured.
- The free look (`hookSide`, `legSide`, `skinColor`, `hairColor`, `outfitColor`) lives in this device's gear save + the wire; the server's `cleanGear` doesn't store it (no migration, nothing to validate server-side).

## Dev tools
`tools/gear_viewer.html?lod=&clip=&sex=&view=q|front|back|side|pq&skin=&cells=&cols=&zoom=&ly=&lx=` · `tools/gear_thumbs.html` (bake) · `tools/gear_compare.html` (Timothy vs Raul models: tris, draw calls, hi/lo). Rebuild the accessory GLBs with `tools/blender/build_gear.sh`.
