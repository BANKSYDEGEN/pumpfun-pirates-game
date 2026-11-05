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
  if face is not None and face[0] is not None and __import__('os').environ.get('HEADSK','1')=='1':   # [V6 quality 2] skin shards in the hair (AI strands painted skin): every head skin patch not joined to the face / neck skin -> hair
    MCh,SEPh,FEMh=face; zc=MCh[2]-0.55*SEPh; Z=np.array([f.calc_center_median().z for f in bm.faces]); hs=(FC==0)&(Z>zc)
    lab=-np.ones(nf,int); comps=[]
    for i0 in np.nonzero(hs)[0]:
      if lab[i0]>=0: continue
      st=[i0]; lab[i0]=len(comps); cc=[i0]
      while st:
        i=st.pop()
        for j in nb[i]:
          if hs[j] and lab[j]<0: lab[j]=lab[i0]; st.append(j); cc.append(j)
      comps.append(cc)
    if FEMh:   # her side strands painted skin: head skin facing BACK beside the face (strand folds over the cheeks) -> hair
      ezh=MCh[2]+0.60*SEPh; ns=0
      for f in bm.faces:
        i=f.index
        if FC[i]!=0: continue
        c=f.calc_center_median(); n=f.normal
        if MCh[2]-0.2*SEPh<c.z<ezh+0.9*SEPh and abs(c.x-MCh[0])>float(__import__('os').environ.get('SIDEX','0.6'))*SEPh and c.y<MCh[1]+0.06 and n.y>0.1: FC[i]=1; ns+=1
      log(f'paint: her side-strand skin faces -> hair {ns}',flush=True)
    if comps and FEMh:   # (his face skin is cut off from the neck by the beard: not for him)
      big=max(range(len(comps)),key=lambda k:len(comps[k])); nh=0
      for k,cc in enumerate(comps):
        if k==big: continue
        low=any(Z[i]<zc+0.01 for i in cc)   # touching the cut = neck / shoulder skin, kept
        if not low: FC[cc]=1; nh+=len(cc)
      log(f'paint: head skin shards -> hair {nh} faces ({len(comps)-1} patches)',flush=True)
  if face is not None and face[0] is not None:   # [V5 vs V6] the face front is clean skin (the AI's dark cheek / nose / mouth shading faces out); his beard below the mouth stays
    MCf,SEPf,FEMf=face; ez=MCf[2]+(0.60 if FEMf else 0.64)*SEPf; z0=MCf[2]-(0.40*SEPf if FEMf else -0.40*SEPf); nfz=0
    for f in bm.faces:
      c=f.calc_center_median(); n=f.normal
      if z0<c.z<ez+0.12*SEPf and abs(c.x-MCf[0])<(1.05 if FEMf else 0.50)*SEPf and n.y<-0.25 and c.y<MCf[1]+0.05 and FC[f.index]!=0: FC[f.index]=0; nfz+=1
    log(f'paint: face-front faces -> skin {nfz}',flush=True)
  if force_skin is not None:   # the smoothed mouth: skin only (no dark cavity / lip faces showing)
    for f in bm.faces:
      if any(force_skin[v.index] for v in f.verts if v.index<len(force_skin)): FC[f.index]=0
  if __import__('os').environ.get('SMOOTH','1')=='1': FC=disc_major(bm,FC,face,log); smooth_pass(bm,FC,face,log)
  cl=bm.faces.layers.int.new('cls')
  for f in bm.faces: f[cl]=int(FC[f.index])
  edges=[e for e in bm.edges if len(e.link_faces)==2 and e.link_faces[0][cl]!=e.link_faces[1][cl]]
  bmesh.ops.split_edges(bm,edges=edges)
  bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
  VC={}
  for f in bm.faces:
    for v in f.verts: VC.setdefault(v.index,f[cl])
  FCL=np.array([f[cl] for f in bm.faces]); bm.faces.layers.int.remove(cl); bm.to_mesh(me); bm.free(); me.update()
  if __import__('os').environ.get('WELDN','1')=='1': weld_normals(me,log)
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
  for k,(lo_,hi_) in {0:(0.93,1.04),1:(0.50,1.30),-1:(0.84,1.03)}.items():   # [V6 quality 2] skin 0.86-1.07 -> 0.93-1.04: V5's clean flat skin
    m=K==k
    if not m.any(): continue
    med=np.median(rgb[m],0); MED[k]=med.copy(); ml=float(med@np.array([0.3,0.59,0.11]))
    r=np.clip(lum/max(ml,1e-3),lo_,hi_)
    if ndimage is not None: r=ndimage.median_filter(r,3)
    if k==0 and ndimage is not None: r=ndimage.gaussian_filter(r,4.0*W/2048)   # [V5 vs V6] smooth glossy skin: the AI's baked smears out, soft form shading kept
    if k==-1: med=np.array([0.95,0.95,0.94],np.float32)
    if k==0: med=np.array([0.985,0.98,0.975],np.float32)   # [V6 quality 2] (was 0.98/0.95/0.93: a warm cast under the tint) near-white like the v5 skin map   # [V5 vs V6] neutral skin map: the skin tint (COLOR_0 x map) gives the colour, as on V5
    if k==1: med=np.array([0.90,0.87,0.83],np.float32)   # neutral hair map: the hair tint gives the colour, strand shading kept
    keep=None
    if k==0:   # the tattoo: teal on skin stays
      keep=(rgb[...,2]>rgb[...,0]+0.08)&(rgb[...,1]>rgb[...,0]+0.05)
    new=med[None,None,:]*r[...,None]
    if keep is not None: new=np.where(keep[...,None],rgb,new)
    out[m]=new[m]
  A[...,:3]=np.clip(out,0,1); img.pixels.foreach_set(A.ravel()); img.update()
  log(f'paint: albedo rebuilt {W}x{H}',flush=True); return MED

def disc_major(bm, FC, face=None, log=print):
  """[V6 quality 2] skin | underwear borders (and skin | beard below the eyes) by an area-weighted disc vote (radius ~2.5 cm) round
  each border face: the AI paint's saw-tooth hems / waistband become smooth lines (then smooth_pass relaxes the vertices onto them)"""
  import os
  from mathutils import kdtree
  bm.faces.ensure_lookup_table(); nf=len(bm.faces); C=np.array([f.calc_center_median()[:] for f in bm.faces]); A=np.array([f.calc_area() for f in bm.faces])
  N=np.array([f.normal[:] for f in bm.faces]); kd=kdtree.KDTree(nf)
  for i,c in enumerate(C): kd.insert(c,i)
  kd.balance(); FC=FC.copy(); ez=None
  if face is not None and face[0] is not None: MC,SEP,FEM=face; ez=MC[2]+(0.60 if FEM else 0.64)*SEP
  R={(-1,0):float(os.environ.get('RMAJ','0.04')),(0,1):float(os.environ.get('RMAJH','0.014'))}
  for it in range(int(os.environ.get('NMAJ','5'))):
    ch=0; NF=FC.copy()
    for i,f in enumerate(bm.faces):
      ks=set(FC[g.index] for e in f.edges for g in e.link_faces)|{FC[i]}
      for pair,r in R.items():
        if FC[i] not in pair or not set(pair)<=ks: continue
        if pair==(0,1) and (ez is None or C[i,2]>ez-0.25*SEP): continue
        sc={pair[0]:0.0,pair[1]:0.0}
        for co,j,d in kd.find_range(C[i],r):
          if FC[j] in sc and N[j]@N[i]>0.2: sc[FC[j]]+=A[j]*(1-d/r)
        k=max(sc,key=sc.get)
        if k!=FC[i] and sc[k]>1.15*sc[FC[i]]: NF[i]=k; ch+=1
    FC=NF
    if not ch: break
  log(f'disc vote: border faces reclassed (last pass {ch}, passes {it+1})',flush=True); return FC

def smooth_pass(bm, FC, face=None, log=print):
  """[V6 quality 2] (a) class borders (skin | underwear | hair) relaxed into smooth curves on the surface (no stair-step paint edges),
  (b) the skin surface Taubin-smoothed (the AI sculpt's lumps on chest / shoulders / face go; hands + feet + hair + cloth untouched),
  her face front smoothed harder (nose / mouth lump shading). Works on position-welded vertices (the GLB is split at UV seams)."""
  import os, mathutils
  from mathutils.bvhtree import BVHTree
  bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table(); bm.edges.ensure_lookup_table()
  ref=BVHTree.FromBMesh(bm); P=np.array([v.co[:] for v in bm.verts])
  _,Wi,inv=np.unique(np.round(P/2e-5).astype(np.int64),axis=0,return_index=True,return_inverse=True); inv=inv.ravel(); nw=len(Wi)
  Q=P[Wi].copy(); Q0=Q.copy()
  CL=[set() for _ in range(nw)]
  for f in bm.faces:
    for v in f.verts: CL[inv[v.index]].add(FC[f.index])
  EF={}
  for e in bm.edges:
    a,b=sorted((inv[e.verts[0].index],inv[e.verts[1].index]))
    if a==b: continue
    EF.setdefault((a,b),[]).extend(FC[f.index] for f in e.link_faces)
  E=np.array(list(EF.keys()),int); bnd=np.zeros(nw,bool); BN={}
  for (a,b),fs in EF.items():
    if len(fs)<2: bnd[a]=bnd[b]=True
    elif len(set(fs))>1: BN.setdefault(a,[]).append(b); BN.setdefault(b,[]).append(a)
  ax=np.abs(Q[:,0]); hand=ax>0.72*ax.max(); foot=Q[:,2]<0.085
  chain=np.array([i for i,L in BN.items() if len(L)==2 and len(CL[i])==2 and not bnd[i] and not hand[i] and not foot[i]],int)
  if len(chain):
    n1=np.array([BN[i][0] for i in chain]); n2=np.array([BN[i][1] for i in chain])
    for _ in range(int(os.environ.get('BRELAX','40'))):
      Q[chain]=0.5*Q[chain]+0.25*(Q[n1]+Q[n2])
      for i in chain: Q[i]=ref.find_nearest(mathutils.Vector(Q[i]))[0][:]
    lim=np.array([float(os.environ.get('BLIMC','0.03')) if CL[i]=={0,-1} else 0.012 for i in chain])   # skin | underwear borders may slide further (big triangles there)
    d=Q[chain]-Q0[chain]; L=np.linalg.norm(d,axis=1); Q[chain]=Q0[chain]+d*np.minimum(1,lim/np.maximum(L,1e-9))[:,None]
  mv=np.linalg.norm(Q-Q0,axis=1)
  log(f'smooth: border verts relaxed {len(chain)} of {len(BN)}, mean move {mv[chain].mean()*1000 if len(chain) else 0:.2f} mm',flush=True)
  skin=np.array([c=={0} for c in CL])&~hand&~foot&~bnd
  w=np.where(skin,float(os.environ.get('SKSM','0.5')),0.0)
  if face is not None and face[0] is not None:
    MC,SEP,FEM=face; ez=MC[2]+(0.60 if FEM else 0.64)*SEP
    d=np.linalg.norm((Q-np.array([MC[0],MC[1],MC[2]+0.25*SEP]))*[1.0,1.4,0.9],axis=1)/((1.15 if FEM else 0.75)*SEP)
    fz=np.clip(1.3-d,0,1)*(Q[:,1]<MC[1]+0.06)
    w=np.where(skin,np.maximum(w,fz*(0.95 if FEM else 0.7)),w)
    hair=np.array([c=={1} for c in CL]); bt=hair&(Q[:,2]<MC[2]-0.25*SEP)&(np.abs(Q[:,0]-MC[0])<1.3*SEP)&(Q[:,1]<MC[1]+0.10)
    w[bt]=float(os.environ.get('BEARDSM','0.8'))   # the beard's bottom strand shards rounded off (its clumps above stay)
    eye=(Q[:,2]>ez-0.22*SEP)&(Q[:,2]<ez+0.6*SEP)&(np.abs(Q[:,0]-MC[0])<1.2*SEP)&(Q[:,1]<MC[1]+0.06); w[eye]=0   # the eyes decal sits on this skin
  cnt=np.zeros(nw); np.add.at(cnt,E[:,0],1); np.add.at(cnt,E[:,1],1)
  cb=np.array([CL[i]=={0,-1} for i in range(nw)])   # [V6 quality 2] the AI's frayed hem flaps (skin-painted strips hanging under her top / round the shorts + boxer hems): ironed flat into the body
  if cb.any() and os.environ.get('HEMS','1')=='1':
    from mathutils import kdtree
    kd=kdtree.KDTree(int(cb.sum()))
    for j,i in enumerate(np.nonzero(cb)[0]): kd.insert(Q[i],j)
    kd.balance(); R=float(os.environ.get('HEMR','0.06'))
    sk0=np.array([c=={0} for c in CL])&~hand&~foot   # (open flap edges included)
    dh=np.array([kd.find(Q[i])[2] if sk0[i] else 9 for i in range(nw)]); hz=sk0&(dh<R)
    if face is not None and face[0] is not None: hz&=Q[:,2]<face[0][2]-0.5*face[1]
    w2=np.where(hz,np.clip(1.2-dh/R,0,1),0.0)
    for it in range(int(os.environ.get('HEMIT','80'))):
      S=np.zeros_like(Q); np.add.at(S,E[:,0],Q[E[:,1]]); np.add.at(S,E[:,1],Q[E[:,0]])
      Q=Q+(S/np.maximum(cnt,1)[:,None]-Q)*(0.5*w2)[:,None]   # plain Laplacian: the flaps fold down into the body
    log(f'smooth: hem-zone skin verts ironed {int(hz.sum())}',flush=True)
  for it in range(int(os.environ.get('SKIT','24'))):
    S=np.zeros_like(Q); np.add.at(S,E[:,0],Q[E[:,1]]); np.add.at(S,E[:,1],Q[E[:,0]])
    Q=Q+(S/np.maximum(cnt,1)[:,None]-Q)*((0.5 if it%2==0 else -0.53)*w)[:,None]
  for v in bm.verts: v.co=Q[inv[v.index]]
  bm.normal_update(); mv=np.linalg.norm(Q-Q0,axis=1)
  log(f'smooth: welded verts {nw} (of {len(P)}), skin smoothed {int(skin.sum())}, mean move {mv[skin].mean()*1000:.2f} mm, max {mv.max()*1000:.1f} mm',flush=True)

def weld_normals(me, log=print):
  """[V6 quality 2] the class split leaves duplicate verts on every border: their normals averaged (custom normals), so no lit crease"""
  nv=len(me.vertices); P=np.zeros(nv*3); me.vertices.foreach_get('co',P); P=P.reshape(-1,3)
  N=np.array([n.vector[:] for n in me.vertex_normals])
  key=np.round(P/1e-5).astype(np.int64); _,inv=np.unique(key,axis=0,return_inverse=True); inv=inv.ravel()
  S=np.zeros((inv.max()+1,3)); np.add.at(S,inv,N); S=S[inv]; S/=np.maximum(np.linalg.norm(S,axis=1),1e-9)[:,None]
  me.normals_split_custom_set_from_vertices([tuple(x) for x in S]); log(f'normals welded across {nv-(inv.max()+1)} split verts',flush=True)

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
