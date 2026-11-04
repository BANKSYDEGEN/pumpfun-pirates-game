# pegfit.py : Raul's PEG LEG FIT for the v5 bodies (Blender 4.2, Z-up, front = -Y, character left = +X). Shared by
#   build_peg.py      -> the standard Peg Leg (assets/pirates/items/v5/peg_{l,r}_{male,female}_{hi,lo}.glb)
#   refit_special.py  -> re-seats any other peg (peg_gold / peg_kraken from raul/shop-items-2) on the same fit
# The fit: a fitted leather KNEE SLEEVE ray-cast round the real pant leg (cloth_base + body) from just above the knee to just under it,
# closed by a rounded cup into the shaft; the pant leg / boot on that side are hidden in-game below CUT (js/pirateItems.js rule leg5).
# Sleeve weights are copied from the pant leg underneath (thigh / shin blend, so it bends with the knee like the pants and never lets
# them poke out); the cup bottom + everything below it is rigid on shin.X (swings with the leg, tip lands where the boot sole was).
import bpy, sys, os, math, json, numpy as np
from mathutils import Vector, kdtree
from mathutils.bvhtree import BVHTree
sys.path.insert(0, '/workspace/raul_polish_work'); from lib import reset, imp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import geo; from geo import *
FITDIR = '/workspace/brand/v5_models/raul_pegleg/fit'
# heights relative to the knee joint (shin bone head) -- the one place to tune the fit
TOP, CUT, STRAIGHT, CUP, GAP = 0.05, -0.012, -0.03, -0.105, 0.0075   # [Raul items redo] peg polish: a tapered socket (straight to -3 cm, cone to -10.5 cm) instead of the flat bucket cup   # sleeve top / in-game hide line / end of the straight sleeve / cup bottom / clearance over the pants
def world(o): return np.array([o.matrix_world @ v.co for v in o.data.vertices])
class Body:
  def __init__(s, who, lod, wt):
    s.who, s.lod, s.HI = who, lod, lod == 'hi'
    reset(); objs = imp(f'{wt}/assets/pirates/pirate_{who}_v5_{lod}.glb')
    s.arm = [o for o in objs if o.type == 'ARMATURE'][0]; s.arm.data.pose_position = 'REST'; bpy.context.view_layer.update()
    s.body = [o for o in objs if o.type == 'MESH' and 'body' in o.name][0]
    base = imp(f'{wt}/assets/pirates/items/v5/cloth_base_{who}_{lod}.glb'); s.cloth = [o for o in base if o.type == 'MESH'][0]
    for o in base:
      if o.type == 'ARMATURE': s.cloth.modifiers.clear(); s.cloth.parent = None; bpy.data.objects.remove(o)
    s.objs = objs + [s.cloth]
    s.BV, s.CV = world(s.body), world(s.cloth)
    BF = [list(p.vertices) for p in s.body.data.polygons]; CF = [list(p.vertices) for p in s.cloth.data.polygons]
    allV = np.vstack([s.BV, s.CV]); allF = BF + [[i + len(s.BV) for i in f] for f in CF]
    s.bvh = BVHTree.FromPolygons([Vector(v) for v in allV], allF)
    # pant-leg weights (cloth_base vertex groups -> bone names)
    gi = {g.index: g.name for g in s.cloth.vertex_groups}; s.W = [{gi[g.group]: g.weight for g in v.groups if g.weight > 1e-4} for v in s.cloth.data.vertices]
    s.kd = kdtree.KDTree(len(s.CV))
    for i, v in enumerate(s.CV): s.kd.insert(Vector(v), i)
    s.kd.balance()
  def knee(s, sd): return np.array(s.arm.data.bones[f'shin.{sd.upper()}'].head_local)
  def fit(s, sd):
    sx = 1 if sd == 'l' else -1; kz = float(s.knee(sd)[2]); X = sx * s.CV[:, 0]
    def ctr(z):   # pant-leg centre at height z (that side only)
      m = (X > 0.0) & (X < 0.3) & (np.abs(s.CV[:, 2] - z) < 0.03)
      return np.array([sx * (X[m].min() + X[m].max()) / 2, (s.CV[m, 1].min() + s.CV[m, 1].max()) / 2])
    c0 = ctr(kz); m = (X > 0) & (X < 0.3) & (np.abs(s.CV[:, 2] - kz) < 0.03)
    kw = float(max(np.ptp(X[m]), np.ptp(s.CV[m, 1])))
    F = dict(side=sd, knee=[float(c0[0]), float(c0[1]), kz], knee_width=kw, top=kz + TOP, cut=kz + CUT, straight=kz + STRAIGHT, cup=kz + CUP,
             shaft_top=kz + CUP + 0.014, tip=[float(c0[0]), float(c0[1]), 0.0], cut_three_y=round(kz + CUT, 4), gap=GAP, bone=f'shin.{sd.upper()}')
    return F
  def radius(s, c, th, z):   # pant surface distance from the leg axis at angle th (0 = front -Y, + = toward +X)
    d = np.array([math.sin(th), -math.cos(th), 0]); o = np.array([c[0], c[1], z]) + d * 0.13   # start inside the gap to the other leg (inner thigh ~0.145 off the axis)
    h = s.bvh.ray_cast(Vector(o), Vector(-d), 0.13)
    return None if h[0] is None else float(np.linalg.norm(np.array(h[0])[:2] - np.array(c)))
  def weights(s, V, F, rigid):   # copy the pant weights under each sleeve vertex; blend to rigid shin under the knee (+ rigid parts)
    bone = F['bone']; kz = F['knee'][2]; out = []; thb = 'thigh.' + bone[-1]; legb = (thb, bone)
    for i, v in enumerate(V):
      if rigid[i]: out.append({bone: 1.0}); continue
      acc = {}; tot = 0
      for co, j, dist in s.kd.find_n(Vector(v), 6):
        w = 1 / (dist + 0.004); tot += w
        for b, x in s.W[j].items(): acc[b] = acc.get(b, 0) + x * w
      acc = {b: x / tot for b, x in acc.items() if b in legb}   # only this leg's thigh / shin (the pant weights stray onto spine / the other leg in places)
      if sum(acc.values()) < 1e-3: u = min(1, max(0, (v[2] - kz) / 0.06)); acc = {thb: u, bone: 1 - u}
      # half the pant weights + half a smooth knee blend (kz + 4.5 cm thigh -> kz - 3.5 cm shin): a round bend instead of a crease
      u = min(1, max(0, (kz + 0.045 - v[2]) / 0.08)); u = u * u * (3 - 2 * u); sh = acc.get(bone, 0) / max(1e-6, sum(acc.values()))
      acc = {thb: 1 - (0.5 * sh + 0.5 * u), bone: 0.5 * sh + 0.5 * u}
      t = min(1, max(0, (kz - 0.005 - v[2]) / 0.03)); t = t * t * (3 - 2 * t)   # under the knee -> shin
      acc = {b: x * (1 - t) for b, x in acc.items()}; acc[bone] = acc.get(bone, 0) + t
      sm = sum(acc.values()); acc = {b: x / sm for b, x in acc.items() if x / sm > 0.01}; sm = sum(acc.values())
      out.append({b: x / sm for b, x in acc.items()})
    return out
PAL = {   # sleeve palettes (hex): leather, rim, band (straps), buckle
  'peg':        dict(leather='#5b3520', rim='#7b4a2a', band='#2c1a10', buckle='#c9a24a', seam='#3a2216'),   # [Raul items redo] brass buckle + a stitched seam
  'peg_gold':   dict(leather='#f2c230', rim='#c88a16', band='#7a1424', buckle='#c88a16', gem='#d8162c'),     # gilded cup colours kept: gold sleeve, crimson velvet strap
  'peg_kraken': dict(leather='#c9b892', rim='#4e2478', band='#7a3fb0', buckle='#efe6cf'),     # bone cup + kraken-purple rim kept
  'peg_ghost':  dict(leather='#34333c', rim=None, band='#4a4238', buckle='#ece3cc', gem=None),   # [Raul pegs 2] GHOST BONE PEG: black leather, ghost-green glowing rim (GLOW), bone buckle
}
GLOW = '#39ff9c'   # [Raul pegs 2] the ghost-green glow colour (js/pirateItems.js GLOW5 lights vertices of this colour in game; lowlight keeps it full bright)
def sleeve_parts(b, F, pal, res=1.0):
  # the knee sleeve: outer surface grid (angles x heights) round the pant leg + a rolled rim + 2 straps with a buckle on the outside
  sx = 1 if F['side'] == 'l' else -1; c = np.array(F['knee'][:2]); seg = lambda n: max(6, int(round(n * res)))
  nu = seg(24); ZS = list(np.linspace(F['top'], F['straight'], 6 if res >= 1 else 4)); nd = 6 if res >= 1 else 4
  base_r = {}
  for th_i in range(nu):
    th = 2 * math.pi * th_i / nu; rs = []
    for z in ZS:
      r = b.radius(c, th, z); rs.append(r if r is not None else F['knee_width'] * 0.5)
    base_r[th_i] = rs
  R0 = np.array([base_r[i] for i in range(nu)])                                   # (nu, nz)
  # smooth round the leg (no spikes from folds) and never thinner than the widest fold below it at that angle
  Rs = (np.roll(R0, 1, 0) + 2 * R0 + np.roll(R0, -1, 0)) / 4; Rs = np.maximum(Rs, R0)
  shaft_r = pal.get('neck', 0.031)
  G = np.zeros((nu, len(ZS) + nd, 3))
  for i in range(nu):
    th = 2 * math.pi * i / nu; d = np.array([math.sin(th), -math.cos(th)])
    for j, z in enumerate(ZS):
      r = Rs[i, j] + F['gap'] + 0.004 * (1 - j / (len(ZS) - 1)) ** 2      # a touch flared at the top
      G[i, j] = [c[0] + d[0] * r, c[1] + d[1] * r, z]
    rl = Rs[i, -1] + F['gap']
    for k in range(1, nd + 1):   # rounded cup down to the shaft
      t = k / nd; r = shaft_r + (rl - shaft_r) * (1 - t ** 1.6) * (1 - 0.15 * t); z = F['straight'] + (F['cup'] - F['straight']) * t   # [Raul items redo] a full shoulder easing into a cone (a fitted socket, not a bucket)
      G[i, len(ZS) - 1 + k] = [c[0] + d[0] * r, c[1] + d[1] * r, z]
  # close the u-loop: sheet_solid takes an open grid, so repeat the first column
  Gc = np.concatenate([G, G[:1]], 0)
  parts = [sheet_solid(Gc, 0.008, lin(pal['leather']), outward=[c[0], c[1], (F['top'] + F['cup']) / 2])]
  # rolled rim on the top edge
  top = Gc[:, 0]; parts.append(tube(top, 0.0085, lin(pal['rim'] or GLOW), seg(8), cap=False, outline=bool(pal['rim'])))
  # [Raul items redo] a thin collar where the socket meets the shaft (hides the join, reads as a fitted part)
  bot = Gc[:, -1]; parts.append(tube(bot, 0.0055, lin(pal['rim'] or GLOW), seg(8) if res >= 1 else 4, cap=False, outline=False))
  # two straps
  for zz, hh in ((F['straight'] + 0.006, 0.015),):   # one strap + buckle under the knee (rigid zone: a strap across the bend zig-zags through the leather)
    j = int(np.argmin([abs(z - zz) for z in ZS])); rows = []
    for k, z in enumerate((zz + hh / 2, zz - hh / 2)):
      row = []
      for i in range(nu + 1):
        ii = i % nu; th = 2 * math.pi * ii / nu; d = np.array([math.sin(th), -math.cos(th)]); r = Rs[ii, j] + F['gap'] + 0.0065
        row.append([c[0] + d[0] * r, c[1] + d[1] * r, z])
      rows.append(row)
    S = np.stack([np.array(rows[0]), np.array(rows[1])], 1)
    parts.append(sheet_solid(S, 0.004, lin(pal['band']), outward=[c[0], c[1], zz]))
    # buckle on the outer side (+X for the left leg)
    i_out = int(round((math.pi / 2 if sx > 0 else 3 * math.pi / 2) / (2 * math.pi) * nu)) % nu
    th = 2 * math.pi * i_out / nu; d = np.array([math.sin(th), -math.cos(th), 0]); r = Rs[i_out, j] + F['gap'] + 0.011
    p = np.array([c[0], c[1], zz]) + d * r
    parts.append(torus(p, hh * 0.75, 0.0028, d, lin(pal['buckle']), 4, seg(4), a0=math.pi / 4))   # square buckle frame
  if res >= 1:   # [Raul items redo] a stitched seam down the back of the socket (desktop only): breaks up the plain leather like the v5 outfits' seams
    ib = nu // 2; sc = pal.get('seam') or pal['band']; col = Gc[ib, 1:-1]; nrm = col - np.array([c[0], c[1], 0]) * np.array([1, 1, 0]); nrm[:, 2] = 0
    nrm /= np.linalg.norm(nrm, axis=1)[:, None]; parts.append(tube(col + nrm * 0.0012, 0.0024, lin(sc), 5, outline=False))
  if pal.get('gem'):   # a gem on the sleeve front at the knee (the gilded peg's ruby, was on its old cup)
    j = int(np.argmin([abs(z - F['knee'][2]) for z in ZS])); r = Rs[0, j] + F['gap'] + 0.004
    parts.append(ellipsoid([c[0], c[1] - r, F['knee'][2]], [0.016, 0.009, 0.02], lin(pal['gem']), seg(10), seg(6), e=0.6))
  return parts
def grain(P, axis_pts, base, dark, k=7, amp=1.0, seed=0.0):   # [Raul items redo] wood grain: streaks running down the (vertical) shaft, per vertex colour
  V = P.V; c = np.asarray(axis_pts)[0]; z = V[:, 2]
  a = np.arctan2(V[:, 1] - c[1], V[:, 0] - c[0]); w = 0.5 + 0.5 * np.sin(a * k + np.sin(z * 37 + seed) * 1.3 + seed)
  w = np.clip(w ** 3 * amp, 0, 1); P.C = np.asarray(base)[None] * (1 - w[:, None]) + np.asarray(dark)[None] * w[:, None]; return P
def shaft_parts(F, res=1.0, wood='#b9824a', ring='#6e4526', iron='#8d939a'):
  # [Raul items redo] peg polish: a lathe-turned oak peg -- iron-banded collar into the socket, a full upper turning, a tapered waist with two
  # carved grooves, an iron ferrule and a rubbed foot; wood grain streaks in the vertex colours (no textures: phone-light)
  seg = lambda n: max(6, int(round(n * res))); K = np.array(F['knee']); T0 = np.array([K[0], K[1], F['shaft_top']]); TIP = np.array(F['tip'])
  L = T0[2] - TIP[2]; at = lambda u: T0 + (TIP - T0) * u
  U = np.array([0, 0.06, 0.16, 0.3, 0.45, 0.62, 0.78, 0.86]) if res >= 1 else np.array([0, 0.16, 0.45, 0.78, 0.86])
  Rr = np.interp(U, [0, 0.06, 0.16, 0.3, 0.45, 0.62, 0.78, 0.86], [0.03, 0.033, 0.034, 0.03, 0.026, 0.023, 0.0215, 0.022])
  P = [at(u) for u in U]; W, WD = lin(wood), lin('#7d5530')
  parts = [grain(tube(P, Rr, W, seg(12)), P, W, WD)]
  for u in ((0.28, 0.5) if res >= 1 else (0.3,)): parts.append(torus(at(u), float(np.interp(u, U, Rr)) + 0.0005, 0.0042, [0, 0, 1], lin(ring), seg(16), seg(5)))   # carved grooves (dark rings)
  parts.append(torus(at(0.03), 0.032, 0.005, [0, 0, 1], lin(iron), seg(16), seg(5)))   # iron band at the socket
  parts.append(tube([at(0.84), TIP + np.array([0, 0, 0.006])], [0.0235, 0.0225], lin(iron), seg(14)))   # iron ferrule
  parts.append(torus(at(0.85), 0.0238, 0.0032, [0, 0, 1], lin('#6c7278'), seg(14), seg(4), outline=False))
  parts.append(ellipsoid(TIP + np.array([0, 0, 0.0055]), [0.0228, 0.0228, 0.0055], lin('#4d5258'), seg(14), seg(4)))           # rubbed foot
  return parts
def to_blender(b, m, name, weights):
  me = bpy.data.meshes.new(name); me.from_pydata(m.V.tolist(), [], m.F.tolist()); me.update()
  for p_ in me.polygons: p_.use_smooth = True
  ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.hstack([m.C, np.ones((len(m.C), 1))]).astype(np.float32).ravel()); me.color_attributes.active_color = ca
  mat = bpy.data.materials.new(name); mat.use_nodes = True; nt = mat.node_tree; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
  nt.links.new(vc.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(mat)
  ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
  ob.parent = b.arm; md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = b.arm
  G = {}
  for i, w in enumerate(weights):
    for bn, x in w.items():
      if bn not in G: G[bn] = ob.vertex_groups.new(name=bn)
      G[bn].add([i], x, 'REPLACE')
  return ob
def export(b, ob, fn, extras=False):
  for o in list(bpy.data.objects):
    if o not in (ob, b.arm): bpy.data.objects.remove(o)
  bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); b.arm.select_set(True)
  os.makedirs(os.path.dirname(fn), exist_ok=True)
  bpy.ops.export_scene.gltf(filepath=fn, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_yup=True, export_vertex_color='ACTIVE', export_attributes=False, export_materials='EXPORT', export_extras=extras)
def save_fit(F, who, lod):
  os.makedirs(FITDIR, exist_ok=True); json.dump(F, open(f'{FITDIR}/peg_fit_{F["side"]}_{who}_{lod}.json', 'w'), indent=1)
def build(b, F, parts_sleeve, parts_rest, ink):
  # merged mesh + per-vertex rigid flag (sleeve = copied pant weights, rest = shin); ink shells keep their source part's flag
  allp = []; flags = []
  for grp, rig in ((parts_sleeve, False), (parts_rest, True)):
    for p in grp:
      allp.append(p); flags.append(rig)
  out = []; fl = []
  for p, rig in zip(allp, flags):
    out.append(p); fl += [rig] * len(p.V)
    if p.outline and ink > 0:
      N = weld_normals(p.V, p.F); out.append(Part(p.V + N * ink, p.F[:, [0, 2, 1]], INK, False)); fl += [rig] * len(p.V)
  m = merge(out); assert np.isfinite(m.V).all(), 'NaN verts'; return m, np.array(fl)
def lowlight(m, keep=()):   # keep: colours left full bright (glow trims)
  L = np.array([0.35, -0.5, 0.8]); L /= np.linalg.norm(L); N = weld_normals(m.V, m.F); s = 0.58 + 0.42 * np.clip(N @ L, 0, None) + 0.08 * np.clip(N[:, 2], 0, None)
  ink = np.abs(m.C - np.array(INK)).sum(1) < 1e-4
  for k in keep: ink |= np.abs(m.C - np.array(k)).sum(1) < 1e-4
  m.C = np.where(ink[:, None], m.C, m.C * s[:, None]); return m
