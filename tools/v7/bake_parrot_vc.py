# Meshy parrot GLB -> vertex-coloured, untextured GLB for the merged gear mesh (blender -b -P this -- in.glb out.glb base_color.png)
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a[0])
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    me = o.data; img = bpy.data.images.load(a[2])
    W, H = img.size; px = list(img.pixels); uv = me.uv_layers.active.data
    ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for i, l in enumerate(me.loops):
        u, v = uv[i].uv
        if u != u or v != v: u = v = 0.5
        x = min(W - 1, max(0, int((u % 1) * W))); y = min(H - 1, max(0, int((v % 1) * H))); k = (y * W + x) * 4
        ca.data[i].color = (px[k], px[k + 1], px[k + 2], 1)
    me.materials.clear()
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_materials='NONE', export_texcoords=False, export_vertex_color='ACTIVE', export_draco_mesh_compression_enable=True)
