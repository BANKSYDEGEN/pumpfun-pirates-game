# [Timothy] PUMPFUN PIRATES shared material library textures: 12 stylized tiling layers -> assets/island/tex/lib.ktx2 (desktop 1024) +
# lib_lo.ktx2 (phones 512), one Basis ETC1S 2D-array each (mipmapped; GPU-transcoded to BC7 / ETC2 / ASTC = ~1 byte per texel).
# Sources: CC0 Poly Haven 1k colour + displacement sets (tex/CREDITS.md). Run: python3 make_textures.py SRC_DIR [BASISU]
# Grade (one rule for every layer, so every area matches): the vertex colour carries the hue, the texture the pattern and the light.
#   - "painted" flattening: a wrap-around median filter removes photo noise, a soft unsharp brings the shapes back (toon-friendly)
#   - joints / cavities darkened from the displacement map (mortar, tile gaps, board seams read like the ships' painted planking)
#   - luminance rescaled to a mean of 0.5 (the shader multiplies by 2, so vertex colour x texture keeps the palette brightness),
#     contrast clamped to 0.22..0.86, saturation partly kept (KEEP) so bricks / roof tiles / cobbles keep a little hue variation
#   - A = displacement, normalised per layer (desktop bump; phones skip it)
import sys, os, subprocess, json, numpy as np
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from materials import NAMES
SRC = sys.argv[1]; BASISU = sys.argv[2] if len(sys.argv) > 2 else 'basisu'
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'island', 'tex')); TMP = '/tmp/libtex'; os.makedirs(OUT, exist_ok=True); os.makedirs(TMP, exist_ok=True)
S = 1024
def L(n, k): return Image.open(os.path.join(SRC, f'{n}_{k}_1k.jpg')).convert('RGB' if k == 'diff' else 'L').resize((S, S), Image.LANCZOS)
def wrapf(im, f):   # filter with wrap-around (tiles stay seamless)
    w, h = im.size; big = Image.new(im.mode, (w * 3, h * 3))
    for i in range(3):
        for j in range(3): big.paste(im, (i * w, j * h))
    return big.filter(f).crop((w, h, 2 * w, 2 * h))
SRCS = {   # layer: (source, rot90 so the grain runs along u, median size, cavity strength, saturation kept, contrast, high-pass flatten)
    'stone_ashlar':     ('large_sandstone_blocks_01', 0, 7, 0.45, 0.12, 0.62, 1.0),
    'stone_trim':       ('sandstone_cracks',          0, 5, 0.30, 0.10, 0.55, 1.0),
    'brick':            ('red_brick_03',              0, 3, 0.50, 0.40, 0.85, 0.7),
    'plaster':          ('plastered_wall_04',         0, 5, 0.25, 0.05, 0.45, 1.0),
    'cobble':           ('cobblestone_floor_04',      0, 5, 0.45, 0.15, 0.70, 1.0),
    'timber':           ('wood_cabinet_worn_long',    1, 3, 0.35, 0.22, 0.80, 0.9),
    'planks_weathered': ('wood_planks',               0, 3, 0.45, 0.22, 0.85, 0.9),
    'piling_wet':       ('wood_cabinet_worn_long',    1, 3, 0.40, 0.15, 0.80, 0.9),
    'roof_tile':        ('clay_roof_tiles_02',        0, 3, 0.50, 0.30, 0.80, 0.8),
    'iron':             ('rusty_metal_02',            0, 5, 0.20, 0.35, 0.45, 1.0),
    'rope':             (None,                        0, 0, 0.50, 0.00, 0.90, 0.0),
    'awning_cloth':     (None,                        0, 0, 0.30, 0.00, 0.70, 0.0),
}
def rope():
    y, x = np.mgrid[0:S, 0:S] / S; rng = np.random.default_rng(3)
    fib = np.asarray(Image.fromarray((rng.random((S, S)) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5)), float) / 255
    ph = (x * 4 + y * 8) % 1.0; h = np.sin(ph * np.pi) ** 0.6 * 0.85 + 0.15 * fib      # 3-strand twist along u
    return np.stack([0.80 * h + 0.12, 0.66 * h + 0.10, 0.44 * h + 0.07], -1), h
def weave():   # canvas: over-under threads + slub noise
    y, x = np.mgrid[0:S, 0:S]; n = 96; u = (x * n / S) % 1; v = (y * n / S) % 1; cx = (np.floor(x * n / S) + np.floor(y * n / S)) % 2
    tu = np.sin(u * np.pi) ** 0.5; tv = np.sin(v * np.pi) ** 0.5; h = np.where(cx > 0, tu * (0.6 + 0.4 * tv), tv * (0.6 + 0.4 * tu))
    rng = np.random.default_rng(5); sl = np.asarray(Image.fromarray((rng.random((S // 8, S // 8)) * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC), float) / 255
    h = h * (0.85 + 0.15 * sl); return np.stack([h * 0.9 + 0.1] * 3, -1), h
def blurw(a, r):   # wrap-around gaussian (FFT: tiles stay seamless)
    h, w = a.shape; fy = np.fft.fftfreq(h)[:, None]; fx = np.fft.fftfreq(w)[None, :]
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-2 * (np.pi * r) ** 2 * (fx ** 2 + fy ** 2))))
def smooth(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
stats = {}
for li, name in enumerate(NAMES):
    src, rot, med, cav, keep, con, hp = SRCS[name]
    if name == 'rope': rgb, h = rope()
    elif name == 'awning_cloth': rgb, h = weave()
    else:
        d, disp = L(src, 'diff'), L(src, 'disp')
        if rot: d, disp = d.rotate(90), disp.rotate(90)
        if med: d = wrapf(wrapf(d, ImageFilter.MedianFilter(med)), ImageFilter.UnsharpMask(3, 60, 2))
        rgb = np.asarray(d, float) / 255; h = np.asarray(wrapf(disp, ImageFilter.GaussianBlur(1.0)), float) / 255
        if name == 'iron':   # blackened iron with rust specks (not the bright rusty sheet)
            r = rgb; rust = np.clip((r[..., 0] - r[..., 2] - 0.3) * 2.5, 0, 1)[..., None]; lum = r.mean(-1, keepdims=True)
            rgb = (0.35 + 0.3 * lum) * (1 - rust * 0.6) + r * rust * 0.6
    h = (h - np.percentile(h, 2)) / max(np.percentile(h, 98) - np.percentile(h, 2), 1e-4); h = np.clip(h, 0, 1)
    LW = np.array([0.2126, 0.7152, 0.0722]); lin = rgb ** 2.2; Y = lin @ LW
    if hp: lin = lin * ((Y.mean() / np.maximum(blurw(Y, S / 20), 1e-3)) ** hp)[..., None]   # flatten blotches (no visible tiling repeat)
    Y = lin @ LW; lin = Y[..., None] + (lin - Y[..., None]) * keep                # partial desaturation
    Y = lin @ LW; lin = lin * (0.5 / max(Y.mean(), 1e-4)); lin = 0.5 + (lin - 0.5) * con   # mean 0.5 (x2 in the shader), softer contrast
    lin = lin * (1 - cav * (1 - smooth(0.05, 0.45, h)))[..., None]                 # joints / cavities darker
    Y = lin @ LW; lin = lin * (0.5 / max(Y.mean(), 1e-4)); lin = np.clip(lin, 0.2, 0.85)
    out = np.clip(lin, 0, 1) ** (1 / 2.2)
    rgba = np.concatenate([out, h[..., None]], -1)
    im = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA')
    for sz, tag in ((1024, 'hi'), (512, 'lo')):   # RGB and A resized apart: PIL premultiplies RGBA, which wrecks the colour where the height (A) is 0
        r, g, bb, a = im.split(); Image.merge('RGBA', (*Image.merge('RGB', (r, g, bb)).resize((sz, sz), Image.LANCZOS).split(), a.resize((sz, sz), Image.LANCZOS))).save(f'{TMP}/{tag}_{li:02d}_{name}.png')
    im.convert('RGB').resize((256, 256), Image.LANCZOS).save(f'{TMP}/prev_{li:02d}_{name}.jpg', quality=90)
    stats[name] = dict(mean_rgb=[round(float(v), 3) for v in out.reshape(-1, 3).mean(0)], src=src or 'procedural')
    print(name, stats[name], flush=True)
for tag, f, q in ((() if os.environ.get('NOKTX') else (('hi', 'lib.ktx2', 160), ('lo', 'lib_lo.ktx2', 128)))):
    ins = [f'{TMP}/{tag}_{i:02d}_{n}.png' for i, n in enumerate(NAMES)]
    cmd = [BASISU, '-ktx2', '-tex_array', '-tex_type', '2darray', '-mipmap', '-q', str(q), '-comp_level', '2', '-output_file', os.path.join(OUT, f)] + ins
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL); print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, 'KB', flush=True)
json.dump(dict(layers=NAMES, stats=stats), open(os.path.join(TMP, 'lib_stats.json'), 'w'), indent=1)
