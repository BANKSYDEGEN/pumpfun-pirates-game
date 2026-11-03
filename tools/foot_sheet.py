# PUMPFUN PIRATES foot physics contact sheet: rows of frames per scenario (+ before row where there is one) + a height plot from telemetry
import json, os, sys, glob; from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; OUT = sys.argv[2]; TW, TH = 400, 225
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22); f2 = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
ROWS = [('cliff', 'CLIFF: walk off a ledge -> gravity fall (fall pose) + landing (before: stopped at the edge)'), ('wade', 'COVE: sandy entry, shallow wading (slower)'),
  ('swim', 'COVE: chest deep -> float + swim at the surface (ripples)'), ('lake', 'LAKE: deep water = swim (was: walking on the bottom)'),
  ('climb', 'CLIMB OUT: swim to the cove jetty, pull up onto it'), ('jump', 'COVE: dive off the board (2.75 m) -> splash, bob up, swim'),
  ('cannon', "Timothy's battery: up the ramp onto the gun deck, idle = no sliding"), ('beach', 'BEACH outside the plaza: feet exact, no smoothing lag; dig mound walked on (was 0.75 m sunk)')]
def tele(dev, name, before=False):
  p = f'{D}/{"before" if before else "after"}/{dev}_telemetry.json'
  try: return json.load(open(p))['telemetry'].get(name)
  except Exception: return None
def plot(T, T0=None):
  im = Image.new('RGB', (TW, TH), (24, 28, 34)); g = ImageDraw.Draw(im)
  if not T: return im
  ys = [r[2] for r in T] + [r[3] for r in T] + [r[4] for r in T if r[4] is not None] + ([r[2] for r in T0] if T0 else [])
  lo, hi = min(ys) - 0.3, max(ys) + 0.3; n = max(len(T), len(T0 or []))
  X = lambda i: 10 + (TW - 20) * i / max(1, n - 1); Y = lambda v: TH - 28 - (TH - 50) * (v - lo) / max(1e-3, hi - lo)
  def line(vals, col, w=2):
    pts = [(X(i), Y(v)) for i, v in enumerate(vals) if v is not None]
    if len(pts) > 1: g.line(pts, fill=col, width=w)
  line([r[4] for r in T], (70, 160, 255), 2); line([r[3] for r in T], (150, 120, 80), 2)
  if T0: line([r[2] for r in T0], (230, 80, 80), 2)
  line([r[2] for r in T], (255, 230, 90), 3)
  g.text((8, 4), 'feet y (yellow)  ground (brown)  water (blue)' + ('  BEFORE feet (red)' if T0 else ''), font=f2, fill=(230, 230, 230))
  sw = sum(r[5] for r in T); air = sum(r[6] for r in T); g.text((8, TH - 22), f'{len(T)} frames @30Hz  swim {sw}  air {air}  y {lo+0.3:.1f}..{hi-0.3:.1f} m', font=f2, fill=(200, 200, 200)); return im
def frames(dev, name, before=False):
  fs = sorted(glob.glob(f'{D}/{"before" if before else "after"}/{dev}_{name}_[0-9].png')) + glob.glob(f'{D}/{"before" if before else "after"}/{dev}_{name}_end.png'); return fs
dev = sys.argv[3] if len(sys.argv) > 3 else 'desktop'; rows = []
for name, title in ROWS:
  fa = frames(dev, name)
  if not fa: continue
  fb = frames(dev, name, True)
  rows.append((title, fa, plot(tele(dev, name), tele(dev, name, True)), fb))
C = 6; W = 20 + C * (TW + 8); H = 40 + sum(40 + TH + 8 + ((TH + 8 + 26) if fb else 0) for _, _, _, fb in rows)
S = Image.new('RGB', (W, H), (14, 16, 20)); g = ImageDraw.Draw(S); g.text((12, 8), f'PUMPFUN PIRATES on-foot physics ({dev})  raul/foot-physics', font=F, fill=(255, 215, 106)); y = 44
for title, fa, pl, fb in rows:
  g.text((12, y + 8), title, font=F, fill=(255, 255, 255)); y += 40
  x = 10; S.paste(pl, (x, y)); x += TW + 8
  for p in fa[:C - 1]: S.paste(Image.open(p).convert('RGB').resize((TW, TH)), (x, y)); x += TW + 8
  y += TH + 8
  if fb:
    g.text((12, y + 2), 'BEFORE (v150):', font=f2, fill=(255, 140, 140)); y += 26; x = 10 + TW + 8
    for p in fb[:C - 1]: S.paste(Image.open(p).convert('RGB').resize((TW, TH)), (x, y)); x += TW + 8
    y += TH + 8
S.save(OUT); print(OUT, S.size)
