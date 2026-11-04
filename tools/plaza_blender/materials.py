# [Timothy] PUMPFUN PIRATES shared material library (ONE set of tiling materials for every built thing on the island: the plaza shops +
# halls + tavern + stalls, the docks / jetties / boardwalk, the cannon-hill battery, the hill street, the hilltop fort).
# Single source of truth for the layer order, tile sizes and grain; keep js/island/libTex.js LIB in sync.
#   textures: assets/island/tex/lib.ktx2 (desktop, 1024, 12-layer 2D array, Basis ETC1S + mips) + lib_lo.ktx2 (phones, 512)
#             RGB = albedo detail (graded around neutral: the vertex colour carries the hue, the texture the pattern), A = height (bump)
#   GLBs:     no textures, no UVs. Each corner carries TEXCOORD_0 = (code, 0.5): code = (id * 2 + swap + 0.5) / 32
#             id = 1-based layer below (0 = plain vertex colour), swap = 1 turns the projected texture 90 deg so its grain follows the part
#   runtime:  the toon shader projects the layer from the object-space position (dominant normal axis, sharp triplanar blend) and multiplies
#             the vertex colour; Kit-built pieces (plazaTown.js, the fort) use the same layers through aMat = 20 + id (js/island/look.js)
import math
import numpy as np
# name: tile = metres per repeat, grain = True if the texture has a direction (authored along texture u) that should follow the part's long axis
LIB = [
    ('stone_ashlar',     dict(tile=2.6, grain=False)),
    ('stone_trim',       dict(tile=1.6, grain=False)),
    ('brick',            dict(tile=1.3, grain=False)),
    ('plaster',          dict(tile=2.4, grain=False)),
    ('cobble',           dict(tile=2.0, grain=False)),
    ('timber',           dict(tile=1.6, grain=True)),
    ('planks_weathered', dict(tile=1.8, grain=True)),
    ('piling_wet',       dict(tile=1.4, grain=True)),
    ('roof_tile',        dict(tile=1.6, grain=True)),
    ('iron',             dict(tile=0.9, grain=False)),
    ('rope',             dict(tile=0.4, grain=True)),
    ('awning_cloth',     dict(tile=0.8, grain=False)),
]
NAMES = [n for n, _ in LIB]; INFO = dict(LIB)
ID = {n: i + 1 for i, n in enumerate(NAMES)}

def code(name, swap=0):
    """TEXCOORD_0.u for a library name (None / unknown = 0 = plain vertex colour)."""
    i = ID.get(name, 0)
    return (i * 2 + (1 if swap else 0) + 0.5) / 32.0

# three.js object frame = Blender (x, z, -y). The shader projects: X-plane (z, y), Y-plane (x, z), Z-plane (x, y) in three axes,
# texture u = the first. In Blender axes: normal ~x -> u = -by (horizontal), v = bz; normal ~z (top) -> u = bx, v = -by; normal ~y -> u = bx, v = bz.
_UAX = {0: 1, 1: 0, 2: 0}   # dominant Blender normal axis -> Blender axis that texture u runs along
_VAX = {0: 2, 1: 2, 2: 1}
def swap_for(name, n, axis_long):
    """1 if the texture's grain (u) should turn 90 deg on a face with Blender normal n so it runs along the part's long axis."""
    if not INFO.get(name, {}).get('grain'): return 0
    k = int(np.argmax(np.abs(n)))
    a = np.asarray(axis_long, float); a = a / (np.linalg.norm(a) + 1e-9)
    return 1 if abs(a[_VAX[k]]) > abs(a[_UAX[k]]) else 0
