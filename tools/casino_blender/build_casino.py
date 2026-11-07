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
import materials as ML   # [pass2] casino-only surface layers 13..15 (js/island/casino.js draws them in its own shader patch: damask wallpaper,
for _i, _n in ((13, 'cas_damask'), (14, 'cas_carpet'), (15, 'cas_wood')): ML.ID[_n] = _i   # patterned carpet, polished boards); the shared library keeps 1..12
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
CEIL, G1, Z2 = 8.2, 6.0, 9.6          # coffered ceiling underside ([AAA] BANKSY t216u: raised 5.4 -> 8.2, the hall now runs up through the 1st floor), 1st string course, main cornice
MZ0, MZ1, MIN = 9.85, 12.6, 1.2       # mansard foot (on the cornice) / top / inset
ARCH_W, ARCH_SPRING, ARCH_RISE = 5.0, 3.0, 1.4   # clear opening 5.0 x 4.4 m
# the four stations (Blender frame x, y): table centre + the E point (players' side) - js/island/casinoData.js CASINO_TABLES
ST = dict(blackjack=dict(c=(-6.25, -1.4), e=(-4.0, -1.4)), roulette=dict(c=(5.6, -1.4), e=(4.0, -1.4)),
          dice=dict(c=(-5.7, 4.2), e=(-4.0, 4.2)), slots=dict(c=(7.3, 4.2), e=(5.6, 4.2)))
# [v378] BANKSY t1984u/t1985u: THE HIGH SEAS ROOM, a wing straight back (into the walled yard, lx 28.5 .. 54.75) through an arch in the hall's back wall.
BA_W, BA_SPRING, BA_RISE = 12.0, 3.6, 0.7     # [t2007u] BANKSY: "open up the wall in between 2 rooms": a 12 m wide shallow arch, hall + wing read as one room
WX, WYE, WSW = 8.0, 33.5, 0.55                 # wing half width (lz -58.4 .. -42.4), its back face (y), wall thickness
WIX0, WIX1, WIY0, WIY1 = -WX + WSW, WX - WSW, Y1, WYE - 0.6
WZ2, WCEIL = 7.8, 7.0                          # wing eaves / ceiling underside ([AAA] raised from 6.6 / 5.6 with the hall)
# one game per table: (game, id suffix, table centre x, y, rotation (dealer to the wall), E point x)
WING = [('blackjack', 2, -5.4, 11.0, math.pi / 2, -3.15), ('roulette', 2, 5.2, 11.0, -math.pi / 2, 3.6),
        ('dice', 2, -5.2, 16.8, math.pi / 2, -3.5), ('blackjack', 3, 5.4, 16.8, -math.pi / 2, 3.15),
        ('roulette', 3, -5.2, 22.6, math.pi / 2, -3.6), ('dice', 3, 5.2, 22.6, -math.pi / 2, 3.5)]
WSLOTS = [(-6.95, 27.4, math.pi / 2), (6.95, 27.4, -math.pi / 2)]   # two banks of three: every machine is its own station
SLOT_DY = 1.3                                  # [AAA] machine pitch in a bank (was 1.2): brass lamp posts between them, interaction zones never overlap
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
                **{c: 'timber' for c in (MAHOG, MAHOG_D, MAHOG_L, TIMB)}, IRON: 'iron', CREAM: 'plaster', DAMASK: 'cas_damask',
                **{c: 'cas_wood' for c in FLOORS}}
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
SIGN_FONT = next((f for f in (os.path.join(GAME, 'assets/fonts/CinzelDecorative-Bold.ttf'),) if os.path.exists(f)), FONT)   # [AAA] crisp engraved capitals
_FONTS = {}
def text_mesh2(s, font_path, extrude=0.03, res=3):   # lib.text_mesh with a per-path font cache (lib caches only the first font)
    f = _FONTS.get(font_path)
    if f is None: f = _FONTS[font_path] = bpy.data.fonts.load(font_path)
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = s; cu.font = f; cu.size = 1.0; cu.extrude = extrude
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.resolution_u = res; cu.fill_mode = 'BOTH' if extrude else 'FRONT'
    o = bpy.data.objects.new('t', cu); bpy.context.scene.collection.objects.link(o)
    dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); me = e.to_mesh()
    import bmesh
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.dissolve_limit(bm, angle_limit=0.1, verts=bm.verts[:], edges=bm.edges[:]); bmesh.ops.triangulate(bm, faces=bm.faces[:])
    V = np.array([v.co[:] for v in bm.verts]); F = [tuple(v.index for v in f_.verts) for f_ in bm.faces]; bm.free()
    e.to_mesh_clear(); bpy.data.objects.remove(o); bpy.data.curves.remove(cu)
    return V, F, V[:, 0].max() - V[:, 0].min()

def carve(bd, text, cx, cy, cz, wfit, hfit, lod, col=GOLD, rz=0.0, font=None, mat=0, depth=0.03):
    deep = lod == 0 and depth >= 0.04   # [AAA] extruded relief only for the street marquee; signs indoors are flat cut faces standing proud of the board
    V, F, _ = text_mesh2(text, font or SIGN_FONT, extrude=depth if deep else 0.0, res=2 if lod == 0 else 1)
    if lod: V = V + [0, 0, 0.012]
    mn, mx = V.min(0), V.max(0); s = min(wfit / (mx[0] - mn[0]), hfit / (mx[1] - mn[1]))
    V = (V - [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, mn[2]]) * [s, s, 1]
    bd.mesh(V, F, col, m=Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(rz, 4, 'Z') @ FRONT, smooth=False, mat=mat)

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
    light(bd, x, y + out * 0.6, z + 0.05, 0.3, 2.6, lod); halo(bd, x, y + out * 0.32, z + 0.05, 0.9, lod)   # [AAA]

def rod(bd, p0, p1, r, col, n=6, mat=0):   # a round rod between two local points
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    if L < 1e-5: return
    q = d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bd.push(Matrix.Translation(p0) @ q); bd.cyl(r, r, L, 0, 0, 0, col, n=n); bd.pop()

def chandelier(bd, x, y, z, R, nc, zc, lod, I=0.75, reach=7.5):   # [AAA] gilded tiered chandelier: ceiling rose + chain, turned gilt column, S-scroll arms,
    # two candle rings with bobeches, crystal strands + swags (glints), a crown finial; baked light + flame halos for js/island/casino.js
    hi = lod == 0; n = 22 if hi else 8
    lathe(bd, [(0.0, -0.16), (0.12, -0.13), (0.3, -0.06), (0.38 * max(1, R), 0.0)], x, y, zc, GOLD_D, n=12 if hi else 6, caps=False)   # ceiling rose
    top = z + 1.0 * max(0.8, R / 1.2)
    if zc - 0.12 > top:
        bd.cyl(0.028, 0.028, zc - top, x, y, top, GOLD_D, n=6 if hi else 4, caps=False)
        if hi:
            zz = zc - 0.35
            while zz > top + 0.1: bd.sphere(0.045, x, y, zz, GOLD, sub=0, s=(1, 1, 1.4)); zz -= 0.45
    s_ = max(0.75, R / 1.2)
    lathe(bd, [(0.0, -0.62 * s_), (0.05 * s_, -0.58 * s_), (0.13 * s_, -0.42 * s_), (0.09 * s_, -0.26 * s_), (0.18 * s_, -0.1 * s_), (0.22 * s_, 0.02 * s_), (0.14 * s_, 0.16 * s_),
               (0.07 * s_, 0.38 * s_), (0.11 * s_, 0.55 * s_), (0.06 * s_, 0.78 * s_), (0.035 * s_, top - z)], x, y, z, GOLD, n=12 if hi else 6)
    if hi: crown(bd, x, y, top - 0.02, 0.22 * s_, lod)
    bd.torus(R, 0.045 * s_, x, y, z, GOLD_D, n=n, m_=4 if hi else 3)
    if hi: bd.torus(R * 0.72, 0.022, x, y, z - 0.08, GOLD_D, n=n, m_=3)
    for k in range(nc):
        a = k * 2 * math.pi / nc; ca, sa = math.cos(a), math.sin(a); cx, cy = x + R * ca, y + R * sa
        if hi:   # S-scroll arm: column -> a dip -> up to the bobeche
            p0 = (x + 0.16 * s_ * ca, y + 0.16 * s_ * sa, z + 0.02); p1 = (x + R * 0.5 * ca, y + R * 0.5 * sa, z - 0.14 * s_); p2 = (x + R * 0.86 * ca, y + R * 0.86 * sa, z - 0.05); p3 = (cx, cy, z + 0.03)
            rod(bd, p1, p3, 0.02 * s_, GOLD, n=4); rod(bd, p0, p1, 0.02 * s_, GOLD, n=3)
            lathe(bd, [(0.02, -0.02), (0.075, 0.0), (0.085, 0.025), (0.03, 0.04)], cx, cy, z + 0.02, GOLD, n=6, caps=False)
            bd.cyl(0.024, 0.024, 0.17, cx, cy, z + 0.06, BONE, n=5, caps=False)
            bd.box(0.03, 0.03, 0.05, cx, cy, z - 0.09, 0xe9f6ff, mat=1, rz=math.pi / 4)   # crystal drop
            nx_, ny_ = x + R * math.cos(a + math.pi / nc), y + R * math.sin(a + math.pi / nc)   # swag of crystal beads to the next arm
            for j in (1, 2): t = j / 3; aa = a + 2 * math.pi / nc * t; bd.box(0.022, 0.022, 0.022, x + R * math.cos(aa), y + R * math.sin(aa), z - 0.05 - 0.12 * math.sin(math.pi * t), 0xe9f6ff, mat=1, rx=math.pi / 4)
        else:
            bd.box(R, 0.035, 0.035, x + R / 2 * ca, y + R / 2 * sa, z, GOLD_D, rz=a)
        bd.box(0.05, 0.05, 0.11, cx, cy, z + (0.23 if hi else 0.12), FLAME, mat=1, base=True)
        halo(bd, cx, cy, z + 0.29, 0.55, lod)
    if hi:   # the upper ring
        R2 = R * 0.55; z2 = z + 0.42 * s_; bd.torus(R2, 0.03 * s_, x, y, z2, GOLD_D, n=14, m_=4)
        for k in range(max(4, nc // 2)):
            a = k * 2 * math.pi / max(4, nc // 2) + 0.3; cx, cy = x + R2 * math.cos(a), y + R2 * math.sin(a)
            bd.cyl(0.02, 0.02, 0.14, cx, cy, z2 + 0.05, BONE, n=6); bd.box(0.04, 0.04, 0.09, cx, cy, z2 + 0.19, FLAME, mat=1, base=True); halo(bd, cx, cy, z2 + 0.24, 0.45, lod)
        for k in range(8):   # a crystal fringe under the lower ring
            a = k * math.pi / 4 + 0.2; bd.sphere(0.03, x + R * 0.72 * math.cos(a), y + R * 0.72 * math.sin(a), z - 0.2, 0xe9f6ff, sub=0, mat=1, s=(1, 1, 1.8))
        bd.sphere(0.07 * s_, x, y, z - 0.68 * s_, 0xe9f6ff, sub=1, mat=1, s=(1, 1, 1.5))   # the drop
    light(bd, x, y, z + 0.1, I, reach, lod); pool(bd, x, y, 2.2 + R, 0.4, lod)

def barrel_(bd, x, y, z, lod, r=0.4, h=1.0, col=MAHOG_L, rx=0.0, rz=0.0):
    n = 12 if lod == 0 else 7; bd.push(T(x, y, z, rx=rx, rz=rz))
    bd.cyl(r * 0.85, r, h / 2, 0, 0, 0, col, n=n); bd.cyl(r, r * 0.85, h / 2, 0, 0, h / 2, col, n=n)
    for zz in ((0.12, 0.88) if lod else (0.1, 0.32, 0.68, 0.9)): bd.torus(r * (0.9 + 0.1 * (1 - abs(zz - 0.5) * 2)) + 0.012, 0.022, 0, 0, h * zz, IRON, n=n, m_=3)
    bd.pop()

def coins(bd, x, y, z, R, h, lod, rng):   # a heap of doubloons: a gold mound + loose coins
    bd.sphere(R, x, y, z, GOLD_D, sub=1 if lod == 0 else 0, s=(1, 1, h / R))   # [pass2] darker mound, bright coins on it (was a flat yellow pancake)
    if lod == 0:
        for i in range(14):
            a = rng.uniform(0, 6.283); rr = rng.uniform(0.1, 1.05) * R; bd.cyl(0.05, 0.05, 0.012, x + rr * math.cos(a), y + rr * math.sin(a), z + max(0.0, h * (1 - (rr / R) ** 2)) * 0.97, GOLD, n=7, rx=rng.uniform(-0.6, 0.6), ry=rng.uniform(-0.6, 0.6))

def gem(bd, x, y, z, col, s=0.06): bd.sphere(s, x, y, z, col, sub=0, s=(1, 1, 1.3))

def chest(bd, x, y, z, rz, lod, rng, open_=False, s=1.0):   # [pass2] iron-bound treasure chest (long axis local x): planked body, riveted bands,
    # corner irons, a barrel-vault lid (open: thrown back on its hinge, velvet lining, doubloons + gems), a gilt lock plate
    hi = lod == 0; WD, WDD = 0x6e3f1f, 0x4a2814; nl = 8 if hi else 4
    bd.push(T(x, y, z, rz=rz, s=s))
    bd.box(1.0, 0.62, 0.07, 0, 0, 0, WDD, base=True)
    bd.box(0.96, 0.58, 0.43, 0, 0, 0.07, WD, base=True)
    if hi:
        for zz in (0.205, 0.345): bd.box(0.966, 0.586, 0.01, 0, 0, zz, WDD, base=True)   # plank seams
        for sx in (-1, 1):
            for sy in (-1, 1): bd.box(0.07, 0.07, 0.44, sx * 0.47, sy * 0.28, 0.06, IRON, base=True)   # corner irons
    for xx in (-0.34, 0.0, 0.34):
        bd.box(0.06, 0.64, 0.45, xx, 0, 0.05, IRON, base=True)
    bd.box(1.0, 0.63, 0.035, 0, 0, 0.48, GOLD_D, base=True)   # gilt rim
    bd.box(0.15, 0.03, 0.19, 0, -0.315, 0.27, GOLD, base=True)
    if hi: bd.box(0.028, 0.01, 0.06, 0, -0.332, 0.33, BLACK, base=True)
    vault = [(0.31 * math.cos(math.pi * i / nl), 0.19 * math.sin(math.pi * i / nl)) for i in range(nl + 1)]
    def lid():
        bd.prism(vault, 1.0, 0x5e331a, T(0.5, 0, 0, rz=math.pi / 2))
        for xx in (-0.34, 0.0, 0.34): bd.prism([(1.07 * px, 1.1 * pz) for (px, pz) in vault], 0.06, IRON, T(xx + 0.03, 0, -0.002, rz=math.pi / 2))
    if open_:
        bd.push(T(0, 0.31, 0.515, rx=-1.95)); bd.push(T(0, -0.31, 0)); lid(); bd.box(0.9, 0.56, 0.012, 0, 0, -0.012, CRIM, base=True); bd.pop(); bd.pop()
        bd.box(0.9, 0.52, 0.02, 0, 0, 0.44, CRIM, base=True)
        coins(bd, 0, 0, 0.47, 0.42, 0.2, lod, rng)
        if hi:
            for (gx, gy_, c) in ((-0.2, -0.1, RUBY), (0.15, 0.08, EMER), (0.3, -0.12, SAPH), (-0.05, 0.12, RUBY)): gem(bd, gx, gy_, 0.62, c)
            bd.torus(0.12, 0.02, 0.32, 0.1, 0.6, 0xf4f1e8, n=10, m_=3, rx=0.5)   # pearl string
    else:
        bd.push(T(0, 0, 0.515)); lid(); bd.pop()
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
    # [pass2] BANKSY: the dealers' hands + forearms clipped into the tables: every table dealer stands 0.2 m further back (clear of the walls)
    bd.push(T(x, y + (0.2 if hat else 0.0), 0, rz=rz)); n = 10 if lod == 0 else 6
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


# ---------------- [AAA] BANKSY t214u-t216u: sculpting helpers (sweeps, lathes), light bookkeeping, marquee signs ----------------
LIGHTS = []        # baked light sources (building frame x, y, z, strength, reach): filled on the LOD0 pass, baked into the interior vertex colours
RECORD = True      # False while building the table kit (no dealer markers / lights / placements from kit-local geometry)
KIT = []           # table placements, three.js building frame: [kind, x, z, yaw]  (js/island/casino.js instances assets/island/casino_tables*.glb there)
POOLS = []         # soft floor light pools for js/island/casino.js (three frame): [x, z, radius, strength]
HALOS = []         # flame halos for js/island/casino.js (three frame): [x, y, z, size]
GLOW_G = 0xffd27a  # lit marquee lettering
BULB = 0xfff0c0
LEATH2 = 0x3b120c  # oxblood padded leather
LACQ = 0x1d2a22    # dark green lacquer (lamp hoods)
def light(bd, x, y, z, I, R, lod):   # a baked light at a local point of the current frame
    if lod != 0 or not RECORD: return
    p = bd.stack[-1] @ Vector((x, y, z)); LIGHTS.append((p.x, p.y, p.z, I, R))
def halo(bd, x, y, z, size, lod):
    if lod != 0 or not RECORD: return
    p = bd.stack[-1] @ Vector((x, y, z)); HALOS.append([round(p.x, 3), round(p.z, 3), round(-p.y, 3), size])
def pool(bd, x, y, r, I, lod):
    if lod != 0 or not RECORD: return
    p = bd.stack[-1] @ Vector((x, y, 0)); POOLS.append([round(p.x, 3), round(-p.y, 3), r, I])

def sweep(bd, path, prof, col, closed=False, mat=0, smooth=True, z0=0.0):
    # extrude a profile along a path in the current frame. path: [(x, y)] (CCW for closed loops); prof: [(u, v)] CCW in the
    # (u = outward offset along the path's right-hand normal, v = height) plane -> outward-facing quads
    n, m = len(path), len(prof); V = []; F = []
    for i in range(n):
        p = path[i]
        a = path[(i - 1) % n] if (closed or i > 0) else p; b = path[(i + 1) % n] if (closed or i < n - 1) else p
        tx, ty = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, ty) or 1.0; tx, ty = tx / L, ty / L
        nx, ny = ty, -tx
        for (u, v) in prof: V.append((p[0] + nx * u, p[1] + ny * u, z0 + v))
    for i in range(n if closed else n - 1):
        i2 = (i + 1) % n
        for j in range(m - 1): F.append((i * m + j, i2 * m + j, i2 * m + j + 1, i * m + j + 1))
    bd.mesh(V, F, col, mat=mat, smooth=smooth)

def lathe(bd, prof, x, y, z, col, n=12, mat=0, smooth=True, caps=True):   # turned part: prof [(r, h)] bottom -> top up the outside
    V = []; F = []; m = len(prof)
    for (r, h) in prof:
        for i in range(n): a = 2 * math.pi * i / n; V.append((x + r * math.cos(a), y + r * math.sin(a), z + h))
    for j in range(m - 1):
        for i in range(n): F.append((j * n + i, j * n + (i + 1) % n, (j + 1) * n + (i + 1) % n, (j + 1) * n + i))
    if caps:
        if prof[0][0] > 1e-4: F.append(tuple(range(n - 1, -1, -1)))
        if prof[-1][0] > 1e-4: F.append(tuple(range((m - 1) * n, m * n)))
    bd.mesh(V, F, col, mat=mat, smooth=smooth)

def tube(u0, v0, ru, rv, k):   # a closed elliptic profile (CCW) for sweep(): padded bumpers, rods, beads
    pts = [(u0 + ru * math.cos(-math.pi / 2 + 2 * math.pi * i / k), v0 + rv * math.sin(-math.pi / 2 + 2 * math.pi * i / k)) for i in range(k)]
    return pts + [pts[0]]

def arc(R, a0, a1, n, cx=0.0, cy=0.0):   # CCW arc points
    return [(cx + R * math.cos(a0 + (a1 - a0) * i / n), cy + R * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]

def rrect(hx, hy, r, k=4):   # rounded rectangle, CCW seen from above
    pts = []
    for (cx, cy, a0) in ((hx - r, -hy + r, -math.pi / 2), (hx - r, hy - r, 0.0), (-hx + r, hy - r, math.pi / 2), (-hx + r, -hy + r, math.pi)):
        for i in range(k + 1): a = a0 + (math.pi / 2) * i / k; pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def bulbs(bd, x0, x1, z0, z1, y, step, lod, r=0.035):   # a marquee bulb frame (glow) round a sign face on a plane facing -y
    if lod != 0: return
    nx_, nz_ = max(2, int(round((x1 - x0) / step))), max(1, int(round((z1 - z0) / step)))
    pts = [(x0 + (x1 - x0) * i / nx_, z) for i in range(nx_ + 1) for z in (z0, z1)] + [(x, z0 + (z1 - z0) * j / nz_) for j in range(1, nz_) for x in (x0, x1)]
    o = r * 1.15; OV = [(o, 0, 0), (-o, 0, 0), (0, o, 0), (0, -o, 0), (0, 0, o), (0, 0, -o)]; OF = [(0, 2, 4), (2, 1, 4), (1, 3, 4), (3, 0, 4), (2, 0, 5), (1, 2, 5), (3, 1, 5), (0, 3, 5)]
    for (bx, bz) in pts: bd.mesh(OV, OF, BULB, m=T(bx, y, bz), mat=1, smooth=False)   # [pass2] octahedral bulbs (file size)

def sign_board(bd, text, x, y, z, w, h, lod, rz=0.0, sub=None, lit=True, board=MAHOG_D):
    # [AAA] a carved + gilded marquee board on a wall plane (local -y = into the room): layered gilt frame, corner rosettes,
    # crest scroll, lit gold lettering (glow) at its true proportions (uniform fit: never stretched), a frame of marquee bulbs
    hi = lod == 0
    bd.push(T(x, y, z, rz=rz))
    bd.box(w, 0.1, h, 0, -0.05, 0, board)
    bd.box(w - 0.1, 0.008, h - 0.1, 0, -0.103, 0, 0x160604)   # [pass2] near-black inner plate: the lit letters read from across the hall
    for zz in (-h / 2 - 0.04, h / 2 + 0.04): bd.box(w + 0.2, 0.14, 0.09, 0, -0.08, zz, GOLD_D)
    for xx in (-w / 2 - 0.05, w / 2 + 0.05): bd.box(0.1, 0.14, h + 0.17, xx, -0.08, 0, GOLD_D)
    if hi:
        for zz in (-h / 2 + 0.05, h / 2 - 0.05): bd.box(w - 0.1, 0.04, 0.025, 0, -0.115, zz, GOLD)
        for xx in (-w / 2 + 0.05, w / 2 - 0.05): bd.box(0.025, 0.04, h - 0.1, xx, -0.115, 0, GOLD)
        for sx in (-1, 1):
            for sz in (-1, 1): bd.cyl(0.07, 0.05, 0.06, sx * (w / 2 + 0.05), -0.15, sz * (h / 2 + 0.04), GOLD, n=8, rx=math.pi / 2)
        # crest: a scroll pediment with a doubloon over the board
        bd.prism([(-0.55, 0), (0.55, 0), (0.35, 0.16), (0.0, 0.26), (-0.35, 0.16)], 0.1, GOLD_D, T(0, -0.13, h / 2 + 0.08))
        bd.cyl(0.13, 0.11, 0.06, 0, -0.17, h / 2 + 0.3, GOLD, n=12, rx=math.pi / 2)
        for sx in (-1, 1): bd.prism([(0, 0), (0.28, 0.0), (0.18, 0.12)], 0.08, GOLD_D, T(sx * (w / 2 - 0.1), -0.12, h / 2 + 0.08, rz=0 if sx > 0 else math.pi))
    if lit: bulbs(bd, -w / 2 - 0.05, w / 2 + 0.05, -h / 2 - 0.16, h / 2 + 0.16, -0.17, 0.38, lod)
    bd.pop()
    c, s_ = math.cos(rz), math.sin(rz); fy = 0.11
    if sub:
        carve(bd, text, x + fy * s_, y - fy * c, z + h * 0.11, w - 0.3, h * 0.56, lod, col=GLOW_G if lit else GOLD, rz=rz, mat=1 if lit else 0, depth=0.025)   # [pass2] larger
        carve(bd, sub, x + fy * s_, y - fy * c, z - h * 0.3, w * 0.62, h * 0.19, lod, col=GOLD, rz=rz, depth=0.015)
    else:
        carve(bd, text, x + fy * s_, y - fy * c, z, w - 0.3, h - 0.2, lod, col=GLOW_G if lit else GOLD, rz=rz, mat=1 if lit else 0, depth=0.025)
    if lit:
        light(bd, x + 0.6 * s_, y - 0.6 * c, z, 0.16, 2.6, lod)

class NullBuilder(Builder):   # walks a table builder only for its transforms (dealer markers): no geometry
    def _add(self, V, F, col, mat=0, smooth=False, corner_cols=None, m=None, lib=None, grain=None):
        A = np.array(self.stack[-1] @ (m or Matrix.Identity(4))); return np.asarray(V, float) @ A[:3, :3].T + A[:3, 3]

def light_bake(me, lights, inside, amb, warm_k=(0.0, 0.07, 0.17), lo=0.4, hi_=1.45):
    # [AAA] baked interior lighting: per corner = colour x (ambient by height + every light's falloff x a lambert term), warm tint where lit.
    # Glow faces (material 1) are left alone. Cheap at runtime: it is just the vertex colours (phones get it too).
    nl = len(me.loops); vi = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', vi)
    co = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', co); P = co.reshape(-1, 3)[vi]
    npl = len(me.polygons); lt = np.empty(npl, np.int32); me.polygons.foreach_get('loop_total', lt)
    pn = np.empty(npl * 3); me.polygons.foreach_get('normal', pn); mi = np.empty(npl, np.int32); me.polygons.foreach_get('material_index', mi)
    pl = np.repeat(np.arange(npl), lt); N = pn.reshape(-1, 3)[pl]; glow = mi[pl] == 1
    ca = me.color_attributes['Col']; C = np.empty(nl * 4); ca.data.foreach_get('color_srgb', C); C = C.reshape(-1, 4)
    m = inside(P) & ~glow; k = amb(P); w = np.zeros(nl)
    for (x, y, z, I, R) in lights:
        D = np.array([x, y, z]) - P; d = np.linalg.norm(D, axis=1) + 1e-6; f = np.clip(1 - d / R, 0, 1) ** 2
        lam = np.clip((D * N).sum(1) / d, 0, 1); add = I * f * (0.2 + 0.8 * lam); k = k + add; w = w + add
    k = np.clip(k, lo, hi_); wc = np.clip(w, 0, 1)
    tint = np.stack([1 - warm_k[0] * wc, 1 - warm_k[1] * wc, 1 - warm_k[2] * wc], 1)
    C[m, :3] = np.clip(C[m, :3] * k[m, None] * tint[m], 0, 1)
    ca.data.foreach_set('color_srgb', C.ravel())
    return int(m.sum())

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
    # [AAA] the marquee signboard: lacquered board, layered gilt frame + rosettes, scroll ends, lit gold capitals (glow), a frame of bulbs
    sgw, sgh, sz0 = 8.6, 1.2, 4.58; sy = FY - 0.36
    bd.box(sgw, 0.16, sgh, 0, sy, sz0, MAHOG_D, base=True)
    for zz in (sz0 - 0.08, sz0 + sgh - 0.05): bd.box(sgw + 0.34, 0.26, 0.13, 0, sy - 0.05, zz, GOLD_D, base=True)
    for xx in (-sgw / 2 - 0.09, sgw / 2 + 0.09): bd.box(0.2, 0.26, sgh + 0.21, xx, sy - 0.05, sz0 - 0.08, GOLD_D, base=True)
    if hi:
        for zz in (sz0 + 0.1, sz0 + sgh - 0.13): bd.box(sgw - 0.3, 0.03, 0.03, 0, sy - 0.095, zz, GOLD)
        for xx in (-sgw / 2 + 0.16, sgw / 2 - 0.16): bd.box(0.03, 0.03, sgh - 0.26, xx, sy - 0.095, sz0 + 0.13, GOLD, base=True)
        for xx in (-sgw / 2 - 0.09, sgw / 2 + 0.09):
            for zz in (sz0 - 0.02, sz0 + sgh + 0.02): bd.cyl(0.11, 0.11, 0.06, xx, sy - 0.2, zz, GOLD, n=12, rx=math.pi / 2); bd.sphere(0.05, xx, sy - 0.24, zz, GOLD, sub=0)
        for s in (-1, 1): bd.prism([(0, 0), (0.6, -0.2), (0.6, 0.2)], 0.08, GOLD_D, T(s * (sgw / 2 + 0.19), sy - 0.02, sz0 + sgh / 2, rz=0 if s > 0 else math.pi))   # pointed scroll ends
    carve(bd, 'THE GOLDEN DOUBLOON', 0, sy - 0.1, sz0 + sgh / 2, sgw - 0.95, sgh - 0.42, lod, col=GLOW_G, mat=1, depth=0.045)
    bulbs(bd, -sgw / 2 - 0.09, sgw / 2 + 0.09, sz0 - 0.2, sz0 + sgh + 0.1, sy - 0.22, 0.33, lod, r=0.05)
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
    for px in ((-6.7, -5.6, 5.6, 6.7) if hi else (-6.7, 6.7)):   # stone corbels ([AAA] clear of the marquee sign)
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
    carve(bd, 'CASINO', 0, FY - 0.22, uz1 + 0.63, 2.5, 0.46, lod, col=GLOW_G, mat=1, depth=0.035)   # [AAA] lit marquee capitals
    bulbs(bd, -1.66, 1.66, uz1 + 0.22, uz1 + 1.04, FY - 0.3, 0.28, lod, r=0.04)
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


# ---------------- [pass2] BANKSY 3:09 PM "another pass on casino": floors, panelling, wall art, the vault display ----------------
CHAIR = [(0.0, 0.0), (0.028, 0.0), (0.045, 0.018), (0.034, 0.038), (0.052, 0.058), (0.036, 0.085), (0.0, 0.1)]   # moulded chair rail (u out, v up)
BEAD = [(0.0, 0.0), (0.018, 0.006), (0.024, 0.02), (0.018, 0.034), (0.0, 0.04)]

def boards(bd, x0, x1, y0, y1, hi, rng):   # polished strip floor: staggered butt joints (1.2 .. 2.6 m boards), a tone per board, the cas_wood grain
    iw = x1 - x0; cym = (y0 + y1) / 2
    if not hi:
        for i in range(5): bd.box(iw / 5, y1 - y0, 0.1, x0 + (i + 0.5) * iw / 5, cym, FLOOR - 0.1, FLOORS[i % 3], base=True, mat='cas_wood')
        return
    bd.box(iw, y1 - y0, 0.1, (x0 + x1) / 2, cym, FLOOR - 0.104, 0x1a0e07, base=True)   # the dark sub-floor that shows in the joints
    n = int(iw / 0.26); w = iw / n; r2 = random.Random(4711)
    for i in range(n):   # top faces only (file size): the joints are the gaps
        x = x0 + (i + 0.5) * w; y = y0 - r2.uniform(0.0, 2.0); xa, xb = x - w / 2 + 0.004, x + w / 2 - 0.004
        while y < y1:
            L = r2.uniform(1.2, 2.6); ya, yb = max(y0, y) + 0.003, min(y1, y + L) - 0.003
            if yb - ya > 0.05: bd.mesh([(xa, ya, FLOOR), (xb, ya, FLOOR), (xb, yb, FLOOR), (xa, yb, FLOOR)], [(0, 1, 2, 3)], hexc(FLOORS[r2.randrange(3)], 0.08, rng), smooth=False, mat='cas_wood')
            y += L

def straight(bd, L, y, prof, col, z0, smooth=False):   # a moulding run along local x (u = out of the wall, toward local -y)
    sweep(bd, [(-L / 2, y), (L / 2, y)], prof, col, z0=z0, smooth=smooth)

def fielded(bd, xc, zc, fw, fh, y=-0.06, bead=True):   # a raised-and-fielded panel facing local -y: sunk margin, field, raised centre, gilt bead
    bd.box(fw + 0.03, 0.016, fh + 0.03, xc, y - 0.006, zc - 0.015, GOLD_D if bead else MAHOG_D, base=True)   # gilt bead round the field
    bd.box(fw, 0.022, fh, xc, y - 0.012, zc, MAHOG_L, base=True)
    if fw > 0.3 and fh > 0.3: bd.box(fw - 0.16, 0.014, fh - 0.16, xc, y - 0.027, zc + 0.08, MAHOG, base=True)

def wainscot(bd, L, hi, top=1.3):   # mahogany dado (current frame: wall plane y = 0, local -y = into the room, x along the wall)
    bd.box(L, 0.08, top, 0, -0.02, FLOOR, MAHOG, base=True)
    bd.box(L, 0.1, 0.16, 0, -0.035, FLOOR, MAHOG_D, base=True)   # skirting
    if not hi:
        bd.box(L, 0.12, 0.08, 0, -0.05, top - 0.04, MAHOG_D, base=True); return
    straight(bd, L, -0.06, CHAIR, MAHOG_D, top - 0.07)
    straight(bd, L, -0.085, BEAD, GOLD_D, FLOOR + 0.16)
    n = max(1, int(round(L / 0.95))); pw = L / n
    for k in range(n):
        fw = pw - 0.18
        if fw > 0.2: fielded(bd, -L / 2 + (k + 0.5) * pw, FLOOR + 0.26, fw, top - 0.48)

def display_plinth(bd, x0, x1, y0, y1, lod):   # the treasure display: panelled mahogany plinth, gilt corner posts + edge, crimson velvet top -> top z
    hi = lod == 0; cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; W_, D_ = x1 - x0, y1 - y0; TOP = 0.74
    bd.box(W_ - 0.04, D_ - 0.04, 0.1, cx, cy, FLOOR, MAHOG_D, base=True)
    bd.box(W_ - 0.2, D_ - 0.2, 0.52, cx, cy, FLOOR + 0.1, MAHOG, base=True)
    bd.box(W_, D_, 0.08, cx, cy, FLOOR + 0.62, MAHOG_L, base=True)
    bd.box(W_ + 0.02, D_ + 0.02, 0.025, cx, cy, FLOOR + 0.66, GOLD_D, base=True)
    bd.box(W_ - 0.16, D_ - 0.16, 0.03, cx, cy, FLOOR + 0.7, CRIM, base=True, mat='cas_carpet')
    for sx in (-1, 1):
        for sy in (-1, 1): bd.box(0.1, 0.1, 0.52, cx + sx * (W_ / 2 - 0.12), cy + sy * (D_ / 2 - 0.12), FLOOR + 0.1, GOLD_D, base=True)
    if hi:   # raised panels on the two faces that show (the room side + the aisle end)
        for (fx, fy_, rz_, L) in ((x1 - 0.1, cy, math.pi / 2, D_ - 0.44), (cx, y1 - 0.1, math.pi, W_ - 0.44)):
            bd.push(T(fx, fy_, 0, rz=rz_)); n = max(1, int(round(L / 0.8))); pw = L / n
            for k in range(n): fielded(bd, -L / 2 + (k + 0.5) * pw, FLOOR + 0.17, pw - 0.12, 0.38, y=0.0)
            bd.pop()
    return FLOOR + TOP

def frame_rect(bd, hx, hy, prof, col):   # a mitred picture frame round a (2 hx x 2 hy) opening in local XZ, profile (u out from the opening edge, v toward -y)
    C = [(-hx, -hy), (hx, -hy), (hx, hy), (-hx, hy)]
    for i in range(4):
        a, b = C[i], C[(i + 1) % 4]; d = ((b[0] - a[0]) / (2 * (hx if i % 2 == 0 else hy)), (b[1] - a[1]) / (2 * (hx if i % 2 == 0 else hy))); nrm = (d[1], -d[0])
        V = []; F = []; m = len(prof)
        for (P0, sg) in ((a, -1), (b, 1)):
            for (u, v) in prof: V.append((P0[0] + nrm[0] * u + sg * d[0] * u, -v, P0[1] + nrm[1] * u + sg * d[1] * u))
        for j in range(m - 1): F.append((j, j + 1, m + j + 1, m + j))
        bd.mesh(V, F, col, smooth=False)

FRAME = [(-0.03, 0.035), (0.0, 0.05), (0.03, 0.085), (0.07, 0.1), (0.1, 0.075), (0.13, 0.09), (0.16, 0.06), (0.17, 0.0)]

def _n2(u, v, k):   # cheap smooth value noise for the painted canvases
    return 0.5 + 0.25 * math.sin(u * 7.1 * k + v * 3.3) * math.cos(v * 9.7 * k - u * 2.1) + 0.25 * math.sin((u + v) * 13.0 * k + 1.7)

def canvas_col(var, u, v):   # sRGB 0..1 at canvas point (u, v in 0..1, v up)
    mix = lambda a, b, t: [a[i] + (b[i] - a[i]) * max(0.0, min(1.0, t)) for i in range(3)]
    n = _n2(u, v, 1.0); hz = 0.36 + 0.015 * math.sin(u * 9.0)
    if var == 3:   # a treasure chart on parchment: a coastline, shoals, burnt edges
        d = math.hypot((u - 0.46) * 1.3, (v - 0.5) * 1.6) + 0.07 * math.sin(u * 17 + v * 5) + 0.05 * math.cos(v * 13)
        c = mix([0.6, 0.66, 0.58], [0.66, 0.58, 0.36], (0.42 - d) * 30)
        if 0.4 < d < 0.47: c = mix(c, [0.48, 0.55, 0.52], 0.5)
        e = min(u, 1 - u, v, 1 - v); c = mix([0.36, 0.22, 0.1], c, e * 9)
        return [ci * (0.92 + 0.12 * n) for ci in c]
    if v > hz:   # sky
        t = (v - hz) / (1 - hz)
        if var == 0: c = mix([1.0, 0.66, 0.3], [0.86, 0.42, 0.36], t * 1.8) if t < 0.55 else mix([0.86, 0.42, 0.36], [0.2, 0.22, 0.42], (t - 0.55) * 2.2)
        elif var == 1: c = mix([0.42, 0.44, 0.42], [0.16, 0.18, 0.21], t); c = mix(c, [0.78, 0.76, 0.66], max(0.0, 0.5 - math.hypot(u - 0.22, v - 0.86) * 2.4))
        else: c = mix([0.2, 0.25, 0.4], [0.04, 0.06, 0.16], t * 1.3)
        sx, sy = ((0.7, hz + 0.08), (0.3, 0.9), (0.72, 0.78))[var]
        g = max(0.0, 1 - math.hypot((u - sx) * 1.6, v - sy) * (2.6 if var != 1 else 4.0))
        c = mix(c, ([1.0, 0.86, 0.55], [0.9, 0.9, 0.82], [0.72, 0.78, 0.9])[var], g * (0.85 if var == 0 else 0.5))
        c = [ci * (0.9 + 0.16 * n) for ci in c]   # brushy clouds
    else:   # sea
        t = (hz - v) / hz
        c = mix(([0.12, 0.24, 0.3], [0.12, 0.22, 0.2], [0.05, 0.08, 0.14])[var], ([0.04, 0.1, 0.13], [0.05, 0.1, 0.09], [0.02, 0.03, 0.07])[var], t)
        sx = (0.7, 0.3, 0.72)[var]; glint = max(0.0, 1 - abs(u - sx) * (5.0 - 3.0 * t)) * (1 - t) * (0.5 + 0.5 * math.sin(v * 90.0))
        c = mix(c, ([1.0, 0.75, 0.4], [0.7, 0.74, 0.7], [0.75, 0.8, 0.92])[var], glint * 0.7)
        if var == 1: c = mix(c, [0.5, 0.58, 0.55], max(0.0, math.sin(v * 40.0 + 3 * math.sin(u * 11)) - 0.6) * 0.8)   # rolling swell
        c = [ci * (0.92 + 0.12 * n) for ci in c]
    return c

def galleon(bd, x, z, s, dark=False, tilt=0.0):   # a painted three-master on the canvas plane (local XZ, y = -0.032)
    H, SL, FL = (0x1a120e, 0x2a2420, 0x1a120e) if dark else (0x3a2214, 0xeadcbc, 0xb02a24)
    bd.push(T(x, -0.032, z, ry=tilt, s=s))
    bd.prism([(-0.5, 0.0), (0.42, 0.0), (0.6, 0.2), (-0.62, 0.24), (-0.55, 0.13)], 0.004, H, T(0, 0, 0))
    for (mx, mh) in ((-0.28, 0.85), (0.05, 1.0), (0.34, 0.75)):
        bd.box(0.025, 0.004, mh, mx, 0, 0.18, H, base=True)
        for (zz, w) in ((0.32, 0.36), (0.6, 0.3)):
            if zz + 0.24 < mh + 0.18: bd.box(w * (mh / 1.0), 0.004, 0.22, mx, -0.002, zz, SL, base=True)
        bd.box(0.08, 0.004, 0.04, mx + 0.05, -0.002, mh + 0.15, FL, base=True)
    bd.prism([(0.6, 0.2), (0.95, 0.32), (0.6, 0.24)], 0.004, H, T(0, 0, 0))   # bowsprit
    bd.pop()

def painting(bd, x, y, z, pw, ph, var, lod):   # a gilt-framed oil seascape / chart on a wall plane facing -y (vertex-colour canvas + painted motifs)
    hi = lod == 0
    bd.push(T(x, y, z))
    nu, nv = (10, 6) if hi else (3, 2)
    V = []; F = []; CC = []
    for j in range(nv + 1):
        for i in range(nu + 1): V.append(((i / nu - 0.5) * pw, -0.03, (j / nv - 0.5) * ph))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i; f = (a, a + 1, a + nu + 2, a + nu + 1); F.append(f)
            CC.append([canvas_col(var, (V[q][0] / pw) + 0.5, (V[q][2] / ph) + 0.5) for q in f])
    bd.mesh(V, F, None, corner_cols=CC, smooth=False)
    bd.box(pw + 0.04, 0.03, ph + 0.04, 0, -0.012, -ph / 2 - 0.02, 0x2a1408, base=True)   # stretcher shadow behind the canvas
    hz = (0.36 - 0.5) * ph
    if not hi: pass
    elif var == 0:
        bd.cyl(0.07 * ph, 0.07 * ph, 0.003, 0.2 * pw, -0.031, hz + 0.08 * ph, 0xfff0c8, n=14 if hi else 6, rx=math.pi / 2)
        galleon(bd, -0.12 * pw, hz - 0.03 * ph, 0.36 * ph)
    elif var == 1:
        galleon(bd, 0.05 * pw, hz - 0.04 * ph, 0.4 * ph, tilt=0.12)
        if hi: bd.prism([(0, 0), (0.04, 0.0), (-0.03, -0.12), (0.02, -0.12), (-0.05, -0.3), (0.0, -0.13), (-0.04, -0.13)], 0.003, 0xf0f0e0, T(0.32 * pw, -0.031, 0.42 * ph))   # lightning
    elif var == 2:
        bd.cyl(0.06 * ph, 0.06 * ph, 0.003, 0.22 * pw, -0.031, 0.28 * ph, 0xf4f0dc, n=14 if hi else 6, rx=math.pi / 2)
        bd.prism([(-0.5 * pw, hz), (-0.32 * pw, hz + 0.1 * ph), (-0.2 * pw, hz + 0.14 * ph), (-0.08 * pw, hz + 0.06 * ph), (0.0, hz)][::-1], 0.003, 0x0a0c14, T(0, -0.031, 0))   # headland
        bd.box(0.025 * pw, 0.003, 0.16 * ph, -0.2 * pw, -0.032, hz + 0.13 * ph, 0x1a1a22, base=True)
        bd.box(0.035 * pw, 0.003, 0.03 * ph, -0.2 * pw, -0.033, hz + 0.29 * ph, 0xffe08a, base=True)   # lighthouse lamp
        galleon(bd, 0.12 * pw, hz - 0.02 * ph, 0.3 * ph, dark=True)
    else:
        bd.box(0.06 * ph, 0.003, 0.012 * ph, 0.12 * pw, -0.032, 0.0, 0xb01e1e, rz=0, ry=0.78)
        bd.box(0.06 * ph, 0.003, 0.012 * ph, 0.12 * pw, -0.032, 0.0, 0xb01e1e, ry=-0.78)
        if hi:
            for k in range(7): bd.box(0.02 * ph, 0.003, 0.008 * ph, -0.3 * pw + k * 0.06 * pw, -0.032, -0.2 * ph + 0.03 * ph * math.sin(k), 0x7a2a1a)
        compass(bd, -0.36 * pw, -0.034, 0.28 * ph, 0.11 * ph, lod, flat=True)
    if hi:
        frame_rect(bd, pw / 2, ph / 2, FRAME, GOLD_D)
        frame_rect(bd, pw / 2 + 0.02, ph / 2 + 0.02, [(-0.02, 0.035), (0.0, 0.045), (0.015, 0.04)], GOLD)   # gilt slip
        for sx in (-1, 1):
            for sz in (-1, 1): bd.box(0.1, 0.05, 0.1, sx * (pw / 2 + 0.1), -0.1, sz * (ph / 2 + 0.1), GOLD, ry=math.pi / 4)
        bd.prism([(-0.28, 0.0), (0.28, 0.0), (0.16, 0.1), (0.0, 0.16), (-0.16, 0.1)], 0.05, GOLD_D, T(0, -0.1, ph / 2 + 0.16))   # crest
        # brass picture light
        bd.box(min(0.9, pw * 0.55), 0.09, 0.05, 0, -0.2, ph / 2 + 0.3, BRASS); bd.box(min(0.86, pw * 0.53), 0.05, 0.012, 0, -0.2, ph / 2 + 0.27, GLOW, mat=1)
        for sx in (-0.2, 0.2): bd.box(0.02, 0.2, 0.02, sx, -0.1, ph / 2 + 0.33, BRASS)
    else:
        for zz in (-ph / 2 - 0.06, ph / 2 + 0.06): bd.box(pw + 0.24, 0.08, 0.12, 0, -0.06, zz, GOLD_D)
        for xx in (-pw / 2 - 0.06, pw / 2 + 0.06): bd.box(0.12, 0.08, ph, xx, -0.06, 0, GOLD_D)
    bd.pop()
    p = bd.stack[-1] @ Vector((x, y - 0.6, z + 0.2))
    if lod == 0 and RECORD: LIGHTS.append((p.x, p.y, p.z, 0.22, 1.6))

def compass(bd, x, y, z, R, lod, flat=False):   # a gilded compass-rose medallion on a wall plane facing -y (flat: painted on a chart)
    hi = lod == 0; n = 20 if hi else 10; yy = y
    if not flat:
        bd.cyl(R * 1.08, R * 1.08, 0.04, x, y, z, MAHOG_D, n=n, rx=math.pi / 2)
        bd.torus(R, 0.07 * R, x, y - 0.04, z, GOLD_D, n=n, m_=3, rx=math.pi / 2)
        if hi:
            bd.cyl(R * 0.86, R * 0.86, 0.008, x, y - 0.04, z, GOLD, n=n, rx=math.pi / 2, caps=True)
            for k in range(8): t = k * math.pi / 4 + math.pi / 8; bd.box(0.014, 0.01, 0.08 * R, x + 0.9 * R * math.sin(t), y - 0.045, z + 0.9 * R * math.cos(t), GOLD, ry=t)
        yy = y - 0.05
    cl, cs = (0x7a2a1a, 0x3a2414) if flat else (GOLD, GOLD_D)
    for k in range(8 if hi else 4):
        t = k * math.pi / (4 if hi else 2); L_ = 0.82 if k % 2 == 0 or not hi else 0.5; w_ = 0.13 if k % 2 == 0 else 0.1
        bd.prism([(-w_ * R, 0.0), (0.0, L_ * R), (w_ * R, 0.0)][::-1], 0.03 if not flat else 0.002, cl if k % 2 == 0 else cs, T(x, yy, z, ry=t))
    if not flat:
        bd.cyl(0.12 * R, 0.08 * R, 0.05, x, yy - 0.02, z, GOLD, n=10 if hi else 6, rx=math.pi / 2)
        if hi: bd.sphere(0.05 * R + 0.02, x, yy - 0.04, z + 0.98 * R, RUBY, sub=0)

# the wall bays (building frame): wall plane point + facing (local -y = into the room) + bay width + what hangs there
HALL_ART = [((IX0 + 0.03, y_, math.pi / 2), w_, k_, v_) for (y_, w_, k_, v_) in ((-5.075, 2.5, 'compass', 0), (-1.0, 4.0, 'painting', 0), (4.125, 4.6, 'painting', 1))] + \
           [((IX1 - 0.03, y_, -math.pi / 2), w_, k_, v_) for (y_, w_, k_, v_) in ((-5.075, 2.5, 'compass', 0), (-1.0, 4.0, 'painting', 2), (4.125, 4.6, 'painting', 3))]
WING_ART = [((WIX0 + 0.03, y_, math.pi / 2), w_, 'painting', v_) for (y_, w_, v_) in ((10.575, 3.7, 1), (16.825, 2.9, 3), (22.35, 2.5, 0), (27.9, 3.7, 2))] + \
           [((WIX1 - 0.03, y_, -math.pi / 2), w_, 'painting', v_) for (y_, w_, v_) in ((10.575, 3.7, 0), (16.825, 2.9, 2), (22.35, 2.5, 1), (27.9, 3.7, 3))] + \
           [((sx * 5.15, WIY1 - 0.03, 0.0), 3.4, 'painting', v_) for (sx, v_) in ((-1, 2), (1, 0))] 

def wall_art(bd, lod):   # gilt panel mouldings on the damask (desktop), an oil painting or a compass medallion in each
    hi = lod == 0
    for ((wx, wy, rz_), bw, kind, var) in HALL_ART + WING_ART:
        bd.push(T(wx, wy, 0, rz=rz_))
        if hi and bw > 0:
            z0, z1 = 1.62, 4.22
            for (ins, t) in ((0.0, 0.05),):
                pw_ = bw - 2 * ins
                for zz in (z0 + ins, z1 - ins - t): bd.box(pw_, 0.03, t, 0, -0.035, zz, GOLD_D, base=True)
                for xx in (-pw_ / 2 + t / 2, pw_ / 2 - t / 2): bd.box(t, 0.03, z1 - z0 - 2 * ins, xx, -0.035, z0 + ins, GOLD_D, base=True)
            for sx in (-1, 1):
                for zz in (z0 + 0.025, z1 - 0.025): bd.box(0.09, 0.03, 0.09, sx * (bw / 2 - 0.025), -0.05, zz, GOLD, ry=math.pi / 4)   # corner rosettes
        if kind == 'painting':
            pw_ = min(bw - 0.75, 2.5); ph_ = min(1.35, pw_ * 0.62); painting(bd, 0, -0.02, 2.95, pw_, ph_, var, lod)
        else:
            compass(bd, 0, -0.02, 2.95 if bw > 0 else 2.8, 0.42 if bw > 0 else 0.34, lod)
        bd.pop()

# ---------------- the interior: the gaming hall ----------------
def interior(bd, lod, rng, cols):
    hi = lod == 0
    iw, idp = IX1 - IX0, IY1 - IY0; cxm, cym = (IX0 + IX1) / 2, (IY0 + IY1) / 2
    # dark plank floor (+ through the arch to the threshold)
    boards(bd, IX0, IX1, IY0, IY1, hi, rng)   # [pass2] staggered polished boards
    bd.box(ARCH_W, WT, 0.1, 0, Y0 + WT / 2, FLOOR - 0.1, FLOORS[1], base=True)
    # crimson + gold runner from the arch to the rum bar, a round doubloon rug at the crossing
    ry0, ry1 = Y0 - 0.1, Y1
    bd.box(2.0, ry1 - ry0, 0.012, 0, (ry0 + ry1) / 2, FLOOR, CRIM, base=True, mat='cas_carpet')
    for s in (-1, 1): bd.box(0.1, ry1 - ry0, 0.014, s * 0.88, (ry0 + ry1) / 2, FLOOR, GOLD_D, base=True)
    if hi:
        for s in (-1, 1): bd.box(0.03, ry1 - ry0, 0.016, s * 0.75, (ry0 + ry1) / 2, FLOOR, GOLD, base=True)
    RY = 0.05   # [AAA] the doubloon rug sits under the grand chandelier
    bd.cyl(1.8, 1.8, 0.016, 0, RY, FLOOR + 0.002, CRIM, n=24 if hi else 10, mat='cas_carpet')
    bd.torus(1.68, 0.04, 0, RY, FLOOR + 0.02, GOLD_D, n=24 if hi else 10, m_=3)
    bd.cyl(0.85, 0.85, 0.02, 0, RY, FLOOR + 0.004, GOLD_D, n=20 if hi else 8)
    bd.cyl(0.7, 0.7, 0.024, 0, RY, FLOOR + 0.006, GOLD, n=20 if hi else 8)
    if hi:
        for k in range(8):   # compass-rose points round the doubloon
            t = k * math.pi / 4; bd.prism([(-0.1, 0), (0.1, 0), (0, 0.5)], 0.01, GOLD_D, T(0.85 * math.cos(t), RY + 0.85 * math.sin(t), FLOOR + 0.026, rz=t - math.pi / 2) @ Matrix.Rotation(-math.pi / 2, 4, 'X'))
        bd.push(T(0, RY, FLOOR + 0.03)); bd.box(0.8, 0.1, 0.03, 0, -0.16, 0, GOLD_D)
        for k in range(5): px = -0.3 + k * 0.15; h = 0.26 if k in (0, 4) else 0.34 if k != 2 else 0.42; bd.prism([(-0.06, 0), (0.06, 0), (0, h)], 0.02, GOLD_D, T(px, -0.12, 0, rx=-math.pi / 2))
        bd.pop()
    # walls inside: [AAA] the raised hall: mahogany wainscot, crimson damask, a gilt entablature at 4.5 m, framed upper panels, a coved cornice
    lin = [((IX0, IY1 - 0.03), (-BA_W / 2 - 0.35, IY1 - 0.03), 0.0), ((BA_W / 2 + 0.35, IY1 - 0.03), (IX1, IY1 - 0.03), 0.0), ((IX0 + 0.03, IY0), (IX0 + 0.03, IY1), math.pi / 2), ((IX1 - 0.03, IY0), (IX1 - 0.03, IY1), -math.pi / 2)]
    lining(bd, lin, CEIL, hi)
    # the front wall inside (around the arch + windows)
    fy = IY0 + 0.03
    for (xa, xb) in ((IX0, -5.6 - 0.75), (-5.6 + 0.75, -ARCH_W / 2), (ARCH_W / 2, 5.6 - 0.75), (5.6 + 0.75, IX1)):
        bd.box(xb - xa, 0.04, CEIL - 1.0, (xa + xb) / 2, fy, 1.0, DAMASK, base=True)
        bd.push(T((xa + xb) / 2, fy, 0, rz=math.pi)); wainscot(bd, xb - xa, hi, top=1.0); bd.pop()
    for (xa, xb) in ((-5.6 - 0.75, -5.6 + 0.75), (5.6 - 0.75, 5.6 + 0.75)):
        bd.push(T((xa + xb) / 2, fy, 0, rz=math.pi)); wainscot(bd, xb - xa, hi, top=1.0); bd.pop(); bd.box(xb - xa, 0.04, CEIL - 4.1, (xa + xb) / 2, fy, 4.1, DAMASK, base=True)
    bd.box(ARCH_W, 0.04, CEIL - 4.4, 0, fy, 4.4, DAMASK, base=True)
    entablature(bd, [((IX1, fy), (IX0, fy), math.pi)], hi)   # across the front wall (over the arch + the windows)
    upper_panels(bd, [((IX1, fy), (IX0, fy), math.pi)], CEIL, hi, skip=[(-3.6, 3.6)])
    # [v378] the back arch inside: gilt-cased opening, damask over it, threshold, the wing's name board
    by_ = IY1 - 0.03
    bd.box(BA_W + 0.7, 0.04, CEIL - (BA_SPRING + BA_RISE), 0, by_, BA_SPRING + BA_RISE, DAMASK, base=True)
    for s_ in (-1, 1): bd.box(0.35, 0.14, BA_SPRING + BA_RISE, s_ * (BA_W / 2 + 0.175), by_ - 0.04, FLOOR, MAHOG_D, base=True); bd.box(0.42, 0.18, 0.2, s_ * (BA_W / 2 + 0.175), by_ - 0.05, BA_SPRING - 0.1, GOLD_D, base=True)
    arch_ring(bd, 0, BA_W / 2, BA_SPRING, BA_RISE, by_ - 0.03, 0.12, 0.2, GOLD_D, 9 if hi else 5, rng, keyc=GOLD)
    bd.box(BA_W, WB + 0.1, 0.1, 0, Y1 - WB / 2, FLOOR - 0.1, FLOORS[1], base=True)
    # [pass2] the reveal was bare grey stone (read as grey posts + braces from the hall): cased jambs + a curved mahogany soffit
    ya_, yb_ = IY1 - 0.06, Y1 + 0.06
    for s_ in (-1, 1): bd.box(0.05, yb_ - ya_, BA_SPRING, s_ * (BA_W / 2 - 0.025), (ya_ + yb_) / 2, FLOOR, MAHOG_D, base=True)
    ns_ = 16 if hi else 8; r_ = BA_W / 2; xs_ = [-r_ + i * BA_W / ns_ for i in range(ns_ + 1)]; zs_ = [BA_SPRING + BA_RISE * math.sqrt(max(0.0, 1 - (x_ / r_) ** 2)) - 0.03 for x_ in xs_]
    V_ = [(x_, ya_, z_) for x_, z_ in zip(xs_, zs_)] + [(x_, yb_, z_) for x_, z_ in zip(xs_, zs_)]
    bd.mesh(V_, [(i, ns_ + 1 + i, ns_ + 2 + i, i + 1) for i in range(ns_)], MAHOG, smooth=False)
    entablature(bd, [((-BA_W / 2 - 0.35, by_), (BA_W / 2 + 0.35, by_), 0.0)], hi)
    sign_board(bd, 'THE HIGH SEAS ROOM', 0, IY1 - 0.08, 5.55, 5.4, 0.92, lod, rz=0.0)
    for s_ in (-1, 1): drape(bd, s_ * (BA_W / 2 + 0.55), IY1 - 0.15, 4.2, 4.1, 0.6, lod, side=s_)
    for s in (-1, 1): drape(bd, s * (ARCH_W / 2 + 0.4), IY0 + 0.15, 4.3, 4.2, 0.7, lod, side=s)   # tied-back inner drapes, clear of the opening
    sign_board(bd, 'THE GOLDEN DOUBLOON', 0, IY0 + 0.07, 5.55, 6.0, 0.95, lod, rz=math.pi, sub='GAMING HALL')
    # pilasters on the side walls, full height to the cornice (gilt bases, flutes + capitals) + sconces
    for xe, rz_ in ((IX0, math.pi / 2), (IX1, -math.pi / 2)):
        for yy in (-3.4, 1.4):
            bd.push(T(xe, yy, 0, rz=rz_)); bd.box(0.5, 0.18, CEIL - 0.75, 0, -0.09, FLOOR, MAHOG_D, base=True)
            bd.box(0.62, 0.26, 0.3, 0, -0.12, FLOOR, MAHOG, base=True); bd.box(0.66, 0.28, 0.06, 0, -0.13, 0.3, GOLD_D, base=True)
            bd.box(0.66, 0.26, 0.32, 0, -0.12, CEIL - 0.95, GOLD_D, base=True); bd.box(0.74, 0.3, 0.1, 0, -0.14, CEIL - 0.65, GOLD, base=True)
            if hi:
                for k in (-0.14, 0.0, 0.14): bd.box(0.05, 0.03, CEIL - 2.1, k, -0.19, 0.55, MAHOG, base=True)
                for k in (-1, 1): bd.sphere(0.06, k * 0.24, -0.25, CEIL - 0.8, GOLD, sub=0)   # volutes
            sconce(bd, 0, -0.18, 2.75, lod, out=-1); bd.pop()
    for xx in (-4.3, 4.3): bd.push(T(xx, IY1, 0, rz=0)); sconce(bd, 0, 0, 2.75, lod, out=-1); bd.pop()
    # [AAA] clerestory: lit lunettes high on the north wall (the street-side windows' inside), gilt-framed mirror lunettes facing them
    for (xe, rz_, lit) in ((IX1, -math.pi / 2, True), (IX0, math.pi / 2, False)):
        for yy in (-4.2, 0.0, 4.2):
            bd.push(T(xe, yy, 0, rz=rz_))
            g = GLOW if lit else 0x2a2b36
            bd.box(1.0, 0.05, 0.85, 0, -0.07, 6.25, g, mat=1 if lit else 0, base=True); bd.cyl(0.5, 0.5, 0.05, 0, -0.07, 7.1, g, n=14 if hi else 6, rx=math.pi / 2, mat=1 if lit else 0)
            bd.box(1.24, 0.12, 0.1, 0, -0.1, 6.17, GOLD_D, base=True)
            for sx in (-1, 1): bd.box(0.1, 0.12, 0.9, sx * 0.57, -0.1, 6.2, GOLD_D, base=True)
            arch_ring(bd, 0, 0.5, 7.1, 0.5, -0.1, 0.1, 0.12, GOLD_D, 7 if hi else 4, rng, keyc=GOLD)
            if lit and hi:
                for k in (-0.25, 0.25): bd.box(0.03, 0.03, 1.3, k, -0.1, 6.25, IRON, base=True)
                bd.box(1.0, 0.03, 0.03, 0, -0.1, 6.8, IRON)
            bd.pop()
            if lit: light(bd, xe - 1.0, yy, 6.8, 0.22, 3.4, lod)
    # [AAA] the coffered ceiling up at 8.2 m: deep gilt-edged beams, crimson coffers with gilt mouldings + rosettes, a coved cornice,
    # the centre coffer opened into a gilded lantern ring over the grand chandelier
    ceiling(bd, IX0, IX1, IY0, IY1, CEIL, Z2 - 0.1, 5, 5, lod, centre=(0.0, RY))
    chandelier(bd, 0, RY, 4.85, 1.35, 16, CEIL - 0.45, lod, I=0.9, reach=8.5)
    for cyy in (-4.75, 4.75): chandelier(bd, 0, cyy, 5.75, 0.8, 10, CEIL - 0.1, lod, I=0.5, reach=6.0)
    stations(bd, lod, rng, cols)
    decor(bd, lod, rng, cols)
    wing_int(bd, lod, rng, cols)
    wall_art(bd, lod)

def entablature(bd, segs, hi, z=4.5):   # [AAA] gilt architrave + mahogany frieze + gilt cornice band (local -y = into the room)
    for (p, q, rz_) in segs:
        L = math.dist(p, q); mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        bd.push(T(mx, my, 0, rz=rz_))
        bd.box(L, 0.1, 0.06, 0, -0.06, z, GOLD_D, base=True); bd.box(L, 0.08, 0.32, 0, -0.05, z + 0.06, MAHOG_D, base=True)
        bd.box(L, 0.16, 0.08, 0, -0.09, z + 0.38, GOLD_D, base=True)
        if hi:
            bd.box(L, 0.03, 0.025, 0, -0.105, z + 0.2, GOLD, base=True)
            for k in range(int(L / 0.6)): bd.box(0.08, 0.05, 0.12, -L / 2 + 0.3 + k * 0.6, -0.1, z + 0.12, GOLD_D, base=True)   # triglyph studs
        bd.pop()

def upper_panels(bd, segs, ceil, hi, skip=(), z0=5.05, pitch=2.2):   # [AAA] gilt-moulded damask panels between the entablature and the cornice
    if not hi: return
    for (p, q, rz_) in segs:
        L = math.dist(p, q); mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2; z1 = ceil - 0.85
        if z1 - z0 < 0.6: continue
        bd.push(T(mx, my, 0, rz=rz_))
        n = max(1, int(L / pitch)); w = L / n
        for k in range(n):
            xc = -L / 2 + (k + 0.5) * w
            gx = mx + (xc * math.cos(rz_)); gy = my + (xc * math.sin(rz_))
            if any(a <= (gx if abs(math.sin(rz_)) < 0.5 else gy) <= b for (a, b) in skip): continue
            pw = w - 0.5
            for zz in (z0, z1): bd.box(pw, 0.04, 0.05, xc, -0.06, zz, GOLD_D, base=True)
            for xx in (xc - pw / 2, xc + pw / 2): bd.box(0.05, 0.04, z1 - z0 + 0.05, xx, -0.06, z0, GOLD_D, base=True)
        bd.pop()

def ceiling(bd, x0, x1, y0, y1, zc, ztop, nx_, ny_, lod, centre=None):
    hi = lod == 0; iw, idp = x1 - x0, y1 - y0; cxm, cym = (x0 + x1) / 2, (y0 + y1) / 2
    bd.box(iw, idp, ztop - zc, cxm, cym, zc, MAHOG_D, base=True)
    # coved cornice round the room: stepped mahogany bands, a gilt fillet, dentils
    for (off, z0, h, c) in ((0.07, zc - 0.66, 0.14, MAHOG), (0.15, zc - 0.52, 0.06, GOLD_D), (0.22, zc - 0.46, 0.2, MAHOG), (0.34, zc - 0.26, 0.26, MAHOG_D)):
        bd.box(iw, off, h, cxm, y0 + off / 2, z0, c, base=True); bd.box(iw, off, h, cxm, y1 - off / 2, z0, c, base=True)
        bd.box(off, idp, h, x0 + off / 2, cym, z0, c, base=True); bd.box(off, idp, h, x1 - off / 2, cym, z0, c, base=True)
    if hi and nx_ * ny_ <= 25:   # dentils: the hall only (file size)
        for (a, b, fixed, along_x) in ((x0, x1, y0 + 0.2, True), (x0, x1, y1 - 0.2, True), (y0, y1, x0 + 0.2, False), (y0, y1, x1 - 0.2, False)):
            k = a + 0.25
            while k < b - 0.2:
                if along_x: bd.box(0.08, 0.1, 0.1, k, fixed, zc - 0.36, GOLD_D, base=True)
                else: bd.box(0.1, 0.08, 0.1, fixed, k, zc - 0.36, GOLD_D, base=True)
                k += 0.32
    xs = [x0 + i * iw / nx_ for i in range(nx_ + 1)]; ys = [y0 + j * idp / ny_ for j in range(ny_ + 1)]
    BD = 0.48
    for xx in xs[1:-1]:
        bd.box(0.32, idp, BD, xx, cym, zc - BD, MAHOG, base=True)
        if hi: bd.box(0.12, idp, 0.02, xx, cym, zc - BD - 0.005, GOLD_D, base=True); [bd.box(0.02, idp, 0.04, xx + sx * 0.165, cym, zc - 0.2, GOLD, base=True) for sx in (-1, 1)]
    for yy in ys[1:-1]:
        bd.box(iw, 0.32, BD, cxm, yy, zc - BD, MAHOG, base=True)
        if hi: bd.box(iw, 0.12, 0.02, cxm, yy, zc - BD - 0.005, GOLD_D, base=True); [bd.box(iw, 0.02, 0.04, cxm, yy + sy * 0.165, zc - 0.2, GOLD, base=True) for sy in (-1, 1)]
    if hi:
        for xx in xs[1:-1]:
            for yy in ys[1:-1]: lathe(bd, [(0.0, -0.12), (0.1, -0.08), (0.2, 0.0)], xx, yy, zc - BD, GOLD, n=8, caps=False)   # bosses
    for i in range(nx_):
        for j in range(ny_):
            xx = (xs[i] + xs[i + 1]) / 2; yy = (ys[j] + ys[j + 1]) / 2; cw, ch = xs[i + 1] - xs[i] - 0.32, ys[j + 1] - ys[j] - 0.32
            if centre and abs(xx - centre[0]) < (xs[1] - xs[0]) / 2 and abs(yy - centre[1]) < (ys[1] - ys[0]) / 2:
                # the lantern coffer: stepped gilt octagon rings + a glowing ring of light round the chandelier rose
                bd.box(cw, ch, 0.03, xx, centre[1], zc - 0.03, BURG, base=True, mat=CLOTH)
                for (rr, hh, c) in ((min(cw, ch) * 0.48, 0.12, GOLD_D), (min(cw, ch) * 0.4, 0.2, MAHOG), (min(cw, ch) * 0.34, 0.08, GOLD)):
                    bd.cyl(rr, rr, hh, xx, centre[1], zc - hh, c, n=8, rz=math.pi / 8)
                bd.torus(min(cw, ch) * 0.3, 0.035, xx, centre[1], zc - 0.21, GLOW, n=24 if hi else 8, m_=3, mat=1)
                light(bd, xx, centre[1], zc - 0.5, 0.35, 4.0, lod)
                continue
            bd.box(cw - 0.06, ch - 0.06, 0.03, xx, yy, zc - 0.03, BURG, base=True, mat=CLOTH)
            if hi:
                for (a_, b_) in ((cw - 0.24, 0.0), ):
                    for sy in (-1, 1): bd.box(a_, 0.05, 0.05, xx, yy + sy * (ch - 0.24) / 2, zc - 0.08, GOLD_D, base=True)
                    for sx in (-1, 1): bd.box(0.05, ch - 0.24, 0.05, xx + sx * (cw - 0.24) / 2, yy, zc - 0.08, GOLD_D, base=True)
                lathe(bd, [(0.0, -0.09), (0.09, -0.07), (0.16, -0.03), (0.22, 0.0)], xx, yy, zc - 0.03, GOLD, n=8, caps=False)
            else: bd.box(0.2, 0.2, 0.05, xx, yy, zc - 0.08, GOLD, base=True)

def card(bd, x, y, z, rz, face=True, red=False):
    bd.box(0.09, 0.13, 0.004, x, y, z, WHITE if face else 0x8a1c1c, rz=rz, base=True)
    if face: bd.box(0.03, 0.03, 0.002, x, y, z + 0.004, RED if red else BLACK, rz=rz + math.pi / 4, base=True)

def stool(bd, x, y, lod):   # [AAA] turned brass pedestal, footring, tufted oxblood seat with a gilt welt
    hi = lod == 0; n = 12 if hi else 6
    lathe(bd, [(0.21, 0.0), (0.21, 0.025), (0.13, 0.05), (0.045, 0.09), (0.035, 0.5), (0.06, 0.56), (0.07, 0.585)], x, y, 0, BRASS, n=n)
    if hi: bd.torus(0.17, 0.014, x, y, 0.27, BRASS, n=12, m_=3); [rod(bd, (x, y, 0.27), (x + 0.17 * math.cos(a), y + 0.17 * math.sin(a), 0.27), 0.01, BRASS, n=4) for a in (0.4, 2.5, 4.6)]
    lathe(bd, [(0.0, 0.585), (0.2, 0.585), (0.225, 0.61), (0.23, 0.65), (0.21, 0.69), (0.15, 0.72), (0.0, 0.73)], x, y, 0, LEATH2, n=n, caps=False)
    if hi: bd.torus(0.215, 0.011, x, y, 0.615, GOLD, n=14, m_=3)

RAIL = [(-0.09, 0.0), (0.05, 0.0), (0.09, 0.015), (0.105, 0.045), (0.09, 0.075), (0.05, 0.09), (-0.09, 0.09)]   # carved ogee rail section (u out, v up)

def t_blackjack(bd, lod, rng, cx, cy, rz):   # [AAA] the half-moon table: turned pedestals, carved ogee rail, padded bumper + nail heads, brass inlay,
    # sunken chip tray, cards + chips on the printed felt (js/island/casinoFelt.js), the shoe, tufted stools. Players on -y, the dealer on +y.
    hi = lod == 0; n = 30 if hi else 10
    bd.push(T(cx, cy, 0, rz=rz))
    bd.box(2.0, 0.44, 0.07, 0, -0.5, 0, MAHOG_D, base=True)
    if hi: bd.box(2.06, 0.5, 0.025, 0, -0.5, 0.0, GOLD_D, base=True)
    for sx in (-0.72, 0.72):
        lathe(bd, [(0.2, 0.07), (0.2, 0.11), (0.12, 0.15), (0.09, 0.22), (0.13, 0.3), (0.09, 0.4), (0.07, 0.52), (0.1, 0.6), (0.17, 0.665)], sx, -0.5, 0, MAHOG_D, n=12 if hi else 6)
        if hi: bd.torus(0.12, 0.013, sx, -0.5, 0.3, GOLD, n=12, m_=3)
    slab(bd, dshape(1.44, n), 0.665, 0.8, MAHOG_D)
    bd.box(2.88, 0.12, 0.135, 0, 0.06, 0.665, MAHOG_D, base=True)
    if hi:
        sweep(bd, arc(1.442, math.pi, 2 * math.pi, n), tube(0.0, 0.0, 0.014, 0.014, 4), GOLD, z0=0.7)
        for i in range(9): a = math.pi + math.pi * (i + 0.5) / 9; bd.box(0.3, 0.02, 0.07, 1.445 * math.cos(a), 1.445 * math.sin(a), 0.73, MAHOG_L, rz=a + math.pi / 2, base=True)   # carved apron panels
    A = arc(1.42, math.pi, 2 * math.pi, n)
    sweep(bd, A, RAIL, MAHOG, z0=0.8, smooth=hi)
    slab(bd, dshape(1.34, n), 0.86, 0.886, FELT, mat=CLOTH)
    if hi: sweep(bd, arc(1.345, math.pi, 2 * math.pi, n), tube(0.0, 0.0, 0.014, 0.006, 4), BRASS, z0=0.887)
    sweep(bd, A, tube(0.015, 0.95, 0.1, 0.066, 12 if hi else 5), LEATH2)
    if hi:
        for i in range(27): a = math.pi + math.pi * (i + 0.5) / 27; bd.sphere(0.011, 1.54 * math.cos(a), 1.54 * math.sin(a), 0.945, GOLD, sub=0)
    bd.box(2.92, 0.2, 0.09, 0, 0.08, 0.8, MAHOG, base=True); bd.box(2.92, 0.035, 0.03, 0, -0.02, 0.886, BRASS, base=True)
    bd.box(2.96, 0.05, 0.05, 0, 0.17, 0.865, GOLD_D, base=True)
    bd.box(0.94, 0.28, 0.035, 0, -0.17, 0.886, MAHOG_D, base=True)
    if hi:
        for s in (-1, 1): bd.box(0.96, 0.02, 0.04, 0, -0.17 + s * 0.14, 0.886, BRASS, base=True)
        for k in range(8): bd.cyl(0.032, 0.032, 0.22, -0.39 + k * 0.111, -0.06, 0.925, (CRIM, GOLD_D, BLACK, WHITE, SAPH, EMER, CRIM, GOLD_D)[k], n=10, rx=math.pi / 2)
    for k in range(5):
        a = math.pi + math.pi * (k + 0.5) / 5; px, py = 1.0 * math.cos(a), 1.0 * math.sin(a)
        chip_stack(bd, px, py, 0.888, 2 + k % 3, (CRIM, GOLD_D, BLACK, WHITE, SAPH)[k], lod)
        if hi: card(bd, px + 0.03 * math.cos(a), py + 0.22, 0.888, a + math.pi / 2, red=k % 2 == 0); card(bd, px + 0.07, py + 0.24, 0.893, a + math.pi / 2 + 0.25, red=k % 2 == 1)
    if hi:
        card(bd, -0.06, -0.52, 0.888, 0.05, red=True); card(bd, 0.06, -0.52, 0.888, -0.04, face=False)
        bd.box(0.34, 0.2, 0.16, 0.98, -0.22, 0.886, MAHOG_D, base=True, rz=-0.3); bd.box(0.3, 0.02, 0.12, 0.98 - 0.05, -0.33, 0.9, BRASS, base=True, rz=-0.3)   # the shoe
        bd.box(0.16, 0.16, 0.1, -1.0, -0.22, 0.886, MAHOG_D, base=True, rz=0.3); bd.box(0.12, 0.12, 0.08, -1.0, -0.22, 0.986, WHITE, base=True, rz=0.3)   # discards
    for k in (-2, -1, 1, 2):
        a = 1.5 * math.pi + k * 0.38; stool(bd, 1.95 * math.cos(a), 1.95 * math.sin(a), lod)
    figure(bd, 0, 0.55, 0.0, lod, vest=CRIM)
    bd.pop()

ROU_TL, ROU_TW, ROU_WX = 3.4, 1.6, 0.88
def t_roulette(bd, lod, rng, cx, cy, rz):   # [AAA] six turned legs, a carved apron, rounded carved rail + padded bumper, the printed layout
    # (js/island/casinoFelt.js), a lathe-turned wheel bowl: gilt rim, ball track + deflectors, 37 fretted pockets, a gilt cone + turret
    hi = lod == 0; TL, TW, wx = ROU_TL, ROU_TW, ROU_WX; k_ = 4 if hi else 2
    bd.push(T(cx, cy, 0, rz=rz))
    for lx_ in (-1.45, 0.0, 1.45):
        for ly_ in (-0.58, 0.58):
            lathe(bd, [(0.09, 0.0), (0.1, 0.03), (0.07, 0.07), (0.055, 0.2), (0.085, 0.3), (0.06, 0.42), (0.05, 0.56), (0.075, 0.62), (0.075, 0.665)], lx_, ly_, 0, MAHOG_D, n=10 if hi else 5)
            if hi: bd.torus(0.065, 0.011, lx_, ly_, 0.3, GOLD, n=10, m_=3)
    bd.box(TL - 0.5, TW - 0.5, 0.05, 0, 0, 0.16, MAHOG_D, base=True)
    sweep(bd, rrect(TL / 2 - 0.12, TW / 2 - 0.12, 0.22, k_), [(-0.06, 0.0), (0.0, 0.0), (0.0, 0.15), (-0.06, 0.15)], MAHOG_D, closed=True, smooth=False, z0=0.64)
    if hi:
        for zz in (0.66, 0.775): sweep(bd, rrect(TL / 2 - 0.12, TW / 2 - 0.12, 0.22, k_), tube(0.0, 0.0, 0.012, 0.012, 4), GOLD, closed=True, z0=zz)
    slab(bd, rrect(TL / 2 - 0.1, TW / 2 - 0.1, 0.24, k_), 0.79, 0.86, MAHOG)
    slab(bd, rrect(TL / 2 - 0.18, TW / 2 - 0.18, 0.16, k_), 0.86, 0.876, FELT, mat=CLOTH)
    R_ = rrect(TL / 2 - 0.1, TW / 2 - 0.1, 0.24, k_)
    sweep(bd, R_, RAIL, MAHOG, closed=True, z0=0.84, smooth=hi)
    sweep(bd, R_, tube(0.015, 0.97, 0.09, 0.055, 12 if hi else 5), LEATH2, closed=True)
    if hi: sweep(bd, rrect(TL / 2 - 0.185, TW / 2 - 0.185, 0.16, k_), tube(0.0, 0.0, 0.012, 0.005, 4), BRASS, closed=True, z0=0.877)
    # the wheel
    nW = 28 if hi else 12
    lathe(bd, [(0.62, 0.876), (0.64, 0.93), (0.63, 0.99), (0.605, 1.01)], wx, 0, 0, MAHOG_D, n=nW, caps=False)
    bd.torus(0.6, 0.022, wx, 0, 1.012, GOLD, n=nW, m_=4 if hi else 3)
    lathe(bd, [(0.585, 1.01), (0.52, 0.99), (0.46, 0.975), (0.43, 0.968)], wx, 0, 0, MAHOG_L, n=nW, caps=False)
    lathe(bd, [(0.43, 0.968), (0.29, 0.958)], wx, 0, 0, 0x2a1a10, n=nW, caps=False)
    WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]
    REDS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    for k, nn in enumerate(WHEEL):
        a = k * 2 * math.pi / 37
        bd.box(0.062, 0.13, 0.014, wx + 0.36 * math.cos(a), 0.36 * math.sin(a), 0.962, 0x1f9a4a if nn == 0 else RED if nn in REDS else BLACK, rz=a + math.pi / 2, base=True)
        if hi: bd.box(0.006, 0.08, 0.03, wx + 0.33 * math.cos(a + math.pi / 37), 0.33 * math.sin(a + math.pi / 37), 0.962, GOLD, rz=a + math.pi / 37, base=True)   # frets
    if hi:
        for k in range(8): a = k * math.pi / 4 + 0.2; bd.box(0.05, 0.02, 0.015, wx + 0.5 * math.cos(a), 0.5 * math.sin(a), 0.985, GOLD, rz=a + math.pi / 2, base=True)   # deflectors
    lathe(bd, [(0.29, 0.958), (0.25, 0.975), (0.13, 1.03), (0.06, 1.06), (0.045, 1.12), (0.0, 1.13)], wx, 0, 0, GOLD_D, n=16 if hi else 8, caps=False)
    lathe(bd, [(0.03, 1.12), (0.045, 1.165), (0.02, 1.22), (0.032, 1.25), (0.0, 1.275)], wx, 0, 0, GOLD, n=8, caps=False)
    for k in range(4):
        a = k * math.pi / 2; bd.box(0.3, 0.025, 0.025, wx + 0.15 * math.cos(a), 0.15 * math.sin(a), 1.18, GOLD, rz=a); bd.sphere(0.028, wx + 0.3 * math.cos(a), 0.3 * math.sin(a), 1.18, GOLD, sub=0)
    bd.sphere(0.02, wx + 0.36 * math.cos(1.1), 0.36 * math.sin(1.1), 0.985, WHITE, sub=1 if hi else 0)
    # chips on the layout, the dolly, the croupier's stacks
    if hi:
        for (px, py, nn, col) in ((-1.2, -0.3, 3, CRIM), (-0.8, 0.12, 2, GOLD_D), (-0.35, -0.05, 4, BLACK), (-0.05, -0.42, 2, WHITE), (-0.6, -0.45, 3, SAPH)): chip_stack(bd, px, py, 0.877, nn, col, lod)
        crown(bd, -0.92, -0.02, 0.877, 0.06, lod)
        for k in range(6): chip_stack(bd, -0.9 + k * 0.12, 0.5, 0.877, 6, (CRIM, GOLD_D, BLACK, WHITE, SAPH, EMER)[k], lod)
    for xx in (-1.3, -0.6): stool(bd, xx, -1.14, lod)
    figure(bd, wx, TW / 2 + 0.55, 0.0, lod, vest=0x1f4e8a)
    bd.pop()

DICE_PL, DICE_PW = 2.9, 1.7
def t_dice(bd, lod, rng, cx, cy, rz):   # [AAA] the dice tub: carved panelled body, studded rubber band, padded rail, brass foot rail, printed felt
    hi = lod == 0; PL, PW = DICE_PL, DICE_PW; k_ = 4 if hi else 2
    bd.push(T(cx, cy, 0, rz=rz))
    slab(bd, rrect(PL / 2 - 0.1, PW / 2 - 0.1, 0.3, k_), 0.0, 0.08, MAHOG_D)
    slab(bd, rrect(PL / 2 - 0.04, PW / 2 - 0.04, 0.32, k_), 0.08, 0.62, MAHOG)
    if hi:
        sweep(bd, rrect(PL / 2 - 0.04, PW / 2 - 0.04, 0.32, k_), tube(0.0, 0.0, 0.014, 0.014, 4), GOLD, closed=True, z0=0.1)
        sweep(bd, rrect(PL / 2 - 0.04, PW / 2 - 0.04, 0.32, k_), tube(0.0, 0.0, 0.014, 0.014, 4), GOLD, closed=True, z0=0.58)
        for s in (-1, 1):
            for i in range(3):
                px = -0.8 + i * 0.8; yy = s * (PW / 2 - 0.04 + 0.012)
                bd.box(0.6, 0.03, 0.3, px, yy, 0.2, MAHOG_L, base=True)
                for zz in (0.19, 0.51): bd.box(0.64, 0.035, 0.02, px, yy + s * 0.005, zz, GOLD_D, base=True)
                for xx in (px - 0.31, px + 0.31): bd.box(0.02, 0.035, 0.34, xx, yy + s * 0.005, 0.18, GOLD_D, base=True)
        for s in (-1, 1): bd.box(0.03, 0.7, 0.3, s * (PL / 2 - 0.028), 0, 0.2, MAHOG_L, base=True)
    slab(bd, rrect(PL / 2 - 0.17, PW / 2 - 0.17, 0.2, k_), 0.62, 0.662, FELT, mat=CLOTH)
    R_ = rrect(PL / 2 - 0.1, PW / 2 - 0.1, 0.26, k_)
    sweep(bd, R_, [(-0.075, 0.0), (0.06, 0.0), (0.06, 0.32), (-0.075, 0.32), (-0.075, 0.0)], MAHOG, closed=True, smooth=False, z0=0.62)
    sweep(bd, R_, [(-0.08, 0.0), (-0.074, 0.0), (-0.074, 0.15), (-0.08, 0.15), (-0.08, 0.0)], 0x1a1414, closed=True, smooth=False, z0=0.72)   # rubber band
    if hi:
        L = 0.0
        for (p, q) in zip(R_, R_[1:] + R_[:1]):
            d = math.dist(p, q); t = 0.0
            while t < d:
                u = t / d; px, py = p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u; tx, ty = (q[0] - p[0]) / d, (q[1] - p[1]) / d
                bd.box(0.035, 0.012, 0.035, px - ty * -0.083, py + tx * -0.083, 0.795, GOLD, rz=math.atan2(ty, tx), ry=math.pi / 4)
                t += 0.16
    R2 = rrect(PL / 2 - 0.06, PW / 2 - 0.06, 0.3, k_)
    sweep(bd, R2, RAIL, MAHOG, closed=True, z0=0.92, smooth=hi)
    sweep(bd, R2, tube(0.015, 1.05, 0.085, 0.05, 12 if hi else 5), LEATH2, closed=True)
    FR = rrect(PL / 2 + 0.12, PW / 2 + 0.12, 0.42, k_)
    sweep(bd, FR, tube(0.0, 0.2, 0.024, 0.024, 6 if hi else 4), BRASS, closed=True)
    if hi:
        for (bx, by) in ((-1.0, -1), (0.0, -1), (1.0, -1), (-1.0, 1), (0.0, 1), (1.0, 1)): bd.box(0.03, 0.14, 0.03, bx, by * (PW / 2 + 0.05), 0.2, BRASS)
    for (dx_, dy_, rz_, faces) in ((-0.35, 0.1, 0.4, 5), (0.05, -0.15, -0.3, 2)):
        s_ = 0.14; bd.box(s_, s_, s_, dx_, dy_, 0.662, BONE, base=True, rz=rz_)
        if hi:
            c_, sn = math.cos(rz_), math.sin(rz_)
            pips = {5: [(-1, -1), (1, -1), (0, 0), (-1, 1), (1, 1)], 2: [(-1, -1), (1, 1)]}[faces]
            for (u, v) in pips: px, py = u * 0.035, v * 0.035; bd.sphere(0.013, dx_ + px * c_ - py * sn, dy_ + px * sn + py * c_, 0.662 + s_, BLACK, sub=0)
    bd.cyl(0.012, 0.012, 1.4, 0.4, 0.55, 1.1, MAHOG_L, n=5, ry=math.pi / 2 - 0.15, rz=math.pi)   # the stick
    bd.box(0.12, 0.05, 0.02, -0.98, 0.55, 1.23, MAHOG_L)
    bd.push(T(PL / 2 - 0.1, 0, 1.1, rz=-math.pi / 2)); bd.sphere(0.13, 0, 0, 0.13, BONE, sub=1 if hi else 0, s=(1, 0.85, 1)); bd.box(0.14, 0.12, 0.07, 0, 0.0, 0.02, BONE, base=True)
    if hi:
        for sx in (-1, 1): bd.sphere(0.035, sx * 0.05, -0.1, 0.15, BLACK, sub=0)
    bd.pop()
    for (px, py, nn, col) in ((-0.9, -0.62, 3, CRIM), (0.8, -0.66, 2, GOLD_D), (0.3, -0.66, 4, BLACK)): chip_stack(bd, px, py, 1.08, nn, col, lod)
    figure(bd, 0, PW / 2 + 0.6, 0.0, lod, vest=0x2a2a33, sash=CRIM)
    bd.pop()

def t_slots(bd, lod, rng, cx, cy, rz):   # [AAA] a bank of three one-armed bandits (SLOT_DY apart): rounded cabinets, gilt belts + button decks,
    # bezelled reel windows, arched JACKPOT marquees ringed with bulbs, brass lamp posts between the machines, a stool at each
    hi = lod == 0; k = 3 if hi else 1
    bd.push(T(cx, cy, 0, rz=rz))
    SYM = (('seven', 'chest', 'crown'), ('crown', 'crown', 'doubloon'), ('anchor', 'seven', 'ruby'))
    for i, lx_ in enumerate((-SLOT_DY, 0.0, SLOT_DY)):
        bd.push(T(lx_, 0, 0))
        slab(bd, rrect(0.52, 0.44, 0.08, k), 0.0, 0.1, MAHOG_D)
        slab(bd, rrect(0.49, 0.41, 0.1, k), 0.1, 0.9, MAHOG)
        slab(bd, rrect(0.53, 0.47, 0.06, k), 0.9, 0.98, GOLD_D)
        if hi:
            bd.box(0.62, 0.03, 0.5, 0, -0.41, 0.25, MAHOG_L, base=True)
            for zz in (0.24, 0.75): bd.box(0.66, 0.035, 0.025, 0, -0.42, zz, GOLD, base=True)
            doubloon(bd, 0, -0.43, 0.5, 0.13, lod, rng, relief='anchor' if i == 1 else 'crown')
            for b_, c_ in ((-0.22, RED), (0.0, GLOW), (0.22, 0x2a5bd0)): bd.cyl(0.035, 0.035, 0.02, b_, -0.38, 0.98, c_, n=10, mat=1)
        bd.box(0.92, 0.7, 1.02, 0, 0.06, 0.98, MAHOG_D, base=True)
        bd.box(0.96, 0.74, 0.05, 0, 0.06, 2.0, GOLD_D, base=True)
        bd.box(0.8, 0.06, 0.62, 0, -0.3, 1.2, 0x120c08, base=True)   # reel window
        for kk, sym in enumerate(SYM[i]):
            rx_ = (kk - 1) * 0.25; bd.box(0.22, 0.04, 0.5, rx_, -0.32, 1.26, WHITE, base=True)
            zc = 1.51; yy = -0.35
            if sym == 'seven': carve(bd, '7', rx_, yy, zc, 0.16, 0.26, lod, col=RED, font=FONT)
            elif sym == 'crown':
                bd.box(0.16, 0.02, 0.05, rx_, yy, zc - 0.06, GOLD_D)
                for j in range(3): bd.prism([(-0.025, 0), (0.025, 0), (0, 0.09)], 0.02, GOLD_D, T(rx_ + (j - 1) * 0.06, yy, zc - 0.035))
            elif sym == 'chest': bd.box(0.15, 0.02, 0.09, rx_, yy, zc - 0.07, 0x7a4a26, base=True); bd.box(0.15, 0.02, 0.04, rx_, yy - 0.005, zc + 0.02, 0x6a3e20, base=True); bd.box(0.03, 0.02, 0.04, rx_, yy - 0.01, zc - 0.02, GOLD, base=True)
            elif sym == 'doubloon': bd.cyl(0.07, 0.07, 0.02, rx_, yy + 0.01, zc, GOLD, n=12 if hi else 8, rx=math.pi / 2)
            elif sym == 'anchor': anchor(bd, rx_, yy, zc + 0.02, 0.1, lod, col=0x1f4e8a)
            elif sym == 'ruby': bd.sphere(0.06, rx_, yy, zc, RUBY, sub=0, s=(1, 0.4, 1.2))
        for zz in (1.16, 1.82): bd.box(0.88, 0.08, 0.06, 0, -0.34, zz, GOLD, base=True)
        for xx in (-0.43, 0.43): bd.box(0.06, 0.08, 0.72, xx, -0.34, 1.16, GOLD, base=True)
        bd.box(0.82, 0.04, 0.02, 0, -0.36, 1.505, RED, base=True)   # pay line
        bd.prism([(0.47 * math.cos(math.pi * j / 12), 0.47 * math.sin(math.pi * j / 12)) for j in range(13)], 0.6, MAHOG_D, T(0, -0.28, 2.05))   # arched marquee
        bd.prism([(0.4 * math.cos(math.pi * j / 12), 0.4 * math.sin(math.pi * j / 12)) for j in range(13)], 0.04, 0x3a0c10, T(0, -0.31, 2.07))
        carve(bd, 'JACKPOT', 0, -0.33, 2.2, 0.56, 0.14, lod, col=GLOW_G, mat=1, depth=0.015)
        if hi:
            for j in range(11): a = math.pi * (j + 0.5) / 11; bd.sphere(0.022, 0.435 * math.cos(a), -0.31, 2.05 + 0.435 * math.sin(a), BULB, sub=0, mat=1)
            crown(bd, 0, -0.05, 2.5, 0.12, lod)
        bd.box(0.6, 0.18, 0.08, 0, -0.48, 0.92, GOLD_D, base=True)   # coin tray
        bd.box(0.62, 0.2, 0.05, 0, -0.42, 0.84, MAHOG_D, base=True)
        if hi:
            for kk in range(4): bd.cyl(0.035, 0.035, 0.012, -0.15 + kk * 0.1, -0.5, 0.97, GOLD, n=8)
        bd.cyl(0.07, 0.07, 0.12, 0.5, -0.05, 1.35, BRASS, n=8, ry=math.pi / 2)   # the one arm
        bd.cyl(0.03, 0.03, 0.62, 0.58, -0.05, 1.38, BRASS, n=6); bd.sphere(0.075, 0.58, -0.05, 2.02, RED, sub=1 if hi else 0)
        stool(bd, 0, -0.9, lod)
        bd.pop()
    for px in (-SLOT_DY / 2, SLOT_DY / 2, -SLOT_DY * 1.5, SLOT_DY * 1.5):   # brass lamp posts between + beside the machines
        lathe(bd, [(0.09, 0.0), (0.09, 0.04), (0.05, 0.08), (0.03, 0.2), (0.025, 2.0), (0.04, 2.1), (0.05, 2.18)], px, 0.1, 0, BRASS, n=8 if hi else 5)
        bd.sphere(0.1, px, 0.1, 2.28, BULB, sub=1 if hi else 0, mat=1)
        halo(bd, px, 0.1, 2.28, 0.9, lod)
    bd.pop()

TB = dict(blackjack=t_blackjack, roulette=t_roulette, dice=t_dice, slots=t_slots)
FELT_Z = dict(blackjack=0.8875, roulette=0.8775, dice=0.6635)
def pendant(bd, kind, lod, ztop):   # [AAA] the lamp over a table (in the table's frame): lacquered hood, brass rim, glowing underside, drop rods
    hi = lod == 0
    if kind == 'slots': return
    zb = 3.0
    if kind == 'blackjack':
        cx, cy = 0.0, -0.62
        lathe(bd, [(0.56, 0.0), (0.55, 0.05), (0.44, 0.17), (0.26, 0.3), (0.1, 0.37), (0.06, 0.42)], cx, cy, zb, LACQ, n=16 if hi else 8)
        bd.torus(0.56, 0.02, cx, cy, zb, BRASS, n=20 if hi else 8, m_=3)
        bd.cyl(0.53, 0.53, 0.01, cx, cy, zb + 0.005, GLOW, n=20 if hi else 8, mat=1)
        rods = [(cx, cy)]
    else:
        L, W_, cx = (2.3, 0.72, -0.35) if kind == 'roulette' else (2.0, 0.78, 0.0); cy = 0.0
        bd.push(T(cx, cy, 0))
        slab(bd, rrect(L / 2, W_ / 2, 0.12, 3 if hi else 1), zb, zb + 0.05, BRASS)
        slab(bd, rrect(L / 2 - 0.05, W_ / 2 - 0.05, 0.1, 3 if hi else 1), zb + 0.05, zb + 0.24, LACQ)
        slab(bd, rrect(L / 2 - 0.22, W_ / 2 - 0.15, 0.06, 2 if hi else 1), zb + 0.24, zb + 0.32, LACQ)
        slab(bd, rrect(L / 2 - 0.04, W_ / 2 - 0.04, 0.1, 3 if hi else 1), zb - 0.006, zb + 0.001, GLOW, mat=1)
        if hi:
            for xx in (-L / 2 + 0.3, 0.0, L / 2 - 0.3): bd.sphere(0.03, xx, -W_ / 2 - 0.005, zb + 0.14, GOLD, sub=0)
        bd.pop()
        rods = [(cx - L / 3, cy), (cx + L / 3, cy)]
    for (rx_, ry_) in rods:
        bd.cyl(0.016, 0.016, ztop - (zb + 0.3), rx_, ry_, zb + 0.3, GOLD_D, n=6)
        if hi: lathe(bd, [(0.0, -0.06), (0.06, -0.04), (0.09, 0.0)], rx_, ry_, ztop, GOLD_D, n=8, caps=False); bd.sphere(0.035, rx_, ry_, zb + 0.32, GOLD, sub=0)
    light(bd, cx, cy, zb - 0.15, 0.95, 3.6, lod)
    pool(bd, cx, cy, 2.3, 0.6, lod)

def place(bd, kind, lod, rng, cx, cy, rz, ztop):   # [AAA] a table station: the instanced kit (recorded), its dealer marker, its lamp
    if lod == 0 and RECORD: KIT.append([kind, round(cx, 3), round(-cy, 3), round(rz, 4)])
    nb = NullBuilder(); nb.stack = [bd.stack[-1].copy()]; TB[kind](nb, lod, rng, cx, cy, rz)
    bd.push(T(cx, cy, 0, rz=rz)); pendant(bd, kind, lod, ztop); bd.pop()

def stations(bd, lod, rng, cols):
    hi = lod == 0
    # ---- PIRATE BLACKJACK: half-moon table, dealer behind the straight edge (south wall side), players on the curve ----
    cx, cy = ST['blackjack']['c']; place(bd, 'blackjack', lod, rng, cx, cy, math.pi / 2, CEIL)
    if cols is not None: cols += [['c', cx, -cy, 1.55], ['b', round((IX0 + cx) / 2, 3), -cy, round(cx - IX0, 3), 3.2]]
    sign_board(bd, 'PIRATE BLACKJACK', IX0 + 0.06, cy, 5.42, 3.5, 0.9, lod, rz=math.pi / 2, sub='BLACKJACK PAYS 3 TO 2')
    # ---- BUCCANEER ROULETTE: long table along the wall, the wheel at the south end, croupier between it and the north wall ----
    cx, cy = ST['roulette']['c']; place(bd, 'roulette', lod, rng, cx, cy, -math.pi / 2, CEIL)
    if cols is not None: cols += [['b', round((cx - 0.85 + IX1) / 2, 3), -cy, round(IX1 - (cx - 0.85), 3), 3.6]]
    sign_board(bd, 'BUCCANEER ROULETTE', IX1 - 0.06, cy, 5.42, 3.5, 0.9, lod, rz=-math.pi / 2, sub='RED OR BLACK')
    # ---- DEAD MAN'S DICE: the dice tub, the stickman on the wall side, a skull on the end rail ----
    cx, cy = ST['dice']['c']; place(bd, 'dice', lod, rng, cx, cy, math.pi / 2, CEIL)
    PL, PW = DICE_PL, DICE_PW
    if cols is not None: cols += [['b', round((IX0 + cx + PW / 2 + 0.05) / 2, 3), -cy, round(cx + PW / 2 + 0.05 - IX0, 3), PL + 0.2]]
    sign_board(bd, "DEAD MAN'S DICE", IX0 + 0.06, cy, 5.42, 3.5, 0.9, lod, rz=math.pi / 2, sub='UNDER SEVEN OR OVER')
    # ---- TREASURE SLOTS: a bank of three one-armed bandits against the north wall ----
    cx, cy = ST['slots']['c']; place(bd, 'slots', lod, rng, cx, cy, -math.pi / 2, CEIL)
    if cols is not None: cols += [['b', round((cx - 0.5 + IX1) / 2, 3), -cy, round(IX1 - (cx - 0.5), 3), 4.1]]
    sign_board(bd, 'TREASURE SLOTS', IX1 - 0.06, cy, 5.42, 3.5, 0.9, lod, rz=-math.pi / 2, sub='PULL FOR THE JACKPOT')

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
    sign_board(bd, 'RUM BAR', 0, IY1 - 0.08, 4.7, 3.4, 0.92, lod, rz=0.0)
    figure(bd, -0.9, 5.98, 0.0, lod, vest=0x6a1414, hat=False)
    for (xx, yy) in ((-3.45, 6.15), (3.45, 6.15)): barrel_(bd, xx, yy, 0, lod, r=0.38, h=1.0)
    barrel_(bd, 3.45, 6.15, 1.0, lod, r=0.32, h=0.85)
    bd.pop()
    if cols is not None: cols += [['b', 0.0, round(-(by0 - 0.3 + IY1) / 2 - DY, 3), 6.4, round(IY1 - by0 + 0.3, 3)], ['c', -3.45, round(-6.15 - DY, 3), 0.45], ['c', 3.45, round(-6.15 - DY, 3), 0.45]]

def decor(bd, lod, rng, cols):
    hi = lod == 0
    # ---- the treasure vault dais (front south corner): stone plinth, open chests overflowing, gold heaps, gems, a crown on a cushion ----
    dx0, dx1, dy0, dy1 = IX0, -5.55, IY0, -3.3; dcx, dcy = (dx0 + dx1) / 2, (dy0 + dy1) / 2
    PT = display_plinth(bd, dx0, dx1, dy0, dy1, lod)   # [pass2] BANKSY: the pale stone block read as out of place / low-res
    chest(bd, dcx - 0.05, dcy - 0.7, PT, 0.25, lod, rng, open_=True, s=0.9)
    chest(bd, dcx + 0.1, dcy + 0.85, PT, -0.35, lod, rng, s=0.75)
    coins(bd, dcx + 0.6, dcy + 0.05, PT, 0.36, 0.22, lod, rng)
    lathe(bd, [(0.0, 0.0), (0.26, 0.0), (0.27, 0.05), (0.24, 0.12), (0.0, 0.13)], dcx - 0.45, dcy + 0.05, PT, CRIM, n=12 if hi else 6)   # tasselled cushion
    crown(bd, dcx - 0.45, dcy + 0.05, PT + 0.12, 0.26, lod)
    if hi:
        for (gx, gy_, c) in ((0.35, -0.35, RUBY), (0.7, 0.35, EMER), (-0.15, 0.4, SAPH), (0.75, -0.5, RUBY)): gem(bd, dcx + gx, dcy + gy_, PT + 0.05, c, 0.06)
        for k in range(4): bd.cyl(0.04, 0.04, 0.9, dx1 + 0.08, dy0 + 0.4 + k * 0.9, 0, BRASS, n=6); bd.sphere(0.06, dx1 + 0.08, dy0 + 0.4 + k * 0.9, 0.92, GOLD, sub=0)
        for k in range(3): bd.cyl(0.02, 0.02, 0.9, dx1 + 0.08, dy0 + 0.4 + k * 0.9, 0.75, CRIM, n=4, rx=-math.pi / 2)
    if cols is not None: cols += [['b', round(dcx + 0.05, 3), round(-dcy, 3), round(dx1 - dx0 + 0.2, 3), round(dy1 - dy0 + 0.1, 3)]]
    # ---- the north front corner: a stack of chests + doubloon barrels ----
    # [AAA] spacing: one open chest + a closed one by the door (the stacked chest + the barrel are gone: a clear way in)
    chest(bd, 6.9, -5.75, FLOOR, math.pi / 2, lod, rng, open_=True)
    chest(bd, 6.95, -4.75, FLOOR, math.pi / 2 + 0.12, lod, rng, s=0.85)
    if cols is not None: cols += [['b', 6.9, 5.3, 1.4, 2.1]]
    sign_board(bd, 'HIGH STAKES', IX1 - 0.06, -5.1, 5.42, 2.7, 0.8, lod, rz=-math.pi / 2)
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

def lining(bd, segs, ceil, hi, fleur=True):   # mahogany wainscot + damask + [AAA] gilt entablature at 4.5 m + framed upper panels (local -y = into the room)
    for (p, q, rz_) in segs:
        L = math.dist(p, q); mx, my = (p[0] + q[0]) / 2, (p[1] + q[1]) / 2
        bd.push(T(mx, my, 0, rz=rz_))
        bd.box(L, 0.04, ceil - 1.3, 0, 0.0, 1.3, DAMASK, base=True)
        wainscot(bd, L, hi)   # [pass2] (the flat gilt '+' crosses are gone: gilt panel mouldings, oil paintings + compass medallions, wall_art())
        bd.pop()
    entablature(bd, segs, hi)
    upper_panels(bd, segs, ceil, hi)

NAMES = dict(blackjack='PIRATE BLACKJACK', roulette='BUCCANEER ROULETTE', dice="DEAD MAN'S DICE", slots='TREASURE SLOTS')
def wing_int(bd, lod, rng, cols):
    hi = lod == 0; iw, idp = WIX1 - WIX0, WIY1 - WIY0; cym = (WIY0 + WIY1) / 2
    boards(bd, WIX0, WIX1, WIY0, WIY1, hi, rng)   # [pass2] staggered polished boards
    # walls: sides, the end wall, the hall's back wall on this side (around the arch)
    fy = WIY0 + 0.03
    lining(bd, [((WIX0 + 0.03, WIY0), (WIX0 + 0.03, WIY1), math.pi / 2), ((WIX1 - 0.03, WIY0), (WIX1 - 0.03, WIY1), -math.pi / 2),
                ((WIX0, WIY1 - 0.03), (WIX1, WIY1 - 0.03), 0.0), ((-BA_W / 2 - 0.35, fy), (WIX0, fy), math.pi), ((WIX1, fy), (BA_W / 2 + 0.35, fy), math.pi)], WCEIL, hi, fleur=False)
    bd.box(BA_W + 0.7, 0.04, WCEIL - (BA_SPRING + BA_RISE), 0, fy, BA_SPRING + BA_RISE, DAMASK, base=True)
    for s_ in (-1, 1): bd.box(0.35, 0.14, BA_SPRING + BA_RISE, s_ * (BA_W / 2 + 0.175), fy + 0.04, FLOOR, MAHOG_D, base=True)
    arch_ring(bd, 0, BA_W / 2, BA_SPRING, BA_RISE, fy + 0.03, 0.12, 0.2, GOLD_D, 9 if hi else 5, rng, keyc=GOLD)
    sign_board(bd, 'THE GOLDEN DOUBLOON', 0, fy + 0.08, 5.4, 5.0, 0.86, lod, rz=math.pi)
    # lit windows (inside faces of the leaded glass) flanked by sconces, pilasters between the bays
    for (xe, rz_) in ((WIX0, math.pi / 2), (WIX1, -math.pi / 2)):
        for yy in (13.9, 19.7, 25.0):
            bd.push(T(xe, yy, 0, rz=rz_))
            bd.box(1.1, 0.05, 1.1, 0, -0.06, 3.2, GLOW, mat=1, base=True); bd.cyl(0.55, 0.55, 0.05, 0, -0.06, 4.3, GLOW, n=12 if hi else 6, rx=math.pi / 2, mat=1)
            bd.box(1.36, 0.12, 0.1, 0, -0.1, 3.1, GOLD_D, base=True)
            for sx in (-1, 1):
                bd.box(0.1, 0.12, 1.2, sx * 0.62, -0.1, 3.1, GOLD_D, base=True)
                if not (25.6 < yy + sx * 1.15 * (1 if rz_ > 0 else -1) < 29.6): sconce(bd, sx * 1.15, -0.06, 2.75, lod, out=-1)
            bd.pop()
            light(bd, xe + (0.9 if xe < 0 else -0.9), yy, 3.9, 0.18, 3.0, lod)
        for yy in (8.3, 30.2):
            bd.push(T(xe, yy, 0, rz=rz_)); bd.box(0.5, 0.18, WCEIL - 0.65, 0, -0.09, FLOOR, MAHOG_D, base=True)
            bd.box(0.62, 0.26, 0.3, 0, -0.12, FLOOR, MAHOG, base=True); bd.box(0.66, 0.26, 0.32, 0, -0.12, WCEIL - 0.85, GOLD_D, base=True); bd.box(0.74, 0.3, 0.1, 0, -0.14, WCEIL - 0.55, GOLD, base=True)
            bd.pop()
    # [AAA] the coffered ceiling (raised to 7 m) + grand chandeliers down the aisle; every table has its own lamp (pendant())
    ceiling(bd, WIX0, WIX1, WIY0, WIY1, WCEIL, WZ2 - 0.05, 4, 8, lod)
    for yy in WCH: chandelier(bd, 0, yy, 4.95, 1.05, 10, WCEIL - 0.45, lod, I=0.7, reach=7.0)
    # the crimson runner from the arch to the bar, two doubloon rugs
    ry0, ry1 = WIY0 - 0.3, 30.8
    bd.box(2.0, ry1 - ry0, 0.012, 0, (ry0 + ry1) / 2, FLOOR, CRIM, base=True, mat='cas_carpet')
    for s_ in (-1, 1): bd.box(0.1, ry1 - ry0, 0.014, s_ * 0.88, (ry0 + ry1) / 2, FLOOR, GOLD_D, base=True)
    if hi:
        for s_ in (-1, 1): bd.box(0.03, ry1 - ry0, 0.016, s_ * 0.75, (ry0 + ry1) / 2, FLOOR, GOLD, base=True)
    for RY in (13.9, 19.7, 25.0):
        bd.cyl(1.5, 1.5, 0.016, 0, RY, FLOOR + 0.002, CRIM, n=24 if hi else 10, mat='cas_carpet'); bd.torus(1.4, 0.04, 0, RY, FLOOR + 0.02, GOLD_D, n=24 if hi else 10, m_=3)
        bd.cyl(0.7, 0.7, 0.02, 0, RY, FLOOR + 0.004, GOLD_D, n=20 if hi else 8); bd.cyl(0.58, 0.58, 0.024, 0, RY, FLOOR + 0.006, GOLD, n=20 if hi else 8)
    # one game per table
    roman = {2: 'II', 3: 'III'}
    for (g, n_, cx, cy, rz, ex) in WING:
        sg = -1 if cx < 0 else 1; wall = WIX0 if sg < 0 else WIX1
        place(bd, g, lod, rng, cx, cy, rz, WCEIL)
        sign_board(bd, NAMES[g] + ' ' + roman[n_], wall - sg * 0.06, cy, 5.5, 3.5, 0.84, lod, rz=-sg * math.pi / 2)
        if cols is not None:
            inner = {'blackjack': cx, 'roulette': cx - sg * 0.85, 'dice': cx - sg * 0.9}[g]; dep = {'blackjack': 3.2, 'roulette': 3.6, 'dice': 3.1}[g]
            cols.append(['b', round((wall + inner) / 2, 3), round(-cy, 3), round(abs(wall - inner), 3), dep])
            if g == 'blackjack': cols.append(['c', cx, round(-cy, 3), 1.55])
    for (cx, cy, rz) in WSLOTS:
        sg = -1 if cx < 0 else 1; wall = WIX0 if sg < 0 else WIX1
        place(bd, 'slots', lod, rng, cx, cy, rz, WCEIL)
        sign_board(bd, NAMES['slots'], wall - sg * 0.06, cy, 5.5, 3.3, 0.84, lod, rz=-sg * math.pi / 2)
        if cols is not None: cols.append(['b', round((wall + cx - sg * 0.5) / 2, 3), round(-cy, 3), round(abs(wall - (cx - sg * 0.5)), 3), 4.1])
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
        for dy in (-SLOT_DY, 0.0, SLOT_DY): out.append(dict(id='casino_slots_%d' % k, game='slots', c=[cx, round(-(cy + dy), 3)], e=[round(cx - sg * 1.55, 3), round(-(cy + dy), 3)])); k += 1
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

def inside_rooms(P):   # interior corners that get the baked light (hall + wing volumes; never the facade, roofs or the back wall's outer face)
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    hall = (x > IX0 - 0.08) & (x < IX1 + 0.08) & (y > IY0 - 0.08) & (y < IY1 + 0.05) & (z > -0.3) & (z < Z2 - 0.12)
    arch = (x > -BA_W / 2 - 0.4) & (x < BA_W / 2 + 0.4) & (y >= IY1 + 0.05) & (y < Y1 + 0.05) & (z > -0.3) & (z < BA_SPRING + BA_RISE + 0.1)
    wing = (x > WIX0 - 0.08) & (x < WIX1 + 0.08) & (y > Y1 - 0.05) & (y < WIY1 + 0.08) & (z > -0.3) & (z < WZ2 - 0.02)
    return hall | arch | wing
def amb_rooms(P):   # ambient by height: the floor + tables keep their colour, the upper walls + ceiling fall into warm shadow
    return 0.86 - 0.3 * np.clip((P[:, 2] - 1.6) / 6.0, 0, 1)

for lod in (0, 1):
    rng = np.random.default_rng(4747 + lod); random.seed(47)
    bd = Builder(); bd.ground = lambda x, y: 0.0
    exterior(bd, lod, rng); interior(bd, lod, rng, cols if lod == 0 else None)
    me = bd.bake(f'casino_hall_LOD{lod}'); me.validate(clean_customdata=False)
    nlit = light_bake(me, LIGHTS, inside_rooms, amb_rooms)
    for m in MATS: me.materials.append(m)
    o = bpy.data.objects.new(f'casino_hall_LOD{lod}', me); coll.objects.link(o); o.parent = root; rep[f'LOD{lod}'] = bd.tris()
    print('LOD', lod, 'tris', rep[f'LOD{lod}'], 'lit corners', nlit, 'lights', len(LIGHTS), flush=True)
cols = [[q[0]] + [round(float(v), 3) for v in q[1:]] for q in cols]
tables = {k: dict(c=[round(v['c'][0], 3), round(-v['c'][1], 3)], e=[round(v['e'][0], 3), round(-v['e'][1], 3)]) for k, v in ST.items()}   # three.js building frame
root['colliders'] = json.dumps(cols); root['tables'] = json.dumps(tables); root['wing'] = json.dumps(dict(tables=wing_tables(), x0=-WX, x1=WX, y0=round(-Y1, 3), y1=round(-WYE, 3), inner=[WIX0, round(-WIY1, 3), WIX1, round(-WIY0, 3)], ceil=WCEIL, chand=[round(-y, 3) for y in WCH], arch=BA_W))
root['footprint'] = json.dumps(dict(cx=CX, cz=CZ, w=W, d=D, inner=[round(IX0, 3), round(-IY1, 3), round(IX1, 3), round(-IY0, 3)], arch=ARCH_W, archH=ARCH_SPRING + ARCH_RISE, ceil=CEIL))
root['dealers'] = json.dumps(DEALERS); root['kind'] = 'casino'; root['n'] = 47
# [AAA] the instanced table kit placements + the soft light pools / flame halos js/island/casino.js lays over the baked lighting
root['kit'] = json.dumps(KIT); root['pools'] = json.dumps(POOLS); root['halos'] = json.dumps(HALOS)
root['lamps'] = json.dumps([[round(l[0], 3), round(l[2], 3), round(-l[1], 3)] for l in LIGHTS if l[3] >= 0.7])   # the strong ones (chandeliers + table lamps) for the realtime light rig

# ---------------- [AAA] the table kit: one sculpted model per game (LOD0 + LOD1), instanced at every station ----------------
RECORD = False
kcoll = bpy.data.collections.new('casino_tables'); bpy.context.scene.collection.children.link(kcoll)
kroot = bpy.data.objects.new('casino_tables', None); kcoll.objects.link(kroot)
KLIGHTS = dict(blackjack=[(0.0, -0.62, 2.85, 0.95, 3.6)], roulette=[(-0.35, 0.0, 2.85, 0.95, 3.6)], dice=[(0.0, 0.0, 2.85, 0.95, 3.6)],
               slots=[(px, 0.1, 2.28, 0.32, 1.8) for px in (-SLOT_DY / 2, SLOT_DY / 2, -SLOT_DY * 1.5, SLOT_DY * 1.5)] + [(0.0, -1.6, 2.6, 0.45, 3.5)])
krep = {}
for kind in ('blackjack', 'roulette', 'dice', 'slots'):
    for lod in (0, 1):
        rng = np.random.default_rng(910 + lod); random.seed(47)
        bd = Builder(); bd.ground = lambda x, y: 0.0
        TB[kind](bd, lod, rng, 0.0, 0.0, 0.0)
        me = bd.bake(f'{kind}_LOD{lod}'); me.validate(clean_customdata=False)
        light_bake(me, KLIGHTS[kind], lambda P: np.ones(len(P), bool), lambda P: 0.8 - 0.1 * np.clip(1 - P[:, 2] / 0.8, 0, 1), lo=0.45, hi_=1.35)
        for m in MATS: me.materials.append(m)
        o = bpy.data.objects.new(f'{kind}_LOD{lod}', me); kcoll.objects.link(o); o.parent = kroot; krep[f'{kind}_LOD{lod}'] = bd.tris()
print('KIT', krep, flush=True)
# printed felts (three.js kit frame: x, z = -y, y up): js/island/casinoFelt.js draws the layouts at these sizes
kroot['felts'] = json.dumps(dict(
    blackjack=dict(shape='d', r=1.34, y=FELT_Z['blackjack']),
    roulette=dict(shape='rect', hx=round(ROU_TL / 2 - 0.18, 3), hz=round(ROU_TW / 2 - 0.18, 3), rr=0.16, y=FELT_Z['roulette'], wheel=[ROU_WX, 0.0, 0.64]),
    dice=dict(shape='rect', hx=round(DICE_PL / 2 - 0.17, 3), hz=round(DICE_PW / 2 - 0.17, 3), rr=0.2, y=FELT_Z['dice'])))
kroot['kind'] = 'casino_tables'

json.dump(dict(report=rep, kit=krep, colliders=cols, tables=tables, placements=KIT, pools=len(POOLS), halos=len(HALOS), lights=len(LIGHTS)), open(os.path.join(OUT, 'casino_report.json'), 'w'), indent=1)
def export(objs, f):
    for o in bpy.data.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    kw = dict(filepath=f, export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True)
    try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
    except TypeError: bpy.ops.export_scene.gltf(**kw)
    print('EXPORTED', f, os.path.getsize(f), flush=True)
export([root] + list(root.children), os.path.join(OUT, 'casino_hall_raw.glb'))
export([kroot] + list(kroot.children), os.path.join(OUT, 'casino_tables_raw.glb'))
print('DONE', rep, flush=True)
