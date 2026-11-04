# PUMPFUN PIRATES shared material library

One set of tiling materials for everything built on the island town: the plaza shops, halls, tavern and stalls (plaza_shops*.glb +
plazaTown.js kit), the docks / jetties / boardwalk (docks*.glb), the cannon-hill battery (battery*.glb), the hill street (hill_street*.glb,
hill_sword_shop*, hill_musket_shop*), the HILLTOP FORT (the "castle", Post's areas/fort.js), Post's PIRATES' CLIMB (areas/route.js) and the
GATE JUNCTION at the top of the hill street (js/island/gateJunction.js).

* Source of truth: `tools/plaza_blender/materials.py` (layer order, tile metres, grain). Keep `js/island/libTex.js` `LIB` in sync.
* Textures: `assets/island/tex/lib.ktx2` (desktop 1024) / `lib_lo.ktx2` (phone 512), one 2D-array texture = one sampler, one bind for all.
  RGB = albedo detail around neutral grey (x2 in the shader), A = height (desktop derivative bump only). Rebuild:
  `python3 tools/plaza_blender/make_textures.py SRC_DIR /path/to/basisu` (SRC_DIR = the Poly Haven 1k diff + disp maps, see tex/CREDITS.md).
* GLBs: no images, no UVs. TEXCOORD_0.u = `(id * 2 + swap + 0.5) / 32` per corner (8-bit quantized), id = 1-based layer, 0 = plain colour.
  The Blender builders pick the layer per part: `Builder.AUTO` (palette colour -> layer, nearest within 0.1) or an explicit `mat='name'`.
  Grain layers (timber, planks, pilings, roof tiles, rope) get `swap` so the grain runs along each part's long axis.
  Edge wear / grime / ground contact AO are baked into the vertex colours (`lib.py Builder.bake`, `Builder.ground`).
* Runtime: `libMaterial()` patches the existing vertex-colour toon materials (same materials, same draw calls): object-space triplanar,
  sharp blend, textureGrad. Kit pieces use `aMat = 20 + id` through `look.js islandSurface`; Post's areas are re-tagged per triangle
  by palette colour after they build (`libAreaBuilt`, the 2-line hook in areas/index.js). `&plazatex=0` = off, `&gatejx=0` = no junction dressing.

| id | layer | tile (m) | grain | used for |
|---|---|---|---|---|
| 1 | stone_ashlar | 2.6 | - | shop / hill / fort walls, gate towers, cheek walls, the knoll face |
| 2 | stone_trim | 1.6 | - | quoins, plinths, modelled block faces, copings, treads, flagstones |
| 3 | brick | 1.3 | - | hill brick storeys |
| 4 | plaster | 2.4 | - | upper storeys, interiors, ceilings |
| 5 | cobble | 2.0 | - | fort courtyard |
| 6 | timber | 1.6 | yes | beams, posts, shutters, signposts, barrels |
| 7 | planks_weathered | 1.8 | yes | deck boards, floors, plank walls, crates |
| 8 | piling_wet | 1.4 | yes | dock pilings up to 1.1 m over the sea |
| 9 | roof_tile | 1.6 | yes | every roof |
| 10 | iron | 0.9 | - | hoops, lamps, cannons, bollards |
| 11 | rope | 0.4 | yes | dock ropes, coils |
| 12 | awning_cloth | 0.8 | - | awnings, stall canvas |
