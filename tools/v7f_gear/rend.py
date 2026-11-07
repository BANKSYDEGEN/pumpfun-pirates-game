import os,bpy,sys,mathutils
a=sys.argv[sys.argv.index('--')+1:]; items,out=a[0].split(','),a[1]
tz=float(os.environ.get('TZ_',0.7)); dist=float(os.environ.get('DIST',2.2)); views=os.environ.get('VIEWS','front q34 side back').split(); res=int(os.environ.get('RES',520))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.environ.get('BODY','/workspace/v7f-paint-work/female_hi.glb'))
before=set(bpy.data.objects)
for it in items:
  if it!='none': bpy.ops.import_scene.gltf(filepath=it)
if os.environ.get('FLAT'):
  mt=bpy.data.materials.new('flat');mt.use_nodes=True;mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.05,0.35,0.9,1)
  for o in set(bpy.data.objects)-before:
    if o.type=='MESH': o.data.materials.clear(); o.data.materials.append(mt)
for o in bpy.data.objects:
  if o.type=='ARMATURE': o.data.pose_position='REST'
for m in bpy.data.materials:
  b=m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
  if b: b.inputs['Specular IOR Level'].default_value=0.0; b.inputs['Roughness'].default_value=1.0
for o in bpy.data.objects:
  if o.type=='MESH' and (len(o.data.vertices)<40 or o.name.startswith('Icosphere')): o.hide_render=True
sc=bpy.context.scene; sc.view_settings.view_transform='Standard'; sc.view_settings.exposure=-0.45; sc.render.engine='CYCLES'; sc.cycles.samples=16; sc.cycles.device='CPU'; sc.render.resolution_x=sc.render.resolution_y=res
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[1].default_value=0.35
for nm,loc,en in [('k',(1.5,-3,2.5),260),('f',(-2,-2,1.8),110),('b',(0,3,2),120)]:
  l=bpy.data.lights.new(nm,'AREA'); l.energy=en; l.size=2; ob=bpy.data.objects.new(nm,l); sc.collection.objects.link(ob); ob.location=loc; ob.rotation_euler=(mathutils.Vector((0,0,0.8))-mathutils.Vector(loc)).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.new('c',bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera=cam; cam.data.lens=50
V={'front':(0,-1,0.05),'q34':(-0.7,-0.72,0.12),'side':(-1,0,0.05),'back':(0.3,1,0.1)}
for n in views:
  t=mathutils.Vector((0,0,tz)); d=mathutils.Vector(V[n]).normalized(); cam.location=t+d*dist; cam.rotation_euler=(t-cam.location).to_track_quat('-Z','Y').to_euler()
  sc.render.filepath=f'{out}_{n}.png'; bpy.ops.render.render(write_still=True)
