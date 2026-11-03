# [Timothy] PUMPFUN PIRATES plaza docks in Blender (BANKSY "blender the plaza and docks"): the waterfront boardwalk, the 5 jetties
# (berths B1-B10), pilings with a waterline weathering band, mooring posts + iron bollards, rope, ladders, carved berth plaques B1-B10
# and the boardwalk -> street transition. Same numbers as js/island/plazaTown.js (BOARDWALK / BW_SEGS / JETTIES / BERTHS), so
# js/dock/docking.js berths, approach lanes and ship footprints are untouched, and every deck top = the walk height exactly:
#   boardwalk: one flat deck per BW_SEGS piece (the walk deck layout.js builds), east part flat at yE; jetties flat at j.y.
# Frame: Blender x = town lx, y = -lz, z = world y. One chunk node per ~20-26 m of boardwalk and per jetty (origin at its centre, so
# quantisation stays sub-mm), each with _LOD0 (desktop near) and _LOD1 (far + phones). Materials: dock_wood (real plank texture
# tools/plaza_blender/tex/dock_planks_512.jpg x vertex colour), dock_solid (vertex colour), dock_glow.
#   blender -b --factory-startup -P tools/plaza_blender/docks_blender.py -- OUT_DIR
import bpy, sys, os, math, json, random
import numpy as np
from mathutils import Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import Builder, T, hexc, text_mesh
OUT = sys.argv[sys.argv.index('--') + 1:][0]; os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__)); FONT = os.path.join(HERE, '..', '..', 'assets', 'JustAnotherHand.ttf')
TEX = os.path.join(HERE, 'tex', 'dock_planks_512.jpg'); TILE = 1.5
# ---- plazaTown.js numbers ----
Y_QUAY, Y_DECK = 2.6, 2.95; STREET_Y = Y_QUAY + 0.13
BW = dict(lx0=-176, lxS=-55, lx1=100, lz0=0, lz1=8, yW=Y_DECK, yE=STREET_Y + 0.02)
def bwY(lx): return BW['yW'] if lx <= BW['lx0'] else BW['yE'] if lx >= BW['lxS'] else BW['yW'] + (BW['yE'] - BW['yW']) * (lx - BW['lx0']) / (BW['lxS'] - BW['lx0'])
SEGS = []; st = (BW['lxS'] - BW['lx0']) / 12
for i in range(12): a = BW['lx0'] + i * st; SEGS.append((a, a + st, bwY(a + st / 2)))
JW, JLZ1, SHIP_OFF, SHIP_LZ = 12, 59, 13, 35
JETTIES = [dict(id='J%d' % (i + 1), lx=lx, y=round(bwY(lx), 3), lz0=BW['lz1']) for i, lx in enumerate([-150, -98, -46, 6, 58])]
BERTHS = [dict(id='B%d' % (i * 2 + k + 1), j=j, lx=j['lx'] + s * SHIP_OFF, side=s, alx=j['lx'] + s * (JW / 2 - 1.4)) for i, j in enumerate(JETTIES) for k, s in enumerate([-1, 1])]
SEA = 0.0                                  # waterline (the harbor sea plane)
WOOD, WOOD_D, WOOD_L, IRON, ROPE, GOLD, STONE = 0xffffff, 0x5a3a1e, 0xc48a50, 0x2b2b30, 0xc9a96a, 0xffc93c, 0xb8ad98
rng = random.Random(7)

class DB(Builder):                         # Builder + per-corner UVs (box / piling planar maps in metres / TILE)
    def __init__(self): super().__init__(); self.uvs = {0: [], 1: [], 2: []}
    def _add(self, V, F, col, mat=0, smooth=False, corner_cols=None, m=None, uv=None):
        W = super()._add(V, F, col, mat, smooth, corner_cols, m); self.uvs[mat].append(uv if uv is not None else [[(0, 0)] * len(f) for f in F]); return W
    def wbox(self, sx, sy, sz, x, y, z, grain='x', col=WOOD, rz=0, ry=0, base=False, cc=None):
        """textured timber box; grain = the local axis the boards / grain run along. base: z = bottom."""
        hx, hy, hz = sx / 2, sy / 2, sz / 2; zc = z + hz if base else z
        V = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz), (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
        F = [(3, 2, 1, 0), (5, 6, 7, 4), (1, 5, 4, 0), (2, 6, 5, 1), (3, 7, 6, 2), (0, 4, 7, 3)]   # outward normals
        ou, ov = rng.random(), rng.random(); AX = [(0, 1), (0, 1), (0, 2), (1, 2), (0, 2), (1, 2)]   # face -> the 2 local axes it spans
        uv = []
        for fi, f in enumerate(F):
            a, b = AX[fi]; g = {'x': 0, 'y': 1, 'z': 2}[grain]
            if b == g: a, b = b, a                       # u = the grain axis (texture boards run along u)
            uv.append([((V[i][a] + hx * 0) / TILE + ou, V[i][b] / TILE + ov) for i in f])
        return self._add(V, F, col, 0, False, cc, T(x, y, zc, 0, ry, rz), uv)
    def piling(self, x, y, z0, z1, r, n=8, lean=0.0):
        """round timber pile, grain vertical, vertex-colour weathering: algae below the sea, a pale barnacle band at the waterline,
        a wet dark band above it, sun-bleached wood up top"""
        hs = [z0, SEA - 0.3, SEA - 0.02, SEA + 0.05, SEA + 0.55, SEA + 0.62, SEA + 1.1, z1]; hs = sorted(set(h for h in hs if z0 <= h <= z1))
        def col(h):   # weathering band: algae under water, green slime at the waterline, a pale barnacle crust up to the splash line, a wet dark band, then sun-bleached wood
            if h < SEA - 0.25: return hexc(0x2e4434)
            if h < SEA + 0.03: return hexc(0x4f6b3c)
            if h < SEA + 0.58: return hexc(0xd8d2b8)
            if h < SEA + 1.0: return hexc(0x6e5a46)
            return hexc(0xe8dccb)
        V, F, CC, UV = [], [], [], []; ou = rng.random()
        for k, h in enumerate(hs):
            rr = r * (1.05 if SEA <= h <= SEA + 0.56 else 1.0)  # barnacle crust
            for i in range(n): a = 2 * math.pi * i / n; V.append((math.cos(a) * rr + lean * h, math.sin(a) * rr, h))
        for k in range(len(hs) - 1):
            for i in range(n):
                q = (k * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n, (k + 1) * n + i); F.append(q)
                CC.append([col(V[j][2]) for j in q]); UV.append([(V[j][2] / TILE + ou, ((j % n) + (1 if (j % n == 0 and q.index(j) in (1, 2) and i == n - 1) else 0)) / n * 0.35) for j in q])
        top = tuple(range(len(V) - n, len(V))); F.append(top); CC.append([hexc(0x8a7458)] * n); UV.append([(0.5 + 0.1 * math.cos(2 * math.pi * i / n), 0.5) for i in range(n)])
        self._add(V, F, None, 0, True, CC, T(x, y, 0), UV)
    def rope(self, pts, r=0.045, n=5, col=ROPE):
        V, F = [], []
        for k, p in enumerate(pts):
            d = np.subtract(pts[min(k + 1, len(pts) - 1)], pts[max(k - 1, 0)]); d = d / (np.linalg.norm(d) + 1e-9)
            u = np.cross(d, (0, 0, 1)); u = u / (np.linalg.norm(u) + 1e-9) if np.linalg.norm(u) > 1e-4 else np.array((1, 0, 0)); v = np.cross(d, u)
            for i in range(n): a = 2 * math.pi * i / n; V.append(tuple(np.add(p, r * math.cos(a) * u + r * math.sin(a) * v)))
        for k in range(len(pts) - 1):
            for i in range(n): F.append((k * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n, (k + 1) * n + i))
        self._add(V, F, col, 1, True)
    def bake(self, name):
        me = super().bake(name)
        if me is None: return None
        uvl = me.uv_layers.new(name='UVMap'); flat = []
        for mat in self.parts:
            for (V, F, *_), U in zip(self.parts[mat], self.uvs[mat]):
                for fu in U: flat.extend(fu)
        uvl.data.foreach_set('uv', np.array(flat, float).ravel()); return me

def bollard(b, x, y, z, lod):              # cast-iron bollard (same spot + 0.4 m collider as the blockout)
    n = 12 if lod == 0 else 7
    b.cyl(0.3, 0.26, 0.55, x, y, z, IRON, n=n, mat=1); b.cyl(0.38, 0.38, 0.12, x, y, z + 0.55, IRON, n=n, mat=1)
    if lod == 0: b.cyl(0.34, 0.3, 0.1, x, y, z, 0x3a3a40, n=n, mat=1); b.sphere(0.12, x, y, z + 0.7, IRON, mat=1)
def mooring_post(b, x, y, z, h=1.0, lod=0):  # timber mooring post: pile stub with an iron cap band
    b.piling(x, y, z - 0.05, z + h, 0.2, n=8 if lod == 0 else 6); b.cyl(0.215, 0.215, 0.08, x, y, z + h - 0.18, IRON, n=8, mat=1)
def ladder(b, x, y, ztop, zbot, face, lod):  # iron-strapped timber ladder down the side (face: +1/-1 along the axis it hangs off)
    if lod: return
    for s in (-0.25, 0.25): b.wbox(0.07, 0.07, ztop + 0.9 - zbot, x + s * (face[1] != 0), y + s * (face[0] != 0), zbot, 'z', WOOD_D, base=True)
    z = zbot + 0.3
    while z < ztop - 0.1: b.wbox(0.5 if face[1] else 0.05, 0.05 if face[1] else 0.5, 0.05, x, y, z, 'x' if face[1] else 'y', WOOD_D); z += 0.32
    for s in (-0.25, 0.25): b.torus(0.18, 0.025, x + s * (face[1] != 0), y + s * (face[0] != 0), ztop + 0.75, IRON, n=8, m_=4, rx=math.pi / 2 if face[1] else 0, ry=0 if face[1] else math.pi / 2, mat=1)
def rope_down(b, x, y, z, dx, dy, lod):      # mooring line from a bollard head over the edge, sagging into the water
    if lod: return
    pts = [(x + dx * t * 1.6, y + dy * t * 1.6, z + 0.62 - 0.35 * math.sin(t * math.pi) * 0.4 - (t ** 2.2) * (z + 0.62 - SEA + 0.3)) for t in np.linspace(0, 1, 9)]
    b.rope(pts); b.torus(0.33, 0.05, x, y, z + 0.6, ROPE, n=12, m_=5, mat=1); b.torus(0.33, 0.05, x, y, z + 0.66, ROPE, n=12, m_=5, rz=0.4, mat=1)
def coil(b, x, y, z, lod):
    if lod: return
    for k in range(3): b.torus(0.32 - k * 0.07, 0.05, x, y, z + 0.05 + k * 0.08, ROPE, n=12, m_=5, mat=1)
def plaque(b, x, y, z, side, text, lod):     # carved berth plaque on a post: dark board, gold carved numerals both faces
    b.wbox(0.2, 0.2, 1.6, x, y, z, 'z', WOOD_D, base=True); b.box(0.16, 1.75, 1.0, x, y, z + 1.95, 0x3b2414, mat=1)
    b.box(0.18, 1.85, 0.08, x, y, z + 2.48, 0x6b4a2a, mat=1); b.box(0.18, 1.85, 0.08, x, y, z + 1.42, 0x6b4a2a, mat=1)
    V, F, w = text_mesh(text, FONT, size=0.95, extrude=0.0, res=2 if lod == 0 else 1)
    for s in (-1, 1):   # text lies in the font XY plane -> stand it on the board face (normal +-x)
        # font plane (u, v, 0) -> board face: u runs along +-y (readable from the side it faces), v up z, face offset +-x
        M = Matrix(((0, 0, s), (s, 0, 0), (0, 1, 0))).to_4x4(); M.translation = (x + s * 0.083, y, z + 1.95)
        b.mesh(V, F, GOLD, M, mat=1, smooth=False)
    if lod == 0:
        for s in (-1, 1): b.box(0.06, 0.06, 0.06, x + s * 0.09, y + 0.75, z + 2.35, 0xb08a3c, mat=1); b.box(0.06, 0.06, 0.06, x + s * 0.09, y - 0.75, z + 2.35, 0xb08a3c, mat=1)

CHUNKS = []                                 # (name, cx, cz, builder per lod, colliders)
def chunk(name, cx, cz): d = dict(name=name, cx=cx, cz=cz, b=[DB(), DB()], col=[]); CHUNKS.append(d); return d

# ---- boardwalk chunks: 6 x 2 sloped BW_SEGS (flat steps <= 0.83 cm off the slope = the walk decks) + 6 flat east chunks ----
D, ZC = BW['lz1'] - BW['lz0'], (BW['lz0'] + BW['lz1']) / 2
pieces = [SEGS[i:i + 2] for i in range(0, 12, 2)]
east = np.linspace(BW['lxS'], BW['lx1'], 7); pieces += [[(east[i], east[i + 1], BW['yE'])] for i in range(6)]
roots = sorted([(j['lx'] - JW / 2, j['lx'] + JW / 2) for j in JETTIES])
spans = []; x0 = BW['lx0']
for a, b_ in roots: spans.append((x0, a)); x0 = b_
spans.append((x0, BW['lx1']))
BOLL = [(x, bwY(x)) for a, b_ in spans if b_ - a >= 1 for x in np.arange(a + 6, b_ - 3, 12)]   # = the blockout's bollard spots (lz lz1 - 0.9)
def in_root(lx, pad=0): return any(a - pad < lx < b_ + pad for a, b_ in roots)
for ci, segs in enumerate(pieces):
    lxa, lxb = segs[0][0], segs[-1][1]; c = chunk('dock_bw%02d' % ci, (lxa + lxb) / 2, ZC)
    for lod, b in enumerate(c['b']):
        b.push(T(-c['cx'], c['cz'], 0))   # chunk-local: Blender (lx - cx, -(lz - cz))
        for (a, e, y) in segs:
            L = e - a; xm = (a + e) / 2
            # deck: boards run across the walk (grain along lz = Blender y); top = the walk deck height; covers the walk zone lz -0.15..8.15
            if lod == 0:
                nb = max(1, round(L / 3.0)); bl = L / nb
                for k in range(nb): b.wbox(bl - 0.012, D + 0.3, 0.1, a + (k + 0.5) * bl, -ZC, y - 0.05, 'y', hexc(0xffffff) * (0.92 + 0.12 * rng.random()))
            else: b.wbox(L, D + 0.3, 0.1, xm, -ZC, y - 0.05, 'y')
            # fascia boards both edges, joists / bearers under, pilings in 2 rows every ~5 m
            for sz in (-0.5, 1):
                lzE = BW['lz0'] - 0.15 if sz < 0 else BW['lz1'] + 0.15
                b.wbox(L, 0.1, 0.32, xm, -lzE, y - 0.2, 'x', 0xb8a58a)
            if lod == 0:
                for lz in (1.0, 4.0, 7.0): b.wbox(L, 0.22, 0.22, xm, -lz, y - 0.21, 'x', 0x8c7a62)
            npl = max(1, round(L / 5)); step = L / npl
            for k in range(npl):
                px = a + (k + 0.5) * step
                if lod and k % 2: continue
                for lz in ((0.6, 7.6) if lod == 0 else (7.6,)):
                    if lz < 2 and px > BW['lxS']: continue       # east part: the inner row sits on the seawall
                    b.piling(px, -lz, SEA - 4.0, y - 0.32, 0.2, n=8 if lod == 0 else 6)
                    if lod == 0: b.wbox(0.24, D + 0.4, 0.2, px, -ZC, y - 0.42, 'y', 0x8c7a62)  # cross bearer
            # ---- boardwalk -> street transition: timber nosing flush at the inner edge; east of lxS a granite coping on the seawall
            if a >= BW['lxS'] - 0.01:
                b.box(L, 0.6, 0.06, xm, 0.45, STREET_Y + 0.006 - 0.03, STONE, mat=1)                 # coping lz -0.75..-0.15, top +6 mm
                if lod == 0:
                    for k in range(int(L // 2.2)): b.box(0.02, 0.6, 0.004, a + (k + 0.5) * 2.2, 0.45, STREET_Y + 0.006, 0x8f8572, mat=1)  # joints
        # sea rail between the jetty roots (open at every jetty) + bollards + mooring posts at the rail ends
        for a, e in spans:
            lo, hi = max(a, lxa), min(e, lxb)
            if hi - lo < 0.5: continue
            ya, yb = bwY(lo), bwY(hi); L = hi - lo; ang = math.atan2(yb - ya, L)
            b.wbox(math.hypot(L, yb - ya), 0.14, 0.14, (lo + hi) / 2, -(BW['lz1'] - 0.2), (ya + yb) / 2 + 0.95, 'x', 0x7a5634, ry=-ang)
            if lod == 0: b.wbox(math.hypot(L, yb - ya), 0.1, 0.1, (lo + hi) / 2, -(BW['lz1'] - 0.2), (ya + yb) / 2 + 0.5, 'x', 0x7a5634, ry=-ang)
            x = lo + 0.3
            while x <= hi:
                if lod == 0 or int((x - lo) / 2.5) % 2 == 0: b.wbox(0.12, 0.12, 1.0, x, -(BW['lz1'] - 0.2), bwY(x), 'z', 0x6a4a2c, base=True)
                x += 2.5
        for (x, y) in BOLL:
            if lxa <= x < lxb: bollard(b, x, -(BW['lz1'] - 0.9), y, lod)
            if lxa <= x < lxb and lod == 0 and int(x) % 24 < 12: coil(b, x - 0.9, -(BW['lz1'] - 0.7), y, lod)
        for (ra, rb) in roots:   # mooring posts where the rail stops at each jetty root
            for x in (ra - 0.35, rb + 0.35):
                if lxa <= x < lxb: mooring_post(b, x, -(BW['lz1'] - 0.2), bwY(x), 1.15, lod)
        for x in np.arange(lxa + 13, lxb - 2, 40):   # ladders down the sea face between jetties
            if not in_root(x, 3): ladder(b, x, -(BW['lz1'] + 0.2), bwY(x), SEA - 1.2, (0, -1), lod)
        b.pop()
    for (x, y) in BOLL:
        if lxa <= x < lxb: c['col'].append(['c', round(x, 3), BW['lz1'] - 0.9, 0.4])
        if lxa <= x < lxb and int(x) % 24 < 12: c['col'].append(['c', round(x - 0.9, 3), BW['lz1'] - 0.7, 0.42])   # rope coil beside it
    for (ra, rb) in roots:
        for x in (ra - 0.35, rb + 0.35):
            if lxa <= x < lxb: c['col'].append(['c', round(x, 3), BW['lz1'] - 0.2, 0.3])
    for a, e in spans:   # [collisions] the sea rail between the jetty roots (was walk-through: you stood half inside it)
        lo, hi = max(a, lxa), min(e, lxb)
        if hi - lo >= 0.5: c['col'].append(['b', round((lo + hi) / 2, 3), BW['lz1'] - 0.2, round(hi - lo, 3), 0.2])

# ---- jetties (boards across the walk; edge stringers, pile bents every 6 m, bollards at the blockout spots, mooring lines, ladders, plaques)
for j in JETTIES:
    lz0, lz1 = j['lz0'] - 0.5, JLZ1 + 0.15; L = lz1 - lz0; cz = (lz0 + lz1) / 2; y = j['y']; c = chunk('dock_' + j['id'], j['lx'], cz)
    for lod, b in enumerate(c['b']):
        b.push(T(-j['lx'], cz, 0))
        X = j['lx']
        if lod == 0:
            nb = math.ceil(L / 3.0); bl = L / nb
            for k in range(nb):
                for sx in (-1, 1): b.wbox(JW / 2 - 0.006, bl - 0.012, 0.1, X + sx * JW / 4, -(lz0 + (k + 0.5) * bl), y - 0.05, 'x', hexc(0xffffff) * (0.9 + 0.14 * rng.random()))
        else: b.wbox(JW, L, 0.1, X, -cz, y - 0.05, 'x')
        for sx in (-1, 1): b.wbox(0.12, L, 0.34, X + sx * (JW / 2 + 0.06), -cz, y - 0.17, 'y', 0xb8a58a)         # edge stringers (fascia)
        b.wbox(JW + 0.24, 0.12, 0.34, X, -(lz1 + 0.06), y - 0.17, 'x', 0xb8a58a)
        for zz in np.arange(lz0 + 3, lz1, 6.0 if lod == 0 else 12.0):
            b.wbox(JW + 0.4, 0.26, 0.26, X, -zz, y - 0.35, 'x', 0x8c7a62)                                       # pile cap
            for sx in ((-JW / 2 + 0.4, 0, JW / 2 - 0.4) if lod == 0 else (-JW / 2 + 0.4, JW / 2 - 0.4)): b.piling(X + sx, -zz, SEA - 4.5, y - 0.45, 0.24 if lod == 0 else 0.26, n=8 if lod == 0 else 6)
            if lod == 0:                                                                                     # X-brace across the bent (outer pile caps -> mid pile at the splash line)
                for sx in (-1, 1): dx, dz = JW / 2 - 0.4, (y - 0.6) - (SEA + 0.8); b.wbox(math.hypot(dx, dz), 0.1, 0.16, X + sx * dx / 2, -zz + 0.3, (y - 0.6 + SEA + 0.8) / 2, 'x', 0x6a5a48, ry=-sx * math.atan2(dz, dx))
        for sx in (-1, 1):
            for zz in (-16, 0, 16):
                bollard(b, X + sx * (JW / 2 - 0.5), -(SHIP_LZ + zz), y, lod)
                if zz != 0: rope_down(b, X + sx * (JW / 2 - 0.5), -(SHIP_LZ + zz), y, sx, 0, lod)
            ladder(b, X + sx * (JW / 2 + 0.2), -(lz0 + 8), y, SEA - 1.2, (sx, 0), lod)
            ladder(b, X + sx * 2.5, -(lz1 + 0.2), y, SEA - 1.2, (0, -1), lod)
            if lod == 0: coil(b, X + sx * (JW / 2 - 0.55), -(SHIP_LZ - 8), y, lod)
        for bt in BERTHS:
            if bt['j'] is j: plaque(b, bt['alx'], -(SHIP_LZ - 18), y, bt['side'], bt['id'], lod)
        b.pop()
    for sx in (-1, 1):
        for zz in (-16, 0, 16): c['col'].append(['c', X + sx * (JW / 2 - 0.5), SHIP_LZ + zz, 0.4])
        c['col'].append(['c', X + sx * (JW / 2 - 0.55), SHIP_LZ - 8, 0.4])
    for bt in BERTHS:
        if bt['j'] is j: c['col'].append(['b', round(X + bt['side'] * (JW / 2 - 0.775), 3), SHIP_LZ - 18, 1.55, 1.95])   # [collisions] the whole plaque board, out to the deck edge (no notch to stick in)

# ---- materials, objects, export ----
def mat(name, kind):
    m = bpy.data.materials.new(name); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']; bs.inputs['Roughness'].default_value = 0.85
    vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'
    if kind == 'wood':
        im = nt.nodes.new('ShaderNodeTexImage'); im.image = bpy.data.images.load(TEX); mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.inputs['Factor'].default_value = 1
        nt.links.new(im.outputs['Color'], mx.inputs['A']); nt.links.new(vc.outputs['Color'], mx.inputs['B']); nt.links.new(mx.outputs['Result'], bs.inputs['Base Color'])
    else: nt.links.new(vc.outputs['Color'], bs.inputs['Base Color'])
    return m
MATS = [mat('dock_wood', 'wood'), mat('dock_solid', 'solid'), mat('dock_glow', 'glow')]
root = bpy.data.objects.new('docks', None); bpy.context.scene.collection.objects.link(root)
rep = {}
for c in CHUNKS:
    node = bpy.data.objects.new(c['name'], None); node.location = (c['cx'], -c['cz'], 0); node.parent = root; bpy.context.scene.collection.objects.link(node)
    node['colliders'] = json.dumps(c['col']); node['lxlz'] = json.dumps([c['cx'], c['cz']])
    for lod, b in enumerate(c['b']):
        me = b.bake(c['name'] + '_LOD%d' % lod)
        for m in MATS: me.materials.append(m)
        me.validate(); o = bpy.data.objects.new(c['name'] + '_LOD%d' % lod, me); o.parent = node; bpy.context.scene.collection.objects.link(o)
        rep.setdefault(c['name'], {})['LOD%d' % lod] = b.tris()
tot = [sum(r['LOD%d' % i] for r in rep.values()) for i in (0, 1)]
print('docks LOD0', tot[0], 'LOD1', tot[1]); json.dump(dict(chunks=rep, total=tot, decks=dict(segs=SEGS, jetties=JETTIES)), open(os.path.join(OUT, 'docks_report.json'), 'w'), indent=1, default=str)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'docks.blend'))
kw = dict(filepath=os.path.join(OUT, 'docks_raw.glb'), export_format='GLB', export_extras=True, export_apply=False, export_yup=True, export_image_format='JPEG')
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
except TypeError: bpy.ops.export_scene.gltf(**kw)
