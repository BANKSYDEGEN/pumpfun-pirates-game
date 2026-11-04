# [Raul items redo] PUMPFUN PIRATES shop GOLD TEETH + EARRINGS, rebuilt (teeth + earrings 2, 2026-11-04): v5 quality, metal that reads as metal.
# blender -b -P build_teeth_ears.py -- <male|female> <hi|lo>  ->  assets/pirates/items/v5/{tooth_gold,grill_gold,grill_diamond,earring_hoop,
#   earring_double,earring_skull}_<who>_<lod>.glb : one rigid mesh each (js/pirateItems.js: rigid on 'head'), vertex colours (metal = a baked
#   environment: bright sky band on top, warm body, dark ground under + a hot glint), ink outline.
# TEETH: a grin sticker MEASURED onto the face (the painted mouth; the beards' mouth tunnel box on him): dark mouth + lip line, then each tooth
#   its own little rounded tile 1-2 mm proud of it (upper row + lower row): gold tooth = white teeth + one gold, gold grill = all gold,
#   diamond grill = platinum settings with a cut stone in each tooth.
# EARRINGS: hung from the real ear lobe; every ring point is pushed out past the hair / beard / hats / collars round it (the ring leans out
#   at the bottom instead of cutting into them), both ears.
import bpy, sys, os, math, numpy as np
sys.path.insert(0, os.environ.get('PYLIBS', '/workspace/raul_items_redo_work/py311'))
from scipy.interpolate import LinearNDInterpolator, NearestNDInterpolator
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE + '/../boots')
from bootgeo import COL, Part, finish, vnormals, smin, smax, sd_ellipsoid, mc_part, decimate
who, lod = sys.argv[-2:]; HI = lod == 'hi'
WT = os.environ.get('WT', os.path.abspath(HERE + '/../../..')); OUT = f'{WT}/assets/pirates/items/v5'
def imp(f):
  b = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f); return [o for o in bpy.data.objects if o not in b]
def verts(objs):
  for o in objs:
    if o.type == 'ARMATURE': o.data.pose_position = 'REST'
  bpy.context.view_layer.update(); return [o for o in objs if o.type == 'MESH']
bpy.ops.wm.read_factory_settings(use_empty=True)
objs = imp(f'{WT}/assets/pirates/pirate_{who}_v5_{lod}.glb'); ms = verts(objs)
body = [o for o in ms if 'body' in o.name][0]
BV = np.array([body.matrix_world @ v.co for v in body.data.vertices]); TI = np.array([a.value for a in body.data.attributes['_TINT'].data])
SKIN = BV[np.abs(TI) < 0.01]
CLR = [BV]   # clearance for the earrings: the body (hair, beard paint) + every beard / hat / outfit that can be round the ear
for n in ['beard_black', 'beard_forked', 'beard_moustache', 'hat_bandana', 'hat_bicorne', 'hat_tricorn', 'helmet_hq', 'crown', 'cloth_coat', 'cloth_suit', 'cloth_shirt', 'cloth_singlet', 'cloth_tshirt', 'cloth_tank']:
  f = f'{OUT}/{n}_{who}_hi.glb'
  if not os.path.exists(f) or (n.startswith('beard') and who == 'female'): continue
  o2 = imp(f); m2 = verts(o2); CLR += [np.array([o.matrix_world @ v.co for v in o.data.vertices]) for o in m2]
  for o in o2: bpy.data.objects.remove(o, do_unlink=True)
CLR = np.vstack(CLR); CLR = CLR[CLR[:, 0] > 0.1]   # the +x side (the ring is mirrored)
# ------------------------------------------------------------------ metal shading
def metal(N, kind, V=None):
  up = np.clip(N[:, 2], -1, 1); side = np.clip(np.abs(N[:, 0]) * 0.5 + np.clip(-N[:, 1], 0, 1) * 0.5, 0, 1)
  if kind == 'gold': lo_, mid, hi_, gl = COL('#6e4208'), COL('#e09a18'), COL('#ffe68c'), COL('#fffbe8')
  else: lo_, mid, hi_, gl = COL('#4a505c'), COL('#aeb6c4'), COL('#eef2f8'), COL('#ffffff')
  t = np.clip(up * 0.5 + 0.5, 0, 1)[:, None]; C = np.where(t < 0.5, lo_ * (1 - t * 2) + mid * (t * 2), mid * (2 - t * 2) + hi_ * (t * 2 - 1))
  g = np.clip((up - 0.55) * 4, 0, 1) * np.clip(side * 1.4, 0, 1)   # the hot glint: up + toward the viewer / side
  return C * (1 - g[:, None]) + gl * g[:, None]
def export(name, parts, ink):
  m = finish(parts, ink=ink, lowlight=not HI)
  me = bpy.data.meshes.new(name); me.from_pydata(m.V.tolist(), [], m.F.tolist()); me.update()
  for p_ in me.polygons: p_.use_smooth = True
  ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.hstack([np.clip(m.C, 0, 1), np.ones((len(m.C), 1))]).astype(np.float32).ravel()); me.color_attributes.active_color = ca
  mat = bpy.data.materials.new(name); mat.use_nodes = True; nt = mat.node_tree; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
  nt.links.new(vc.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(mat)
  ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
  for o in list(bpy.context.scene.objects): o.select_set(o is ob)
  fn = f'{OUT}/{name}.glb'
  bpy.ops.export_scene.gltf(filepath=fn, export_format='GLB', use_selection=True, export_skins=False, export_animations=False, export_yup=True, export_vertex_color='ACTIVE', export_attributes=False, export_materials='EXPORT')
  bpy.data.objects.remove(ob); print('BUILT', name, 'tris', len(m.F), 'kb', os.path.getsize(fn) // 1024)
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
# ================================================================== TEETH
if who == 'male': MX, MZ0, MZ1 = 0.064, 0.890, 0.929   # = the beards' mouth tunnel (build_beards.py): never under the moustache
else: MX, MZ0, MZ1 = 0.056, 0.953, 0.992
ZC, HH = (MZ0 + MZ1) / 2, (MZ1 - MZ0) / 2
F = SKIN[(np.abs(SKIN[:, 0]) < MX + 0.04) & (SKIN[:, 2] > MZ0 - 0.04) & (SKIN[:, 2] < MZ1 + 0.04) & (SKIN[:, 1] < -0.15)]
fi = LinearNDInterpolator(F[:, [0, 2]], F[:, 1]); fn_ = NearestNDInterpolator(F[:, [0, 2]], F[:, 1])
def face_y(x, z):
  y = fi(x, z); return np.where(np.isnan(y), fn_(x, z), y)
def face_pts(U, Vz, off):   # points on the face (front = -y) pushed `off` toward the viewer, along the local face normal (finite differences)
  off = off + (0.0 if HI else 0.0016)   # the Low face is coarse flat facets that bulge past the vertex-interpolated surface
  y = face_y(U, Vz); e = 0.002; dx = (face_y(U + e, Vz) - face_y(U - e, Vz)) / (2 * e); dz = (face_y(U, Vz + e) - face_y(U, Vz - e)) / (2 * e)
  n = np.stack([dx, -np.ones_like(dx), dz], -1); n /= np.linalg.norm(n, axis=-1, keepdims=True)
  return np.stack([U, y, Vz], -1) + n * off[..., None] if np.ndim(off) else np.stack([U, y, Vz], -1) + n * off
lip_top = lambda u: ZC + 0.42 * HH + 0.58 * HH * (1 - (u / MX) ** 2)
lip_bot = lambda u: ZC + 0.42 * HH - 1.42 * HH * np.clip(1 - (u / MX) ** 2, 0, 1) ** 0.8
def patch(u0, u1, zb, zt, off, nu, nv, bulge=0.0, round_=0.0):   # a rounded tile on the face: corners pulled in by `round_`
  s = np.linspace(0, 1, nu); t = np.linspace(0, 1, nv); S_, T_ = np.meshgrid(s, t, indexing='ij')
  U = u0 + (u1 - u0) * S_; Z = zb(U) + (zt(U) - zb(U)) * T_
  if round_: c = (np.abs(S_ - 0.5) * 2) ** 4 * (np.abs(T_ - 0.5) * 2) ** 4; U = U + (0.5 * (u0 + u1) - U) * c * round_; Z = Z + (0.5 * (zb(U) + zt(U)) - Z) * c * round_
  O = off + bulge * np.sin(np.pi * S_) * np.sin(np.pi * T_); P = face_pts(U, Z, O).reshape(-1, 3)
  Fc = []
  for i in range(nu - 1):
    for j in range(nv - 1): a = i * nv + j; Fc += [[a, a + nv, a + nv + 1], [a, a + nv + 1, a + 1]]
  Fc = np.array(Fc); nrm = np.cross(P[Fc[:, 1]] - P[Fc[:, 0]], P[Fc[:, 2]] - P[Fc[:, 0]])
  if np.mean(nrm[:, 1]) > 0: Fc = Fc[:, [0, 2, 1]]   # facing the viewer (-y)
  return P, Fc, S_.ravel(), T_.ravel()
def teeth(kind):
  parts = []; NB = (14, 6) if HI else (8, 4)
  # mouth + lip line (the backing is a touch bigger: its rim = the lip line)
  P, Fc, S_, T_ = patch(-MX * 1.07, MX * 1.07, lambda u: lip_bot(u / 1.07 * 1.0) - 0.0035, lambda u: lip_top(u / 1.07) + 0.0025, 0.0010, *NB)
  rim = (np.minimum(np.minimum(S_, 1 - S_) * 6, np.minimum(T_, 1 - T_) * 5) < 0.6)
  C = np.where(rim[:, None], COL('#3a1014'), COL('#22070a')); parts.append(Part(P, Fc, C, False))
  NU = 8; ut = np.sin(np.linspace(-1, 1, NU + 1) * 1.25) / math.sin(1.25) * MX * 0.93   # tooth edges: narrower toward the corners
  NL = 6; lt = np.sin(np.linspace(-1, 1, NL + 1) * 1.2) / math.sin(1.2) * MX * 0.62
  g = 0.0011 if HI else 0.0014; tn = (4, 4) if HI else (2, 3)
  if kind == 'diamond': tn = (5, 5) if HI else (3, 3)
  rows = [(ut, lambda u: lip_top(u) - 0.0012, lambda u: lip_top(u) - 0.56 * (lip_top(u) - lip_bot(u)), 'up'), (lt, lambda u: lip_bot(u) + 0.36 * (lip_top(u) - lip_bot(u)), lambda u: lip_bot(u) + 0.0012, 'dn')]
  for edges, ztop, zbot, rw in rows:
    for k in range(len(edges) - 1):
      u0, u1 = edges[k] + g / 2, edges[k + 1] - g / 2; w = u1 - u0
      P, Fc, S_, T_ = patch(u0, u1, zbot, ztop, 0.0022, *tn, bulge=0.0012, round_=0.55)
      N = vnormals(P, Fc); vv = T_ if rw == 'up' else 1 - T_
      gold = kind == 'grill' or (kind == 'tooth' and rw == 'up' and k == 3)   # the gold tooth: his left front tooth
      if gold:   # gold: the baked environment on a tile (top = sky, bottom = dark) + a glint stripe
        C = metal(np.stack([N[:, 0] * 0.3, N[:, 1], (vv - 0.45) * 1.6 + N[:, 2]], 1), 'gold')
      elif kind == 'diamond':   # platinum setting + a brilliant: 4 facets (light / ice / white / steel) round a hot table
        ring = (np.minimum(np.minimum(S_, 1 - S_), np.minimum(T_, 1 - T_)) < 0.2)
        q = (np.arctan2(T_ - 0.5, S_ - 0.5) / (np.pi / 2) + 4.5).astype(int) % 4
        gem = np.array([COL('#dff3ff'), COL('#8fc8f0'), COL('#ffffff'), COL('#6d8fb4')])[q]
        gem[(np.abs(S_ - 0.5) < 0.2) & (np.abs(T_ - 0.5) < 0.2)] = COL('#ffffff')
        C = np.where(ring[:, None], metal(np.stack([N[:, 0], N[:, 1], (vv - 0.4) * 1.5], 1), 'silver'), gem)
      else:   # enamel: warm white, a little grey at the gum / tip, a soft shine on top
        C = COL('#f6f1e4') * (0.86 + 0.14 * np.clip(vv * 1.4, 0, 1))[:, None]
      parts.append(Part(P, Fc, C, False))
  return parts
for item, kind in (('tooth_gold', 'tooth'), ('grill_gold', 'grill'), ('grill_diamond', 'diamond')):
  export(f'{item}_{who}_{lod}', teeth(kind), 0)
# ================================================================== EARRINGS
if not HI:   # the ear: always from the High body (the Low one has no lobe to speak of: same piercing on both LODs)
  oh = imp(f'{WT}/assets/pirates/pirate_{who}_v5_hi.glb'); bh = [o for o in verts(oh) if 'body' in o.name][0]
  V2 = np.array([bh.matrix_world @ v.co for v in bh.data.vertices]); T2 = np.array([a.value for a in bh.data.attributes['_TINT'].data]); SKIN = V2[np.abs(T2) < 0.01]
  for o in oh: bpy.data.objects.remove(o, do_unlink=True)
SE = SKIN[(SKIN[:, 0] > 0.19) & (SKIN[:, 2] > 0.9) & (SKIN[:, 2] < 1.12) & (SKIN[:, 1] > -0.2) & (SKIN[:, 1] < 0.06)]
LOBE = SE[np.argmin(SE[:, 2])].copy(); LOBE[2] += 0.004   # the piercing: just above the lowest point of the ear
def clear_x(y, z, r):   # outside of everything round (y, z) on the +x side
  m = (np.abs(CLR[:, 1] - y) < r) & (np.abs(CLR[:, 2] - z) < r); return CLR[m][:, 0].max() if m.any() else 0.0
def hang(Q, thick):   # Q: (n, 3) ring points in the (y, z) plane with x = 0 at the piercing; lean the ring out at the bottom until it clears
  x0 = max(LOBE[0] + 0.002, clear_x(LOBE[1], LOBE[2] + 0.006, 0.006) - 0.004)   # the top sits on the lobe (the ear is soft: a hair of embed)
  Q = Q[-Q[:, 2] > 0.008]   # below the piercing (the top of the ring goes through the lobe)
  need = np.array([clear_x(LOBE[1] + q[1], LOBE[2] + q[2], 0.006) + thick + 0.0025 for q in Q]); dz = -Q[:, 2]
  k = min(1.2, max(0.0, float(np.max((need - x0) / dz)))) if len(Q) else 0.0
  return k, x0
def torus(c, R, r, nu, nv, ax_u, ax_v):   # ring centred c, in the plane (ax_u, ax_v)
  V = []; ax_u, ax_v = np.array(ax_u, float), np.array(ax_v, float); n = np.cross(ax_u, ax_v)
  for i in range(nu):
    a = 2 * np.pi * i / nu; d = np.cos(a) * ax_u + np.sin(a) * ax_v
    for j in range(nv): b = 2 * np.pi * j / nv; V.append(c + d * (R + r * np.cos(b)) + n * r * np.sin(b))
  F = []
  for i in range(nu):
    for j in range(nv): a = i * nv + j; b = ((i + 1) % nu) * nv + j; c2 = ((i + 1) % nu) * nv + (j + 1) % nv; d2 = i * nv + (j + 1) % nv; F += [[a, b, c2], [a, c2, d2]]
  V = np.array(V); F = np.array(F); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); ctr = V[F].mean(1)
  # outward: away from the ring's core circle
  core = np.array([c + (np.cos(2 * np.pi * (i + 0.5) / nu) * ax_u + np.sin(2 * np.pi * (i + 0.5) / nu) * ax_v) * R for i in range(nu) for _ in range(nv * 2)])
  if np.mean(np.sum(fn * (ctr - core), 1)) < 0: F = F[:, [0, 2, 1]]
  return V, F
def ball(c, r, nu, nv):
  V, F = torus(c, 0.0001, r, nu, nv, [0, 1, 0], [0, 0, 1]); return V, F
def lean(V, k, x0):   # the piece (built at x = 0) swung out on the piercing by atan(k) (bottom outward), then moved to x0
  a = math.atan(k); ca, sa = math.cos(a), math.sin(a); V = V.copy(); x, zr = V[:, 0].copy(), V[:, 2] - LOBE[2]
  V[:, 0] = x0 + x * ca - zr * sa; V[:, 2] = LOBE[2] + x * sa + zr * ca; return V
def both(parts):   # + the mirror (her / his left ear = -x)
  out = []
  for p in parts:
    out.append(p); V2 = p.V * np.array([-1, 1, 1]); out.append(Part(V2, p.F[:, [0, 2, 1]], p.C, p.outline))
  return out
SC = 1.0 if who == 'male' else 0.94
NU, NV = (22, 7) if HI else (12, 4)
def hoop_parts(R, r, dy=0.0, dz=0.0):
  c = np.array([0, LOBE[1] + dy, LOBE[2] + dz - R]); V, F = torus(c, R, r, NU, NV, [0, 1, 0], [0, 0, 1]); return V, F
def build_hoop(defs, extra=None):
  parts = []; allQ = []
  for R, r, dy, dz in defs:
    t = np.linspace(0, 2 * np.pi, 24); allQ += [[0, dy + R * np.cos(a), dz - R + R * np.sin(a)] for a in t]
  thick = max(d[1] for d in defs); k, x0 = hang(np.array(allQ), thick)
  for R, r, dy, dz in defs:
    V, F = hoop_parts(R, r, dy, dz); V = lean(V, k, x0); V[:, 1] = V[:, 1]; parts.append(Part(V, F, metal(vnormals(V, F), 'gold'), True))
  if extra: parts += extra(k, x0)
  return parts, k, x0
ink = 0.0011 if HI else 0.0018
# gold hoops: one fat hoop
p, k, x0 = build_hoop([(0.03 * SC, 0.0052 * SC, 0, 0)]); export(f'earring_hoop_{who}_{lod}', both(p), ink); print('  hoop lean', round(k, 3), 'x0', round(x0, 3))
# double hoops: a big hoop + a small one through a second piercing just behind it, a ruby stud on top
def ruby(k, x0):
  V, F = ball(np.array([x0 + 0.002, LOBE[1] + 0.012 * SC, LOBE[2] + 0.004]), 0.0042 * SC, 10 if HI else 6, 6 if HI else 4)
  N = vnormals(V, F); C = COL('#c0101c') * (0.6 + 0.6 * np.clip(N[:, 2] * 0.5 + 0.5, 0, 1))[:, None]; C[N[:, 2] > 0.75] = COL('#ffd0d4'); return [Part(V, F, C, True)]
p, k, x0 = build_hoop([(0.028 * SC, 0.0048 * SC, -0.004 * SC, 0), (0.016 * SC, 0.0038 * SC, 0.012 * SC, 0.002)], ruby); export(f'earring_double_{who}_{lod}', both(p), ink)
# skull earring: a gold stud + a small ring + a carved bone skull charm, facing out
def skull_parts():
  s = SC * 1.55; R0 = 0.007 * s; Q = np.array([[0, R0 * np.cos(a), -R0 + R0 * np.sin(a)] for a in np.linspace(0, 2 * np.pi, 12)] + [[0, 0, -0.012 * s - 0.022 * s], [0, 0.012 * s, -0.024 * s], [0, -0.012 * s, -0.024 * s]])
  k, x0 = hang(Q, 0.011 * s); parts = []
  V, F = ball(np.array([0, LOBE[1], LOBE[2] + 0.001]), 0.004 * s, 10 if HI else 6, 6 if HI else 4); V = lean(V, k, x0); parts.append(Part(V, F, metal(vnormals(V, F), 'gold'), True))
  V, F = torus(np.array([0, LOBE[1], LOBE[2] - R0]), R0, 0.0016 * s, 14 if HI else 8, 6 if HI else 4, [0, 1, 0], [0, 0, 1]); V = lean(V, k, x0); parts.append(Part(V, F, metal(vnormals(V, F), 'gold'), True))
  # the charm (local: face toward +x), an SDF carve
  st = 0.0011 if HI else 0.0018; c0 = np.array([0.0, LOBE[1], LOBE[2] - 2 * R0 - 0.0135 * s])
  ax = [np.arange(-0.018 * s, 0.018 * s, st) for _ in range(3)]; X, Y, Z = np.meshgrid(*ax, indexing='ij')
  cran = sd_ellipsoid(X + 0.001, Y, Z - 0.003 * s, 0.0105 * s, 0.0125 * s, 0.0115 * s)
  jaw = sd_ellipsoid(X - 0.002 * s, Y, Z + 0.0085 * s, 0.007 * s, 0.0085 * s, 0.006 * s)
  f = smin(cran, jaw, 0.004 * s)
  eyes = np.minimum(sd_ellipsoid(X - 0.0105 * s, Y - 0.0048 * s, Z + 0.0005 * s, 0.004 * s, 0.0036 * s, 0.0036 * s), sd_ellipsoid(X - 0.0105 * s, Y + 0.0048 * s, Z + 0.0005 * s, 0.004 * s, 0.0036 * s, 0.0036 * s))
  nose = sd_ellipsoid(X - 0.0105 * s, Y, Z + 0.0055 * s, 0.003 * s, 0.0015 * s, 0.0022 * s)
  f = smax(f, -np.minimum(eyes, nose), 0.0012 * s)
  G = (X, Y, Z, np.array([a[0] for a in ax]), st); _, _, V, Fc = mc_part(ndimage.gaussian_filter(f, 0.5), G, 'sk', 1); V, Fc = decimate(V, Fc, 420 if HI else 130)
  # colour: bone, dark in the sockets / teeth line (how deep: the uncarved field)
  depth = (sd_ellipsoid(V[:, 0] - 0.0105 * s, np.abs(V[:, 1]) - 0.0048 * s, V[:, 2] + 0.0005 * s, 0.0052 * s, 0.0046 * s, 0.0046 * s) < 0) | (np.abs(V[:, 1]) < 0.0022 * s) & (np.abs(V[:, 2] + 0.0055 * s) < 0.0028 * s) & (V[:, 0] > 0.006 * s)
  teethline = (np.abs(V[:, 2] + 0.009 * s) < 0.0009 * s) & (V[:, 0] > 0.004 * s)
  N = vnormals(V, Fc); C = COL('#f1e8d0') * (0.72 + 0.32 * np.clip(N[:, 2] * 0.5 + 0.5, 0, 1))[:, None]; C[depth | teethline] = COL('#1c120c')
  V = V + c0; V = lean(V, k, x0); parts.append(Part(V, Fc, C, True)); return parts, k, x0
p, k, x0 = skull_parts(); export(f'earring_skull_{who}_{lod}', both(p), ink); print('  skull lean', round(k, 3), 'x0', round(x0, 3), 'lobe', LOBE.round(3))
