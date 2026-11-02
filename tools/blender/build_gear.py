# [Timothy] PUMPFUN PIRATES island-shop gear for Raul's v4 pirates (Blender 4.2 headless).
#   blender -b -P tools/blender/build_gear.py -- OUT_DIR      -> OUT_DIR/gear_{hi,lo}_raw.glb (+ preview renders if --preview)
# Rigid accessories authored in the v4 pirate's T-pose model space (Blender: z up, the pirate faces -Y; feet z 0, hair top z 1.40,
# eyes ~z 1.10, wrist x -0.555), so js/pirateGear.js can skin each one rigidly to its bone with the body's own bind matrix.
# Clothes are NOT here: js/pirateGear.js grows them from the body's own skinned torso / arm skin, so they bend with every clip.
# One mesh per item, named '<slot>_<id>', vertex colour COLOR_0; tinted parts carry a marker colour (MARK: magenta = primary,
# cyan = secondary, yellow = tertiary) that js/pirateGear.js swaps for the item's palette
# so one parrot / hook model serves every colour. Same mesh for male + female (their heads match within 2 cm).
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/pfp_gear'; os.makedirs(OUT, exist_ok=True)
PREVIEW = '--preview' in argv

def lin(h):
    c = [((h >> s) & 255) / 255 for s in (16, 8, 0)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)
C = dict(felt=0x1b1b1f, felt_hi=0x2a2a30, band=0xc0302c, bone=0xf4f1e8, sock=0x111111, gold=0xe9b949, red=0xc8302c,
         patch=0x141414, strap=0x2a1a12, lens=0x1a1030, lens_hi=0x8a3cff, frame=0x101014, laser=0xff2a2a, core=0xffe0e0,
         body=0xffffff, wing=0xffffff, tip=0xffffff, beak=0xe8c27a, beak_d=0x3a3a3a, eye_w=0xffffff, eye_b=0x101010, feet=0x9a8a7a,
         cuff=0x5a3a22, cuff_b=0x3a2414, metal=0xffffff)

MARK = {1: 0xff00ff, 2: 0x00ffff, 3: 0xffff00}

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def obj_from_bm(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob); return ob

def paint(ob, col, gt=0, smooth=True):
    me = ob.data
    if 'Color' not in me.color_attributes: me.color_attributes.new('Color', 'BYTE_COLOR', 'CORNER')
    ca = me.color_attributes['Color']
    c = lin(MARK[gt] if gt else (C[col] if isinstance(col, str) else col))   # tint keys = marker colours (gltfpack drops custom attributes)
    for i in range(len(ca.data)): ca.data[i].color = c
    for p in me.polygons: p.use_smooth = smooth
    return ob

def xform(ob, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
    ob.data.transform(Matrix.LocRotScale(Vector(loc), Euler(rot), Vector(scale))); return ob

def uvsphere(name, r=1.0, seg=16, rings=10):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r); return obj_from_bm(name, bm)
def cyl(name, r1, r2, h, seg=16, cap=True):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=seg, radius1=r1, radius2=r2, depth=h); return obj_from_bm(name, bm)
def cube(name):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); return obj_from_bm(name, bm)

def tube(name, pts, radii, seg=10, caps=True):
    bm = bmesh.new(); rings = []
    for i, p in enumerate(pts):
        p = Vector(p); t = (Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
        a = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0)); u = t.cross(a).normalized(); v = t.cross(u).normalized()
        rings.append([bm.verts.new(p + (u * math.cos(k * 2 * math.pi / seg) + v * math.sin(k * 2 * math.pi / seg)) * radii[i]) for k in range(seg)])
    for a, b in zip(rings, rings[1:]):
        for k in range(seg): bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    if caps: bm.faces.new(list(reversed(rings[0]))); bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); return obj_from_bm(name, bm)

def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]; bpy.ops.object.join(); ob = bpy.context.active_object; ob.name = name; ob.data.name = name; return ob

def solidify(ob, t, off=0.0):
    m = ob.modifiers.new('s', 'SOLIDIFY'); m.thickness = t; m.offset = off; m.use_even_offset = True; return ob
def subsurf(ob, lv=1):
    m = ob.modifiers.new('ss', 'SUBSURF'); m.levels = lv; m.render_levels = lv; return ob
def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)

HEAD_Z = 1.22          # hat base: just below the crown of Raul's fluffy hair (hair top z 1.40, skin top 1.345)
EYE_Z, EYE_X, FACE_Y = 1.10, 0.095, -0.215

# ---------------- skull + crossbones (front badge) ----------------
def skull_badge(prefix, s=1.0):
    p = []
    sk = paint(xform(uvsphere(prefix + 'sk', 1, 14, 9), scale=(0.040 * s, 0.014 * s, 0.036 * s), loc=(0, 0, 0.012 * s)), 'bone')
    jaw = paint(xform(cube(prefix + 'jw'), scale=(0.040 * s, 0.020 * s, 0.022 * s), loc=(0, 0, -0.022 * s)), 'bone', smooth=False)
    e1 = paint(xform(uvsphere(prefix + 'e1', 1, 8, 6), scale=(0.010 * s, 0.006 * s, 0.011 * s), loc=(-0.015 * s, -0.012 * s, 0.010 * s)), 'sock')
    e2 = paint(xform(uvsphere(prefix + 'e2', 1, 8, 6), scale=(0.010 * s, 0.006 * s, 0.011 * s), loc=(0.015 * s, -0.012 * s, 0.010 * s)), 'sock')
    p += [sk, jaw, e1, e2]
    for sgn in (-1, 1):
        a = Vector((-0.065 * s, 0, -0.06 * s * sgn)); b = Vector((0.065 * s, 0, 0.06 * s * sgn)); b = b * 1
        bonec = paint(tube(prefix + 'b%d' % sgn, [a, b], [0.009 * s, 0.009 * s], 8), 'bone')
        k = [paint(xform(uvsphere(prefix + 'k%d%d' % (sgn, j), 1, 8, 6), scale=(0.014 * s,) * 3, loc=tuple(q + Vector((0, 0.004 * s, dz * s)))), 'bone')
             for j, q in enumerate((a, b)) for dz in (-0.008, 0.008)]
        xform(bonec, loc=(0, 0.006 * s, 0)); p += [bonec] + k
    return p   # badge faces -Y, centred at the origin; caller places + rotates

def place(objs, loc, rot):
    for o in objs: xform(o, rot=rot); xform(o, loc=loc)
    return objs

# ---------------- hats ----------------
def tricorn():
    # felt tricorn: crown dome + brim turned up into three walls (flat front with the skull, corners left / right / back), red band
    bm = bmesh.new(); NT, NR = 72, 6; r0 = 0.255
    def R(th):   # rounded-triangle plan: corners at +x, -x, +y (back); the flat side faces -y (front)
        k = math.cos(3 * (th - math.pi / 2)); return 0.43 + 0.075 * k
    def H(th):
        k = math.cos(3 * (th - math.pi / 2)); return 0.20 - 0.10 * (k + 1) / 2
    grid = []
    for i in range(NT):
        th = i * 2 * math.pi / NT; row = []
        for j in range(NR + 1):
            t = j / NR; r = r0 + (R(th) - r0) * t; z = HEAD_Z + 0.015 + H(th) * t ** 1.8
            row.append(bm.verts.new((r * math.cos(th), r * math.sin(th) * 0.92, z)))
        grid.append(row)
    for i in range(NT):
        a, b = grid[i], grid[(i + 1) % NT]
        for j in range(NR): bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    brim = obj_from_bm('tri_brim', bm); solidify(brim, 0.022, 0); paint(brim, 'felt')
    crown = uvsphere('tri_crown', 1, 24, 14); xform(crown, scale=(0.265, 0.25, 0.20), loc=(0, 0.01, HEAD_Z + 0.02))
    bm = bmesh.new(); bm.from_mesh(crown.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < HEAD_Z - 0.005], context='VERTS'); bm.to_mesh(crown.data); bm.free()
    paint(crown, 'felt_hi')
    band = cyl('tri_band', 0.268, 0.262, 0.055, 32, cap=False); xform(band, loc=(0, 0.01, HEAD_Z + 0.045), scale=(1, 0.95, 1)); solidify(band, 0.01); paint(band, 'band')
    th = -math.pi / 2; fr = R(th); zf = HEAD_Z + 0.015 + H(th) * 0.55   # front wall: tilt back
    badge = place(skull_badge('ts_', 1.7), (0, -0.92 * (r0 + (fr - r0) * 0.6) - 0.05, HEAD_Z + 0.015 + H(th) * 0.6 ** 1.8 + 0.03), (-0.45, 0, 0))
    return [brim, crown, band] + badge

def bicorne():
    # captain's bicorne: a crescent worn side to side, black felt, gold trim + gold skull cockade
    shell = uvsphere('bi_shell', 1, 40, 20); xform(shell, scale=(0.44, 0.16, 0.30))
    bm = bmesh.new(); bm.from_mesh(shell.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.001], context='VERTS')
    for v in bm.verts:   # crescent: the top sags in the middle, the tips rise
        x = v.co.x / 0.44; v.co.z *= 0.75 + 0.45 * x * x; v.co.z += 0.10 * x * x * 0.4
    bm.to_mesh(shell.data); bm.free(); xform(shell, loc=(0, 0.02, HEAD_Z - 0.01)); paint(shell, 'felt')
    pts = []; 
    for i in range(41):
        x = -0.44 + 0.88 * i / 40; xx = x / 0.44; z = 0.30 * math.sqrt(max(0.0, 1 - xx * xx)) * (0.75 + 0.45 * xx * xx) + 0.04 * xx * xx
        pts.append((x * 0.995, 0.02, HEAD_Z - 0.01 + z))
    trim = paint(tube('bi_trim', pts, [0.016] * len(pts), 8), 'gold')
    crown = uvsphere('bi_crown', 1, 20, 12); xform(crown, scale=(0.26, 0.24, 0.12), loc=(0, 0.01, HEAD_Z + 0.01)); paint(crown, 'felt')
    badge = place(skull_badge('bs_', 1.2), (0, -0.155, HEAD_Z + 0.17), (-0.1, 0, 0))
    for o in badge: paint(o, 'gold' if o.name.startswith('bs_b') or o.name.startswith('bs_k') else ('bone' if not o.name.startswith('bs_e') else 'sock'))
    rose = paint(xform(uvsphere('bi_rose', 1, 16, 8), scale=(0.045, 0.015, 0.045), loc=(0.24, -0.13, HEAD_Z + 0.12)), 'gold')
    return [shell, trim, crown, rose] + badge

def bandana():
    cap = uvsphere('bd_cap', 1, 28, 16); xform(cap, scale=(0.30, 0.285, 0.22), loc=(0, 0.015, HEAD_Z - 0.01))
    bm = bmesh.new(); bm.from_mesh(cap.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < HEAD_Z - 0.06 + 0.07 * max(0.0, -(v.co.y) / 0.285)], context='VERTS')
    bm.to_mesh(cap.data); bm.free(); paint(cap, 'red', gt=1)
    hem = paint(xform(cyl('bd_hem', 0.302, 0.30, 0.03, 32, cap=False), loc=(0, 0.015, HEAD_Z - 0.04), scale=(1, 0.955, 1)), 'red', gt=1); solidify(hem, 0.012)
    knot = paint(xform(uvsphere('bd_knot', 1, 12, 8), scale=(0.05, 0.045, 0.045), loc=(0.0, 0.30, HEAD_Z - 0.02)), 'red', gt=1)
    t1 = paint(tube('bd_t1', [(0.0, 0.31, HEAD_Z - 0.03), (0.05, 0.36, HEAD_Z - 0.12), (0.08, 0.37, HEAD_Z - 0.22)], [0.03, 0.025, 0.012], 8), 'red', gt=1)
    t2 = paint(tube('bd_t2', [(0.0, 0.31, HEAD_Z - 0.03), (-0.04, 0.35, HEAD_Z - 0.10), (-0.07, 0.355, HEAD_Z - 0.18)], [0.03, 0.025, 0.012], 8), 'red', gt=1)
    dots = []
    for i, (th, ph) in enumerate([(a, b) for a in (-1.2, -0.4, 0.4, 1.2, 2.0, 2.8, -2.0, -2.8) for b in (0.45, 0.95)]):
        d = Vector((math.cos(th) * math.cos(ph) * 0.30, math.sin(th) * math.cos(ph) * 0.285 + 0.015, HEAD_Z - 0.01 + math.sin(ph) * 0.22))
        if d.z < HEAD_Z - 0.01: continue
        dots.append(paint(xform(uvsphere('bd_d%d' % i, 1, 6, 4), scale=(0.018, 0.018, 0.018), loc=tuple(d * 1.0)), 'bone'))
    return [cap, hem, knot, t1, t2] + dots

# ---------------- eyes ----------------
def head_band(name, col, z0, z1, ry=0.0):
    # strap around the head (front over one eye, back hidden in the hair), tilted
    pts = []
    for i in range(49):
        a = i * 2 * math.pi / 48; p = Vector((math.cos(a) * 0.262, math.sin(a) * 0.235, 0))
        p.z = z0 + (z1 - z0) * (0.5 + 0.5 * math.cos(a))   # +x side high, -x side low
        pts.append(p)
    return paint(tube(name, pts, [0.009] * len(pts), 6, caps=False), col)

def eyepatch():
    pt = uvsphere('ep_patch', 1, 16, 10); xform(pt, scale=(0.072, 0.03, 0.062), loc=(-EYE_X, FACE_Y - 0.004, EYE_Z)); paint(pt, 'patch')
    strap = head_band('ep_strap', 'patch', EYE_Z + 0.0, EYE_Z + 0.17)
    return [pt, strap]

def sunglasses():
    p = []
    for sx in (-1, 1):
        l = uvsphere('sg_l%d' % sx, 1, 16, 10); xform(l, scale=(0.085, 0.022, 0.06), loc=(sx * 0.098, FACE_Y - 0.012, EYE_Z)); paint(l, 'lens')
        h = uvsphere('sg_h%d' % sx, 1, 8, 6); xform(h, scale=(0.025, 0.006, 0.014), loc=(sx * 0.098 - 0.03, FACE_Y - 0.032, EYE_Z + 0.025)); paint(h, 'lens_hi')
        arm = paint(tube('sg_a%d' % sx, [(sx * 0.18, FACE_Y - 0.005, EYE_Z + 0.02), (sx * 0.255, -0.05, EYE_Z + 0.03), (sx * 0.262, 0.08, EYE_Z + 0.01)], [0.008] * 3, 6), 'frame')
        p += [l, h, arm]
    br = paint(tube('sg_br', [(-0.03, FACE_Y - 0.02, EYE_Z + 0.03), (0, FACE_Y - 0.025, EYE_Z + 0.04), (0.03, FACE_Y - 0.02, EYE_Z + 0.03)], [0.01] * 3, 6), 'frame')
    top = paint(tube('sg_top', [(-0.19, FACE_Y - 0.004, EYE_Z + 0.05), (0, FACE_Y - 0.03, EYE_Z + 0.065), (0.19, FACE_Y - 0.004, EYE_Z + 0.05)], [0.012] * 3, 6), 'frame')
    return p + [br, top]

def laser():
    p = []
    for sx in (-1, 1):
        a = (sx * EYE_X, FACE_Y - 0.01, EYE_Z); b = (sx * EYE_X * 1.6, FACE_Y - 0.75, EYE_Z - 0.07)
        p.append(paint(tube('lz_o%d' % sx, [a, b], [0.024, 0.032], 10), 'laser'))
        p.append(paint(tube('lz_c%d' % sx, [(a[0], a[1] - 0.01, a[2]), (b[0], b[1] + 0.02, b[2])], [0.012, 0.016], 8), 'core'))
        p.append(paint(xform(uvsphere('lz_g%d' % sx, 1, 10, 8), scale=(0.05, 0.02, 0.05), loc=(sx * EYE_X, FACE_Y - 0.008, EYE_Z)), 'laser'))
    return p

# ---------------- parrot (left shoulder, sits behind the hair line so it reads from the gameplay camera) ----------------
def parrot():
    P = Vector((0.262, 0.04, 0.925)); S = 1.25; p = []
    def at(v): return tuple(P + Vector(v) * S)
    body = paint(xform(uvsphere('pa_body', 1, 16, 12), scale=(0.055 * S, 0.06 * S, 0.085 * S), rot=(0.35, 0, 0), loc=at((0, 0, 0.09))), 'body', 1)
    head = paint(xform(uvsphere('pa_head', 1, 16, 12), scale=(0.05 * S,) * 3, loc=at((0, -0.02, 0.19))), 'body', 1)
    beak = paint(tube('pa_beak', [at((0, -0.06, 0.20)), at((0, -0.095, 0.185)), at((0, -0.10, 0.155))], [0.022 * S, 0.014 * S, 0.004 * S], 8), 'beak')
    for sx in (-1, 1):
        ew = paint(xform(uvsphere('pa_ew%d' % sx, 1, 8, 6), scale=(0.016 * S,) * 3, loc=at((sx * 0.036, -0.04, 0.205))), 'eye_w')
        eb = paint(xform(uvsphere('pa_eb%d' % sx, 1, 8, 6), scale=(0.009 * S,) * 3, loc=at((sx * 0.046, -0.048, 0.207))), 'eye_b')
        wing = paint(xform(uvsphere('pa_w%d' % sx, 1, 12, 8), scale=(0.018 * S, 0.05 * S, 0.085 * S), rot=(0.45, 0, sx * 0.12), loc=at((sx * 0.05, 0.012, 0.085))), 'wing', 2)
        tipw = paint(xform(uvsphere('pa_wt%d' % sx, 1, 10, 6), scale=(0.014 * S, 0.035 * S, 0.05 * S), rot=(0.6, 0, sx * 0.1), loc=at((sx * 0.052, 0.045, 0.02))), 'tip', 3)
        foot = paint(tube('pa_f%d' % sx, [at((sx * 0.022, -0.01, 0.02)), at((sx * 0.024, -0.02, -0.005)), at((sx * 0.024, -0.04, -0.012))], [0.008 * S] * 3, 6), 'feet')
        p += [ew, eb, wing, tipw, foot]
    tail = paint(tube('pa_tail', [at((0, 0.05, 0.03)), at((0, 0.10, -0.06)), at((0, 0.13, -0.15))], [0.03 * S, 0.022 * S, 0.006 * S], 8), 'tip', 3)
    crest = paint(tube('pa_crest', [at((0, 0.0, 0.235)), at((0, 0.03, 0.27)), at((0, 0.07, 0.27))], [0.014 * S, 0.01 * S, 0.003 * S], 6), 'body', 1)
    return [body, head, beak, tail, crest] + p

# ---------------- hook (replaces the right hand: wrist x -0.555, arm axis y 0 z 0.842; forward = -y) ----------------
def hook():
    W = -0.548; Z = 0.842
    cuff = paint(xform(cyl('hk_cuff', 0.062, 0.055, 0.075, 18), rot=(0, math.pi / 2, 0), loc=(W - 0.03, 0, Z)), 'cuff')
    rim = paint(xform(cyl('hk_rim', 0.066, 0.066, 0.016, 18), rot=(0, math.pi / 2, 0), loc=(W - 0.066, 0, Z)), 'cuff_b')
    pts = [(W - 0.07, 0, Z), (W - 0.12, 0, Z), (W - 0.165, -0.01, Z)]
    for i in range(1, 12):   # J: curls forward (-y) and back toward the arm (+x)
        a = i / 11 * math.pi * 1.05; pts.append((W - 0.165 - 0.055 * math.sin(a), -0.055 + 0.055 * math.cos(a) - 0.0 , Z))
    rad = [0.016] * 4 + [0.016 - 0.011 * i / (len(pts) - 5) for i in range(len(pts) - 4)]
    shaft = paint(tube('hk_shaft', pts, rad, 10), 'metal', 1)
    return [cuff, rim, shaft]

ITEMS = {'hat_tricorn': tricorn, 'hat_bicorne': bicorne, 'hat_bandana': bandana, 'eyes_eyepatch': eyepatch, 'eyes_sunglasses': sunglasses,
         'eyes_laser': laser, 'parrot_parrot': parrot, 'hook_hook': hook}

def build(lod):
    reset(); out = []
    for name, fn in ITEMS.items():
        parts = fn()
        for o in parts:
            if lod == 'hi' and len(o.data.polygons) < 400 and not o.modifiers: pass
            apply_mods(o)
        ob = join(parts, name)
        if lod == 'lo':
            m = ob.modifiers.new('d', 'DECIMATE'); m.ratio = 0.42; apply_mods(ob)
        bm = bmesh.new(); bm.from_mesh(ob.data); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(ob.data); bm.free()
        ob.data.color_attributes.active_color = ob.data.color_attributes['Color']
        print('[gear]', lod, name, 'tris', len(ob.data.polygons)); out.append(ob)
    mat = bpy.data.materials.new('gear'); mat.use_nodes = True
    nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
    nt.links.new(vc.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.8
    for o in out: o.data.materials.clear(); o.data.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT')
    for o in out: o.select_set(True)
    path = os.path.join(OUT, f'gear_{lod}_raw.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                              export_vertex_color='ACTIVE', export_attributes=False, export_normals=True, export_texcoords=False,
                              export_materials='EXPORT', export_animations=False, export_skins=False)
    print('[gear] wrote', path)
    return out

build('lo')
objs = build('hi')
if PREVIEW:   # quick look on the T-pose pirate (local render, workbench)
    bpy.ops.import_scene.gltf(filepath=os.path.join(os.path.dirname(__file__), '../../assets/pirates/pirate_male_hi.glb'))
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.color_type = 'VERTEX'; sc.display.shading.light = 'STUDIO'
    sc.render.resolution_x, sc.render.resolution_y = 900, 900
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.name.startswith('pirate'): o.color = (0.9, 0.75, 0.6, 1)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.6
    for nm, loc, rot in [('front', (0, -4, 0.95), (math.pi / 2, 0, 0)), ('side', (4, 0, 0.95), (math.pi / 2, 0, math.pi / 2)), ('q', (2.8, -2.8, 2.2), (1.15, 0, math.pi / 4))]:
        cam.location = loc; cam.rotation_euler = rot; sc.render.filepath = os.path.join(OUT, f'preview_{nm}.png'); bpy.ops.render.render(write_still=True)
