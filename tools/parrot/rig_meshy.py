# Meshy macaw -> normalized game flight rig, single atlas/material, texture-limited GLB.
import bpy,bmesh,math,sys,json
import numpy as np
from mathutils import Vector
from pathlib import Path
root=Path('/workspace/parrot_ref');out=Path('/workspace/emerly-hullfix/assets/pirates/items/v7')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'meshy_macaw.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
for o in bpy.context.selected_objects:o.select_set(False)
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();obj=bpy.context.object
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
print('SOURCE',len(obj.data.polygons),'faces',len(obj.data.vertices),'verts','materials',len(obj.data.materials),flush=True)
# Normalize wingspan and lean upright reference into a flight posture.
coords=np.array([v.co[:] for v in obj.data.vertices]);span=coords[:,0].max()-coords[:,0].min();center=(coords[:,0].max()+coords[:,0].min())/2
# Put the chest at origin; image-to-3D ground has tail/feet on the bottom.
zmin,zmax=coords[:,2].min(),coords[:,2].max();chest=zmin+(zmax-zmin)*.56
for v in obj.data.vertices:v.co=(v.co-Vector((center,0,chest)))*(.94/span)
obj.rotation_euler.x=math.radians(62);bpy.ops.object.transform_apply(location=False,rotation=True,scale=False)
tri=obj.modifiers.new('triangulate','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
# Weld Meshy UV-split vertices before decimation. Decimating disconnected UV
# islands independently tears thousands of triangular holes through the feathers.
# BMesh keeps the per-corner UVs while giving the collapse operation real adjacency.
bm=bmesh.new();bm.from_mesh(obj.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary],sides=12)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(obj.data);bm.free()
before=len(obj.data.polygons)
if before>2400:
 dec=obj.modifiers.new('mobile_decimate','DECIMATE');dec.ratio=2400/before;dec.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=dec.name)
for poly in obj.data.polygons:poly.use_smooth=True
# Meshy emits one base colour atlas. Retain its painted face, beak and feet exactly.
images=[]
for mat in obj.data.materials:
 if not mat or not mat.use_nodes:continue
 for node in mat.node_tree.nodes:
  if node.type=='TEX_IMAGE' and node.image:
   im=node.image
   if max(im.size)>1024:im.scale(int(im.size[0]*1024/max(im.size)),int(im.size[1]*1024/max(im.size)))
   if im not in images:images.append(im)
# Use only base colour + roughness; no PBR normal/metal textures needed on this tiny companion.
for mat in obj.data.materials:
 if not mat or not mat.use_nodes:continue
 bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs:continue
 for socket in ['Normal','Metallic','Roughness']:
  for link in list(bs.inputs[socket].links):mat.node_tree.links.remove(link)
 bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.8
 for n in mat.node_tree.nodes:
  if n.type=='TEX_IMAGE' and n.image and n.outputs['Color'].is_linked:
   if any(l.to_socket==bs.inputs['Base Color'] for l in n.outputs['Color'].links):n.image.filepath_raw=str(root/'macaw_albedo.png');n.image.file_format='PNG';n.image.save()
# Seven bones: body, head, shoulders, outer primaries, tail. Bone local Y is Blender Z.
arm=bpy.data.armatures.new('macaw_flight');rig=bpy.data.objects.new('macaw_flight',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
points={'body':(0,0,0),'head':(0,-.10,.10),'wing_L':(-.07,0,.02),'wing_R':(.07,0,.02),'tip_L':(-.24,0,.02),'tip_R':(.24,0,.02),'tail':(0,.10,-.035)}
for name,point in points.items():
 b=arm.edit_bones.new(name);b.head=point;b.tail=Vector(point)+Vector((0,0,.06))
for name in points:
 if name!='body':arm.edit_bones[name].parent=arm.edit_bones['wing_L' if name=='tip_L' else 'wing_R' if name=='tip_R' else 'body']
bpy.ops.object.mode_set(mode='OBJECT')
groups={n:obj.vertex_groups.new(name=n)for n in points}
for v in obj.data.vertices:
 x,y,z=v.co;ax=abs(x);weights={}
 if y>.08 and z<.05 and ax<.22:
  t=min(1,max(0,(y-.08)/.09));weights={'body':1-t,'tail':t}
 elif ax>.075:
  side='L' if x<0 else 'R';w=min(1,max(0,(ax-.075)/.055));tip=min(1,max(0,(ax-.22)/.10));weights={'body':1-w,'wing_'+side:w*(1-tip),'tip_'+side:w*tip}
 elif y<-.06 and z>.015:
  h=min(1,max(0,(-y-.06)/.07));weights={'body':1-h,'head':h}
 elif y>.10:
  t=min(1,max(0,(y-.10)/.09));weights={'body':1-t,'tail':t}
 else:weights={'body':1}
 for n,w in weights.items():
  if w>.0001:groups[n].add([v.index],float(w),'REPLACE')
mod=obj.modifiers.new('flight_skin','ARMATURE');mod.object=rig;obj.parent=rig
for o in bpy.context.selected_objects:o.select_set(False)
obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.export_scene.gltf(filepath=str(out/'parrot_flight.glb'),export_format='GLB',use_selection=True,export_image_format='WEBP',export_image_quality=85,export_animations=False,export_skins=True)
(root/'mesh_stats.json').write_text(json.dumps({'source_triangles':before,'final_triangles':len(obj.data.polygons),'raw_bytes':(root/'meshy_macaw.glb').stat().st_size,'uncompressed_game_bytes':(out/'parrot_flight.glb').stat().st_size}))
bpy.ops.wm.save_as_mainfile(filepath=str(root/'macaw_flight.blend'))
print('RIGGED',len(obj.data.polygons),flush=True)
