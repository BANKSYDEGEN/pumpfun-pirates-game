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
  RR = ndimage.grey_dilation(RR, size=(1, 2), mode='wrap'); RR = ndimage.uniform_filter(RR, size=(3, 5), mode=('nearest', 'wrap'))
  cen = np.tile([0.0, H[1]], (len(zs), 1)); rho, R, _ = _polar(X, Y, Z, zs, cen, RR)
  th = np.arctan2(X, -(Y - H[1])); tw = th * 8 + (Z - 0.8) * 20   # sculpted clumps: vertical lock ridges that twist a little down the beard
  top = np.clip((EZ0 - 0.012 - Z) / 0.045, 0, 1); R = R - margin * (1 - top) ** 2 + (0.004 if HI else 0.002) * top * (0.5 + 0.5 * np.cos(tw)) ** 2
  return np.maximum(smax(np.where(R > 0.02, rho - R, 0.05), np.abs(X) - 0.25, 0.01), np.maximum(zs[0] - Z, Z - (EZ0 - 0.012))).astype(np.float32)
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
# ================= beards 2 (BANKSY 11:54 AM "And the beards are rough"): v5-style thick POINTED CLUMPS (as the v5 ref's honey beard),
# flattened wedge locks hung round the jaw line from ear to ear on top of the smooth painted-beard shell, a bushy drooping moustache,
# smooth unions + a wider blur, so the silhouette is a clean scalloped spade with no lumps, gaps or blocky steps.
def _box(P, pad):   # grid slices round a lock (each lock is only evaluated in its own box: fast + light)
  a = np.floor((P.min(0) - pad - lo) / STEP).astype(int); b = np.ceil((P.max(0) + pad - lo) / STEP).astype(int) + 1
  a = np.clip(a, 0, np.array(X.shape)); b = np.clip(b, 0, np.array(X.shape)); return tuple(slice(a[k], b[k]) for k in range(3))
FULL = tuple(slice(0, n) for n in X.shape)
def put(name, sl, d, rec=True):
  if rec: CLUMPS.append((name, sl, d))
  return (sl, d)
def wedge(name, ctrl, r0, r1, n=9, flat=1.0, nrm=None, bulge=0.25, rec=True):
  # a hair clump: tapered + pointed bezier tube, squashed along nrm (the radial direction) by 'flat' -> a wide, thin lock
  P = bezier(ctrl, n); t = np.linspace(0, 1, n); R = r1 + (r0 - r1) * (1 - t) ** 0.85 * (1 + bulge * np.sin(math.pi * t))
  sl = _box(P, float(R.max()) + 0.012); x, y, z = X[sl], Y[sl], Z[sl]
  if nrm is not None and flat != 1.0:
    nv = np.array([nrm[0], nrm[1], 0.0]); nv /= np.linalg.norm(nv); c = P[0]
    dp = (x - c[0]) * nv[0] + (y - c[1]) * nv[1]; x = x + (flat - 1) * nv[0] * dp; y = y + (flat - 1) * nv[1] * dp
    q = (P[:, 0] - c[0]) * nv[0] + (P[:, 1] - c[1]) * nv[1]; P = P.copy(); P[:, 0] += (flat - 1) * nv[0] * q; P[:, 1] += (flat - 1) * nv[1] * q
  d = sd_tube(x, y, z, P, R) / (flat if flat > 1 else 1)
  return put(name, sl, d.astype(np.float32), rec)
def U(f, piece, k):   # smooth-union a boxed piece into the full field
  sl, d = piece; f[sl] = smin(f[sl], d, k); return f
def jaw(a, Q=None):   # per angle round the head axis: bottom + radius of the painted beard
  th_ = np.arctan2(BRD[:, 0], -(BRD[:, 1] - H[1])); m = np.abs(th_ - a) < 0.18; Q = BRD[m] if m.sum() > 3 else BRD
  return float(np.percentile(Q[:, 2], 5)), float(np.percentile(np.hypot(Q[:, 0], Q[:, 1] - H[1]), 85))
def moustache2(size, curl, off, nl, droop):   # per side nl thick tapered strands from under the nose, fanned, pointed tips (curl up / droop down)
  out = []
  for s in (1, -1):
    for k in range(nl):
      c = k - (nl - 1) / 2; dz = c * 0.010 * size; w = 1 - 0.10 * abs(c)
      xs = np.array([0.006, 0.040, 0.078, 0.110, 0.130, 0.140]) * size * w
      if droop:   # full-beard moustache: sweeps out and down over the mouth corners into the beard (v5 ref)
        zs = np.array([0.020, 0.012, 0.000, -0.016, -0.034, -0.050]) * size + mz1 + 0.006 + dz
      else:       # handlebar: curls up at the tips
        zs = np.array([0.018, 0.008, -0.004, 0.004 + 0.010 * curl, 0.020 + 0.022 * curl, 0.034 + 0.030 * curl]) * size + mz1 + 0.004 + dz * (1 - np.arange(6) / 7)
      ctrl = [[s * x, face_y(s * x * 0.92, z) - (off + 0.010 * math.sin(math.pi * min(i, 4) / 5) + 0.002 * i), z] for i, (x, z) in enumerate(zip(xs, zs))]
      out.append(wedge(f'mu{s}{k}', ctrl, (0.024 - 0.004 * abs(c)) * size, 0.0025, n=10, flat=1.0, bulge=0.35))
  return out
def surf_y(f, x, z):   # the front of the beard (first inside cell along +y) at x, z
  i = int(round((x - lo[0]) / STEP)); k = int(round((z - lo[2]) / STEP)); col = f[i, :, k]; j = np.argmax(col < 0)
  return float(gy[j]) if col[j] < 0 else face_y(x, z)
parts = []; KEYED = item != 'beard_black'
C1 = np.array(KEY1, float); C2 = np.array(KEY2, float)
GOLD = COL('#e8ad2a'); RED = COL('#c41e2a')
if item == 'beard_moustache':
  f = np.full(X.shape, 0.05, np.float32)
  for pc in moustache2(1.22, 1.0, 0.006 if HI else 0.010, 4 if HI else 3, False): f = U(f, pc, 0.009)
  rt = sd_ellipsoid(X, Y - (face_y(0, mz1 + 0.022) - 0.006), Z - (mz1 + 0.028), 0.030, 0.014, 0.016); CLUMPS.append(('root', FULL, rt)); f = smin(f, rt, 0.012)
  f = mouth_cut(f, 0.003)
  parts.append(('hair', ndimage.gaussian_filter(f, 1.0 if HI else 0.8)))
  BUD = {'hair': 1000 if HI else 280}
else:
  big = item == 'beard_black'
  base = mouth_cut(env((0.010 if not big else 0.011) + (0 if HI else 0.005))); CLUMPS.append(('base', FULL, base))
  cy = face_y(0, 0.80) - 0.02
  chin = sd_ellipsoid(X, Y - (cy - 0.008), Z - 0.80, 0.11 if not big else 0.13, 0.055, 0.065); CLUMPS.append(('chin', FULL, chin))
  f = smin(base, chin, 0.03)
  # the clump curtain: wedges round the jaw (ear to ear), lengths in a spade (long at the chin), pointed tips; small blend k keeps
  # every clump readable (deep V notches between the points) while the blur keeps the surface smooth
  N = (11 if big else 9) if HI else (9 if big else 7); angs = np.linspace(-1.45, 1.45, N); Lc, Ls = (0.20, 0.06) if big else (0.135, 0.05)
  for row in (0, 1):
    A = angs if row == 0 else (angs[:-1] + angs[1:]) / 2
    if row == 1: A = A[np.abs(A) < 1.0]
    for i, a in enumerate(A):
      zb, r = jaw(a); d = np.array([math.sin(a), -math.cos(a)]); u = abs(a) / 1.45
      L = (Ls + (Lc - Ls) * (1 - u ** 1.5)) * ((0.9 if big else 0.72) if row else 1.0); out = 0.002 + 0.022 * row + (0.004 if not HI else 0)
      root = np.array([d[0] * (r + out - 0.012), H[1] + d[1] * (r + out - 0.012), zb + 0.06 - 0.025 * row])
      tip = np.array([root[0] * (0.86 if big else 0.88), root[1] - (0.045 if big else 0.02) * (1 - u), root[2] - L])
      mid = (root + tip) / 2 + np.array([d[0] * 0.022, d[1] * 0.022 - 0.02 * (1 - u), 0.0]) * (1.3 if big else 1.0)
      w = (0.054 if big else 0.040) * (1 - 0.3 * u) * (0.85 if row else 1)
      f = U(f, wedge(f'c{row}{i}', [root, mid, tip], w * (1 if HI else 1.12), 0.0025 if HI else 0.009, flat=1.6, nrm=d, bulge=0.15), 0.007 if row == 0 else 0.006)
  # the core: a solid tapered spade behind the clumps, so the beard is FULL (no hollow pockets between the locks)
  cz0 = 0.80; cz1 = 0.67 if big else 0.74
  f = U(f, wedge('core', [[0, cy + 0.06, cz0], [0, cy + 0.035, (cz0 + cz1) / 2], [0, cy + (0.01 if big else 0.03), cz1]], 0.115 if big else 0.10, 0.03 if big else 0.045, flat=1.6, nrm=[0, -1], bulge=0.05), 0.02)
  for s in (1, -1):   # sideburns: from the temple down the cheek into the jaw clumps (no painted-beard gap at the ear)
    zb, r = jaw(s * 1.45); zt = EZ0 - 0.005
    p0 = np.array([s * (r + 0.002) * math.sin(1.56), H[1] - (r + 0.002) * math.cos(1.56), zt]); p2 = np.array([s * (r - 0.005) * math.sin(1.38), H[1] - (r - 0.005) * math.cos(1.38), zb - 0.02])
    f = U(f, wedge(f'sb{s}', [p0, (p0 + p2) / 2 + np.array([s * 0.012, 0, 0]), p2], 0.030, 0.006, flat=1.8, nrm=[s, 0], bulge=0.1), 0.012)
  gold = []
  if not big:   # the forks: two fat braids of alternating lobes under the chin, gold rings, pointed tufts
    for s in (1, -1):
      top = np.array([s * 0.045, cy - 0.012, 0.775]); bot = np.array([s * 0.080, cy - 0.032, 0.592]); n = 6
      for k in range(n):
        t = (k + 0.5) / n; c = top * (1 - t) + bot * t + np.array([s * 0.007 * (1 if k % 2 else -1), 0, 0]); rr = (0.034 - 0.013 * t) * (1 if HI else 1.25)
        d = sd_ellipsoid(X - c[0], Y - c[1], Z - c[2], rr, rr * 0.9, 0.024); CLUMPS.append((f'br{s}{k}', FULL, d)); f = smin(f, d, 0.007)
      f = U(f, wedge(f'tt{s}', [bot + np.array([0, 0, 0.01]), bot + np.array([s * 0.012, -0.004, -0.03]), bot + np.array([s * 0.006, 0, -0.062])], 0.020, 0.0025), 0.008)
      for t in (0.40, 0.92):
        c = top * (1 - t) + bot * t; gold.append(torus_sd(c, bot - top, (0.031 - 0.013 * t) * (1 if HI else 1.22), 0.0065 if HI else 0.008))
    for pc in moustache2(1.0, 0.0, 0.007, 3 if HI else 2, True): f = U(f, pc, 0.009)
  else:         # Blackbeard: long spade + wide drooping moustache + 3 thin braids with red ribbons laid ON the beard front
    for pc in moustache2(1.25, 0.0, 0.010, 3, True): f = U(f, pc, 0.010)
    for s, xo in ((1, 0.075), (-1, 0.075), (1, 0.0)):
      zt = 0.735; yt = surf_y(f, s * xo, zt) + 0.012; top = np.array([s * xo, yt, zt]); zb_ = 0.655; bot = np.array([s * (xo + 0.01), surf_y(f, s * (xo + 0.01), zb_) + 0.008, zb_])
      f = U(f, wedge(f'bb{s}{xo}', [top, (top + bot) / 2 + np.array([0, -0.006, 0]), bot + np.array([0, 0, -0.012])], 0.019, 0.004), 0.006)
      c = top * 0.25 + bot * 0.75; gold.append(torus_sd(c, bot - top, 0.015, 0.0065)); gold.append(sd_ellipsoid(X - c[0], Y - (c[1] - 0.010), Z - c[2], 0.022, 0.007, 0.011))
  f = mouth_cut(f, 0.004)
  parts.append(('hair', ndimage.gaussian_filter(f, 1.15 if HI else 1.3)))
  if gold: parts.append(('trim', ndimage.gaussian_filter(union(gold, 0.002), 0.6)))
  BUD = {'hair': (3900 if big else 3000) if HI else (850 if big else 560), 'trim': (380 if HI else 120)}
# ---- mesh, decimate, colour
def sample(sl, d, V):
  ij = np.round((V - lo) / STEP).astype(int); a = np.array([s.start for s in sl]); ij = ij - a; ok = np.all((ij >= 0) & (ij < np.array(d.shape)), 1)
  out = np.full(len(V), 0.05, np.float32); out[ok] = d[tuple(ij[ok].T)]; return out
geo_parts = []
for kind, fld in parts:
  _, _, V, Fc = mc_part(fld, G, kind, 1)
  V, Fc = decimate(V, Fc, BUD[kind])
  if kind == 'trim': C = shade('gold', V, Fc, GOLD, 1.0) if KEYED else np.tile(RED, (len(V), 1)) * (0.8 + 0.25 * np.clip(vnormals(V, Fc)[:, 2], 0, 1))[:, None]
  else:
    # grooves: where the two nearest clumps are about as close (the seams between the locks) -> the groove shade
    LK = [(sl, d) for nm, sl, d in CLUMPS if nm[:2] in ('c0', 'c1', 'mu', 'br', 'sb', 'tt', 'bb')] or [(sl, d) for _, sl, d in CLUMPS]   # seams between the LOCKS (the shell / chin / core don't make seams)
    D = np.sort(np.array([sample(sl, d, V) for sl, d in LK]), axis=0); groove = ((D[1] - D[0]) < (0.005 if HI else 0.007)) & (D[0] < 0.03) & (D[0] > -0.03)
    N = vnormals(V, Fc); crest = np.clip(N[:, 2] * 0.5 - N[:, 1] * 0.6, 0, 1) * (1 - groove)
    if KEYED: C = np.where(groove[:, None], C2, C1)
    else:
      dk, mid, cr = COL('#0b0b10'), COL('#26252f'), COL('#62708f')
      if not HI:   # [Raul items redo] BANKSY via Emerly: on the phone the Blackbeard read as a BLUE MASK. The blue-grey crest (#62708f, up to 60 %) lands on
        # every front-facing vertex, and the phone file has few locks / grooves (smoother field) + MeshBasic (no toon dark band, light baked to
        # ~1.08) -> one flat slate-blue sheet. Phone: near-black base, a faint cool crest only on the tops, and strand streaks down the locks.
        dk, mid, cr = COL('#050506'), COL('#17161a'), COL('#3b4150')
        crest = np.clip(N[:, 2] * 0.8 - N[:, 1] * 0.2, 0, 1) * (1 - groove)
      t = (0.2 + 0.8 * crest)[:, None] * (1 + 0.1 * noise(V)[:, None]); C = np.where(groove[:, None], dk, mid * (1 - t * 0.6) + cr * t * 0.6)
      if not HI: C = C * (0.62 + 0.38 * (0.5 + 0.5 * np.sin(V[:, 0] * 260 + np.sin(V[:, 2] * 90) * 1.6)))[:, None]   # strands (vertical streaks)
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
