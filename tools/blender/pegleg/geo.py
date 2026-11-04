# geo.py: tiny numpy mesh kit for Raul's shop items 2 (Blender Z-up; front = -Y; character left = +X)
import numpy as np, math
def lin(h):
  h=h.lstrip('#'); c=[int(h[i:i+2],16)/255 for i in (0,2,4)]
  return [x/12.92 if x<=0.04045 else ((x+0.055)/1.055)**2.4 for x in c]
KEY1=[1,0,1]; KEY2=[0,1,1]
class Part:
  def __init__(s,V,F,C,outline=True): s.V=np.asarray(V,float); s.F=np.asarray(F,int); s.C=np.tile(np.asarray(C,float),(len(s.V),1)) if np.ndim(C)==1 else np.asarray(C,float); s.outline=outline
def rot(ax,a):
  ax=np.asarray(ax,float); ax=ax/np.linalg.norm(ax); x,y,z=ax; c,s=math.cos(a),math.sin(a); C=1-c
  return np.array([[c+x*x*C,x*y*C-z*s,x*z*C+y*s],[y*x*C+z*s,c+y*y*C,y*z*C-x*s],[z*x*C-y*s,z*y*C+x*s,c+z*z*C]])
def grid_faces(nu,nv,wrap_u=False):
  F=[]; U=nu if wrap_u else nu-1
  for i in range(U):
    for j in range(nv-1):
      a=i*nv+j; b=((i+1)%nu)*nv+j; F+=[[a,b,b+1],[a,b+1,a+1]]
  return F
def ellipsoid(c,r,col,seg=16,ring=10,R=None,e=1.0,outline=True):
  V=[]; 
  for i in range(seg):
    ph=2*math.pi*i/seg
    for j in range(ring+1):
      th=math.pi*j/ring; sx=math.sin(th); cz=math.cos(th)
      f=lambda v,p: math.copysign(abs(v)**p,v)
      V.append([f(sx,e)*f(math.cos(ph),e)*r[0],f(sx,e)*f(math.sin(ph),e)*r[1],f(cz,e)*r[2]])
  V=np.array(V)
  if R is not None: V=V@np.asarray(R).T
  V=V+np.asarray(c)
  F=grid_faces(seg,ring+1,True)
  F=[[a,c_,b] for a,b,c_ in F]   # outward winding
  return Part(V,F,col,outline)
def tube(P,rad,col,seg=10,cap=True,up=(0,0,1),outline=True,cols=None):
  P=np.asarray(P,float); K=len(P); rad=np.broadcast_to(np.asarray(rad,float),(K,)); V=[]; up=np.asarray(up,float)
  T=np.gradient(P,axis=0); T/=np.linalg.norm(T,axis=1)[:,None]
  n0=np.cross(T[0],up); 
  if np.linalg.norm(n0)<1e-6: n0=np.cross(T[0],[1,0,0])
  n0/=np.linalg.norm(n0); N=[n0]
  for k in range(1,K):  # parallel transport
    n=N[-1]-np.dot(N[-1],T[k])*T[k]; n/=np.linalg.norm(n); N.append(n)
  for k in range(K):
    b=np.cross(T[k],N[k])
    for i in range(seg):
      a=2*math.pi*i/seg; V.append(P[k]+rad[k]*(math.cos(a)*N[k]+math.sin(a)*b))
  F=[]
  for i in range(seg):
    for k in range(K-1):
      a=k*seg+i; b=k*seg+(i+1)%seg; F+=[[a,b,a+seg],[b,b+seg,a+seg]]
  V=list(V); C=None
  if cols is not None: C=[cols[k] for k in range(K) for i in range(seg)]
  if cap:
    for k,sgn in ((0,-1),(K-1,1)):
      ci=len(V); V.append(P[k]+sgn*T[k]*rad[k]*0.6)
      if C is not None: C.append(cols[k])
      for i in range(seg):
        a=k*seg+i; b=k*seg+(i+1)%seg; F.append([ci,b,a] if sgn<0 else [ci,a,b])
  return Part(np.array(V),F,col if C is None else np.array(C),outline)
def torus(c,R,r,normal,col,s1=20,s2=8,outline=True,arc=2*math.pi,a0=0.0):
  n=np.asarray(normal,float); n/=np.linalg.norm(n); u=np.cross(n,[0,0,1] if abs(n[2])<0.9 else [1,0,0]); u/=np.linalg.norm(u); w=np.cross(n,u)
  full=abs(arc-2*math.pi)<1e-6; cnt=s1 if full else s1+1
  P=[np.asarray(c)+R*(math.cos(a0+arc*i/s1)*u+math.sin(a0+arc*i/s1)*w) for i in range(cnt)]
  if full:
    V=[];T=[]
    for i in range(s1):
      a=a0+arc*i/s1; d=math.cos(a)*u+math.sin(a)*w
      for j in range(s2):
        b=2*math.pi*j/s2; V.append(np.asarray(c)+(R+r*math.cos(b))*d+r*math.sin(b)*n)
    F=[]
    for i in range(s1):
      for j in range(s2):
        a=i*s2+j; b=((i+1)%s1)*s2+j; a2=i*s2+(j+1)%s2; b2=((i+1)%s1)*s2+(j+1)%s2; F+=[[a,b,b2],[a,b2,a2]]
    return Part(np.array(V),F,col,outline)
  return tube(P,r,col,s2,True,n,outline)
def merge(parts):
  V=[];F=[];C=[];o=0
  for p in parts: V.append(p.V); F.append(p.F+o); C.append(p.C); o+=len(p.V)
  return Part(np.vstack(V),np.vstack(F),np.vstack(C))
def vnormals(V,F):
  N=np.zeros_like(V); fn=np.cross(V[F[:,1]]-V[F[:,0]],V[F[:,2]]-V[F[:,0]])
  for k in range(3): np.add.at(N,F[:,k],fn)
  l=np.linalg.norm(N,axis=1); l[l==0]=1; return N/l[:,None]
def weld_normals(V,F):  # normals averaged over coincident verts (seams) so the outline shell never splits
  key=np.round(V*20000).astype(np.int64); _,inv=np.unique(key,axis=0,return_inverse=True); inv=inv.ravel()
  N=vnormals(V,F); S=np.zeros((inv.max()+1,3)); np.add.at(S,inv,N); l=np.linalg.norm(S,axis=1); l[l==0]=1; return (S/l[:,None])[inv]
INK=lin('#15110f')
def finish(parts,ink=0.004,lowlight=False):
  out=[]
  for p in parts:
    out.append(p)
    if p.outline and ink>0:
      N=weld_normals(p.V,p.F); out.append(Part(p.V+N*ink,p.F[:,[0,2,1]],INK,False))
  m=merge(out)
  if lowlight:   # Low = unlit (MeshBasic): bake the game's light (js/pirateGear.js shade) into the colours; three L(0.35,0.8,0.5) -> blender (x,-z,y)
    L=np.array([0.35,-0.5,0.8]); L/=np.linalg.norm(L); N=weld_normals(m.V,m.F); s=0.58+0.42*np.clip(N@L,0,None)+0.08*np.clip(N[:,2],0,None)
    keyed=(np.abs(m.C-np.array(KEY1)).sum(1)<0.05)|(np.abs(m.C-np.array(KEY2)).sum(1)<0.05)
    m.C=np.where(keyed[:,None],m.C,m.C*s[:,None])
  return m
def sheet_solid(G,t,col,outward=None,outline=True):
  # G: (nu,nv,3) outer surface grid; t thickness inward along -normal (or toward 'outward' reference). Returns closed solid
  nu,nv,_=G.shape; V0=G.reshape(-1,3); F=np.array(grid_faces(nu,nv))
  N=vnormals(V0,F)
  if outward is not None:
    if np.mean(np.sum(N*(V0-np.asarray(outward)),1))<0: F=F[:,[0,2,1]]; N=-N
  V1=V0-N*t; n=len(V0)
  Fo=list(F); Fi=[[a+n,c+n,b+n] for a,b,c in F]
  ring=[(i,0) for i in range(nu)]+[(nu-1,j) for j in range(1,nv)]+[(i,nv-1) for i in range(nu-2,-1,-1)]+[(0,j) for j in range(nv-2,0,-1)]
  idx=[i*nv+j for i,j in ring]; R=[]
  for k in range(len(idx)):
    a=idx[k]; b=idx[(k+1)%len(idx)]; R+=[[a,b,b+n],[a,b+n,a+n]]
  Fa=np.array(Fo+Fi+R)
  # make sure the rim winds like the outer sheet (outward)
  Vall=np.vstack([V0,V1]); c=Vall.mean(0); rimF=np.array(R); fn=np.cross(Vall[rimF[:,1]]-Vall[rimF[:,0]],Vall[rimF[:,2]]-Vall[rimF[:,0]]); cen=Vall[rimF].mean(1)
  if np.mean(np.sum(fn*(cen-c),1))<0: Fa[len(Fo)+len(Fi):]=Fa[len(Fo)+len(Fi):][:,[0,2,1]]
  C=col if np.ndim(col)==1 else np.vstack([col,col])
  return Part(Vall,Fa,C,outline)
