# [Timothy] PUMPFUN PIRATES fishing bridge + waterfall + the long high rope bridge in Blender (BANKSY 5:07 PM: "Now can you redo fishing bridge
# and waterfall area make it nicer in blender" / "Do the bridge too in blender"). Input = assets/island/falls_layout.json
# (tools/falls_blender/node/export_layout.mjs: foot.js BRIDGE, hillRound.js HB, the ground under every piece). VISUALS ONLY: the walk
# (foot.js bridgeAt / highBridgeAt, the area decks), colliders and heights stay in the game code; deck tops sit where the kit planks were.
# Shared material library (tools/plaza_blender/materials.py): planks_weathered decks, timber posts / stringers, rope rails, stone_ashlar
# abutments + newels, stone_trim sills / copings, iron lanterns. Natural rock, moss, reeds and planting are sculpted + vertex coloured.
#   blender -b --factory-startup -P tools/falls_blender/falls_blender.py -- OUT_DIR [preview]  ->  OUT/falls_raw.glb (+ falls_report.json)
#   node tools/plaza_blender/pack_shops.mjs OUT/falls_raw.glb assets/island falls      ->  falls.glb (LOD0) + falls_low.glb (LOD1, phones)
import bpy, bmesh, sys, os, math, json
import numpy as np
from mathutils import Matrix, Vector, noise
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'plaza_blender'))
from lib import Builder, hexc
argv = sys.argv[sys.argv.index('--') + 1:]; OUT = argv[0]; os.makedirs(OUT, exist_ok=True)
LAY = json.load(open(os.path.join(HERE, '..', '..', 'assets', 'island', 'falls_layout.json')))
bpy.ops.wm.read_factory_settings(use_empty=True)
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # three (x, y, z) -> Blender (x, -z, y)
Builder.GRIME = True
def hsh(i, j): s = math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - math.floor(s)
def tone(c, k):
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255; f = 1 + k; return (min(255, max(0, int(r * f))) << 16) | (min(255, max(0, int(g * f))) << 8) | min(255, max(0, int(b * f)))
PLANK = (0xd9a36b, 0xc28a55, 0xb57f4c); TIMB, TIMB_D, ROPE, IRON = 0xa86a3a, 0x6b4527, 0xc9a36b, 0x2b2f36
ASH, TRIM, DARK = 0xb9b2a6, 0xd2c9b6, 0x8a837a
ROCK = (0x8f877c, 0x9e978a, 0x7f786f, 0xa39a8b); MOSS = (0x5f8a3a, 0x4e7a30, 0x6f9a45); WET = 0x5c564f

# ---------- primitives in the THREE frame (x right, y up, z), relative to the section origin ----------
def mk(p=(0, 0, 0), yaw=0.0, pitch=0.0, roll=0.0, s=(1, 1, 1)):
    """three-frame 4x4: T @ Ry(yaw) @ Rx(pitch) @ Rz(roll) @ S  (the game's M(x, y, z, yaw, pitch, roll))"""
    cy, sy, cp, sp, cr, sr = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch), math.cos(roll), math.sin(roll)
    Ry = np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]); Rx = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]]); Rz = np.array([[cr, -sr, 0], [sr, cr, 0], [0, 0, 1]])
    M = np.eye(4); M[:3, :3] = Ry @ Rx @ Rz @ np.diag(s); M[:3, 3] = p; return M
def xf(V, M): V = np.asarray(V, float); return V @ M[:3, :3].T + M[:3, 3]
BOXV = np.array([(-.5, -.5, -.5), (.5, -.5, -.5), (.5, .5, -.5), (-.5, .5, -.5), (-.5, -.5, .5), (.5, -.5, .5), (.5, .5, .5), (-.5, .5, .5)])
BOXF = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)]   # outward in a right-handed frame
class FB(Builder):
    def __init__(self): super().__init__(); self.stack = [C]
    def bx(self, w, h, d, M, col, lib=None, mat=0):
        self.mesh(xf(BOXV * (w, h, d), M), BOXF, col, mat=(lib if lib and mat == 0 else mat), smooth=False)
    def prism_y(self, pts, h, M, col, lib=None):   # polygon in local xz (CCW seen from +y), extruded 0..h up y
        n = len(pts); V = [(x, 0, z) for x, z in pts] + [(x, h, z) for x, z in pts]
        F = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        self.mesh(xf(V, M), F, col, mat=lib or 0, smooth=False)
    def cylv(self, a, b, r0, r1, col, n=6, lib=None, mat=0, caps=True):   # a tapered cylinder from point a to point b
        a = np.asarray(a, float); b = np.asarray(b, float); d = b - a; L = np.linalg.norm(d)
        if L < 1e-6: return
        w = d / L; t = np.array([1.0, 0, 0]) if abs(w[0]) < 0.9 else np.array([0, 0, 1.0]); u = np.cross(w, t); u /= np.linalg.norm(u); v = np.cross(w, u)
        V = [a + (u * math.cos(2 * math.pi * i / n) + v * math.sin(2 * math.pi * i / n)) * r0 for i in range(n)] + [b + (u * math.cos(2 * math.pi * i / n) + v * math.sin(2 * math.pi * i / n)) * r1 for i in range(n)]
        F = [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
        if caps: F += [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))]
        self.mesh(V, F, col, mat=(lib if lib and mat == 0 else mat), smooth=True)
    def rope(self, pts, r, col=ROPE, n=6):    # a polyline rope: one tube, rope library layer
        pts = [np.asarray(p, float) for p in pts]; ring = []
        for i, p in enumerate(pts):
            d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]); d /= (np.linalg.norm(d) + 1e-9)
            t = np.array([0, 1.0, 0]) if abs(d[1]) < 0.9 else np.array([1.0, 0, 0]); u = np.cross(d, t); u /= np.linalg.norm(u); v = np.cross(d, u)
            ring.append([p + (u * math.cos(2 * math.pi * k / n) + v * math.sin(2 * math.pi * k / n)) * r for k in range(n)])
        V = [q for rr in ring for q in rr]; F = []
        for i in range(len(pts) - 1):
            for k in range(n): F.append((i * n + k, i * n + (k + 1) % n, (i + 1) * n + (k + 1) % n, (i + 1) * n + k))
        F += [tuple(range(n - 1, -1, -1)), tuple(range((len(pts) - 1) * n, len(pts) * n))]
        self.mesh(V, F, col, mat='rope', smooth=True)
    def rock(self, M, seed, sub=2, cols=ROCK, moss=0.0, wet_y=None, strata=0.0, rough=0.28, mossc=MOSS):
        """a sculpted rock: noise-displaced icosphere (unit radius) under M; per-corner colour: tone noise, strata bands, moss on the tops, wet foot"""
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
        V0 = np.array([tuple(v.co) for v in bm.verts]); Fs = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
        o = Vector((seed * 3.17, seed * 1.31, seed * 2.03)); D = []
        for p in V0:
            q = Vector(p) * 1.3 + o; n1 = noise.noise(q); n2 = noise.noise(q * 2.7) * 0.4
            k = 1 + rough * (n1 + n2); 
            if p[1] < -0.35: k *= 0.85 + 0.15 * (p[1] + 1)      # flatter base
            D.append(p * k)
        D = np.array(D); D[:, 1] = np.where(D[:, 1] > 0.55, 0.55 + (D[:, 1] - 0.55) * 0.55, D[:, 1])   # a flat-ish top (tables / ledges)
        W = xf(D, M); CC = []
        for f in Fs:
            P = W[list(f)]; nrm = np.cross(P[1] - P[0], P[2] - P[0]); nrm /= (np.linalg.norm(nrm) + 1e-9); fc = []
            for vi in f:
                p = W[vi]; base = hexc(cols[int(hsh(seed, vi % 7) * len(cols)) % len(cols)])
                t = 0.92 + 0.16 * (noise.noise(Vector((p[0] * 0.7, p[1] * 0.7, p[2] * 0.7))) * 0.5 + 0.5)
                c = base * t
                if strata: c = c * (0.9 + 0.12 * math.sin(p[1] * strata + seed))
                if moss and nrm[1] > 0.45 and noise.noise(Vector((p[0] * 0.45, p[1] * 0.45 + 7, p[2] * 0.45))) > 0.35 - moss:
                    c = hexc(mossc[int(hsh(vi, seed) * len(mossc)) % len(mossc)]) * (0.9 + 0.15 * nrm[1])
                if wet_y is not None and p[1] < wet_y + 0.25: c = c * 0.7 + hexc(WET) * 0.3
                fc.append(np.clip(c, 0, 1))
            CC.append(fc)
        self.mesh(W, Fs, 0x888888, corner_cols=CC, smooth=True)
    def blade(self, base, h, w, yaw, lean, col, col2=None, segs=2):   # a tapered two-sided blade (reed / fern frond), bent by lean
        V = []; F = []; dirx, dirz = math.sin(yaw), math.cos(yaw)
        for i in range(segs + 1):
            t = i / segs; y = h * t * (1 - 0.25 * lean * t); off = lean * h * t * t; ww = w * (1 - t * 0.9)
            cx, cz = base[0] + dirx * off, base[2] + dirz * off
            V.append((cx - dirz * ww / 2, base[1] + y, cz + dirx * ww / 2)); V.append((cx + dirz * ww / 2, base[1] + y, cz - dirx * ww / 2))
        for i in range(segs): a = 2 * i; F.append((a, a + 1, a + 3, a + 2)); F.append((a, a + 2, a + 3, a + 1))
        cc = []
        for f in F: cc.append([hexc(col) * (0.85 + 0.25 * (vi // 2) / segs) if col2 is None else (hexc(col) if vi < 2 else hexc(col2)) for vi in f])
        self.mesh(V, F, col, corner_cols=cc, smooth=False)

# ---------- the bridges ----------
def bridge(b, A, Bp, O, yf, W, rail, *, top=0.0, pitch=0.62, post_every=4, hi=True, kind='d3', piers=()):
    """deck along A->B (three xz), height yf(t) = the walk deck; planks with their top at yf + top"""
    ax, az = A; bxx, bzz = Bp; L = math.hypot(bxx - ax, bzz - az); yaw = math.atan2(bxx - ax, bzz - az); cs, sn = math.cos(yaw), math.sin(yaw)
    def P(t, s=0.0, up=0.0): return np.array([ax + (bxx - ax) * t + cs * s - O[0], yf(t) + up - O[1], az + (bzz - az) * t - sn * s - O[2]])
    if not hi: pitch *= 2; post_every = max(1, post_every // 2)   # phones: half the boards (each twice as deep), same post spacing
    n = max(2, round(L / pitch))
    for i in range(n + 1):   # planks (slight random yaw, width + tone variety, the odd thinner one)
        t = i / n; dy = (yf(min(1, t + 0.01)) - yf(max(0, t - 0.01))) / (0.02 * L); pt = -math.atan(dy)
        ww = W * (0.95 + 0.07 * hsh(i, 1)); th = 0.1 if kind == 'd3' else 0.12; c = tone(PLANK[int(hsh(i, 2) * 3) % 3], (hsh(i, 4) - 0.5) * 0.12)
        b.bx(ww, th, pitch * (0.78 + 0.08 * hsh(i, 5)), mk(P(t, (hsh(i, 6) - 0.5) * 0.08, top - th / 2), yaw + (hsh(i, 3) - 0.5) * 0.04, pt, (hsh(i, 7) - 0.5) * 0.02), c, 'planks_weathered')
        if hi and i % 2 == 0:   # nail heads / iron spikes at both ends
            for s in (-1, 1): b.bx(0.06, 0.02, 0.06, mk(P(t, s * (ww / 2 - 0.18), top + 0.005), yaw), IRON, 'iron')
    # under the planks: d3 = two pairs of hemp foot ropes + timber bearers every 4 planks; hb = sawn timber stringers + bearers
    ns = max(8, n // 2); ts = [i / ns for i in range(ns + 1)]
    if kind == 'd3':
        for s in (-1, 1):
            for off in (0.55, 1.2): b.rope([P(t, s * off, top - 0.16) for t in ts], 0.07 if off > 1 else 0.055, ROPE, 6 if hi else 5)
    else:
        for s in (-1, 1):
            for j in range(ns):
                t0, t1 = ts[j], ts[j + 1]; a, c2 = P(t0, s * (W / 2 - 0.65), top - 0.32), P(t1, s * (W / 2 - 0.65), top - 0.32); d = c2 - a
                b.bx(0.3, 0.4, float(np.linalg.norm(d)) + 0.02, mk((a + c2) / 2, yaw, -math.atan2(d[1], math.hypot(d[0], d[2]))), tone(TIMB_D, (hsh(j, s + 3) - 0.5) * 0.1), 'timber')
    for i in range(0, n + 1, 4 if hi else 2):
        t = i / n; b.bx(W + 0.4, 0.14, 0.16, mk(P(t, 0, top - 0.2 if kind == 'd3' else top - 0.58)), TIMB_D, 'timber')
    # posts + rope rails (+ lashings, + net hangers on LOD0)
    posts = list(range(0, n + 1, post_every)); posts[-1] = n
    for i in posts:
        t = i / n
        for s in (-1, 1):
            base = P(t, s * rail, top - (0.3 if kind == 'd3' else 0.62)); tp = P(t, s * rail, top + 1.32)
            b.bx(0.15, float(tp[1] - base[1]), 0.15, mk((base + tp) / 2, yaw), tone(TIMB, (hsh(i, s) - 0.5) * 0.12), 'timber')
            b.bx(0.19, 0.06, 0.19, mk(tp + (0, 0.03, 0), yaw), TIMB_D, 'timber')
            if hi:
                for hh in (1.15, 0.55): b.cylv(P(t, s * rail, top + hh - 0.06), P(t, s * rail, top + hh + 0.06), 0.11, 0.11, ROPE, 6, 'rope')
                if kind == 'hb': b.cylv(P(t, s * (rail - 0.1), top + 0.04), P(t, s * (rail - 0.1), top - 0.5), 0.03, 0.03, IRON, 4, 'iron')   # strap bolt
    for s in (-1, 1):
        for hh, r in ((1.15, 0.07 if kind == 'd3' else 0.075), (0.55, 0.045 if kind == 'd3' else 0.05)):
            pts = []
            for q in range(len(posts) - 1):
                t0, t1 = posts[q] / n, posts[q + 1] / n
                for k in range(3 if hi else 2): u = k / (3 if hi else 2); tt = t0 + (t1 - t0) * u; pts.append(P(tt, s * (rail - 0.02), top + hh - 0.05 * math.sin(u * math.pi)))
            pts.append(P(1, s * (rail - 0.02), top + hh)); b.rope(pts, r, ROPE, 6 if hi else 4)
        if hi:
            for q in range(len(posts) - 1):   # net: an X of thin rope in every bay + a vertical drop, below the hand rope
                t0, t1 = posts[q] / n, posts[q + 1] / n
                b.cylv(P(t0, s * rail, top + 0.05), P(t1, s * rail, top + 0.55), 0.018, 0.018, ROPE, 3, 'rope', caps=False)
                b.cylv(P(t1, s * rail, top + 0.05), P(t0, s * rail, top + 0.55), 0.018, 0.018, ROPE, 3, 'rope', caps=False)
                tm = (t0 + t1) / 2; b.cylv(P(tm, s * rail, top - 0.1), P(tm, s * rail, top + 1.12), 0.02, 0.02, ROPE, 3, 'rope', caps=False)
    # piers (hb): timber knee braces from the stone pier faces up under the stringers + a corbel beam each side
    for tp in piers:
        for du in (-1, 1):
            for s in (-1, 1):
                a = P(tp + du * 2.0 / L, s * (W / 2 - 0.65), top - 2.3); c2 = P(tp + du * 3.8 / L, s * (W / 2 - 0.65), top - 0.52); b.cylv(a, c2, 0.13, 0.12, TIMB_D, 6, 'timber')
                b.bx(0.34, 0.3, 4.6, mk(P(tp + du * 0.0, s * (W / 2 - 0.65), top - 0.67), yaw), TIMB, 'timber') if du > 0 else None
            b.bx(W + 0.9, 0.08, 0.12, mk(P(tp + du * 2.02 / L, 0, top - 0.25)), IRON, 'iron')   # iron tie plate on the pier face line
    return P, yaw, L

def newel(b, base, top_y, w, yaw, hi, lantern=True):
    """a dressed stone newel: battered ashlar shaft, trim cap + pyramid, quoins (LOD0), an iron lantern on top. returns the lantern glass centre"""
    h = top_y - base[1]; c = np.array(base, float)
    b.bx(w + 0.16, 0.35, w + 0.16, mk(c + (0, 0.175, 0), yaw), DARK, 'stone_ashlar')                   # plinth
    b.bx(w, h - 0.35, w, mk(c + (0, 0.35 + (h - 0.35) / 2, 0), yaw), ASH, 'stone_ashlar')
    b.bx(w + 0.14, 0.16, w + 0.14, mk(c + (0, h + 0.08, 0), yaw), TRIM, 'stone_trim')
    b.prism_y([(-w / 2, -w / 2), (w / 2, -w / 2), (w / 2, w / 2), (-w / 2, w / 2)], 0.001, mk(c + (0, h + 0.16, 0), yaw), TRIM)   # (cap seat)
    b.mesh(xf([(-w / 2, 0, -w / 2), (w / 2, 0, -w / 2), (w / 2, 0, w / 2), (-w / 2, 0, w / 2), (0, 0.22, 0)], mk(c + (0, h + 0.16, 0), yaw)), [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)], TRIM, mat='stone_trim', smooth=False)
    if hi:
        for k in range(int((h - 0.5) / 0.5)):
            for sx, sz in (((1, 1), (-1, -1)) if k % 2 else ((1, -1), (-1, 1))): b.bx(0.22, 0.2, 0.22, mk(c + (sx * (w / 2 - 0.08), 0.55 + k * 0.5, sz * (w / 2 - 0.08)), yaw), tone(TRIM, -0.06), 'stone_trim')
    if not lantern: return c + (0, h + 0.4, 0)
    y0 = h + 0.38; b.cylv(c + (0, h + 0.16, 0), c + (0, y0 + 0.02, 0), 0.04, 0.04, IRON, 5, 'iron')
    return lamp(b, c + (0, y0, 0), yaw, hi)
def lamp(b, base, yaw, hi, s=1.0):
    """an iron lantern standing on base: cage + roof + ring, warm glass (glow). returns the glass centre"""
    c = np.array(base, float); g = c + (0, 0.26 * s, 0)
    b.bx(0.34 * s, 0.05 * s, 0.34 * s, mk(c + (0, 0.025 * s, 0), yaw), IRON, 'iron'); b.bx(0.24 * s, 0.34 * s, 0.24 * s, mk(g, yaw), 0xffd27a, mat=1)
    for sx, sz in ((1, 1), (1, -1), (-1, 1), (-1, -1)): b.bx(0.035 * s, 0.38 * s, 0.035 * s, mk(g + np.array(xf([(sx * 0.14 * s, 0, sz * 0.14 * s)], mk(yaw=yaw))[0]), yaw), IRON, 'iron')
    rt = c + (0, 0.45 * s, 0); b.mesh(xf([(-.2, 0, -.2), (.2, 0, -.2), (.2, 0, .2), (-.2, 0, .2), (0, .2, 0)], mk(rt, yaw, s=(s, s, s))), [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)], IRON, mat='iron', smooth=False)
    if hi: b.cylv(rt + (0, 0.2 * s, 0), rt + (0, 0.3 * s, 0), 0.04 * s, 0.04 * s, IRON, 4, 'iron')
    return g

def build_d3(b, hi):
    D = LAY['d3']; O = [16.0, D['deckY'], (D['az'] + D['bz']) / 2]; yf = lambda t: D['deckY'] - math.sin(t * math.pi) * D['sag']
    P, yaw, L = bridge(b, (D['ax'], D['az']), (D['bx'], D['bz']), O, yf, 3.0, 1.5, top=0.10, pitch=0.62, post_every=4, hi=hi, kind='d3')
    rel = lambda p: np.array([p[0] - O[0], p[1] - O[1], p[2] - O[2]]); out = {'lamps': []}
    cs, sn = math.cos(yaw), math.sin(yaw)
    for e in D['ends']:
        d = e['dir']; ex, ez = e['x'], e['z']; along = lambda u, s=0.0, y=0.0: np.array([ex + sn * d * u + cs * s - O[0], y - O[1], ez + cs * d * u - sn * s - O[2]])
        top = D['deckY'] + 0.10; gmin = min(f[1] for f in e['foot'])
        # the abutment: a stone sill flush with the deck end + the approach (walk = foot.js bridgeAt's 1 m landing, then the steps), on an ashlar
        # body down into the slot, battered back under the deck end; flared wing walls outside the approach rails
        b.bx(3.9, 0.22, 1.5, mk(along(0.75, 0, top - 0.11), yaw), TRIM, 'stone_trim')
        hb_ = top - 0.22 - (gmin - 0.8); b.bx(3.9, hb_, 1.5, mk(along(0.75, 0, top - 0.22 - hb_ / 2), yaw), ASH, 'stone_ashlar')
        b.bx(4.3, 3.2, 1.6, mk(along(-0.6, 0, top - 0.25 - 1.6), yaw, d * 0.12), tone(ASH, -0.06), 'stone_ashlar')   # battered face under the deck end
        if hi:
            for k in range(3): b.bx(4.36 - k * 0.04, 0.06, 1.62, mk(along(-0.6 - d * 0.06 * k, 0, top - 0.6 - k * 0.9), yaw, d * 0.12), DARK, 'stone_trim')   # coursing
        for j, (px, py, pz) in enumerate(e['posts']):
            s = -1 if j == 0 else 1; base = rel((px, min(py, top - 0.1) - 0.4, pz))
            g = newel(b, base, top + 1.45 - O[1], 0.72, yaw, hi, lantern=True); out['lamps'].append([float(g[0] + O[0]), float(g[1] + O[1]), float(g[2] + O[2])])
            # wing wall: from the newel back along the approach, outside its rope rail (approach hw + 0.15 = 2.05)
            wl = 2.4; wb = along(1.2 + wl / 2 + 0.3, s * 2.42, 0); gy = min(py, top) - 0.5; wh = top + 0.75 - gy
            b.bx(0.5, wh, wl, mk(wb + (0, gy + wh / 2, 0), yaw + s * d * 0.08), ASH, 'stone_ashlar'); b.bx(0.62, 0.14, wl + 0.1, mk(wb + (0, top + 0.82, 0), yaw + s * d * 0.08), TRIM, 'stone_trim')
            # the hand rope's end: from the deck's rail to the newel top + a back stay down to the stone anchor (the old bollard spot)
            rail_end = P(0.0 if d < 0 else 1.0, s * 1.48, 0.10 + 1.15); nt = rel((px, top + 1.45 + 0.16, pz))
            b.rope([rail_end, nt + (0, -0.05, 0)], 0.075, ROPE, 6 if hi else 4)
            bx_, by_, bz_ = e['backs'][j]; an = rel((bx_, by_, bz_)); b.bx(0.62, 0.75, 0.62, mk(an + (0, 0.2, 0), yaw + 0.3 * s), tone(ASH, -0.1), 'stone_ashlar')
            b.bx(0.72, 0.12, 0.72, mk(an + (0, 0.6, 0), yaw + 0.3 * s), TRIM, 'stone_trim')
            if hi: b.cylv(an + (0, 0.66, 0), an + (0, 0.82, 0), 0.09, 0.09, IRON, 6, 'iron')
            b.rope([nt + (0, -0.2, 0), an + (0, 0.78, 0)], 0.06, ROPE, 5 if hi else 4)
    return O, out

def build_hb(b, hi):
    D = LAY['hb']; L = D['L']; piers = D['piers']
    def yf(u):   # = hillRound.js HB.yAt (the walk deck)
        u = min(1, max(0, u)); Pp = [0] + piers + [1]; k = 0
        while k < len(Pp) - 2 and u > Pp[k + 1]: k += 1
        f = (u - Pp[k]) / (Pp[k + 1] - Pp[k]); return D['ya'] + (D['yb'] - D['ya']) * u - math.sin(f * math.pi) * D['sag']
    O = [(D['ax'] + D['bx']) / 2, D['ya'], (D['az'] + D['bz']) / 2]; RW = D['half'] + 0.25
    P, yaw, L = bridge(b, (D['ax'], D['az']), (D['bx'], D['bz']), O, yf, RW * 2 + 0.3, RW, top=0.0, pitch=0.6, post_every=4, hi=hi, kind='hb', piers=piers)
    cs, sn = math.cos(yaw), math.sin(yaw); ux, uz = sn, cs
    def at(u, s, y): return np.array([D['bx'] + ux * u + uz * s - O[0], y - O[1], D['bz'] + uz * u - ux * s - O[2]])
    # plaza end: a dressed threshold sill across the parapet opening
    a0 = np.array([D['ax'] - O[0], D['ya'] - O[1], D['az'] - O[2]])
    b.bx(5.6, 0.2, 0.8, mk(a0 + np.array([-ux * 0.15, -0.095, -uz * 0.15]), yaw), TRIM, 'stone_trim')
    # plateau end: the landing sill flush with the deck + the trail (ground under it from the layout), on an ashlar body; flared wing walls
    G = {(p[0], p[1]): p[2] for p in D['plateau']}; gnd = lambda u, s: G.get((round(u, 2), round(s, 2)))
    ys = [G[k] for k in G if k[0] <= 1.8 and abs(k[1]) <= 2.4]; top = max(D['yb'], max(ys) + 0.02); gl = max(min(ys) - 0.7, D['yb'] - 3.0)   # (the plateau's cliff edge: the body stops 3 m down)
    b.bx(5.4, 0.2, 1.6, mk(at(0.8, 0, top - 0.1), yaw), TRIM, 'stone_trim'); b.bx(5.4, top - 0.2 - gl, 1.6, mk(at(0.8, 0, (top - 0.2 + gl) / 2), yaw), ASH, 'stone_ashlar')
    if hi:
        for s in (-1, 1): b.bx(0.3, 0.06, 1.6, mk(at(0.8, s * 2.55, top + 0.01), yaw), DARK, 'stone_trim')   # kerb edges along the sill
        y = top - 0.75
        while y > gl + 0.3: b.bx(5.46, 0.06, 1.66, mk(at(0.8, 0, y), yaw), DARK, 'stone_trim'); y -= 0.7   # coursing
        for s in (-1, 1):
            for k in range(int((top - gl - 0.4) / 0.5)): b.bx(0.3, 0.22, 0.3 if k % 2 else 0.5, mk(at(0.8 - 0.65, s * 2.62, top - 0.45 - k * 0.5), yaw), tone(TRIM, -0.06), 'stone_trim')
    for s in (-1, 1):   # wing walls: from beside the newel (lateral 3.25 at u 0.6) flaring out to lateral 4.6 at u 3.4
        a, c2 = (0.9, s * 3.6), (3.4, s * 4.5); ga, gc = gnd(1.0, s * 3.4) or top, gnd(3.4, s * 4.4) or top
        ma = at(a[0], a[1], 0); mc = at(c2[0], c2[1], 0); mid = (ma + mc) / 2; lw = float(np.hypot(*(mc - ma)[[0, 2]])); wy = math.atan2((mc - ma)[0], (mc - ma)[2])
        g0 = min(ga, gc) - 0.45; t0 = max(ga, gc) + 0.7; b.bx(0.5, t0 - g0, lw, mk(mid + (0, (t0 + g0) / 2 - 0, 0), wy), ASH, 'stone_ashlar')
        b.bx(0.64, 0.14, lw + 0.12, mk(mid + (0, t0 + 0.07, 0), wy), TRIM, 'stone_trim')
        if hi: b.bx(0.56, 0.3, lw + 0.04, mk(mid + (0, g0 + 0.6, 0), wy), DARK, 'stone_ashlar')
        # a mossy planted bed against each wing wall
        for q in range(3 if hi else 1): gy = gnd(2.6, s * 4.4) or top; rock_plant(b, at(2.2 + q * 0.7, s * (5.1 + 0.1 * q), gy - 0.05), 0.7, q + (5 if s > 0 else 9), hi)
    return O, {}

# ---------- the waterfall area ----------
def rock_plant(b, p, s, seed, hi):
    c = np.array(p, float)
    if seed % 2: b.rock(mk(c + (0, 0.25 * s, 0), seed, s=(0.7 * s, 0.5 * s, 0.7 * s)), seed + 400, 1, MOSS, rough=0.35)
    for k in range(5 if hi else 3):
        a = k / (5 if hi else 3) * 2 * math.pi + seed; b.blade(c, 0.9 * s, 0.22 * s, a, 0.9, 0x4f8a32 if k % 2 else 0x5f9a3a, segs=2 if hi else 1)
def build_area(b, hi):
    A = LAY['area']; LK = A['lake']; O = [LK['x'], LK['y'], LK['z']]; rel = lambda p: np.array([p['x'] - O[0], p['y'] - O[1], p['z'] - O[2]])
    for p in A['pieces']:
        k, s, sd = p['k'], p['s'], p['seed']; c = rel(p)
        if p.get('lod') == 0 and not hi: continue
        if k == 'ledge':   # a strata slab lying along the contour, half buried in the face, mossy top
            b.rock(mk(c + (0, -0.12 * s, 0), p['yaw'], 0.15 * (hsh(sd, 2) - 0.5), 0.0, s=(s * 0.62, s * 0.2, s * 0.32)), sd, 2 if hi else 1, ROCK, moss=0.55, strata=7.0, rough=0.22)
            if hi and hsh(sd, 3) > 0.45: b.rock(mk(c + (0.3 * s * math.sin(p['yaw']), 0.18 * s, 0.3 * s * math.cos(p['yaw'])), p['yaw'] + 0.4, s=(s * 0.28, s * 0.14, s * 0.2)), sd + 900, 1, ROCK, moss=0.5, rough=0.3)
        elif k == 'buttress':   # a stack of 4 blocky rocks beside the sheet, dark + wet on the falls side
            for q in range(4):
                r = s * (1.0 - q * 0.17); off = (p['side'] * (0.3 * q), q * s * 0.75, -0.4 * q)
                b.rock(mk(c + off + (0, r * 0.35, 0), sd + q, 0, 0.1 * p['side'], s=(r * 0.9, r * 0.8, r * 0.75)), sd * 7 + q, 2 if hi else 1, (0x7a736a, 0x857e73, 0x6d675f), moss=0.35, wet_y=0.6, strata=4.0, rough=0.25)
        elif k == 'boulder':
            b.rock(mk(c + (0, s * 0.25, 0), sd * 1.7, 0.3, 0.2, s=(s * 1.2, s * 0.8, s)), sd, 2 if hi else 1, ROCK, moss=0.45, wet_y=0.5)
        elif k == 'rim':   # a flattened, half-sunk rim stone with a moss cap: the basin edge
            b.rock(mk(c + (0, s * 0.08, 0), p['yaw'] + hsh(sd, 1), 0, 0, s=(s * 1.3, s * 0.5, s)), sd, 1, ROCK, moss=0.75, wet_y=0.25, rough=0.3)
            if hi and hsh(sd, 2) > 0.5: b.rock(mk(c + (s * 0.9, s * 0.02, s * 0.4), p['yaw'] + 1.1, s=(s * 0.5, s * 0.25, s * 0.45)), sd + 700, 1, ROCK, moss=0.6, rough=0.3)
        elif k == 'pebble':
            b.rock(mk(c + (0, s * 0.15, 0), sd, s=(s * 1.3, s * 0.5, s)), sd, 0, (0xa8a196, 0x8f877c, 0xc9c1b3, 0x7f786f), rough=0.2)
        elif k == 'reeds':   # 6-9 blades + 1-2 cattails
            nb = 7 if hi else 4
            for q in range(nb):
                a = q / nb * 2 * math.pi + sd; base = c + (math.cos(a) * 0.18 * s, -0.25, math.sin(a) * 0.18 * s)
                b.blade(base, (1.5 + 0.7 * hsh(sd, q)) * s, 0.09, a, 0.35, 0x6f9a3a if q % 2 else 0x557f2c, 0xa8b860, segs=3 if hi else 1)
            for q in range(2 if hi else 1):
                tp = c + (0.1 * q, (1.8 + 0.3 * q) * s, 0.05 * q); b.cylv(c + (0.1 * q, -0.2, 0.05 * q), tp, 0.012, 0.01, 0x6f9a3a, 3, caps=False)
                b.cylv(tp + (0, -0.32 * s, 0), tp + (0, -0.02, 0), 0.05, 0.05, 0x6b4527, 6)
        elif k == 'plant':
            v = p['v']
            if v == 0:   # fern
                for q in range(7 if hi else 4): b.blade(c, 0.95 * s, 0.3 * s, q * 0.9 + sd, 1.2, 0x4f8a32 if q % 2 else 0x3f7a2a, segs=3 if hi else 1)
            elif v == 1:   # a moss-green shrub
                b.rock(mk(c + (0, 0.35 * s, 0), sd, s=(0.8 * s, 0.6 * s, 0.75 * s)), sd + 300, 1 if hi else 0, (0x4e8a34, 0x5f9a3a, 0x3f7a2a), rough=0.4)
            elif v == 2:   # flowering shrub (red / yellow / white heads)
                b.rock(mk(c + (0, 0.3 * s, 0), sd, s=(0.6 * s, 0.5 * s, 0.6 * s)), sd + 310, 1 if hi else 0, (0x4e8a34, 0x5f9a3a), rough=0.35)
                if hi:
                    for q in range(5): a = q * 1.3 + sd; b.rock(mk(c + (math.cos(a) * 0.4 * s, 0.62 * s + 0.1 * hsh(q, sd), math.sin(a) * 0.4 * s), s=(0.09, 0.09, 0.09)), sd + q, 0, ((0xd8322f, 0xffc93c, 0xf4efe6)[sd % 3],), rough=0.1)
            else:   # mossy stone + ferns
                rock_plant(b, c, s, sd, hi)
        elif k == 'lantern':   # a trail lantern: stone footing, timber post + bracket, hanging iron lantern
            yw = p['yaw']; b.bx(0.55, 0.35, 0.55, mk(c + (0, 0.1, 0), yw), DARK, 'stone_ashlar')
            b.bx(0.16, 2.5, 0.16, mk(c + (0, 1.5, 0), yw), TIMB_D, 'timber'); b.bx(0.2, 0.08, 0.2, mk(c + (0, 2.78, 0), yw), TIMB_D, 'timber')
            arm = np.array(xf([(0, 0, 0.55)], mk(yaw=yw + math.pi / 2))[0]); b.bx(0.1, 0.1, 0.7, mk(c + (0, 2.55, 0) + arm / 2, yw + math.pi / 2), TIMB_D, 'timber')
            if hi: b.cylv(c + (0, 2.2, 0), c + (0, 2.52, 0) + arm * 0.6, 0.03, 0.03, TIMB_D, 4, 'timber')
            b.cylv(c + (0, 2.5, 0) + arm, c + (0, 2.32, 0) + arm, 0.012, 0.012, IRON, 3, 'iron', caps=False); lamp(b, c + (0, 1.82, 0) + arm, yw, hi, 1.0)
        # ---- [waterfall-aaa] AAA corridor extras ----
        elif k == 'belvedere_bollard':
            yw = p.get('yaw', 0); b.bx(0.7, 1.1, 0.7, mk(c + (0, 0.55, 0), yw), TIMB_D, 'timber')
            b.bx(0.85, 0.14, 0.85, mk(c + (0, 1.15, 0), yw), TIMB, 'timber')
            b.cylv(c + (0, 1.2, 0), c + (0, 1.55, 0), 0.12, 0.12, IRON, 8, 'iron')  # iron cap ring
            if hi: b.cylv(c + (0, 1.55, 0), c + (0, 1.7, 0), 0.05, 0.05, IRON, 6, 'iron')
        elif k == 'belvedere_winch':
            yw = p.get('yaw', 0)
            b.bx(1.4, 0.9, 0.9, mk(c + (0, 0.45, 0), yw), TIMB_D, 'timber')
            b.cylv(c + (-0.35, 1.1, 0), c + (0.35, 1.1, 0), 0.18, 0.18, TIMB, 8, 'timber')  # drum
            for s in (-1, 1): b.bx(0.12, 1.3, 0.12, mk(c + (s * 0.55, 0.9, 0), yw), TIMB_D, 'timber')
            if hi: b.rope([c + (-0.3, 1.1, 0), c + (0.3, 1.1, 0), c + (0.3, 0.4, 0.4)], 0.04, ROPE, 5)
        elif k == 'belvedere_sign' or k == 'sign':
            yw = p.get('yaw', 0)
            b.bx(0.18, 2.6, 0.18, mk(c + (0, 1.3, 0), yw), TIMB_D, 'timber')
            b.bx(1.8, 1.1, 0.1, mk(c + (0, 2.35, 0), yw), TIMB, 'timber')
            if hi:
                for i, yy in enumerate((2.55, 2.25, 1.95)):
                    b.bx(1.5, 0.18, 0.04, mk(c + (0, yy, 0.06), yw), tone(TRIM, -0.1 * i), 'stone_trim')
        elif k == 'pavilion':
            # open-front angler pavilion shell (lagoon kit also builds one; this is the Blender LOD twin)
            yw = p.get('yaw', 0)
            for dx, dz in ((-2.4, -1.8), (2.4, -1.8), (-2.4, 1.6), (2.4, 1.6)):
                b.bx(0.3, 3.2, 0.3, mk(c + (dx, 1.6, dz), yw), TIMB_D, 'timber')
            b.bx(5.5, 0.22, 4.3, mk(c + (0, 3.35, 0), yw), TIMB, 'timber')
            for i in range(-2, 3):
                b.bx(1.0, 0.14, 4.5, mk(c + (i * 0.95, 3.55 + abs(i) * 0.08, 0), yw, 0.12), tone(PLANK[i % 3], 0), 'planks_weathered')
            if hi:
                for i in range(4):
                    b.bx(1.4, 1.1, 0.06, mk(c + (-1.6 + i * 1.1, 2.2, -1.85), yw, 0.1), 0x6a8a6a)
                    b.rock(mk(c + (-1.6 + i * 1.1, 1.55, -1.9), s=(0.12, 0.12, 0.12)), sd + i, 0, ((0xff6b4a, 0xffd27a)[i % 2],), rough=0.05)
                b.bx(1.6, 0.12, 0.7, mk(c + (1.6, 0.85, 0.4), yw), TIMB, 'timber')
                for s in (-1, 1):
                    lamp(b, c + (s * 2.6, 2.35, -0.2), yw, hi, 1.0)
        elif k == 'abutment':
            yw = p.get('yaw', 0)
            for i in range(5):
                b.bx(4.8 - i * 0.15, 0.2, 0.9, mk(c + (0, -0.05 - i * 0.1, 0.4 + i * 0.7), yw), tone(ASH if i % 2 else TRIM, (hsh(i, sd) - 0.5) * 0.08), 'stone_ashlar' if i % 2 else 'stone_trim')
            for s in (-1, 1):
                b.bx(0.6, 0.6, 2.8, mk(c + (s * 2.7, -0.35, 1.2), yw), DARK, 'stone_ashlar')
        elif k == 'skiff':
            yw = p.get('yaw', 0.2)
            b.bx(1.5, 0.55, 3.8, mk(c + (0, 0.15, 0), yw), tone(PLANK[0], -0.05), 'planks_weathered')
            b.bx(1.2, 0.12, 3.4, mk(c + (0, 0.4, 0), yw), TIMB_D, 'timber')
            b.bx(1.5, 0.14, 0.35, mk(c + (0, 0.5, 0), yw), TIMB, 'timber')
            if hi: b.cylv(c + (0, 0.15, -2.0), c + (0.4, 0.35, -2.3), 0.05, 0.05, ROPE, 4, 'rope')
        elif k == 'overlook':
            yw = p.get('yaw', -0.55)
            # cantilevered timber/stone balcony
            b.bx(4.8, 0.22, 6.4, mk(c + (0, 0.05, 0), yw), TRIM, 'stone_trim')
            b.bx(4.6, 0.7, 6.2, mk(c + (0, -0.4, 0), yw), ASH, 'stone_ashlar')
            for s in (-1, 1):
                b.bx(0.18, 1.15, 6.0, mk(c + (s * 2.25, 0.7, 0), yw), TIMB_D, 'timber')
                for i in range(5):
                    b.bx(0.14, 1.0, 0.14, mk(c + (s * 2.25, 0.55, -2.4 + i * 1.2), yw), TIMB, 'timber')
            if hi:
                for s in (-1, 1):
                    b.cylv(c + (s * 1.5, -0.7, 2.8), c + (s * 1.5, 0.05, 1.5), 0.12, 0.12, TIMB_D, 6, 'timber')  # knee braces
        elif k == 'summit':
            yw = p.get('yaw', 0)
            b.bx(11.0, 0.2, 21.0, mk(c + (0, 0.02, 0), yw), TRIM, 'stone_trim')
            b.bx(10.6, 0.55, 20.6, mk(c + (0, -0.35, 0), yw), ASH, 'stone_ashlar')
            # cliff-edge railings with gaps toward both zipline launch vectors (N toward skull, S/W toward castle)
            for s in (-1, 1):
                # east/west long rails with gaps at z ends for zip cables
                for seg, z0, z1 in ((0, -9.5, -4.5), (1, -2.5, 2.5), (2, 4.5, 9.5)):
                    L = z1 - z0
                    b.bx(0.16, 1.05, L, mk(c + (s * 5.2, 0.6, (z0 + z1) / 2), yw), TIMB_D, 'timber')
                    for i in range(max(2, int(L / 1.4))):
                        b.bx(0.14, 1.0, 0.14, mk(c + (s * 5.2, 0.55, z0 + 0.5 + i * 1.4), yw), TIMB, 'timber')
        elif k == 'brazier':
            b.bx(0.9, 0.35, 0.9, mk(c + (0, 0.2, 0)), DARK, 'stone_ashlar')
            b.cylv(c + (0, 0.35, 0), c + (0, 1.1, 0), 0.35, 0.42, IRON, 8, 'iron')
            b.bx(0.7, 0.4, 0.7, mk(c + (0, 1.25, 0)), 0xff8a3a, mat=1)  # glow coals
            if hi: b.bx(0.5, 0.55, 0.5, mk(c + (0, 1.55, 0)), 0xffd27a, mat=1)
        elif k == 'stalactite':
            b.cylv(c + (0, 0.1, 0), c + (0, -1.4 * s, 0), 0.18 * s, 0.02, tone(ROCK[0], -0.15), 6)
        elif k == 'skull_relief':
            # carved pirate skull stone relief on the grotto back wall
            b.bx(2.6, 2.4, 0.45, mk(c + (0, 0, 0)), tone(DARK, -0.1), 'stone_ashlar')
            b.rock(mk(c + (0, 0.2, 0.15), s=(0.7, 0.75, 0.35)), sd + 50, 1 if hi else 0, (0xcfc8bb, 0xb9b2a6), rough=0.15)
            if hi:
                for sx in (-0.22, 0.22):
                    b.rock(mk(c + (sx, 0.35, 0.25), s=(0.14, 0.1, 0.08)), sd + int(sx * 10), 0, ((0x1a1a1a),), rough=0.05)  # eye sockets
    return O, {}

SECT = [('d3', build_d3), ('hb', build_hb), ('area', build_area)]
def mats():
    out = []
    for nm in ('falls_solid', 'falls_glow'):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        out.append(m)
    return out
MATS = mats(); coll = bpy.data.collections.new('falls'); bpy.context.scene.collection.children.link(coll)
root = bpy.data.objects.new('falls', None); coll.objects.link(root); REP = {}; EXTRA = {}
for name, fn in SECT:
    for lod in (0, 1):
        bd = FB(); O, ex = fn(bd, lod == 0); me = bd.bake(f'falls_{name}_LOD{lod}'); me.validate(clean_customdata=False)
        for m in MATS: me.materials.append(m)
        o = bpy.data.objects.new(f'falls_{name}_LOD{lod}', me); coll.objects.link(o); o.parent = root; o.location = (O[0], -O[2], O[1])
        REP[f'{name}_LOD{lod}'] = bd.tris()
        if lod == 0 and ex: EXTRA[name] = ex
root['falls'] = json.dumps(EXTRA)   # glTF extras: the D3 newel lantern glass centres (the runtime moves the old tower-top flames onto them)
json.dump({'tris': REP, 'extra': EXTRA}, open(os.path.join(OUT, 'falls_report.json'), 'w'), indent=1)
for ob in bpy.data.objects: ob.select_set(True)
f = os.path.join(OUT, 'falls_raw.glb')
kw = dict(filepath=f, export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', f, os.path.getsize(f), 'TRIS', json.dumps(REP))
if len(argv) > 1 and argv[1] == 'preview':   # quick workbench previews of LOD0 (vertex colours); world coords: Blender (x, -z, y)
    for ob in bpy.data.objects:
        if ob.name.endswith('_LOD1'): ob.hide_render = True
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.color_type = 'VERTEX'; sc.display.shading.light = 'STUDIO'
    sc.display.shading.show_shadows = True; sc.display.shading.show_cavity = True; sc.render.resolution_x, sc.render.resolution_y = 1400, 900
    sc.world = bpy.data.worlds.new('w'); cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); coll.objects.link(cam); sc.camera = cam; cam.data.lens = 30; cam.data.clip_end = 3000
    def look(pos, tgt, name):   # three-frame (x, y, z)
        P = Vector((pos[0], -pos[2], pos[1])); T = Vector((tgt[0], -tgt[2], tgt[1])); cam.location = P; cam.rotation_euler = (T - P).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(OUT, name); bpy.ops.render.render(write_still=True)
    D = LAY['d3']; y = D['deckY']
    look((16, y + 2.0, -110), (16, y, -84), 'pv_d3_onramp.png'); look((40, y + 4, -96), (16, y - 1, -84), 'pv_d3_side.png'); look((19, y + 3, -60), (16, y, -66), 'pv_d3_northend.png')
    H_ = LAY['hb']; look((H_['ax'] - 4, H_['ya'] + 2, H_['az']), (H_['ax'] + 30, H_['ya'] - 1, H_['az'] + 2.5), 'pv_hb_onramp.png')
    look(((H_['ax'] + H_['bx']) / 2, H_['ya'] - 6, -45), ((H_['ax'] + H_['bx']) / 2, H_['ya'] - 4, -80), 'pv_hb_side.png')
    look((H_['bx'] + 9, H_['yb'] + 3, H_['bz'] + 5), (H_['bx'], H_['yb'], H_['bz']), 'pv_hb_plateau.png')
    look((-205, 26, -92), (-206, 34, -190), 'pv_falls_overview.png'); look((-160, 24, -118), (-215, 24, -170), 'pv_basin_rim.png'); look((-250, 23, -150), (-206, 30, -190), 'pv_falls_shore.png')
