# V6 limbs -> V5 limb proportions (BANKSY 11:53 AM "the arms and legs are weird").
# Per-slice anisotropic radial scale of the V6 arms (y,z around the arm axis, sliced along x) and
# legs (x,y around the leg axis, sliced along z) so their cross-section matches the V5 body:
#   arms -> ARMK x V5 bare-arm extents; legs -> LEGK x V5 pants/boot extents (stays inside v5 pants + boots).
# Grow only (never thinner than V6), smoothed along the limb; hands / feet / torso / underwear top untouched (ramped).
# Rig, weights, UVs, tints, extras unchanged.  blender -b -noaudio -P limbs.py -- SEX LOD IN.glb OUT.glb
import bpy, sys, os, numpy as np
SEX, LOD, IN, OUT = sys.argv[sys.argv.index('--') + 1:][:4]
G = '/workspace/raul-v6/assets/pirates/'
ARMK = float(os.environ.get('ARMK', '0.97'))
LEGK = float(os.environ.get('LEGK', '0.84'))
SL = 0.02

def load(f):
  b0 = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f)
  new = [o for o in bpy.data.objects if o not in b0]
  arm = [o for o in new if o.type == 'ARMATURE'][0]; arm.data.pose_position = 'REST'
  body = [o for o in new if o.type == 'MESH' and o.name.startswith('pirate_')][0]
  return new, arm, body
def PT(body):
  P = np.zeros(len(body.data.vertices) * 3); body.data.vertices.foreach_get('co', P); P = P.reshape(-1, 3)
  t = np.zeros(len(P)); body.data.attributes['_TINT'].data.foreach_get('value', t); return P, np.round(t)

bpy.ops.wm.read_factory_settings(use_empty=True)
g5, a5, b5 = load(G + f'pirate_{SEX}_v5_{LOD}.glb')
P5, T5 = PT(b5)
for o in g5: bpy.data.objects.remove(o, do_unlink=True)
g6, a6, body = load(IN)
P6, T6 = PT(body)

def smooth(v, n=2):
  v = v.copy()
  for _ in range(n):
    w = v.copy(); w[1:-1] = (v[:-2] + 2 * v[1:-1] + v[2:]) / 4; v = w
  return v
def rng(a): return np.percentile(a, 95) - np.percentile(a, 5)

out = P6.copy()
# ---------- arms: slices along |x| ----------
X0, X1 = 0.22, 0.36   # shoulder .. wrist (hand beyond kept)
ok5 = (T5 != 1) & (T5 != 7) & (P5[:, 2] > 0.55) & (P5[:, 2] < 0.9)
ok6 = (T6 != 1) & (P6[:, 2] > 0.55) & (P6[:, 2] < 0.9)
xs = np.arange(X0 - 0.03, X1 + 0.05, SL)
for side in (-1, 1):
  S5 = ok5 & (np.sign(P5[:, 0]) == side); S6 = ok6 & (np.sign(P6[:, 0]) == side)
  ky = []; kz = []; cy = []; cz = []
  for x in xs:
    m5 = S5 & (np.abs(P5[:, 0]) >= x) & (np.abs(P5[:, 0]) < x + SL)
    m5b = ok5 & (np.sign(P5[:, 0]) == -side) & (np.abs(P5[:, 0]) >= x) & (np.abs(P5[:, 0]) < x + SL)
    m6 = S6 & (np.abs(P6[:, 0]) >= x) & (np.abs(P6[:, 0]) < x + SL)
    # arm only: keep the band near the V6 arm axis z
    if m6.sum() < 4 or m5.sum() < 4: ky.append(1); kz.append(1); cy.append(np.nan); cz.append(np.nan); continue
    zc = np.median(P6[m6, 2]); m6 &= np.abs(P6[:, 2] - zc) < 0.09
    m5 &= np.abs(P5[:, 2] - zc) < 0.11; m5b &= np.abs(P5[:, 2] - zc) < 0.11
    r5y = min(rng(P5[m5, 1]), rng(P5[m5b, 1]) if m5b.sum() > 4 else 9); r5z = min(rng(P5[m5, 2]), rng(P5[m5b, 2]) if m5b.sum() > 4 else 9)
    ky.append(max(1, ARMK * r5y / max(rng(P6[m6, 1]), 1e-3))); kz.append(max(1, ARMK * r5z / max(rng(P6[m6, 2]), 1e-3)))
    cy.append(np.median(P6[m6, 1])); cz.append(zc)
  ky = smooth(np.clip(ky, 1, 2.2)); kz = smooth(np.clip(kz, 1, 1.8))
  cy = np.array(cy); cz = np.array(cz); good = ~np.isnan(cy)
  cy = np.interp(np.arange(len(xs)), np.where(good)[0], cy[good]); cz = np.interp(np.arange(len(xs)), np.where(good)[0], cz[good])
  cy = smooth(cy, 3); cz = smooth(cz, 3)
  print('arm', side, 'ky', np.round(ky, 2), 'kz', np.round(kz, 2), flush=True)
  sel = np.where(S6 & (np.abs(P6[:, 0]) > X0 - 0.03) & (np.abs(P6[:, 0]) < X1 + 0.05))[0]
  ax = np.abs(P6[sel, 0]) + SL / 2 * 0
  fy = np.interp(ax, xs + SL / 2, ky); fz = np.interp(ax, xs + SL / 2, kz)
  oy = np.interp(ax, xs + SL / 2, cy); oz = np.interp(ax, xs + SL / 2, cz)
  w = np.clip((ax - (X0 - 0.03)) / 0.04, 0, 1) * np.clip(((X1 + 0.04) - ax) / 0.04, 0, 1)
  w *= np.clip(1 - (np.abs(P6[sel, 2] - oz) - 0.07) / 0.03, 0, 1)
  out[sel, 1] = oy + (P6[sel, 1] - oy) * (1 + (fy - 1) * w)
  out[sel, 2] = oz + (P6[sel, 2] - oz) * (1 + (fz - 1) * w)
# ---------- legs: slices along z ----------
Z0, Z1 = 0.075, 0.36   # ankle .. under the underwear hem (ramped to 0.42)
zs = np.arange(Z0 - 0.02, Z1 + 0.06, SL)
for side in (-1, 1):
  S5 = (T5 != 1) & (T5 != 7) & (P5[:, 0] * side > 0.005); S5b = (T5 != 1) & (T5 != 7) & (P5[:, 0] * -side > 0.005)
  S6 = (T6 != 1) & (P6[:, 0] * side > 0.005)
  kx = []; ky = []; cx = []; cy = []
  for z in zs:
    m5 = S5 & (P5[:, 2] >= z) & (P5[:, 2] < z + SL); m5b = S5b & (P5[:, 2] >= z) & (P5[:, 2] < z + SL)
    m6 = S6 & (P6[:, 2] >= z) & (P6[:, 2] < z + SL)
    if m6.sum() < 4 or m5.sum() < 4: kx.append(1); ky.append(1); cx.append(np.nan); cy.append(np.nan); continue
    r5x = min(rng(P5[m5, 0]), rng(P5[m5b, 0]) if m5b.sum() > 4 else 9); r5y = min(rng(P5[m5, 1]), rng(P5[m5b, 1]) if m5b.sum() > 4 else 9)
    kx.append(max(1, LEGK * r5x / max(rng(P6[m6, 0]), 1e-3))); ky.append(max(1, LEGK * r5y / max(rng(P6[m6, 1]), 1e-3)))
    cx.append(np.median(P6[m6, 0])); cy.append(np.median(P6[m6, 1]))
  kx = smooth(np.clip(kx, 1, 1.6), 3); ky = smooth(np.clip(ky, 1, 1.9), 3)
  cx = np.array(cx); cy = np.array(cy); good = ~np.isnan(cx)
  cx = np.interp(np.arange(len(zs)), np.where(good)[0], cx[good]); cy = np.interp(np.arange(len(zs)), np.where(good)[0], cy[good])
  cx = smooth(cx, 3); cy = smooth(cy, 3)
  print('leg', side, 'kx', np.round(kx, 2), 'ky', np.round(ky, 2), flush=True)
  sel = np.where(S6 & (P6[:, 2] > Z0 - 0.025) & (P6[:, 2] < Z1 + 0.065))[0]
  az = P6[sel, 2]
  fx = np.interp(az, zs + SL / 2, kx); fy = np.interp(az, zs + SL / 2, ky)
  ox = np.interp(az, zs + SL / 2, cx); oy = np.interp(az, zs + SL / 2, cy)
  w = np.clip((az - (Z0 - 0.025)) / 0.03, 0, 1) * np.clip(((Z1 + 0.06) - az) / 0.06, 0, 1)
  # don't push the inner thigh across the midline
  nx = ox + (P6[sel, 0] - ox) * (1 + (fx - 1) * w)
  nx = np.where(side * nx < 0.008, side * 0.008, nx)
  out[sel, 0] = nx
  out[sel, 1] = oy + (P6[sel, 1] - oy) * (1 + (fy - 1) * w)

d = np.linalg.norm(out - P6, axis=1); print('moved verts', int((d > 1e-5).sum()), 'max', round(float(d.max()), 4), flush=True)
body.data.vertices.foreach_set('co', out.ravel()); body.data.update()
# normals: let glTF export recompute from smooth shading data
a6.data.pose_position = 'POSE'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
  filepath=OUT, export_format='GLB', export_attributes=True, export_vertex_color='ACTIVE',
  export_all_vertex_colors=False, export_animations=True, export_animation_mode='ACTIONS',
  export_skins=True, export_image_format='WEBP', export_image_quality=90 if LOD == 'hi' else 80,
  export_draco_mesh_compression_enable=True, export_def_bones=False, export_yup=True, export_extras=True)
print('exported', OUT, flush=True)
