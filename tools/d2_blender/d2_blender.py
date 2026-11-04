# [Timothy] PUMPFUN PIRATES D2 JUNGLE RUINS in Blender (island grid cell D2, BANKSY via Emerly 11:47 PM): Post's js/island/areas/jungle.js
# static kit rebuilt with the shared material library (tools/plaza_blender/materials.py: stone_ashlar / stone_trim / timber / rope / iron),
# the same look as the plaza, docks, hill street and the hilltop fort. VISUALS ONLY: the colliders, terrain pads / cuts / paved trail, walk
# heights, interact points and the animated bits (swinging log, darts, crumbling tiles, chests, shards, pages, the fire flame, Old Mossbeard
# himself) stay Post's (register() + build() untouched). Every piece sits on the same anchor as Post's kit piece; ground heights come from
# tools/d2_blender/d2_layout.json (d2_probe.js: foot.H at every anchor + the Ruin Steps tread samples). Walkable tops (the temple flagstones,
# the step treads) sit 5 mm over the walk height (feet within 1 cm), never higher.
# Frame: everything is authored in the three.js foot frame (x, y up, z) and turned into Blender (x, -z, y) by the base matrix C. One chunk node
# per piece group (origin at its centre: 16-bit positions stay sub-mm), each with _LOD0 (desktop) + _LOD1 (phones); d2_far = the far impostor.
#   blender -b --factory-startup -P tools/d2_blender/d2_blender.py -- GAME_DIR OUT_DIR    ->  OUT/d2_jungle_raw.glb (+ d2_report.json)
import bpy, sys, os, math, json, random
import numpy as np
from mathutils import Matrix
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'plaza_blender'))
from lib import Builder, hexc
argv = sys.argv[sys.argv.index('--') + 1:]; GAME, OUT = argv[0], argv[1]; os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
L = json.load(open(os.path.join(HERE, 'd2_layout.json')))
TEMPLE, RUN, ALTAR, TH = L['TEMPLE'], L['RUN'], L['ALTAR'], L['TH']
Y = TEMPLE['y']; CX = (TEMPLE['x0'] + TEMPLE['x1']) / 2; CZ = (TEMPLE['z0'] + TEMPLE['z1']) / 2
LIFT = 0.005                                        # walkable tops over the walk height (feet within 1 cm)

# ---- palette: Post's jungle colours (areas/common.js C) + the plaza / fort stones; library layer per colour ----
STONE, STONE_D, STONE_L, STONE_M = 0xb9b2a6, 0x8a837a, 0xa9a294, 0x9e978a
IDOLC, FLAG_A, FLAG_B, GROUT, TREAD = 0xa39c8e, 0xc2b9a6, 0xb3aa98, 0x6f675d, 0x8f887d
MOSS, MOSS_D, VINE, LEAF2 = 0x5f9a3a, 0x4a7f2e, 0x2f8a3a, 0x3fa648
WOOD, WOOD_D, WOOD_L, IRON, GOLD, GOLD_D = 0xa86a3a, 0x6b4527, 0xd9a36b, 0x2b2f36, 0xffc93c, 0xe0a020
CLOTH, ROPE, THATCH, DARK, SKULL, CRATE = 0xe9d7b0, 0xc9a36b, 0x6f9a3a, 0x2a2622, 0xf4efe6, 0x8a5a2b
Builder.AUTO = {STONE: 'stone_ashlar', STONE_D: 'stone_ashlar', STONE_L: 'stone_ashlar', STONE_M: 'stone_ashlar', IDOLC: 'stone_ashlar',
                FLAG_A: 'stone_trim', FLAG_B: 'stone_trim', GROUT: 'stone_trim', TREAD: 'stone_trim', WOOD: 'timber', WOOD_D: 'timber', WOOD_L: 'timber', CRATE: 'timber',
                IRON: 'iron', ROPE: 'rope', CLOTH: 'awning_cloth'}
St = lambda i: STONE_L if i % 3 == 0 else STONE if i % 3 == 1 else STONE_M
def jh(i, j): s = math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - math.floor(s)   # areas/common.js hash

# ---- three.js-frame helpers on top of the plaza Builder ----
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # three (x, y, z) -> Blender (x, -z, y)
def Mt(x=0, y=0, z=0, ry=0, rx=0, rz=0, s=1):   # js/island/kit.js M(): Euler 'YXZ'
    m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(rz, 4, 'Z')
    if not hasattr(s, '__len__'): s = (s, s, s)
    return m @ Matrix.Diagonal((s[0], s[1], s[2], 1))
class TB(Builder):
    def __init__(self, origin):
        super().__init__(); self.o = origin; self.stack = [C @ Matrix.Translation((-origin[0], -origin[1], -origin[2]))]
    def bx(self, w, h, d, m, col, mat=0):                        # kit box(w, h, d) centred, under M
        self.push(m); self.box(w, d, h, 0, 0, 0, col, rx=math.pi / 2, mat=mat); self.pop()
    def cy(self, r0, r1, h, m, col, n=8, mat=0, smooth=False):   # kit cyl (axis y, centred)
        self.push(m); self.cyl(r0, r1, h, 0, -h / 2, 0, col, n=n, rx=-math.pi / 2, mat=mat, smooth=smooth); self.pop()
    def rock(self, r, m, col, rng, sub=0):
        self.push(m); s = rng.uniform(0.75, 1.2, 3); self.sphere(r, 0, 0, 0, col, sub=sub, s=tuple(s)); self.pop()
    def at(self, m): self.push(m)
CH = {}   # chunk name -> (origin, [TB lod0, TB lod1])
def chunk(name, origin):
    CH[name] = (origin, [TB(origin), TB(origin)]); return CH[name][1]

# ---- the walk surface itself: foot.js H (bilinear on the 4 m grid, dumped by d2_probe.js) + slabs that follow it to the millimetre ----
GR = L['grid']
def Hx(x, z):
    fx = (x - GR['X0']) / GR['G']; fz = (z - GR['Z0']) / GR['G']; i = math.floor(fx); j = math.floor(fz); u = fx - i; v = fz - j
    h = lambda a, c: GR['h'][(c - GR['j0']) * GR['ni'] + (a - GR['i0'])]
    return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v
def _clip(poly, k, c, keep_ge):   # Sutherland-Hodgman against the axis line p[k] = c
    out = []
    for i in range(len(poly)):
        P, Q = poly[i], poly[(i + 1) % len(poly)]; ip, iq = (P[k] >= c) == keep_ge, (Q[k] >= c) == keep_ge
        if ip: out.append(P)
        if ip != iq: t = (c - P[k]) / (Q[k] - P[k]); out.append((P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t))
    return out
def conform(b, cx, cz, hw, hd, ux, uz, col, lib, lift=LIFT, skirt=0.14, step=1.0):
    """a flat-topped stone slab (centre cx, cz; half sizes hw along (ux, uz), hd across) whose top follows the walk surface + lift: the
    rectangle is clipped to a 1 m (treads 0.5 m) grid aligned with the terrain's 4 m cells (every slope kink sits on a vertex, the bilinear
    twist inside a cell stays a few mm); a skirt down the sides. All in the three frame, emitted straight into the chunk's Blender frame."""
    vx, vz = -uz, ux
    R = [(cx + ux * a * hw + vx * c * hd, cz + uz * a * hw + vz * c * hd) for a, c in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    xs = [p[0] for p in R]; zs = [p[1] for p in R]; X0, Z0 = GR['X0'], GR['Z0']
    i0, i1 = math.floor((min(xs) - X0) / step), math.ceil((max(xs) - X0) / step); j0, j1 = math.floor((min(zs) - Z0) / step), math.ceil((max(zs) - Z0) / step)
    hs = [Hx(x, z) for x, z in R]; V = []; F = []
    o = b.o; tb = lambda x, y, z: (x - o[0], -z + o[2], y - o[1])
    flat = max(hs) - min(hs) < 1e-4 and all(abs(Hx(x, z) - hs[0]) < 1e-4 for x in np.linspace(min(xs), max(xs), 5) for z in np.linspace(min(zs), max(zs), 5))
    cells = [R] if flat else [None]
    if not flat:
        cells = []
        for i in range(i0, i1):
            for j in range(j0, j1):
                pg = R; x0_, z0_ = X0 + i * step, Z0 + j * step
                for (k, c, ge) in ((0, x0_, True), (0, x0_ + step, False), (1, z0_, True), (1, z0_ + step, False)):
                    pg = _clip(pg, k, c, ge)
                    if len(pg) < 3: break
                if len(pg) >= 3: cells.append(pg)
    for pg in cells:   # fan, top facing +y (three) = +z (Blender)
        base = len(V); V += [tb(x, Hx(x, z) + lift, z) for x, z in pg]
        area = sum(pg[q][0] * pg[(q + 1) % len(pg)][1] - pg[(q + 1) % len(pg)][0] * pg[q][1] for q in range(len(pg)))
        idx = list(range(base, base + len(pg)))
        if area > 0: idx = idx[::-1]   # three xz CCW (seen from +y) is clockwise in x/z coordinates
        for q in range(1, len(pg) - 1): F.append((idx[0], idx[q], idx[q + 1]))
    if skirt:
        for e in range(4):
            P, Q = R[e], R[(e + 1) % 4]; ts = {0.0, 1.0}
            for k, (lo, n0, n1) in ((0, (X0, i0, i1)), (1, (Z0, j0, j1))):
                if abs(Q[k] - P[k]) > 1e-9:
                    for n in range(n0, n1 + 1):
                        t = (lo + n * step - P[k]) / (Q[k] - P[k])
                        if 0 < t < 1: ts.add(t)
            ts = sorted(ts) if not flat else [0.0, 1.0]
            for t0, t1 in zip(ts, ts[1:]):
                A = (P[0] + (Q[0] - P[0]) * t0, P[1] + (Q[1] - P[1]) * t0); Bq = (P[0] + (Q[0] - P[0]) * t1, P[1] + (Q[1] - P[1]) * t1)
                ya, yb = Hx(*A) + lift, Hx(*Bq) + lift; base = len(V)
                V += [tb(A[0], ya, A[1]), tb(Bq[0], yb, Bq[1]), tb(Bq[0], yb - skirt, Bq[1]), tb(A[0], ya - skirt, A[1])]
                F.append((base, base + 3, base + 2, base + 1))
    b.stack.append(Matrix.Identity(4)); b._add(V, F, col, 0, lib=lib); b.stack.pop()

def vine(b, x, yy, z, length, rng, yaw=0.0, lod=0):   # hanging vine strand: leaf blobs down a wall face
    if lod: b.bx(0.3, length, 0.1, Mt(x, yy - length / 2, z, yaw), VINE); return
    i = 0.0
    while i < length:
        b.push(Mt(x + math.sin(i * 3) * 0.12, yy - i, z, yaw)); b.sphere(rng.uniform(0.13, 0.2), 0, 0, 0, hexc([VINE, LEAF2, MOSS][int(i * 5) % 3], 0.12, rng), sub=0, s=(1.3, 0.9, 0.45)); b.pop(); i += rng.uniform(0.22, 0.36)
def moss_cap(b, w, d, m, rng, lod):   # irregular moss on a top face
    b.bx(w * 0.92, 0.07, d * 0.92, m @ Mt(0, 0.035, 0), hexc(MOSS, 0.08, rng))
    if lod == 0:
        for k in range(max(1, int(w * d / 3))): b.bx(rng.uniform(0.3, 0.8), 0.1, rng.uniform(0.3, 0.8), m @ Mt(rng.uniform(-w / 2.6, w / 2.6), 0.06, rng.uniform(-d / 2.6, d / 2.6), rng.uniform(0, 3)), hexc(MOSS_D, 0.1, rng))
def ashlar(b, w, h, d, m, col, rng, lod, rh=0.55, axis='x', top_broken=False):
    # a stone mass (kit box w x h x d, centred under m) as coursed ashlar: blocks of jittered stone with a slight relief, LOD1 = the plain box
    if lod: b.bx(w, h, d, m, col); return
    L_ = w if axis == 'x' else d; nc = max(1, int(round(h / rh))); ch = h / nc
    for c in range(nc):
        yy = -h / 2 + (c + 0.5) * ch; u = -L_ / 2; first = True
        while u < L_ / 2 - 1e-3:
            bl = rng.uniform(0.75, 1.35) * (0.5 if first and c % 2 else 1.0); first = False; bl = min(bl, L_ / 2 - u)
            if L_ / 2 - u - bl < 0.3: bl = L_ / 2 - u
            inset = rng.uniform(0.0, 0.035); cc = hexc(col, 0.07, rng); um = u + bl / 2
            if axis == 'x': b.bx(bl - 0.03, ch - 0.03, d - 2 * inset, m @ Mt(um, yy, 0), cc)
            else: b.bx(w - 2 * inset, ch - 0.03, bl - 0.03, m @ Mt(0, yy, um), cc)
            u += bl
    b.bx(w - 0.08, h - 0.04, d - 0.08, m, GROUT)   # mortar core behind the joints

# =====================================================================================================================================
# TEMPLE chunk (pad y 30): flagstone floor, back wall + side walls, the stepped shrine, collapsed arch, trap corridor walls, altar + idol,
# broken columns + rubble, moss curtain, high-ledge plinth, the fallen lintel outside and the toppled idol head
# =====================================================================================================================================
for lod, b in enumerate(chunk('d2_temple', (CX, Y, CZ))):
    rng = np.random.default_rng(11 + lod)
    # floor: Post's 10 x 9 flagstones (3.7 m on a 3.9 m grid), split into 2 x 2 dressed slabs, tops 8 mm over the pad; a grout bed under them
    for i in range(10):
        for j in range(9):
            x = TEMPLE['x0'] + 2 + i * 3.9; z = TEMPLE['z0'] + 2 + j * 3.9
            if abs(x - RUN['x']) < RUN['hw'] + 1.2 and RUN['z1'] < z < RUN['z0']: continue
            x += (jh(i, j) - 0.5) * 0.2
            if lod == 0:
                for a in (-1, 1):
                    for c in (-1, 1): conform(b, x + a * 0.925, z + c * 0.925, 0.89, 0.89, 1.0, 0.0, hexc(FLAG_A if (i + j + (a > 0) + (c > 0)) % 2 else FLAG_B, 0.06, rng), 'stone_trim')
            else: conform(b, x, z, 1.85, 1.85, 1.0, 0.0, FLAG_A if (i + j) % 2 else FLAG_B, 'stone_trim')
    # back wall: 10 stepped blocks (Post's heights), coursed ashlar, moss caps, vines on the odd ones
    for i in range(10):
        x = TEMPLE['x0'] + 2 + i * 4; hh = 6 + jh(i, 1) * 4
        ashlar(b, 4.1, hh, 1.8, Mt(x, Y + hh / 2, TEMPLE['z0'] + 0.8), St(i), rng, lod)
        b.bx(4.3, 0.3, 2.0, Mt(x, Y + hh + 0.15, TEMPLE['z0'] + 0.8), STONE_D); moss_cap(b, 4.0, 1.8, Mt(x, Y + hh + 0.3, TEMPLE['z0'] + 0.8), rng, lod)
        if i % 2: vine(b, x - 1, Y + hh, TEMPLE['z0'] + 1.8, 2 + jh(i, 2) * 3, rng, lod=lod)
        b.bx(4.2, 0.5, 2.0, Mt(x, Y + 0.25, TEMPLE['z0'] + 0.85), STONE_D)   # plinth course
    for sx in (TEMPLE['x0'] + 0.8, TEMPLE['x1'] - 0.8):
        for j in range(9):
            z = TEMPLE['z0'] + 2 + j * 4; hh = 2.5 + jh(j, sx) * 3.5
            ashlar(b, 1.7, hh, 4.1, Mt(sx, Y + hh / 2, z), St(j), rng, lod, axis='z')
            b.bx(1.9, 0.26, 4.2, Mt(sx, Y + hh + 0.13, z), STONE_D); moss_cap(b, 1.7, 4.0, Mt(sx, Y + hh + 0.26, z), rng, lod)
            if j % 3 == 1: vine(b, sx + (0.95 if sx < CX else -0.95), Y + hh, z, hh * 0.8, rng, math.pi / 2, lod)
    # stepped shrine: 4 tiers with cornices, a dark doorway framed by jambs + lintel, steps up the front
    for s in range(4):
        w, d = 14 - s * 3, 6 - s * 1.2; zc = TEMPLE['z0'] + 4.5 - s * 0.3
        ashlar(b, w, 1.6, d, Mt(CX, Y + 0.8 + s * 1.6, zc), St(s), rng, lod, rh=0.8)
        b.bx(w + 0.2, 0.18, d + 0.2, Mt(CX, Y + 1.6 + s * 1.6 - 0.09, zc), STONE_D)
        if lod == 0 and s < 3: moss_cap(b, 1.2, 0.5, Mt(CX + (w / 2 - 0.9) * (1 if s % 2 else -1), Y + 1.6 + s * 1.6, zc + d / 2 - 0.3), rng, lod)
    b.bx(3, 3, 2.4, Mt(CX, Y + 6.8, TEMPLE['z0'] + 5.4), DARK)
    for sx in (-1, 1): b.bx(0.5, 3.2, 0.6, Mt(CX + sx * 1.75, Y + 6.8, TEMPLE['z0'] + 6.45), STONE_L)
    b.bx(4.2, 0.6, 0.7, Mt(CX, Y + 8.6, TEMPLE['z0'] + 6.45), STONE_D)
    if lod == 0:
        for k in range(5): b.bx(0.5, 0.12, 0.5, Mt(CX + (k - 2) * 0.75, Y + 8.95, TEMPLE['z0'] + 6.5), GOLD_D)   # carved frieze studs
    # collapsed arch: whole pillar (7 m) + broken one (3.6 m) on Post's collider circles, the lintel resting across, a fallen block outside
    for (px, hh, col) in ((CX - 3.6, 7.0, STONE), (CX + 3.6, 3.6, STONE_L)):
        ashlar(b, 1.8, hh, 1.8, Mt(px, Y + hh / 2, TEMPLE['z1'] - 1), col, rng, lod, rh=0.6)
        b.bx(2.1, 0.4, 2.1, Mt(px, Y + 0.2, TEMPLE['z1'] - 1), STONE_D)
        if hh > 5: b.bx(2.2, 0.35, 2.2, Mt(px, Y + hh - 0.17, TEMPLE['z1'] - 1), STONE_D)
        else:
            for k in range(3 if lod == 0 else 1): b.rock(0.45, Mt(px + rng.uniform(-0.6, 0.6), Y + hh + 0.1, TEMPLE['z1'] - 1 + rng.uniform(-0.5, 0.5)), STONE_L, rng)
    b.at(Mt(CX - 0.5, Y + 7.6, TEMPLE['z1'] - 1, 0, 0, -0.08)); ashlar(b, 9, 1.4, 1.6, Mt(), STONE_D, rng, lod, rh=0.7)
    if lod == 0:
        for k in range(6): b.bx(0.5, 0.5, 0.12, Mt(-3.6 + k * 1.45, -0.1, 0.82), GOLD_D if k % 2 else STONE_M)   # carved glyph panel
    b.pop()
    lx, lz, ly = L['LINTEL']; b.at(Mt(lx, ly + 0.5, lz, 0.5, 0, 0.2)); ashlar(b, 4, 1.2, 1.5, Mt(), STONE_D, rng, lod, rh=0.6); moss_cap(b, 3.6, 1.3, Mt(0, 0.6, 0), rng, lod); b.pop()
    vine(b, CX - 3.6, Y + 7, TEMPLE['z1'] - 0.1, 5, rng, lod=lod); vine(b, CX + 1.5, Y + 7.2, TEMPLE['z1'] - 0.1, 3.5, rng, lod=lod)
    # trap corridor: low walls with dart holes + warning skulls, the log beam frame
    for s in (-1, 1):
        x = RUN['x'] + s * (RUN['hw'] + 0.6); zl = abs(RUN['z1'] - RUN['z0']); zc = (RUN['z0'] + RUN['z1']) / 2
        ashlar(b, 1.2, 3.2, zl, Mt(x, Y + 1.6, zc), St(s + 2), rng, lod, axis='z')
        b.bx(1.4, 0.24, zl + 0.2, Mt(x, Y + 3.32, zc), STONE_D)
        for i in range(4): b.bx(0.06, 0.18, 0.18, Mt(x - s * 0.62, Y + 0.8 + i * 0.45, -446), DARK)
        b.push(Mt(x, Y + 3.5, RUN['z0'] - 0.5)); b.sphere(0.3, 0, 0, 0, SKULL, sub=1 if lod == 0 else 0); b.pop()
        if lod == 0:
            for e in (-1, 1): b.bx(0.08, 0.1, 0.04, Mt(x + e * 0.1, Y + 3.52, RUN['z0'] - 0.21), DARK)
    b.bx(RUN['hw'] * 2 + 3, 0.5, 0.5, Mt(RUN['x'], Y + 5.8, -452), WOOD_D)
    for s in (-1, 1):
        b.bx(0.5, 2.8, 0.5, Mt(RUN['x'] + s * (RUN['hw'] + 1.2), Y + 4.4, -452), WOOD_D)
        if lod == 0: b.bx(0.14, 1.2, 0.14, Mt(RUN['x'] + s * (RUN['hw'] + 0.7), Y + 5.2, -452, 0, 0, s * 0.7), WOOD)   # braces
    if lod == 0:
        for s in (-1, 1): b.bx(0.56, 0.08, 0.56, Mt(RUN['x'] + s * (RUN['hw'] + 1.2), Y + 5.55, -452), IRON)
    # altar + gold slab + hex columns + the golden idol
    ashlar(b, 4, 1.2, 1.8, Mt(ALTAR['x'], Y + 0.6, ALTAR['z'] - 1.6), STONE_M, rng, lod, rh=0.6)
    b.bx(4.3, 0.16, 2.1, Mt(ALTAR['x'], Y + 1.12, ALTAR['z'] - 1.6), STONE_D); b.bx(3.2, 0.3, 1.4, Mt(ALTAR['x'], Y + 1.25, ALTAR['z'] - 1.6), GOLD)
    for s in (-1, 1):
        b.cy(0.5, 0.6, 1.4, Mt(ALTAR['x'] + s * 3, Y + 0.7, ALTAR['z'] - 1.6), STONE, n=6); b.cy(0.62, 0.62, 0.16, Mt(ALTAR['x'] + s * 3, Y + 1.46, ALTAR['z'] - 1.6), STONE_D, n=6)
        b.push(Mt(ALTAR['x'] + s * 3, Y + 1.66, ALTAR['z'] - 1.6)); b.sphere(0.2, 0, 0, 0, GOLD, sub=0); b.pop()
    ix, iz = ALTAR['x'], ALTAR['z'] - 2.1
    b.bx(0.7, 1.0, 0.5, Mt(ix, Y + 1.9, iz), GOLD); b.bx(0.55, 0.5, 0.45, Mt(ix, Y + 2.65, iz), GOLD); b.bx(0.9, 0.12, 0.6, Mt(ix, Y + 1.42, iz), GOLD_D)
    if lod == 0:
        for e in (-1, 1): b.bx(0.1, 0.07, 0.03, Mt(ix + e * 0.12, Y + 2.7, iz + 0.235), DARK)
        b.bx(0.75, 0.12, 0.5, Mt(ix, Y + 2.96, iz), GOLD_D); b.bx(0.18, 0.5, 0.18, Mt(ix - 0.44, Y + 2.0, iz + 0.1, 0, 0, 0.3), GOLD); b.bx(0.18, 0.5, 0.18, Mt(ix + 0.44, Y + 2.0, iz + 0.1, 0, 0, -0.3), GOLD)
    # broken columns on Post's ring (no colliders there in his version either) + rubble
    for i in range(8):
        a = i / 8 * math.pi * 2; x = CX + math.cos(a) * 14; z = CZ + math.sin(a) * 11
        if abs(x - RUN['x']) < 5: continue
        hh = 1.5 + jh(i, 7) * 4
        b.cy(0.82, 0.9, 0.3, Mt(x, Y + 0.15, z), STONE_D, n=8)
        nd = max(1, int(hh / 0.9)) if lod == 0 else 1
        for k in range(nd): b.cy(0.7 - 0.02 * k, 0.72 - 0.02 * k, hh / nd - 0.02, Mt(x, Y + 0.3 + (k + 0.5) * hh / nd - 0.15, z, rng.uniform(0, 1)), hexc(St(i), 0.05, rng), n=12 if lod == 0 else 8)
        if lod == 0:
            for k in range(2): b.rock(0.28, Mt(x + rng.uniform(-0.3, 0.3), Y + hh + 0.05, z + rng.uniform(-0.3, 0.3)), St(i + 1), rng)
        if i % 2:
            b.rock(0.7, Mt(x + 1.4, Y + 0.3, z + 0.8), STONE_D, rng)
            if lod == 0: b.rock(0.35, Mt(x + 2.1, Y + 0.18, z + 0.2), STONE_D, rng); b.rock(0.25, Mt(x + 0.8, Y + 0.12, z + 1.5), STONE_L, rng)
    # moss curtain (walk-through strips, as Post's)
    for i in range(7):
        hh = 3.6 - jh(i, 3); xm = L['HIDDEN'][0]['x'] - 1.8 + i * 0.6; zm = L['HIDDEN'][0]['z'] + 2.4
        if lod == 0:
            for k in range(int(hh / 0.4)): b.bx(0.34, 0.42, 0.08, Mt(xm + math.sin(k * 1.7 + i) * 0.04, Y + 2.0 + hh / 2 - 0.2 - k * 0.4, zm), hexc(VINE if (i + k) % 2 else MOSS, 0.1, rng))
        else: b.bx(0.35, hh, 0.1, Mt(xm, Y + 2.0, zm), VINE if i % 2 else MOSS)
    b.bx(4.6, 0.3, 0.3, Mt(L['HIDDEN'][0]['x'], Y + 3.95, L['HIDDEN'][0]['z'] + 2.4), STONE_D)
    # the high ledge: ruined lookout plinth
    x, z, yy = L['LEDGE']; ashlar(b, 4, 1.2, 3, Mt(x, yy + 0.4, z), STONE, rng, lod, rh=0.6); moss_cap(b, 3.8, 2.8, Mt(x, yy + 1.0, z), rng, lod); vine(b, x + 1.6, yy + 1, z + 1.6, 1.5, rng, lod=lod)
    # the toppled idol head (hidden chest under its chin): Post's pose, carved face
    x, z, yy = L['IDOL_HEAD']; b.at(Mt(x, yy + 1.2, z, 0.6, 0, 1.2))
    ashlar(b, 2.8, 3.2, 2.6, Mt(), IDOLC, rng, lod, rh=0.8); b.bx(2.9, 0.6, 0.8, Mt(0, 0.4, 1.3), STONE_D)
    for s in (-1, 1): b.bx(0.6, 0.4, 0.2, Mt(s * 0.7, 0.6, 1.35), DARK); b.bx(0.4, 0.8, 0.5, Mt(s * 1.55, 0.2, 0.3), STONE_D)
    b.bx(1.4, 0.3, 0.3, Mt(0, -0.7, 1.35), DARK); b.bx(0.5, 0.7, 0.4, Mt(0, -0.05, 1.45), IDOLC)
    moss_cap(b, 2.6, 2.4, Mt(0, 1.6, 0), rng, lod); vine(b, 0.8, 1.6, 1.2, 2, rng, lod=lod); b.pop()

# =====================================================================================================================================
# RUIN STEPS (two flights on Post's soft cuts): dressed stone treads laid IN the paved floor (conforming to the terrain samples, top 8 mm over
# the walk height), a broken gateway pillar pair on Post's collider circles at each foot; the west flight also carries the two idol heads
# =====================================================================================================================================
def tread(b, S, T, lod, rng, k):   # Post's 5.2 x 0.5 band as dressed stones laid IN the paved cut (top 5 mm over the walk surface)
    nst = 4 if lod == 0 else 1; g = 0.025 if lod == 0 else 0.0; sw = 5.2 / nst
    for si in range(nst):
        s0 = -2.6 + (si + 0.5) * sw; x = T['x'] - S['uz'] * s0; z = T['z'] + S['ux'] * s0
        c = hexc([STONE_M, TREAD, STONE_L][(k + si) % 3], 0.06, rng)
        if lod == 0:   # worn tread + a darker nosing strip on its downhill edge (reads as a riser on the flush step)
            conform(b, x + S['ux'] * 0.06, z + S['uz'] * 0.06, 0.19 - g, sw / 2 - g, S['ux'], S['uz'], c, 'stone_trim', step=0.5)
            conform(b, x - S['ux'] * 0.19, z - S['uz'] * 0.19, 0.06, sw / 2 - g, S['ux'], S['uz'], hexc(STONE_D, 0.05, rng) * 0.85, 'stone_trim', step=0.5)
        else: conform(b, x, z, 0.25, sw / 2, S['ux'], S['uz'], c, 'stone_trim', step=0.5)
for si, S in enumerate(L['steps']):
    ax, az, ay = S['a']; bx_, bz_, by_ = S['b']; o = ((ax + bx_) / 2, (ay + by_) / 2, (az + bz_) / 2)
    for lod, b in enumerate(chunk('d2_steps_' + 'we'[si], o)):
        rng = np.random.default_rng(31 + si * 7 + lod); yaw = math.atan2(S['ux'], S['uz'])
        for k, T in enumerate(S['treads']): tread(b, S, T, lod, rng, k)
        for (x, z, yy, sd) in S['pillars']:   # gateway pillar pair: base, drums, capital (the taller one whole, the other broken)
            hh = 4.2 if sd > 0 else 2.6
            b.bx(1.6, 0.4, 1.6, Mt(x, yy + 0.2 - 0.1, z, yaw), STONE_D)
            ashlar(b, 1.3, hh - 0.3, 1.3, Mt(x, yy + 0.3 - 0.1 + (hh - 0.3) / 2, z, yaw), STONE, rng, lod, rh=0.65)
            if hh > 3:
                b.bx(1.6, 0.3, 1.6, Mt(x, yy + hh + 0.05, z, yaw), STONE_D); b.bx(0.9, 0.5, 0.9, Mt(x, yy + hh + 0.45, z, yaw), STONE_L)
                b.push(Mt(x, yy + hh + 0.85, z, yaw)); b.sphere(0.32, 0, 0, 0, STONE_M, sub=1 if lod == 0 else 0); b.pop()
            else:
                for k in range(3 if lod == 0 else 1): b.rock(0.4, Mt(x + rng.uniform(-0.5, 0.5), yy + hh + 0.1, z + rng.uniform(-0.5, 0.5)), STONE_L, rng)
            moss_cap(b, 1.2, 1.2, Mt(x, yy + hh + (0.2 if hh > 3 else 0.0), z, yaw), rng, 1) if hh <= 3 else None
            vine(b, x, yy + hh, z + 0.7, hh * 0.7, rng, lod=lod)
        if si == 0:   # the two moss-grown idol heads at the foot of the west flight (Post's poses + collider circles r 1.4)
            for (x, z, yy, r) in L['IDOLS']:
                b.at(Mt(x, yy, z, r))
                b.bx(2.5, 0.4, 2.3, Mt(0, 0.1, 0), STONE_D)
                ashlar(b, 2.2, 2.5, 2.0, Mt(0, 1.55, 0), IDOLC, rng, lod, rh=0.62)
                b.bx(2.4, 0.4, 0.5, Mt(0, 2.2, 1.1), STONE_D)                                     # heavy brow
                for s2 in (-1, 1):
                    b.bx(0.5, 0.35, 0.1, Mt(s2 * 0.5, 1.9, 1.02), DARK)                            # eye sockets
                    b.bx(0.35, 0.9, 0.45, Mt(s2 * 1.22, 1.5, 0.2), STONE_M)                        # ear plugs
                    if lod == 0: b.push(Mt(s2 * 0.5, 1.9, 1.06)); b.sphere(0.09, 0, 0, 0, GOLD_D, sub=0); b.pop()   # gold pupils
                b.bx(0.45, 0.7, 0.45, Mt(0, 1.45, 1.12), IDOLC)                                    # nose
                b.bx(1.2, 0.25, 0.1, Mt(0, 0.9, 1.02), DARK)                                       # mouth
                if lod == 0:
                    for t in range(4): b.bx(0.18, 0.18, 0.06, Mt(-0.42 + t * 0.28, 0.92, 1.06), SKULL)   # teeth
                b.bx(2.3, 0.5, 2.1, Mt(0, 2.95, 0), MOSS); moss_cap(b, 2.2, 2.0, Mt(0, 3.2, 0), rng, lod)
                vine(b, -0.9, 2.9, 1.06, 1.6, rng, lod=lod)
                b.pop()

# =====================================================================================================================================
# MOSSBEARD'S CAMP at the trailhead: his lean-to (palm-thatch roof, crate + cloth), the trail signpost, the fire ring + logs, the hammock.
# Old Mossbeard himself stays Post's kit NPC (js/island/d2Blender.js rebuilds him with areas/common.js npc()).
# =====================================================================================================================================
mx, mz, my = L['MB']; for_o = (mx - 2, my, mz + 2)
for lod, b in enumerate(chunk('d2_camp', for_o)):
    rng = np.random.default_rng(51 + lod)
    hx, hz, hy = L['LEAN']
    for s in (-1, 1):
        b.cy(0.11, 0.13, 2.7, Mt(hx + s * 1.5, hy + 1.3, hz), WOOD_D, n=6)
        b.cy(0.1, 0.12, 1.5, Mt(hx + s * 1.5, hy + 0.75, hz + 1.9), WOOD_D, n=6)
    b.cy(0.08, 0.08, 3.4, Mt(hx, hy + 2.55, hz, 0, 0, math.pi / 2), WOOD, n=6); b.cy(0.08, 0.08, 3.4, Mt(hx, hy + 1.5, hz + 1.9, 0, 0, math.pi / 2), WOOD, n=6)
    nl = 9 if lod == 0 else 1
    for k in range(nl):   # palm-frond thatch on the sloping roof (Post's 3.6 x 2.6 slab at x-tilt 0.5)
        xk = hx - 1.6 + (k + 0.5) * 3.2 / nl if nl > 1 else hx
        b.bx(3.6 / nl + 0.12 if nl > 1 else 3.6, 0.1, 2.6, Mt(xk, hy + 2.0 + (0.03 if k % 2 else 0), hz + 0.9, 0, 0.5), hexc(THATCH if k % 2 else MOSS, 0.1, rng))
    if lod == 0:
        for k in range(7): b.bx(0.12, 0.06, 2.9, Mt(hx - 1.6 + k * 0.53, hy + 2.12, hz + 0.95, 0, 0.5, rng.uniform(-0.1, 0.1)), MOSS_D)
    b.bx(1.6, 0.8, 0.9, Mt(hx, hy + 0.4, hz + 0.6), CRATE)
    if lod == 0:
        for e in (-1, 1): b.bx(0.08, 0.84, 0.94, Mt(hx + e * 0.7, hy + 0.4, hz + 0.6), WOOD_D)
        b.bx(1.64, 0.08, 0.94, Mt(hx, hy + 0.55, hz + 0.6), WOOD_D)
    b.bx(1.2, 0.04, 0.7, Mt(hx, hy + 0.82, hz + 0.6), CLOTH)
    if lod == 0:   # a lantern + a bottle on the crate, a bedroll
        b.bx(0.22, 0.3, 0.22, Mt(hx - 0.4, hy + 1.0, hz + 0.6), 0xffc46b, mat=1); b.bx(0.28, 0.05, 0.28, Mt(hx - 0.4, hy + 1.17, hz + 0.6), IRON)
        b.cy(0.07, 0.07, 0.3, Mt(hx + 0.35, hy + 0.99, hz + 0.55), 0x3f7a4a, n=6)
        b.cy(0.25, 0.25, 1.4, Mt(hx + 0.2, hy + 0.2, hz + 1.5, 0, 0, math.pi / 2), 0x8a4a2a, n=8)
    # trail signpost (Post's spot), carved board pointing up the trail
    sx, sz, sy = L['SIGN']; yaw = -math.atan2(TH['dz'], TH['dx'])
    b.cy(0.1, 0.12, 2.5, Mt(sx, sy + 1.2, sz), WOOD_D, n=6)
    b.bx(1.8, 0.45, 0.1, Mt(sx + 0.6, sy + 2.0, sz, yaw), WOOD_L)
    if lod == 0:
        b.bx(1.9, 0.06, 0.12, Mt(sx + 0.6, sy + 2.25, sz, yaw), WOOD_D); b.bx(1.9, 0.06, 0.12, Mt(sx + 0.6, sy + 1.75, sz, yaw), WOOD_D)
        b.bx(1.2, 0.3, 0.1, Mt(sx - 0.2, sy + 1.45, sz, yaw + 2.4), WOOD_L)   # second board: back to the harbor
        b.push(Mt(sx, sy + 2.5, sz)); b.sphere(0.12, 0, 0, 0, IDOLC, sub=0, s=(1, 1.3, 1)); b.pop()   # a little skull-stone cap
    b.cy(0, 0.3, 0.5, Mt(sx + 1.6, sy + 2.0, sz, 0, 0, -math.pi / 2), WOOD_L, n=3)
    # fire ring (Post's 7 stones), crossed logs, ash bed, sitting logs
    fx, fz, fy = L['FIRE']
    for (x, z, yy) in L['FIRERING']: b.rock(0.3, Mt(x, yy + 0.12, z), STONE_D, rng)
    b.cy(0.8, 0.8, 0.04, Mt(fx, fy + 0.02, fz), 0x3a3631, n=10)
    for i in range(3): b.cy(0.1, 0.1, 1.2, Mt(fx, fy + 0.2, fz, i * 1.05, 0, math.pi / 2 - 0.25), WOOD_D, n=5)
    # hammock between two posts (Post's), rope + slung cloth
    (h0x, h0z, h0), (h1x, h1z, h1) = L['HAM']
    for (x, z, yb) in ((h0x, h0z, h0), (h1x, h1z, h1)): b.cy(0.15, 0.18, 2.4, Mt(x, yb + 1.2, z), WOOD_D, n=6)
    ym = (h0 + h1) / 2
    if lod == 0:
        for k in range(8):   # sagging cloth in 8 strips
            t = (k + 0.5) / 8; x = h0x + 0.4 + t * 3.2; sag = math.sin(t * math.pi) * 0.35
            b.bx(0.42, 0.06, 1.0, Mt(x, ym + 1.35 - sag, h0z, 0, 0, math.cos(t * math.pi) * 0.35), CLOTH if k % 2 else ROPE)
        for e in (-1, 1): b.bx(0.8, 0.04, 0.04, Mt(h0x + 2 + e * 2.1, ym + 1.5, h0z, 0, 0, e * 0.5), ROPE)
    else: b.bx(3.6, 0.08, 1.0, Mt(h0x + 2, ym + 1.1, h0z), ROPE)

# ---- far impostor (Post's far massing, library stone) ----
far = TB((CX, Y, CZ))
far.bx(40, 8, 2, Mt(CX, Y + 4, TEMPLE['z0'] + 0.8), STONE)
for s in range(4): far.bx(14 - s * 3, 1.6, 6 - s * 1.2, Mt(CX, Y + 0.8 + s * 1.6, TEMPLE['z0'] + 4.5), STONE_L)
for sx in (TEMPLE['x0'] + 0.8, TEMPLE['x1'] - 0.8): far.bx(1.7, 4, 36, Mt(sx, Y + 2, CZ), STONE)
far.bx(1.8, 7, 1.8, Mt(CX - 3.6, Y + 3.5, TEMPLE['z1'] - 1), STONE)

# ---- bake + export ----
def mats():
    out = []
    for nm, kind in (('d2_solid', 0), ('d2_glow', 1)):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        if kind == 1: nt.links.new(ca.outputs['Color'], bs.inputs['Emission Color']); bs.inputs['Emission Strength'].default_value = 3.0
        out.append(m)
    return out
MATS = mats(); REP = {}
coll = bpy.data.collections.new('d2'); bpy.context.scene.collection.children.link(coll)
def bake_obj(bd, name, parent):
    me = bd.bake(name); me.validate(clean_customdata=False)
    for m in MATS: me.materials.append(m)
    o = bpy.data.objects.new(name, me); coll.objects.link(o); o.parent = parent; return o
def node(name, origin):
    e = bpy.data.objects.new(name, None); coll.objects.link(e); e.location = (origin[0], -origin[2], origin[1]); return e
for name, (o, bl) in CH.items():
    root = node(name, o); REP[name] = {}
    for lod, bd in enumerate(bl): bake_obj(bd, f'{name}_LOD{lod}', root); REP[name][f'LOD{lod}'] = bd.tris()
    print(name, REP[name], flush=True)
root = node('d2_far', (CX, Y, CZ)); bake_obj(far, 'd2_far_FAR', root); REP['d2_far'] = far.tris()
# height check list for the runtime (js/island/d2Blender.js): BANKSY's build mode (js/island/terrainEdit.js) can move the ground; if the live
# foot.H differs from these baked heights by more than 1 cm anywhere, the game keeps Post's kit (it follows the live ground) instead
HCHK = [[round(T['x'], 3), round(T['z'], 3), T['y']] for S in L['steps'] for T in S['treads']] + [[a[0], a[1], a[2]] for a in (L['MB'], L['FIRE'], L['LEAN'], L['SIGN'], L['LEDGE'], L['LINTEL'], L['IDOL_HEAD'], *[i[:3] for i in L['IDOLS']], *L['HAM'])]
HCHK += [[x, z, round(Hx(x, z), 4)] for x in (TEMPLE['x0'] + 3, CX, TEMPLE['x1'] - 3) for z in (TEMPLE['z0'] + 8, CZ, TEMPLE['z1'] - 2)]
root['hchk'] = json.dumps(HCHK)
json.dump(REP, open(os.path.join(OUT, 'd2_report.json'), 'w'), indent=1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'd2_jungle.blend'))
for ob in bpy.data.objects: ob.select_set(True)
f = os.path.join(OUT, 'd2_jungle_raw.glb')
kw = dict(filepath=f, export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', f, os.path.getsize(f), 'TRIS', json.dumps(REP))
