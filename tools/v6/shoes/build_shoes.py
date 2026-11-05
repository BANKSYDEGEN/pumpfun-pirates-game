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
STY = {'boots_classic': 'classic', 'boots_sea': 'sea', 'shoes_buckle': 'shoe', 'sandals': 'sandal'}[item]
WT = os.environ.get('WT', '/workspace/raul-v6'); OUT = os.environ.get('OUT', HERE + '/out'); BODY = os.environ.get('BODY', HERE + '/../out_c')
STYLE = {'classic': 'cavalier', 'sea': 'buckle', 'shoe': 'buckle', 'sandal': 'buckle'}[STY]   # base recipe the V6 style starts from
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(f):
  before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f); return [o for o in bpy.data.objects if o not in before]
objs = imp(f'{BODY}/pirate_{who}_v6_{lod}.glb') + imp(f'{WT}/assets/pirates/items/v5/cloth_base_{who}_{lod}.glb')   # [V6 store] the conformed V6 body's legs + the legacy pants
arms = [o for o in objs if o.type == 'ARMATURE']; arm = arms[0]
for a in arms: a.data.pose_position = 'REST'
bpy.context.view_layer.update()
# every leg vert of the body + base outfit: position (world, Blender Z-up) + thigh / shin weights per side
PTS = []; WTS = []; ISC = []
for o in objs:
  if o.type != 'MESH' or not (o.name.startswith('pirate_') or o.name.startswith('cloth_base')): continue
  gn = {g.index: g.name for g in o.vertex_groups}; mw = o.matrix_world
  for v in o.data.vertices:
    p = mw @ v.co
    if p.z > 0.34: continue
    w = {gn[g.group]: g.weight for g in v.groups if gn.get(g.group, '').split('.')[0] in ('thigh', 'shin')}
    PTS.append((p.x, p.y, p.z)); WTS.append(w); ISC.append(o.name.startswith('cloth_base'))
PTS = np.array(PTS)
KNEE = float((arm.matrix_world @ arm.data.bones['shin.L'].head_local).z)   # male 0.214, female 0.224
# per-style dimensions (metres, bind space; the chibi foot is ~0.17 wide x 0.25 long)
# [Raul items redo 2] tops sit just under the knee and flare over the baggy pant hem (tucked-in read), never past the knee
S0 = {'buckle': dict(top=KNEE - 0.020, lth=COL('#86482a'), dk=COL('#4a2716')),   # [boots 3] BANKSY 4:02 PM 'make the boots nicer': richer toon leather
     'cavalier': dict(top=KNEE - 0.024, lth=COL('#2f2629'), dk=COL('#151012')),
     'gold': dict(top=KNEE - 0.022, lth=COL('#28222a'), dk=COL('#110d10'))}[STYLE]
# [V6 store] the Clothing Store shoes: classic riding boot (warm brown, tan turn-down cuff), sea boot (tall tarred black-green, wide
# strap + iron buckle, thick sole), low buckle shoe (polished dark brown, big brass buckle, block heel), sandal (wooden sole, leather straps)
S = {'classic': dict(top=KNEE - 0.020, lth=COL('#7b4423'), dk=COL('#3d200f')),
     'sea': dict(top=KNEE - 0.016, lth=COL('#26332c'), dk=COL('#121a16')),
     'shoe': dict(top=0.104, lth=COL('#3b2317'), dk=COL('#1c100a')),
     'sandal': dict(top=0.080, lth=COL('#6b3a1e'), dk=COL('#3a1f10'))}[STY]
_k = ~np.array(ISC); PTS = PTS[_k]; WTS = [w for w, k in zip(WTS, _k) if k]   # [V6 store] fitted to the bare V6 leg (pants above the cut blouse over the top)
TOP = S['top']; CUT = {'classic': TOP - 0.024, 'sea': TOP - 0.024, 'shoe': 0.092, 'sandal': 0.010}[STY]   # [v6 shoes T] shoe hides the foot to 1.2 cm under its top (no ankle skin through the upper)
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
  if STY == 'sea':   # [Raul items redo 2] tuck: the top opens out to the pant hem's bell just above it, so the hem reads tucked into the boot
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
  # ---- [boots 4] BANKSY "make them look like real shoes not Mickey Mouse feet": a lasted shoe, not a bulb. The body + base outfit
  # below BOOT_CUT are hidden under the boot, so under the cut the boot no longer has to swallow the chibi foot: slim tapered toe,
  # arch + instep, stacked heel, the shaft narrows to the ankle and fits the calf; above the cut it still wraps the leg / pant hem.
  bfx = abs(fx1 - fx0) / 2; fcx = (fx0 + fx1) / 2
  toe = fy0 - (0.030 if STY != 'sandal' else 0.022); heel = fy1 + 0.004; Lf = heel - toe   # [v6 shoes T] longer lasted toe
  HH = {'classic': 0.040, 'sea': 0.030, 'shoe': 0.032, 'sandal': 0.016}[STY]   # stacked heel height
  T = np.clip((heel - Y) / Lf, -0.05, 1.05)                                       # 0 heel .. 1 toe tip
  # [v6 shoes polish3] kill leftover Mickey toes: sharper tip + mid-forefoot taper on classic/sea/buckle; sandals keep a bit more sole width
  if STY == 'shoe':
    _w = [0.32, 0.40, 0.43, 0.44, 0.48, 0.36, 0.18, 0.06, 0.022]
  elif STY == 'sandal':
    _w = [0.34, 0.42, 0.45, 0.46, 0.52, 0.42, 0.26, 0.10, 0.040]
  elif STY == 'sea':
    _w = [0.34, 0.42, 0.45, 0.46, 0.51, 0.42, 0.24, 0.09, 0.032]
  else:
    _w = [0.34, 0.42, 0.45, 0.46, 0.50, 0.40, 0.22, 0.08, 0.028]
  W = bfx * np.interp(T, [-0.05, 0.0, 0.15, 0.45, 0.66, 0.82, 0.93, 1.0, 1.05], _w)
  ZB = np.interp(T, [0.0, 0.24, 0.55, 0.9, 1.0], [HH, HH, 0.013, 0.013, 0.022])   # the upper's underside = the sole's top (toe spring)
  _zt = [0.056, 0.084, 0.102, 0.090, 0.060, 0.042, 0.032, 0.024, 0.020] if STY == 'sea' else [0.056, 0.084, 0.102, 0.090, 0.060, 0.042, 0.030, 0.022, 0.018]
  ZT = np.interp(T, [-0.05, 0.0, 0.2, 0.42, 0.62, 0.8, 0.92, 1.0, 1.05], _zt)   # [v6 shoes polish3] flatter lasted tip; sea slightly less ski
  zc = (ZB + ZT) / 2; hz = np.maximum((ZT - ZB) / 2, 0.006)
  q = (np.abs(X - fcx) / W) ** 2.9 + (np.abs(Z - zc) / hz) ** 2.5   # [v6 shoes polish3] harder last (less round Mickey tip)
  d_foot = (q ** (1 / 2.7) - 1) * np.minimum(W, hz)
  d_foot = np.maximum(d_foot, np.maximum(Y - heel, toe - Y))
  fhx = bfx * 0.64   # the ball half width (straps / caps below)
  # shaft: the leg envelope, kept above the cut (wraps the leg + pant hem), narrowing to a slim ankle below it, a fitted calf between
  ms = 0.011 if STYLE != 'cavalier' else 0.013
  # [v6 shoes polish3] female classic: fuller mid-calf (cuff wrap) + slightly tighter ankle; sea/male keep polish2-ish fit
  if STY in ('classic', 'sea'):
    kz = np.interp(zs, [0.05, 0.095, CUT - 0.035, CUT - 0.005],
                   ([0.54, 0.78, 1.00, 1.0] if (F and STY == 'classic') else
                    [0.52, 0.58, 0.90, 1.0] if F else
                    [0.48, 0.52, 0.86, 1.0]))[:, None]
  else:
    kz = np.interp(zs, [0.05, TOP], [0.66, 1.0])[:, None]   # [v6 shoes polish3] shoe/sandal ankle a bit tighter (less gap at collar)
  flare = (0.005 if (STY == 'classic' and F) else 0.006 if STY == 'classic' else 0.004)
  RRs = RR * kz; d_shaft = sd_polar(X, Y, Z, zs, cen, RRs, ms * (np.interp(Z, [0.05, CUT - 0.01], [0.2, 1.0]) if STY in ('classic', 'sea') else 0.7), 0.05, TOP, flare=flare)
  up = smin(d_foot, d_shaft, 0.016)   # [v6 shoes polish3] less soft-union blob at toe/ankle join
  # catch-all only above the cut (below it the leg is hidden): anything of the leg there the shaft misses gets covered
  Pk = Pl[Pl[:, 2] > CUT - 0.006]
  if len(Pk):
    kd = cKDTree(Pk); dd, _ = kd.query(np.c_[X.ravel(), Y.ravel(), Z.ravel()], distance_upper_bound=0.05); dd = np.minimum(dd, 0.05).reshape(X.shape)
    up = np.minimum(up, np.maximum(dd - 0.010, CUT - 0.012 - Z))
  up = np.maximum(up, Z - TOP)                 # flat top (the pants cover it / the cuff sits on it)
  up = np.maximum(up, ZB - 0.002 - Z)          # the sole takes the bottom (follows the heel / arch)
  up = ndimage.gaussian_filter(up, 1.0 if HI else 0.8)
  G = (X, Y, Z, lo, STEP)
  INNER = 0.015   # the inner wall stays this far off the centre line (the other leg: no touching / crossing on walk, swim, emotes)
  up = smax(up, INNER - sx * X, 0.008)
  # sole: welt 4 mm proud of the upper's footprint; stacked heel block at the back, an arch gap, forefoot sole with toe spring
  ZS0 = np.interp(T, [0.0, 0.225, 0.255, 0.4, 0.56, 0.92, 1.0], [0.0, 0.0, 0.026, 0.017, 0.0, 0.0, 0.009])
  if STY == 'sea': ZS0 = np.interp(T, [0.0, 0.25, 0.28, 0.45, 0.6, 0.92, 1.0], [0.0, 0.0, 0.014, 0.010, 0.0, 0.0, 0.008])   # flatter, chunkier deck sole
  if STY == 'sandal': ZS0 = np.interp(T, [0.0, 0.9, 1.0], [0.0, 0.0, 0.004]); ZB = np.interp(T, [-0.05, 0.0, 0.3, 1.0, 1.05], [0.017, 0.017, 0.015, 0.012, 0.012])   # a flat wooden footbed
  d2 = np.maximum((np.abs(X - fcx) - (W * 1.05 + 0.004)), np.maximum(Y - heel - 0.003, toe - 0.004 - Y))
  d_sole = np.maximum(d2, np.maximum(ZS0 - Z, Z - (ZB + 0.003)))
  d_sole = ndimage.gaussian_filter(d_sole, 0.8)
  d_sole = smax(d_sole, INNER - sx * X, 0.006)
  FOOT[sx] = (fcx, toe, heel)
  parts.append(mc_part(d_sole, G, 'sole', sx))
  if STY != 'sandal': parts.append(mc_part(up, G, 'upper', sx))
  ring_c = cen[-1]; ring_R = RR[-1]
  def shell(region, out=0.006, inn=0.0015, k=0.004, blur=None):   # a band / cap laid on the upper (`out` proud; its inside fills into the boot, never seen): smooth edges at any LOD
    return ndimage.gaussian_filter(smax(up - out, region, k), blur if blur is not None else (0.9 if HI else 0.7))
  if STY == 'classic':
    # riding boot: a turned-down tan cuff (short, even), a back pull strap, the welt stitching / toe-cap seam painted below
    # [v6 shoes polish3] cuff rides the (widened) shaft at mid-calf with a thinner turn-down — kills the floating ring + calf gap
    c0 = TOP - (0.056 if F else 0.044); ct = TOP + (0.002 if F else 0.008)
    zi = int(np.clip(np.searchsorted(zs, (c0 + ct) / 2), 0, len(zs) - 1))
    cuff_c = cen[zi]; cuff_R = RRs[zi]   # shaft radius (not raw knee/leg) so the cuff wraps under the calf
    if F:
      # thinner rolled lip hugging shaft — wrap under calf, not a floating ring
      prof = [(0.0002, ct - 0.004), (0.0012, ct + 0.0003), (0.0024, ct + 0.0008), (0.0034, ct - 0.003), (0.0038, ct - 0.011), (0.0036, c0 + 0.003), (0.0026, c0 - 0.0005), (0.0014, c0), (0.0006, ct - 0.012)]
      cuff_base = 0.0008
      inner = lambda th: 0.90 + 0.10 * min(1.0, max(0.0, math.cos(th) * sx + 0.15))
    else:
      prof = [(0.0008, ct - 0.007), (0.0024, ct + 0.0004), (0.0044, ct + 0.0014), (0.0060, ct - 0.002), (0.0070, ct - 0.011), (0.0072, c0 + 0.002), (0.0060, c0 - 0.001), (0.0036, c0), (0.0018, ct - 0.014)]
      cuff_base = ms + 0.001
      inner = lambda th: 0.65 + 0.35 * min(1.0, max(0.0, math.cos(th) * sx + 0.30))
    parts.append(('cuff', sx) + sweep(cuff_c, cuff_R, cuff_base, prof, NTH + 4 if HI else NTH, 1, amp=inner))
    zb = 0.070 + 0.20 * np.clip(Y - (toe + 0.15), -0.2, 0.2)   # ankle strap with a small brass buckle on the outside
    parts.append(mc_part(shell(np.abs(Z - zb) - 0.008, 0.0065), G, 'strap', sx))
    yy = toe + 0.17; bz = 0.070 + 0.20 * (yy - (toe + 0.15)); row = up[:, int(round((yy - lo[1]) / STEP)), int(round((bz - lo[2]) / STEP))]; ins = np.where(row < 0)[0]
    if len(ins):
      xs_ = lo[0] + STEP * (ins[-1] if sx > 0 else ins[0]); bp = np.array([xs_, yy, bz]); bn = np.array([sx, 0.0, 0.0])
      parts.append(mc_part(sd_buckle_on(X, Y, Z, bp + bn * 0.004, bn, 0.024, 0.020, 0.006, 0.0055), G, 'gold', sx))
  elif STY == 'sea':
    # tall tarred sea boot: rolled rim, a wide strap round the upper shaft with an iron buckle at the front, a lower ankle strap
    rr_ = 0.0085; prof = [(rr_ * math.cos(a), TOP - 0.004 + rr_ * 0.85 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 6 if HI else 4, endpoint=False)]
    parts.append(('rim', sx) + sweep(ring_c, ring_R, ms + 0.004 + 0.002, prof, NTH * 3 // 4, 1))
    zs1 = TOP - 0.055
    parts.append(mc_part(shell(np.abs(Z - zs1) - 0.011, 0.0065), G, 'strap', sx))
    bp, bn = on_surface(up, G, fcx, zs1, front=True)
    parts.append(mc_part(sd_buckle_on(X, Y, Z, bp + bn * 0.004, bn, 0.036, 0.030, 0.0075, 0.007), G, 'silver', sx))
    zb = 0.074 + 0.22 * np.clip(Y - (toe + 0.14), -0.2, 0.2)
    parts.append(mc_part(shell(np.abs(Z - zb) - 0.008, 0.006), G, 'strap', sx))
  elif STY == 'shoe':
    # low buckle shoe: a raised tongue over the instep, a big square brass buckle on the vamp, a rolled collar round the ankle
    rr_ = 0.006; prof = [(rr_ * math.cos(a), TOP - 0.003 + rr_ * 0.8 * math.sin(a)) for a in np.linspace(0, 2 * math.pi, 6 if HI else 4, endpoint=False)]
    parts.append(('rim', sx) + sweep(ring_c, ring_R, ms + 0.003 + 0.002, prof, NTH * 3 // 4, 1))
    tongue = np.maximum(np.maximum(np.abs(X - fcx) - fhx * 0.55, np.abs(Y - (toe + 0.12)) - 0.045), np.maximum(TOP - 0.030 - Z, Z - (TOP + 0.022)))
    parts.append(mc_part(shell(tongue, 0.0045), G, 'tongue', sx))
    bp, bn = on_surface(up, G, fcx, 0.060, front=True)
    parts.append(mc_part(sd_buckle_on(X, Y, Z, bp + bn * 0.004, bn, 0.050, 0.038, 0.0085, 0.009), G, 'gold', sx))
  else:
    # sandal: leather straps laid on the bare foot (toe strap, T-strap, ankle strap) + a small buckle at the ankle
    # straps swept round the real foot: per strap a plane slice of the bare foot / ankle, its polar outline (24 bins, max, smoothed),
    # a rounded leather band 2 mm proud of it (two cross straps over the toes / instep + an ankle strap with a small brass buckle)
    Pf = side_pts[sx][0]
    def band(c, u, v, nb, Q, w, nth):
      d = Q - c; a = d @ u; bb = d @ v; th = (np.arctan2(bb, a) % (2 * math.pi)) / (2 * math.pi) * 24; r = np.hypot(a, bb); R = np.zeros(24)
      for k in range(24):
        m = (th >= k) & (th < k + 1); R[k] = r[m].max() if m.any() else 0
      g = R > 0; R = np.interp(np.arange(24), np.where(g)[0], R[g], period=24)
      R = np.maximum(R, np.convolve(np.r_[R[-2:], R, R[:2]], np.ones(5) / 5, 'valid')); R = np.convolve(np.r_[R[-1:], R, R[:1]], [0.25, 0.5, 0.25], 'valid')
      prof = [(-0.0045, -w / 2), (0.0015, -w / 2), (0.003, 0.0), (0.0015, w / 2), (-0.0045, w / 2)]
      Vl, Fl = sweep(np.zeros(2), R, 0.0032, prof, nth, 1)
      return c + Vl[:, :1] * u + Vl[:, 1:2] * v + Vl[:, 2:3] * nb, Fl, R
    ex, ey, ez = np.eye(3)
    for tt, w in ((0.70, 0.016), (0.44, 0.013)):
      y0 = heel - tt * Lf; Q = Pf[(np.abs(Pf[:, 1] - y0) < 0.007) & (Pf[:, 2] > 0.004) & (Pf[:, 2] < 0.074)]
      if len(Q) < 12: continue
      c = np.array([(Q[:, 0].min() + Q[:, 0].max()) / 2, y0, max(0.014, (Q[:, 2].min() + Q[:, 2].max()) / 2)])
      V_, F_, _ = band(c, ex, ez, ey, Q, w, NTH)
      V_[:, 2] = np.maximum(V_[:, 2], 0.004)   # the ring's underside flattens into the footbed (nothing under the floor)
      parts.append(('strap', sx, V_, F_))
    za = 0.078 if F else 0.084; Q = Pf[np.abs(Pf[:, 2] - za) < 0.007]   # [v6 shoes polish3] ankle strap a hair lower / tighter on the ankle
    c = np.array([(Q[:, 0].min() + Q[:, 0].max()) / 2, (Q[:, 1].min() + Q[:, 1].max()) / 2, za])
    V_, F_, R = band(c, ex, ey, ez, Q, 0.011, NTH); parts.append(('strap', sx, V_, F_))
    k = 0 if sx > 0 else 12; ro = R[k] + 0.0045; bp = c + np.array([sx * ro, 0, 0]); bn = np.array([sx, 0.0, 0.0])
    parts.append(mc_part(sd_buckle_on(X, Y, Z, bp, bn, 0.018, 0.015, 0.0045, 0.0045), G, 'gold', sx))
# ---- decimate each part to the LOD budget, colour it, skin it
BUD = {'tongue': 300, 'upper': 1300 if STY == 'shoe' else 1500, 'sole': 420, 'rim': 160, 'strap': 180, 'cuff': 300, 'gold': 150, 'goldtoe': 75, 'silver': 120} if HI else \
      {'tongue': 60, 'upper': 300 if STY == 'shoe' else 330, 'sole': 90, 'rim': 50, 'strap': 50, 'cuff': 90, 'gold': 44, 'goldtoe': 64, 'silver': 36}
mesh_parts = []
for kind, sx, V, Fc in parts:
  if len(V): V = V.copy(); V[:, 0] = sx * np.maximum(sx * V[:, 0], 0.0152 + 0.004 * np.clip((sx * V[:, 0] - 0.0145) / 0.02, 0, 1) * 0)
  if len(Fc) == 0: continue
  if kind in ('rim', 'cuff') or (kind == 'strap' and STY == 'sandal'): mesh_parts.append((kind, sx, V, Fc)); continue   # swept: already at the LOD's ring count
  n = BUD[kind] * (2.2 if (kind == 'strap' and STY == 'sandal') else 1)
  V, Fc = decimate(V, Fc, int(n))
  mesh_parts.append((kind, sx, V, Fc))
COLS = dict(tongue=S['lth'], upper=S['lth'], sole=COL('#a8743f') if STY == 'sandal' else COL('#2b1a12'), rim=S['dk'], strap={'classic': COL('#4a2716'), 'sea': COL('#16100c'), 'shoe': COL('#1c100a'), 'sandal': S['lth']}[STY],
            cuff=COL('#b7814a'), gold=COL('#e8ad2a'), goldtoe=COL('#e8ad2a'), silver=COL('#c9ced8'))
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
      if STY == 'sandal': C = C * (1 + 0.07 * np.sin(V[:, 0] * 700 + 9 * np.sin(V[:, 1] * 60)))[:, None]   # wood grain
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
