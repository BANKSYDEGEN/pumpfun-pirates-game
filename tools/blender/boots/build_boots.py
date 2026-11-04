# [Raul items redo] PUMPFUN PIRATES shop BOOTS, rebuilt (BANKSY 10:02 AM 2026-11-04 "the boots are real bad").
# blender -b -P build_boots.py -- <male|female> <hi|lo> <boots_buckle|boots_cavalier|boots_gold>
#   -> assets/pirates/items/v5/<item>_<who>_<lod>.glb  (ONE mesh, ONE material, vertex colours + ink shell, skinned)
# One boot per foot, measured from THAT leg only (body + base outfit, v5 bind pose): chunky vinyl-toy SDF shapes (smooth unions:
# toe box + shaft + sole + heel, per-style cuff / strap / buckle / caps) -> marching cubes -> decimated to the LOD budget.
# Skinned by copying the nearest leg verts' thigh / shin weights (bends exactly like the leg it covers). The body + base outfit
# under it hide below BOOT_CUT (js/pirateItems.js); a peg on that side drops that whole boot (bootsUnderPeg, x sign in bind space).
# Needs scikit-image + scipy for Blender's python: pip install --target <dir> scipy==1.11.4 scikit-image==0.21.0 lazy_loader packaging
import bpy, sys, os, math, json, numpy as np
sys.path.insert(0, os.environ.get('PYLIBS', '/workspace/raul_items_redo_work/py311'))
from skimage.measure import marching_cubes
from scipy.spatial import cKDTree
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); from bootgeo import *
who, lod, item = sys.argv[-3:]; HI = lod == 'hi'; F = who == 'female'
WT = os.environ.get('WT', os.path.abspath(HERE + '/../../..')); OUT = f'{WT}/assets/pirates/items/v5'
STYLE = item.split('_')[1]   # buckle | cavalier | gold
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(f):
  before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f); return [o for o in bpy.data.objects if o not in before]
objs = imp(f'{WT}/assets/pirates/pirate_{who}_v5_{lod}.glb') + imp(f'{WT}/assets/pirates/items/v5/cloth_base_{who}_{lod}.glb')
arms = [o for o in objs if o.type == 'ARMATURE']; arm = arms[0]
for a in arms: a.data.pose_position = 'REST'
bpy.context.view_layer.update()
# every leg vert of the body + base outfit: position (world, Blender Z-up) + thigh / shin weights per side
PTS = []; WTS = []
for o in objs:
  if o.type != 'MESH' or not (o.name.startswith('pirate_') or o.name.startswith('cloth_base')): continue
  gn = {g.index: g.name for g in o.vertex_groups}; mw = o.matrix_world
  for v in o.data.vertices:
    p = mw @ v.co
    if p.z > 0.34: continue
    w = {gn[g.group]: g.weight for g in v.groups if gn.get(g.group, '').split('.')[0] in ('thigh', 'shin')}
    PTS.append((p.x, p.y, p.z)); WTS.append(w)
PTS = np.array(PTS)
KNEE = float((arm.matrix_world @ arm.data.bones['shin.L'].head_local).z)   # male 0.214, female 0.224
# per-style dimensions (metres, bind space; the chibi foot is ~0.17 wide x 0.25 long)
# [Raul items redo 2] tops sit just under the knee and flare over the baggy pant hem (tucked-in read), never past the knee
S = {'buckle': dict(top=KNEE - 0.020, lth=COL('#86482a'), dk=COL('#4a2716')),   # [boots 3] BANKSY 4:02 PM 'make the boots nicer': richer toon leather
     'cavalier': dict(top=KNEE - 0.024, lth=COL('#2f2629'), dk=COL('#151012')),
     'gold': dict(top=KNEE - 0.022, lth=COL('#28222a'), dk=COL('#110d10'))}[STYLE]
TOP = S['top']; CUT = TOP - 0.024
STEP = 0.0026 if HI else 0.0042
NTH, SUB = (32, 2) if HI else (16, 1)
parts = []; side_pts = {}; FOOT = {}
for sx in (1, -1):
  sel = (np.sign(PTS[:, 0]) == sx) & (np.abs(PTS[:, 0]) > 0.004)
  P = PTS[sel]; side_pts[sx] = (P, [WTS[i] for i in np.where(sel)[0]])
  Pl = P[(P[:, 2] < TOP + 0.004) & (np.abs(P[:, 0]) > 0.028)]
  foot = P[P[:, 2] < 0.075]; fx0, fx1 = np.percentile(foot[:, 0], [1, 99]); fy0, fy1 = np.percentile(foot[:, 1], [0.5, 99.5])
  if sx < 0: fx0, fx1 = fx1, fx0
  # shaft envelope: per height slice, polar radius around the slice centre (24 bins, max), smoothed
  zs = np.arange(0.05, TOP + 0.011, 0.01); NB = 24; cen = []; RR = []
  for z in zs:
    Q = Pl[np.abs(Pl[:, 2] - z) < 0.012]
    if len(Q) < 8: Q = P[np.abs(P[:, 2] - z) < 0.02]
    c = np.array([(Q[:, 0].min() + Q[:, 0].max()) / 2, (Q[:, 1].min() + Q[:, 1].max()) / 2]); d = Q[:, :2] - c
    th = (np.arctan2(d[:, 1], d[:, 0]) % (2 * math.pi)) / (2 * math.pi) * NB; r = np.linalg.norm(d, axis=1); R = np.zeros(NB)
    for b in range(NB):
      m = (th >= b) & (th < b + 1); R[b] = r[m].max() if m.any() else 0
    good = R > 0
    if not good.all(): R = np.interp(np.arange(NB), np.where(good)[0], R[good], period=NB)
    R = np.maximum(R, np.convolve(np.r_[R[-2:], R, R[:2]], np.ones(5) / 5, 'valid'))   # convex-ish, no notches
    cen.append(c); RR.append(R)
  cen = np.array(cen); RR = np.array(RR)
  cen = np.array([np.convolve(np.r_[cen[:1, k], cen[:, k], cen[-1:, k]], [1/3]*3, 'valid') for k in (0, 1)]).T
  if STYLE in ('buckle', 'gold'):   # [Raul items redo 2] tuck: the top opens out to the pant hem's bell just above it, so the hem reads tucked into the boot
    Qh = P[(P[:, 2] > TOP - 0.004) & (P[:, 2] < TOP + 0.024)]; d = Qh[:, :2] - cen[-1]
    th = (np.arctan2(d[:, 1], d[:, 0]) % (2 * math.pi)) / (2 * math.pi) * NB; r = np.linalg.norm(d, axis=1); Rh = np.zeros(NB)
    for b in range(NB):
      m = (th >= b) & (th < b + 1); Rh[b] = np.percentile(r[m], 92) if m.sum() > 2 else 0
    good = Rh > 0
    if good.any() and not good.all(): Rh = np.interp(np.arange(NB), np.where(good)[0], Rh[good], period=NB)
    Rh = np.convolve(np.r_[Rh[-2:], Rh, Rh[:2]], np.ones(5) / 5, 'valid')
    for i, z in enumerate(zs):
      w = float(np.clip((z - (TOP - 0.045)) / 0.045, 0, 1)) ** 1.5
      RR[i] = RR[i] + w * np.maximum(0, Rh + 0.002 - RR[i])
  # grid
  lo = np.array([min(fx0, fx1) - 0.05, fy0 - 0.06, -0.006]); hi_ = np.array([max(fx0, fx1) + 0.05, fy1 + 0.06, TOP + 0.05])
  gx, gy, gz = [np.arange(lo[k], hi_[k], STEP) for k in range(3)]
  X, Y, Z = np.meshgrid(gx, gy, gz, indexing='ij')
  # ---- the leather upper: toe box (rounded, bulbous toe) U ankle U shaft, smooth unions
  mx = 0.012; fcx = (fx0 + fx1) / 2; fhx = abs(fx1 - fx0) / 2 + mx; toe = fy0 - mx - 0.006; heel = fy1 + mx
  foot_top = float(np.percentile(foot[foot[:, 1] < fy0 + 0.08][:, 2], 98)) if (foot[:, 1] < fy0 + 0.08).any() else 0.07
  fl = (heel - toe) / 2; fcy = (heel + toe) / 2; FOOT[sx] = (fcx, toe, heel)
  d_foot = sd_superellipsoid(X - fcx, Y - fcy, Z - 0.045, fhx, fl, max(0.05, foot_top + 0.012 - 0.045) , 3.2, 2.6)
  # toe box: fatter dome at the front (vinyl-toy bulb)
  d_toe = sd_ellipsoid(X - fcx, Y - (toe + 0.07), Z - 0.042, fhx * 1.02, 0.085, foot_top + 0.004 - 0.02)
  # shaft: polar envelope + margin, interpolated in z (flare per style)
  ms = 0.011 if STYLE != 'cavalier' else 0.013
  d_shaft = sd_polar(X, Y, Z, zs, cen, RR, ms, 0.03, TOP, flare=(0.010 if STYLE == 'cavalier' else 0.004))
  up = smin(smin(d_foot, d_toe, 0.02), d_shaft, 0.035)
  # catch-all: anything of the leg below the top this shape still misses gets covered (sphere union), then smooth
  kd = cKDTree(Pl); dd, _ = kd.query(np.c_[X.ravel(), Y.ravel(), Z.ravel()], distance_upper_bound=0.05); dd = np.minimum(dd, 0.05).reshape(X.shape)
  up = np.minimum(up, dd - 0.010)
  up = np.maximum(up, Z - TOP)                 # flat top (the pants cover it / the cuff sits on it)
  up = np.maximum(up, 0.010 - Z)               # the sole takes the bottom
  up = ndimage.gaussian_filter(up, 1.1 if HI else 0.8)
  G = (X, Y, Z, lo, STEP)
  INNER = 0.015   # the inner wall stays this far off the centre line (the other leg: no touching / crossing on walk, swim, emotes)
  up = smax(up, INNER - sx * X, 0.008)
  # sole + heel block: footprint of the upper at z 0.02, 7 mm proud, rounded slab; heel taller at the back (cavalier: stacked heel)
  foot2d = ndimage.gaussian_filter(np.min(np.where(np.abs(Z - 0.022) < STEP * 1.5, up, 9), axis=2), 1.0)[:, :, None]
  hz = {'cavalier': 0.040, 'buckle': 0.036, 'gold': 0.035}[STYLE]   # [boots 3] a defined heel block
  heel_r = np.clip((Y - (heel - 0.075)) / 0.03, 0, 1)
  sole_top = 0.022 + (hz - 0.022) * heel_r
  d_sole = np.maximum(foot2d - 0.0085, np.maximum(Z - sole_top, -0.003 - Z))   # [boots 3] welt 8.5 mm proud (was 7)
  d_sole = np.maximum(d_sole, -(np.maximum(heel - 0.075 - 0.02 - Y, 0.012 - Z) ) - 0.0) if STYLE == 'cavalier' else d_sole   # cavalier: arch gap in front of the heel
  d_sole = ndimage.gaussian_filter(d_sole, 0.9)
  d_sole = smax(d_sole, INNER - sx * X, 0.006)
  parts.append(mc_part(d_sole, G, 'sole', sx))
  parts.append(mc_part(up, G, 'upper', sx))
  ring_c = cen[-1]; ring_R = RR[-1]
  def shell(region, out=0.006, inn=0.0015, k=0.004, blur=None):   # a band / cap laid on the upper (`out` proud; its inside fills into the boot, never seen): smooth edges at any LOD
    return ndimage.gaussian_filter(smax(up - out, region, k), blur if blur is not None else (0.9 if HI else 0.7))
  if STYLE == 'buckle':
    # rolled top rim + an instep strap with a big gold buckle (front), a back pull tab
    rr_ = 0.0095; prof = [(rr_ * math.cos(a), TOP - 0.004 + rr_ * 0.85 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 6 if HI else 4, endpoint=False)]
    parts.append(('rim', sx) + sweep(ring_c, ring_R, ms + 0.004 + 0.002, prof, NTH * 3 // 4, 1))
    # strap: a slanted band over the instep, round the ankle
    zb = 0.072 + 0.22 * np.clip(Y - (toe + 0.11), -0.2, 0.2)
    parts.append(mc_part(shell(np.abs(Z - zb) - 0.013, 0.0075), G, 'strap', sx))
    bp, bn = on_surface(up, G, fcx, 0.078, front=True)
    parts.append(mc_part(sd_buckle_on(X, Y, Z, bp + bn * 0.004, bn, 0.054, 0.042, 0.0085, 0.009), G, 'gold', sx))   # [boots 3] bigger buckle (reads at game distance)
  elif STYLE == 'cavalier':
    # tall shaft + big flared bucket cuff folded down (tan suede), spur strap + silver spur
    c0 = TOP - 0.068; ct = TOP + 0.013
    prof = [(0.000, c0 - 0.002), (0.003, c0 + 0.03), (0.007, ct - 0.004), (0.015, ct + 0.003), (0.025, ct - 0.0), (0.028, ct - 0.010), (0.020, c0 + 0.02), (0.010, c0 - 0.004)]
    inner = lambda th: 0.4 + 0.6 * min(1.0, max(0.0, math.cos(th) * sx + 0.45))   # thin on the inside (the other leg), full flare outside / front / back
    parts.append(('cuff', sx) + sweep(ring_c, ring_R, ms + 0.010 + 0.002, prof, NTH + 4 if HI else NTH, 1, wave=lambda th: 0.003 * math.sin(5 * th) * inner(th), amp=inner))
    zb = 0.064 + 0.22 * np.clip(Y - (toe + 0.12), -0.2, 0.2)
    parts.append(mc_part(shell(np.abs(Z - zb) - 0.010, 0.0075), G, 'strap', sx))
    ox = fcx + sx * (fhx - 0.004); yy = toe + 0.15; bz = 0.064 + 0.22 * (yy - (toe + 0.12))   # buckle on the outer side of the strap
    col_ = up[int(round((ox - lo[0]) / STEP)), int(round((yy - lo[1]) / STEP)), :]
    sp_ = np.array([ox, yy, bz]); ix_ = int(round((ox - lo[0]) / STEP))
    row = up[:, int(round((yy - lo[1]) / STEP)), int(round((bz - lo[2]) / STEP))]; ins = np.where(row < 0)[0]
    xs_ = lo[0] + STEP * (ins[-1] if sx > 0 else ins[0]); bp = np.array([xs_, yy, bz]); bn = np.array([sx, 0.0, 0.0])
    parts.append(mc_part(sd_buckle_on(X, Y, Z, bp + bn * 0.004, bn, 0.030, 0.026, 0.007, 0.0065), G, 'silver', sx))
  else:
    # polished black leather: gold toe cap + heel cap + gold top band + gold buckle on the side of the band
    # rounded gold toe cap ([Raul items redo 2] phone: a crisper rim = less blur, a tighter blend, its own budget)
    parts.append(mc_part(shell(sd_ellipsoid(X - fcx, Y - (toe - 0.01), Z - 0.03, fhx + 0.03, 0.085, 0.075), 0.0065, k=0.004 if HI else 0.0015, blur=None if HI else 0.4), G, 'goldtoe', sx))
    parts.append(mc_part(shell(sd_ellipsoid(X - fcx, Y - (heel + 0.01), Z - 0.02, fhx + 0.03, 0.045, 0.045), 0.0055), G, 'gold', sx))   # heel cap
    prof = [(-0.002, TOP - 0.022), (0.006, TOP - 0.021), (0.008, TOP - 0.008), (0.006, TOP + 0.003), (-0.002, TOP + 0.002)]
    parts.append(('gold', sx) + sweep(ring_c, ring_R, ms + 0.004 + 0.001, prof, NTH * 7 // 8, 1))
    bp, bn = on_surface(up, G, fcx, TOP - 0.05, front=True)
    parts.append(mc_part(sd_buckle_on(X, Y, Z, bp + bn * 0.003, bn, 0.028, 0.024, 0.007, 0.006), G, 'gold', sx))
# ---- decimate each part to the LOD budget, colour it, skin it
BUD = {'upper': 1000, 'sole': 240, 'rim': 160, 'strap': 180, 'cuff': 300, 'gold': 150, 'goldtoe': 75, 'silver': 120} if HI else \
      {'upper': 280, 'sole': 60, 'rim': 50, 'strap': 50, 'cuff': 90, 'gold': 44, 'goldtoe': 64, 'silver': 36}
mesh_parts = []
for kind, sx, V, Fc in parts:
  if len(V): V = V.copy(); V[:, 0] = sx * np.maximum(sx * V[:, 0], 0.0145 + 0.004 * np.clip((sx * V[:, 0] - 0.0145) / 0.02, 0, 1) * 0)
  if len(Fc) == 0: continue
  if kind in ('rim', 'cuff') or (kind == 'gold' and len(Fc) < 1200 and STYLE == 'gold' and V[:, 2].max() > TOP - 0.001): mesh_parts.append((kind, sx, V, Fc)); continue   # swept: already at the LOD's ring count
  n = BUD[kind] * (0.5 if kind == 'gold' and STYLE == 'gold' else 1)
  V, Fc = decimate(V, Fc, int(n))
  mesh_parts.append((kind, sx, V, Fc))
COLS = dict(upper=S['lth'], sole=COL('#2b1a12'), rim=S['dk'], strap=COL('#3b2216') if STYLE == 'buckle' else COL('#151012'),
            cuff=COL('#c99a5b'), gold=COL('#e8ad2a'), goldtoe=COL('#e8ad2a'), silver=COL('#c9ced8'))
geo_parts = []
for kind, sx, V, Fc in mesh_parts:
  C = shade('gold' if kind == 'goldtoe' else kind, V, Fc, COLS[kind], TOP)
  if kind in ('upper', 'sole', 'strap', 'cuff'):   # [boots 3] painted leather detail: welt stitching, toe-cap seam, back seam, worn toe, sole edge
    fcx, toe, heel = FOOT[sx]; N = vnormals(V, Fc); fr = np.clip(-N[:, 1], 0, 1); bk = np.clip(N[:, 1], 0, 1); upn = np.clip(N[:, 2], 0, 1)
    ang = np.arctan2(V[:, 1] - (toe + heel) / 2, V[:, 0] - fcx); dash = np.sin(ang * (44 if HI else 22)) > 0.1
    if kind == 'upper':
      stitch = (np.abs(V[:, 2] - 0.032) < (0.0045 if HI else 0.006)) & dash
      C = np.where(stitch[:, None], np.minimum(C * 1.9 + 0.05, 1), C)
      dt = np.linalg.norm(V[:, [1, 2]] - np.array([toe + 0.005, 0.03]), axis=1)
      C = np.where(((np.abs(dt - 0.068) < (0.004 if HI else 0.006)) & (V[:, 1] < toe + 0.07) & (V[:, 2] > 0.03))[:, None], C * 0.55, C)   # toe-cap seam
      C = np.where(((np.abs(V[:, 0] - fcx) < (0.0045 if HI else 0.006)) & (bk > 0.55) & (V[:, 2] > 0.05))[:, None], C * 0.6, C)   # back seam
      wear = np.clip((toe + 0.06 - V[:, 1]) / 0.06, 0, 1) * upn * fr; C = C * (1 + 0.35 * wear)[:, None]   # polished toe
      cr = (V[:, 2] > 0.06) & (V[:, 2] < TOP - 0.02); C = C * (1 - 0.1 * cr * (0.5 + 0.5 * np.sin(V[:, 2] * (260 if HI else 150) + 2 * np.sin(ang * 3))))[:, None]   # shaft creases
    elif kind == 'sole':
      side_ = np.abs(N[:, 2]) < 0.6; C = np.where(side_[:, None], COL('#5a3b26') * (0.9 + 0.1 * fr)[:, None], C)   # light sole edge
      C = np.where((side_ & (V[:, 2] < 0.004))[:, None], COL('#1a110c'), C)   # dark tread line
    elif kind == 'strap':
      C = np.where((dash & (upn < 0.8))[:, None], np.minimum(C * 1.7 + 0.04, 1), C)
    elif kind == 'cuff':
      C = C * (0.78 + 0.22 * upn)[:, None] * (1 + 0.06 * np.sin(ang * 9))[:, None]   # suede folds: darker underside
    C = np.clip(C, 0, 1)
  geo_parts.append(Part(V, Fc, C, True))
m = finish(geo_parts, ink=(0.0035 if HI else 0.0055), lowlight=not HI)
side = np.sign(m.V[:, 0])
# skin: nearest leg verts (that side) -> thigh / shin weights, inverse-distance blend
SW = np.zeros((len(m.V), 2)); 
for sx in (1, -1):
  P, W = side_pts[sx]; kd = cKDTree(P); idx = np.where(side == sx)[0]; d, nn = kd.query(m.V[idx], k=8)
  s = 'L' if sx > 0 else 'R'
  wt = 1 / (d + 0.004); th = np.array([[W[j].get('thigh.' + s, 0) for j in row] for row in nn]); sh = np.array([[W[j].get('shin.' + s, 0) for j in row] for row in nn])
  a = (th * wt).sum(1); b = (sh * wt).sum(1); t = a + b; t[t == 0] = 1; b[(a + b) == 0] = 1
  SW[idx, 0] = a / t; SW[idx, 1] = b / t
  SW[idx, 0] = np.where(m.V[idx, 2] < KNEE - 0.06, 0, SW[idx, 0]); SW[idx, 1] = 1 - SW[idx, 0]   # foot + lower shaft: shin only (rigid)
me = bpy.data.meshes.new(f'{item}_{who}_{lod}'); me.from_pydata(m.V.tolist(), [], m.F.tolist()); me.update()
for p_ in me.polygons: p_.use_smooth = True
ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.hstack([m.C, np.ones((len(m.C), 1))]).astype(np.float32).ravel()); me.color_attributes.active_color = ca
mat = bpy.data.materials.new(item); mat.use_nodes = True; nt = mat.node_tree; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
nt.links.new(vc.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(mat)
ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob); ob.parent = arm
md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm
for s, sx in (('L', 1), ('R', -1)):
  gT = ob.vertex_groups.new(name='thigh.' + s); gS = ob.vertex_groups.new(name='shin.' + s)
  for i in np.where(side == sx)[0]:
    if SW[i, 0] > 0.001: gT.add([int(i)], float(SW[i, 0]), 'REPLACE')
    gS.add([int(i)], float(SW[i, 1]), 'REPLACE')
for o in list(bpy.data.objects):
  if o not in (ob, arm): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); arm.select_set(True)
os.makedirs(OUT, exist_ok=True); fn = f'{OUT}/{item}_{who}_{lod}.glb'
bpy.ops.export_scene.gltf(filepath=fn, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_yup=True,
                          export_vertex_color='ACTIVE', export_attributes=False, export_materials='EXPORT')
print('BUILT', item, who, lod, 'tris', len(m.F), 'verts', len(m.V), 'kb', os.path.getsize(fn) // 1024, json.dumps(dict(top=round(TOP, 4), cut=round(CUT, 4), knee=KNEE)))
