#!/usr/bin/env python3
"""Seal the male V6 head (assets/pirates/pirate_male_v6_{hi,lo}.glb): studio-grade inner liner + eye-rim texel cleanup.

Run (Blender 4.2, bundled numpy + scipy):
  /opt/blender/blender -b --python tools/v6/seal_male_head.py -- \
      --src  <untouched live V6 male hi glb> --out-hi assets/pirates/pirate_male_v6_hi.glb --out-lo assets/pirates/pirate_male_v6_lo.glb

Why: the AI-sculpted V6 male head is an open surface. After welding UV seams (1e-4) it still has ~2.7k true boundary edges above
z 0.80 (eye sockets, hairline, behind the ears, mouth / mustache crevices, back-of-head spike undersides): the game drew magenta /
sky through the head and grey back faces in every crevice. Nothing of the outer surface is moved or re-topologised; instead:

 1. Outer mesh preserved bit-exact: every original vertex position, bone weight, _TINT, COLOR_0 and UV (except step 2), exact original
    custom split normals on all original loops, the v5_face_eyes / v5_tattoo meshes, the v5warp / v6 extras, the rig and all 15 clips.
 2. Eye-rim texel cleanup: head-skin loops (_TINT 0, z > 0.95, y < -0.12) whose detail texel is dark (luminance < 0.78, V5 eye / lash
    bleed in male_detail_v5head) get a clean head-skin UV (the whole face, so no UV interpolation streaks across the atlas).
 3. Inner liner (z >= 0.84): the head (+ eye decal) is voxelised at 2.5 mm; a free voxel is sealed when >= 25 of 26 rays (floor
    counts as a hit) hit the shell, so every crevice / slit / socket / spike underside is closed without touching the surface ->
    closing, hole fill, opening, small-island drop -> sealed solid. The liner is its LINER_DEPTH level set (distance transform), ball
    opened (r 7.5 mm), and inside z 0.80..0.96 restricted to NECK_K x the outer neck's inscribed radius around each slice's neck axis
    (ray-cast) so it never reaches shoulders / collar / beard rim that arm and neck bones move.
    Blocky level set -> REMESH (voxel 4.5 mm, smooth) -> SMOOTH (0.5 x4) -> cut below z 0.84 (inside the closed V6 neck) -> DECIMATE
    (collapse, ~3k tris) -> 3 mm inward push -> strict-interior clamp (every vertex, edge midpoint and triangle centroid >= 2.2 mm from
    the outer surface and inside the sealed solid, >= 2.5 mm behind v5_face_eyes, neck funnel) -> inward-only constrained Laplacian ->
    asserted: 0 liner edges cross the outer surface / eye decal, 0 outer edges cross the liner (rest pose). Verified separately on
    every frame of all 15 clips (9 samples each): 0 crossings, min clearance 2.24 mm.
 4. Liner _TINT / UV / COLOR_0 so setColors() retints it with the skin / hair swatches and flattenHair() / tuckHair() squash it with the
    outer hair under every hat: hair (_TINT 1) under hair and above z 1.18, skin (_TINT 0) behind the face / eyes and in the nape / neck,
    dark beard tone in the mouth slit; one clean detail-atlas texel per face. Bone weights: 4 nearest outer verts, inverse distance.
 5. lo = hi (as the live female V6).
"""
import bpy, bmesh, sys, json, shutil, argparse, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from scipy import ndimage as ndi
from pathlib import Path

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument('--src', default='/workspace/brand/v6_characters/work/male-head/before/pirate_male_v6_hi.glb')
ap.add_argument('--out-hi', default='assets/pirates/pirate_male_v6_hi.glb')
ap.add_argument('--out-lo', default='assets/pirates/pirate_male_v6_lo.glb')
ap.add_argument('--metrics', default='')
ap.add_argument('--draco-pos', type=int, default=14)
A = ap.parse_args(argv)
t0 = time.time()
def log(*a): print('[seal %.1fs]' % (time.time() - t0), *a, flush=True)

# ---------------- parameters ----------------
HEAD_Z = 0.88            # nothing below this is touched (body lock)
VOX = 0.0025             # voxel size of the sealing grid
OCCL_MIN = 25            # of 26 grid rays blocked => enclosed (one escape allowed: a slit / socket / hole)
LINER_DEPTH = 0.0025     # liner level set depth inside the sealed solid (solid stops ~1.3 mm under the surface)
LINER_OPEN = 0.0075      # ball opening radius of the liner solid
LINER_ZCUT = 0.84        # liner faces below this are deleted (inside the closed neck / upper chest)
PUSH = 0.0030            # inward push along the liner normal
CLEAR = 0.0022           # min clearance from the outer surface (verts, edge midpoints, centroids)
EYE_CLEAR = 0.0025       # min clearance behind v5_face_eyes
NECK_K = 0.85            # neck column radius clamp (z 0.84..0.96)
TARGET_TRIS = 3000
# clean atlas texels (Blender UV convention, v up; glTF v = 1 - v): verified on male_detail_v5head at build time
SKIN_CLEAN_UV = (0.5137, 0.7387)   # forehead skin, detail ~0.996
SKIN_SHADE_UV = (0.6273, 0.6642)   # cheek skin, detail ~0.94 (liner sockets / nape: a touch of depth)
HAIR_UV = (0.8559, 0.7758)         # back hair, detail ~0.68
HAIR_DARK_UV = (0.8566, 0.8199)    # beard side, detail ~0.65 (mouth slit)
COL_FACE = (0.95, 0.70, 0.51, 1.0)
COL_NAPE = (0.94, 0.69, 0.50, 1.0)
COL_HAIR = (0.65, 0.36, 0.08, 1.0)
COL_DARK = (0.58, 0.32, 0.07, 1.0)

# ---------------- load ----------------
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=A.src)
body = bpy.data.objects['pirate_hi_body'] if 'pirate_hi_body' in bpy.data.objects else \
    max([o for o in bpy.data.objects if o.type == 'MESH' and o.get('v6')], key=lambda o: len(o.data.polygons))
eyes = bpy.data.objects['v5_face_eyes']
me = body.data
assert body.matrix_world == eyes.matrix_world and body.matrix_world.is_identity
actions0 = sorted(a.name for a in bpy.data.actions)
extras0 = {k: body[k] for k in body.keys() if k in ('v5warp', 'v6')}
NV0, NL0, NF0 = len(me.vertices), len(me.loops), len(me.polygons)
log('loaded', body.name, 'verts', NV0, 'loops', NL0, 'faces', NF0, 'actions', len(actions0))

def vget(mesh):
    a = np.zeros(len(mesh.vertices) * 3); mesh.vertices.foreach_get('co', a); return a.reshape(-1, 3)
P0 = vget(me)
T0 = np.zeros(NV0); me.attributes['_TINT'].data.foreach_get('value', T0); T0i = np.round(T0).astype(int)
CV0 = np.zeros(NL0, int); me.loops.foreach_get('vertex_index', CV0)
UV0 = np.zeros(NL0 * 2); me.uv_layers[0].data.foreach_get('uv', UV0); UV0 = UV0.reshape(-1, 2)
COL0 = np.zeros(NL0 * 4); me.attributes['Color'].data.foreach_get('color', COL0); COL0 = COL0.reshape(-1, 4)
saved_corner = np.array([n.vector[:] for n in me.corner_normals])
assert len(saved_corner) == NL0
W0 = [{body.vertex_groups[g.group].name: g.weight for g in v.groups} for v in me.vertices]

# ---------------- detail atlas sampling ----------------
img = None
for n in me.materials[0].node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image: img = n.image
IW, IH = img.size
PX = np.empty(IW * IH * 4, np.float32); img.pixels.foreach_get(PX); PX = PX.reshape(IH, IW, 4)[..., :3]
def texel(uv):
    uv = np.atleast_2d(uv); x = np.clip((uv[:, 0] % 1) * IW, 0, IW - 1).astype(int); y = np.clip((uv[:, 1] % 1) * IH, 0, IH - 1).astype(int)
    return PX[y, x]
for nm_, uv_ in [('SKIN_CLEAN', SKIN_CLEAN_UV), ('SKIN_SHADE', SKIN_SHADE_UV), ('HAIR', HAIR_UV), ('HAIR_DARK', HAIR_DARK_UV)]:
    log('texel', nm_, uv_, texel(uv_)[0].round(3).tolist())
assert texel(SKIN_CLEAN_UV)[0].mean() > 0.9 and texel(HAIR_UV)[0].mean() < 0.8

# ---------------- 2. eye-rim texel cleanup (outer head skin) ----------------
LP = P0[CV0]; LT = T0i[CV0]; lum = texel(UV0).mean(1)
dark = (LP[:, 2] > 0.95) & (LP[:, 1] < -0.12) & (LT == 0) & (lum < 0.78)
LS = np.zeros(NF0, int); me.polygons.foreach_get('loop_start', LS); LN = np.zeros(NF0, int); me.polygons.foreach_get('loop_total', LN)
face_of_loop = np.repeat(np.arange(NF0), LN)
dark_faces = np.unique(face_of_loop[dark])
UV1 = UV0.copy(); n_snap = 0; n_mixed = 0
for f in dark_faces:
    ls = np.arange(LS[f], LS[f] + LN[f])
    if np.all(LT[ls] == 0): UV1[ls] = SKIN_CLEAN_UV; n_snap += len(ls)
    else: n_mixed += 1; m = ls[(LT[ls] == 0)]; UV1[m] = SKIN_CLEAN_UV; n_snap += len(m)
me.uv_layers[0].data.foreach_set('uv', UV1.ravel())
log('eye-rim dark loops', int(dark.sum()), 'faces', len(dark_faces), 'loops snapped', n_snap, 'mixed-tint faces', n_mixed)
hl = LP[:, 2] > HEAD_Z
white_check = dict(tint_m1=int((hl & (LT == -1)).sum()), left_half_uv=int((hl & (UV1[:, 0] < 0.5)).sum()))
log('head white-UV check', white_check)

# ---------------- 3. sealed solid (voxels) ----------------
def tris_world(ob, zmin):
    m = ob.data; m.calc_loop_triangles()
    V = vget(m); T = np.zeros(len(m.loop_triangles) * 3, int); m.loop_triangles.foreach_get('vertices', T); TT = V[T.reshape(-1, 3)]
    return TT[TT[:, :, 2].max(1) >= zmin]
EYE_TR = tris_world(eyes, 0)
OUT_TR = tris_world(body, 0.70)
TR = np.concatenate([OUT_TR, EYE_TR])
lo = np.array([-0.34, -0.34, 0.70]); hi = np.array([0.34, 0.34, 1.45])
shape = tuple((np.ceil((hi - lo) / VOX).astype(int) + 1).tolist())
surf = np.zeros(shape, bool)
e = np.maximum.reduce([np.linalg.norm(TR[:, i] - TR[:, (i + 1) % 3], axis=1) for i in range(3)])
nsub = np.ceil(e / (VOX * 0.4)).astype(int) + 1
for k in np.unique(nsub):
    sel = TR[nsub == k]; a, b = np.meshgrid(np.arange(k + 1), np.arange(k + 1)); mm = (a + b) <= k; a = a[mm] / k; b = b[mm] / k; c = 1 - a - b
    for s in range(0, len(sel), 4000):
        ss = sel[s:s + 4000]
        pts = (ss[:, None, 0] * c[None, :, None] + ss[:, None, 1] * a[None, :, None] + ss[:, None, 2] * b[None, :, None]).reshape(-1, 3)
        ijk = np.floor((pts - lo) / VOX + 0.5).astype(int); ok = np.all((ijk >= 0) & (ijk < shape), 1); ijk = ijk[ok]
        surf[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = True
zc = lo[2] + np.arange(shape[2]) * VOX
# enclosure test: a voxel is inside when the (dilated) surface blocks >= OCCL_MIN of the 26 grid rays leaving it (rays reaching the
# grid floor count as blocked: the closed body continues below). Robust to the open slits / sockets / spike gaps of the sculpt.
hitsurf = ndi.binary_dilation(surf)
def shift(a, s, fill_floor=False):
    out = np.zeros_like(a); src = [slice(None)] * 3; dst = [slice(None)] * 3
    for ax, k in enumerate(s):
        n = a.shape[ax]
        if abs(k) >= n: return out
        if k > 0: src[ax] = slice(k, n); dst[ax] = slice(0, n - k)
        elif k < 0: src[ax] = slice(0, n + k); dst[ax] = slice(-k, n)
    out[tuple(dst)] = a[tuple(src)]
    return out
cnt = np.zeros(shape, np.uint8)
for d in [(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1) if (i, j, k) != (0, 0, 0)]:
    hit = hitsurf.copy()
    if d[2] < 0: hit[:, :, 0] = True          # floor
    step = 1
    while step < max(shape):
        hit |= shift(hit, (d[0] * step, d[1] * step, d[2] * step)); step *= 2
    cnt += hit
solid = (cnt >= OCCL_MIN)
solid = ndi.binary_closing(solid, iterations=2, border_value=0) & ~surf     # 1-2 voxel ray-alias slits inside the head
solid = ndi.binary_fill_holes(solid)
solid = ndi.binary_opening(solid)
lab, nlab = ndi.label(solid)
sizes = ndi.sum(solid, lab, range(1, nlab + 1)); keep = np.where(sizes >= 64)[0] + 1
solid = np.isin(lab, keep)
del lab, cnt, hitsurf
DIN = ndi.distance_transform_edt(solid) * VOX          # depth inside the sealed solid
log('sealed solid vol z>=0.86 (L)', round(float(solid[:, :, zc >= 0.86].sum()) * VOX ** 3 * 1000, 3), 'DIN max', round(float(DIN.max()), 4))
DIN = DIN.astype(np.float32)
GRAD = np.stack(np.gradient(DIN), 0)
def grad_at(pts):
    q = ((np.asarray(pts) - lo) / VOX).T
    g = np.stack([ndi.map_coordinates(GRAD[i], q, order=1, mode='nearest') for i in range(3)], 1)
    return g / np.maximum(np.linalg.norm(g, axis=1), 1e-9)[:, None]
def din_at(pts):
    q = (np.asarray(pts) - lo) / VOX
    return ndi.map_coordinates(DIN, q.T, order=1, mode='nearest')

# blocky level set -> mesh
L = (DIN >= LINER_DEPTH); L[:, :, zc < 0.78] = False
# neck funnel (z 0.84..0.96): the liner keeps <= NECK_K x the outer neck's inscribed radius from the neck axis (ray-cast first hits
# of the outer surface around the best centre of each 5 mm slice) -> it never reaches the shoulders / collar / beard rim that the
# arm and neck bones move (cannon, steer, run ...)
_bv_body = BVHTree.FromPolygons([tuple(v) for v in P0], [p.vertices[:] for p in me.polygons])
NECK = {}
for z in np.arange(0.83, 0.9751, 0.005):
    best = None
    for cx in np.arange(-0.03, 0.031, 0.01):
        for cy in np.arange(-0.08, 0.041, 0.01):
            rs = []
            for a in np.linspace(0, 2 * np.pi, 36, endpoint=False):
                r = _bv_body.ray_cast(Vector((cx, cy, z)), Vector((np.cos(a), np.sin(a), 0)), 0.4)
                rs.append(r[3] if r[0] is not None else 0.4)
            m_ = min(rs)
            if best is None or m_ > best[2]: best = (cx, cy, m_)
    NECK[round(float(z), 3)] = best
log('neck funnel', {k: [round(float(x), 3) for x in v] for k, v in NECK.items() if abs(k * 100 - round(k * 100)) < 1e-6})
xc = lo[0] + np.arange(shape[0]) * VOX; yc = lo[1] + np.arange(shape[1]) * VOX
for k_, z in enumerate(zc):
    if not (0.80 <= z <= 0.96): continue
    cx, cy, rmin = NECK[min(NECK, key=lambda q: abs(q - z))]
    R = np.hypot(xc[:, None] - cx, yc[None, :] - cy)
    L[:, :, k_] &= R <= NECK_K * rmin - LINER_DEPTH * 0
# ball opening (radius LINER_OPEN): the liner keeps to the bulk of the head (no thin spike / ear / strand tunnels it can't follow)
er = ndi.distance_transform_edt(L) * VOX >= LINER_OPEN
L = (ndi.distance_transform_edt(~er) * VOX <= LINER_OPEN) & L
lab, nlab = ndi.label(L); sizes = ndi.sum(L, lab, range(1, nlab + 1)); L = lab == (np.argmax(sizes) + 1); del lab, er
log('liner voxels', int(L.sum()))
quads = []
for ax in range(3):
    a0 = L.take(np.arange(0, shape[ax] - 1), axis=ax); a1 = L.take(np.arange(1, shape[ax]), axis=ax)
    for flip, msk in ((0, a0 & ~a1), (1, a1 & ~a0)):
        idx = np.argwhere(msk)
        if not len(idx): continue
        base = idx.astype(float); base[:, ax] += 0.5
        o1, o2 = [(ax + 1) % 3, (ax + 2) % 3]
        d1 = np.zeros(3); d1[o1] = 0.5; d2 = np.zeros(3); d2[o2] = 0.5
        c4 = np.stack([base - d1 - d2, base + d1 - d2, base + d1 + d2, base - d1 + d2], 1)
        if flip: c4 = c4[:, ::-1]
        quads.append(c4)
Q = np.concatenate(quads)
key = np.round(Q.reshape(-1, 3) * 2).astype(np.int64)
uniq, inv = np.unique(key, axis=0, return_inverse=True)
VV = uniq / 2.0 * VOX + lo; FF = inv.reshape(-1, 4)
lm = bpy.data.meshes.new('liner'); lm.from_pydata(VV.tolist(), [], FF.tolist()); lm.validate()
liner = bpy.data.objects.new('liner', lm); bpy.context.scene.collection.objects.link(liner)
log('blocky liner quads', len(FF))
for o in bpy.context.view_layer.objects: o.select_set(False)
bpy.context.view_layer.objects.active = liner; liner.select_set(True)
m = liner.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = 0.0045; m.use_smooth_shade = True
bpy.ops.object.modifier_apply(modifier='rm')
m = liner.modifiers.new('sm', 'SMOOTH'); m.factor = 0.5; m.iterations = 4
bpy.ops.object.modifier_apply(modifier='sm')
bm = bmesh.new(); bm.from_mesh(lm)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < LINER_ZCUT], context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(lm); bm.free()
ntri = sum(len(p.vertices) - 2 for p in lm.polygons)
m = liner.modifiers.new('dc', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = min(1.0, TARGET_TRIS / max(1, ntri)); m.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dc')
bm = bmesh.new(); bm.from_mesh(lm); bmesh.ops.triangulate(bm, faces=bm.faces)
seen = set(); drop = []
for f in bm.faces:
    if f in seen: continue
    comp = [f]; seen.add(f); st = [f]
    while st:
        g = st.pop()
        for ed in g.edges:
            for h in ed.link_faces:
                if h not in seen: seen.add(h); comp.append(h); st.append(h)
    if len(comp) < 12: drop += comp
bmesh.ops.delete(bm, geom=drop, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(lm); bm.free(); lm.update()
log('liner after remesh/smooth/decimate: verts', len(lm.vertices), 'tris', len(lm.polygons), 'dropped tiny faces', len(drop))

# ---------------- strict-interior clamp ----------------
OUTER_FACES = OUT_TR[OUT_TR[:, :, 2].max(1) >= 0.80]
def bvh_from_tris(TT):
    V = TT.reshape(-1, 3); return BVHTree.FromPolygons([tuple(v) for v in V], [(3 * i, 3 * i + 1, 3 * i + 2) for i in range(len(TT))], all_triangles=True)
BV_OUT = bvh_from_tris(OUTER_FACES); BV_EYE = bvh_from_tris(EYE_TR)
BV_ALL = bvh_from_tris(np.concatenate([OUTER_FACES, EYE_TR]))
def liner_arrays():
    V = vget(lm); lm.calc_loop_triangles()
    F = np.zeros(len(lm.loop_triangles) * 3, int); lm.loop_triangles.foreach_get('vertices', F); F = F.reshape(-1, 3)
    N = np.zeros(len(lm.vertices) * 3); lm.vertices.foreach_get('normal', N); return V, F, N.reshape(-1, 3)
def clearance(pts):
    d = np.empty(len(pts)); de = np.full(len(pts), 1.0)
    for i, p in enumerate(pts):
        r = BV_OUT.find_nearest(Vector(p)); d[i] = r[3] if r[0] is not None else 1.0
        r = BV_EYE.find_nearest(Vector(p)); de[i] = r[3] if r[0] is not None else 1.0
    return d, de
def behind_eye_gap(pts):
    g = np.full(len(pts), np.inf)
    for i, p in enumerate(pts):
        r = BV_EYE.ray_cast(Vector(p), Vector((0, -1, 0)), 0.2)
        if r[0] is not None: g[i] = r[3]
        else:
            r = BV_EYE.ray_cast(Vector(p), Vector((0, 1, 0)), 0.2)
            if r[0] is not None: g[i] = -r[3]
    return g
def violations(V, F):
    E = np.unique(np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), 1), axis=0)
    pts = np.concatenate([V, V[E].mean(1), V[F].mean(1)])
    owner = [[i] for i in range(len(V))] + [list(e) for e in E] + [list(f) for f in F]
    d, de = clearance(pts); din = din_at(pts); ge = behind_eye_gap(pts)
    bad = (d < CLEAR) | (de < EYE_CLEAR) | (din < 0.0012) | (ge < EYE_CLEAR)
    return bad, owner, dict(min_clear=float(d.min()), min_eye=float(de.min()), min_din=float(din.min()), min_eye_y=float(ge.min()), n_bad=int(bad.sum()), n_pts=len(pts))
def crossings(V, F):
    lb = BVHTree.FromPolygons([tuple(v) for v in V], [tuple(f) for f in F], all_triangles=True)
    E = np.unique(np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), 1), axis=0)
    bad = set(); n1 = 0
    for a, b in E:
        pa, pb = Vector(V[a]), Vector(V[b]); d = pb - pa; L_ = d.length
        if L_ < 1e-9: continue
        r = BV_ALL.ray_cast(pa, d / L_, L_)
        if r[0] is not None: n1 += 1; bad.update((a, b))
    TT = np.concatenate([OUTER_FACES, EYE_TR]); OE = np.concatenate([TT[:, [0, 1]], TT[:, [1, 2]], TT[:, [2, 0]]])
    n2 = 0
    for pa, pb in OE:
        pa, pb = Vector(pa), Vector(pb); d = pb - pa; L_ = d.length
        if L_ < 1e-9: continue
        r = lb.ray_cast(pa, d / L_, L_)
        if r[0] is not None:
            n2 += 1; bad.update(F[r[2]].tolist())
    return n1, n2, bad
def neck_clamp(V):
    n = 0
    for i, p in enumerate(V):
        if not (0.80 <= p[2] <= 0.96): continue
        cx, cy, rmin = NECK[min(NECK, key=lambda q: abs(q - p[2]))]
        dx, dy = p[0] - cx, p[1] - cy; r = np.hypot(dx, dy)
        if r > NECK_K * rmin + 1e-6:
            k = NECK_K * rmin / r; V[i, 0] = cx + dx * k; V[i, 1] = cy + dy * k; n += 1
    return n

V, F, N = liner_arrays()
V = V - N * PUSH
lm.vertices.foreach_set('co', V.ravel()); lm.update()
for it in range(120):
    V, F, N = liner_arrays()
    nn = neck_clamp(V)
    bad, owner, st = violations(V, F)
    n1, n2, cbad = crossings(V, F)
    if it % 5 == 0 or (st['n_bad'] == 0 and n1 == 0 and n2 == 0): log('clamp it', it, st, 'neck', nn, 'cross', n1, n2)
    if st['n_bad'] == 0 and n1 == 0 and n2 == 0 and nn == 0: break
    mv = np.zeros(len(V), bool)
    for j in np.where(bad)[0]: mv[owner[j]] = True
    D = -N.copy()
    if mv.any():
        G = grad_at(V[mv]); M = 0.5 * G + 0.5 * D[mv]
        V[mv] += M / np.maximum(np.linalg.norm(M, axis=1), 1e-9)[:, None] * 0.0006
    cb = np.array(sorted(cbad), int)
    if len(cb):   # crossing verts: straight up the depth gradient (away from every sheet), 1 mm
        V[cb] += grad_at(V[cb]) * 0.0010
    lm.vertices.foreach_set('co', V.ravel()); lm.update()
# leftover crossings at the open bottom rim of the liner (inside the closed neck, z < 0.88): trim those rim faces
for it in range(6):
    V, F, N = liner_arrays(); n1, n2, cbad = crossings(V, F)
    if not (n1 or n2): break
    cb = set(cbad)
    kill = [i for i, f in enumerate(F) if any(k in cb for k in f) and V[f, 2].min() < 0.87]
    if not kill: break
    bm = bmesh.new(); bm.from_mesh(lm); bm.faces.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.faces[i] for i in kill], context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(lm); bm.free(); lm.update(); log('trimmed bottom-rim faces', len(kill), 'cross was', n1, n2)
for sp in range(2):
    V, F, N = liner_arrays()
    nb = [set() for _ in range(len(V))]
    for a, b, c in F: nb[a].update((b, c)); nb[b].update((a, c)); nb[c].update((a, b))
    Vs = np.array([V[list(s)].mean(0) if s else V[i] for i, s in enumerate(nb)])
    Vn = V + (Vs - V) * 0.5
    outward = ((Vn - V) * N).sum(1) > 0
    Vn[outward] = V[outward]
    d0, _ = clearance(V); d1, _ = clearance(Vn)
    worse = (d1 < d0 - 1e-6) | (d1 < CLEAR + 0.0003)
    Vn[worse] = V[worse]
    lm.vertices.foreach_set('co', Vn.ravel()); lm.update()
    _, _, st = violations(Vn, F); n1, n2, _ = crossings(Vn, F)
    if st['n_bad'] or n1 or n2:
        lm.vertices.foreach_set('co', V.ravel()); lm.update(); log('smooth pass', sp, 'reverted', st, n1, n2)
    else: log('smooth pass', sp, 'ok', st)
V, F, N = liner_arrays()
_, _, FINAL = violations(V, F); X1, X2, XB = crossings(V, F)
log('FINAL liner check', FINAL, 'liner-edges-x-outer', X1, 'outer-edges-x-liner', X2)
assert FINAL['n_bad'] == 0 and X1 == 0 and X2 == 0, 'liner not strictly interior'

# ---------------- 4. liner tint / uv / colour / weights ----------------
kd = KDTree(NV0)
for i, p in enumerate(P0): kd.insert(Vector(p), i)
kd.balance()
hair_idx = np.where(T0i == 1)[0]; kdh = KDTree(len(hair_idx))
for j, i in enumerate(hair_idx): kdh.insert(Vector(P0[i]), j)
kdh.balance()
vt = np.zeros(len(V), int); vcls = np.zeros(len(V), int)   # cls: 0 face skin, 1 nape skin, 2 hair, 3 dark mouth
for i, p in enumerate(V):
    x, y, z = p
    _, j, _ = kd.find(Vector(p)); tn = T0i[j]
    near_hair = kdh.find(Vector(p))[2] < 0.012
    if abs(x) < 0.042 and 0.955 <= z <= 1.005 and y < -0.15: vt[i], vcls[i] = 1, 3
    elif 0.99 <= z <= 1.18 and y < -0.10 and (z < 1.10 or not near_hair): vt[i], vcls[i] = 0, 0
    elif z >= 1.18 or tn == 1 or (z > 1.10 and near_hair): vt[i], vcls[i] = 1, 2
    else: vt[i], vcls[i] = 0, (1 if (y > -0.08 or z < 0.99) else 0)
log('liner classes', {k: int((vcls == c).sum()) for k, c in (('face_skin', 0), ('nape_skin', 1), ('hair', 2), ('mouth_dark', 3))})
CLS_COL = {0: COL_FACE, 1: COL_NAPE, 2: COL_HAIR, 3: COL_DARK}
CLS_UV = {0: SKIN_SHADE_UV, 1: SKIN_SHADE_UV, 2: HAIR_UV, 3: HAIR_DARK_UV}

bm = bmesh.new(); bm.from_mesh(me)
tl = bm.verts.layers.float['_TINT']; ul = bm.loops.layers.uv.active
cl = bm.loops.layers.color.get('Color') or bm.loops.layers.float_color.get('Color')
newv = []
for i, p in enumerate(V):
    v = bm.verts.new(Vector(p)); v[tl] = float(vt[i]); newv.append(v)
bm.verts.ensure_lookup_table()
nfail = 0
for f in F:
    try: nf = bm.faces.new([newv[k] for k in f])
    except ValueError: nfail += 1; continue
    nf.smooth = True; nf.material_index = 0
    cs = [vcls[k] for k in f]
    fc = 3 if 3 in cs else max(set(cs), key=cs.count)
    for l, k in zip(nf.loops, f):
        l[ul].uv = CLS_UV[fc]; l[cl] = CLS_COL[vcls[k]]
bm.to_mesh(me); bm.free(); me.update()
assert nfail == 0 and len(me.vertices) == NV0 + len(V)
for i in range(len(V)):
    vi = NV0 + i; acc = {}
    for co, j, d in kd.find_n(Vector(V[i]), 4):
        w = 1.0 / max(d, 1e-4)
        for g, gw in W0[j].items(): acc[g] = acc.get(g, 0.0) + w * gw
    top = sorted(acc.items(), key=lambda t: -t[1])[:4]; s = sum(w for _, w in top) or 1.0
    for g, w in top: body.vertex_groups[g].add([vi], w / s, 'REPLACE')

VN = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('normal', VN); VN = VN.reshape(-1, 3)
CVn = np.zeros(len(me.loops), int); me.loops.foreach_get('vertex_index', CVn)
custom = VN[CVn].copy(); custom[:NL0] = saved_corner
me.normals_split_custom_set(custom.tolist()); me.update()

# ---------------- verify outer lock ----------------
P1 = vget(me)[:NV0]
T1 = np.zeros(len(me.vertices)); me.attributes['_TINT'].data.foreach_get('value', T1)
C1 = np.zeros(len(me.loops) * 4); me.attributes['Color'].data.foreach_get('color', C1); C1 = C1.reshape(-1, 4)
U2 = np.zeros(len(me.loops) * 2); me.uv_layers[0].data.foreach_get('uv', U2); U2 = U2.reshape(-1, 2)
CV1 = np.zeros(len(me.loops), int); me.loops.foreach_get('vertex_index', CV1)
cn1 = np.array([n.vector[:] for n in me.corner_normals])[:NL0]
W1 = [{body.vertex_groups[g.group].name: g.weight for g in me.vertices[i].groups} for i in range(NV0)]
lock = dict(
    max_pos_diff=float(np.abs(P1 - P0).max()),
    tint_changed=int((np.round(T1[:NV0]) != T0i).sum()),
    loop_vertex_changed=int((CV1[:NL0] != CV0).sum()),
    color_changed=int((np.abs(C1[:NL0] - COL0).max(1) > 1e-6).sum()),
    uv_changed=int((np.abs(U2[:NL0] - UV0).max(1) > 1e-7).sum()),
    uv_changed_below_head=int(((np.abs(U2[:NL0] - UV0).max(1) > 1e-7) & (P0[CV0, 2] < HEAD_Z)).sum()),
    weights_changed=int(sum(1 for a, b in zip(W0, W1) if a.keys() != b.keys() or any(abs(a[k] - b[k]) > 1e-6 for k in a))),
    corner_normal_maxdiff=float(np.abs(cn1 - saved_corner).max()),
    corner_normal_loops_off=int((np.abs(cn1 - saved_corner).max(1) > 1e-3).sum()),   # Blender's own same-mesh custom-normal round trip already flips 2 degenerate loops
)
dn = np.abs(cn1 - saved_corner).max(1); log('normal diff loops >1e-3', int((dn > 1e-3).sum()), '>0.05', int((dn > 0.05).sum()), 'z of worst', P0[CV0[dn > 0.05], 2][:10].round(3).tolist())
log('outer lock', lock)
assert lock['max_pos_diff'] == 0.0 and lock['tint_changed'] == 0 and lock['color_changed'] == 0 and lock['loop_vertex_changed'] == 0
assert lock['uv_changed_below_head'] == 0 and lock['weights_changed'] == 0 and lock['corner_normal_loops_off'] <= 2
for k, v in extras0.items(): assert body[k] == v
liner_tris = len(F)

# ---------------- export ----------------
bpy.data.objects.remove(liner, do_unlink=True)
assert sorted(a.name for a in bpy.data.actions) == actions0
me.color_attributes.active_color = me.color_attributes['Color']
out_hi = Path(A.out_hi); out_hi.parent.mkdir(parents=True, exist_ok=True)
for o in bpy.context.view_layer.objects: o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=str(out_hi), export_format='GLB', export_attributes=True,
    export_vertex_color='ACTIVE', export_all_vertex_colors=False,
    export_animations=True, export_animation_mode='ACTIONS', export_skins=True,
    export_image_format='WEBP', export_image_quality=90,
    export_draco_mesh_compression_enable=True, export_draco_position_quantization=A.draco_pos,
    export_def_bones=False, export_yup=True, export_extras=True)
shutil.copy2(out_hi, A.out_lo)
tris = sum(len(p.vertices) - 2 for p in me.polygons)
metrics = dict(src=A.src, outer_verts=NV0, outer_loops=NL0, liner_verts=len(V), liner_tris=liner_tris, body_verts=len(me.vertices),
               body_tris=tris, eye_rim_dark_loops=int(dark.sum()), eye_rim_faces=len(dark_faces), eye_rim_loops_snapped=n_snap,
               head_white_check=white_check, lock=lock, liner_check=FINAL, liner_edges_x_outer=X1, outer_edges_x_liner=X2,
               actions=actions0, bytes=out_hi.stat().st_size)
log('METRICS', json.dumps(metrics))
if A.metrics: Path(A.metrics).write_text(json.dumps(metrics, indent=1))
log('saved', out_hi, out_hi.stat().st_size, '->', A.out_lo)
