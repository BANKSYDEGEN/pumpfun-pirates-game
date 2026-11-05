# V6 body below the neck + exact V5 head (BANKSY 10:37/10:38):
#   male: V5 head mesh+hair+beard+eyes+textures unchanged
#   female: V5 face (skin/eyes/brows/mouth/head shape) + V6 hair (may differ slightly; strand kept out of eye)
# blender -b -noaudio -P splice_v5heads.py -- SEX LOD OUT.glb
import bpy, bmesh, sys, os, numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

SEX, LOD, OUT = sys.argv[sys.argv.index('--') + 1:][:3]
FEM = SEX == 'female'
G = '/workspace/raul-v6/assets/pirates/'
# V6 body source: pre-splice backup (assets may already hold a spliced GLB)
V6SRC = os.environ.get('V6SRC', '/workspace/brand/v6_characters/work/headsplice/')
NECKD = float(os.environ.get('NECKD', '0.020'))
OVER = float(os.environ.get('OVER', '0.055'))   # V5 neck skirt overlaps V6 torso
SEAM = float(os.environ.get('SEAM', '0.008'))
BANG = float(os.environ.get('BANG', '0'))
GUT = 4  # atlas gutter px

def objs(): return set(bpy.data.objects)
def imp(f):
  b = objs(); bpy.ops.import_scene.gltf(filepath=f); return [o for o in bpy.data.objects if o not in b]
def act(o):
  bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
def ntri(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
def V(o):
  a = np.zeros(len(o.data.vertices) * 3); o.data.vertices.foreach_get('co', a); return a.reshape(-1, 3)
def tint_of(me):
  t = np.zeros(len(me.vertices)); me.attributes['_TINT'].data.foreach_get('value', t); return np.round(t).astype(int)

bpy.ops.wm.read_factory_settings(use_empty=True)

# ---- load V6 (base) ----
g6 = imp(os.path.join(V6SRC, f'pirate_{SEX}_v6_{LOD}.glb'))
arm = [o for o in g6 if o.type == 'ARMATURE'][0]; arm.data.pose_position = 'REST'
body = [o for o in g6 if o.type == 'MESH' and o.name.startswith('pirate_')][0]
dec6 = [o for o in g6 if o.name.startswith('v5_face_eyes')][0]
props = {k: body[k] for k in body.keys()}; bname = body.name
print('V6', SEX, LOD, 'tris', ntri(body), flush=True)

# ---- load V5 donor ----
g5 = imp(G + f'pirate_{SEX}_v5_{LOD}.glb')
for o in g5:
  if o.type == 'ARMATURE': o.name = 'v5arm'
  elif o.name.startswith('pirate_'): o.name = 'v5body'
  elif o.name.startswith('v5_face_eyes'): o.name = 'v5eyes'
  elif o.name.startswith('v5_tattoo'): o.name = 'v5tat'
  elif o.name.startswith('Icosphere'): o.name = 'v5ico'
b5 = bpy.data.objects['v5body']; e5 = bpy.data.objects['v5eyes']
for o in (b5, e5): o.parent = None
for nm in ('v5arm', 'v5tat', 'v5ico'):
  if nm in bpy.data.objects: bpy.data.objects.remove(bpy.data.objects[nm], do_unlink=True)

ZCUT = float((arm.matrix_world @ arm.data.bones['head'].head_local).z) - NECKD
Z6 = ZCUT - OVER * 0.35
Z5 = ZCUT - OVER
print('ZCUT', round(ZCUT, 4), 'Z6', round(Z6, 4), 'Z5', round(Z5, 4), flush=True)

# ---- atlases side-by-side: V6 | gutter | V5 ----
mat6 = body.data.materials[0]; tex6 = [n for n in mat6.node_tree.nodes if n.type == 'TEX_IMAGE'][0]; IM6 = tex6.image
mat5 = b5.data.materials[0]; tex5 = [n for n in mat5.node_tree.nodes if n.type == 'TEX_IMAGE'][0]; IM5 = tex5.image
W, H = IM6.size
W5,H5 = IM5.size
if (W5,H5)!=(W,H):
  print('WARN atlas size mismatch V6', (W,H), 'V5', (W5,H5), '- resampling V5 into V6 size', flush=True)
  # resize PX5 later; for now require equal (backup sources should match)
  raise SystemExit(f'atlas size mismatch V6 {(W,H)} V5 {(W5,H5)}')
PX6 = np.array(IM6.pixels[:], dtype=np.float32).reshape(H, W, 4)
PX5 = np.array(IM5.pixels[:], dtype=np.float32).reshape(H, W, 4)
WN = W * 2 + GUT
NEW = np.ones((H, WN, 4), dtype=np.float32)
NEW[:, :W] = PX6
NEW[:, W:W + GUT] = PX6[:, W - 1:W]  # gutter = copy V6 edge
NEW[:, W + GUT:] = PX5

# normalize V5 skin albedo median -> V6 skin median (same setColors skin then matches at neck)
def skin_med(PX, me, T):
  nl = len(me.loops); uv = np.zeros(nl * 2); me.uv_layers[0].data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
  cv = np.zeros(nl, int); me.loops.foreach_get('vertex_index', cv)
  sk = T[cv] == 0
  if not sk.any(): return np.array([0.92, 0.92, 0.92]), []
  ys = np.clip((uv[sk, 1] * H).astype(int), 0, H - 1)
  xs = np.clip((uv[sk, 0] * W).astype(int), 0, W - 1)
  return np.median(PX[ys, xs, :3], 0), list(zip(ys.tolist(), xs.tolist()))

T5full = tint_of(b5.data); T6full = tint_of(body.data)
MED6, _ = skin_med(PX6, body.data, T6full)
MED5, sk_uv = skin_med(PX5, b5.data, T5full)
scale = np.where(MED5 > 1e-3, MED6 / MED5, 1.0)
dil = set()
for y, x in sk_uv:
  for dy in range(-2, 3):
    for dx in range(-2, 3):
      dil.add((min(H - 1, max(0, y + dy)), min(W - 1, max(0, x + dx))))
for y, x in dil:
  NEW[y, W + GUT + x, :3] = np.clip(PX5[y, x, :3] * scale, 0, 1)
print('atlas', WN, 'x', H, 'skin med V6', MED6.round(3), 'V5', MED5.round(3), 'scale', scale.round(3), flush=True)
img = bpy.data.images.new(IM6.name + '_v5head', WN, H, alpha=True)
img.pixels.foreach_set(NEW.ravel()); img.pack(); img.colorspace_settings.name = 'sRGB'
tex6.image = img

# remap V6 UVs into left half
for l in body.data.uv_layers[0].data:
  u, v = l.uv; l.uv = (u * (W / WN), v)

# ---- cut V6 body ----
bm = bmesh.new(); bm.from_mesh(body.data); bm.faces.ensure_lookup_table()
tl = bm.verts.layers.float.get('_TINT')
dead = []
for f in bm.faces:
  zs = [v.co.z for v in f.verts]; cz = sum(zs) / len(zs)
  ts = [round(v[tl]) for v in f.verts]
  # both sexes: drop every V6 head face above Z6, and ALL leftover hair/beard (tint 1) —
  # V5 head brings its own hair/beard/braid, so V6 hair below the cut would double up
  if cz >= Z6 or all(t == 1 for t in ts):
    dead.append(f)
print('V6 faces cut', len(dead), 'of', len(bm.faces), flush=True)
bmesh.ops.delete(bm, geom=dead, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(body.data); bm.free(); body.data.update()
print('V6 body kept tris', ntri(body), flush=True)

# ---- cut V5 to head (+ face-only for female) ----
bm = bmesh.new(); bm.from_mesh(b5.data); bm.faces.ensure_lookup_table()
tl = bm.verts.layers.float.get('_TINT')
dead = []
for f in bm.faces:
  zs = [v.co.z for v in f.verts]; cz = sum(zs) / len(zs)
  ts = [round(v[tl]) for v in f.verts]
  # keep V5 skin (0) + hair/beard (1) + tint7; DROP cloth (tint -1) — those are V5 wrap-top/sash shreds that z-fight the V6 body
  if cz < Z5: dead.append(f); continue
  if all(t == -1 for t in ts): dead.append(f)
print('V5 faces cut', len(dead), 'of', len(bm.faces), flush=True)
bmesh.ops.delete(bm, geom=dead, context='FACES')
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(b5.data); bm.free(); b5.data.update()
print('V5 head kept tris', ntri(b5), flush=True)

# remap V5 UVs into right half
for l in b5.data.uv_layers[0].data:
  u, v = l.uv; l.uv = ((u * W + W + GUT) / WN, v)
b5.data.materials.clear(); b5.data.materials.append(mat6)

T6 = tint_of(body.data); T5h = tint_of(b5.data)
print('tints V6', {int(k): int((T6 == k).sum()) for k in sorted(set(T6))},
      'V5 head', {int(k): int((T5h == k).sum()) for k in sorted(set(T5h))}, flush=True)

# ---- join ----
b5.parent = arm
for m in list(b5.modifiers): b5.modifiers.remove(m)
am = b5.modifiers.new('Armature', 'ARMATURE'); am.object = arm
bpy.ops.object.select_all(action='DESELECT')
b5.select_set(True); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
print('joined tris', ntri(body), 'verts', len(body.data.vertices), flush=True)

# ---- neck seam: project SKIN skirt onto V6 body ----
bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
tl = bm.verts.layers.float.get('_TINT')
body_idx = [v.index for v in bm.verts if v.co.z < ZCUT - 0.01 and (tl is None or round(v[tl]) != 1)]
kd = KDTree(len(body_idx))
for i, vi in enumerate(body_idx): kd.insert(bm.verts[vi].co, i)
kd.balance()
skirt = [v for v in bm.verts if Z5 - 0.002 <= v.co.z <= ZCUT + 0.01 and (tl is None or round(v[tl]) == 0)]
nsnap = 0
for v in skirt:
  co, j, d = kd.find(v.co)
  if d < 0.08:
    target = bm.verts[body_idx[j]].co
    delta = v.co - target
    v.co = target + (delta.normalized() * 0.0015 if delta.length > 1e-6 else Vector((0, 0, 0)))
    nsnap += 1
print('skirt skin projected', nsnap, 'of', len(skirt), flush=True)
skirt2 = [v for v in bm.verts if Z5 - 0.002 <= v.co.z <= ZCUT + 0.02 and (tl is None or round(v[tl]) == 0)]
if skirt2: bmesh.ops.remove_doubles(bm, verts=skirt2, dist=0.0025)
bm.to_mesh(body.data); bm.free(); body.data.update()
print('after weld tris', ntri(body), 'verts', len(body.data.vertices), flush=True)

# drop V6 skin faces in the overlap band (left-atlas UVs) so only the V5 neck skirt shows — kills z-fight
bm = bmesh.new(); bm.from_mesh(body.data); bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
uvl = bm.loops.layers.uv.active; tl = bm.verts.layers.float.get('_TINT')
dead = []
for f in bm.faces:
  zs = [v.co.z for v in f.verts]; cz = sum(zs)/len(zs)
  if not (Z5 - 0.005 <= cz <= ZCUT + 0.01): continue
  if tl is not None and any(round(v[tl]) == 1 for v in f.verts): continue  # keep hair
  # V6 half of the side-by-side atlas
  if uvl and all((l[uvl].uv[0] < 0.48) for l in f.loops):
    dead.append(f)
print('V6 overlap faces dropped', len(dead), flush=True)
if dead:
  bmesh.ops.delete(bm, geom=dead, context='FACES')
  bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
  bm.to_mesh(body.data); body.data.update()
bm.free()
print('after overlap trim tris', ntri(body), flush=True)

# ---- female bangs out of eyes ----
if FEM and BANG > 0:
  EZ = np.array([v.co[:] for v in e5.data.vertices])
  eye_y = float(np.percentile(EZ[:, 1], 15))
  eye_z0, eye_z1 = float(EZ[:, 2].min()) - 0.01, float(EZ[:, 2].max()) + 0.02
  eye_x = float(np.percentile(np.abs(EZ[:, 0]), 90))
  T = tint_of(body.data); P = V(body)
  bang = (T == 1) & (P[:, 1] < eye_y + 0.008) & (P[:, 2] > eye_z0) & (P[:, 2] < eye_z1) & (np.abs(P[:, 0]) < eye_x + 0.04)
  n = int(bang.sum())
  if n:
    P[bang, 1] = np.maximum(P[bang, 1], eye_y + BANG)
    body.data.vertices.foreach_set('co', P.ravel()); body.data.update()
  print('bangs pushed', n, flush=True)

# ---- unify default skin COLOR (head <- body med) ----
T = tint_of(body.data); P = V(body)
nl = len(body.data.loops); cv = np.zeros(nl, int); body.data.loops.foreach_get('vertex_index', cv)
C = np.zeros(nl * 4); body.data.attributes['Color'].data.foreach_get('color', C); C = C.reshape(-1, 4)
body_skin = (T == 0) & (P[:, 2] < ZCUT - 0.01)
head_skin = (T == 0) & (P[:, 2] >= ZCUT - 0.01)
if body_skin.any() and head_skin[cv].any():
  med = np.median(C[body_skin[cv], :3], 0)
  C[head_skin[cv], :3] = med
  body.data.attributes['Color'].data.foreach_set('color', C.ravel())
  print('head skin COLOR <- body', med.round(3), flush=True)

# ---- eyes = exact V5 ----
bpy.data.objects.remove(dec6, do_unlink=True)
e5.name = 'v5_face_eyes'; e5.data.name = 'v5_face_eyes'; e5.parent = arm
for m in list(e5.modifiers): e5.modifiers.remove(m)
for vg in body.vertex_groups:
  if vg.name not in e5.vertex_groups: e5.vertex_groups.new(name=vg.name)
dt = e5.modifiers.new('dt', 'DATA_TRANSFER'); dt.object = body; dt.use_vert_data = True
dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'NEAREST'
dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
act(e5); bpy.ops.object.modifier_apply(modifier='dt')
am = e5.modifiers.new('Armature', 'ARMATURE'); am.object = arm
if e5.data.materials: e5.data.materials[0].name = 'v5eyes'

# ---- extras / cleanup ----
for k, v in props.items(): body[k] = v
body['v6'] = 1; body.name = bname; body.data.name = bname
keep = {body, e5}
for o in list(bpy.data.objects):
  if o.type == 'MESH' and o not in keep and not o.name.startswith('Icosphere'):
    bpy.data.objects.remove(o, do_unlink=True)
if 'Color' in body.data.color_attributes:
  body.data.color_attributes.active_color = body.data.color_attributes['Color']

T = tint_of(body.data)
vh = body.vertex_groups.get('head')
nfix = 0
if vh is not None:
  for vi in np.where(T == 1)[0]:
    for g in list(body.data.vertices[int(vi)].groups):
      body.vertex_groups[g.group].remove([int(vi)])
    vh.add([int(vi)], 1.0, 'REPLACE'); nfix += 1
print('hair -> head', nfix, flush=True)

arm.data.pose_position = 'POSE'
bpy.ops.object.select_all(action='SELECT')
os.makedirs(os.path.dirname(os.path.abspath(OUT)) or '.', exist_ok=True)
bpy.ops.export_scene.gltf(
  filepath=OUT, export_format='GLB', export_attributes=True, export_vertex_color='ACTIVE',
  export_all_vertex_colors=False, export_animations=True, export_animation_mode='ACTIONS',
  export_skins=True, export_image_format='WEBP', export_image_quality=90 if LOD == 'hi' else 80,
  export_draco_mesh_compression_enable=True, export_def_bones=False, export_yup=True, export_extras=True)
print('exported', OUT, 'body tris', ntri(body), 'eyes tris', ntri(e5), flush=True)
