# posed checks over the unchanged walk clip (+ rest): garment verts inside her posed body (>3 mm) and garment edge stretch (tears)
import bpy,sys,numpy as np
from mathutils.bvhtree import BVHTree
a=sys.argv[sys.argv.index('--')+1:];body,item=a[0],a[1];frames=[int(x) for x in a[2].split(',')]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=body);before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=item)
arms=[o for o in bpy.data.objects if o.type=='ARMATURE'];barm=[o for o in arms if o in before][0]
it=[o for o in set(bpy.data.objects)-before if o.type=='MESH'];it=max(it,key=lambda o:len(o.data.vertices))
bo=max([o for o in before if o.type=='MESH'],key=lambda o:len(o.data.vertices))
for m in it.modifiers:
  if m.type=='ARMATURE': m.object=barm
acts=[x for x in bpy.data.actions if 'walk' in x.name.lower()];barm.animation_data_create();barm.animation_data.action=acts[0]
E0=np.array([e.vertices[:] for e in it.data.edges])
dg=bpy.context.evaluated_depsgraph_get()
def ev(o):
  e=o.evaluated_get(dg);m=e.to_mesh();V=np.array([(e.matrix_world@v.co)[:] for v in m.vertices]);F=[p.vertices[:] for p in m.polygons];e.to_mesh_clear();return V,F
res=[]
for fr in [-1]+frames:
  barm.data.pose_position='REST' if fr<0 else 'POSE'
  if fr>=0: bpy.context.scene.frame_set(fr)
  dg.update();BV,BF=ev(bo);IV,_=ev(it)
  if fr<0: L0=np.linalg.norm(IV[E0[:,0]]-IV[E0[:,1]],axis=1)+1e-9
  T=BVHTree.FromPolygons(BV.tolist(),BF)
  s=np.array([((__import__('mathutils').Vector(v)-q).dot(n) if q is not None else 1) for v in IV for q,n,_,_ in [T.find_nearest(__import__('mathutils').Vector(v),0.05)]])
  L=np.linalg.norm(IV[E0[:,0]]-IV[E0[:,1]],axis=1);r=L/L0
  vg={g.index:g.name for g in it.vertex_groups};dom=[vg.get(max(v.groups,key=lambda g:g.weight).group,'?') if len(v.groups) else '?' for v in it.data.vertices]
  bad=np.where(s<-0.01)[0];from collections import Counter;print('FR',fr,dict(Counter(dom[i] for i in bad).most_common(6)))
  res.append((fr,int((s<-0.003).sum()),int((s<-0.01).sum()),int((r>1.6).sum()),int((r<0.4).sum())))
print('POSED',item,'n',len(IV),' [frame, inside>3mm, inside>1cm, edges stretched>1.6x, crushed<0.4x]:',res)
