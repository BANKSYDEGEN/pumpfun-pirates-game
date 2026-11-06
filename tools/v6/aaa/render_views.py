import bpy, sys
from mathutils import Vector
from pathlib import Path

src = Path(sys.argv[-2])
outdir = Path(sys.argv[-1])
outdir.mkdir(parents=True, exist_ok=True)
tag = src.stem.replace('pirate_','').replace('_v6_hi','').replace('_v6_lo','')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(src))
s = bpy.context.scene
s.render.engine = 'BLENDER_EEVEE_NEXT'
s.eevee.taa_render_samples = 32
w = bpy.data.worlds.new('W'); s.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (.55,.57,.60,1)
for loc,e in [((2,-2.5,3),220),((-2.5,-1.5,2),70),((.5,3,2.5),90)]:
    l=bpy.data.lights.new('L','AREA'); l.energy=e; l.size=3; l.use_shadow=False
    o=bpy.data.objects.new('L',l); s.collection.objects.link(o); o.location=loc
c=bpy.data.cameras.new('C'); cam=bpy.data.objects.new('C',c); s.collection.objects.link(cam); s.camera=cam
for o in bpy.data.objects:
    if o.type=='ARMATURE': o.hide_render=True
views=[
    ('front',(0,-2.8,.95),(0,0,.85),50,(720,900)),
    ('q3',(1.9,-2.1,1),(0,0,.85),50,(720,900)),
    ('side',(2.8,0,.95),(0,0,.85),50,(720,900)),
    ('back',(0,2.8,.95),(0,0,.85),50,(720,900)),
    ('face',(0,-1.35,1.22),(0,0,1.18),70,(800,800)),
    ('chest',(0,-1.5,1.05),(0,0,.95),60,(800,800)),
]
for name,loc,target,lens,res in views:
    c.lens=lens; cam.location=loc
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    s.render.resolution_x,s.render.resolution_y=res
    s.render.filepath=str(outdir/f'{tag}_{name}.png')
    bpy.ops.render.render(write_still=True)
print('done', tag, flush=True)
