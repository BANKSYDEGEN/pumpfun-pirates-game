#!/usr/bin/env bash
# Rebuild the PUMPFUN PIRATES ship kit: Blender bake + meshopt GLBs + hi/lo textures into assets/ships/kit/
#   tools/blender/build.sh            (needs blender 4.2 on PATH or BLENDER=..., node/npx for gltfpack, python3 + Pillow)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."; OUT="${KIT_TMP:-/tmp/pfp_shipkit}"; DST="$ROOT/assets/ships/kit"
mkdir -p "$OUT" "$DST"
"${BLENDER:-blender}" -b -P "$HERE/ship_kit.py" -- "$OUT" 2>&1 | grep '^\[kit\]'
for f in player_kit player_kit_lo; do npx -y gltfpack -i "$OUT/${f}_raw.glb" -o "$DST/$f.glb" -c -noq -kn -km -kv >/dev/null; done
python3 - "$OUT" "$DST" <<'PY'
import sys
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
for n in ('hull', 'deck', 'sail'):
    for k in ('n', 'd'):
        im = Image.open(f'{src}/{n}_{k}.png').convert('RGB' if k == 'n' else 'L')
        im.save(f'{dst}/{n}_{k}.jpg', quality=88, optimize=True)                                   # High
        im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(f'{dst}/{n}_{k}_lo.jpg', quality=85, optimize=True)  # phones / Low
PY
ls -la "$DST"
