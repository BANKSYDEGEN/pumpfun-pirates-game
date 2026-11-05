"""Offline item-only review; no browser/WebGL context, body or store changes.
blender -b -noaudio -P tools/v6/clothes_review.py -- OUTDIR item.glb ...
Uses CPU Cycles so review also works on a headless machine.
"""
import bpy, sys, os, math
from mathutils.kdtree import KDTree
from mathutils import Vector
args = sys.argv[sys.argv.index('--')+1:]; out, files = args[0], args[1:]
os.makedirs(out, exist_ok=True)
for path in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    sc=bpy.context.scene
    if os.environ.get('REVIEW_EQUIPPED'):
        # Read-only V6 fit preview. This reproduces the nearest-vertex cover
        # mask in bind pose, not every runtime hair/boot/pose correction.
        sex,lod=os.path.basename(path).replace('.glb','').rsplit('_',2)[-2:]
        item_name=os.path.basename(path).rsplit('_',2)[0]
        if item_name.startswith('cloth_') and item_name!='cloth_base':
            bpy.ops.import_scene.gltf(filepath=os.path.abspath(f'assets/pirates/items/v5/classic_pants_{sex}_{lod}.glb'))
        item_meshes=[o for o in sc.objects if o.type=='MESH' and not o.name.startswith('Ico')]
        before=set(sc.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(os.environ.get('REVIEW_BODY_ROOT','assets/pirates'),f'pirate_{sex}_v6_{lod}.glb'))
        body=[o for o in sc.objects if o not in before]
        import bmesh
        covers=[]
        for o in item_meshes:
            kd=KDTree(len(o.data.vertices))
            for v in o.data.vertices: kd.insert(v.co,v.index)
            kd.balance();covers.append((o.data,kd))
        for o in body:
            if o.type!='MESH' or o.name.startswith('Ico'): continue
            me=o.data; tint=me.attributes.get('_TINT'); covered=set()
            for v in me.vertices:
                t=round(tint.data[v.index].value) if tint else -99
                if t==1: continue  # hair/braid is never part of the cover mask
                # Pants replace the fixed-colour underwear, as baseMask does.
                hide=t in (-1,7) and v.co.z < (.66 if sex=='female' else .615)
                for cm,kd in covers:
                    near,idx,dist=kd.find(v.co)
                    hem=cm.attributes.get('_HEM')
                    if dist<.024 and (not hem or hem.data[idx].value>=.016):
                        if hem or (near-v.co).dot(cm.vertices[idx].normal)>-.004: hide=True
                if hide: covered.add(v.index)
            bm=bmesh.new();bm.from_mesh(me)
            remove=[f for f in bm.faces if all(v.index in covered for v in f.verts)]
            bmesh.ops.delete(bm,geom=remove,context='FACES');bm.to_mesh(me);bm.free()
    if os.environ.get('REVIEW_BOOT_ROOT'):
        sex,lod=os.path.basename(path).replace('.glb','').rsplit('_',2)[-2:]
        bpy.ops.import_scene.gltf(filepath=os.path.join(os.environ['REVIEW_BOOT_ROOT'],f'boots_sea_{sex}_{lod}.glb'))
    for ob in list(sc.objects):
        if ob.type=='ARMATURE': ob.data.pose_position='REST'
        if ob.type=='MESH' and (ob.name.startswith('Ico') or 'outline' in ob.name.lower()): ob.hide_render=True
    meshes=[o for o in sc.objects if o.type=='MESH' and not o.hide_render]
    for ob in meshes:
        # Game items use unlit atlas x COLOR_0. Keep Blender's imported multiply.
        for mat in ob.data.materials:
            if not mat or not mat.use_nodes: continue
            nodes=mat.node_tree.nodes; links=mat.node_tree.links
            bs=next((n for n in nodes if n.type=='BSDF_PRINCIPLED'),None)
            output=next((n for n in nodes if n.type=='OUTPUT_MATERIAL'),None)
            if not bs or not output: continue
            emission=nodes.new('ShaderNodeEmission')
            inp=bs.inputs['Base Color']
            if inp.links: links.new(inp.links[0].from_socket,emission.inputs['Color'])
            else: emission.inputs['Color'].default_value=inp.default_value
            links.new(emission.outputs[0],output.inputs['Surface'])
    if os.environ.get('REVIEW_WALK'):
        # Read the animation source only; render item rigs in that shared walk pose.
        if os.environ.get('REVIEW_EQUIPPED'):
            rig=next(o for o in body if o.type=='ARMATURE')
        else:
            before=set(sc.objects)
            sex,lod=os.path.basename(path).replace('.glb','').rsplit('_',2)[-2:]
            root=os.environ.get('REVIEW_BODY_ROOT','assets/pirates')
            bpy.ops.import_scene.gltf(filepath=os.path.join(root,f'pirate_{sex}_v6_{lod}.glb'))
            added=[o for o in sc.objects if o not in before]
            rig=next(o for o in added if o.type=='ARMATURE')
            for o in added:
                if o.type=='MESH': o.hide_render=True
        for o in meshes:
            for modifier in o.modifiers:
                if modifier.type=='ARMATURE': modifier.object=rig
        rig.data.pose_position='POSE';rig.animation_data_create()
        tracks=list(rig.animation_data.nla_tracks)
        track=next((t for t in tracks if t.name=='walk'),next((t for t in tracks if t.name.startswith('walk')),None))
        assert track is not None and len(track.strips), 'walk clip missing'
        action=track.strips[0].action
        for t in tracks: t.mute=True
        rig.animation_data.action=action
        sc.frame_set(5);bpy.context.view_layer.update()
    points=[o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3))); hi=Vector(tuple(max(p[i] for p in points) for i in range(3))); center=(lo+hi)/2
    sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=12; sc.cycles.use_denoising=True
    sc.render.threads_mode='FIXED'; sc.render.threads=4
    sc.render.resolution_x=480; sc.render.resolution_y=520; sc.render.resolution_percentage=100
    sc.view_settings.view_transform='Standard'; sc.render.image_settings.file_format='PNG'
    world=bpy.data.worlds.new('studio'); sc.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(0.32,0.36,0.42,1); world.node_tree.nodes['Background'].inputs[1].default_value=0.6
    for name,loc,energy,size in [('key',(-2,-3,4),200,3),('fill',(2,-1,2),100,3),('rim',(0,3,3),180,2)]:
        light=bpy.data.lights.new(name,'AREA'); light.energy=energy; light.shape='DISK'; light.size=size
        ob=bpy.data.objects.new(name,light); sc.collection.objects.link(ob); ob.location=center+Vector(loc); ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()
    data=bpy.data.cameras.new('review'); data.type='ORTHO'; data.ortho_scale=max((hi.x-lo.x)*520/480,hi.z-lo.z)*1.25
    cam=bpy.data.objects.new('review',data); sc.collection.objects.link(cam); sc.camera=cam
    for label,az in [('front',18),('back',198)]:
        angle=math.radians(az); cam.location=center+Vector((3*math.sin(angle),-3*math.cos(angle),0.3)); cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        sc.render.filepath=os.path.join(out,os.path.basename(path).replace('.glb','')+'_'+label+'.png'); bpy.ops.render.render(write_still=True)
