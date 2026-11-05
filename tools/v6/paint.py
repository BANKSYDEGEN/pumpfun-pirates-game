# [V6 paint pass] crisp tint regions + clean albedo (BANKSY "clean face and hair paint (no smears, a clean hairline)", "clean white underwear")
# 1) every face gets ONE class (skin 0 / hair 1 / cloth -1): vertex-majority, then a face-graph majority filter (no speckles, smoother edges)
# 2) the mesh is split along class borders so no triangle blends two tints (the game retints COLOR_0 per vertex from _TINT)
# 3) the albedo is rebuilt per texel from its face class: class colour x the original's own shading (luminance ratio, clamped, lightly
#    denoised): no gold / teal / skin flecks on the wrong class; the tattoo (teal) stays where it is painted on skin.
import bpy, bmesh, numpy as np
def clean(me, img, log=print, force_skin=None, head_z=None, face=None):
  W0,H0=img.size; A0=np.array(img.pixels[:],dtype=np.float32).reshape(H0,W0,4)[...,:3]
  nv=len(me.vertices); T=np.zeros(nv); me.attributes['_TINT'].data.foreach_get('value',T); T=np.round(T).astype(int)
  bm=bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); bm.verts.ensure_lookup_table()
  nf=len(bm.faces); FC=np.zeros(nf,int)
  for f in bm.faces:
    c=[T[v.index] for v in f.verts]; FC[f.index]=max(set(c),key=lambda k:(c.count(k), k==0))
  nb=[[g.index for e in f.edges for g in e.link_faces if g is not f] for f in bm.faces]
  # the paint is the truth for the class (the ref's gold hair / skin / white cloth): each face's own texels vote (centroid + corners)
  ul=bm.loops.layers.uv.active; FCOL=np.zeros((nf,3))
  for f in bm.faces:
    us=[l[ul].uv for l in f.loops]; cu=sum((u for u in us),type(us[0])((0,0)))/len(us); pts=[cu]+[cu*0.4+u*0.6 for u in us]
    FCOL[f.index]=np.mean([A0[min(int(p_[1]*H0),H0-1),min(int(p_[0]*W0),W0-1)] for p_ in pts],0)
  CM={k:np.median(FCOL[FC==k],0) for k in (-1,0,1) if (FC==k).any()}; flips=0
  for i in range(nf):
    d={k:np.linalg.norm(FCOL[i]-c) for k,c in CM.items()}; kb=min(d,key=d.get)
    if kb!=FC[i] and d[kb]*1.35<d[FC[i]]: FC[i]=kb; flips+=1
  log(f'paint: faces reclassed by their paint {flips}, class colours {({k:np.round(c,2).tolist() for k,c in CM.items()})}',flush=True)
  for _ in range(3):
    N=FC.copy()
    for i,L in enumerate(nb):
      if not L: continue
      c=[FC[j] for j in L]+[FC[i]]; k=max(set(c),key=c.count)
      if c.count(k)>=3 and k!=FC[i]: N[i]=k
    FC=N
  for _ in range(2):   # small islands of a class (stray beard flecks on the chest, skin holes in the hair) -> the class around them
    seen=np.zeros(nf,bool); flips=0
    for i0 in range(nf):
      if seen[i0]: continue
      k=FC[i0]; comp=[i0]; seen[i0]=True; st=[i0]
      while st:
        i=st.pop()
        for j in nb[i]:
          if not seen[j] and FC[j]==k: seen[j]=True; comp.append(j); st.append(j)
      if len(comp)<{1:10,0:10,-1:16}[k]:
        cs=set(comp); ring=[FC[j] for i in comp for j in nb[i] if j not in cs]
        if ring: nk=max(set(ring),key=ring.count); FC[comp]=nk; flips+=len(comp)
    log(f'paint: island faces flipped {flips}',flush=True)
  if head_z is not None:   # [V5 vs V6] no white cloth faces in the head / beard (the white shards in his beard): dark -> hair, else skin
    nh=0
    for f in bm.faces:
      if FC[f.index]==-1 and f.calc_center_median().z>head_z: FC[f.index]=1 if FCOL[f.index].mean()<0.6 else 0; nh+=1
    log(f'paint: head cloth faces reclassed {nh}',flush=True)
  if face is not None and face[0] is not None:   # [V5 vs V6] the face front is clean skin (the AI's dark cheek / nose / mouth shading faces out); his beard below the mouth stays
    MCf,SEPf,FEMf=face; ez=MCf[2]+(0.60 if FEMf else 0.64)*SEPf; z0=MCf[2]-(0.40*SEPf if FEMf else -0.40*SEPf); nfz=0
    for f in bm.faces:
      c=f.calc_center_median(); n=f.normal
      if z0<c.z<ez+0.12*SEPf and abs(c.x-MCf[0])<(1.05 if FEMf else 0.50)*SEPf and n.y<-0.25 and c.y<MCf[1]+0.05 and FC[f.index]!=0: FC[f.index]=0; nfz+=1
    log(f'paint: face-front faces -> skin {nfz}',flush=True)
  if force_skin is not None:   # the smoothed mouth: skin only (no dark cavity / lip faces showing)
    for f in bm.faces:
      if any(force_skin[v.index] for v in f.verts if v.index<len(force_skin)): FC[f.index]=0
  cl=bm.faces.layers.int.new('cls')
  for f in bm.faces: f[cl]=int(FC[f.index])
  edges=[e for e in bm.edges if len(e.link_faces)==2 and e.link_faces[0][cl]!=e.link_faces[1][cl]]
  bmesh.ops.split_edges(bm,edges=edges)
  bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
  VC={}
  for f in bm.faces:
    for v in f.verts: VC.setdefault(v.index,f[cl])
  FCL=np.array([f[cl] for f in bm.faces]); bm.faces.layers.int.remove(cl); bm.to_mesh(me); bm.free(); me.update()
  # per-vertex tint = class; COLOR_0 (corner) = that class's median colour
  T2=np.array([VC.get(i,0) for i in range(len(me.vertices))],float); me.attributes['_TINT'].data.foreach_set('value',T2)
  ca=me.color_attributes['Color']; nl=len(me.loops); C=np.zeros(nl*4); ca.data.foreach_get('color',C); C=C.reshape(-1,4)
  LV=np.zeros(nl,int); me.loops.foreach_get('vertex_index',LV); LT=T2[LV].astype(int)
  for k in (-1,0,1):
    m=LT==k
    if m.any(): C[m]=np.median(C[m],0)
  ca.data.foreach_set('color',C.ravel())
  log(f'paint: faces {nf}, class border edges split {len(edges)}, classes {dict(zip(*np.unique(FCL,return_counts=True)))}',flush=True)
  # albedo per texel from the face class (rasterised in UV)
  W,H=img.size; A=np.array(img.pixels[:],dtype=np.float32).reshape(H,W,4)
  uv=np.zeros(nl*2); me.uv_layers[0].data.foreach_get('uv',uv); uv=uv.reshape(-1,2)
  LS=np.zeros(len(me.polygons),int); me.polygons.foreach_get('loop_start',LS); LTo=np.zeros(len(me.polygons),int); me.polygons.foreach_get('loop_total',LTo)
  K=np.full((H,W),-9,np.int8)
  for fi in range(len(me.polygons)):
    ls=LS[fi]; idx=[ls+j for j in range(LTo[fi])]
    for j in range(1,len(idx)-1):
      tri=uv[[idx[0],idx[j],idx[j+1]]]*[W,H]; x0,y0=np.floor(tri.min(0)).astype(int); x1,y1=np.ceil(tri.max(0)).astype(int)
      x0=max(x0-1,0); y0=max(y0-1,0); x1=min(x1+1,W-1); y1=min(y1+1,H-1)
      if x1<x0 or y1<y0: continue
      xs,ys=np.meshgrid(np.arange(x0,x1+1)+0.5,np.arange(y0,y1+1)+0.5); a,b,c=tri
      d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
      if abs(d)<1e-9: continue
      l1=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/d; l2=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/d; l3=1-l1-l2
      e=-0.6/max(abs(d),1)**0.5; ins=(l1>=e)&(l2>=e)&(l3>=e)
      sub=K[y0:y1+1,x0:x1+1]; sub[ins]=FCL[fi]
  import sys as _s; _s.path.insert(0,'/workspace/raul_items_redo_work/py311')
  from scipy import ndimage
  miss=K==-9; _,(iy,ix)=ndimage.distance_transform_edt(miss,return_indices=True); K=K[iy,ix]   # texels no triangle covered (thin UV slivers, gutters): nearest class
  rgb=A[...,:3]; lum=rgb@np.array([0.3,0.59,0.11],np.float32)
  out=rgb.copy(); MED={}
  for k,(lo_,hi_) in {0:(0.86,1.07),1:(0.50,1.30),-1:(0.84,1.03)}.items():
    m=K==k
    if not m.any(): continue
    med=np.median(rgb[m],0); MED[k]=med.copy(); ml=float(med@np.array([0.3,0.59,0.11]))
    r=np.clip(lum/max(ml,1e-3),lo_,hi_)
    if ndimage is not None: r=ndimage.median_filter(r,3)
    if k==0 and ndimage is not None: r=ndimage.gaussian_filter(r,2.0*W/2048)   # [V5 vs V6] smooth glossy skin: the AI's baked smears out, soft form shading kept
    if k==-1: med=np.array([0.95,0.95,0.94],np.float32)
    if k==0: med=np.array([0.98,0.95,0.93],np.float32)   # [V5 vs V6] neutral skin map: the skin tint (COLOR_0 x map) gives the colour, as on V5
    if k==1: med=np.array([0.90,0.87,0.83],np.float32)   # neutral hair map: the hair tint gives the colour, strand shading kept
    keep=None
    if k==0:   # the tattoo: teal on skin stays
      keep=(rgb[...,2]>rgb[...,0]+0.08)&(rgb[...,1]>rgb[...,0]+0.05)
    new=med[None,None,:]*r[...,None]
    if keep is not None: new=np.where(keep[...,None],rgb,new)
    out[m]=new[m]
  A[...,:3]=np.clip(out,0,1); img.pixels.foreach_set(A.ravel()); img.update()
  log(f'paint: albedo rebuilt {W}x{H}',flush=True); return MED

def decal_alpha(img, skin_rgb, log=print):
  """the eyes / brows / lips decal: texels that are just skin (they would not follow the skin retint) go transparent"""
  W,H=img.size; A=np.array(img.pixels[:],dtype=np.float32).reshape(H,W,4); rgb=A[...,:3]
  d=np.linalg.norm(rgb-np.array(skin_rgb,np.float32)[None,None,:],axis=2); lum=rgb@np.array([0.3,0.59,0.11],np.float32)
  r,g,b=rgb[...,0],rgb[...,1],rgb[...,2]
  sk=((d<0.22)&(lum>0.3))|((r>g)&(g>b)&(r-b>0.12)&(lum>0.36)&(r-g<0.5*(r-b)+0.12)&~((r>0.6)&(g<0.35)))   # skin-hued (any shade) -> clear
  A[...,3]=np.where(sk,0.0,A[...,3]); img.pixels.foreach_set(A.ravel()); img.update(); log(f'decal: skin texels cleared {int((sk&(A[...,3]==0)).sum())}',flush=True)

def raster(me, W, H):
  """per texel: face index (-1 none) + 3D position (barycentric) for the mesh's first UV map"""
  nl=len(me.loops); uv=np.zeros(nl*2); me.uv_layers[0].data.foreach_get('uv',uv); uv=uv.reshape(-1,2)
  LV=np.zeros(nl,int); me.loops.foreach_get('vertex_index',LV); PV=np.array([v.co[:] for v in me.vertices])
  FI=np.full((H,W),-1,np.int32); P3=np.zeros((H,W,3),np.float32)
  for p in me.polygons:
    idx=list(range(p.loop_start,p.loop_start+p.loop_total))
    for j in range(1,len(idx)-1):
      L=[idx[0],idx[j],idx[j+1]]; tri=uv[L]*[W,H]; x0,y0=np.floor(tri.min(0)).astype(int); x1,y1=np.ceil(tri.max(0)).astype(int)
      x0=max(x0-1,0); y0=max(y0-1,0); x1=min(x1+1,W-1); y1=min(y1+1,H-1)
      if x1<x0 or y1<y0: continue
      xs,ys=np.meshgrid(np.arange(x0,x1+1)+0.5,np.arange(y0,y1+1)+0.5); a,b,c=tri
      d=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
      if abs(d)<1e-12: continue
      l1=((b[1]-c[1])*(xs-c[0])+(c[0]-b[0])*(ys-c[1]))/d; l2=((c[1]-a[1])*(xs-c[0])+(a[0]-c[0])*(ys-c[1]))/d; l3=1-l1-l2
      ins=(l1>=-0.02)&(l2>=-0.02)&(l3>=-0.02)
      Q=l1[...,None]*PV[LV[L[0]]]+l2[...,None]*PV[LV[L[1]]]+l3[...,None]*PV[LV[L[2]]]
      FI[y0:y1+1,x0:x1+1][ins]=p.index; P3[y0:y1+1,x0:x1+1][ins]=Q[ins]
  return FI,P3

def decal_face(dme, img, female, log=print):
  """the eyes / brows decal kept; everything below the eyes cleared (the AI mouth smudge) and a clean smile line drawn in its place"""
  W,H=img.size; A=np.array(img.pixels[:],dtype=np.float32).reshape(H,W,4); FI,P3=raster(dme,W,H); m=FI>=0
  rgb=A[...,:3]; blue=m&(A[...,3]>0.5)&(rgb[...,2]>rgb[...,0]+0.15)&(rgb[...,2]>0.35)
  if blue.sum()<50: log('decal_face: no iris found',flush=True); return None,0
  Q=P3[blue]; L=Q[Q[:,0]>np.median(Q[:,0])].mean(0); R=Q[Q[:,0]<=np.median(Q[:,0])].mean(0); sep=abs(L[0]-R[0]); ez=(L[2]+R[2])/2; cx=(L[0]+R[0])/2
  below=m&(P3[...,2]<ez-0.30*sep); A[...,3]=np.where(below,0.0,A[...,3])
  zone=np.zeros_like(m)   # [V5 vs V6] only the eyes + brows stay on the decal: the AI's baked dark skin shading round them (muddy face) goes
  for E in (L,R): zone|=((P3[...,0]-E[0])/(0.60*sep))**2+((P3[...,2]-(E[2]+0.14*sep))/(0.56*sep))**2<1
  if W>=2048: A[...,3]=np.where(m&~zone,0.0,A[...,3])   # (hi only: the lo decal's coarse faces miss part of the iris, its eye centres drift)
  mz=ez-(0.60 if female else 0.64)*sep; hw=0.30*sep
  x=P3[...,0]-cx; zc=mz+0.10*sep*(x/hw)**2-0.035*sep; th=0.022*sep
  line=m&(np.abs(x)<hw)&(np.abs(P3[...,2]-zc)<th*(1-0.5*(np.abs(x)/hw)**2))
  ink=np.array([0.30,0.12,0.09] if female else [0.25,0.11,0.08],np.float32)
  A[...,:3]=np.where(line[...,None],ink,A[...,:3]); A[...,3]=np.where(line,1.0,A[...,3])
  img.pixels.foreach_set(A.ravel()); img.update(); log(f'decal_face: eyes z {ez:.3f} sep {sep:.3f}, mouth z {mz:.3f}, smile texels {int(line.sum())}',flush=True)
  return np.array([cx,(L[1]+R[1])/2,mz]),sep

def body_smile(me, img, MC, sep, female, log=print):
  """the smile line painted into the body albedo (x the skin tint: right for every skin colour), on the face front only"""
  W,H=img.size; A=np.array(img.pixels[:],dtype=np.float32).reshape(H,W,4); FI,P3=raster(me,W,H); m=FI>=0
  hw=0.30*sep; x=P3[...,0]-MC[0]; zc=MC[2]+0.10*sep*(x/hw)**2-0.035*sep; th=0.020*sep*(1-0.55*np.clip(np.abs(x)/hw,0,1)**2)
  line=m&(np.abs(x)<hw)&(np.abs(P3[...,2]-zc)<th)&(P3[...,1]<MC[1]+0.035)
  A[...,:3]=np.where(line[...,None],A[...,:3]*np.array([0.42,0.30,0.28],np.float32),A[...,:3])
  img.pixels.foreach_set(A.ravel()); img.update(); log(f'body smile texels {int(line.sum())}',flush=True)
