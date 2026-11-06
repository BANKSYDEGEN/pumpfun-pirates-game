#!/usr/bin/env python3
"""V6 AAA studio polish — texture + normals + eye gloss prep.

Locks preserved:
  - hair shape / eye shape / tattoo placement
  - rig, clips, _TINT convention, heights
  - male: no shoulder hair paint, no neck remesh, no head redesign
Female: keep Low=High (thin shells fracture under auto-decimate).

Usage (Blender):
  blender -b -noaudio -P aaa_polish.py -- male|female|/path/to.glb OUT.glb
"""
from __future__ import annotations
import bpy, sys, json, io
import numpy as np
from pathlib import Path
from mathutils import Vector, kdtree
from PIL import Image, ImageFilter, ImageEnhance

ARGS = sys.argv[sys.argv.index('--') + 1:]
SEX_OR_SRC = ARGS[0]
OUT = Path(ARGS[1])
WORK = Path('/workspace/brand/v6_characters/work/aaa')
BEFORE = WORK / 'before'

if SEX_OR_SRC in ('male', 'female'):
    SEX = SEX_OR_SRC
    SRC = BEFORE / f'pirate_{SEX}_v6_hi.glb'
else:
    SRC = Path(SEX_OR_SRC)
    SEX = 'female' if 'female' in SRC.name else 'male'

BLENDER_EXPORT = dict(
    export_format='GLB', export_attributes=True, export_vertex_color='ACTIVE',
    export_all_vertex_colors=False, export_animations=True, export_animation_mode='ACTIONS',
    export_draco_mesh_compression_enable=True,
    export_draco_position_quantization=16, export_def_bones=False, export_yup=True,
    export_extras=True,
)

def log(*a):
    print(*a, flush=True)

def body_of():
    return [o for o in bpy.data.objects if o.type == 'MESH' and o.get('v6')][0]

def eyes_of():
    eyes = [o for o in bpy.data.objects if o.type == 'MESH' and 'face_eyes' in o.name]
    return eyes[0] if eyes else None

def tattoo_of():
    tats = [o for o in bpy.data.objects if o.type == 'MESH' and 'tattoo' in o.name.lower()]
    return tats[0] if tats else None

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

def find_image(name_substr):
    for img in bpy.data.images:
        if name_substr in (img.name or ''):
            return img
    return None

def image_to_np(img):
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, img.channels)
    return px

def np_to_image(img, arr):
    h, w, c = arr.shape
    assert (w, h) == tuple(img.size)
    flat = np.clip(arr, 0, 1).astype(np.float32).ravel()
    img.pixels = flat.tolist()
    img.update()

def clamped_unsharp(rgb_u8, radius=1.2, percent=70, threshold=2):
    im = Image.fromarray(rgb_u8, 'RGB')
    us = im.filter(ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold))
    lo_ = np.asarray(im.filter(ImageFilter.MinFilter(3)), np.int16)
    hi_ = np.asarray(im.filter(ImageFilter.MaxFilter(3)), np.int16)
    out = np.clip(np.asarray(us, np.int16), lo_, hi_).astype(np.uint8)
    return out

def dilate_uv_edges(rgb, mask, radius=2):
    """Push island colours into empty/gutter pixels to reduce mip bleed."""
    from scipy import ndimage
    if mask is None:
        # treat near-black/flat bg as gutter if mostly white atlas left
        lum = rgb.mean(2)
        mask = lum > 0.02
    dist, ind = ndimage.distance_transform_edt(~mask, return_distances=True, return_indices=True)
    out = rgb.copy()
    edge = (~mask) & (dist <= radius)
    ys, xs = np.where(edge)
    out[ys, xs] = rgb[ind[0, ys, xs], ind[1, ys, xs]]
    return out

def enhance_detail_atlas(img, sex):
    """AAA pass on body detail atlas (near-white shading map x COLOR_0)."""
    px = image_to_np(img)  # h,w,c float 0-1
    h, w, c = px.shape
    rgb = (np.clip(px[..., :3], 0, 1) * 255).astype(np.uint8)
    alpha = px[..., 3] if c > 3 else None

    # Split logical panels: left body (~0-0.5), right packed (~0.5-1) with hair in u>0.75
    x_mid = int(round(w * 0.5))
    x_hair = int(round(w * 0.75))

    # 1) Clamped unsharp whole atlas lightly
    sharp = clamped_unsharp(rgb, radius=1.0, percent=55, threshold=2)

    # 2) Stronger unsharp on hair panel (right-top) for strand grooves
    hair = rgb.copy()
    hair[:, x_hair:] = clamped_unsharp(rgb[:, x_hair:], radius=1.4, percent=95, threshold=1)
    # blend
    out = sharp.astype(np.float32)
    out[:, x_hair:] = 0.35 * out[:, x_hair:] + 0.65 * hair[:, x_hair:].astype(np.float32)

    # 3) Soft AO boost in already-dark recesses (hair + cloth folds): darken where lum < local mean
    lum = out.mean(2)
    blur = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=2.5)), np.float32)
    recess = np.clip((blur - lum) / 32.0, 0, 1)  # positive where darker than neighborhood
    # apply stronger in hair panel, gentle on left body
    ao = np.ones_like(lum)
    ao[:, x_hair:] -= 0.18 * recess[:, x_hair:]
    ao[:, :x_mid] -= 0.07 * recess[:, :x_mid]
    out = np.clip(out * ao[..., None], 0, 255)

    # 4) Cloth crisp white: left panel near-white texels -> push toward white, keep fold contrast
    left = out[:, :x_mid]
    ll = left.mean(2)
    clothish = (ll > 200) & (np.abs(left[..., 0] - left[..., 1]) < 18) & (np.abs(left[..., 1] - left[..., 2]) < 18)
    # lift mid-high whites
    lift = np.where(clothish, np.clip((ll - 200) / 55.0, 0, 1), 0)
    target = np.maximum(left, 245)
    left = left * (1 - 0.45 * lift[..., None]) + target * (0.45 * lift[..., None])
    # restore fold contrast via local unsharp on clothish only
    cloth_u8 = np.clip(left, 0, 255).astype(np.uint8)
    cloth_sh = clamped_unsharp(cloth_u8, radius=0.9, percent=80, threshold=1).astype(np.float32)
    m = clothish.astype(np.float32)[..., None]
    left = cloth_u8.astype(np.float32) * (1 - 0.55 * m) + cloth_sh * (0.55 * m)
    out[:, :x_mid] = left

    # 5) Skin soft cavity: very gentle local contrast on mid-grey left-panel (skin shading)
    skin_band = (ll > 160) & (ll < 235) & ~clothish
    if sex == 'male':
        # chest definition: slight amplify mid-tone contrast
        skin_u8 = np.clip(out[:, :x_mid], 0, 255).astype(np.uint8)
        skin_sh = clamped_unsharp(skin_u8, radius=1.6, percent=40, threshold=3).astype(np.float32)
        sm = skin_band.astype(np.float32)[..., None]
        out[:, :x_mid] = out[:, :x_mid] * (1 - 0.35 * sm) + skin_sh * (0.35 * sm)
    else:
        # female tank ribbing lives in cloth whites already sharpened
        pass

    # 6) UV gutter dilation (avoid creating cyan streaks — only dilate into near-bg)
    lum2 = out.mean(2)
    island = lum2 > 8
    try:
        out = dilate_uv_edges(out, island, radius=2)
    except Exception as e:
        log('dilate skip', e)

    out_f = np.clip(out / 255.0, 0, 1)
    if alpha is not None:
        arr = np.concatenate([out_f, alpha[..., None]], axis=2)
    else:
        arr = out_f
    np_to_image(img, arr)
    log('detail atlas enhanced', sex, img.name, img.size[:])

def enhance_eye_albedo(img, sex):
    """Crisp lashes, richer iris gradient, dual catchlights — keep iris tintable (blue>red)."""
    px = image_to_np(img)
    h, w, c = px.shape
    rgb = px[..., :3].copy()
    alpha = px[..., 3] if c > 3 else np.ones((h, w), np.float32)

    # Work in u8 for filters
    u8 = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    sharp = clamped_unsharp(u8, radius=0.9, percent=65, threshold=1).astype(np.float32) / 255.0

    r, g, b = sharp[..., 0], sharp[..., 1], sharp[..., 2]
    blu = b - r
    iris = (blu > 0.08) & (b > 0.25)
    # dark upper / outline-ish: low lum near iris
    lum = sharp.mean(2)
    dark = (lum < 0.28) & (lum > 0.02)

    # Enrich iris: deepen outer blue, keep highlights
    iris_out = sharp.copy()
    # darken mid iris slightly toward richer blue
    deep = iris & (lum < 0.72) & (lum > 0.25)
    iris_out[deep, 0] *= 0.88
    iris_out[deep, 1] *= 0.92
    iris_out[deep, 2] = np.clip(iris_out[deep, 2] * 1.06, 0, 1)
    # catchlights: near-white pixels in iris neighborhood
    hl = iris & (lum > 0.78) & (r > 0.7)
    iris_out[hl] = np.clip(iris_out[hl] * 0.15 + np.array([1.0, 1.0, 1.0]) * 0.85, 0, 1)

    # Crisp dark lashes/brows: darken dark ink slightly, keep brown brows
    ink = dark & (b < 0.35)
    iris_out[ink] *= 0.82

    # Protect non-face regions: only blend where blue or dark ink present meaningfully
    # Find face-ish bbox from iris
    if iris.any():
        ys, xs = np.where(iris)
        y0, y1 = max(0, ys.min() - 80), min(h, ys.max() + 80)
        x0, x1 = max(0, xs.min() - 120), min(w, xs.max() + 120)
        region = np.zeros((h, w), bool)
        region[y0:y1, x0:x1] = True
        mix = (iris | dark) & region
        m = mix.astype(np.float32)[..., None]
        # also lightly unsharp the face region
        face_u8 = u8.copy()
        face_u8[y0:y1, x0:x1] = clamped_unsharp(u8[y0:y1, x0:x1], radius=0.8, percent=50, threshold=2)
        face = face_u8.astype(np.float32) / 255.0
        base = rgb * (1 - 0.4 * region[..., None].astype(np.float32)) + face * (0.4 * region[..., None].astype(np.float32))
        out = base * (1 - 0.75 * m) + iris_out * (0.75 * m)
    else:
        out = sharp

    arr = np.concatenate([np.clip(out, 0, 1), alpha[..., None]], 2) if c > 3 else np.clip(out, 0, 1)
    np_to_image(img, arr)
    log('eye albedo enhanced', sex, img.name, 'iris_px', int(iris.sum()))

def enhance_tattoo(img):
    if img is None:
        return
    px = image_to_np(img)
    u8 = (np.clip(px[..., :3], 0, 1) * 255).astype(np.uint8)
    sh = clamped_unsharp(u8, radius=0.7, percent=60, threshold=1)
    out = sh.astype(np.float32) / 255.0
    if px.shape[2] > 3:
        arr = np.concatenate([out, px[..., 3:4]], 2)
    else:
        arr = out
    np_to_image(img, arr)
    log('tattoo sharpened', img.name)

def smooth_normals_male(me, T, P):
    """Gentle torso/limb normal soften — NEVER remesh neck, NEVER touch hair."""
    NN = corner_normals_as_vertex(me)
    skin = (T == 0)
    # torso + upper arms (avoid head z>1.15 and feet)
    region = skin & (P[:, 2] > 0.35) & (P[:, 2] < 1.12) & (np.abs(P[:, 0]) < 0.45)
    idxs = np.where(region)[0]
    if not len(idxs):
        return 0
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
    log('male normals smoothed', touched)
    return touched

def smooth_normals_female(me, T, P):
    """Reinforce polish5 neck analytical normals + shoulder/collar blend + under-jaw."""
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

    # Shoulder / clavicle soft blend
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

    # Under-jaw
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

    # Soft torso (gentle)
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
    log('female normals', 'forced', forced, 'core', int(core.sum()), 'shoulder', int(shoulder.sum()))
    return forced

def crisp_cloth_border_colors(me, T, P, sex):
    """Ensure cloth COLOR_0 stays bright white on underwear borders."""
    ca = me.color_attributes['Color']
    C = np.zeros(len(ca.data) * 4)
    ca.data.foreach_get('color', C)
    C = C.reshape(-1, 4)
    # per-vert average
    Cv = np.zeros((len(me.vertices), 4))
    cnt = np.zeros(len(me.vertices))
    for li, l in enumerate(me.loops):
        Cv[l.vertex_index] += C[li]
        cnt[l.vertex_index] += 1
    Cv /= np.maximum(cnt, 1)[:, None]
    cloth = (T == -1)
    # keep cloth verts near-white
    Cv[cloth, 0] = np.maximum(Cv[cloth, 0], 0.96)
    Cv[cloth, 1] = np.maximum(Cv[cloth, 1], 0.96)
    Cv[cloth, 2] = np.maximum(Cv[cloth, 2], 0.96)
    for li, l in enumerate(me.loops):
        v = Cv[l.vertex_index]
        ca.data[li].color = (float(v[0]), float(v[1]), float(v[2]), 1.0)
    log('cloth COLOR_0 crisped', int(cloth.sum()))

def main():
    log('AAA polish', SEX, SRC, '->', OUT)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SRC))
    body = body_of()
    me = body.data
    T = get_tint(me)
    P = get_pos(me)
    log('verts', len(me.vertices), 'tint', {int(k): int((T == k).sum()) for k in sorted(set(T.tolist()))})

    # --- textures ---
    detail = find_image(f'{SEX}_detail') or find_image('detail_v5head')
    albedo = find_image(f'{SEX}_albedo') or find_image('albedo_notat')
    pill = find_image('pill_tattoo')
    if detail is None:
        # fallback: body material image
        for n in body.material_slots[0].material.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                detail = n.image
                break
    if albedo is None:
        ey = eyes_of()
        if ey:
            for n in ey.material_slots[0].material.node_tree.nodes:
                if n.type == 'TEX_IMAGE' and n.image:
                    albedo = n.image
                    break
    log('images', detail.name if detail else None, albedo.name if albedo else None, pill.name if pill else None)
    if detail:
        enhance_detail_atlas(detail, SEX)
    if albedo:
        enhance_eye_albedo(albedo, SEX)
    if SEX == 'male':
        enhance_tattoo(pill)

    # --- normals ---
    if SEX == 'male':
        smooth_normals_male(me, T, P)
    else:
        smooth_normals_female(me, T, P)

    crisp_cloth_border_colors(me, T, P, SEX)

    # Re-encode textures as WebP (quality 92) via PIL so GLB stays web-sized
    texdir = OUT.parent / f'_tex_{SEX}_{OUT.stem}'
    texdir.mkdir(parents=True, exist_ok=True)
    for img in list(bpy.data.images):
        if not img.pixels or img.size[0] == 0:
            continue
        if img.name.startswith('Render') or img.name.startswith('Viewer'):
            continue
        w, h = img.size
        px = image_to_np(img)
        if px.shape[2] >= 4:
            pil = Image.fromarray((np.clip(px[..., :4], 0, 1) * 255).astype(np.uint8), 'RGBA')
        else:
            pil = Image.fromarray((np.clip(px[..., :3], 0, 1) * 255).astype(np.uint8), 'RGB')
        fp = texdir / (img.name.replace('.', '_') + '.webp')
        pil.save(fp, 'WEBP', quality=92, method=4)
        img.source = 'FILE'
        img.filepath = str(fp)
        img.reload()
        log('rewrote webp', fp.name, fp.stat().st_size)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), **BLENDER_EXPORT)
    log('exported', OUT, 'bytes', OUT.stat().st_size)

if __name__ == '__main__':
    main()
