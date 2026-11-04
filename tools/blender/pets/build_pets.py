# [Raul items redo 2] PUMPFUN PIRATES ground PETS (BANKSY 10:36 AM 2026-11-04: "have the cat and monkey follow you around like crew does",
# "make monkey bigger"; 10:53 AM: + chimp, black gorilla, white gorilla). Compact chibi toon animals standing on the ground.
# blender -b -P build_pets.py -- <male|female> <hi|lo> <pet_cat|pet_cat_black|pet_monkey|pet_chimp|pet_gorilla|pet_gorilla_white>
#   -> assets/pirates/items/v5/<id>_<who>_<lod>.glb : ONE mesh skinned 100% to bone 'root', standing on the floor at the captain's LEFT
#      (bind space). That copy is what the shop card, the ship deck (sits by the wheel) and a pirate with no follower show.
#      On foot js/onfoot/pets.js draws a free copy (origin = PET_RIG[id].anchor) that follows you.
#   TEXCOORD_0 = the procedural rig: u = part (0 body, 1 head, 2 tail, 3 / 4 front limbs L / R, 5 / 6 back legs L / R), v = 0..1 along the
#   limb / tail from its pivot. The pivots go to js/petRig.js (written by: build_pets.py -- rig), the motion is a vertex-shader layer
#   (js/pirateItems.js PET layer, driven by js/petMotion.js): walk / run / sit / groom / hop / knuckle-walk / chest-beat.
import bpy, sys, os, math, json, numpy as np
sys.path.insert(0, os.environ.get('PYLIBS', '/workspace/raul_items_redo_work/py311'))
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE + '/../boots'); from bootgeo import *
WT = os.environ.get('WT', os.path.abspath(HERE + '/../../..')); OUT = f'{WT}/assets/pirates/items/v5'
A = np.array
# ---------------------------------------------------------------- species (Blender: x = the pet's left, front = -y, z up; origin = floor under it)
def ape(s, lean=1.0, limb=1.0, ears=0.0, hump=1.0):   # knuckle-walking great ape, s = scale (gorilla = 1: ~0.78 m to the crest)
  S = lambda v: A(v, float) * s
  return dict(
    body=[('el', S([0, -0.05, 0.48]), S([0.21, 0.15 * lean, 0.17])), ('el', S([0, 0.07, 0.33]), S([0.17, 0.13, 0.14]) * lean), ('el', S([0, -0.02, 0.585]), S([0.235 * hump, 0.12, 0.085 * hump]))],
    head=[('el', S([0, -0.17, 0.635]), S([0.105, 0.1, 0.105])), ('el', S([0, -0.255, 0.668]), S([0.095, 0.032, 0.026])), ('el', S([0, -0.13, 0.735]), S([0.05, 0.075, 0.045 * hump])),
          ('el', S([0, -0.258, 0.585]), S([0.072, 0.05, 0.052]))] + ([('el', S([sx * 0.112, -0.16, 0.64]), S([0.03, 0.022, 0.04]) * ears) for sx in (1, -1)] if ears else []),
    front=[[S([sx * 0.21, -0.08, 0.55]), S([sx * 0.25, -0.14, 0.3]), S([sx * 0.22, -0.185, 0.085])] for sx in (1, -1)], frad=S([0.075, 0.066, 0.058]) * limb,
    paw=('el', S([0, -0.005, -0.04]), S([0.062, 0.072, 0.046]) * limb),
    back=[[S([sx * 0.12, 0.12, 0.31]), S([sx * 0.155, 0.075, 0.155]), S([sx * 0.13, 0.12, 0.045])] for sx in (1, -1)], brad=S([0.078, 0.066, 0.05]) * limb,
    foot=('el', S([0, -0.035, -0.02]), S([0.055, 0.09, 0.026]) * limb),
    tail=None, neck=S([0, -0.12, 0.6]), eyes=dict(c=S([0.042, -0.252, 0.636]), r=0.019 * s), face=S([0, -0.25, 0.6]), sit=S([0, 0.1, 0.06]),
    lift=0.0)
SPECIES = {
  'cat': dict(
    body=[('el', A([0, 0.0, 0.13]), A([0.066, 0.125, 0.062])), ('el', A([0, -0.075, 0.145]), A([0.06, 0.06, 0.06]))],
    head=[('el', A([0, -0.13, 0.215]), A([0.088, 0.078, 0.078])), ('el', A([0, -0.198, 0.193]), A([0.038, 0.024, 0.024])), ('el', A([0.048, -0.17, 0.198]), A([0.034, 0.03, 0.026])), ('el', A([-0.048, -0.17, 0.198]), A([0.034, 0.03, 0.026]))],
    ears=[[A([sx * 0.048, -0.12, 0.262]), A([sx * 0.055, -0.125, 0.31])] for sx in (1, -1)], erad=A([0.03, 0.005]),
    front=[[A([sx * 0.042, -0.08, 0.125]), A([sx * 0.042, -0.085, 0.07]), A([sx * 0.04, -0.088, 0.022])] for sx in (1, -1)], frad=A([0.03, 0.025, 0.022]),
    paw=('el', A([0, -0.008, -0.006]), A([0.026, 0.032, 0.017])),
    back=[[A([sx * 0.046, 0.08, 0.13]), A([sx * 0.048, 0.095, 0.07]), A([sx * 0.044, 0.09, 0.022])] for sx in (1, -1)], brad=A([0.036, 0.026, 0.022]),
    foot=('el', A([0, -0.008, -0.006]), A([0.026, 0.034, 0.017])),
    tail=[A([0, 0.115, 0.15]), A([0, 0.165, 0.17]), A([0, 0.205, 0.24]), A([0, 0.19, 0.31]), A([0, 0.16, 0.335])], trad=A([0.022, 0.02, 0.018, 0.016, 0.013]),
    neck=A([0, -0.1, 0.17]), eyes=dict(c=A([0.036, -0.196, 0.226]), r=0.021), face=A([0, -0.2, 0.2]), sit=A([0, 0.08, 0.04])),
  'monkey': dict(   # upright capuchin-ish, ~0.37 m: knee-to-hip on the captain
    body=[('el', A([0, 0.0, 0.17]), A([0.075, 0.064, 0.085])), ('el', A([0, 0.01, 0.115]), A([0.068, 0.06, 0.05]))],
    head=[('el', A([0, -0.012, 0.29]), A([0.08, 0.072, 0.074])), ('el', A([0, -0.07, 0.272]), A([0.05, 0.03, 0.036])), ('el', A([0.082, -0.005, 0.292]), A([0.026, 0.014, 0.03])), ('el', A([-0.082, -0.005, 0.292]), A([0.026, 0.014, 0.03])),
          ('el', A([0, 0.005, 0.355]), A([0.06, 0.05, 0.022]))],
    front=[[A([sx * 0.07, 0.0, 0.225]), A([sx * 0.1, -0.025, 0.14]), A([sx * 0.088, -0.05, 0.07])] for sx in (1, -1)], frad=A([0.028, 0.024, 0.021]),
    paw=('el', A([0, -0.006, -0.012]), A([0.024, 0.024, 0.026])),
    back=[[A([sx * 0.045, 0.015, 0.1]), A([sx * 0.062, -0.035, 0.062]), A([sx * 0.052, -0.02, 0.018])] for sx in (1, -1)], brad=A([0.034, 0.028, 0.023]),
    foot=('el', A([0, -0.022, -0.006]), A([0.026, 0.044, 0.016])),
    tail=[A([0, 0.06, 0.1]), A([0, 0.14, 0.075]), A([0, 0.205, 0.14]), A([0, 0.2, 0.235]), A([0, 0.155, 0.27]), A([0, 0.13, 0.235])], trad=A([0.022, 0.019, 0.017, 0.015, 0.013, 0.011]),
    neck=A([0, -0.005, 0.245]), eyes=dict(c=A([0.03, -0.077, 0.298]), r=0.018), face=A([0, -0.07, 0.29]), sit=A([0, 0.02, 0.06])),
  'chimp': ape(0.72, lean=0.9, limb=0.86, ears=1.0, hump=0.55),   # [11:39 AM] 0.6 -> 0.72: stays a step above the bigger monkey, top at the sash
  'tiger': None,   # filled below from the cat (bigcat)
  'gorilla': ape(1.0),
}
# [Raul items redo 2] BANKSY 11:39 AM "Also add a tiger pet": a chunky chibi big cat from the cat's proportions, ~the black gorilla's height
HC = A([0, -0.13, 0.215])   # the cat's head centre: the tiger's head is a touch bigger round it (chibi)
def bigcat(s, head=1.12, limb=1.32):
  C = SPECIES['cat']; S = lambda v: A(v, float) * s; Hd = lambda v: (HC + (A(v, float) - HC) * head) * s
  return dict(
    body=[('el', S(c) + A([0, 0, 0.012 * s]), S(r) * A([1.18, 1.02, 1.12])) for _, c, r in C['body']],
    head=[('el', Hd(c), A(r, float) * head * s * (A([1.08, 1.0, 1.0]) if i == 0 else A([1.15, 1.1, 1.05]))) for i, (_, c, r) in enumerate(C['head'])],
    ears=[[Hd(ch[0]), Hd(ch[0] + (ch[1] - ch[0]) * 0.5)] for ch in C['ears']], erad=A([0.03, 0.024]) * s,
    front=[[S(p) for p in ch] for ch in C['front']], frad=S(C['frad']) * limb,
    paw=('el', S(C['paw'][1]), S(C['paw'][2]) * limb * 1.12),
    back=[[S(p) for p in ch] for ch in C['back']], brad=S(C['brad']) * limb,
    foot=('el', S(C['foot'][1]), S(C['foot'][2]) * limb * 1.12),
    tail=[S(v) for v in ([0, 0.115, 0.15], [0, 0.19, 0.125], [0, 0.26, 0.085], [0, 0.31, 0.1], [0, 0.335, 0.16])], trad=S([0.024, 0.022, 0.02, 0.019, 0.018]),
    neck=S(C['neck']), eyes=dict(c=Hd(C['eyes']['c']), r=C['eyes']['r'] * s * 1.02), face=Hd(C['face']), sit=S(C['sit']), nose=Hd([0, -0.222, 0.205]), ts=s, hd=head)
def scaled(v, k):   # every point / radius of a species x k (floor stays at z = 0)
  if isinstance(v, np.ndarray): return v * k
  if isinstance(v, (list, tuple)): return type(v)(scaled(x, k) for x in v)
  if isinstance(v, dict): return {a: (b * k if a == 'r' else scaled(b, k)) for a, b in v.items()}
  return v
# [Raul items redo 2] BANKSY 11:39 AM: the monkey still read under the knee on foot -> x1.3 (head 0.49 m bind = 0.61 m drawn: from your knee
# up to the sash; the v5 hip JOINT, 0.40, sits at the crotch on this chibi body)
SPECIES['monkey'] = scaled(SPECIES['monkey'], 1.3)
SPECIES['tiger'] = bigcat(2.4)   # head 0.73 m, ear tips ~0.78 m = the black gorilla's crest
PETS = {
  'pet_cat': dict(sp='cat', fur='#e8883a', dark='#b0561c', light='#fff3e2', skin='#f29aa6', eye='#7fd04a', stripes=True, bud=(1500, 640)),
  'pet_cat_black': dict(sp='cat', fur='#1f1d25', dark='#0c0b10', light='#2b2a36', sheen='#5a6488', skin='#c76a80', eye='#ffd02a', bud=(1500, 640)),
  'pet_monkey': dict(sp='monkey', fur='#7c4a28', dark='#4e2c15', light='#f3d9b4', skin='#e9bf98', eye='#3a2412', bud=(1650, 700)),
  'pet_chimp': dict(sp='chimp', fur='#2c221d', dark='#140f0c', light='#3c302a', skin='#cfa07c', eye='#3a2412', bud=(1700, 720)),
  'pet_gorilla': dict(sp='gorilla', fur='#34323d', dark='#121117', light='#75727f', skin='#5a4e56', silver='#c3c7cf', crown='#5e3b2b', eye='#8f5220', bud=(1950, 800)),   # [pet textures] BANKSY 3:30 PM: strand-painted fur, auburn crown, clean silver saddle, leathery face
  'pet_tiger': dict(sp='tiger', fur='#f2861e', dark='#16100e', light='#fff6ea', skin='#e88e8c', eye='#ffc21a', bud=(2000, 820)),
  'pet_gorilla_white': dict(sp='gorilla', fur='#f0f2f8', dark='#9eabc6', light='#ffffff', skin='#4b4352', eye='#5cc8ff', gold=True, bud=(1950, 800)),   # [pet textures] icy-blue strand shadows
}
GAP = 0.04   # floor gap between the captain's left foot and the pet's side
def anchor(sp):   # where the bound copy stands: beside the captain's left foot (x = his left), a touch forward
  X = SPECIES[sp]; w = max([abs(c[0]) + r[0] for _, c, r in X['body']] + [abs(p[0]) + X['frad'][0] for ch in X['front'] for p in ch])
  return A([0.2 + w + GAP, -0.03, 0.0])
# ---------------------------------------------------------------- rig table -> js/petRig.js
def to3(v): return [round(float(v[0]), 4), round(float(v[2]), 4), round(float(-v[1]), 4)]   # Blender -> three (y up, front +z)
if sys.argv[-1] == 'rig':
  R = {}
  for pid, P in PETS.items():
    X = SPECIES[P['sp']]; hgt = max([c[2] + r[2] for _, c, r in X['body'] + X['head']])
    R[pid] = dict(kind=P['sp'], anchor=to3(anchor(P['sp'])), h=round(float(hgt), 3), neck=to3(X['neck']), sit=to3(X['sit']),
      tail=to3(X['tail'][0]) if X.get('tail') is not None else None, fl=to3(X['front'][0][0]), fr=to3(X['front'][1][0]), bl=to3(X['back'][0][0]), br=to3(X['back'][1][0]),
      flen=round(float(sum(np.linalg.norm(X['front'][0][k + 1] - X['front'][0][k]) for k in range(2))), 3))
  src = ('// [Raul items redo 2] GENERATED by tools/blender/pets/build_pets.py -- rig (do not edit by hand): the ground pets\' procedural rig.\n'
         '// three.js pet-local coords (y up, front +z, origin = the floor under the pet); anchor = where the bound copy stands in the captain\'s\n'
         '// bind space (beside his left foot). Pivots: neck, sit (rear on the floor), tail root, limb roots fl / fr (front L / R) bl / br (back L / R).\n'
         'export const PET_RIG = ' + json.dumps(R, separators=(', ', ': ')).replace('}, "', '},\n  "').replace('{"pet_cat"', '{\n  "pet_cat"') + ';\n')
  open(f'{WT}/js/petRig.js', 'w').write(src); print('RIG', list(R)); sys.exit(0)
who, lod, pid = sys.argv[-3:]; HI = lod == 'hi'; P = PETS[pid]; X = SPECIES[P['sp']]
bpy.ops.wm.read_factory_settings(use_empty=True)
before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=f'{WT}/assets/pirates/pirate_{who}_v5_hi.glb'); objs = [o for o in bpy.data.objects if o not in before]
arm = [o for o in objs if o.type == 'ARMATURE'][0]
# ---------------------------------------------------------------- the SDF
mins = []; maxs = []
for _, c, r in X['body'] + X['head']: mins.append(c - r); maxs.append(c + r)
for ch in X['front'] + X['back'] + X.get('ears', []) + ([X['tail']] if X.get('tail') is not None else []):
  for p in ch: mins.append(p - 0.08); maxs.append(p + 0.08)
lo = np.min(mins, 0) - 0.03; hi_ = np.max(maxs, 0) + 0.03; lo[2] = -0.012
H = float(max(c[2] + r[2] for _, c, r in X['body'] + X['head']))
STEP = max(0.0028, H / 150) if HI else max(0.0042, H / 95)
xs = np.arange(lo[0], hi_[0], STEP); ys = np.arange(lo[1], hi_[1], STEP); zs = np.arange(lo[2], hi_[2], STEP)
Xg, Yg, Zg = np.meshgrid(xs, ys, zs, indexing='ij'); G = (Xg, Yg, Zg, lo, STEP)
def el(c, r): return sd_ellipsoid(Xg - c[0], Yg - c[1], Zg - c[2], r[0], r[1], r[2])
def torus_sd(c, n, R, r):
  n = np.asarray(n, float); n /= np.linalg.norm(n); dx, dy, dz = Xg - c[0], Yg - c[1], Zg - c[2]; a = dx * n[0] + dy * n[1] + dz * n[2]
  rr = np.sqrt(np.maximum(dx * dx + dy * dy + dz * dz - a * a, 0)); return np.sqrt((rr - R) ** 2 + a * a) - r
def union(ds, k):
  out = ds[0]
  for d in ds[1:]: out = smin(out, d, k)
  return out
s = H / 0.36 if P['sp'] != 'cat' else 0.8   # blend radius scale
PART = {}
PART[0] = union([el(c, r) for _, c, r in X['body']], 0.03 * s)
PART[1] = union([el(c, r) for _, c, r in X['head']], 0.012 * s)
if X.get('ears'): PART[1] = smin(PART[1], union([sd_tube(Xg, Yg, Zg, ch, X['erad']) for ch in X['ears']], 0.004), 0.01)
if X.get('tail') is not None: PART[2] = sd_tube(Xg, Yg, Zg, bezier(X['tail'], 14), np.interp(np.linspace(0, 1, 14), np.linspace(0, 1, len(X['trad'])), X['trad']))
for k, ch in zip((3, 4), X['front']):
  PART[k] = smin(sd_tube(Xg, Yg, Zg, ch, X['frad']), el(ch[-1] + X['paw'][1], X['paw'][2]), 0.01 * s)
for k, ch in zip((5, 6), X['back']):
  PART[k] = smin(sd_tube(Xg, Yg, Zg, ch, X['brad']), el(ch[-1] + X['foot'][1], X['foot'][2]), 0.01 * s)
f = PART[0]
for k in (1, 2, 3, 4, 5, 6):
  if k in PART: f = smin(f, PART[k], (0.018 if k == 1 else 0.022 if k > 2 else 0.01) * s)
f = np.maximum(f, -Zg)   # flat soles on the floor
f = ndimage.gaussian_filter(f, 0.8)
parts = [('fur', f)]
# eyes: glossy toon eyes (own little meshes, sunk into the face)
E = X['eyes']; eyes = []
for sx in (1, -1):
  c = E['c'] * A([sx, 1, 1]); eyes.append(el(c, A([E['r'] * 1.0, E['r'] * 0.7, E['r'] * (1.25 if P['sp'] == 'cat' else 1.1)])))
parts.append(('eye', union(eyes, 0.001)))
gold = []
if P.get('gold'):   # the white gorilla: gold cuffs on both wrists + a gold hoop in the left ear (premium)
  for ch in X['front']:
    a, b = ch[1], ch[2]; c = a + (b - a) * 0.72; ax = (b - a) / np.linalg.norm(b - a)
    gold.append(torus_sd(c, ax, X['frad'][2] * 1.12, 0.012))
  gold.append(torus_sd(A([0.11, -0.16, 0.6]), A([1, 0, 0]), 0.022, 0.0055))
  parts.append(('gold', union(gold, 0.002)))
CLUMP = PART
def ear_d(V):   # distance to the nearest ear's centre line (cats / tiger)
  out = np.full(len(V), 9.0)
  for a, b in X.get('ears', []):
    ab = b - a; t = np.clip(((V - a) @ ab) / (ab @ ab), 0, 1); out = np.minimum(out, np.linalg.norm(V - (a + t[:, None] * ab), axis=1))
  return out
# ---------------------------------------------------------------- mesh, colours, rig uv
geo = []; BUD = dict(fur=P['bud'][0 if HI else 1], eye=(110 if HI else 48), gold=(320 if HI else 120))
for kind, fld in parts:
  _, _, V, Fc = mc_part(fld, G, kind, 1)
  V, Fc = decimate(V, Fc, BUD[kind]); N = vnormals(V, Fc)
  if kind == 'eye':
    C = []
    for v in V:
      sx = 1 if v[0] > 0 else -1; c = E['c'] * A([sx, 1, 1]); d = (v - c) / E['r']; fr = -d[1]   # facing out (front = -y)
      lat = math.hypot(d[0], d[2] * (0.55 if P['sp'] == 'cat' else 1))
      if fr < 0.2: C.append(COL('#140f10'))
      elif lat < 0.38 and (P['sp'] != 'cat' or abs(d[0]) < 0.2): C.append(COL('#08070a'))   # pupil (cats: a slit)
      elif lat < 0.82: C.append(COL(P['eye']) * (0.75 + 0.35 * (d[2] + 1) / 2))
      else: C.append(COL('#140f10'))
    C = np.array(C)
    for i, v in enumerate(V):   # the white glint, top outer
      sx = 1 if v[0] > 0 else -1; c = E['c'] * A([sx, 1, 1]) + A([sx * 0.35, -0.6, 0.45]) * E['r']
      if np.linalg.norm(v - c) < E['r'] * 0.36: C[i] = COL('#ffffff')
    geo.append(Part(V, Fc, C, True)); continue
  if kind == 'gold': geo.append(Part(V, Fc, shade('gold', V, Fc, COL('#f2b630'), 1.0), True)); continue
  ij = np.clip(np.round((V - lo) / STEP).astype(int), 0, np.array(Xg.shape) - 1)
  D = np.array([CLUMP[k][tuple(ij.T)] for k in sorted(CLUMP)]); keys = np.array(sorted(CLUMP))
  part = keys[np.argmin(D, 0)]
  up = np.clip(N[:, 2], 0, 1); nz = noise(V, 1.0 / max(s, 0.5)); fur, dark, light, skin = COL(P['fur']), COL(P['dark']), COL(P['light']), COL(P['skin'])
  k = (0.78 + 0.3 * up) * (1 + 0.06 * nz); C = fur * k[:, None]
  # fur clumps: a soft groove pattern (darker strokes) so it reads as fur, not a ball
  strokes = np.sin(V[:, 0] * 95 / s + V[:, 2] * 60 / s + 3 * nz) * np.sin(V[:, 1] * 80 / s - V[:, 2] * 40 / s)
  if P['sp'] == 'tiger': C = np.where((strokes > 0.55)[:, None], fur * 0.8 * (0.9 + 0.2 * up)[:, None], C)   # tiger: dark = stripe black, so its clumps are a deeper orange
  else: C = np.where((strokes > 0.55)[:, None], dark * (0.9 + 0.2 * up)[:, None] * 0.9 + fur * 0.1, C)
  fc = X['face']; dfa = np.linalg.norm((V - fc) / A([1.0, 0.7, 1.0]), axis=1)
  sp = P['sp']
  if sp == 'cat':
    if P.get('stripes'):   # ginger tabby stripes over the back / tail / legs, white muzzle + chest + paws
      st = (np.sin(V[:, 1] * 120 + np.sin(V[:, 0] * 40) * 2) > 0.35) & (V[:, 2] > 0.1) & (N[:, 2] > -0.2) & (part != 1)
      C = np.where(st[:, None], dark * k[:, None], C)
      wh = ((part == 1) & (V[:, 1] < -0.175) & (V[:, 2] < 0.215)) | ((part == 0) & (V[:, 1] < -0.09) & (V[:, 2] < 0.14) & (np.abs(V[:, 0]) < 0.04)) | (V[:, 2] < 0.03) | ((part == 2) & (np.linalg.norm(V - X['tail'][-1], axis=1) < 0.035))
      C = np.where(wh[:, None], light * (0.85 + 0.2 * up)[:, None], C)
      st2 = (part == 1) & (V[:, 2] > 0.245) & (np.sin(V[:, 0] * 160) > 0.5) & (V[:, 1] > -0.19); C = np.where(st2[:, None], dark * k[:, None], C)   # forehead M
    else:   # black cat: blue-grey sheen on the crests
      sh = np.clip(up * 0.8 + 0.25 * nz, 0, 1); C = C * (1 - 0.5 * sh[:, None]) + COL(P['sheen']) * 0.5 * sh[:, None]
    nose = np.linalg.norm(V - A([0, -0.222, 0.205]), axis=1) < 0.012; C = np.where(nose[:, None], skin, C)
    ear_in = (part == 1) & (ear_d(V) < X['erad'][0] * 1.25) & (N[:, 1] < -0.3) & (V[:, 2] > X['ears'][0][0][2]); C = np.where(ear_in[:, None], skin * 0.95, C)
  elif sp == 'tiger':   # orange coat, black stripes (back, flanks, legs, tail rings, forehead + cheeks), white muzzle / cheeks / belly / paws
    Vn = V / X['ts']; hc = HC + (Vn - HC) / X['hd']   # body coords in cat units; hc = head coords in the cat's head units
    tp = np.clip((Vn[:, 2] - 0.09) / 0.07, 0, 1)   # stripes: clean vertical bands from the spine, thinning down the flanks
    st = (np.sin(Vn[:, 1] * 105 + np.sin(Vn[:, 0] * 30) * 1.2 + 0.35 * nz) > 0.78 - 0.5 * tp) & (part != 1) & (part < 3) & (Vn[:, 2] > 0.085) & (N[:, 2] > -0.3)
    st |= (part >= 3) & (np.sin(Vn[:, 2] * 150 + 2 * nz) > 0.62) & (Vn[:, 2] > 0.05) & (np.abs(N[:, 1]) < 0.9)
    C = np.where(st[:, None], dark * (0.9 + 0.2 * up)[:, None], C)
    wh = ((part == 1) & (hc[:, 1] < -0.172) & (hc[:, 2] < 0.212)) | ((part == 1) & (np.abs(hc[:, 0]) > 0.035) & (hc[:, 1] < -0.14) & (hc[:, 2] < 0.2)) \
       | ((part == 0) & (((Vn[:, 2] < 0.105) & (N[:, 2] < -0.2)) | ((Vn[:, 1] < -0.09) & (np.abs(Vn[:, 0]) < 0.05) & (Vn[:, 2] < 0.16)))) | (Vn[:, 2] < 0.028)
    C = np.where(wh[:, None], light * (0.86 + 0.18 * up)[:, None], C)
    hs_ = (part == 1) & (((hc[:, 2] > 0.25) & (np.sin(hc[:, 0] * 170) > 0.55) & (hc[:, 1] > -0.2)) | ((np.abs(hc[:, 0]) > 0.075) & (np.sin(hc[:, 2] * 230) > 0.6) & (hc[:, 1] > -0.17)))
    C = np.where(hs_[:, None], dark * k[:, None], C)
    if X.get('tail') is not None: C = np.where(((part == 2) & (np.linalg.norm(V - X['tail'][-1], axis=1) < 0.03 * X['ts']))[:, None], dark, C)   # black tail tip
    nose = np.linalg.norm(V - X['nose'], axis=1) < 0.014 * X['ts']; C = np.where(nose[:, None], skin, C)
    ear_in = (part == 1) & (ear_d(V) < X['erad'][1] * 1.1) & (N[:, 1] < -0.3) & (V[:, 2] > X['ears'][0][0][2]); C = np.where(ear_in[:, None], skin * 0.9, C)
  elif sp == 'monkey':
    V0 = V; V = V / 1.3   # the colour masks are in the original monkey units
    face = (part == 1) & (V[:, 1] < -0.04) & (V[:, 2] < 0.335) & (V[:, 2] > 0.235); C = np.where(face[:, None], light * (0.86 + 0.18 * up)[:, None], C)
    ear = (part == 1) & (np.abs(V[:, 0]) > 0.075); C = np.where(ear[:, None], skin * 0.9, C)
    belly = (part == 0) & (V[:, 1] < -0.04) & (np.abs(V[:, 0]) < 0.045); C = np.where(belly[:, None], light * 0.85, C)
    hands = ((part >= 3) & (V[:, 2] < 0.05)); C = np.where(hands[:, None], skin * 0.85, C); V = V0
  else:   # apes: bare face / muzzle, chest (gorillas), fingers + soles; gorilla silverback; white gorilla icy fur
    hs = H / 0.78
    face = (part == 1) & (V[:, 1] < -0.215 * hs) & (V[:, 2] < 0.69 * hs) & (V[:, 2] > 0.545 * hs); C = np.where(face[:, None], skin * (0.85 + 0.25 * up)[:, None], C)
    if sp == 'gorilla':   # [pet textures] BANKSY 3:30 PM "work the pet textures": the fur is strand-painted into the vertex colours (no texture: TEXCOORD_0 is the rig)
      kf = (88 if HI else 46) / hs; wob = np.sin(V[:, 2] * 22 / hs + 2.2 * nz)
      st = 0.55 * np.sin(V[:, 0] * kf + V[:, 1] * kf * 0.55 + 1.4 * wob) + 0.45 * np.sin(V[:, 0] * kf * 0.6 - V[:, 1] * kf * 0.95 + V[:, 2] * 18 / hs + 3 * nz)   # hanging strands
      under = np.clip(-N[:, 2], 0, 1); ao = np.clip(V[:, 2] / (0.22 * hs), 0, 1)
      sh = (0.62 + 0.42 * up) * (0.8 + 0.2 * ao) * (1 - 0.3 * under) * (1 + 0.05 * nz)   # light from above, darker underside + near the floor
      C = dark + (fur - dark) * np.clip((sh - 0.32) / 0.62, 0, 1.15)[:, None]
      C = C + (light - C) * (np.clip(st, 0, 1) * (0.45 + 0.45 * up) * 0.85)[:, None]   # strand tips catch the light
      C = C + (dark - C) * (np.clip(-st, 0, 1) * 0.6)[:, None]   # the gaps between strands
      if P.get('crown'):   # auburn crown (lowland gorilla), broken up by the strands
        cr = np.clip((V[:, 2] - 0.69 * hs) / (0.06 * hs), 0, 1) * (part == 1) * np.clip(0.75 + 0.4 * st, 0, 1); C = C + (COL(P['crown']) * (0.75 + 0.35 * up)[:, None] - C) * cr[:, None]
      brow = face & (V[:, 2] > 0.648 * hs); muz = face & (V[:, 2] < 0.6 * hs)
      C = np.where(face[:, None], skin * (0.88 + 0.22 * up)[:, None], C); C = np.where(brow[:, None], skin * 0.62, C); C = np.where(muz[:, None], skin * (1.22 + 0.12 * up)[:, None], C)
      chest = (part == 0) & (V[:, 1] < -0.15) & (np.abs(V[:, 0]) < 0.13) & (V[:, 2] > 0.36) & (V[:, 2] < 0.56)
      for sx in (1, -1):   # the eye meshes sit flush inside the brow: paint the eyes into the face too (dark socket, iris, glint) so they read
        ec = E['c'] * A([sx, 1, 1]); de = np.linalg.norm((V - ec) / A([1.0, 1.6, 1.15]), axis=1) / E['r']; fr = (part == 1) & (N[:, 1] < -0.2)
        C = np.where((fr & (de < 1.5))[:, None], COL('#0e0b0d'), C); C = np.where((fr & (de < 0.95))[:, None], COL(P['eye']), C)
        C = np.where((fr & (np.linalg.norm(V - (ec + A([sx * 0.35, -0.5, 0.5]) * E['r']), axis=1) < E['r'] * 0.38))[:, None], COL('#ffffff'), C)
      C = np.where(chest[:, None], skin * ((0.8 + 0.28 * up) * np.where(np.abs(V[:, 0]) < 0.014, 0.72, 1.0))[:, None], C)   # leathery chest, pec split
    else:
      ears = (part == 1) & (np.abs(V[:, 0]) > 0.085 * hs); C = np.where(ears[:, None], skin * 0.9, C)
    hand = (part >= 3) & (V[:, 2] < 0.06 * hs); C = np.where(hand[:, None], skin * 0.8, C)
    if P.get('silver'):   # [pet textures] silver saddle: back + rump, a clean edge frayed by the strands, strand-shaded
      sb = np.clip((-0.02 * hs + V[:, 1]) / (0.1 * hs) + 0.3, 0, 1) * np.clip((V[:, 2] - 0.26 * hs) / (0.1 * hs), 0, 1) * (part == 0)
      sb = np.clip((sb - 0.35 + 0.3 * st) * 2.2, 0, 1) * (1 - under)
      C = C * (1 - sb[:, None]) + COL(P['silver']) * ((0.74 + 0.32 * up) * (0.9 + 0.12 * st))[:, None] * sb[:, None]
  # rig uv: u = part, v = along the limb
  vv = np.zeros(len(V))
  for kk, ch in ((3, X['front'][0]), (4, X['front'][1]), (5, X['back'][0]), (6, X['back'][1])):
    m = part == kk; L = sum(np.linalg.norm(ch[q + 1] - ch[q]) for q in range(2)); vv[m] = np.clip(np.linalg.norm(V[m] - ch[0], axis=1) / L, 0, 1)
  if X.get('tail') is not None:
    m = part == 2; tl = bezier(X['tail'], 30); cum = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(tl, axis=0), axis=1))])
    if m.any(): j = np.argmin(np.linalg.norm(V[m][:, None] - tl[None], axis=2), 1); vv[m] = cum[j] / cum[-1]
  pp = Part(V, Fc, C, True); pp.uv = np.stack([part.astype(float), vv], 1); geo.append(pp)
for pp in geo:
  if not hasattr(pp, 'uv'): pp.uv = np.tile([1.0, 0.0], (len(pp.V), 1))   # eyes + the ear hoop ride the head; cuffs: fixed below
if P.get('gold'):   # cuffs ride their arm
  g = geo[-1]
  for i, v in enumerate(g.V):
    if v[2] < 0.5: g.uv[i] = [3.0 if v[0] > 0 else 4.0, float(np.clip(np.linalg.norm(v - X['front'][0 if v[0] > 0 else 1][0]) / sum(np.linalg.norm(X['front'][0][q + 1] - X['front'][0][q]) for q in range(2)), 0, 1))]
# ink shell (finish) keeps vertex order per part: rebuild the uv list in the same order
m = finish(geo, ink=(0.0035 if HI else 0.0055) * max(1, s * 0.7), lowlight=not HI)
UV = []
for pp in geo: UV.append(pp.uv); UV.append(pp.uv) if pp.outline else None
UV = np.vstack(UV); assert len(UV) == len(m.V), (len(UV), len(m.V))
m.V = m.V + anchor(P['sp'])
me = bpy.data.meshes.new(f'{pid}_{who}_{lod}'); me.from_pydata(m.V.tolist(), [], m.F.tolist()); me.update()
for p_ in me.polygons: p_.use_smooth = True
ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); ca.data.foreach_set('color', np.hstack([m.C, np.ones((len(m.C), 1))]).astype(np.float32).ravel()); me.color_attributes.active_color = ca
ul = me.uv_layers.new(name='rig'); li = np.zeros(len(me.loops), int); me.loops.foreach_get('vertex_index', li)
uvl = UV[li].copy(); uvl[:, 1] = 1 - uvl[:, 1]; ul.data.foreach_set('uv', uvl.astype(np.float32).ravel())   # glTF flips v back
mat = bpy.data.materials.new(pid); mat.use_nodes = True; nt = mat.node_tree; vc = nt.nodes.new('ShaderNodeVertexColor'); vc.layer_name = 'Color'
nt.links.new(vc.outputs[0], nt.nodes['Principled BSDF'].inputs['Base Color']); me.materials.append(mat)
ob = bpy.data.objects.new(me.name, me); bpy.context.scene.collection.objects.link(ob); ob.parent = arm
md = ob.modifiers.new('Armature', 'ARMATURE'); md.object = arm; vg = ob.vertex_groups.new(name='root'); vg.add(list(range(len(m.V))), 1.0, 'REPLACE')
for o in list(bpy.data.objects):
  if o not in (ob, arm): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); arm.select_set(True)
os.makedirs(OUT, exist_ok=True); fn = f'{OUT}/{pid}_{who}_{lod}.glb'
bpy.ops.export_scene.gltf(filepath=fn, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_yup=True, export_texcoords=True,
                          export_vertex_color='ACTIVE', export_attributes=False, export_materials='EXPORT')
print('BUILT', pid, who, lod, 'tris', len(m.F), 'verts', len(m.V), 'kb', os.path.getsize(fn) // 1024, 'h', round(H, 3), 'anchor', anchor(P['sp']).round(3).tolist())
