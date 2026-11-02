# before (stage-3 tree) vs after (fix) gameplay-camera images + one combined sheet per skin
import sys
from PIL import Image, ImageDraw, ImageFont
F = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', s)
I = '/workspace/timothy-ships/screens/fix/ig'; O = '/workspace/timothy-ships/game/docs/ships/v2/fix'
def pair(sk, dev, lv):
    A = Image.open(f'{I}/s3tree_{dev}_{sk}_{lv}.png').convert('RGB'); B = Image.open(f'{I}/game_{dev}_{sk}_{lv}.png').convert('RGB')
    w = 1000; A = A.resize((w, int(A.height * w / A.width))); B = B.resize((w, int(B.height * w / B.width)))
    im = Image.new('RGB', (w * 2 + 30, A.height + 64), (18, 18, 22)); im.paste(A, (10, 54)); im.paste(B, (w + 20, 54)); d = ImageDraw.Draw(im)
    d.text((14, 12), 'BEFORE (stage 3)', fill=(200, 200, 200), font=F(28)); d.text((w + 24, 12), 'AFTER (fix)', fill=(255, 210, 90), font=F(28))
    t = f'{sk.upper()} - {dev} - {"lvl 0" if lv == "lv0" else "all upgrades MAX"} - gameplay camera'; d.text((w * 2 + 20 - d.textlength(t, font=F(22)), 16), t, fill=(170, 170, 170), font=F(22))
    p = f'{O}/{sk}_{dev}_{lv}_before_after.jpg'; im.save(p, quality=88); return im
for sk in sys.argv[1:]:
    ims = [pair(sk, dev, lv) for dev in ('desktop', 'phone') for lv in ('lv0', 'max')]
    W = max(i.width for i in ims); H = sum(i.height for i in ims) + 60
    c = Image.new('RGB', (W, H), (10, 10, 14)); ImageDraw.Draw(c).text((14, 12), f'PUMPFUN PIRATES v2 fix: {sk.upper()} before / after (desktop + phone, lvl 0 + all max)', fill=(255, 205, 119), font=F(32))
    y = 60
    for i in ims: c.paste(i, (0, y)); y += i.height
    c.save(f'{O}/{sk}_fix_sheet.jpg', quality=85); print(sk, 'ok')
