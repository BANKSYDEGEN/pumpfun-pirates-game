# [Timothy] PUMPFUN PIRATES battery: Cycles preview renders of battery.blend on the sampled island terrain (local renders only).
#   blender -b OUT/battery.blend -P tools/plaza_blender/render_battery.py -- SHOTDIR [names...]
import bpy, sys, os, math, json
import numpy as np
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index('--') + 1:]; SHOTS = argv[0]; WANT = set(argv[1:]); os.makedirs(SHOTS, exist_ok=True)
HJ = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'battery_terrain.json'))); HG = np.array(HJ['h'])
sc = bpy.context.scene
for o in bpy.data.objects:
    if o.type == 'MESH': o.hide_render = o.name == 'battery_LOD1'
# terrain from the sampled heights (battery-local: x = lx - 160, y = -(lz - 42)); grass above 3 m, sand below, sea plane
V = []; F = []; C = []; nz, nx = HG.shape
for j in range(nz):
    for i in range(nx): V.append((HJ['lx0'] + i * HJ['step'] - 160, -(HJ['lz0'] + j * HJ['step'] - 42), HG[j, i] - 0.03))
for j in range(nz - 1):
    for i in range(nx - 1): a = j * nx + i; F.append((a, a + 1, a + nx + 1, a + nx)[::-1])
me = bpy.data.meshes.new('terrain'); me.from_pydata(V, [], F); ter = bpy.data.objects.new('terrain', me); sc.collection.objects.link(ter)
mt = bpy.data.materials.new('ter'); mt.use_nodes = True; nt = mt.node_tree; bs = nt.nodes['Principled BSDF']
geo = nt.nodes.new('ShaderNodeNewGeometry'); sep = nt.nodes.new('ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], sep.inputs[0])
ramp = nt.nodes.new('ShaderNodeValToRGB'); mr = nt.nodes.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = 1.5; mr.inputs['From Max'].default_value = 5
nt.links.new(sep.outputs['Z'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], ramp.inputs['Fac'])
ramp.color_ramp.elements[0].color = (0.85, 0.72, 0.45, 1); ramp.color_ramp.elements[1].color = (0.22, 0.5, 0.12, 1); nt.links.new(ramp.outputs['Color'], bs.inputs['Base Color']); me.materials.append(mt)
bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.3)); s = bpy.context.object; s.scale = (600, 600, 1)
ms = bpy.data.materials.new('sea'); ms.use_nodes = True; ms.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.2, 0.28, 1); ms.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.08; s.data.materials.append(ms)
# the 6 guns (carriage on the deck + barrel at the trunnion pivot, rest elevation 0.1 rad) as linked duplicates
car, bar = bpy.data.objects['gun_carriage'], bpy.data.objects['gun_barrel']; car.hide_render = bar.hide_render = True
for i in range(6):
    a = -0.75 + i * 0.3; lx, lz = 160 + math.sin(a) * 15, 42 + math.cos(a) * 15; x, y = lx - 160, -(lz - 42)
    m = Matrix.Translation((x, y, 21)) @ Matrix.Rotation(-a, 4, 'Z')
    c = bpy.data.objects.new(f'car{i}', car.data); c.matrix_world = m; sc.collection.objects.link(c)
    bb = bpy.data.objects.new(f'bar{i}', bar.data); bb.matrix_world = m @ Matrix.Translation((0, -0.15, 1.2)) @ Matrix.Rotation(-0.1 if i != 2 else -0.2, 4, 'X'); sc.collection.objects.link(bb)
    if i == 2 and 'fire' in os.environ.get('FIRE', 'fire'):   # muzzle flash + smoke puff for the firing frame
        tip = bb.matrix_world @ Vector((0, -2.6, 0))
        bpy.ops.mesh.primitive_ico_sphere_add(radius=0.9, location=tip); f = bpy.context.object; fm = bpy.data.materials.new('flash'); fm.use_nodes = True
        e = fm.node_tree.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (1, 0.6, 0.15, 1); e.inputs['Strength'].default_value = 25; fm.node_tree.links.new(e.outputs[0], fm.node_tree.nodes['Material Output'].inputs[0]); f.data.materials.append(fm)
        f.name = 'flash'
        for k in range(5):
            p = bb.matrix_world @ Vector((0.3 * math.sin(k), -3.4 - k * 1.1, 0.2 * k)); bpy.ops.mesh.primitive_ico_sphere_add(radius=0.8 + k * 0.35, subdivisions=2, location=p); sm = bpy.context.object
            smm = bpy.data.materials.new('smoke'); smm.use_nodes = True; smm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.85, 0.85, 0.85, 1); sm.data.materials.append(smm); sm.name = 'smoke'
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; sky = w.node_tree.nodes.new('ShaderNodeTexSky'); sky.sky_type = 'NISHITA'; sky.sun_elevation = math.radians(30); sky.sun_rotation = math.radians(210)
w.node_tree.links.new(sky.outputs['Color'], w.node_tree.nodes['Background'].inputs['Color']); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.22
sd = bpy.data.lights.new('sun', 'SUN'); sd.energy = 1.7; sd.color = (1.0, 0.9, 0.75); so = bpy.data.objects.new('sun', sd); sc.collection.objects.link(so); so.rotation_euler = (math.radians(55), 0, math.radians(210))
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', 16)); sc.cycles.use_denoising = True
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'Medium High Contrast'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
L = lambda lx, lz, y: (lx - 160, -(lz - 42), y)
def shot(name, pos, tgt, lens=24):
    if WANT and name not in WANT: return
    for o in bpy.data.objects:
        if o.name.startswith(('flash', 'smoke')): o.hide_render = name != 'blender_battery_firing'
    cam.location = pos; cam.rotation_euler = (Vector(tgt) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler(); cam.data.lens = lens
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900; sc.render.filepath = os.path.join(SHOTS, name + '.png'); bpy.ops.render.render(write_still=True); print('SHOT', name)
shot('blender_battery_ramp', L(108, -1, 6.5), L(170, 0, 17), 22)
shot('blender_battery_deck', L(150, 18, 25.5), L(162, 52, 21), 20)
shot('blender_battery_overview', L(120, -40, 70), L(165, 25, 15), 26)
shot('blender_battery_cannon', L(156.5, 49, 22.9), L(160.3, 57.2, 22.2), 30)
shot('blender_battery_firing', L(150.5, 52, 23.6), L(162, 58, 22.3), 26)
