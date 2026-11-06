import bpy, sys, numpy as np
from mathutils import Vector
from pathlib import Path

OUT = Path('/workspace/brand/v6_characters/review_aaa')
OUT.mkdir(parents=True, exist_ok=True)
ITEMS = Path('/workspace/raul-v6-aaa/assets/pirates/items/v5')
AAA = Path('/workspace/brand/v6_characters/work/aaa/after')

def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE_NEXT'
    s.eevee.taa_render_samples = 24
    w = bpy.data.worlds.new('W'); s.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (.55,.57,.60,1)
    for loc,e in [((2,-2.5,3),200),((-2.5,-1.5,2),60),((.5,3,2.5),80)]:
        l=bpy.data.lights.new('L','AREA'); l.energy=e; l.size=3; l.use_shadow=False
        o=bpy.data.objects.new('L',l); s.collection.objects.link(o); o.location=loc
    c=bpy.data.cameras.new('C'); cam=bpy.data.objects.new('C',c); s.collection.objects.link(cam); s.camera=cam
    return s, cam, c

def retint(body, skin=(0.92,0.72,0.58), hair=(0.25,0.12,0.05)):
    me=body.data; T=np.zeros(len(me.vertices)); me.attributes['_TINT'].data.foreach_get('value',T); T=np.round(T).astype(int)
    ca=me.color_attributes['Color']
    for li,l in enumerate(me.loops):
        t=T[l.vertex_index]
        if t==0: ca.data[li].color=(*skin,1)
        elif t==1: ca.data[li].color=(*hair,1)

def render_one(path, name, loc, target, lens, res, items=None, tint=None):
    setup_scene()
    bpy.ops.import_scene.gltf(filepath=str(path))
    body=[o for o in bpy.data.objects if o.type=='MESH' and o.get('v6')][0]
    if tint: retint(body, *tint)
    if items:
        for it in items:
            if it.exists():
                bpy.ops.import_scene.gltf(filepath=str(it))
    for o in bpy.data.objects:
        if o.type=='ARMATURE': o.hide_render=True
    s=bpy.context.scene; cam=s.camera; c=cam.data
    c.lens=lens; cam.location=loc
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    s.render.resolution_x,s.render.resolution_y=res
    s.render.filepath=str(OUT/name)
    bpy.ops.render.render(write_still=True)
    print('wrote', name, flush=True)

# Bare default + tint variants + geared
for sex, fn in [('male','pirate_male_v6_hi.glb'),('female','pirate_female_v6_hi.glb')]:
    src=AAA/fn
    render_one(src, f'fit_{sex}_bare.png', (0,-2.6,.95),(0,0,.85),50,(640,800))
    render_one(src, f'fit_{sex}_tint.png', (0,-2.6,.95),(0,0,.85),50,(640,800),
               tint=((0.55,0.35,0.25),(0.05,0.05,0.06)))  # darker skin + black hair
    gear=[
        ITEMS/f'boots_classic_{sex}_hi.glb',
        ITEMS/f'classic_pants_{sex}_hi.glb' if (ITEMS/f'classic_pants_{sex}_hi.glb').exists() else ITEMS/f'cloth_base_pants_{sex}_hi.glb',
        ITEMS/f'tricorn_{sex}_hi.glb' if (ITEMS/f'tricorn_{sex}_hi.glb').exists() else ITEMS/f'hat_tricorn_{sex}_hi.glb',
    ]
    # find coat
    for cand in [f'coat_captain_{sex}_hi.glb', f'pirate_coat_{sex}_hi.glb', f'cloth_coat_{sex}_hi.glb', f'outfit_coat_{sex}_hi.glb']:
        if (ITEMS/cand).exists(): gear.append(ITEMS/cand); break
    gear=[g for g in gear if g and Path(g).exists()]
    print(sex, 'gear', [g.name for g in gear])
    render_one(src, f'fit_{sex}_geared.png', (0,-2.6,.95),(0,0,.85),50,(640,800), items=gear)

# Compose sheet
from PIL import Image, ImageDraw, ImageFont
imgs=[]
labels=[]
for sex in ['male','female']:
  for kind in ['bare','tint','geared']:
    p=OUT/f'fit_{sex}_{kind}.png'
    if p.exists():
      imgs.append(Image.open(p).convert('RGB').resize((320,400), Image.LANCZOS))
      labels.append(f'{sex} {kind}')
if imgs:
  W=3*330+20; H=2*430+50
  canvas=Image.new('RGB',(W,H),(40,42,46))
  draw=ImageDraw.Draw(canvas)
  try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',16)
  except: font=ImageFont.load_default()
  draw.text((10,8),'V6 AAA — tint + gear fit (_TINT 0/1/-1 preserved)', fill=(240,240,240), font=font)
  for i,im in enumerate(imgs):
    r,c=divmod(i,3)
    canvas.paste(im,(10+c*330, 40+r*430))
    draw.text((10+c*330, 40+r*430+405), labels[i], fill=(220,220,220), font=font)
  canvas.save(OUT/'SHEET_v6_aaa_ingame_fit_tints.png')
  print('fit sheet', OUT/'SHEET_v6_aaa_ingame_fit_tints.png')
