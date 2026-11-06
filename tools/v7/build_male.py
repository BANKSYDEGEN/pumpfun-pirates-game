"""V7 Meshy male -> existing game skeleton. Blender 4.2, run from repo root.
Uses BANKSY-approved corrected single-shoulder tattoo, preserving its source paint.
"""
import bpy,bmesh,sys,os,numpy as np,json
from mathutils import Vector
ROOT=os.getcwd(); OUT=ROOT+'/assets/pirates'; SOURCE='/workspace/v7-meshy/out/male_v7_rigged_fixed.glb'
LOD=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'hi'
def imp(f):
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=f);return list(set(bpy.data.objects)-before)
def active(o):
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
bpy.ops.wm.read_factory_settings(use_empty=True)
old=imp(OUT+'/pirate_male_v6_hi.glb');arm=next(o for o in old if o.type=='ARMATURE');arm.data.pose_position='REST'
src=next(o for o in old if o.type=='MESH' and o.name.startswith('pirate_'));props=dict(src.items())
keep_actions=set(bpy.data.actions)
new=imp(SOURCE);body=next(o for o in new if o.type=='MESH' and len(o.data.vertices)>1000)
for a in list(bpy.data.actions):
 if a not in keep_actions:bpy.data.actions.remove(a)
# Freeze Meshy rest geometry and keep only its painted mesh. Existing game clips and skeleton stay unchanged.
for a in (o for o in new if o.type=='ARMATURE'):a.data.pose_position='REST'
bpy.context.view_layer.update();mw=body.matrix_world.copy();body.parent=None;body.matrix_world=mw;body.modifiers.clear();body.vertex_groups.clear();active(body);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for o in new:
 if o!=body:bpy.data.objects.remove(o,do_unlink=True)
P=np.array([v.co[:] for v in body.data.vertices]);raw=P.copy()
# Weld duplicated UV-seam vertices before any smoothing; loop UVs remain split.
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=2e-5);bm.to_mesh(body.data);bm.free()
P=np.array([v.co[:] for v in body.data.vertices]);raw=P.copy()
# Joint landmarks, feet, shoulder, elbow and hand match V6. Head remains the V7 sculpt.
P[:,2]=np.interp(raw[:,2],[0,.194,.336,.524,.547,.603,1.000001],[.0021,.2142,.4022,.7475,.7697,.8576,1.40163])
ax=np.abs(raw[:,0]);armx=np.interp(ax,[0,.095,.172,.255,.361],[0,.2088,.3226,.413,.5107])
bodyx=ax*1.55; blend=np.clip((raw[:,2]-.43)/.08,0,1)*(1-np.clip((raw[:,2]-.56)/.05,0,1))
P[:,0]=np.sign(raw[:,0])*(bodyx*(1-blend)+armx*blend)
P[:,1]=(raw[:,1]+.0178)*1.4
for v,p in zip(body.data.vertices,P):v.co=p
# Preserve original UV seams. No seam welding / hole cutting.
if LOD=='lo':
 active(body);d=body.modifiers.new('lod','DECIMATE');d.ratio=.32;d.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=d.name)
for p in body.data.polygons:p.use_smooth=True
# Match the established garment volume below the neck; never shrinkwrap face/hair.
sys.path.insert(0,ROOT+'/tools/v6');import morph
w=lambda Q: 1-np.clip((Q[:,2]-.81)/.05,0,1)
morph.conform(body,src,iters=(24,16),wfn=w,pmask_fn=lambda Q:Q[:,2]<.82,push_iters=6)
# Inherit V6 weights, bone names, bind matrices and ALL game animation clips.
for vg in src.vertex_groups:body.vertex_groups.new(name=vg.name)
d=body.modifiers.new('weights','DATA_TRANSFER');d.object=src;d.use_vert_data=True;d.data_types_verts={'VGROUP_WEIGHTS'};d.vert_mapping='POLYINTERP_NEAREST';d.layers_vgroup_select_src='ALL';d.layers_vgroup_select_dst='NAME';active(body);bpy.ops.object.modifier_apply(modifier=d.name)
for v in body.data.vertices:
 if v.co.z>.85:
  for g in list(v.groups):body.vertex_groups[g.group].remove([v.index])
  body.vertex_groups['head'].add([v.index],1,'REPLACE')
active(body);bpy.ops.object.mode_set(mode='WEIGHT_PAINT');bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL',limit=4);bpy.ops.object.vertex_group_normalize_all(lock_active=False);bpy.ops.object.mode_set(mode='OBJECT')
# Tint IDs remain available to garment hiding. Pixel masks in JS retain tattoo/white/outline paint.
me=body.data;mat=me.materials[0];mat.name='v7body';nodes=mat.node_tree.nodes;bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
tex=next(l.from_node for l in bs.inputs['Base Color'].links);img=tex.image
# Keep base only (normal + packed metal textures are unnecessary for the stylized body).
for name in ['Normal','Metallic','Roughness']:
 for l in list(bs.inputs[name].links):mat.node_tree.links.remove(l)
bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.65
RES=2048 if LOD=='hi' else 1024
img.scale(RES,RES)
pix=np.array(img.pixels[:]).reshape(RES,RES,4)
T=me.attributes.new('_TINT','FLOAT','POINT');colors=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
uv=me.uv_layers.active.data;vt=np.full(len(me.vertices),-1)
for loop in me.loops:
 u,v=uv[loop.index].uv;x=min(RES-1,max(0,int(u*RES)));y=min(RES-1,max(0,int(v*RES)));r,g,b,_=pix[y,x]
 # srgb-like ratios (Blender pixels are stored as source RGB here).
 if r>g*1.05 and g>b*1.45 and g/r>.63:vt[loop.vertex_index]=1
 elif r>g*1.18 and g>b*1.05 and b/g>.60:vt[loop.vertex_index]=0
for i in range(len(me.vertices)):T.data[i].value=float(vt[i]);colors.data[i].color=(1,1,1,1)
me.color_attributes.active_color=colors
body.name='pirate_'+LOD+'_body';body['v6']=1;body['v7']=1;body['v5warp']=props['v5warp'];body.parent=arm;body.matrix_parent_inverse=arm.matrix_world.inverted();d=body.modifiers.new('Armature','ARMATURE');d.object=arm
for o in list(bpy.data.objects):
 if o.type=='MESH' and o!=body:bpy.data.objects.remove(o,do_unlink=True)
arm.data.pose_position='POSE';bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT+'/pirate_male_v7_'+LOD+'.glb',export_format='GLB',export_attributes=True,export_vertex_color='ACTIVE',export_all_vertex_colors=False,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_image_format='WEBP',export_image_quality=90 if LOD=='hi' else 85,export_draco_mesh_compression_enable=True,export_def_bones=False,export_yup=True,export_extras=True)
print('V7',LOD,'verts',len(me.vertices),'faces',len(me.polygons),'unweighted',sum(not v.groups for v in me.vertices),flush=True)
