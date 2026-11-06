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
# [cannon-hill] BANKSY "upgrade cannon hill": bastion masonry, gatehouse, powder magazine, signal mast (= battery.js MAST / GATE / MAG)
QUOIN, PLANK, ROPE_C, WICKER, KEG, PARCH, IRON_D, EMBER, FLAME = 0xd3cbbd, 0x8b6a45, 0xc8a46a, 0x8c6a3c, 0x6e4526, 0xe6d3a3, 0x1f2227, 0xff7a1e, 0xffc24a
MAST = dict(lx=160.0, lz=42.0, top=17.0); GATE = dict(lx=172.5, hw=4.2, pw=1.8, pd=1.4); MAG = dict(a=-1.95, r=16.5, w=6.2, d=4.6)
# [material library] palette -> shared library layer (materials.py): walls ashlar, coping / paving / rocks dressed sandstone, guns iron, carriages timber
Builder.AUTO = {STONE: 'stone_ashlar', STONE_D: 'stone_trim', PAVE: 'stone_trim', GROUT: 'stone_trim', ROCK: 'stone_trim', IRON: 'iron', WOOD: 'timber', WOOD_D: 'timber',
                QUOIN: 'stone_trim', PLANK: 'planks_weathered', ROPE_C: 'rope', WICKER: 'timber', KEG: 'timber', IRON_D: 'iron'}
PA = lambda a, r: P(B['lx'] + math.sin(a) * r, B['lz'] + math.cos(a) * r)   # polar (town angle a: 0 = out to sea) -> Blender x, y

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
    # [cannon-hill] compass-rose medallion round the signal mast: dark stone band + 32-point star (brass cardinals, stone ordinals)
    ring = lambda r0, r1, zz, col, m=64: b.mesh([(math.cos(2 * math.pi * i / m) * rr, math.sin(2 * math.pi * i / m) * rr, zz) for rr in (r0, r1) for i in range(m)],
                                                [(m + i, m + (i + 1) % m, (i + 1) % m, i) for i in range(m)], col, smooth=False)
    ring(3.25, 3.75, z + 0.008, STONE_D); ring(3.75, 3.9, z + 0.008, BRASS)
    for lvl, (n, rr, w, col) in enumerate(((16, 1.9, 0.11, STONE_D), (8, 2.6, 0.16, 0x9a8f80), (4, 3.2, 0.2, BRASS))):
        for i in range(n):
            a = 2 * math.pi * i / n + (math.pi / n if lvl == 0 else (math.pi / 8 if lvl == 1 else 0)); zz = z + 0.009 + lvl * 0.001
            ca, sa = math.cos(a), math.sin(a); cl, sl = math.cos(a + math.pi / 2), math.sin(a + math.pi / 2); r0 = 1.55
            for s_ in (-1, 1):   # each point = two half-blades (light / dark) like a chart rose
                c2 = col if s_ > 0 else (0x8a6a1e if col == BRASS else STONE_D if col != STONE_D else GROUT)
                V = [(ca * r0, sa * r0, zz), (ca * rr, sa * rr, zz), (ca * r0 + cl * w * s_ * 2.2, sa * r0 + sl * w * s_ * 2.2, zz)]
                b.mesh(V, [(0, 1, 2) if s_ > 0 else (2, 1, 0)], c2, smooth=False)

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

# ---- [cannon-hill] upgrade helpers ----
from mathutils import Vector
def seg(b, p0, p1, r, col, n=5, mat=0):   # a rope / rod between two Blender points
    p0, p1 = Vector(p0), Vector(p1); d = p1 - p0; L = d.length
    b.push(Matrix.Translation(p0) @ d.normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()); b.cyl(r, r, L, 0, 0, 0, col, n=n, caps=False, mat=mat); b.pop()
def brazier(b, x, y, z, lod, s=1.0):   # iron fire basket on a short stem: glowing coals + flame tongues (glow material)
    n = 10 if lod == 0 else 6
    b.cyl(0.07 * s, 0.07 * s, 0.45 * s, x, y, z, IRON_D, n=6); b.cyl(0.16 * s, 0.42 * s, 0.32 * s, x, y, z + 0.45 * s, IRON_D, n=n)
    b.cyl(0.43 * s, 0.43 * s, 0.05 * s, x, y, z + 0.77 * s, IRON, n=n, caps=False)
    b.sphere(0.36 * s, x, y, z + 0.76 * s, EMBER, sub=1, mat=1, s=(1, 1, 0.4))
    for i in range(3 if lod == 0 else 1):
        a = i * 2.1; b.cyl(0.13 * s, 0.0, (0.55 - 0.12 * i) * s, x + math.cos(a) * 0.16 * s * (i > 0), y + math.sin(a) * 0.16 * s * (i > 0), z + 0.8 * s, FLAME if i == 0 else EMBER, n=5, mat=1)
def lantern(b, x, y, z, lod):   # hanging ship's lantern (glow pane)
    b.cyl(0.02, 0.02, 0.5, x, y, z + 0.55, IRON_D, n=4); b.cyl(0.2, 0.06, 0.16, x, y, z + 0.42, IRON_D, n=6)
    b.box(0.26, 0.26, 0.36, x, y, z + 0.06, FLAME, mat=1, base=True); b.box(0.32, 0.32, 0.06, x, y, z, IRON_D, base=True)
    if lod == 0:
        for sx in (-1, 1):
            for sy in (-1, 1): b.box(0.03, 0.03, 0.36, x + sx * 0.14, y + sy * 0.14, z + 0.06, IRON_D, base=True)
def quoins(b, x0, x1, y0, y1, z0, z1, rng):   # alternating dressed corner stones on the 4 vertical edges of a pier
    k = 0; z = z0
    while z < z1 - 0.2:
        h = min(0.48, z1 - z); L = 0.62 if k % 2 == 0 else 0.36
        for cx, sx in ((x0, 1), (x1, -1)):
            for cy, sy in ((y0, 1), (y1, -1)):
                c = hexc(QUOIN, 0.06, rng)
                b.box(L, 0.36 if k % 2 == 0 else 0.62, h - 0.04, cx + sx * (L / 2 - 0.03), cy + sy * ((0.36 if k % 2 == 0 else 0.62) / 2 - 0.03), z + 0.02, c, base=True)
        z += h; k += 1
def stack_balls(b, x, y, z, rz, lod, n0=3):   # cannonball pyramid on an iron 'monkey' frame
    c, s_ = math.cos(rz), math.sin(rz); w = n0 * 0.3 + 0.08
    for k in range(4):
        ox, oy = [(0, w / 2), (0, -w / 2), (w / 2, 0), (-w / 2, 0)][k]
        b.box(w + 0.06 if k < 2 else 0.06, 0.06 if k < 2 else w + 0.06, 0.08, x + ox * c - oy * s_, y + ox * s_ + oy * c, z, IRON_D, rz=rz, base=True)
    for lvl in range(n0):
        n = n0 - lvl
        for i in range(n):
            for j in range(n):
                ox, oy = (i - (n - 1) / 2) * 0.3, (j - (n - 1) / 2) * 0.3
                b.sphere(0.15, x + ox * c - oy * s_, y + ox * s_ + oy * c, z + 0.17 + lvl * 0.24, 0x22252b, sub=1 if lod == 0 else 0)

def signal_mast(b, lod, rng):
    # octagonal stepped plinth + iron-banded mast + yard with lanterns, shrouds, halyards, gilded truck (the flag cloth is battery.js runtime)
    fx, fy = P(MAST['lx'], MAST['lz']); z = B['y']; T8 = 8
    b.cyl(1.75, 1.75, 0.45, fx, fy, z - 0.05, STONE_D, n=T8, smooth=False); b.cyl(1.8, 1.8, 0.07, fx, fy, z + 0.38, QUOIN, n=T8, caps=False, smooth=False)
    b.cyl(1.28, 1.28, 0.5, fx, fy, z + 0.4, STONE, n=T8, smooth=False); b.cyl(1.36, 1.36, 0.1, fx, fy, z + 0.88, STONE_D, n=T8, smooth=False)
    top = z + MAST['top']; mz = z + 0.95; nm = 12 if lod == 0 else 7
    b.cyl(0.26, 0.15, top - mz, fx, fy, mz, WOOD_D, n=nm)
    for i in range(7 if lod == 0 else 3):   # iron mast bands
        zz = mz + 0.6 + i * (2.2 if lod == 0 else 4.6); r = 0.26 - 0.11 * (zz - mz) / (top - mz) + 0.025
        b.cyl(r, r, 0.12, fx, fy, zz, IRON, n=nm, caps=False)
    b.cyl(0.2, 0.2, 0.1, fx, fy, top, WOOD_D, n=nm); b.sphere(0.24, fx, fy, top + 0.28, GOLD, sub=1)   # truck + gilded ball
    # yard + crosstrees at 11.4 m, across the flag's fly direction (battery.js MAST.fly = town (-0.76, 0.65) -> Blender (-0.76, -0.65))
    fa = math.atan2(-0.65, -0.76); ya = fa + math.pi / 2; yz = z + 11.4; ux, uy = math.cos(ya), math.sin(ya)
    b.box(4.8, 0.18, 0.18, fx, fy, yz, WOOD_D, rz=ya); b.box(0.9, 0.9, 0.1, fx, fy, yz - 0.18, WOOD, rz=ya)
    for s_ in (-1, 1):
        ex, ey = fx + ux * 2.25 * s_, fy + uy * 2.25 * s_
        lantern(b, ex, ey, yz - 0.95, lod)
        if lod == 0: b.box(0.1, 0.22, 0.22, ex, ey, yz, IRON, rz=ya)   # yard-arm iron
    if lod == 0:
        for i in range(4):   # shrouds: crosstrees -> eyebolts on the plinth
            a = ya + i * math.pi / 2 + math.pi / 4; seg(b, (fx + math.cos(a) * 0.2, fy + math.sin(a) * 0.2, yz - 0.1), (fx + math.cos(a) * 1.2, fy + math.sin(a) * 1.2, z + 0.92), 0.03, ROPE_C)
            b.torus(0.07, 0.02, fx + math.cos(a) * 1.2, fy + math.sin(a) * 1.2, z + 0.93, IRON, n=8, m_=4)
        hx, hy = fx + math.cos(fa) * 0.3, fy + math.sin(fa) * 0.3   # halyards down the hoist side to a cleat
        for o in (-0.06, 0.06): seg(b, (hx + ux * o, hy + uy * o, top - 0.15), (hx + ux * o, hy + uy * o, z + 1.2), 0.022, ROPE_C, n=4)
        b.box(0.12, 0.4, 0.1, fx + math.cos(fa) * 0.32, fy + math.sin(fa) * 0.32, z + 1.6, WOOD, rz=fa)
        b.torus(0.32, 0.06, hx + 0.6 * math.cos(fa), hy + 0.6 * math.sin(fa), z + 0.95, ROPE_C, n=10, m_=4)   # coiled fall on the plinth

def gatehouse(b, lod, rng):
    # [cannon-hill] arched battery gate over the ramp head (piers on the parapet lines; walk width lz -4..4 untouched)
    lx = GATE['lx']; y0 = rampY(lx); x, yc = P(lx, 0); hw, pw, pd = GATE['hw'], GATE['pw'], GATE['pd']; W2 = hw + pd
    b.push(T(0, yc, 0))   # local y = -lz (the ramp centreline lz 0 sits at Blender y 42)
    for s_ in (-1, 1):
        cy = -s_ * (hw + pd / 2)   # Blender y = -lz
        b.box(pw + 0.3, pd + 0.3, 6.6, x, cy, y0 - 6.0, STONE_D, base=True)          # plinth
        b.box(pw, pd, 11.0, x, cy, y0 - 6.0, STONE, base=True)                        # pier (to y0 + 5)
        if lod == 0: quoins(b, x - pw / 2 - 0.02, x + pw / 2 + 0.02, cy - pd / 2 - 0.02, cy + pd / 2 + 0.02, y0 + 0.6, y0 + 4.3, rng)
        # twin iron cressets on brackets, ramp side (west face)
        bx = x - pw / 2 - 0.55; b.box(0.6, 0.08, 0.08, x - pw / 2 - 0.3, cy, y0 + 2.9, IRON_D); seg(b, (x - pw / 2, cy, y0 + 2.4), (bx, cy, y0 + 2.9), 0.03, IRON_D, n=4)
        brazier(b, bx, cy, y0 + 2.62, lod, 0.75)
    # iron-studded timber lintel + crenellated attic
    b.box(1.1, 2 * hw + 0.6, 0.7, x, 0, y0 + 4.3, WOOD_D, base=True)
    if lod == 0:
        for fxs in (-1, 1):
            for i in range(9):
                for zz in (0.18, 0.52): b.sphere(0.05, x + fxs * 0.56, -hw + 0.4 + i * (2 * hw - 0.8) / 8, y0 + 4.3 + zz, IRON, sub=0)
            for yy in (-hw + 0.5, 0, hw - 0.5): b.box(0.03, 0.12, 0.72, x + fxs * 0.56, yy, y0 + 4.29, IRON_D, base=True)
    b.box(1.6, 2 * W2, 1.0, x, 0, y0 + 5.0, STONE, base=True); b.box(1.8, 2 * W2 + 0.2, 0.18, x, 0, y0 + 6.0, STONE_D, base=True)
    b.box(1.75, 2 * W2 + 0.1, 0.14, x, 0, y0 + 4.95, STONE_D, base=True)   # string course
    for yy in (-4.7, -1.6, 1.6, 4.7):
        b.box(1.5, 1.4, 0.75, x, yy, y0 + 6.18, STONE, base=True); b.box(1.62, 1.52, 0.12, x, yy, y0 + 6.93, STONE_D, base=True)
    # arched soffit: stepped haunches fill the top corners of the opening so it reads as a round arch (>= 2.9 m over the ramp edges)
    for s_ in (-1, 1):
        for k in range(7 if lod == 0 else 4):
            nk = 7 if lod == 0 else 4; z0 = 2.9 + 1.4 * k / nk; z1 = 2.9 + 1.4 * (k + 1) / nk; dz = (z0 + z1) / 2 - 2.9
            wk = 1.45 - math.sqrt(max(0.0, 1.45 ** 2 - dz * dz))
            if wk > 0.03: b.box(1.0, wk, z1 - z0 + 0.01, x, -s_ * (hw - wk / 2), y0 + z0, QUOIN if k % 2 else STONE, base=True)
    if lod == 0:
        for fxs in (-1, 1): b.box(0.14, 0.7, 0.62, x + fxs * 0.84, 0, y0 + 5.15, BRASS, base=True)   # gilded keystone boss (skull plaque hangs on it: battery.js)
    b.pop()

def magazine(b, lod, rng):
    # [cannon-hill] stone powder magazine on the deck's harbour side (local +y = towards the deck centre, door faces in)
    a = MAG['a']; w, d = MAG['w'], MAG['d']; z = B['y']; x0, y0 = PA(a, MAG['r'])
    b.push(T(x0, y0, 0, rz=a))
    b.box(w + 0.5, d + 0.5, 0.75, 0, 0, z - 0.45, STONE_D, base=True)                         # battered plinth
    b.box(w, d, 3.05, 0, 0, z - 0.2, STONE, base=True)                                          # walls
    b.box(w + 0.16, d + 0.16, 0.16, 0, 0, z + 2.82, STONE_D, base=True)                          # cornice
    # barrel vault roof (stone), double faced, + ridge cresting
    n = 10 if lod == 0 else 5; R = w / 2 + 0.05; h = 1.35; zv = z + 2.98; V = []; F = []
    for yy in (-d / 2 - 0.05, d / 2 + 0.05):
        for i in range(n + 1): t = math.pi * i / n; V.append((math.cos(t) * R, yy, zv + math.sin(t) * h))
    for i in range(n): F.append((n + 1 + i, n + 1 + i + 1, i + 1, i))
    V += [(0, -d / 2 - 0.05, zv), (0, d / 2 + 0.05, zv)]; cb, cf = 2 * n + 2, 2 * n + 3
    for i in range(n): F.append((cb, i, i + 1)); F.append((cf, n + 1 + i + 1, n + 1 + i))
    b.mesh(V, F, 0x9f978a, smooth=False)
    b.box(0.3, d + 0.3, 0.2, 0, 0, zv + h - 0.05, STONE_D, base=True)
    # door: iron-bound oak, dressed jambs + lintel
    fy = d / 2
    for s_ in (-1, 1): b.box(0.4, 0.3, 2.5, s_ * 0.85, fy + 0.05, z, QUOIN, base=True)
    b.box(2.1, 0.32, 0.4, 0, fy + 0.05, z + 2.45, QUOIN, base=True)
    b.box(1.32, 0.1, 2.38, 0, fy + 0.02, z + 0.04, WOOD_D, base=True)
    for zz in (0.35, 1.2, 2.05): b.box(1.34, 0.05, 0.1, 0, fy + 0.08, z + zz, IRON_D, base=True)
    b.torus(0.1, 0.02, 0.4, fy + 0.11, z + 1.2, IRON, n=8, m_=4, rx=math.pi / 2)
    b.box(0.72, 0.06, 0.32, 0, fy + 0.14, z + 2.0, 0xd8322f, base=True)   # red powder warning board
    if lod == 0:
        quoins(b, -w / 2 - 0.02, w / 2 + 0.02, -d / 2 - 0.02, d / 2 + 0.02, z + 0.3, z + 2.8, rng)
        for s_ in (-1, 1): b.box(0.16, 0.12, 0.7, s_ * 2.0, fy + 0.01, z + 1.6, 0x141414, base=True)   # vent slits
    # gabions, shot pyramid, rack, kegs (inside the props strip y fy .. fy + 1.7: battery.js collider)
    for s_ in (-1, 1):
        gx = s_ * 2.62; b.cyl(0.55, 0.55, 1.1, gx, fy + 0.72, z, WICKER, n=10 if lod == 0 else 6); b.cyl(0.5, 0.5, 0.04, gx, fy + 0.72, z + 1.1, 0x6b5233, n=10 if lod == 0 else 6)
        if lod == 0:
            for zz in (0.25, 0.55, 0.85): b.cyl(0.565, 0.565, 0.06, gx, fy + 0.72, z + zz, 0x6e5230, n=10, caps=False)
    stack_balls(b, -1.55, fy + 0.95, z, 0, lod, 3)
    for i, (kx, ky, sc) in enumerate(((1.25, fy + 0.6, 1.0), (1.85, fy + 0.95, 0.9), (1.45, fy + 1.3, 0.8))): barrel(b, kx, ky, z, lod, sc, KEG)
    barrel(b, 1.5, fy + 0.85, z + 0.92, lod, 0.7, KEG)
    if lod == 0:
        b.box(1.1, 0.08, 0.08, -1.6, fy + 0.2, z + 1.9, WOOD); b.box(1.1, 0.08, 0.08, -1.6, fy + 0.2, z + 0.5, WOOD)   # ramrod / sponge rack
        for i in range(4):
            rx_ = -2.0 + i * 0.26; b.cyl(0.03, 0.03, 2.4, rx_, fy + 0.26, z + 0.02, WOOD, n=5)
            b.cyl(0.08, 0.08, 0.28, rx_, fy + 0.26, z + 2.3, 0xd9c39a if i % 2 else IRON_D, n=6)
    # sea-chart table (own collider, battery.js MAG table)
    tx, ty = 2.0, fy + 2.05
    b.box(1.5, 1.0, 0.08, tx, ty, z + 0.92, WOOD, base=True); b.box(1.3, 0.85, 0.01, tx, ty, z + 1.0, PARCH, base=True)
    for sx in (-1, 1):
        for sy in (-1, 1): b.box(0.08, 0.08, 0.92, tx + sx * 0.62, ty + sy * 0.38, z, WOOD_D, base=True)
    if lod == 0:
        b.box(0.5, 0.02, 0.012, tx - 0.2, ty + 0.1, z + 1.01, 0x8a2a1e, base=True, rz=0.5); b.cyl(0.05, 0.05, 0.12, tx + 0.45, ty - 0.2, z + 1.0, BRASS, n=6)   # course line + brass dividers
        b.sphere(0.07, tx - 0.5, ty - 0.25, z + 1.06, IRON, sub=0); b.cyl(0.045, 0.06, 0.55, tx + 0.3, ty + 0.25, z + 1.0, BRASS, n=6, rx=1.5)   # chart weight, spyglass
    lantern(b, 0, fy + 0.32, z + 2.82 - 0.6, lod)   # over the door
    b.pop()

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
    # gun deck parapet: embrasures (low) at the guns, merlons between, splayed cheeks, a cordon + battered glacis outside
    # [cannon-hill] pieces are tangential now (rz = +a: was -a, which turned the end merlons radial)
    a = -1.05
    while a <= 1.051:
        g = any(abs(q['a'] - a) < 0.08 for q in GUNS); r = B['ring'] + 4.4; x, y = PA(a, r)
        top = B['y'] + (0.75 if g else 1.5)
        b.push(T(x, y, 0, rz=a))   # local +x along the arc, +y towards the deck
        b.box(3.2, 1.2, 8.0, 0, 0, top - 8.0, STONE, base=True); b.box(3.3, 1.4, 0.22, 0, 0, top + 0.08, STONE_D)
        b.box(3.24, 0.6, 3.4, 0, -1.25, B['y'] - 1.25, STONE_D, rx=-0.38)                 # battered glacis
        b.box(3.26, 0.22, 0.2, 0, -0.68, B['y'] + 0.32, QUOIN, base=True)                  # cordon
        if lod == 0:
            for r2 in range(2 if g else 3):
                for i in range(4):
                    b.box(0.74, 0.05, 0.38, -1.2 + i * 0.8 + (0.4 if r2 % 2 else 0) * (i < 3), 0.62, top - 0.28 - r2 * 0.42, hexc(STONE, 0.08, rng))
                    b.box(0.74, 0.05, 0.38, -1.2 + i * 0.8 + (0.4 if r2 % 2 else 0) * (i < 3), -0.62, top - 0.28 - r2 * 0.42, hexc(STONE, 0.08, rng))
            if not g: b.box(0.08, 1.42, 0.18, 0, 0, top + 0.19, QUOIN, base=True)        # merlon cap ridge
        if g:   # bevelled embrasure: splayed cheeks widening seaward + a sloped sill (the barrel sits 0.4 m+ inside, never touches)
            for s_ in (-1, 1):
                b.box(0.32, 1.3, 0.62, s_ * 1.42, 0.0, top + 0.19, STONE_D, base=True, rz=s_ * 0.32)
                b.box(0.36, 1.36, 0.1, s_ * 1.42, 0.0, top + 0.81, QUOIN, base=True, rz=s_ * 0.32)
            b.box(2.5, 1.0, 0.1, 0, -0.1, top + 0.2, QUOIN, rx=0.18)
            b.torus(0.12, 0.03, 0, 0.64, B['y'] + 0.42, IRON, n=8, m_=4, rx=math.pi / 2)    # breeching ring
        b.pop(); a += 0.15
    for a in (-1.05, 1.05):   # braziers crown the two end merlons (clear of every gun's arc)
        x, y = PA(a, B['ring'] + 4.4); brazier(b, x, y, B['y'] + 1.72, lod)
    # cordon round the rim + the cliff-face skirt under it (masonry fading into rock)
    # shot piles + powder kegs beside each gun (positions = battery.js)
    for q in GUNS:
        side = -1 if q['a'] < 0 else 1; px, pz = math.cos(q['a']) * side, -math.sin(q['a']) * side
        sx, sz = q['lx'] + px * 2.4 - math.sin(q['a']) * 1.2, q['lz'] + pz * 2.4 - math.cos(q['a']) * 1.2
        kx, kz = q['lx'] + px * 2.4 - math.sin(q['a']) * 3.2, q['lz'] + pz * 2.4 - math.cos(q['a']) * 3.2
        x, y = P(sx, sz); b.box(1.0, 1.0, 0.1, x, y, B['y'], WOOD_D, base=True, rz=q['a'])
        stack_balls(b, x, y, B['y'] + 0.1, q['a'], lod)
        # [cannon-hill] timber gun platform (weathered planks, iron straps + tie-rings, flush: < 2 cm) + iron traverse racer
        px_, py_ = PA(q['a'], 14.6); b.push(T(px_, py_, 0, rz=q['a']))
        for i in range(7 if lod == 0 else 1):
            ww = 2.45 / 7 if lod == 0 else 2.45; b.box(ww - 0.02, 4.4, 0.016, -1.225 + ww * (i + 0.5), 0, B['y'] + 0.004, hexc(PLANK, 0.1, rng) if lod == 0 else PLANK, base=True, mat='planks_weathered')
        for yy in ((-1.7, 0.2, 1.8) if lod == 0 else ()):
            b.box(2.5, 0.08, 0.008, 0, yy, B['y'] + 0.014, IRON_D, base=True)
        if lod == 0:
            for sx_ in (-1, 1): b.torus(0.09, 0.02, sx_ * 1.05, 1.95, B['y'] + 0.04, IRON, n=8, m_=4)
            for i in range(9):
                t = -0.5 + i / 8; b.box(0.3, 0.07, 0.008, math.sin(t) * 3.3, 3.3 - math.cos(t) * 3.3 - 2.0, B['y'] + 0.016, IRON_D, base=True, rz=t)
        b.pop()
        x, y = P(kx, kz); barrel(b, x, y, B['y'], lod)
        if lod == 0: barrel(b, x + 0.5, y + 0.45, B['y'], lod, 0.7); b.box(0.32, 0.02, 0.18, x, y - 0.42, B['y'] + 0.45, 0xd8322f, base=True)
        # rammer + sponge leaning on the parapet
        if lod == 0:
            x, y = P(q['lx'] - px * 1.9, q['lz'] - pz * 1.9); b.cyl(0.03, 0.03, 3.0, x, y, B['y'], WOOD, n=5, rx=0.35, rz=q['a']); b.cyl(0.09, 0.09, 0.3, x, y - 0.0, B['y'] + 2.75, 0xd9c39a, n=6, rx=0.35, rz=q['a'])
    # [cannon-hill] signal mast (the real PUMPFUN PIRATES flag is battery.js runtime cloth), gatehouse, powder magazine, ramp-foot bollards
    signal_mast(b, lod, rng); gatehouse(b, lod, rng); magazine(b, lod, rng)
    for s_ in (-1, 1):
        x, y = P(FOOT['lx0'] + 0.5, s_ * 4.6); b.cyl(0.36, 0.3, 0.9, x, y, RAMP['y0'] - 0.1, STONE_D, n=8); b.sphere(0.3, x, y, RAMP['y0'] + 0.82, STONE, sub=1, s=(1, 1, 0.6))
    # rocky cliff dressing: faceted mossy boulders seated on the terrain round the seaward rim, below the landing and along the ramp's
    # outer foot (never on a walkable surface: outside the deck / ramp / landing / apron rects + 1.5 m)
    rr = random.Random(3); tr = random.Random(4)   # [collisions] tufts on their own stream: desktop + phone now get the SAME boulders (the colliders match both)
    def walk_clear(lx, lz):
        def rd(R): return math.hypot(max(R['lx0'] - lx, 0, lx - R['lx1']), max(R['lz0'] - lz, 0, lz - R['lz1']))
        return math.hypot(lx - B['lx'], lz - B['lz']) > B['deckR'] + 1.6 and abs(lx - GATE['lx']) + abs(lz) > 9 and rd(RAMP) > 1.6 and rd(LANDING) > 1.6 and rd(FOOT) > 2.0
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

FLAG = (MAST['lx'], MAST['lz']); ROCKS = []
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
    b.torus(0.21, 0.045, 0, 0.88, 0, ROPE_C, n=12, m_=5, rx=math.pi / 2)              # [cannon-hill] breeching rope seized round the cascabel neck
    for s in (-1, 1): seg(b, (0, 0.88, s * 0.2), (s * 0.5, 1.15, -0.55), 0.035, ROPE_C, n=5)   # falls running down to the cheek bolts
    return b

def mats():
    out = []
    for nm, kind in (('plaza_solid', 0), ('plaza_glow', 1), ('plaza_glass', 2)):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        if kind == 1: nt.links.new(ca.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 3.0; bs.inputs['Roughness'].default_value = 0.75   # [cannon-hill] distinct: the packer's dedup keeps the glow primitive
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
