import os,bpy,sys,mathutils
a=sys.argv[sys.argv.index('--')+1:]; items,out=a[0].split(','),a[1]
tz=float(os.environ.get('TZ_',0.7)); dist=float(os.environ.get('DIST',2.2)); views=os.environ.get('VIEWS','front q34 side back').split(); res=int(os.environ.get('RES',520))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.environ.get('BODY','/workspace/v7f-paint-work/female_hi.glb'))
before=set(bpy.data.objects)
for it in items:
  if it!='none': bpy.ops.import_scene.gltf(filepath=it)
def _hex(h): h=h.lstrip('#');return tuple((int(h[i:i+2],16)/255)**2.2 for i in (0,2,4))+(1,)
if not os.environ.get('FLAT'):   # [b3] runtime clothMat (js/pirateItems.js): opaque; rgb = map.rgb * mix(cream, COLOR_0, map.a) (cream items) else map.rgb * COLOR_0; back faces = cloth colour * 0.85
  CREAM=os.environ.get('CREAM');BACK=os.environ.get('BACK','#dddddd')
  for o in set(bpy.data.objects)-before:
    if o.type!='MESH': continue
    for ms in o.material_slots:
      m=ms.material
      if not m or not m.use_nodes: continue
      nt=m.node_tree;N=nt.nodes;L=nt.links;bs=N.get('Principled BSDF');tex=[n for n in N if n.type=='TEX_IMAGE' and n.image and 'normal' not in n.image.name.lower()]
      if not bs or not tex: continue
      t=[n for n in tex if any(l.to_socket==bs.inputs['Base Color'] for l in n.outputs['Color'].links)] or tex; t=t[0]
      vc=N.new('ShaderNodeVertexColor');vc.layer_name=o.data.color_attributes[0].name if len(o.data.color_attributes) else ''
      mul=N.new('ShaderNodeMix');mul.data_type='RGBA';mul.blend_type='MULTIPLY';mul.inputs['Factor'].default_value=1
      if CREAM:
        mx=N.new('ShaderNodeMix');mx.data_type='RGBA';mx.inputs['A'].default_value=_hex(CREAM);L.new(vc.outputs['Color'],mx.inputs['B']);L.new(t.outputs['Alpha'],mx.inputs['Factor']);L.new(mx.outputs['Result'],mul.inputs['B'])
      else: L.new(vc.outputs['Color'],mul.inputs['B'])
      L.new(t.outputs['Color'],mul.inputs['A'])
      gm=N.new('ShaderNodeNewGeometry');bk=N.new('ShaderNodeMix');bk.data_type='RGBA';bc=_hex(BACK);bk.inputs['B'].default_value=tuple(c*0.85**2.2 for c in bc[:3])+(1,)
      L.new(gm.outputs['Backfacing'],bk.inputs['Factor']);L.new(mul.outputs['Result'],bk.inputs['A']);L.new(bk.outputs['Result'],bs.inputs['Base Color'])
      for l in list(bs.inputs['Alpha'].links): L.remove(l)
      bs.inputs['Alpha'].default_value=1;m.blend_method='OPAQUE' if hasattr(m,'blend_method') else None
      try: m.surface_render_method='DITHERED'
      except Exception: pass
if os.environ.get('DIAG'):
  mb=bpy.data.materials.new('bodydiag');mb.use_nodes=True;mb.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(1,0,0.6,1)
  for o in before:
    if o.type=='MESH' and len(o.data.vertices)>1000: o.data.materials.clear(); o.data.materials.append(mb)
if os.environ.get('FLAT'):
  mt=bpy.data.materials.new('flat');mt.use_nodes=True;mt.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(0.05,0.35,0.9,1)
  for o in set(bpy.data.objects)-before:
    if o.type=='MESH': o.data.materials.clear(); o.data.materials.append(mt)
arms=[o for o in bpy.data.objects if o.type=='ARMATURE'];barm=[o for o in arms if o not in [x for x in set(bpy.data.objects)-before]][0] if arms else None
POSE=os.environ.get('POSE')
for o in arms: o.data.pose_position='REST'
if POSE and barm:
  for o in set(bpy.data.objects)-before:
    for m in getattr(o,'modifiers',[]):
      if m.type=='ARMATURE': m.object=barm
  nm,fr=POSE.split(':');acts=[a for a in bpy.data.actions if nm.lower() in a.name.lower()] or list(bpy.data.actions)
  print('ACTIONS',[a.name for a in bpy.data.actions][:40]);barm.animation_data_create();barm.animation_data.action=acts[0];barm.data.pose_position='POSE';bpy.context.scene.frame_set(int(fr));print('USING',acts[0].name)
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
