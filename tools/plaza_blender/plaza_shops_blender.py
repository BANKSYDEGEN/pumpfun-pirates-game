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
FONT_SIGN = os.path.join(GAME, 'assets/fonts/CinzelDecorative-Bold.ttf')   # [clothes-aaa] crisp carved serif capitals
IT = lambda p: os.path.join(GAME, 'assets/pirates', p)
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- the shared layout (keep in sync with js/island/plazaTown.js STOREFRONTS + SHOP_SIGN) ----
SHOPS = [dict(id='shop_clothes', name='CLOTHES & ACCESSORIES', w=20, fl=3, v=0, awn=0xd8322f, awn2=0x6a4fb3, deep=18.0, combo=True),   # [clothes-aaa] walk-in, 18 m deep; [outfit-store] + Accessories: one 20 m building, 2 areas (js/island/outfitStore.js)
         dict(id='shop_pets', name='PET STORE', w=9, fl=2, v=1, awn=0x1f8a5a),
         dict(id='shop_ships', name='SHIP SHOP', w=12, fl=3, v=2, awn=0x2a6df4),
         dict(id='shop_upgrades', name='UPGRADE SHOP', w=11, fl=2, v=3, awn=0xffc93c),
         # [outfit-store] shop_crew (the old CREW / Accessories plot) is the right half of shop_clothes now: no standalone building
         # the WEAPON STORE moved up the hill (Emerly builds it): its slot between the tavern and the harbor tower is a plain matching
         # stone house now: no shopfront, sign, interior or trigger (door + ground-floor windows, same shell / balcony / roof)
         dict(id='house_e', name=None, w=7, fl=3, v=2, awn=0x8a1c1c, plain=True)]
D, PL, G, U, WALL = 12.0, 0.5, 5.4, 3.3, 0.5
FY = -D / 2                       # front face
OPEN_TOP, BOARD = 3.6, (4.2, 4.85)
ARCHES = lambda sh: [-5.0, 5.0] if sh.get('combo') else [0.0]   # [outfit-store] arch centres (js OUTFIT_STORE.arches)
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

def carve(b, text, cx, cy, cz, wfit, hfit, face, lod, deep=True, font=None, col=None):
    # raised gold letters on a sign face; face = rotation matrix taking text +z (normal) to the face's outward normal
    V, F, _ = text_mesh(text, font or FONT, size=1.0, extrude=0.025 if lod == 0 and deep else 0.0, res=(3 if font else 2) if lod == 0 else (2 if font else 1))
    if lod or not deep: V = V + [0, 0, 0.012]   # LOD1: flat letters a hair off the board
    mn, mx = V.min(0), V.max(0); s = min(wfit / (mx[0] - mn[0]), hfit / (mx[1] - mn[1]))
    V = (V - [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]) * [s, s, 1]
    b.mesh(V, F, col or GOLD, m=Matrix.Translation((cx, cy, cz)) @ face, smooth=False)

def signs(b, sh, lod, rng):
    if sh.get('deep'): return signs_aaa(b, sh, lod, rng)
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
    top = PL + G + (fl - 1) * U; ow = 6.6 if sh.get('combo') else min(w * 0.66, w - 2.6); deep = sh.get('deep'); zb = 0.0 if deep else PL
    if deep: deep_ground(b, sh, lod, rng, ow, col)   # [clothes-aaa] walk-in: perimeter plinth, full-depth room, single-storey rear wing
    else:
        b.box(w + 0.6, D + 0.6, 0.8, 0, 0, -0.3, QUOIN, base=True)                                             # plinth
        # rear mass + side walls + back wall of the shop room + upper storeys (hidden faces are cheap boxes)
        b.box(w, D / 2 - 1.0, G, 0, 1.0 + (D / 2 - 1.0) / 2, PL, col, base=True)
        for s in (-1, 1): b.box(WALL, 7.0, G, s * (w / 2 - WALL / 2), FY + 3.5, PL, col, base=True)
    b.box(w, D - WALL, top - (PL + G), 0, WALL / 2, PL + G, col, base=True)
    # front wall with the shop arch + upper windows
    plain = sh.get('plain')
    holes = [(ax - ow / 2, ax + ow / 2, zb, OPEN_TOP) for ax in ARCHES(sh)] if not plain else []; wins = []
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
    rects = wall_rects(-w / 2, w / 2, zb, top, holes)
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
        for ax in ARCHES(sh):
            for i in range(n):
                t = (i + 0.5) / n; x = ax - ow / 2 - 0.2 + t * (ow + 0.4); a = (t - 0.5) * 0.7
                b.box((ow + 0.4) / n - 0.04, 0.4, 0.5 if i != n // 2 else 0.68, x, FY - 0.12, OPEN_TOP + 0.24 + (0.06 if i == n // 2 else 0), hexc(QUOIN if i != n // 2 else STONES[2], 0.05, rng), ry=a * 0.3)
            for s in (-1, 1):
                if not plain: b.box(0.5, 0.4, OPEN_TOP - zb, ax + s * (ow / 2 + 0.25), FY - 0.1, zb, QUOIN, base=True)
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
    iw = w - 2 * WALL; deep = sh.get('deep')
    if sh.get('combo'): room_combo(b, sh, lod, rng, ow)   # [outfit-store]
    elif deep: room_aaa(b, sh, lod, rng, ow)   # [clothes-aaa]
    elif lod < 2:
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
    if not deep: b.box(w * 0.6, 1.0, 1.1, 0, FY - 1.0, 0, WOOD, base=True)
    if not deep: b.box(w * 0.6 + 0.3, 1.25, 0.14, 0, FY - 1.0, 1.1, WOOD_L, base=True)
    if lod == 0 and not deep:
        for i in range(int(w * 0.6 / 0.6)): b.box(0.05, 0.03, 0.9, -w * 0.3 + 0.3 + i * 0.6, FY - 1.51, 0.1, WOOD_D, base=True)
    # striped canvas awning on timber posts (posts at x +-w*0.33, y FY-2.5), scalloped valance
    AX = ARCHES(sh); wa = w / len(AX)   # [outfit-store] one awning per arch (Clothing red, Accessories plum)
    for k_, ax in enumerate(AX):
        awn = sh['awn2'] if k_ and sh.get('awn2') else sh['awn']
        aw = wa * 0.72; ang = math.atan2(0.7, 2.8); L = math.hypot(2.8, 0.7); ns = 8 if lod < 2 else 1
        for i in range(ns):
            x = ax - aw / 2 + (i + 0.5) * aw / ns
            b.box(aw / ns + 0.002, L, 0.08, x, FY - 1.4, 3.2, awn if i % 2 == 0 or lod == 2 else 0xf2efe6, rx=ang, tag='awning', mat='awning_cloth')
            if lod < 2:
                b.prism([(-aw / ns / 2, 0), (aw / ns / 2, 0), (0, -0.4)], 0.04, awn if i % 2 == 0 else 0xf2efe6, T(x, FY - 2.82, 2.86) @ T(s=(1, 1, 0.7)), mat='awning_cloth')
        for s in (-1, 1):
            b.box(0.22, 0.22, 2.95, ax + s * wa * 0.33, FY - 2.5, 0, WOOD_D, base=True, tag='awning')
            if lod < 2: b.box(0.3, 0.3, 0.2, ax + s * wa * 0.33, FY - 2.5, 0, QUOIN, base=True)
        b.box(aw, 0.1, 0.1, ax, FY - 2.5, 2.95, WOOD_D, tag='awning')
    # wall lanterns either side of the arch (iron + glow glass)
    if lod < 2:
        for s, ax in ((s, ax) for ax in AX for s in (-1, 1)):
            x = ax + s * (ow / 2 + 0.25)
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
    # V7 males are live fitted figures (plazaShops.js), never a stale body baked into a building.
    if body.startswith(('pirate_male', 'pirate_female')): return   # [v361] V7 female too
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


# ======================= [clothes-aaa] the CLOTHES SHOP walk-in (BANKSY t231u-t232u) =======================
# "3A upgrade clothing store" + "make them walk in stores and make them deeper" + "good lighting": the shop room now runs the full
# 18 m depth (front y -6 .. back y 12 = lz -30 .. -48) at STREET level (floor top 0.04: no step at the door, no street counter in
# the arch). The front 12 m keeps the 3-storey house; the rear 6 m is a single-storey wing under a lean-to roof. Inside: polished
# boards + a crimson runner, mahogany wainscot with raised panels under warm parchment walls, pilasters, a coffered ceiling with three
# brass chandeliers + wall sconces (glow geometry; the painted light pools live in js/island/clothesLook.js), display plinths for the
# blank V7 forms (js/island/plazaMannequins.js), wall racks with the game's real shirts / coats / boots, a cubby cabinet of folded
# stacks, a triple mirror, a hat wall, a centre table, a fitting booth, the hat stand and the tailor's counter at the back (the shop
# prompt: js CLOTHES_ROOM). Colliders (three building frame [kind, x, z, ...], z = -y) ride in the GLB extras.
FLR = 0.04; CEIL = 5.2
MAHOG, MAHOG_L, MAHOG_D = 0x5a2a17, 0x74371f, 0x3c1b0e
OAK_A, OAK_B = 0x9a5c2e, 0x87502a
PARCH, PARCH_D, CORN = 0xe8cf9f, 0xd9bb86, 0xf4e6c4
VELVET, VELVET_D, NAVY = 0x8e1b22, 0x6a1218, 0x1c2840
BOLTS = [0xd8322f, 0x2a6df4, 0xffd43b, 0x1f8a5a, 0xf2efe6, 0x6a4fb3, 0xff8a3d, 0x2b8fa3, 0x8a1c1c, 0x1c1c24]

def deep_ground(b, sh, lod, rng, ow, col):
    w = sh['w']; CD = sh['deep']; BY = FY + CD; cy = FY + CD / 2; WH = PL + G; WING = 6.5
    # perimeter base course only: the shop floor is the street (the walker's ground), so the door has no step
    xs = [-w / 2 - 0.3] + [x for ax in ARCHES(sh) for x in (ax - ow / 2 - 0.5, ax + ow / 2 + 0.5)] + [w / 2 + 0.3]
    for a, bx in zip(xs[::2], xs[1::2]): b.box(bx - a, 0.6, 0.8, (a + bx) / 2, FY, -0.3, QUOIN, base=True)   # front base course between the arches
    for s in (-1, 1): b.box(0.6, CD + 0.6, 0.8, s * (w / 2), cy, -0.3, QUOIN, base=True)
    b.box(w + 0.6, 0.6, 0.8, 0, BY, -0.3, QUOIN, base=True)
    for s in (-1, 1):
        b.box(WALL, D, WH, s * (w / 2 - WALL / 2), 0, 0, col, base=True)                              # front block side walls
        b.box(WALL, CD - D, WING, s * (w / 2 - WALL / 2), FY + D + (CD - D) / 2, 0, col, base=True)   # rear wing side walls
    b.box(w, WALL, WING, 0, BY - WALL / 2, 0, col, base=True)                                        # back wall
    b.box(w - 2 * WALL + 0.02, CD - 2 * WALL + 0.02, 0.3, 0, cy, CEIL, CORN, base=True, mat='none')   # the room's ceiling slab (smooth: no library layer)
    b.box(w, CD - D - WALL, WING - CEIL - 0.3, 0, FY + D + (CD - D) / 2 - WALL / 2 + 0.25, CEIL + 0.3, col, base=True)   # wing loft (closed)
    # lean-to roof of the wing against the upper storeys' back wall + string course + back quoins
    y0, y1, z0, z1 = FY + D, BY + 0.55, WING + 0.95, WING + 0.05; L = math.hypot(y1 - y0, z0 - z1); a = math.atan2(z0 - z1, y1 - y0)
    rc = ROOFS[sh['v'] % 4]
    if lod == 0:
        n = int(L / 0.42)
        for i in range(n):
            t = (i + 0.5) / n
            b.box(w + 0.7, 0.48, 0.16, 0, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t + 0.1, hexc(rc, 0.08, rng), rx=-a)
    else: b.box(w + 0.7, L, 0.26, 0, (y0 + y1) / 2, (z0 + z1) / 2 + 0.05, rc, rx=-a)
    if lod < 2:
        b.box(w + 0.36, CD - D + 0.36, 0.28, 0, FY + D + (CD - D) / 2, WING - 0.14, QUOIN)
        zq = PL
        while zq < WING - 0.4:
            for s in (-1, 1): b.box(0.6 if int(zq / 0.6) % 2 else 0.9, 0.62, 0.56, s * (w / 2 - 0.2), BY - 0.2, zq + 0.29, hexc(QUOIN, 0.05, rng))
            zq += 0.6

def sconce(b, x, y, z, side, lod):
    # brass wall sconce: back plate, curled arm, a candle cup + glow flame and a little glass chimney
    b.box(0.05, 0.22, 0.34, x, y, z, BRASS)
    b.box(0.26, 0.05, 0.05, x + side * 0.13, y, z - 0.05, BRASS)
    b.cyl(0.06, 0.07, 0.06, x + side * 0.26, y, z - 0.05, BRASS, n=8)
    b.cyl(0.035, 0.035, 0.14, x + side * 0.26, y, z + 0.01, 0xfff2d8, n=6, mat=1)
    if lod == 0: b.box(0.05, 0.05, 0.09, x + side * 0.26, y, z + 0.17, GLOW, mat=1)

def chandelier(b, x, y, lod):
    zc = CEIL - 1.35
    b.cyl(0.18, 0.12, 0.08, x, y, CEIL - 0.08, BRASS, n=10)
    b.cyl(0.02, 0.02, 1.1, x, y, zc + 0.15, IRON, n=4)
    b.torus(0.62, 0.04, x, y, zc, BRASS, n=20 if lod == 0 else 12, m_=5 if lod == 0 else 4)
    b.sphere(0.13, x, y, zc - 0.08, BRASS, sub=1)
    k = 8 if lod == 0 else 6
    for i in range(k):
        a = i * 2 * math.pi / k; cx, cy = x + math.cos(a) * 0.62, y + math.sin(a) * 0.62
        b.box(0.62, 0.035, 0.035, x + math.cos(a) * 0.31, y + math.sin(a) * 0.31, zc, BRASS, rz=a)
        b.cyl(0.07, 0.06, 0.05, cx, cy, zc + 0.02, BRASS, n=8)
        b.cyl(0.03, 0.03, 0.16, cx, cy, zc + 0.07, 0xfff4dc, n=6, mat=1)
        b.box(0.06, 0.06, 0.1, cx, cy, zc + 0.27, GLOW, mat=1)
    if lod == 0:
        for i in range(k):   # crystal drops
            a = (i + 0.5) * 2 * math.pi / k; b.box(0.04, 0.04, 0.14, x + math.cos(a) * 0.45, y + math.sin(a) * 0.45, zc - 0.16, 0xfff0c8, mat=1)

def wain_panels(b, x0, x1, y0, y1, face, lod, upper=None, rail=None):
    # mahogany wainscot (1.15 m) on a wall line from (x0, y0) to (x1, y1); face = unit normal into the room (nx, ny)
    nx, ny = face; L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L; rz = math.atan2(uy, ux)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    b.box(L, 0.05, 1.15, mx + nx * 0.025, my + ny * 0.025, FLR, MAHOG, rz=rz, base=True, mat='timber')
    b.box(L, 0.07, 0.17, mx + nx * 0.035, my + ny * 0.035, FLR, MAHOG_D, rz=rz, base=True)               # skirting
    b.box(L, 0.1, 0.07, mx + nx * 0.05, my + ny * 0.05, FLR + 1.12, rail or MAHOG_L, rz=rz, base=True)            # chair rail
    if lod == 0:
        n = max(1, int(L / 1.25))
        for i in range(n):
            t = (i + 0.5) / n; px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t; pw = L / n - 0.24
            b.box(pw, 0.03, 0.66, px + nx * 0.06, py + ny * 0.06, FLR + 0.3, MAHOG_L, rz=rz, base=True, mat='timber')   # raised field
            b.box(pw - 0.12, 0.02, 0.54, px + nx * 0.08, py + ny * 0.08, FLR + 0.36, MAHOG, rz=rz, base=True, mat='timber')
    # parchment upper wall + crown cornice
    b.box(L, 0.03, CEIL - FLR - 1.19, mx + nx * 0.015, my + ny * 0.015, FLR + 1.19, upper or PARCH, rz=rz, base=True, mat='none')   # smooth painted wall (no stone layer)
    b.box(L, 0.22, 0.2, mx + nx * 0.11, my + ny * 0.11, CEIL - 0.2, CORN, rz=rz, base=True, mat='none')
    if lod == 0: b.box(L, 0.05, 0.04, mx + nx * 0.23, my + ny * 0.23, CEIL - 0.24, BRASS, rz=rz, base=True)

def room_aaa(b, sh, lod, rng, ow):
    w = sh['w']; CD = sh['deep']; iw = w - 2 * WALL; BY = FY + CD; ya, yb = FY + WALL, BY - WALL; cy = (ya + yb) / 2; L = yb - ya
    if lod == 2:
        b.box(ow, 0.05, OPEN_TOP, 0, FY + 2.5, 0, 0x9a7444, base=True)   # impostor: a warm-lit room plane
        return
    # polished oak boards (grain along the room), staggered joints on LOD0
    nb = int(iw / (0.3 if lod == 0 else 0.6))
    for i in range(nb):
        x = -iw / 2 + (i + 0.5) * iw / nb; c = hexc(OAK_A if i % 2 else OAK_B, 0.05, rng)
        if lod == 0:
            cut = ya + L * (0.3 + 0.4 * ((i * 37) % 10) / 10)
            for a_, b_ in ((ya, cut), (cut, yb)): b.box(iw / nb - 0.012, b_ - a_ - 0.012, 0.04, x, (a_ + b_) / 2, 0.0, c, base=True, mat='timber')
        else: b.box(iw / nb - 0.012, L, 0.04, x, cy, 0.0, c, base=True, mat='timber')
    # crimson runner from the door to the counter, gold borders
    r0, r1 = ya + 0.35, 8.2
    b.box(2.2, r1 - r0, 0.016, 0, (r0 + r1) / 2, FLR, VELVET, base=True, mat='awning_cloth')
    for s in (-1, 1):
        b.box(0.1, r1 - r0, 0.02, s * 1.0, (r0 + r1) / 2, FLR, 0xc9a243, base=True)
        if lod == 0: b.box(0.05, r1 - r0 - 0.3, 0.02, s * 0.8, (r0 + r1) / 2, FLR, 0xd9b45a, base=True)
    for yy in (r0 + 0.05, r1 - 0.05): b.box(2.2, 0.1, 0.02, 0, yy, FLR, 0xc9a243, base=True)
    # brass threshold across the doorway (flush: 1.5 cm)
    b.box(ow - 0.1, 0.16, 0.012, 0, FY + WALL / 2, 0.0, 0xa8853a, base=True)
    # walls: wainscot + parchment + cornice on the two sides, the back and both sides of the door
    xi = iw / 2
    wain_panels(b, -xi, -xi, ya, yb, (1, 0), lod); wain_panels(b, xi, xi, yb, ya, (-1, 0), lod)
    wain_panels(b, -xi, xi, yb, yb, (0, -1), lod)
    for s in (-1, 1): wain_panels(b, s * xi, s * (ow / 2), ya, ya, (0, 1), lod)
    b.box(ow, 0.03, CEIL - OPEN_TOP, 0, ya + 0.015, OPEN_TOP, PARCH, base=True, mat='none')   # over the door (inside)
    b.box(ow + 0.3, 0.12, 0.18, 0, ya + 0.06, OPEN_TOP - 0.02, MAHOG_L, base=True)   # door head moulding
    # pilasters (cream, gilt capitals) along the side walls
    if lod == 0:
        for s in (-1, 1):
            for yy in (ya + 0.25, -0.9, 1.6 + 0.3, 7.3, yb - 0.25):
                b.box(0.12, 0.34, CEIL - 1.2 - 0.2, s * (xi - 0.06), yy, FLR + 1.19, CORN, base=True, mat='none')
                b.box(0.16, 0.42, 0.14, s * (xi - 0.08), yy, CEIL - 0.42, BRASS, base=True)
    # coffered ceiling: dark beams across + one spine
    nbm = 6
    for i in range(nbm + 1):
        yy = ya + i * L / nbm; b.box(iw, 0.26, 0.3, 0, min(max(yy, ya + 0.13), yb - 0.13), CEIL - 0.3, MAHOG_D, base=True, mat='timber')
    if lod == 0:
        for s in (-1, 1): b.box(0.22, L, 0.22, s * iw / 4, cy, CEIL - 0.22, MAHOG_D, base=True, mat='timber')
    for yy in (-2.0, 3.4, 8.2): chandelier(b, 0, yy, lod)
    # wall sconces between the racks / cabinets
    for s in (-1, 1):
        for yy in ((-4.4, 1.3, 6.9, 10.5) if lod == 0 else (1.3, 6.9)): sconce(b, s * (xi - 0.03), yy, 2.75, -s, lod)

def stack(b, x, y, z, cols, lod, rng, sw=0.46, sd=0.36, h=0.07, n=4, rz=0.0):
    # a neat stack of folded garments (each fold slightly offset)
    for k in range(n if lod == 0 else max(1, n // 2)):
        hh = h if lod == 0 else h * 2
        b.box(sw, sd, hh - 0.006, x + rng.uniform(-0.015, 0.015), y + rng.uniform(-0.01, 0.01), z + k * hh, hexc(cols[k % len(cols)], 0.05, rng), rz=rz + rng.uniform(-0.04, 0.04), base=True)
    return z + (n if lod == 0 else max(1, n // 2)) * (h if lod == 0 else h * 2)

def plinth(b, x, y, r, lod, top=0.2, velvet=False):
    n = 20 if lod == 0 else 12
    b.cyl(r + 0.05, r + 0.03, 0.06, x, y, FLR, MAHOG_D, n=n)
    b.cyl(r, r, top - FLR - 0.07, x, y, FLR + 0.06, MAHOG, n=n)
    b.cyl(r - 0.03, r - 0.03, 0.012, x, y, top - 0.012, VELVET if velvet else 0xe9e1d2, n=n)
    b.torus(r - 0.005, 0.018, x, y, top - 0.012, BRASS, n=n, m_=4)

def rack(b, q, x, ya_, yb_, lod, items, tints, rng, side=1, S=1.3):
    # brass wall rack: two uprights, a top rail with hanging garments facing the room, a shoe shelf, a top shelf of folded stacks
    for yy in (ya_ + 0.1, yb_ - 0.1):
        b.cyl(0.03, 0.03, 2.0, x, yy, FLR, BRASS, n=6)
        b.cyl(0.07, 0.08, 0.04, x, yy, FLR, BRASS, n=8)
    b.box(0.04, yb_ - ya_, 0.04, x, (ya_ + yb_) / 2, FLR + 1.95, BRASS)
    n = len(items) if lod == 0 else max(2, len(items) // 2)
    for i in range(n):
        yy = ya_ + 0.35 + i * (yb_ - ya_ - 0.7) / max(1, n - 1); sp = q(items[i % len(items)], None, 0.25)
        mn, mx = bbox_parts(sp); m = T(x, yy, FLR + 1.93, rz=side * math.pi / 2) @ T(s=S) @ Matrix.Translation((-(mn[0] + mx[0]) / 2, -(mn[1] + mx[1]) / 2, -mx[2]))
        add_item(b, sp, m, tint=tints[i % len(tints)], lift=1.12)
        b.box(0.02, 0.36, 0.02, x, yy, FLR + 1.93, BRASS)   # hanger bar
        if lod == 0: b.torus(0.03, 0.006, x, yy, FLR + 1.99, BRASS, n=6, m_=3, rx=math.pi / 2)
    # low shoe shelf + top shelf (on wall brackets)
    xs = x - side * 0.08
    b.box(0.42, yb_ - ya_ - 0.2, 0.04, xs, (ya_ + yb_) / 2, FLR + 0.22, MAHOG_L, base=True, mat='timber')
    b.box(0.46, yb_ - ya_, 0.05, x - side * 0.12, (ya_ + yb_) / 2, FLR + 2.45, MAHOG_L, base=True, mat='timber')
    if lod == 0:
        for yy in (ya_ + 0.4, (ya_ + yb_) / 2, yb_ - 0.4): b.box(0.3, 0.04, 0.22, x - side * 0.2, yy, FLR + 2.24, BRASS, base=True)
    return xs

def clothes_aaa(b, sh, lod, rng, cols, xo=0.0):
    # [outfit-store] xo = the Clothing area's centre in the joint building (its own 9 m wide hall, the middle wall on its right)
    b.push(T(xo, 0, 0)); _clothes_aaa(b, sh, lod, rng, lambda *a: cols.append([a[0], a[1] + xo, *a[2:]]), 9.0 if xo else sh['w'] - 2 * WALL); b.pop()

def _clothes_aaa(b, sh, lod, rng, C, iw):
    q = items_for(lod); CD = sh['deep']; xi = iw / 2; BY = FY + CD; yb = BY - WALL
    # 1. window plinths (V7 forms stand on them: js MALE_SHOP_DISPLAYS y .2) + the centre dais for two more
    for s in (-1, 1): plinth(b, s * 3.05, -4.35, 0.52, lod); C('c', s * 3.05, 4.35, 0.62)
    plinth(b, 0, 1.0, 1.3, lod, velvet=True); C('c', 0, -1.0, 1.42)
    if lod == 0:   # a little brass easel card on the dais
        b.box(0.04, 0.04, 0.7, 0, 2.05, 0.2, BRASS, base=True, rx=0.25)
        b.box(0.5, 0.03, 0.34, 0, 2.15, 0.62, NAVY, rx=0.25)
        carve(b, 'NEW', 0, 2.13, 0.62, 0.36, 0.16, Matrix.Rotation(math.pi / 2 + 0.25, 4, 'X'), lod, deep=False, font=FONT_SIGN)
    # 2. left wall: two racks of real shirts + coats, boots on the shoe shelves, folded stacks on the top shelves
    shirts = ['items/v5/cloth_shirt_male_lo.glb'] * 6; coats = ['items/v5/cloth_coat_male_lo.glb', 'items/v5/cloth_shirt_male_lo.glb'] * 3
    rk = [(-3.1, 0.3, shirts, [0xf4efe4, 0xd8322f, 0x2a6df4, 0xffd43b, 0x1f8a5a, 0x6a4fb3]), (2.5, 6.5, coats, [0x8a1c1c, 0xf2efe6, 0x1c2840, 0xd8a24a, 0x2f4a2a, 0x2a6df4])]
    for ya_, yb_, it, tn in rk:
        xs = rack(b, q, -xi + 0.42, ya_, yb_, lod, it, tn, rng, side=1)
        C('b', -xi + 0.42, -(ya_ + yb_) / 2, 0.95, yb_ - ya_ + 0.2, 0)
        nb_ = 3 if lod == 0 else 1
        for k in range(nb_):
            bp = q('items/v5/boots_classic_male_lo.glb', None, 0.3) if k % 2 == 0 else q('items/v5/boots_cavalier_male_lo.glb', None, 0.3)
            yy = ya_ + 0.6 + k * (yb_ - ya_ - 1.2) / max(1, nb_ - 1)
            add_item(b, bp, place(bp, xs, yy, FLR + 0.26, 0.85, rz=math.pi / 2))
        if lod == 0:
            for k in range(5):
                stack(b, -xi + 0.28, ya_ + 0.45 + k * (yb_ - ya_ - 0.9) / 4, FLR + 2.5, [BOLTS[(k * 3 + i) % 10] for i in range(4)], lod, rng, sw=0.34, sd=0.4, n=3)
    # 3. right wall: the cubby cabinet of folded stacks
    cx, ya_, yb_ = xi - 0.3, -3.1, 0.3
    b.box(0.6, yb_ - ya_, 2.5, cx, (ya_ + yb_) / 2, FLR, MAHOG, base=True, mat='timber')
    b.box(0.7, yb_ - ya_ + 0.12, 0.12, cx - 0.03, (ya_ + yb_) / 2, FLR + 2.5, MAHOG_L, base=True)
    if lod < 2:
        b.box(0.66, yb_ - ya_ + 0.1, 0.05, cx - 0.04, (ya_ + yb_) / 2, FLR + 2.62, BRASS, base=True)
        nc, nr = 4, 4
        for i in range(nc):
            for j in range(nr):
                yy = ya_ + (i + 0.5) * (yb_ - ya_) / nc; zz = FLR + 0.15 + j * 0.58
                b.box(0.04, (yb_ - ya_) / nc - 0.08, 0.5, cx - 0.29, yy, zz, MAHOG_D, base=True)   # cubby shadow back
                stack(b, cx - 0.36, yy, zz + 0.02, [BOLTS[(i * 4 + j + k) % 10] for k in range(4)], lod, rng, sw=0.3, sd=0.62, n=5 if lod == 0 else 4, rz=math.pi / 2)
            if lod == 0: b.box(0.05, 0.04, 2.4, cx - 0.31, ya_ + i * (yb_ - ya_) / nc, FLR + 0.05, MAHOG_L, base=True)
    C('b', cx, -(ya_ + yb_) / 2, 0.75, yb_ - ya_ + 0.2, 0)
    # 4. right (middle) wall, past the archway: the triple mirror (gilt frames) + a velvet fitting step
    my = 6.5
    for k, (dy, rz, wd) in enumerate(((0, 0, 1.0), (-0.86, -0.55, 0.62), (0.86, 0.55, 0.62))):
        px = xi - 0.08 - (0.17 if k else 0); py = my + dy
        b.push(T(px, py, FLR, rz=rz))
        b.box(0.08, wd + 0.12, 2.3, 0, 0, 0.12, 0xc9a243, base=True)
        b.box(0.03, wd - 0.04, 2.1, -0.045, 0, 0.22, 0xcfe0e8, base=True, mat=1)
        if lod == 0: b.box(0.1, wd + 0.2, 0.12, 0.01, 0, 2.42, GOLD, base=True)
        b.pop()
    b.cyl(0.42, 0.44, 0.16, xi - 1.25, my, FLR, VELVET, n=16 if lod == 0 else 10); b.torus(0.42, 0.02, xi - 1.25, my, FLR + 0.16, BRASS, n=16, m_=4)
    C('b', xi - 0.25, -my, 0.7, 2.6, 0); C('c', xi - 1.25, -my, 0.48)
    # 5. [outfit-store] the hat wall moved to the Accessories area (hats are accessories)
    # 6. the centre table: folded stacks, boots, a tricorn on a block
    ty = 4.6
    b.box(2.2, 1.0, 0.06, 0, ty, FLR + 0.8, MAHOG_L, base=True, mat='timber')
    b.box(2.0, 0.8, 0.12, 0, ty, FLR + 0.68, MAHOG, base=True)
    for sx in (-0.95, 0.95):
        for sy in (-0.4, 0.4):
            b.cyl(0.05, 0.035, 0.68, sx, ty + sy, FLR, MAHOG_D, n=8)
            if lod == 0: b.sphere(0.06, sx, ty + sy, FLR + 0.35, MAHOG_D, sub=0)
    for k in range(6 if lod == 0 else 3):
        sx = -0.7 + (k % 3) * 0.7 if lod == 0 else -0.7 + k * 0.7; sy = -0.22 + (k // 3) * 0.44 if lod == 0 else 0.0
        if lod == 0 and k == 4: continue
        stack(b, sx, ty + sy, FLR + 0.86, [BOLTS[(k * 3 + i) % 10] for i in range(4)], lod, rng, sw=0.4, sd=0.3, n=4)
    if lod == 0:
        b.box(0.24, 0.24, 0.2, 0, ty + 0.22, FLR + 0.86, NAVY, base=True)
        parts = q('items/v5/hat_tricorn_male_lo.glb', None, 0.3); add_item(b, parts, place(parts, 0, ty + 0.22, FLR + 1.06, 0.8, rz=0.4), tint=0x2a1d16)
    C('b', 0, -ty, 2.4, 1.2, 0)
    # 7. the tailor's counter (the shop prompt stands in front of it)
    ky = 9.2
    b.box(5.2, 0.9, 0.98, 0, ky, FLR, MAHOG, base=True, mat='timber')
    b.box(5.4, 1.06, 0.07, 0, ky, FLR + 0.98, MAHOG_L, base=True, mat='timber')
    b.box(5.24, 0.04, 0.12, 0, ky - 0.47, FLR, BRASS, base=True)   # kick plate
    if lod == 0:
        for i in range(5):
            x = -2.08 + i * 1.04
            b.box(0.84, 0.03, 0.56, x, ky - 0.46, FLR + 0.24, MAHOG_L, base=True, mat='timber'); b.box(0.7, 0.02, 0.44, x, ky - 0.475, FLR + 0.3, MAHOG, base=True, mat='timber')
        b.box(5.42, 0.05, 0.04, 0, ky - 0.53, FLR + 1.0, BRASS, base=True)
    # register, ledger, bell, tape, a fabric bolt
    b.box(0.5, 0.42, 0.3, 1.7, ky + 0.1, FLR + 1.05, BRASS, base=True); b.box(0.5, 0.2, 0.22, 1.7, ky + 0.26, FLR + 1.35, 0xb08a38, base=True, rx=-0.4)
    if lod == 0:
        for i in range(8): b.cyl(0.025, 0.025, 0.04, 1.52 + (i % 4) * 0.12, ky - 0.05 + (i // 4) * 0.1, FLR + 1.35, 0xf2efe6, n=6)
        b.box(0.7, 0.5, 0.05, -0.5, ky, FLR + 1.05, 0x6a1218, base=True, rz=0.1); b.box(0.64, 0.44, 0.03, -0.5, ky, FLR + 1.1, 0xf4ead2, base=True, rz=0.1)
        b.sphere(0.07, 0.6, ky - 0.15, FLR + 1.1, BRASS, sub=1, s=(1, 1, 0.7)); b.cyl(0.012, 0.012, 0.06, 0.6, ky - 0.15, FLR + 1.14, BRASS, n=4)
        b.torus(0.07, 0.025, -1.4, ky + 0.1, FLR + 1.08, 0xf2d27a, n=10, m_=4)
    b.cyl(0.12, 0.12, 0.9, -2.0, ky + 0.15, FLR + 1.17, 0x2a6df4, n=10, ry=math.pi / 2)   # bolt of blue cloth
    C('b', 0, -ky, 5.5, 1.15, 0)
    # 8. back wall: fabric-bolt shelving + a carved FINE TAILORING plate
    sy_ = yb - 0.26
    b.box(5.4, 0.5, 2.7, 0, sy_, FLR, MAHOG, base=True, mat='timber')
    for j in range(4): b.box(5.3, 0.46, 0.05, 0, sy_ - 0.02, FLR + 0.3 + j * 0.62, MAHOG_L, base=True)
    nbo = 18 if lod == 0 else 8
    for j in range(4):
        for i in range(nbo):
            x = -2.45 + (i + 0.5) * 4.9 / nbo
            b.box(4.9 / nbo - 0.03, 0.36, 0.5, x, sy_ - 0.05, FLR + 0.35 + j * 0.62, hexc(BOLTS[(i * 7 + j * 3) % 10], 0.06, rng), base=True, mat='awning_cloth')
    b.box(3.9, 0.08, 0.66, 0, yb - 0.04, 3.3, NAVY, base=True)
    b.box(4.06, 0.1, 0.06, 0, yb - 0.05, 3.27, GOLD, base=True); b.box(4.06, 0.1, 0.06, 0, yb - 0.05, 3.93, GOLD, base=True)
    carve(b, 'FINE TAILORING', 0, yb - 0.1, 3.63, 3.5, 0.4, Matrix.Rotation(math.pi / 2, 4, 'X'), lod, deep=lod == 0, font=FONT_SIGN)
    C('b', 0, -sy_, 5.5, 0.7, 0)
    # 9. fitting booth (back-left): panelled sides, brass rod, red velvet curtain with a gold tie-back
    fx0, fx1, fy0 = -xi, -xi + 1.9, yb - 1.9
    b.box(0.08, 1.9, 2.4, fx1, fy0 + 0.95, FLR, MAHOG, base=True, mat='timber')
    b.box(1.9, 0.12, 0.3, (fx0 + fx1) / 2, fy0, FLR + 2.3, MAHOG_L, base=True)
    b.cyl(0.02, 0.02, 1.9, fx0, fy0 + 0.08, FLR + 2.25, BRASS, n=6, ry=math.pi / 2)
    nf = 9 if lod == 0 else 4
    for i in range(nf):
        x = fx0 + 0.1 + (i + 0.5) * (1.6 / nf); dy = 0.05 * math.sin(i * 1.7)
        b.box(1.6 / nf + 0.02, 0.08, 2.2, x, fy0 + 0.1 + dy, FLR + 0.03, VELVET if i % 2 else VELVET_D, base=True, mat='awning_cloth')
    b.box(0.12, 0.14, 0.08, fx0 + 1.45, fy0 + 0.05, FLR + 1.1, GOLD, base=True)
    C('b', (fx0 + fx1) / 2, -(fy0 + 0.95), 2.0, 2.05, 0)
    # 10. [outfit-store] a stepped boot stand (back-right): the game's boots on three mahogany tiers (the hat stand went next door)
    hx, hy = xi - 0.85, yb - 1.55
    for k in range(3):
        b.box(1.0 - k * 0.22, 0.9 - k * 0.2, 0.22, hx, hy + k * 0.06, FLR + k * 0.22, MAHOG if k % 2 == 0 else MAHOG_L, base=True, mat='timber')
        if lod == 0: b.box(1.02 - k * 0.22, 0.04, 0.03, hx, hy - (0.9 - k * 0.2) / 2 + k * 0.06, FLR + k * 0.22 + 0.2, BRASS, base=True)
    for k, bp in enumerate(['items/v5/boots_gold_male_lo.glb', 'items/v5/boots_sea_male_lo.glb', 'items/v5/boots_buckle_male_lo.glb'][:3 if lod == 0 else 1]):
        parts = q(bp, None, 0.3); add_item(b, parts, place(parts, hx + (0.18 if k % 2 else -0.18), hy - 0.25 + k * 0.26, FLR + 0.22 * (k + 1), 0.8, rz=-math.pi / 2 + 0.3))
    C('c', hx, -hy, 0.62)
    # 11. potted palms in the front corners
    if lod == 0:
        for s in (-1, 1):
            px, py = s * (xi - 0.45), FY + WALL + 0.45
            b.cyl(0.24, 0.3, 0.5, px, py, FLR, 0x7a4a2a, n=12); b.torus(0.3, 0.03, px, py, FLR + 0.5, BRASS, n=12, m_=4)
            for k in range(7):
                a = k * 2 * math.pi / 7; b.box(0.7, 0.16, 0.03, px + math.cos(a) * 0.32, py + math.sin(a) * 0.32, FLR + 1.05 - 0.1 * (k % 2), hexc(0x2f7a3a, 0.08, rng), rz=a, ry=0.45)
            b.cyl(0.03, 0.04, 0.6, px, py, FLR + 0.45, 0x5a3a1a, n=5)

def signs_aaa(b, sh, lod, rng):
    # crisp carved signage: a navy board with a gilt frame + raised Cinzel capitals over the arch, the same on the hanging sign
    # [outfit-store] the joint building: one long board over the middle pier + a hanging sign at each end (CLOTHING left, ACCESSORIES right)
    w = sh['w']; bw = 12.4 if sh.get('combo') else w * 0.62; z0, z1 = 4.15, 4.95
    b.box(bw, 0.12, z1 - z0, 0, FY - 0.08, (z0 + z1) / 2, NAVY, tag='sign')
    if lod < 2:
        for zz in (z0 + 0.04, z1 - 0.04): b.box(bw + 0.12, 0.17, 0.08, 0, FY - 0.1, zz, GOLD, tag='sign')
        for xx in (-bw / 2, bw / 2): b.box(0.08, 0.17, z1 - z0, xx, FY - 0.1, (z0 + z1) / 2, GOLD, tag='sign')
        for xx in (-bw / 2 + 0.28, bw / 2 - 0.28): b.sphere(0.07, xx, FY - 0.16, (z0 + z1) / 2, GOLD, sub=0)
        carve(b, sh['name'], 0, FY - 0.14, (z0 + z1) / 2, bw - 0.8, (z1 - z0) * 0.56, Matrix.Rotation(math.pi / 2, 4, 'X'), lod, font=FONT_SIGN)
    ends = [(-1, 'CLOTHING', NAVY), (1, 'ACCESSORIES', PLUM_D)] if sh.get('combo') else [(1, 'CLOTHES', NAVY)]
    S = SIGN
    for e, text, bg in ends:
        xs = e * (w / 2 - 0.45)
        b.box(0.08, S['y0'] - S['y1'] + 0.4, 0.08, xs, (S['y0'] + S['y1']) / 2, S['z_bar'], IRON, tag='sign')
        b.box(0.06, 0.06, 1.0, xs, FY - 0.45, S['z_bar'] - 0.35, IRON, rx=0.85, tag='sign')
        b.box(0.3, 0.06, 0.3, xs, FY - 0.03, S['z_bar'] - 0.3, IRON, tag='sign')
        for yy in (S['y0'] + 0.15, S['y1'] - 0.15): b.box(0.04, 0.04, S['z_bar'] - S['z1'], xs, yy, (S['z_bar'] + S['z1']) / 2, IRON, tag='sign')
        b.box(0.14, S['y0'] - S['y1'], S['z1'] - S['z0'], xs, (S['y0'] + S['y1']) / 2, (S['z0'] + S['z1']) / 2, bg, tag='sign')
        if lod < 2:
            for zz in (S['z1'], S['z0']): b.box(0.18, S['y0'] - S['y1'] + 0.08, 0.07, xs, (S['y0'] + S['y1']) / 2, zz, GOLD, tag='sign')
            for s in (-1, 1):
                face = Matrix.Rotation(s * math.pi / 2, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'X')
                carve(b, text, xs + s * 0.075, (S['y0'] + S['y1']) / 2, (S['z0'] + S['z1']) / 2, S['y0'] - S['y1'] - 0.3, (S['z1'] - S['z0']) * 0.5, face, lod, deep=False, font=FONT_SIGN)

# ======================= [outfit-store] CLOTHES & ACCESSORIES: one building, two areas (BANKSY 5:52 PM) =======================
# "Combine clothing and accessories stores, make it 2 different areas of store tho": the clothes shop's 18 m deep walk-in widened to
# 20 m over the old Accessories plot (js/island/outfitStore.js). Two street arches (x -5 / +5), a 1 m panelled middle wall with a
# 3.8 m archway (y 0.8 .. 4.6). CLOTHING (left): oak boards, crimson runner, parchment walls (clothes_aaa, unchanged look).
# ACCESSORIES (right): cream / slate-green marble checker, a plum runner, lilac walls with gilt rails, plaster busts in the window,
# four glass vitrines (earrings, grills + gold teeth, crowns, rings + eyepatches), the hat wall, a cape rack, a make-up vanity, an
# eyewear + mask board, a grills cabinet, the hat stand and its own counter. Each area: its own hanging sign + a carved plate over the
# archway naming the room beyond. No lights: the painted pools are js/island/clothesLook.js (ACC_LAMPS).
DIV, ARCH, ARCH_TOP, ARCH_SPRING = 0.5, (0.8, 4.6), 3.55, 2.75
LILAC, LILAC_D = 0xd8c8da, 0xbca6c4
MARB_A, MARB_B, MARB_V = 0xebe3d1, 0x2f4a46, 0xd9cfb9
PLUM, PLUM_D = 0x4a2a6a, 0x351c4f
PLASTER_F = 0xece4d6   # the blank V7 forms' plaster (js mannequinMaterial)

def hang_sign(b, x, y, text, lod, bg=NAVY, wd=2.8):
    # a carved double-sided board hung off the ceiling on two brass chains, across the hall (read from the door and from the back)
    z0, z1 = 3.0, 3.62
    for sx in (-1, 1):
        b.cyl(0.012, 0.012, CEIL - z1, x + sx * (wd / 2 - 0.25), y, z1, BRASS, n=4)
        b.cyl(0.05, 0.04, 0.04, x + sx * (wd / 2 - 0.25), y, CEIL - 0.34, BRASS, n=6)
    b.box(wd, 0.08, z1 - z0, x, y, (z0 + z1) / 2, bg)
    if lod < 2:
        for zz in (z0, z1): b.box(wd + 0.08, 0.11, 0.05, x, y, zz, GOLD)
        for xx in (x - wd / 2, x + wd / 2): b.box(0.05, 0.11, z1 - z0, xx, y, (z0 + z1) / 2, GOLD)
        for s in (-1, 1):   # text on both faces (normal -y towards the door, +y towards the counter)
            face = Matrix.Rotation(math.pi / 2, 4, 'X') if s < 0 else Matrix.Rotation(math.pi, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'X')
            carve(b, text, x, y + s * 0.05, (z0 + z1) / 2, wd - 0.45, (z1 - z0) * 0.5, face, lod, deep=False, font=FONT_SIGN)

def floor_marble(b, x0, x1, y0, y1, lod, rng):
    t = 0.75 if lod == 0 else 1.5; nx = max(1, round((x1 - x0) / t)); ny = max(1, round((y1 - y0) / t)); tx, ty = (x1 - x0) / nx, (y1 - y0) / ny
    for i in range(nx):
        for j in range(ny):
            c = MARB_A if (i + j) % 2 == 0 else MARB_B
            b.box(tx - 0.008, ty - 0.008, 0.04, x0 + (i + 0.5) * tx, y0 + (j + 0.5) * ty, 0.0, hexc(c, 0.035, rng), base=True, mat='none')

def room_combo(b, sh, lod, rng, ow):
    w = sh['w']; CD = sh['deep']; BY = FY + CD; ya, yb = FY + WALL, BY - WALL; cy = (ya + yb) / 2; L = yb - ya; xo = w / 2 - WALL
    AX = ARCHES(sh); a0, a1 = ARCH
    if lod == 2:
        for ax in AX: b.box(ow, 0.05, OPEN_TOP, ax, FY + 2.5, 0, 0x9a7444, base=True)   # impostor: warm-lit room planes
        return
    # ---- floors: CLOTHING oak boards | ACCESSORIES marble checker, a mahogany sill under the middle wall
    nb = int(9.0 / (0.3 if lod == 0 else 0.6))
    for i in range(nb):
        x = -xo + (i + 0.5) * 9.0 / nb; c = hexc(OAK_A if i % 2 else OAK_B, 0.05, rng)
        if lod == 0:
            cut = ya + L * (0.3 + 0.4 * ((i * 37) % 10) / 10)
            for p0, p1 in ((ya, cut), (cut, yb)): b.box(9.0 / nb - 0.012, p1 - p0 - 0.012, 0.04, x, (p0 + p1) / 2, 0.0, c, base=True, mat='timber')
        else: b.box(9.0 / nb - 0.012, L, 0.04, x, cy, 0.0, c, base=True, mat='timber')
    floor_marble(b, DIV, xo, ya, yb, lod, rng)
    b.box(2 * DIV, L, 0.045, 0, cy, 0.0, MAHOG_D, base=True, mat='timber')
    b.box(2 * DIV + 0.1, a1 - a0, 0.05, 0, (a0 + a1) / 2, 0.0, 0xa8853a, base=True)   # brass threshold through the archway
    # ---- runners: crimson (Clothing) / plum (Accessories), gold borders, door to counter
    r0, r1 = ya + 0.35, 8.2
    for ax, rc in ((AX[0], VELVET), (AX[1], PLUM)):
        b.box(2.2, r1 - r0, 0.016, ax, (r0 + r1) / 2, FLR, rc, base=True, mat='awning_cloth')
        for s in (-1, 1):
            b.box(0.1, r1 - r0, 0.02, ax + s * 1.0, (r0 + r1) / 2, FLR, 0xc9a243, base=True)
            if lod == 0: b.box(0.05, r1 - r0 - 0.3, 0.02, ax + s * 0.8, (r0 + r1) / 2, FLR, 0xd9b45a, base=True)
        for yy in (r0 + 0.05, r1 - 0.05): b.box(2.2, 0.1, 0.02, ax, yy, FLR, 0xc9a243, base=True)
        b.box(ow - 0.1, 0.16, 0.012, ax, FY + WALL / 2, 0.0, 0xa8853a, base=True)   # brass threshold in the street arch
    # ---- walls: wainscot + upper paint + cornice (parchment Clothing, lilac + gilt rail Accessories)
    UP = {-1: dict(), 1: dict(upper=LILAC, rail=0xc9a243)}
    wain_panels(b, -xo, -xo, ya, yb, (1, 0), lod); wain_panels(b, xo, xo, yb, ya, (-1, 0), lod, **UP[1])
    wain_panels(b, -xo, -DIV, yb, yb, (0, -1), lod); wain_panels(b, DIV, xo, yb, yb, (0, -1), lod, **UP[1])
    for k_, ax in enumerate(AX):
        sd = -1 if k_ == 0 else 1; e0, e1 = (-xo, -DIV) if sd < 0 else (DIV, xo)
        wain_panels(b, e0, ax - ow / 2, ya, ya, (0, 1), lod, **UP[sd]); wain_panels(b, ax + ow / 2, e1, ya, ya, (0, 1), lod, **UP[sd])
        b.box(ow, 0.03, CEIL - OPEN_TOP, ax, ya + 0.015, OPEN_TOP, UP[sd].get('upper', PARCH), base=True, mat='none')   # over the door (inside)
        b.box(ow + 0.3, 0.12, 0.18, ax, ya + 0.06, OPEN_TOP - 0.02, MAHOG_L, base=True)   # door head moulding
    # the middle wall: a 1 m core (cream reveal in the archway), panelled on both faces
    for p0, p1 in ((ya, a0), (a1, yb)): b.box(2 * DIV, p1 - p0, CEIL, 0, (p0 + p1) / 2, 0.0, CORN, base=True, mat='none')
    b.box(2 * DIV, a1 - a0, CEIL - ARCH_TOP, 0, (a0 + a1) / 2, ARCH_TOP, CORN, base=True, mat='none')
    for sd in (-1, 1):
        for p0, p1 in ((ya, a0), (a1, yb)): wain_panels(b, sd * DIV, sd * DIV, p1 if sd < 0 else p0, p0 if sd < 0 else p1, (sd, 0), lod, **UP[sd])
        b.box(0.03, a1 - a0, CEIL - ARCH_TOP, sd * (DIV + 0.015), (a0 + a1) / 2, ARCH_TOP, UP[sd].get('upper', PARCH), base=True, mat='none')
        b.box(0.22, a1 - a0 + 0.4, 0.2, sd * (DIV + 0.11), (a0 + a1) / 2, CEIL - 0.2, CORN, base=True, mat='none')
    # the archway: elliptical head (spandrel infill), mahogany jamb casings + an archivolt band + gilt keystone on both faces
    yc, hr, vr = (a0 + a1) / 2, (a1 - a0) / 2, ARCH_TOP - ARCH_SPRING; nseg = 14 if lod == 0 else 8
    for i in range(nseg):
        t0, t1 = i / nseg, (i + 1) / nseg; y0_, y1_ = a0 + t0 * (a1 - a0), a0 + t1 * (a1 - a0); ym = (y0_ + y1_) / 2
        z = ARCH_SPRING + vr * math.sqrt(max(0.0, 1 - ((ym - yc) / hr) ** 2))
        b.box(2 * DIV, y1_ - y0_ + 0.004, ARCH_TOP - z + 0.01, 0, ym, z, CORN, base=True, mat='none')
    for sd in (-1, 1):
        xf = sd * (DIV + 0.05)
        for yy in (a0 - 0.16, a1 + 0.16): b.box(0.1, 0.32, ARCH_SPRING, xf, yy, FLR, MAHOG, base=True, mat='timber')
        for yy in (a0 - 0.16, a1 + 0.16): b.box(0.14, 0.4, 0.14, sd * (DIV + 0.07), yy, ARCH_SPRING - 0.07, MAHOG_L, base=True)   # impost blocks
        na = 16 if lod == 0 else 9
        for i in range(na):
            th0, th1 = math.pi * i / na, math.pi * (i + 1) / na
            p0 = (yc - (hr + 0.14) * math.cos(th0), ARCH_SPRING + (vr + 0.14) * math.sin(th0)); p1 = (yc - (hr + 0.14) * math.cos(th1), ARCH_SPRING + (vr + 0.14) * math.sin(th1))
            ln = math.hypot(p1[0] - p0[0], p1[1] - p0[1]); ang = math.atan2(p1[1] - p0[1], p1[0] - p0[0])
            b.box(0.09, ln + 0.02, 0.24, xf, (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, MAHOG_L, rx=ang)
        b.box(0.12, 0.26, 0.36, sd * (DIV + 0.07), yc, ARCH_TOP + 0.06, GOLD)   # keystone
    # carved plates over the archway naming the room beyond (Clothing face reads ACCESSORIES, Accessories face reads CLOTHING)
    for sd, text in ((-1, 'ACCESSORIES'), (1, 'CLOTHING')):
        xf = sd * (DIV + 0.06); b.box(0.06, 2.3, 0.42, xf, yc, 4.35, NAVY if sd > 0 else PLUM_D)
        if lod < 2:
            for zz in (4.14, 4.56): b.box(0.08, 2.4, 0.04, xf, yc, zz, GOLD)
            face = Matrix.Rotation(sd * math.pi / 2, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'X')
            carve(b, text, sd * (DIV + 0.095), yc, 4.35, 1.9, 0.22, face, lod, deep=False, font=FONT_SIGN)
    # ---- pilasters on the outer walls (cream, gilt capitals)
    if lod == 0:
        for sd in (-1, 1):
            for yy in (ya + 0.25, -0.9, 1.9, 7.3, yb - 0.25):
                b.box(0.12, 0.34, CEIL - 1.2 - 0.2, sd * (xo - 0.06), yy, FLR + 1.19, CORN, base=True, mat='none')
                b.box(0.16, 0.42, 0.14, sd * (xo - 0.08), yy, CEIL - 0.42, BRASS, base=True)
    # ---- coffered ceilings (beams across each hall + spines), three chandeliers a hall, the hanging signs, sconces
    for ax in AX:
        for i in range(7):
            yy = ya + i * L / 6; b.box(9.0, 0.26, 0.3, ax, min(max(yy, ya + 0.13), yb - 0.13), CEIL - 0.3, MAHOG_D, base=True, mat='timber')
        if lod == 0:
            for s in (-1, 1): b.box(0.22, L, 0.22, ax + s * 2.25, cy, CEIL - 0.22, MAHOG_D, base=True, mat='timber')
        for yy in (-2.0, 3.4, 8.2): chandelier(b, ax, yy, lod)
    hang_sign(b, AX[0], -3.75, 'CLOTHING', lod, bg=NAVY)
    hang_sign(b, AX[1], -3.75, 'ACCESSORIES', lod, bg=PLUM_D)
    for sd in (-1, 1):
        for yy in ((-4.4, 1.3, 6.9, 10.5) if lod == 0 else (1.3, 6.9)): sconce(b, sd * (xo - 0.03), yy, 2.75, -sd, lod)
        for yy in ((-4.6, 10.6) if lod == 0 else ()): sconce(b, sd * (DIV + 0.03), yy, 2.75, sd, lod)

def fit_item(parts, x, y, z, size, d_long, d_norm):
    # centre an item, scale its longest extent to `size`, longest axis -> d_long, thinnest axis -> d_norm (both unit tuples)
    mn, mx = bbox_parts(parts); c = (mn + mx) / 2; ext = mx - mn; order = np.argsort(ext); kl, kt = int(order[2]), int(order[0]); km = int(order[1])
    dl, dn = Vector(d_long).normalized(), Vector(d_norm).normalized(); dm = dn.cross(dl)
    src = Matrix.Identity(3); dst = Matrix.Identity(3)
    cols_src = {kl: Vector(np.eye(3)[kl]), kt: Vector(np.eye(3)[kt]), km: Vector(np.eye(3)[km])}
    R = Matrix(((0, 0, 0), (0, 0, 0), (0, 0, 0)))
    for k_, d in ((kl, dl), (kt, dn), (km, dm)):
        for r in range(3): R[r][k_] = d[r]
    if R.determinant() < 0:
        for r in range(3): R[r][km] = -R[r][km]
    return Matrix.Translation((x, y, z)) @ R.to_4x4() @ T(s=size / float(ext[kl])) @ Matrix.Translation((-c[0], -c[1], -c[2]))

def bust(b, q, x, y, lod, hat=None, tint=None, rz=0.0, col_h=1.05):
    # a plaster display bust (same plaster as the blank V7 forms) on a marble column, wearing one of the game's hats
    b.box(0.56, 0.56, 0.1, x, y, FLR, MARB_B, base=True, mat='none'); b.box(0.44, 0.44, col_h - 0.2, x, y, FLR + 0.1, MARB_V, base=True, mat='none')
    b.box(0.56, 0.56, 0.1, x, y, FLR + col_h - 0.1, MARB_B, base=True, mat='none')
    if lod == 0: b.box(0.58, 0.58, 0.025, x, y, FLR + col_h - 0.115, GOLD, base=True)
    zt = FLR + col_h
    b.push(T(x, y, zt, rz=rz))
    b.cyl(0.14, 0.17, 0.06, 0, 0, 0, MAHOG_D, n=12)
    b.sphere(0.2, 0, 0, 0.2, PLASTER_F, sub=2 if lod == 0 else 1, s=(1.45, 0.75, 0.62))        # shoulders + chest
    b.cyl(0.07, 0.065, 0.16, 0, 0, 0.3, PLASTER_F, n=10)                                            # neck
    b.sphere(0.13, 0, 0, 0.56, PLASTER_F, sub=2 if lod == 0 else 1, s=(1.0, 1.08, 1.32))            # egg head
    b.pop()
    if hat:
        parts = q(hat, None, 0.3); add_item(b, parts, T(x, y, 0, rz=rz) @ place(parts, 0, 0, zt + 0.66, 0.92, rz=-math.pi / 2), tint=tint)
    return zt

def vitrine(b, x, y, lod, wx=1.2, wy=1.9):
    # a glass-topped jewellery case: mahogany base, velvet tray, brass corner posts, glass box (mat 2)
    b.box(wx, wy, 0.86, x, y, FLR, MAHOG, base=True, mat='timber')
    b.box(wx + 0.08, wy + 0.08, 0.05, x, y, FLR + 0.86, MAHOG_L, base=True, mat='timber')
    if lod == 0:
        for sx in (-1, 1): b.box(0.03, wy - 0.3, 0.5, x + sx * (wx / 2 + 0.005), y, FLR + 0.2, MAHOG_L, base=True, mat='timber')
        b.box(wx + 0.1, wy + 0.1, 0.06, x, y, FLR, MAHOG_D, base=True)
    b.box(wx - 0.12, wy - 0.12, 0.02, x, y, FLR + 0.91, PLUM_D, base=True, mat='awning_cloth')
    for sx in (-1, 1):
        for sy in (-1, 1): b.box(0.035, 0.035, 0.36, x + sx * (wx / 2 - 0.02), y + sy * (wy / 2 - 0.02), FLR + 0.91, BRASS, base=True)
    for sy in (-1, 1): b.box(wx, 0.035, 0.025, x, y + sy * (wy / 2 - 0.0175), FLR + 1.27, BRASS, base=True)   # top frame only (the glass reads through)
    for sx in (-1, 1): b.box(0.035, wy, 0.025, x + sx * (wx / 2 - 0.0175), y, FLR + 1.27, BRASS, base=True)
    b.box(wx - 0.04, wy - 0.04, 0.36, x, y, FLR + 0.91, 0xcfe6ef, base=True, mat=2)
    return FLR + 0.93

def accessories_aaa(b, sh, lod, rng, cols, xo=5.0):
    b.push(T(xo, 0, 0)); _accessories_aaa(b, sh, lod, rng, lambda *a: cols.append([a[0], a[1] + xo, *a[2:]])); b.pop()

def _accessories_aaa(b, sh, lod, rng, C):
    q = items_for(lod); CD = sh['deep']; xi = 4.5; BY = FY + CD; yb = BY - WALL; ya = FY + WALL
    # 1. window busts on marble columns (hats)
    for sx, hat, tn, rz in ((-1, 'items/v5/hat_tricorn_male_lo.glb', 0x1c1c24, 0.35), (1, 'items/v5/crown_male_lo.glb', None, -0.35)):
        bust(b, q, sx * 3.05, -4.35, lod, hat, tn, rz=rz); C('b', sx * 3.05, 4.35, 0.75, 0.75, 0)
    # 2. four vitrines flanking the plum runner
    V = [(-2.3, -0.4, 'ears'), (2.3, -0.4, 'teeth'), (-2.3, 4.4, 'crowns'), (2.3, 4.4, 'rings')]
    for vx, vy, kind in V:
        zt = vitrine(b, vx, vy, lod); C('b', vx, -vy, 1.3, 2.0, 0)
        if lod == 2: continue
        if kind == 'ears':
            for k, ep in enumerate(['items/v5/earring_hoop_male_lo.glb', 'items/v5/earring_double_male_lo.glb', 'items/v5/earring_skull_male_lo.glb'][:3 if lod == 0 else 1]):
                parts = q(ep, None, None); b.box(0.34, 0.34, 0.05, vx, vy - 0.6 + k * 0.6, zt, 0xe9e1d2, base=True)
                add_item(b, parts, fit_item(parts, vx, vy - 0.6 + k * 0.6, zt + 0.19, 0.28, (0, 0, 1), (0, 1, 0)))
        elif kind == 'teeth':
            for k, gp in enumerate(['items/v5/grill_gold_male_lo.glb', 'items/v5/grill_diamond_male_lo.glb', 'items/v5/tooth_gold_male_lo.glb'][:3 if lod == 0 else 1]):
                parts = q(gp, None, None); b.box(0.38, 0.3, 0.04, vx, vy - 0.6 + k * 0.6, zt, 0xe9e1d2, base=True)
                add_item(b, parts, fit_item(parts, vx, vy - 0.6 + k * 0.6, zt + 0.1, 0.3 if k < 2 else 0.12, (1, 0, 0), (0, 0, 1)))
        elif kind == 'crowns':
            for k, cp in enumerate(['items/v5/crown_male_lo.glb', 'items/item_crown_lo.glb'][:2 if lod == 0 else 1]):
                yy = vy - 0.42 + k * 0.84; b.cyl(0.16, 0.15, 0.08, vx, yy, zt, VELVET, n=12)
                if lod == 0: [b.sphere(0.03, vx + 0.13 * math.cos(a), yy + 0.13 * math.sin(a), zt + 0.08, GOLD, sub=0) for a in (0.8, 2.4, 3.9, 5.5)]
                parts = q(cp, None, None); add_item(b, parts, place(parts, vx, yy, zt + 0.08, 0.6 if k == 0 else 1.0))
        else:   # rings (gold tori + gems) and eyepatches
            for k in range(6 if lod == 0 else 2):
                rx_, ry_ = vx - 0.22 + (k % 2) * 0.44, vy - 0.65 + (k // 2) * 0.32
                b.torus(0.045, 0.012, rx_, ry_, zt + 0.06, GOLD, n=12, m_=4, rx=math.pi / 2)
                b.sphere(0.022, rx_, ry_, zt + 0.12, [0xd8322f, 0x2a6df4, 0x3fca45, 0xf2efe6, 0xffd43b, 0x9b5cff][k], sub=0, mat=1)
            parts = q('items/v5/eyes_eyepatch_male_lo.glb', None, None); add_item(b, parts, fit_item(parts, vx, vy + 0.55, zt + 0.06, 0.3, (1, 0, 0), (0, 0, 1)))
    # 3. right wall: the hat wall (navy board, brass pegs, the game's hats) over a console
    hy0, hy1 = -3.4, 0.4
    b.box(0.5, hy1 - hy0, 0.85, xi - 0.25, (hy0 + hy1) / 2, FLR, MAHOG, base=True, mat='timber'); b.box(0.56, hy1 - hy0 + 0.1, 0.05, xi - 0.27, (hy0 + hy1) / 2, FLR + 0.85, MAHOG_L, base=True)
    b.box(0.04, hy1 - hy0 + 0.2, 1.7, xi - 0.02, (hy0 + hy1) / 2, FLR + 1.25, PARCH, base=True, mat='none')   # pale board: the dark hats read
    if lod < 2:
        for zz in (FLR + 1.25, FLR + 2.95): b.box(0.06, hy1 - hy0 + 0.3, 0.05, xi - 0.04, (hy0 + hy1) / 2, zz, GOLD, base=True)
    hats = [('items/v5/hat_tricorn_male_lo.glb', 0x6a2a1c), ('items/v5/hat_bicorne_male_lo.glb', 0x1f2a4a), ('items/v5/helmet_hq_male_lo.glb', None),
            ('items/v5/hat_bandana_male_lo.glb', 0xd8322f), ('items/v5/hat_tricorn_male_lo.glb', 0x1c1c24), ('items/v5/hat_bandana_male_lo.glb', 0x2a6df4)]
    for k, (hp, tn) in enumerate(hats if lod == 0 else hats[:3]):
        yy = hy0 + 0.6 + (k % 3) * 1.3; zz = FLR + 2.35 - (k // 3) * 0.75
        b.box(0.28, 0.04, 0.04, xi - 0.14, yy, zz - 0.05, BRASS)
        parts = q(hp, None, 0.3); add_item(b, parts, place(parts, xi - 0.3, yy, zz - 0.03, 0.78, rz=math.pi / 2), tint=tn)
    if lod == 0:
        for k in range(4): b.cyl(0.17, 0.17, 0.26, xi - 0.25, hy0 + 0.5 + k * 0.92, FLR + 0.9, [0xd8322f, 0xf2efe6, 0x2a6df4, 0xffd43b][k], n=12)   # hat boxes
    C('b', xi - 0.25, -(hy0 + hy1) / 2, 0.7, hy1 - hy0 + 0.2, 0)
    # 4. right wall: a brass cape rack (captain / royal / tattered capes) with folded scarves on its shelves
    capes = ['items/v5/cape_captain_male_lo.glb', 'items/v5/cape_royal_male_lo.glb', 'items/v5/cape_tattered_male_lo.glb']
    xs = rack(b, q, xi - 0.42, 1.4, 5.0, lod, capes, [0x8a1c1c, 0x2a3a8a, 0x3a3a3a], rng, side=-1, S=1.75)
    if lod == 0:
        for k in range(5): stack(b, xi - 0.28, 1.85 + k * 0.68, FLR + 2.5, [BOLTS[(k * 3 + i) % 10] for i in range(3)], lod, rng, sw=0.34, sd=0.4, n=3)
        for k in range(4): stack(b, xs, 1.9 + k * 0.85, FLR + 0.26, [BOLTS[(k * 5 + i) % 10] for i in range(3)], lod, rng, sw=0.3, sd=0.36, h=0.05, n=3)
    C('b', xi - 0.42, -3.2, 0.95, 3.8, 0)
    # 5. right wall, back: the make-up vanity (oval gilt mirror, face-paint pots, powder puffs) + a velvet stool
    vy = 6.9
    b.box(0.6, 1.7, 0.78, xi - 0.3, vy, FLR, MAHOG, base=True, mat='timber'); b.box(0.66, 1.8, 0.05, xi - 0.32, vy, FLR + 0.78, MAHOG_L, base=True)
    b.push(T(xi - 0.05, vy, FLR + 1.75)); b.cyl(0.62, 0.62, 0.05, 0, 0, 0, GOLD, n=20 if lod == 0 else 12, ry=math.pi / 2); b.pop()
    b.push(T(xi - 0.09, vy, FLR + 1.75) @ T(s=(1, 1, 1.25))); b.cyl(0.54, 0.54, 0.02, 0, 0, 0, 0xcfe0e8, n=20 if lod == 0 else 12, ry=math.pi / 2, mat=1); b.pop()
    if lod < 2:
        for k in range(6 if lod == 0 else 3): b.cyl(0.06, 0.06, 0.07, xi - 0.35, vy - 0.6 + k * 0.24, FLR + 0.83, [0xd8322f, 0xf2efe6, 0x2a6df4, 0x161616, 0xffd43b, 0x3fca45][k], n=8)
        parts = q('items/v5/facepaint_retardio_male_lo.glb', None, None); add_item(b, parts, fit_item(parts, xi - 0.3, vy + 0.62, FLR + 0.95, 0.22, (1, 0, 0), (0, 0, 1)))
    b.cyl(0.24, 0.26, 0.45, xi - 1.05, vy, FLR, MAHOG_D, n=12); b.cyl(0.27, 0.27, 0.1, xi - 1.05, vy, FLR + 0.45, VELVET, n=14)
    C('b', xi - 0.3, -vy, 0.75, 1.9, 0); C('c', xi - 1.05, -vy, 0.33)
    # 6. middle wall, front: the eyewear + mask board (VR goggles, eyepatches, luchador masks on plaster head knobs) over a console
    ey0, ey1 = -4.2, 0.2; xl = -xi
    b.box(0.45, ey1 - ey0, 0.85, xl + 0.225, (ey0 + ey1) / 2, FLR, MAHOG, base=True, mat='timber'); b.box(0.5, ey1 - ey0 + 0.1, 0.05, xl + 0.25, (ey0 + ey1) / 2, FLR + 0.85, MAHOG_L, base=True)
    b.box(0.04, ey1 - ey0 + 0.2, 1.6, xl + 0.02, (ey0 + ey1) / 2, FLR + 1.3, NAVY, base=True)
    if lod < 2:
        for zz in (FLR + 1.3, FLR + 2.9): b.box(0.06, ey1 - ey0 + 0.3, 0.05, xl + 0.04, (ey0 + ey1) / 2, zz, GOLD, base=True)
    eye = [('items/v5/eyes_vr_male_lo.glb', None), ('items/v5/mask_luchador_male_lo.glb', 0xd8322f), ('items/v5/eyes_eyepatch_male_lo.glb', None), ('items/v5/mask_luchador_male_lo.glb', 0x2a6df4)]
    for k, (ep, tn) in enumerate(eye if lod == 0 else eye[:2]):
        yy = ey0 + 0.6 + k * 1.05; zz = FLR + 2.1
        b.cyl(0.025, 0.025, 0.24, xl + 0.02, yy, zz, BRASS, n=5, ry=math.pi / 2)
        b.sphere(0.17, xl + 0.4, yy, zz, PLASTER_F, sub=2 if lod == 0 else 1, s=(1, 1, 1.25))
        parts = q(ep, None, None); add_item(b, parts, fit_item(parts, xl + 0.64, yy, zz + 0.04, 0.38, (0, 1, 0), (1, 0, 0)), tint=tn)   # worn in front of the knob
    if lod == 0:
        for k in range(5):   # trays of rings / chains on the console
            b.box(0.34, 0.5, 0.04, xl + 0.25, ey0 + 0.5 + k * 0.85, FLR + 0.88, PLUM_D, base=True)
            for j in range(3): b.torus(0.05, 0.01, xl + 0.25, ey0 + 0.36 + k * 0.85 + j * 0.14, FLR + 0.93, GOLD, n=10, m_=3)
    C('b', xl + 0.25, -(ey0 + ey1) / 2, 0.6, ey1 - ey0 + 0.2, 0)
    # 7. middle wall, back: a tall glass wall cabinet (gold teeth, grills, chains on velvet steps)
    gy0, gy1 = 5.4, 8.2
    b.box(0.6, gy1 - gy0, 2.5, xl + 0.3, (gy0 + gy1) / 2, FLR, MAHOG, base=True, mat='timber')
    b.box(0.7, gy1 - gy0 + 0.12, 0.12, xl + 0.33, (gy0 + gy1) / 2, FLR + 2.5, MAHOG_L, base=True)
    for j in range(3): b.box(0.5, gy1 - gy0 - 0.12, 0.04, xl + 0.32, (gy0 + gy1) / 2, FLR + 0.9 + j * 0.52, PLUM_D, base=True)
    b.box(0.02, gy1 - gy0 - 0.1, 1.6, xl + 0.6, (gy0 + gy1) / 2, FLR + 0.86, 0xcfe6ef, base=True, mat=2)
    if lod < 2:
        gl = ['items/v5/grill_gold_male_lo.glb', 'items/v5/grill_diamond_male_lo.glb', 'items/v5/tooth_gold_male_lo.glb']
        for j in range(3):
            for k in range(3 if lod == 0 else 1):
                parts = q(gl[(j + k) % 3], None, None); add_item(b, parts, fit_item(parts, xl + 0.32, gy0 + 0.5 + k * 0.9, FLR + 0.98 + j * 0.52, 0.18 if (j + k) % 3 < 2 else 0.07, (0, 1, 0), (0, 0, 1)))
    C('b', xl + 0.3, -(gy0 + gy1) / 2, 0.75, gy1 - gy0 + 0.2, 0)
    # 8. the accessories counter (the prompt stands in front of it): mahogany + a glass display top, a ring tray, register, hat box
    ky = 9.2
    b.box(5.2, 0.9, 0.98, 0, ky, FLR, MAHOG, base=True, mat='timber')
    b.box(5.4, 1.06, 0.07, 0, ky, FLR + 0.98, MAHOG_L, base=True, mat='timber')
    b.box(5.24, 0.04, 0.12, 0, ky - 0.47, FLR, BRASS, base=True)
    b.box(3.2, 0.6, 0.02, -0.6, ky - 0.1, FLR + 1.05, PLUM_D, base=True)
    b.box(3.2, 0.6, 0.22, -0.6, ky - 0.1, FLR + 1.05, 0xcfe6ef, base=True, mat=2)
    if lod == 0:
        for i in range(5):
            x = -2.08 + i * 1.04
            b.box(0.84, 0.03, 0.56, x, ky - 0.46, FLR + 0.24, MAHOG_L, base=True, mat='timber'); b.box(0.7, 0.02, 0.44, x, ky - 0.475, FLR + 0.3, MAHOG, base=True, mat='timber')
        b.box(5.42, 0.05, 0.04, 0, ky - 0.53, FLR + 1.0, BRASS, base=True)
        for k in range(8): b.torus(0.04, 0.01, -1.9 + k * 0.4, ky - 0.1, FLR + 1.1, GOLD, n=10, m_=3, rx=math.pi / 2)
        b.sphere(0.07, 1.4, ky - 0.15, FLR + 1.1, BRASS, sub=1, s=(1, 1, 0.7))
    b.box(0.5, 0.42, 0.3, 1.9, ky + 0.1, FLR + 1.05, BRASS, base=True); b.box(0.5, 0.2, 0.22, 1.9, ky + 0.26, FLR + 1.35, 0xb08a38, base=True, rx=-0.4)
    b.cyl(0.2, 0.2, 0.28, 1.0, ky + 0.2, FLR + 1.05, 0xd8322f, n=12); b.cyl(0.21, 0.21, 0.05, 1.0, ky + 0.2, FLR + 1.33, 0xf2efe6, n=12)
    C('b', 0, -ky, 5.5, 1.15, 0)
    # 9. back wall: hat-box shelving + a carved FINE ACCESSORIES plate
    sy_ = yb - 0.26
    b.box(5.4, 0.5, 2.7, 0, sy_, FLR, MAHOG, base=True, mat='timber')
    for j in range(4): b.box(5.3, 0.46, 0.05, 0, sy_ - 0.02, FLR + 0.3 + j * 0.62, MAHOG_L, base=True)
    nbx = 8 if lod == 0 else 4
    HB = [0xd8322f, 0xf2efe6, 0x2a6df4, 0xffd43b, 0x6a4fb3, 0x1f8a5a, 0x161616, 0xff8a3d]
    for j in range(4):
        for i in range(nbx):
            x = -2.4 + (i + 0.5) * 4.8 / nbx; c = HB[(i * 3 + j * 5) % 8]
            b.cyl(0.24 if lod == 0 else 0.26, 0.24 if lod == 0 else 0.26, 0.42, x, sy_ - 0.05, FLR + 0.35 + j * 0.62, hexc(c, 0.05, rng), n=12 if lod == 0 else 8)
            if lod == 0: b.cyl(0.25, 0.25, 0.06, x, sy_ - 0.05, FLR + 0.72 + j * 0.62, GOLD if (i + j) % 2 else 0xf2efe6, n=12)
    b.box(3.9, 0.08, 0.66, 0, yb - 0.04, 3.3, PLUM_D, base=True)
    b.box(4.06, 0.1, 0.06, 0, yb - 0.05, 3.27, GOLD, base=True); b.box(4.06, 0.1, 0.06, 0, yb - 0.05, 3.93, GOLD, base=True)
    carve(b, 'FINE ACCESSORIES', 0, yb - 0.1, 3.63, 3.5, 0.4, Matrix.Rotation(math.pi / 2, 4, 'X'), lod, deep=lod == 0, font=FONT_SIGN)
    C('b', 0, -sy_, 5.5, 0.7, 0)
    # 10. the hat stand (back-left, by the middle wall) with real hats
    hx, hy = -xi + 0.95, yb - 1.55
    b.cyl(0.3, 0.32, 0.06, hx, hy, FLR, MAHOG_D, n=12); b.cyl(0.05, 0.05, 1.95, hx, hy, FLR, MAHOG_D, n=8); b.sphere(0.07, hx, hy, FLR + 1.97, BRASS, sub=0)
    for i, (p, tint) in enumerate([('items/v5/hat_tricorn_male_lo.glb', 0x6a2a1c), ('items/v5/hat_bicorne_male_lo.glb', 0x1f2a4a), ('items/v5/hat_bandana_male_lo.glb', 0xd8322f), ('items/v5/helmet_hq_male_lo.glb', None)][:4 if lod == 0 else 2]):
        a = i * math.pi / 2 + 0.4; px, py, pz = hx + math.cos(a) * 0.4, hy + math.sin(a) * 0.4, FLR + 1.35 + (i % 2) * 0.42
        b.box(0.4, 0.035, 0.035, hx + math.cos(a) * 0.2, hy + math.sin(a) * 0.2, pz - 0.03, MAHOG_D, rz=a)
        parts = q(p, None, 0.3); add_item(b, parts, place(parts, px, py, pz, 0.85, rz=-a + math.pi / 2), tint=tint)
    C('c', hx, -hy, 0.45)
    # 11. back-right: a third bust (bicorne) on a taller column; potted palms in the front corners
    bust(b, q, xi - 0.85, yb - 1.55, lod, 'items/v5/hat_bicorne_male_lo.glb', 0x2a1d3a, rz=-0.6, col_h=1.25); C('b', xi - 0.85, -(yb - 1.55), 0.75, 0.75, 0)
    if lod == 0:
        for sd in (-1, 1):
            px, py = sd * (xi - 0.45), ya + 0.45
            b.cyl(0.24, 0.3, 0.5, px, py, FLR, 0x3a4a6a, n=12); b.torus(0.3, 0.03, px, py, FLR + 0.5, BRASS, n=12, m_=4)
            for k in range(7):
                a = k * 2 * math.pi / 7; b.box(0.7, 0.16, 0.03, px + math.cos(a) * 0.32, py + math.sin(a) * 0.32, FLR + 1.05 - 0.1 * (k % 2), hexc(0x2f7a3a, 0.08, rng), rz=a, ry=0.45)
            b.cyl(0.03, 0.04, 0.6, px, py, FLR + 0.45, 0x5a3a1a, n=5)

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
        if lod < 2 and not sh.get('plain'):
            market_props(b, sh, lod, rng, cols if lod == 0 else [])
            if sh.get('combo'): clothes_aaa(b, sh, lod, rng, cols if lod == 0 else [], xo=-5.0); accessories_aaa(b, sh, lod, rng, cols if lod == 0 else [], xo=5.0)   # [outfit-store]
            elif sh.get('deep'): clothes_aaa(b, sh, lod, rng, cols if lod == 0 else [])   # [clothes-aaa]
            else: INTERIOR[sh['id']](b, sh, lod, rng)
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
