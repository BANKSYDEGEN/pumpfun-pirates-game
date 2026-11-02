#!/bin/sh
# [Raul] rebuild the island kits (placeable GLB parts, origin at ground, positioned by code):
#   town kit:   trim sheet (numpy) -> Blender model + UV + bevel + AO bake
#   nature kit: card sheet (PIL)   -> Blender palms / jungle trees / ferns / rocks / cliffs / spires / Skull Peak + AO bake
#   -> gltf-transform (meshopt) -> NAME.glb (KTX2: ETC1S albedo/cards, UASTC normal) + NAME.webp.glb fallback, + _low variants
# needs: python3 numpy scipy pillow, Blender 4.2 ($BLENDER), node with @gltf-transform/{core,extensions,functions} meshoptimizer sharp
#        ($GLTF_NODE_DIR), KTX-Software 4.4 `ktx` on PATH ($KTX_DIR = release dir with bin/ lib/)
set -e
HERE=$(cd "$(dirname "$0")" && pwd); GAME=$(cd "$HERE/../.." && pwd); BUILD=${BUILD:-/tmp/island_kit_build}
BLENDER=${BLENDER:-blender}; GLTF_NODE_DIR=${GLTF_NODE_DIR:-.}
if [ -n "$KTX_DIR" ]; then export PATH="$KTX_DIR/bin:$PATH" LD_LIBRARY_PATH="$KTX_DIR/lib:$LD_LIBRARY_PATH"; fi
mkdir -p "$BUILD/nature"
python3 "$HERE/trimsheet.py" "$BUILD" 2048
"$BLENDER" -b --factory-startup -P "$HERE/town_kit_blender.py" -- "$BUILD"
python3 "$HERE/naturesheet.py" "$BUILD/nature"
"$BLENDER" -b --factory-startup -P "$HERE/nature_kit_blender.py" -- "$BUILD/nature"
cp "$HERE/pack_kit.mjs" "$GLTF_NODE_DIR/"
(cd "$GLTF_NODE_DIR" && node pack_kit.mjs "$BUILD/town_kit_raw.glb" "$GAME/assets/island" town_kit && node pack_kit.mjs "$BUILD/nature/nature_kit_raw.glb" "$GAME/assets/island" nature_kit --nature)
