# [Raul] PUMPFUN PIRATES island: scripted Blender NATURE kit (inland hero assets).
#   blender -b --factory-startup -P nature_kit_blender.py -- BUILD_DIR
# Palms (curved ringed trunks + cut-out frond cards with a folded rachis), jungle trees (buttress roots, branching trunk, canopy
# masses fringed with cut-out leaf cards, hanging vines), ferns, rocks + cliff outcrops (noise-displaced, terraced strata,
# decimated, faceted), and Skull Peak (metaball skull: cranium, brow, cheekbones, jaw; eye sockets, nose and the treasure-cave
# mouth carved with negative elements; teeth). LOD0 + LOD1 for each. Contact AO is baked with Cycles into the vertex colours
# (x a per-part tint); vertex-colour ALPHA carries the look.js surface id (3 rock, 5 bark, 6 leaf, 14 cut-out card, x/16).
# Foliage gets canopy-sphere normals (soft stylised shading: leaves shade as one volume, not as cards).
# Game frame: metres, +y up, front +z  ->  Blender (x, -z, y); the glTF exporter (+Y up) maps it straight back.
import bpy, bmesh, json, math, sys, os, random
from mathutils import Matrix, Vector, noise
OUT = sys.argv[sys.argv.index('--') + 1]
R = json.load(open(os.path.join(OUT, 'nature_regions.json')))
ROCK, BARK, LEAF, CARD, BONE = 3, 5, 6, 14, 7

def ruv(reg, u, v):  # u, v in 0..1 inside a card region
    r = R[reg]; return (r['u0'] + u * (r['u1'] - r['u0']), r['v0'] + v * (r['v1'] - r['v0']))
SOLID_UV = ruv('solid', 0.5, 0.5)

class Mesh:
    def __init__(s): s.v = []; s.f = []; s.uv = []; s.col = []; s.mat = []; s.nrm = []
    def poly(s, pts, uvs=None, tint=(1, 1, 1), mat=ROCK, nrm=None):
        b = len(s.v); s.v += [tuple(p) for p in pts]; s.f.append(list(range(b, b + len(pts))))
        s.uv.append(uvs or [SOLID_UV] * len(pts)); s.col.append(tint); s.mat.append(mat); s.nrm.append(nrm)

def V(*a): return Vector(a)
def frame(d):  # orthonormal frame around direction d
    d = d.normalized(); a = V(0, 1, 0) if abs(d.y) < 0.9 else V(1, 0, 0); x = d.cross(a).normalized(); y = x.cross(d).normalized(); return x, y, d

def tube(m, path, radii, sides, tint, mat=BARK, cap=False, nfun=None):
    """generalised cylinder along a polyline (rings perpendicular to the path); smooth radial normals"""
    rings = []
    for i, p in enumerate(path):
        d = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized(); x, y, _ = frame(d)
        rings.append([(p + (x * math.cos(a) + y * math.sin(a)) * radii[i], (x * math.cos(a) + y * math.sin(a))) for a in [k / sides * 2 * math.pi for k in range(sides)]])
    for i in range(len(path) - 1):
        for k in range(sides):
            k2 = (k + 1) % sides; q = [rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]]
            m.poly([p for p, _ in q], tint=tint, mat=mat, nrm=[n for _, n in q] if not nfun else [nfun(p, n) for p, n in q])
    if cap:
        top = rings[-1]; m.poly([p for p, _ in top][::-1] if False else [p for p, _ in top], tint=tint, mat=mat, nrm=[(path[-1] - path[-2]).normalized()] * sides)

def ico(m, c, r, sub, tint, mat, scale=(1, 1, 1), jit=0.0, seed=0, nfun=None):
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=1.0)
    for v in bm.verts:
        n = noise.noise(v.co * 1.7 + V(seed, seed * 2, seed * 3)) if jit else 0
        p = v.co * (1 + jit * n); v.co = V(c[0] + p.x * r * scale[0], c[1] + p.y * r * scale[1], c[2] + p.z * r * scale[2])
    for f in bm.faces:
        pts = [V(*v.co) for v in f.verts]
        m.poly(pts, tint=tint, mat=mat, nrm=[nfun(p) for p in pts] if nfun else [(p - V(*c)).normalized() for p in pts])
    bm.free()

def card(m, c, nrm, up, w, h, reg, tint=(1, 1, 1), bend=0.0, nfun=None, segs=1):
    """a cut-out card centred at c facing nrm (u along `up` x nrm, v along up); bend curls the far edge back"""
    n = nrm.normalized(); x = up.cross(n).normalized(); y = n.cross(x).normalized()
    for s in range(segs):
        v0, v1 = s / segs, (s + 1) / segs
        def P(u, v): return c + x * (u - 0.5) * w + y * (v - 0.5) * h - n * bend * ((v - 0.5) ** 2 * 4)
        pts = [P(0, v0), P(1, v0), P(1, v1), P(0, v1)]; uvs = [ruv(reg, 0, v0), ruv(reg, 1, v0), ruv(reg, 1, v1), ruv(reg, 0, v1)]
        m.poly(pts, uvs, tint=tint, mat=CARD, nrm=[nfun(p) for p in pts] if nfun else [n] * 4)

# ---------------- palms ----------------
def palm(seed, lod):
    rnd = random.Random(seed); m = Mesh(); hi = lod == 0
    H = 9.0 + rnd.random() * 2.5; lean = 1.4 + rnd.random() * 1.4; yaw = rnd.random() * 6.28
    dirx, dirz = math.cos(yaw), math.sin(yaw)
    def cv(t): return V(dirx * lean * t * t * 1.8, t * H, dirz * lean * t * t * 1.8)
    nseg = 12 if hi else 4; sides = 8 if hi else 5
    # ringed trunk: each segment flares at its base (the ring), so the silhouette steps like a real palm
    for i in range(nseg):
        t0, t1 = i / nseg, (i + 1) / nseg; r0 = 0.42 - 0.17 * t0 + (0.12 if i == 0 else 0); r1 = 0.40 - 0.17 * t1
        p0, p1 = cv(t0), cv(t1); mid = p0.lerp(p1, 0.18)
        tv = 0.9 + 0.1 * (i % 2)
        if hi: tube(m, [p0, mid, p1], [r0 * 1.12, r0 * 0.98, r1 * 0.98], sides, (0.66 * tv, 0.5 * tv, 0.36 * tv))
        else: tube(m, [p0, p1], [r0, r1], sides, (0.64, 0.48, 0.34))
    top = cv(1.0); crown = top + V(0, 0.15, 0)
    canopy = crown + V(0, -0.8, 0)
    nf = lambda p, n=None: (p - canopy).normalized().lerp(V(0, 1, 0), 0.45).normalized()
    ico(m, crown, 0.55, 1 if hi else 0, (0.5, 0.42, 0.22), BARK, scale=(1, 0.8, 1))
    if hi:
        for k in range(4):
            a = k / 4 * 6.28 + 0.4; ico(m, crown + V(math.cos(a) * 0.42, -0.45, math.sin(a) * 0.42), 0.26, 1, (0.45, 0.3, 0.14), BARK)
    NF = 12 if hi else 7; L0 = 5.4 + rnd.random() * 0.8
    for k in range(NF):
        a = k / NF * 6.283 + rnd.random() * 0.3; old = (k % 3 == 2); L = L0 * (0.85 + 0.25 * rnd.random())
        lift = 0.55 - (0.5 if old else 0.0) + 0.25 * rnd.random(); droop = 1.0 + (0.6 if old else 0) + 0.3 * rnd.random()
        d = V(math.cos(a), 0, math.sin(a)); side = V(-d.z, 0, d.x); W = 1.15 * (0.9 + 0.2 * rnd.random()); fold = 0.32 if hi else 0.0
        S = 8 if hi else 3; reg = 'frond2' if old else 'frond1'; tint = (1.0, 1.0, 1.0) if not old else (1.05, 1.0, 0.9)
        def C(u):  # centre line: rises then arches down (parabola in the frond's vertical plane)
            return crown + d * (L * u) + V(0, L * (lift * u - droop * 0.55 * u * u), 0)
        for s in range(S):
            u0, u1 = s / S, (s + 1) / S
            for sd in ((-1, 0), (0, 1)):
                pts, uvs = [], []
                for (u, e) in [(u0, sd[0]), (u1, sd[0]), (u1, sd[1]), (u0, sd[1])]:
                    w = W * (0.25 + 0.75 * math.sin(math.pi * min(1, u * 1.05 + 0.08)) ** 0.6)
                    p = C(u) + side * (e * w) - V(0, abs(e) * w * fold, 0)
                    pts.append(p); uvs.append(ruv(reg, u, 0.5 + e * 0.5))
                if not hi and sd == (0, 1):
                    pass
                if hi or True:
                    m.poly(pts, uvs, tint=tint, mat=CARD, nrm=[nf(p) for p in pts])
                if not hi: break  # LOD1: one flat strip per segment (the -1..0 half re-used below)
            if not hi:  # replace the half strip by a full-width flat strip
                m.v = m.v[:-4]; m.f.pop(); m.uv.pop(); m.col.pop(); m.mat.pop(); m.nrm.pop()
                pts, uvs = [], []
                for (u, e) in [(u0, -1), (u1, -1), (u1, 1), (u0, 1)]:
                    w = W * (0.25 + 0.75 * math.sin(math.pi * min(1, u * 1.05 + 0.08)) ** 0.6); pts.append(C(u) + side * (e * w)); uvs.append(ruv(reg, u, 0.5 + e * 0.5))
                m.poly(pts, uvs, tint=tint, mat=CARD, nrm=[nf(p) for p in pts])
    return m

# ---------------- jungle trees ----------------
def jungle_tree(seed, lod):
    rnd = random.Random(seed * 7 + 1); m = Mesh(); hi = lod == 0
    Ht = 6.0 + rnd.random() * 2.0; bend = V(rnd.random() - 0.5, 0, rnd.random() - 0.5) * 1.2
    sides = 8 if hi else 5
    trunk = [V(0, 0, 0) + bend * (t * t) + V(0, Ht * t, 0) for t in [i / (6 if hi else 2) for i in range((6 if hi else 2) + 1)]]
    tube(m, trunk, [0.78 - 0.4 * (i / (len(trunk) - 1)) for i in range(len(trunk))], sides, (0.5, 0.38, 0.28))
    if hi:  # buttress roots: flattened wedge fins
        for r in range(5):
            a = r / 5 * 6.283 + rnd.random() * 0.4; d = V(math.cos(a), 0, math.sin(a)); s = V(-d.z, 0, d.x); L = 1.6 + rnd.random() * 0.8; hgt = 1.8 + rnd.random()
            base = d * 0.45; tip = d * (0.45 + L) + V(0, -0.15, 0); top = d * 0.4 + V(0, hgt, 0); t = 0.13
            for sg in (-1, 1):
                pts = [base + s * t * sg, tip, top + s * t * 0.5 * sg]
                if sg < 0: pts = pts[::-1]
                m.poly(pts, tint=(0.46, 0.35, 0.26), mat=BARK, nrm=[(s * sg + d * 0.5).normalized()] * 3)
    # branches to the canopy masses
    top = trunk[-1]; masses = []
    NB = (4 if rnd.random() > 0.4 else 3) if hi else 2
    for b in range(NB):
        a = b / NB * 6.283 + rnd.random() * 0.8; out = 2.4 + rnd.random() * 1.8; up = 2.2 + rnd.random() * 2.2
        tip = top + V(math.cos(a) * out, up, math.sin(a) * out); mid = top.lerp(tip, 0.5) + V(0, 0.6, 0)
        tube(m, [top - V(0, 0.8, 0), mid, tip] if hi else [top - V(0, 0.8, 0), tip], [0.36, 0.24, 0.14] if hi else [0.34, 0.16], 6 if hi else 3, (0.48, 0.37, 0.27))
        masses.append((tip + V(0, 0.9, 0), 2.6 + rnd.random() * 0.9))
    masses.append((top + V(0, 4.6 + rnd.random(), 0), 3.1 + rnd.random() * 0.6))
    cen = sum((c for c, _ in masses), V(0, 0, 0)) / len(masses) + V(0, -0.6, 0)
    nf = lambda p: (p - cen).normalized().lerp(V(0, 1, 0), 0.25).normalized()
    greens = [(0.24, 0.55, 0.26), (0.3, 0.62, 0.28), (0.2, 0.5, 0.25)]
    for i, (c, r) in enumerate(masses):  # canopy volume (soft-shaded) ...
        ico(m, c, r * (0.74 if hi else 0.92), 2 if hi else 1, greens[i % 3], LEAF, scale=(1.15, 0.8, 1.15), jit=0.22 if hi else 0.1, seed=seed + i, nfun=nf)
    # ... fringed with cut-out leaf cards poking out of it (silhouette breakup)
    regs = ['leaf3', 'leaf4', 'leaf5']; nc = 20 if hi else 2
    for i, (c, r) in enumerate(masses):
        for j in range(nc):
            th = rnd.random() * 6.283; ph = math.acos(1 - 1.25 * rnd.random())   # mostly upper / side hemisphere
            dirn = V(math.sin(ph) * math.cos(th), math.cos(ph) * 0.8, math.sin(ph) * math.sin(th)).normalized()
            p = c + V(dirn.x * r * 1.15, dirn.y * r * 0.78, dirn.z * r * 1.15) * (0.86 if hi else 0.8)
            sz = (3.0 if hi else 3.8) * (0.8 + 0.4 * rnd.random())
            nrm = (dirn + V(rnd.random() - 0.5, rnd.random() - 0.5, rnd.random() - 0.5) * 0.6).normalized()
            card(m, p, nrm, V(0, 1, 0) if abs(nrm.y) < 0.9 else V(1, 0, 0), sz, sz, regs[(i + j) % 3], bend=0.25 if hi else 0.0, nfun=nf, segs=2 if hi else 1)
    if hi:  # hanging vines from the branch tips
        for (c, r) in masses[:3]:
            if rnd.random() < 0.35: continue
            p = c + V(r * 0.5, -r * 0.55, 0) ; L = 3.0 + rnd.random() * 2
            card(m, p - V(0, L / 2, 0), V(1, 0, 0.3), V(0, 1, 0), 0.7, L, 'vine', nfun=nf)  # (vine strip runs along u; card v-up so it hangs)
    return m

def fern(seed, lod):
    rnd = random.Random(seed + 50); m = Mesh(); hi = lod == 0; N = 8 if hi else 5
    nf = lambda p: (p - V(0, -0.6, 0)).normalized().lerp(V(0, 1, 0), 0.5).normalized()
    for k in range(N):
        a = k / N * 6.283 + rnd.random() * 0.4; d = V(math.cos(a), 0, math.sin(a)); s = V(-d.z, 0, d.x); L = 1.7 + rnd.random() * 0.6; W = 0.32
        S = 3 if hi else 1
        C = lambda u: d * (L * u) + V(0, L * (0.9 * u - 0.75 * u * u) + 0.1, 0)
        for i in range(S):
            u0, u1 = i / S, (i + 1) / S
            pts = [C(u0) - s * W, C(u1) - s * W, C(u1) + s * W, C(u0) + s * W]; uvs = [ruv('fern', u0, 0), ruv('fern', u1, 0), ruv('fern', u1, 1), ruv('fern', u0, 1)]
            m.poly(pts, uvs, tint=(1, 1, 1), mat=CARD, nrm=[nf(p) for p in pts])
    return m

# ---------------- rocks / cliffs / skull: built as Blender objects (bmesh + modifiers), see below ----------------
ASSETS = {}
for i in range(3):
    for lod in (0, 1): ASSETS[f'palm{i}_LOD{lod}'] = ('mesh', palm(11 + i * 5, lod))
for i in range(3):
    for lod in (0, 1): ASSETS[f'tree{i}_LOD{lod}'] = ('mesh', jungle_tree(3 + i * 4, lod))
for lod in (0, 1): ASSETS[f'fern_LOD{lod}'] = ('mesh', fern(1, lod))

def to_object(name, m):
    me = bpy.data.meshes.new(name)
    me.from_pydata([(p[0], -p[2], p[1]) for p in m.v], [], m.f); me.update()
    me.uv_layers.new(name='UVMap'); me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    uvl = me.uv_layers['UVMap']; ca = me.color_attributes['Col']
    lnr = [None] * len(me.loops)
    for pi, poly in enumerate(me.polygons):
        c = m.col[pi]; a = m.mat[pi] / 16.0; nr = m.nrm[pi]
        for kk, l in enumerate(poly.loop_indices):
            uvl.data[l].uv = m.uv[pi][kk]; ca.data[l].color = (c[0], c[1], c[2], a)
            n = nr[kk] if nr else None
            lnr[l] = (n[0], -n[2], n[1]) if n is not None else None
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    for p in me.polygons: p.use_smooth = True
    fn = [tuple(me.polygons[i].normal) for i in range(len(me.polygons))]
    for poly in me.polygons:
        for l in poly.loop_indices:
            if lnr[l] is None: lnr[l] = fn[poly.index]
    me.normals_split_custom_set(lnr)
    return ob

def rock_obj(name, seed, lod, kind):
    """noise-displaced, terraced (strata) and decimated; faceted. kind: 'rock' boulder, 'cliff' tall outcrop slab, 'spire'"""
    bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=4 if lod == 0 else 3, radius=1.0)
    off = V(seed * 3.1, seed * 1.7, seed * 5.3)
    sc = {'rock': V(1.25, 0.8, 1.0), 'cliff': V(1.6, 2.2, 1.1), 'spire': V(0.8, 3.2, 0.8)}[kind]  # game axes: width, height, depth
    for v in bm.verts:
        p = v.co.copy(); n1 = noise.noise(p * 1.3 + off); n2 = noise.noise(p * 3.1 + off * 2); n3 = noise.noise(p * 7.0 + off)
        r = 1 + 0.28 * n1 + 0.12 * n2 + 0.04 * n3
        q = V(p.x * sc.x * r, p.y * sc.z * r, p.z * sc.y * r)
        if kind != 'rock':  # terraces: pull heights towards strata steps -> ledges
            st = 0.55 if kind == 'cliff' else 0.7; y = q.z  # (bmesh z = game y)
            q.z = y * 0.45 + (round(y / st) * st + (y - round(y / st) * st) * 0.3) * 0.55
            if kind == 'spire': q.x *= 1 - 0.55 * max(0, p.z); q.y *= 1 - 0.55 * max(0, p.z)
            if kind == 'cliff': q.y *= 1 - 0.25 * max(0, p.z)  # leans back a little towards the top
        if q.z < -0.35 * sc.y: q.z = -0.35 * sc.y + (q.z + 0.35 * sc.y) * 0.15  # flattish buried base
        v.co = q
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    dm = ob.modifiers.new('dec', 'DECIMATE'); dm.ratio = {'rock': 0.2, 'cliff': 0.26, 'spire': 0.22}[kind]
    bpy.ops.object.modifier_apply(modifier='dec'); ob.select_set(False)
    me = ob.data
    for p in me.polygons: p.use_smooth = False
    me.uv_layers.new(name='UVMap'); me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); uvl = me.uv_layers['UVMap']; ca = me.color_attributes['Col']
    for poly in me.polygons:
        nz = poly.normal.z; moss = max(0.0, min(1.0, (nz - 0.55) * 3)) if kind != 'spire' else 0
        hgt = sum((me.vertices[i].co.z for i in poly.vertices)) / len(poly.vertices)
        base = (0.62, 0.6, 0.56) if kind == 'rock' else (0.58, 0.54, 0.5)
        band = 0.92 + 0.08 * math.sin(hgt * 5.0 + seed)
        c = [base[k] * band for k in range(3)]; c = [c[0] * (1 - moss) + 0.36 * moss, c[1] * (1 - moss) + 0.52 * moss, c[2] * (1 - moss) + 0.26 * moss]
        for l in poly.loop_indices: uvl.data[l].uv = SOLID_UV; ca.data[l].color = (c[0], c[1], c[2], (ROCK if kind == 'rock' else 9) / 16)
    return ob

def skull_obj(name, lod):
    """metaball skull in the Skull Peak frame (front +z, ground y = 0): the cave room (x +-6.5, y 0..7, z -12.5..5.4) is carved out"""
    mb = bpy.data.metaballs.new(name + '_mb'); mb.resolution = 0.55 if lod == 0 else 1.1; mb.render_resolution = mb.resolution; mb.threshold = 0.6
    K = 1 / 0.575  # surface radius of a lone element ~ 0.575 R (stiffness 2, threshold 0.6)
    def el(c, r, neg=False, stiff=2.0, typ='ELLIPSOID'):
        e = mb.elements.new(); e.type = typ; e.co = (c[0], -c[2], c[1]); e.radius = max(r) * K; e.stiffness = stiff
        e.size_x, e.size_y, e.size_z = r[0] / max(r) * K * max(r) * 0.0 + r[0] / max(r), r[2] / max(r), r[1] / max(r)
        e.use_negative = neg
    el((0, 18, -4), (15, 13.5, 14))                 # cranium
    el((0, 21, 2), (12.5, 9.5, 10))                 # forehead
    el((0, 9.5, 4), (10.5, 6.5, 7.5))               # maxilla / upper face
    for s in (-1, 1):
        el((s * 9.0, 12.0, 4.0), (4.8, 4.2, 4.6))      # cheekbones
        el((s * 9.5, 5.0, -1.0), (3.8, 5.5, 5.0))      # jaw hinge
    el((0, 3.0, 3.0), (10.5, 4.2, 7.5))             # mandible
    el((0, 19.6, 7.8), (12.0, 2.6, 3.0))            # brow ridge
    for s in (-1, 1): el((s * 5.4, 15.2, 10.5), (3.4, 3.9, 5.5), neg=True, stiff=4)   # eye sockets
    el((0, 10.8, 11.2), (1.7, 2.6, 4.0), neg=True, stiff=4)                           # nose
    el((0, 2.6, -2.0), (7.4, 7.6, 16.0), neg=True, stiff=6)                           # the cave (mouth -> room)
    ob = bpy.data.objects.new(name + '_tmp', mb); bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg)); bpy.data.objects.remove(ob)
    # cut everything below the ground (y < -0.5) and keep it closed enough for the AO bake
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1.0], context='VERTS')
    # teeth (upper row over the cave mouth, lower row along the jaw)
    def tooth(cx, cy, cz, w, h, d):
        r = bmesh.ops.create_cube(bm, size=1.0); vs = r['verts']
        for v in vs: v.co = V(cx + v.co.x * w, -(cz + v.co.y * d), cy + v.co.z * h)
    for i in range(-3, 4):
        tooth(i * 1.55, 6.9 - abs(i) * 0.12, 7.6 - abs(i) * 0.35, 1.3, 2.2, 1.3)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    dm = ob.modifiers.new('dec', 'DECIMATE'); dm.ratio = 0.22 if lod == 0 else 0.3; bpy.ops.object.modifier_apply(modifier='dec'); ob.select_set(False)
    me = ob.data
    for p in me.polygons: p.use_smooth = True
    me.uv_layers.new(name='UVMap'); me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); uvl = me.uv_layers['UVMap']; ca = me.color_attributes['Col']
    for poly in me.polygons:
        c = poly.center; nz = poly.normal.z; up = max(0, nz)
        tone = 0.86 + 0.08 * noise.noise(V(c.x, c.y, c.z) * 0.15) + 0.06 * up
        col = (0.93 * tone, 0.88 * tone, 0.76 * tone)
        if c.z < 4.0: col = (col[0] * 0.92, col[1] * 0.9, col[2] * 0.85)
        for l in poly.loop_indices: uvl.data[l].uv = SOLID_UV; ca.data[l].color = (col[0], col[1], col[2], BONE / 16)
    return ob

# ---------------- build, AO bake into vertex colours, export ----------------
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene; sc.world = sc.world or bpy.data.worlds.new('w'); sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 32
sc.world.light_settings.distance = 4.0
ground = bpy.data.meshes.new('ground'); ground.from_pydata([(-80, -80, 0), (80, -80, 0), (80, 80, 0), (-80, 80, 0)], [], [[0, 1, 2, 3]]); gob = bpy.data.objects.new('ground', ground); sc.collection.objects.link(gob)
objs = []
for name, (_, m) in ASSETS.items(): objs.append(to_object(name, m))
for i, kind in enumerate(['rock', 'rock', 'rock', 'cliff', 'cliff', 'spire']):
    nm = {'rock': 'rock', 'cliff': 'cliff', 'spire': 'spire'}[kind] + str(i if kind == 'rock' else i - 3 if kind == 'cliff' else 0)
    for lod in (0, 1): objs.append(rock_obj(f'{nm}_LOD{lod}', 7 + i * 13, lod, kind))
for lod in (0, 1): objs.append(skull_obj(f'skull_LOD{lod}', lod))
mat = bpy.data.materials.new('nature'); mat.use_nodes = True
img = bpy.data.images.load(os.path.join(OUT, 'nature_cards.png')); nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = img; nt.links.new(ti.outputs['Color'], bsdf.inputs['Base Color'])
stats = {}
for ob in objs:
    me = ob.data; me.materials.append(mat)
    lift = 0.0 if not ob.name.startswith(('rock', 'cliff', 'spire')) else 0.25
    gob.location = (0, 0, -lift * 3)
    tint = [tuple(me.color_attributes['Col'].data[i].color) for i in range(len(me.loops))]
    ao = me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER'); me.color_attributes.active_color = ao
    for o in sc.objects: o.select_set(False); o.hide_render = o not in (ob, gob)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)
    col = me.color_attributes['Col']; card_floor = 0.55
    for i in range(len(me.loops)):
        a = ao.data[i].color[0]; t = tint[i]; isCard = abs(t[3] * 16 - CARD) < 0.5
        a = (card_floor + (1 - card_floor) * a) if isCard else (0.32 + 0.68 * a)
        col.data[i].color = (t[0] * a, t[1] * a, t[2] * a, t[3])
    me.color_attributes.remove(me.color_attributes['AO']); me.color_attributes.active_color = me.color_attributes['Col']
    stats[ob.name] = len(me.polygons)
bpy.data.objects.remove(gob)
for o in sc.objects: o.hide_render = False; o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'nature_kit_raw.glb'), export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
    export_texcoords=True, export_normals=True, export_tangents=False, export_attributes=True, export_vertex_color='ACTIVE', export_materials='EXPORT', export_image_format='AUTO')
json.dump(stats, open(os.path.join(OUT, 'nature_kit_stats.json'), 'w'), indent=1)
print('NATURE OK', len(stats), sum(stats.values()))
