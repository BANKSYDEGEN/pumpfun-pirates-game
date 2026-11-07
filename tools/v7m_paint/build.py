# [v7m paint] builds assets/pirates/items/v7m_paint/facepaint_retardio_male.glb from the V7 male body (scratch dir:
# node dec.mjs <pirate_male_v7_hi.glb> male_hi.glb; node ex.mjs; python3 build.py; dump shell.npz -> sh_*.bin; node pack.mjs out.glb; node clean.mjs out.glb)
import numpy as np, json; from PIL import Image, ImageFilter
R=lambda n,t,k: np.fromfile('ex_'+n+'.bin',dtype=t).reshape(-1,k)
P=R('POSITION',np.float32,3); N=R('NORMAL',np.float32,3); UV=R('TEXCOORD_0',np.float32,2); J=R('JOINTS_0',np.uint16,4); W=R('WEIGHTS_0',np.float32,4)
I=np.fromfile('ex_IDX.bin',dtype=np.uint32).reshape(-1,3)
tex=np.asarray(Image.open('body_tex.webp').convert('RGB')).astype(np.float32)/255; TH,TW=tex.shape[:2]
def hsv(c):
  mx=c.max(-1); mn=c.min(-1); d=mx-mn+1e-6; r,g,b=c[...,0],c[...,1],c[...,2]
  h=np.where(mx==r,((g-b)/d)%6,np.where(mx==g,(b-r)/d+2,(r-g)/d+4))*60; return h,d/(mx+1e-6),mx
def skin(c):   # V7 male skin texels (not hair / beard / brows / eyes / lip line)
  h,s,v=hsv(c); return (h<32.5)&(s>0.1)&(v>0.72)
# --- landmarks from the body texture on front-facing head verts
H=P[:,1].max(); fr=(N[:,2]>0.5)&(P[:,1]>H-0.5)&(np.abs(P[:,0])<0.2)
vc=tex[(np.clip(1-UV[:,1]*0+UV[:,1],0,1)*(TH-1)).astype(int)*0+(np.clip(UV[:,1],0,1)*(TH-1)).astype(int),(np.clip(UV[:,0],0,1)*(TW-1)).astype(int)]
h,s,v=hsv(vc); blue=fr&(h>190)&(h<230)&(s>0.45)
E0={}
for sg in (-1,1):
  m=blue&(np.sign(P[:,0])==sg); E0[sg]=np.median(P[m],0); print('eye',sg,E0[sg], m.sum(), P[m].min(0), P[m].max(0))
EX,EY,EHW=0.0875,1.022,0.074; TOP,BOT=0.135,0.072; OUT=0.0045
def pattern(x,y):
  """BANKSY's Retardio reference (Nov 7, t426u): white face; periwinkle angular diamonds round the eyes, dark edge; small yellow-orange
  nose; broad red upturned smile across the lower face / cheeks with a white rim; small black V mouth mark centred low."""
  ax=np.abs(x)-EX; dy=y-EY; hh=np.where(dy>0,TOP,BOT); dia=np.abs(ax)/EHW+np.abs(dy)/hh
  base=((x/0.172)**2+((y-1.0)/np.where(y>1.0,0.26,0.16))**2)<1
  ux=np.abs(x)/0.15; cy=0.902+0.085*np.clip(ux,0,1.2)**2.2; th=0.021*(1-0.35*np.clip(ux,0,1)**2)
  band=(np.abs(y-cy)<th)&(ux<1.05); rim=(np.abs(y-cy)<th+0.0045)&(ux<1.08)&~band
  lips=((x/0.086)**2+((y-0.911)/0.034)**2)<1; smile=band|lips
  vx=np.abs(x); vee=(vx<0.016)&(np.abs((y-0.884)-vx*0.9)<0.0032)
  nose=(x**2+((y-0.967)/0.85)**2)<0.0135**2
  col=np.zeros(x.shape+(3,),np.float32); col[:]=(0.957,0.93,0.88)
  inner=dia<1-OUT/EHW; edge=(dia<1)&~inner
  col[inner]=(0.48,0.55,0.95); col[edge]=(0.10,0.12,0.36)
  col[rim]=(0.957,0.93,0.88); col[smile]=(0.82,0.08,0.10); col[vee]=(0.03,0.03,0.04); col[nose]=(0.98,0.66,0.12)
  return col, base|(dia<1)|smile|rim, lips|vee
tri=I; c=P[tri].mean(1); nz=N[tri][:,:,2].min(1)
sel=(nz>-0.05)&(np.abs(c[:,0])<0.19)&(c[:,1]>0.84)&(c[:,1]<1.27)&(c[:,2]>0.05)
_,inpat,_=pattern(c[:,0],c[:,1]); sel&=inpat|(((c[:,0]/0.19)**2+((c[:,1]-1.0)/0.3)**2)<1)
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
    px=ka*x0+kb*x1+kc*x2; py=ka*y0+kb*y1+kc*y2; m=((px-gx)**2+(py-gy)**2)<0.64; a,b,cc=ka,kb,kc
    if not m.any(): continue
    a,b,cc=a[m],b[m],cc[m]; p=a[:,None]*P[t[0]]+b[:,None]*P[t[1]]+cc[:,None]*P[t[2]]; uv=a[:,None]*UV[t[0]]+b[:,None]*UV[t[1]]+cc[:,None]*UV[t[2]]
    bc=tex[(np.clip(uv[:,1],0,1)*(TH-1)).astype(int),(np.clip(uv[:,0],0,1)*(TW-1)).astype(int)]
    col,inside,sm=pattern(p[:,0],p[:,1]); hh,ss,vv=hsv(bc); lipz=sm&(hh<34.5)&(vv>0.85)&(ss>0.08); al=(inside&(skin(bc)|lipz)).astype(np.float32)
    iy,ix=(gy[m]-.5).astype(int),(gx[m]-.5).astype(int); RGB[iy,ix]=col; A[iy,ix]=np.maximum(A[iy,ix],inside.astype(np.float32)); C[iy,ix]=True; NS[iy,ix]|=~(skin(bc)|lipz); hit[k]=al.any()
  return RGB,A,hit,u0,v0,sc,S,C,NS
_,_,hit,*_=rast(T,1024); T=T[hit]
RGB,A,hit,u0,v0,sc,S,C,NS=rast(T,2048)
# despeckle the skin mask (texture noise): open/close 1 px
F=lambda m,f: np.asarray(Image.fromarray((m*255).astype(np.uint8)).filter(f))>127
NSg=NS&F(NS,ImageFilter.MedianFilter(3))   # hair / brows / eyes / lip line, lone specks dropped
A=(A>0.5)&C&~NSg
A=A|(F(A,ImageFilter.MaxFilter(3))&~C)   # gutter: 2 px past the island edge, never into the face
A=A.astype(np.float32)
T=T[hit]; print('painted tris',len(T))
# bleed colour outward so mip / filtering never pulls black
img=Image.fromarray((np.clip(RGB,0,1)*255).astype(np.uint8)); 
for _ in range(6): img=Image.composite(img, img.filter(ImageFilter.MaxFilter(3)), Image.fromarray(((RGB.sum(-1)>0)*255).astype(np.uint8))); RGB=np.asarray(img)/255.
out=np.dstack([np.asarray(img),(A*255).astype(np.uint8)]); Image.fromarray(out,'RGBA').save('paint_tex.png')
vi=np.unique(T); remap=-np.ones(len(P),int); remap[vi]=np.arange(len(vi))
np.savez('shell.npz',P=(P[vi]+N[vi]*0.0016).astype(np.float32),N=N[vi],UV=((UV[vi]-[u0,v0])*sc/S).astype(np.float32),J=J[vi],W=W[vi],I=remap[T].astype(np.uint32))
