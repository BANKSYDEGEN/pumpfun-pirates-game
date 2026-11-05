# [V6 quality 3] post pass on a built V6 body GLB (rig.py output): blender -b -P post.py -- IN.glb OUT.glb
# 1) smooth class borders: per-vertex class field (skin / hair / white cloth) Laplacian-smoothed over the welded surface, the mesh CUT
#    along the field's iso-line (edges split at the crossing, faces split) -> curved skin | underwear | hair borders, not triangle stair-steps;
#    skin shards in the hair / hair shards on the skin narrower than the smoothing go with it.
# 2) flat clean face: the face-front normals (nose / mouth / cheeks) blended to a heavily smoothed normal field (V5's flat toon face),
#    shape unchanged (v5 items keep fitting).
# 3) texels whose class changed get that class's flat albedo. Rig, weights, clips, extras, decal: untouched.
import bpy, bmesh, sys, os, numpy as np, mathutils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); sys.path.insert(0, '/workspace/raul_items_redo_work/py311')
import paint
IN, OUT = sys.argv[sys.argv.index('--') + 1:][:2]
E_ = lambda k, d: type(d)(os.environ.get(k, d))
bpy.ops.wm.read_factory_settings(use_empty=True); bpy.ops.import_scene.gltf(filepath=IN)
body = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('v6')][0]; dec = bpy.data.objects['v5_face_eyes']; me = body.data
FEM = 'female' in os.path.basename(IN); LO = '_lo' in os.path.basename(IN)
mat = me.materials[0]; mat.name = mat.name.split('.')[0]
img = [n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE'][0].image
CL = np.array([-1, 0, 1])
# face centre / eye spacing from the decal's iris texels (as paint.decal_face, read-only)
dimg = [n for n in dec.data.materials[0].node_tree.nodes if n.type == 'TEX_IMAGE'][0].image
W, H = dimg.size; A = np.array(dimg.pixels[:], dtype=np.float32).reshape(H, W, 4); FI, P3 = paint.raster(dec.data, W, H)
blue = (FI >= 0) & (A[..., 3] > 0.5) & (A[..., 2] > A[..., 0] + 0.15) & (A[..., 2] > 0.35); Q = P3[blue]
L_ = Q[Q[:, 0] > np.median(Q[:, 0])].mean(0); R_ = Q[Q[:, 0] <= np.median(Q[:, 0])].mean(0); SEP = abs(L_[0] - R_[0]); EYE = (L_ + R_) / 2
print('eyes', np.round(EYE, 3), 'sep', round(SEP, 4), flush=True)
# ---- per-face class + loop colours before
nv0 = len(me.vertices); T = np.zeros(nv0); me.attributes['_TINT'].data.foreach_get('value', T); T = np.round(T).astype(int)
ca = me.color_attributes['Color']; nl = len(me.loops); C0 = np.zeros(nl * 4); ca.data.foreach_get('color', C0); C0 = C0.reshape(-1, 4)
LV = np.zeros(nl, int); me.loops.foreach_get('vertex_index', LV); CMED = {k: np.median(C0[T[LV] == k], 0) for k in CL if (T[LV] == k).any()}
FI0, _ = paint.raster(me, *img.size)
FC0 = np.array([np.bincount(T[list(p.vertices)] + 1, minlength=3).argmax() - 1 for p in me.polygons])
K0 = np.where(FI0 >= 0, FC0[np.maximum(FI0, 0)], -9)
bm = bmesh.new(); bm.from_mesh(me); fl = bm.faces.layers.int.new('cls')
bm.faces.ensure_lookup_table()
for f in bm.faces: f[fl] = int(FC0[f.index])
n0 = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table(); bm.edges.ensure_lookup_table()
print('welded', n0, '->', len(bm.verts), flush=True)
def toe_groove(Pq, feet):
  """[V6 quality 3] 5 toes per foot (the refs): groove weight 0..1 along the 4 lines between the toes, on the top front of the foot"""
  G = np.zeros(len(Pq))
  for sx, ymin, ytoe, xin, xout in feet:
    u = (Pq[:, 0] * sx - xin) / max(xout - xin, 1e-6); hw = 0.0032 / max(xout - xin, 1e-6)
    g = np.max([np.exp(-((u - ui) / hw) ** 2) for ui in (0.31, 0.51, 0.68, 0.84)], 0)
    t = np.clip((ytoe - Pq[:, 1]) / (0.45 * (ytoe - ymin)), 0, 1) ** 0.7
    m = (Pq[:, 0] * sx > 0) & (Pq[:, 2] < 0.085) & (Pq[:, 2] > 0.010) & (u > 0.05) & (u < 0.97)
    G = np.where(m, np.maximum(G, g * t), G)
  return G
FEET = []
if E_('TOES', 1):
  P = np.array([v.co[:] for v in bm.verts])
  for sx in (1, -1):
    F = (P[:, 2] < 0.085) & (P[:, 0] * sx > 0.02); ymin = P[F, 1].min(); ymax = P[F, 1].max(); ytoe = ymin + 0.30 * (ymax - ymin)
    Z = F & (P[:, 1] < ytoe); xin = (P[Z, 0] * sx).min(); xout = (P[Z, 0] * sx).max(); FEET.append((sx, ymin, ytoe, xin, xout))
  tz = np.array([(v.co.z < 0.085) and any(v.co.y < ft[2] + 0.006 and v.co.x * ft[0] > 0.02 for ft in FEET) for v in bm.verts])
  tf = [f for f in bm.faces if all(tz[v.index] for v in f.verts) and f[fl] == 0]
  if not LO:
    eds = list({e for f in tf for e in f.edges}); bmesh.ops.subdivide_edges(bm, edges=eds, cuts=E_('TOECUTS', 2), use_grid_fill=True, smooth=0.0)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
    bm.verts.index_update(); bm.verts.ensure_lookup_table(); bm.faces.index_update(); bm.faces.ensure_lookup_table(); bm.edges.ensure_lookup_table(); bm.normal_update()
    P = np.array([v.co[:] for v in bm.verts]); G = toe_groove(P, FEET); dep = E_('TOED', 0.0045)
    for v in bm.verts:
      if G[v.index] > 0.02 and v.normal.z > -0.3: v.co -= v.normal * (dep * G[v.index])
    bm.normal_update()
  print('toes: faces', len(tf), 'feet', [tuple(round(float(x), 3) for x in ft) for ft in FEET], flush=True)
nv = len(bm.verts); P = np.array([v.co[:] for v in bm.verts])
S = np.zeros((nv, 3)); wsum = np.zeros(nv)
for f in bm.faces:
  a = f.calc_area(); k = f[fl] + 1
  for v in f.verts: S[v.index, k] += a; wsum[v.index] += a
S /= np.maximum(wsum, 1e-12)[:, None]
Ed = np.array([(e.verts[0].index, e.verts[1].index) for e in bm.edges]); cnt = np.zeros(nv); np.add.at(cnt, Ed[:, 0], 1); np.add.at(cnt, Ed[:, 1], 1)
ax = np.abs(P[:, 0]); hand = ax > 0.72 * ax.max(); foot = P[:, 2] < 0.085
face_eye = (np.abs(P[:, 0] - EYE[0]) < 1.25 * SEP) & (P[:, 2] > EYE[2] - 0.25 * SEP) & (P[:, 2] < EYE[2] + 0.45 * SEP) & (P[:, 1] < EYE[1] + 0.05)   # the decal eyes sit on this skin: kept
fix = hand | foot | face_eye
NIT = E_('SITER', 6 if not LO else 3)
for it in range(NIT):
  M = np.zeros_like(S); np.add.at(M, Ed[:, 0], S[Ed[:, 1]]); np.add.at(M, Ed[:, 1], S[Ed[:, 0]]); M /= np.maximum(cnt, 1)[:, None]
  S = np.where(fix[:, None], S, 0.5 * S + 0.5 * M)
head = P[:, 2] > EYE[2] - 1.1 * SEP
for it in range(E_('HEADIT', 6 if not LO else 3)):   # the head (hairline, strands painted skin): smoothed further
  M = np.zeros_like(S); np.add.at(M, Ed[:, 0], S[Ed[:, 1]]); np.add.at(M, Ed[:, 1], S[Ed[:, 0]]); M /= np.maximum(cnt, 1)[:, None]
  S = np.where((head & ~fix)[:, None], 0.5 * S + 0.5 * M, S)
lab = S.argmax(1)
# ---- cut along the iso-line
dl = bm.verts.layers.deform.active; ul = bm.loops.layers.uv.active; cl_ = bm.loops.layers.color.get('Color') or bm.loops.layers.float_color.get('Color')
cuts = []; VS = {v: S[v.index] for v in bm.verts}
for e in bm.edges:
  a, b = e.verts[0].index, e.verts[1].index
  if lab[a] == lab[b]: continue
  ka, kb = lab[a], lab[b]; d0 = S[a, ka] - S[a, kb]; d1 = S[b, ka] - S[b, kb]
  t = float(np.clip(d0 / max(d0 - d1, 1e-9), 0.12, 0.88)); cuts.append((e, e.verts[0], e.verts[1], t))
newv = {}; SN = []
for e, a, b, t in cuts:
  va, vb = a, b
  ne, nvx = bmesh.utils.edge_split(e, va, t); nvx.co = va.co.lerp(vb.co, t)
  if dl is not None:
    da, db = va[dl], vb[dl]; g = set(da.keys()) | set(db.keys()); nvx[dl].clear()
    for gi in g: nvx[dl][gi] = (1 - t) * da.get(gi, 0.0) + t * db.get(gi, 0.0)
  for l in nvx.link_loops:
    lp, lx = l.link_loop_prev, l.link_loop_next
    la, lb = (lp, lx) if lp.vert is va else (lx, lp)
    if la.vert is not va or lb.vert is not vb: continue
    l[ul].uv = la[ul].uv.lerp(lb[ul].uv, t)
  newv[nvx] = (1 - t) * VS[a] + t * VS[b]
print('edges cut', len(cuts), flush=True)
ns = 0
for f in list(bm.faces):
  nn = [v for v in f.verts if v in newv]
  if len(nn) == 2 and nn[1] not in [x for e in nn[0].link_edges for x in e.verts]:
    try: bmesh.utils.face_split(f, nn[0], nn[1]); ns += 1
    except Exception: pass
bm.verts.index_update(); bm.faces.index_update(); bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
SV = np.zeros((len(bm.verts), 3))
for v in bm.verts: SV[v.index] = newv[v] if v in newv else VS[v]
print('faces split', ns, flush=True)
FCn = np.array([CL[SV[[v.index for v in f.verts]].mean(0).argmax()] for f in bm.faces])
nb = [[g.index for e in f.edges for g in e.link_faces if g is not f] for f in bm.faces]; nf = len(FCn); fl_ = 0   # small islands -> around class
seen = np.zeros(nf, bool)
for i0 in range(nf):
  if seen[i0]: continue
  k = FCn[i0]; comp = [i0]; seen[i0] = True; st = [i0]
  while st:
    i = st.pop()
    for j in nb[i]:
      if not seen[j] and FCn[j] == k: seen[j] = True; comp.append(j); st.append(j)
  if len(comp) < 12:
    cs = set(comp); ring = [FCn[j] for i in comp for j in nb[i] if j not in cs]
    if ring: FCn[comp] = max(set(ring), key=ring.count); fl_ += len(comp)
for f in bm.faces: f[fl] = int(FCn[f.index]); f.smooth = True
print('island faces', fl_, 'classes', dict(zip(*np.unique(FCn, return_counts=True))), flush=True)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
edges = [e for e in bm.edges if len(e.link_faces) == 2 and e.link_faces[0][fl] != e.link_faces[1][fl]]
bmesh.ops.split_edges(bm, edges=edges); bm.verts.index_update(); bm.faces.index_update()
VC = {}
for f in bm.faces:
  for v in f.verts: VC.setdefault(v.index, f[fl])
FCL = np.array([f[fl] for f in bm.faces]); bm.faces.layers.int.remove(fl)
if E_('BANGS', 1):
  nb_ = 0; y0 = EYE[1] + E_('BANGY', 0.025)
  for v in bm.verts:
    if VC.get(v.index) != 1: continue
    c = v.co; ex = min(abs(c.x - L_[0]), abs(c.x - R_[0])) / (0.62 * SEP); ez = (c.z - (EYE[2] + 0.05 * SEP)) / (0.55 * SEP)
    r = ex * ex + ez * ez
    if r < 1 and c.y < y0: wv = min(1.0, 1.6 * (1 - r)); c.y = c.y + (y0 - c.y) * wv; nb_ += 1
  print('bangs verts pushed behind the eyes', nb_, flush=True)
bm.to_mesh(me); bm.free(); me.update()
for a in ('sharp_face', 'sharp_edge'):
  if a in me.attributes: me.attributes.remove(me.attributes[a])
nv2 = len(me.vertices); T2 = np.array([VC.get(i, 0) for i in range(nv2)], float); me.attributes['_TINT'].data.foreach_set('value', T2)
ca = me.color_attributes['Color']; nl = len(me.loops); LV = np.zeros(nl, int); me.loops.foreach_get('vertex_index', LV)
C = np.array([CMED[int(k)] for k in T2[LV]]); ca.data.foreach_set('color', C.ravel())
# ---- normals: welded average, then the face front flattened
PP = np.zeros(nv2 * 3); me.vertices.foreach_get('co', PP); PP = PP.reshape(-1, 3)
key = np.round(PP / 1e-5).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel(); nw = inv.max() + 1
N = np.array([v.normal[:] for v in me.vertices]); NW = np.zeros((nw, 3)); np.add.at(NW, inv, N); NW /= np.maximum(np.linalg.norm(NW, axis=1), 1e-9)[:, None]
QW = np.zeros((nw, 3)); np.add.at(QW, inv, PP); QW /= np.bincount(inv)[:, None]
EW = np.array([(inv[e.vertices[0]], inv[e.vertices[1]]) for e in me.edges]); EW = EW[EW[:, 0] != EW[:, 1]]
cw = np.zeros(nw); np.add.at(cw, EW[:, 0], 1); np.add.at(cw, EW[:, 1], 1)
TW = np.zeros(nw); np.add.at(TW, inv, (T2 == 0).astype(float)); TW = TW / np.bincount(inv) > 0.99   # skin-only welded verts
NS = NW.copy()
for it in range(E_('NIT', 40)):
  M = np.zeros_like(NS); np.add.at(M, EW[:, 0], NS[EW[:, 1]]); np.add.at(M, EW[:, 1], NS[EW[:, 0]]); M /= np.maximum(cw, 1)[:, None]
  NS = np.where(TW[:, None], 0.5 * NS + 0.5 * M, NS); NS /= np.maximum(np.linalg.norm(NS, axis=1), 1e-9)[:, None]
FCN = EYE - np.array([0, 0, (0.45 if FEM else 0.35) * SEP])   # nose / mouth centre
d = np.linalg.norm((QW - FCN) * [1.0, 1.6, 0.85], axis=1) / ((1.10 if FEM else 0.85) * SEP)
wf = np.clip(1.25 - d, 0, 1) * (QW[:, 1] < EYE[1] + 0.05) * TW * E_('FACEN', 0.95 if FEM else 0.8)
wb = TW * E_('BODYN', 0.35)   # the rest of the skin: a touch softer (chest / shoulder lumps)
w = np.maximum(wf, wb)[:, None]; NF = (1 - w) * NW + w * NS; NF /= np.maximum(np.linalg.norm(NF, axis=1), 1e-9)[:, None]
me.normals_split_custom_set_from_vertices([tuple(x) for x in NF[inv]])
print('normals: face verts flattened', int((wf > 0.05).sum()), flush=True)
# ---- texels that changed class -> that class's flat albedo
FI1, _ = paint.raster(me, *img.size); K1 = np.where(FI1 >= 0, FCL[np.maximum(FI1, 0)], -9)
W, H = img.size; A = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
ch = (K1 != K0) & (K1 != -9) & (K0 != -9); MEDT = {}
for k in CL:
  m = (K1 == k) & ~ch
  if m.any(): MEDT[k] = np.median(A[..., :3][m], 0)
for k in CL:
  m = ch & (K1 == k)
  if m.any() and k in MEDT: A[..., :3][m] = MEDT[k]
if FEET:   # the toe lines painted (both LODs; the lo has no groove geometry)
  _, P3 = paint.raster(me, W, H); Gt = toe_groove(P3.reshape(-1, 3), FEET).reshape(H, W) * (FI1 >= 0) * (K1 == 0)
  A[..., :3] *= (1 - E_('TOEP', 0.30 if LO else 0.18) * Gt)[..., None]
img.pixels.foreach_set(A.ravel()); img.update(); print('texels re-classed', int(ch.sum()), flush=True)
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; arm.data.pose_position = 'POSE'
for o in list(bpy.data.objects):
  if o.type == 'MESH' and o not in (body, dec) and not o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
me.color_attributes.active_color = me.color_attributes['Color']
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_attributes=True, export_vertex_color='ACTIVE', export_all_vertex_colors=False,
  export_animations=True, export_animation_mode='ACTIONS', export_skins=True, export_image_format='WEBP', export_image_quality=80 if LO else 90, export_draco_mesh_compression_enable=True, export_def_bones=False, export_yup=True, export_extras=True)
print('exported', OUT, 'tris', sum(len(p.vertices) - 2 for p in me.polygons), flush=True)
