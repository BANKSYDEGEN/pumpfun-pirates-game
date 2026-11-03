# [Timothy] PUMPFUN PIRATES plaza shops: Cycles preview renders of plaza_shops.blend (local renders only).
#   blender -b OUT/plaza_shops.blend -P tools/plaza_blender/render_shops.py -- OUT SHOTDIR [names...]
import bpy, sys, os, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]; OUT, SHOTS = argv[0], argv[1]; WANT = set(argv[2:]); os.makedirs(SHOTS, exist_ok=True)
LX = dict(shop_clothes=-49, shop_pets=-38.5, shop_ships=-10, shop_upgrades=20.5, shop_crew=32, house_e=77.9)
WD = dict(shop_clothes=10, shop_pets=9, shop_ships=12, shop_upgrades=11, shop_crew=10, house_e=7)
CZ = -36.0
sc = bpy.context.scene
for o in bpy.data.objects:
    if o.type == 'EMPTY' and o.name in LX: o.location = (LX[o.name], -CZ, 0)
    if o.type == 'MESH': o.hide_render = not o.name.endswith('_LOD0')
# street: cobbles (vertex-free: a noise-textured plane), quay edge, sea
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 15, 0)); g = bpy.context.object; g.scale = (260, 100, 1)
m = bpy.data.materials.new('cobble'); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 3.0; tc = nt.nodes.new('ShaderNodeTexCoord'); mp = nt.nodes.new('ShaderNodeMapping')
nt.links.new(tc.outputs['Object'], mp.inputs['Vector']); mp.inputs['Scale'].default_value = (260, 100, 1); nt.links.new(mp.outputs['Vector'], vor.inputs['Vector'])
ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.elements[0].color = (0.25, 0.22, 0.19, 1); ramp.color_ramp.elements[1].color = (0.62, 0.56, 0.47, 1); ramp.color_ramp.elements[0].position = 0.0; ramp.color_ramp.elements[1].position = 0.25
vor.feature = 'DISTANCE_TO_EDGE'; nt.links.new(vor.outputs['Distance'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], bs.inputs['Base Color']); g.data.materials.append(m)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -60, -0.6)); s = bpy.context.object; s.scale = (400, 80, 1)
ms = bpy.data.materials.new('sea'); ms.use_nodes = True; ms.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.18, 0.25, 1); ms.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.1; s.data.materials.append(ms)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(28); sky.sun_rotation = math.radians(200)
w.node_tree.links.new(sky.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color']); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.22
sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 1.7; sd.angle = math.radians(3); sd.color = (1.0, 0.9, 0.75); so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(200))
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', 48)); sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'Medium High Contrast'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
def shot(name, pos, tgt, lens=28, res=(1600, 900)):
    if WANT and name not in WANT: return
    cam.location = pos; d = Vector(tgt) - Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.filepath = os.path.join(SHOTS, name + '.png'); bpy.ops.render.render(write_still=True); print('SHOT', name)
# street-local helpers: front face of shop at y = 30 (lz -30), the street is y < 30
def front(id_, dist=7.5, h=2.6, dx=0.0, zt=2.4, ty=33.5, lens=30): x = LX[id_]; shot(f'blender_{id_}_front', (x + dx, 30 - dist, h), (x, ty, zt), lens)
shot('blender_hero_street', (-60, 14, 3.4), (-20, 31, 4.5), 22)
shot('blender_hero_street_east', (88, 18, 3.4), (30, 31, 4.5), 24)
for k in LX: front(k)
shot('blender_closeup_mannequins', (-49, 23.2, 2.0), (-49, 31.5, 1.8), 30)
shot('blender_closeup_birdcage', (-38.5 - 1.2, 24.0, 2.6), (-38.5 - 0.9, 31.6, 2.6), 40)
shot('blender_closeup_modelships', (-10, 23.5, 2.4), (-10, 32.5, 1.9), 30)
for k in [k for k in LX if k.startswith('shop_')]:   # sign clearance close-ups: the hanging sign + facade board under the balcony
    xs = LX[k] + WD[k] / 2 - 0.45; shot(f'blender_sign_{k}', (xs + 3.4, 23.0, 3.1), (xs - 0.6, 29.0, 4.3), 32)

