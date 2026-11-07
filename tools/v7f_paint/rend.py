import os
import bpy, sys, math, mathutils
a = sys.argv[sys.argv.index('--')+1:]; paint, out = a[0], a[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/v7f-paint-work/female_hi.glb')
if paint != 'none': bpy.ops.import_scene.gltf(filepath=paint)
for a in bpy.data.objects:
  if a.type=='ARMATURE': a.data.pose_position='REST'
bpy.context.view_layer.update()
for m in bpy.data.materials:   # the game draws toon / unlit: no specular sheen washing the colours
  b=m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
  if b: b.inputs['Specular IOR Level'].default_value=0.0; b.inputs['Roughness'].default_value=1.0
meshes=[o for o in bpy.data.objects if o.type=='MESH']
body=[o for o in meshes if 'paint' not in o.data.name and len(o.data.vertices)>1000]
for o in (body if os.environ.get('HIDEBODY') else []): o.hide_render=True
for o in meshes:
  if len(o.data.vertices)<200: o.hide_render=True
import numpy as np
def bb(o):
  dg=bpy.context.evaluated_depsgraph_get(); e=o.evaluated_get(dg); m=e.to_mesh(); P=np.array([o.matrix_world@v.co for v in m.vertices]); e.to_mesh_clear(); return P
P=np.concatenate([bb(o) for o in body]); lo,hi=P.min(0),P.max(0); print('BB',lo,hi)
H=hi[2]; top=P[P[:,2]>H-0.25*(H-lo[2])]  # head zone
hc=top.mean(0); front=lo[1] # glTF -Z fwd? check
print('HEAD',hc, top.min(0), top.max(0))
sc=bpy.context.scene; sc.view_settings.view_transform='Standard'; sc.view_settings.exposure=-0.45; sc.render.engine='CYCLES'; sc.cycles.samples=24; sc.cycles.device='CPU'; sc.render.resolution_x=sc.render.resolution_y=900
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[1].default_value=0.35
for nm,loc,en in [('k',(1.5,-3,2.5),260),('f',(-2,-2,1.8),110)]:
  l=bpy.data.lights.new(nm,'AREA'); l.energy=en; l.size=2; ob=bpy.data.objects.new(nm,l); sc.collection.objects.link(ob); ob.location=loc; ob.rotation_euler=(mathutils.Vector((0,0,1.6))-mathutils.Vector(loc)).to_track_quat('-Z','Y').to_euler()
cam=bpy.data.objects.new('c',bpy.data.cameras.new('c')); sc.collection.objects.link(cam); sc.camera=cam
face=mathutils.Vector((hc[0], top[:,1].min(), H-0.11*(H-lo[2]) ))
views={'front':(0,-1,0,0.45,50),'q34':(-0.7,-0.72,0.05,0.5,50),'side':(-1,0,0,0.5,50),'full':(0,-1,0.05,None,50)}
import os
for n,(dx,dy,dz,dist,fl) in [(k,v) for k,v in views.items() if k in os.environ.get('VIEWS','front q34 side full').split()]:
  if dist is None: t=mathutils.Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2)); dist=(H-lo[2])*2.4
  else: t=mathutils.Vector((0,-0.12,float(os.environ.get('FACEZ','1.0'))))
  d=mathutils.Vector((dx,dy,dz)).normalized(); cam.location=t+d*dist; cam.rotation_euler=(t-cam.location).to_track_quat('-Z','Y').to_euler(); cam.data.lens=fl
  sc.render.filepath=f'{out}_{n}.png'; bpy.ops.render.render(write_still=True)
