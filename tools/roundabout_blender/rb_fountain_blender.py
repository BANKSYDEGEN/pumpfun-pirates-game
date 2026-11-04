# [Timothy] PUMPFUN PIRATES hill roundabout: the wishing fountain in Blender (BANKSY 12:20 "a big fountain"), shared material library
# (tools/plaza_blender/materials.py via lib.Builder: stone_ashlar / stone_trim / iron), same look as the plaza, docks, hill street and fort.
# VISUALS ONLY: js/island/areas/hillRound.js keeps the collider (circle basinR + 0.15), the deck, the water meshes and the animation; this
# model replaces only the stone Kit fountain (hillRound build(): its own kit group 'rb_fountain_kit') once it has loaded. &rbglb=0 = the Kit one.
# Authored in the three.js frame round the fountain centre (x, y up, z; origin = FOUNTAIN x, Y (deck walk height), z), turned into Blender by C.
#   blender -b --factory-startup -P tools/roundabout_blender/rb_fountain_blender.py -- OUT_DIR   ->  OUT/rb_fountain_raw.glb (+ rb_fountain_report.json)
#   node tools/plaza_blender/pack_shops.mjs OUT/rb_fountain_raw.glb assets/island rb_fountain   (from a dir with @gltf-transform + meshoptimizer)
# Heights must match hillRound.js FOUNTAIN: basin R 4.2, rim top 0.84 (coping), water 0.62, bowl 1 water 3.32 (R 2.0), bowl 2 water 4.92 (R 1.05).
import bpy, sys, os, math, json
from mathutils import Matrix
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'plaza_blender'))
from lib import Builder
argv = sys.argv[sys.argv.index('--') + 1:]; OUT = argv[0]; os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
STONE, STONE_D, STONE_L, STONE_M, TRIM, FLOOR = 0xb9b2a6, 0x8a837a, 0xa9a294, 0xb0a99c, 0xd2c9b6, 0x5d7f86
GOLD, GOLD_D, IRON = 0xffc93c, 0xe0a020, 0x2b2f36
Builder.AUTO = {STONE: 'stone_ashlar', STONE_D: 'stone_ashlar', STONE_L: 'stone_ashlar', STONE_M: 'stone_ashlar', TRIM: 'stone_trim', IRON: 'iron'}
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # three (x, y, z) -> Blender (x, -z, y)
def Mt(x=0, y=0, z=0, ry=0, rx=0, rz=0, s=1):
    m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(ry, 4, 'Y') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(rz, 4, 'Z')
    if not hasattr(s, '__len__'): s = (s, s, s)
    return m @ Matrix.Diagonal((s[0], s[1], s[2], 1))
class TB(Builder):
    def __init__(self): super().__init__(); self.stack = [C]
    def bx(self, w, h, d, m, col, mat=0): self.push(m); self.box(w, d, h, 0, 0, 0, col, rx=math.pi / 2, mat=mat); self.pop()
    def cy(self, r0, r1, h, y, col, n=16, smooth=False, ry=0):   # kit cylinder on the axis, bottom at y
        self.push(Mt(0, y + h / 2, 0, ry)); self.cyl(r0, r1, h, 0, -h / 2, 0, col, n=n, rx=-math.pi / 2, smooth=smooth); self.pop()
    def ring(self, R, r, y, col, n=24, m=6): self.push(Mt(0, y, 0)); self.torus(R, r, 0, 0, 0, col, n=n, m_=m, rx=-math.pi / 2); self.pop()
    def ball(self, r, x, y, z, col, sub=1, s=(1, 1, 1)): self.push(Mt(x, y, z)); self.sphere(r, 0, 0, 0, col, sub=sub, s=s); self.pop()

BR = 4.2
def fountain(b, hi):
    N = 16 if hi else 8; seg = 24 if hi else 8; sm = hi
    # a plinth band on the paving, the basin as a ring of dressed blocks (hollow: the pool water sits at 0.62 inside it), coping, buttresses
    b.cy(BR + 0.55, BR + 0.55, 0.05, 0.0, STONE_D, n=N, ry=math.pi / N)
    b.cy(BR - 0.3, BR - 0.3, 0.06, 0.18, FLOOR, n=N, ry=math.pi / N)                     # basin floor (wet stone, under the water)
    for i in range(seg):
        a = (i + 0.5) / seg * 2 * math.pi; w = 2 * math.pi * (BR - 0.15) / seg + 0.04
        b.bx(w, 0.7, 0.42, Mt(math.sin(a) * (BR - 0.06), 0.35, math.cos(a) * (BR - 0.06), a), STONE if i % 2 else STONE_M)
        b.bx(w + 0.08, 0.14, 0.62, Mt(math.sin(a) * (BR + 0.02), 0.77, math.cos(a) * (BR + 0.02), a), TRIM)        # coping (rim top 0.84)
        if hi: b.bx(w + 0.06, 0.1, 0.12, Mt(math.sin(a) * (BR + 0.18), 0.1, math.cos(a) * (BR + 0.18), a), STONE_D)   # foot moulding
    for i in range(8):                                                                    # buttress piers with a ball finial
        a = (i + 0.5) / 8 * 2 * math.pi + math.pi / 8; r = BR + 0.2
        b.bx(0.56, 0.98, 0.56, Mt(math.sin(a) * r, 0.49, math.cos(a) * r, a), STONE_L)
        b.bx(0.66, 0.1, 0.66, Mt(math.sin(a) * r, 1.03, math.cos(a) * r, a), TRIM)
        if hi: b.ball(0.2, math.sin(a) * r, 1.24, math.cos(a) * r, STONE_M, sub=1)
    # central pedestal: square plinth with four basins of shells (the spout heads), column, bowl 1, column, bowl 2, gilded finial
    b.bx(2.0, 0.5, 2.0, Mt(0, 0.45, 0, math.pi / 4), STONE)
    b.bx(2.2, 0.12, 2.2, Mt(0, 0.76, 0, math.pi / 4), TRIM)
    b.cy(0.9, 1.15, 0.5, 0.82, STONE_M, n=N, smooth=sm)
    b.cy(0.55, 0.62, 1.5, 1.3, STONE, n=N, smooth=sm)
    if hi:
        for y in (1.34, 2.78): b.ring(0.62, 0.07, y, TRIM, n=16, m=5)
    for i in range(4):                                                                    # four sea-beast spouts (the water arcs leave at 0.85 m out, 2.55 up)
        a = i / 4 * 2 * math.pi; sx, sz = math.sin(a), math.cos(a)
        b.ball(0.3, sx * 0.62, 2.45, sz * 0.62, STONE_L, sub=1 if hi else 0, s=(0.9, 1.1, 0.9))
        b.push(Mt(sx * 0.82, 2.5, sz * 0.82, a, -math.pi / 2)); b.cyl(0.13, 0.09, 0.3, 0, 0, 0, STONE_M, n=6 if hi else 4); b.pop()
        if hi: b.ball(0.05, sx * 0.62 + math.cos(a) * 0.17, 2.6, sz * 0.62 - math.sin(a) * 0.17, IRON, sub=0); b.ball(0.05, sx * 0.62 - math.cos(a) * 0.17, 2.6, sz * 0.62 + math.sin(a) * 0.17, IRON, sub=0)
    b.cy(0.7, 2.1, 0.5, 2.8, STONE, n=N, smooth=sm)                                       # bowl 1 (water 3.32)
    b.cy(2.15, 2.15, 0.08, 3.28, TRIM, n=N)
    if hi:
        b.ring(2.15, 0.09, 3.36, TRIM, n=32, m=6)
        for i in range(12): a = (i + 0.5) / 12 * 2 * math.pi; b.ball(0.11, math.sin(a) * 1.6, 2.95, math.cos(a) * 1.6, STONE_M, sub=0, s=(1, 0.7, 1))
    b.cy(0.3, 0.42, 1.25, 3.35, STONE_M, n=N, smooth=sm)
    b.cy(0.35, 1.1, 0.36, 4.58, STONE, n=N, smooth=sm)                                    # bowl 2 (water 4.92)
    b.cy(1.15, 1.15, 0.06, 4.88, TRIM, n=N)
    if hi: b.ring(1.15, 0.06, 4.95, TRIM, n=24, m=5)
    b.cy(0.14, 0.22, 0.6, 4.95, STONE_D, n=8)
    b.ball(0.3, 0, 5.72, 0, GOLD, sub=2 if hi else 1)                                     # gilded finial: a ball and a crown of points
    b.cy(0.22, 0.32, 0.12, 5.45, GOLD_D, n=8)
    if hi:
        for i in range(6): a = i / 6 * 2 * math.pi; b.push(Mt(math.sin(a) * 0.2, 6.0, math.cos(a) * 0.2)); b.cyl(0.06, 0.0, 0.22, 0, 0, 0, GOLD, n=4, rx=-math.pi / 2); b.pop()

LODS = [TB(), TB()]
fountain(LODS[0], True); fountain(LODS[1], False)
def mats():
    out = []
    for nm, kind in (('rb_solid', 0), ('rb_glow', 1)):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        out.append(m)
    return out
MATS = mats(); coll = bpy.data.collections.new('rb'); bpy.context.scene.collection.children.link(coll)
root = bpy.data.objects.new('rb_fountain', None); coll.objects.link(root); REP = {}
for lod, bd in enumerate(LODS):
    me = bd.bake(f'rb_fountain_LOD{lod}'); me.validate(clean_customdata=False)
    for m in MATS: me.materials.append(m)
    o = bpy.data.objects.new(f'rb_fountain_LOD{lod}', me); coll.objects.link(o); o.parent = root; REP[f'LOD{lod}'] = bd.tris()
json.dump(REP, open(os.path.join(OUT, 'rb_fountain_report.json'), 'w'), indent=1)
for ob in bpy.data.objects: ob.select_set(True)
f = os.path.join(OUT, 'rb_fountain_raw.glb')
kw = dict(filepath=f, export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', f, os.path.getsize(f), 'TRIS', json.dumps(REP))
