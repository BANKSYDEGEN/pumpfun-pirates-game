# [Timothy] PUMPFUN PIRATES hill street (Main Street, plaza -> town gate) as Blender-made models (BANKSY 7:35 PM "fix the buildings up the
# hill and make them match the plaza buildings and look good" + his Port Royal reference: brick / stone ground floors, timber upper floors,
# balconies with plants, wall lanterns, hanging carved signs, open shopfronts with awnings; "multi story on both sides"; "make them all shops").
#   blender -b --factory-startup -P tools/hill_blender/hill_street_blender.py -- GAME_DIR OUT_DIR
# Same toolkit, palette + material buckets as the plaza shops (tools/plaza_blender/lib.py: vertex colour only, solid / glow).
# Every lot of js/island/foot.js buildStreet (L0-L12, R1-R12 minus R4 = the well square, R0 = the Squad Hall) becomes one 2-3 storey building:
#   L6 = SWORD SHOP, R6 = MUSKET SHOP (own GLBs, door_swords / door_muskets + sign_swords / sign_muskets, Emerly's js/onfoot/battle.js),
#   every other ground floor = an EMPTY RENTABLE SHOP (open front, walkable room, counter, TO RENT board, door_rent_<n>, blank sign_rent_<n>).
# Building frame: Blender x = along the street (three.js x), -y = out of the front (three.js +z), z up; origin = lot centre at its ground.
# The street climbs 0.11 m/m (foot.js coastH), so the ground under a building is z = g * x (g = +0.11 west row, -0.11 east row): stepped
# plinths, floors that follow the walk height, a buried foundation (no floating or sunk walls).
import bpy, sys, os, math, json, random
import numpy as np
from mathutils import Matrix
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'plaza_blender'))
from lib import Builder, T, hexc, text_mesh

argv = sys.argv[sys.argv.index('--') + 1:]
GAME, OUT = argv[0], argv[1]; os.makedirs(OUT, exist_ok=True)
FONT = os.path.join(GAME, 'assets/JustAnotherHand.ttf')
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- palette: the plaza's (plaza_shops_blender.py) + warm brick / sandstone / weathered timber from the reference ----
STONES = [0xc9bfae, 0xb9b2a6, 0xd6c7a8, 0xbdb3a2]; SAND = [0xd9b98a, 0xcca777, 0xd2b48c]; BRICK = [0xa45a3c, 0x9a5038, 0xb0674a]
QUOIN, MORTAR = 0x8a837a, 0x6f675d
ROOFS = [0xc8552e, 0xb8472a, 0xd2693a, 0xa94428]; SHUT = [0x2a6df4, 0x1f8a5a, 0xc0392b, 0x2b8fa3, 0x8a5a2b, 0x6a4fb3]
WOOD, WOOD_D, WOOD_L, IRON, GOLD = 0xa86a3a, 0x5e3b20, 0xd9a36b, 0x2b2f36, 0xffc93c
PLASTERS = [0xf3e6c8, 0xe9cf9f, 0xdcb98a, 0xf0dcc0]; PLANK = [0x8a6a4a, 0x7a5a3c, 0x9a7650]
LEAF = [0x3f8f3a, 0x2f7a32, 0x5aa040]; FLOWERS = [0xd8322f, 0xffd43b, 0xff7ab5, 0xf2efe6, 0xb36bff]
GLOW, FLOOR_A, FLOOR_B, PLASTER_IN = 0xffc46b, 0xb07a45, 0x9a6638, 0xeadcc0
AWN = [0xd8322f, 0x2a6df4, 0x1f8a5a, 0xffc93c, 0x6a4fb3, 0x8a1c1c]
WALL, G, U, OPEN_TOP = 0.5, 4.4, 3.3, 3.4
# [material library] palette -> shared library layer (materials.py: the same stone / brick / plaster / timber / tiles as the plaza, docks, battery
# and the hilltop fort; nearest within 0.1 for the jittered colours); awnings + modelled block faces are named where built
Builder.AUTO = {**{c: 'stone_ashlar' for c in STONES + SAND}, **{c: 'brick' for c in BRICK}, QUOIN: 'stone_trim', MORTAR: 'stone_trim',
                **{c: 'roof_tile' for c in ROOFS}, **{c: 'timber' for c in (WOOD, WOOD_D, WOOD_L, *SHUT)}, IRON: 'iron',
                **{c: 'plaster' for c in PLASTERS + [PLASTER_IN, 0xe8d8b8]}, **{c: 'planks_weathered' for c in PLANK + [FLOOR_A, FLOOR_B]}}

# ---- the lots (keep in sync with js/island/foot.js buildStreet: STREET, lots, street dressing) ----
def jh(i, j): s = math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - math.floor(s)
SX, Z0, Z1, HALF = 6, -58, -205, 7
LOTS = []; z = Z0 - 10; n = 0
while z > Z1 + 8: w = 7 + jh(n, 3) * 4; LOTS.append((z - w / 2, w, n)); z -= w + 1.6; n += 1
CRATES = [(1 if i % 2 else -1, Z0 - 8 - i * 6.4) for i in range(22)]            # barrels / crates / sacks against the walls (r 0.8)
# Post's js/island/areas/route.js Main Street furniture (benches L * 0.33 / 0.66 + the notice board L * 0.5 along lz -58 -> the gate, 2.2 m long):
# a doorway is kept clear of them too (the board stood in front of the SWORD SHOP door). s = +1 = the west row here.
_RL = abs((Z1) - (-58)); POST = [(-1, -58 - _RL * 0.33), (1, -58 - _RL * 0.66), (-1, -58 - _RL * 0.5)]
LAMPS = [zz for zz in np.arange(Z0 - 6, Z1, -16)]
gyl = lambda lz: 3.0 + max(0, -lz - 50) * 0.11                                    # walk height (town-local)
SKIP = {(1, 0), (1, 4)}                                                           # R0 Squad Hall, R4 the well square
B = []
for side in (-1, 1):
    for (zc, w, n) in LOTS:
        if (side, n) in SKIP: continue
        d = 8 + jh(side, n) * 2; lx = SX + side * (HALF + 1 + d / 2)
        key = ('L' if side < 0 else 'R') + str(n)
        kind = 'sword' if key == 'L6' else 'musket' if key == 'R6' else 'rent'
        fl = 3 if kind != 'rent' else [2, 3, 3, 2, 3, 2, 3][(n * 3 + (side > 0) * 2) % 7]
        style = 'stone' if kind == 'sword' else 'timber' if kind == 'musket' else ['stone', 'timber', 'plank'][(n + (side > 0)) % 3]
        roof = 'gable' if kind != 'rent' else ('gable' if (n * 5 + side) % 4 == 1 else 'ridge')
        Gb = 5.4 if kind != 'rent' else [4.6, 5.0, 4.8][(n + (side > 0)) % 3]
        B.append(dict(G=Gb, key=key, side=side, n=n, lz=zc, lx=lx, w=w, d=d, fl=fl, style=style, roof=roof, kind=kind, v=(n * 2 + (side > 0)) % 12))
_sq = LOTS[0][0] - 3; OBST = [(SX + HALF + 1 + 7 - 7.3, SX + HALF + 1 + 7 + 7.3, _sq - 8.3, _sq + 8.3)] + [(SX + s_ * (HALF + 1.6) - 1.7, SX + s_ * (HALF + 1.6) + 1.7, Z1 + 4 - 1.7, Z1 + 4 + 1.7) for s_ in (-1, 1)]
def neigh(b, dn):
    for o in B:
        if o['side'] == b['side'] and o['n'] == b['n'] + dn: return o
    return None
for b in B:   # close the 1.6 m gaps: each building takes half the gap on a side where the row continues
    up, dn = neigh(b, 1), neigh(b, -1); eu, ed = (0.8 if up else 0.0), (0.8 if dn else 0.0)
    b['end0'], b['end1'] = ((not dn), (not up)) if b['side'] < 0 else ((not up), (not dn))   # local -x / +x end has no neighbour
    b['g'] = 0.11 if b['side'] < 0 else -0.11                                     # local +x = uphill on the west row, downhill on the east row
    ep, em = (eu, ed) if b['side'] < 0 else (ed, eu)                              # extension on local +x / -x
    b['x0'], b['x1'] = -b['w'] / 2 - em, b['w'] / 2 + ep
    b['y'] = gyl(b['lz'])
    # clip against what already stands on the lot edges: the Squad Hall (R0, 16 x 14 m, foot.js) and the two town-gate pillars
    for (a0, a1, c0, c1) in OBST:
        if b['lx'] + b['d'] / 2 < a0 or b['lx'] - b['d'] / 2 > a1: continue
        lo, hi = ((b['lz'] - c1, b['lz'] - c0) if b['side'] < 0 else (c0 - b['lz'], c1 - b['lz']))
        if hi < b['x0'] or lo > b['x1']: continue
        if (lo + hi) / 2 > 0: b['x1'] = min(b['x1'], lo - 0.05)
        else: b['x0'] = max(b['x0'], hi + 0.05)
    # doorway: as central as possible, clear of the street barrels / crates (foot.js) so you can always walk in
    s = b['side']; loc = lambda lz: (b['lz'] - lz) if s < 0 else (lz - b['lz'])
    cr = [loc(zc) for (cs, zc) in CRATES if cs == s] + [loc(zc) + k for (cs, zc) in POST if cs == s for k in (-0.6, 0.0, 0.6)]; lp = [loc(zz) for zz in LAMPS]
    best = None
    for (mg, ow, fmin) in [(1.3, 3.6, 1.3), (1.3, 3.2, 1.3), (1.3, 2.8, 1.3), (0.8, 2.8, 1.3), (0.75, 2.4, 1.3), (0.6, 2.4, 1.0)]:
        for k in range(0, 80):
            for sg in (1, -1):
                xo = (b['x0'] + b['x1']) / 2 + sg * k * 0.1
                if xo - ow / 2 < b['x0'] + mg or xo + ow / 2 > b['x1'] - mg: continue
                a0, a1 = xo - ow / 2, xo + ow / 2; segs_ = [(a0, a1)]
                for c in cr:   # the clear walk-in width left beside each crate (circle r 0.8 + the walker's 0.45)
                    segs_ = [q for (p0, p1) in segs_ for q in ((p0, min(p1, c - 1.25)), (max(p0, c + 1.25), p1)) if q[1] - q[0] > 0.01]
                free = max([q[1] - q[0] for q in segs_] or [0])
                if free < fmin: continue
                pen = (0 if free >= ow - 0.01 else 1) + sum(1 for c in lp if abs(xo - c) < ow / 2 + 0.2)
                cand = (pen, abs(xo - (b['x0'] + b['x1']) / 2), -ow, xo, ow)
                if best is None or cand < best: best = cand
        if best and best[0] == 0: break
    if best is None: print('NO CLEAR DOOR', b['key'], b['x0'], b['x1'], cr); best = (9, 0, 0, (b['x0'] + b['x1']) / 2, min(2.4, b['x1'] - b['x0'] - 1.4))
    b['xo'], b['ow'] = best[3], best[4]
RENT = [b for b in B if b['kind'] == 'rent']
for i, b in enumerate(RENT): b['rent'] = i + 1

def wall_rects(x0, x1, z0, z1, holes):
    zs = sorted({z0, z1, *[h[2] for h in holes if z0 < h[2] < z1], *[h[3] for h in holes if z0 < h[3] < z1]}); out = []
    for a, bb in zip(zs, zs[1:]):
        xs = [(h[0], h[1]) for h in holes if h[2] < bb - 1e-6 and h[3] > a + 1e-6]; cur = x0
        for hx0, hx1 in sorted(xs):
            if hx0 > cur + 1e-6: out.append((cur, hx0, a, bb))
            cur = max(cur, hx1)
        if x1 > cur + 1e-6: out.append((cur, x1, a, bb))
    return out

def ashlar(bd, rects, y, col, rng, rh=0.46):
    for (x0, x1, z0, z1) in rects:
        for k in range(int(math.floor(z0 / rh)), int(math.ceil(z1 / rh))):
            za, zb = max(z0, k * rh), min(z1, (k + 1) * rh)
            if zb - za < 0.08: continue
            r2 = random.Random(k * 7919); x = -40 + (0.45 if k % 2 else 0)
            while x < x1:
                bw = r2.uniform(0.7, 1.15); xa, xb = max(x0, x), min(x1, x + bw)
                if xb - xa > 0.1: bd.box(xb - xa - 0.04, 0.07, zb - za - 0.04, (xa + xb) / 2, y - 0.035, (za + zb) / 2, hexc(col, 0.07, rng), mat='brick' if col in BRICK else 'stone_trim')   # block faces
                x += bw

def carve(bd, text, cx, cy, cz, wfit, hfit, face, lod, col=GOLD):
    V, F, _ = text_mesh(text, FONT, size=1.0, extrude=0.025 if lod == 0 else 0.0, res=2 if lod == 0 else 1)
    if lod: V = V + [0, 0, 0.012]
    mn, mx = V.min(0), V.max(0); s = min(wfit / (mx[0] - mn[0]), hfit / (mx[1] - mn[1]))
    V = (V - [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]) * [s, s, 1]
    bd.mesh(V, F, col, m=Matrix.Translation((cx, cy, cz)) @ face, smooth=False)
FRONT = Matrix.Rotation(math.pi / 2, 4, 'X')        # text normal -> -y (out of the front)

def window(bd, x, z0, h, fy, sh, lod, rng, lit=False, box_=True, stone=True):
    ww = 1.1
    bd.box(ww, 0.08, h, x, fy + 0.22, z0 + h / 2, GLOW if lit else 0x22313d, mat=1 if lit else 0)
    bd.box(ww + 0.16, 0.1, 0.1, x, fy - 0.02, z0 + h + 0.03, QUOIN if stone else WOOD_D)                   # head
    bd.box(ww + 0.3, 0.3, 0.12, x, fy - 0.1, z0 - 0.04, QUOIN if stone else WOOD_D)                       # sill
    for s in (-1, 1):   # open shutters
        bd.push(T(x + s * (ww / 2 + 0.04), fy - 0.05, z0, rz=s * 0.55)); bd.box(0.56, 0.06, h, s * 0.28, -0.03, h / 2, sh)
        if lod == 0:
            for i in range(int(h / 0.26)): bd.box(0.46, 0.04, 0.035, s * 0.28, -0.07, 0.16 + i * 0.26, hexc(sh, 0.15, rng))
        bd.pop()
    if lod == 0:
        bd.box(0.05, 0.05, h, x, fy + 0.17, z0 + h / 2, WOOD_D); bd.box(ww, 0.05, 0.05, x, fy + 0.17, z0 + h * 0.55, WOOD_D)
        if stone: bd.box(0.3, 0.3, 0.36, x, fy - 0.08, z0 + h + 0.12, hexc(STONES[1], 0.05, rng))           # keystone
        if box_:   # flower box
            bd.box(ww + 0.2, 0.3, 0.26, x, fy - 0.32, z0 - 0.0, WOOD_D)
            for i in range(5): bd.sphere(0.14, x - 0.48 + i * 0.24, fy - 0.33, z0 + 0.22, FLOWERS[(i + int(x * 7)) % 5] if i % 2 else LEAF[i % 3], sub=0)

def plant(bd, x, y, z, rng, s=1.0):   # potted plant (terracotta pot + leafy crown + flowers)
    bd.cyl(0.2 * s, 0.26 * s, 0.36 * s, x, y, z, 0xb8562e, n=8)
    for i in range(4): bd.sphere(0.24 * s, x + math.cos(i * 1.7) * 0.14 * s, y + math.sin(i * 1.7) * 0.14 * s, z + 0.5 * s + (i % 2) * 0.1, hexc(LEAF[i % 3], 0.1, rng), sub=1)
    bd.sphere(0.07, x + 0.1, y - 0.15, z + 0.75 * s, FLOWERS[int(abs(x) * 10) % 5], sub=0)

def vine(bd, x, y, z0, z1, rng):   # climbing vine down a wall / balcony post
    z = z1
    while z > z0:
        bd.sphere(rng.uniform(0.12, 0.2), x + rng.uniform(-0.25, 0.25), y, z, hexc(LEAF[int(z * 3) % 3], 0.15, rng), sub=0, s=(1.3, 0.45, 0.9)); z -= rng.uniform(0.18, 0.34)

def balcony(bd, x0, x1, fy, zf, dep, lod, rng, plants=True):
    bw = x1 - x0; cx = (x0 + x1) / 2
    bd.box(bw, dep, 0.2, cx, fy - dep / 2, zf - 0.2, WOOD, base=True)
    bd.box(bw + 0.06, 0.12, 0.12, cx, fy - dep + 0.06, zf + 1.0, WOOD_D)
    if lod == 0:
        nb = int(bw / 0.3)
        for i in range(nb + 1): bd.box(0.07, 0.07, 1.0, x0 + i * bw / nb, fy - dep + 0.06, zf, WOOD_L, base=True)
        for i in range(int(bw / 0.6)): bd.box(0.14, dep, 0.12, x0 + 0.3 + i * 0.6, fy - dep / 2, zf - 0.32, WOOD_D)        # joist ends
    else:
        bd.box(bw, 0.05, 0.9, cx, fy - dep + 0.06, zf, WOOD_L, base=True)
    for s in (x0, x1):
        bd.box(0.12, 0.12, 1.05, s, fy - dep + 0.06, zf, WOOD_D, base=True); bd.box(0.12, dep, 0.12, s, fy - dep / 2, zf + 1.0, WOOD_D)
        bd.box(0.16, 0.16, 1.2, s + (0.35 if s == x0 else -0.35), fy - 0.45, zf - 0.62, WOOD_D, rx=-0.75)                    # knee braces
    if lod == 0 and plants:
        for i, px in enumerate(np.arange(x0 + 0.6, x1 - 0.4, 2.2)): plant(bd, px, fy - dep + 0.4, zf, rng, 0.9 + 0.2 * (i % 2))
        vine(bd, x0 + 0.1, fy - dep + 0.02, zf - 1.6, zf + 0.9, rng)

def roof(bd, x0, x1, d, fy, top, b, lod, rng):
    rc = ROOFS[b['v'] % 4]; cx = (x0 + x1) / 2; w = x1 - x0
    by = d / 2
    if b['roof'] == 'ridge':   # ridge along the street, eaves over the street
        pitch, f0, f1 = 0.52, fy - 0.8, by + 0.5; half = (f1 - f0) / 2; yc = (f0 + f1) / 2; rise = math.tan(pitch) * half; L = half / math.cos(pitch)
        for s in (-1, 1):
            if lod == 0:
                n = int(L / 0.42)
                for i in range(n):
                    t = (i + 0.5) / n; dd = half * (1 - t); zz = top + rise * t
                    bd.box(w + 0.6, 0.48, 0.14, cx, yc + s * dd, zz + 0.1, hexc(rc, 0.08, rng), rx=-s * pitch)
                for k in range(int((w + 0.6) / 0.5)):   # barrel-tile ribs
                    bd.box(0.16, L, 0.07, x0 - 0.3 + 0.25 + k * 0.5, yc + s * half / 2, top + rise / 2 + 0.24, hexc(rc, 0.12, rng), rx=-s * pitch, mat='stone_trim')
            else: bd.box(w + 0.6, L, 0.28, cx, yc + s * half / 2, top + rise / 2 + 0.1, rc, rx=-s * pitch)
        bd.cyl(0.22, 0.22, w + 0.7, x0 - 0.35, yc, top + rise + 0.06, ROOFS[(b['v'] + 1) % 4], n=6, ry=math.pi / 2)
        for sx, xx in ((-1, x0 + 0.02), (1, x1 - 0.32)):   # side gables (seen above the lower neighbours)
            bd.prism([(-half, 0), (half, 0), (0, rise - 0.08)], 0.3, b['wallc'], T(xx, yc, top, rz=-math.pi / 2), mat=0)
        if lod == 0 and b['fl'] == 3 and w > 8:   # dormer
            dx = cx + (w * 0.22 if b['v'] % 2 else -w * 0.22); dy = yc - half * 0.45; dz = top + rise * 0.45
            bd.box(1.6, 1.4, 1.5, dx, dy, dz - 0.2, b['wallc'], base=True); bd.box(1.0, 0.06, 0.9, dx, dy - 0.71, dz + 0.1, GLOW if b['v'] % 3 == 0 else 0x22313d, mat=1 if b['v'] % 3 == 0 else 0, base=True)
            for s in (-1, 1): bd.box(1.0, 1.6, 0.12, dx + s * 0.45, dy - 0.05, dz + 1.45, rc, ry=s * 0.7)
    else:   # front gable: ridge runs back from the street, a carved gable face over the facade
        pitch = 0.6; half = w / 2 + 0.4; rise = math.tan(pitch) * half; L = half / math.cos(pitch); y0, y1 = fy - 0.7, by + 0.5; yc, dep = (y0 + y1) / 2, y1 - y0
        for s in (-1, 1):
            if lod == 0:
                n = int(L / 0.42)
                for i in range(n):
                    t = (i + 0.5) / n; dd = half * (1 - t); zz = top + rise * t
                    bd.box(0.48, dep, 0.14, cx + s * dd, yc, zz + 0.1, hexc(rc, 0.08, rng), ry=s * pitch)
                for k in range(int(dep / 0.5)): bd.box(L, 0.16, 0.07, cx + s * half / 2, y0 + 0.25 + k * 0.5, top + rise / 2 + 0.24, hexc(rc, 0.12, rng), ry=s * pitch)
            else: bd.box(L, dep, 0.28, cx + s * half / 2, yc, top + rise / 2 + 0.1, rc, ry=s * pitch)
        bd.cyl(0.22, 0.22, dep + 0.1, cx, y0 - 0.05, top + rise + 0.06, ROOFS[(b['v'] + 1) % 4], n=6, rx=-math.pi / 2)
        gc = b['upc']; bd.prism([(x0 + 0.05, top), (x1 - 0.05, top), (cx, top + rise - 0.1)], 0.3, gc, T(0, fy - b['jet'], 0), mat=0)
        for s in (-1, 1):   # bargeboards + finial
            bd.box(L + 0.3, 0.14, 0.22, cx + s * half / 2, fy - b['jet'] - 0.12, top + rise / 2 + 0.05, WOOD_D, ry=s * pitch)
        bd.cyl(0.06, 0.03, 0.8, cx, fy - b['jet'] - 0.12, top + rise - 0.1, WOOD_D, n=6)
        lit = b['v'] % 2 == 0
        bd.cyl(0.42, 0.42, 0.08, cx, fy - b['jet'] - 0.02, top + rise * 0.42, GLOW if lit else 0x22313d, n=12, rx=math.pi / 2, mat=1 if lit else 0)  # oculus
        bd.torus(0.48, 0.08, cx, fy - b['jet'] - 0.06, top + rise * 0.42, QUOIN if b['style'] == 'stone' else WOOD_D, n=12, m_=4, rx=math.pi / 2)
    # chimney
    chx = x0 + w * (0.25 if b['v'] % 2 else 0.75); bd.box(0.9, 0.9, 3.0, chx, by - 1.6, top, QUOIN, base=True); bd.box(1.15, 1.15, 0.2, chx, by - 1.6, top + 3.0, 0x6d665e, base=True)
    if lod == 0: bd.cyl(0.14, 0.14, 0.35, chx + 0.2, by - 1.6, top + 3.2, 0xb8562e, n=6)

def building(bd, b, lod, rng, cols):
    x0, x1, d, g, fl = b['x0'], b['x1'], b['d'], b['g'], b['fl']; FY, BY = -d / 2, d / 2; cx = (x0 + x1) / 2; w = x1 - x0
    gz = lambda x: g * x
    zlo = min(gz(x0), gz(x1)) - 1.2; zmin = min(gz(x0), gz(x1)) - 0.15; top = G + (fl - 1) * U
    st = b['style']; xo, ow = b['xo'], b['ow']
    gcol = (BRICK if b['v'] % 4 == 1 else SAND if b['v'] % 4 == 3 else STONES)[b['v'] % 3]; b['gcol'] = gcol
    upc = STONES[(b['v'] + 1) % 4] if st == 'stone' else PLASTERS[b['v'] % 4] if st == 'timber' else PLANK[b['v'] % 3]; b['upc'] = upc
    b['wallc'] = gcol if st == 'stone' else upc
    jet = 0.0 if st == 'stone' else 0.45; b['jet'] = jet
    shut = SHUT[(b['v'] + 2) % 6]
    # ---- ground storey: stone / brick shell (sides + back from the buried footing to the first floor), the shop room inside ----
    for xx in (x0 + WALL / 2, x1 - WALL / 2): bd.box(WALL, d, G - zlo, xx, 0, zlo, gcol, base=True)
    bd.box(w, WALL, G - zlo, cx, BY - WALL / 2, zlo, gcol, base=True)
    bd.box(w, d, 0.3, cx, 0, G - 0.3, 0xe8d8b8, base=True)                                                     # ceiling slab
    holes = [(xo - ow / 2, xo + ow / 2, zlo, OPEN_TOP)]; dwin = []
    for s in (-1, 1):   # display windows beside the opening where the pier is wide enough
        a, c = (x0 + 0.6, xo - ow / 2 - 0.6) if s < 0 else (xo + ow / 2 + 0.6, x1 - 0.6)
        if c - a >= 1.5: xw = (a + c) / 2; holes.append((xw - 0.6, xw + 0.6, max(gz(xw), gz(xw)) + 0.95, OPEN_TOP - 0.3)); dwin.append(xw)
    rects = wall_rects(x0, x1, zlo, G, holes)
    for r in rects: bd.box(r[1] - r[0], WALL, r[3] - r[2], (r[0] + r[1]) / 2, FY + WALL / 2, (r[2] + r[3]) / 2, MORTAR if lod == 0 else gcol)
    if lod == 0: ashlar(bd, [(r[0], r[1], max(r[2], zmin), r[3]) for r in rects], FY, gcol, rng, rh=0.3 if gcol in BRICK else 0.46)
    # stepped plinth (2-3 level courses following the slope), skipping the doorway
    segs = max(2, int(round(w / 3.2))); sw = w / segs
    for i in range(segs):
        a, c = x0 + i * sw, x0 + (i + 1) * sw
        for (pa, pc) in ((a, min(c, xo - ow / 2)), (max(a, xo + ow / 2), c)):
            if pc - pa < 0.1: continue
            tz = max(gz(pa), gz(pc)) + 0.42; bd.box(pc - pa, 0.22, tz - zlo, (pa + pc) / 2, FY - 0.11, zlo, QUOIN, base=True)
            if lod == 0: bd.box(pc - pa + 0.02, 0.28, 0.1, (pa + pc) / 2, FY - 0.13, tz - 0.05, hexc(QUOIN, 0.05, rng))
    # arch over the shop opening: voussoirs + keystone, stone jambs, threshold
    nv = 9 if lod == 0 else 3
    for i in range(nv):
        t = (i + 0.5) / nv; x = xo - ow / 2 - 0.2 + t * (ow + 0.4)
        bd.box((ow + 0.4) / nv - 0.04, 0.4, 0.5 if i != nv // 2 else 0.68, x, FY - 0.12, OPEN_TOP + 0.24 + (0.06 if i == nv // 2 else 0), hexc(QUOIN if i != nv // 2 else STONES[2], 0.05, rng))
    for s in (-1, 1): xx = xo + s * (ow / 2 + 0.22); bd.box(0.44, 0.4, OPEN_TOP - zlo, xx, FY - 0.1, zlo, QUOIN, base=True)
    bd.box(ow, WALL + 0.3, 0.1, xo, FY + WALL / 2 - 0.15, gz(xo) - 0.044, QUOIN, ry=-math.atan(g))               # threshold, flush with the walk
    for xw in dwin:   # display windows: glass, mullions, sill + a small pent hood
        bd.box(1.2, 0.06, OPEN_TOP - 0.3 - gz(xw) - 0.95, xw, FY + 0.3, (OPEN_TOP - 0.3 + gz(xw) + 0.95) / 2, 0x2a3a46)
        bd.box(1.5, 0.36, 0.14, xw, FY - 0.08, gz(xw) + 0.9, QUOIN)
        if lod == 0:
            for k in (-0.3, 0.0, 0.3): bd.box(0.05, 0.05, OPEN_TOP - 0.3 - gz(xw) - 0.95, xw + k, FY + 0.24, (OPEN_TOP - 0.3 + gz(xw) + 0.95) / 2, WOOD_D)
            bd.box(1.5, 0.05, 0.05, xw, FY + 0.24, (OPEN_TOP - 0.3 + gz(xw) + 0.95) / 2 + 0.3, WOOD_D)
    # string course + corner quoins on the ground storey
    bd.box(w + 0.3, 0.36, 0.28, cx, FY - 0.06, G - 0.04, QUOIN)
    if lod == 0:
        for xx in (x0, x1):
            zq = zmin
            while zq < G - 0.4:
                bd.box(0.9 if int((zq - zmin) / 0.6) % 2 else 0.6, 0.6, 0.56, xx + (0.25 if xx == x0 else -0.25) * (1 if True else 1), FY + 0.22, zq + 0.29, hexc(QUOIN, 0.05, rng)); zq += 0.6
    # striped awning on iron brackets (no posts: the doorway + street stay clear)
    if b['kind'] == 'rent' and b['v'] % 3 != 2:
        awc = AWN[b['v'] % 6] if b['kind'] == 'rent' else (0xd8322f if b['kind'] == 'sword' else 0x2a6df4); aw = ow + 0.7
        ang = math.atan2(0.8, 1.6); L = math.hypot(1.6, 0.8); ns = 8 if lod == 0 else 2
        for i in range(ns):
            x = xo - aw / 2 + (i + 0.5) * aw / ns
            bd.box(aw / ns + 0.002, L, 0.06, x, FY - 0.8, OPEN_TOP + 0.55, awc if i % 2 == 0 else 0xf2efe6, rx=ang, mat='awning_cloth')
            if lod == 0: bd.prism([(-aw / ns / 2, 0), (aw / ns / 2, 0), (0, -0.3)], 0.04, awc if i % 2 == 0 else 0xf2efe6, T(x, FY - 1.62, OPEN_TOP + 0.16), mat='awning_cloth')
        for s in (-1, 1): bd.box(0.05, 1.6, 0.05, xo + s * aw / 2, FY - 0.8, OPEN_TOP + 0.55, IRON, rx=ang); bd.box(0.05, 0.05, 0.9, xo + s * aw / 2, FY - 0.04, OPEN_TOP + 0.4, IRON)
    # wall lanterns beside the arch
    for s in (-1, 1):
        x = xo + s * (ow / 2 + 0.3)
        bd.box(0.05, 0.4, 0.05, x, FY - 0.45, 3.0 + gz(x) * 0, IRON); bd.box(0.28, 0.28, 0.06, x, FY - 0.6, 2.62, IRON)
        bd.box(0.22, 0.22, 0.32, x, FY - 0.6, 2.8, GLOW, mat=1); bd.box(0.3, 0.3, 0.08, x, FY - 0.6, 3.0, IRON)
        if lod == 0: bd.cyl(0.18, 0.0, 0.2, x, FY - 0.6, 3.04, IRON, n=4)
    # ---- upper storeys: stone (like the plaza), timber-framed plaster (jettied) or weathered plank (galleries) ----
    fyu = FY - jet
    for xx in (x0 + WALL / 2, x1 - WALL / 2): bd.box(WALL, BY - fyu, top - G, xx, (BY + fyu) / 2, G, b['wallc'], base=True)
    bd.box(w, WALL, top - G, cx, BY - WALL / 2, G, b['wallc'], base=True)
    if jet:   # jetty: bressumer beam + joist ends carrying the overhang
        bd.box(w + 0.1, jet + 0.3, 0.3, cx, FY - jet / 2 + 0.1, G - 0.15, WOOD_D)
        if lod == 0:
            for i in range(int(w / 0.7)): bd.box(0.16, jet + 0.2, 0.16, x0 + 0.35 + i * 0.7, FY - jet / 2, G - 0.36, WOOD_D)
    nw = max(2, int(w // 2.7)); uholes = []; uw = []
    for f in range(1, fl):
        z0 = G + (f - 1) * U
        for i in range(nw):
            x = x0 + (i + 0.5) * w / nw; zb = z0 + 0.85; h = 1.65
            if f == 1 and st != 'timber' and abs(x - xo) < w / nw / 2 + 0.01: zb, h = z0 + 0.0, 2.45   # balcony door
            uholes.append((x - 0.55, x + 0.55, zb, zb + h)); uw.append((x, zb, h, f))
    urects = wall_rects(x0, x1, G, top, uholes)
    if st == 'stone':
        for r in urects: bd.box(r[1] - r[0], WALL, r[3] - r[2], (r[0] + r[1]) / 2, fyu + WALL / 2, (r[2] + r[3]) / 2, MORTAR if lod == 0 else upc)
        if lod == 0: ashlar(bd, urects, fyu, upc, rng)
        for f in range(1, fl): bd.box(w + 0.3, 0.34, 0.24, cx, fyu - 0.05, G + f * U - 0.02, QUOIN)
        if lod == 0:
            for xx in (x0, x1):
                zq = G
                while zq < top - 0.3: bd.box(0.9 if int(zq / 0.6) % 2 else 0.6, 0.6, 0.56, xx + (0.25 if xx == x0 else -0.25), fyu + 0.22, zq + 0.29, hexc(QUOIN, 0.05, rng)); zq += 0.6
    elif st == 'timber':
        for r in urects: bd.box(r[1] - r[0], 0.3, r[3] - r[2], (r[0] + r[1]) / 2, fyu + 0.15, (r[2] + r[3]) / 2, hexc(upc, 0.03, rng))
        # timber frame: corner + intermediate posts, storey rails, sill + head rails, diagonal braces in the solid panels
        posts = sorted({x0 + 0.12, x1 - 0.12, *[x0 + (i) * w / nw for i in range(1, nw)]})
        for f in range(1, fl):
            z0 = G + (f - 1) * U
            for px in posts: bd.box(0.22, 0.16, U, px, fyu - 0.04, z0 + U / 2, WOOD_D)
            bd.box(w, 0.18, 0.24, cx, fyu - 0.05, z0 + 0.12, WOOD_D); bd.box(w, 0.18, 0.2, cx, fyu - 0.05, z0 + U - 0.1, WOOD_D)
            if lod == 0:
                bd.box(w, 0.14, 0.12, cx, fyu - 0.04, z0 + 0.78, WOOD_D); bd.box(w, 0.14, 0.12, cx, fyu - 0.04, z0 + 2.56, WOOD_D)
                for a, c in zip(posts, posts[1:]):
                    m = (a + c) / 2; span = c - a; half = span / 2 - 0.62
                    if half < 0.25: continue
                    for s in (-1, 1):
                        bx = m + s * (0.55 + half / 2); L = math.hypot(half, 0.75); bd.box(L, 0.12, 0.14, bx, fyu - 0.03, z0 + 0.42, WOOD_D, ry=s * math.atan2(0.62, half))
        if fl > 1 and b['v'] % 2 == 0: balcony(bd, x0 + 1.0, x1 - 1.0, fyu, G + U if fl == 3 else G, 1.1, lod, rng)
    else:   # weathered vertical planks + full-width galleries
        for r in urects:
            if lod == 0:
                xx = r[0]
                while xx < r[1] - 0.05:
                    bw = min(0.26, r[1] - xx); bd.box(bw - 0.02, 0.12, r[3] - r[2], xx + bw / 2, fyu + 0.06, (r[2] + r[3]) / 2, hexc(upc, 0.12, rng)); xx += bw
                bd.box(r[1] - r[0], 0.1, r[3] - r[2], (r[0] + r[1]) / 2, fyu + 0.2, (r[2] + r[3]) / 2, 0x3a2a1c)
            else: bd.box(r[1] - r[0], 0.2, r[3] - r[2], (r[0] + r[1]) / 2, fyu + 0.1, (r[2] + r[3]) / 2, upc)
        for f in range(1, fl): bd.box(w + 0.1, 0.2, 0.22, cx, fyu - 0.06, G + (f - 1) * U + 0.1, WOOD_D)
        for xx in (x0 + 0.1, x1 - 0.1): bd.box(0.24, 0.24, top - G, xx, fyu - 0.06, (G + top) / 2, WOOD_D)
    for (x, zb, h, f) in uw:
        door = h > 2
        window(bd, x, zb, h, fyu, shut, lod, rng, lit=(f + int(x * 3)) % 3 == 0 and not door, box_=not door and st != 'plank' and (f + int(x)) % 2 == 0, stone=st == 'stone')
    if st == 'stone' and fl > 1: balcony(bd, x0 + 0.8, x1 - 0.8, fyu, G, 1.3, lod, rng)
    if st == 'plank':
        for f in range(1, fl): balcony(bd, x0 + 0.3, x1 - 0.3, fyu, G + (f - 1) * U, 1.15, lod, rng, plants=(f + b['v']) % 2 == 0)
    if lod == 0 and st != 'plank': vine(bd, x1 - 0.5 if b['v'] % 2 else x0 + 0.5, fyu - 0.12, G - 2.2, top - 0.6, rng)
    # exposed end walls (no building against them: the plaza end, the Squad Hall / well-square gaps, the gate): shuttered windows + quoins
    for xe, th, open_ in ((x0, -math.pi / 2, b.get('end0')), (x1, math.pi / 2, b.get('end1'))):
        if not open_: continue
        bd.push(T(xe, 0, 0, rz=th))
        for f in range(1, fl):
            for k in (-1, 1): window(bd, k * d / 4, G + (f - 1) * U + 0.85, 1.6, -0.25, shut, lod, rng, lit=(f + k) % 3 == 0, box_=f == 1, stone=st == 'stone')
            bd.box(d + 0.2, 0.3, 0.24, 0, -0.1, G + f * U - 0.02 if f < fl - 1 else G - 0.04, QUOIN)
        bd.pop()
    # cornice + eave corbels
    bd.box(w + 0.4, 0.6, 0.3, cx, fyu + 0.1, top + 0.08, QUOIN if st == 'stone' else WOOD_D)
    if lod == 0:
        for i in range(int(w / 0.9)): bd.box(0.2, 0.4, 0.24, x0 + 0.45 + i * 0.9, fyu - 0.18, top - 0.18, WOOD_D)
    roof(bd, x0, x1, d, fyu, top, b, lod, rng)
    b['top'] = top
    # ---- colliders (three.js building frame: x, z = -y): slide-friendly boxes, the doorway left open ----
    if cols is not None:
        fz = d / 2 - WALL / 2 + 0.12; fd = WALL + 0.34
        for (pa, pc) in ((x0 - 0.3, xo - ow / 2 - 0.02), (xo + ow / 2 + 0.02, x1 + 0.3)):
            if pc - pa > 0.05: cols.append(['b', round((pa + pc) / 2, 3), round(fz, 3), round(pc - pa, 3), round(fd, 3)])
        cols.append(['b', round(x0 + WALL / 2 - 0.15, 3), 0.0, WALL + 0.3, round(d + 0.6, 3)]); cols.append(['b', round(x1 - WALL / 2 + 0.15, 3), 0.0, WALL + 0.3, round(d + 0.6, 3)])
        cols.append(['b', round(cx, 3), round(-(d / 2 - WALL / 2) - 0.15, 3), round(w + 0.6, 3), WALL + 0.3])

def interior(bd, b, lod, rng, cols):
    x0, x1, d, g = b['x0'] + WALL, b['x1'] - WALL, b['d'], b['g']; FY, BY = -d / 2 + WALL, d / 2 - WALL; gz = lambda x: g * x; a = -math.atan(g)
    iw, idp = x1 - x0, BY - FY; cx = (x0 + x1) / 2; zl = min(gz(x0), gz(x1))
    # plank floor following the walk height (top 6 mm over the ground)
    np_ = int(iw / 0.3) if lod == 0 else 1
    for i in range(np_):
        x = x0 + (i + 0.5) * iw / np_; bd.box(iw / np_ / math.cos(a), idp, 0.08, x, (FY + BY) / 2, gz(x) + 0.006 - 0.04, hexc(FLOOR_A if i % 2 else FLOOR_B, 0.05, rng), ry=a)
    # plaster walls, beams, a hanging lantern
    for xx in (x0 + 0.02, x1 - 0.02): bd.box(0.04, idp, G - 0.3 - zl, xx, (FY + BY) / 2, zl, PLASTER_IN, base=True)
    bd.box(iw, 0.04, G - 0.3 - zl, cx, BY - 0.02, zl, PLASTER_IN, base=True)
    bd.box(iw, 0.04, G - OPEN_TOP - 0.3, cx, FY + 0.02, OPEN_TOP, PLASTER_IN, base=True)
    if lod == 0:
        for i in range(3): bd.box(iw, 0.22, 0.26, cx, FY + (i + 1) * idp / 4, G - 0.55, WOOD_D, base=True)
        bd.box(0.2, 0.2, G - 0.3 - zl, x0 + 0.12, BY - 0.12, zl, WOOD_D, base=True); bd.box(0.2, 0.2, G - 0.3 - zl, x1 - 0.12, BY - 0.12, zl, WOOD_D, base=True)
    lx_ = cx; bd.cyl(0.015, 0.015, 0.8, lx_, (FY + BY) / 2, G - 1.1, IRON, n=4); bd.box(0.3, 0.3, 0.06, lx_, (FY + BY) / 2, G - 1.5, IRON)
    bd.box(0.24, 0.24, 0.34, lx_, (FY + BY) / 2, G - 1.3, GLOW, mat=1); bd.box(0.3, 0.3, 0.06, lx_, (FY + BY) / 2, G - 1.1, IRON)
    # counter across the back (walk-up side towards the door)
    cw = min(4.2, iw * 0.6); cy = BY - 1.4; ccx = cx
    bd.box(cw, 0.9, 1.05 + gz(ccx) - zl + 0.3, ccx, cy, zl - 0.3, WOOD, base=True); bd.box(cw + 0.2, 1.1, 0.12, ccx, cy, gz(ccx) + 1.05, WOOD_L, base=True)
    if lod == 0:
        for i in range(int(cw / 0.5)): bd.box(0.05, 0.03, 0.9, ccx - cw / 2 + 0.25 + i * 0.5, cy - 0.47, gz(ccx) + 0.1, WOOD_D, base=True)
    if cols is not None: cols.append(['b', round(ccx, 3), round(-cy, 3), round(cw + 0.3, 3), 1.2])
    return dict(x0=x0, x1=x1, fy=FY, by=BY, cy=cy, cw=cw, cx=ccx, zl=zl)

def rent_room(bd, b, lod, rng, R):
    gz = lambda x: b['g'] * x; cx = R['cx']; zb = gz(cx)
    # TO RENT board on the back wall + empty shelves (fill them in later)
    bd.box(2.4, 0.08, 1.0, cx, R['by'] - 0.06, zb + 2.05, 0x5a3219, base=True)
    for zz in (zb + 2.07, zb + 3.01): bd.box(2.5, 0.12, 0.08, cx, R['by'] - 0.08, zz, WOOD_D)
    carve(bd, 'TO RENT', cx, R['by'] - 0.11, zb + 2.55, 2.0, 0.6, FRONT, lod, col=0xfff1d2)
    for s in (-1, 1):
        xs = R['x0'] + 0.25 if s < 0 else R['x1'] - 0.25
        for k in range(3 if lod == 0 else 1): bd.box(0.4, R['by'] - R['fy'] - 2.6, 0.06, xs, (R['fy'] + 1.2 + R['by'] - 1.4) / 2, gz(xs) + 0.9 + k * 0.7, WOOD_L)
    # a 'TO RENT' card in a display window too (reads from the street)
    return

def weapon_room(bd, b, lod, rng, R):
    gz = lambda x: b['g'] * x; cx = R['cx']; zb = gz(cx); by = R['by']
    bd.box(min(3.6, R['x1'] - R['x0'] - 1), 0.1, 1.8, cx, by - 0.06, zb + 1.5, WOOD_D, base=True)   # rack board on the back wall
    for i in range(6 if lod == 0 else 3):
        x = cx - 1.5 + i * (3.0 / (5 if lod == 0 else 2))
        if b['kind'] == 'sword':
            bd.box(0.07, 0.03, 1.0, x, by - 0.16, zb + 1.85, 0xd9dde3); bd.box(0.34, 0.06, 0.06, x, by - 0.16, zb + 1.8, GOLD); bd.box(0.06, 0.06, 0.26, x, by - 0.16, zb + 1.62, 0x3a2414)
            bd.sphere(0.05, x, by - 0.16, zb + 1.5, GOLD, sub=0)
        else:
            bd.cyl(0.035, 0.03, 1.1, x, by - 0.18, zb + 2.0, 0x1d2026, n=6); bd.box(0.12, 0.08, 0.6, x, by - 0.18, zb + 1.55, 0x6b4527, ry=0.08, base=False)
    # barrel of blades / powder kegs by the side walls (solid)
    for s in (-1, 1):
        x = R['x0'] + 0.7 if s < 0 else R['x1'] - 0.7; y = R['fy'] + 1.8
        bd.cyl(0.36, 0.42, 0.9, x, y, gz(x), 0x8a5a2b if b['kind'] == 'sword' else 0x3a2a1c, n=10 if lod == 0 else 6)
        if b['kind'] == 'sword':
            for k in range(4): bd.box(0.05, 0.03, 0.9, x + (k - 1.5) * 0.12, y, gz(x) + 1.1, 0xd9dde3, ry=(k - 1.5) * 0.12)
        b['_props'].append(['c', round(x, 3), round(-y, 3), 0.5])
    # carved name board over the arch (the facade board) + crossed emblem
    name = 'SWORD SHOP' if b['kind'] == 'sword' else 'MUSKET SHOP'; FY = -b['d'] / 2; bw = min(b['ow'] + 1.0, 4.6)
    bd.box(bw, 0.12, 0.62, b['xo'], FY - 0.1, OPEN_TOP + 1.05, 0x5a3219)
    for zz in (OPEN_TOP + 0.76, OPEN_TOP + 1.34): bd.box(bw + 0.1, 0.16, 0.07, b['xo'], FY - 0.12, zz, WOOD_D)
    carve(bd, name, b['xo'], FY - 0.17, OPEN_TOP + 1.05, bw - 0.4, 0.44, FRONT, lod)

def sign_plate(b):   # the blank hanging plate, its own mesh (Emerly: text / textures later)
    sp = Builder(); FY = -b['d'] / 2; s = b['ssx']
    sp.box(0.12, 1.4, 0.8, s, FY - 1.08, 3.35, 0x5a3219)
    for zz in (2.95, 3.75): sp.box(0.16, 1.48, 0.08, s, FY - 1.08, zz, WOOD_D)
    for yy in (FY - 0.38, FY - 1.78): sp.box(0.16, 0.08, 0.88, s, yy, 3.35, WOOD_D)
    return sp

def bracket(bd, b):
    FY = -b['d'] / 2; xo, ow = b['xo'], b['ow']
    left = (xo - ow / 2) - b['x0'] >= b['x1'] - (xo + ow / 2); s = xo - ow / 2 - 0.95 if left else xo + ow / 2 + 0.95; b['ssx'] = s
    bd.box(0.08, 2.0, 0.08, s, FY - 1.0, 3.98, IRON); bd.box(0.06, 0.06, 1.1, s, FY - 0.45, 3.6, IRON, rx=0.8); bd.box(0.3, 0.06, 0.3, s, FY - 0.03, 3.7, IRON)
    for yy in (FY - 0.5, FY - 1.66): bd.box(0.04, 0.04, 0.2, s, yy, 3.86, IRON)
    bd.sphere(0.06, s, FY - 1.98, 3.98, IRON, sub=0)

def mats():
    out = []
    for nm, kind in (('hill_solid', 0), ('hill_glow', 1)):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        if kind == 1: nt.links.new(ca.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 3.0
        out.append(m)
    return out
MATS = mats()
def bake_obj(bd, name, coll, parent):
    me = bd.bake(name); me.validate(clean_customdata=False)
    for m in MATS: me.materials.append(m)
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.parent = parent; return o

REPORT = {}; DATA = []
COLLS = {k: bpy.data.collections.new('hill_' + k) for k in ('street', 'sword', 'musket')}
for c in COLLS.values(): bpy.context.scene.collection.children.link(c)
for b in B:
    G = b['G']
    coll = COLLS['street' if b['kind'] == 'rent' else b['kind']]
    root = bpy.data.objects.new('hill_' + b['key'], None); coll.objects.link(root); cols = []; b['_props'] = []; rep = {}
    for lod in (0, 1):
        rng = np.random.default_rng(b['n'] * 31 + (b['side'] > 0) * 7 + lod); random.seed(b['n'])
        bd = Builder(); bd.ground = (lambda g: (lambda x, y: g * x))(b['g']); building(bd, b, lod, rng, cols if lod == 0 else None); R = interior(bd, b, lod, rng, cols if lod == 0 else None)
        (rent_room if b['kind'] == 'rent' else weapon_room)(bd, b, lod, rng, R); bracket(bd, b)
        bake_obj(bd, f"hill_{b['key']}_LOD{lod}", coll, root); rep[f'LOD{lod}'] = bd.tris()
    cols += b['_props'][:2]
    sid = 'sign_rent_%d' % b['rent'] if b['kind'] == 'rent' else 'sign_swords' if b['kind'] == 'sword' else 'sign_muskets'
    eid = 'door_rent_%d' % b['rent'] if b['kind'] == 'rent' else 'door_swords' if b['kind'] == 'sword' else 'door_muskets'
    sp = sign_plate(b); bake_obj(sp, sid, coll, root)
    e = bpy.data.objects.new(eid, None); coll.objects.link(e); e.parent = root; e.location = (b['xo'], -b['d'] / 2, b['g'] * b['xo']); e.empty_display_size = 0.5
    inner = [round(b['x0'] + WALL, 3), round(-(b['d'] / 2 - WALL), 3), round(b['x1'] - WALL, 3), round(b['d'] / 2 - WALL, 3)]   # three.js building frame x0, z0, x1, z1
    root['colliders'] = json.dumps(cols); root['interior'] = json.dumps(inner); root['door'] = json.dumps([round(b['xo'], 3), round(b['d'] / 2, 3)])
    root['sign'] = sid; root['empty'] = eid; root['top'] = b['top']; root['kind'] = b['kind']
    REPORT[b['key']] = rep
    DATA.append(dict(key=b['key'], kind=b['kind'], rent=b.get('rent'), side=b['side'], n=b['n'], lx=round(b['lx'], 3), lz=round(b['lz'], 3), w=round(b['w'], 3), d=round(b['d'], 3),
                     x0=round(b['x0'], 3), x1=round(b['x1'], 3), fl=b['fl'], style=b['style'], roof=b['roof'], g=b['g'], y=round(b['y'], 3), door=[round(b['xo'], 3), round(b['d'] / 2, 3)],
                     ow=b['ow'], interior=inner, colliders=cols, sign=sid, empty=eid, top=round(b['top'], 2)))
    print(b['key'], b['kind'], b['style'], b['roof'], 'fl', b['fl'], rep, flush=True)
json.dump(dict(report=REPORT, lots=DATA), open(os.path.join(OUT, 'hill_report.json'), 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'hill_street.blend'))
for k, c in COLLS.items():
    for o in bpy.data.objects: o.select_set(c in o.users_collection)
    f = os.path.join(OUT, f'hill_{k}_raw.glb' if k == 'street' else f'hill_{k}_shop_raw.glb')
    kw = dict(filepath=f, export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True)
    try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
    except TypeError: bpy.ops.export_scene.gltf(**kw)
    print('EXPORTED', f, os.path.getsize(f))

# ---- data for the game: RENTABLE_SHOPS + the hill MAIN_ST_SHOPS (town-local, js/island/coast.js frame), js/island/hillShops.js + JSON ----
def town(L, bx, bz):
    th = math.pi / 2 if L['side'] < 0 else -math.pi / 2
    return [round(L['lx'] + bx * math.cos(th) + bz * math.sin(th), 3), round(L['lz'] - bx * math.sin(th) + bz * math.cos(th), 3)]
rent, weap = [], []
for L in DATA:
    th = math.pi / 2 if L['side'] < 0 else -math.pi / 2; i0, j0, i1, j1 = L['interior']
    cs = [town(L, a, c) for a in (i0, i1) for c in (j0, j1)]
    e = dict(id=('rent_%d' % L['rent']) if L['kind'] == 'rent' else ('sword_shop' if L['kind'] == 'sword' else 'musket_shop'), lot=L['key'],
             lx=L['lx'], lz=L['lz'], ly=round(th, 4), w=round(L['x1'] - L['x0'], 3), d=L['d'], storeys=L['fl'],
             door=dict(zip(('lx', 'lz'), town(L, L['door'][0], L['door'][1]))), doorY=round(L['y'] + L['g'] * L['door'][0], 3), doorW=L['ow'], facing=round(th, 4),
             interior=dict(lx0=min(c[0] for c in cs), lz0=min(c[1] for c in cs), lx1=max(c[0] for c in cs), lz1=max(c[1] for c in cs), floorY=dict(atLz0=round(gyl(min(c[1] for c in cs)), 3), atLz1=round(gyl(max(c[1] for c in cs)), 3)), slope=0.11),
             sign=L['sign'], empty=L['empty'])
    (rent if L['kind'] == 'rent' else weap).append(e)
json.dump(dict(RENTABLE_SHOPS=rent, MAIN_ST_SHOPS=weap), open(os.path.join(GAME, 'assets/island/hill_shops.json'), 'w'), indent=1)
with open(os.path.join(GAME, 'js/island/hillShops.js'), 'w') as f:
    f.write("// [Timothy] PUMPFUN PIRATES hill street shop data (GENERATED by tools/hill_blender/hill_street_blender.py, do not hand-edit; also assets/island/hill_shops.json).\n")
    f.write("// Town-local frame (js/island/coast.js): lx along the waterfront, +lz out to sea; ly / facing = the way the door faces (three.js yaw in the town frame,\n")
    f.write("// PI/2 = faces +lx, -PI/2 = faces -lx). door = the doorway centre on the facade (the door empty: +z = out of the door), doorY = the walk height there.\n")
    f.write("// interior = the walkable shop room (AABB inside the walls; its floor follows the street slope 0.11 m/m: floorY.atLz0 / atLz1 at its two ends).\n")
    f.write("// sign = the blank hanging sign-plate mesh name, empty = the door Object3D name (both in the scene once the hill GLBs load).\n")
    f.write("// RENTABLE_SHOPS: every hill-street ground floor except the two weapon shops = an EMPTY shop to rent (geometry + data only; no rental gameplay yet).\n")
    f.write("// MAIN_ST_SHOPS: the SWORD SHOP (L6) + MUSKET SHOP (R6) as built (js/island/battleAreas.js MAIN_ST_SHOPS stays the gameplay config).\n")
    f.write('export const RENTABLE_SHOPS = ' + json.dumps(rent) + ';\n')
    f.write('export const MAIN_ST_SHOPS = ' + json.dumps(weap) + ';\n')
print('DATA', len(rent), 'rentable', len(weap), 'weapon')
