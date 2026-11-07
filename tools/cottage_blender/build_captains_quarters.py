#!/usr/bin/env python3
# AAA Captain's Quarters (walk-in ship hull room, cottage_id = 'ship_quarters') hero kits
#   -> assets/island/captains_quarters.glb
# Blender 4.2.3 LTS:
#   /opt/blender/blender -b --factory-startup -P tools/cottage_blender/build_captains_quarters.py
#
# Conventions (Blender Z-up, exported glTF +Y up):
#   * Every kit faces Blender -Y ("into the room")  ->  three.js +Z.  houses.js yaws each kit onto its wall.
#   * Wall kits have their back on the wall plane (Blender y = 0); floor is z = 0.
#   * Every primitive is accumulated into ONE merged mesh per (kit_root | pivot, material) so each kit is
#     only a handful of draw calls. Swaying parts (chandelier / gimbaled lantern) are merged under their
#     own pivot empty so houses.js can rock them around the real suspension point.
#   * No naked glow spheres anywhere: every light source is a wax candle / lantern with a small pointed
#     teardrop `mat_flame` ON TOP of the wick or INSIDE lantern glass.
#   * Scratch .blend goes to /tmp/captains_quarters.blend (never inside the repo).
import bpy, bmesh, math, os, random
from mathutils import Vector, Matrix, Euler

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'island', 'captains_quarters.glb')
BLEND = '/tmp/captains_quarters.blend'
RNG = random.Random(1337)

bpy.ops.wm.read_factory_settings(use_empty=True)
SCENE = bpy.context.scene
COLL = bpy.data.collections.new('quarters_kits')
SCENE.collection.children.link(COLL)

# Room contract (must match buildCaptainsQuartersRoom in js/dock/houses.js)
RW, RD, RH, PEAK = 11.6, 11.0, 3.95, 4.35
TH = 0.55                     # tumblehome inset of the hull wall at deck-head height
HALF_TOP = RW / 2 - TH
CAMBER = PEAK - RH
def f_in(z):                  # inward hull offset at height z (curved tumblehome)
    z = max(0.0, min(RH, z)); return TH * (z / RH) ** 2
def ceil_h(xroom):            # cambered deck-head height at room x
    return RH + CAMBER * (1 - (xroom / HALF_TOP) ** 2)

# ---------------------------------------------------------------- materials
MAT_DEFS = {
    'mat_mahogany':   ((0.32, 0.10, 0.05, 1), 0.48, 0.03),
    'mat_oak_dark':   ((0.20, 0.12, 0.06, 1), 0.70, 0.02),
    'mat_brass':      ((0.80, 0.58, 0.20, 1), 0.22, 0.88),
    'mat_gold':       ((0.90, 0.68, 0.22, 1), 0.20, 0.92),
    'mat_iron':       ((0.10, 0.10, 0.11, 1), 0.45, 0.85),
    'mat_velvet':     ((0.42, 0.03, 0.05, 1), 0.85, 0.00),
    'mat_leather':    ((0.36, 0.06, 0.05, 1), 0.55, 0.02),
    'mat_leather_brown': ((0.26, 0.13, 0.06, 1), 0.62, 0.02),
    'mat_linen':      ((0.86, 0.80, 0.68, 1), 0.88, 0.00),
    'mat_parchment':  ((0.80, 0.66, 0.44, 1), 0.80, 0.00),
    'mat_glass':      ((0.70, 0.85, 0.88, 1), 0.06, 0.10),
    'mat_glass_green':((0.06, 0.36, 0.16, 1), 0.08, 0.10),
    'mat_ruby':       ((0.70, 0.03, 0.10, 1), 0.10, 0.10),
    'mat_emerald':    ((0.03, 0.55, 0.25, 1), 0.10, 0.10),
    'mat_wax':        ((0.95, 0.90, 0.78, 1), 0.55, 0.00),
    'mat_flame':      ((1.00, 0.62, 0.18, 1), 0.50, 0.00),
    'mat_rope':       ((0.62, 0.48, 0.28, 1), 0.92, 0.00),
    'mat_fruit':      ((0.95, 0.45, 0.05, 1), 0.45, 0.00),
    'mat_felt':       ((0.04, 0.04, 0.05, 1), 0.90, 0.00),
    'mat_ocean_view': ((0.20, 0.60, 0.70, 1), 0.30, 0.00),
    # vertex-tinted families (COLOR_0 carries the hue) so each kit stays at 3-7 merged meshes / draws
    'mat_metal':      ((1.00, 1.00, 1.00, 1), 0.22, 0.88),   # brass / gold / iron
    'mat_hide':       ((1.00, 1.00, 1.00, 1), 0.55, 0.02),   # leathers, felt, fruit, book bindings
    'mat_gem':        ((1.00, 1.00, 1.00, 1), 0.10, 0.10),   # rubies / emeralds
}
ALIAS = {'mat_leather': 'mat_hide', 'mat_leather_brown': 'mat_hide', 'mat_felt': 'mat_hide', 'mat_fruit': 'mat_hide'}
TINTED = {'mat_hide'}
BOOK_TINTS = [(0.36, 0.06, 0.05, 1), (0.26, 0.13, 0.06, 1), (0.05, 0.16, 0.07, 1), (0.04, 0.06, 0.18, 1), (0.03, 0.03, 0.03, 1), (0.45, 0.27, 0.11, 1), (0.22, 0.03, 0.06, 1)]
MATS = {}
for nm, (base, rough, metal) in MAT_DEFS.items():
    m = bpy.data.materials.new(nm); m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = base
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    if nm == 'mat_flame':
        bs.inputs['Emission Color'].default_value = (1.0, 0.55, 0.15, 1); bs.inputs['Emission Strength'].default_value = 2.0
    if nm == 'mat_glass':
        bs.inputs['Alpha'].default_value = 0.25; m.blend_method = 'BLEND'
    MATS[nm] = m

# ---------------------------------------------------------------- math helpers
def T(x=0, y=0, z=0): return Matrix.Translation((x, y, z))
def R(rx=0, ry=0, rz=0): return Euler((rx, ry, rz), 'XYZ').to_matrix().to_4x4()
def S(sx=1, sy=None, sz=None):
    sy = sx if sy is None else sy; sz = sx if sz is None else sz
    m = Matrix.Identity(4); m[0][0], m[1][1], m[2][2] = sx, sy, sz; return m
def align_z(direction):
    """Rotation taking +Z onto direction."""
    d = Vector(direction).normalized()
    return d.to_track_quat('Z', 'Y').to_matrix().to_4x4()

# ---------------------------------------------------------------- primitive bmesh builders (local space)
def bm_box(sx, sy, sz, bevel=0.0, segs=1):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co.x *= sx; v.co.y *= sy; v.co.z *= sz
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(sx, sy, sz) * 0.45), segments=segs, affect='EDGES', profile=0.5)
    return bm

def bm_taper_box(sx, sy, sz, top=0.8, bevel=0.0):
    bm = bm_box(sx, sy, sz, bevel)
    for v in bm.verts:
        if v.co.z > 0: v.co.x *= top; v.co.y *= top
    return bm

def bm_lathe(profile, segs=16, closed=False, axis_caps=True):
    """profile: [(r, z)] around +Z. r == 0 -> single pole vertex."""
    bm = bmesh.new(); rings = []
    for r, z in profile:
        if r <= 1e-6: rings.append([bm.verts.new((0, 0, z))])
        else: rings.append([bm.verts.new((math.cos(2 * math.pi * i / segs) * r, math.sin(2 * math.pi * i / segs) * r, z)) for i in range(segs)])
    n = len(rings)
    pairs = [(i, i + 1) for i in range(n - 1)] + ([(n - 1, 0)] if closed else [])
    for a, b in pairs:
        A, B = rings[a], rings[b]
        if len(A) == 1 and len(B) == 1: continue
        if len(A) == 1:
            for i in range(segs): bm.faces.new((A[0], B[i], B[(i + 1) % segs]))
        elif len(B) == 1:
            for i in range(segs): bm.faces.new((A[i], A[(i + 1) % segs], B[0]))
        else:
            for i in range(segs): bm.faces.new((A[i], A[(i + 1) % segs], B[(i + 1) % segs], B[i]))
    if axis_caps and not closed:
        if len(rings[0]) > 1: bm.faces.new(list(reversed(rings[0])))
        if len(rings[-1]) > 1: bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def bm_cyl(r0, r1, h, segs=16, caps=True):
    return bm_lathe([(r0, 0.0), (r1, h)], segs, axis_caps=caps)

def bm_torus(R0, r, nu=16, nv=8, arc=2 * math.pi, zscale=1.0):
    bm = bmesh.new(); full = abs(arc - 2 * math.pi) < 1e-6
    nU = nu if full else nu + 1; rings = []
    for i in range(nU):
        a = arc * i / nu
        ring = []
        for j in range(nv):
            b = 2 * math.pi * j / nv
            rr = R0 + math.cos(b) * r
            ring.append(bm.verts.new((math.cos(a) * rr, math.sin(a) * rr * zscale, math.sin(b) * r)))
        rings.append(ring)
    for i in range(nu):
        A, B = rings[i], rings[(i + 1) % nU]
        for j in range(nv): bm.faces.new((A[j], A[(j + 1) % nv], B[(j + 1) % nv], B[j]))
    if not full:
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def bm_sphere(r, u=12, v=8, sx=1, sy=1, sz=1):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=r)
    for vv in bm.verts: vv.co.x *= sx; vv.co.y *= sy; vv.co.z *= sz
    return bm

def circle(r, n=10, sx=1, sy=1): return [(math.cos(2 * math.pi * i / n) * r * sx, math.sin(2 * math.pi * i / n) * r * sy) for i in range(n)]
def rect(w, h, ch=0.0):
    if ch <= 0: return [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    a, b = w / 2, h / 2
    return [(-a + ch, -b), (a - ch, -b), (a, -b + ch), (a, b - ch), (a - ch, b), (-a + ch, b), (-a, b - ch), (-a, -b + ch)]

def bm_sweep(path, prof, up=(0, 0, 1), scale=None, caps=True, closed_path=False):
    path = [Vector(p) for p in path]; n = len(path); up = Vector(up)
    tang = []
    for i in range(n):
        if closed_path: t = path[(i + 1) % n] - path[(i - 1) % n]
        elif i == 0: t = path[1] - path[0]
        elif i == n - 1: t = path[-1] - path[-2]
        else: t = path[i + 1] - path[i - 1]
        tang.append(t.normalized())
    nrm = up - tang[0] * up.dot(tang[0])
    if nrm.length < 1e-5:
        alt = Vector((1, 0, 0)) if abs(tang[0].x) < 0.9 else Vector((0, 1, 0))
        nrm = alt - tang[0] * alt.dot(tang[0])
    nrm.normalize()
    bm = bmesh.new(); rings = []
    for i in range(n):
        t = tang[i]
        nrm = (nrm - t * nrm.dot(t)).normalized()
        b = t.cross(nrm)
        s = scale(i / max(1, n - 1)) if scale else 1.0
        sx, sy = (s, s) if not isinstance(s, tuple) else s
        rings.append([bm.verts.new(path[i] + nrm * (px * sx) + b * (py * sy)) for px, py in prof])
    m = len(prof)
    for i in range(n if closed_path else n - 1):
        A, B = rings[i], rings[(i + 1) % n]
        for j in range(m): bm.faces.new((A[j], A[(j + 1) % m], B[(j + 1) % m], B[j]))
    if caps and not closed_path:
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def bm_extrude(poly, thick, plane='YZ'):
    """poly: 2D points in plane; extruded symmetric along the third axis."""
    bm = bmesh.new()
    def P(a, b, c):
        if plane == 'YZ': return (c, a, b)
        if plane == 'XZ': return (a, c, b)
        return (a, b, c)
    F = [bm.verts.new(P(a, b, -thick / 2)) for a, b in poly]
    B = [bm.verts.new(P(a, b, thick / 2)) for a, b in poly]
    n = len(poly)
    bm.faces.new(F); bm.faces.new(list(reversed(B)))
    for i in range(n): bm.faces.new((F[i], F[(i + 1) % n], B[(i + 1) % n], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm

def bm_grid(fn, nu, nv):
    """fn(u, v) -> (x, y, z) with u, v in [0, 1]. Planar UVs (u, v) kept."""
    bm = bmesh.new()
    V = [[bm.verts.new(fn(i / nu, j / nv)) for j in range(nv + 1)] for i in range(nu + 1)]
    lay = bm.loops.layers.uv.new('UVMap')
    for i in range(nu):
        for j in range(nv):
            f = bm.faces.new((V[i][j], V[i + 1][j], V[i + 1][j + 1], V[i][j + 1]))
            for l, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                l[lay].uv = (a / nu, b / nv)
    bm.normal_update()
    return bm

# ---------------------------------------------------------------- kit accumulator (merge per kit/pivot + material)
def link_empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None); o.empty_display_size = 0.2
    COLL.objects.link(o); o.parent = parent; o.location = loc
    return o

STATS = {}
class Kit:
    def __init__(self, name):
        self.name = name
        self.root = link_empty(name)
        self.groups = {None: (self.root, Vector((0, 0, 0)))}
        self.acc = {}
    def pivot(self, name, loc):
        e = link_empty(name, self.root, loc); self.groups[name] = (e, Vector(loc)); return name
    def add(self, bm, mat, M=None, group=None, smooth=42, uv='box', uvs=1.0, tint=None):
        bm.normal_update()
        if mat in ALIAS:
            tint = tint or MAT_DEFS[mat][0]; mat = ALIAS[mat]
        if mat in TINTED:
            cl = bm.loops.layers.float_color.get('Col') or bm.loops.layers.float_color.new('Col')
            c = tint or (1, 1, 1, 1)
            for f in bm.faces:
                for l in f.loops: l[cl] = c
        if uv == 'box':
            lay = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
            xs = [v.co for v in bm.verts]
            ext = [max(c[i] for c in xs) - min(c[i] for c in xs) for i in range(3)]
            for f in bm.faces:
                n = f.normal; ax = max(range(3), key=lambda i: abs(n[i]))
                o = [i for i in range(3) if i != ax]
                ua, va = (o[0], o[1]) if ext[o[0]] >= ext[o[1]] else (o[1], o[0])
                for l in f.loops: l[lay].uv = (l.vert.co[ua] * uvs, l.vert.co[va] * uvs)
        elif uv == 'planar_xz':
            lay = bm.loops.layers.uv.get('UVMap') or bm.loops.layers.uv.new('UVMap')
            xs = [v.co for v in bm.verts]
            x0, x1 = min(c.x for c in xs), max(c.x for c in xs); z0, z1 = min(c.z for c in xs), max(c.z for c in xs)
            for f in bm.faces:
                for l in f.loops: l[lay].uv = ((l.vert.co.x - x0) / max(1e-6, x1 - x0), (l.vert.co.z - z0) / max(1e-6, z1 - z0))
        if bm.loops.layers.uv.get('UVMap') is None: bm.loops.layers.uv.new('UVMap')
        if M is not None: bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
        _, off = self.groups[group]
        if off.length: bmesh.ops.translate(bm, vec=-off, verts=bm.verts)
        bm.normal_update()
        if smooth is not None:
            sharp = [e for e in bm.edges if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > math.radians(smooth)]
            if sharp: bmesh.ops.split_edges(bm, edges=sharp)
        me = bpy.data.meshes.new('tmp'); bm.to_mesh(me); bm.free()
        for p in me.polygons: p.use_smooth = smooth is not None
        self.acc.setdefault((group, mat), []).append(me)
    def finalize(self):
        made = []
        for (group, mat), meshes in self.acc.items():
            bm = bmesh.new()
            for me in meshes:
                bm.from_mesh(me); bpy.data.meshes.remove(me)
            nm = f'{self.name}__{group}__{mat}' if group else f'{self.name}__{mat}'
            me = bpy.data.meshes.new(nm); bm.to_mesh(me); bm.free()
            if mat in TINTED and me.color_attributes.get('Col'):
                me.color_attributes.active_color = me.color_attributes['Col']; me.color_attributes.render_color_index = me.color_attributes.active_color_index
            me.materials.append(MATS[mat])
            o = bpy.data.objects.new(nm, me); COLL.objects.link(o)
            o.parent = self.groups[group][0]
            made.append(o)
        STATS[self.name] = {'meshes': len(made), 'verts': sum(len(o.data.vertices) for o in made), 'tris': sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in made)}
        return made

# ---------------------------------------------------------------- shared prop helpers
FLAME_PROF = [(0.0, 0.0), (0.55, 0.06), (0.95, 0.2), (0.92, 0.36), (0.66, 0.56), (0.32, 0.8), (0.0, 1.0)]
def flame(k, loc, s=1.0, group=None):
    """Pointed teardrop flame (bulb low, tip up) sitting ON the wick."""
    bm = bm_lathe([(r * 0.026 * s, z * 0.085 * s) for r, z in FLAME_PROF], segs=8)
    k.add(bm, 'mat_flame', T(*loc), group)

def candle(k, loc, h=0.16, r=0.03, group=None, drips=3, mat='mat_wax', fs=1.0):
    x, y, z = loc
    k.add(bm_lathe([(r * 1.04, 0), (r, 0.02), (r, h - 0.012), (r * 0.82, h), (0, h - 0.004)], 10), mat, T(x, y, z), group)
    k.add(bm_torus(r * 0.86, r * 0.22, 10, 5), mat, T(x, y, z + h - 0.006), group)  # melted lip
    for i in range(drips):
        a = RNG.uniform(0, 2 * math.pi); dl = RNG.uniform(0.03, 0.07)
        k.add(bm_sphere(r * 0.28, 6, 4, 1, 1, dl / (r * 0.56)), mat, T(x + math.cos(a) * r * 0.95, y + math.sin(a) * r * 0.95, z + h - dl * 0.5 - 0.006), group)
    k.add(bm_cyl(0.003, 0.003, 0.018, 4), 'mat_iron', T(x, y, z + h - 0.004), group, smooth=None)
    flame(k, (x, y, z + h + 0.008), fs, group)

def chain(k, a, b, link=0.11, wire=0.009, group=None):
    """Real interlocking oval links, alternating 90 deg."""
    a, b = Vector(a), Vector(b); d = b - a; L = d.length
    n = max(2, int(L / (link * 0.68)))
    rot = align_z(d)
    for i in range(n):
        c = a + d * ((i + 0.5) / n)
        bm = bm_torus(link * 0.24, wire, 10, 5)
        k.add(bm, 'mat_iron', T(*c) @ rot @ R(0, 0, (math.pi / 2) * (i % 2)) @ R(math.pi / 2, 0, 0) @ S(1, 1.55, 1), group)

def rivet(k, loc, normal, r=0.018, mat='mat_iron', group=None):
    k.add(bm_sphere(r, 8, 4, 1, 1, 0.55), mat, T(*loc) @ align_z(normal), group)

def hex_bolt(k, loc, normal, r=0.02, mat='mat_iron', group=None):
    k.add(bm_cyl(r, r, r * 0.8, 6), mat, T(*loc) @ align_z(normal), group, smooth=20)

def drape(k, x0, x1, ztop, zbot, y0, pleats=6, depth=0.07, pinch_z=None, pinch=0.35, flare=0.8, mat='mat_velvet', group=None, side=1, nu=28, nv=26):
    """Pleated hanging curtain panel gathered toward `side` edge (+1: anchored at x0, -1: anchored at x1)."""
    W0 = x1 - x0
    def fn(u, v):
        z = zbot + (ztop - zbot) * v
        w = W0
        if pinch_z is not None:
            if z >= pinch_z:
                t = (z - pinch_z) / (ztop - pinch_z); w = W0 * (pinch + (1 - pinch) * (t ** 0.8))
            else:
                t = (pinch_z - z) / (pinch_z - zbot); w = W0 * (pinch + (flare - pinch) * (t ** 0.7))
        x = x0 + w * u if side > 0 else x1 - w * (1 - u)
        amp = depth * (0.6 + 0.4 * (w / W0))
        y = y0 - amp * (0.5 + 0.5 * math.sin(u * pleats * 2 * math.pi + v * 0.9))
        return (x, y, z)
    k.add(bm_grid(fn, nu, nv), mat, None, group, smooth=70, uv='keep')

def swag(k, xa, xb, z, sag, y, r=0.085, mat='mat_velvet', group=None):
    path = []
    for i in range(17):
        t = i / 16
        path.append((xa + (xb - xa) * t, y - 0.04 * math.sin(math.pi * t), z - sag * math.sin(math.pi * t) ** 1.2))
    k.add(bm_sweep(path, circle(r, 10, 1.0, 0.6), up=(0, -1, 0), scale=lambda t: 0.55 + 0.45 * math.sin(math.pi * t)), mat, None, group, smooth=70)
    return path

def lattice(x0, x1, z0, z1, sp=0.2):
    """Diamond lead-came segments clipped to a pane rectangle."""
    segs = []
    W, Hh = x1 - x0, z1 - z0
    for sgn in (1, -1):
        c = -W
        while c < Hh + W:
            pts = []
            for i in range(241):
                t = i / 240; px = x0 + W * t
                pz = z0 + c + (sgn * (px - x0) if sgn > 0 else -(px - x0))
                if z0 <= pz <= z1: pts.append((px, pz))
            if len(pts) >= 2: segs.append((pts[0], pts[-1]))
            c += sp
    return segs

# ================================================================= 1) STERN GALLERY
def k_stern():
    k = Kit('stern_gallery_kit')
    WW, HH, Z0, CANT = 8.2, 2.55, 0.85, math.radians(13)
    bays, mw = 5, 0.16
    bw = (WW - (bays + 1) * mw) / bays
    C = T(0, 0, Z0) @ R(-CANT, 0, 0)        # canted window frame (top leans aft = +Y)
    xs = [-WW / 2 + mw / 2 + i * (bw + mw) for i in range(bays + 1)]
    ZT = 1.74                                 # transom bar height (window-local)
    k.add(bm_box(WW + 0.12, 0.22, 0.14, 0.02, 2), 'mat_mahogany', C @ T(0, -0.04, 0.07))
    k.add(bm_box(WW + 0.12, 0.22, 0.16, 0.02, 2), 'mat_mahogany', C @ T(0, -0.04, HH - 0.08))
    k.add(bm_box(WW, 0.18, 0.1, 0.015, 2), 'mat_mahogany', C @ T(0, -0.03, ZT))
    for x in xs:
        k.add(bm_box(mw, 0.22, HH, 0.02, 2), 'mat_mahogany', C @ T(x, -0.04, HH / 2))
        # gilded twisted-rope pilaster on every mullion
        bm = bmesh.new(); rings = []
        NZ = 44
        for j in range(NZ + 1):
            z = 0.16 + (HH - 0.36) * j / NZ; tw = j * 0.6
            ring = []
            for i in range(16):
                a = 2 * math.pi * i / 16
                rr = 0.042 * (1 + 0.2 * math.cos(3 * a + tw))
                ring.append(bm.verts.new((x + math.cos(a) * rr, -0.19 + math.sin(a) * rr, z)))
            rings.append(ring)
        for j in range(NZ):
            for i in range(16): bm.faces.new((rings[j][i], rings[j][(i + 1) % 16], rings[j + 1][(i + 1) % 16], rings[j + 1][i]))
        bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        k.add(bm, 'mat_gold', C, smooth=60)
        k.add(bm_lathe([(0.06, 0), (0.075, 0.03), (0.05, 0.06), (0.06, 0.09)], 12), 'mat_gold', C @ T(x, -0.19, 0.07))
        k.add(bm_lathe([(0.05, 0), (0.07, 0.04), (0.085, 0.08), (0.06, 0.1)], 12), 'mat_gold', C @ T(x, -0.19, HH - 0.21))
        for s in (-1, 1):
            k.add(bm_torus(0.032, 0.011, 12, 6, arc=1.6 * math.pi), 'mat_gold', C @ T(x + s * 0.065, -0.2, HH - 0.12) @ R(math.pi / 2, 0, 0) @ R(0, 0, 0.8 if s > 0 else 2.2))
    for i in range(bays):
        cx = -WW / 2 + mw + bw / 2 + i * (bw + mw)
        for (z0, z1) in ((0.14, ZT - 0.05), (ZT + 0.05, HH - 0.16)):
            w, h = bw, z1 - z0
            for (sx, sz, px, pz) in ((w, 0.045, cx, z0 + 0.022), (w, 0.045, cx, z1 - 0.022), (0.045, h, cx - w / 2 + 0.022, (z0 + z1) / 2), (0.045, h, cx + w / 2 - 0.022, (z0 + z1) / 2)):
                k.add(bm_box(sx, 0.06, sz, 0.008, 1), 'mat_mahogany', C @ T(px, -0.01, pz))
            k.add(bm_box(w - 0.06, 0.008, h - 0.06), 'mat_glass', C @ T(cx, 0.012, (z0 + z1) / 2), smooth=None)
            for (a, b) in lattice(cx - w / 2 + 0.045, cx + w / 2 - 0.045, z0 + 0.045, z1 - 0.045, 0.3):
                va, vb = Vector((a[0], 0, a[1])), Vector((b[0], 0, b[1])); d = vb - va
                if d.length < 0.04: continue
                k.add(bm_box(0.014, 0.016, d.length), 'mat_iron', C @ T(*((va + vb) / 2)) @ align_z(d), smooth=None)
    # cheeks + soffit close the gap between the wall plane (y=0) and the canted frame -> no sky gaps
    top_y, top_z = HH * math.sin(CANT), Z0 + HH * math.cos(CANT)
    for s in (-1, 1):
        k.add(bm_extrude([(0.0, Z0 - 0.02), (top_y + 0.05, top_z + 0.02), (0.0, top_z + 0.02)], 0.16, 'YZ'), 'mat_mahogany', T(s * (WW / 2 - 0.02), 0, 0))
    k.add(bm_box(WW + 0.3, top_y + 0.12, 0.1, 0.01, 1), 'mat_mahogany', T(0, (top_y + 0.12) / 2 - 0.02, top_z + 0.04))
    # architrave pilasters, carved cornice and gilded crown cresting
    for s in (-1, 1):
        k.add(bm_box(0.36, 0.12, top_z + 0.06, 0.02, 2), 'mat_mahogany', T(s * (WW / 2 + 0.2), -0.06, (top_z + 0.06) / 2))
        for zz in (0.5, 1.4, 2.3):
            k.add(bm_box(0.24, 0.04, 0.6, 0.012, 1), 'mat_mahogany', T(s * (WW / 2 + 0.2), -0.13, zz + 0.3))
            k.add(bm_box(0.2, 0.01, 0.56), 'mat_gold', T(s * (WW / 2 + 0.2), -0.152, zz + 0.3), smooth=None)
    k.add(bm_box(WW + 0.9, 0.34, 0.2, 0.03, 2), 'mat_mahogany', T(0, -0.14, top_z + 0.15))
    k.add(bm_box(WW + 1.0, 0.4, 0.07, 0.02, 2), 'mat_mahogany', T(0, -0.17, top_z + 0.28))
    k.add(bm_cyl(0.035, 0.035, WW + 0.85, 12), 'mat_gold', T(-(WW + 0.85) / 2, -0.32, top_z + 0.06) @ R(0, math.pi / 2, 0))
    for i in range(44):  # egg & dart
        x = -WW / 2 - 0.35 + i * (WW + 0.7) / 43
        k.add(bm_sphere(0.03, 8, 5, 1, 0.6, 1.3), 'mat_gold', T(x, -0.315, top_z + 0.17))
    k.add(bm_sphere(0.2, 16, 10, 1.3, 0.25, 1.0), 'mat_gold', T(0, -0.3, top_z + 0.52))
    k.add(bm_torus(0.21, 0.025, 24, 6), 'mat_gold', T(0, -0.36, top_z + 0.52) @ R(math.pi / 2, 0, 0) @ S(1.3, 1, 1))
    for s in (-1, 1):
        for j in range(4):
            x = s * (0.6 + j * 0.9)
            k.add(bm_torus(0.09 - j * 0.008, 0.02, 14, 6, arc=1.5 * math.pi), 'mat_gold', T(x, -0.3, top_z + 0.44 - j * 0.03) @ R(math.pi / 2, 0, 0) @ R(0, 0, -0.6 if s > 0 else math.pi + 0.6))
            k.add(bm_sweep([(x - s * 0.08, -0.3, top_z + 0.34), (x + s * 0.12, -0.31, top_z + 0.38 - j * 0.02), (x + s * 0.4, -0.3, top_z + 0.34)], circle(0.016, 6), up=(0, -1, 0), scale=lambda t: 1.2 - 0.8 * t), 'mat_gold')
    # swags + gold fringe + rosettes + jabots
    zs = top_z - 0.02
    for i in range(bays):
        xa, xb = xs[i], xs[i + 1]
        swag(k, xa, xb, zs, 0.34, -0.42, 0.09)
        swag(k, xa, xb, zs - 0.05, 0.24, -0.46, 0.06)
        path = [(xa + (xb - xa) * t, -0.5 - 0.04 * math.sin(math.pi * t), zs - 0.34 * math.sin(math.pi * t) ** 1.2 - 0.07) for t in [j / 16 for j in range(17)]]
        k.add(bm_sweep(path, circle(0.018, 6)), 'mat_gold')
        for j in range(1, 16):
            px, py, pz = path[j]
            k.add(bm_cyl(0.006, 0.004, 0.07, 4), 'mat_gold', T(px, py, pz - 0.07), smooth=None)
    for x in xs:
        k.add(bm_sphere(0.075, 12, 8, 1, 0.5, 1), 'mat_gold', T(x, -0.5, zs - 0.02))
        k.add(bm_torus(0.07, 0.018, 12, 6), 'mat_velvet', T(x, -0.47, zs - 0.02) @ R(math.pi / 2, 0, 0))
        k.add(bm_grid(lambda u, v, x=x: (x - 0.12 + 0.24 * u, -0.44 - 0.04 * math.sin(u * 4 * math.pi), zs - 0.06 - 0.55 * v * (0.75 + 0.25 * math.cos((u - 0.5) * math.pi * 2))), 10, 8), 'mat_velvet', None, smooth=70, uv='keep')
    # side drapes with gold braided tie-backs + tassels
    for s in (-1, 1):
        xin = s * (WW / 2 + 0.05); xout = s * (WW / 2 + 1.0)
        drape(k, min(xin, xout), max(xin, xout), top_z + 0.05, 0.02, -0.32, pleats=6, depth=0.1, pinch_z=1.3, pinch=0.4, flare=0.75, side=-s)
        tx = xout - s * 0.19
        k.add(bm_torus(0.2, 0.028, 18, 8), 'mat_gold', T(tx, -0.38, 1.3) @ R(0.15, 0, 0) @ S(1, 0.5, 1))
        k.add(bm_sweep([(tx + s * 0.2, -0.33, 1.3), (tx + s * 0.4, -0.2, 1.33), (s * (WW / 2 + 1.05), -0.05, 1.38)], circle(0.02, 6)), 'mat_gold')
        for ox in (-0.05, 0.05):
            k.add(bm_lathe([(0, 0), (0.05, 0.03), (0.035, 0.16), (0.02, 0.2), (0.03, 0.22), (0, 0.25)], 10), 'mat_gold', T(tx + ox, -0.46, 0.92))
            k.add(bm_cyl(0.004, 0.004, 0.16, 4), 'mat_gold', T(tx + ox, -0.46, 1.15), smooth=None)
        k.add(bm_sphere(0.05, 10, 6), 'mat_gold', T(s * (WW / 2 + 1.05), -0.05, 1.38))
    # built-in cushioned stern transom bench
    BX = WW / 2 + 0.05
    k.add(bm_box(2 * BX, 0.7, 0.4, 0.02, 2), 'mat_mahogany', T(0, -0.37, 0.2))
    k.add(bm_box(2 * BX + 0.04, 0.74, 0.06, 0.025, 2), 'mat_mahogany', T(0, -0.39, 0.03))
    k.add(bm_box(2 * BX + 0.1, 0.8, 0.06, 0.025, 2), 'mat_mahogany', T(0, -0.4, 0.43))
    n_pan = 8
    pw = (2 * BX - 0.3) / n_pan
    for i in range(n_pan):
        cx = -BX + 0.15 + pw / 2 + i * pw
        k.add(bm_box(pw - 0.12, 0.04, 0.22, 0.03, 1), 'mat_mahogany', T(cx, -0.735, 0.24))
        k.add(bm_box(pw - 0.2, 0.012, 0.012), 'mat_gold', T(cx, -0.758, 0.36), smooth=None)
    k.add(bm_box(2 * BX, 0.08, 0.42, 0.02, 2), 'mat_mahogany', T(0, -0.04, 0.67))
    for i in range(bays):
        cx = -WW / 2 + mw + bw / 2 + i * (bw + mw)
        cw = bw + mw - 0.05
        k.add(bm_box(cw, 0.6, 0.14, 0.055, 3), 'mat_leather', T(cx, -0.42, 0.53))
        for t in range(7):
            rivet(k, (cx - cw / 2 + 0.06 + t * (cw - 0.12) / 6, -0.722, 0.53), (0, -1, 0), 0.012, 'mat_gold')
        for t in range(3):
            k.add(bm_sphere(0.018, 8, 5, 1, 1, 0.5), 'mat_leather', T(cx - cw / 3 + t * cw / 3, -0.42, 0.6))
        k.add(bm_cyl(0.11, 0.11, cw - 0.1, 14), 'mat_velvet', T(cx - (cw - 0.1) / 2, -0.17, 0.71) @ R(0, math.pi / 2, 0), smooth=60)
        for e in (-1, 1):
            k.add(bm_torus(0.1, 0.015, 14, 5), 'mat_gold', T(cx + e * (cw - 0.12) / 2, -0.17, 0.71) @ R(0, math.pi / 2, 0))
    for j, (x, y, a) in enumerate(((-2.4, -0.45, 0.2), (-2.25, -0.55, 0.35), (-2.33, -0.37, -0.1))):
        k.add(bm_cyl(0.045, 0.045, 0.62, 14), 'mat_parchment', T(x, y, 0.65 + j * 0.02) @ R(0, math.pi / 2, a) @ T(0, 0, -0.31))
        k.add(bm_torus(0.047, 0.008, 14, 4), 'mat_velvet', T(x, y, 0.65 + j * 0.02) @ R(0, math.pi / 2, a))
    sp = T(1.9, -0.5, 0.66) @ R(0, math.pi / 2, 0.3) @ T(0, 0, -0.26)
    k.add(bm_lathe([(0.03, 0), (0.032, 0.02), (0.028, 0.2), (0.024, 0.21), (0.024, 0.36), (0.02, 0.37), (0.02, 0.5), (0.023, 0.52), (0.0, 0.52)], 14), 'mat_gold', sp)
    k.add(bm_cyl(0.034, 0.034, 0.14, 14), 'mat_leather', sp @ T(0, 0, 0.04))
    return k

# ================================================================= 2) HULL RIB (+ hanging knee + half deck beam)
def k_rib():
    k = Kit('hull_rib_kit')
    N = 20
    path = [(0, -(f_in(RH * i / (N - 1)) + 0.14), RH * i / (N - 1) - (0.02 if i == 0 else 0)) for i in range(N)]
    k.add(bm_sweep(path, rect(0.24, 0.28, 0.03), up=(1, 0, 0)), 'mat_oak_dark', smooth=40)
    yb0 = -0.48
    bpath = []
    for i in range(30):
        y = yb0 + (-5.82 - yb0) * i / 29
        bpath.append((0, y, min(ceil_h(-y - RW / 2), PEAK) - 0.12))
    k.add(bm_sweep(bpath, rect(0.24, 0.22, 0.025), up=(0, 0, 1)), 'mat_oak_dark', smooth=40)
    def yf(z): return -(f_in(z) + 0.28)
    def zbb(y): return ceil_h(-y - RW / 2) - 0.24
    ytop = yf(RH - 0.25)
    poly = []
    for i in range(7):
        z = 2.7 + (zbb(ytop) - 2.7) * i / 6
        poly.append((yf(z) + 0.01, z))
    yt = -1.9
    for i in range(1, 9):
        y = ytop + (yt - ytop) * i / 8
        poly.append((y, zbb(y) + 0.01))
    Tp = (yt, zbb(yt) - 0.15); H0 = (yf(2.7) - 0.17, 2.7)
    K = (H0[0], Tp[1])
    for i in range(0, 13):
        t = i / 12
        poly.append(((1 - t) ** 2 * Tp[0] + 2 * (1 - t) * t * K[0] + t * t * H0[0], (1 - t) ** 2 * Tp[1] + 2 * (1 - t) * t * K[1] + t * t * H0[1]))
    k.add(bm_extrude(poly, 0.18, 'YZ'), 'mat_oak_dark', smooth=40)
    for (y, z, ln, ang, hw) in ((yf(3.15) + 0.03, 3.15, 0.5, 0.0, 0.095), (-1.25, zbb(-1.25) - 0.06, 0.55, math.pi / 2, 0.095), (yf(1.2) + 0.14, 1.2, 0.42, 0.0, 0.122)):
        for s in (-1, 1):
            k.add(bm_box(0.012, 0.1, ln, 0.004, 1), 'mat_iron', T(s * hw, y, z) @ R(ang, 0, 0))
            for j in (-1, 0, 1):
                off = Vector((0, 0, j * ln * 0.38)); off.rotate(Euler((ang, 0, 0)))
                rivet(k, (s * (hw + 0.008), y + off.y, z + off.z), (s, 0, 0), 0.02)
    for t in (0.2, 0.5, 0.8):
        y = yb0 + (-5.8 - yb0) * t
        rivet(k, (0, y, zbb(y)), (0, 0, -1), 0.022)
    # Heavy deck waterway coaming shoe + mid-beam longitudinal carling + centreline gilded boss half
    k.add(bm_box(0.34, 0.34, 0.16, 0.02, 2), 'mat_oak_dark', T(0, -0.20, 0.08))
    for yc in (-2.25, -4.15):
        zc = ceil_h(-yc - RW / 2) - 0.11
        k.add(bm_box(2.22, 0.14, 0.14, 0.015, 1), 'mat_oak_dark', T(0, yc, zc))
        k.add(bm_box(0.30, 0.18, 0.016, 0.004, 1), 'mat_iron', T(0, yc, zc - 0.072))
    zboss = PEAK - 0.23
    k.add(bm_box(0.32, 0.28, 0.05, 0.012, 1), 'mat_mahogany', T(0, -5.68, zboss))
    k.add(bm_sphere(0.075, 12, 8, 1, 1, 0.45), 'mat_gold', T(0, -5.68, zboss - 0.03))
    return k

# ================================================================= 3) PORTHOLE
def k_porthole():
    k = Kit('porthole_kit')
    toY = R(math.pi / 2, 0, 0)  # lathe +Z -> -Y (front)
    k.add(bm_lathe([(0.235, 0.0), (0.38, 0.0), (0.38, 0.025), (0.355, 0.05), (0.3, 0.065), (0.29, 0.1), (0.26, 0.12), (0.235, 0.12)], 32, closed=True), 'mat_brass', toY)
    k.add(bm_lathe([(0.22, 0.1), (0.29, 0.1), (0.29, 0.135), (0.26, 0.15), (0.22, 0.15)], 32, closed=True), 'mat_brass', toY)
    k.add(bm_cyl(0.24, 0.24, 0.008, 28), 'mat_glass', toY @ T(0, 0, 0.11), smooth=None)
    for i in range(8):
        a = 2 * math.pi * i / 8 + math.pi / 8
        hex_bolt(k, (math.cos(a) * 0.335, -0.055, math.sin(a) * 0.335), (0, -1, 0), 0.022)
    k.add(bm_box(0.08, 0.06, 0.14, 0.01, 1), 'mat_brass', T(0.33, -0.11, 0.0))
    k.add(bm_cyl(0.022, 0.022, 0.2, 10), 'mat_brass', T(0.37, -0.12, -0.1))
    for (x, z) in ((-0.36, 0.0), (0.0, -0.36)):
        k.add(bm_box(0.06, 0.05, 0.06, 0.008, 1), 'mat_iron', T(x, -0.06, z))
        k.add(bm_cyl(0.012, 0.012, 0.1, 6), 'mat_iron', T(x, -0.02, z) @ R(math.pi / 2, 0, 0))
        k.add(bm_box(0.12, 0.025, 0.035, 0.008, 1), 'mat_brass', T(x, -0.13, z) @ R(0, 0.3, 0))
    k.add(bm_cyl(0.245, 0.245, 0.004, 28), 'mat_ocean_view', T(0, 0.02, 0) @ toY, smooth=None, uv='planar_xz')
    return k

# ================================================================= 4) SHIP'S WHEEL CHANDELIER (origin = ceiling hook)
def k_chandelier():
    k = Kit('wheel_chandelier_kit')
    zu, z0 = -0.82, -1.34
    k.add(bm_lathe([(0, 0), (0.19, 0), (0.19, -0.028), (0.13, -0.055), (0.06, -0.078), (0, -0.085)], 22), 'mat_brass')
    k.add(bm_lathe([(0, -0.07), (0.055, -0.075), (0.035, -0.12), (0, -0.13)], 12), 'mat_brass')
    chain(k, (0, 0, -0.11), (0, 0, -0.52), 0.10, 0.0095)
    k.add(bm_torus(0.085, 0.015, 18, 6), 'mat_brass', T(0, 0, -0.55))
    # Upper brass crown ring + 4 scrolled candle sconces
    k.add(bm_lathe([(0.31, -0.028), (0.36, -0.028), (0.37, 0.0), (0.36, 0.028), (0.31, 0.028)], 36, closed=True), 'mat_brass', T(0, 0, zu))
    for i in range(4):
        a = i * math.pi / 2
        chain(k, (math.cos(a) * 0.075, math.sin(a) * 0.075, -0.56), (math.cos(a) * 0.33, math.sin(a) * 0.33, zu + 0.025), 0.085, 0.0075)
        ab = a + math.pi / 4
        ux, uy = math.cos(ab) * 0.34, math.sin(ab) * 0.34
        k.add(bm_lathe([(0, 0), (0.058, 0), (0.062, 0.012), (0.032, 0.022), (0.032, 0.048), (0, 0.048)], 12), 'mat_brass', T(ux, uy, zu + 0.025))
        candle(k, (ux, uy, zu + 0.068), h=0.135, r=0.024, drips=2, fs=0.92)
        chain(k, (math.cos(a) * 0.33, math.sin(a) * 0.33, zu - 0.025), (math.cos(a) * 0.56, math.sin(a) * 0.56, z0 + 0.05), 0.09, 0.008)
    # Central turned spindle between upper crown and lower helm wheel
    k.add(bm_lathe([(0, 0), (0.035, 0.06), (0.055, 0.16), (0.028, 0.28), (0.048, 0.40), (0.025, 0.50), (0, 0.52)], 14), 'mat_brass', T(0, 0, z0))
    # Lower 12-spoke mahogany & iron-tired ship's wheel + 8 candle sconces
    k.add(bm_lathe([(0.55, -0.045), (0.66, -0.045), (0.672, -0.02), (0.672, 0.02), (0.66, 0.045), (0.55, 0.045), (0.54, 0.0)], 48, closed=True), 'mat_mahogany', T(0, 0, z0))
    k.add(bm_lathe([(0.672, -0.022), (0.692, -0.022), (0.692, 0.022), (0.672, 0.022)], 48, closed=True), 'mat_brass', T(0, 0, z0))
    k.add(bm_lathe([(0.27, -0.03), (0.33, -0.03), (0.33, 0.03), (0.27, 0.03)], 32, closed=True), 'mat_mahogany', T(0, 0, z0))
    k.add(bm_lathe([(0, -0.08), (0.12, -0.08), (0.13, -0.05), (0.13, 0.05), (0.12, 0.08), (0, 0.08)], 20), 'mat_brass', T(0, 0, z0))
    k.add(bm_lathe([(0.12, -0.05), (0.18, -0.04), (0.18, 0.04), (0.12, 0.05)], 20, closed=True), 'mat_mahogany', T(0, 0, z0))
    for i in range(12):
        a = 2 * math.pi * i / 12
        prof = [(0.03, 0.12), (0.034, 0.2), (0.024, 0.28), (0.032, 0.36), (0.024, 0.46), (0.03, 0.55), (0.03, 0.68), (0.022, 0.71), (0.036, 0.76), (0.02, 0.8), (0.034, 0.84), (0.0, 0.87)]
        k.add(bm_lathe(prof, 10), 'mat_mahogany', T(0, 0, z0) @ R(0, 0, a) @ R(0, math.pi / 2, 0), smooth=60)
        k.add(bm_lathe([(0.036, 0.0), (0.036, 0.03)], 10), 'mat_brass', T(0, 0, z0) @ R(0, 0, a) @ R(0, math.pi / 2, 0) @ T(0, 0, 0.69))
    for i in range(8):
        a = 2 * math.pi * i / 8 + math.pi / 12
        x, y = math.cos(a) * 0.605, math.sin(a) * 0.605
        zc = z0 + 0.045
        k.add(bm_lathe([(0, 0), (0.072, 0.0), (0.078, 0.015), (0.05, 0.02), (0.035, 0.025), (0.036, 0.06), (0.0, 0.06)], 14), 'mat_brass', T(x, y, zc))
        k.add(bm_torus(0.062, 0.007, 14, 5), 'mat_brass', T(x, y, zc + 0.045) @ R(math.pi / 2, 0, a))
        candle(k, (x, y, zc + 0.05), h=0.17, r=0.03)
    k.add(bm_lathe([(0, 0), (0.07, -0.04), (0.055, -0.11), (0.08, -0.15), (0.035, -0.22), (0.0, -0.27)], 16), 'mat_brass', T(0, 0, z0 - 0.07))
    return k

# ================================================================= 5) GIMBALED BULKHEAD LANTERN (origin = wall mount)
def k_lantern():
    k = Kit('gimbal_lantern_kit')
    k.add(bm_box(0.12, 0.03, 0.34, 0.01, 1), 'mat_iron', T(0, -0.015, 0.0))
    for z in (-0.12, 0.12): hex_bolt(k, (0, -0.035, z), (0, -1, 0), 0.014)
    k.add(bm_sweep([(0, -0.02, 0.1), (0, -0.2, 0.12), (0, -0.38, 0.11), (0, -0.44, 0.07)], rect(0.026, 0.03, 0.006), up=(1, 0, 0)), 'mat_iron')
    sp = []
    for i in range(30):
        t = i / 29; a = t * 2.6 * math.pi; r = 0.11 * (1 - t * 0.75)
        sp.append((0, -0.03 - 0.15 * t - math.sin(a) * r * 0.5, -0.08 - 0.05 * t + math.cos(a) * r * 0.6))
    k.add(bm_sweep(sp, circle(0.009, 6)), 'mat_iron')
    k.add(bm_sweep([(0, -0.03, -0.12), (0, -0.2, -0.02), (0, -0.33, 0.09)], circle(0.01, 6)), 'mat_iron')
    k.add(bm_torus(0.025, 0.006, 10, 5), 'mat_iron', T(0, -0.44, 0.045) @ R(0, math.pi / 2, 0))
    px, py, pz = 0, -0.44, 0.03
    P = k.pivot('gimbal_lantern', (px, py, pz))
    def L(x=0, y=0, z=0): return T(px + x, py + y, pz + z)
    k.add(bm_torus(0.17, 0.008, 20, 5, arc=math.pi), 'mat_brass', L(0, 0, -0.33) @ R(math.pi / 2, 0, 0), P)
    k.add(bm_torus(0.165, 0.011, 24, 6), 'mat_brass', L(0, 0, -0.33), P)
    for s in (-1, 1): k.add(bm_cyl(0.012, 0.012, 0.05, 8), 'mat_brass', L(s * 0.14, 0, -0.33) @ R(0, math.pi / 2, 0) @ T(0, 0, -0.025), P)
    k.add(bm_torus(0.02, 0.005, 10, 5), 'mat_iron', L(0, 0, -0.03) @ R(math.pi / 2, 0, 0), P)
    k.add(bm_lathe([(0.0, -0.04), (0.03, -0.045), (0.035, -0.09), (0.05, -0.1), (0.04, -0.12), (0.12, -0.17), (0.13, -0.2), (0.13, -0.215), (0.0, -0.215)], 8), 'mat_brass', L(), P, smooth=30)
    for i in range(8):
        a = 2 * math.pi * i / 8 + math.pi / 8
        k.add(bm_torus(0.012, 0.004, 8, 4), 'mat_iron', L(math.cos(a) * 0.085, math.sin(a) * 0.085, -0.15) @ align_z((math.cos(a), math.sin(a), 1.2)), P)
    k.add(bm_cyl(0.112, 0.112, 0.26, 8), 'mat_glass', L(0, 0, -0.475), P, smooth=None)
    for i in range(8):
        a = 2 * math.pi * i / 8
        k.add(bm_box(0.018, 0.018, 0.28), 'mat_iron', L(math.cos(a) * 0.122, math.sin(a) * 0.122, -0.345) @ R(0, 0, a), P, smooth=None)
    for z in (-0.3, -0.4):
        k.add(bm_torus(0.124, 0.006, 8, 4), 'mat_iron', L(0, 0, z), P, smooth=30)
    k.add(bm_lathe([(0.13, -0.475), (0.135, -0.5), (0.1, -0.53), (0.06, -0.56), (0.03, -0.6), (0.0, -0.64)], 8), 'mat_brass', L(), P, smooth=30)
    k.add(bm_lathe([(0.0, -0.47), (0.055, -0.47), (0.06, -0.44), (0.03, -0.42), (0.012, -0.41), (0.0, -0.41)], 12), 'mat_brass', L(), P)
    flame(k, (px, py, pz - 0.41), 1.45, P)
    return k

# ================================================================= 6) CHART TABLE (+ chairs + storytelling props)
def chair(k, M, grand=False):
    sw, sd, sh = (0.62, 0.58, 0.47) if grand else (0.5, 0.48, 0.46)
    # cabriole legs
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (sw / 2 - 0.05), sy * (sd / 2 - 0.05)
            kick = 1.0 if sy < 0 else 0.4
            pts = [(x + sx * 0.035 * (1 - t) ** 2 * kick, y + sy * 0.035 * (1 - t) ** 2, sh * t) for t in [j / 8 for j in range(9)]]
            k.add(bm_sweep(pts, rect(0.055, 0.055, 0.01), up=(1, 0, 0), scale=lambda t: 0.75 + 0.35 * math.sin(math.pi * t * 0.8)), 'mat_mahogany', M)
            k.add(bm_sphere(0.03, 8, 5, 1, 1, 0.7), 'mat_brass', M @ T(x + sx * 0.035 * kick, y + sy * 0.035, 0.015))
    k.add(bm_box(sw, sd, 0.06, 0.015, 2), 'mat_mahogany', M @ T(0, 0, sh))
    k.add(bm_box(sw - 0.05, sd - 0.05, 0.08, 0.035, 3), 'mat_velvet', M @ T(0, 0, sh + 0.065))
    for t in range(9):
        x = -sw / 2 + 0.04 + t * (sw - 0.08) / 8
        k.add(bm_sphere(0.009, 6, 4, 1, 0.5, 1), 'mat_brass', M @ T(x, -sd / 2 - 0.002, sh))
    bh = 0.88 if grand else 0.55
    lean = 0.12
    yb = sd / 2 - 0.04
    for sx in (-1, 1):
        k.add(bm_lathe([(0.03, 0), (0.035, 0.1), (0.025, 0.4), (0.032, 0.7), (0.022, 1.0)], 10), 'mat_mahogany', M @ T(sx * (sw / 2 - 0.04), yb, sh) @ R(-lean, 0, 0) @ S(1, 1, bh))
    ytop = yb + bh * math.sin(lean); ztop = sh + bh * math.cos(lean)
    crest = [(x, ytop, ztop + (0.12 if grand else 0.04) * math.cos(x / (sw / 2) * math.pi / 2)) for x in [(-sw / 2 + 0.03) + i * (sw - 0.06) / 12 for i in range(13)]]
    k.add(bm_sweep(crest, rect(0.07, 0.06, 0.012), up=(0, 0, 1)), 'mat_mahogany', M)
    k.add(bm_box(sw - 0.12, 0.05, bh - 0.16, 0.02, 2), 'mat_velvet', M @ T(0, yb + (bh / 2) * math.sin(lean), sh + 0.04 + (bh / 2) * math.cos(lean)) @ R(-lean, 0, 0))
    if grand:
        k.add(bm_sphere(0.06, 12, 8, 1.3, 0.5, 1), 'mat_brass', M @ T(0, ytop, ztop + 0.16))
        for sx in (-1, 1):
            ap = [(sx * (sw / 2 + 0.01), sd / 2 - 0.08, sh + 0.25), (sx * (sw / 2 + 0.03), 0.0, sh + 0.27), (sx * (sw / 2 + 0.02), -sd / 2 + 0.05, sh + 0.24), (sx * (sw / 2 + 0.02), -sd / 2 - 0.02, sh + 0.2)]
            k.add(bm_sweep(ap, rect(0.07, 0.05, 0.012), up=(0, 0, 1)), 'mat_mahogany', M)
            k.add(bm_torus(0.035, 0.014, 12, 6, arc=1.5 * math.pi), 'mat_mahogany', M @ T(sx * (sw / 2 + 0.02), -sd / 2 - 0.01, sh + 0.17) @ R(0, math.pi / 2, 0))
            k.add(bm_lathe([(0.02, 0), (0.03, 0.08), (0.02, 0.2), (0.025, 0.25)], 8), 'mat_mahogany', M @ T(sx * (sw / 2 + 0.02), -sd / 2 + 0.05, sh))
            k.add(bm_box(0.05, sd - 0.16, 0.05, 0.02, 2), 'mat_velvet', M @ T(sx * (sw / 2 + 0.025), -0.01, sh + 0.29))

def k_table():
    k = Kit('chart_table_kit')
    TW, TL, TT = 1.2, 2.25, 0.80
    for i in range(5):
        pw = TW / 5
        k.add(bm_box(pw - 0.006, TL, 0.065, 0.012, 2), 'mat_mahogany', T(-TW / 2 + pw / 2 + i * pw, 0, TT - 0.0325))
    k.add(bm_box(TW + 0.05, TL + 0.05, 0.03, 0.012, 2), 'mat_mahogany', T(0, 0, TT - 0.08))
    k.add(bm_box(TW - 0.12, TL - 0.2, 0.12, 0.015, 2), 'mat_mahogany', T(0, 0, TT - 0.15))
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (TW / 2 - 0.05), sy * (TL / 2 - 0.05)
            k.add(bm_box(0.16, 0.025, 0.004), 'mat_brass', T(x - sx * 0.055, y, TT + 0.001), smooth=None)
            k.add(bm_box(0.025, 0.16, 0.004), 'mat_brass', T(x, y - sy * 0.055, TT + 0.001), smooth=None)
            k.add(bm_box(0.06, 0.06, 0.07, 0.006, 1), 'mat_brass', T(sx * (TW / 2 + 0.01), sy * (TL / 2 + 0.01), TT - 0.06))
    for sy in (-0.68, 0.68):
        k.add(bm_lathe([(0.11, 0.18), (0.13, 0.22), (0.08, 0.3), (0.06, 0.38), (0.1, 0.46), (0.07, 0.56), (0.05, 0.62), (0.09, 0.66), (0.06, 0.68)], 16), 'mat_mahogany', T(0, sy, 0))
        k.add(bm_box(0.5, 0.3, 0.05, 0.015, 2), 'mat_mahogany', T(0, sy, TT - 0.115))
        for a in (0.6, math.pi - 0.6, math.pi + 0.6, -0.6):
            d = Vector((math.cos(a), math.sin(a), 0))
            pts = [(d.x * (0.06 + 0.42 * t), sy + d.y * (0.06 + 0.42 * t), 0.22 - 0.2 * (t ** 0.7) + 0.06 * math.sin(math.pi * t)) for t in [j / 9 for j in range(10)]]
            k.add(bm_sweep(pts, rect(0.07, 0.09, 0.015), up=(0, 0, 1), scale=lambda t: 1.0 - 0.35 * t), 'mat_mahogany')
            k.add(bm_sphere(0.04, 10, 6, 1, 1, 0.8), 'mat_brass', T(d.x * 0.48, sy + d.y * 0.48, 0.03))
    k.add(bm_lathe([(0.04, -0.68), (0.05, -0.5), (0.035, -0.3), (0.05, 0.0), (0.035, 0.3), (0.05, 0.5), (0.04, 0.68)], 12), 'mat_mahogany', T(0, 0, 0.3) @ R(math.pi / 2, 0, 0))
    # unrolled curled-edge treasure & naval chart (planar UV keeps the painted chart)
    cw, cl, rr = 0.95, 1.35, 0.045
    def chart_fn(u, v):
        x = -cw / 2 + cw * u; s = -cl / 2 + cl * v; flat = cl / 2 - 0.12
        if abs(s) <= flat: return (x - 0.04, s, TT + 0.004)
        e = abs(s) - flat; a = e / rr; sg = 1 if s > 0 else -1
        return (x - 0.04, sg * (flat + rr * math.sin(a)), TT + 0.004 + rr * (1 - math.cos(a)))
    k.add(bm_grid(chart_fn, 12, 40), 'mat_parchment', R(0, 0, 0.06), smooth=80, uv='keep')
    k.add(bm_grid(lambda u, v: (-0.5 + 0.42 * u, 0.56 + 0.3 * v, TT + 0.006 + 0.01 * math.sin(u * math.pi)), 6, 6), 'mat_parchment', R(0, 0, -0.25), smooth=80, uv='keep')
    # curved pirate dagger stabbed through the chart
    dg = T(0.33, -0.5, TT) @ R(0.18, -0.12, 0.4)
    bp = [(0.024 * math.sin(t * 2.4), 0, 0.17 * t - 0.03) for t in [i / 12 for i in range(13)]]
    k.add(bm_sweep(bp, [(-0.022, 0), (0, 0.004), (0.022, 0), (0, -0.004)], up=(1, 0, 0), scale=lambda t: 0.15 + 0.85 * t ** 0.6), 'mat_iron', dg, smooth=30)
    k.add(bm_box(0.13, 0.02, 0.018, 0.006, 1), 'mat_brass', dg @ T(0, 0, 0.145))
    k.add(bm_lathe([(0.016, 0.0), (0.019, 0.05), (0.016, 0.1)], 10), 'mat_mahogany', dg @ T(0, 0, 0.152))
    k.add(bm_sphere(0.022, 10, 6), 'mat_brass', dg @ T(0, 0, 0.262))
    # miniature 3-masted PUMPFUN PIRATES galleon on a brass stand
    G = T(0.28, 0.62, TT) @ R(0, 0, 1.25)
    k.add(bm_box(0.36, 0.1, 0.02, 0.006, 1), 'mat_mahogany', G @ T(0, 0, 0.01))
    for s in (-0.1, 0.1):
        k.add(bm_cyl(0.008, 0.008, 0.07, 6), 'mat_brass', G @ T(s, 0, 0.02))
        k.add(bm_torus(0.03, 0.006, 10, 4, arc=math.pi), 'mat_brass', G @ T(s, 0, 0.12) @ R(math.pi / 2, 0, 0) @ R(0, 0, math.pi))
    HL, HB, HDp = 0.5, 0.13, 0.085
    bm = bmesh.new(); rings = []
    for i in range(17):
        t = i / 16
        x = -HL / 2 + HL * t
        wb = HB / 2 * (1 - (max(0, t - 0.55) / 0.45) ** 1.8 * 0.98) * (0.9 + 0.1 * math.sin(math.pi * min(1, t * 1.6)))
        sheer = 0.066 * (1 - t) ** 3 + 0.015 * t ** 4
        ring = [bm.verts.new((x, math.cos(math.pi * j / 10) * wb, HDp * 0.5 + sheer - math.sin(math.pi * j / 10) * HDp * (0.7 + 0.3 * (1 - t)))) for j in range(11)]
        rings.append(ring)
    for i in range(16):
        for j in range(10): bm.faces.new((rings[i][j], rings[i][j + 1], rings[i + 1][j + 1], rings[i + 1][j]))
    bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    k.add(bm, 'mat_mahogany', G @ T(0, 0, 0.11), smooth=50)
    deck = 0.11 + HDp * 0.5
    k.add(bm_box(0.42, HB * 0.86, 0.008), 'mat_parchment', G @ T(-0.02, 0, deck + 0.004), smooth=None)
    k.add(bm_box(0.12, HB * 0.9, 0.06, 0.006, 1), 'mat_mahogany', G @ T(-0.2, 0, deck + 0.035))
    for s in (-1, 1):
        k.add(bm_box(0.5, 0.004, 0.012), 'mat_brass', G @ T(0, s * HB / 2 * 0.92, 0.11 + HDp * 0.35))
    k.add(bm_cyl(0.006, 0.003, 0.22, 6), 'mat_mahogany', G @ T(0.24, 0, 0.16) @ R(0, math.radians(70), 0))
    for (mx, mh) in ((-0.13, 0.36), (0.0, 0.44), (0.13, 0.36)):
        k.add(bm_cyl(0.007, 0.004, mh, 6), 'mat_mahogany', G @ T(mx, 0, deck))
        for (yz, yl) in ((0.32, 0.17), (0.62, 0.13), (0.88, 0.09)):
            k.add(bm_cyl(0.003, 0.003, yl, 4), 'mat_mahogany', G @ T(mx, -yl / 2, deck + mh * yz) @ R(-math.pi / 2, 0, 0), smooth=None)
        for (za, zb, wa, wb2) in ((0.32, 0.6, 0.16, 0.13), (0.62, 0.86, 0.12, 0.09)):
            def sail_fn(u, v, mx=mx, za=za, zb=zb, wa=wa, wb2=wb2, mh=mh):
                w = wa + (wb2 - wa) * v
                return (mx + 0.03 * math.sin(math.pi * u) * math.sin(math.pi * v * 0.9 + 0.2), -w / 2 + w * u, deck + mh * (za + (zb - za) * v) - 0.005)
            k.add(bm_grid(sail_fn, 6, 5), 'mat_parchment', G, smooth=80, uv='keep')
    k.add(bm_extrude([(0.06, 0), (0.0, 0.0), (0.06, 0.15)], 0.003, 'XZ'), 'mat_parchment', G @ T(0.19, 0, deck + 0.03), smooth=None)
    k.add(bm_box(0.05, 0.002, 0.035), 'mat_felt', G @ T(0.0, 0, deck + 0.46), smooth=None)
    # brass-meridian terrestrial globe
    gx, gy = -0.3, 0.62
    k.add(bm_lathe([(0, 0), (0.09, 0), (0.1, 0.02), (0.05, 0.04), (0.03, 0.1), (0.045, 0.13), (0.02, 0.16), (0, 0.16)], 14), 'mat_mahogany', T(gx, gy, TT))
    k.add(bm_sphere(0.13, 24, 16), 'mat_parchment', T(gx, gy, TT + 0.3) @ R(0.41, 0, 0), smooth=80)
    k.add(bm_torus(0.145, 0.008, 32, 5), 'mat_brass', T(gx, gy, TT + 0.3) @ R(0.41, 0, 0) @ R(math.pi / 2, 0, 0))
    k.add(bm_lathe([(0.14, -0.004), (0.17, -0.004), (0.17, 0.004), (0.14, 0.004)], 32, closed=True), 'mat_brass', T(gx, gy, TT + 0.3))
    for a in (0, 2.1, 4.2):
        k.add(bm_cyl(0.006, 0.006, 0.15, 6), 'mat_brass', T(gx + math.cos(a) * 0.155, gy + math.sin(a) * 0.155, TT + 0.15))
    # brass sextant + dividers + pocket compass
    sx_ = T(-0.32, -0.2, TT + 0.012) @ R(0, 0, 0.5)
    k.add(bm_torus(0.14, 0.008, 16, 5, arc=math.pi / 3), 'mat_brass', sx_ @ R(0, 0, math.pi * 1.33))
    for a in (math.pi * 1.33, math.pi * 1.33 + math.pi / 3):
        k.add(bm_box(0.14, 0.01, 0.008), 'mat_brass', sx_ @ R(0, 0, a) @ T(0.07, 0, 0), smooth=None)
    k.add(bm_box(0.15, 0.008, 0.01), 'mat_brass', sx_ @ R(0, 0, math.pi * 1.5 + 0.12) @ T(0.075, 0, 0.008), smooth=None)
    k.add(bm_cyl(0.012, 0.012, 0.09, 10), 'mat_brass', sx_ @ T(-0.02, -0.06, 0.012) @ R(0, math.pi / 2, 0))
    for a in (-0.2, 0.2):
        k.add(bm_cyl(0.006, 0.0015, 0.2, 6), 'mat_brass', T(0.0, -0.3, TT + 0.008) @ R(0, math.pi / 2, 0.9 + a))
    k.add(bm_cyl(0.012, 0.012, 0.012, 10), 'mat_brass', T(0.0, -0.3, TT + 0.006))
    k.add(bm_lathe([(0, 0), (0.05, 0), (0.055, 0.008), (0.055, 0.02), (0.0, 0.02)], 18), 'mat_brass', T(-0.05, 0.1, TT))
    k.add(bm_cyl(0.047, 0.047, 0.002, 18), 'mat_parchment', T(-0.05, 0.1, TT + 0.021), smooth=None)
    k.add(bm_box(0.07, 0.006, 0.003), 'mat_iron', T(-0.05, 0.1, TT + 0.024) @ R(0, 0, 0.7), smooth=None)
    k.add(bm_lathe([(0.055, 0), (0.055, 0.006), (0.0, 0.008)], 18), 'mat_brass', T(-0.05, 0.155, TT + 0.06) @ R(-1.9, 0, 0))
    # faceted green-glass rum bottle + 2 pewter tankards + trencher with citrus
    k.add(bm_lathe([(0, 0), (0.06, 0), (0.07, 0.02), (0.07, 0.17), (0.05, 0.22), (0.02, 0.25), (0.018, 0.31), (0.022, 0.32), (0.0, 0.32)], 8), 'mat_glass_green', T(0.4, 0.05, TT), smooth=15)
    k.add(bm_cyl(0.016, 0.014, 0.035, 8), 'mat_mahogany', T(0.4, 0.05, TT + 0.315))
    for (tx, ty) in ((0.2, 0.2), (0.45, 0.3)):
        k.add(bm_lathe([(0, 0), (0.055, 0), (0.058, 0.01), (0.048, 0.13), (0.052, 0.14), (0.046, 0.14), (0.04, 0.02), (0, 0.02)], 14), 'mat_iron', T(tx, ty, TT))
        k.add(bm_torus(0.04, 0.009, 12, 5, arc=math.pi), 'mat_iron', T(tx + 0.05, ty, TT + 0.075) @ R(math.pi / 2, 0, 0) @ R(0, 0, -math.pi / 2))
    k.add(bm_lathe([(0, 0), (0.13, 0), (0.15, 0.03), (0.14, 0.035), (0.12, 0.012), (0.0, 0.012)], 20), 'mat_mahogany', T(-0.25, -0.65, TT))
    for (fx, fy, fr) in ((-0.28, -0.63, 0.042), (-0.21, -0.67, 0.04), (-0.25, -0.58, 0.038), (-0.2, -0.6, 0.036)):
        k.add(bm_sphere(fr, 12, 8, 1, 1, 0.95), 'mat_fruit', T(fx, fy, TT + 0.012 + fr * 0.95))
    # 3-branch brass candelabrum with dripping wax candles
    cx, cy = 0.12, -0.12
    k.add(bm_lathe([(0, 0), (0.08, 0), (0.085, 0.012), (0.04, 0.03), (0.02, 0.08), (0.03, 0.12), (0.015, 0.2), (0.025, 0.24), (0.0, 0.24)], 14), 'mat_brass', T(cx, cy, TT))
    for s in (-1, 1):
        k.add(bm_sweep([(cx, cy, TT + 0.16), (cx + s * 0.06, cy, TT + 0.15), (cx + s * 0.11, cy, TT + 0.19), (cx + s * 0.12, cy, TT + 0.24)], circle(0.008, 6)), 'mat_brass')
    for ox in (-0.12, 0.0, 0.12):
        k.add(bm_lathe([(0, 0), (0.035, 0), (0.04, 0.01), (0.022, 0.015), (0.022, 0.04), (0, 0.04)], 12), 'mat_brass', T(cx + ox, cy, TT + 0.24))
        candle(k, (cx + ox, cy, TT + 0.275), h=0.15, r=0.02, drips=2, mat='mat_parchment', fs=0.9)
    chair(k, T(0, TL / 2 + 0.42, 0), grand=True)
    chair(k, T(-(TW / 2 + 0.38), -0.15, 0) @ R(0, 0, math.pi / 2))
    chair(k, T((TW / 2 + 0.38), 0.25, 0) @ R(0, 0, -math.pi / 2))
    return k

# ================================================================= 7) CAPTAIN'S BOXED BERTH
def k_berth():
    k = Kit('berth_kit')
    BL, BD, BH = 2.55, 1.45, 2.5
    k.add(bm_box(BL, 0.06, BH, 0.01, 1), 'mat_mahogany', T(0, -0.03, BH / 2))
    for i in range(4):
        x = -BL / 2 + BL / 8 + i * BL / 4
        for (z0, z1) in ((0.75, 1.55), (1.65, 2.3)):
            k.add(bm_box(BL / 4 - 0.12, 0.03, z1 - z0, 0.025, 1), 'mat_mahogany', T(x, -0.07, (z0 + z1) / 2))
    for s in (-1, 1):
        k.add(bm_box(0.08, BD, BH, 0.015, 2), 'mat_mahogany', T(s * (BL / 2 + 0.04), -BD / 2, BH / 2))
        for (z0, z1) in ((0.12, 0.9), (1.0, 2.2)):
            k.add(bm_box(0.03, BD - 0.3, z1 - z0, 0.025, 1), 'mat_mahogany', T(s * (BL / 2 + 0.09), -BD / 2, (z0 + z1) / 2))
    k.add(bm_box(BL + 0.3, BD + 0.1, 0.08, 0.02, 2), 'mat_mahogany', T(0, -BD / 2 - 0.02, BH + 0.04))
    k.add(bm_box(BL + 0.34, 0.08, 0.3, 0.02, 2), 'mat_mahogany', T(0, -BD - 0.05, BH - 0.1))
    k.add(bm_box(BL + 0.38, 0.12, 0.06, 0.02, 2), 'mat_mahogany', T(0, -BD - 0.07, BH + 0.06))
    k.add(bm_cyl(0.03, 0.03, BL + 0.3, 12), 'mat_mahogany', T(-(BL + 0.3) / 2, -BD - 0.1, BH - 0.26) @ R(0, math.pi / 2, 0))
    k.add(bm_box(BL + 0.3, 0.01, 0.025), 'mat_gold', T(0, -BD - 0.095, BH - 0.02), smooth=None)
    for i in range(20):
        k.add(bm_sphere(0.022, 8, 5, 1, 0.5, 1.4), 'mat_gold', T(-BL / 2 - 0.1 + i * (BL + 0.2) / 19, -BD - 0.095, BH - 0.15))
    # base with 2 brass-handled sea drawers
    k.add(bm_box(BL, BD - 0.05, 0.45, 0.015, 2), 'mat_mahogany', T(0, -BD / 2, 0.225))
    for s in (-1, 1):
        dx = s * BL / 4
        k.add(bm_box(BL / 2 - 0.12, 0.035, 0.3, 0.02, 2), 'mat_mahogany', T(dx, -BD + 0.005, 0.23))
        k.add(bm_box(BL / 2 - 0.3, 0.02, 0.18, 0.03, 1), 'mat_mahogany', T(dx, -BD - 0.02, 0.23))
        for e in (-0.14, 0.14):
            k.add(bm_box(0.05, 0.012, 0.07, 0.006, 1), 'mat_gold', T(dx + e, -BD - 0.035, 0.27))
        k.add(bm_torus(0.13, 0.009, 14, 5, arc=math.pi), 'mat_gold', T(dx, -BD - 0.045, 0.27) @ R(math.pi / 2, 0, 0) @ R(0, 0, math.pi))
        k.add(bm_box(0.06, 0.01, 0.08, 0.005, 1), 'mat_gold', T(dx, -BD - 0.035, 0.36))
    # plump quilted mattress, linen turnover sheet, gold-trimmed throw, 3 pillows
    k.add(bm_box(BL - 0.04, BD - 0.12, 0.2, 0.07, 3), 'mat_linen', T(0, -BD / 2 + 0.02, 0.55))
    def quilt(u, v):
        return (-BL / 2 + 0.05 + (BL - 0.1) * u, -0.1 - (BD - 0.3) * v, 0.652 + 0.016 * (math.sin(u * 14 * math.pi) * math.sin(v * 7 * math.pi)) ** 2)
    k.add(bm_grid(quilt, 56, 20), 'mat_linen', None, smooth=80, uv='keep')
    def blanket(u, v):
        x = -0.35 + 1.55 * u; t = v * 1.3
        if t <= 1.0: y, z = -0.08 - (BD - 0.28) * t, 0.705 + 0.012 * math.sin(u * 9 + v * 5)
        else:
            e = (t - 1.0) / 0.3; y = -0.08 - (BD - 0.28) - 0.04 * math.sin(e * math.pi / 2); z = 0.705 - 0.22 * e
        return (x, y, z + 0.006 * math.sin(u * 23))
    k.add(bm_grid(blanket, 30, 26), 'mat_velvet', None, smooth=80, uv='keep')
    k.add(bm_sweep([(-0.35 + 1.55 * t, -BD + 0.2 - 0.045, 0.482) for t in [j / 10 for j in range(11)]], circle(0.012, 6)), 'mat_gold')
    k.add(bm_box(0.06, BD - 0.2, 0.025, 0.01, 1), 'mat_gold', T(-0.36, -BD / 2 + 0.04, 0.72))
    k.add(bm_box(0.3, BD - 0.18, 0.05, 0.022, 2), 'mat_linen', T(-0.52, -BD / 2 + 0.05, 0.72))
    for i, (px, py, pr) in enumerate(((-1.0, -0.38, 1.0), (-1.0, -0.88, 1.0), (-0.84, -0.63, 0.8))):
        k.add(bm_sphere(0.2, 14, 10, 0.55 * pr, 1.0 * pr, 0.42 * pr), 'mat_linen', T(px, py, 0.76 + 0.03 * i) @ R(0, -0.35 if i < 2 else -0.2, 0), smooth=80)
    # carved sea-rail with curved cutout
    rail = [(-BL / 2, 0.45)]
    for i in range(25):
        x = -BL / 2 + BL * i / 24
        rail.append((x, 1.02 - 0.28 * max(0.0, 1 - (abs(x / (BL / 2)) / 0.72) ** 4)))
    rail.append((BL / 2, 0.45))
    k.add(bm_extrude(rail, 0.06, 'XZ'), 'mat_mahogany', T(0, -BD + 0.02, 0), smooth=40)
    k.add(bm_sweep([(x, -BD + 0.02, z + 0.012) for (x, z) in rail[1:-1]], rect(0.085, 0.03, 0.01), up=(0, 0, 1)), 'mat_mahogany')
    k.add(bm_sweep([(x, -BD - 0.012, z - 0.06) for (x, z) in rail[2:-2]], circle(0.007, 5)), 'mat_gold')
    # turned corner columns + tied-back crimson & gold brocade curtains
    for s in (-1, 1):
        k.add(bm_lathe([(0.07, 0), (0.07, 0.1), (0.05, 0.14), (0.06, 0.2), (0.04, 0.3), (0.05, 0.5), (0.035, 0.62), (0.05, 0.7), (0.04, 0.85), (0.06, 0.9), (0.06, 1.0)], 14), 'mat_mahogany', T(s * (BL / 2 - 0.05), -BD + 0.02, 0.0) @ S(1, 1, BH - 0.1))
        for z in (0.45, 1.25, 2.2):
            k.add(bm_torus(0.052, 0.008, 14, 5), 'mat_gold', T(s * (BL / 2 - 0.05), -BD + 0.02, z))
        xo = s * (BL / 2 - 0.12); xi = xo - s * 0.72
        drape(k, min(xo, xi), max(xo, xi), BH - 0.25, 0.5, -BD - 0.06, pleats=5, depth=0.07, pinch_z=1.25, pinch=0.4, flare=0.6, side=(1 if s < 0 else -1), nu=22, nv=22)
        tx = xo - s * 0.12
        k.add(bm_torus(0.12, 0.022, 14, 6), 'mat_gold', T(tx, -BD - 0.1, 1.25) @ R(0.15, 0, 0) @ S(1, 0.6, 1))
        k.add(bm_lathe([(0, 0), (0.035, 0.03), (0.025, 0.12), (0.02, 0.15), (0, 0.17)], 8), 'mat_gold', T(tx - s * 0.04, -BD - 0.14, 1.03))
    # inner shelf with logbooks
    k.add(bm_box(BL - 0.3, 0.2, 0.03, 0.01, 1), 'mat_mahogany', T(0, -0.15, 1.85))
    for i in range(7):
        k.add(bm_box(0.05, 0.16, 0.2 + 0.03 * (i % 3), 0.006, 1), 'mat_leather' if i % 2 else 'mat_leather_brown', T(0.5 + i * 0.055, -0.15, 1.865 + 0.1 + 0.015 * (i % 3)))
    # bedside sea-locker with sextant case & book
    LX = -BL / 2 - 0.42
    k.add(bm_box(0.56, 0.5, 0.62, 0.02, 2), 'mat_mahogany', T(LX, -0.3, 0.31))
    k.add(bm_box(0.6, 0.54, 0.04, 0.015, 2), 'mat_mahogany', T(LX, -0.3, 0.64))
    k.add(bm_box(0.44, 0.02, 0.4, 0.03, 1), 'mat_mahogany', T(LX, -0.555, 0.33))
    for sx in (-1, 1):
        for sz in (0.03, 0.59):
            k.add(bm_box(0.06, 0.06, 0.06, 0.008, 1), 'mat_gold', T(LX + sx * 0.27, -0.55, sz))
    k.add(bm_torus(0.03, 0.006, 10, 4), 'mat_gold', T(LX, -0.57, 0.4) @ R(math.pi / 2, 0, 0))
    k.add(bm_box(0.3, 0.22, 0.12, 0.02, 2), 'mat_leather_brown', T(LX - 0.05, -0.28, 0.72))
    k.add(bm_box(0.06, 0.02, 0.05, 0.005, 1), 'mat_gold', T(LX - 0.05, -0.395, 0.74))
    k.add(bm_box(0.22, 0.16, 0.05, 0.006, 1), 'mat_leather', T(LX + 0.12, -0.4, 0.685) @ R(0, 0, 0.3))
    return k

# ================================================================= 8) BRASS-BOUND COOPERED SEA CHEST + LOOT
def k_chest():
    k = Kit('quarters_chest_kit')
    CL, CD, BHt, LR = 1.55, 0.92, 0.66, 0.55
    zb0 = 0.05
    for i in range(6):
        pw = CL / 6
        for sy in (-1, 1):
            k.add(bm_box(pw - 0.008, 0.04, BHt - zb0, 0.008, 1), 'mat_oak_dark', T(-CL / 2 + pw / 2 + i * pw, sy * (CD / 2 - 0.02), (zb0 + BHt) / 2))
    for sx in (-1, 1):
        for i in range(4):
            pw = (CD - 0.08) / 4
            k.add(bm_box(0.04, pw - 0.008, BHt - zb0, 0.008, 1), 'mat_oak_dark', T(sx * (CL / 2 - 0.02), -CD / 2 + 0.04 + pw / 2 + i * pw, (zb0 + BHt) / 2))
    k.add(bm_box(CL - 0.06, CD - 0.06, 0.04), 'mat_oak_dark', T(0, 0, zb0 + 0.02))
    k.add(bm_box(CL + 0.06, CD + 0.06, 0.06, 0.015, 2), 'mat_oak_dark', T(0, 0, 0.03))
    yc = math.sqrt(LR * LR - (CD / 2) ** 2)
    a0 = math.asin((CD / 2) / LR)
    zc = BHt - yc
    nst = 9
    for i in range(nst):   # arched stave lid
        a = -a0 + 2 * a0 * (i + 0.5) / nst
        k.add(bm_box(CL - 0.02, 2 * a0 / nst * LR - 0.008, 0.045, 0.006, 1), 'mat_oak_dark', T(0, math.sin(a) * (LR - 0.022), zc + math.cos(a) * (LR - 0.022)) @ R(-a, 0, 0))
    for sx in (-1, 1):
        poly = [(-CD / 2, BHt)] + [(math.sin(-a0 + 2 * a0 * j / 16) * LR, zc + math.cos(-a0 + 2 * a0 * j / 16) * LR) for j in range(1, 16)] + [(CD / 2, BHt)]
        k.add(bm_extrude(poly, 0.045, 'YZ'), 'mat_oak_dark', T(sx * (CL / 2 - 0.022), 0, 0))
    # 4 thick chamfered brass & iron straps studded with dome rivets
    for (x, mat) in ((-0.62, 'mat_iron'), (-0.21, 'mat_brass'), (0.21, 'mat_brass'), (0.62, 'mat_iron')):
        pth = [(x, -CD / 2 - 0.012, 0.06), (x, -CD / 2 - 0.012, BHt)]
        for j in range(1, 16):
            a = -a0 + 2 * a0 * j / 16
            pth.append((x, math.sin(a) * (LR + 0.012), zc + math.cos(a) * (LR + 0.012)))
        pth += [(x, CD / 2 + 0.012, BHt), (x, CD / 2 + 0.012, 0.06)]
        k.add(bm_sweep(pth, rect(0.1, 0.026, 0.008), up=(1, 0, 0)), mat, smooth=50)
        for j in range(0, len(pth), 2):
            p = Vector(pth[j])
            nrm = Vector((0, p.y, p.z - zc)) if 1 < j < len(pth) - 2 else Vector((0, 1 if p.y > 0 else -1, 0))
            nn = nrm.normalized()
            for ox in (-0.03, 0.03):
                rivet(k, (x + ox, p.y + nn.y * 0.014, p.z + nn.z * 0.014), nrm, 0.014, 'mat_brass')
    for sx in (-1, 1):
        for sy in (-1, 1):
            for z in (0.06, BHt - 0.06):
                k.add(bm_box(0.1, 0.1, 0.1, 0.012, 1), 'mat_brass', T(sx * (CL / 2 - 0.02), sy * (CD / 2 - 0.02), z))
        k.add(bm_box(0.04, 0.16, 0.06, 0.01, 1), 'mat_iron', T(sx * (CL / 2 + 0.02), 0, 0.48))
        k.add(bm_torus(0.075, 0.014, 16, 6), 'mat_iron', T(sx * (CL / 2 + 0.035), 0, 0.4) @ R(0, math.pi / 2, 0))
    # ornate brass Anchor-and-Skull lockplate
    shield = [(-0.15, 0.78), (0.15, 0.78), (0.17, 0.6), (0.13, 0.42), (0.0, 0.33), (-0.13, 0.42), (-0.17, 0.6)]
    k.add(bm_extrude(shield, 0.022, 'XZ'), 'mat_brass', T(0, -CD / 2 - 0.035, 0))
    k.add(bm_sweep([(x, -CD / 2 - 0.048, z) for x, z in shield], circle(0.008, 5), closed_path=True), 'mat_brass')
    k.add(bm_sphere(0.06, 12, 8, 1, 0.45, 1.05), 'mat_iron', T(0, -CD / 2 - 0.05, 0.665))
    k.add(bm_box(0.06, 0.03, 0.03, 0.008, 1), 'mat_iron', T(0, -CD / 2 - 0.055, 0.605))
    for ox in (-0.022, 0.022):
        k.add(bm_sphere(0.014, 8, 5), 'mat_brass', T(ox, -CD / 2 - 0.077, 0.675))
    k.add(bm_box(0.018, 0.02, 0.2, 0.005, 1), 'mat_iron', T(0, -CD / 2 - 0.05, 0.47))
    k.add(bm_box(0.16, 0.02, 0.018, 0.005, 1), 'mat_iron', T(0, -CD / 2 - 0.05, 0.545))
    k.add(bm_torus(0.07, 0.01, 16, 5, arc=math.pi), 'mat_iron', T(0, -CD / 2 - 0.05, 0.43) @ R(math.pi / 2, 0, 0) @ R(0, 0, math.pi))
    for s in (-1, 1):
        k.add(bm_cyl(0.022, 0.0, 0.05, 6), 'mat_iron', T(s * 0.07, -CD / 2 - 0.05, 0.42) @ R(0, s * 0.9, 0))
    k.add(bm_torus(0.02, 0.006, 10, 4), 'mat_iron', T(0, -CD / 2 - 0.05, 0.585) @ R(math.pi / 2, 0, 0))
    # fringed runner
    k.add(bm_box(1.95, 1.4, 0.018, 0.006, 1), 'mat_velvet', T(0, -0.15, 0.009))
    for sx in (-1, 1):
        for i in range(26):
            k.add(bm_cyl(0.005, 0.003, 0.07, 4), 'mat_gold', T(sx * 0.975, -0.83 + i * 1.36 / 25, 0.008) @ R(0, sx * math.pi / 2, 0), smooth=None)
    # stacked gold bullion
    for (dx, lvl) in ((0, 0), (0.21, 0), (-0.21, 0), (0.105, 1), (-0.105, 1), (0.0, 2)):
        for row in (0, 1):
            bm = bm_taper_box(0.2, 0.09, 0.055, 0.78, 0.006)
            k.add(bm, 'mat_gold', T(0.45 + dx, -0.75 - row * 0.1 + lvl * 0.05, 0.045 + lvl * 0.055) @ R(0, 0, math.pi / 2 if lvl == 1 else 0), smooth=30)
    # mounds of spilled doubloons
    for (cx, cy, rad, n) in ((-0.3, -0.82, 0.22, 46), (0.05, -0.62, 0.13, 18), (0.88, -0.35, 0.14, 20)):
        k.add(bm_lathe([(0, 0.0), (rad, 0.0), (rad * 0.6, rad * 0.25), (0.0, rad * 0.42)], 16), 'mat_gold', T(cx, cy, 0.018), smooth=60)
        for i in range(n):
            a = RNG.uniform(0, 2 * math.pi); r = rad * math.sqrt(RNG.random()) * 1.15
            h = max(0.0, rad * 0.42 * (1 - (r / (rad * 1.15)) ** 1.4))
            k.add(bm_cyl(0.034, 0.034, 0.008, 12), 'mat_gold', T(cx + math.cos(a) * r, cy + math.sin(a) * r, 0.02 + h) @ R(RNG.uniform(-0.6, 0.6), RNG.uniform(-0.6, 0.6), 0), smooth=40)
    def gem(loc, mat, s=1.0):
        bm = bm_lathe([(0, -0.045 * s), (0.05 * s, 0.0), (0.036 * s, 0.018 * s), (0, 0.02 * s)], 8)
        k.add(bm, mat, T(*loc) @ R(RNG.uniform(-0.5, 0.5), RNG.uniform(-0.5, 0.5), RNG.uniform(0, 3)), smooth=None)
    for loc in ((-0.18, -0.72, 0.12), (0.12, -0.9, 0.06), (0.78, -0.3, 0.1), (-0.5, -0.6, 0.06)): gem(loc, 'mat_ruby')
    for loc in ((-0.36, -0.95, 0.07), (0.25, -0.62, 0.07), (0.95, -0.45, 0.07), (-0.25, -0.55, 0.1)): gem(loc, 'mat_emerald', 0.9)
    # tied velvet loot pouch
    pb = bm_sphere(0.13, 16, 12)
    for v in pb.verts:
        if v.co.z > 0.02:
            f = 1 - min(1, (v.co.z - 0.02) / 0.11) * 0.72; v.co.x *= f; v.co.y *= f
        if v.co.z < -0.08: v.co.z = -0.08 + (v.co.z + 0.08) * 0.3
    k.add(pb, 'mat_velvet', T(0.92, -0.75, 0.1), smooth=70)
    k.add(bm_lathe([(0.04, 0), (0.07, 0.05), (0.09, 0.07), (0.02, 0.03)], 12), 'mat_velvet', T(0.92, -0.75, 0.21))
    k.add(bm_torus(0.04, 0.009, 12, 5), 'mat_gold', T(0.92, -0.75, 0.21))
    k.add(bm_sweep([(0.96, -0.75, 0.21), (1.0, -0.81, 0.15), (1.02, -0.83, 0.08)], circle(0.006, 5)), 'mat_gold')
    # Propped-open gilded jewel coffer + golden pirate chalice beside the chest
    JC = T(-0.74, -0.72, 0.018) @ R(0, 0, 0.32)
    k.add(bm_box(0.34, 0.24, 0.14, 0.01, 2), 'mat_mahogany', JC @ T(0, 0, 0.07))
    k.add(bm_box(0.355, 0.255, 0.025, 0.006, 1), 'mat_gold', JC @ T(0, 0, 0.135))
    k.add(bm_box(0.30, 0.20, 0.05, 0.01, 1), 'mat_gold', JC @ T(0, 0, 0.13))
    k.add(bm_box(0.34, 0.24, 0.06, 0.01, 2), 'mat_mahogany', JC @ T(0, 0.11, 0.15) @ R(0.62, 0, 0) @ T(0, -0.11, 0.03))
    for gl in ((-0.08, -0.03, 0.16), (0.06, 0.02, 0.165), (0.0, -0.05, 0.17)):
        bm = bm_lathe([(0, -0.03), (0.038, 0.0), (0.028, 0.015), (0, 0.018)], 8)
        k.add(bm, 'mat_ruby' if gl[0] <= 0 else 'mat_emerald', JC @ T(*gl), smooth=None)
    k.add(bm_lathe([(0, 0), (0.065, 0), (0.07, 0.012), (0.024, 0.03), (0.018, 0.09), (0.032, 0.11), (0.068, 0.16), (0.078, 0.23), (0.072, 0.235), (0.055, 0.16), (0, 0.15)], 16), 'mat_gold', T(-0.62, -0.96, 0.018))
    return k

# ================================================================= 9) NAVAL LOGBOOK BOOKCASE + ARMORY RACK
def k_bookcase():
    k = Kit('armory_bookcase_kit')
    BX, BW, BDp, BHt = 0.8, 1.8, 0.45, 2.65
    k.add(bm_box(BW, 0.04, BHt, 0.01, 1), 'mat_mahogany', T(BX, -0.02, BHt / 2))
    for s in (-1, 1):
        k.add(bm_box(0.06, BDp, BHt, 0.012, 2), 'mat_mahogany', T(BX + s * (BW / 2 - 0.03), -BDp / 2, BHt / 2))
        k.add(bm_box(0.1, 0.04, BHt - 0.3, 0.012, 2), 'mat_mahogany', T(BX + s * (BW / 2 - 0.03), -BDp - 0.01, BHt / 2 + 0.05))
    k.add(bm_box(BW + 0.1, BDp + 0.08, 0.12, 0.02, 2), 'mat_mahogany', T(BX, -BDp / 2 - 0.02, 0.06))
    for (dz, ext) in ((0.0, 0.0), (0.08, 0.06), (0.15, 0.12)):
        k.add(bm_box(BW + 0.06 + ext, BDp + 0.04 + ext / 2, 0.08, 0.02, 2), 'mat_mahogany', T(BX, -BDp / 2 - ext / 4, BHt - 0.04 + dz))
    k.add(bm_box(BW + 0.15, 0.012, 0.025), 'mat_gold', T(BX, -BDp - 0.08, BHt + 0.05), smooth=None)
    k.add(bm_box(BW - 0.1, BDp, 0.04, 0.01, 1), 'mat_mahogany', T(BX, -BDp / 2, 0.92))
    for s in (-1, 1):   # paneled lower rum locker
        dx = BX + s * (BW / 4 - 0.015)
        k.add(bm_box(BW / 2 - 0.1, 0.035, 0.74, 0.015, 2), 'mat_mahogany', T(dx, -BDp, 0.52))
        k.add(bm_box(BW / 2 - 0.26, 0.03, 0.52, 0.04, 1), 'mat_mahogany', T(dx, -BDp - 0.025, 0.52))
        k.add(bm_box(BW / 2 - 0.34, 0.01, 0.44), 'mat_gold', T(dx, -BDp - 0.041, 0.52), smooth=None)
        k.add(bm_sphere(0.022, 10, 6), 'mat_gold', T(BX + s * 0.07, -BDp - 0.04, 0.62))
    shelves = [1.0, 1.42, 1.84, 2.26]
    for z in shelves[1:]:
        k.add(bm_box(BW - 0.1, BDp - 0.04, 0.035, 0.008, 1), 'mat_mahogany', T(BX, -BDp / 2, z))
    for z in shelves:   # storm fiddle-rails
        k.add(bm_cyl(0.014, 0.014, BW - 0.12, 8), 'mat_mahogany', T(BX - (BW - 0.12) / 2, -BDp + 0.03, z + 0.12) @ R(0, math.pi / 2, 0))
        for i in range(6):
            x = BX - (BW - 0.12) / 2 + i * (BW - 0.12) / 5
            k.add(bm_lathe([(0.012, 0), (0.016, 0.03), (0.01, 0.07), (0.012, 0.12)], 6), 'mat_mahogany', T(x, -BDp + 0.03, z))
    books = 0
    for si, z in enumerate(shelves):
        x = BX - BW / 2 + 0.09
        xe = {0: BX + BW / 2 - 0.09, 1: BX + BW / 2 - 0.09, 2: BX + 0.3, 3: BX + 0.15}[si]
        cnt = 0
        while x < xe - 0.07:
            th = RNG.uniform(0.04, 0.07); hh = RNG.uniform(0.24, 0.33); dd = RNG.uniform(0.2, 0.26)
            velvet = RNG.random() < 0.22; tint = BOOK_TINTS[RNG.randrange(len(BOOK_TINTS))]
            lean = 0.2 if cnt % 9 == 8 else 0.0
            k.add(bm_box(th, dd, hh, 0.006, 1), 'mat_velvet' if velvet else 'mat_hide', T(x + th / 2, -BDp + 0.06 + dd / 2, z + 0.018 + hh / 2) @ R(0, lean, 0), tint=None if velvet else tint)
            for b in (0.22, 0.78):
                k.add(bm_box(th + 0.003, 0.006, 0.012), 'mat_gold', T(x + th / 2, -BDp + 0.057, z + 0.018 + hh * b), smooth=None)
            x += th + 0.004 + (0.03 if lean else 0); cnt += 1
        books += cnt
    STATS['books'] = books
    z = shelves[2]
    for (ox, h) in ((0.45, 0.2), (0.56, 0.16), (0.66, 0.22)):
        k.add(bm_lathe([(0, 0), (0.045, 0), (0.05, 0.02), (0.05, h * 0.6), (0.02, h * 0.8), (0.015, h), (0, h)], 8), 'mat_glass_green', T(BX + ox, -0.25, z + 0.018), smooth=15)
        k.add(bm_cyl(0.017, 0.014, 0.03, 8), 'mat_leather_brown', T(BX + ox, -0.25, z + 0.018 + h))
    z = shelves[3]
    k.add(bm_sphere(0.1, 14, 10, 0.9, 1.0, 0.95), 'mat_gold', T(BX + 0.4, -0.25, z + 0.13))
    k.add(bm_box(0.12, 0.08, 0.05, 0.02, 2), 'mat_gold', T(BX + 0.4, -0.31, z + 0.05))
    for ox in (-0.035, 0.035):
        k.add(bm_sphere(0.024, 8, 6), 'mat_felt', T(BX + ox + 0.4, -0.335, z + 0.14))
    for (ox, oz) in ((0.58, 0.04), (0.66, 0.04), (0.62, 0.11), (0.74, 0.04)):
        k.add(bm_cyl(0.035, 0.035, 0.34, 12), 'mat_parchment', T(BX + ox, -0.42, z + 0.018 + oz) @ R(-math.pi / 2, 0, 0))
    # wall-mounted pirate armory rack
    RX = -1.0
    k.add(bm_box(1.25, 0.05, 1.55, 0.02, 2), 'mat_mahogany', T(RX, -0.025, 1.65))
    k.add(bm_box(1.35, 0.08, 0.08, 0.02, 2), 'mat_mahogany', T(RX, -0.05, 2.46))
    k.add(bm_box(1.35, 0.08, 0.06, 0.02, 2), 'mat_mahogany', T(RX, -0.05, 0.86))
    for (px, pz) in ((-0.4, 2.2), (0.4, 2.2), (-0.45, 1.25), (0.45, 1.25)):
        k.add(bm_lathe([(0.02, 0), (0.016, 0.06), (0.024, 0.1), (0.0, 0.11)], 8), 'mat_mahogany', T(RX + px, -0.05, pz) @ R(math.pi / 2, 0, 0))
    # musket across the top pegs
    k.add(bm_cyl(0.012, 0.008, 1.15, 10), 'mat_iron', T(RX - 0.57, -0.13, 2.25) @ R(0, math.pi / 2, 0))
    k.add(bm_sweep([(RX + 0.58, -0.13, 2.22), (RX + 0.4, -0.13, 2.23), (RX + 0.1, -0.13, 2.235), (RX - 0.3, -0.13, 2.24)], rect(0.035, 0.05, 0.01), up=(0, 0, 1), scale=lambda t: (1.0, 1.5 - 0.7 * t)), 'mat_mahogany')
    k.add(bm_box(0.04, 0.05, 0.09, 0.01, 1), 'mat_brass', T(RX + 0.6, -0.13, 2.2))
    k.add(bm_box(0.08, 0.015, 0.03, 0.004, 1), 'mat_iron', T(RX + 0.12, -0.16, 2.24))
    # crossed curved basket-hilt cutlasses
    for s in (-1, 1):
        cut = T(RX + s * 0.2, -0.12, 1.85) @ R(0, s * 0.55, 0)
        bp = [(0.13 * (t ** 2), 0, -0.78 * t) for t in [i / 14 for i in range(15)]]
        k.add(bm_sweep(bp, [(-0.022, 0), (0, 0.003), (0.022, 0), (0, -0.003)], up=(1, 0, 0), scale=lambda t: 1.0 - 0.75 * t ** 2), 'mat_iron', cut, smooth=30)
        k.add(bm_lathe([(0.014, 0.0), (0.018, 0.05), (0.014, 0.12)], 10), 'mat_leather_brown', cut)
        k.add(bm_sphere(0.022, 10, 6), 'mat_gold', cut @ T(0, 0, 0.13))
        for a in (-0.5, 0.0, 0.5):
            k.add(bm_torus(0.075, 0.006, 16, 4, arc=math.pi), 'mat_gold', cut @ T(0, 0, 0.04) @ R(0, 0, a) @ R(math.pi / 2, 0, 0) @ R(0, 0, -math.pi / 2))
        k.add(bm_box(0.17, 0.02, 0.02, 0.006, 1), 'mat_gold', cut @ T(0, 0, -0.005))
    # brass-mounted flintlock pistols
    for s in (-1, 1):
        P = T(RX + s * 0.3, -0.1, 1.12)
        k.add(bm_cyl(0.011, 0.012, 0.3, 10), 'mat_iron', P @ T(-s * 0.02, 0, 0.0) @ R(0, -s * math.pi / 2, 0))
        gp = [(-s * 0.03, 0, 0.0), (s * 0.06, 0, 0.0), (s * 0.13, 0, -0.04), (s * 0.17, 0, -0.12)]
        k.add(bm_sweep(gp, rect(0.03, 0.035, 0.008), up=(0, 1, 0), scale=lambda t: (1.0 + 0.5 * t, 1.0 + 0.5 * t)), 'mat_mahogany', P)
        k.add(bm_sphere(0.03, 10, 6, 1, 0.8, 1), 'mat_brass', P @ T(s * 0.175, 0, -0.14))
        k.add(bm_torus(0.03, 0.005, 12, 4, arc=math.pi), 'mat_brass', P @ T(s * 0.07, 0, -0.03) @ R(math.pi / 2, 0, 0) @ R(0, 0, math.pi))
        k.add(bm_box(0.06, 0.02, 0.03, 0.004, 1), 'mat_iron', P @ T(s * 0.04, -0.02, 0.01))
        k.add(bm_box(0.012, 0.01, 0.04, 0.003, 1), 'mat_iron', P @ T(s * 0.03, -0.03, 0.04) @ R(0, s * 0.4, 0))
    return k

# ================================================================= 10) RUM CASKS + SHOT GARLAND + STORES
def k_rum():
    k = Kit('rum_cargo_kit')
    def barrel(M, L=0.86, r=0.31, hoops=(0.08, 0.2, 0.8, 0.92)):
        prof = [(r * 0.86, 0.0), (r * 0.93, 0.12), (r * 0.99, 0.3), (r, 0.5), (r * 0.99, 0.7), (r * 0.93, 0.88), (r * 0.86, 1.0)]
        k.add(bm_lathe([(rr, z * L) for rr, z in prof], 24, axis_caps=False), 'mat_oak_dark', M, smooth=30)
        for z in (0.03, L - 0.042):
            k.add(bm_cyl(r * 0.8, r * 0.8, 0.012, 24), 'mat_oak_dark', M @ T(0, 0, z))
        for hz in hoops:
            rr = r * (0.86 + 0.14 * math.sin(math.pi * hz) ** 0.7) + 0.006
            k.add(bm_torus(rr, 0.012, 28, 4), 'mat_iron', M @ T(0, 0, hz * L) @ S(1, 1, 2.0), smooth=30)
    for bx in (-0.42, 0.24):
        barrel(T(bx, -0.02, 0.43) @ R(math.pi / 2, 0, 0))     # lying, head faces the room (-Y)
        k.add(bm_lathe([(0.02, 0), (0.022, 0.06), (0.012, 0.07)], 8), 'mat_brass', T(bx, -0.88, 0.3) @ R(math.pi / 2, 0, 0))
        k.add(bm_cyl(0.008, 0.008, 0.07, 6), 'mat_brass', T(bx, -0.93, 0.27))
        k.add(bm_box(0.05, 0.012, 0.012, 0.003, 1), 'mat_brass', T(bx, -0.94, 0.33))
        for yy in (-0.25, -0.68):
            k.add(bm_torus(0.322, 0.02, 26, 6), 'mat_rope', T(bx, yy, 0.43) @ R(math.pi / 2, 0, 0))
    for y in (-0.2, -0.72):
        k.add(bm_box(1.3, 0.12, 0.1, 0.012, 1), 'mat_oak_dark', T(-0.09, y, 0.05))
        for bx in (-0.42, 0.24):
            for s in (-1, 1):
                k.add(bm_box(0.1, 0.12, 0.12, 0.01, 1), 'mat_oak_dark', T(bx + s * 0.22, y, 0.14) @ R(0, s * 0.6, 0))
    # gunpowder keg
    k.add(bm_lathe([(0.17, 0), (0.19, 0.1), (0.2, 0.2), (0.19, 0.3), (0.17, 0.4)], 18), 'mat_oak_dark', T(0.78, -0.25, 0.0), smooth=30)
    for hz in (0.05, 0.35):
        k.add(bm_torus(0.185, 0.01, 22, 4), 'mat_iron', T(0.78, -0.25, hz) @ S(1, 1, 2))
    # wooden shot-garland rack with stacked iron cannonballs
    k.add(bm_box(0.48, 0.34, 0.06, 0.012, 1), 'mat_oak_dark', T(0.72, -0.75, 0.03))
    for s in (-1, 1):
        k.add(bm_box(0.48, 0.03, 0.09, 0.008, 1), 'mat_oak_dark', T(0.72, -0.75 + s * 0.16, 0.08))
    cb = 0.072
    for (ix, iy, lvl) in [(i, j, 0) for i in range(3) for j in range(2)] + [(0.5, 0.5, 1), (1.5, 0.5, 1)]:
        k.add(bm_sphere(cb, 14, 10), 'mat_iron', T(0.72 - 0.15 + ix * 0.15, -0.75 - 0.075 + iy * 0.15, 0.06 + cb + lvl * cb * 1.35), smooth=70)
    # coiled hemp hawser
    coil = []
    for i in range(140):
        t = i / 139; a = t * 3.6 * 2 * math.pi; r = 0.08 + 0.2 * t
        coil.append((-0.25 + math.cos(a) * r, -1.05 + math.sin(a) * r, 0.028))
    k.add(bm_sweep(coil, circle(0.026, 8)), 'mat_rope', None, smooth=70)
    k.add(bm_torus(0.24, 0.026, 26, 8), 'mat_rope', T(-0.25, -1.05, 0.075))
    # pewter mug under the spigot
    k.add(bm_lathe([(0, 0), (0.05, 0), (0.052, 0.01), (0.044, 0.11), (0.048, 0.12), (0.04, 0.12), (0.035, 0.015), (0, 0.015)], 12), 'mat_iron', T(0.24, -0.96, 0.0))
    k.add(bm_torus(0.035, 0.008, 10, 4, arc=math.pi), 'mat_iron', T(0.29, -0.96, 0.065) @ R(math.pi / 2, 0, 0) @ R(0, 0, -math.pi / 2))
    return k

# ================================================================= 11) COMPANIONWAY DOOR (+ ship's bell + peg rack)
def k_door():
    k = Kit('companionway_door_kit')
    DW, DH = 1.3, 2.08
    for s in (-1, 1):
        k.add(bm_box(0.26, 0.3, DH + 0.42, 0.025, 2), 'mat_mahogany', T(s * (DW / 2 + 0.13), 0.0, (DH + 0.42) / 2))
    k.add(bm_box(DW + 0.62, 0.34, 0.3, 0.03, 2), 'mat_mahogany', T(0, -0.02, DH + 0.4))
    k.add(bm_box(DW + 0.72, 0.38, 0.07, 0.02, 2), 'mat_mahogany', T(0, -0.04, DH + 0.58))
    k.add(bm_box(DW + 0.1, 0.34, 0.22, 0.03, 2), 'mat_mahogany', T(0, -0.02, 0.11))
    k.add(bm_box(DW + 0.1, 0.012, 0.025), 'mat_brass', T(0, -0.19, 0.21), smooth=None)
    k.add(bm_box(DW, 0.09, DH - 0.18, 0.012, 2), 'mat_mahogany', T(0, 0.0, 0.22 + (DH - 0.18) / 2))
    z0 = 0.22
    for (x, zc, w, h) in ((-0.31, z0 + 0.45, 0.48, 0.62), (0.31, z0 + 0.45, 0.48, 0.62), (-0.31, z0 + 1.15, 0.48, 0.5), (0.31, z0 + 1.15, 0.48, 0.5)):
        k.add(bm_box(w, 0.04, h, 0.04, 1), 'mat_mahogany', T(x, -0.055, zc))
    k.add(bm_box(1.1, 0.03, 0.42, 0.03, 1), 'mat_mahogany', T(0, -0.05, z0 + 1.65))
    toY = R(math.pi / 2, 0, 0)
    pc = T(0, -0.075, z0 + 1.65)
    k.add(bm_lathe([(0.12, 0.0), (0.18, 0.0), (0.18, 0.02), (0.16, 0.04), (0.13, 0.045), (0.12, 0.045)], 24, closed=True), 'mat_brass', pc @ toY)
    k.add(bm_cyl(0.125, 0.125, 0.006, 20), 'mat_glass', pc @ T(0, -0.01, 0) @ toY, smooth=None)
    k.add(bm_cyl(0.124, 0.124, 0.004, 20), 'mat_ocean_view', pc @ T(0, 0.03, 0) @ toY, smooth=None, uv='planar_xz')
    for i in range(6):
        a = 2 * math.pi * i / 6
        hex_bolt(k, (math.cos(a) * 0.155, -0.1, z0 + 1.65 + math.sin(a) * 0.155), (0, -1, 0), 0.013, 'mat_brass')
    for z in (0.55, 1.85):   # forged brass strap hinges
        k.add(bm_sweep([(-DW / 2 + 0.02, -0.06, z), (-DW / 2 + 0.6, -0.06, z)], rect(0.012, 0.09, 0.003), up=(0, 1, 0), scale=lambda t: (1.0, 1.0 - 0.55 * t)), 'mat_brass')
        k.add(bm_sphere(0.03, 10, 6, 1, 0.6, 1), 'mat_brass', T(-DW / 2 + 0.6, -0.065, z))
        for j in range(4): rivet(k, (-DW / 2 + 0.1 + j * 0.14, -0.068, z), (0, -1, 0), 0.012, 'mat_brass')
        k.add(bm_cyl(0.028, 0.028, 0.2, 10), 'mat_brass', T(-DW / 2 - 0.01, -0.06, z - 0.1))
    k.add(bm_cyl(0.06, 0.06, 0.015, 16), 'mat_brass', T(DW / 2 - 0.16, -0.045, z0 + 0.88) @ toY)
    k.add(bm_torus(0.06, 0.011, 18, 6), 'mat_brass', T(DW / 2 - 0.16, -0.085, z0 + 0.82) @ R(0.2, 0, 0) @ toY)
    k.add(bm_box(0.06, 0.03, 0.12, 0.01, 1), 'mat_iron', T(DW / 2 - 0.16, -0.06, z0 + 1.02))
    # braided coir deck mat
    k.add(bm_box(1.25, 0.8, 0.025, 0.01, 1), 'mat_rope', T(0, -0.62, 0.0125))
    ed = []
    for i in range(60):
        t = i / 60 * 2 * math.pi
        ed.append((math.copysign(abs(math.cos(t)) ** 0.25, math.cos(t)) * 0.62, -0.62 + math.copysign(abs(math.sin(t)) ** 0.25, math.sin(t)) * 0.39, 0.025))
    k.add(bm_sweep(ed, circle(0.022, 6), closed_path=True), 'mat_rope', None, smooth=70)
    # ship's brass bell on a scrolled bracket
    bx = -(DW / 2 + 0.75)   # kit is yawed PI in the room: local -x = starboard of the door
    k.add(bm_box(0.12, 0.04, 0.22, 0.01, 1), 'mat_iron', T(bx, -0.02, 2.0))
    k.add(bm_sweep([(bx, -0.04, 2.05), (bx, -0.18, 2.08), (bx, -0.3, 2.04)], rect(0.025, 0.03, 0.006), up=(1, 0, 0)), 'mat_iron')
    k.add(bm_torus(0.05, 0.01, 12, 5, arc=1.5 * math.pi), 'mat_iron', T(bx, -0.12, 1.98) @ R(0, math.pi / 2, 0))
    k.add(bm_lathe([(0.0, 0.0), (0.03, 0.0), (0.035, -0.02), (0.06, -0.05), (0.075, -0.12), (0.09, -0.2), (0.12, -0.24), (0.115, -0.25), (0.08, -0.22), (0.0, -0.21)], 20), 'mat_brass', T(bx, -0.3, 2.02))
    k.add(bm_torus(0.02, 0.006, 10, 4), 'mat_brass', T(bx, -0.3, 2.03) @ R(math.pi / 2, 0, 0))
    k.add(bm_sphere(0.022, 10, 6), 'mat_iron', T(bx, -0.3, 1.76))
    k.add(bm_sweep([(bx, -0.3, 1.76), (bx + 0.01, -0.31, 1.55), (bx - 0.01, -0.3, 1.38)], circle(0.012, 6)), 'mat_rope')
    k.add(bm_sphere(0.03, 10, 6), 'mat_rope', T(bx - 0.01, -0.3, 1.36))
    # carved peg rack + tricorn hat + captain's sash
    px = DW / 2 + 0.85
    k.add(bm_box(0.9, 0.04, 0.16, 0.012, 2), 'mat_mahogany', T(px, -0.02, 1.75))
    k.add(bm_box(0.94, 0.06, 0.03, 0.01, 1), 'mat_mahogany', T(px, -0.03, 1.845))
    for i in range(4):
        k.add(bm_lathe([(0.022, 0), (0.016, 0.05), (0.026, 0.1), (0.018, 0.13), (0.03, 0.15), (0.0, 0.17)], 10), 'mat_mahogany', T(px - 0.33 + i * 0.22, -0.04, 1.73) @ R(math.pi / 2 + 0.25, 0, 0))
    hat = T(px - 0.11, -0.2, 1.62) @ R(1.25, 0, 0)
    k.add(bm_lathe([(0, 0.0), (0.09, 0.0), (0.1, 0.06), (0.09, 0.11), (0.0, 0.13)], 16), 'mat_felt', hat)
    def brim(u, v):
        a = u * 2 * math.pi; r = 0.09 + 0.12 * v
        return (math.cos(a) * r, math.sin(a) * r, 0.09 * v ** 1.4 * (0.5 + 0.5 * math.cos(3 * a + math.pi)) + 0.01 * v)
    k.add(bm_grid(brim, 36, 4), 'mat_felt', hat, smooth=70, uv='keep')
    sx_ = px + 0.33
    k.add(bm_grid(lambda u, v: (sx_ - 0.07 + 0.14 * u + 0.03 * math.sin(v * 3), -0.07 - 0.03 * math.sin(v * 4 + u * 2) - 0.04 * v, 1.72 - 0.95 * v), 4, 18), 'mat_velvet', None, smooth=70, uv='keep')
    for i in range(8):
        k.add(bm_cyl(0.004, 0.003, 0.08, 4), 'mat_brass', T(sx_ - 0.065 + i * 0.019 + 0.03 * math.sin(3), -0.11 - 0.03 * math.sin(4), 0.69), smooth=None)
    return k

# ---------------------------------------------------------------- build + export

# ================================================================= 12) HULL WAINSCOT PANELING BAY (instanced in all 8 wall bays)
def k_wainscot():
    k = Kit('wainscot_bay_kit')
    BW = 1.96
    # Curved ship waterway base + dado rail + upper sheer molding following f_in(z)
    k.add(bm_box(BW, 0.22, 0.15, 0.018, 2), 'mat_oak_dark', T(0, -0.10, 0.075))
    k.add(bm_box(BW - 0.1, 0.02, 0.03), 'mat_brass', T(0, -0.21, 0.12), smooth=None)
    zd = 1.16; yd = -f_in(zd)
    k.add(bm_box(BW, 0.05, 0.98, 0.008, 1), 'mat_mahogany', T(0, yd * 0.5 - 0.025, 0.64))
    k.add(bm_box(BW + 0.02, 0.11, 0.085, 0.016, 2), 'mat_mahogany', T(0, yd - 0.045, zd))
    k.add(bm_box(BW, 0.014, 0.022), 'mat_gold', T(0, yd - 0.102, zd), smooth=None)
    pw = (BW - 0.24) / 3
    for i in range(3):
        cx = -BW / 2 + 0.12 + pw / 2 + i * pw
        k.add(bm_box(pw - 0.08, 0.032, 0.68, 0.022, 1), 'mat_mahogany', T(cx, yd * 0.5 - 0.055, 0.64))
        k.add(bm_box(pw - 0.16, 0.01, 0.58), 'mat_gold', T(cx, yd * 0.5 - 0.073, 0.64), smooth=None)
    # Upper sheer clamp & gilded frieze strip under deck-head
    zt = RH - 0.14; yt = -f_in(zt)
    k.add(bm_box(BW, 0.12, 0.18, 0.018, 2), 'mat_oak_dark', T(0, yt - 0.05, zt))
    k.add(bm_box(BW, 0.016, 0.028), 'mat_gold', T(0, yt - 0.112, zt - 0.05), smooth=None)
    for ox in (-0.68, 0.0, 0.68):
        hex_bolt(k, (ox, yt - 0.112, zt + 0.02), (0, -1, 0), 0.016, 'mat_brass')
    return k

# ================================================================= 13) ADMIRAL'S NAVIGATOR BUREAU + BRASS TRIPOD SPYGLASS
def k_bureau():
    k = Kit('navigator_bureau_kit')
    BW, BDp, DHt, HHt = 1.42, 0.62, 0.80, 2.08
    # Lower chest of 3 drawers with bracket feet
    k.add(bm_box(BW, BDp, DHt - 0.08, 0.016, 2), 'mat_mahogany', T(0, -BDp / 2, 0.08 + (DHt - 0.08) / 2))
    k.add(bm_box(BW + 0.06, BDp + 0.05, 0.06, 0.016, 2), 'mat_mahogany', T(0, -BDp / 2 - 0.01, 0.06))
    for sx in (-1, 1):
        for sy in (-0.08, -BDp + 0.06):
            k.add(bm_box(0.14, 0.10, 0.08, 0.014, 1), 'mat_mahogany', T(sx * (BW / 2 - 0.06), sy, 0.04))
    for di, zc in enumerate((0.21, 0.43, 0.65)):
        k.add(bm_box(BW - 0.12, 0.032, 0.18, 0.014, 2), 'mat_mahogany', T(0, -BDp - 0.01, zc))
        k.add(bm_box(BW - 0.24, 0.01, 0.12), 'mat_gold', T(0, -BDp - 0.028, zc), smooth=None)
        for ox in (-0.34, 0.34):
            k.add(bm_torus(0.042, 0.007, 12, 4, arc=math.pi), 'mat_brass', T(ox, -BDp - 0.036, zc) @ R(math.pi / 2, 0, 0) @ R(0, 0, math.pi))
            k.add(bm_sphere(0.014, 8, 5), 'mat_brass', T(ox - 0.042, -BDp - 0.03, zc))
            k.add(bm_sphere(0.014, 8, 5), 'mat_brass', T(ox + 0.042, -BDp - 0.03, zc))
        k.add(bm_box(0.035, 0.012, 0.05, 0.004, 1), 'mat_gold', T(0, -BDp - 0.03, zc + 0.02))
    # Open writing desktop + green/dark baize blotter + open captain's log + quill & inkwell + wax seal
    WT = 0.78
    k.add(bm_box(BW + 0.04, BDp + 0.24, 0.045, 0.014, 2), 'mat_mahogany', T(0, -(BDp + 0.24) / 2, DHt))
    k.add(bm_box(0.76, 0.36, 0.008, 0.003, 1), 'mat_felt', T(-0.08, -0.58, DHt + 0.026))
    for s in (-1, 1):
        k.add(bm_grid(lambda u, v, s=s: (-0.08 + s * (0.01 + 0.21 * u), -0.72 + 0.28 * v, DHt + 0.034 + 0.018 * math.sin(u * math.pi)), 8, 6), 'mat_parchment', None, smooth=70, uv='keep')
    k.add(bm_box(0.46, 0.30, 0.014, 0.004, 1), 'mat_leather_brown', T(-0.08, -0.58, DHt + 0.031))
    # Brass inkwell + curved white quill feather + crimson wax seal
    k.add(bm_lathe([(0, 0), (0.038, 0), (0.04, 0.015), (0.028, 0.035), (0.032, 0.045), (0, 0.045)], 14), 'mat_brass', T(0.36, -0.62, DHt + 0.023))
    qp = [(0.36 + 0.06 * t, -0.62 - 0.03 * t, DHt + 0.055 + 0.22 * t - 0.04 * t * t) for t in [i / 10 for i in range(11)]]
    k.add(bm_sweep(qp, circle(0.006, 5), scale=lambda t: (0.4 + 1.8 * math.sin(math.pi * t ** 0.7), 0.35)), 'mat_linen')
    k.add(bm_cyl(0.022, 0.024, 0.006, 12), 'mat_velvet', T(0.24, -0.70, DHt + 0.03))
    # Upper curio & chart hutch with broken-pediment crown
    HDp = 0.36
    k.add(bm_box(BW - 0.04, 0.035, HHt - DHt, 0.008, 1), 'mat_mahogany', T(0, -0.02, (DHt + HHt) / 2))
    for s in (-1, 1):
        k.add(bm_box(0.055, HDp, HHt - DHt, 0.012, 2), 'mat_mahogany', T(s * (BW / 2 - 0.045), -HDp / 2, (DHt + HHt) / 2))
    for zs in (1.16, 1.56, 1.98):
        k.add(bm_box(BW - 0.10, HDp - 0.02, 0.032, 0.008, 1), 'mat_mahogany', T(0, -HDp / 2, zs))
        k.add(bm_cyl(0.011, 0.011, BW - 0.14, 8), 'mat_brass', T(-(BW - 0.14) / 2, -HDp + 0.03, zs + 0.08) @ R(0, math.pi / 2, 0))
    # Cubbyhole dividers + rolled charts
    for i in range(5):
        cx = -0.52 + i * 0.26
        k.add(bm_box(0.02, HDp - 0.05, 0.34, 0.004, 1), 'mat_mahogany', T(cx, -HDp / 2, 0.99))
        if i < 4:
            k.add(bm_cyl(0.028, 0.028, 0.32, 12), 'mat_parchment', T(cx + 0.13, -0.34, 0.88) @ R(-math.pi / 2, 0, 0.08 * (i - 1.5)))
    # Pediment crown + gilded urn finial
    k.add(bm_box(BW + 0.08, HDp + 0.08, 0.09, 0.02, 2), 'mat_mahogany', T(0, -HDp / 2 - 0.02, HHt + 0.04))
    for s in (-1, 1):
        k.add(bm_box(0.54, HDp + 0.04, 0.07, 0.015, 1), 'mat_mahogany', T(s * 0.38, -HDp / 2 - 0.01, HHt + 0.14) @ R(0, -s * 0.26, 0))
    k.add(bm_lathe([(0, 0), (0.055, 0.02), (0.035, 0.07), (0.065, 0.14), (0.03, 0.21), (0, 0.25)], 14), 'mat_gold', T(0, -HDp / 2 - 0.02, HHt + 0.08))
    # 3D Brass Armillary Sphere on shelf
    ax, ay, az = -0.36, -0.20, 1.58
    k.add(bm_lathe([(0, 0), (0.075, 0), (0.08, 0.015), (0.03, 0.04), (0.022, 0.09), (0, 0.09)], 14), 'mat_mahogany', T(ax, ay, az))
    for rx, ry, rz, rr in ((0.35, 0, 0, 0.115), (0.35, math.pi / 2, 0, 0.11), (1.2, 0.4, 0, 0.105), (math.pi / 2, 0, 0, 0.12)):
        k.add(bm_torus(rr, 0.006, 24, 5), 'mat_brass', T(ax, ay, az + 0.21) @ R(rx, ry, rz))
    k.add(bm_sphere(0.028, 12, 8), 'mat_gold', T(ax, ay, az + 0.21))
    # Turned Mahogany & Glass Sand Hourglass + Naval Books on shelf
    hx, hy, hz = 0.40, -0.20, 1.58
    for dz in (0.0, 0.25):
        k.add(bm_cyl(0.065, 0.065, 0.018, 14), 'mat_mahogany', T(hx, hy, hz + dz))
    for a in (0, 2.09, 4.19):
        k.add(bm_cyl(0.007, 0.007, 0.25, 6), 'mat_brass', T(hx + math.cos(a) * 0.052, hy + math.sin(a) * 0.052, hz + 0.01))
    k.add(bm_lathe([(0, 0.02), (0.046, 0.04), (0.042, 0.09), (0.008, 0.132), (0.042, 0.175), (0.046, 0.225), (0, 0.245)], 14), 'mat_glass', T(hx, hy, hz))
    k.add(bm_lathe([(0, 0.024), (0.038, 0.042), (0.0, 0.095)], 12), 'mat_parchment', T(hx, hy, hz))
    for bi in range(6):
        k.add(bm_box(0.048, 0.22, 0.27, 0.006, 1), 'mat_hide', T(-0.08 + bi * 0.052, -0.20, 1.18 + 0.135), tint=BOOK_TINTS[bi % len(BOOK_TINTS)])
    # Floor-standing Brass Spyglass Telescope on 3-Legged Mahogany & Brass Tripod (aimed toward stern gallery!)
    tx, ty = 1.18, -0.92
    THt = 1.24
    k.add(bm_lathe([(0.045, 0), (0.055, 0.04), (0.04, 0.10), (0, 0.11)], 14), 'mat_brass', T(tx, ty, THt))
    for i in range(3):
        a = 2 * math.pi * i / 3 + 0.35
        fx, fy = tx + math.cos(a) * 0.42, ty + math.sin(a) * 0.42
        k.add(bm_sweep([(tx + math.cos(a) * 0.035, ty + math.sin(a) * 0.035, THt + 0.02), (fx, fy, 0.02)], rect(0.032, 0.038, 0.006), scale=lambda t: 1.0 - 0.38 * t), 'mat_mahogany')
        k.add(bm_cyl(0.016, 0.006, 0.06, 8), 'mat_brass', T(fx, fy, 0.0))
        k.add(bm_cyl(0.007, 0.007, 0.22, 6), 'mat_brass', T(tx, ty, THt - 0.36) @ R(0, 0, a) @ R(0, math.pi / 2, 0))
    tel = T(tx, ty, THt + 0.13) @ R(0, 0, 0.48) @ R(0, math.radians(82), 0) @ T(0, 0, -0.45)
    k.add(bm_lathe([(0.022, 0.0), (0.026, 0.03), (0.024, 0.25), (0.032, 0.26), (0.032, 0.58), (0.042, 0.59), (0.044, 0.92), (0.050, 0.95), (0.046, 0.96), (0.0, 0.95)], 18), 'mat_brass', tel)
    k.add(bm_cyl(0.035, 0.035, 0.28, 16), 'mat_leather_brown', tel @ T(0, 0, 0.28))
    k.add(bm_cyl(0.042, 0.042, 0.008, 16), 'mat_glass', tel @ T(0, 0, 0.952), smooth=None)
    return k

# ================================================================= 14) OFFICER'S TROPHY CREDENZA + HERALDIC CREST SHIELD
def k_credenza():
    k = Kit('trophy_credenza_kit')
    CW, CDp, CHt = 1.66, 0.50, 0.94
    k.add(bm_box(CW, CDp, CHt - 0.10, 0.016, 2), 'mat_mahogany', T(0, -CDp / 2, 0.08 + (CHt - 0.10) / 2))
    k.add(bm_box(CW + 0.08, CDp + 0.06, 0.055, 0.016, 2), 'mat_mahogany', T(0, -CDp / 2 - 0.015, CHt))
    k.add(bm_box(CW + 0.06, CDp + 0.05, 0.08, 0.016, 2), 'mat_mahogany', T(0, -CDp / 2 - 0.01, 0.04))
    # Brass storm gallery rail around top
    for sx in (-1, 1):
        k.add(bm_cyl(0.01, 0.01, CDp - 0.04, 8), 'mat_brass', T(sx * (CW / 2 - 0.02), -0.04, CHt + 0.075) @ R(math.pi / 2, 0, 0))
    k.add(bm_cyl(0.01, 0.01, CW - 0.04, 8), 'mat_brass', T(-(CW - 0.04) / 2, -0.04, CHt + 0.075) @ R(0, math.pi / 2, 0))
    for i in range(6):
        ox = -(CW - 0.08) / 2 + i * (CW - 0.08) / 5
        k.add(bm_cyl(0.008, 0.008, 0.055, 6), 'mat_brass', T(ox, -0.04, CHt + 0.025))
    # 3 raised-panel cabinet doors with brass lion-ring pulls + fluted pilasters
    for i in range(4):
        px = -CW / 2 + 0.04 + i * (CW - 0.08) / 3
        k.add(bm_box(0.065, 0.04, CHt - 0.14, 0.01, 1), 'mat_mahogany', T(px, -CDp - 0.01, 0.50))
        k.add(bm_box(0.03, 0.012, CHt - 0.24), 'mat_gold', T(px, -CDp - 0.031, 0.50), smooth=None)
    dw = (CW - 0.22) / 3
    for i in range(3):
        cx = -CW / 2 + 0.11 + dw / 2 + i * dw
        k.add(bm_box(dw - 0.06, 0.03, 0.62, 0.018, 2), 'mat_mahogany', T(cx, -CDp - 0.01, 0.48))
        k.add(bm_box(dw - 0.16, 0.012, 0.48), 'mat_gold', T(cx, -CDp - 0.027, 0.48), smooth=None)
        k.add(bm_sphere(0.026, 10, 6, 1, 0.5, 1), 'mat_gold', T(cx, -CDp - 0.032, 0.52))
        k.add(bm_torus(0.034, 0.007, 12, 5), 'mat_gold', T(cx, -CDp - 0.04, 0.485) @ R(math.pi / 2, 0, 0))
    # Top props: gilded serving tray + emerald rum decanter + 4 golden goblets + brass binnacle hood + treasure coffer
    ZT = CHt + 0.028
    k.add(bm_cyl(0.22, 0.20, 0.018, 22), 'mat_gold', T(-0.42, -0.26, ZT))
    k.add(bm_torus(0.215, 0.012, 22, 5), 'mat_gold', T(-0.42, -0.26, ZT + 0.018))
    k.add(bm_lathe([(0, 0), (0.065, 0), (0.085, 0.04), (0.08, 0.15), (0.026, 0.22), (0.022, 0.29), (0.032, 0.31), (0, 0.31)], 10), 'mat_glass_green', T(-0.42, -0.24, ZT + 0.018), smooth=20)
    k.add(bm_sphere(0.024, 10, 8), 'mat_gold', T(-0.42, -0.24, ZT + 0.34))
    for gx, gy in ((-0.56, -0.32), (-0.28, -0.32), (-0.54, -0.16), (-0.30, -0.16)):
        k.add(bm_lathe([(0, 0), (0.032, 0), (0.012, 0.015), (0.01, 0.055), (0.034, 0.085), (0.038, 0.125), (0.032, 0.125), (0, 0.08)], 12), 'mat_gold', T(gx, gy, ZT + 0.018))
    # Ship's brass binnacle compass hood
    k.add(bm_cyl(0.11, 0.125, 0.08, 18), 'mat_mahogany', T(0.08, -0.26, ZT))
    k.add(bm_lathe([(0.105, 0), (0.11, 0.10), (0.095, 0.16), (0.055, 0.21), (0, 0.23)], 18), 'mat_brass', T(0.08, -0.26, ZT + 0.08))
    k.add(bm_cyl(0.065, 0.065, 0.012, 16), 'mat_glass', T(0.08, -0.365, ZT + 0.15) @ R(math.pi / 2, 0, 0), smooth=None)
    for s in (-1, 1):
        k.add(bm_sphere(0.042, 12, 8), 'mat_iron' if s < 0 else 'mat_velvet', T(0.08 + s * 0.155, -0.26, ZT + 0.14))
        k.add(bm_box(0.04, 0.03, 0.10, 0.006, 1), 'mat_brass', T(0.08 + s * 0.135, -0.26, ZT + 0.08))
    # Leather & brass dispatch coffer
    k.add(bm_box(0.36, 0.24, 0.16, 0.014, 2), 'mat_leather', T(0.52, -0.26, ZT + 0.08))
    for ox in (-0.12, 0.12):
        k.add(bm_box(0.035, 0.255, 0.17, 0.005, 1), 'mat_gold', T(0.52 + ox, -0.26, ZT + 0.082))
    # Wall-mounted Heraldic Trophy Shield + Crossed Gilded Cutlasses + Anchor above credenza
    SZ = 1.92
    sh_poly = [(-0.34, SZ + 0.42), (0.34, SZ + 0.42), (0.38, SZ + 0.10), (0.26, SZ - 0.22), (0.0, SZ - 0.44), (-0.26, SZ - 0.22), (-0.38, SZ + 0.10)]
    k.add(bm_extrude(sh_poly, 0.045, 'XZ'), 'mat_mahogany', T(0, -0.03, 0))
    in_poly = [(x * 0.84, SZ + (z - SZ) * 0.84) for x, z in sh_poly]
    k.add(bm_extrude(in_poly, 0.025, 'XZ'), 'mat_velvet', T(0, -0.055, 0))
    k.add(bm_sweep([(x, -0.058, z) for x, z in sh_poly], circle(0.016, 6), closed_path=True), 'mat_gold')
    # Crossed cutlasses behind shield
    for s in (-1, 1):
        cut = T(s * 0.26, -0.02, SZ + 0.28) @ R(0, s * 0.68, 0)
        bp = [(0.14 * (t ** 2), 0, -1.08 * t) for t in [i / 14 for i in range(15)]]
        k.add(bm_sweep(bp, [(-0.026, 0), (0, 0.004), (0.026, 0), (0, -0.004)], up=(1, 0, 0), scale=lambda t: 1.0 - 0.72 * t ** 2), 'mat_iron', cut, smooth=30)
        k.add(bm_lathe([(0.018, 0), (0.024, 0.06), (0.018, 0.15)], 10), 'mat_leather_brown', cut)
        k.add(bm_sphere(0.028, 10, 6), 'mat_gold', cut @ T(0, 0, 0.165))
        k.add(bm_torus(0.085, 0.008, 16, 4, arc=math.pi), 'mat_gold', cut @ T(0, 0, 0.05) @ R(math.pi / 2, 0, 0) @ R(0, 0, -math.pi / 2))
    # Golden anchor emblem on shield center
    k.add(bm_torus(0.055, 0.012, 16, 5), 'mat_gold', T(0, -0.08, SZ + 0.22) @ R(math.pi / 2, 0, 0))
    k.add(bm_box(0.032, 0.025, 0.42, 0.006, 1), 'mat_gold', T(0, -0.08, SZ - 0.02))
    k.add(bm_box(0.28, 0.025, 0.032, 0.006, 1), 'mat_gold', T(0, -0.08, SZ + 0.12))
    k.add(bm_torus(0.14, 0.016, 18, 5, arc=math.pi), 'mat_gold', T(0, -0.08, SZ - 0.14) @ R(math.pi / 2, 0, 0) @ R(0, 0, math.pi))
    return k

# ================================================================= 15) PARROT ALCOVE (built-in brass birdcage in a panelled niche, port wall by the door)
#   Wall kit (back on the hull plane, faces -Y). The cage axis sits CAGE_OUT in front of the wall; the bird
#   (js/dock/parrotCage.js, CAGE_SPOT) perches at z 1.28 - 1.86 inside the bars.
CAGE_OUT = 0.84
def _lean(z0, z1, out=0.0):
    zm = (z0 + z1) / 2; a = math.atan((f_in(z1) - f_in(z0)) / max(1e-6, z1 - z0))
    return T(0, -(f_in(z0) + f_in(z1)) / 2 - out, zm) @ R(a, 0, 0)
def k_parrot():
    k = Kit('parrot_alcove_kit')
    BW = 1.96
    # --- the bay's own wainscot (waterway, dado panels, rail) so the alcove reads as part of the panelling
    k.add(bm_box(BW, 0.22, 0.15, 0.018, 2), 'mat_oak_dark', T(0, -0.10, 0.075))
    k.add(bm_box(BW - 0.1, 0.02, 0.03), 'mat_brass', T(0, -0.21, 0.12), smooth=None)
    zd = 1.16; yd = -f_in(zd)
    k.add(bm_box(BW, 0.05, 0.98, 0.008, 1), 'mat_mahogany', T(0, yd * 0.5 - 0.025, 0.64))
    k.add(bm_box(BW + 0.02, 0.11, 0.085, 0.016, 2), 'mat_mahogany', T(0, yd - 0.045, zd))
    k.add(bm_box(BW, 0.014, 0.022), 'mat_gold', T(0, yd - 0.102, zd), smooth=None)
    pw = (BW - 0.24) / 3
    for i in range(3):
        cx = -BW / 2 + 0.12 + pw / 2 + i * pw
        k.add(bm_box(pw - 0.08, 0.032, 0.68, 0.022, 1), 'mat_mahogany', T(cx, yd * 0.5 - 0.055, 0.64))
        k.add(bm_box(pw - 0.16, 0.01, 0.58), 'mat_gold', T(cx, yd * 0.5 - 0.073, 0.64), smooth=None)
    zt = RH - 0.14; yt = -f_in(zt)
    k.add(bm_box(BW, 0.12, 0.18, 0.018, 2), 'mat_oak_dark', T(0, yt - 0.05, zt))
    k.add(bm_box(BW, 0.016, 0.028), 'mat_gold', T(0, yt - 0.112, zt - 0.05), smooth=None)
    for ox in (-0.68, 0.0, 0.68):
        hex_bolt(k, (ox, yt - 0.112, zt + 0.02), (0, -1, 0), 0.016, 'mat_brass')
    # --- upper wall of the bay: mahogany boarding behind everything
    k.add(bm_box(BW, 0.03, 2.5, 0.006, 1), 'mat_mahogany', _lean(1.2, 3.7, 0.0))
    # --- the arched niche: navy leather back, carved mahogany architrave, gilt bead
    NW, Z0, SPR = 0.68, 1.22, 2.42
    zm = (Z0 + SPR + NW) / 2
    poly = [(-NW, Z0 - zm), (NW, Z0 - zm)] + [(math.cos(a) * NW, SPR - zm + math.sin(a) * NW) for a in [i / 20 * math.pi for i in range(21)]]
    k.add(bm_extrude(poly, 0.02, 'XZ'), 'mat_hide', _lean(Z0, SPR + NW, 0.04), tint=(0.035, 0.06, 0.16, 1))
    def arch_path(r, out):
        pts = [(-r, Z0), (-r, SPR)] + [(-math.cos(a) * r, SPR + math.sin(a) * r) for a in [i / 24 * math.pi for i in range(1, 24)]] + [(r, SPR), (r, Z0)]
        return [(x, -f_in(z) - out, z) for x, z in pts]
    k.add(bm_sweep(arch_path(NW + 0.07, 0.07), rect(0.13, 0.09, 0.02), up=(0, -1, 0)), 'mat_mahogany', smooth=40)
    k.add(bm_sweep(arch_path(NW + 0.005, 0.07), circle(0.022, 8), up=(0, -1, 0)), 'mat_gold', smooth=60)
    k.add(bm_sweep(arch_path(NW + 0.14, 0.11), circle(0.014, 6), up=(0, -1, 0)), 'mat_gold', smooth=60)
    # keystone + gilt shell on the arch crown
    zk = SPR + NW + 0.07
    k.add(bm_taper_box(0.16, 0.08, 0.2, 1.35, 0.012), 'mat_mahogany', T(0, -f_in(zk) - 0.12, zk))
    k.add(bm_sphere(0.06, 12, 6, 1, 0.45, 1), 'mat_gold', T(0, -f_in(zk) - 0.17, zk + 0.02))
    # gilt compass star on the leather above the cage
    zs = 2.78
    star = []
    for i in range(16):
        a = math.pi / 2 + i * math.pi / 8; r = 0.2 if i % 4 == 0 else (0.11 if i % 2 == 0 else 0.05)
        star.append((math.cos(a) * r, math.sin(a) * r))
    k.add(bm_extrude(star, 0.012, 'XZ'), 'mat_gold', _lean(zs - 0.01, zs + 0.01, 0.065) @ T(0, 0, 0), smooth=None)
    k.add(bm_torus(0.15, 0.008, 28, 4), 'mat_gold', _lean(zs - 0.01, zs + 0.01, 0.07) @ R(math.pi / 2, 0, 0))
    # velvet swag + tassels across the niche head
    ysw = -f_in(2.95) - 0.12
    swag(k, -0.62, 0.62, 2.98, 0.24, ysw, 0.07)
    for s in (-1, 1):
        k.add(bm_lathe([(0.0, 0.0), (0.03, 0.02), (0.04, 0.09), (0.02, 0.13), (0.03, 0.16), (0.0, 0.18)], 10), 'mat_gold', T(s * 0.62, ysw, 2.78))
    # --- fluted pilasters, gilt bases + capitals, a dentilled cornice and a gilt cartouche
    for s in (-1, 1):
        x = s * 0.88
        k.add(bm_box(0.17, 0.09, 2.06, 0.012, 1), 'mat_mahogany', T(x, 0, 0) @ _lean(1.21, 3.27, 0.05))
        for f in (-0.045, 0.0, 0.045):
            k.add(bm_box(0.022, 0.02, 1.7, 0.006, 1), 'mat_oak_dark', T(x + f, 0, 0) @ _lean(1.38, 3.08, 0.1))
        k.add(bm_box(0.22, 0.13, 0.1, 0.012, 1), 'mat_gold', T(x, -f_in(1.26) - 0.07, 1.26))
        k.add(bm_box(0.24, 0.14, 0.11, 0.012, 1), 'mat_gold', T(x, -f_in(3.18) - 0.07, 3.18))
        for sv in (-1, 1): k.add(bm_torus(0.025, 0.01, 10, 4), 'mat_gold', T(x + sv * 0.1, -f_in(3.18) - 0.14, 3.19) @ R(math.pi / 2, 0, 0))
        # brass candle sconce on each pilaster (flame only, no light)
        zc = 1.95; yc = -f_in(zc) - 0.1
        k.add(bm_box(0.06, 0.04, 0.12, 0.01, 1), 'mat_brass', T(x, yc - 0.01, zc))
        k.add(bm_sweep([(x, yc - 0.02, zc - 0.03), (x, yc - 0.1, zc - 0.05), (x, yc - 0.16, zc - 0.02), (x, yc - 0.18, zc + 0.03)], circle(0.009, 6)), 'mat_brass', smooth=60)
        k.add(bm_lathe([(0.0, 0.0), (0.05, 0.005), (0.06, 0.02), (0.05, 0.03), (0.02, 0.03), (0.0, 0.03)], 14), 'mat_brass', T(x, yc - 0.18, zc + 0.03))
        candle(k, (x, yc - 0.18, zc + 0.055), h=0.13, r=0.022, drips=2)
    zc_ = 3.32; yc_ = -f_in(zc_)
    k.add(bm_box(BW - 0.02, 0.2, 0.1, 0.014, 2), 'mat_mahogany', T(0, yc_ - 0.1, zc_))
    k.add(bm_box(BW - 0.02, 0.012, 0.02), 'mat_gold', T(0, yc_ - 0.205, zc_ - 0.03), smooth=None)
    for i in range(17):
        k.add(bm_box(0.045, 0.05, 0.05, 0.004, 1), 'mat_mahogany', T(-0.88 + i * 0.11, yc_ - 0.17, zc_ - 0.075))
    zca = 3.52; yca = -f_in(zca) - 0.1
    k.add(bm_cyl(0.13, 0.13, 0.03, 24), 'mat_mahogany', T(0, yca, zca) @ R(math.pi / 2, 0, 0))
    k.add(bm_torus(0.13, 0.018, 28, 6), 'mat_gold', T(0, yca - 0.03, zca) @ R(math.pi / 2, 0, 0))
    k.add(bm_box(0.018, 0.012, 0.15, 0.004, 1), 'mat_gold', T(0, yca - 0.035, zca))
    k.add(bm_box(0.11, 0.012, 0.016, 0.004, 1), 'mat_gold', T(0, yca - 0.035, zca + 0.045))
    k.add(bm_torus(0.055, 0.009, 14, 4, arc=math.pi), 'mat_gold', T(0, yca - 0.035, zca - 0.03) @ R(math.pi / 2, 0, 0) @ R(0, 0, math.pi))
    for s in (-1, 1):   # gilt acanthus scrolls flanking the cartouche
        k.add(bm_torus(0.06, 0.012, 16, 5, arc=1.5 * math.pi), 'mat_gold', T(s * 0.22, yca, zca - 0.04) @ R(math.pi / 2, 0, 0) @ R(0, 0, (0.25 if s > 0 else 1.25) * math.pi))
    # --- carved mahogany pedestal (claw feet, baluster, gilt collars) + brass nameplate
    cy = -CAGE_OUT
    k.add(bm_box(0.62, 0.62, 0.07, 0.015, 2), 'mat_oak_dark', T(0, cy, 0.035))
    k.add(bm_box(0.5, 0.5, 0.09, 0.02, 2), 'mat_mahogany', T(0, cy, 0.11))
    for sx in (-1, 1):
        for sy in (-1, 1):
            k.add(bm_sphere(0.05, 10, 6, 1, 1, 0.8), 'mat_gold', T(sx * 0.27, cy + sy * 0.27, 0.04))
            for j in (-1, 0, 1):
                k.add(bm_sphere(0.022, 6, 4, 1.6, 1, 0.7), 'mat_gold', T(sx * 0.27 + sx * 0.04 + j * 0.02 * sy, cy + sy * 0.27 + sy * 0.04 - j * 0.02 * sx, 0.02))
    bal = [(0.2, 0.155), (0.205, 0.18), (0.13, 0.22), (0.115, 0.28), (0.15, 0.36), (0.175, 0.46), (0.16, 0.56), (0.1, 0.66), (0.07, 0.72), (0.095, 0.75), (0.095, 0.78), (0.065, 0.81), (0.06, 0.88), (0.09, 0.92)]
    k.add(bm_lathe(bal, 20), 'mat_mahogany', T(0, cy, 0), smooth=50)
    for z, r in ((0.18, 0.205), (0.765, 0.098), (0.46, 0.178)):
        k.add(bm_torus(r, 0.012, 24, 5), 'mat_gold', T(0, cy, z))
    for i in range(8):   # carved leaves on the belly
        a = i * math.pi / 4
        k.add(bm_sphere(0.05, 8, 5, 0.5, 0.25, 1.4), 'mat_mahogany', T(math.cos(a) * 0.15, cy + math.sin(a) * 0.15, 0.36) @ R(0, 0, a) @ R(0, -0.35, 0))
    k.add(bm_box(0.34, 0.34, 0.11, 0.015, 2), 'mat_mahogany', T(0, cy, 0.975))
    k.add(bm_box(0.38, 0.38, 0.025, 0.008, 1), 'mat_gold', T(0, cy, 1.04))
    k.add(bm_box(0.4, 0.4, 0.02, 0.006, 1), 'mat_mahogany', T(0, cy, 0.915))
    k.add(bm_box(0.22, 0.012, 0.06, 0.006, 1), 'mat_brass', T(0, cy - 0.176, 0.975))
    for i, w in enumerate((0.03, 0.022, 0.026, 0.024, 0.03)):
        k.add(bm_box(w, 0.004, 0.022), 'mat_oak_dark', T(-0.07 + i * 0.035, cy - 0.183, 0.977), smooth=None)
    for s in (-1, 1): k.add(bm_sphere(0.008, 6, 4), 'mat_brass', T(s * 0.095, cy - 0.183, 0.975))
    # --- the domed brass birdcage
    CR, ZB, ZR, DH = 0.47, 1.17, 1.95, 0.4
    k.add(bm_lathe([(0.0, 1.052), (0.44, 1.052), (0.5, 1.07), (0.53, 1.1), (0.52, 1.14), (0.49, 1.16), (0.0, 1.16)], 32), 'mat_gold', T(0, cy, 0), smooth=40)
    k.add(bm_torus(0.53, 0.012, 40, 5), 'mat_gold', T(0, cy, 1.1))
    for z in (ZB, 1.56, ZR):
        k.add(bm_torus(CR, 0.011, 40, 5), 'mat_brass', T(0, cy, z))
    k.add(bm_torus(CR + 0.004, 0.006, 40, 4), 'mat_gold', T(0, cy, 1.585))
    NB = 28
    for i in range(NB):
        a = 2 * math.pi * i / NB
        if abs(math.atan2(math.sin(a + math.pi / 2), math.cos(a + math.pi / 2))) < 0.21 and False: continue
        pts = [(math.cos(a) * CR, cy + math.sin(a) * CR, ZB), (math.cos(a) * CR, cy + math.sin(a) * CR, ZR)]
        for j in range(1, 11):
            t = j / 10 * math.pi / 2; r = CR * math.cos(t) if j < 10 else 0.05
            pts.append((math.cos(a) * r, cy + math.sin(a) * r, ZR + DH * math.sin(t)))
        k.add(bm_sweep(pts, circle(0.0055, 4)), 'mat_brass', smooth=50)
    t5 = math.pi / 4
    k.add(bm_torus(CR * math.cos(t5), 0.008, 32, 4), 'mat_brass', T(0, cy, ZR + DH * math.sin(t5)))
    # finial: gilt crown, onion + hanging ring
    ztp = ZR + DH - 0.01
    k.add(bm_lathe([(0.07, 0.0), (0.075, 0.03), (0.045, 0.06), (0.06, 0.1), (0.05, 0.14), (0.02, 0.17), (0.025, 0.19), (0.0, 0.215)], 18), 'mat_gold', T(0, cy, ztp), smooth=50)
    for i in range(6):
        a = i * math.pi / 3
        k.add(bm_sphere(0.012, 6, 4), 'mat_gold', T(math.cos(a) * 0.075, cy + math.sin(a) * 0.075, ztp + 0.035))
    k.add(bm_torus(0.045, 0.009, 18, 5), 'mat_gold', T(0, cy, ztp + 0.26) @ R(0, math.pi / 2, 0))
    # front door (faces the room) with gilt latch
    yf = cy - CR - 0.004
    for (w, h, x, z) in ((0.26, 0.016, 0, 1.22), (0.26, 0.016, 0, 1.54), (0.016, 0.33, -0.13, 1.38), (0.016, 0.33, 0.13, 1.38)):
        k.add(bm_box(w, 0.014, h, 0.004, 1), 'mat_gold', T(x, yf, z))
    k.add(bm_sphere(0.016, 8, 6), 'mat_gold', T(0.13, yf - 0.02, 1.4))
    k.add(bm_box(0.05, 0.012, 0.016, 0.004, 1), 'mat_gold', T(0.11, yf - 0.012, 1.4))
    # mahogany perch (brass end caps), seed cup + water cup on bar brackets, seeds on the tray
    PZ = 1.255
    k.add(bm_cyl(0.017, 0.017, 2 * CR - 0.02, 12), 'mat_oak_dark', T(-CR + 0.01, cy, PZ) @ R(0, math.pi / 2, 0), smooth=50)
    for s in (-1, 1): k.add(bm_sphere(0.022, 8, 6), 'mat_brass', T(s * (CR - 0.01), cy, PZ))
    for s, top in ((1, 'mat_rope'), (-1, 'mat_oak_dark')):
        cx = s * 0.36; cyy = cy - 0.24
        k.add(bm_lathe([(0.0, 0.0), (0.035, 0.0), (0.05, 0.03), (0.06, 0.07), (0.055, 0.075), (0.045, 0.035), (0.0, 0.035)], 16), 'mat_brass', T(cx, cyy, 1.3))
        k.add(bm_cyl(0.052, 0.052, 0.004, 16), top, T(cx, cyy, 1.36), smooth=None)
        k.add(bm_box(0.02, 0.1, 0.012, 0.003, 1), 'mat_brass', T(cx * 1.12, cyy - 0.02 * s, 1.36))
        if s > 0:
            for j in range(9):
                k.add(bm_sphere(0.008, 5, 3, 1, 0.7, 0.6), 'mat_rope', T(cx + RNG.uniform(-0.035, 0.035), cyy + RNG.uniform(-0.035, 0.035), 1.366))
    for j in range(14):
        a = RNG.uniform(0, 2 * math.pi); r = RNG.uniform(0.05, 0.38)
        k.add(bm_sphere(0.007, 5, 3, 1, 0.7, 0.6), 'mat_rope', T(math.cos(a) * r, cy + math.sin(a) * r, 1.163))
    return k

builders = [k_stern, k_rib, k_porthole, k_chandelier, k_lantern, k_table, k_berth, k_chest, k_bookcase, k_rum, k_door, k_wainscot, k_bureau, k_credenza, k_parrot]
kits = []
for b in builders:
    kk = b(); kk.finalize(); kits.append(kk)
for kk in kits:
    print('KIT', kk.name, STATS[kk.name])
print('BOOKS', STATS.get('books'))
print('TOTAL', {'meshes': sum(STATS[k.name]['meshes'] for k in kits), 'verts': sum(STATS[k.name]['verts'] for k in kits), 'tris': sum(STATS[k.name]['tris'] for k in kits)})

bpy.ops.wm.save_as_mainfile(filepath=BLEND)
bpy.ops.object.select_all(action='DESELECT')
for o in COLL.objects: o.select_set(True)
kw = dict(filepath=OUT, export_format='GLB', use_selection=True, export_extras=False, export_apply=True, export_yup=True,
          export_texcoords=True, export_normals=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
          # Draco (same self-hosted decoder as pirateGLB / figureheads): ~115k verts -> < 1.8 MB on the wire
          export_vertex_color='ACTIVE', export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
          export_draco_position_quantization=14, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_draco_color_quantization=10)
try:
    bpy.ops.export_scene.gltf(**kw)
except TypeError:
    kw.pop('export_materials', None); bpy.ops.export_scene.gltf(**kw)

sz = os.path.getsize(OUT)
print('EXPORTED', OUT, sz, 'bytes')
assert 300_000 < sz < 2_200_000, sz
