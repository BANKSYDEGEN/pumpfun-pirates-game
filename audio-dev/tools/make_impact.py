# Cannonball hitting a wooden hull: SMASH (real wood smash/break) + CRUNCH (real break, pitched down) + THUD (synth sub
# + pitched-down smash) + SPLINTERS (real plywood/splinter recordings) + DEBRIS tail (real pieces falling, small water
# plops) + TIMBER GROAN (real slow wood snap/creak), in a short open-sea space.
import sys; sys.path.insert(0, '/workspace/audio/tools')
import numpy as np, dsp
from dsp import SR
L = lambda f: dsp.load(f)
SMASH = [dsp.sec(L('woodbreak_536777.mp3'), 0.03, 0.65), dsp.sec(L('woodbreak_109359.mp3'), 0.06, 0.75), dsp.sec(L('woodbreak_518791.mp3'), 1.82, 2.5), dsp.sec(L('woodbreak_536777.mp3'), 0.64, 1.05)]
CRUNCH = [dsp.sec(L('woodbreak_669457.mp3'), 0.62, 1.4), dsp.sec(L('woodbreak_518791.mp3'), 4.19, 5.0), dsp.sec(L('woodbreak_109359.mp3'), 0.76, 1.6)]
SPL = L('splinter_873248.mp3'); SPL2 = L('splinter_438331.mp3')
SPLS = [dsp.sec(SPL, 0.18, 0.9), dsp.sec(SPL, 3.42, 4.2), dsp.sec(SPL2, 0.15, 1.2), dsp.sec(SPL, 4.63, 5.4), dsp.sec(SPL2, 2.32, 3.2)]
DEBRIS = [dsp.sec(L('splinter_562187.mp3'), 0.1, 1.8), dsp.sec(L('splinter_568413.mp3'), 0.5, 2.2), dsp.sec(L('splinter_774268.mp3'), 0.28, 2.4)]
PLOP = L('splashsm_693541.mp3'); PLOPS = [dsp.sec(PLOP, t - 0.005, t + 0.3) for t in (0.14, 0.43, 0.92, 1.31, 1.64)]
GROAN = dsp.sec(L('woodbreak_406093.mp3'), 1.4, 3.5)
IR = dsp.ir_space(dur=1.8, decay=1.8, lp0=5000, lp1=700, early=[(0.013, 0.4), (0.031, 0.25)], seed=11)
def impact(i, heavy=True, seed=None):
    r = np.random.default_rng(seed if seed is not None else 300 + i); p = 1 + r.uniform(-0.06, 0.06)
    dry = dsp.buf(3.6)
    sm = dsp.vari(SMASH[i % len(SMASH)], p*0.82); sm = dsp.filt(dsp.peq(sm, 180, 3, 0.9), 'highpass', 50); sm = dsp.fade(dsp.norm(sm, 0), 0.001, 0.25)
    cr = dsp.vari(CRUNCH[i % len(CRUNCH)], p*0.6); cr = dsp.filt(dsp.filt(cr, 'lowpass', 3000), 'highpass', 60); cr = dsp.fade(dsp.norm(cr, 0), 0.002, 0.3)
    th = dsp.filt(dsp.vari(SMASH[0], 0.45), 'lowpass', 250); th = dsp.fade(dsp.norm(th, 0), 0.001, 0.3)
    sub = dsp.sat(dsp.sine_sweep(120*p, 42, 0.45, curve=3.5, a=0.002, env_pow=2), 1.8)
    sp = dsp.filt(dsp.vari(SPLS[(i*2) % len(SPLS)], p*1.05), 'highpass', 1200); sp = dsp.fade(dsp.norm(sp, 0), 0.002, 0.3)
    sp2 = dsp.filt(dsp.vari(SPLS[(i*2+3) % len(SPLS)], p*0.95), 'highpass', 900); sp2 = dsp.fade(dsp.norm(sp2, 0), 0.002, 0.3)
    db = dsp.vari(DEBRIS[i % len(DEBRIS)], p*0.85); db = dsp.filt(db, 'highpass', 150); db = dsp.fade(dsp.norm(db, 0), 0.02, 0.6)
    t0 = 0.01
    dsp.place(dry, sm, t0, -3)
    dsp.place(dry, cr, t0 + 0.012, -7)
    dsp.place(dry, th, t0, -6)
    dsp.place(dry, sub, t0, -8)
    dsp.place(dry, sp, t0 + 0.03 + r.uniform(0, 0.03), -12)
    dsp.place(dry, sp2, t0 + 0.11 + r.uniform(0, 0.05), -15)
    dsp.place(dry, db, t0 + 0.25 + r.uniform(0, 0.1), -17)
    for k in range(3 + i % 2):  # debris landing in the water around the hull
        pl = dsp.filt(dsp.vari(PLOPS[r.integers(0, len(PLOPS))], r.uniform(0.8, 1.2)), 'highpass', 200)
        pan = r.uniform(-0.7, 0.7); pl = dsp.st(dsp.mono(pl)) * np.array([1 - max(0, pan), 1 + min(0, pan)])
        dsp.place(dry, dsp.fade(dsp.norm(pl, 0), 0.002, 0.1), t0 + 0.45 + k*0.18 + r.uniform(0, 0.15), -23 - k*2)
    if heavy:
        g = dsp.filt(dsp.vari(GROAN, 0.7*p), 'lowpass', 1800); g = dsp.fade(dsp.norm(g, 0), 0.05, 0.8)
        dsp.place(dry, g, t0 + 0.2, -19)
    out = dry + dsp.conv(dsp.filt(dry, 'lowpass', 4000), IR)[:len(dry)] * 10**(-17/20)
    out = dsp.comp(out, -12, 2.0, 0.01, 0.15)
    return dsp.trim_tail(out, -75)
if __name__ == '__main__':
    import os; os.makedirs('/workspace/audio/sfx/impact', exist_ok=True)
    vs = []
    for i in range(3):
        y = impact(i); y = y * (10**(-11.5/20) / np.sqrt(np.mean(y[:int(0.3*SR)]**2))); y = dsp.fade(dsp.limit(y, -1.2), 0, 0.2)
        dsp.save(f'/workspace/audio/sfx/impact/impact_wood_heavy_{i+1:02d}.wav', y); vs.append(y)
        dsp.save(f'/workspace/audio/preview/02_cannon_impact_v{i+1}.mp3', y)
    reel = dsp.buf(9)
    for k, y in enumerate(vs): dsp.place(reel, y, 0.2 + k*2.9)
    dsp.save('/workspace/audio/preview/02_cannon_impact_reel.mp3', dsp.fade(dsp.limit(dsp.trim_tail(reel, -70), -1.2), 0, 0.2))
    print('ok')
