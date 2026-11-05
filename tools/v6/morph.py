# [V6 v5-shape] conform the V6 body onto the v5 body surface (BANKSY t420u: "v5 clothes ... should be same shape"): every v5 item then
# fits unchanged. Smoothed nearest-surface displacement (keeps the V6 paint / UV layout coherent), then a final shrink-wrap onto the v5
# surface, a hair-thin inward offset (the v5 clothes sit on the v5 skin), so the silhouette, joints and limb thickness ARE the v5 ones.
import bpy, numpy as np
from mathutils.bvhtree import BVHTree
from mathutils import Vector
def _bvh(o):
  dg=bpy.context.evaluated_depsgraph_get(); oe=o.evaluated_get(dg); me=oe.to_mesh(); MW=o.matrix_world
  V=[MW@v.co for v in me.vertices]; F=[tuple(p.vertices) for p in me.polygons]; oe.to_mesh_clear(); return BVHTree.FromPolygons(V,F)
def _lap(me):
  E=np.zeros(len(me.edges)*2,int); me.edges.foreach_get('vertices',E); E=E.reshape(-1,2); n=len(me.vertices)
  deg=np.bincount(E.ravel(),minlength=n).astype(float); deg[deg==0]=1
  def avg(D):
    S=np.zeros_like(D); np.add.at(S,E[:,0],D[E[:,1]]); np.add.at(S,E[:,1],D[E[:,0]]); return S/deg[:,None]
  return avg
def conform(body, src, iters=(40,24), final_in=(0.0004,0.0012), push_iters=10, wfn=None, pmask_fn=None, log=print):
  me=body.data; MW=body.matrix_world; MI=MW.inverted(); T=_bvh(src); avg=_lap(me)
  P=np.array([(MW@v.co)[:] for v in me.vertices])
  for it,ns in enumerate(iters):
    Q=np.zeros_like(P)
    for i,p in enumerate(P): q,_,_,_=T.find_nearest(Vector(p)); Q[i]=q[:] if q is not None else p
    D=Q-P
    for _ in range(ns): D=0.5*D+0.5*avg(D)
    if wfn is not None: D=D*wfn(P)[:,None]
    P=P+D; log(f'conform pass {it} smooth {ns} mean move {np.linalg.norm(D,axis=1).mean()*1000:.1f} mm',flush=True)
  pmask=pmask_fn(P) if pmask_fn else None
  # final: push IN only (no V6 vertex outside the v5 skin), as a smoothed field so nothing folds; inside stays as sculpted
  for k in range(push_iters):
    D=np.zeros_like(P); out=0
    for i,p in enumerate(P):
      q,n,_,_=T.find_nearest(Vector(p))
      if q is None: continue
      q=np.array(q[:]); n=np.array(n[:]); s=float(np.dot(p-q,n))
      if s>-final_in[0] and (pmask is None or pmask[i]): D[i]=-n*(s+final_in[1]); out+=1
    if not out: break
    for _ in range(4): D=np.where((np.linalg.norm(D,axis=1)>0)[:,None],D,0.5*avg(D))   # spread the push to the ring around it
    for _ in range(2): D=0.6*D+0.4*avg(D)
    P=P+D; log(f'push-in {k}: {out} outside',flush=True)
  for v,p in zip(me.vertices,P): v.co=MI@Vector(p)
  me.update()

def push_under(body, objs, margin=0.002, zmax=9.0, iters=10, log=print):
  """push the body inward until it is under every one of objs' surfaces (v5 clothes worn by default), within z < zmax only"""
  me=body.data; MW=body.matrix_world; MI=MW.inverted(); avg=_lap(me); TT=[_bvh(o) for o in objs]
  P=np.array([(MW@v.co)[:] for v in me.vertices])
  for k in range(iters):
    D=np.zeros_like(P); out=0
    for i,p in enumerate(P):
      if p[2]>zmax: continue
      for T in TT:
        q,n,_,_=T.find_nearest(Vector(p),0.03)
        if q is None: continue
        q=np.array(q[:]); n=np.array(n[:]); s=float(np.dot(p-q,n))
        if -margin<s<0.02: D[i]=-n*(s+margin*1.5); out+=1; break
    if not out: break
    for _ in range(4): D=np.where((np.linalg.norm(D,axis=1)>0)[:,None],D,0.5*avg(D))
    for _ in range(2): D=0.6*D+0.4*avg(D)
    P=P+D; log(f'push-under {k}: {out}',flush=True)
  for v,p in zip(me.vertices,P): v.co=MI@Vector(p)
  me.update()

def head_radial(body, src, c, z0, z1, margin=0.003, NA=48, NB=24, log=print):
  """head + hair: compress radially from the head centre c so the whole V6 head sits inside the v5 head / hair (hats fit), every layer
  scaled by the same smooth factor per direction (no folds, front strands stay in front of the face). Blend in z0 -> z1 (neck)."""
  me=body.data; MW=body.matrix_world; MI=MW.inverted(); T=_bvh(src); c=np.array(c)
  P=np.array([(MW@v.co)[:] for v in me.vertices]); w=np.clip((P[:,2]-z0)/(z1-z0),0,1); sel=w>0
  d=P-c; r=np.linalg.norm(d,axis=1)+1e-9; u=d/r[:,None]
  az=(np.arctan2(u[:,1],u[:,0])%(2*np.pi))/(2*np.pi)*NA; el=(np.arcsin(np.clip(u[:,2],-1,1))+np.pi/2)/np.pi*NB
  R6=np.zeros((NB,NA)); ia=np.clip(az.astype(int),0,NA-1); ie=np.clip(el.astype(int),0,NB-1)
  for i in np.where(sel)[0]: R6[ie[i],ia[i]]=max(R6[ie[i],ia[i]],r[i])
  R5=np.zeros((NB,NA))
  for b in range(NB):
    for a in range(NA):
      th=(a+0.5)/NA*2*np.pi; ph=(b+0.5)/NB*np.pi-np.pi/2; dv=Vector((np.cos(ph)*np.cos(th),np.cos(ph)*np.sin(th),np.sin(ph)))
      o=Vector(c[:].tolist()); best=0.0
      for _ in range(8):   # the outermost v5 hit along this ray
        hit,_,_,dist=T.ray_cast(o,dv,1.0)
        if hit is None: break
        best=(hit-Vector(c.tolist())).length; o=hit+dv*1e-4
      R5[b,a]=best
  K=np.ones((NB,NA)); m=(R6>0)&(R5>0); K[m]=np.minimum(1.0,(R5[m]-margin)/R6[m])
  from math import ceil
  for _ in range(6):   # smooth (wrap in azimuth), never above 1
    Kp=np.pad(K,((1,1),(0,0)),mode='edge'); K=np.minimum(K,(Kp[:-2]+Kp[2:]+np.roll(K,1,1)+np.roll(K,-1,1)+K)/5)
  fa=az-0.5; fe=el-0.5; a0=np.floor(fa).astype(int); e0=np.clip(np.floor(fe).astype(int),0,NB-1); ta=fa-a0; te=np.clip(fe-e0,0,1); e1=np.clip(e0+1,0,NB-1)
  k=(K[e0,a0%NA]*(1-ta)+K[e0,(a0+1)%NA]*ta)*(1-te)+(K[e1,a0%NA]*(1-ta)+K[e1,(a0+1)%NA]*ta)*te
  k=1+(k-1)*w; P2=c+d*k[:,None]
  for v,p in zip(me.vertices,P2): v.co=MI@Vector(p)
  me.update(); log(f'head radial: {int(sel.sum())} verts, factor min {k[sel].min():.2f} mean {k[sel].mean():.2f}',flush=True)
