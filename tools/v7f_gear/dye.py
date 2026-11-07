# emulate fittedGearRecolor (js/pirateItems.js) per vertex: texture(uv)*COLOR_0 -> sRGB HSV classes -> dyeMask
import sys,io,json,numpy as np;sys.path.insert(0,'.');from glb_io import GLB;from PIL import Image
def lin2s(c): return np.where(c>.0031308,1.055*np.power(np.maximum(c,0),1/2.4)-.055,12.92*c)
def s2lin(c): return np.where(c>.04045,((c+.055)/1.055)**2.4,c/12.92)
def run(f,kind,y0=.565,y1=.595):
  g=GLB(f);p=g.d['meshes'][0]['primitives'][0];A=p['attributes'];P=g.array(A['POSITION']);UV=g.array(A['TEXCOORD_0']);C=g.array(A['COLOR_0'])[:,:3].astype(float)
  if C.max()>1.5: C/=65535 if C.max()>255 else 255
  T=g.array(A['_TINT']) if '_TINT' in A else np.full(len(P),-1.)
  m=g.d['materials'][p['material']];ti=m['pbrMetallicRoughness']['baseColorTexture']['index'];tex=g.d['textures'][ti];src=tex.get('source',tex.get('extensions',{}).get('EXT_texture_webp',{}).get('source'))
  im=np.asarray(Image.open(io.BytesIO(g.bv(g.d['images'][src]['bufferView']))).convert('RGB')).astype(float)/255
  h,w,_=im.shape;px=im[np.clip((UV[:,1]%1*h).astype(int),0,h-1),np.clip((UV[:,0]%1*w).astype(int),0,w-1)]
  base=s2lin(px)*C   # diffuseColor (linear): map (sRGB->linear) * vertex colour
  dc=lin2s(base);mx=dc.max(1);mn=dc.min(1);d=mx-mn;sat=d/np.maximum(mx,1e-5)
  r,gg,b=dc.T;hue=np.zeros(len(dc));nz=d>1e-5
  hr=nz&(mx==r);hg=nz&(mx==gg)&~hr;hb=nz&~hr&~hg
  hue[hr]=60*np.mod((gg-b)[hr]/d[hr]+6,6);hue[hg]=60*((b-r)[hg]/d[hg]+2);hue[hb]=60*((r-gg)[hb]/d[hb]+4)
  red=((hue<18)|(hue>345))&(sat>.3);gold=(hue>35)&(hue<65)&(sat>.55)&(mx>.5);nd=(sat<.2)&(mx>.055)&(mx<.75);ink=np.clip((mx-.018)/(.06-.018),0,1)
  y=P[:,1];ss=np.clip((y-y0)/(y1-y0),0,1);ss=ss*ss*(3-2*ss)
  acc=(T>2.5)&(T<3.5)
  mask=(1-ss)*(~red)*(~gold)*(~acc)*ink
  return dict(n=len(P),ymin=float(y.min()),ymax=float(y.max()),dyed=float((mask>.5).mean()),accent=float(acc.mean()),red=float(red.mean()),gold=float(gold.mean()),
    above_cut=float((y>y1).mean()),fabric_above_cut_undyed=float(((y>y1)&~red&~gold&~acc).mean()))
out={}
for a in sys.argv[1:]:
  f,kind,*yy=a.split(':');out[f.split('/')[-1]+(':'+','.join(yy) if yy else '')]=run(f,kind,*map(float,yy))
print(json.dumps(out,indent=1))
if __name__=='__main__' and 0: pass
