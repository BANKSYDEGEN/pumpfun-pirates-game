# [Raul items redo] PUMPFUN PIRATES shop BEARDS, rebuilt (BANKSY 10:02 AM 2026-11-04: "most of the new items are bad").
# blender -b -P build_beards.py -- <male|female> <hi|lo> <beard_moustache|beard_forked|beard_black>
#   -> assets/pirates/items/v5/<item>_<who>_<lod>.glb : ONE rigid mesh (rides bone 'head', v5 bind space), vertex colours + ink shell
# Sculpted clumped toon locks (SDF smooth unions -> marching cubes -> decimated to the LOD budget). The forked beard + Blackbeard
# envelope the body's own painted beard (+ margin, mouth left open) so they never fight it or float; the moustache sits on the lip.
# Colours: moustache / forked are KEYED (magenta = the beard colour, cyan = its groove shade: js/pirateGear.js beardCols);
# Blackbeard is fixed black with blue-grey crests + red ribbons. Female files exist but beards are male-only (beardShows).
import bpy, sys, os, math, json, numpy as np
sys.path.insert(0, os.environ.get('PYLIBS', '/workspace/raul_items_redo_work/py311'))
from scipy.spatial import cKDTree
from scipy import ndimage
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE + '/../boots'); from bootgeo import *
from bootgeo import _polar
who, lod, item = sys.argv[-3:]; HI = lod == 'hi'
WT = os.environ.get('WT', os.path.abspath(HERE + '/../../..')); OUT = f'{WT}/assets/pirates/items/v5'
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(f):
  before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f); return [o for o in bpy.data.objects if o not in before]
objs = imp(f'{WT}/assets/pirates/pirate_{who}_v5_{lod}.glb'); arm = [o for o in objs if o.type == 'ARMATURE'][0]; arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
body = [o for o in objs if o.type == 'MESH' and 'body' in o.name][0]
BV = np.array([body.matrix_world @ v.co for v in body.data.vertices]); BF = [list(p.vertices) for p in body.data.polygons]
TI = np.array([a.value for a in body.data.attributes['_TINT'].data]); HAIR = np.abs(TI - 1) < 0.01; SKIN = np.abs(TI) < 0.01
EYE = np.array([o.matrix_world @ v.co for o in objs if o.name.startswith('v5_face_eyes') for v in o.data.vertices])
H = np.array(arm.matrix_world @ arm.data.bones['head'].head_local); EZ0 = float(EYE[:, 2].min())
BVH = BVHTree.FromPolygons([Vector(v) for v in BV], BF)
def face_y(x, z):
  h = BVH.ray_cast(Vector((x, -2.0, z)), Vector((0, 1, 0)), 5.0); return float(h[0][1]) if h[0] is not None else -0.25
# the painted beard (hair verts in front, under the eyes) and the mouth (skin island inside it)
BRD = BV[HAIR & (BV[:, 2] < EZ0 - 0.005) & (BV[:, 1] < H[1] + 0.03) & (BV[:, 2] > 0.70)]
MO = BV[SKIN & (BV[:, 1] < -0.2) & (np.abs(BV[:, 0]) < 0.11) & (BV[:, 2] > 0.85) & (BV[:, 2] < EZ0 - 0.01)]
if len(MO) < 4: MO = np.array([[0, -0.26, EZ0 - 0.07], [0.04, -0.25, EZ0 - 0.06], [-0.04, -0.25, EZ0 - 0.08]])
mz0, mz1, mx = 0.890, 0.929, 0.064; MZ = (mz0 + mz1) / 2   # the mouth (the teeth items' fit: grill_gold bounds), same on both LODs
if not HI:   # phone: the lo body's beard is sparse -> also take the hi body's painted beard so the shell has no gaps (then a bit more margin)
  o2 = imp(f'{WT}/assets/pirates/pirate_{who}_v5_hi.glb'); b2 = [o for o in o2 if o.type == 'MESH' and 'body' in o.name][0]
  V2 = np.array([b2.matrix_world @ v.co for v in b2.data.vertices]); T2 = np.array([a.value for a in b2.data.attributes['_TINT'].data])
  BRD = np.vstack([BRD, V2[(np.abs(T2 - 1) < 0.01) & (V2[:, 2] < EZ0 - 0.005) & (V2[:, 1] < H[1] + 0.03) & (V2[:, 2] > 0.70)]])
  for o in o2: bpy.data.objects.remove(o, do_unlink=True)
STEP = 0.0032 if HI else 0.0036
lo = np.array([-0.31, -0.40, 0.52]); hi_ = np.array([0.31, 0.06, EZ0 + 0.04])
gx, gy, gz = [np.arange(lo[k], hi_[k], STEP, dtype=np.float32) for k in range(3)]; X, Y, Z = np.meshgrid(gx, gy, gz, indexing='ij'); G = (X, Y, Z, lo, STEP)
PTS = np.c_[X.ravel(), Y.ravel(), Z.ravel()]
def env(margin):   # the painted beard as a smooth polar shell round the head axis (per height + angle: max radius + margin, smoothed)
  NB = 48; zs = np.arange(0.70, EZ0 + 0.011, 0.01); RR = np.zeros((len(zs), NB))
  th = ((np.arctan2(BRD[:, 1] - H[1], BRD[:, 0]) % (2 * math.pi)) / (2 * math.pi) * NB).astype(int) % NB; r = np.hypot(BRD[:, 0], BRD[:, 1] - H[1])
  for i, z in enumerate(zs):
    m = np.abs(BRD[:, 2] - z) < 0.012
    for b in np.unique(th[m]): RR[i, b] = r[m & (th == b)].max() + margin
  RR = ndimage.grey_dilation(RR, size=(1, 2), mode='wrap'); RR = ndimage.uniform_filter(RR, size=(3, 3), mode=('nearest', 'wrap'))
  cen = np.tile([0.0, H[1]], (len(zs), 1)); rho, R, _ = _polar(X, Y, Z, zs, cen, RR)
  th = np.arctan2(X, -(Y - H[1])); tw = th * 8 + (Z - 0.8) * 20   # sculpted clumps: vertical lock ridges that twist a little down the beard
  top = np.clip((EZ0 - 0.012 - Z) / 0.045, 0, 1); R = R - margin * (1 - top) ** 2 + (0.012 if HI else 0.008) * top * (0.5 + 0.5 * np.cos(tw)) ** 2
  return np.maximum(smax(np.where(R > 0.02, rho - R, 0.05), np.abs(X) - 0.195, 0.01), np.maximum(zs[0] - Z, Z - (EZ0 - 0.012))).astype(np.float32)
def mouth_cut(f, grow=0.006):   # leave the mouth open (a soft tunnel through the beard along y)
  e = np.sqrt((X / (mx + grow)) ** 2 + ((Z - MZ) / ((mz1 - mz0) / 2 + grow)) ** 2) - 1
  return smax(f, -(e * 0.03), 0.004)
def torus_sd(c, n, R, r):
  n = np.asarray(n, float); n /= np.linalg.norm(n); dx, dy, dz = X - c[0], Y - c[1], Z - c[2]; a = dx * n[0] + dy * n[1] + dz * n[2]
  rr = np.sqrt(np.maximum(dx * dx + dy * dy + dz * dz - a * a, 0)); return np.sqrt((rr - R) ** 2 + a * a) - r
CLUMPS = []   # (name, sdf) : the colour pass finds the grooves between neighbouring clumps
def lock(name, ctrl, r0, r1, n=7):
  P = bezier(ctrl, n); R = np.linspace(r0, r1, n) * (1 - 0.15 * np.sin(np.linspace(0, math.pi, n)) * 0); d = sd_tube(X, Y, Z, P, R); CLUMPS.append((name, d)); return d
def on_face(x, z, off): return face_y(x, z) - off
def moustache(size, curl, off, nl=3):   # handlebar: per side nl tapered strands that fan from under the nose and curl up at the tips
  ds = []
  for s in (1, -1):
    for k in range(nl):
      c = k - (nl - 1) / 2; dz = c * 0.009 * size; w = 1 - 0.12 * abs(c)
      xs = np.array([0.004, 0.045, 0.088, 0.122, 0.136, 0.115]) * size * w
      zs = np.array([0.016, 0.004, -0.008, 0.0 + 0.008 * curl, 0.016 + 0.02 * curl, 0.026 + 0.03 * curl]) * size + mz1 + 0.004 + dz * (1 - np.arange(6) / 6)
      if curl < 0.5: xs[-1] = 0.15 * size * w; zs[-1] = zs[-2] - 0.01
      ctrl = [[s * x, on_face(s * x * 0.92, z, off + 0.006 * math.sin(math.pi * min(i, 4) / 5) + 0.003 * i), z] for i, (x, z) in enumerate(zip(xs, zs))]
      ds.append(lock(f'mu{s}{k}', ctrl, (0.019 - 0.004 * abs(c)) * size, 0.004 * size))
  return ds
def union(ds, k):
  out = ds[0]
  for d in ds[1:]: out = smin(out, d, k)
  return out
parts = []; KEYED = item != 'beard_black'
C1 = np.array(KEY1, float); C2 = np.array(KEY2, float)
GOLD = COL('#e8ad2a'); RED = COL('#c41e2a')
if item == 'beard_moustache':
  f = union(moustache(1.25, 1.0, 0.006 if HI else 0.011, 3 if HI else 2), 0.008)
  f = smin(f, sd_ellipsoid(X, Y - (face_y(0, mz1 + 0.02) - 0.004), Z - (mz1 + 0.026), 0.026, 0.012, 0.014), 0.01)   # the root under the nose
  CLUMPS.append(('root', f))
  parts.append(('hair', ndimage.gaussian_filter(f, 0.7)))
  BUD = {'hair': 700 if HI else 284}
else:
  big = item == 'beard_black'
  base = mouth_cut(env((0.009 if not big else 0.012) + (0 if HI else 0.005))); CLUMPS.append(('base', base))
  # jaw contour: per angle round the head axis, the bottom of the painted beard
  th_ = np.arctan2(BRD[:, 0], -(BRD[:, 1] - H[1])); locks = []
  angs = np.linspace(-1.25, 1.25, 9 if big else 5)
  for i, a in enumerate(angs):
    m = np.abs(th_ - a) < 0.2; Q = BRD[m] if m.sum() > 3 else BRD
    zb = float(np.percentile(Q[:, 2], 4)); r = float(np.percentile(np.hypot(Q[:, 0], Q[:, 1] - H[1]), 80))
    d = np.array([math.sin(a), -math.cos(a)])
    root = np.array([d[0] * (r - 0.005), H[1] + d[1] * (r - 0.005), zb + 0.05])
    if big:
      L = 0.19 - 0.09 * abs(a) / 1.25; tip = np.array([root[0] * 0.55, root[1] - 0.05, root[2] - L])   # locks sweep in to a spade
      mid = (root + tip) / 2 + np.array([d[0] * 0.035, -0.045, 0.0])
      locks.append(lock(f'bl{i}', [root, mid, tip], 0.05 - 0.012 * abs(a), 0.022))
    elif False:
      tip = root + np.array([d[0] * 0.02, -0.02, -0.07]); locks.append(lock(f'bl{i}', [root, (root + tip) / 2 + np.array([0, -0.02, 0]), tip], 0.03, 0.008))
  # chin mass
  cy = face_y(0, 0.80) - 0.02; chin = sd_ellipsoid(X, Y - cy, Z - 0.79, 0.12 if not big else 0.15, 0.05, 0.06); CLUMPS.append(('chin', chin))
  f = smin(base, chin, 0.03)
  for k, d in enumerate(locks): f = smin(f, d, 0.03 if big else 0.014); CLUMPS.append((f'lk{k}', d))
  gold = []
  if not big:   # the forks: two braids of alternating lobes, gold rings
    for s in (1, -1):
      top = np.array([s * 0.042, cy - 0.01, 0.765]); bot = np.array([s * 0.085, cy - 0.035, 0.585]); n = 6
      for k in range(n):
        t = (k + 0.5) / n; c = top * (1 - t) + bot * t + np.array([s * 0.008 * (1 if k % 2 else -1), 0, 0]); r = 0.032 - 0.014 * t
        d = sd_ellipsoid(X - c[0], Y - c[1], Z - c[2], r, r * 0.9, 0.022); CLUMPS.append((f'br{s}{k}', d)); f = smin(f, d, 0.006)
      tip = lock(f'tt{s}', [bot, bot + np.array([s * 0.012, -0.004, -0.03]), bot + np.array([s * 0.01, 0, -0.05])], 0.016, 0.004); f = smin(f, tip, 0.008)
      for t in (0.42, 0.93):
        c = top * (1 - t) + bot * t; gold.append(torus_sd(c, bot - top, 0.030 - 0.014 * t, 0.0065))
    for d in moustache(1.0, 0.6, 0.006, 2): f = smin(f, d, 0.008)
  else:         # Blackbeard: big wide moustache + 3 thin braids with red ribbons among the locks
    for d in moustache(1.3, 0.35, 0.012, 3): f = smin(f, d, 0.01)
    for s, xo in ((1, 0.07), (-1, 0.07), (1, 0.0)):
      top = np.array([s * xo, cy - 0.04, 0.72]); bot = top + np.array([s * 0.012, -0.02, -0.075])
      d = lock(f'bb{s}{xo}', [top, (top + bot) / 2 + np.array([0, -0.02, 0]), bot], 0.02, 0.012); f = smin(f, d, 0.006)
      c = top * 0.2 + bot * 0.8; gold.append(torus_sd(c, bot - top, 0.014, 0.0065)); gold.append(sd_ellipsoid(X - c[0], Y - (c[1] - 0.012), Z - c[2], 0.022, 0.007, 0.011))
  f = mouth_cut(f, 0.004)
  parts.append(('hair', ndimage.gaussian_filter(f, 0.9 if HI else 0.7)))
  if gold: parts.append(('trim', ndimage.gaussian_filter(union(gold, 0.002), 0.6)))
  BUD = {'hair': (3400 if big else 2200) if HI else (850 if big else 560), 'trim': (380 if HI else 120)}
# ---- mesh, decimate, colour
geo_parts = []
for kind, fld in parts:
  _, _, V, Fc = mc_part(fld, G, kind, 1)
  V, Fc = decimate(V, Fc, BUD[kind])
  if kind == 'trim': C = shade('gold', V, Fc, GOLD, 1.0) if KEYED else np.tile(RED, (len(V), 1)) * (0.8 + 0.25 * np.clip(vnormals(V, Fc)[:, 2], 0, 1))[:, None]
  else:
    # grooves: where the two nearest clumps are about as close (the seams between locks / lobes) -> the groove shade
    vx, vy, vz = V[:, 0], V[:, 1], V[:, 2]; D = []
    for nm, d in CLUMPS:
      ij = np.clip(np.round((V - lo) / STEP).astype(int), 0, np.array(X.shape) - 1); D.append(d[tuple(ij.T)])
    D = np.sort(np.array(D), axis=0); groove = (D[1] - D[0]) < (0.006 if HI else 0.008)
    if item != 'beard_moustache':
      twv = np.arctan2(vx, -(vy - H[1])) * 8 + (vz - 0.8) * 20; groove |= (np.cos(twv) < -0.55) & (vz < EZ0 - 0.03) & (D[0] > -0.02)
    N = vnormals(V, Fc); crest = np.clip(N[:, 2] * 0.5 - N[:, 1] * 0.6, 0, 1) * (1 - groove)
    if KEYED: C = np.where(groove[:, None], C2, C1)
    else:
      dk, mid, cr = COL('#08080b'), COL('#22212b'), COL('#5d6a88')
      t = (0.2 + 0.8 * crest)[:, None] * (1 + 0.1 * noise(V)[:, None]); C = np.where(groove[:, None], dk, mid * (1 - t * 0.6) + cr * t * 0.6)
  geo_parts.append(Part(V, Fc, C, True))
m = finish(geo_parts, ink=(0.0035 if HI else 0.0055), lowlight=not HI)
me = bpy.data.meshes.new(f'{item}_{who}_{lod}'); me.from_pydata(m.V.tolist(), [], m.F.tolist()); me.update()
for p_ in me.polygons: p_.use_smooth = True
ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.hstack([m.C, np.ones((len(m.C), 1))]).astype(np.float32).ravel()); me.color_attributes.active_color = ca
mat = bpy.data.materials.new(item); mat.use_nodes = True; nt = mat.node_tree; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
nt.links.new(vc.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(mat)
ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob)
for o in list(bpy.data.objects):
  if o is not ob: bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
os.makedirs(OUT, exist_ok=True); fn = f'{OUT}/{item}_{who}_{lod}.glb'
bpy.ops.export_scene.gltf(filepath=fn, export_format='GLB', use_selection=True, export_skins=False, export_animations=False, export_yup=True, export_vertex_color='ACTIVE', export_attributes=False, export_materials='EXPORT')
print('BUILT', item, who, lod, 'tris', len(m.F), 'verts', len(m.V), 'kb', os.path.getsize(fn) // 1024, json.dumps(dict(mouth=[round(mz0, 3), round(mz1, 3), round(mx, 3)], ez0=round(EZ0, 3))))
