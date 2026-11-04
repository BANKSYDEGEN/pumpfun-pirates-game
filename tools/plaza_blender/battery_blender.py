# [Timothy] PUMPFUN PIRATES headland battery in Blender (BANKSY "do the plaza and cannon area all in blender"):
#   blender -b --factory-startup -P tools/plaza_blender/battery_blender.py -- OUT_DIR
# Same footprint / walk heights as js/island/battery.js (RAMP / FOOT / LANDING / BATTERY / GUNS are copied below; the terrain stays the
# walkable surface, the paving sits 0.5-1.4 cm above it, drawn with a polygon offset). Output: battery_raw.glb with
#   battery_LOD0 / battery_LOD1  static art in the battery-local frame (x = lx - 160, glTF z = lz - 42, y = world height)
#   gun_carriage                 origin on the deck under the gun, muzzle towards +z (glTF), trunnions at (0, 1.2, 0.15)
#   gun_barrel                   origin = the trunnion pivot (createGuns PIV), bore along +z, muzzle tip at z 2.45
# Rocks are seated on the real terrain (battery_terrain.json = foot.js H() sampled on a 2 m grid, tools: game_shots-style probe).
import bpy, sys, os, math, json, random
import numpy as np
from mathutils import Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Builder, T, hexc
OUT = sys.argv[sys.argv.index('--') + 1]; os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
HJ = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'battery_terrain.json'))); HG = np.array(HJ['h'])
def Ht(lx, lz):   # bilinear terrain height (town-local)
    fx, fz = (lx - HJ['lx0']) / HJ['step'], (lz - HJ['lz0']) / HJ['step']; i, j = int(math.floor(fx)), int(math.floor(fz)); u, v = fx - i, fz - j
    i = min(max(i, 0), HG.shape[1] - 2); j = min(max(j, 0), HG.shape[0] - 2)
    return (HG[j, i] * (1 - u) + HG[j, i + 1] * u) * (1 - v) + (HG[j + 1, i] * (1 - u) + HG[j + 1, i + 1] * u) * v
B = dict(lx=160, lz=42, ring=15, y=21, deckR=22, paveR=20)
RAMP = dict(lx0=122, lx1=174, lz0=-4, lz1=4, y0=2.6, y1=21); FOOT = dict(lx0=110, lx1=122, lz0=-4, lz1=4); LANDING = dict(lx0=174, lx1=186, lz0=-4, lz1=20)
GUNS = [dict(a=-0.75 + i * 0.3) for i in range(6)]
for g in GUNS: g['lx'] = B['lx'] + math.sin(g['a']) * B['ring']; g['lz'] = B['lz'] + math.cos(g['a']) * B['ring']
rampY = lambda lx: RAMP['y0'] + (RAMP['y1'] - RAMP['y0']) * min(1, max(0, (lx - RAMP['lx0']) / (RAMP['lx1'] - RAMP['lx0'])))
P = lambda lx, lz: (lx - B['lx'], -(lz - B['lz']))           # town-local -> battery-local Blender x, y
STONE, STONE_D, PAVE, GROUT, IRON, WOOD, WOOD_D, GOLD, BRASS = 0xb9b2a6, 0x8a837a, 0xc4b8a2, 0x6f675d, 0x2b2f36, 0xa86a3a, 0x5e3b20, 0xffc93c, 0xc9a243
ROCK, MOSS = 0x8f8578, 0x4f8a3a
# [material library] palette -> shared library layer (materials.py): walls ashlar, coping / paving / rocks dressed sandstone, guns iron, carriages timber
Builder.AUTO = {STONE: 'stone_ashlar', STONE_D: 'stone_trim', PAVE: 'stone_trim', GROUT: 'stone_trim', ROCK: 'stone_trim', IRON: 'iron', WOOD: 'timber', WOOD_D: 'timber'}

def wall(b, lx, lz, length, top, alongZ, lod, rng, th=0.8):
    x, y = P(lx, lz); sx, sy = (th, length) if alongZ else (length, th)
    b.box(sx, sy, 8.0, x, y, top - 8.0, STONE, base=True)
    b.box(sx + 0.2 if alongZ else sx + 0.04, sy + 0.04 if alongZ else sy + 0.2, 0.22, x, y, top + 0.08, STONE_D)
    if lod == 0:   # ashlar relief on both faces of the visible top metre
        for s in (-1, 1):
            for r in range(2):
                n = int(length / 0.75); off = 0.37 if r % 2 else 0
                for i in range(n):
                    a = -length / 2 + off + i * 0.75
                    if a + 0.7 > length / 2: break
                    c = hexc(STONE, 0.08, rng); zc = top - 0.28 - r * 0.42
                    if alongZ: b.box(0.05, 0.7, 0.38, x + s * (th / 2 + 0.02), y + a + 0.35, zc, c)
                    else: b.box(0.7, 0.05, 0.38, x + a + 0.35, y + s * (th / 2 + 0.02), zc, c)

def pave_rect(b, lx0, lx1, lz0, lz1, yf, lod, rng, sw=0.9, sd=0.6):
    # grout slab + flagstones (top faces only), following y = yf(lx)
    n = max(1, int((lx1 - lx0) / 3))
    for i in range(n):
        a, c = lx0 + i * (lx1 - lx0) / n, lx0 + (i + 1) * (lx1 - lx0) / n
        V = [(*P(a, lz0), yf(a) + 0.003), (*P(c, lz0), yf(c) + 0.003), (*P(c, lz1), yf(c) + 0.003), (*P(a, lz1), yf(a) + 0.003)]
        b.mesh(V, [(3, 2, 1, 0)], GROUT, smooth=False)
    if lod > 0: return
    rows = int((lz1 - lz0) / sd)
    for r in range(rows):
        z0 = lz0 + r * sd; off = (r % 2) * sw / 2; x = lx0 - off
        while x < lx1:
            a, c = max(lx0, x + 0.03), min(lx1, x + sw - 0.03)
            if c - a > 0.15:
                za, zc = z0 + 0.03, z0 + sd - 0.03; col = hexc(PAVE, 0.09, rng)
                V = [(*P(a, za), yf(a) + 0.006), (*P(c, za), yf(c) + 0.006), (*P(c, zc), yf(c) + 0.006), (*P(a, zc), yf(a) + 0.006)]
                b.mesh(V, [(3, 2, 1, 0)], col, smooth=False)
            x += sw

def pave_disc(b, lod, rng):
    cx, cy = 0, 0; z = B['y']; n = 48 if lod == 0 else 24; R = B['paveR']
    V = [(0, 0, z + 0.003)] + [(math.cos(2 * math.pi * i / n) * R, math.sin(2 * math.pi * i / n) * R, z + 0.003) for i in range(n)]
    b.mesh(V, [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)], GROUT, smooth=False)
    if lod > 0: return
    r = 1.2
    while r < R - 0.05:
        r1 = min(R, r + 1.0); m = max(6, int(2 * math.pi * r / 1.1)); ph = rng.uniform(0, 1)
        for i in range(m):
            a0 = 2 * math.pi * (i + ph) / m + 0.02 / r; a1 = 2 * math.pi * (i + 1 + ph) / m - 0.02 / r; ra, rb = r + 0.03, r1 - 0.03
            V = [(math.cos(a0) * ra, math.sin(a0) * ra, z + 0.006), (math.cos(a1) * ra, math.sin(a1) * ra, z + 0.006), (math.cos(a1) * rb, math.sin(a1) * rb, z + 0.006), (math.cos(a0) * rb, math.sin(a0) * rb, z + 0.006)]
            b.mesh(V, [(3, 2, 1, 0)], hexc(PAVE, 0.09, rng), smooth=False)
        r = r1
    # brass compass star inlaid at the centre
    pts = []
    for i in range(16):
        a = 2 * math.pi * i / 16; rr = 1.15 if i % 4 == 0 else (0.7 if i % 2 == 0 else 0.35); pts.append((math.cos(a) * rr, math.sin(a) * rr, z + 0.007))
    b.mesh([(0, 0, z + 0.007)] + pts, [(0, 1 + i, 1 + (i + 1) % 16) for i in range(16)], BRASS, smooth=False)

def rock(b, x, y, z, r, rng, lod, squash=0.7):
    import bmesh
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=1 if lod == 0 else 0, radius=1.0)
    V = np.array([v.co[:] for v in bm.verts]); F = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
    V = V * (1 + rng.uniform(-0.22, 0.22, (len(V), 1))) * [r * rng.uniform(0.8, 1.25), r * rng.uniform(0.8, 1.25), r * squash]
    V = np.round(V / (r * 0.35)) * (r * 0.35) * 0.35 + V * 0.65          # faceted ledges
    rz = rng.uniform(0, 6.28); c, s = math.cos(rz), math.sin(rz); V = V @ np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]]).T + [x, y, z]
    nz = []
    for f in F:   # moss on the up-facing facets, rock elsewhere
        p = V[list(f)]; nrm = np.cross(p[1] - p[0], p[2] - p[0]); nrm /= (np.linalg.norm(nrm) + 1e-9)
        nz.append([hexc(MOSS, 0.15, rng) if nrm[2] > 0.72 else hexc(ROCK, 0.12, rng)] * 3)
    b.mesh(V, F, None, corner_cols=nz, smooth=False)

def barrel(b, x, y, z, lod, s=1.0, col=0x3a2a1c):
    n = 12 if lod == 0 else 7; h = 0.95 * s; r = 0.42 * s
    b.cyl(r * 0.86, r, h / 2, x, y, z, col, n=n); b.cyl(r, r * 0.86, h / 2, x, y, z + h / 2, col, n=n)
    for zz in (0.1, 0.5, 0.9): b.cyl(r * (1.0 if zz == 0.5 else 0.9) + 0.015, r * (1.0 if zz == 0.5 else 0.9) + 0.015, 0.06, x, y, z + zz * h, IRON, n=n, caps=False)

def static(lod):
    b = Builder(); rng = np.random.default_rng(5 + lod); cols = []
    # ramp + foot apron + landing pavement and the gun deck disc
    pave_rect(b, FOOT['lx0'], FOOT['lx1'], FOOT['lz0'], FOOT['lz1'], lambda lx: RAMP['y0'], lod, rng)
    pave_rect(b, RAMP['lx0'], RAMP['lx1'], RAMP['lz0'], RAMP['lz1'], rampY, lod, rng)
    pave_rect(b, LANDING['lx0'], LANDING['lx1'], LANDING['lz0'], LANDING['lz1'], lambda lx: B['y'], lod, rng)
    pave_disc(b, lod, rng)
    # ramp kerb steps (a raised edge stone every 3 m reads as a stepped stair-ramp from the quay)
    if lod == 0:
        for lx in np.arange(RAMP['lx0'] + 3, RAMP['lx1'], 3.0):
            x0, y0 = P(lx, 0); b.box(0.22, 8.0, 0.007, x0, y0, rampY(lx), STONE_D, base=True)   # flush edge course (feet: < 2 cm)
    # parapet walls: ramp (stepped 3 m pieces), landing south + east (same pieces / tops as battery.js)
    lx = RAMP['lx0'] + 1.5
    while lx < RAMP['lx1']:
        y = rampY(lx) + 1.0; wall(b, lx, RAMP['lz0'] - 0.4, 3.02, y, False, lod, rng); wall(b, lx, RAMP['lz1'] + 0.4, 3.02, y, False, lod, rng); lx += 3
    lx = LANDING['lx0'] + 1.5
    while lx < LANDING['lx1'] + 0.8: wall(b, lx, LANDING['lz0'] - 0.4, 3.02, B['y'] + 1.0, False, lod, rng); lx += 3
    lz = LANDING['lz0'] + 1.5
    while lz < LANDING['lz1'] - 4: wall(b, LANDING['lx1'] + 0.4, lz, 3.02, B['y'] + 1.0, True, lod, rng); lz += 3
    # gun deck parapet: embrasures (low) at the guns, merlons between, with splayed cheeks + a cordon
    a = -1.05
    while a <= 1.051:
        g = any(abs(q['a'] - a) < 0.08 for q in GUNS); r = B['ring'] + 4.4; x, y = P(B['lx'] + math.sin(a) * r, B['lz'] + math.cos(a) * r)
        top = B['y'] + (0.75 if g else 1.35); rz = -a   # Blender: face the sea
        b.push(T(x, y, 0, rz=rz))
        b.box(3.2, 1.2, 8.0, 0, 0, top - 8.0, STONE, base=True); b.box(3.3, 1.4, 0.22, 0, 0, top + 0.08, STONE_D)
        if lod == 0:
            for r2 in range(2 if g else 3):
                for i in range(4):
                    b.box(0.74, 0.05, 0.38, -1.2 + i * 0.8 + (0.4 if r2 % 2 else 0) * (i < 3), 0.62, top - 0.28 - r2 * 0.42, hexc(STONE, 0.08, rng))
                    b.box(0.74, 0.05, 0.38, -1.2 + i * 0.8 + (0.4 if r2 % 2 else 0) * (i < 3), -0.62, top - 0.28 - r2 * 0.42, hexc(STONE, 0.08, rng))
            if g:
                for s in (-1, 1): b.box(0.3, 1.25, 0.5, s * 1.45, 0, top + 0.19, STONE_D, base=True)   # embrasure cheeks
        b.pop(); a += 0.15
    # cordon round the rim + the cliff-face skirt under it (masonry fading into rock)
    # shot piles + powder kegs beside each gun (positions = battery.js)
    for q in GUNS:
        side = -1 if q['a'] < 0 else 1; px, pz = math.cos(q['a']) * side, -math.sin(q['a']) * side
        sx, sz = q['lx'] + px * 2.4 - math.sin(q['a']) * 1.2, q['lz'] + pz * 2.4 - math.cos(q['a']) * 1.2
        kx, kz = q['lx'] + px * 2.4 - math.sin(q['a']) * 3.2, q['lz'] + pz * 2.4 - math.cos(q['a']) * 3.2
        x, y = P(sx, sz); b.box(1.0, 1.0, 0.1, x, y, B['y'], WOOD_D, base=True, rz=-q['a'])
        for lvl, n in enumerate((3, 2, 1)):
            for i in range(n):
                for j in range(n):
                    ox, oy = (i - (n - 1) / 2) * 0.3, (j - (n - 1) / 2) * 0.3; c, s_ = math.cos(-q['a']), math.sin(-q['a'])
                    b.sphere(0.15, x + ox * c - oy * s_, y + ox * s_ + oy * c, B['y'] + 0.25 + lvl * 0.24, 0x22252b, sub=1 if lod == 0 else 0)
        x, y = P(kx, kz); barrel(b, x, y, B['y'], lod)
        if lod == 0: barrel(b, x + 0.5, y + 0.45, B['y'], lod, 0.7); b.box(0.32, 0.02, 0.18, x, y - 0.42, B['y'] + 0.45, 0xd8322f, base=True)
        # rammer + sponge leaning on the parapet
        if lod == 0:
            x, y = P(q['lx'] - px * 1.9, q['lz'] - pz * 1.9); b.cyl(0.03, 0.03, 3.0, x, y, B['y'], WOOD, n=5, rx=0.35, rz=-q['a']); b.cyl(0.09, 0.09, 0.3, x, y - 0.0, B['y'] + 2.75, 0xd9c39a, n=6, rx=0.35, rz=-q['a'])
    # the flag: a tall pole at the back of the deck with a black skull flag (collider: battery.js FLAG)
    fx, fy = P(FLAG[0], FLAG[1])
    b.cyl(0.5, 0.55, 0.5, fx, fy, B['y'], STONE_D, n=10); b.cyl(0.09, 0.07, 11.0, fx, fy, B['y'] + 0.5, WOOD_D, n=8); b.sphere(0.16, fx, fy, B['y'] + 11.6, GOLD, sub=1)
    nseg = 5 if lod == 0 else 2
    for i in range(nseg):   # waving flag strips
        w = 3.2 / nseg; xx = fx + 0.1 + (i + 0.5) * w; wave = math.sin(i * 1.3) * 0.18
        b.box(w + 0.01, 0.04, 2.0, xx, fy + wave, B['y'] + 10.4, 0x141414)
    if lod == 0:   # skull + crossbones
        b.sphere(0.32, fx + 1.7, fy + math.sin(2 * 1.3) * 0.18 - 0.05, B['y'] + 10.6, 0xf2efe6, sub=1, s=(1, 0.2, 1))
        for s in (-1, 1): b.box(1.3, 0.05, 0.12, fx + 1.7, fy + math.sin(2 * 1.3) * 0.18 - 0.05, B['y'] + 10.0, 0xf2efe6, ry=s * 0.6)
    # rocky cliff dressing: faceted mossy boulders seated on the terrain round the seaward rim, below the landing and along the ramp's
    # outer foot (never on a walkable surface: outside the deck / ramp / landing / apron rects + 1.5 m)
    rr = random.Random(3); tr = random.Random(4)   # [collisions] tufts on their own stream: desktop + phone now get the SAME boulders (the colliders match both)
    def walk_clear(lx, lz):
        def rd(R): return math.hypot(max(R['lx0'] - lx, 0, lx - R['lx1']), max(R['lz0'] - lz, 0, lz - R['lz1']))
        return math.hypot(lx - B['lx'], lz - B['lz']) > B['deckR'] + 1.6 and rd(RAMP) > 1.6 and rd(LANDING) > 1.6 and rd(FOOT) > 2.0
    spots = []
    for i in range(70):
        t = rr.random()
        if t < 0.55: a = rr.uniform(-1.6, 1.6); r = rr.uniform(B['deckR'] + 2.5, B['deckR'] + 9); lx, lz = B['lx'] + math.sin(a) * r, B['lz'] + math.cos(a) * r
        elif t < 0.8: lx, lz = rr.uniform(RAMP['lx0'] + 6, RAMP['lx1']), rr.choice([-1, 1]) * rr.uniform(6.5, 11)
        else: lx, lz = rr.uniform(LANDING['lx1'] + 2, LANDING['lx1'] + 8), rr.uniform(-8, 22)
        if not walk_clear(lx, lz): continue
        h = Ht(lx, lz); r = rr.uniform(1.0, 2.6); x, y = P(lx, lz); rock(b, x, y, h - r * 0.25, r, rng, lod)
        if lod == 0: ROCKS.append([round(lx, 2), round(lz, 2), round(r * 0.95, 2)])   # [collisions] battery.js adds a circle per boulder
        if lod == 0 and tr.random() < 0.45:   # tufts of foliage at the base
            for k in range(3): b.box(0.12, 0.7, 0.04, x + tr.uniform(-r, r), y + tr.uniform(-r, r), h + 0.1, 0x3fa645, rx=0.6, rz=tr.uniform(0, 6.28), base=True)
    return b

FLAG = (151.0, 31.5); ROCKS = []
def carriage():
    b = Builder()   # gun frame (Blender): -y = muzzle direction (three +z), origin on the deck
    for s in (-1, 1):   # stepped cheeks (brackets)
        b.push(T(s * 0.55, 0, 0))
        b.box(0.18, 1.9, 0.5, 0, 0.05, 0.45, WOOD, base=True)
        b.box(0.18, 1.3, 0.35, 0, 0.35, 0.95, WOOD, base=True)
        b.box(0.18, 0.7, 0.25, 0, 0.0, 1.3, WOOD, base=True)        # trunnion seat (top at 1.55: barrel trunnion at 1.2 sits in the notch)
        b.box(0.2, 0.25, 0.08, 0, -0.15, 1.3, IRON, base=True)          # capsquare
        b.pop()
    b.box(0.95, 1.7, 0.16, 0, 0.1, 0.42, WOOD_D, base=True)            # bed
    b.box(0.9, 0.3, 0.3, 0, 0.6, 0.62, WOOD_D, base=True); b.box(0.5, 0.6, 0.18, 0, 0.55, 0.92, 0x8a5a2b, base=True, rx=-0.15)   # quoin wedge
    for yy, r in ((-0.75, 0.4), (0.85, 0.36)):                         # trucks + axletrees
        b.cyl(0.07, 0.07, 1.6, -0.8, yy, r, IRON, n=6, ry=math.pi / 2)
        for s in (-1, 1):
            b.cyl(r, r, 0.16, s * 0.72 - (0.16 if s > 0 else 0) * 0 + (0 if s > 0 else -0.16), yy, r, WOOD_D, n=12, ry=math.pi / 2)
            b.cyl(0.08, 0.08, 0.2, s * 0.74 - (0 if s > 0 else 0.2), yy, r, IRON, n=6, ry=math.pi / 2)
    for s in (-1, 1): b.torus(0.08, 0.02, s * 0.66, 0.8, 0.7, IRON, n=8, m_=4, ry=math.pi / 2)    # ring bolts
    return b
def barrel_gun():
    b = Builder()   # origin = trunnions; bore along -y (three +z); breech towards +y
    prof = [(0.0, 0.72), (0.16, 0.74), (0.2, 0.86), (0.4, 0.92), (0.44, 1.02), (0.44, 1.12), (0.4, 1.18), (0.38, 1.2), (0.36, 0.0), (0.33, -0.05), (0.33, -1.6), (0.36, -1.7), (0.4, -1.98), (0.4, -2.12), (0.34, -2.2), (0.3, -2.45)]
    # lathe the profile (r, y)
    n = 14; V = []; F = []
    for (r, y) in prof:
        for i in range(n): a = 2 * math.pi * i / n; V.append((math.cos(a) * r, y, math.sin(a) * r))
    for k in range(len(prof) - 1):
        for i in range(n): F.append((k * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n, (k + 1) * n + i))
    b.mesh(V, F, 0x1d2026, smooth=True)
    b.cyl(0.22, 0.22, 0.02, 0, -2.45, 0, 0x050505, n=12, rx=math.pi / 2)          # bore
    b.sphere(0.16, 0, 1.0, 0, 0x1d2026, sub=1)                                      # cascabel knob
    b.cyl(0.13, 0.13, 1.25, -0.62, 0, 0, 0x1d2026, n=10, ry=math.pi / 2)            # trunnions
    b.cyl(0.46, 0.46, 0.1, 0, 0.6, 0, GOLD, n=14, rx=math.pi / 2, caps=False)     # brass base ring
    b.cyl(0.39, 0.39, 0.06, 0, -1.65, 0, GOLD, n=14, rx=math.pi / 2, caps=False)
    b.box(0.12, 0.2, 0.06, 0, 0.45, 0.43, 0x1d2026)                                # vent
    return b

def mats():
    out = []
    for nm, kind in (('plaza_solid', 0), ('plaza_glow', 1), ('plaza_glass', 2)):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        out.append(m)
    return out
MATS = mats(); COLL = bpy.data.collections.new('battery'); bpy.context.scene.collection.children.link(COLL); REP = {}
root = bpy.data.objects.new('battery', None); COLL.objects.link(root)
for name, bld in (('battery_LOD0', lambda: static(0)), ('battery_LOD1', lambda: static(1)), ('gun_carriage', carriage), ('gun_barrel', barrel_gun)):
    b = bld(); me = b.bake(name); me.validate(clean_customdata=False)
    for m in MATS: me.materials.append(m)
    o = bpy.data.objects.new(name, me); COLL.objects.link(o); o.parent = root; REP[name] = b.tris(); print(name, b.tris())
root['flag'] = json.dumps(FLAG); root['rocks'] = json.dumps(ROCKS)
json.dump(REP, open(os.path.join(OUT, 'battery_report.json'), 'w'))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'battery.blend'))
for o in bpy.data.objects: o.select_set(True)
kw = dict(filepath=os.path.join(OUT, 'battery_raw.glb'), export_format='GLB', use_selection=True, export_extras=True, export_yup=True)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('EXPORTED')
