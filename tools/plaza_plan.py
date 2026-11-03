# annotate screens/blockout/desktop_top.png with the labels plaza_shots.py projected in-page (top shot is rotated 180 deg, so flip them)
import json, sys; from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1] if len(sys.argv) > 1 else 'screens/blockout'
im = Image.open(f'{D}/desktop_top.png').convert('RGB').rotate(180); W, H = im.size; d = ImageDraw.Draw(im)
try: f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
except Exception: f = ImageFont.load_default()
for t, x, y in json.load(open(f'{D}/desktop_top_labels.json')):
  x, y = W - x, H - y; b = d.textbbox((0, 0), t, font=f); w, h = b[2] - b[0], b[3] - b[1]
  d.rectangle([x - w / 2 - 4, y - h / 2 - 4, x + w / 2 + 4, y + h / 2 + 4], fill=(20, 20, 20)); d.text((x - w / 2, y - h / 2 - 2), t, font=f, fill=(255, 225, 90))
d.rectangle([0, 0, W, 50], fill=(15, 15, 15))
d.text((10, 5), 'PUMPFUN PIRATES plaza v2 BLOCKOUT (?plaza=2&pvships=1) - top-down: inland up, sea down, west left', font=f, fill=(255, 255, 255))
d.text((10, 27), '10 berths B1-B10: red = hull 44.1 x 10.4 m, yellow = footprint 22.6 x 57.7 m, 26 m centres, 5 jetties 12 m wide; continuous boardwalk lx -176..100; cyan = approach lane', font=f, fill=(255, 225, 90))
im.save(f'{D}/desktop_top_plan.png'); print('ok')
