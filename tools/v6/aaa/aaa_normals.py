"""Normals + cloth COLOR_0 + hair shell outward bias. Textures injected afterwards."""
import bpy, sys, numpy as np
from pathlib import Path
from mathutils import Vector, kdtree

ARGS = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT, SEX = Path(ARGS[0]), Path(ARGS[1]), ARGS[2]
BLENDER_EXPORT = dict(
    export_format='GLB', export_attributes=True, export_vertex_color='ACTIVE',
    export_all_vertex_colors=False, export_animations=True, export_animation_mode='ACTIONS',
    export_skins=True, export_image_format='WEBP',
    export_draco_mesh_compression_enable=True,
    export_draco_position_quantization=16, export_def_bones=False, export_yup=True,
    export_extras=True,
)

def log(*a):
    print(*a, flush=True)

def body_of():
    return [o for o in bpy.data.objects if o.type == 'MESH' and o.get('v6')][0]

def corner_normals_as_vertex(me):
    N = np.zeros((len(me.vertices), 3))
    for l, n in zip(me.loops, me.corner_normals):
        N[l.vertex_index] += n.vector
    N /= np.maximum(np.linalg.norm(N, axis=1), 1e-9)[:, None]
    return N

def apply_custom_normals(me, NN):
    CN = [None] * len(me.loops)
    for f in me.polygons:
        for li in f.loop_indices:
            CN[li] = tuple(float(x) for x in NN[me.loops[li].vertex_index])
    me.normals_split_custom_set(CN)
    me.update()

def get_tint(me):
    T = np.zeros(len(me.vertices))
    me.attributes['_TINT'].data.foreach_get('value', T)
    return np.round(T).astype(np.int32)

def get_pos(me):
    return np.array([v.co[:] for v in me.vertices], np.float32)

def smooth_normals_male(me, T, P):
    NN = corner_normals_as_vertex(me)
    skin = (T == 0)
    region = skin & (P[:, 2] > 0.35) & (P[:, 2] < 1.12) & (np.abs(P[:, 0]) < 0.45)
    idxs = np.where(region)[0]
    kd = kdtree.KDTree(len(idxs))
    for i in idxs:
        kd.insert(Vector(P[i]), int(i))
    kd.balance()
    Ncur = NN.copy()
    touched = 0
    for i in idxs:
        ns = [j for _, j, _ in kd.find_range(Vector(P[i]), 0.028) if np.dot(Ncur[i], Ncur[j]) > 0.15]
        if len(ns) > 2:
            NN[i] = 0.55 * Ncur[i] + 0.45 * Ncur[ns].mean(0)
            touched += 1
    NN /= np.maximum(np.linalg.norm(NN, axis=1), 1e-9)[:, None]
    apply_custom_normals(me, NN)
    log('male normals', touched)
    return touched

def smooth_normals_female(me, T, P):
    NN = corner_normals_as_vertex(me)
    skin = (T == 0)
    keys = np.array([
        [0.770, 0.125, 0.088, -0.032],
        [0.800, 0.110, 0.092, -0.030],
        [0.830, 0.096, 0.096, -0.026],
        [0.860, 0.088, 0.100, -0.022],
        [0.890, 0.084, 0.102, -0.018],
        [0.920, 0.082, 0.100, -0.016],
    ])
    z = P[:, 2]
    rx = np.interp(np.clip(z, keys[0, 0], keys[-1, 0]), keys[:, 0], keys[:, 1])
    ry = np.interp(np.clip(z, keys[0, 0], keys[-1, 0]), keys[:, 0], keys[:, 2])
    cy = np.interp(np.clip(z, keys[0, 0], keys[-1, 0]), keys[:, 0], keys[:, 3])
    anx = np.zeros((len(P), 3))
    anx[:, 0] = P[:, 0] / np.maximum(rx, 1e-6) ** 2
    anx[:, 1] = (P[:, 1] - cy) / np.maximum(ry, 1e-6) ** 2
    anx[:, 2] = 0.05
    anx /= np.maximum(np.linalg.norm(anx, axis=1), 1e-9)[:, None]
    core = skin & (np.abs(P[:, 0]) < 0.14) & (z > 0.80) & (z < 0.93) & (P[:, 1] > -0.14) & (P[:, 1] < 0.09)
    lo_band = skin & (np.abs(P[:, 0]) < 0.16) & (z > 0.74) & (z <= 0.80) & (P[:, 1] > -0.14) & (P[:, 1] < 0.10)
    hi_band = skin & (np.abs(P[:, 0]) < 0.13) & (z >= 0.93) & (z < 1.02) & (P[:, 1] > -0.12) & (P[:, 1] < 0.08)
    forced = 0
    for i in np.where(core)[0]:
        if np.dot(NN[i], anx[i]) < -0.2:
            continue
        NN[i] = anx[i]
        forced += 1
    for i in np.where(lo_band)[0]:
        if np.dot(NN[i], anx[i]) < -0.2:
            continue
        NN[i] = 0.35 * NN[i] + 0.65 * anx[i]
    for i in np.where(hi_band)[0]:
        if np.dot(NN[i], anx[i]) < -0.2:
            continue
        NN[i] = 0.40 * NN[i] + 0.60 * anx[i]
    shoulder = skin & (z > 0.95) & (z < 1.18) & (np.abs(P[:, 0]) > 0.08) & (np.abs(P[:, 0]) < 0.28) & (P[:, 1] > -0.12) & (P[:, 1] < 0.12)
    idxs = np.where(lo_band | hi_band | core | shoulder)[0]
    if len(idxs):
        kd = kdtree.KDTree(len(idxs))
        for i in idxs:
            kd.insert(Vector(P[i]), int(i))
        kd.balance()
        Ncur = NN.copy()
        for i in np.where(lo_band | hi_band | shoulder)[0]:
            ns = [j for _, j, _ in kd.find_range(Vector(P[i]), 0.016) if np.dot(Ncur[i], Ncur[j]) > 0.2]
            if len(ns) > 1:
                NN[i] = Ncur[ns].mean(0)
    underjaw = skin & (np.abs(P[:, 0]) < 0.11) & (z > 0.98) & (z < 1.10) & (P[:, 1] < 0.05)
    uj = np.where(underjaw)[0]
    if len(uj):
        ukd = kdtree.KDTree(len(uj))
        for i in uj:
            ukd.insert(Vector(P[i]), int(i))
        ukd.balance()
        Ncur = NN.copy()
        for i in uj:
            ns = [j for _, j, _ in ukd.find_range(Vector(P[i]), 0.016) if np.dot(Ncur[i], Ncur[j]) > 0.25]
            if len(ns) > 1:
                NN[i] = Ncur[ns].mean(0)
    torso = skin & (z > 0.45) & (z < 0.95) & (np.abs(P[:, 0]) < 0.22)
    tidx = np.where(torso)[0]
    if len(tidx):
        tkd = kdtree.KDTree(len(tidx))
        for i in tidx:
            tkd.insert(Vector(P[i]), int(i))
        tkd.balance()
        Ncur = NN.copy()
        for i in tidx:
            ns = [j for _, j, _ in tkd.find_range(Vector(P[i]), 0.024) if np.dot(Ncur[i], Ncur[j]) > 0.2]
            if len(ns) > 2:
                NN[i] = 0.6 * Ncur[i] + 0.4 * Ncur[ns].mean(0)
    NN /= np.maximum(np.linalg.norm(NN, axis=1), 1e-9)[:, None]
    apply_custom_normals(me, NN)
    log('female normals forced', forced)
    return forced

def hair_shell_push(me, T, P):
    """Tiny outward bias on hair verts near skin to reduce z-fighting fringe. Shape preserved."""
    NN = corner_normals_as_vertex(me)
    hair = (T == 1)
    skin_idx = np.where(T == 0)[0]
    if not len(skin_idx) or not hair.any():
        return 0
    skd = kdtree.KDTree(len(skin_idx))
    for i in skin_idx:
        skd.insert(Vector(P[i]), int(i))
    skd.balance()
    pushed = 0
    for i in np.where(hair)[0]:
        near = skd.find_range(Vector(P[i]), 0.018)
        if not near:
            continue
        _, j, d = min(near, key=lambda t: t[2])
        if d > 0.012:
            continue
        n = NN[i].copy()
        away = P[i] - P[j]
        if np.dot(away, n) < 0:
            n = -n
        me.vertices[i].co = Vector(P[i] + n * 0.0018)
        pushed += 1
    me.update()
    log('hair shell push', pushed)
    return pushed

def crisp_cloth(me, T):
    ca = me.color_attributes['Color']
    C = np.zeros(len(ca.data) * 4)
    ca.data.foreach_get('color', C)
    C = C.reshape(-1, 4)
    Cv = np.zeros((len(me.vertices), 4))
    cnt = np.zeros(len(me.vertices))
    for li, l in enumerate(me.loops):
        Cv[l.vertex_index] += C[li]
        cnt[l.vertex_index] += 1
    Cv /= np.maximum(cnt, 1)[:, None]
    cloth = (T == -1)
    Cv[cloth, 0] = np.maximum(Cv[cloth, 0], 0.96)
    Cv[cloth, 1] = np.maximum(Cv[cloth, 1], 0.96)
    Cv[cloth, 2] = np.maximum(Cv[cloth, 2], 0.96)
    for li, l in enumerate(me.loops):
        v = Cv[l.vertex_index]
        ca.data[li].color = (float(v[0]), float(v[1]), float(v[2]), 1.0)
    log('cloth crisped', int(cloth.sum()))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(SRC))
body = body_of()
me = body.data
T = get_tint(me)
P = get_pos(me)
log('AAA normals', SEX, 'verts', len(me.vertices))
if SEX == 'male':
    smooth_normals_male(me, T, P)
else:
    smooth_normals_female(me, T, P)
P = get_pos(me)
hair_shell_push(me, T, P)
crisp_cloth(me, T)
OUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUT), **BLENDER_EXPORT)
log('exported', OUT, OUT.stat().st_size)
