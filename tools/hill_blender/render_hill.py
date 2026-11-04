# [Timothy] PUMPFUN PIRATES hill street: Cycles preview renders of hill_street.blend (local renders only, small + few samples).
#   blender -b OUT/hill_street.blend -P tools/hill_blender/render_hill.py -- OUT SHOTDIR [names...]
import bpy, sys, os, math, json
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]; OUT, SHOTS = argv[0], argv[1]; WANT = set(argv[2:]); os.makedirs(SHOTS, exist_ok=True)
R = json.load(open(os.path.join(OUT, 'hill_report.json')))
gyl = lambda lz: 3.0 + max(0, -lz - 50) * 0.11
sc = bpy.context.scene
# Blender scene = town-local: x = lx, y = -lz, z = height
for L in R['lots']:
    o = bpy.data.objects['hill_' + L['key']]; o.location = (L['lx'], -L['lz'], L['y']); o.rotation_euler = (0, 0, math.pi / 2 if L['side'] < 0 else -math.pi / 2)
for o in bpy.data.objects:
    if o.type == 'MESH': o.hide_render = o.name.endswith('_LOD1')
# street ground (sloped like foot.js coastH) + the plaza flat + sea
me = bpy.data.meshes.new('ground'); V = []; F = []; NX, NY = 30, 90
for j in range(NY + 1):
    for i in range(NX + 1):
        x = -40 + i * 92 / NX; y = 30 + j * 190 / NY; V.append((x, y, gyl(-y) - 0.0))
for j in range(NY):
    for i in range(NX): a = j * (NX + 1) + i; F.append((a, a + 1, a + NX + 2, a + NX + 1))
me.from_pydata(V, [], F); g = bpy.data.objects.new('ground', me); sc.collection.objects.link(g)
m = bpy.data.materials.new('dirt'); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 0.6; ramp = nt.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.45, 0.36, 0.25, 1); ramp.color_ramp.elements[1].color = (0.66, 0.55, 0.40, 1)
nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bs.inputs['Base Color']); g.data.materials.append(m)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -40, 2.6)); p = bpy.context.object; p.scale = (300, 140, 1); p.data.materials.append(m)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -160, 0.0)); s = bpy.context.object; s.scale = (600, 240, 1)
ms = bpy.data.materials.new('sea'); ms.use_nodes = True; ms.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.18, 0.25, 1); ms.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.1; s.data.materials.append(ms)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(30); sky.sun_rotation = math.radians(140)
w.node_tree.links.new(sky.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color']); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55
sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 1.1; sd.angle = math.radians(3); sd.color = (1.0, 0.9, 0.75); so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(140))
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', 24)); sc.cycles.use_denoising = True; sc.render.threads_mode = 'FIXED'; sc.render.threads = int(os.environ.get('THREADS', 4))
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
def shot(name, c, t, lens=24, res=(1280, 720)):
    if WANT and name not in WANT: return
    P = lambda q: (q[0], -q[1], gyl(q[1]) + q[2])
    cam.location = P(c); d = Vector(P(t)) - Vector(P(c)); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.filepath = os.path.join(SHOTS, name + '.png'); bpy.ops.render.render(write_still=True); print('SHOT', name, flush=True)
shot('blender_street_up', (6, -56, 2.0), (6, -140, 3.5), 22)
shot('blender_street_down_ref', (9, -178, 1.9), (5, -90, -2.5), 24)
shot('blender_sword_shop', (11, -127, 1.8), (-4.5, -134.5, 2.8), 22)
shot('blender_musket_shop', (1, -127, 1.8), (16.5, -134.5, 2.8), 22)
shot('blender_rent_interior', (6.5, -93.2, 1.7), (-8, -94.3, 1.5), 20)
