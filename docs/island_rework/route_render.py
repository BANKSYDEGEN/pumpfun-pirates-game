# route + fort plan map (foot frame, north = -z up). python3 route_render.py
import json, math; from PIL import Image, ImageDraw, ImageFont
d = json.load(open('dump.json')); g = d['grid']; B = g['B']; S = g['S']; nx = g['nx']; H = d['H']; A = d['trails']['A']
def h(x, z):
  fx, fz = (x - B['x0']) / S, (z - B['z0']) / S; i, j = int(fx), int(fz); u, v = fx - i, fz - j
  q = lambda a, b: H[b * nx + a]
  return (q(i, j) * (1 - u) + q(i + 1, j) * u) * (1 - v) + (q(i, j + 1) * (1 - u) + q(i + 1, j + 1) * u) * v
X0, X1, Z0, Z1, K = -620, 80, -500, -10, 1.7
W, Hh = int((X1 - X0) * K), int((Z1 - Z0) * K)
P = lambda x, z: ((x - X0) * K, (z - Z0) * K)
img = Image.new('RGB', (W, Hh + 260), '#efe3c4'); px = img.load()
for py in range(Hh):
  for pxx in range(W):
    x, z = X0 + pxx / K, Z0 + py / K; y = h(x, z); dx = h(x + 2, z) - h(x - 2, z); dz = h(x, z + 2) - h(x, z - 2)
    sh = max(0.45, min(1.25, 1 - (dx * 0.6 + dz * 0.4) * 0.12))
    base = (70, 120, 170) if y < 0.5 else (196, 186, 140) if y < 4 else (120 + int(y), 150 - int(y * .6), 80) if y < 60 else (150, 140, 120)
    c = tuple(max(0, min(255, int(v * sh))) for v in base)
    if abs((y % 5) - 2.5) > 2.35 and y > 0.5: c = tuple(int(v * .78) for v in c)
    px[pxx, py] = c
D = ImageDraw.Draw(img, 'RGBA')
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15); f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 12); FT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
except: F = f = FT = ImageFont.load_default()
def lab(x, z, t, dx=8, dy=-8, fn=None, col='#111'):
  a, b = P(x, z); fn = fn or f; bb = D.textbbox((a + dx, b + dy), t, font=fn); D.rectangle([bb[0] - 3, bb[1] - 2, bb[2] + 3, bb[3] + 2], fill=(250, 244, 225, 225)); D.text((a + dx, b + dy), t, fill=col, font=fn)
def rect(r, col, w=2, fill=None): a = P(r[0], r[2]); b = P(r[1], r[3]); D.rectangle([min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])], outline=col, width=w, fill=fill)
T = lambda lx, lz: (-lz - 640, lx - 90)
def TR(lx0, lx1, lz0, lz1): xs = [T(lx0, lz0)[0], T(lx1, lz1)[0]]; zs = [T(lx0, lz0)[1], T(lx1, lz1)[1]]; return [min(xs), max(xs), min(zs), max(zs)]
# areas + exclusions
rect([-295, -115, -265, -55], (40, 110, 200, 255), 2, (40, 110, 200, 30)); lab(-290, -100, 'AREA 4 · FRESHWATER LAGOON (built v150)', 4, 4)
rect([0, 260, -490, -215], (30, 120, 50, 255), 2, (30, 120, 50, 30)); lab(10, -232, 'AREA 1 · JUNGLE (v151)', 4, 4)
rect(TR(-128, -80, -164, -124), (200, 30, 30, 255), 2, (200, 30, 30, 60)); lab(*T(-80, -124), 'musket range (Timothy) - avoid', 4, -2, col='#a00')
rect(TR(-176, 100, -56, 66), (200, 30, 30, 255), 3, (200, 30, 30, 40)); lab(-618, -40, "Timothy's PLAZA v2 (lz -56 edge)", 4, -2, col='#a00')
rect(TR(-55, 100, -90, -56), (200, 30, 30, 200), 1, (200, 30, 30, 30))
# trail A + B
AA = [(p[0], p[1]) for p in A]; acc = [0]
for i in range(1, len(AA)): acc.append(acc[-1] + math.dist(AA[i], AA[i - 1]))
D.line([P(*p) for p in AA], fill=(120, 80, 40, 120), width=3); D.line([P(*p) for p in d['trails']['B']], fill=(120, 80, 40, 90), width=2)
seg = [p for p, a in zip(AA, acc) if a <= 567] + [(4.7, -395.9)]
# grade-coded route (gate -> trailhead): < 8% path, 8-16% ramped path + edging, > 16% stone steps
def gcol(gr): return (230, 200, 90, 255) if gr < .08 else (240, 140, 40, 255) if gr < .16 else (200, 40, 40, 255)
steps = []
for i in range(1, len(seg)):
  a, b = seg[i - 1], seg[i]; L = math.dist(a, b) or 1; gr = abs(h(*b) - h(*a)) / L; D.line([P(*a), P(*b)], fill=gcol(gr), width=7)
  if gr >= .16: steps.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, gr))
# main street (lx 6, lz -56 -> -205): plaza join held for Timothy = first 8 m
ms0, ms1, msj = T(6, -56), T(6, -205), T(6, -64)
D.line([P(*ms0), P(*msj)], fill=(255, 255, 255, 255), width=10); D.line([P(*msj), P(*ms1)], fill=(150, 150, 160, 255), width=10)
for t in range(0, 141, 12): x, z = T(6, -64 - t); a, b = P(x, z); D.line([a, b - 7, a, b + 7], fill=(60, 60, 70, 255), width=2)
lab(*ms0, 'R0 plaza join (first 8 m) - WAITS for timothy/plaza-blender edge coords + height', 6, 10, col='#a00')
lab(*T(6, -130), 'R1 PIRATES\' STAIR: Main Street rebuilt as stone flights + landings every 12 m,', -150, -44); lab(*T(6, -130), 'curbs, retaining walls, lamp posts every 16 m, 2 benches', -150, -29)
# lamps every 30 m along the route
for a in range(0, 567, 30):
  for i in range(1, len(AA)):
    if acc[i] >= a: t = (a - acc[i - 1]) / (acc[i] - acc[i - 1]); x = AA[i - 1][0] + (AA[i][0] - AA[i - 1][0]) * t; z = AA[i - 1][1] + (AA[i][1] - AA[i - 1][1]) * t; c = P(x, z); D.ellipse([c[0] - 4, c[1] - 4, c[0] + 4, c[1] + 4], fill=(255, 210, 60, 255), outline='#333'); break
# landmarks (along trail A from the gate)
LM = [(0, 'GATE PLAZA: fort branch + signpost (trail A / fort / town)'), (89, 'L1 STREAM FORD: stepping-stone ford + log bridge (low point y 7.5)'), (179, 'L2 SWITCHBACK STAIR (3 legs) + retaining log walls'),
      (268, 'L3 LAGOON OVERLOOK: railing deck, view down to the falls'), (450, 'L4 RIDGE VIEW (y 36 high point): stone seat, harbor + Skull Peak view'), (538, 'L5 RUIN STEPS: old temple stair down, mossy pillars'), (566, 'TRAILHEAD (locked)')]
for a, t in LM:
  for i in range(1, len(AA)):
    if acc[i] >= a: x, z = AA[i]; c = P(x, z); D.polygon([(c[0], c[1] - 9), (c[0] + 8, c[1] + 6), (c[0] - 8, c[1] + 6)], fill=(30, 30, 30, 255)); lab(x, z, t, 10, -18 if a not in (179, 538) else 6); break
th = (4.7, -395.9); c = P(*th); D.ellipse([c[0] - 8, c[1] - 8, c[0] + 8, c[1] + 8], outline=(255, 0, 200, 255), width=3)
# fort
fx, fz = -408, -44; rect([fx - 13, fx + 13, fz - 13, fz + 13], (40, 40, 40, 255), 3, (180, 175, 165, 230)); rect([fx - 7, fx + 7, fz - 7, fz + 7], (40, 40, 40, 255), 2, (120, 115, 110, 255))
legs = [((-432, -73), (-394, -73)), ((-394, -73), (-394, -67)), ((-394, -67), (-426, -67)), ((-426, -67), (-426, -61)), ((-426, -61), (-408, -61)), ((-408, -61), (-408, -57))]
for a, b in legs: D.line([P(*a), P(*b)], fill=(130, 60, 200, 255), width=6)
lab(fx, fz, 'C · HILLTOP FORT (CO.FORT, top y 36): walk-in courtyard', 30, 6, F); lab(fx, fz, 'keep war room · ramparts · cannon drill (see inset)', 30, 26)
lab(-394, -73, 'switchback ramp, 3 legs 20 -> 36 m (~13 % grade)', 30, 14, col='#5a1e9a')
# digs
for s in d['digs']:
  x, z = s['x'], s['z']
  if X0 < x < X1 and Z0 < z < Z1: c = P(x, z); D.line([c[0] - 6, c[1] - 6, c[0] + 6, c[1] + 6], fill='red', width=3); D.line([c[0] - 6, c[1] + 6, c[0] + 6, c[1] - 6], fill='red', width=3); lab(x, z, s['id'] + ('' if s.get('active', True) else ' (OFF)'), 6, 2, col='#a00')
D.text((12, 10), 'ROUTE + HILLTOP FORT PLAN · plaza gap > Main St > gate > trail A > jungle trailhead', fill='#111', font=FT)
# legend + inset
y0 = Hh + 12; D.text((12, y0), 'route grade:', fill='#111', font=F)
for i, (cc, t) in enumerate([((230, 200, 90), '< 8 %: edged path'), ((240, 140, 40), '8-16 %: ramp + retaining edge'), ((200, 40, 40), '> 16 %: stone/timber steps'), ((255, 210, 60), 'lamp post every 30 m'), ((150, 150, 160), 'R1 Main Street flights'), ((255, 255, 255), 'R0 held for Timothy'), ((130, 60, 200), 'fort switchback ramp')]):
  D.rectangle([14, y0 + 26 + i * 22, 40, y0 + 40 + i * 22], fill=cc, outline='#333'); D.text((48, y0 + 24 + i * 22), t, fill='#111', font=f)
# fort inset (plan, 1 m = 6 px)
ox, oy, s6 = 420, y0 + 10, 6
def R(x0, z0, x1, z1, fill, out='#222'): D.rectangle([ox + (x0 + 16) * s6, oy + (z0 + 16) * s6, ox + (x1 + 16) * s6, oy + (z1 + 16) * s6], fill=fill, outline=out)
R(-13, -13, 13, 13, (225, 215, 190)); 
for (a, b, c2, e) in [(-13, -13, 13, -11.4), (-13, 11.4, 13, 13), (-13, -13, -11.4, 13), (11.4, -13, 13, 13)]: R(a, b, c2, e, (150, 145, 135))
R(-2.5, -13.5, 2.5, -10.5, (200, 170, 120)); R(-7, -7, 7, 7, (110, 105, 100)); R(-1.5, -7.2, 1.5, -6.2, (60, 40, 20))
for sx in (-1, 1):
  for sz in (-1, 1): cx, cz = ox + (sx * 13 + 16) * s6, oy + (sz * 13 + 16) * s6; D.ellipse([cx - 20, cz - 20, cx + 20, cz + 20], fill=(160, 155, 145), outline='#222')
for (a, b, c2, e) in [(-11.4, 6, -9, 11.4), (9, -11.4, 11.4, -6)]: R(a, b, c2, e, (190, 150, 90))
D.text((ox, oy - 2), 'INSET · HILLTOP FORT (N up)', fill='#111', font=F)
notes = ['gatehouse (N wall, open arch, portcullis up)', 'courtyard 22x22 m walkable at y 36: well, flag mast, crates', 'keep: walk-in WAR ROOM (map table shows YOUR map X)', '2 stone stairs (NW, SE) -> rampart walk y 43 all round', '4 round towers: lookout tops, spyglass on NE', 'cannon drill: 4 rampart cannons vs sea targets (cosmetic)', 'cellar trapdoor -> QUARTERMASTER\'S VAULT chest (cosmetic)', 'Mossbeard journal page 5 + idol shard 8 hidden here']
for i, t in enumerate(notes): D.text((ox + 200, oy + 20 + i * 19), '· ' + t, fill='#111', font=f)
img.save('/workspace/pfp-island-plan/route_castle_map.png'); print(W, Hh + 260, 'steps', [(round(a), round(b), round(c, 2)) for a, b, c in steps])
