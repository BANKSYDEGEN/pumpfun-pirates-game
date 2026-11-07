# V7 female refit of v5-female gear: bone-segment transfer (length + radial girth ratio per ray), clearance push, body reweight.
import bpy,sys,json,numpy as np
sys.path.insert(0,'/workspace/v7f-gear-work');from glb_io import GLB
from mathutils.bvhtree import BVHTree
from mathutils import Vector
W='/workspace/v7f-gear-work/'
args=sys.argv[sys.argv.index('--')+1:]; MODE=args[0]; SRC=args[1]; DST=args[2]; LOD=args[3] if len(args)>3 else 'hi'
def prim(g,mi=None):
  if mi is None: mi=max(range(len(g.d['meshes'])),key=lambda i:g.d['accessors'][g.d['meshes'][i]['primitives'][0]['attributes']['POSITION']]['count'])
  return g.d['meshes'][mi]['primitives'][0]
def body(f):
  g=GLB(f);p=prim(g);A=p['attributes'];P=g.array(A['POSITION']).astype(float);I=g.array(p['indices']).reshape(-1,3)
  J=g.array(A['JOINTS_0']).astype(int);Wt=g.array(A['WEIGHTS_0']).astype(float)
  if Wt.max()>1.5: Wt/=255.
  N=g.array(A['NORMAL']).astype(float)
  s=g.d['skins'][0];names=[g.d['nodes'][j]['name'] for j in s['joints']];IBM=g.array(s['inverseBindMatrices']).reshape(-1,4,4)
  heads={n:np.linalg.inv(IBM[k].T)[:3,3] for k,n in enumerate(names)}
  T=BVHTree.FromPolygons(P.tolist(),I.tolist())
  return dict(P=P,I=I,J=J,W=Wt,N=N,names=names,heads=heads,T=T)
B5=body(W+'dec/body_female_v5_hi.glb');B7=body(W+f'dec/body_female_v7_{"lo" if LOD=="lo" and False else "hi"}.glb')
def segs(B):
  h=B['heads'];P=B['P'];H=P[:,1].max();S={}
  S['spine']=(h['spine'],h['head']);S['root']=S['spine'];S['tails']=S['spine']
  S['head']=(h['head'],np.array([0,H,h['head'][2]]));S['braid']=S['head']
  for s,sg in (('L',1),('R',-1)):
    ua,fa=h['upperarm.'+s],h['forearm.'+s];S['upperarm.'+s]=(ua,fa);d=(fa-ua)/np.linalg.norm(fa-ua)
    side=P[P[:,0]*sg>0];L=(side@d-fa@d).max();S['forearm.'+s]=(fa,fa+d*L)
    th,sh=h['thigh.'+s],h['shin.'+s];S['thigh.'+s]=(th,sh);S['shin.'+s]=(sh,np.array([sh[0],0.0,sh[2]]))
  return S
S5=segs(B5);S7=segs(B7)
def rot(a,b):
  a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);v=np.cross(a,b);c=a@b
  if np.linalg.norm(v)<1e-9: return np.eye(3)
  K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]]);return np.eye(3)+K+K@K*(1/(1+c))
R={k:rot(S5[k][1]-S5[k][0],S7[k][1]-S7[k][0]) for k in S5}
NT,NA=24,24
def frame(k,a):
  a=a/np.linalg.norm(a); ref=np.array([0,1.,0]) if k.startswith(('upperarm','forearm')) else np.array([0,0,1.])
  u=ref-(ref@a)*a; u/=np.linalg.norm(u); v=np.cross(a,u); return a,u,v
def coords(k,S,p,Rk=None):
  h,t=S[k];ax=t-h;a,u,v=frame(k,ax) if Rk is None else Rk
  tt=(p-h)@ax/(ax@ax);r=p-h-np.outer(tt,ax) if p.ndim>1 else p-h-tt*ax
  x=r@u;y=r@v;return tt,np.arctan2(y,x),np.hypot(x,y)
GROUP={'root':'spine','tails':'spine','braid':'head'}
def profile(B,S,k):
  # body vertices whose dominant joint belongs to segment k (spine group / head group merged)
  dom=np.array(B['names'])[B['J'][np.arange(len(B['J'])),B['W'].argmax(1)]];dom=np.array([GROUP.get(d,d) for d in dom])
  m=dom==k
  if k=='spine': m|=np.isin(dom,['spine'])
  P=B['P'][m];tt,an,rr=coords(k,S,P)
  ti=np.clip(((tt+0.1)/1.2*NT).astype(int),0,NT-1);ai=((an+np.pi)/(2*np.pi)*NA).astype(int)%NA
  T=np.full((NT,NA),np.nan)
  for i in range(NT):
    for j in range(NA):
      sel=(ti==i)&(ai==j)
      if sel.sum()>=2: T[i,j]=np.percentile(rr[sel],float(__import__('os').environ.get('PCT','97')))
  # fill holes: angular then t neighbours
  for _ in range(30):
    if not np.isnan(T).any(): break
    T2=T.copy()
    for i in range(NT):
      for j in range(NA):
        if np.isnan(T[i,j]):
          nb=[T[i,(j-1)%NA],T[i,(j+1)%NA]]+([T[i-1,j]] if i>0 else [])+([T[i+1,j]] if i<NT-1 else [])
          nb=[x for x in nb if not np.isnan(x)]
          if nb: T2[i,j]=np.mean(nb)
    T=T2
  T=np.nan_to_num(T,nan=0.05)
  # smooth
  K=T.copy()
  for i in range(NT):
    for j in range(NA): K[i,j]=np.mean([T[ii,jj%NA] for ii in range(max(0,i-1),min(NT,i+2)) for jj in range(j-1,j+2)])
  return K
SEGS=[b+'.'+s for b in ('upperarm','forearm') for s in 'LR']
PR5={k:profile(B5,S5,k) for k in SEGS};PR7={k:profile(B7,S7,k) for k in SEGS}
def look(T,tt,an):
  x=np.clip((tt+0.1)/1.2*NT-0.5,0,NT-1.001);y=((an+np.pi)/(2*np.pi)*NA-0.5)%NA
  i=int(x);j=int(y);fx=x-i;fy=y-j;j1=(j+1)%NA
  return (T[i,j]*(1-fx)+T[i+1,j]*fx)*(1-fy)+(T[i,j1]*(1-fx)+T[i+1,j1]*fx)*fy
def mapseg(k,p):
  h5,t5=S5[k];h7,t7=S7[k];a5=t5-h5;a7=t7-h7
  A5=frame(k,a5);A7=(R[k]@A5[0],R[k]@A5[1],R[k]@A5[2])
  tt,an,L=coords(k,S5,p,A5)
  r5=look(PR5[k],tt,an);r7=look(PR7[k],tt,an)
  L2=L*r7/r5 if L<r5 else r7+(L-r5)
  return h7+tt*a7+L2*(np.cos(an)*A7[1]+np.sin(an)*A7[2])
# vertical groups: anatomical height map + horizontal cross-section profiles
def knots(B):
  h=B['heads'];return np.array([0.0,h['shin.L'][1],h['thigh.L'][1],0,0,0,1.397])
K5=np.array([0.0,.224,.42,.54,.69,.84,1.397]);K7=np.array([0.0,.304,.534,.60,.72,.85,1.397])
K5[1]=B5['heads']['shin.L'][1];K5[2]=B5['heads']['thigh.L'][1];K7[1]=B7['heads']['shin.L'][1];K7[2]=B7['heads']['thigh.L'][1]
def ymap(y): 
  if y<=K5[-1]: return float(np.interp(y,K5,K7))
  return y
ENV=float(__import__('os').environ.get('ENV','0'));ENVALL=int(__import__('os').environ.get('ENVALL','0'))
VG={'spine':'torso','root':'torso','tails':'torso','head':'head','braid':'head','thigh.L':'legL','shin.L':'legL','thigh.R':'legR','shin.R':'legR'}
NY=int(__import__('os').environ.get('NY','70'))
def sgroup(P,crotch,neck):
  g=np.where(P[:,1]>neck,'head',np.where(P[:,1]>crotch,'torso',np.where(P[:,0]>0,'legL','legR')));return g
CR5=B5['heads']['thigh.L'][1]-0.045;CR7=B7['heads']['thigh.L'][1]-0.045;NK5=0.86;NK7=0.865
def vprof(B,grp):
  names=np.array(B['names']);dom=names[B['J'][np.arange(len(B['J'])),B['W'].argmax(1)]]
  cr,nk=(CR5,NK5) if B is B5 else (CR7,NK7)
  ok=~np.isin(dom,['upperarm.L','upperarm.R','forearm.L','forearm.R'])&~((np.isin(dom,['braid','head']))&(B['P'][:,1]<nk))
  if grp=='head': ok=np.isin(dom,['head','braid'])
  m=ok&(sgroup(B['P'],cr,nk)==grp) if grp!='head' else ok;P=B['P'][m]
  yi=np.clip((P[:,1]/1.4*NY).astype(int),0,NY-1);C=np.full((NY,2),np.nan);T=np.full((NY,NA),np.nan)
  for i in range(NY):
    s=P[yi==i]
    if len(s)<6: continue
    C[i]=[(s[:,0].min()+s[:,0].max())/2,(s[:,2].min()+s[:,2].max())/2]
  ok=~np.isnan(C[:,0]);idx=np.arange(NY)
  for c in range(2): C[:,c]=np.interp(idx,idx[ok],C[ok,c])
  an=np.arctan2(P[:,2]-C[yi,1],P[:,0]-C[yi,0]);rr=np.hypot(P[:,2]-C[yi,1],P[:,0]-C[yi,0]);ai=((an+np.pi)/(2*np.pi)*NA).astype(int)%NA
  for i in range(NY):
    for j in range(NA):
      sel=(yi==i)&(ai==j)
      if sel.sum()>=2: T[i,j]=rr[sel].max()
  for _ in range(60):
    if not np.isnan(T).any(): break
    T2=T.copy()
    for i in range(NY):
      for j in range(NA):
        if np.isnan(T[i,j]):
          nb=[T[i,(j-1)%NA],T[i,(j+1)%NA]]+([T[i-1,j]] if i>0 else [])+([T[i+1,j]] if i<NY-1 else [])
          nb=[x for x in nb if not np.isnan(x)]
          if nb: T2[i,j]=np.mean(nb)
    T=T2
  T=np.nan_to_num(T,nan=0.05)
  for _ in range(2):
    Kt=T.copy()
    for i in range(NY):
      for j in range(NA): Kt[i,j]=np.mean([T[ii,jj%NA] for ii in range(max(0,i-2),min(NY,i+3)) for jj in range(j-2,j+3)])
    T=np.maximum(Kt,T*float(__import__('os').environ.get('PEAK','0.9')))
  return C,T
VP5={g:vprof(B5,g) for g in ['torso','head','legL','legR']};VP7={g:vprof(B7,g) for g in ['torso','head','legL','legR']}
def vlook(CT,y,an):
  C,T=CT;x=np.clip(y/1.4*NY-0.5,0,NY-1.001);i=int(x);fx=x-i;c=C[i]*(1-fx)+C[i+1]*fx
  yy=((an+np.pi)/(2*np.pi)*NA-0.5)%NA;j=int(yy);fy=yy-j;j1=(j+1)%NA
  r=(T[i,j]*(1-fx)+T[i+1,j]*fx)*(1-fy)+(T[i,j1]*(1-fx)+T[i+1,j1]*fx)*fy
  return c,r
def mapvert(g,p):
  y7=ymap(p[1]);C5,_=VP5[g];x=np.clip(p[1]/1.4*NY-0.5,0,NY-1.001);i=int(x);fx=x-i;c5=C5[i]*(1-fx)+C5[i+1]*fx
  an=np.arctan2(p[2]-c5[1],p[0]-c5[0]);L=np.hypot(p[2]-c5[1],p[0]-c5[0])
  _,r5=vlook(VP5[g],p[1],an);c7,r7=vlook(VP7[g],y7,an)
  L2=L*r7/r5 if L<r5 else r7+(L-r5)
  if ENV and g!='head' and (ENVALL or L>0.6*r5): L2=max(L2,r7*ENV)
  return np.array([c7[0]+L2*np.cos(an),y7,c7[1]+L2*np.sin(an)])
def mapseg(k,p,_ms=mapseg):
  if k in VG: return mapvert(VG[k] if VG[k]=='head' else str(sgroup(p[None],CR5,NK5)[0]),p)
  return _ms(k,p)
def mapv(p,j,w,names):
  acc=np.zeros(3);ws=0
  for jj,ww in zip(j,w):
    if ww<0.02: continue
    k=names[jj]; acc+=ww*mapseg(k,p); ws+=ww
  return acc/ws if ws else p
g=GLB(SRC);pr=prim(g);A=pr['attributes'];P=g.array(A['POSITION']).astype(float)
SKIN='JOINTS_0' in A
if SKIN:
  J=g.array(A['JOINTS_0']).astype(int);Wt=g.array(A['WEIGHTS_0']).astype(float);names=[g.d['nodes'][j]['name'] for j in g.d['skins'][0]['joints']]
else:
  names=B5['names'];J=np.zeros((len(P),4),int);J[:,0]=names.index(__import__('os').environ.get('DEFJ','head'));Wt=np.zeros((len(P),4));Wt[:,0]=1
wn=Wt.max()>1.5
if wn: Wt=Wt/255.
I=g.array(pr['indices']).reshape(-1,3)
DY=float(__import__('os').environ.get('DY','0'));P[:,1]+=DY
Q=np.array([mapv(P[i],J[i],Wt[i],names) for i in range(len(P))])
nbr=[set() for _ in range(len(Q))]
key=np.round(P*1e5).astype(np.int64);_,wid=np.unique(key,axis=0,return_inverse=True);wid=wid.ravel()
for t in I:
  for x in t: nbr[x].update(t)
grp={}
for i,w in enumerate(wid): grp.setdefault(w,[]).append(i)
for w,L in grp.items():
  if len(L)>1:
    for i in L: nbr[i].update(L)
nbr=[np.array(sorted(n)) for n in nbr]

NS=int(__import__('os').environ.get('NSMOOTH','6'))
if MODE in ('cloth','seg'):
  D=Q-P
  for _ in range(NS): D=0.5*D+0.5*np.array([D[n].mean(0) for n in nbr])
  Q=P+D
if MODE in ('rigid','affine'):   # one transform for the whole item (keeps hard-surface shape)
  X=np.c_[P,np.ones(len(P))]
  if MODE=='affine': M,_,_,_=np.linalg.lstsq(X,Q,rcond=None);Q=X@M
  else:
    c5=P.mean(0);c7=Q.mean(0);Q=c7+(P-c5)
# clearance: the item never sits inside the V7 body (incl. her baked top / shorts); pushes spread over the mesh so shells stay whole
CLR=float(args[4]) if len(args)>4 else 0.004
pushed=0
if CLR>0:
  for it in range(4):
    D=np.zeros_like(Q)
    for i in range(len(Q)):
      q,n,fi,dist=B7['T'].find_nearest(Vector(Q[i]))
      if q is None or dist>0.08: continue
      s_=(Vector(Q[i])-q).dot(n)
      if s_<CLR and s_>-0.08: D[i]=np.array(n)*(CLR-s_)
    pushed=int((np.linalg.norm(D,axis=1)>0).sum())
    if not pushed: break
    for _ in range(10):
      M=np.array([D[n].mean(0) for n in nbr]);big=np.linalg.norm(M,axis=1)>np.linalg.norm(D,axis=1);D[big]=M[big]
    Q=Q+D
if int(__import__('os').environ.get('FLOOR','0')): Q[:,1]=np.maximum(Q[:,1],min(P[:,1].min(),0.0))   # soles stay on the floor
# reweight from the V7 body (nearest triangle, barycentric blend of its vertex weights)
RW=MODE=='cloth' and SKIN
if RW and int(__import__('os').environ.get('LEGW','0')):   # footwear: weights from her leg skin only (not the braid tip / hips)
  dn=np.array(B7['names'])[B7['J'][np.arange(len(B7['J'])),B7['W'].argmax(1)]];leg=np.char.startswith(dn.astype(str),('thigh','shin')) if False else np.array([d.startswith(('thigh','shin')) for d in dn])
  keep=leg[B7['I']].all(1);B7['I']=B7['I'][keep];B7['T']=BVHTree.FromPolygons(B7['P'].tolist(),B7['I'].tolist())
if RW:
  nb=len(names);NW=np.zeros((len(Q),nb))
  bmap=[names.index(n) for n in B7['names']]
  for i in range(len(Q)):
    q,n,fi,dist=B7['T'].find_nearest(Vector(Q[i]));tri=B7['I'][fi];a,b,c=B7['P'][tri];v0=b-a;v1=c-a;v2=np.array(q)-a
    d00=v0@v0;d01=v0@v1;d11=v1@v1;den=d00*d11-d01*d01 or 1e-12;v=(d11*(v2@v0)-d01*(v2@v1))/den;w=(d00*(v2@v1)-d01*(v2@v0))/den;bc=np.clip([1-v-w,v,w],0,1);bc/=bc.sum()
    for vv,bb in zip(tri,bc):
      for jj,ww in zip(B7['J'][vv],B7['W'][vv]): NW[i,bmap[jj]]+=bb*ww
  o=np.argsort(-NW,1)[:,:4];J=o;Wt=np.take_along_axis(NW,o,1);Wt/=Wt.sum(1,keepdims=True)
# normals: smooth over welded positions
FN=np.cross(Q[I[:,1]]-Q[I[:,0]],Q[I[:,2]]-Q[I[:,0]]);key=np.round(P*1e5).astype(np.int64);_,inv=np.unique(key,axis=0,return_inverse=True);inv=inv.ravel()
VN=np.zeros((inv.max()+1,3))
for k in range(3): np.add.at(VN,inv[I[:,k]],FN)
N=VN[inv];N/=np.linalg.norm(N,axis=1,keepdims=True)+1e-12
A['POSITION']=g.add_array(Q.astype('<f4'),'VEC3',bounds=True);A['NORMAL']=g.add_array(N.astype('<f4'),'VEC3')
if RW:
  A['JOINTS_0']=g.add_array(J.astype('u1'),'VEC4',5121)
  A['WEIGHTS_0']=g.add_array((np.round(Wt*255).astype('u1') if wn else Wt.astype('<f4')),'VEC4',5121 if wn else 5126)
  if wn: g.d['accessors'][A['WEIGHTS_0']]['normalized']=True
g.save(DST)
d=np.linalg.norm(Q-P,axis=1);print('FIT',SRC.split('/')[-1],MODE,'n',len(P),'move med %.3f max %.3f'%(np.median(d),d.max()),'pushed',pushed)
