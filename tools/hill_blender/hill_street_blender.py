# [Timothy] PUMPFUN PIRATES hill street (Main Street, plaza -> town gate) as Blender-made models (BANKSY 7:35 PM "fix the buildings up the
# hill and make them match the plaza buildings and look good" + his Port Royal reference: brick / stone ground floors, timber upper floors,
# balconies with plants, wall lanterns, hanging carved signs, open shopfronts with awnings; "multi story on both sides"; "make them all shops").
#   blender -b --factory-startup -P tools/hill_blender/hill_street_blender.py -- GAME_DIR OUT_DIR
# Same toolkit, palette + material buckets as the plaza shops (tools/plaza_blender/lib.py: vertex colour only, solid / glow).
# Every lot of js/island/foot.js buildStreet (L0-L12, R1-R12 minus R4 = the well square, R0 = the Squad Hall) becomes one 2-3 storey building:
#   R3 (#36) = SWORD SHOP, R1+R2 (#34+#35, ONE wide building, origin R2) = MUSKET SHOP (own GLBs, door_swords / door_muskets + sign_swords /
#   sign_muskets, Emerly's js/onfoot/battle.js); [Raul hill-weapons] they were L6 / R6 (now plain rent shops rent_23 / rent_24),
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
ARISE = 0.0   # big shop: the arch rise over OPEN_TOP (0 = the flat-arched rent / weapon shops)
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
def find_door(b, cands=((1.3, 3.6, 1.3), (1.3, 3.2, 1.3), (1.3, 2.8, 1.3), (0.8, 2.8, 1.3), (0.75, 2.4, 1.3), (0.6, 2.4, 1.0))):
    # doorway: as central as possible, clear of the street barrels / crates (foot.js) so you can always walk in
    s = b['side']; loc = lambda lz: (b['lz'] - lz) if s < 0 else (lz - b['lz'])
    cr = [loc(zc) for (cs, zc) in CRATES if cs == s] + [loc(zc) + k for (cs, zc) in POST if cs == s for k in (-0.6, 0.0, 0.6)]; lp = [loc(zz) for zz in LAMPS]
    best = None
    for (mg, ow, fmin) in cands:
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
    find_door(b)
RENT = [b for b in B if b['kind'] == 'rent']
for i, b in enumerate(RENT): b['rent'] = i + 1
# [Timothy v312] BANKSY pt381u "Upgrade the squad hall ... Make it wider, enhance inside and outside": R0 is the SQUAD HALL again, rebuilt here
# (squad_hall() below) as a 24 m wide, 3-storey captains' guildhall: rusticated sandstone arcade with a 5 m arched portal + twin arched guild
# windows each side, a corbelled timber gallery, the carved SQUAD HALL board over the arch, guild banners, a central raised gable with a compass
# oculus, a ridge cupola, dormers, a finished south (plaza) gable; inside a walk-in war room (war table, armory + captains' lounge wings, the
# squad roster board, chandeliers). Front on the Hill Street building line (lx 14), depth 14.5 (rear lx 28.5, 5.5 m clear of the coliseum
# shell at lx 34), lz -83.0 .. -59.0: the north end keeps a 1 m alley to R1 (still clipped at lz -84.05 by OBST = the old 16.6 m plot), the
# extra width goes south over the open flat (the terrain under the hall is held on the street grade: js/island/hillStreet.js hallGround).
SQ_W, SQ_D, SQ_LZ1 = 24.0, 14.5, -83.0
SQ_INTERACT = (0.0, -3.3)                                                          # E · SQUAD HALL: on the runner in front of the war table
SQB = dict(G=7.6, OT=4.0, AR=2.5, key='R0', side=1, n=0, lz=SQ_LZ1 + SQ_W / 2, lx=SX + HALF + 1 + SQ_D / 2, w=SQ_W, d=SQ_D, fl=3, style='stone',
           roof='ridge', kind='squad', v=3, end0=True, end1=True, g=-0.11, x0=-SQ_W / 2, x1=SQ_W / 2, y=gyl(SQ_LZ1 + SQ_W / 2), xo=0.0, ow=5.0, rent=None)
B.append(SQB)

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
        pitch = 0.6 if b['kind'] != 'big' and not b.get('grand') else 0.4; half = w / 2 + (0.4 if not b.get('grand') else 0.2); rise = math.tan(pitch) * half; L = half / math.cos(pitch); y0, y1 = fy - 0.7, by + 0.5; yc, dep = (y0 + y1) / 2, y1 - y0
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
    holes = [(xo - ow / 2, xo + ow / 2, zlo, OPEN_TOP + ARISE)]; dwin = []
    for s in (-1, 1):   # display windows beside the opening where the pier is wide enough
        a, c = (x0 + 0.6, xo - ow / 2 - 0.6) if s < 0 else (xo + ow / 2 + 0.6, x1 - 0.6)
        nwin = max(1, int((c - a + 0.6) // 2.2)) if b.get('grand') else 1   # [Raul hill-weapons] the wide MUSKET SHOP: two display windows a pier
        if c - a >= 1.5:
            for j in range(nwin): xw = a + (c - a) * (j + 0.5) / nwin; holes.append((xw - 0.6, xw + 0.6, max(gz(xw), gz(xw)) + 0.95, OPEN_TOP - 0.3)); dwin.append(xw)
    rects = wall_rects(x0, x1, zlo, G, holes); b['_dwin'] = dwin
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
    if ARISE:   # big shop: a real segmental arch (stepped spandrels inside the opening head + a voussoir ring on the face)
        ns = 24 if lod == 0 else 8; ra = ow / 2
        for i in range(ns):
            xa, xb = xo - ra + i * ow / ns, xo - ra + (i + 1) * ow / ns; u = max(abs(xa - xo), abs(xb - xo)) / ra
            ha = OPEN_TOP + ARISE * math.sqrt(max(0.0, 1 - u * u))
            if OPEN_TOP + ARISE - ha > 0.01: bd.box(xb - xa + 0.002, WALL, OPEN_TOP + ARISE - ha, (xa + xb) / 2, FY + WALL / 2, ha, gcol)
        nv = 15 if lod == 0 else 7
        for i in range(nv):
            t = math.pi * (1 - (i + 0.5) / nv); xx = xo + (ra + 0.25) * math.cos(t); zz = OPEN_TOP + (ARISE + 0.25) * math.sin(t)
            tang = math.atan2((ARISE + 0.25) * math.cos(t), -(ra + 0.25) * math.sin(t)); kst = i == nv // 2
            bd.box(math.pi * (ra + 0.25) / nv * 0.95, 0.4, 0.5 if not kst else 0.72, xx, FY - 0.12, zz - (0.25 if not kst else 0.3), hexc(QUOIN if not kst else STONES[2], 0.05, rng), ry=tang)
    else:
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
    if b['kind'] == 'big' or b.get('grand'):
        for x in (x0 + 1.1, x1 - 1.1):
            zt = max(gz(x), 0) + 4.2
            bd.box(0.06, 0.6, 0.06, x, FY - 0.3, zt + 0.4, IRON); bd.box(0.06, 0.06, 0.7, x, FY - 0.6, zt + 0.05, IRON)
            bd.box(0.4, 0.4, 0.08, x, FY - 0.6, zt - 0.62, IRON); bd.box(0.32, 0.32, 0.5, x, FY - 0.6, zt - 0.58, GLOW, mat=1); bd.box(0.44, 0.44, 0.1, x, FY - 0.6, zt - 0.08, IRON)
            if lod == 0: bd.cyl(0.26, 0.0, 0.3, x, FY - 0.6, zt + 0.02, IRON, n=4); bd.sphere(0.06, x, FY - 0.6, zt + 0.34, GOLD, sub=0)
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
    bd.box(iw, 0.04, G - OPEN_TOP - ARISE - 0.3, cx, FY + 0.02, OPEN_TOP + ARISE, PLASTER_IN, base=True)
    if lod == 0:
        for i in range(3): bd.box(iw, 0.22, 0.26, cx, FY + (i + 1) * idp / 4, G - 0.55, WOOD_D, base=True)
        bd.box(0.2, 0.2, G - 0.3 - zl, x0 + 0.12, BY - 0.12, zl, WOOD_D, base=True); bd.box(0.2, 0.2, G - 0.3 - zl, x1 - 0.12, BY - 0.12, zl, WOOD_D, base=True)
    for lx_ in ((cx,) if b['kind'] != 'big' and not b.get('grand') else (cx - iw / 3, cx, cx + iw / 3)):
        bd.cyl(0.015, 0.015, 0.8, lx_, (FY + BY) / 2, G - 1.1, IRON, n=4); bd.box(0.3, 0.3, 0.06, lx_, (FY + BY) / 2, G - 1.5, IRON)
        bd.box(0.24, 0.24, 0.34, lx_, (FY + BY) / 2, G - 1.3, GLOW, mat=1); bd.box(0.3, 0.3, 0.06, lx_, (FY + BY) / 2, G - 1.1, IRON)
    if b['kind'] == 'big' or b.get('grand'):   # two long counters across the back, a 1.8 m walk-through gap in the middle
        cy = BY - 1.4; cw = 4.6 if b['kind'] == 'big' else 3.4   # [Raul hill-weapons] MUSKET SHOP: 3.4 m (the floor climbs 0.11 m/m under them)
        for ccx in (cx - 0.9 - cw / 2, cx + 0.9 + cw / 2):
            bd.box(cw, 0.9, 1.05 + gz(ccx) - zl + 0.3, ccx, cy, zl - 0.3, WOOD, base=True); bd.box(cw + 0.2, 1.1, 0.12, ccx, cy, gz(ccx) + 1.05, WOOD_L, base=True)
            if lod == 0:
                for i in range(int(cw / 0.5)): bd.box(0.05, 0.03, 0.9, ccx - cw / 2 + 0.25 + i * 0.5, cy - 0.47, gz(ccx) + 0.1, WOOD_D, base=True)
            if cols is not None: cols.append(['b', round(ccx, 3), round(-cy, 3), round(cw + 0.3, 3), 1.2])
        return dict(x0=x0, x1=x1, fy=FY, by=BY, cy=cy, cw=cw * 2 + 1.8, cx=cx, zl=zl, cxs=(cx - 0.9 - cw / 2, cx + 0.9 + cw / 2), cw1=cw)
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

def musket_hall(bd, b, lod, rng, R):
    # [Raul hill-weapons] the wide MUSKET SHOP (R1+R2): three gun racks on the back wall (the middle one over the walk-through gap between the
    # two counters), pegged long-gun racks on both side walls, powder kegs + a shot crate in the front corners, a musket laid on each counter,
    # glass display cases behind the four display windows. Everything solid stands on the sloped floor (gz) and gets a collider.
    gz = lambda x: b['g'] * x; cx = R['cx']; by, fy = R['by'], R['fy']
    def gun(x, y, z, flat=False, s=1.0):   # one long gun standing on its butt (or lying across a counter / case: flat)
        if flat:   # barrel along +x (x - 0.65 s .. x + 0.15 s), stock behind it
            bd.cyl(0.03, 0.026, 0.8 * s, x - 0.65 * s, y, z + 0.05, 0x1d2026, n=6 if lod == 0 else 4, ry=math.pi / 2); bd.box(0.5 * s, 0.09, 0.1, x + 0.4 * s, y, z + 0.06, 0x6b4527)
            if lod == 0: bd.box(0.12, 0.07, 0.08, x + 0.13 * s, y, z + 0.09, 0x8a8f98)
            return
        bd.cyl(0.035, 0.03, 1.1 * s, x, y, z + 0.85 * s, 0x1d2026, n=6 if lod == 0 else 4); bd.box(0.12, 0.08, 0.6 * s, x, y, z + 0.55 * s, 0x6b4527, ry=0.08)
        if lod == 0: bd.box(0.06, 0.1, 0.12, x, y - 0.03, z + 0.92 * s, 0x8a8f98); bd.box(0.08, 0.05, 0.06, x, y, z + 1.6 * s, GOLD)   # lock + front band
    for (rx, rw) in ((cx, 1.8), *[(c, R['cw1'] - 0.2) for c in R['cxs']]):   # back-wall racks: board, butt shelf, top rail with pegs, the guns
        zb = gz(rx); bd.box(rw, 0.1, 2.2, rx, by - 0.06, zb + 1.2, WOOD_D, base=True)
        bd.box(rw + 0.2, 0.3, 0.1, rx, by - 0.2, zb + 1.18, WOOD); bd.box(rw + 0.2, 0.14, 0.1, rx, by - 0.16, zb + 3.36, WOOD)
        bd.box(rw + 0.1, 0.06, 0.1, rx, by - 0.24, zb + 2.6, WOOD_L)
        ng = max(3, int(rw / 0.36)) if lod == 0 else 3
        for i in range(ng): gun(rx - rw / 2 + (i + 0.5) * rw / ng, by - 0.22, zb + 0.98)   # stocks stand on the butt shelf
        bd.box(min(rw - 0.2, 1.8), 0.06, 0.36, rx, by - 0.08, zb + 3.62, 0x5a3219)
        if lod == 0: carve(bd, 'MUSKETS', rx, by - 0.13, zb + 3.62, min(rw - 0.6, 1.4), 0.24, FRONT, lod, col=GOLD)
    for s_ in (-1, 1):   # side walls: pegged long-gun racks (two rows), between the front kegs and the counters
        xw = R['x0'] + 0.05 if s_ < 0 else R['x1'] - 0.05; y0_, y1_ = fy + 2.6, by - 0.5; L_ = y1_ - y0_
        if L_ < 1.5: continue
        bd.push(T(xw, (y0_ + y1_) / 2, gz(xw), rz=s_ * math.pi / 2))   # local x along the wall, local +y into the room
        bd.box(L_, 0.06, 1.7, 0, 0.03, 1.05, WOOD_D, base=True); gl = min(1.4, L_ - 0.3) / 1.3
        for zz in (1.45, 2.25):
            for k in (-0.4, 0.3): bd.box(0.07, 0.26, 0.07, k * gl * 1.3, 0.16, zz - 0.07, WOOD_L)
            gun(0.0, 0.2, zz - 0.07, flat=True, s=gl)
        bd.pop()
    # powder kegs (two + one stacked) and a shot crate in the front corners (solid)
    for s_ in (-1, 1):
        x = R['x0'] + 0.75 if s_ < 0 else R['x1'] - 0.75; y = fy + 1.4
        bd.cyl(0.36, 0.42, 0.9, x, y, gz(x) - 0.02, 0x3a2a1c, n=10 if lod == 0 else 6)
        if lod == 0:
            for zz in (0.15, 0.75): bd.torus(0.4, 0.03, x, y, gz(x) + zz, IRON, n=10, m_=3)
            bd.cyl(0.3, 0.34, 0.7, x, y, gz(x) + 0.88, 0x4a3520, n=10); bd.box(0.16, 0.16, 0.04, x, y - 0.3, gz(x) + 1.25, 0xd8322f)
        b['_props'].append(['c', round(x, 3), round(-y, 3), 0.5])
        xc = x - s_ * 1.1; bd.box(0.7, 0.6, 0.55, xc, y - 0.2, gz(xc) - 0.02, WOOD, base=True)
        if lod == 0:
            for k in range(6): bd.sphere(0.06, xc - 0.2 + (k % 3) * 0.2, y - 0.2 + (k // 3) * 0.18 - 0.09, gz(xc) + 0.58, 0x2b2f36, sub=0)
        b['_props'].append(['b', round(xc, 3), round(-(y - 0.2), 3), 0.9, 0.8])
    for ccx in R['cxs']:   # a musket laid on each counter + a powder horn
        zt = gz(ccx) + 1.17; gun(ccx - 0.3, R['cy'] - 0.1, zt, flat=True)
        if lod == 0: bd.cyl(0.05, 0.02, 0.32, ccx + 0.9, R['cy'] + 0.15, zt, 0xe9dcc0, n=6, ry=1.2)
    FYo = -b['d'] / 2
    for xw in b.get('_dwin', []):   # display cases behind the display windows (inside the facade wall)
        yc = FYo + WALL + 0.45; bd.box(1.2, 0.6, 0.85, xw, yc, gz(xw) - 0.02, WOOD_D, base=True); bd.box(1.24, 0.64, 0.06, xw, yc, gz(xw) + 0.83, WOOD_L, base=True)
        gun(xw, yc, gz(xw) + 0.88, flat=True, s=0.9)
        b['_props'].append(['b', round(xw, 3), round(-yc, 3), 1.3, 0.75])
    # the facade name board over the arch (a long one for the wide front) + crossed muskets either side
    bw = min(b['ow'] + 2.6, 7.2); zbz = OPEN_TOP + ARISE + 0.78
    bd.box(bw, 0.12, 0.7, b['xo'], FYo - 0.1, zbz, 0x5a3219)
    for zz in (zbz - 0.33, zbz + 0.33): bd.box(bw + 0.1, 0.16, 0.07, b['xo'], FYo - 0.12, zz, WOOD_D)
    carve(bd, 'MUSKET SHOP', b['xo'], FYo - 0.17, zbz, bw - 0.6, 0.5, FRONT, lod)
    for s_ in (-1, 1):
        ex = b['xo'] + s_ * (bw / 2 + 0.55)
        for r_ in (-0.6, 0.6): bd.box(0.06, 0.06, 1.1, ex, FYo - 0.14, zbz - 0.45, 0x1d2026, ry=r_); bd.box(0.1, 0.07, 0.32, ex + math.sin(r_) * 0.45, FYo - 0.14, zbz - 0.95, 0x6b4527, ry=r_)

def weapon_room(bd, b, lod, rng, R):
    if b.get('grand'): return musket_hall(bd, b, lod, rng, R)
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

# ======================= [Timothy v312] the SQUAD HALL (R0): a dedicated generator (BANKSY pt381u "Make it wider, enhance inside and outside") =======================
# Same frame as building(): Blender x = along Hill Street (+x = south / +lz), -y = out of the front (the street), z up, origin = the lot centre at its ground,
# ground under the hall z = g * x (g = -0.11: the street climbs north). Same Builder / palette / library layers (solid + glow), LOD0 desktop, LOD1 phones.
PURP, PURP_D, CRIM, PARCH, SEA, LAND, SILVER, BONE, SOOT = 0x5a2f9e, 0x3d1f6e, 0x8a1c1c, 0xe6cf9a, 0x2b6b7a, 0x4f8a3c, 0xd9dde3, 0xf2efe6, 0x1c1410
SIGNB, EMBER, FLAME = 0x3a2414, 0xff7a1a, 0xffb347

def arch_fill(bd, xc, ow, spring, rise, y, thick, col, ns):   # the wall over a round-headed opening (stepped spandrels inside the opening head)
    r = ow / 2
    for i in range(ns):
        xa, xb = xc - r + i * ow / ns, xc - r + (i + 1) * ow / ns; u = max(abs(xa - xc), abs(xb - xc)) / r
        ha = spring + rise * math.sqrt(max(0.0, 1 - u * u))
        if spring + rise - ha > 0.01: bd.box(xb - xa + 0.002, thick, spring + rise - ha, (xa + xb) / 2, y, ha, col, base=True)

def arch_ring(bd, xc, r, spring, rise, y, depth, th, col, nv, rng, key=None, keyc=None):   # voussoirs (+ a proud keystone)
    for i in range(nv):
        t = math.pi * (1 - (i + 0.5) / nv); rr = r + th / 2; k = key is not None and i == nv // 2
        bd.box(math.pi * rr / nv * 0.94, depth + (0.1 if k else 0), th * (1.4 if k else 1.0), xc + rr * math.cos(t), y - (0.05 if k else 0),
               spring + rise / r * rr * math.sin(t) + (th * 0.2 if k else 0), hexc(keyc if k else col, 0.05, rng), ry=math.pi / 2 - t)

def lead_glass(bd, x, sill, spring, r, y, lod, lit=True):   # amber leaded glass (glow) + iron cames, round head
    bd.box(2 * r, 0.06, spring + r - sill, x, y, sill, GLOW if lit else 0x22313d, mat=1 if lit else 0, base=True)
    if lod == 0:
        for k in (-0.5, 0.0, 0.5): bd.box(0.04, 0.04, spring + r * (0.95 if k == 0 else 0.8) - sill, x + k * r, y - 0.05, sill, IRON, base=True)
        zz = sill + 0.45
        while zz < spring + 0.1: bd.box(2 * r, 0.04, 0.04, x, y - 0.05, zz, IRON); zz += 0.5

def applied_arch_window(bd, x, sill, spring, r, lod, rng, lit=True, frame=QUOIN):   # window on a wall face at local y = 0 (faces -y): glass, round head, ring, sill
    bd.box(2 * r, 0.08, spring - sill, x, -0.03, sill, GLOW if lit else 0x22313d, mat=1 if lit else 0, base=True)
    bd.cyl(r, r, 0.08, x, 0.01, spring, GLOW if lit else 0x22313d, n=12 if lod == 0 else 8, rx=math.pi / 2, mat=1 if lit else 0)
    arch_ring(bd, x, r, spring, r, -0.1, 0.22, 0.28, frame, 9 if lod == 0 else 5, rng, key=True, keyc=STONES[2])
    for s in (-1, 1): bd.box(0.28, 0.22, spring - sill, x + s * (r + 0.14), -0.1, sill, frame, base=True)
    bd.box(2 * r + 0.7, 0.34, 0.14, x, -0.14, sill - 0.12, frame, base=True)
    if lod == 0:
        bd.box(0.04, 0.04, spring + r * 0.95 - sill, x, -0.09, sill, IRON, base=True)
        for zz in np.arange(sill + 0.5, spring, 0.55): bd.box(2 * r, 0.04, 0.04, x, -0.09, zz, IRON)

def wall_lantern(bd, x, y, z, lod, out=-1):   # wrought-iron bracket + hanging glow lantern (out = the facing side in y)
    ly = y + out * 0.6
    bd.box(0.06, 0.62, 0.06, x, y + out * 0.31, z + 0.62, IRON); bd.box(0.26, 0.26, 0.38, x, ly, z - 0.19, GLOW, mat=1, base=True)
    if lod == 0:
        bd.box(0.05, 0.05, 0.7, x, y + out * 0.1, z + 0.3, IRON, rx=-out * 0.75); bd.box(0.22, 0.04, 0.3, x, y + out * 0.02, z + 0.5, IRON)
        bd.box(0.32, 0.32, 0.06, x, ly, z - 0.22, IRON); bd.box(0.36, 0.36, 0.07, x, ly, z + 0.22, IRON)
        for sx in (-1, 1):
            for sy in (-1, 1): bd.box(0.035, 0.035, 0.4, x + sx * 0.14, ly + sy * 0.14, z - 0.2, IRON, base=True)
        bd.cyl(0.22, 0.0, 0.24, x, ly, z + 0.25, IRON, n=4, rz=math.pi / 4); bd.box(0.02, 0.02, 0.4, x, ly, z + 0.45, IRON, base=True)

def sconce(bd, x, y, z, lod, out=-1):   # interior wall candle sconce (back plate + arm + glass lantern)
    bd.box(0.26, 0.05, 0.5, x, y + out * 0.025, z, IRON)
    bd.box(0.2, 0.2, 0.3, x, y + out * 0.34, z - 0.1, GLOW, mat=1, base=True)
    if lod == 0:
        bd.box(0.05, 0.3, 0.05, x, y + out * 0.18, z - 0.12, IRON); bd.box(0.26, 0.26, 0.05, x, y + out * 0.34, z - 0.13, IRON); bd.box(0.26, 0.26, 0.05, x, y + out * 0.34, z + 0.22, IRON)
        bd.cyl(0.17, 0.0, 0.16, x, y + out * 0.34, z + 0.24, IRON, n=4, rz=math.pi / 4)

def emblem(bd, x, y, z, s, lod, face=-1):   # skull + crossed cutlasses on a plane facing `face` in y (s = scale)
    bd.sphere(0.17 * s, x, y + face * 0.05 * s, z + 0.07 * s, BONE, sub=1 if lod == 0 else 0, s=(1, 0.55, 1.0))
    bd.box(0.2 * s, 0.07 * s, 0.1 * s, x, y + face * 0.05 * s, z - 0.12 * s, BONE)
    if lod == 0:
        for sx in (-1, 1): bd.sphere(0.045 * s, x + sx * 0.065 * s, y + face * 0.13 * s, z + 0.07 * s, SOOT, sub=0)
    for sg in (-1, 1):
        th = sg * 0.72; L = 0.95 * s; d = (math.sin(th), math.cos(th))
        bd.box(0.055 * s, 0.03, L, x, y + face * 0.02, z, SILVER, ry=th)
        hx, hz = x - d[0] * (L / 2 + 0.06 * s), z - d[1] * (L / 2 + 0.06 * s)
        bd.box(0.26 * s, 0.05, 0.05 * s, hx + d[0] * 0.04 * s, y + face * 0.03, hz + d[1] * 0.04 * s, GOLD, ry=th)
        if lod == 0: bd.box(0.05 * s, 0.05, 0.16 * s, hx - d[0] * 0.06 * s, y + face * 0.03, hz - d[1] * 0.06 * s, 0x3a2414, ry=th); bd.sphere(0.04 * s, hx - d[0] * 0.15 * s, y + face * 0.03, hz - d[1] * 0.15 * s, GOLD, sub=0)

def banner(bd, x, y, ztop, h, wd, lod, rng, col=PURP, trim=GOLD, sym=True):   # guild banner hanging on a plane facing -y: gold rod, swallowtail, border, emblem
    tail = min(0.55, h * 0.2); zb = ztop - 0.08 - (h - tail)
    bd.cyl(0.04, 0.04, wd + 0.36, x - (wd + 0.36) / 2, y - 0.06, ztop, GOLD, n=6, ry=math.pi / 2)
    for s in (-1, 1): bd.sphere(0.07, x + s * (wd / 2 + 0.2), y - 0.06, ztop, GOLD, sub=0)
    bd.box(wd, 0.04, h - tail, x, y, zb, col, base=True, mat='awning_cloth')
    bd.prism([(0, 0), (wd / 2, -tail), (wd / 2, 0)], 0.04, col, T(x, y - 0.02, zb), mat='awning_cloth')
    bd.prism([(0, 0), (-wd / 2, 0), (-wd / 2, -tail)], 0.04, col, T(x, y - 0.02, zb), mat='awning_cloth')
    for s in (-1, 1): bd.box(0.07, 0.03, h - tail, x + s * (wd / 2 - 0.06), y - 0.03, zb, trim, base=True)
    bd.box(wd, 0.03, 0.08, x, y - 0.03, ztop - 0.18, trim); bd.box(wd, 0.03, 0.06, x, y - 0.03, zb + 0.05, trim)
    if sym and lod == 0: emblem(bd, x, y - 0.02, zb + (h - tail) * 0.55, min(1.0, wd * 0.95), lod)

def chair(bd, x, y, z, rz, lod, cush=PURP):   # high-backed captain's chair, faces local -y (rz turns it)
    bd.push(T(x, y, z, rz=rz))
    bd.box(0.58, 0.54, 0.09, 0, 0, 0.46, WOOD, base=True); bd.box(0.5, 0.46, 0.07, 0, -0.02, 0.55, cush, base=True, mat='awning_cloth')
    bd.box(0.52, 0.07, 0.78, 0, 0.25, 0.62, WOOD_D, base=True); bd.box(0.66, 0.1, 0.13, 0, 0.26, 1.38, WOOD_D, base=True)
    for sx in (-0.25, 0.25):
        bd.box(0.08, 0.08, 1.42, sx, 0.25, -0.05, WOOD_D, base=True)
        if lod == 0: bd.box(0.07, 0.07, 0.52, sx, -0.22, -0.05, WOOD_D, base=True)
        if lod == 0: bd.sphere(0.06, sx, 0.25, 1.55, GOLD, sub=0); bd.box(0.06, 0.48, 0.06, sx, 0.0, 0.78, WOOD_D)
    if lod == 0: bd.box(0.3, 0.03, 0.3, 0, 0.21, 1.0, GOLD)
    bd.pop()

def barrel_(bd, x, y, z, lod, r=0.4, h=1.0, col=WOOD_L):
    n = 12 if lod == 0 else 7
    bd.cyl(r * 0.84, r, h / 2, x, y, z, col, n=n); bd.cyl(r, r * 0.84, h / 2, x, y, z + h / 2, col, n=n)
    for zz in ((0.12, 0.88) if lod else (0.1, 0.32, 0.68, 0.9)): bd.torus(r * (0.9 + 0.1 * (1 - abs(zz - 0.5) * 2)) + 0.012, 0.022, x, y, z + h * zz, IRON, n=n, m_=3)

def chest(bd, x, y, z, rz, lod, gold=False):   # iron-bound treasure chest (rounded lid), long axis local x
    bd.push(T(x, y, z, rz=rz))
    bd.box(1.0, 0.62, 0.5, 0, 0, -0.02, 0x7a4a26, base=True)
    bd.cyl(0.31, 0.31, 1.0, -0.5, 0, 0.46, 0x6a3e20, n=10 if lod == 0 else 6, ry=math.pi / 2)
    for xx in (-0.38, 0.0, 0.38): bd.box(0.07, 0.66, 0.52, xx, 0, -0.02, IRON, base=True); bd.cyl(0.33, 0.33, 0.07, xx - 0.035, 0, 0.46, IRON, n=10 if lod == 0 else 6, ry=math.pi / 2)
    bd.box(0.16, 0.06, 0.2, 0, -0.33, 0.38, GOLD, base=True)
    if gold and lod == 0:
        for i in range(7): bd.cyl(0.07, 0.07, 0.02, -0.75 + (i % 4) * 0.12, -0.5 + (i // 4) * 0.12, -0.02 + (i % 3) * 0.02, GOLD, n=8)
    bd.pop()

def bench(bd, x0_, x1_, y, gz, a, lod, back=0):   # oak guild bench along x (follows the floor slope), back = +1 / -1 side for a backrest
    L = (x1_ - x0_) / math.cos(a); xm = (x0_ + x1_) / 2; zm = gz(xm)
    bd.box(L, 0.46, 0.09, xm, y, zm + 0.46, WOOD, ry=a)
    for xx in (x0_ + 0.25, x1_ - 0.25): bd.box(0.1, 0.42, 0.5, xx, y, gz(xx) - 0.05, WOOD_D, base=True)
    if lod == 0: bd.box(L - 0.5, 0.06, 0.08, xm, y, zm + 0.2, WOOD_D, ry=a)
    if back: bd.box(L, 0.07, 0.6, xm, y + back * 0.22, zm + 0.82, WOOD_D, ry=a)

def chandelier(bd, x, y, z, R, nc, zc, lod):   # iron ring chandelier: candles (glow flames), spokes, chains up to the ceiling zc
    n = 16 if lod == 0 else 8
    bd.torus(R, 0.055, x, y, z, IRON, n=n, m_=4)
    bd.cyl(0.03, 0.03, zc - z, x, y, z, IRON, n=4)
    bd.sphere(0.13, x, y, z - 0.08, GOLD, sub=0)
    for k in range(4 if lod == 0 else 2):
        ang = k * math.pi / (2 if lod == 0 else 1) + math.pi / 4
        bd.box(R, 0.04, 0.04, x + R / 2 * math.cos(ang), y + R / 2 * math.sin(ang), z, IRON, rz=ang)
        if lod == 0:
            th = math.atan2(R, 1.1); L = math.hypot(R, 1.1); bd.push(T(x, y, z, rz=ang)); bd.box(0.025, 0.025, L, R / 2, 0, 0.55, IRON, ry=-th); bd.pop()
    for k in range(nc):
        ang = k * 2 * math.pi / nc; cx, cy = x + R * math.cos(ang), y + R * math.sin(ang)
        if lod == 0: bd.cyl(0.075, 0.06, 0.06, cx, cy, z + 0.03, IRON, n=6); bd.cyl(0.035, 0.035, 0.2, cx, cy, z + 0.09, BONE, n=6)
        bd.box(0.07, 0.07, 0.13, cx, cy, z + 0.29 if lod == 0 else z + 0.14, FLAME, mat=1, base=True)
    if lod == 0: bd.torus(R * 0.45, 0.04, x, y, z + 0.5, IRON, n=10, m_=4); bd.sphere(0.16, x, y, z + 0.5, FLAME, sub=1, mat=1)

def tiles_x(bd, xa, xb, yf, yc_, top, rise, half, pitch, s, rc, lod, rng):   # one ridge-roof plane along x (s = -1 front, +1 back), rows of tiles + ribs
    w = xb - xa; cx = (xa + xb) / 2; L = half / math.cos(pitch)
    if lod == 0:
        n = int(L / 0.42)
        for i in range(n):
            t = (i + 0.5) / n; dd = half * (1 - t); bd.box(w, 0.48, 0.14, cx, yc_ + s * dd, top + rise * t + 0.1, hexc(rc, 0.08, rng), rx=-s * pitch)
        for k in range(int(w / 0.5)): bd.box(0.16, L, 0.07, xa + 0.25 + k * 0.5, yc_ + s * half / 2, top + rise / 2 + 0.24, hexc(rc, 0.12, rng), rx=-s * pitch, mat='stone_trim')
    else: bd.box(w, L, 0.28, cx, yc_ + s * half / 2, top + rise / 2 + 0.1, rc, rx=-s * pitch)

def tiles_y(bd, cx, ya, yb, top, rise, half, pitch, s, rc, lod, rng):   # one front-gable roof plane (ridge along y at cx; s = -1 west / +1 east side)
    dep = yb - ya; yc_ = (ya + yb) / 2; L = half / math.cos(pitch)
    if lod == 0:
        n = int(L / 0.42)
        for i in range(n):
            t = (i + 0.5) / n; dd = half * (1 - t); bd.box(0.48, dep, 0.14, cx + s * dd, yc_, top + rise * t + 0.1, hexc(rc, 0.08, rng), ry=s * pitch)
        for k in range(int(dep / 0.5)): bd.box(L, 0.16, 0.07, cx + s * half / 2, ya + 0.25 + k * 0.5, top + rise / 2 + 0.24, hexc(rc, 0.12, rng), ry=s * pitch)
    else: bd.box(L, dep, 0.28, cx + s * half / 2, yc_, top + rise / 2 + 0.1, rc, ry=s * pitch)

def squad_hall(bd, b, lod, rng, cols):
    hi = lod == 0
    W2, D2, WT = b['w'] / 2, b['d'] / 2, 0.6
    x0, x1, FY, BY = -W2, W2, -D2, D2; w, d = b['w'], b['d']
    g = b['g']; gz = lambda x: g * x; a = -math.atan(g)
    Gs, Us = b['G'], 3.5; z3 = Gs + Us; top = Gs + 2 * Us; b['top'] = top
    zlo = min(gz(x0), gz(x1)) - 1.2; zmin = min(gz(x0), gz(x1)) - 0.15
    AS, AR, OW = b['OT'], b['AR'], b['ow']
    SANDC, UPC, PL = SAND[0], STONES[0], PLASTERS[0]
    WINX, WS, WSP, WR = (5.8, 9.4), 1.9, 3.9, 0.8          # ground-floor guild windows (each side): sill, spring, head radius
    UPX = (5.2, 7.6, 10.0)                                   # upper-storey window bays (each side)
    PIL = 3.95                                               # the centre bay pilasters (upper storeys)
    # ================= ground storey: rusticated sandstone arcade =================
    for xx in (x0 + WT / 2, x1 - WT / 2): bd.box(WT, d, Gs - zlo, xx, 0, zlo, SANDC, base=True)
    bd.box(w, WT, Gs - zlo, 0, BY - WT / 2, zlo, SANDC, base=True)
    holes = [(-OW / 2, OW / 2, zlo, AS + AR)] + [(s * xw - WR, s * xw + WR, WS, WSP + WR) for xw in WINX for s in (-1, 1)]
    rects = wall_rects(x0, x1, zlo, Gs, holes)
    for r in rects: bd.box(r[1] - r[0], WT, r[3] - r[2], (r[0] + r[1]) / 2, FY + WT / 2, (r[2] + r[3]) / 2, MORTAR if hi else SANDC)
    if hi: ashlar(bd, [(r[0], r[1], max(r[2], zmin), r[3]) for r in rects], FY, SANDC, rng, rh=0.52)
    arch_fill(bd, 0, OW, AS, AR, FY + WT / 2, WT, SANDC, 28 if hi else 10)
    for xw in WINX:
        for s in (-1, 1):
            arch_fill(bd, s * xw, 2 * WR, WSP, WR, FY + WT / 2, WT, SANDC, 10 if hi else 4)
            lead_glass(bd, s * xw, WS, WSP, WR, FY + 0.32, lod)
            arch_ring(bd, s * xw, WR, WSP, WR, FY - 0.06, 0.3, 0.32, QUOIN, 9 if hi else 5, rng, key=True, keyc=STONES[2])
            bd.box(2 * WR + 0.5, 0.42, 0.16, s * xw, FY - 0.08, WS - 0.16, QUOIN, base=True)                                   # sill
            for k in (-1, 1): bd.box(0.12, 0.12, 0.5, s * xw + k * (WR + 0.12), FY - 0.15, WS - 0.62, QUOIN, base=True)        # sill brackets
            if hi:   # iron grille bars in front of the glass
                for k in (-0.55, -0.18, 0.18, 0.55): bd.box(0.035, 0.035, WSP - WS + 0.3, s * xw + k * WR, FY - 0.02, WS, IRON, base=True)
                bd.box(2 * WR, 0.04, 0.04, s * xw, FY - 0.02, WS + (WSP - WS) * 0.5, IRON)
    # stepped plinth along the front (follows the slope), skipping the portal
    segs = 8; sw_ = w / segs
    for i in range(segs):
        a_, c_ = x0 + i * sw_, x0 + (i + 1) * sw_
        for (pa, pc) in ((a_, min(c_, -OW / 2 - 0.9)), (max(a_, OW / 2 + 0.9), c_)):
            if pc - pa < 0.1: continue
            tz = max(gz(pa), gz(pc)) + 0.55; bd.box(pc - pa, 0.3, tz - zlo, (pa + pc) / 2, FY - 0.15, zlo, QUOIN, base=True)
            if hi: bd.box(pc - pa + 0.02, 0.36, 0.1, (pa + pc) / 2, FY - 0.17, tz - 0.05, hexc(QUOIN, 0.05, rng))
    # the grand portal: piers, imposts, voussoir ring + keystone, entablature, threshold
    for s in (-1, 1):
        px = s * (OW / 2 + 0.45)
        bd.box(0.9, 0.5, AS + AR + 0.65 - zlo, px, FY - 0.2, zlo, QUOIN, base=True)
        bd.box(1.1, 0.6, 0.6, px, FY - 0.24, max(gz(px), zlo) - 0.1, hexc(STONES[2], 0.03, rng), base=True)
        bd.box(1.12, 0.62, 0.26, px, FY - 0.25, AS - 0.2, hexc(STONES[2], 0.03, rng), base=True)
        if hi:
            for zz in np.arange(max(gz(px), 0) + 0.7, AS - 0.3, 0.62): bd.box(0.96, 0.54, 0.06, px, FY - 0.21, zz, MORTAR)    # rusticated joints
    arch_ring(bd, 0, OW / 2, AS, AR, FY - 0.15, 0.72, 0.62, QUOIN, 17 if hi else 7, rng, key=True, keyc=STONES[2])
    bd.box(OW + 2.6, 0.62, Gs - (AS + AR + 0.65), 0, FY - 0.22, AS + AR + 0.65, hexc(STONES[2], 0.02, rng), base=True)
    if hi:
        for s in (-1, 1): bd.sphere(0.13, s * 1.4, FY - 0.55, AS + AR + 0.42, GOLD, sub=1)   # gilded rosettes in the spandrels
    bd.box(OW, WT + 0.6, 0.1, 0, FY + WT / 2 - 0.3, gz(0) - 0.044, QUOIN, ry=a)
    # first-floor string course + dentils, corner quoins
    bd.box(w + 0.4, 0.62, 0.34, 0, FY - 0.12, Gs - 0.04, QUOIN)
    if hi:
        for i in range(int(w / 0.45)): bd.box(0.18, 0.18, 0.16, x0 + 0.22 + i * 0.45, FY - 0.36, Gs - 0.3, QUOIN)
        for xx in (x0, x1):
            zq = gz(xx) - 0.15
            while zq < Gs - 0.4:
                bd.box(0.95 if int((zq - zmin) / 0.6) % 2 else 0.6, 0.66, 0.56, xx + (0.25 if xx == x0 else -0.25), FY + 0.24, zq + 0.29, hexc(QUOIN, 0.05, rng)); zq += 0.6
    for s in (-1, 1): wall_lantern(bd, s * 4.2, FY, 4.5, lod)
    for s in (-1, 1):   # ground-floor guild standards between the twin windows
        xb = s * 7.6; bd.box(0.06, 0.5, 0.06, xb - 0.45, FY - 0.25, Gs - 0.8, IRON); bd.box(0.06, 0.5, 0.06, xb + 0.45, FY - 0.25, Gs - 0.8, IRON)
        banner(bd, xb, FY - 0.5, Gs - 0.8, 3.1, 1.0, lod, rng, col=PURP if s < 0 else CRIM)
    if hi:   # the iron-studded oak doors, folded open flat against the inside of the front wall (never in the walkway)
        for s in (-1, 1):
            xc = s * (OW / 2 + 1.2)
            bd.box(2.3, 0.12, 3.85, xc, FY + WT + 0.08, gz(xc) + 0.03 + 1.925, WOOD_D, ry=a)
            for zz in (0.5, 1.9, 3.3): bd.box(2.3, 0.04, 0.12, xc, FY + WT + 0.16, gz(xc) + zz, IRON, ry=a)
            for k in range(5): bd.box(0.03, 0.03, 3.7, xc - 0.92 + k * 0.46, FY + WT + 0.15, gz(xc - 0.92 + k * 0.46) + 0.1, 0x4a2c16, base=True)
            bd.torus(0.12, 0.025, xc - s * 0.9, FY + WT + 0.2, gz(xc) + 1.7, IRON, n=8, m_=3, rx=math.pi / 2)
    # ================= upper storeys =================
    for xx in (x0 + WT / 2, x1 - WT / 2): bd.box(WT, d, top - Gs, xx, 0, Gs, UPC, base=True)
    bd.box(w, WT, top - Gs, 0, BY - WT / 2, Gs, UPC, base=True)
    # 2nd storey (captains' gallery): stone, three arched windows per wing, the SQUAD HALL board over the portal
    h2 = [(s * x - 0.6, s * x + 0.6, Gs + 0.45, Gs + 2.75) for x in UPX for s in (-1, 1)]
    r2 = wall_rects(x0, x1, Gs, z3, h2)
    for r in r2: bd.box(r[1] - r[0], WT, r[3] - r[2], (r[0] + r[1]) / 2, FY + WT / 2, (r[2] + r[3]) / 2, MORTAR if hi else UPC)
    if hi: ashlar(bd, r2, FY, UPC, rng)
    for x in UPX:
        for s in (-1, 1):
            xx = s * x; lit = (int(x * 10) + (s > 0)) % 3 != 1
            arch_fill(bd, xx, 1.2, Gs + 2.15, 0.6, FY + WT / 2, WT, UPC, 8 if hi else 3)
            lead_glass(bd, xx, Gs + 0.45, Gs + 2.15, 0.6, FY + 0.32, lod, lit=lit)
            arch_ring(bd, xx, 0.6, Gs + 2.15, 0.6, FY - 0.05, 0.26, 0.26, QUOIN, 9 if hi else 5, rng, key=True, keyc=STONES[2])
    # gallery wings (corbelled timber deck + turned balustrade), clear of the centre bay
    for s in (-1, 1):
        xa, xb = sorted((s * (PIL + 0.45), s * (W2 - 0.55))); bw = xb - xa; cx = (xa + xb) / 2; dep = 1.45; fy_ = FY
        bd.box(bw, dep, 0.24, cx, fy_ - dep / 2, Gs + 0.12, WOOD, base=True)
        bd.box(bw + 0.12, 0.14, 0.12, cx, fy_ - dep + 0.08, Gs + 1.42, WOOD_D); bd.box(bw, 0.12, 0.1, cx, fy_ - dep + 0.08, Gs + 0.45, WOOD_D)
        for px in np.linspace(xa, xb, 4): bd.box(0.18, 0.18, 1.12, px, fy_ - dep + 0.08, Gs + 0.36, WOOD_D, base=True); bd.box(0.18, dep, 0.12, px, fy_ - dep / 2, Gs + 1.42, WOOD_D)
        if hi:
            nb = int(bw / 0.24)
            for i in range(1, nb): bx = xa + i * bw / nb; bd.cyl(0.04, 0.04, 0.9, bx, fy_ - dep + 0.08, Gs + 0.5, WOOD_L, n=6); bd.sphere(0.065, bx, fy_ - dep + 0.08, Gs + 0.92, WOOD_L, sub=0)
            for i in range(int(bw / 1.2) + 1):   # stepped stone corbels
                px = xa + 0.3 + i * (bw - 0.6) / max(1, int(bw / 1.2)); bd.box(0.32, dep * 0.9, 0.28, px, fy_ - dep * 0.45, Gs - 0.16, QUOIN); bd.box(0.3, dep * 0.5, 0.3, px, fy_ - dep * 0.25, Gs - 0.45, QUOIN)
            for px in (xa + 1.1, xb - 1.1): plant(bd, px, fy_ - dep + 0.42, Gs + 0.36, rng, 0.85)
            vine(bd, xb - 0.2 if s > 0 else xa + 0.2, fy_ - dep + 0.02, Gs - 1.6, Gs + 1.3, rng)
        else: bd.box(bw, 0.05, 0.95, cx, fy_ - dep + 0.08, Gs + 0.45, WOOD_L, base=True)
    # centre bay: pilasters, the carved SQUAD HALL board, a guild crest, flanking banners on iron poles
    for s in (-1, 1):
        bd.box(0.75, 0.32, top - Gs + 0.1, s * PIL, FY - 0.16, Gs + 0.1, hexc(STONES[2], 0.02, rng), base=True)
        bd.box(0.95, 0.42, 0.28, s * PIL, FY - 0.2, z3 - 0.36, QUOIN, base=True); bd.box(0.95, 0.42, 0.28, s * PIL, FY - 0.2, top - 0.3, QUOIN, base=True)
    sgw, sgh, sz0 = 6.2, 1.55, Gs + 0.42
    bd.box(sgw, 0.16, sgh, 0, FY - 0.08, sz0, SIGNB, base=True)
    for zz in (sz0 - 0.08, sz0 + sgh - 0.06): bd.box(sgw + 0.34, 0.28, 0.16, 0, FY - 0.14, zz, WOOD_D, base=True)
    for xx in (-sgw / 2 - 0.08, sgw / 2 + 0.08): bd.box(0.2, 0.28, sgh + 0.2, xx, FY - 0.14, sz0 - 0.08, WOOD_D, base=True)
    for zz in (sz0 + 0.12, sz0 + sgh - 0.16): bd.box(sgw - 0.3, 0.04, 0.04, 0, FY - 0.18, zz, GOLD)
    for xx in (-sgw / 2 + 0.16, sgw / 2 - 0.16): bd.box(0.04, 0.04, sgh - 0.28, xx, FY - 0.18, sz0 + 0.14, GOLD, base=True)
    for xx in (-sgw / 2 + 0.3, sgw / 2 - 0.3):
        for zz in (sz0 + 0.3, sz0 + sgh - 0.3): bd.sphere(0.07, xx, FY - 0.2, zz, GOLD, sub=0)
    carve(bd, 'SQUAD HALL', 0, FY - 0.17, sz0 + sgh / 2, sgw - 1.0, sgh - 0.5, FRONT, lod, col=GOLD)
    # crest over the board: purple shield + skull & cutlasses
    bd.prism([(-0.55, 0.3), (0.55, 0.3), (0.55, -0.15), (0, -0.55), (-0.55, -0.15)][::-1], 0.1, PURP, T(0, FY - 0.12, sz0 + sgh + 0.75), mat='awning_cloth')
    bd.prism([(-0.62, 0.36), (0.62, 0.36), (0.62, -0.18), (0, -0.62), (-0.62, -0.18)][::-1], 0.08, GOLD, T(0, FY - 0.06, sz0 + sgh + 0.75))
    emblem(bd, 0, FY - 0.15, sz0 + sgh + 0.78, 0.9, lod)
    for s in (-1, 1):
        bx = s * PIL; bd.box(0.07, 0.8, 0.07, bx, FY - 0.6, z3 - 0.2, IRON); bd.box(0.05, 0.05, 0.7, bx, FY - 0.42, z3 - 0.5, IRON, rx=0.7)
        banner(bd, bx, FY - 0.95, z3 - 0.2, 2.75, 0.85, lod, rng, col=PURP)
    for s in (-1, 1):   # gallery lanterns between the wing windows
        for x in (6.4, 8.8): wall_lantern(bd, s * x, FY, Gs + 2.35, lod)
    bd.box(w + 0.36, 0.5, 0.26, 0, FY - 0.06, z3 - 0.03, QUOIN)                                              # 3rd-floor string course
    # 3rd storey: timber-framed plaster wings + a stone centre bay with a triple (serliana) window
    h3 = [(s * x - 0.55, s * x + 0.55, z3 + 0.75, z3 + 2.35) for x in UPX for s in (-1, 1)] + [(-0.7, 0.7, z3 + 0.55, z3 + 2.6), (-1.75, -1.05, z3 + 0.55, z3 + 1.95), (1.05, 1.75, z3 + 0.55, z3 + 1.95)]
    r3 = wall_rects(x0, x1, z3, top, h3)
    for r in r3:
        ra, rb = r[0], r[1]
        for (pa, pc, centre) in ((ra, min(rb, -PIL), False), (max(ra, -PIL), min(rb, PIL), True), (max(ra, PIL), rb, False)):
            if pc - pa < 0.01: continue
            bd.box(pc - pa, WT, r[3] - r[2], (pa + pc) / 2, FY + WT / 2, (r[2] + r[3]) / 2, UPC if centre else hexc(PL, 0.03, rng))
    arch_fill(bd, 0, 1.4, z3 + 1.9, 0.7, FY + WT / 2, WT, UPC, 8 if hi else 3)
    lead_glass(bd, 0, z3 + 0.55, z3 + 1.9, 0.7, FY + 0.32, lod)
    arch_ring(bd, 0, 0.7, z3 + 1.9, 0.7, FY - 0.05, 0.28, 0.3, QUOIN, 9 if hi else 5, rng, key=True, keyc=STONES[2])
    for s in (-1, 1):
        bd.box(0.7, 0.06, 1.4, s * 1.4, FY + 0.32, z3 + 0.55, GLOW, mat=1, base=True); bd.box(0.95, 0.36, 0.14, s * 1.4, FY - 0.1, z3 + 0.45, QUOIN, base=True)
        for k in (-1, 1): bd.box(0.22, 0.3, 1.45, s * 1.4 + k * 0.46, FY - 0.08, z3 + 0.55, QUOIN, base=True)
    bd.box(4.0, 0.42, 0.16, 0, FY - 0.1, z3 + 0.4, QUOIN, base=True)
    shut = SHUT[5]
    for x in UPX:
        for s in (-1, 1): window(bd, s * x, z3 + 0.75, 1.6, FY, shut, lod, rng, lit=(int(x) + (s > 0)) % 2 == 0, box_=hi and int(x) % 2 == 1, stone=False)
    for s in (-1, 1):   # timber frame on the plaster wings
        xa, xb = sorted((s * (PIL + 0.38), s * W2)); posts = sorted({xa + 0.12, xb - 0.12, *[s * (x + 0.95) for x in UPX[:-1]], *[s * (x - 0.95) for x in UPX]})
        posts = [p for p in posts if xa <= p <= xb]
        for px in posts: bd.box(0.22, 0.16, Us, px, FY - 0.04, z3 + Us / 2, WOOD_D)
        bd.box(xb - xa, 0.18, 0.22, (xa + xb) / 2, FY - 0.05, z3 + 0.14, WOOD_D); bd.box(xb - xa, 0.18, 0.2, (xa + xb) / 2, FY - 0.05, top - 0.1, WOOD_D)
        if hi:
            bd.box(xb - xa, 0.14, 0.12, (xa + xb) / 2, FY - 0.04, z3 + 0.68, WOOD_D); bd.box(xb - xa, 0.14, 0.12, (xa + xb) / 2, FY - 0.04, z3 + 2.42, WOOD_D)
            for x in UPX:   # diagonal braces under each window
                xx = s * x
                for k in (-1, 1): bd.box(0.8, 0.12, 0.13, xx + k * 0.62, FY - 0.03, z3 + 0.42, WOOD_D, ry=k * 0.45)
    # cornice + rafter tails
    bd.box(w + 0.6, 0.72, 0.34, 0, FY + 0.06, top + 0.08, QUOIN)
    if hi:
        for i in range(int((w + 0.4) / 0.8)): bd.box(0.2, 0.55, 0.24, x0 - 0.1 + 0.4 + i * 0.8, FY - 0.3, top - 0.2, WOOD_D)
    # ================= roof: ridge along the street + a raised centre gable with the compass oculus + cupola + dormers =================
    rc = ROOFS[1]; pitch = 0.5; yf, yb = FY - 0.9, BY + 0.6; half = (yb - yf) / 2; yc = (yf + yb) / 2; rise = math.tan(pitch) * half
    XE0, XE1, CG = x0 - 0.5, x1 + 0.5, 4.7
    tiles_x(bd, XE0, XE1, yf, yc, top, rise, half, pitch, 1, rc, lod, rng)                                     # back plane
    for (xa, xb) in ((XE0, -CG), (CG, XE1)): tiles_x(bd, xa, xb, yf, yc, top, rise, half, pitch, -1, rc, lod, rng)   # front plane wings
    yfc = FY + 0.4; hc = yc - yfc; rc_ = rise * hc / half   # front plane behind the centre gable (from the wall line up)
    tiles_x(bd, -CG, CG, yfc, yc, top + rise - rc_, rc_, hc, pitch, -1, rc, lod, rng)
    bd.cyl(0.24, 0.24, XE1 - XE0 + 0.2, XE0 - 0.1, yc, top + rise + 0.06, ROOFS[2], n=6, ry=math.pi / 2)
    for (xx, rz_) in ((x0 + 0.02, -math.pi / 2), (x1 - 0.52, -math.pi / 2)): bd.prism([(-D2, 0), (D2, 0), (0, rise - 0.22)], 0.5, UPC, T(xx, 0, top, rz=rz_), mat=0)
    # centre (cross) gable: stone face, tile planes running back into the main roof, bargeboards, finial, the compass oculus
    cpitch = 0.68; chalf = CG; crise = math.tan(cpitch) * (chalf - 0.3); cya, cyb = FY - 0.55, yc - 1.2
    bd.prism([(-CG + 0.3, 0), (CG - 0.3, 0), (0, crise - 0.12)], 0.6, UPC, T(0, FY - 0.05, top), mat=0)
    for s in (-1, 1): tiles_y(bd, 0, cya, cyb, top - 0.32, crise + 0.3, chalf, cpitch, s, rc, lod, rng)
    bd.cyl(0.22, 0.22, cyb - cya + 0.1, 0, cya - 0.05, top + crise + 0.04, ROOFS[2], n=6, rx=-math.pi / 2)
    L_ = chalf / math.cos(cpitch)
    for s in (-1, 1): bd.box(L_ + 0.3, 0.16, 0.26, s * chalf / 2, cya - 0.1, top - 0.32 + (crise + 0.3) / 2 + 0.06, WOOD_D, ry=s * cpitch)
    bd.cyl(0.08, 0.02, 1.3, 0, cya - 0.12, top + crise + 0.05, GOLD, n=6); bd.sphere(0.14, 0, cya - 0.12, top + crise + 0.25, GOLD, sub=1)
    oz = top + crise * 0.42; oy = FY - 0.08
    bd.torus(1.0, 0.16, 0, oy - 0.04, oz, QUOIN, n=16 if hi else 10, m_=4, rx=math.pi / 2)
    bd.cyl(0.86, 0.86, 0.08, 0, oy + 0.02, oz, 0x1f3a5a, n=16 if hi else 10, rx=math.pi / 2)
    bd.torus(0.8, 0.05, 0, oy - 0.08, oz, GOLD, n=16 if hi else 10, m_=4, rx=math.pi / 2)
    for k in range(8):   # compass star
        L8 = 0.7 if k % 2 == 0 else 0.42
        bd.prism([(-0.09, 0), (0.09, 0), (0, L8)], 0.04, GOLD if k % 2 == 0 else BONE, T(0, oy - 0.12, oz, ry=k * math.pi / 4))
    bd.sphere(0.1, 0, oy - 0.14, oz, GOLD, sub=1)
    if hi:
        for k in range(12): t = k * math.pi / 6; bd.box(0.05, 0.03, 0.12, 0.82 * math.sin(t), oy - 0.1, oz + 0.82 * math.cos(t), BONE, ry=t)
    # dormers (lit) on the front plane wings
    for s in (-1, 1):
        dx = s * 8.4; dy = FY + 1.2; zr = top + rise * (1 - (yc - dy) / half)
        bd.box(1.9, 2.8, 2.0, dx, dy + 1.4, zr - 0.35, UPC, base=True)
        bd.box(1.0, 0.06, 1.1, dx, dy - 0.03, zr + 0.2, GLOW, mat=1, base=True); bd.box(1.25, 0.2, 0.12, dx, dy - 0.06, zr + 0.14, QUOIN, base=True)
        if hi: bd.box(0.04, 0.04, 1.1, dx, dy - 0.07, zr + 0.2, WOOD_D, base=True); bd.box(1.0, 0.04, 0.04, dx, dy - 0.07, zr + 0.75, WOOD_D)
        bd.prism([(-0.95, 0), (0.95, 0), (0, 0.85)], 0.12, UPC, T(dx, dy, zr + 1.65), mat=0)
        for k in (-1, 1): bd.box(1.35, 3.1, 0.12, dx + k * 0.52, dy + 1.35, zr + 2.05, rc, ry=k * 0.72)
    # cupola on the ridge: stone base, lit lantern stage, octagonal cap, gilded finial + pennant
    cb = top + rise + 0.7   # cupola deck
    bd.box(2.0, 2.0, 1.5, 0, yc, cb - 1.5, hexc(STONES[2], 0.02, rng), base=True); bd.box(2.3, 2.3, 0.16, 0, yc, cb, QUOIN, base=True)
    bd.box(1.3, 1.3, 1.2, 0, yc, cb + 0.16, GLOW, mat=1, base=True)
    for sx in (-1, 1):
        for sy in (-1, 1): bd.box(0.24, 0.24, 1.3, sx * 0.8, yc + sy * 0.8, cb + 0.16, WOOD_D, base=True)
    if hi:
        for k in (-1, 1): bd.box(1.72, 0.08, 0.08, 0, yc + k * 0.8, cb + 0.55, WOOD_D); bd.box(0.08, 1.72, 0.08, k * 0.8, yc, cb + 0.55, WOOD_D)
    bd.box(2.1, 2.1, 0.16, 0, yc, cb + 1.46, WOOD_D, base=True)
    bd.cyl(1.35, 0.06, 1.5, 0, yc, cb + 1.6, rc, n=8 if hi else 4, rz=math.pi / 8 if hi else math.pi / 4)
    bd.sphere(0.16, 0, yc, cb + 3.1, GOLD, sub=1); bd.cyl(0.04, 0.02, 1.2, 0, yc, cb + 3.1, GOLD, n=6)
    bd.prism([(0, 0), (0, -0.4), (0.75, -0.18)], 0.03, PURP, T(0.04, yc, cb + 4.2), mat='awning_cloth')
    # chimneys (the south one is the lounge hearth flue)
    for (chx, chy) in ((x1 - 1.0, 0.6), (x0 + 1.6, 3.4)):
        bd.box(1.0, 1.0, rise + 2.2, chx, chy, top - 0.5, QUOIN, base=True); bd.box(1.3, 1.3, 0.2, chx, chy, top + rise + 1.7, 0x6d665e, base=True)
        if hi: bd.cyl(0.15, 0.15, 0.4, chx + 0.22, chy, top + rise + 1.9, 0xb8562e, n=6)
    # ================= the end walls + back: stone courses, windows, the south gable faces the Fish Market plaza =================
    for (xe, rz_, south) in ((x1, math.pi / 2, True), (x0, -math.pi / 2, False)):
        bd.push(T(xe, 0, 0, rz=rz_)); zg = gz(xe)   # local: x along the wall (world y * sign), -y = outward, wall face at y = 0
        wy = (-3.9, 3.9)
        er = wall_rects(-D2, D2, zg + 0.55, Gs, [(y_ - 0.75, y_ + 0.75, 2.0 if south else zg + 1.0, 4.96 if south else zg + 3.46) for y_ in wy])
        if hi: ashlar(bd, [(r[0], r[1], r[2], r[3]) for r in er], 0.0, SANDC, rng, rh=0.52)
        for y_ in wy: applied_arch_window(bd, y_, 2.1 if south else zg + 1.1, 4.2 if south else zg + 2.7, 0.7, lod, rng, lit=True)
        bd.box(d + 0.4, 0.5, 0.3, 0, -0.1, Gs - 0.04, QUOIN); bd.box(d + 0.3, 0.44, 0.24, 0, -0.08, z3 - 0.03, QUOIN)
        bd.box(d + 0.6, 0.36, zg + 0.55 - zlo, 0, -0.15, zlo, QUOIN, base=True)   # plinth course
        for f, zf in ((2, Gs), (3, z3)):
            for y_ in (-4.2, 0.0, 4.2):
                if f == 2 and y_ == 0.0 and south:
                    applied_arch_window(bd, 0.0, zf + 0.4, zf + 2.0, 0.6, lod, rng, lit=True)
                    bd.box(2.6, 1.0, 0.2, 0, -0.5, zf + 0.15, WOOD, base=True); bd.box(2.6, 0.1, 0.9, 0, -0.98, zf + 0.35, WOOD_D, base=True)   # Juliet balcony
                    for k in (-1, 1): bd.box(0.12, 1.0, 0.12, k * 1.24, -0.5, zf + 1.2, WOOD_D)
                    continue
                window(bd, y_, zf + 0.8, 1.6, -0.25, shut, lod, rng, lit=(f + int(y_)) % 2 == 0, box_=hi and f == 2, stone=f == 2)
        if hi:
            for yy in (-D2, D2):
                zq = zg - 0.15
                while zq < top - 0.3: bd.box(0.9 if int((zq - zg) / 0.6) % 2 else 0.6, 0.66, 0.56, yy + (0.3 if yy < 0 else -0.3), -0.24, zq + 0.29, hexc(QUOIN, 0.05, rng)); zq += 0.6
            ashlar(bd, wall_rects(-D2, D2, Gs, z3, [(y_ - 0.65, y_ + 0.65, Gs + 0.6, Gs + 2.6) for y_ in (-4.2, 0.0, 4.2)]), 0.0, UPC, rng)
        # gable: oculus (south: a lit rose window)
        bd.cyl(0.62, 0.62, 0.08, 0, -0.02, top + 1.6, GLOW if south else 0x22313d, n=12 if hi else 8, rx=math.pi / 2, mat=1 if south else 0)
        bd.torus(0.7, 0.13, 0, -0.08, top + 1.6, QUOIN, n=12 if hi else 8, m_=4, rx=math.pi / 2)
        if hi and south:
            for k in range(4): bd.box(1.2, 0.04, 0.05, 0, -0.12, top + 1.6, IRON, ry=k * math.pi / 4)
        bd.box(d + 0.5, 0.4, 0.26, 0, -0.08, top + 0.04, QUOIN)
        bd.pop()
    bd.push(T(0, BY, 0, rz=math.pi))   # back wall (faces the coliseum): courses + windows on the upper storeys
    bd.box(w + 0.4, 0.5, 0.3, 0, -0.1, Gs - 0.04, QUOIN); bd.box(w + 0.3, 0.44, 0.24, 0, -0.08, z3 - 0.03, QUOIN); bd.box(w + 0.6, 0.72, 0.34, 0, -0.06, top + 0.08, QUOIN)
    for zf in (Gs, z3):
        for x in (-10.0, -6.0, -2.0, 2.0, 6.0, 10.0):
            lit = (int(x) // 2 + int(zf)) % 3 == 0
            if lod == 0: window(bd, x, zf + 0.8, 1.6, -0.25, shut, lod, rng, lit=lit, box_=False, stone=True)
            else: bd.box(1.1, 0.08, 1.6, x, -0.03, zf + 0.8, GLOW if lit else 0x22313d, mat=1 if lit else 0, base=True); bd.box(1.4, 0.3, 0.12, x, -0.1, zf + 0.74, QUOIN, base=True)
    for x in (-9.0, 9.0): applied_arch_window(bd, x, 2.0, 3.8, 0.6, lod, rng, lit=True)
    bd.pop()
    # ================= interior: the walk-in war room =================
    ix0, ix1, iFY, iBY = x0 + WT, x1 - WT, FY + WT, BY - WT; iw, idp = ix1 - ix0, iBY - iFY; CEIL = Gs - 0.42
    np_ = int(iw / 0.3) if hi else 6
    for i in range(np_):   # weathered plank floor following the walk height (6 mm over the ground)
        x = ix0 + (i + 0.5) * iw / np_; bd.box(iw / np_ / math.cos(a), idp, 0.08, x, (iFY + iBY) / 2, gz(x) + 0.006 - 0.04, hexc(FLOOR_A if i % 2 else FLOOR_B, 0.05, rng), ry=a)
    bd.box(iw, idp, 0.12, 0, 0, CEIL, PLANK[2], base=True)                                                   # boarded ceiling
    # inlaid stone border (front / back bands follow the slope, end bands level)
    for yy in (iFY + 0.3, iBY - 0.3):
        if hi:
            nsb = int(iw / 0.9)
            for i in range(nsb): xm = ix0 + (i + 0.5) * iw / nsb; bd.box(iw / nsb / math.cos(a) - 0.04, 0.56, 0.08, xm, yy, gz(xm) + 0.016 - 0.04, hexc(STONES[2], 0.05, rng), ry=a)
        else: bd.box(iw / math.cos(a), 0.56, 0.08, 0, yy, 0.016 - 0.04, STONES[2], ry=a)
    for xe in (ix0 + 0.3, ix1 - 0.3): bd.box(0.56, idp - 1.2, 0.08, xe, 0, gz(xe) + 0.016 - 0.04, STONES[2])
    # guild runner (level along y on the centre line) + the round crimson rug under the war table
    TY = 0.2   # war-table centre: a 2.8 m lane to the roster board behind it
    bd.cyl(3.3, 3.3, 0.024, 0, TY, 0.0, CRIM, n=16 if hi else 8, ry=a, mat='awning_cloth')
    if hi: bd.torus(3.12, 0.035, 0, TY, 0.026, GOLD, n=16, m_=3, ry=a)
    bd.box(2.3 / math.cos(a), iBY - 0.9 - iFY + 0.6, 0.03, 0, (iFY - 0.6 + iBY - 0.9) / 2, 0.034 - 0.015, PURP, ry=a, mat='awning_cloth')
    for s in (-1, 1):
        bd.box(0.16, iBY - 0.9 - iFY + 0.6, 0.03, s * 1.05, (iFY - 0.6 + iBY - 0.9) / 2, gz(s * 1.05) + 0.045 - 0.015, CRIM, ry=a, mat='awning_cloth')
        if hi: bd.box(0.05, iBY - 0.9 - iFY + 0.6, 0.03, s * 0.88, (iFY - 0.6 + iBY - 0.9) / 2, gz(s * 0.88) + 0.052 - 0.015, GOLD, ry=a)
    # oak wainscot on the back + end walls (follows the floor), sandstone above
    bd.box(iw / math.cos(a), 0.07, 1.35, 0, iBY - 0.035, 0.675, WOOD, ry=a); bd.box(iw / math.cos(a), 0.12, 0.1, 0, iBY - 0.07, 1.38, WOOD_D, ry=a)
    for xe, s in ((ix0, 1), (ix1, -1)): bd.box(0.07, idp, 1.35, xe + s * 0.035, 0, gz(xe), WOOD, base=True); bd.box(0.12, idp, 0.1, xe + s * 0.06, 0, gz(xe) + 1.33, WOOD_D, base=True)
    if hi:
        for i in range(int(iw / 0.95) + 1): xx = ix0 + 0.1 + i * 0.95; bd.box(0.08, 0.04, 1.2, xx, iBY - 0.08, gz(xx) + 0.05, WOOD_D, base=True)
        for xe, s in ((ix0, 1), (ix1, -1)):
            for i in range(int(idp / 0.95) + 1): bd.box(0.04, 0.08, 1.2, xe + s * 0.08, iFY + 0.1 + i * 0.95, gz(xe) + 0.05, WOOD_D, base=True)
    # timber frame: tie beams across the hall (back posts + arched braces, front corbels), wall plates, two purlins, four free-standing columns
    BEAMX = (-7.6, -3.6, 0.0, 3.6, 7.6); bz = CEIL - 0.42
    for yy in (iFY + 0.15, iBY - 0.15): bd.box(iw, 0.3, 0.3, 0, yy, CEIL - 0.3, WOOD_D, base=True)
    for yy in (-3.2, 3.6): bd.box(iw, 0.3, 0.34, 0, yy, bz + 0.04, WOOD_D, base=True)
    for bx in BEAMX:
        bd.box(0.34, idp, 0.42, bx, 0, bz, WOOD_D, base=True)
        for yy, sy in ((iBY - 0.26, -1), (iFY + 0.26, 1)):
            posted = abs(bx) > 7 or (sy < 0 and abs(bx) > 3)
            if not posted:
                if abs(bx) > 0.1: bd.box(0.4, 0.5, 0.36, bx, yy - sy * 0.01, bz - 0.36, QUOIN, base=True)   # stone corbel
                continue
            bd.box(0.3, 0.26, bz - gz(bx) + 0.02, bx, yy - sy * 0.13, gz(bx) - 0.02, WOOD_D, base=True)
            if hi: bd.box(0.2, 0.2, 2.0, bx, yy + sy * 0.62, bz - 0.62, WOOD_D, rx=sy * 0.78)
    for cx_ in (-7.6, 7.6):
        for cy_ in (-3.2, 3.6):
            zb = gz(cx_)
            bd.box(0.82, 0.82, 0.5, cx_, cy_, zb - 0.12, QUOIN, base=True)
            bd.cyl(0.27, 0.24, bz - zb - 0.62, cx_, cy_, zb + 0.38, WOOD_D, n=8 if hi else 6)
            bd.box(0.7, 0.7, 0.2, cx_, cy_, bz - 0.24, WOOD_D, base=True)
            if hi:
                bd.box(0.28, 1.8, 0.22, cx_, cy_, bz - 0.22, WOOD_D, base=True)
                for k in (-1, 1): bd.box(0.16, 0.16, 1.3, cx_, cy_ + k * 0.42, bz - 0.85, WOOD_D, rx=-k * 0.7)
                bd.torus(0.3, 0.04, cx_, cy_, zb + 0.42, GOLD, n=8, m_=3)
            if cols is not None: cols.append(['c', round(cx_, 3), round(-cy_, 3), 0.5])
    # light: the great chandelier over the war table, two in the wings, sconces
    chandelier(bd, 0, TY, 4.9, 1.3, 10, CEIL, lod)
    for s in (-1, 1): chandelier(bd, s * 9.4, 0.4, gz(s * 9.4) + 4.5, 0.85, 6, CEIL, lod)
    for x in (-10.4, -4.6, 4.6, 10.4): sconce(bd, x, iBY, gz(x) + 3.0, lod, out=-1)
    for x in (-6.9, 6.9): sconce(bd, x, iFY, gz(x) + 3.1, lod, out=1)
    for xe, s in ((ix0, 1), (ix1, -1)):
        for y_ in ((-4.4, 4.4) if s > 0 else (-3.4, 3.4)):
            bd.push(T(xe, y_, gz(xe) + 2.9, rz=s * math.pi / 2)); sconce(bd, 0, 0, 0, lod, out=-1); bd.pop()
    # ---- the Captains' War Table (octagon, carved oak, brass trim, parchment sea chart, islands, ship markers, compass, candles, scrolls) ----
    tz = 0.96; o8 = math.pi / 8
    bd.cyl(0.55, 0.42, tz - 0.2 + 0.25, 0, TY, -0.25, WOOD_D, n=8, rz=o8)
    for k in range(8):
        ang = k * math.pi / 4 + o8; lx_, ly_ = 1.38 * math.cos(ang), TY + 1.38 * math.sin(ang)
        bd.box(0.17, 0.17, tz - 0.16 - gz(lx_) + 0.05, lx_, ly_, gz(lx_) - 0.05, WOOD_D, base=True, rz=ang)
        if hi: bd.sphere(0.12, lx_, ly_, gz(lx_) + 0.3, WOOD_D, sub=0, s=(1, 1, 1.4)); bd.box(0.2, 0.2, 0.06, lx_, ly_, gz(lx_) - 0.01, GOLD, base=True, rz=ang)
    bd.cyl(1.66, 1.66, 0.24, 0, TY, tz - 0.32, WOOD, n=8, rz=o8)
    bd.cyl(1.9, 1.9, 0.1, 0, TY, tz - 0.08, WOOD_D, n=8, rz=o8)
    bd.torus(1.9 / math.cos(o8) * math.cos(o8), 0.055, 0, TY, tz - 0.03, GOLD, n=8, m_=4, rz=o8)
    bd.cyl(1.66, 1.66, 0.02, 0, TY, tz + 0.02, PARCH, n=8, rz=o8)
    bd.cyl(1.42, 1.42, 0.02, 0, TY, tz + 0.03, SEA, n=8 if not hi else 24, rz=o8)
    if hi:
        for k in range(8):   # brass corner caps on the rim
            ang = k * math.pi / 4; bd.box(0.16, 0.1, 0.14, 1.86 * math.cos(ang), TY + 1.86 * math.sin(ang), tz - 0.06, GOLD, rz=ang + math.pi / 2)
    for (mx, my, s_) in ((-0.75, -0.35, 0.42), (0.55, 0.3, 0.5), (0.1, -0.7, 0.28), (-0.35, 0.75, 0.3), (0.95, -0.55, 0.22)):
        bd.cyl(s_ + 0.06, s_ + 0.06, 0.02, mx, TY + my, tz + 0.045, 0xd9c08a, n=10 if hi else 6)
        bd.sphere(s_, mx, TY + my, tz + 0.06, hexc(LAND, 0.1, rng), sub=1 if hi else 0, s=(1, 0.8, 0.32))
        if hi and s_ > 0.3:
            for k in range(2): bd.cyl(0.03, 0.0, 0.18, mx + 0.1 * k - 0.05, TY + my + 0.08, tz + 0.12, 0x2f6a2a, n=4)
    for (mx, my, c_, r_) in ((-0.2, -0.15, PURP, 0.4), (0.25, -0.35, PURP, 1.2), (-0.55, 0.3, CRIM, 2.4), (0.6, 0.85, CRIM, 3.6)):
        bd.box(0.2, 0.08, 0.06, mx, TY + my, tz + 0.07, WOOD_D, base=True, rz=r_)
        bd.box(0.02, 0.02, 0.2, mx, TY + my, tz + 0.12, WOOD_D, base=True)
        bd.prism([(-0.07, 0), (0.07, 0), (0, 0.15)], 0.015, c_, T(mx, TY + my, tz + 0.15, rz=r_), mat='awning_cloth')
    bd.torus(0.2, 0.02, -1.05, TY + 0.55, tz + 0.06, GOLD, n=12 if hi else 6, m_=3)
    for k in range(2): bd.box(0.46, 0.04, 0.012, -1.05, TY + 0.55, tz + 0.065, GOLD, rz=k * math.pi / 2)
    bd.sphere(0.035, -1.05, TY + 0.55, tz + 0.08, GOLD, sub=0)
    for (cx_, cy_) in ((1.15, TY + 0.95), (-1.2, TY - 0.85)):   # brass candlesticks
        bd.cyl(0.11, 0.08, 0.04, cx_, cy_, tz + 0.04, GOLD, n=8); bd.cyl(0.03, 0.03, 0.3, cx_, cy_, tz + 0.08, GOLD, n=6)
        bd.cyl(0.035, 0.035, 0.16, cx_, cy_, tz + 0.38, BONE, n=6); bd.box(0.06, 0.06, 0.1, cx_, cy_, tz + 0.54, FLAME, mat=1, base=True)
    bd.box(0.24, 0.24, 0.3, 1.25, TY - 0.7, tz + 0.04, GLOW, mat=1, base=True)   # table lantern
    bd.box(0.3, 0.3, 0.05, 1.25, TY - 0.7, tz + 0.03, IRON, base=True); bd.box(0.3, 0.3, 0.05, 1.25, TY - 0.7, tz + 0.34, IRON, base=True)
    bd.cyl(0.03, 0.01, 0.12, 1.25, TY - 0.7, tz + 0.39, IRON, n=4)
    for (cx_, cy_, rz_) in ((-0.5, TY + 1.3, 0.2), (0.25, TY + 1.42, -0.15), (-1.35, TY + 0.1, 1.5)):
        bd.cyl(0.055, 0.055, 0.62, cx_ - 0.31 * math.cos(rz_), cy_ - 0.31 * math.sin(rz_), tz + 0.1, PARCH, n=8 if hi else 5, ry=math.pi / 2, rz=rz_)
    for k in range(6):   # high-backed captains' chairs around the table (none on the entrance side)
        ang = k * math.pi / 3; cx_, cy_ = 2.32 * math.cos(ang), TY + 2.32 * math.sin(ang)
        chair(bd, cx_, cy_, gz(cx_) - 0.02, ang - math.pi / 2, lod, cush=PURP if k % 2 else CRIM)
    if cols is not None: cols.append(['c', 0.0, round(-TY, 3), 2.78])
    # ---- north wing: ARMORY & TROPHY (weapon rack + crossed cutlasses + flintlocks + shields on the end wall, chests, barrels, crates, benches) ----
    zf = gz(ix0)
    bd.push(T(ix0, 0, zf, rz=math.pi / 2))   # local -y = into the room (+x), local x = world y
    bd.box(4.2, 0.1, 2.3, 0, -0.06, 1.25, WOOD_D, base=True)
    for zz in (1.22, 3.5): bd.box(4.4, 0.16, 0.12, 0, -0.1, zz, WOOD, base=True)
    for xx in (-2.15, 2.15): bd.box(0.14, 0.16, 2.4, xx, -0.1, 1.22, WOOD, base=True)
    for xc_ in (-1.35, 0.0, 1.35): emblem(bd, xc_, -0.14, 2.75, 0.95, lod)
    for zz in (1.55, 1.85):   # flintlocks
        bd.cyl(0.03, 0.03, 1.15, -1.0, -0.2, zz, IRON, n=6, ry=math.pi / 2); bd.box(0.5, 0.06, 0.13, 0.35, -0.2, zz, 0x6b4527); bd.box(0.12, 0.05, 0.06, 0.1, -0.22, zz - 0.04, GOLD)
    for xs, c_ in ((-2.9, CRIM), (2.9, PURP)):   # painted shields
        bd.cyl(0.52, 0.52, 0.07, xs, -0.04, 2.5, c_, n=14 if hi else 8, rx=math.pi / 2)
        bd.torus(0.52, 0.04, xs, -0.1, 2.5, GOLD, n=14 if hi else 8, m_=3, rx=math.pi / 2); bd.sphere(0.11, xs, -0.12, 2.5, GOLD, sub=0)
        if hi: bd.box(0.12, 0.03, 0.96, xs, -0.1, 2.5, GOLD); bd.box(0.96, 0.03, 0.12, xs, -0.1, 2.5, GOLD)
    chest(bd, -1.3, -0.62, 0.0, 0.0, lod, gold=True); chest(bd, 1.3, -0.62, 0.0, 0.0, lod)
    bd.pop()
    for (bx_, by_) in ((-10.75, 5.75), (-9.85, 5.9)): barrel_(bd, bx_, by_, gz(bx_), lod)
    barrel_(bd, -10.3, 5.8, gz(-10.3) + 1.0, lod, r=0.36, h=0.9)
    for (cx_, cy_, s_) in ((-10.75, -5.75, 0.95), (-9.85, -5.85, 0.75)):
        bd.box(s_, s_, s_, cx_, cy_, gz(cx_) - 0.02, WOOD_L, base=True)
        if hi:
            for zz in (0.06, s_ - 0.06): bd.box(s_ + 0.04, s_ + 0.04, 0.1, cx_, cy_, gz(cx_) - 0.02 + zz, WOOD_D)
    bench(bd, -8.6, -5.6, iFY + 0.52, gz, a, lod)
    if hi:   # ship's wheel trophy on the back wall
        wx, wz = -8.6, gz(-8.6) + 3.0
        bd.torus(0.6, 0.05, wx, iBY - 0.12, wz, WOOD_D, n=16, m_=4, rx=math.pi / 2); bd.cyl(0.12, 0.12, 0.12, wx, iBY - 0.06, wz, GOLD, n=8, rx=math.pi / 2)
        for k in range(8): t = k * math.pi / 4; bd.box(0.05, 0.05, 1.5, wx, iBY - 0.12, wz, WOOD_D, ry=t)
    bench(bd, -8.9, -4.7, iBY - 0.55, gz, a, lod)
    banner(bd, -5.5, iBY - 0.1, CEIL - 0.9, 2.6, 1.0, lod, rng, col=CRIM)
    # ---- south wing: CAPTAINS' LOUNGE (hearth + mantel + chart, fireside chairs, globe, spyglass, map credenza, banner) ----
    zf = gz(ix1)
    bd.push(T(ix1, 0, zf, rz=-math.pi / 2))   # local -y = into the room (-x), local x = world -y
    bd.box(3.4, 0.75, CEIL - zf + 0.2, 0, -0.37, -0.2, QUOIN, base=True)                       # chimney breast
    bd.box(1.9, 0.08, 1.3, 0, -0.78, 0.0, SOOT, base=True)                                    # firebox
    for k in (-1, 1): bd.box(0.36, 0.42, 1.55, k * 1.13, -0.86, -0.02, hexc(STONES[2], 0.02, rng), base=True)
    bd.box(2.7, 0.46, 0.38, 0, -0.88, 1.38, hexc(STONES[2], 0.02, rng), base=True)
    bd.box(3.2, 0.55, 0.14, 0, -0.95, 1.8, WOOD_D, base=True)                                  # mantel
    bd.box(1.5, 0.5, 0.1, 0, -1.0, 0.02, EMBER, mat=1, base=True)
    for k in (-1, 0, 1): bd.cyl(0.09, 0.09, 1.0, -0.5, -1.0 + k * 0.12, 0.16 + (k == 0) * 0.12, 0x4a2c16, n=6, ry=math.pi / 2)
    for k in (-0.35, 0.0, 0.35): bd.prism([(-0.16, 0), (0.16, 0), (0, 0.5 - abs(k) * 0.4)], 0.06, FLAME, T(k, -1.0, 0.22), mat=1)
    for k in (-1, 1): bd.cyl(0.08, 0.06, 0.04, k * 1.25, -1.0, 1.94, GOLD, n=6); bd.cyl(0.03, 0.03, 0.26, k * 1.25, -1.0, 1.98, BONE, n=6); bd.box(0.06, 0.06, 0.1, k * 1.25, -1.0, 2.24, FLAME, mat=1, base=True)
    bd.box(1.9, 0.06, 1.2, 0, -0.78, 2.3, PARCH, base=True)                                   # framed chart over the mantel
    for zz in (2.27, 3.48): bd.box(2.05, 0.1, 0.08, 0, -0.8, zz, WOOD_D, base=True)
    for xx in (-0.98, 0.98): bd.box(0.08, 0.1, 1.3, xx, -0.8, 2.27, WOOD_D, base=True)
    if hi:
        bd.box(1.4, 0.02, 0.7, 0.05, -0.82, 2.55, SEA, base=True)
        for (mx, mz, r_) in ((-0.35, 2.75, 0.18), (0.3, 2.95, 0.22), (0.4, 2.65, 0.12)): bd.cyl(r_, r_, 0.02, mx, -0.83, mz, LAND, n=8, rx=math.pi / 2)
    bd.box(2.4, 3.0, 0.02, 0, -2.4, 0.03, CRIM, base=True, mat='awning_cloth')                 # hearth rug (level: the end strip is level)
    bd.pop()
    for k in (-1, 1): chair(bd, ix1 - 2.6, k * 1.25, gz(ix1 - 2.6) - 0.02, math.pi / 2 + k * 0.35, lod, cush=CRIM)
    gx_, gy_ = 9.6, -4.7; zb = gz(gx_)   # globe on its stand
    bd.cyl(0.32, 0.22, 0.08, gx_, gy_, zb, WOOD_D, n=8); bd.cyl(0.06, 0.05, 0.62, gx_, gy_, zb + 0.08, WOOD_D, n=6)
    if hi:
        for k in range(3): t = k * 2 * math.pi / 3; bd.box(0.07, 0.07, 0.5, gx_ + 0.2 * math.cos(t), gy_ + 0.2 * math.sin(t), zb + 0.25, WOOD_D, rx=0.5 * math.sin(t), ry=-0.5 * math.cos(t))
    bd.sphere(0.4, gx_, gy_, zb + 1.08, SEA, sub=2 if hi else 1)
    for (dx_, dy_, dz_) in ((0.3, -0.15, 0.1), (-0.2, -0.3, -0.15), (0.05, 0.3, 0.2)): bd.sphere(0.16, gx_ + dx_, gy_ + dy_, zb + 1.08 + dz_, LAND, sub=0, s=(1, 1, 0.8))
    bd.torus(0.47, 0.03, gx_, gy_, zb + 1.08, GOLD, n=14 if hi else 8, m_=3, rx=math.pi / 2, rz=0.4)
    bd.torus(0.47, 0.025, gx_, gy_, zb + 1.08, GOLD, n=14 if hi else 8, m_=3)
    sx_, sy_ = 9.7, 4.6; zb = gz(sx_)   # brass spyglass on a tripod, pointed at the front windows
    for k in range(3): t = k * 2 * math.pi / 3; bd.box(0.05, 0.05, 1.3, sx_ + 0.22 * math.cos(t), sy_ + 0.22 * math.sin(t), zb + 0.6, WOOD_D, rx=0.3 * math.sin(t), ry=-0.3 * math.cos(t))
    bd.cyl(0.07, 0.05, 1.1, sx_ - 0.1, sy_ + 0.4, zb + 1.25, GOLD, n=8, rx=1.25)
    bd.cyl(0.09, 0.09, 0.18, sx_ - 0.1, sy_ + 0.4, zb + 1.25, GOLD, n=8, rx=1.25)
    CRX = 9.45
    bd.box(2.9 / math.cos(a), 0.62, 0.98, CRX, iBY - 0.36, gz(CRX) + 0.49, WOOD, ry=a)       # map credenza
    bd.box(3.0 / math.cos(a), 0.7, 0.08, CRX, iBY - 0.36, gz(CRX) + 1.0, WOOD_D, ry=a)
    if hi:
        for i in range(3):
            xx = 8.5 + i * 0.95
            for zz in (0.3, 0.68): bd.box(0.8, 0.03, 0.3, xx, iBY - 0.68, gz(xx) + zz, WOOD_D); bd.sphere(0.035, xx, iBY - 0.7, gz(xx) + zz, GOLD, sub=0)
        for k in range(3): bd.cyl(0.06, 0.06, 0.7, 9.6 + k * 0.05, iBY - 0.5 + k * 0.13, gz(10.0) + 1.1 + 0.06, PARCH, n=6, ry=math.pi / 2)
    bd.box(0.22, 0.22, 0.3, 8.6, iBY - 0.36, gz(8.6) + 1.04, GLOW, mat=1, base=True)
    banner(bd, CRX, iBY - 0.1, CEIL - 0.9, 2.4, 1.0, lod, rng, col=PURP)
    bench(bd, 5.6, 8.6, iFY + 0.52, gz, a, lod); bench(bd, 4.4, 7.2, iBY - 0.55, gz, a, lod)
    # ---- rear focal wall: the SQUAD ROSTER board (2v2 crew slots, bounty + match notices, header plaque) between guild standards ----
    yb_ = iBY
    for s in (-1, 1): bd.box(0.5, 0.34, 4.6, s * 2.95, yb_ - 0.17, gz(s * 2.95) - 0.05, QUOIN, base=True)
    bd.box(6.5, 0.46, 0.42, 0, yb_ - 0.23, 4.5, QUOIN, base=True); bd.box(6.3, 0.4, 0.5, 0, yb_ - 0.2, -0.1, QUOIN, base=True)
    bd.box(5.4, 0.12, 3.6, 0, yb_ - 0.1, 0.8, WOOD_D, base=True)
    bd.box(5.1, 0.04, 2.45, 0, yb_ - 0.17, 0.95, 0x2a1a0c, base=True)
    bd.box(4.0, 0.12, 0.66, 0, yb_ - 0.2, 3.62, SIGNB, base=True)
    for zz in (3.6, 4.24): bd.box(4.2, 0.16, 0.08, 0, yb_ - 0.24, zz, GOLD, base=True)
    carve(bd, 'SQUAD HALL', 0, yb_ - 0.27, 3.95, 3.4, 0.46, FRONT, lod, col=GOLD)
    emblem(bd, 0, yb_ - 0.5, 5.2, 1.0, lod)
    for s, c_ in ((-1, PURP), (1, CRIM)):   # 2v2: two crews x two slots
        cx_ = s * 1.35
        bd.box(2.1, 0.05, 0.36, cx_, yb_ - 0.2, 3.12, c_, base=True, mat='awning_cloth')
        for zz in (2.48, 1.86):
            bd.box(1.9, 0.05, 0.46, cx_, yb_ - 0.2, zz, PARCH, base=True); bd.box(0.18, 0.06, 0.46, cx_ - 0.86, yb_ - 0.22, zz, c_, base=True)
            if hi: bd.box(1.3, 0.02, 0.04, cx_ + 0.12, yb_ - 0.235, zz + 0.2, 0x5a3219); bd.sphere(0.05, cx_ + 0.86, yb_ - 0.26, zz + 0.36, CRIM, sub=0)
    carve(bd, '2v2', 0, yb_ - 0.21, 2.35, 0.55, 0.4, FRONT, lod, col=GOLD)
    for i, nx in enumerate((-2.1, -0.75, 0.75, 2.1)):   # pinned notices
        rz_ = (-0.06, 0.05, -0.04, 0.07)[i]
        bd.box(0.62, 0.03, 0.62, nx, yb_ - 0.2, 1.0, PARCH if i % 2 == 0 else 0xf3e6c8, base=True, ry=rz_)
        bd.sphere(0.04, nx, yb_ - 0.24, 1.56, CRIM if i % 2 else PURP, sub=0)
        if hi:
            for k in range(3): bd.box(0.42, 0.012, 0.03, nx, yb_ - 0.22, 1.18 + k * 0.12, 0x5a3219, ry=rz_)
            if i in (0, 3): bd.box(0.3, 0.012, 0.18, nx, yb_ - 0.22, 1.36, 0x8a1c1c, ry=rz_)
    for s in (-1, 1):   # guild standards flanking the board
        sx2 = s * 3.75; zb = gz(sx2)
        bd.cyl(0.32, 0.36, 0.16, sx2, yb_ - 0.6, zb - 0.02, IRON, n=8); bd.cyl(0.05, 0.05, 4.7, sx2, yb_ - 0.6, zb, WOOD_D, n=6)
        bd.cyl(0.08, 0.0, 0.32, sx2, yb_ - 0.6, zb + 4.7, GOLD, n=4)
        banner(bd, sx2, yb_ - 0.6, zb + 4.35, 2.5, 0.9, lod, rng, col=PURP if s < 0 else CRIM)
    if cols is not None:
        cols.append(['b', 0.0, round(-(iBY - 0.4), 3), 8.4, 0.9])
    # ---- colliders (three.js building frame: x, z = -y): the front wall split around the portal, the end walls, the back, the wing furniture ----
    if cols is not None:
        fz = D2 - WT / 2 + 0.1; fd = WT + 0.62
        for (pa, pc) in ((x0 - 0.3, -OW / 2 - 0.02), (OW / 2 + 0.02, x1 + 0.3)): cols.append(['b', round((pa + pc) / 2, 3), round(fz, 3), round(pc - pa, 3), round(fd, 3)])
        cols.append(['b', round(x0 + WT / 2 - 0.15, 3), 0.0, WT + 0.3, round(d + 0.6, 3)]); cols.append(['b', round(x1 - WT / 2 + 0.15, 3), 0.0, WT + 0.3, round(d + 0.6, 3)])
        cols.append(['b', 0.0, round(-(D2 - WT / 2) - 0.15, 3), round(w + 0.6, 3), WT + 0.3])
        cols += [['b', round(ix0 + 0.75, 3), 0.0, 1.5, 4.6],                                   # armory rack + chests
                 ['c', -10.3, -5.8, 1.05], ['b', -10.3, 5.8, 1.9, 1.3],                        # barrels, crates
                 ['b', -7.1, round(-(iFY + 0.52), 3), 3.2, 0.75], ['b', -6.8, round(-(iBY - 0.55), 3), 4.4, 0.75],   # benches
                 ['b', round(ix1 - 0.6, 3), 0.0, 1.2, 3.6],                                    # hearth
                 ['c', round(ix1 - 2.6, 3), -1.25, 0.5], ['c', round(ix1 - 2.6, 3), 1.25, 0.5],   # fireside chairs
                 ['c', 9.6, 4.7, 0.55], ['c', 9.65, -4.75, 0.6],                               # globe, spyglass
                 ['b', 9.45, round(-(iBY - 0.36), 3), 3.1, 0.85], ['b', 7.1, round(-(iFY + 0.52), 3), 3.2, 0.75], ['b', 5.8, round(-(iBY - 0.55), 3), 3.0, 0.75]]   # credenza, benches

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

# ---- [Raul hill-weapons] BANKSY via Emerly: the weapon shops move to the east row by the coliseum MAIN_GATE ----
#   R1 (#34) + R2 (#35) = ONE wide building = the MUSKET SHOP (origin R2, the deeper lot; R1's slice is a 'merged' stub: no building of its own,
#   js/island/hillStreet.js hillLot returns true there). Its south end stays the finished end wall on the ~1 m alley to the Squad Hall (R0, #33:
#   R1 stays clipped at lz -84.05 by OBST above, R0 itself is not touched here).
#   R3 (#36) = the SWORD SHOP: its north end is pulled back so wall (1.4 m), eaves + trim (>= 0.6 m) and sign / colliders stay clear of the south face of
#   the MAIN_GATE gallery (js/island/coliseum.js MAIN_GATE lz -114.761, w 9.624: face at lz -109.949).
#   L6 (#26) + R6 (#38) = the old SWORD / MUSKET SHOP lots = plain empty rent shops (same style rules as every other rent lot).
#   Stable ids: every rent shop keeps its rent_<n> (the v170 numbering), R1 / R2 / R3 retire rent_13 / 14 / 15, L6 / R6 are appended as rent_23 / 24.
MG_LZ, MG_W, GATE_CLEAR = -114.761, 9.624, 1.4                                      # keep in sync with js/island/coliseum.js MAIN_GATE
LEGACY = {'L6': 'sword', 'R6': 'musket'}
_lr = [b for b in B if b['kind'] in ('rent', 'sword', 'musket') and LEGACY.get(b['key'], 'rent') == 'rent']
RENT_ID = {b['key']: i + 1 for i, b in enumerate(_lr)}; RENT_ID.update(L6=len(_lr) + 1, R6=len(_lr) + 2)
WEAPON_LOTS = {'R2': 'musket', 'R3': 'sword'}
_k = {b['key']: b for b in B}
for b in B:
    if b['key'] not in ('L6', 'R6', 'R1', 'R2', 'R3'): continue
    side, n = b['side'], b['n']; kind = WEAPON_LOTS.get(b['key'], 'merged' if b['key'] == 'R1' else 'rent'); b['kind'] = kind
    if kind == 'rent':   # the same rules as the loop above gives every rent lot
        b['fl'] = [2, 3, 3, 2, 3, 2, 3][(n * 3 + (side > 0) * 2) % 7]; b['style'] = ['stone', 'timber', 'plank'][(n + (side > 0)) % 3]
        b['roof'] = 'gable' if (n * 5 + side) % 4 == 1 else 'ridge'; b['G'] = [4.6, 5.0, 4.8][(n + (side > 0)) % 3]; b['v'] = (n * 2 + (side > 0)) % 12
    else:                # the weapon shops keep their v170 look (palette variant, style, 3 storeys, front gable)
        b['fl'], b['roof'], b['G'] = 3, 'gable', 5.4; b['style'], b['v'] = ('stone', 0) if kind == 'sword' else ('timber', 1)
    b['rent'] = RENT_ID.get(b['key']) if kind == 'rent' else None
for b in B:
    if b['kind'] == 'rent' and b['key'] in RENT_ID: b['rent'] = RENT_ID[b['key']]
_m, _s = _k['R2'], _k['R1']     # MUSKET SHOP = R2 widened over R1's slice (R2 frame: local +x = +lz on the east row)
_m['x1'] = _s['lz'] + _s['x1'] - _m['lz']; _m['end1'] = _s['end1']; _m['w'] = _m['x1'] - _m['x0']
_m.update(grand=True, G=6.0, OT=3.6, AR=0.9, covers=['R1'], span=[round(_m['lz'] + _m['x0'], 3), round(_m['lz'] + _m['x1'], 3)])
find_door(_m, ((1.3, 4.6, 1.3), (1.3, 4.2, 1.3), (1.3, 3.6, 1.3)))
_w = _k['R3']; _w['x0'] = max(_w['x0'], (MG_LZ + MG_W / 2 + GATE_CLEAR) - _w['lz']); _w['w'] = _w['x1'] - _w['x0']; find_door(_w)
_w['span'] = [round(_w['lz'] + _w['x0'], 3), round(_w['lz'] + _w['x1'], 3)]
for b in (_k['L6'], _k['R6']): find_door(b)
STUBS = [_s]; B.remove(_s)
print('WEAPONS', {k: (round(_k[k]['x0'], 3), round(_k[k]['x1'], 3), round(_k[k]['xo'], 3), _k[k]['ow']) for k in ('R2', 'R3', 'L6', 'R6')}, 'rent', {k: _k[k]['rent'] for k in ('L6', 'R6')}, flush=True)

REPORT = {}; DATA = []
COLLS = {k: bpy.data.collections.new('hill_' + k) for k in ('street', 'sword', 'musket', 'big')}
for c in COLLS.values(): bpy.context.scene.collection.children.link(c)
for b in B:
    G = b['G']; OPEN_TOP = b.get('OT', 3.4); ARISE = b.get('AR', 0.0)
    coll = COLLS['street' if b['kind'] == 'rent' else 'big' if b['kind'] == 'squad' else b['kind']]
    root = bpy.data.objects.new('hill_' + b['key'], None); coll.objects.link(root); cols = []; b['_props'] = []; rep = {}
    for lod in (0, 1):
        rng = np.random.default_rng(b['n'] * 31 + (b['side'] > 0) * 7 + lod); random.seed(b['n'])
        bd = Builder(); bd.ground = (lambda g: (lambda x, y: g * x))(b['g'])
        if b['kind'] == 'squad': squad_hall(bd, b, lod, rng, cols if lod == 0 else None)   # [Timothy v312] its own generator (no rent room, no hanging sign plate)
        else:
            building(bd, b, lod, rng, cols if lod == 0 else None); R = interior(bd, b, lod, rng, cols if lod == 0 else None)
            (rent_room if b['kind'] == 'rent' else weapon_room)(bd, b, lod, rng, R); bracket(bd, b)
        bake_obj(bd, f"hill_{b['key']}_LOD{lod}", coll, root); rep[f'LOD{lod}'] = bd.tris()
    cols += b['_props'] if b.get('grand') else b['_props'][:2]
    sid = None if b['kind'] == 'squad' else 'sign_rent_%s' % b['rent'] if b['kind'] == 'rent' else 'sign_swords' if b['kind'] == 'sword' else 'sign_muskets'
    eid = 'door_squad_hall' if b['kind'] == 'squad' else 'door_rent_%s' % b['rent'] if b['kind'] == 'rent' else 'door_swords' if b['kind'] == 'sword' else 'door_muskets'
    if sid: bake_obj(sign_plate(b), sid, coll, root)   # the Squad Hall's SQUAD HALL board is carved into its LOD meshes (phones keep their 2-draw merge)
    e = bpy.data.objects.new(eid, None); coll.objects.link(e); e.parent = root; e.location = (b['xo'], -b['d'] / 2, b['g'] * b['xo']); e.empty_display_size = 0.5
    wt_ = 0.6 if b['kind'] == 'squad' else WALL
    inner = [round(b['x0'] + wt_, 3), round(-(b['d'] / 2 - wt_), 3), round(b['x1'] - wt_, 3), round(b['d'] / 2 - wt_, 3)]   # three.js building frame x0, z0, x1, z1
    root['colliders'] = json.dumps(cols); root['interior'] = json.dumps(inner); root['door'] = json.dumps([round(b['xo'], 3), round(b['d'] / 2, 3)])
    root['sign'] = sid or ''; root['empty'] = eid; root['top'] = b['top']; root['kind'] = b['kind']
    if b.get('span'): root['span'] = json.dumps(b['span'])   # [Raul hill-weapons] town-local lz range of a widened / trimmed building (map + grass)
    if b.get('covers'): root['covers'] = json.dumps(b['covers'])
    REPORT[b['key']] = rep
    DATA.append(dict(key=b['key'], kind=b['kind'], rent=b.get('rent'), side=b['side'], n=b['n'], lx=round(b['lx'], 3), lz=round(b['lz'], 3), w=round(b['w'], 3), d=round(b['d'], 3),
                     x0=round(b['x0'], 3), x1=round(b['x1'], 3), fl=b['fl'], style=b['style'], roof=b['roof'], g=b['g'], y=round(b['y'], 3), door=[round(b['xo'], 3), round(b['d'] / 2, 3)],
                     ow=b['ow'], interior=inner, colliders=cols, sign=sid, empty=eid, top=round(b['top'], 2), covers=b.get('covers')))
    print(b['key'], b['kind'], b['style'], b['roof'], 'fl', b['fl'], rep, flush=True)
for b in STUBS:   # [Raul hill-weapons] R1 = the south bay of the MUSKET SHOP (R2): an empty marker so hillLot builds nothing there
    st = bpy.data.objects.new('hill_' + b['key'], None); COLLS['musket'].objects.link(st); st['kind'] = 'merged'; st['merged'] = 'R2'; st['colliders'] = '[]'
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
rent, weap, squad = [], [], None
for L in DATA:
    th = math.pi / 2 if L['side'] < 0 else -math.pi / 2; i0, j0, i1, j1 = L['interior']
    cs = [town(L, a, c) for a in (i0, i1) for c in (j0, j1)]
    if L['kind'] == 'squad':   # [Timothy v312] the SQUAD HALL (R0): footprint, door, walk-in interior, the E · SQUAD HALL point (foot.js INTERACT 'squadhall')
        il = town(L, SQ_INTERACT[0], -SQ_INTERACT[1])
        squad = dict(id='squad_hall', lot=L['key'], lx=L['lx'], lz=L['lz'], ly=round(th, 4), w=L['w'], d=L['d'], storeys=3, top=L['top'],
                     rect=dict(lx0=round(L['lx'] - L['d'] / 2, 3), lx1=round(L['lx'] + L['d'] / 2, 3), lz0=round(L['lz'] - L['w'] / 2, 3), lz1=round(L['lz'] + L['w'] / 2, 3)),
                     door=dict(zip(('lx', 'lz'), town(L, L['door'][0], L['door'][1]))), doorY=round(L['y'] + L['g'] * L['door'][0], 3), doorW=L['ow'], facing=round(th, 4),
                     interior=dict(lx0=min(c[0] for c in cs), lz0=min(c[1] for c in cs), lx1=max(c[0] for c in cs), lz1=max(c[1] for c in cs), slope=0.11),
                     interact=dict(lx=il[0], lz=il[1], r=3.2), empty=L['empty'])
        continue
    e = dict(id=('rent_%s' % L['rent']) if L['kind'] == 'rent' else ('sword_shop' if L['kind'] == 'sword' else 'musket_shop'), lot=L['key'],
             lx=L['lx'], lz=L['lz'], ly=round(th, 4), w=round(L['x1'] - L['x0'], 3), d=L['d'], storeys=L['fl'],
             door=dict(zip(('lx', 'lz'), town(L, L['door'][0], L['door'][1]))), doorY=round(L['y'] + L['g'] * L['door'][0], 3), doorW=L['ow'], facing=round(th, 4),
             interior=dict(lx0=min(c[0] for c in cs), lz0=min(c[1] for c in cs), lx1=max(c[0] for c in cs), lz1=max(c[1] for c in cs), floorY=dict(atLz0=round(gyl(min(c[1] for c in cs)), 3), atLz1=round(gyl(max(c[1] for c in cs)), 3)), slope=0.11),
             sign=L['sign'], empty=L['empty'])
    if L.get('covers'): e['lots'] = sorted([L['key'], *L['covers']]); e['size'] = 'double'   # [Raul hill-weapons] the MUSKET SHOP = R1 + R2
    (rent if L['kind'] == 'rent' else weap).append(e)
json.dump(dict(RENTABLE_SHOPS=rent, MAIN_ST_SHOPS=weap, SQUAD_HALL=squad), open(os.path.join(GAME, 'assets/island/hill_shops.json'), 'w'), indent=1)
with open(os.path.join(GAME, 'js/island/hillShops.js'), 'w') as f:
    f.write("// [Timothy] PUMPFUN PIRATES hill street shop data (GENERATED by tools/hill_blender/hill_street_blender.py, do not hand-edit; also assets/island/hill_shops.json).\n")
    f.write("// Town-local frame (js/island/coast.js): lx along the waterfront, +lz out to sea; ly / facing = the way the door faces (three.js yaw in the town frame,\n")
    f.write("// PI/2 = faces +lx, -PI/2 = faces -lx). door = the doorway centre on the facade (the door empty: +z = out of the door), doorY = the walk height there.\n")
    f.write("// interior = the walkable shop room (AABB inside the walls; its floor follows the street slope 0.11 m/m: floorY.atLz0 / atLz1 at its two ends).\n")
    f.write("// sign = the blank hanging sign-plate mesh name, empty = the door Object3D name (both in the scene once the hill GLBs load).\n")
    f.write("// RENTABLE_SHOPS: every hill-street ground floor except the two weapon shops = an EMPTY shop to rent (geometry + data only; no rental gameplay yet).\n")
    f.write("// SQUAD_HALL: lot R0 (hill_big_shop.glb, [Timothy v317] 24 x 14.5 m, 3 storeys): rect = its town-local footprint, interact = the E · SQUAD HALL point inside.\n")
    f.write("// MAIN_ST_SHOPS: the MUSKET SHOP (R1+R2 = #34+#35, one building, origin R2) + SWORD SHOP (R3 = #36, by the coliseum MAIN_GATE) as built\n")
    f.write("// (js/island/battleAreas.js MAIN_ST_SHOPS stays the gameplay config). The old weapon lots L6 / R6 are rent_23 / rent_24.\n")
    f.write('export const RENTABLE_SHOPS = ' + json.dumps(rent) + ';\n')
    f.write('export const MAIN_ST_SHOPS = ' + json.dumps(weap) + ';\n')
    f.write('export const SQUAD_HALL = ' + json.dumps(squad) + ';\n')
print('DATA', len(rent), 'rentable', len(weap), 'weapon')
