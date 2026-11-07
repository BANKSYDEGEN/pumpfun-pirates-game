# [Timothy] PUMPFUN PIRATES: THE GOLDEN DOUBLOON CASINO (BANKSY via Emerly): a walk-in pirate casino on Main Street's east row between the
# SQUAD HALL (#33, lz -83 .. -59) and the UPGRADE SHOP (#5, plaza back row, lz -42 .. -30). Building #47.
#   /opt/blender/blender -b --factory-startup -P tools/casino_blender/build_casino.py -- GAME_DIR OUT_DIR
#   then: node tools/casino_blender/pack_casino.mjs OUT_DIR/casino_hall_raw.glb GAME_DIR/assets/island   (casino_hall.glb + casino_hall_low.glb)
# Same toolkit, look and material buckets as the plaza / hill street (tools/plaza_blender/lib.py: vertex colour toon, solid + glow, library layers).
# Building frame (the Squad Hall's): Blender x = along Main Street (+x = +lz, north), -y = out of the front (the street, -lx), z up,
# origin = the footprint centre at the floor walk height (CASINO_Y). Town-local: lz = CZ + x, lx = CX + y. three.js frame (GLB, colliders): x, z = -y.
# Footprint: town lx 14 .. 28.5 (front on the Main Street building line), lz -58.75 .. -42.05 (clear of the Squad Hall quoins and the Upgrade
# Shop's back wall). Keep CX / CZ / W / D / the stations in sync with js/island/casinoData.js (tests/casino.test.mjs checks the GLB extras).
# Signage is pirate gold only: no currency signs and no tickers anywhere (gold is GOLD / g).
import bpy, sys, os, math, json, random
import numpy as np
from mathutils import Matrix
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'plaza_blender'))
from lib import Builder, T, hexc, text_mesh
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
GAME, OUT = argv[0], argv[1]; os.makedirs(OUT, exist_ok=True)
FONT = next((f for f in (os.environ.get('CASINO_FONT', ''), '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf') if f and os.path.exists(f)), os.path.join(GAME, 'assets/JustAnotherHand.ttf'))
bpy.ops.wm.read_factory_settings(use_empty=True)

# ---------------- footprint + storeys ----------------
CX, CZ = 21.25, -50.4                 # town-local centre (lx, lz)
W, D = 16.7, 14.5                     # along the street (x) x deep (y)
X0, X1, Y0, Y1 = -W / 2, W / 2, -D / 2, D / 2
WT, WS, WB = 0.7, 0.55, 0.6           # front / side / back wall thickness
IX0, IX1, IY0, IY1 = X0 + WS, X1 - WS, Y0 + WT, Y1 - WB   # the hall inside the walls
ZB = -0.6                             # wall feet (buried: the street climbs to the south)
FLOOR = 0.025                         # plank top over the walk deck
CEIL, G1, Z2 = 5.4, 6.0, 9.6          # coffered ceiling underside, 1st string course, main cornice
MZ0, MZ1, MIN = 9.85, 12.6, 1.2       # mansard foot (on the cornice) / top / inset
ARCH_W, ARCH_SPRING, ARCH_RISE = 5.0, 3.0, 1.4   # clear opening 5.0 x 4.4 m
# the four stations (Blender frame x, y): table centre + the E point (players' side) - js/island/casinoData.js CASINO_TABLES
ST = dict(blackjack=dict(c=(-6.25, -1.4), e=(-4.0, -1.4)), roulette=dict(c=(5.6, -1.4), e=(4.0, -1.4)),
          dice=dict(c=(-5.7, 4.2), e=(-4.0, 4.2)), slots=dict(c=(7.3, 4.2), e=(5.6, 4.2)))
# [v378] BANKSY t1984u/t1985u: THE HIGH SEAS ROOM, a wing straight back (into the walled yard, lx 28.5 .. 54.75) through an arch in the hall's back wall.
BA_W, BA_SPRING, BA_RISE = 12.0, 3.6, 0.7     # [t2007u] BANKSY: "open up the wall in between 2 rooms": a 12 m wide shallow arch, hall + wing read as one room
WX, WYE, WSW = 8.0, 33.5, 0.55                 # wing half width (lz -58.4 .. -42.4), its back face (y), wall thickness
WIX0, WIX1, WIY0, WIY1 = -WX + WSW, WX - WSW, Y1, WYE - 0.6
WZ2, WCEIL = 6.6, 5.6                          # wing eaves / ceiling underside
# one game per table: (game, id suffix, table centre x, y, rotation (dealer to the wall), E point x)
WING = [('blackjack', 2, -5.4, 11.0, math.pi / 2, -3.15), ('roulette', 2, 5.2, 11.0, -math.pi / 2, 3.6),
        ('dice', 2, -5.2, 16.8, math.pi / 2, -3.5), ('blackjack', 3, 5.4, 16.8, -math.pi / 2, 3.15),
        ('roulette', 3, -5.2, 22.6, math.pi / 2, -3.6), ('dice', 3, 5.2, 22.6, -math.pi / 2, 3.5)]
WSLOTS = [(-6.95, 27.4, math.pi / 2), (6.95, 27.4, -math.pi / 2)]   # two banks of three: every machine is its own station
WCH = [9.0, 13.9, 19.7, 25.0]                  # aisle chandeliers (y); js/island/casino.js puts warm lights under them
BAR_DY = WIY1 - IY1                            # the rum bar moves to the wing's end wall

# ---------------- palette ----------------
LIME = [0xddd3bf, 0xd3c8b2, 0xe2d8c4, 0xcfc4ad]; QUO, MORT = 0xb3a893, 0x8f877a
SLATE = [0x4b5560, 0x56606b, 0x434c56]; LEAD = 0x6b7580
MAHOG, MAHOG_D, MAHOG_L, LEATH = 0x5a2418, 0x3e170f, 0x7a3322, 0x4a1a12
CRIM, BURG, GOLD, GOLD_D, BRASS = 0x8a1c1c, 0x6e1420, 0xffc93c, 0xc8961e, 0xd4a537
FELT, FELT_D = 0x1f6b3a, 0x165530
IRON, GLOW, FLAME, EMBER = 0x2b2f36, 0xffc46b, 0xffb347, 0xff7a1a
CREAM, TIMB = 0xf0e2c4, 0x4a2c18
FLOORS = [0x4a2c1a, 0x3f2516, 0x55331e]
BONE, SKIN, RED, BLACK, WHITE = 0xf2efe6, 0xd9a27a, 0xc0262d, 0x1c1c22, 0xf4f1e8
RUBY, EMER, SAPH = 0xd0103a, 0x1fa060, 0x2a5bd0
DAMASK = 0x7a1c22
Builder.AUTO = {**{c: 'stone_ashlar' for c in LIME}, QUO: 'stone_trim', MORT: 'stone_trim', **{c: 'roof_tile' for c in SLATE},
                **{c: 'timber' for c in (MAHOG, MAHOG_D, MAHOG_L, TIMB)}, IRON: 'iron', CREAM: 'plaster', DAMASK: 'plaster',
                **{c: 'planks_weathered' for c in FLOORS}}
CLOTH = 'awning_cloth'

# ---------------- helpers ----------------
def wall_rects(x0, x1, z0, z1, holes):
    zs = sorted({z0, z1, *[h[2] for h in holes if z0 < h[2] < z1], *[h[3] for h in holes if z0 < h[3] < z1]}); out = []
    for a, bb in zip(zs, zs[1:]):
        xs = [(h[0], h[1]) for h in holes if h[2] < bb - 1e-6 and h[3] > a + 1e-6]; cur = x0
        for hx0, hx1 in sorted(xs):
            if hx0 > cur + 1e-6: out.append((cur, hx0, a, bb))
            cur = max(cur, hx1)
        if x1 > cur + 1e-6: out.append((cur, x1, a, bb))
    return out

def ashlar(bd, rects, y, col, rng, rh=0.5):   # proud block faces on a wall face at y (faces -y)
    for (x0, x1, z0, z1) in rects:
        for k in range(int(math.floor(z0 / rh)), int(math.ceil(z1 / rh))):
            za, zb = max(z0, k * rh), min(z1, (k + 1) * rh)
            if zb - za < 0.08: continue
            r2 = random.Random(k * 7919 + int(y * 10)); x = -40 + (0.5 if k % 2 else 0)
            while x < x1:
                bw = r2.uniform(0.8, 1.25); xa, xb = max(x0, x), min(x1, x + bw)
                if xb - xa > 0.1: bd.box(xb - xa - 0.04, 0.07, zb - za - 0.04, (xa + xb) / 2, y - 0.035, (za + zb) / 2, hexc(col, 0.06, rng), mat='stone_trim')
                x += bw

FRONT = Matrix.Rotation(math.pi / 2, 4, 'X')   # text normal -> -y
def carve(bd, text, cx, cy, cz, wfit, hfit, lod, col=GOLD, rz=0.0):
    V, F, _ = text_mesh(text, FONT, size=1.0, extrude=0.03 if lod == 0 else 0.0, res=2 if lod == 0 else 1)
    if lod: V = V + [0, 0, 0.012]
    mn, mx = V.min(0), V.max(0); s = min(wfit / (mx[0] - mn[0]), hfit / (mx[1] - mn[1]))
    V = (V - [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]) * [s, s, 1]
    bd.mesh(V, F, col, m=Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(rz, 4, 'Z') @ FRONT, smooth=False)

def slab(bd, pts, z0, z1, col, mat=0):   # extrude a CCW (seen from above) polygon in the current frame between z0 and z1
    n = len(pts); V = [(p[0], p[1], z0) for p in pts] + [(p[0], p[1], z1) for p in pts]
    F = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    bd.mesh(V, F, col, mat=mat, smooth=False)

def dshape(R, n, cy=0.0):   # half disc bulging to -y, straight edge on y = cy (CCW)
    return [(R * math.cos(math.pi + math.pi * i / n), cy + R * math.sin(math.pi + math.pi * i / n)) for i in range(n + 1)]

def arch_fill(bd, xc, ow, spring, rise, y, thick, col, ns):   # wall over a round / elliptic opening head
    r = ow / 2
    for i in range(ns):
        xa, xb = xc - r + i * ow / ns, xc - r + (i + 1) * ow / ns; u = max(abs(xa - xc), abs(xb - xc)) / r
        ha = spring + rise * math.sqrt(max(0.0, 1 - u * u))
        if spring + rise - ha > 0.01: bd.box(xb - xa + 0.002, thick, spring + rise - ha, (xa + xb) / 2, y, ha, col, base=True)

def arch_ring(bd, xc, r, spring, rise, y, depth, th, col, nv, rng, key=True, keyc=None):   # voussoirs + a proud keystone
    for i in range(nv):
        t = math.pi * (1 - (i + 0.5) / nv); rr = r + th / 2; k = key and i == nv // 2
        bd.box(math.pi * rr / nv * 0.94, depth + (0.12 if k else 0), th * (1.45 if k else 1.0), xc + rr * math.cos(t), y - (0.06 if k else 0),
               spring + rise / r * rr * math.sin(t) + (th * 0.2 if k else 0), hexc(keyc if (k and keyc) else col, 0.05, rng), ry=math.pi / 2 - t)

def lead_glass(bd, x, sill, spring, r, y, lod, lit=True):   # amber leaded glass (glow) + iron cames, round head, in a wall hole
    bd.box(2 * r, 0.06, spring - sill, x, y, sill, GLOW if lit else 0x22313d, mat=1 if lit else 0, base=True)
    bd.cyl(r, r, 0.06, x, y + 0.03, spring, GLOW if lit else 0x22313d, n=14 if lod == 0 else 8, rx=math.pi / 2, mat=1 if lit else 0)
    if lod == 0:
        for k in (-0.5, 0.0, 0.5): bd.box(0.035, 0.03, spring + r * (0.97 if k == 0 else 0.84) - sill, x + k * r, y - 0.045, sill, IRON, base=True)
        zz = sill + 0.42
        while zz < spring + 0.3: bd.box(2 * r, 0.03, 0.035, x, y - 0.045, zz, IRON); zz += 0.45

def grille(bd, x, sill, spring, r, y, lod):   # wrought-iron window grille in front of the glass: bars, bands, a scroll head
    n = 7 if lod == 0 else 3
    for i in range(n):
        xx = x - r + (i + 0.5) * 2 * r / n; u = (xx - x) / r; top = spring + r * math.sqrt(max(0.0, 1 - u * u)) - 0.05
        bd.box(0.035, 0.035, top - sill, xx, y, sill, IRON, base=True)
    for zz in (sill + 0.25, (sill + spring) / 2, spring - 0.05): bd.box(2 * r, 0.04, 0.05, x, y, zz, IRON)
    if lod == 0:
        bd.torus(r * 0.98, 0.022, x, y, spring, IRON, n=16, m_=3, rx=math.pi / 2)
        for s in (-1, 1): bd.torus(0.12, 0.018, x + s * 0.18, y - 0.01, sill + 0.12, IRON, n=8, m_=3, rx=math.pi / 2)
        bd.sphere(0.05, x, y - 0.02, spring + r * 0.55, GOLD, sub=0)

def wall_lantern(bd, x, y, z, lod, out=-1):   # sculpted wrought-iron bracket + caged lantern (glow glass inside an iron frame, no bare orb)
    ly = y + out * 0.6
    bd.box(0.06, 0.62, 0.06, x, y + out * 0.31, z + 0.62, IRON); bd.box(0.24, 0.24, 0.36, x, ly, z - 0.18, GLOW, mat=1, base=True)
    bd.box(0.3, 0.3, 0.06, x, ly, z - 0.24, IRON); bd.box(0.34, 0.34, 0.07, x, ly, z + 0.2, IRON)
    if lod == 0:
        bd.box(0.05, 0.05, 0.7, x, y + out * 0.1, z + 0.3, IRON, rx=-out * 0.75); bd.torus(0.12, 0.02, x, y + out * 0.25, z + 0.85, IRON, n=10, m_=3, ry=math.pi / 2)
        bd.box(0.2, 0.04, 0.3, x, y + out * 0.02, z + 0.5, IRON)
        for sx in (-1, 1):
            for sy in (-1, 1): bd.box(0.035, 0.035, 0.42, x + sx * 0.135, ly + sy * 0.135, z - 0.22, IRON, base=True)
        bd.cyl(0.21, 0.0, 0.26, x, ly, z + 0.23, IRON, n=4, rz=math.pi / 4); bd.box(0.02, 0.02, 0.4, x, ly, z + 0.45, IRON, base=True)
        bd.cyl(0.07, 0.0, 0.14, x, ly, z - 0.38, IRON, n=4, rz=math.pi / 4)
        bd.sphere(0.035, x, ly, z + 0.5, GOLD, sub=0)

def sconce(bd, x, y, z, lod, out=-1):   # interior brass candle sconce on a wall plane facing `out` in y
    bd.box(0.24, 0.04, 0.46, x, y + out * 0.02, z, BRASS)
    bd.box(0.18, 0.18, 0.26, x, y + out * 0.32, z - 0.08, GLOW, mat=1, base=True)
    if lod == 0:
        bd.box(0.04, 0.3, 0.04, x, y + out * 0.17, z - 0.1, BRASS); bd.box(0.24, 0.24, 0.04, x, y + out * 0.32, z - 0.1, BRASS); bd.box(0.24, 0.24, 0.04, x, y + out * 0.32, z + 0.19, BRASS)
        bd.cyl(0.16, 0.0, 0.14, x, y + out * 0.32, z + 0.21, BRASS, n=4, rz=math.pi / 4)

def chandelier(bd, x, y, z, R, nc, zc, lod):   # gilded two-tier ring chandelier: candles (glow flames), crystal drops, chains up to zc
    n = 18 if lod == 0 else 8
    bd.torus(R, 0.06, x, y, z, GOLD_D, n=n, m_=4); bd.cyl(0.03, 0.03, zc - z, x, y, z, IRON, n=4)
    bd.cyl(0.1, 0.16, 0.45, x, y, z - 0.35, GOLD, n=8); bd.cyl(0.16, 0.02, 0.2, x, y, z - 0.55, GOLD, n=8)
    for k in range(6 if lod == 0 else 3):
        ang = k * math.pi / (3 if lod == 0 else 1.5); bd.box(R, 0.035, 0.035, x + R / 2 * math.cos(ang), y + R / 2 * math.sin(ang), z, GOLD_D, rz=ang)
    for k in range(nc):
        ang = k * 2 * math.pi / nc; cx, cy = x + R * math.cos(ang), y + R * math.sin(ang)
        if lod == 0: bd.cyl(0.07, 0.055, 0.05, cx, cy, z + 0.03, GOLD, n=6); bd.cyl(0.03, 0.03, 0.18, cx, cy, z + 0.08, BONE, n=6); bd.box(0.024, 0.024, 0.16, cx, cy, z - 0.22, 0xe8f4ff)
        bd.box(0.06, 0.06, 0.12, cx, cy, z + 0.26 if lod == 0 else z + 0.12, FLAME, mat=1, base=True)
    if lod == 0:
        R2 = R * 0.55; bd.torus(R2, 0.045, x, y, z + 0.45, GOLD_D, n=12, m_=4)
        for k in range(6): ang = k * math.pi / 3 + 0.5; cx, cy = x + R2 * math.cos(ang), y + R2 * math.sin(ang); bd.cyl(0.025, 0.025, 0.15, cx, cy, z + 0.5, BONE, n=5); bd.box(0.05, 0.05, 0.1, cx, cy, z + 0.65, FLAME, mat=1, base=True)
        for k in range(4): t = k * math.pi / 2 + math.pi / 4; L = math.hypot(R, 0.9); bd.push(T(x, y, z, rz=t)); bd.box(0.02, 0.02, L, R / 2, 0, 0.45, IRON, ry=-math.atan2(R, 0.9)); bd.pop()

def barrel_(bd, x, y, z, lod, r=0.4, h=1.0, col=MAHOG_L, rx=0.0, rz=0.0):
    n = 12 if lod == 0 else 7; bd.push(T(x, y, z, rx=rx, rz=rz))
    bd.cyl(r * 0.85, r, h / 2, 0, 0, 0, col, n=n); bd.cyl(r, r * 0.85, h / 2, 0, 0, h / 2, col, n=n)
    for zz in ((0.12, 0.88) if lod else (0.1, 0.32, 0.68, 0.9)): bd.torus(r * (0.9 + 0.1 * (1 - abs(zz - 0.5) * 2)) + 0.012, 0.022, 0, 0, h * zz, IRON, n=n, m_=3)
    bd.pop()

def coins(bd, x, y, z, R, h, lod, rng):   # a heap of doubloons: a gold mound + loose coins
    bd.sphere(R, x, y, z, GOLD, sub=1 if lod == 0 else 0, s=(1, 1, h / R))
    if lod == 0:
        for i in range(9):
            a = rng.uniform(0, 6.283); rr = rng.uniform(0.2, 1.0) * R; bd.cyl(0.05, 0.05, 0.012, x + rr * math.cos(a), y + rr * math.sin(a), z + h * (1 - (rr / R) ** 2) * 0.95, GOLD_D, n=8, rx=rng.uniform(-0.5, 0.5))

def gem(bd, x, y, z, col, s=0.06): bd.sphere(s, x, y, z, col, sub=0, s=(1, 1, 1.3))

def chest(bd, x, y, z, rz, lod, rng, open_=False, s=1.0):   # iron-bound treasure chest, long axis local x (open: lid back, doubloons + gems)
    bd.push(T(x, y, z, rz=rz, s=s))
    bd.box(1.0, 0.62, 0.5, 0, 0, 0, 0x7a4a26, base=True)
    for xx in (-0.38, 0.0, 0.38): bd.box(0.07, 0.66, 0.52, xx, 0, 0, IRON, base=True)
    bd.box(0.16, 0.06, 0.2, 0, -0.33, 0.28, GOLD, base=True)
    if open_:
        bd.push(T(0, 0.31, 0.5, rx=-1.15)); bd.cyl(0.31, 0.31, 1.0, -0.5, -0.0, 0.0, 0x6a3e20, n=10 if lod == 0 else 6, ry=math.pi / 2); bd.pop()
        coins(bd, 0, 0, 0.5, 0.45, 0.22, lod, rng)
        if lod == 0:
            for (gx, gy_, c) in ((-0.2, -0.1, RUBY), (0.15, 0.08, EMER), (0.3, -0.12, SAPH), (-0.05, 0.12, RUBY)): gem(bd, gx, gy_, 0.66, c)
            bd.torus(0.12, 0.02, 0.32, 0.1, 0.62, 0xf4f1e8, n=10, m_=3, rx=0.5)   # pearl string
    else:
        bd.cyl(0.31, 0.31, 1.0, -0.5, 0, 0.5, 0x6a3e20, n=10 if lod == 0 else 6, ry=math.pi / 2)
        for xx in (-0.38, 0.0, 0.38): bd.cyl(0.33, 0.33, 0.07, xx - 0.035, 0, 0.5, IRON, n=10 if lod == 0 else 6, ry=math.pi / 2)
    bd.pop()

def crown(bd, x, y, z, s, lod, col=GOLD):   # a gilded crown: band, five points with gems, a cap ball
    bd.cyl(0.5 * s, 0.55 * s, 0.32 * s, x, y, z, col, n=12 if lod == 0 else 8)
    for k in range(5):
        a = k * 2 * math.pi / 5; px, py = x + 0.5 * s * math.cos(a), y + 0.5 * s * math.sin(a)
        bd.cyl(0.11 * s, 0.0, 0.42 * s, px, py, z + 0.3 * s, col, n=4)
        if lod == 0: bd.sphere(0.06 * s, px, py, z + 0.74 * s, col, sub=0); gem(bd, x + 0.53 * s * math.cos(a + 0.63), y + 0.53 * s * math.sin(a + 0.63), z + 0.16 * s, (RUBY, EMER, SAPH)[k % 3], 0.05 * s)
    bd.sphere(0.16 * s, x, y, z + 0.42 * s, CRIM, sub=1 if lod == 0 else 0); bd.sphere(0.08 * s, x, y, z + 0.62 * s, col, sub=0)

def anchor(bd, x, y, z, s, lod, col=BRASS, ry=0.0):   # a ship's anchor on a plane facing -y (rotated ry in that plane)
    bd.push(T(x, y, z, ry=ry, s=s))
    bd.box(0.1, 0.06, 1.3, 0, 0, -0.55, col, base=True)                                # shank
    bd.box(0.62, 0.07, 0.1, 0, -0.005, 0.5, col)                                       # stock
    bd.torus(0.12, 0.03, 0, 0, 0.82, col, n=10 if lod == 0 else 6, m_=3, rx=math.pi / 2)   # ring
    for sg in (-1, 1):
        bd.box(0.08, 0.06, 0.55, sg * 0.25, 0, -0.42, col, ry=-sg * 0.9)              # arms
        bd.prism([(-0.09, 0), (0.09, 0), (0, 0.22)], 0.06, col, T(sg * 0.47, -0.03, -0.3, ry=-sg * 2.4))   # flukes
    bd.sphere(0.07, 0, 0, -0.6, col, sub=0)
    bd.pop()

def doubloon(bd, x, y, z, R, lod, rng, relief='crown'):   # a big gilded doubloon medallion on a plane facing -y
    n = 24 if lod == 0 else 12
    bd.cyl(R, R, 0.1, x, y + 0.02, z, GOLD_D, n=n, rx=math.pi / 2)
    bd.cyl(R * 0.86, R * 0.86, 0.04, x, y - 0.06, z, GOLD, n=n, rx=math.pi / 2)
    bd.torus(R * 0.95, 0.045 * R, x, y - 0.07, z, GOLD, n=n, m_=4, rx=math.pi / 2)
    if lod == 0:
        bd.torus(R * 0.72, 0.022 * R, x, y - 0.1, z, GOLD_D, n=n, m_=3, rx=math.pi / 2)
        for k in range(16): t = k * math.pi / 8; bd.box(0.035 * R, 0.03, 0.09 * R, x + 0.84 * R * math.sin(t), y - 0.09, z + 0.84 * R * math.cos(t), GOLD_D, ry=t)   # milled rim
    if relief == 'crown':   # crown relief: band + 5 points on the coin face
        bd.box(0.7 * R, 0.06, 0.14 * R, x, y - 0.1, z - 0.18 * R, GOLD_D)
        for k in range(5):
            px = x + (-0.3 + k * 0.15) * R; h = (0.32 if k in (0, 4) else 0.42 if k != 2 else 0.5) * R
            bd.prism([(-0.065 * R, 0), (0.065 * R, 0), (0, h)], 0.06, GOLD_D, T(px, y - 0.13, z - 0.11 * R))
        if lod == 0: gem(bd, x, y - 0.13, z - 0.18 * R, RUBY, 0.06 * R)
    else: anchor(bd, x, y - 0.11, z + 0.05 * R, 0.5 * R, lod, col=GOLD_D)

def drape(bd, x, y, ztop, h, w, lod, col=BURG, side=1):   # a velvet curtain hanging from ztop, tied back with a gold cord (folds = boxes)
    nf = 5 if lod == 0 else 2
    for i in range(nf):
        xx = x + (i - (nf - 1) / 2) * w / nf; tie = ztop - h * 0.62; k = (i - (nf - 1) / 2) / max(1, nf - 1)
        bd.box(w / nf * 0.8, 0.06 + 0.03 * (i % 2), tie - (ztop - h), xx + side * (0.5 - k) * w * 0.12, y - 0.02 * (i % 2), ztop - h, col, base=True, mat=CLOTH)   # gathered below the tie
        bd.box(w / nf * 1.08, 0.06 + 0.03 * (i % 2), ztop - tie, xx, y - 0.02 * (i % 2), tie, col, base=True, mat=CLOTH)
    bd.box(w * 0.9, 0.1, 0.07, x, y - 0.06, ztop - h * 0.62 + 0.04, GOLD)
    if lod == 0: bd.sphere(0.06, x + side * w * 0.45, y - 0.1, ztop - h * 0.62 - 0.06, GOLD, sub=0); bd.cyl(0.03, 0.06, 0.22, x + side * w * 0.45, y - 0.1, ztop - h * 0.62 - 0.32, GOLD, n=6)

def valance(bd, x0, x1, y, ztop, lod):   # scalloped burgundy + gold awning valance (faces -y)
    n = max(2, int((x1 - x0) / 0.75)); sw = (x1 - x0) / n
    bd.box(x1 - x0, 0.05, 0.22, (x0 + x1) / 2, y, ztop - 0.22, BURG, base=True, mat=CLOTH)
    for i in range(n):
        xa = x0 + i * sw; c = BURG if i % 2 == 0 else GOLD_D
        pts = ([(xa, ztop - 0.22), (xa + sw, ztop - 0.22)] + [(xa + sw * (1 - j / 6), ztop - 0.22 - 0.2 * math.sin(math.pi * (1 - j / 6))) for j in range(1, 6)])[::-1]   # CCW seen from the front
        bd.prism(pts, 0.05, c, T(0, y - 0.025, 0), mat=CLOTH if c == BURG else 0)
        if lod == 0: bd.sphere(0.035, xa + sw / 2, y - 0.03, ztop - 0.45, GOLD, sub=0)
    bd.box(x1 - x0 + 0.04, 0.07, 0.05, (x0 + x1) / 2, y - 0.03, ztop - 0.04, GOLD)

DEALERS = []    # [t2007u] BANKSY: the dealers are V7 PUMPFUN PIRATES: markers only (building frame x, y, z, facing), js/island/casino.js stands a V7 there
def figure(bd, x, y, rz, lod, vest=CRIM, hat=True, sash=GOLD):   # a pirate dealer standing at a table, faces local -y
    bd.push(T(x, y, 0, rz=rz)); n = 10 if lod == 0 else 6
    if lod == 0:
        M_ = bd.stack[-1]; p_ = M_.to_translation(); f_ = M_.to_3x3() @ Vector((0.0, -1.0, 0.0))
        DEALERS.append([round(p_.x, 3), round(p_.y, 3), round(p_.z, 3), round(math.atan2(f_.x, f_.y), 4), 0 if hat else 1])
    bd.pop(); return
    for sx in (-0.11, 0.11): bd.cyl(0.08, 0.085, 0.82, sx, 0, 0, 0x2a2a33, n=n); bd.box(0.14, 0.24, 0.12, sx, -0.04, 0, BLACK, base=True)
    bd.cyl(0.22, 0.19, 0.62, 0, 0, 0.8, WHITE, n=n); bd.cyl(0.235, 0.205, 0.5, 0, 0.0, 0.84, vest, n=n)   # shirt + vest
    bd.cyl(0.24, 0.24, 0.09, 0, 0, 0.86, sash, n=n)
    for sx in (-1, 1): bd.cyl(0.06, 0.055, 0.56, sx * 0.27, -0.05, 0.86, WHITE, n=6, rx=0.35); bd.sphere(0.06, sx * 0.27, -0.24, 0.86, SKIN, sub=0)
    bd.cyl(0.06, 0.06, 0.1, 0, 0, 1.42, SKIN, n=6); bd.sphere(0.15, 0, 0, 1.6, SKIN, sub=1 if lod == 0 else 0, s=(1, 1, 1.12))
    if lod == 0:
        bd.box(0.1, 0.02, 0.07, -0.06, -0.14, 1.63, BLACK); bd.box(0.32, 0.01, 0.015, 0, -0.13, 1.66, BLACK, ry=0.4)   # eye patch + strap
        bd.sphere(0.1, 0, -0.05, 1.47, 0x3a2414, sub=0, s=(1.2, 0.8, 0.7))                                           # beard
        bd.sphere(0.03, 0.15, 0, 1.58, GOLD, sub=0)                                                                    # earring
    if hat:
        bd.cyl(0.3, 0.3, 0.05, 0, 0, 1.72, BLACK, n=3, rz=math.pi / 2)   # tricorn; bd.cyl(0.15, 0.12, 0.16, 0, 0, 1.74, BLACK, n=8)
        if lod == 0: bd.torus(0.26, 0.015, 0, 0, 1.75, GOLD, n=3, m_=3, rz=math.pi / 2)
    bd.pop()

def plaque(bd, text, x, y, z, w, h, lod, rz=0.0, col=MAHOG_D):   # gilt-framed carved board on a wall plane (local -y = into the room)
    bd.push(T(x, y, z, rz=rz))
    bd.box(w, 0.08, h, 0, -0.04, 0, col)
    for zz in (-h / 2, h / 2): bd.box(w + 0.12, 0.12, 0.08, 0, -0.06, zz, GOLD)
    for xx in (-w / 2, w / 2): bd.box(0.08, 0.12, h + 0.08, xx, -0.06, 0, GOLD)
    bd.pop()
    rz_ = rz; c, s = math.cos(rz_), math.sin(rz_)
    carve(bd, text, x + 0.11 * s, y - 0.11 * c, z, w - 0.35, h - 0.22, lod, col=GOLD, rz=rz_)

def chip_stack(bd, x, y, z, n, col, lod):
    bd.cyl(0.045, 0.045, 0.016 * n, x, y, z, col, n=10 if lod == 0 else 6)
    if lod == 0 and n > 2: bd.cyl(0.046, 0.046, 0.006, x, y, z + 0.008 * n, WHITE, n=10)

# ---------------- the exterior ----------------
def exterior(bd, lod, rng):
    hi = lod == 0; FY = Y0
    # ---- front, ground storey: rusticated limestone, the 5 m arch, two arched windows ----
    WX = 5.6; WR, WSILL, WSPR = 0.75, 1.0, 3.3
    holes = [(-ARCH_W / 2, ARCH_W / 2, ZB, ARCH_SPRING + ARCH_RISE)] + [(s * WX - WR, s * WX + WR, WSILL, WSPR + WR) for s in (-1, 1)]
    r1 = wall_rects(X0, X1, ZB, G1, holes)
    for r in r1: bd.box(r[1] - r[0], WT, r[3] - r[2], (r[0] + r[1]) / 2, FY + WT / 2, (r[2] + r[3]) / 2, MORT if hi else LIME[0])
    if hi: ashlar(bd, r1, FY, LIME[0], rng)
    arch_fill(bd, 0, ARCH_W, ARCH_SPRING, ARCH_RISE, FY + WT / 2, WT, LIME[1], 14 if hi else 5)
    arch_ring(bd, 0, ARCH_W / 2, ARCH_SPRING, ARCH_RISE, FY - 0.06, 0.34, 0.42, QUO, 13 if hi else 7, rng, keyc=GOLD_D)
    for s in (-1, 1):   # rusticated jambs + the arch's gilded imposts
        zq = 0.0
        while zq < ARCH_SPRING - 0.05:
            hh = min(0.5, ARCH_SPRING - zq); bd.box(0.62 if int(zq / 0.5) % 2 else 0.45, 0.44, hh - 0.04, s * (ARCH_W / 2 + 0.26), FY - 0.06, zq + hh / 2, hexc(QUO, 0.05, rng)); zq += 0.5
        bd.box(0.8, 0.5, 0.16, s * (ARCH_W / 2 + 0.3), FY - 0.08, ARCH_SPRING - 0.02, GOLD_D, base=True)
    bd.box(ARCH_W + 0.2, WT + 0.5, 0.06, 0, FY + WT / 2 - 0.2, -0.03, QUO, base=True)                         # threshold
    for s in (-1, 1):   # the windows: glass in the hole, voussoirs, sill, iron grille
        x = s * WX
        arch_fill(bd, x, 2 * WR, WSPR, WR, FY + WT / 2, WT, LIME[1], 8 if hi else 3)
        lead_glass(bd, x, WSILL, WSPR, WR, FY + 0.32, lod)
        arch_ring(bd, x, WR, WSPR, WR, FY - 0.05, 0.26, 0.28, QUO, 9 if hi else 5, rng, keyc=GOLD_D)
        bd.box(2 * WR + 0.6, 0.38, 0.14, x, FY - 0.12, WSILL - 0.14, QUO, base=True)
        grille(bd, x, WSILL, WSPR, WR - 0.04, FY + 0.12, lod)
        if hi:
            for k in (-1, 1): bd.box(0.18, 0.3, 0.25, x + k * 0.55, FY - 0.15, WSILL - 0.38, QUO, base=True)   # sill brackets
    # pilasters (flanking the arch + at the corners) with bases + gilded capitals, corner quoins all the way up
    for px in (-3.35, 3.35, -7.95, 7.95):
        bd.box(0.72, 0.3, G1 - 0.1, px, FY - 0.15, 0.0, hexc(LIME[2], 0.02, rng), base=True)
        bd.box(0.92, 0.42, 0.42, px, FY - 0.2, -0.1, QUO, base=True); bd.box(0.9, 0.4, 0.26, px, FY - 0.2, G1 - 0.6, QUO, base=True)
        if hi:
            bd.box(0.82, 0.06, 0.1, px, FY - 0.42, G1 - 0.42, GOLD)
            for k in (-1, 0, 1): bd.box(0.08, 0.04, G1 - 1.2, px + k * 0.2, FY - 0.31, 0.4, hexc(LIME[3], 0.02, rng), base=True)   # flutes
    if hi:
        for xx in (X0, X1):
            zq = -0.2
            while zq < Z2 - 0.2: bd.box(0.62 if int(zq / 0.55) % 2 else 0.42, 0.62, 0.5, xx + (0.25 if xx < 0 else -0.25), FY - 0.06 + 0.25, zq + 0.25, hexc(QUO, 0.05, rng)); zq += 0.55
    for px in (-3.35, 3.35): wall_lantern(bd, px, FY - 0.3, 3.55, lod)                                      # lanterns on the arch pilasters
    for px in (-7.95, 7.95): wall_lantern(bd, px, FY - 0.3, 3.2, lod)
    # the gilded mahogany signboard: THE GOLDEN DOUBLOON, gold frame, bosses
    sgw, sgh, sz0 = 8.4, 1.15, 4.62; sy = FY - 0.36
    bd.box(sgw, 0.14, sgh, 0, sy, sz0, MAHOG, base=True)
    for zz in (sz0 - 0.07, sz0 + sgh - 0.05): bd.box(sgw + 0.3, 0.24, 0.13, 0, sy - 0.04, zz, GOLD_D, base=True)
    for xx in (-sgw / 2 - 0.08, sgw / 2 + 0.08): bd.box(0.2, 0.24, sgh + 0.18, xx, sy - 0.04, sz0 - 0.07, GOLD_D, base=True)
    if hi:
        for zz in (sz0 + 0.1, sz0 + sgh - 0.13): bd.box(sgw - 0.3, 0.03, 0.03, 0, sy - 0.085, zz, GOLD)
        for xx in (-sgw / 2 + 0.2, sgw / 2 - 0.2):
            for zz in (sz0 + 0.22, sz0 + sgh - 0.22): bd.sphere(0.07, xx, sy - 0.1, zz, GOLD, sub=0)
        for s in (-1, 1): bd.prism([(0, 0), (0.6, -0.2), (0.6, 0.2)], 0.08, GOLD_D, T(s * (sgw / 2 + 0.17), sy - 0.02, sz0 + sgh / 2, rz=0 if s > 0 else math.pi))   # pointed scroll ends
    carve(bd, 'THE GOLDEN DOUBLOON', 0, sy - 0.08, sz0 + sgh / 2, sgw - 0.8, sgh - 0.42, lod, col=GOLD)
    # doubloon medallions over the windows, crossed brass anchors behind each
    for s in (-1, 1):
        x = s * WX; z = 5.18
        anchor(bd, x, FY - 0.05, z, 0.95, lod, ry=0.62); anchor(bd, x, FY - 0.05, z, 0.95, lod, ry=-0.62)
        doubloon(bd, x, FY - 0.14, z, 0.5, lod, rng, relief='crown')
    for s in (-1, 1): drape(bd, s * (ARCH_W / 2 + 0.55), FY - 0.42, 4.45, 3.9, 0.6, lod, side=-s)          # velvet drapes either side of the arch
    for s in (-1, 1): valance(bd, min(s * 2.75, s * 4.35), max(s * 2.75, s * 4.35), FY - 0.44, 4.55, lod)
    # string course + the 2nd-floor balcony (burgundy + gold valance under it)
    bd.box(W + 0.4, 0.55, 0.32, 0, FY - 0.08, G1 - 0.06, QUO, base=True)
    BX0, BX1, BD_ = -7.1, 7.1, 1.05; bz = G1 + 0.26
    bd.box(BX1 - BX0, BD_, 0.2, 0, FY - BD_ / 2, bz - 0.2, MAHOG_D, base=True)
    for px in np.linspace(BX0 + 0.4, BX1 - 0.4, 7 if hi else 3):   # stone corbels
        bd.box(0.3, BD_ * 0.9, 0.26, px, FY - BD_ * 0.45, bz - 0.46, QUO, base=True); bd.box(0.28, BD_ * 0.5, 0.3, px, FY - BD_ * 0.25, bz - 0.76, QUO, base=True)
    rail_y = FY - BD_ + 0.05
    bd.box(BX1 - BX0 + 0.1, 0.12, 0.08, 0, rail_y, bz + 1.0, BRASS); bd.box(BX1 - BX0, 0.07, 0.06, 0, rail_y, bz + 0.1, IRON)
    for xx in (BX0, BX1): bd.box(0.08, BD_, 0.08, xx, FY - BD_ / 2, bz + 1.0, BRASS); bd.box(0.1, 0.1, 1.04, xx, rail_y, bz, IRON, base=True)
    nb = int((BX1 - BX0) / (0.16 if hi else 0.6))
    for i in range(1, nb): bd.box(0.03, 0.03, 0.9, BX0 + i * (BX1 - BX0) / nb, rail_y, bz + 0.1, IRON, base=True)
    if hi:
        for i in range(int((BX1 - BX0) / 1.2)):
            cx_ = BX0 + 0.6 + i * 1.2; bd.torus(0.22, 0.02, cx_, rail_y - 0.01, bz + 0.52, IRON, n=10, m_=3, rx=math.pi / 2); bd.sphere(0.04, cx_, rail_y - 0.03, bz + 0.52, GOLD, sub=0)
        for xx in (-5.6, -2.9, 2.9, 5.6):   # potted palms + red blooms on the balcony
            bd.cyl(0.18, 0.22, 0.3, xx, FY - 0.4, bz, 0xb8562e, n=8)
            for k in range(3): bd.sphere(0.17, xx + 0.1 * math.cos(k * 2.1), FY - 0.4 + 0.1 * math.sin(k * 2.1), bz + 0.42 + 0.06 * k, (0x3f8f3a, 0x2f7a32, 0xd8322f)[k], sub=1)
    valance(bd, BX0, BX1, FY - BD_ - 0.03, bz - 0.02, lod)
    # ---- 2nd storey: cream plaster + mahogany half-timber gallery, French door onto the balcony, lit windows with velvet curtains ----
    UW = [(-5.6, 1.2), (-2.9, 1.2), (2.9, 1.2), (5.6, 1.2)]; uz0, uz1 = bz + 0.55, Z2 - 1.15
    h2 = [(x - w / 2, x + w / 2, uz0, uz1) for (x, w) in UW] + [(-0.8, 0.8, bz, uz1 + 0.1)]
    r2 = wall_rects(X0, X1, G1, Z2, h2)
    for r in r2: bd.box(r[1] - r[0], 0.45, r[3] - r[2], (r[0] + r[1]) / 2, FY + 0.225, (r[2] + r[3]) / 2, hexc(CREAM, 0.02, rng))
    for (x, w) in UW + [(0.0, 1.6)]:
        z0_ = uz0 if x else bz; z1_ = uz1 if x else uz1 + 0.1
        bd.box(w, 0.06, z1_ - z0_, x, FY + 0.3, z0_, GLOW, mat=1, base=True)
        for s in (-1, 1): bd.box(w * 0.28, 0.08, z1_ - z0_ - 0.1, x + s * w * 0.36, FY + 0.22, z0_ + 0.05, BURG, base=True, mat=CLOTH)   # curtains (inside)
        bd.box(w + 0.16, 0.18, 0.14, x, FY - 0.03, z1_, TIMB, base=True); bd.box(w + 0.3, 0.3, 0.1, x, FY - 0.08, z0_ - 0.1, TIMB, base=True)
        if hi:
            bd.box(0.05, 0.05, z1_ - z0_, x, FY + 0.24, z0_, TIMB, base=True)
            for k in range(1, 4): bd.box(w, 0.04, 0.04, x, FY + 0.24, z0_ + k * (z1_ - z0_) / 4, TIMB)
    posts = [X0 + 0.15, -4.25, -1.55, 1.55, 4.25, X1 - 0.15]
    for px in posts: bd.box(0.22, 0.16, Z2 - G1 - 0.2, px, FY - 0.05, G1 + 0.2, TIMB, base=True)
    for zz in (bz + 0.12, uz1 + 0.18, Z2 - 0.18): bd.box(W - 0.1, 0.17, 0.2, 0, FY - 0.05, zz, TIMB)
    if hi:
        for (pa, pb) in zip(posts, posts[1:]):
            if pa < 0 < pb: continue
            m = (pa + pb) / 2; L = math.hypot((pb - pa) / 2, 0.45)
            for k in (-1, 1): bd.box(L, 0.13, 0.13, m + k * (pb - pa) / 4, FY - 0.05, bz + 0.38, TIMB, ry=k * math.atan2(0.45, (pb - pa) / 2))
    # the CASINO plaque over the French door + a little gilded crown on it
    bd.box(3.0, 0.14, 0.62, 0, FY - 0.14, uz1 + 0.32, BURG, base=True, mat=CLOTH)
    for zz in (uz1 + 0.28, uz1 + 0.96): bd.box(3.2, 0.2, 0.08, 0, FY - 0.17, zz, GOLD_D, base=True)
    for xx in (-1.58, 1.58): bd.box(0.1, 0.2, 0.74, xx, FY - 0.17, uz1 + 0.28, GOLD_D, base=True)
    carve(bd, 'CASINO', 0, FY - 0.22, uz1 + 0.63, 2.5, 0.48, lod, col=GOLD)
    # gilded frieze + cornice with dentils
    bd.box(W + 0.2, 0.12, 0.16, 0, FY - 0.08, Z2 - 0.05, GOLD_D)
    bd.box(W + 0.7, 0.95, 0.4, 0, FY + 0.15, Z2 - 0.1, QUO, base=True)
    bd.box(W, D, 0.4, 0, 0, Z2 - 0.1, MORT, base=True)   # attic floor: nothing to see through under the mansard
    if hi:
        for i in range(int((W + 0.4) / 0.42)): bd.box(0.18, 0.2, 0.2, X0 - 0.15 + 0.2 + i * 0.42, FY - 0.24, Z2 - 0.14, QUO)
    # ---- the side + back walls (stone, string courses, upper windows where they show over the neighbours) ----
    for (xe, rz_) in ((X1, math.pi / 2), (X0, -math.pi / 2)):
        bd.push(T(xe, 0, 0, rz=rz_))   # local x along the wall, -y outward, face at y = 0
        dd = D
        bd.box(dd, WS, Z2 - ZB, 0, WS / 2, ZB, MORT if hi else LIME[0], base=True)
        bd.box(dd + 0.4, 0.4, 0.3, 0, -0.08, G1 - 0.06, QUO, base=True); bd.box(dd + 0.6, 0.85, 0.4, 0, 0.05, Z2 - 0.1, QUO, base=True)
        if hi: ashlar(bd, [(-dd / 2, dd / 2, 6.3, Z2 - 0.1)], 0.0, LIME[3], rng)
        if xe > 0:
            for yy in (-4.2, 0.0, 4.2): bd.box(1.1, 0.08, 1.7, yy, -0.04, 7.0, GLOW, mat=1, base=True); bd.box(1.4, 0.3, 0.12, yy, -0.1, 6.92, QUO, base=True); bd.box(1.3, 0.24, 0.14, yy, -0.08, 8.7, QUO, base=True)
        bd.pop()
    bd.push(T(0, Y1, 0, rz=math.pi))   # [v378] the back wall now opens into the wing (centred arch); its upper storey shows over the wing roof
    for (xa, xb, za, zb) in wall_rects(-W / 2, W / 2, ZB, Z2, [(-BA_W / 2, BA_W / 2, ZB - 0.1, BA_SPRING + BA_RISE)]): bd.box(xb - xa, WB, zb - za, (xa + xb) / 2, WB / 2, za, MORT if hi else LIME[0], base=True)
    arch_fill(bd, 0, BA_W, BA_SPRING, BA_RISE, WB / 2, WB, MORT if hi else LIME[0], 10 if hi else 4)
    bd.box(W + 0.4, 0.4, 0.3, 0, -0.08, G1 - 0.06, QUO, base=True); bd.box(W + 0.6, 0.85, 0.4, 0, 0.05, Z2 - 0.1, QUO, base=True)
    if hi: ashlar(bd, [(-W / 2, W / 2, WZ2 + 2.4, Z2 - 0.1)], 0.0, LIME[3], rng)
    for xx in (-5.6, 5.6): bd.box(1.1, 0.08, 1.2, xx, -0.04, 8.0, GLOW, mat=1, base=True); bd.box(1.4, 0.3, 0.12, xx, -0.1, 7.92, QUO, base=True)
    bd.pop()
    wing_ext(bd, lod, rng)
    roof(bd, lod, rng)

def roof(bd, lod, rng):
    hi = lod == 0
    ox0, ox1, oy0, oy1 = X0 - 0.3, X1 + 0.3, Y0 - 0.3, Y1 + 0.3
    ix0, ix1, iy0, iy1 = ox0 + MIN, ox1 - MIN, oy0 + MIN, oy1 - MIN
    B = [(ox0, oy0), (ox1, oy0), (ox1, oy1), (ox0, oy1)]; Tq = [(ix0, iy0), (ix1, iy0), (ix1, iy1), (ix0, iy1)]
    V = [(p[0], p[1], MZ0) for p in B] + [(p[0], p[1], MZ1) for p in Tq]
    F = [(i, (i + 1) % 4, 4 + (i + 1) % 4, 4 + i) for i in range(4)]
    bd.mesh(V, F, SLATE[0], smooth=False)
    if hi:   # scalloped slate courses
        k = 0; z = MZ0 + 0.25
        while z < MZ1 - 0.1:
            t = (z - MZ0) / (MZ1 - MZ0); inset = t * MIN
            xa, xb, ya, yb = ox0 + inset, ox1 - inset, oy0 + inset, oy1 - inset; c = hexc(SLATE[k % 3], 0.06, rng)
            for (p, q) in (((xa, ya), (xb, ya)), ((xb, ya), (xb, yb)), ((xb, yb), (xa, yb)), ((xa, yb), (xa, ya))):
                L = math.hypot(q[0] - p[0], q[1] - p[1]); a = math.atan2(q[1] - p[1], q[0] - p[0])
                bd.push(T((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, z, rz=a)); bd.box(L, 0.06, 0.07, 0, -0.02, 0, c, rx=-0.42); bd.pop()
            z += 0.32; k += 1
    # hip rolls at the four corners
    for (b_, t_) in zip(B, Tq):
        L = math.dist((*b_, MZ0), (*t_, MZ1)); dx, dy, dz = t_[0] - b_[0], t_[1] - b_[1], MZ1 - MZ0
        bd.push(T(b_[0], b_[1], MZ0, rz=math.atan2(dy, dx))); bd.cyl(0.09, 0.09, L, 0, 0, 0, LEAD, n=6, ry=math.atan2(math.hypot(dx, dy), dz)); bd.pop()
    bd.box(ix1 - ix0 + 0.2, iy1 - iy0 + 0.2, 0.18, (ix0 + ix1) / 2, (iy0 + iy1) / 2, MZ1, LEAD, base=True)   # lead flat
    if hi:   # iron cresting along the front of the flat
        bd.box(ix1 - ix0 + 0.3, 0.1, 0.25, (ix0 + ix1) / 2, iy0 - 0.05, MZ1 + 0.18, IRON, base=True)
        for i in range(int((ix1 - ix0) / 0.3)): bd.cyl(0.02, 0.0, 0.32, ix0 + 0.15 + i * 0.3, iy0 - 0.05, MZ1 + 0.4, IRON, n=4)
    # dormers on the front slope (lit), the ocular crest gable in the middle
    def yslope(z): return oy0 + (z - MZ0) / (MZ1 - MZ0) * MIN
    for dx in (-6.0, -3.3, 3.3, 6.0):
        z0 = MZ0 + 0.35; yf = yslope(z0) + 0.05
        bd.box(1.5, 2.2, 1.75, dx, yf + 1.1, z0, CREAM, base=True)
        bd.box(0.85, 0.06, 1.05, dx, yf - 0.03, z0 + 0.3, GLOW, mat=1, base=True)
        bd.box(1.2, 0.2, 0.12, dx, yf - 0.08, z0 + 0.22, QUO, base=True)
        for k in (-1, 1): bd.box(0.18, 0.16, 1.2, dx + k * 0.55, yf - 0.06, z0 + 0.2, QUO, base=True)
        if hi: bd.box(0.04, 0.04, 1.05, dx, yf - 0.07, z0 + 0.3, TIMB, base=True); bd.box(0.85, 0.04, 0.04, dx, yf - 0.07, z0 + 0.85, TIMB)
        bd.prism([(-0.88, 0), (0.88, 0), (0, 0.72)], 0.14, QUO, T(dx, yf - 0.07, z0 + 1.75))
        for k in (-1, 1): bd.box(1.25, 2.4, 0.1, dx + k * 0.46, yf + 1.15, z0 + 2.12, SLATE[1], ry=k * 0.68)
    # crest gable: stone face with the carved ocular window, a crown at the apex
    gz0, gw = MZ0, 3.0; gy = oy0 + 0.1
    bd.box(gw, 2.6, 2.3, 0, gy + 1.3, gz0, LIME[2], base=True)
    bd.prism([(-gw / 2 - 0.1, 0), (gw / 2 + 0.1, 0), (0, 1.25)], 2.6, LIME[2], T(0, gy, gz0 + 2.3))
    for k in (-1, 1): bd.box(math.hypot(gw / 2 + 0.3, 1.3) + 0.1, 2.8, 0.16, k * (gw / 4 + 0.05), gy + 1.3, gz0 + 2.3 + 0.62, SLATE[2], ry=k * math.atan2(1.3, gw / 2 + 0.3))
    oz = gz0 + 1.45
    bd.cyl(0.62, 0.62, 0.08, 0, gy - 0.02, oz, GLOW, n=20 if hi else 10, rx=math.pi / 2, mat=1)
    bd.torus(0.72, 0.14, 0, gy - 0.06, oz, QUO, n=20 if hi else 10, m_=4, rx=math.pi / 2)
    if hi:
        for k in range(4): bd.box(1.24, 0.04, 0.05, 0, gy - 0.08, oz, IRON, ry=k * math.pi / 4)
        for k in range(12): t = k * math.pi / 6; bd.box(0.16, 0.08, 0.26, 0.86 * math.sin(t), gy - 0.1, oz + 0.86 * math.cos(t), hexc(QUO, 0.04, rng), ry=t)   # carved surround
        bd.box(gw + 0.3, 0.3, 0.14, 0, gy - 0.08, gz0 + 2.25, QUO)
    crown(bd, 0, gy + 0.2, gz0 + 3.5, 0.42, lod)
    # chimneys
    for (chx, chy) in ((-6.5, 5.3), (6.5, 5.3)):
        bd.box(1.0, 1.0, 14.3 - 9.0, chx, chy, 9.0, QUO, base=True); bd.box(1.3, 1.3, 0.2, chx, chy, 14.3, 0x6d665e, base=True)
        if hi:
            for k in (-0.22, 0.22): bd.cyl(0.13, 0.13, 0.42, chx + k, chy, 14.5, 0xb8562e, n=6)
    # the octagonal cupola: drum, lit lantern stage, slate cap, a gilded crown finial
    cy0 = 0.6; cb = MZ1 + 0.18
    bd.cyl(1.45, 1.45, 0.75, 0, cy0, cb, LIME[2], n=8, rz=math.pi / 8)
    bd.cyl(1.6, 1.6, 0.14, 0, cy0, cb + 0.75, QUO, n=8, rz=math.pi / 8)
    bd.cyl(1.08, 1.08, 1.35, 0, cy0, cb + 0.89, GLOW, n=8, rz=math.pi / 8, mat=1)
    for k in range(8):
        a = k * math.pi / 4; bd.box(0.18, 0.18, 1.35, 1.12 * math.cos(a), cy0 + 1.12 * math.sin(a), cb + 0.89, CREAM, base=True, rz=a)
    if hi:
        for k in range(8): a = k * math.pi / 4 + math.pi / 8; bd.box(0.04, 0.04, 1.3, 1.1 * math.cos(a), cy0 + 1.1 * math.sin(a), cb + 0.92, IRON, base=True)
    bd.cyl(1.55, 1.55, 0.16, 0, cy0, cb + 2.24, QUO, n=8, rz=math.pi / 8)
    bd.cyl(1.4, 0.18, 1.5, 0, cy0, cb + 2.4, SLATE[1], n=8, rz=math.pi / 8)
    bd.sphere(0.2, 0, cy0, cb + 3.95, GOLD, sub=1)
    crown(bd, 0, cy0, cb + 4.1, 0.5, lod)
    bd.cyl(0.03, 0.03, 1.0, 0, cy0, cb + 4.5, IRON, n=4)
    bd.prism([(0, 0), (0.0, -0.36), (0.7, -0.18)], 0.03, BURG, T(0.03, cy0, cb + 5.45), mat=CLOTH)   # pennant

# ---------------- the interior: the gaming hall ----------------
def interior(bd, lod, rng, cols):
    hi = lod == 0
    iw, idp = IX1 - IX0, IY1 - IY0; cxm, cym = (IX0 + IX1) / 2, (IY0 + IY1) / 2
    # dark plank floor (+ through the arch to the threshold)
    np_ = int(iw / 0.26) if hi else 5
    for i in range(np_):
        x = IX0 + (i + 0.5) * iw / np_; bd.box(iw / np_ - (0.008 if hi else 0), idp, 0.1, x, cym, FLOOR - 0.1, hexc(FLOORS[i % 3], 0.05, rng), base=True)
    bd.box(ARCH_W, WT, 0.1, 0, Y0 + WT / 2, FLOOR - 0.1, FLOORS[1], base=True)
    # crimson + gold runner from the arch to the rum bar, a round doubloon rug at the crossing
    ry0, ry1 = Y0 - 0.1, Y1
    bd.box(2.0, ry1 - ry0, 0.012, 0, (ry0 + ry1) / 2, FLOOR, CRIM, base=True, mat=CLOTH)
    for s in (-1, 1): bd.box(0.1, ry1 - ry0, 0.014, s * 0.88, (ry0 + ry1) / 2, FLOOR, GOLD_D, base=True)
    if hi:
        for s in (-1, 1): bd.box(0.03, ry1 - ry0, 0.016, s * 0.75, (ry0 + ry1) / 2, FLOOR, GOLD, base=True)
        for yy in np.arange(ry0 + 0.6, ry1 - 0.3, 1.2): bd.box(0.32, 0.32, 0.016, 0, yy, FLOOR, GOLD_D, base=True, rz=math.pi / 4)
    RY = 1.3
    bd.cyl(1.8, 1.8, 0.016, 0, RY, FLOOR + 0.002, CRIM, n=24 if hi else 10, mat=CLOTH)
    bd.torus(1.68, 0.04, 0, RY, FLOOR + 0.02, GOLD_D, n=24 if hi else 10, m_=3)
    bd.cyl(0.85, 0.85, 0.02, 0, RY, FLOOR + 0.004, GOLD_D, n=20 if hi else 8)
    bd.cyl(0.7, 0.7, 0.024, 0, RY, FLOOR + 0.006, GOLD, n=20 if hi else 8)
    if hi:
        for k in range(8):   # compass-rose points round the doubloon
            t = k * math.pi / 4; bd.prism([(-0.1, 0), (0.1, 0), (0, 0.5)], 0.01, GOLD_D, T(0.85 * math.cos(t), RY + 0.85 * math.sin(t), FLOOR + 0.026, rz=t - math.pi / 2) @ Matrix.Rotation(-math.pi / 2, 4, 'X'))
        bd.push(T(0, RY, FLOOR + 0.03)); bd.box(0.8, 0.1, 0.03, 0, -0.16, 0, GOLD_D)
        for k in range(5): px = -0.3 + k * 0.15; h = 0.26 if k in (0, 4) else 0.34 if k != 2 else 0.42; bd.prism([(-0.06, 0), (0.06, 0), (0, h)], 0.02, GOLD_D, T(px, -0.12, 0, rx=-math.pi / 2))
        bd.pop()
    # walls inside: mahogany wainscot + crimson damask above + gilt picture rail, interior lining over the stone
    lin = [((IX0, IY1 - 0.03), (-BA_W / 2 - 0.35, IY1 - 0.03), 0.0), ((BA_W / 2 + 0.35, IY1 - 0.03), (IX1, IY1 - 0.03), 0.0), ((IX0 + 0.03, IY0), (IX0 + 0.03, IY1), math.pi / 2), ((IX1 - 0.03, IY0), (IX1 - 0.03, IY1), -math.pi / 2)]
    for (p, q, rz_) in lin:
        L = math.dist(p, q); mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        bd.push(T(mx, my, 0, rz=rz_))
        bd.box(L, 0.04, CEIL - 1.3, 0, 0.0, 1.3, DAMASK, base=True)
        bd.box(L, 0.08, 1.3, 0, -0.02, FLOOR, MAHOG, base=True); bd.box(L, 0.12, 0.08, 0, -0.05, 1.3, MAHOG_D, base=True)
        bd.box(L, 0.06, 0.06, 0, -0.04, 3.7, GOLD_D); bd.box(L, 0.1, 0.3, 0, -0.04, CEIL - 0.3, MAHOG_D, base=True)
        if hi:
            for k in range(int(L / 1.0)): bd.box(0.78, 0.03, 0.85, -L / 2 + 0.5 + k * 1.0, -0.07, 0.25, MAHOG_L, base=True)   # raised panels
            for k in range(int(L / 1.4)): xk = -L / 2 + 0.7 + k * 1.4; bd.box(0.05, 0.02, 0.5, xk, -0.03, 2.2, GOLD_D, base=True, ry=0.0); bd.box(0.3, 0.02, 0.05, xk, -0.03, 2.45, GOLD_D)   # damask fleurs
        bd.pop()
    # the front wall inside (around the arch + windows)
    fy = IY0 + 0.03
    for (xa, xb) in ((IX0, -5.6 - 0.75), (-5.6 + 0.75, -ARCH_W / 2), (ARCH_W / 2, 5.6 - 0.75), (5.6 + 0.75, IX1)):
        bd.box(xb - xa, 0.04, CEIL - 1.0, (xa + xb) / 2, fy, 1.0, DAMASK, base=True); bd.box(xb - xa, 0.08, 1.0, (xa + xb) / 2, fy + 0.02, FLOOR, MAHOG, base=True)
        bd.box(xb - xa, 0.12, 0.08, (xa + xb) / 2, fy + 0.04, 1.0, MAHOG_D, base=True)
    for (xa, xb) in ((-5.6 - 0.75, -5.6 + 0.75), (5.6 - 0.75, 5.6 + 0.75)):
        bd.box(xb - xa, 0.08, 1.0, (xa + xb) / 2, fy + 0.02, FLOOR, MAHOG, base=True); bd.box(xb - xa, 0.04, CEIL - 4.1, (xa + xb) / 2, fy, 4.1, DAMASK, base=True)
    bd.box(ARCH_W, 0.04, CEIL - 4.4, 0, fy, 4.4, DAMASK, base=True)
    # [v378] the back arch inside: gilt-cased opening, damask over it, threshold, the wing's name board
    by_ = IY1 - 0.03
    bd.box(BA_W + 0.7, 0.04, CEIL - (BA_SPRING + BA_RISE), 0, by_, BA_SPRING + BA_RISE, DAMASK, base=True)
    for s_ in (-1, 1): bd.box(0.35, 0.14, BA_SPRING + BA_RISE, s_ * (BA_W / 2 + 0.175), by_ - 0.04, FLOOR, MAHOG_D, base=True); bd.box(0.42, 0.18, 0.2, s_ * (BA_W / 2 + 0.175), by_ - 0.05, BA_SPRING - 0.1, GOLD_D, base=True)
    arch_ring(bd, 0, BA_W / 2, BA_SPRING, BA_RISE, by_ - 0.03, 0.12, 0.2, GOLD_D, 9 if hi else 5, rng, keyc=GOLD)
    bd.box(BA_W, WB + 0.1, 0.1, 0, Y1 - WB / 2, FLOOR - 0.1, FLOORS[1], base=True)
    plaque(bd, 'THE HIGH SEAS ROOM', 0, IY1 - 0.06, 4.8, 3.4, 0.45, lod, rz=0.0)
    for s_ in (-1, 1): drape(bd, s_ * (BA_W / 2 + 0.55), IY1 - 0.15, 4.2, 4.1, 0.6, lod, side=s_)
    for s in (-1, 1): drape(bd, s * (ARCH_W / 2 + 0.4), IY0 + 0.15, 4.3, 4.2, 0.7, lod, side=s)   # tied-back inner drapes, clear of the opening
    plaque(bd, 'THE GOLDEN DOUBLOON', 0, IY0 + 0.05, 4.82, 4.4, 0.6, lod, rz=math.pi)
    # pilasters on the side walls (gold capitals) + sconces
    for xe, rz_ in ((IX0, math.pi / 2), (IX1, -math.pi / 2)):
        for yy in (-3.4, 1.4):
            bd.push(T(xe, yy, 0, rz=rz_)); bd.box(0.5, 0.18, CEIL - 0.3, 0, -0.09, FLOOR, MAHOG_D, base=True); bd.box(0.62, 0.24, 0.24, 0, -0.12, CEIL - 0.55, GOLD_D, base=True)
            sconce(bd, 0, -0.18, 2.75, lod, out=-1); bd.pop()
    for xx in (-4.3, 4.3): bd.push(T(xx, IY1, 0, rz=0)); sconce(bd, 0, 0, 2.75, lod, out=-1); bd.pop()
    # coffered ceiling: mahogany grid, crimson coffers, gold rosettes, two chandeliers
    bd.box(iw, idp, G1 - CEIL, cxm, cym, CEIL, MAHOG_D, base=True)
    nx_, ny_ = 6, 5
    for i in range(nx_ + 1): xx = IX0 + i * iw / nx_; bd.box(0.26, idp, 0.32, xx, cym, CEIL - 0.32, MAHOG, base=True)
    for j in range(ny_ + 1): yy = IY0 + j * idp / ny_; bd.box(iw, 0.26, 0.32, cxm, yy, CEIL - 0.32, MAHOG, base=True)
    for i in range(nx_):
        for j in range(ny_):
            xx = IX0 + (i + 0.5) * iw / nx_; yy = IY0 + (j + 0.5) * idp / ny_
            bd.box(iw / nx_ - 0.5, idp / ny_ - 0.5, 0.04, xx, yy, CEIL - 0.04, BURG, base=True, mat=CLOTH)
            if hi: bd.box(iw / nx_ - 0.62, 0.04, 0.03, xx, yy - (idp / ny_ - 0.62) / 2, CEIL - 0.07, GOLD_D); bd.box(iw / nx_ - 0.62, 0.04, 0.03, xx, yy + (idp / ny_ - 0.62) / 2, CEIL - 0.07, GOLD_D)
            if hi: bd.sphere(0.09, xx, yy, CEIL - 0.07, GOLD, sub=0)
    if hi:
        for i in range(1, nx_):
            for j in range(1, ny_): bd.cyl(0.13, 0.13, 0.05, IX0 + i * iw / nx_, IY0 + j * idp / ny_, CEIL - 0.37, GOLD, n=8)
    for cyy in (-2.6, 2.8): chandelier(bd, 0, cyy, 3.95, 1.05, 12, CEIL - 0.3, lod)
    for cxx in (-4.6, 4.6): chandelier(bd, cxx, 1.4, 4.2, 0.6, 6, CEIL - 0.3, lod)
    stations(bd, lod, rng, cols)
    decor(bd, lod, rng, cols)
    wing_int(bd, lod, rng, cols)

def t_blackjack(bd, lod, rng, cx, cy, rz):   # [v378] one station, placed anywhere (main hall + the wing)
    hi = lod == 0
    bd.push(T(cx, cy, 0, rz=rz)); n = 20 if hi else 8
    bd.box(1.7, 0.6, 0.76, 0, -0.3, 0, MAHOG_D, base=True)
    slab(bd, dshape(1.5, n), 0.76, 0.86, MAHOG); slab(bd, dshape(1.36, n), 0.86, 0.885, FELT, mat=CLOTH)
    for i in range(n):
        a0 = math.pi + math.pi * i / n; a1 = math.pi + math.pi * (i + 1) / n; am = (a0 + a1) / 2; L = 1.43 * (a1 - a0) * 1.04
        bd.box(L, 0.17, 0.1, 1.43 * math.cos(am), 1.43 * math.sin(am), 0.86, LEATH, base=True, rz=am + math.pi / 2)
        if hi: bd.box(L, 0.03, 0.02, 1.345 * math.cos(am), 1.345 * math.sin(am), 0.885, GOLD, base=True, rz=am + math.pi / 2)
    bd.box(3.0, 0.16, 0.1, 0, 0.0, 0.86, LEATH, base=True)
    for k in range(5):   # betting spots + cards
        a = math.pi + math.pi * (k + 0.5) / 5; px, py = 1.0 * math.cos(a), 1.0 * math.sin(a)
        bd.torus(0.12, 0.012, px, py, 0.89, GOLD, n=12 if hi else 6, m_=3)
        if hi: bd.box(0.09, 0.13, 0.006, px + 0.04, py + 0.22, 0.887, WHITE, rz=a); bd.box(0.09, 0.13, 0.006, px + 0.08, py + 0.24, 0.893, WHITE, rz=a + 0.2); bd.box(0.02, 0.02, 0.004, px + 0.08, py + 0.24, 0.897, RED if k % 2 else BLACK)
        chip_stack(bd, px, py, 0.887, 2 + k % 3, (CRIM, GOLD_D, BLACK, WHITE, SAPH)[k], lod)
    bd.box(0.7, 0.24, 0.05, 0, -0.22, 0.887, MAHOG_D, base=True)   # chip rack
    if hi:
        for k in range(7): bd.cyl(0.03, 0.03, 0.12, -0.3 + k * 0.1, -0.22, 0.92, (CRIM, GOLD_D, BLACK, WHITE, SAPH, CRIM, GOLD_D)[k], n=8, rx=math.pi / 2)
        for k in range(2): bd.box(0.09, 0.13, 0.006, -0.1 + k * 0.12, -0.55, 0.887, WHITE if k else 0x8a1c1c)       # dealer's hand (one face down)
    bd.box(0.32, 0.22, 0.2, 0.95, -0.25, 0.887, MAHOG_D, base=True); bd.box(0.3, 0.02, 0.12, 0.95, -0.36, 0.95, BRASS, base=True)   # the shoe
    for k in (-2, -1, 1, 2):   # stools (not on the E spot)
        a = 1.5 * math.pi + k * 0.36; px, py = 2.0 * math.cos(a), 2.0 * math.sin(a)
        bd.cyl(0.05, 0.05, 0.62, px, py, 0, BRASS, n=6); bd.cyl(0.22, 0.22, 0.1, px, py, 0.62, CRIM, n=10 if hi else 6)
        if hi: bd.torus(0.17, 0.015, px, py, 0.25, BRASS, n=8, m_=3)
    figure(bd, 0, 0.55, 0.0, lod, vest=CRIM)
    bd.pop()

def t_roulette(bd, lod, rng, cx, cy, rz):   # [v378] one station, placed anywhere (main hall + the wing)
    hi = lod == 0
    bd.push(T(cx, cy, 0, rz=rz))
    TL, TW = 3.4, 1.5
    bd.box(TL - 0.4, TW - 0.5, 0.76, 0, 0, 0, MAHOG_D, base=True)
    bd.box(TL, TW, 0.1, 0, 0, 0.76, MAHOG, base=True); bd.box(TL - 0.2, TW - 0.2, 0.02, 0, 0, 0.86, FELT, base=True, mat=CLOTH)
    for s in (-1, 1): bd.box(TL, 0.12, 0.08, 0, s * (TW / 2 - 0.06), 0.86, LEATH, base=True)
    for s in (-1, 1): bd.box(0.12, TW, 0.08, s * (TL / 2 - 0.06), 0, 0.86, LEATH, base=True)
    REDS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    gx0, cw, rh, gy0 = -1.5, 0.13, 0.26, 0.12
    bd.box(0.12, 3 * rh, 0.006, gx0 - 0.07, gy0, 0.88, 0x1f9a4a, base=True)
    for c in range(12):
        for r in range(3):
            nn = 3 * c + (r + 1); bd.box(cw - 0.012, rh - 0.012, 0.006, gx0 + (c + 0.5) * cw, gy0 + (r - 1) * rh, 0.88, RED if nn in REDS else BLACK, base=True)
    for k in range(3): bd.box(4 * cw - 0.012, 0.16, 0.006, gx0 + (k * 4 + 2) * cw, gy0 - 1.5 * rh - 0.1, 0.88, FELT_D, base=True)
    for k, c in enumerate((FELT_D, FELT_D, RED, BLACK, FELT_D, FELT_D)): bd.box(2 * cw - 0.012, 0.14, 0.006, gx0 + (k * 2 + 1) * cw, gy0 - 1.5 * rh - 0.27, 0.88, c, base=True)
    if hi:
        for c in range(13): bd.box(0.008, 3 * rh, 0.004, gx0 + c * cw, gy0, 0.886, GOLD, base=True)
        for r in range(4): bd.box(12 * cw, 0.008, 0.004, gx0 + 6 * cw, gy0 + (r - 1.5) * rh, 0.886, GOLD, base=True)
        for (px, py, nn, col) in ((-1.2, -0.42, 3, CRIM), (-0.8, 0.2, 2, GOLD_D), (-0.3, -0.1, 4, BLACK), (0.0, -0.55, 2, WHITE)): chip_stack(bd, px, py, 0.886, nn, col, lod)
    # the wheel
    wx = 0.95; nw = 37
    bd.cyl(0.66, 0.6, 0.14, wx, 0, 0.86, MAHOG_D, n=24 if hi else 12); bd.torus(0.64, 0.035, wx, 0, 1.0, GOLD_D, n=24 if hi else 12, m_=3)
    bd.cyl(0.56, 0.56, 0.03, wx, 0, 0.98, MAHOG_L, n=24 if hi else 12)
    WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
    for k, nn in enumerate(WHEEL):
        a = k * 2 * math.pi / nw; bd.box(0.07, 0.14, 0.02, wx + 0.4 * math.cos(a), 0.4 * math.sin(a), 1.0, 0x1f9a4a if nn == 0 else RED if nn in REDS else BLACK, rz=a + math.pi / 2, base=True)
    bd.cyl(0.32, 0.12, 0.08, wx, 0, 1.0, GOLD_D, n=16 if hi else 8)
    bd.cyl(0.04, 0.03, 0.2, wx, 0, 1.06, GOLD, n=6)
    for k in range(4): a = k * math.pi / 2; bd.box(0.32, 0.03, 0.03, wx + 0.16 * math.cos(a), 0.16 * math.sin(a), 1.2, GOLD, rz=a); bd.sphere(0.03, wx + 0.32 * math.cos(a), 0.32 * math.sin(a), 1.2, GOLD, sub=0)
    bd.sphere(0.022, wx + 0.48, 0.1, 1.03, WHITE, sub=1 if hi else 0)
    figure(bd, wx, TW / 2 + 0.55, 0.0, lod, vest=0x1f4e8a)
    bd.pop()

def t_dice(bd, lod, rng, cx, cy, rz):   # [v378] one station, placed anywhere (main hall + the wing)
    hi = lod == 0
    bd.push(T(cx, cy, 0, rz=rz))
    PL, PW = 2.9, 1.7
    bd.box(PL, PW, 0.62, 0, 0, 0, MAHOG_D, base=True)
    bd.box(PL - 0.3, PW - 0.3, 0.04, 0, 0, 0.62, FELT, base=True, mat=CLOTH)
    for s in (-1, 1): bd.box(PL, 0.15, 0.36, 0, s * (PW / 2 - 0.075), 0.62, MAHOG, base=True); bd.box(PL, 0.18, 0.06, 0, s * (PW / 2 - 0.08), 0.98, LEATH, base=True)
    for s in (-1, 1): bd.box(0.15, PW, 0.36, s * (PL / 2 - 0.075), 0, 0.62, MAHOG, base=True); bd.box(0.18, PW, 0.06, s * (PL / 2 - 0.08), 0, 0.98, LEATH, base=True)
    if hi:
        for s in (-1, 1): bd.box(PL - 0.3, 0.02, 0.012, 0, s * (PW / 2 - 0.4), 0.665, GOLD, base=True)
        for s in (-1, 1): bd.box(0.02, PW - 0.8, 0.012, s * (PL / 2 - 0.45), 0, 0.665, GOLD, base=True)
        bd.box(PL - 0.32, 0.03, 0.015, 0, -(PW / 2 - 0.16), 0.97, BRASS, base=True)
    for (dx_, dy_, rz_, faces) in ((-0.35, 0.1, 0.4, 5), (0.05, -0.15, -0.3, 2)):   # two big bone dice
        s_ = 0.14; bd.box(s_, s_, s_, dx_, dy_, 0.66, BONE, base=True, rz=rz_)
        if hi:
            c_, sn = math.cos(rz_), math.sin(rz_)
            pips = {5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)], 2: [(-1, -1), (1, 1)]}[faces]
            for (u, v) in pips: px, py = u * 0.035, v * 0.035; bd.sphere(0.013, dx_ + px * c_ - py * sn, dy_ + px * sn + py * c_, 0.66 + s_, BLACK, sub=0)
    bd.cyl(0.012, 0.012, 1.4, 0.4, 0.55, 1.05, MAHOG_L, n=5, ry=math.pi / 2 - 0.15, rz=math.pi)   # the stick
    bd.box(0.12, 0.05, 0.02, -0.98, 0.55, 1.18, MAHOG_L)
    bd.push(T(PL / 2 - 0.1, 0, 1.04, rz=-math.pi / 2)); bd.sphere(0.13, 0, 0, 0.13, BONE, sub=1 if hi else 0, s=(1, 0.85, 1)); bd.box(0.14, 0.12, 0.07, 0, 0.0, 0.02, BONE, base=True)
    if hi:
        for sx in (-1, 1): bd.sphere(0.035, sx * 0.05, -0.1, 0.15, BLACK, sub=0)
    bd.pop()
    for (px, py, nn, col) in ((-0.9, -0.55, 3, CRIM), (0.8, -0.6, 2, GOLD_D), (0.3, -0.62, 4, BLACK)): chip_stack(bd, px, py, 0.98, nn, col, lod)
    figure(bd, 0, PW / 2 + 0.6, 0.0, lod, vest=0x2a2a33, sash=CRIM)
    bd.pop()

def t_slots(bd, lod, rng, cx, cy, rz):   # [v378] one station, placed anywhere (main hall + the wing)
    hi = lod == 0
    bd.push(T(cx, cy, 0, rz=rz))
    SYM = (('seven', 'chest', 'crown'), ('crown', 'crown', 'doubloon'), ('anchor', 'seven', 'ruby'))
    for i, lx_ in enumerate((-1.2, 0.0, 1.2)):
        bd.box(1.0, 0.85, 0.95, lx_, 0, 0, MAHOG, base=True); bd.box(1.04, 0.89, 0.06, lx_, 0, 0.95, GOLD_D, base=True)
        bd.box(0.92, 0.7, 1.0, lx_, 0.06, 1.01, MAHOG_D, base=True)
        bd.box(0.8, 0.06, 0.62, lx_, -0.3, 1.2, 0x120c08, base=True)   # reel window
        for k, sym in enumerate(SYM[i]):
            rx_ = lx_ + (k - 1) * 0.25; bd.box(0.22, 0.04, 0.5, rx_, -0.32, 1.26, WHITE, base=True)
            zc = 1.51; yy = -0.35
            if sym == 'seven': carve(bd, '7', rx_, yy, zc, 0.16, 0.26, lod, col=RED)
            elif sym == 'crown':
                bd.box(0.16, 0.02, 0.05, rx_, yy, zc - 0.06, GOLD_D)
                for j in range(3): bd.prism([(-0.025, 0), (0.025, 0), (0, 0.09)], 0.02, GOLD_D, T(rx_ + (j - 1) * 0.06, yy, zc - 0.035))
            elif sym == 'chest': bd.box(0.15, 0.02, 0.09, rx_, yy, zc - 0.07, 0x7a4a26, base=True); bd.box(0.15, 0.02, 0.04, rx_, yy - 0.005, zc + 0.02, 0x6a3e20, base=True); bd.box(0.03, 0.02, 0.04, rx_, yy - 0.01, zc - 0.02, GOLD, base=True)
            elif sym == 'doubloon': bd.cyl(0.07, 0.07, 0.02, rx_, yy + 0.01, zc, GOLD, n=12 if hi else 8, rx=math.pi / 2)
            elif sym == 'anchor': anchor(bd, rx_, yy, zc + 0.02, 0.1, lod, col=0x1f4e8a)
            elif sym == 'ruby': bd.sphere(0.06, rx_, yy, zc, RUBY, sub=0, s=(1, 0.4, 1.2))
        bd.box(0.86, 0.08, 0.06, lx_, -0.34, 1.82, GOLD, base=True); bd.box(0.86, 0.08, 0.06, lx_, -0.34, 1.16, GOLD, base=True)
        bd.box(0.82, 0.04, 0.02, lx_, -0.36, 1.505, RED, base=True)   # pay line
        bd.prism([(0.46 * math.cos(math.pi * j / 10), 0.46 * math.sin(math.pi * j / 10)) for j in range(11)], 0.5, MAHOG_D, T(lx_, -0.28, 2.01))   # arched marquee (CCW seen from the front)
        bd.prism([(0.38 * math.cos(math.pi * j / 10), 0.38 * math.sin(math.pi * j / 10)) for j in range(11)], 0.04, GLOW, T(lx_, -0.31, 2.03), mat=1)
        doubloon(bd, lx_, -0.36, 2.24, 0.15, lod, rng, relief='crown' if i != 1 else 'anchor')
        bd.box(0.6, 0.18, 0.08, lx_, -0.48, 0.92, GOLD_D, base=True)   # coin tray
        bd.box(0.62, 0.2, 0.05, lx_, -0.42, 0.84, MAHOG_D, base=True)
        if hi:
            for k in range(4): bd.cyl(0.035, 0.035, 0.012, lx_ - 0.15 + k * 0.1, -0.5, 0.97, GOLD, n=8)
        bd.cyl(0.07, 0.07, 0.12, lx_ + 0.5, -0.05, 1.35, BRASS, n=8, ry=math.pi / 2)   # the one arm
        bd.cyl(0.03, 0.03, 0.62, lx_ + 0.58, -0.05, 1.38, BRASS, n=6); bd.sphere(0.075, lx_ + 0.58, -0.05, 2.02, RED, sub=1 if hi else 0)
        if hi:
            for k in range(4): bd.box(0.03, 0.03, 0.03, lx_ - 0.42, -0.36, 1.2 + k * 0.2, GLOW, mat=1)   # marker lamps
    bd.pop()

def stations(bd, lod, rng, cols):
    hi = lod == 0
    # ---- PIRATE BLACKJACK: half-moon table, dealer behind the straight edge (south wall side), players on the curve ----
    cx, cy = ST['blackjack']['c']; t_blackjack(bd, lod, rng, cx, cy, math.pi / 2)
    if cols is not None: cols += [['c', cx, -cy, 1.55], ['b', round((IX0 + cx) / 2, 3), -cy, round(cx - IX0, 3), 3.2]]
    plaque(bd, 'PIRATE BLACKJACK', IX0 + 0.08, cy, 3.25, 3.0, 0.55, lod, rz=math.pi / 2)
    # ---- BUCCANEER ROULETTE: long table along the wall, the wheel at the south end, croupier between it and the north wall ----
    cx, cy = ST['roulette']['c']; t_roulette(bd, lod, rng, cx, cy, -math.pi / 2)
    if cols is not None: cols += [['b', round((cx - 0.85 + IX1) / 2, 3), -cy, round(IX1 - (cx - 0.85), 3), 3.6]]
    plaque(bd, 'BUCCANEER ROULETTE', IX1 - 0.08, cy, 3.25, 3.2, 0.55, lod, rz=-math.pi / 2)
    # ---- DEAD MAN'S DICE: the craps tub, the stickman on the wall side, a skull on the end rail ----
    cx, cy = ST['dice']['c']; t_dice(bd, lod, rng, cx, cy, math.pi / 2)
    PL, PW = 2.9, 1.7
    if cols is not None: cols += [['b', round((IX0 + cx + PW / 2 + 0.05) / 2, 3), -cy, round(cx + PW / 2 + 0.05 - IX0, 3), PL + 0.2]]
    plaque(bd, "DEAD MAN'S DICE", IX0 + 0.08, cy, 3.25, 3.0, 0.55, lod, rz=math.pi / 2)
    # ---- TREASURE SLOTS: a bank of three one-armed bandits against the north wall ----
    cx, cy = ST['slots']['c']; t_slots(bd, lod, rng, cx, cy, -math.pi / 2)
    if cols is not None: cols += [['b', round((cx - 0.5 + IX1) / 2, 3), -cy, round(IX1 - (cx - 0.5), 3), 3.7]]
    plaque(bd, 'TREASURE SLOTS', IX1 - 0.08, cy, 3.35, 2.8, 0.55, lod, rz=-math.pi / 2)

def rum_bar(bd, lod, rng, cols, DY, IY1=IY1):   # [v378] the rum bar (moved to the wing's end wall: DY = how far back, IY1 = that wall's inner face - DY)
    hi = lod == 0
    bd.push(T(0, DY, 0))
    bx0, bx1, by0, by1 = -3.0, 3.0, 5.0, 5.7
    bd.box(bx1 - bx0, by1 - by0, 1.08, 0, (by0 + by1) / 2, 0, MAHOG, base=True)
    bd.box(bx1 - bx0 + 0.2, by1 - by0 + 0.25, 0.08, 0, (by0 + by1) / 2 - 0.05, 1.08, MAHOG_L, base=True)
    bd.cyl(0.035, 0.035, bx1 - bx0, bx0, by0 - 0.22, 0.22, BRASS, n=8, ry=math.pi / 2)
    for xx in np.linspace(bx0 + 0.2, bx1 - 0.2, 5): bd.box(0.04, 0.22, 0.04, xx, by0 - 0.11, 0.2, BRASS)
    if hi:
        for k in range(6): xx = bx0 + 0.5 + k * 1.0; bd.box(0.8, 0.03, 0.75, xx, by0 - 0.015, 0.16, MAHOG_L, base=True); bd.box(0.82, 0.04, 0.03, xx, by0 - 0.03, 0.92, GOLD_D); doubloon(bd, xx, by0 - 0.05, 0.55, 0.13, 1, rng)
        for (px, c) in ((-2.2, 0x6b3a1a), (-1.6, 0x2f6b3a), (1.2, 0x8a5a2b)): bd.cyl(0.04, 0.04, 0.2, px, 5.3, 1.16, c, n=8); bd.cyl(0.015, 0.015, 0.08, px, 5.3, 1.36, c, n=6)
        for px in (-0.6, 0.6): bd.cyl(0.05, 0.04, 0.12, px, 5.25, 1.16, 0xe8f4ff, n=8)
    BY = IY1 - 0.24
    bd.box(5.8, 0.46, 1.0, 0, BY, 0, MAHOG_D, base=True); bd.box(5.9, 0.5, 0.06, 0, BY, 1.0, MAHOG_L, base=True)
    for zz in (2.0, 2.55, 3.1): bd.box(5.8, 0.36, 0.05, 0, BY + 0.05, zz, MAHOG, base=True)
    for xx in (-2.9, -0.95, 0.95, 2.9): bd.box(0.12, 0.42, 2.2, xx, BY + 0.03, 1.0, MAHOG_D, base=True)
    BOT = (0x6b3a1a, 0x2f6b3a, 0x8a5a2b, 0x3a2414, 0x7a1c22, 0xc8961e)
    for zz in (2.05, 2.6, 3.15):
        for k in range(14 if hi else 5):
            px = -2.75 + k * (5.5 / ((14 if hi else 5) - 1))
            if any(abs(px - q) < 0.1 for q in (-0.95, 0.95)): continue
            c = BOT[(k + int(zz * 3)) % 6]; bd.cyl(0.05, 0.05, 0.24, px, BY + 0.05, zz, c, n=8 if hi else 5); bd.cyl(0.018, 0.018, 0.1, px, BY + 0.05, zz + 0.24, c, n=5)
    for xx in (-1.9, 0.0, 1.9):   # rum casks on cradles, brass taps
        bd.box(0.7, 0.4, 0.14, xx, BY - 0.0, 1.06, MAHOG_D, base=True)
        bd.push(T(xx, BY - 0.02, 1.48, ry=math.pi / 2)); barrel_(bd, 0, 0, -0.36, lod, r=0.3, h=0.72); bd.pop()
        bd.cyl(0.03, 0.03, 0.14, xx + 0.0, BY - 0.25, 1.4, BRASS, n=6, rx=math.pi / 2); bd.cyl(0.02, 0.02, 0.08, xx, BY - 0.38, 1.33, BRASS, n=6)
    plaque(bd, 'RUM BAR', 0, IY1 - 0.06, 3.95, 2.4, 0.55, lod, rz=0.0)
    figure(bd, -0.9, 5.98, 0.0, lod, vest=0x6a1414, hat=False)
    for (xx, yy) in ((-3.45, 6.15), (3.45, 6.15)): barrel_(bd, xx, yy, 0, lod, r=0.38, h=1.0)
    barrel_(bd, 3.45, 6.15, 1.0, lod, r=0.32, h=0.85)
    bd.pop()
    if cols is not None: cols += [['b', 0.0, round(-(by0 - 0.3 + IY1) / 2 - DY, 3), 6.4, round(IY1 - by0 + 0.3, 3)], ['c', -3.45, round(-6.15 - DY, 3), 0.45], ['c', 3.45, round(-6.15 - DY, 3), 0.45]]

def decor(bd, lod, rng, cols):
    hi = lod == 0
    # ---- the treasure vault dais (front south corner): stone plinth, open chests overflowing, gold heaps, gems, a crown on a cushion ----
    dx0, dx1, dy0, dy1 = IX0, -5.55, IY0, -3.3; dcx, dcy = (dx0 + dx1) / 2, (dy0 + dy1) / 2
    bd.box(dx1 - dx0, dy1 - dy0, 0.85, dcx, dcy, 0, QUO, base=True)
    bd.box(dx1 - dx0 + 0.1, dy1 - dy0 + 0.1, 0.08, dcx, dcy, 0.85, LIME[2], base=True)
    if hi: bd.box(dx1 - dx0 + 0.12, dy1 - dy0 + 0.12, 0.05, dcx, dcy, 0.05, GOLD_D, base=True)
    chest(bd, dcx - 0.1, dcy - 0.6, 0.93, 0.3, lod, rng, open_=True)
    chest(bd, dcx + 0.15, dcy + 0.75, 0.93, -0.4, lod, rng, open_=True, s=0.85)
    coins(bd, dcx + 0.55, dcy - 0.05, 0.93, 0.45, 0.3, lod, rng)
    bd.box(0.5, 0.5, 0.18, dcx - 0.55, dcy + 0.0, 0.93, CRIM, base=True, mat=CLOTH); crown(bd, dcx - 0.55, dcy, 1.11, 0.32, lod)
    if hi:
        for (gx, gy_, c) in ((0.3, -0.4, RUBY), (0.6, 0.3, EMER), (-0.2, 0.3, SAPH), (0.7, -0.6, RUBY)): gem(bd, dcx + gx, dcy + gy_, 0.98, c, 0.07)
        for k in range(4): bd.cyl(0.04, 0.04, 0.9, dx1 + 0.08, dy0 + 0.4 + k * 0.9, 0, BRASS, n=6); bd.sphere(0.06, dx1 + 0.08, dy0 + 0.4 + k * 0.9, 0.92, GOLD, sub=0)
        for k in range(3): bd.cyl(0.02, 0.02, 0.9, dx1 + 0.08, dy0 + 0.4 + k * 0.9, 0.75, CRIM, n=4, rx=-math.pi / 2)
    if cols is not None: cols += [['b', round(dcx + 0.05, 3), round(-dcy, 3), round(dx1 - dx0 + 0.2, 3), round(dy1 - dy0 + 0.1, 3)]]
    # ---- the north front corner: a stack of chests + doubloon barrels ----
    chest(bd, 6.9, -5.9, FLOOR, math.pi / 2, lod, rng, open_=True)
    chest(bd, 6.85, -4.95, FLOOR, math.pi / 2 + 0.2, lod, rng)
    chest(bd, 6.85, -4.95, FLOOR + 0.82, math.pi / 2 - 0.15, lod, rng, s=0.8)
    barrel_(bd, 5.6 + 0.6, -6.1, 0, lod, r=0.36, h=0.95); coins(bd, 6.2, -6.1, 0.95, 0.3, 0.16, lod, rng)
    if cols is not None: cols += [['b', 6.75, 5.55, 2.1, 2.0]]
    plaque(bd, 'HIGH STAKES', IX1 - 0.08, -5.4, 3.2, 2.0, 0.5, lod, rz=-math.pi / 2)
    # ---- the hall's own walls (three.js building frame: x, z = -y): the front split around the open arch (4.8 m clear), sides, back ----
    if cols is not None:
        fz = round(-(Y0 + WT / 2), 3); fd = WT + 0.1
        for (pa, pc) in ((X0 - 0.05, -2.4), (2.4, X1 + 0.05)): cols.append(['b', round((pa + pc) / 2, 3), fz, round(pc - pa, 3), fd])
        cols.append(['b', round(X0 + WS / 2, 3), 0.0, WS + 0.1, D + 0.1]); cols.append(['b', round(X1 - WS / 2, 3), 0.0, WS + 0.1, D + 0.1])
        for (pa, pc) in ((X0 - 0.05, -BA_W / 2 + 0.05), (BA_W / 2 - 0.05, X1 + 0.05)): cols.append(['b', round((pa + pc) / 2, 3), round(-(Y1 - WB / 2), 3), round(pc - pa, 3), WB + 0.1])
        for px in (-3.35, 3.35): cols.append(['b', px, round(-(Y0 - 0.15), 3), 0.92, 0.42])   # the arch pilasters' bases


# ---------------- [v378] THE HIGH SEAS ROOM: the wing behind the hall ----------------
def wing_ext(bd, lod, rng):
    hi = lod == 0; L = WYE - Y1; cy = (Y1 + WYE) / 2
    for sg in (-1, 1):
        bd.push(T(sg * WX, cy, 0, rz=sg * math.pi / 2))   # local -y = outward, local x = sg * (y - cy)
        bd.box(L, WSW, WZ2 - ZB, 0, WSW / 2, ZB, MORT if hi else LIME[0], base=True)
        bd.box(L + 0.3, 0.3, 0.45, 0, -0.06, ZB, QUO, base=True)   # plinth
        bd.box(L + 0.6, 0.85, 0.4, 0, 0.05, WZ2 - 0.1, QUO, base=True)   # cornice
        if hi:
            for zz in np.arange(1.0, WZ2 - 0.3, 1.0): bd.box(L, 0.04, 0.05, 0, -0.02, zz, MORT, base=True)   # coursing lines (light: no per-block ashlar on the wing)
        for yy in (13.9, 19.7, 25.0):
            lx_ = sg * (yy - cy); lead_glass(bd, lx_, 3.2, 4.3, 0.55, -0.02, lod); grille(bd, lx_, 3.2, 4.3, 0.55, -0.09, lod)
            bd.box(1.5, 0.3, 0.12, lx_, -0.1, 3.08, QUO, base=True)
            if hi: arch_ring(bd, lx_, 0.55, 4.3, 0.55, -0.02, 0.2, 0.16, QUO, 7, rng)
        for yy in (Y1 + 0.3, WYE - 0.3): bd.box(0.6, 0.12, WZ2 - ZB, sg * (yy - cy), -0.06, ZB, QUO, base=True)   # quoins
        bd.pop()
    bd.push(T(0, WYE, 0, rz=math.pi))   # the end wall (faces the yard's far side)
    bd.box(2 * WX, 0.6, WZ2 - ZB, 0, 0.3, ZB, MORT if hi else LIME[0], base=True)
    bd.box(2 * WX + 0.3, 0.3, 0.45, 0, -0.06, ZB, QUO, base=True); bd.box(2 * WX + 0.6, 0.85, 0.4, 0, 0.05, WZ2 - 0.1, QUO, base=True)
    if hi:
        for zz in np.arange(1.0, WZ2 - 0.3, 1.0): bd.box(2 * WX, 0.04, 0.05, 0, -0.02, zz, MORT, base=True)
    for xx in (-5.4, 5.4): lead_glass(bd, xx, 3.2, 4.3, 0.55, -0.02, lod); grille(bd, xx, 3.2, 4.3, 0.55, -0.09, lod); bd.box(1.5, 0.3, 0.12, xx, -0.1, 3.08, QUO, base=True)
    wall_lantern(bd, 0, 0, 3.6, lod, out=-1)
    bd.pop()
    # slate gable roof along the wing, ridge skylights (lit), a lit ocular in the far gable
    ex, rh = WX + 0.4, 2.1; a = math.atan2(rh, ex); sl = math.hypot(ex, rh) + 0.1; ry0, ry1 = Y1 - 0.1, WYE + 0.4; RL = ry1 - ry0; rcy = (ry0 + ry1) / 2
    ze, zr = WZ2 + 0.25, WZ2 + 0.25 + rh
    for sg in (-1, 1):   # each slope: an explicit slab (eave -> ridge), slate courses as stepped strips
        V = [(sg * ex, ry0, ze), (0, ry0, zr), (0, ry1, zr), (sg * ex, ry1, ze)]
        V = V + [(x, y, z - 0.18) for (x, y, z) in V]
        F = [(0, 1, 2, 3) if sg > 0 else (3, 2, 1, 0), (7, 6, 5, 4) if sg > 0 else (4, 5, 6, 7), (0, 3, 7, 4), (1, 5, 6, 2), (0, 4, 5, 1), (3, 2, 6, 7)]
        bd.mesh(V, F, SLATE[0], smooth=False)
        if hi:
            nk = int(ex / 0.36)
            for k in range(1, nk):
                t = k / nk; bd.box(0.1, RL, 0.05, sg * ex * (1 - t), rcy, ze + rh * t - 0.01, hexc(SLATE[k % 3], 0.06, rng), base=True)
    bd.cyl(0.13, 0.13, RL, 0, ry0, WZ2 + 0.38 + rh, LEAD, n=6, rx=-math.pi / 2)
    bd.prism([(-WX, 0), (WX, 0), (0, rh + 0.2)], 0.6, LIME[0], T(0, WYE - 0.6, WZ2 + 0.2))
    bd.cyl(0.42, 0.42, 0.06, 0, WYE + 0.02, WZ2 + 1.0, GLOW, n=16 if hi else 8, rx=math.pi / 2, mat=1)
    bd.torus(0.5, 0.1, 0, WYE + 0.04, WZ2 + 1.0, QUO, n=16 if hi else 8, m_=4, rx=math.pi / 2)
    for yy in (13.9, 25.0):   # ridge lanterns
        z0 = WZ2 + 0.3 + rh
        bd.box(1.5, 1.5, 0.3, 0, yy, z0, LIME[2], base=True); bd.box(1.2, 1.2, 0.75, 0, yy, z0 + 0.3, GLOW, mat=1, base=True)
        for sx in (-1, 1):
            for sy in (-1, 1): bd.box(0.14, 0.14, 0.75, sx * 0.6, yy + sy * 0.6, z0 + 0.3, CREAM, base=True)
        bd.cyl(1.15, 0.08, 0.7, 0, yy, z0 + 1.05, SLATE[1], n=4, rz=math.pi / 4); bd.sphere(0.12, 0, yy, z0 + 1.8, GOLD, sub=0)

def lining(bd, segs, ceil, hi, fleur=True):   # mahogany wainscot + damask + gilt rail on interior wall runs (local -y = into the room)
    for (p, q, rz_) in segs:
        L = math.dist(p, q); mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        bd.push(T(mx, my, 0, rz=rz_))
        bd.box(L, 0.04, ceil - 1.3, 0, 0.0, 1.3, DAMASK, base=True)
        bd.box(L, 0.08, 1.3, 0, -0.02, FLOOR, MAHOG, base=True); bd.box(L, 0.12, 0.08, 0, -0.05, 1.3, MAHOG_D, base=True)
        bd.box(L, 0.06, 0.06, 0, -0.04, 3.7, GOLD_D); bd.box(L, 0.1, 0.3, 0, -0.04, ceil - 0.3, MAHOG_D, base=True)
        if hi:
            for k in range(int(L / 1.0)): bd.box(0.78, 0.03, 0.85, -L / 2 + 0.5 + k * 1.0, -0.07, 0.25, MAHOG_L, base=True)
            if fleur:
                for k in range(int(L / 1.4)): xk = -L / 2 + 0.7 + k * 1.4; bd.box(0.05, 0.02, 0.5, xk, -0.03, 2.2, GOLD_D, base=True); bd.box(0.3, 0.02, 0.05, xk, -0.03, 2.45, GOLD_D)
        bd.pop()

NAMES = dict(blackjack='PIRATE BLACKJACK', roulette='BUCCANEER ROULETTE', dice="DEAD MAN'S DICE", slots='TREASURE SLOTS')
def wing_int(bd, lod, rng, cols):
    hi = lod == 0; iw, idp = WIX1 - WIX0, WIY1 - WIY0; cym = (WIY0 + WIY1) / 2
    np_ = int(iw / 0.26) if hi else 5
    for i in range(np_):
        x = WIX0 + (i + 0.5) * iw / np_; bd.box(iw / np_ - (0.008 if hi else 0), idp, 0.1, x, cym, FLOOR - 0.1, hexc(FLOORS[i % 3], 0.05, rng), base=True)
    # walls: sides, the end wall, the hall's back wall on this side (around the arch)
    fy = WIY0 + 0.03
    lining(bd, [((WIX0 + 0.03, WIY0), (WIX0 + 0.03, WIY1), math.pi / 2), ((WIX1 - 0.03, WIY0), (WIX1 - 0.03, WIY1), -math.pi / 2),
                ((WIX0, WIY1 - 0.03), (WIX1, WIY1 - 0.03), 0.0), ((-BA_W / 2 - 0.35, fy), (WIX0, fy), math.pi), ((WIX1, fy), (BA_W / 2 + 0.35, fy), math.pi)], WCEIL, hi, fleur=False)
    bd.box(BA_W + 0.7, 0.04, WCEIL - (BA_SPRING + BA_RISE), 0, fy, BA_SPRING + BA_RISE, DAMASK, base=True)
    for s_ in (-1, 1): bd.box(0.35, 0.14, BA_SPRING + BA_RISE, s_ * (BA_W / 2 + 0.175), fy + 0.04, FLOOR, MAHOG_D, base=True)
    arch_ring(bd, 0, BA_W / 2, BA_SPRING, BA_RISE, fy + 0.03, 0.12, 0.2, GOLD_D, 9 if hi else 5, rng, keyc=GOLD)
    plaque(bd, 'THE GOLDEN DOUBLOON', 0, fy + 0.06, 4.85, 3.0, 0.42, lod, rz=math.pi)
    # lit windows (inside faces of the leaded glass) flanked by sconces, pilasters between the bays
    for (xe, rz_) in ((WIX0, math.pi / 2), (WIX1, -math.pi / 2)):
        for yy in (13.9, 19.7, 25.0):
            bd.push(T(xe, yy, 0, rz=rz_))
            bd.box(1.1, 0.05, 1.1, 0, -0.06, 3.2, GLOW, mat=1, base=True); bd.cyl(0.55, 0.55, 0.05, 0, -0.06, 4.3, GLOW, n=12 if hi else 6, rx=math.pi / 2, mat=1)
            bd.box(1.36, 0.12, 0.1, 0, -0.1, 3.1, GOLD_D, base=True)
            for sx in (-1, 1): bd.box(0.1, 0.12, 1.2, sx * 0.62, -0.1, 3.1, GOLD_D, base=True); sconce(bd, sx * 1.15, -0.06, 2.75, lod, out=-1)
            bd.pop()
        for yy in (8.3, 30.2):
            bd.push(T(xe, yy, 0, rz=rz_)); bd.box(0.5, 0.18, WCEIL - 0.3, 0, -0.09, FLOOR, MAHOG_D, base=True); bd.box(0.62, 0.24, 0.24, 0, -0.12, WCEIL - 0.55, GOLD_D, base=True); bd.pop()
    # coffered ceiling + chandeliers down the aisle and a smaller one over every table
    bd.box(iw, idp, WZ2 - WCEIL, 0, cym, WCEIL, MAHOG_D, base=True)
    nx_, ny_ = 6, 13
    for i in range(nx_ + 1): xx = WIX0 + i * iw / nx_; bd.box(0.26, idp, 0.32, xx, cym, WCEIL - 0.32, MAHOG, base=True)
    for j in range(ny_ + 1): yy = WIY0 + j * idp / ny_; bd.box(iw, 0.26, 0.32, 0, yy, WCEIL - 0.32, MAHOG, base=True)
    for i in range(nx_):
        for j in range(ny_):
            xx = WIX0 + (i + 0.5) * iw / nx_; yy = WIY0 + (j + 0.5) * idp / ny_
            bd.box(iw / nx_ - 0.5, idp / ny_ - 0.5, 0.04, xx, yy, WCEIL - 0.04, BURG, base=True, mat=CLOTH)
            if hi: bd.sphere(0.09, xx, yy, WCEIL - 0.07, GOLD, sub=0)
    for yy in WCH: chandelier(bd, 0, yy, 4.15, 1.05, 12, WCEIL - 0.3, lod)
    for (g, n_, cx, cy, rz, ex) in WING: chandelier(bd, (cx + ex) / 2, cy, 4.4, 0.55, 6, WCEIL - 0.3, max(lod, 1))   # small ones: LOD1 detail (file size)
    # the crimson runner from the arch to the bar, two doubloon rugs
    ry0, ry1 = WIY0 - 0.3, 30.8
    bd.box(2.0, ry1 - ry0, 0.012, 0, (ry0 + ry1) / 2, FLOOR, CRIM, base=True, mat=CLOTH)
    for s_ in (-1, 1): bd.box(0.1, ry1 - ry0, 0.014, s_ * 0.88, (ry0 + ry1) / 2, FLOOR, GOLD_D, base=True)
    if hi:
        for s_ in (-1, 1): bd.box(0.03, ry1 - ry0, 0.016, s_ * 0.75, (ry0 + ry1) / 2, FLOOR, GOLD, base=True)
        for yy in np.arange(ry0 + 0.6, ry1 - 0.3, 1.2): bd.box(0.32, 0.32, 0.016, 0, yy, FLOOR, GOLD_D, base=True, rz=math.pi / 4)
    for RY in (13.9, 19.7, 25.0):
        bd.cyl(1.5, 1.5, 0.016, 0, RY, FLOOR + 0.002, CRIM, n=24 if hi else 10, mat=CLOTH); bd.torus(1.4, 0.04, 0, RY, FLOOR + 0.02, GOLD_D, n=24 if hi else 10, m_=3)
        bd.cyl(0.7, 0.7, 0.02, 0, RY, FLOOR + 0.004, GOLD_D, n=20 if hi else 8); bd.cyl(0.58, 0.58, 0.024, 0, RY, FLOOR + 0.006, GOLD, n=20 if hi else 8)
    # one game per table
    roman = {2: 'II', 3: 'III'}
    for (g, n_, cx, cy, rz, ex) in WING:
        sg = -1 if cx < 0 else 1; wall = WIX0 if sg < 0 else WIX1
        {'blackjack': t_blackjack, 'roulette': t_roulette, 'dice': t_dice}[g](bd, lod, rng, cx, cy, rz)
        plaque(bd, NAMES[g] + ' ' + roman[n_], wall - sg * 0.08, cy, 3.25, 3.0, 0.5, lod, rz=-sg * math.pi / 2)
        if cols is not None:
            inner = {'blackjack': cx, 'roulette': cx - sg * 0.85, 'dice': cx - sg * 0.9}[g]; dep = {'blackjack': 3.2, 'roulette': 3.6, 'dice': 3.1}[g]
            cols.append(['b', round((wall + inner) / 2, 3), round(-cy, 3), round(abs(wall - inner), 3), dep])
            if g == 'blackjack': cols.append(['c', cx, round(-cy, 3), 1.55])
    for (cx, cy, rz) in WSLOTS:
        sg = -1 if cx < 0 else 1; wall = WIX0 if sg < 0 else WIX1
        t_slots(bd, lod, rng, cx, cy, rz)
        plaque(bd, NAMES['slots'], wall - sg * 0.08, cy, 3.35, 2.8, 0.5, lod, rz=-sg * math.pi / 2)
        if cols is not None: cols.append(['b', round((wall + cx - sg * 0.5) / 2, 3), round(-cy, 3), round(abs(wall - (cx - sg * 0.5)), 3), 3.7])
    # the rum bar on the end wall, treasure in the corners beside it
    rum_bar(bd, lod, rng, cols, BAR_DY)
    for sg in (-1, 1):
        chest(bd, sg * 6.3, 31.9, FLOOR, math.pi / 2, lod, rng, open_=True); coins(bd, sg * 6.4, 30.9, FLOOR, 0.45, 0.3, lod, rng)
        barrel_(bd, sg * 5.0, 32.3, 0, lod, r=0.36, h=0.95)
        if cols is not None: cols.append(['b', round(sg * 5.85, 3), round(-31.75, 3), 2.3, 2.3])
    if cols is not None:
        for sg in (-1, 1): cols.append(['b', round(sg * (WX - WSW / 2), 3), round(-(Y1 + WYE) / 2, 3), WSW + 0.1, round(WYE - Y1 + 0.1, 3)])
        cols.append(['b', 0.0, round(-(WYE - 0.3), 3), 2 * WX + 0.1, 0.7])

def wing_tables():   # three.js building frame, like `tables`: one entry per station (slots: one per machine)
    out = []
    for (g, n_, cx, cy, rz, ex) in WING: out.append(dict(id='casino_%s_%d' % (g, n_), game=g, c=[cx, -cy], e=[ex, -cy]))
    k = 2
    for (cx, cy, rz) in WSLOTS:
        sg = -1 if cx < 0 else 1
        for dy in (-1.2, 0.0, 1.2): out.append(dict(id='casino_slots_%d' % k, game='slots', c=[cx, round(-(cy + dy), 3)], e=[round(cx - sg * 1.55, 3), round(-(cy + dy), 3)])); k += 1
    return out

# ---------------- build + export ----------------
def mats():
    out = []
    for nm, kind in (('casino_solid', 0), ('casino_glow', 1)):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        if kind == 1: nt.links.new(ca.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 3.0
        out.append(m)
    return out
MATS = mats()
coll = bpy.data.collections.new('casino'); bpy.context.scene.collection.children.link(coll)
root = bpy.data.objects.new('casino_hall', None); coll.objects.link(root)
cols = []; rep = {}
for lod in (0, 1):
    rng = np.random.default_rng(4747 + lod); random.seed(47)
    bd = Builder(); bd.ground = lambda x, y: 0.0
    exterior(bd, lod, rng); interior(bd, lod, rng, cols if lod == 0 else None)
    me = bd.bake(f'casino_hall_LOD{lod}'); me.validate(clean_customdata=False)
    for m in MATS: me.materials.append(m)
    o = bpy.data.objects.new(f'casino_hall_LOD{lod}', me); coll.objects.link(o); o.parent = root; rep[f'LOD{lod}'] = bd.tris()
    print('LOD', lod, 'tris', rep[f'LOD{lod}'], flush=True)
cols = [[q[0]] + [round(float(v), 3) for v in q[1:]] for q in cols]
tables = {k: dict(c=[round(v['c'][0], 3), round(-v['c'][1], 3)], e=[round(v['e'][0], 3), round(-v['e'][1], 3)]) for k, v in ST.items()}   # three.js building frame
root['colliders'] = json.dumps(cols); root['tables'] = json.dumps(tables); root['wing'] = json.dumps(dict(tables=wing_tables(), x0=-WX, x1=WX, y0=round(-Y1, 3), y1=round(-WYE, 3), inner=[WIX0, round(-WIY1, 3), WIX1, round(-WIY0, 3)], ceil=WCEIL, chand=[round(-y, 3) for y in WCH], arch=BA_W))
root['footprint'] = json.dumps(dict(cx=CX, cz=CZ, w=W, d=D, inner=[round(IX0, 3), round(-IY1, 3), round(IX1, 3), round(-IY0, 3)], arch=ARCH_W, archH=ARCH_SPRING + ARCH_RISE, ceil=CEIL))
root['dealers'] = json.dumps(DEALERS); root['kind'] = 'casino'; root['n'] = 47
json.dump(dict(report=rep, colliders=cols, tables=tables), open(os.path.join(OUT, 'casino_report.json'), 'w'), indent=1)
for o in bpy.data.objects: o.select_set(True)
f = os.path.join(OUT, 'casino_hall_raw.glb')
kw = dict(filepath=f, export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', f, os.path.getsize(f), rep, flush=True)
