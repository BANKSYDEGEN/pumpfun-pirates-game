import numpy as np; from PIL import Image
exec(open('build.py').read().split("tri=I;")[0])
d=np.load('shell.npz'); BV,SUV,SI=d['BV'],d['UV'],d['I']; pt=np.asarray(Image.open('paint_tex.png')); S=pt.shape[0]
rng=np.random.default_rng(0); n=0; cnt={}
for t in SI:
  w=rng.dirichlet([1,1,1],40); su=w@SUV[t]; bu=w@UV[BV[t]]
  al=pt[(su[:,1]*(S-1)).astype(int),(su[:,0]*(S-1)).astype(int),3]>127
  bc=tex[(np.clip(bu[:,1],0,1)*(TH-1)).astype(int),(np.clip(bu[:,0],0,1)*(TW-1)).astype(int)]; h,s,v=hsv(bc)
  cls=np.where((s<0.12)&(v>0.8),'eye_white',np.where((h>180)&(h<240)&(s>0.3),'iris_blue',np.where(v<0.45,'dark_brow_lash_line',np.where((h>=27)&(v>0.7),'hair','skin_or_lip'))))
  for c,a in zip(cls,al): k=cnt.setdefault(c,[0,0]); k[0]+=a; k[1]+=1
for c,(a,t) in sorted(cnt.items()): print(f'{c:22s} painted {a:6d} / {t:6d} samples = {100*a/max(t,1):.2f}%')
