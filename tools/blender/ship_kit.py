# PUMPFUN PIRATES ship kit: Blender 4.2 headless build of the player-ship art kit.
#   blender -b -P tools/blender/ship_kit.py -- <out_dir>
# Builds (all procedural, reproducible from this file + a fixed seed):
#   * baked surface tiles: hull strakes, deck/cabin planks, sail cloth -> tangent-space normal map + AO from real
#     high-poly geometry (selected-to-active Cycles bake), plus a grayscale "detail" map (AO x grain x weathering)
#     that js/shipKit.js multiplies into each skin's painted canvas, so every skin / Squads colour keeps its tint.
#   * hero meshes (carriage gun, figurehead, stern carving, lantern cage, channels + deadeyes) with baked AO in
#     COLOR_0, one node per material ROLE (iron / wood / gold / dark / rope); a decimated Low LOD for phones.
# The game keeps its own parametric hull + layout (ships.js / upgradeVisuals.js), so hitboxes, gun slots and
# muzzle markers are untouched: the kit only replaces how those parts LOOK. Kit pieces are authored in the exact
# local frames of the procedural parts they replace (see the conventions on each builder).
import bpy, bmesh, math, os, random, sys
import numpy as np
from mathutils import Vector, Matrix

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/shipkit'
os.makedirs(OUT, exist_ok=True)
RES = int(os.environ.get('KIT_RES', '1024'))
SAMPLES = int(os.environ.get('KIT_SAMPLES', '24'))
random.seed(1337); np.random.seed(1337)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES
    sc.render.bake.margin = 4
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
    return sc

def mat(name, col=(0.8, 0.8, 0.8)):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; m.diffuse_color = (*col, 1)
    b = m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = 0.8
    return m

def obj_from_bm(bm, name, material=None):
    if bm.faces: bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o)
    if material: me.materials.append(material)
    return o

def box(bm, c, s, bev=0.0):
    """axis box centre c, size s (added to bm)"""
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r['verts']
    for v in vs: v.co = Vector((v.co.x * s[0] + c[0], v.co.y * s[1] + c[1], v.co.z * s[2] + c[2]))
    return vs

def link_join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); o = bpy.context.view_layer.objects.active; o.name = name; return o

def apply_mods(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

def bevel(o, w=0.01, seg=2, limit='ANGLE'):
    m = o.modifiers.new('bev', 'BEVEL'); m.width = w; m.segments = seg; m.limit_method = limit; m.angle_limit = math.radians(35)
    apply_mods(o)

# ---------------------------------------------------------------- periodic noise (numpy) for grain / weathering
def pnoise(h, w, freqs, seed, amp_decay=0.55):
    """sum of random sinusoids with INTEGER frequencies over the tile -> tiles seamlessly in both axes"""
    rs = np.random.RandomState(seed); y, x = np.mgrid[0:h, 0:w]; u = x / w; v = y / h; out = np.zeros((h, w)); a = 1.0
    for fu, fv, n in freqs:
        for _ in range(n):
            ku = rs.randint(-fu, fu + 1); kv = rs.randint(-fv, fv + 1); ph = rs.rand() * 6.283
            out += a * np.sin(6.283 * (ku * u + kv * v) + ph)
        a *= amp_decay
    out -= out.min(); out /= max(1e-6, out.max()); return out

def save_png(arr, path, mode='RGB'):
    """arr: HxWx{1,3,4} float 0..1, row 0 = TOP of the image"""
    h, w = arr.shape[:2]
    if arr.ndim == 2: arr = arr[..., None]
    if arr.shape[2] == 1: arr = np.repeat(arr, 3, 2)
    if arr.shape[2] == 3: arr = np.concatenate([arr, np.ones((h, w, 1))], 2)
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).astype(np.float32).ravel())  # blender rows start at the bottom
    img.filepath_raw = path; img.file_format = 'PNG'; img.save(); bpy.data.images.remove(img)

def img_to_np(img):
    w, h = img.size; a = np.empty(w * h * 4, np.float32); img.pixels.foreach_get(a); return a.reshape(h, w, 4)[::-1].copy()

# ---------------------------------------------------------------- selected-to-active tile bake
def bake_tile(name, high_objs, size_u, size_v, px_w, px_h, wrap_u=True, wrap_v=False):
    """bake tangent normal + AO of `high_objs` (built over [0,size_u]x[0,size_v], +Z up) onto a flat plane.
    For seamless tiles the high-poly is duplicated one tile left/right (and up/down) so AO sees its neighbours."""
    sc = bpy.context.scene
    high = link_join(high_objs, name + '_hi')
    copies = []
    offs = [(du, dv) for du in ((-1, 0, 1) if wrap_u else (0,)) for dv in ((-1, 0, 1) if wrap_v else (0,)) if (du, dv) != (0, 0)]
    for du, dv in offs:
        c = high.copy(); c.data = high.data; c.location = (du * size_u, dv * size_v, 0); sc.collection.objects.link(c); copies.append(c)
    bm = bmesh.new(); bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts: v.co = Vector(((v.co.x + 0.5) * size_u, (v.co.y + 0.5) * size_v, 0))
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for l in f.loops: l[uvl].uv = (l.vert.co.x / size_u, l.vert.co.y / size_v)
    lo = obj_from_bm(bm, name + '_lo', mat(name + '_lomat'))
    out = {}
    for kind in ('NORMAL', 'AO'):
        img = bpy.data.images.new(f'{name}_{kind}', px_w, px_h, alpha=False, float_buffer=True)
        img.colorspace_settings.name = 'Non-Color'
        nt = lo.active_material.node_tree; n = nt.nodes.new('ShaderNodeTexImage'); n.image = img; nt.nodes.active = n
        bpy.ops.object.select_all(action='DESELECT'); high.select_set(True); lo.select_set(True); bpy.context.view_layer.objects.active = lo
        sc.render.bake.use_selected_to_active = True; sc.render.bake.cage_extrusion = 0.25; sc.render.bake.max_ray_distance = 0.6
        if kind == 'NORMAL': sc.render.bake.normal_space = 'TANGENT'
        bpy.ops.object.bake(type=kind)
        out[kind] = img_to_np(img); nt.nodes.remove(n); bpy.data.images.remove(img)
    for c in copies: bpy.data.objects.remove(c)
    bpy.data.objects.remove(high); bpy.data.objects.remove(lo)
    return out['NORMAL'][..., :3], out['AO'][..., 0]

def add_grain(nrm, height, k):
    """fold a grain height field (periodic) into a baked tangent normal map"""
    n = nrm * 2 - 1
    gy, gx = np.gradient(height)
    n[..., 0] -= gx * k; n[..., 1] += gy * k  # image rows go down = -v
    n /= np.linalg.norm(n, axis=2, keepdims=True) + 1e-6
    return n * 0.5 + 0.5

def finish_tile(name, nrm, ao, grain, ao_k=0.85, grain_k=0.22, rough=None, ao_floor=0.35):
    ao = np.maximum(ao, ao_floor)
    detail = (1 - ao_k * (1 - ao)) * (1 - grain_k * grain)
    if rough is not None: detail *= rough
    detail = np.clip(detail / max(1e-6, np.percentile(detail, 97)), 0, 1)  # keep the skin's paint at full brightness on open wood
    save_png(nrm, f'{OUT}/{name}_n.png'); save_png(detail, f'{OUT}/{name}_d.png')
    print('[kit] tile', name, nrm.shape, flush=True)

# ---------------------------------------------------------------- plank field (hull strakes / deck)
def plank_field(name, size_u, size_v, rows, min_len, max_len, gap=0.012, thick=0.04, nails=True, seed=1, crown=0.006):
    rs = random.Random(seed); objs = []
    rowh = size_v / rows
    for r in range(rows):
        bm = bmesh.new()
        u = -rs.uniform(0, max_len)  # boards start before the tile and are cut at the wrap so the row tiles
        while u < size_u:
            L = rs.uniform(min_len, max_len); a, b = u, u + L
            z0 = thick + rs.uniform(-0.004, 0.004)
            for lo_u, hi_u, du in ((a, b, 0), ):
                pieces = []
                if lo_u < 0: pieces += [(lo_u + size_u, size_u), (0, hi_u)]
                elif hi_u > size_u: pieces += [(lo_u, size_u), (0, hi_u - size_u)]
                else: pieces += [(lo_u, hi_u)]
                for p0, p1 in pieces:
                    if p1 - p0 < 0.01: continue
                    # board: slightly crowned box with a gap on each side (caulked seams read as dark lines + AO)
                    box(bm, ((p0 + p1) / 2, r * rowh + rowh / 2, z0 / 2), (p1 - p0 - (gap if (p0 > 0.001 and p1 < size_u - 0.001) else gap / 2), rowh - gap, z0))
                    if nails:
                        for nu in (p0 + 0.06, p1 - 0.06):
                            if 0.03 < nu < size_u - 0.03:
                                for fv in (0.28, 0.72):
                                    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.012, radius2=0.009, depth=0.008)
                                    for v in c['verts']: v.co += Vector((nu, r * rowh + rowh * fv, z0 + 0.002))
            u = b
        o = obj_from_bm(bm, f'{name}_row{r}')
        bev = o.modifiers.new('b', 'BEVEL'); bev.width = min(0.012, rowh * 0.06); bev.segments = 2; bev.limit_method = 'ANGLE'
        apply_mods(o); objs.append(o)
    # caulking bed under the boards
    bm = bmesh.new(); box(bm, (size_u / 2, size_v / 2, 0.004), (size_u * 1.0, size_v, 0.008)); objs.append(obj_from_bm(bm, name + '_bed'))
    return objs

def grain_field(h, w, rows, seed, along_u=True):
    """wood grain: stretched periodic noise per row + ring streaks, varies per board row"""
    g = pnoise(h, w, [(3, 2 * rows, 6), (6, 6 * rows, 10), (12, 14 * rows, 14)], seed)
    streak = pnoise(h, w, [(1, 40 * rows, 18)], seed + 7, 0.8)
    return np.clip(0.6 * g + 0.4 * streak, 0, 1)

def build_tiles():
    reset()
    # HULL strakes: 1 tile = 5 m along the ship (u = z/5) x the full girth (v 0 gunwale .. 1 keel), 10 strakes
    hn, hao = bake_tile('hull', plank_field('hull', 5.0, 4.5, 10, 1.6, 3.4, gap=0.018, thick=0.05, seed=11), 5.0, 4.5, RES, RES)
    hg = grain_field(RES, RES, 10, 21)
    weather = pnoise(RES, RES, [(2, 2, 5), (5, 5, 8)], 33)
    finish_tile('hull', add_grain(hn, hg, 2.2), hao, hg, rough=1 - 0.18 * weather)
    reset()
    # DECK + cabin planks: 1 tile = 4 m (u = z/4) x 1.4 m across (v = x/1.4), 6 boards, treenail plugs
    dn, dao = bake_tile('deck', plank_field('deck', 4.0, 1.4, 6, 1.2, 2.8, gap=0.01, thick=0.035, seed=12), 4.0, 1.4, RES, RES // 2)
    dg = grain_field(RES // 2, RES, 6, 22)
    finish_tile('deck', add_grain(dn, dg, 2.0), dao, dg, ao_k=0.7)
    reset()
    build_sail_tile()

# ---------------------------------------------------------------- sail cloth (whole sail, uv 0..1, 5 cloths)
def build_sail_tile():
    W, H = 1.0, 0.78; objs = []
    bm = bmesh.new(); box(bm, (W / 2, H / 2, 0.002), (W, H, 0.004)); objs.append(obj_from_bm(bm, 'cloth'))
    bm = bmesh.new()
    for i in range(1, 5):  # flat-felled panel seams: two rows of stitching each side
        x = i * W / 5; box(bm, (x, H / 2, 0.006), (0.012, H, 0.004))
        for dx in (-0.011, 0.011):
            for k in range(60):
                box(bm, (x + dx, (k + 0.5) * H / 60, 0.0052), (0.003, H / 60 * 0.55, 0.0016))
    # tabling (doubled hem) on all four edges + bolt rope on the leeches and foot
    for (c, s) in (((W / 2, 0.018, 0.006), (W, 0.036, 0.006)), ((W / 2, H - 0.018, 0.006), (W, 0.036, 0.006)),
                   ((0.018, H / 2, 0.006), (0.036, H, 0.006)), ((W - 0.018, H / 2, 0.006), (0.036, H, 0.006))):
        box(bm, c, s)
    # reef band with reef points (short tied lines) at 70% height
    ry = H * 0.68; box(bm, (W / 2, ry, 0.006), (W, 0.03, 0.005))
    for k in range(14):
        x = (k + 0.5) * W / 14
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.006, radius2=0.004, depth=0.07)
        for v in c['verts']: v.co = Vector((v.co.x + x, v.co.z + ry - 0.03, v.co.y + 0.01))
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.009, radius2=0.009, depth=0.006)
        for v in c['verts']: v.co += Vector((x, ry, 0.009))
    # corner patches (clew / head reinforcements)
    for (cx, cy) in ((0.05, 0.05), (W - 0.05, 0.05), (0.05, H - 0.05), (W - 0.05, H - 0.05)):
        box(bm, (cx, cy, 0.0105), (0.1, 0.1, 0.003))
    so = obj_from_bm(bm, 'seams'); bev = so.modifiers.new('b', 'BEVEL'); bev.width = 0.002; bev.segments = 2; apply_mods(so); objs.append(so)
    bm = bmesh.new()
    for (a, b) in (((0, 0, 0.012), (W, 0, 0.012)), ((0, 0, 0.012), (0, H, 0.012)), ((W, 0, 0.012), (W, H, 0.012))):
        A, B = Vector(a), Vector(b); d = B - A
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.01, radius2=0.01, depth=d.length)
        rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.transform(bm, matrix=Matrix.Translation((A + B) / 2) @ rot, verts=c['verts'])
    objs.append(obj_from_bm(bm, 'boltrope'))
    px_w, px_h = RES, int(RES * 0.78) // 4 * 4
    sn, sao = bake_tile('sail', objs, W, H, px_w, px_h, wrap_u=False)
    weave = pnoise(px_h, px_w, [(2, 2, 4), (4, 4, 6)], 44)
    fine = np.fromfunction(lambda y, x: 0.5 + 0.25 * np.sin(x * 1.7) * np.sin(y * 1.7), (px_h, px_w))
    finish_tile('sail', add_grain(sn, fine * 0.4, 1.0), sao, weave, ao_k=0.8, grain_k=0.16, ao_floor=0.6)

# ---------------------------------------------------------------- hero meshes
ROLE = {}
def role_mat(r):
    if r not in ROLE: ROLE[r] = mat(r, {'iron': (0.15, 0.16, 0.18), 'wood': (0.45, 0.28, 0.16), 'gold': (0.9, 0.7, 0.3), 'dark': (0.05, 0.05, 0.05), 'rope': (0.55, 0.45, 0.3)}[r])
    return ROLE[r]

def lathe_bm(bm, prof, segs, axis='Y'):
    """profile [(r, h)] revolved around +Y (three.js LatheGeometry convention)"""
    rings = []
    for (r, h) in prof:
        ring = [bm.verts.new((r * math.sin(2 * math.pi * k / segs), h, r * math.cos(2 * math.pi * k / segs))) for k in range(segs)]
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(segs):
            a, b, c, d = rings[i][k], rings[i][(k + 1) % segs], rings[i + 1][(k + 1) % segs], rings[i + 1][k]
            try: bm.faces.new((a, d, c, b))
            except ValueError: pass
    return rings

def cyl_between(bm, A, B, r, segs=8, r2=None):
    A, B = Vector(A), Vector(B); d = B - A
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r2 if r2 is not None else r, depth=d.length)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((A + B) / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4(), verts=c['verts'])

# ships.js CANNON profile (r, y): the kit barrel keeps this exact silhouette so the tip stays at y 1.22
CANNON = [[0.001, -0.31], [0.07, -0.31], [0.095, -0.25], [0.055, -0.2], [0.09, -0.17], [0.24, -0.15], [0.29, -0.08], [0.305, 0.03], [0.27, 0.07],
  [0.27, 0.13], [0.295, 0.16], [0.295, 0.24], [0.255, 0.27], [0.24, 0.5], [0.268, 0.52], [0.268, 0.59], [0.235, 0.61], [0.212, 0.92], [0.242, 0.96],
  [0.242, 1.01], [0.215, 1.04], [0.25, 1.1], [0.305, 1.15], [0.305, 1.22], [0.165, 1.22], [0.15, 1.14], [0.001, 1.13]]

def build_barrel(lo):
    """local frame = ships.js barrel: axis +Y, breech knob at -0.31, muzzle face at +1.22 (the muzzle marker sits on it)"""
    segs = 10 if lo else 14
    bm = bmesh.new()
    prof = []
    for i, (r, y) in enumerate(CANNON):
        prof.append((r, y))
        if False and not lo and i + 1 < len(CANNON):  # subdivide the long tapers so the AO + highlight read smooth
            r2, y2 = CANNON[i + 1]
            if abs(y2 - y) > 0.15:
                for t in (0.33, 0.66): prof.append((r + (r2 - r) * t, y + (y2 - y) * t))
    lathe_bm(bm, prof, segs)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    if not lo:
        # trunnions (across the gun = local Z), lifting dolphins on top (local +X after the -90 deg roll is UP), vent + astragals
        cyl_between(bm, (0, 0.47, -0.42), (0, 0.47, 0.42), 0.075, 8)
        for dz in (-0.1, 0.1):
            for (y0, y1) in ((0.36, 0.62),):
                pts = [Vector((0.25 + 0.11 * math.sin(math.pi * t / 6), y0 + (y1 - y0) * t / 6, dz)) for t in range(7)]
                for a, b in zip(pts[::2], pts[2::2]): cyl_between(bm, a, b, 0.026, 5)
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.035, radius2=0.03, depth=0.05)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((0.3, 0.08, 0)) @ Matrix.Rotation(math.pi / 2, 4, 'Z'), verts=c['verts'])
        # breeching ring through the cascabel
        t = bmesh.ops.create_circle(bm, cap_ends=False, segments=12, radius=0.09)
        ring = bm.verts[-12:]
    o = obj_from_bm(bm, 'barrel', role_mat('iron'))
    for p in o.data.polygons: p.use_smooth = True
    return [o]

def build_carriage(lo):
    """local frame = ships.js carriage at (c0, y, z) for the PORT side (sx=+1, barrel points +X); starboard is the
    same mesh turned 180 deg about Y. Matches the procedural bed / cheeks / axles / four trucks footprint."""
    wood, iron, rope = bmesh.new(), bmesh.new(), bmesh.new()
    box(wood, (0, 0.18, 0), (0.8, 0.08, 0.5))                       # bed
    for dz in (-0.24, 0.24):                                         # stepped cheeks (two steps + the trunnion cap seat)
        box(wood, (0, 0.30, dz), (0.86, 0.26, 0.1))
        box(wood, (-0.2, 0.52, dz), (0.46, 0.2, 0.1))
        if not lo:
            box(wood, (0.25, 0.47, dz), (0.12, 0.08, 0.1))
            box(iron, (0.0, 0.445, dz), (0.2, 0.03, 0.115))          # cap square over the trunnion
            for bx in (-0.32, 0.32): cyl_between(iron, (bx, 0.22, dz - 0.07), (bx, 0.22, dz + 0.07), 0.018, 4)  # bolts
    if not lo:
        box(wood, (-0.32, 0.27, 0), (0.12, 0.1, 0.4))                # transom + quoin (elevation wedge) under the breech
        q = box(wood, (-0.3, 0.37, 0), (0.34, 0.08, 0.16))
        for v in q:
            if v.co.x > -0.3: v.co.y -= 0.04
    for dx in (-0.27, 0.27):
        cyl_between(iron, (dx, 0.15, -0.4), (dx, 0.15, 0.4), 0.045, 8 if not lo else 5)   # axletrees
        for dz in (-0.36, 0.36):
            cyl_between(wood, (dx, 0.15, dz - 0.04), (dx, 0.15, dz + 0.04), 0.15, 10 if not lo else 7)   # trucks
            if not lo:
                cyl_between(iron, (dx, 0.15, dz - 0.045), (dx, 0.15, dz + 0.045), 0.155, 10, 0.155)  # iron tyre
                pass
    if not lo:  # breeching rope: from the ring bolts round the cascabel and back (sags a little), + tackle blocks
        pts = [Vector((0.42, 0.42, -0.5)), Vector((0.05, 0.35, -0.42)), Vector((-0.5, 0.5, -0.18)), Vector((-0.6, 0.55, 0)),
               Vector((-0.5, 0.5, 0.18)), Vector((0.05, 0.35, 0.42)), Vector((0.42, 0.42, 0.5))]
        for a, b in zip(pts, pts[1:]): cyl_between(rope, a, b, 0.028, 5)
        for dz in (-0.5, 0.5): box(wood, (0.42, 0.42, dz), (0.08, 0.14, 0.1))
    out = []
    for bm, r in ((wood, 'wood'), (iron, 'iron'), (rope, 'rope')):
        if len(bm.verts) == 0: bm.free(); continue
        o = obj_from_bm(bm, 'carriage_' + r, role_mat(r))
        if r == 'wood' and not lo: bevel(o, 0.012, 1)
        out.append(o)
    return out

def build_figurehead(lo):
    """gilded skull-in-a-tricorn figurehead on scroll brackets. Local frame: stem head at the origin, ship forward = +Z,
    up = +Y; ~1 m tall for the SLOOP (ships.js scales it by the hull's depth / 3.1)."""
    gold, dark, wood = bmesh.new(), bmesh.new(), bmesh.new()
    seg = 10 if lo else 24
    # cranium + jaw
    s = bmesh.ops.create_uvsphere(gold, u_segments=seg, v_segments=seg // 2 + 2, radius=0.34)
    for v in s['verts']:
        v.co = Vector((v.co.x * 0.95, v.co.y * 1.05 + 0.55, v.co.z * 1.0 + 0.35))
    j = box(gold, (0, 0.27, 0.48), (0.42, 0.18, 0.24))
    # teeth row
    for k in range(6 if not lo else 0):
        box(gold, (-0.15 + k * 0.06, 0.37, 0.61), (0.045, 0.08, 0.03))
    # eye sockets + nose (dark insets)
    for sx in (-1, 1):
        e = bmesh.ops.create_uvsphere(dark, u_segments=12, v_segments=8, radius=0.085)
        for v in e['verts']: v.co = Vector((v.co.x + sx * 0.12, v.co.y * 1.1 + 0.56, v.co.z * 0.5 + 0.66))
    n = bmesh.ops.create_cone(dark, cap_ends=True, segments=3, radius1=0.05, radius2=0.0, depth=0.1)
    for v in n['verts']: v.co = Vector((v.co.x, v.co.z + 0.44, v.co.y * 0.4 + 0.67))
    # tricorn hat: three upturned brims around a crown
    c = bmesh.ops.create_cone(wood, cap_ends=True, segments=seg, radius1=0.3, radius2=0.25, depth=0.2)
    for v in c['verts']: v.co += Vector((0, 0.95, 0.33))
    for k in range(3):
        a = k * 2 * math.pi / 3 + math.pi / 2
        b = box(wood, (math.cos(a) * 0.32, 0.92, 0.33 + math.sin(a) * 0.32), (0.42, 0.14, 0.05))
        bmesh.ops.rotate(wood, verts=b, cent=Vector((math.cos(a) * 0.32, 0.92, 0.33 + math.sin(a) * 0.32)), matrix=Matrix.Rotation(-a + math.pi / 2, 3, 'Y') @ Matrix.Rotation(-0.5, 3, 'X'))
    box(gold, (0, 0.88, 0.62), (0.5, 0.04, 0.04))  # gold hat braid
    # scroll brackets (trailboards) sweeping back along the cutwater, both sides
    for sx in (-1, 1):
        pts = [Vector((sx * (0.16 + 0.05 * math.sin(t * 0.9)), 0.25 - 0.55 * t / 8 + 0.12 * math.sin(t * 0.8), 0.2 - 0.25 * t)) for t in range(9)]
        for a, b in zip(pts, pts[1:]): cyl_between(gold, a, b, 0.05 - 0.003 * pts.index(a), 6 if lo else 10)
        # curl at the end
        cx, cy, cz = pts[-1]
        for k in range(8 if not lo else 4):
            a0 = k / 8 * 2 * math.pi; a1 = (k + 1) / 8 * 2 * math.pi; r0 = 0.12 * (1 - k / 10); r1 = 0.12 * (1 - (k + 1) / 10)
            cyl_between(gold, (cx, cy + r0 * math.sin(a0), cz - r0 * math.cos(a0)), (cx, cy + r1 * math.sin(a1), cz - r1 * math.cos(a1)), 0.035, 6)
    # knee (wood) the figure sits on
    k = box(wood, (0, 0.1, 0.08), (0.22, 0.55, 0.42))
    out = []
    for bm, r in ((gold, 'gold'), (dark, 'dark'), (wood, 'wood')):
        o = obj_from_bm(bm, 'figurehead_' + r, role_mat(r))
        for p in o.data.polygons: p.use_smooth = True
        out.append(o)
    return out

def build_stern_carving(lo):
    """gilded scroll board across the transom above the stern windows. Local frame: 1 m wide (x -0.5..0.5, ships.js
    scales x by the cabin width), y 0..0.55, faces -Z (aft); the back sits on z=0."""
    gold = bmesh.new(); wood = bmesh.new()
    box(wood, (0, 0.2, 0.02), (1.02, 0.36, 0.04))
    n = 18 if not lo else 8
    for sx in (-1, 1):  # two mirrored acanthus scrolls meeting at a central shell
        prev = None
        for i in range(n + 1):
            t = i / n; a = t * 2.6 * math.pi; r = 0.13 * (1 - 0.65 * t)
            p = Vector((sx * (0.12 + 0.33 * t + r * math.cos(a) * 0.4), 0.2 + r * math.sin(a), -0.03))
            if prev is not None: cyl_between(gold, prev, p, 0.022 * (1 - 0.5 * t) + 0.008, 6)
            prev = p
    sh = bmesh.ops.create_uvsphere(gold, u_segments=12 if not lo else 6, v_segments=6, radius=0.12)
    for v in sh['verts']: v.co = Vector((v.co.x, max(v.co.y, -0.02) * 1.2 + 0.24, -abs(v.co.z) * 0.4 - 0.02))
    for k in range(7 if not lo else 0):  # shell ribs
        a = math.pi * (k + 0.5) / 7
        cyl_between(gold, (0, 0.22, -0.06), (math.cos(a) * 0.13, 0.22 + math.sin(a) * 0.15, -0.06), 0.012, 4)
    cyl_between(gold, (-0.51, 0.39, -0.02), (0.51, 0.39, -0.02), 0.025, 8)   # top + bottom mouldings
    cyl_between(gold, (-0.51, 0.02, -0.02), (0.51, 0.02, -0.02), 0.025, 8)
    out = []
    for bm, r in ((gold, 'gold'), (wood, 'wood')):
        o = obj_from_bm(bm, 'stern_' + r, role_mat(r)); [setattr(p, 'use_smooth', True) for p in o.data.polygons]; out.append(o)
    return out

def build_lantern(lo):
    """hexagonal brass stern lantern cage (the glow core stays the game's emissive sphere). Local frame = the
    ships.js lantern centre p, size factor 1 (scaled by s): core sphere r 0.22 x1.25 tall."""
    gold = bmesh.new()
    six = 6
    for k in range(six):
        a = 2 * math.pi * k / six
        cyl_between(gold, (0.27 * math.cos(a), -0.3, 0.27 * math.sin(a)), (0.25 * math.cos(a), 0.3, 0.25 * math.sin(a)), 0.022, 4)
    c = bmesh.ops.create_cone(gold, cap_ends=True, segments=six, radius1=0.33, radius2=0.08, depth=0.22)
    for v in c['verts']: v.co = Vector((v.co.x, v.co.z + 0.42, v.co.y))
    c = bmesh.ops.create_cone(gold, cap_ends=True, segments=six, radius1=0.12, radius2=0.31, depth=0.12)
    for v in c['verts']: v.co = Vector((v.co.x, v.co.z - 0.36, v.co.y))
    t = bmesh.ops.create_cone(gold, cap_ends=True, segments=8, radius1=0.04, radius2=0.0, depth=0.18)
    for v in t['verts']: v.co = Vector((v.co.x, v.co.z - 0.5, v.co.y))
    if not lo:
        for k in range(8):
            a0 = 2 * math.pi * k / 8; a1 = 2 * math.pi * (k + 1) / 8
            cyl_between(gold, (0.06 * math.cos(a0), 0.6 + 0.06 * math.sin(a0), 0), (0.06 * math.cos(a1), 0.6 + 0.06 * math.sin(a1), 0), 0.015, 4)
    o = obj_from_bm(gold, 'lantern_gold', role_mat('gold')); return [o]

def build_channel(lo):
    """chain-wale (channel) with 3 deadeyes + chainplates, for one mast on the PORT side. Local frame: hull side at
    the gunwale, x = outward, z along the ship (1 m long, scaled), y = 0 at the gunwale cap."""
    wood, iron, dark = bmesh.new(), bmesh.new(), bmesh.new()
    box(wood, (0.14, -0.15, 0), (0.28, 0.08, 1.2))
    for k in range(3):
        z = -0.4 + k * 0.4
        d = bmesh.ops.create_cone(dark, cap_ends=True, segments=12 if not lo else 6, radius1=0.09, radius2=0.09, depth=0.06)
        for v in d['verts']: v.co = Vector((v.co.z + 0.24, v.co.y * 1.0 + 0.0, v.co.x + z))
        cyl_between(iron, (0.24, -0.08, z), (0.2, -0.9, z), 0.022, 5)       # chainplate down the side
    out = []
    for bm, r in ((wood, 'wood'), (iron, 'iron'), (dark, 'dark')):
        out.append(obj_from_bm(bm, 'channel_' + r, role_mat(r)))
    return out

def bake_ao_to_vcol(objs):
    """AO of each piece (all pieces of the same hero mesh together) baked into a COLOR_0 attribute"""
    sc = bpy.context.scene; sc.cycles.samples = max(16, SAMPLES)
    sc.render.bake.use_selected_to_active = False; sc.render.bake.target = 'VERTEX_COLORS'
    for o in objs:
        if not o.data.color_attributes: o.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.bake(type='AO')
    sc.render.bake.target = 'IMAGE_TEXTURES'
    for o in objs:  # lift: AO only darkens creases (min 0.45) so skins stay bright
        ca = o.data.color_attributes[0]
        vals = [d.color[0] for d in ca.data]
        for d in ca.data: c = d.color; a = 0.45 + 0.55 * min(1.0, c[0] * 1.15); d.color = (a, a, a, 1)
        print(f'[kit]   AO {o.name}: min {min(vals):.2f} mean {sum(vals)/len(vals):.2f}', flush=True)

def uv_box(o, scale=1.0):
    """box-project UVs in metres x `scale` so the skin's painted wood / metal canvas tiles at a sane size"""
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.cube_project(cube_size=1.0 / scale, correct_aspect=False, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')

def build_kit(lo):
    reset(); ROLE.clear()
    groups = {'barrel': build_barrel, 'carriage': build_carriage, 'figurehead': build_figurehead, 'stern': build_stern_carving, 'lantern': build_lantern, 'channel': build_channel}
    allobjs = []
    for gname, fn in groups.items():
        objs = fn(lo)
        for o in objs: uv_box(o, 0.6)
        # bake AO with only this group visible (each piece is used alone in the game)
        for o in bpy.context.scene.objects: o.hide_render = o not in objs
        bake_ao_to_vcol(objs)
        allobjs += objs
    for o in bpy.context.scene.objects: o.hide_render = False
    # three.js is Y-up like these builders; the glTF exporter converts Blender Z-up -> Y-up, so pre-rotate.
    for o in allobjs:
        o.data.transform(Matrix.Rotation(math.radians(90), 4, 'X')); o.data.update()
    tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in allobjs)
    path = f'{OUT}/player_kit{"_lo" if lo else ""}_raw.glb'
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=False, export_yup=True, export_apply=True,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_materials='EXPORT', export_normals=True, export_texcoords=True)
    print(f'[kit] {"LOW" if lo else "HIGH"} glb {path} tris={tri}', flush=True)
    for o in allobjs: print('[kit]   ', o.name, sum(len(p.vertices) - 2 for p in o.data.polygons), flush=True)

if __name__ == '__main__':
    what = os.environ.get('KIT_WHAT', 'tiles,hi,lo').split(',')
    if 'tiles' in what: build_tiles()
    if 'hi' in what: build_kit(False)
    if 'lo' in what: build_kit(True)
    print('[kit] done', flush=True)
