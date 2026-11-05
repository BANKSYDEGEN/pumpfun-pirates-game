# [V6 store] Shoes & Pants: the store pants from the v5 classic pants (v5 shape, v5 weights), tailored in texture space:
# 2x upscale + halo-free sharpen (hi), crisp lo; recolour per style; painted side seams + stitching, knee / seat folds,
# a stitched waistband line under the belt, turn-up cuffs / hem stitching; sailor: navy bell-bottoms + a buttoned fall-front;
# breeches: dark leather, knee length, a buckled knee band.   blender -b -P pants.py -- SEX LOD SRCDIR OUTDIR
import bpy, bmesh, sys, os, math, numpy as np
sys.path.insert(0, os.environ.get('PYLIBS', '/workspace/raul_items_redo_work/py311'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/..')
from scipy import ndimage
import paint
a = sys.argv[sys.argv.index('--') + 1:]; SEX, LOD, SRC, OUT = a[:4]; HI = LOD == 'hi'
def load(f):
  bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=f)
  return [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.name.startswith('Ico')][0]
def sharpen(A, up):
  """A HxWx3 float. up: 2x cubic. unsharp mask clamped to the local 3x3 min/max (no halos)"""
  if up > 1: A = np.clip(np.stack([ndimage.zoom(A[..., k], up, order=3) for k in range(3)], -1), 0, 1)
  B = np.stack([ndimage.gaussian_filter(A[..., k], 1.4 if up > 1 else 1.0) for k in range(3)], -1)
  S = A + (0.9 if up > 1 else 0.6) * (A - B)
  lo_ = np.stack([ndimage.minimum_filter(A[..., k], 3) for k in range(3)], -1); hi_ = np.stack([ndimage.maximum_filter(A[..., k], 3) for k in range(3)], -1)
  return np.clip(S, lo_, hi_)
def flare(o, z0, zb, k=0.55, drop=0.6):
  MW = o.matrix_world; MI = MW.inverted()
  for v in o.data.vertices:
    p = MW @ v.co
    if p.z >= z0: continue
    t = (z0 - p.z) / max(z0 - zb, 1e-3); cx = 0.09 * (1 if p.x > 0 else -1); p.x = cx + (p.x - cx) * (1 + k * t); p.y = p.y * (1 + k * t * 0.8); p.z = p.z - (z0 - p.z) * drop * t; v.co = MI @ p
def cut(o, keep):
  bm = bmesh.new(); bm.from_mesh(o.data); MW = o.matrix_world
  bad = [f for f in bm.faces if not keep(min((MW @ v.co).z for v in f.verts))]
  bmesh.ops.delete(bm, geom=bad, context='FACES'); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS'); bm.to_mesh(o.data); bm.free()
def tailor(o, style):
  me = o.data; mat = me.materials[0]; tn = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and not n.image.name.endswith('_n')][0]
  src = tn.image; W0, H0 = src.size; A = np.array(src.pixels[:], np.float32).reshape(H0, W0, 4)[..., :3]
  up = 2 if HI else 1; A = sharpen(A, up); H, W = A.shape[:2]
  FI, P3 = paint.raster(me, W, H); m = FI >= 0
  MW = np.array(o.matrix_world); P3 = P3 @ MW[:3, :3].T + MW[:3, 3]
  X, Y, Z = P3[..., 0], P3[..., 1], P3[..., 2]
  P3w = True
  c = A; mx = c.max(-1); mn = c.min(-1); s = (mx - mn) / np.maximum(mx, 1e-4); d = np.maximum(mx - mn, 1e-4); r, g, b = c[..., 0], c[..., 1], c[..., 2]
  hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
  cloth = m & (hue > 6) & (hue < 50) & (s > (0.12 if SEX == 'male' else 0.05)) & (mx < 0.8) & (mx > 0.04)   # the brown cloth (not the belt buckle gold, the red sash, the black belt)
  gold = m & (hue > 30) & (hue < 60) & (s > 0.4) & (mx > 0.45)
  if gold.sum() > 50:   # the belt (buckle down) keeps its leather: only the cloth under it recolours
    gz = np.percentile(Z[gold], 3) if SEX == 'male' else np.percentile(Z[gold & (Z > 0.30)], 40) - 0.022
  else: gz = 9
  cloth = cloth & ~gold
  cloth = ndimage.binary_opening(cloth, iterations=1)
  L = c.mean(-1); ref = np.median(L[cloth]); k = np.clip(L / max(ref, 1e-3), 0.45, 1.5)
  COL = {'classic': None, 'canvas': (0.72, 0.62, 0.44), 'sailor': (0.14, 0.19, 0.38), 'breeches': (0.33, 0.19, 0.10)}[style]
  out = A.copy()
  under = cloth & (Z < gz - 0.004)
  if style == 'sailor' and SEX == 'female': under = under | (m & (Z < 0.30) & ~gold)   # the stretched shorts hem: all cloth
  if COL is not None: out[under] = (np.array(COL) * k[..., None])[under]
  cloth = under
  # leg frame: per side, the angle round the leg centre (outer side = 0)
  V = np.array([tuple(o.matrix_world @ v.co) for v in me.vertices]); legs = V[V[:, 2] < 0.36]
  cx = {sx: np.median(legs[np.sign(legs[:, 0]) == sx][:, 0]) for sx in (1, -1)}; cy = np.median(legs[:, 1])
  sx = np.where(X > 0, 1.0, -1.0); ccx = np.where(X > 0, cx[1], cx[-1]); ang = np.arctan2(Y - cy, (X - ccx) * sx)   # 0 = outer side, +-pi = inner
  zmin = legs[:, 2].min(); hem = {}
  for s_ in (1, -1):
    Ls = legs[np.sign(legs[:, 0]) == s_]; hem[s_] = np.percentile(Ls[:, 2], 3)
  hz = np.where(X > 0, hem[1], hem[-1])
  px = 1.0 / (W / 1024)   # texel size factor (1 = 1024 px)
  # 1 fold shading: soft creases at the knee back / crotch / over the shin
  fold = np.sin(Z * 260 + 3.0 * np.sin(ang * 2 + Z * 40)) * np.exp(-((Z - (hz + 0.06)) / 0.05) ** 2) * (0.6 + 0.4 * np.cos(ang))
  fold2 = np.exp(-((Z - 0.335) / 0.03) ** 2) * np.clip(np.cos(ang - math.pi), 0, 1) * np.sin(ang * 9) 
  f = 1 - 0.13 * np.clip(fold, 0, 1) + 0.05 * np.clip(-fold, 0, 1) - 0.10 * np.clip(fold2, 0, 1)
  out = np.where(cloth[..., None], out * f[..., None], out)
  # 2 side seams (outer + inner): a dark seam line, stitch dashes either side
  for a0 in (0.0, math.pi):
    da = np.abs(((ang - a0 + math.pi) % (2 * math.pi)) - math.pi); rr = 0.045   # leg radius-ish: angle -> metres
    dm = da * rr; seam = cloth & (dm < 0.0012) & (Z < 0.38); out[seam] *= 0.55
    st = cloth & (np.abs(dm - 0.0032) < 0.0008) & (np.sin(Z * 1400) > 0.2) & (Z < 0.38); out[st] = np.minimum(out[st] * 1.55 + 0.06, 1)
  # 3 waistband stitch line just under the belt, 4 hem: turn-up cuff edge + stitching
  belt = m & ~cloth & (Z > 0.33)
  if belt.any():
    bz = np.percentile(Z[belt], 5); wb = cloth & (np.abs(Z - (bz - 0.010)) < 0.0007) & (np.sin(ang * 60) > 0.0); out[wb] = np.minimum(out[wb] * 1.6 + 0.06, 1)
  hc = cloth & (np.abs(Z - (hz + 0.020)) < 0.0013); out[hc] *= 0.6
  hs = cloth & (np.abs(Z - (hz + 0.012)) < 0.0007) & (np.sin(ang * 70) > 0.1); out[hs] = np.minimum(out[hs] * 1.6 + 0.06, 1)
  if style == 'sailor':   # a buttoned fall-front: the flap outline + 2 x 3 bone buttons
    fr = cloth & (Y < cy) & (Z > 0.27) & (Z < 0.36)
    edge = fr & ((np.abs(np.abs(X) - 0.075) < 0.0012) | (np.abs(Z - 0.272) < 0.0012)) & (np.abs(X) < 0.077); out[edge] *= 0.55
    for bx in (-0.06, 0.06):
      for bzz in (0.29, 0.315, 0.34):
        bt = fr & ((X - bx) ** 2 + (Z - bzz) ** 2 < 0.0045 ** 2); out[bt] = (0.92, 0.89, 0.80)
        rim = fr & (np.abs(np.sqrt((X - bx) ** 2 + (Z - bzz) ** 2) - 0.0045) < 0.0008); out[rim] = (0.35, 0.32, 0.28)
  if style == 'breeches':   # a buckled knee band at the hem, leather sheen
    kb = cloth & (Z > hz + 0.004) & (Z < hz + 0.020); out[kb] = out[kb] * 0.55
    kbe = cloth & ((np.abs(Z - (hz + 0.004)) < 0.0008) | (np.abs(Z - (hz + 0.020)) < 0.0008)); out[kbe] = out[kbe] * 0.5
    bk = kb & (np.abs(ang) < 0.22) & (np.abs(Z - (hz + 0.012)) < 0.0075)
    out[bk] = (0.91, 0.70, 0.25); ins = bk & (np.abs(ang) < 0.12) & (np.abs(Z - (hz + 0.012)) < 0.004); out[ins] = out[ins] * 0.35
    sheen = cloth & (np.sin(Z * 90 + ang * 2) > 0.85); out[sheen] = np.minimum(out[sheen] * 1.18, 1)
  if style == 'canvas':   # canvas weave: fine cross-hatch
    wv = 1 + 0.03 * np.sin(X * 2600) * np.sin(Z * 2600); out = np.where(cloth[..., None], out * wv[..., None], out)
  # dilate the paint into the gutter so mip / bilinear never bleeds black
  out = np.clip(out, 0, 1); _, (iy, ix) = ndimage.distance_transform_edt(~m, return_indices=True); out = out[iy, ix]
  im = bpy.data.images.new(f'{style}_{SEX}_{LOD}', W, H); im.pixels[:] = np.dstack([out, np.ones((H, W))]).astype(np.float32).ravel()
  im.file_format = 'WEBP'; tn.image = im
  # the normal map (hi): 2x too so its detail matches
  for n in mat.node_tree.nodes:
    if n.type == 'TEX_IMAGE' and n.image.name.endswith('_n') and HI:
      N0 = np.array(n.image.pixels[:], np.float32).reshape(H0, W0, 4)[..., :3]; N2 = np.clip(np.stack([ndimage.zoom(N0[..., k], 2, order=1) for k in range(3)], -1), 0, 1)
      nim = bpy.data.images.new(f'{style}_{SEX}_{LOD}_n', W, H); nim.pixels[:] = np.dstack([N2, np.ones((H, W))]).astype(np.float32).ravel(); nim.file_format = 'WEBP'; nim.colorspace_settings.name = 'Non-Color'; n.image = nim
def even_hem(o, band=0.05, q=80):
  """the ragged v5 hem, stretched long, opens gaps between its points: clamp the hem up to one even line per leg"""
  MW = o.matrix_world; MI = MW.inverted(); P = {v.index: MW @ v.co for v in o.data.vertices}
  for sx in (1, -1):
    Z = np.array([p.z for p in P.values() if np.sign(p.x) == sx]); z0 = Z.min(); H = Z[Z < z0 + band]; zc = np.percentile(H, q)
    for v in o.data.vertices:
      p = P[v.index]
      if np.sign(p.x) == sx and p.z < zc: p.z = zc; v.co = MI @ p
def clear(o, zmax, gap=0.007):
  """push the (reshaped) pants out of the conformed V6 leg: every vert under zmax at least `gap` outside the skin, then relax"""
  from mathutils.bvhtree import BVHTree
  import mathutils
  bpy.ops.import_scene.gltf(filepath=f"{os.environ.get('BODY', os.path.dirname(os.path.abspath(__file__)) + '/../out_c')}/pirate_{SEX}_v6_{LOD}.glb")
  body = [b for b in bpy.context.scene.objects if b.type == 'MESH' and b.name.startswith('pirate_')][0]
  bm = bmesh.new(); bm.from_mesh(body.data); bm.transform(body.matrix_world); bv = BVHTree.FromBMesh(bm)
  MW = o.matrix_world; MI = MW.inverted(); moved = 0
  for it in range(3):
    for v in o.data.vertices:
      p = MW @ v.co
      if p.z > zmax: continue
      loc, n, i, d = bv.find_nearest(p)
      if loc is None: continue
      sd = (p - loc).dot(n)
      if sd < gap: p = p + n * (gap - sd); v.co = MI @ p; moved += 1
  for b in [b for b in bpy.context.scene.objects if b != o and b.type == 'MESH']: bpy.data.objects.remove(b)
  print('clear moved', moved, flush=True)
def save(o, id_):
  o.name = o.data.name = f'{id_}_{SEX}_{LOD}'; o.data.materials[0].name = id_
  bpy.ops.object.select_all(action='SELECT')
  bpy.ops.export_scene.gltf(filepath=f'{OUT}/{id_}_{SEX}_{LOD}.glb', export_format='GLB', export_attributes=True, export_vertex_color='ACTIVE', export_animations=False, export_skins=True,
    export_image_format='WEBP', export_image_quality=84, export_draco_mesh_compression_enable=False, export_def_bones=False, export_yup=True, export_extras=True)
  print('MADE', id_, SEX, LOD, os.path.getsize(f'{OUT}/{id_}_{SEX}_{LOD}.glb') // 1024, 'kb', flush=True)
os.makedirs(OUT, exist_ok=True); pf = f'{SRC}/pants_classic_{SEX}_{LOD}.glb'
o = load(pf); tailor(o, 'classic'); save(o, 'classic_pants')
o = load(pf); tailor(o, 'canvas'); save(o, 'canvas_pants')
o = load(pf); (flare(o, 0.30, 0.185) if SEX == 'male' else flare(o, 0.40, 0.28, k=0.10, drop=1.6)); (even_hem(o) if SEX == 'female' else None); clear(o, 0.36, 0.016); tailor(o, 'sailor'); save(o, 'sailor_trousers')
o = load(pf); (cut(o, lambda z0: z0 > 0.232) if SEX == 'male' else None); tailor(o, 'breeches'); save(o, 'leather_breeches')
