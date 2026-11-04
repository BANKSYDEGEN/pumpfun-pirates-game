# [Timothy] PUMPFUN PIRATES fountain plaza in Blender (BANKSY 1:33 PM: "make the side of the castle and the path down just as nice as plaza and the
# fountain plaza more symmetrical off of hill street"). Input = assets/island/rb_plaza_layout.json (js/island/areas/hillRound.js RB_LAYOUT via
# tools/roundabout_blender/node/export_layout.mjs): every structural stone piece of the plaza (deck, border band, retaining walls, parapets +
# coping, the Pirates' Climb treads, the castle apron, the gate piers, the bridge towers + piers) with its world matrix. This rebuilds them with
# the shared material library (tools/plaza_blender/materials.py: cobble / stone_ashlar / stone_trim, the dock plaza + hill street + fort look)
# plus the detail the kit can't afford: a flagged deck (running-bond dressed flags round a cobble field, radial flags round the fountain),
# chamfered coping with drip lips, coursed + battered wall faces, stair nosings, quoins. VISUALS ONLY: walk decks + colliders stay in hillRound.js.
#   blender -b --factory-startup -P tools/roundabout_blender/rb_plaza_blender.py -- OUT_DIR  ->  OUT/rb_plaza_raw.glb (+ rb_plaza_report.json)
#   node tools/plaza_blender/pack_shops.mjs OUT/rb_plaza_raw.glb assets/island rb_plaza
import bpy, sys, os, math, json
from mathutils import Matrix
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'plaza_blender'))
from lib import Builder
argv = sys.argv[sys.argv.index('--') + 1:]; OUT = argv[0]; os.makedirs(OUT, exist_ok=True)
LAY = json.load(open(os.path.join(HERE, '..', '..', 'assets', 'island', 'rb_plaza_layout.json')))
OX, OY, OZ = LAY['origin']
bpy.ops.wm.read_factory_settings(use_empty=True)
C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # three (x, y, z) -> Blender (x, -z, y)
TRIM, ASH, DARK, COB = 0xd2c9b6, 0xb9b2a6, 0x8a837a, 0x9f9585
LIBK = {'deck': 'cobble', 'border': 'stone_trim', 'pcap': 'stone_trim', 'tcap': 'stone_trim', 'string': 'stone_trim', 'runner': 'stone_trim', 'tread_cap': 'stone_trim', 'coping': 'stone_trim', 'landing': 'cobble', 'apron': 'cobble', 'retain_band': 'stone_trim', 'pier_band': 'stone_trim', 'tower_band': 'stone_trim'}
def M3(e):
    m = Matrix([[e[c * 4 + r] for c in range(4)] for r in range(4)]); m[0][3] -= OX; m[1][3] -= OY; m[2][3] -= OZ; return m
class TB(Builder):
    def __init__(self): super().__init__(); self.stack = [C]
    def bx(self, w, h, d, m, col, lib):   # a box in the three frame (w x, h y, d z) at three matrix m
        self.push(m); self.box(w, d, h, 0, 0, 0, col, rx=math.pi / 2, mat=lib); self.pop()
def T3(x=0, y=0, z=0): return Matrix.Translation((x, y, z))
def tone(c, k):
    r, g, b = (c >> 16) & 255, (c >> 8) & 255, c & 255; f = 1 + k; return (min(255, int(r * f)) << 16) | (min(255, int(g * f)) << 8) | min(255, int(b * f))
def hsh(i, j): s = math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - math.floor(s)

def build(b, hi):
    for n, p in enumerate(LAY['pieces']):
        k, w, h, d, m = p['kind'], p['w'], p['h'], p['d'], M3(p['e'])
        lib = LIBK.get(k, 'stone_ashlar')
        if not hi and k in ('retain_band', 'pier_band', 'tower_band', 'plinth', 'string', 'runner'): continue   # ([v220] the phone LOD skips the small trims)
        if k == 'deck' and hi:
            # the deck: slab body, a cobble field, then running-bond dressed flags in two bands round the edge + a radial flag ring round the fountain
            b.bx(w, h, d, m, COB, 'stone_ashlar')
            b.bx(w - 2.2, 0.02, d - 2.2, m @ T3(0, h / 2 + 0.01, 0), 0xa59a88, 'cobble')
            fx = m[0][3]; fz = m[2][3]   # deck centre relative to the origin (the fountain is at 0, 0)
            for band in range(2):
                inset = 1.0 + band * 0.55; L = 0.9 + band * 0.2
                for side in range(4):
                    span = (w if side < 2 else d) - 2 * inset; nfl = max(1, int(span / L))
                    for i in range(nfl):
                        u = -span / 2 + (i + 0.5 + (0.5 if band else 0)) * span / nfl
                        if abs(u) > span / 2 - 0.1: continue
                        c = tone(0xc8bda7, (hsh(i, side + band * 4) - 0.5) * 0.12)
                        if side < 2: b.bx(span / nfl - 0.05, 0.05, 0.5, m @ T3(u, h / 2 + 0.02, (d / 2 - inset) * (1 if side else -1)), c, 'stone_trim')
                        else: b.bx(0.5, 0.05, span / nfl - 0.05, m @ T3((w / 2 - inset) * (1 if side == 3 else -1), h / 2 + 0.02, u), c, 'stone_trim')
            for ring, (r0, r1, nseg) in enumerate(((4.75, 6.3, 40), (6.3, 8.0, 56), (8.0, 9.4, 64))):
                for i in range(nseg):
                    a = (i + 0.5 * (ring % 2)) / nseg * 2 * math.pi; r = (r0 + r1) / 2; ww = 2 * math.pi * r / nseg - 0.05
                    c = tone(0xd2c9b6 if ring != 1 else 0xc0b59f, (hsh(i, ring + 9) - 0.5) * 0.12)
                    b.bx(ww, 0.05, r1 - r0 - 0.06, T3(math.sin(a) * r, 0.045, math.cos(a) * r) @ Matrix.Rotation(a, 4, 'Y'), c, 'stone_trim')
            for i in range(72):   # a dark kerb ring framing the fountain court
                a = (i + 0.5) / 72 * 2 * math.pi; b.bx(0.86, 0.12, 0.34, T3(math.sin(a) * 9.6, 0.06, math.cos(a) * 9.6) @ Matrix.Rotation(a, 4, 'Y'), DARK, 'stone_ashlar')
            continue
        b.bx(w, h, d, m, p['c'], lib)
        if not hi: continue
        if k == 'parapet':   # a chamfered coping cap + a drip lip on both faces (the kit's coping box is the next piece)
            for s in (-1, 1): b.bx(0.06, 0.06, d, m @ T3(s * 0.31, h / 2 - 0.02, 0), DARK, 'stone_trim')
            if n % 3 == 0: b.bx(0.54, 0.22, 0.12, m @ T3(0, -h / 2 + 0.25, d / 2 - 0.02), tone(ASH, -0.08), 'stone_ashlar')   # a tie stone at the base
        elif k == 'retain':   # coursed face: three set-back courses (batter) + a plinth
            for j, f in enumerate((0.0, 0.33, 0.66)):
                b.bx(w + 0.08 - j * 0.04, 0.05, d + 0.02, m @ T3(0, -h / 2 + 0.2 + f * h, 0), tone(DARK, 0.05), 'stone_trim')
            b.bx(w + 0.3, 0.35, d + 0.05, m @ T3(0, -h / 2 + 0.17, 0), DARK, 'stone_ashlar')
        elif k == 'tread_cap':   # a rounded nosing on every tread
            b.bx(w - 0.1, 0.05, 0.12, m @ T3(0, -0.02, -d / 2 + 0.04), tone(TRIM, 0.06), 'stone_trim')
        elif k in ('gpier', 'tower') and h > 2:   # quoins up the corners
            for y in range(int(h / 0.6)):
                for sx, sz in ((-1, -1), (1, 1)) if y % 2 else ((1, -1), (-1, 1)):
                    b.bx(0.3, 0.26, 0.3, m @ T3(sx * (w / 2 - 0.1), -h / 2 + 0.3 + y * 0.6, sz * (d / 2 - 0.1)), tone(TRIM, -0.05), 'stone_trim')
        elif k == 'apron':
            for s in (-1, 1): b.bx(0.25, h + 0.08, d, m @ T3(s * (w / 2 - 0.12), 0.04, 0), DARK, 'stone_trim')
        elif k == 'pilaster' and h > 2 and w < 0.5:   # [v220] the wall pilasters: alternating long/short quoins up both front corners + a drip course under the cap
            for y in range(int((h - 0.4) / 0.62)):
                lng = 0.34 if y % 2 else 0.22
                for sz in (-1, 1): b.bx(lng, 0.28, 0.2, m @ T3(w / 2 - lng / 2 + 0.03, -h / 2 + 0.35 + y * 0.62, sz * (d / 2 - 0.08)), tone(TRIM, -0.06 + 0.04 * (y % 2)), 'stone_trim')
        elif k == 'plinth':
            b.bx(w + 0.06, 0.08, d + 0.01, m @ T3(0.02, h / 2 - 0.02, 0), tone(TRIM, -0.1), 'stone_trim')   # a weathered top edge
        elif k == 'pier':
            if h > 3: b.bx(w + 0.2, 0.3, d + 0.2, m @ T3(0, h / 2 - 0.4, 0), TRIM, 'stone_trim')

LODS = [TB(), TB()]; build(LODS[0], True); build(LODS[1], False)
def mats():
    out = []
    for nm in ('rb_solid', 'rb_glow'):
        m = bpy.data.materials.new(nm); m.use_nodes = True; nt = m.node_tree; bs = nt.nodes['Principled BSDF']
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; nt.links.new(ca.outputs['Color'], bs.inputs['Base Color']); bs.inputs['Roughness'].default_value = 0.85
        out.append(m)
    return out
MATS = mats(); coll = bpy.data.collections.new('rb'); bpy.context.scene.collection.children.link(coll)
root = bpy.data.objects.new('rb_plaza', None); coll.objects.link(root); REP = {}
for lod, bd in enumerate(LODS):
    me = bd.bake(f'rb_plaza_LOD{lod}'); me.validate(clean_customdata=False)
    for m in MATS: me.materials.append(m)
    o = bpy.data.objects.new(f'rb_plaza_LOD{lod}', me); coll.objects.link(o); o.parent = root; REP[f'LOD{lod}'] = bd.tris()
json.dump(REP, open(os.path.join(OUT, 'rb_plaza_report.json'), 'w'), indent=1)
for ob in bpy.data.objects: ob.select_set(True)
f = os.path.join(OUT, 'rb_plaza_raw.glb')
kw = dict(filepath=f, export_format='GLB', use_selection=True, export_extras=True, export_apply=False, export_yup=True)
try: bpy.ops.export_scene.gltf(**kw, export_vertex_color='MATERIAL')
except TypeError: bpy.ops.export_scene.gltf(**kw)
print('EXPORTED', f, os.path.getsize(f), 'TRIS', json.dumps(REP))
if len(argv) > 1 and argv[1] == 'preview':
    # quick Eevee/workbench previews of LOD0 (vertex colours), 3 views
    lo1 = bpy.data.objects['rb_plaza_LOD1']; lo1.hide_render = True
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.color_type = 'VERTEX'; sc.display.shading.light = 'STUDIO'
    sc.display.shading.show_shadows = True; sc.display.shading.show_cavity = True; sc.render.resolution_x, sc.render.resolution_y = 1400, 900
    w = bpy.data.worlds.new('w'); sc.world = w
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); coll.objects.link(cam); sc.camera = cam; cam.data.lens = 28; cam.data.clip_end = 2000
    from mathutils import Vector
    def look(pos, tgt, name):
        cam.location = Vector(pos); d = Vector(tgt) - Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(OUT, name); bpy.ops.render.render(write_still=True)
    # Blender coords: x = three x - OX, y = -(three z - OZ), z = three y - OY
    look((0, 0, 60), (0, 0.01, 0), 'pv_overhead.png')
    look((-24, 0, 4), (6, 0, 0), 'pv_from_street.png')
    look((-10, -16, 6), (-8, 8, 0), 'pv_castle_side.png')
    look((-6, 26, 2), (2, 2, -4), 'pv_path_down.png')
    look((20, 8, 6), (0, 0, 0), 'pv_bridge_head.png')
