# [Raul] PUMPFUN PIRATES island: hand-painted-style CARD SHEET for the Blender nature kit (alpha cut-out foliage).
# Cells: two palm fronds (fresh / sun-bleached), three broadleaf clusters, a fern frond, a hanging vine, an opaque white
# swatch (UV parking for the solid parts, so the cut-out shadow pass never discards them).
# Drawn at 4096 then downsampled (premultiplied) to OUT/nature_cards.png (2048) with colour bled into the clear areas.
# python3 naturesheet.py OUTDIR
import sys, json, math, numpy as np
from PIL import Image, ImageDraw, ImageFilter
OUT = sys.argv[1]; S = 4096; k = S / 2048
img = Image.new('RGBA', (S, S), (0, 0, 0, 0)); D = ImageDraw.Draw(img)
rng = np.random.default_rng(11); R = {}
def region(name, x0, y0, x1, y1): R[name] = dict(u0=x0 / 2048, u1=x1 / 2048, v0=1 - y1 / 2048, v1=1 - y0 / 2048)
def P(x, y): return (x * k, y * k)
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def leaflet(base, ang, L, w0, c0, c1, curve=0.18, segs=7, vein=None):
    """tapered, slightly curved blade from base along ang; c0 at base -> c1 at tip, darker edge side"""
    bx, by = base; dx, dy = math.cos(ang), math.sin(ang); nx, ny = -dy, dx
    for s in range(segs):
        t0, t1 = s / segs, (s + 1) / segs
        def pt(t, side):
            w = w0 * math.sin(math.pi * min(1.0, 0.15 + t * 0.95)) ** 0.8 * (1 - t * 0.35)
            bend = curve * L * t * t
            cx, cy = bx + dx * L * t + nx * bend, by + dy * L * t + ny * bend
            return (cx + nx * w * side, cy + ny * w * side)
        col = mix(c0, c1, (t0 + t1) / 2)
        D.polygon([P(*pt(t0, -1)), P(*pt(t1, -1)), P(*pt(t1, 0)), P(*pt(t0, 0))], fill=col + (255,))
        D.polygon([P(*pt(t0, 0)), P(*pt(t1, 0)), P(*pt(t1, 1)), P(*pt(t0, 1))], fill=mix(col, (0, 0, 0), 0.16) + (255,))
    if vein:
        pts = [P(bx + dx * L * t + nx * curve * L * t * t, by + dy * L * t + ny * curve * L * t * t) for t in np.linspace(0, 0.92, 8)]
        D.line(pts, fill=vein + (255,), width=max(1, int(1.6 * k)))
# --- palm fronds: rachis along +x (u), leaflets angled to the tip, both sides
def frond(y0, y1, cBase, cTip, cRach, seed):
    r = np.random.default_rng(seed); cy = (y0 + y1) / 2; W = 2040; half = (y1 - y0) / 2 - 6
    region('frond%d' % seed, 0, y0, 2048, y1)
    for side in (-1, 1):
        t = 0.05
        while t < 0.985:
            x = 8 + t * W; L = half * (0.25 + 0.75 * math.sin(math.pi * min(1, t * 1.05)) ** 0.6) * (0.85 + 0.25 * r.random())
            ang = side * (0.95 - 0.35 * t + 0.12 * (r.random() - 0.5)); ang = math.atan2(math.sin(ang) * 1.0, math.cos(ang))
            c0 = mix(cBase, (0, 0, 0), 0.15 + 0.1 * r.random()); c1 = mix(cTip, (255, 255, 200), 0.1 * r.random())
            leaflet((x, cy + side * 3), ang, L / max(0.35, abs(math.sin(ang))), 7.5 + 4 * (1 - t), c0, c1, curve=-side * 0.12, segs=6, vein=mix(c0, (255, 255, 180), 0.35))
            t += 0.016 + 0.006 * r.random()
    D.line([P(4, cy), P(2044, cy)], fill=cRach + (255,), width=int(9 * k))
    D.line([P(1300, cy), P(2046, cy)], fill=mix(cRach, (255, 255, 255), 0.2) + (255,), width=int(5 * k))
frond(0, 400, hexc('2f8f3a'), hexc('8fd65a'), hexc('b9b45a'), 1)
frond(400, 800, hexc('3d8a32'), hexc('d8c25a'), hexc('c8a85a'), 2)
# --- broadleaf clusters (jungle canopy fringe): overlapping pointed leaves radiating out of the cell centre-bottom
def cluster(x0, y0, x1, y1, pal, seed):
    r = np.random.default_rng(seed); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2; region('leaf%d' % seed, x0, y0, x1, y1)
    for i in range(26):
        a = r.random() * math.pi * 2; rad = (x1 - x0) * 0.16 * r.random()
        bx, by = cx + math.cos(a) * rad, cy + math.sin(a) * rad
        L = (x1 - x0) * (0.3 + 0.15 * r.random()); ang = a + (r.random() - 0.5) * 0.8
        c = pal[i % len(pal)]; light = 0.25 + 0.3 * r.random()
        leaflet((bx, by), ang, L, L * (0.2 + 0.06 * r.random()), mix(c, (0, 0, 0), 0.25), mix(c, (255, 255, 210), light), curve=(r.random() - 0.5) * 0.4, segs=8, vein=mix(c, (230, 255, 170), 0.45))
cluster(0, 800, 680, 1480, [hexc('2e8b3e'), hexc('3fa046'), hexc('257a35')], 3)
cluster(684, 800, 1364, 1480, [hexc('4aa842'), hexc('5fb84a'), hexc('3a9a3e')], 4)
cluster(1368, 800, 2048, 1480, [hexc('2a7a40'), hexc('338a4a'), hexc('1f6e38')], 5)
# --- fern frond: rachis along u, dense small pinnae
region('fern', 0, 1484, 1024, 1800)
r = np.random.default_rng(6); cy = 1642
for side in (-1, 1):
    t = 0.04
    while t < 0.98:
        x = 10 + t * 1000; L = 140 * math.sin(math.pi * min(1, t * 1.02)) ** 0.7 + 10
        leaflet((x, cy), side * (1.15 - 0.4 * t), L, 9 * (1 - 0.5 * t) + 3, hexc('2c7d30'), hexc('7cc94e'), curve=-side * 0.2, segs=5, vein=hexc('9ad66a'))
        t += 0.028
D.line([P(6, cy), P(1018, cy)], fill=hexc('5a8a2a') + (255,), width=int(6 * k))
# --- hanging vine: a strand along u with small heart leaves
region('vine', 1024, 1484, 2048, 1800)
cy = 1642; pts = [P(1030 + t * 1010, cy + 18 * math.sin(t * 9)) for t in np.linspace(0, 1, 40)]; D.line(pts, fill=hexc('4a6a28') + (255,), width=int(7 * k))
for i in range(34):
    t = (i + 0.5) / 34; x = 1030 + t * 1010; y = cy + 18 * math.sin(t * 9); side = 1 if i % 2 else -1
    leaflet((x, y), side * 1.4 + 0.3, 70 + 30 * r.random(), 26, hexc('2f8a36'), hexc('7cc94e'), curve=0.2 * side, segs=5, vein=hexc('a6dc62'))
# --- solid swatch (white, opaque): UV parking for trunks / rocks / blobs
region('solid', 0, 1960, 128, 2048); D.rectangle([P(0, 1960), P(128, 2048)], fill=(255, 255, 255, 255))
# per-pixel painterly variation (keeps the flat polygons from reading as vector art)
A = np.asarray(img).astype(np.float32) / 255
yy, xx = np.mgrid[0:S, 0:S]
n = (np.sin(xx * 0.011 + np.sin(yy * 0.007) * 3) * np.sin(yy * 0.013 + np.sin(xx * 0.005) * 2)) * 0.06 + (rng.random((S, S)) - 0.5) * 0.05
A[..., :3] = np.clip(A[..., :3] * (1 + n[..., None]), 0, 1)
# premultiplied downsample to 2048, then bleed colour into the clear texels (no dark mip fringes)
pm = A[..., :3] * A[..., 3:4]
def down(x): return x.reshape(S // 2, 2, S // 2, 2, -1).mean((1, 3))
pm2, a2 = down(pm), down(A[..., 3:4])
rgb = np.where(a2 > 1e-3, pm2 / np.maximum(a2, 1e-3), 0)
from scipy.ndimage import distance_transform_edt
idx = distance_transform_edt(a2[..., 0] < 0.05, return_distances=False, return_indices=True)
rgb = rgb[idx[0], idx[1]]
a2 = np.clip((a2 - 0.5) * 1.6 + 0.5, 0, 1)  # crisper cut-out edge
Image.fromarray(np.dstack([(rgb * 255).astype(np.uint8), (a2[..., 0] * 255).astype(np.uint8)])).save(f'{OUT}/nature_cards.png')
json.dump(R, open(f'{OUT}/nature_regions.json', 'w'), indent=1)
print('cards ok', len(R))
