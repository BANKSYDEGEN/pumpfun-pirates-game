# [V6 textures] BANKSY "Sharpen the clothing textures": the v5 clothing GLBs (items/v5/cloth_*) get crisper albedo maps.
# hi: 2x Lanczos upscale + unsharp mask, clamped to the local 3x3 min / max of the upscaled image (no halos); lo: same res, a lighter
# clamped unsharp. Meshes, UVs, rig, weights, _TINT / COLOR_0 (the tinting), normal maps: untouched (only the image bytes change).
# python3 tools/v6/sharpen_cloth.py [--keep-size] assets/pirates/items/v5/cloth_*.glb
# --keep-size: V6 follow-up, no GPU texture-size growth; alpha masks remain exact.
import json, struct, sys, io, os
import numpy as np
from PIL import Image, ImageFilter
def sharpen(im0, hi, keep_size=False):
  A = im0.getchannel('A') if 'A' in im0.getbands() else None   # alpha (cut-outs / the cream mask) kept, upscaled with the colour
  im = Image.merge('RGB', im0.split()[:3]) if A is not None else im0.convert('RGB')   # (not convert(): that drops the colour under alpha 0, and alpha here is a mask)
  if hi and A is None and not keep_size: im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)   # (mask textures stay 1x: the tint mask in alpha must stay byte-aligned with its colour)
  us = im.filter(ImageFilter.UnsharpMask(radius=2.0 if hi else 1.0, percent=110 if hi else 70, threshold=1))
  lo_ = np.asarray(im.filter(ImageFilter.MinFilter(3)), np.int16); hi_ = np.asarray(im.filter(ImageFilter.MaxFilter(3)), np.int16)
  out = Image.fromarray(np.clip(np.asarray(us, np.int16), lo_, hi_).astype(np.uint8))
  if A is not None: out.putalpha(A)
  return out
def run(f, keep_size=False):
  b = open(f, 'rb').read(); assert b[:4] == b'glTF'
  jl = struct.unpack('<I', b[12:16])[0]; J = json.loads(b[20:20 + jl]); o = 20 + jl; bl = struct.unpack('<I', b[o:o + 4])[0]; BIN = b[o + 8:o + 8 + bl]
  views = [BIN[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']] for v in J['bufferViews']]
  hi = f.endswith('_hi.glb'); n = 0
  for img in J.get('images', []):
    if img.get('name', '').endswith('_n') or 'bufferView' not in img: continue
    src = Image.open(io.BytesIO(views[img['bufferView']])); out = io.BytesIO()
    sharpen(src, hi, keep_size).save(out, 'WEBP', quality=((90 if hi else 86) if keep_size else (80 if hi else 82)), method=4, exact=True); views[img['bufferView']] = out.getvalue(); img['mimeType'] = 'image/webp'; n += 1
  nb = bytearray()
  for v, d in zip(J['bufferViews'], views):
    while len(nb) % 4: nb.append(0)
    v['byteOffset'] = len(nb); v['byteLength'] = len(d); nb += d
  while len(nb) % 4: nb.append(0)
  J['buffers'][0]['byteLength'] = len(nb)
  js = json.dumps(J, separators=(',', ':')).encode()
  while len(js) % 4: js += b' '
  outb = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(nb)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(nb)) + b'BIN\0' + bytes(nb)
  open(f, 'wb').write(outb); return n
if __name__ == '__main__':
  tb = ta = 0
  keep_size = '--keep-size' in sys.argv
  for f in [x for x in sys.argv[1:] if x != '--keep-size']:
    s0 = os.path.getsize(f); n = run(f, keep_size); s1 = os.path.getsize(f); tb += s0; ta += s1; print(f'{os.path.basename(f)}: {n} map(s) {s0 // 1024} -> {s1 // 1024} KB')
  print(f'TOTAL {tb / 1048576:.2f} MB -> {ta / 1048576:.2f} MB')
