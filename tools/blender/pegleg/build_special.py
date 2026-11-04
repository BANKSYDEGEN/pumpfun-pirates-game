# build_special.py -- item side who lod [repo] : a SPECIAL peg built natively on Raul's v5 peg fit (pegfit.py): the fitted knee sleeve in the
# item's palette (pegfit.PAL[item]) + the item's own shaft / ornaments / tip, rigid on shin.X. [Raul pegs 2]
#   peg_ghost              : the GHOST BONE PEG (carved bone vertebra shaft, carved skull, ghost-green glow trim = pegfit.GLOW, lit in game by js/pirateItems.js glow)
#   peg_gold / peg_kraken  : their v178 shafts ported 1:1 (same shapes + colours, seated exactly where refit_special.py put them), so the PHONE
#                            (lo) files can be rebuilt with fewer segments. Desktop (hi) files stay the refit_special.py ones (not rebuilt here).
# /opt/blender/blender -b -P build_special.py -- peg_ghost l male hi /workspace/raul-pegs-2
import sys, os, math, json, numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import pegfit as pf
from geo import *
A = sys.argv[sys.argv.index('--') + 1:]; item, sd, who, lod = A[:4]; WT = A[4] if len(A) > 4 else '/workspace/raul-pegs-2'
HI = lod == 'hi'; RES = 1.0 if HI else 0.4; sx = 1 if sd == 'l' else -1
b = pf.Body(who, lod, WT); F = b.fit(sd)
K = np.array(F['knee']); kz = K[2]; TIP = np.array(F['tip'])
def rest_parts(item, lo):
  P_ = []
  if item == 'peg_ghost':
    seg = (lambda n: max(5, int(round(n * 0.42)))) if lo else (lambda n: max(6, int(round(n))))
    BN, BND, GRV, GL = lin('#ece3cc'), lin('#b9ab88'), lin('#3a3226'), lin(pf.GLOW)
    T0 = np.array([K[0], K[1], F['shaft_top']])
    # vertebra shaft: a bone tube with 5 knuckles (wavy radius), thicker knob at the top and the foot
    n = 13 if lo else 21; t = np.linspace(0, 1, n); P = [T0 + (TIP + np.array([0, 0, 0.03]) - T0) * u for u in t]
    r = 0.025 - 0.004 * t + 0.0045 * np.abs(np.sin(t * math.pi * 5)) ** 1.5; r[0] = 0.031
    P_.append(tube(P, r, BN, seg(12)))
    # 3 glowing rune bands (thin, unlit-bright rings) between the knuckles
    for u in ((0.4, 0.8) if lo else (0.2, 0.4, 0.6, 0.8)):
      q = T0 + (TIP + np.array([0, 0, 0.03]) - T0) * u; P_.append(torus(q, 0.0255 - 0.004 * u, 0.0042, [0, 0, 1], GL, seg(12), seg(4) if not lo else 4, outline=False))
    # the carved skull on the front, just under the cup, ghost-green eye sockets + carved jaw
    sk = T0 + (TIP - T0) * 0.3 + np.array([0, -0.026, 0])   # [Raul items redo] clear of the tapered socket
    P_.append(ellipsoid(sk, [0.03, 0.026, 0.032], BN, seg(11), seg(7)))
    P_.append(ellipsoid(sk + np.array([0, -0.006, -0.028]), [0.019, 0.017, 0.011], BND, seg(10) if not lo else 5, seg(5) if not lo else 3, outline=not lo))
    for e2 in (1, -1): P_.append(ellipsoid(sk + np.array([e2 * 0.011, -0.024, 0.005]), [0.0085, 0.004, 0.0085], GL, seg(8) if not lo else 5, seg(5) if not lo else 3, outline=False))
    P_.append(ellipsoid(sk + np.array([0, -0.026, -0.007]), [0.004, 0.003, 0.005], GRV, 5, 3, outline=False))   # nose hole
    if not lo:   # scrimshaw: carved grooves running down the bone between the knuckles (desktop only)
      for a in (0.6, 2.2, 3.8, 5.4):
        d = np.array([math.cos(a), math.sin(a), 0]); G = [T0 + (TIP - T0) * u + d * (0.0262 - 0.004 * u + 0.0045 * abs(math.sin(u * math.pi * 5)) ** 1.5) for u in np.linspace(0.3, 0.92, 7)]
        P_.append(tube(G, 0.0016, GRV, 4, outline=False))
    # foot: bone knob + a glowing ring at the floor
    P_.append(ellipsoid(TIP + np.array([0, 0, 0.016]), [0.028, 0.028, 0.017], BND, seg(12), seg(6)))
    P_.append(torus(TIP + np.array([0, 0, 0.033]), 0.025, 0.0045, [0, 0, 1], GL, seg(14), seg(5) if not lo else 4, outline=False))
    return P_
  # ---- the v178 special pegs (raul_shop_items_2/tools/build.py, seated by refit_special.py: old shaft top = knee - 5 cm)
  seg = (lambda n: max(4, int(round(n * 0.34)))) if lo else (lambda n: max(6, int(round(n))))
  T0 = np.array([K[0], K[1], F['shaft_top']])   # [Raul items redo] peg polish: seated at the tapered socket's neck (hi + lo both built here now)
  if item == 'peg_gold':
    G1, G2, RUBY = lin('#f2c230'), lin('#c88a16'), lin('#d8162c')
    P = [T0 + (TIP + np.array([0, 0, 0.02]) - T0) * u for u in np.linspace(0, 1, 3 if lo else 7)]; P_.append(tube(P, np.linspace(0.034, 0.02, len(P)), G1, 6 if lo else seg(12)))
    for u in ((0.18, 0.62) if lo else (0.18, 0.62, 0.92)): q = T0 + (TIP - T0) * u; P_.append(torus(q, 0.034 - 0.014 * u, 0.007, [0, 0, 1], G2, 7 if lo else seg(16), 3 if lo else 5, outline=not lo))   # phone: the foot cap stands in for the 3rd band
    sk = T0 + (TIP - T0) * 0.4 + np.array([0, -0.03, 0])
    P_.append(ellipsoid(sk, [0.032, 0.028, 0.034], G1, 7 if lo else seg(14), 4 if lo else seg(9))); P_.append(ellipsoid(sk + np.array([0, -0.008, -0.03]), [0.02, 0.018, 0.012], G2, 5 if lo else seg(10), 3 if lo else seg(6), outline=not lo))
    for e2 in (1, -1): P_.append(ellipsoid(sk + np.array([e2 * 0.012, -0.026, 0.004]), [0.008, 0.004, 0.008], RUBY, 4 if lo else seg(8), 2 if lo else seg(5), outline=False))
    P_.append(ellipsoid([TIP[0], TIP[1], 0.012], [0.026, 0.026, 0.012], G2, 6 if lo else seg(12), 3 if lo else seg(5)))
  elif item == 'peg_kraken':
    BN, KR, SUCK = lin('#efe6cf'), lin('#7a3fb0'), lin('#f0c6d8')
    nP = 4 if lo else 7; P = [T0 + (TIP + np.array([0, 0, 0.03]) - T0) * u for u in np.linspace(0, 1, nP)]
    rr = np.interp(np.linspace(0, 1, nP), np.linspace(0, 1, 7), [0.03, 0.024, 0.022, 0.022, 0.024, 0.026, 0.03]); P_.append(tube(P, rr, BN, 6 if lo else seg(12)))
    for e2 in (1, -1): P_.append(ellipsoid([TIP[0] + e2 * 0.018, TIP[1], TIP[2] + 0.035], [0.022, 0.024, 0.022], BN, 5 if lo else seg(10), 3 if lo else seg(6)))
    nk = 12 if lo else 26; sp = []
    for k in range(nk):
      u = k / (nk - 1); q = T0 + (TIP - T0) * u; a = u * math.pi * 4.2; sp.append(q + np.array([math.cos(a) * 0.031, math.sin(a) * 0.031, 0]))   # [Raul items redo] hugs the bone shaft (was 0.036: a loose coil)
    sp += [TIP + np.array([0.05 * sx, -0.045, 0.02]), TIP + np.array([0.065 * sx, -0.07, 0.05])]
    rad = np.r_[np.linspace(0.0145, 0.009, nk), [0.007, 0.0045]]; P_.append(tube(sp, rad, KR, 5 if lo else seg(10)))
    for k in range(2, nk, 3): u = k / (nk - 1); P_.append(ellipsoid(sp[k] + (sp[k] - (T0 + (TIP - T0) * u)) * 0.42, [0.007, 0.007, 0.007], SUCK, 4 if lo else seg(6), 2 if lo else seg(4), outline=False))
  else: raise SystemExit('unknown special peg ' + item)
  return P_
pal = pf.PAL[item]
m, rigid = pf.build(b, F, pf.sleeve_parts(b, F, pal, RES), rest_parts(item, not HI), 0.0035 if HI else 0.006)
if not HI: m = pf.lowlight(m, keep=[lin(pf.GLOW)])
W = b.weights(m.V, F, rigid)
ob = pf.to_blender(b, m, f'{item}_{sd}_{who}_{lod}', W); ob['pegfit'] = json.dumps(dict(knee=F['knee'], shaft_top=F['shaft_top'], native=True))
fn = f'{WT}/assets/pirates/items/v5/{item}_{sd}_{who}_{lod}.glb'; pf.export(b, ob, fn, extras=True)
print('BUILT', item, sd, who, lod, 'tris', len(m.F), 'sleeve+ink', int((~rigid[m.F].all(1)).sum()), 'kb', os.path.getsize(fn) // 1024)
