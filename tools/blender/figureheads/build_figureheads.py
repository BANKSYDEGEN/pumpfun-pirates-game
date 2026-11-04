# [Raul items redo] PUMPFUN PIRATES shop FIGUREHEADS, rebuilt (figureheads 2, 2026-11-04): carved, toon-shaded, ship-kit quality.
# blender -b -P build_figureheads.py -- <hi|lo>   ->  assets/ships/gear/figureheads_<lod>.glb  (meshes fig_mermaid / fig_kraken / fig_lion)
# Frame (three.js, the frame js/shipGear.js seats): x = starboard, y = up, z = forward (bow); z = 0 is the BACK of the figure (its mount plane,
# pressed onto the stem at run time), a mount block runs back to z -0.25 (inside the stem: never a gap on a raked or curved bow). ~1.9 tall.
# SDF sculpt (bootgeo smin / tubes / ellipsoids) -> marching cubes -> decimate; colour per part (nearest SDF) x a baked AO from the field;
# one inverted-hull ink shell (like the pirates); eyes / gems / teeth as small separate pieces.
import bpy, sys, os, math, numpy as np
sys.path.insert(0, os.environ.get('PYLIBS', '/workspace/raul_items_redo_work/py311'))
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE + '/../boots')
from bootgeo import COL, Part, finish, smin, smax, sd_ellipsoid, sd_tube, bezier, mc_part, decimate, vnormals, noise
lod = sys.argv[-1]; HI = lod == 'hi'
WT = os.environ.get('WT', os.path.abspath(HERE + '/../../..')); OUT = f'{WT}/assets/ships/gear'; os.makedirs(OUT, exist_ok=True)
STEP = 0.016 if HI else 0.03; BUD = 1900 if HI else 560
lo_, hi_ = np.array([-0.56, -0.5, -0.3]), np.array([0.56, 1.72, 0.8])
gx, gy, gz = [np.arange(lo_[k], hi_[k], STEP, dtype=np.float32) for k in range(3)]; X, Y, Z = np.meshgrid(gx, gy, gz, indexing='ij'); G = (X, Y, Z, lo_, STEP)
def rot(x, y, z, c, ax, a):   # coords about centre c, rotated by -a about axis ax (so the shape turns by +a)
  x, y, z = x - c[0], y - c[1], z - c[2]; ca, sa = math.cos(a), math.sin(a)
  if ax == 'x': return x, y * ca + z * sa, -y * sa + z * ca
  if ax == 'z': return x * ca + y * sa, -x * sa + y * ca, z
  return x * ca - z * sa, y, x * sa + z * ca
def ell(c, r, ax='x', a=0.0, P=None):
  x, y, z = P if P is not None else (X, Y, Z); x, y, z = rot(x, y, z, c, ax, a); return sd_ellipsoid(x, y, z, *r)
def tube(pts, r0, r1, n=10, P=None):
  x, y, z = P if P is not None else (X, Y, Z); B = bezier(pts, n); return sd_tube(x, y, z, B, np.linspace(r0, r1, len(B)))
def mirror(f):   # both sides: f(sx) for sx in (1, -1)
  return np.minimum(f(1), f(-1))
# ------------------------------------------------------------------ the three figures: list of (name, sdf, colour, k)
def mermaid():
  SK, HR, HD, TL, TD, GD = '#f4c9a0', '#d42a2a', '#8e1414', '#25b39a', '#147062', '#f2c230'
  P = []
  P.append(('tail', tube([(0, 0.62, 0.15), (0, 0.32, 0.14), (0, 0.06, 0.02), (0, -0.2, 0.04), (0, -0.33, 0.2)], 0.165, 0.05, 14), TL, 0.05))
  P.append(('fluke', mirror(lambda s: ell((s * 0.1, -0.36, 0.27), (0.14, 0.032, 0.085), 'z', s * 0.45)), TD, 0.03))
  P.append(('hips', ell((0, 0.64, 0.14), (0.165, 0.13, 0.135)), TL, 0.06))
  P.append(('torso', ell((0, 0.87, 0.17), (0.15, 0.19, 0.12), 'x', 0.2), SK, 0.05))
  P.append(('shell', mirror(lambda s: ell((s * 0.066, 0.9, 0.265), (0.062, 0.056, 0.035), 'y', s * 0.35)), GD, 0.01))
  P.append(('arm', mirror(lambda s: tube([(s * 0.14, 0.99, 0.15), (s * 0.22, 0.87, 0.1), (s * 0.21, 0.72, -0.02)], 0.047, 0.036)), SK, 0.03))
  P.append(('neck', tube([(0, 0.98, 0.16), (0, 1.1, 0.2)], 0.055, 0.055, 3), SK, 0.04))
  P.append(('head', ell((0, 1.28, 0.24), (0.22, 0.21, 0.2)), SK, 0.04))
  cap = smax(ell((0, 1.32, 0.19), (0.245, 0.24, 0.235)), -ell((0, 1.21, 0.43), (0.2, 0.17, 0.2)), 0.03)
  locks = np.minimum.reduce([tube([(x, 1.42, 0.12), (x * 1.25, 1.12, -0.02), (x * 1.45 + 0.03 * math.sin(9 * x), 0.82, -0.06), (x * 1.3, 0.55, -0.16)], 0.08, 0.045, 10) for x in (-0.15, -0.075, 0, 0.075, 0.15)])
  side = mirror(lambda s: tube([(s * 0.17, 1.27, 0.22), (s * 0.19, 1.05, 0.25), (s * 0.15, 0.9, 0.29), (s * 0.1, 0.78, 0.27)], 0.06, 0.028, 10))
  fringe = tube([(-0.18, 1.38, 0.3), (-0.06, 1.47, 0.38), (0.08, 1.45, 0.38), (0.19, 1.36, 0.3)], 0.05, 0.04, 8)
  P.append(('hair', smin(smin(smin(cap, locks, 0.05), side, 0.03), fringe, 0.03), HR, 0.03))
  arc = [(0.17 * math.cos(a), 1.47 + 0.03 * math.sin(a), 0.2 + 0.14 * math.sin(a)) for a in np.linspace(0.25, math.pi - 0.25, 7)]
  P.append(('tiara', sd_tube(X, Y, Z, np.array(arc), np.full(7, 0.02)), GD, 0.01))
  P.append(('mount', ell((0, 0.55, -0.12), (0.13, 0.6, 0.14)), TD, 0.06))
  D = [('eye', [(s * 0.083, 1.25, 0.415) for s in (1, -1)], (0.042, 0.055, 0.022), '#1c1a2a'), ('eyehi', [(s * 0.07, 1.275, 0.434) for s in (1, -1)], (0.013, 0.013, 0.008), '#ffffff'),
       ('mouth', [(0, 1.155, 0.405)], (0.03, 0.011, 0.012), '#b0303a'), ('gem', [(0, 1.5, 0.345)], (0.03, 0.036, 0.02), '#e0306a')]
  def colfix(name, V, C):   # tail scales, blush, hair streaks
    if name == 'tail': b = (np.floor(V[:, 1] * 16 + 0.5 * np.floor(V[:, 0] * 16)) % 2)[:, None]; C = C * (1 - 0.14 * b)
    if name == 'head': d = np.minimum(np.linalg.norm(V - [0.135, 1.19, 0.39], axis=1), np.linalg.norm(V - [-0.135, 1.19, 0.39], axis=1)); w = 0.45 * np.clip((0.045 - d) / 0.025, 0, 1)[:, None]; C = C * (1 - w) + COL('#f08a8a') * w
    if name == 'hair': w = np.clip(0.5 + 0.5 * np.sin(V[:, 0] * 60 + V[:, 1] * 6), 0, 1)[:, None] * 0.35; C = C * (1 - w) + COL(HD) * w
    return C
  return P, D, colfix
def kraken():
  K, KD, KL, SU, EY, PU = '#7d3fb5', '#4c2277', '#a872dc', '#f2c4d6', '#ffcc33', '#141018'
  P = []
  P.append(('mantle', smin(ell((0, 1.22, 0.16), (0.27, 0.37, 0.25), 'x', -0.3), ell((0, 0.9, 0.24), (0.27, 0.21, 0.22)), 0.08), K, 0.06))
  P.append(('brow', mirror(lambda s: tube([(s * 0.05, 1.03, 0.43), (s * 0.15, 1.04, 0.44), (s * 0.23, 0.98, 0.38)], 0.032, 0.025, 6)), KD, 0.03))
  T = []
  for s in (1, -1):
    T.append([(s * 0.08, 0.74, 0.3), (s * 0.14, 0.45, 0.44), (s * 0.1, 0.2, 0.42), (s * 0.04, 0.1, 0.52), (s * 0.08, 0.18, 0.6), (s * 0.14, 0.13, 0.56)])
    T.append([(s * 0.2, 0.74, 0.2), (s * 0.34, 0.5, 0.22), (s * 0.37, 0.24, 0.14), (s * 0.31, 0.03, 0.2), (s * 0.27, 0.08, 0.3), (s * 0.31, 0.13, 0.33)])
    T.append([(s * 0.2, 0.82, 0.06), (s * 0.34, 0.72, -0.04), (s * 0.38, 0.55, -0.12), (s * 0.36, 0.38, -0.2)])
    T.append([(s * 0.06, 0.72, 0.16), (s * 0.11, 0.38, 0.17), (s * 0.06, 0.02, 0.13), (s * 0.02, -0.26, 0.17), (s * 0.08, -0.36, 0.26), (s * 0.13, -0.31, 0.3)])
  tent = np.minimum.reduce([tube(t, 0.085, 0.022, 14) for t in T])
  P.append(('tent', tent, K, 0.06))
  sk = []   # suckers: little pads on the front / under side of the curling tentacles
  for t in T[:2] + T[4:6] + [T[3], T[7]]:
    B = bezier(t, 14)
    for k in range(2, 12, 2 if HI else 3):
      p = B[k]; d = B[min(k + 1, 13)] - B[k - 1]; d /= np.linalg.norm(d) + 1e-9; o = np.cross(d, [1.0 if p[0] >= 0 else -1.0, 0, 0]); o /= np.linalg.norm(o) + 1e-9
      if o[2] < 0: o = -o
      r = 0.085 + (0.022 - 0.085) * k / 13; sk.append(p + o * r * 0.8)
  P.append(('sucker', np.minimum.reduce([ell(tuple(c), (0.026, 0.026, 0.026)) for c in sk]), SU, 0.01))
  P.append(('mount', ell((0, 0.75, -0.12), (0.2, 0.45, 0.14)), KD, 0.06))
  D = [('eye', [(s * 0.14, 0.93, 0.425) for s in (1, -1)], (0.078, 0.072, 0.04), EY), ('pupil', [(s * 0.14, 0.93, 0.462) for s in (1, -1)], (0.052, 0.02, 0.012), PU),
       ('eyehi', [(s * 0.12, 0.96, 0.466) for s in (1, -1)], (0.014, 0.014, 0.008), '#ffffff')]
  def colfix(name, V, C):
    if name == 'mantle': w = (np.clip((noise(V, 1.3) - 0.45) * 4, 0, 1) * (V[:, 1] > 1.0))[:, None]; C = C * (1 - w) + COL(KL) * w
    if name == 'tent': N = V[:, 2] - 0.15; w = np.clip(0.5 - V[:, 1], 0, 0.5)[:, None] * 0.5; C = C * (1 - w) + COL(KD) * w
    return C
  return P, D, colfix
def lion():
  G1, G2, G3, RU, MO = '#f2c230', '#c4860f', '#ffe38a', '#d8162c', '#5a1212'
  P = []
  lobes = []
  for i in range(18):   # outer ring: short curled locks (commas) round a full mane, all swirling one way
    a = i / 18 * 2 * math.pi + 0.1; d = np.array([math.cos(a), math.sin(a)]); t = np.array([-d[1], d[0]]); c = np.array([0, 1.03])
    lobes.append(tube([(*(c + d * 0.28), 0.24), (*(c + d * 0.4 + t * 0.05), 0.2), (*(c + d * 0.46 + t * 0.12), 0.12), (*(c + d * 0.42 + t * 0.17), 0.06)], 0.095, 0.04, 8))
  for i in range(11):   # inner ring framing the face
    a = i / 11 * 2 * math.pi + 0.3; d = np.array([math.cos(a), math.sin(a)]); t = np.array([-d[1], d[0]]); c = np.array([0, 1.0])
    lobes.append(tube([(*(c + d * 0.22), 0.33), (*(c + d * 0.3 + t * 0.06), 0.31), (*(c + d * 0.31 + t * 0.12), 0.25)], 0.07, 0.04, 5))
  mane = smin(np.minimum.reduce(lobes), ell((0, 1.03, 0.1), (0.4, 0.42, 0.2)), 0.05)
  P.append(('mane', mane, G2, 0.05))
  P.append(('face', ell((0, 1.0, 0.33), (0.23, 0.25, 0.2)), G1, 0.05))
  P.append(('ear', mirror(lambda s: ell((s * 0.2, 1.27, 0.25), (0.07, 0.075, 0.04), 'y', s * 0.4)), G1, 0.03))
  P.append(('brow', tube([(-0.16, 1.15, 0.42), (-0.05, 1.13, 0.47), (0.05, 1.13, 0.47), (0.16, 1.15, 0.42)], 0.045, 0.045, 7), G1, 0.03))
  P.append(('nose', tube([(0, 1.11, 0.47), (0, 0.99, 0.54)], 0.045, 0.055, 4), G1, 0.03))
  P.append(('cheek', mirror(lambda s: ell((s * 0.068, 0.93, 0.5), (0.08, 0.065, 0.07))), G3, 0.03))
  P.append(('jaw', ell((0, 0.8, 0.41), (0.12, 0.07, 0.12)), G1, 0.04))
  # [Raul items redo] BANKSY via Emerly: the body + legs were too thin next to the mane -> a deep barrel chest, rounded shoulders, a haunch
  # into the scroll, thick forelegs with big paws (proportions of the mane: a lion bust, not a cub on stilts)
  P.append(('chest', smin(smin(ell((0, 0.58, 0.2), (0.3, 0.33, 0.24)), mirror(lambda s: ell((s * 0.2, 0.7, 0.24), (0.16, 0.17, 0.16))), 0.06),
                          mirror(lambda s: tube([(s * 0.12, 0.8, 0.33), (s * 0.08, 0.44, 0.39)], 0.085, 0.05, 4)), 0.05), G1, 0.07))
  P.append(('haunch', ell((0, 0.3, 0.14), (0.25, 0.2, 0.19)), G1, 0.07))
  P.append(('leg', mirror(lambda s: smin(tube([(s * 0.17, 0.6, 0.27), (s * 0.2, 0.42, 0.38), (s * 0.19, 0.29, 0.43)], 0.11, 0.085, 5), ell((s * 0.19, 0.25, 0.49), (0.115, 0.075, 0.12)), 0.035)), G1, 0.05))
  P.append(('scroll', tube([(0, 0.32, 0.06), (0, 0.06, 0.12), (0, -0.12, 0.22), (0, -0.25, 0.29), (0, -0.34, 0.18), (0, -0.25, 0.08), (0, -0.17, 0.13)], 0.14, 0.045, 14), G2, 0.05))
  P.append(('mount', ell((0, 0.6, -0.12), (0.22, 0.6, 0.14)), G2, 0.06))
  D = [('eye', [(s * 0.1, 1.075, 0.465) for s in (1, -1)], (0.052, 0.04, 0.026), RU), ('pupil', [(s * 0.1, 1.075, 0.488) for s in (1, -1)], (0.018, 0.026, 0.01), '#2a0606'), ('nosepad', [(0, 0.985, 0.585)], (0.06, 0.04, 0.03), '#7a4a10'),
       ('mouth', [(0, 0.865, 0.515)], (0.085, 0.045, 0.035), MO)] + ([('fang', [(s * 0.05, 0.85, 0.545) for s in (1, -1)], (0.014, 0.032, 0.012), '#fff6dc')] if HI else [])
  def colfix(name, V, C):
    if name == 'leg': w = (np.clip((V[:, 2] - 0.56) * 40, 0, 1) * (np.sin(V[:, 0] * 120) > 0.3))[:, None]; C = C * (1 - w) + COL(G2) * w
    return C
  return P, D, colfix
# ------------------------------------------------------------------ build one figure
def tri_sphere(c, r, n=(10, 7)):
  nu, nv = n if HI else (6, 4); V = [[0, 0, -1]]; F = []
  for j in range(1, nv): t = math.pi * j / nv - math.pi / 2; V += [[math.cos(t) * math.cos(2 * math.pi * i / nu), math.cos(t) * math.sin(2 * math.pi * i / nu), math.sin(t)] for i in range(nu)]
  V.append([0, 0, 1]); V = np.array(V)
  for i in range(nu): F.append([0, 1 + (i + 1) % nu, 1 + i])
  for j in range(nv - 2):
    for i in range(nu): a = 1 + j * nu + i; b = 1 + j * nu + (i + 1) % nu; F += [[a, b, b + nu], [a, b + nu, a + nu]]
  top = len(V) - 1; base = 1 + (nv - 2) * nu
  for i in range(nu): F.append([base + i, base + (i + 1) % nu, top])
  V = V[:, [0, 2, 1]] * np.array(r) + np.array(c); F = np.array(F)[:, [0, 2, 1]]   # z-up unit -> y-up, scaled
  fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]]); out = V[F].mean(1) - np.array(c)
  if np.mean(np.sum(fn * out, 1)) < 0: F = F[:, [0, 2, 1]]
  return V, F
def build(name, fn):
  P, D, colfix = fn()
  fld = P[0][1].copy()
  for _, f, _, k in P[1:]: fld = smin(fld, f, k)
  fld = ndimage.gaussian_filter(fld, 0.6 if HI else 0.4)
  _, _, V, Fc = mc_part(fld, G, 'fig', 1); V, Fc = decimate(V, Fc, BUD)
  # colour: the nearest part, then AO from the field (how buried each vertex is), a little top light on gold
  ij = (V - lo_) / STEP; dist = np.stack([ndimage.map_coordinates(f, ij.T, order=1, mode='nearest') for _, f, _, _ in P], 1); who = np.argmin(dist, 1)
  C = np.array([COL(P[k][2]) for k in who])
  for k, (pn, _, _, _) in enumerate(P):
    m = who == k
    if m.any(): C[m] = colfix(pn, V[m], C[m])
  N = vnormals(V, Fc); ao = np.zeros(len(V))
  for d in (0.03, 0.06, 0.1): ao += np.clip(ndimage.map_coordinates(fld, ((V + N * d - lo_) / STEP).T, order=1, mode='nearest') / d, 0, 1)
  ao = ao / 3; C = C * (0.5 + 0.5 * ao)[:, None] * (0.95 + 0.12 * np.clip(N[:, 1], 0, 1))[:, None]
  parts = [Part(V, Fc, np.clip(C, 0, 1), True)]
  for dn, cs, r, col in D:
    for c in cs: v, f = tri_sphere(c, r); parts.append(Part(v, f, COL(col), False))
  m = finish(parts, ink=(0.014 if HI else 0.024), lowlight=False)
  return m
bpy.ops.wm.read_factory_settings(use_empty=True); stats = {}
for name, fn in (('fig_mermaid', mermaid), ('fig_kraken', kraken), ('fig_lion', lion)):
  m = build(name, fn); stats[name] = len(m.F)
  Vb = m.V[:, [0, 2, 1]] * np.array([1, -1, 1])   # three (x, y up, z fwd) -> Blender (x, -z, y)
  me = bpy.data.meshes.new(name); me.from_pydata(Vb.tolist(), [], m.F.tolist()); me.update()
  for p_ in me.polygons: p_.use_smooth = True
  ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.hstack([m.C, np.ones((len(m.C), 1))]).astype(np.float32).ravel()); me.color_attributes.active_color = ca
  mat = bpy.data.materials.new(name); mat.use_nodes = True; nt = mat.node_tree; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
  nt.links.new(vc.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(mat)
  ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
fn_ = f'{OUT}/figureheads_{lod}.glb'
bpy.ops.export_scene.gltf(filepath=fn_, export_format='GLB', export_skins=False, export_animations=False, export_yup=True, export_vertex_color='ACTIVE', export_attributes=False, export_materials='EXPORT', export_draco_mesh_compression_enable=True, export_draco_color_quantization=8, export_draco_normal_quantization=8)
print('BUILT', lod, stats, 'kb', os.path.getsize(fn_) // 1024)
