# [Raul] PUMPFUN PIRATES island: scripted Blender town kit (hero assets for the street + harbor piers).
#   blender -b -P town_kit_blender.py -- BUILD_DIR
# Every piece is modelled in game units (metres, +y up, front = +z), UV-mapped onto ONE shared trim sheet
# (tools/island/trimsheet.py: tiling plaster / timber / plank / roof / stone / rubble strips + door, window, shutter cells),
# bevelled on LOD0, contact AO baked into vertex colours with Cycles (x a per-piece tint), and exported as one glTF with
# LOD0 + LOD1 meshes per asset. Compression (meshopt + webp) runs after, with gltf-transform.
import bpy, bmesh, json, math, sys, os
from mathutils import Matrix, Vector
OUT = sys.argv[sys.argv.index('--') + 1]
R = json.load(open(os.path.join(OUT, 'trim_regions.json')))
# nominal metres the strip height stands for (sets U density along tiling strips)
MH = dict(plaster0=3.4, plaster1=3.4, plaster2=3.4, plaster3=3.4, timber=0.35, planks=1.6, roof=4.0, stone=3.4, rubble=1.2)
SOLID = {'iron', 'rope', 'gold', 'cloth', 'lamp', 'dark'}
FIT = {'door', 'window', 'windowLit', 'shutter0', 'shutter1', 'shutter2', 'shutter3', 'iron', 'rope', 'gold', 'cloth', 'lamp', 'dark'}

class Mesh:
    def __init__(s): s.v = []; s.f = []; s.uv = []; s.col = []
    def poly(s, pts, uvs, tint):
        b = len(s.v); s.v += [tuple(p) for p in pts]; s.f.append(list(range(b, b + len(pts)))); s.uv.append(uvs); s.col.append(tint)
def region_uv(reg, a, b, a0, a1, b0, b1, flipb=False):
    r = R[reg]; tb = (b - b0) / max(1e-6, b1 - b0)
    if flipb: tb = 1 - tb
    v = r['v0'] + tb * (r['v1'] - r['v0'])
    if reg in SOLID:  # flat-ish swatches: sample the middle only, so mip levels never bleed the neighbour cell in
        cu, cv = (r['u0'] + r['u1']) / 2, (r['v0'] + r['v1']) / 2; return (cu + ((a - a0) / max(1e-6, a1 - a0) - 0.5) * (r['u1'] - r['u0']) * 0.2, cv + (tb - 0.5) * (r['v1'] - r['v0']) * 0.2)
    if reg in FIT: u = r['u0'] + (a - a0) / max(1e-6, a1 - a0) * (r['u1'] - r['u0'])
    else: span = MH[reg] * (2048 * (r['u1'] - r['u0'])) / (2048 * (r['v1'] - r['v0'])); u = a / span
    return (u, v)
def xf(T, p): q = T @ Vector((p[0], p[1], p[2], 1)); return (q[0], q[1], q[2])
def T_(x=0, y=0, z=0, ry=0, rx=0, rz=0, s=(1, 1, 1)):
    return Matrix.Translation((x, y, z)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(rz, 4, 'Z') @ Matrix.Diagonal((s[0], s[1], s[2], 1))
STACK = [Matrix.Identity(4)]
class at:
    def __init__(s, T): s.T = T
    def __enter__(s): STACK.append(STACK[-1] @ s.T)
    def __exit__(s, *a): STACK.pop()
def box(m, w, h, d, reg, T=None, mode='up', tint=(1, 1, 1), faces='all', regs=None):
    """axis-aligned box (centre origin) with per-face trim UVs. mode 'up': side faces fit V to height; 'long': V fits the
    face's shorter side (beams / planks); regs: per-face override {'+z': 'door', ...}"""
    M_ = STACK[-1] @ (T or Matrix.Identity(4)); x, y, z = w / 2, h / 2, d / 2
    F = {'+z': ([(-x, -y, z), (x, -y, z), (x, y, z), (-x, y, z)], 0, 1), '-z': ([(x, -y, -z), (-x, -y, -z), (-x, y, -z), (x, y, -z)], 0, 1),
         '+x': ([(x, -y, z), (x, -y, -z), (x, y, -z), (x, y, z)], 2, 1), '-x': ([(-x, -y, -z), (-x, -y, z), (-x, y, z), (-x, y, -z)], 2, 1),
         '+y': ([(-x, y, z), (x, y, z), (x, y, -z), (-x, y, -z)], 0, 2), '-y': ([(-x, -y, -z), (x, -y, -z), (x, -y, z), (-x, -y, z)], 0, 2)}
    for k, (pts, ai, bi) in F.items():
        if faces != 'all' and k not in faces: continue
        rg = (regs or {}).get(k, reg)
        A_ = [p[ai] for p in pts]; B_ = [p[bi] for p in pts]
        if mode == 'long' and (max(A_) - min(A_)) < (max(B_) - min(B_)): A_, B_ = B_, A_
        uvs = [region_uv(rg, a, b, min(A_), max(A_), min(B_), max(B_)) for a, b in zip(A_, B_)]
        if k in ('-z', '+x') and rg in FIT: uvs = [region_uv(rg, -a, b, -max(A_), -min(A_), min(B_), max(B_)) for a, b in zip(A_, B_)]
        m.poly([xf(M_, p) for p in pts], uvs, tint)
def cyl(m, r0, r1, h, n, reg, T=None, tint=(1, 1, 1), caps=True, vert=False):
    """cylinder along y (centre origin). vert=True: strip runs along the height (barrel staves, posts)"""
    M_ = STACK[-1] @ (T or Matrix.Identity(4)); circ = math.pi * (r0 + r1)
    for i in range(n):
        a0, a1 = i / n * 2 * math.pi, (i + 1) / n * 2 * math.pi
        pts = [(math.cos(a0) * r0, -h / 2, math.sin(a0) * r0), (math.cos(a0) * r1, h / 2, math.sin(a0) * r1), (math.cos(a1) * r1, h / 2, math.sin(a1) * r1), (math.cos(a1) * r0, -h / 2, math.sin(a1) * r0)]
        s0, s1 = i / n * circ, (i + 1) / n * circ
        if vert: uvs = [region_uv(reg, y + h / 2, s, 0, h, s0, s1) for (y, s) in [(-h / 2, s0), (h / 2, s0), (h / 2, s1), (-h / 2, s1)]]
        else: uvs = [region_uv(reg, s, y, s0, s1, -h / 2, h / 2) if reg in FIT else region_uv(reg, s, y, 0, circ, -h / 2, h / 2) for (s, y) in [(s0, -h / 2), (s0, h / 2), (s1, h / 2), (s1, -h / 2)]]
        m.poly([xf(M_, p) for p in pts][::-1], uvs[::-1], tint)
    if caps:
        for y, r, sg in [(h / 2, r1, 1), (-h / 2, r0, -1)]:
            pts = [(math.cos(i / n * 2 * math.pi) * r, y, math.sin(i / n * 2 * math.pi) * r) for i in range(n)]
            if sg > 0: pts = pts[::-1]
            uvs = [region_uv(reg, p[0], p[2], -r, r, -r, r) if reg in FIT else region_uv(reg, p[0], p[2], -r, r, -r, r) for p in pts]
            m.poly([xf(M_, p) for p in pts], uvs, tint)
def prism(m, w, d, rise, reg, T=None, tint=(1, 1, 1)):  # gable triangles (both ends) of a roof: x across, z depth
    M_ = STACK[-1] @ (T or Matrix.Identity(4))
    for sx in (-1, 1):
        pts = [(sx * w / 2, 0, -d / 2), (sx * w / 2, 0, d / 2), (sx * w / 2, rise, 0)]
        if sx < 0: pts = pts[::-1]
        uvs = [region_uv(reg, p[2], p[1], -d / 2, d / 2, 0, 3.4) for p in pts]
        m.poly([xf(M_, p) for p in pts], uvs, tint)

def to_object(name, m, bevel=0.0, coll=None):
    me = bpy.data.meshes.new(name)
    # game (x, y up, z front) -> Blender (x, -z, y); the glTF exporter (+Y up) maps it straight back
    me.from_pydata([(p[0], -p[2], p[1]) for p in m.v], [], m.f); me.update()
    me.uv_layers.new(name='UVMap'); me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER'); uvl = me.uv_layers['UVMap']; ca = me.color_attributes['Col']  # re-fetch: adding a layer reallocates
    li = 0
    for pi, poly in enumerate(me.polygons):
        for k, l in enumerate(poly.loop_indices): uvl.data[l].uv = m.uv[pi][k]; c = m.col[pi]; ca.data[l].color = (c[0], c[1], c[2], 1)
    ob = bpy.data.objects.new(name, me); (coll or bpy.context.scene.collection).objects.link(ob)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    wd = ob.modifiers.new('weld', 'WELD'); wd.merge_threshold = 0.0005; bpy.ops.object.modifier_apply(modifier='weld')  # each box becomes one closed shell
    if bevel > 0:
        md = ob.modifiers.new('bev', 'BEVEL'); md.width = bevel; md.segments = 1; md.limit_method = 'ANGLE'; md.angle_limit = math.radians(50); md.harden_normals = True
        bpy.ops.object.modifier_apply(modifier='bev')
    for p in me.polygons: p.use_smooth = False
    ob.select_set(False)
    return ob

# ---------------- assets ----------------
PL = ['plaster0', 'plaster1', 'plaster2', 'plaster3']
def house(name, w, d, fl, v, lod, stone_ground=False, roof_tint=(1, 1, 1), squad=False):
    m = Mesh(); fh = 3.4; wall = PL[v % 4]; sh = 'shutter%d' % (v % 4); hi = lod == 0; WD = (0.95, 0.9, 0.85)
    box(m, w + 0.5, 1.0, d + 0.5, 'stone', T_(0, 0.1, 0), tint=(0.85, 0.85, 0.85))                                   # plinth
    for f in range(fl):
        yy = 0.6 + f * fh; ww = w + (0.5 if f else 0); dd = d + (0.3 if f else 0)
        reg = 'stone' if (f == 0 and stone_ground) else wall
        box(m, ww, fh, dd, reg, T_(0, yy + fh / 2, 0), faces=['+z', '-z', '+x', '-x'])
        box(m, ww + 0.16, 0.3, dd + 0.16, 'timber', T_(0, yy + fh - 0.12, 0), mode='long')                          # floor beam
        if f > 0:                                                                                                   # half-timber posts + braces
            for sx in (-1, 1): box(m, 0.3, fh, 0.3, 'timber', T_(sx * (ww / 2 - 0.05), yy + fh / 2, dd / 2 + 0.03), mode='long')
            if hi:
                for sx in (-1, 1): box(m, 0.2, fh * 1.08, 0.12, 'timber', T_(sx * (ww / 2 - 0.9), yy + fh / 2, dd / 2 + 0.07, rz=sx * 0.55), mode='long')
        nw = max(1, int(w // 3.0))
        if squad and f == 2:                                                                                        # SQUAD HALL sign board on the facade
            box(m, 7.4, 1.9, 0.22, 'timber', T_(0, yy + 1.9, dd / 2 + 0.11), mode='long')
            box(m, 7.0, 1.5, 0.06, 'dark', T_(0, yy + 1.9, dd / 2 + 0.25), faces=['+z'])
            for sx in (-1, 1): box(m, 0.12, 0.6, 0.12, 'iron', T_(sx * 3.4, yy + 3.0, dd / 2 + 0.2))
        for i in range(nw):
            wx = (i - (nw - 1) / 2) * (w / nw); fz = dd / 2
            if squad and f == 2 and abs(wx) < 3.5: continue
            if f == 0 and i == nw // 2:                                                                             # door in a stone surround
                box(m, 2.0, 3.0, 0.3, 'stone', T_(wx, yy + 1.5, fz + 0.06), faces=['+z', '+x', '-x', '+y'], tint=(0.8, 0.8, 0.8))
                box(m, 1.4, 2.5, 0.14, 'door', T_(wx, yy + 1.25, fz + 0.2), faces=['+z'])
                box(m, 2.1, 0.25, 0.9, 'stone', T_(wx, 0.62, fz + 0.45), tint=(0.8, 0.8, 0.8))                       # step
                box(m, 0.1, 0.5, 0.3, 'iron', T_(wx + 1.25, yy + 2.6, fz + 0.3))
                box(m, 0.36, 0.42, 0.36, 'lamp', T_(wx + 1.25, yy + 2.3, fz + 0.45))                                 # door lantern (emissive)
                box(m, 0.44, 0.08, 0.44, 'iron', T_(wx + 1.25, yy + 2.55, fz + 0.45))
                continue
            lit = ((i * 7 + f * 3 + v) % 5) < 2
            box(m, 1.3, 1.7, 0.16, 'timber', T_(wx, yy + 1.9, fz + 0.03), faces=['+z', '+x', '-x', '+y', '-y'], mode='long')
            box(m, 1.05, 1.45, 0.08, 'windowLit' if lit else 'window', T_(wx, yy + 1.9, fz + 0.1), faces=['+z'])
            box(m, 1.6, 0.14, 0.4, 'stone', T_(wx, yy + 1.0, fz + 0.2), tint=(0.85, 0.85, 0.85))                     # sill
            for s in (-1, 1): box(m, 0.62, 1.6, 0.06, sh, T_(wx + s * 0.98, yy + 1.9, fz + 0.32, ry=s * 0.5), faces=['+z', '-z'])
            if hi and f > 0 and (i + f + v) % 2 == 0:                                                              # flower box
                box(m, 1.3, 0.3, 0.35, 'planks', T_(wx, yy + 0.85, fz + 0.4), mode='long')
                for p in range(4): box(m, 0.26, 0.22, 0.26, 'cloth', T_(wx - 0.45 + p * 0.3, yy + 1.1, fz + 0.4, ry=p), tint=[(1, 0.4, 0.5), (1, 0.9, 0.3), (1, 1, 1), (0.7, 0.45, 1)][(p + i + v) % 4] if False else [(1.2, 0.35, 0.45), (1.3, 1.2, 0.4), (1.4, 1.4, 1.4), (0.8, 0.5, 1.3)][(p + i + v) % 4])
        if f > 0:                                                                                                   # balcony: deck, rail, balusters, brackets
            box(m, ww - 0.6, 0.2, 1.3, 'planks', T_(0, yy + 0.1, dd / 2 + 0.65), mode='long')
            box(m, ww - 0.6, 0.12, 0.14, 'timber', T_(0, yy + 1.15, dd / 2 + 1.25), mode='long')
            step = 0.42 if hi else 1.2; b = -(ww - 0.6) / 2
            while b <= (ww - 0.6) / 2 + 0.01:
                (cyl(m, 0.045, 0.05, 1.0, 6, 'timber', T_(b, yy + 0.65, dd / 2 + 1.25), caps=False, vert=True) if hi else box(m, 0.09, 1.0, 0.09, 'timber', T_(b, yy + 0.65, dd / 2 + 1.25), mode='long')); b += step
            for sx in (-1, 0, 1): box(m, 0.18, 0.9, 0.18, 'timber', T_(sx * (ww / 2 - 0.6), yy - 0.3, dd / 2 + 0.55, rx=0.75), mode='long')
    top = 0.6 + fl * fh; pitch = 0.6; half = d / 2 + 0.9; slab = half / math.cos(pitch); rise = math.tan(pitch) * half
    for s in (-1, 1):                                                                                               # tile roof slabs + fascia
        box(m, w + 1.4, 0.26, slab, 'roof', T_(0, top + rise / 2, s * half / 2, rx=s * pitch), tint=roof_tint, faces=['+y'], mode='up')
        box(m, w + 1.4, 0.26, slab, 'timber', T_(0, top + rise / 2, s * half / 2, rx=s * pitch), faces=['-y', '+x', '-x', '+z', '-z'], mode='long')
    cyl(m, 0.24, 0.24, w + 1.5, 8 if hi else 5, 'roof', T_(0, top + rise + 0.05, 0, rz=math.pi / 2), tint=roof_tint)  # ridge
    prism(m, w + 0.5, d + 0.3, rise - 0.1, wall, T_(0, top, 0))
    box(m, 0.9, 2.6, 0.9, 'stone', T_(w * 0.3, top + rise * 0.6 + 0.9, -d * 0.18))                                 # chimney + cap
    box(m, 1.15, 0.25, 1.15, 'stone', T_(w * 0.3, top + rise * 0.6 + 2.25, -d * 0.18), tint=(0.7, 0.7, 0.7))
    if squad:                                                                                                       # Squad Hall: banners + double door + porch columns
        for sx in (-5.5, 5.5): box(m, 1.8, 4.6, 0.1, 'cloth', T_(sx, 7.5, d / 2 + 0.75 + 0.35, rx=0.0), faces=['+z', '-z'])
        for sx in (-3.2, 3.2): cyl(m, 0.35, 0.4, 4.2, 10 if hi else 6, 'stone', T_(sx, 2.7, d / 2 + 2.2))
        box(m, 8.0, 0.5, 3.4, 'stone', T_(0, 5.0, d / 2 + 1.7), tint=(0.85, 0.85, 0.85))
    return m
def barrel(m, T):
    with at(T):
        cyl(m, 0.55, 0.62, 0.75, 12, 'planks', T_(0, 0.375, 0), caps=False, vert=True); cyl(m, 0.62, 0.55, 0.75, 12, 'planks', T_(0, 1.125, 0), caps=False, vert=True)
        for y in (0.15, 1.35): cyl(m, 0.6, 0.6, 0.08, 12, 'dark', T_(0, y, 0), caps=False)
        for y in (0.45, 1.05): cyl(m, 0.65, 0.65, 0.1, 12, 'iron', T_(0, y, 0), caps=False)
        cyl(m, 0.54, 0.54, 0.02, 12, 'planks', T_(0, 1.49, 0))
def crate(m, T, s=1.2):
    with at(T):
        box(m, s, s, s, 'planks', T_(0, s / 2, 0), mode='long')
        for y in (0.08, s - 0.08):
            for (w, d, x, z) in [(s + 0.06, 0.14, 0, s / 2), (s + 0.06, 0.14, 0, -s / 2), (0.14, s + 0.06, s / 2, 0), (0.14, s + 0.06, -s / 2, 0)]: box(m, w, 0.14, d, 'timber', T_(x, y, z), mode='long')
        for (x, z, ry) in [(0, s / 2 + 0.04, 0), (0, -s / 2 - 0.04, 0), (s / 2 + 0.04, 0, math.pi / 2), (-s / 2 - 0.04, 0, math.pi / 2)]:
            box(m, s * 1.25, 0.14, 0.05, 'timber', T_(x, s / 2, z, ry=ry, rz=0.78), mode='long')
def lamp_post(m, T):
    with at(T):
        cyl(m, 0.12, 0.09, 3.6, 8, 'iron', T_(0, 1.8, 0), vert=True); cyl(m, 0.25, 0.25, 0.3, 8, 'iron', T_(0, 0.15, 0))
        box(m, 0.44, 0.5, 0.44, 'lamp', T_(0, 3.75, 0)); 
        for sx in (-1, 1):
            for sz in (-1, 1): box(m, 0.05, 0.52, 0.05, 'iron', T_(sx * 0.23, 3.75, sz * 0.23))
        cyl(m, 0.36, 0.02, 0.35, 4, 'iron', T_(0, 4.15, 0, ry=math.pi / 4)); box(m, 0.5, 0.06, 0.5, 'iron', T_(0, 3.48, 0))
def torch_post(m, T):
    with at(T):
        cyl(m, 0.14, 0.1, 2.6, 7, 'timber', T_(0, 1.3, 0), vert=True); cyl(m, 0.18, 0.3, 0.4, 8, 'iron', T_(0, 2.7, 0))
        for k in range(3): cyl(m, 0.16, 0.16, 0.08, 7, 'rope', T_(0, 1.9 + k * 0.12, 0), caps=False)
def chest(m, T):
    with at(T):
        box(m, 1.7, 1.0, 1.1, 'planks', T_(0, 0.5, 0), mode='long')
        for sx in (-0.7, 0.7): box(m, 0.12, 1.04, 1.14, 'iron', T_(sx, 0.5, 0))
        box(m, 1.75, 0.3, 1.15, 'planks', T_(0, 1.15, 0), mode='long'); box(m, 0.3, 0.3, 0.1, 'gold', T_(0, 0.95, 0.58))
def sacks(m, T):
    with at(T):
        for i in range(3): cyl(m, 0.45, 0.32, 0.75, 8, 'rope', T_(i * 0.7 - 0.7, 0.36, 0, ry=i), tint=(1.0, 0.95, 0.85))
# harbor pier modules (pier frame: +z along the stem / outward, +x across). Deck top at y = 0.16 (PIER.y + 0.16 in game).
def pier_stem(m, L, W, hi):
    n = max(1, round(L / 0.62))
    for i in range(n):  # planks across the stem, slight per-plank jitter + gaps
        z = -L / 2 + (i + 0.5) * L / n; tv = 0.85 + 0.15 * ((i * 37) % 7) / 7
        box(m, W + ((i * 7) % 3) * 0.08, 0.14, L / n - 0.05, 'planks', T_(((i * 13) % 5 - 2) * 0.015, 0.09, z, ry=((i * 11) % 5 - 2) * 0.006), mode='long', tint=(tv, tv, tv))
    for sx in (-1, 1): box(m, 0.3, 0.45, L, 'timber', T_(sx * (W / 2 - 0.4), -0.22, 0), mode='long')                 # stringers
    box(m, W + 0.4, 0.4, 0.4, 'timber', T_(0, -0.42, -L / 2 + 0.3), mode='long'); box(m, W + 0.4, 0.4, 0.4, 'timber', T_(0, -0.42, L / 2 - 0.3), mode='long')
    for sx in (-1, 1):
        cyl(m, 0.36, 0.42, 9.0, 10 if hi else 6, 'timber', T_(sx * (W / 2 + 0.1), -4.3, 0), vert=True)          # pilings
        cyl(m, 0.44, 0.44, 0.1, 10 if hi else 6, 'rope', T_(sx * (W / 2 + 0.1), -1.0, 0), caps=False)
        box(m, 0.16, 1.0, 0.16, 'timber', T_(sx * (W / 2 - 0.1), 0.65, -L / 2 + 0.3), mode='long')              # rail post
        box(m, 0.12, 0.12, L, 'rope', T_(sx * (W / 2 - 0.1), 1.05, 0), mode='long')                               # rope rail
def pier_head(m, L, D, hi):  # a head module L wide (x) and D deep (z), centred
    n = max(1, round(L / 0.62))
    for i in range(n):
        x = -L / 2 + (i + 0.5) * L / n; tv = 0.85 + 0.15 * ((i * 37) % 7) / 7
        box(m, L / n - 0.05, 0.14, D + ((i * 7) % 3) * 0.06, 'planks', T_(x, 0.09, 0), mode='long', tint=(tv, tv, tv))
    box(m, L, 0.45, 0.4, 'timber', T_(0, -0.3, D / 2 + 0.1), mode='long'); box(m, L, 0.45, 0.4, 'timber', T_(0, -0.3, -D / 2 - 0.1), mode='long')
    for x in (-L / 2 + 0.5, L / 2 - 0.5):
        for z in (-D / 2 + 0.2, D / 2 - 0.2): cyl(m, 0.42, 0.46, 9.0, 10 if hi else 6, 'timber', T_(x, -4.3, z), vert=True)
    if hi:
        for x in (-L / 4, L / 4): cyl(m, 0.42, 0.42, 0.4, 8, 'dark', T_(x, -0.9, D / 2 + 0.35, rx=math.pi / 2))      # fenders (tyre-ish rope bumpers)
def bollard(m, T):
    with at(T): cyl(m, 0.34, 0.42, 0.85, 10, 'iron', T_(0, 0.42, 0)); cyl(m, 0.5, 0.5, 0.16, 10, 'iron', T_(0, 0.9, 0))

def lighthouse(m, hi):  # origin = ground; dressed-stone base, red / cream banded tower, gallery, lantern room, cap
    sg = 20 if hi else 10
    cyl(m, 6.6, 7.4, 3.4, sg, 'stone', T_(0, 1.4, 0)); cyl(m, 6.2, 6.6, 0.4, sg, 'stone', T_(0, 3.3, 0), tint=(0.8, 0.8, 0.8))
    for b in range(6):
        r0 = 3.4 - b * 0.17; red = b % 2 == 0
        cyl(m, r0, r0 - 0.17, 4.0, sg, 'plaster0', T_(0, 5.2 + b * 4, 0), tint=(1.05, 0.34, 0.3) if red else (1, 1, 1), caps=False)
        cyl(m, r0 + 0.12, r0 + 0.12, 0.35, sg, 'stone', T_(0, 3.2 + b * 4, 0), tint=(0.75, 0.75, 0.75))
    cyl(m, 3.4, 2.6, 0.6, sg, 'stone', T_(0, 27.4, 0), tint=(0.8, 0.8, 0.8))
    for i in range(16 if hi else 8):
        a = i / (16 if hi else 8) * 2 * math.pi; box(m, 0.08, 1.1, 0.08, 'iron', T_(math.cos(a) * 3.2, 28.25, math.sin(a) * 3.2))
    cyl(m, 3.25, 3.25, 0.1, sg, 'iron', T_(0, 28.8, 0), caps=False)
    cyl(m, 1.85, 1.85, 2.6, 12 if hi else 8, 'lamp', T_(0, 29.0, 0))
    for i in range(8):
        a = i / 8 * 2 * math.pi; box(m, 0.16, 2.7, 0.16, 'iron', T_(math.cos(a) * 1.9, 29.0, math.sin(a) * 1.9))
    cyl(m, 2.7, 0.15, 2.6, sg, 'roof', T_(0, 31.6, 0), tint=(0.75, 0.32, 0.28)); cyl(m, 2.75, 2.75, 0.25, sg, 'iron', T_(0, 30.35, 0))
    cyl(m, 0.3, 0.05, 1.4, 8, 'gold', T_(0, 33.4, 0))
    box(m, 1.6, 2.6, 0.3, 'stone', T_(0, 4.6, 3.35), tint=(0.8, 0.8, 0.8), faces=['+z', '+x', '-x', '+y']); box(m, 1.2, 2.2, 0.1, 'door', T_(0, 4.5, 3.48), faces=['+z'])
    for (a, y) in [(0.6, 10.5), (2.4, 14.5), (4.0, 18.5), (5.6, 22.5)]:
        r = 3.25 - (y - 3.2) / 4 * 0.17; box(m, 0.7, 1.1, 0.12, 'windowLit' if a > 3 else 'window', T_(math.sin(a) * r, y, math.cos(a) * r, ry=a), faces=['+z'])
def fort(m, hi, H=16):  # the dock-town lookout fort (art.js tower(): origin = groundY - 0.6, gate gap at +z)
    N, WR = (22 if hi else 14), 9.5; sg = 16 if hi else 10
    for i in range(N):
        a = (i + 0.5) / N * 2 * math.pi
        if abs(math.atan2(math.sin(a - math.pi / 2), math.cos(a - math.pi / 2))) < 0.3: continue
        x, z, L = math.cos(a) * WR, math.sin(a) * WR, 2 * math.pi * WR / N + 0.25
        box(m, L, 6.4, 1.2, 'stone', T_(x, 0.0, z, ry=-(a + math.pi / 2)), tint=(1, 1, 1) if i % 3 else (0.85, 0.88, 0.95))
        box(m, L + 0.1, 0.3, 1.4, 'stone', T_(x, 3.2, z, ry=-(a + math.pi / 2)), tint=(0.75, 0.75, 0.75))
        if i % 2 == 0: box(m, 1.1, 0.9, 1.3, 'stone', T_(x, 3.8, z, ry=-(a + math.pi / 2)))
    for da in (-0.3, 0.3):
        a = math.pi / 2 + da; cyl(m, 1.25, 1.1, 6.6, 10 if hi else 6, 'stone', T_(math.cos(a) * WR, 0.6, math.sin(a) * WR), tint=(0.85, 0.85, 0.85))
        cyl(m, 1.4, 1.4, 0.4, 10 if hi else 6, 'stone', T_(math.cos(a) * WR, 4.0, math.sin(a) * WR), tint=(0.7, 0.7, 0.7))
    box(m, 3.4, 0.9, 1.4, 'timber', T_(0, 2.7, WR), mode='long')
    cyl(m, 4.9, 4.4, H + 3, sg, 'stone', T_(0, (H + 3) / 2 - 3, 0), caps=False)
    for y in (5, 10.5): cyl(m, 4.68, 4.68, 0.45, sg, 'stone', T_(0, y, 0), tint=(0.72, 0.72, 0.72), caps=False)
    cyl(m, 4.6, 5.3, 1.0, sg, 'stone', T_(0, H + 0.2, 0), tint=(0.8, 0.8, 0.8))
    for k in range(10):
        a = k / 10 * 2 * math.pi; box(m, 1.3, 1.1, 0.8, 'stone', T_(math.cos(a) * 4.9, H + 1.2, math.sin(a) * 4.9, ry=-a + math.pi / 2))
    for (a, y, lit) in [(1.2, 8, 1), (2.6, 12.5, 0), (-0.4, 12.5, 1), (3.8, 8, 0)]:
        box(m, 0.7, 1.7, 0.14, 'windowLit' if lit else 'window', T_(math.cos(a) * 4.62, y, math.sin(a) * 4.62, ry=-a + math.pi / 2), faces=['+z'])
    box(m, 2.6, 3.6, 0.5, 'stone', T_(0, 1.5, 4.5), tint=(0.75, 0.75, 0.75), faces=['+z', '+x', '-x', '+y']); box(m, 2.0, 3.0, 0.1, 'door', T_(0, 1.3, 4.78), faces=['+z'])
    tx, tz = 2.2, -2.0
    cyl(m, 2.1, 1.9, 6.2, 12 if hi else 8, 'stone', T_(tx, H + 3.6, tz)); cyl(m, 2.9, 0.12, 4.4, 12 if hi else 8, 'roof', T_(tx, H + 8.9, tz))
    box(m, 0.5, 1.2, 0.12, 'windowLit', T_(tx, H + 4.5, tz + 1.95), faces=['+z'])
def bridge_tower(m, hi):  # rope-bridge anchor frame: two leaning posts, cross beam, braces, rope wraps, stone footings, lantern
    for sx in (-1, 1):
        box(m, 1.2, 0.6, 1.2, 'stone', T_(sx * 1.9, 0.1, 0), tint=(0.8, 0.8, 0.8))
        box(m, 0.42, 5.4, 0.42, 'timber', T_(sx * 1.85, 2.9, 0, rz=sx * 0.04), mode='long')
        for k in range(3): cyl(m, 0.3, 0.3, 0.16, 8, 'rope', T_(sx * 1.83, 1.5 + k * 0.22, 0), caps=False)
        box(m, 0.22, 2.6, 0.22, 'timber', T_(sx * 1.2, 4.3, 0, rz=sx * -0.7), mode='long')
    box(m, 4.6, 0.42, 0.46, 'timber', T_(0, 5.45, 0), mode='long'); box(m, 4.8, 0.2, 0.6, 'planks', T_(0, 5.75, 0), mode='long')
    box(m, 0.08, 0.7, 0.08, 'iron', T_(0, 5.0, 0)); box(m, 0.4, 0.5, 0.4, 'lamp', T_(0, 4.5, 0)); box(m, 0.48, 0.07, 0.48, 'iron', T_(0, 4.78, 0))
def bridge_plank(m, hi):
    box(m, 3.0, 0.13, 0.5, 'planks', T_(0, 0, 0), mode='long')
    for sx in (-1, 1): box(m, 0.16, 0.2, 0.56, 'rope', T_(sx * 1.32, 0, 0))
def rope_seg(m, hi):  # unit rope along +z (0..1), radius 1: scaled per segment in game
    cyl(m, 1.0, 1.0, 1.0, 6 if hi else 4, 'rope', T_(0, 0, 0.5, rx=math.pi / 2), caps=False, vert=True)

ASSETS = {}
def asset(name, fn):
    for lod in (0, 1):
        m = Mesh(); fn(m, lod); ASSETS[f'{name}_LOD{lod}'] = m
HV = [(7, 2, 0, False, (1, 1, 1)), (9, 2, 1, True, (0.92, 0.78, 0.7)), (11, 3, 2, False, (1, 0.9, 0.85)), (7, 3, 3, True, (0.85, 0.85, 1.0)), (9, 3, 0, False, (1.05, 0.95, 0.8)), (11, 2, 1, True, (0.9, 1.0, 0.9))]
for i, (w, fl, v, sg, rt) in enumerate(HV):
    ASSETS[f'house{i}_LOD0'] = house(f'house{i}', w, 9, fl, v + i, 0, sg, rt); ASSETS[f'house{i}_LOD1'] = house(f'house{i}', w, 9, fl, v + i, 1, sg, rt)
ASSETS['squadhall_LOD0'] = house('squadhall', 16, 14, 3, 3, 0, True, (0.85, 0.9, 1.0), True); ASSETS['squadhall_LOD1'] = house('squadhall', 16, 14, 3, 3, 1, True, (0.85, 0.9, 1.0), True)
for nm, fn in [('barrel', lambda m, l: barrel(m, T_())), ('crate', lambda m, l: crate(m, T_())), ('lamp', lambda m, l: lamp_post(m, T_())), ('torch', lambda m, l: torch_post(m, T_())),
               ('chest', lambda m, l: chest(m, T_())), ('sacks', lambda m, l: sacks(m, T_())), ('bollard', lambda m, l: bollard(m, T_())),
               ('pierStem', lambda m, l: pier_stem(m, 6.0, 5.0, l == 0)), ('lighthouse', lambda m, l: lighthouse(m, l == 0)), ('fort', lambda m, l: fort(m, l == 0)),
               ('bridgeTower', lambda m, l: bridge_tower(m, l == 0)), ('bridgePlank', lambda m, l: bridge_plank(m, l == 0)), ('ropeSeg', lambda m, l: rope_seg(m, l == 0)), ('pierHead', lambda m, l: pier_head(m, 6.0, 4.0, l == 0))]:
    asset(nm, fn)

# ---------------- build, bake AO into vertex colours (x tint), export ----------------
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc = bpy.context.scene; sc.world = sc.world or bpy.data.worlds.new('w'); sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
img_a = bpy.data.images.load(os.path.join(OUT, 'trim_albedo.png')); img_n = bpy.data.images.load(os.path.join(OUT, 'trim_normal.png')); img_n.colorspace_settings.name = 'Non-Color'
mat = bpy.data.materials.new('trim'); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
ta = nt.nodes.new('ShaderNodeTexImage'); ta.image = img_a; tn = nt.nodes.new('ShaderNodeTexImage'); tn.image = img_n; nm = nt.nodes.new('ShaderNodeNormalMap')
vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Col'; mul = nt.nodes.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs['Factor'].default_value = 1
nt.links.new(ta.outputs['Color'], mul.inputs[6]); nt.links.new(vc.outputs['Color'], mul.inputs[7]); nt.links.new(mul.outputs[2], bsdf.inputs['Base Color'])
nt.links.new(tn.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal']); bsdf.inputs['Roughness'].default_value = 0.85
ground = bpy.data.meshes.new('ground'); ground.from_pydata([(-60, -60, 0), (60, -60, 0), (60, 60, 0), (-60, 60, 0)], [], [[0, 1, 2, 3]]); gob = bpy.data.objects.new('ground', ground); sc.collection.objects.link(gob)
stats = {}
for name, m in ASSETS.items():
    lod0 = name.endswith('LOD0'); big = name.startswith(('house', 'squad', 'lighthouse', 'fort'))
    ob = to_object(name, m, bevel=(0.035 if lod0 and big else 0.0 if name.startswith('rope') else 0.02 if lod0 else 0))
    ob.data.materials.append(mat)
    # AO bake -> a temp colour attribute, then Col = tint x AO (ground plane under it so feet / plinths darken)
    gob.location = (0, 0, -9.5 if name.startswith('pier') else 0.55 if name.startswith('fort') else -60 if name.startswith(('rope', 'bridgePlank')) else 0)
    me = ob.data; tint = [tuple(me.color_attributes['Col'].data[i].color) for i in range(len(me.loops))]
    ao = me.color_attributes.new('AO', 'BYTE_COLOR', 'CORNER'); me.color_attributes.active_color = ao
    for o in sc.objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob; gob.hide_render = False
    others = [o for o in sc.objects if o not in (ob, gob)]
    for o in others: o.hide_render = True
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS', margin=0)
    col = me.color_attributes['Col']
    for i in range(len(me.loops)):
        a = ao.data[i].color[0]; a = 0.35 + 0.65 * a; t = tint[i]; col.data[i].color = (t[0] * a, t[1] * a, t[2] * a, 1)
    me.color_attributes.remove(me.color_attributes['AO']); me.color_attributes.active_color = me.color_attributes['Col']
    ob.hide_render = True; stats[name] = len(me.polygons)
    ob.location = (0, 0, 0)
bpy.data.objects.remove(gob)
for o in sc.objects: o.hide_render = False; o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'town_kit_raw.glb'), export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
    export_texcoords=True, export_normals=True, export_tangents=False, export_attributes=True, export_vertex_color='ACTIVE', export_materials='EXPORT', export_image_format='AUTO')
json.dump(stats, open(os.path.join(OUT, 'town_kit_stats.json'), 'w'), indent=1)
print('KIT OK', len(stats), sum(stats.values()))
