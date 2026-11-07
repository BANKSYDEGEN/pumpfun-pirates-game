import sys
from PIL import Image,ImageDraw
out=sys.argv[1];rows=[r.split(',') for r in sys.argv[2:]];s=330
im=Image.new('RGB',(s*max(map(len,rows)),s*len(rows)),'white');d=ImageDraw.Draw(im)
for y,r in enumerate(rows):
  for x,f in enumerate(r):
    try: im.paste(Image.open(f).convert('RGB').resize((s,s)),(x*s,y*s)); d.text((x*s+4,y*s+4),f.split('/')[-1][:-4],fill='yellow')
    except Exception as e: pass
im.save(out)
