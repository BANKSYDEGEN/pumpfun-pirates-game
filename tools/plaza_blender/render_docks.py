# [Timothy] PUMPFUN PIRATES docks: Cycles preview renders of docks.blend (local renders only).
#   blender -b OUT/docks.blend -P tools/plaza_blender/render_docks.py -- SHOTDIR [names...]
import bpy, sys, os, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]; SHOTS = argv[0]; WANT = set(argv[1:]); os.makedirs(SHOTS, exist_ok=True)
sc = bpy.context.scene
for o in bpy.data.objects:
    if o.type == 'MESH': o.hide_render = o.name.endswith('_LOD1')
def plane(name, size, loc, col, rough=0.9):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc); p = bpy.context.object; p.name = name; p.scale = size
    m = bpy.data.materials.new(name); m.use_nodes = True; bs = m.node_tree.nodes['Principled BSDF']; bs.inputs['Base Color'].default_value = col; bs.inputs['Roughness'].default_value = rough
    if name == 'sea': bs.inputs['Transmission Weight'].default_value = 0.6; bs.inputs['IOR'].default_value = 1.33
    p.data.materials.append(m)
plane('sea', (800, 800, 1), (0, -100, 0.0), (0.03, 0.28, 0.33, 1), 0.05)
plane('seabed', (800, 800, 1), (0, -100, -4.5), (0.55, 0.5, 0.36, 1))
plane('quay', (290, 60, 1), (-38, 30, 2.72), (0.62, 0.58, 0.52, 1))        # street / shore behind the boardwalk (lz < -0.15)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(32); sky.sun_rotation = math.radians(200)
w.node_tree.links.new(sky.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color']); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.22
sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 1.7; sd.color = (1.0, 0.9, 0.75); so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(200))
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', 16)); sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'Medium High Contrast'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
L = lambda lx, lz, y: (lx, -lz, y)
def shot(name, pos, tgt, lens=24):
    if WANT and name not in WANT: return
    cam.location = pos; cam.rotation_euler = (Vector(tgt) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900; sc.render.filepath = os.path.join(SHOTS, name + '.png'); bpy.ops.render.render(write_still=True); print('SHOT', name)
shot('blender_docks_arrival', L(-20, 92, 14), L(-30, 10, 2), 20)
shot('blender_docks_jetty', L(-54.5, 30, 4.9), L(-46, 46, 2.6), 20)
shot('blender_docks_plaque', L(-46.5, 20.5, 4.4), L(-50.6, 17, 4.3), 26)
shot('blender_docks_pilings', L(-35, 12, 1.0), L(-46, 24, 1.2), 20)
shot('blender_docks_transition', L(-70, -6, 5.0), L(-38, 6, 2.2), 20)
