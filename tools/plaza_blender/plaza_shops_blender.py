# [Timothy] PUMPFUN PIRATES plaza v2: the five STOREFRONT buildings as Blender-made models (replaces the procedural blockout shells).
#   blender -b --factory-startup -P tools/plaza_blender/plaza_shops_blender.py -- GAME_DIR OUT_DIR
# Port Royal market town: 2-3 storey ashlar stone (timber only for trim: balconies, shutters, beams, sign brackets), open shop
# fronts with dressed interiors, carved hanging signs + facade boards with the brand font, striped awnings, walk-up counters.
# The CLOTHES SHOP mannequins wear the game's REAL item GLBs (assets/pirates/..., imported read-only, texture baked to colour).
# Per shop: LOD0 (hero), LOD1 (phones / mid), LOD2 (impostor shell). Vertex colours only, 3 materials (solid / glow / glass).
# Frame: Blender x = along the street (= town-local lx), -y = towards the street (= +lz), origin = building centre at street level
# (town-local lx, FACADE_LZ - ROW_D / 2), front wall face at y = -6 (= FACADE_LZ). Placement + footprints = js/island/plazaTown.js.
import bpy, sys, os, math, json, random
import numpy as np
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Builder, T, hexc, load_item, add_item, decimate_parts, bbox_parts, text_mesh

argv = sys.argv[sys.argv.index('--') + 1:]
GAME, OUT = argv[0], argv[1]; os.makedirs(OUT, exist_ok=True)
FONT = os.path.join(GAME, 'assets/JustAnotherHand.ttf')
IT = lambda p: os.path.join(GAME, 'assets/pirates', p)
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- the shared layout (keep in sync with js/island/plazaTown.js STOREFRONTS + SHOP_SIGN) ----
SHOPS = [dict(id='shop_clothes', name='CLOTHES SHOP', w=10, fl=3, v=0, awn=0xd8322f),
         dict(id='shop_pets', name='PET STORE', w=9, fl=2, v=1, awn=0x1f8a5a),
         dict(id='shop_ships', name='SHIP SHOP', w=12, fl=3, v=2, awn=0x2a6df4),
         dict(id='shop_upgrades', name='UPGRADE SHOP', w=11, fl=2, v=3, awn=0xffc93c),
         dict(id='shop_crew', name='CREW SHOP', w=10, fl=3, v=1, awn=0x6a4fb3),
         # the WEAPON STORE moved up the hill (Emerly builds it): its slot between the tavern and the harbor tower is a plain matching
         # stone house now: no shopfront, sign, interior or trigger (door + ground-floor windows, same shell / balcony / roof)
         dict(id='house_e', name=None, w=7, fl=3, v=2, awn=0x8a1c1c, plain=True)]
D, PL, G, U, WALL = 12.0, 0.5, 5.4, 3.3, 0.5
FY = -D / 2                       # front face
OPEN_TOP, BOARD = 3.6, (4.2, 4.85)
BAL_Z = PL + G                    # balcony floor top (5.9): every sign stays below BAL_Z - 0.2 with clearance
SIGN = dict(z_bar=3.95, z0=2.85, z1=3.75, y0=FY - 0.35, y1=FY - 1.95)
STONES = [0xc9bfae, 0xb9b2a6, 0xd6c7a8, 0xbdb3a2]; QUOIN = 0x8a837a; MORTAR = 0x6f675d
ROOFS = [0xc8552e, 0xb8472a, 0xd2693a, 0xa94428]; SHUT = [0x2a6df4, 0x1f8a5a, 0xc0392b, 0x2b8fa3, 0x8a5a2b, 0x6a4fb3]
WOOD, WOOD_D, WOOD_L, IRON, GOLD, BRASS = 0xa86a3a, 0x5e3b20, 0xd9a36b, 0x2b2f36, 0xffc93c, 0xc9a243
PLASTER, FLOOR_A, FLOOR_B, CREAM = 0xf3e6c8, 0xb07a45, 0x9a6638, 0xfff1d2
GLOW = 0xffc46b
# [material library] palette -> shared library layer (materials.py; nearest within 0.1 for the jittered colours); awnings are named where built
Builder.AUTO = {**{c: 'stone_ashlar' for c in STONES}, QUOIN: 'stone_trim', MORTAR: 'stone_trim', **{c: 'roof_tile' for c in ROOFS},
                **{c: 'timber' for c in (WOOD, WOOD_D, WOOD_L, *SHUT)}, FLOOR_A: 'planks_weathered', FLOOR_B: 'planks_weathered', IRON: 'iron', PLASTER: 'plaster', CREAM: 'plaster'}

def wall_rects(x0, x1, z0, z1, holes):
    zs = sorted({z0, z1, *[h[2] for h in holes if z0 < h[2] < z1], *[h[3] for h in holes if z0 < h[3] < z1]}); out = []
    for a, b in zip(zs, zs[1:]):
        xs = [(h[0], h[1]) for h in holes if h[2] < b - 1e-6 and h[3] > a + 1e-6]; cur = x0
        for hx0, hx1 in sorted(xs):
            if hx0 > cur + 1e-6: out.append((cur, hx0, a, b))
            cur = max(cur, hx1)
        if x1 > cur + 1e-6: out.append((cur, x1, a, b))
    return out

def ashlar(b, rects, y, col, rng, rh=0.46):
    # coursed ashlar blocks (stagger by course) clipped to the wall rects; mortar = the wall box behind
    for (x0, x1, z0, z1) in rects:
        k0 = int(math.floor(z0 / rh)); k1 = int(math.ceil(z1 / rh))
        for k in range(k0, k1):
            za, zb = max(z0, k * rh), min(z1, (k + 1) * rh)
            if zb - za < 0.08: continue
            r2 = random.Random(k * 7919); x = -40 + (0.45 if k % 2 else 0)
            while x < x1:
                bw = r2.uniform(0.7, 1.15); xa, xb = max(x0, x), min(x1, x + bw)
                if xb - xa > 0.1:
                    b.box(xb - xa - 0.04, 0.07, zb - za - 0.04, (xa + xb) / 2, y - 0.035, (za + zb) / 2, hexc(col, 0.07, rng), mat='stone_trim')   # dressed block face
                x += bw

def roof(b, w, top, v, lod, rng):
    pitch, half = 0.55, D / 2 + 0.7; rise = math.tan(pitch) * half; L = half / math.cos(pitch)
    rc = ROOFS[v % 4]
    for s in (-1, 1):
        if lod == 0:
            n = int(L / 0.42)
            for i in range(n):   # overlapping tile courses (chunky barrel-tile read)
                t = (i + 0.5) / n; d = half * (1 - t); z = top + rise * t
                b.box(w + 1.0, 0.48, 0.16, 0, s * d, z + 0.12, hexc(rc, 0.08, rng), rx=-s * pitch)
                for xi in range(int(w + 1) * 2):
                    if (xi + i) % 2: continue
                    b.box(0.22, 0.44, 0.06, -w / 2 - 0.5 + 0.25 + xi * 0.5, s * d, z + 0.23, hexc(rc, 0.12, rng), rx=-s * pitch, mat='stone_trim')   # fired-clay grain on the modelled tiles
        else:
            b.box(w + 1.0, L, 0.3, 0, s * half / 2, top + rise / 2 + 0.1, rc, rx=-s * pitch)
    b.cyl(0.24, 0.24, w + 1.1, -w / 2 - 0.55, 0, top + rise + 0.08, ROOFS[(v + 1) % 4], n=6, ry=math.pi / 2)
    for sx in (-1, 1):  # stone gables
        b.prism([(-D / 2, 0), (D / 2, 0), (0, rise - 0.1)], 0.3, STONES[v % 4], T(sx * (w / 2 - 0.15) - 0.15, 0, top, rz=-math.pi / 2), mat=0)
    b.box(1.0, 1.0, 2.6, w * 0.28, D * 0.18, top + rise * 0.55, QUOIN, base=True)   # chimney + cap
    b.box(1.25, 1.25, 0.2, w * 0.28, D * 0.18, top + rise * 0.55 + 2.6, 0x6d665e, base=True)
    return rise

def window(b, x, z0, h, sh, lod, rng, lit=False, door=False):
    ww = 1.15
    b.box(ww, 0.08, h, x, FY + 0.3, z0 + h / 2, GLOW if lit else 0x22313d, mat=1 if lit else 0)       # glass, set back
    if lod < 2:
        for gx in (-0.2, 0.2): b.box(0.05, 0.05, h, x + gx * ww / 0.8 * 0.5, FY + 0.25, z0 + h / 2, WOOD_D)   # glazing bars
        b.box(ww, 0.05, 0.05, x, FY + 0.25, z0 + h * 0.55, WOOD_D)
        b.box(ww + 0.5, 0.34, 0.3, x, FY - 0.08, z0 + h + 0.15, QUOIN)                                  # lintel + keystone
        b.box(0.32, 0.4, 0.42, x, FY - 0.12, z0 + h + 0.2, hexc(STONES[1], 0.05, rng))
        if not door: b.box(ww + 0.4, 0.42, 0.14, x, FY - 0.14, z0 - 0.05, QUOIN)                      # sill
        for s in (-1, 1):   # open timber shutters (louvred)
            m = T(x + s * (ww / 2 + 0.05), FY - 0.06, z0, rz=s * 0.5)
            b.push(m); b.box(0.6, 0.07, h, s * 0.3, -0.04, h / 2, sh, tag='shutter')
            if lod == 0:
                for i in range(int(h / 0.22)): b.box(0.5, 0.05, 0.04, s * 0.3, -0.09, 0.15 + i * 0.22, hexc(sh, 0.15, rng))
            b.pop()
        if not door and lod == 0:  # flower box
            b.box(ww + 0.2, 0.3, 0.26, x, FY - 0.35, z0 - 0.02, WOOD_D)
            for i in range(5): b.sphere(0.14, x - 0.48 + i * 0.24, FY - 0.36, z0 + 0.2, [0xd8322f, 0xffd43b, 0x3fca45, 0xf2efe6, 0xff7ab5][i], sub=0)

def carve(b, text, cx, cy, cz, wfit, hfit, face, lod, deep=True):
    # raised gold letters on a sign face; face = rotation matrix taking text +z (normal) to the face's outward normal
    V, F, _ = text_mesh(text, FONT, size=1.0, extrude=0.025 if lod == 0 and deep else 0.0, res=2 if lod == 0 else 1)
    if lod or not deep: V = V + [0, 0, 0.012]   # LOD1: flat letters a hair off the board
    mn, mx = V.min(0), V.max(0); s = min(wfit / (mx[0] - mn[0]), hfit / (mx[1] - mn[1]))
    V = (V - [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]) * [s, s, 1]
    b.mesh(V, F, GOLD, m=Matrix.Translation((cx, cy, cz)) @ face, smooth=False)

def signs(b, sh, lod, rng):
    w = sh['w']; bw = w * 0.62; z0, z1 = BOARD
    # facade name board over the shop arch (below the balcony line)
    b.box(bw, 0.12, z1 - z0, 0, FY - 0.08, (z0 + z1) / 2, 0x5a3219, tag='sign')
    if lod < 2:
        for zz in (z0 + 0.04, z1 - 0.04): b.box(bw + 0.1, 0.16, 0.08, 0, FY - 0.1, zz, WOOD_D, tag='sign')
        for xx in (-bw / 2, bw / 2): b.box(0.08, 0.16, z1 - z0, xx, FY - 0.1, (z0 + z1) / 2, WOOD_D, tag='sign')
        carve(b, sh['name'], 0, FY - 0.14, (z0 + z1) / 2, bw - 0.5, (z1 - z0) * 0.7, Matrix.Rotation(math.pi / 2, 4, 'X'), lod)
    # carved hanging sign on an iron bracket beside the arch, perpendicular to the facade, under the balcony
    xs = w / 2 - 0.45; S = SIGN
    b.box(0.08, S['y0'] - S['y1'] + 0.4, 0.08, xs, (S['y0'] + S['y1']) / 2 - 0.2 + 0.2, S['z_bar'], IRON, tag='sign')     # bar
    b.box(0.06, 0.06, 1.0, xs, FY - 0.45, S['z_bar'] - 0.35, IRON, rx=0.85, tag='sign')                                   # strut
    b.box(0.3, 0.06, 0.3, xs, FY - 0.03, S['z_bar'] - 0.3, IRON, tag='sign')                                              # wall plate
    for yy in (S['y0'] + 0.15, S['y1'] - 0.15): b.box(0.04, 0.04, S['z_bar'] - S['z1'], xs, yy, (S['z_bar'] + S['z1']) / 2, IRON, tag='sign')
    b.box(0.14, S['y0'] - S['y1'], S['z1'] - S['z0'], xs, (S['y0'] + S['y1']) / 2, (S['z0'] + S['z1']) / 2, 0x5a3219, tag='sign')
    if lod < 2:
        b.box(0.18, S['y0'] - S['y1'] + 0.08, 0.08, xs, (S['y0'] + S['y1']) / 2, S['z1'], WOOD_D, tag='sign')
        b.box(0.18, S['y0'] - S['y1'] + 0.08, 0.08, xs, (S['y0'] + S['y1']) / 2, S['z0'], WOOD_D, tag='sign')
        for s in (-1, 1):
            face = Matrix.Rotation(s * math.pi / 2, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'X')
            # text normal: +x for s=-1?  Rz(s*90)@Rx(90): z->-y->(s=1: +x ; s=-1: -x)
            carve(b, sh['name'], xs + s * 0.07, (S['y0'] + S['y1']) / 2, (S['z0'] + S['z1']) / 2, S['y0'] - S['y1'] - 0.3, (S['z1'] - S['z0']) * 0.62, face, lod, deep=False)

def shell(b, sh, lod, rng):
    w, fl, v = sh['w'], sh['fl'], sh['v']; col = STONES[v % 4]; shut = SHUT[(v + 2) % 6]
    top = PL + G + (fl - 1) * U; ow = min(w * 0.66, w - 2.6)
    b.box(w + 0.6, D + 0.6, 0.8, 0, 0, -0.3, QUOIN, base=True)                                             # plinth
    # rear mass + side walls + back wall of the shop room + upper storeys (hidden faces are cheap boxes)
    b.box(w, D / 2 - 1.0, G, 0, 1.0 + (D / 2 - 1.0) / 2, PL, col, base=True)
    for s in (-1, 1): b.box(WALL, 7.0, G, s * (w / 2 - WALL / 2), FY + 3.5, PL, col, base=True)
    b.box(w, D - WALL, top - (PL + G), 0, WALL / 2, PL + G, col, base=True)
    # front wall with the shop arch + upper windows
    plain = sh.get('plain')
    holes = [(-ow / 2, ow / 2, PL, OPEN_TOP)] if not plain else []; wins = []
    if plain:   # plain house: a plank door in the middle + one shuttered window each side on the ground floor
        holes.append((-0.65, 0.65, PL, PL + 2.6)); wins.append((0, PL, 2.6, True, 0))
        for sx in (-1, 1): x = sx * (w / 4 + 0.35); holes.append((x - 0.6, x + 0.6, PL + 1.0, PL + 2.6)); wins.append((x, PL + 1.0, 1.6, False, 0))
    nw = max(2, int(w // 3.2))
    for f in range(1, fl):
        z0 = PL + G + (f - 1) * U
        for i in range(nw):
            x = (i - (nw - 1) / 2) * (w / nw); door = f == 1
            zb = z0 + (0.0 if door else 0.9); h = 2.5 if door else 1.6
            holes.append((x - 0.6, x + 0.6, zb, zb + h)); wins.append((x, zb, h, door, f))
    rects = wall_rects(-w / 2, w / 2, PL, top, holes)
    for r in rects: b.box(r[1] - r[0], WALL, r[3] - r[2], (r[0] + r[1]) / 2, FY + WALL / 2, (r[2] + r[3]) / 2, MORTAR if lod == 0 else col)
    if lod == 0: ashlar(b, rects, FY, col, rng)
    if lod < 2:
        for f in range(fl):  # string courses + corner quoins
            z = PL + G + f * U if f < fl - 1 else top
            b.box(w + 0.36, 0.36, 0.28, 0, FY - 0.05, z - 0.02, QUOIN)
        zq = PL
        while zq < top - 0.3:
            for s in (-1, 1): b.box(0.9 if int(zq / 0.6) % 2 else 0.6, 0.62, 0.56, s * (w / 2 - 0.2), FY + 0.2, zq + 0.29, hexc(QUOIN, 0.05, rng))
            zq += 0.6
        # arch: voussoirs fanned over the opening + keystone, stone jambs
        n = 9 if not plain else 0
        for i in range(n):
            t = (i + 0.5) / n; x = -ow / 2 - 0.2 + t * (ow + 0.4); a = (t - 0.5) * 0.7
            b.box((ow + 0.4) / n - 0.04, 0.4, 0.5 if i != n // 2 else 0.68, x, FY - 0.12, OPEN_TOP + 0.24 + (0.06 if i == n // 2 else 0), hexc(QUOIN if i != n // 2 else STONES[2], 0.05, rng), ry=a * 0.3)
        for s in (-1, 1):
            if not plain: b.box(0.5, 0.4, OPEN_TOP - PL, s * (ow / 2 + 0.25), FY - 0.1, PL, QUOIN, base=True)
        if plain: b.box(1.9, 0.5, 0.3, 0, FY - 0.05, PL + 2.75, QUOIN); b.box(1.8, 0.5, 0.16, 0, FY - 0.25, PL - 0.08 + 0.08, QUOIN)   # door lintel + step
        b.box(w + 0.5, 0.6, 0.35, 0, FY + 0.1, top + 0.1, QUOIN)                                         # cornice
        for i in range(int(w / 0.9)): b.box(0.22, 0.4, 0.25, -w / 2 + 0.45 + i * 0.9, FY - 0.18, top - 0.2, WOOD_D)  # eave corbels
    for (x, zb, h, door, f) in wins: window(b, x, zb, h, shut, lod, rng, lit=(f + int(x * 3)) % 3 == 0 and not door, door=door)
    # timber balcony on the first upper floor (balcony floor top BAL_Z)
    if fl > 1:
        bwid = w - 1.4; dep = 1.3
        b.box(bwid, dep, 0.2, 0, FY - dep / 2, BAL_Z - 0.2, WOOD, base=True, tag='balcony')
        b.box(bwid, 0.12, 0.12, 0, FY - dep + 0.06, BAL_Z + 1.0, WOOD_D, tag='rail')
        if lod < 2:
            nb = int(bwid / (0.28 if lod == 0 else 0.7))
            for i in range(nb + 1): b.box(0.08, 0.08, 1.0, -bwid / 2 + i * bwid / nb, FY - dep + 0.06, BAL_Z, WOOD_L, base=True, tag='rail')
            for s in (-1, 1):
                b.box(0.12, 0.12, 1.0, s * (bwid / 2), FY - dep / 2, BAL_Z, WOOD_D, base=True, tag='rail')
                b.box(0.12, dep, 0.12, s * (bwid / 2), FY - dep / 2, BAL_Z + 1.0, WOOD_D, tag='rail')
                b.box(0.18, 0.18, 1.3, s * (w * 0.31 + 0.35), FY - 0.5, BAL_Z - 0.62, WOOD_D, rx=-0.75, tag='balcony')   # knee braces (clear of the name board)
    rise = roof(b, w, top, v, lod, rng)
    return ow, top, rise

def shopfront(b, sh, lod, rng, ow):
    w = sh['w']; awn = sh['awn']
    # room: plank floor, plaster walls, ceiling beams, hanging lanterns
    iw = w - 2 * WALL
    if lod < 2:
        nfl = int(iw / 0.3)
        for i in range(nfl): b.box(iw / nfl - 0.01, 6.6, 0.06, -iw / 2 + (i + 0.5) * iw / nfl, FY + WALL + 3.3, PL, FLOOR_A if i % 2 else FLOOR_B, base=True)
        b.box(iw, 0.04, G - 0.3, 0, 0.98, PL, PLASTER, base=True)
        for s in (-1, 1): b.box(0.04, 6.6, G - 0.3, s * (iw / 2 - 0.02), FY + WALL + 3.3, PL, PLASTER, base=True)
        b.box(iw, 6.6, 0.1, 0, FY + WALL + 3.3, PL + G - 0.3, 0xe8d8b8, base=True)
        for i in range(4): b.box(0.22, 6.6, 0.26, -iw / 2 + (i + 0.5) * iw / 4, FY + WALL + 3.3, PL + G - 0.5, WOOD_D, base=True)
        for x in (-iw / 4, iw / 4):
            b.cyl(0.015, 0.015, 0.9, x, -2.6, PL + G - 1.2, IRON, n=4)
            b.box(0.34, 0.34, 0.06, x, -2.6, PL + G - 1.55, IRON); b.box(0.26, 0.26, 0.36, x, -2.6, PL + G - 1.35, GLOW, mat=1)
            b.box(0.34, 0.34, 0.06, x, -2.6, PL + G - 1.15, IRON)
    else:
        b.box(ow, 0.05, OPEN_TOP - PL, 0, FY + 2.5, PL, 0x6b4a2c, base=True)                      # impostor: dim room plane
    # walk-up counter (js plazaTown: x +-w*0.3, lz FACADE+0.3..+1.7 -> y FY-0.3..-1.7), top 1.1 + 0.14
    b.box(w * 0.6, 1.0, 1.1, 0, FY - 1.0, 0, WOOD, base=True)
    b.box(w * 0.6 + 0.3, 1.25, 0.14, 0, FY - 1.0, 1.1, WOOD_L, base=True)
    if lod == 0:
        for i in range(int(w * 0.6 / 0.6)): b.box(0.05, 0.03, 0.9, -w * 0.3 + 0.3 + i * 0.6, FY - 1.51, 0.1, WOOD_D, base=True)
    # striped canvas awning on timber posts (posts at x +-w*0.33, y FY-2.5), scalloped valance
    aw = w * 0.72; ang = math.atan2(0.7, 2.8); L = math.hypot(2.8, 0.7); ns = 8 if lod < 2 else 1
    for i in range(ns):
        x = -aw / 2 + (i + 0.5) * aw / ns
        b.box(aw / ns + 0.002, L, 0.08, x, FY - 1.4, 3.2, awn if i % 2 == 0 or lod == 2 else 0xf2efe6, rx=ang, tag='awning', mat='awning_cloth')
        if lod < 2:
            b.prism([(-aw / ns / 2, 0), (aw / ns / 2, 0), (0, -0.4)], 0.04, awn if i % 2 == 0 else 0xf2efe6, T(x, FY - 2.82, 2.86) @ T(s=(1, 1, 0.7)), mat='awning_cloth')
    for s in (-1, 1):
        b.box(0.22, 0.22, 2.95, s * w * 0.33, FY - 2.5, 0, WOOD_D, base=True, tag='awning')
        if lod < 2: b.box(0.3, 0.3, 0.2, s * w * 0.33, FY - 2.5, 0, QUOIN, base=True)
    b.box(aw, 0.1, 0.1, 0, FY - 2.5, 2.95, WOOD_D, tag='awning')
    # wall lanterns either side of the arch (iron + glow glass)
    if lod < 2:
        for s in (-1, 1):
            x = s * (ow / 2 + 0.25)
            b.box(0.05, 0.4, 0.05, x, FY - 0.45, 3.0, IRON); b.box(0.28, 0.28, 0.06, x, FY - 0.6, 2.62, IRON)
            b.box(0.22, 0.22, 0.32, x, FY - 0.6, 2.8, GLOW, mat=1); b.box(0.3, 0.3, 0.08, x, FY - 0.6, 3.0, IRON)

def market_props(b, sh, lod, rng, cols):
    # sidewalk goods left of the counter (circle colliders, town-local units)
    w = sh['w']; x = -(w / 2 - 0.8); y = FY - 0.75
    barrel(b, x, y, 0, lod); cols.append(['c', x, -y, 0.6])
    crate(b, x + 0.05, y - 1.05, 0, 0.8, lod, rng); cols.append(['c', x + 0.05, -(y - 1.05), 0.6])
    if lod == 0: crate(b, x + 0.05, y - 1.05, 0.8, 0.6, lod, rng, rz=0.4)

def barrel(b, x, y, z, lod, s=1.0, col=0x8a5a2b):
    n = 12 if lod == 0 else 7; h = 1.1 * s; r = 0.42 * s
    b.cyl(r * 0.85, r, h / 2, x, y, z, col, n=n); b.cyl(r, r * 0.85, h / 2, x, y, z + h / 2, col, n=n)
    if lod == 0:
        for zz in (0.12, 0.5, 0.88): b.cyl(r * (1.0 if zz == 0.5 else 0.93) + 0.015, r * (1.0 if zz == 0.5 else 0.93) + 0.015, 0.06, x, y, z + zz * h, IRON, n=n, caps=False)

def crate(b, x, y, z, s, lod, rng, rz=0.0, col=WOOD_L):
    b.box(s, s, s, x, y, z, hexc(col, 0.08, rng), rz=rz, base=True)
    if lod == 0:
        b.push(T(x, y, z, rz=rz))
        for sy in (-1, 1):
            b.box(s + 0.02, 0.03, 0.08, 0, sy * s / 2, 0.06, WOOD_D, base=True); b.box(s + 0.02, 0.03, 0.08, 0, sy * s / 2, s - 0.14, WOOD_D, base=True)
            b.box(s * 1.25, 0.03, 0.07, 0, sy * s / 2, s / 2, WOOD_D, ry=0.78)
        b.pop()

# ---------------- interiors ----------------
FLOOR = PL + 0.06
def place(parts, x, y, z, s=1.0, rz=0.0):
    mn, mx = bbox_parts(parts); c = (mn + mx) / 2
    return T(x, y, z, rz=rz) @ T(s=s) @ Matrix.Translation((-c[0], -c[1], -mn[2]))

def items_for(lod):
    # LOD0 keeps ~55 % of the item lo meshes (they are seen through a shop arch, never closer than ~4 m), LOD1 the given ratio
    def q(p, want=None, dec=None, pose=0.0):
        r = (0.45 if lod == 0 else min(dec, 0.18)) if dec else None
        return decimate_parts(load_item(IT(p), want, pose=pose), r) if r and r < 1 else load_item(IT(p), want, pose=pose)
    return q

def mannequin(b, q, x, y, body, wear, lod, rz=0.0, S=1.3):
    # pirate-shaped wooden mannequin on a stand, wearing real item GLBs (same bind pose as the body = they fit as in game)
    b.cyl(0.32, 0.36, 0.08, x, y, FLOOR, WOOD_D, n=12 if lod == 0 else 8)
    b.cyl(0.035, 0.035, 0.75, x, y, FLOOR, BRASS, n=6)
    m = T(x, y, FLOOR + 0.08 + 0.06 * S, rz=rz) @ T(s=S)
    pose = 0.0 if 'v5' not in body else 68.0     # v5: arms down (A-pose); the v4 captain's-coat form keeps its bind pose
    add_item(b, q(body, ('body',), 0.3, pose), m, mono=hexc(0xe2c79a))
    for p, tint in wear:
        add_item(b, q(p, None, 0.35, pose), m, tint=tint)

def clothes(b, sh, lod, rng):
    q = items_for(lod); w = sh['w']; iw = w - 2 * WALL
    # window line: 3 dressed mannequins facing the street
    mannequin(b, q, -2.6, -4.6, 'pirate_male_v5_lo.glb', [('items/v5/cloth_base_male_lo.glb', None), ('items/v5/cloth_shirt_male_lo.glb', 0xf4efe4), ('items/v5/hat_tricorn_male_lo.glb', 0x3a2a22)], lod, rz=0.25)
    mannequin(b, q, 0.0, -4.3, 'pirate_female_v5_lo.glb', [('items/v5/cloth_base_female_lo.glb', None), ('items/v5/cloth_shirt_female_lo.glb', 0xff9a9a), ('items/v5/crown_female_lo.glb', None)], lod)
    mannequin(b, q, 2.6, -4.6, 'pirate_male_v5_lo.glb', [('items/v5/cloth_base_male_lo.glb', None), ('items/v5/cloth_tshirt_male_lo.glb', 0x2a6df4), ('items/v5/hat_bicorne_male_lo.glb', 0x1c1c24)], lod, rz=-0.25)
    # the CAPTAIN'S COAT on a v4-bodied mannequin at the back
    mannequin(b, q, 1.4, -1.2, 'pirate_male_lo.glb', [('items/item_suit_male_lo.glb', 0x8a1c1c), ('items/item_hat_tricorn_lo.glb', 0x2a1d16)], lod, rz=-0.3)
    # hat stand with real hats
    hx, hy = -3.2, -1.6
    b.cyl(0.28, 0.3, 0.06, hx, hy, FLOOR, WOOD_D, n=10); b.cyl(0.05, 0.05, 2.0, hx, hy, FLOOR, WOOD_D, n=8)
    for i, (p, tint) in enumerate([('items/v5/hat_tricorn_male_lo.glb', 0x6a2a1c), ('items/v5/hat_bicorne_male_lo.glb', 0x1f2a4a), ('items/v5/hat_bandana_male_lo.glb', 0xd8322f), ('items/v5/helmet_hq_male_lo.glb', None)]):
        a = i * math.pi / 2 + 0.4; px, py, pz = hx + math.cos(a) * 0.42, hy + math.sin(a) * 0.42, FLOOR + 1.35 + (i % 2) * 0.45
        b.box(0.42, 0.04, 0.04, hx + math.cos(a) * 0.21, hy + math.sin(a) * 0.21, pz - 0.03, WOOD_D, rz=a)
        if lod < 2:
            parts = q(p, None, 0.3); add_item(b, parts, place(parts, px, py, pz, 0.9, rz=-a + math.pi / 2), tint=tint)
    # clothes rail along the left wall with hanging shirts
    if True:
        rx0, rx1, ry = -iw / 2 + 0.5, -iw / 2 + 0.5, 0.0
        for yy in (-2.9, 0.2): b.box(0.06, 0.06, 1.9, -iw / 2 + 0.55, yy, FLOOR, IRON, base=True)
        b.box(0.05, 3.1, 0.05, -iw / 2 + 0.55, -1.35, FLOOR + 1.88, IRON)
        tints = [0xd8322f, 0x2a6df4, 0xffd43b, 0x1f8a5a, 0xffffff, 0x6a4fb3]
        sp = q('items/v5/cloth_shirt_male_lo.glb', None, 0.25) if lod == 0 else q('items/v5/cloth_tank_male_lo.glb', None, 0.2)
        n = 6 if lod == 0 else 3
        for i in range(n):
            yy = -2.7 + i * 2.8 / (n - 1)
            mn, mx = bbox_parts(sp); m = T(-iw / 2 + 0.55, yy, FLOOR + 1.86, rz=math.pi / 2) @ T(s=1.15) @ Matrix.Translation((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mx[2]))
            add_item(b, sp, m, tint=tints[i % 6], lift=1.15)
            b.box(0.02, 0.5, 0.02, -iw / 2 + 0.55, yy, FLOOR + 1.86, BRASS, rx=0)
    # tall mirror on the right wall + folded cloth on a table
    b.box(0.08, 1.0, 2.1, iw / 2 - 0.06, -0.4, FLOOR, 0xc9a243, base=True)
    b.box(0.04, 0.82, 1.9, iw / 2 - 0.11, -0.4, FLOOR + 0.1, 0xc6dbe6, base=True, mat=1 if lod < 2 else 0)
    b.box(1.8, 0.9, 0.08, 3.0, -2.5, FLOOR + 0.82, WOOD, base=True)
    for sx in (-0.8, 0.8):
        for sy in (-0.35, 0.35): b.box(0.08, 0.08, 0.82, 3.0 + sx, -2.5 + sy, FLOOR, WOOD_D, base=True)
    if lod < 2:
        for i, c in enumerate([0xd8322f, 0x2a6df4, 0xf2efe6, 0x1f8a5a, 0xffd43b, 0x6a4fb3]):
            for k in range(3 if lod == 0 else 1): b.box(0.5, 0.4, 0.09, 2.45 + (i % 3) * 0.55, -2.7 + (i // 3) * 0.45, FLOOR + 0.9 + k * 0.095, hexc(c, 0.06, rng), base=True, rz=rng.uniform(-0.08, 0.08))
    # counter: an eyepatch-free hat box + a tricorn on display
    parts = q('items/v5/hat_tricorn_male_lo.glb', None, 0.3); add_item(b, parts, place(parts, -1.4, FY - 1.0, 1.24, 0.85, rz=0.3), tint=0x2a4a2a)
    b.box(0.6, 0.5, 0.35, 1.5, FY - 1.0, 1.24, 0xd8322f, base=True); b.box(0.64, 0.54, 0.06, 1.5, FY - 1.0, 1.59, 0xf2efe6, base=True)

def parrot(b, q, x, y, z, s, lod, perm=None, rz=0.0):
    parts = q('items/item_parrot_lo.glb', ('parrot',))
    if perm:
        parts = [(V, F, [[np.array(c)[list(perm)] for c in f] for f in cc]) for V, F, cc in parts]
    add_item(b, parts, place(parts, x, y, z, s, rz=rz))

def cage(b, x, y, zb, r, h, lod, hang_to=None, q=None, bird=None):
    n = 14 if lod == 0 else 8
    b.cyl(r + 0.03, r + 0.03, 0.08, x, y, zb, BRASS, n=16)                                        # base tray
    b.torus(r, 0.022, x, y, zb + 0.1, BRASS, n=16, m_=5)
    hs = h * 0.6
    for i in range(n):
        a = 2 * math.pi * i / n; cx, cy = math.cos(a), math.sin(a)
        b.cyl(0.011, 0.011, hs, x + cx * r, y + cy * r, zb + 0.08, BRASS, n=4, caps=False)
        segs = 4 if lod == 0 else 2; pr = (r, zb + 0.08 + hs)
        for k in range(1, segs + 1):       # dome bars
            t = k / segs * math.pi / 2; rr, zz = r * math.cos(t), zb + 0.08 + hs + (h - hs) * math.sin(t)
            p0 = Vector((x + cx * pr[0], y + cy * pr[0], pr[1])); p1 = Vector((x + cx * rr, y + cy * rr, zz)); d = p1 - p0
            q_ = d.to_track_quat('Z', 'Y').to_matrix().to_4x4(); b.mesh(*_bar(0.011, d.length), BRASS, m=Matrix.Translation(p0) @ q_, smooth=True)
            pr = (rr, zz)
    b.torus(r, 0.02, x, y, zb + 0.08 + hs, BRASS, n=16, m_=4)
    b.torus(0.07, 0.015, x, y, zb + h + 0.06, BRASS, n=10, m_=4, rx=math.pi / 2)                  # top ring
    b.cyl(0.006, 0.006, r * 1.9, x - r * 0.95, y, zb + 0.35, WOOD_L, n=4, ry=math.pi / 2)          # perch
    if hang_to is not None:                                                                       # chain to a ceiling hook
        z = zb + h + 0.13
        while z < hang_to:
            b.torus(0.03, 0.008, x, y, z, IRON, n=6, m_=3, rx=math.pi / 2 if int(z / 0.06) % 2 else 0, rz=0); z += 0.06
    if bird: parrot(b, q, x, y, zb + 0.36, bird[0], lod, perm=bird[1], rz=bird[2])

def _bar(rad, L, n=4):
    V = [(math.cos(2 * math.pi * i / n) * rad, math.sin(2 * math.pi * i / n) * rad, 0) for i in range(n)] + [(math.cos(2 * math.pi * i / n) * rad, math.sin(2 * math.pi * i / n) * rad, L) for i in range(n)]
    return V, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]

def pets(b, sh, lod, rng):
    q = items_for(lod); w = sh['w']; iw = w - 2 * WALL; ceil = PL + G - 0.3
    # the hero: a big hanging brass bird cage in the arch with a parrot inside
    cage(b, -0.9, -4.4, 2.15, 0.48, 1.05, lod, hang_to=ceil, q=q, bird=(0.95, None, 0.3))
    # standing cage + T-perches with more parrots (blue / green colourways of the same model)
    b.cyl(0.25, 0.3, 0.06, 2.3, -2.3, FLOOR, WOOD_D, n=10); b.cyl(0.04, 0.04, 1.3, 2.3, -2.3, FLOOR, BRASS, n=6)
    cage(b, 2.3, -2.3, FLOOR + 1.3, 0.36, 0.8, lod, q=q, bird=(0.75, (2, 1, 0), -0.4))
    for i, (px, py, perm) in enumerate([(1.6, -4.5, (1, 0, 2)), (-3.0, -2.0, (2, 1, 0))]):
        b.cyl(0.24, 0.28, 0.06, px, py, FLOOR, WOOD_D, n=10); b.cyl(0.04, 0.045, 1.45, px, py, FLOOR, WOOD, n=6)
        b.cyl(0.03, 0.03, 0.7, px - 0.35, py, FLOOR + 1.45, WOOD, n=6, ry=math.pi / 2)
        parrot(b, q, px - 0.18, py, FLOOR + 1.47, 0.85, lod, perm=perm, rz=0.2 * (i * 2 - 1))
        if lod == 0: b.cyl(0.08, 0.06, 0.05, px + 0.25, py, FLOOR + 1.47, 0xd9c39a, n=8)
    # crates, feed sack, seed bowls, fish barrel, wall shelf with seed jars
    crate(b, -3.0, -0.4, FLOOR, 0.9, lod, rng, rz=0.2); crate(b, -2.9, -0.5, FLOOR + 0.9, 0.7, lod, rng, rz=-0.1)
    b.cyl(0.38, 0.33, 0.75, 0.6, -0.6, FLOOR, 0xd9c39a, n=10 if lod == 0 else 6); b.sphere(0.3, 0.6, -0.6, FLOOR + 0.78, 0xd9c39a, sub=1, s=(1.1, 1.1, 0.5))
    b.box(0.45, 0.02, 0.3, 0.6, -0.97, FLOOR + 0.35, 0x8a2a1f, base=True)
    if lod < 2:
        barrel(b, -1.9, -0.6, FLOOR, lod, 0.8)
        for i in range(3): b.sphere(0.12, -1.95 + (i - 1) * 0.15, -0.6, FLOOR + 0.9, 0x9fb7c9, sub=0, s=(1.6, 0.6, 0.6))
        b.box(iw - 1.0, 0.35, 0.06, 0, 0.75, FLOOR + 1.8, WOOD, base=True)
        for i in range(int((iw - 1.2) / 0.5)):
            b.cyl(0.12, 0.12, 0.3, -iw / 2 + 0.8 + i * 0.5, 0.75, FLOOR + 1.86, [0xc9e0e8, 0xe8d7a8, 0xd8c9e8][i % 3], n=8)
        for i in range(4): b.cyl(0.18, 0.12, 0.08, -0.5 + i * 0.5, FY - 1.0, 1.24, 0x8a5a2b, n=8)
    b.cyl(0.1, 0.1, 0.05, -2.0, -4.0, FLOOR, 0x8a5a2b, n=8)

# ---- a stylised galleon (matches the game's ship read: dark hull, gold stripe, cream sails, black gun ports) ----
def galleon(b, m, L, hull=0x5e3b20, sail=0xf2ead6, trim=GOLD, flag=0xd8322f, lod=0):
    b.push(m)
    B = L * 0.26; Hh = L * 0.2; ns = 9 if lod == 0 else 5
    secs = []
    for i in range(ns):
        t = i / (ns - 1); y = -L / 2 + t * L
        hb = B / 2 * (math.sin(math.pi * (0.08 + 0.84 * t)) ** 0.45) * (0.75 + 0.25 * (1 - t)) + 0.01
        sheer = Hh * (0.55 + 0.45 * (1 - t) ** 3 + 0.25 * t ** 3); keel = -Hh * 0.45 * (math.sin(math.pi * t) ** 0.4)
        secs.append([(-hb, y, sheer), (-hb * 0.98, y, sheer * 0.4), (-hb * 0.7, y, keel * 0.7), (0, y, keel), (hb * 0.7, y, keel * 0.7), (hb * 0.98, y, sheer * 0.4), (hb, y, sheer)])
    V = [p for s in secs for p in s]; F = []; k = 7
    for i in range(ns - 1):
        for j in range(k - 1): F.append((i * k + j, (i + 1) * k + j, (i + 1) * k + j + 1, i * k + j + 1))
    F.append(tuple(range(k - 1, -1, -1))); F.append(tuple((ns - 1) * k + j for j in range(k)))
    b.mesh(V, F, hull, smooth=False)
    # deck, gold stripe, gun ports, castles
    for i in range(ns - 1):
        s0, s1 = secs[i], secs[i + 1]; dz = min(s0[0][2], s1[0][2]) - L * 0.01
        b.box(abs(s0[0][0]) * 2 * 0.95, L / (ns - 1), L * 0.01, 0, (s0[0][1] + s1[0][1]) / 2, dz, 0xb8875a)
        for sx in (-1, 1):
            b.box(L * 0.008, L / (ns - 1) * 1.02, L * 0.018, sx * (abs(s0[1][0]) + abs(s1[1][0])) / 2 * 1.01, (s0[0][1] + s1[0][1]) / 2, (s0[1][2] + s1[1][2]) / 2 + Hh * 0.18, trim)
            if lod == 0 and 0 < i < ns - 2: b.box(L * 0.01, L * 0.03, L * 0.025, sx * (abs(s0[1][0]) + abs(s1[1][0])) / 2 * 1.02, (s0[0][1] + s1[0][1]) / 2, (s0[1][2] + s1[1][2]) / 2 + Hh * 0.05, 0x161616)
    b.box(B * 0.8, L * 0.2, Hh * 0.35, 0, L * 0.38, Hh * 1.05, hull, base=True)          # stern castle
    b.box(B * 0.84, L * 0.02, Hh * 0.1, 0, L * 0.48, Hh * 1.3, trim)
    b.box(B * 0.6, L * 0.12, Hh * 0.2, 0, -L * 0.38, Hh * 0.9, hull, base=True)          # forecastle
    b.cyl(L * 0.008, L * 0.006, L * 0.35, 0, -L * 0.5, Hh * 0.8, 0x3a2414, n=5, rx=-1.2)  # bowsprit (towards -y)
    for my, mh in ((-0.25, 0.75), (0.02, 0.95), (0.3, 0.7)):                                   # masts, yards, sails
        y0 = my * L; b.cyl(L * 0.012, L * 0.008, L * mh, 0, y0, Hh * 0.6, 0x3a2414, n=6)
        for k2, (zf, wf) in enumerate(((0.45, 0.62), (0.75, 0.48))):
            z = Hh * 0.6 + L * mh * zf; sw = L * wf * 0.62; sh_ = L * mh * 0.26
            b.cyl(L * 0.005, L * 0.005, sw * 1.1, -sw * 0.55, y0, z + sh_ / 2, 0x3a2414, n=4, ry=math.pi / 2)
            nb = 3 if lod == 0 else 1
            for j in range(nb):   # bellied sail: 3 bent strips
                t = (j + 0.5) / nb; bel = math.sin(math.pi * t) * L * 0.025
                b.box(sw, L * 0.004, sh_ / nb + 0.001, 0, y0 - bel - L * 0.01, z + sh_ / 2 - t * sh_, sail)
        if lod == 0: b.box(L * 0.002, L * 0.06, L * 0.035, 0, y0 + L * 0.03, Hh * 0.6 + L * mh + L * 0.02, flag)
    b.pop()

def ships(b, sh, lod, rng):
    w = sh['w']; iw = w - 2 * WALL
    # glass display case on a table: the big galleon
    for cx, L, hc, sc in ((-2.2, 1.7, 0x5e3b20, 0xf2ead6), (2.0, 1.4, 0x1c1c22, 0x2a2a30)):
        b.box(2.2, 1.0, 0.85, cx, -3.6, FLOOR, WOOD_D, base=True)
        b.box(2.3, 1.1, 0.08, cx, -3.6, FLOOR + 0.85, WOOD_L, base=True)
        for sx in (-1.1, 1.1):
            for sy in (-0.5, 0.5): b.box(0.05, 0.05, 1.35, cx + sx, -3.6 + sy, FLOOR + 0.93, BRASS, base=True)
        b.box(2.25, 1.05, 0.05, cx, -3.6, FLOOR + 2.28, BRASS, base=True)
        b.box(2.2, 1.0, 1.35, cx, -3.6, FLOOR + 0.93, 0xcfe6ef, base=True, mat=2)
        b.box(0.3, 0.12, 0.25, cx, -3.6, FLOOR + 0.93, WOOD_D, base=True)
        galleon(b, T(cx, -3.6, FLOOR + 0.93 + 0.25 + 1.7 * 0.09, rz=math.pi / 2 + 0.25), L, hull=hc, sail=sc, trim=GOLD if hc != 0x1c1c22 else 0x9fe8ff, flag=0xd8322f if hc != 0x1c1c22 else 0x111111, lod=lod)
    # shelves on the back wall with smaller ships (the skin colourways)
    skins = [(0x8a1c1c, 0xffd29a, GOLD), (0xd4a017, 0xfff3c4, 0xffffff), (0x2f6f4f, 0xe6f2e6, GOLD), (0x3b2a5a, 0xc8b6ff, 0x9fe8ff), (0x1f3d7a, 0xf2ead6, GOLD), (0x5e3b20, 0xf2ead6, GOLD)]
    for row in range(2):
        z = FLOOR + 1.3 + row * 1.15
        b.box(iw - 0.6, 0.55, 0.07, 0, 0.7, z, WOOD, base=True)
        for s in (-1, 1): b.box(0.06, 0.4, 0.4, s * (iw / 2 - 0.6), 0.75, z - 0.4, WOOD_D, base=True)
        if lod < 2:
            n = 5 if lod == 0 else 3
            for i in range(n):
                hc, sc, tc = skins[(i + row * 2) % 6]; x = -iw / 2 + 0.9 + i * (iw - 1.8) / (n - 1)
                b.box(0.16, 0.08, 0.1, x, 0.7, z + 0.07, WOOD_D, base=True)
                galleon(b, T(x, 0.7, z + 0.07 + 0.1 + 0.6 * 0.07, rz=math.pi / 2), 0.6, hull=hc, sail=sc, trim=tc, lod=lod)
    # ship in a bottle on the counter, chart table, wall charts, wheel, rope coils, anchor
    bx, by, bz = 1.6, FY - 1.0, 1.24
    b.box(0.6, 0.18, 0.06, bx, by, bz, WOOD_D, base=True)
    galleon(b, T(bx, by, bz + 0.16, rz=math.pi / 2), 0.36, lod=lod)
    b.cyl(0.13, 0.13, 0.5, bx - 0.25, by, bz + 0.16, 0x9fdcc0, n=12, ry=math.pi / 2, mat=2)
    b.cyl(0.05, 0.05, 0.16, bx + 0.25, by, bz + 0.16, 0x9fdcc0, n=8, ry=math.pi / 2, mat=2); b.cyl(0.055, 0.05, 0.06, bx + 0.4, by, bz + 0.16, 0x8a5a2b, n=8, ry=math.pi / 2)
    b.box(1.4, 0.9, 0.06, -3.0, -0.9, FLOOR + 0.9, WOOD, base=True)
    for sx in (-0.6, 0.6): b.box(0.08, 0.7, 0.9, -3.0 + sx, -0.9, FLOOR, WOOD_D, base=True)
    b.box(1.1, 0.7, 0.01, -3.0, -0.9, FLOOR + 0.96, 0xe8d6a8, base=True, rz=0.1)
    if lod < 2:
        for i in range(3): b.cyl(0.05, 0.05, 0.7, -3.4 + i * 0.12, -1.2, FLOOR + 1.02 + (i % 2) * 0.08, 0xe8d6a8, n=6, ry=math.pi / 2 + 0.1 * i)
        for i, (x, z) in enumerate(((-3.8, 2.9), (-2.2, 3.1), (3.4, 2.9))):
            b.box(1.1, 0.03, 0.8, x, 0.95, FLOOR + z, 0xe8d6a8, base=True); b.box(0.6, 0.035, 0.02, x, 0.94, FLOOR + z + 0.4, 0x8a2a1f, rz=0.4)
        b.torus(0.55, 0.05, 0.0, 0.92, FLOOR + 3.5, WOOD, n=16, m_=5, rx=math.pi / 2)
        for i in range(8):
            a = i * math.pi / 4; b.box(0.06, 0.06, 1.5, 0.0, 0.9, FLOOR + 3.5, WOOD_D, ry=a, rx=0)
        b.cyl(0.13, 0.13, 0.1, 0, 0.86, FLOOR + 3.5, BRASS, n=10, rx=math.pi / 2)
        for i, (x, y) in enumerate(((3.6, -0.6), (3.3, -1.6))):
            for k in range(3 if lod == 0 else 1): b.torus(0.4 - k * 0.07, 0.06, x, y, FLOOR + 0.06 + k * 0.1, 0xd9c39a, n=14, m_=5)
        b.box(0.12, 0.12, 1.4, 3.8, 0.4, FLOOR + 0.4, IRON, base=True); b.torus(0.45, 0.06, 3.8, 0.4, FLOOR + 0.5, IRON, n=10, m_=4, rx=math.pi / 2, rz=math.pi / 2)

def cannon(b, x, y, z, s, rz, lod):
    b.push(T(x, y, z, rz=rz) @ T(s=s))
    b.box(0.7, 1.3, 0.3, 0, 0, 0.22, 0x6b4527, base=True)
    for sx in (-0.4, 0.4):
        for sy in (-0.45, 0.45): b.cyl(0.2, 0.2, 0.1, sx - (0.05 if sx < 0 else -0.05), sy, 0.2, WOOD_D, n=10 if lod == 0 else 6, ry=math.pi / 2)
    prof = [(0.27, 0), (0.26, 0.5), (0.2, 0.55), (0.19, 1.4), (0.23, 1.45), (0.21, 1.55)]
    for (r0, y0), (r1, y1) in zip(prof, prof[1:]): b.cyl(r0, r1, y1 - y0, 0, -0.4 - y0, 0.72, 0x1d2026, n=12 if lod == 0 else 7, rx=math.pi / 2)
    b.sphere(0.2, 0, -0.4, 0.72, 0x1d2026, sub=1)
    b.pop()

def upgrades(b, sh, lod, rng):
    w = sh['w']; iw = w - 2 * WALL
    cannon(b, -2.3, -4.0, FLOOR, 1.1, 0.35, lod); cannon(b, 2.4, -3.6, FLOOR, 1.0, -0.4, lod)
    if lod < 2:
        k = 0
        for lvl, n in enumerate((3, 2, 1)):            # cannonball pyramid
            for i in range(n):
                for j in range(n):
                    b.sphere(0.16, 0.0 + (i - (n - 1) / 2) * 0.32, -4.4 + (j - (n - 1) / 2) * 0.32, FLOOR + 0.16 + lvl * 0.26, 0x22252b, sub=1 if lod == 0 else 0)
    # anvil on a stump + forge + tool rack
    b.cyl(0.35, 0.4, 0.6, -0.4, -1.4, FLOOR, 0x6b4527, n=10)
    b.box(0.35, 0.6, 0.25, -0.4, -1.4, FLOOR + 0.6, IRON, base=True); b.box(0.45, 0.9, 0.22, -0.4, -1.45, FLOOR + 0.85, IRON, base=True)
    b.cyl(0.11, 0.0, 0.45, -0.4, -1.9, FLOOR + 0.96, IRON, n=8, rx=math.pi / 2)
    b.box(1.6, 1.2, 0.9, 2.6, -0.3, FLOOR, QUOIN, base=True); b.box(1.2, 0.8, 0.1, 2.6, -0.3, FLOOR + 0.9, 0xff7a1a, base=True, mat=1)
    b.box(0.8, 0.8, 1.6, 2.6, 0.2, FLOOR + 0.9, 0x6d665e, base=True)
    b.box(iw - 1.0, 0.1, 1.2, 0, 0.92, FLOOR + 1.4, WOOD, base=True)
    if lod < 2:
        for i in range(int((iw - 1.4) / 0.45)):
            x = -iw / 2 + 0.9 + i * 0.45; b.box(0.04, 0.04, 0.9, x, 0.82, FLOOR + 1.55, WOOD_D, base=True)
            if i % 2: b.box(0.22, 0.12, 0.14, x, 0.8, FLOOR + 2.4, IRON, base=True)
            else: b.box(0.08, 0.1, 0.35, x + 0.05, 0.8, FLOOR + 1.6, IRON, base=True, ry=0.3)
        for x in (-3.6, -2.9): barrel(b, x, -0.6, FLOOR, lod, 0.85, col=0x3a2a1c)
        for i in range(10 if lod == 0 else 4): b.torus(0.07, 0.02, 3.8 + 0.0, -2.4, FLOOR + 2.6 - i * 0.11, IRON, n=8, m_=3, rx=(i % 2) * math.pi / 2)
    # counter: a cannonball and a ship-upgrade crate
    b.sphere(0.16, -1.5, FY - 1.0, 1.4, 0x22252b, sub=1); crate(b, 1.4, FY - 1.0, 1.24, 0.5, lod, rng)

def crew(b, sh, lod, rng):
    q = items_for(lod); w = sh['w']; iw = w - 2 * WALL
    # back wall: a peg board with crew outfits hung up + bandanas on head knobs
    b.box(iw - 0.8, 0.08, 2.6, 0, 0.92, FLOOR + 0.6, WOOD, base=True)
    outfits = [('items/v5/cloth_tank_male_lo.glb', 0xd8322f), ('items/v5/cloth_tshirt_male_lo.glb', 0x2a6df4), ('items/v5/cloth_tank_male_lo.glb', 0xf2efe6),
               ('items/v5/cloth_tshirt_male_lo.glb', 0x1f8a5a), ('items/v5/cloth_shirt_male_lo.glb', 0xffd43b)]
    n = len(outfits) if lod == 0 else 3
    for i in range(n):
        x = -iw / 2 + 1.0 + i * (iw - 2.0) / (n - 1); p, tint = outfits[i]
        b.cyl(0.03, 0.03, 0.25, x, 0.9, FLOOR + 2.7, WOOD_D, n=5, rx=math.pi / 2)
        parts = q(p, None, 0.25); mn, mx = bbox_parts(parts)
        add_item(b, parts, T(x, 0.78, FLOOR + 2.72) @ T(s=1.15) @ Matrix.Translation((-(mn[0] + mx[0]) / 2, -mx[1], -mx[2])), tint=tint, lift=1.1)
    # bandanas on pegs (a row of wooden head knobs on the left wall), each a different colour
    bd = q('items/v5/hat_bandana_male_lo.glb', None, 0.3); mn, mx = bbox_parts(bd)
    for i, c in enumerate([0xd8322f, 0x2a6df4, 0x1f8a5a, 0xffd43b, 0x6a4fb3, 0x161616][: (6 if lod == 0 else 3)]):
        y = -3.6 + i * 0.75; x = -iw / 2 + 0.05
        b.cyl(0.03, 0.03, 0.3, x, y, FLOOR + 1.85, WOOD_D, n=5, ry=math.pi / 2)
        b.sphere(0.13, x + 0.38, y, FLOOR + 1.83, 0xe2c79a, sub=1, s=(1, 1, 1.15))
        add_item(b, bd, T(x + 0.38, y, FLOOR + 1.55, rz=-math.pi / 2) @ T(s=0.62) @ Matrix.Translation((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mn[2])), tint=c, lift=1.2)
    # a crew mannequin in the arch (bandana + tank + base: the free crew look) + sea chests + bench
    mannequin(b, q, 2.2, -4.4, 'pirate_male_v5_lo.glb', [('items/v5/cloth_base_male_lo.glb', None), ('items/v5/cloth_tank_male_lo.glb', 0xf2efe6), ('items/v5/hat_bandana_male_lo.glb', 0xd8322f)], lod, rz=-0.3)
    for i, (x, y) in enumerate(((-2.6, -4.5), (-1.4, -4.7))):
        b.box(1.0, 0.6, 0.55, x, y, FLOOR, [0x6b4527, 0x8a2a1f][i], base=True, rz=0.1 * i); b.box(1.04, 0.64, 0.12, x, y, FLOOR + 0.55, WOOD_D, base=True, rz=0.1 * i)
        if lod < 2: b.box(0.15, 0.04, 0.2, x, y - 0.32, FLOOR + 0.4, GOLD, base=True, rz=0.1 * i)
    b.box(2.0, 0.45, 0.08, 1.5, -1.0, FLOOR + 0.45, WOOD, base=True)
    for sx in (-0.9, 0.9): b.box(0.1, 0.4, 0.45, 1.5 + sx, -1.0, FLOOR, WOOD_D, base=True)
    if lod < 2:
        for k in range(3): b.torus(0.4 - k * 0.07, 0.06, 3.4, -2.8, FLOOR + 0.06 + k * 0.1, 0xd9c39a, n=14, m_=5)
    parts = q('items/v5/hat_bandana_male_lo.glb', None, 0.3); add_item(b, parts, place(parts, -1.0, FY - 1.0, 1.24, 0.75), tint=0xd8322f, lift=1.2)


INTERIOR = dict(shop_clothes=clothes, shop_pets=pets, shop_ships=ships, shop_upgrades=upgrades, shop_crew=crew)

# ---------------- build + export ----------------
def mats():
    out = []
    for nm, kind in (('plaza_solid', 0), ('plaza_glow', 1), ('plaza_glass', 2)):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'
        nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        if kind == 1: nt.links.new(ca.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 3.0
        if kind == 2: bs.inputs['Alpha'].default_value = 0.28; m.blend_method = 'BLEND'; bs.inputs['Roughness'].default_value = 0.05
        out.append(m)
    return out
MATS = mats()
REPORT = {}; COLL = bpy.data.collections.new('shops'); bpy.context.scene.collection.children.link(COLL)
def overlap(a, b, pad=0.0): return all(a[1][i] < b[2][i] - pad and b[1][i] < a[2][i] - pad for i in range(3))
for sh in SHOPS:
    root = bpy.data.objects.new(sh['id'], None); COLL.objects.link(root); cols = []; rep = {}
    for lod in (0, 1, 2):
        rng = np.random.default_rng(hash(sh['id']) % 1000 + lod); random.seed(1)
        b = Builder(); b.ground = lambda x, y: 0.0; bd = []; ow, top, rise = shell(b, sh, lod, rng); bd.append(b.tris())
        if not sh.get('plain'): shopfront(b, sh, lod, rng, ow)
        bd.append(b.tris())
        if not sh.get('plain'): signs(b, sh, lod, rng)
        bd.append(b.tris())
        if lod < 2 and not sh.get('plain'): market_props(b, sh, lod, rng, cols if lod == 0 else []); INTERIOR[sh['id']](b, sh, lod, rng)
        bd.append(b.tris()); rep[f'LOD{lod}_split shell/front/signs/interior'] = [bd[0], bd[1] - bd[0], bd[2] - bd[1], bd[3] - bd[2]]
        if lod == 0:   # BANKSY "Make sure the signs aren't inside balcony": every sign part vs every balcony / rail / shutter / awning part
            S = [x for x in b.boxes if x[0] == 'sign']; O = [x for x in b.boxes if x[0] in ('balcony', 'rail', 'shutter', 'awning')]
            hits = [(s[0], o[0], s[1].round(2).tolist(), o[1].round(2).tolist()) for s in S for o in O if overlap(s, o)]
            xy = lambda a, c: all(a[1][i] < c[2][i] and c[1][i] < a[2][i] for i in (0, 1))   # vertical gap where a sign sits under a balcony part
            minclear = min([o[1][2] - s[2][2] for s in S for o in O if o[0] in ('balcony', 'rail') and xy(s, o)] or [9])
            rep['sign_check'] = dict(signs=len(S), others=len(O), overlaps=len(hits), clearance_below_balcony_m=round(float(minclear), 3))
            assert not hits, ('sign overlaps', sh['id'], hits[:3])
        me = b.bake(f"{sh['id']}_LOD{lod}"); me.validate(clean_customdata=False)
        for m in MATS: me.materials.append(m)
        o = bpy.data.objects.new(f"{sh['id']}_LOD{lod}", me); COLL.objects.link(o); o.parent = root
        rep[f'LOD{lod}'] = b.tris()
    # colliders in the building's three.js frame (x, z = -y): the footprint box + counter + posts stay in plazaTown.js; these are the extras
    root['colliders'] = json.dumps(cols); root['top'] = top + rise; REPORT[sh['id']] = rep
    print(sh['id'], rep)
json.dump(REPORT, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'plaza_shops.blend'))
for o in bpy.data.objects: o.select_set(o.users_collection and o.users_collection[0] == COLL)
kw = dict(filepath=os.path.join(OUT, 'plaza_shops_raw.glb'), export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', os.path.getsize(os.path.join(OUT, 'plaza_shops_raw.glb')))
