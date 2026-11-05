# [v277 polish2 female] BANKSY 1:28-1:31 PM fine-tune (Raul lane = female only): braid/back gaps, crotch flaps,
# collar/shoulders, chest/skin albedo, underwear hems, soft eye-decal cleanup. Male GLBs untouched (Emerly). Shoes = Timothy.
# [v277 shoulders + underwear] BANKSY 12:40-12:43 PM. Post pass on SPLICED V6 GLB:
# blender -b -noaudio -P garments.py -- IN.glb OUT.glb
# Female polish2 extras (FEM only):
#  - V5 hair thickened + gap-closed on the back/braid so white shorts don't peek through strand gaps
#  - collar/shoulder V6 skin laplacian + shard drop; bandeau + shorts hem flaps ironed (crotch + top)
#  - V6 atlas chest/skin blotches flattened; cloth flat white; soft cleanup on v5_face_eyes alpha edge
# Male tattoo / male neck code = unchanged from live v276 garments.
# V5 head mesh / face / hair topology kept; rig, clips, extras, limbs untouched.
import bpy, bmesh, sys, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, '/workspace/raul_items_redo_work/py311')
import paint
from scipy import ndimage
IN, OUT = sys.argv[sys.argv.index('--') + 1:][:2]
E_ = lambda k, d: type(d)(os.environ.get(k, d))
FEM = 'female' in os.path.basename(IN); LO = '_lo' in os.path.basename(IN)
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=IN)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; arm.data.pose_position = 'REST'
body = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('v6')][0]; me = body.data
dec = [o for o in bpy.data.objects if o.name.startswith('v5_face_eyes')][0]
mat = me.materials[0]; img = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'][0].image
W, H = img.size; HALF = 0.49
ZHEAD = float((arm.matrix_world @ arm.data.bones['head'].head_local).z)
# hems (rest pose, metres, z up, front = -y); tuned on the v276 paint extents
if FEM:
  SH = dict(lo=E_('FLEG', 0.452), slope=E_('FSLOPE', 0.12), hi=E_('FWAIST', 0.597), crotch=E_('FCROTCH', 0.04), cw=E_('FCROTCHW', 0.075))
  TOP = dict(lo=E_('FTOPLO', 0.662), hi=E_('FTOPHI', 0.800), x=E_('FTOPX', 0.215))
else:
  SH = dict(lo=E_('MLEG', 0.318), slope=E_('MSLOPE', 0.0), hi=E_('MWAIST', 0.548)); TOP = None
print('in', IN, 'fem', FEM, 'lo', LO, 'img', (W, H), 'zhead', round(ZHEAD, 3), flush=True)

# ---- per-vertex: V6 (left atlas) flag, torso weight, original normal
nv = len(me.vertices); nl = len(me.loops)
LV = np.zeros(nl, int); me.loops.foreach_get('vertex_index', LV)
UV = np.zeros(nl * 2); me.uv_layers[0].data.foreach_get('uv', UV); UV = UV.reshape(-1, 2)
IS6 = np.zeros(nv, bool); IS6[LV[UV[:, 0] < HALF]] = True
T = np.zeros(nv); me.attributes['_TINT'].data.foreach_get('value', T); T = np.round(T).astype(int)
CN = np.array([l.normal[:] for l in me.loops]) if not hasattr(me, 'corner_normals') else np.array([c.vector[:] for c in me.corner_normals])
VN = np.zeros((nv, 3)); np.add.at(VN, LV, CN); VN /= np.maximum(np.linalg.norm(VN, axis=1), 1e-9)[:, None]
gi = {g.name: g.index for g in body.vertex_groups}; TORSO = {gi[k] for k in ('root', 'spine', 'tails', 'thigh.L', 'thigh.R') if k in gi}
WT = np.zeros(nv)
for v in me.vertices:
  s = sum(g.weight for g in v.groups); WT[v.index] = sum(g.weight for g in v.groups if g.group in TORSO) / s if s > 0 else 0
for nm, arr in (('g_is6', IS6.astype(float)), ('g_wt', WT)):
  a = me.attributes.new(nm, 'FLOAT', 'POINT'); a.data.foreach_set('value', arr)
a = me.attributes.new('g_on', 'FLOAT_VECTOR', 'POINT'); a.data.foreach_set('vector', VN.ravel())
CA = me.color_attributes['Color']; C0 = np.zeros(nl * 4); CA.data.foreach_get('color', C0); C0 = C0.reshape(-1, 4)
CMED = {k: np.median(C0[(T[LV] == k) & IS6[LV]], 0) for k in (-1, 0)}
print('class colours', {k: v.round(3) for k, v in CMED.items()}, flush=True)

# ---- albedo before (for skin / cloth medians)
A = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
FI0, _ = paint.raster(me, W, H)
FC0 = np.array([np.bincount(T[list(p.vertices)] + 1, minlength=3).argmax() - 1 for p in me.polygons])
F6_0 = np.array([IS6[list(p.vertices)].all() for p in me.polygons])
K0 = np.where(FI0 >= 0, FC0[np.maximum(FI0, 0)], -9); L0 = (FI0 >= 0) & F6_0[np.maximum(FI0, 0)]
SKIN = np.median(A[..., :3][L0 & (K0 == 0)], 0); CLOTH = np.median(A[..., :3][L0 & (K0 == -1)], 0)
print('albedo skin', SKIN.round(3), 'cloth', CLOTH.round(3), flush=True)

def field(co, wt):
  """>0 = underwear"""
  x, y, z = co
  zl = SH['lo'] - SH['slope'] * y
  if SH.get('crotch'):   # the gusset: the leg line dips between the legs (no bare crotch fold under the hem)
    t = min(1.0, abs(x) / SH['cw']); zl -= SH['crotch'] * (1 - t * t * (3 - 2 * t))
  f = min(z - zl, SH['hi'] - z)
  if TOP:
    ft = min(z - TOP['lo'], TOP['hi'] - z, TOP['x'] - abs(x))   # straight side seams under the arms
    f = max(f, ft)
  return f

bm = bmesh.new(); bm.from_mesh(me)
l6 = bm.verts.layers.float['g_is6']; lw = bm.verts.layers.float['g_wt']; lt = bm.verts.layers.float['_TINT']
dl = bm.verts.layers.deform.active; ul = bm.loops.layers.uv.active
# ---- 3) V5 hair pushed out of the V6 body
bv = bmesh.new(); bv.from_mesh(me); _l6 = bv.verts.layers.float['g_is6']; _lt = bv.verts.layers.float['_TINT']
bmesh.ops.delete(bv, geom=[f for f in bv.faces if not all(v[_l6] > 0.5 and round(v[_lt]) != 1 for v in f.verts)], context='FACES')
bvh = BVHTree.FromBMesh(bv); bv.free()
GAP = E_('GAP', 0.004 if LO else 0.003); DEEP = E_('DEEP', 0.03); ZH = ZHEAD + E_('HAIRZ', 0.0)
npush = 0; deep = set()
_gb = body.vertex_groups.get('braid'); _gi_braid = _gb.index if _gb is not None else None
BW = {}
if _gb is not None:
  for vv in me.vertices:
    for g in vv.groups:
      if g.group == _gb.index: BW[vv.index] = g.weight
def braid_w(v):
  if _gi_braid is None or dl is None: return 0.0
  try: return float(v[dl].get(_gi_braid, 0.0))
  except Exception: return BW.get(v.index, 0.0)
for v in bm.verts:
  if v[l6] > 0.5 or round(v[lt]) != 1 or v.co.z > ZH: continue
  loc, n, i, d = bvh.find_nearest(v.co, 0.08)
  if loc is None: continue
  r = Vector((loc.x, loc.y + 0.0, 0)) - Vector((0, 0, 0)) if abs(loc.x) < 0.2 else Vector((loc.x, 0, 0))
  r.z = 0
  if n.dot(Vector((loc.x, loc.y, 0))) < 0 and loc.z < ZHEAD - 0.06: n = -n   # inward-wound faces
  s = (v.co - loc).dot(n)
  if s < -DEEP: deep.add(v); continue
  # his V5 hair hidden by V5's own (bigger) shoulders / nape: off the beard (centre front) it is dropped, not pushed out on show
  # her V5 back-hair tips that V5's red top hid (lying on her lower back / shorts): dropped; the braid (braid bone) + free hair stay
  if FEM and v.co.z < E_('FHIDEZ', 0.62) and v.co.y > E_('FHIDEY', 0.04) and braid_w(v) < 0.35 and s < E_('FHIDE', 0.006): deep.add(v); continue  # polish2: keep more covering back-hair
  if not FEM and v.co.z < ZHEAD - E_('NAPEZ', 0.035) and (abs(v.co.x) > E_('BEARDX', 0.10) or v.co.y > 0) and s < E_('MHIDE', 0.012): deep.add(v); continue
  if s < GAP: v.co = loc + n * GAP + (v.co - loc - n * s) * 0.0; npush += 1
dead = [f for f in bm.faces if all(v in deep for v in f.verts)]
# the V5 neck 'skirt' that splice_v5heads.py snapped onto the V6 torso (V5 skin below the head, lying on the V6 surface): crumpled
# triangles (dark flipped shards round the back of the neck / shoulders) over V6 skin that is already there -> dropped
nsk = 0
if E_('SKIRT', 1):
  SKD = E_('SKD', 0.004)
  for f in bm.faces:
    if f in dead or not all(v[l6] < 0.5 and round(v[lt]) == 0 for v in f.verts): continue
    if f.calc_center_median().z > ZHEAD - E_('SKZ', 0.01): continue
    if all((lambda r: r[0] is not None and r[3] < SKD)(bvh.find_nearest(v.co, 0.05)) for v in f.verts): dead.append(f); nsk += 1
print('V5 neck skirt faces on the V6 torso dropped', nsk, flush=True)
# his V5 hair pieces that V5's own body hid: the nape tips on his upper back / shoulders and the dark 'hair' bits low on the
# V5 pants (fly marks on V6's shorts) -> dropped (his hair + beard above stay exact)
if not FEM:
  ndrop = 0
  for f in bm.faces:
    if f in dead or not all(v[l6] < 0.5 and round(v[lt]) == 1 for v in f.verts): continue
    c = f.calc_center_median()
    if c.z < E_('MHAIRZ', 0.60) or (c.z < ZHEAD - E_('NAPEZ', 0.035) and c.y > E_('NAPEY', 0.0)): dead.append(f); ndrop += 1
  print('his hidden V5 hair dropped', ndrop, flush=True)
bmesh.ops.delete(bm, geom=dead, context='FACES'); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
print('hair pushed out', npush, 'deep faces dropped', len(dead), flush=True)

# ---- polish2 FEM: safer hair gap-close (body-normal only — hair-face normals shred thin strands)
if FEM and E_('HAIRTHK', 1):
  bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
  HVS = [v for v in bm.verts if v[l6] < 0.5 and round(v[lt]) == 1 and v.co.z < ZH]
  from mathutils.kdtree import KDTree as _KD
  kd = _KD(len(HVS))
  for i, v in enumerate(HVS): kd.insert(v.co, i)
  kd.balance()
  GAP2 = E_('HAIRGAP', 0.0075 if not LO else 0.009); nth = 0; nlat = 0
  # 1) sit hair a clean gap outside the V6 body (body normal only)
  for v in HVS:
    loc, hn, i, d = bvh.find_nearest(v.co, 0.12)
    if loc is None or hn is None or hn.length < 1e-8: continue
    hn = hn.normalized()
    if hn.dot(v.co - loc) < 0: hn = -hn
    s = (v.co - loc).dot(hn)
    # braid core: smaller gap so braid stays tight; free strands: larger gap to hide underwear
    bw = braid_w(v); g = GAP2 * (0.70 + 0.55 * (1.0 - min(1.0, bw)))
    if s < g:
      tang = v.co - loc - hn * s
      v.co = loc + hn * g + tang; nth += 1
  # 2) lateral gap-close (2 passes): pull sparse neighbouring hair strands together (closes white peek)
  for _pass in range(E_('LATPASS', 1 if LO else 2)):
    kd2 = _KD(len(HVS))
    for i, v in enumerate(HVS): kd2.insert(v.co, i)
    kd2.balance()
    for v in HVS:
      if braid_w(v) > E_('BRAIDKEEP', 0.75): continue  # keep braid braid-shaped
      near = [(co, idx, dist) for (co, idx, dist) in kd2.find_n(v.co, 7) if dist > 1e-6]
      if len(near) < 2: continue
      dists = [dist for _,_,dist in near]
      if sorted(dists)[min(2, len(dists)-1)] > E_('LATR', 0.011):
        mean = sum((Vector(co) for co,_,_ in near[:4]), Vector((0,0,0))) / min(4, len(near))
        v.co = v.co.lerp(mean, E_('LATA', 0.28 if LO else 0.42)); nlat += 1
  # 3) very mild laplacian on free strands only (messy tips) — 2 iters
  HIT_H = E_('HAIRSIT', 2)
  hv = [v for v in HVS if braid_w(v) < E_('BRAIDKEEP', 0.70)]
  for it in range(HIT_H):
    M = {}
    for v in hv:
      nbr = [e.other_vert(v) for e in v.link_edges if round(e.other_vert(v)[lt]) == 1]
      if nbr: M[v] = sum((u.co for u in nbr), Vector((0, 0, 0))) / len(nbr)
    for v, m in M.items(): v.co = v.co.lerp(m, E_('HAIRSMA', 0.22))
  # 2b) front-braid fill: free hair hanging over the chest/shoulder (y front = -Y) pulled toward braid core
  braid_pts = [v.co.copy() for v in HVS if braid_w(v) >= 0.5]
  nfront = 0
  if braid_pts:
    kd_b = _KD(len(braid_pts))
    for i, co in enumerate(braid_pts): kd_b.insert(co, i)
    kd_b.balance()
    for v in HVS:
      if braid_w(v) >= 0.45: continue
      if v.co.y > E_('FRONTY', 0.02): continue  # back hair already handled
      if v.co.z > E_('FRONTZ', 0.92): continue
      co, idx, dist = kd_b.find(v.co)
      if dist < E_('FRONTD', 0.055) and dist > 1e-6:
        v.co = v.co.lerp(Vector(co), E_('FRONTA', 0.12 if LO else 0.22)); nfront += 1
  print('hair body-gap', nth, 'lateral-close', nlat, 'front-braid', nfront, 'smooth iters', HIT_H, flush=True)

if FEM and E_('COLLARSM', 1):
  # V6 skin collar / shoulders: Taubin-ish smooth (no shrink spikes); skip verts that neighbour hair
  bm.verts.ensure_lookup_table()
  z0 = ZHEAD - E_('COLZ0', 0.12); z1 = ZHEAD + E_('COLZ1', 0.01)
  cv = []
  for v in bm.verts:
    if not (v[l6] > 0.5 and round(v[lt]) == 0 and z0 <= v.co.z <= z1): continue
    if any(round(e.other_vert(v)[lt]) == 1 for e in v.link_edges): continue  # keep skin/hair boundary crisp
    cv.append(v)
  for it in range(E_('COLIT', 6 if not LO else 8)):
    M = {}
    for v in cv:
      nbr = [e.other_vert(v) for e in v.link_edges if e.other_vert(v)[l6] > 0.5 and round(e.other_vert(v)[lt]) == 0]
      if len(nbr) >= 3: M[v] = sum((u.co for u in nbr), Vector((0, 0, 0))) / len(nbr)
    # Taubin: inflate then deflate
    a_inf, a_def = E_('COLA', 0.33), E_('COLA', 0.33) + 0.02
    for v, m in M.items(): v.co = v.co + (m - v.co) * a_inf
    M = {}
    for v in cv:
      nbr = [e.other_vert(v) for e in v.link_edges if e.other_vert(v)[l6] > 0.5 and round(e.other_vert(v)[lt]) == 0]
      if len(nbr) >= 3: M[v] = sum((u.co for u in nbr), Vector((0, 0, 0))) / len(nbr)
    for v, m in M.items(): v.co = v.co + (m - v.co) * (-a_def)
  print('female collar smoothed verts', len(cv), flush=True)

# ---- 1) underwear re-cut (V6 non-hair faces only)
bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table()
# frayed V6 hem flaps (thin spikes of the old shorts / top hem) in a band round the new hems: welded Laplacian smoothing
HB = E_('HEMBAND', 0.028 if FEM else 0.022); HIT = E_('HEMIT', 12 if FEM else 8)
if HB > 0 and HIT > 0:
  vs6 = [v for v in bm.verts if v[l6] > 0.5 and round(v[lt]) != 1]
  key = {}; wid = {}
  for v in vs6: wid[v] = key.setdefault(tuple(np.round(np.array(v.co[:]) / 1e-5).astype(np.int64)), len(key))
  nw = len(key); Q = np.zeros((nw, 3)); cnt = np.zeros(nw)
  for v in vs6: Q[wid[v]] = v.co[:]
  band = np.zeros(nw, bool)
  for v in vs6: band[wid[v]] = abs(field(v.co, v[lw])) < HB
  E = {(min(wid[a], wid[b]), max(wid[a], wid[b])) for e in bm.edges for a, b in [e.verts] if a in wid and b in wid and wid[a] != wid[b]}
  E = np.array(sorted(E)); np.add.at(cnt, E[:, 0], 1); np.add.at(cnt, E[:, 1], 1)
  Q0 = Q.copy()
  for it in range(HIT):
    M = np.zeros_like(Q); np.add.at(M, E[:, 0], Q[E[:, 1]]); np.add.at(M, E[:, 1], Q[E[:, 0]]); M /= np.maximum(cnt, 1)[:, None]
    Q = np.where(band[:, None], 0.5 * Q + 0.5 * M, Q)
  # de-spike the torso / hips (thin frayed flaps sticking out of the hems, crotch, shoulder tops): a vertex far from its
  # neighbours' mean goes to it (iterated); smooth surface is untouched
  SPK = E_('SPIKE', (0.006 if LO else 0.0035) if FEM else (0.008 if LO else 0.0045))
  reg = (Q[:, 2] > E_('SPKZ0', 0.30)) & (Q[:, 2] < ZHEAD - 0.01) & (np.abs(Q[:, 0]) < E_('SPKX', 0.24))
  nsp = np.zeros(nw, bool)
  for it in range(E_('SPKIT', 12)):
    M = np.zeros_like(Q); np.add.at(M, E[:, 0], Q[E[:, 1]]); np.add.at(M, E[:, 1], Q[E[:, 0]]); M /= np.maximum(cnt, 1)[:, None]
    sp = reg & (np.linalg.norm(Q - M, axis=1) > SPK) & (cnt > 0); nsp |= sp
    Q = np.where(sp[:, None], M, Q)
  for v in vs6:
    if band[wid[v]] or nsp[wid[v]]: v.co = Vector(Q[wid[v]])
  print('hem band smoothed verts', int(band.sum()), 'spike verts', int(nsp.sum()), flush=True)
  # polish2 FEM: crotch gusset + bandeau hem flaps — aggressive iron
  if FEM and E_('CROTCHFIX', 1):
    cw = SH.get('cw', 0.075); zl0 = SH['lo']
    band2 = np.zeros(nw, bool)
    for v in vs6:
      x, y, z = v.co; f = abs(field(v.co, v[lw]))
      crotch = abs(x) < cw * E_('CROTCHX', 1.7) and z < zl0 + E_('CROTCHZ', 0.06) and z > zl0 - E_('CROTCHZLO', 0.09) and f < E_('CROTCHB', 0.04)
      tophem = TOP and (abs(z - TOP['lo']) < 0.028 or abs(z - TOP['hi']) < 0.028) and abs(x) < TOP['x'] + 0.02 and f < 0.03
      if crotch or tophem: band2[wid[v]] = True
    SPK2 = E_('SPIKE2', 0.0028 if LO else 0.0022)
    nsp2 = np.zeros(nw, bool); Q2 = Q.copy()
    for it in range(E_('SPKIT2', 22)):
      M = np.zeros_like(Q2); np.add.at(M, E[:, 0], Q2[E[:, 1]]); np.add.at(M, E[:, 1], Q2[E[:, 0]]); M /= np.maximum(cnt, 1)[:, None]
      sp = band2 & (np.linalg.norm(Q2 - M, axis=1) > SPK2) & (cnt > 0); nsp2 |= sp
      Q2 = np.where(sp[:, None], M, Q2)
      Q2 = np.where(band2[:, None], 0.50 * Q2 + 0.50 * M, Q2)
    for v in vs6:
      if band2[wid[v]]: v.co = Vector(Q2[wid[v]])
    print('fem hem-flap band verts', int(band2.sum()), 'spikes', int(nsp2.sum()), flush=True)
  # tiny loose V6 shards (1..20-face islands: the jagged bits on her shoulder tops) -> dropped
  par = list(range(nw))
  def fd(a):
    while par[a] != a: par[a] = par[par[a]]; a = par[a]
    return a
  for a_, b_ in E: par[fd(a_)] = fd(b_)
  fcomp = {}
  f6 = [f for f in bm.faces if all(v in wid for v in f.verts)]
  for f in f6: fcomp.setdefault(fd(wid[f.verts[0]]), []).append(f)
  small = [f for c in fcomp.values() if len(c) < E_('MINISL', 20) for f in c]
  bmesh.ops.delete(bm, geom=small, context='FACES'); bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
  bm.verts.ensure_lookup_table(); bm.edges.ensure_lookup_table()
  print('loose V6 shard faces dropped', len(small), flush=True)
FV = {v: field(v.co, v[lw]) for v in bm.verts}
cuts = []
for e in bm.edges:
  a, b = e.verts
  if not all(x[l6] > 0.5 and round(x[lt]) != 1 for x in (a, b)): continue
  fa, fb = FV[a], FV[b]
  if (fa > 0) == (fb > 0) or abs(fa - fb) < 1e-9: continue
  t = fa / (fa - fb)
  if t < 0.03 or t > 0.97:   # snap the near vertex onto the hem instead of a sliver
    w = a if t < 0.5 else b; FV[w] = 0.0; continue
  cuts.append((e, a, b, t))
newv = set()
for e, a, b, t in cuts:
  ne, x = bmesh.utils.edge_split(e, a, t); x.co = a.co.lerp(b.co, t)
  if dl is not None:
    da, db = a[dl], b[dl]; g = set(da.keys()) | set(db.keys()); x[dl].clear()
    for k in g: x[dl][k] = (1 - t) * da.get(k, 0.0) + t * db.get(k, 0.0)
  for L in x.link_loops:
    lp, lx = L.link_loop_prev, L.link_loop_next
    la, lb = (lp, lx) if lp.vert is a else (lx, lp)
    if la.vert is not a or lb.vert is not b: continue
    L[ul].uv = la[ul].uv.lerp(lb[ul].uv, t)
  FV[x] = 0.0; newv.add(x)
ns = 0
for f in list(bm.faces):
  nn = [v for v in f.verts if v in newv]
  if len(nn) == 2 and not any(nn[1] in e.verts for e in nn[0].link_edges):
    try: bmesh.utils.face_split(f, nn[0], nn[1]); ns += 1
    except Exception: pass
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
print('hem edges cut', len(cuts), 'faces split', ns, flush=True)
fl = bm.faces.layers.int.new('cls'); bm.faces.ensure_lookup_table()
for f in bm.faces:
  if all(v[l6] > 0.5 for v in f.verts) and not all(round(v[lt]) == 1 for v in f.verts):
    m = sum(FV.get(v, field(v.co, v[lw])) for v in f.verts) / len(f.verts)
    f[fl] = -1 if m > 0 else 0
  else: f[fl] = 9   # V5 head / hair: untouched
# small class islands (a few white flap triangles on the thigh / skin crumbs in the hem) -> the class around them (welded)
bm.faces.ensure_lookup_table()
_k = {}; _w = {v: _k.setdefault(tuple(np.round(np.array(v.co[:]) / 1e-5).astype(np.int64)), len(_k)) for v in bm.verts}
_vf = {}
for f in bm.faces:
  if f[fl] in (-1, 0):
    for v in f.verts: _vf.setdefault(_w[v], []).append(f)
NIS = E_('CLSISL', 10 if LO else (28 if FEM else 14)); seen = set(); nfl = 0  # polish2 fem: flip tiny white flap islands
for f0 in bm.faces:
  if f0[fl] not in (-1, 0) or f0 in seen: continue
  k = f0[fl]; comp = [f0]; seen.add(f0); st = [f0]
  while st:
    g = st.pop()
    for v in g.verts:
      for h in _vf[_w[v]]:
        if h not in seen and h[fl] == k: seen.add(h); comp.append(h); st.append(h)
  if len(comp) < NIS:
    for g in comp: g[fl] = 0 if k == -1 else -1
    nfl += len(comp)
print('class island faces flipped', nfl, flush=True)
edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.link_faces[0][fl] != e.link_faces[1][fl]]
bmesh.ops.split_edges(bm, edges=edges)
for f in bm.faces:
  if f[fl] in (-1, 0):
    for v in f.verts: v[lt] = float(f[fl])
# polish2 FEM safety: no cloth class below the shorts (stray foot/leg verts → skin; kills origin-ish spikes)
if FEM:
  zmin_c = SH['lo'] - E_('CLOTHZMIN', 0.08)
  nfix = 0
  for f in bm.faces:
    if f[fl] != -1: continue
    if min(v.co.z for v in f.verts) < zmin_c:
      f[fl] = 0; nfix += 1
      for v in f.verts: v[lt] = 0.0
  # also any lone cloth vert below the band
  for v in bm.verts:
    if round(v[lt]) == -1 and v.co.z < zmin_c:
      v[lt] = 0.0; nfix += 1
  print('low cloth reclassed', nfix, 'zmin', round(zmin_c, 3), flush=True)
bm.verts.index_update(); bm.faces.index_update()
# polish2: kill origin-spike verts / zero-area faces (stretch into black shards in-game)
bad_v = [v for v in bm.verts if (not v.link_faces) or (Vector(v.co).length < 1e-5)]
if bad_v:
  bmesh.ops.delete(bm, geom=bad_v, context='VERTS'); print('origin/loose verts dropped', len(bad_v), flush=True)
bad_f = [f for f in bm.faces if f.calc_area() < 1e-10]
if bad_f:
  bmesh.ops.delete(bm, geom=bad_f, context='FACES'); print('zero-area faces dropped', len(bad_f), flush=True)
bm.verts.index_update(); bm.faces.index_update(); bm.faces.ensure_lookup_table()
FCL = np.array([f[fl] for f in bm.faces]); bm.faces.layers.int.remove(fl)
bm.to_mesh(me); bm.free(); me.update()
# safety: any remaining origin verts on the mesh (shouldn't) → snap to nearest same-tint neighbour
Psafe = np.zeros(len(me.vertices) * 3); me.vertices.foreach_get('co', Psafe); Psafe = Psafe.reshape(-1, 3)
Tsafe = np.zeros(len(me.vertices)); me.attributes['_TINT'].data.foreach_get('value', Tsafe); Tsafe = np.round(Tsafe).astype(int)
orig = np.linalg.norm(Psafe, axis=1) < 1e-5
if orig.any():
  from scipy.spatial import cKDTree
  for k in (-1, 0, 1):
    good = (~orig) & (Tsafe == k)
    bad = orig & (Tsafe == k)
    if bad.any() and good.any():
      kd = cKDTree(Psafe[good]); _, nn = kd.query(Psafe[bad], k=1)
      Psafe[bad] = Psafe[good][nn]
  me.vertices.foreach_set('co', Psafe.ravel()); me.update()
  print('mesh origin verts snapped', int(orig.sum()), flush=True)
print('classes', dict(zip(*np.unique(FCL, return_counts=True))), flush=True)

# ---- tints + colours + normals
nv = len(me.vertices); nl = len(me.loops)
T2 = np.zeros(nv); me.attributes['_TINT'].data.foreach_get('value', T2); T2 = np.round(T2).astype(int)
IS6 = np.zeros(nv); me.attributes['g_is6'].data.foreach_get('value', IS6); IS6 = IS6 > 0.5
LV = np.zeros(nl, int); me.loops.foreach_get('vertex_index', LV)
C = np.zeros(nl * 4); me.color_attributes['Color'].data.foreach_get('color', C); C = C.reshape(-1, 4)
for k in (-1, 0):
  m = IS6[LV] & (T2[LV] == k); C[m] = CMED[k]
me.color_attributes['Color'].data.foreach_set('color', C.ravel())
ON = np.zeros(nv * 3); me.attributes['g_on'].data.foreach_get('vector', ON); ON = ON.reshape(-1, 3)
PP = np.zeros(nv * 3); me.vertices.foreach_get('co', PP); PP = PP.reshape(-1, 3)
key = np.round(PP / 1e-5).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
FNo = np.array([p.normal[:] for p in me.polygons]); FA = np.array([p.area for p in me.polygons])
NW = np.zeros((inv.max() + 1, 3))
for p in me.polygons:
  if FCL[p.index] in (-1, 0):
    for vi in p.vertices: NW[inv[vi]] += FNo[p.index] * FA[p.index]
NV6 = NW[inv]; ok = np.linalg.norm(NV6, axis=1) > 1e-12
NF = np.where((IS6 & ok)[:, None], NV6, ON); NF /= np.maximum(np.linalg.norm(NF, axis=1), 1e-9)[:, None]
me.normals_split_custom_set_from_vertices([tuple(x) for x in NF])
for nm in ('g_is6', 'g_wt', 'g_on'): me.attributes.remove(me.attributes[nm])

# ---- 2) albedo
FI1, P3 = paint.raster(me, W, H); has = FI1 >= 0
K1 = np.where(has, FCL[np.maximum(FI1, 0)], -9)
cl = K1 == -1; sk = K1 == 0
A[..., :3][cl] = CLOTH
if SH:   # waistband line
  zb = SH['hi'] - E_('BANDZ', 0.016); band = cl & (np.abs(P3[..., 2] - zb) < E_('BANDW', 0.0016 if not LO else 0.0024))
  A[..., :3][band] = CLOTH * E_('BANDK', 0.84)
d = np.linalg.norm(A[..., :3] - SKIN, axis=2)
fix = sk & ((K0 != 0) | ((d > E_('SKOUT', 0.12 if FEM else 0.16)) & (P3[..., 2] > 0.09)))
A[..., :3][fix] = SKIN
# polish2 FEM: flatten chest / midriff / shoulder skin blotches (teal, dark spikes) to median skin
if FEM:
  chest = sk & (P3[..., 2] > E_('CHZ0', 0.55)) & (P3[..., 2] < E_('CHZ1', 0.86)) & (np.abs(P3[..., 0]) < E_('CHX', 0.22))
  blot = chest & (d > E_('CHOUT', 0.06))
  A[..., :3][blot] = SKIN; fix = fix | blot
  # cloth crumbs on skin next to bandeau / shorts
  near_cloth = sk & (ndimage.binary_dilation(cl, iterations=1)) & (d > 0.07)
  A[..., :3][near_cloth] = SKIN; fix = fix | near_cloth
print('texels: cloth', int(cl.sum()), 'skin fixed', int(fix.sum()), flush=True)
# dilate the left half's classes into uncovered texels (mip bleed)
cov = has & (K1 != 9); left = np.zeros((H, W), bool); left[:, :int(W * HALF)] = True
_, (iy, ix) = ndimage.distance_transform_edt(~cov, return_indices=True)
dd = ndimage.distance_transform_edt(~cov); pad = (~has) & left & (dd <= 4) & (dd > 0)
A[..., :3][pad] = A[iy[pad], ix[pad], :3]
img.pixels.foreach_set(A.ravel()); img.update()

# ---- 4) his pill tattoo
if not FEM and E_('TAT', 1):
  for o in [o for o in bpy.data.objects if o.name.startswith('v5_tattoo')]: bpy.data.objects.remove(o)
  dg = bpy.context.evaluated_depsgraph_get(); bvb = BVHTree.FromObject(body, dg)
  CX, CZ = E_('TATX', -0.262), E_('TATZ', 0.0); L, Hh = E_('TATL', 0.066), E_('TATH', 0.046)
  # his right upper arm: front surface, centre height of the arm at CX
  P = np.array([v.co[:] for v in me.vertices]); am = (np.abs(P[:, 0] - CX) < 0.01) & IS6 & (P[:, 2] > 0.6)
  zc = 0.5 * (P[am, 2].min() + P[am, 2].max()) + CZ; print('tattoo arm z', round(float(P[am, 2].min()), 3), round(float(P[am, 2].max()), 3), flush=True)
  yc = 0.5 * (P[am, 1].min() + P[am, 1].max()); a_ = np.radians(E_('TATDIR', -10.0))   # 0 = straight from the front, 90 = from above (= his outer arm when it hangs)
  RD = Vector((0, np.cos(a_), -np.sin(a_))); PD = Vector((0, np.sin(a_), np.cos(a_)))
  NX, NZ = (14, 10) if not LO else (8, 6)
  vs = []; uvs = []
  for j in range(NZ + 1):
    for i in range(NX + 1):
      u, w = i / NX, j / NZ
      g = Vector((CX + (u - 0.5) * L, yc, zc)) + PD * ((w - 0.5) * Hh)
      hit = bvb.ray_cast(g - RD * 0.5, RD, 1.0)
      loc, n = hit[0], hit[1]
      if n.dot(RD) > 0: n = -n
      vs.append(loc + n * 0.0012); uvs.append((u, w))
  tm = bpy.data.meshes.new('v5_tattoo'); fs = [(j * (NX + 1) + i, j * (NX + 1) + i + 1, (j + 1) * (NX + 1) + i + 1, (j + 1) * (NX + 1) + i) for j in range(NZ) for i in range(NX)]
  tm.from_pydata([tuple(v) for v in vs], [], fs); tm.update()
  uvl = tm.uv_layers.new(name='UVMap')
  for p in tm.polygons:
    for li in p.loop_indices: uvl.data[li].uv = uvs[tm.loops[li].vertex_index]
  for p in tm.polygons: p.use_smooth = True
  to = bpy.data.objects.new('v5_tattoo', tm); bpy.context.scene.collection.objects.link(to); to.parent = arm
  # BANKSY NFT/sketch pill: mint upper half, white lower half; NO opaque backing.
  # A PNG + glTF MASK keeps alpha intact in both GLTFLoader and toon alphaTest.
  TW, TH = (512, 348) if not LO else (256, 174)
  yy, xx = np.mgrid[0:TH, 0:TW].astype(np.float32); X = (xx + 0.5) / TW * L - L / 2; Y = (yy + 0.5) / TH * Hh - Hh / 2
  ang = np.radians(E_('TATANG', 48.0)); ca_, sa = np.cos(ang), np.sin(ang); U = X * ca_ + Y * sa; V = -X * sa + Y * ca_
  R = E_('TATR', 0.0105); HL = E_('TATHL', 0.0140); OL = R * 0.10
  Uc = np.clip(U, -HL, HL); dist = np.sqrt((U - Uc) ** 2 + V ** 2)
  RGBA = np.zeros((TH, TW, 4), np.float32)
  ink = np.array([0.19, 0.25, 0.23]); grn = np.array([0.25, 0.69, 0.60]); wht = np.array([0.98, 0.98, 0.95])
  inside = dist < R - OL; edge = (dist < R) & ~inside
  RGBA[inside, :3] = np.where((U[inside] > 0)[:, None], grn, wht)
  RGBA[edge, :3] = ink; div = inside & (np.abs(U) < OL * 0.5); RGBA[div, :3] = ink
  # Strictly zero outside the capsule (including corners); no invented gloss stripe.
  RGBA[..., 3] = (dist < R).astype(np.float32)
  im = bpy.data.images.new('pill_tattoo', TW, TH, alpha=True); im.alpha_mode = 'STRAIGHT'
  im.pixels.foreach_set(RGBA.ravel()); im.update(); im.file_format = 'PNG'; im.pack()
  tmat = bpy.data.materials.new('skull.tattoo'); tmat.use_nodes = True; nt = tmat.node_tree; bs = nt.nodes['Principled BSDF']
  tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = im; tx.extension = 'CLIP'
  nt.links.new(tx.outputs['Color'], bs.inputs['Base Color'])
  cut = nt.nodes.new('ShaderNodeMath'); cut.operation = 'GREATER_THAN'; cut.inputs[1].default_value = 0.5
  nt.links.new(tx.outputs['Alpha'], cut.inputs[0]); nt.links.new(cut.outputs[0], bs.inputs['Alpha'])
  bs.inputs['Roughness'].default_value = 0.8; tmat.blend_method = 'CLIP'; tmat.alpha_threshold = 0.5
  tm.materials.append(tmat)
  for vg in body.vertex_groups: to.vertex_groups.new(name=vg.name)
  dt = to.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = body; dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}
  dt.vert_mapping = 'NEAREST'; dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
  bpy.ops.object.select_all(action='DESELECT'); to.select_set(True); bpy.context.view_layer.objects.active = to; bpy.ops.object.modifier_apply(modifier='dt')
  to.modifiers.new('Armature', 'ARMATURE').object = arm
  print('tattoo verts', len(tm.vertices), flush=True)

# ---- polish2 FEM: soft-clean v5_face_eyes alpha fringe (keep V5 art, just less jagged lids)
if FEM and E_('EYEFIX', 1):
  try:
    em = dec.data.materials[0]; eimg = [n for n in em.node_tree.nodes if n.type == 'TEX_IMAGE'][0].image
    EA = np.array(eimg.pixels[:], dtype=np.float32).reshape(eimg.size[1], eimg.size[0], 4)
    a = EA[..., 3]
    # V5 eyes are hard-cut alpha: build a 1px morphological fringe and gaussian-soften only there
    hard = a > 0.5
    dil = ndimage.binary_dilation(hard, iterations=E_('EYEDIT', 1))
    ero = ndimage.binary_erosion(hard, iterations=E_('EYEDIT', 1))
    fringe = dil ^ ero
    soft = ndimage.gaussian_filter(a.astype(np.float32), E_('EYEBLUR', 0.85 if not LO else 0.65))
    EA[..., 3] = np.where(fringe, soft, a)
    # slightly darken soft fringe RGB so jagged bright lid sparks calm down
    EA[..., :3] = np.where(fringe[..., None], EA[..., :3] * 0.92, EA[..., :3])
    eimg.pixels.foreach_set(EA.ravel()); eimg.update(); print('eye decal fringe softened', int(fringe.sum()), flush=True)
  except Exception as e:
    print('eye fix skipped', e, flush=True)

arm.data.pose_position = 'POSE'
me.color_attributes.active_color = me.color_attributes['Color']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_attributes=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
  export_animations=True, export_animation_mode='ACTIONS', export_skins=True, export_image_format='WEBP', export_image_quality=80 if LO else 90,
  export_draco_mesh_compression_enable=True, export_def_bones=False, export_yup=True, export_extras=True)
print('exported', OUT, 'tris', sum(len(p.vertices) - 2 for p in me.polygons), flush=True)
