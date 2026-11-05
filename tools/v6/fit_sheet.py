# compose SHEET_v6_fit.png (+ _small.jpg) from the gear-viewer fit shots (fit_shots.py) [+ optional extra Blender renders dir]
import sys, glob; from PIL import Image, ImageDraw, ImageFont
F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',44); f2=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
R='/workspace/brand/v6_characters/'; S=R+'shots/'; W=2000; H=1300; title=sys.argv[1] if len(sys.argv)>1 else ''
c=Image.new('RGB',(2*W,80+4*(H+60)),(20,26,34)); d=ImageDraw.Draw(c)
d.text((20,15),'PUMPFUN PIRATES V6 - every item on each V6 body (real game code, tools/gear_viewer.html), High + Low, idle + walk '+title,font=F,fill='white'); y=80
for sex,nm in (('m','MALE'),('f','FEMALE')):
  for lod in ('hi','lo'):
    for j,clip in enumerate(('idle','walk')):
      d.text((j*W+20,y+10),f'{nm} {lod.upper()} - {clip}',font=F,fill=(255,210,90)); c.paste(Image.open(f'{S}fit_{sex}_{lod}_{clip}.png').convert('RGB'),(j*W,y+60))
    y+=H+60
c.save(R+'SHEET_v6_fit.png'); c.resize((1600,int(c.size[1]*1600/c.size[0]))).save(R+'SHEET_v6_fit_small.jpg',quality=85); print(c.size)
