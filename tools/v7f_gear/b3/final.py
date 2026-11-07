from PIL import Image,ImageDraw
O='/workspace/v7f-gear-b3-shots/'
L={'before':'LIVE NOW: raw v5 female top on V7 body','b2':'083dcfe (b2, local, rejected)','b5':'b5 interim','b7':'b7','b8':'b3 FIX (local, awaiting BANKSY)'}
vs=['front','q34','back','walk6_q34','walk6_back','walk16_side']
def sheet(it,vs,box,sc,tags,suffix,title):
  w,h=box[2]-box[0],box[3]-box[1];W2,H2=int(w*sc),int(h*sc);im=Image.new('RGB',(160+W2*len(vs),30+H2*len(tags)),(28,28,28));d=ImageDraw.Draw(im)
  d.text((6,8),title,fill=(255,255,255))
  for c,v in enumerate(vs): d.text((160+c*W2+4,18),v.replace('walk6','walk f6').replace('walk16','walk f16'),fill=(200,200,200))
  for r,s in enumerate(tags):
    d.text((6,30+r*H2+H2//2),L[s][:24]+'\n'+L[s][24:],fill=(255,140,140) if s!='b8' else (140,255,140))
    for c,v in enumerate(vs):
      try: im.paste(Image.open(f'r/{it}_{s}_{v}.png' if not v.startswith('dg') else f'r/{it}_{s}_{v}.png').convert('RGB').crop(box).resize((W2,H2)),(160+c*W2,30+r*H2))
      except Exception as e: print(e)
  im.save(O+f'{it}_{suffix}.png')
for it in ['cloth_coat','cloth_suit','cloth_shirt','cloth_tank','cloth_tshirt']:
  T=f'{it} | Blender 4.2 Cycles, runtime clothMat + runtime body cover-mask (coverMask) emulated, unchanged walk_pirate clip. NOT a game capture.'
  sheet(it,vs,(110,20,530,620),0.6,['before','b2','b8'],'full',T)
  sheet(it,vs,(150,160,490,430),1.0,['before','b2','b8'],'close',T+' torso close-up')
  sheet(it,['dg_front','dg_q34','dg_back','dg_walk6_q34','dg_walk6_back'],(150,160,490,430),0.9,['before','b2','b8'],'diag',it+' | DIAGNOSTIC: blue = baked garment, magenta = her skin/body left visible after the runtime cover mask')
