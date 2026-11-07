# [v7f paint] builds assets/pirates/items/v7f_paint/facepaint_retardio_female_{hi,lo}.glb from the V7 female body itself (scratch dir:
# node dec.mjs pirate_female_v7_<lod>.glb female_<lod>.glb; node ex.mjs; python3 build.py (lo: NS_GROW=13, texture box-halved to 1024); dump shell.npz -> sh_*.bin; node pack.mjs out.glb; node clean.mjs out.glb; python3 maskcheck.py)
import numpy as np, json; from PIL import Image, ImageFilter
R=lambda n,t,k: np.fromfile('ex_'+n+'.bin',dtype=t).reshape(-1,k)
P=R('POSITION',np.float32,3); N=R('NORMAL',np.float32,3); UV=R('TEXCOORD_0',np.float32,2); J=(lambda b: b.reshape(-1,4).astype(np.uint16))(np.fromfile('ex_JOINTS_0.bin',dtype=np.uint8 if __import__('os').path.getsize('ex_JOINTS_0.bin')==4*len(P) else np.uint16)); W=R('WEIGHTS_0',np.float32,4)
I=np.fromfile('ex_IDX.bin',dtype=np.uint32).reshape(-1,3)
tex=np.asarray(Image.open('body_tex.webp').convert('RGB')).astype(np.float32)/255; TH,TW=tex.shape[:2]
def hsv(c):
  mx=c.max(-1); mn=c.min(-1); d=mx-mn+1e-6; r,g,b=c[...,0],c[...,1],c[...,2]
  h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60; return h,d/(mx+1e-6),mx
def skin(c):   # V7 male skin texels (not hair / beard / brows / eyes / lip line)
  h,s,v=hsv(c); return (h<26)&(s>0.2)&(s<0.56)&(v>0.72)   # V7 female skin: hue 17-21 (hair 31-32, brows / lashes / mouth line dark)
# --- landmarks from the body texture on front-facing head verts
H=P[:,1].max(); fr=(N[:,2]>0.5)&(P[:,1]>H-0.5)&(np.abs(P[:,0])<0.2)
vc=tex[(np.clip(1-UV[:,1]*0+UV[:,1],0,1)*(TH-1)).astype(int)*0+(np.clip(UV[:,1],0,1)*(TH-1)).astype(int),(np.clip(UV[:,0],0,1)*(TW-1)).astype(int)]
h,s,v=hsv(vc); blue=fr&(h>190)&(h<230)&(s>0.45)
E0={}
for sg in (-1,1):
  m=blue&(np.sign(P[:,0])==sg); E0[sg]=np.median(P[m],0); print('eye',sg,E0[sg], m.sum(), P[m].min(0), P[m].max(0))
EX,EY,EHW=0.0955,1.066,0.086; TOP,BOT=0.125,0.088; OUT=0.0045   # her eyes: centres x +-0.0955, y 1.066 (f_ortho.png), half 0.055 x 0.048
def pattern(x,y):
  """BANKSY's Retardio reference (t426u) on the V7 female: white face; filled periwinkle angular diamonds round the eyes, dark edge;
  small yellow-orange nose oval; broad red upturned smile across the lower face / cheeks with a white rim; small black V mark centred low."""
  ax=np.abs(x)-EX; dy=y-EY; hh=np.where(dy>0,TOP,BOT); dia=np.abs(ax)/EHW+np.abs(dy)/hh
  base=((x/0.168)**2+((y-1.05)/np.where(y>1.05,0.25,0.152))**2)<1
  ux=np.abs(x)/0.15; cy=0.952+0.062*np.clip(ux,0,1.2)**2.0; th=0.03*(1-0.45*np.clip(ux,0,1)**2)
  band=(np.abs(y-cy)<th)&(ux<1.02); rim=(np.abs(y-cy)<th+0.005)&(ux<1.05)&~band
  lips=np.zeros(x.shape,bool); smile=band
  vx=np.abs(x); vee=(vx<0.017)&(np.abs((y-0.94)-vx*0.95)<0.0034)
  nose=((x/0.017)**2+((y-1.006)/0.0115)**2)<1   # small oval over the nose
  col=np.zeros(x.shape+(3,),np.float32); col[:]=(0.957,0.93,0.88)
  inner=dia<1-OUT/EHW; edge=(dia<1)&~inner
  col[inner]=(0.38,0.45,0.82); col[edge]=(0.15,0.19,0.47)
  col[rim]=(0.957,0.93,0.88); col[smile]=(0.86,0.12,0.13); col[vee]=(0.03,0.03,0.04); col[nose]=(0.93,0.56,0.16)
  return col, base|(dia<1)|smile|rim, lips|vee
tri=I; c=P[tri].mean(1); nz=N[tri][:,:,2].min(1)
sel=(nz>-0.05)&(np.abs(c[:,0])<0.19)&(c[:,1]>0.88)&(c[:,1]<1.31)&(c[:,2]>0.05)
_,inpat,_=pattern(c[:,0],c[:,1]); sel&=inpat|(((c[:,0]/0.19)**2+((c[:,1]-1.05)/0.28)**2)<1)
T=tri[sel]; print('tris',len(T))
def rast(T,S=1024):
  uvb=UV[np.unique(T)]; u0,v0=uvb.min(0)-0.002; u1,v1=uvb.max(0)+0.002; print('uv bbox',u0,v0,u1,v1)
  sc=S/max(u1-u0,v1-v0); RGB=np.zeros((S,S,3),np.float32); A=np.zeros((S,S),np.float32); C=np.zeros((S,S),bool); NS=np.zeros((S,S),bool); hit=np.zeros(len(T),bool)
  for k,t in enumerate(T):
    q=(UV[t]-[u0,v0])*sc; mn=np.floor(q.min(0)-1).astype(int); mx=np.ceil(q.max(0)+1).astype(int); mn=np.clip(mn,0,S-1); mx=np.clip(mx,0,S-1)
    gx,gy=np.meshgrid(np.arange(mn[0],mx[0]+1)+.5,np.arange(mn[1],mx[1]+1)+.5)
    (x0,y0),(x1,y1),(x2,y2)=q; den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
    if abs(den)<1e-12: continue
    a=((y1-y2)*(gx-x2)+(x2-x1)*(gy-y2))/den; b=((y2-y0)*(gx-x2)+(x0-x2)*(gy-y2))/den; cc=1-a-b
    # conservative: texels within 0.8 px of the triangle (tiny UV islands like the brow tops still get paint)
    ka,kb,kc=np.clip(a,0,1),np.clip(b,0,1),np.clip(cc,0,1); ks=ka+kb+kc+1e-9; ka,kb,kc=ka/ks,kb/ks,kc/ks
    strict=(a>=0)&(b>=0)&(cc>=0); px=ka*x0+kb*x1+kc*x2; py=ka*y0+kb*y1+kc*y2; m=((px-gx)**2+(py-gy)**2)<0.64; a,b,cc=ka,kb,kc
    if not m.any(): continue
    a,b,cc=a[m],b[m],cc[m]; p=a[:,None]*P[t[0]]+b[:,None]*P[t[1]]+cc[:,None]*P[t[2]]; uv=a[:,None]*UV[t[0]]+b[:,None]*UV[t[1]]+cc[:,None]*UV[t[2]]
    bc=tex[(np.clip(uv[:,1],0,1)*(TH-1)).astype(int),(np.clip(uv[:,0],0,1)*(TW-1)).astype(int)]
    col,inside,sm=pattern(p[:,0],p[:,1]); hh,ss,vv=hsv(bc); lipz=sm&(hh<33.5)&(vv>0.88)&(ss>0.08); al=(inside&(skin(bc)|lipz)).astype(np.float32)
    iy,ix=(gy[m]-.5).astype(int),(gx[m]-.5).astype(int); RGB[iy,ix]=col; A[iy,ix]=np.maximum(A[iy,ix],inside.astype(np.float32)); C[iy,ix]=True; st=strict[m]; NS[iy[st],ix[st]]|=~(skin(bc[st])|lipz[st]); hit[k]=al.any()   # skin test only on texels inside the triangle (the fringe samples the body gutter)
  return RGB,A,hit,u0,v0,sc,S,C,NS
_,_,hit,*_=rast(T,1024); T=T[hit]
RGB,A,hit,u0,v0,sc,S,C,NS=rast(T,4096)   # 2x supersampled, box-filtered to 2048 below (antialiased outline)
# despeckle the skin mask (texture noise): open/close 1 px
F=lambda m,f: np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(f))>127
NSg=F(NS&F(NS,ImageFilter.MedianFilter(3)),ImageFilter.MaxFilter(int(__import__('os').environ.get('NS_GROW','9'))))&C   # hair / beard / brows / eyes / lip line: specks dropped, grown 2 px (4096) inside covered texels
A=(A>0.5)&C&~NSg
A=A|(F(A,ImageFilter.MaxFilter(9))&~C)   # gutter: 2 px past the island edge, never into the face
A=A.astype(np.float32)
T=T[hit]; print('painted tris',len(T))
# bleed colour outward so mip / filtering never pulls black
img=Image.fromarray((np.clip(RGB,0,1)*255).astype(np.uint8)); 
for _ in range(10): img=Image.composite(img, img.filter(ImageFilter.MaxFilter(3)), Image.fromarray(((RGB.sum(-1)>0)*255).astype(np.uint8))); RGB=np.asarray(img)/255.
half=S//2; rgb=np.asarray(img.resize((half,half),Image.BOX)); A8=(A>0.5); al=np.where(A8.reshape(half,2,half,2).sum((1,3))>=2,255,0).astype(np.uint8)   # >= 2 of 4 subtexels: no hairline holes on island edges
Image.fromarray(np.dstack([rgb,al]),'RGBA').save('paint_tex.png')
vi=np.unique(T); remap=-np.ones(len(P),int); remap[vi]=np.arange(len(vi))
# offset along the normal averaged over co-located (UV-seam split) vertices, so the shell has no cracks on the seams
_k=np.round(P[vi]*20000).astype(np.int64); _,_g=np.unique(_k,axis=0,return_inverse=True); _g=_g.ravel(); _n=np.zeros((_g.max()+1,3)); np.add.at(_n,_g,N[vi]); _n/=np.linalg.norm(_n,axis=1,keepdims=True)+1e-9; NO=_n[_g]
np.savez('shell.npz',BV=vi,P=(P[vi]+NO*0.0016).astype(np.float32),N=N[vi],UV=((UV[vi]-[u0,v0])*sc/S).astype(np.float32),J=J[vi],W=W[vi],I=remap[T].astype(np.uint32))
