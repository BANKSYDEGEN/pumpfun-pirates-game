"""[Emerly V7 female] BANKSY t1900u "let meshi do all the work just rig it". Blender 4.2, run from repo root:
  blender -b -P tools/v7/build_female.py -- hi|lo
The Meshy V7 female (mesh, texture, vertex normals, hands, braid) is used UNTOUCHED apart from ONE uniform scale to the game height.
Instead of reshaping her to the V6 body (what drifted before), the 13 game bones are MOVED to her own joints (pure translation per
bone: orientation / roll unchanged, so every game clip keeps its meaning; Blender re-bases the pose-space keys on export), and her
Meshy skin weights are summed onto the game bones by name. Same bone names / clips / extras layout as the V7 male.
"""
import bpy,bmesh,sys,os,numpy as np,json
from mathutils import Vector
ROOT=os.getcwd(); OUT=ROOT+'/assets/pirates'; SOURCE='/workspace/v7-meshy/out/female_v7_rigged.glb'
LOD=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'hi'
H=1.397   # V6 female crown height (game scale); Meshy height = 1.0
def imp(f):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=f);return list(set(bpy.data.objects)-before)
def active(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.wm.read_factory_settings(use_empty=True)
old=imp(OUT+'/pirate_female_v6_hi.glb');arm=next(o for o in old if o.type=='ARMATURE');arm.data.pose_position='REST'
src=next(o for o in old if o.type=='MESH' and o.name.startswith('pirate_'));props=dict(src.items())
keep_actions=set(bpy.data.actions)
new=imp(SOURCE);body=next(o for o in new if o.type=='MESH' and len(o.data.vertices)>1000);marm=next(o for o in new if o.type=='ARMATURE')
J={b.name:np.array((marm.matrix_world@b.head_local)[:])*H/1.0 for b in marm.data.bones}   # Meshy joints, world, game scale
for a in list(bpy.data.actions):
 if a not in keep_actions:bpy.data.actions.remove(a)
marm.data.pose_position='REST';bpy.context.view_layer.update()
mw=body.matrix_world.copy();body.parent=None;body.matrix_world=mw;body.modifiers.clear();active(body)
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
body.data.transform(__import__('mathutils').Matrix.Scale(H,4));body.data.update()
for o in new:
 if o!=body:bpy.data.objects.remove(o,do_unlink=True)
for o in old:
 if o.type=='MESH':bpy.data.objects.remove(o,do_unlink=True)
# ---- move the game bones onto her joints (L/R mirrored average: symmetric rig)
def sym(l,r):
 a,b=J[l],J[r];return np.array([(a[0]-b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2])
hip=J['Hips'].copy();hip[0]=0;neck=J['neck'].copy();neck[0]=0
T={'root':hip,'spine':hip,'head':neck}
for s,L,R in (('L','Left','Right'),):pass
for side,sg in (('L',1),('R',-1)):
 for gb,mb in (('upperarm','Arm'),('forearm','ForeArm'),('thigh','UpLeg'),('shin','Leg')):
  v=sym('Left'+mb,'Right'+mb);v[0]*=sg;T[gb+'.'+side]=v
active(arm);bpy.ops.object.mode_set(mode='EDIT');eb=arm.data.edit_bones
for b in eb:b.use_connect=False
heads={b.name:b.head.copy() for b in eb};tails={b.name:b.tail.copy() for b in eb}
mwi=arm.matrix_world.inverted()
delta={}
for n,t in T.items():delta[n]=(mwi@Vector(t))-heads[n]
delta['tails']=delta['spine'];delta['braid']=delta['head']
for b in eb:
 d=delta[b.name];b.head=heads[b.name]+d;b.tail=tails[b.name]+d
bpy.ops.object.mode_set(mode='OBJECT')
for b in arm.data.bones:print('BONE',b.name,tuple(round(c,3) for c in arm.matrix_world@b.head_local),flush=True)
# ---- Meshy weights -> game bones (summed); nothing reshaped
MAP={'Hips':'root','Spine02':'spine','Spine01':'spine','Spine':'spine','LeftShoulder':'spine','RightShoulder':'spine','neck':'head','Head':'head','head_end':'head','headfront':'head',
 'LeftArm':'upperarm.L','LeftForeArm':'forearm.L','LeftHand':'forearm.L','RightArm':'upperarm.R','RightForeArm':'forearm.R','RightHand':'forearm.R',
 'LeftUpLeg':'thigh.L','LeftLeg':'shin.L','LeftFoot':'shin.L','LeftToeBase':'shin.L','RightUpLeg':'thigh.R','RightLeg':'shin.R','RightFoot':'shin.R','RightToeBase':'shin.R'}
me=body.data;n=len(me.vertices);gnames=[b.name for b in arm.data.bones];W=np.zeros((n,len(gnames)))
idx={g.index:g.name for g in body.vertex_groups}
for v in me.vertices:
 for g in v.groups:
  m=MAP.get(idx[g.group])
  if m:W[v.index,gnames.index(m)]+=g.weight
s=W.sum(1);print('unweighted',(s<1e-6).sum(),flush=True);W[s<1e-6,gnames.index('spine')]=1;W/=W.sum(1,keepdims=True)
# keep top-4
o4=np.argsort(-W,1)[:,4:];np.put_along_axis(W,o4,0,1);W/=W.sum(1,keepdims=True)
body.vertex_groups.clear()
for j,g in enumerate(gnames):
 vg=body.vertex_groups.new(name=g)
 for i in np.where(W[:,j]>1e-4)[0]:vg.add([int(i)],float(W[i,j]),'REPLACE')
# ---- tint IDs (only used when a player PICKS a non-default skin / hair colour; default = Meshy paint untouched)
mat=me.materials[0];mat.name='v7body';nt=mat.node_tree;bs=next(x for x in nt.nodes if x.type=='BSDF_PRINCIPLED')
img=next(l.from_node for l in bs.inputs['Base Color'].links).image
# glTF: drop the packed metal/rough (game material = Lambert); KEEP the Meshy normal map on hi
for name in ['Metallic','Roughness']+(['Normal'] if LOD=='lo' else []):
 for l in list(bs.inputs[name].links):nt.links.remove(l)
bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.65
RES=img.size[0];pix=np.array(img.pixels[:]).reshape(RES,RES,4)
T_=me.attributes.new('_TINT','FLOAT','POINT');colors=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
uv=me.uv_layers.active.data;vt=np.full(n,-1)
import colorsys
for loop in me.loops:
 u,v=uv[loop.index].uv;x=min(RES-1,max(0,int(u*RES)));y=min(RES-1,max(0,int(v*RES)));r,g,b,_=pix[y,x]
 h,sat,val=colorsys.rgb_to_hsv(r,g,b)
 if .09<=h<.19 and sat>.22 and val>.16:vt[loop.vertex_index]=1
 elif .015<h<.09 and sat>.16 and val>.2:vt[loop.vertex_index]=0
for i in range(n):T_.data[i].value=float(vt[i]);colors.data[i].color=(1,1,1,1)
me.color_attributes.active_color=colors
# ---- extras: v5warp = gear landmarks for HER joints (refined in the fit pass)
w=json.loads(props['v5warp']);w['a5']=[0,round(float(T['upperarm.L'][2]),4),round(float(J['Head'][2]+ (J['head_end'][2]-J['Head'][2])*.45),4),H]
w['neck']=round(float(neck[2]),4);w['sh']=round(float(T['upperarm.L'][0]),4)
body.name='pirate_'+LOD+'_body';body['v6']=1;body['v7']=1;body['v7f']=1;body['v5warp']=json.dumps(w)
body['v7tint']=json.dumps({'mask':'assets/pirates/v7_female_tint'+('_lo' if LOD=='lo' else '')+'.webp'})
body.parent=arm;body.matrix_parent_inverse=arm.matrix_world.inverted();d=body.modifiers.new('Armature','ARMATURE');d.object=arm
arm.data.pose_position='POSE';bpy.ops.object.select_all(action='SELECT')
if LOD=='lo':img.scale(1024,1024)
bpy.ops.export_scene.gltf(filepath=OUT+'/pirate_female_v7_'+LOD+'.glb',export_format='GLB',export_attributes=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_image_format='WEBP',export_image_quality=95 if LOD=='hi' else 90,export_draco_mesh_compression_enable=True,export_def_bones=False,export_yup=True,export_extras=True,export_normals=True)
print('V7F',LOD,'verts',n,'faces',len(me.polygons),'tint',np.bincount(vt+1),'warp',w,flush=True)
