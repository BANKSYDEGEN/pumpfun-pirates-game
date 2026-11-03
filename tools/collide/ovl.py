# overlay crops with a town-local grid: python3 ovl.py PREFIX OUTDIR  (writes PREFIX_overlay_grid.png + _w / _e halves)
import sys
from PIL import Image, ImageDraw
pre, out = sys.argv[1], sys.argv[2]; lx0, lx1, lz0 = -186, 196, -80
im = Image.open(pre + '_overlay.png').convert('RGB'); W, H = im.size; s = W / (lx1 - lx0); d = ImageDraw.Draw(im)
for lx in range(-180, 200, 20): x = (lx - lx0) * s; d.line([(x, 0), (x, H)], fill=(0, 0, 0), width=1); d.text((x + 2, 2), str(lx), fill=(0, 0, 0))
for lz in range(-80, 65, 10): y = (lz - lz0) * s; d.line([(0, y), (W, y)], fill=(0, 0, 0), width=1); d.text((2, y + 2), str(lz), fill=(0, 0, 0))
d.text((W - 520, H - 14), 'grey solid  red collider(+0.45 body)  magenta WALK-THROUGH  blue INVISIBLE wall  lz+ = sea', fill=(0, 0, 0))
im.save(pre + '_overlay_grid.png'); im.crop((0, 0, W // 2, H)).save(out + '/ov_w.png'); im.crop((W // 2, 0, W, H)).save(out + '/ov_e.png')
