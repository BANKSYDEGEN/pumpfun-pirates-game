#!/bin/sh
# [Raul] rebuild the island town kit: trim sheet (numpy) -> Blender model + UV + bevel + AO bake -> gltf-transform (meshopt + webp)
# needs: python3 numpy scipy pillow, Blender 4.2 ($BLENDER), node with @gltf-transform/{core,extensions,functions} meshoptimizer sharp ($GLTF_NODE_DIR)
set -e
HERE=$(cd "$(dirname "$0")" && pwd); GAME=$(cd "$HERE/../.." && pwd); BUILD=${BUILD:-/tmp/island_kit_build}
BLENDER=${BLENDER:-blender}; GLTF_NODE_DIR=${GLTF_NODE_DIR:-.}
mkdir -p "$BUILD"
python3 "$HERE/trimsheet.py" "$BUILD" 2048
"$BLENDER" -b --factory-startup -P "$HERE/town_kit_blender.py" -- "$BUILD"
cp "$HERE/pack_kit.mjs" "$GLTF_NODE_DIR/" && (cd "$GLTF_NODE_DIR" && node pack_kit.mjs "$BUILD/town_kit_raw.glb" "$GAME/assets/island")
