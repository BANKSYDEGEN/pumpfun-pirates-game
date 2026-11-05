# fit renders: fit.py -- SEX LOD OUTDIR item.glb ...   (body = out/pirate_SEX_v6_LOD.glb; per item: idle + walk, 3/4 front)
import bpy,sys,os,math
a=sys.argv[sys.argv.index('--')+1:]; SEX,LOD,OUTD=a[:3]; FILES=a[3:]
bpy.ops.wm.read_factory_settings(use_empty=True); sc=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=f'out/pirate_{SEX}_v6_{LOD}.glb')
A=[o for o in sc.objects if o.type=='ARMATURE'][0]; A.animation_data_create()
for t in A.animation_data.nla_tracks: t.mute=True
for o in list(sc.objects):
  if o.type=='MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=300; sc.render.resolution_y=400; sc.view_settings.view_transform='Standard'; sc.eevee.taa_render_samples=8
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.9
l=bpy.data.lights.new('k','SUN'); l.energy=2.5; lo=bpy.data.objects.new('k',l); sc.collection.objects.link(lo); lo.rotation_euler=(math.radians(50),0,math.radians(-30))
cd=bpy.data.cameras.new('c'); cd.type='ORTHO'; cd.ortho_scale=1.75; cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
r=math.radians(30); cam.location=(5*math.sin(r),-5*math.cos(r),0.72); cam.rotation_euler=(math.pi/2,0,r)
def vc(o):
  if o.type!='MESH' or 'Color' not in o.data.color_attributes: return
  for m in o.data.materials:
    if not m or not m.use_nodes: continue
    N=m.node_tree.nodes; L=m.node_tree.links; b=[n for n in N if n.type=='BSDF_PRINCIPLED']; t=[n for n in N if n.type=='TEX_IMAGE']
    if not b or b[0].inputs['Base Color'].links and b[0].inputs['Base Color'].links[0].from_node.type=='MIX': continue
    v=N.new('ShaderNodeVertexColor'); v.layer_name='Color'; mx=N.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; mx.inputs[0].default_value=1
    if t: L.new(t[0].outputs['Color'],mx.inputs[6])
    else: mx.inputs[6].default_value=(1,1,1,1)
    L.new(v.outputs['Color'],mx.inputs[7]); L.new(mx.outputs[2],b[0].inputs['Base Color'])
for o in sc.objects: vc(o)
hb=A.data.bones['head']
for f in FILES:
  nm=os.path.basename(f).replace(f'_{SEX}_{LOD}.glb',''); A.data.pose_position='REST'; A.animation_data.action=None; sc.frame_set(0)
  before=set(sc.objects); bpy.ops.import_scene.gltf(filepath=f); new=[o for o in sc.objects if o not in before]
  for o in new:
    if o.type=='ARMATURE': o.hide_render=True; continue
    if o.type!='MESH': continue
    if o.name.startswith('Icosphere'): o.hide_render=True; continue
    vc(o); am=[m for m in o.modifiers if m.type=='ARMATURE']
    if am: am[0].object=A
    else:
      mw=o.matrix_world.copy(); o.parent=A; o.parent_type='BONE'; o.parent_bone='head'; o.matrix_world=mw
  for act,fr in (('idle_pirate',20),('walk_pirate',5)):
    A.data.pose_position='POSE'; A.animation_data.action=bpy.data.actions[act]; sc.frame_set(fr)
    sc.render.filepath=f'{OUTD}/{SEX}_{LOD}_{nm}_{act[:4]}.png'; bpy.ops.render.render(write_still=True)
  for o in new: bpy.data.objects.remove(o)
  print('FIT',nm,flush=True)
