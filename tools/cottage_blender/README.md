# Cottage Cabin Blender Kit

AAA cottage interiors are primarily authored in `js/dock/houses.js` (`buildInteriorRoom`)
with true `MeshStandardMaterial` PBR, ship-kit textures, PMREM cabin env, volumetric
sunbeams, and an open hammerbeam cathedral ceiling (no flat attic slab).

Optional hero-prop GLBs can be authored here later as:
- `assets/island/cottage_cabin.glb`
- `assets/island/cottage_cabin_low.glb`

`buildInteriorRoom` stays synchronous for Node tests and `&househd=0` fallbacks.
