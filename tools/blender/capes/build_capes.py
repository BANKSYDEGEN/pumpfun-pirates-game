# [Raul items redo] PUMPFUN PIRATES shop CAPES, rebuilt (capes 2, 2026-11-04): v5 / ship quality cloth.
# blender -b -P build_capes.py -- <male|female> <hi|lo> <cape_tattered|cape_captain|cape_royal>
#   -> assets/pirates/items/v5/<item>_<who>_<lod>.glb : ONE rigid mesh (bind space; js/pirateItems.js capeFollowLegs skins it to spine + thighs),
#      vertex colours + its own ink shell (single). Captain = KEYED (magenta = your clothes colour, cyan = its fold shade).
# Fit: a polar drape round the torso, MEASURED per body / LOD from the body + every outfit GLB (cloth_*: coat tails, suit, shirt...) and
# hanging straight down from the shoulders (cumulative max), so it never cuts into the back, the hips or a coat; long hair lies OVER it
# (hair is left out of the fit). The drape stays behind the arm line (no board past the arms); a low shoulder collar wraps to the shoulder
# fronts only (never in front of the face: BANKSY's royal fur bar), tied by a cord + gold clasps under the chin.
import bpy, sys, os, math, numpy as np
sys.path.insert(0, os.environ.get('PYLIBS', '/workspace/raul_items_redo_work/py311'))
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE + '/../boots'); from bootgeo import COL, KEY1, KEY2, Part, finish, vnormals
who, lod, item = sys.argv[-3:]; HI = lod == 'hi'
WT = os.environ.get('WT', os.path.abspath(HERE + '/../../..')); OUT = f'{WT}/assets/pirates/items/v5'
bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(f):
  b = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f); return [o for o in bpy.data.objects if o not in b]
objs = imp(f'{WT}/assets/pirates/pirate_{who}_v5_{lod}.glb'); arm = [o for o in objs if o.type == 'ARMATURE'][0]; arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
body = [o for o in objs if o.type == 'MESH' and 'body' in o.name][0]
BV = np.array([body.matrix_world @ v.co for v in body.data.vertices]); TI = np.array([a.value for a in body.data.attributes['_TINT'].data])
ZSH = float((arm.matrix_world @ arm.data.bones['upperarm.L'].head_local)[2])   # shoulder joint height
SRC = [BV[np.abs(TI - 1) > 0.01]]   # body without hair (long hair lies over the cape)
for f in sorted(os.listdir(OUT)):
  if f.startswith('cloth_') and f.endswith(f'_{who}_hi.glb'):
    o2 = imp(f'{OUT}/{f}'); a2 = [o for o in o2 if o.type == 'ARMATURE']
    for a in a2: a.data.pose_position = 'REST'
    bpy.context.view_layer.update()
    for o in o2:
      if o.type == 'MESH': SRC.append(np.array([o.matrix_world @ v.co for v in o.data.vertices]))
    for o in o2: bpy.data.objects.remove(o, do_unlink=True)
P = np.vstack(SRC); P = P[(np.abs(P[:, 0]) < np.where(P[:, 2] > ZSH - 0.16, 0.185, 0.26)) & (P[:, 2] < ZSH + 0.045) & (P[:, 2] > 0.08)]   # no T-pose arms, no head
YC = -0.06
# ---- the envelope: max radius per (height, angle) round (0, YC); angle 0 = the back (+y), hung straight down from the shoulders
NB = 72; zs = np.arange(0.08, ZSH + 0.06, 0.01); RR = np.zeros((len(zs), NB))
ph = np.arctan2(P[:, 0], P[:, 1] - YC); r = np.hypot(P[:, 0], P[:, 1] - YC); bi = ((ph + math.pi) / (2 * math.pi) * NB).astype(int) % NB
for i, z in enumerate(zs):
  m = np.abs(P[:, 2] - z) < 0.012
  for b in np.unique(bi[m]): RR[i, b] = r[m & (bi == b)].max()
for i in range(len(zs)):   # empty bins: nearest neighbours round the ring
  row = RR[i]; nz = np.nonzero(row)[0]
  if len(nz) == 0: continue
  for b in np.where(row == 0)[0]: d = np.minimum(np.abs(nz - b), NB - np.abs(nz - b)); row[b] = row[nz[np.argmin(d)]]
for i in range(len(zs) - 2, -1, -1): RR[i] = np.maximum(RR[i], RR[i + 1] * (zs[i] < ZSH))   # drape: never in under what is above it (below the shoulders)
RR = ndimage.grey_dilation(RR, size=(3, 3), mode=('nearest', 'wrap')); RR = ndimage.uniform_filter(RR, size=(3, 5), mode=('nearest', 'wrap'))
def renv(phi, z):
  zi = np.clip((np.asarray(z) - zs[0]) / 0.01, 0, len(zs) - 1.001); i0 = np.floor(zi).astype(int); f = zi - i0
  t = ((np.asarray(phi) + math.pi) / (2 * math.pi) * NB - 0.5) % NB; b0 = np.floor(t).astype(int) % NB; g = t - np.floor(t); b1 = (b0 + 1) % NB
  return (RR[i0, b0] * (1 - g) + RR[i0, b1] * g) * (1 - f) + (RR[i0 + 1, b0] * (1 - g) + RR[i0 + 1, b1] * g) * f
def xyz(phi, rr, z): return np.stack([rr * np.sin(phi), YC + rr * np.cos(phi), z], -1)
# ---- styles
S = {
  'cape_tattered': dict(P0=0.88, P1=1.05, hem=0.33, curve=0.03, folds=5, A=0.020, flare=0.035, th=0.007, out='#4a423a', val='#2b2622', lin='#2e2925', edge='#6d6253', jag=1, collar=None),
  'cape_captain':  dict(P0=0.9, P1=1.08, hem=0.30, curve=0.035, folds=5, A=0.022, flare=0.04, th=0.007, out='KEY', lin='#e0ac3c', collar=dict(P=1.5, h=0.05, out='KEY', lin='#e0ac3c', bulge=0.008), clasp='#e8ad2a'),
  'cape_royal':    dict(P0=0.92, P1=1.12, hem=0.22, curve=0.03, folds=6, A=0.024, flare=0.05, th=0.008, out='#8e1b2a', val='#56101a', lin='#e3b34c', trim='#e8ad2a', collar=dict(P=1.6, h=0.07, top=0.045, drop=0.045, out='#f4f1e8', lin='#f4f1e8', bulge=0.02, spots=True), clasp='#e8ad2a'),
}[item]
KEYED = S['out'] == 'KEY'
NU, NV = (25, 16) if HI else (13, 8)
def grid(nu, nv):
  u = np.sin(np.linspace(-1, 1, nu) * math.pi / 2)   # denser at the edges (trims, side folds)
  v = np.linspace(0, 1, nv) ** 1.15; return u, v
def jag(u):   # the tattered hem: uneven torn points (deterministic)
  k = np.array([0.0, 0.05, 0.015, 0.07, 0.02, 0.06, 0.01, 0.075, 0.025, 0.05, 0.0, 0.065, 0.02])
  t = (u + 1) / 2 * (len(k) - 1); i = np.clip(np.floor(t).astype(int), 0, len(k) - 2); f = t - i; return k[i] * (1 - f) + k[i + 1] * f
def sheet(nu, nv, phifn, zfn, rfn, th):
  # outer + inner surface (grid) + rims round all 4 edges -> V, F, and per-vertex (u, v, side) for colouring
  u, v = grid(nu, nv); U, Vv = np.meshgrid(u, v, indexing='ij'); PHI = phifn(U, Vv); Z = zfn(U, Vv, PHI); R = rfn(U, Vv, PHI, Z)
  Vo = xyz(PHI, R, Z).reshape(-1, 3); Vi = xyz(PHI, R - th, Z).reshape(-1, 3); n = nu * nv; V = np.vstack([Vo, Vi])
  idx = lambda i, j, s=0: s * n + i * nv + j; F = []
  for i in range(nu - 1):
    for j in range(nv - 1):
      a, b, c, d = idx(i, j), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1); F += [[a, b, c], [a, c, d]]
      a, b, c, d = idx(i, j, 1), idx(i + 1, j, 1), idx(i + 1, j + 1, 1), idx(i, j + 1, 1); F += [[a, c, b], [a, d, c]]
  ring = [idx(i, 0) for i in range(nu)] + [idx(nu - 1, j) for j in range(1, nv)] + [idx(i, nv - 1) for i in range(nu - 2, -1, -1)] + [idx(0, j) for j in range(nv - 2, 0, -1)]
  for k in range(len(ring)):
    a, b = ring[k], ring[(k + 1) % len(ring)]; F += [[a, a + n, b + n], [a, b + n, b]]
  F = np.array(F)
  c = V[F].mean(1); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); out = np.c_[c[:, 0], c[:, 1] - YC, np.zeros(len(c))]
  if np.mean(np.sum(fn * out, 1)) < 0: F = F[:, [0, 2, 1]]   # outward
  UV = np.vstack([np.c_[U.ravel(), Vv.ravel(), np.zeros(n)], np.c_[U.ravel(), Vv.ravel(), np.ones(n)]]); return V, F, UV, PHI, Z
parts = []
# ---- the drape
P0, P1 = S['P0'], S['P1']
phifn = lambda U, Vv: U * (P0 + (P1 - P0) * Vv)
ztop = lambda phi: ZSH + 0.02 - 0.035 * (phi / 1.2) ** 2
def zfn(U, Vv, PHI):
  hem = S['hem'] + S['curve'] * U ** 2 + (jag(U) if S.get('jag') else 0)
  return ztop(PHI) + (hem - ztop(PHI)) * Vv
nf = S['folds'] if HI else max(3, S['folds'] - 2)
fold = lambda U: (0.5 + 0.5 * np.cos(nf * math.pi * U)) ** 1.4
def rfn(U, Vv, PHI, Z): return renv(PHI, Z) + 0.012 + S['flare'] * Vv ** 1.5 + (0.002 + S['A'] * Vv ** 1.1) * (fold(U) - 0.35) * (1 if HI else 0.8)
V, F, UV, PHI, Z = sheet(NU, NV, phifn, zfn, rfn, S['th'])
u, vv, side = UV[:, 0], UV[:, 1], UV[:, 2]; fv = fold(u)
if KEYED: C = np.where(((fv < 0.3) & (vv > 0.25))[:, None], np.array(KEY2, float), np.array(KEY1, float))
else:
  w = np.clip((0.55 - fv) * 1.6, 0, 1) * np.clip(vv * 1.5, 0, 1); C = COL(S['out']) * (1 - w[:, None]) + COL(S['val']) * w[:, None]
  if S.get('edge'): e = np.clip((np.abs(u) - 0.86) / 0.1, 0, 1) + np.clip((vv - 0.9) / 0.08, 0, 1); e = np.clip(e, 0, 1); C = C * (1 - e[:, None]) + COL(S['edge']) * e[:, None]
  if S.get('trim'): t = (np.abs(u) > 0.955) | (vv > 0.965); C[t] = COL(S['trim'])
C[side > 0.5] = COL(S['lin']) if not (S.get('trim') and False) else C[side > 0.5]
parts.append(Part(V, F, C, True))
# ---- the shoulder collar (captain: a folded band in the cape colour; royal: ermine with black spots), to the shoulder fronts only
cl = S.get('collar')
if cl:
  NCU, NCV = (21, 5) if HI else (11, 3)
  cphi = lambda U, Vv: U * cl['P']
  ctop = lambda phi: ZSH + cl.get('top', 0.032) - cl.get('drop', 0.02) * (phi / cl['P']) ** 2
  def czfn(U, Vv, PHI): return ctop(PHI) - cl['h'] * (1 - 0.35 * np.abs(U) ** 2) * Vv
  def crfn(U, Vv, PHI, Z): return renv(PHI, np.maximum(Z, ZSH - 0.09)) + 0.012 + S['th'] + 0.006 + cl['bulge'] * np.sin(math.pi * np.clip(Vv * 0.8 + 0.2, 0, 1)) + 0.012 * Vv
  V2, F2, UV2, PH2, Z2 = sheet(NCU, NCV, cphi, czfn, crfn, 0.016)
  if cl['out'] == 'KEY': C2 = np.where((UV2[:, 1] > 0.7)[:, None], np.array(KEY2, float), np.array(KEY1, float)); C2[UV2[:, 2] > 0.5] = COL(cl['lin'])
  else: C2 = np.tile(COL(cl['out']), (len(V2), 1)) * (0.92 + 0.08 * (1 - UV2[:, 1:2]))
  parts.append(Part(V2, F2, C2, True))
  if cl.get('spots'):   # ermine tails: little black diamonds on the fur (1.5 mm off it)
    N2 = vnormals(V2, F2); SV = []; SF = []
    for k, (a, b) in enumerate([(uu, vv_) for uu in np.linspace(-0.85, 0.85, 9 if HI else 7) for vv_ in ((0.35, 0.75) if HI else (0.55,))]):
      a = a + (0.05 if (k // 2) % 2 and HI else 0); i = int(round((a + 1) / 2 * (NCU - 1))); j = int(round(b * (NCV - 1))); c = V2[i * NCV + j]; nrm = N2[i * NCV + j]
      tz = np.array([0, 0, 1.0]); tx = np.cross(nrm, tz); tx /= np.linalg.norm(tx) + 1e-9; s0 = len(SV); c = c + nrm * 0.0025
      SV += [c + tz * 0.010, c + tx * 0.005, c - tz * 0.012, c - tx * 0.005]; SF += [[s0, s0 + 1, s0 + 2], [s0, s0 + 2, s0 + 3]]
    SV = np.array(SV); SF = np.array(SF); sc = V2[SF].mean(1) if False else None
    fn = np.cross(SV[SF[:, 1]] - SV[SF[:, 0]], SV[SF[:, 2]] - SV[SF[:, 0]]); cc = SV[SF].mean(1); o = np.c_[cc[:, 0], cc[:, 1] - YC, np.zeros(len(cc))]
    SF = np.where((np.sum(fn * o, 1) < 0)[:, None], SF[:, [0, 2, 1]], SF); parts.append(Part(SV, SF, COL('#141414'), False))
  # cord + gold clasps: from each collar end round the chest under the chin
  zc0 = float(ctop(cl['P'])) - 0.03; zc1 = ZSH - 0.10; seg = 8 if HI else 4; ring_n = 6 if HI else 4; TV = []; TF = []
  for s in (1, -1):
    ss = np.linspace(0, 1, seg + 1); ph_ = s * (cl['P'] + (math.pi - cl['P']) * ss); zz = zc0 + (zc1 - zc0) * np.sin(ss * math.pi / 2)
    pts = xyz(ph_, renv(ph_, zz) + 0.01, zz)
    for k, p in enumerate(pts):
      d = pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]; d /= np.linalg.norm(d) + 1e-9; a = np.cross(d, [0, 0, 1.0]); a /= np.linalg.norm(a) + 1e-9; b = np.cross(d, a)
      for q in range(ring_n): ang = 2 * math.pi * q / ring_n; TV.append(p + 0.0045 * (math.cos(ang) * a + math.sin(ang) * b))
    base = len(TV) - len(pts) * ring_n
    for k in range(len(pts) - 1):
      for q in range(ring_n):
        a0 = base + k * ring_n + q; a1 = base + k * ring_n + (q + 1) % ring_n; TF += [[a0, a1, a1 + ring_n], [a0, a1 + ring_n, a0 + ring_n]]
  TV = np.array(TV); TF = np.array(TF)
  # clasps: a flat gold disc at each collar end
  for s in (1, -1):
    c = xyz(np.array(s * cl['P']), renv(s * cl['P'], zc0) + 0.012 + S['th'] + 0.03, np.array(zc0)); nrm = np.array([math.sin(s * cl['P']), math.cos(s * cl['P']), 0]); a = np.cross(nrm, [0, 0, 1.0]); a /= np.linalg.norm(a); b = np.cross(nrm, a)
    m = 10 if HI else 6; c0 = len(TV); TV = np.vstack([TV, [c + nrm * 0.006], [c + 0.02 * (math.cos(2 * math.pi * q / m) * a + math.sin(2 * math.pi * q / m) * b) for q in range(m)]])
    TF = np.vstack([TF, [[c0, c0 + 1 + q, c0 + 1 + (q + 1) % m] for q in range(m)]])
  fn = np.cross(TV[TF[:, 1]] - TV[TF[:, 0]], TV[TF[:, 2]] - TV[TF[:, 0]]); cc = TV[TF].mean(1)
  parts.append(Part(TV, TF, COL(S['clasp']), False))
# ---- mesh + export
m = finish(parts, ink=(0.0035 if HI else 0.0055), lowlight=not HI)
me = bpy.data.meshes.new(f'{item}_{who}_{lod}'); me.from_pydata(m.V.tolist(), [], m.F.tolist()); me.update()
for p_ in me.polygons: p_.use_smooth = True
ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.hstack([m.C, np.ones((len(m.C), 1))]).astype(np.float32).ravel()); me.color_attributes.active_color = ca
mat = bpy.data.materials.new(item); mat.use_nodes = True; nt = mat.node_tree; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
nt.links.new(vc.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(mat)
ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob)
for o in list(bpy.data.objects):
  if o is not ob: bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True)
fn_ = f'{OUT}/{item}_{who}_{lod}.glb'
bpy.ops.export_scene.gltf(filepath=fn_, export_format='GLB', use_selection=True, export_skins=False, export_animations=False, export_yup=True, export_vertex_color='ACTIVE', export_attributes=False, export_materials='EXPORT')
print('BUILT', item, who, lod, 'tris', len(m.F), 'verts', len(m.V), 'kb', os.path.getsize(fn_) // 1024, 'zsh', round(ZSH, 3))
