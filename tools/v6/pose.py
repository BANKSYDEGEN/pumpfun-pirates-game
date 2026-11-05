# posed renders: pose.py -- out_prefix body.glb [items.glb ...]  env POSES="walk_pirate:6;walk_pirate:18;idle_pirate:10" VIEWS az list, RW RH, ENG
import bpy,sys,os,math
a=sys.argv[sys.argv.index('--')+1:]; out=a[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
for f in a[1:]: bpy.ops.import_scene.gltf(filepath=f)
sc=bpy.context.scene; arms=[o for o in sc.objects if o.type=='ARMATURE']; A=arms[0]
for o in sc.objects:   # every imported skinned mesh follows the first armature (items share the bone names)
  if o.type=='MESH':
    for m in o.modifiers:
      if m.type=='ARMATURE': m.object=A
for o in list(sc.objects):
  if o.type=='MESH' and o.name.startswith('Icosphere'): bpy.data.objects.remove(o)
for o in arms[1:]: o.hide_render=True
sc.render.engine='BLENDER_EEVEE_NEXT'; sc.render.resolution_x=int(os.environ.get('RW','360')); sc.render.resolution_y=int(os.environ.get('RH','480')); sc.view_settings.view_transform='Standard'
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.9
l=bpy.data.lights.new('k','SUN'); l.energy=2.5; lo=bpy.data.objects.new('k',l); sc.collection.objects.link(lo); lo.rotation_euler=(math.radians(50),0,math.radians(-30))
for o in sc.objects:   # vertex colour x texture (COLOR_0 tint)
  if o.type!='MESH' or 'Color' not in o.data.color_attributes: continue
  for m in o.data.materials:
    if not m or not m.use_nodes: continue
    N=m.node_tree.nodes; L=m.node_tree.links; b=[n for n in N if n.type=='BSDF_PRINCIPLED']; t=[n for n in N if n.type=='TEX_IMAGE']
    if not b or not t or b[0].inputs['Base Color'].links and b[0].inputs['Base Color'].links[0].from_node.type=='MIX': continue
    vc=N.new('ShaderNodeVertexColor'); vc.layer_name='Color'; mx=N.new('ShaderNodeMix'); mx.data_type='RGBA'; mx.blend_type='MULTIPLY'; mx.inputs[0].default_value=1
    L.new(t[0].outputs['Color'],mx.inputs[6]); L.new(vc.outputs['Color'],mx.inputs[7]); L.new(mx.outputs[2],b[0].inputs['Base Color'])
cd=bpy.data.cameras.new('c'); cd.type='ORTHO'; cd.ortho_scale=float(os.environ.get('OS','1.7')); cam=bpy.data.objects.new('c',cd); sc.collection.objects.link(cam); sc.camera=cam
A.animation_data_create()
for t in A.animation_data.nla_tracks: t.mute=True
for ps in os.environ.get('POSES','rest:0;walk_pirate:6;walk_pirate:18;idle_pirate:10').split(';'):
  act,fr=ps.split(':')
  if act=='rest': A.data.pose_position='REST'
  else: A.data.pose_position='POSE'; A.animation_data.action=bpy.data.actions[act]; sc.frame_set(int(fr))
  for az in os.environ.get('VIEWS','0,90').split(','):
    r=math.radians(float(az)); cam.location=(5*math.sin(r),-5*math.cos(r),float(os.environ.get('CZ','0.72'))); cam.rotation_euler=(math.pi/2,0,r)
    sc.render.filepath=f'{out}_{act}{fr}_{az}.png'; bpy.ops.render.render(write_still=True)
