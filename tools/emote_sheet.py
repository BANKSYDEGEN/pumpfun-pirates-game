# PUMPFUN PIRATES land emotes sheet: SHEET_emotes.png = viewer frame sequences (male + female, desktop High + phone Low; tools/emote_shots.py)
# + in-game shots (tools/emote_game.py: Arr! + Yo ho ho! with the shore crew joining, bubble over the head). usage: python3 emote_sheet.py BRAND_DIR
import sys, os; from PIL import Image, ImageDraw, ImageFont
D = sys.argv[1]; ALL8 = 'all8' in sys.argv[2:]; RAW, GAME = (f'{D}/raw8', f'{D}/game8') if ALL8 else (f'{D}/raw', f'{D}/game')
def font(n):
  for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'):
    if os.path.exists(f): return ImageFont.truetype(f, n)
  return ImageFont.load_default()
def fit(im, w): return im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
W = 2000; cells = [('male_hi', 'MALE · HIGH (desktop)'), ('female_hi', 'FEMALE · HIGH (desktop)'), ('male_lo', 'MALE · LOW (phone)'), ('female_lo', 'FEMALE · LOW (phone)')]
ims = [fit(Image.open(f'{RAW}/emote_{k}.png').convert('RGB'), W // 2 - 12) for k, _ in cells]; ch = max(i.height for i in ims)
shots = [(f'{GAME}/{n}.png', lab) for n, lab in ((('desktop_boss', 'IN GAME desktop · Boss incoming! (crew look + nod)'), ('desktop_gg', 'IN GAME desktop · GG (crew bow)'), ('phone_attack', 'IN GAME phone · Attack! (crew charge)'), ('phone_help', 'IN GAME phone · Need help!')) if ALL8 else (('desktop_arr', 'IN GAME desktop · Arr! (crew join)'), ('desktop_jig', 'IN GAME desktop · Yo ho ho! (crew jig)'), ('phone_arr', 'IN GAME phone · Arr!'), ('phone_jig', 'IN GAME phone · Yo ho ho!'))) if os.path.exists(f'{GAME}/{n}.png')]
gw = W // 2 - 12; gims = [(fit(Image.open(f).convert('RGB'), gw), lab) for f, lab in shots]; gh = max([g.height for g, _ in gims] or [0])
grow = (len(gims) + 1) // 2
S = Image.new('RGB', (W, 110 + 2 * (ch + 40) + grow * (gh + 40) + 10), '#15202b'); d = ImageDraw.Draw(S)
d.text((24, 14), 'PUMPFUN PIRATES · LAND EMOTES · ALL 8' if ALL8 else 'PUMPFUN PIRATES · LAND EMOTES (prototype)', fill='#ffd24a', font=font(42))
d.text((24, 64), 'rows: Arr! · Follow me! · Boss incoming! · Need help! · Attack! · Retreat! · GG · Yo ho ho!   (land only; upper body while walking, GG + the jig stop)' if ALL8 else 'the current quick-chat wheel, now with body motions on land · rows: Arr! · Follow me! · Yo ho ho! (4-bar jig) · Follow me! while walking (upper body only)', fill='#d8e4ee', font=font(21))
for i, (im, (k, lab)) in enumerate(zip(ims, cells)):
  x, y = 8 + (i % 2) * (W // 2), 110 + (i // 2) * (ch + 40); d.text((x + 4, y + 4), lab, fill='#ffffff', font=font(22)); S.paste(im, (x, y + 34))
y0 = 110 + 2 * (ch + 40)
for i, (g, lab) in enumerate(gims):
  x, y = 8 + (i % 2) * (W // 2), y0 + (i // 2) * (gh + 40); d.text((x + 4, y + 4), lab, fill='#ffffff', font=font(22)); S.paste(g, (x, y + 34))
out = f'{D}/SHEET_emotes_all8.png' if ALL8 else f'{D}/SHEET_emotes.png'; S.save(out); print(out, S.size)
