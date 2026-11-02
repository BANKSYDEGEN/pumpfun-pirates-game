# [Raul] PUMPFUN PIRATES island: hand-painted-style TRIM SHEET for the Blender town kit (colonial houses, piers, props).
# Strips tile horizontally (U wraps), so long walls / beams / planks / roof rows repeat seamlessly. Fixtures (door,
# window, shutters, iron, rope, cloth) are single cells. Outputs albedo (A = emissive mask: 0 = glows) + normal (from height).
# python3 trimsheet.py OUTDIR [size]
import sys, json, numpy as np
from PIL import Image
from scipy.ndimage import zoom, sobel, gaussian_filter
OUT = sys.argv[1]; S = int(sys.argv[2]) if len(sys.argv) > 2 else 2048; k = S / 2048
rng = np.random.default_rng(7)
def tnoise(h, w, ch, cw, seed, oct=4):            # tileable value-noise fbm (wraps in x and y)
    r = np.random.default_rng(seed); acc = np.zeros((h, w)); a = 1; tot = 0
    for o in range(oct):
        g = r.random((ch * 2 ** o, cw * 2 ** o)); g3 = np.tile(g, (3, 3))
        z = zoom(g3, (h * 3 / g3.shape[0], w * 3 / g3.shape[1]), order=3, mode='grid-wrap')[h:2 * h, w:2 * w]
        acc += a * z[:h, :w]; tot += a; a *= 0.5
    return acc / tot
def px(v): return int(round(v * k))
A = np.zeros((S, S, 3)); Hh = np.zeros((S, S)); E = np.ones((S, S)); NS = np.ones((S, S))  # albedo, height, emissive mask, normal strength
R = {}
def region(name, y0, y1, x0=0, x1=2048):
    R[name] = dict(u0=x0 / 2048, u1=x1 / 2048, v0=1 - y1 / 2048, v1=1 - y0 / 2048)  # glTF/Blender UV (v up)
    return slice(px(y0), px(y1)), slice(px(x0), px(x1))
def col(hexs): return np.array([int(hexs[i:i + 2], 16) / 255 for i in (0, 2, 4)])
def paint(sl, base, shade, var=None, varc=None):
    h, w = shade.shape; c = base[None, None, :] * shade[..., None]
    if var is not None: c = c * (1 - var[..., None]) + varc[None, None, :] * shade[..., None] * var[..., None]
    A[sl] = c
# --- plaster x4: soft mottling, hairline cracks, damp at the foot, flaked patches showing brick
for i, (name, hx) in enumerate([('plaster0', 'f6ead2'), ('plaster1', 'efcf95'), ('plaster2', 'eaa98a'), ('plaster3', 'b9dcd8')]):
    sl = region(name, i * 224, i * 224 + 220); h, w = px(220), S
    n = tnoise(h, w, 4, 36, 10 + i); n2 = tnoise(h, w, 12, 110, 20 + i, 3); cr = np.abs(tnoise(h, w, 3, 28, 30 + i, 3) - 0.5) < 0.008
    flake = (tnoise(h, w, 3, 30, 40 + i) > 0.79)
    yy = np.linspace(0, 1, h)[:, None] * np.ones((1, w)); damp = np.clip((yy - 0.82) / 0.18, 0, 1) ** 1.5
    bx = (np.arange(w)[None, :] + (np.arange(h)[:, None] // px(18) % 2) * px(22)) % px(44); brick = ((bx < px(3)) | (np.arange(h)[:, None] % px(18) < px(3)))
    shade = 0.86 + 0.16 * n + 0.06 * (n2 - 0.5) - 0.12 * cr - 0.22 * damp
    paint(sl, col(hx), shade); A[sl][flake] = (col('b5674a') * (0.8 + 0.2 * n[flake, None]) * np.where(brick[flake], 0.6, 1.0)[:, None])
    Hh[sl] = 0.55 + 0.15 * n + 0.1 * n2 - 0.3 * cr - 0.25 * flake - 0.1 * (flake & brick); NS[sl] = 1.2
# --- timber beam (dark, grain along U, end-checks)
sl = region('timber', 896, 958); h = px(62); g = tnoise(h, S, 2, 6, 50); gr = 0.5 + 0.5 * np.sin((np.arange(h)[:, None] / h * 9 + g * 3) * np.pi * 2) * np.ones((1, S))
fib = tnoise(h, S, 16, 40, 51, 2); paint(sl, col('6a4428'), 0.75 + 0.2 * gr + 0.15 * fib); Hh[sl] = 0.5 + 0.25 * gr + 0.1 * fib; NS[sl] = 1.5
# --- planks (light, 6 boards across the strip, gaps, nail heads, per-board tone)
sl = region('planks', 960, 1150); h = px(190); yy = np.arange(h)[:, None] * np.ones((1, S)); board = (yy // (h / 6)).astype(int); fy = (yy % (h / 6)) / (h / 6)
xx = np.arange(S)[None, :] * np.ones((h, 1)); seam = ((xx + board * px(311)) % px(640)) < px(3)
g = tnoise(h, S, 3, 8, 60); gr = 0.5 + 0.5 * np.sin((fy * 3 + g * 2.5) * np.pi * 2); tone = rng.random(12)[board % 12]
gap = (fy < 0.05) | (fy > 0.95) | seam; nail = (((xx + board * px(311)) % px(640)) - px(14)) ** 2 + (fy * h / 6 - h / 12) ** 2 < px(4) ** 2
paint(sl, col('c08a55'), (0.78 + 0.12 * gr + 0.18 * (tone - 0.5)) * np.where(gap, 0.35, 1) * np.where(nail, 0.5, 1)); Hh[sl] = 0.6 + 0.15 * gr - 0.5 * gap + 0.2 * nail; NS[sl] = 2.0
# --- roof tiles (barrel/scallop rows along U, colour variation per tile, moss)
sl = region('roof', 1152, 1406); h = px(254); rows = 8; yy = np.arange(h)[:, None] * np.ones((1, S)); row = (yy // (h / rows)).astype(int); fy = (yy % (h / rows)) / (h / rows)
xx = np.arange(S)[None, :] + (row % 2) * px(32); tw = px(64); fx = (xx % tw) / tw; tid = (xx // tw + row * 97) % 251
dome = np.sqrt(np.clip(1 - (2 * fx - 1) ** 2, 0, 1)); edge = np.clip(fy * 4, 0, 1)
tv = np.random.default_rng(3).random(251)[tid]; moss = np.clip((tnoise(h, S, 3, 24, 70) - 0.68) * 4, 0, 1)
shade = (0.55 + 0.45 * dome * edge) * (0.85 + 0.25 * tv) * (1 - 0.25 * fy)
paint(sl, col('c4532c'), shade, moss * 0.7, col('6f8a3a')); Hh[sl] = 0.2 + 0.7 * dome * edge - 0.3 * (1 - fy); NS[sl] = 2.5
# --- dressed stone (ashlar courses, chisel noise, dark mortar)
sl = region('stone', 1408, 1630); h = px(222); cr = 5; yy = np.arange(h)[:, None] * np.ones((1, S)); row = (yy // (h / cr)).astype(int); fy = (yy % (h / cr)) / (h / cr)
bw = px(120); xx = np.arange(S)[None, :] + (row % 2) * bw // 2 + row * px(17); fx = (xx % bw) / bw; sid = (xx // bw + row * 53) % 199
e = np.minimum(np.minimum(fx, 1 - fx) * bw, np.minimum(fy, 1 - fy) * h / cr); mortar = e < px(4); bev = np.clip(e / px(10), 0, 1)
n = tnoise(h, S, 6, 50, 80); sv = np.random.default_rng(4).random(199)[sid]
paint(sl, col('b8b0a2'), np.where(mortar, 0.45, (0.72 + 0.2 * sv + 0.18 * n) * (0.8 + 0.2 * bev))); Hh[sl] = np.where(mortar, 0.1, 0.5 + 0.35 * bev + 0.15 * n); NS[sl] = 2.2
# --- rubble / cobble (voronoi-ish stones)
sl = region('rubble', 1632, 1758); h = px(126); pts = rng.random((260, 2)) * [h, S]; yy, xx = np.mgrid[0:h, 0:S]
d1 = np.full((h, S), 1e9); d2 = np.full((h, S), 1e9); sid = np.zeros((h, S), int)
for i, (py, pxx) in enumerate(pts):
    for oy in (-h, 0, h):
        for ox in (-S, 0, S):
            d = np.hypot(yy - py - oy, xx - pxx - ox); m = d < d1; d2 = np.where(m, d1, np.minimum(d2, d)); sid = np.where(m, i, sid); d1 = np.where(m, d, d1)
e = np.clip((d2 - d1) / px(10), 0, 1); sv = np.random.default_rng(5).random(260)[sid]
paint(sl, col('a49b8c'), (0.5 + 0.5 * e) * (0.75 + 0.3 * sv)); Hh[sl] = e * (0.6 + 0.4 * np.clip(1 - d1 / px(40), 0, 1)); NS[sl] = 2.0
# --- fixtures row (y 1760-2048)
y0, y1 = 1760, 2046; h = px(y1 - y0)
# door: vertical planks, iron straps + studs, stone-free (surround is modelled)
sl = region('door', y0, y1, 0, 256); w = px(256); xx = np.arange(w)[None, :] * np.ones((h, 1)); yy = np.arange(h)[:, None] * np.ones((1, w)); pl = (xx % px(51)) < px(3)
strap = (np.abs(yy - h * 0.2) < px(8)) | (np.abs(yy - h * 0.78) < px(8)); stud = strap & ((((xx % px(26)) - px(13)) ** 2) < px(16))
g = tnoise(h, w, 8, 2, 90); gr = 0.5 + 0.5 * np.sin((xx / w * 5 + g * 2) * np.pi * 2)
c = col('7a4a2a')[None, None, :] * ((0.75 + 0.2 * gr) * np.where(pl, 0.4, 1))[..., None]; c[strap] = col('2b2f36') * 1.2; c[stud] = col('8a8f99'); A[sl] = c
Hh[sl] = 0.6 + 0.1 * gr - 0.4 * pl + 0.25 * strap + 0.2 * stud; NS[sl] = 2.0
# window: timber frame + 6 panes (dark glass) ; lit window (warm, emissive) right next to it
for name, x0, lit in [('window', 256, False), ('windowLit', 512, True)]:
    sl = region(name, y0, y1, x0, x0 + 256); w = px(256); yy, xx = np.mgrid[0:h, 0:w]; fr = px(22); mu = px(9)
    inner = (xx > fr) & (xx < w - fr) & (yy > fr) & (yy < h - fr); mull = inner & ((np.abs(xx - w / 2) < mu / 2) | (np.abs(yy - h / 3) < mu / 2) | (np.abs(yy - 2 * h / 3) < mu / 2))
    glass = inner & ~mull; gy = yy / h
    c = np.zeros((h, w, 3)); c[:] = col('5b3a22') * 0.95; c[mull] = col('4a2f1c')
    if lit: c[glass] = (col('ffd27a') * (1.0 - 0.25 * gy[glass, None]) + col('ff9a3c') * 0.0); E[sl][glass] = 0
    else: c[glass] = col('2c4452') * (0.7 + 0.5 * (1 - gy[glass, None])) + 0.25 * ((xx[glass] - yy[glass] * 0.6) % px(90) < px(14))[:, None]
    A[sl] = c; Hh[sl] = np.where(glass, 0.2, np.where(mull, 0.55, 0.8)); NS[sl] = 2.0
# louvered shutters x4 colours
for i, hx in enumerate(['2a6df4', '1f8a5a', 'c0392b', '2b8fa3']):
    x0 = 768 + i * 128; sl = region('shutter%d' % i, y0, y1, x0, x0 + 128); w = px(128); yy, xx = np.mgrid[0:h, 0:w]
    fr = (xx < px(10)) | (xx > w - px(10)) | (yy < px(10)) | (yy > h - px(10)); lv = (yy % px(16)) / px(16)
    worn = tnoise(h, w, 6, 3, 100 + i) > 0.8
    shade = np.where(fr, 0.85, 0.65 + 0.35 * lv); c = col(hx)[None, None, :] * shade[..., None]; c[worn] = col('9a7a55') * shade[worn, None]; A[sl] = c
    Hh[sl] = np.where(fr, 0.8, 0.3 + 0.4 * lv); NS[sl] = 2.0
# iron, rope, gold, red cloth, lamp glass (emissive)
sl = region('iron', y0, y1, 1280, 1408); n = tnoise(h, px(128), 6, 3, 110); A[sl] = col('3a3f47')[None, None, :] * (0.7 + 0.5 * n[..., None]); Hh[sl] = 0.5 + 0.3 * n
sl = region('rope', y0, y1, 1408, 1536); yy, xx = np.mgrid[0:h, 0:px(128)]; tw = 0.5 + 0.5 * np.sin((xx * 0.15 + yy * 0.35) / k); A[sl] = col('c9a36b')[None, None, :] * (0.65 + 0.4 * tw[..., None]); Hh[sl] = tw; NS[sl] = 2
sl = region('gold', y0, y1, 1536, 1664); n = tnoise(h, px(128), 4, 2, 120); A[sl] = col('ffc93c')[None, None, :] * (0.8 + 0.35 * n[..., None]); Hh[sl] = 0.5 + 0.3 * n
sl = region('cloth', y0, y1, 1664, 1792); yy, xx = np.mgrid[0:h, 0:px(128)]; wv = ((xx // max(1, px(3)) + yy // max(1, px(3))) % 2) * 0.08; A[sl] = col('c8302b')[None, None, :] * (0.8 + wv[..., None]); Hh[sl] = 0.5 + wv
sl = region('lamp', y0, y1, 1792, 1920); A[sl] = col('ffd36b'); E[sl] = 0; Hh[sl] = 0.5
sl = region('dark', y0, y1, 1920, 2048); A[sl] = col('1c1712'); Hh[sl] = 0.4
# normal map (tangent space, +Y up = OpenGL/glTF), strength per region
Hs = gaussian_filter(Hh, 0.6 * k + 0.4, mode='wrap'); dx = sobel(Hs, 1, mode='wrap') * NS * 2.2 * k ** -1 / 4; dy = sobel(Hs, 0, mode='wrap') * NS * 2.2 * k ** -1 / 4
nz = np.ones_like(dx); L = np.sqrt(dx * dx + dy * dy + 1); N = np.stack([-dx / L, dy / L, nz / L], -1)
Image.fromarray((np.clip(A, 0, 1) * 255).astype(np.uint8)).save(f'{OUT}/trim_albedo_rgb.png')
Image.fromarray(np.dstack([(np.clip(A, 0, 1) * 255).astype(np.uint8), (E * 255).astype(np.uint8)])).save(f'{OUT}/trim_albedo.png')
Image.fromarray(((N * 0.5 + 0.5) * 255).astype(np.uint8)).save(f'{OUT}/trim_normal.png')
json.dump(R, open(f'{OUT}/trim_regions.json', 'w'), indent=1)
print('ok', S, len(R))
