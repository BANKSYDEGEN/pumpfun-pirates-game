# [Timothy] PUMPFUN PIRATES plaza shops: geometry helpers for plaza_shops_blender.py (Blender 4.2, bpy + numpy).
# One Builder per shop per LOD collects flat-shaded primitives + baked item meshes into 3 material buckets
# (0 solid toon, 1 glow, 2 glass) with sRGB vertex colours: no textures, one mesh (<= 3 primitives) per shop LOD.
# [material library] every solid part also names a library layer (materials.py: stone_ashlar, brick, timber, roof_tile, ...): explicit
# (mat='timber' / lib=...) or from its palette colour (Builder.AUTO / .auto: hex -> name, nearest within 0.1 for jittered colours). bake()
# writes it per corner as the ONE uv layer 'LibID' (u = layer code incl. the grain-swap bit, v = 0.5: no UV maps, no textures in the GLB,
# no extra primitives) and bakes edge wear / grime into the vertex colours (per part: darker at its foot, a lighter worn top edge; plus a
# contact grime band above the ground when .ground(x, y) is set).
import bpy, bmesh, math, random, os, sys
import numpy as np
from mathutils import Matrix, Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import materials as ML

def hexc(h, j=0.0, rng=None):
    c = np.array([(h >> 16) & 255, (h >> 8) & 255, h & 255], float) / 255
    if j and rng is not None: c = np.clip(c * (1 + rng.uniform(-j, j)), 0, 1)
    return c

def T(x=0, y=0, z=0, rx=0, ry=0, rz=0, s=None):
    m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X')
    if s is not None:
        if not hasattr(s, '__len__'): s = (s, s, s)
        m = m @ Matrix.Diagonal((s[0], s[1], s[2], 1))
    return m

_BOX_F = [(3, 2, 1, 0), (5, 6, 7, 4), (1, 5, 4, 0), (2, 6, 5, 1), (3, 7, 6, 2), (0, 4, 7, 3)]   # outward normals (CCW seen from outside)

class Builder:
    AUTO = {}                                 # [material library] script-wide palette hex -> library name (set once by each build script)
    GRIME = True
    def __init__(self):
        self.parts = {0: [], 1: [], 2: []}   # (verts Nx3, faces list[tuple], cols Fx3 per face or per-corner, smooth flags, lib name, face swaps)
        self.stack = [Matrix.Identity(4)]
        self.boxes = []                       # (tag, world-local AABB min, max) for overlap checks
        self.auto = dict(Builder.AUTO); self._autoc = None
        self.ground = None                    # optional fn(x, y) -> ground z (contact grime band)
    def push(self, m): self.stack.append(self.stack[-1] @ m)
    def pop(self): self.stack.pop()
    def lib_for(self, col):
        if col is None or not self.auto: return None
        if isinstance(col, (int, np.integer)):
            if int(col) in self.auto: return self.auto[int(col)]
            col = hexc(int(col))
        if self._autoc is None: self._autoc = [(hexc(k), v) for k, v in self.auto.items()]
        c = np.asarray(col, float)[:3]; d, nm = min(((float(np.abs(c - k).max()), v) for k, v in self._autoc), key=lambda q: q[0])
        return nm if d < 0.1 else None
    def _add(self, V, F, col, mat=0, smooth=False, corner_cols=None, m=None, lib=None, grain=None):
        if isinstance(mat, str): lib, mat = mat, 0
        M = self.stack[-1] @ (m or Matrix.Identity(4))
        A = np.array(M); V0 = np.asarray(V, float); V = V0 @ A[:3, :3].T + A[:3, 3]
        if lib is None and mat == 0 and corner_cols is None: lib = self.lib_for(col)
        sw = None
        if lib and ML.INFO.get(lib, {}).get('grain'):   # grain axis: given (local) or the part's longest local extent, in the builder frame
            if grain is None: ext = V0.max(0) - V0.min(0); grain = np.eye(3)[int(np.argmax(ext))]
            ga = A[:3, :3] @ np.asarray(grain, float); sw = []
            for f in F:
                P = V[list(f)]; n = np.cross(P[1] - P[0], P[2] - P[0]) if len(f) >= 3 else np.zeros(3)
                if len(f) > 3: n = n + np.cross(P[2] - P[0], P[3] - P[0])
                sw.append(ML.swap_for(lib, n, ga))
        self.parts[mat].append((V, F, col, smooth, corner_cols, lib if mat == 0 else None, sw))
        return V
    def box(self, sx, sy, sz, x=0, y=0, z=0, col=0xffffff, rx=0, ry=0, rz=0, mat=0, tag=None, base=False):
        # centred box (base=True: z is the bottom)
        hx, hy, hz = sx / 2, sy / 2, sz / 2; zc = z + hz if base else z
        V = [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz), (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]
        W = self._add(V, _BOX_F, col, mat, m=T(x, y, zc, rx, ry, rz))
        if tag: self.boxes.append((tag, W.min(0), W.max(0)))
        return W
    def cyl(self, r0, r1, h, x=0, y=0, z=0, col=0xffffff, n=10, rx=0, ry=0, rz=0, mat=0, caps=True, smooth=True, tag=None):
        # axis +z, bottom at z (local), radius r0 bottom r1 top
        V = [(math.cos(2 * math.pi * i / n) * r0, math.sin(2 * math.pi * i / n) * r0, 0) for i in range(n)] + \
            [(math.cos(2 * math.pi * i / n) * r1, math.sin(2 * math.pi * i / n) * r1, h) for i in range(n)]
        F = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
        if caps: F += [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        W = self._add(V, F, col, mat, smooth=smooth, m=T(x, y, z, rx, ry, rz))
        if tag: self.boxes.append((tag, W.min(0), W.max(0)))
    def sphere(self, r, x=0, y=0, z=0, col=0xffffff, sub=1, mat=0, s=(1, 1, 1)):
        bm = bmesh.new(); bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
        V = [tuple(v.co) for v in bm.verts]; F = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
        self._add(V, F, col, mat, smooth=True, m=T(x, y, z, s=s))
    def torus(self, R, r, x=0, y=0, z=0, col=0xffffff, n=14, m_=6, rx=0, ry=0, rz=0, mat=0):
        V = []; F = []
        for i in range(n):
            a = 2 * math.pi * i / n
            for j in range(m_):
                b = 2 * math.pi * j / m_; V.append(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))
        for i in range(n):
            for j in range(m_):
                F.append((i * m_ + j, ((i + 1) % n) * m_ + j, ((i + 1) % n) * m_ + (j + 1) % m_, i * m_ + (j + 1) % m_))
        self._add(V, F, col, mat, smooth=True, m=T(x, y, z, rx, ry, rz))
    def prism(self, pts2d, depth, col, m, mat=0):
        # extrude a polygon in local XZ (front face y=0 .. back y=depth)
        n = len(pts2d); V = [(p[0], 0, p[1]) for p in pts2d] + [(p[0], depth, p[1]) for p in pts2d]
        F = [tuple(range(n)), tuple(range(2 * n - 1, n - 1, -1))] + [(i, n + i, n + (i + 1) % n, (i + 1) % n) for i in range(n)]
        self._add(V, F, col, mat, m=m)
    def mesh(self, V, F, col, m=None, mat=0, smooth=True, corner_cols=None):
        return self._add(V, F, col, mat, smooth=smooth, corner_cols=corner_cols, m=m)
    def bake(self, name):
        me = bpy.data.meshes.new(name); verts = []; faces = []; fcols = []; ccols = []; smooth = []; mats = []; off = 0
        lu = []
        for mat, plist in self.parts.items():
            for V, F, col, sm, cc, lib, sw in plist:
                verts.append(V)
                z0, z1 = float(V[:, 2].min()), float(V[:, 2].max()); hz = z1 - z0
                for fi, f in enumerate(F):
                    faces.append([i + off for i in f]); mats.append(mat); smooth.append(sm)
                    lu.extend([ML.code(lib, sw[fi] if sw else 0)] * len(f))
                    if cc is not None: fc = [np.asarray(c, float) for c in cc[fi]]
                    else:
                        c = hexc(col) if isinstance(col, (int, np.integer)) else np.asarray(col, float)
                        fc = [c] * len(f)
                    if mat == 0 and cc is None and Builder.GRIME:   # edge wear + grime baked into the vertex colours
                        out = []; P3 = V[list(f)]; fn = np.cross(P3[1] - P3[0], P3[2] - P3[0]) if len(f) >= 3 else np.zeros(3)
                        wall = abs(fn[2]) < 0.7 * (np.linalg.norm(fn) + 1e-9)   # contact grime only on walls / sides (never on floors or decks)
                        for c, vi in zip(fc, f):
                            p = V[vi]; k = 1.0
                            if hz > 0.12: t = (p[2] - z0) / hz; k *= 0.9 + 0.13 * t          # darker foot, lighter worn top edge
                            if self.ground is not None and wall:
                                dz = p[2] - self.ground(p[0], p[1]); k *= 0.8 + 0.2 * min(1.0, max(0.0, dz / 1.1)) ** 0.7   # contact grime
                            out.append(np.clip(np.asarray(c, float) * k, 0, 1))
                        fc = out
                    ccols.extend(fc)
                off += len(V)
        if not verts: return None
        V = np.concatenate(verts)
        me.from_pydata(V.tolist(), [], faces); me.update()
        me.polygons.foreach_set('material_index', mats); me.polygons.foreach_set('use_smooth', smooth)
        ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
        C = np.ones((len(ccols), 4)); C[:, :3] = np.clip(np.array(ccols), 0, 1)
        ca.data.foreach_set('color_srgb', C.ravel())
        uvl = me.uv_layers.new(name='LibID'); U = np.full((len(lu), 2), 0.5); U[:, 0] = lu; uvl.data.foreach_set('uv', U.ravel())
        return me
    def tris(self):
        t = 0
        for plist in self.parts.values():
            for V, F, *_ in plist: t += sum(len(f) - 2 for f in F)
        return t

# ---------- real game items (read-only GLB import) -> triangles + per-corner colours sampled from their texture ----------
_cache = {}
def load_item(path, want=None, skip=('Icosphere',), pose=0.0):
    # pose = degrees the upper arms swing down from the bind T-pose (same bone names on the bodies and the skinned items, so a
    # posed mannequin and the clothes it wears stay fitted); colour = texture x COLOR_0 (as the game multiplies them)
    key = (path, want, pose)
    if key in _cache: return _cache[key]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    if pose:
        for a in new:
            if a.type != 'ARMATURE': continue
            ax = (a.matrix_world.inverted().to_3x3() @ Vector((0, 1, 0))).normalized()
            for nm, sg in (('upperarm.L', 1), ('upperarm.R', -1)):
                pb = a.pose.bones.get(nm)
                if not pb: print('[plaza] no bone', nm, path); continue
                h = pb.bone.head_local
                pb.matrix = Matrix.Translation(h) @ Matrix.Rotation(math.radians(pose) * sg, 4, ax) @ Matrix.Translation(-h) @ pb.matrix
            bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in new:
        if o.type != 'MESH' or any(o.name.startswith(s) for s in skip): continue
        if want and not any(w in o.name for w in want): continue
        e = o.evaluated_get(dg); em = e.to_mesh(); M = np.array(o.matrix_world)
        V = np.array([v.co for v in em.vertices]) @ M[:3, :3].T + M[:3, 3]; e.to_mesh_clear()
        me = o.data
        img = None
        for mt in me.materials:
            if mt and mt.use_nodes:
                for nd in mt.node_tree.nodes:
                    if nd.type == 'TEX_IMAGE' and nd.image and 'nrm' not in nd.image.name: img = nd.image; break
            if img: break
        uvl = me.uv_layers.active
        polys = [tuple(p.vertices) for p in me.polygons]
        if img is not None and uvl is not None:
            w, h = img.size; P = np.array(img.pixels[:]).reshape(h, w, 4)
            uv = np.array([d.uv[:] for d in uvl.data]); ix = np.clip((uv[:, 0] % 1) * w, 0, w - 1).astype(int); iy = np.clip((uv[:, 1] % 1) * h, 0, h - 1).astype(int)
            lc = P[iy, ix, :3]
        else:
            lc = np.ones((len(me.loops), 3)) * 0.8
            if me.materials and me.materials[0]:
                bc = me.materials[0].node_tree.nodes.get('Principled BSDF') if me.materials[0].use_nodes else None
                if bc: lc[:] = np.array(bc.inputs['Base Color'].default_value[:3]) ** (1 / 2.2)
        c0 = me.color_attributes.get('Color')
        if c0 is not None and len(c0.data):
            A = np.array([d.color[:3] for d in c0.data]) ** (1 / 2.2)
            if c0.domain == 'POINT': A = A[np.array([l.vertex_index for l in me.loops])]
            if len(A) == len(lc): lc = lc * A
        cc = []
        for p in me.polygons: cc.append([lc[l] for l in p.loop_indices])
        out.append((V, polys, cc))
    for o in new: bpy.data.objects.remove(o, do_unlink=True)
    _cache[key] = out
    return out

def add_item(b, parts, m, tint=None, mono=None, lift=1.0, mat=0):
    def fix(c):   # COLOR_0 tint-key magenta (runtime trim slot) -> the game's default gold trim
        c = np.asarray(c, float)
        return np.array([1.0, 0.79, 0.24]) * max(c[0], 0.5) if c[0] > 0.6 and c[2] > 0.6 and c[1] < 0.35 else c
    cc_all = parts
    parts = [(V, F, [[fix(c) for c in f] for f in cc]) for V, F, cc in parts]
    for V, F, cc in parts:
        if mono is not None: c2 = [[np.array(mono) for _ in f] for f in cc]
        elif tint is not None:   # tint the low-saturation (felt / cloth) texels only: gold trim, buckles and prints keep their colour
            t = hexc(tint) if isinstance(tint, int) else np.asarray(tint)
            def tc(c):
                c = np.asarray(c); sat = c.max() - c.min(); k = np.clip(1 - sat * 4, 0, 1)
                return np.clip(c * (t * k + (1 - k)) * lift, 0, 1)
            c2 = [[tc(c) for c in f] for f in cc]
        else: c2 = cc
        b.mesh(V, F, None, m=m, corner_cols=c2, mat=mat)

def decimate_parts(parts, ratio):
    out = []
    for V, F, cc in parts:
        me = bpy.data.meshes.new('d'); me.from_pydata(V.tolist(), [], F); me.update()
        ca = me.color_attributes.new('c', 'FLOAT_COLOR', 'CORNER'); flat = [c for f in cc for c in f]
        C = np.ones((len(flat), 4)); C[:, :3] = flat; ca.data.foreach_set('color', C.ravel())
        o = bpy.data.objects.new('d', me); bpy.context.scene.collection.objects.link(o)
        md = o.modifiers.new('dec', 'DECIMATE'); md.ratio = ratio
        dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); m2 = e.to_mesh()
        V2 = np.array([v.co for v in m2.vertices]); F2 = [tuple(p.vertices) for p in m2.polygons]
        a = m2.color_attributes.get('c'); C2 = np.array([d.color[:3] for d in a.data]) if a else np.ones((len(m2.loops), 3))
        cc2 = [[C2[l] for l in p.loop_indices] for p in m2.polygons]
        e.to_mesh_clear(); bpy.data.objects.remove(o); bpy.data.meshes.remove(me)
        out.append((V2, F2, cc2))
    return out

def bbox_parts(parts):
    V = np.concatenate([p[0] for p in parts]); return V.min(0), V.max(0)

# ---------- carved 3D lettering (the brand font) ----------
_fonts = {}   # [clothes-aaa] one loaded font per path (the clothes shop signs use the repo's Cinzel Decorative)
def text_mesh(s, font_path, size=0.5, extrude=0.03, res=3):
    if font_path not in _fonts: _fonts[font_path] = bpy.data.fonts.load(font_path)
    cu = bpy.data.curves.new('t', 'FONT'); cu.body = s; cu.font = _fonts[font_path]; cu.size = size; cu.extrude = extrude
    cu.align_x = 'CENTER'; cu.align_y = 'CENTER'; cu.resolution_u = res; cu.fill_mode = 'BOTH' if extrude else 'FRONT'
    o = bpy.data.objects.new('t', cu); bpy.context.scene.collection.objects.link(o)
    dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); me = e.to_mesh()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.dissolve_limit(bm, angle_limit=0.05, verts=bm.verts[:], edges=bm.edges[:]); bmesh.ops.triangulate(bm, faces=bm.faces[:])
    V = np.array([v.co[:] for v in bm.verts]); F = [tuple(v.index for v in f.verts) for f in bm.faces]; bm.free()
    e.to_mesh_clear(); bpy.data.objects.remove(o); bpy.data.curves.remove(cu)
    w = V[:, 0].max() - V[:, 0].min()
    return V, F, w
