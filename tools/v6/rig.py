# PUMPFUN PIRATES V6 game body: the generated V6 character on the v5 skeleton (same armature, bone names, pivots, origin, scale, clips,
# 'v5warp' extras), hi ~20k / lo ~4k tris, auto (heat) weights, eyes / brows / lips decal re-cut on the LOD and weighted from it.
# blender -b -P rig.py -- SEX LOD OUT.glb
import bpy,bmesh,sys,os,numpy as np
SEX,LOD,OUT=sys.argv[sys.argv.index('--')+1:][:3]; FEM=SEX=='female'
G='/workspace/brand/v6_characters/work/gen/out/'; V5=f'/workspace/raul-pet-textures/assets/pirates/pirate_{SEX}_v5_{LOD}.glb'
BUD={'hi':int(os.environ.get('NHI','19000')),'lo':int(os.environ.get('NLO','3600'))}[LOD]
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
def imp(f): b=set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f); return [o for o in bpy.data.objects if o not in b]
def act(o): bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active=o
ntri=lambda o: sum(len(p.vertices)-2 for p in o.data.polygons)
g5=imp(V5); arm=[o for o in g5 if o.type=='ARMATURE'][0]; arm.data.pose_position='REST'
b5=[o for o in g5 if o.type=='MESH' and o.name.startswith('pirate_')][0]; props={k:b5[k] for k in b5.keys()}; bname=b5.name; mname=b5.data.materials[0].name
for o in g5:
  if o.type=='MESH' and o.parent==arm and o!=b5: bpy.data.objects.remove(o)   # v5 eyes, tattoo out (the v5 body stays as the weight source)
g6=imp(G+f'v6_{SEX}_generated.glb'); body=[o for o in g6 if o.name.startswith(f'v6_{SEX}')][0]; dec=[o for o in g6 if 'face_eyes' in o.name][0]; bpy.data.objects.remove(dec)
act(body); bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
if os.environ.get('WELD','1')=='1':   # [V6 quality 2] the GLB is split at every UV seam: weld it first so the decimation keeps ONE surface (no cracks / faceted island edges)
  bm=bmesh.new(); bm.from_mesh(body.data); n0=len(bm.verts); bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=float(os.environ.get('WELDD','2e-5'))); print('welded verts',n0,'->',len(bm.verts),flush=True); bm.to_mesh(body.data); bm.free()
d=body.modifiers.new('d','DECIMATE'); d.ratio=BUD/ntri(body); d.use_collapse_triangulate=True; bpy.ops.object.modifier_apply(modifier='d')
bm=bmesh.new(); bm.from_mesh(body.data)   # drop decimation / posing slivers (long thin faces bridging hand <-> hip etc.)
bad=[]
for f_ in bm.faces:
  L_=max(e.calc_length() for e in f_.edges); ar=f_.calc_area()
  if L_>0.15 or (L_>0.05 and ar/(L_*L_)<0.02): bad.append(f_)
bmesh.ops.delete(bm,geom=bad,context='FACES'); bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS'); bm.to_mesh(body.data); bm.free()
print('slivers removed',len(bad),flush=True)
bm=bmesh.new(); bm.from_mesh(body.data); old=set(bm.faces)   # [V6 paint pass] the small holes the sliver cut (and the AI sculpt) left: filled, UVs from the vertex's neighbours
r=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=12); uvl=bm.loops.layers.uv.active
for f in r['faces']:
  for l in f.loops:
    src=[l2 for l2 in l.vert.link_loops if l2.face in old]
    if src: l[uvl].uv=src[0][uvl].uv
bm.to_mesh(body.data); bm.free(); print('holes filled',len(r['faces']),flush=True)
for p in body.data.polygons: p.use_smooth=True
if os.environ.get('CONFORM','1')=='1':   # [V6 v5-shape] the V6 body takes the v5 body's shape (v5 clothes fit unchanged)
  sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import morph; hb=arm.data.bones['head']; NZ=float((arm.matrix_world@hb.head_local).z); HC=np.array([v.co[:] for v in b5.data.vertices if (b5.matrix_world@v.co).z>NZ+0.02]).mean(0)
  morph.head_radial(body,b5,HC,NZ-0.03,NZ+0.03)   # head + hair: proportional squeeze into the v5 head / hair
  hm=lambda P: 1-np.clip((P[:,2]-(NZ-0.04))/0.04,0,1)
  morph.conform(body,b5,wfn=lambda P: np.clip((P[:,2]-float(os.environ.get('LEGZ','0.40')))/0.12,0,1)*hm(P),pmask_fn=lambda P: hm(P)>0.5)   # legs: push-in only (the v5 body's legs are its painted pants + boots)
  gc=imp(f'/workspace/raul-v6/assets/pirates/items/v5/cloth_base_{SEX}_{LOD}.glb')   # [V6 v5-shape] the legacy base outfit (+ the store pants / boots built from it): body under it
  for o in gc:
    if o.type=='ARMATURE': o.data.pose_position='REST'
  cm=[o for o in gc if o.type=='MESH']; bpy.context.view_layer.update(); morph.push_under(body,cm,margin=0.0025,zmax=0.62)
  for o in gc: bpy.data.objects.remove(o)
print('body tris',ntri(body),flush=True)
me=body.data
# texture size per LOD (lo = 1024)
tex=[n for n in me.materials[0].node_tree.nodes if n.type=='TEX_IMAGE'][0]; img=tex.image
if LOD=='lo': img.scale(1024,1024)
me.materials[0].name=mname   # 'pirate_hi' / 'pirate_lo' (js/pirateGLB.js kindOf)
# decal re-cut from the label map on this LOD's faces
li=bpy.data.images.load(G+f'{SEX}_label.png'); li.colorspace_settings.name='Non-Color'; W_,H_=li.size; LAB=np.round(np.array(li.pixels[:]).reshape(H_,W_,4)[...,0]*255).astype(int)
nl=len(me.loops); uv=np.zeros(nl*2); me.uv_layers[0].data.foreach_get('uv',uv); uv=uv.reshape(-1,2)
ll=LAB[np.clip((uv[:,1]*H_).astype(int),0,H_-1),np.clip((uv[:,0]*W_).astype(int),0,W_-1)]
ls=np.zeros(len(me.polygons),int); me.polygons.foreach_get('loop_start',ls); lt=np.zeros(len(me.polygons),int); me.polygons.foreach_get('loop_total',lt)
pf=np.zeros(len(me.polygons),bool)
for k in range(3): pf|=ll[ls+np.minimum(k,lt-1)]==3
dec=body.copy(); dec.data=me.copy(); sc.collection.objects.link(dec); dec.name='v5_face_eyes'; dec.data.name='v5_face_eyes'
bm=bmesh.new(); bm.from_mesh(dec.data); bm.faces.ensure_lookup_table(); bmesh.ops.delete(bm,geom=[f for f in bm.faces if not pf[f.index]],context='FACES')
bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS'); bm.normal_update()
for v in bm.verts: v.co+=v.normal*(0.0008 if LOD=='hi' else 0.0016)
bm.to_mesh(dec.data); bm.free()
for a in [a.name for a in dec.data.attributes if a.name=='_TINT']: dec.data.attributes.remove(dec.data.attributes[a])
for c_ in [c.name for c in dec.data.color_attributes]: dec.data.color_attributes.remove(dec.data.color_attributes[c_])
dm=[m for m in bpy.data.materials if m.name.startswith(f'v6_{SEX}_face')][0]; dm.name='v6face'; dec.data.materials.clear(); dec.data.materials.append(dm)
if LOD=='lo': [n for n in dm.node_tree.nodes if n.type=='TEX_IMAGE'][0].image.scale(1024,1024)
print('decal faces',int(pf.sum()),flush=True)
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__))); import paint, mathutils
MOUTHV=None
MC,SEP=paint.decal_face(dec.data,[n for n in dm.node_tree.nodes if n.type=='TEX_IMAGE'][0].image,FEM)
if MC is not None:   # decal faces below the eyes go (the AI mouth smudge lives on them)
  bm=bmesh.new(); bm.from_mesh(dec.data); ez_=MC[2]+(0.60 if FEM else 0.64)*SEP
  bad=[f for f in bm.faces if f.calc_center_median().z<ez_-0.30*SEP]; bmesh.ops.delete(bm,geom=bad,context='FACES')
  bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS'); bm.to_mesh(dec.data); bm.free(); print('decal faces below the eyes removed',len(bad),flush=True)
if MC is not None and os.environ.get('MOUTH','1')=='1':   # the AI sculpt's lip lump: smooth the mouth area (body + decal follow)
  for ob_ in (body,dec):
    m_=ob_.data; PV=np.array([v.co[:] for v in m_.vertices]); E=np.array([e.vertices[:] for e in m_.edges])
    C2=MC+np.array([0,0,0.20*SEP]); w=np.clip(1-np.linalg.norm((PV-C2)*[1,1.2,0.9],axis=1)/(0.30*SEP),0,1)**0.6; w[PV[:,1]>MC[1]+0.05]=0   # nose + lip lump
    for _ in range(80):
      S=np.zeros_like(PV); c=np.zeros(len(PV)); np.add.at(S,E[:,0],PV[E[:,1]]); np.add.at(S,E[:,1],PV[E[:,0]]); np.add.at(c,E[:,0],1); np.add.at(c,E[:,1],1)
      PV=PV+(S/np.maximum(c,1)[:,None]-PV)*((0.5 if _%2==0 else -0.53)*w)[:,None]   # Taubin: no shrink
    P0=np.array([v.co[:] for v in m_.vertices]); PN=P0.copy(); fr=P0[:,1]<PV[:,1]   # only the bumps standing proud of the smooth face go back, straight back (no folds)
    PN[fr,1]=P0[fr,1]+(PV[fr,1]-P0[fr,1])*np.clip(w[fr]*1.6,0,1)
    for v,p_ in zip(m_.vertices,PN): v.co=p_
    m_.update()
    if ob_ is body: MOUTHV=w>0.05
  print('mouth smoothed at',np.round(MC,3),flush=True)
  bm=bmesh.new(); bm.from_mesh(me); nfl=0   # folds the smoothing left in the mouth area: faces turned to the back get turned to the front
  for f in bm.faces:
    if all(MOUTHV[v.index] for v in f.verts) and f.normal.y>0.2: f.normal_flip(); nfl+=1
  bm.to_mesh(me); bm.free(); me.update(); print('mouth faces flipped to the front',nfl,flush=True)
# rig: weights from the v5 body (same skeleton + proportions; heat weighting fails on the AI sculpt), then hair = head (braid kept), smoothed
for vg in b5.vertex_groups: body.vertex_groups.new(name=vg.name)
dt=body.modifiers.new('dt','DATA_TRANSFER'); dt.object=b5; dt.use_vert_data=True; dt.data_types_verts={'VGROUP_WEIGHTS'}; dt.vert_mapping='POLYINTERP_NEAREST'; dt.layers_vgroup_select_src='ALL'; dt.layers_vgroup_select_dst='NAME'
act(body); bpy.ops.object.modifier_apply(modifier='dt')
T=np.zeros(len(me.vertices)); me.attributes['_TINT'].data.foreach_get('value',T); T=np.round(T)
vh=body.vertex_groups['head']; vb=body.vertex_groups.get('braid')
WB={}
if vb and FEM:
  for v in me.vertices:
    for g in v.groups:
      if g.group==vb.index and g.weight>0.3: WB[v.index]=min(1.0,g.weight*1.2)
act(body); bpy.ops.object.mode_set(mode='WEIGHT_PAINT'); bpy.ops.object.vertex_group_smooth(group_select_mode='ALL',factor=0.5,repeat=int(os.environ.get('WSM','3')))
bpy.ops.object.mode_set(mode='OBJECT')
nfix=0   # hair: head only (her braid: braid + head); no arm / spine pulls on any strand
for v in me.vertices:
  if T[v.index]!=1: continue
  for g in list(v.groups): body.vertex_groups[g.group].remove([v.index])
  wb=WB.get(v.index,0.0)
  vh.add([v.index],1.0-wb,'REPLACE')
  if wb>0: vb.add([v.index],wb,'REPLACE')
  nfix+=1
print('hair verts -> head/braid',nfix,'braid',len(WB),flush=True)
act(body); bpy.ops.object.mode_set(mode='WEIGHT_PAINT')
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',limit=4); bpy.ops.object.vertex_group_normalize_all(lock_active=False); bpy.ops.object.mode_set(mode='OBJECT')
nog=sum(1 for v in body.data.vertices if not v.groups); print('unweighted verts',nog,flush=True)
body.parent=arm; am_=body.modifiers.new('Armature','ARMATURE'); am_.object=arm
bpy.data.objects.remove(b5)
for vg in body.vertex_groups: dec.vertex_groups.new(name=vg.name)
dt=dec.modifiers.new('dt','DATA_TRANSFER'); dt.object=body; dt.use_vert_data=True; dt.data_types_verts={'VGROUP_WEIGHTS'}; dt.vert_mapping='NEAREST'; dt.layers_vgroup_select_src='ALL'; dt.layers_vgroup_select_dst='NAME'
act(dec); bpy.ops.object.modifier_apply(modifier='dt'); dec.parent=arm; am=dec.modifiers.new('Armature','ARMATURE'); am.object=arm
bpy.ops.outliner.orphans_purge(do_recursive=True) if False else None
for m_ in [m_ for m_ in bpy.data.meshes if m_.users==0]: bpy.data.meshes.remove(m_)
body.name=bname; body.data.name=bname; dec.name='v5_face_eyes'; dec.data.name='v5_face_eyes'
for k,v in props.items(): body[k]=v
body['v6']=1
for o in list(bpy.data.objects):
  if o.type=='MESH' and o not in (body,dec) and not o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
me.color_attributes.active_color=me.color_attributes['Color']
if os.environ.get('PAINT','1')=='1':
  import paint; MED=paint.clean(me,img,force_skin=MOUTHV,head_z=(NZ-0.04) if 'NZ' in globals() else None,face=(MC,SEP,FEM))
  if MC is not None: paint.body_smile(me,img,MC,SEP,FEM)
  paint.decal_alpha([n for n in dm.node_tree.nodes if n.type=='TEX_IMAGE'][0].image, MED[0])
arm.data.pose_position='POSE'   # (REST here bakes every clip flat)
print('names',body.name,dec.name,flush=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',export_attributes=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,
  export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_image_format='WEBP',export_image_quality=90 if LOD=='hi' else 80,export_draco_mesh_compression_enable=True,export_def_bones=False,export_yup=True,export_extras=True)
print('exported',OUT,'tris',ntri(body)+ntri(dec),flush=True)
