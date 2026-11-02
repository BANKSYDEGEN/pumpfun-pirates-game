#!/usr/bin/env bash
# Rebuild the PUMPFUN PIRATES island-shop gear: Blender -> raw GLBs -> gltfpack meshopt -> assets/pirates/gear_{hi,lo}.glb
#   tools/blender/build_gear.sh [--preview]      (blender 4.2 on PATH or BLENDER=..., node/npx for gltfpack)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; OUT="${GEAR_TMP:-/tmp/pfp_gear}"; DST="$ROOT/assets/pirates"
mkdir -p "$OUT"
"${BLENDER:-blender}" -b -P "$HERE/build_gear.py" -- "$OUT" "$@" 2>&1 | grep '^\[gear\]'
for l in hi lo; do npx -y gltfpack -i "$OUT/gear_${l}_raw.glb" -o "$DST/gear_$l.glb" -c -noq -kn -km >/dev/null; done
ls -la "$DST"/gear_*.glb
