import sys
from PIL import Image, ImageDraw, ImageFont
F=lambda s: ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', s)
def sbs(a,b,out,title,crop=None):
    A=Image.open(a).convert('RGB'); B=Image.open(b).convert('RGB')
    if crop: A=A.crop([int(v*s) for v,s in zip(crop,A.size*2)]); B=B.crop([int(v*s) for v,s in zip(crop,B.size*2)])
    w=1200 if A.width>=A.height else 700; A=A.resize((w,int(A.height*w/A.width))); B=B.resize((w,int(B.height*w/B.width)))
    H=A.height+70; im=Image.new('RGB',(w*2+30,H),(18,18,22)); im.paste(A,(10,60)); im.paste(B,(w+20,60))
    d=ImageDraw.Draw(im); d.text((14,14),'BEFORE (main)',fill=(200,200,200),font=F(30)); d.text((w+24,14),'AFTER v2 hull + rig',fill=(255,210,90),font=F(30))
    d.text((w*2+20-d.textlength(title,font=F(22)),18),title,fill=(170,170,170),font=F(22)); im.save(out,quality=90)
I='/workspace/timothy-ships/screens/ingame'; N='/tmp/v3/ig'; O=sys.argv[1]
for dev in ('desktop','phone'):
  for c in ('c0','c8'):
    for v in ('','_side'):
      t=f'{dev}_{c}{v}'; sbs(f'{I}/base_{t}.png',f'{N}/game_{t}.png',f'{O}/harbor_{t}_before_after.jpg',f'{dev} landscape, {"lvl 0" if c=="c0" else "max cannons"}{", orbited" if v else ", chase cam"}')
      # zoomed centre crop (the ship) for the top of the report
      sbs(f'{I}/base_{t}.png',f'{N}/game_{t}.png',f'{O}/harbor_{t}_before_after_zoom.jpg',f'{dev}, {c}{v} (centre crop)',crop=(0.28,0.1,0.72,0.85))
