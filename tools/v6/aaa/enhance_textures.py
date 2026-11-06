#!/usr/bin/env python3
"""Enhance V6 character textures on disk (no Blender required)."""
import io, struct, json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

def clamped_unsharp(rgb_u8, radius=1.2, percent=70, threshold=2):
    im = Image.fromarray(rgb_u8, 'RGB')
    us = im.filter(ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold))
    lo_ = np.asarray(im.filter(ImageFilter.MinFilter(3)), np.int16)
    hi_ = np.asarray(im.filter(ImageFilter.MaxFilter(3)), np.int16)
    return np.clip(np.asarray(us, np.int16), lo_, hi_).astype(np.uint8)

def dilate_uv_edges(rgb, mask, radius=2):
    from scipy import ndimage
    dist, ind = ndimage.distance_transform_edt(~mask, return_distances=True, return_indices=True)
    out = rgb.copy()
    edge = (~mask) & (dist <= radius)
    ys, xs = np.where(edge)
    out[ys, xs] = rgb[ind[0, ys, xs], ind[1, ys, xs]]
    return out

def enhance_detail(im: Image.Image, sex: str) -> Image.Image:
    rgb = np.asarray(im.convert('RGB'), np.uint8)
    h, w, _ = rgb.shape
    x_mid = int(round(w * 0.5))
    x_hair = int(round(w * 0.75))
    sharp = clamped_unsharp(rgb, radius=1.0, percent=55, threshold=2).astype(np.float32)
    hair = rgb.copy()
    hair[:, x_hair:] = clamped_unsharp(rgb[:, x_hair:], radius=1.4, percent=95, threshold=1)
    out = sharp
    out[:, x_hair:] = 0.35 * out[:, x_hair:] + 0.65 * hair[:, x_hair:].astype(np.float32)
    lum = out.mean(2)
    blur = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=2.5)), np.float32)
    recess = np.clip((blur - lum) / 32.0, 0, 1)
    ao = np.ones_like(lum)
    ao[:, x_hair:] -= 0.18 * recess[:, x_hair:]
    ao[:, :x_mid] -= 0.07 * recess[:, :x_mid]
    out = np.clip(out * ao[..., None], 0, 255)
    left = out[:, :x_mid]
    ll = left.mean(2)
    clothish = (ll > 200) & (np.abs(left[..., 0] - left[..., 1]) < 18) & (np.abs(left[..., 1] - left[..., 2]) < 18)
    lift = np.where(clothish, np.clip((ll - 200) / 55.0, 0, 1), 0)
    target = np.maximum(left, 245)
    left = left * (1 - 0.45 * lift[..., None]) + target * (0.45 * lift[..., None])
    cloth_u8 = np.clip(left, 0, 255).astype(np.uint8)
    cloth_sh = clamped_unsharp(cloth_u8, radius=0.9, percent=80, threshold=1).astype(np.float32)
    m = clothish.astype(np.float32)[..., None]
    left = cloth_u8.astype(np.float32) * (1 - 0.55 * m) + cloth_sh * (0.55 * m)
    out[:, :x_mid] = left
    if sex == 'male':
        skin_band = (ll > 160) & (ll < 235) & ~clothish
        skin_u8 = np.clip(out[:, :x_mid], 0, 255).astype(np.uint8)
        skin_sh = clamped_unsharp(skin_u8, radius=1.6, percent=40, threshold=3).astype(np.float32)
        sm = skin_band.astype(np.float32)[..., None]
        out[:, :x_mid] = out[:, :x_mid] * (1 - 0.35 * sm) + skin_sh * (0.35 * sm)
    try:
        out = dilate_uv_edges(out, out.mean(2) > 8, radius=2)
    except Exception as e:
        print('dilate skip', e)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGB')

def enhance_eyes(im: Image.Image, sex: str) -> Image.Image:
    rgba = im.convert('RGBA')
    arr = np.asarray(rgba, np.float32) / 255.0
    rgb = arr[..., :3]
    alpha = arr[..., 3]
    u8 = (np.clip(rgb, 0, 1) * 255).astype(np.uint8)
    sharp = clamped_unsharp(u8, radius=0.9, percent=65, threshold=1).astype(np.float32) / 255.0
    r, g, b = sharp[..., 0], sharp[..., 1], sharp[..., 2]
    blu = b - r
    iris = (blu > 0.08) & (b > 0.25)
    lum = sharp.mean(2)
    dark = (lum < 0.28) & (lum > 0.02)
    iris_out = sharp.copy()
    deep = iris & (lum < 0.72) & (lum > 0.25)
    iris_out[deep, 0] *= 0.88
    iris_out[deep, 1] *= 0.92
    iris_out[deep, 2] = np.clip(iris_out[deep, 2] * 1.06, 0, 1)
    hl = iris & (lum > 0.78) & (r > 0.7)
    iris_out[hl] = np.clip(iris_out[hl] * 0.15 + np.array([1.0, 1.0, 1.0]) * 0.85, 0, 1)
    ink = dark & (b < 0.35)
    iris_out[ink] *= 0.82
    h, w = lum.shape
    if iris.any():
        ys, xs = np.where(iris)
        y0, y1 = max(0, ys.min() - 80), min(h, ys.max() + 80)
        x0, x1 = max(0, xs.min() - 120), min(w, xs.max() + 120)
        region = np.zeros((h, w), bool); region[y0:y1, x0:x1] = True
        mix = (iris | dark) & region
        m = mix.astype(np.float32)[..., None]
        face_u8 = u8.copy()
        face_u8[y0:y1, x0:x1] = clamped_unsharp(u8[y0:y1, x0:x1], radius=0.8, percent=50, threshold=2)
        face = face_u8.astype(np.float32) / 255.0
        base = rgb * (1 - 0.4 * region[..., None].astype(np.float32)) + face * (0.4 * region[..., None].astype(np.float32))
        out = base * (1 - 0.75 * m) + iris_out * (0.75 * m)
    else:
        out = sharp
    out_a = np.dstack([np.clip(out, 0, 1), alpha])
    print(f'eyes {sex} iris_px={int(iris.sum())}')
    return Image.fromarray((out_a * 255).astype(np.uint8), 'RGBA')

def enhance_tattoo(im: Image.Image) -> Image.Image:
    rgba = im.convert('RGBA')
    rgb = np.asarray(rgba.convert('RGB'), np.uint8)
    sh = clamped_unsharp(rgb, radius=0.7, percent=60, threshold=1)
    a = np.asarray(rgba)[..., 3]
    return Image.fromarray(np.dstack([sh, a]), 'RGBA')

def parse_glb(path):
    data = Path(path).read_bytes(); off = 12; length = struct.unpack_from('<I', data, 8)[0]
    g = None; blob = None
    while off < length:
        clen, ctype = struct.unpack_from('<I4s', data, off); off += 8
        chunk = data[off:off + clen]; off += clen
        if ctype == b'JSON': g = json.loads(chunk)
        elif ctype == b'BIN\x00': blob = chunk
    return g, bytearray(blob)

def write_glb(path, g, blob: bytes):
    js = json.dumps(g, separators=(',', ':')).encode()
    while len(js) % 4: js += b' '
    blob = bytes(blob)
    while len(blob) % 4: blob += b'\x00'
    out = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(blob))
    out += struct.pack('<I', len(js)) + b'JSON' + js
    out += struct.pack('<I', len(blob)) + b'BIN\x00' + blob
    Path(path).write_bytes(out)

def inject(glb_path, replacements: dict, out_path):
    """replacements: image_name -> PIL Image"""
    g, blob = parse_glb(glb_path)
    views = []
    for v in g['bufferViews']:
        o = v.get('byteOffset', 0); views.append(bytes(blob[o:o + v['byteLength']]))
    for img in g['images']:
        name = img.get('name', '')
        if name not in replacements and name + '.webp' not in replacements:
            # try stem match
            hit = None
            for k in replacements:
                if k == name or k.startswith(name) or name.startswith(k.split('.')[0]):
                    hit = k; break
            if hit is None:
                continue
            name = hit
        if name not in replacements:
            continue
        im = replacements[name]
        bio = io.BytesIO(); im.save(bio, 'WEBP', quality=92, method=4)
        raw = bio.getvalue()
        bv = img['bufferView']
        views[bv] = raw
        img['mimeType'] = 'image/webp'
        print(f'inject {name}: {len(raw)} bytes')
    # rebuild bin
    nb = bytearray()
    for v, d in zip(g['bufferViews'], views):
        while len(nb) % 4: nb.append(0)
        v['byteOffset'] = len(nb); v['byteLength'] = len(d); nb += d
    while len(nb) % 4: nb.append(0)
    g['buffers'][0]['byteLength'] = len(nb)
    write_glb(out_path, g, nb)
    print('wrote', out_path, Path(out_path).stat().st_size)

def run(sex, src_glb, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    g, blob = parse_glb(src_glb)
    reps = {}
    for img in g['images']:
        name = img.get('name', '')
        bv = g['bufferViews'][img['bufferView']]
        raw = bytes(blob[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])
        im = Image.open(io.BytesIO(raw))
        if 'detail' in name:
            enh = enhance_detail(im, sex)
        elif 'albedo' in name:
            enh = enhance_eyes(im, sex)
        elif 'pill' in name or 'tattoo' in name:
            enh = enhance_tattoo(im)
        else:
            continue
        fp = out_dir / f'{name}_aaa.webp'
        enh.save(fp, 'WEBP', quality=92, method=4)
        reps[name] = enh
        print('saved', fp, fp.stat().st_size)
    return reps

if __name__ == '__main__':
    sex, src, outdir = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    run(sex, src, outdir)
