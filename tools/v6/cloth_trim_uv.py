"""Read-only Blender UV selection for gold trim and fixed-colour buttons.
blender -b -P tools/v6/cloth_trim_uv.py -- polygons.json cloth_*.glb
Rasterize output with Pillow using raster_trim() in the local polish runner.
No exports, no geometry/rig/material changes.
"""
import bpy, sys, json, os
args=sys.argv[sys.argv.index('--')+1:]; out,files=args[0],args[1:]; result={}
for path in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    triangles=[]
    for ob in bpy.context.scene.objects:
        if ob.type!='MESH' or ob.name.startswith('Ico'): continue
        me=ob.data; tint=me.attributes.get('_TINT'); color=me.color_attributes.get('Color')
        if not tint or not me.uv_layers.active: continue
        for p in me.polygons:
            ts=[round(tint.data[v].value) for v in p.vertices]
            cols=[color.data[i].color_srgb[:3] for i in p.loop_indices] if color else []
            # Accent 3 is the gold braid; fixed gold button discs have warm
            # vertex paint. White shirt and dark waistcoat are not selected.
            gold=cols and all(r>0.4 and g>0.25 and r>g*1.05 and g>b*1.15 for r,g,b in cols)
            if all(t==3 for t in ts) or (all(t==-1 for t in ts) and gold):
                triangles.append([list(me.uv_layers.active.data[i].uv) for i in p.loop_indices])
    result[os.path.basename(path).replace('.glb','')]=triangles
with open(out,'w') as f: json.dump(result,f)
