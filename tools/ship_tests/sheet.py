# compose labelled contact sheets: sheet.py out.png title tag1:label1 [tag2:label2 ...]  (frames in /tmp/cs/<tag>_<i>.jpg)
import sys
from PIL import Image, ImageDraw, ImageFont
out, title, rows = sys.argv[1], sys.argv[2], [a.split(':', 1) for a in sys.argv[3:]]
T = 360; pad = 8; head = 70; lab = 40
F = '/workspace/timothy-ships/game/assets/JustAnotherHand.ttf'
try: ft, fl = ImageFont.truetype(F, 52), ImageFont.truetype(F, 34)
except Exception: ft = fl = ImageFont.load_default()
W = 4 * T + 5 * pad; H = head + len(rows) * (2 * T + 2 * pad + lab) + pad
c = Image.new('RGB', (W, H), (13, 26, 34)); d = ImageDraw.Draw(c)
d.text((pad * 2, 10), title, fill=(255, 205, 119), font=ft)
y = head
names = ['bow-port', 'port beam', 'stern-port', 'stern', 'stern-starboard', 'starboard beam', 'bow-starboard', 'bow']
for tag, label in rows:
    d.text((pad * 2, y), label, fill=(240, 240, 240), font=fl); y += lab
    for i in range(8):
        im = Image.open(f'/tmp/cs/{tag}_{i}.jpg').resize((T, T), Image.LANCZOS)
        x = pad + (i % 4) * (T + pad); yy = y + (i // 4) * (T + pad); c.paste(im, (x, yy))
    y += 2 * T + 2 * pad
c.save(out, optimize=True); print(out, c.size)
