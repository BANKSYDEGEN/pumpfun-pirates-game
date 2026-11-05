"""Blender-only male tattoo builder. Never runs garment/body/eye edits.
blender -b -P tools/v6/male_tattoo_only.py -- source.glb tattoo.glb
The exported tattoo is surgically merged by male_tattoo_splice.py.
"""
import bpy, sys, os, numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
src, out = sys.argv[sys.argv.index('--')+1:][:2]
assert 'male' in src and 'female' not in src
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
arm.data.pose_position = 'REST'
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.get('v6'))
me = body.data
LO = '_lo' in src or os.path.basename(src) == 'lo.glb'
FEM = False
E_ = lambda k, d: type(d)(os.environ.get(k, d))
IS6 = np.zeros(len(me.vertices), bool)
for loop, uv in zip(me.loops, me.uv_layers[0].data):
    if uv.uv.x < 0.49: IS6[loop.vertex_index] = True
# Execute ONLY the shared male tattoo block; never the rest of garments.py.
text = open(os.path.join(os.path.dirname(__file__), 'garments.py')).read()
block = text[text.index('# ---- 4) his pill tattoo'):text.index('# ---- polish2 FEM: soft-clean')]
exec(compile(block, 'garments.py:male-tattoo-only', 'exec'))
arm.data.pose_position = 'POSE'
bpy.ops.object.select_all(action='DESELECT')
to.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = to
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True,
    export_animations=False, export_draco_mesh_compression_enable=False,
    export_image_format='AUTO', export_yup=True)
print('TATTOO_ONLY_EXPORT',out)
