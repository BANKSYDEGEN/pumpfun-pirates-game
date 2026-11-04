# PUMPFUN PIRATES swim animation sheets: SHEET_swim.png (viewer frame sequences, male + female, desktop High + phone Low)
# and SHEET_{desktop,phone}.png (in-game frames from foot_physics_game.py swimC / climbC / hop). usage: python3 swim_sheet.py BRAND_DIR
import sys, os; from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; RAW, GAME = f'{D}/raw', f'{D}/game'
def font(n):
  for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'):
    if os.path.exists(f): return ImageFont.truetype(f, n)
  return ImageFont.load_default()
def fit(im, w): return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
def title(S, txt, sub):
  d = ImageDraw.Draw(S); d.text((24, 14), txt, fill='#ffd24a', font=font(38)); d.text((24, 60), sub, fill='#d8e4ee', font=font(20))
# main sheet: 2 x 2 viewer sheets
W = 1500; cells = [('male_hi', 'MALE · HIGH (desktop)'), ('female_hi', 'FEMALE · HIGH (desktop)'), ('male_lo', 'MALE · LOW (phone)'), ('female_lo', 'FEMALE · LOW (phone)')]
ims = [fit(Image.open(f'{RAW}/swim_{k}.png').convert('RGB'), W // 2 - 12) for k, _ in cells]; ch = max(i.height for i in ims)
S = Image.new('RGB', (W, 100 + 2 * (ch + 40)), '#15202b'); title(S, 'PUMPFUN PIRATES · SWIM ANIMATION', 'rows: tread (still) · crawl 2.3 m/s · crawl 3.6 m/s · 0.6 s pull-up · surface kick (jump in deep water)')
d = ImageDraw.Draw(S)
for i, (im, (k, lab)) in enumerate(zip(ims, cells)):
  x, y = 8 + (i % 2) * (W // 2), 100 + (i // 2) * (ch + 40); d.text((x + 4, y + 4), lab, fill='#ffffff', font=font(20)); S.paste(im, (x, y + 32))
S.save(f'{D}/SHEET_swim.png'); print('SHEET_swim', S.size)
for dev in ('desktop', 'phone'):
  rows = [('CRAWL (close-up) then TREAD', ['swimC_1', 'swimC_2', 'swimC_3', 'swimC_end']), ('PULL-UP (0.15 s apart)', ['climbC_0', 'climbC_1', 'climbC_2', 'climbC_3', 'climbC_4']), ('SURFACE KICK', ['hop_1', 'hop_2', 'hop_3', 'hop_4'])]
  if not os.path.exists(f'{GAME}/{dev}_hop_1.png'): continue
  cw = 420; out = []
  for lab, names in rows:
    fr = [fit(Image.open(f'{GAME}/{dev}_{n}.png').convert('RGB'), cw) for n in names if os.path.exists(f'{GAME}/{dev}_{n}.png')]; out.append((lab, fr))
  rh = max(f.height for _, fr in out for f in fr); S = Image.new('RGB', (5 * (cw + 8) + 8, 100 + len(out) * (rh + 40)), '#15202b')
  title(S, f'PUMPFUN PIRATES · SWIM · in game ({dev})', 'west-beach swim cove, Supabase blocked, real walker + crew followers' + (' · phone = Low LOD' if dev == 'phone' else ' · High LOD')); d = ImageDraw.Draw(S)
  for r, (lab, fr) in enumerate(out):
    y = 100 + r * (rh + 40); d.text((12, y + 4), lab, fill='#ffffff', font=font(20))
    for c, f in enumerate(fr): S.paste(f, (8 + c * (cw + 8), y + 32))
  S.save(f'{D}/SHEET_{dev}.png'); print('SHEET', dev, S.size)
