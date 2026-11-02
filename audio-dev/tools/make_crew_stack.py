# Round 3: crew voice stacking demo. 'Fire!' at crew size 1, 3 and 6.
# Each extra voice is a different real take (or a re-used take detuned further), offset 20-80 ms, detuned +-1-3 %,
# panned across the deck, -0..-4 dB, with a touch more deck room as the crowd grows. The bus is gain-compensated
# (+3 LU from 1 to 6 voices instead of +8) so a big crew sounds bigger, not just louder.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp, make_cannon3 as M3, make_ab as AB
from dsp import SR
V = '/workspace/audio/voices/real/'
TAKES = ['fire_male_01', 'fire_female_01', 'fire_male_02', 'fire_female_03', 'fire_female_02', 'fire_male_01']
DECK = dsp.ir_space(dur=0.9, decay=0.35, lp0=6000, lp1=1500, predelay=0.008, seed=12)
def stack(n, seed=1):
    r = np.random.default_rng(seed); out = dsp.buf(3.6); t = 0.0
    pans = [0.0, -0.45, 0.4, -0.7, 0.7, -0.2]
    for k in range(n):
        x = dsp.load(V + TAKES[k] + '.wav')
        det = 1.0 if k == 0 else 1 + r.choice([-1, 1]) * r.uniform(0.01, 0.03) * (2 if k == 5 else 1)   # re-used take: detuned further
        x = dsp.vari(x, det) if det != 1.0 else x
        if k: t += r.uniform(0.02, 0.08) if k < 3 else r.uniform(0.0, 0.05)       # 20-80 ms behind the caller, the rest bunch up
        p = pans[k]; x = dsp.st(x) * np.array([1 - max(0, p), 1 + min(0, p)])
        dsp.place(out, x, 0.02 + t, 0 if k == 0 else -r.uniform(0.5, 4.0))
    out = dsp.mix(out, dsp.conv(out, DECK, -18 + 2*min(n, 6)/6*3))[:len(out)]
    out = AB.match(out, -15.0 + 3.0*np.log(n)/np.log(6))   # loudness grows +3 LU from 1 to 6 voices: bigger, not just louder
    return dsp.trim_tail(out, -70)
if __name__ == '__main__':
    P = '/workspace/audio/preview/round3/'; gap = np.zeros((int(1.1*SR), 2))
    a = [dsp.limit(stack(n), -1.5) for n in (1, 3, 6)]
    dsp.save(P + '02_crew_stack_demo.mp3', np.concatenate([np.zeros((int(0.3*SR), 2)), a[0], gap, a[1], gap, a[2], gap]))
    # in context: each crew size calls Fire! and its broadside answers (1, 3, 6 guns)
    o = dsp.buf(19.0); t = 0.3
    for n, c in zip((1, 3, 6), a):
        dsp.place(o, c, t); b = M3.broadside(n, seed=20 + n); dsp.place(o, b, t + 0.75, -5); t += 6.0
    dsp.save(P + '02_crew_stack_in_context.mp3', dsp.limit(o, -1.2))
    print('ok')
