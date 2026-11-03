# HANDOFF: battle areas + Main Street weapon shops (Timothy -> Emerly). Branch emerly/battle-areas, NOT pushed

Base: origin/main d60e6d4 (v156). sw.js is pfp-v157. Main has no WEAPON STORE since v150, and these weapons are sold from the Main Street shops below.

## What's in
- **SWORD PIT** (pad r16 at town-local 60,-86, rope ring r11) and **MUSKET RANGE** (lx -126..-82, lz -164..-124): `js/island/battleAreas.js`.
  - Runtime: `js/onfoot/battle.js`. FFA or 2v2 teams (tap the HUD chip, or G on desktop: FFA -> RED -> BLUE). No friendly fire.
  - KOs pay nothing and never reach pvp_claim_kill.
  - Fighters sync at 10 Hz (5 Hz with 3-4 fighters); everyone else stays at 1 Hz. Crew followers wait outside the gates.
- **SWORD SHOP + MUSKET SHOP:** two existing Main Street houses (lots L6 / R6), config `MAIN_ST_SHOPS`. See WEAPON_SHOPS.md.
  - Each has a door point and a placeholder sign. Timothy's GLB empties `door_swords` / `door_muskets` take over the doors.
- **Server:** `supabase/functions/pvp/lib.ts` has additive SHOP_ITEMS + GEAR_SLOTS sword/musket. Deploy with `supabase functions deploy pvp`. No SQL. NOT deployed.

## FOR RAUL: weapon ids, files and attach conventions (keep these stable; the current models are placeholders)
**Ids** (`js/onfoot/swords.js`):
- **APPEND-ONLY.** The index travels in the arena net state `ba`, and the ids are also the save / server ids `gear:sword:<id>` and `gear:musket:<id>`.
- **Swords (6, not 5):** `rusty` (free), `cutlass`, `rapier`, `bone`, `sabre_gilded`, `blade_gold`.
  If you only make 5, `rusty` can keep the placeholder, but every id must still resolve to a model.
- **Muskets (6):** `rusty` (free), `navy`, `blunder`, `dragoon`, `bone`, `blunder_gold`.

**Models today:**
- Procedural vertex-coloured geometry: `swordGeo(id)` / `musketGeo(id)` in `js/onfoot/swords.js`. There are no files yet.
- Suggested drop-in names, matching your v5 item naming:
  - `assets/pirates/items/v5/weapon_sword_<id>_hi.glb` / `_lo.glb`
  - `assets/pirates/items/v5/weapon_musket_<id>_hi.glb` / `_lo.glb`
- When they exist, the swap goes in swordGeo / musketGeo, or in `dress()` in battle.js. The hi/lo choice follows the game's LOW flag, like the clothes.

**Thumbs (shop cards):**
- Files: `assets/pirates/thumbs/weapon_sword_<id>.png` and `weapon_musket_<id>.png` (a v5 pirate holding it).
- These names are already used by islandShop.js, so overwrite them in place.

**Sword frame:**
- Origin = the centre of the grip (where the fist closes). The blade points +Y and the cutting edge faces +Z. The pommel is at -Y.
- Size in metres in the file: blade about 0.75-0.85 m, total about 1 m.
- The swing trail and hit tip are read at local (0, 0.8, 0), so keep the tip near +0.8 Y or tell me the new length.

**Sword attach:**
- Parented to the v5 bone `forearmR`. Offset -0.15 m along the bone's -X (towards the hand); the sword's +Y is rotated onto the bone's +Z.
- Scale = 0.85 / the bone's world scale, so the file stays in metres at 1:1 and the 0.85 is a gameplay size.
- Outline shell: withOutline(geo, 1.07). The material is the battle toon material with vertexColors; textures will need a material swap.

**Musket frame:**
- Origin = the butt (stock end). The barrel runs along +Z and the bore is at y +0.06. Length about 1.1-1.4 m.
- The muzzle (smoke, flash and ball start) is computed by `musketMuzzle(id)` = (0, 0.06, 0.3 + barrel length [+ 0.04 if it has a bell]).
  For GLBs, please add an empty named `muzzle` at the barrel mouth and I'll read it instead.

**Musket attach:**
- Parented to the pirate figure root, not a bone. Position (-0.13, 0.9, 0.1), scale 0.7, rotation x -0.04 / y 0.04.
- Recoil moves it back and up. The arms are posed to it (P_MUSKET).
- If you add a grip empty for the right hand (`grip_r`) and the off hand (`grip_l`), I can drive the arms to them.

## Test tools
- `tools/battle/battle_ship.py desktop|phone [store range pit 2v2]`: the in-game check. Env PLAZA=1 = the v103 plaza.
  Shots go to `screens/battle/ship/`.
- `tools/battle/feet_battle.py`: walk height vs the drawn ground on the pads, paths and shop doors.

## foot.js
`screens/FOOTJS_DIFF_FOR_RAUL.md`: guarded hooks, rebased on your foot physics. groundAt keeps moundAt and coveDeckAt.
