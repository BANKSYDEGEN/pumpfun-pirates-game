# bootgeo.py : SDF + mesh kit for tools/blender/boots/build_boots.py (Blender Z-up; front = -Y; character left = +X)
import numpy as np, math, bpy
from skimage.measure import marching_cubes
def COL(h):
  h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
  return np.array([x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c])
KEY1 = [1, 0, 1]; KEY2 = [0, 1, 1]; INK = COL('#15110f')
class Part:
  def __init__(s, V, F, C, outline=True):
    s.V = np.asarray(V, float); s.F = np.asarray(F, int); s.C = np.tile(np.asarray(C, float), (len(s.V), 1)) if np.ndim(C) == 1 else np.asarray(C, float); s.outline = outline
def merge(parts):
  V = []; Fs = []; C = []; o = 0
  for p in parts: V.append(p.V); Fs.append(p.F + o); C.append(p.C); o += len(p.V)
  return Part(np.vstack(V), np.vstack(Fs), np.vstack(C))
def vnormals(V, F):
  N = np.zeros_like(V); fn = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
  for k in range(3): np.add.at(N, F[:, k], fn)
  l = np.linalg.norm(N, axis=1); l[l == 0] = 1; return N / l[:, None]
def weld_normals(V, F):
  key = np.round(V * 20000).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
  N = vnormals(V, F); S = np.zeros((inv.max() + 1, 3)); np.add.at(S, inv, N); l = np.linalg.norm(S, axis=1); l[l == 0] = 1; return (S / l[:, None])[inv]
def finish(parts, ink=0.004, lowlight=False):   # + the inverted-hull ink shell (same as the other v5 gear); Low bakes the game light
  out = []
  for p in parts:
    out.append(p)
    if p.outline and ink > 0:
      N = weld_normals(p.V, p.F); out.append(Part(p.V + N * ink, p.F[:, [0, 2, 1]], INK, False))
  m = merge(out)
  if lowlight:
    L = np.array([0.35, -0.5, 0.8]); L /= np.linalg.norm(L); N = weld_normals(m.V, m.F); s = 0.58 + 0.42 * np.clip(N @ L, 0, None) + 0.08 * np.clip(N[:, 2], 0, None)
    ink_ = (np.abs(m.C - INK).sum(1) < 1e-4) | (np.abs(m.C - np.array(KEY1)).sum(1) < 0.05) | (np.abs(m.C - np.array(KEY2)).sum(1) < 0.05)   # keyed markers: lit at runtime (keyColors)
    m.C = np.where(ink_[:, None], m.C, m.C * s[:, None])
  return m
# ---------------------------------------------------------------- SDFs (approximate, smoothed after)
def smin(a, b, k):
  h = np.clip(0.5 + 0.5 * (b - a) / k, 0, 1); return b * (1 - h) + a * h - k * h * (1 - h)
def smax(a, b, k): return -smin(-a, -b, k)
def sd_ellipsoid(x, y, z, a, b, c):
  k0 = np.sqrt((x / a) ** 2 + (y / b) ** 2 + (z / c) ** 2); k1 = np.sqrt((x / a ** 2) ** 2 + (y / b ** 2) ** 2 + (z / c ** 2) ** 2) + 1e-9
  return k0 * (k0 - 1) / k1
def sd_superellipsoid(x, y, z, a, b, c, pxy=3.0, pz=2.5):
  r = ((np.abs(x) / a) ** pxy + (np.abs(y) / b) ** pxy) ** (1 / pxy); f = (r ** pz + (np.abs(z) / c) ** pz) ** (1 / pz)
  return (f - 1) * min(a, b, c)
def _polar(X, Y, Z, zs, cen, RR):
  zi = np.clip((Z - zs[0]) / (zs[1] - zs[0]), 0, len(zs) - 1.001); i0 = np.floor(zi).astype(int); f = zi - i0; i1 = i0 + 1
  cx = cen[i0, 0] * (1 - f) + cen[i1, 0] * f; cy = cen[i0, 1] * (1 - f) + cen[i1, 1] * f
  dx = X - cx; dy = Y - cy; rho = np.sqrt(dx * dx + dy * dy); NB = RR.shape[1]
  tb = (np.arctan2(dy, dx) % (2 * math.pi)) / (2 * math.pi) * NB - 0.5; b0 = np.floor(tb).astype(int) % NB; g = tb - np.floor(tb); b1 = (b0 + 1) % NB
  R = (RR[i0, b0] * (1 - g) + RR[i0, b1] * g) * (1 - f) + (RR[i1, b0] * (1 - g) + RR[i1, b1] * g) * f
  return rho, R, zi
def sd_polar(X, Y, Z, zs, cen, RR, margin, zbot, top, flare=0.0, base_only=False):
  rho, R, _ = _polar(X, Y, Z, zs, cen, RR)
  if base_only: return rho - R
  t = np.clip((Z - (top - 0.05)) / 0.05, 0, 1)
  return np.maximum(rho - (R + margin + flare * t * t), zbot - Z)
def sd_ring(X, Y, Z, c, Rtab, z0, r, flat=None):
  zs = np.array([0.0, 1.0]); cen = np.array([c, c]); RR = np.array([Rtab, Rtab])
  rho, R, _ = _polar(X, Y, np.zeros_like(Z), zs, cen, RR); d = rho - R
  if flat is None: return np.sqrt(d * d + (Z - z0) ** 2) - r
  return np.maximum(np.abs(d) - r * 0.55, np.abs(Z - z0) - flat) - 0.0015
def sd_box(x, y, z, a, b, c, r=0.0):
  q = np.stack([np.abs(x) - a + r, np.abs(y) - b + r, np.abs(z) - c + r]); return np.linalg.norm(np.maximum(q, 0), axis=0) + np.minimum(q.max(0), 0) - r
def sd_buckle(dx, dy, dz, w, h, t, bar):   # square frame in the x-z plane (front face), centre prong
  outer = sd_box(dx, dy, dz, w / 2, t / 2, h / 2, 0.0025); inner = sd_box(dx, dy, dz, w / 2 - bar, t, h / 2 - bar)
  prong = sd_box(dx, dy + t * 0.2, dz, 0.0022, t * 0.35, h / 2 - bar * 0.5, 0.001)
  return np.minimum(np.maximum(outer, -inner), prong)
def sd_spur(dx, dy, dz):
  # shank (to the back, +Y) + a 6-point rowel in the y-z plane
  t = np.clip(dy / 0.022, 0, 1); shank = np.sqrt(dx ** 2 + (dy - t * 0.022) ** 2 + dz ** 2) - 0.0045
  ry = dy - 0.028; a = np.arctan2(dz, ry); rr = np.sqrt(ry ** 2 + dz ** 2)
  rowel = np.maximum(rr - (0.012 + 0.004 * np.cos(6 * a)), np.abs(dx) - 0.0028)
  return np.minimum(shank, rowel)
def surface_y(field, G, x, z, front=True):
  X, Y, Z, lo, st = G; ix = int(round((x - lo[0]) / st)); iz = int(round((z - lo[2]) / st)); col = field[ix, :, iz]; idx = np.where(col < 0)[0]
  if not len(idx): return float(lo[1] + st * field.shape[1] / 2)
  return float(lo[1] + st * (idx[0] if front else idx[-1]))
def mc_part(field, G, kind, sx):
  X, Y, Z, lo, st = G
  if field.min() >= 0 or field.max() <= 0: return (kind, sx, np.zeros((0, 3)), np.zeros((0, 3), int))
  V, Fc, _, _ = marching_cubes(field, 0.0, spacing=(st, st, st)); V = V + lo
  # outward winding: face normals along the field gradient
  c = V[Fc].mean(1); fn = np.cross(V[Fc[:, 1]] - V[Fc[:, 0]], V[Fc[:, 2]] - V[Fc[:, 0]])
  gx, gy, gz = np.gradient(field, st); ij = np.clip(np.round((c - lo) / st).astype(int), 0, np.array(field.shape) - 1)
  g = np.stack([gx[tuple(ij.T)], gy[tuple(ij.T)], gz[tuple(ij.T)]], 1)
  if np.mean(np.sum(fn * g, 1)) < 0: Fc = Fc[:, [0, 2, 1]]
  return (kind, sx, V, Fc)
def decimate(V, Fc, n):
  me = bpy.data.meshes.new('dec'); me.from_pydata(V.tolist(), [], Fc.tolist()); me.update(); ob = bpy.data.objects.new('dec', me); bpy.context.scene.collection.objects.link(ob)
  if len(Fc) > n:
    md = ob.modifiers.new('d', 'DECIMATE'); md.decimate_type = 'COLLAPSE'; md.ratio = n / len(Fc); md.use_collapse_triangulate = True
  ob.modifiers.new('t', 'TRIANGULATE')
  dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg); m2 = ev.to_mesh(); m2.calc_loop_triangles()
  V2 = np.array([v.co[:] for v in m2.vertices]); F2 = np.array([t.vertices[:] for t in m2.loop_triangles])
  ev.to_mesh_clear(); bpy.data.objects.remove(ob); bpy.data.meshes.remove(me); return V2, F2
def noise(V, s=1.0):
  x, y, z = V[:, 0] * s, V[:, 1] * s, V[:, 2] * s
  return (np.sin(41 * x + 13 * y + 3.1) * np.sin(37 * y - 17 * z + 1.3) + 0.6 * np.sin(83 * z + 29 * x + 0.7) * np.sin(71 * y + 2.2)) / 1.6
def shade(kind, V, Fc, base, top):
  N = vnormals(V, Fc); up = np.clip(N[:, 2], 0, 1); fr = np.clip(-N[:, 1], 0, 1); nz = noise(V)
  base = np.asarray(base, float)
  if kind in ('gold', 'silver'):
    dk, br = (COL('#8a560a'), COL('#ffe58a')) if kind == 'gold' else (COL('#6c7380'), COL('#f4f7fb'))
    t = np.clip(0.35 + 0.45 * up + 0.25 * fr * up + 0.08 * nz, 0, 1)[:, None]
    return dk * (1 - t) + np.maximum(base, 0) * t * 0.6 + br * t * 0.4
  z = np.clip(V[:, 2] / max(top, 1e-3), 0, 1)
  if kind == 'upper':
    k = (0.78 + 0.22 * z ** 0.7) * (1 + 0.07 * nz) * (1 + 0.22 * up * fr)          # darker at the sole, worn highlight on the toe
    crease = (np.abs(V[:, 2] - 0.085) < 0.018) * fr * (0.5 + 0.5 * np.sin(V[:, 2] * 520)) * 0.18   # ankle creases at the front
    k = k * (1 - crease)
  elif kind == 'cuff': k = (0.86 + 0.14 * up) * (1 + 0.06 * nz)
  elif kind == 'sole': k = 0.9 + 0.1 * up
  else: k = (0.9 + 0.16 * up) * (1 + 0.05 * nz)
  return base * k[:, None]
def _cr(P, n):   # closed Catmull-Rom resample of a 2D loop
  P = np.asarray(P, float); K = len(P); out = []
  for i in range(K):
    p0, p1, p2, p3 = P[(i - 1) % K], P[i], P[(i + 1) % K], P[(i + 2) % K]
    for t in np.linspace(0, 1, n, endpoint=False):
      out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
  return np.array(out)
def sweep(c, Rtab, base, prof, nth=40, sub=3, wave=None, amp=None):
  # a closed 2D profile (dr, z) swept round the leg's polar curve c + (R(th) + base + dr) * dir(th): crisp rims / cuffs / bands
  NB = len(Rtab); Pf = _cr(prof, sub); V = []
  for i in range(nth):
    th = 2 * math.pi * i / nth; tb = th / (2 * math.pi) * NB - 0.5; b0 = int(math.floor(tb)) % NB; g = tb - math.floor(tb); R = Rtab[b0] * (1 - g) + Rtab[(b0 + 1) % NB] * g
    d = np.array([math.cos(th), math.sin(th)]); w = wave(th) if wave else 0.0
    for dr, z in Pf:
      r = R + base + dr * (amp(th) if amp else 1.0) + (w * max(0.0, (z - Pf[:, 1].min()) / max(1e-6, np.ptp(Pf[:, 1]))) if wave else 0.0)
      V.append([c[0] + d[0] * r, c[1] + d[1] * r, z])
  V = np.array(V); n = len(Pf); Fc = []
  for i in range(nth):
    for j in range(n):
      a = i * n + j; b = ((i + 1) % nth) * n + j; a2 = i * n + (j + 1) % n; b2 = ((i + 1) % nth) * n + (j + 1) % n; Fc += [[a, b, b2], [a, b2, a2]]
  Fc = np.array(Fc); cen = V.mean(0); fn = np.cross(V[Fc[:, 1]] - V[Fc[:, 0]], V[Fc[:, 2]] - V[Fc[:, 0]]); fc = V[Fc].mean(1)
  # outward = away from the profile's own centre line (the ring tube), not the ring centre
  pc = np.array([[c[0] + math.cos(2 * math.pi * (k // n) / nth) * 0, 0, 0] for k in range(0)]) if False else None
  ring_mid = np.array(Pf).mean(0); ref = []
  for i in range(nth):
    th = 2 * math.pi * i / nth; tb = th / (2 * math.pi) * NB - 0.5; b0 = int(math.floor(tb)) % NB; g = tb - math.floor(tb); R = Rtab[b0] * (1 - g) + Rtab[(b0 + 1) % NB] * g
    r = R + base + ring_mid[0]; ref.append([c[0] + math.cos(th) * r, c[1] + math.sin(th) * r, ring_mid[1]])
  ref = np.repeat(np.array(ref), n, axis=0); ctr = ref[Fc[:, 0]]
  if np.mean(np.sum(fn * (fc - ctr), 1)) < 0: Fc = Fc[:, [0, 2, 1]]
  return V, Fc
def on_surface(field, G, x, z, front=True):   # surface point + outward normal (field gradient) on the line at (x, z)
  X, Y, Z, lo, st = G; y = surface_y(field, G, x, z, front); ij = np.clip(np.round((np.array([x, y, z]) - lo) / st).astype(int), 1, np.array(field.shape) - 2)
  i, j, k = ij; g = np.array([field[i + 1, j, k] - field[i - 1, j, k], field[i, j + 1, k] - field[i, j - 1, k], field[i, j, k + 1] - field[i, j, k - 1]])
  return np.array([x, y, z]), g / (np.linalg.norm(g) + 1e-9)
def sd_buckle_on(X, Y, Z, p, n, w, h, t, bar):   # the buckle frame laid flat on the surface (normal n), its long side along x
  u = np.array([1.0, 0, 0]) if abs(n[0]) < 0.8 else np.array([0, 1.0, 0]); u = u - n * np.dot(u, n); u /= np.linalg.norm(u); v = np.cross(n, u); c = p + n * (t * 0.5 + 0.002)
  dx = (X - c[0]) * u[0] + (Y - c[1]) * u[1] + (Z - c[2]) * u[2]; dn = (X - c[0]) * n[0] + (Y - c[1]) * n[1] + (Z - c[2]) * n[2]; dv = (X - c[0]) * v[0] + (Y - c[1]) * v[1] + (Z - c[2]) * v[2]
  return sd_buckle(dx, -dn, dv, w, h, t, bar)

def sd_tube(X, Y, Z, pts, rad):   # tapered capsule chain (a hair lock / braid core / tail): min over segments, radius lerped
  pts = np.asarray(pts, float); rad = np.broadcast_to(np.asarray(rad, float), (len(pts),)); d = np.full(np.shape(X), 9.0)
  for k in range(len(pts) - 1):
    a, b = pts[k], pts[k + 1]; ab = b - a; L2 = float(ab @ ab) + 1e-12
    t = np.clip(((X - a[0]) * ab[0] + (Y - a[1]) * ab[1] + (Z - a[2]) * ab[2]) / L2, 0, 1)
    q = np.sqrt((X - a[0] - t * ab[0]) ** 2 + (Y - a[1] - t * ab[1]) ** 2 + (Z - a[2] - t * ab[2]) ** 2) - (rad[k] + (rad[k + 1] - rad[k]) * t)
    d = np.minimum(d, q)
  return d
def bezier(P, n=8):
  P = np.asarray(P, float); out = []
  for t in np.linspace(0, 1, n):
    Q = P.copy()
    while len(Q) > 1: Q = Q[:-1] * (1 - t) + Q[1:] * t
    out.append(Q[0])
  return np.array(out)
